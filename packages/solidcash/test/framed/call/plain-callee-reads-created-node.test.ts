import { describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush } from '@bitauth/libauth';
import {
  INDEX_NONE, concatBytes, encodeWitnessBlock, splitFirstPush, type RecordEntry, type WitnessBlock,
} from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { FramedCallResult } from '../../../src/framed/call/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import {
  USER_LOCK, addressOfCategory, compileFramed, deployPlain, enterPlain, newWorld, refusedVerdicts,
  type PlainDeployment, type World,
} from '../ahead/composition-world.js';

/**
 * A plain callee that only reads a mapping node an earlier frame of its own contract created in the same call, on the
 * plain call path (`callFramedEntry`).
 *
 * The created node carries no input: the frame that created it places it as an output, so the frame that reads it
 * names it at that output, as the hop names it, and its kept declaration chains onto the creator's.
 *
 * `Reader.creditAndRead` credits a key the ledger has never held and reads the balance back a call later, keeping
 * what it read in its own record. `Holder.approveAndPull` approves a puller for the type's maximum and has it pull:
 * the token's `transferFrom`, entered by the puller, reads the allowance the root's `approve` created and, in the
 * shape of an OpenZeppelin 5 token, leaves an unlimited one as it is, so the node is only read. Both settle and every
 * value is read back. A block whose read states another value than the created output carries is refused.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface ILedger {',
  '  function credit(address who, uint256 amount) external;',
  '  function balanceOf(address who) external view returns (uint256);',
  '}',
  'interface IToken {',
  '  function approve(address spender, uint256 value) external returns (bool);',
  '  function transferFrom(address from, address to, uint256 value) external returns (bool);',
  '}',
  'interface IPuller {',
  '  function pull(uint256 amount) external;',
  '}',
  'contract Ledger {',
  '  mapping(address => uint256) private _balances;',
  '  function credit(address who, uint256 amount) external { _balances[who] += amount; }',
  '  function balanceOf(address who) external view returns (uint256) { return _balances[who]; }',
  '}',
  'contract Reader {',
  '  ILedger public ledger;',
  '  uint256 public seen;',
  '  constructor(ILedger ledger_) { ledger = ledger_; }',
  '  function creditAndRead(address fresh) external {',
  '    ledger.credit(fresh, 5);',
  '    seen = ledger.balanceOf(fresh);',
  '  }',
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
  '    _transfer(from, to, value);',
  '    return true;',
  '  }',
  '  function _transfer(address from, address to, uint256 value) internal { _update(from, to, value); }',
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
  'contract Puller {',
  '  IToken public token;',
  '  constructor(IToken token_) { token = token_; }',
  '  function pull(uint256 amount) external { token.transferFrom(msg.sender, address(this), amount); }',
  '}',
  'contract Holder {',
  '  IToken public token;',
  '  IPuller public puller;',
  '  constructor(IToken token_, IPuller puller_) { token = token_; puller = puller_; }',
  '  function approveAndPull(uint256 amount) external {',
  '    token.approve(address(puller), type(uint256).max);',
  '    puller.pull(amount);',
  '  }',
  '}',
].join('\n');

const artifacts = compileFramed(SOURCE);

const UNLIMITED = (1n << 256n) - 1n;

/** One entry of `root` that has to settle, entered by the user and reaching the deployments named. */
async function enter(
  world: World, root: PlainDeployment, functionName: string, args: readonly FunctionArgument[],
  reached: readonly PlainDeployment[] = [],
): Promise<FramedCallResult> {
  const outcome = await enterPlain(world, root, functionName, args, Object.fromEntries(reached.map((deployed) =>
    [deployed.artifact.contractName, { artifact: deployed.artifact, categoryId: deployed.categoryId }])));
  expect(outcome.error?.message).toBeUndefined();
  expect(refusedVerdicts(outcome.result!)).toBeUndefined();
  return outcome.result!;
}

/** A view's value, read from a plain deployment's records and nodes through the read path. */
async function view(
  world: World, deployed: PlainDeployment, functionName: string, args: readonly FunctionArgument[],
): Promise<unknown> {
  const read = await readFramedEntry({
    provider: world.network, artifact: deployed.artifact, categoryId: deployed.categoryId, functionName,
    args: [...args], vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

interface Credited {
  readonly world: World;
  readonly ledger: PlainDeployment;
  readonly reader: PlainDeployment;
  readonly fresh: Uint8Array;
  readonly result: FramedCallResult;
}

let creditRun: Promise<Credited> | undefined;
/** The reader's call on a ledger that holds one other key: it credits a fresh key 5 and reads its balance back. */
function credited(): Promise<Credited> {
  creditRun ??= (async (): Promise<Credited> => {
    const world = await newWorld(0x73);
    const ledger = await deployPlain(world, artifacts.Ledger!);
    const reader = await deployPlain(world, artifacts.Reader!, [ledger.address]);
    await enter(world, ledger, 'credit', [USER_LOCK, 1n]);
    const fresh = addressOfCategory('5a'.repeat(32));
    const result = await enter(world, reader, 'creditAndRead', [fresh], [ledger]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    return { world, ledger, reader, fresh, result };
  })();
  return creditRun;
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

/** The master of the one frame of `result` that ran `entry`. */
function frameOf(result: FramedCallResult, entry: string): string {
  const frames = result.completed.filter((frame) => frame.functionName.endsWith(`.${entry}()`));
  expect(frames).toHaveLength(1);
  return frames[0]!.master;
}

/** The declarations of the frame that ran `entry` that name a node by an output, holding no input for it. */
function namedByOutput(result: FramedCallResult, entry: string): readonly RecordEntry[] {
  return result.draft.blockOf(frameOf(result, entry)).segments.flat()
    .filter((declared) => declared.in === INDEX_NONE);
}

/** The commitment output `index` of the settled transaction carries. */
function commitmentAt(result: FramedCallResult, index: number): string {
  return binToHex(result.transaction.outputs[index]?.token?.nft?.commitment ?? new Uint8Array(0));
}

describe('a plain callee that reads a mapping node an earlier frame of its contract created', () => {
  it('reads back a balance the ledger credited a call earlier, at a key it never held', async () => {
    const { world, ledger, reader, fresh, result } = await credited();
    // The read names the output the credit created the node at, and declares the view that output carries.
    const created = namedByOutput(result, 'credit').map((declared) => declared.out);
    const reads = namedByOutput(result, 'balanceOf');
    expect(reads).toHaveLength(1);
    expect(created).toContain(reads[0]!.out);
    expect(binToHex(reads[0]!.viewIn)).toBe(commitmentAt(result, reads[0]!.out));
    expect(binToHex(reads[0]!.viewOut)).toBe(binToHex(reads[0]!.viewIn));
    expect(await view(world, reader, 'seen', [])).toBe(5n);
    expect(await view(world, ledger, 'balanceOf', [fresh])).toBe(5n);
    expect(await view(world, ledger, 'balanceOf', [USER_LOCK])).toBe(1n);
  }, 600_000);

  it('pulls through an unlimited allowance the root approved a call earlier, leaving it as it is', async () => {
    const world = await newWorld(0x74);
    const token = await deployPlain(world, artifacts.Token!);
    const puller = await deployPlain(world, artifacts.Puller!, [token.address]);
    const holder = await deployPlain(world, artifacts.Holder!, [token.address, puller.address]);
    await enter(world, token, 'mint', [holder.address, 100n]);
    const result = await enter(world, holder, 'approveAndPull', [30n], [token, puller]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // The token's `transferFrom` names what its `approve` created by the outputs it created them at, and keeps every
    // such declaration at the view that output holds: an unlimited allowance is not spent.
    const approved = namedByOutput(result, 'approve').map((declared) => declared.out);
    const reads = namedByOutput(result, 'transferFrom').filter((declared) => approved.includes(declared.out));
    expect(reads.length).toBeGreaterThan(0);
    for (const read of reads) {
      expect(binToHex(read.viewIn)).toBe(commitmentAt(result, read.out));
      expect(binToHex(read.viewOut)).toBe(binToHex(read.viewIn));
    }
    expect([
      await view(world, token, 'balanceOf', [holder.address]),
      await view(world, token, 'balanceOf', [puller.address]),
      await view(world, token, 'allowance', [holder.address, puller.address]),
    ]).toStrictEqual([70n, 30n, UNLIMITED]);
  }, 600_000);

  it('refuses a block whose read of the created node states another value', async () => {
    const { result } = await credited();
    expect(refusedOn(result, structuredClone(result.transaction) as VmTransaction)).toStrictEqual([]);
    const master = frameOf(result, 'balanceOf');
    const block = structuredClone(result.draft.blockOf(master)) as WitnessBlock;
    const read = block.segments[0]!.find((declared) => declared.in === INDEX_NONE);
    expect(read).toBeDefined();
    const wrong = Uint8Array.from(read!.viewIn);
    wrong[wrong.length - 1] = wrong[wrong.length - 1]! ^ 0x01;
    read!.viewIn = wrong;
    read!.viewOut = Uint8Array.from(wrong);
    expect(refusedOn(result, withBlock(result, master, block))).not.toStrictEqual([]);
  }, 600_000);
});
