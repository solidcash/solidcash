/**
 * Which master a per-entry split spends.
 *
 * A `split: 'func'` deployment mints one pool per entry, at the P2SH32 of that entry's filled redeem script.
 * The commitment stays empty, so the pool is the lock. A deployment whose masters publish no lock, or whose
 * only published lock is the one this entry filled, keeps today's pool. A lock that belongs to another entry
 * is not borrowed: the call fails before a transaction is built and names the function.
 */

import {
  asmToBytecode,
  bytecodeToAsm,
  bytesEqual,
  bytesToHex,
  type Artifact,
  type FunctionSplitBundle,
  type FunctionSplitShard,
} from '@solidcash/utils';
import type { Utxo } from '../../interfaces.js';
import { deployMaster, type DeployedMaster } from './material.js';

/** Raised when a function's own master pool cannot serve the call. */
export class FunctionSplitPoolError extends Error {
  public readonly name = 'FunctionSplitPoolError';

  public constructor(message: string) {
    super(message);
  }
}

/** The lock hex a master publishes, or `undefined` when the UTXO carries no lock. */
export function masterLockHex(utxo: Utxo): string | undefined {
  return utxo.lockingBytecode === undefined ? undefined : bytesToHex(utxo.lockingBytecode);
}

/**
 * The masters that belong to one entry.
 *
 * Masters that publish no lock are one monolith pool. One published lock is that pool only when it is
 * `filledLock`; any other single lock is another entry's and is refused. Several locks keep only
 * `filledLock`.
 */
export function mastersForEntry(
  masters: readonly Utxo[],
  filledLock: Uint8Array,
  functionName: string,
): readonly Utxo[] {
  const want = bytesToHex(filledLock);
  const published = new Set<string>();
  for (const master of masters) {
    const lock = masterLockHex(master);
    if (lock !== undefined) published.add(lock);
  }
  if (published.size === 0) return masters;
  if (published.size === 1 && published.has(want)) return masters;
  const matched = masters.filter((master) => masterLockHex(master) === want);
  if (matched.length === 0) {
    throw new FunctionSplitPoolError(`function "${functionName}" has no master in its pool`);
  }
  return matched;
}

/** The outpoint a pool tracks so a later frame of the same call does not spend the same master. */
function outpoint(utxo: Utxo): string {
  return `${utxo.txid}:${utxo.vout}`;
}

/**
 * The master one entry spends.
 *
 * `taken` lists outpoints an earlier frame of this call already claimed. An empty remainder names the
 * function and does not fall through to another entry's lock.
 */
export function masterForEntry(options: {
  readonly masters: readonly Utxo[];
  readonly filledLock: Uint8Array;
  readonly functionName: string;
  readonly taken?: ReadonlySet<string>;
}): Utxo {
  const pool = mastersForEntry(options.masters, options.filledLock, options.functionName)
    .filter((utxo) => options.taken?.has(outpoint(utxo)) !== true);
  const master = pool[0];
  if (master === undefined) {
    throw new FunctionSplitPoolError(`function "${options.functionName}" has no master in its pool`);
  }
  return master;
}

function selectorHex(selector: string): string {
  return selector.replace(/^0x/i, '').toLowerCase();
}

/** The shard whose selector is `selector`. An unknown selector fails closed and names it. */
export function requireFunctionSplitShardBySelector(
  bundle: FunctionSplitBundle,
  selector: string,
): FunctionSplitShard {
  const wanted = selectorHex(selector);
  const shard = bundle.shards.find((candidate) => candidate.selector.toLowerCase() === wanted);
  if (shard === undefined) {
    throw new FunctionSplitPoolError(
      `"${bundle.logicalContractName}" has no shard for selector ${wanted}`,
    );
  }
  return shard;
}

/**
 * The shard a call names.
 *
 * Overloads of one name are two shards, so a name that matches more than one requires `selector`.
 * A name the bundle does not publish fails closed.
 */
export function requireFunctionSplitShard(
  bundle: FunctionSplitBundle,
  functionName: string,
  selector?: string,
): FunctionSplitShard {
  if (selector !== undefined) {
    const shard = requireFunctionSplitShardBySelector(bundle, selector);
    if (shard.function !== functionName) {
      throw new FunctionSplitPoolError(
        `selector ${selectorHex(selector)} is function "${shard.function}", not "${functionName}"`,
      );
    }
    return shard;
  }
  const named = bundle.shards.filter((shard) => shard.function === functionName);
  if (named.length > 1) {
    throw new FunctionSplitPoolError(`function "${functionName}" is overloaded; pass its selector`);
  }
  const shard = named[0];
  if (shard === undefined) {
    throw new FunctionSplitPoolError(
      `"${bundle.logicalContractName}" has no shard for "${functionName}"`,
    );
  }
  return shard;
}

/**
 * The filled master of one shard: the program genesis mints, its P2SH32, and the one `addrV(category)`
 * every shard of the bundle presents.
 */
const HELPER_LOCK_PUSH = 0x23;
const HELPER_LOCK_LENGTH = 35;

/** Filled helper locks and the artifacts whose sentinels already hold them. */
export interface PreparedFunctionSplit {
  readonly locks: ReadonlyMap<string, Uint8Array>;
  readonly cutArtifacts: ReadonlyMap<string, Artifact>;
  readonly shardArtifacts: ReadonlyMap<string, Artifact>;
}

/**
 * Fills every cut, then every shard that names a cut.
 *
 * A helper that calls another cut is filled only after that cut's lock exists. A round that fills nothing
 * is a cycle and is refused. Shards with no helper slot keep their published artifact.
 */
export function prepareFunctionSplitDeployment(
  bundle: FunctionSplitBundle,
  category: Uint8Array,
  validatorProgram: Uint8Array,
): PreparedFunctionSplit {
  const locks = new Map<string, Uint8Array>();
  const cutArtifacts = new Map<string, Artifact>();
  let pending = [...bundle.internalCuts];
  let guard = pending.length;
  while (pending.length > 0) {
    if (guard < 0) {
      throw new FunctionSplitPoolError(
        `function split helper locks cycle: ${pending.map((cut) => cut.name).join(', ')}`,
      );
    }
    guard -= 1;
    const next: typeof pending = [];
    let progress = false;
    for (const cut of pending) {
      const slots = cut.artifact.composition?.internalHelperLocks ?? [];
      if (slots.some((slot) => !locks.has(slot.name))) {
        next.push(cut);
        continue;
      }
      const artifact = slots.length === 0 ? cut.artifact : patchInternalHelperLocks(cut.artifact, locks);
      const deployed = deployMaster(artifact, category, validatorProgram);
      locks.set(cut.name, deployed.lockingBytecode);
      cutArtifacts.set(cut.name, artifact);
      progress = true;
    }
    if (!progress) {
      throw new FunctionSplitPoolError(
        `function split helper locks cycle: ${pending.map((cut) => cut.name).join(', ')}`,
      );
    }
    pending = next;
  }
  const shardArtifacts = new Map<string, Artifact>();
  for (const shard of bundle.shards) {
    const slots = shard.artifact.composition?.internalHelperLocks ?? [];
    const artifact = slots.length === 0 ? shard.artifact : patchInternalHelperLocks(shard.artifact, locks);
    shardArtifacts.set(shard.selector.toLowerCase(), artifact);
  }
  return { locks, cutArtifacts, shardArtifacts };
}

/**
 * Replaces each helper-lock sentinel with the filled lock, on a clone.
 *
 * The clone's bytecode is what `deployMaster` treats as the original, so the category, address and template
 * slots are still empty and the helper locks are already the bytes the call record names. Stop-site targets
 * and address literals are rewritten to the same lock.
 */
export function patchInternalHelperLocks(
  artifact: Artifact,
  locksByName: ReadonlyMap<string, Uint8Array>,
): Artifact {
  const slots = artifact.composition?.internalHelperLocks ?? [];
  if (slots.length === 0) return artifact;
  const program = Uint8Array.from(asmToBytecode(artifact.bytecode));
  const replacements = new Map<string, string>();
  for (const slot of slots) {
    const lock = locksByName.get(slot.name);
    if (lock === undefined || lock.length !== HELPER_LOCK_LENGTH) {
      throw new FunctionSplitPoolError(`function split has no filled lock for helper "${slot.name}"`);
    }
    if (program[slot.offset] !== HELPER_LOCK_PUSH || slot.offset + 1 + HELPER_LOCK_LENGTH > program.length) {
      throw new FunctionSplitPoolError(`helper lock slot "${slot.name}" at ${slot.offset} is not a 35-byte push`);
    }
    const sentinelHex = bytesToHex(program.subarray(slot.offset + 1, slot.offset + 1 + HELPER_LOCK_LENGTH));
    const lockHex = bytesToHex(lock);
    const previous = replacements.get(sentinelHex);
    if (previous !== undefined && previous !== lockHex) {
      throw new FunctionSplitPoolError(`helper lock sentinel "${slot.name}" maps to two locks`);
    }
    replacements.set(sentinelHex, lockHex);
    program.set(lock, slot.offset + 1);
  }
  const clone = structuredClone(artifact);
  clone.bytecode = bytecodeToAsm(program);
  rewriteHelperLockHex(clone, replacements);
  return clone;
}

function rewriteHelperLockHex(artifact: Artifact, replacements: ReadonlyMap<string, string>): void {
  const swap = (hex: string): string => replacements.get(hex.replace(/^0x/i, '').toLowerCase()) ?? hex;
  const entries = artifact.composition?.stopSites?.entries;
  if (entries !== undefined) {
    for (const entry of entries) {
      for (const call of entry.calls) {
        if (call.target.length === 0) continue;
        (call as { target: string }).target = swap(call.target);
      }
    }
  }
  for (const fn of artifact.abi) {
    for (const edge of fn.externalCalls ?? []) {
      if (edge.addressLiteral === undefined || edge.addressLiteral.length === 0) continue;
      edge.addressLiteral = swap(edge.addressLiteral);
    }
  }
}

export function deployFunctionSplitShard(
  shard: FunctionSplitShard,
  category: Uint8Array,
  validatorProgram: Uint8Array,
  bundle?: FunctionSplitBundle,
): DeployedMaster {
  const slots = shard.artifact.composition?.internalHelperLocks ?? [];
  if (slots.length === 0) return deployMaster(shard.artifact, category, validatorProgram);
  if (bundle === undefined) {
    throw new FunctionSplitPoolError(
      `function "${shard.function}" names a helper lock, which deployment fills from the split bundle`,
    );
  }
  const prepared = prepareFunctionSplitDeployment(bundle, category, validatorProgram);
  const artifact = prepared.shardArtifacts.get(shard.selector.toLowerCase());
  if (artifact === undefined) {
    throw new FunctionSplitPoolError(`function "${shard.function}" is not in the prepared split`);
  }
  return deployMaster(artifact, category, validatorProgram);
}

/** True when two filled masters present the same contract address. */
export function sameContractAddress(left: Uint8Array, right: Uint8Array): boolean {
  return bytesEqual(left, right);
}

/** The artifact a resolved shard executes. */
export function functionSplitEntryArtifact(shard: FunctionSplitShard): Artifact {
  return shard.artifact;
}
