import { describe, expect, it } from 'vitest';
import {
  bytesToHex,
  buildPushdataCommitment,
  encodeIntegerValue,
  encodeResultList,
  validatorAddress,
  type Artifact,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { publishedRefusals } from '../../../../solidc/test/framed/master/refused-entry.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import {
  deployMaster,
  stateRecordLockingBytecode,
} from '../../../src/framed/deploy/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import { buildProxyArtifact } from '../../../src/framed/proxy/index.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory,
} from '../../../../solidc/test/framed/master/validator-input.js';

/**
 * A read that hops through a proxy into another contract's view.
 *
 * Both the reading contract and the contract it reads are deployed behind a generated proxy, so each is reached at
 * the address its proxy derives and runs its implementation's code over the proxy's own record. The caller names
 * the callee's implementation in `externals` together with the proxy's category, and the shipped read module plans
 * one read-only frame at that category, which is the address the callee's source calls. A read is never broadcast,
 * which the provider's transaction count is asserted to show.
 *
 * A callee entry that takes a parameter is served when the caller's own code states the argument: the literal an
 * entry passes is resolved by the shipped resolver, exactly as the hop resolves its own call data
 * (`reads/read-through-external.test.ts`, "states a literal argument the caller pinned in its own code"). Everything
 * else the shape needs is served too: a view that returns a struct is one pushdata blob the shipped decoder reads
 * back, a contract a caller reaches more than once runs one frame per call with its own master each, and an entry
 * that makes two calls derives.
 */

const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;

const READER_CATEGORY = seededCategory('proxied nested reads reader');
const STORE_CATEGORY = seededCategory('proxied nested reads store');
const PEER_CATEGORY = seededCategory('proxied nested reads peer');
const READER_HEX = bytesToHex(READER_CATEGORY);
const STORE_HEX = bytesToHex(STORE_CATEGORY);
const PEER_HEX = bytesToHex(PEER_CATEGORY);
const READER_ADDRESS = validatorAddress(READER_CATEGORY, VALIDATOR_PROGRAM);
const STORE_ADDRESS = validatorAddress(STORE_CATEGORY, VALIDATOR_PROGRAM);
const PEER_ADDRESS = validatorAddress(PEER_CATEGORY, VALIDATOR_PROGRAM);
const CATALOG_CATEGORY = seededCategory('proxied nested reads catalog');
const CATALOG_HEX = bytesToHex(CATALOG_CATEGORY);

const hex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');
const empty = new Uint8Array(0);

/** The two implementations, each holding the `implementation` field its generated proxy forwards to. */
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IStore {'
  + '   function value() view returns (int);'
  + '   function count() view returns (int);'
  + '   function guard() view returns (int);'
  + ' }'
  + ' contract Store {'
  + '   address public implementation;'
  + '   int public n;'
  + '   function value() view returns (int) { return this.n; }'
  + '   function count() view returns (int) { return this.n; }'
  + '   function guard() view returns (int) {'
  + '     require(this.n > 0, "n must be positive");'
  + '     return this.n;'
  + '   }'
  + ' }'
  + ' interface IPeer { function value() view returns (int); }'
  + ' contract Peer {'
  + '   address public implementation;'
  + '   int public n;'
  + '   function value() view returns (int) { return this.n; }'
  + ' }'
  + ' contract Reader {'
  + '   address public implementation;'
  + '   int public seed;'
  + `   function peek() view returns (int) { return IStore(0x${hex(STORE_ADDRESS)}).value(); }`
  + '   function both() view returns (int) {'
  + `     return IStore(0x${hex(STORE_ADDRESS)}).value() + IStore(0x${hex(STORE_ADDRESS)}).value()`
  + `       + IStore(0x${hex(STORE_ADDRESS)}).count();`
  + '   }'
  + '   function mix() view returns (int) {'
  + `     int first = IStore(0x${hex(STORE_ADDRESS)}).value();`
  + `     int second = IPeer(0x${hex(PEER_ADDRESS)}).value();`
  + '     return first + second;'
  + '   }'
  + `   function guarded() view returns (int) { return IStore(0x${hex(STORE_ADDRESS)}).guard(); }`
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const reader = artifacts.Reader!;
const store = artifacts.Store!;
const peer = artifacts.Peer!;
const readerProxy = buildProxyArtifact(reader);
const storeProxy = buildProxyArtifact(store);
const peerProxy = buildProxyArtifact(peer);

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

/** One live UTXO as the provider holds it: a token at the given category, with the commitment it carries. */
function utxo(
  txid: string, satoshis: bigint, category: string, capability: 'minting' | 'mutable', commitment: Uint8Array,
  vout = 0,
): UtxoShape {
  return {
    txid, vout, satoshis,
    token: { category, amount: 0n, nft: { capability, commitment: bytesToHex(commitment) } },
  };
}

/** The provider's own transaction count, chain and mempool together. */
function transactionCount(provider: MockNetworkProvider): number {
  const snapshot = provider.indexer.storage.snapshot() as unknown as { txIndex: Map<string, unknown> };
  return snapshot.txIndex.size;
}

/** A data-NFT commitment as the generated proxy's own layout materializes it, for the record the proxy keeps. */
function recordOf(layout: Artifact['stateLayout'], values: Record<string, bigint | Uint8Array>): Uint8Array {
  return new Uint8Array(Buffer.from(buildPushdataCommitment(layout!, values, 0), 'hex'));
}

/**
 * Funds one proxied contract's deployment: the proxy's master pool, the proxy's record, and — for the root — the
 * validator every frame of the read runs under.
 *
 * The master and the record sit where the generated proxy's own deployment puts them, so the chain the read runs
 * against is the one a proxied deployment leaves.
 */
async function fund(
  provider: MockNetworkProvider,
  options: {
    readonly proxy: Artifact;
    readonly category: Uint8Array;
    readonly categoryHex: string;
    readonly seed: string;
    readonly record: Uint8Array;
    readonly withValidator?: boolean;
    /** How many masters of the contract the chain holds: one per frame the read runs over it. */
    readonly masters?: number;
  },
): Promise<void> {
  const deployed = deployMaster(options.proxy, options.category, VALIDATOR_PROGRAM);
  const txid = (suffix: string, pad: string): string => `${options.seed}${suffix}`.padEnd(64, pad).slice(0, 64);
  const masters = options.masters ?? 1;
  for (let index = 0; index < masters; index += 1) {
    await provider.addUtxo(bytesToHex(deployed.lockingBytecode),
      utxo(txid(String(11 + index), 'a'), 20_000n, options.categoryHex, 'minting', empty, index));
  }
  if (options.withValidator === true) {
    await provider.addUtxo(bytesToHex(deployed.address),
      utxo(txid('22', 'b'), 20_000n, options.categoryHex, 'mutable', empty));
  }
  await provider.addUtxo(bytesToHex(stateRecordLockingBytecode(options.categoryHex)),
    utxo(txid('33', 'c'), 20_000n, options.categoryHex, 'mutable', options.record));
}

/** The chain the read runs against, with the store's own `n` set to the value the case needs. */
async function chain(n: bigint, options: { readonly storeMasters?: number } = {}): Promise<MockNetworkProvider> {
  const provider = new MockNetworkProvider();
  await fund(provider, {
    proxy: readerProxy, category: READER_CATEGORY, categoryHex: READER_HEX, seed: 'a',
    record: recordOf(readerProxy.stateLayout, { implementation: READER_ADDRESS, seed: 5n }), withValidator: true,
  });
  await fund(provider, {
    proxy: storeProxy, category: STORE_CATEGORY, categoryHex: STORE_HEX, seed: 'b',
    record: recordOf(storeProxy.stateLayout, { implementation: STORE_ADDRESS, n }),
    masters: options.storeMasters,
  });
  await fund(provider, {
    proxy: peerProxy, category: PEER_CATEGORY, categoryHex: PEER_HEX, seed: 'c',
    record: recordOf(peerProxy.stateLayout, { implementation: PEER_ADDRESS, n }),
  });
  return provider;
}

/** Funds a contract that keeps no state: the master it runs on and the validator a read frame needs. */
async function fundStateless(
  provider: MockNetworkProvider, artifact: Artifact, category: Uint8Array, seed: string,
): Promise<void> {
  const deployed = deployMaster(artifact, category, VALIDATOR_PROGRAM);
  const categoryHex = bytesToHex(category);
  const txid = (suffix: string, pad: string): string => `${seed}${suffix}`.padEnd(64, pad).slice(0, 64);
  await provider.addUtxo(bytesToHex(deployed.lockingBytecode),
    utxo(txid('11', 'a'), 20_000n, categoryHex, 'minting', empty));
  await provider.addUtxo(bytesToHex(deployed.address),
    utxo(txid('22', 'b'), 20_000n, categoryHex, 'mutable', empty));
}

/** The reader's own read of the store's implementation, named at the store's proxy category. */
function read(
  provider: MockNetworkProvider, functionName: string,
): ReturnType<typeof readFramedEntry> {
  return readFramedEntry({
    provider,
    artifact: reader,
    categoryId: READER_HEX,
    functionName,
    externals: {
      IStore: { artifact: store, categoryId: STORE_HEX },
      IPeer: { artifact: peer, categoryId: PEER_HEX },
    },
    vm: compositionMachine(),
  });
}

describe('a read that reaches another contract\'s implementation at its proxy address', () => {
  it('returns a callee read once, then a second contract read once', async () => {
    // Two call sites, two callees, one frame each: the entry's own computation is over both results.
    const provider = await chain(7n);
    const before = transactionCount(provider);
    const result = await read(provider, 'mix');

    expect(result.accepted).toBe(true);
    expect(result.value).toBe(14n);
    expect(result.retval).toStrictEqual(encodeResultList([encodeIntegerValue(14n)]));
    // The read is a local evaluation: the provider's transaction count does not move.
    expect(transactionCount(provider)).toBe(before);
  });

  it('returns one callee read twice beside a length read: the read runs one frame per call', async () => {
    // The `both` entry reads the store's `value` twice and its `count` once, so the store is reached by three call
    // sites and the chain holds as many masters of it as the read has frames over it.
    const provider = await chain(7n, { storeMasters: 3 });
    const result = await read(provider, 'both');

    expect(result.accepted).toBe(true);
    expect(result.value).toBe(21n);
  });

  it('reports the innermost refusal of a callee reached at its proxy, and builds nothing', async () => {
    const provider = await chain(0n);
    const before = transactionCount(provider);
    const result = await read(provider, 'guarded');

    expect(result.accepted).toBe(false);
    // The callee is the innermost frame: the caller's body never returns because the callee refused.
    expect(result.refusal?.innermost?.contract).toBe('Store');
    expect(result.refusal?.innermost?.functionName).toBe('Store.guard()');
    expect(result.objection).toMatch(/frame "read-1" of Store\.guard\(\) at line \d+/);
    expect(result.objection).toMatch(/OP_VERIFY/);
    expect(result.values).toStrictEqual([]);
    expect(transactionCount(provider)).toBe(before);
  });
});

describe('a view whose return type is a struct', () => {
  it('is served by the compiler, so its blob is the one the shipped decoder reads', () => {
    const source = 'pragma solidcash ^0.14.0;'
      + ' contract Catalog {'
      + '   struct Item { int id; string[] labels; }'
      + '   function item(int id) view returns (Item) { return Item(id, ["a"]); }'
      + ' }';
    // A struct is one pushdata blob the entry's own `return` leaves, so a struct-returning view is admitted like one
    // returning a fixed-size array: the entry has a master the read can plan and a `retval` blob to decode.
    expect(publishedRefusals(compileStringMulti(source, { composition: 'framed' }))).toStrictEqual([]);
  });

  it('reads a struct carrying a string list back, decoded through the shipped decoder', async () => {
    const source = 'pragma solidcash ^0.14.0;'
      + ' contract Catalog {'
      + '   struct Item { int id; string[] labels; }'
      + '   function item() view returns (Item) { return Item(7, ["a", "b"]); }'
      + ' }';
    const catalog = compileStringMulti(source, { composition: 'framed' }).Catalog!;
    const provider = new MockNetworkProvider();
    await fundStateless(provider, catalog, CATALOG_CATEGORY, 'd');

    const result = await readFramedEntry({
      provider, artifact: catalog, categoryId: CATALOG_HEX, functionName: 'item', vm: compositionMachine(),
    });

    // The entry's own `return` is the blob the frame records, and the read's answer is that blob decoded.
    expect(result.accepted).toBe(true);
    expect(result.values).toStrictEqual([{ id: 7n, labels: ['a', 'b'] }]);
  });
});
