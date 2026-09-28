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
import { publishedRefusals } from '../../../../solidc/test/per-call/master/refused-entry.js';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import {
  deployMaster,
  stateRecordLockingBytecode,
} from '../../../src/per-call/deploy/index.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import { buildProxyArtifact } from '../../../src/per-call/proxy/index.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory,
} from '../../../../solidc/test/per-call/master/validator-input.js';

/**
 * A read that hops through a proxy into another contract's view.
 *
 * Both the reading contract and the contract it reads are deployed behind a generated proxy, so each is reached at
 * the address its proxy derives and runs its implementation's code over the proxy's own record. The caller names
 * the callee's implementation in `externals` together with the proxy's category, and the shipped read module plans
 * one read-only frame at that category, which is the address the callee's source calls. A read is never broadcast,
 * which the provider's transaction count is asserted to show.
 *
 * Three walls are pinned rather than worked around. A view that returns a struct is refused by the compiler by
 * name, so a struct carrying a `string[]` never reaches the shipped decoder at all. A view that reads one callee
 * twice beside a length read is refused by the module, because a read plans one frame per contract. A callee entry
 * that takes a parameter is refused by the module too, because a read cannot resolve an argument from the caller's
 * live records.
 */

const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;

const READER_CATEGORY = seededCategory('proxied nested reads reader');
const STORE_CATEGORY = seededCategory('proxied nested reads store');
const READER_HEX = bytesToHex(READER_CATEGORY);
const STORE_HEX = bytesToHex(STORE_CATEGORY);
const READER_ADDRESS = validatorAddress(READER_CATEGORY, VALIDATOR_PROGRAM);
const STORE_ADDRESS = validatorAddress(STORE_CATEGORY, VALIDATOR_PROGRAM);

const hex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');
const empty = new Uint8Array(0);

/** The two implementations, each holding the `implementation` field its generated proxy forwards to. */
const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface IStore {'
  + '   function value() view returns (int);'
  + '   function count() view returns (int);'
  + '   function entry(int id) view returns (int);'
  + '   function guard() view returns (int);'
  + ' }'
  + ' contract Store {'
  + '   address public implementation;'
  + '   int public n;'
  + '   function value() view returns (int) { return this.n; }'
  + '   function count() view returns (int) { return this.n; }'
  + '   function entry(int id) view returns (int) { return this.n + id; }'
  + '   function guard() view returns (int) {'
  + '     require(this.n > 0, "n must be positive");'
  + '     return this.n;'
  + '   }'
  + ' }'
  + ' contract Reader {'
  + '   address public implementation;'
  + '   int public seed;'
  + `   function peek() view returns (int) { return IStore(0x${hex(STORE_ADDRESS)}).value(); }`
  + `   function both() view returns (int) {`
  + `     return IStore(0x${hex(STORE_ADDRESS)}).value() + IStore(0x${hex(STORE_ADDRESS)}).value()`
  + `       + IStore(0x${hex(STORE_ADDRESS)}).count();`
  + '   }'
  + `   function byId() view returns (int) { return IStore(0x${hex(STORE_ADDRESS)}).entry(2); }`
  + `   function guarded() view returns (int) { return IStore(0x${hex(STORE_ADDRESS)}).guard(); }`
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
const reader = artifacts.Reader!;
const store = artifacts.Store!;
const readerProxy = buildProxyArtifact(reader);
const storeProxy = buildProxyArtifact(store);

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
): UtxoShape {
  return {
    txid, vout: 0, satoshis,
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
  },
): Promise<void> {
  const deployed = deployMaster(options.proxy, options.category, VALIDATOR_PROGRAM);
  const txid = (suffix: string, pad: string): string => `${options.seed}${suffix}`.padEnd(64, pad).slice(0, 64);
  await provider.addUtxo(bytesToHex(deployed.lockingBytecode),
    utxo(txid('11', 'a'), 20_000n, options.categoryHex, 'minting', empty));
  if (options.withValidator === true) {
    await provider.addUtxo(bytesToHex(deployed.address),
      utxo(txid('22', 'b'), 20_000n, options.categoryHex, 'mutable', empty));
  }
  await provider.addUtxo(bytesToHex(stateRecordLockingBytecode(options.categoryHex)),
    utxo(txid('33', 'c'), 20_000n, options.categoryHex, 'mutable', options.record));
}

/** The chain the read runs against, with the store's own `n` set to the value the case needs. */
async function chain(n: bigint): Promise<MockNetworkProvider> {
  const provider = new MockNetworkProvider();
  await fund(provider, {
    proxy: readerProxy, category: READER_CATEGORY, categoryHex: READER_HEX, seed: 'a',
    record: recordOf(readerProxy.stateLayout, { implementation: READER_ADDRESS, seed: 5n }), withValidator: true,
  });
  await fund(provider, {
    proxy: storeProxy, category: STORE_CATEGORY, categoryHex: STORE_HEX, seed: 'b',
    record: recordOf(storeProxy.stateLayout, { implementation: STORE_ADDRESS, n }),
  });
  return provider;
}

/** The reader's own read of the store's implementation, named at the store's proxy category. */
function read(
  provider: MockNetworkProvider, functionName: string,
): ReturnType<typeof readPerCallEntry> {
  return readPerCallEntry({
    provider,
    artifact: reader,
    categoryId: READER_HEX,
    functionName,
    externals: { IStore: { artifact: store, categoryId: STORE_HEX } },
    vm: compositionMachine(),
  });
}

describe('a read that reaches another contract\'s implementation at its proxy address', () => {
  it('returns the value the callee computed, with nothing broadcast', async () => {
    const provider = await chain(7n);
    const before = transactionCount(provider);
    const result = await read(provider, 'peek');

    expect(result.accepted).toBe(true);
    expect(result.value).toBe(7n);
    expect(result.retval).toStrictEqual(encodeResultList([encodeIntegerValue(7n)]));
    // The read is a local evaluation: the provider's transaction count does not move.
    expect(transactionCount(provider)).toBe(before);
  });

  it('refuses an entry that reads one callee twice, naming the contract', async () => {
    // The `both` entry reads the store's `value` twice and its `count` once, so the read reaches one
    // implementation more than once; a read plans one frame per contract.
    const provider = await chain(7n);
    await expect(read(provider, 'both')).rejects.toThrow(
      /the read reaches "Store" more than once, and one read frame runs one entry per contract/,
    );
  });

  it('refuses a callee entry that takes a parameter, which a read cannot resolve', async () => {
    // The `byId` entry calls the store's `entry(id)`, whose argument the read has no record to read it from.
    const provider = await chain(7n);
    await expect(read(provider, 'byId')).rejects.toThrow(
      'entry "Store.entry()" takes 1 parameter(s), whose values a read cannot resolve from the caller\'s live '
        + 'records',
    );
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
  it('is refused by the compiler by name, so its value never reaches the decoder', () => {
    const source = 'pragma solidcash ^0.13.0;'
      + ' contract Catalog {'
      + '   struct Item { int id; string[] labels; }'
      + '   function item(int id) view returns (Item) { return Item(id, ["a"]); }'
      + ' }';
    // The struct return is published as a refusal rather than emitted, so the entry has no master the read could
    // plan and no `retval` blob the shipped decoder could be asked to decode.
    expect(publishedRefusals(compileStringMulti(source, { composition: 'per-call' }))).toStrictEqual([{
      functionName: 'Catalog.item()',
      reason: "the entry point 'item' returns a struct, but a frame's `retval` is compared with one scalar value "
        + 'the entry computed, which a composite value is not yet',
    }]);
  });
});
