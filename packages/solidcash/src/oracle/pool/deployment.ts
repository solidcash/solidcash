import { POOL_MAX_DEPTH, oraclePoolTreeReads, type Artifact } from '@solidcash/utils';
import type NetworkProvider from '../../network/NetworkProvider.js';
import type { PoolBlockFields } from './coins.js';
import { createOraclePool } from './genesis.js';

/** The pool a deployment mints, shaped by what its contract and the contracts it creates read. */
export interface OraclePoolCreateOptions {
  /** Block-info coins, minted when the tree reads block.*: one per master by default, 1 for a stateless contract. */
  readonly infoCoins?: number;
  /** The ring's depth, 1 to 256, or 'now' for 1; slots are minted when the tree reads blockhash. Default 256. */
  readonly ringDepth?: number | 'now';
  /** Slots per ring block. Default 1. */
  readonly slotReplicas?: number;
  /** Signs the pool's owner paths; the provider's `oraclePoolOwnerKey` by default, which a live provider lacks. */
  readonly ownerKey?: Uint8Array;
  /** Its P2PKH pays the pool. Default `ownerKey`. */
  readonly funder?: Uint8Array;
  /** The tip's fields, which a live network needs; a simulator supplies its own. */
  readonly tip?: PoolBlockFields;
  /** The hash of block n in display order. Defaults to the provider's `getBlockHash`. */
  readonly blockHash?: (n: bigint) => Promise<Uint8Array>;
}

/**
 * The pool a deployment binds: a category in display order, `'new'` to mint one shaped by the contract tree with
 * every default, or `{ create }` to mint one with some options set.
 */
export type DeploymentOraclePool = string | { readonly create: OraclePoolCreateOptions };

/** Whether `option` asks the deployment to mint its pool. */
export function mintsOraclePool(
  option: DeploymentOraclePool | undefined,
): option is 'new' | { readonly create: OraclePoolCreateOptions } {
  return option === 'new' || (typeof option === 'object' && option !== null);
}

/** The category an option names, which only a stateful or factory deployment may leave to be minted. */
export function oraclePoolCategoryOption(option: DeploymentOraclePool | undefined): string | undefined {
  if (!mintsOraclePool(option)) return option;
  throw new Error('oraclePool \'new\' and { create } mint a pool only through a stateful or factory deployment');
}

/**
 * The pool category a deployment binds. A category is returned as given. `'new'` and `{ create }` mint a pool by
 * `createOraclePool`, in transactions of their own before the deployment's, so a constructor can read it: block-info
 * coins when the tree reads block.*, `masters` of them by default, and ring slots when it reads blockhash. A tree
 * that reads neither mints none. A provider that keeps pools keeps this one, as `createOraclePool` asks it to.
 */
export async function resolveDeploymentOraclePool(
  provider: NetworkProvider,
  artifact: Pick<Artifact, 'contractName' | 'usesBlockOracle' | 'usesBlockhash' | 'createdPoolReads'>,
  option: DeploymentOraclePool | undefined,
  masters: number,
): Promise<string | undefined> {
  if (!mintsOraclePool(option)) return option;
  const create: OraclePoolCreateOptions = option === 'new' ? {} : option.create;
  const reads = oraclePoolTreeReads(artifact);
  if (reads.blockInfo !== true && reads.blockhash !== true) return undefined;
  const ownerKey = create.ownerKey ?? provider.oraclePoolOwnerKey;
  if (ownerKey === undefined) {
    throw new Error(
      `${artifact.contractName}: oraclePool 'new' needs create.ownerKey, as this provider names no oracle pool owner`,
    );
  }
  const pool = await createOraclePool(provider, {
    ownerKey,
    funder: create.funder ?? ownerKey,
    infoCoins: reads.blockInfo === true ? create.infoCoins ?? masters : 0,
    ringDepth: create.ringDepth === 'now' ? 1 : create.ringDepth ?? POOL_MAX_DEPTH,
    slotReplicas: reads.blockhash === true ? create.slotReplicas ?? 1 : 0,
    ...(create.tip === undefined ? {} : { tip: create.tip }),
    ...(create.blockHash === undefined ? {} : { blockHash: create.blockHash }),
  });
  return pool.category;
}
