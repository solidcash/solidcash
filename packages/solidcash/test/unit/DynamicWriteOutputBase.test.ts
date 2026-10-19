import { buildChunkCommitment, type AbiFunction, type StateLayout } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import type { Contract } from '../../src/Contract.js';
import type { Output } from '../../src/interfaces.js';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import { addressToLockScript } from '../../src/utils.js';
import { getDynamicChunkAddress } from '../../src/stateful/covenant-helpers.js';
import type { ExternalCallUtxoGroup } from '../../src/stateful/external-call-utxo-group.js';
import {
  reconcileDynamicChunkOutputWitnesses,
  resolveMaterializedDynamicWriteOutputBase,
} from '../../src/stateful/stb-reconcile-dynamic-chunk-output-witnesses.js';

const categoryId = '11'.repeat(31) + 'ee';
// A direct contract's chunk covenant binds its 35-byte master lock.
const contract = {
  provider: { network: 'chipnet' },
  addressType: 'p2sh32',
  artifact: {},
  lockingBytecode: `aa20${'5a'.repeat(32)}87`,
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

function provisionalChunk(name: string): Output {
  const output = chunk(name);
  output.token!.nft!.commitment = '00';
  return output;
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

  it('uses selected trailing placeholders as provisional coordinates only', () => {
    const outputs = [predecessor, provisionalChunk('first'), provisionalChunk('first')];
    const params = { route, stateLayout, contract, categoryId, outputs,
      start: 1, selectedDynamicWrites: new Set(['first']), allowProvisionalChunks: true };
    expect(resolveMaterializedDynamicWriteOutputBase(params)).toBe(1);
    expect(() => resolveMaterializedDynamicWriteOutputBase({ ...params, allowProvisionalChunks: false }))
      .toThrow(/undecodable first chunk/);
  });

  it('does not treat a provisional read-only twin outside the writer band as a write', () => {
    const outputs = [provisionalChunk('first'), predecessor, provisionalChunk('first')];
    expect(resolveMaterializedDynamicWriteOutputBase({
      route, stateLayout, contract, categoryId, outputs,
      start: 2, selectedDynamicWrites: new Set(['first']), allowProvisionalChunks: true,
    })).toBe(2);
  });

  it('keeps canonical route-union twins as the base when no handler writes them', () => {
    expect(resolveMaterializedDynamicWriteOutputBase({
      route, stateLayout, contract, categoryId,
      outputs: [chunk('first'), chunk('second')],
      start: 0, selectedDynamicWrites: new Set(), allowProvisionalChunks: true,
    })).toBe(0);
  });

  it('does not turn an inactive route-union placeholder into a writer base', () => {
    expect(resolveMaterializedDynamicWriteOutputBase({
      route, stateLayout, contract, categoryId,
      outputs: [provisionalChunk('first')],
      start: 0, selectedDynamicWrites: new Set(), allowProvisionalChunks: true,
    })).toBe(-1);
  });

  it('rejects duplicate or separated writer runs rather than guessing a base', () => {
    expect(() => resolve([chunk('first'), chunk('first')])).toThrow(/noncanonical first chunk/);
    expect(() => resolve([
      chunk('first'), { to: Uint8Array.of(0x51), amount: 1000n }, chunk('second'),
    ])).toThrow(/noncontiguous write band/);
  });
});

describe('non-composed dynamic-output witness of a delegate', () => {
  // The executing implementation has its own master lock; the proxy's chunks bind the proxy master's lock.
  const implementation = {
    ...contract,
    lockingBytecode: `aa20${'6b'.repeat(32)}87`,
  } as unknown as Contract;
  const routeWithBase = {
    ...route,
    inputs: [{ name: '__internal__dynamicChunkOutputBase', type: 'bigint' }],
  } as AbiFunction;
  const outputs = [predecessor, chunk('first'), chunk('second')];
  const builder = { outputs } as unknown as TransactionBuilder;
  const delegate = (published: Array<Record<string, unknown>>): ExternalCallUtxoGroup => ({
    categoryId: '22'.repeat(31) + 'dd',
    callMode: 'delegatecall',
    stateLayout,
    externalContract: { inner: implementation },
    compilerRoute: { abiFunction: routeWithBase },
    internalArgs: {},
    refreshInternalArgs: (args: Record<string, unknown>) => { published.push(args); },
  }) as unknown as ExternalCallUtxoGroup;

  it('locates a called proxy\'s chunks at the proxy lock', () => {
    const published: Array<Record<string, unknown>> = [];
    const proxyGroup = {
      categoryId, externalContract: { inner: contract }, delegateCallGroupIndex: 0,
    } as unknown as ExternalCallUtxoGroup;
    reconcileDynamicChunkOutputWitnesses([proxyGroup], [delegate(published)], categoryId, builder, undefined);
    expect(published).toEqual([{ __internal__dynamicChunkOutputBase: 1n }]);
  });

  it('locates a root proxy\'s chunks at the root lock', () => {
    const published: Array<Record<string, unknown>> = [];
    reconcileDynamicChunkOutputWitnesses([], [delegate(published)], categoryId, builder, contract);
    expect(published).toEqual([{ __internal__dynamicChunkOutputBase: 1n }]);
    expect(() => reconcileDynamicChunkOutputWitnesses([], [delegate([])], categoryId, builder, undefined))
      .toThrow(/no root state contract/);
  });
});
