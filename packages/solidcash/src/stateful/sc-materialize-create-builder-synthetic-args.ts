/**
 * phase-boundary extract: SC _createBuilder extract — materialize B8/C1 synthetic args and
 * low-level call-input index witnesses into finalArgs.
 */

import { binToHex } from '@bitauth/libauth';
import type { AbiFunction } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import {
  defaultInternalFunctionArg,
  materializeInternalFunctionArgument,
} from './kernel-journal-helpers.js';

export type MaterializeCreateBuilderSyntheticArgsHost = {
  selectActiveRootDelegateGroup: () => number | undefined;
};

export type MaterializeCreateBuilderSyntheticArgsResult = {
  finalArgs: FunctionArgument[];
  activeDelegateGroupIndex: number | undefined;
  callInputIndexByName: Map<string, bigint>;
  delegateInputArgumentIndex: number;
};

/**
 * Append/overwrite compiler-owned trailing ABI witnesses (return emit index,
 * delegate input index, low-level call bases) onto `finalArgs`.
 */
export function materializeCreateBuilderSyntheticArgs(
  host: MaterializeCreateBuilderSyntheticArgsHost,
  params: {
    abiFunction: AbiFunction | undefined;
    finalArgs: FunctionArgument[];
    activeDelegateGroupIndex: number | undefined;
    lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
    lowLevelCallInputBase: number;
    overrides: { blockBase?: number; emitReturn?: boolean; returnProbeOnly?: boolean } | undefined;
    returnEmitOutputIndex: number;
    functionName: string;
    [key: string]: any;
  },
): MaterializeCreateBuilderSyntheticArgsResult {
  let {
    abiFunction, finalArgs, activeDelegateGroupIndex, lowLevelCallUtxoGroups,
    lowLevelCallInputBase, overrides, returnEmitOutputIndex, functionName,
  } = params;
  const selectActiveRootDelegateGroup = host.selectActiveRootDelegateGroup;
  const requiredNftIndices = params.requiredNftIndices as readonly number[];
  const externalReadUtxos = params.externalReadUtxos as readonly unknown[];
  const outStateInputCount = params.outStateInputCount as number;
  const iterationEntryInputs = params.iterationEntryInputs as readonly unknown[];

  // B8: a returning entry function takes a hidden __internal__returnOutputIdx. Default it to -1 (the
  // covenant computes the return value but does not emit it on-chain); opt-in emit sets a real index.
  if (abiFunction) {
    finalArgs = materializeInternalFunctionArgument(
      finalArgs, abiFunction.inputs, '__internal__returnOutputIdx', BigInt(returnEmitOutputIndex),
    );
  }

  // C1/piece-3: a pinned delegatecall proxy takes a hidden __internal__delegateInputIndex - the input index of
  // the co-spent delegate master, which the proxy pins (OP_UTXOBYTECODE[idx] == impl). Auto-fill it with the
  // delegatecall group's master position so a covenant-impl proxy needs no manual witness.
  activeDelegateGroupIndex ??= selectActiveRootDelegateGroup();
  const delegateInputArgumentIndex = abiFunction?.inputs.findIndex(
    (input) => input.name === '__internal__delegateInputIndex',
  ) ?? -1;
  if (abiFunction) {
    const dIdxPos = delegateInputArgumentIndex;
    if (dIdxPos >= 0 && finalArgs.length < abiFunction.inputs.length) {
      const delegateGroupIdx = activeDelegateGroupIndex
        ?? lowLevelCallUtxoGroups.findIndex((g) => g.callMode === 'delegatecall');
      const delegateAbsoluteBase = (overrides?.blockBase ?? 0) + lowLevelCallInputBase;
      const delegatePos = delegateGroupIdx < 0 ? delegateAbsoluteBase
        : delegateAbsoluteBase + lowLevelCallUtxoGroups
          .slice(0, delegateGroupIdx).reduce((s, g) => s + 1 + g.dataNftUtxos.length, 0);
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_FORWARD_ARGS === '1' && overrides?.emitReturn) {
        console.error('direct-delegate-input-witness', {
          functionName, delegatePos, lowLevelCallInputBase, delegateGroupIdx,
        });
      }
      finalArgs = [
        ...finalArgs.slice(0, dIdxPos),
        BigInt(delegatePos),
        ...finalArgs.slice(dIdxPos),
      ];
    }
  }

  // Map each low-level call witness to the absolute master input of its matching
  // non-delegatecall group. These compiler-added parameters are intentionally
  // absent from the public SDK arguments.
  const callInputIndexByName = new Map<string, bigint>();
  if (lowLevelCallUtxoGroups.length > 0) {
    let callOrdinal = 0;
    const nonDelegateCount = lowLevelCallUtxoGroups
      .filter((group) => group.callMode !== 'delegatecall').length;
    for (let i = 0; i < lowLevelCallUtxoGroups.length; i++) {
      if (lowLevelCallUtxoGroups[i].callMode === 'delegatecall') continue;
      const paramName = nonDelegateCount === 1
        ? '__internal__callInputIndex'
        : `__internal__callInputIndex${callOrdinal}`;
      callOrdinal += 1;
      const masterPos = (overrides?.blockBase ?? 0) + lowLevelCallInputBase
        + lowLevelCallUtxoGroups.slice(0, i)
          .reduce((sum, group) => sum + 1 + group.dataNftUtxos.length, 0);
      callInputIndexByName.set(paramName, BigInt(masterPos));
    }
  }

  // Filling a later named witness can extend the array across earlier internal slots, leaving sparse holes.
  // Fill those holes as well as the trailing suffix; an active path still has to satisfy its covenant.
  if (abiFunction) {
    for (let i = 0; i < abiFunction.inputs.length; i++) {
      if (finalArgs[i] !== undefined) continue;
      const input = abiFunction.inputs[i];
      if (!input.name.startsWith('__internal__')) {
        throw new Error(
          `Internal error: argument count mismatch for function '${functionName}'. `
          + `SDK produced ${finalArgs.length} args but ABI expects ${abiFunction.inputs.length} `
          + `(missing user arg '${input.name}'). This likely indicates a compiler/SDK version mismatch.`,
        );
      }
      finalArgs[i] = callInputIndexByName.get(input.name) ?? (overrides?.returnProbeOnly
          && input.name.startsWith('__internal__externalReturnOutputIdx')
          // A read-only probe materializes no child blocks, so a child's return-event coordinate has no real
          // value to expose. The -1 sentinel makes the probe's own covenant abort before it can reach the
          // callee's return band, which is the only thing the probe exists to read; a neutral in-range index
          // keeps the trace running. Probe builds are never broadcast, so the sentinel keeps its fail-closed
          // meaning for every real build.
          ? 0n
          : defaultInternalFunctionArg(input));
    }
  }

  // A return probe can intentionally continue without resolving the probed function's own external groups.
  // In that mode the group-assembly branch above does not run, but the ABI still contains its named internal
  // call-base and chunk-leading witnesses. Reconcile those positions after all provisional appends so an earlier
  // synthetic scalar cannot occupy a bytes slot and every later witness remains aligned.
  if (abiFunction) {
    const externalCallInputBasePosition = abiFunction.inputs.findIndex((input) =>
      input.name === '__internal__externalCallInputBase');
    if (externalCallInputBasePosition >= 0) {
      for (let position = 0; position < externalCallInputBasePosition; position++) {
        const input = abiFunction.inputs[position];
        if (!input.name.startsWith('__internal__leadingPushValue_')) continue;
        const value = finalArgs[position];
        if (!(value instanceof Uint8Array) && typeof value !== 'string') {
          finalArgs[position] = defaultInternalFunctionArg(input);
        }
      }
      finalArgs[externalCallInputBasePosition] = BigInt(
        1 + requiredNftIndices.length + externalReadUtxos.length + outStateInputCount
        + (abiFunction.graphBlockhashOracle?.slotCount ?? 0) + iterationEntryInputs.length,
      );
    }
  }

  // Earlier synthetic insertions can leave a placeholder in an already-present
  // slot, so overwrite all call witnesses after finalArgs is complete.
  if (abiFunction) {
    for (const [paramName, masterPos] of callInputIndexByName) {
      const position = abiFunction.inputs.findIndex((input) => input.name === paramName);
      if (position >= 0 && position < finalArgs.length) finalArgs[position] = masterPos;
    }
  }

  // Validate that the total argument count (user + synthetic) matches the ABI.
  // A mismatch here indicates the SDK's synthetic parameter injection is out of sync
  // with the compiler's parameter injection in SymbolTableTraversal.
  if (abiFunction && finalArgs.length !== abiFunction.inputs.length) {
    throw new Error(
      `Internal error: argument count mismatch for function '${functionName}'. `
      + `SDK produced ${finalArgs.length} args but ABI expects ${abiFunction.inputs.length}. `
      + 'This likely indicates a compiler/SDK version mismatch.',
    );
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_FORWARD_ARGS === '1' && overrides?.emitReturn && abiFunction) {
    console.error('direct-return-probe-args', { functionName, args: abiFunction.inputs.map((input, index) => {
      const value = finalArgs[index];
      return {
        name: input.name,
        type: input.type,
        value: value instanceof Uint8Array
          ? `${value.length}:${binToHex(value.slice(0, 96))}`
          : typeof value === 'bigint' ? value.toString() : String(value),
      };
    }) });
  }

  return { finalArgs, activeDelegateGroupIndex, callInputIndexByName, delegateInputArgumentIndex };
}
