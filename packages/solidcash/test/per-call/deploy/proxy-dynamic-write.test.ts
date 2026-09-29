import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import {
  buildChunkCommitment, buildValueChunkCommitment, bytesToHex, encodeChunkableValueTail, encodePushdataValue,
  parseChunkCommitment, sha256, splitValueIntoValueChunks,
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
import { decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * A proxied initialize that appends one element to a dynamic state array.
 *
 * A dynamic value is not held in the data NFT that declares it: the NFT carries the value's byte length and the
 * bytes live in a run of chunk NFTs at the variable's own collection covenant, addressed from the frame's declared
 * record block. A delegate frame runs on the proxy's records, so the hop has to declare that run — its records and
 * the outputs the transaction writes at their indices — or the body's own address pin reads whatever the hop put at
 * that ordinal and fails. The run's width comes from the value the write produces; its commitments are what the
 * body computed, which the derivation learns from the body's close.
 *
 * The expected commitments here come from the shipped encoders (`encodePushdataValue` for the value,
 * `buildChunkCommitment` for a chunk, `chunkRecordLockingBytecode` for the value's collection covenant), and the
 * record is read back through the shipped pushdata decoder.
 */

const IMPL_CATEGORY = '11'.repeat(32);
const PROXY_CATEGORY = '22'.repeat(32);
const CALLER_TXID = '33'.repeat(32);
const SECOND_CALLER_TXID = '44'.repeat(32);

/** The append the deployment's initialize makes: one element, the frame's own sender. */
const DYNAMIC_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   address[] public items;'
  + '   function initialize() { this.items.push(msg.sender); }'
  + ' }';

/** The same append, made again by a later call against the live array the deployment holds. */
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

/** The marketplace's registration shape: an append beside a struct-valued mapping entry whose value chunks. */
const REGISTER_CALL_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   struct Member { address who; string name; string bio; uint up; }'
  + '   address public implementation;'
  + '   mapping(address => Member) public members;'
  + '   address[] public items;'
  + '   function initialize() { this.items.push(msg.sender); }'
  + '   function register(address who, string name_, string bio_) {'
  + '     require(this.members[who].up == 0);'
  + '     this.members[who] = Member(who, name_, bio_, 1);'
  + '     this.items.push(msg.sender);'
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
  + '   function initialize() {'
  + '     this.members[msg.sender] = Member(msg.sender, "n", "b", 1);'
  + '     this.items.push(msg.sender);'
  + '   }'
  + '   function rename(string name_, string bio_) {'
  + '     this.members[msg.sender] = Member(msg.sender, name_, bio_, 2);'
  + '     this.items.push(msg.sender);'
  + '   }'
  + ' }';

/** The same append beside a sorted-mapping write, which the hop plans as a batch. */
const MAPPING_BESIDE_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   address[] public items;'
  + '   mapping(address => uint) public balances;'
  + '   function initialize(address who) {'
  + '     this.balances[who] = this.balances[who] + 1;'
  + '     this.items.push(msg.sender);'
  + '   }'
  + ' }';

/** An element type whose width the frame does not fix, so the run's width cannot be stated. */
const UNSIZED_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   int[] public items;'
  + '   function initialize() { this.items.push(1); }'
  + ' }';

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
  it('settles the run and broadcasts it, the created chunk carrying the value the entry computed', async () => {
    const { deployment, network, artifacts, layout, funding } = await deploy(DYNAMIC_SOURCE, [], true);

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
    const chunkLock = chunkRecordLockingBytecode(deployment.proxy.categoryId, 'items', 'address[]');
    expect(trailing[0]!.output.lockingBytecode).toStrictEqual(chunkLock);
    expect(deployment.initialize.transaction.outputs[trailing[0]!.index]!.lockingBytecode)
      .toStrictEqual(chunkLock);

    // The record the hop writes carries the value's byte length, from the shipped header encoder.
    const hop = deployment.initialize.broadcast;
    expect(hop).toBeDefined();
    const state = await readPerCallState(network, deployment.proxy.categoryId, layout);
    expect(state.byNft[0]!['items$len']).toBe(BigInt(value.length));
    expect([...state.byNft[0]!.implementation as Uint8Array])
      .toStrictEqual([...deployment.implementation.address]);
    expect(await network.getRawTransaction(hop!.txid)).toMatch(/^[0-9a-f]+$/);
  });

  it('settles the append beside a sorted-mapping write, the node and the chunk both created', async () => {
    const who = encodeLockingBytecodeP2pkh(alicePkh);
    const { deployment, network, artifacts, layout, funding }
      = await deploy(MAPPING_BESIDE_SOURCE, [who], true);

    expect(deployment.initialize.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(deployment.initialize.accepted).toBe(true);

    // The hop declares one created mapping node and one created chunk: two trailing outputs, in that order.
    const trailing = deployment.initialize.draft.trailingOutputs;
    expect(trailing).toHaveLength(2);
    const value = encodePushdataValue([funding.deployerLock], 'address[]', artifacts.Impl!.structs);
    expect(deployment.initialize.transaction.outputs[trailing[1]!.index]!.token!.nft!.commitment)
      .toStrictEqual(new Uint8Array(hexToBin(buildChunkCommitment(0, value))));

    const state = await readPerCallState(network, deployment.proxy.categoryId, layout);
    expect(state.byNft[0]!['items$len']).toBe(BigInt(value.length));
    expect(await network.getRawTransaction(deployment.initialize.broadcast!.txid)).toMatch(/^[0-9a-f]+$/);
  });

  it('refuses an append whose element the frame does not fix, so the run cannot be sized', async () => {
    await expect(deploy(UNSIZED_SOURCE)).rejects.toThrow(
      /writes dynamic "items" \(int256\[\]\) a value whose element this hop cannot state/,
    );
  });

  it('refuses a write whose run is wider than one element, rather than leaving a record unpinned', async () => {
    // Five elements cross the 120-byte chunk boundary, so the body pins a second chunk the hop's one-element run
    // does not declare. The write is refused rather than settled with a record the body never computed.
    const wide = 'pragma solidcash ^0.13.0;'
      + ' contract Impl {'
      + '   address public implementation;'
      + '   address[] public items;'
      + '   function initialize() {'
      + Array.from({ length: 5 }, () => '     this.items.push(msg.sender);').join('')
      + '   }'
      + ' }';
    await expect(deploy(wide)).rejects.toThrow(/did not settle through the proxy/);
  });

  it('keeps the chunk the deployment holds and writes the grown value through a later call', async () => {
    const { deployment, network, artifacts, layout, funding }
      = await deploy(APPEND_CALL_SOURCE, [], true);
    expect(deployment.initialize.accepted).toBe(true);
    const lock = chunkRecordLockingBytecode(deployment.proxy.categoryId, 'items', 'address[]');
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
    expect(deployment.initialize.accepted).toBe(true);

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

  it('settles a chunked mapping value the live list holds beside the append, and broadcasts it', async () => {
    // Both open runs are declared in one segment: the dynamic value's chunk, then the run of chunk records the
    // mapping value takes. A per-call body locates a dynamic run at the ordinal its own arithmetic names and a
    // mapping value's run by address, so the two families are declared in the order the compiler emits them and
    // both settle.
    const { deployment, network, artifacts, funding } = await deploy(LONG_UPDATE_SOURCE, [], true);
    expect(deployment.initialize.accepted).toBe(true);

    const name = 'n'.repeat(80);
    const bio = 'b'.repeat(80);
    const result = await callPerCallProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'rename',
      args: [name, bio],
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
      { who: funding.deployerLock, name, bio, up: 2n }, 'Member', artifacts.Impl!.structs,
    );
    expect(value.length).toBeGreaterThan(60);
    const slot = keyToSlotMulti([funding.deployerLock]);
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

  it('refuses an insert of a mapping target beside the append, naming the record the run addresses', async () => {
    // A target the live list does not hold makes its group two records: the relinked predecessor and the created
    // node. A per-call body derives the dynamic run's ordinal from the batch's operands, which advance past a
    // target's group by one, so the run addresses the created node — whose lock is the entry covenant, not the
    // run's own — and no declared position for the run puts it back. The insert is refused by name.
    const { deployment, network, artifacts, funding } = await deploy(REGISTER_CALL_SOURCE, [], true);
    expect(deployment.initialize.accepted).toBe(true);

    await expect(callPerCallProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'register',
      args: [funding.deployerLock, 'n'.repeat(80), 'b'.repeat(80)],
      callerUtxo: funding.callUtxo,
      callerLockingBytecode: funding.deployerLock,
      funder: funding.signature.unlockP2PKH(),
      changeAddress: funding.changeAddress,
      vm: compositionMachine(),
    })).rejects.toThrow(
      'the implementation\'s "register" entry inserts a mapping target the live list does not hold beside a '
      + 'dynamic value, and an insert group declares the relinked predecessor and the created node, so the '
      + 'ordinal the dynamic run is addressed at names the created node rather than the run',
    );
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
