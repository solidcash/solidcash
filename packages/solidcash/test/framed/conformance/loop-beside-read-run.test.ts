import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { bytesToHex, validatorAddress } from '@solidcash/utils';
import { framedValidator } from 'solidc';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { planCallLoopWrites } from '../../../src/framed/call/entry-records.js';
import { buildProxyArtifact, callFramedProxyEntry, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { bytesToSlotValue, decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A job read ahead of a mapping write in a loop whose turns make calls, through the proxy hop.
 *
 * The shape is the fixture's `updateJobWhitelist` (`.marketplace/contracts/MarketplaceV1.sol:458-500`): the entry
 * reads the job, a record of the dynamic `jobs` array whose bytes live in a run of chunk records, and requires its
 * state before its loops write the allowlist and call the store each turn (ladder #30). The loop's records are
 * declared one per record its turns mint, so the hop declares the run the entry only reads past them, as each
 * segment's last family, and the frame finds it from the declaration's own end. A job that fails the entry's
 * require is reported with the entry's own reason, before any turn runs.
 */

const VALIDATOR_PROGRAM = framedValidator.buildValidatorProgram();
const category = (seed: number): string => binToHex(Uint8Array.from({ length: 32 }, (_unused, index) =>
  (seed * 29 + index * 11) & 0xff));
const JOURNAL_CATEGORY = category(0x17);
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
  '  function post(string title, int amount) {',
  '    this.tasks.push();',
  '    int id = this.tasks.length - 1;',
  '    this.tasks[id].title = title;',
  '    this.tasks[id].amount = amount;',
  '  }',
  '  function setAllowed(int id, address[] allowed, address[] removed) {',
  '    require(this.tasks[id].amount == 7, "not open");',
  '    for (uint i = 0; i < allowed.length; i++) {',
  '      this.allowlist[id][allowed[i]] = true;',
  '      publishNote(id, Note(14, abi.encodePacked(allowed[i])));',
  '    }',
  '    for (uint k = 0; k < removed.length; k++) {',
  '      this.allowlist[id][removed[k]] = false;',
  '      publishNote(id, Note(15, abi.encodePacked(removed[k])));',
  '    }',
  '  }',
  '}',
].join('\n');

const ARTIFACTS = compileStringMulti(SOURCE, { composition: 'framed' });
const DESK = ARTIFACTS.Desk!;
const JOURNAL = ARTIFACTS.Journal!;
const OPEN = 0n;
const CLOSED = 1n;
const CALLER_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
/** A title long enough that the job's record takes more than one chunk. */
const TITLE = 'a job whose title runs past the one hundred and twenty bytes a single chunk record of the run carries, '
  + 'so the run the entry reads is two chunks long';

/** The allowlist slot of `worker` under `id`, as the loop's planner keys it. */
function slotOf(id: bigint, worker: Uint8Array): string {
  const planned = planCallLoopWrites({
    artifact: DESK, functionName: 'setAllowed', args: [id, [worker], []], callerLockingBytecode: CALLER_LOCK,
  });
  return bytesToHex(keyToSlotMulti([...planned![0]!.turns[0]!.keys]));
}

/** `count` workers whose allowlist slots under `id` ascend, so the loop's chain walks them in the caller's order. */
function ascendingWorkers(count: number, id: bigint): Uint8Array[] {
  return Array.from({ length: 40 }, (_unused, seed) => new Uint8Array(20).fill(seed * 5 + 2))
    .map((worker) => ({ worker, slot: bytesToSlotValue(hexToBin(slotOf(id, worker))) }))
    .sort((left, right) => (left.slot < right.slot ? -1 : 1))
    .slice(0, count)
    .map((entry) => entry.worker);
}

/** The allowlist values the transaction's outputs leave, by worker, read from the nodes under `id`. */
function allowlistOf(
  outputs: readonly { readonly token?: { readonly nft?: { readonly commitment?: Uint8Array } } }[],
  id: bigint, workers: readonly Uint8Array[],
): string[] {
  return workers.map((worker) => slotOf(id, worker)).map((slot) => {
    const node = outputs.map((output) => output.token?.nft?.commitment)
      .find((commitment) => commitment !== undefined && commitment.length >= 64
        && bytesToHex(decodeEntryCommitment(commitment).slot) === slot);
    return node === undefined ? 'absent' : bytesToHex(decodeEntryCommitment(node).value);
  });
}

/** The desk deployed behind its generated proxy, and a function that calls one of its entries through the hop. */
async function proxiedDesk(seed: number): Promise<{
  readonly call: (entry: string, args: readonly unknown[]) => ReturnType<typeof callFramedProxyEntry>;
}> {
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
  const coin = async (): Promise<{ txid: string; vout: number; satoshis: bigint }> => {
    serial += 1;
    const utxo = { txid: category(serial), vout: 0, satoshis: 300_000n };
    await network.addUtxo(binToHex(CALLER_LOCK), utxo);
    return utxo;
  };
  const implementationFunding = { txid: category(seed + 100), vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: category(seed + 101), vout: 0, satoshis: 500_000n };
  for (const utxo of [implementationFunding, proxyFunding]) await network.addUtxo(wallet.address, utxo);
  const signature = new SignatureTemplate(alicePriv);
  const deployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: DESK,
    proxyArtifact: buildProxyArtifact(DESK),
    implementationDeploy: { fundingUtxo: implementationFunding, funder, changeAddress: wallet.address },
    proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress: wallet.address },
    initialize: { functionName: 'initialize', args: [JOURNAL_ADDRESS] },
    callerLockingBytecode: CALLER_LOCK,
    callerFunding: { utxo: await coin(), funder: signature.unlockP2PKH(), changeAddress: wallet.address },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.broadcast).toBeDefined();
  return {
    call: async (entry, args) => callFramedProxyEntry({
      provider: network,
      implementationArtifact: DESK,
      proxyArtifact: buildProxyArtifact(DESK),
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: entry,
      args: args as never,
      externals: { IJournal: { artifact: JOURNAL, categoryId: JOURNAL_CATEGORY } },
      callerUtxo: await coin(),
      callerLockingBytecode: CALLER_LOCK,
      funder: signature.unlockP2PKH(),
      changeAddress: wallet.address,
      vm: compositionMachine(),
    }),
  };
}

/** The ids of the verdicts the machine refused, with their objections. */
const refusals = (verdicts: readonly { id: string; accepted: boolean; objection?: string }[]): string[] =>
  verdicts.filter((verdict) => !verdict.accepted).map((verdict) => `${verdict.id}: ${verdict.objection ?? ''}`);

describe('a job read ahead of a mapping write in a loop whose turns make calls, through the hop', () => {
  it('publishes the read beside the loops', () => {
    expect(DESK.abi.find((entry) => entry.name === 'setAllowed')!.dynamicReads).toStrictEqual(['tasks']);
  });

  it('reports the entry\'s own reason for a closed job, then settles an update and a removal of an open one', async () => {
    const desk = await proxiedDesk(0x30);
    for (const amount of [7n, 5n]) {
      const posted = await desk.call('post', [TITLE, amount]);
      expect(refusals(posted.verdicts)).toStrictEqual([]);
      expect(posted.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    }
    const [worker, other] = ascendingWorkers(2, OPEN) as [Uint8Array, Uint8Array];
    // The closed job fails the entry's require before its loop runs a turn, so no call is made.
    await expect(desk.call('setAllowed', [CLOSED, [worker], []])).rejects.toThrow(/not open/);
    const added = await desk.call('setAllowed', [OPEN, [worker, other], []]);
    expect(refusals(added.verdicts)).toStrictEqual([]);
    expect(added.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(allowlistOf(added.transaction.outputs, OPEN, [worker, other])).toStrictEqual(['01', '01']);
    const removed = await desk.call('setAllowed', [OPEN, [], [worker]]);
    expect(refusals(removed.verdicts)).toStrictEqual([]);
    expect(removed.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(allowlistOf(removed.transaction.outputs, OPEN, [worker])).toStrictEqual(['']);
  }, 600_000);
});
