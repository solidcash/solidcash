import { describe, expect, it } from 'vitest';
import { bigIntToVmNumber, binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { bytesToHex, sha256 } from '@solidcash/utils';
import { perCallValidator } from 'solidc';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployMaster, readPerCallDeployment } from '../../../src/per-call/deploy/index.js';
import { buildProxyArtifact, deployPerCallProxy } from '../../../src/per-call/proxy/index.js';
import { callPerCallProxyEntry, type PerCallProxyCallResult } from '../../../src/per-call/proxy/deploy.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { decodeEntryCommitment, headSentinelCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * Reaches of one hop into a collection of a proxied store that its initialize never wrote, and the one head each
 * collection holds.
 *
 * A head is minted only at genesis: the store's proxy genesis mints the empty head of `logs` and of `counts`, though
 * its initialize writes neither, so no reach mints a head. Each reach of a callee is planned on its own against the
 * deployment, so two reaches into one empty collection both splice through that one head. Two inserts of different
 * keys into the fixed-width `counts` (`putTwo`) are refused by the hop's cross-reach check before anything settles.
 * Two appends to one key of the dynamic-valued `logs` (`logTwice`, the shape of a store's per-job event log) each
 * create the key's node; the check leaves a dynamic value's reaches to chain through one node, which serves appends
 * to a held key, and the validator refuses the broadcast. One reach settles through the genesis head.
 *
 * Before heads were minted only at genesis, a reach into an empty collection minted the head in its own transaction,
 * and both shapes broadcast two heads of one collection on the mock (measured and refused by name at 1ac66d296).
 * A call never creates a head now, so a live deployment that was made without one is refused by name.
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

/** The cross-reach check's words for `count` reaches of `entry` inserting into `collection` through one node. */
function sameNodeRefusal(entry: string, count: number, collection: string): string {
  return `the hop reaches the entry "${entry}" ${count} times, and ${count} of them insert into collection `
    + `"${collection}" through the same node`;
}

/** The hop's words for an entry that writes `collection` of a live deployment that holds no head of it. */
function noHeadRefusal(entry: string, collection: string): string {
  return `the implementation's "${entry}" entry writes mapping "${collection}", but the deployment's collection `
    + `"${collection}" has no head; a head is minted only at genesis, so this deployment was deployed without it`;
}

/** A store whose proxy genesis minted no head, and a root behind its own proxy that reaches it. */
interface HeadlessWorld {
  readonly network: MockNetworkProvider;
  readonly storeProxyCategoryId: string;
  readonly storeImplementationCategoryId: string;
  readonly rootProxyCategoryId: string;
  readonly rootImplementationCategoryId: string;
  readonly callerLock: Uint8Array;
  readonly changeAddress: string;
  readonly callCoin: { txid: string; vout: number; satoshis: bigint };
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
}

/**
 * Deploys the store from its two geneses alone, with no head minted under its proxy's category: the deployment an
 * SDK that minted only the heads an initialize writes made for this store. The root is deployed as usual.
 */
async function deployHeadless(): Promise<HeadlessWorld> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, signature);
  const callerFunder = signature.unlockP2PKH();
  const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
  const storeImplementationCategoryId = idOf('headless store implementation');
  const storeProxyCategoryId = idOf('headless store proxy');
  const rootImplementationCategoryId = idOf('headless root implementation');
  const rootProxyCategoryId = idOf('headless root proxy');
  for (const categoryId of [
    storeImplementationCategoryId, storeProxyCategoryId, rootImplementationCategoryId, rootProxyCategoryId,
  ]) {
    await network.addUtxo(wallet.address, funding(categoryId));
  }
  const rootInitCoin = funding(idOf('headless root initialize coin'));
  const callCoin = funding(idOf('headless call coin'));
  for (const coin of [rootInitCoin, callCoin]) await network.addUtxo(binToHex(callerLock), coin);
  await fundShippedFacets(network);

  const validatorProgram = perCallValidator.buildValidatorProgram();
  await deployStatefulContract(store, [], {
    fundingUtxo: funding(storeImplementationCategoryId), funder, changeAddress: wallet.address, provider: network,
  });
  const storeImplementation = deployMaster(store, hexToBin(storeImplementationCategoryId), validatorProgram);
  await deployStatefulContract(buildProxyArtifact(store), [], {
    fundingUtxo: funding(storeProxyCategoryId), funder, changeAddress: wallet.address, provider: network,
    initialState: { implementation: storeImplementation.address },
  });
  const storeProxy = deployMaster(buildProxyArtifact(store), hexToBin(storeProxyCategoryId), validatorProgram);

  const rootDeployment = await deployPerCallProxy({
    provider: network,
    implementationArtifact: root,
    proxyArtifact: buildProxyArtifact(root),
    implementationDeploy: {
      fundingUtxo: funding(rootImplementationCategoryId), funder, changeAddress: wallet.address,
    },
    proxyDeploy: { fundingUtxo: funding(rootProxyCategoryId), funder, changeAddress: wallet.address },
    initialize: { functionName: 'initialize', args: [storeProxy.address] },
    callerLockingBytecode: callerLock,
    callerFunding: { utxo: rootInitCoin, funder: callerFunder, changeAddress: wallet.address },
    vm: compositionMachine(),
  });
  expect(rootDeployment.initialize.broadcast).toBeDefined();
  return {
    network,
    storeProxyCategoryId,
    storeImplementationCategoryId,
    rootProxyCategoryId: rootDeployment.proxy.categoryId,
    rootImplementationCategoryId: rootDeployment.implementation.categoryId,
    callerLock,
    changeAddress: wallet.address,
    callCoin,
    funder: callerFunder,
  };
}

/** The store's live nodes of one collection, read with the implementation's collections grafted on the proxy's. */
async function storeNodes(world: World, collection: string): Promise<readonly Utxo[]> {
  const layout = { ...buildProxyArtifact(store).stateLayout!, collections: store.stateLayout!.collections };
  const deployment = await readPerCallDeployment(world.network, world.storeProxyCategoryId, layout);
  return deployment.nodesByCollection.get(collection) ?? [];
}

describe('reaches into a collection the store never wrote, through the head its genesis minted', () => {
  it('refuses two appends to one key of an empty dynamic-valued collection, broadcasting nothing', async () => {
    const world = await deployed();

    // Both reaches splice key 7 in through the genesis head and each creates the key's node; the validator, at
    // input 1, refuses the broadcast.
    await expect(callRoot(world, 'logTwice', [7n])).rejects.toThrow(
      'error in evaluating input index 1: Program failed an OP_VERIFY operation',
    );
    expect(await callCoinLive(world)).toBe(true);
  });

  it('refuses two inserts of different keys into an empty fixed-width collection, broadcasting nothing', async () => {
    const world = await deployed();

    // The keys differ, and both reaches relink the one head the genesis minted.
    await expect(callRoot(world, 'putTwo', [1n, 2n])).rejects.toThrow(sameNodeRefusal('Store.put()', 2, 'counts'));
    expect(await callCoinLive(world)).toBe(true);
  });

  it('settles one reach through the head the genesis minted, leaving one head linked to its key', async () => {
    const world = await deployed();

    // Before the call the collection holds the genesis head alone, empty.
    const before = await storeNodes(world, 'logs');
    expect(before.map((node) => node.token!.nft!.commitment)).toStrictEqual([binToHex(headSentinelCommitment())]);

    const result = await callRoot(world, 'logOnce', [7n, 5n]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

    // The hop spent that head and recreated it linked to key 7, beside the node it created, and nothing else.
    const nodes = (await storeNodes(world, 'logs'))
      .map((node) => ({ txid: node.txid, ...decodeEntryCommitment(hexToBin(node.token!.nft!.commitment)) }));
    const headSlot = bytesToHex(new Uint8Array(32));
    const keySlot = bytesToHex(keyToSlotMulti([bigIntToVmNumber(7n)]));
    const heads = nodes.filter((node) => bytesToHex(node.slot) === headSlot);
    expect(heads).toHaveLength(1);
    expect(heads[0]!.txid).toBe(result.broadcast!.txid);
    expect(heads[0]!.txid).not.toBe(before[0]!.txid);
    expect(bytesToHex(heads[0]!.nextKey)).toBe(keySlot);
    expect(nodes.map((node) => bytesToHex(node.slot)).sort()).toStrictEqual([headSlot, keySlot].sort());
  });

  it('refuses by name a write into a collection a live deployment holds no head of, broadcasting nothing', async () => {
    const headless = await deployHeadless();

    // Called directly, the store's own frame plans the write against the deployment and finds no head to splice
    // through; a call never mints one.
    await expect(callPerCallProxyEntry({
      provider: headless.network,
      implementationArtifact: store,
      proxyArtifact: buildProxyArtifact(store),
      proxyCategoryId: headless.storeProxyCategoryId,
      implementationCategoryId: headless.storeImplementationCategoryId,
      functionName: 'put',
      args: [1n, 10n],
      callerUtxo: headless.callCoin,
      callerLockingBytecode: headless.callerLock,
      funder: headless.funder,
      changeAddress: headless.changeAddress,
      vm: compositionMachine(),
    })).rejects.toThrow(noHeadRefusal('put', 'counts'));

    // Reached from the root, the callee's frame is refused the same way, by the callee's name.
    await expect(callPerCallProxyEntry({
      provider: headless.network,
      implementationArtifact: root,
      proxyArtifact: buildProxyArtifact(root),
      proxyCategoryId: headless.rootProxyCategoryId,
      implementationCategoryId: headless.rootImplementationCategoryId,
      functionName: 'logOnce',
      args: [7n, 5n],
      externals: {
        IStore: {
          artifact: store,
          categoryId: headless.storeProxyCategoryId,
          proxyArtifact: buildProxyArtifact(store),
          implementationCategoryId: headless.storeImplementationCategoryId,
        },
      },
      callerUtxo: headless.callCoin,
      callerLockingBytecode: headless.callerLock,
      funder: headless.funder,
      changeAddress: headless.changeAddress,
      vm: compositionMachine(),
    })).rejects.toThrow(
      `the callee "Store.log()" writes records this hop cannot declare: ${noHeadRefusal('log', 'logs')}`,
    );
    expect((await headless.network.getUtxosForLockingBytecode(headless.callerLock))
      .some((utxo) => utxo.txid === headless.callCoin.txid && utxo.vout === headless.callCoin.vout)).toBe(true);
  });
});
