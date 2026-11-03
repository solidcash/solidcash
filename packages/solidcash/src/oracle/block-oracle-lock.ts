import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  applyBlockOracleLock, BLOCK_ORACLE_LOCK_SENTINEL, blockOracleFieldValue, findBlockOracleLockSlots,
} from '@solidcash/utils';
import type NetworkProvider from '../network/NetworkProvider.js';

/**
 * Whether a published body is the one the VM ran. A reader's body carries the oracle lock sentinel, which each
 * deployment replaces with its own contract's oracle lock, so the lock the run carried is written over it first.
 */
export function matchesExecutedBody(programHex: string, executedHex: string): boolean {
  const program = hexToBin(programHex);
  const executed = executedHex.toLowerCase();
  if (program.length * 2 !== executed.length) return false;
  const slots = findBlockOracleLockSlots(program);
  if (slots.length === 0) return programHex.toLowerCase() === executed;
  const at = slots[0] + 1;
  const lock = hexToBin(executed.slice(at * 2, (at + BLOCK_ORACLE_LOCK_SENTINEL.length) * 2));
  return binToHex(applyBlockOracleLock(program, lock, slots)) === executed;
}

/** Timestamp in the oracle commitment at `lock`, the value a reader's block.timestamp slices. */
export async function readBlockOracleTimestamp(
  provider: NetworkProvider, lock: Uint8Array,
): Promise<bigint | undefined> {
  const utxos = await provider.getUtxosForLockingBytecode(lock);
  const commitment = utxos.find((utxo) => utxo.token?.nft?.capability === 'mutable')?.token?.nft?.commitment;
  return commitment === undefined ? undefined : blockOracleFieldValue(hexToBin(commitment), 'timestamp');
}
