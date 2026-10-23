import { describe, expect, it } from 'vitest';
import {
  buildChunkCommitment,
  buildPushdataCommitment,
  bytesToHex,
  dynamicLenKey,
  packFixedWidthArray,
  parseArrayTypeString,
  splitValueIntoChunks,
  validatorAddress,
  type Artifact,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import {
  chunkRecordLockingBytecode,
  deployMaster,
  stateRecordLockingBytecode,
} from '../../../src/framed/deploy/index.js';
import { buildProxyArtifact } from '../../../src/framed/proxy/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory,
} from '../../../../solidc/test/framed/master/validator-input.js';

/**
 * A read whose call site sits in a loop whose bound comes from an earlier call's result.
 *
 * The entry reads a count from another contract, bounds a loop by it and its own arguments, and calls the other
 * contract once per turn with an argument the turn's counter computes. The read cannot state those calls from the
 * caller's own facts, so it reads in passes, as the hop plans such a site: the count's frame is composed and learned
 * first, and the read is planned again with one callee frame per turn, each carrying its own turn's call data. Each
 * turn's value is folded into the answer in turn order, so the answer shows which turns ran and in which order.
 */

const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;

const PAGER_CATEGORY = seededCategory('loop bound from result pager');
const STORE_CATEGORY = seededCategory('loop bound from result store');
const PAGER_HEX = bytesToHex(PAGER_CATEGORY);
const STORE_HEX = bytesToHex(STORE_CATEGORY);
const STORE_ADDRESS = validatorAddress(STORE_CATEGORY, VALIDATOR_PROGRAM);

const hex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');
const empty = new Uint8Array(0);

/** The store answers its count and, per element, ten times the index plus one; the pager walks a page of them. */
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IStore { function count() view returns (int); function at(int i) view returns (int); }'
  + ' contract Store {'
  + '   int public n;'
  + '   function count() view returns (int) { return this.n; }'
  + '   function at(int i) view returns (int) { require(i < this.n, "no such element"); return i * 10 + 1; }'
  + ' }'
  + ' contract Pager {'
  + '   int public cap;'
  + '   function page(int index, int limit) view returns (int) {'
  + `     int total = IStore(0x${hex(STORE_ADDRESS)}).count();`
  + '     require(index <= total, "index out of bounds");'
  + '     int length = total - index;'
  + '     int bound = limit == 0 ? length : limit;'
  + '     int turns = length > bound ? bound : length;'
  + '     int acc = 0;'
  + '     for (int i = 0; i < turns; i = i + 1) {'
  + `       acc = acc * 100 + IStore(0x${hex(STORE_ADDRESS)}).at(i + index);`
  + '     }'
  + '     return acc;'
  + '   }'
  + '   function walk() view returns (int) {'
  + '     int acc = 0;'
  + '     for (int i = 0; i < this.cap; i = i + 1) {'
  + `       acc = acc + IStore(0x${hex(STORE_ADDRESS)}).at(i);`
  + '     }'
  + '     return acc;'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const pager = artifacts.Pager!;
const store = artifacts.Store!;

interface UtxoShape {
  readonly txid: string;
  readonly vout: number;
  readonly satoshis: bigint;
  readonly token: {
    readonly category: string;
    readonly amount: bigint;
    readonly nft: { readonly capability: 'minting' | 'mutable'; readonly commitment: string };
  };
}

/** One live UTXO as the provider holds it: a token of the category, with the commitment it carries. */
function utxo(
  txid: string, category: string, capability: 'minting' | 'mutable', commitment: Uint8Array, vout = 0,
): UtxoShape {
  return {
    txid, vout, satoshis: 20_000n,
    token: { category, amount: 0n, nft: { capability, commitment: bytesToHex(commitment) } },
  };
}

/** A data-NFT commitment as a layout materializes it. */
function recordOf(layout: Artifact['stateLayout'], values: Record<string, bigint | Uint8Array>): Uint8Array {
  return new Uint8Array(Buffer.from(buildPushdataCommitment(layout!, values, 0), 'hex'));
}

/** The provider's own transaction count, chain and mempool together. */
function transactionCount(provider: MockNetworkProvider): number {
  const snapshot = provider.indexer.storage.snapshot() as unknown as { txIndex: Map<string, unknown> };
  return snapshot.txIndex.size;
}

/**
 * Funds one contract's deployment: as many masters as the read runs frames over it, its record and, for the read's
 * root, the validator every frame runs under.
 */
async function fund(
  provider: MockNetworkProvider,
  options: {
    readonly artifact: Artifact;
    readonly category: Uint8Array;
    readonly seed: string;
    readonly masters: number;
    readonly record?: Uint8Array;
    readonly withValidator?: boolean;
  },
): Promise<void> {
  const deployed = deployMaster(options.artifact, options.category, VALIDATOR_PROGRAM);
  const categoryHex = bytesToHex(options.category);
  const txid = (suffix: string, pad: string): string => `${options.seed}${suffix}`.padEnd(64, pad).slice(0, 64);
  for (let index = 0; index < options.masters; index += 1) {
    await provider.addUtxo(bytesToHex(deployed.lockingBytecode),
      utxo(txid('11', 'a'), categoryHex, 'minting', empty, index));
  }
  if (options.withValidator === true) {
    await provider.addUtxo(bytesToHex(deployed.address), utxo(txid('22', 'b'), categoryHex, 'mutable', empty));
  }
  if (options.record !== undefined) {
    await provider.addUtxo(bytesToHex(stateRecordLockingBytecode(categoryHex)),
      utxo(txid('33', 'c'), categoryHex, 'mutable', options.record));
  }
}

/** The chain a read runs against: the pager, and a store of three elements with a master for every frame. */
async function chain(): Promise<MockNetworkProvider> {
  const provider = new MockNetworkProvider();
  await fund(provider, {
    artifact: pager, category: PAGER_CATEGORY, seed: 'a', masters: 1,
    record: recordOf(pager.stateLayout, { cap: 2n }), withValidator: true,
  });
  // The count's frame and one frame per turn: a page of the whole store runs four frames over it.
  await fund(provider, {
    artifact: store, category: STORE_CATEGORY, seed: 'b', masters: 4, record: recordOf(store.stateLayout, { n: 3n }),
  });
  return provider;
}

/** The pager's own read of one of its entries. */
function read(
  provider: MockNetworkProvider, functionName: string, args: readonly bigint[] = [],
): ReturnType<typeof readFramedEntry> {
  return readFramedEntry({
    provider,
    artifact: pager,
    categoryId: PAGER_HEX,
    functionName,
    args,
    externals: { IStore: { artifact: store, categoryId: STORE_HEX } },
    vm: compositionMachine(),
  });
}

/** How many frames of the read run the store's element entry: one per turn of the loop that called. */
function elementFrames(result: Awaited<ReturnType<typeof readFramedEntry>>): number {
  return result.draft.runs.filter((run) => run.functionName === 'Store.at()').length;
}

describe('a read whose call sits in a loop bounded by an earlier call\'s result', () => {
  it('runs as many turns as the count leaves, each with its own call data, with nothing broadcast', async () => {
    const provider = await chain();
    const before = transactionCount(provider);
    // The store holds three elements, so the page from `index` to its end runs three turns down to none; each
    // element answers ten times its index plus one, folded in turn order.
    const pages: readonly (readonly [bigint, bigint, number])[] = [
      [3n, 0n, 0], [2n, 21n, 1], [1n, 1121n, 2], [0n, 11121n, 3],
    ];
    for (const [index, value, turns] of pages) {
      const result = await read(provider, 'page', [index, 0n]);
      expect(result.accepted).toBe(true);
      expect(result.value).toBe(value);
      expect(elementFrames(result)).toBe(turns);
    }
    // The read is a local evaluation: the provider's transaction count does not move.
    expect(transactionCount(provider)).toBe(before);
  });

  it('runs no more turns than the entry\'s own limit allows', async () => {
    const result = await read(await chain(), 'page', [0n, 2n]);
    expect(result.accepted).toBe(true);
    expect(result.value).toBe(111n);
    expect(elementFrames(result)).toBe(2);
  });

  it('reports the entry\'s own guard when the count leaves the index out of range, placing no turn', async () => {
    const result = await read(await chain(), 'page', [4n, 0n]);
    expect(result.accepted).toBe(false);
    expect(result.refusal?.innermost?.functionName).toBe('Pager.page()');
    expect(result.refusal?.innermost?.reason.message).toBe('index out of bounds');
    expect(elementFrames(result)).toBe(0);
  });

  it('refuses by name a loop whose bound neither the arguments nor a learned result fixes', async () => {
    // The bound is the pager's own stored field, which a read holds no live record of while it plans.
    await expect(read(await chain(), 'walk')).rejects.toThrow(
      /the call to "IStore\.at\(\)" in entry "Pager\.walk\(\)" runs a loop whose bound is not fixed/,
    );
  });
});

/**
 * The same loop over a store behind its own generated proxy, in the Solidity-ABI spelling.
 *
 * The store keeps its elements in a dynamic array whose chunk run sits at the proxy's category, and the reader keeps
 * the store's address in its own record. Each turn's call is the pair of frames a proxied call is: the proxy's
 * fallback, which the reader's record names, and the implementation's delegate frame, which reads the array's run.
 */
const SHELF_CATEGORY = seededCategory('loop bound from result shelf proxy');
const SHELF_IMPL_CATEGORY = seededCategory('loop bound from result shelf impl');
const READER_CATEGORY = seededCategory('loop bound from result reader');
const SHELF_HEX = bytesToHex(SHELF_CATEGORY);
const SHELF_IMPL_HEX = bytesToHex(SHELF_IMPL_CATEGORY);
const READER_HEX = bytesToHex(READER_CATEGORY);
const SHELF_ADDRESS = validatorAddress(SHELF_CATEGORY, VALIDATOR_PROGRAM);
const SHELF_IMPL_ADDRESS = validatorAddress(SHELF_IMPL_CATEGORY, VALIDATOR_PROGRAM);

const PROXIED_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IShelf { function count() external view returns (uint); function at(uint i) external view returns (uint); }'
  + ' contract Shelf {'
  + '   address public implementation;'
  + '   uint[] items;'
  + '   function count() view returns (uint) { return items.length; }'
  + '   function at(uint i) view returns (uint) { return items[i]; }'
  + ' }'
  + ' contract Reader {'
  + '   address shelf;'
  + '   function list(uint index, uint limit) view returns (uint) {'
  + '     uint total = IShelf(shelf).count();'
  + '     require(index < total, "index out of bounds");'
  + '     uint length = total - index;'
  + '     uint bound = limit == 0 ? length : limit;'
  + '     uint turns = length > bound ? bound : length;'
  + '     uint acc = 0;'
  + '     for (uint i = 0; i < turns; i = i + 1) {'
  + '       acc = acc * 100 + IShelf(shelf).at(i + index);'
  + '     }'
  + '     return acc;'
  + '   }'
  + ' }';

const proxiedArtifacts = compileStringMulti(PROXIED_SOURCE, { composition: 'framed', evmCompat: true });
const reader = proxiedArtifacts.Reader!;
const shelf = proxiedArtifacts.Shelf!;
const shelfProxy = buildProxyArtifact(shelf);

const ITEMS = [5n, 6n, 7n];

/** The chain the proxied read runs against: the reader's record, the pair's master pools and the array's run. */
async function proxiedChain(): Promise<MockNetworkProvider> {
  const provider = new MockNetworkProvider();
  await fund(provider, {
    artifact: reader, category: READER_CATEGORY, seed: 'd', masters: 1,
    record: recordOf(reader.stateLayout, { shelf: SHELF_ADDRESS }), withValidator: true,
  });
  await fund(provider, { artifact: shelf, category: SHELF_IMPL_CATEGORY, seed: 'e', masters: 4 });
  // A run of fixed-width elements holds them packed, its length in bytes on the record.
  const items = shelf.stateLayout!.variables.find((variable) => variable.name === 'items')!;
  const bytes = packFixedWidthArray(ITEMS, parseArrayTypeString(items.type)!.elementType);
  await fund(provider, {
    artifact: shelfProxy, category: SHELF_CATEGORY, seed: 'f', masters: 4,
    record: recordOf(shelfProxy.stateLayout, {
      implementation: SHELF_IMPL_ADDRESS, [dynamicLenKey('items')]: BigInt(bytes.length),
    }),
  });
  const lock = chunkRecordLockingBytecode(SHELF_HEX, 'items', items.type);
  for (const [index, data] of splitValueIntoChunks(bytes).entries()) {
    const commitment = new Uint8Array(Buffer.from(buildChunkCommitment(index, data), 'hex'));
    await provider.addUtxo(bytesToHex(lock),
      utxo((0x77 + index).toString(16).padStart(2, '0').repeat(32), SHELF_HEX, 'mutable', commitment));
  }
  return provider;
}

describe('a read whose loop of calls reaches a store behind its own proxy', () => {
  it('runs one proxy pair per turn, each delegate frame reading its own element of the run', async () => {
    const provider = await proxiedChain();
    const list = (index: bigint, limit: bigint): ReturnType<typeof readFramedEntry> => readFramedEntry({
      provider,
      artifact: reader,
      categoryId: READER_HEX,
      functionName: 'list',
      args: [index, limit],
      externals: {
        IShelf: {
          artifact: shelf, categoryId: SHELF_HEX, proxyArtifact: shelfProxy, implementationCategoryId: SHELF_IMPL_HEX,
        },
      },
      vm: compositionMachine(),
    });

    const two = await list(0n, 2n);
    expect(two.accepted).toBe(true);
    expect(two.value).toBe(506n);
    expect(two.draft.runs.filter((run) => run.functionName === 'Shelf.at()')).toHaveLength(2);
    expect(two.draft.runs.filter((run) => run.functionName.endsWith('.__fallback()'))).toHaveLength(3);

    const rest = await list(1n, 10n);
    expect(rest.accepted).toBe(true);
    expect(rest.value).toBe(607n);
  });
});
