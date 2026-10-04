import { describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush } from '@bitauth/libauth';
import { concatBytes, encodeWitnessBlock, splitFirstPush, type WitnessBlock } from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { PerCallCallResult } from '../../../src/per-call/call/index.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import { keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import {
  USER_LOCK, compilePerCall, deployPlain, enterPlain, newWorld, refusedVerdicts, type PlainDeployment, type World,
} from '../ahead/composition-world.js';

/**
 * A plain root that pulls a token through an allowance and then records the pull on a second plain deployment, on the
 * plain call path (`callPerCallEntry`).
 *
 * The token spends the allowance as an OpenZeppelin-style token does: `_spendAllowance` rewrites the allowance inside
 * a guard that skips an unlimited one, and `_transfer` moves the balance, each write inside an `unchecked` block. The
 * compiler's write walk does not place a write inside such a block, so the token's artifact publishes no list of the
 * entry's writes, only the one segment it fixes for the whole entry. The token's frame is planned as the hop plans
 * its callee's (`placeOwnWrites`): a frame that makes no call has one segment, and its writes land there.
 *
 * The depositor approves the pool, and the pulls settle: the first inserts the pool's balance and the record of the
 * pull, a later one rewrites both in place, and every balance, the allowance left and the record are read back. A
 * plan whose token frame declares the allowance left as it was is refused by that frame.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IToken {',
  '  function transferFrom(address from, address to, uint256 value) external returns (bool);',
  '}',
  'interface IRegistry {',
  '  function record(address who, uint256 amount) external;',
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
  'contract Registry {',
  '  mapping(address => uint256) public recorded;',
  '  function record(address who, uint256 amount) external { recorded[who] += amount; }',
  '}',
  'contract Pool {',
  '  IToken public token;',
  '  IRegistry public registry;',
  '  constructor(IToken token_, IRegistry registry_) { token = token_; registry = registry_; }',
  '  function join(uint256 amount) external {',
  '    token.transferFrom(msg.sender, address(this), amount);',
  '    registry.record(msg.sender, amount);',
  '  }',
  '}',
].join('\n');

const artifacts = compilePerCall(SOURCE);

interface Chain {
  readonly world: World;
  readonly token: PlainDeployment;
  readonly registry: PlainDeployment;
  readonly pool: PlainDeployment;
}

/** One entry of `root` that has to settle, entered by the depositor and reaching the deployments named. */
async function enter(
  c: Chain, root: PlainDeployment, functionName: string, args: readonly FunctionArgument[],
  reached: readonly PlainDeployment[] = [],
): Promise<PerCallCallResult> {
  const outcome = await enterPlain(c.world, root, functionName, args, Object.fromEntries(reached.map((deployed) =>
    [deployed.artifact.contractName, { artifact: deployed.artifact, categoryId: deployed.categoryId }])));
  expect(outcome.error).toBeUndefined();
  expect(refusedVerdicts(outcome.result!)).toBeUndefined();
  return outcome.result!;
}

let chainRun: Promise<Chain> | undefined;
/** The pool's chain, every deployment plain: the depositor holds 100 of the token and allows the pool 30 of them. */
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const world = await newWorld(0x61);
    const token = await deployPlain(world, artifacts.Token!);
    const registry = await deployPlain(world, artifacts.Registry!);
    const pool = await deployPlain(world, artifacts.Pool!, [token.address, registry.address]);
    const c = { world, token, registry, pool };
    await enter(c, token, 'mint', [USER_LOCK, 100n]);
    await enter(c, token, 'approve', [pool.address, 30n]);
    return c;
  })();
  return chainRun;
}

/** The pool's pull of `amount`, which reaches the token and then the registry, and has to settle and broadcast. */
async function join(c: Chain, amount: bigint): Promise<PerCallCallResult> {
  const joined = await enter(c, c.pool, 'join', [amount], [c.token, c.registry]);
  expect(joined.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return joined;
}

/** A view's value, read from a plain deployment's records and nodes through the read path. */
async function view(
  world: World, deployed: PlainDeployment, functionName: string, args: readonly FunctionArgument[],
): Promise<unknown> {
  const read = await readPerCallEntry({
    provider: world.network, artifact: deployed.artifact, categoryId: deployed.categoryId, functionName,
    args: [...args], vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

/** The depositor's and the pool's token balances, the allowance the pool has left, and the pulls recorded. */
async function holdings(c: Chain): Promise<readonly unknown[]> {
  return [
    await view(c.world, c.token, 'balanceOf', [USER_LOCK]),
    await view(c.world, c.token, 'balanceOf', [c.pool.address]),
    await view(c.world, c.token, 'allowance', [USER_LOCK, c.pool.address]),
    await view(c.world, c.registry, 'recorded', [USER_LOCK]),
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

/** The master of the one frame of `result` that ran `entry`. */
function frameOf(result: PerCallCallResult, entry: string): string {
  const frames = result.completed.filter((frame) => frame.functionName.endsWith(`.${entry}()`));
  expect(frames).toHaveLength(1);
  return frames[0]!.master;
}

describe('a plain root that pulls a token through its allowance, then records the pull', () => {
  it('spends the allowance and moves the balance, as an insert and then in place, each read back', async () => {
    const c = await chain();
    await join(c, 10n);
    expect(await holdings(c)).toStrictEqual([90n, 10n, 20n, 10n]);
    await join(c, 5n);
    expect(await holdings(c)).toStrictEqual([85n, 15n, 15n, 15n]);
  }, 600_000);

  it('refuses at the token\'s frame a plan that declares the allowance left as it was', async () => {
    const c = await chain();
    const joined = await join(c, 4n);
    expect(await holdings(c)).toStrictEqual([81n, 19n, 11n, 19n]);
    expect(refusedOn(joined, structuredClone(joined.transaction) as VmTransaction)).toStrictEqual([]);
    // The allowance's node, which the token's frame rewrites in place in its only segment.
    const slot = binToHex(keyToSlotMulti([USER_LOCK, c.pool.address]));
    const node = joined.draft.layout.participants.find((placed) => placed.id.endsWith(`-_allowances-${slot}`));
    expect(node).toBeDefined();
    const master = frameOf(joined, 'transferFrom');
    const block = structuredClone(joined.draft.blockOf(master)) as WitnessBlock;
    const declared = block.segments[0]!.find((entry) => entry.in === node!.index
      && binToHex(entry.viewIn) !== binToHex(entry.viewOut));
    expect(declared).toBeDefined();
    declared!.viewOut = Uint8Array.from(declared!.viewIn);
    expect(refusedOn(joined, withBlock(joined, master, block))).toContain(master);
  }, 600_000);
});
