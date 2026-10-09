/**
 * phase-boundary extract: STB class-body extract — diagnostic covenant-failure trace logging.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { createVirtualMachineBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-vm.js';
import { Op } from '@solidcash/utils';
import type { TransactionBuilder, TransactionBuilderOptions } from '../TransactionBuilder.js';
import type { UnlockableUtxo, Utxo } from '../interfaces.js';
import { createVirtualMachineBch2026ForProvider } from '../network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../utils.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';

export interface CovenantFailureTraceHost {
  readonly masterUtxo: UnlockableUtxo;
  readonly categoryId: string;
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly externalIdentityAnchorUtxos: readonly UnlockableUtxo[];
  readonly builderOptions: TransactionBuilderOptions;
}

/**
 * On a covenant script failure, log an accurate op-level VM trace of the submitted tx. Runs the 2026 VM
 * (the one mocknet uses) so it executes the optimised subroutine bytecode the source-map debug can't track,
 * pinpointing the exact failing opcode + stack. Finds the failing input (named in the error, else scanned)
 * and prints a window of ops ending at the failure. Best-effort: the caller swallows any error here.
 */
export function logCovenantFailureTrace(
  host: CovenantFailureTraceHost,
  builder: TransactionBuilder,
  reason: string,
): void {
  const env = (globalThis as { process?: { env?: Record<string, string> } }).process?.env;
  // VM tracing re-evaluates a potentially enormous transaction and observes every opcode. Keep it opt-in:
  // expected covenant rejections are ordinary control flow in tests and applications, not a reason to spend
  // tens of seconds constructing and printing a diagnostic trace.
  if (env?.SOLIDC_DEBUG_COVENANT_TRACE !== '1'
    && env?.SOLIDC_DEBUG_PREFLIGHT !== '1'
    && env?.SOLIDC_TRACE_INPUT === undefined) return;
  const verbose = env?.SOLIDC_DEBUG_COVENANT_TRACE === '1';
  const transaction = builder.buildLibauthTransaction(true);
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const named = reason.match(/input(?: index)? (\d+)/);
  const traceInput = Number(env?.SOLIDC_TRACE_INPUT);
  const candidates = Number.isInteger(traceInput)
    ? [traceInput]
    : named ? [Number(named[1])] : (verbose ? transaction.inputs.map((_u, i) => i) : []);
  if (candidates.length === 0) return;
  const relaxedConsensus = (host.builderOptions.provider.consensusLimits?.maximumInputBytes ?? 10_000) > 10_000;
  if (relaxedConsensus) {
    const traceWidth = Number(env?.SOLIDC_TRACE_ITEMS ?? (verbose ? '4' : '3'));
    const traceDepth = Number(env?.SOLIDC_TRACE_RING ?? (verbose ? '520' : '20'));
    const commitmentWidth = Number(
      (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_TRACE_COMMITMENT ?? '24',
    );
    for (const idx of candidates) {
      let helper54: Array<{ opcode: number; data?: Uint8Array }> | undefined;
      let pendingInvokeId: string | undefined;
      const invokedBodies = new Map<number, Set<string>>();
      let pendingOutputBytecodeIndex: number | undefined;
      const outputBytecodeMatches: Array<{
        body: number; index: number; matches: boolean; countBefore?: string;
        left?: string; right?: string;
      }> = [];
      const ring: Array<{
        ip: number; opcode: number; depth: number; top: string[]; data?: string; bodyLen: number;
      }> = [];
      const vm = createVirtualMachineBch2026ForProvider(host.builderOptions.provider, {
        opcodes: new Set(Array.from({ length: 256 }, (_unused, opcode) => opcode)),
        beforeOperation: (unknownState) => {
          const state = unknownState as {
            ip: number; instructions: Array<{ opcode: number; data?: Uint8Array }>; stack: Uint8Array[];
          };
          const instruction = state.instructions[state.ip];
          if (instruction?.opcode === Op.OP_OUTPUTBYTECODE) {
            const encodedIndex = state.stack[state.stack.length - 1];
            pendingOutputBytecodeIndex = encodedIndex === undefined ? undefined : encodedIndex.reduce(
              (value, byte, byteIndex) => value + byte * (256 ** byteIndex), 0,
            );
          } else if ((instruction?.opcode === Op.OP_EQUAL || instruction?.opcode === Op.OP_EQUALVERIFY)
            && pendingOutputBytecodeIndex !== undefined) {
            const left = state.stack[state.stack.length - 2];
            const right = state.stack[state.stack.length - 1];
            outputBytecodeMatches.push({
              body: state.instructions.length,
              index: pendingOutputBytecodeIndex,
              matches: left !== undefined && right !== undefined && left.length === right.length
                && left.every((byte, byteIndex) => byte === right[byteIndex]),
              countBefore: state.stack[state.stack.length - 4] === undefined
                ? undefined : binToHex(state.stack[state.stack.length - 4]),
              left: left === undefined ? undefined : binToHex(left),
              right: right === undefined ? undefined : binToHex(right),
            });
            pendingOutputBytecodeIndex = undefined;
          }
          if (state.ip === 0 && pendingInvokeId !== undefined) {
            const ids = invokedBodies.get(state.instructions.length) ?? new Set<string>();
            ids.add(pendingInvokeId);
            invokedBodies.set(state.instructions.length, ids);
            pendingInvokeId = undefined;
          }
          if (instruction?.opcode === 0x8a) {
            pendingInvokeId = binToHex(state.stack[state.stack.length - 1] ?? new Uint8Array());
          }
          if (!helper54 && state.instructions.length === 54) helper54 = state.instructions;
          ring.push({
            ip: state.ip,
            opcode: instruction?.opcode ?? 0,
            // Body length identifies the frame: a failure inside a small outlined helper is usually a defect
            // at its CALL SITE, and the frame change is what points there.
            bodyLen: state.instructions.length,
            depth: state.stack.length,
            data: instruction?.data === undefined ? undefined : binToHex(instruction.data).slice(0, 64),
            top: state.stack.slice(-traceWidth).map((item) => {
              const hex = binToHex(item);
              if (hex.length === 0) return '<empty>';
              return hex.length > 80 ? `${hex.slice(0, 80)}..` : hex;
            }),
          });
          if (ring.length > traceDepth) ring.shift();
        },
      });
      const finalState = vm.evaluate({ inputIndex: idx, sourceOutputs, transaction }) as {
        error?: string; stack?: Uint8Array[];
      };
      if (!finalState.error) continue;
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_INPUTS === '1') {
        // eslint-disable-next-line no-console
        console.error(`[srcOutputs 100-126] ${sourceOutputs.slice(100, 127)
          .map((so, k) => `${100 + k}:`
            + `${so.token
              ? `nft=${so.token.nft?.commitment ? binToHex(so.token.nft.commitment) : '(none)'}`
              : 'PLAIN'}`).join('  ')}`);
      }
      const finalStack = (finalState.stack ?? []).map((item, itemIndex) => {
        const hex = binToHex(item);
        return `    [${itemIndex}] ${hex.length > 80 ? `${hex.slice(0, 80)}..(${item.length}B)` : hex}`;
      }).join('\n');
      const failedBuilderInput = builder.inputs[idx] as UnlockableUtxo & {
        unlocker?: {
          abiFunction?: { name?: string; inputs?: readonly { name: string }[] };
          contract?: { artifact?: { contractName?: string } };
          params?: unknown[];
        };
      };
      const failedAbiInputs = failedBuilderInput.unlocker?.abiFunction?.inputs ?? [];
      const sameOutpoint = (candidate: Utxo | undefined): boolean => candidate !== undefined
        && candidate.txid.toLowerCase() === failedBuilderInput.txid.toLowerCase()
        && candidate.vout === failedBuilderInput.vout;
      const failedOwners = [
        ...(sameOutpoint(host.masterUtxo) ? [{ kind: 'root', categoryId: host.categoryId }] : []),
        ...host.externalCallUtxoGroups.flatMap((group, groupIndex) => (
          sameOutpoint(group.masterUtxo) ? [{
            kind: 'externalCall', groupIndex,
            contract: group.externalContract?.inner?.artifact?.contractName,
            functionName: group.functionName,
            logicalFunctionName: group.logicalFunctionName,
            callMode: group.callMode,
            delegateCallGroupIndex: group.delegateCallGroupIndex,
            sharedGroupIndex: group.sharedGroupIndex,
          }] : []
        )),
        ...host.lowLevelCallUtxoGroups.flatMap((group, groupIndex) => (
          sameOutpoint(group.masterUtxo) ? [{
            kind: 'lowLevelCall', groupIndex,
            contract: group.externalContract?.inner?.artifact?.contractName,
            functionName: group.functionName,
            logicalFunctionName: group.logicalFunctionName,
            callMode: group.callMode,
          }] : []
        )),
      ];
      const identityWitnesses = failedAbiInputs.flatMap((input, inputIndex) => (
        /^__internal__(?:msgSenderCategory|externalCallInputBase|returnOutputIdx)$/.test(input.name)
        || /^__internal__(?:externalReturnOutputIdx\d*|extcallMasterIdx\d*|extcallAnchorIdx\d*)$/.test(input.name) ? [{
            name: input.name,
            value: String(failedBuilderInput.unlocker?.params?.[inputIndex]),
          }] : []
      ));
      const anchorInputs = host.externalIdentityAnchorUtxos.map((anchor, anchorIndex) => {
        const inputIndex = builder.inputs.findIndex((input) => input.txid.toLowerCase() === anchor.txid.toLowerCase()
          && input.vout === anchor.vout);
        const source = sourceOutputs[inputIndex];
        return {
          anchorIndex,
          inputIndex,
          lockingBytecode: source === undefined ? undefined : binToHex(source.lockingBytecode),
          category: source?.token?.category === undefined ? undefined : binToHex(source.token.category),
        };
      });
      console.error('covenant-failed-input-context', JSON.stringify({
        inputIndex: idx,
        contract: failedBuilderInput.unlocker?.contract?.artifact?.contractName,
        functionName: failedBuilderInput.unlocker?.abiFunction?.name,
        abiInputCount: failedAbiInputs.length,
        parameterCount: failedBuilderInput.unlocker?.params?.length,
        missingParameters: failedAbiInputs.flatMap((input, inputIndex) => (
          failedBuilderInput.unlocker?.params?.[inputIndex] === undefined ? [input.name] : []
        )),
        owners: failedOwners,
        identityWitnesses,
        identityAnchors: anchorInputs,
      }));
      // eslint-disable-next-line no-console
      const verboseBytecode = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_TRACE_BYTECODE === '1';
      const bytecodeDetails = verboseBytecode
        ? `\nunlocking=${binToHex(transaction.inputs[idx].unlockingBytecode)}`
          + `\nprobeUnlocking105=${binToHex(transaction.inputs[105]?.unlockingBytecode ?? new Uint8Array())}`
          + `\nprobeUnlocking106=${binToHex(transaction.inputs[106]?.unlockingBytecode ?? new Uint8Array())}`
        : '';
      const ringText = ring.map((step, stepIndex) => (
        `  ip=${step.ip} op=0x${step.opcode.toString(16).padStart(2, '0')}`
        + `${step.data === undefined ? '' : `(${step.data})`} body=${step.bodyLen} depth=${step.depth} top=[${step.top.join(' ')}]`
        + (stepIndex === ring.length - 1 ? '  <-- FAILS HERE' : '')
      )).join('\n');
      if (!verbose) {
        const lastMismatch = [...outputBytecodeMatches].reverse().find((entry) => !entry.matches);
        const failedSource = sourceOutputs[idx];
        const queriedOutput = lastMismatch === undefined ? undefined : transaction.outputs[lastMismatch.index];
        const failedLockHex = failedSource === undefined ? undefined : binToHex(failedSource.lockingBytecode);
        const failedCategoryHex = failedSource?.token?.category === undefined
          ? undefined : binToHex(failedSource.token.category);
        const peerIndices = <T extends {
          lockingBytecode: Uint8Array;
          token?: {
            category?: Uint8Array;
            nft?: { capability?: string; commitment?: Uint8Array };
          };
        }>(
            values: T[],
          ): { lock: number[]; category: Array<{
            index: number; lock: string; capability?: string; commitment?: string;
          }> } => ({
            lock: failedLockHex === undefined ? [] : values.flatMap((value, index) => (
              binToHex(value.lockingBytecode) === failedLockHex ? [index] : []
            )),
            category: failedCategoryHex === undefined ? [] : values.flatMap((value, index) => (
              value.token?.category !== undefined && binToHex(value.token.category) === failedCategoryHex
                ? [{
                  index,
                  lock: binToHex(value.lockingBytecode),
                  capability: value.token.nft?.capability,
                  commitment: value.token.nft?.commitment === undefined
                    ? undefined : binToHex(value.token.nft.commitment),
                }] : []
            )),
          });
        console.error(`[covenant VM trace] input ${idx}: ${finalState.error}\n${ringText}\n`
          + `lastLockMismatch=${JSON.stringify(lastMismatch ?? null)} `
          + `equalOk=${outputBytecodeMatches.filter((entry) => entry.matches).length}\n`
          + `failedSource=${JSON.stringify({
            lockingBytecode: failedSource === undefined ? undefined : binToHex(failedSource.lockingBytecode),
            category: failedSource?.token?.category === undefined
              ? undefined : binToHex(failedSource.token.category),
            capability: failedSource?.token?.nft?.capability,
            commitment: failedSource?.token?.nft?.commitment === undefined
              ? undefined : binToHex(failedSource.token.nft.commitment),
          })}\n`
          + `queriedOutput=${JSON.stringify({
            index: lastMismatch?.index,
            lockingBytecode: queriedOutput === undefined ? undefined : binToHex(queriedOutput.lockingBytecode),
            category: queriedOutput?.token?.category === undefined
              ? undefined : binToHex(queriedOutput.token.category),
            capability: queriedOutput?.token?.nft?.capability,
            commitment: queriedOutput?.token?.nft?.commitment === undefined
              ? undefined : binToHex(queriedOutput.token.nft.commitment),
          })}\n`
          + `failedPeers=${JSON.stringify({
            inputs: peerIndices(sourceOutputs), outputs: peerIndices(transaction.outputs),
          })}`);
      } else {
        console.error(`[covenant VM trace] input ${idx}: ${finalState.error}${bytecodeDetails}\ninvokedBodies=${JSON.stringify([...invokedBodies].map(([length, ids]) => [length, [...ids]]))}\noutputBytecodeMatches=${JSON.stringify(outputBytecodeMatches.filter((entry) => entry.matches))}\nhelper54=${helper54?.map((instruction) => instruction.data === undefined ? instruction.opcode.toString(16).padStart(2, '0') : `${instruction.opcode.toString(16).padStart(2, '0')}(${binToHex(instruction.data)})`).join(' ')}\n${ringText}\nfinal stack:\n${finalStack}\ninputs=\n${sourceOutputs.map((input, inputIndex) => (
          `  ${inputIndex}:${binToHex(input.lockingBytecode).slice(0, 80)}:${input.token?.nft?.capability ?? '-'}:`
          + `${binToHex(input.token?.category ?? new Uint8Array()).slice(0, 16)}:`
          + `${binToHex(input.token?.nft?.commitment ?? new Uint8Array()).slice(0, commitmentWidth)}`
        )).join('\n')}\noutputs=\n${transaction.outputs.map((output, outputIndex) => (
          `  ${outputIndex}:${binToHex(output.lockingBytecode).slice(0, 80)}:${output.token?.nft?.capability ?? '-'}:`
          + `${binToHex(output.token?.category ?? new Uint8Array()).slice(0, 16)}:`
          + `${binToHex(output.token?.nft?.commitment ?? new Uint8Array()).slice(0, commitmentWidth)}`
        )).join('\n')}`);
      }
      return;
    }
    return;
  }
  // X109 / X121: this path only PRINTS, so it decides nothing and is left bare deliberately. The gate above
  // is `> 10_000`, so a provider publishing limits AT 10,000 reaches this branch.
  //
  // At `@mem-cash/validation` 0.0.8 - the version this package declares - the published limits DO reach the
  // decider, so a bare VM here can trace a shape the decider judged differently. Being bare makes this
  // tracer stricter than a strict profile and looser than a relaxed one; for a diagnostic that only widens
  // or narrows what gets printed, which is why it is not worth the extra coupling. The deciding twin below
  // reads the provider. See `X109ProviderFaithfulVm.test.ts` and `X121StrictPreflightDecision.test.ts`.
  const vm = createVirtualMachineBch2026();
  for (const idx of candidates) {
    if (idx < 0 || idx >= transaction.inputs.length) continue;
    const states = vm.debug({ inputIndex: idx, sourceOutputs, transaction }) as unknown as Array<{
      ip: number; instructions?: Array<{ opcode: number }>; stack?: Uint8Array[]; error?: string;
    }>;
    const errAt = states.findIndex((s) => s.error);
    if (errAt < 0) continue;
    const lines = [`[covenant VM trace] input ${idx}: ${states[errAt].error}`];
    for (let i = Math.max(0, errAt - 12); i <= errAt; i += 1) {
      const s = states[i];
      const opcode = s.instructions?.[s.ip]?.opcode ?? 0;
      const top = (s.stack ?? []).slice(-2).map((b) => {
        const h = binToHex(b);
        return h.length > 20 ? `${h.slice(0, 20)}..` : (h || '(empty)');
      }).join(' ');
      const marker = i === errAt ? '  <-- FAILS HERE' : '';
      lines.push(`  ip=${s.ip} op=0x${opcode.toString(16).padStart(2, '0')} `
        + `depth=${(s.stack ?? []).length} top=[${top}]${marker}`);
    }
    // The failing body is often a tiny outlined helper, so the defect is at its CALL SITE, not in it. Walk
    // back to the enclosing frames (distinct instruction arrays) and show where each was executing.
    const seen: Array<{ ip: number; count: number }> = [];
    let prev = states[errAt].instructions;
    for (let i = errAt; i >= 0 && seen.length < 4; i -= 1) {
      if (states[i].instructions === prev) continue;
      prev = states[i].instructions;
      seen.push({ ip: states[i].ip, count: states[i].instructions?.length ?? 0 });
    }
    if (seen.length > 0) {
      lines.push(`  callers: ${seen.map((f) => `[count=${f.count} ip=${f.ip}]`).join(' <- ')}`);
      const caller = states.slice(0, errAt + 1).reverse()
        .find((st) => st.instructions !== states[errAt].instructions);
      if (caller) {
        const from = Math.max(0, caller.ip - 10);
        lines.push(`  callerOps: ${(caller.instructions ?? []).slice(from, caller.ip + 2)
          .map((instruction, offset) => `${from + offset}:`
            + `${(instruction as { opcode: number }).opcode.toString(16).padStart(2, '0')}`
            + `${'data' in instruction && instruction.data
              ? `<${binToHex(instruction.data as Uint8Array)}>` : ''}`).join(' ')}`);
      }
    }
    // eslint-disable-next-line no-console
    console.error(lines.join('\n'));
    return;
  }
}
