import { beforeAll, describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush, encodeLockingBytecodeP2pkh, utf8ToBin } from '@bitauth/libauth';
import {
  concatBytes, encodeWitnessBlock, sha256, splitFirstPush, type Artifact, type StateValue, type WitnessBlock,
} from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import Signer from '../../../src/Signer.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { readSatoshiContainers, satoshiContainerLockingBytecode } from '../../../src/per-call/deploy/index.js';
import { PerCallCallError, PerCallFunctionCall } from '../../../src/per-call/call/index.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import {
  buildProxyArtifact, callPerCallProxyEntry, deployPerCallProxy, type PerCallProxyCallResult,
} from '../../../src/per-call/proxy/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * Native value (BCH) into and out of a contract behind its generated proxy (spec 4b, V5, V7), as an upgradeable
 * sale, auction or vault takes and pays it.
 *
 * The proxy's root frame takes the call's value, paid by the caller into a satoshi container of the proxy, and the
 * implementation's delegate frame sees the same value as `msg.value`. The implementation's sends pay from the
 * proxy's containers, the address that holds the balance, in a run after one of them. Each served case settles and is
 * broadcast: a deposit, through the hop and through a handle, a withdrawal, an entry that takes value and pays out, a
 * send on a branch, a payout of the whole balance and a payout per loop turn. What the EVM reverts is refused by
 * name. A spend that forges the value is refused by the machine: value the frames claim that the proxy's containers
 * do not take, a delegate frame claiming a value its caller did not carry, the proxy's containers drained past what
 * the frame pays, and a send paid elsewhere than the frame's own pin or after another contract's container.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'contract Bank {',
  '  address public implementation;',
  '  uint256 public received;',
  '  uint256 public paid;',
  '  function initialize(uint256 start) public { received = start; }',
  '  function deposit() external payable { received += msg.value; }',
  '  function withdraw(uint256 amount) external {',
  '    paid += amount;',
  '    payable(msg.sender).transfer(amount);',
  '  }',
  '  function depositAndWithdraw(uint256 amount) external payable {',
  '    received += msg.value;',
  '    paid += amount;',
  '    payable(msg.sender).transfer(amount);',
  '  }',
  '  function payIf(uint256 amount) external {',
  '    paid += 1;',
  '    if (amount > 0) { payable(msg.sender).transfer(amount); }',
  '  }',
  '}',
  'contract Vault {',
  '  address public implementation;',
  '  uint256 public received;',
  '  uint256 public paid;',
  '  function initialize(uint256 start) public { paid = start; }',
  '  function fund() external payable { received += msg.value; }',
  '  function refund(address[] calldata to, uint256 each) external {',
  '    for (uint256 i = 0; i < to.length; i++) { payable(to[i]).transfer(each); }',
  '    paid += each * to.length;',
  '  }',
  '  function sweep() external {',
  '    uint256 all = address(this).balance;',
  '    paid += all;',
  '    payable(msg.sender).transfer(all);',
  '  }',
  '  function holding() external view returns (uint256) { return address(this).balance; }',
  '}',
].join('\n');

const compiled = compileStringMulti(SOURCE, { solidityImportCompat: true, composition: 'per-call' } as never);
const bank = compiled.Bank!;
const vault = compiled.Vault!;

const IMPLEMENTATION = 'implementation-master';
const PROXY = 'proxy-master';
const CALLER = encodeLockingBytecodeP2pkh(alicePkh);
const CALLER_FUNDER = new SignatureTemplate(alicePriv).unlockP2PKH();

/** A 32-byte value derived from a label, distinct per label. */
const word = (label: string): Uint8Array => sha256(utf8ToBin(`proxied native value ${label}`));
/** A recipient's lock: a P2PKH lock of a hash derived from its label. */
const recipient = (label: string): Uint8Array => encodeLockingBytecodeP2pkh(word(label).slice(0, 20));

/** One network with the deployer's wallet, a coin factory, and the validator facets funded. */
interface World {
  readonly network: MockNetworkProvider;
  readonly walletAddress: string;
  readonly walletFunder: ReturnType<Contract['unlock']['spend']>;
  readonly coin: (lock: string) => Promise<Utxo>;
}

async function newWorld(seed: string): Promise<World> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  await fundShippedFacets(network);
  let serial = 0;
  return {
    network,
    walletAddress: wallet.address,
    walletFunder: wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
    coin: async (lock: string): Promise<Utxo> => {
      serial += 1;
      const utxo = { txid: binToHex(word(`${seed} coin ${serial}`)), vout: 0, satoshis: 5_000_000n };
      await network.addUtxo(lock, utxo);
      return utxo;
    },
  };
}

/** A contract behind its generated proxy, its record stated by the `initialize` the deployment runs. */
interface Proxied {
  readonly world: World;
  readonly artifact: Artifact;
  readonly proxyArtifact: Artifact;
  readonly proxyCategoryId: string;
  readonly implementationCategoryId: string;
}

async function deployProxied(artifact: Artifact, seed: string, start: bigint): Promise<Proxied> {
  const world = await newWorld(seed);
  const proxyArtifact = buildProxyArtifact(artifact);
  const deployOf = async (): Promise<Parameters<typeof deployPerCallProxy>[0]['proxyDeploy']> => ({
    fundingUtxo: await world.coin(world.walletAddress), funder: world.walletFunder, changeAddress: world.walletAddress,
  });
  const deployment = await deployPerCallProxy({
    provider: world.network,
    implementationArtifact: artifact,
    proxyArtifact,
    implementationDeploy: await deployOf(),
    proxyDeploy: await deployOf(),
    initialize: { functionName: 'initialize', args: [start] },
    callerLockingBytecode: CALLER,
    callerFunding: {
      utxo: await world.coin(binToHex(CALLER)), funder: CALLER_FUNDER, changeAddress: world.walletAddress,
    },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.broadcast).toBeDefined();
  return {
    world, artifact, proxyArtifact,
    proxyCategoryId: deployment.proxy.categoryId, implementationCategoryId: deployment.implementation.categoryId,
  };
}

/** Enters an entry through the hop with a fresh coin of the caller's, carrying `value` when it is given. */
async function enter(
  proxied: Proxied, functionName: string, args: readonly unknown[], value?: bigint,
): Promise<PerCallProxyCallResult> {
  return callPerCallProxyEntry({
    provider: proxied.world.network, implementationArtifact: proxied.artifact, proxyArtifact: proxied.proxyArtifact,
    proxyCategoryId: proxied.proxyCategoryId, implementationCategoryId: proxied.implementationCategoryId,
    functionName, args: args as never, callerUtxo: await proxied.world.coin(binToHex(CALLER)),
    callerLockingBytecode: CALLER, funder: CALLER_FUNDER, changeAddress: proxied.world.walletAddress,
    vm: compositionMachine(), ...(value === undefined ? {} : { value }),
  });
}

/** An entry read through the proxy at its category, as a handle's `staticCall` reads it. */
async function read(proxied: Proxied, functionName: string): Promise<StateValue> {
  const result = await readPerCallEntry({
    provider: proxied.world.network, artifact: proxied.artifact, categoryId: proxied.proxyCategoryId, functionName,
    vm: compositionMachine(),
  });
  expect(result.accepted).toBe(true);
  return result.value;
}

/** The value a category's live containers hold. */
async function held(proxied: Proxied, categoryId: string): Promise<bigint> {
  return (await readSatoshiContainers(proxied.world.network, categoryId))
    .reduce((sum, utxo) => sum + utxo.satoshis, 0n);
}

/** The refused verdicts of a result, as one line, or undefined when every input the machine was asked about accepted. */
function refused(result: PerCallProxyCallResult): string | undefined {
  const refusals = result.verdicts.filter((verdict) => !verdict.accepted);
  return refusals.length === 0 ? undefined
    : refusals.map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ');
}

/** The lock and the value each send the delegate frame lists pays on the broadcast, in list order. */
function paid(result: PerCallProxyCallResult): readonly string[] {
  return result.draft.blockOf(IMPLEMENTATION).sends.map((index) => {
    const output = result.broadcast!.outputs[index]!;
    return `${binToHex(output.lockingBytecode)}:${output.valueSatoshis}`;
  });
}

/** The output just before the delegate frame's first send: the container its run follows. */
function runContainer(result: PerCallProxyCallResult): { readonly lock: string; readonly value: bigint } {
  const output = result.broadcast!.outputs[result.draft.blockOf(IMPLEMENTATION).sends[0]! - 1]!;
  return { lock: binToHex(output.lockingBytecode), value: output.valueSatoshis };
}

describe('value into a payable entry behind a proxy', () => {
  let proxied: Proxied;
  beforeAll(async () => {
    proxied = await deployProxied(bank, 'deposits', 7n);
  }, 300_000);

  it('takes a deposit into the proxy\'s containers, which the delegate frame books as msg.value', async () => {
    const result = await enter(proxied, 'deposit', [], 20_000n);
    expect(refused(result)).toBeUndefined();
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // The root frame takes the value and its delegate frame carries the same, as a delegatecall keeps msg.value.
    expect(result.draft.blockOf(PROXY).value).toBe(20_000n);
    expect(result.draft.blockOf(IMPLEMENTATION).value).toBe(20_000n);
    expect(await read(proxied, 'received')).toBe(20_007n);
    // The proxy holds the balance, as it does on the EVM, and the implementation's own address holds none.
    expect(await held(proxied, proxied.proxyCategoryId)).toBe(20_000n);
    expect(await held(proxied, proxied.implementationCategoryId)).toBe(0n);
  }, 300_000);

  it('carries the value a handle on the proxied deployment attaches', async () => {
    // The handle pays with the largest coin at the signer's own lock.
    await proxied.world.coin(binToHex(CALLER));
    const abiEntry = bank.abi.find((entry) => entry.name === 'deposit')!;
    const call = new PerCallFunctionCall({
      artifact: bank,
      abiEntry: abiEntry as never,
      categoryId: proxied.proxyCategoryId,
      provider: proxied.world.network,
      signer: new Signer(alicePriv, proxied.world.network),
      proxyImplementationCategoryId: proxied.implementationCategoryId,
    }, 'deposit', []).withValue(5_000n);
    const details = await call.send();
    expect(details.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(await read(proxied, 'received')).toBe(25_007n);
    expect(await held(proxied, proxied.proxyCategoryId)).toBe(25_000n);
  }, 300_000);

  it('refuses by name value for an entry that is not payable, as the EVM\'s call-value check reverts it', async () => {
    await expect(enter(proxied, 'withdraw', [1n], 1_000n)).rejects.toThrow(
      'the implementation\'s "withdraw" entry is not payable, so a call to it carries no value',
    );
    const abiEntry = bank.abi.find((entry) => entry.name === 'withdraw')!;
    expect(() => new PerCallFunctionCall({
      artifact: bank, abiEntry: abiEntry as never, categoryId: proxied.proxyCategoryId, provider: proxied.world.network,
      proxyImplementationCategoryId: proxied.implementationCategoryId,
    }, 'withdraw', [1n]).withValue(1_000n)).toThrow(PerCallCallError);
  }, 300_000);
});

describe('sends paid from the proxy\'s containers', () => {
  let proxied: Proxied;
  const containerLock = (): string => binToHex(satoshiContainerLockingBytecode(proxied.proxyCategoryId));
  beforeAll(async () => {
    proxied = await deployProxied(bank, 'sends', 0n);
    expect(refused(await enter(proxied, 'deposit', [], 50_000n))).toBeUndefined();
  }, 300_000);

  it('pays a withdrawal to the caller, after a container of the proxy that keeps the change', async () => {
    const result = await enter(proxied, 'withdraw', [15_000n]);
    expect(refused(result)).toBeUndefined();
    expect(paid(result)).toStrictEqual([`${binToHex(CALLER)}:15000`]);
    expect(runContainer(result)).toStrictEqual({ lock: containerLock(), value: 35_000n });
    // The recipient's output, read back from the chain.
    const vout = result.draft.blockOf(IMPLEMENTATION).sends[0]!;
    const coins = await proxied.world.network.getUtxosForLockingBytecode(CALLER);
    expect(coins.find((utxo) => utxo.txid === result.broadcast!.txid && utxo.vout === vout)?.satoshis).toBe(15_000n);
    expect(await read(proxied, 'paid')).toBe(15_000n);
    expect(await held(proxied, proxied.proxyCategoryId)).toBe(35_000n);
  }, 300_000);

  it('takes value and pays out in one entry, from what the call brings and then from the containers', async () => {
    // Within what the call brings: no container of the proxy is spent, and the one the send follows keeps the rest.
    const within = await enter(proxied, 'depositAndWithdraw', [2_000n], 3_000n);
    expect(refused(within)).toBeUndefined();
    expect(paid(within)).toStrictEqual([`${binToHex(CALLER)}:2000`]);
    expect(runContainer(within)).toStrictEqual({ lock: containerLock(), value: 1_000n });
    expect(within.verdicts.some((verdict) => verdict.id.startsWith('proxy-container-'))).toBe(false);
    // Beyond it: the largest container pays what the call does not bring.
    const beyond = await enter(proxied, 'depositAndWithdraw', [4_000n], 1_000n);
    expect(refused(beyond)).toBeUndefined();
    expect(paid(beyond)).toStrictEqual([`${binToHex(CALLER)}:4000`]);
    expect(runContainer(beyond)).toStrictEqual({ lock: containerLock(), value: 32_000n });
    expect(beyond.verdicts.filter((verdict) => verdict.id.startsWith('proxy-container-'))).toHaveLength(1);
    expect(await read(proxied, 'received')).toBe(54_000n);
    expect(await read(proxied, 'paid')).toBe(21_000n);
    expect(await held(proxied, proxied.proxyCategoryId)).toBe(33_000n);
  }, 300_000);

  it('lists a send on a branch only when the branch runs', async () => {
    const skipped = await enter(proxied, 'payIf', [0n]);
    expect(refused(skipped)).toBeUndefined();
    expect(skipped.draft.blockOf(IMPLEMENTATION).sends).toStrictEqual([]);
    const made = await enter(proxied, 'payIf', [500n]);
    expect(refused(made)).toBeUndefined();
    expect(paid(made)).toStrictEqual([`${binToHex(CALLER)}:500`]);
    expect(await held(proxied, proxied.proxyCategoryId)).toBe(32_500n);
  }, 300_000);

  it('refuses by name a send the proxy\'s containers cannot cover, as the EVM reverts it', async () => {
    await expect(enter(proxied, 'withdraw', [40_000n])).rejects.toThrow(
      'proxy "BankProxy" holds 32500 satoshis in its containers, and the implementation\'s "withdraw" entry sends '
      + '40000 more than the call brings',
    );
  }, 300_000);
});

describe('a payout per loop turn, and of the whole balance, behind a proxy', () => {
  let proxied: Proxied;
  beforeAll(async () => {
    proxied = await deployProxied(vault, 'loop', 0n);
    expect(refused(await enter(proxied, 'fund', [], 100_000n))).toBeUndefined();
  }, 300_000);

  it('reads the balance the proxy holds', async () => {
    expect(await read(proxied, 'holding')).toBe(100_000n);
  }, 300_000);

  it('pays each recipient in turn, after a container of the proxy', async () => {
    const recipients = [recipient('a'), recipient('b'), recipient('c')];
    const result = await enter(proxied, 'refund', [recipients, 2_000n]);
    expect(refused(result)).toBeUndefined();
    expect(paid(result)).toStrictEqual(recipients.map((lock) => `${binToHex(lock)}:2000`));
    expect(runContainer(result)).toStrictEqual({
      lock: binToHex(satoshiContainerLockingBytecode(proxied.proxyCategoryId)), value: 94_000n,
    });
    expect(await read(proxied, 'paid')).toBe(6_000n);
  }, 300_000);

  it('settles no recipient, which lists no send, and one recipient', async () => {
    const none = await enter(proxied, 'refund', [[], 2_000n]);
    expect(refused(none)).toBeUndefined();
    expect(none.draft.blockOf(IMPLEMENTATION).sends).toStrictEqual([]);
    const one = await enter(proxied, 'refund', [[recipient('d')], 1_500n]);
    expect(refused(one)).toBeUndefined();
    expect(paid(one)).toStrictEqual([`${binToHex(recipient('d'))}:1500`]);
    expect(await held(proxied, proxied.proxyCategoryId)).toBe(92_500n);
  }, 300_000);

  it('pays out the whole balance it reads, spending every container of the proxy', async () => {
    // A second container, so the read is the sum of two.
    expect(refused(await enter(proxied, 'fund', [], 7_500n))).toBeUndefined();
    const swept = await enter(proxied, 'sweep', []);
    expect(refused(swept)).toBeUndefined();
    expect(paid(swept)).toStrictEqual([`${binToHex(CALLER)}:100000`]);
    expect(swept.verdicts.filter((verdict) => verdict.id.startsWith('proxy-container-'))).toHaveLength(2);
    // The container the send follows keeps only what the caller put in to stand it up.
    expect(await held(proxied, proxied.proxyCategoryId)).toBe(1_000n);
  }, 300_000);
});

type VmProgram = Parameters<ReturnType<typeof compositionMachine>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;

/**
 * The machine's verdict on every input a result was asked about, by id, once `apply` has changed the derived spend:
 * its outputs, or the delegate frame's block, which is encoded as the composer encodes it with the pushes after it
 * kept.
 */
function forged(
  result: PerCallProxyCallResult,
  apply: (draft: { readonly transaction: VmTransaction; readonly block: WitnessBlock }) => void,
): ReadonlyMap<string, boolean> {
  const transaction = structuredClone(result.transaction) as VmTransaction;
  const block = structuredClone(result.draft.blockOf(IMPLEMENTATION)) as WitnessBlock;
  apply({ transaction, block });
  const at = result.draft.layout.participants.find((placed) => placed.id === IMPLEMENTATION)!.index;
  const input = transaction.inputs[at]!;
  const { rest } = splitFirstPush(input.unlockingBytecode);
  transaction.inputs[at] = {
    ...input, unlockingBytecode: concatBytes([encodeDataPush(encodeWitnessBlock(block)), rest]),
  };
  const vm = compositionMachine();
  return new Map(result.verdicts.map((verdict) => {
    const state = vm.evaluate({ inputIndex: verdict.index, sourceOutputs: result.sourceOutputs, transaction });
    return [verdict.id, vm.stateSuccess(state) === true];
  }));
}

/** True when every input the result was asked about accepts the forged spend. */
const everyAccepts = (verdicts: ReadonlyMap<string, boolean>): boolean => [...verdicts.values()].every(Boolean);

describe('a forged value through the proxy', () => {
  let proxied: Proxied;
  let deposit: PerCallProxyCallResult;
  let withdrawal: PerCallProxyCallResult;
  beforeAll(async () => {
    proxied = await deployProxied(bank, 'forged', 0n);
    deposit = await enter(proxied, 'deposit', [], 20_000n);
    expect(refused(deposit)).toBeUndefined();
    withdrawal = await enter(proxied, 'withdraw', [15_000n]);
    expect(refused(withdrawal)).toBeUndefined();
  }, 300_000);

  /** The index of the derived spend's output at the proxy's container lock, the one the deposit pays into. */
  const containerOutput = (result: PerCallProxyCallResult): number => {
    const lock = binToHex(satoshiContainerLockingBytecode(proxied.proxyCategoryId));
    return result.transaction.outputs.findIndex((output) => binToHex(output.lockingBytecode) === lock);
  };
  const sendOutput = (): number => withdrawal.draft.blockOf(IMPLEMENTATION).sends[0]!;
  const change = (transaction: VmTransaction): VmTransaction['outputs'][number] => transaction.outputs.at(-1)!;

  it('accepts each spend rebuilt unchanged, so each case below is its one change', () => {
    expect(everyAccepts(forged(deposit, () => undefined))).toBe(true);
    expect(everyAccepts(forged(withdrawal, () => undefined))).toBe(true);
  });

  it('refuses value the frames claim that the proxy\'s containers do not take, at the validator', () => {
    const verdicts = forged(deposit, ({ transaction }) => {
      const output = transaction.outputs[containerOutput(deposit)]!;
      output.valueSatoshis -= 1n;
      change(transaction).valueSatoshis += 1n;
    });
    expect(verdicts.get('validator')).toBe(false);
    // Neither frame settles the proxy alone, so neither weighs its containers: the validator does (V7).
    expect(verdicts.get(PROXY)).toBe(true);
    expect(verdicts.get(IMPLEMENTATION)).toBe(true);
  });

  it('refuses a delegate frame claiming a value its caller did not carry, at the validator\'s edge rule', () => {
    const verdicts = forged(deposit, ({ block }) => {
      block.value = 40_000n;
    });
    // The facet walks the call edges (V5), which bind a delegate frame's value to its caller's; the head's value
    // rule counts no delegate frame's value as brought in, so it is not what refuses.
    expect(verdicts.get('validator/1')).toBe(false);
    expect(verdicts.get('validator')).toBe(true);
  });

  it('refuses the proxy\'s containers drained past what the delegate frame pays, at the validator', () => {
    const verdicts = forged(withdrawal, ({ transaction }) => {
      transaction.outputs[sendOutput() - 1]!.valueSatoshis -= 1_000n;
      change(transaction).valueSatoshis += 1_000n;
    });
    expect(verdicts.get('validator')).toBe(false);
    expect(verdicts.get(IMPLEMENTATION)).toBe(true);
  });

  it('refuses a send paid to another lock or another amount than its own pin, at the delegate frame', () => {
    const stranger = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x99));
    expect(forged(withdrawal, ({ transaction }) => {
      transaction.outputs[sendOutput()]!.lockingBytecode = stranger;
    }).get(IMPLEMENTATION)).toBe(false);
    expect(forged(withdrawal, ({ transaction }) => {
      transaction.outputs[sendOutput()]!.valueSatoshis += 1_000n;
      change(transaction).valueSatoshis -= 1_000n;
    }).get(IMPLEMENTATION)).toBe(false);
  });

  it('refuses a send run after a container of another contract than the proxy, at the delegate frame', () => {
    const verdicts = forged(withdrawal, ({ transaction }) => {
      transaction.outputs[sendOutput() - 1]!.lockingBytecode =
        satoshiContainerLockingBytecode(proxied.implementationCategoryId);
    });
    expect(verdicts.get(IMPLEMENTATION)).toBe(false);
  });
});
