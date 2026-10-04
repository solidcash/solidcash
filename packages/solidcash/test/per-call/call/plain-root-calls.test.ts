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
 * A plain deployment whose entry writes its own mapping beside a call, on the plain call path (`callPerCallEntry`).
 *
 * A vault pulls a token from the depositor and credits the depositor's deposit, the credit after the pull and, in
 * the second spelling, before it. The token is a frame of its own contract, entered by the vault, and the credit is
 * the vault's own write: each lands in the segment of the vault's frame its artifact publishes, past the call or
 * ahead of it, and is kept on the other side, as the hop places its delegate frame's writes. Each deposit settles
 * and every balance is read back through the views. A plan that declares the credit made ahead of the pull is
 * refused by the vault's own frame.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IToken {',
  '  function transferFrom(address from, address to, uint256 amount) external;',
  '  function balanceOf(address who) external view returns (uint256);',
  '}',
  'contract Token {',
  '  mapping(address => uint256) internal balances;',
  '  function mint(address to, uint256 amount) external { balances[to] += amount; }',
  '  function transferFrom(address from, address to, uint256 amount) external {',
  '    require(balances[from] >= amount, "short");',
  '    balances[from] -= amount;',
  '    balances[to] += amount;',
  '  }',
  '  function balanceOf(address who) external view returns (uint256) { return balances[who]; }',
  '}',
  'contract Vault {',
  '  IToken public token;',
  '  mapping(address => uint256) public deposits;',
  '  constructor(IToken token_) { token = token_; }',
  '  function deposit(uint256 amount) external {',
  '    token.transferFrom(msg.sender, address(this), amount);',
  '    deposits[msg.sender] += amount;',
  '  }',
  '  function depositFirst(uint256 amount) external {',
  '    deposits[msg.sender] += amount;',
  '    token.transferFrom(msg.sender, address(this), amount);',
  '  }',
  '}',
].join('\n');

interface Chain {
  readonly world: World;
  readonly token: PlainDeployment;
  readonly vault: PlainDeployment;
}

let chainRun: Promise<Chain> | undefined;
/** The token and the vault, both deployed without a proxy, and the depositor holding 100 of the token. */
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const artifacts = compilePerCall(SOURCE);
    const world = await newWorld(0x52);
    const token = await deployPlain(world, artifacts.Token!);
    const vault = await deployPlain(world, artifacts.Vault!, [token.address]);
    const minted = await enterPlain(world, token, 'mint', [USER_LOCK, 100n]);
    expect(minted.error).toBeUndefined();
    expect(refusedVerdicts(minted.result!)).toBeUndefined();
    return { world, token, vault };
  })();
  return chainRun;
}

/** One vault entry that has to settle: entered by the depositor, reaching the token, and broadcast. */
async function settle(c: Chain, functionName: string, args: readonly FunctionArgument[]): Promise<PerCallCallResult> {
  const outcome = await enterPlain(c.world, c.vault, functionName, args, {
    Token: { artifact: c.token.artifact, categoryId: c.token.categoryId },
  });
  expect(outcome.error).toBeUndefined();
  expect(refusedVerdicts(outcome.result!)).toBeUndefined();
  expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
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

/** The depositor's and the vault's token balances, and the depositor's deposit. */
async function holdings(c: Chain): Promise<readonly unknown[]> {
  return [
    await view(c.world, c.token, 'balanceOf', [USER_LOCK]),
    await view(c.world, c.token, 'balanceOf', [c.vault.address]),
    await view(c.world, c.vault, 'deposits', [USER_LOCK]),
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

describe('a plain root\'s own mapping write beside its call', () => {
  it('credits a deposit past the token pull, as an insert and then in place, each balance read back', async () => {
    const c = await chain();
    await settle(c, 'deposit', [10n]);
    expect(await holdings(c)).toStrictEqual([90n, 10n, 10n]);
    await settle(c, 'deposit', [5n]);
    expect(await holdings(c)).toStrictEqual([85n, 15n, 15n]);
  }, 600_000);

  it('credits a deposit ahead of the token pull, each balance read back', async () => {
    const c = await chain();
    await settle(c, 'depositFirst', [4n]);
    expect(await holdings(c)).toStrictEqual([81n, 19n, 19n]);
  }, 600_000);

  it('refuses at the vault\'s frame a plan that declares the credit made ahead of the pull', async () => {
    const c = await chain();
    const settled = await settle(c, 'deposit', [3n]);
    expect(refusedOn(settled, structuredClone(settled.transaction) as VmTransaction)).toStrictEqual([]);
    // The deposit's node, declared changed in the segment the pull closes and kept at that view past it.
    const node = settled.draft.layout.participants
      .find((placed) => placed.id === `mapping-node-${binToHex(keyToSlotMulti([USER_LOCK]))}`)!;
    const block = structuredClone(settled.draft.blockOf('master')) as WitnessBlock;
    const before = block.segments[0]!.find((entry) => entry.in === node.index)!;
    const past = block.segments[1]!.find((entry) => entry.in === node.index)!;
    expect(before.viewOut).toStrictEqual(before.viewIn);
    before.viewOut = Uint8Array.from(past.viewOut);
    past.viewIn = Uint8Array.from(past.viewOut);
    const forged = structuredClone(settled.transaction) as VmTransaction;
    const master = settled.draft.layout.participants.find((placed) => placed.id === 'master')!;
    const { rest } = splitFirstPush(forged.inputs[master.index]!.unlockingBytecode);
    forged.inputs[master.index] = {
      ...forged.inputs[master.index]!,
      unlockingBytecode: concatBytes([encodeDataPush(encodeWitnessBlock(block)), rest]),
    };
    expect(refusedOn(settled, forged)).toContain('master');
  }, 600_000);
});
