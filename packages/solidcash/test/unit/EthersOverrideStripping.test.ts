import { describe, expect, it } from 'vitest';
import { stripTrailingEthersOverrides } from '../../src/stateful/sc-build-namespaces.js';

describe('stripTrailingEthersOverrides', () => {
  it('drops a trailing {from} transaction override', () => {
    expect(stripTrailingEthersOverrides(['0xspender', { from: 'bchtest:qq...' }])).toEqual(['0xspender']);
  });

  it('drops a trailing override carrying other ethers transaction keys', () => {
    expect(stripTrailingEthersOverrides([1n, { from: 'addr', value: 5n, gasLimit: 21000n }])).toEqual([1n]);
  });

  it('keeps a plain struct argument whose fields are not override keys', () => {
    expect(stripTrailingEthersOverrides([{ lpToken: 'addr', allocPoint: 100n }])).toEqual([
      { lpToken: 'addr', allocPoint: 100n },
    ]);
  });

  it('keeps a {value} struct argument (no from marker)', () => {
    expect(stripTrailingEthersOverrides([{ value: 5n }])).toEqual([{ value: 5n }]);
  });

  it('keeps a non-object trailing argument', () => {
    expect(stripTrailingEthersOverrides(['x', 5n])).toEqual(['x', 5n]);
  });

  it('keeps Uint8Array and Array trailing arguments', () => {
    expect(stripTrailingEthersOverrides([new Uint8Array([1])])).toEqual([new Uint8Array([1])]);
    expect(stripTrailingEthersOverrides([[1, 2]])).toEqual([[1, 2]]);
  });

  it('keeps an empty trailing object', () => {
    expect(stripTrailingEthersOverrides([{}])).toEqual([{}]);
  });
});
