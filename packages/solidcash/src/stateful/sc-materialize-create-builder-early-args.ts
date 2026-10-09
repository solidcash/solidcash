/**
 * phase-boundary extract: SC _createBuilder extract — view-return / return-emit / msg.sender / blockhash early args.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  encodePushdataValue,
  type AbiFunction,
  type Artifact,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import { materializeInternalFunctionArgument } from './kernel-journal-helpers.js';

/** Minimal stateful call shape needed for delegated return-ABI discovery. */
export type CreateBuilderEarlyArgsStatefulCall = {
  type: 'stateful';
  contract: {
    inner: { artifact: Artifact };
  };
  functionName: string;
  args: FunctionArgument[];
  compilerRoute?: { abiFunction?: AbiFunction };
};

export type CreateBuilderEarlyArgsExternalCall = {
  functionName: string;
  externalContract: { categoryId: string };
};

export interface MaterializeCreateBuilderEarlyArgsHost {
  getExternalTargetEntriesByInterface(interfaceName: string): ReadonlyArray<{
    instance: {
      getState(): Promise<Record<string, unknown>>;
      inner: { artifact: Artifact };
    };
  }>;
}

export interface MaterializeCreateBuilderEarlyArgsOverrides {
  calls?: ReadonlyArray<CreateBuilderEarlyArgsStatefulCall | { type: string }>;
  externalCalls?: readonly CreateBuilderEarlyArgsExternalCall[];
  emitReturn?: boolean;
  omitLocalFeeTail?: boolean;
  returnProbeOnly?: boolean;
  blockBase?: number;
  msgSenderCategory?: Uint8Array;
  callerLockingBytecode?: Uint8Array;
}

export interface MaterializeCreateBuilderEarlyArgsResult {
  finalArgs: FunctionArgument[];
  returnEmitOutputIndex: number;
  returnMaterializationOutputIndex: number;
  returnAbiFunction: AbiFunction | undefined;
  returnEmitBlockOffset: number;
  resolvedMsgSenderCategory: Uint8Array | undefined;
}

/**
 * Append view-return witnesses, compute return-event output indexes, seed msg.sender category,
 * and push the blockhash-oracle input index — all before entry-NFT planning begins.
 */
export async function materializeCreateBuilderEarlyArgs(
  host: MaterializeCreateBuilderEarlyArgsHost,
  functionName: string,
  abiFunction: AbiFunction | undefined,
  finalArgs: FunctionArgument[],
  overrides?: MaterializeCreateBuilderEarlyArgsOverrides,
): Promise<MaterializeCreateBuilderEarlyArgsResult> {
  let nextFinalArgs = [...finalArgs];

  // Multi-use view+mutate loop (getReserves() + swap() on one pair): auto-fill each `__internal__viewReturn<n>`
  // witness from the co-spent pairs' state. The pairs are the loopTargets slot's registered instances; the SDK
  // reads each pair's n-th state field (convention: the view returns the pair's first-N state fields in order -
  // Router02 getReserves() -> reserve0/reserve1/blockTimestampLast). Caller-permissive: a wrong value feeds wrong
  // args into swap, whose co-spent covenant rejects, so a non-conventional view fails closed (a caller override
  // could refine it, not a soundness gate). Positioned right after the user args (viewReturn precedes the other
  // synthesized params in the ABI).
  const viewReturnParams = (abiFunction?.inputs ?? []).filter((i) => i.name.startsWith('__internal__viewReturn'));
  if (viewReturnParams.length > 0) {
    const loopSlot = abiFunction?.externalCalls?.find((ec) => ec.loopArrayVar?.startsWith('__internal__loopTargets'));
    const insts = (loopSlot ? host.getExternalTargetEntriesByInterface(loopSlot.interfaceName) : [])
      .map((e) => e.instance);
    const states = await Promise.all(insts.map((inst) => inst.getState()));
    for (let vn = 0; vn < viewReturnParams.length; vn++) {
      const vals = insts.map((inst, k) => {
        const vars = inst.inner.artifact.stateLayout?.variables ?? [];
        const fieldName = vars[vn]?.name;
        return fieldName !== undefined ? states[k][fieldName] : 0n;
      });
      nextFinalArgs = [...nextFinalArgs, encodePushdataValue(vals as never, viewReturnParams[vn].type)];
    }
  }

  // B8 return-value emit: -1 means "do not emit" (default). With .emitReturn(), point the covenant's
  // __internal__returnOutputIdx at the function's returnEvent output slot (a fixed block-layout offset).
  let returnEmitOutputIndex = -1;
  let returnMaterializationOutputIndex = -1;
  const delegatedReturnFunction = overrides?.calls
    ?.filter((call): call is CreateBuilderEarlyArgsStatefulCall => call.type === 'stateful')
    .map((call) => {
      if (call.compilerRoute?.abiFunction) return call.compilerRoute.abiFunction;
      const candidates = call.contract.inner.artifact.abi.filter((fn) => fn.name === call.functionName);
      return candidates.find((fn) => fn.inputs
        .filter((input) => !input.name.startsWith('__internal__')).length === call.args.length)
        ?? candidates[0];
    })
    .find((fn) => (fn?.outputs?.length ?? 0) > 0);
  const returnAbiFunction = (abiFunction?.outputs?.length ?? 0) > 0 ? abiFunction : delegatedReturnFunction;
  let returnEmitBlockOffset = -1;
  if (overrides?.emitReturn && (returnAbiFunction?.outputs?.length ?? 0) > 0) {
    const slot = returnAbiFunction?.blockLayout?.slots.find((s) => s.kind === 'returnEvent');
    if (!slot) {
      throw new Error(`Function '${functionName}' has no returnEvent output slot; cannot emit its return value.`);
    }
    returnEmitBlockOffset = slot.offset;
    returnEmitOutputIndex = (overrides?.blockBase ?? 0) + returnEmitBlockOffset;
    // Atomic composition builds each balanced participant in isolation before concatenating the blocks. Its
    // route witness is already bound to the final absolute output, while this temporary builder must place and
    // derive the return event at the participant-local offset. Keeping the coordinates distinct prevents a
    // later participant from padding its local block up to its final aggregate base.
    returnMaterializationOutputIndex = overrides?.omitLocalFeeTail
      ? returnEmitBlockOffset : returnEmitOutputIndex;
    // X12/X56. A delegated call's return event is verified by the IMPLEMENTATION (emitReturnEventCovenant-
    // Verification is gated `!functionHasDelegatecall`), which resolves EVERY output-only slot
    // implementation-relative - its event and its own returnEvent alike. When the implementation also emits,
    // this forwarder's returnEvent offset is therefore the wrong one: the event sits there. The delegate slot
    // reservation below (`delegateReturnEventOffset`) relocates it, once the co-spent implementation and its
    // block layout are known. Without an `emit` the two offsets coincide, which is why a plain returning
    // delegate settles on this offset alone.
  }

  // A `msg.sender`-KEYED MAPPING needs the witness too, even when the function never compares msg.sender as an
  // address: the compiler resolves the entry key from this category, so leaving it zero makes every
  // `msg.sender`-derived key comparison read a sentinel (measured: the `approve` probe refused its own entry row
  // at ip 115 with a 33-byte `ff…ff` against the caller's real category).
  const usesMsgSenderMappingKey = (abiFunction?.entryAccesses ?? []).some((access) =>
    (access.keySources ?? []).some((source) => source.kind === 'msgSender'));
  // Other hidden witnesses may precede the caller category in the ABI. Place it by name so an earlier batch
  // count keeps its declared scalar slot; the late builder pass reasserts this identity after other planning.
  let resolvedMsgSenderCategory: Uint8Array | undefined;
  if (abiFunction !== undefined && (abiFunction.usesMsgSender || usesMsgSenderMappingKey)
    && abiFunction.inputs.some((input) => input.name === '__internal__msgSenderCategory')) {
    let msgSenderCategory = overrides?.msgSenderCategory;
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_MSG_SENDER_KEY === '1') {
      // Name the build that seeds this witness and whether an override arrived; the failing probe publishes
      // zeros, so one of the `_deriveReturnValue`/`_createBuilder` entries is still unthreaded.
      console.error('msg-sender-category-seed', JSON.stringify({
        functionName,
        // `entryAbiFunction` is not yet initialized on this path (the delegate entry is resolved later), so the
        // frame's own ABI name is the only identity available here.
        abiFunction: abiFunction?.name,
        override: msgSenderCategory === undefined
          ? undefined : `${msgSenderCategory.length}:${binToHex(msgSenderCategory).slice(0, 24)}`,
        stack: new Error('seed').stack?.split('\n').slice(2, 8)
          .map((line) => line.trim().replace(/\s*\(.*/, '')),
      }));
    }
    const zeroFallback = !msgSenderCategory;
    if (!msgSenderCategory) {
      // An IFoo(msg.sender).m() call: msg.sender IS the co-spent callee, so derive its 32-byte category
      // (reversed = VM order) for the covenant's emitMsgSender - else it falls back to tx.origin and the
      // callee-identity check fails. The callee comes from withExternalCall()/connect-time externals.
      const msSlot = abiFunction.externalCalls?.find((ec) => ec.addressIsMsgSender);
      const info = msSlot && overrides?.externalCalls?.find((ec) => ec.functionName === msSlot.functionName);
      if (info) msgSenderCategory = hexToBin(info.externalContract.categoryId).reverse();
    }
    resolvedMsgSenderCategory = msgSenderCategory ?? new Uint8Array(32);
    nextFinalArgs = materializeInternalFunctionArgument(
      nextFinalArgs, abiFunction.inputs, '__internal__msgSenderCategory', resolvedMsgSenderCategory,
    );
    if (zeroFallback && (globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_MSG_SENDER_KEY === '1') {
      // Which build ends up publishing a ZERO caller category: that frame's `msg.sender` comparisons read a
      // sentinel, so this stack is the one that has to be threaded next.
      console.error('msg-sender-category-zero', JSON.stringify({
        functionName, abiFunction: abiFunction?.name,
        // Which build flavour reaches the zero fallback: a V8 stack is unavailable in these synthetic builders,
        // so the override SHAPE is what distinguishes the paths (probe vs composed participant vs user call).
        build: {
          returnProbeOnly: overrides?.returnProbeOnly === true,
          omitLocalFeeTail: overrides?.omitLocalFeeTail === true,
          emitReturn: overrides?.emitReturn === true,
          blockBase: overrides?.blockBase,
          externalCalls: overrides?.externalCalls?.length ?? 0,
          calls: overrides?.calls?.length ?? 0,
          callerLockingBytecode: overrides?.callerLockingBytecode !== undefined,
        },
      }));
    }
  }

  // __internal__blockhashInputIndex: the (n->hash) co-spend's absolute input index = master(0) + the slot
  // offset. Other hidden witnesses can precede it, so resolve its exact published ABI position.
  const bhSlot = abiFunction?.blockLayout?.slots.find((s) => s.kind === 'blockhashOracle');
  if (bhSlot && abiFunction?.inputs.some((input) => input.name === '__internal__blockhashInputIndex')) {
    nextFinalArgs = materializeInternalFunctionArgument(
      nextFinalArgs, abiFunction.inputs, '__internal__blockhashInputIndex',
      BigInt((overrides?.blockBase ?? 0) + bhSlot.offset),
    );
  }

  return {
    finalArgs: nextFinalArgs,
    returnEmitOutputIndex,
    returnMaterializationOutputIndex,
    returnAbiFunction,
    returnEmitBlockOffset,
    resolvedMsgSenderCategory,
  };
}
