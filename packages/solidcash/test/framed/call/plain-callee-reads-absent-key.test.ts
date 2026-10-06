import { describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush } from '@bitauth/libauth';
import {
  concatBytes, encodeIntegerValue, encodeResultList, encodeWitnessBlock, splitFirstPush, type WitnessBlock,
} from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { FramedCallResult } from '../../../src/framed/call/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import {
  compileFramed, deployPlain, enterPlain, newWorld, refusedVerdicts, type PlainDeployment, type World,
} from '../ahead/composition-world.js';

/**
 * A plain callee whose static call reads a mapping key its target has never held, on the plain call path
 * (`callFramedEntry`).
 *
 * `Desk.open` calls `Vault.pay`, which reads the token balance of its own address before and after pulling the
 * amount from the desk: the first `balanceOf` reads a key no node holds, so its frame proves the key absent against
 * the node that brackets it, the `transferFrom` between the two reads inserts the key beside that node, and the second
 * `balanceOf` reads the node the insert created. The call settles, the balances read back, and a block of the vault's
 * frame that states another balance before the pull is refused.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IToken {',
  '  function balanceOf(address account) external view returns (uint256);',
  '  function approve(address spender, uint256 value) external returns (bool);',
  '  function transferFrom(address from, address to, uint256 value) external returns (bool);',
  '}',
  'interface IVault {',
  '  function pay(address token, uint256 amt) external;',
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
  'contract Vault {',
  '  uint256 public opened;',
  '  function pay(address token, uint256 amt) external {',
  '    uint256 before = IToken(token).balanceOf(address(this));',
  '    IToken(token).transferFrom(msg.sender, address(this), amt);',
  '    uint256 afterwards = IToken(token).balanceOf(address(this));',
  '    require(afterwards - before == amt, "short");',
  '  }',
  '}',
  'contract Desk {',
  '  uint256 public opened;',
  '  function allow(address token, address vault) external {',
  '    IToken(token).approve(vault, type(uint256).max);',
  '  }',
  '  function open(address vault, address token, uint256 amt) external {',
  '    IVault(vault).pay(token, amt);',
  '  }',
  '}',
].join('\n');

const artifacts = compileFramed(SOURCE);

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

interface Paid {
  readonly world: World;
  readonly token: PlainDeployment;
  readonly vault: PlainDeployment;
  readonly desk: PlainDeployment;
  readonly result: FramedCallResult;
}

let payRun: Promise<Paid> | undefined;
/** The desk, holding 100 and having allowed the vault, opens a payment of 30 the vault pulls into a fresh balance. */
function paid(): Promise<Paid> {
  payRun ??= (async (): Promise<Paid> => {
    const world = await newWorld(0x75);
    const token = await deployPlain(world, artifacts.Token!);
    const vault = await deployPlain(world, artifacts.Vault!);
    const desk = await deployPlain(world, artifacts.Desk!);
    await enter(world, token, 'mint', [desk.address, 100n]);
    await enter(world, desk, 'allow', [token.address, vault.address], [token]);
    const result = await enter(world, desk, 'open', [vault.address, token.address, 30n], [vault, token]);
    return { world, token, vault, desk, result };
  })();
  return payRun;
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

/** A balance as the token's frame returns it here: the value at its full 32-byte width, most significant byte first. */
function fullWidth(value: bigint): string {
  return value.toString(16).padStart(64, '0');
}

describe('a plain callee whose static call reads a mapping key its target never held', () => {
  it('settles a payment the vault checks by its balance before and after the pull', async () => {
    const { result } = await paid();
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // The vault's frame binds both reads of its balance: none before the pull, the amount after it. A key no node
    // holds reads as the type's default, and the node the pull's insert created holds the amount, and the token
    // returns both at the value's full width rather than as the minimal number a held key's normalized value is.
    const calls = result.draft.blockOf(frameOf(result, 'pay')).calls;
    expect(calls).toHaveLength(3);
    expect(binToHex(calls[0]!.result)).toBe(fullWidth(0n));
    expect(binToHex(calls[2]!.result)).toBe(fullWidth(30n));
  }, 600_000);

  it('reads back the balances the payment left', async () => {
    const { world, token, vault, desk } = await paid();
    expect([
      await view(world, token, 'balanceOf', [desk.address]),
      await view(world, token, 'balanceOf', [vault.address]),
    ]).toStrictEqual([70n, 30n]);
  }, 600_000);

  it('refuses a block of the vault that states another balance before the pull', async () => {
    const { result } = await paid();
    expect(refusedOn(result, structuredClone(result.transaction) as VmTransaction)).toStrictEqual([]);
    const master = frameOf(result, 'pay');
    const block = structuredClone(result.draft.blockOf(master)) as WitnessBlock;
    block.calls[0]!.result = encodeResultList([encodeIntegerValue(1n)]);
    expect(refusedOn(result, withBlock(result, master, block))).not.toStrictEqual([]);
  }, 600_000);
});
