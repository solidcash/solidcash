import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { parsePushdataCommitment } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { deployMaster } from '../../../src/per-call/deploy/index.js';
import { buildProxyArtifact, deployPerCallProxy } from '../../../src/per-call/proxy/index.js';
import { callPerCallProxyEntry, type PerCallProxyCallResult } from '../../../src/per-call/proxy/deploy.js';
import { routingOf } from '../../../src/per-call/proxy/external-calls.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A loop whose body guards its call on an earlier call's result: only the turns the guard lets through make a call.
 *
 * `Root.pay` reads five shares from `Feed` and calls `Math.twice` on each share above zero, the shape of a payout
 * that skips the parties whose share is zero. The compiler publishes the call as a `loop` site with its iteration
 * domain and the guard as its `condition`; the hop plans the turns the guard admits once the shares are learned
 * (`callingTurnsOf`), so the frame's records are exactly the calls its body makes. The shares `[3, 0, 5, 0, 0]` call
 * on turns 0 and 2 only.
 */

/** A 32-byte value with varied bytes, `seed` chosen so each name is distinct. */
function category(seed: string): string {
  const base = 'c4d5e6f708192a3b4c5d6e7f8091a2b';
  return `${seed}${base}${base}`.slice(0, 64);
}

const FEED_CATEGORY = category('0a');
const MATH_CATEGORY = category('1b');
const ROOT_IMPL_CATEGORY = category('2c');
const ROOT_PROXY_CATEGORY = category('3d');
const ROOT_INIT_TXID = category('4e');
const CALL_TXID = category('5f');

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface IFeed { function shares() view returns (uint16[5]); }'
  + ' interface IMath { function twice(int x) view returns (int); }'
  + ' contract Feed {'
  + '   int public scale;'
  + '   constructor() { this.scale = 1; }'
  + '   function shares() view returns (uint16[5]) { uint16[5] r; r[0] = 3; r[2] = 5; return r; }'
  + ' }'
  + ' contract Math {'
  + '   int public scale;'
  + '   constructor() { this.scale = 1; }'
  + '   function twice(int x) view returns (int) { return x * 2 * this.scale; }'
  + ' }'
  + ' contract Root {'
  + '   address public implementation;'
  + '   address public feed;'
  + '   address public math;'
  + '   int public last;'
  + '   function initialize(address f, address m) { this.feed = f; this.math = m; require(true); }'
  + '   function pay() {'
  + '     uint16[5] s = IFeed(this.feed).shares();'
  + '     int total = 0;'
  + '     for (int i = 0; i < 5; i = i + 1) {'
  + '       if (s[i] > 0) { total = total + IMath(this.math).twice(int(s[i])); }'
  + '     }'
  + '     this.last = total;'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
const feed = artifacts.Feed!;
const math = artifacts.Math!;
const root = artifacts.Root!;

function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 500_000n };
}

/** Deploys the feed and the math plain and the caller behind its own proxy, then enters `pay` through the proxy. */
async function payThroughProxy(): Promise<PerCallProxyCallResult> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
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
  for (const txid of [ROOT_IMPL_CATEGORY, ROOT_PROXY_CATEGORY]) await network.addUtxo(source.address, funding(txid));
  const rootInitCoin = funding(ROOT_INIT_TXID);
  const callCoin = funding(CALL_TXID);
  for (const coin of [rootInitCoin, callCoin]) await network.addUtxo(binToHex(deployerLock), coin);
  await fundShippedFacets(network);
  const addressOf = (artifact: typeof feed, txid: string): Uint8Array =>
    deployMaster(artifact, hexToBin(txid), VALIDATOR_PROGRAM).address;
  const deployment = await deployPerCallProxy({
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
  expect(deployment.initialize.broadcast).toBeDefined();
  return callPerCallProxyEntry({
    provider: network,
    implementationArtifact: root,
    proxyArtifact: buildProxyArtifact(root),
    proxyCategoryId: deployment.proxy.categoryId,
    implementationCategoryId: deployment.implementation.categoryId,
    functionName: 'pay',
    args: [],
    externals: {
      IFeed: { artifact: feed, categoryId: FEED_CATEGORY },
      IMath: { artifact: math, categoryId: MATH_CATEGORY },
    },
    callerUtxo: callCoin,
    callerLockingBytecode: deployerLock,
    funder: callerFunder,
    changeAddress: source.address,
    vm: compositionMachine(),
  });
}

/** The value the entry left in the caller's `last` field, read from the record the hop wrote. */
function lastOf(result: PerCallProxyCallResult): unknown {
  const layout = buildProxyArtifact(root).stateLayout!;
  const field = layout.variables.find((variable) => variable.name === 'last')!;
  return parsePushdataCommitment(binToHex(result.writtenCommitments[field.nftIndex]!), layout, field.nftIndex).last;
}

describe('a loop that calls only on the turns its own guard lets through', () => {
  it('publishes the guarded call as a loop site whose condition reads the earlier result per turn', () => {
    const twice = routingOf(root, 'pay').find((row) => row.functionName === 'twice')!;
    expect(twice.occurrence).toBe('loop');
    expect(twice.iterationDomain?.maximumIterations).toBe(5);
    expect(JSON.stringify(twice.condition)).toContain('"kind":"producerResult"');
    expect(JSON.stringify(twice.condition)).toContain('"kind":"loopIndex"');
  });

  it('plans the guarded turns alone and broadcasts them', async () => {
    const result = await payThroughProxy();
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast).toBeDefined();
    // The shares, then one call for each of the two shares above zero.
    expect(result.draft.blockOf('implementation-master').calls).toHaveLength(3);
    expect(lastOf(result)).toBe(2n * 3n + 2n * 5n);
  }, 300_000);
});
