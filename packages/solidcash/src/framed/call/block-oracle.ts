import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { decodePoolInfoCommitment, poolInfoReadUnlocking, type Artifact } from '@solidcash/utils';
import type { UnlockableUtxo, Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import { checkPoolCategory, poolLocks } from '../../oracle/pool/coins.js';
import {
  artifactOraclePool, bindArtifactOraclePool, indirectPoolReads, poolInfoCoSpend,
} from '../../oracle/pool/reader.js';
import type { DraftInput, RecoverySideCars } from '../composer/index.js';

/** The pool coin a framed entry co-spends: a live info coin and the read-path input that recreates it in place. */
export interface FramedBlockOracle {
  readonly utxo: Utxo;
  readonly input: DraftInput;
}

/**
 * Binds the oracle pool a framed reader's masters carry in their pool slots, `pool` or else the provider's, so
 * `deployMaster` fills them. Returns it, or undefined for an artifact that reads no block.*.
 */
export function bindFramedOraclePool(
  provider: NetworkProvider, artifact: Artifact, pool?: string,
): string | undefined {
  if (artifact.usesBlockOracle !== true) return undefined;
  const chosen = pool ?? provider.oraclePoolCategory;
  if (chosen === undefined) return undefined;
  const category = checkPoolCategory(chosen);
  bindArtifactOraclePool(artifact, category);
  return category;
}

/** The pool a framed reader's deployment bound, or else the provider's, bound into `artifact`. */
export function framedOraclePool(provider: NetworkProvider, artifact: Artifact): string | undefined {
  if (artifact.usesBlockOracle !== true) return undefined;
  return artifactOraclePool(artifact) ?? bindFramedOraclePool(provider, artifact);
}

/** Whether the entry `functionName` reads block.*, or a function-pointer target it may enter does. */
export function entryReadsBlockOracle(artifact: Artifact, functionName: string): boolean {
  // An artifact that publishes no entry's indirect reads co-spends for every entry when it reads only indirectly.
  return indirectPoolReads(artifact, undefined).blockInfo || artifact.abi.some((candidate) => candidate.name === functionName
    && (candidate.usesBlockOracle === true || candidate.indirectPoolReads?.blockInfo === true));
}

/**
 * The coin's timestamp under the register name an artifact still publishes a clock read as
 * (`state:__block_timestamp`), so a stored value's source resolves to what the body slices.
 */
export function blockOracleClock(oracle: FramedBlockOracle): Readonly<Record<string, bigint>> {
  const commitment = hexToBin(oracle.utxo.token?.nft?.commitment ?? '');
  return { __block_timestamp: decodePoolInfoCommitment(commitment).timestamp };
}

/**
 * A live info coin of `pool` for the entry to co-spend, chosen as every reader of a transaction chooses it
 * (`poolInfoCoSpend`). A body finds the first input of the pool's category whose flags are 0x00, so any such coin
 * serves.
 */
export async function framedBlockOracle(
  provider: NetworkProvider, pool: string | undefined, functionName: string, fail: (reason: string) => Error,
): Promise<FramedBlockOracle> {
  if (pool === undefined) {
    throw fail(`entry "${functionName}" reads block.* through an oracle pool, and none is bound`);
  }
  let spent: UnlockableUtxo;
  try {
    spent = await poolInfoCoSpend(provider, pool);
  } catch (error) {
    throw fail((error as Error).message);
  }
  const coin = (({ unlocker: _unlocker, ...rest }: UnlockableUtxo) => rest)(spent);
  const locks = poolLocks(pool);
  return {
    utxo: coin,
    input: {
      source: {
        lockingBytecode: locks.info,
        valueSatoshis: coin.satoshis,
        token: {
          category: locks.category,
          amount: 0n,
          nft: { capability: 'mutable', commitment: hexToBin(coin.token?.nft?.commitment ?? '') },
        },
      },
      unlockingBytecode: poolInfoReadUnlocking(locks.category),
    },
  };
}

/** The id the pool coin is co-spent under after `master`'s side-cars. */
export function blockOracleSideCarId(master: string): string {
  return `${master}:block-oracle`;
}

/**
 * `own` with the pool coin co-spent after its compute side-cars. The coin is not a compute side-car: a body finds it
 * by its category and flags, so it only has to sit after the side-cars the body addresses by offset.
 */
export function withBlockOracleSideCar(
  master: string, own: RecoverySideCars | undefined, oracle: FramedBlockOracle,
): RecoverySideCars {
  const id = blockOracleSideCarId(master);
  return {
    ids: [...own?.ids ?? [], id],
    inputs: { ...own?.inputs, [id]: oracle.input },
    computedWitnesses: own?.computedWitnesses ?? [],
    utxos: { ...own?.utxos, [id]: oracle.utxo },
  };
}
