import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { INDEX_NONE, bytesToHex, validatorAddress } from '@solidcash/utils';
import { framedValidator } from 'solidc';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import { planCallLoopWrites } from '../../../src/framed/call/entry-records.js';
import { buildProxyArtifact, callFramedProxyEntry, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { bytesToSlotValue, decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A mapping write inside a loop whose own body makes a call, driven through the shipped paths.
 *
 * The shape is the fixture's `updateJobWhitelist` (`.marketplace/contracts/MarketplaceV1.sol:466-499`): each turn
 * writes the allowlist under the job's id and one worker, then calls the store through an internal helper, and a
 * second loop does the same for the workers it removes. Each call closes the segment the turn's write ran in, so the
 * artifact publishes the turns' segments (`PublishedWriteSegment.turns`) and a builder declares each record from
 * the segment that mints it on, chained turn to turn. The two loops of one collection are one run of records, which
 * the compiler counts once. The ladder's #30 adds and then removes a worker this way; its own entry also reads
 * the job first, which this replica leaves out.
 *
 * `post` is `publishJobPost`'s: it appends a job and writes its allowlist the same way. The second post spends the
 * chunks of the job the first one appended, and the frame reads the loop's records at their own positions only when
 * the hop declares those kept chunks after them in the segment the turn writes in (ladder #19).
 */

const VALIDATOR_PROGRAM = framedValidator.buildValidatorProgram();
const category = (seed: number): string => binToHex(Uint8Array.from({ length: 32 }, (_unused, index) =>
  (seed * 31 + index * 7) & 0xff));
const JOURNAL_CATEGORY = category(0x13);
const JOURNAL_ADDRESS = validatorAddress(hexToBin(JOURNAL_CATEGORY), VALIDATOR_PROGRAM);

const SOURCE = [
  'pragma solidcash ^0.14.0;',
  'struct Note { uint8 kind; bytes who; }',
  'interface IJournal { function publish(int id, Note note); }',
  'contract Journal { int public notes; function publish(int id, Note note) { require(this.notes == 0); } }',
  'contract Desk {',
  '  struct Task { string title; int amount; }',
  '  address public implementation;',
  '  address public journal;',
  '  Task[] tasks;',
  '  mapping(int => mapping(address => bool)) allowlist;',
  '  function initialize(address j) { this.journal = j; }',
  '  function publishNote(int id, Note n) internal { IJournal(this.journal).publish(id, n); }',
  '  function setAllowed(int id, address[] allowed, address[] removed) {',
  '    for (uint i = 0; i < allowed.length; i++) {',
  '      this.allowlist[id][allowed[i]] = true;',
  '      publishNote(id, Note(14, abi.encodePacked(allowed[i])));',
  '    }',
  '    for (uint k = 0; k < removed.length; k++) {',
  '      this.allowlist[id][removed[k]] = false;',
  '      publishNote(id, Note(15, abi.encodePacked(removed[k])));',
  '    }',
  '  }',
  '  function post(string title, address[] allowed) {',
  '    this.tasks.push();',
  '    int id = this.tasks.length - 1;',
  '    this.tasks[id].title = title;',
  '    this.tasks[id].amount = 7;',
  '    for (uint i = 0; i < allowed.length; i++) {',
  '      this.allowlist[id][allowed[i]] = true;',
  '      publishNote(id, Note(14, abi.encodePacked(allowed[i])));',
  '    }',
  '  }',
  '}',
].join('\n');

const ARTIFACTS = compileStringMulti(SOURCE, { composition: 'framed' });
const DESK = ARTIFACTS.Desk!;
const JOURNAL = ARTIFACTS.Journal!;
const TASK = 7n;
const CALLER_LOCK = encodeLockingBytecodeP2pkh(alicePkh);

/** `count` workers whose allowlist slots under `id` ascend, so the loop's chain walks them in the caller's order. */
function ascendingWorkers(count: number, id: bigint): Uint8Array[] {
  return Array.from({ length: 40 }, (_unused, seed) => new Uint8Array(20).fill(seed * 3 + 1))
    .map((worker) => {
      const planned = planCallLoopWrites({
        artifact: DESK, functionName: 'setAllowed', args: [id, [worker], []], callerLockingBytecode: CALLER_LOCK,
      });
      return { worker, slot: bytesToSlotValue(keyToSlotMulti([...planned![0]!.turns[0]!.keys])) };
    })
    .sort((left, right) => (left.slot < right.slot ? -1 : 1))
    .slice(0, count)
    .map((entry) => entry.worker);
}

/** The allowlist values the transaction's outputs leave, by worker, read from the nodes under `id`. */
function allowlistOf(
  outputs: readonly { readonly token?: { readonly nft?: { readonly commitment?: Uint8Array } } }[],
  id: bigint, workers: readonly Uint8Array[],
): string[] {
  const slots = workers.map((worker) => {
    const planned = planCallLoopWrites({
      artifact: DESK, functionName: 'setAllowed', args: [id, [worker], []], callerLockingBytecode: CALLER_LOCK,
    });
    return bytesToHex(keyToSlotMulti([...planned![0]!.turns[0]!.keys]));
  });
  return slots.map((slot) => {
    const node = outputs.map((output) => output.token?.nft?.commitment)
      .find((commitment) => commitment !== undefined && commitment.length >= 64
        && bytesToHex(decodeEntryCommitment(commitment).slot) === slot);
    return node === undefined ? 'absent' : bytesToHex(decodeEntryCommitment(node).value);
  });
}

interface World {
  readonly network: MockNetworkProvider;
  readonly funder: ReturnType<Contract['unlock']['spend']>;
  readonly changeAddress: string;
  /** A fresh coin at the caller's lock for each call. */
  coin(): Promise<{ txid: string; vout: number; satoshis: bigint }>;
}

/** A network with the journal deployed and the validator facets funded. */
async function world(seed: number): Promise<World> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv));
  const journalFunding = { txid: JOURNAL_CATEGORY, vout: 0, satoshis: 500_000n };
  await network.addUtxo(wallet.address, journalFunding);
  await deployStatefulContract(JOURNAL, [], {
    fundingUtxo: journalFunding, funder, changeAddress: wallet.address, provider: network,
  });
  await fundShippedFacets(network);
  let serial = seed;
  return {
    network, funder, changeAddress: wallet.address,
    coin: async () => {
      serial += 1;
      const coin = { txid: category(serial), vout: 0, satoshis: 300_000n };
      await network.addUtxo(binToHex(CALLER_LOCK), coin);
      return coin;
    },
  };
}

const EXTERNALS = { IJournal: { artifact: JOURNAL, categoryId: JOURNAL_CATEGORY } };

/** The desk deployed behind its generated proxy, and a function that calls one of its entries through the hop. */
async function proxiedDesk(seed: number): Promise<{
  readonly call: (entry: string, args: readonly unknown[]) => ReturnType<typeof callFramedProxyEntry>;
}> {
  const net = await world(seed);
  const implementationFunding = { txid: category(seed + 100), vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: category(seed + 101), vout: 0, satoshis: 500_000n };
  for (const coin of [implementationFunding, proxyFunding]) await net.network.addUtxo(net.changeAddress, coin);
  const signature = new SignatureTemplate(alicePriv);
  const deployment = await deployFramedProxy({
    provider: net.network,
    implementationArtifact: DESK,
    proxyArtifact: buildProxyArtifact(DESK),
    implementationDeploy: { fundingUtxo: implementationFunding, funder: net.funder, changeAddress: net.changeAddress },
    proxyDeploy: { fundingUtxo: proxyFunding, funder: net.funder, changeAddress: net.changeAddress },
    initialize: { functionName: 'initialize', args: [JOURNAL_ADDRESS] },
    callerLockingBytecode: CALLER_LOCK,
    callerFunding: { utxo: await net.coin(), funder: signature.unlockP2PKH(), changeAddress: net.changeAddress },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.broadcast).toBeDefined();
  return {
    call: async (entry, args) => callFramedProxyEntry({
      provider: net.network,
      implementationArtifact: DESK,
      proxyArtifact: buildProxyArtifact(DESK),
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: entry,
      args: args as never,
      externals: EXTERNALS,
      callerUtxo: await net.coin(),
      callerLockingBytecode: CALLER_LOCK,
      funder: signature.unlockP2PKH(),
      changeAddress: net.changeAddress,
      vm: compositionMachine(),
    }),
  };
}

/** The ids of the verdicts the machine refused, with their objections. */
const refusals = (verdicts: readonly { id: string; accepted: boolean; objection?: string }[]): string[] =>
  verdicts.filter((verdict) => !verdict.accepted).map((verdict) => `${verdict.id}: ${verdict.objection ?? ''}`);

describe('a mapping write in a loop whose turns make calls, through the shipped paths', () => {
  it('the hop settles an allowlist update of two workers, then a removal in the second loop', async () => {
    const desk = await proxiedDesk(0x20);
    const [worker, other] = ascendingWorkers(2, TASK) as [Uint8Array, Uint8Array];
    const added = await desk.call('setAllowed', [TASK, [worker, other], []]);
    expect(refusals(added.verdicts)).toStrictEqual([]);
    expect(added.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(allowlistOf(added.transaction.outputs, TASK, [worker, other])).toStrictEqual(['01', '01']);
    // The second loop continues the run the first loop left, which ran no turn: its one turn rewrites the node the
    // first update created, and the collection's nodes are counted once, at its teardown.
    const removed = await desk.call('setAllowed', [TASK, [], [worker]]);
    expect(refusals(removed.verdicts)).toStrictEqual([]);
    expect(removed.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(allowlistOf(removed.transaction.outputs, TASK, [worker])).toStrictEqual(['']);
  }, 600_000);

  it('the plain path settles the same update of two workers', async () => {
    const net = await world(0x40);
    const funding = { txid: category(0x48), vout: 0, satoshis: 500_000n };
    await net.network.addUtxo(net.changeAddress, funding);
    const deployment = await deployStatefulContract(DESK, [], {
      fundingUtxo: funding, funder: net.funder, changeAddress: net.changeAddress, provider: net.network,
    });
    const call = async (entry: string, args: readonly unknown[]): ReturnType<typeof callFramedEntry> =>
      callFramedEntry({
        provider: net.network, artifact: DESK, categoryId: deployment.categoryId, functionName: entry,
        args: args as never, externals: EXTERNALS, callerUtxo: await net.coin(), callerLockingBytecode: CALLER_LOCK,
        funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress: net.changeAddress,
        vm: compositionMachine(),
      });
    expect((await call('initialize', [JOURNAL_ADDRESS])).accepted).toBe(true);
    const [first, second] = ascendingWorkers(2, TASK) as [Uint8Array, Uint8Array];
    const answered = await call('setAllowed', [TASK, [first, second], []]);
    expect(refusals(answered.verdicts)).toStrictEqual([]);
    expect(answered.accepted).toBe(true);
    expect(allowlistOf(answered.transaction.outputs, TASK, [first, second])).toStrictEqual(['01', '01']);
    // Two inserts into the empty list: the head is relinked where the first turn writes, the first worker's node is
    // minted where the second turn re-points it, the second's at the loop's teardown. Each segment declares the data
    // record, then the run's records minted so far, and a created node is read at its output after the segment that
    // creates it.
    const frame = answered.draft.blockOf('master');
    const created = (entry: { readonly in: number }): boolean => entry.in === INDEX_NONE;
    expect(frame.segments.map((segment) => segment.map((entry) => (created(entry) ? 'created' : 'declared'))))
      .toStrictEqual([
        ['declared', 'declared'],
        ['declared', 'declared', 'created'],
        ['declared', 'declared', 'declared', 'created'],
      ]);
  }, 600_000);

  it('the hop settles a post with an allowlist made twice, the second over the first post\'s chunks', async () => {
    const desk = await proxiedDesk(0x60);
    const [worker] = ascendingWorkers(1, 0n) as [Uint8Array];
    const firstPost = await desk.call('post', ['A', [worker]]);
    expect(refusals(firstPost.verdicts)).toStrictEqual([]);
    expect(firstPost.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // The second post spends the chunks of the job the first one appended. Its loop's records keep the position the
    // body reads them at in the segment the turn writes in, ahead of those chunks, which are kept there.
    const secondPost = await desk.call('post', ['B', [worker]]);
    expect(refusals(secondPost.verdicts)).toStrictEqual([]);
    expect(secondPost.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(allowlistOf(secondPost.transaction.outputs, 1n, [worker])).toStrictEqual(['01']);
  }, 600_000);
});
