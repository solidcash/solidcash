import { describe, expect, it } from 'vitest';
import { StatefulTransactionBuilder } from '../../src/stateful/StatefulTransactionBuilder.js';
import type { UnlockableUtxo, Unlocker } from '../../src/interfaces.js';

const unlocker: Unlocker = {
  generateLockingBytecode: () => Uint8Array.of(0x51),
  generateUnlockingBytecode: () => Uint8Array.of(),
};

const utxo = (tag: number, token = false): UnlockableUtxo => ({
  txid: tag.toString(16).padStart(64, '0'), vout: 0, satoshis: 10_000n, unlocker,
  ...(token && { token: { category: '11'.repeat(32), amount: 0n, nft: { capability: 'mutable' as const, commitment: '' } } }),
});

describe('message-bus batch graph blockhash physical assembly', () => {
  it('places active reads at sparse row-band slots and leaves inactive slots to funders', () => {
    const master = utxo(1, true);
    const active0 = utxo(2, true);
    const active3 = utxo(3, true);
    const funders = [utxo(10), utxo(11)];
    const builder = new StatefulTransactionBuilder({
      provider: {} as never,
      masterUtxo: master,
      dataNftUtxos: [],
      stateLayout: { variables: [], dataNftCount: 0 },
      categoryId: '11'.repeat(32),
      blockhashCoSpendUtxos: [active0, active3],
      blockhashCoSpendSlotOrdinals: [0, 3],
      funderUtxos: funders,
      blockLayout: {
        blockSize: 5,
        slots: [
          { kind: 'master', offset: 0 },
          { kind: 'blockhashOracle', offset: 1 },
          { kind: 'blockhashOracle', offset: 2 },
          { kind: 'blockhashOracle', offset: 3 },
          { kind: 'blockhashOracle', offset: 4 },
        ],
      },
    });
    const inputs = (builder as unknown as { allInputs: UnlockableUtxo[] }).allInputs;
    expect(inputs.map((input) => input.txid)).toEqual([
      master.txid, active0.txid, funders[0].txid, funders[1].txid, active3.txid,
    ]);
  });
});
