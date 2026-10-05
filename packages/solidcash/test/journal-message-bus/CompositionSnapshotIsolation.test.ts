import { describe, expect, it } from 'vitest';
import { compose } from '../../src/message-bus/compose.js';
import {
  StatefulContract, clearSoftBentoTotals, takeSoftStateSnapshot,
} from '../../src/stateful/StatefulContract.js';

const fakeCall = (args: readonly unknown[]): {
  _messageBusCompositionDescriptor: () => {
    contract: { marker: string };
    functionName: string;
    args: readonly unknown[];
  };
} => ({
  _messageBusCompositionDescriptor: () => ({
    contract: { marker: 'contract-capability' },
    functionName: 'apply',
    args,
  }),
});

const softContract = (provider: object): StatefulContract => {
  const contract = Object.create(StatefulContract.prototype) as StatefulContract;
  Object.assign(contract as object, {
    _inner: { provider, address: 'same-contract-address' },
    _categoryId: 'same-category',
  });
  return contract;
};

describe('atomic composition snapshot isolation', () => {
  it('captures call descriptors and recursively copies ABI values at compose time', () => {
    const bytes = Uint8Array.of(1, 2);
    const nested = [bytes, { values: [3n] }];
    const calls = [fakeCall(nested)] as any;
    const composition = compose({
      calls,
      funder: { utxo: { txid: '00'.repeat(32), vout: 0, satoshis: 1n }, unlocker: {} as any },
      changeAddress: Uint8Array.of(9),
    });

    bytes[0] = 7;
    nested[1].values[0] = 8n;
    calls.push(fakeCall([]));

    const captured = (composition as any).options.preparedCalls;
    expect(captured).toHaveLength(1);
    expect(captured[0].args[0]).toEqual(Uint8Array.of(1, 2));
    expect(captured[0].args[1]).toEqual({ values: [3n] });
  });

  it('partitions soft state by provider and restores every provider scope', () => {
    clearSoftBentoTotals();
    const first = softContract({});
    const second = softContract({});
    first._softStateOverlay.value = 11n;
    expect(second._softStateOverlay.value).toBeUndefined();

    const snapshot = takeSoftStateSnapshot();
    first._softStateOverlay.value = 12n;
    second._softStateOverlay.value = 21n;
    snapshot.restore();

    expect(first._softStateOverlay.value).toBe(11n);
    expect(second._softStateOverlay.value).toBeUndefined();
    clearSoftBentoTotals();
  });
});
