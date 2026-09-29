import { describe, expect, it, vi } from 'vitest';
import type NetworkProvider from '../../src/network/NetworkProvider.js';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import {
  measureAndFundCovenantFee,
  type MeasureAndFundCovenantFeeHost,
} from '../../src/stateful/stb-measure-and-fund-covenant-fee.js';

describe('mock fee funder outpoints', () => {
  it('allocates a distinct source output for each send-phase funder', async () => {
    const addUtxo = vi.fn(async (_lock: string, utxo: { txid: string; vout: number }) => utxo);
    const provider = { addUtxo } as unknown as NetworkProvider;
    const covenantBuilder = {
      outputs: [],
      buildLibauthTransaction: () => ({ version: 2, locktime: 0, inputs: [], outputs: [] }),
    } as unknown as TransactionBuilder;
    const host = (): MeasureAndFundCovenantFeeHost => ({
      allInputs: [],
      funderUtxos: [],
      lateValueChunkOutputs: [],
      checkMinRelayFee: true,
      accountingFunderUtxos: () => [],
      computeMinFee: () => 1000n,
    });
    const first = host();
    const second = host();

    await measureAndFundCovenantFee(first, covenantBuilder, provider);
    await measureAndFundCovenantFee(second, covenantBuilder, provider);

    expect(addUtxo).toHaveBeenCalledTimes(2);
    expect(first.funderUtxos).toHaveLength(1);
    expect(second.funderUtxos).toHaveLength(1);
    expect(first.funderUtxos[0].txid).toMatch(/^[0-9a-f]{64}$/);
    expect(second.funderUtxos[0].txid).toMatch(/^[0-9a-f]{64}$/);
    expect(first.funderUtxos[0].txid).not.toBe(second.funderUtxos[0].txid);
    expect(first.funderUtxos[0].vout).toBe(0);
    expect(second.funderUtxos[0].vout).toBe(0);
  });
});
