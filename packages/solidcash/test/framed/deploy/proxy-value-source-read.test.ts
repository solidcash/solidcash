import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { bytesToHex, decodePushdataValue, joinValueChunks, parseValueChunkCommitment, VALUE_HEAD_SIZE } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { mappingValueChunkLock } from '../../../src/framed/composer/index.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry } from '../../../src/framed/proxy/deploy.js';
import { bytesToSlotValue, decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A proxied call whose mapping value is built from fields of the node it writes.
 *
 * An entry that leaves a struct's fields as they were publishes a value source that reads them back out of the
 * entry's own node (`field:<name>(map:<collection>(<key>))`) and composes the result with the fields it changes.
 * The hop has to state the whole value because the collection's node tail holds its byte length, so it decodes the
 * node the key names through the shipped entry-commitment and pushdata decoders and folds the source's fields in
 * declaration order. A field the node does not hold, or a node whose value lives in continuation chunks the hop is
 * not handed, is refused by name rather than guessed. A field read of another key's node is declared kept beside the
 * write, and refused by name when its key is the one the write writes.
 *
 * The expectation is read back out of the node the call wrote with the same shipped decoder.
 */

const IMPL_CATEGORY = '11'.repeat(31) + 'ee';
const PROXY_CATEGORY = '22'.repeat(31) + 'dd';
const CALLER_TXID = '33'.repeat(31) + 'cc';
const SECOND_CALLER_TXID = '44'.repeat(31) + 'bb';

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Impl {'
  + '   struct Member { address who; uint up; uint down; }'
  + '   address public implementation;'
  + '   mapping(address => Member) public members;'
  + '   function initialize(address who) { this.members[who] = Member(who, 1, 0); }'
  + '   function bump(address who) { this.members[who].up = this.members[who].up + 1; }'
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
  // The hop broadcasts, so each composition's facet input needs a live UTXO at the facet's lock.
  await fundShippedFacets(network);
  await network.addUtxo(binToHex(deployerLock), callerUtxo);
  await network.addUtxo(binToHex(deployerLock), callUtxo);
  return {
    network, signature, funder: funder.unlock.spend(alicePub, signature),
    implFunding, proxyFunding, callerUtxo, callUtxo, deployerLock, changeAddress: funder.address,
  };
}

/** The raw value the collection's node for a key holds, decoded out of the live deployment. */
async function heldValue(
  network: MockNetworkProvider,
  categoryId: string,
  key: Uint8Array,
  valueType: string,
  structs: ReturnType<typeof compileStringMulti>[string]['structs'],
  source = SOURCE,
): Promise<Record<string, unknown> | undefined> {
  const layout = buildProxyArtifact(compileStringMulti(source, { composition: 'framed' }).Impl!).stateLayout!;
  const pools = await readFramedDeployment(network, categoryId, layout);
  const slot = bytesToHex(keyToSlotMulti([key]));
  const node = pools.collectionNodes.find((candidate) => {
    const commitment = candidate.token?.nft?.commitment;
    return commitment !== undefined
      && bytesToHex(decodeEntryCommitment(hexToBin(commitment)).slot) === slot;
  });
  if (node === undefined) return undefined;
  const tail = decodeEntryCommitment(hexToBin(node.token!.nft!.commitment)).value;
  // A chunkable collection's tail is a four-byte length followed, while the value fits, by the value itself; a
  // longer value keeps a digest and its first bytes there and the rest in chunks at the value's own covenant.
  const length = new DataView(tail.buffer, tail.byteOffset, 4).getUint32(0, true);
  const raw = tail.length === 4 + length
    ? tail.slice(4)
    : (() => {
      const root = tail.slice(4, 36);
      const lock = bytesToHex(mappingValueChunkLock(
        hexToBin(categoryId), 'members', { slot: hexToBin(slot), root },
      ));
      const chunks = [...pools.chunks, ...pools.collectionNodes]
        .filter((utxo) => utxo.lockingBytecode !== undefined
          && bytesToHex(utxo.lockingBytecode) === lock)
        .map((utxo) => parseValueChunkCommitment(utxo.token!.nft!.commitment!))
        .sort((left, right) => left.chunkIndex - right.chunkIndex);
      return joinValueChunks(tail.slice(36, 36 + VALUE_HEAD_SIZE), chunks, length);
    })();
  return decodePushdataValue(raw, 0, valueType, structs).value as Record<string, unknown>;
}

/** An entry that reads the mapping under one key and writes it under the caller's: two mapping entries. */
const DETACHED = 'pragma solidcash ^0.14.0;'
  + ' contract Impl {'
  + '   struct Member { address who; uint up; uint down; }'
  + '   address public implementation;'
  + '   mapping(address => Member) public members;'
  + '   function initialize(address who) { this.members[who] = Member(who, 1, 0); }'
  + '   function bump(address who) { this.members[msg.sender].up = this.members[who].up + 1; }'
  + ' }';

const DEPLOYER = encodeLockingBytecodeP2pkh(alicePkh);

/** A holder whose key's slot lies above the deployer's, so no insert of the deployer's key splices through it. */
const HELD_ABOVE_DEPLOYER = ((): Uint8Array => {
  const deployer = bytesToSlotValue(keyToSlotMulti([DEPLOYER]));
  for (let seed = 1; seed < 64; seed += 1) {
    const lock = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(seed));
    if (bytesToSlotValue(keyToSlotMulti([lock])) > deployer) return lock;
  }
  throw new Error('no holder above the deployer');
})();

/** Deploys `DETACHED` with `who`'s member written, and calls `bump(who)` from the deployer. */
async function bumpDetached(who: Uint8Array): Promise<{
  readonly network: MockNetworkProvider;
  readonly categoryId: string;
  readonly structs: ReturnType<typeof compileStringMulti>[string]['structs'];
  readonly call: ReturnType<typeof callFramedProxyEntry>;
}> {
  const artifact = compileStringMulti(DETACHED, { composition: 'framed' }).Impl!;
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const funding = await funded(network);
  const deployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: artifact,
    implementationDeploy: {
      fundingUtxo: funding.implFunding, funder: funding.funder, changeAddress: funding.changeAddress,
    },
    proxyDeploy: {
      fundingUtxo: funding.proxyFunding, funder: funding.funder, changeAddress: funding.changeAddress,
    },
    initialize: { functionName: 'initialize', args: [who] },
    callerLockingBytecode: funding.deployerLock,
    callerFunding: { utxo: funding.callerUtxo, funder: funding.signature.unlockP2PKH() },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.accepted).toBe(true);
  const call = callFramedProxyEntry({
    provider: network,
    implementationArtifact: artifact,
    proxyCategoryId: deployment.proxy.categoryId,
    implementationCategoryId: deployment.implementation.categoryId,
    functionName: 'bump',
    args: [who],
    callerUtxo: funding.callUtxo,
    callerLockingBytecode: funding.deployerLock,
    funder: funding.signature.unlockP2PKH(),
    changeAddress: funding.changeAddress,
    vm: compositionMachine(),
  });
  return { network, categoryId: deployment.proxy.categoryId, structs: artifact.structs, call };
}

describe('a proxied call whose mapping value is built from the node it writes', () => {
  it('settles the read-modify-write and broadcasts it, the node carrying the composed value', async () => {
    const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funding = await funded(network);

    // The deployment's initialize writes the node; its value source is the struct over the entry's own argument.
    const deployment = await deployFramedProxy({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      implementationDeploy: {
        fundingUtxo: funding.implFunding, funder: funding.funder, changeAddress: funding.changeAddress,
      },
      proxyDeploy: {
        fundingUtxo: funding.proxyFunding, funder: funding.funder, changeAddress: funding.changeAddress,
      },
      initialize: { functionName: 'initialize', args: [funding.deployerLock] },
      callerLockingBytecode: funding.deployerLock,
      callerFunding: { utxo: funding.callerUtxo, funder: funding.signature.unlockP2PKH() },
      vm: compositionMachine(),
    });
    expect(deployment.initialize.accepted).toBe(true);
    const before = await heldValue(
      network, deployment.proxy.categoryId, funding.deployerLock, 'Member', artifacts.Impl!.structs);
    expect(before?.up).toBe(1n);
    expect(before?.down).toBe(0n);

    // The call composes its value from the fields the live node holds: only `up` moves.
    const result = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'bump',
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

    const after = await heldValue(
      network, deployment.proxy.categoryId, funding.deployerLock, 'Member', artifacts.Impl!.structs);
    expect(after?.up).toBe(2n);
    expect(after?.down).toBe(0n);
    expect([...after?.who as Uint8Array]).toStrictEqual([...funding.deployerLock]);
    expect(await network.getRawTransaction(result.broadcast!.txid)).toMatch(/^[0-9a-f]+$/);
  });

  it('reads a field out of a node whose value lives in continuation chunks, and witnesses the read', async () => {
    // A struct whose named field is long enough that the node's value crosses the inline limit: its bytes live in
    // continuation chunks, so the hop reassembles the node's whole value from them to compose the write, and hands
    // the same value to the frame's block as the value witness the body's own read takes.
    const long = 'n'.repeat(100);
    const longSource = 'pragma solidcash ^0.14.0;'
      + ' contract Impl {'
      + '   struct Member { address who; string name; uint up; }'
      + '   address public implementation;'
      + '   mapping(address => Member) public members;'
      + '   function initialize(address who, string name_) { this.members[who] = Member(who, name_, 1); }'
      + '   function rename(address who, string name_) { this.members[who].name = name_; }'
      + ' }';
    const artifacts = compileStringMulti(longSource, { composition: 'framed' });
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
      initialize: { functionName: 'initialize', args: [funding.deployerLock, long] },
      callerLockingBytecode: funding.deployerLock,
      callerFunding: { utxo: funding.callerUtxo, funder: funding.signature.unlockP2PKH() },
      vm: compositionMachine(),
    });
    expect(deployment.initialize.accepted).toBe(true);

    const renamed = 'm'.repeat(100);
    const result = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'rename',
      args: [funding.deployerLock, renamed],
      callerUtxo: funding.callUtxo,
      callerLockingBytecode: funding.deployerLock,
      funder: funding.signature.unlockP2PKH(),
      changeAddress: funding.changeAddress,
      vm: compositionMachine(),
    });
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast).toBeDefined();

    // The frame lists the value witness its body reads, and the composed node carries the renamed value with the
    // fields the node already held.
    const after = await heldValue(
      network, deployment.proxy.categoryId, funding.deployerLock, 'Member', artifacts.Impl!.structs);
    expect(after?.name).toBe(renamed);
    expect(after?.up).toBe(1n);
    expect([...after?.who as Uint8Array]).toStrictEqual([...funding.deployerLock]);
    expect(await network.getRawTransaction(result.broadcast!.txid)).toMatch(/^[0-9a-f]+$/);
  });

  it('composes a field read of another key\'s node beside the write, which keeps that node', async () => {
    // The member read is held above the caller's key, so the caller's member is inserted through the head and the
    // read's node is one the batch does not spend: the frame declares it kept ahead of the batch.
    const { network, categoryId, structs, call } = await bumpDetached(HELD_ABOVE_DEPLOYER);
    const result = await call;
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast).toBeDefined();

    // The caller's new member takes `up` from the member read, which is left as it was.
    const caller = await heldValue(network, categoryId, DEPLOYER, 'Member', structs, DETACHED);
    expect(caller?.up).toBe(2n);
    expect(caller?.down).toBe(0n);
    const read = await heldValue(network, categoryId, HELD_ABOVE_DEPLOYER, 'Member', structs, DETACHED);
    expect(read?.up).toBe(1n);
    expect([...read?.who as Uint8Array]).toStrictEqual([...HELD_ABOVE_DEPLOYER]);
  });

  it('refuses a field read under the key its own write writes, which the frame reads before the write', async () => {
    // The read key is the caller's, which the batch rewrites: the frame would read it as its segment began.
    const { call } = await bumpDetached(DEPLOYER);
    await expect(call).rejects.toThrow(
      'the implementation\'s "bump" entry reads mapping "members" under a key its batch also writes, which its '
      + 'frame reads as the segment began, before the write, whichever comes first in the source',
    );
  });
});
