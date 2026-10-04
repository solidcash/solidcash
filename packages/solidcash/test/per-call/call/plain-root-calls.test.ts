import { describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush } from '@bitauth/libauth';
import {
  concatBytes, encodeIntegerValue, encodeResultList, encodeWitnessBlock, splitFirstPush, type WitnessBlock,
} from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { PerCallCallResult } from '../../../src/per-call/call/index.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import { keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import {
  USER_LOCK, compilePerCall, deployPlain, enterPlain, newWorld, refusedVerdicts, type PlainDeployment, type World,
} from '../ahead/composition-world.js';

/**
 * A plain deployment whose entry calls out beside its own state, on the plain call path (`callPerCallEntry`).
 *
 * A vault pulls a token from the depositor and credits the depositor's deposit, the credit after the pull and, in
 * the second spelling, before it. The token is a frame of its own contract, entered by the vault, and the credit is
 * the vault's own write: each lands in the segment of the vault's frame its artifact publishes, past the call or
 * ahead of it, and is kept on the other side, as the hop places its delegate frame's writes. A plan that declares
 * the credit made ahead of the pull is refused by the vault's own frame.
 *
 * The vault also pays out through the token twice in one entry, to a payee and to its fee recipient: two frames of
 * the token, each writing its balances. The token's nodes are spent once, and each frame's declarations of them are
 * chained in the order the frames run, as the hop chains them: the second transfer debits the vault's balance from
 * the view the first left, and rewrites the node the first created when the payee is the fee recipient. A plan whose
 * second transfer starts the vault's balance from before the first is refused by that transfer's own frame.
 *
 * The vault sweeps its whole balance too: the transfer's amount is what the token's `balanceOf` returned to it a
 * call earlier, so the call is planned stopped before the transfer, the read is settled on that plan, and the call is
 * planned again from what it returned, as the hop plans one. A plan that states a smaller result, in the vault's
 * record of the read and in the read's own `retval` alike, is refused by the read's own frame. Every entry settles
 * and every balance is read back through the views.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IToken {',
  '  function transferFrom(address from, address to, uint256 amount) external;',
  '  function transfer(address to, uint256 amount) external;',
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
  '  function transfer(address to, uint256 amount) external {',
  '    require(balances[msg.sender] >= amount, "short");',
  '    balances[msg.sender] -= amount;',
  '    balances[to] += amount;',
  '  }',
  '  function balanceOf(address who) external view returns (uint256) { return balances[who]; }',
  '}',
  'contract Vault {',
  '  IToken public token;',
  '  address public feeTo;',
  '  mapping(address => uint256) public deposits;',
  '  constructor(IToken token_, address feeTo_) { token = token_; feeTo = feeTo_; }',
  '  function deposit(uint256 amount) external {',
  '    token.transferFrom(msg.sender, address(this), amount);',
  '    deposits[msg.sender] += amount;',
  '  }',
  '  function depositFirst(uint256 amount) external {',
  '    deposits[msg.sender] += amount;',
  '    token.transferFrom(msg.sender, address(this), amount);',
  '  }',
  '  function payout(address to, uint256 amount, uint256 fee) external {',
  '    token.transfer(to, amount);',
  '    token.transfer(feeTo, fee);',
  '  }',
  '  function sweep(address to) external {',
  '    uint256 held = token.balanceOf(address(this));',
  '    token.transfer(to, held);',
  '  }',
  '}',
].join('\n');

const artifacts = compilePerCall(SOURCE);

/** The vault's fee recipient on the payout chain, a holder of its own. */
const FEE_LOCK = Uint8Array.from([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x6f), 0x88, 0xac]);

interface Chain {
  readonly world: World;
  readonly token: PlainDeployment;
  readonly vault: PlainDeployment;
}

/** One token mint, which has to settle. */
async function mint(c: Chain, to: Uint8Array, amount: bigint): Promise<void> {
  const minted = await enterPlain(c.world, c.token, 'mint', [to, amount]);
  expect(minted.error).toBeUndefined();
  expect(refusedVerdicts(minted.result!)).toBeUndefined();
}

/** The token and a vault paying its fees to `feeTo`, both deployed without a proxy. */
async function deployChain(seed: number, feeTo: Uint8Array): Promise<Chain> {
  const world = await newWorld(seed);
  const token = await deployPlain(world, artifacts.Token!);
  const vault = await deployPlain(world, artifacts.Vault!, [token.address, feeTo]);
  return { world, token, vault };
}

let chainRun: Promise<Chain> | undefined;
/** The deposits' chain: the depositor holding 100 of the token. */
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const c = await deployChain(0x52, USER_LOCK);
    await mint(c, USER_LOCK, 100n);
    return c;
  })();
  return chainRun;
}

let payoutRun: Promise<Chain> | undefined;
/** The payouts' chain: the vault holding 50 of the token and paying its fees to a holder of their own. */
function payoutChain(): Promise<Chain> {
  payoutRun ??= (async (): Promise<Chain> => {
    const c = await deployChain(0x53, FEE_LOCK);
    await mint(c, c.vault.address, 50n);
    return c;
  })();
  return payoutRun;
}

let sweepRun: Promise<Chain> | undefined;
/** The sweeps' chain: the vault holding 30 of the token. */
function sweepChain(): Promise<Chain> {
  sweepRun ??= (async (): Promise<Chain> => {
    const c = await deployChain(0x54, FEE_LOCK);
    await mint(c, c.vault.address, 30n);
    return c;
  })();
  return sweepRun;
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

/** The settled transaction, or `transaction` when given, with one master's witness block replaced by `block`. */
function withBlock(
  result: PerCallCallResult, master: string, block: WitnessBlock, transaction: VmTransaction = result.transaction,
): VmTransaction {
  const forged = structuredClone(transaction) as VmTransaction;
  const index = result.draft.layout.participants.find((placed) => placed.id === master)!.index;
  const { rest } = splitFirstPush(forged.inputs[index]!.unlockingBytecode);
  forged.inputs[index] = {
    ...forged.inputs[index]!,
    unlockingBytecode: concatBytes([encodeDataPush(encodeWitnessBlock(block)), rest]),
  };
  return forged;
}

/** Each holder's balance of the payout chain's token. */
async function balances(c: Chain, holders: readonly Uint8Array[]): Promise<readonly unknown[]> {
  const read: unknown[] = [];
  for (const holder of holders) read.push(await view(c.world, c.token, 'balanceOf', [holder]));
  return read;
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
    expect(refusedOn(settled, withBlock(settled, 'master', block))).toContain('master');
  }, 600_000);
});

describe('a plain root that pays out through one token twice', () => {
  it('pays a payee and the fee recipient, each transfer continuing the nodes the one before it wrote', async () => {
    const c = await payoutChain();
    // The payee is the fee recipient: the second transfer rewrites the node the first one created.
    await settle(c, 'payout', [FEE_LOCK, 3n, 1n]);
    expect(await balances(c, [c.vault.address, FEE_LOCK])).toStrictEqual([46n, 4n]);
    // Another payee: the first transfer creates its node, and the second rewrites the fee recipient's.
    await settle(c, 'payout', [USER_LOCK, 7n, 1n]);
    expect(await balances(c, [c.vault.address, USER_LOCK, FEE_LOCK])).toStrictEqual([38n, 7n, 5n]);
  }, 600_000);

  it('refuses at the second transfer a plan that starts the vault\'s balance from before the first', async () => {
    const c = await payoutChain();
    const paid = await settle(c, 'payout', [USER_LOCK, 2n, 1n]);
    expect(refusedOn(paid, structuredClone(paid.transaction) as VmTransaction)).toStrictEqual([]);
    expect(await balances(c, [c.vault.address, USER_LOCK, FEE_LOCK])).toStrictEqual([35n, 9n, 6n]);
    // The vault's own balance node, which both transfers debit: the second declares it from the view the first left.
    const vaultSlot = binToHex(keyToSlotMulti([c.vault.address]));
    const node = paid.draft.layout.participants.find((placed) => placed.id.endsWith(`-balances-${vaultSlot}`))!;
    const [first, second] = paid.completed.filter((frame) => frame.functionName.endsWith('.transfer()'));
    const firstDeclared = paid.draft.blockOf(first!.master).segments[0]!.find((entry) => entry.in === node.index)!;
    const block = structuredClone(paid.draft.blockOf(second!.master)) as WitnessBlock;
    const declared = block.segments[0]!.find((entry) => entry.in === node.index)!;
    expect(declared.viewIn).toStrictEqual(firstDeclared.viewOut);
    declared.viewIn = Uint8Array.from(firstDeclared.viewIn);
    expect(refusedOn(paid, withBlock(paid, second!.master, block))).toContain(second!.master);
  }, 600_000);
});

describe('a plain root that sweeps what an earlier call returned', () => {
  it('transfers the balance the read before it returned, as an insert and then in place, each read back', async () => {
    const c = await sweepChain();
    await settle(c, 'sweep', [USER_LOCK]);
    expect(await balances(c, [c.vault.address, USER_LOCK])).toStrictEqual([0n, 30n]);
    await mint(c, c.vault.address, 12n);
    await settle(c, 'sweep', [USER_LOCK]);
    expect(await balances(c, [c.vault.address, USER_LOCK])).toStrictEqual([0n, 42n]);
  }, 600_000);

  it('refuses at the balance read a plan that states a smaller result for it', async () => {
    const c = await sweepChain();
    await mint(c, c.vault.address, 5n);
    const swept = await settle(c, 'sweep', [FEE_LOCK]);
    expect(refusedOn(swept, structuredClone(swept.transaction) as VmTransaction)).toStrictEqual([]);
    expect(await balances(c, [c.vault.address, FEE_LOCK])).toStrictEqual([0n, 5n]);
    // The vault's record of the read carries what the read's own frame returned.
    const [read] = swept.completed.filter((frame) => frame.functionName.endsWith('.balanceOf()'));
    const readBlock = structuredClone(swept.draft.blockOf(read!.master)) as WitnessBlock;
    const vaultBlock = structuredClone(swept.draft.blockOf('master')) as WitnessBlock;
    expect(vaultBlock.calls[0]!.result).toStrictEqual(readBlock.retval);
    // A builder states the read returned 1, in the record and the read's `retval` alike, so the two still agree.
    const forged = encodeResultList([encodeIntegerValue(1n)]);
    expect(forged).not.toStrictEqual(readBlock.retval);
    readBlock.retval = forged;
    vaultBlock.calls[0]!.result = forged;
    const transaction = withBlock(swept, 'master', vaultBlock, withBlock(swept, read!.master, readBlock));
    expect(refusedOn(swept, transaction)).toContain(read!.master);
  }, 600_000);
});
