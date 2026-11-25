/**
 * phase-boundary extract: SC class-body extract — probe-derived return blobs.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { vmNumberToBigInt } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import type { AuthenticationProgramStateCommon } from '@bitauth/libauth/build/lib/vm/vm-types.js';
import {
  Op, bytecodeToScript, scriptToBytecode, sha256 as sha256Sync,
  type AbiFunction, type Artifact, type ExternalResultEncoding,
} from '@solidcash/utils';
import type NetworkProvider from '../network/NetworkProvider.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../utils.js';
import {
  extractEvmReturnCommitment,
  extractMixedReturnBlob,
  isCanonicalEvmReturnBlob,
  isConstrainedEvmResultVector,
  probeRequireStatement,
} from './external-return-encoding.js';
import { followsProbeEquality } from './probe-instruction-sequence.js';
import { evaluateProbeTrace } from './faithful-probe-trace.js';
import { extractHashedReturnCommitmentAtOutput } from './hashed-return-probe.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import {
  decodeScriptNumber,
  extractCommitmentsFromTrace,
  extractPendingReturnCommitment,
  extractPendingReturnCommitmentAtOutput,
} from './trace-commitment-helpers.js';
import { extractVerifiedValuesFromTrace } from './trace-verified-value-helpers.js';
import { extractGraphEventExpectations } from './graph-event-expectations.js';

export interface DeriveReturnBlobHost {
  readonly inner: { provider: NetworkProvider; artifact: Artifact };
  lastReturnProbeFailure?: string;
}

/** A failed trace's missing pin or preservation of its provisional output cannot replace an independent seed. */
export function failedProbeCannotReplaceTransientSeed(
  traceFailed: boolean, observedPin: string | undefined, materialized: string | undefined,
): boolean {
  return traceFailed && (observedPin === undefined || observedPin === materialized);
}

export function deriveReturnBlob(
  host: DeriveReturnBlobHost,
  builder: StatefulTransactionBuilder,
  returnOutputIndex: number,
  inputIndex = 0,
): Uint8Array | undefined {
  const probe = builder.build();
  const transaction = probe.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(probe.inputs);
  const trace = evaluateProbeTrace(host.inner.provider, { inputIndex, sourceOutputs, transaction });
  host.lastReturnProbeFailure = describeReturnProbeFailure(host, trace, inputIndex);
  if (host.lastReturnProbeFailure !== undefined && (globalThis as {
    process?: { env?: Record<string, string> };
  }).process?.env?.SOLIDC_DEBUG_MSG_SENDER_KEY === '1') {
    console.error('probe-failed', JSON.stringify({
      probeId: [probe.inputs.length, String(probe.inputs[0]?.txid ?? '?').slice(0, 8), probe.inputs[0]?.vout],
      returnOutputIndex,
      // Keep the whole report: it already carries the window, the operand stack and the compared pair, which is
      // what the next step needs (a 200-char cut hides exactly those fields).
      failure: String(host.lastReturnProbeFailure).slice(0, 900),
    }));
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_PROBE_DEFINES === '1' && host.lastReturnProbeFailure !== undefined) {
    // Resolve the frame's own OP_DEFINE table: a body's `push(id) OP_INVOKE` names a definition the FRAME
    // installed, which is the only authority for what that callable does (the artifact's `invokeDebug` uses the
    // same numbering by construction, but a mismatch here is otherwise indistinguishable from a wrong operand).
    const definitions: string[] = [];
    try {
      const instructions = bytecodeToScript(
        transaction.inputs[inputIndex]?.unlockingBytecode ?? new Uint8Array(),
      );
      if (Array.isArray(instructions)) {
        for (let at = 0; at < instructions.length; at += 1) {
          if (instructions[at] !== 0x89) continue;
          const body = instructions[at - 1];
          const id = instructions[at - 2];
          if (!(body instanceof Uint8Array) || !(id instanceof Uint8Array)) continue;
          definitions.push(`${binToHex(id)}:${body.length}b:${binToHex(body).slice(0, 24)}`);
        }
      }
    } catch {
      definitions.push('undecodable');
    }
    console.error('probe-frame-defines', JSON.stringify({
      inputIndex,
      count: definitions.length,
      shortest: definitions.slice().sort((left, right) =>
        Number(left.split(':')[1].replace('b', '')) - Number(right.split(':')[1].replace('b', ''))).slice(0, 12),
    }));
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_PROBE_IO === '1') {
    console.error('probe-return-slot', JSON.stringify({
      returnOutputIndex,
      outputs: transaction.outputs.length,
      at: transaction.outputs[returnOutputIndex] === undefined ? undefined : {
        lock: binToHex((transaction.outputs[returnOutputIndex] as {
          lockingBytecode: Uint8Array;
        }).lockingBytecode).slice(0, 22),
        category: binToHex(((transaction.outputs[returnOutputIndex] as {
          token?: { category?: Uint8Array };
        }).token?.category ?? new Uint8Array())).slice(0, 20),
        commitment: (transaction.outputs[returnOutputIndex] as {
          token?: { nft?: { commitment?: Uint8Array } };
        }).token?.nft?.commitment === undefined ? undefined
          : binToHex((transaction.outputs[returnOutputIndex] as {
            token: { nft: { commitment: Uint8Array } };
          }).token.nft.commitment),
      },
    }));
    console.error('probe-outputs', JSON.stringify(transaction.outputs.map((output, index) => ({
      index,
      value: String((output as { valueSatoshis?: bigint }).valueSatoshis ?? 0n),
      lock: binToHex((output as { lockingBytecode: Uint8Array }).lockingBytecode).slice(0, 22),
      category: binToHex(((output as { token?: { category?: Uint8Array } }).token?.category
        ?? new Uint8Array())).slice(0, 20),
      commitment: (output as { token?: { nft?: { commitment?: Uint8Array } } }).token?.nft?.commitment === undefined
        ? undefined : binToHex((output as { token: { nft: { commitment: Uint8Array } } }).token.nft.commitment),
    }))));
    // One-line probe identity: several probes run per derivation and stderr interleaves, so a refusal must be
    // attributable to the dump that belongs to its own build.
    console.error('probe-shape-id', JSON.stringify([
      probe.inputs.length, String(probe.inputs[0]?.txid ?? '?').slice(0, 8), probe.inputs[0]?.vout,
    ]));
    console.error('probe-input-locks', JSON.stringify(probe.inputs.map((input, index) => {
      const source = sourceOutputs[index];
      return {
        index,
        outpoint: `${input.txid.slice(0, 8)}:${input.vout}`,
        lockLen: source?.lockingBytecode.length,
        lockHead: binToHex(source?.lockingBytecode ?? new Uint8Array()).slice(0, 24),
        category: source?.token?.category === undefined ? undefined
          : binToHex(source.token.category).slice(0, 10),
        commitLen: source?.token?.nft?.commitment?.length,
      };
    })));
    console.error('probe-internals', JSON.stringify(probe.inputs.map((input, index) => {
      const unlocker = (input as {
        unlocker?: { params?: unknown[]; abiFunction?: { inputs?: Array<{ name?: string }> } };
      }).unlocker;
      const names = unlocker?.abiFunction?.inputs ?? [];
      return {
        index,
        internals: (unlocker?.params ?? []).flatMap((param, paramIndex) => {
          const name = names[paramIndex]?.name ?? `#${paramIndex}`;
          if (!name.startsWith('__internal__')) return [];
          // Byte witnesses are where an unresolved sentinel hides (`ff…ff` categories, length-only prints); print
          // the bytes, not `String(Uint8Array)`, so a sentinel is visible in the record itself.
          const value = param instanceof Uint8Array
            ? `b${param.length}:${binToHex(param).slice(0, 72)}`
            : String(param);
          return [`${name}=${value}`];
        }),
      };
    })));
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_CHUNK_STAGE === '1') {
    const failing = trace.at(-1);
    console.error('probe-locks', [
      `owner=${host.inner.artifact.contractName} ret=${returnOutputIndex}`
      + ` txLocktime=${String((transaction as unknown as { locktime?: unknown }).locktime ?? 'n/a')}`
      + ` txVersion=${String((transaction as unknown as { version?: unknown }).version ?? 'n/a')}`,
      `stack32=${[...new Set(trace.slice(-40).flatMap((state) => (state.stack ?? [])
        .filter((item) => item.length === 32).map((item) => binToHex(item))))].slice(0, 10).join(',')}`,
      `altLong=${[...new Set(trace.slice(-60).flatMap((state) => ((state as unknown as {
        alternateStack?: Uint8Array[] }).alternateStack ?? []).filter((item) => item.length >= 100 && item.length <= 300)
        .map((item) => `${item.length}:${binToHex(item)}`)))].slice(0, 3).join(' ; ')}`,
      `rootHits=${(() => {
        const target = '62a26a0888aa6e4509ba18da1850d1d570f1472d37c062c38dada7922b733e9d';
        const hits: string[] = [];
        for (let index = 0; index < trace.length; index += 1) {
          const state = trace[index]!;
          const banks: Uint8Array[][] = [state.stack ?? [],
            (state as unknown as { alternateStack?: Uint8Array[] }).alternateStack ?? []];
          for (const bank of banks) {
            for (const item of bank) {
              if (item.length === 32 && binToHex(item) === target) hits.push(`${index}:${state.ip}`);
            }
          }
        }
        return hits.slice(0, 6).join(',') + ` (states ${trace.length})`;
      })()}`,
      `long=${[...new Set(trace.slice(-60).flatMap((state) => (state.stack ?? [])
        .filter((item) => item.length >= 100 && item.length <= 300).map((item) => `${item.length}:${binToHex(item)}`)))]
        .slice(0, 3).join(' ; ')}`,
      ...transaction.outputs.map((output, index) => `out${index}=${binToHex(output.lockingBytecode)}`),
      // External-call coordinates the probe passed: the covenant reads the callee's master bytecode at these
      // indices and requires it to equal the address the caller named, so print the index AND the lock it names.
      ...(() => {
        const rows: string[] = [];
        probe.inputs.forEach((input, index) => {
          const unlocker = (input as {
            unlocker?: { params?: unknown[]; abiFunction?: { inputs?: Array<{ name?: string }> } };
          }).unlocker;
          const names = unlocker?.abiFunction?.inputs ?? [];
          (unlocker?.params ?? []).forEach((param, paramIndex) => {
            const name = names[paramIndex]?.name ?? '';
            if (!/^__internal__(?:extcall|externalCall)/.test(name)) return;
            const lock = typeof param === 'bigint' && param >= 0n
              ? binToHex(sourceOutputs[Number(param)]?.lockingBytecode ?? new Uint8Array())
              : '';
            rows.push(`ext in${index} ${name}=${String(param)}${lock === '' ? '' : ` -> ${lock}`}`);
          });
        });
        return rows.slice(0, 30);
      })(),
      ...probe.inputs.map((input, index) => {
        const unlocker = (input as { unlocker?: {
          contract?: { artifact?: { contractName?: string } };
          abiFunction?: { name?: string };
          params?: unknown[];
        } }).unlocker;
        const params = unlocker?.params ?? [];
        // A negative numeric argument is the SDK's neutral placeholder (usually -1); its VM-number encoding is
        // `0x81`, which is what an address-typed operand looks like when no real value was resolved for it.
        const placeholders = params.flatMap((param, paramIndex) => (
          typeof param === 'bigint' && param < 0n ? [`${paramIndex}=${param}`] : []));
        return `in${index}=${unlocker?.contract?.artifact?.contractName ?? '?'}`
          + `.${unlocker?.abiFunction?.name ?? '?'}`
          + ` n=${params.length}${placeholders.length > 0 ? ` neg[${placeholders.join(',')}]` : ''}`
          + ` lock=${(() => {
            const generated = (unlocker as { generateLockingBytecode?: () => Uint8Array })
              ?.generateLockingBytecode?.();
            return generated === undefined ? 'n/a' : binToHex(generated);
          })()}`;
      }),
      `programLen=${(failing?.instructions ?? []).length}`,
      `progHead=${((failing?.instructions ?? []) as Array<{ opcode?: number }>)
        .slice(0, 10).map((instruction) => instruction.opcode).join(',')}`,
      `progTail=${((failing?.instructions ?? []) as Array<{ opcode?: number }>)
        .slice(-4).map((instruction) => instruction.opcode).join(',')}`,
      `ip=${String((failing as { ip?: number } | undefined)?.ip ?? 'n/a')}`,
      `stackN=${(failing?.stack ?? []).length}`,
      `head=${(failing?.stack ?? []).slice(0, 4).map((item) => (
        `${item.length}:${binToHex(item)}`)).join(' ')}`,
      `tail=${(failing?.stack ?? []).slice(-4).map((item) => (
        `${item.length}:${binToHex(item)}`)).join(' ')}`,
      `guardFrames=${trace.flatMap((state, ordinal) => {
        const step = state as { ip?: number; instructions?: Array<{ opcode?: number }>;
          stack?: Uint8Array[]; error?: unknown };
        if ((step.instructions ?? []).length !== 15) return [];
        return [`${ordinal}|ip${step.ip}${step.error === undefined ? '' : '|ERR'}|`
          + `${(step.stack ?? []).slice(-4).map((item) => (
            `${item.length}:${binToHex(item)}`)).join('~')}`];
      }).slice(-6).join(' || ')}`,
      `recent=${trace.slice(-6).map((state, offset) => {
        const step = state as { ip?: number; instructions?: Array<{ opcode?: number }>;
          stack?: Uint8Array[]; error?: unknown };
        const opcode = step.instructions?.[step.ip ?? -1]?.opcode;
        return `${trace.length - 6 + offset}|ip${step.ip}|op${opcode ?? '?'}`
          + `|err${step.error === undefined ? '' : '!'}`
          + `|${(step.stack ?? []).slice(-3).map((item) => (
            `${item.length}:${binToHex(item).slice(0, 40)}`)).join('~')}`;
      }).join(' ')}`,
      `code=${(() => {
        const env = (globalThis as { process?: { env?: Record<string, string> } }).process?.env;
        const from = Number(env?.SOLIDC_DEBUG_PROBE_WINDOW_FROM ?? 600);
        const to = Number(env?.SOLIDC_DEBUG_PROBE_WINDOW_TO ?? 680);
        const program = (failing?.instructions ?? []) as Array<{ opcode: number; data?: Uint8Array }>;
        return program.slice(from, to).map((instruction, offset) => (
          `${from + offset}=${instruction.opcode}`
          + `${instruction.data !== undefined ? `:${binToHex(instruction.data).slice(0, 64)}` : ''}`
        )).join(' ');
      })()}`,
    ].join(' | '));
  }
  const commitments = extractCommitmentsFromTrace(trace, 1, {
    min: returnOutputIndex, max: returnOutputIndex + 1,
  });
  if ((!commitments || commitments.length === 0)
    && (globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_COLLECTION_FETCH === '1') {
    console.error('return-blob-trace-tail', {
      inputIndex, returnOutputIndex, error: trace.at(-1)?.error,
      sourceCommitments: sourceOutputs.map((output, index) => ({
        index,
        category: output.token?.category === undefined ? undefined : binToHex(output.token.category),
        lockingBytecodeLength: output.lockingBytecode.length,
        commitment: output.token?.nft?.commitment === undefined
          ? undefined : binToHex(output.token.nft.commitment),
      })),
      outputs: transaction.outputs.map((output, index) => ({
        index,
        category: output.token?.category === undefined ? undefined : binToHex(output.token.category),
        lockingBytecode: binToHex(output.lockingBytecode),
        commitment: output.token?.nft?.commitment === undefined
          ? undefined : binToHex(output.token.nft.commitment),
      })),
      failedProgram: trace.at(-1)?.instructions.length && trace.at(-1)!.instructions.length < 120
        ? trace.at(-1)!.instructions.map((instruction) => ({
          opcode: instruction.opcode,
          ...('data' in instruction && { data: binToHex(instruction.data) }),
        })) : undefined,
      tail: trace.slice(-40).map((state) => ({
        ip: state.ip, instructionCount: state.instructions.length,
        opcode: state.instructions[state.ip]?.opcode, error: state.error,
        stack: state.stack.slice(-8).map(binToHex),
      })),
      collectionStates: trace.filter((state) => state.stack.some((item) => {
        const hex = binToHex(item);
        return hex.length >= 128 && (hex.startsWith('e3b0c44298fc1c14') || hex.startsWith('0000000000000000'));
      })).slice(-80).map((state) => ({
        ip: state.ip, instructionCount: state.instructions.length,
        opcode: state.instructions[state.ip]?.opcode, error: state.error,
        stack: state.stack.slice(-10).map(binToHex),
      })),
      focusedStates: trace.filter((state) => state.instructions.length > 2000
        && state.ip >= 560 && state.ip <= 780).map((state) => ({
        ip: state.ip, opcode: state.instructions[state.ip]?.opcode, error: state.error,
        stack: state.stack.slice(-12).map(binToHex),
      })),
    });
  }
  const pending = extractPendingReturnCommitmentAtOutput(trace, returnOutputIndex);
  const hashed = extractHashedReturnCommitmentAtOutput(trace, returnOutputIndex);
  if (hashed !== undefined) return hashed;
  const commitment = commitments?.[0] ?? pending;
  // A direct entry pins its call's record; the builder keeps the result behind it.
  return commitment === undefined ? undefined : builder.rawOfReturnRecord(undefined, hexToBin(commitment), trace);
}


/**
 * Summarize why a return-value probe failed (OP_EQUALVERIFY mismatch / stack dump).
 * Used by return-blob derivation hosts when SOLIDC_DEBUG_* probes need a stable failure string.
 */
export function describeReturnProbeFailure(
  host: DeriveReturnBlobHost,
  trace: readonly {
    ip: number; error?: unknown; stack?: readonly Uint8Array[];
    instructions: readonly { opcode: number; data?: Uint8Array }[];
  }[],
  inputIndex: number,
): string | undefined {
  const last = trace.at(-1);
  if (!last) return undefined;
  const rawError = last.error;
  const detail = rawError === undefined ? undefined
    : typeof rawError === 'string' ? rawError
      : rawError && typeof rawError === 'object' && 'error' in (rawError as object)
        ? String((rawError as { error: unknown }).error)
        : String(rawError);
  const opcode = last.instructions[last.ip]?.opcode;
  const artifacts: Artifact[] = [host.inner.artifact as Artifact];
  const delegated = (host.inner.artifact as Artifact).delegateArtifact;
  if (delegated !== undefined) artifacts.push(delegated);
  const requirement = probeRequireStatement(artifacts, undefined, last.ip);
  const site = requirement
    ? `${requirement.contractName ?? 'contract'}:${requirement.line}`
      + `${requirement.message ? ` (${requirement.message})` : ''}`
    : undefined;
  if (detail === undefined && site === undefined) return undefined;
  // A bare "failed an OP_VERIFY" (or a compiler-emitted guard with no source line) cannot be attributed without
  // the instructions that produced it: report the window around the failure and the operands still on the stack,
  // exactly as the route preflight failure does.
  const windowStart = Math.max(0, last.ip - 6);
  const window = last.instructions.slice(windowStart, last.ip + 1).map((instruction) => {
    const data = instruction.data;
    return data === undefined || data.length === 0
      ? String(instruction.opcode)
      : `${instruction.opcode}:${binToHex(data).slice(0, 16)}`;
  }).join(' ');
  const operands = (last.stack ?? []).slice(-4).map((item, offset, items) => (
    `d${items.length - 1 - offset}=${item.length}b:${binToHex(item).slice(0, 40)}`
  )).join(' ');
  // The failure state has already popped the compared operands when the refusing instruction is a comparison, so
  // the step BEFORE it is where those two values are still readable.
  // The trace interleaves states from every program the probe executed (invoked bodies included), so the step
  // before the failure is only meaningful when it belongs to the SAME program body: match the instruction list
  // identity and the immediately preceding ip.
  const before = (() => {
    for (let at = trace.length - 2; at >= 0; at -= 1) {
      const candidate = trace[at];
      if (candidate.instructions !== last.instructions) continue;
      if ((candidate.ip ?? -1) === (last.ip ?? 0) - 1) return candidate;
    }
    return undefined;
  })();
  const compared = (before?.stack ?? []).slice(-2).map((item, offset) => (
    `${offset === 0 ? 'left' : 'right'}=${item.length}b:${binToHex(item).slice(0, 72)}`
  )).join(' ');
  // The failing comparison consumes a small working area, so the two operands alone do not show what the guard
  // addressed. Report the six values below them as well: they carry the coordinate and the vmap flags.
  const workingArea = (before?.stack ?? []).slice(-6).map((item, offset, items) => (
    `d${items.length - 1 - offset}=${item.length}b:${binToHex(item).slice(0, 44)}`
  )).join(' ');
  // A short refusing program is a compiler-emitted guard, and its whole step sequence is the only place the
  // operand each instruction consumed can be read: print ip, opcode and the stack top at every step.
  const steps = trace.slice(-12).map((state) => {
    const at = state.ip ?? -1;
    const instruction = state.instructions[at];
    const data = instruction?.data;
    const top = state.stack?.at(-1);
    return `${at}:${instruction?.opcode ?? '?'}${data === undefined || data.length === 0 ? ''
      : `:${binToHex(data).slice(0, 10)}`}${top === undefined ? ''
      : `@${top.length}b:${binToHex(top).slice(0, 20)}`}`;
  }).join(' ');
  return `probe stopped at ip ${last.ip}`
    + `${opcode !== undefined ? ` (opcode ${opcode})` : ''}`
    + `${detail !== undefined ? `: ${detail}` : ''}`
    + `${site !== undefined ? `; failing require in ${site}` : ''}`
    + `${window.length > 0 ? `; window ${window}` : ''}`
    + `${operands.length > 0 ? `; stack ${operands}` : ''}`
    + `${compared.length > 0 ? `; compared ${compared}` : ''}`
    + `${workingArea.length > 0 ? `; area ${workingArea}` : ''}`
    + `${steps.length > 0 ? `; steps ${steps}` : ''}`
    + `; probed input ${inputIndex}`;
}
