import type { Artifact } from '@solidcash/utils';

/** The oracle lock a deployment bakes into one artifact. The script pins this lock; readers do not call the oracle. */
const locks = new WeakMap<Artifact, Uint8Array>();

export function bindBlockOracleLock(artifact: Artifact, lock: Uint8Array): void {
  locks.set(artifact, lock);
}

export function blockOracleLockFor(artifact: Artifact): Uint8Array | undefined {
  return locks.get(artifact);
}
