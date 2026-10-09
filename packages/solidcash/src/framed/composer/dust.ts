/**
 * The satoshis a framed output must carry to be relayed.
 *
 * A node refuses an output worth less than three satoshis per byte of the output plus the 148 bytes of the input
 * that later spends it: `3 * (serialized output size + 148)`. The size is the whole serialized output, token prefix
 * included, so a wide commitment raises the floor; a fixed amount covers only outputs up to the width it was sized
 * for (1200 satoshis covers 252 bytes). Every place that funds a created or rewritten record, state or token output
 * funds it here, so the amount it asks for is kept where it is larger and the output's own floor is taken where it
 * is not.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { encodeTransactionOutput } from '@bitauth/libauth/build/lib/message/transaction-encoding.js';
;
;
;
import {
  DYNAMIC_LEN_TYPE, encodeNftIndexTag, encodePushdataValue, getDefaultStateValue, isFixedWidthType,
  isMultiDataNftLayout, parseArrayTypeString, type StateLayout, type StructDefinitionInfo,
} from '@solidcash/utils';
import type { Output } from '../../interfaces.js';
import { getOutputSize } from '../../utils.js';
import { stateRecordLockingBytecode } from '../deploy/records.js';
import type { DraftSourceOutput } from './draft.js';

/** The bytes a node counts for the input that later spends an output. */
const SPENDING_INPUT_BYTES = 148n;

/** The dust threshold of an output of `serializedBytes` bytes. */
export function dustThresholdForSize(serializedBytes: number): bigint {
  return 3n * (BigInt(serializedBytes) + SPENDING_INPUT_BYTES);
}

/** The dust threshold of a composed output, measured on its serialized bytes. */
export function outputDustThreshold(output: DraftSourceOutput): bigint {
  return dustThresholdForSize(encodeTransactionOutput(output as Parameters<typeof encodeTransactionOutput>[0]).length);
}

/** The amount an SDK output is funded with: `amount`, or the output's own dust threshold where that is larger. */
export function satoshisAtLeastDust(amount: bigint, output: Omit<Output, 'amount'>): bigint {
  const floor = dustThresholdForSize(getOutputSize({ ...output, amount } as Output));
  return amount > floor ? amount : floor;
}

/** A composed output carrying at least its own dust threshold; one already above it is returned unchanged. */
export function fundedAtLeastDust<T extends DraftSourceOutput>(output: T): T {
  const floor = outputDustThreshold(output);
  return output.valueSatoshis >= floor ? output : { ...output, valueSatoshis: floor };
}

const dataNftLocks = new Map<string, Uint8Array>();

/**
 * True when the output is a state record at its category's data-NFT covenant. That covenant pins a record's value
 * to the value its input held on every spend, so a composition cannot raise it: the genesis funds it instead.
 */
function valuePinnedRecord(output: DraftSourceOutput): boolean {
  const category = output.token?.category;
  if (category === undefined || category.length !== 32) return false;
  const key = binToHex(category);
  let lock = dataNftLocks.get(key);
  if (lock === undefined) {
    lock = stateRecordLockingBytecode(key);
    dataNftLocks.set(key, lock);
  }
  return lock.length === output.lockingBytecode.length
    && lock.every((byte, index) => byte === output.lockingBytecode[index]);
}

/**
 * A composed record or event output funded at least at its dust threshold where its covenant lets the value rise.
 *
 * Only an output carrying an NFT is raised: a record, a chunk, a mapping node or an event. A plain output is a value
 * send or a satoshi container, whose amount is the contract's own accounting, and a state record's value is pinned
 * by its covenant, so both are returned unchanged.
 */
export function recordFundedAtLeastDust<T extends DraftSourceOutput>(output: T): T {
  if (output.token?.nft === undefined || output.token.nft.capability === 'minting') return output;
  if (valuePinnedRecord(output)) return output;
  return fundedAtLeastDust(output);
}

/** The bytes a push of `dataBytes` bytes takes, its opcode and length included. */
function pushedBytes(dataBytes: number): number {
  if (dataBytes <= 75) return dataBytes + 1;
  if (dataBytes <= 255) return dataBytes + 2;
  return dataBytes + 3;
}

/**
 * The widest encoding a state value of `type` packs to in a data-NFT commitment, as `encodePushdataValue` writes it:
 * an integer at its bit width plus the sign bit, an address at a 35-byte lock, a `bytesN` at N bytes, each with its
 * push. Undefined for a value with no bound: unbounded bytes or a string held inline, an unbounded array, the
 * unbounded `int`, or a type this does not size.
 */
function widestEncodingBytes(
  type: string, structs: readonly StructDefinitionInfo[] | undefined, seen: ReadonlySet<string>,
): number | undefined {
  const struct = structs?.find((candidate) => candidate.name === type);
  if (struct !== undefined) {
    if (seen.has(type)) return undefined;
    const next = new Set(seen).add(type);
    let total = 0;
    for (const field of struct.fields) {
      const width = widestEncodingBytes(field.type, structs, next);
      if (width === undefined) return undefined;
      total += width;
    }
    return total;
  }
  const array = parseArrayTypeString(type);
  if (array !== undefined) {
    if (array.bound === undefined) return undefined;
    // Fixed-width elements pack at their stride, so a bounded array of them is as wide whatever it holds.
    if (isFixedWidthType(array.elementType)) {
      return encodePushdataValue(getDefaultStateValue(type, structs), type, structs).length;
    }
    const element = widestEncodingBytes(array.elementType, structs, seen);
    return element === undefined
      ? undefined : encodePushdataValue(BigInt(array.bound), 'bigint').length + array.bound * element;
  }
  if (type === 'bool') return 1;
  if (type === 'pubkey') return 34;
  if (type === 'sig') return 74;
  if (type === 'datasig') return 66;
  if (type === 'address' || type === 'address payable') return pushedBytes(35);
  const integer = type.match(/^u?int(\d+)$/) ?? type.match(/^u?fixed(\d+)x\d+$/);
  if (integer !== null) return pushedBytes(Math.ceil((Number(integer[1]) + 1) / 8));
  const fixedBytes = type.match(/^bytes(\d+)$/);
  if (fixedBytes !== null) return Number(fixedBytes[1]) === 0 ? 1 : pushedBytes(Number(fixedBytes[1]));
  return undefined;
}

/**
 * The widest commitment the state record at `nftIndex` packs to, capped at the layout's commitment limit: its index
 * tag on a layout of several data NFTs, then each of its own variables at its widest encoding, a dynamic value by
 * its uint32 length header. Undefined when one of them has no bound, a packed array blob among them.
 */
export function widestRecordCommitmentBytes(layout: StateLayout, nftIndex: number): number | undefined {
  let total = isMultiDataNftLayout(layout) ? encodeNftIndexTag(nftIndex).length : 0;
  for (const variable of layout.variables.filter((candidate) => candidate.nftIndex === nftIndex)) {
    let width: number | undefined;
    if (variable.dynamic === true) width = widestEncodingBytes(DYNAMIC_LEN_TYPE, layout.structs, new Set());
    else if (variable.packed !== true) width = widestEncodingBytes(variable.type, layout.structs, new Set());
    if (width === undefined) return undefined;
    total += width;
  }
  return Math.min(total, layout.commitmentLimit);
}
