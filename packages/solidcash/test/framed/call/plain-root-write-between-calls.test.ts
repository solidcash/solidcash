import { describe, expect, it } from 'vitest';
import { encodeDataPush } from '@bitauth/libauth';
import {
  INDEX_NONE, bytesEqual, concatBytes, encodeWitnessBlock, splitFirstPush, type RecordEntry, type WitnessBlock,
} from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { FramedCallResult } from '../../../src/framed/call/index.js';
import type { CompositionDraft } from '../../../src/framed/composer/index.js';
import { declareUnstatedCalls } from '../../../src/framed/proxy/planning-refusal.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import {
  compileFramed, deployPlain, enterPlain, newWorld, refusedVerdicts, type PlainDeployment, type World,
} from '../ahead/composition-world.js';

/**
 * A plain root that writes an element of its own chunked array between two calls, the call before the write waiting
 * on the result of an earlier one, on the plain call path (`callFramedEntry`).
 *
 * A board keeps its items in an array of structs holding strings. Taking an item reads the element, asks a static
 * oracle the fee for the item's amount, pays the amount and the fee into a vault, writes the reference the vault
 * returned into the element, and then records the take in a journal. The payment's fee is what the oracle returned,
 * so the call is first planned stopped before the payment: that plan states the oracle's call alone and declares the
 * write, past its last stated call, in its last segment. The calls from the stop on were declared beside copies of
 * that segment, the write included, so the root's own walk of its records, which runs before its body, met each copy
 * starting the array's chunks again from the views they were spent at and refused the frame: no call was bound and
 * the oracle never answered. Each segment past the stop now carries every record on from the view the last stated
 * segment leaves it at, as the hop keeps a record past the segment its write lands in (`declareUnstatedCalls`).
 *
 * The take settles and reads back. The array's run of chunk records is kept at its spent views until the frame's last
 * segment, where the epilogue pins the run, and written there once. A stopped block of the take, extended past its
 * stop, carries each record on from its written view in segments of its own; and a root block that declares the write
 * in the segment before the last too, so the last starts the chunks again from their spent views, is refused.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'struct Item { address owner; string title; uint256 amount; uint256 ref; }',
  'interface IOracle { function feeOf(uint256 amount) external view returns (uint256); }',
  'interface IVault { function pay(uint256 id, uint256 amount, uint256 fee) external returns (uint256); }',
  'interface IJournal { function record(uint256 id) external; }',
  'contract Oracle {',
  '  uint256 public rate;',
  '  constructor(uint256 rate_) { rate = rate_; }',
  '  function feeOf(uint256 amount) external view returns (uint256) { return amount * rate / 100; }',
  '}',
  'contract Vault {',
  '  uint256 public payments;',
  '  uint256 public collected;',
  '  function pay(uint256 id, uint256 amount, uint256 fee) external returns (uint256) {',
  '    payments += 1;',
  '    collected += amount + fee;',
  '    return payments * 100 + id;',
  '  }',
  '}',
  'contract Journal {',
  '  uint256 public count;',
  '  uint256 public last;',
  '  function record(uint256 id) external { count += 1; last = id; }',
  '}',
  'contract Board {',
  '  IOracle public oracle;',
  '  IVault public vault;',
  '  IJournal public journal;',
  '  Item[] internal items;',
  '  constructor(IOracle oracle_, IVault vault_, IJournal journal_) {',
  '    oracle = oracle_; vault = vault_; journal = journal_;',
  '  }',
  '  function post(string memory title, uint256 amount) external {',
  '    items.push(Item(msg.sender, title, amount, 0));',
  '  }',
  '  function take(uint256 id) external {',
  '    require(items[id].ref == 0, "taken");',
  '    uint256 amount = items[id].amount;',
  '    uint256 fee = oracle.feeOf(amount);',
  '    uint256 ref = vault.pay(id, amount, fee);',
  '    items[id].ref = ref;',
  '    journal.record(id);',
  '  }',
  '  function titleOf(uint256 id) external view returns (string memory) { return items[id].title; }',
  '  function refOf(uint256 id) external view returns (uint256) { return items[id].ref; }',
  '}',
].join('\n');

const artifacts = compileFramed(SOURCE);

const SHORT_TITLE = 'a first item';
/** A title long enough that the taken item's element spans more than one chunk record. */
const LONG_TITLE = 'a second item, titled at length: '.padEnd(150, 'x');
/** The oracle's rate, in percent of the amount. */
const RATE = 4n;
const AMOUNT = 250n;
const FEE = (AMOUNT * RATE) / 100n;
/** The reference the vault returns for the first payment it takes, for item 1. */
const REF = 101n;

interface Chain {
  readonly world: World;
  readonly board: PlainDeployment;
  readonly vault: PlainDeployment;
  readonly journal: PlainDeployment;
  readonly taken: FramedCallResult;
}

/** One entry of `root` that has to settle, entered by the user and reaching the deployments named. */
async function enter(
  world: World, root: PlainDeployment, functionName: string, args: readonly FunctionArgument[],
  reached: readonly PlainDeployment[] = [],
): Promise<FramedCallResult> {
  const outcome = await enterPlain(world, root, functionName, args, Object.fromEntries(reached.map((deployed) =>
    [deployed.artifact.contractName, { artifact: deployed.artifact, categoryId: deployed.categoryId }])));
  expect(outcome.error?.message).toBeUndefined();
  const refused = refusedVerdicts(outcome.result!);
  expect(refused, refused).toBeUndefined();
  expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return outcome.result!;
}

/** A view's value, read from a plain deployment's records and chunks through the read path. */
async function view(
  world: World, deployed: PlainDeployment, functionName: string, args: readonly FunctionArgument[] = [],
): Promise<unknown> {
  const read = await readFramedEntry({
    provider: world.network, artifact: deployed.artifact, categoryId: deployed.categoryId, functionName,
    args: [...args], vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

let chainRun: Promise<Chain> | undefined;
/** Two posted items, the second taken: its element spans chunk records and is written between two calls. */
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const world = await newWorld(0x6d);
    const oracle = await deployPlain(world, artifacts.Oracle!, [RATE]);
    const vault = await deployPlain(world, artifacts.Vault!);
    const journal = await deployPlain(world, artifacts.Journal!);
    const board = await deployPlain(world, artifacts.Board!, [oracle.address, vault.address, journal.address]);
    await enter(world, board, 'post', [SHORT_TITLE, 100n]);
    await enter(world, board, 'post', [LONG_TITLE, AMOUNT]);
    const taken = await enter(world, board, 'take', [1n], [oracle, vault, journal]);
    return { world, board, vault, journal, taken };
  })();
  return chainRun;
}

/** The root frame's block as the settled take declares it, with its master. */
function rootBlock(result: FramedCallResult): { master: string; block: WitnessBlock } {
  const roots = result.completed.filter((frame) => frame.functionName === 'Board.take()');
  expect(roots).toHaveLength(1);
  return { master: roots[0]!.master, block: structuredClone(result.draft.blockOf(roots[0]!.master)) as WitnessBlock };
}

/**
 * The records the take rewrites: spent records that every segment before the last keeps at the view they were spent
 * at and the last rewrites, as the epilogue pins a dynamic value's run of chunk records in the frame's last segment.
 */
function writtenInLast(block: WitnessBlock): readonly RecordEntry[] {
  const last = block.segments.length - 1;
  return block.segments[last]!.filter((entry) => entry.in !== INDEX_NONE && entry.out === entry.in
    && !bytesEqual(entry.viewIn, entry.viewOut)
    && block.segments.slice(0, last).every((segment) => segment.some((before) => before.in === entry.in
      && bytesEqual(before.viewIn, entry.viewIn) && bytesEqual(before.viewOut, entry.viewIn))));
}

type VmProgram = Parameters<ReturnType<typeof compositionMachine>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;

/** The participants the machine refuses on a transaction, by id. */
function refusedOn(result: FramedCallResult, transaction: VmTransaction): readonly string[] {
  const vm = compositionMachine();
  return result.draft.layout.participants.filter((placed) => vm.stateSuccess(vm.evaluate({
    inputIndex: placed.index, sourceOutputs: result.sourceOutputs, transaction,
  })) !== true).map((placed) => placed.id);
}

/** The settled transaction with one master's witness block replaced by `block`. */
function withBlock(result: FramedCallResult, master: string, block: WitnessBlock): VmTransaction {
  const forged = structuredClone(result.transaction) as VmTransaction;
  const index = result.draft.layout.participants.find((placed) => placed.id === master)!.index;
  const { rest } = splitFirstPush(forged.inputs[index]!.unlockingBytecode);
  forged.inputs[index] = {
    ...forged.inputs[index]!,
    unlockingBytecode: concatBytes([encodeDataPush(encodeWitnessBlock(block)), rest]),
  };
  return forged;
}

describe('a plain root writing an element of its own chunked array between two calls', () => {
  it('takes an item whose payment waits on the oracle\'s fee, and reads every write back', async () => {
    const { world, board, vault, journal, taken } = await chain();
    expect(taken.completed.map((frame) => frame.functionName).sort()).toStrictEqual([
      'Board.take()', 'Journal.record()', 'Oracle.feeOf()', 'Vault.pay()',
    ]);
    expect(await view(world, board, 'refOf', [1n])).toBe(REF);
    expect(await view(world, board, 'refOf', [0n])).toBe(0n);
    expect(await view(world, board, 'titleOf', [1n])).toBe(LONG_TITLE);
    expect(await view(world, board, 'titleOf', [0n])).toBe(SHORT_TITLE);
    expect(await view(world, vault, 'payments')).toBe(1n);
    expect(await view(world, vault, 'collected')).toBe(AMOUNT + FEE);
    expect(await view(world, journal, 'count')).toBe(1n);
    expect(await view(world, journal, 'last')).toBe(1n);
  }, 900_000);

  it('declares the array\'s chunks as one chain, kept until the last segment and written once there', async () => {
    const { taken } = await chain();
    const { block } = rootBlock(taken);
    expect(block.calls).toHaveLength(3);
    expect(block.segments).toHaveLength(4);
    // Every record's declarations are one chain: each carries on from the view the one before it ended at.
    const ends = new Map<number, Uint8Array>();
    for (const segment of block.segments) {
      for (const entry of segment) {
        const record = entry.in === INDEX_NONE ? entry.out : entry.in;
        const before = ends.get(record);
        if (before !== undefined) expect(bytesEqual(entry.viewIn, before)).toBe(true);
        ends.set(record, entry.viewOut);
      }
    }
    // The array's chunks are kept at their spent views until the last segment, which writes them once.
    expect(writtenInLast(block).length).toBeGreaterThan(0);
  }, 900_000);

  it('extends a stopped block past its stop with segments that carry each record on from its written view', async () => {
    const { board, taken } = await chain();
    const { master, block } = rootBlock(taken);
    const last = block.segments.length - 1;
    const written = writtenInLast(block);
    expect(written.length).toBeGreaterThan(0);
    // What a plan stopped before the payment states: the oracle's call alone, and the write past it in its last
    // segment, here beside a record that segment creates and one it consumes.
    const created: RecordEntry = { in: INDEX_NONE, out: 0x7e, viewIn: new Uint8Array(0), viewOut: Uint8Array.of(1) };
    const consumed: RecordEntry = { in: 0x7f, out: INDEX_NONE, viewIn: Uint8Array.of(2), viewOut: Uint8Array.of(2) };
    const stopped: WitnessBlock = {
      ...block,
      calls: block.calls.slice(0, 1),
      segments: [block.segments[0]!, [...block.segments[last]!, created, consumed]],
    };
    const draft = { runs: taken.draft.runs, blockOf: (): WitnessBlock => stopped } as unknown as CompositionDraft;
    declareUnstatedCalls(draft, board.artifact, master);
    expect(stopped.calls).toHaveLength(block.calls.length);
    expect(stopped.segments).toHaveLength(block.segments.length);
    const opened = stopped.segments[1]!;
    const carried = opened.filter((entry) => entry.in !== INDEX_NONE && entry.out !== INDEX_NONE);
    expect(carried).toHaveLength(
      block.segments[last]!.filter((entry) => entry.in !== INDEX_NONE && entry.out !== INDEX_NONE).length,
    );
    for (const segment of stopped.segments.slice(2)) {
      // Each segment past the stop holds entries of its own, each kept at the view the last stated segment ends at.
      expect(segment).toHaveLength(carried.length);
      segment.forEach((entry, at) => {
        const from = carried[at]!;
        expect(entry).not.toBe(from);
        expect([entry.in, entry.out]).toStrictEqual([from.in, from.out]);
        expect(bytesEqual(entry.viewIn, from.viewOut)).toBe(true);
        expect(bytesEqual(entry.viewOut, from.viewOut)).toBe(true);
      });
      // A record the last stated segment creates or consumes is declared by it alone.
      expect(segment.some((entry) => entry.out === created.out || entry.in === consumed.in)).toBe(false);
      // The array's chunks start from the views the write leaves, never from the views they were spent at.
      for (const write of written) {
        const declared = segment.filter((entry) => entry.in === write.in);
        expect(declared).toHaveLength(1);
        expect(bytesEqual(declared[0]!.viewIn, write.viewOut)).toBe(true);
      }
    }
  }, 900_000);

  it('refuses a root block whose last segment starts the chunks again from their spent views after a write', async () => {
    const { taken } = await chain();
    expect(refusedOn(taken, structuredClone(taken.transaction) as VmTransaction)).toStrictEqual([]);
    const { master, block } = rootBlock(taken);
    const last = block.segments.length - 1;
    const written = writtenInLast(block);
    expect(written.length).toBeGreaterThan(0);
    // The segment before the last declares the write too, so the last, which declares it from the spent views,
    // starts each chunk again from the view it was spent at rather than the one the write before it left.
    const forged: WitnessBlock = {
      ...block,
      segments: block.segments.map((segment, position) => (position !== last - 1 ? segment
        : segment.map((entry) => {
          const write = written.find((candidate) => candidate.in === entry.in);
          return write === undefined ? entry : { ...entry, viewOut: Uint8Array.from(write.viewOut) };
        }))),
    };
    expect(refusedOn(taken, withBlock(taken, master, forged))).toContain(master);
  }, 900_000);
});
