/**
 * The block-info oracle is one raw covenant, not a stateful contract.
 *
 * Its NFT commitment is the whole record. The first 20 bytes are the owner's public-key hash. The fields
 * after that are the block data. A reader never calls the oracle: it co-spends the UTXO and slices the
 * commitment. The owner updates it by spending the same covenant with a signature that matches that hash.
 * The owner is not baked into the script, so one bytecode serves every operator; the category is baked so
 * the locking bytecode identifies this oracle token.
 *
 * Readers pin only the lock, so the bounds below hold for exactly one record: the genesis must mint one
 * mutable NFT of the category and no minting NFT.
 */
import { encodeDataPush } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/push.js';
import { encodeInt } from './data.js';
import { hash160, sha256 } from './hash.js';
import { Op, type Script, scriptToBytecode } from './script.js';

/** Owner public-key hash at the front of the commitment. Sigcheck is hash160(pubkey) against these bytes. */
export const BLOCK_ORACLE_OWNER_BYTES = 20;

/**
 * Each numeric field is 4 little-endian bytes plus a trailing 0x00, so OP_BIN2NUM reads a non-negative
 * script number for every uint32.
 */
export const BLOCK_ORACLE_FIELD_WIDTH = 5;

export const BLOCK_ORACLE_FIELDS = {
  number: 0,
  timestamp: 1,
  difficulty: 2,
  size: 3,
  totalFees: 4,
} as const;

export type BlockOracleField = keyof typeof BLOCK_ORACLE_FIELDS;

/** Byte offset of a numeric field inside the commitment. */
export function blockOracleFieldOffset(field: BlockOracleField): number {
  return BLOCK_ORACLE_OWNER_BYTES + BLOCK_ORACLE_FIELD_WIDTH * BLOCK_ORACLE_FIELDS[field];
}

/** Coinbase locking bytecode follows the numeric fields: one length byte, then that many bytes. */
export const BLOCK_ORACLE_COINBASE_OFFSET = blockOracleFieldOffset('totalFees') + BLOCK_ORACLE_FIELD_WIDTH;

/** 35-byte stand-in a reader pushes for the oracle lock. Deployment replaces it with the real p2sh32 lock. */
export const BLOCK_ORACLE_LOCK_SENTINEL = Uint8Array.from([
  0xa3,
  ...new Uint8Array(34).fill(0x5c),
]);

export interface BlockOracleCommitmentFields {
  number: bigint;
  timestamp: bigint;
  difficulty: bigint;
  size: bigint;
  totalFees: bigint;
  coinbase: Uint8Array;
}

function encodeField(value: bigint): Uint8Array {
  if (value < 0n || value >= 2n ** 32n) {
    throw new Error(`block oracle field ${value} does not fit in a uint32`);
  }
  const out = new Uint8Array(BLOCK_ORACLE_FIELD_WIDTH);
  let remaining = value;
  for (let index = 0; index < 4; index += 1) {
    out[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return out;
}

/** Commitment bytes: owner hash, then the block fields, then the coinbase locking bytecode. */
export function encodeBlockOracleCommitment(
  ownerPkh: Uint8Array,
  fields: BlockOracleCommitmentFields,
): Uint8Array {
  if (ownerPkh.length !== BLOCK_ORACLE_OWNER_BYTES) {
    throw new Error(`block oracle owner hash is ${BLOCK_ORACLE_OWNER_BYTES} bytes`);
  }
  if (fields.coinbase.length > 80) {
    throw new Error('block oracle coinbase locking bytecode exceeds 80 bytes');
  }
  return Uint8Array.from([
    ...ownerPkh,
    ...encodeField(fields.number),
    ...encodeField(fields.timestamp),
    ...encodeField(fields.difficulty),
    ...encodeField(fields.size),
    ...encodeField(fields.totalFees),
    fields.coinbase.length,
    ...fields.coinbase,
  ]);
}

export function blockOracleOwnerPkh(commitment: Uint8Array): Uint8Array {
  return commitment.slice(0, BLOCK_ORACLE_OWNER_BYTES);
}

/** Numeric field as the 5-byte script number stored in the commitment. */
export function blockOracleFieldBytes(commitment: Uint8Array, field: BlockOracleField): Uint8Array {
  const offset = blockOracleFieldOffset(field);
  return commitment.slice(offset, offset + BLOCK_ORACLE_FIELD_WIDTH);
}

/** Numeric field as the uint32 its first four little-endian bytes hold. */
export function blockOracleFieldValue(commitment: Uint8Array, field: BlockOracleField): bigint {
  const bytes = blockOracleFieldBytes(commitment, field);
  let value = 0n;
  for (let index = 0; index < 4; index += 1) value |= BigInt(bytes[index] ?? 0) << BigInt(8 * index);
  return value;
}

function preserveOutput(includeCommitment: boolean): Script {
  const script: Script = [
    Op.OP_INPUTINDEX, Op.OP_UTXOBYTECODE, Op.OP_INPUTINDEX, Op.OP_OUTPUTBYTECODE, Op.OP_EQUALVERIFY,
    Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCATEGORY, Op.OP_INPUTINDEX, Op.OP_OUTPUTTOKENCATEGORY, Op.OP_EQUALVERIFY,
  ];
  if (includeCommitment) {
    script.push(
      Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCOMMITMENT,
      Op.OP_INPUTINDEX, Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_EQUALVERIFY,
    );
  }
  return script;
}

/** `[commitment] -> [number bytes, timestamp bytes]`. The two fields are adjacent. */
function splitNumberAndTimestamp(): Script {
  return [
    encodeInt(BigInt(blockOracleFieldOffset('number'))), Op.OP_SPLIT, Op.OP_NIP,
    encodeInt(BigInt(2 * BLOCK_ORACLE_FIELD_WIDTH)), Op.OP_SPLIT, Op.OP_DROP,
    encodeInt(BigInt(BLOCK_ORACLE_FIELD_WIDTH)), Op.OP_SPLIT,
  ];
}

/** A nLockTime at or above this is a time, below it a height. */
const LOCKTIME_THRESHOLD = 500_000_000n;

/**
 * Raw redeem script. Unlocking is `<pubkey> <sig> <newCommitment> <flag>`.
 * Flag 0 recreates the commitment. Flag 1 replaces it when the signature matches the owner hash already
 * stored there and the new commitment keeps that same hash. nLockTime is a height or a time, so one update
 * anchors one field to the chain and keeps the other:
 *  - height-type nLockTime: `number` is below 500000000, does not rewind, and `tx.time >= number`;
 *    `timestamp` is unchanged;
 *  - time-type nLockTime: `timestamp` does not rewind and `tx.time >= timestamp`, which is final only below
 *    the median time past; `number` is unchanged.
 */
export function buildBlockOracleCovenantScript(categoryId: Uint8Array): Script {
  if (categoryId.length !== 32) throw new Error('block oracle category is 32 bytes');
  if (blockOracleFieldOffset('timestamp') !== blockOracleFieldOffset('number') + BLOCK_ORACLE_FIELD_WIDTH) {
    throw new Error('block oracle timestamp must follow number');
  }
  const category = categoryId.slice().reverse();
  return [
    Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCATEGORY,
    encodeInt(32n), Op.OP_SPLIT, Op.OP_SWAP,
    category, Op.OP_EQUALVERIFY,
    encodeInt(1n), Op.OP_EQUALVERIFY,
    Op.OP_IF,
    Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCOMMITMENT,
    encodeInt(BigInt(BLOCK_ORACLE_OWNER_BYTES)), Op.OP_SPLIT, Op.OP_DROP,
    Op.OP_DUP,
    encodeInt(2n), Op.OP_PICK,
    encodeInt(BigInt(BLOCK_ORACLE_OWNER_BYTES)), Op.OP_SPLIT, Op.OP_DROP,
    Op.OP_EQUALVERIFY,
    encodeInt(3n), Op.OP_PICK, Op.OP_HASH160, Op.OP_EQUALVERIFY,
    Op.OP_ROT, Op.OP_ROT, Op.OP_SWAP, Op.OP_CHECKSIGVERIFY,
    // [new, newNumber, newTime, number, time]
    Op.OP_DUP, ...splitNumberAndTimestamp(),
    Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCOMMITMENT, ...splitNumberAndTimestamp(),
    Op.OP_TXLOCKTIME, encodeInt(LOCKTIME_THRESHOLD), Op.OP_LESSTHAN,
    Op.OP_IF,
    // Height: the timestamp stays, and the number is a height that does not rewind. [new, newNumber]
    Op.OP_ROT, Op.OP_EQUALVERIFY,
    Op.OP_BIN2NUM, Op.OP_SWAP, Op.OP_BIN2NUM, Op.OP_TUCK, Op.OP_LESSTHANOREQUAL, Op.OP_VERIFY,
    Op.OP_DUP, encodeInt(LOCKTIME_THRESHOLD), Op.OP_LESSTHAN, Op.OP_VERIFY,
    Op.OP_ELSE,
    // Time: the number stays, and the timestamp does not rewind. [new, newTime]
    Op.OP_SWAP, encodeInt(3n), Op.OP_ROLL, Op.OP_EQUALVERIFY,
    Op.OP_BIN2NUM, Op.OP_SWAP, Op.OP_BIN2NUM, Op.OP_TUCK, Op.OP_LESSTHANOREQUAL, Op.OP_VERIFY,
    Op.OP_ENDIF,
    // The anchored field is not ahead of the chain. CLTV refuses an operand of the other locktime type.
    Op.OP_CHECKLOCKTIMEVERIFY, Op.OP_DROP,
    Op.OP_INPUTINDEX, Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_EQUALVERIFY,
    ...preserveOutput(false),
    Op.OP_ELSE,
    Op.OP_DROP, Op.OP_2DROP,
    ...preserveOutput(true),
    Op.OP_ENDIF,
    Op.OP_1,
  ];
}

export function blockOracleRedeemScript(categoryId: Uint8Array): Uint8Array {
  return scriptToBytecode(buildBlockOracleCovenantScript(categoryId));
}

/** p2sh32 locking bytecode of the oracle covenant for `categoryId`. */
export function blockOracleLockingBytecode(categoryId: Uint8Array): Uint8Array {
  const scriptHash = sha256(sha256(blockOracleRedeemScript(categoryId)));
  return Uint8Array.from([0xaa, 0x20, ...scriptHash, 0x87]);
}

/** Read-path unlocking: three empty pushes and flag 0, under the redeem script. */
export function blockOracleReadUnlocking(categoryId: Uint8Array): Uint8Array {
  const redeem = blockOracleRedeemScript(categoryId);
  return scriptToBytecode([
    encodeInt(0n), encodeInt(0n), encodeInt(0n), encodeInt(0n), redeem,
  ]);
}

/** Update-path unlocking. `signature` includes its sighash byte. */
export function blockOracleUpdateUnlocking(
  categoryId: Uint8Array,
  pubkey: Uint8Array,
  signature: Uint8Array,
  newCommitment: Uint8Array,
): Uint8Array {
  if (pubkey.length !== 33 || hash160(pubkey).length !== BLOCK_ORACLE_OWNER_BYTES) {
    throw new Error('block oracle pubkey is not a compressed key');
  }
  return scriptToBytecode([
    pubkey, signature, newCommitment, encodeInt(1n), blockOracleRedeemScript(categoryId),
  ]);
}

/** Offsets of the direct push of the reader lock sentinel. The offset is the opcode byte. */
export function findBlockOracleLockSlots(program: Uint8Array): number[] {
  const slots: number[] = [];
  const needle = BLOCK_ORACLE_LOCK_SENTINEL;
  for (let index = 0; index + 1 + needle.length <= program.length; index += 1) {
    if (program[index] !== needle.length) continue;
    let same = true;
    for (let byte = 0; byte < needle.length; byte += 1) {
      if (program[index + 1 + byte] !== needle[byte]) {
        same = false;
        break;
      }
    }
    if (same) slots.push(index);
  }
  return slots;
}

/** Write the real oracle lock over every sentinel push. */
export function applyBlockOracleLock(
  program: Uint8Array,
  lock: Uint8Array,
  slots: readonly number[],
): Uint8Array {
  if (lock.length !== BLOCK_ORACLE_LOCK_SENTINEL.length) {
    throw new Error(`block oracle lock is ${BLOCK_ORACLE_LOCK_SENTINEL.length} bytes`);
  }
  const out = program.slice();
  for (const offset of slots) {
    out.set(lock, offset + 1);
  }
  return out;
}

/** A push of `payload` followed by the redeem script, for tests that build the unlocking by hand. */
export function pushThenRedeem(payloads: readonly Uint8Array[], redeem: Uint8Array): Uint8Array {
  return Uint8Array.from([
    ...payloads.flatMap((payload) => [...encodeDataPush(payload)]),
    ...encodeDataPush(redeem),
  ]);
}
