import { buildChunkCommitment, type AbiFunction, type StateLayout } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import type { Contract } from '../../src/Contract.js';
import type { Output } from '../../src/interfaces.js';
import { addressToLockScript } from '../../src/utils.js';
import { getDynamicChunkAddress } from '../../src/stateful/covenant-helpers.js';
import { resolveMaterializedDynamicWriteOutputBase } from '../../src/stateful/stb-reconcile-dynamic-chunk-output-witnesses.js';

const categoryId = '11'.repeat(32);
const contract = {
  provider: { network: 'chipnet' },
  addressType: 'p2sh32',
} as unknown as Contract;
const route = {
  name: '__message_bus',
  dynamicWrites: ['first', 'second'],
} as AbiFunction;
const stateLayout = {
  variables: [
    { name: 'first', type: 'bytes[]', dynamic: true },
    { name: 'second', type: 'bytes[]', dynamic: true },
  ],
} as StateLayout;

function chunk(name: string, index = 0): Output {
  return {
    to: addressToLockScript(getDynamicChunkAddress(contract, categoryId, name, 'bytes[]')),
    amount: 1200n,
    token: {
      category: categoryId,
      amount: 0n,
      nft: { capability: 'mutable', commitment: buildChunkCommitment(index, Uint8Array.of(1)) },
    },
  };
}

const predecessor: Output = {
  to: Uint8Array.of(0x52),
  amount: 1200n,
  token: {
    category: categoryId,
    amount: 0n,
    nft: { capability: 'mutable', commitment: '00'.repeat(32) },
  },
};

function resolve(outputs: Output[]): number {
  return resolveMaterializedDynamicWriteOutputBase({
    route, stateLayout, contract, categoryId, outputs,
  });
}

describe('physical direct-dynamic output witness', () => {
  it('uses the first writer chunk, regardless of an earlier fixed predecessor slot', () => {
    expect(resolve([
      predecessor,
      { to: Uint8Array.of(0x51), amount: 1000n },
      chunk('first'), chunk('second'),
    ])).toBe(2);
  });

  it('uses the shifted first writer chunk when a predecessor is adjacent to the run', () => {
    expect(resolve([
      predecessor,
      chunk('first'), chunk('second'),
    ])).toBe(1);
  });

  it('accepts an output-only first push with no old input chunk', () => {
    expect(resolve([chunk('first')])).toBe(0);
  });

  it('rejects duplicate or separated writer runs rather than guessing a base', () => {
    expect(() => resolve([chunk('first'), chunk('first')])).toThrow(/noncanonical chunk/);
    expect(() => resolve([
      chunk('first'), { to: Uint8Array.of(0x51), amount: 1000n }, chunk('second'),
    ])).toThrow(/noncontiguous write band/);
  });
});
