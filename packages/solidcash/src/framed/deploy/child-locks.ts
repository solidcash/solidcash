/**
 * Filling a creator's child-lock sentinels with the child's real master locks.
 *
 * A master's lock depends on the block oracle the deployment binds, so it exists only at deployment. The compiler
 * reserves one placeholder push per slot (`childLockSentinel`); this replaces each with the child's entry lock at that
 * slot, padding the rest with a lock no output carries. A child with more entry locks than the artifact reserved is
 * refused by name: the check could not name them, and a silent truncation would let an output pass unseen.
 */

import {
  CHILD_COLLECTION_CAPACITY, CHILD_LOCK_CAPACITY, ChildOutputCountError, childCollectionFiller,
  childCollectionSentinel, childLockFiller, childLockSentinel,
  patchChildOutputCount as patchOutputCountScript, type Artifact,
} from '@solidcash/utils';
import { asmToBytecode, bytecodeToAsm } from '@solidcash/utils';

/** Raised when a child does not fit the slots its creator's artifact reserved. */
export class ChildLockSlotError extends Error {
  public readonly name = 'ChildLockSlotError';
  public constructor(message: string) {
    super(message);
  }
}

/** A clone of `artifact` with every child-lock sentinel filled; an artifact without one is returned unchanged. */
export function patchChildLockSentinels(artifact: Artifact, locks: readonly Uint8Array[]): Artifact {
  if (locks.length > CHILD_LOCK_CAPACITY) {
    throw new ChildLockSlotError(
      `the child has ${locks.length} entry locks, and its creator reserves ${CHILD_LOCK_CAPACITY}: the creator could `
      + 'not name every master it must allow',
    );
  }
  const program = Uint8Array.from(asmToBytecode(artifact.bytecode));
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
