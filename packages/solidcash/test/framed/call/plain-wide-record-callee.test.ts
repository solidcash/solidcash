import { describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush, encodeLockingBytecodeP2sh32, hexToBin } from '@bitauth/libauth';
import {
  INDEX_NONE, concatBytes, encodeWitnessBlock, splitFirstPush, type Artifact, type WitnessBlock,
} from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { FramedCallResult } from '../../../src/framed/call/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { lockingBytecodeToSolidityAddressPayload } from '../../../src/utils.js';
import {
  addressOfCategory, deployPlain, enterPlain, newWorld, refusedVerdicts, type PlainDeployment, type World,
} from '../ahead/composition-world.js';

/**
 * A plain root with a data record wider than 128 bytes calls a plain callee that appends to an array one id keys,
 * and appends to its own dynamic array, beside a run-time loop that turns no time.
 *
 * A board, compiled for a wide commitment so its one data record holds the log's and four other contract
 * addresses, appends an item and passes an entry on to a log, which appends it under the item's id. The board then
 * walks the workers its call names, each turn writing a mapping node and calling the log, and the call names none.
 * The artifact publishes the item's run of chunk records, and the record that counts the items, in the frame's last
 * segment. The plain call path placed a frame's records by its loop's turns once the frame had a loop, and every
 * record no turn mints in every segment as laid: the run's created chunk was created again, or its spent chunk
 * started over from its spent view, in each segment after the first, and the board's own settlement refused the
 * frame. Those records now land in the segment their write publishes, beside the loop as they do without one. Two
 * posts settle, the second rewriting the run the first created, and the count, the wide record and the log's
 * entries read back. A plan that declares one of the run's records in the frame's first segment as well, as the old
 * placement did, is refused by the board's own frame.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'struct Ev { uint256 kind; bytes body; }',
  'struct Item { address owner; uint256 tag; bytes note; }',
  'interface ILog {',
  '  function publish(uint256 id, Ev memory e) external;',
  '}',
  'contract Log {',
  '  mapping(uint256 => Ev[]) internal events;',
  '  function publish(uint256 id, Ev memory e) external { events[id].push(e); }',
  '  function eventsLength(uint256 id) external view returns (uint256) { return events[id].length; }',
  '  function eventAt(uint256 id, uint256 i) external view returns (Ev memory) { return events[id][i]; }',
  '}',
  'contract Board {',
  '  ILog public log;',
  '  address public first;',
  '  address public second;',
  '  address public third;',
  '  address public fourth;',
  '  uint256 public version;',
  '  Item[] internal items;',
  '  mapping(uint256 => mapping(address => bool)) internal allowed;',
  '  constructor(ILog log_, address first_, address second_, address third_, address fourth_) {',
  '    log = log_; first = first_; second = second_; third = third_; fourth = fourth_; version = 1;',
  '  }',
  '  function post(uint256 tag, bytes memory note, bytes memory label, address[] calldata allowed_)',
  '    external returns (uint256) {',
  '    items.push(Item(msg.sender, tag, note));',
  '    uint256 id = items.length - 1;',
  '    log.publish(id, Ev(1, label));',
  '    for (uint256 i = 0; i < allowed_.length; i++) {',
  '      allowed[id][allowed_[i]] = true;',
  '      log.publish(id, Ev(2, abi.encodePacked(allowed_[i])));',
  '    }',
  '    return id;',
  '  }',
  '  function itemsLength() external view returns (uint256) { return items.length; }',
  '}',
].join('\n');

const artifacts = compileStringMulti(SOURCE, {
  evmCompat: true, composition: 'framed', commitmentLimit: 10_000_000, maximumInputBytes: 10_000_000,
} as never);

/** The contract-shaped addresses the board's constructor stores beside the log's, each a distinct P2SH32 lock. */
const PEER_LOCKS = [0x41, 0x42, 0x43, 0x44].map((fill) => encodeLockingBytecodeP2sh32(new Uint8Array(32).fill(fill)));

/** The posts: each note long enough that its item takes chunk records of its own, and a short label for the log. */
const FIRST = { tag: 5n, note: hexToBin('b7'.repeat(90)), label: hexToBin('a1'.repeat(12)) };
const SECOND = { tag: 6n, note: hexToBin('7b'.repeat(70)), label: hexToBin('a2'.repeat(12)) };
const THIRD = { tag: 7n, note: hexToBin('d4'.repeat(50)), label: hexToBin('a3'.repeat(12)) };

interface Chain {
  readonly world: World;
  readonly log: PlainDeployment;
  readonly board: PlainDeployment;
}

/**
 * Deploys the board without a proxy, as `deployPlain` does, with its record holding more than the default 1,200
 * satoshis: a record this wide makes an output that value leaves below the dust threshold.
 */
async function deployWide(world: World, artifact: Artifact, constructorArgs: readonly unknown[]): Promise<PlainDeployment> {
  const deployment = await deployStatefulContract(artifact, constructorArgs as never, {
    provider: world.network, fundingUtxo: await world.walletCoin(), changeAddress: world.changeAddress,
    funder: world.walletFunder, dataNftAmount: 2_000n,
  });
  return { artifact, categoryId: deployment.categoryId, address: addressOfCategory(deployment.categoryId) };
}

let chainRun: Promise<Chain> | undefined;
/** The log and a board passing entries on to it, both deployed without a proxy. */
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const world = await newWorld(0x67);
    const log = await deployPlain(world, artifacts.Log!);
    const board = await deployWide(world, artifacts.Board!, [log.address, ...PEER_LOCKS]);
    return { world, log, board };
  })();
  return chainRun;
}

/** One post that has to settle: entered by the user, reaching the log, broadcast, and returning the item's id. */
async function post(c: Chain, item: typeof FIRST, id: bigint): Promise<FramedCallResult> {
  const outcome = await enterPlain(c.world, c.board, 'post', [item.tag, item.note, item.label, []], {
    Log: { artifact: c.log.artifact, categoryId: c.log.categoryId },
  });
  expect(outcome.error).toBeUndefined();
  expect(refusedVerdicts(outcome.result!)).toBeUndefined();
  expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  expect(outcome.result!.completed.map((frame) => frame.functionName)).toStrictEqual(['Log.publish()', 'Board.post()']);
  expect(outcome.result!.value).toBe(id);
  return outcome.result!;
}

/** A view's value, read from a deployment's records and nodes through the read path. */
async function view(
  c: Chain, deployed: { readonly artifact: Artifact; readonly categoryId: string }, functionName: string,
  args: readonly FunctionArgument[] = [],
): Promise<unknown> {
  const read = await readFramedEntry({
    provider: c.world.network, artifact: deployed.artifact, categoryId: deployed.categoryId, functionName,
    args: [...args], vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
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

describe('a plain root with a wide record whose callee appends under an id, beside a loop that turns no time', () => {
  it('posts twice, creating and then rewriting its own run, each read back', async () => {
    const c = await chain();
    const first = await post(c, FIRST, 0n);
    // The board's record is wider than 128 bytes and carries every address its constructor took at full width.
    const record = first.writtenCommitments.find((written) => written.length > 128);
    expect(record).toBeDefined();
    expect([c.log.address, ...PEER_LOCKS].every((lock) => binToHex(record!).includes(binToHex(lock)))).toBe(true);
    expect(await view(c, c.board, 'itemsLength')).toBe(1n);
    await post(c, SECOND, 1n);
    expect(await view(c, c.board, 'itemsLength')).toBe(2n);
    expect(binToHex(await view(c, c.board, 'fourth') as Uint8Array))
      .toBe(binToHex(lockingBytecodeToSolidityAddressPayload(PEER_LOCKS[3]!)!));
    expect(await view(c, c.board, 'version')).toBe(1n);
    expect(await view(c, c.log, 'eventsLength', [0n])).toBe(1n);
    expect(await view(c, c.log, 'eventsLength', [1n])).toBe(1n);
    expect(await view(c, c.log, 'eventAt', [0n, 0n])).toStrictEqual({ kind: 1n, body: FIRST.label });
    expect(await view(c, c.log, 'eventAt', [1n, 0n])).toStrictEqual({ kind: 1n, body: SECOND.label });
  }, 600_000);

  it('refuses at the board\'s frame a plan that declares its run in the segment before it lands as well', async () => {
    const c = await chain();
    const settled = await post(c, THIRD, 2n);
    expect(refusedOn(settled, structuredClone(settled.transaction) as VmTransaction)).toStrictEqual([]);
    const [board] = settled.completed.filter((frame) => frame.functionName === 'Board.post()');
    const block = structuredClone(settled.draft.blockOf(board!.master)) as WitnessBlock;
    expect(block.segments.length).toBeGreaterThan(1);
    // The run lands in the frame's last segment, after the call. A chunk it creates there, or else its last record,
    // declared in the first segment as well is a record created twice, or one that starts over from its spent view.
    const last = block.segments.at(-1)!;
    const landed = last.find((entry) => entry.in === INDEX_NONE) ?? last.at(-1)!;
    block.segments[0]!.push(structuredClone(landed));
    expect(refusedOn(settled, withBlock(settled, board!.master, block))).toContain(board!.master);
  }, 600_000);
});
