import {
  bigIntToVmNumber, binToHex, decodeAuthenticationInstructions, encodeAuthenticationInstructions, encodeDataPush,
  hexToBin,
} from '@bitauth/libauth';
import { compileStringMulti } from '@solidcash/solidc';
import type { AbiFunction, Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { callRecordDigest } from '../../src/stateful/call-record.js';
import { getContractFactory, upgrades } from '../../src/stateful/index.js';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../src/utils.js';
import { createMessageBusSemanticTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { addProvenUtxo, createTestProvider } from '../test-util.js';

/**
 * A void call through a one-method interface binds the method its callee ran by reading the callee's void record,
 * `digest || 01`. A proxied callee runs the call in its implementation: the implementation's delegated entry pins the
 * forwarded call's record in the proxy's category, at the output the caller reads, and holds the transaction to that
 * one record (docs/security/security-audit-2026-10-16.md, "Security completion", proxied callee's void record).
 *
 * A Driver behind the default proxy calls a Target behind another one. The forgeries splice the Target's run of a
 * spend of the same shape (its proxy, its implementation and their outputs) into the honest spend, or mint a record
 * beside the run, and evaluate the inputs that bind it.
 */
const SOURCE = `pragma solidity ^0.8.20;
interface IStamp { function stamp(uint256 v) external; }
interface IPoke { function poke(uint256 v) external; }
contract Target {
  uint256 public total;
  uint256 public other;
  function stamp(uint256 v) public { total = total + v; }
  function poke(uint256 v) public { other = other + v; }
}
contract Driver {
  address target;
  uint256 public calls;
  constructor(address first) { target = first; }
  function run(uint256 v) public { calls = calls + 1; IStamp(target).stamp(v); }
  function runPoke(uint256 v) public { calls = calls + 1; IPoke(target).poke(v); }
}`;

const BUILDS = [
  {
    name: 'direct',
    options: { forceStateful: true, evmCompat: true, messageBus: false, suppressWarnings: true },
    provider: createTestProvider,
  },
  {
    name: 'message-bus',
    options: {
      forceStateful: true, evmCompat: true, messageBus: true, messageBusKernel: true, messageBusGraphContext: true,
      maximumInputBytes: 1_000_000, suppressWarnings: true,
    },
    provider: createMessageBusSemanticTestProvider,
  },
] as const;
type Build = typeof BUILDS[number];

type Tx = ReturnType<TransactionBuilder['buildLibauthTransaction']>;
type Output = Tx['outputs'][number];
type SourceOutput = ReturnType<typeof generateLibauthSourceOutputs>[number];
type Instruction = { opcode: number; data?: Uint8Array };
interface Spend { readonly tx: Tx; readonly sourceOutputs: readonly SourceOutput[] }
interface Deployed {
  readonly provider: ReturnType<Build['provider']>;
  readonly target: any;
  readonly driver: any;
}

const compiled = new Map<string, Record<string, Artifact>>();
const artifactsOf = (build: Build): Record<string, Artifact> => {
  if (!compiled.has(build.name)) {
    compiled.set(build.name, compileStringMulti(SOURCE, build.options) as Record<string, Artifact>);
  }
  return compiled.get(build.name)!;
};

async function deploy(build: Build): Promise<Deployed> {
  const provider = build.provider();
  const signer = new Signer(new Uint8Array(32).fill(0x6e), provider);
  for (let index = 0; index < 24; index += 1) await addProvenUtxo(provider, signer.getAddress());
  const artifacts = artifactsOf(build);
  const target = await upgrades.deployProxy(getContractFactory(artifacts.Target, signer), {
    total: 0n, other: 0n,
  }, { initializer: false });
  const targetLock = addressToLockScript(target.address);
  const driver = await upgrades.deployProxy(getContractFactory(artifacts.Driver, signer), {
    target: targetLock, calls: 0n,
  }, { initializer: false, implementationConstructorArgs: [targetLock] });
  for (const iface of ['IStamp', 'IPoke']) driver.implementation._registerResolvedExternal(iface, target);
  return { provider, target, driver };
}

/** The transaction a call builds, unbroadcast: every coin it spends stays live. */
async function spendOf(call: { build(): Promise<TransactionBuilder> }): Promise<Spend> {
  const builder = await call.build();
  return { tx: builder.buildLibauthTransaction(), sourceOutputs: generateLibauthSourceOutputs(builder.inputs) };
}

const ofCategory = (category: Uint8Array | undefined, id: string): boolean => category !== undefined
  && [id, binToHex(hexToBin(id).reverse())].includes(binToHex(category));
/** A coin or output of the Target: its proxy's category or its implementation's. */
const ofTarget = (d: Deployed, token: Output['token']): boolean => ofCategory(token?.category, d.target.proxy.categoryId)
  || ofCategory(token?.category, d.target.implementation.categoryId);
const masterInput = (s: Spend, id: string): number => s.sourceOutputs.findIndex((output) => (
  ofCategory(output.token?.category, id) && output.token?.nft?.capability === 'minting'));
/** The carriers of the Target proxy's category: no capability, an `OP_TRUE` lock. */
const records = (d: Deployed, s: Spend): number[] => s.tx.outputs.flatMap((output, index) => (
  ofCategory(output.token?.category, d.target.proxy.categoryId) && output.token?.nft?.capability === 'none'
    && binToHex(output.lockingBytecode) === '51' ? [index] : []));
const abiOf = (d: Deployed, name: string): AbiFunction => (d.target.implementation.inner.artifact.abi as AbiFunction[])
  .find((entry) => entry.name === name)!;

/** Whether input `index` of `s` evaluates to success. */
const passes = (d: Deployed, s: Spend, index: number): boolean => {
  const vm = createVirtualMachineBch2026ForProvider(d.provider);
  const state = vm.evaluate({ transaction: s.tx, sourceOutputs: s.sourceOutputs as SourceOutput[], inputIndex: index });
  return vm.stateSuccess(state) === true;
};
/** Whether every covenant input of `s` (each spends a token) evaluates to success. */
const allPass = (d: Deployed, s: Spend): boolean => s.sourceOutputs
  .every((output, index) => output.token === undefined || passes(d, s, index));

/** `callerSide` with the Target's run taken from `calleeSide`: its proxy's and its implementation's inputs and outputs. */
function withCallee(d: Deployed, callerSide: Spend, calleeSide: Spend): Spend {
  const outpoint = (input: Tx['inputs'][number]): string => (
    `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`);
  expect(calleeSide.tx.inputs.length).toBe(callerSide.tx.inputs.length);
  expect(calleeSide.tx.outputs.length).toBe(callerSide.tx.outputs.length);
  const inputs = callerSide.tx.inputs.map((input, index) => {
    const target = ofTarget(d, callerSide.sourceOutputs[index]!.token);
    expect(ofTarget(d, calleeSide.sourceOutputs[index]!.token)).toBe(target);
    if (!target) return input;
    expect(outpoint(calleeSide.tx.inputs[index]!)).toBe(outpoint(input));
    return { ...input, unlockingBytecode: calleeSide.tx.inputs[index]!.unlockingBytecode };
  });
  const outputs = callerSide.tx.outputs.map((output, index) => {
    const target = ofTarget(d, calleeSide.tx.outputs[index]!.token);
    expect(ofTarget(d, output.token)).toBe(target);
    return target ? calleeSide.tx.outputs[index]! : output;
  });
  return { tx: { ...callerSide.tx, inputs, outputs }, sourceOutputs: callerSide.sourceOutputs };
}

/** `s` with ABI input `name` of `fn`, run by input `index`, set to `value`. */
function withArgument(s: Spend, index: number, fn: AbiFunction, name: string, value: bigint): Spend {
  const position = fn.inputs.findIndex((input) => input.name === name);
  expect(position).toBeGreaterThanOrEqual(0);
  const instructions = decodeAuthenticationInstructions(s.tx.inputs[index]!.unlockingBytecode) as Instruction[];
  // The selector, one push per ABI input with input 0 last, then the redeem script.
  expect(instructions).toHaveLength(fn.inputs.length + 2);
  instructions[instructions.length - 2 - position] = decodeAuthenticationInstructions(
    encodeDataPush(bigIntToVmNumber(value)),
  )[0] as Instruction;
  const inputs = s.tx.inputs.map((input, at) => (at === index
    ? { ...input, unlockingBytecode: encodeAuthenticationInstructions(instructions as any) } : input));
  return { tx: { ...s.tx, inputs }, sourceOutputs: s.sourceOutputs };
}

describe.each(BUILDS)('a void call to a proxied callee, $name build', (build) => {
  it('settles: the implementation pins the record of the call its proxy forwarded, named by its caller', async () => {
    const d = await deploy(build);
    const stamp = abiOf(d, 'stamp');
    // The implementation's delegated entry takes the record witness and its reader; its proxy's forward takes neither.
    expect(stamp.inputs.map((input) => input.name)).toEqual(expect.arrayContaining([
      '__internal__callRecordReader', '__internal__returnOutputIdx',
    ]));
    const honest = await spendOf(d.driver.forward('run', [7n]));
    const reader = masterInput(honest, d.driver.implementation.categoryId);
    expect(reader).toBeGreaterThanOrEqual(0);
    const [record, ...others] = records(d, honest);
    expect(record).toBeDefined();
    expect(others).toEqual([]);
    expect(binToHex(honest.tx.outputs[record!]!.token!.nft!.commitment))
      .toBe(`${binToHex(callRecordDigest(stamp, [7n], {}, 0, reader)!)}01`);
    expect(allPass(d, honest)).toBe(true);

    await d.driver.forward('run', [7n]).send();
    expect((await d.target.proxy.getState()).total).toBe(7n);
    expect((await d.target.proxy.getState()).other).toBe(0n);
    expect((await d.driver.proxy.getState()).calls).toBe(1n);
  }, 300_000);

  // The proxy forwards `poke(7)` and its implementation runs it, pinning poke's record: the caller, which reads the
  // record of `stamp(7)`, refuses it. The callee's run is consistent on its own, so the caller's read is what refuses.
  it('refuses the proxy run with another method at the caller', async () => {
    const d = await deploy(build);
    const stamp = await spendOf(d.driver.forward('run', [7n]));
    const poke = await spendOf(d.driver.forward('runPoke', [7n]));
    expect(allPass(d, stamp)).toBe(true);
    expect(allPass(d, poke)).toBe(true);
    const forged = withCallee(d, stamp, poke);
    expect(passes(d, forged, masterInput(forged, d.target.implementation.categoryId))).toBe(true);
    expect(passes(d, forged, masterInput(forged, d.driver.implementation.categoryId))).toBe(false);
  }, 300_000);

  it('refuses the proxy run with other arguments at the caller', async () => {
    const d = await deploy(build);
    const seven = await spendOf(d.driver.forward('run', [7n]));
    const eight = await spendOf(d.driver.forward('run', [8n]));
    expect(allPass(d, eight)).toBe(true);
    const forged = withCallee(d, seven, eight);
    expect(passes(d, forged, masterInput(forged, d.target.implementation.categoryId))).toBe(true);
    expect(passes(d, forged, masterInput(forged, d.driver.implementation.categoryId))).toBe(false);
  }, 300_000);

  // A carrier of the proxy's category is minted beside the run. Each spend below satisfies the caller's read; the
  // implementation, which counts its proxy's carriers to the one record it pinned, refuses it.
  it('refuses a record minted beside the run at the callee\'s implementation', async () => {
    const d = await deploy(build);
    const stamp = await spendOf(d.driver.forward('run', [7n]));
    const [record] = records(d, stamp);
    // A copy of the honest record beside the honest run.
    const copied: Spend = {
      tx: { ...stamp.tx, outputs: [...stamp.tx.outputs, stamp.tx.outputs[record!]!] },
      sourceOutputs: stamp.sourceOutputs,
    };
    expect(passes(d, copied, masterInput(copied, d.driver.implementation.categoryId))).toBe(true);
    expect(passes(d, copied, masterInput(copied, d.target.implementation.categoryId))).toBe(false);

    // The implementation runs poke(7) and pins its record at an appended output; the record of stamp(7) is minted at
    // the output the caller reads.
    const poke = await spendOf(d.driver.forward('runPoke', [7n]));
    const spliced = withCallee(d, stamp, poke);
    const appended = spliced.tx.outputs.length;
    const outputs = spliced.tx.outputs.map((output, index) => (index === record ? stamp.tx.outputs[record]! : output));
    const minted = withArgument(
      { tx: { ...spliced.tx, outputs: [...outputs, poke.tx.outputs[record!]!] }, sourceOutputs: spliced.sourceOutputs },
      masterInput(spliced, d.target.implementation.categoryId), abiOf(d, 'poke'), '__internal__returnOutputIdx',
      BigInt(appended),
    );
    expect(records(d, minted)).toEqual([record, appended]);
    expect(passes(d, minted, masterInput(minted, d.driver.implementation.categoryId))).toBe(true);
    expect(passes(d, minted, masterInput(minted, d.target.implementation.categoryId))).toBe(false);
  }, 300_000);
});
