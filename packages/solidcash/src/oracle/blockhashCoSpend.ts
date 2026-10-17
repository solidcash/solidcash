import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  blockhashCommitmentNumber, blockhashOracleLockingBytecode, buildBlockhashOracleCovenantScript,
  scriptToBytecode,
} from '@solidcash/utils';
import type { NetworkProvider } from '../network/index.js';
import type { Utxo, Unlocker, Output } from '../interfaces.js';

/**
 * Consumer-side resolver for blockhash(n) (docs/block-and-transaction-properties.md s11). The read codegen co-spends the
 * project-global (n->hash) oracle UTXO as the LAST input and self-preservingly recreates it at the MATCHING
 * output index, under tx.time >= n. This packages the three pieces a consumer wires for that, so call sites
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
 * Resolve the master's (n->hash) UTXO. Every block of the category shares one lock; the commitment's
 * first 4 bytes select `n`. Returns null when that block has not been published.
 */
export async function resolveBlockhashCoSpend(
  provider: NetworkProvider,
  oracleCategory: string,
  n: bigint,
): Promise<BlockhashCoSpend | null> {
  const category = hexToBin(oracleCategory);
  const lock = blockhashOracleLockingBytecode(category);
  const utxos = await provider.getUtxosForLockingBytecode(lock);
  const utxo = utxos.find((candidate) => {
    const commitment = candidate.token?.nft?.commitment;
    return commitment !== undefined && blockhashCommitmentNumber(hexToBin(commitment)) === n;
  });
  if (utxo === undefined) return null;

  const redeem = scriptToBytecode(buildBlockhashOracleCovenantScript(category));
  const readUnlock = scriptToBytecode([new Uint8Array(0), redeem]);
  return {
    utxo,
    unlocker: { generateLockingBytecode: (): Uint8Array => lock, generateUnlockingBytecode: (): Uint8Array => readUnlock },
    recreateOutput: { to: lock, amount: utxo.satoshis, token: utxo.token },
    locktime: Number(n),
  };
}
