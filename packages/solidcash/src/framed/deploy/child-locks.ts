/**
 * Filling the constants a creator's genesis replay names for the child it creates (docs/framed/CREATE2_IDENTITY.md,
 * "The genesis replay").
 *
 * A creating body requires the outputs of the child's category to be exactly the child's genesis, and computes most
 * of that genesis itself. What its compile unit cannot know, its deployment fills into placeholder pushes: the chain
 * over the child's masters (from the child's entry locks and how many masters a creation funds at each), how many
 * validators a creation funds, and the hashes of the child's sorted collections. They are the same for every category
 * the child is created as.
 *
 * The master-lock and category-output-count placeholders of creators compiled before the replay are filled here too
 * (`patchChildLockSentinels`, `patchChildOutputCount`); a creator compiled with the replay reserves neither.
 */

import {
  CHILD_COLLECTION_CAPACITY, CHILD_LOCK_CAPACITY, ChildOutputCountError, childCollectionFiller,
  childCollectionSentinel, childLockFiller, childLockSentinel, childMastersDigest, childMastersDigestSentinel,
  patchChildOutputCount as patchOutputCountScript, patchChildValidatorCount as patchValidatorCountScript,
  type Artifact,
} from '@solidcash/utils';
import { asmToBytecode, bytecodeToAsm } from '@solidcash/utils';

/** What a creator's deployment fills into its genesis replay, for one child. */
export interface ChildGenesisSlots {
  /** The child's entry locks, in the order a creation mints their masters. */
  readonly locks: readonly Uint8Array[];
  /** The pool each creation funds: masters per entry lock, and validators. */
  readonly pool: { readonly masters: number; readonly validators: number };
  /** The 20-byte hashes of the child's sorted collections, in the order its artifact publishes them. */
  readonly collections?: readonly Uint8Array[];
}

/** What a creator's program reserves of the replay's placeholders. */
export interface ChildGenesisReservation {
  /** Whether it replays a child's genesis at all: it reserves the masters' chain. */
  readonly replays: boolean;
  /** How many collection hashes it reserves. */
  readonly collections: number;
}

/** The replay placeholders `artifact`'s program reserves. */
export function childGenesisReservation(artifact: Artifact): ChildGenesisReservation {
  const program = Uint8Array.from(asmToBytecode(artifact.bytecode));
  let collections = 0;
  while (collections < CHILD_COLLECTION_CAPACITY
    && findPushes(program, childCollectionSentinel(collections)).length > 0) collections += 1;
  return {
    replays: findPushes(program, childMastersDigestSentinel()).length > 0,
    collections,
  };
}

/**
 * A clone of `artifact` with its genesis replay's placeholders filled from `slots`; an artifact that reserves none is
 * returned unchanged. A child whose collections do not match what the creator reserves is refused by name: every
 * creation of it would be refused on chain.
 */
export function patchChildGenesisSlots(artifact: Artifact, slots: ChildGenesisSlots): Artifact {
  const reserved = childGenesisReservation(artifact);
  if (!reserved.replays) return artifact;
  const collections = slots.collections ?? [];
  if (collections.length !== reserved.collections) {
    throw new ChildLockSlotError(
      `the child has ${collections.length} sorted collections, and "${artifact.contractName}" replays the empty heads `
      + `of ${reserved.collections}: the creator was compiled against another child`,
    );
  }
  if (!Number.isInteger(slots.pool.validators) || slots.pool.validators < 1) {
    throw new ChildLockSlotError(`a creation funds at least one validator: got ${slots.pool.validators}`);
  }
  let program: Uint8Array = Uint8Array.from(asmToBytecode(artifact.bytecode));
  program = fillPushes(program, childMastersDigestSentinel(), childMastersDigest(slots.locks, slots.pool.masters));
  program = Uint8Array.from(patchValidatorCountScript(program, slots.pool.validators));
  collections.forEach((hash, slot) => {
    if (hash.length !== 20) throw new ChildLockSlotError(`a collection hash is 20 bytes: slot ${slot} holds ${hash.length}`);
    program = fillPushes(program, childCollectionSentinel(slot), hash);
  });
  const clone = structuredClone(artifact);
  clone.bytecode = bytecodeToAsm(program);
  return clone;
}

/** `program` with every direct push of `sentinel` holding `value`, which has the sentinel's width. */
function fillPushes(program: Uint8Array, sentinel: Uint8Array, value: Uint8Array): Uint8Array {
  if (value.length !== sentinel.length) {
    throw new ChildLockSlotError(`a ${sentinel.length}-byte placeholder takes a ${sentinel.length}-byte value`);
  }
  const filled = Uint8Array.from(program);
  for (const offset of findPushes(filled, sentinel)) filled.set(value, offset + 1);
  return filled;
}

/** Raised when a child does not fit the slots its creator's artifact reserved. */
export class ChildLockSlotError extends Error {
  public readonly name = 'ChildLockSlotError';
  public constructor(message: string) {
    super(message);
  }
}

/**
 * A clone of `artifact` with every child-lock sentinel of a creator compiled before the genesis replay filled; an
 * artifact without one is returned unchanged.
 */
export function patchChildLockSentinels(artifact: Artifact, locks: readonly Uint8Array[]): Artifact {
  const program = Uint8Array.from(asmToBytecode(artifact.bytecode));
  if (findPushes(program, childLockSentinel(0)).length === 0) return artifact;
  if (locks.length > CHILD_LOCK_CAPACITY) {
    throw new ChildLockSlotError(
      `the child has ${locks.length} entry locks, and its creator reserves ${CHILD_LOCK_CAPACITY}: the creator could `
      + 'not name every master it must allow',
    );
  }
  let filled = 0;
  for (let slot = 0; slot < CHILD_LOCK_CAPACITY; slot += 1) {
    const lock = locks[slot] ?? childLockFiller();
    if (lock.length !== 35) {
      throw new ChildLockSlotError(`a child lock is 35 bytes: slot ${slot} holds ${lock.length}`);
    }
    for (const offset of findPushes(program, childLockSentinel(slot))) {
      program.set(lock, offset + 1);
      filled += 1;
    }
  }
  if (filled === 0) return artifact;
  const clone = structuredClone(artifact);
  clone.bytecode = bytecodeToAsm(program);
  return clone;
}

/**
 * A clone of `artifact` whose reserved category-output count is filled with `count`.
 *
 * Only the entries that create carry the count; the rest of a creator's shards pass through unchanged.
 */
export function patchChildOutputCount(artifact: Artifact, count: number): Artifact {
  const program = Uint8Array.from(asmToBytecode(artifact.bytecode));
  let patched: Uint8Array;
  try {
    patched = patchOutputCountScript(program, count);
  } catch (error) {
    if (error instanceof ChildOutputCountError && /reserves no/.test(error.message)) return artifact;
    throw error;
  }
  const clone = structuredClone(artifact);
  clone.bytecode = bytecodeToAsm(patched);
  return clone;
}

/** Offsets of a direct push of `payload`: the opcode is at the offset, the bytes follow. */
function findPushes(program: Uint8Array, payload: Uint8Array): number[] {
  const opcode = payload.length;
  if (opcode < 1 || opcode > 0x4b) return [];
  const offsets: number[] = [];
  for (let index = 0; index + 1 + payload.length <= program.length; index += 1) {
    if (program[index] !== opcode) continue;
    let same = true;
    for (let at = 0; at < payload.length; at += 1) {
      if (program[index + 1 + at] !== payload[at]) {
        same = false;
        break;
      }
    }
    if (same) offsets.push(index);
  }
  return offsets;
}


/** A clone of `artifact` with every collection-hash sentinel filled; an artifact without one is returned unchanged. */
export function patchChildCollectionSentinels(artifact: Artifact, collections: readonly Uint8Array[]): Artifact {
  if (collections.length > CHILD_COLLECTION_CAPACITY) {
    throw new ChildLockSlotError(
      `the child has ${collections.length} sorted collections, and its creator reserves ${CHILD_COLLECTION_CAPACITY}: `
      + 'the creator could not derive every entry head it must allow',
    );
  }
  const program = Uint8Array.from(asmToBytecode(artifact.bytecode));
  let filled = 0;
  for (let slot = 0; slot < CHILD_COLLECTION_CAPACITY; slot += 1) {
    const hash = collections[slot] ?? childCollectionFiller();
    if (hash.length !== 20) {
      throw new ChildLockSlotError(`a collection hash is 20 bytes: slot ${slot} holds ${hash.length}`);
    }
    for (const offset of findPushes(program, childCollectionSentinel(slot))) {
      program.set(hash, offset + 1);
      filled += 1;
    }
  }
  if (filled === 0) return artifact;
  return { ...artifact, bytecode: bytecodeToAsm(program) } as Artifact;
}
