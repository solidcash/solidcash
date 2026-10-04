import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { INDEX_NONE, bytesEqual, type RecordEntry } from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { CompositionDraft } from '../../../src/per-call/composer/index.js';
import { chunkRecordLockingBytecode } from '../../../src/per-call/deploy/index.js';
import type { PerCallProxyCallResult } from '../../../src/per-call/proxy/index.js';
import type { PerCallProxyExternal } from '../../../src/per-call/proxy/external-calls.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import { bobPkh, carolPkh } from '../../fixture/vars.js';
import {
  USER_LOCK, compilePerCall, deployPlain, deployProxied, enterProxied, newWorld, refusedVerdicts,
  type PlainDeployment, type ProxiedDeployment, type World,
} from '../ahead/composition-world.js';

/**
 * An entry that writes several dynamic values, or one beside several sorted collections, behind the generated proxy.
 *
 * The frame's write segment declares every sorted batch's groups, then one run of chunk records per written dynamic
 * value, in state declaration order, each at the wider of the value it starts from and the value it writes. The
 * artifact publishes that order (`dynamicWriteOrder`) for an entry with several runs, or one beside several batches,
 * since the order the writes are emitted in (`dynamicWrites`) need not be it, and the hop lays the runs by it. A
 * ledger's payment rewrites two mappings and appends to a history; a roster's join appends to two arrays, in the
 * reverse of their declared order, the second time past a first run that grows to two chunks; a pair of labels is
 * set together as each grows and shrinks across a chunk boundary; a journal calls out and then appends to two
 * arrays, so its runs land in the segment the call opens; and a tally grows an array of fixed-width elements by bare
 * pushes. A fixed-width array is the tight blob its elements pack into, so an append adds its elements' width to the
 * live run's blob. Every call settles through the hop and is read back through the views; a plan that declares the
 * roster's runs in the order the entry writes them is refused by the frame itself.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'contract Ledger {',
  '  address public implementation;',
  '  uint256[] history;',
  '  mapping(address => uint256) balances;',
  '  mapping(address => uint256) credits;',
  '  function initialize() public {}',
  '  function pay(address to, uint256 v) external {',
  '    balances[to] += v;',
  '    credits[msg.sender] += 1;',
  '    history.push(v);',
  '  }',
  '  function record(address to, uint256 v) external { balances[to] += v; history.push(v); }',
  '  function balanceOf(address who) external view returns (uint256) { return balances[who]; }',
  '  function creditOf(address who) external view returns (uint256) { return credits[who]; }',
  '  function historyLength() external view returns (uint256) { return history.length; }',
  '  function historyAt(uint256 i) external view returns (uint256) { return history[i]; }',
  '}',
  'contract Roster {',
  '  address public implementation;',
  '  string[] names;',
  '  uint256[] ages;',
  '  function initialize() public {}',
  '  function join(string calldata n, uint256 a) external {',
  '    ages.push(a);',
  '    names.push(n);',
  '  }',
  '  function count() external view returns (uint256) { return names.length; }',
  '  function nameAt(uint256 i) external view returns (string memory) { return names[i]; }',
  '  function ageAt(uint256 i) external view returns (uint256) { return ages[i]; }',
  '}',
  'contract Labels {',
  '  address public implementation;',
  '  string first;',
  '  string second;',
  '  function initialize() public {}',
  '  function setBoth(string calldata a, string calldata b) external { first = a; second = b; }',
  '  function firstLabel() external view returns (string memory) { return first; }',
  '  function secondLabel() external view returns (string memory) { return second; }',
  '}',
  'interface IPing { function ping(uint256 k) external; }',
  'contract Sink {',
  '  uint256 lastPing;',
  '  function ping(uint256 k) external { lastPing = k; }',
  '  function pinged() external view returns (uint256) { return lastPing; }',
  '}',
  'contract Journal {',
  '  address public implementation;',
  '  address public sink;',
  '  string[] notes;',
  '  uint256[] stamps;',
  '  function initialize(address sink_) public { sink = sink_; }',
  '  function log(string calldata note, uint256 stamp) external {',
  '    IPing(sink).ping(stamp);',
  '    stamps.push(stamp);',
  '    notes.push(note);',
  '  }',
  '  function noteCount() external view returns (uint256) { return notes.length; }',
  '  function noteAt(uint256 i) external view returns (string memory) { return notes[i]; }',
  '  function stampAt(uint256 i) external view returns (uint256) { return stamps[i]; }',
  '}',
  'contract Tally {',
  '  address public implementation;',
  '  uint256[] counts;',
  '  function initialize() public {}',
  '  function add(uint256 v) external { counts.push(v); }',
  '  function grow() external { counts.push(); counts.push(); }',
  '  function count() external view returns (uint256) { return counts.length; }',
  '  function countAt(uint256 i) external view returns (uint256) { return counts[i]; }',
  '}',
].join('\n');

const units = compilePerCall(SOURCE);
const { Ledger, Roster, Labels, Sink, Journal, Tally } = units as Required<typeof units>;

const BOB = encodeLockingBytecodeP2pkh(bobPkh);
const CAROL = encodeLockingBytecodeP2pkh(carolPkh);
/** Past the 120 bytes one chunk record holds, so a value carrying it spans a run of two. */
const LONG_NAME = `a member whose name is long enough to carry its array past one chunk record ${'n'.repeat(60)}`;
const LONG_FIRST = `a first label long enough to span two chunk records once it is stored ${'f'.repeat(70)}`;
const LONG_SECOND = `a second label long enough to span two chunk records once it is stored ${'s'.repeat(70)}`;

/** One call through the hop, with the externals its calls reach; it has to settle and broadcast. */
async function settle(
  world: World, root: ProxiedDeployment, fn: string, args: readonly FunctionArgument[],
  externals: Readonly<Record<string, PerCallProxyExternal>> = {},
): Promise<PerCallProxyCallResult> {
  const outcome = await enterProxied(world, root, fn, args, externals);
  expect(outcome.error).toBeUndefined();
  expect(refusedVerdicts(outcome.result!)).toBeUndefined();
  expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return outcome.result!;
}

/** A view's value, read through the read path from a proxy's records or from a plain deployment's. */
async function view(
  world: World, root: ProxiedDeployment | PlainDeployment, fn: string, args: readonly FunctionArgument[] = [],
): Promise<unknown> {
  const categoryId = 'proxyCategoryId' in root ? root.proxyCategoryId : root.categoryId;
  const read = await readPerCallEntry({
    provider: world.network, artifact: root.artifact, categoryId, functionName: fn, args: [...args],
    vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

/** The participants that refuse the transaction a draft lays out for one master, by id. */
function refusingParticipants(draft: CompositionDraft, master: string): readonly string[] {
  const vm = compositionMachine();
  const { sourceOutputs, transaction } = draft.programFor(master);
  return draft.layout.participants.filter((placed) => vm.stateSuccess(vm.evaluate({
    inputIndex: placed.index, sourceOutputs, transaction,
  })) !== true).map((placed) => placed.id);
}

describe('several dynamic runs, and a run beside several sorted batches, behind the generated proxy', () => {
  it('publishes the order each frame declares its runs in, and none for one run beside one batch', () => {
    const facts = (artifact: typeof Ledger, entry: string): readonly (readonly string[] | undefined)[] => {
      const fn = artifact.abi.find((candidate) => candidate.name === entry)!;
      return [fn.dynamicWrites, fn.dynamicWriteOrder];
    };
    expect(facts(Ledger, 'pay')).toStrictEqual([['history'], ['history']]);
    expect(facts(Ledger, 'record')).toStrictEqual([['history'], undefined]);
    // The roster appends to its arrays in the reverse of their declared order; the frame declares them as declared.
    expect(facts(Roster, 'join')).toStrictEqual([['ages', 'names'], ['names', 'ages']]);
    expect(facts(Labels, 'setBoth')).toStrictEqual([['first', 'second'], ['first', 'second']]);
    expect(facts(Journal, 'log')).toStrictEqual([['stamps', 'notes'], ['notes', 'stamps']]);
    // A bare push states no element, only how many the write appends.
    const grow = Tally.abi.find((candidate) => candidate.name === 'grow')!;
    expect([grow.dynamicWriteSources, grow.dynamicWriteGrowth]).toStrictEqual([undefined, { counts: { elements: 2 } }]);
    for (const unit of [Ledger, Roster, Labels, Sink, Journal, Tally]) {
      expect(unit.composition?.refusedEntries ?? []).toStrictEqual([]);
    }
  });

  it('settles two mappings and an appended value written by one entry, each read back', async () => {
    const world = await newWorld(0x71);
    const ledger = await deployProxied(world, Ledger, []);
    await settle(world, ledger, 'pay', [BOB, 7n]);
    await settle(world, ledger, 'pay', [CAROL, 5n]);
    await settle(world, ledger, 'pay', [BOB, 4n]);
    expect(await view(world, ledger, 'balanceOf', [BOB])).toBe(11n);
    expect(await view(world, ledger, 'balanceOf', [CAROL])).toBe(5n);
    expect(await view(world, ledger, 'creditOf', [USER_LOCK])).toBe(3n);
    expect(await view(world, ledger, 'historyLength')).toBe(3n);
    expect(await view(world, ledger, 'historyAt', [2n])).toBe(4n);
  }, 600_000);

  it('settles two arrays one entry appends to, each read back, and refuses their runs declared in write order',
    async () => {
      const world = await newWorld(0x72);
      const roster = await deployProxied(world, Roster, []);
      await settle(world, roster, 'join', ['ann', 31n]);
      // The names grow past one chunk, so the ages' run sits past a run of two.
      const joined = await settle(world, roster, 'join', [LONG_NAME, 42n]);
      expect(await view(world, roster, 'count')).toBe(2n);
      expect(await view(world, roster, 'nameAt', [0n])).toBe('ann');
      expect(await view(world, roster, 'nameAt', [1n])).toBe(LONG_NAME);
      expect(await view(world, roster, 'ageAt', [1n])).toBe(42n);

      // The same records with the ages' run declared ahead of the names', the order the entry appends them in.
      const { draft, transaction } = joined;
      const master = draft.runs.find((run) => run.functionName === 'Roster.join()')!.master;
      expect(refusingParticipants(draft, master)).toStrictEqual([]);
      const runOf = (variable: string, type: string): ((entry: RecordEntry) => boolean) => {
        const lock = chunkRecordLockingBytecode(roster.proxyCategoryId, variable, type);
        return (entry) => entry.out !== INDEX_NONE
          && bytesEqual(transaction.outputs[entry.out]?.lockingBytecode ?? new Uint8Array(0), lock);
      };
      const segment = draft.blockOf(master).segments.find((records) => records.some(runOf('ages', 'uint256[]')))!;
      const names = segment.filter(runOf('names', 'string[]'));
      const ages = segment.filter(runOf('ages', 'uint256[]'));
      expect([names.length, ages.length]).toStrictEqual([2, 1]);
      const first = segment.indexOf(names[0]!);
      segment.splice(first, names.length + ages.length, ...ages, ...names);
      expect(refusingParticipants(draft, master)).toContain(master);
    }, 600_000);

  it('settles two strings one entry sets as each grows and shrinks across a chunk boundary, each read back',
    async () => {
      const world = await newWorld(0x73);
      const labels = await deployProxied(world, Labels, []);
      const read = async (): Promise<readonly unknown[]> =>
        [await view(world, labels, 'firstLabel'), await view(world, labels, 'secondLabel')];
      await settle(world, labels, 'setBoth', ['first label', 'second label']);
      expect(await read()).toStrictEqual(['first label', 'second label']);
      await settle(world, labels, 'setBoth', [LONG_FIRST, 'short']);
      expect(await read()).toStrictEqual([LONG_FIRST, 'short']);
      // The first label shrinks back into one chunk while the second, declared past its run, grows into two.
      await settle(world, labels, 'setBoth', ['tiny', LONG_SECOND]);
      expect(await read()).toStrictEqual(['tiny', LONG_SECOND]);
    }, 600_000);

  it('settles two arrays one entry appends to past an external call, each read back', async () => {
    const world = await newWorld(0x74);
    const sink = await deployPlain(world, Sink);
    const journal = await deployProxied(world, Journal, [sink.address]);
    const externals = { IPing: { artifact: Sink, categoryId: sink.categoryId } };
    await settle(world, journal, 'log', ['first note', 5n], externals);
    // The runs land in the segment the call opens; the notes grow past one chunk, ahead of the stamps.
    await settle(world, journal, 'log', [LONG_NAME, 6n], externals);
    expect(await view(world, journal, 'noteCount')).toBe(2n);
    expect(await view(world, journal, 'noteAt', [1n])).toBe(LONG_NAME);
    expect(await view(world, journal, 'stampAt', [1n])).toBe(6n);
    expect(await view(world, sink, 'pinged')).toBe(6n);
  }, 600_000);

  it('settles an array of fixed-width elements grown by bare pushes, each read back', async () => {
    const world = await newWorld(0x75);
    const tally = await deployProxied(world, Tally, []);
    await settle(world, tally, 'add', [7n]);
    // Each bare push adds one element's width to the live run's tight blob, the second call past one chunk record.
    await settle(world, tally, 'grow', []);
    await settle(world, tally, 'grow', []);
    expect(await view(world, tally, 'count')).toBe(5n);
    expect(await view(world, tally, 'countAt', [0n])).toBe(7n);
    expect(await view(world, tally, 'countAt', [4n])).toBe(0n);
  }, 600_000);
});
