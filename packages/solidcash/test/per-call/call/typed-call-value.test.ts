import { describe, expect, it } from 'vitest';
import { encodeDataPush } from '@bitauth/libauth';
import { concatBytes, encodeWitnessBlock, splitFirstPush, type WitnessBlock } from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import { SignatureTemplate } from '../../../src/index.js';
import { callPerCallEntry, type PerCallCallResult } from '../../../src/per-call/call/index.js';
import { satoshiContainerLockingBytecode } from '../../../src/per-call/deploy/index.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import { alicePriv } from '../../fixture/vars.js';
import {
  USER_LOCK, compilePerCall, deployPlain, newWorld, refusedVerdicts, type PlainDeployment, type World,
} from '../ahead/composition-world.js';

/**
 * A typed call carrying value, `IWrapper(w).deposit{value: v}()`, beside the caller's own write, on the plain call
 * path (`callPerCallEntry`). A DEX router or a wrapper deposits native value into another contract this way.
 *
 * The call's own record carries the value: the router's site holds the record's `value` to the amount its code
 * computes, the validator holds the wrapper's frame value to the record (V5), and the value rule charges the
 * router's value and containers and credits the wrapper's (V7). The call path starts the record from no value, learns
 * the amount from the router's own close at the site, and plans it as the wrapper's `msg.value`, paid into a container
 * of the wrapper's. Each deposit settles, and the wrapper's balance and container are read back; a plan whose record
 * and wrapper frame carry less than the router computed is refused by the router's own frame.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IWrapper { function deposit() external payable; }',
  'contract Wrapper {',
  '  mapping(address => uint256) public balanceOf;',
  '  function deposit() external payable { balanceOf[msg.sender] += msg.value; }',
  '}',
  'contract Router {',
  '  address public implementation;',
  '  uint256 public routed;',
  '  function initialize(uint256 start) public { routed = start; }',
  '  function depositVia(address w, uint256 v) external payable {',
  '    routed += v;',
  '    IWrapper(w).deposit{value: v}();',
  '  }',
  '}',
].join('\n');

const units = compilePerCall(SOURCE);
const FUNDER = new SignatureTemplate(alicePriv).unlockP2PKH();

interface Chain {
  readonly world: World;
  readonly wrapper: PlainDeployment;
  readonly router: PlainDeployment;
}

let chainRun: Promise<Chain> | undefined;
/** The wrapper and the router, both deployed without a proxy. */
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const world = await newWorld(0x5d);
    const wrapper = await deployPlain(world, units.Wrapper!);
    const router = await deployPlain(world, units.Router!);
    return { world, wrapper, router };
  })();
  return chainRun;
}

/** The router's deposit of `amount` into the wrapper, carried by the user's call, which has to settle. */
async function depositVia(c: Chain, amount: bigint): Promise<PerCallCallResult> {
  const result = await callPerCallEntry({
    provider: c.world.network, artifact: c.router.artifact, categoryId: c.router.categoryId,
    functionName: 'depositVia', args: [c.wrapper.address, amount], value: amount,
    externals: { Wrapper: { artifact: c.wrapper.artifact, categoryId: c.wrapper.categoryId } },
    callerUtxo: await c.world.userCoin(), callerLockingBytecode: USER_LOCK, funder: FUNDER,
    changeAddress: c.world.changeAddress, vm: compositionMachine(),
  });
  expect(refusedVerdicts(result)).toBeUndefined();
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return result;
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

/** What a deployment's satoshi containers hold. */
async function containerValue(world: World, deployed: PlainDeployment): Promise<bigint> {
  const held = await world.network.getUtxosForLockingBytecode(satoshiContainerLockingBytecode(deployed.categoryId));
  return held.reduce((sum, utxo) => sum + utxo.satoshis, 0n);
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

describe('a plain root\'s typed call carrying value', () => {
  it('deposits the value the router computes into the wrapper, its balance and container read back', async () => {
    const c = await chain();
    await depositVia(c, 5_000n);
    expect(await view(c.world, c.wrapper, 'balanceOf', [c.router.address])).toBe(5_000n);
    expect(await view(c.world, c.router, 'routed', [])).toBe(5_000n);
    expect(await containerValue(c.world, c.wrapper)).toBe(5_000n);
    expect(await containerValue(c.world, c.router)).toBe(0n);
    // A second deposit rewrites the router's balance in place and adds a container of the wrapper's.
    await depositVia(c, 2_000n);
    expect(await view(c.world, c.wrapper, 'balanceOf', [c.router.address])).toBe(7_000n);
    expect(await view(c.world, c.router, 'routed', [])).toBe(7_000n);
    expect(await containerValue(c.world, c.wrapper)).toBe(7_000n);
  }, 600_000);

  it('refuses at the router a plan whose record and wrapper frame carry less than it computed', async () => {
    const c = await chain();
    const deposited = await depositVia(c, 1_000n);
    expect(refusedOn(deposited, structuredClone(deposited.transaction) as VmTransaction)).toStrictEqual([]);
    const wrapperMaster = deposited.completed.find((frame) => frame.functionName === 'Wrapper.deposit()')!.master;
    const router = structuredClone(deposited.draft.blockOf('master')) as WitnessBlock;
    const wrapper = structuredClone(deposited.draft.blockOf(wrapperMaster)) as WitnessBlock;
    expect([router.calls[0]!.value, wrapper.value]).toStrictEqual([1_000n, 1_000n]);
    // The record and the wrapper's frame still agree, so the validator's edge holds and the router's site refuses.
    router.calls[0]!.value = 999n;
    wrapper.value = 999n;
    const forged = withBlock(deposited, 'master', router, withBlock(deposited, wrapperMaster, wrapper));
    expect(refusedOn(deposited, forged)).toContain('master');
  }, 600_000);
});
