import { describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { concatBytes, encodeWitnessBlock, splitFirstPush, type RecordEntry, type WitnessBlock } from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { FramedCallResult } from '../../../src/framed/call/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import {
  compileFramed, deployPlain, enterPlain, newWorld, refusedVerdicts, type PlainDeployment, type World,
} from '../ahead/composition-world.js';

/**
 * A plain root that pays three fresh holders through separate frames of one payer, each a call-free token transfer,
 * on the plain call path (`callFramedEntry`).
 *
 * The token is OpenZeppelin-style: `_update` moves the balances inside `unchecked { }` blocks and keeps the supply in
 * its data record behind the mint and burn guards. Its artifact publishes the transfer's writes, the balances and
 * that record each in the frame's only segment, so every transfer frame declares the supply record as one it
 * rewrites and the three frames chain it: each starts from the view the one before it closed with. Each payment is
 * its own payer frame, which names the token by an argument, so the third transfer starts from the end of a writer
 * that itself starts from the first one's end. The plain path derives the whole call from its root, depth first, so
 * each transfer closes, and its end is learned, before the next one runs. The call settles, every balance and the
 * supply read back, and a block whose third transfer states another view of the supply record is refused.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IToken {',
  '  function transfer(address to, uint256 value) external returns (bool);',
  '}',
  'interface IPayer {',
  '  function share(address token, address to, uint256 amount) external;',
  '}',
  'contract Token {',
  '  error InsufficientBalance(address sender, uint256 balance, uint256 needed);',
  '  mapping(address => uint256) private _balances;',
  '  uint256 private _totalSupply;',
  '  function mint(address to, uint256 value) external { _update(address(0), to, value); }',
  '  function balanceOf(address account) external view returns (uint256) { return _balances[account]; }',
  '  function totalSupply() external view returns (uint256) { return _totalSupply; }',
  '  function transfer(address to, uint256 value) external returns (bool) {',
  '    _update(msg.sender, to, value);',
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
  '    if (to == address(0)) {',
  '      unchecked { _totalSupply -= value; }',
  '    } else {',
  '      unchecked { _balances[to] += value; }',
  '    }',
  '  }',
  '}',
  'contract Payer {',
  '  uint256 public limit;',
  '  constructor(uint256 limit_) { limit = limit_; }',
  '  function share(address token, address to, uint256 amount) external {',
  '    require(amount <= limit, "over limit");',
  '    IToken(token).transfer(to, amount);',
  '  }',
  '}',
  'contract Hub {',
  '  IPayer public payer;',
  '  address public token;',
  '  constructor(IPayer payer_, address token_) { payer = payer_; token = token_; }',
  '  function payAll(address a, address b, address c) external {',
  '    payer.share(token, a, 10);',
  '    payer.share(token, b, 20);',
  '    payer.share(token, c, 30);',
  '  }',
  '}',
].join('\n');

const units = compileFramed(SOURCE);

/** The transfer's entry, as the token's artifact publishes its stop sites. */
const TRANSFER = units.Token!.composition?.stopSites?.entries
  .find((entry) => entry.functionName === 'Token.transfer()');
/** The token's data records the transfer publishes a write of, by their index among its records: the supply's. */
const SUPPLY_RECORDS = [...new Set((TRANSFER?.writeSegments ?? [])
  .flatMap((write) => (write.record === undefined ? [] : [write.record])))];

/** Three holders the token's list does not hold before the payout, so each transfer inserts its holder's node. */
const HOLDERS = [0x41, 0x42, 0x43].map((fill) => encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(fill)));
const SHARES = [10n, 20n, 30n];
const MINTED = 100n;

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

interface PaidOut {
  readonly world: World;
  readonly token: PlainDeployment;
  readonly payer: PlainDeployment;
  readonly result: FramedCallResult;
}

let payoutRun: Promise<PaidOut> | undefined;
/** A hub paying the three holders through its payer, which holds the minted supply. */
function paidOut(): Promise<PaidOut> {
  payoutRun ??= (async (): Promise<PaidOut> => {
    const world = await newWorld(0x7c);
    const token = await deployPlain(world, units.Token!);
    const payer = await deployPlain(world, units.Payer!, [1000n]);
    const hub = await deployPlain(world, units.Hub!, [payer.address, token.address]);
    await enter(world, token, 'mint', [payer.address, MINTED]);
    const result = await enter(world, hub, 'payAll', [...HOLDERS], [payer, token]);
    return { world, token, payer, result };
  })();
  return payoutRun;
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

/** The masters of the frames of `result` that ran `functionName`, in the order they completed. */
function framesOf(result: FramedCallResult, functionName: string): readonly string[] {
  return result.completed.filter((frame) => frame.functionName === functionName).map((frame) => frame.master);
}

/** The input index of each data record the transfer writes, as the call placed it. */
function supplyRecords(result: FramedCallResult): readonly number[] {
  return SUPPLY_RECORDS.map((record) => result.draft.layout.participants
    .find((placed) => placed.id === `Token-record-${String(record)}`)!.index);
}

/** The declarations one frame makes of the spent input at `index`, in segment order. */
function declarationsOf(result: FramedCallResult, master: string, index: number): readonly RecordEntry[] {
  return result.draft.blockOf(master).segments.flat().filter((declared) => declared.in === index);
}

describe('a plain root paying three fresh holders through separate payer frames, each a token transfer', () => {
  it('publishes the transfer\'s writes, the balances and the supply\'s record, in its only segment', () => {
    const writes = TRANSFER?.writeSegments ?? [];
    expect(writes.some((write) => write.collection === '_balances' && write.segment === 0)).toBe(true);
    expect(writes.some((write) => write.record !== undefined && write.segment === 0)).toBe(true);
    expect(SUPPLY_RECORDS.length).toBeGreaterThan(0);
  });

  it('settles the three transfers, each starting from the supply record the one before it left', async () => {
    const { result } = await paidOut();
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(framesOf(result, 'Payer.share()')).toHaveLength(3);
    const transfers = framesOf(result, 'Token.transfer()');
    expect(transfers).toHaveLength(3);
    const records = supplyRecords(result);
    for (const index of records) {
      const chained = transfers.map((master) => declarationsOf(result, master, index));
      for (const declared of chained) expect(declared.length).toBeGreaterThan(0);
      // The first transfer starts from the record as it was spent, each later one from where the one before it ended,
      // and the record's output carries the third one's end.
      let left = result.sourceOutputs[index]!.token!.nft!.commitment;
      for (const declared of chained) {
        expect(binToHex(declared[0]!.viewIn)).toBe(binToHex(left));
        left = declared[declared.length - 1]!.viewOut;
      }
      expect(binToHex(result.transaction.outputs[index]!.token!.nft!.commitment)).toBe(binToHex(left));
    }
  }, 900_000);

  it('reads every balance and the supply back', async () => {
    const { world, token, payer } = await paidOut();
    const total = SHARES.reduce((sum, share) => sum + share, 0n);
    expect(await view(world, token, 'balanceOf', [payer.address])).toBe(MINTED - total);
    for (const [at, holder] of HOLDERS.entries()) {
      expect(await view(world, token, 'balanceOf', [holder])).toBe(SHARES[at]);
    }
    expect(await view(world, token, 'totalSupply', [])).toBe(MINTED);
  }, 900_000);

  it('refuses a block whose third transfer states another view of the supply record', async () => {
    const { result } = await paidOut();
    expect(refusedOn(result, structuredClone(result.transaction) as VmTransaction)).toStrictEqual([]);
    const master = framesOf(result, 'Token.transfer()')[2]!;
    const block = structuredClone(result.draft.blockOf(master)) as WitnessBlock;
    const records = new Set(supplyRecords(result));
    const declared = block.segments.flat().filter((entry) => records.has(entry.in));
    expect(declared.length).toBeGreaterThan(0);
    const wrong = Uint8Array.from(declared[0]!.viewIn);
    wrong[wrong.length - 1] = wrong[wrong.length - 1]! ^ 0x01;
    for (const entry of declared) {
      entry.viewIn = Uint8Array.from(wrong);
      entry.viewOut = Uint8Array.from(wrong);
    }
    expect(refusedOn(result, withBlock(result, master, block))).not.toStrictEqual([]);
  }, 900_000);
});
