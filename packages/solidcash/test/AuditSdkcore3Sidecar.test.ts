import { describe, expect, it } from 'vitest';
import { TransactionBuilder } from '../src/TransactionBuilder.js';
import type { Utxo } from '../src/interfaces.js';

/**
 * SDKCORE-3: a planted UTXO at a shared side-car lock is not selected ahead of a real mutable side-car,
 * and a tokenless coin is not spent as a keccak side-car.
 */
describe('shared side-car selection', () => {
  it('skips a tokenless planted coin and co-spends the mutable keccak side-car', async () => {
    const planted: Utxo = { txid: '11'.repeat(32), vout: 0, satoshis: 1_000n };
    const real: Utxo = {
      txid: '22'.repeat(32), vout: 1, satoshis: 1_200n,
      token: { amount: 0n, category: '33'.repeat(31) + 'cc', nft: { capability: 'mutable', commitment: '' } },
    };
    const listed = [planted, real];
    const builder = new TransactionBuilder({
      provider: { getUtxosForLockingBytecode: async () => listed } as never,
    });
    await builder.addKeccakComputeCoSpend(new Uint8Array(32), { salt: new Uint8Array(32) });
    expect(builder.inputs.map((input) => input.txid)).toEqual([real.txid]);
    expect(builder.inputs.some((input) => input.txid === planted.txid)).toBe(false);
  });

  it('refuses a keccak co-spend when every listed coin lacks a mutable token', async () => {
    const planted: Utxo = { txid: '11'.repeat(32), vout: 0, satoshis: 1_000n };
    const builder = new TransactionBuilder({
      provider: { getUtxosForLockingBytecode: async () => [planted] } as never,
    });
    await expect(builder.addKeccakComputeCoSpend(new Uint8Array(32), { salt: new Uint8Array(32) }))
      .rejects.toThrow(/keccak256 compute side-car UTXO not available/);
    expect(builder.inputs).toEqual([]);
  });
});
