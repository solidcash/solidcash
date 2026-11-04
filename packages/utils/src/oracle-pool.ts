/**
 * Oracle pools. A pool is one token category P of mutable NFTs that any contract may read: block-info coins and
 * blockhash ring slots, each kind at its own covenant, and one minting baton through which the owner grows and
 * tunes the pool. Oracle coins belong to no contract.
 *
 * Readers match a coin by its category, capability and flags byte; they check no lock. So every path keeps each
 * mutable NFT of P at a pool lock, with a commitment its covenant admitted:
 *  - a spent mutable NFT may yield one NFT of its category. Each coin path but the sweep recreates the coin at its
 *    own index, which uses that allowance up, and the sweep refuses any output carrying P;
 *  - a spent minting NFT may yield any NFT of P, so every baton path walks the outputs.
 *
 * Every covenant starts with PIN(P, capability), which also salts each pool's addresses. The owner is the key hash
 * in the commitment, so one bytecode serves every operator of a pool. `categoryId` is in display order; the
 * covenants push it reversed, as OP_UTXOTOKENCATEGORY does.
 */
import { encodeInt } from './data.js';
import { hash256 } from './hash.js';
import { Op, type Script, scriptToBytecode } from './script.js';

/** Satoshis each pool coin holds. */
export const POOL_COIN_SATS = 1_200n;

/** Flags bit 7, the kind: clear for a block-info coin, set for a slot. */
export const POOL_FLAG_SLOT = 0x80;
/** Block-info flags bit 0: `number` is stopped. */
export const POOL_FLAG_NUMBER_STOPPED = 0x01;
/** Block-info flags bit 1: `timestamp` is stopped. */
export const POOL_FLAG_TIMESTAMP_STOPPED = 0x02;
/** Slot flags bit 0: the slot is stopped. */
export const POOL_FLAG_SLOT_STOPPED = 0x01;

/** Owner public-key hash. Sigcheck is hash160(pubkey) against these bytes. */
export const POOL_OWNER_BYTES = 20;

/** A ring depth is 1 to this, the EVM blockhash window: a slot write takes n' - n modulo the depth. */
export const POOL_MAX_DEPTH = 256;

/** Each block-info numeric field is 4 little-endian bytes and a 0x00, a non-negative script number. */
export const POOL_FIELD_WIDTH = 5;

/** Block-info commitment: `flags || owner || number || timestamp || difficulty || size || totalFees || coinbase`. */
export const POOL_INFO_OFFSETS = {
  flags: 0, owner: 1, number: 21, timestamp: 26, difficulty: 31, size: 36, totalFees: 41, coinbase: 46,
} as const;

/** Slot commitment: `flags || n (4 LE) || hash || owner || depth (2 LE)`. */
export const POOL_SLOT_OFFSETS = { flags: 0, n: 1, hash: 5, owner: 37, depth: 57 } as const;
export const POOL_SLOT_COMMITMENT_BYTES = 59;

/** Baton commitment: `owner || depth (2 LE)`, the tail every slot of the pool carries. */
export const POOL_BATON_COMMITMENT_BYTES = 22;

const MAX_COMMITMENT_BYTES = 128;

/** A nLockTime at or above this is a time, below it a height. */
const LOCKTIME_THRESHOLD = 500_000_000n;

const MUTABLE = 0x01;
const MINTING = 0x02;

/** Selectors of the info and slot covenants. 4 and above read. */
const COIN_PATH = { sweep: 0, update: 1, stop: 2, rotate: 3, read: 4 } as const;
/** Selectors of the baton covenant. */
const BATON_PATH = { sweep: 0, mint: 1, update: 2 } as const;

export interface PoolInfoFields {
  flags: number;
  owner: Uint8Array;
  number: bigint;
  timestamp: bigint;
  difficulty: bigint;
  size: bigint;
  totalFees: bigint;
  /** Coinbase output locking bytecode. */
  coinbase: Uint8Array;
}

export interface PoolSlotFields {
  flags: number;
  n: bigint;
  hash: Uint8Array;
  owner: Uint8Array;
  depth: number;
}

export interface PoolBatonFields {
  owner: Uint8Array;
  depth: number;
}

function littleEndian(value: bigint, width: number, what: string): Uint8Array {
  if (value < 0n || value >= 1n << BigInt(8 * width)) {
    throw new Error(`oracle pool ${what} ${value} does not fit in ${width} bytes`);
  }
  const out = new Uint8Array(width);
  let rest = value;
  for (let index = 0; index < width; index += 1) {
    out[index] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  return out;
}

function littleEndianValue(bytes: Uint8Array): bigint {
  let value = 0n;
  for (let index = bytes.length - 1; index >= 0; index -= 1) value = (value << 8n) | BigInt(bytes[index] ?? 0);
  return value;
}

function checkFlags(flags: number): void {
  if (!Number.isInteger(flags) || flags < 0 || flags > 0xff) throw new Error(`oracle pool flags ${flags} are not a byte`);
}

function checkOwner(owner: Uint8Array): void {
  if (owner.length !== POOL_OWNER_BYTES) throw new Error(`oracle pool owner hash is ${POOL_OWNER_BYTES} bytes`);
}

function encodeDepth(depth: number): Uint8Array {
  if (!Number.isInteger(depth) || depth < 1 || depth > POOL_MAX_DEPTH) {
    throw new Error(`oracle pool depth ${depth} is not an integer from 1 to ${POOL_MAX_DEPTH}`);
  }
  return littleEndian(BigInt(depth), 2, 'depth');
}

/** A numeric field as the commitment stores it: 4 little-endian bytes and a 0x00. */
function encodeInfoField(value: bigint, what: string): Uint8Array {
  return Uint8Array.from([...littleEndian(value, 4, what), 0]);
}

export function encodePoolInfoCommitment(fields: PoolInfoFields): Uint8Array {
  checkFlags(fields.flags);
  checkOwner(fields.owner);
  const commitment = Uint8Array.from([
    fields.flags,
    ...fields.owner,
    ...encodeInfoField(fields.number, 'number'),
    ...encodeInfoField(fields.timestamp, 'timestamp'),
    ...encodeInfoField(fields.difficulty, 'difficulty'),
    ...encodeInfoField(fields.size, 'size'),
    ...encodeInfoField(fields.totalFees, 'totalFees'),
    fields.coinbase.length,
    ...fields.coinbase,
  ]);
  if (commitment.length > MAX_COMMITMENT_BYTES) {
    throw new Error(`oracle pool block-info commitment exceeds ${MAX_COMMITMENT_BYTES} bytes`);
  }
  return commitment;
}

export function decodePoolInfoCommitment(commitment: Uint8Array): PoolInfoFields {
  const coinbaseLength = commitment[POOL_INFO_OFFSETS.coinbase];
  if (coinbaseLength === undefined || commitment.length !== POOL_INFO_OFFSETS.coinbase + 1 + coinbaseLength) {
    throw new Error('not an oracle pool block-info commitment');
  }
  const field = (offset: number): bigint => {
    if (commitment[offset + 4] !== 0) throw new Error('not an oracle pool block-info commitment');
    return littleEndianValue(commitment.slice(offset, offset + 4));
  };
  return {
    flags: commitment[POOL_INFO_OFFSETS.flags] ?? 0,
    owner: commitment.slice(POOL_INFO_OFFSETS.owner, POOL_INFO_OFFSETS.number),
    number: field(POOL_INFO_OFFSETS.number),
    timestamp: field(POOL_INFO_OFFSETS.timestamp),
    difficulty: field(POOL_INFO_OFFSETS.difficulty),
    size: field(POOL_INFO_OFFSETS.size),
    totalFees: field(POOL_INFO_OFFSETS.totalFees),
    coinbase: commitment.slice(POOL_INFO_OFFSETS.coinbase + 1),
  };
}

export function encodePoolSlotCommitment(fields: PoolSlotFields): Uint8Array {
  checkFlags(fields.flags);
  checkOwner(fields.owner);
  if (fields.hash.length !== 32) throw new Error('oracle pool slot hash is 32 bytes');
  return Uint8Array.from([
    fields.flags,
    ...littleEndian(fields.n, 4, 'slot n'),
    ...fields.hash,
    ...fields.owner,
    ...encodeDepth(fields.depth),
  ]);
}

export function decodePoolSlotCommitment(commitment: Uint8Array): PoolSlotFields {
  if (commitment.length !== POOL_SLOT_COMMITMENT_BYTES) throw new Error('not an oracle pool slot commitment');
  return {
    flags: commitment[POOL_SLOT_OFFSETS.flags] ?? 0,
    n: littleEndianValue(commitment.slice(POOL_SLOT_OFFSETS.n, POOL_SLOT_OFFSETS.hash)),
    hash: commitment.slice(POOL_SLOT_OFFSETS.hash, POOL_SLOT_OFFSETS.owner),
    owner: commitment.slice(POOL_SLOT_OFFSETS.owner, POOL_SLOT_OFFSETS.depth),
    depth: Number(littleEndianValue(commitment.slice(POOL_SLOT_OFFSETS.depth))),
  };
}

export function encodePoolBatonCommitment(fields: PoolBatonFields): Uint8Array {
  checkOwner(fields.owner);
  return Uint8Array.from([...fields.owner, ...encodeDepth(fields.depth)]);
}

export function decodePoolBatonCommitment(commitment: Uint8Array): PoolBatonFields {
  if (commitment.length !== POOL_BATON_COMMITMENT_BYTES) throw new Error('not an oracle pool baton commitment');
  return {
    owner: commitment.slice(0, POOL_OWNER_BYTES),
    depth: Number(littleEndianValue(commitment.slice(POOL_OWNER_BYTES))),
  };
}

function vmCategory(categoryId: Uint8Array): Uint8Array {
  if (categoryId.length !== 32) throw new Error('oracle pool category is 32 bytes');
  return categoryId.slice().reverse();
}

/** The hidden bytes32 contract parameter that binds a direct reader to its pool. */
export const ORACLE_POOL_PARAMETER = '__oraclePool';

/** The value a reader binds: P as OP_UTXOTOKENCATEGORY pushes it, the display-order id reversed. */
export function oraclePoolBinding(categoryId: Uint8Array): Uint8Array {
  return vmCategory(categoryId);
}

/** 32-byte stand-in for P in a framed reader, which pushes it with the mutable capability after it. */
export const ORACLE_POOL_SENTINEL = Uint8Array.from([0xa5, ...new Uint8Array(31).fill(0x5c)]);

const ORACLE_POOL_SLOT_PUSH = Uint8Array.from([0x21, ...ORACLE_POOL_SENTINEL, MUTABLE]);

/** Offsets of each `push(sentinel || 0x01)` in a framed reader. The offset is the push opcode; P follows it. */
export function findOraclePoolSlots(program: Uint8Array): number[] {
  const slots: number[] = [];
  for (let index = 0; index + ORACLE_POOL_SLOT_PUSH.length <= program.length; index += 1) {
    let same = true;
    for (let byte = 0; byte < ORACLE_POOL_SLOT_PUSH.length; byte += 1) {
      if (program[index + byte] !== ORACLE_POOL_SLOT_PUSH[byte]) {
        same = false;
        break;
      }
    }
    if (same) slots.push(index);
  }
  return slots;
}

/** Writes `oraclePoolBinding(categoryId)` over every slot. */
export function applyOraclePool(program: Uint8Array, categoryId: Uint8Array, slots: readonly number[]): Uint8Array {
  const binding = oraclePoolBinding(categoryId);
  const out = program.slice();
  for (const offset of slots) {
    if (out[offset] !== ORACLE_POOL_SLOT_PUSH[0] || out[offset + 1 + binding.length] !== MUTABLE) {
      throw new Error(`no oracle pool slot at ${offset}`);
    }
    out.set(binding, offset + 1);
  }
  return out;
}

/** PIN(P, capability): this coin is an NFT of P with that capability. */
function pin(categoryId: Uint8Array, capability: number): Script {
  return [
    Uint8Array.from([...vmCategory(categoryId), capability]),
    Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCATEGORY, Op.OP_EQUALVERIFY,
  ];
}

/** `[category]` -> `[the 32 category bytes]`, without the capability. */
const categoryPrefix: Script = [encodeInt(32n), Op.OP_SPLIT, Op.OP_DROP];

/** `[]` -> `[P]`, from this coin's own category. */
const poolCategory: Script = [Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCATEGORY, ...categoryPrefix];

/** `[.., sig, pubkey]` -> `[..]`: the key hashes to the owner at `offset` in this coin's commitment, and signed. */
function ownerCheck(offset: number): Script {
  return [
    Op.OP_DUP, Op.OP_HASH160,
    Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCOMMITMENT,
    ...(offset === 0 ? [] : [encodeInt(BigInt(offset)), Op.OP_SPLIT, Op.OP_NIP]),
    encodeInt(BigInt(POOL_OWNER_BYTES)), Op.OP_SPLIT, Op.OP_DROP,
    Op.OP_EQUALVERIFY, Op.OP_CHECKSIGVERIFY,
  ];
}

/** `[]` -> `[1]`: no output carries a token of P. */
const sweepWalk: Script = [
  Op.OP_TXOUTPUTCOUNT,
  Op.OP_BEGIN,
  Op.OP_1SUB, Op.OP_DUP, Op.OP_OUTPUTTOKENCATEGORY, Op.OP_SIZE,
  Op.OP_IF,
  ...categoryPrefix, ...poolCategory, Op.OP_EQUAL, Op.OP_NOT, Op.OP_VERIFY,
  Op.OP_ELSE,
  Op.OP_DROP,
  Op.OP_ENDIF,
  Op.OP_DUP, Op.OP_NOT,
  Op.OP_UNTIL,
  // The index ends at 0.
  Op.OP_NOT,
];

/** `[expected]` -> `[ok]`: the output at this index is the coin with commitment `expected` and at least its value. */
const recreation: Script = [
  Op.OP_INPUTINDEX, Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_EQUALVERIFY,
  Op.OP_INPUTINDEX, Op.OP_UTXOBYTECODE, Op.OP_INPUTINDEX, Op.OP_OUTPUTBYTECODE, Op.OP_EQUALVERIFY,
  Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCATEGORY, Op.OP_INPUTINDEX, Op.OP_OUTPUTTOKENCATEGORY, Op.OP_EQUALVERIFY,
  Op.OP_INPUTINDEX, Op.OP_OUTPUTVALUE, Op.OP_INPUTINDEX, Op.OP_UTXOVALUE, Op.OP_GREATERTHANOREQUAL,
];

/** `[]` -> `[expected]`: this coin's commitment with the stop bits `mask` set. */
function stopped(mask: number): Script {
  return [
    Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCOMMITMENT, Op.OP_1, Op.OP_SPLIT,
    Op.OP_SWAP, encodeInt(BigInt(mask)), Op.OP_OR, Op.OP_SWAP, Op.OP_CAT,
  ];
}

/** `[owner']` -> `[expected]`: this coin's commitment with the owner hash at `offset` replaced. */
function rotated(offset: number): Script {
  return [
    Op.OP_SIZE, encodeInt(BigInt(POOL_OWNER_BYTES)), Op.OP_NUMEQUALVERIFY,
    Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCOMMITMENT,
    encodeInt(BigInt(offset)), Op.OP_SPLIT, encodeInt(BigInt(POOL_OWNER_BYTES)), Op.OP_SPLIT, Op.OP_NIP,
    Op.OP_ROT, Op.OP_SWAP, Op.OP_CAT, Op.OP_CAT,
  ];
}

/**
 * Shared shape of the info and slot covenants. An empty unlocking reads; an owner path unlocks with
 * `<args> <selector> <sig> <pubkey>`. Every path but the sweep ends in the recreation at this index.
 */
function poolCoinScript(categoryId: Uint8Array, ownerOffset: number, stopMask: number, update: Script): Script {
  return [
    ...pin(categoryId, MUTABLE),
    Op.OP_DEPTH,
    Op.OP_IF,
    ...ownerCheck(ownerOffset),
    Op.OP_ELSE,
    encodeInt(BigInt(COIN_PATH.read)),
    Op.OP_ENDIF,
    // [args, selector]
    Op.OP_IFDUP,
    Op.OP_NOTIF,
    ...sweepWalk,
    Op.OP_ELSE,
    Op.OP_1SUB, Op.OP_IFDUP,
    Op.OP_NOTIF,
    ...update,
    Op.OP_ELSE,
    Op.OP_1SUB, Op.OP_IFDUP,
    Op.OP_NOTIF,
    ...stopped(stopMask),
    Op.OP_ELSE,
    Op.OP_1SUB,
    Op.OP_NOTIF,
    ...rotated(ownerOffset),
    Op.OP_ELSE,
    Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCOMMITMENT,
    Op.OP_ENDIF,
    Op.OP_ENDIF,
    Op.OP_ENDIF,
    ...recreation,
    Op.OP_ENDIF,
  ];
}

/**
 * `[.., new, flags']` -> `[expected]`. Under a height-type locktime the unlocking is `<rest> <number> <flags'>` and
 * the timestamp stays; `rest` is difficulty through coinbase. Under a time-type locktime it is
 * `<timestamp> <flags'>` and every other field stays. The new field is 5 bytes, does not rewind, and CLTV bounds
 * it; CLTV also refuses an operand of the other locktime type. flags' keeps the kind bit and the unused bits clear,
 * and keeps the stop bit of the field that stays (bit 1 under a height, bit 0 under a time).
 */
const infoUpdate: Script = [
  Op.OP_DUP, Uint8Array.of(0xfc), Op.OP_AND, Uint8Array.of(0x00), Op.OP_EQUALVERIFY,
  Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCOMMITMENT, Op.OP_1, Op.OP_SPLIT, Op.OP_SWAP,
  // [.., new, flags', body, flags]. heightType + 1 is the stop bit of the field that stays.
  Op.OP_TXLOCKTIME, encodeInt(LOCKTIME_THRESHOLD), Op.OP_LESSTHAN,
  Op.OP_TUCK, Op.OP_1ADD, Op.OP_AND,
  Op.OP_3, Op.OP_PICK, Op.OP_OR, Op.OP_3, Op.OP_PICK, Op.OP_EQUALVERIFY,
  Op.OP_IF,
  // [rest, number, flags', body] -> [number, flags', owner, old number, timestamp || rest]
  encodeInt(BigInt(POOL_OWNER_BYTES)), Op.OP_SPLIT, Op.OP_5, Op.OP_SPLIT, Op.OP_5, Op.OP_SPLIT, Op.OP_DROP,
  Op.OP_5, Op.OP_ROLL, Op.OP_CAT,
  Op.OP_ELSE,
  // [timestamp, flags', body] -> [timestamp, flags', owner || number, old timestamp, rest]
  encodeInt(BigInt(POOL_INFO_OFFSETS.timestamp - 1)), Op.OP_SPLIT, Op.OP_5, Op.OP_SPLIT,
  Op.OP_ENDIF,
  // [new, flags', head, old, tail]
  Op.OP_SWAP, Op.OP_4, Op.OP_PICK,
  Op.OP_SIZE, Op.OP_5, Op.OP_NUMEQUALVERIFY,
  Op.OP_BIN2NUM, Op.OP_SWAP, Op.OP_BIN2NUM, Op.OP_OVER, Op.OP_LESSTHANOREQUAL, Op.OP_VERIFY,
  Op.OP_CHECKLOCKTIMEVERIFY, Op.OP_DROP,
  // flags' || head || new || tail
  Op.OP_TOALTSTACK, Op.OP_CAT, Op.OP_SWAP, Op.OP_CAT, Op.OP_FROMALTSTACK, Op.OP_CAT,
];

/**
 * `[hash, n']` -> `[expected]`: n' > n by a multiple of depth, n' is a height that CLTV bounds, the hash is 32 bytes.
 * The flags become the kind bit alone, which clears the stop bit; owner and depth stay.
 */
const slotWrite: Script = [
  Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCOMMITMENT, Op.OP_1, Op.OP_SPLIT, Op.OP_NIP,
  Op.OP_4, Op.OP_SPLIT, encodeInt(32n), Op.OP_SPLIT, Op.OP_NIP,
  // [hash, n', n bytes, owner || depth]
  Op.OP_DUP, encodeInt(BigInt(POOL_OWNER_BYTES)), Op.OP_SPLIT, Op.OP_NIP, Op.OP_BIN2NUM,
  Op.OP_ROT, Op.OP_BIN2NUM,
  // [hash, n', owner || depth, depth, n]
  Op.OP_3, Op.OP_PICK, Op.OP_2DUP, Op.OP_LESSTHAN, Op.OP_VERIFY,
  Op.OP_SWAP, Op.OP_SUB, Op.OP_SWAP, Op.OP_MOD, Op.OP_0, Op.OP_NUMEQUALVERIFY,
  Op.OP_OVER, encodeInt(LOCKTIME_THRESHOLD), Op.OP_LESSTHAN, Op.OP_VERIFY,
  Op.OP_SWAP, Op.OP_CHECKLOCKTIMEVERIFY, Op.OP_4, Op.OP_NUM2BIN,
  // [hash, owner || depth, n' bytes]
  Uint8Array.of(POOL_FLAG_SLOT), Op.OP_SWAP, Op.OP_CAT,
  Op.OP_ROT, Op.OP_SIZE, encodeInt(32n), Op.OP_NUMEQUALVERIFY, Op.OP_CAT,
  Op.OP_SWAP, Op.OP_CAT,
];

/**
 * Block-info covenant: `PIN(P, mutable)`, commitment `flags || owner || number || timestamp || difficulty || size
 * || totalFees || coinbase`.
 *  - read (empty unlocking): the output at this index is the exact recreation;
 *  - update `<..> <1>`: a height-locked update raises `number` and writes difficulty through coinbase, a
 *    time-locked one raises `timestamp`; see `infoUpdate`;
 *  - stop `<2>`: sets both stop bits; rotate `<owner'> <3>`; sweep `<0>`: no recreation, no output carries P.
 * Owner paths end with `<sig> <pubkey>`; every path but the sweep recreates the coin with at least its value.
 */
export function buildPoolInfoCovenantScript(categoryId: Uint8Array): Script {
  return poolCoinScript(
    categoryId, POOL_INFO_OFFSETS.owner, POOL_FLAG_NUMBER_STOPPED | POOL_FLAG_TIMESTAMP_STOPPED, infoUpdate,
  );
}

/**
 * Slot covenant: `PIN(P, mutable)`, commitment `flags || n || hash || owner || depth`.
 *  - read (empty unlocking): the output at this index is the exact recreation;
 *  - write `<hash> <n'> <1>`: see `slotWrite`;
 *  - stop `<2>`: sets the stop bit; rotate `<owner'> <3>`; sweep `<0>`: no recreation, no output carries P.
 * Owner paths end with `<sig> <pubkey>`.
 */
export function buildPoolSlotCovenantScript(categoryId: Uint8Array): Script {
  return poolCoinScript(categoryId, POOL_SLOT_OFFSETS.owner, POOL_FLAG_SLOT_STOPPED, slotWrite);
}

/**
 * Baton covenant: `PIN(P, minting)`, commitment `owner || depth`. Unlocking `<arg> <selector> <sig> <pubkey>`,
 * signed by the commitment's key.
 *  - sweep `<0>`: no output carries P;
 *  - mint `<template> <1>` and update `<commitment'> <2>` walk the outputs. An output carrying P has no fungible
 *    amount. At the baton's own index it is the recreation, checked after the walk: the commitment stays on the
 *    mint and becomes the new 22 bytes, with a depth of 1 to 256, on the update. Any other is a mutable NFT that
 *    recreates the pool coin co-spent at its index (its covenant checks it), or, on the mint only, a new pool coin:
 *    - at the info lock, a copy of the input at index `template`, a live info coin at the same lock;
 *    - at the slot lock, `0x80 || n || hash || this commitment`, with n a height that CLTV bounds.
 */
export function buildPoolBatonCovenantScript(categoryId: Uint8Array): Script {
  return [
    ...pin(categoryId, MINTING),
    ...ownerCheck(0),
    Op.OP_IFDUP,
    Op.OP_NOTIF,
    ...sweepWalk,
    Op.OP_ELSE,
    Op.OP_1, Op.OP_NUMEQUAL, Op.OP_TXOUTPUTCOUNT,
    Op.OP_BEGIN,
    // [arg, mint, i]
    Op.OP_1SUB, Op.OP_DUP, Op.OP_OUTPUTTOKENCATEGORY, Op.OP_SIZE,
    Op.OP_IF,
    encodeInt(32n), Op.OP_SPLIT, Op.OP_SWAP, ...poolCategory, Op.OP_EQUAL,
    Op.OP_IF,
    // [arg, mint, i, capability]
    Op.OP_OVER, Op.OP_OUTPUTTOKENAMOUNT, Op.OP_0, Op.OP_NUMEQUALVERIFY,
    Op.OP_OVER, Op.OP_INPUTINDEX, Op.OP_NUMEQUAL,
    Op.OP_IF,
    Op.OP_DROP,
    Op.OP_ELSE,
    Op.OP_1, Op.OP_EQUALVERIFY,
    Op.OP_DUP, Op.OP_TXINPUTCOUNT, Op.OP_LESSTHAN,
    Op.OP_IF,
    Op.OP_DUP, Op.OP_UTXOTOKENCATEGORY, Op.OP_OVER, Op.OP_OUTPUTTOKENCATEGORY, Op.OP_EQUAL,
    Op.OP_ELSE,
    Op.OP_0,
    Op.OP_ENDIF,
    Op.OP_NOTIF,
    // A new pool coin: the mint only.
    Op.OP_OVER, Op.OP_VERIFY,
    Op.OP_DUP, Op.OP_OUTPUTBYTECODE, poolInfoLockingBytecode(categoryId), Op.OP_EQUAL,
    Op.OP_IF,
    Op.OP_2, Op.OP_PICK, Op.OP_UTXOBYTECODE, Op.OP_OVER, Op.OP_OUTPUTBYTECODE, Op.OP_EQUALVERIFY,
    Op.OP_2, Op.OP_PICK, Op.OP_UTXOTOKENCOMMITMENT,
    Op.OP_DUP, Op.OP_1, Op.OP_SPLIT, Op.OP_DROP, Uint8Array.of(0x00), Op.OP_EQUALVERIFY,
    Op.OP_OVER, Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_EQUALVERIFY,
    Op.OP_ELSE,
    Op.OP_DUP, Op.OP_OUTPUTBYTECODE, poolSlotLockingBytecode(categoryId), Op.OP_EQUALVERIFY,
    Op.OP_DUP, Op.OP_OUTPUTTOKENCOMMITMENT, encodeInt(BigInt(POOL_SLOT_OFFSETS.owner)), Op.OP_SPLIT,
    Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCOMMITMENT, Op.OP_EQUALVERIFY,
    Op.OP_1, Op.OP_SPLIT, Op.OP_SWAP, Uint8Array.of(POOL_FLAG_SLOT), Op.OP_EQUALVERIFY,
    Op.OP_4, Op.OP_SPLIT, Op.OP_DROP, Op.OP_BIN2NUM,
    Op.OP_DUP, encodeInt(LOCKTIME_THRESHOLD), Op.OP_LESSTHAN, Op.OP_VERIFY,
    Op.OP_CHECKLOCKTIMEVERIFY, Op.OP_DROP,
    Op.OP_ENDIF,
    Op.OP_ENDIF,
    Op.OP_ENDIF,
    Op.OP_ELSE,
    Op.OP_DROP,
    Op.OP_ENDIF,
    Op.OP_ELSE,
    Op.OP_DROP,
    Op.OP_ENDIF,
    Op.OP_DUP, Op.OP_NOT,
    Op.OP_UNTIL,
    // [arg, mint, 0]
    Op.OP_DROP,
    Op.OP_IF,
    Op.OP_DROP, Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCOMMITMENT,
    Op.OP_ELSE,
    // owner' || depth', with depth' from 1 to POOL_MAX_DEPTH.
    Op.OP_SIZE, encodeInt(BigInt(POOL_BATON_COMMITMENT_BYTES)), Op.OP_NUMEQUALVERIFY,
    Op.OP_DUP, encodeInt(BigInt(POOL_OWNER_BYTES)), Op.OP_SPLIT, Op.OP_NIP, Op.OP_BIN2NUM,
    Op.OP_1, encodeInt(BigInt(POOL_MAX_DEPTH + 1)), Op.OP_WITHIN, Op.OP_VERIFY,
    Op.OP_ENDIF,
    ...recreation,
    Op.OP_ENDIF,
  ];
}

export function poolInfoRedeemScript(categoryId: Uint8Array): Uint8Array {
  return scriptToBytecode(buildPoolInfoCovenantScript(categoryId));
}

export function poolSlotRedeemScript(categoryId: Uint8Array): Uint8Array {
  return scriptToBytecode(buildPoolSlotCovenantScript(categoryId));
}

export function poolBatonRedeemScript(categoryId: Uint8Array): Uint8Array {
  return scriptToBytecode(buildPoolBatonCovenantScript(categoryId));
}

function p2sh32(redeem: Uint8Array): Uint8Array {
  return Uint8Array.from([0xaa, 0x20, ...hash256(redeem), 0x87]);
}

/** p2sh32 lock of the pool's block-info coins. */
export function poolInfoLockingBytecode(categoryId: Uint8Array): Uint8Array {
  return p2sh32(poolInfoRedeemScript(categoryId));
}

/** p2sh32 lock of the pool's slots. */
export function poolSlotLockingBytecode(categoryId: Uint8Array): Uint8Array {
  return p2sh32(poolSlotRedeemScript(categoryId));
}

/** p2sh32 lock of the pool's baton. */
export function poolBatonLockingBytecode(categoryId: Uint8Array): Uint8Array {
  return p2sh32(poolBatonRedeemScript(categoryId));
}

/** `<args> <selector> <sig> <pubkey> <redeem>`. `signature` includes its sighash byte. */
function ownerUnlocking(
  redeem: Uint8Array, args: readonly Uint8Array[], selector: number, pubkey: Uint8Array, signature: Uint8Array,
): Uint8Array {
  if (pubkey.length !== 33) throw new Error('oracle pool pubkey is not a compressed key');
  return scriptToBytecode([...args, encodeInt(BigInt(selector)), signature, pubkey, redeem]);
}

function checkNewOwner(owner: Uint8Array): Uint8Array {
  checkOwner(owner);
  return owner;
}

/** Read path: the redeem script alone. */
export function poolInfoReadUnlocking(categoryId: Uint8Array): Uint8Array {
  return scriptToBytecode([poolInfoRedeemScript(categoryId)]);
}

/**
 * Update path for `newCommitment` under a transaction `locktime`: below 500000000 a height update, which passes
 * the flags, number and difficulty through coinbase; else a time update, which passes the flags and timestamp.
 */
export function poolInfoUpdateUnlocking(
  categoryId: Uint8Array, pubkey: Uint8Array, signature: Uint8Array, newCommitment: Uint8Array, locktime: number,
): Uint8Array {
  const { flags, number, timestamp, difficulty } = POOL_INFO_OFFSETS;
  const flagsByte = newCommitment.slice(flags, flags + 1);
  const args = BigInt(locktime) < LOCKTIME_THRESHOLD
    ? [newCommitment.slice(difficulty), newCommitment.slice(number, timestamp), flagsByte]
    : [newCommitment.slice(timestamp, difficulty), flagsByte];
  return ownerUnlocking(poolInfoRedeemScript(categoryId), args, COIN_PATH.update, pubkey, signature);
}

export function poolInfoStopUnlocking(categoryId: Uint8Array, pubkey: Uint8Array, signature: Uint8Array): Uint8Array {
  return ownerUnlocking(poolInfoRedeemScript(categoryId), [], COIN_PATH.stop, pubkey, signature);
}

export function poolInfoSweepUnlocking(categoryId: Uint8Array, pubkey: Uint8Array, signature: Uint8Array): Uint8Array {
  return ownerUnlocking(poolInfoRedeemScript(categoryId), [], COIN_PATH.sweep, pubkey, signature);
}

export function poolInfoRotateUnlocking(
  categoryId: Uint8Array, pubkey: Uint8Array, signature: Uint8Array, newOwner: Uint8Array,
): Uint8Array {
  return ownerUnlocking(
    poolInfoRedeemScript(categoryId), [checkNewOwner(newOwner)], COIN_PATH.rotate, pubkey, signature,
  );
}

/** Read path: the redeem script alone. */
export function poolSlotReadUnlocking(categoryId: Uint8Array): Uint8Array {
  return scriptToBytecode([poolSlotRedeemScript(categoryId)]);
}

/** Write path: block `n` and its hash. The transaction's locktime is a height of at least `n`. */
export function poolSlotWriteUnlocking(
  categoryId: Uint8Array, pubkey: Uint8Array, signature: Uint8Array, n: bigint, hash: Uint8Array,
): Uint8Array {
  if (hash.length !== 32) throw new Error('oracle pool slot hash is 32 bytes');
  return ownerUnlocking(poolSlotRedeemScript(categoryId), [hash, encodeInt(n)], COIN_PATH.update, pubkey, signature);
}

export function poolSlotStopUnlocking(categoryId: Uint8Array, pubkey: Uint8Array, signature: Uint8Array): Uint8Array {
  return ownerUnlocking(poolSlotRedeemScript(categoryId), [], COIN_PATH.stop, pubkey, signature);
}

export function poolSlotSweepUnlocking(categoryId: Uint8Array, pubkey: Uint8Array, signature: Uint8Array): Uint8Array {
  return ownerUnlocking(poolSlotRedeemScript(categoryId), [], COIN_PATH.sweep, pubkey, signature);
}

export function poolSlotRotateUnlocking(
  categoryId: Uint8Array, pubkey: Uint8Array, signature: Uint8Array, newOwner: Uint8Array,
): Uint8Array {
  return ownerUnlocking(
    poolSlotRedeemScript(categoryId), [checkNewOwner(newOwner)], COIN_PATH.rotate, pubkey, signature,
  );
}

/** Mint path. `templateIndex` is the input of a live info coin to copy; a mint of slots alone ignores it. */
export function poolBatonMintUnlocking(
  categoryId: Uint8Array, pubkey: Uint8Array, signature: Uint8Array, templateIndex = 0,
): Uint8Array {
  return ownerUnlocking(
    poolBatonRedeemScript(categoryId), [encodeInt(BigInt(templateIndex))], BATON_PATH.mint, pubkey, signature,
  );
}

/** Update path: the new owner hash and depth. */
export function poolBatonUpdateUnlocking(
  categoryId: Uint8Array, pubkey: Uint8Array, signature: Uint8Array, newCommitment: Uint8Array,
): Uint8Array {
  if (newCommitment.length !== POOL_BATON_COMMITMENT_BYTES) {
    throw new Error(`oracle pool baton commitment is ${POOL_BATON_COMMITMENT_BYTES} bytes`);
  }
  return ownerUnlocking(poolBatonRedeemScript(categoryId), [newCommitment], BATON_PATH.update, pubkey, signature);
}

export function poolBatonSweepUnlocking(categoryId: Uint8Array, pubkey: Uint8Array, signature: Uint8Array): Uint8Array {
  return ownerUnlocking(poolBatonRedeemScript(categoryId), [], BATON_PATH.sweep, pubkey, signature);
}
