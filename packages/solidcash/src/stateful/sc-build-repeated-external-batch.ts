/**
 * phase-boundary extract: SC extract — build a repeated external message-bus batch compiler route.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  type AbiFunction,
  type Artifact,
  type ExternalCallAbi,
  type StateValue,
} from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../Argument.js';
import {
  encodeMessageBusArguments,
  inactiveMessageBusRouteWitness,
} from '../message-bus/message-bus.js';
import { addressToLockScript } from '../utils.js';
import type { ValueChunkProducerPathDisposition } from './ValueChunkProducerIdentity.js';
import type { StatefulContract } from './StatefulContract.js';
import { mergePublishedMessageBusHandlerMetadata } from './sc-batch-raw.js';

export interface BuildRepeatedExternalBatchHost {
  readonly inner: { artifact: Artifact };
  readonly target: string;
  evaluateExternalExpression(...args: any[]): any;
  resolveExternalArgs(...args: any[]): FunctionArgument[] | undefined;
  concatBytes(...parts: Uint8Array[]): Uint8Array;
  uintLe(value: bigint, width: number): Uint8Array;
  signedLogicalValue(value: bigint): Uint8Array;
}

export type BuiltRepeatedExternalBatchRoute = {
  abiFunction: AbiFunction;
  selector: Uint8Array;
  blob: Uint8Array;
  args: FunctionArgument[];
  internalArgs?: Record<string, FunctionArgument>;
  logicalSelectors: string[];
  rowArguments: Array<{
    selector: string;
    args: FunctionArgument[];
    handler: AbiFunction;
    sourceCallsiteId?: number;
    sourceLogicalIndex: number;
    occurrenceIndex: number;
    sourceEffectOrdinal?: number;
    producerPath?: ValueChunkProducerPathDisposition;
  }>;
  eventSignaturesBySlot?: Array<string | undefined>;
};

export function buildRepeatedExternalBatch(
  host: BuildRepeatedExternalBatchHost,
  externalCall: ExternalCallAbi,
  functionArgs: FunctionArgument[],
  externalContract: StatefulContract,
  callerArtifact: Artifact = host.inner.artifact,
  callerState?: Record<string, StateValue>,
  calleeRouteArtifact: Artifact = externalContract.inner.artifact,
  callerInputs?: readonly { type: string }[],
  callerStateIncludesPriorWrites = false,
  callerSelfAddress?: FunctionArgument,
  externalReturns?: ReadonlyMap<string, FunctionArgument>,
  callerIdentity?: { categoryId: string; lockingBytecode: string },
  producerPathForRow?: (row: {
    sourceCallsiteId?: number;
    sourceLogicalIndex?: number;
    occurrenceIndex?: number;
    sourceEffectOrdinal?: number;
  }) => ValueChunkProducerPathDisposition,
): BuiltRepeatedExternalBatchRoute | undefined {
  const publishedRows = externalCall.batchInvocations;
  if (!publishedRows) return undefined;
  if (publishedRows.length < 2) {
    throw new Error('Repeated external message-bus batch must contain at least two source callsites');
  }

  const capability = calleeRouteArtifact.messageBus;
  if (!capability || capability.version !== 1 || capability.selector !== '53434231') {
    throw new Error(
      `${externalCall.interfaceName} does not advertise a compatible message-bus route`,
    );
  }
  const rewriteOccurrenceIndex = <T>(value: T, occurrenceIndex: number, seen = new Map<object, unknown>()): T => {
    if (!value || typeof value !== 'object') return value;
    if (seen.has(value as object)) return seen.get(value as object) as T;
    if (Array.isArray(value)) {
      const result: unknown[] = [];
      seen.set(value, result);
      value.forEach((item) => result.push(rewriteOccurrenceIndex(item, occurrenceIndex, seen)));
      return result as T;
    }
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    seen.set(value as object, result);
    for (const [key, child] of Object.entries(source)) {
      result[key] = rewriteOccurrenceIndex(child, occurrenceIndex, seen);
    }
    if (source.kind === 'arrayElement') {
      const step = typeof source.indexStepValue === 'number' ? source.indexStepValue : undefined;
      const initial = typeof source.indexValue === 'number' ? source.indexValue : 0;
      // Bind this reached occurrence into the element index. A published step selects
      // `indexValue + indexStepValue * occurrence`; without one the artifact predates the step and expands
      // the bare index in array order, where the ordinal IS the index.
      result.indexValue = step === undefined ? occurrenceIndex : initial + step * occurrenceIndex;
      // The step is already applied, so clear it: this row's resolution is given occurrence zero.
      result.indexStepValue = undefined;
    }
    return result as T;
  };
  const arrayParameterIndices = (value: unknown, indices = new Set<number>(), seen = new Set<object>()): Set<number> => {
    if (!value || typeof value !== 'object' || seen.has(value as object)) return indices;
    seen.add(value as object);
    const source = value as { kind?: string; paramIndex?: number };
    if (source.kind === 'arrayElement' && source.paramIndex !== undefined) indices.add(source.paramIndex);
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach((item) => arrayParameterIndices(item, indices, seen));
      else arrayParameterIndices(child, indices, seen);
    }
    return indices;
  };
  const rows: Array<(typeof publishedRows)[number] & {
    logicalIndex: number;
    sourceLogicalIndex: number;
    occurrenceIndex: number;
    sourceEffectOrdinal?: number;
    argSources?: (typeof publishedRows)[number]['argSources'];
  }> = [];
  for (const published of publishedRows) {
    let occurrences = 1;
    if (published.occurrence === 'loop') {
      const indices = [...arrayParameterIndices(published.argSources)];
      if (indices.length === 0) {
        throw new Error('Repeated external message-bus loop has no compiler-authored array cardinality');
      }
      const lengths = indices.map((index) => {
        const value = functionArgs[index];
        if (!Array.isArray(value)) {
          throw new Error(`Repeated external message-bus loop parameter ${index} is not an array`);
        }
        return value.length;
      });
      if (!lengths.every((length) => length === lengths[0])) {
        throw new Error('Repeated external message-bus loop arrays have different runtime lengths');
      }
      occurrences = lengths[0];
    }
    for (let occurrenceIndex = 0; occurrenceIndex < occurrences; occurrenceIndex++) {
      const condition = published.condition === undefined
        ? true
        : host.evaluateExternalExpression(
          rewriteOccurrenceIndex(published.condition, occurrenceIndex),
          functionArgs, callerArtifact, callerState, callerInputs, externalReturns,
          occurrenceIndex, callerStateIncludesPriorWrites, callerSelfAddress,
        );
      if (condition === false) continue;
      if (condition !== true) {
        throw new Error('Could not resolve a repeated external message-bus row predicate');
      }
      rows.push({
        ...published,
        logicalIndex: rows.length,
        sourceLogicalIndex: published.logicalIndex,
        occurrenceIndex,
        ...(published.argSources && {
          argSources: rewriteOccurrenceIndex(published.argSources, occurrenceIndex),
        }),
      });
    }
  }
  const minimumRows = capability.minimumRows ?? 1;
  if (rows.length < minimumRows || rows.length > capability.maximumRows) {
    throw new Error(
      `Repeated external message-bus batch has ${rows.length} runtime rows; callee requires `
      + `${minimumRows}..${capability.maximumRows}`,
    );
  }
  // This builder always describes an outgoing CALL edge. If the selected callee handler is an implementation
  // route, its internal DELEGATECALL preserves the sender established by that CALL; it does not jump back to the
  // transaction origin. Derive the bytecode from the same caller pair whose category is installed in the hidden
  // route frame, so mapping-key planning and runtime msg.sender cannot split across different identities.
  const routeMsgSender = callerIdentity === undefined
    ? callerSelfAddress ?? addressToLockScript(host.target)
    : hexToBin(callerIdentity.lockingBytecode);
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_MSG_SENDER_KEY === '1') {
    // The route binds the caller identity for its KEY witnesses here; the runtime comparison that refuses ip 51
    // reads `__internal__msgSenderCategory` instead, so print both halves to see whether the same identity is
    // published twice or only once.
    console.error('route-caller-identity', JSON.stringify({
      callee: calleeRouteArtifact.contractName,
      rows: (externalCall.batchInvocations ?? []).length,
      callerIdentity,
      callerLockingBytecode: String(routeMsgSender).slice(0, 34),
      declaresMsgSenderCategory: (calleeRouteArtifact.abi ?? []).some((fn) =>
        (fn.inputs ?? []).some((input) => input.name === '__internal__msgSenderCategory')),
    }));
  }

  const structs = calleeRouteArtifact.structs
    ?? externalContract.inner.stateLayout?.structs;
  const keyWitnessValues = new Map<string, {
    value: FunctionArgument;
    encoded: Uint8Array;
  }>();
  // X199. Intersect with eligibility: the compiler's logical value mode is computed over the FINAL
  // survivors, so a published-but-refused payable handler must not size the admitted route's rows.
  const valueMode = capability.handlers.some((handler) => handler.eligible && handler.usesMsgValue);
  const resolvedCallerInputs = callerInputs ?? callerArtifact.abi.find((fn) =>
    fn.externalCalls?.some((candidate) => candidate === externalCall))?.inputs;
  if (!resolvedCallerInputs) {
    throw new Error('Repeated external message-bus batch has no exact enclosing ABI identity');
  }
  const rowArguments: Array<{
    selector: string;
    args: FunctionArgument[];
    handler: AbiFunction;
    sourceCallsiteId?: number;
    sourceLogicalIndex: number;
    occurrenceIndex: number;
    sourceEffectOrdinal?: number;
    producerPath?: ValueChunkProducerPathDisposition;
  }> = [];
  const encodedRows = rows.map((row, rowIndex) => {
    if (row.logicalIndex !== rowIndex) {
      throw new Error('Repeated external message-bus batch rows must use canonical contiguous callsite indices');
    }
    const handler = capability.handlers.find((candidate) => candidate.selector === row.selector);
    if (!handler?.eligible) {
      throw new Error(
        `External message-bus batch selector ${row.selector} is not advertised as an eligible callee handler`,
      );
    }
    if (handler.inputs.length !== row.inputs.length
      || handler.inputs.some((input, index) => input.type !== row.inputs[index].type)) {
      throw new Error(`External message-bus batch selector ${row.selector} has incompatible caller/callee input types`);
    }
    const args = row.inputs.length === 0
      ? []
      : host.resolveExternalArgs(
        row.argSources, functionArgs, callerArtifact, callerState, resolvedCallerInputs,
        externalReturns, 0, callerStateIncludesPriorWrites, callerSelfAddress,
      );
    if (!args || args.length !== row.inputs.length) {
      throw new Error(`Could not resolve every argument for external message-bus batch row ${rowIndex}`);
    }
    const handlerAbi = calleeRouteArtifact.abi.find((fn) => (
      fn.selector?.toLowerCase() === row.selector.toLowerCase()
    ));
    if (!handlerAbi) throw new Error(`Message-bus handler ABI '${handler.name}' is missing`);
    rowArguments.push({
      selector: row.selector,
      args,
      handler: mergePublishedMessageBusHandlerMetadata(handlerAbi, capability.handlers),
      sourceCallsiteId: row.sourceCallsiteId,
      sourceLogicalIndex: row.sourceLogicalIndex,
      occurrenceIndex: row.occurrenceIndex,
      sourceEffectOrdinal: row.sourceEffectOrdinal,
      ...(producerPathForRow && { producerPath: producerPathForRow(row) }),
    });
    const encoded = args.map((arg, index) =>
      encodeFunctionArgument(arg, row.inputs[index].type, structs));
    if (encoded.some((arg) => !(arg instanceof Uint8Array))) {
      throw new Error('Signature-like arguments are not eligible for external message-bus batch batching');
    }
    for (const binding of handler.batchKeyWitnesses ?? []) {
      const routeInput = binding.perRow
        ? `${binding.routeInput}_r${rowIndex}` : binding.routeInput;
      const value = binding.source === 'msgSender' ? routeMsgSender : args[binding.inputIndex];
      const encodedValue = binding.source === 'msgSender'
        ? encodeFunctionArgument(value, 'address', structs) as Uint8Array
        : encoded[binding.inputIndex] as Uint8Array;
      const prior = keyWitnessValues.get(routeInput);
      if (prior && binToHex(prior.encoded) !== binToHex(encodedValue)) {
        throw new Error(`External message-bus batch collection witness '${routeInput}' is ambiguous`);
      }
      if (!prior) keyWitnessValues.set(routeInput, { value, encoded: encodedValue });
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
      console.error('row-encoded-args', {
        selector: row.selector,
        parts: encoded.map((part, index) => ({
          type: row.inputs[index].type,
          length: (part as Uint8Array).length,
          hex: binToHex(part as Uint8Array).slice(0, 120),
        })),
        rawValues: args.map((arg) => (Array.isArray(arg)
          ? arg.map((element) => (element instanceof Uint8Array
            ? `bytes(${element.length})` : String(element))) : String(arg))),
      });
    }
    const argsBlob = encodeMessageBusArguments(
      encoded as Uint8Array[],
      row.inputs.map((input) => input.type),
      structs,
    );
    if (argsBlob.length > 0xffff) throw new Error(`External message-bus batch row ${rowIndex} exceeds 65535 bytes`);
    let logicalValue = 0n;
    if (handler.usesMsgValue) {
      if ((handler.transfers?.length ?? 0) === 0) {
        throw new Error(
          `External message-bus batch msg.value for '${handler.name}' has no compiler-authored transfer`,
        );
      }
      for (const transfer of handler.transfers!) {
        const source = transfer.amount;
        let amount: bigint;
        if (source.kind === 'forward' && source.paramIndex !== undefined
          && typeof args[source.paramIndex] === 'bigint') {
          amount = args[source.paramIndex] as bigint;
        } else if (source.kind === 'literal' && source.value !== undefined) {
          amount = BigInt(source.value);
        } else {
          throw new Error(
            `External message-bus batch msg.value for '${handler.name}' has a non-derivable transfer amount`,
          );
        }
        logicalValue -= amount;
      }
    }
    return host.concatBytes(
      hexToBin(row.selector),
      host.uintLe(BigInt(row.logicalIndex), 4),
      host.uintLe(0n, 2),
      host.uintLe(BigInt(argsBlob.length), 2),
      ...(valueMode ? [host.signedLogicalValue(logicalValue)] : []),
      argsBlob,
    );
  });
  const blob = host.concatBytes(
    hexToBin('53434231'), Uint8Array.from([1, valueMode ? 1 : 0, rows.length]), ...encodedRows,
  );
  if (blob.length > capability.maximumBlobBytes) {
    throw new Error(
      `External message-bus batch blob is ${blob.length} bytes; maximum is ${capability.maximumBlobBytes}`,
    );
  }
  const routeWitnessInputs = capability.route.inputs
    .filter((input) => input.name !== 'batchBlob' && !input.name.startsWith('__internal__'));
  const routeWitnesses = routeWitnessInputs.map((input) => {
    const witness = keyWitnessValues.get(input.name);
    if (witness) return witness.value;
    // Resource routes have a fixed per-row parameter band. A selector that does not touch one collection
    // leaves that row's corresponding key unobserved by the covenant; keep the fixed ABI encodable without
    // inventing a binding for an inactive handler.
    return inactiveMessageBusRouteWitness(input.type);
  });
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_VMAP_PROOF === '1') {
    console.error('delegate-route-vmap-args', {
      contract: calleeRouteArtifact.contractName,
      inputs: routeWitnessInputs.map((input, index) => ({
        name: input.name,
        value: routeWitnesses[index] instanceof Uint8Array
          ? binToHex(routeWitnesses[index] as Uint8Array) : String(routeWitnesses[index]),
      })),
    });
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
    console.error('repeated-route-witnesses', {
      callerTarget: host.target,
      rows: rows.map((row) => ({ selector: row.selector, logicalIndex: row.logicalIndex })),
      witnesses: routeWitnessInputs.map((input, index) => ({
        name: input.name,
        value: routeWitnesses[index] instanceof Uint8Array
          ? binToHex(routeWitnesses[index] as Uint8Array) : String(routeWitnesses[index]),
      })),
    });
  }
  const eventSlots = capability.route.blockLayout?.slots.filter((slot) => slot.kind === 'event') ?? [];
  const eventWidth = eventSlots.length === 0 ? 0
    : Math.floor(eventSlots.length / capability.maximumRows);
  const eventSignaturesBySlot: Array<string | undefined> = Array(eventSlots.length);
  if (eventWidth > 0) {
    rows.forEach((row, rowIndex) => {
      const handler = capability.handlers.find((candidate) => candidate.selector === row.selector);
      for (const emitted of handler?.emits ?? []) {
        const physicalSlot = rowIndex * eventWidth + emitted.emitIndex;
        if (physicalSlot < eventSignaturesBySlot.length) {
          eventSignaturesBySlot[physicalSlot] = emitted.eventSignature;
        }
      }
    });
  }
  // Graph-enabled routes are first materialized by the ordinary builder while it discovers the complete call
  // tree. These values only keep that provisional unlocker ABI-aligned: admission cannot succeed without the
  // atomic manifest, and the composer replaces every field from its finalized graph before covenant preflight.
  // Keeping the placeholders on the compiler route also distinguishes its full graph ABI from a standalone
  // batch route without relying on any contract or handler name.
  const provisionalGraphContext: Record<string, FunctionArgument> = {};
  for (const input of capability.route.inputs) {
    if (['__internal__activeVerifierIndex', '__internal__participantBlockSize', '__internal__graphFixedSize',
      '__internal__graphBlockSize', '__internal__graphSelfIdentityInput',
      '__internal__graphSettlementBoundary', '__internal__blockhashInputIndex'].includes(input.name)) {
      provisionalGraphContext[input.name] = -1n;
    } else if (['__internal__graphEmissions', '__internal__graphCallers',
      '__internal__graphCompletionPositions', '__internal__graphSettlementTable'].includes(input.name)) {
      provisionalGraphContext[input.name] = new Uint8Array();
    }
  }
  return {
    abiFunction: capability.route,
    selector: hexToBin(capability.selector),
    blob,
    args: [blob, ...routeWitnesses],
    ...(Object.keys(provisionalGraphContext).length > 0 && {
      internalArgs: provisionalGraphContext,
    }),
    logicalSelectors: rows.map((row) => row.selector),
    rowArguments,
    ...(eventSignaturesBySlot.some((signature) => signature !== undefined)
      && { eventSignaturesBySlot }),
  };
}
