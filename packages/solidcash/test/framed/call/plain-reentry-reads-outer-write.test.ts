import { describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush } from '@bitauth/libauth';
import {
  INDEX_NONE, bytesEqual, concatBytes, encodeWitnessBlock, splitFirstPush, type RecordEntry, type WitnessBlock,
} from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { FramedCallResult } from '../../../src/framed/call/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import {
  compileFramed, deployPlain, enterPlain, newWorld, refusedVerdicts, type PlainDeployment, type World,
} from '../ahead/composition-world.js';

/**
 * A plain callee that runs inside a frame of its own contract and reads back what that outer frame wrote earlier in
 * the same call, on the plain call path (`callFramedEntry`).
 *
 * `Vault.release` closes a record and raises its amount behind a ternary, so the artifact states no value for the
 * write and only the vault's own run computes it, and then calls `Payer.pay`, which calls back into the vault: `get`
 * reads the record the outer frame just wrote, and `mark` rewrites it. The re-entered frames run before the outer
 * frame is read, so the call derives the outer frame up to the call that leads to them and learns the view its write
 * left first, as the hop learns it (`learnEnclosingValues`). The plain path refuses a call back into the root's own
 * contract by name, so the outer frame is the first one a neutral desk enters. The call settles, the record reads
 * back with both writes and the payer kept the amount the outer write left; a block whose re-entered read states the
 * outer write's view otherwise is refused.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'struct Rec { bool open; uint256 amount; uint256 marks; }',
  'interface IVault {',
  '  function get(uint256 id) external view returns (uint256);',
  '  function mark(uint256 id) external;',
  '}',
  'interface IPayer { function pay(address vault, uint256 id) external; }',
  'contract Vault {',
  '  mapping(uint256 => Rec) internal recs;',
  '  IPayer public payer;',
  '  constructor(IPayer payer_) { payer = payer_; }',
  '  function open(uint256 id, uint256 amount) external { recs[id] = Rec(true, amount, 0); }',
  '  function release(uint256 id) external {',
  '    recs[id].open = false;',
  '    recs[id].amount = recs[id].amount > 0 ? recs[id].amount + 5 : 1;',
  '    payer.pay(address(this), id);',
  '  }',
  '  function get(uint256 id) external view returns (uint256) {',
  '    require(!recs[id].open, "still open");',
  '    return recs[id].amount;',
  '  }',
  '  function mark(uint256 id) external { recs[id].marks = recs[id].marks + 1; }',
  '  function isOpen(uint256 id) external view returns (bool) { return recs[id].open; }',
  '  function amountOf(uint256 id) external view returns (uint256) { return recs[id].amount; }',
  '  function marksOf(uint256 id) external view returns (uint256) { return recs[id].marks; }',
  '}',
  'contract Payer {',
  '  uint256 public seen;',
  '  function pay(address vault, uint256 id) external {',
  '    seen = IVault(vault).get(id);',
  '    IVault(vault).mark(id);',
  '  }',
  '}',
  'contract Desk {',
  '  Vault public vault;',
  '  constructor(Vault vault_) { vault = vault_; }',
  '  function settle(uint256 id) external { vault.release(id); }',
  '}',
].join('\n');

const artifacts = compileFramed(SOURCE);

const ID = 7n;

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

interface Released {
  readonly world: World;
  readonly vault: PlainDeployment;
  readonly payer: PlainDeployment;
  readonly result: FramedCallResult;
}

let releaseRun: Promise<Released> | undefined;
/** A desk settling a record the vault holds open at 100: the vault releases it and the payer reads it back. */
function released(): Promise<Released> {
  releaseRun ??= (async (): Promise<Released> => {
    const world = await newWorld(0x76);
    const payer = await deployPlain(world, artifacts.Payer!);
    const vault = await deployPlain(world, artifacts.Vault!, [payer.address]);
    const desk = await deployPlain(world, artifacts.Desk!, [vault.address]);
    await enter(world, vault, 'open', [ID, 100n]);
    const result = await enter(world, desk, 'settle', [ID], [vault, payer]);
    return { world, vault, payer, result };
  })();
  return releaseRun;
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

/** The declarations the frame that ran `entry` makes of the spent input at `index`, in segment order. */
function declarationsOf(result: FramedCallResult, entry: string, index: number): readonly RecordEntry[] {
  return result.draft.blockOf(frameOf(result, entry)).segments.flat().filter((declared) => declared.in === index);
}

/** The one declaration of `release` that moves a spent input: its write of the record. */
function outerWrite(result: FramedCallResult): RecordEntry {
  const writes = result.draft.blockOf(frameOf(result, 'release')).segments.flat()
    .filter((declared) => declared.in !== INDEX_NONE && !bytesEqual(declared.viewIn, declared.viewOut));
  expect(writes).toHaveLength(1);
  return writes[0]!;
}

describe('a plain callee that reads back what a frame of its own contract it runs inside wrote', () => {
  it('settles a release whose payer reads the record back through the vault and marks it', async () => {
    const { result } = await released();
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(result.completed.map((frame) => frame.functionName)).toEqual(expect.arrayContaining([
      'Vault.release()', 'Payer.pay()', 'Vault.get()', 'Vault.mark()',
    ]));
    // The re-entered read keeps the view the outer write left, the rewrite continues from it, and the record's output
    // carries the view the rewrite left.
    const written = outerWrite(result);
    const reads = declarationsOf(result, 'get', written.in);
    expect(reads.length).toBeGreaterThan(0);
    for (const read of reads) {
      expect(binToHex(read.viewIn)).toBe(binToHex(written.viewOut));
      expect(binToHex(read.viewOut)).toBe(binToHex(written.viewOut));
    }
    const marks = declarationsOf(result, 'mark', written.in)
      .filter((declared) => !bytesEqual(declared.viewIn, declared.viewOut));
    expect(marks).toHaveLength(1);
    expect(binToHex(marks[0]!.viewIn)).toBe(binToHex(written.viewOut));
    const output = result.transaction.outputs[written.out]?.token?.nft?.commitment;
    expect(binToHex(output ?? new Uint8Array(0))).toBe(binToHex(marks[0]!.viewOut));
  }, 600_000);

  it('reads the record back with both writes, and the payer kept the amount the outer write left', async () => {
    const { world, vault, payer } = await released();
    expect([
      await view(world, vault, 'isOpen', [ID]),
      await view(world, vault, 'amountOf', [ID]),
      await view(world, vault, 'marksOf', [ID]),
      await view(world, payer, 'seen', []),
    ]).toStrictEqual([false, 105n, 1n, 105n]);
  }, 600_000);

  it('refuses a block whose re-entered read states the outer write\'s view otherwise', async () => {
    const { result } = await released();
    expect(refusedOn(result, structuredClone(result.transaction) as VmTransaction)).toStrictEqual([]);
    const written = outerWrite(result);
    const master = frameOf(result, 'get');
    const block = structuredClone(result.draft.blockOf(master)) as WitnessBlock;
    const read = block.segments.flat().find((declared) => declared.in === written.in);
    expect(read).toBeDefined();
    const wrong = Uint8Array.from(read!.viewIn);
    wrong[wrong.length - 1] = wrong[wrong.length - 1]! ^ 0x01;
    read!.viewIn = wrong;
    read!.viewOut = Uint8Array.from(wrong);
    expect(refusedOn(result, withBlock(result, master, block))).not.toStrictEqual([]);
  }, 600_000);
});
