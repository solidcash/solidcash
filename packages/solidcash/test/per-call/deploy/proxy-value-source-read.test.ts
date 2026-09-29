import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { bytesToHex, decodePushdataValue } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { readPerCallDeployment } from '../../../src/per-call/deploy/index.js';
import { buildProxyArtifact, deployPerCallProxy } from '../../../src/per-call/proxy/index.js';
import { callPerCallProxyEntry } from '../../../src/per-call/proxy/deploy.js';
import { decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

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
): Promise<Record<string, unknown> | undefined> {
  const layout = buildProxyArtifact(compileStringMulti(SOURCE, { composition: 'per-call' }).Impl!).stateLayout!;
  const pools = await readPerCallDeployment(network, categoryId, layout);
  const slot = bytesToHex(keyToSlotMulti([key]));
  const node = pools.collectionNodes.find((candidate) => {
    const commitment = candidate.token?.nft?.commitment;
    return commitment !== undefined
      && bytesToHex(decodeEntryCommitment(hexToBin(commitment)).slot) === slot;
  });
  if (node === undefined) return undefined;
  const tail = decodeEntryCommitment(hexToBin(node.token!.nft!.commitment)).value;
  // A chunkable collection's tail is a four-byte length followed by the value while the value fits inline.
  const length = new DataView(tail.buffer, tail.byteOffset, 4).getUint32(0, true);
  const raw = tail.slice(4, 4 + length);
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

  it('refuses a field read out of a node whose value lives in continuation chunks', async () => {
    // A struct whose named field is long enough that the node's value crosses the inline limit: its bytes live in
    // continuation chunks the hop is not handed, so the field cannot be read back and the write is refused.
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

    await expect(callPerCallProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'rename',
      args: [funding.deployerLock, long],
      callerUtxo: funding.callUtxo,
      callerLockingBytecode: funding.deployerLock,
      funder: funding.signature.unlockP2PKH(),
      changeAddress: funding.changeAddress,
      vm: compositionMachine(),
    })).rejects.toThrow(/whose value lives in continuation chunks this hop is not handed/);
  });
});
