import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  ArrayType, decodePushdataValue, parseType, type Artifact, type StateValue, scriptToBytecode,
} from '@solidcash/utils';
import { encodeFunctionArgument, isSignatureTemplateArray, type FunctionArgument } from '../Argument.js';
import SignatureTemplate from '../SignatureTemplate.js';
import { Layer3DiagnosticError } from './diagnostics.js';

export interface MessageBusInvocation {
  function: string;
  /** Authenticated graph call mode. Presence selects the SCB2 per-row mode framing. */
  callMode?: 'call' | 'staticcall';
  args?: readonly FunctionArgument[];
  /** Logical per-invocation satoshi delta when compiler-authored effects cannot derive it. */
  msgValue?: bigint;
  /** Graph-authenticated logical caller locking bytecode for msg.sender-keyed resources. */
  logicalCaller?: FunctionArgument;
}

export interface EncodedMessageBus {
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

export interface DecodedMessageBusResult {
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

const signedValue = (value: bigint): Uint8Array => {
  const magnitude = value < 0n ? -value : value;
  if (magnitude > 0x7fff_ffff_ffff_ffffn) {
    throw new Error('SCB1 logical msg.value exceeds the signed 64-bit satoshi envelope');
  }
  return concat(Uint8Array.of(value < 0n ? 1 : 0), uintLe(magnitude, 8));
};

/**
 * Canonically encode real compiler-generated SCB1 handlers without constructing a transaction.
 *
 * This is the common execution primitive for owner-local batching and the general participant-graph
 * planner: Layer 3 commits the returned `blob`, while the participant's compiler-owned SCB1 covenant
 * parses and executes the same bytes. No parallel application DSL or hand-authored selector table is
 * involved.
 */
export function encodeMessageBus(
  artifact: Artifact,
  invocations: readonly MessageBusInvocation[],
  /**
   * Values for route key witnesses no invocation binds. A mixed batch produces these by construction: a handler
   * with a single mapping access binds only the shared entry, so the other row's row-local slot stays unbound
   * even though the route still declares it and the covenant still requires it to address a real entry. The
   * caller names that entry; the SDK cannot derive it, because no row touches it.
   */
  unboundRouteWitnesses: Readonly<Record<string, FunctionArgument>> = {},
): EncodedMessageBus {
  const capability = artifact.messageBus;
  if (!capability) {
    throw new Error(
      `Artifact '${artifact.contractName}' does not advertise a message-bus route`,
    );
  }
  if (capability.version !== 1) {
    throw new Layer3DiagnosticError(
      'L3_PROTOCOL_VERSION_UNSUPPORTED',
      `artifact '${artifact.contractName}' advertises unsupported SCB version ${String(capability.version)}`,
      { metadataField: 'messageBus.version', actual: capability.version, expected: 1, ownerIdentity: artifact.contractName },
    );
  }
  if (capability.selector !== '53434231'
    || !Number.isInteger(capability.maximumRows) || capability.maximumRows < 1
    || !Number.isInteger(capability.maximumBlobBytes) || capability.maximumBlobBytes < 1) {
    throw new Layer3DiagnosticError(
      'L3_PROTOCOL_METADATA_MALFORMED',
      `artifact '${artifact.contractName}' publishes malformed SCB1 capability metadata`,
      {
        metadataField: 'messageBus',
        actual: {
          selector: capability.selector,
          maximumRows: capability.maximumRows,
          maximumBlobBytes: capability.maximumBlobBytes,
        },
        expected: { selector: '53434231', positiveIntegerBounds: true },
        ownerIdentity: artifact.contractName,
      },
    );
  }
  const minimumRows = capability.minimumRows ?? 1;
  if (invocations.length < minimumRows || invocations.length > capability.maximumRows) {
    throw new Error(
      `SCB1 batch row count must be between ${minimumRows} and ${capability.maximumRows}`,
    );
  }

  const structs = artifact.structs ?? artifact.stateLayout?.structs;
  // X199. Over the handlers the route can DISPATCH, not every published one. A REFUSED handler still publishes
  // `usesMsgValue` - `EnglishAuction.bid` is payable, uses msg.value and is refused by route synthesis - and
  // counting it wrote `01` into a header the compiled route demands to be `00`, aborting in the route preamble
  // before any row was parsed, and widened every row from 12 to 21 bytes on the way. The compiler decides the
  // same flag over the same predicate (`compiler.ts`, `logicalValueMode`).
  const valueMode = capability.handlers.some((handler) => handler.eligible && handler.usesMsgValue);
  const modeVersion = invocations.some((invocation) => invocation.callMode !== undefined);
  const keyWitnessValues = new Map<string, { value: FunctionArgument; encoded: Uint8Array }>();
  const signatureWitnessValues = new Map<string, FunctionArgument>();
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
    const handlerIndex = capability.handlers.indexOf(handler);
    const encoded = args.map((arg, index) =>
      encodeFunctionArgument(arg, handler.inputs[index].type, structs));
    const rowEncoded: Uint8Array[] = [];
    encoded.forEach((argument, index) => {
      if (argument instanceof Uint8Array) {
        rowEncoded.push(argument);
        return;
      }
      if (!((handler.inputs[index].type === 'sig' && argument instanceof SignatureTemplate)
        || (handler.inputs[index].type === 'sig[]' && isSignatureTemplateArray(argument)))) {
        throw new Error(`Handler '${handler.name}' contains an unsupported signature-like argument`);
      }
      signatureWitnessValues.set(`__scb_sig_${handlerIndex}_${index}_r${rowIndex}`, argument);
    });
    for (const binding of handler.batchKeyWitnesses ?? []) {
      const value = binding.source === 'msgSender'
        ? invocation.logicalCaller
        : args[binding.inputIndex];
      if (value === undefined) {
        throw new Layer3DiagnosticError(
          'L3_RESOURCE_UNRESOLVED',
          `SCB1 collection witness '${binding.routeInput}' requires an authenticated logical caller`,
          { handler: handler.name, resourceIdentity: binding.routeInput, keyIdentity: 'msg.sender', invocationIds: [rowIndex] },
        );
      }
      const encodedValue = binding.source === 'msgSender'
        ? encodeFunctionArgument(value, 'address', structs)
        : encoded[binding.inputIndex] as Uint8Array;
      if (!(encodedValue instanceof Uint8Array)) {
        throw new Layer3DiagnosticError(
          'L3_RESOURCE_UNRESOLVED',
          `SCB1 collection witness '${binding.routeInput}' is not byte-encodable`,
          { handler: handler.name, resourceIdentity: binding.routeInput, invocationIds: [rowIndex] },
        );
      }
      const routeInput = binding.perRow ? `${binding.routeInput}_r${rowIndex}` : binding.routeInput;
      const prior = keyWitnessValues.get(routeInput);
      if (prior && binToHex(prior.encoded) !== binToHex(encodedValue)) {
        throw new Layer3DiagnosticError(
          'L3_RESOURCE_UNRESOLVED',
          `SCB1 collection witness '${routeInput}' must identify one physical entry`,
          { handler: handler.name, resourceIdentity: routeInput, invocationIds: [rowIndex] },
        );
      }
      if (!prior) keyWitnessValues.set(routeInput, { value, encoded: encodedValue });
    }
    const argsBlob = concat(...rowEncoded.map((argument, index) => {
      const typeName = handler.inputs[index].type;
      const type = parseType(typeName);
      // Arrays and structs are already canonical composite blobs. Scalar
      // arguments are raw VM values and require one field push.
      const composite = type instanceof ArrayType
        || structs?.some((definition) => definition.name === typeName);
      return composite ? argument : scriptToBytecode([argument]);
    }));
    if (argsBlob.length > 0xffff) {
      throw new Error(`SCB1 arguments for '${handler.name}' exceed 65535 bytes`);
    }
    projectedRows.push({
      row: rowIndex,
      function: invocation.function,
      selectorHex: handler.selector,
      argsHex: binToHex(argsBlob),
    });
    let logicalValue = invocation.msgValue ?? 0n;
    if (handler.usesMsgValue && (handler.transfers?.length ?? 0) > 0) {
      let outgoing = 0n;
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
            `SCB1 msg.value for '${handler.name}' has a non-derivable transfer amount expression`,
          );
        }
        outgoing += amount;
      }
      const derived = -outgoing;
      if (invocation.msgValue !== undefined && invocation.msgValue !== derived) {
        throw new Error(`SCB1 msg.value for '${handler.name}' disagrees with compiler-derived effects`);
      }
      logicalValue = derived;
    } else if (handler.usesMsgValue && invocation.msgValue === undefined) {
      throw new Error(`SCB1 msg.value for '${handler.name}' requires an explicit logical value`);
    }
    return concat(
      hexToBin(handler.selector),
      uintLe(BigInt(rowIndex), 4),
      uintLe(0n, 2),
      uintLe(BigInt(argsBlob.length), 2),
      ...(modeVersion ? [Uint8Array.of(invocation.callMode === 'staticcall' ? 1 : 0)] : []),
      ...(valueMode ? [signedValue(logicalValue)] : []),
      argsBlob,
    );
  });

  const blob = concat(
    hexToBin('53434231'),
    Uint8Array.from([modeVersion ? 2 : 1, valueMode ? 1 : 0, invocations.length]),
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
      const signatureWitness = signatureWitnessValues.get(input.name);
      if (signatureWitness) return signatureWitness;
      // Signature slots are allocated for the route's full bounded row width.
      // Unreached rows are never executed, but their ABI positions must still
      // receive a valid template so transaction construction remains typed.
      if (/^__scb_sig_\d+_\d+_r\d+$/.test(input.name)) {
        const sameParameter = input.name.replace(/_r\d+$/, '');
        const fallback = [...signatureWitnessValues].find(([name]) =>
          name.replace(/_r\d+$/, '') === sameParameter)?.[1];
        if (fallback) return fallback;
      }
      const supplied = unboundRouteWitnesses[input.name];
      if (supplied === undefined) {
        throw new Layer3DiagnosticError(
          'L3_RESOURCE_UNRESOLVED',
          `Missing SCB1 route witness '${input.name}'; no invocation binds it, so it must be supplied`,
          { resourceIdentity: input.name, keyIdentity: input.name },
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
export function decodeMessageBusResults(
  artifact: Artifact,
  plan: EncodedMessageBus,
  commitment: Uint8Array,
): readonly DecodedMessageBusResult[] {
  const capability = artifact.messageBus;
  if (!capability) throw new Error('This artifact does not advertise a message-bus route');
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
