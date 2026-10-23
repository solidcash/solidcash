import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import {
  buildValueChunkCommitment, encodeChunkableValueTail, encodePushdataValue, sha256, splitValueIntoValueChunks,
} from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import { sharedNodeId } from '../../../src/framed/proxy/entry-writes.js';
import { entryRecordLockingBytecode } from '../../../src/framed/deploy/records.js';
import { mappingValueChunkLock } from '../../../src/framed/composer/mapping-plan.js';
import { encodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A hop whose proxied callee reads a mapping node whose value crosses the inline limit.
 *
 * The callee is two contracts, so each reach takes a master of the callee proxy's and a master of the
 * implementation's. The implementation's entry reads the value the caller's key names as a whole — the value is a
 * struct with dynamic fields, so it crosses the inline limit and the node's tail keeps only its digest — and
 * requires the record's own owner to be the caller. The node's continuation chunks hold the bytes, and the frame's
 * witness block has to carry the value they join to; without it the body's own digest check fails, which is what
 * a read-only entry reached through the hop used to stop on.
 */

const ROSTER_IMPL_CATEGORY = 'a1'.repeat(31) + '5e';
const ROSTER_PROXY_CATEGORY = 'b2'.repeat(31) + '4d';
const OUTER_IMPL_CATEGORY = 'c3'.repeat(31) + '3c';
const OUTER_PROXY_CATEGORY = 'd4'.repeat(31) + '2b';

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' struct Profile { address owner; bytes pubkey; string name; string bio; }'
  + ' interface IRoster { function hasKey(address who); }'
  + ' contract Roster {'
  + '   address public implementation;'
  + '   mapping(address => Profile) profiles;'
  + '   function initialize() { require(true); }'
  + '   function hasKey(address who) { require(this.profiles[who].owner == who); }'
  + ' }'
  + ' contract Outer {'
  + '   address public implementation;'
  + '   address public roster;'
  + '   function initialize(address target) { this.roster = target; require(true); }'
  + '   function run(address who) { IRoster(this.roster).hasKey(who); require(true); }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const roster = artifacts.Roster!;
const outer = artifacts.Outer!;

/** A coin a genesis is funded from; its txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** The struct value a registered profile holds, longer than the inline limit so its bytes sit in chunks. */
function profileValue(owner: Uint8Array): Uint8Array {
  return encodePushdataValue({
    owner,
    pubkey: new Uint8Array(33).fill(2),
    name: 'TestUser',
    bio: 'a bio long enough that the whole profile crosses the inline limit',
  } as never, 'Profile', roster.structs);
}

/** Deploys the proxied callee and the root behind its proxy, and broadcasts both initializes. */
async function deployBoth(network: MockNetworkProvider): Promise<{
  readonly rosterProxyCategoryId: string;
  readonly rosterImplementationCategoryId: string;
  readonly outerProxyCategoryId: string;
  readonly outerImplementationCategoryId: string;
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
  readonly callCoin: { txid: string; vout: number; satoshis: bigint };
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
}> {
  const signature = new SignatureTemplate(alicePriv);
  const source = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = source.unlock.spend(alicePub, signature);
  const callerFunder = signature.unlockP2PKH();
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);

  for (const txid of [ROSTER_IMPL_CATEGORY, ROSTER_PROXY_CATEGORY, OUTER_IMPL_CATEGORY, OUTER_PROXY_CATEGORY]) {
    await network.addUtxo(source.address, funding(txid));
  }
  const rosterInitCoin = funding('55'.repeat(32));
  const outerInitCoin = funding('66'.repeat(32));
  const callCoin = funding('77'.repeat(32));
  for (const coin of [rosterInitCoin, outerInitCoin, callCoin]) await network.addUtxo(binToHex(deployerLock), coin);
  await fundShippedFacets(network);

  const rosterDeployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: roster,
    proxyArtifact: buildProxyArtifact(roster),
    implementationDeploy: {
      fundingUtxo: funding(ROSTER_IMPL_CATEGORY), funder, changeAddress: source.address, threadCount: 5,
    },
    proxyDeploy: {
      fundingUtxo: funding(ROSTER_PROXY_CATEGORY), funder, changeAddress: source.address, threadCount: 5,
    },
    initialize: { functionName: 'initialize', args: [] },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: rosterInitCoin, funder: callerFunder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(rosterDeployment.initialize.accepted).toBe(true);

  const outerDeployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: outer,
    proxyArtifact: buildProxyArtifact(outer),
    implementationDeploy: { fundingUtxo: funding(OUTER_IMPL_CATEGORY), funder, changeAddress: source.address },
    proxyDeploy: { fundingUtxo: funding(OUTER_PROXY_CATEGORY), funder, changeAddress: source.address },
    initialize: { functionName: 'initialize', args: [rosterDeployment.proxy.address] },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: outerInitCoin, funder: callerFunder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(outerDeployment.initialize.accepted).toBe(true);

  return {
    rosterProxyCategoryId: rosterDeployment.proxy.categoryId,
    rosterImplementationCategoryId: rosterDeployment.implementation.categoryId,
    outerProxyCategoryId: outerDeployment.proxy.categoryId,
    outerImplementationCategoryId: outerDeployment.implementation.categoryId,
    deployerLock,
    changeAddress: source.address,
    callCoin,
    funder: callerFunder,
  };
}

/**
 * Seeds the profile node the callee reads, at the proxied callee's own category.
 *
 * The node's value crosses the inline limit, so its commitment keeps only a digest and its first bytes while the
 * rest sit in continuation chunks at the value's own root-salted covenant — exactly the shape a registered
 * profile's node has.
 */
async function seedProfile(
  network: MockNetworkProvider, categoryId: string, who: Uint8Array, value: Uint8Array,
): Promise<void> {
  const collection = roster.stateLayout!.collections!.find((candidate) => candidate.name === 'profiles')!;
  const slot = keyToSlotMulti([who]);
  const root = sha256(value);
  const node = encodeEntryCommitment(slot, new Uint8Array(32), encodeChunkableValueTail(value));
  await network.addUtxo(binToHex(entryRecordLockingBytecode(categoryId, collection.signature)), {
    txid: `${categoryId.slice(0, 62)}ab`, vout: 3, satoshis: 1_200n,
    token: {
      category: categoryId, amount: 0n,
      nft: { capability: 'mutable', commitment: binToHex(node) },
    },
  });
  const chunkLock = mappingValueChunkLock(hexToBin(categoryId), 'profiles', { slot, root });
  const chunks = splitValueIntoValueChunks(value);
  for (const [index, chunk] of chunks.entries()) {
    await network.addUtxo(binToHex(chunkLock), {
      txid: `${categoryId.slice(0, 62)}${(0x40 + index).toString(16).padStart(2, '0')}`, vout: index,
      satoshis: 1_200n,
      token: {
        category: categoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: buildValueChunkCommitment(index, chunk) },
      },
    });
  }
}

/** Calls the root entry through the hop with the caller's own coin. */
async function callRun(
  network: MockNetworkProvider,
  funded: Awaited<ReturnType<typeof deployBoth>>,
  who: Uint8Array,
): Promise<FramedProxyCallResult> {
  return callFramedProxyEntry({
    provider: network,
    implementationArtifact: outer,
    proxyArtifact: buildProxyArtifact(outer),
    proxyCategoryId: funded.outerProxyCategoryId,
    implementationCategoryId: funded.outerImplementationCategoryId,
    functionName: 'run',
    args: [who],
    externals: {
      IRoster: {
        artifact: roster,
        categoryId: funded.rosterProxyCategoryId,
        proxyArtifact: buildProxyArtifact(roster),
        implementationCategoryId: funded.rosterImplementationCategoryId,
      },
    },
    callerUtxo: funded.callCoin,
    callerLockingBytecode: funded.deployerLock,
    funder: funded.funder,
    changeAddress: funded.changeAddress,
    vm: compositionMachine(),
  });
}

/** The deployment the cases share, and the chain as it stood before any profile was seeded. */
interface World {
  readonly network: MockNetworkProvider;
  readonly funded: Awaited<ReturnType<typeof deployBoth>>;
  readonly snapshot: SnapshotRestorer;
}

let worldRun: Promise<World> | undefined;

/** One deployment serves both cases, each rewinding the chain to it first and seeding its own profile. */
async function deployed(): Promise<World> {
  worldRun ??= (async (): Promise<World> => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployBoth(network);
    return { network, funded, snapshot: await network.takeSnapshot() };
  })();
  const world = await worldRun;
  await world.snapshot.restore();
  return world;
}

describe('a hop whose proxied callee reads a mapping value past the inline limit', () => {
  it('witnesses the whole node value, settles the reach and broadcasts', async () => {
    const { network, funded } = await deployed();
    await seedProfile(network, funded.rosterProxyCategoryId, funded.deployerLock, profileValue(funded.deployerLock));

    const result = await callRun(network, funded, funded.deployerLock);

    // The reach derives the callee's implementation entry, then the proxy fallback that entered it; the entry
    // that made the call and its own fallback follow.
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([
      `${roster.contractName}.hasKey()`,
      `${roster.contractName}Proxy.__fallback()`,
      `${outer.contractName}.run()`,
      `${outer.contractName}Proxy.__fallback()`,
    ]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

    // The node the callee reads is declared once, and the frame's witness block carries the whole value.
    expect(result.draft.layout.participants.filter((placed) => placed.id.startsWith('mapping-'))
      .map((placed) => placed.id)).toStrictEqual([
      sharedNodeId(funded.rosterProxyCategoryId, 'profiles', keyToSlotMulti([funded.deployerLock])),
    ]);
    const implementation = result.draft.blockOf('callee-impl-master-2');
    expect(implementation.values).toHaveLength(1);
    expect(implementation.values![0]).toStrictEqual(profileValue(funded.deployerLock));
  });

  it('refuses when the profile the callee reads names another owner', async () => {
    const { network, funded } = await deployed();
    // The caller's own key is in the list, but the profile it holds names another owner, so the body's check
    // fails: the node is present and its value is witnessed, only the entry's own require refuses.
    const other = new Uint8Array(25).fill(0x33);
    await seedProfile(network, funded.rosterProxyCategoryId, funded.deployerLock, profileValue(other));

    await expect(callRun(network, funded, funded.deployerLock))
      .rejects.toThrow(/did not settle through the proxy/);
  });
});
