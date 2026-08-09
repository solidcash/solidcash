import { describe, expect, it } from 'vitest';
import type Signer from '../../src/Signer.js';
import type { Utxo } from '../../src/interfaces.js';
import { selectGenesisFundingUtxo } from '../../src/stateful/ContractFactory.js';

describe('ContractFactory genesis funding selection', () => {
  it('prefers the freshest eligible coin when a provider returns an older coin first', async () => {
    const older: Utxo = {
      txid: '11'.repeat(32), vout: 0, satoshis: 1_000_000n, confirmations: 500,
    };
    const freshlyFunded: Utxo = {
      txid: '22'.repeat(32), vout: 0, satoshis: 1_000_000n, confirmations: 1,
    };
    const signer = { getUtxos: async () => [older, freshlyFunded] } as unknown as Signer;

    const selected = await selectGenesisFundingUtxo(signer, {
      contractName: 'FundingSelection',
      constructorInputs: [],
      abi: [],
      bytecode: 'OP_1',
      compiler: { name: 'solidc', version: '0.13.1' },
      updatedAt: new Date(0).toISOString(),
      source: '',
    });

    expect(selected).toBe(freshlyFunded);
  });
});
