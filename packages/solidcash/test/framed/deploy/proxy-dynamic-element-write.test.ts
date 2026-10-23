import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import {
  bytesToHex, parsePushdataCommitment, validatorAddress, type Artifact,
} from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry } from '../../../src/framed/proxy/deploy.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A proxied entry that rewrites an element of a chunked dynamic array and then calls another contract.
 *
 * A dynamic value lives in a run of chunk records, and the data NFT that declares it carries only the value's byte
 * length. A body that rewrites an element in place produces a whole new value and the artifact publishes neither an
 * element source nor an element count for it, so the run's width comes from the record's own declaration: the live
 * array's byte length. A call after the write opens a second segment, so the frame declares the data record and the
 * run in the segment the write lands in and keeps them in the segment that follows.
 */

const IMPL_CATEGORY = '11'.repeat(31) + 'ee';
const PROXY_CATEGORY = '22'.repeat(31) + 'dd';
const PING_CATEGORY = '55'.repeat(31) + 'aa';
const CALLER_TXID = '33'.repeat(31) + 'cc';
const SECOND_CALLER_TXID = '44'.repeat(31) + 'bb';

const VALIDATOR_PROGRAM = framedValidator.buildValidatorProgram();
const PING_ADDRESS = validatorAddress(hexToBin(PING_CATEGORY), VALIDATOR_PROGRAM);

/** A note long enough that the seeded element's pushdata encoding spans several chunks on its own. */
const NOTE = 'n'.repeat(140);

/**
 * The same shape with or without a runtime hash in the editing entry.
 *
 * The seeding entry grows the array with a long element; the editing entry rewrites one of its fields, reads an
 * absent key of a sorted mapping beside it and calls another contract. With `hashed` it also hashes a runtime
 * value, which the block layout carries a side-car slot for. The hop lays that side-car after the frame's own
 * master, and the dynamic run is addressed from the caller's record block, so the slot shifts no record
 * coordinate: both shapes settle over the same declaration.
 */
function sourceOf(hashed: boolean): string {
  return 'pragma solidcash ^0.14.0;'
    + ' interface IPing { function measure() view returns (uint); }'
    + ' contract Ping {'
    + '   int public touched;'
    + '   function measure() view returns (uint) { return 1; }'
    + ' }'
    + ' contract Impl {'
    + '   struct Row { string note; uint amount; uint state; address holder; }'
    + '   address public implementation;'
    + '   Row[] public rows;'
    + '   mapping(uint => mapping(address => uint)) public marks;'
    + '   function initialize(string note_, uint low_, uint high_) {'
    + '     this.rows.push();'
    + '     this.rows[0].note = note_;'
    + '     this.rows[0].amount = 1;'
    + '     this.marks[low_][msg.sender] = 1;'
    + '     this.marks[high_][msg.sender] = 2;'
    + '   }'
    + '   function edit(uint id_, uint amount_, uint absent_, bytes blob_) {'
    + (hashed ? '     bytes32 digest = keccak256(bytes(blob_)); require(digest != bytes32(0));' : '')
    + '     require(this.marks[absent_][msg.sender] >= 0);'
    + '     Row storage row = this.rows[id_];'
    + '     require(row.amount != amount_);'
    + '     row.amount = amount_;'
    + '     row.holder = msg.sender;'
    + `     IPing(0x${binToHex(PING_ADDRESS)}).measure();`
    + '     require(row.amount == amount_);'
    + '   }'
    + ' }';
}

interface Funding {
  readonly network: MockNetworkProvider;
  readonly signature: SignatureTemplate;
  readonly funder: ReturnType<Contract['unlock']['spend']>;
  readonly implFunding: { txid: string; vout: number; satoshis: bigint };
  readonly proxyFunding: { txid: string; vout: number; satoshis: bigint };
  readonly callerUtxo: { txid: string; vout: number; satoshis: bigint };
  readonly callUtxos: readonly { txid: string; vout: number; satoshis: bigint }[];
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
}

/** Funds the two genesis UTXOs, the callee's own coin and the deployer's. */
async function funded(network: MockNetworkProvider): Promise<Funding> {
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const implFunding = { txid: IMPL_CATEGORY, vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: PROXY_CATEGORY, vout: 0, satoshis: 500_000n };
  const pingFunding = { txid: PING_CATEGORY, vout: 0, satoshis: 5_000_000n };
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: CALLER_TXID, vout: 0, satoshis: 100_000n };
  const callUtxos = Array.from({ length: 12 }, (_unused, index) => ({
    txid: `${SECOND_CALLER_TXID.slice(0, 62)}${(index + 1).toString(16).padStart(2, '0')}`,
    vout: 0, satoshis: 100_000n,
  }));
  await network.addUtxo(funder.address, implFunding);
  await network.addUtxo(funder.address, proxyFunding);
  await network.addUtxo(funder.address, pingFunding);
  await fundShippedFacets(network);
  await network.addUtxo(binToHex(deployerLock), callerUtxo);
  for (const coin of callUtxos) await network.addUtxo(binToHex(deployerLock), coin);
  return {
    network, signature, funder: funder.unlock.spend(alicePub, signature),
    implFunding, proxyFunding, callerUtxo, callUtxos, deployerLock, changeAddress: funder.address,
  };
}

/** Deploys the callee, then the implementation and its proxy, broadcasting the seeding initialize. */
async function deploy(hashed: boolean): Promise<{
  readonly network: MockNetworkProvider;
  readonly artifacts: ReturnType<typeof compileStringMulti>;
  readonly ping: Artifact;
  readonly funding: Funding;
  readonly initialized: boolean;
}> {
  const artifacts = compileStringMulti(sourceOf(hashed), { composition: 'framed' });
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const funding = await funded(network);
  const signature = new SignatureTemplate(alicePriv);
  const pingFunding = { txid: PING_CATEGORY, vout: 0, satoshis: 5_000_000n };
  // A deployment's token category is its funding coin's transaction id, so the coin carries the id the site names.
  await deployStatefulContract(artifacts.Ping!, [], {
    fundingUtxo: pingFunding, funder: funding.funder, changeAddress: funding.changeAddress,
    provider: network, threadCount: 4,
  });
  const deployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: artifacts.Impl!,
    implementationDeploy: {
      fundingUtxo: funding.implFunding, funder: funding.funder, changeAddress: funding.changeAddress,
    },
    proxyDeploy: {
      fundingUtxo: funding.proxyFunding, funder: funding.funder, changeAddress: funding.changeAddress,
    },
    initialize: { functionName: 'initialize', args: [NOTE, 5n, 9n] as never },
    callerLockingBytecode: funding.deployerLock,
    callerFunding: { utxo: funding.callerUtxo, funder: signature.unlockP2PKH() },
    vm: compositionMachine(),
  });
  return { network, artifacts, ping: artifacts.Ping!, funding, initialized: deployment.initialize.accepted };
}

/** The fields the proxy's record 0 carries, read back through the shipped decoder. */
async function recordFields(
  network: MockNetworkProvider,
  layout: NonNullable<ReturnType<typeof buildProxyArtifact>['stateLayout']>,
): Promise<Record<string, unknown>> {
  const deployment = await readFramedDeployment(network, PROXY_CATEGORY, layout);
  const commitment = bytesToHex(new Uint8Array(hexToBin(deployment.records[0]!.token!.nft!.commitment)));
  return parsePushdataCommitment(commitment, layout, 0);
}

describe('a proxied entry that rewrites an element of a chunked dynamic value', () => {
  it('settles a chain of edits, each reading an absent key of a live sorted list', async () => {
    const layout = buildProxyArtifact(
      compileStringMulti(sourceOf(false), { composition: 'framed' }).Impl!,
    ).stateLayout!;
    const { network, artifacts, funding, initialized } = await deploy(false);
    expect(initialized).toBe(true);

    const entry = artifacts.Impl!.abi.find((candidate) => candidate.name === 'edit')!;
    // The whole value is the body's to compute, so the artifact states neither an element nor a count; the run's
    // width can only come from the record's own declared length.
    expect(entry.dynamicWrites).toStrictEqual(['rows']);
    expect(entry.dynamicWriteSources).toBeUndefined();
    expect(entry.dynamicWriteGrowth).toBeUndefined();
    // No slot but the master, the data records and the entry node the mapping read declares.
    expect((entry.blockLayout!.slots ?? []).map((slot) => slot.kind))
      .toStrictEqual(['master', 'dataNft', 'entry']);

    const before = await recordFields(network, layout);
    // More than one chunk payload, so the run's width is more than a single record.
    expect(BigInt(before.rows$len as bigint)).toBeGreaterThan(128n);

    // Two edits: key 2 is absent between the list's two nodes and key 11 past its last, the two proofs of absence.
    const results = [];
    for (const [index, absent] of [2n, 11n].entries()) {
      results.push(await callFramedProxyEntry({
        provider: network,
        implementationArtifact: artifacts.Impl!,
        proxyArtifact: buildProxyArtifact(artifacts.Impl!),
        proxyCategoryId: PROXY_CATEGORY,
        implementationCategoryId: IMPL_CATEGORY,
        functionName: 'edit',
        args: [0n, 7n + BigInt(index), absent, Uint8Array.from([1, 2, 3])] as never,
        externals: { IPing: { artifact: artifacts.Ping!, categoryId: PING_CATEGORY } },
        callerUtxo: funding.callUtxos[index]!,
        callerLockingBytecode: funding.deployerLock,
        funder: funding.signature.unlockP2PKH(),
        changeAddress: funding.changeAddress,
        vm: compositionMachine(),
      }));
    }

    for (const result of results) {
      expect(result.verdicts.every((verdict) => verdict.accepted)).toBe(true);
      expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    }
    // The run the transaction carried is the width the record's own declaration sized: the seeded value's few
    // hundred bytes, and the value the edit wrote is at least as long as the one it rewrote.
    const after = await recordFields(network, layout);
    expect(BigInt(after.rows$len as bigint) >= BigInt(before.rows$len as bigint)).toBe(true);
  }, 300_000);

  it('settles the same entry once it hashes a runtime value, with the side-car laid after its own master', async () => {
    const layout = buildProxyArtifact(
      compileStringMulti(sourceOf(true), { composition: 'framed' }).Impl!,
    ).stateLayout!;
    const { network, artifacts, funding, initialized } = await deploy(true);
    expect(initialized).toBe(true);

    const entry = artifacts.Impl!.abi.find((candidate) => candidate.name === 'edit')!;
    // The runtime hash adds a side-car slot the hop now lays: the side-car input follows the implementation's own
    // master, and the dynamic run it addresses sits in the caller's record block, which the slot does not shift.
    expect((entry.blockLayout!.slots ?? []).map((slot) => slot.kind))
      .toStrictEqual(['master', 'dataNft', 'keccakSideCar', 'entry']);

    const before = await recordFields(network, layout);
    const result = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyArtifact: buildProxyArtifact(artifacts.Impl!),
      proxyCategoryId: PROXY_CATEGORY,
      implementationCategoryId: IMPL_CATEGORY,
      functionName: 'edit',
      args: [0n, 7n, 2n, Uint8Array.from([1, 2, 3])] as never,
      externals: { IPing: { artifact: artifacts.Ping!, categoryId: PING_CATEGORY } },
      callerUtxo: funding.callUtxos[0]!,
      callerLockingBytecode: funding.deployerLock,
      funder: funding.signature.unlockP2PKH(),
      changeAddress: funding.changeAddress,
      vm: compositionMachine(),
    });
    expect(result.verdicts.every((verdict) => verdict.accepted)).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // The hashed entry writes the same run the unhashed one does, so the record's own declared length holds.
    const after = await recordFields(network, layout);
    expect(BigInt(after.rows$len as bigint) >= BigInt(before.rows$len as bigint)).toBe(true);
    expect(layout.dataNftCount).toBeGreaterThan(0);
  }, 300_000);
});
