import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { FrameKind, buildPushdataCommitment, bytesEqual, bytesToHex } from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import {
  DEFAULT_MASTER_POOL_SIZE, deployMaster, readFramedDeployment, readFramedState, stateRecordLockingBytecode,
} from '../../../src/framed/deploy/index.js';
import { deployFramedProxy, proxyRecordParticipantId } from '../../../src/framed/proxy/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM } from '../shapes/harness.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A proxy deployment on the framed path: two genesis transactions, the proxy's minted as its initialize left it.
 *
 * The implementation is a real contract with an `initialize` entry; the proxy is the one shape the convention
 * compiles for a forwarder — a single `address implementation` field and a fallback that delegatecalls it with the
 * call data it received. Both genesis transactions go through the shipped deployment entry point, which selects the
 * framed genesis from the artifact; the initialize hop is derived through the shipped composer and derivation, and
 * the machine is asked about every participant of the composition. The hop is never broadcast: the proxy's genesis
 * mints the records it left.
 *
 * The tests also pin where a framed deployment mints its records: each sits at the data-NFT covenant its category
 * derives, and the machine accepts the record's own spend under that covenant beside the masters and the validator
 * pool the deployment funds.
 */

// The proxy's records are the implementation's records, so both declare the same fields: the implementation's
// write rebuilds the record from its own declaration, and a field only one of them knew would not survive it.
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Impl {'
  + '   address implementation;'
  + '   int public version;'
  + '   function initialize(address expected) { require(msg.sender == expected); }'
  + ' }'
  + ' contract Proxy {'
  + '   address implementation;'
  + '   int public version;'
  + '   fallback(bytes input) external { this.implementation.delegatecall(input); require(true); }'
  + ' }';

const ENTRY = 'initialize';

// A framed genesis leads with its authhead, then mints the resolved pool - masters, then validators -
// followed by the facet pool, the contract's own record, and change. These indices read the default pool the
// deployment funds.
const POOL = DEFAULT_MASTER_POOL_SIZE;
const FIRST_MASTER = 1;
const FACET_OUTPUTS = 1;
const RECORD_OUTPUT = FIRST_MASTER + POOL.masters + POOL.validators + FACET_OUTPUTS;
const GENESIS_OUTPUTS = RECORD_OUTPUT + 2;

/** The deployed proxy and implementation, driven through the shipped module. */
async function deployFresh(): Promise<{
  readonly provider: MockNetworkProvider;
  readonly artifacts: ReturnType<typeof compileStringMulti>;
  readonly deployment: Awaited<ReturnType<typeof deployFramedProxy>>;
  readonly implCategory: string;
  readonly proxyCategory: string;
}> {
  const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const funding = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const implFunding = { txid: '11'.repeat(31) + 'ee', vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: '22'.repeat(31) + 'dd', vout: 0, satoshis: 500_000n };
  await provider.addUtxo(funding.address, implFunding);
  await provider.addUtxo(funding.address, proxyFunding);
  // Each composition's facet input needs a live UTXO at the facet's lock.
  await fundShippedFacets(provider);
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);

  const deployment = await deployFramedProxy({
    provider,
    implementationArtifact: artifacts.Impl!,
    proxyArtifact: artifacts.Proxy!,
    implementationDeploy: {
      fundingUtxo: implFunding, funder: funding.unlock.spend(alicePub, signature), changeAddress: funding.address,
    },
    proxyDeploy: {
      fundingUtxo: proxyFunding, funder: funding.unlock.spend(alicePub, signature), changeAddress: funding.address,
    },
    initialize: { functionName: ENTRY, args: [deployerLock] },
    callerLockingBytecode: deployerLock,
    vm: compositionMachine(),
  });
  return { provider, artifacts, deployment, implCategory: implFunding.txid, proxyCategory: proxyFunding.txid };
}

let deployed: ReturnType<typeof deployFresh> | undefined;

/** One deployment serves every case: each reads it and none changes it. */
function deploy(): ReturnType<typeof deployFresh> {
  deployed ??= deployFresh();
  return deployed;
}

describe('a framed proxy deployment', () => {
  it('deploys the implementation first: its master, its validator and its own record', async () => {
    const { artifacts, deployment, implCategory } = await deploy();
    const layout = artifacts.Impl!.stateLayout!;
    const master = deployMaster(artifacts.Impl!, new Uint8Array(Buffer.from(implCategory, 'hex')), VALIDATOR_PROGRAM);

    expect(deployment.implementation.categoryId).toBe(implCategory);
    expect([...deployment.implementation.address]).toStrictEqual([...master.address]);
    expect(deployment.implementation.tx.inputs.length).toBe(1);
    // The authhead, the default pool's masters (minting), its validators (mutable, empty), the facet pool, the
    // initial-state record, then change.
    expect(deployment.implementation.tx.outputs.length).toBe(GENESIS_OUTPUTS);
    expect(deployment.implementation.tx.outputs[0]!.token?.nft?.capability).toBe('mutable');
    const masterOut = deployment.implementation.tx.outputs[FIRST_MASTER]!;
    const validatorOut = deployment.implementation.tx.outputs[FIRST_MASTER + POOL.masters]!;
    const facetOut = deployment.implementation.tx.outputs[RECORD_OUTPUT - 1]!;
    const recordOut = deployment.implementation.tx.outputs[RECORD_OUTPUT]!;
    expect(facetOut!.token).toBeUndefined();
    expect([...masterOut!.lockingBytecode]).toStrictEqual([...master.lockingBytecode]);
    expect(masterOut!.token!.nft!.capability).toBe('minting');
    expect([...validatorOut!.lockingBytecode]).toStrictEqual([...master.address]);
    expect(validatorOut!.token!.nft!.capability).toBe('mutable');
    expect(validatorOut!.token!.nft!.commitment.length).toBe(0);
    expect(recordOut!.token!.nft!.capability).toBe('mutable');
    expect(bytesToHex(recordOut!.token!.nft!.commitment)).toBe(buildPushdataCommitment(layout, { version: 0n }, 0));
  });

  it('deploys the proxy second with a record carrying the implementation\'s address', async () => {
    const { artifacts, deployment, proxyCategory, implCategory } = await deploy();
    const implMaster = deployMaster(
      artifacts.Impl!, new Uint8Array(Buffer.from(implCategory, 'hex')), VALIDATOR_PROGRAM,
    );
    const proxyLayout = artifacts.Proxy!.stateLayout!;

    expect(deployment.proxy.categoryId).toBe(proxyCategory);
    // The proxy's genesis is what put the initialized state on chain; no hop follows it.
    expect(deployment.initialize.broadcast.txid).toBe(deployment.proxy.tx.txid);
    expect(deployment.proxy.tx.outputs.length).toBe(GENESIS_OUTPUTS);
    const recordOut = deployment.proxy.tx.outputs[RECORD_OUTPUT]!;
    expect(recordOut.token!.nft!.capability).toBe('mutable');
    // The record the shipped encoder materializes from the implementation's address.
    expect(bytesToHex(recordOut.token!.nft!.commitment)).toBe(
      buildPushdataCommitment(proxyLayout, { implementation: implMaster.address }, 0),
    );
  });

  it('mints the records at the data-NFT covenant, which the category derives', async () => {
    const { artifacts, deployment, provider, proxyCategory } = await deploy();
    // The record sits at the data-NFT covenant the category derives, not at the contract's address or the
    // deployer's wallet lock.
    const recordOut = deployment.proxy.tx.outputs[RECORD_OUTPUT]!;
    expect([...recordOut.lockingBytecode]).toStrictEqual([...stateRecordLockingBytecode(proxyCategory)]);
    // The covenant pins the record's own category and capability, so it is findable by address and by category.
    const discovery = await readFramedDeployment(provider, proxyCategory, artifacts.Proxy!.stateLayout!);
    expect(discovery.records.length).toBe(1);
    expect(discovery.records[0]!.token!.nft!.commitment).toBe(bytesToHex(recordOut.token!.nft!.commitment));
    expect(discovery.masters.length).toBe(POOL.masters);
    expect(discovery.validators.length).toBe(POOL.validators);
  });

  it('reads the implementation\'s address back through the shipped decoder', async () => {
    const { provider, artifacts, proxyCategory, implCategory } = await deploy();
    const implMaster = deployMaster(
      artifacts.Impl!, new Uint8Array(Buffer.from(implCategory, 'hex')), VALIDATOR_PROGRAM,
    );

    const state = await readFramedState(provider, proxyCategory, artifacts.Proxy!.stateLayout!);

    expect(state.byNft.length).toBe(1);
    expect([...state.byNft[0]!.implementation as Uint8Array]).toStrictEqual([...implMaster.address]);
  });

  it('derives the initialize hop: the implementation frame completes, then the proxy that forwarded to it', async () => {
    const { deployment } = await deploy();

    expect(deployment.initialize.completed.map((frame) => frame.functionName))
      .toStrictEqual([`Impl.${ENTRY}()`, 'Proxy.__fallback()']);
  });

  it('accepts the proxy master, the validator and the implementation master', async () => {
    const { deployment } = await deploy();
    const verdicts = new Map(deployment.initialize.verdicts.map((verdict) => [verdict.id, verdict]));

    for (const id of ['proxy-master', 'validator', 'implementation-master']) {
      const verdict = verdicts.get(id);
      expect(verdict?.accepted, `${id}: ${verdict?.objection ?? 'not placed'}`).toBe(true);
    }
    expect(deployment.initialize.accepted).toBe(true);
  });

  it('binds the delegate edge to the address the proxy\'s record holds', async () => {
    const { deployment, artifacts, implCategory } = await deploy();
    const implMaster = deployMaster(
      artifacts.Impl!, new Uint8Array(Buffer.from(implCategory, 'hex')), VALIDATOR_PROGRAM,
    );
    const { draft } = deployment.initialize;
    const call = draft.blockOf('proxy-master').calls[0]!;

    expect(call.kind).toBe(FrameKind.DELEGATE);
    expect([...call.target]).toStrictEqual([...implMaster.address]);
    expect(call.calleeRef).toBe(
      draft.layout.participants.find((placed) => placed.id === 'implementation-master')!.index,
    );
    // The implementation runs as a delegate frame: the proxy's sender and address(this) are its own.
    const proxyFrame = draft.blockOf('proxy-master');
    const implFrame = draft.blockOf('implementation-master');
    expect(implFrame.kind).toBe(FrameKind.DELEGATE);
    expect(bytesEqual(implFrame.sender, proxyFrame.sender)).toBe(true);
    expect(bytesEqual(implFrame.self, proxyFrame.self)).toBe(true);
  });

  it('lays the initialize transaction out: the proxy, its record, the implementation, then the deployer', async () => {
    const { deployment } = await deploy();
    const { transaction, sourceOutputs, draft } = deployment.initialize;
    const at = (id: string): number => draft.layout.participants.find((placed) => placed.id === id)!.index;
    const [proxyIndex, validatorIndex, recordIndex, implementationIndex]
      = [at('proxy-master'), at('validator'), at(proxyRecordParticipantId(0)), at('implementation-master')];

    // Every participant recreates at the index it was spent at, and the deployer's signed input follows them.
    expect(transaction.inputs.length).toBe(6);
    expect(transaction.outputs.length).toBe(6);
    // The token each input spends: the proxy's minting NFT, its validator and record as mutable NFTs, the
    // implementation's minting NFT, and the deployer's plain funding.
    expect(sourceOutputs[proxyIndex]!.token!.nft!.capability).toBe('minting');
    expect(sourceOutputs[validatorIndex]!.token!.nft!.capability).toBe('mutable');
    expect(sourceOutputs[recordIndex]!.token!.nft!.capability).toBe('mutable');
    expect(sourceOutputs[implementationIndex]!.token!.nft!.capability).toBe('minting');
    expect(sourceOutputs[draft.layout.participantCount]!.token).toBeUndefined();
    // And the outputs recreate the same tokens; only the record carries state, and it is kept unchanged.
    expect(transaction.outputs[proxyIndex]!.token!.nft!.capability).toBe('minting');
    expect(transaction.outputs[validatorIndex]!.token!.nft!.commitment.length).toBe(0);
    expect(bytesToHex(transaction.outputs[recordIndex]!.token!.nft!.commitment))
      .toBe(bytesToHex(sourceOutputs[recordIndex]!.token!.nft!.commitment));
  });

  it('spends the record under its covenant lock, accepted by the machine', async () => {
    const { deployment } = await deploy();
    const record = deployment.initialize.verdicts.find((verdict) => verdict.id === proxyRecordParticipantId(0))!;

    // The record is spent with the data-NFT covenant's own unlocking, so the machine evaluates its script and
    // accepts the read-only spend. Every convention input is accepted, the record among them.
    expect(record.accepted, record.objection ?? 'not placed').toBe(true);
    expect(deployment.initialize.verdicts.every((verdict) => verdict.accepted)).toBe(true);
    expect(deployment.initialize.accepted).toBe(true);
  });

  it('settles the delegate call against the transaction\'s own record output', async () => {
    const { deployment } = await deploy();
    const { transaction, draft } = deployment.initialize;
    const recordIndex = draft.layout.participants.find((placed) => placed.id === proxyRecordParticipantId(0))!.index;

    // One input and one output per participant, then the deployer's own input and change.
    expect(transaction.inputs.length).toBe(6);
    expect(transaction.outputs.length).toBe(6);
    // The record is kept: the output carries exactly the commitment the proxy's genesis minted.
    const proxyRecord = deployment.proxy.tx.outputs[RECORD_OUTPUT]!;
    expect(bytesToHex(transaction.outputs[recordIndex]!.token!.nft!.commitment))
      .toBe(bytesToHex(proxyRecord.token!.nft!.commitment));
  });
});
