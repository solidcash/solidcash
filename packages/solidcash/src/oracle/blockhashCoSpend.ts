import { hexToBin } from '@bitauth/libauth';
import {
  blockhashOracleLockingBytecode, buildBlockhashOracleCovenantScript, scriptToBytecode,
} from '@solidcash/utils';
import { NetworkProvider } from '../network/index.js';
import { Utxo, Unlocker, Output } from '../interfaces.js';

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
 * Resolve the (n->hash) oracle UTXO at addr(n) and the co-spend pieces. Returns null when no live UTXO
 * sits at addr(n) (outside the 256-block window or unpublished) - the consumer then has no hash to read
 * (EVM yields bytes32(0) here; see the doc).
 */
export async function resolveBlockhashCoSpend(
  provider: NetworkProvider,
  oracleCategory: string,
  n: bigint,
): Promise<BlockhashCoSpend | null> {
  const cat = hexToBin(oracleCategory);
  const addrN = blockhashOracleLockingBytecode(cat, n);
  const utxos = await provider.getUtxosForLockingBytecode(addrN);
  if (utxos.length === 0) return null;

  const utxo = utxos[0];
  const redeem = scriptToBytecode(buildBlockhashOracleCovenantScript(cat, n));
  const readUnlock = scriptToBytecode([new Uint8Array(0), redeem]); // flag 0 = read branch
  return {
    utxo,
    unlocker: { generateLockingBytecode: (): Uint8Array => addrN, generateUnlockingBytecode: (): Uint8Array => readUnlock },
    recreateOutput: { to: addrN, amount: utxo.satoshis, token: utxo.token },
    locktime: Number(n),
  };
}
