import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { blockOracleReadUnlocking, type Artifact } from '@solidcash/utils';
import type { Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import { bindBlockOracleLock } from '../../oracle/block-oracle-lock.js';
import type { DraftInput } from '../composer/index.js';

/** The block oracle a framed entry co-spends: its live UTXO and the read-path input that recreates it in place. */
export interface FramedBlockOracle {
  readonly utxo: Utxo;
  readonly input: DraftInput;
}

/** The provider's oracle lock, bound into `artifact` when the artifact reads the oracle, so its masters pin it. */
export function bindProviderBlockOracle(provider: NetworkProvider, artifact: Artifact): Uint8Array | undefined {
  const lock = (provider as { blockOracleLock?: Uint8Array }).blockOracleLock;
  if (lock !== undefined && artifact.usesBlockOracle === true) bindBlockOracleLock(artifact, lock);
  return lock;
}

/** Whether the entry `functionName` slices the block oracle. */
export function entryReadsBlockOracle(artifact: Artifact, functionName: string): boolean {
  return artifact.abi.some((candidate) => candidate.name === functionName && candidate.usesBlockOracle === true);
}

/** The live oracle at `lock`, which a reader picks as the first mutable NFT there. */
export async function framedBlockOracle(
  provider: NetworkProvider, lock: Uint8Array | undefined, functionName: string, fail: (reason: string) => Error,
): Promise<FramedBlockOracle> {
  if (lock === undefined) throw fail(`entry "${functionName}" reads the block oracle, and no oracle lock was provided`);
  const utxos = await provider.getUtxosForLockingBytecode(lock);
  const utxo = utxos.find((candidate) => candidate.token?.nft?.capability === 'mutable');
  if (utxo?.token?.category === undefined) throw fail('block oracle UTXO is not available');
  const category = hexToBin(utxo.token.category);
  return {
    utxo,
    input: {
      source: {
        lockingBytecode: lock,
        valueSatoshis: utxo.satoshis,
        token: {
          category, amount: 0n, nft: { capability: 'mutable', commitment: hexToBin(utxo.token.nft?.commitment ?? '') },
        },
      },
      unlockingBytecode: blockOracleReadUnlocking(category),
    },
  };
}
