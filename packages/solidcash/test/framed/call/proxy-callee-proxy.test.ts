import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { deployMaster } from '../../../src/framed/deploy/index.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry } from '../../../src/framed/proxy/deploy.js';
import type { FramedProxyExternal } from '../../../src/framed/proxy/external-calls.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A hop whose entry calls a contract that itself sits behind a framed proxy.
 *
 * The caller's own record holds the callee's address, which is the address the callee's proxy presents rather than
 * its implementation's, so the callee has to be placed as the same chain a root hop places for its own proxy: the
 * proxy's fallback frame plus the implementation entry it delegates to, on the proxy's records. That chain alone,
 * resolved with no externals named, is the settled hop of `hop-trace.test.ts`. The hop is driven only through the
 * shipped deployment, composer, derivation and machine.
 */

/** A coin a genesis is funded from; its txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 500_000n };
}

// A callee that is two contracts *and* calls a third: the proxy leg delegates to the implementation entry, which
// then reaches a contract of its own. The callee's own call has to be bound before the frame that makes it is
// settled, exactly as the root hop binds the implementation entry's calls.
const RELAY_SOURCE = 'pragma solidcash ^0.14.0;'
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

const relayArtifacts = compileStringMulti(RELAY_SOURCE, { composition: 'framed' });
const relayPing = relayArtifacts.Ping!;
const relayInner = relayArtifacts.Inner!;
const relayOuter = relayArtifacts.Outer!;

const RELAY_PING_CATEGORY = '5a'.repeat(31) + 'a5';
const RELAY_INNER_IMPL_CATEGORY = '5b'.repeat(31) + 'a4';
const RELAY_INNER_PROXY_CATEGORY = '5c'.repeat(31) + 'a3';
const RELAY_OUTER_IMPL_CATEGORY = '5d'.repeat(31) + 'a2';
const RELAY_OUTER_PROXY_CATEGORY = '5e'.repeat(31) + 'a1';

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

  // The callee's own callee is a plain framed contract, reached at the address the callee's record holds.
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
  const innerDeployment = await deployFramedProxy({
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

  const outerDeployment = await deployFramedProxy({
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
function relayExternals(funded: Awaited<ReturnType<typeof deployRelay>>): Record<string, FramedProxyExternal> {
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

/** The relay deployment the cases share, and the chain as it stood when the deployment was done. */
interface Relay {
  readonly network: MockNetworkProvider;
  readonly funded: Awaited<ReturnType<typeof deployRelay>>;
  readonly snapshot: SnapshotRestorer;
}

let relayRun: Promise<Relay> | undefined;

/** One relay deployment serves both cases, each rewinding the chain to it first. */
async function deployedRelay(): Promise<Relay> {
  relayRun ??= (async (): Promise<Relay> => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployRelay(network);
    return { network, funded, snapshot: await network.takeSnapshot() };
  })();
  const relay = await relayRun;
  await relay.snapshot.restore();
  return relay;
}

describe('a hop whose proxied callee calls a third contract of its own', () => {
  it("settles the callee chain and the callee's own call, and broadcasts", async () => {
    const { network, funded } = await deployedRelay();

    const result = await callFramedProxyEntry({
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
    const { network, funded } = await deployedRelay();

    // `Inner.lateWrite` writes its verified mapping, calls out, then writes again, and the compiler refuses it by
    // name: the segment its second write lands in is a fact the derivation does not read. The hop has no call
    // records for it, so the plan would settle the frame against a program whose calls stay unbound.
    await expect(callFramedProxyEntry({
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
