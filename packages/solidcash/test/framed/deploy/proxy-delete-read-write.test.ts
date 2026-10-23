import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { bytesToHex, encodeChunkableValueTail } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry } from '../../../src/framed/proxy/deploy.js';
import { decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A proxied delete of a sorted-mapping key, guarded by a branch and unguarded.
 *
 * A `delete m[k]` lowered inside a branch is emitted as an existence-gated soft-delete write: the entry's block
 * slot carries `conditional` and `softDelete`, and the body verifies the write by reading the entry's *output*
 * coordinate. The unguarded delete lowers to a plain in-place write, which the hop settles.
 *
 * The guarded body settles through the proxy: the compiler verifies that delete by reading the entry's *output* at
 * the coordinate the frame declares for the record (a sorted batch's node, recreated where it was spent, at the
 * co-spent proof input's own index), the same branch the entry input already takes, so the close agrees with the
 * node the hop publishes and the derivation converges. The unguarded body beside it settles the same removal
 * through the in-place write.
 */

const IMPL_CATEGORY = '11'.repeat(31) + 'ee';
const PROXY_CATEGORY = '22'.repeat(31) + 'dd';
const CALLER_TXID = '33'.repeat(31) + 'cc';
const SECOND_CALLER_TXID = '44'.repeat(31) + 'bb';

/** The body whose delete sits inside a branch: the compiler publishes it as a conditional soft-delete slot. */
const GUARDED_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Impl {'
  + '   address public owner;'
  + '   address external keeper;'
  + '   mapping(string => string) public tags;'
  + '   function initialize(string key, string tag) { this.owner = msg.sender; this.tags[key] = tag; }'
  + '   function untag(string key) {'
  + '     require(this.owner != address(0), "no owner");'
  + '     if (bytes(this.tags[key]).length != 0) { delete this.tags[key]; }'
  + '   }'
  + ' }';

/** The same removal with no branch: the shipped in-place write of the value type's default. */
const PLAIN_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Impl {'
  + '   address public owner;'
  + '   address external keeper;'
  + '   mapping(string => string) public tags;'
  + '   function initialize(string key, string tag) { this.owner = msg.sender; this.tags[key] = tag; }'
  + '   function untag(string key) {'
  + '     require(this.owner != address(0), "no owner");'
  + '     delete this.tags[key];'
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

/** Deploys the implementation and proxy, running the initializer that writes the tag the call later removes. */
async function deploy(
  source: string, funding: Funding, key: string, tag: string,
): Promise<ReturnType<typeof deployFramedProxy>> {
  const artifacts = compileStringMulti(source, { composition: 'framed' });
  return deployFramedProxy({
    provider: funding.network,
    implementationArtifact: artifacts.Impl!,
    implementationDeploy: {
      fundingUtxo: funding.implFunding, funder: funding.funder, changeAddress: funding.changeAddress,
    },
    proxyDeploy: {
      fundingUtxo: funding.proxyFunding, funder: funding.funder, changeAddress: funding.changeAddress,
    },
    initialize: { functionName: 'initialize', args: [key, tag] },
    callerLockingBytecode: funding.deployerLock,
    callerFunding: { utxo: funding.callerUtxo, funder: funding.signature.unlockP2PKH() },
    vm: compositionMachine(),
  });
}

describe('a proxied delete of a sorted-mapping key', () => {
  it('publishes a branch-guarded delete as a conditional soft-delete slot', () => {
    const artifacts = compileStringMulti(GUARDED_SOURCE, { composition: 'framed' });
    const entry = artifacts.Impl!.abi.find((candidate) => candidate.name === 'untag')!;
    // The branch marks the entry slot conditional and soft: the SDK must not statically drop the guarded delete.
    const slot = entry.blockLayout!.slots.find((candidate) => candidate.kind === 'entry')!;
    expect(slot.conditional).toBe(true);
    expect(slot.softDelete).toBe(true);
    expect(entry.entryAccesses!.map((access) => access.operations)).toStrictEqual([['read', 'delete']]);
    // The implementation's record block declares one data NFT (the guarded body reads only nft 0), so the entry
    // sits at block offset two while the proxy's record block holds three records before the node.
    expect(entry.blockLayout!.slots.map((candidate) => candidate.kind))
      .toStrictEqual(['master', 'dataNft', 'entry']);
  });

  it('settles the branch-guarded delete through the proxy, rewriting the node to the default tail', async () => {
    const encoder = new TextEncoder();
    const key = 'DV';
    const artifacts = compileStringMulti(GUARDED_SOURCE, { composition: 'framed' });
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funding = await funded(network);
    const deployment = await deploy(GUARDED_SOURCE, funding, key, 'DIGITAL_VIDEO');
    expect(deployment.initialize.accepted).toBe(true);

    const result = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'untag',
      args: [key],
      callerUtxo: funding.callUtxo,
      callerLockingBytecode: funding.deployerLock,
      funder: funding.signature.unlockP2PKH(),
      changeAddress: funding.changeAddress,
      vm: compositionMachine(),
    });
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast).toBeDefined();

    const slot = keyToSlotMulti([encoder.encode(key)]);
    const nodeIds = result.draft.layout.participants.filter((placed) => placed.id.startsWith('mapping-node-'));
    expect(nodeIds).toHaveLength(1);
    const written = decodeEntryCommitment(
      Uint8Array.from(result.transaction.outputs[nodeIds[0]!.index]!.token!.nft!.commitment!));
    expect(bytesToHex(written.slot)).toBe(bytesToHex(slot));
    expect(bytesToHex(written.value)).toBe(bytesToHex(encodeChunkableValueTail(new Uint8Array(0))));
    expect(await network.getRawTransaction(result.broadcast!.txid)).toMatch(/^[0-9a-f]+$/);
  });

  it('settles the unconditional write-then-delete in one deployment and broadcasts it', async () => {
    const encoder = new TextEncoder();
    const key = 'DV';
    const artifacts = compileStringMulti(PLAIN_SOURCE, { composition: 'framed' });
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funding = await funded(network);
    const deployment = await deploy(PLAIN_SOURCE, funding, key, 'DIGITAL_VIDEO');
    expect(deployment.initialize.accepted).toBe(true);

    // The value the live node the key names carries, read back through the shipped decoders.
    const classification = buildProxyArtifact(artifacts.Impl!).stateLayout!;
    const slot = keyToSlotMulti([encoder.encode(key)]);
    const heldValue = async (): Promise<string | undefined> => {
      const pools = await readFramedDeployment(network, deployment.proxy.categoryId, classification);
      const node = pools.collectionNodes.find((utxo) => utxo.token?.nft?.commitment !== undefined
        && bytesToHex(decodeEntryCommitment(hexToBin(utxo.token.nft.commitment)).slot) === bytesToHex(slot));
      return node === undefined
        ? undefined : bytesToHex(decodeEntryCommitment(hexToBin(node.token!.nft!.commitment)).value);
    };
    expect(await heldValue()).toBe(bytesToHex(encodeChunkableValueTail(encoder.encode('DIGITAL_VIDEO'))));

    // The call deletes the key: the node stays in place and takes the value type's default tail.
    const result = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'untag',
      args: [key],
      callerUtxo: funding.callUtxo,
      callerLockingBytecode: funding.deployerLock,
      funder: funding.signature.unlockP2PKH(),
      changeAddress: funding.changeAddress,
      vm: compositionMachine(),
    });
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast).toBeDefined();

    // The node is rewritten where it stood, nothing is created, and its commitment is the default's tail.
    const nodeIds = result.draft.layout.participants.filter((placed) => placed.id.startsWith('mapping-node-'));
    expect(nodeIds).toHaveLength(1);
    expect(result.draft.trailingOutputs).toHaveLength(0);
    const written = decodeEntryCommitment(
      Uint8Array.from(result.transaction.outputs[nodeIds[0]!.index]!.token!.nft!.commitment!));
    expect(bytesToHex(written.slot)).toBe(bytesToHex(slot));
    expect(bytesToHex(written.value)).toBe(bytesToHex(encodeChunkableValueTail(new Uint8Array(0))));
    expect(await heldValue()).toBe(bytesToHex(encodeChunkableValueTail(new Uint8Array(0))));
    expect(await network.getRawTransaction(result.broadcast!.txid)).toMatch(/^[0-9a-f]+$/);
  });
});
