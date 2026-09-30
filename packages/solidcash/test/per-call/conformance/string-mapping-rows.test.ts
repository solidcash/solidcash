import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { bytesToHex, encodeChunkableValueTail, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callPerCallEntry } from '../../../src/per-call/call/index.js';
import { readPerCallDeployment } from '../../../src/per-call/deploy/index.js';
import { buildProxyArtifact, deployPerCallProxy } from '../../../src/per-call/proxy/index.js';
import { callPerCallProxyEntry } from '../../../src/per-call/proxy/deploy.js';
import { decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * S0 conformance, spec section 23 row 24: a `string => string` mapping set and delete.
 *
 * The contract keeps one `mapping(string => string)`, so a write stores the value in a node whose tail chunks: a
 * value over 60 bytes is held in a run of chunk records beside the node rather than in it. On the direct shipped
 * call path a write to such a collection is refused by name, because a call alone cannot declare the chunk run the
 * created node needs. The row's own contract is deployed behind a proxy, where the hop does declare it, so the
 * second case drives the set, the read-back, the delete and the second read-back through the shipped proxy path.
 *
 * The observable is the node's value tail, decoded with the shipped `decodeEntryCommitment`: the set leaves the
 * encoded value, the delete leaves the value type's default, and the node keeps its slot and successor across both.
 */

const KEY = 'title';
const VALUE = 'first title';
const encoder = new TextEncoder();
const EMPTY_TAIL = encodeChunkableValueTail(new Uint8Array());
const VALUE_TAIL = encodeChunkableValueTail(encoder.encode(VALUE));

/** A 32-byte outpoint hash whose bytes are not all the same, so a byte-order bug cannot hide in it. */
function outpointHash(seed: number): string {
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (seed + index * 7) & 0xff;
  return binToHex(bytes);
}

/** The value tail the live node a key names carries, read back through the shipped decoders. */
async function heldValue(
  provider: MockNetworkProvider, categoryId: string, layout: Parameters<typeof readPerCallDeployment>[2],
): Promise<string | undefined> {
  const pools = await readPerCallDeployment(provider, categoryId, layout);
  const slot = bytesToHex(keyToSlotMulti([encoder.encode(KEY)]));
  const node = pools.collectionNodes.find((utxo) => utxo.token?.nft?.commitment !== undefined
    && bytesToHex(decodeEntryCommitment(hexToBin(utxo.token.nft.commitment)).slot) === slot);
  return node === undefined
    ? undefined : bytesToHex(decodeEntryCommitment(hexToBin(node.token!.nft!.commitment)).value);
}

describe('spec section 23 row 24: a string => string mapping set and delete', () => {
  const DIRECT_SOURCE = 'pragma solidity ^0.8.0;'
    + ' contract Ledger {'
    + '   mapping(string => string) public notes;'
    + '   function set(string memory k, string memory v) public { notes[k] = v; require(bytes(k).length != 0); }'
    + '   function remove(string memory k) public { delete this.notes[k]; require(bytes(k).length != 0); }'
    + ' }';

  /** The direct deployment both refusals enter, and the chain as it stood when it was done. */
  interface DirectDeployment {
    readonly provider: MockNetworkProvider;
    readonly artifact: Artifact;
    readonly categoryId: string;
    readonly snapshot: SnapshotRestorer;
  }
  let directRun: Promise<DirectDeployment> | undefined;

  /** A direct caller coin and a funder for the write the shipped call path is asked to plan, from one deployment. */
  async function direct(): Promise<{
    readonly write: (entry: string, args: readonly string[]) => ReturnType<typeof callPerCallEntry>;
  }> {
    directRun ??= (async (): Promise<DirectDeployment> => {
      const artifact = compileStringMulti(DIRECT_SOURCE, { composition: 'per-call', solidityImportCompat: true })
        .Ledger!;
      const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
      const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
      const fundingUtxo = { txid: outpointHash(0x30), vout: 0, satoshis: 500_000n };
      await provider.addUtxo(funder.address, fundingUtxo);
      await fundShippedFacets(provider);
      const deployment = await deployStatefulContract(artifact, [], {
        provider, fundingUtxo, funder: funder.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        changeAddress: funder.address,
      });
      return { provider, artifact, categoryId: deployment.categoryId, snapshot: await provider.takeSnapshot() };
    })();
    const { provider, artifact, categoryId, snapshot } = await directRun;
    // Each case starts from the chain the deployment left, so neither reads the other's broadcast.
    await snapshot.restore();
    const signature = new SignatureTemplate(alicePriv);
    const user = encodeLockingBytecodeP2pkh(alicePkh);
    let seeded = 0;
    return {
      write: async (entry, args) => {
        seeded += 1;
        const callerUtxo = { txid: outpointHash(0x50 + seeded), vout: 0, satoshis: 200_000n };
        await provider.addUtxo(binToHex(user), callerUtxo);
        return callPerCallEntry({
          provider, artifact, categoryId, functionName: entry, args: args as never,
          callerUtxo, callerLockingBytecode: user, funder: signature.unlockP2PKH(), vm: compositionMachine(),
        });
      },
    };
  }

  it('refuses the direct set by name: a chunkable value cannot be declared from the call alone', async () => {
    const run = await direct();
    await expect(run.write('set', [KEY, VALUE])).rejects.toThrow(
      /entry "set" writes mapping "notes", whose values chunk/,
    );
  });

  it('refuses the direct delete by name, the same collection write', async () => {
    const run = await direct();
    await expect(run.write('remove', [KEY])).rejects.toThrow(
      /entry "remove" writes mapping "notes", whose values chunk/,
    );
  });

  it('sets, reads, deletes and reads again through the shipped proxy path', async () => {
    const PROXY_SOURCE = 'pragma solidcash ^0.13.0;'
      + ' contract Impl {'
      + '   mapping(string => string) tags;'
      + '   function initialize(string k, string v) { this.tags[k] = v; }'
      + '   function untag(string k) { delete this.tags[k]; }'
      + ' }';
    const artifacts = compileStringMulti(PROXY_SOURCE, { composition: 'per-call' });
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
    const implFunding = { txid: outpointHash(0x60), vout: 0, satoshis: 500_000n };
    const proxyFunding = { txid: outpointHash(0x70), vout: 0, satoshis: 500_000n };
    // The deployment's initialize spends one caller coin; the later delete needs its own.
    const initUtxo = { txid: outpointHash(0x80), vout: 0, satoshis: 100_000n };
    const callUtxo = { txid: outpointHash(0x90), vout: 0, satoshis: 100_000n };
    const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
    await network.addUtxo(funder.address, implFunding);
    await network.addUtxo(funder.address, proxyFunding);
    await fundShippedFacets(network);
    await network.addUtxo(binToHex(callerLock), initUtxo);
    await network.addUtxo(binToHex(callerLock), callUtxo);

    // The deploy's own third transaction is the proxied `initialize`: it sets the entry as a delegate frame, so
    // the hop declares the executed collection's chunk run the direct path could not.
    const deployment = await deployPerCallProxy({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      implementationDeploy: {
        fundingUtxo: implFunding, funder: funder.unlock.spend(alicePub, signature), changeAddress: funder.address,
      },
      proxyDeploy: {
        fundingUtxo: proxyFunding, funder: funder.unlock.spend(alicePub, signature), changeAddress: funder.address,
      },
      initialize: { functionName: 'initialize', args: [KEY, VALUE] },
      callerLockingBytecode: callerLock,
      callerFunding: { utxo: initUtxo, funder: signature.unlockP2PKH() },
      vm: compositionMachine(),
    });
    expect(deployment.initialize.accepted).toBe(true);

    // The set is readable back: the live node the key names carries the encoded value.
    const layout = buildProxyArtifact(artifacts.Impl!).stateLayout!;
    expect(await heldValue(network, deployment.proxy.categoryId, layout)).toBe(bytesToHex(VALUE_TAIL));

    // The delete runs through the shipped proxy hop; the node is rewritten where it stood to the default tail.
    const removed = await callPerCallProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'untag',
      args: [KEY],
      callerUtxo: callUtxo,
      callerLockingBytecode: callerLock,
      funder: signature.unlockP2PKH(),
      changeAddress: funder.address,
      vm: compositionMachine(),
    });
    expect(removed.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(removed.accepted).toBe(true);
    expect(removed.broadcast).toBeDefined();

    // The second read-back is the empty value the default tail decodes to.
    expect(await heldValue(network, deployment.proxy.categoryId, layout)).toBe(bytesToHex(EMPTY_TAIL));
  }, 120_000);
});
