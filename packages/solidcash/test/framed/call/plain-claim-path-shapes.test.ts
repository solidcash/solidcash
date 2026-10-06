import { describe, expect, it } from 'vitest';
import { encodeDataPush, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import {
  concatBytes, encodeWitnessBlock, splitFirstPush, type Artifact, type WitnessBlock,
} from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { FramedCallResult } from '../../../src/framed/call/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import { compositionEventLogs } from '../../../src/framed/receipt/index.js';
import {
  compileFramed, deployPlain, enterPlain, newWorld, refusedVerdicts, type PlainDeployment, type World,
} from '../ahead/composition-world.js';

/**
 * The shapes a claim path takes past a plain callee's loop of conditional calls, on the plain call path
 * (`callFramedEntry`): a re-entered write before the loop, a returned array the caller emits, and an arbitration
 * whose claimer reads the arbiter's own record back through the arbiter while the arbiter's frame is open.
 *
 * A claimer reads the fee an arbiter owes for a deal, has the vault compute the deal's three shares from it, calls
 * back into the vault to mark the deal claimed, and then asks the vault, once per share above zero, to send that
 * share of a token to the payee of its turn, returning the shares. Each call reads what an earlier one returned, so
 * the plan stops before each such site and is planned again from the result its frame computed.
 *
 * - A release: the vault checks the deal's buyer is its caller, marks the deal released and calls the claimer, whose
 *   `setClaimed` call rewrites the node the vault's outer frame wrote before that call; the vault then emits the
 *   shares the claimer returned.
 * - An arbitration: the arbiter has the vault settle the deal (a write of the vault's node by an earlier frame, which
 *   `setClaimed` later rewrites), writes its own ruling, and calls the claimer, whose fee read re-enters the arbiter
 *   and sees that ruling: the fee is paid only once the deal is ruled. The arbiter emits and returns the shares.
 *
 * Each settles, the vault's node reads back with both writes, the token balances read back with each zero share's
 * payee paid nothing, the events carry the shares, and a block whose fee or event states another value is refused by
 * the frame that computed it.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'struct Deal { bool released; bool claimed; address buyer; uint256 amount; uint256 firstPct; }',
  'struct Ruling { bool ruled; uint256 fee; }',
  'interface IERC20 {',
  '  function transfer(address to, uint256 amount) external returns (bool);',
  '}',
  'interface IVault {',
  '  function shares(uint256 id, uint256 fee) external view returns (uint256[3] memory);',
  '  function setClaimed(uint256 id) external;',
  '  function sendShare(address token, address to, uint256 amount) external;',
  '  function settle(uint256 id, uint256 firstPct) external;',
  '}',
  'interface IArbiter { function feeOf(uint256 id) external view returns (uint256); }',
  'interface IClaimer { function claim(address vault, uint256 id) external returns (uint256[3] memory); }',
  'contract Token {',
  '  event Transfer(address indexed from, address indexed to, uint256 value);',
  '  mapping(address => uint256) public balanceOf;',
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
  '  event Released(uint256 id, uint256[3] amounts);',
  '  mapping(uint256 => Deal) internal deals;',
  '  IClaimer public claimer;',
  '  address public arbiter;',
  '  constructor(IClaimer claimer_) { claimer = claimer_; }',
  '  function setArbiter(address arbiter_) external { arbiter = arbiter_; }',
  '  function open(uint256 id, address buyer, uint256 amount, uint256 firstPct) external {',
  '    deals[id] = Deal(false, false, buyer, amount, firstPct);',
  '  }',
  '  function release(uint256 id) external {',
  '    require(msg.sender == deals[id].buyer, "buyer");',
  '    require(!deals[id].released, "released");',
  '    deals[id].released = true;',
  '    uint256[3] memory amounts = claimer.claim(address(this), id);',
  '    emit Released(id, amounts);',
  '  }',
  '  function settle(uint256 id, uint256 firstPct) external {',
  '    require(msg.sender == arbiter, "arbiter");',
  '    require(!deals[id].released, "released");',
  '    deals[id].released = true;',
  '    deals[id].firstPct = firstPct;',
  '  }',
  '  function shares(uint256 id, uint256 fee) external view returns (uint256[3] memory) {',
  '    require(deals[id].released, "held");',
  '    uint256 amount = deals[id].amount;',
  '    uint256[3] memory s;',
  '    s[2] = amount * fee / 100;',
  '    s[0] = (amount - s[2]) * deals[id].firstPct / 100;',
  '    s[1] = amount - s[2] - s[0];',
  '    return s;',
  '  }',
  '  function setClaimed(uint256 id) external {',
  '    require(msg.sender == address(claimer), "claimer");',
  '    require(deals[id].released && !deals[id].claimed, "claimed");',
  '    deals[id].claimed = true;',
  '  }',
  '  function sendShare(address token, address to, uint256 amount) external {',
  '    require(msg.sender == address(claimer), "claimer");',
  '    if (token == address(0)) payable(to).transfer(amount);',
  '    else IERC20(token).transfer(to, amount);',
  '  }',
  '  function isReleased(uint256 id) external view returns (bool) { return deals[id].released; }',
  '  function isClaimed(uint256 id) external view returns (bool) { return deals[id].claimed; }',
  '}',
  'contract Claimer {',
  '  address public token;',
  '  address public first;',
  '  address public second;',
  '  address public third;',
  '  IArbiter public arbiter;',
  '  constructor(address token_, address first_, address second_, address third_) {',
  '    token = token_; first = first_; second = second_; third = third_;',
  '  }',
  '  function setArbiter(IArbiter arbiter_) external { arbiter = arbiter_; }',
  '  function claim(address vault, uint256 id) external returns (uint256[3] memory) {',
  '    uint256 fee = arbiter.feeOf(id);',
  '    uint256[3] memory s = IVault(vault).shares(id, fee);',
  '    IVault(vault).setClaimed(id);',
  '    address[3] memory to = [first, second, third];',
  '    for (uint256 i = 0; i < 3; i++) {',
  '      if (s[i] > 0) IVault(vault).sendShare(token, to[i], s[i]);',
  '    }',
  '    return s;',
  '  }',
  '}',
  'contract Arbiter {',
  '  event Ruled(uint256 id, uint256[3] amounts);',
  '  mapping(uint256 => Ruling) internal rulings;',
  '  IVault public vault;',
  '  IClaimer public claimer;',
  '  constructor(IVault vault_, IClaimer claimer_) { vault = vault_; claimer = claimer_; }',
  '  function assign(uint256 id, uint256 fee) external { rulings[id] = Ruling(false, fee); }',
  '  function arbitrate(uint256 id, uint256 firstPct) external returns (uint256[3] memory) {',
  '    require(!rulings[id].ruled, "ruled");',
  '    vault.settle(id, firstPct);',
  '    rulings[id].ruled = true;',
  '    uint256[3] memory amounts = claimer.claim(address(vault), id);',
  '    emit Ruled(id, amounts);',
  '    return amounts;',
  '  }',
  '  function feeOf(uint256 id) external view returns (uint256) {',
  '    return rulings[id].ruled ? rulings[id].fee : 0;',
  '  }',
  '}',
  'contract Desk {',
  '  Vault public vault;',
  '  Arbiter public arbiter;',
  '  constructor(Vault vault_, Arbiter arbiter_) { vault = vault_; arbiter = arbiter_; }',
  '  function release(uint256 id) external { vault.release(id); }',
  '  function arbitrate(uint256 id, uint256 firstPct) external { arbiter.arbitrate(id, firstPct); }',
  '}',
].join('\n');

const artifacts = compileFramed(SOURCE);
const ARTIFACTS = Object.values(artifacts).filter((artifact): artifact is Artifact => artifact !== undefined);

/** A deal released by its holder: 100 split 60 to the first payee, its fee of 5 unpaid, so shares of 60, 40, 0. */
const RELEASED = 7n;
/** A deal the arbiter rules all to the first payee, less its fee of 10 percent: shares of 90, 0, 10. */
const RULED = 8n;
/** The payee of each turn, none of which the token's list holds yet. */
const PAYEES = [0x51, 0x52, 0x53].map((fill) => encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(fill)));

/** One entry of `root` that has to settle, entered by the user and reaching the deployments named. */
async function enter(
  world: World, root: PlainDeployment, functionName: string, args: readonly FunctionArgument[],
  reached: readonly PlainDeployment[] = [],
): Promise<FramedCallResult> {
  const outcome = await enterPlain(world, root, functionName, args, Object.fromEntries(reached.map((entry) =>
    [entry.artifact.contractName, { artifact: entry.artifact, categoryId: entry.categoryId }])));
  expect(outcome.error?.message).toBeUndefined();
  expect(refusedVerdicts(outcome.result!)).toBeUndefined();
  return outcome.result!;
}

/** A view's value, read from a plain deployment's records and nodes through the read path. */
async function view(
  world: World, entry: PlainDeployment, functionName: string, args: readonly FunctionArgument[],
): Promise<unknown> {
  const read = await readFramedEntry({
    provider: world.network, artifact: entry.artifact, categoryId: entry.categoryId, functionName,
    args: [...args], vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

interface Deployed {
  readonly world: World;
  readonly token: PlainDeployment;
  readonly claimer: PlainDeployment;
  readonly vault: PlainDeployment;
  readonly arbiter: PlainDeployment;
  readonly desk: PlainDeployment;
}

let deployRun: Promise<Deployed> | undefined;
/** The five deployments wired to each other, 1000 of the token minted to the vault and both deals opened. */
function deployed(): Promise<Deployed> {
  deployRun ??= (async (): Promise<Deployed> => {
    const world = await newWorld(0x7d);
    const token = await deployPlain(world, artifacts.Token!);
    const claimer = await deployPlain(world, artifacts.Claimer!, [token.address, ...PAYEES]);
    const vault = await deployPlain(world, artifacts.Vault!, [claimer.address]);
    const arbiter = await deployPlain(world, artifacts.Arbiter!, [vault.address, claimer.address]);
    const desk = await deployPlain(world, artifacts.Desk!, [vault.address, arbiter.address]);
    await enter(world, claimer, 'setArbiter', [arbiter.address]);
    await enter(world, vault, 'setArbiter', [arbiter.address]);
    await enter(world, token, 'mint', [vault.address, 1000n]);
    await enter(world, vault, 'open', [RELEASED, desk.address, 100n, 60n]);
    await enter(world, vault, 'open', [RULED, desk.address, 100n, 50n]);
    await enter(world, arbiter, 'assign', [RELEASED, 5n]);
    await enter(world, arbiter, 'assign', [RULED, 10n]);
    return { world, token, claimer, vault, arbiter, desk };
  })();
  return deployRun;
}

let releaseRun: Promise<FramedCallResult> | undefined;
/** The desk releasing the first deal. */
function released(): Promise<FramedCallResult> {
  releaseRun ??= (async (): Promise<FramedCallResult> => {
    const { world, token, claimer, vault, arbiter, desk } = await deployed();
    return enter(world, desk, 'release', [RELEASED], [vault, claimer, arbiter, token]);
  })();
  return releaseRun;
}

let arbitrationRun: Promise<FramedCallResult> | undefined;
/** The desk having the arbiter rule the second deal all to the first payee, after the release settled. */
function arbitrated(): Promise<FramedCallResult> {
  arbitrationRun ??= (async (): Promise<FramedCallResult> => {
    await released().catch(() => undefined);
    const { world, token, claimer, vault, arbiter, desk } = await deployed();
    return enter(world, desk, 'arbitrate', [RULED, 100n], [arbiter, vault, claimer, token]);
  })();
  return arbitrationRun;
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

/** The logs of `result` named `eventName`, each as its fields printed with their integers in decimal. */
function logsNamed(result: FramedCallResult, eventName: string): readonly string[] {
  return compositionEventLogs(result.draft, ARTIFACTS, { outputs: result.transaction.outputs })
    .filter((log) => log.eventName === eventName)
    .map((log) => JSON.stringify(log.values, (_key, value: unknown) =>
      (typeof value === 'bigint' ? value.toString() : value)));
}

/** `result`'s settled transaction with the commitment of the first event `master` lists changed in its last byte. */
function withForgedEvent(result: FramedCallResult, master: string): VmTransaction {
  const transaction = structuredClone(result.transaction) as VmTransaction;
  const index = result.draft.blockOf(master).events[0]!;
  const output = transaction.outputs[index]!;
  const forged = Uint8Array.from(output.token!.nft!.commitment);
  forged[forged.length - 1] ^= 0x01;
  transaction.outputs[index] = {
    ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment: forged } },
  };
  return transaction;
}

describe('the plain claim path: a re-entered write before the loop, a returned array, an arbitration', () => {
  it('settles a release whose claimer marks the deal claimed through the vault before its share loop', async () => {
    const { world, vault } = await deployed();
    const result = await released();
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(result.completed.map((frame) => frame.functionName).sort()).toStrictEqual([
      'Arbiter.feeOf()', 'Claimer.claim()', 'Desk.release()', 'Token.transfer()', 'Token.transfer()',
      'Vault.release()', 'Vault.sendShare()', 'Vault.sendShare()', 'Vault.setClaimed()', 'Vault.shares()',
    ]);
    // The fee read, the shares, the mark and one send for each turn its guard admits: the zero share's makes none.
    expect(result.draft.blockOf(frameOf(result, 'Claimer.claim()')).calls).toHaveLength(5);
    // The node holds the outer frame's write and the re-entered one's alike.
    expect([await view(world, vault, 'isReleased', [RELEASED]), await view(world, vault, 'isClaimed', [RELEASED])])
      .toStrictEqual([true, true]);
  }, 600_000);

  it('emits from the vault\'s release the shares the claimer returned, and refuses another payload', async () => {
    const result = await released();
    const claimMaster = frameOf(result, 'Claimer.claim()');
    const releaseMaster = frameOf(result, 'Vault.release()');
    // The vault's record of its call carries what the claimer returned, which is what the shares frame returned.
    const returned = result.draft.blockOf(claimMaster).retval;
    expect(result.draft.blockOf(releaseMaster).calls[0]!.result).toStrictEqual(returned);
    expect(returned).toStrictEqual(result.draft.blockOf(frameOf(result, 'Vault.shares()')).retval);
    expect(logsNamed(result, 'Released')).toStrictEqual(['["7",["60","40","0"]]']);
    expect(refusedOn(result, structuredClone(result.transaction) as VmTransaction)).toStrictEqual([]);
    expect(refusedOn(result, withForgedEvent(result, releaseMaster))).toContain(releaseMaster);
  }, 600_000);

  it('settles an arbitration whose claimer reads the arbiter\'s ruling back through the arbiter', async () => {
    const { world, arbiter, vault } = await deployed();
    const result = await arbitrated();
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(result.completed.map((frame) => frame.functionName).sort()).toStrictEqual([
      'Arbiter.arbitrate()', 'Arbiter.feeOf()', 'Claimer.claim()', 'Desk.arbitrate()', 'Token.transfer()',
      'Token.transfer()', 'Vault.sendShare()', 'Vault.sendShare()', 'Vault.setClaimed()', 'Vault.settle()',
      'Vault.shares()',
    ]);
    expect(logsNamed(result, 'Ruled')).toStrictEqual(['["8",["90","0","10"]]']);
    expect([await view(world, vault, 'isReleased', [RULED]), await view(world, vault, 'isClaimed', [RULED])])
      .toStrictEqual([true, true]);
    expect(await view(world, arbiter, 'feeOf', [RULED])).toBe(10n);
  }, 600_000);

  it('reads back each payee\'s token balance over both deals: each zero share pays nothing', async () => {
    const { world, token, vault } = await deployed();
    await released();
    await arbitrated();
    const balances: unknown[] = [];
    for (const holder of [vault.address, ...PAYEES]) balances.push(await view(world, token, 'balanceOf', [holder]));
    expect(balances).toStrictEqual([800n, 150n, 40n, 10n]);
  }, 600_000);

  it('refuses a block whose record of the fee and the fee frame\'s retval state another fee', async () => {
    const result = await arbitrated();
    expect(refusedOn(result, structuredClone(result.transaction) as VmTransaction)).toStrictEqual([]);
    const feeMaster = frameOf(result, 'Arbiter.feeOf()');
    const claimMaster = frameOf(result, 'Claimer.claim()');
    const feeBlock = structuredClone(result.draft.blockOf(feeMaster)) as WitnessBlock;
    const claimBlock = structuredClone(result.draft.blockOf(claimMaster)) as WitnessBlock;
    // The claimer's record of its first call carries the fee the re-entered frame computed from the ruling.
    expect(claimBlock.calls[0]!.result).toStrictEqual(feeBlock.retval);
    const at = [...feeBlock.retval].flatMap((byte, index) => (byte === 10 ? [index] : []));
    expect(at).toHaveLength(1);
    const forged = Uint8Array.from(feeBlock.retval);
    forged[at[0]!] = 11;
    feeBlock.retval = forged;
    claimBlock.calls[0]!.result = Uint8Array.from(forged);
    const transaction = withBlock(result, claimMaster, claimBlock, withBlock(result, feeMaster, feeBlock));
    expect(refusedOn(result, transaction)).toContain(feeMaster);
  }, 600_000);
});
