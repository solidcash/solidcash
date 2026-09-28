/**
 * phase-boundary extract: Delegate-event NFT helpers + JobEvent stamp/encode/classify helpers.
 * (phase-boundary extract from StatefulTransactionBuilder.ts).
 */

import { binToHex, encodeDataPush, hexToBin } from '@bitauth/libauth';
import type { Artifact, StateValue } from '@solidcash/utils';
import {
  Op,
  buildEntryNftCovenantScript,
  computeCollectionHash,
  computeCollectionSignature,
  encodeInt,
  encodePushdataValue,
  getDefaultStateValue,
} from '@solidcash/utils';
import { scriptToLockingBytecode } from '../utils.js';
import {
  commitmentHexOf,
  cloneToken,
  outputMatchesLock,
} from './stb-output-utils.js';
import {
  isDisposableAlignmentPad,
  isViewReturnTailOutput,
} from './value-chunk-band-helpers.js';
import { isJobEventEmitCommitment } from './same-index-twin-emit.js';
import { isOpReturnLockingBytecode } from './mutable-output-reassert.js';
import type { ValueChunkWriteDescriptor } from './value-chunk-persist.js';

/** SCID identity commitment ASCII prefix ("SCID"). */
export const SCID_COMMIT_PREFIX = '53434944';

/**
 * True when an output already carries a substantive immutable NFT claim.
 *
 * Layout owners use an empty/all-zero commitment while a slot is still a placeholder, and SCID commitments are
 * transport identities rather than application output claims. Any other immutable commitment is materialized and
 * must outrank a later same-index conservation repair when its coordinate is reserved by the compiler.
 */
export function isMaterializedImmutableNftOutput(output: {
  token?: { nft?: { capability?: string; commitment?: string | Uint8Array } };
} | undefined): boolean {
  if (output?.token?.nft?.capability !== 'none') return false;
  const commitment = commitmentHexOf(output.token.nft.commitment).toLowerCase();
  return commitment.length > 0
    && !/^0+$/.test(commitment)
    && !commitment.startsWith(SCID_COMMIT_PREFIX);
}

/** True when an output is a proxy-category event NFT (capability none) and not a SCID identity. */
export function isDelegateEventNftOutput(output: {
  token?: { nft?: { capability?: string; commitment?: string } };
} | undefined): boolean {
  if (output?.token?.nft?.capability !== 'none') return false;
  const commit = String(output.token?.nft?.commitment ?? '');
  return commit.length > 0 && !commit.toLowerCase().startsWith(SCID_COMMIT_PREFIX);
}

/**
 * Delegate emit verification is `OP_INPUTINDEX + event.offset` of the implementation.
 * The builder often parks that NFT in the proxy event band; move it onto dest.
 */
export function lockingHexOf(output: { to?: Uint8Array | string } | undefined): string {
  if (!output?.to) return '';
  return output.to instanceof Uint8Array ? binToHex(output.to) : String(output.to);
}

export type DelegateEventClaim = {
  destination: number;
  categoryId: string;
  lockingBytecode: Uint8Array;
  commitment: string;
};

/**
 * An implementation's event epilogue admits own-category event NFTs only at its published event slots. Earlier
 * layout passes can leave an exact clone on a return/alignment witness. Keep every explicitly claimed physical
 * destination and make only unclaimed exact clones inert; unrelated events and their tokens remain untouched.
 */
export function demoteUnclaimedDelegateEventClones<T extends {
  to?: Uint8Array | string;
  token?: { category?: string; nft?: { capability?: string; commitment?: string | Uint8Array } };
}>(outputs: T[], claims: readonly DelegateEventClaim[]): number {
  const commitmentHex = (value: unknown): string => (
    value instanceof Uint8Array ? binToHex(value) : String(value ?? '').toLowerCase()
  );
  const destinationsByIdentity = new Map<string, Set<number>>();
  for (const claim of claims) {
    const identity = `${claim.categoryId}:${binToHex(claim.lockingBytecode)}:${claim.commitment.toLowerCase()}`;
    const destinations = destinationsByIdentity.get(identity) ?? new Set<number>();
    destinations.add(claim.destination);
    destinationsByIdentity.set(identity, destinations);
  }
  let demoted = 0;
  for (const [index, output] of outputs.entries()) {
    if (output.token?.nft?.capability !== 'none' || !output.token.category) continue;
    const identity = `${output.token.category}:${lockingHexOf(output)}:${commitmentHex(output.token.nft.commitment)}`;
    const destinations = destinationsByIdentity.get(identity);
    if (!destinations || destinations.has(index)) continue;
    outputs[index] = { ...output, to: Uint8Array.of(0x51) };
    demoted += 1;
  }
  return demoted;
}

export function relocateDelegateEventNftToDest(
  outputs: Array<{
    to?: Uint8Array | string;
    amount?: bigint;
    token?: { amount?: bigint; category?: string; nft?: { capability?: string; commitment?: string } };
  }>,
  dest: number,
  expectedLocking?: Uint8Array,
): boolean {
  if (dest < 0) return false;
  while (outputs.length <= dest) {
    outputs.push({ to: Uint8Array.of(0x51), amount: 1000n });
  }
  const expectedHex = expectedLocking ? binToHex(expectedLocking) : undefined;
  const matches = (output: typeof outputs[number] | undefined): boolean => (
    isDelegateEventNftOutput(output)
    && (expectedHex === undefined || lockingHexOf(output) === expectedHex)
  );
  if (matches(outputs[dest])) return true;
  if (outputs[dest]?.token?.nft?.capability === 'minting') return false;
  let source = -1;
  for (let index = 0; index < outputs.length; index++) {
    if (index === dest) continue;
    if (!matches(outputs[index])) continue;
    source = index;
    break;
  }
  if (source < 0) return false;
  const moved = outputs[source];
  outputs[dest] = moved;
  outputs[source] = { to: Uint8Array.of(0x51), amount: 1000n };
  return true;
}

/**
 * Map visible call args onto event parameters by name (`treasuryAddress_` → `treasuryAddress`).
 * Incomplete mappings return undefined so a later emit pass can fill the slot.
 */
export function resolveNamedEventValues(
  parameters: readonly { name: string }[],
  visibleInputs: readonly { name: string }[],
  args: readonly unknown[],
): unknown[] | undefined {
  const byName = new Map<string, unknown>();
  visibleInputs.forEach((input, index) => {
    byName.set(input.name, args[index]);
    byName.set(input.name.replace(/_+$/, ''), args[index]);
  });
  const values = parameters.map((parameter) => (
    byName.has(parameter.name) ? byName.get(parameter.name) : undefined
  ));
  return values.every((value) => value !== undefined) ? values : undefined;
}

/** JobEvent.type_ from a positional tuple or named struct. */
export function jobEventTypeOf(event: unknown): number | undefined {
  const raw = Array.isArray(event)
    ? event[0]
    : event && typeof event === 'object' && !Array.isArray(event)
      ? (event as { type_?: unknown }).type_
      : undefined;
  if (typeof raw === 'bigint' || typeof raw === 'number') {
    const type = Number(raw);
    return Number.isInteger(type) && type >= 0 && type <= 16 ? type : undefined;
  }
  return undefined;
}

export function jobEventFieldEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === 0 || value === 0n || value === '') return true;
  if (value instanceof Uint8Array) return value.length === 0;
  return false;
}

export function stampEmptyJobEventTimestamp(event: unknown, timestamp: bigint): unknown {
  if (timestamp <= 0n) return event;
  if (Array.isArray(event)) {
    if (!jobEventFieldEmpty(event[3])) return event;
    const next = [...event];
    next[3] = timestamp;
    return next;
  }
  if (event && typeof event === 'object') {
    const record = event as { timestamp_?: unknown };
    if (!jobEventFieldEmpty(record.timestamp_)) return event;
    return { ...record, timestamp_: timestamp };
  }
  return event;
}

/**
 * Persist UPDATE rematerialize (Created digest + persist `v`) is only for
 * empty-address JobEvents (Closed / CollateralWithdrawn). Created and
 * Whitelisted carry an address and are INSERT/dest rows — restamping persist
 * `v` there rewrites second-publish nNew and the whitelist dest.
 */
export function isWithdrawShapedJobEvent(event: unknown): boolean {
  if (jobEventTypeOf(event) === undefined) return false;
  if (Array.isArray(event)) return jobEventFieldEmpty(event[1]);
  if (event && typeof event === 'object') {
    return jobEventFieldEmpty((event as { address_?: unknown }).address_);
  }
  return false;
}

export function shouldRematerializePersistUpdate(parts: {
  persistReady: boolean;
  initialWrite?: boolean;
  event?: unknown;
  plannedInserts?: number;
}): boolean {
  if (!parts.persistReady || parts.initialWrite === true) return false;
  if ((parts.plannedInserts ?? 0) > 0) return false;
  return isWithdrawShapedJobEvent(parts.event);
}

/** First-publish Created / whitelist INSERT dests must keep their own redeem lock. */
export function isInsertShapedJobEvent(event: unknown): boolean {
  const type = jobEventTypeOf(event);
  return type === 0 || type === 14 || type === 15;
}

/**
 * Persist UPDATE band slots (updateJobPost nNew=3) EQUALVERIFY the Created
 * digest redeem. First-publish INSERT dests and whitelist writes must not.
 */
export function shouldStampPersistUpdateDigestLock(parts: {
  persistReady: boolean;
  persistWidth: number;
  firstPublishInsert: boolean;
}): boolean {
  return parts.persistReady && parts.persistWidth > 0 && !parts.firstPublishInsert;
}

/** Entry-covenant digest locks are a descriptor-free compatibility transport, never a value-chunk identity. */
export function shouldUseLegacyPersistDigestLockForValueChunks(parts: {
  hasWriteMetadata: boolean;
  permitsLegacyFallback: boolean;
  stampPersistUpdate: boolean;
}): boolean {
  return !parts.hasWriteMetadata && parts.permitsLegacyFallback && parts.stampPersistUpdate;
}

export function isIntegerType(type: string): boolean {
  return /^(?:u?int(?:\d+)?|bigint)$/.test(type);
}

export function scalarTypeKey(type: string): string | undefined {
  // Keep integer width/sign in the key so a uint256 slot word does not unique-zip onto a packed uint16.
  if (isIntegerType(type)) return type;
  if (type === 'bool') return 'bool';
  if (type === 'byte') return 'bytes1';
  if (/^bytes\d+$/.test(type)) return type;
  if (type === 'bytes' || type === 'string') return 'bytes';
  return undefined;
}

export function canEncodeScalarStateValue(value: StateValue, type: string): boolean {
  try {
    encodePushdataValue(value, type);
    return true;
  } catch {
    return false;
  }
}

export function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  const lex: T[][] = [];
  const permute = (prefix: T[], rest: T[]): void => {
    if (rest.length === 0) {
      lex.push(prefix);
      return;
    }
    rest.forEach((item, index) => {
      permute([...prefix, item], rest.slice(0, index).concat(rest.slice(index + 1)));
    });
  };
  permute([], items);
  // Rotations put a crossed assignment (a=z,b=x,c=y) first: shift n-1 is [last, 0, 1, ...].
  const rotations: T[][] = [];
  for (let k = 1; k <= items.length; k += 1) {
    const shift = items.length - k;
    rotations.push(items.map((_, index) => items[(index + shift) % items.length]));
  }
  const rotationKeys = new Set(rotations.map((perm) => perm.join('\0')));
  return [...rotations, ...lex.filter((perm) => !rotationKeys.has(perm.join('\0')))];
}

export function fieldNameMatchesArg(fieldName: string, argName: string): boolean {
  const field = fieldName.toLowerCase();
  const arg = argName.toLowerCase();
  if (field === arg) return true;
  const stripped = arg.replace(/^(?:new|next|updated|set|from|old|prev|dest|the|init|src|tmp|val)/, '');
  return stripped.length > 0 && stripped === field;
}

export function evalSimpleIntegerSource(source: string | undefined): bigint | undefined {
  if (source === undefined) return undefined;
  const literal = source.match(/^(?:lit|const):(-?[0-9]+)$/);
  if (literal) return BigInt(literal[1]);
  const binary = source.match(/^binop:([+*-])\((.*)\)$/);
  if (!binary) return undefined;
  const splitTopLevel = (s: string): [string, string] | undefined => {
    let depth = 0;
    for (let i = 0; i < s.length; i += 1) {
      if (s[i] === '(' || s[i] === '[' || s[i] === '{') depth += 1;
      else if (s[i] === ')' || s[i] === ']' || s[i] === '}') depth -= 1;
      else if (s[i] === ',' && depth === 0) return [s.slice(0, i), s.slice(i + 1)];
    }
    return undefined;
  };
  const pair = splitTopLevel(binary[2]);
  if (pair === undefined) return undefined;
  const left = evalSimpleIntegerSource(pair[0]);
  const right = evalSimpleIntegerSource(pair[1]);
  if (left === undefined || right === undefined) return undefined;
  if (binary[1] === '+') return left + right;
  if (binary[1] === '-') return left - right;
  return left * right;
}

export function paramToStateValue(param: unknown, abiType: string): StateValue | undefined {
  const key = scalarTypeKey(abiType);
  if (key === undefined || param === undefined || param === null) return undefined;
  if (isIntegerType(abiType)) {
    if (typeof param === 'bigint') return param;
    if (typeof param === 'number' && Number.isInteger(param)) return BigInt(param);
    return undefined;
  }
  if (key === 'bool') {
    return typeof param === 'boolean' ? param : undefined;
  }
  if (param instanceof Uint8Array) return param;
  if (typeof param === 'string' && (abiType === 'string' || abiType === 'bytes')) return param;
  return undefined;
}

/** Build the entry-NFT digest lock for one exact compiler-described collection write. */
export function persistUpdateDigestLock(
  categoryId?: string,
  _extraCategories: readonly string[] = [],
  write?: ValueChunkWriteDescriptor | null,
): Uint8Array | undefined {
  if (!categoryId || !/^[0-9a-f]{64}$/i.test(categoryId)) return undefined;
  if (!write) return undefined;
  try {
    if (write.categoryId.toLowerCase() !== categoryId.toLowerCase()) return undefined;
    const collectionHash = computeCollectionHash(write.collectionSignature);
    if (binToHex(collectionHash) !== write.collectionHash.toLowerCase()) return undefined;
    return scriptToLockingBytecode(
      buildEntryNftCovenantScript(hexToBin(categoryId), collectionHash),
      'p2sh32',
    );
  } catch {
    return undefined;
  }
}

/** Explicit adapter for descriptor-free plans using the historical JobEvent collection schema. */
export function legacyJobEventsPersistUpdateDigestLock(categoryId?: string): Uint8Array | undefined {
  if (!categoryId || !/^[0-9a-f]{64}$/i.test(categoryId)) return undefined;
  try {
    const collectionHash = computeCollectionHash(
      computeCollectionSignature('jobEvents', 'mapping(uint256 => JobEventData[])'),
    );
    return scriptToLockingBytecode(
      buildEntryNftCovenantScript(hexToBin(categoryId), collectionHash),
      'p2sh32',
    );
  } catch {
    return undefined;
  }
}

/** Dest 18 is the jobEvents entry lock; dest 19+ keep the consumed persist-v lock. */
export function persistUpdateDestLock(parts: {
  destOffset: number;
  entryLock?: Uint8Array;
  persistLock?: Uint8Array;
  inputLock?: Uint8Array;
}): Uint8Array | undefined {
  if (parts.destOffset === 0) return parts.entryLock ?? parts.persistLock ?? parts.inputLock;
  return parts.persistLock ?? parts.inputLock ?? parts.entryLock;
}

/** Close / CollateralWithdrawn (and similar) carry empty address/data/timestamp. */
export function isEmptyPayloadJobEvent(event: unknown): boolean {
  if (jobEventTypeOf(event) === undefined) return false;
  if (Array.isArray(event)) {
    return jobEventFieldEmpty(event[1]) && jobEventFieldEmpty(event[2]) && jobEventFieldEmpty(event[3]);
  }
  if (event && typeof event === 'object') {
    const record = event as { address_?: unknown; data_?: unknown; timestamp_?: unknown };
    return jobEventFieldEmpty(record.address_)
      && jobEventFieldEmpty(record.data_)
      && jobEventFieldEmpty(record.timestamp_);
  }
  return false;
}

export function jobEventTimestampOf(event: unknown): bigint | undefined {
  const raw = Array.isArray(event)
    ? event[3]
    : (event && typeof event === 'object'
      ? (event as { timestamp_?: unknown }).timestamp_
      : undefined);
  if (typeof raw === 'bigint') return raw;
  if (typeof raw === 'number' && Number.isFinite(raw)) return BigInt(raw);
  return undefined;
}

/**
 * Emit blob for an empty-payload JobEvent: `00||OP_type||00 00 || timestamp`.
 * Persist last-row Closed is `0057000000`; CollateralWithdrawn with a stamp is
 * `0060000004…` — the impl EQUALVERIFYs that CAT, not the unstamped `0060000000`.
 */
export function encodeEmptyJobEventEmitCommitment(jobId: unknown, event: unknown): string | undefined {
  const type = jobEventTypeOf(event);
  if (type === undefined) return undefined;
  const addressEmpty = Array.isArray(event)
    ? jobEventFieldEmpty(event[1])
    : jobEventFieldEmpty((event as { address_?: unknown })?.address_);
  const dataEmpty = Array.isArray(event)
    ? jobEventFieldEmpty(event[2])
    : jobEventFieldEmpty((event as { data_?: unknown })?.data_);
  if (!addressEmpty || !dataEmpty) return undefined;
  const id = typeof jobId === 'bigint' || typeof jobId === 'number' ? Number(jobId) : 0;
  if (!Number.isInteger(id) || id < 0 || id > 16) return undefined;
  const idHex = id === 0 ? '00' : (id + 0x50).toString(16).padStart(2, '0');
  const typeHex = type === 0 ? '00' : (type + 0x50).toString(16).padStart(2, '0');
  const timestamp = jobEventTimestampOf(event);
  if (timestamp !== undefined && timestamp > 0n) {
    const stamped = encodeDataPush(encodeInt(timestamp));
    if (stamped.length > 0) {
      return `${idHex}${typeHex}0000${binToHex(stamped)}`;
    }
  }
  return `${idHex}${typeHex}000000`;
}

/** Same CAT the emit covenant uses: pushdata(jobId) || pushdata(event). */
export function encodeJobEventEmitCommitment(
  jobId: unknown,
  event: unknown,
  structs?: Artifact['structs'],
): string | undefined {
  try {
    const jobEnc = encodePushdataValue(jobId as StateValue, 'uint256');
    const eventEnc = encodePushdataValue(event as StateValue, 'JobEventData', structs);
    if (!(jobEnc instanceof Uint8Array) || !(eventEnc instanceof Uint8Array)) return undefined;
    const out = new Uint8Array(jobEnc.length + eventEnc.length);
    out.set(jobEnc, 0);
    out.set(eventEnc, jobEnc.length);
    return binToHex(out);
  } catch {
    return encodeEmptyJobEventEmitCommitment(jobId, event);
  }
}

/**
 * Any emit-slot commitment the covenant EQUALVERIFYs — JobEvent blobs and
 * typed events such as Initialized(uint64)=`51` or packed addresses.
 * SCID identity and empty probes are not emits.
 */
export function isLearnedEventEmitCommitment(commitment: string): boolean {
  const hex = commitment.toLowerCase();
  if (!hex || hex.startsWith('53434944') || /^(00)+$/.test(hex)) return false;
  if (isJobEventEmitCommitment(hex)) return true;
  // Script-number events (Initialized(1) → OP_1).
  if (hex.length <= 2) return hex === '01' || /^5[1-9a-f]$/.test(hex) || hex === '60';
  // Packed ABI payloads (OwnershipTransferred, ArbitratorRegistered, …).
  return hex.length >= 4 && hex.length <= 256;
}

/**
 * Decide whether an output-pin observation can repair an event NFT. A compiler-owned event coordinate is already
 * authenticated by both block layout and the implementation's `OUTPUTTOKENCOMMITMENT EQUALVERIFY`, so every
 * non-empty encoding is meaningful there — including `00` for a typed zero value. Unowned coordinates retain the
 * conservative shape filter because an all-zero value there can be an unrelated speculative placeholder.
 */
export function isAuthenticatedEventRepairCommitment(
  commitment: Uint8Array, compilerOwnedEventSlot: boolean,
): boolean {
  if (commitment.length === 0) return false;
  if (compilerOwnedEventSlot) return true;
  if (commitment.every((byte) => byte === 0)) return false;
  const hex = binToHex(commitment);
  return commitment.length > 32 || isLearnedEventEmitCommitment(hex);
}

/**
 * Make an unclaimed compiler-owned event coordinate neutral. Removing only the
 * token is insufficient: collection covenants authenticate exact output
 * cardinality by locking bytecode, so a displaced entry lock would still be
 * counted as an extra collection node.
 */
export function demoteUnclaimedConditionalEventOutput(output: {
  to?: Uint8Array | string;
  token?: {
    category?: string;
    nft?: { capability?: string; commitment?: Uint8Array | string };
  };
}, categoryId: string): boolean {
  if (output.token?.category !== categoryId) return false;
  const capability = output.token.nft?.capability;
  const raw = output.token.nft?.commitment;
  const dummyCommitment = raw instanceof Uint8Array
    ? raw.length === 0 || raw.every((byte) => byte === 0) || binToHex(raw) === '53434944'
    : (() => {
      const hex = String(raw ?? '');
      return hex === '' || /^(00)+$/.test(hex) || hex.toLowerCase() === '53434944';
    })();
  if (capability !== 'mutable' && (capability !== 'none' || !dummyCommitment)) return false;
  output.to = Uint8Array.of(Op.OP_1);
  delete output.token;
  return true;
}

export function isEmptySameCategoryNoneCap(
  output: {
    token?: { category?: string; nft?: { capability?: string; commitment?: string } };
  } | undefined,
  category: string,
): boolean {
  if (output?.token?.category !== category || output.token.nft?.capability !== 'none') return false;
  const commit = String(output.token.nft.commitment ?? '');
  return commit === '' || /^0+$/.test(commit);
}
