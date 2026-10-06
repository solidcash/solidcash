import { describe, expect, it } from 'vitest';
import { encodeDataPush, hexToBin } from '@bitauth/libauth';
import { concatBytes, encodeWitnessBlock, splitFirstPush, type WitnessBlock } from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { PerCallCallResult } from '../../../src/per-call/call/index.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import {
  USER_LOCK, compilePerCall, deployPlain, enterPlain, newWorld, refusedVerdicts, type PlainDeployment, type World,
} from '../ahead/composition-world.js';

/**
 * A plain root that returns a value, pulls a token through its allowance, pushes a struct holding a string onto its
 * own array and passes an entry on to a plain callee, which stores that entry whole.
 *
 * The callee appends the entry under the item's id, counts it and emits. The entry's bytes take its node past what the
 * node holds inline, so the value chunks, and the source states it: the call passes the root's own argument on. The
 * plan lays such a node from the stated value, so the view its declaration starts from is the view the callee's body
 * computes, and no close hands it back. The plain call path counted that view as owed for good: once the callee's
 * other values were learned, the plan stopped before reading the root, whose `retval` kept its candidate, and the
 * root's own frame refused the settlement at its return check. A callee frame the machine accepts now owes nothing,
 * as the hop settles an accepting callee. Two posts settle and return their ids; the items, the callee's entries and
 * counts and the token balances read back; and a root frame whose block records another return is refused by that
 * frame.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'struct Ev { uint256 kind; bytes body; }',
  'struct Item { address owner; uint256 tag; string title; }',
  'interface IToken {',
  '  function transferFrom(address from, address to, uint256 value) external returns (bool);',
  '}',
  'interface ILog {',
  '  function publish(uint256 id, Ev memory e) external;',
  '}',
  'contract Token {',
  '  event Transfer(address indexed from, address indexed to, uint256 value);',
  '  event Approval(address indexed owner, address indexed spender, uint256 value);',
  '  error InsufficientBalance(address sender, uint256 balance, uint256 needed);',
  '  error InsufficientAllowance(address spender, uint256 allowance, uint256 needed);',
  '  mapping(address => uint256) private _balances;',
  '  mapping(address => mapping(address => uint256)) private _allowances;',
  '  uint256 private _totalSupply;',
  '  function mint(address to, uint256 value) external { _update(address(0), to, value); }',
  '  function balanceOf(address account) external view returns (uint256) { return _balances[account]; }',
  '  function allowance(address owner, address spender) public view returns (uint256) {',
  '    return _allowances[owner][spender];',
  '  }',
  '  function approve(address spender, uint256 value) external returns (bool) {',
  '    _approve(msg.sender, spender, value, true);',
  '    return true;',
  '  }',
  '  function transferFrom(address from, address to, uint256 value) external returns (bool) {',
  '    _spendAllowance(from, msg.sender, value);',
  '    _update(from, to, value);',
  '    return true;',
  '  }',
  '  function _update(address from, address to, uint256 value) internal {',
  '    if (from == address(0)) {',
  '      _totalSupply += value;',
  '    } else {',
  '      uint256 fromBalance = _balances[from];',
  '      if (fromBalance < value) revert InsufficientBalance(from, fromBalance, value);',
  '      unchecked { _balances[from] = fromBalance - value; }',
  '    }',
  '    unchecked { _balances[to] += value; }',
  '    emit Transfer(from, to, value);',
  '  }',
  '  function _approve(address owner, address spender, uint256 value, bool emitEvent) internal {',
  '    _allowances[owner][spender] = value;',
  '    if (emitEvent) emit Approval(owner, spender, value);',
  '  }',
  '  function _spendAllowance(address owner, address spender, uint256 value) internal {',
  '    uint256 currentAllowance = allowance(owner, spender);',
  '    if (currentAllowance < type(uint256).max) {',
  '      if (currentAllowance < value) revert InsufficientAllowance(spender, currentAllowance, value);',
  '      unchecked { _approve(owner, spender, currentAllowance - value, false); }',
  '    }',
  '  }',
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
  'contract Board {',
  '  IToken public token;',
  '  ILog public log;',
  '  Item[] internal items;',
  '  constructor(IToken token_, ILog log_) { token = token_; log = log_; }',
  '  function post(uint256 tag, string memory title, Ev memory e, uint256 amount) external returns (uint256) {',
  '    token.transferFrom(msg.sender, address(this), amount);',
  '    items.push(Item(msg.sender, tag, title));',
  '    uint256 id = items.length - 1;',
  '    log.publish(id, e);',
  '    return id;',
  '  }',
  '  function itemsLength() external view returns (uint256) { return items.length; }',
  '}',
].join('\n');

const artifacts = compilePerCall(SOURCE);

/** The posts: each title long enough that its item takes chunk records, and an entry whose body chunks its node. */
const FIRST = {
  tag: 5n, title: 'a first post whose title runs well past what one record of the board holds inline', amount: 10n,
  e: { kind: 1n, body: hexToBin('a5'.repeat(100)) },
};
const SECOND = {
  tag: 6n, title: 'a second post, with a title of its own that also takes the item past one record', amount: 5n,
  e: { kind: 2n, body: hexToBin('5a'.repeat(80)) },
};

interface Chain {
  readonly world: World;
  readonly token: PlainDeployment;
  readonly log: PlainDeployment;
  readonly board: PlainDeployment;
}

/** One entry of `root` that has to settle, entered by the user and reaching the deployments named. */
async function enter(
  c: Pick<Chain, 'world'>, root: PlainDeployment, functionName: string, args: readonly FunctionArgument[],
  reached: readonly PlainDeployment[] = [],
): Promise<PerCallCallResult> {
  const outcome = await enterPlain(c.world, root, functionName, args, Object.fromEntries(reached.map((deployed) =>
    [deployed.artifact.contractName, { artifact: deployed.artifact, categoryId: deployed.categoryId }])));
  expect(outcome.error).toBeUndefined();
  const refused = refusedVerdicts(outcome.result!);
  expect(refused, refused).toBeUndefined();
  return outcome.result!;
}

let chainRun: Promise<Chain> | undefined;
/** The board's chain, every deployment plain: the user holds 100 of the token and allows the board 50 of them. */
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const world = await newWorld(0x6d);
    const token = await deployPlain(world, artifacts.Token!);
    const log = await deployPlain(world, artifacts.Log!);
    const board = await deployPlain(world, artifacts.Board!, [token.address, log.address]);
    const c = { world, token, log, board };
    await enter(c, token, 'mint', [USER_LOCK, 100n]);
    await enter(c, token, 'approve', [board.address, 50n]);
    return c;
  })();
  return chainRun;
}

/** One post that has to settle and broadcast, reaching the token and the log, and returning the item's id. */
async function post(c: Chain, item: typeof FIRST, id: bigint): Promise<PerCallCallResult> {
  const result = await enter(c, c.board, 'post', [item.tag, item.title, item.e, item.amount], [c.token, c.log]);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  expect(result.completed.map((frame) => frame.functionName).sort())
    .toStrictEqual(['Board.post()', 'Log.publish()', 'Token.transferFrom()']);
  expect(result.value).toBe(id);
  return result;
}

/** A view's value, read from a plain deployment's records and nodes through the read path. */
async function view(
  c: Chain, deployed: PlainDeployment, functionName: string, args: readonly FunctionArgument[] = [],
): Promise<unknown> {
  const read = await readPerCallEntry({
    provider: c.world.network, artifact: deployed.artifact, categoryId: deployed.categoryId, functionName,
    args: [...args], vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

/** The user's and the board's token balances, and the allowance the board has left. */
async function holdings(c: Chain): Promise<readonly unknown[]> {
  return [
    await view(c, c.token, 'balanceOf', [USER_LOCK]),
    await view(c, c.token, 'balanceOf', [c.board.address]),
    await view(c, c.token, 'allowance', [USER_LOCK, c.board.address]),
  ];
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

describe('a plain root returning beside its own push, a token pull and a callee storing a stated long value', () => {
  it('posts twice, each returning its id, and refuses a root frame that records another return', async () => {
    const c = await chain();
    await post(c, FIRST, 0n);
    expect(await view(c, c.board, 'itemsLength')).toBe(1n);
    const settled = await post(c, SECOND, 1n);
    expect(await view(c, c.board, 'itemsLength')).toBe(2n);
    expect(await view(c, c.log, 'eventsLength', [0n])).toBe(1n);
    expect(await view(c, c.log, 'eventsLength', [1n])).toBe(1n);
    expect(await view(c, c.log, 'eventAt', [0n, 0n])).toStrictEqual(FIRST.e);
    expect(await view(c, c.log, 'eventAt', [1n, 0n])).toStrictEqual(SECOND.e);
    expect(await view(c, c.log, 'countOf', [1n])).toBe(1n);
    expect(await holdings(c)).toStrictEqual([85n, 15n, 35n]);

    // The root's own frame binds its return: a block recording any other value is refused there.
    expect(refusedOn(settled, structuredClone(settled.transaction) as VmTransaction)).toStrictEqual([]);
    const [board] = settled.completed.filter((frame) => frame.functionName === 'Board.post()');
    const block = structuredClone(settled.draft.blockOf(board!.master)) as WitnessBlock;
    expect(block.retval.length).toBeGreaterThan(0);
    const retval = Uint8Array.from(block.retval);
    retval[retval.length - 1] = (retval[retval.length - 1] ?? 0) ^ 0x01;
    expect(refusedOn(settled, withBlock(settled, board!.master, { ...block, retval }))).toContain(board!.master);
  }, 900_000);
});
