import { describe, expect, it } from 'vitest';
import { bigIntToVmNumber, binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { bytesToHex, sha256 } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { readPerCallDeployment } from '../../../src/per-call/deploy/index.js';
import { buildProxyArtifact, deployPerCallProxy } from '../../../src/per-call/proxy/index.js';
import { callPerCallProxyEntry, type PerCallProxyCallResult } from '../../../src/per-call/proxy/deploy.js';
import { requireSatisfiableReachWrites, type HopCallee } from '../../../src/per-call/proxy/external-calls.js';
import { decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * Two reaches of one hop that would each mint the head sentinel of one collection, refused before any broadcast.
 *
 * A call into a collection the deployment holds no node of plans its first write against the empty list, and the
 * hop mints that list's head in its own transaction. Each reach of a callee is planned on its own against the
 * deployment, so two reaches into one empty collection each minted a head. Measured on the mock before the refusal:
 * two appends to one key of a dynamic value (`logTwice`, the shape of a store's per-job event log) broadcast two
 * heads and two nodes for that key, and two inserts of different keys into a fixed-width value (`putTwo`) broadcast
 * two heads. Every input's program accepted both, since no rule on chain counts a collection's heads.
 *
 * Until the convention decides where a head may be created (only at genesis, or under a per-collection census in
 * the validator), the hop's cross-reach check refuses the shape by name (`requireSatisfiableReachWrites`,
 * `proxy/external-calls.ts`). One reach that mints the head in a call still settles.
 */

/** A 32-byte category or txid that is neither one repeated byte nor a palindrome, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`two created heads ${label}`)));
}

const STORE_IMPL_CATEGORY = idOf('store implementation');
const STORE_PROXY_CATEGORY = idOf('store proxy');
const ROOT_IMPL_CATEGORY = idOf('root implementation');
const ROOT_PROXY_CATEGORY = idOf('root proxy');

/** A proxied store whose two collections its initialize leaves empty, and a proxied root that reaches it. */
const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface IStore { function log(int id, int v); function put(int id, int v); }'
  + ' contract Store {'
  + '   address public implementation;'
  + '   int public hits;'
  + '   mapping(int => int[]) logs;'
  + '   mapping(int => int) counts;'
  + '   function initialize() { this.hits = 1; require(true); }'
  + '   function log(int id, int v) { this.logs[id].push(v); }'
  + '   function put(int id, int v) { this.counts[id] = v; }'
  + ' }'
  + ' contract Root {'
  + '   address public implementation;'
  + '   address public store;'
  + '   function initialize(address s) { this.store = s; require(true); }'
  + '   function logOnce(int id, int v) { IStore(this.store).log(id, v); }'
  + '   function logTwice(int id) { IStore(this.store).log(id, 5); IStore(this.store).log(id, 6); }'
  + '   function putTwo(int first, int second) {'
  + '     IStore(this.store).put(first, 10); IStore(this.store).put(second, 20);'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
const store = artifacts.Store!;
const root = artifacts.Root!;

/** A coin a genesis or a hop is funded from; a genesis's txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** The deployment the cases share, and the chain as it stood when the deployment was done. */
interface World {
  readonly network: MockNetworkProvider;
  readonly rootProxyCategoryId: string;
  readonly rootImplementationCategoryId: string;
  readonly storeProxyCategoryId: string;
  readonly storeImplementationCategoryId: string;
  readonly callerLock: Uint8Array;
  readonly changeAddress: string;
  readonly callCoin: { txid: string; vout: number; satoshis: bigint };
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
  readonly snapshot: SnapshotRestorer;
}

/** Deploys the store and the root behind their proxies, and runs both initializes. */
async function deployWorld(): Promise<World> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, signature);
  const callerFunder = signature.unlockP2PKH();
  const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
  for (const categoryId of [STORE_IMPL_CATEGORY, STORE_PROXY_CATEGORY, ROOT_IMPL_CATEGORY, ROOT_PROXY_CATEGORY]) {
    await network.addUtxo(wallet.address, funding(categoryId));
  }
  const storeInitCoin = funding(idOf('store initialize coin'));
  const rootInitCoin = funding(idOf('root initialize coin'));
  const callCoin = funding(idOf('call coin'));
  for (const coin of [storeInitCoin, rootInitCoin, callCoin]) await network.addUtxo(binToHex(callerLock), coin);
  await fundShippedFacets(network);

  const storeDeployment = await deployPerCallProxy({
    provider: network,
    implementationArtifact: store,
    proxyArtifact: buildProxyArtifact(store),
    implementationDeploy: { fundingUtxo: funding(STORE_IMPL_CATEGORY), funder, changeAddress: wallet.address },
    proxyDeploy: { fundingUtxo: funding(STORE_PROXY_CATEGORY), funder, changeAddress: wallet.address },
    initialize: { functionName: 'initialize', args: [] },
    callerLockingBytecode: callerLock,
    callerFunding: { utxo: storeInitCoin, funder: callerFunder, changeAddress: wallet.address },
    vm: compositionMachine(),
  });
  expect(storeDeployment.initialize.broadcast).toBeDefined();
  const rootDeployment = await deployPerCallProxy({
    provider: network,
    implementationArtifact: root,
    proxyArtifact: buildProxyArtifact(root),
    implementationDeploy: { fundingUtxo: funding(ROOT_IMPL_CATEGORY), funder, changeAddress: wallet.address },
    proxyDeploy: { fundingUtxo: funding(ROOT_PROXY_CATEGORY), funder, changeAddress: wallet.address },
    initialize: { functionName: 'initialize', args: [storeDeployment.proxy.address] },
    callerLockingBytecode: callerLock,
    callerFunding: { utxo: rootInitCoin, funder: callerFunder, changeAddress: wallet.address },
    vm: compositionMachine(),
  });
  expect(rootDeployment.initialize.broadcast).toBeDefined();
  return {
    network,
    rootProxyCategoryId: rootDeployment.proxy.categoryId,
    rootImplementationCategoryId: rootDeployment.implementation.categoryId,
    storeProxyCategoryId: storeDeployment.proxy.categoryId,
    storeImplementationCategoryId: storeDeployment.implementation.categoryId,
    callerLock,
    changeAddress: wallet.address,
    callCoin,
    funder: callerFunder,
    snapshot: await network.takeSnapshot(),
  };
}

let worldRun: Promise<World> | undefined;

/** One deployment serves every case, each rewinding the chain to it first, so each starts from empty collections. */
async function deployed(): Promise<World> {
  worldRun ??= deployWorld();
  const world = await worldRun;
  await world.snapshot.restore();
  return world;
}

/** One call of the root's entry through its proxy, the store reached behind its own. */
function callRoot(world: World, functionName: string, args: readonly bigint[]): Promise<PerCallProxyCallResult> {
  return callPerCallProxyEntry({
    provider: world.network,
    implementationArtifact: root,
    proxyArtifact: buildProxyArtifact(root),
    proxyCategoryId: world.rootProxyCategoryId,
    implementationCategoryId: world.rootImplementationCategoryId,
    functionName,
    args: [...args],
    externals: {
      IStore: {
        artifact: store,
        categoryId: world.storeProxyCategoryId,
        proxyArtifact: buildProxyArtifact(store),
        implementationCategoryId: world.storeImplementationCategoryId,
      },
    },
    callerUtxo: world.callCoin,
    callerLockingBytecode: world.callerLock,
    funder: world.funder,
    changeAddress: world.changeAddress,
    vm: compositionMachine(),
  });
}

/** True while the caller's coin is unspent, i.e. nothing was broadcast for the hop. */
async function callCoinLive(world: World): Promise<boolean> {
  return (await world.network.getUtxosForLockingBytecode(world.callerLock))
    .some((utxo) => utxo.txid === world.callCoin.txid && utxo.vout === world.callCoin.vout);
}

/** The refusal's words for `count` reaches of `entry` that each create the head of `collection`. */
function headsRefusal(entry: string, count: number, collection: string): string {
  return `the hop reaches the entry "${entry}" ${count} times, and ${count} of them create the head of collection `
    + `"${collection}", which one transaction must create once`;
}

describe('two reaches that each create the head of one collection', () => {
  it('refuses two appends to one key of an empty dynamic-valued collection, broadcasting nothing', async () => {
    const world = await deployed();

    await expect(callRoot(world, 'logTwice', [7n])).rejects.toThrow(headsRefusal('Store.log()', 2, 'logs'));
    expect(await callCoinLive(world)).toBe(true);
  });

  it('refuses two inserts of different keys into an empty fixed-width collection, broadcasting nothing', async () => {
    const world = await deployed();

    // The keys differ and neither reach spends a node, so only the heads the two reaches create clash.
    await expect(callRoot(world, 'putTwo', [1n, 2n])).rejects.toThrow(headsRefusal('Store.put()', 2, 'counts'));
    expect(await callCoinLive(world)).toBe(true);
  });

  it('settles one reach that creates the head in a call, leaving one head linked to its key', async () => {
    const world = await deployed();

    const result = await callRoot(world, 'logOnce', [7n, 5n]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

    // The store's collection now holds the head the hop minted and the node it linked to key 7, and nothing else.
    const layout = { ...buildProxyArtifact(store).stateLayout!, collections: store.stateLayout!.collections };
    const deployment = await readPerCallDeployment(world.network, world.storeProxyCategoryId, layout);
    const nodes = (deployment.nodesByCollection.get('logs') ?? [])
      .map((node) => decodeEntryCommitment(hexToBin(node.token!.nft!.commitment)));
    const headSlot = bytesToHex(new Uint8Array(32));
    const keySlot = bytesToHex(keyToSlotMulti([bigIntToVmNumber(7n)]));
    const heads = nodes.filter((node) => bytesToHex(node.slot) === headSlot);
    expect(heads).toHaveLength(1);
    expect(bytesToHex(heads[0]!.nextKey)).toBe(keySlot);
    expect(nodes.map((node) => bytesToHex(node.slot)).sort()).toStrictEqual([headSlot, keySlot].sort());
  });

  it('allows one created head per collection and deployment', () => {
    // Two deployments of the store, each reached once, each create the head of their own collection, and one reach
    // creates the head of the first one's second collection: each collection's head is created once.
    const frame = (categoryHex: string, functionName: string, collection: string): HopCallee => ({
      master: `callee-${categoryHex.slice(0, 8)}-${collection}`,
      functionName,
      category: hexToBin(categoryHex),
      entryWrites: {
        reachWrites: [{ collection, chunkable: collection === 'logs', targets: [], spentIds: [], createsHead: true }],
      },
    } as unknown as HopCallee);
    expect(() => requireSatisfiableReachWrites([
      frame(STORE_PROXY_CATEGORY, 'Store.log()', 'logs'),
      frame(idOf('second store proxy'), 'Store.log()', 'logs'),
      frame(STORE_PROXY_CATEGORY, 'Store.put()', 'counts'),
    ])).not.toThrow();
  });
});
