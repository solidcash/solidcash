import { describe, expect, it } from 'vitest';
import {
  StatefulContract, clearSoftBentoTotals, takeSoftStateSnapshot,
} from '../../src/stateful/StatefulContract.js';

const softContract = (provider: object): StatefulContract => {
  const contract = Object.create(StatefulContract.prototype) as StatefulContract;
  Object.assign(contract as object, {
    _inner: { provider, address: 'same-contract-address' },
    _categoryId: 'same-category',
  });
  return contract;
};

describe('atomic composition snapshot isolation', () => {
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
