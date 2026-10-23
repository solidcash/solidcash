import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import {
  buildChunkCommitment, bytesToHex, chunkCountForLength, decodePushdataValue, encodePushdataValue,
  parseChunkCommitment, type StateValue,
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
import { alicePriv, alicePub, alicePkh } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A proxied call that appends a default element and fills its fields with a value the artifact cannot state.
 *
 * A framed body holds a dynamic value in a run of chunk NFTs, and the run's records have to be declared before
 * the body runs. An append the artifact publishes an element for sizes the run outright, but a body that appends
 * the element type's default and then fills its fields through a storage pointer publishes no element as soon as
 * one field's value is a fact of the machine rather than a value the vocabulary speaks — the frame's own input, here.
 * The record that carries the value's byte length is still written by the body and closed against the declaration
 * the plan states, so the hop takes the run's width from that declaration: the first attempt lays the run at the
 * width the deployment holds, the body's own close hands the length it wrote back, and the run is laid at the
 * chunks that length names. The chunks themselves stay what the body computed, learned from the same close. A pop
 * that leaves fewer chunks is laid the same way, the run declared at the width it spends and the chunk past the
 * written value consumed with no successor.
 *
 * The expected commitments come from the shipped encoders (`encodePushdataValue`, `buildChunkCommitment`,
 * `chunkRecordLockingBytecode`), and the run is read back through the shipped chunk and pushdata decoders.
 */

const IMPL_CATEGORY = '11'.repeat(31) + 'ee';
const PROXY_CATEGORY = '22'.repeat(31) + 'dd';
const CALLER_TXID = '33'.repeat(32);
const SECOND_CALLER_TXID = '44'.repeat(32);
const THIRD_CALLER_TXID = '55'.repeat(32);

/** The seed element the deployment's own entry appends, which the artifact states outright. */
const SEED: StateValue = { id: 1n, title: 'seed', at: 2n };

/** A title long enough that the filled element crosses the 120-byte chunk boundary, unlike the default's. */
const TITLE = 't'.repeat(130);

/**
 * The entry the call makes: the push appends the default element, and the three indexed writes rebuild it through
 * a pointer. The first two fold into the stated element; the third reads the input the frame runs on, which is a
 * fact of the machine rather than a value the element vocabulary speaks, so the artifact publishes no element for
 * the append at all.
 */
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Impl {'
  + '   struct Post { int id; string title; int at; }'
  + '   address public implementation;'
  + '   Post[] public posts;'
  + '   function initialize() { this.posts.push(Post(1, "seed", 2)); }'
  + '   function post(int id, string title_) {'
  + '     this.posts.push();'
  + '     int index = this.posts.length - 1;'
  + '     this.posts[index].id = id;'
  + '     this.posts[index].title = title_;'
  + '     this.posts[index].at = this.activeInputIndex;'
  + '   }'
  + '   function drop() { this.posts.pop(); }'
  + ' }';

interface Funding {
  readonly network: MockNetworkProvider;
  readonly signature: SignatureTemplate;
  readonly funder: ReturnType<Contract['unlock']['spend']>;
  readonly implFunding: { txid: string; vout: number; satoshis: bigint };
  readonly proxyFunding: { txid: string; vout: number; satoshis: bigint };
  readonly callerUtxo: { txid: string; vout: number; satoshis: bigint };
  readonly callUtxo: { txid: string; vout: number; satoshis: bigint };
  readonly dropUtxo: { txid: string; vout: number; satoshis: bigint };
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
  const dropUtxo = { txid: THIRD_CALLER_TXID, vout: 0, satoshis: 100_000n };
  await network.addUtxo(funder.address, implFunding);
  await network.addUtxo(funder.address, proxyFunding);
  await network.addUtxo(binToHex(deployerLock), callerUtxo);
  await network.addUtxo(binToHex(deployerLock), callUtxo);
  await network.addUtxo(binToHex(deployerLock), dropUtxo);
  // The hops broadcast, so each composition's facet input needs a live UTXO at the facet's lock.
  await fundShippedFacets(network);
  return {
    network, signature, funder: funder.unlock.spend(alicePub, signature),
    implFunding, proxyFunding, callerUtxo, callUtxo, dropUtxo, deployerLock, changeAddress: funder.address,
  };
}

/** Deploys the seed through the proxy, so the call reads a live run the deployment holds. */
async function deployed(): Promise<{
  readonly network: MockNetworkProvider;
  readonly artifacts: ReturnType<typeof compileStringMulti>;
  readonly deployment: Awaited<ReturnType<typeof deployFramedProxy>>;
  readonly layout: NonNullable<ReturnType<typeof buildProxyArtifact>['stateLayout']>;
  readonly funding: Funding;
}> {
  const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
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
    initialize: { functionName: 'initialize' },
    callerLockingBytecode: funding.deployerLock,
    callerFunding: { utxo: funding.callerUtxo, funder: funding.signature.unlockP2PKH() },
    vm: compositionMachine(),
  });
  return {
    network, artifacts, deployment, layout: buildProxyArtifact(artifacts.Impl!).stateLayout!, funding,
  };
}

/** The live chunks of the run, in chunk order, each with the bytes its commitment decodes to. */
async function liveChunks(
  network: MockNetworkProvider,
  categoryId: string,
  layout: NonNullable<ReturnType<typeof buildProxyArtifact>['stateLayout']>,
): Promise<readonly { readonly index: number; readonly data: Uint8Array }[]> {
  const lock = chunkRecordLockingBytecode(categoryId, 'posts', 'Post[]');
  const pools = await readFramedDeployment(network, categoryId, layout);
  return [...pools.chunks, ...pools.collectionNodes]
    .filter((utxo) => utxo.lockingBytecode !== undefined
      && bytesToHex(utxo.lockingBytecode) === bytesToHex(lock))
    .map((utxo) => parseChunkCommitment(utxo.token!.nft!.commitment!))
    .map((chunk) => ({ index: chunk.chunkIndex, data: chunk.chunkData }))
    .sort((left, right) => left.index - right.index);
}

describe('a proxied call whose append publishes no element', () => {
  it('sizes the run from the record the body declared, and carries what the body computed', async () => {
    const { network, artifacts, deployment, layout, funding } = await deployed();
    const structs = artifacts.Impl!.structs;
    // The deployment's own entry published an element, so the hop settled and the run it created is live.
    expect(deployment.initialize.accepted).toBe(true);
    const seedValue = encodePushdataValue([SEED], 'Post[]', structs);
    expect((await liveChunks(network, deployment.proxy.categoryId, layout)).map((chunk) => chunk.data))
      .toStrictEqual([seedValue]);

    // The artifact publishes no element for the entry's append: one of the fields it writes is the machine's own.
    expect(artifacts.Impl!.abi.find((entry) => entry.name === 'post')?.dynamicWriteSources).toBeUndefined();

    const result = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'post',
      args: [7n, TITLE],
      callerUtxo: funding.callUtxo,
      callerLockingBytecode: funding.deployerLock,
      funder: funding.signature.unlockP2PKH(),
      changeAddress: funding.changeAddress,
      vm: compositionMachine(),
    });
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast).toBeDefined();

    // The run the call leaves is what the body computed: the seed element, then the one the fill wrote. It is read
    // back through the shipped chunk and pushdata decoders rather than compared against a value built here.
    const chunks = await liveChunks(network, deployment.proxy.categoryId, layout);
    const value = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.data.length, 0));
    let offset = 0;
    for (const chunk of chunks) { value.set(chunk.data, offset); offset += chunk.data.length; }
    const state = await readFramedState(network, deployment.proxy.categoryId, layout);
    expect(state.byNft[0]!.posts$len).toBe(BigInt(value.length));

    const decoded = decodePushdataValue(value, 0, 'Post[]', structs).value as StateValue[];
    expect(decoded).toHaveLength(2);
    expect(decoded[0]).toStrictEqual(SEED);
    expect(decoded[1]).toMatchObject({ id: 7n, title: TITLE });

    // The width came from the record the body wrote, not from a guessed element: the default the push appended
    // would have named a one-chunk value, while the body's own write names two.
    const guessed = encodePushdataValue([SEED, { id: 0n, title: '', at: 0n }], 'Post[]', structs);
    expect(chunkCountForLength(guessed.length)).toBe(1);
    expect(chunks).toHaveLength(2);
    expect(value.length).toBeGreaterThan(120);

    // The chunk the call created carries the body's own bytes, at the run's covenant, as a trailing output.
    const created = result.draft.trailingOutputs;
    expect(created).toHaveLength(1);
    expect(result.transaction.outputs[created[0]!.index]!.token!.nft!.commitment)
      .toStrictEqual(new Uint8Array(Buffer.from(buildChunkCommitment(1, chunks[1]!.data), 'hex')));
    expect(created[0]!.output.lockingBytecode)
      .toStrictEqual(chunkRecordLockingBytecode(deployment.proxy.categoryId, 'posts', 'Post[]'));
    expect(await network.getRawTransaction(result.broadcast!.txid)).toMatch(/^[0-9a-f]+$/);

    // An entry that pops: the record the pop writes declares a value of one chunk where the run is now two. The run
    // is declared at the two chunks it spends: the first is rewritten in place, and the second is consumed with no
    // successor, its index paying its satoshis to the caller.
    const dropped = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'drop',
      args: [],
      callerUtxo: funding.dropUtxo,
      callerLockingBytecode: funding.deployerLock,
      funder: funding.signature.unlockP2PKH(),
      changeAddress: funding.changeAddress,
      vm: compositionMachine(),
    });
    expect(dropped.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(dropped.broadcast).toBeDefined();
    expect(dropped.draft.trailingOutputs).toHaveLength(0);
    expect((await liveChunks(network, deployment.proxy.categoryId, layout)).map((chunk) => chunk.data))
      .toStrictEqual([seedValue]);
    const dropState = await readFramedState(network, deployment.proxy.categoryId, layout);
    expect(dropState.byNft[0]!.posts$len).toBe(BigInt(seedValue.length));
  });
});
