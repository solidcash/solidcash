import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { bytesToHex } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { readFramedState } from '../../../src/framed/deploy/index.js';
import { participant } from '../../../src/framed/composer/index.js';
import { deployFramedProxy, proxyRecordParticipantId } from '../../../src/framed/proxy/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A proxied initialize that is minted into the proxy genesis.
 *
 * The derived hop is the specification — the record at the commitment the entry computed. That commitment is what
 * the proxy genesis publishes. There is no third transaction, and the caller's coin stays unspent. A refusal
 * publishes neither genesis. These tests drive that on the mock network and read the entry's state back through
 * the shipped decoder.
 */

const IMPL_CATEGORY = '11'.repeat(31) + 'ee';
const PROXY_CATEGORY = '22'.repeat(31) + 'dd';
const CALLER_TXID = '33'.repeat(31) + 'cc';

const SHARED_STATE = ' address public implementation;'
  + ' uint public initialized;'
  + ' int public version;';

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ` contract Impl {${SHARED_STATE}`
  + '   function initialize(address expected) {'
  + '     require(msg.sender == expected);'
  + '     require(this.initialized == 0);'
  + '     this.initialized = 1;'
  + '     this.version = 7;'
  + '   }'
  + ' }'
  + ` contract Proxy {${SHARED_STATE}`
  + '   fallback(bytes input) external { this.implementation.delegatecall(input); require(true); }'
  + ' }';

/** Funds the two geneses and the caller's own coin, all at the deployer's own addresses. */
async function funded(network: MockNetworkProvider): Promise<{
  readonly funder: ReturnType<Contract['unlock']['spend']>;
  readonly signature: SignatureTemplate;
  readonly implFunding: { txid: string; vout: number; satoshis: bigint };
  readonly proxyFunding: { txid: string; vout: number; satoshis: bigint };
  readonly callerUtxo: { txid: string; vout: number; satoshis: bigint };
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
}> {
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const implFunding = { txid: IMPL_CATEGORY, vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: PROXY_CATEGORY, vout: 0, satoshis: 500_000n };
  // The caller's coin sits at the deployer's own P2PKH lock: a root frame binds `msg.sender` to the lock of the
  // input its caller reference names, so the funding must be at exactly that lock.
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: CALLER_TXID, vout: 0, satoshis: 100_000n };
  await network.addUtxo(funder.address, implFunding);
  await network.addUtxo(funder.address, proxyFunding);
  // The hop broadcasts, so each composition's facet input needs a live UTXO at the facet's lock.
  await fundShippedFacets(network);
  await network.addUtxo(binToHex(deployerLock), callerUtxo);
  return {
    funder: funder.unlock.spend(alicePub, signature),
    signature,
    implFunding,
    proxyFunding,
    callerUtxo,
    deployerLock,
    changeAddress: funder.address,
  };
}

interface Broadcast {
  readonly artifacts: ReturnType<typeof compileStringMulti>;
  readonly network: MockNetworkProvider;
  readonly deployment: Awaited<ReturnType<typeof deployFramedProxy>>;
}

let broadcastRun: Promise<Broadcast> | undefined;

/** The broadcast deployment both cases read; neither changes it, so it runs once. */
function broadcast(): Promise<Broadcast> {
  broadcastRun ??= (async (): Promise<Broadcast> => {
    const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const { funder, signature, implFunding, proxyFunding, callerUtxo, deployerLock, changeAddress }
      = await funded(network);
    const deployment = await deployFramedProxy({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyArtifact: artifacts.Proxy!,
      implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress },
      proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress },
      initialize: { functionName: 'initialize', args: [deployerLock] },
      callerLockingBytecode: deployerLock,
      callerFunding: { utxo: callerUtxo, funder: signature.unlockP2PKH() },
      vm: compositionMachine(),
    });
    return { artifacts, network, deployment };
  })();
  return broadcastRun;
}

describe('a broadcast framed proxy initialization', () => {
  it('mints initialize into the proxy genesis and leaves the caller coin unspent', async () => {
    const { network, deployment } = await broadcast();

    // Two broadcast transactions. The proxy genesis is the initialize, so there is no third hop, and the provider
    // knows both geneses.
    expect(deployment.initialize.accepted).toBe(true);
    expect(deployment.initialize.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(deployment.initialize.broadcast).toBeDefined();
    expect(deployment.initialize.broadcast!.txid).toBe(deployment.proxy.tx.txid);
    expect(deployment.implementation.tx.txid).not.toBe(deployment.proxy.tx.txid);
    expect(await network.getRawTransaction(deployment.implementation.tx.txid)).toMatch(/^[0-9a-f]+$/);
    expect(await network.getRawTransaction(deployment.proxy.tx.txid)).toMatch(/^[0-9a-f]+$/);

    const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
    const callerCoins = await network.getUtxosForLockingBytecode(callerLock);
    expect(callerCoins.some((utxo) => utxo.txid === CALLER_TXID && utxo.vout === 0)).toBe(true);

    const minted = (deployment.proxy.tx.outputs ?? []).some((output) => (
      output.token?.nft?.commitment !== undefined
      && bytesToHex(output.token.nft.commitment) === bytesToHex(deployment.initialize.writtenRecordCommitment)
    ));
    expect(minted).toBe(true);
  });

  it('carries the entry\'s written state in the proxy genesis and reads it back through the decoder', async () => {
    const { artifacts, network, deployment } = await broadcast();

    // The record the hop writes is the commitment the entry itself computed, and the genesis mints those bytes.
    const recordIndex = participant(deployment.initialize.draft.layout, proxyRecordParticipantId(0)).index;
    expect(bytesToHex(deployment.initialize.transaction.outputs[recordIndex]!.token!.nft!.commitment))
      .toBe(bytesToHex(deployment.initialize.writtenRecordCommitment));

    // The entry wrote `initialized = 1`, `version = 7`, with the implementation's address still in the record; the
    // shipped decoder reads that record back off the chain the hop was broadcast to.
    const state = await readFramedState(network, deployment.proxy.categoryId, artifacts.Proxy!.stateLayout!);
    expect(state.byNft.length).toBe(1);
    expect(state.byNft[0]!.initialized).toBe(1n);
    expect(state.byNft[0]!.version).toBe(7n);
    expect([...state.byNft[0]!.implementation as Uint8Array]).toStrictEqual([...deployment.implementation.address]);
    expect(bytesToHex(new Uint8Array(Buffer.from(state.records[0]!.token!.nft!.commitment, 'hex'))))
      .toBe(bytesToHex(deployment.initialize.writtenRecordCommitment));
  });
});
