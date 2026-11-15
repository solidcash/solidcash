import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeAuthenticationInstructions, encodeAuthenticationInstructions, encodeDataPush, encodeTransaction,
  flattenBinArray, hexToBin,
} from '@bitauth/libauth';
import { createTxVerifier } from '@mem-cash/validation';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';

/**
 * A received function pointer's caller pins the pushes of the callee it co-spends: the pointer's declared
 * arguments, the redeem, and ahead of the arguments the callee's hidden witnesses. A record-sound callee, which
 * `genesisCalls` (on by default, A7) makes of every qualifying contract, takes two: its record witness and then its
 * genesis call. The pin used to know only the first, so every call through a received pointer into such a callee
 * was refused at the caller. The genesis call of a call that is not a constructor's is empty, so the caller now
 * admits a second hidden push only when it is OP_0; a void pointer's record witness must still name none.
 *
 * Every honest call settles under the BCH 2026 standard VM. Each refusal edits the honest call's callee unlocking,
 * one push replaced or added, and the caller, input 0, must refuse it.
 */

const HANDLER = `pragma solidcash >=0.8.0;
contract Handler() { bigint counter;
  function inc(uint256 v) { this.counter = this.counter + int(v); require(int(v) >= 0); }
  function dec(uint256 v) { this.counter = this.counter - int(v); require(int(v) >= 0); } }`;

const TABLE = `pragma solidcash >=0.8.0;
contract Table() {
  function(uint256) external[] fns;
  bigint bumps;
  function reg(function(uint256) external p) { this.fns.push(p); this.bumps = this.bumps + 1; }
  function fireN(uint256 n, uint256 v) {
    for (uint256 i = 0; i < n; i = i + 1) { fns[i](v); }
    this.bumps = this.bumps + 1;
  }
}`;

const PARAM = `pragma solidcash >=0.8.0;
contract Param() {
  bigint bumps;
  function fireWith(function(uint256) external cb, uint256 v) { cb(v); this.bumps = this.bumps + 1; }
}`;

const HANDLER_R = `pragma solidcash >=0.8.0;
interface IH { public bigint counter;
  function inc(pubkey o, sig s) returns (bigint); function dec(pubkey o, sig s) returns (bigint); }
contract Handler() is IH { bigint counter;
  function inc(pubkey o, sig s) returns (bigint) { require(checkSig(s, o)); this.counter = this.counter + 1; return this.counter; }
  function dec(pubkey o, sig s) returns (bigint) { require(checkSig(s, o)); this.counter = this.counter - 1; return this.counter; } }`;

const STORE_R = `pragma solidcash >=0.8.0;
interface IH { public bigint counter;
  function inc(pubkey o, sig s) returns (bigint); function dec(pubkey o, sig s) returns (bigint); }
contract Store() {
  function(pubkey, sig) external returns (bigint) stored;
  bigint lastResult;
  function save(function(pubkey, sig) external returns (bigint) y, pubkey pk, sig s) {
    require(checkSig(s, pk)); this.stored = y; this.lastResult = 0;
  }
  function run(pubkey pk, sig s) { require(checkSig(s, pk)); this.lastResult = stored(pk, s); }
}`;

type Provider = ReturnType<typeof createTestProvider>;
type Verdict = { success: boolean; error?: string };
const verifier = createTxVerifier({ vmVersion: 'BCH_2026_05', standard: true, skipFeePolicy: true });
const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const GENESIS_OFF = { genesisCalls: false };

/** A 36-byte genesis call: a tag (a category and a call slot) and the index of the input that creates it. */
const TAG = Uint8Array.from({ length: 36 }, (_, i) => (i < 32 ? 0xa5 : i === 32 ? 0 : i === 34 ? 1 : 0));

const selectorOf = (artifact: any, name: string): Uint8Array =>
  hexToBin(artifact.abi.find((entry: any) => entry.name === name)!.selector!);

async function deploy(provider: Provider, artifact: any, init: Record<string, unknown>): Promise<{ sc: any; lock: string }> {
  const base = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(provider, base, artifact.stateLayout!, init, { saltContract: true });
  return {
    sc: StatefulContract.withCategory(base, categoryId) as any,
    lock: base.withCategory(hexToBin(categoryId)).lockingBytecode,
  };
}

/** The input whose unlocking's first push is the 4-byte selector `s`. */
function selectorInput(builder: any, s: Uint8Array): number {
  const tx = builder.buildLibauthTransaction();
  for (let i = 0; i < tx.inputs.length; i++) {
    const first = decodeAuthenticationInstructions(tx.inputs[i].unlockingBytecode)[0] as { data?: Uint8Array };
    if (first?.data && first.data.length === 4 && binToHex(first.data) === binToHex(s)) return i;
  }
  throw new Error('selector input not found');
}

/** The pushes of the callee's unlocking, as opcodes (a data push reads as its hex). */
function pushes(builder: any, input: number): string[] {
  return decodeAuthenticationInstructions(builder.buildLibauthTransaction().inputs[input].unlockingBytecode)
    .map((instruction) => ('data' in instruction && instruction.data.length > 0
      ? binToHex(instruction.data) : `op${instruction.opcode}`));
}

/** Spend the callee's input with its pushes as `edit` returns them, each given encoded. */
function rewrite(builder: any, input: number, edit: (pushes: Uint8Array[]) => Uint8Array[]): any {
  const honest = decodeAuthenticationInstructions(builder.buildLibauthTransaction().inputs[input].unlockingBytecode)
    .map((instruction) => encodeAuthenticationInstructions([instruction]));
  const unlocking = flattenBinArray(edit(honest));
  const original = builder.inputs[input].unlocker;
  builder.inputs[input].unlocker = {
    generateLockingBytecode: (): Uint8Array => original.generateLockingBytecode(),
    generateUnlockingBytecode: (): Uint8Array => unlocking,
  };
  return builder;
}

/** Replace push `at` of the callee's unlocking with a push of `data`. */
const replacePush = (builder: any, input: number, at: number, data: Uint8Array): any =>
  rewrite(builder, input, (all) => all.map((push, i) => (i === at ? encodeDataPush(data) : push)));

/** Add a push of `data` to the callee's unlocking ahead of push `at`. */
const insertPush = (builder: any, input: number, at: number, data: Uint8Array): any =>
  rewrite(builder, input, (all) => [...all.slice(0, at), encodeDataPush(data), ...all.slice(at)]);

/** Run the BCH 2026 standard VM over the built transaction, past its anti-malleability locktime. */
function runVm(builder: any): Verdict {
  const tx = builder.buildLibauthTransaction();
  const hex = binToHex(encodeTransaction(tx));
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const lt = Number(tx.locktime);
  const chain = lt < 500000000
    ? { height: lt + 1, medianTimePast: 1700000000 } : { height: 133700, medianTimePast: lt + 1 };
  const result = verifier.verify(hex, sourceOutputs, chain);
  return { success: result.success, error: result.success ? undefined : (result.debugMessage ?? result.error) };
}

const OP_0 = 'op0';
const OP_1NEGATE = 'op79';

describe('a table of received pointers into a record-sound callee (VM)', () => {
  /** fireN(1, 3) through a table holding one pointer to the callee's `inc`; the callee's input is returned too. */
  async function build(options: Record<string, unknown> = {}): Promise<{ call: any; callee: number }> {
    const provider = createTestProvider();
    const handler = compileString(HANDLER, options);
    const table = compileString(TABLE);
    const h = await deploy(provider, handler, { counter: 5n });
    const t = await deploy(provider, table, { fns: [], __fnsel_fns: [], bumps: 0n });
    await t.sc.reg(hexToBin(h.lock), selectorOf(handler, 'inc')).send();
    const pointer = table.abi.find((entry: any) => entry.name === 'fireN')!.externalCalls![0]!.interfaceName;
    t.sc.registerExternalArray(pointer, [h.sc], ['inc']);
    const call = await t.sc.fireN(1n, 3n).build();
    return { call, callee: selectorInput(call, selectorOf(handler, 'inc')) };
  }

  it('settles the honest call: the record witness names none and the genesis call is empty', async () => {
    const { call, callee } = await build();
    // The selector, the record witness, the genesis call, the argument and the redeem.
    expect(pushes(call, callee).slice(1, 3)).toEqual([OP_1NEGATE, OP_0]);
    expect(pushes(call, callee)).toHaveLength(5);
    const r = runVm(call);
    expect(r.error ?? 'ok').toBe('ok');
    expect(r.success).toBe(true);
  }, 300_000);

  it('settles it as well into a callee compiled without genesis calls', async () => {
    const { call, callee } = await build(GENESIS_OFF);
    expect(pushes(call, callee)).toHaveLength(4);
    expect(runVm(call).success).toBe(true);
  }, 300_000);

  it('refuses a genesis call that is not empty at the caller', async () => {
    const { call, callee } = await build();
    const r = runVm(replacePush(call, callee, 2, TAG));
    expect(r.success).toBe(false);
    expect(r.error ?? '').toMatch(/input index 0/);
  }, 300_000);

  it('refuses a genesis call of one byte at the caller', async () => {
    const { call, callee } = await build();
    const r = runVm(replacePush(call, callee, 2, Uint8Array.of(0x80)));
    expect(r.success).toBe(false);
    expect(r.error ?? '').toMatch(/input index 0/);
  }, 300_000);

  it('refuses a record witness that names an output beside an empty genesis call at the caller', async () => {
    const { call, callee } = await build();
    const r = runVm(replacePush(call, callee, 1, Uint8Array.of(2)));
    expect(r.success).toBe(false);
    expect(r.error ?? '').toMatch(/input index 0/);
  }, 300_000);

  it('refuses a third push ahead of the argument at the caller, empty as it is', async () => {
    const { call, callee } = await build();
    const r = runVm(insertPush(call, callee, 3, new Uint8Array()));
    expect(r.success).toBe(false);
    expect(r.error ?? '').toMatch(/input index 0/);
  }, 300_000);
});

describe('a received pointer parameter into a record-sound callee (VM)', () => {
  async function build(): Promise<{ call: any; callee: number }> {
    const provider = createTestProvider();
    const handler = compileString(HANDLER);
    const h = await deploy(provider, handler, { counter: 5n });
    const p = await deploy(provider, compileString(PARAM), { bumps: 0n });
    const call = await p.sc.fireWith(hexToBin(h.lock), selectorOf(handler, 'inc'), 3n)
      .withExternalCall(h.sc, 'inc', [3n]).build();
    return { call, callee: selectorInput(call, selectorOf(handler, 'inc')) };
  }

  it('settles the honest call', async () => {
    const { call, callee } = await build();
    expect(pushes(call, callee).slice(1, 3)).toEqual([OP_1NEGATE, OP_0]);
    const r = runVm(call);
    expect(r.error ?? 'ok').toBe('ok');
    expect(r.success).toBe(true);
  }, 300_000);

  it('refuses a genesis call that is not empty at the caller', async () => {
    const { call, callee } = await build();
    const r = runVm(replacePush(call, callee, 2, TAG));
    expect(r.success).toBe(false);
    expect(r.error ?? '').toMatch(/input index 0/);
  }, 300_000);
});

describe('a stored returning pointer into a record-sound callee (VM)', () => {
  async function build(options: Record<string, unknown> = {}): Promise<{ call: any; callee: number }> {
    const provider = createTestProvider();
    const handler = compileString(HANDLER_R, options);
    const h = await deploy(provider, handler, { counter: 5n });
    const s = await deploy(provider, compileString(STORE_R), {
      stored: hexToBin(h.lock), __fnsel_stored: selectorOf(handler, 'inc'), lastResult: 0n,
    });
    const call = await s.sc.run(alicePub, sig()).withExternalCall(h.sc, 'inc', [alicePub, sig()]).build();
    return { call, callee: selectorInput(call, selectorOf(handler, 'inc')) };
  }

  it('settles the honest call: the record witness names its record and the genesis call is empty', async () => {
    const { call, callee } = await build();
    const calleePushes = pushes(call, callee);
    expect(calleePushes[1]).not.toBe(OP_1NEGATE);
    expect(calleePushes[2]).toBe(OP_0);
    const r = runVm(call);
    expect(r.error ?? 'ok').toBe('ok');
    expect(r.success).toBe(true);
  }, 300_000);

  it('settles it as well from a callee compiled without genesis calls', async () => {
    const { call, callee } = await build(GENESIS_OFF);
    // The selector, the record witness, the two arguments and the redeem.
    expect(pushes(call, callee)).toHaveLength(5);
    expect(runVm(call).success).toBe(true);
  }, 300_000);

  it('refuses a genesis call that is not empty at the caller', async () => {
    const { call, callee } = await build();
    const r = runVm(replacePush(call, callee, 2, TAG));
    expect(r.success).toBe(false);
    expect(r.error ?? '').toMatch(/input index 0/);
  }, 300_000);

  it('refuses a push between the genesis call and the arguments at the caller, empty as it is', async () => {
    const { call, callee } = await build();
    const r = runVm(insertPush(call, callee, 3, new Uint8Array()));
    expect(r.success).toBe(false);
    expect(r.error ?? '').toMatch(/input index 0/);
  }, 300_000);
});
