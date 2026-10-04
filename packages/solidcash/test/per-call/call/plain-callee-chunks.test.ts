import { describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush, hexToBin } from '@bitauth/libauth';
import { INDEX_NONE, concatBytes, encodeWitnessBlock, splitFirstPush, type WitnessBlock } from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { PerCallCallResult } from '../../../src/per-call/call/index.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import {
  compilePerCall, deployPlain, enterPlain, newWorld, refusedVerdicts, type PlainDeployment, type World,
} from '../ahead/composition-world.js';

/**
 * A plain root whose callee writes a value that chunks beside its other mapping writes, on the plain call path
 * (`callPerCallEntry`).
 *
 * A poster, deployed without a proxy, passes an entry on to a log, deployed on its own. The log appends the entry to
 * the array one id keys, counts it under that id and emits: its frame writes two collections and the array's value
 * is long enough to take a run of chunk records past the node that holds its digest. The log's frame declares each
 * write in the segment its artifact publishes for it, as the hop declares a callee's (`placeOwnWrites`), and lists
 * the value its body reads from its frame. Two posts settle, the first inserting the id's nodes and the second
 * rewriting them in place with the run grown, and the array, its elements and the count are read back through the
 * views. A plan whose log frame declares one of the run's chunk records otherwise than the transaction creates it is
 * refused by the log's own frame.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'struct Ev { uint256 kind; bytes body; }',
  'interface ILog {',
  '  function publish(uint256 id, Ev memory e) external;',
  '}',
  'contract Log {',
  '  mapping(uint256 => Ev[]) internal events;',
  '  mapping(uint256 => uint256) internal count;',
  '  event Published(uint256 id);',
  '  function publish(uint256 id, Ev memory e) external {',
  '    events[id].push(e);',
  '    count[id] += 1;',
  '    emit Published(id);',
  '  }',
  '  function eventsLength(uint256 id) external view returns (uint256) { return events[id].length; }',
  '  function eventAt(uint256 id, uint256 i) external view returns (Ev memory) { return events[id][i]; }',
  '  function countOf(uint256 id) external view returns (uint256) { return count[id]; }',
  '}',
  'contract Poster {',
  '  ILog public log;',
  '  constructor(ILog log_) { log = log_; }',
  '  function post(uint256 id, Ev memory e) external { log.publish(id, e); }',
  '}',
].join('\n');

const artifacts = compilePerCall(SOURCE);

/** The id every post appends under. */
const ID = 7n;

/** Entries whose bodies take the array's value past what its node holds inline. */
const FIRST = { kind: 1n, body: hexToBin('a5'.repeat(100)) };
const SECOND = { kind: 2n, body: hexToBin('5a'.repeat(80)) };
const THIRD = { kind: 3n, body: hexToBin('c3'.repeat(60)) };

interface Chain {
  readonly world: World;
  readonly log: PlainDeployment;
  readonly poster: PlainDeployment;
}

let chainRun: Promise<Chain> | undefined;
/** The log and a poster passing entries on to it, both deployed without a proxy. */
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const world = await newWorld(0x61);
    const log = await deployPlain(world, artifacts.Log!);
    const poster = await deployPlain(world, artifacts.Poster!, [log.address]);
    return { world, log, poster };
  })();
  return chainRun;
}

/** One post that has to settle: entered by the user, reaching the log, and broadcast. */
async function post(c: Chain, entry: typeof FIRST): Promise<PerCallCallResult> {
  const outcome = await enterPlain(c.world, c.poster, 'post', [ID, entry], {
    Log: { artifact: c.log.artifact, categoryId: c.log.categoryId },
  });
  expect(outcome.error).toBeUndefined();
  expect(refusedVerdicts(outcome.result!)).toBeUndefined();
  expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  expect(outcome.result!.completed.map((frame) => frame.functionName)).toStrictEqual(['Log.publish()', 'Poster.post()']);
  return outcome.result!;
}

/** A view's value, read from the log's records and nodes through the read path. */
async function view(c: Chain, functionName: string, args: readonly FunctionArgument[]): Promise<unknown> {
  const read = await readPerCallEntry({
    provider: c.world.network, artifact: c.log.artifact, categoryId: c.log.categoryId, functionName,
    args: [...args], vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
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

describe('a plain root whose callee appends a value that chunks beside its count', () => {
  it('posts twice under one id, inserting and then rewriting its nodes, each read back', async () => {
    const c = await chain();
    await post(c, FIRST);
    expect(await view(c, 'eventsLength', [ID])).toBe(1n);
    expect(await view(c, 'countOf', [ID])).toBe(1n);
    await post(c, SECOND);
    expect(await view(c, 'eventsLength', [ID])).toBe(2n);
    expect(await view(c, 'eventAt', [ID, 0n])).toStrictEqual(FIRST);
    expect(await view(c, 'eventAt', [ID, 1n])).toStrictEqual(SECOND);
    expect(await view(c, 'countOf', [ID])).toBe(2n);
  }, 600_000);

  it('refuses at the log\'s frame a plan that declares a chunk record of the grown run otherwise', async () => {
    const c = await chain();
    const settled = await post(c, THIRD);
    expect(refusedOn(settled, structuredClone(settled.transaction) as VmTransaction)).toStrictEqual([]);
    const [log] = settled.completed.filter((frame) => frame.functionName === 'Log.publish()');
    const block = structuredClone(settled.draft.blockOf(log!.master)) as WitnessBlock;
    // A chunk of the grown run is a record the transaction creates at a lock no input carries: the run's own
    // covenant, salted with the value it holds.
    const spentLocks = settled.sourceOutputs.map((output) => binToHex(output.lockingBytecode));
    const chunk = block.segments[0]!.find((entry) => entry.in === INDEX_NONE
      && !spentLocks.includes(binToHex(settled.transaction.outputs[entry.out]!.lockingBytecode)));
    expect(chunk).toBeDefined();
    const declared = Uint8Array.from(chunk!.viewOut);
    const last = declared.length - 1;
    declared[last] = declared[last]! ^ 0x01;
    chunk!.viewOut = declared;
    expect(refusedOn(settled, withBlock(settled, log!.master, block))).toContain(log!.master);
  }, 600_000);
});
