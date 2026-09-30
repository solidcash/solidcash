import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { FrameKind, bytesToHex } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { deployMaster } from '../../../src/per-call/deploy/index.js';
import { buildProxyArtifact, deployPerCallProxy } from '../../../src/per-call/proxy/index.js';
import { callPerCallProxyEntry } from '../../../src/per-call/proxy/deploy.js';
import type { PerCallProxyExternal } from '../../../src/per-call/proxy/external-calls.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A hop whose entry calls a contract that itself sits behind a per-call proxy.
 *
 * The caller's own record holds the callee's address, which is the address the callee's proxy presents rather than
 * its implementation's, so the callee is resolved from that address and has to be placed as the same chain a root
 * hop places for its own proxy: the proxy's fallback frame plus the implementation entry it delegates to, on the
 * proxy's records. The hop is driven only through the shipped deployment, composer, derivation and machine.
 */

const INNER_IMPL_CATEGORY = '11'.repeat(32);
const INNER_PROXY_CATEGORY = '22'.repeat(32);
const OUTER_IMPL_CATEGORY = '33'.repeat(32);
const OUTER_PROXY_CATEGORY = '44'.repeat(32);

// Each contract declares the address its fallback forwards to beside one record field of its own, which is what a
// generated proxy mirrors; the callee's entry reads its record so the delegate frame that runs it is more than a
// passthrough. The caller's entry makes no write beside its call, which the hop would otherwise have to place
// without knowing which segment the write lands in.
const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface IInner { function ping(); }'
  + ' contract Inner {'
  + '   address public implementation;'
  + '   int public hits;'
  + '   function initialize() { this.hits = 1; require(this.hits > 0); }'
  + '   function ping() { require(this.hits == 1); }'
  + ' }'
  + ' contract Outer {'
  + '   address public implementation;'
  + '   address public inner;'
  + '   function initialize(address target) { this.inner = target; require(true); }'
  + '   function run() { IInner(this.inner).ping(); require(true); }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
const inner = artifacts.Inner!;
const outer = artifacts.Outer!;

/** A coin a genesis is funded from; its txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 500_000n };
}

/**
 * Deploys both contracts the way the SDK's proxy route deploys them and runs each one's initialize hop.
 *
 * The callee is deployed first, so the caller's own initialize can be handed the address the callee's proxy
 * presents; the caller's entry then computes that same address from its own record at call time.
 */
async function deployBoth(network: MockNetworkProvider): Promise<{
  readonly innerProxyCategoryId: string;
  readonly innerImplementationCategoryId: string;
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

  const coins = [
    funding(INNER_IMPL_CATEGORY), funding(INNER_PROXY_CATEGORY),
    funding(OUTER_IMPL_CATEGORY), funding(OUTER_PROXY_CATEGORY),
  ];
  for (const coin of coins) await network.addUtxo(source.address, coin);
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
    implementationDeploy: { fundingUtxo: funding(INNER_IMPL_CATEGORY), funder, changeAddress: source.address },
    proxyDeploy: { fundingUtxo: funding(INNER_PROXY_CATEGORY), funder, changeAddress: source.address },
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
    innerProxyCategoryId: innerDeployment.proxy.categoryId,
    innerImplementationCategoryId: innerDeployment.implementation.categoryId,
    outerProxyCategoryId: outerDeployment.proxy.categoryId,
    outerImplementationCategoryId: outerDeployment.implementation.categoryId,
    deployerLock,
    changeAddress: source.address,
    callCoin,
    funder: callerFunder,
  };
}

describe('a hop whose entry calls a contract behind its own proxy', () => {
  it('resolves the callee from the address its caller holds and settles the whole chain', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployBoth(network);

    // The caller names no externals: the callee is found from the address the caller's own record holds, which is
    // the address its proxy presents.
    const result = await callPerCallProxyEntry({
      provider: network,
      implementationArtifact: outer,
      proxyArtifact: buildProxyArtifact(outer),
      proxyCategoryId: funded.outerProxyCategoryId,
      implementationCategoryId: funded.outerImplementationCategoryId,
      functionName: 'run',
      args: [],
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    });

    // The callee's delegate frame completes first, then the callee's fallback, then the caller's entry and the
    // caller's own fallback: the same chain the root hop places, nested one level down.
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([
      `${inner.contractName}.ping()`,
      `${inner.contractName}Proxy.__fallback()`,
      `${outer.contractName}.run()`,
      `${outer.contractName}Proxy.__fallback()`,
    ]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

    // The callee's proxy leg delegates to the implementation's own master, at the address the implementation's
    // category derives, exactly as the root hop's own fallback delegates to its implementation.
    const callee = result.draft.blockOf('callee-master-1');
    const implementationAddress =
      deployMaster(inner, hexToBin(funded.innerImplementationCategoryId), VALIDATOR_PROGRAM).address;
    expect(callee.calls).toHaveLength(1);
    expect(callee.calls[0]!.kind).toBe(FrameKind.DELEGATE);
    expect(bytesToHex(callee.calls[0]!.target)).toBe(bytesToHex(implementationAddress));
  });
});

// A callee that is two contracts *and* calls a third: the proxy leg delegates to the implementation entry, which
// then reaches a contract of its own. The callee's own call has to be bound before the frame that makes it is
// settled, exactly as the root hop binds the implementation entry's calls.
const RELAY_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface IPing { function ping(int n); }'
  + ' interface IInner { function relay(int n); function lateWrite(int id, int v); }'
  + ' contract Ping { int public last; function ping(int n) { require(n >= this.last); require(true); } }'
  + ' contract Inner {'
  + '   address public implementation;'
  + '   address public leaf;'
  + '   int public hits;'
  + '   mapping(int => int) public marks;'
  + '   function initialize(address target) { this.leaf = target; this.hits = 1; this.marks[1] = 1; require(true); }'
  + '   function relay(int n) { IPing(this.leaf).ping(n); require(true); }'
  + '   function lateWrite(int id, int v) {'
  + '     this.marks[id] = v;'
  + '     IPing(this.leaf).ping(v);'
  + '     this.marks[id + 1] = v + 1;'
  + '     require(true);'
  + '   }'
  + ' }'
  + ' contract Outer {'
  + '   address public implementation;'
  + '   address public inner;'
  + '   function initialize(address target) { this.inner = target; require(true); }'
  + '   function run(int n) { IInner(this.inner).relay(n); require(true); }'
  + '   function runLateWrite(int id, int v) { IInner(this.inner).lateWrite(id, v); require(true); }'
  + ' }';

const relayArtifacts = compileStringMulti(RELAY_SOURCE, { composition: 'per-call' });
const relayPing = relayArtifacts.Ping!;
const relayInner = relayArtifacts.Inner!;
const relayOuter = relayArtifacts.Outer!;

const RELAY_PING_CATEGORY = '5a'.repeat(32);
const RELAY_INNER_IMPL_CATEGORY = '5b'.repeat(32);
const RELAY_INNER_PROXY_CATEGORY = '5c'.repeat(32);
const RELAY_OUTER_IMPL_CATEGORY = '5d'.repeat(32);
const RELAY_OUTER_PROXY_CATEGORY = '5e'.repeat(32);

/** Deploys the callee's own callee, the proxied callee and the root behind its proxy, and runs both initializes. */
async function deployRelay(network: MockNetworkProvider): Promise<{
  readonly outerProxyCategoryId: string;
  readonly outerImplementationCategoryId: string;
  readonly innerProxyCategoryId: string;
  readonly innerImplementationCategoryId: string;
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

  // The callee's own callee is a plain per-call contract, reached at the address the callee's record holds.
  const pingFunding = funding(RELAY_PING_CATEGORY);
  await network.addUtxo(source.address, pingFunding);
  await deployStatefulContract(relayPing, [], {
    fundingUtxo: pingFunding, funder, changeAddress: source.address, provider: network, threadCount: 4,
  });

  for (const txid of [
    RELAY_INNER_IMPL_CATEGORY, RELAY_INNER_PROXY_CATEGORY, RELAY_OUTER_IMPL_CATEGORY, RELAY_OUTER_PROXY_CATEGORY,
  ]) await network.addUtxo(source.address, funding(txid));
  const innerInitCoin = funding('5f'.repeat(32));
  const outerInitCoin = funding('6a'.repeat(32));
  const callCoin = funding('6b'.repeat(32));
  for (const coin of [innerInitCoin, outerInitCoin, callCoin]) {
    await network.addUtxo(binToHex(deployerLock), coin);
  }
  await fundShippedFacets(network);

  // The proxied callee's record holds the address of the contract its own call reaches.
  const pingMaster = deployMaster(relayPing, hexToBin(RELAY_PING_CATEGORY), VALIDATOR_PROGRAM).address;
  const innerDeployment = await deployPerCallProxy({
    provider: network,
    implementationArtifact: relayInner,
    proxyArtifact: buildProxyArtifact(relayInner),
    implementationDeploy: {
      fundingUtxo: funding(RELAY_INNER_IMPL_CATEGORY), funder, changeAddress: source.address, threadCount: 4,
    },
    proxyDeploy: {
      fundingUtxo: funding(RELAY_INNER_PROXY_CATEGORY), funder, changeAddress: source.address, threadCount: 4,
    },
    initialize: { functionName: 'initialize', args: [pingMaster] },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: innerInitCoin, funder: callerFunder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(innerDeployment.initialize.broadcast).toBeDefined();

  const outerDeployment = await deployPerCallProxy({
    provider: network,
    implementationArtifact: relayOuter,
    proxyArtifact: buildProxyArtifact(relayOuter),
    implementationDeploy: { fundingUtxo: funding(RELAY_OUTER_IMPL_CATEGORY), funder, changeAddress: source.address },
    proxyDeploy: { fundingUtxo: funding(RELAY_OUTER_PROXY_CATEGORY), funder, changeAddress: source.address },
    initialize: { functionName: 'initialize', args: [innerDeployment.proxy.address] },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: outerInitCoin, funder: callerFunder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(outerDeployment.initialize.broadcast).toBeDefined();

  return {
    outerProxyCategoryId: outerDeployment.proxy.categoryId,
    outerImplementationCategoryId: outerDeployment.implementation.categoryId,
    innerProxyCategoryId: innerDeployment.proxy.categoryId,
    innerImplementationCategoryId: innerDeployment.implementation.categoryId,
    deployerLock, changeAddress: source.address, callCoin, funder: callerFunder,
  };
}

/** The externals a relay hop names: the callee's own callee, and the callee behind its proxy. */
function relayExternals(funded: Awaited<ReturnType<typeof deployRelay>>): Record<string, PerCallProxyExternal> {
  return {
    IPing: { artifact: relayPing, categoryId: RELAY_PING_CATEGORY },
    IInner: {
      artifact: relayInner,
      categoryId: funded.innerProxyCategoryId,
      proxyArtifact: buildProxyArtifact(relayInner),
      implementationCategoryId: funded.innerImplementationCategoryId,
    },
  };
}

describe('a hop whose proxied callee calls a third contract of its own', () => {
  it("settles the callee chain and the callee's own call, and broadcasts", async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployRelay(network);

    const result = await callPerCallProxyEntry({
      provider: network,
      implementationArtifact: relayOuter,
      proxyArtifact: buildProxyArtifact(relayOuter),
      proxyCategoryId: funded.outerProxyCategoryId,
      implementationCategoryId: funded.outerImplementationCategoryId,
      functionName: 'run',
      args: [7n],
      externals: relayExternals(funded),
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    });

    // The callee's own callee completes first, then the callee's implementation entry, then the proxy leg that
    // delegated to it, then the caller's entry and its own fallback.
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([
      `${relayPing.contractName}.ping()`,
      `${relayInner.contractName}.relay()`,
      `${relayInner.contractName}Proxy.__fallback()`,
      `${relayOuter.contractName}.run()`,
      `${relayOuter.contractName}Proxy.__fallback()`,
    ]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses by name a callee entry the compiler refused, which the hop could never declare', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployRelay(network);

    // `Inner.lateWrite` writes its verified mapping, calls out, then writes again, and the compiler refuses it by
    // name: the segment its second write lands in is a fact the derivation does not read. The hop has no call
    // records for it, so the plan would settle the frame against a program whose calls stay unbound.
    await expect(callPerCallProxyEntry({
      provider: network,
      implementationArtifact: relayOuter,
      proxyArtifact: buildProxyArtifact(relayOuter),
      proxyCategoryId: funded.outerProxyCategoryId,
      implementationCategoryId: funded.outerImplementationCategoryId,
      functionName: 'runLateWrite',
      args: [2n, 5n],
      externals: relayExternals(funded),
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    })).rejects.toThrow(/Inner\.lateWrite\(\)[\s\S]*which the compiler refused/);
  });
});
