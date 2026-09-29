import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { bytesToHex } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { buildProxyArtifact, deployPerCallProxy } from '../../../src/per-call/proxy/index.js';
import { callPerCallProxyEntry } from '../../../src/per-call/proxy/deploy.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A hop whose entry reaches a contract that sits behind its own proxy, from several sites of one entry.
 *
 * The callee is two contracts, so each reach takes a master of each: one of the callee proxy's, which the caller
 * records, and one of the implementation's, whose input carries that reach's call data. The reaches share the
 * callee proxy's one block, and the implementation's masters share its own. The entry calls the callee from two
 * unconditional sites with different arguments, from a loop of two turns and from a guarded site the caller's
 * argument leaves untaken; the hop is driven only through the shipped deployment, composer, derivation and machine.
 */

const INNER_IMPL_CATEGORY = '11'.repeat(32);
const INNER_PROXY_CATEGORY = '22'.repeat(32);
const OUTER_IMPL_CATEGORY = '33'.repeat(32);
const OUTER_PROXY_CATEGORY = '44'.repeat(32);

// Each contract declares the address its own proxy forwards to beside the fields the entry reads, which is what a
// generated proxy mirrors. The caller holds the callee proxy's address in its own record, so the planner reads it
// from the live state rather than from a literal.
const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface IInner { function note(int a); function tick(int n); }'
  + ' contract Inner {'
  + '   address public implementation;'
  + '   int public hits;'
  + '   function initialize() { this.hits = 1; require(this.hits > 0); }'
  + '   function note(int a) { require(a >= this.hits - 1); require(true); }'
  + '   function tick(int n) { require(n >= this.hits - 1); require(true); }'
  + ' }'
  + ' contract Outer {'
  + '   address public implementation;'
  + '   address public inner;'
  + '   function initialize(address target) { this.inner = target; require(true); }'
  + '   function run(bool takeExtra, int times) {'
  + '     IInner(this.inner).note(1);'
  + '     IInner(this.inner).note(3);'
  + '     for (int i = 0; i < times; i = i + 1) { IInner(this.inner).tick(i); }'
  + '     if (takeExtra) { IInner(this.inner).note(9); }'
  + '     require(true);'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
const inner = artifacts.Inner!;
const outer = artifacts.Outer!;

/** A coin a genesis is funded from; its txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** Deploys each contract behind its generated proxy and runs their initialize hops. */
async function deployBoth(network: MockNetworkProvider): Promise<{
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

  // The callee's pools hold one master per reach: two unconditional calls, two loop turns and the guarded call.
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

describe('a hop whose entry reaches a contract behind its own proxy from several sites', () => {
  it('gives each reach a master of both contracts, skips the untaken site, and broadcasts', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployBoth(network);

    const result = await callPerCallProxyEntry({
      provider: network,
      implementationArtifact: outer,
      proxyArtifact: buildProxyArtifact(outer),
      proxyCategoryId: funded.outerProxyCategoryId,
      implementationCategoryId: funded.outerImplementationCategoryId,
      functionName: 'run',
      args: [false, 2n],
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    });

    // Each reach derives the callee's implementation entry, then the proxy fallback that entered it; the four
    // reaches come first, then the entry that made them and the fallback that entered it.
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([
      `${inner.contractName}.note()`,
      `${inner.contractName}Proxy.__fallback()`,
      `${inner.contractName}.note()`,
      `${inner.contractName}Proxy.__fallback()`,
      `${inner.contractName}.tick()`,
      `${inner.contractName}Proxy.__fallback()`,
      `${inner.contractName}.tick()`,
      `${inner.contractName}Proxy.__fallback()`,
      `${outer.contractName}.run()`,
      `${outer.contractName}Proxy.__fallback()`,
    ]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

    // The four reaches share each of the callee's two blocks: the proxy's, whose fallbacks the caller records, and
    // the implementation's, whose delegate frames carry the reaches' call data.
    const proxyContract = buildProxyArtifact(inner).contractName;
    const proxyBlock = result.draft.layout.blocks.find((block) => block.contract === proxyContract)!;
    const implementationBlock = result.draft.layout.blocks.find((block) => block.contract === inner.contractName)!;
    expect(proxyBlock.masters).toHaveLength(4);
    expect(implementationBlock.masters).toHaveLength(4);
    // The guarded site the caller's argument leaves untaken places nothing, so the entry ran four calls.
    expect(result.draft.blockOf('implementation-master').calls).toHaveLength(4);
    // Each reach's own call data reaches its own implementation input: the two unconditional calls and the two
    // loop turns all differ.
    const implMasters = ['callee-impl-master-2', 'callee-impl-master-4', 'callee-impl-master-6', 'callee-impl-master-8'];
    const callData = implMasters.map((master) => bytesToHex(result.draft.unlockingBytecodeOf(master)));
    expect(new Set(callData).size).toBe(callData.length);
  });
});
