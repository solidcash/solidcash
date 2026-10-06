import { describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush, hexToBin } from '@bitauth/libauth';
import {
  buildPushdataCommitment, concatBytes, decodeWitnessBlock, encodeWitnessBlock, parsePushdataCommitment,
  splitFirstPush, type Artifact, type RecordEntry, type WitnessBlock,
} from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { readPerCallDeployment } from '../../../src/per-call/deploy/index.js';
import { deploymentStateValues } from '../../../src/per-call/proxy/external-calls.js';
import { participant } from '../../../src/per-call/composer/index.js';
import type { PerCallProxyCallResult } from '../../../src/per-call/proxy/index.js';
import {
  USER_LOCK, compilePerCall, deployPlain, deployProxied, enterPlain, enterProxied, newWorld, refusedVerdicts,
  type Outcome, type PlainDeployment, type ProxiedDeployment, type World,
} from '../ahead/composition-world.js';

/**
 * A call back into the hop's own root, below a callee: the root's contract is entered again on a further master of
 * each of its pools, in its own blocks, and the frame runs on the root's own records, whose views chain from the
 * root frame's view at the call, through the re-entered frame, into the root frame's segment after the call.
 *
 * Two shapes reach it. A locker pulls a deed into itself and the deed's transfer calls the locker's receiver hook,
 * which records the depositor (unconditionally, and behind ERC-721's `to.code.length > 0`). A lender pays out of its
 * reserve, calls the receiver's `onLoan`, and requires the receiver to have repaid through the lender's own `repay`
 * before it books the loan: the segment after the call reads what the re-entered frame wrote. A receiver that repays
 * short is refused by the lender's own check, and a re-entered frame declared from the view before the lender's
 * payout, as a stale read would see it, is refused by the validator although the frame's own close holds.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IReceiver { function onReceived(address from, uint256 id) external returns (bool); }',
  'interface IDeed {',
  '  function transferAndNotify(address from, address to, uint256 id) external;',
  '  function transferChecked(address from, address to, uint256 id) external;',
  '}',
  'interface IBorrower { function onLoan(uint256 amount) external; }',
  'interface ILender { function repay(uint256 amount) external; }',
  'contract Deed {',
  '  uint256 public minted;',
  '  mapping(uint256 => address) public ownerOf;',
  '  mapping(address => mapping(address => bool)) public operators;',
  '  function mint(address to, uint256 id) external {',
  '    require(ownerOf[id] == address(0), "minted");',
  '    ownerOf[id] = to;',
  '    minted += 1;',
  '  }',
  '  function setOperator(address operator, bool allowed) external { operators[msg.sender][operator] = allowed; }',
  '  function transferAndNotify(address from, address to, uint256 id) external {',
  '    require(ownerOf[id] == from, "not owner");',
  '    require(operators[from][msg.sender], "not allowed");',
  '    ownerOf[id] = to;',
  '    require(IReceiver(to).onReceived(from, id), "rejected");',
  '  }',
  '  function transferChecked(address from, address to, uint256 id) external {',
  '    require(ownerOf[id] == from, "not owner");',
  '    require(operators[from][msg.sender], "not allowed");',
  '    ownerOf[id] = to;',
  '    if (to.code.length > 0) { require(IReceiver(to).onReceived(from, id), "rejected"); }',
  '  }',
  '}',
  'contract Locker {',
  '  address public implementation;',
  '  IDeed public deed;',
  '  mapping(uint256 => address) public depositor;',
  '  function initialize(IDeed deed_) public { deed = deed_; }',
  '  function deposit(uint256 id) external { deed.transferAndNotify(msg.sender, address(this), id); }',
  '  function depositChecked(uint256 id) external { deed.transferChecked(msg.sender, address(this), id); }',
  '  function onReceived(address from, uint256 id) external returns (bool) {',
  '    require(msg.sender == address(deed), "not the deed");',
  '    depositor[id] = from;',
  '    return true;',
  '  }',
  '}',
  'contract Lender {',
  '  address public implementation;',
  '  uint256 public reserve;',
  '  uint256 public repaid;',
  '  uint256 public loans;',
  '  function initialize(uint256 reserve_) public { reserve = reserve_; }',
  '  function lend(IBorrower receiver, uint256 amount) external {',
  '    require(amount <= reserve, "short reserve");',
  '    reserve -= amount;',
  '    repaid = 0;',
  '    receiver.onLoan(amount);',
  '    require(repaid >= amount, "not repaid");',
  '    reserve += repaid;',
  '    loans += 1;',
  '  }',
  '  function repay(uint256 amount) external { repaid += amount; }',
  '}',
  'contract Receiver {',
  '  ILender public lender;',
  '  uint256 public back;',
  '  constructor(ILender lender_, uint256 back_) { lender = lender_; back = back_; }',
  '  function onLoan(uint256 amount) external {',
  '    require(msg.sender == address(lender), "not the lender");',
  '    lender.repay(back);',
  '  }',
  '}',
].join('\n');

const LOAN = 10n;
const RESERVE = 100n;

interface Chain {
  readonly world: World;
  readonly artifacts: ReturnType<typeof compilePerCall>;
  readonly deed: PlainDeployment;
  readonly locker: ProxiedDeployment;
  readonly lender: ProxiedDeployment;
  /** A receiver that repays the loan in full, and one that repays less. */
  readonly honest: PlainDeployment;
  readonly short: PlainDeployment;
}

let chainRun: Promise<Chain> | undefined;
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const artifacts = compilePerCall(SOURCE);
    const world = await newWorld(0x5a);
    const deed = await deployPlain(world, artifacts.Deed!);
    const locker = await deployProxied(world, artifacts.Locker!, [deed.address]);
    const lender = await deployProxied(world, artifacts.Lender!, [RESERVE]);
    const honest = await deployPlain(world, artifacts.Receiver!, [lender.address, LOAN]);
    const short = await deployPlain(world, artifacts.Receiver!, [lender.address, LOAN - 6n]);
    return { world, artifacts, deed, locker, lender, honest, short };
  })();
  return chainRun;
}

const hookExternals = (c: Chain): Record<string, never> => ({
  Deed: { artifact: c.deed.artifact, categoryId: c.deed.categoryId },
  Locker: c.locker.external,
} as never);

const loanExternals = (c: Chain, receiver: PlainDeployment): Record<string, never> => ({
  Receiver: { artifact: receiver.artifact, categoryId: receiver.categoryId },
  Lender: c.lender.external,
} as never);

/** A proxied deployment's layout as its live nodes are classified: the proxy's records and the implementation's maps. */
function proxyLayoutOf(deployment: ProxiedDeployment): NonNullable<Artifact['stateLayout']> {
  const proxyLayout = deployment.external.proxyArtifact!.stateLayout!;
  const collections = deployment.artifact.stateLayout?.collections;
  return collections === undefined ? proxyLayout : { ...proxyLayout, collections };
}

/** How many nodes of one collection hold a value whose bytes include `value`. */
async function nodesHolding(
  world: World, categoryId: string, layout: NonNullable<Artifact['stateLayout']>, collection: string,
  value: Uint8Array,
): Promise<number> {
  const pools = await readPerCallDeployment(world.network, categoryId, layout);
  const wanted = binToHex(value);
  return (pools.nodesByCollection.get(collection) ?? [])
    .filter((utxo) => (utxo.token?.nft?.commitment ?? '').includes(wanted)).length;
}

/** The lender's own state, read from its proxy's records. */
async function lenderState(c: Chain): Promise<readonly unknown[]> {
  const layout = proxyLayoutOf(c.lender);
  const state = deploymentStateValues(layout, c.lender.proxyCategoryId,
    await readPerCallDeployment(c.world.network, c.lender.proxyCategoryId, layout));
  return [state.reserve, state.repaid, state.loans];
}

type Verdicts = { readonly verdicts: readonly { readonly id: string; readonly accepted: boolean }[] };

function expectSettled<T extends Verdicts>(outcome: Outcome<T>): T {
  expect(outcome.error).toBeUndefined();
  expect(refusedVerdicts(outcome.result!)).toBeUndefined();
  expect(outcome.coinSpent).toBe(true);
  return outcome.result!;
}

let repaidLoan: PerCallProxyCallResult | undefined;

describe('a call back into the hop\'s own root', () => {
  it('mints two deeds to the user and approves the locker (setup, plain roots)', async () => {
    const c = await chain();
    for (const [entry, args] of [
      ['mint', [USER_LOCK, 1n]], ['mint', [USER_LOCK, 2n]], ['setOperator', [c.locker.address, true]],
    ] as const) {
      expectSettled(await enterPlain(c.world, c.deed, entry, args as never));
    }
  }, 600_000);

  it('settles a deposit whose deed calls the locker\'s hook, which records the depositor', async () => {
    const c = await chain();
    const layout = proxyLayoutOf(c.locker);
    const recorded = await nodesHolding(c.world, c.locker.proxyCategoryId, layout, 'depositor', USER_LOCK);
    const result = expectSettled(await enterProxied(c.world, c.locker, 'deposit', [1n], hookExternals(c)));
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // The hook ran on a second master of each of the locker's pools, in the locker's own blocks.
    const masters = result.draft.runs.map((run) => run.functionName);
    expect(masters.filter((name) => name === 'Locker.onReceived()')).toHaveLength(1);
    expect(masters.filter((name) => name === 'LockerProxy.__fallback()')).toHaveLength(2);
    expect(await nodesHolding(c.world, c.locker.proxyCategoryId, layout, 'depositor', USER_LOCK))
      .toBe(recorded + 1);
    expect(await nodesHolding(c.world, c.deed.categoryId, c.deed.artifact.stateLayout!, 'ownerOf', c.locker.address))
      .toBe(1);
  }, 600_000);

  it('settles the ERC-721 spelling, the hook behind `to.code.length > 0`', async () => {
    const c = await chain();
    const layout = proxyLayoutOf(c.locker);
    const recorded = await nodesHolding(c.world, c.locker.proxyCategoryId, layout, 'depositor', USER_LOCK);
    expectSettled(await enterProxied(c.world, c.locker, 'depositChecked', [2n], hookExternals(c)));
    expect(await nodesHolding(c.world, c.locker.proxyCategoryId, layout, 'depositor', USER_LOCK))
      .toBe(recorded + 1);
    expect(await nodesHolding(c.world, c.deed.categoryId, c.deed.artifact.stateLayout!, 'ownerOf', c.locker.address))
      .toBe(2);
  }, 600_000);

  it('settles a flash loan the receiver repays through the lender, which books what the repayment left', async () => {
    const c = await chain();
    expect(await lenderState(c)).toStrictEqual([RESERVE, 0n, 0n]);
    repaidLoan = expectSettled(
      await enterProxied(c.world, c.lender, 'lend', [c.honest.address, LOAN], loanExternals(c, c.honest)));
    expect(repaidLoan.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(await lenderState(c)).toStrictEqual([RESERVE, LOAN, 1n]);
  }, 600_000);

  it('refuses a flash loan repaid short by the lender\'s own check, and nothing is broadcast', async () => {
    const c = await chain();
    const before = await lenderState(c);
    const outcome = await enterProxied(c.world, c.lender, 'lend', [c.short.address, LOAN], loanExternals(c, c.short));
    expect(outcome.error?.message).toContain('not repaid');
    expect(outcome.coinSpent).toBe(false);
    expect(await lenderState(c)).toStrictEqual(before);
  }, 600_000);

  it('refuses a repayment declared from the lender\'s view before its payout, though its own close holds', async () => {
    const c = await chain();
    const result = repaidLoan!;
    const vm = compositionMachine();
    type VmTransaction = NonNullable<typeof result.transaction>;
    const refusing = (transaction: VmTransaction): readonly string[] => [...new Set(result.verdicts
      .filter((verdict) => vm.stateSuccess(vm.evaluate({
        inputIndex: verdict.index, sourceOutputs: [...result.sourceOutputs], transaction,
      })) !== true).map((verdict) => verdict.id.replace(/\/\d+$/, '')))].sort();
    expect(refusing(structuredClone(result.transaction) as VmTransaction)).toStrictEqual([]);

    const layout = proxyLayoutOf(c.lender);
    const field = layout.variables.find((variable) => variable.name === 'repaid')!;
    const index = participant(result.draft.layout, `proxy-record-${field.nftIndex}`).index;
    const entryOf = (block: WitnessBlock, segment: number): RecordEntry =>
      block.segments[segment]!.find((entry) => entry.in === index)!;
    // The lender's record as the hop spent it, before the lender paid the loan out.
    const spent = entryOf(result.draft.blockOf('proxy-master'), 0).viewIn;
    const repay = result.draft.runs.find((run) => run.functionName === 'Lender.repay()')!.master;
    const forged = structuredClone(result.transaction) as VmTransaction;
    const at = result.verdicts.find((verdict) => verdict.id === repay)!.index;
    const { payload, rest } = splitFirstPush(forged.inputs[at]!.unlockingBytecode);
    const block = decodeWitnessBlock(payload);
    const declared = entryOf(block, 0);
    // The repayment as a frame that read the record before the payout computes it: its own close holds.
    const fields = parsePushdataCommitment(binToHex(spent), layout, field.nftIndex);
    declared.viewIn = spent;
    declared.viewOut = hexToBin(buildPushdataCommitment(
      layout, { ...fields, repaid: (fields.repaid as bigint) + LOAN }, field.nftIndex));
    forged.inputs[at] = {
      ...forged.inputs[at]!, unlockingBytecode: concatBytes([encodeDataPush(encodeWitnessBlock(block)), rest]),
    };
    expect(refusing(forged)).toContain('validator');
    expect(refusing(forged)).not.toContain(repay);
  }, 600_000);
});
