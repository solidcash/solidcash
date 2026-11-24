/**
 * A run that settles no record of its own must leave no carrier of its category. A void-only, event-less vault has a
 * permissionless entry that reads another contract's storage and so settles no record (`sync`). A spender runs it
 * beside a caller whose single-function interface names the vault's other void method (`deposit(3)`), and places a
 * carrier with the digest that caller reads: minted in the run, or moved from an earlier honest call. The caller
 * would credit a deposit the vault never ran; the vault's run must refuse the carrier.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, bigIntToVmNumber, decodeAuthenticationInstructions, decodeTransactionUnsafe,
  encodeAuthenticationInstructions, encodeDataPush, encodeTransaction, hexToBin, vmNumberToBigInt,
} from '@bitauth/libauth';
import { createTxVerifier } from '@mem-cash/validation';
import { compileStringMulti } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract, getDataNftLockingBytecode } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';

const SOURCE = `pragma solidcash >=0.8.0;
interface ICounter {
  public bigint counter;
  function increment(pubkey owner, sig s);
}
interface IDeposit { function deposit(int v); }
contract Counter() is ICounter {
  bigint counter;
  function increment(pubkey owner, sig s) {
    require(checkSig(s, owner));
    this.counter = this.counter + 1;
  }
}
contract Vault(bytes counterAddr) {
  int balance;
  bigint seen;
  function deposit(int v) { require(v > 0); this.balance = this.balance + v; }
  function sync() { this.seen = ICounter(counterAddr).counter; }
}
contract Caller() {
  int calls;
  function oneA(address a) { IDeposit(a).deposit(3); this.calls = this.calls + 1; }
}`;

interface Spend { tx: any; sourceOutputs: any[] }
interface Setup {
  provider: any; arts: any; vault: any; caller: any; vaultAddr: Uint8Array; vaultCat: string; callerCat: string;
}

const verifier = createTxVerifier({ vmVersion: 'BCH_2026_05', standard: true, skipFeePolicy: true });
let compiled: any;
const artifacts = (): any => {
  compiled ??= compileStringMulti(SOURCE);
  return compiled;
};

const ofCategory = (output: any, category: string): boolean => output?.token !== undefined
  && [category, binToHex(hexToBin(category).reverse())].includes(binToHex(output.token.category));
const master = (run: Spend, category: string): number => run.sourceOutputs.findIndex((output: any) => (
  ofCategory(output, category) && output.token.nft?.capability === 'minting'));
/** A record carrier of `category`: an immutable NFT under the `OP_TRUE` lock. */
const carrierOf = (category: string): ((output: any) => boolean) => (output: any): boolean => ofCategory(output, category)
  && output.token.nft !== undefined && output.token.nft.capability === 'none'
  && binToHex(output.lockingBytecode) === '51';

/** A genesis's data-NFT lock: its covenant binds the master at the contract's category-pinned lock. */
const pinnedDataNftLock = (contract: Contract, categoryId: string): Uint8Array => getDataNftLockingBytecode(
  categoryId, hexToBin(contract.withCategory(hexToBin(categoryId)).lockingBytecode),
);

async function setup(): Promise<Setup> {
  const provider = createTestProvider();
  const arts = artifacts();
  const counter = new Contract(arts.Counter, [], { provider });
  const { categoryId: counterCat } = await setupStatefulUtxos(
    provider, counter, arts.Counter.stateLayout!, { counter: 21n }, { saltContract: true },
  );
  const vaultBase = new Contract(arts.Vault, [pinnedDataNftLock(counter, counterCat)], { provider });
  const { categoryId: vaultCat } = await setupStatefulUtxos(
    provider, vaultBase, arts.Vault.stateLayout!, { balance: 100n, seen: 0n }, { saltContract: true },
  );
  const callerBase = new Contract(arts.Caller, [], { provider });
  const { categoryId: callerCat } = await setupStatefulUtxos(
    provider, callerBase, arts.Caller.stateLayout!, { calls: 0n }, { saltContract: true },
  );
  return {
    provider,
    arts,
    vault: StatefulContract.withCategory(vaultBase, vaultCat, {
      externals: { ICounter: StatefulContract.withCategory(counter, counterCat) },
    }),
    caller: StatefulContract.withCategory(callerBase, callerCat),
    vaultAddr: hexToBin(vaultBase.withCategory(hexToBin(vaultCat)).lockingBytecode),
    vaultCat,
    callerCat,
  };
}

/** The honest spend of the caller's deposit(3), the vault co-spent running it and settling its record. */
async function deposit(s: Setup): Promise<Spend> {
  const call = await s.caller.oneA(s.vaultAddr).withExternalCall(s.vault, 'deposit', [3n]).build();
  return { tx: call.buildLibauthTransaction(), sourceOutputs: generateLibauthSourceOutputs(call.inputs) };
}

/**
 * The vault's own `sync()` spend, standing alone. A caller that reads a record from it is refused by the SDK before
 * building (the entry names no reader), so the spender's transaction is put together below.
 */
async function syncAlone(s: Setup): Promise<Spend> {
  const call = await s.vault.sync().build();
  return { tx: call.buildLibauthTransaction(), sourceOutputs: generateLibauthSourceOutputs(call.inputs) };
}

const valueOf = (instruction: any): bigint => {
  if (instruction.opcode >= 0x51 && instruction.opcode <= 0x60) return BigInt(instruction.opcode - 0x50);
  if (instruction.opcode === 0x4f) return -1n;
  const value = vmNumberToBigInt(instruction.data ?? Uint8Array.of());
  if (typeof value === 'string') throw new Error(value);
  return value;
};

/**
 * `run` with the caller's record index witness moved from `from` to `to`. The unlocking pushes the selector where the
 * contract has several entries, then the ABI inputs last first, then the redeem script.
 */
function withRecordIndex(run: Spend, s: Setup, from: number, to: number): Spend {
  const at = master(run, s.callerCat);
  const inputs = s.arts.Caller.abi.find((fn: any) => fn.name === 'oneA').inputs.map((input: any) => input.name);
  const instructions = decodeAuthenticationInstructions(run.tx.inputs[at].unlockingBytecode) as any[];
  const selector = instructions.length - 1 - inputs.length;
  expect([0, 1]).toContain(selector);
  const push = selector + inputs.length - 1 - inputs.indexOf('__internal__externalReturnOutputIdx');
  expect(valueOf(instructions[push])).toBe(BigInt(from));
  instructions[push] = decodeAuthenticationInstructions(encodeDataPush(bigIntToVmNumber(BigInt(to))))[0];
  const unlockingBytecode = encodeAuthenticationInstructions(instructions);
  return {
    tx: { ...run.tx, inputs: run.tx.inputs.map((input: any, index: number) => (index === at
      ? { ...input, unlockingBytecode } : input)) },
    sourceOutputs: run.sourceOutputs,
  };
}

/** Run the mem-cash VM over a spend under a chain state past its locktime. */
function runVm({ tx, sourceOutputs }: Spend): { success: boolean; error?: string } {
  // A plain anyone-can-spend funder covers any dust build() leaves unfunded, so the VM reaches the covenants.
  const funded = {
    ...tx,
    inputs: [...tx.inputs, {
      outpointTransactionHash: hexToBin('11'.repeat(32)), outpointIndex: 0,
      sequenceNumber: 0xffffffff, unlockingBytecode: Uint8Array.of(),
    }],
  };
  const outputs = [...sourceOutputs, { lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 1_000_000n }];
  const lt = Number(tx.locktime);
  const chain = lt < 500000000
    ? { height: lt + 1, medianTimePast: 1700000000 } : { height: 133700, medianTimePast: lt + 1 };
  const result = verifier.verify(binToHex(encodeTransaction(funded)), outputs, chain);
  return result.success ? { success: true }
    : { success: false, error: [result.error, result.debugMessage].filter(Boolean).join(': ') };
}

/** The VM refuses the spend by a script failure at input `index`. */
function expectRefusedAt(result: { success: boolean; error?: string }, index: number): void {
  expect(result.success).toBe(false);
  expect(result.error ?? '').toContain('mandatory-script-verify-flag-failed');
  expect(result.error ?? '').toContain(`error in evaluating input index ${index}:`);
}

/**
 * `a`, the caller's deposit(3), with the vault running `sync` instead. The vault's block becomes b's: its master with
 * b's unlocking (sync takes no argument and addresses its block from its own input), the data NFT sync writes (another
 * coin than the one deposit writes) with a's data NFT unlocking, which names the master's input there, and the read
 * target's co-spent data NFT; its outputs are b's, and a's carrier leaves it. The caller's record index names `at`,
 * past every output, where a carrier would go.
 */
function besideSync(a: Spend, b: Spend, s: Setup): { spend: Spend; carrier: number; at: number } {
  const base = master(a, s.vaultCat);
  const own = master(b, s.vaultCat);
  const carrier = a.tx.outputs.findIndex(carrierOf(s.vaultCat));
  // a's vault block: master, the data NFT deposit writes, then the carrier; b's: master, the data NFT sync writes,
  // the read target's data NFT.
  expect(carrier).toBe(base + 2);
  const outpoint = (input: any): string => `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`;
  expect(outpoint(b.tx.inputs[own])).toBe(outpoint(a.tx.inputs[base]));
  expect(ofCategory(b.sourceOutputs[own + 1], s.vaultCat)).toBe(true);
  expect(b.sourceOutputs[own + 1].token.nft?.capability).toBe('mutable');
  expect(ofCategory(b.sourceOutputs[own + 2], s.vaultCat)).toBe(false);
  const inputs = [
    ...a.tx.inputs.slice(0, base),
    { ...a.tx.inputs[base], unlockingBytecode: b.tx.inputs[own].unlockingBytecode },
    { ...b.tx.inputs[own + 1], unlockingBytecode: a.tx.inputs[base + 1].unlockingBytecode },
    b.tx.inputs[own + 2],
    ...a.tx.inputs.slice(base + 2),
  ];
  const sourceOutputs = [
    ...a.sourceOutputs.slice(0, base + 1), b.sourceOutputs[own + 1], b.sourceOutputs[own + 2],
    ...a.sourceOutputs.slice(base + 2),
  ];
  const outputs = [
    ...a.tx.outputs.slice(0, base),
    ...b.tx.outputs.slice(own, own + 3),
    ...a.tx.outputs.slice(base + 3),
  ];
  const at = outputs.length;
  const spliced = { tx: { ...a.tx, inputs, outputs }, sourceOutputs };
  return { spend: withRecordIndex(spliced, s, carrier, at), carrier, at };
}

describe('a carrier beside a run that settles no record (VM)', () => {
  it('refuses a carrier minted in the run of a void-only vault\'s storage reader, at the vault', async () => {
    const s = await setup();
    expect(s.arts.Vault.abi.find((fn: any) => fn.name === 'sync').externalReads?.length).toBe(1);
    expect(s.arts.Vault.abi.every((fn: any) => (fn.outputs?.length ?? 0) === 0)).toBe(true);
    const a = await deposit(s);
    const b = await syncAlone(s);
    expect(runVm(a)).toEqual({ success: true });
    expect(runVm(b)).toEqual({ success: true });
    const { spend: forged, carrier } = besideSync(a, b, s);
    // Without a carrier the caller reads none and is refused: the carrier is what it credits.
    expectRefusedAt(runVm(forged), master(a, s.callerCat));
    const minted = { tx: { ...forged.tx, outputs: [...forged.tx.outputs, a.tx.outputs[carrier]] },
      sourceOutputs: forged.sourceOutputs };
    expectRefusedAt(runVm(minted), master(a, s.vaultCat));
  }, 300_000);

  it('refuses an earlier honest carrier moved beside that run, at the vault', async () => {
    const s = await setup();
    // An honest deposit leaves its carrier on the ledger under the OP_TRUE lock.
    const sent = await s.caller.oneA(s.vaultAddr).withExternalCall(s.vault, 'deposit', [3n]).send();
    const earlier = decodeTransactionUnsafe(hexToBin(await s.provider.getRawTransaction(sent.txid))) as any;
    const old = earlier.outputs.findIndex(carrierOf(s.vaultCat));
    expect(old).toBeGreaterThanOrEqual(0);
    const a = await deposit(s);
    const b = await syncAlone(s);
    const { spend: forged, carrier } = besideSync(a, b, s);
    // The caller's next deposit(3) reads the digest the earlier carrier holds.
    expect(binToHex(earlier.outputs[old].token.nft.commitment))
      .toBe(binToHex(a.tx.outputs[carrier].token.nft.commitment));
    const moved = {
      tx: {
        ...forged.tx,
        inputs: [...forged.tx.inputs, {
          outpointTransactionHash: hexToBin(sent.txid), outpointIndex: old,
          sequenceNumber: 0xffffffff, unlockingBytecode: Uint8Array.of(),
        }],
        outputs: [...forged.tx.outputs, earlier.outputs[old]],
      },
      sourceOutputs: [...forged.sourceOutputs, earlier.outputs[old]],
    };
    expectRefusedAt(runVm(moved), master(a, s.vaultCat));
  }, 300_000);
});
