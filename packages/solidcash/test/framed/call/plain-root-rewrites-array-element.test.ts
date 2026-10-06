import { describe, expect, it } from 'vitest';
import { encodeDataPush } from '@bitauth/libauth';
import { INDEX_NONE, concatBytes, encodeWitnessBlock, splitFirstPush, type WitnessBlock } from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { PerCallCallResult } from '../../../src/per-call/call/index.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import {
  compilePerCall, deployPlain, enterPlain, newWorld, refusedVerdicts, type PlainDeployment, type World,
} from '../ahead/composition-world.js';

/**
 * A plain root that rewrites a field of an element its own array of structs holding strings already holds.
 *
 * The board is deployed with a constructor, so it is entered on the plain call path. A post pushes an element the
 * artifact states, so its run is sized from that element. A close sets one element's state and a retitle replaces one
 * element's title in place: the artifact states no element for either write, so the plain root refused the call before
 * broadcast, as a write whose appended element it publishes no source for. The run is now sized as the hop sizes a
 * frame's own: the live chunks are spent, the run is laid at the width the live record states, and once the body's own
 * close states the length it writes, a length that lays the run at another width plans the call again from it. Two
 * posts, a close, a retitle that grows the value past a chunk boundary and one that shrinks it back all settle and read
 * back, and a root frame whose block states another run for the element it rewrote is refused by that frame.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'struct Item { address owner; string title; uint256 state; }',
  'contract Board {',
  '  uint256 public fee;',
  '  Item[] internal items;',
  '  constructor(uint256 fee_) { fee = fee_; }',
  '  function post(string memory title) external {',
  '    items.push(Item(msg.sender, title, 0));',
  '  }',
  '  function close(uint256 id) external {',
  '    items[id].state = 2;',
  '  }',
  '  function retitle(uint256 id, string memory title) external {',
  '    items[id].title = title;',
  '  }',
  '  function itemsLength() external view returns (uint256) { return items.length; }',
  '  function titleOf(uint256 id) external view returns (string memory) { return items[id].title; }',
  '  function stateOf(uint256 id) external view returns (uint256) { return items[id].state; }',
  '}',
].join('\n');

const artifacts = compilePerCall(SOURCE);

const FIRST_TITLE = 'a first item on the board';
const SECOND_TITLE = 'a second item, titled apart';
/** A title long enough that retitling the second item with it takes the board's value past another chunk record. */
const LONG_TITLE = 'a second item, retitled at length: '.padEnd(170, 'x');
const SHORT_TITLE = 'short again';

interface Chain {
  readonly world: World;
  readonly board: PlainDeployment;
}

let chainRun: Promise<Chain> | undefined;
/** The board's chain: one plain deployment, made with its constructor. */
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const world = await newWorld(0x5b);
    const board = await deployPlain(world, artifacts.Board!, [7n]);
    return { world, board };
  })();
  return chainRun;
}

/** One entry of the board that has to settle and broadcast on the plain call path. */
async function enter(c: Chain, functionName: string, args: readonly FunctionArgument[]): Promise<PerCallCallResult> {
  const outcome = await enterPlain(c.world, c.board, functionName, args);
  expect(outcome.error).toBeUndefined();
  const refused = refusedVerdicts(outcome.result!);
  expect(refused, refused).toBeUndefined();
  expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return outcome.result!;
}

/** A view's value, read from the board's records and chunks through the read path. */
async function view(c: Chain, functionName: string, args: readonly FunctionArgument[] = []): Promise<unknown> {
  const read = await readPerCallEntry({
    provider: c.world.network, artifact: c.board.artifact, categoryId: c.board.categoryId, functionName,
    args: [...args], vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

/** Every item's title and state, in order. */
async function items(c: Chain): Promise<readonly (readonly unknown[])[]> {
  const count = await view(c, 'itemsLength') as bigint;
  const read: (readonly unknown[])[] = [];
  for (let id = 0n; id < count; id += 1n) read.push([await view(c, 'titleOf', [id]), await view(c, 'stateOf', [id])]);
  return read;
}

/** The root frame's block as the settled call declares it. */
function rootBlock(result: PerCallCallResult, functionName: string): { master: string; block: WitnessBlock } {
  const [root] = result.completed.filter((frame) => frame.functionName === `Board.${functionName}()`);
  expect(root).toBeDefined();
  return { master: root!.master, block: structuredClone(result.draft.blockOf(root!.master)) as WitnessBlock };
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

let closed: PerCallCallResult | undefined;

describe('a plain root rewriting an element its own array of structs holding strings holds', () => {
  it('posts two items and closes one, each on the plain path', async () => {
    const c = await chain();
    await enter(c, 'post', [FIRST_TITLE]);
    await enter(c, 'post', [SECOND_TITLE]);
    expect(await items(c)).toStrictEqual([[FIRST_TITLE, 0n], [SECOND_TITLE, 0n]]);
    closed = await enter(c, 'close', [0n]);
    expect(closed.completed.map((frame) => frame.functionName)).toStrictEqual(['Board.close()']);
    expect(await items(c)).toStrictEqual([[FIRST_TITLE, 2n], [SECOND_TITLE, 0n]]);
  }, 900_000);

  it('retitles an item past a chunk boundary and back, the run sized from the length the body writes', async () => {
    const c = await chain();
    const grown = await enter(c, 'retitle', [1n, LONG_TITLE]);
    // The longer value takes chunk records the live run does not hold: the run is laid at the width the body wrote.
    const grownEntries = rootBlock(grown, 'retitle').block.segments.flat();
    expect(grownEntries.some((entry) => entry.in === INDEX_NONE)).toBe(true);
    expect(await items(c)).toStrictEqual([[FIRST_TITLE, 2n], [LONG_TITLE, 0n]]);

    const shrunk = await enter(c, 'retitle', [1n, SHORT_TITLE]);
    // The shorter value leaves chunk records past its width, which the frame consumes with no successor.
    const shrunkEntries = rootBlock(shrunk, 'retitle').block.segments.flat();
    expect(shrunkEntries.some((entry) => entry.out === INDEX_NONE)).toBe(true);
    expect(await items(c)).toStrictEqual([[FIRST_TITLE, 2n], [SHORT_TITLE, 0n]]);

    await enter(c, 'close', [1n]);
    expect(await items(c)).toStrictEqual([[FIRST_TITLE, 2n], [SHORT_TITLE, 2n]]);
  }, 900_000);

  it('refuses a root frame whose block states another run for the element it rewrote', async () => {
    await chain();
    expect(closed).toBeDefined();
    const settled = closed!;
    expect(refusedOn(settled, structuredClone(settled.transaction) as VmTransaction)).toStrictEqual([]);
    const { master, block } = rootBlock(settled, 'close');
    // The run's chunk records follow the frame's own records in the segment that writes them.
    const segment = block.segments[block.segments.length - 1]!;
    const chunk = segment[segment.length - 1]!;
    expect(chunk.in).not.toBe(INDEX_NONE);
    expect(chunk.out).not.toBe(INDEX_NONE);
    expect(chunk.viewOut.length).toBeGreaterThan(0);
    const viewOut = Uint8Array.from(chunk.viewOut);
    viewOut[viewOut.length - 1] = (viewOut[viewOut.length - 1] ?? 0) ^ 0x01;
    const forged = {
      ...block,
      segments: block.segments.map((entries, position) => (position !== block.segments.length - 1 ? entries
        : entries.map((entry, at) => (at === entries.length - 1 ? { ...entry, viewOut } : entry)))),
    };
    expect(refusedOn(settled, withBlock(settled, master, forged))).toContain(master);
  }, 900_000);
});
