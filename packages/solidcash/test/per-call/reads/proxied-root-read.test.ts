import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { buildPushdataCommitment, bytesEqual, bytesToHex, type StateLayout } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { readPerCallDeployment } from '../../../src/per-call/deploy/index.js';
import { deployPerCallProxy } from '../../../src/per-call/proxy/index.js';
import { PerCallFunctionCall } from '../../../src/per-call/call/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * A read-only call through a proxy handle.
 *
 * The implementation's view runs as the proxy's delegate frame, so its record is the proxy's: the read has to
 * classify the proxy's category, not the implementation's own, and the implementation's artifact is the code the
 * frame runs. The frame's `self` is the proxy's address, which is also what fronting the implementation's code
 * with the proxy's category derives.
 */

const IMPL_CATEGORY = '11'.repeat(32);
const PROXY_CATEGORY = '22'.repeat(32);

// A field registered alone in its own data NFT makes the implementation's layout span more than one record, so the
// proxy keeps its address in one of its own past them.
const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   uint public initialized;'
  + '   int public total;'
  + '   int external separate;'
  + '   function initialize(address expected) {'
  + '     require(msg.sender == expected);'
  + '     require(this.initialized == 0);'
  + '     this.initialized = 1;'
  + '     this.total = 5;'
  + '   }'
  + '   function add(int by) { this.total = this.total + by; require(this.total >= 0); }'
  + '   function peek() view returns (int) { return this.total; }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
const impl = artifacts.Impl!;

/** The commitment the shipped encoder materializes for one data NFT of a layout. */
function commitment(layout: StateLayout, values: Record<string, bigint | Uint8Array>, nftIndex: number): Uint8Array {
  return new Uint8Array(Buffer.from(buildPushdataCommitment(layout, values, nftIndex), 'hex'));
}

/** The record commitments the deployed proxy holds, in data-NFT order, through the shipped reader. */
async function proxyRecords(network: MockNetworkProvider, categoryId: string): Promise<string[]> {
  const deployment = await readPerCallDeployment(network, categoryId, impl.stateLayout!);
  return deployment.records.map((record) => record.token!.nft!.commitment);
}

/** Deploys the implementation behind its proxy and runs the initialize hop, so the proxy's record holds state. */
async function deployedWithCallerCoin(network: MockNetworkProvider): Promise<{
  readonly proxyCategoryId: string;
  readonly implementationCategoryId: string;
  readonly proxyAddress: Uint8Array;
}> {
  const signature = new SignatureTemplate(alicePriv);
  const source = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = source.unlock.spend(alicePub, signature);
  const callerFunder = signature.unlockP2PKH();
  const implFunding = { txid: IMPL_CATEGORY, vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: PROXY_CATEGORY, vout: 0, satoshis: 500_000n };
  const hopCoin = { txid: '33'.repeat(32), vout: 0, satoshis: 300_000n };
  for (const coin of [implFunding, proxyFunding]) await network.addUtxo(source.address, coin);
  // The hop's root frame binds `msg.sender` to the lock of the coin it names, so it sits at the deployer's P2PKH.
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);
  await network.addUtxo(binToHex(deployerLock), hopCoin);

  const deployment = await deployPerCallProxy({
    provider: network,
    implementationArtifact: impl,
    implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress: source.address },
    proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress: source.address },
    initialize: { functionName: 'initialize', args: [deployerLock] },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: hopCoin, funder: callerFunder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.broadcast).toBeDefined();
  return {
    proxyCategoryId: deployment.proxy.categoryId,
    implementationCategoryId: deployment.implementation.categoryId,
    proxyAddress: deployment.proxy.address,
  };
}

describe('a read-only call through a proxy handle', () => {
  it('reads the record the proxy holds, as the implementation\'s delegate frame runs on it', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployedWithCallerCoin(network);

    // The proxy's genesis minted the implementation's records under the proxy's category, and the hop wrote the
    // state the view reads. The proxy's own address record sits past them and is not spent.
    expect(await proxyRecords(network, funded.proxyCategoryId)).toStrictEqual([
      bytesToHex(commitment(impl.stateLayout!, { initialized: 1n, total: 5n }, 0)),
      bytesToHex(commitment(impl.stateLayout!, { separate: 0n }, 1)),
    ]);

    const call = new PerCallFunctionCall({
      artifact: impl,
      abiEntry: impl.abi.find((entry) => entry.name === 'peek')!,
      categoryId: funded.proxyCategoryId,
      provider: network,
      proxyImplementationCategoryId: funded.implementationCategoryId,
    }, 'peek', []);

    const result = await call.staticCall();
    // The read's own frame and every record it spends are accepted by the machine, and the view's value is the
    // state the proxy's record holds.
    expect(result.accepted).toBe(true);
    expect(result.value).toBe(5n);
    // The read plans the implementation's records under the proxy's category, one frame for each.
    expect(result.draft.layout.participants.map((placed) => placed.id))
      .toStrictEqual(expect.arrayContaining(['record-0', 'record-1']));
    // The frame runs as the proxy: `self` is the address fronting the implementation's code at the proxy's category.
    expect(bytesEqual(result.draft.blockOf('read').self, funded.proxyAddress)).toBe(true);
  });
});
