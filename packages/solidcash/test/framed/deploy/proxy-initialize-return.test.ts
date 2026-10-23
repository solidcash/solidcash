import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { buildPushdataCommitment, bytesToHex, type StateLayout } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import {
  buildProxyArtifact, deployFramedProxy, type FramedProxyCallerFunding,
} from '../../../src/framed/proxy/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * An `initialize` hop whose entry returns a value.
 *
 * The deployment hop is the same hop a later call takes, so a returning entry is carried the way a direct call
 * carries one: the implementation frame's `retval` is learned from the body's own close and the deployment reports
 * the decoded value. The value travels in the caller's call record, so the proxy's forwarded call has to record the
 * delegated call's result, which the generated closure shape does. A proxy whose fallback drops it is refused by
 * name in the same hop a later call takes (`call/proxy-call.test.ts`).
 */

const IMPL_CATEGORY = '55'.repeat(31) + 'aa';
const PROXY_CATEGORY = '66'.repeat(31) + '99';

const IMPL_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   uint public initialized;'
  + '   int public total;'
  + '   function initialize(int seed) returns (int) {'
  + '     this.total = this.total + seed;'
  + '     require(this.total >= 0);'
  + '     return seed * 3;'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(IMPL_SOURCE, { composition: 'framed' });
const impl = artifacts.Impl!;

/** The commitment the shipped encoder materializes from one state of a layout. */
function commitment(layout: StateLayout, state: Record<string, bigint | Uint8Array>): Uint8Array {
  return new Uint8Array(Buffer.from(buildPushdataCommitment(layout, state, 0), 'hex'));
}

/** A funded network and the deploy options both geneses need, so a test only chooses the proxy shape. */
async function deploymentHalf(network: MockNetworkProvider): Promise<{
  readonly implementationDeploy: { fundingUtxo: { txid: string; vout: number; satoshis: bigint };
    funder: ReturnType<Contract['unlock']['spend']>; changeAddress: string };
  readonly proxyDeploy: { fundingUtxo: { txid: string; vout: number; satoshis: bigint };
    funder: ReturnType<Contract['unlock']['spend']>; changeAddress: string };
  readonly callerLockingBytecode: Uint8Array;
  readonly callerFunding: FramedProxyCallerFunding;
}> {
  const signature = new SignatureTemplate(alicePriv);
  const source = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = source.unlock.spend(alicePub, signature);
  const implementationDeploy = {
    fundingUtxo: { txid: IMPL_CATEGORY, vout: 0, satoshis: 500_000n }, funder, changeAddress: source.address,
  };
  const proxyDeploy = {
    fundingUtxo: { txid: PROXY_CATEGORY, vout: 0, satoshis: 500_000n }, funder, changeAddress: source.address,
  };
  for (const coin of [implementationDeploy.fundingUtxo, proxyDeploy.fundingUtxo]) {
    await network.addUtxo(source.address, coin);
  }
  // The initialize hop is entered with the deployer's own coin, at its own P2PKH lock.
  const callerLockingBytecode = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: '77'.repeat(31) + 'bb', vout: 0, satoshis: 100_000n };
  await network.addUtxo(binToHex(callerLockingBytecode), callerUtxo);
  return {
    implementationDeploy, proxyDeploy, callerLockingBytecode,
    callerFunding: { utxo: callerUtxo, funder: signature.unlockP2PKH() },
  };
}

describe('an initialize hop whose entry returns a value', () => {
  it('carries the value through the generated closure shape, which consumes the delegated result', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const half = await deploymentHalf(network);

    const deployment = await deployFramedProxy({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: buildProxyArtifact(impl),
      implementationDeploy: half.implementationDeploy,
      proxyDeploy: half.proxyDeploy,
      initialize: { functionName: 'initialize', args: [4n] },
      callerLockingBytecode: half.callerLockingBytecode,
      callerFunding: half.callerFunding,
      vm: compositionMachine(),
    });

    expect(deployment.initialize.accepted).toBe(true);
    expect(deployment.initialize.values).toStrictEqual([12n]);
    expect(deployment.initialize.value).toBe(12n);
    expect(deployment.initialize.retval.length).toBeGreaterThan(0);

    // The hop's derived transaction carries the write the entry computed, which is not the value it returned.
    expect(bytesToHex(deployment.initialize.writtenRecordCommitments[0]!))
      .toBe(bytesToHex(commitment(impl.stateLayout!, {
        implementation: deployment.implementation.address, initialized: 0n, total: 4n,
      })));
  });
});
