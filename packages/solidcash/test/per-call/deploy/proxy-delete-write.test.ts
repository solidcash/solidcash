import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { bytesToHex, encodeChunkableValueTail } from '@solidcash/utils';
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
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A proxied call that deletes a sorted-mapping key.
 *
 * A per-call body compiles `delete m[k]` as an upsert of the value type's default, so the node a key names stays
 * where it is and takes the default tail. The hop therefore has to declare the target as a write like any other,
 * with the node's own slot and successor and the default's tail: only the run the default occupies has to be
 * stated, and the commitment the body computed is learned from the body's own close. The expected commitment here
 * is the shipped tail encoder's for the value type's default, read back through the shipped commitment decoder.
 */

const IMPL_CATEGORY = '11'.repeat(32);
const PROXY_CATEGORY = '22'.repeat(32);
const CALLER_TXID = '33'.repeat(32);
const SECOND_CALLER_TXID = '44'.repeat(32);

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   mapping(string => string) public tags;'
  + '   function initialize(string key, string tag) { this.tags[key] = tag; }'
  + '   function untag(string key) { delete this.tags[key]; }'
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

describe('a proxied call that deletes a sorted-mapping key', () => {
  it('settles the delete, the node taking the default tail, and broadcasts it', async () => {
    const encoder = new TextEncoder();
    const key = 'DA';
    const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funding = await funded(network);

    // The deployment's initialize writes the entry the call then deletes.
    const deployment = await deployPerCallProxy({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      implementationDeploy: {
        fundingUtxo: funding.implFunding, funder: funding.funder, changeAddress: funding.changeAddress,
      },
      proxyDeploy: {
        fundingUtxo: funding.proxyFunding, funder: funding.funder, changeAddress: funding.changeAddress,
      },
      initialize: { functionName: 'initialize', args: [key, 'DIGITAL_AUDIO'] },
      callerLockingBytecode: funding.deployerLock,
      callerFunding: { utxo: funding.callerUtxo, funder: funding.signature.unlockP2PKH() },
      vm: compositionMachine(),
    });
    expect(deployment.initialize.accepted).toBe(true);

    const classification = buildProxyArtifact(artifacts.Impl!).stateLayout!;
    const before = await readPerCallDeployment(network, deployment.proxy.categoryId, classification);
    const slot = keyToSlotMulti([encoder.encode(key)]);
    const held = before.collectionNodes
      .find((node) => node.token?.nft?.commitment !== undefined
        && bytesToHex(decodeEntryCommitment(hexToBin(node.token.nft.commitment)).slot) === bytesToHex(slot));
    expect(held).toBeDefined();
    expect(bytesToHex(decodeEntryCommitment(hexToBin(held!.token!.nft!.commitment)).value))
      .toBe(bytesToHex(encodeChunkableValueTail(encoder.encode('DIGITAL_AUDIO'))));

    // The call deletes the key: the node stays in place and takes the value type's default tail.
    const result = await callPerCallProxyEntry({
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

    // The node is rewritten where it stood, its commitment the default's tail from the shipped encoder.
    const nodeIds = result.draft.layout.participants.filter((placed) => placed.id.startsWith('mapping-node-'));
    expect(nodeIds).toHaveLength(1);
    expect(result.draft.trailingOutputs).toHaveLength(0);
    const written = decodeEntryCommitment(
      Uint8Array.from(result.transaction.outputs[nodeIds[0]!.index]!.token!.nft!.commitment!));
    expect(bytesToHex(written.slot)).toBe(bytesToHex(slot));
    expect(bytesToHex(written.value)).toBe(bytesToHex(encodeChunkableValueTail(new Uint8Array(0))));

    const after = await readPerCallDeployment(network, deployment.proxy.categoryId, classification);
    const settled = after.collectionNodes
      .find((node) => node.token?.nft?.commitment !== undefined
        && bytesToHex(decodeEntryCommitment(hexToBin(node.token.nft.commitment)).slot) === bytesToHex(slot));
    expect(bytesToHex(decodeEntryCommitment(hexToBin(settled!.token!.nft!.commitment)).value))
      .toBe(bytesToHex(encodeChunkableValueTail(new Uint8Array(0))));
    expect(await network.getRawTransaction(result.broadcast!.txid)).toMatch(/^[0-9a-f]+$/);
  });
});
