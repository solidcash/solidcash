import { describe, expect, it } from 'vitest';
import { materializeInternalFunctionArgument } from '../../src/stateful/StatefulContract.js';

describe('stateful return argument materialization', () => {
  it('replaces a provisional return index without shifting later internal witnesses', () => {
    const inputs = [
      { name: 'value', type: 'int' },
      { name: '__internal__returnOutputIdx', type: 'int' },
      { name: '__internal__proof', type: 'bytes' },
    ];
    const proof = Uint8Array.of(1, 2, 3);
    expect(materializeInternalFunctionArgument(
      [7n, -1n, proof], inputs, '__internal__returnOutputIdx', 6n,
    )).toEqual([7n, 6n, proof]);
  });

  it('fills preceding internal slots but refuses to cross a missing visible argument', () => {
    expect(materializeInternalFunctionArgument(
      [7n],
      [
        { name: 'value', type: 'int' },
        { name: '__internal__proof', type: 'bytes' },
        { name: '__internal__returnOutputIdx', type: 'int' },
      ],
      '__internal__returnOutputIdx',
      6n,
    )).toEqual([7n, new Uint8Array(), 6n]);
    expect(() => materializeInternalFunctionArgument(
      [],
      [{ name: 'value', type: 'int' }, { name: '__internal__returnOutputIdx', type: 'int' }],
      '__internal__returnOutputIdx',
      6n,
    )).toThrow(/missing visible ABI argument 'value'/);
  });
});
