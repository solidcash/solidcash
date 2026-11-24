import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, decodeAuthenticationInstructions, decodeTransactionUnsafe, encodeAuthenticationInstructions,
  encodeDataPush, encodeTransaction, hexToBin, vmNumberToBigInt,
} from '@bitauth/libauth';
import { CALL_RECORD_READER_INPUT, type AbiFunction, type Artifact } from '@solidcash/utils';
import { compileString, compileStringMulti } from '../direct-compile.js';
import { Contract, Signer } from '../../src/index.js';
import { StatefulContract, getContractFactory, upgrades } from '../../src/stateful/index.js';
import { callRecordDigest } from '../../src/stateful/call-record.js';
import { addProvenUtxo, createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * One call record answers one reader (docs/security/security-audit-2026-10-16.md, "One record read by two callers").
 * A direct callee spent once runs one call and pins one record. A record that names only the call (ordinal, method,
 * arguments) is read alike by every caller that makes the same call, so two callers in one transaction each take an
 * effect that ran once: two credits for one withdrawal. A record now names its reader, the input index of the caller
 * that reads it, which the caller digests from OP_INPUTINDEX: two callers sit at two inputs.
 *
 * The attack merges two honest transactions, A1 -> T and A2 -> T, into one where T runs once and both callers read its
 * record. The control merges A1 -> T1 and A2 -> T2 the same way and settles, so only the shared record is refused.
 * The merge discovers every position from the transactions and the ABI, so it runs on a build without the binding,
 * where the attack settles. A void call through an interface naming several methods reads the callee's record too,
 * in place of its selector check, and a call through a function pointer reads it by the digest of the selector the
 * pointer holds. A call an implementation makes behind a proxy names the implementation's input.
 */

const SOURCE = `pragma solidcash >=0.8.0;
interface IVault {
  function withdraw(int amount) external returns (int);
  function spend(int amount) external;
}
interface ISpend { function spend(int amount) external; }
contract Vault() {
  int balance;
  function withdraw(int amount) public returns (int) {
    require(amount <= this.balance);
    this.balance = this.balance - amount;
    return amount;
  }
  function spend(int amount) public {
    require(amount <= this.balance);
    this.balance = this.balance - amount;
  }
}
contract Account() {
  int credited;
  function pull(address vault, int amount) public {
    this.credited = this.credited + IVault(vault).withdraw(amount);
  }
  function pay(address vault, int amount) public {
    ISpend(vault).spend(amount);
    this.credited = this.credited + amount;
  }
  function payMany(address vault, int amount) public {
    IVault(vault).spend(amount);
    this.credited = this.credited + amount;
  }
}`;

// The returning call reads `digest || 01 || result`; the void call, through a one-method interface or one naming
// several, `digest || 01`.
const SHAPES = [
  { kind: 'returning', entry: 'pull', method: 'withdraw' },
  { kind: 'void', entry: 'pay', method: 'spend' },
  { kind: 'multi-method void', entry: 'payMany', method: 'spend' },
] as const;
type Shape = typeof SHAPES[number];

const AMOUNT = 30n;
const BALANCE = 100n;

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;
type TxInput = Tx['inputs'][number];
type TxOutput = Tx['outputs'][number];
type Instruction = { opcode: number; data?: Uint8Array };
interface Coin {
  readonly satoshis: bigint;
  readonly token?: { readonly category: string; readonly nft?: { readonly capability: string } };
}

let compiled: Record<string, Artifact> | undefined;
const artifacts = (): Record<string, Artifact> => {
  compiled ??= compileStringMulti(SOURCE) as Record<string, Artifact>;
  return compiled;
};
const abiOf = (artifact: Artifact, name: string): AbiFunction => artifact.abi.find((entry) => entry.name === name)!;

interface Deployed { readonly sc: StatefulContract<any>; readonly category: string; readonly lock: Uint8Array }

async function deployContract(
  provider: Provider, contract: Contract, state: Record<string, bigint>,
): Promise<Deployed> {
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, contract.artifact.stateLayout!, state, { saltContract: true },
  );
  return {
    sc: StatefulContract.withCategory(contract, categoryId),
    category: categoryId,
    lock: hexToBin(contract.withCategory(hexToBin(categoryId)).lockingBytecode),
  };
}

const deploy = (provider: Provider, artifact: Artifact, state: Record<string, bigint>): Promise<Deployed> => (
  deployContract(provider, new Contract(artifact, [], { provider }), state));

const callOf = (caller: Deployed, vault: Deployed, shape: Shape) => (): Promise<unknown> => (caller.sc as any)
  [shape.entry](vault.lock, AMOUNT).withExternalCall(vault.sc, shape.method, [AMOUNT]).send();

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

// P2SH32 of `OP_1`, spent with a push of its redeem script: the SDK's mocknet fee funder.
const FUNDER = hexToBin('aa20953ccfa596a6c6d39e5980194539124fdcff116a571455a212baed811f585ee087');
const FUNDER_UNLOCK = Uint8Array.of(0x01, 0x51);
let coinNonce = 0;

async function funderCoin(provider: Provider, satoshis: bigint): Promise<TxInput> {
  coinNonce += 1;
  const txid = `5eed${coinNonce.toString(16).padStart(60, '0')}`;
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
const INPUT_WITNESS = new RegExp('^__internal__(?:externalCallInputBase|extcallMasterIdx\\d*|extcallAnchorIdx\\d*'
  + '|callRecordReader|dynamicChunkInputBase)$');
// A chunk base an entry only reads names chunk input `i` as `-(i + 3)` (resolveDynamicChunkInputBase).
const READ_CHUNK_BASE = '__internal__dynamicChunkInputBase';
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
    if (input.name === READ_CHUNK_BASE && value < -2n) instructions[at] = pushOf(-BigInt(inputOf(Number(-value - 3n)) + 3));
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

interface Merged { readonly tx: Tx; readonly inputOf: (index: number) => number }

/**
 * `a` with every input and output of `b` after it, both lists of `a` first padded to one length so each block of `b`
 * keeps its input and its output at one index. The coins and outputs of `shared`, a callee both spend, are `a`'s: `b`'s
 * copies become plain coins and outputs of the same value, and `b`'s witnesses naming them name `a`'s. A plain coin
 * both builds spend (a callee block's funder, whose outpoint the SDK derives from the block's place) becomes a fresh
 * coin of its value in `b`'s part. `runs` gives the entry each carried master runs, by category, whose coordinate
 * witnesses move with it.
 */
async function merge(
  provider: Provider, a: Tx, b: Tx, runs: ReadonlyMap<string, AbiFunction>, shared?: string,
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
    const unlockingBytecode = run === undefined ? input.unlockingBytecode
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
  return { tx, inputOf };
}

/** Rewrites the digest a record or an edge commits to, keeping its form and result. */
function setDigest(output: TxOutput, digest: Uint8Array): void {
  const commitment = output.token!.nft!.commitment;
  output.token!.nft!.commitment = Uint8Array.of(...digest, ...commitment.slice(31));
}

/**
 * The digest of `method(AMOUNT)` read at input `reader`. A build that names no reader digests none: its callee's ABI
 * takes no reader witness, and its `callRecordDigest` takes no reader.
 */
const digestFor = (method: string, reader: number): Uint8Array => (callRecordDigest as (
  ...args: unknown[]) => Uint8Array | undefined)(abiOf(artifacts().Vault, method), [AMOUNT], {}, 0, reader)!;

describe('a call record answers one reader', () => {
  it('names its caller\'s input in an honest returning call, which settles and changes the callee\'s state', async () => {
    const provider = createTestProvider();
    const vault = await deploy(provider, artifacts().Vault, { balance: BALANCE });
    const account = await deploy(provider, artifacts().Account, { credited: 0n });
    const tx = await capture(provider, callOf(account, vault, SHAPES[0]));
    const reader = inputOfCoin(await coinsOf(provider, tx), account.category, 'minting');
    expect(reader).toBeGreaterThanOrEqual(0);
    const record = tx.outputs[outputWith(tx, '51', vault.category)]!;
    expect(binToHex(record.token!.nft!.commitment.slice(0, 31))).toBe(binToHex(digestFor('withdraw', reader)));

    await callOf(account, vault, SHAPES[0])();
    expect((await account.sc.getState()).credited).toBe(AMOUNT);
    expect((await vault.sc.getState()).balance).toBe(BALANCE - AMOUNT);
  }, 300_000);

  describe.each(SHAPES)('in a $kind call', (shape) => {
    it('settles two callers merged into one transaction, each with a callee of its own', async () => {
      const provider = createTestProvider();
      const first = await deploy(provider, artifacts().Vault, { balance: BALANCE });
      const second = await deploy(provider, artifacts().Vault, { balance: BALANCE });
      const a1 = await deploy(provider, artifacts().Account, { credited: 0n });
      const a2 = await deploy(provider, artifacts().Account, { credited: 0n });
      const a = await capture(provider, callOf(a1, first, shape));
      const b = await capture(provider, callOf(a2, second, shape));
      const runs = new Map([
        [a2.category, abiOf(artifacts().Account, shape.entry)], [second.category, abiOf(artifacts().Vault, shape.method)],
      ]);
      const { tx, inputOf } = await merge(provider, a, b, runs);
      // A2 moved: its edge and its callee's record name the input it now reads at.
      const reader = inputOf(inputOfCoin(await coinsOf(provider, b), a2.category, 'minting'));
      setDigest(tx.outputs[outputWith(tx, '5161', a2.category)]!, digestFor(shape.method, reader));
      setDigest(tx.outputs[outputWith(tx, '51', second.category)]!, digestFor(shape.method, reader));

      expect(await outcomeOf(provider, tx)).toBe('ACCEPTED');
      expect((await a1.sc.getState()).credited).toBe(AMOUNT);
      expect((await a2.sc.getState()).credited).toBe(AMOUNT);
      expect((await first.sc.getState()).balance).toBe(BALANCE - AMOUNT);
      expect((await second.sc.getState()).balance).toBe(BALANCE - AMOUNT);
    }, 300_000);

    it('refuses two callers reading the record of one callee run', async () => {
      const provider = createTestProvider();
      const vault = await deploy(provider, artifacts().Vault, { balance: BALANCE });
      const a1 = await deploy(provider, artifacts().Account, { credited: 0n });
      const a2 = await deploy(provider, artifacts().Account, { credited: 0n });
      const a = await capture(provider, callOf(a1, vault, shape));
      const b = await capture(provider, callOf(a2, vault, shape));
      const { tx, inputOf } = await merge(
        provider, a, b, new Map([[a2.category, abiOf(artifacts().Account, shape.entry)]]), vault.category,
      );
      const second = inputOf(inputOfCoin(await coinsOf(provider, b), a2.category, 'minting'));
      setDigest(tx.outputs[outputWith(tx, '5161', a2.category)]!, digestFor(shape.method, second));
      // The vault runs once and pins one record, which A1's call reads. A2 reads it at its own record witness.
      expect(outputWith(tx, '51', vault.category)).toBe(outputWith(a, '51', vault.category));
      expect(tx.outputs.filter((output) => ofCategory(output.token?.category, vault.category))).toHaveLength(3);

      // Without the reader in the digest this settles: A1 and A2 each credit 30 for the vault's one withdrawal. The
      // refusal must be A2's script, the one reader too many, not any other rule of the merged transaction.
      const outcome = await outcomeOf(provider, tx);
      expect(outcome).not.toBe('ACCEPTED');
      expect(outcome).toContain('mandatory-script-verify-flag-failed');
      expect(outcome).toContain(`error in evaluating input index ${second}:`);
      expect((await vault.sc.getState()).balance).toBe(BALANCE);
    }, 300_000);
  });

  it('refuses a call that mixes a reader-bound artifact with one compiled before, naming why', async () => {
    // An artifact compiled before records named their reader: no `callRecordReader`, and no entry takes the reader
    // witness. A callee's run names a reader where its entry takes that witness, whatever its flag says.
    const compiledBefore = (artifact: Artifact): Artifact => ({
      ...artifact,
      callRecordReader: undefined,
      abi: artifact.abi.map((entry) => ({
        ...entry, inputs: entry.inputs.filter((input) => input.name !== CALL_RECORD_READER_INPUT),
      })),
    } as Artifact);
    for (const [caller, callee] of [
      [artifacts().Account, compiledBefore(artifacts().Vault)], [compiledBefore(artifacts().Account), artifacts().Vault],
    ] as const) {
      const provider = createTestProvider();
      const vault = await deploy(provider, callee, { balance: BALANCE });
      const account = await deploy(provider, caller, { credited: 0n });
      const refusal = await callOf(account, vault, SHAPES[0])().then(() => undefined, (error: Error) => error);
      expect(refusal?.constructor.name).toBe('MixedCallRecordReaderError');
      expect(refusal?.message).toMatch(/IVault\.withdraw mixes call record schemes/);
    }
  }, 300_000);
});

const RAW_SOURCE = `pragma solidcash >=0.8.0;
interface IVault {
  function withdraw(int amount) external returns (int);
  function spend(int amount) external;
}
contract Vault() {
  int balance;
  function withdraw(int amount) public returns (int) {
    require(amount <= this.balance);
    this.balance = this.balance - amount;
    return amount;
  }
  function spend(int amount) public {
    require(amount <= this.balance);
    this.balance = this.balance - amount;
  }
}
contract Puller() {
  int credited;
  function pullRaw(address vault, int amount) public {
    (bool ok, bytes memory data) = vault.call(abi.encodeWithSelector(IVault.withdraw.selector, amount));
    require(ok);
    this.credited = this.credited + abi.decode(data, (int));
  }
  function payRaw(address vault, int amount) public {
    (bool ok, bytes memory data) = vault.call(abi.encodeWithSelector(IVault.spend.selector, amount));
    require(ok);
    this.credited = this.credited + amount;
  }
  function pullOpaque(address vault, bytes payload, int amount) public {
    (bool ok, bytes memory data) = vault.call(payload);
    require(ok);
    require(data.length > 0);
    this.credited = this.credited + amount;
  }
}`;

let rawCompiled: Record<string, Artifact> | undefined;
const rawArtifacts = (): Record<string, Artifact> => {
  rawCompiled ??= compileStringMulti(RAW_SOURCE) as Record<string, Artifact>;
  return rawCompiled;
};

describe('a raw call whose callee runs once', () => {
  // A raw call's payload names the method and arguments (visible) or is bytes the spend gives (opaque); the caller
  // digests neither, and binds its callee's run to itself by the reader that run names. Two pullers each make the
  // call, merged into one transaction where the vault runs once. Before that binding both took the run, each
  // credited for one withdrawal (VM-confirmed).
  const ROWS = [
    { kind: 'visible returning', entry: 'pullRaw', method: 'withdraw', args: (): unknown[] => [AMOUNT] },
    { kind: 'visible void', entry: 'payRaw', method: 'spend', args: (): unknown[] => [AMOUNT] },
    {
      kind: 'opaque returning', entry: 'pullOpaque', method: 'withdraw',
      args: (): unknown[] => [hexToBin(abiOf(rawArtifacts().Vault, 'withdraw').selector!), AMOUNT],
    },
  ] as const;
  it.each(ROWS)('settles a $kind raw call honestly, its callee naming the caller', async (row) => {
    const provider = createTestProvider();
    const vault = await deploy(provider, rawArtifacts().Vault, { balance: BALANCE });
    const puller = await deploy(provider, rawArtifacts().Puller, { credited: 0n });
    await (puller.sc as any)[row.entry](vault.lock, ...row.args())
      .withExternalCall(vault.sc, row.method, [AMOUNT]).send();
    expect((await puller.sc.getState()).credited).toBe(AMOUNT);
    expect((await vault.sc.getState()).balance).toBe(BALANCE - AMOUNT);
  }, 300_000);

  it.each(ROWS)('refuses two callers sharing one run of a $kind raw call', async (row) => {
    const provider = createTestProvider();
    const vault = await deploy(provider, rawArtifacts().Vault, { balance: BALANCE });
    const p1 = await deploy(provider, rawArtifacts().Puller, { credited: 0n });
    const p2 = await deploy(provider, rawArtifacts().Puller, { credited: 0n });
    const call = (puller: Deployed) => (): Promise<unknown> => (puller.sc as any)[row.entry](
      vault.lock, ...row.args(),
    ).withExternalCall(vault.sc, row.method, [AMOUNT]).send();
    const a = await capture(provider, call(p1));
    const b = await capture(provider, call(p2));
    const { tx, inputOf } = await merge(
      provider, a, b, new Map([[p2.category, abiOf(rawArtifacts().Puller, row.entry)]]), vault.category,
    );
    const second = inputOf(inputOfCoin(await coinsOf(provider, b), p2.category, 'minting'));
    // The vault's one run names the first puller as its reader, so the second is refused at its own input.
    const outcome = await outcomeOf(provider, tx);
    expect(outcome).not.toBe('ACCEPTED');
    expect(outcome).toContain('mandatory-script-verify-flag-failed');
    expect(outcome).toContain(`error in evaluating input index ${second}:`);
    expect((await p2.sc.getState()).credited).toBe(0n);
    expect((await vault.sc.getState()).balance).toBe(BALANCE);
  }, 300_000);
});

const LOOP_SOURCE = `pragma solidcash >=0.8.0;
interface IVault {
  function withdraw(int amount) external returns (int);
  function spend(int amount) external;
}
contract Vault() {
  int balance;
  function withdraw(int amount) public returns (int) {
    require(amount <= this.balance);
    this.balance = this.balance - amount;
    return amount;
  }
  function spend(int amount) public {
    require(amount <= this.balance);
    this.balance = this.balance - amount;
  }
}
contract Looper() {
  int credited;
  function payEach(address[] ts, int amount) public {
    for (uint i = 0; i < ts.length; i++) { IVault(ts[i]).spend(amount); }
    this.credited = this.credited + amount;
  }
  function pullEach(address[] ts, int amount) public {
    for (uint i = 0; i < ts.length; i++) { this.credited = this.credited + IVault(ts[i]).withdraw(amount); }
  }
}`;

let loopCompiled: Record<string, Artifact> | undefined;
const loopArtifacts = (): Record<string, Artifact> => {
  loopCompiled ??= compileStringMulti(LOOP_SOURCE) as Record<string, Artifact>;
  return loopCompiled;
};

describe('a loop over targets whose callee runs once', () => {
  // Each iteration reads its callee's record, a void one `digest || 01`, at the return base plus its index, by the
  // digest of its method, its reader and its arguments. Two loopers each make the call, merged into one transaction
  // where the vault runs once. Before the void loop read its records, both took the run, each credited for one
  // payment (VM-confirmed); the returning loop already digested its records and was refused.
  const ROWS = [
    { kind: 'void', entry: 'payEach', method: 'spend' },
    { kind: 'returning', entry: 'pullEach', method: 'withdraw' },
  ] as const;
  const setupLoop = async (row: typeof ROWS[number]): Promise<{
    provider: Provider; vault: Deployed; loopers: Deployed[]; call: (looper: Deployed) => () => Promise<unknown>;
  }> => {
    const provider = createTestProvider();
    const vault = await deploy(provider, loopArtifacts().Vault, { balance: BALANCE });
    const loopers = [
      await deploy(provider, loopArtifacts().Looper, { credited: 0n }),
      await deploy(provider, loopArtifacts().Looper, { credited: 0n }),
    ];
    for (const looper of loopers) (looper.sc as any).registerExternalArray('IVault', [vault.sc], [row.method]);
    const call = (looper: Deployed) => (): Promise<unknown> => (looper.sc as any)[row.entry](
      [vault.lock], AMOUNT,
    ).send();
    return { provider, vault, loopers, call };
  };

  it.each(ROWS)('settles a $kind loop call honestly, its record naming the caller', async (row) => {
    const { provider, vault, loopers: [looper], call } = await setupLoop(row);
    const tx = await capture(provider, call(looper!));
    const record = outputWith(tx, '51', vault.category);
    const caller = inputOfCoin(await coinsOf(provider, tx), looper!.category, 'minting');
    const digest = callRecordDigest(abiOf(loopArtifacts().Vault, row.method), [AMOUNT], {}, 0, caller)!;
    expect(binToHex(tx.outputs[record]!.token!.nft!.commitment.slice(0, 31))).toBe(binToHex(digest));
    await call(looper!)();
    expect((await looper!.sc.getState()).credited).toBe(AMOUNT);
    expect((await vault.sc.getState()).balance).toBe(BALANCE - AMOUNT);
  }, 300_000);

  it.each(ROWS)('refuses two callers sharing one run of a $kind loop call', async (row) => {
    const { provider, vault, loopers: [l1, l2], call } = await setupLoop(row);
    const a = await capture(provider, call(l1!));
    const b = await capture(provider, call(l2!));
    const { tx, inputOf } = await merge(
      provider, a, b, new Map([[l2!.category, abiOf(loopArtifacts().Looper, row.entry)]]), vault.category,
    );
    const second = inputOf(inputOfCoin(await coinsOf(provider, b), l2!.category, 'minting'));
    const outcome = await outcomeOf(provider, tx);
    expect(outcome).not.toBe('ACCEPTED');
    expect(outcome).toContain('mandatory-script-verify-flag-failed');
    expect(outcome).toContain(`error in evaluating input index ${second}:`);
    expect((await l2!.sc.getState()).credited).toBe(0n);
    expect((await vault.sc.getState()).balance).toBe(BALANCE);
  }, 300_000);
});

const STATE_LOOP_SOURCE = `pragma solidcash >=0.8.0;
interface IVault {
  function withdraw(int amount) external returns (int);
  function spend(int amount) external;
}
contract Vault() {
  int balance;
  function withdraw(int amount) public returns (int) {
    require(amount <= this.balance);
    this.balance = this.balance - amount;
    return amount;
  }
  function spend(int amount) public {
    require(amount <= this.balance);
    this.balance = this.balance - amount;
  }
}
contract Keeper() {
  address[] ts;
  int credited;
  function reg(address t) public { this.ts.push(t); }
  function payAll(int amount) public {
    for (uint i = 0; i < ts.length; i++) { IVault(ts[i]).spend(amount); }
    this.credited = this.credited + amount;
  }
  function pullAll(int amount) public {
    for (uint i = 0; i < ts.length; i++) { this.credited = this.credited + IVault(ts[i]).withdraw(amount); }
  }
}`;

let stateLoopCompiled: Record<string, Artifact> | undefined;
const stateLoopArtifacts = (): Record<string, Artifact> => {
  stateLoopCompiled ??= compileStringMulti(STATE_LOOP_SOURCE) as Record<string, Artifact>;
  return stateLoopCompiled;
};

describe('a loop over a state array whose callee runs once', () => {
  // Each turn reads its callee's record at the return base plus its element, by the digest of its method, its reader
  // and its arguments, and checks the record's carrier is the callee's. Two keepers each make the call, merged into one
  // transaction where the vault runs once.
  const ROWS = [
    { kind: 'void', entry: 'payAll', method: 'spend' },
    { kind: 'returning', entry: 'pullAll', method: 'withdraw' },
  ] as const;
  /** Two keepers whose tables hold one vault each: the same one, or with `own` one each. */
  const setupKeepers = async (row: typeof ROWS[number], own = false, balance = BALANCE): Promise<{
    provider: Provider; vaults: Deployed[]; keepers: Deployed[]; call: (keeper: Deployed) => () => Promise<unknown>;
  }> => {
    const provider = createTestProvider();
    const vaults: Deployed[] = [];
    const keepers: Deployed[] = [];
    for (let at = 0; at < 2; at++) {
      if (at === 0 || own) vaults.push(await deploy(provider, stateLoopArtifacts().Vault, { balance }));
      const vault = vaults[vaults.length - 1]!;
      const keeper = await deployContract(provider, new Contract(stateLoopArtifacts().Keeper, [], { provider }),
        { ts: [], credited: 0n } as never);
      await (keeper.sc as any).reg(vault.lock).send();
      (keeper.sc as any).registerExternalArray('IVault', [vault.sc], [row.method]);
      keepers.push(keeper);
    }
    const call = (keeper: Deployed) => (): Promise<unknown> => (keeper.sc as any)[row.entry](AMOUNT).send();
    return { provider, vaults, keepers, call };
  };
  const digestAt = (method: string, reader: number): Uint8Array => callRecordDigest(
    abiOf(stateLoopArtifacts().Vault, method), [AMOUNT], {}, 0, reader,
  )!;

  it.each(ROWS)('settles a $kind call honestly, its record naming the caller', async (row) => {
    const { provider, vaults: [vault], keepers: [keeper], call } = await setupKeepers(row);
    const tx = await capture(provider, call(keeper!));
    const record = outputWith(tx, '51', vault!.category);
    const caller = inputOfCoin(await coinsOf(provider, tx), keeper!.category, 'minting');
    expect(binToHex(tx.outputs[record]!.token!.nft!.commitment.slice(0, 31))).toBe(binToHex(digestAt(row.method, caller)));
    await call(keeper!)();
    expect((await keeper!.sc.getState()).credited).toBe(AMOUNT);
    expect((await vault!.sc.getState()).balance).toBe(BALANCE - AMOUNT);
  }, 300_000);

  it.each(ROWS)('settles two $kind callers merged into one transaction, each with a callee of its own', async (row) => {
    const { provider, vaults: [first, second], keepers: [k1, k2], call } = await setupKeepers(row, true);
    const a = await capture(provider, call(k1!));
    const b = await capture(provider, call(k2!));
    const runs = new Map([[k2!.category, abiOf(stateLoopArtifacts().Keeper, row.entry)],
      [second!.category, abiOf(stateLoopArtifacts().Vault, row.method)]]);
    const { tx, inputOf } = await merge(provider, a, b, runs);
    // K2 moved: its callee's record names the input it now reads at.
    const record = outputWith(tx, '51', second!.category);
    const reader = inputOf(inputOfCoin(await coinsOf(provider, b), k2!.category, 'minting'));
    if (record >= 0) setDigest(tx.outputs[record]!, digestAt(row.method, reader));
    expect(await outcomeOf(provider, tx)).toBe('ACCEPTED');
    for (const keeper of [k1!, k2!]) expect((await keeper.sc.getState()).credited).toBe(AMOUNT);
    for (const vault of [first!, second!]) expect((await vault.sc.getState()).balance).toBe(BALANCE - AMOUNT);
  }, 300_000);

  it.each(ROWS)('refuses two callers sharing one run of a $kind call', async (row) => {
    const { provider, vaults: [vault], keepers: [k1, k2], call } = await setupKeepers(row);
    const a = await capture(provider, call(k1!));
    const b = await capture(provider, call(k2!));
    const { tx, inputOf } = await merge(
      provider, a, b, new Map([[k2!.category, abiOf(stateLoopArtifacts().Keeper, row.entry)]]), vault!.category,
    );
    const second = inputOf(inputOfCoin(await coinsOf(provider, b), k2!.category, 'minting'));
    const outcome = await outcomeOf(provider, tx);
    expect(outcome).not.toBe('ACCEPTED');
    expect(outcome).toContain('mandatory-script-verify-flag-failed');
    expect(outcome).toContain(`error in evaluating input index ${second}:`);
    expect((await k2!.sc.getState()).credited).toBe(0n);
    expect((await vault!.sc.getState()).balance).toBe(BALANCE);
  }, 300_000);

  it('refuses a returning call\'s record minted in a category other than its callee\'s', async () => {
    // The vault pins its record of withdraw(30) at another output; where the keeper reads, a record of the same digest
    // names 1,000 in a category minted beside it, and the keeper's outputs credit 1,000, as an honest pullAll(1000) does.
    const { provider, vaults: [vault], keepers: [keeper], call } = await setupKeepers(ROWS[1], false, 2000n);
    const tx = await capture(provider, call(keeper!));
    const rich = await capture(provider, () => (keeper!.sc as any).pullAll(1000n).send());
    tx.outputs.forEach((output, at) => {
      if (ofCategory(output.token?.category, keeper!.category)) tx.outputs[at] = rich.outputs[at]!;
    });
    expect(tx.outputs.filter((output, at) => ofCategory(output.token?.category, keeper!.category)
      && ofCategory(rich.outputs[at]?.token?.category, keeper!.category)).length).toBeGreaterThan(0);
    const read = outputWith(tx, '51', vault!.category);
    const honest = tx.outputs[read]!;
    const commitment = honest.token!.nft!.commitment;
    expect(binToHex(commitment.slice(31))).toBe(binToHex(Uint8Array.of(1, ...encodeDataPush(bigIntToVmNumber(AMOUNT)))));
    const minter = await funderCoin(provider, 2000n);
    tx.inputs.push(minter);
    const moved = tx.outputs.length;
    tx.outputs.push(honest);
    tx.outputs[read] = {
      lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 1000n,
      token: { category: minter.outpointTransactionHash, amount: 0n, nft: {
        capability: 'none', commitment: Uint8Array.of(...commitment.slice(0, 32), ...encodeDataPush(bigIntToVmNumber(1000n))),
      } },
    } as TxOutput;
    const coins = await coinsOf(provider, tx);
    const callee = inputOfCoin(coins, vault!.category, 'minting');
    tx.inputs[callee]!.unlockingBytecode = moveMaster(tx.inputs[callee]!.unlockingBytecode,
      abiOf(stateLoopArtifacts().Vault, 'withdraw'), (index) => index, (index) => (index === read ? moved : index));
    const caller = inputOfCoin(coins, keeper!.category, 'minting');
    const outcome = await outcomeOf(provider, tx);
    expect(outcome).not.toBe('ACCEPTED');
    expect(outcome).toContain(`error in evaluating input index ${caller}:`);
    expect((await keeper!.sc.getState()).credited).toBe(0n);
    expect((await vault!.sc.getState()).balance).toBe(2000n);
  }, 300_000);
});

// A proxy whose fallback delegates its call to the implementation the spend names (NestedCalleeOtherPathsGuard).
const FALLBACK_PROXY = `pragma solidcash >=0.8.0;
contract Proxy() {
  int credited;
  function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
  fallback(bytes input) external {
    address impl = address(0x76a91489abcdefabbaabbaabbaabbaabbaabbaabbaabba88ac);
    impl.delegatecall(input);
    require(input.length > 0);
  }
}`;

interface Proxied {
  readonly provider: Provider;
  readonly vault: Deployed;
  /** The category of the implementation's master, whose input runs the code that makes the call. */
  readonly implementation: string;
  readonly call: (shape: Shape) => () => Promise<unknown>;
  readonly credited: () => Promise<bigint>;
}

/** Account behind the SDK's default proxy, its entries reached through `__forward`. */
async function defaultProxied(): Promise<Proxied> {
  const provider = createTestProvider();
  const signer = new Signer(new Uint8Array(32).fill(0x5b), provider);
  for (let index = 0; index < 6; index += 1) await addProvenUtxo(provider, signer.getAddress());
  const vault = await deploy(provider, artifacts().Vault, { balance: BALANCE });
  const proxy = await upgrades.deployProxy(getContractFactory(artifacts().Account, signer), { credited: 0n }) as any;
  for (const iface of ['IVault', 'ISpend']) proxy.implementation._registerResolvedExternal(iface, vault.sc);
  return {
    provider,
    vault,
    implementation: proxy.implementation.categoryId,
    call: (shape) => () => proxy.forward(shape.entry, [vault.lock, AMOUNT]).send(),
    credited: async () => (await proxy.proxy.getState()).credited as bigint,
  };
}

/** Account as the delegate of a proxy whose fallback delegates to it. */
async function fallbackProxied(): Promise<Proxied> {
  const provider = createTestProvider();
  const vault = await deploy(provider, artifacts().Vault, { balance: BALANCE });
  const impl = await deployContract(
    provider, new Contract(artifacts().Account, [], { provider }).asDelegate(), { credited: 0n },
  );
  const proxy = await deploy(provider, compileString(FALLBACK_PROXY, { allowUnsafeOperations: true }) as Artifact, {
    credited: 0n,
  });
  for (const iface of ['IVault', 'ISpend']) (impl.sc as any)._registerResolvedExternal(iface, vault.sc);
  return {
    provider,
    vault,
    implementation: impl.category,
    call: (shape) => () => (proxy.sc.call as any).__fallback()
      .withDelegatecall(impl.sc, shape.entry, [vault.lock, AMOUNT]).send(),
    credited: async () => (await proxy.sc.getState()).credited as bigint,
  };
}

describe.each([
  { proxy: 'the default proxy\'s __forward', setup: defaultProxied },
  { proxy: 'a proxy\'s fallback', setup: fallbackProxied },
])('a call an implementation makes behind $proxy', ({ setup }) => {
  it.each(SHAPES)('names the implementation\'s input in a $kind call, which settles', async (shape) => {
    const { provider, vault, implementation, call, credited } = await setup();
    const tx = await capture(provider, call(shape));
    const reader = inputOfCoin(await coinsOf(provider, tx), implementation, 'minting');
    expect(reader).toBeGreaterThanOrEqual(0);
    const record = tx.outputs[outputWith(tx, '51', vault.category)]!;
    expect(binToHex(record.token!.nft!.commitment.slice(0, 31))).toBe(binToHex(digestFor(shape.method, reader)));

    await call(shape)();
    expect(await credited()).toBe(AMOUNT);
    expect((await vault.sc.getState()).balance).toBe(BALANCE - AMOUNT);
  }, 300_000);
});

// Calls whose method or receiver is chosen when they run: through a function pointer whose target a ternary picks,
// and through a ternary target.
const CHOOSER_SOURCE = `pragma solidcash >=0.8.0;
interface IVault {
  function withdraw(int amount) external returns (int);
  function spend(int amount) external;
}
contract Vault() {
  int balance;
  function withdraw(int amount) public returns (int) {
    require(amount <= this.balance);
    this.balance = this.balance - amount;
    return amount;
  }
  function spend(int amount) public {
    require(amount <= this.balance);
    this.balance = this.balance - amount;
  }
}
contract Chooser() {
  int credited;
  function pullEither(bool first, address a, address b, int amount) public {
    function(int) external returns (int) f = first ? IVault(a).withdraw : IVault(b).withdraw;
    this.credited = this.credited + f(amount);
  }
  function payEither(bool first, address a, address b, int amount) public {
    function(int) external f = first ? IVault(a).spend : IVault(b).spend;
    f(amount);
    this.credited = this.credited + amount;
  }
  function pullTernary(bool first, address a, address b, int amount) public {
    this.credited = this.credited + IVault(first ? a : b).withdraw(amount);
  }
}`;

let chooserCompiled: Record<string, Artifact> | undefined;
const chooserArtifacts = (): Record<string, Artifact> => {
  chooserCompiled ??= compileStringMulti(CHOOSER_SOURCE) as Record<string, Artifact>;
  return chooserCompiled;
};

describe('a call whose method or receiver is chosen when it runs', () => {
  // A pointer's caller digests its callee's record with the selector it picks, its reader and its arguments, and a
  // void pointer reads the void record; a call through a ternary target names a fixed method. Each record names the
  // caller's input.
  it.each([
    { kind: 'returning pointer', entry: 'pullEither', method: 'withdraw' },
    { kind: 'void pointer', entry: 'payEither', method: 'spend' },
    { kind: 'ternary-target', entry: 'pullTernary', method: 'withdraw' },
  ] as const)('settles a $kind call honestly', async (row) => {
    const provider = createTestProvider();
    const vault = await deploy(provider, chooserArtifacts().Vault, { balance: BALANCE });
    const other = await deploy(provider, chooserArtifacts().Vault, { balance: BALANCE });
    const chooser = await deploy(provider, chooserArtifacts().Chooser, { credited: 0n });
    const call = (): Promise<unknown> => (chooser.sc as any)[row.entry](true, vault.lock, other.lock, AMOUNT)
      .withExternalCall(vault.sc, row.method, [AMOUNT]).send();
    const tx = await capture(provider, call);
    const record = outputWith(tx, '51', vault.category);
    const caller = inputOfCoin(await coinsOf(provider, tx), chooser.category, 'minting');
    expect(caller).toBeGreaterThanOrEqual(0);
    const digest = callRecordDigest(abiOf(chooserArtifacts().Vault, row.method), [AMOUNT], {}, 0, caller)!;
    expect(binToHex(tx.outputs[record]!.token!.nft!.commitment.slice(0, 31))).toBe(binToHex(digest));

    await call();
    expect((await chooser.sc.getState()).credited).toBe(AMOUNT);
    expect((await vault.sc.getState()).balance).toBe(BALANCE - AMOUNT);
    expect((await other.sc.getState()).balance).toBe(BALANCE);
  }, 300_000);

  // Two choosers make one pointer call each, merged into one transaction where the vault runs once. Before the
  // pointer's caller digested the record, both took that run, each credited for one withdrawal (VM-confirmed).
  it.each([
    { kind: 'returning pointer', entry: 'pullEither', method: 'withdraw' },
    { kind: 'void pointer', entry: 'payEither', method: 'spend' },
  ] as const)('refuses two callers sharing one run of a $kind call', async (row) => {
    const provider = createTestProvider();
    const vault = await deploy(provider, chooserArtifacts().Vault, { balance: BALANCE });
    const other = await deploy(provider, chooserArtifacts().Vault, { balance: BALANCE });
    const c1 = await deploy(provider, chooserArtifacts().Chooser, { credited: 0n });
    const c2 = await deploy(provider, chooserArtifacts().Chooser, { credited: 0n });
    const call = (chooser: Deployed) => (): Promise<unknown> => (chooser.sc as any)[row.entry](
      true, vault.lock, other.lock, AMOUNT,
    ).withExternalCall(vault.sc, row.method, [AMOUNT]).send();
    const a = await capture(provider, call(c1));
    const b = await capture(provider, call(c2));
    const { tx, inputOf } = await merge(
      provider, a, b, new Map([[c2.category, abiOf(chooserArtifacts().Chooser, row.entry)]]), vault.category,
    );
    const second = inputOf(inputOfCoin(await coinsOf(provider, b), c2.category, 'minting'));
    // The vault's one record names the first chooser's input, so the second, reading it, is refused.
    const outcome = await outcomeOf(provider, tx);
    expect(outcome).not.toBe('ACCEPTED');
    expect(outcome).toContain('mandatory-script-verify-flag-failed');
    expect(outcome).toContain(`error in evaluating input index ${second}:`);
    expect((await c2.sc.getState()).credited).toBe(0n);
    expect((await vault.sc.getState()).balance).toBe(BALANCE);
  }, 300_000);
});
