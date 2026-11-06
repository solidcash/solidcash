import { describe, expect, it } from 'vitest';
import {
  binToHex, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import { bytesEqual, bytesToHex, type FunctionSplitBundle, type StateLayout } from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc/runtime';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringSplit } from '../../../../solidc/src/compiler.js';
import { SignatureTemplate } from '../../../src/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import type NetworkProvider from '../../../src/network/NetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import {
  categoryCoinsAtLocks,
  chunkRecordLockingBytecode,
  deployFunctionSplitShard,
  entryRecordLockingBytecode,
  framedCategoryAt,
  framedContractAddress,
  readFramedDeployment,
  readFramedState,
  stateRecordLockingBytecode,
  withMastersAt,
  type FramedDeploymentSet,
} from '../../../src/framed/deploy/index.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import { readFramedStorage } from '../../../src/framed/read/index.js';
import { alicePkh, alicePriv } from '../../fixture/vars.js';
import { byLockOnly, type LockListings } from '../by-lock-only.js';

/**
 * A framed deployment on a provider that lists by lock only, which is what a Fulcrum server is: it has no index by
 * token category. Every pool is reached at the lock its layout or entry derives, and what the read classifies is what a
 * read by category classifies, whatever else anyone paid to those locks.
 */

const FRAMED = { composition: 'framed' as const, suppressWarnings: true };
const VALIDATOR = framedValidator.buildValidatorProgram();
const SOURCE = `pragma solidity ^0.8.0;
contract Book {
  string public title;
  uint public total;
  mapping(address => uint) public balanceOf;
  mapping(string => string) public tags;
  constructor() { title = "a title"; }
  function credit(address who, uint amount) public { balanceOf[who] = balanceOf[who] + amount; total = total + amount; }
  function tag(string memory key, string memory value) public { tags[key] = value; }
  function retitle(string memory value) public { title = value; }
  function read() public view returns (uint) { return total; }
}`;
const bundle = compileStringSplit(SOURCE, { split: 'func', ...FRAMED, evmCompat: true });
const layout = bundle.logical.stateLayout as StateLayout;
const LONG = 'a note long enough that the node keeps only its hash and the chunks hold the rest of it, as they do';

let coinNonce = 0x1000;
const freshCoin = (satoshis: bigint): Utxo => {
  coinNonce += 1;
  return { txid: coinNonce.toString(16).padStart(64, '0'), vout: 0, satoshis };
};

interface Live {
  readonly chain: MockNetworkProvider;
  readonly provider: MockNetworkProvider;
  readonly listings: LockListings;
  readonly categoryId: string;
  readonly callerLock: Uint8Array;
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
}

const shardLock = (split: FunctionSplitBundle, name: string, categoryId: string): Uint8Array => {
  const shard = split.shards.find((candidate) => candidate.function === name);
  if (shard === undefined) throw new Error(`missing shard ${name}`);
  return deployFunctionSplitShard(shard, hexToBin(categoryId), VALIDATOR).lockingBytecode;
};

async function deployLive(): Promise<Live> {
  const chain = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const listings: LockListings = { asked: [] };
  const provider = byLockOnly(chain, listings);
  const signature = new SignatureTemplate(alicePriv);
  const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
  const funding = freshCoin(2_000_000n);
  await chain.addUtxo(binToHex(callerLock), funding);
  const encoded = lockingBytecodeToCashAddress({ bytecode: callerLock, prefix: 'bchtest' });
  if (typeof encoded === 'string') throw new Error(encoded);
  const { categoryId } = await deployStatefulContract(bundle.logical, [], {
    provider, fundingUtxo: funding, funder: signature.unlockP2PKH(), changeAddress: encoded.address,
    threadCount: 2, validatorCount: 1, functionSplit: bundle,
  });
  return { chain, provider, listings, categoryId, callerLock, funder: signature.unlockP2PKH() };
}

async function enter(live: Live, functionName: string, args: readonly unknown[]): Promise<FramedCallResult> {
  const callerUtxo = freshCoin(600_000n);
  await live.chain.addUtxo(binToHex(live.callerLock), callerUtxo);
  const result = await callFramedEntry({
    provider: live.provider, artifact: bundle.logical, categoryId: live.categoryId, functionName, args: args as never,
    callerUtxo, callerLockingBytecode: live.callerLock, funder: live.funder, split: bundle,
    vm: compositionMachine(), validatorProgram: VALIDATOR, publish: true,
  } as never);
  expect(result.accepted, result.verdicts.filter((verdict) => !verdict.accepted)
    .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ')).toBe(true);
  return result;
}

/** Each pool's coins as outpoints, in order, keyed for comparing two reads of one deployment. */
function shape(deployment: FramedDeploymentSet): Record<string, unknown> {
  const outpoints = (coins: readonly Utxo[]): string[] => coins.map((coin) => `${coin.txid}:${coin.vout}`).sort();
  return {
    validators: outpoints(deployment.validators),
    records: outpoints(deployment.records),
    chunks: outpoints(deployment.chunks),
    nodes: outpoints(deployment.collectionNodes),
    byCollection: Object.fromEntries([...deployment.nodesByCollection].map(([name, nodes]) => [name, outpoints(nodes)])),
  };
}

describe('a framed deployment read by lock', () => {
  it('has no category index to fall back on', async () => {
    const live = await deployLive();
    expect(live.provider.getUtxosByTokenCategory).toBeUndefined();
    expect('getUtxosByTokenCategory' in live.provider).toBe(false);
    const [coin] = await live.provider.getUtxos(framedContractAddress('mocknet', live.categoryId));
    expect(coin?.lockingBytecode).toBeUndefined();
  });

  it('finds what a read by category finds, chunks of long mapping values included', async () => {
    const live = await deployLive();
    const who = encodeLockingBytecodeP2pkh(alicePkh);
    await enter(live, 'credit', [who, 7n]);
    await enter(live, 'tag', ['short', 'inline']);
    await enter(live, 'tag', ['long', LONG]);
    await enter(live, 'retitle', [`${LONG} and a title that needs chunks of its own, past the first`]);

    const creditLock = shardLock(bundle, 'credit', live.categoryId);
    const readLock = shardLock(bundle, 'read', live.categoryId);
    const byCategory = await readFramedDeployment(live.chain, live.categoryId, layout);
    const byLock = await readFramedDeployment(live.provider, live.categoryId, layout, {
      masterLocks: [creditLock, readLock],
    });

    expect(shape(byLock)).toStrictEqual(shape(byCategory));
    expect(byLock.chunks.length).toBeGreaterThan(0);
    // The long value's chunks sit at a lock only their node names, so the second listing is what found them.
    const nodeChunks = byCategory.collectionNodes.filter((node) => !(byCategory.nodesByCollection.get('tags') ?? [])
      .concat(byCategory.nodesByCollection.get('balanceOf') ?? []).includes(node));
    expect(nodeChunks.length).toBeGreaterThan(0);
    const wanted = (coins: readonly Utxo[]): string[] => coins.map((coin) => coin.lockingBytecode === undefined
      ? '' : bytesToHex(coin.lockingBytecode)).sort();
    expect(wanted(byLock.masters)).toStrictEqual(wanted(byCategory.masters.filter((master) =>
      [creditLock, readLock].some((lock) => bytesEqual(lock, master.lockingBytecode!)))));
    for (const coin of [...byLock.masters, ...byLock.validators, ...byLock.records, ...byLock.collectionNodes]) {
      expect(coin.lockingBytecode, 'a coin keeps the lock it was listed at').toBeDefined();
    }
  }, 120_000);

  it('reads only the entry locks it is told of, and a later frame adds its own', async () => {
    const live = await deployLive();
    const creditLock = shardLock(bundle, 'credit', live.categoryId);
    const readLock = shardLock(bundle, 'read', live.categoryId);
    live.listings.asked.length = 0;
    const first = await readFramedDeployment(live.provider, live.categoryId, layout, { masterLocks: [creditLock] });
    expect(live.listings.asked).toContain(bytesToHex(creditLock));
    expect(live.listings.asked).not.toContain(bytesToHex(readLock));
    expect(first.masters.length).toBe(2);

    const both = await withMastersAt(live.provider, live.categoryId, first, [readLock]);
    expect(both.masters.length).toBe(4);
    expect(both.mastersByLock.get(bytesToHex(readLock))?.length).toBe(2);
    live.listings.asked.length = 0;
    const again = await withMastersAt(live.provider, live.categoryId, both, [creditLock, readLock]);
    expect(again).toBe(both);
    expect(live.listings.asked).toHaveLength(0);
    // A provider that holds a category index has every master already, so it lists nothing more.
    const indexed = await readFramedDeployment(live.chain, live.categoryId, layout);
    await expect(withMastersAt(live.chain, live.categoryId, indexed, [readLock])).resolves.toBe(indexed);
  });

  it('refuses a foreign token at every lock it lists', async () => {
    const live = await deployLive();
    const foreign = (commitment: string, capability: 'mutable' | 'minting' | 'none') => ({
      ...freshCoin(1_000n),
      token: { category: 'ff'.repeat(32), amount: 0n, nft: { capability, commitment } },
    });
    const creditLock = shardLock(bundle, 'credit', live.categoryId);
    const before = await readFramedDeployment(live.provider, live.categoryId, layout, { masterLocks: [creditLock] });
    const record = before.records[0]!.token!.nft!.commitment;
    const validatorLock = hexToBin(before.validators[0]!.lockingBytecode === undefined ? ''
      : binToHex(before.validators[0]!.lockingBytecode));
    const paid = [
      [stateRecordLockingBytecode(live.categoryId), foreign(record, 'mutable')],
      [validatorLock, foreign('', 'mutable')],
      [creditLock, foreign('', 'minting')],
      [entryRecordLockingBytecode(live.categoryId, layout.collections![0]!.signature), foreign('00'.repeat(70), 'mutable')],
      [chunkRecordLockingBytecode(live.categoryId, 'title', 'string'), foreign('00'.repeat(40), 'mutable')],
    ] as const;
    for (const [lock, coin] of paid) await live.chain.addUtxo(binToHex(lock), coin);

    const after = await readFramedDeployment(live.provider, live.categoryId, layout, { masterLocks: [creditLock] });
    expect(shape(after)).toStrictEqual(shape(before));
    expect(after.masters.map((coin) => coin.txid)).toStrictEqual(before.masters.map((coin) => coin.txid));
    const state = await readFramedState(live.provider, live.categoryId, layout);
    expect(state.records.map((coin) => coin.txid)).toStrictEqual(before.records.map((coin) => coin.txid));
    const listed = await categoryCoinsAtLocks(live.provider, live.categoryId, paid.map(([lock]) => lock));
    expect(listed.every((coin) => coin.token?.category === live.categoryId)).toBe(true);
  });

  it('calls and reads through it, and lists no entry the call does not run', async () => {
    const live = await deployLive();
    const who = encodeLockingBytecodeP2pkh(alicePkh);
    live.listings.asked.length = 0;
    await enter(live, 'credit', [who, 7n]);
    const creditLock = bytesToHex(shardLock(bundle, 'credit', live.categoryId));
    const tagLock = bytesToHex(shardLock(bundle, 'tag', live.categoryId));
    expect(live.listings.asked).toContain(creditLock);
    expect(live.listings.asked).not.toContain(tagLock);
    await enter(live, 'credit', [who, 5n]);

    const state = await readFramedState(live.provider, live.categoryId, layout);
    const total = state.byNft.flatMap((values) => (values.total === undefined ? [] : [values.total]));
    expect(total).toStrictEqual([12n]);
    const storage = await readFramedStorage({ provider: live.provider, artifact: bundle.logical, categoryId: live.categoryId });
    expect(await storage.read('total')).toStrictEqual([12n]);
    expect(await storage.read('title')).toBeDefined();
    expect(await storage.read('balanceOf', [who])).toStrictEqual([12n]);
  }, 120_000);

  it('takes a storage snapshot past a foreign coin at a record lock', async () => {
    const live = await deployLive();
    const before = await readFramedStorage({ provider: live.provider, artifact: bundle.logical, categoryId: live.categoryId });
    const forged = {
      ...freshCoin(1_000n),
      token: {
        category: 'ee'.repeat(32), amount: 0n,
        nft: { capability: 'mutable' as const, commitment: before.records[0]!.token!.nft!.commitment },
      },
    };
    await live.chain.addUtxo(binToHex(stateRecordLockingBytecode(live.categoryId)), forged);
    const after = await readFramedStorage({ provider: live.provider, artifact: bundle.logical, categoryId: live.categoryId });
    expect(after.records.map((coin) => coin.txid)).toStrictEqual(before.records.map((coin) => coin.txid));
  });
});

describe('the category a framed address names', () => {
  const addressOf = (categoryId: string): string => framedContractAddress('mocknet', categoryId);

  it('is the one that derives the address, wherever the coin sits in the listing', async () => {
    const live = await deployLive();
    const address = addressOf(live.categoryId);
    const dust = {
      txid: '00'.repeat(32), vout: 7, satoshis: 1_000n,
      token: { category: 'dd'.repeat(32), amount: 5n },
    };
    await live.chain.addUtxo(address, dust);
    const provider = {
      ...live.provider,
      network: live.provider.network,
      // A server orders a listing by height, so the foreign coin may well come first.
      getUtxos: async (listed: string) => (await live.provider.getUtxos(listed))
        .sort((left) => (left.txid === dust.txid ? -1 : 1)),
    } as unknown as NetworkProvider;
    expect((await provider.getUtxos(address))[0]?.txid).toBe(dust.txid);
    await expect(framedCategoryAt(provider, address)).resolves.toBe(live.categoryId);
  });

  it('is nothing when no coin there derives it', async () => {
    const live = await deployLive();
    const elsewhere = addressOf('cc'.repeat(32));
    await live.chain.addUtxo(elsewhere, {
      txid: '00'.repeat(32), vout: 8, satoshis: 1_000n, token: { category: 'dd'.repeat(32), amount: 5n },
    });
    await expect(framedCategoryAt(live.provider, elsewhere)).resolves.toBeUndefined();
  });
});
