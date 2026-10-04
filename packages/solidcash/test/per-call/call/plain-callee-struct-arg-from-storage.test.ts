import { describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush } from '@bitauth/libauth';
import { concatBytes, encodeWitnessBlock, splitFirstPush, type WitnessBlock } from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { PerCallCallResult } from '../../../src/per-call/call/index.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import {
  compilePerCall, deployPlain, enterPlain, newWorld, refusedVerdicts, type PlainDeployment, type World,
} from '../ahead/composition-world.js';

/**
 * A plain root that hands its callee a struct it builds from its own storage, on the plain call path
 * (`callPerCallEntry`).
 *
 * The desk, deployed with a constructor, keeps its items in a chunked struct array. Opening one builds an order from
 * the desk's own address, the caller, the item's token and amount (fields of an element of that array) and a memo it
 * packs from the id, and hands the order to the vault. The vault branches on the order's token: for a token it reads
 * its own balance, pulls the amount from the order's buyer and reads its balance again. The token, a field of a
 * struct argument the root computed from its records, is what the vault's three calls are planned from: the call
 * settles, the vault's frame binds the three calls, and the balances read back.
 *
 * The desk only reads the array, so its frame declares the run of chunk records the item sits in kept in place, as
 * the hop declares a run its delegate frame only reads: a block of the desk that states another view of that run is
 * refused.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'struct Item { string title; address token; uint256 amount; }',
  'struct Order { address buyer; address seller; address token; uint256 amount; string memo; }',
  'interface IToken {',
  '  function balanceOf(address account) external view returns (uint256);',
  '  function approve(address spender, uint256 value) external returns (bool);',
  '  function transferFrom(address from, address to, uint256 value) external returns (bool);',
  '}',
  'interface IVault {',
  '  function pay(Order calldata o) external;',
  '}',
  'contract Token {',
  '  mapping(address => uint256) private _balances;',
  '  mapping(address => mapping(address => uint256)) private _allowances;',
  '  uint256 private _totalSupply;',
  '  function mint(address to, uint256 value) external { _totalSupply += value; _balances[to] += value; }',
  '  function balanceOf(address account) external view returns (uint256) { return _balances[account]; }',
  '  function approve(address spender, uint256 value) external returns (bool) {',
  '    _allowances[msg.sender][spender] = value;',
  '    return true;',
  '  }',
  '  function transferFrom(address from, address to, uint256 value) external returns (bool) {',
  '    uint256 allowed = _allowances[from][msg.sender];',
  '    if (allowed < type(uint256).max) {',
  '      require(allowed >= value, "allowance");',
  '      _allowances[from][msg.sender] = allowed - value;',
  '    }',
  '    uint256 fromBalance = _balances[from];',
  '    require(fromBalance >= value, "balance");',
  '    _balances[from] = fromBalance - value;',
  '    _balances[to] += value;',
  '    return true;',
  '  }',
  '}',
  'contract Vault {',
  '  uint256 public opened;',
  '  function pay(Order calldata o) external {',
  '    if (o.token != address(0)) {',
  '      uint256 before = IToken(o.token).balanceOf(address(this));',
  '      IToken(o.token).transferFrom(o.buyer, address(this), o.amount);',
  '      uint256 afterwards = IToken(o.token).balanceOf(address(this));',
  '      require(afterwards - before == o.amount, "short");',
  '    }',
  '  }',
  '}',
  'contract Desk {',
  '  uint256 public fee;',
  '  Item[] internal items;',
  '  constructor(uint256 fee_) { fee = fee_; }',
  '  function post(string memory title, address token, uint256 amount) external {',
  '    items.push(Item(title, token, amount));',
  '  }',
  '  function allow(address token, address vault) external {',
  '    IToken(token).approve(vault, type(uint256).max);',
  '  }',
  '  function open(uint256 id, address vault) external {',
  '    Order memory o = Order(address(this), msg.sender, items[id].token, items[id].amount,',
  '      string(abi.encodePacked("#", id)));',
  '    IVault(vault).pay(o);',
  '  }',
  '}',
].join('\n');

const artifacts = compilePerCall(SOURCE);

/** One entry of `root` that has to settle, entered by the user and reaching the deployments named. */
async function enter(
  world: World, root: PlainDeployment, functionName: string, args: readonly FunctionArgument[],
  reached: readonly PlainDeployment[] = [],
): Promise<PerCallCallResult> {
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
  const read = await readPerCallEntry({
    provider: world.network, artifact: deployed.artifact, categoryId: deployed.categoryId, functionName,
    args: [...args], vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

/** A balance as the token's frame returns it here: the value at its full 32-byte width, most significant byte first. */
function fullWidth(value: bigint): string {
  return value.toString(16).padStart(64, '0');
}

interface Opened {
  readonly world: World;
  readonly token: PlainDeployment;
  readonly vault: PlainDeployment;
  readonly desk: PlainDeployment;
  readonly result: PerCallCallResult;
}

let openRun: Promise<Opened> | undefined;
/** The desk holds 100, posts an item of 30 in the token and opens it: the vault pulls the 30 the order names. */
function opened(): Promise<Opened> {
  openRun ??= (async (): Promise<Opened> => {
    const world = await newWorld(0x76);
    const token = await deployPlain(world, artifacts.Token!);
    const vault = await deployPlain(world, artifacts.Vault!);
    const desk = await deployPlain(world, artifacts.Desk!, [7n]);
    await enter(world, token, 'mint', [desk.address, 100n]);
    await enter(world, desk, 'post', ['an item paid in the token', token.address, 30n]);
    await enter(world, desk, 'allow', [token.address, vault.address], [token]);
    const result = await enter(world, desk, 'open', [0n, vault.address], [vault, token]);
    return { world, token, vault, desk, result };
  })();
  return openRun;
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

describe('a plain root that hands its callee a struct built from its own storage', () => {
  it('settles the order, the vault pulling the token the item names', async () => {
    const { result } = await opened();
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // The vault's frame binds its three calls: the balance before the pull, the pull, the balance after it. The vault
    // held no balance before: a key no node holds reads as the type's default, and the node the pull's insert created
    // holds the amount, and the token returns both at the value's full width.
    const frames = result.completed.filter((frame) => frame.functionName.endsWith('.pay()'));
    expect(frames).toHaveLength(1);
    const calls = result.draft.blockOf(frames[0]!.master).calls;
    expect(calls).toHaveLength(3);
    expect(binToHex(calls[0]!.result)).toBe(fullWidth(0n));
    expect(binToHex(calls[2]!.result)).toBe(fullWidth(30n));
  }, 600_000);

  it('reads back the balances the order left', async () => {
    const { world, token, vault, desk } = await opened();
    expect([
      await view(world, token, 'balanceOf', [desk.address]),
      await view(world, token, 'balanceOf', [vault.address]),
    ]).toStrictEqual([70n, 30n]);
  }, 600_000);

  it('refuses a block of the desk that states another view of the run its item sits in', async () => {
    const { result } = await opened();
    expect(refusedOn(result, structuredClone(result.transaction) as VmTransaction)).toStrictEqual([]);
    const roots = result.completed.filter((frame) => frame.functionName.endsWith('.open()'));
    expect(roots).toHaveLength(1);
    const master = roots[0]!.master;
    // The run's chunks are spent beside the desk's records, and the desk's first segment, which reads the item,
    // declares each of them kept at the commitment it carries.
    const chunks = new Set(result.draft.layout.participants
      .filter((placed) => placed.id.startsWith('dynamic-chunk-items-')).map((placed) => placed.index));
    expect(chunks.size).toBeGreaterThan(0);
    const block = structuredClone(result.draft.blockOf(master)) as WitnessBlock;
    const kept = block.segments[0]!.find((entry) => chunks.has(entry.in));
    expect(kept).toBeDefined();
    expect(kept!.out).toBe(kept!.in);
    const other = Uint8Array.from(kept!.viewIn);
    other[other.length - 1] = other[other.length - 1]! ^ 0x01;
    kept!.viewIn = other;
    kept!.viewOut = Uint8Array.from(other);
    expect(refusedOn(result, withBlock(result, master, block))).not.toStrictEqual([]);
  }, 600_000);
});
