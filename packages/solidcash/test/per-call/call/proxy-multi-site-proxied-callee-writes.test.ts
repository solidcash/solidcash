import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { validatorAddress } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { buildProxyArtifact, deployPerCallProxy } from '../../../src/per-call/proxy/index.js';
import { callPerCallProxyEntry } from '../../../src/per-call/proxy/deploy.js';
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
 * head is minted only at genesis), and every reach splices its own key in through that one head. The cross-reach
 * check refuses that by name before anything is broadcast, counting the loop's turns and the taken guarded site as
 * reaches of their own.
 */

const PING_CATEGORY = '99'.repeat(32);
const INNER_IMPL_CATEGORY = '11'.repeat(32);
const INNER_PROXY_CATEGORY = '22'.repeat(32);
const OUTER_IMPL_CATEGORY = '33'.repeat(32);
const OUTER_PROXY_CATEGORY = '44'.repeat(32);
const PING_ADDRESS = validatorAddress(hexToBin(PING_CATEGORY), VALIDATOR_PROGRAM);

const SOURCE = 'pragma solidcash ^0.13.0;'
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

const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
const ping = artifacts.Ping!;
const inner = artifacts.Inner!;
const outer = artifacts.Outer!;

/** A coin a genesis is funded from; its txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** Deploys the callee's own callee, the proxied callee and the root behind its proxy, and runs both initializes. */
async function deployAll(network: MockNetworkProvider): Promise<{
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

  const innerDeployment = await deployPerCallProxy({
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

  const outerDeployment = await deployPerCallProxy({
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

/** The cross-reach check's words for `count` reaches of the callee's entry inserting through one node of `events`. */
function sameNodeRefusal(count: number): string {
  return `the hop reaches the entry "${inner.contractName}.record()" ${count} times, and ${count} of them insert `
    + 'into collection "events" through the same node';
}

/** True while the caller's coin is unspent, i.e. nothing was broadcast for the hop. */
async function callCoinLive(world: World): Promise<boolean> {
  return (await world.network.getUtxosForLockingBytecode(world.funded.deployerLock))
    .some((utxo) => utxo.txid === world.funded.callCoin.txid && utxo.vout === world.funded.callCoin.vout);
}

describe('a hop whose proxied callee writes beside a call of its own', () => {
  it('refuses the four reaches, each splicing through the one genesis head, and broadcasts nothing', async () => {
    const world = await deployed();
    const { network, funded } = world;

    // Each reach plans its insert against the deployment alone, so all four relink the one head the genesis minted
    // to their own key, and one spent input is recreated once. Owner: the SDK hop planner
    // (`proxy/external-calls.ts`, `requireSatisfiableReachWrites`), until reaches that touch one node share one
    // participant with their views chained in execution order.
    await expect(callPerCallProxyEntry({
      provider: network,
      implementationArtifact: outer,
      proxyArtifact: buildProxyArtifact(outer),
      proxyCategoryId: funded.outerProxyCategoryId,
      implementationCategoryId: funded.outerImplementationCategoryId,
      functionName: 'run',
      args: [false, 2n],
      externals: { IPing: { artifact: ping, categoryId: PING_CATEGORY } },
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    })).rejects.toThrow(sameNodeRefusal(4));
    expect(await callCoinLive(world)).toBe(true);
  });

  it('refuses the guarded reach too when the caller takes it, counting five', async () => {
    const world = await deployed();
    const { network, funded } = world;

    // Owner: as above.
    await expect(callPerCallProxyEntry({
      provider: network,
      implementationArtifact: outer,
      proxyArtifact: buildProxyArtifact(outer),
      proxyCategoryId: funded.outerProxyCategoryId,
      implementationCategoryId: funded.outerImplementationCategoryId,
      functionName: 'run',
      args: [true, 2n],
      externals: { IPing: { artifact: ping, categoryId: PING_CATEGORY } },
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    })).rejects.toThrow(sameNodeRefusal(5));
    expect(await callCoinLive(world)).toBe(true);
  });
});
