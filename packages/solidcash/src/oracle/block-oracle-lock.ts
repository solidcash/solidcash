import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  applyBlockOracleLock, BLOCK_ORACLE_LOCK_SENTINEL, blockOracleFieldValue, blockOracleLockingBytecode, bytesEqual,
  findBlockOracleLockSlots,
} from '@solidcash/utils';
import type { Utxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';

/** The coins at `lock` its covenant can spend: mutable NFTs of the category the lock is built for. */
export function blockOracleCoins<T extends Utxo>(utxos: readonly T[], lock: Uint8Array): T[] {
  return utxos.filter((utxo) => utxo.token?.nft?.capability === 'mutable'
    && bytesEqual(blockOracleLockingBytecode(hexToBin(utxo.token.category)), lock));
}

/**
 * One coin of the block oracle at `lock`, uniformly at random. A direct deployment mints one per master, so callers
 * spread over them; the covenant refuses a second coin of the lock in one transaction.
 */
export function pickBlockOracleCoin<T extends Utxo>(utxos: readonly T[], lock: Uint8Array): T | undefined {
  const coins = blockOracleCoins(utxos, lock);
  return coins.length === 0 ? undefined : coins[Math.floor(Math.random() * coins.length)];
}

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
  const commitment = blockOracleCoins(utxos, lock)[0]?.token?.nft?.commitment;
  return commitment === undefined ? undefined : blockOracleFieldValue(hexToBin(commitment), 'timestamp');
}
