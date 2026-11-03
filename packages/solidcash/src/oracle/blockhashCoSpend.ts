import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  blockhashCommitmentNumber, blockhashOracleLockingBytecode, blockhashSlotReadUnlocking,
} from '@solidcash/utils';
import type { NetworkProvider } from '../network/index.js';
import type { Utxo, Unlocker, Output } from '../interfaces.js';

/**
 * Consumer-side resolver for blockhash(n) (docs/block-and-transaction-properties.md s11). The read codegen co-spends
 * the master category's blockhash slot that holds n, and the slot covenant's read path recreates it unchanged at the
 * MATCHING output index, under tx.time >= n. This packages the three pieces a consumer wires for that, so call sites
 * stop hand-rolling the covenant redeem + read flag.
 */
export interface BlockhashCoSpend {
  utxo: Utxo;
  unlocker: Unlocker;
  // Self-preserving recreate; the caller MUST place it at the same output index as the co-spend input
  // (the covenant checks output[INPUTINDEX] == the input).
  recreateOutput: Output;
  locktime: number; // tx.time floor the read covenant requires (= n)
}

/**
 * Resolve the master's slot that holds block n. Every slot of the category shares one lock; the commitment's
 * first 4 bytes select `n`. Returns null when no slot holds that block.
 */
export async function resolveBlockhashCoSpend(
  provider: NetworkProvider,
  oracleCategory: string,
  n: bigint,
): Promise<BlockhashCoSpend | null> {
  const category = hexToBin(oracleCategory);
  const lock = blockhashOracleLockingBytecode(category);
  const wanted = oracleCategory.toLowerCase();
  const utxos = await provider.getUtxosForLockingBytecode(lock);
  const utxo = utxos.find(({ token }) => token?.category.toLowerCase() === wanted
    && token.nft?.capability === 'mutable' && blockhashCommitmentNumber(hexToBin(token.nft.commitment)) === n);
  if (utxo === undefined) return null;

  const readUnlock = blockhashSlotReadUnlocking(category);
  return {
    utxo,
    unlocker: { generateLockingBytecode: (): Uint8Array => lock, generateUnlockingBytecode: (): Uint8Array => readUnlock },
    recreateOutput: { to: lock, amount: utxo.satoshis, token: utxo.token },
    locktime: Number(n),
  };
}
