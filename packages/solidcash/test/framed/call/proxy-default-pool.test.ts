import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Signer } from '../../../src/index.js';
import { MockNetworkProvider } from '../../../src/network/mock/index.js';
import {
  deployProxy, getContractFactory, type FramedArtifact, type FramedProxyHandle,
} from '../../../src/stateful/index.js';
import { DEFAULT_MASTER_POOL_SIZE, readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { buildProxyArtifact } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * The pool a framed deployment funds, and that a caller's override is authoritative.
 *
 * The SDK's proxy route deploys both geneses with the composing default unless the caller names a size: twelve
 * masters, so one transaction may enter the contract at a dozen sites, and four validators, so it may root as many
 * compositions at once. A flow that reaches one contract from several sites therefore settles against the
 * deployment as it comes out of the SDK. A caller that names a smaller pool gets exactly that pool, and the planner
 * still refuses the reach past its last master rather than deploying a larger one.
 */

const SOURCE = 'pragma solidcash ^0.14.0;'
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

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const inner = artifacts.Inner!;
const outer = artifacts.Outer!;

/** A mock network a composition shape can run on, and a signer holding fresh vout-0 coins for the geneses. */
async function fundedSigner(network: MockNetworkProvider, fill: number): Promise<Signer> {
  const signer = new Signer(new Uint8Array(32).fill(fill), network);
  for (let index = 0; index < 12; index += 1) {
    await network.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
  }
  // The hops broadcast, so each composition's facet input needs a live UTXO at the facet's lock.
  await fundShippedFacets(network);
  return signer;
}

interface Pair {
  readonly inner: FramedProxyHandle;
  readonly outer: FramedProxyHandle;
  readonly hopCoin: { txid: string; vout: number; satoshis: bigint };
}

/** Deploys the callee and its caller through the SDK's own proxy route, the caller naming the callee's address. */
async function deployPair(
  network: MockNetworkProvider, signer: Signer,
  proxyOverrides?: { readonly threadCount?: number; readonly validatorCount?: number },
): Promise<Pair> {
  const deployedInner = await deployProxy(
    getContractFactory(inner as FramedArtifact, signer), [],
    proxyOverrides === undefined ? undefined : { proxyOverrides },
  );
  const deployedOuter = await deployProxy(
    getContractFactory(outer as FramedArtifact, signer), [deployedInner.proxyDeployment.proxy.address],
  );
  const hopCoin = { txid: '9a'.repeat(32), vout: 0, satoshis: 300_000n };
  await network.addUtxo(binToHex(signer.getLockingBytecode()), hopCoin);
  return { inner: deployedInner, outer: deployedOuter, hopCoin };
}

/** Drives the caller's entry, which reaches the callee proxy at four sites. */
async function callRun(
  pair: Pair, network: MockNetworkProvider, signer: Signer,
): Promise<FramedProxyCallResult> {
  return callFramedProxyEntry({
    provider: network,
    implementationArtifact: outer,
    proxyArtifact: buildProxyArtifact(outer),
    proxyCategoryId: pair.outer.proxyDeployment.proxy.categoryId,
    implementationCategoryId: pair.outer.proxyDeployment.implementation.categoryId,
    functionName: 'run',
    args: [false, 2n],
    callerUtxo: pair.hopCoin,
    callerLockingBytecode: signer.getLockingBytecode(),
    funder: signer.unlockP2PKH(),
    changeAddress: signer.getAddress(),
    vm: compositionMachine(),
  });
}

describe('the pool a framed deployment funds', () => {
  it('funds the composing default, and a hop into one contract at several sites settles against it', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signer = await fundedSigner(network, 0x71);
    const pair = await deployPair(network, signer);

    // Both geneses came out of the SDK's proxy route and settled their initialize hop.
    expect(pair.inner.proxyDeployment.initialize.accepted).toBe(true);
    expect(pair.outer.proxyDeployment.initialize.accepted).toBe(true);

    // The live pool the proxy's category holds is the composing default, read back by category.
    const proxyArtifact = buildProxyArtifact(inner);
    const pools = await readFramedDeployment(
      network, pair.inner.proxyDeployment.proxy.categoryId, proxyArtifact.stateLayout!);
    expect(pools.masters).toHaveLength(DEFAULT_MASTER_POOL_SIZE.masters);
    expect(pools.validators).toHaveLength(DEFAULT_MASTER_POOL_SIZE.validators);

    // The entry's four reaches - two unconditional and two loop turns - each take a master of the callee proxy's
    // block and one of its implementation's, and every participant is accepted.
    const result = await callRun(pair, network, signer);
    const proxyBlock = result.draft.layout.blocks.find((block) => block.contract === proxyArtifact.contractName)!;
    expect(proxyBlock.masters).toHaveLength(4);
    const implementationBlock = result.draft.layout.blocks.find((block) => block.contract === inner.contractName)!;
    expect(implementationBlock.masters).toHaveLength(4);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

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
    // The guarded site the caller's argument leaves untaken places nothing, so the entry ran four calls.
    expect(result.draft.blockOf('implementation-master').calls).toHaveLength(4);
    // Each reach's own call data reaches its own implementation input: the two unconditional calls and the two
    // loop turns all differ.
    const implMasters = ['callee-impl-master-2', 'callee-impl-master-4', 'callee-impl-master-6', 'callee-impl-master-8'];
    const callData = implMasters.map((master) => binToHex(result.draft.unlockingBytecodeOf(master)));
    expect(new Set(callData).size).toBe(callData.length);
  });

  it('funds exactly the pool a caller names, and the planner refuses a reach past it', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signer = await fundedSigner(network, 0x73);
    const pair = await deployPair(network, signer, { threadCount: 3, validatorCount: 1 });

    // The caller's counts are authoritative: the proxy holds three masters and one validator, not the default.
    const proxyArtifact = buildProxyArtifact(inner);
    const pools = await readFramedDeployment(
      network, pair.inner.proxyDeployment.proxy.categoryId, proxyArtifact.stateLayout!);
    expect(pools.masters).toHaveLength(3);
    expect(pools.validators).toHaveLength(1);

    // Four reaches cannot fit three masters, so the plan refuses by name before anything is broadcast.
    await expect(callRun(pair, network, signer)).rejects.toThrow(/holds 3 master\(s\)/);
  });
});
