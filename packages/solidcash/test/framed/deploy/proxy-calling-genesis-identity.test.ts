import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { validatorAddress } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { authheadLockingBytecode } from '../../../src/bcmr/authhead.js';
import { resolveIdentity } from '../../../src/bcmr/identity.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readFramedState } from '../../../src/framed/deploy/index.js';
import { deployFramedProxy } from '../../../src/framed/proxy/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A proxy whose `initialize` calls another contract is minted in one composition that also runs the callee's frame
 * (D47). The proxy's funding coin leads it at input 0 and its index recreates as the proxy's authhead, so output 0
 * is the proxy's own identity and every participant sits one index later.
 */

const WRITER_CATEGORY = 'a4'.repeat(31) + '5b';
const IMPL_CATEGORY = 'a1'.repeat(32);
const PROXY_CATEGORY = 'a2'.repeat(32);
const WRITER = validatorAddress(hexToBin(WRITER_CATEGORY), VALIDATOR_PROGRAM);
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IWriter { function bump(); }'
  + ' contract Writer { int public count; function bump() { this.count = this.count + 1; require(this.count > 0); } }'
  + ' contract Calling {'
  + '   address public implementation; uint public initialized;'
  + `   function initialize() { IWriter(0x${binToHex(WRITER)}).bump(); }`
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });

describe('the calling genesis of a framed proxy', () => {
  it('leads with the proxy\'s funding coin and mints the proxy\'s authhead at output 0', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    await fundShippedFacets(network);
    const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
    const funder = wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv));
    // The proxy's deployer is the wallet that funds its genesis, so the identity's owner is the wallet's lock.
    const ownerLock = funder.generateLockingBytecode();
    const writerFunding = { txid: WRITER_CATEGORY, vout: 0, satoshis: 500_000n };
    const implFunding = { txid: IMPL_CATEGORY, vout: 0, satoshis: 500_000n };
    const proxyFunding = { txid: PROXY_CATEGORY, vout: 0, satoshis: 500_000n };
    for (const coin of [writerFunding, implFunding, proxyFunding]) await network.addUtxo(wallet.address, coin);
    const writer = await deployStatefulContract(artifacts.Writer!, [], {
      fundingUtxo: writerFunding, funder, changeAddress: wallet.address, provider: network,
    });

    const deployment = await deployFramedProxy({
      provider: network,
      implementationArtifact: artifacts.Calling!,
      implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress: wallet.address },
      proxyDeploy: {
        fundingUtxo: proxyFunding, funder, changeAddress: wallet.address,
        bcmr: { name: 'Calling', timestamp: '2026-10-21T12:00:00.000Z' },
      },
      initialize: { functionName: 'initialize' },
      callerLockingBytecode: encodeLockingBytecodeP2pkh(alicePkh),
      externals: { IWriter: { artifact: artifacts.Writer!, categoryId: WRITER_CATEGORY } },
      vm: compositionMachine(),
    });
    const { tx } = deployment.proxy;
    // The proxy's genesis is the composition that ran the callee's frame.
    expect(deployment.initialize.broadcast.txid).toBe(tx.txid);
    const state = await readFramedState(network, WRITER_CATEGORY, artifacts.Writer!.stateLayout!);
    expect(state.byNft[0]!.count).toBe(1n);

    // Input 0 spends the proxy's funding coin, whose txid is the proxy's category.
    expect(binToHex(tx.inputs[0]!.outpointTransactionHash)).toBe(PROXY_CATEGORY);
    expect(tx.inputs[0]!.outpointIndex).toBe(0);
    // Output 0 is the proxy's authhead: a mutable NFT of the proxy's category whose commitment is the owner's lock.
    const authhead = tx.outputs[0]!;
    expect(binToHex(authhead.lockingBytecode)).toBe(binToHex(authheadLockingBytecode(PROXY_CATEGORY)));
    expect(binToHex(authhead.token!.category)).toBe(PROXY_CATEGORY);
    expect(authhead.token!.amount).toBe(0n);
    expect(authhead.token!.nft?.capability).toBe('mutable');
    expect(binToHex(authhead.token!.nft!.commitment)).toBe(binToHex(ownerLock));
    // The callee's validator, which the composition runs under, moved one index later and is recreated there.
    expect(binToHex(tx.inputs[1]!.outpointTransactionHash)).toBe(writer.tx.txid);
    expect(binToHex(tx.outputs[1]!.lockingBytecode)).toBe(binToHex(WRITER));
    expect(binToHex(tx.outputs[1]!.token!.category)).toBe(WRITER_CATEGORY);
    expect(tx.outputs[1]!.token!.nft?.capability).toBe('mutable');

    // The deployment returns the identity record, and the network resolves the same identity.
    const identity = deployment.proxy.identity!;
    expect(identity.txid).toBe(tx.txid);
    expect(identity.vout).toBe(0);
    expect(identity.category).toBe(PROXY_CATEGORY);
    expect(identity.status).toBe('active');
    expect(identity.satoshis).toBe(authhead.valueSatoshis);
    expect(binToHex(identity.lockingBytecode)).toBe(binToHex(authheadLockingBytecode(PROXY_CATEGORY)));
    expect(binToHex(identity.owner)).toBe(binToHex(ownerLock));
    expect((await resolveIdentity(network, PROXY_CATEGORY))?.txid).toBe(tx.txid);

    // The genesis carries the registry's publication, after the composition's settled outputs.
    const registry = deployment.proxy.registry!;
    const publication = tx.outputs.find((output) => binToHex(output.lockingBytecode).startsWith('6a0442434d52'));
    expect(binToHex(publication!.lockingBytecode)).toContain(binToHex(registry.sha256));
    expect(registry.registry.identities![PROXY_CATEGORY]).toBeDefined();
  }, 600_000);
});
