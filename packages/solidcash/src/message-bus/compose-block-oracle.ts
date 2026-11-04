/**
 * One block-info coin of each oracle pool serves every reader of that pool in a composed transaction.
 *
 * Each reader's participant block is built with its own copy of a coin of its pool at its `blockInfoOracle` slot,
 * so its isolated probes can slice it. The first block that spends a coin of a pool keeps that input; a later copy
 * becomes a balanced pad, and every reader's hidden index names the kept input. A read checks the coin's category
 * and flags, so the kept coin is found as the read finds it, not by its lock.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX, sha256 } from '@solidcash/utils';
import { isContractUnlocker, type Output, type UnlockableUtxo, type Utxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { isPoolInfoInput } from '../oracle/pool/reader.js';

const ORACLE_INDEX = '__internal__blockOracleInputIndex';
const PAD_LOCK = hexToBin(BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX);
const PAD_UNLOCKING = Uint8Array.of(0x01, 0x51);
const PAD_SATOSHIS = 5000n;

/**
 * The aggregate's view of one participant block placed at `base`: a later copy of a coin of a pool `kept` holds is
 * padded, and every reader in the block is repointed to its pool's kept input. `kept` maps a pool category to that
 * input. The participant's own builder keeps its copy.
 */
export async function shareBlockOracleInput(
  provider: NetworkProvider,
  block: { readonly inputs: readonly UnlockableUtxo[]; readonly outputs: readonly Output[] },
  base: number,
  kept: Map<string, number>,
): Promise<{ inputs: UnlockableUtxo[]; outputs: Output[] }> {
  const inputs = [...block.inputs];
  const outputs = [...block.outputs];
  const readers = inputs.flatMap((input) => {
    const unlocker = input.unlocker;
    if (!isContractUnlocker(unlocker) || unlocker.contract.oraclePool === undefined) return [];
    const position = unlocker.abiFunction.inputs.findIndex((parameter) => parameter.name === ORACLE_INDEX);
    return position < 0 ? [] : [{ unlocker, position, pool: unlocker.contract.oraclePool }];
  });
  if (readers.length === 0) return { inputs, outputs };
  const pools = [...new Set(readers.map((reader) => reader.pool))];
  for (const [offset, input] of inputs.entries()) {
    const pool = pools.find((candidate) => isPoolInfoInput(input, candidate));
    if (pool === undefined) continue;
    if (!kept.has(pool)) {
      kept.set(pool, base + offset);
      continue;
    }
    const mint = (provider as { addUtxo?: (lock: string, utxo: Utxo) => Promise<unknown> }).addUtxo;
    if (mint === undefined) {
      throw new Error('messageBus: a second block-oracle reader needs a balanced pad, '
        + 'and this provider cannot create one');
    }
    const seed = `SolidCash block oracle pad\0${input.txid}:${input.vout}:${base + offset}`;
    const pad: Utxo = { txid: binToHex(sha256(new TextEncoder().encode(seed))), vout: 0, satoshis: PAD_SATOSHIS };
    await mint.call(provider, BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX, pad);
    inputs[offset] = {
      ...pad,
      unlocker: { generateLockingBytecode: () => PAD_LOCK, generateUnlockingBytecode: () => PAD_UNLOCKING },
    };
    outputs[offset] = { to: Uint8Array.of(0x51), amount: PAD_SATOSHIS };
  }
  for (const { unlocker, position, pool } of readers) {
    const index = kept.get(pool);
    if (index === undefined || unlocker.params[position] === BigInt(index)) continue;
    unlocker.params[position] = BigInt(index);
    unlocker.syncEncodedArgsFromParams?.([position]);
  }
  return { inputs, outputs };
}
