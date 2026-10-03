import { describe, expect, it } from 'vitest';
import { bigIntToVmNumber, binToHex, encodeLockingBytecodeP2pkh, hexToBin, vmNumberToBigInt } from '@bitauth/libauth';
import {
  buildChunkCommitment, buildValueChunkCommitment, bytesToHex, decodePushdataValue, encodeChunkableValueTail,
  encodePushdataValue, parseChunkCommitment, sha256, splitValueIntoValueChunks, VALUE_INLINE_LIMIT,
} from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import {
  chunkRecordLockingBytecode, readPerCallDeployment, readPerCallState,
} from '../../../src/per-call/deploy/index.js';
import { mappingValueChunkLock } from '../../../src/per-call/composer/index.js';
import { buildProxyArtifact, deployPerCallProxy } from '../../../src/per-call/proxy/index.js';
import { callPerCallProxyEntry } from '../../../src/per-call/proxy/deploy.js';
import {
  bytesToSlotValue, decodeEntryCommitment, headSentinelCommitment, keyToSlotMulti,
} from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A proxied entry that appends to a dynamic state array, alone and beside a sorted-mapping write.
 *
 * A dynamic value is not held in the data NFT that declares it: the NFT carries the value's byte length and the
 * bytes live in a run of chunk NFTs at the variable's own collection covenant, addressed from the frame's declared
 * record block. A delegate frame runs on the proxy's records, so the hop has to declare that run — its records and
 * the outputs the transaction writes at their indices — or the body's own address pin reads whatever the hop put at
 * that ordinal and fails. The run's width comes from the value the write produces — the value the deployment holds
 * plus the element the artifact publishes for the append — and its commitments are what the body computed, which
 * the derivation learns from the body's close.
 *
 * A sorted mapping's write is declared beside the run. A target the live list holds is spliced through a node the
 * deployment already carries, so the hop spends and recreates that predecessor; a first insert into a collection the
 * entries never wrote splices through the empty head the proxy's genesis minted for it, since a head is minted only
 * at genesis.
 *
 * The expected commitments here come from the shipped encoders (`encodePushdataValue` for the value,
 * `buildChunkCommitment` for a chunk, `chunkRecordLockingBytecode` for the value's collection covenant), and the
 * record is read back through the shipped pushdata decoder.
 */

const IMPL_CATEGORY = '11'.repeat(31) + 'ee';
const PROXY_CATEGORY = '22'.repeat(31) + 'dd';
const CALLER_TXID = '33'.repeat(31) + 'cc';
const SECOND_CALLER_TXID = '44'.repeat(31) + 'bb';

/** The append the deployment's initialize makes (one element, the frame's own sender), made again by a later call. */
const APPEND_CALL_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   address[] public items;'
  + '   function initialize() { this.items.push(msg.sender); }'
  + '   function appendOne() { this.items.push(msg.sender); }'
  + ' }';

/** A mapping entry whose value the node holds inline, written beside the append the way a counter is bumped. */
const COUNTER_BESIDE_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   address[] public items;'
  + '   mapping(address => uint) public counts;'
  + '   function initialize(address who) { this.counts[who] = this.counts[who] + 1; this.items.push(msg.sender); }'
  + '   function again(address who) { this.counts[who] = this.counts[who] + 1; this.items.push(msg.sender); }'
  + ' }';

/** An insert of a chunked struct value beside the append, over a mapping the deployment's own entry never wrote. */
const UNSEEDED_REGISTER_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   struct Member { address who; string name; string bio; uint up; }'
  + '   address public implementation;'
  + '   mapping(address => Member) public members;'
  + '   address[] public items;'
  + '   function initialize() { this.items.push(msg.sender); }'
  + '   function register(address who, Member m) {'
  + '     require(this.members[who].up == 0);'
  + '     this.members[who] = m;'
  + '     this.items.push(msg.sender);'
  + '   }'
  + ' }';

/** The append in a body that also builds its struct value, which the artifact publishes no element source for. */
const CONSTRUCTED_BESIDE_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   struct Member { address who; string name; string bio; uint up; }'
  + '   address public implementation;'
  + '   mapping(address => Member) public members;'
  + '   address[] public items;'
  + '   function initialize(address who, Member m) { this.members[who] = m; }'
  + '   function register(address who, string name_, string bio_) {'
  + '     require(this.members[who].up == 0);'
  + '     this.members[who] = Member(who, name_, bio_, 1);'
  + '     this.items.push(msg.sender);'
  + '   }'
  + ' }';

/**
 * A body that builds its struct value from a local the artifact cannot state, then writes it into a chunking
 * mapping.
 *
 * The local is reassigned under a branch the artifact's source vocabulary does not fold, so the artifact publishes
 * no value source for the write and the hop cannot size the run of chunk records the value's byte length names.
 * The body's own value pin stops on the count it computed, and the value and its digest are operands at that stop,
 * so the hop learns the value there and re-plans the write's run from it.
 */
const UNSTATED_VALUE_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   struct Member { address who; string name; string bio; uint up; }'
  + '   address public implementation;'
  + '   mapping(address => Member) public members;'
  + '   function initialize(address who, Member m) { this.members[who] = m; }'
  + '   function register(address who, string name_, string bio_, bool flag) {'
  + '     uint up_ = 1;'
  + '     if (flag) { up_ = 2; }'
  + '     Member memory m = Member(who, name_, bio_, up_);'
  + '     require(m.up > 0);'
  + '     this.members[who] = m;'
  + '   }'
  + ' }';

/**
 * The append beside an update of a mapping node the live list holds, whose new value crosses the inline limit.
 *
 * The value a long entry writes lives in continuation chunks at the value's own covenant, so the hop declares a
 * run of chunk records beside the dynamic value's run. Both runs are open in one segment; each is addressed by the
 * rule the body uses for it.
 */
const LONG_UPDATE_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   struct Member { address who; string name; string bio; uint up; }'
  + '   address public implementation;'
  + '   mapping(address => Member) public members;'
  + '   address[] public items;'
  + '   function initialize(address who, Member m) { this.members[who] = m; this.items.push(msg.sender); }'
  + '   function rename(address who, Member m) { this.members[who] = m; this.items.push(msg.sender); }'
  + ' }';

/** An element type the artifact states only as a literal, which the hop sizes through the shipped encoder. */
const LITERAL_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   int[] public items;'
  + '   function initialize() { this.items.push(1); }'
  + ' }';

/** A write whose run the artifact publishes no element for, because the body pushes more than once. */
const WIDE_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   address[] public items;'
  + '   function initialize() {'
  + Array.from({ length: 5 }, () => '     this.items.push(msg.sender);').join('')
  + '   }'
  + ' }';

/** A loop write whose keys the call's own array names, beside the append that names the run. */
const LOOP_BESIDE_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   address[] public items;'
  + '   mapping(address => uint) public counts;'
  + '   function initialize() { this.items.push(msg.sender); }'
  + '   function bump(address[] who) {'
  + '     for (uint i = 0; i < who.length; i = i + 1) { this.counts[who[i]] = this.counts[who[i]] + 1; }'
  + '     this.items.push(msg.sender);'
  + '   }'
  + ' }';

/**
 * A loop write whose leading key is the length the same body's own append produces.
 *
 * The body pushes one element and then writes the mapping under the index that element took, so every turn's key is
 * counted from the written value rather than from the one the segment started from.
 */
const LOOP_KEYED_BY_APPEND_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   address[] public items;'
  + '   mapping(int => mapping(address => bool)) public allow;'
  + '   function initialize() { this.items.push(msg.sender); }'
  + '   function grant(address[] who) {'
  + '     this.items.push(msg.sender);'
  + '     for (uint i = 0; i < who.length; i = i + 1) {'
  + '       this.allow[this.items.length - 1][who[i]] = true;'
  + '     }'
  + '   }'
  + ' }';

/** A fresh key the seeded deployment does not hold, so the call's write is an insert. */
const FRESH_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x77));

interface Funding {
  readonly network: MockNetworkProvider;
  readonly signature: SignatureTemplate;
  readonly funder: ReturnType<Contract['unlock']['spend']>;
  readonly implFunding: { txid: string; vout: number; satoshis: bigint };
  readonly proxyFunding: { txid: string; vout: number; satoshis: bigint };
  readonly callerUtxo: { txid: string; vout: number; satoshis: bigint };
  /** A second coin, for a call the deployment's own hop did not already spend. */
  readonly callUtxo: { txid: string; vout: number; satoshis: bigint };
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
}

/** Funds the two genesis UTXOs and, when the hop is broadcast, the deployer's own coins. */
async function funded(network: MockNetworkProvider, withCaller = false): Promise<Funding> {
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const implFunding = { txid: IMPL_CATEGORY, vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: PROXY_CATEGORY, vout: 0, satoshis: 500_000n };
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);
  // A root frame binds `msg.sender` to the lock of the input its caller reference names, so the caller's own coin
  // has to sit at exactly the deployer lock the witness sender is bound to.
  const callerUtxo = { txid: CALLER_TXID, vout: 0, satoshis: 100_000n };
  const callUtxo = { txid: SECOND_CALLER_TXID, vout: 0, satoshis: 100_000n };
  await network.addUtxo(funder.address, implFunding);
  await network.addUtxo(funder.address, proxyFunding);
  // The hop broadcasts, so each composition's facet input needs a live UTXO at the facet's lock.
  await fundShippedFacets(network);
  if (withCaller) {
    await network.addUtxo(binToHex(deployerLock), callerUtxo);
    await network.addUtxo(binToHex(deployerLock), callUtxo);
  }
  return {
    network, signature, funder: funder.unlock.spend(alicePub, signature),
    implFunding, proxyFunding, callerUtxo, callUtxo, deployerLock, changeAddress: funder.address,
  };
}

/** Deploys one hop for an appending initialize, with the implementation's generated proxy. */
async function deploy(
  source: string,
  args: readonly unknown[] = [],
  broadcast = false,
): Promise<{
  readonly deployment: Awaited<ReturnType<typeof deployPerCallProxy>>;
  readonly network: MockNetworkProvider;
  readonly artifacts: ReturnType<typeof compileStringMulti>;
  readonly layout: NonNullable<ReturnType<typeof buildProxyArtifact>['stateLayout']>;
  readonly funding: Funding;
}> {
  const artifacts = compileStringMulti(source, { composition: 'per-call' });
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const funding = await funded(network, broadcast);
  const deployment = await deployPerCallProxy({
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
    ...(broadcast ? { callerFunding: { utxo: funding.callerUtxo, funder: funding.signature.unlockP2PKH() } } : {}),
    vm: compositionMachine(),
  });
  return {
    deployment, network, artifacts, layout: buildProxyArtifact(artifacts.Impl!).stateLayout!, funding,
  };
}

describe('a proxied initialize that appends to a dynamic state array', () => {
  it('settles a literal element, sizing the run from the element the artifact publishes', async () => {
    // The artifact states the pushed element as a literal, so the hop sizes the run through the shipped encoder
    // rather than refusing an element type it cannot name.
    const { deployment, network, artifacts, layout, funding } = await deploy(LITERAL_SOURCE, [], true);
    expect(deployment.initialize.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(deployment.initialize.accepted).toBe(true);

    // The element the artifact publishes as a literal is what sizes the run: the hop encodes it through the same
    // shipped array encoder the body's write uses, so the value's byte length is the header the record carries and
    // the run is one chunk wide.
    const declaredType = layout.variables.find((variable) => variable.name === 'items')!.type;
    const trailing = deployment.initialize.draft.trailingOutputs;
    expect(trailing).toHaveLength(1);
    expect(trailing[0]!.output.lockingBytecode).toStrictEqual(
      chunkRecordLockingBytecode(deployment.proxy.categoryId, 'items', declaredType),
    );
    // The chunk carries the one-element array the literal names, and the record's header is that value's length.
    const commitment = deployment.initialize.transaction.outputs[trailing[0]!.index]!.token!.nft!.commitment!;
    const { value: chunkData } = decodePushdataValue(commitment, 1, 'bytes') as { value: Uint8Array };
    expect(chunkData.length).toBeGreaterThan(0);
    const state = await readPerCallState(network, deployment.proxy.categoryId, layout);
    expect(state.byNft[0]!['items$len']).toBe(BigInt(chunkData.length));
    expect(await network.getRawTransaction(deployment.initialize.broadcast!.txid)).toMatch(/^[0-9a-f]+$/);
    expect(funding.deployerLock.length).toBe(25);
  });

  it('refuses a write whose run the artifact publishes no element for, naming the missing source', async () => {
    // Five pushes are five elements on the one segment, and no single stated element grows the run by all of them,
    // so the artifact publishes no source for the append and the hop refuses by name rather than sizing a run it
    // would have to guess at.
    await expect(deploy(WIDE_SOURCE)).rejects.toThrow(
      /writes dynamic "items" \(address\[\]\), whose appended element the artifact publishes no source for/,
    );
  });

  it('keeps the chunk the deployment holds and writes the grown value through a later call', async () => {
    const { deployment, network, artifacts, layout, funding }
      = await deploy(APPEND_CALL_SOURCE, [], true);
    expect(deployment.initialize.completed.map((frame) => frame.functionName))
      .toStrictEqual(['Impl.initialize()', 'ImplProxy.__fallback()']);
    expect(deployment.initialize.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(deployment.initialize.accepted).toBe(true);

    // The value the entry's own body computed from its frame: the empty array it started from with the frame
    // sender appended, in the shipped pushdata encoding.
    const value = encodePushdataValue(
      [funding.deployerLock], 'address[]', artifacts.Impl!.structs,
    );
    expect(value.length).toBeLessThanOrEqual(120);

    // The created chunk is a trailing output, declared by the frame and written at the index it names.
    const trailing = deployment.initialize.draft.trailingOutputs;
    expect(trailing).toHaveLength(1);
    expect(deployment.initialize.transaction.outputs[trailing[0]!.index]!.token!.nft!.commitment)
      .toStrictEqual(new Uint8Array(hexToBin(buildChunkCommitment(0, value))));
    // The chunk sits at the value's own collection covenant, which the body rebuilds from the frame's category.
    const lock = chunkRecordLockingBytecode(deployment.proxy.categoryId, 'items', 'address[]');
    expect(trailing[0]!.output.lockingBytecode).toStrictEqual(lock);
    expect(deployment.initialize.transaction.outputs[trailing[0]!.index]!.lockingBytecode)
      .toStrictEqual(lock);

    // The record the hop writes carries the value's byte length, from the shipped header encoder.
    const hop = deployment.initialize.broadcast;
    expect(hop).toBeDefined();
    const held = await readPerCallState(network, deployment.proxy.categoryId, layout);
    expect(held.byNft[0]!['items$len']).toBe(BigInt(value.length));
    expect([...held.byNft[0]!.implementation as Uint8Array])
      .toStrictEqual([...deployment.implementation.address]);
    expect(await network.getRawTransaction(hop!.txid)).toMatch(/^[0-9a-f]+$/);
    expect(await liveChunks(network, deployment.proxy.categoryId, layout, lock)).toHaveLength(1);

    // The deployment's hop created the run's only chunk; the call spends that live chunk and recreates it with the
    // value the append produced, so the run stays one chunk wide and no chunk is created.
    const result = await callPerCallProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'appendOne',
      callerUtxo: funding.callUtxo,
      callerLockingBytecode: funding.deployerLock,
      funder: funding.signature.unlockP2PKH(),
      changeAddress: funding.changeAddress,
      vm: compositionMachine(),
    });
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast).toBeDefined();
    const spentIds = result.draft.layout.participants
      .filter((placed) => placed.id.startsWith('dynamic-chunk-'))
      .map((placed) => placed.id);
    expect(spentIds).toHaveLength(1);
    expect(result.draft.trailingOutputs).toStrictEqual([]);

    // The record's length and the live chunk's bytes are the grown value, read back through the shipped decoders.
    const grown = encodePushdataValue(
      [funding.deployerLock, funding.deployerLock], 'address[]', artifacts.Impl!.structs,
    );
    const state = await readPerCallState(network, deployment.proxy.categoryId, layout);
    expect(state.byNft[0]!['items$len']).toBe(BigInt(grown.length));
    const chunks = await liveChunks(network, deployment.proxy.categoryId, layout, lock);
    expect(chunks).toHaveLength(1);
    expect(bytesToHex(chunks[0]!.data)).toBe(bytesToHex(grown));
    expect(await network.getRawTransaction(result.broadcast!.txid)).toMatch(/^[0-9a-f]+$/);
  });

  it('settles a read-modify-write mapping entry beside the append, the node and the chunk both live', async () => {
    // The mapping value is one the node holds inline, so the hop declares the rewritten node and the run of the
    // dynamic value together: the value needs no run of its own, and the two families do not contend for a band.
    const { deployment, network, artifacts, layout, funding }
      = await deploy(COUNTER_BESIDE_SOURCE, [encodeLockingBytecodeP2pkh(alicePkh)], true);
    expect(deployment.initialize.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(deployment.initialize.accepted).toBe(true);

    // The deployment's hop declares one created mapping node and one created chunk: two trailing outputs, in that
    // order.
    const trailing = deployment.initialize.draft.trailingOutputs;
    expect(trailing).toHaveLength(2);
    const value = encodePushdataValue([funding.deployerLock], 'address[]', artifacts.Impl!.structs);
    expect(deployment.initialize.transaction.outputs[trailing[1]!.index]!.token!.nft!.commitment)
      .toStrictEqual(new Uint8Array(hexToBin(buildChunkCommitment(0, value))));

    const state = await readPerCallState(network, deployment.proxy.categoryId, layout);
    expect(state.byNft[0]!['items$len']).toBe(BigInt(value.length));
    expect(await network.getRawTransaction(deployment.initialize.broadcast!.txid)).toMatch(/^[0-9a-f]+$/);

    const result = await callPerCallProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'again',
      args: [funding.deployerLock],
      callerUtxo: funding.callUtxo,
      callerLockingBytecode: funding.deployerLock,
      funder: funding.signature.unlockP2PKH(),
      changeAddress: funding.changeAddress,
      vm: compositionMachine(),
    });
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast).toBeDefined();

    const grown = encodePushdataValue(
      [funding.deployerLock, funding.deployerLock], 'address[]', artifacts.Impl!.structs,
    );
    const lock = chunkRecordLockingBytecode(deployment.proxy.categoryId, 'items', 'address[]');
    const chunks = await liveChunks(network, deployment.proxy.categoryId, layout, lock);
    expect(bytesToHex(chunks[0]!.data)).toBe(bytesToHex(grown));
    expect(await network.getRawTransaction(result.broadcast!.txid)).toMatch(/^[0-9a-f]+$/);
  });

  it('settles the loop write beside the append, the loop\'s nodes and the run both written', async () => {
    // The entry's own run-time loop writes `counts` and its append grows `items` in one segment, so the hop
    // declares both families in one record list: the loop's per-turn nodes in mint order, then the run's chunk.
    // The frame locates each record where its own declaration put it, so the loop's records and the run settle
    // together and the transaction broadcasts.
    const { deployment, network, artifacts, layout, funding } = await deploy(LOOP_BESIDE_SOURCE, [], true);
    expect(deployment.initialize.accepted).toBe(true);

    const workers = [FRESH_LOCK, encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x78))];
    const result = await callPerCallProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'bump',
      args: [workers],
      callerUtxo: funding.callUtxo,
      callerLockingBytecode: funding.deployerLock,
      funder: funding.signature.unlockP2PKH(),
      changeAddress: funding.changeAddress,
      vm: compositionMachine(),
    });
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast).toBeDefined();

    // The loop mints one node per turn after the head it splices through: two created nodes lead the created
    // region, each carrying its key's slot and the value the turn computed (`counts[who[i]] + 1` from an empty
    // list, which is one).
    const trailing = result.draft.trailingOutputs;
    expect(trailing).toHaveLength(2);
    const createdNodes = trailing.map((output) => decodeEntryCommitment(
      Uint8Array.from(result.transaction.outputs[output.index]!.token!.nft!.commitment!)));
    const expectedSlots = workers.map((key) => keyToSlotMulti([key])).sort(
      (left, right) => (bytesToSlotValue(left) < bytesToSlotValue(right) ? -1 : 1),
    );
    expect(createdNodes.map((node) => bytesToHex(node.slot)).sort()).toStrictEqual(
      expectedSlots.map((slot) => bytesToHex(slot)).sort(),
    );
    createdNodes.forEach((node) => expect(vmNumberToBigInt(node.value)).toBe(1n));

    // The head the first turn spliced through is recreated in place, relinked to the lowest key the loop wrote.
    const headIndex = result.draft.layout.participants
      .find((placed) => placed.id === 'mapping-head-counts')!.index;
    const head = decodeEntryCommitment(
      Uint8Array.from(result.transaction.outputs[headIndex]!.token!.nft!.commitment!));
    expect(bytesToHex(head.slot)).toBe(bytesToHex(new Uint8Array(32)));
    // The chain the loop built ascends in slot order: the head links to the lower key, which links to the higher.
    expect(bytesToHex(head.nextKey)).toBe(bytesToHex(expectedSlots[0]!));
    const bySlot = new Map(createdNodes.map((node) => [bytesToHex(node.slot), node]));
    expect(bytesToHex(bySlot.get(bytesToHex(expectedSlots[0]!))!.nextKey)).toBe(bytesToHex(expectedSlots[1]!));

    // The run the append grew is the live chunk recreated in place, carrying both elements in the shipped
    // encoder's form, and the record holds the value's byte length.
    const grown = encodePushdataValue(
      [funding.deployerLock, funding.deployerLock], 'address[]', artifacts.Impl!.structs,
    );
    const chunkIds = result.draft.layout.participants.filter((placed) => placed.id.startsWith('dynamic-chunk-'));
    expect(chunkIds).toHaveLength(1);
    expect(result.transaction.outputs[chunkIds[0]!.index]!.token!.nft!.commitment)
      .toStrictEqual(new Uint8Array(hexToBin(buildChunkCommitment(0, grown))));
    const state = await readPerCallState(network, deployment.proxy.categoryId, layout);
    expect(state.byNft[0]!['items$len']).toBe(BigInt(grown.length));
    expect(await network.getRawTransaction(result.broadcast!.txid)).toMatch(/^[0-9a-f]+$/);
  });

  it('keys the loop write by the length the same body appends, and broadcasts it', async () => {
    // The body pushes one element and then keys the mapping by that element's index, so the node the turn writes
    // sits under the index the *written* array ends at (one, after the initialize's own element). The hop plans the
    // same key from the live value plus the elements the artifact's own growth fact states, and the frame addresses
    // the node at the declared ordinal, so the loop's record and the run's chunk settle together.
    const { deployment, network, artifacts, funding } = await deploy(LOOP_KEYED_BY_APPEND_SOURCE, [], true);
    expect(deployment.initialize.accepted).toBe(true);

    const result = await callPerCallProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'grant',
      args: [[FRESH_LOCK]],
      callerUtxo: funding.callUtxo,
      callerLockingBytecode: funding.deployerLock,
      funder: funding.signature.unlockP2PKH(),
      changeAddress: funding.changeAddress,
      vm: compositionMachine(),
    });
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast).toBeDefined();

    // The turn wrote the index the written array ends at, so the node's slot is the hash of that index and the
    // caller's key rather than of the index the segment started from. One turn mints one node.
    const expectedSlot = keyToSlotMulti([bigIntToVmNumber(1n), FRESH_LOCK]);
    const created = result.draft.trailingOutputs.map((output) => decodeEntryCommitment(
      Uint8Array.from(result.transaction.outputs[output.index]!.token!.nft!.commitment!)));
    expect(created.map((node) => bytesToHex(node.slot))).toStrictEqual([bytesToHex(expectedSlot)]);
    expect(await network.getRawTransaction(result.broadcast!.txid)).toMatch(/^[0-9a-f]+$/);
  });

  it('settles a chunked mapping value the live list holds beside the append, and broadcasts it', async () => {
    // Both open runs are declared in one segment: the dynamic value's chunk, then the run of chunk records the
    // mapping value takes. A per-call body locates a dynamic run at the ordinal its own arithmetic names and a
    // mapping value's run by address, so the two families are declared in the order the compiler emits them and
    // both settle.
    const seeded = { who: encodeLockingBytecodeP2pkh(alicePkh), name: 'n', bio: 'b', up: 1n };
    const { deployment, network, artifacts, funding } = await deploy(LONG_UPDATE_SOURCE, [seeded.who, seeded], true);
    expect(deployment.initialize.accepted).toBe(true);

    const name = 'n'.repeat(80);
    const bio = 'b'.repeat(80);
    const result = await callPerCallProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'rename',
      args: [seeded.who, { who: seeded.who, name, bio, up: 2n }],
      callerUtxo: funding.callUtxo,
      callerLockingBytecode: funding.deployerLock,
      funder: funding.signature.unlockP2PKH(),
      changeAddress: funding.changeAddress,
      vm: compositionMachine(),
    });
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast).toBeDefined();

    // The value the entry's own body computed, and the run its node takes in the shipped encoders' form.
    const value = encodePushdataValue(
      { who: seeded.who, name, bio, up: 2n }, 'Member', artifacts.Impl!.structs,
    );
    expect(value.length).toBeGreaterThan(60);
    const slot = keyToSlotMulti([seeded.who]);
    const chunkLock = mappingValueChunkLock(
      hexToBin(deployment.proxy.categoryId), 'members', { slot, root: sha256(value) },
    );
    const valueChunks = splitValueIntoValueChunks(value).map(
      (piece, index) => ({ index, commitment: hexToBin(buildValueChunkCommitment(index, piece)) }),
    );
    expect(valueChunks.length).toBeGreaterThan(0);

    // Every value chunk is a trailing output at the value's own collection covenant, carrying its own piece.
    const trailing = result.draft.trailingOutputs;
    expect(trailing).toHaveLength(valueChunks.length);
    trailing.forEach((output, position) => {
      expect(output.output.lockingBytecode).toStrictEqual(chunkLock);
      expect(output.output.token!.nft!.commitment).toStrictEqual(valueChunks[position]!.commitment);
    });

    // The dynamic value's run is the live chunk recreated in place, carrying the array the append grew.
    const grown = encodePushdataValue(
      [funding.deployerLock, funding.deployerLock], 'address[]', artifacts.Impl!.structs,
    );
    const chunkIds = result.draft.layout.participants
      .filter((placed) => placed.id.startsWith('dynamic-chunk-'));
    expect(chunkIds).toHaveLength(1);
    expect(result.transaction.outputs[chunkIds[0]!.index]!.token!.nft!.commitment)
      .toStrictEqual(new Uint8Array(hexToBin(buildChunkCommitment(0, grown))));
    expect(await network.getRawTransaction(result.broadcast!.txid)).toMatch(/^[0-9a-f]+$/);

    // The node the write rewrote carries the value's own tail, read back through the shipped decoder.
    const nodeIds = result.draft.layout.participants.filter((placed) => placed.id.startsWith('mapping-node-'));
    expect(nodeIds).toHaveLength(1);
    const node = decodeEntryCommitment(
      Uint8Array.from(result.transaction.outputs[nodeIds[0]!.index]!.token!.nft!.commitment!));
    expect(bytesToHex(node.slot)).toBe(bytesToHex(slot));
    expect(bytesToHex(node.value)).toBe(bytesToHex(encodeChunkableValueTail(value)));
  });

  it('settles a first insert beside the append, splicing through the head the proxy genesis minted', async () => {
    // The deployment's own entry never writes `members`, but a head is minted only at genesis, so the proxy's
    // genesis minted that collection's empty head beside the record. The call's first insert spends it under the
    // collection covenant and recreates it in place, relinked to the new slot, exactly as a later insert splices
    // through a live node; nothing the call creates is a head.
    const { deployment, network, artifacts, funding } = await deploy(UNSEEDED_REGISTER_SOURCE, [], true);
    expect(deployment.initialize.accepted).toBe(true);

    const name = 'n'.repeat(80);
    const bio = 'b'.repeat(80);
    const result = await callPerCallProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'register',
      args: [FRESH_LOCK, { who: FRESH_LOCK, name, bio, up: 1n }],
      callerUtxo: funding.callUtxo,
      callerLockingBytecode: funding.deployerLock,
      funder: funding.signature.unlockP2PKH(),
      changeAddress: funding.changeAddress,
      vm: compositionMachine(),
    });
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast).toBeDefined();

    // The value the entry's own body computed, and the run its created node takes.
    const value = encodePushdataValue(
      { who: FRESH_LOCK, name, bio, up: 1n }, 'Member', artifacts.Impl!.structs,
    );
    expect(value.length).toBeGreaterThan(60);
    const slot = keyToSlotMulti([FRESH_LOCK]);
    const chunkLock = mappingValueChunkLock(
      hexToBin(deployment.proxy.categoryId), 'members', { slot, root: sha256(value) },
    );
    const valueChunks = splitValueIntoValueChunks(value).map(
      (piece, index) => ({ index, commitment: hexToBin(buildValueChunkCommitment(index, piece)) }),
    );

    // The created node leads the trailing region, then the value's chunks; no head is created.
    const trailing = result.draft.trailingOutputs;
    expect(trailing).toHaveLength(1 + valueChunks.length);
    const created = decodeEntryCommitment(
      Uint8Array.from(result.transaction.outputs[trailing[0]!.index]!.token!.nft!.commitment!));
    expect(bytesToHex(created.slot)).toBe(bytesToHex(slot));
    expect(bytesToHex(created.value)).toBe(bytesToHex(encodeChunkableValueTail(value)));
    trailing.slice(1).forEach((output, position) => {
      expect(output.output.lockingBytecode).toStrictEqual(chunkLock);
      expect(output.output.token!.nft!.commitment).toStrictEqual(valueChunks[position]!.commitment);
    });

    // The head is a participant on the UTXO the proxy's genesis minted, spent and recreated relinked to the slot,
    // and its record states the empty list's sentinel as the view it starts from.
    const headIndex = result.draft.layout.participants
      .find((placed) => placed.id === 'mapping-head-members')!.index;
    expect(binToHex(result.broadcast!.inputs[headIndex]!.outpointTransactionHash)).toBe(deployment.proxy.tx.txid);
    const head = decodeEntryCommitment(
      Uint8Array.from(result.transaction.outputs[headIndex]!.token!.nft!.commitment!));
    expect(bytesToHex(head.slot)).toBe(bytesToHex(new Uint8Array(32)));
    expect(bytesToHex(head.nextKey)).toBe(bytesToHex(slot));
    const block = result.draft.blockOf('implementation-master');
    const headRecord = block.segments[0]!.find((entry) => entry.in === headIndex)!;
    expect(headRecord.out).toBe(headIndex);
    expect(bytesToHex(headRecord.viewIn)).toBe(bytesToHex(headSentinelCommitment()));
    expect(bytesToHex(headRecord.viewOut)).toBe(bytesToHex(
      result.transaction.outputs[headIndex]!.token!.nft!.commitment!));

    // The dynamic run is the live chunk recreated in place, carrying the array the append grew.
    const grown = encodePushdataValue(
      [funding.deployerLock, funding.deployerLock], 'address[]', artifacts.Impl!.structs,
    );
    const chunkIds = result.draft.layout.participants.filter((placed) => placed.id.startsWith('dynamic-chunk-'));
    expect(chunkIds).toHaveLength(1);
    expect(result.transaction.outputs[chunkIds[0]!.index]!.token!.nft!.commitment)
      .toStrictEqual(new Uint8Array(hexToBin(buildChunkCommitment(0, grown))));
    expect(await network.getRawTransaction(result.broadcast!.txid)).toMatch(/^[0-9a-f]+$/);
  });

  it('settles an insert whose value the body builds, the append sizing the run from its own push', async () => {
    // The registration body is the whole shape at once: it builds its struct value from the call's own arguments,
    // inserts it under a key the deployment does not hold, and appends the frame sender. The artifact publishes
    // the append's element for the push beside the construction, so the hop states the run's width and the body's
    // insert and value chunks settle together.
    const seeded = { who: encodeLockingBytecodeP2pkh(alicePkh), name: 'n', bio: 'b', up: 1n };
    const { deployment, network, artifacts, funding }
      = await deploy(CONSTRUCTED_BESIDE_SOURCE, [seeded.who, seeded], true);
    expect(deployment.initialize.accepted).toBe(true);

    const name = 'n'.repeat(80);
    const bio = 'b'.repeat(80);
    const result = await callPerCallProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'register',
      args: [FRESH_LOCK, name, bio],
      callerUtxo: funding.callUtxo,
      callerLockingBytecode: funding.deployerLock,
      funder: funding.signature.unlockP2PKH(),
      changeAddress: funding.changeAddress,
      vm: compositionMachine(),
    });
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast).toBeDefined();

    const value = encodePushdataValue(
      { who: FRESH_LOCK, name, bio, up: 1n }, 'Member', artifacts.Impl!.structs,
    );
    expect(value.length).toBeGreaterThan(60);
    const slot = keyToSlotMulti([FRESH_LOCK]);
    const chunkLock = mappingValueChunkLock(
      hexToBin(deployment.proxy.categoryId), 'members', { slot, root: sha256(value) },
    );
    const valueChunks = splitValueIntoValueChunks(value).map(
      (piece, index) => ({ index, commitment: hexToBin(buildValueChunkCommitment(index, piece)) }),
    );

    // The created node leads the trailing region, then the run the append creates, then the value's chunks.
    const trailing = result.draft.trailingOutputs;
    expect(trailing).toHaveLength(2 + valueChunks.length);
    const created = decodeEntryCommitment(
      Uint8Array.from(result.transaction.outputs[trailing[0]!.index]!.token!.nft!.commitment!));
    expect(bytesToHex(created.slot)).toBe(bytesToHex(slot));
    expect(bytesToHex(created.value)).toBe(bytesToHex(encodeChunkableValueTail(value)));
    const grown = encodePushdataValue([funding.deployerLock], 'address[]', artifacts.Impl!.structs);
    expect(result.transaction.outputs[trailing[1]!.index]!.token!.nft!.commitment)
      .toStrictEqual(new Uint8Array(hexToBin(buildChunkCommitment(0, grown))));
    trailing.slice(2).forEach((output, position) => {
      expect(output.output.lockingBytecode).toStrictEqual(chunkLock);
      expect(output.output.token!.nft!.commitment).toStrictEqual(valueChunks[position]!.commitment);
    });
    expect(await network.getRawTransaction(result.broadcast!.txid)).toMatch(/^[0-9a-f]+$/);
  });

  it('settles a chunking mapping value built from a local the artifact does not state', async () => {
    // The artifact publishes no value source for the write, so the hop cannot size the run its byte length names.
    // The body's own value pin stops on the count it computed and leaves the value and its digest on the machine,
    // so the hop learns the value from that close and re-plans the write's run. Before that learning the hop
    // refused: `... writes mapping "members" a value whose source the artifact does not publish, so this hop
    // cannot tell whether the write needs value chunks`.
    const seeded = { who: encodeLockingBytecodeP2pkh(alicePkh), name: 'n', bio: 'b', up: 1n };
    const { deployment, network, artifacts, funding }
      = await deploy(UNSTATED_VALUE_SOURCE, [seeded.who, seeded], true);
    expect(deployment.initialize.accepted).toBe(true);

    const name = 'n'.repeat(80);
    const bio = 'b'.repeat(80);
    const result = await callPerCallProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'register',
      args: [FRESH_LOCK, name, bio, true],
      callerUtxo: funding.callUtxo,
      callerLockingBytecode: funding.deployerLock,
      funder: funding.signature.unlockP2PKH(),
      changeAddress: funding.changeAddress,
      vm: compositionMachine(),
    });
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast).toBeDefined();

    // The value is the one the body computed: `up_` is 2 because the call's branch was taken.
    const value = encodePushdataValue({ who: FRESH_LOCK, name, bio, up: 2n }, 'Member', artifacts.Impl!.structs);
    expect(value.length).toBeGreaterThan(VALUE_INLINE_LIMIT);
    const slot = keyToSlotMulti([FRESH_LOCK]);
    const chunkLock = mappingValueChunkLock(
      hexToBin(deployment.proxy.categoryId), 'members', { slot, root: sha256(value) },
    );
    const valueChunks = splitValueIntoValueChunks(value).map(
      (piece, index) => ({ index, commitment: hexToBin(buildValueChunkCommitment(index, piece)) }),
    );

    // The created node leads the trailing region, then the run of chunk records the value's length names.
    const trailing = result.draft.trailingOutputs;
    expect(trailing).toHaveLength(1 + valueChunks.length);
    const created = decodeEntryCommitment(
      Uint8Array.from(result.transaction.outputs[trailing[0]!.index]!.token!.nft!.commitment!));
    expect(bytesToHex(created.slot)).toBe(bytesToHex(slot));
    expect(bytesToHex(created.value)).toBe(bytesToHex(encodeChunkableValueTail(value)));
    trailing.slice(1).forEach((output, position) => {
      expect(output.output.lockingBytecode).toStrictEqual(chunkLock);
      expect(output.output.token!.nft!.commitment).toStrictEqual(valueChunks[position]!.commitment);
    });
    expect(await network.getRawTransaction(result.broadcast!.txid)).toMatch(/^[0-9a-f]+$/);
  });
});

/** The live chunks at one lock, in chunk order, each with the bytes its commitment decodes to. */
async function liveChunks(
  network: MockNetworkProvider,
  categoryId: string,
  layout: NonNullable<ReturnType<typeof buildProxyArtifact>['stateLayout']>,
  lock: Uint8Array,
): Promise<readonly { readonly index: number; readonly data: Uint8Array }[]> {
  const pools = await readPerCallDeployment(network, categoryId, layout);
  return [...pools.chunks, ...pools.collectionNodes]
    .filter((utxo) => utxo.lockingBytecode !== undefined
      && bytesToHex(utxo.lockingBytecode) === bytesToHex(lock))
    .map((utxo) => parseChunkCommitment(utxo.token!.nft!.commitment!))
    .map((chunk) => ({ index: chunk.chunkIndex, data: chunk.chunkData }))
    .sort((left, right) => left.index - right.index);
}
