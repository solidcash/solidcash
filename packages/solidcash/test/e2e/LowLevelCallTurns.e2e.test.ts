import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, decodeAuthenticationInstructions, decodeTransactionUnsafe,
  encodeAuthenticationInstructions, encodeDataPush, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import {
  encodePushdataValue, lowLevelCallTurnInputsInput, lowLevelCallTurnRecordBaseInput, type AbiFunction, type Artifact,
} from '@solidcash/utils';
import { compileString, compileStringMulti } from '../direct-compile.js';
import { Contract, LowLevelCallTurnsError, TransactionBuilder } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { callRecordDigest } from '../../src/stateful/call-record.js';
import { lowLevelCallTurnInputsWitness, refuseSecondPayingTurn } from '../../src/stateful/low-level-call-turns.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos, verifyTransaction } from '../test-util.js';

/**
 * A low-level call a loop may make more than once binds each turn to a callee run of its own (perTurn). The turn's
 * callee input is the next element of the caller's list witness, above the one the last turn took, so one run cannot
 * answer two turns. A caller that keeps state also reads the record the turn's run settles at the record base plus
 * the turn: a carrier of that callee's category, whose digest names the payload's method and arguments and the
 * caller's input as reader. `.withCall()` lists one callee per turn.
 *
 * Each forgery starts from an honest transaction and changes one thing; the refusal must be the caller's input.
 */

const TAG = 7n;

const SOURCE = `pragma solidcash ^0.52.0;
  interface IT { function ping(int tag) external; }
  contract T { int pings;
    function ping(int tag) external { require(tag > 0); pings = pings + 1; } }
  contract R { int runs;
    function pingAll(address[] ts, int tag) external {
      for (uint i = 0; i < ts.length; i++) {
        (bool ok, bytes data) = ts[i].call{value: 0}(abi.encodeWithSelector(IT.ping.selector, tag));
        require(ok);
      }
      runs = runs + 1;
    }
  }`;

// A caller that keeps no state binds each turn's run by its list alone: its calls may reach coins that are no
// SolidCash contract, here bare `OP_DROP <n>` locks, two coins of one lock being two runs of one callee.
const STATELESS_SOURCE = `pragma solidcash ^0.52.0;
  contract S {
    function relayAll(address[] ts, bytes[] payloads) external {
      for (uint i = 0; i < ts.length; i++) {
        (bool ok, bytes data) = ts[i].call{value: 0}(payloads[i]);
        require(ok);
      }
      require(ts.length > 0);
    }
  }`;

const OPTIONS = { evmCompat: true } as const;

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;
type Instruction = { opcode: number; data?: Uint8Array };
interface Coin {
  readonly satoshis: bigint;
  readonly token?: { readonly category: string; readonly nft?: { readonly capability: string } };
}
interface Deployed { readonly sc: StatefulContract<any>; readonly category: string; readonly lock: Uint8Array }

let compiled: Record<string, Artifact> | undefined;
const artifacts = (): Record<string, Artifact> => {
  compiled ??= compileStringMulti(SOURCE, OPTIONS) as Record<string, Artifact>;
  return compiled;
};
const abiOf = (artifact: Artifact, name: string): AbiFunction => artifact.abi.find((entry) => entry.name === name)!;

async function deploy(provider: Provider, artifact: Artifact, state: Record<string, bigint>): Promise<Deployed> {
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, state, { saltContract: true },
  );
  return {
    sc: StatefulContract.withCategory(contract, categoryId),
    category: categoryId,
    lock: hexToBin(contract.withCategory(hexToBin(categoryId)).lockingBytecode),
  };
}

/** The transaction `run` builds and checks, unbroadcast: every coin it spends stays live. */
async function capture(provider: Provider, run: () => Promise<unknown>): Promise<Tx> {
  let captured = '';
  const send = provider.sendRawTransaction.bind(provider);
  (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
    captured = hex;
    throw new Error('capture-only');
  };
  try {
    await expect(run()).rejects.toThrow('capture-only');
  } finally {
    (provider as any).sendRawTransaction = send;
  }
  return decodeTransactionUnsafe(hexToBin(captured));
}

const outcomeOf = (provider: Provider, tx: Tx): Promise<string> => provider
  .sendRawTransaction(binToHex(encodeTransaction(tx))).then(() => 'ACCEPTED').catch((e: Error) => e.message);

const coinsOf = (provider: Provider, tx: Tx): Promise<Coin[]> => Promise.all(tx.inputs.map(async (input) => {
  const coin = await (provider as any).getLedgerOutput(binToHex(input.outpointTransactionHash), input.outpointIndex);
  expect(coin).toBeDefined();
  return coin as Coin;
}));

const reversedHex = (hex: string): string => binToHex(hexToBin(hex).reverse());
const ofCategory = (category: Uint8Array | string | undefined, hex: string): boolean => category !== undefined
  && [hex, reversedHex(hex)].includes(typeof category === 'string' ? category : binToHex(category));
const masterOf = (coins: readonly Coin[], category: string): number => coins
  .findIndex((coin) => ofCategory(coin.token?.category, category) && coin.token?.nft?.capability === 'minting');
const recordOf = (tx: Tx, category: string): number => tx.outputs.findIndex((output) => (
  binToHex(output.lockingBytecode) === '51' && ofCategory(output.token?.category, category)));

const pushOf = (data: Uint8Array): Instruction => decodeAuthenticationInstructions(encodeDataPush(data))[0] as Instruction;

/** An unlocking (an optional selector, one push per ABI input with input 0 last, the redeem) with pushes replaced. */
function withPushes(unlocking: Uint8Array, fn: AbiFunction, pushes: Record<string, Uint8Array>): Uint8Array {
  const instructions = decodeAuthenticationInstructions(unlocking) as Instruction[];
  for (const [name, data] of Object.entries(pushes)) {
    const position = fn.inputs.findIndex((input) => input.name === name);
    expect(position, name).toBeGreaterThanOrEqual(0);
    instructions[instructions.length - 2 - position] = pushOf(data);
  }
  return encodeAuthenticationInstructions(instructions as never);
}

/** The push of ABI input `name` in an unlocking, as `withPushes` addresses it. */
function pushAt(unlocking: Uint8Array, fn: AbiFunction, name: string): Uint8Array {
  const instructions = decodeAuthenticationInstructions(unlocking) as Instruction[];
  const position = fn.inputs.findIndex((input) => input.name === name);
  return instructions[instructions.length - 2 - position]!.data ?? new Uint8Array();
}

/** `data` with its one occurrence of `from` replaced by `to`, a value of the same width. */
function replaced(data: Uint8Array, from: Uint8Array, to: Uint8Array): Uint8Array {
  const hex = binToHex(data);
  const at = hex.indexOf(binToHex(from));
  expect(at).toBeGreaterThanOrEqual(0);
  return hexToBin(hex.slice(0, at) + binToHex(to) + hex.slice(at + from.length * 2));
}

/** The record of `ping(tag)` read at input `reader`. */
const recordFor = (tag: bigint, reader: number): Uint8Array => Uint8Array.of(
  ...callRecordDigest(abiOf(artifacts().T, 'ping'), [tag], {}, 0, reader)!, 0x01,
);

async function setup(): Promise<{
  provider: Provider; r: Deployed; t1: Deployed; t2: Deployed; honest: () => Promise<unknown>;
}> {
  const provider = createTestProvider();
  const t1 = await deploy(provider, artifacts().T, { pings: 0n });
  const t2 = await deploy(provider, artifacts().T, { pings: 0n });
  const r = await deploy(provider, artifacts().R, { runs: 0n });
  const honest = (): Promise<unknown> => (r.sc as any).pingAll([t1.lock, t2.lock], TAG)
    .withCall(t1.sc, 'ping', [TAG]).withCall(t2.sc, 'ping', [TAG]).send();
  return { provider, r, t1, t2, honest };
}

describe('a low-level call loop whose turns each bind a callee run of their own', () => {
  it('publishes the per-turn witnesses in place of a single call input', () => {
    const fn = abiOf(artifacts().R, 'pingAll');
    expect(fn.lowLevelCalls?.[0]).toMatchObject({ callMode: 'call', occurrence: 'loop', perTurn: true });
    const names = fn.inputs.map((input) => input.name);
    expect(names).toContain(lowLevelCallTurnInputsInput(0));
    expect(names).toContain(lowLevelCallTurnRecordBaseInput(0));
    expect(names.some((name) => name.startsWith('__internal__callInputIndex'))).toBe(false);
  });

  it('settles a two-turn loop reaching two callees, each turn reading its own run\'s record', async () => {
    const { provider, r, t1, t2, honest } = await setup();
    const tx = await capture(provider, honest);
    const coins = await coinsOf(provider, tx);
    const reader = masterOf(coins, r.category);
    const first = recordOf(tx, t1.category);
    // The records follow the continuations of the six contract inputs, with no pad before or between them.
    expect(first).toBe(coins.filter((coin) => coin.token?.category !== undefined).length);
    expect(recordOf(tx, t2.category)).toBe(first + 1);
    expect(binToHex(tx.outputs[first]!.token!.nft!.commitment)).toBe(binToHex(recordFor(TAG, reader)));
    expect(tx.outputs.filter((output) => binToHex(output.lockingBytecode) === '51' && output.token === undefined))
      .toHaveLength(0);

    await honest();
    expect((await r.sc.getState()).runs).toBe(1n);
    expect((await t1.sc.getState()).pings).toBe(1n);
    expect((await t2.sc.getState()).pings).toBe(1n);
  }, 300_000);

  it('refuses one callee run answering two turns', async () => {
    const { provider, r, t1, t2, honest } = await setup();
    const tx = await capture(provider, honest);
    const coins = await coinsOf(provider, tx);
    const caller = masterOf(coins, r.category);
    const callee = masterOf(coins, t1.category);
    const pingAll = abiOf(artifacts().R, 'pingAll');
    const unlocking = tx.inputs[caller]!.unlockingBytecode;
    // Both turns name T1 and its one run; T2's run stays in the transaction, answering no turn.
    tx.inputs[caller]!.unlockingBytecode = withPushes(unlocking, pingAll, {
      ts: replaced(pushAt(unlocking, pingAll, 'ts'), t2.lock, t1.lock),
      [lowLevelCallTurnInputsInput(0)]: lowLevelCallTurnInputsWitness([callee, callee]),
    });
    const outcome = await outcomeOf(provider, tx);
    expect(outcome).not.toBe('ACCEPTED');
    expect(outcome).toContain(`error in evaluating input index ${caller}:`);
    expect((await r.sc.getState()).runs).toBe(0n);
  }, 300_000);

  it('refuses a turn whose record names another payload', async () => {
    const { provider, r, t2, honest } = await setup();
    const tx = await capture(provider, honest);
    const coins = await coinsOf(provider, tx);
    const caller = masterOf(coins, r.category);
    const callee = masterOf(coins, t2.category);
    // T2 runs ping(8) and settles its record, a run its own covenant accepts; R's second turn sent ping(7).
    tx.inputs[callee]!.unlockingBytecode = withPushes(tx.inputs[callee]!.unlockingBytecode, abiOf(artifacts().T, 'ping'), {
      tag: bigIntToVmNumber(TAG + 1n),
    });
    tx.outputs[recordOf(tx, t2.category)]!.token!.nft!.commitment = recordFor(TAG + 1n, caller);
    const outcome = await outcomeOf(provider, tx);
    expect(outcome).not.toBe('ACCEPTED');
    expect(outcome).toContain(`error in evaluating input index ${caller}:`);
    expect((await t2.sc.getState()).pings).toBe(0n);
  }, 300_000);

  it('refuses a turn whose record names another reader', async () => {
    const { provider, r, t1, t2, honest } = await setup();
    const tx = await capture(provider, honest);
    const coins = await coinsOf(provider, tx);
    const caller = masterOf(coins, r.category);
    const callee = masterOf(coins, t2.category);
    const other = masterOf(coins, t1.category);
    // T2's run names T1's input as its reader, and its record says so: a run answering another caller.
    tx.inputs[callee]!.unlockingBytecode = withPushes(tx.inputs[callee]!.unlockingBytecode, abiOf(artifacts().T, 'ping'), {
      __internal__callRecordReader: bigIntToVmNumber(BigInt(other)),
    });
    tx.outputs[recordOf(tx, t2.category)]!.token!.nft!.commitment = recordFor(TAG, other);
    const outcome = await outcomeOf(provider, tx);
    expect(outcome).not.toBe('ACCEPTED');
    expect(outcome).toContain(`error in evaluating input index ${caller}:`);
    expect((await t2.sc.getState()).pings).toBe(0n);
  }, 300_000);
});

// A paying call's loop fills its one payment register pair once: one turn per transaction pays.
const PAY_SOURCE = `pragma solidcash ^0.52.0;
  interface IT { function ping(int tag) external; }
  contract P { int runs;
    function payAll(address t, uint n, uint v) external {
      for (uint i = 0; i < n; i++) {
        (bool ok, bytes data) = t.call{value: v}(abi.encodeWithSelector(IT.ping.selector, 7));
        require(ok);
      }
      runs = runs + 1;
    }
    function payEach(address t, uint[] vs) external {
      for (uint i = 0; i < vs.length; i++) {
        (bool ok, bytes data) = t.call{value: vs[i]}(abi.encodeWithSelector(IT.ping.selector, 7));
        require(ok);
      }
      runs = runs + 1;
    }
  }`;

describe('a per-turn call that pays a value', () => {
  let paying: Artifact | undefined;
  const payArtifact = (): Artifact => {
    paying ??= (compileStringMulti(PAY_SOURCE, OPTIONS) as Record<string, Artifact>).P;
    return paying!;
  };
  const rowsOf = (name: string): NonNullable<AbiFunction['lowLevelCalls']> => abiOf(payArtifact(), name).lowLevelCalls!;
  const turns = [{ type: 'stateful' }, { type: 'stateful' }];
  const lock = Uint8Array.of(0x51);

  it('publishes what each turn pays, and nothing for a call that pays none', () => {
    expect(rowsOf('payAll')[0]).toMatchObject({ perTurn: true, valueSource: { kind: 'forward', paramIndex: 2 } });
    expect(rowsOf('payEach')[0]).toMatchObject({
      perTurn: true, valueSource: { kind: 'arrayElement', paramIndex: 1, indexStepValue: 1 },
    });
    expect(abiOf(artifacts().R, 'pingAll').lowLevelCalls?.[0]?.valueSource).toBeUndefined();
  });

  it('refuses two paying turns before building, and admits a listing of which at most one pays', () => {
    expect(() => refuseSecondPayingTurn(rowsOf('payAll'), turns, [lock, 2n, 1000n], 'P.payAll'))
      .toThrow(LowLevelCallTurnsError);
    expect(() => refuseSecondPayingTurn(rowsOf('payAll'), turns, [lock, 2n, 0n], 'P.payAll')).not.toThrow();
    expect(() => refuseSecondPayingTurn(rowsOf('payAll'), turns.slice(1), [lock, 1n, 1000n], 'P.payAll')).not.toThrow();
    expect(() => refuseSecondPayingTurn(rowsOf('payEach'), turns, [lock, [0n, 5n]], 'P.payEach')).not.toThrow();
    expect(() => refuseSecondPayingTurn(rowsOf('payEach'), turns, [lock, [5n, 5n]], 'P.payEach'))
      .toThrow(/2 nonzero amounts, and its loop pays from one turn per transaction/);
  });

  it('refuses by name a send whose two turns each pay, before any transaction is sent', async () => {
    const provider = createTestProvider();
    const t1 = await deploy(provider, artifacts().T, { pings: 0n });
    const t2 = await deploy(provider, artifacts().T, { pings: 0n });
    const p = await deploy(provider, payArtifact(), { runs: 0n });
    let sent = 0;
    const send = provider.sendRawTransaction.bind(provider);
    (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
      sent += 1;
      return send(hex);
    };
    await expect((p.sc as any).payAll(t1.lock, 2n, 1000n)
      .withCall(t1.sc, 'ping', [TAG]).withCall(t2.sc, 'ping', [TAG]).send())
      .rejects.toThrow(/2 turns each pay \{value:\} 1000, and its loop pays from one turn per transaction/);
    expect(sent).toBe(0);
    expect((await p.sc.getState()).runs).toBe(0n);
  }, 300_000);
});

describe('a stateless caller\'s low-level call loop', () => {
  const standIn = (lock: Uint8Array): unknown => ({
    generateLockingBytecode: (): Uint8Array => lock,
    generateUnlockingBytecode: (): Uint8Array => Uint8Array.of(0x51),
  });
  const [first, second] = [Uint8Array.of(0x75, 0x51), Uint8Array.of(0x75, 0x52)];
  let coin = 0;

  // S's input, then one coin per listed lock, then the fee input; `list` names each turn's callee input.
  async function relay(locks: Uint8Array[], targets: Uint8Array[], list: number[]): Promise<TransactionBuilder> {
    const provider = createTestProvider();
    const artifact = compileString(STATELESS_SOURCE, OPTIONS);
    const s = new Contract(artifact, [], { provider });
    const fn = abiOf(artifact, 'relayAll');
    const args = fn.inputs.map((input) => {
      if (input.name === 'ts') return encodePushdataValue(targets, 'address[]');
      if (input.name === 'payloads') return encodePushdataValue(targets.map(() => hexToBin('deadbeef')), 'bytes[]');
      if (input.name === lowLevelCallTurnInputsInput(0)) return lowLevelCallTurnInputsWitness(list);
      throw new Error(`unexpected input ${input.name}`);
    });
    const funder = await createFeeFunder(provider, 10000n);
    const tb = new TransactionBuilder({ provider });
    tb.addInput({ txid: 'cc'.repeat(32), vout: 0, satoshis: 100000n }, (s.unlock as any).relayAll(...args));
    for (const lock of locks) {
      coin += 1;
      tb.addInput({ txid: coin.toString(16).padStart(64, '0'), vout: 0, satoshis: 2000n }, standIn(lock) as never);
    }
    tb.addInput(funder.utxo, funder.unlocker);
    tb.addOutput({ to: s.address, amount: 100000n });
    tb.addOutput({ to: Uint8Array.of(0x51), amount: BigInt(2000 * locks.length) + 3000n });
    return tb;
  }

  it('settles two turns reaching two callees', async () => {
    verifyTransaction(await relay([first, second], [first, second], [1, 2]));
  });

  it('settles two turns reaching one callee, which takes two runs of it', async () => {
    verifyTransaction(await relay([first, first], [first, first], [1, 2]));
  });

  it('refuses one run answering both turns', async () => {
    const tb = await relay([first, first], [first, first], [1, 1]);
    expect(() => verifyTransaction(tb)).toThrow(/error in evaluating input index 0:/);
  });
});
