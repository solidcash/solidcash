import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { bytesToHex } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { readPerCallState } from '../../../src/per-call/deploy/index.js';
import { participant } from '../../../src/per-call/composer/index.js';
import { deployPerCallProxy, proxyRecordParticipantId } from '../../../src/per-call/proxy/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * A proxied initialize that is broadcast, not only derived.
 *
 * The derived hop is the specification — the same unlocking bytecodes, the same participant outputs, the record at
 * the commitment the entry computed — but it is laid out on synthetic outpoints. When the caller offers its own
 * coin, `deployPerCallProxy` rebuilds the hop on the outpoints the two geneses actually created (the masters, the
 * validator, the record and the caller's coin), signs the caller's input over the real transaction, and broadcasts
 * it. These tests drive that on the mock network and read the entry's state back through the shipped decoder.
 */

const IMPL_CATEGORY = '11'.repeat(32);
const PROXY_CATEGORY = '22'.repeat(32);
const CALLER_TXID = '33'.repeat(32);

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
  readonly deployment: Awaited<ReturnType<typeof deployPerCallProxy>>;
}

let broadcastRun: Promise<Broadcast> | undefined;

/** The broadcast deployment the first two cases read; neither changes it, so it runs once. */
function broadcast(): Promise<Broadcast> {
  broadcastRun ??= (async (): Promise<Broadcast> => {
    const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const { funder, signature, implFunding, proxyFunding, callerUtxo, deployerLock, changeAddress }
      = await funded(network);
    const deployment = await deployPerCallProxy({
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

describe('a broadcast per-call proxy initialization', () => {
  it('broadcasts all three transactions, placing the derived hop on the geneses\' real outpoints', async () => {
    const { network, deployment } = await broadcast();

    // Three broadcast transactions: both geneses through the shipped deployment, the hop through the caller's coin.
    // The provider knows all three, so each is genuinely on the mock chain and not merely returned.
    expect(deployment.initialize.broadcast).toBeDefined();
    const hop = deployment.initialize.broadcast!;
    expect(hop.txid).toMatch(/^[0-9a-f]{64}$/);
    const txids = new Set([deployment.implementation.tx.txid, deployment.proxy.tx.txid, hop.txid]);
    expect(txids.size).toBe(3);
    for (const txid of txids) expect(await network.getRawTransaction(txid)).toMatch(/^[0-9a-f]+$/);

    // Every convention participant, then the caller's own input, recreate in place, then the caller's change.
    expect(hop.inputs.length).toBe(5);
    expect(hop.outputs.length).toBe(5);
    // The hop places each participant on the outpoint its genesis actually created: the proxy's master, validator
    // and record come from the proxy's genesis, the implementation's master from the implementation's, and the
    // caller's own coin from the coin it funded.
    const at = (index: number): string => binToHex(hop.inputs[index]!.outpointTransactionHash);
    expect([at(0), at(1), at(2)]).toStrictEqual(
      [deployment.proxy.tx.txid, deployment.proxy.tx.txid, deployment.proxy.tx.txid]);
    expect(at(3)).toBe(deployment.implementation.tx.txid);
    expect(at(4)).toBe(CALLER_TXID);

    // The machine still accepts the hop the deployment settled, on its real shape.
    expect(deployment.initialize.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(deployment.initialize.accepted).toBe(true);
  });

  it('carries the entry\'s written state in the broadcast outputs and reads it back through the decoder', async () => {
    const { artifacts, network, deployment } = await broadcast();
    const hop = deployment.initialize.broadcast!;

    // The record the hop writes is the commitment the entry itself computed.
    const recordIndex = participant(deployment.initialize.draft.layout, proxyRecordParticipantId(0)).index;
    expect(bytesToHex(hop.outputs[recordIndex]!.token!.nft!.commitment))
      .toBe(bytesToHex(deployment.initialize.writtenRecordCommitment));

    // The entry wrote `initialized = 1`, `version = 7`, with the implementation's address still in the record; the
    // shipped decoder reads that record back off the chain the hop was broadcast to.
    const state = await readPerCallState(network, deployment.proxy.categoryId, artifacts.Proxy!.stateLayout!);
    expect(state.byNft.length).toBe(1);
    expect(state.byNft[0]!.initialized).toBe(1n);
    expect(state.byNft[0]!.version).toBe(7n);
    expect([...state.byNft[0]!.implementation as Uint8Array]).toStrictEqual([...deployment.implementation.address]);
    expect(bytesToHex(new Uint8Array(Buffer.from(state.records[0]!.token!.nft!.commitment, 'hex'))))
      .toBe(bytesToHex(deployment.initialize.writtenRecordCommitment));
  });

  it('leaves the hop derived when the caller offers no coin', async () => {
    const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const { funder, implFunding, proxyFunding, deployerLock, changeAddress } = await funded(network);

    const deployment = await deployPerCallProxy({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyArtifact: artifacts.Proxy!,
      implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress },
      proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress },
      initialize: { functionName: 'initialize', args: [deployerLock] },
      callerLockingBytecode: deployerLock,
      vm: compositionMachine(),
    });

    // The derived specification is still returned; nothing was broadcast for it.
    expect(deployment.initialize.broadcast).toBeUndefined();
    expect(deployment.initialize.transaction.inputs.length).toBe(5);
    expect(deployment.initialize.accepted).toBe(true);
    // The record still sits at the state the proxy's genesis minted, because the derived hop never ran on chain.
    const state = await readPerCallState(network, deployment.proxy.categoryId, artifacts.Proxy!.stateLayout!);
    expect(state.byNft[0]!.initialized).toBe(0n);
    expect(state.byNft[0]!.version).toBe(0n);
  });
});
