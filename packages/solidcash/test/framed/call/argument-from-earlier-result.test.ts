import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { parsePushdataCommitment } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { deployMaster } from '../../../src/framed/deploy/index.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import type { FramedProxyExternal } from '../../../src/framed/proxy/external-calls.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * Calls whose arguments and loop bound are what earlier calls of the same entry returned, planned in execution order.
 *
 * `Root.chain` reads a price from `Feed`, passes it to `Math.twice`, and passes what that returned to
 * `Math.thrice`; `Root.sum` reads a count from `Feed` and calls `Math.twice` once per turn of a loop bounded by it.
 * The hop cannot state those calls from the caller's own facts: it stops its plan before each such site, settles
 * the earlier call, learns its result and plans again from it. The settled hop is broadcast, and the entry's own
 * record holds what its body computed from the results.
 */

/** A 32-byte value with varied bytes, `seed` chosen so each name is distinct. */
function category(seed: string): string {
  const base = 'b1c2d3e4f5061728394a5b6c7d8e9fa';
  return `${seed}${base}${base}`.slice(0, 64);
}

const FEED_CATEGORY = category('0a');
const MATH_CATEGORY = category('1b');
const ROOT_IMPL_CATEGORY = category('2c');
const ROOT_PROXY_CATEGORY = category('3d');
const ROOT_INIT_TXID = category('4e');
const CALL_TXID = category('5f');

const PRICE = 7n;
const COUNT = 3n;

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IFeed { function price() view returns (int); function count() view returns (int); }'
  + ' interface IMath { function twice(int x) view returns (int); function thrice(int x) view returns (int); }'
  + ' contract Feed {'
  + '   int public quote;'
  + '   int public turns;'
  + `   constructor() { this.quote = ${PRICE}; this.turns = ${COUNT}; }`
  + '   function price() view returns (int) { return this.quote; }'
  + '   function count() view returns (int) { return this.turns; }'
  + ' }'
  + ' contract Math {'
  + '   int public scale;'
  + '   constructor() { this.scale = 1; }'
  + '   function twice(int x) view returns (int) { return x * 2 * this.scale; }'
  + '   function thrice(int x) view returns (int) { return x * 3 * this.scale; }'
  + ' }'
  + ' contract Root {'
  + '   address public implementation;'
  + '   address public feed;'
  + '   address public math;'
  + '   int public last;'
  + '   function initialize(address f, address m) { this.feed = f; this.math = m; require(true); }'
  + '   function chain() {'
  + '     int p = IFeed(this.feed).price();'
  + '     int d = IMath(this.math).twice(p);'
  + '     int t = IMath(this.math).thrice(d);'
  + '     this.last = t;'
  + '   }'
  + '   function sum() {'
  + '     int n = IFeed(this.feed).count();'
  + '     int total = 0;'
  + '     for (int i = 0; i < n; i = i + 1) {'
  + '       total = total + IMath(this.math).twice(i);'
  + '     }'
  + '     this.last = total;'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const feed = artifacts.Feed!;
const math = artifacts.Math!;
const root = artifacts.Root!;

function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 500_000n };
}

interface Deployed {
  readonly rootProxyCategoryId: string;
  readonly rootImplementationCategoryId: string;
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
  readonly callCoin: { txid: string; vout: number; satoshis: bigint };
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
  readonly externals: Record<string, FramedProxyExternal>;
}

/** Deploys the feed and the math plain, then the caller behind its own proxy, and runs the caller's initialize. */
async function deployAll(network: MockNetworkProvider): Promise<Deployed> {
  const signature = new SignatureTemplate(alicePriv);
  const source = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = source.unlock.spend(alicePub, signature);
  const callerFunder = signature.unlockP2PKH();
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);

  for (const [artifact, txid] of [[feed, FEED_CATEGORY], [math, MATH_CATEGORY]] as const) {
    const coin = funding(txid);
    await network.addUtxo(source.address, coin);
    await deployStatefulContract(artifact, [], {
      fundingUtxo: coin, funder, changeAddress: source.address, provider: network, threadCount: 4,
    });
  }
  for (const txid of [ROOT_IMPL_CATEGORY, ROOT_PROXY_CATEGORY]) {
    await network.addUtxo(source.address, funding(txid));
  }
  const rootInitCoin = funding(ROOT_INIT_TXID);
  const callCoin = funding(CALL_TXID);
  for (const coin of [rootInitCoin, callCoin]) await network.addUtxo(binToHex(deployerLock), coin);
  await fundShippedFacets(network);

  const addressOf = (artifact: typeof feed, txid: string): Uint8Array =>
    deployMaster(artifact, hexToBin(txid), VALIDATOR_PROGRAM).address;
  const rootDeployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: root,
    proxyArtifact: buildProxyArtifact(root),
    implementationDeploy: { fundingUtxo: funding(ROOT_IMPL_CATEGORY), funder, changeAddress: source.address },
    proxyDeploy: { fundingUtxo: funding(ROOT_PROXY_CATEGORY), funder, changeAddress: source.address },
    initialize: { functionName: 'initialize', args: [addressOf(feed, FEED_CATEGORY), addressOf(math, MATH_CATEGORY)] },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: rootInitCoin, funder: callerFunder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(rootDeployment.initialize.broadcast).toBeDefined();

  return {
    rootProxyCategoryId: rootDeployment.proxy.categoryId,
    rootImplementationCategoryId: rootDeployment.implementation.categoryId,
    deployerLock,
    changeAddress: source.address,
    callCoin,
    funder: callerFunder,
    externals: {
      IFeed: { artifact: feed, categoryId: FEED_CATEGORY },
      IMath: { artifact: math, categoryId: MATH_CATEGORY },
    },
  };
}

/** Runs one of the caller's entries through its proxy. */
async function enter(
  network: MockNetworkProvider, deployed: Deployed, functionName: string,
): Promise<FramedProxyCallResult> {
  return callFramedProxyEntry({
    provider: network,
    implementationArtifact: root,
    proxyArtifact: buildProxyArtifact(root),
    proxyCategoryId: deployed.rootProxyCategoryId,
    implementationCategoryId: deployed.rootImplementationCategoryId,
    functionName,
    args: [],
    externals: deployed.externals,
    callerUtxo: deployed.callCoin,
    callerLockingBytecode: deployed.deployerLock,
    funder: deployed.funder,
    changeAddress: deployed.changeAddress,
    vm: compositionMachine(),
  });
}

/** The deployment the cases share, and the chain as it stood when it was done. */
interface World {
  readonly network: MockNetworkProvider;
  readonly deployed: Deployed;
  readonly snapshot: SnapshotRestorer;
}

let worldRun: Promise<World> | undefined;

/** One deployment serves both cases, each rewinding the chain to it first, so no case reads another's broadcast. */
async function world(): Promise<World> {
  worldRun ??= (async (): Promise<World> => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const deployed = await deployAll(network);
    return { network, deployed, snapshot: await network.takeSnapshot() };
  })();
  const shared = await worldRun;
  await shared.snapshot.restore();
  return shared;
}

/** The value the entry left in the caller's `last` field, read from the record the hop wrote. */
function lastOf(result: FramedProxyCallResult): unknown {
  const layout = buildProxyArtifact(root).stateLayout!;
  const field = layout.variables.find((variable) => variable.name === 'last')!;
  return parsePushdataCommitment(binToHex(result.writtenCommitments[field.nftIndex]!), layout, field.nftIndex).last;
}

describe('calls whose arguments and loop bound are earlier calls\' results, planned in execution order', () => {
  it('passes each result on to the next call and broadcasts the chain', async () => {
    const { network, deployed } = await world();
    const result = await enter(network, deployed, 'chain');
    expect(result.accepted).toBe(true);
    expect(result.verdicts.every((verdict) => verdict.accepted)).toBe(true);
    expect(result.broadcast).toBeDefined();
    expect(result.draft.blockOf('implementation-master').calls).toHaveLength(3);
    expect(lastOf(result)).toBe(PRICE * 2n * 3n);
  });

  it('turns a loop as often as an earlier call returned and broadcasts it', async () => {
    const { network, deployed } = await world();
    const result = await enter(network, deployed, 'sum');
    expect(result.accepted).toBe(true);
    expect(result.verdicts.every((verdict) => verdict.accepted)).toBe(true);
    expect(result.broadcast).toBeDefined();
    // The count, then one call per turn.
    expect(result.draft.blockOf('implementation-master').calls).toHaveLength(1 + Number(COUNT));
    expect(lastOf(result)).toBe(2n * (0n + 1n + 2n));
  });
});
