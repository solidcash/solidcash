import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import {
  ArrayType, ATOMIC_MESSAGE_BUS_MAX_ROWS, decodePushdataValue, MAX_MESSAGE_BUS_BLOB_BYTES,
  parseArrayTypeString, parseType, type Artifact, type StateValue, scriptToBytecode,
  type StructDefinitionInfo,
} from '@solidcash/utils';
import {
  encodeFunctionArgument, isSignatureTemplateArray, type ConstructorArgument, type FunctionArgument,
} from '../Argument.js';
import SignatureTemplate from '../SignatureTemplate.js';
import { MessageBusDiagnosticError } from './diagnostics.js';

export interface MessageBatchCall {
  function: string;
  /** Authenticated graph call mode. Presence selects the message-bus v2 per-row mode framing. */
  callMode?: 'call' | 'staticcall';
  args?: readonly FunctionArgument[];
  /** Logical per-invocation satoshi delta when compiler-authored effects cannot derive it. */
  msgValue?: bigint;
  /** Graph-authenticated caller identity bytecode for msg.sender-keyed resources. */
  logicalCaller?: FunctionArgument;
}

export interface EncodedMessageBatch {
  /** Exact message-bus batch blob consumed by the compiler-owned route. */
  blob: Uint8Array;
  /** Non-internal route arguments following `batchBlob`, in artifact order. */
  routeWitnesses: readonly FunctionArgument[];
  /** Number of logical handler invocations encoded in `blob`. */
  rowCount: number;
  /**
   * ABI result schema in row order. The compiler-owned message-bus batch route computes these values and commits its
   * canonical aggregate return blob to the return-event NFT; a graph consumer must authenticate that output
   * before decoding it.
   */
  results: readonly { row: number; types: readonly string[] }[];
  /** Canonical row projection used by the graph callManifest. */
  rows: readonly {
    row: number;
    function: string;
    selectorHex: string;
    /** Exact pushdata-encoded ABI argument vector parsed by message-bus batch. */
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

/**
 * Encode a message-bus row's canonical argument vector.
 *
 * Scalars need a pushdata field frame. Structs and arrays already are self-delimiting canonical blobs, so an
 * additional outer frame would make the wire format depend on which SDK path assembled the row and would be
 * ambiguous with a composite's first field.
 */
export function encodeMessageBusArguments(
  encoded: readonly Uint8Array[],
  inputTypes: readonly string[],
  structs?: readonly StructDefinitionInfo[],
): Uint8Array {
  if (encoded.length !== inputTypes.length) {
    throw new Error(`Message-bus argument vector has ${encoded.length} values for ${inputTypes.length} types`);
  }
  return concat(...encoded.map((argument, index) => {
    const typeName = inputTypes[index];
    const type = parseType(typeName);
    const composite = type instanceof ArrayType
      || structs?.some((definition) => definition.name === typeName);
    return composite ? argument : scriptToBytecode([argument]);
  }));
}

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
    throw new Error('message-bus batch logical msg.value exceeds the signed 64-bit satoshi envelope');
  }
  return concat(Uint8Array.of(value < 0n ? 1 : 0), uintLe(magnitude, 8));
};

/** ABI-valid default for an inactive position in a bounded message-bus route. */
export function inactiveMessageBusRouteWitness(type: string): FunctionArgument {
  const array = parseArrayTypeString(type);
  if (array) {
    if (array.bound === undefined) return [];
    return Array.from(
      { length: array.bound },
      () => inactiveMessageBusRouteWitness(array.elementType) as ConstructorArgument,
    );
  }
  if (type === 'bool') return false;
  if (type === 'string') return '';
  if (type === 'address' || type === 'address payable') {
    return encodeLockingBytecodeP2pkh(new Uint8Array(20));
  }
  if (type === 'byte') return new Uint8Array(1);
  const fixedBytes = type.match(/^bytes(\d+)$/);
  if (fixedBytes) return new Uint8Array(Number(fixedBytes[1]));
  if (type === 'bytes' || type === 'sig' || type === 'datasig') return new Uint8Array();
  if (type === 'pubkey') return new Uint8Array(33);
  return 0n;
}

/**
 * Canonically encode real compiler-generated message-bus batch handlers without constructing a transaction.
 *
 * This is the common execution primitive for owner-local batching and the general participant-graph
 * planner: message bus commits the returned `blob`, while the participant's compiler-owned message-bus batch covenant
 * parses and executes the same bytes. No parallel application DSL or hand-authored selector table is
 * involved.
 */
export function encodeMessageBatch(
  artifact: Artifact,
  invocations: readonly MessageBatchCall[],
  /**
   * Optional values for route key witnesses no invocation binds. Inactive fixed-row bands otherwise receive a
   * type-correct neutral value; callers only need this override when another compiler-owned route resource gives
   * an unselected position an explicit identity.
   */
  unboundRouteWitnesses: Readonly<Record<string, FunctionArgument>> = {},
): EncodedMessageBatch {
  const capability = artifact.messageBus;
  if (!capability) {
    throw new Error(
      `Artifact '${artifact.contractName}' does not advertise a message-bus route`,
    );
  }
  if ('version' in capability || capability.selector !== '53434231'
    || !Number.isSafeInteger(capability.maximumRows) || capability.maximumRows < 1
    || capability.maximumRows > ATOMIC_MESSAGE_BUS_MAX_ROWS
    || (capability.minimumRows !== undefined
      && (!Number.isSafeInteger(capability.minimumRows) || capability.minimumRows < 1
        || capability.minimumRows > capability.maximumRows))
    || capability.maximumBlobBytes !== MAX_MESSAGE_BUS_BLOB_BYTES) {
    throw new MessageBusDiagnosticError(
      'L3_PROTOCOL_METADATA_MALFORMED',
      `artifact '${artifact.contractName}' publishes malformed message-bus batch capability metadata`,
      {
        metadataField: 'messageBus',
        actual: {
          ...(('version' in capability) && { legacyVersion: (capability as { version?: unknown }).version }),
          selector: capability.selector,
          minimumRows: capability.minimumRows,
          maximumRows: capability.maximumRows,
          maximumBlobBytes: capability.maximumBlobBytes,
        },
        expected: {
          selector: '53434231', minimumRows: '[1, maximumRows] or absent',
          maximumRows: `[1, ${ATOMIC_MESSAGE_BUS_MAX_ROWS}]`,
          maximumBlobBytes: MAX_MESSAGE_BUS_BLOB_BYTES,
        },
        ownerIdentity: artifact.contractName,
      },
    );
  }
  const minimumRows = capability.minimumRows ?? 1;
  if (invocations.length < minimumRows || invocations.length > capability.maximumRows) {
    throw new Error(
      `message-bus batch batch row count must be between ${minimumRows} and ${capability.maximumRows}`,
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
  const swappableGlobals = new Map<string, { value: FunctionArgument; encoded: Uint8Array; rowBase: string }>();
  // A resource route has one shared entry and one row-local alternative. The compiler can advertise the two as
  // swappable, allowing the batch to choose the value common to every relevant row rather than assuming the
  // source handler's first mapping access is globally shared.
  const swappableBases = new Set(capability.handlers.flatMap((handler) =>
    (handler.batchKeyWitnesses ?? []).filter((binding) => binding.swappable && !binding.perRow)
      .map((binding) => binding.routeInput)));
  for (const base of swappableBases) {
    const choices: Array<Array<{ value: FunctionArgument; encoded: Uint8Array }>> = [];
    let rowBase = `${base}_row`;
    for (const invocation of invocations) {
      const handler = capability.handlers.find((candidate) => candidate.name === invocation.function);
      if (!handler) continue;
      const bindings = handler.batchKeyWitnesses ?? [];
      const shared = bindings.find((binding) => binding.routeInput === base);
      const varying = bindings.find((binding) => binding.swappable && binding.perRow
        && binding.routeInput === `${base}_row`);
      const invocationArgs = invocation.args ?? [];
      const relevant = varying ? [shared, varying] : [shared];
      const rowChoices = relevant.flatMap((binding) => {
        if (!binding || binding.source === 'msgSender' || binding.source === 'expression'
          || binding.inputIndex < 0) return [];
        const value = invocationArgs[binding.inputIndex];
        const type = handler.inputs[binding.inputIndex]?.type;
        if (value === undefined || !type) return [];
        const encoded = encodeFunctionArgument(value, type, structs);
        return encoded instanceof Uint8Array ? [{ value, encoded }] : [];
      });
      if (rowChoices.length > 0) choices.push(rowChoices);
      if (varying) rowBase = varying.routeInput;
    }
    const suppliedValue = unboundRouteWitnesses[base];
    const suppliedType = capability.route.inputs.find((input) => input.name === base)?.type;
    const suppliedEncoded = suppliedValue === undefined || !suppliedType
      ? undefined : encodeFunctionArgument(suppliedValue, suppliedType, structs);
    const suppliedCandidate = suppliedEncoded instanceof Uint8Array
      ? { value: suppliedValue!, encoded: suppliedEncoded } : undefined;
    const suppliedFits = suppliedCandidate && (choices.length === 0 || choices.every((row) => row.some((choice) =>
      binToHex(choice.encoded) === binToHex(suppliedCandidate.encoded))));
    const selected = suppliedFits ? suppliedCandidate : choices[0]?.find((candidate) =>
      choices.every((row) => row.some((choice) =>
        binToHex(choice.encoded) === binToHex(candidate.encoded))));
    if (!selected) {
      throw new MessageBusDiagnosticError(
        'L3_RESOURCE_UNRESOLVED',
        `message-bus batch collection witness '${base}' has no shared physical entry orientation`,
        { resourceIdentity: base },
      );
    }
    swappableGlobals.set(base, { ...selected, rowBase });
  }
  const signatureWitnessValues = new Map<string, FunctionArgument>();
  const results: { row: number; types: readonly string[] }[] = [];
  const projectedRows: {
    row: number; function: string; selectorHex: string; argsHex: string;
  }[] = [];
  const rows = invocations.map((invocation, rowIndex) => {
    const handler = capability.handlers.find((candidate) => candidate.name === invocation.function);
    if (!handler) throw new Error(`Unknown message-bus batch handler '${invocation.function}'`);
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
      signatureWitnessValues.set(`__message_bus_sig_${handlerIndex}_${index}_r${rowIndex}`, argument);
    });
    for (const binding of handler.batchKeyWitnesses ?? []) {
      if (binding.swappable) {
        if (binding.perRow) continue;
        const global = swappableGlobals.get(binding.routeInput);
        const varying = handler.batchKeyWitnesses?.find((candidate) => candidate.swappable
          && candidate.perRow && candidate.routeInput === `${binding.routeInput}_row`);
        if (!global || !varying || binding.inputIndex < 0 || varying.inputIndex < 0) {
          throw new MessageBusDiagnosticError(
            'L3_RESOURCE_UNRESOLVED',
            `message-bus batch collection witness '${binding.routeInput}' lacks a swappable key pair`,
            { handler: handler.name, resourceIdentity: binding.routeInput, invocationIds: [rowIndex] },
          );
        }
        const sharedValue = args[binding.inputIndex];
        const varyingValue = args[varying.inputIndex];
        const sharedEncoded = encoded[binding.inputIndex];
        const varyingEncoded = encoded[varying.inputIndex];
        if (!(sharedEncoded instanceof Uint8Array) || !(varyingEncoded instanceof Uint8Array)) {
          throw new MessageBusDiagnosticError(
            'L3_RESOURCE_UNRESOLVED', 'message-bus swappable collection keys are not byte-encodable',
            { handler: handler.name, resourceIdentity: binding.routeInput, invocationIds: [rowIndex] },
          );
        }
        const sharedMatches = binToHex(sharedEncoded) === binToHex(global.encoded);
        const varyingMatches = binToHex(varyingEncoded) === binToHex(global.encoded);
        if (!sharedMatches && !varyingMatches) {
          throw new MessageBusDiagnosticError(
            'L3_RESOURCE_UNRESOLVED',
            `message-bus batch collection witness '${binding.routeInput}' does not match either row key`,
            { handler: handler.name, resourceIdentity: binding.routeInput, invocationIds: [rowIndex] },
          );
        }
        keyWitnessValues.set(binding.routeInput, { value: global.value, encoded: global.encoded });
        keyWitnessValues.set(`${varying.routeInput}_r${rowIndex}`, sharedMatches
          ? { value: varyingValue, encoded: varyingEncoded }
          : { value: sharedValue, encoded: sharedEncoded });
        continue;
      }
      const value = binding.source === 'msgSender'
        ? invocation.logicalCaller
        : binding.source === 'expression'
          ? unboundRouteWitnesses[binding.perRow ? `${binding.routeInput}_r${rowIndex}` : binding.routeInput]
          : args[binding.inputIndex];
      if (value === undefined) {
        throw new MessageBusDiagnosticError(
          'L3_RESOURCE_UNRESOLVED',
          `message-bus batch collection witness '${binding.routeInput}' requires an authenticated active caller`,
          { handler: handler.name, resourceIdentity: binding.routeInput, keyIdentity: 'msg.sender', invocationIds: [rowIndex] },
        );
      }
      const routeInputName = binding.perRow ? `${binding.routeInput}_r${rowIndex}` : binding.routeInput;
      const routeInputType = capability.route.inputs.find((input) => input.name === routeInputName)?.type;
      const encodedValue = binding.source === 'msgSender'
        ? encodeFunctionArgument(value, 'address', structs)
        : binding.source === 'expression'
          ? encodeFunctionArgument(value, routeInputType ?? 'bytes', structs)
          : encoded[binding.inputIndex] as Uint8Array;
      if (!(encodedValue instanceof Uint8Array)) {
        throw new MessageBusDiagnosticError(
          'L3_RESOURCE_UNRESOLVED',
          `message-bus batch collection witness '${binding.routeInput}' is not byte-encodable`,
          { handler: handler.name, resourceIdentity: binding.routeInput, invocationIds: [rowIndex] },
        );
      }
      const routeInput = routeInputName;
      const prior = keyWitnessValues.get(routeInput);
      if (prior && binToHex(prior.encoded) !== binToHex(encodedValue)) {
        throw new MessageBusDiagnosticError(
          'L3_RESOURCE_UNRESOLVED',
          `message-bus batch collection witness '${routeInput}' must identify one physical entry`,
          { handler: handler.name, resourceIdentity: routeInput, invocationIds: [rowIndex] },
        );
      }
      if (!prior) keyWitnessValues.set(routeInput, { value, encoded: encodedValue });
    }
    const argsBlob = encodeMessageBusArguments(
      rowEncoded,
      handler.inputs.map((input) => input.type),
      structs,
    );
    if (argsBlob.length > 0xffff) {
      throw new Error(`message-bus batch arguments for '${handler.name}' exceed 65535 bytes`);
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
            `message-bus batch msg.value for '${handler.name}' has a non-derivable transfer amount expression`,
          );
        }
        outgoing += amount;
      }
      const derived = -outgoing;
      if (invocation.msgValue !== undefined && invocation.msgValue !== derived) {
        throw new Error(`message-bus batch msg.value for '${handler.name}' disagrees with compiler-derived effects`);
      }
      logicalValue = derived;
    } else if (handler.usesMsgValue && invocation.msgValue === undefined) {
      throw new Error(`message-bus batch msg.value for '${handler.name}' requires an explicit logical value`);
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
    throw new Error(`message-bus batch blob is ${blob.length} bytes; maximum is ${capability.maximumBlobBytes}`);
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
      if (/^__message_bus_sig_\d+_\d+_r\d+$/.test(input.name)) {
        const sameParameter = input.name.replace(/_r\d+$/, '');
        const fallback = [...signatureWitnessValues].find(([name]) =>
          name.replace(/_r\d+$/, '') === sameParameter)?.[1];
        if (fallback) return fallback;
      }
      const supplied = unboundRouteWitnesses[input.name];
      if (supplied !== undefined) return supplied;
      // Route dispatch never observes an inactive row's key band. Keep it distinct from active identities: reusing
      // an active family member manufactures a false same-target alias and can redirect a later row's journal to
      // an inactive default-valued cache. The positional ABI only requires a type-correct value here.
      return inactiveMessageBusRouteWitness(input.type);
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
 * Decode and completely consume the aggregate return-event commitment produced by a returning message-bus batch route.
 *
 * The compiler route concatenates the canonical ABI fields returned by each reached returning row. The plan
 * supplies the exact ordered type vector, so decoding is deterministic even when rows return different types
 * or tuples. Complete consumption rejects both omitted fields and attacker-controlled suffixes.
 */
export function decodeMessageBusResults(
  artifact: Artifact,
  plan: EncodedMessageBatch,
  commitment: Uint8Array,
): readonly DecodedMessageBusResult[] {
  const capability = artifact.messageBus;
  if (!capability) throw new Error('This artifact does not advertise a message-bus route');
  if (plan.results.length === 0) {
    if (commitment.length !== 0) throw new Error('Non-returning message-bus batch plan has an unexpected result commitment');
    return [];
  }
  // `__message_bus1` returns one `bytes`, so the ordinary return-event ABI wraps the route's packed per-row result
  // vector in one outer bytes push. Authenticate/consume that outer field before interpreting the inner vector.
  const outer = decodePushdataValue(commitment, 0, 'bytes');
  if (outer.bytesConsumed !== commitment.length || !(outer.value instanceof Uint8Array)) {
    throw new Error('message-bus batch result commitment is not one canonical bytes field');
  }
  const packed = outer.value;
  const structs = artifact.structs ?? artifact.stateLayout?.structs;
  let offset = 0;
  const decodedRows = plan.results.map((result) => {
    const values: StateValue[] = [];
    for (const type of result.types) {
      if (offset >= packed.length) throw new Error('message-bus batch result commitment ended before every result field');
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
    throw new Error('message-bus batch result commitment contains an unchecked suffix');
  }
  return Object.freeze(decodedRows);
}
