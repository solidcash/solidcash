/**
 * The constants a creator's deployment fills for the child it creates (docs/framed/CREATE2_IDENTITY.md, "The genesis
 * replay").
 *
 * A creating entry requires the outputs of the new child's category `K` to be exactly the child's genesis. It computes
 * most of it from `K`, its own address and the folded state; what its compile cannot know are facts of the child's
 * compiled artifact and of the pool each creation funds, the same for every category the child is created as: the
 * child's entry locks (its masters are constant-lock) with how many masters and validators a creation funds, and the
 * hashes of its sorted collections. They are computed once, here, and filled into the creator at its deployment
 * (`DeployOptions.childLocks`, `childPool`, `childCollections`), or into its published bundle with
 * `fillFramedChildSlots`. A child that reads block.* carries its oracle pool in its masters, so its locks name it.
 */

import { encodeLockingBytecodeP2pkh } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { bytesEqual, type Artifact, type FunctionSplitBundle } from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc/runtime';
import type NetworkProvider from '../../network/NetworkProvider.js';
import type { FunctionArgument } from '../../Argument.js';
import { assertDeploymentSpendable } from '../../stateful/spendable-code.js';
import {
  childGenesisReservation, patchChildCollectionSentinels, patchChildGenesisSlots, patchChildLockSentinels,
  patchChildOutputCount,
} from './child-locks.js';
import { bindChildOraclePool, childCollectionHashes, childGenesisOutputCount } from './genesis-outputs.js';
import { deployMaster } from './material.js';
import { MasterPoolDeployment, resolveMasterPoolSize, type MasterPoolSize } from './pool.js';

/** Raised when a child's constants cannot serve every creation, or a creator cannot take them. */
export class FramedChildConstantsError extends Error {
  public readonly name = 'FramedChildConstantsError';

  public constructor(message: string) {
    super(message);
  }
}

/** What the child's constants are computed from. */
export interface FramedChildConstantsOptions {
  /** The child's logical artifact (a bundle's `logical`). */
  readonly artifact: Artifact;
  /** The per-entry bundle the child runs its entries from. A child is created from its bundle's constant-lock shards. */
  readonly split?: FunctionSplitBundle;
  /** The network the creations run on: its consensus limits lay the genesis out. */
  readonly provider: NetworkProvider;
  /**
   * The master pool each creation funds per entry lock, which the output count depends on. A count it leaves out is
   * the composing default's (`resolveMasterPoolSize`); every creation must then fund the pool returned as `childPool`.
   */
  readonly pool?: Partial<MasterPoolSize>;
  /** The child constructor's arguments, in parameter order. */
  readonly constructorArgs?: readonly FunctionArgument[];
  /**
   * The initializer the creator folds into the child's genesis (`composition.creates[].foldedCall`), with arguments of
   * its types. The values are the caller's at each creation; stand-ins serve as long as they write the same records.
   */
  readonly initializer?: { readonly functionName: string; readonly args: readonly FunctionArgument[] };
  /** The authhead owner a creation names. It does not change the count, so a P2PKH stand-in is the default. */
  readonly ownerLock?: Uint8Array;
  /** The validator program the child is deployed with; the toolchain's own by default. */
  readonly validatorProgram?: Uint8Array;
  /**
   * The oracle pool a child that reads block.* binds, its category in display order: the creator's, the provider's
   * by default. Its masters carry it, so every creation must bind the same pool.
   */
  readonly oraclePool?: string;
}

/** The constants a creator's deployment fills, in the shape `DeployOptions` takes them, and the pool they assume. */
export interface FramedChildConstants {
  /** The child's entry locks: one per shard, then one per internal cut, the same for every category. */
  readonly childLocks: readonly Uint8Array[];
  /** The 20-byte hashes of the child's sorted collections, whose empty heads its genesis mints. */
  readonly childCollections: readonly Uint8Array[];
  /** How many outputs of the child's category a creation mints. */
  readonly childOutputCount: number;
  /** The pool each creation funds: what the creator's replay requires, and what `creates.pool` must name. */
  readonly childPool: MasterPoolSize;
}

/** Two categories no creation mints, at which the child's locks must agree. */
const STAND_IN_CATEGORIES = [new Uint8Array(32).fill(7), new Uint8Array(32).fill(9)] as const;

/**
 * The constants a creator of `options.artifact` is deployed with.
 *
 * The entry locks are computed at two stand-in categories and must agree: a child whose masters reserve a deployment
 * slot has a lock per category, which no creator can name, and is refused here by name rather than at its first
 * creation.
 */
export function framedChildConstants(options: FramedChildConstantsOptions): FramedChildConstants {
  const { artifact, split, provider } = options;
  // Every creation of the child mints masters at these locks, so no creator is given the locks of code no input spends.
  assertDeploymentSpendable(artifact, provider, split === undefined ? {} : { functionSplit: split });
  bindChildOraclePool(provider, artifact, split, options.oraclePool);
  const validatorProgram = options.validatorProgram ?? framedValidator.buildValidatorProgram();
  const childPool = resolveMasterPoolSize(options.pool ?? {});
  const locksAt = (category: Uint8Array): readonly Uint8Array[] => (split === undefined
    ? [deployMaster(artifact, category, validatorProgram).lockingBytecode]
    : MasterPoolDeployment.createFunctionSplit({ bundle: split, category, validatorProgram, size: childPool })
      .getEntryLocks());
  const childLocks = locksAt(STAND_IN_CATEGORIES[0]);
  const again = locksAt(STAND_IN_CATEGORIES[1]);
  if (childLocks.length !== again.length || childLocks.some((lock, index) => !bytesEqual(lock, again[index]!))) {
    throw new FramedChildConstantsError(
      `the masters of "${artifact.contractName}" have a lock per category, so no creator can name them: compile the `
      + 'child in the unit of the contract that creates it, split per entry, so its masters are constant-lock',
    );
  }
  const childOutputCount = childGenesisOutputCount({
    artifact,
    category: STAND_IN_CATEGORIES[1],
    validatorProgram,
    provider,
    ...(split === undefined ? {} : { split }),
    pool: childPool,
    ownerLock: options.ownerLock ?? encodeLockingBytecodeP2pkh(new Uint8Array(20)),
    ...(options.constructorArgs === undefined ? {} : { constructorArgs: options.constructorArgs }),
    ...(options.initializer === undefined ? {} : { initializer: options.initializer }),
  });
  return { childLocks, childCollections: childCollectionHashes(artifact), childOutputCount, childPool };
}

/** The slots of one creator program, filled as its deployment fills them. */
function fillProgram(artifact: Artifact, constants: FramedChildConstants): Artifact {
  if (childGenesisReservation(artifact).replays) {
    return patchChildGenesisSlots(artifact, {
      locks: constants.childLocks,
      pool: constants.childPool,
      collections: constants.childCollections,
    });
  }
  return patchChildCollectionSentinels(
    patchChildOutputCount(patchChildLockSentinels(artifact, constants.childLocks), constants.childOutputCount),
    constants.childCollections,
  );
}

/**
 * A creator's artifact, or every program of its bundle (the logical artifact, each shard and each internal cut), with
 * the child slots filled from `constants`: what a deployment given those constants deploys, for a project that
 * publishes the filled bundle so another process registers the same entry locks. A program that reserves no slot is
 * returned unchanged.
 */
export function fillFramedChildSlots<T extends Artifact | FunctionSplitBundle>(
  target: T, constants: FramedChildConstants,
): T {
  if (!('shards' in target)) return fillProgram(target as Artifact, constants) as T;
  const bundle = target as FunctionSplitBundle;
  const filled: FunctionSplitBundle = {
    ...bundle,
    logical: fillProgram(bundle.logical, constants),
    shards: bundle.shards.map((shard) => ({ ...shard, artifact: fillProgram(shard.artifact, constants) })),
    internalCuts: bundle.internalCuts.map((cut) => ({ ...cut, artifact: fillProgram(cut.artifact, constants) })),
  };
  return filled as T;
}
