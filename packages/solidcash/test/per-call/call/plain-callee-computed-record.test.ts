import { describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush, utf8ToBin } from '@bitauth/libauth';
import {
  INDEX_NONE, VALUE_INLINE_LIMIT, concatBytes, encodeWitnessBlock, hash160, splitFirstPush, type WitnessBlock,
} from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { PerCallCallResult } from '../../../src/per-call/call/index.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import {
  compilePerCall, deployPlain, enterPlain, newWorld, refusedVerdicts, type PlainDeployment, type World,
} from '../ahead/composition-world.js';

/**
 * A plain root whose callee writes a record its own body computes part of, on the plain call path
 * (`callPerCallEntry`).
 *
 * A desk, deployed without a proxy, files notes in a book, deployed on its own. The book keeps each note in a record
 * holding its owner, the time it was filed and the note itself: a struct holding a string, whose value chunks. The
 * time is the frame's own clock, and a later touch rewrites it behind a ternary, so the artifact states neither value
 * and the plan lays each write with its run of chunk records unstated. The book's own chunk pin then stops on the
 * count its body computed, with the value and its digest beside it: the call reads the value there and plans the
 * write again from it, as the hop plans its callee's (`planCalleeWrites`). A filing and a touch settle and are read
 * back through the views, and a plan whose book frame declares a chunk record of the value otherwise is refused by
 * the book's own frame.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'struct Rec { address owner; uint64 at; string note; }',
  'contract Book {',
  '  mapping(uint256 => Rec) internal recs;',
  '  function open(uint256 id, string calldata note) external returns (uint256) {',
  '    recs[id] = Rec(msg.sender, uint64(block.timestamp), note);',
  '    return id;',
  '  }',
  '  function touch(uint256 id) external {',
  '    recs[id].at = recs[id].at > 0 ? recs[id].at + 1 : uint64(1);',
  '  }',
  '  function noteOf(uint256 id) external view returns (string memory) { return recs[id].note; }',
  '  function atOf(uint256 id) external view returns (uint64) { return recs[id].at; }',
  '  function ownerOf(uint256 id) external view returns (address) { return recs[id].owner; }',
  '}',
  'contract Desk {',
  '  Book public book;',
  '  uint256 internal last;',
  '  constructor(Book book_) { book = book_; }',
  '  function file(uint256 id, string calldata note) external returns (uint256) {',
  '    last = book.open(id, note);',
  '    return last;',
  '  }',
  '  function retouch(uint256 id) external { book.touch(id); }',
  '  function lastId() external view returns (uint256) { return last; }',
  '}',
].join('\n');

const artifacts = compilePerCall(SOURCE);

/** Notes long enough that the record holding one crosses what its node holds inline. */
const NOTE = 'abcdefghijklmnopqrstuvwxyz'.repeat(4);
const OTHER_NOTE = 'zyxwvutsrqponmlkjihgfedcba'.repeat(3);
const ID = 3n;
const OTHER_ID = 4n;

interface Chain {
  readonly world: World;
  readonly book: PlainDeployment;
  readonly desk: PlainDeployment;
}

let chainRun: Promise<Chain> | undefined;
/** The book and a desk filing in it, both deployed without a proxy. */
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const world = await newWorld(0x62);
    const book = await deployPlain(world, artifacts.Book!);
    const desk = await deployPlain(world, artifacts.Desk!, [book.address]);
    return { world, book, desk };
  })();
  return chainRun;
}

/** One desk entry that has to settle: entered by the user, reaching the book, and broadcast. */
async function enter(
  c: Chain, functionName: string, args: readonly FunctionArgument[], frames: readonly string[],
): Promise<PerCallCallResult> {
  const outcome = await enterPlain(c.world, c.desk, functionName, args, {
    Book: { artifact: c.book.artifact, categoryId: c.book.categoryId },
  });
  expect(outcome.error).toBeUndefined();
  expect(refusedVerdicts(outcome.result!)).toBeUndefined();
  expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  expect(outcome.result!.completed.map((frame) => frame.functionName)).toStrictEqual(frames);
  return outcome.result!;
}

/** A view's value, read from a deployment's records and nodes through the read path. */
async function view(
  c: Chain, deployment: PlainDeployment, functionName: string, args: readonly FunctionArgument[],
): Promise<unknown> {
  const read = await readPerCallEntry({
    provider: c.world.network, artifact: deployment.artifact, categoryId: deployment.categoryId, functionName,
    args: [...args], vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

/** True when an address read back names the contract whose lock is `lock`: the lock itself, or its hash160. */
function namesContract(value: unknown, lock: Uint8Array): boolean {
  const hex = value instanceof Uint8Array ? binToHex(value) : String(value);
  return hex === binToHex(hash160(lock)) || hex === binToHex(lock);
}

type VmProgram = Parameters<ReturnType<typeof compositionMachine>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;

/** The participants the machine refuses on a transaction, by id. */
function refusedOn(result: PerCallCallResult, transaction: VmTransaction): readonly string[] {
  const vm = compositionMachine();
  return result.draft.layout.participants.filter((placed) => vm.stateSuccess(vm.evaluate({
    inputIndex: placed.index, sourceOutputs: result.sourceOutputs, transaction,
  })) !== true).map((placed) => placed.id);
}

/** The settled transaction with one master's witness block replaced by `block`. */
function withBlock(result: PerCallCallResult, master: string, block: WitnessBlock): VmTransaction {
  const forged = structuredClone(result.transaction) as VmTransaction;
  const index = result.draft.layout.participants.find((placed) => placed.id === master)!.index;
  const { rest } = splitFirstPush(forged.inputs[index]!.unlockingBytecode);
  forged.inputs[index] = {
    ...forged.inputs[index]!,
    unlockingBytecode: concatBytes([encodeDataPush(encodeWitnessBlock(block)), rest]),
  };
  return forged;
}

describe('a plain root whose callee writes a record its own body computes part of', () => {
  it('files a note stamped with the frame\'s clock, then touches the stamp behind a ternary, each read back', async () => {
    const c = await chain();
    expect(utf8ToBin(NOTE).length).toBeGreaterThan(VALUE_INLINE_LIMIT);
    const filed = await enter(c, 'file', [ID, NOTE], ['Book.open()', 'Desk.file()']);
    expect(filed.values).toStrictEqual([ID]);
    expect(await view(c, c.desk, 'lastId', [])).toBe(ID);
    expect(await view(c, c.book, 'noteOf', [ID])).toBe(NOTE);
    expect(namesContract(await view(c, c.book, 'ownerOf', [ID]), c.desk.address)).toBe(true);
    const stamped = await view(c, c.book, 'atOf', [ID]);
    expect(typeof stamped).toBe('bigint');

    await enter(c, 'retouch', [ID], ['Book.touch()', 'Desk.retouch()']);
    const before = stamped as bigint;
    expect(await view(c, c.book, 'atOf', [ID])).toBe(before > 0n ? before + 1n : 1n);
    expect(await view(c, c.book, 'noteOf', [ID])).toBe(NOTE);
    expect(namesContract(await view(c, c.book, 'ownerOf', [ID]), c.desk.address)).toBe(true);
  }, 600_000);

  it('refuses at the book\'s frame a plan that declares a chunk record of the value otherwise', async () => {
    const c = await chain();
    const settled = await enter(c, 'file', [OTHER_ID, OTHER_NOTE], ['Book.open()', 'Desk.file()']);
    expect(await view(c, c.book, 'noteOf', [OTHER_ID])).toBe(OTHER_NOTE);
    expect(refusedOn(settled, structuredClone(settled.transaction) as VmTransaction)).toStrictEqual([]);
    const [book] = settled.completed.filter((frame) => frame.functionName === 'Book.open()');
    const block = structuredClone(settled.draft.blockOf(book!.master)) as WitnessBlock;
    // A chunk of the value's run is a record the transaction creates at a lock no input carries: the run's own
    // covenant, salted with the value it holds.
    const spentLocks = settled.sourceOutputs.map((output) => binToHex(output.lockingBytecode));
    const chunk = block.segments[0]!.find((entry) => entry.in === INDEX_NONE
      && !spentLocks.includes(binToHex(settled.transaction.outputs[entry.out]!.lockingBytecode)));
    expect(chunk).toBeDefined();
    const declared = Uint8Array.from(chunk!.viewOut);
    const last = declared.length - 1;
    declared[last] = declared[last]! ^ 0x01;
    chunk!.viewOut = declared;
    expect(refusedOn(settled, withBlock(settled, book!.master, block))).toContain(book!.master);
  }, 600_000);
});
