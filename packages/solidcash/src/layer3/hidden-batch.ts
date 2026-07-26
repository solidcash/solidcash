import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  decodePushdataValue, type Artifact, type StateValue, scriptToBytecode,
} from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../Argument.js';

export interface HiddenBatchInvocation {
  function: string;
  args?: readonly FunctionArgument[];
  /** Graph-authenticated logical caller locking bytecode for msg.sender-keyed resources. */
  logicalCaller?: FunctionArgument;
}

export interface EncodedHiddenBatch {
  /** Exact SCB1 blob consumed by the compiler-owned route. */
  blob: Uint8Array;
  /** Non-internal route arguments following `batchBlob`, in artifact order. */
  routeWitnesses: readonly FunctionArgument[];
  /** Number of logical handler invocations encoded in `blob`. */
  rowCount: number;
  /**
   * ABI result schema in row order. The compiler-owned SCB1 route computes these values and commits its
   * canonical aggregate return blob to the return-event NFT; a graph consumer must authenticate that output
   * before decoding it.
   */
  results: readonly { row: number; types: readonly string[] }[];
  /** Canonical row projection used by the graph transcript. */
  rows: readonly {
    row: number;
    function: string;
    selectorHex: string;
    /** Exact pushdata-encoded ABI argument vector parsed by SCB1. */
    argsHex: string;
  }[];
}

export interface DecodedHiddenBatchResult {
  row: number;
  type: string;
  value: StateValue;
}

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
};

const uintLe = (value: bigint, width: number): Uint8Array => {
  if (value < 0n || value >= (1n << BigInt(width * 8))) {
    throw new Error(`Unsigned ${width}-byte overflow`);
  }
  const result = new Uint8Array(width);
  let rest = value;
  for (let i = 0; i < width; i += 1) {
    result[i] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  return result;
};

/**
 * Canonically encode real compiler-generated SCB1 handlers without constructing a transaction.
 *
 * This is the common execution primitive for owner-local batching and the general participant-graph
 * planner: Layer 3 commits the returned `blob`, while the participant's compiler-owned SCB1 covenant
 * parses and executes the same bytes. No parallel application DSL or hand-authored selector table is
 * involved.
 */
export function encodeHiddenBatch(
  artifact: Artifact,
  invocations: readonly HiddenBatchInvocation[],
  /**
   * Values for route key witnesses no invocation binds. A mixed batch produces these by construction: a handler
   * with a single mapping access binds only the shared entry, so the other row's row-local slot stays unbound
   * even though the route still declares it and the covenant still requires it to address a real entry. The
   * caller names that entry; the SDK cannot derive it, because no row touches it.
   */
  unboundRouteWitnesses: Readonly<Record<string, FunctionArgument>> = {},
): EncodedHiddenBatch {
  const capability = artifact.hiddenBatch;
  if (!capability) throw new Error('This artifact does not advertise the compiler-hidden SCB1 batch route');
  const minimumRows = capability.minimumRows ?? 1;
  if (invocations.length < minimumRows || invocations.length > capability.maximumRows) {
    throw new Error(
      `SCB1 batch row count must be between ${minimumRows} and ${capability.maximumRows}`,
    );
  }

  const structs = artifact.structs ?? artifact.stateLayout?.structs;
  const keyWitnessValues = new Map<string, { value: FunctionArgument; encoded: Uint8Array }>();
  const results: { row: number; types: readonly string[] }[] = [];
  const projectedRows: {
    row: number; function: string; selectorHex: string; argsHex: string;
  }[] = [];
  const rows = invocations.map((invocation, rowIndex) => {
    const handler = capability.handlers.find((candidate) => candidate.name === invocation.function);
    if (!handler) throw new Error(`Unknown SCB1 handler '${invocation.function}'`);
    if (!handler.eligible) {
      throw new Error(`Handler '${invocation.function}' is not batch eligible: ${handler.rejectionReason}`);
    }
    if ((handler.outputs?.length ?? 0) > 0) {
      results.push({ row: rowIndex, types: Object.freeze(handler.outputs!.map((output) => output.type)) });
    }
    const args = [...(invocation.args ?? [])];
    if (args.length !== handler.inputs.length) {
      throw new Error(
        `Incorrect number of arguments for batched '${handler.name}': expected ${handler.inputs.length}, got ${args.length}`,
      );
    }
    const encoded = args.map((arg, index) =>
      encodeFunctionArgument(arg, handler.inputs[index].type, structs));
    if (encoded.some((argument) => !(argument instanceof Uint8Array))) {
      throw new Error(`Handler '${handler.name}' contains a signature-like argument and cannot use SCB1`);
    }
    for (const binding of handler.batchKeyWitnesses ?? []) {
      const value = binding.source === 'msgSender'
        ? invocation.logicalCaller
        : args[binding.inputIndex];
      if (value === undefined) {
        throw new Error(
          `SCB1 collection witness '${binding.routeInput}' requires an authenticated logical caller`,
        );
      }
      const encodedValue = binding.source === 'msgSender'
        ? encodeFunctionArgument(value, 'address', structs)
        : encoded[binding.inputIndex] as Uint8Array;
      if (!(encodedValue instanceof Uint8Array)) {
        throw new Error(`SCB1 collection witness '${binding.routeInput}' is not byte-encodable`);
      }
      const routeInput = binding.perRow ? `${binding.routeInput}_r${rowIndex}` : binding.routeInput;
      const prior = keyWitnessValues.get(routeInput);
      if (prior && binToHex(prior.encoded) !== binToHex(encodedValue)) {
        throw new Error(`SCB1 collection witness '${routeInput}' must identify one physical entry`);
      }
      if (!prior) keyWitnessValues.set(routeInput, { value, encoded: encodedValue });
    }
    const argsBlob = scriptToBytecode(encoded as Uint8Array[]);
    if (argsBlob.length > 0xffff) {
      throw new Error(`SCB1 arguments for '${handler.name}' exceed 65535 bytes`);
    }
    projectedRows.push({
      row: rowIndex,
      function: invocation.function,
      selectorHex: handler.selector,
      argsHex: binToHex(argsBlob),
    });
    return concat(
      hexToBin(handler.selector),
      uintLe(BigInt(rowIndex), 4),
      uintLe(0n, 2),
      uintLe(BigInt(argsBlob.length), 2),
      argsBlob,
    );
  });

  const blob = concat(
    hexToBin('53434231'),
    Uint8Array.from([1, 0, invocations.length]),
    ...rows,
  );
  if (blob.length > capability.maximumBlobBytes) {
    throw new Error(`SCB1 blob is ${blob.length} bytes; maximum is ${capability.maximumBlobBytes}`);
  }

  const routeWitnesses = capability.route.inputs
    .filter((input) => input.name !== 'batchBlob' && !input.name.startsWith('__internal__'))
    .map((input) => {
      const witness = keyWitnessValues.get(input.name);
      if (witness) return witness.value;
      const supplied = unboundRouteWitnesses[input.name];
      if (supplied === undefined) {
        throw new Error(
          `Missing SCB1 route witness '${input.name}'; no invocation binds it, so it must be supplied`,
        );
      }
      return supplied;
    });

  return {
    blob,
    routeWitnesses: Object.freeze(routeWitnesses),
    rowCount: invocations.length,
    results: Object.freeze(results),
    rows: Object.freeze(projectedRows.map((row) => Object.freeze(row))),
  };
}

/**
 * Decode and completely consume the aggregate return-event commitment produced by a returning SCB1 route.
 *
 * The compiler route concatenates the canonical ABI fields returned by each reached returning row. The plan
 * supplies the exact ordered type vector, so decoding is deterministic even when rows return different types
 * or tuples. Complete consumption rejects both omitted fields and attacker-controlled suffixes.
 */
export function decodeHiddenBatchResults(
  artifact: Artifact,
  plan: EncodedHiddenBatch,
  commitment: Uint8Array,
): readonly DecodedHiddenBatchResult[] {
  const capability = artifact.hiddenBatch;
  if (!capability) throw new Error('This artifact does not advertise the compiler-hidden SCB1 batch route');
  if (plan.results.length === 0) {
    if (commitment.length !== 0) throw new Error('Non-returning SCB1 plan has an unexpected result commitment');
    return [];
  }
  // `__scb1` returns one `bytes`, so the ordinary return-event ABI wraps the route's packed per-row result
  // vector in one outer bytes push. Authenticate/consume that outer field before interpreting the inner vector.
  const outer = decodePushdataValue(commitment, 0, 'bytes');
  if (outer.bytesConsumed !== commitment.length || !(outer.value instanceof Uint8Array)) {
    throw new Error('SCB1 result commitment is not one canonical bytes field');
  }
  const packed = outer.value;
  const structs = artifact.structs ?? artifact.stateLayout?.structs;
  let offset = 0;
  const decodedRows = plan.results.map((result) => {
    const values: StateValue[] = [];
    for (const type of result.types) {
      if (offset >= packed.length) throw new Error('SCB1 result commitment ended before every result field');
      const decoded = decodePushdataValue(packed, offset, type, structs);
      values.push(decoded.value);
      offset += decoded.bytesConsumed;
    }
    return Object.freeze({
      row: result.row,
      type: result.types.length === 1 ? result.types[0] : `(${result.types.join(',')})`,
      value: result.types.length === 1 ? values[0] : values,
    });
  });
  if (offset !== packed.length) {
    throw new Error('SCB1 result commitment contains an unchecked suffix');
  }
  return Object.freeze(decodedRows);
}
