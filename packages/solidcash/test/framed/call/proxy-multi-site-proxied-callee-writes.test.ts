import { describe, expect, it } from 'vitest';
import { bigIntToVmNumber, binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { validatorAddress } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { bytesToSlotValue, decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry } from '../../../src/framed/proxy/deploy.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A hop whose proxied callee writes a record of its own beside a call of its own, reached at several sites.
 *
 * The callee is two contracts, so each reach takes a master of the callee proxy's and a master of the
 * implementation's. The implementation's entry does two things beside reading its record: it writes a sorted
 * mapping, whose node UTXOs the frame has to declare in the segment the write lands in, and it calls a third
 * contract below it. The two unguarded reaches, the loop's two turns and the guarded reach the caller's argument
 * leaves untaken make four reaches in all, each writing its own key.
 *
 * The callee's initialize writes no key, so the mapping holds only the empty head its proxy's genesis minted (a
 * head is minted only at genesis). Each reach, a loop's turn included, is planned against the list the reaches before
 * it left, so it splices its key in through the head or through a node an earlier reach created, and the list the
 * transaction leaves links every key in order.
 */

const PING_CATEGORY = '99'.repeat(31) + '66';
const INNER_IMPL_CATEGORY = '11'.repeat(31) + 'ee';
const INNER_PROXY_CATEGORY = '22'.repeat(31) + 'dd';
const OUTER_IMPL_CATEGORY = '33'.repeat(31) + 'cc';
const OUTER_PROXY_CATEGORY = '44'.repeat(31) + 'bb';
const PING_ADDRESS = validatorAddress(hexToBin(PING_CATEGORY), VALIDATOR_PROGRAM);

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IPing { function ping(int n); }'
  + ' interface IInner { function record(int id, int value); }'
  + ' contract Ping { int public last; function ping(int n) { require(n >= this.last); require(true); } }'
  + ' contract Inner {'
  + '   address public implementation;'
  + '   int public hits;'
  + '   mapping(int => int) public events;'
  + '   function initialize() { this.hits = 1; require(this.hits > 0); }'
  + '   function record(int id, int value) {'
  + '     this.events[id] = value;'
  + `     IPing(0x${binToHex(PING_ADDRESS)}).ping(value);`
  + '     require(true);'
  + '   }'
  + ' }'
  + ' contract Outer {'
  + '   address public implementation;'
  + '   address public inner;'
  + '   function initialize(address target) { this.inner = target; require(true); }'
  + '   function run(bool takeExtra, int times) {'
  + '     IInner(this.inner).record(10, 100);'
  + '     IInner(this.inner).record(20, 200);'
  + '     for (int i = 0; i < times; i = i + 1) { IInner(this.inner).record(100 + i, i); }'
  + '     if (takeExtra) { IInner(this.inner).record(99, 99); }'
  + '     require(true);'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const ping = artifacts.Ping!;
const inner = artifacts.Inner!;
const outer = artifacts.Outer!;

/** A coin a genesis is funded from; its txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** Deploys the callee's own callee, the proxied callee and the root behind its proxy, and runs both initializes. */
async function deployAll(network: MockNetworkProvider): Promise<{
  readonly innerProxyCategoryId: string;
  readonly outerProxyCategoryId: string;
  readonly outerImplementationCategoryId: string;
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
  readonly callCoin: { txid: string; vout: number; satoshis: bigint };
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
}> {
  const signature = new SignatureTemplate(alicePriv);
  const source = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = source.unlock.spend(alicePub, signature);
  const callerFunder = signature.unlockP2PKH();
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);

  // The deepest callee runs once per reach of the proxied callee above it.
  const pingCoin = funding(PING_CATEGORY);
  await network.addUtxo(source.address, pingCoin);
  await deployStatefulContract(ping, [], {
    fundingUtxo: pingCoin, funder, changeAddress: source.address, provider: network, threadCount: 5,
  });

  for (const txid of [INNER_IMPL_CATEGORY, INNER_PROXY_CATEGORY, OUTER_IMPL_CATEGORY, OUTER_PROXY_CATEGORY]) {
    await network.addUtxo(source.address, funding(txid));
  }
  const innerInitCoin = funding('55'.repeat(32));
  const outerInitCoin = funding('66'.repeat(32));
  const callCoin = funding('77'.repeat(32));
  for (const coin of [innerInitCoin, outerInitCoin, callCoin]) {
    await network.addUtxo(binToHex(deployerLock), coin);
  }
  await fundShippedFacets(network);

  const innerDeployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: inner,
    proxyArtifact: buildProxyArtifact(inner),
    implementationDeploy: {
      fundingUtxo: funding(INNER_IMPL_CATEGORY), funder, changeAddress: source.address, threadCount: 5,
    },
    proxyDeploy: {
      fundingUtxo: funding(INNER_PROXY_CATEGORY), funder, changeAddress: source.address, threadCount: 5,
    },
    initialize: { functionName: 'initialize', args: [] },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: innerInitCoin, funder: callerFunder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(innerDeployment.initialize.broadcast).toBeDefined();

  const outerDeployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: outer,
    proxyArtifact: buildProxyArtifact(outer),
    implementationDeploy: { fundingUtxo: funding(OUTER_IMPL_CATEGORY), funder, changeAddress: source.address },
    proxyDeploy: { fundingUtxo: funding(OUTER_PROXY_CATEGORY), funder, changeAddress: source.address },
    initialize: { functionName: 'initialize', args: [innerDeployment.proxy.address] },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: outerInitCoin, funder: callerFunder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(outerDeployment.initialize.broadcast).toBeDefined();

  return {
    innerProxyCategoryId: innerDeployment.proxy.categoryId,
    outerProxyCategoryId: outerDeployment.proxy.categoryId,
    outerImplementationCategoryId: outerDeployment.implementation.categoryId,
    deployerLock,
    changeAddress: source.address,
    callCoin,
    funder: callerFunder,
  };
}

/** The deployment the cases share, and the chain as it stood when the deployment was done. */
interface World {
  readonly network: MockNetworkProvider;
  readonly funded: Awaited<ReturnType<typeof deployAll>>;
  readonly snapshot: SnapshotRestorer;
}

let worldRun: Promise<World> | undefined;

/** One deployment serves both cases, each rewinding the chain to it first, so each writes the keys fresh. */
async function deployed(): Promise<World> {
  worldRun ??= (async (): Promise<World> => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployAll(network);
    return { network, funded, snapshot: await network.takeSnapshot() };
  })();
  const world = await worldRun;
  await world.snapshot.restore();
  return world;
}

/** The root's `run`, entered on its proxy, taking the guarded reach or not and looping `times` turns. */
async function run(world: World, takeExtra: boolean, times: bigint): Promise<{ readonly txid?: string }> {
  const { network, funded } = world;
  const result = await callFramedProxyEntry({
    provider: network,
    implementationArtifact: outer,
    proxyArtifact: buildProxyArtifact(outer),
    proxyCategoryId: funded.outerProxyCategoryId,
    implementationCategoryId: funded.outerImplementationCategoryId,
    functionName: 'run',
    args: [takeExtra, times],
    externals: { IPing: { artifact: ping, categoryId: PING_CATEGORY } },
    callerUtxo: funded.callCoin,
    callerLockingBytecode: funded.deployerLock,
    funder: funded.funder,
    changeAddress: funded.changeAddress,
    vm: compositionMachine(),
  });
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  return { ...(result.broadcast === undefined ? {} : { txid: result.broadcast.txid }) };
}

/** The callee's `events` list as the chain holds it, walked from the head: each key's slot and its value's hex. */
async function eventsList(world: World): Promise<readonly (readonly [bigint, string])[]> {
  const layout = { ...buildProxyArtifact(inner).stateLayout!, collections: inner.stateLayout!.collections };
  const deployment = await readFramedDeployment(world.network, world.funded.innerProxyCategoryId, layout);
  const nodes = new Map((deployment.nodesByCollection.get('events') ?? []).map((utxo) => {
    const node = decodeEntryCommitment(hexToBin(utxo.token!.nft!.commitment));
    return [bytesToSlotValue(node.slot), node] as const;
  }));
  const list: (readonly [bigint, string])[] = [];
  for (let next = nodes.get(0n)?.nextKey; next !== undefined && bytesToSlotValue(next) !== 0n;) {
    const node = nodes.get(bytesToSlotValue(next));
    if (node === undefined) break;
    list.push([bytesToSlotValue(node.slot), binToHex(node.value)]);
    next = node.nextKey;
  }
  return list;
}

/** The list the written keys make, in slot order, each with its value's hex. */
function expectedList(written: readonly (readonly [bigint, bigint])[]): readonly (readonly [bigint, string])[] {
  return written
    .map(([key, value]) => [
      bytesToSlotValue(keyToSlotMulti([bigIntToVmNumber(key)])), binToHex(bigIntToVmNumber(value)),
    ] as const)
    .sort((left, right) => (left[0] < right[0] ? -1 : 1));
}

describe('a hop whose proxied callee writes beside a call of its own', () => {
  it('settles the four reaches, each splicing its key into the list the ones before it left', async () => {
    const world = await deployed();

    expect((await run(world, false, 2n)).txid).toMatch(/^[0-9a-f]{64}$/);
    expect(await eventsList(world)).toStrictEqual(expectedList([[10n, 100n], [20n, 200n], [100n, 0n], [101n, 1n]]));
  });

  it('settles the guarded reach too when the caller takes it, five keys in all', async () => {
    const world = await deployed();

    expect((await run(world, true, 2n)).txid).toMatch(/^[0-9a-f]{64}$/);
    expect(await eventsList(world))
      .toStrictEqual(expectedList([[10n, 100n], [20n, 200n], [100n, 0n], [101n, 1n], [99n, 99n]]));
  });
});
