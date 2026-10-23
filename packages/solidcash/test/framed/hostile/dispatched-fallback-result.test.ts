import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { decodeWitnessBlock, encodeWitnessBlockPush, splitFirstPush } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { participant } from '../../../src/framed/composer/index.js';
import { callFramedProxyEntry, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A forwarding fallback that a dispatcher reaches binds the result it records to the one its delegate returned.
 *
 * The proxy here serves an entry of its own beside the fallback, so its master dispatches, and a call naming an
 * implementation entry reaches the fallback for a selector no proxy body has. That fallback records its frame's
 * `retval`, which is what a caller of the proxy reads. Compiled only as the sole-body proxy did, the dispatched
 * fallback left `retval` unchecked: a hop whose proxy frame claimed any result passed the proxy's master. The
 * refusal is the machine's on the proxy master's input, beside the honest hop it mutates.
 */

const FIELDS = '   address public implementation; uint public initialized; int public total;';
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ` contract Impl {${FIELDS}`
  + '   function initialize(address expected) {'
  + '     require(msg.sender == expected); require(this.initialized == 0); this.initialized = 1; this.total = 5;'
  + '   }'
  + '   function bump(int by) returns (int) { this.total = this.total + by; require(this.total >= 0); return by * 3; }'
  + ' }'
  + ` contract ImplProxy {${FIELDS}`
  + '   function touch(int by) { this.total = this.total + by; require(this.total >= 0); }'
  + '   fallback(bytes input) external returns (bytes) { (bool ok, bytes returned) = '
  + 'this.implementation.delegatecall(input); require(ok); return returned; }'
  + ' }';

describe('a dispatched forwarding fallback\'s recorded result', () => {
  it('is refused when it is not the result its delegate returned', async () => {
    const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const source = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
    const funder = source.unlock.spend(alicePub, signature);
    const caller = signature.unlockP2PKH();
    const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);
    const implFunding = { txid: '81'.repeat(32), vout: 0, satoshis: 500_000n };
    const proxyFunding = { txid: '82'.repeat(32), vout: 0, satoshis: 500_000n };
    const hopCoin = { txid: '83'.repeat(32), vout: 0, satoshis: 300_000n };
    const callCoin = { txid: '84'.repeat(32), vout: 0, satoshis: 300_000n };
    for (const coin of [implFunding, proxyFunding]) await network.addUtxo(source.address, coin);
    for (const coin of [hopCoin, callCoin]) await network.addUtxo(binToHex(deployerLock), coin);
    await fundShippedFacets(network);
    const deployment = await deployFramedProxy({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyArtifact: artifacts.ImplProxy!,
      implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress: source.address },
      proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress: source.address },
      initialize: { functionName: 'initialize', args: [deployerLock] },
      callerLockingBytecode: deployerLock,
      callerFunding: { utxo: hopCoin, funder: caller, changeAddress: source.address },
      vm: compositionMachine(),
    });
    expect(deployment.initialize.broadcast).toBeDefined();

    const call = await callFramedProxyEntry({
      provider: network, implementationArtifact: artifacts.Impl!, proxyArtifact: artifacts.ImplProxy!,
      proxyCategoryId: deployment.proxy.categoryId, implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'bump', args: [4n], callerUtxo: callCoin, callerLockingBytecode: deployerLock, funder: caller,
      changeAddress: source.address, vm: compositionMachine(),
    });
    expect(call.completed.map((frame) => frame.functionName)).toStrictEqual(['Impl.bump()', 'ImplProxy.__fallback()']);
    expect(call.values).toStrictEqual([12n]);

    const { transaction, sourceOutputs } = call;
    const proxyMaster = participant(call.draft.layout, 'proxy-master').index;
    const vm = compositionMachine();
    const accepts = (retval: Uint8Array | undefined): boolean => {
      const original = transaction.inputs[proxyMaster]!.unlockingBytecode;
      const { payload, rest } = splitFirstPush(original);
      const unlockingBytecode = retval === undefined ? original
        : Uint8Array.from([...encodeWitnessBlockPush({ ...decodeWitnessBlock(payload), retval }), ...rest]);
      const inputs = transaction.inputs.map((input, index) => (index === proxyMaster
        ? { ...input, unlockingBytecode } : input));
      return vm.stateSuccess(vm.evaluate({
        inputIndex: proxyMaster, sourceOutputs: [...sourceOutputs], transaction: { ...transaction, inputs },
      })) === true;
    };
    expect(accepts(undefined)).toBe(true);
    expect(accepts(Uint8Array.from([0x01, 0x07]))).toBe(false);
  });
});
