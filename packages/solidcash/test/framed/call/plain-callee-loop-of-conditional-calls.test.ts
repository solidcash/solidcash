import { describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { concatBytes, encodeWitnessBlock, splitFirstPush, type WitnessBlock } from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { FramedCallResult } from '../../../src/framed/call/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import {
  compileFramed, deployPlain, enterPlain, newWorld, refusedVerdicts, type PlainDeployment, type World,
} from '../ahead/composition-world.js';

/**
 * A plain callee whose loop makes a call on each turn an earlier call's result admits, with arguments read from that
 * result, on the plain call path (`callFramedEntry`).
 *
 * A desk releases a deal the vault holds: `Vault.release` marks the deal's record and calls `Claimer.claim`, which
 * calls back into the vault for the deal's three shares and then, once per share above zero, asks the vault to send
 * that share of a token to the payee of its turn. The vault sends a real token, so its native send sits on a branch
 * the call does not take. The claimer's loop is published as a `loop` site guarded on the shares, so its turns are
 * not the claimer's own facts: the plan stops before the site inside the claimer's frame, the shares are learned from
 * the frame of the call before it, which reads the record the vault's outer frame wrote, and the call is planned again
 * from them, as the hop plans a guarded loop (`callingTurnsOf`): the zero share's turn makes no call, and each other
 * turn's call carries its own payee and share. The release settles, the claimer's frame records one call per paying
 * turn, the token balances read back with the zero share's payee holding nothing, and a block whose record of the
 * shares, and the shares frame's own `retval` alike, states another share is refused by the frame that computed them.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'struct Deal { bool released; uint256 amount; }',
  'interface IERC20 {',
  '  function transfer(address to, uint256 amount) external returns (bool);',
  '}',
  'interface IVault {',
  '  function shares(uint256 id) external view returns (uint256[3] memory);',
  '  function sendShare(address token, address to, uint256 amount) external;',
  '}',
  'interface IClaimer { function claim(address vault, uint256 id) external; }',
  'contract Token {',
  '  mapping(address => uint256) public balanceOf;',
  '  event Transfer(address indexed from, address indexed to, uint256 value);',
  '  function mint(address to, uint256 amount) external { balanceOf[to] += amount; }',
  '  function transfer(address to, uint256 amount) external returns (bool) {',
  '    require(balanceOf[msg.sender] >= amount, "balance");',
  '    balanceOf[msg.sender] -= amount;',
  '    balanceOf[to] += amount;',
  '    emit Transfer(msg.sender, to, amount);',
  '    return true;',
  '  }',
  '}',
  'contract Vault {',
  '  mapping(uint256 => Deal) internal deals;',
  '  IClaimer public claimer;',
  '  constructor(IClaimer claimer_) { claimer = claimer_; }',
  '  function open(uint256 id, uint256 amount) external { deals[id] = Deal(false, amount); }',
  '  function release(uint256 id) external {',
  '    require(!deals[id].released, "released");',
  '    deals[id].released = true;',
  '    claimer.claim(address(this), id);',
  '  }',
  '  function shares(uint256 id) external view returns (uint256[3] memory) {',
  '    require(deals[id].released, "held");',
  '    uint256 amount = deals[id].amount;',
  '    uint256[3] memory s;',
  '    s[0] = amount * 3 / 5;',
  '    s[2] = amount - s[0];',
  '    return s;',
  '  }',
  '  function sendShare(address token, address to, uint256 amount) external {',
  '    require(msg.sender == address(claimer), "claimer");',
  '    if (token == address(0)) payable(to).transfer(amount);',
  '    else IERC20(token).transfer(to, amount);',
  '  }',
  '  function isReleased(uint256 id) external view returns (bool) { return deals[id].released; }',
  '}',
  'contract Claimer {',
  '  address public token;',
  '  address public first;',
  '  address public second;',
  '  address public third;',
  '  constructor(address token_, address first_, address second_, address third_) {',
  '    token = token_; first = first_; second = second_; third = third_;',
  '  }',
  '  function claim(address vault, uint256 id) external {',
  '    uint256[3] memory s = IVault(vault).shares(id);',
  '    address[3] memory to = [first, second, third];',
  '    for (uint256 i = 0; i < 3; i++) {',
  '      if (s[i] > 0) IVault(vault).sendShare(token, to[i], s[i]);',
  '    }',
  '  }',
  '}',
  'contract Desk {',
  '  Vault public vault;',
  '  constructor(Vault vault_) { vault = vault_; }',
  '  function release(uint256 id) external { vault.release(id); }',
  '}',
].join('\n');

const artifacts = compileFramed(SOURCE);

const ID = 7n;
/** The deal's amount: shares of 60, 0 and 40. */
const AMOUNT = 100n;
/** The payee of each turn, none of which the token's list holds yet. */
const PAYEES = [0x41, 0x42, 0x43].map((fill) => encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(fill)));

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
  readonly token: PlainDeployment;
  readonly vault: PlainDeployment;
  readonly result: FramedCallResult;
}

let releaseRun: Promise<Released> | undefined;
/** A desk releasing a deal of 100 the vault holds, with 1000 of the token minted to the vault. */
function released(): Promise<Released> {
  releaseRun ??= (async (): Promise<Released> => {
    const world = await newWorld(0x7c);
    const token = await deployPlain(world, artifacts.Token!);
    const claimer = await deployPlain(world, artifacts.Claimer!, [token.address, ...PAYEES]);
    const vault = await deployPlain(world, artifacts.Vault!, [claimer.address]);
    const desk = await deployPlain(world, artifacts.Desk!, [vault.address]);
    await enter(world, token, 'mint', [vault.address, 1000n]);
    await enter(world, vault, 'open', [ID, AMOUNT]);
    const result = await enter(world, desk, 'release', [ID], [vault, claimer, token]);
    return { world, token, vault, result };
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

/** `base` (the settled transaction by default) with one master's witness block replaced by `block`. */
function withBlock(
  result: FramedCallResult, master: string, block: WitnessBlock,
  base: VmTransaction = result.transaction as VmTransaction,
): VmTransaction {
  const forged = structuredClone(base);
  const index = result.draft.layout.participants.find((placed) => placed.id === master)!.index;
  const { rest } = splitFirstPush(forged.inputs[index]!.unlockingBytecode);
  forged.inputs[index] = {
    ...forged.inputs[index]!,
    unlockingBytecode: concatBytes([encodeDataPush(encodeWitnessBlock(block)), rest]),
  };
  return forged;
}

/** The master of the one frame of `result` that ran `identity`. */
function frameOf(result: FramedCallResult, identity: string): string {
  const frames = result.completed.filter((frame) => frame.functionName === identity);
  expect(frames).toHaveLength(1);
  return frames[0]!.master;
}

describe('a plain callee whose loop calls on each turn an earlier call\'s result admits', () => {
  it('settles a release whose claimer sends each non-zero share through the vault, one call per paying turn', async () => {
    const { world, vault, result } = await released();
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(result.completed.map((frame) => frame.functionName).sort()).toStrictEqual([
      'Claimer.claim()', 'Desk.release()', 'Token.transfer()', 'Token.transfer()', 'Vault.release()',
      'Vault.sendShare()', 'Vault.sendShare()', 'Vault.shares()',
    ]);
    // The claimer records the shares read and one call for each turn its guard admits: the zero share's makes none.
    expect(result.draft.blockOf(frameOf(result, 'Claimer.claim()')).calls).toHaveLength(3);
    // The vault sends a real token, so no output pays a payee's lock directly.
    const locks = new Set(PAYEES.map((payee) => binToHex(payee)));
    expect(result.transaction.outputs.some((output) => locks.has(binToHex(output.lockingBytecode)))).toBe(false);
    expect(await view(world, vault, 'isReleased', [ID])).toBe(true);
  }, 600_000);

  it('reads back each payee\'s token balance: the zero share pays nothing', async () => {
    const { world, token, vault } = await released();
    const balances: unknown[] = [];
    for (const holder of [vault.address, ...PAYEES]) balances.push(await view(world, token, 'balanceOf', [holder]));
    expect(balances).toStrictEqual([900n, 60n, 0n, 40n]);
  }, 600_000);

  it('refuses a block whose record of the shares and the shares frame\'s retval state another share', async () => {
    const { result } = await released();
    expect(refusedOn(result, structuredClone(result.transaction) as VmTransaction)).toStrictEqual([]);
    const sharesMaster = frameOf(result, 'Vault.shares()');
    const claimMaster = frameOf(result, 'Claimer.claim()');
    const sharesBlock = structuredClone(result.draft.blockOf(sharesMaster)) as WitnessBlock;
    const claimBlock = structuredClone(result.draft.blockOf(claimMaster)) as WitnessBlock;
    // The claimer's record of its first call carries what the shares frame returned.
    expect(claimBlock.calls[0]!.result).toStrictEqual(sharesBlock.retval);
    // A builder states the first share as 61 rather than 60, in the record and the `retval` alike.
    const at = [...sharesBlock.retval].flatMap((byte, index) => (byte === 60 ? [index] : []));
    expect(at).toHaveLength(1);
    const forged = Uint8Array.from(sharesBlock.retval);
    forged[at[0]!] = 61;
    sharesBlock.retval = forged;
    claimBlock.calls[0]!.result = Uint8Array.from(forged);
    const transaction = withBlock(result, claimMaster, claimBlock, withBlock(result, sharesMaster, sharesBlock));
    expect(refusedOn(result, transaction)).toContain(sharesMaster);
  }, 600_000);
});
