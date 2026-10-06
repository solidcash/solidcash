import { describe, expect, it } from 'vitest';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { FramedCallResult } from '../../../src/framed/call/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import {
  compileFramed, deployPlain, enterPlain, newWorld, refusedVerdicts, type Outcome, type PlainDeployment, type World,
} from '../ahead/composition-world.js';

/**
 * A plain root that reverts on its own check before the calls whose results the call path decodes, on the plain call
 * path (`callFramedEntry`).
 *
 * `Desk.approve` is a Solidity-imported entry: its returns and its callees' are the `evm-abi-v1` tuple. It requires
 * the item to be in state 2, then reads the item's fee from a registry with a static call, releases that fee from an
 * escrow when it is above zero, records the item in a log and returns the fee. The fee guards the release and is its
 * argument, so the call path decodes what the registry's frame recorded before it plans the release.
 *
 * An item in state 1 stops on the `require`, before any of those calls: the frames planned past it are never entered,
 * so the bytes they record are no result of the execution, and the call reports the entry's own reason and spends
 * nothing. An item in state 2 settles, releasing the fee, recording the item and returning the fee.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IRegistry { function feeOf(uint256 id) external view returns (uint256); }',
  'interface IEscrow { function release(uint256 id, uint256 amount) external; }',
  'interface ILog { function record(uint256 id) external; }',
  'contract Registry {',
  '  mapping(uint256 => uint256) private fees;',
  '  function setFee(uint256 id, uint256 fee) external { fees[id] = fee; }',
  '  function feeOf(uint256 id) external view returns (uint256) { return fees[id]; }',
  '}',
  'contract Escrow {',
  '  mapping(uint256 => uint256) public released;',
  '  function release(uint256 id, uint256 amount) external { released[id] += amount; }',
  '}',
  'contract Log {',
  '  mapping(address => uint256) public lastOf;',
  '  function record(uint256 id) external { lastOf[msg.sender] = id; }',
  '}',
  'contract Desk {',
  '  struct Item { uint8 state; uint256 count; }',
  '  mapping(uint256 => Item) private items;',
  '  IRegistry public registry;',
  '  IEscrow public escrow;',
  '  ILog public log;',
  '  constructor(IRegistry registry_, IEscrow escrow_, ILog log_) { registry = registry_; escrow = escrow_; log = log_; }',
  '  function setState(uint256 id, uint8 state) external { items[id].state = state; }',
  '  function stateOf(uint256 id) external view returns (uint8) { return items[id].state; }',
  '  function approve(uint256 id) external returns (uint256) {',
  '    require(items[id].state == 2, "item in invalid state");',
  '    uint256 fee = registry.feeOf(id);',
  '    if (fee > 0) escrow.release(id, fee);',
  '    log.record(id);',
  '    items[id].state = 3;',
  '    return fee;',
  '  }',
  '}',
].join('\n');

const artifacts = compileFramed(SOURCE);

interface Chain {
  readonly world: World;
  readonly registry: PlainDeployment;
  readonly escrow: PlainDeployment;
  readonly log: PlainDeployment;
  readonly desk: PlainDeployment;
}

/** One entry of `root` that has to settle, entered by the user. */
async function settle(world: World, root: PlainDeployment, functionName: string, args: FunctionArgument[]): Promise<void> {
  const outcome = await enterPlain(world, root, functionName, args);
  expect(outcome.error).toBeUndefined();
  expect(refusedVerdicts(outcome.result!)).toBeUndefined();
}

let chainRun: Promise<Chain> | undefined;
/** The desk's chain, each deployment plain: item 1 in state 1 and item 2 in state 2, each with a fee of 4. */
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const world = await newWorld(0x6d);
    const registry = await deployPlain(world, artifacts.Registry!);
    const escrow = await deployPlain(world, artifacts.Escrow!);
    const log = await deployPlain(world, artifacts.Log!);
    const desk = await deployPlain(world, artifacts.Desk!, [registry.address, escrow.address, log.address]);
    await settle(world, registry, 'setFee', [1n, 4n]);
    await settle(world, registry, 'setFee', [2n, 4n]);
    await settle(world, desk, 'setState', [1n, 1n]);
    await settle(world, desk, 'setState', [2n, 2n]);
    return { world, registry, escrow, log, desk };
  })();
  return chainRun;
}

/** The desk's approval of item `id`, which reaches the registry, the escrow and the log. */
function approve(c: Chain, id: bigint): Promise<Outcome<FramedCallResult>> {
  return enterPlain(c.world, c.desk, 'approve', [id], Object.fromEntries([c.registry, c.escrow, c.log]
    .map((deployed) => [deployed.artifact.contractName, { artifact: deployed.artifact, categoryId: deployed.categoryId }])));
}

/** A view's value, read from a plain deployment's records and nodes through the read path. */
async function view(c: Chain, deployed: PlainDeployment, functionName: string, args: FunctionArgument[]): Promise<unknown> {
  const read = await readFramedEntry({
    provider: c.world.network, artifact: deployed.artifact, categoryId: deployed.categoryId, functionName, args,
    vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

describe('a plain root that reverts before the calls whose results the call path decodes', () => {
  it('compiles the entry and its static callee with Solidity ABI returns', () => {
    const encodingOf = (contract: string, entry: string): string | undefined =>
      artifacts[contract]!.abi.find((row) => row.name === entry)?.resultEncoding;
    expect(encodingOf('Desk', 'approve')).toBe('evm-abi-v1');
    expect(encodingOf('Registry', 'feeOf')).toBe('evm-abi-v1');
  });

  it('reports its own reason for an item in state 1 and spends nothing', async () => {
    const c = await chain();
    const refused = await approve(c, 1n);
    expect(refused.error).toBeUndefined();
    expect(refused.result!.accepted).toBe(false);
    expect(refused.result!.broadcast).toBeUndefined();
    expect(refused.result!.values).toEqual([]);
    expect(refused.result!.refusal?.innermost?.master).toBe('master');
    expect(refused.result!.refusal?.innermost?.reason.message).toBe('item in invalid state');
    expect(refused.coinSpent).toBe(false);
    expect(Number(await view(c, c.desk, 'stateOf', [1n]))).toBe(1);
  }, 600_000);

  it('settles an item in state 2, releasing its fee, recording it and returning the fee', async () => {
    const c = await chain();
    const settled = await approve(c, 2n);
    expect(settled.error).toBeUndefined();
    expect(refusedVerdicts(settled.result!)).toBeUndefined();
    expect(settled.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(settled.result!.values).toEqual([4n]);
    expect(await view(c, c.escrow, 'released', [2n])).toBe(4n);
    expect(await view(c, c.log, 'lastOf', [c.desk.address])).toBe(2n);
    expect(Number(await view(c, c.desk, 'stateOf', [2n]))).toBe(3);
  }, 600_000);
});
