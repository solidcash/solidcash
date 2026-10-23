import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import {
  buildChunkCommitment, bytesToHex, decodePushdataValue, encodePushdataValue, parseChunkCommitment,
  type StateValue,
} from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import {
  chunkRecordLockingBytecode, readFramedDeployment, readFramedState,
} from '../../../src/framed/deploy/index.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry } from '../../../src/framed/proxy/deploy.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A proxied entry that appends an element the artifact does not state, alone and inside a run-time loop.
 *
 * A framed body holds a dynamic value in a run of chunk records, and the hop has to lay that run at the width
 * the body's own write produces. When the artifact can state the appended element, the width is the live value
 * plus that element; when it cannot - a body that pushes the element type's default and then fills its fields with
 * values the artifact's vocabulary has no word for - the artifact states how many elements the write appends, and
 * the hop grows the live value by them. The elements' own bytes are what the body computed, so the created chunks
 * are learned from the body's own close and the run is read back through the shipped decoders.
 *
 * A push inside a run-time loop appends one element per turn, so the artifact names the array the call carries and
 * the hop reads its length. A loop whose width no call fact carries is refused by name, never guessed.
 */

const IMPL_CATEGORY = '11'.repeat(31) + 'ee';
const PROXY_CATEGORY = '22'.repeat(31) + 'dd';
const CALLER_TXID = '33'.repeat(31) + 'cc';
const SECOND_CALLER_TXID = '44'.repeat(31) + 'bb';

/** The value the seeding entry writes into the state field each appended element carries. */
const OWNER = 0x91n;

/** A title long enough that the appended element's pushdata encoding crosses the 120-byte chunk boundary. */
const TITLE = 't'.repeat(130);

/** One bare push whose field is filled from state, so the element's value is not something the artifact states. */
const UNSET_ELEMENT_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Impl {'
  + '   struct Detail { uint amount; uint extra; }'
  + '   address public implementation;'
  + '   uint public owner;'
  + '   Detail[] public items;'
  + '   function initialize() { require(true); }'
  + '   function add(uint who) { this.owner = who; this.items.push(); this.items[0].amount = this.owner; }'
  + ' }';

/** The same push inside a loop over the call's own array, beside a mapping the loop also writes. */
const LOOP_APPEND_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Impl {'
  + '   struct Detail { uint amount; uint extra; }'
  + '   address public implementation;'
  + '   uint public owner;'
  + '   Detail[] public items;'
  + '   mapping(uint => uint) public counts;'
  + '   function initialize(uint who) { this.owner = who; this.items.push(); }'
  + '   function add(uint[] who) {'
  + '     for (uint i = 0; i < who.length; i = i + 1) {'
  + '       this.items.push();'
  + '       uint j = this.items.length - 1;'
  + '       this.items[j].amount = this.owner;'
  + '       this.counts[7] = 1;'
  + '     }'
  + '   }'
  + ' }';

/** The fixture's own shape: a bare push whose element is filled through a storage pointer, clock field and all. */
const FIXTURE_SHAPED_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Impl {'
  + '   struct Roles { address creator; address arbitrator; address worker; }'
  + '   struct JobPost { int state; bool whitelistWorkers; Roles roles; string title; bytes32 contentHash;'
  + '     address token; int amount; int timestamp; }'
  + '   address public implementation;'
  + '   JobPost[] public jobs;'
  + '   function initialize() { require(true); }'
  + '   function publish(string title_, bytes32 contentHash_, address token_, int amount_) {'
  + '     this.jobs.push();'
  + '     uint id = this.jobs.length - 1;'
  + '     JobPost storage j = this.jobs[id];'
  + '     j.roles.creator = msg.sender;'
  + '     j.title = title_;'
  + '     j.contentHash = contentHash_;'
  + '     j.token = token_;'
  + '     j.amount = amount_;'
  + '     j.timestamp = int(uint32(block.timestamp));'
  + '   }'
  + ' }';

/** The same push in a loop bounded by state rather than by the call, so its width is not a call fact. */
const UNRESOLVED_LOOP_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Impl {'
  + '   struct Detail { uint amount; uint extra; }'
  + '   address public implementation;'
  + '   uint[] public owners;'
  + '   Detail[] public items;'
  + '   function initialize() { this.items.push(); }'
  + '   function grow() {'
  + '     for (uint i = 0; i < this.owners.length; i = i + 1) {'
  + '       this.items.push();'
  + '       this.items[i].amount = 0;'
  + '     }'
  + '   }'
  + ' }';

interface Funding {
  readonly network: MockNetworkProvider;
  readonly signature: SignatureTemplate;
  readonly funder: ReturnType<Contract['unlock']['spend']>;
  readonly implFunding: { txid: string; vout: number; satoshis: bigint };
  readonly proxyFunding: { txid: string; vout: number; satoshis: bigint };
  readonly callerUtxo: { txid: string; vout: number; satoshis: bigint };
  readonly callUtxo: { txid: string; vout: number; satoshis: bigint };
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
}

/** Funds the two genesis UTXOs and the deployer's own coins. */
async function funded(network: MockNetworkProvider): Promise<Funding> {
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const implFunding = { txid: IMPL_CATEGORY, vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: PROXY_CATEGORY, vout: 0, satoshis: 500_000n };
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: CALLER_TXID, vout: 0, satoshis: 100_000n };
  const callUtxo = { txid: SECOND_CALLER_TXID, vout: 0, satoshis: 100_000n };
  await network.addUtxo(funder.address, implFunding);
  await network.addUtxo(funder.address, proxyFunding);
  await fundShippedFacets(network);
  await network.addUtxo(binToHex(deployerLock), callerUtxo);
  await network.addUtxo(binToHex(deployerLock), callUtxo);
  return {
    network, signature, funder: funder.unlock.spend(alicePub, signature),
    implFunding, proxyFunding, callerUtxo, callUtxo, deployerLock, changeAddress: funder.address,
  };
}

/** Deploys one hop for a seeding initialize, with the implementation's generated proxy. */
async function deploy(
  source: string,
  args: readonly unknown[] = [],
): Promise<{
    readonly deployment: Awaited<ReturnType<typeof deployFramedProxy>>;
    readonly network: MockNetworkProvider;
    readonly artifacts: ReturnType<typeof compileStringMulti>;
    readonly layout: NonNullable<ReturnType<typeof buildProxyArtifact>['stateLayout']>;
    readonly funding: Funding;
  }> {
  const artifacts = compileStringMulti(source, { composition: 'framed' });
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const funding = await funded(network);
  const deployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: artifacts.Impl!,
    implementationDeploy: {
      fundingUtxo: funding.implFunding, funder: funding.funder, changeAddress: funding.changeAddress,
    },
    proxyDeploy: {
      fundingUtxo: funding.proxyFunding, funder: funding.funder, changeAddress: funding.changeAddress,
    },
    initialize: { functionName: 'initialize', args: args as never },
    callerLockingBytecode: funding.deployerLock,
    callerFunding: { utxo: funding.callerUtxo, funder: funding.signature.unlockP2PKH() },
    vm: compositionMachine(),
  });
  return {
    deployment, network, artifacts, layout: buildProxyArtifact(artifacts.Impl!).stateLayout!, funding,
  };
}

/** The live chunks at one lock, in chunk order, each with the bytes its commitment decodes to. */
async function liveChunks(
  network: MockNetworkProvider,
  categoryId: string,
  layout: NonNullable<ReturnType<typeof buildProxyArtifact>['stateLayout']>,
  lock: Uint8Array,
): Promise<readonly { readonly index: number; readonly data: Uint8Array }[]> {
  const pools = await readFramedDeployment(network, categoryId, layout);
  return [...pools.chunks, ...pools.collectionNodes]
    .filter((utxo) => utxo.lockingBytecode !== undefined
      && bytesToHex(utxo.lockingBytecode) === bytesToHex(lock))
    .map((utxo) => parseChunkCommitment(utxo.token!.nft!.commitment!))
    .map((chunk) => ({ index: chunk.chunkIndex, data: chunk.chunkData }))
    .sort((left, right) => left.index - right.index);
}

describe('a proxied entry that appends an element the artifact does not state', () => {
  it('publishes the element count a bare push grows and settles it through the shipped hop', async () => {
    const artifacts = compileStringMulti(UNSET_ELEMENT_SOURCE, { composition: 'framed' });
    const entry = artifacts.Impl!.abi.find((candidate) => candidate.name === 'add')!;
    // The element's field is filled from state, so the artifact states no element; it states the count instead.
    expect(entry.dynamicWriteSources).toBeUndefined();
    expect(entry.dynamicWriteGrowth).toStrictEqual({ items: { elements: 1 } });

    const { deployment, network, artifacts: compiled, layout, funding } = await deploy(UNSET_ELEMENT_SOURCE, []);
    expect(deployment.initialize.accepted).toBe(true);

    const result = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'add',
      args: [OWNER],
      callerUtxo: funding.callUtxo,
      callerLockingBytecode: funding.deployerLock,
      funder: funding.signature.unlockP2PKH(),
      changeAddress: funding.changeAddress,
      vm: compositionMachine(),
    });
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast).toBeDefined();

    // The value the body computed: one default element with its field filled from the state the same body wrote.
    const value = encodePushdataValue([{ amount: OWNER, extra: 0n }], 'Detail[]', compiled.Impl!.structs);
    const lock = chunkRecordLockingBytecode(deployment.proxy.categoryId, 'items', 'Detail[]');
    const trailing = result.draft.trailingOutputs;
    expect(trailing).toHaveLength(1);
    expect(trailing[0]!.output.lockingBytecode).toStrictEqual(lock);
    expect(result.transaction.outputs[trailing[0]!.index]!.token!.nft!.commitment)
      .toStrictEqual(new Uint8Array(hexToBin(buildChunkCommitment(0, value))));

    const state = await readFramedState(network, deployment.proxy.categoryId, layout);
    expect(state.byNft[0]!.items$len).toBe(BigInt(value.length));
    const chunks = await liveChunks(network, deployment.proxy.categoryId, layout, lock);
    expect(chunks.map((chunk) => bytesToHex(chunk.data))).toStrictEqual([bytesToHex(value)]);
    expect(await network.getRawTransaction(result.broadcast!.txid)).toMatch(/^[0-9a-f]+$/);
  });

  it('settles a push inside a loop over the call\'s array, the run grown by the loop\'s width', async () => {
    const artifacts = compileStringMulti(LOOP_APPEND_SOURCE, { composition: 'framed' });
    const entry = artifacts.Impl!.abi.find((candidate) => candidate.name === 'add')!;
    expect(entry.dynamicWriteSources).toBeUndefined();
    expect(entry.dynamicWriteGrowth).toStrictEqual({ items: { elements: 1, varyingArrayParam: 'who' } });

    const { deployment, network, artifacts: compiled, layout, funding } = await deploy(LOOP_APPEND_SOURCE, [OWNER]);
    expect(deployment.initialize.accepted).toBe(true);

    const result = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'add',
      args: [[111n, 222n]],
      callerUtxo: funding.callUtxo,
      callerLockingBytecode: funding.deployerLock,
      funder: funding.signature.unlockP2PKH(),
      changeAddress: funding.changeAddress,
      vm: compositionMachine(),
    });
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast).toBeDefined();

    // The value the body computed: the seeding element, then one filled element per turn of the loop.
    const value = encodePushdataValue(
      [{ amount: 0n, extra: 0n }, { amount: OWNER, extra: 0n }, { amount: OWNER, extra: 0n }],
      'Detail[]', compiled.Impl!.structs,
    );
    const lock = chunkRecordLockingBytecode(deployment.proxy.categoryId, 'items', 'Detail[]');
    const chunks = await liveChunks(network, deployment.proxy.categoryId, layout, lock);
    expect(chunks.map((chunk) => bytesToHex(chunk.data))).toStrictEqual([bytesToHex(value)]);
    const state = await readFramedState(network, deployment.proxy.categoryId, layout);
    expect(state.byNft[0]!.items$len).toBe(BigInt(value.length));
    expect(await network.getRawTransaction(result.broadcast!.txid)).toMatch(/^[0-9a-f]+$/);
  });

  it('reconstructs the fixture element from its in-place writes, a run of several chunks and all', async () => {
    const artifacts = compileStringMulti(FIXTURE_SHAPED_SOURCE, { composition: 'framed' });
    const entry = artifacts.Impl!.abi.find((candidate) => candidate.name === 'publish')!;
    // The clock field is a read of the machine's own register, so the whole element the body fills is published
    // and the hop sizes the run from it rather than from an element count.
    expect(entry.dynamicWriteSources).toBeDefined();
    expect(entry.dynamicWriteGrowth).toStrictEqual({ jobs: { elements: 1 } });

    const { deployment, network, layout, funding } = await deploy(FIXTURE_SHAPED_SOURCE, []);
    expect(deployment.initialize.accepted).toBe(true);
    // The mock chain writes each block's time into the oracle the entry co-spends, so the clock field is the time
    // of the last block.
    const clock = BigInt(network.getBlockTime());

    const result = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'publish',
      args: [TITLE, hexToBin('ab'.repeat(32)), funding.deployerLock, 7n],
      callerUtxo: funding.callUtxo,
      callerLockingBytecode: funding.deployerLock,
      funder: funding.signature.unlockP2PKH(),
      changeAddress: funding.changeAddress,
      vm: compositionMachine(),
    });
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast).toBeDefined();

    // The element is well over one chunk, so the run the body writes spans several: read back through the shipped
    // chunk and pushdata decoders rather than compared against a value built here.
    const lock = chunkRecordLockingBytecode(deployment.proxy.categoryId, 'jobs', 'JobPost[]');
    const chunks = await liveChunks(network, deployment.proxy.categoryId, layout, lock);
    expect(chunks.length).toBeGreaterThan(1);
    const value = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.data.length, 0));
    let offset = 0;
    for (const chunk of chunks) { value.set(chunk.data, offset); offset += chunk.data.length; }
    const state = await readFramedState(network, deployment.proxy.categoryId, layout);
    expect(state.byNft[0]!.jobs$len).toBe(BigInt(value.length));

    const decoded = decodePushdataValue(value, 0, 'JobPost[]', artifacts.Impl!.structs).value as StateValue[];
    expect(decoded).toHaveLength(1);
    const job = decoded[0] as unknown as Record<string, unknown>;
    expect(job.title).toBe(TITLE);
    expect(job.amount).toBe(7n);
    expect(job.timestamp).toBe(clock);
    expect([...(job.roles as { creator: Uint8Array }).creator]).toStrictEqual([...funding.deployerLock]);
    expect(await network.getRawTransaction(result.broadcast!.txid)).toMatch(/^[0-9a-f]+$/);
  });

  it('refuses a push in a loop whose width no call fact carries, naming the loop', async () => {
    const artifacts = compileStringMulti(UNRESOLVED_LOOP_SOURCE, { composition: 'framed' });
    const entry = artifacts.Impl!.abi.find((candidate) => candidate.name === 'grow')!;
    expect(entry.dynamicWriteGrowth).toStrictEqual({ items: { elements: 1, looping: true } });

    const { deployment, network, funding } = await deploy(UNRESOLVED_LOOP_SOURCE, []);
    expect(deployment.initialize.accepted).toBe(true);

    await expect(callFramedProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'grow',
      callerUtxo: funding.callUtxo,
      callerLockingBytecode: funding.deployerLock,
      funder: funding.signature.unlockP2PKH(),
      changeAddress: funding.changeAddress,
      vm: compositionMachine(),
    })).rejects.toThrow(
      /appends to dynamic "items" inside a run-time loop whose width the artifact does not pin to a call parameter/,
    );
  });
});
