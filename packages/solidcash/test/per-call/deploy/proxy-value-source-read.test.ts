import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { bytesToHex, decodePushdataValue, joinValueChunks, parseValueChunkCommitment, VALUE_HEAD_SIZE } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { readPerCallDeployment } from '../../../src/per-call/deploy/index.js';
import { mappingValueChunkLock } from '../../../src/per-call/composer/index.js';
import { buildProxyArtifact, deployPerCallProxy } from '../../../src/per-call/proxy/index.js';
import { callPerCallProxyEntry } from '../../../src/per-call/proxy/deploy.js';
import { decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
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
 * not handed, is refused by name rather than guessed.
 *
 * The expectation is read back out of the node the call wrote with the same shipped decoder.
 */

const IMPL_CATEGORY = '11'.repeat(32);
const PROXY_CATEGORY = '22'.repeat(32);
const CALLER_TXID = '33'.repeat(32);
const SECOND_CALLER_TXID = '44'.repeat(32);

const SOURCE = 'pragma solidcash ^0.13.0;'
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
  const layout = buildProxyArtifact(compileStringMulti(source, { composition: 'per-call' }).Impl!).stateLayout!;
  const pools = await readPerCallDeployment(network, categoryId, layout);
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

describe('a proxied call whose mapping value is built from the node it writes', () => {
  it('settles the read-modify-write and broadcasts it, the node carrying the composed value', async () => {
    const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funding = await funded(network);

    // The deployment's initialize writes the node; its value source is the struct over the entry's own argument.
    const deployment = await deployPerCallProxy({
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
    const result = await callPerCallProxyEntry({
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
    const longSource = 'pragma solidcash ^0.13.0;'
      + ' contract Impl {'
      + '   struct Member { address who; string name; uint up; }'
      + '   address public implementation;'
      + '   mapping(address => Member) public members;'
      + '   function initialize(address who, string name_) { this.members[who] = Member(who, name_, 1); }'
      + '   function rename(address who, string name_) { this.members[who].name = name_; }'
      + ' }';
    const artifacts = compileStringMulti(longSource, { composition: 'per-call' });
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funding = await funded(network);
    const deployment = await deployPerCallProxy({
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
    const result = await callPerCallProxyEntry({
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

  it('refuses a field read the master cannot derive operands for, rather than composing a partial value', async () => {
    // The entry reads the mapping under one key and writes it under another: two mapping entries, one of them
    // written. The hop declares only the batch's records, so it refuses the read beside it by name.
    const detached = 'pragma solidcash ^0.13.0;'
      + ' contract Impl {'
      + '   struct Member { address who; uint up; uint down; }'
      + '   address public implementation;'
      + '   mapping(address => Member) public members;'
      + '   function initialize(address who) { this.members[who] = Member(who, 1, 0); }'
      + '   function bump(address who) { this.members[msg.sender].up = this.members[who].up + 1; }'
      + ' }';
    const detachedArtifacts = compileStringMulti(detached, { composition: 'per-call' });
    const detachedNetwork = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const detachedFunding = await funded(detachedNetwork);
    const detachedDeployment = await deployPerCallProxy({
      provider: detachedNetwork,
      implementationArtifact: detachedArtifacts.Impl!,
      implementationDeploy: {
        fundingUtxo: detachedFunding.implFunding, funder: detachedFunding.funder,
        changeAddress: detachedFunding.changeAddress,
      },
      proxyDeploy: {
        fundingUtxo: detachedFunding.proxyFunding, funder: detachedFunding.funder,
        changeAddress: detachedFunding.changeAddress,
      },
      initialize: { functionName: 'initialize', args: [detachedFunding.deployerLock] },
      callerLockingBytecode: detachedFunding.deployerLock,
      callerFunding: { utxo: detachedFunding.callerUtxo, funder: detachedFunding.signature.unlockP2PKH() },
      vm: compositionMachine(),
    });
    await expect(callPerCallProxyEntry({
      provider: detachedNetwork,
      implementationArtifact: detachedArtifacts.Impl!,
      proxyCategoryId: detachedDeployment.proxy.categoryId,
      implementationCategoryId: detachedDeployment.implementation.categoryId,
      functionName: 'bump',
      args: [detachedFunding.deployerLock],
      callerUtxo: detachedFunding.callUtxo,
      callerLockingBytecode: detachedFunding.deployerLock,
      funder: detachedFunding.signature.unlockP2PKH(),
      changeAddress: detachedFunding.changeAddress,
      vm: compositionMachine(),
    })).rejects.toThrow(
      'the implementation\'s "bump" entry reads mapping "members" beside the batch it writes, which this hop does not '
      + 'declare',
    );
  });
});
