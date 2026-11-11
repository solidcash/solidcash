/**
 * The constants a creator's genesis replay names for the child it mints (docs/framed/CREATE2_IDENTITY.md, "The
 * genesis replay").
 *
 * A creating body requires the outputs of the child's category `K` to be exactly the genesis the folded construction
 * lays down. It folds them, last output first, into two chains of `SHA256(digest ++ capability ++ lock ++ commitment)`:
 * one over the minting NFTs (the child's masters) and one over the rest (its authhead, validators, records, heads and
 * oracle). The masters' chain names no category, since a created child's masters are constant-lock, so the creator's
 * deployment fills it as one 32-byte constant. The other chain the creating body computes itself from `K`, its own
 * address and the folded state; the deployment fills only the parts the creator's compile unit cannot know: how many
 * validators a creation funds, the hashes of the child's sorted collections, and the owner of the child's block
 * oracle.
 */

import { sha256 } from './hash.js';

/** The capability byte `OP_OUTPUTTOKENCATEGORY` appends after a mutable NFT's category. */
export const CHILD_GENESIS_MUTABLE = 0x01;
/** The capability byte `OP_OUTPUTTOKENCATEGORY` appends after a minting NFT's category. */
export const CHILD_GENESIS_MINTING = 0x02;

/** One output of the child's category, as the creator's chain reads it. */
export interface ChildGenesisChainOutput {
  /** 0x01 for a mutable NFT, 0x02 for a minting one: the only capabilities a child's genesis mints. */
  readonly capability: number;
  /** The output's 35-byte P2SH32 lock. */
  readonly lockingBytecode: Uint8Array;
  readonly commitment: Uint8Array;
}

/** One link of the creator's chain: `SHA256(digest ++ capability ++ lock ++ commitment)`. */
export function childGenesisChainStep(digest: Uint8Array, output: ChildGenesisChainOutput): Uint8Array {
  if (output.lockingBytecode.length !== 35) {
    throw new Error(`a child's genesis output sits at a 35-byte lock: got ${output.lockingBytecode.length}`);
  }
  if (output.capability !== CHILD_GENESIS_MUTABLE && output.capability !== CHILD_GENESIS_MINTING) {
    throw new Error(`a child's genesis output is a mutable or minting NFT: got capability ${output.capability}`);
  }
  return sha256(Uint8Array.from([
    ...digest, output.capability, ...output.lockingBytecode, ...output.commitment,
  ]));
}

/**
 * The digest every chain starts from: 32 zero bytes. Every link then hashes a 32-byte digest before its item, so a
 * chain over one sequence of outputs is no chain over another (the first link of a chain started from nothing would
 * hash a bare item, which a composer could write as the digest of the first item followed by the second).
 */
export function childGenesisChainStart(): Uint8Array {
  return new Uint8Array(32);
}

/**
 * The chain over `outputs` given in transaction order, folded as the creator reads them: last output first, from
 * `childGenesisChainStart`. An empty list folds to that start.
 */
export function childGenesisChain(outputs: readonly ChildGenesisChainOutput[]): Uint8Array {
  let digest: Uint8Array = childGenesisChainStart();
  for (let index = outputs.length - 1; index >= 0; index -= 1) {
    digest = childGenesisChainStep(digest, outputs[index]!);
  }
  return digest;
}

/**
 * The masters' chain a creator's deployment fills: `mastersPerLock` empty minting NFTs at each of the child's entry
 * locks, laid out lock by lock in the order given, as a creation mints them.
 */
export function childMastersDigest(locks: readonly Uint8Array[], mastersPerLock: number): Uint8Array {
  if (!Number.isInteger(mastersPerLock) || mastersPerLock < 1) {
    throw new Error(`a creation mints at least one master per entry lock: got ${mastersPerLock}`);
  }
  if (locks.length === 0) throw new Error('a child has at least one entry lock');
  return childGenesisChain(locks.flatMap((lock) => Array.from({ length: mastersPerLock }, () => ({
    capability: CHILD_GENESIS_MINTING, lockingBytecode: lock, commitment: new Uint8Array(),
  }))));
}

/** The 32-byte placeholder push a creator reserves for its child's masters' chain. */
export function childMastersDigestSentinel(): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes[0] = 0xc1;
  bytes[1] = 0xad;
  for (let at = 2; at < 32; at += 1) bytes[at] = (0xd7 + at * 0x0b) & 0xff;
  return bytes;
}

/**
 * The placeholder a creator reserves for how many validators each creation of its child funds, filled at deployment
 * like the category-output count before it (a 3-byte push the body reads with `OP_BIN2NUM`).
 */
export const CHILD_VALIDATOR_COUNT_SENTINEL = 0x2dc5;

/** The 3-byte push a creator reserves for its child's validator count. */
export function childValidatorCountSentinel(): Uint8Array {
  return Uint8Array.from([0x02, CHILD_VALIDATOR_COUNT_SENTINEL & 0xff, CHILD_VALIDATOR_COUNT_SENTINEL >> 8]);
}

/** Fills the creator's reserved validator count, which its replay folds the child's validators by. */
export function patchChildValidatorCount(script: Uint8Array, count: number): Uint8Array {
  if (!Number.isInteger(count) || count < 1 || count > 0xffff) {
    throw new ChildOutputCountError(`a creation funds 1..65535 validators: got ${count}`);
  }
  return patchCountPush(script, childValidatorCountSentinel(), count, 'validator count');
}

/*
 * The master locks and the category-output count an earlier creator's category check named for the child it mints.
 * A creator compiled with the genesis replay reserves neither: it names its child's masters by one digest
 * (`childMastersDigestSentinel`), and the replay fixes how many outputs of each kind the creation mints. They stay for
 * the deployments of creators compiled before it, which a deployment still fills when it finds their placeholders.
 */

/** How many master locks an earlier creator's check named (the SushiSwap pair's 23 entries and 3 cuts). */
export const CHILD_LOCK_CAPACITY = 26;

/** The 35-byte placeholder push a creator reserves for the child's `index`-th master lock. */
export function childLockSentinel(index: number): Uint8Array {
  if (!Number.isInteger(index) || index < 0 || index >= CHILD_LOCK_CAPACITY) {
    throw new Error(`a child lock sentinel is 0..${CHILD_LOCK_CAPACITY - 1}: got ${index}`);
  }
  const bytes = new Uint8Array(35);
  bytes[0] = 0xaa;
  bytes[1] = 0x20;
  bytes[2] = 0xc1;
  bytes[3] = index;
  for (let at = 4; at < 34; at += 1) bytes[at] = (0x5a + index * 0x11 + at * 7) & 0xff;
  bytes[34] = 0x87;
  return bytes;
}

/** The lock an unused slot is filled with: a P2SH32 of the zero hash, which no output of the child's carries. */
export function childLockFiller(): Uint8Array {
  return Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32), 0x87]);
}

/**
 * The placeholder push a creator reserves for the number of outputs of the child's category its genesis mints.
 *
 * The count depends on the child's entry locks, pool and records, which a creating contract's compile unit does not
 * know; the deployment fills it beside the master locks.
 */
export const CHILD_OUTPUT_COUNT_SENTINEL = 0x2dc1;

/**
 * How many sorted collections of a child a creator's replay derives an empty head's lock for.
 *
 * A child's empty heads are minted at its genesis and sit at each collection's entry covenant, whose lock takes the
 * category `K`; the replay derives those locks from `K` and a collection hash the deployment fills. The compiler
 * reserves one slot per sorted collection of the child, and refuses a child with more than this many; a deployment
 * whose child names another number of collections than the slots its creator reserves is refused by name.
 */
export const CHILD_COLLECTION_CAPACITY = 4;

/** The 20-byte placeholder push a creator reserves for the child's `index`-th sorted collection hash. */
export function childCollectionSentinel(index: number): Uint8Array {
  if (!Number.isInteger(index) || index < 0 || index >= CHILD_COLLECTION_CAPACITY) {
    throw new Error(`a child collection sentinel is 0..${CHILD_COLLECTION_CAPACITY - 1}: got ${index}`);
  }
  const bytes = new Uint8Array(20);
  for (let at = 0; at < 20; at += 1) bytes[at] = (0xc3 + index * 0x1d + at * 5) & 0xff;
  return bytes;
}

/** The hash an unused slot is filled with, which derives no output's lock. */
export function childCollectionFiller(): Uint8Array {
  return new Uint8Array(20);
}

/** The 3-byte push a creator reserves for the child's category-output count. */
export function childOutputCountSentinel(): Uint8Array {
  return Uint8Array.from([0x02, CHILD_OUTPUT_COUNT_SENTINEL & 0xff, CHILD_OUTPUT_COUNT_SENTINEL >> 8]);
}

/** Raised when a creator's artifact does not reserve a category-output count. */
export class ChildOutputCountError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ChildOutputCountError';
  }
}

/**
 * Fills the creator's reserved count with the number of outputs of the child's category its genesis mints.
 *
 * The check counts those outputs and requires exactly this number, so a creating transaction that adds one — a
 * record, a master or an event it should not have — is refused.
 */
export function patchChildOutputCount(script: Uint8Array, count: number): Uint8Array {
  if (!Number.isInteger(count) || count < 0 || count > 0xffff) {
    throw new ChildOutputCountError(`a child's category-output count is 0..65535: got ${count}`);
  }
  return patchCountPush(script, childOutputCountSentinel(), count, 'category-output count');
}

/** Fills the one 3-byte count push `sentinel` names with `count`, little-endian as `OP_BIN2NUM` reads it. */
function patchCountPush(script: Uint8Array, sentinel: Uint8Array, count: number, what: string): Uint8Array {
  const patched = Uint8Array.from(script);
  let found = -1;
  for (let at = 0; at + sentinel.length <= patched.length; at += 1) {
    if (sentinel.every((byte, offset) => patched[at + offset] === byte)) {
      if (found >= 0) {
        throw new ChildOutputCountError(`the artifact reserves more than one ${what}`);
      }
      found = at;
    }
  }
  if (found < 0) throw new ChildOutputCountError(`the artifact reserves no ${what}`);
  patched[found + 1] = count & 0xff;
  patched[found + 2] = (count >> 8) & 0xff;
  return patched;
}
