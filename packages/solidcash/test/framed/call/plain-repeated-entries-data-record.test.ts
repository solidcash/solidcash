import { describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush } from '@bitauth/libauth';
import {
  INDEX_NONE, bytesEqual, concatBytes, encodeWitnessBlock, splitFirstPush, type RecordEntry, type WitnessBlock,
} from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { PerCallCallResult } from '../../../src/per-call/call/index.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import {
  compilePerCall, deployPlain, enterPlain, newWorld, refusedVerdicts, type PlainDeployment, type World,
} from '../ahead/composition-world.js';

/**
 * One deployment entered several times in one plain call, whose frames all name its data record, on the plain call
 * path (`callPerCallEntry`).
 *
 * `Vault.release` calls its claimer, which calls back `get`, `pay` twice and `mark`, all inside the outer frame.
 * Every vault entry reads the claimer and the fee from the vault's data record, and `mark` raises the fee. The outer
 * frame's segment after its call runs after `mark`, so it continues from the view `mark` left, not from the one it
 * was entered with: the record is chained over every frame of the call in the order the validator walks them, as the
 * hop chains it. The outer frame touches no node of the record mapping the inner frames read, since a node an outer
 * and an inner frame both touch is refused by name on its own (`requireChainableNodes`). The call settles, the outer
 * frame reads the raised fee after its call, the fee and the claimer's reading read back, and a block whose outer
 * frame states another view of the record after its call is refused.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'struct Rec { bool open; uint256 amount; }',
  'interface IVault {',
  '  function get(uint256 id) external view returns (uint256);',
  '  function pay(uint256 id, uint256 share) external;',
  '  function mark(uint256 id) external;',
  '}',
  'interface IClaimer { function claim(address vault, uint256 id) external; }',
  'contract Vault {',
  '  address public claimer;',
  '  uint256 public fee;',
  '  mapping(uint256 => Rec) internal recs;',
  '  constructor(address claimer_, uint256 fee_) { claimer = claimer_; fee = fee_; }',
  '  function open(uint256 id, uint256 amount) external { recs[id] = Rec(true, amount); }',
  '  function release(uint256 id) external {',
  '    IClaimer(claimer).claim(address(this), id);',
  '    require(fee > 10, "unmarked");',
  '  }',
  '  function get(uint256 id) external view returns (uint256) {',
  '    require(msg.sender == claimer, "not claimer");',
  '    return recs[id].amount - fee;',
  '  }',
  '  function pay(uint256 id, uint256 share) external {',
  '    require(msg.sender == claimer, "not claimer");',
  '    require(share + fee <= recs[id].amount, "too much");',
  '  }',
  '  function mark(uint256 id) external {',
  '    require(msg.sender == claimer, "not claimer");',
  '    require(recs[id].open, "closed");',
  '    fee = fee + 1;',
  '  }',
  '}',
  'contract Claimer {',
  '  uint256 public seen;',
  '  function claim(address vault, uint256 id) external {',
  '    seen = IVault(vault).get(id);',
  '    IVault(vault).pay(id, 1);',
  '    IVault(vault).pay(id, 2);',
  '    IVault(vault).mark(id);',
  '  }',
  '}',
  'contract Desk {',
  '  Vault public vault;',
  '  constructor(Vault vault_) { vault = vault_; }',
  '  function release(uint256 id) external { vault.release(id); }',
  '}',
].join('\n');

const artifacts = compilePerCall(SOURCE);

const ID = 7n;

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

interface Released {
  readonly world: World;
  readonly vault: PlainDeployment;
  readonly claimer: PlainDeployment;
  readonly result: PerCallCallResult;
}

let releaseRun: Promise<Released> | undefined;
/** A desk releasing a record the vault holds open at 100, with a fee of 10, through the vault's claimer. */
function released(): Promise<Released> {
  releaseRun ??= (async (): Promise<Released> => {
    const world = await newWorld(0x7b);
    const claimer = await deployPlain(world, artifacts.Claimer!);
    const vault = await deployPlain(world, artifacts.Vault!, [claimer.address, 10n]);
    const desk = await deployPlain(world, artifacts.Desk!, [vault.address]);
    await enter(world, vault, 'open', [ID, 100n]);
    const result = await enter(world, desk, 'release', [ID], [vault, claimer]);
    return { world, vault, claimer, result };
  })();
  return releaseRun;
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

/** The masters of the frames of `result` that ran `functionName`, in the order they completed. */
function framesOf(result: PerCallCallResult, functionName: string): readonly string[] {
  return result.completed.filter((frame) => frame.functionName === functionName).map((frame) => frame.master);
}

/** The one frame of `result` that ran `functionName`. */
function frameOf(result: PerCallCallResult, functionName: string): string {
  const frames = framesOf(result, functionName);
  expect(frames).toHaveLength(1);
  return frames[0]!;
}

/** The declarations one frame makes of the spent input at `index`, in segment order. */
function declarationsOf(result: PerCallCallResult, master: string, index: number): readonly RecordEntry[] {
  return result.draft.blockOf(master).segments.flat().filter((declared) => declared.in === index);
}

/** The one declaration of `mark` that moves a spent input: its write of the vault's data record. */
function markWrite(result: PerCallCallResult): RecordEntry {
  const writes = result.draft.blockOf(frameOf(result, 'Vault.mark()')).segments.flat()
    .filter((declared) => declared.in !== INDEX_NONE && !bytesEqual(declared.viewIn, declared.viewOut));
  expect(writes).toHaveLength(1);
  return writes[0]!;
}

describe('a plain deployment entered several times whose frames name its data record', () => {
  it('settles a release whose claimer calls back get, pay twice and mark inside it', async () => {
    const { result } = await released();
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    const ran = result.completed.map((frame) => frame.functionName);
    expect(ran).toEqual(expect.arrayContaining([
      'Vault.release()', 'Claimer.claim()', 'Vault.get()', 'Vault.pay()', 'Vault.mark()',
    ]));
    expect(framesOf(result, 'Vault.pay()')).toHaveLength(2);
    // Every frame before `mark` keeps the view the record was entered with, and the outer frame's segment after its
    // call keeps the view `mark` left, which the record's output carries.
    const written = markWrite(result);
    for (const master of [...framesOf(result, 'Vault.get()'), ...framesOf(result, 'Vault.pay()')]) {
      const kept = declarationsOf(result, master, written.in);
      expect(kept.length).toBeGreaterThan(0);
      for (const declared of kept) {
        expect(binToHex(declared.viewIn)).toBe(binToHex(written.viewIn));
        expect(binToHex(declared.viewOut)).toBe(binToHex(written.viewIn));
      }
    }
    const outer = result.draft.blockOf(frameOf(result, 'Vault.release()')).segments;
    expect(outer.length).toBe(2);
    const before = outer[0]!.filter((declared) => declared.in === written.in);
    const after = outer[1]!.filter((declared) => declared.in === written.in);
    expect(before).toHaveLength(1);
    expect(after).toHaveLength(1);
    expect(binToHex(before[0]!.viewOut)).toBe(binToHex(written.viewIn));
    expect(binToHex(after[0]!.viewIn)).toBe(binToHex(written.viewOut));
    expect(binToHex(after[0]!.viewOut)).toBe(binToHex(written.viewOut));
    const output = result.transaction.outputs[written.out]?.token?.nft?.commitment;
    expect(binToHex(output ?? new Uint8Array(0))).toBe(binToHex(written.viewOut));
  }, 600_000);

  it('reads the raised fee back, and the claimer kept what the vault answered before the fee was raised', async () => {
    const { world, vault, claimer } = await released();
    expect([
      await view(world, vault, 'fee', []),
      await view(world, claimer, 'seen', []),
    ]).toStrictEqual([11n, 90n]);
  }, 600_000);

  it('refuses a block whose outer frame states another view of the record after its call', async () => {
    const { result } = await released();
    expect(refusedOn(result, structuredClone(result.transaction) as VmTransaction)).toStrictEqual([]);
    const written = markWrite(result);
    const master = frameOf(result, 'Vault.release()');
    const block = structuredClone(result.draft.blockOf(master)) as WitnessBlock;
    const declared = block.segments[block.segments.length - 1]!.find((entry) => entry.in === written.in);
    expect(declared).toBeDefined();
    const wrong = Uint8Array.from(declared!.viewIn);
    wrong[wrong.length - 1] = wrong[wrong.length - 1]! ^ 0x01;
    declared!.viewIn = wrong;
    declared!.viewOut = Uint8Array.from(wrong);
    expect(refusedOn(result, withBlock(result, master, block))).not.toStrictEqual([]);
  }, 600_000);
});
