/**
 * Finalized-transaction byte and covenant gates used by the direct send path.
 *
 * The byte rules come from {@link ./finalization-byte-gate.ts}; the covenant objection is the same per-input
 * BCH-2026 evaluation the mock provider judges a broadcast against.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { Transaction } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2023/bch-2023-types.js';
import {
  encodeAuthenticationInstructions, vmNumberToBigInt,
} from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import type { AuthenticationInstruction } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-types.js';
import { generateLibauthSourceOutputs } from './utils.js';
import { createVirtualMachineBch2026ForProvider } from './network/createVirtualMachine.js';
import { rememberPreparedCovenantValidation } from './network/prepared-covenant-receipt.js';
import { matchesExecutedBody } from './oracle/pool/program.js';
import { isExternallySignedUnlocker } from './external-signing.js';
import type { Unlocker } from './interfaces.js';
import type { TransactionBuilder } from './TransactionBuilder.js';
import {
  assessFinalizedTransactionBytes, assertFinalizedTransactionBytes, enforcedFinalizedByteRefusals,
  type FinalizedByteGateOptions, type FinalizedByteSubject,
} from './finalization-byte-gate.js';

export {
  inputSubjectsOfBuilder, assertFinalizedTransactionBytes,
  finalizedByteGateOptionsForProvider,
} from './finalization-byte-gate.js';
export type { FinalizedByteSubject } from './finalization-byte-gate.js';

/** The covenant's own objection to a finalized transaction, or undefined when every input evaluates. */
export function covenantObjectionOf(
  builder: TransactionBuilder, transaction: Transaction,
): string | undefined {
  try {
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(builder.provider);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      const objection = vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction }));
      if (objection !== true) return `input ${inputIndex}: ${objection}`;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** Refuse finalized bytes that break a consensus/relay rule or the covenant, naming both when both object. */
export function assertFinalizedBytesWithCovenant(
  builder: TransactionBuilder, transaction: Transaction,
  subjects: readonly (FinalizedByteSubject | undefined)[],
  options: Omit<FinalizedByteGateOptions, 'inputSubjects'> = {},
): void {
  const verdict = assessFinalizedTransactionBytes(transaction, subjects, options.consensusLimits);
  const enforced = enforcedFinalizedByteRefusals(verdict, options.allowNonRelayable);
  if (enforced.length === 0) return;
  const covenant = covenantObjectionOf(builder, transaction);
  if (covenant === undefined) {
    assertFinalizedTransactionBytes(transaction, {
      inputSubjects: subjects,
      consensusLimits: options.consensusLimits,
      allowNonRelayable: options.allowNonRelayable,
    });
  }
  throw new Error(
    `finalized transaction refused by its covenant and ${enforced.length} byte rule(s) `
    + `(${verdict.serializedBytes} serialized bytes, ${verdict.inputCount} inputs, `
    + `${verdict.outputCount} outputs):\n  [covenant] ${covenant}\n`
    + enforced.map((row) => `  [${row.regime}] ${row.rule} at ${row.where}: ${row.detail}`).join('\n'),
  );
}

/** What the VM reports of an input it refused. */
interface PreflightFailure {
  ip: number;
  programLength: number;
  opcode?: number;
  previousOpcode?: number;
  instructions: readonly AuthenticationInstruction[];
  window: readonly string[];
}

type RequireEntry = { ip: number; line: number; message?: string };
type ArtifactDebugView = {
  contractName?: string;
  source?: string;
  functionBodies?: Record<string, string>;
  delegateArtifact?: unknown;
  debug?: {
    /** `false` on an unoptimised build: instruction pointers map exactly to source locations. */
    optimise?: boolean;
    functionDebug?: Record<string, { requires?: RequireEntry[]; sourceMap?: string }>;
    invokeDebug?: Record<string, { bytecode: string; requires: RequireEntry[] }>;
  };
};
type InputView = {
  unlocker?: { abiFunction?: { selector?: string; name?: string }; contract?: { artifact?: unknown } };
} | undefined;

const envFlag = (name: string): boolean =>
  (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.[name] === '1';

/** An instruction as `opcode` or `opcode:data-prefix`. */
const describeInstruction = (instruction: AuthenticationInstruction, dataChars: number): string => {
  const data = (instruction as { data?: Uint8Array }).data;
  return data === undefined || data.length === 0
    ? String(instruction.opcode) : `${String(instruction.opcode)}:${binToHex(data).slice(0, dataChars)}`;
};

/**
 * The require a failing input ran, from the exact executed body. Every participant's published bodies and
 * invoked helpers are compared, a delegate implementation's too; an ambiguous match attributes nothing.
 */
function bodyRequireAttribution(
  builder: TransactionBuilder, input: InputView, failure: PreflightFailure | undefined,
): { exact?: { artifactName: string; requireStatement: RequireEntry }; possibleMessage?: string } | undefined {
  if (failure === undefined || !Number.isSafeInteger(failure.ip)) return undefined;
  const executedBody = binToHex(encodeAuthenticationInstructions([...failure.instructions]));
  const matches: Array<{ artifactName: string; selector: string; requireStatement: RequireEntry }> = [];
  const visited = new Set<unknown>();
  const atIp = (requires: readonly RequireEntry[] | undefined): RequireEntry | undefined =>
    requires?.find((entry) => entry.ip === failure.ip - 1) ?? requires?.find((entry) => entry.ip === failure.ip);
  const inspect = (candidate: unknown): void => {
    if (candidate === undefined || candidate === null || visited.has(candidate)) return;
    visited.add(candidate);
    const artifact = candidate as ArtifactDebugView;
    for (const [selector, body] of Object.entries(artifact.functionBodies ?? {})) {
      if (!matchesExecutedBody(body, executedBody)) continue;
      const requireStatement = atIp(artifact.debug?.functionDebug?.[selector]?.requires);
      if (requireStatement !== undefined) {
        matches.push({ artifactName: artifact.contractName ?? 'contract', selector, requireStatement });
      }
    }
    // An OP_INVOKE failure reports an instruction pointer in the active helper, not in the outer selector body.
    for (const [identifier, body] of Object.entries(artifact.debug?.invokeDebug ?? {})) {
      if (!matchesExecutedBody(body.bytecode, executedBody)) continue;
      const requireStatement = atIp(body.requires);
      if (requireStatement !== undefined) {
        matches.push({ artifactName: artifact.contractName ?? 'contract', selector: `invoke:${identifier}`, requireStatement });
      }
    }
    inspect(artifact.delegateArtifact);
  };
  for (const participant of builder.inputs as InputView[]) inspect(participant?.unlocker?.contract?.artifact);
  const activeSelector = input?.unlocker?.abiFunction?.selector?.toLowerCase();
  const activeMatches = activeSelector === undefined ? []
    : matches.filter((match) => match.selector.toLowerCase() === activeSelector);
  const selected = activeMatches.length > 0 ? activeMatches : matches;
  const unique = new Map(selected.map((match) => [
    [match.artifactName, match.selector, match.requireStatement.ip, match.requireStatement.line,
      match.requireStatement.message ?? ''].join('\u0000'), match,
  ]));
  if (unique.size === 1) return { exact: [...unique.values()][0] };
  // Byte-identical bodies of several functions name no line, but one shared reason is still worth showing.
  const messages = new Set([...unique.values()].map((match) => match.requireStatement.message)
    .filter((message): message is string => message !== undefined));
  return messages.size === 1 ? { possibleMessage: [...messages][0] } : undefined;
}

/** Under `SOLIDC_DEBUG_FAILURE_POINT=1`, the require nearest the failing instruction by the published tables. */
function detailedRequireSite(input: InputView, failure: PreflightFailure | undefined): string {
  const artifacts: ArtifactDebugView[] = [];
  const seen = new Set<unknown>();
  const add = (artifact: unknown): void => {
    if (artifact === undefined || artifact === null || seen.has(artifact)) return;
    seen.add(artifact);
    artifacts.push(artifact as ArtifactDebugView);
    add((artifact as ArtifactDebugView).delegateArtifact);
  };
  add(input?.unlocker?.contract?.artifact);
  const selector = input?.unlocker?.abiFunction?.selector;
  for (const artifact of artifacts) {
    const functions = artifact.debug?.functionDebug;
    if (!functions) continue;
    const selectors = selector !== undefined && functions[selector] !== undefined ? [selector] : Object.keys(functions);
    for (const candidate of selectors) {
      const requirements = functions[candidate]?.requires ?? [];
      const hit = requirements.find((entry) => entry.ip === (failure?.ip ?? -1) - 1)
        ?? requirements.find((entry) => entry.ip === failure?.ip);
      if (hit !== undefined) {
        return `; failing require in ${artifact.contractName ?? 'contract'}:${hit.line}`
          + `${hit.message === undefined ? '' : ` (${hit.message})`}`;
      }
    }
  }
  // No `requires` entry: fall back to the source map. The assembled frame carries a prologue the published body
  // does not, so the body index is the runtime ip minus that difference.
  const runtimeIp = failure?.ip;
  if (runtimeIp === undefined) return '';
  for (const artifact of artifacts.filter((candidate) => candidate.functionBodies !== undefined)) {
    const functions = artifact.debug?.functionDebug;
    if (!functions) continue;
    const selectors = selector !== undefined && functions[selector] !== undefined ? [selector] : Object.keys(functions);
    for (const candidate of selectors) {
      const sourceMap = functions[candidate]?.sourceMap;
      const body = artifact.functionBodies?.[candidate];
      if (typeof sourceMap !== 'string' || typeof body !== 'string') continue;
      let instructions = 0;
      for (let offset = 0; offset < body.length / 2;) {
        const opcode = Number.parseInt(body.slice(offset * 2, offset * 2 + 2), 16);
        if (!Number.isFinite(opcode)) break;
        offset += opcode > 0 && opcode < 0x4c ? 1 + opcode
          : opcode === 0x4c ? 2 + Number.parseInt(body.slice((offset + 1) * 2, (offset + 2) * 2), 16)
            : opcode === 0x4d ? 3 + Number.parseInt(body.slice((offset + 1) * 2, (offset + 3) * 2), 16) : 1;
        instructions += 1;
      }
      const segments = sourceMap.split(';');
      const sourceLines = (artifact.source ?? '').split('\n');
      const correction = instructions - (failure?.programLength ?? instructions);
      // An unoptimised artifact maps the runtime index exactly; otherwise search nearby for a require-like line.
      const exact = artifact.debug?.optimise === false;
      const deltas = exact ? [0] : Array.from({ length: 29 }, (_unused, index) => index - 24);
      for (const delta of deltas) {
        for (const candidateIndex of [runtimeIp + correction + delta, runtimeIp + delta]) {
          if (candidateIndex < 0 || candidateIndex >= segments.length) continue;
          const line = Number(segments[candidateIndex]?.split(':')[0]);
          if (!Number.isFinite(line) || line <= 0) continue;
          const text = sourceLines[line - 1]?.trim();
          if (text === undefined || (!exact && !/require\s*\(|revert|assert\s*\(/.test(text))) continue;
          return `; failing instruction at ${artifact.contractName ?? 'contract'}:${line}`
            + `${exact ? ' (unoptimised artifact: exact mapping)' : ''} (${text.slice(0, 80)})`;
        }
      }
    }
  }
  return '';
}

/**
 * The error a refused input raises: the VM's own objection, the failing require's line and reason when the
 * executed body names one, and the exact require as `requireStatement` metadata. Under
 * `SOLIDC_DEBUG_FAILURE_POINT=1` it also names the failing instruction and its window.
 */
export function preflightFailure(
  builder: TransactionBuilder, inputIndex: number, rawVmReason: string, failure?: PreflightFailure,
): Error {
  const detailed = envFlag('SOLIDC_DEBUG_FAILURE_POINT');
  // libauth reports the state after a failed operation, so both the failing opcode (`ip - 1`) and the next are named.
  const location = !detailed || failure === undefined || !Number.isInteger(failure.ip) ? ''
    : ` (ip ${String(failure.ip)} of ${String(failure.programLength)}`
      + `${failure.opcode === undefined ? '' : `, opcode ${String(failure.opcode)}`}`
      + `${failure.previousOpcode === undefined ? '' : `, failing opcode ${String(failure.previousOpcode)}`}`
      + `${failure.window.length === 0 ? '' : `, window ${failure.window.join(' ')}`})`;
  const input = builder.inputs[inputIndex] as InputView;
  const attribution = bodyRequireAttribution(builder, input, failure);
  const exactRequire = attribution?.exact;
  const requireSite = exactRequire !== undefined
    ? `; failing require in ${exactRequire.artifactName}:${exactRequire.requireStatement.line}`
      + `${exactRequire.requireStatement.message === undefined ? '' : ` (${exactRequire.requireStatement.message})`}`
    : attribution?.possibleMessage !== undefined
      ? `; possible require reason from an equivalent function body: ${attribution.possibleMessage}`
      : detailed ? detailedRequireSite(input, failure) : '';
  // A bare `require` has no reason to append: keep the raw VM objection. Its site stays in `requireStatement`.
  const shownSite = exactRequire !== undefined && exactRequire.requireStatement.message === undefined && !detailed
    ? '' : requireSite;
  const mapped = new Error(`BCH-2026 preflight failed at input ${inputIndex}${location}: ${rawVmReason}${shownSite}`);
  if (exactRequire !== undefined) Object.assign(mapped, { requireStatement: exactRequire.requireStatement, inputIndex });
  return mapped;
}

/**
 * Refuse any covenant failure in an exact, fully assembled transaction. A wallet signs its own inputs at broadcast,
 * so their placeholders are not judged; when none is present the provider is told these bytes passed.
 */
export function assertFinalizedTransactionCovenants(
  builder: TransactionBuilder, transaction: Transaction,
): void {
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  const detailed = envFlag('SOLIDC_DEBUG_FAILURE_POINT');
  for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
    if (isExternallySignedUnlocker((builder.inputs[inputIndex] as { unlocker?: Unlocker } | undefined)?.unlocker)) {
      continue;
    }
    const evaluated = vm.evaluate({ inputIndex, sourceOutputs, transaction });
    const objection = vm.stateSuccess(evaluated);
    if (objection === true) continue;
    const program = evaluated.instructions as readonly AuthenticationInstruction[];
    if (detailed) {
      const tailIndexBytes = evaluated.stack.at(-1);
      const tailIndex = tailIndexBytes === undefined ? -1 : Number(vmNumberToBigInt(tailIndexBytes));
      const tailOutput = transaction.outputs[tailIndex];
      console.error('preflight-failure-point', JSON.stringify({
        inputIndex,
        ip: evaluated.ip,
        opcode: program[evaluated.ip]?.opcode,
        programLength: program.length,
        programHead: program.slice(0, 6).map((instruction) => describeInstruction(instruction, 12)),
        window: program.slice(Math.max(0, evaluated.ip - 24), evaluated.ip + 2)
          .map((instruction) => describeInstruction(instruction, 20)),
        controlStack: evaluated.controlStack.map((item) => (typeof item === 'object' ? {
          ip: item.ip, instructionCount: item.instructions.length, opcode: item.instructions[item.ip]?.opcode,
        } : item)),
        stack: evaluated.stack.slice(-24).map((item, offset, items) => (
          `${evaluated.stack.length - items.length + offset}:${item.length}:${binToHex(item).slice(0, 70)}`)),
        tailOutput: tailOutput === undefined ? undefined : {
          index: tailIndex,
          lockingBytecode: binToHex(tailOutput.lockingBytecode),
          category: tailOutput.token && binToHex(tailOutput.token.category),
          commitment: tailOutput.token?.nft && binToHex(tailOutput.token.nft.commitment),
        },
      }));
    }
    const windowStart = Math.max(0, evaluated.ip - 9);
    throw preflightFailure(builder, inputIndex, String(objection), {
      ip: evaluated.ip,
      instructions: program,
      programLength: program.length,
      opcode: program[evaluated.ip]?.opcode,
      previousOpcode: program[evaluated.ip - 1]?.opcode,
      window: program.slice(windowStart, evaluated.ip + 1).map((instruction) => describeInstruction(instruction, 12)),
    });
  }
  // A receipt says every input of these exact bytes passed, which a wallet's placeholder did not.
  const walletSigns = builder.inputs
    .some((input) => isExternallySignedUnlocker((input as { unlocker?: Unlocker }).unlocker));
  if (!walletSigns) rememberPreparedCovenantValidation(builder.provider, transaction, sourceOutputs);
}
