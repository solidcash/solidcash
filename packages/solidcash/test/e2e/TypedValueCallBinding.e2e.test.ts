import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, decodeAuthenticationInstructions, decodeTransactionUnsafe, encodeAuthenticationInstructions,
  encodeDataPush, encodeTransaction, hexToBin, vmNumberToBigInt,
} from '@bitauth/libauth';
import type { AbiFunction, Artifact } from '@solidcash/utils';
import { compileStringMulti } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract, getSatoshiContainerAddress } from '../../src/stateful/index.js';
import { callRecordDigest } from '../../src/stateful/call-record.js';
import { addressToLockScript } from '../../src/utils.js';
import { createTestProvider, expectScriptRejection, setupStatefulUtxos } from '../test-util.js';

/**
 * A typed call that pays value, `ISingle(v).deposit{value: 3000}(id)`, to a stateful callee in the direct convention
 * (docs/security/security-audit-2026-10-16.md, "Call targets"). The caller reads the callee's record, whose digest
 * names the method, the arguments, the reader (the caller's input) and the value. The caller takes the value from its
 * satoshi container, which its check requires at its slot, with no output of its own; the builder pays it into the
 * callee's satoshi container, and the callee digests what its container received. The payer pays only the fee and the
 * outputs the call adds. So the record binds, through a one-method and a two-method interface alike:
 * - the method and the arguments;
 * - the value: a spend that pays the callee less than its caller sent is refused;
 * - the caller: one callee run answers one caller.
 * The same holds for the call spelled `I(v).f.call{value:}()`, a typed call and not a raw one.
 * The body rewrites the target after the call, so the identity check reads the call-site register.
 */

const SOURCE = `pragma solidcash >=0.8.0;
interface ISingle { function deposit(int id) external; }
interface ISingleOther { function other(int id) external; }
interface IMulti {
  function deposit(int id) external;
  function other(int id) external;
}
contract Vault() {
  int total;
  int last;
  function deposit(int id) public { this.total = this.total + msg.value; this.last = id; }
  function other(int id) public { this.total = this.total + msg.value; this.last = 0 - id; }
}
contract SingleCaller() {
  int calls;
  function fund(address v, address w, int id) public {
    ISingle(v).deposit{value: 3000}(id);
    v = w;
    this.calls = this.calls + 1;
  }
  function fundLess(address v, address w, int id) public {
    ISingle(v).deposit{value: 2999}(id);
    v = w;
    this.calls = this.calls + 1;
  }
  function fundOther(address v, address w, int id) public {
    ISingleOther(v).other{value: 3000}(id);
    v = w;
    this.calls = this.calls + 1;
  }
}
contract MultiCaller() {
  int calls;
  function fund(address v, address w, int id) public {
    IMulti(v).deposit{value: 3000}(id);
    v = w;
    this.calls = this.calls + 1;
  }
  function fundLess(address v, address w, int id) public {
    IMulti(v).deposit{value: 2999}(id);
    v = w;
    this.calls = this.calls + 1;
  }
  function fundOther(address v, address w, int id) public {
    IMulti(v).other{value: 3000}(id);
    v = w;
    this.calls = this.calls + 1;
  }
}
contract SpelledCaller() {
  int calls;
  function fund(address v, address w, int id) public {
    ISingle(v).deposit.call{value: 3000}(id);
    v = w;
    this.calls = this.calls + 1;
  }
  function fundLess(address v, address w, int id) public {
    ISingle(v).deposit.call{value: 2999}(id);
    v = w;
    this.calls = this.calls + 1;
  }
  function fundOther(address v, address w, int id) public {
    ISingleOther(v).other.call{value: 3000}(id);
    v = w;
    this.calls = this.calls + 1;
  }
}`;

const VALUE = 3000n;
const ID = 7n;
const BALANCE = 50_000n;
const TIMEOUT = 300_000;

const KINDS = [
  { name: 'through a one-method interface', caller: 'SingleCaller' },
  { name: 'through a two-method interface', caller: 'MultiCaller' },
  // `I(v).f.call{value:}()` is the typed call spelled as a call: it lowers to the same regular call.
  { name: 'spelled `I(v).f.call{value:}()`', caller: 'SpelledCaller' },
] as const;

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;
type TxInput = Tx['inputs'][number];
type TxOutput = Tx['outputs'][number];
type Instruction = { opcode: number; data?: Uint8Array };
interface Coin {
  readonly lockingBytecode: Uint8Array;
  readonly satoshis: bigint;
  readonly token?: { readonly category: string; readonly nft?: { readonly capability: string } };
}

let compiled: Record<string, Artifact> | undefined;
const artifacts = (): Record<string, Artifact> => {
  compiled ??= compileStringMulti(SOURCE) as Record<string, Artifact>;
  return compiled;
};
const abiOf = (artifact: Artifact, name: string): AbiFunction => artifact.abi.find((entry) => entry.name === name)!;

// P2SH32 of `OP_1`, spent with a push of its redeem script: the SDK's mocknet fee funder, here also the spender's lock.
const FUNDER = hexToBin('aa20953ccfa596a6c6d39e5980194539124fdcff116a571455a212baed811f585ee087');
const FUNDER_UNLOCK = Uint8Array.of(0x01, 0x51);
let coinNonce = 0;
const nextTxid = (): string => {
  coinNonce += 1;
  return `5eed${coinNonce.toString(16).padStart(60, '0')}`;
};

interface Deployed {
  readonly sc: StatefulContract<any>;
  readonly category: string;
  readonly lock: Uint8Array;
  /** Its satoshi container's lock. */
  readonly container: Uint8Array;
}

/** Deploys `artifact` with `state`; a `balance` funds its satoshi container, which pays the contract's `{value:}`. */
async function deploy(
  provider: Provider, artifact: Artifact, state: Record<string, bigint>, balance?: bigint,
): Promise<Deployed> {
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(provider, contract, artifact.stateLayout!, state, { saltContract: true });
  const inner = contract.withCategory(hexToBin(categoryId));
  const container = getSatoshiContainerAddress(inner, categoryId);
  if (balance !== undefined) await (provider as any).addUtxo(container, { txid: nextTxid(), vout: 0, satoshis: balance });
  return {
    sc: StatefulContract.withCategory(contract, categoryId),
    category: categoryId,
    lock: hexToBin(inner.lockingBytecode),
    container: addressToLockScript(container),
  };
}

/** `caller` runs `entry`, whose call `vault` answers by running `method`; the body then writes FUNDER to the target. */
const callOf = (caller: Deployed, vault: Deployed, entry: string, method: string, id = ID) => (): Promise<unknown> =>
  (caller.sc as any)[entry](vault.lock, FUNDER, id).withExternalCall(vault.sc, method, [id]).send();

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

/** The coins `tx` spends, read from the mock ledger while they are live. */
const coinsOf = (provider: Provider, tx: Tx): Promise<Coin[]> => Promise.all(tx.inputs.map(async (input) => {
  const coin = await (provider as any).getLedgerOutput(binToHex(input.outpointTransactionHash), input.outpointIndex);
  expect(coin, `input ${binToHex(input.outpointTransactionHash)}:${input.outpointIndex} spends a live coin`).toBeDefined();
  return coin as Coin;
}));

const reversedHex = (hex: string): string => binToHex(hexToBin(hex).reverse());
const ofCategory = (category: Uint8Array | string | undefined, hex: string): boolean => category !== undefined
  && [hex, reversedHex(hex)].includes(typeof category === 'string' ? category : binToHex(category));
const inputOfCoin = (coins: readonly Coin[], category: string, capability: string): number => coins
  .findIndex((coin) => ofCategory(coin.token?.category, category) && coin.token?.nft?.capability === capability);
const outputWith = (tx: Tx, lock: string, category: string): number => tx.outputs.findIndex((output) => (
  binToHex(output.lockingBytecode) === lock && ofCategory(output.token?.category, category)));
const paysTo = (output: TxOutput, lock: Uint8Array): boolean => output.token === undefined
  && binToHex(output.lockingBytecode) === binToHex(lock);

/**
 * `into` with the run of `vault` taken from `from`, a build of the same layout spending the same coins: the vault's
 * unlockings, its outputs and the value paid into its satoshi container.
 */
function withCalleeRun(into: Tx, from: Tx, coins: readonly Coin[], vault: Deployed): Tx {
  const tx = structuredClone(into);
  const inputs = coins.flatMap((coin, index) => (ofCategory(coin.token?.category, vault.category) ? [index] : []));
  const outputsOf = (of: Tx): number[] => of.outputs.flatMap((output, index) => (
    ofCategory(output.token?.category, vault.category) || paysTo(output, vault.container) ? [index] : []));
  expect(inputs.length).toBeGreaterThan(0);
  expect(outputsOf(from)).toEqual(outputsOf(into));
  for (const index of inputs) {
    const source = from.inputs[index]!;
    expect(binToHex(source.outpointTransactionHash)).toBe(binToHex(into.inputs[index]!.outpointTransactionHash));
    expect(source.outpointIndex).toBe(into.inputs[index]!.outpointIndex);
    tx.inputs[index]!.unlockingBytecode = source.unlockingBytecode;
  }
  for (const index of outputsOf(into)) tx.outputs[index] = structuredClone(from.outputs[index]!);
  return tx;
}

async function funderCoin(provider: Provider, satoshis: bigint): Promise<TxInput> {
  const txid = nextTxid();
  await (provider as any).addUtxo(binToHex(FUNDER), { txid, vout: 0, satoshis });
  return {
    outpointTransactionHash: hexToBin(txid), outpointIndex: 0, sequenceNumber: 0xffffffff,
    unlockingBytecode: FUNDER_UNLOCK,
  };
}

const pushOf = (value: bigint): Instruction => decodeAuthenticationInstructions(
  encodeDataPush(bigIntToVmNumber(value)),
)[0] as Instruction;
const valueOf = (instruction: Instruction): bigint => {
  if (instruction.opcode === 0x00) return 0n;
  if (instruction.opcode === 0x4f) return -1n;
  if (instruction.opcode >= 0x51 && instruction.opcode <= 0x60) return BigInt(instruction.opcode - 0x50);
  const value = vmNumberToBigInt(instruction.data ?? new Uint8Array(), { requireMinimalEncoding: false });
  if (typeof value !== 'bigint') throw new Error(`push ${instruction.opcode} is no number`);
  return value;
};

// The covenant witnesses that name an input or an output of the transaction; -1 names none.
const INPUT_WITNESS = /^__internal__(?:externalCallInputBase|extcallMasterIdx\d*|extcallAnchorIdx\d*|callRecordReader)$/;
const OUTPUT_WITNESS = /^__internal__(?:returnOutputIdx|externalReturnOutputIdx\d*|callEdgeOutputIdx\d*)$/;

/** A master's unlocking (selector, one push per ABI input with input 0 last, redeem) with its coordinates moved. */
function moveMaster(
  unlocking: Uint8Array, fn: AbiFunction, inputOf: (index: number) => number, outputOf: (index: number) => number,
): Uint8Array {
  const instructions = decodeAuthenticationInstructions(unlocking) as Instruction[];
  expect(instructions).toHaveLength(fn.inputs.length + 2);
  fn.inputs.forEach((input, position) => {
    const move = INPUT_WITNESS.test(input.name) ? inputOf : OUTPUT_WITNESS.test(input.name) ? outputOf : undefined;
    const at = instructions.length - 2 - position;
    const value = move === undefined ? -1n : valueOf(instructions[at]!);
    if (value >= 0n) instructions[at] = pushOf(BigInt(move!(Number(value))));
  });
  return encodeAuthenticationInstructions(instructions as any);
}

/** A data record's unlocking, `<master> [<output>] <flag> <redeem>`, with its coordinates moved. */
function moveRecord(
  unlocking: Uint8Array, inputOf: (index: number) => number, outputOf: (index: number) => number,
): Uint8Array {
  const instructions = decodeAuthenticationInstructions(unlocking) as Instruction[];
  const relocated = valueOf(instructions[instructions.length - 2]!) === 3n;
  const master = instructions.length - (relocated ? 4 : 3);
  instructions[master] = pushOf(BigInt(inputOf(Number(valueOf(instructions[master]!)))));
  if (relocated) instructions[master + 1] = pushOf(BigInt(outputOf(Number(valueOf(instructions[master + 1]!)))));
  return encodeAuthenticationInstructions(instructions as any);
}

/** A satoshi container's unlocking on its master path, `<master> <1> <redeem>`, with its master's input moved. */
function moveContainer(unlocking: Uint8Array, inputOf: (index: number) => number): Uint8Array {
  const instructions = decodeAuthenticationInstructions(unlocking) as Instruction[];
  expect(valueOf(instructions[instructions.length - 2]!)).toBe(1n);
  const master = instructions.length - 3;
  instructions[master] = pushOf(BigInt(inputOf(Number(valueOf(instructions[master]!)))));
  return encodeAuthenticationInstructions(instructions as any);
}

interface Merged { readonly tx: Tx; readonly inputOf: (index: number) => number; readonly base: number }

/**
 * `a` with every input and output of `b` after it, both lists of `a` first padded to one length so each block of `b`
 * keeps its input and its output at one index. The coins and outputs of `shared`, a callee both spend, are `a`'s:
 * `b`'s copies become plain coins and outputs of the same value, and `b`'s witnesses naming them name `a`'s. A plain
 * coin both builds spend (a block funder, whose outpoint the SDK derives from the block's place) becomes a fresh coin
 * of its value in `b`'s part. `runs` gives the entry each carried master runs, by category, whose coordinate witnesses
 * move with it; `containers` the locks of the satoshi containers whose master moves.
 */
async function merge(
  provider: Provider, a: Tx, b: Tx, runs: ReadonlyMap<string, AbiFunction>, containers: ReadonlySet<string>,
  shared?: string,
): Promise<Merged> {
  const [coinsA, coinsB] = await Promise.all([coinsOf(provider, a), coinsOf(provider, b)]);
  const tx = structuredClone(a);
  const values = coinsA.map((coin) => coin.satoshis);
  const base = Math.max(a.inputs.length, a.outputs.length);
  while (tx.inputs.length < base) {
    tx.inputs.push(await funderCoin(provider, 2000n));
    values.push(2000n);
  }
  while (tx.outputs.length < base) tx.outputs.push({ lockingBytecode: FUNDER, valueSatoshis: 1000n });
  const sharedInput = (index: number): boolean => shared !== undefined && ofCategory(coinsB[index]!.token?.category, shared);
  const sharedOutput = (output: TxOutput): boolean => shared !== undefined && ofCategory(output.token?.category, shared);
  const inputOf = (index: number): number => {
    if (!sharedInput(index)) return base + index;
    const outpoint = b.inputs[index]!;
    const at = a.inputs.findIndex((input) => input.outpointIndex === outpoint.outpointIndex
      && binToHex(input.outpointTransactionHash) === binToHex(outpoint.outpointTransactionHash));
    expect(at).toBeGreaterThanOrEqual(0);
    return at;
  };
  const outputOf = (index: number): number => {
    const output = b.outputs[index]!;
    if (!sharedOutput(output)) return base + index;
    const at = a.outputs.findIndex((candidate) => sharedOutput(candidate)
      && binToHex(candidate.lockingBytecode) === binToHex(output.lockingBytecode)
      && candidate.token?.nft?.capability === output.token?.nft?.capability);
    expect(at).toBeGreaterThanOrEqual(0);
    return at;
  };
  const spentByA = (input: TxInput): boolean => a.inputs.some((candidate) => candidate.outpointIndex
    === input.outpointIndex && binToHex(candidate.outpointTransactionHash) === binToHex(input.outpointTransactionHash));
  for (const [index, input] of b.inputs.entries()) {
    const coin = coinsB[index]!;
    values.push(coin.satoshis);
    const twin = !sharedInput(index) && spentByA(input);
    if (twin) expect(coin.token, 'a coin both builds spend is a plain one').toBeUndefined();
    if (sharedInput(index) || twin) {
      tx.inputs.push(await funderCoin(provider, coin.satoshis));
      continue;
    }
    const run = [...runs].find(([category]) => ofCategory(coin.token?.category, category))?.[1];
    const capability = coin.token?.nft?.capability;
    const unlockingBytecode = containers.has(binToHex(coin.lockingBytecode))
      ? moveContainer(input.unlockingBytecode, inputOf)
      : run === undefined ? input.unlockingBytecode
        : capability === 'minting' ? moveMaster(input.unlockingBytecode, run, inputOf, outputOf)
          : capability === 'mutable' ? moveRecord(input.unlockingBytecode, inputOf, outputOf) : input.unlockingBytecode;
    tx.inputs.push({ ...input, unlockingBytecode });
  }
  for (const output of b.outputs) {
    tx.outputs.push(sharedOutput(output) ? { lockingBytecode: FUNDER, valueSatoshis: output.valueSatoshis } : output);
  }
  // Two satoshis a byte: each part paid for its own bytes, and the merge adds only plain coins and outputs.
  const fee = values.reduce((sum, value) => sum + value, 0n)
    - tx.outputs.reduce((sum, output) => sum + output.valueSatoshis, 0n);
  const needed = 2n * BigInt(encodeTransaction(tx).length + 100);
  if (fee < needed) tx.inputs.push(await funderCoin(provider, needed - fee + 1000n));
  return { tx, inputOf, base };
}

/**
 * Points the edge (value 0) or record (value VALUE) of `category` under `lock` at its reader's input: `deposit(ID)`
 * read at `reader`. An edge digests no value; a record, the value its call sent.
 */
function readAt(tx: Tx, lock: string, category: string, reader: number, value = 0n): void {
  const at = outputWith(tx, lock, category);
  if (at < 0) return;
  const digest = callRecordDigest(abiOf(artifacts().Vault, 'deposit'), [ID], {}, 0, reader, value)!;
  const commitment = tx.outputs[at]!.token!.nft!.commitment;
  tx.outputs[at]!.token!.nft!.commitment = Uint8Array.of(...digest, ...commitment.slice(31));
}

describe.each(KINDS)('a typed {value:} call $name', ({ caller: callerName }) => {
  const callerArtifact = (): Artifact => artifacts()[callerName]!;
  const vaultOf = (provider: Provider): Promise<Deployed> => deploy(provider, artifacts().Vault, { total: 0n, last: 0n });
  const callerOf = (provider: Provider): Promise<Deployed> => deploy(provider, callerArtifact(), { calls: 0n }, BALANCE);

  it('settles an honest call: the caller\'s container pays the value into the vault\'s, the payer the fee', async () => {
    const provider = createTestProvider();
    const vault = await vaultOf(provider);
    const caller = await callerOf(provider);
    const tx = await capture(provider, callOf(caller, vault, 'fund', 'deposit'));
    const coins = await coinsOf(provider, tx);
    // The payer, the mocknet funder, pays the fee and the outputs the call adds at new locks (its record, its edge),
    // less the value the caller's container pays into the vault's: nothing of the value, nothing the contracts keep.
    const lockOf = (bytecode: Uint8Array): string => binToHex(bytecode);
    const sum = (amounts: readonly bigint[]): bigint => amounts.reduce((total, amount) => total + amount, 0n);
    const spent = new Set(coins.map((coin) => lockOf(coin.lockingBytecode)));
    const payer = lockOf(FUNDER);
    const fee = sum(coins.map((coin) => coin.satoshis)) - sum(tx.outputs.map((output) => output.valueSatoshis));
    const paid = sum(coins.filter((coin) => lockOf(coin.lockingBytecode) === payer).map((coin) => coin.satoshis))
      - sum(tx.outputs.filter((output) => lockOf(output.lockingBytecode) === payer).map((output) => output.valueSatoshis));
    const added = sum(tx.outputs.filter((output) => !spent.has(lockOf(output.lockingBytecode))
      && lockOf(output.lockingBytecode) !== payer).map((output) => output.valueSatoshis));
    expect(paid).toBe(fee + added - VALUE);

    expect(await outcomeOf(provider, tx)).toBe('ACCEPTED');
    expect((await caller.sc.getState()).calls).toBe(1n);
    expect((await vault.sc.getState()).last).toBe(ID);
    expect((await vault.sc.getState()).total).toBe(VALUE);
    // One coin each: the caller's container recreated less the value, the vault's container holding the value.
    const held = async (lock: Uint8Array): Promise<bigint[]> => (await provider.getUtxosForLockingBytecode(lock))
      .map((utxo) => utxo.satoshis);
    expect(await held(caller.container)).toEqual([BALANCE - VALUE]);
    expect(await held(vault.container)).toEqual([VALUE]);
  }, TIMEOUT);

  /** The honest call with the vault's run in its place, taken from an honest call of `entry` naming `method`. */
  const transplanted = async (
    entry: string, method: string, id = ID,
  ): Promise<{ provider: Provider; tx: Tx; callerInput: number }> => {
    const provider = createTestProvider();
    const vault = await vaultOf(provider);
    const caller = await callerOf(provider);
    const honest = await capture(provider, callOf(caller, vault, 'fund', 'deposit'));
    const other = await capture(provider, callOf(caller, vault, entry, method, id));
    const coins = await coinsOf(provider, honest);
    return {
      provider,
      tx: withCalleeRun(honest, other, coins, vault),
      callerInput: inputOfCoin(coins, caller.category, 'minting'),
    };
  };

  it('refuses a callee run of another method: the record names the method', async () => {
    const { provider, tx, callerInput } = await transplanted('fundOther', 'other');
    expectScriptRejection(await outcomeOf(provider, tx), callerInput);
  }, TIMEOUT);

  it('refuses a callee run on another argument: the record names the arguments', async () => {
    const { provider, tx, callerInput } = await transplanted('fund', 'deposit', ID + 1n);
    expectScriptRejection(await outcomeOf(provider, tx), callerInput);
  }, TIMEOUT);

  it('refuses a spend paying the callee less than its caller sent: the record names the value', async () => {
    const { provider, tx, callerInput } = await transplanted('fundLess', 'deposit');
    expectScriptRejection(await outcomeOf(provider, tx), callerInput);
  }, TIMEOUT);

  it('settles two callers merged into one transaction, each with a callee of its own', async () => {
    const provider = createTestProvider();
    const first = await vaultOf(provider);
    const second = await vaultOf(provider);
    const a1 = await callerOf(provider);
    const a2 = await callerOf(provider);
    const a = await capture(provider, callOf(a1, first, 'fund', 'deposit'));
    const b = await capture(provider, callOf(a2, second, 'fund', 'deposit'));
    const runs = new Map([
      [a2.category, abiOf(callerArtifact(), 'fund')], [second.category, abiOf(artifacts().Vault, 'deposit')],
    ]);
    const { tx, inputOf } = await merge(provider, a, b, runs, new Set([binToHex(a2.container)]));
    // A2 moved: its edge and its callee's record name the input it now reads at.
    const reader = inputOf(inputOfCoin(await coinsOf(provider, b), a2.category, 'minting'));
    readAt(tx, '5161', a2.category, reader);
    readAt(tx, '51', second.category, reader, VALUE);

    expect(await outcomeOf(provider, tx)).toBe('ACCEPTED');
    expect((await a1.sc.getState()).calls).toBe(1n);
    expect((await a2.sc.getState()).calls).toBe(1n);
    expect((await first.sc.getState()).total).toBe(VALUE);
    expect((await second.sc.getState()).total).toBe(VALUE);
  }, TIMEOUT);

  it('refuses two callers answered by one callee run: the record names its reader', async () => {
    const provider = createTestProvider();
    const vault = await vaultOf(provider);
    const a1 = await callerOf(provider);
    const a2 = await callerOf(provider);
    const a = await capture(provider, callOf(a1, vault, 'fund', 'deposit'));
    const b = await capture(provider, callOf(a2, vault, 'fund', 'deposit'));
    const { tx, inputOf, base } = await merge(
      provider, a, b, new Map([[a2.category, abiOf(callerArtifact(), 'fund')]]), new Set([binToHex(a2.container)]),
      vault.category,
    );
    const second = inputOf(inputOfCoin(await coinsOf(provider, b), a2.category, 'minting'));
    readAt(tx, '5161', a2.category, second);
    // The vault runs once, A1's run: the spender keeps the value A2 took from its container.
    tx.outputs.forEach((output, index) => {
      if (index >= base && paysTo(output, vault.container)) output.lockingBytecode = FUNDER;
    });
    expectScriptRejection(await outcomeOf(provider, tx), second);
    expect((await vault.sc.getState()).total).toBe(0n);
  }, TIMEOUT);
});

describe('a typed {value:} call that reads no record of its callee', () => {
  it('is refused by name: nothing would bind its value to the callee', () => {
    const source = SOURCE.replace('ISingle(v).deposit{value: 3000}(id);', 'ISingle(msg.sender).deposit{value: 3000}(id);');
    expect(() => compileStringMulti(source)).toThrow(/sends \{value:\} with ISingle\.deposit\(\), which reads no record/);
  });
});
