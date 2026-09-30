import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { bytesToHex, encodeChunkableValueTail, encodePushdataValue } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { encodeFunctionArgument } from '../../../src/Argument.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import {
  mappingValueChunkLock, participant, planMappingBatch, planMappingWrite,
} from '../../../src/per-call/composer/index.js';
import { DEFAULT_MASTER_POOL_SIZE, readPerCallDeployment } from '../../../src/per-call/deploy/index.js';
import { buildProxyArtifact, deployPerCallProxy } from '../../../src/per-call/proxy/index.js';
import { callPerCallProxyEntry } from '../../../src/per-call/proxy/deploy.js';
import { decodeEntryCommitment, headSentinelCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * The sorted-mapping records a proxied `initialize` writes.
 *
 * A delegate frame runs on the proxy's records, so an entry that writes a mapping touches the collection's node
 * UTXOs. The hop has to declare them in the frame's segment: the head sentinel it splices through, recreated in
 * place, and every node it creates as a trailing output. Each node's commitment carries the value the artifact
 * states for the write, so the plan declares it outright rather than learning it from the body's close. The
 * expected commitments here come from the shipped batch planner against the real keys and values.
 */

const IMPL_CATEGORY = '11'.repeat(32);
const PROXY_CATEGORY = '22'.repeat(32);

const SINGLE_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   mapping(string => string) tags;'
  + '   function initialize() { this.tags["DV"] = "DIGITAL_VIDEO"; }'
  + ' }';

/** The marketplace data contract's own eight-key initializer. */
const EIGHT_TAGS: readonly (readonly [string, string])[] = [
  ['DA', 'DIGITAL_AUDIO'], ['DV', 'DIGITAL_VIDEO'], ['DT', 'DIGITAL_TEXT'], ['DS', 'DIGITAL_SOFTWARE'],
  ['DO', 'DIGITAL_OTHERS'], ['NDG', 'NON_DIGITAL_GOODS'], ['NDS', 'NON_DIGITAL_SERVICES'],
  ['NDO', 'NON_DIGITAL_OTHERS'],
];
const EIGHT_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   mapping(string => string) tags;'
  + '   function initialize() {'
  + EIGHT_TAGS.map(([key, value]) => `     this.tags["${key}"] = "${value}";`).join('')
  + '   }'
  + ' }';

/**
 * The read-modify-write shape: the entry reads the key it writes, so the read is what decides whether the write
 * splices a new node in or rewrites the one the key already names.
 */
const COUNTER_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   mapping(address => uint) balances;'
  + '   function initialize(address who) { this.balances[who] = this.balances[who] + 1; }'
  + ' }';

/**
 * A struct value with dynamic fields, written from the entry's own arguments.
 *
 * The struct's pushdata encoding runs past the 60 bytes a node's tail holds inline, so the write keeps the value's
 * length and digest in the node and its bytes in a run of chunk records.
 */
const STRUCT_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   struct User { address who; string name; string bio; int up; int down; }'
  + '   mapping(address => User) users;'
  + '   function initialize(string name_, string bio_) {'
  + '     this.users[msg.sender] = User(msg.sender, name_, bio_, 0, 0);'
  + '   }'
  + ' }';

const STRUCT_NAME = 'n'.repeat(30);
const STRUCT_BIO = 'b'.repeat(30);

const CALLER_TXID = '33'.repeat(32);
const SECOND_CALLER_TXID = '44'.repeat(32);

interface Funding {
  readonly network: MockNetworkProvider;
  readonly signature: SignatureTemplate;
  readonly funder: ReturnType<Contract['unlock']['spend']>;
  readonly implFunding: { txid: string; vout: number; satoshis: bigint };
  readonly proxyFunding: { txid: string; vout: number; satoshis: bigint };
  readonly callerUtxo: { txid: string; vout: number; satoshis: bigint };
  /** A second coin at the deployer's lock, for a call the deployment's own hop did not already spend. */
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
    network, signature,
    funder: funder.unlock.spend(alicePub, signature),
    implFunding, proxyFunding, callerUtxo, callUtxo, deployerLock,
    changeAddress: funder.address,
  };
}

/** Deploys one hop for a mapping-writing initialize, with the implementation's generated proxy. */
async function deploy(
  source: string,
  args: readonly unknown[] = [],
  broadcast = false,
): Promise<{
  readonly deployment: Awaited<ReturnType<typeof deployPerCallProxy>>;
  readonly network: MockNetworkProvider;
  readonly artifacts: ReturnType<typeof compileStringMulti>;
  readonly funding: Funding;
}> {
  const artifacts = compileStringMulti(source, { composition: 'per-call' });
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const funding = await funded(network, broadcast);
  const deployment = await deployPerCallProxy({
    provider: network,
    implementationArtifact: artifacts.Impl!,
    implementationDeploy: { fundingUtxo: funding.implFunding, funder: funding.funder, changeAddress: funding.changeAddress },
    proxyDeploy: { fundingUtxo: funding.proxyFunding, funder: funding.funder, changeAddress: funding.changeAddress },
    initialize: { functionName: 'initialize', args: args as never },
    callerLockingBytecode: funding.deployerLock,
    ...(broadcast
      ? { callerFunding: { utxo: funding.callerUtxo, funder: funding.signature.unlockP2PKH() } }
      : {}),
    vm: compositionMachine(),
  });
  return { deployment, network, artifacts, funding };
}

let counterRun: ReturnType<typeof deploy> | undefined;

/** The broadcast read-modify-write deployment the last two cases read; only the second spends from it. */
function counterDeployment(): ReturnType<typeof deploy> {
  counterRun ??= deploy(COUNTER_SOURCE, [encodeLockingBytecodeP2pkh(alicePkh)], true);
  return counterRun;
}

describe('a proxied initialize that writes a sorted mapping', () => {
  it('settles the reduced write, the created node carrying the commitment the entry computed', async () => {
    const { deployment } = await deploy(SINGLE_SOURCE);

    expect(deployment.initialize.completed.map((frame) => frame.functionName))
      .toStrictEqual(['Impl.initialize()', 'ImplProxy.__fallback()']);
    expect(deployment.initialize.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(deployment.initialize.accepted).toBe(true);

    // The shipped planner's own value for the write, which is what the entry's body computed.
    const expected = planMappingWrite({
      keys: [new TextEncoder().encode('DV')],
      value: new TextEncoder().encode('DIGITAL_VIDEO'),
      inventory: [headSentinelCommitment()],
      encodeValue: encodeChunkableValueTail,
    }).written[1]!.after;

    // The created node is a trailing output, and the frame declares it at the index the transaction carries it.
    const trailing = deployment.initialize.draft.trailingOutputs;
    expect(trailing).toHaveLength(1);
    expect(bytesToHex(trailing[0]!.output.token!.nft!.commitment)).toBe(bytesToHex(expected));
    expect(bytesToHex(deployment.initialize.transaction.outputs[trailing[0]!.index]!.token!.nft!.commitment))
      .toBe(bytesToHex(expected));
    // The node's slot is the key's, so it is the entry's own write rather than some other record.
    expect(bytesToHex(decodeEntryCommitment(expected).slot))
      .toBe(bytesToHex(keyToSlotMulti([new TextEncoder().encode('DV')])));

    // The head sentinel is spent under the collection covenant and recreated with the relinked commitment.
    const head = deployment.initialize.draft.layout.participants
      .find((placed) => placed.id.startsWith('mapping-head-'))!.index;
    expect(bytesToHex(deployment.initialize.transaction.outputs[head]!.token!.nft!.commitment))
      .not.toBe(bytesToHex(headSentinelCommitment()));
  });

  it('refuses a write whose value the artifact publishes no source for', async () => {
    const computed = 'pragma solidcash ^0.13.0;'
      + ' contract Impl {'
      + '   mapping(string => string) tags;'
      + '   function initialize(string a, string b) { this.tags["DA"] = a + b; }'
      + ' }';
    await expect(deploy(computed, ['x', 'y'])).rejects.toThrow(
      /writes mapping "tags" a value whose source the artifact does not publish/,
    );
  });

  it('settles the eight-key initializer the marketplace data contract publishes', async () => {
    const { deployment, network, artifacts } = await deploy(EIGHT_SOURCE);

    expect(deployment.initialize.completed.map((frame) => frame.functionName))
      .toStrictEqual(['Impl.initialize()', 'ImplProxy.__fallback()']);
    expect(deployment.initialize.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(deployment.initialize.accepted).toBe(true);

    const encoder = new TextEncoder();
    const plan = planMappingBatch({
      writes: EIGHT_TAGS.map(([key, value]) => ({ keys: [encoder.encode(key)], value: encoder.encode(value) })),
      inventory: [headSentinelCommitment()],
      encodeValue: encodeChunkableValueTail,
    });
    const created = plan.written.filter((node) => !node.existed);
    const trailing = deployment.initialize.draft.trailingOutputs;
    expect(trailing).toHaveLength(created.length);
    trailing.forEach((output, position) => {
      expect(bytesToHex(output.output.token?.nft?.commitment ?? '')).toBe(bytesToHex(created[position]!.after));
    });

    // The proxy genesis minted the collection's empty head, and the deployment reads it back as a collection node
    // rather than folding it into the validator pool.
    const proxyLayout = buildProxyArtifact(artifacts.Impl!).stateLayout!;
    const pools = await readPerCallDeployment(network, deployment.proxy.categoryId, proxyLayout);
    expect(pools.collectionNodes.map((node) => node.token?.nft?.commitment))
      .toStrictEqual([binToHex(headSentinelCommitment())]);
    expect(pools.validators).toHaveLength(DEFAULT_MASTER_POOL_SIZE.validators);
    expect(pools.records).toHaveLength(1);
  });

  it('broadcasts the eight-key initializer, spending the head the proxy genesis minted', async () => {
    const { deployment, network } = await deploy(EIGHT_SOURCE, [], true);

    expect(deployment.initialize.accepted).toBe(true);
    const hop = deployment.initialize.broadcast;
    expect(hop).toBeDefined();

    // The head participant sits on the UTXO the proxy's genesis minted, so the hop spends the empty head and
    // recreates it as the collection's first node.
    const headId = deployment.initialize.draft.layout.participants
      .find((placed) => placed.id.startsWith('mapping-head-'))!.id;
    const headIndex = participant(deployment.initialize.draft.layout, headId).index;
    expect(binToHex(hop!.inputs[headIndex]!.outpointTransactionHash)).toBe(deployment.proxy.tx.txid);
    expect(headId).toBe('mapping-head-tags');

    const encoder = new TextEncoder();
    const plan = planMappingBatch({
      writes: EIGHT_TAGS.map(([key, value]) => ({ keys: [encoder.encode(key)], value: encoder.encode(value) })),
      inventory: [headSentinelCommitment()],
      encodeValue: encodeChunkableValueTail,
    });
    // The head is recreated with the commitment the batch relinked it to, and every created node its own.
    expect(bytesToHex(hop!.outputs[headIndex]!.token!.nft!.commitment))
      .toBe(bytesToHex(plan.written.find((node) => node.existed)!.after));
    const created = plan.written.filter((node) => !node.existed);
    created.forEach((node, position) => {
      const output = deployment.initialize.draft.trailingOutputs[position]!;
      expect(bytesToHex(hop!.outputs[output.index]!.token!.nft!.commitment)).toBe(bytesToHex(node.after));
    });
    expect(await network.getRawTransaction(hop!.txid)).toMatch(/^[0-9a-f]+$/);
  });

  it('settles a struct value past the inline limit, declaring the run of chunks it wrote', async () => {
    const { deployment, network, artifacts, funding } = await deploy(STRUCT_SOURCE, [STRUCT_NAME, STRUCT_BIO], true);

    expect(deployment.initialize.completed.map((frame) => frame.functionName))
      .toStrictEqual(['Impl.initialize()', 'ImplProxy.__fallback()']);
    expect(deployment.initialize.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(deployment.initialize.accepted).toBe(true);

    // The value the entry's own body computed from its caller and arguments, in the shipped struct encoding, and
    // the node and chunk records the shipped batch planner derives from it.
    const value = encodePushdataValue(
      { who: funding.deployerLock, name: STRUCT_NAME, bio: STRUCT_BIO, up: 0n, down: 0n },
      'User', artifacts.Impl!.structs,
    );
    expect(value.length).toBeGreaterThan(60);
    const who = encodeFunctionArgument(funding.deployerLock, 'address') as Uint8Array;
    const plan = planMappingBatch({
      writes: [{ keys: [who], value }],
      inventory: [headSentinelCommitment()],
      encodeValue: encodeChunkableValueTail,
      chunkable: (raw) => raw,
    });
    expect(plan.chunks.length).toBeGreaterThan(0);

    // The created node is the first created record, its tail carrying the value's length and digest; the run of
    // chunks follows it at the value's own collection covenant, each carrying the bytes past the node's head.
    const created = plan.written.filter((node) => !node.existed);
    const trailing = deployment.initialize.draft.trailingOutputs;
    expect(trailing).toHaveLength(created.length + plan.chunks.length);
    expect(bytesToHex(trailing[0]!.output.token!.nft!.commitment)).toBe(bytesToHex(created[0]!.after));
    expect(bytesToHex(decodeEntryCommitment(created[0]!.after).slot)).toBe(bytesToHex(keyToSlotMulti([who])));
    const users = artifacts.Impl!.stateLayout!.collections!.find((collection) => collection.name === 'users')!.name;
    plan.chunks.forEach((chunk, position) => {
      const output = trailing[created.length + position]!;
      expect(bytesToHex(output.output.token!.nft!.commitment)).toBe(bytesToHex(chunk.commitment));
      const chunkLock = mappingValueChunkLock(hexToBin(PROXY_CATEGORY), users, chunk);
      expect(bytesToHex(output.output.lockingBytecode)).toBe(bytesToHex(chunkLock));
    });

    const hop = deployment.initialize.broadcast;
    expect(hop).toBeDefined();
    expect(await network.getRawTransaction(hop!.txid)).toMatch(/^[0-9a-f]+$/);
  });

  it('settles a read-modify-write initializer, creating the node at the value its own read produced', async () => {
    const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);
    const { deployment, network } = await counterDeployment();

    expect(deployment.initialize.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(deployment.initialize.accepted).toBe(true);

    // `balances[who]` reads as zero in the empty list, so the entry's own body computes one for the node it creates.
    const who = encodeFunctionArgument(deployerLock, 'address') as Uint8Array;
    const value = encodeFunctionArgument(1n, 'uint256') as Uint8Array;
    const plan = planMappingBatch({
      writes: [{ keys: [who], value }],
      inventory: [headSentinelCommitment()],
      encodeValue: (tail: Uint8Array) => tail,
    });
    const created = plan.written.find((node) => !node.existed)!;
    const trailing = deployment.initialize.draft.trailingOutputs;
    expect(trailing).toHaveLength(1);
    expect(bytesToHex(trailing[0]!.output.token!.nft!.commitment)).toBe(bytesToHex(created.after));
    // The node's slot is the key's, so the created node is the entry's own write.
    expect(bytesToHex(decodeEntryCommitment(created.after).slot)).toBe(bytesToHex(keyToSlotMulti([who])));

    // The empty head is spent and recreated relinked to the created node's slot, and the hop is broadcast.
    const headIndex = deployment.initialize.draft.layout.participants
      .find((placed) => placed.id.startsWith('mapping-head-'))!.index;
    expect(bytesToHex(deployment.initialize.transaction.outputs[headIndex]!.token!.nft!.commitment))
      .toBe(bytesToHex(plan.written.find((node) => node.existed)!.after));
    const hop = deployment.initialize.broadcast;
    expect(hop).toBeDefined();
    expect(binToHex(hop!.inputs[headIndex]!.outpointTransactionHash)).toBe(deployment.proxy.tx.txid);
    expect(await network.getRawTransaction(hop!.txid)).toMatch(/^[0-9a-f]+$/);
  });

  it('rewrites the key the collection already holds in place, through the hop a later call takes', async () => {
    const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);
    const { deployment, network, artifacts, funding } = await counterDeployment();
    expect(deployment.initialize.accepted).toBe(true);

    // The call reads the node the deployment's hop created and writes the value it computed back: an update, with
    // nothing created, so the spent node is the one the key names and it is recreated where it stands.
    const result = await callPerCallProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'initialize',
      args: [deployerLock],
      callerUtxo: funding.callUtxo,
      callerLockingBytecode: deployerLock,
      funder: funding.signature.unlockP2PKH(),
      changeAddress: funding.changeAddress,
      vm: compositionMachine(),
    });

    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    const nodeIds = result.draft.layout.participants.filter((placed) => placed.id.startsWith('mapping-node-'));
    expect(nodeIds).toHaveLength(1);
    expect(result.draft.trailingOutputs).toHaveLength(0);

    const who = encodeFunctionArgument(deployerLock, 'address') as Uint8Array;
    const written = decodeEntryCommitment(
      Uint8Array.from(result.transaction.outputs[nodeIds[0]!.index]!.token!.nft!.commitment!));
    expect(bytesToHex(written.slot)).toBe(bytesToHex(keyToSlotMulti([who])));
    expect(bytesToHex(written.value)).toBe(bytesToHex(encodeFunctionArgument(2n, 'uint256') as Uint8Array));
    expect(result.broadcast).toBeDefined();
  });
});
