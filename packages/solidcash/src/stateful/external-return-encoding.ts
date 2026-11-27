/**
 * phase-boundary extract: external/EVM return encoding + probe-require helpers
 * (phase-boundary extract from StatefulContract.ts).
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { binToUtf8, utf8ToBin } from '@bitauth/libauth/build/lib/format/utf8.js';
import type { AuthenticationProgramStateCommon } from '@bitauth/libauth/build/lib/vm/vm-types.js';
import {
  decodePushdataValue,
  encodeEventPushdataValue,
  peekPushdataEncodedLength,
  type Artifact,
  type StateValue,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import { matchesExecutedBody } from '../oracle/pool/program.js';
import {
  decodeEvmInvocationResult,
  decodeEvmInvocationResultPrefix,
  encodeEvmInvocationResult,
} from './evm-abi-result.js';

/** True when every word is a canonical Solidity ABI encoding for its declared scalar type. */
export function isCanonicalEvmScalarReturnVector(
  value: Uint8Array, expectedTypes: readonly string[],
): boolean {
  if (value.length !== expectedTypes.length * 32) return false;
  return expectedTypes.every((type, index) => {
    const word = value.slice(index * 32, (index + 1) * 32);
    if (type === 'bool') {
      return word.slice(0, 31).every((byte) => byte === 0) && word[31] <= 1;
    }
    if (type === 'address' || type === 'address payable') {
      return word.slice(0, 12).every((byte) => byte === 0);
    }
    const fixedBytes = /^bytes([1-9]|[12][0-9]|3[0-2])$/.exec(type);
    if (fixedBytes) {
      return word.slice(Number(fixedBytes[1])).every((byte) => byte === 0);
    }
    const numeric = /^(u?int)(\d+)$/.exec(type) ?? /^(u?fixed)(\d+)x\d+$/.exec(type);
    if (numeric) {
      const width = Number(numeric[2]);
      const payloadStart = 32 - width / 8;
      if (numeric[1] === 'uint' || numeric[1] === 'ufixed') {
        return word.slice(0, payloadStart).every((byte) => byte === 0);
      }
      const extension = (word[payloadStart] & 0x80) === 0 ? 0x00 : 0xff;
      return word.slice(0, payloadStart).every((byte) => byte === extension);
    }
    return type === 'int' || type === 'uint' || type === 'bigint';
  });
}

/** Select a complete Solidity return from strongest-to-weakest live stack candidates. */
export function selectEvmScalarReturnCommitment(
  candidates: readonly Uint8Array[], expectedTypes: readonly string[], allowRaw = true,
): string | undefined {
  const bytes = expectedTypes.length * 32;
  // Prefer a complete Solidity return vector framed as one canonical `bytes` field over raw ABI-width values
  // which happen to remain on the stack: state hashes, mapping witnesses, and zero placeholders are all valid
  // `uint256` words, but none of them is a complete framed return. A progressive probe can stop after the frame
  // is assembled and before its output comparison, so this is also the strongest result available in that state.
  for (const candidate of candidates) {
    // A complete outer bytes field is exactly one push. Resolving that from the length prefix rejects an
    // ordinary stack item (a raw state value, hash, or script) without slicing it and without the
    // exception `decodePushdataValue` would raise and capture a stack trace for.
    if (peekPushdataEncodedLength(candidate) !== candidate.length) continue;
    try {
      const outer = decodePushdataValue(candidate, 0, 'bytes');
      if (!(outer.value instanceof Uint8Array) || outer.bytesConsumed !== candidate.length) continue;
      if (!isCanonicalEvmScalarReturnVector(outer.value, expectedTypes)) continue;
      return binToHex(outer.value);
    } catch {
      // Ordinary stack items are not canonical outer bytes fields.
    }
  }
  if (!allowRaw) return undefined;
  for (const candidate of candidates) {
    if (candidate.length !== bytes) continue;
    if (!isCanonicalEvmScalarReturnVector(candidate, expectedTypes)) continue;
    if (expectedTypes.length === 1 && expectedTypes[0] === 'bool') {
      // A failing probe contains many unrelated ABI-sized zero words (state fields, hashes, placeholders).
      // They cannot authenticate `false`; the targeted return-output comparison does that when execution
      // reaches it. `true` remains a useful advancing observation, while precomputed false views are retained
      // by the fixed-point caller until that stronger output evidence replaces them.
      if (candidate[31] === 0) continue;
    }
    return binToHex(candidate);
  }
  return undefined;
}

const EVM_DYNAMIC_RETURN_TYPES = new Set(['bytes', 'string']);

const decodeEvmReturnWord = (value: Uint8Array, offset: number): number | undefined => {
  if (offset < 0 || offset + 32 > value.length) return undefined;
  let decoded = 0n;
  for (let index = offset; index < offset + 32; index += 1) {
    decoded = (decoded << 8n) | BigInt(value[index]);
  }
  return decoded <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(decoded) : undefined;
};

/** Length of one canonical Solidity ABI result tuple within a concatenated return vector. */
export function canonicalEvmReturnVectorLength(
  value: Uint8Array, cursor: number, expectedTypes: readonly string[],
  structs?: Artifact['structs'], enums?: Artifact['enums'],
): number | undefined {
  if (!Number.isSafeInteger(cursor) || cursor < 0 || cursor > value.length) return undefined;
  // Use the same schema-aware canonical decoder as authenticated producer-result propagation. A named
  // aggregate is not a single ABI word: its static head and nested dynamic offsets come from its schema.
  return decodeEvmInvocationResultPrefix(value.subarray(cursor), expectedTypes, structs, enums)?.bytesConsumed;
}

/** Validate one complete mixed static/dynamic Solidity ABI invocation result. */
export function isCanonicalEvmReturnVector(
  value: Uint8Array, expectedTypes: readonly string[],
  structs?: Artifact['structs'], enums?: Artifact['enums'],
): boolean {
  return canonicalEvmReturnVectorLength(value, 0, expectedTypes, structs, enums) === value.length;
}

function isBoundedNumericReturnType(type: string): boolean {
  const numeric = /^u?int([1-9][0-9]*)$/.exec(type)
    ?? /^u?fixed([1-9][0-9]*)x\d+$/.exec(type);
  if (!numeric) return false;
  const width = Number(numeric[1]);
  return width >= 8 && width <= 256 && width % 8 === 0;
}

/** Recover a Solidity ABI value which is live immediately before a return-output comparison. */
export function extractEvmScalarReturnCommitment(
  fullTrace: AuthenticationProgramStateCommon[], expectedTypes: readonly string[], allowRaw = true,
): string | undefined {
  if (expectedTypes.length === 0 || !expectedTypes.every((type) => (
    type === 'bool' || type === 'int' || type === 'uint' || type === 'bigint'
    || isBoundedNumericReturnType(type)
    || type === 'address' || /^bytes(?:[1-9]|[12][0-9]|3[0-2])$/.test(type)
  ))) return undefined;
  const candidates: Uint8Array[] = [];
  for (let traceIndex = fullTrace.length - 1; traceIndex >= Math.max(0, fullTrace.length - 96); traceIndex--) {
    const stack = fullTrace[traceIndex].stack;
    for (let stackIndex = stack.length - 1; stackIndex >= 0; stackIndex--) {
      candidates.push(stack[stackIndex]);
    }
  }
  return selectEvmScalarReturnCommitment(candidates, expectedTypes, allowRaw);
}

/** Encode a complete external invocation result using the callee's declared ABI mode and named schemas. */
export function encodeExternalReturnValues(
  values: readonly StateValue[],
  types: readonly string[],
  structs: Artifact['structs'],
  solidityAbi: boolean,
  enums?: Artifact['enums'],
): Uint8Array {
  if (solidityAbi) return encodeEvmInvocationResult(values, types, structs, enums);
  if (values.length !== types.length) {
    throw new Error(`Native result has ${values.length} values for ${types.length} declared types`);
  }
  // A native result is pushed as the callee's return pushes it: an address of 20 zero bytes stays 20 bytes.
  const parts = values.map((value, index) => encodeEventPushdataValue(value, types[index], structs));
  const encoded = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) { encoded.set(part, offset); offset += part.length; }
  return encoded;
}

/** Encode a one-value external invocation result. */
export function encodeExternalReturnValue(
  value: StateValue,
  type: string,
  structs: Artifact['structs'],
  solidityAbi: boolean,
  enums?: Artifact['enums'],
): Uint8Array {
  return encodeExternalReturnValues([value], [type], structs, solidityAbi, enums);
}

/** Recover a source require message from an invoked-body probe failure. */
export function probeRequireMessage(
  artifacts: readonly (Artifact | undefined)[],
  selector: string | undefined,
  errorIp: number | undefined,
  logicalFunctionNames: readonly string[] = [],
  activeBodyHex?: string,
): string | undefined {
  if (errorIp === undefined) return undefined;
  const seen = new Set<Artifact>();
  const candidates: Artifact[] = [];
  const add = (artifact: Artifact | undefined): void => {
    if (!artifact || seen.has(artifact)) return;
    seen.add(artifact);
    candidates.push(artifact);
    add(artifact.delegateArtifact);
  };
  for (const artifact of artifacts) add(artifact);
  if (activeBodyHex !== undefined) {
    // An OP_INVOKE failure is addressed in the active outlined body, not the entry point. Identical bytecode
    // may have more than one source owner; attribute it only if all matching owners agree on one message.
    const messages = new Set<string>();
    let matched = false;
    for (const artifact of candidates) {
      for (const body of Object.values(artifact.debug?.invokeDebug ?? {})) {
        if (!matchesExecutedBody(body.bytecode, activeBodyHex)) continue;
        matched = true;
        const requirement = body.requires.find((entry) => entry.ip === errorIp - 1)
          ?? body.requires.find((entry) => entry.ip === errorIp);
        if (!requirement?.message) return undefined;
        messages.add(requirement.message);
      }
    }
    if (matched) return messages.size === 1 ? [...messages][0] : undefined;
  }
  for (const artifact of candidates) {
    const selectors = selector ? [selector] : Object.keys(artifact.debug?.functionDebug ?? {});
    for (const candidateSelector of selectors) {
      const requirements = artifact.debug?.functionDebug?.[candidateSelector]?.requires ?? [];
      const requirement = requirements.find((entry) => entry.ip === errorIp - 1)
        ?? requirements.find((entry) => entry.ip === errorIp);
      if (requirement?.message) return requirement.message;
    }
  }
  // No published require at this IP carries a message. Attribute only when every represented logical function
  // publishes the same single reason; ambiguity deliberately stays unattributed.
  const messages = new Set<string>();
  for (const artifact of candidates) {
    for (const name of logicalFunctionNames) {
      const functionSelector = artifact.abi.find((fn) => fn.name === name)?.selector;
      if (!functionSelector) continue;
      for (const requirement of artifact.debug?.functionDebug?.[functionSelector]?.requires ?? []) {
        if (requirement.message) messages.add(requirement.message);
      }
    }
  }
  if (messages.size === 1) return [...messages][0];
  return undefined;
}

/**
 * Resolve the failing `require` statement itself - not just its custom message.
 *
 * The artifact's `requires[]` table already carries the source line, which is what makes a bare
 * `require(x < n)` (`message: undefined`) attributable: a revert inside a compiled view is otherwise
 * unattributable from the outside, and the message alone cannot say WHICH predicate failed when a handler
 * has several. Returns the owning contract name so a multi-contract graph still names the right body.
 */
export function probeRequireStatement(
  artifacts: readonly (Artifact | undefined)[],
  selector: string | undefined,
  errorIp: number | undefined,
): { contractName?: string; line: number; message?: string } | undefined {
  if (errorIp === undefined) return undefined;
  const seen = new Set<Artifact>();
  const candidates: Artifact[] = [];
  const add = (artifact: Artifact | undefined): void => {
    if (!artifact || seen.has(artifact)) return;
    seen.add(artifact);
    candidates.push(artifact);
    add(artifact.delegateArtifact);
  };
  for (const artifact of artifacts) add(artifact);
  for (const artifact of candidates) {
    const selectors = selector ? [selector] : Object.keys(artifact.debug?.functionDebug ?? {});
    for (const candidateSelector of selectors) {
      const requirements = artifact.debug?.functionDebug?.[candidateSelector]?.requires ?? [];
      const requirement = requirements.find((entry) => entry.ip === errorIp - 1)
        ?? requirements.find((entry) => entry.ip === errorIp);
      if (requirement) {
        return { contractName: artifact.contractName, line: requirement.line, message: requirement.message };
      }
    }
  }
  return undefined;
}

/** Decode the single-word Solidity ABI scalar forms emitted by imported Solidity contracts. */
export function decodeEvmScalarReturn(value: Uint8Array, type: string): FunctionArgument | undefined {
  if (value.length !== 32) return undefined;
  if (type === 'bool') {
    if (!value.slice(0, 31).every((byte) => byte === 0) || value[31] > 1) return undefined;
    return value[31] === 1;
  }
  if (type !== 'int' && type !== 'uint' && type !== 'bigint'
    && !/^u?int\d+$/.test(type) && !/^u?fixed\d+x\d+$/.test(type)) return undefined;
  let decoded = 0n;
  for (const byte of value) decoded = (decoded << 8n) | BigInt(byte);
  if ((type === 'int' || /^int\d+$/.test(type) || /^fixed\d+x\d+$/.test(type))
    && (value[0] & 0x80) !== 0) {
    decoded -= 1n << 256n;
  }
  return decoded;
}

/** Decode one canonical Solidity ABI return value for authenticated result propagation. */
export function decodeEvmReturnValue(value: Uint8Array, type: string): FunctionArgument | undefined {
  if (!EVM_DYNAMIC_RETURN_TYPES.has(type)) return decodeEvmScalarReturn(value, type);
  if (!isCanonicalEvmReturnVector(value, [type])) return undefined;
  const offset = decodeEvmReturnWord(value, 0);
  if (offset === undefined) return undefined;
  const length = decodeEvmReturnWord(value, offset);
  if (length === undefined) return undefined;
  const payload = value.slice(offset + 32, offset + 32 + length);
  if (type === 'bytes') return payload;
  const decoded = binToUtf8(payload);
  return binToHex(utf8ToBin(decoded)) === binToHex(payload) ? decoded : undefined;
}

/** Decode one complete, schema-authenticated invocation result without flattening its components. */
export function decodeAuthenticatedProducerResultVector(
  value: Uint8Array,
  types: readonly string[],
  structs: Artifact['structs'],
  solidityAbi: boolean,
  enums?: Artifact['enums'],
): FunctionArgument[] | undefined {
  if (types.length === 0) return undefined;
  if (!solidityAbi) {
    const decoded: FunctionArgument[] = [];
    let offset = 0;
    try {
      for (const type of types) {
        const component = decodePushdataValue(value, offset, type, structs);
        if (component.bytesConsumed <= 0) return undefined;
        offset += component.bytesConsumed;
        decoded.push(component.value as FunctionArgument);
      }
    } catch {
      return undefined;
    }
    return offset === value.length ? decoded : undefined;
  }

  return decodeEvmInvocationResult(value, types, structs, enums) as FunctionArgument[] | undefined;
}
