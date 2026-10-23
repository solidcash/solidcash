import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { bytesToHex, sha256, validatorAddress } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * An entry that stops on a check of its own before the call whose frames the hop's planner refuses (spec V6).
 *
 * The hop plans every call the entry publishes, and every frame those calls reach, before it settles one, and a shape
 * the transaction cannot carry is refused by name there. The execution meets that shape only once the entry makes the
 * call that leads to it: an entry whose own guard fails first never makes it, so its own reason is the refusal, as
 * the EVM reports it. Three refused shapes stand behind the guard: a keeper whose entry calls out to a relay that
 * re-enters the keeper to rewrite a mark and then rewrites the same mark itself (one frame enters the other over one
 * node, and their writes interleave), two inserts of different keys into an empty collection through its one head,
 * and a call to an address no deployment sits at. A guard that passes reaches each shape, which is still refused by
 * the planner's own name; a guard behind a call the entry makes first reports the guard too, and a guard that names no
 * reason is reported as the entry's own stop all the same. A plan that stops to learn an earlier call's result
 * settles that call first: when it refuses, the guard before it is still the entry's own reason, and once the guard
 * passes the refusing call's own reason is. Nothing is broadcast in any case.
 */

/** A 32-byte category or txid that is neither one repeated byte nor a palindrome, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`own stop before refused plan ${label}`)));
}

const KEEPER_IMPL_CATEGORY = idOf('keeper implementation');
const KEEPER_PROXY_CATEGORY = idOf('keeper proxy');
const RELAY_CATEGORY = idOf('relay');
const STORE_IMPL_CATEGORY = idOf('store implementation');
const STORE_PROXY_CATEGORY = idOf('store proxy');
const ROOT_IMPL_CATEGORY = idOf('root implementation');
const ROOT_PROXY_CATEGORY = idOf('root proxy');

const addressOf = (categoryId: string): string =>
  binToHex(validatorAddress(hexToBin(categoryId), VALIDATOR_PROGRAM));
const RELAY = `0x${addressOf(RELAY_CATEGORY)}`;
const KEEPER = `0x${addressOf(KEEPER_PROXY_CATEGORY)}`;
/** An address no contract of the deployment sits at. */
const GHOST = addressOf(idOf('ghost'));

const SOURCE = [
  'pragma solidcash ^0.14.0;',
  'interface IRelay { function poke(address keeper); }',
  'interface IKeeper { function enter(); function stamp(); }',
  'interface IStore { function bump(); function put(int id, int v); function value() returns (int); }',
  'interface IGhost { function ping(); }',
  'contract Keeper {',
  '  address public implementation;',
  '  mapping(int => int) marks;',
  '  function initialize() { this.marks[1] = 5; require(true); }',
  `  function enter() { IRelay(${RELAY}).poke(${KEEPER}); this.marks[1] = 6; }`,
  '  function stamp() { this.marks[1] = 7; }',
  '}',
  'contract Relay {',
  '  int public step;',
  '  constructor() { this.step = 2; }',
  '  function poke(address keeper) { IKeeper(keeper).stamp(); }',
  '}',
  'contract Store {',
  '  address public implementation;',
  '  int public hits;',
  '  mapping(int => int) counts;',
  '  function initialize() { this.hits = 1; require(true); }',
  '  function bump() { this.hits = this.hits + 1; }',
  '  function put(int id, int v) { this.counts[id] = v; }',
  '  function value() returns (int) { require(this.hits > 100, "too few hits"); return this.hits; }',
  '}',
  'contract Root {',
  '  address public implementation;',
  '  address public keeper;',
  '  address public store;',
  '  function initialize(address k, address s) { this.keeper = k; this.store = s; require(true); }',
  '  function enterGated(int gate) { require(gate > 0, "gate closed"); IKeeper(this.keeper).enter(); }',
  '  function putTwoGated(int first, int second, int gate) {',
  '    require(gate > 0, "gate closed");',
  '    IStore(this.store).put(first, 10);',
  '    IStore(this.store).put(second, 20);',
  '  }',
  '  function putTwoAfterBump(int first, int second, int gate) {',
  '    IStore(this.store).bump();',
  '    require(gate > 0, "gate closed");',
  '    IStore(this.store).put(first, 10);',
  '    IStore(this.store).put(second, 20);',
  '  }',
  '  function putTwoUnnamed(int first, int second, int gate) {',
  '    require(gate > 0);',
  '    IStore(this.store).put(first, 10);',
  '    IStore(this.store).put(second, 20);',
  '  }',
  `  function pingGated(int gate) { require(gate > 0, "gate closed"); IGhost(0x${GHOST}).ping(); }`,
  '  function readThenPutGated(int gate) {',
  '    require(gate > 0, "gate closed");',
  '    int amount = IStore(this.store).value();',
  '    IStore(this.store).put(amount, 1);',
  '  }',
  '}',
].join('\n');

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const keeper = artifacts.Keeper!;
const relay = artifacts.Relay!;
const store = artifacts.Store!;
const root = artifacts.Root!;

/** A coin a genesis or a hop is funded from; a genesis's txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** The deployment the cases share, and the chain as it stood when it was done. */
interface World {
  readonly network: MockNetworkProvider;
  readonly rootProxyCategoryId: string;
  readonly rootImplementationCategoryId: string;
  readonly keeperImplementationCategoryId: string;
  readonly storeImplementationCategoryId: string;
  readonly callerLock: Uint8Array;
  readonly changeAddress: string;
  readonly callCoin: { txid: string; vout: number; satoshis: bigint };
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
  readonly snapshot: SnapshotRestorer;
}

/** Deploys the relay plain, then the keeper, the store and the root behind their proxies. */
async function deployWorld(): Promise<World> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, signature);
  const callerFunder = signature.unlockP2PKH();
  const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
  const relayCoin = funding(RELAY_CATEGORY);
  await network.addUtxo(wallet.address, relayCoin);
  await deployStatefulContract(relay, [], {
    fundingUtxo: relayCoin, funder, changeAddress: wallet.address, provider: network, threadCount: 4,
  });
  for (const categoryId of [
    KEEPER_IMPL_CATEGORY, KEEPER_PROXY_CATEGORY, STORE_IMPL_CATEGORY, STORE_PROXY_CATEGORY, ROOT_IMPL_CATEGORY,
    ROOT_PROXY_CATEGORY,
  ]) {
    await network.addUtxo(wallet.address, funding(categoryId));
  }
  const keeperInitCoin = funding(idOf('keeper initialize coin'));
  const storeInitCoin = funding(idOf('store initialize coin'));
  const rootInitCoin = funding(idOf('root initialize coin'));
  const callCoin = funding(idOf('call coin'));
  for (const coin of [keeperInitCoin, storeInitCoin, rootInitCoin, callCoin]) {
    await network.addUtxo(binToHex(callerLock), coin);
  }
  await fundShippedFacets(network);
  const proxied = async (
    artifact: typeof root, implementationCategory: string, proxyCategory: string,
    initializeCoin: { txid: string; vout: number; satoshis: bigint }, args: readonly Uint8Array[],
  ): Promise<Awaited<ReturnType<typeof deployFramedProxy>>> => {
    const deployment = await deployFramedProxy({
      provider: network,
      implementationArtifact: artifact,
      proxyArtifact: buildProxyArtifact(artifact),
      implementationDeploy: { fundingUtxo: funding(implementationCategory), funder, changeAddress: wallet.address },
      proxyDeploy: { fundingUtxo: funding(proxyCategory), funder, changeAddress: wallet.address },
      initialize: { functionName: 'initialize', args: [...args] },
      callerLockingBytecode: callerLock,
      callerFunding: { utxo: initializeCoin, funder: callerFunder, changeAddress: wallet.address },
      vm: compositionMachine(),
    });
    expect(deployment.initialize.broadcast).toBeDefined();
    return deployment;
  };
  const keeperDeployment = await proxied(keeper, KEEPER_IMPL_CATEGORY, KEEPER_PROXY_CATEGORY, keeperInitCoin, []);
  expect(binToHex(keeperDeployment.proxy.address)).toBe(addressOf(KEEPER_PROXY_CATEGORY));
  const storeDeployment = await proxied(store, STORE_IMPL_CATEGORY, STORE_PROXY_CATEGORY, storeInitCoin, []);
  const rootDeployment = await proxied(root, ROOT_IMPL_CATEGORY, ROOT_PROXY_CATEGORY, rootInitCoin, [
    keeperDeployment.proxy.address, storeDeployment.proxy.address,
  ]);
  return {
    network,
    rootProxyCategoryId: rootDeployment.proxy.categoryId,
    rootImplementationCategoryId: rootDeployment.implementation.categoryId,
    keeperImplementationCategoryId: keeperDeployment.implementation.categoryId,
    storeImplementationCategoryId: storeDeployment.implementation.categoryId,
    callerLock,
    changeAddress: wallet.address,
    callCoin,
    funder: callerFunder,
    snapshot: await network.takeSnapshot(),
  };
}

let worldRun: Promise<World> | undefined;

/** One deployment serves every case, each rewinding the chain to it first. */
async function deployed(): Promise<World> {
  worldRun ??= deployWorld();
  const world = await worldRun;
  await world.snapshot.restore();
  return world;
}

/** One call of the root's entry through its proxy, the keeper and the store reached behind their own. */
function callRoot(world: World, functionName: string, args: readonly bigint[]): Promise<FramedProxyCallResult> {
  return callFramedProxyEntry({
    provider: world.network,
    implementationArtifact: root,
    proxyArtifact: buildProxyArtifact(root),
    proxyCategoryId: world.rootProxyCategoryId,
    implementationCategoryId: world.rootImplementationCategoryId,
    functionName,
    args: [...args],
    externals: {
      IKeeper: {
        artifact: keeper,
        categoryId: KEEPER_PROXY_CATEGORY,
        proxyArtifact: buildProxyArtifact(keeper),
        implementationCategoryId: world.keeperImplementationCategoryId,
      },
      IRelay: { artifact: relay, categoryId: RELAY_CATEGORY },
      IStore: {
        artifact: store,
        categoryId: STORE_PROXY_CATEGORY,
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

/** The entry's own stop, as the hop reports it: the root's frame, the line of its check and the reason it names. */
function ownStop(entry: string, reason: string): RegExp {
  return new RegExp(`the implementation's "${entry}" entry did not settle through the proxy: frame `
    + `"implementation-master" of Root\\.${entry}\\(\\) at line \\d+: ${reason} \\(Program failed an OP_VERIFY`);
}

/**
 * The planner's words for the keeper's two frames over its one mark, one entering the other: the inner frame rewrites
 * the mark before its enclosing frame writes it, past the call that leads to the inner frame.
 */
const INTERLEAVED = 'the hop\'s reaches "Keeper.enter()" and "Keeper.stamp()" touch one node of collection "marks", '
  + 'and one of them enters the other, so their segments interleave in an order this hop does not settle';

describe('an entry whose own check fails before the call whose frames the planner refuses', () => {
  it('reports the entry\'s own reason for a call into a re-entering pair it never makes', async () => {
    const world = await deployed();
    await expect(callRoot(world, 'enterGated', [0n])).rejects.toThrow(ownStop('enterGated', 'gate closed'));
    expect(await callCoinLive(world)).toBe(true);
  }, 300_000);

  it('refuses the re-entering pair by the planner\'s name once the check passes', async () => {
    const world = await deployed();
    await expect(callRoot(world, 'enterGated', [1n])).rejects.toThrow(INTERLEAVED);
    expect(await callCoinLive(world)).toBe(true);
  }, 300_000);

  // Two inserts through the store's one head settle, each planned against the list the one before it left; the entry's
  // own check before them is still the stop reported, and nothing is broadcast for it.
  it('reports the entry\'s own reason before two inserts through one node, which settle once it passes', async () => {
    const world = await deployed();
    await expect(callRoot(world, 'putTwoGated', [1n, 2n, 0n])).rejects.toThrow(ownStop('putTwoGated', 'gate closed'));
    expect(await callCoinLive(world)).toBe(true);
    expect((await callRoot(world, 'putTwoGated', [1n, 2n, 1n])).accepted).toBe(true);
  }, 300_000);

  it('reports the entry\'s own reason after a call it makes and before the two inserts', async () => {
    // The store's `bump` is made first, then the guard stops the entry before either insert.
    const world = await deployed();
    await expect(callRoot(world, 'putTwoAfterBump', [1n, 2n, 0n]))
      .rejects.toThrow(ownStop('putTwoAfterBump', 'gate closed'));
    expect(await callCoinLive(world)).toBe(true);
    expect((await callRoot(world, 'putTwoAfterBump', [1n, 2n, 1n])).accepted).toBe(true);
  }, 300_000);

  it('reports a check that names no reason as the entry\'s own stop', async () => {
    const world = await deployed();
    await expect(callRoot(world, 'putTwoUnnamed', [1n, 2n, 0n]))
      .rejects.toThrow(ownStop('putTwoUnnamed', 'no source message'));
    expect((await callRoot(world, 'putTwoUnnamed', [1n, 2n, 1n])).accepted).toBe(true);
  }, 300_000);

  it('reports the entry\'s own reason before a call whose result a later call reads and which refuses', async () => {
    // The put's argument is the value's result, so the plan stops to settle the value first, which refuses.
    const world = await deployed();
    await expect(callRoot(world, 'readThenPutGated', [0n])).rejects.toThrow(ownStop('readThenPutGated', 'gate closed'));
    await expect(callRoot(world, 'readThenPutGated', [1n]))
      .rejects.toThrow(/the call's callee "Store\.value\(\)" did not settle through the proxy: .*too few hits/);
    expect(await callCoinLive(world)).toBe(true);
  }, 300_000);

  it('reports the entry\'s own reason before a call to an address no deployment sits at', async () => {
    // The planner refuses the call while it plans it, before any check over the frames.
    const world = await deployed();
    await expect(callRoot(world, 'pingGated', [0n])).rejects.toThrow(ownStop('pingGated', 'gate closed'));
    await expect(callRoot(world, 'pingGated', [1n])).rejects.toThrow(
      `the call to "IGhost.ping" targets ${GHOST}, and none of the deployment's contracts sits at that address`);
    expect(await callCoinLive(world)).toBe(true);
  }, 300_000);
});
