import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { bytesToHex, type StateLayout } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { readPerCallDeployment } from '../../../src/per-call/deploy/index.js';
import { buildProxyArtifact, deployPerCallProxy } from '../../../src/per-call/proxy/index.js';
import { callPerCallProxyEntry } from '../../../src/per-call/proxy/deploy.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A hop whose implementation entry refuses.
 *
 * A user's coin enters the proxy's fallback, which delegatecalls the implementation, and the implementation's own
 * guard trips before the entry closes anything. The refusal names the entry's own published reason — or, for a bare
 * guard, the entry and the failing line — rather than the opcode the implementation's frame stopped on.
 */

const IMPL_CATEGORY = '66'.repeat(32);
const PROXY_CATEGORY = '67'.repeat(32);

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' error Short(int requested, int available);'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   uint public initialized;'
  + '   int public total;'
  + '   function initialize(address expected) {'
  + '     require(msg.sender == expected);'
  + '     require(this.initialized == 0);'
  + '     this.initialized = 1;'
  + '     this.total = 5;'
  + '   }'
  + '   function add(int by) { this.total = this.total + by; require(this.total >= 0, "total negative"); }'
  + '   function put(int by) { this.total = this.total + by; require(this.total >= 0); }'
  + '   function take(int by) {'
  + '     int held = this.total;'
  + '     if (by > held) { revert Short(by, held); }'
  + '     this.total = held - by;'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
const impl = artifacts.Impl!;

/** The record's own state, read back through the shipped deployment reader and decoded as a field map. */
async function recordState(network: MockNetworkProvider, categoryId: string): Promise<string> {
  const layout: StateLayout = impl.stateLayout!;
  const deployment = await readPerCallDeployment(network, categoryId, layout);
  return bytesToHex(new Uint8Array(Buffer.from(deployment.records[0]!.token!.nft!.commitment, 'hex')));
}

/** A deployment funded from the deployer's own P2PKH lock, plus a coin a caller can enter a hop with. */
async function deployedWithCallerCoin(network: MockNetworkProvider): Promise<{
  readonly proxyCategoryId: string;
  readonly implementationCategoryId: string;
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
  readonly callCoin: { txid: string; vout: number; satoshis: bigint };
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
}> {
  const signature = new SignatureTemplate(alicePriv);
  const source = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const implFunding = { txid: IMPL_CATEGORY, vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: PROXY_CATEGORY, vout: 0, satoshis: 500_000n };
  const hopCoin = { txid: '68'.repeat(32), vout: 0, satoshis: 300_000n };
  const callCoin = { txid: '69'.repeat(32), vout: 0, satoshis: 300_000n };
  for (const coin of [implFunding, proxyFunding]) await network.addUtxo(source.address, coin);
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);
  for (const coin of [hopCoin, callCoin]) await network.addUtxo(binToHex(deployerLock), coin);
  // The hops broadcast, so each composition's facet input needs a live UTXO at the facet's lock.
  await fundShippedFacets(network);

  const deployment = await deployPerCallProxy({
    provider: network,
    implementationArtifact: impl,
    implementationDeploy: {
      fundingUtxo: implFunding, funder: source.unlock.spend(alicePub, signature), changeAddress: source.address,
    },
    proxyDeploy: {
      fundingUtxo: proxyFunding, funder: source.unlock.spend(alicePub, signature), changeAddress: source.address,
    },
    initialize: { functionName: 'initialize', args: [deployerLock] },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: hopCoin, funder: signature.unlockP2PKH(), changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.broadcast).toBeDefined();
  return {
    proxyCategoryId: deployment.proxy.categoryId,
    implementationCategoryId: deployment.implementation.categoryId,
    deployerLock, changeAddress: source.address, callCoin, funder: signature.unlockP2PKH(),
  };
}

describe('a hop whose implementation entry refuses', () => {
  it('names the entry\'s own message rather than the opcode the implementation frame stopped on', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployedWithCallerCoin(network);
    const before = await recordState(network, funded.proxyCategoryId);

    await expect(callPerCallProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: buildProxyArtifact(impl),
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'add',
      args: [-100n],
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    })).rejects.toThrow(/total negative/);

    // Nothing was broadcast, so the record is where the initialize hop left it.
    expect(await recordState(network, funded.proxyCategoryId)).toBe(before);
  });

  it('names the entry and the failing line for a bare guard', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployedWithCallerCoin(network);

    await expect(callPerCallProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: buildProxyArtifact(impl),
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'put',
      args: [-100n],
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    })).rejects.toThrow(/Impl\.put\(\)[\s\S]*at line \d+/);
  });

  it('carries the values the entry\'s custom error was raised with', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployedWithCallerCoin(network);

    const refused = await callPerCallProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: buildProxyArtifact(impl),
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'take',
      args: [100n],
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    }).then(() => undefined, (error: unknown) => error as { message: string; errorArgs?: readonly unknown[] });

    expect(refused?.message).toMatch(/revert Short\(int256, int256\)/);
    // The initialize hop left `total` at 5, which the entry read and raised beside the amount it was asked for.
    expect(refused?.errorArgs).toStrictEqual([100n, 5n]);
  });
});
