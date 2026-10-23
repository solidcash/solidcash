import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { bytesToHex, encodeChunkableValueTail, sha256, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { planMappingDelete } from '../../../src/framed/composer/index.js';
import {
  bytesToSlotValue, decodeEntryCommitment, encodeEntryCommitment, keyToSlotMulti,
} from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A sorted-mapping delete a branch guards, called through the SDK at a key the list does not hold (audit DS-6).
 *
 * A framed frame's guarded delete that is its batch's one target creates no node: for an absent key its group is the
 * kept node that brackets the key, whether the delete runs or not. The call path plans that group itself, so the call
 * settles, taken and skipped, and the list reads back as it was. A key the list holds is cleared where it runs. Beside
 * a write of its collection the group is the same, and the write's insert or update may take that node.
 */

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Tags {'
  + '   mapping(string => string) tags;'
  + '   function put(string k, string v) { this.tags[k] = v; require(true); }'
  + '   function remove(string k, int c) { if (c > 0) { delete this.tags[k]; } require(true); }'
  + ' }';
const TAGS = compileStringMulti(SOURCE, { composition: 'framed' }).Tags!;
// The delete runs ahead of the write: a write a delete of its collection follows is a swap-remove alias, which
// updates in place only.
const NOTES = compileStringMulti('pragma solidcash ^0.14.0;'
  + ' contract Notes {'
  + '   mapping(string => string) tags;'
  + '   function put(string k, string v) { this.tags[k] = v; require(true); }'
  + '   function tidy(string a, string v, string k, int c) {'
  + '     if (c > 0) { delete this.tags[k]; } this.tags[a] = v; require(true);'
  + '   }'
  + ' }', { composition: 'framed' }).Notes!;

const slotOf = (text: string): Uint8Array => keyToSlotMulti([utf8ToBin(text)]);
/** Three keys in slot order: the list comes to hold LOW and HIGH, and MID falls between them. */
const [LOW, MID, HIGH] = ['alpha', 'gamma', 'omega'].sort((left, right) => {
  const [a, b] = [bytesToSlotValue(slotOf(left)), bytesToSlotValue(slotOf(right))];
  return a < b ? -1 : a > b ? 1 : 0;
}) as [string, string, string];
const ZERO = new Uint8Array(32);
const CLEARED = encodeChunkableValueTail(new Uint8Array());
const CALLER = encodeLockingBytecodeP2pkh(alicePkh);

interface World {
  readonly network: MockNetworkProvider;
  readonly categoryId: string;
  readonly artifact: Artifact;
}

let coins = 0;
async function coinAt(network: MockNetworkProvider, lock: string): Promise<Utxo> {
  coins += 1;
  const coin = { txid: bytesToHex(sha256(utf8ToBin(`guarded mapping delete ${coins}`))), vout: 0, satoshis: 5_000_000n };
  await network.addUtxo(lock, coin);
  return coin;
}

async function deploy(artifact: Artifact = TAGS): Promise<World> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  await fundShippedFacets(network);
  const deployment = await deployStatefulContract(artifact, [], {
    provider: network, fundingUtxo: await coinAt(network, wallet.address),
    funder: wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv)), changeAddress: wallet.address,
  });
  return { network, categoryId: deployment.categoryId, artifact };
}

let deployed: Promise<World> | undefined;
/** One deployment the cases share, in order: the list holds the head alone until the second case writes to it. */
const world = (): Promise<World> => (deployed ??= deploy());

/** Calls an entry through the SDK and requires it to settle: every participant accepted and the call broadcast. */
async function settle(shared: World, functionName: string, args: readonly FunctionArgument[]): Promise<FramedCallResult> {
  const result = await callFramedEntry({
    provider: shared.network, artifact: shared.artifact, categoryId: shared.categoryId, functionName, args: [...args],
    callerUtxo: await coinAt(shared.network, binToHex(CALLER)), callerLockingBytecode: CALLER,
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(), vm: compositionMachine(),
  });
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return result;
}

/** The list's node commitments, the head included, sorted. */
async function list(shared: World): Promise<string[]> {
  const deployment = await readFramedDeployment(shared.network, shared.categoryId, shared.artifact.stateLayout!);
  return (deployment.nodesByCollection.get('tags') ?? []).map((node) => node.token!.nft!.commitment).sort();
}

/** The mapping nodes a call spends, by participant id. */
const spentNodes = (result: FramedCallResult): string[] => result.draft.layout.participants
  .filter((placed) => placed.id.startsWith('mapping-node-')).map((placed) => placed.id);

describe('a guarded delete of a key the list does not hold, called through the SDK', () => {
  it('is planned as the kept node that brackets the key, where an unguarded delete inserts the default', () => {
    const low = encodeEntryCommitment(slotOf(LOW), slotOf(HIGH), encodeChunkableValueTail(utf8ToBin('low')));
    const high = encodeEntryCommitment(slotOf(HIGH), ZERO, encodeChunkableValueTail(utf8ToBin('high')));
    const request = { keys: [utf8ToBin(MID)], inventory: [low, high], encodeDefault: () => CLEARED };
    const shape = (plan: ReturnType<typeof planMappingDelete>): string[][] => plan.written
      .map((node) => [bytesToHex(node.slot), String(node.existed), bytesToHex(node.before), bytesToHex(node.after)]);
    expect(shape(planMappingDelete({ ...request, guarded: true })))
      .toStrictEqual([[bytesToHex(slotOf(LOW)), 'true', bytesToHex(low), bytesToHex(low)]]);
    expect(planMappingDelete(request).written.map((node) => node.existed)).toStrictEqual([true, false]);
  });

  it('settles it taken and skipped on the head alone, which brackets every key', async () => {
    const shared = await world();
    const before = await list(shared);
    expect(before).toHaveLength(1);
    for (const c of [1n, 0n]) {
      const result = await settle(shared, 'remove', [MID, c]);
      expect(spentNodes(result)).toStrictEqual([`mapping-node-${bytesToHex(ZERO)}`]);
      expect(result.draft.trailingOutputs).toHaveLength(0);
      expect(await list(shared)).toStrictEqual(before);
    }
  }, 600_000);

  it('settles it taken and skipped between two nodes, and clears a key the list holds', async () => {
    const shared = await world();
    await settle(shared, 'put', [LOW, 'low']);
    await settle(shared, 'put', [HIGH, 'high']);
    const held = await list(shared);
    expect(held).toHaveLength(3);
    for (const c of [1n, 0n]) {
      const result = await settle(shared, 'remove', [MID, c]);
      expect(spentNodes(result)).toStrictEqual([`mapping-node-${bytesToHex(slotOf(LOW))}`]);
      expect(result.draft.trailingOutputs).toHaveLength(0);
      expect(await list(shared)).toStrictEqual(held);
    }
    await settle(shared, 'remove', [LOW, 1n]);
    const cleared = held.map((commitment) => {
      const { slot, nextKey } = decodeEntryCommitment(hexToBin(commitment));
      return bytesToHex(slot) === bytesToHex(slotOf(LOW)) ? bytesToHex(encodeEntryCommitment(slot, nextKey, CLEARED))
        : commitment;
    }).sort();
    expect(await list(shared)).toStrictEqual(cleared);
  }, 600_000);
});

describe('a guarded delete of a key the list does not hold, beside a write, called through the SDK', () => {
  it('settles it taken beside the write\'s insert and skipped beside its update, both at the bracketing node', async () => {
    const shared = await deploy(NOTES);
    const holding = (value: string): string => bytesToHex(
      encodeEntryCommitment(slotOf(LOW), ZERO, encodeChunkableValueTail(utf8ToBin(value))),
    );
    // The head alone brackets MID: the delete's group keeps it, and the write's insert of LOW relinks it.
    const inserted = await settle(shared, 'tidy', [LOW, 'low', MID, 1n]);
    expect(spentNodes(inserted)).toStrictEqual([`mapping-node-${bytesToHex(ZERO)}`]);
    const written = await list(shared);
    expect(written).toHaveLength(2);
    expect(written).toContain(holding('low'));
    // LOW's node, the list's last, brackets MID: the write rewrites it, and the delete leaves it to that write.
    const updated = await settle(shared, 'tidy', [LOW, 'again', MID, 0n]);
    expect(spentNodes(updated)).toStrictEqual([`mapping-node-${bytesToHex(slotOf(LOW))}`]);
    expect(await list(shared)).toStrictEqual(written.map((commitment) => (
      commitment === holding('low') ? holding('again') : commitment)).sort());
  }, 600_000);
});
