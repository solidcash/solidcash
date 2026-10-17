import { describe, expect, it } from 'vitest';
import { TransactionBuilder } from '../../src/TransactionBuilder.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import { randomUtxo } from '../../src/utils.js';
import type { Unlocker } from '../../src/interfaces.js';

const destination = Uint8Array.of(0x51);
const growingUnlocker: Unlocker = {
  generateLockingBytecode: () => destination,
  generateUnlockingBytecode: ({ transaction }) => new Uint8Array(transaction.outputs.length * 100),
};

describe('change with transaction-dependent unlocking sizes', () => {
  it('prices the final output population and drops change that becomes uneconomic', () => {
    const make = (satoshis: bigint): TransactionBuilder => new TransactionBuilder({ provider: new MockNetworkProvider() })
      .addInput(randomUtxo({ satoshis }), growingUnlocker)
      .addOutput({ to: destination, amount: 1000n });
    const funded = make(10_000n).addBchChangeOutputIfNeeded({ to: destination, feeRate: 1 });
    expect(funded.outputs).toHaveLength(2);
    expect(funded.calculateTransactionFee().feeSats).toBe(funded.getTransactionSize());

    // Initially enough for dust plus a fee with one output; the new output grows the unlocking script by
    // another 100 bytes. The final candidate becomes dust and must be removed without leaving a fee deficit.
    const narrow = make(1700n).addBchChangeOutputIfNeeded({ to: destination, feeRate: 1 });
    expect(narrow.outputs).toHaveLength(1);
    expect(narrow.calculateTransactionFee().feeSats).toBeGreaterThanOrEqual(narrow.getTransactionSize());
  });

  it('restores the output list when sizing a candidate change output fails', () => {
    const builder = new TransactionBuilder({ provider: new MockNetworkProvider() })
      .addInput(randomUtxo({ satoshis: 10_000n }), {
        ...growingUnlocker,
        generateUnlockingBytecode: (options) => {
          if (options.transaction.outputs.length > 1) throw new Error('candidate refused');
          return growingUnlocker.generateUnlockingBytecode(options);
        },
      })
      .addOutput({ to: destination, amount: 1000n });
    expect(() => builder.addBchChangeOutputIfNeeded({ to: destination, feeRate: 1 })).toThrow('candidate refused');
    expect(builder.outputs).toHaveLength(1);
    expect(() => builder.addOutput({ to: destination, amount: 1000n })).not.toThrow();
  });
});
