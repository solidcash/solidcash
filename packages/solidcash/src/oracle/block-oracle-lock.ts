import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  applyBlockOracleLock, blockOracleFieldValue, findBlockOracleLockSlots, type Artifact,
} from '@solidcash/utils';
import type NetworkProvider from '../network/NetworkProvider.js';

/** The oracle lock a deployment bakes into one artifact. The script pins this lock; readers do not call the oracle. */
const locks = new WeakMap<Artifact, Uint8Array>();

export function bindBlockOracleLock(artifact: Artifact, lock: Uint8Array): void {
  locks.set(artifact, lock);
}

export function blockOracleLockFor(artifact: Artifact): Uint8Array | undefined {
  return locks.get(artifact);
}

/** Published debug bodies use the same authenticated oracle substitution as the deployed program. */
export function boundArtifactProgramHex(artifact: Artifact, programHex: string): string {
  const lock = blockOracleLockFor(artifact);
  if (lock === undefined) return programHex.toLowerCase();
  const program = hexToBin(programHex);
  return binToHex(applyBlockOracleLock(program, lock, findBlockOracleLockSlots(program)));
}

/** Timestamp in the oracle commitment at `lock`, the value a reader's block.timestamp slices. */
export async function readBlockOracleTimestamp(
  provider: NetworkProvider, lock: Uint8Array,
): Promise<bigint | undefined> {
  const utxos = await provider.getUtxosForLockingBytecode(lock);
  const commitment = utxos.find((utxo) => utxo.token?.nft?.capability === 'mutable')?.token?.nft?.commitment;
  return commitment === undefined ? undefined : blockOracleFieldValue(hexToBin(commitment), 'timestamp');
}
