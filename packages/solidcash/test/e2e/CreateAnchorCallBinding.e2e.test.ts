import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, decodeAuthenticationInstructions, decodeTransactionUnsafe, encodeAuthenticationInstructions,
  encodeDataPush, encodeTransaction, hexToBin, vmNumberToBigInt,
} from '@bitauth/libauth';
import {
  CALL_RECORD_NO_READER, CALL_RECORD_READER_INPUT, encodePushdataValue, type AbiFunction, type Artifact,
} from '@solidcash/utils';
import { compileStringMulti } from '../direct-compile.js';
import { Contract, Signer } from '../../src/index.js';
import {
  StatefulContract, createLogicalIdentityUnlocker, deriveLogicalCreateAddress, encodeLogicalIdentityCommitment,
  resolveLogicalIdentity,
} from '../../src/stateful/index.js';
import { callRecordDigest } from '../../src/stateful/call-record.js';
import { addressToLockScript, solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * A call whose target names a CREATE identity takes the anchor branch of its caller's co-spend check
 * (`__internal__extcallAnchorIdx<n>` >= 0): the co-spent SCID anchor is locked at the target, names the master's lock
 * as its root and shares its category. A raw call digests no record of its callee, so on either branch the reader
 * pin (emitRawCalleeReaderPin) is what binds the callee's one run to one caller. A typed call reads its callee's
 * record by the digest of its method, its reader and its arguments instead.
 *
 * The vault's genesis mints its anchor as a CREATE deployment does. A caller names the vault by its logical lock and
 * the co-spent anchor. For a shared run, two honest builds are merged into one transaction where the vault runs once
 * (CallRecordSingleReader.e2e.test.ts).
 */

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

const AMOUNT = 30n;
const BALANCE = 100n;
const ANCHOR = '__internal__extcallAnchorIdx0';

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;
type TxInput = Tx['inputs'][number];
type TxOutput = Tx['outputs'][number];
type Instruction = { opcode: number; data?: Uint8Array };
type Params = Parameters<typeof callRecordDigest>[1];
interface Coin {
  readonly satoshis: bigint;
  readonly token?: { readonly category: string; readonly nft?: { readonly capability: string } };
}

let rawCompiled: Record<string, Artifact> | undefined;
const rawArtifacts = (): Record<string, Artifact> => {
  rawCompiled ??= compileStringMulti(RAW_SOURCE) as Record<string, Artifact>;
  return rawCompiled;
};
const abiOf = (artifact: Artifact, name: string): AbiFunction => artifact.abi.find((entry) => entry.name === name)!;

interface Deployed { readonly sc: StatefulContract<any>; readonly category: string; readonly lock: Uint8Array }

/** A vault whose genesis also minted its CREATE identity anchor, as a Signer's ContractFactory deployment does. */
interface IdentifiedVault extends Deployed {
  readonly logicalLock: Uint8Array;
  readonly anchor: { readonly txid: string; readonly vout: number; readonly satoshis: bigint; readonly commitment: string };
  readonly anchorUnlocking: Uint8Array;
}

async function deployCaller(provider: Provider, artifact: Artifact): Promise<Deployed> {
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(provider, contract, artifact.stateLayout!, { credited: 0n });
  return {
    sc: StatefulContract.withCategory(contract, categoryId),
    category: categoryId,
    lock: hexToBin(contract.withCategory(hexToBin(categoryId)).lockingBytecode),
  };
}

async function deployIdentifiedVault(provider: Provider, artifact: Artifact): Promise<IdentifiedVault> {
  const deployer = new Signer(new Uint8Array(32).fill(0x5c), provider).getAddress();
  const logicalAddress = deriveLogicalCreateAddress(deployer, 0n);
  const contract = new Contract(artifact, [], { provider });
  const physicalLock = (category: string): Uint8Array => (
    hexToBin(contract.withCategory(hexToBin(category)).lockingBytecode));
  const setup = await setupStatefulUtxos(provider, contract, artifact.stateLayout!, { balance: BALANCE }, {
    extraOutputs: (category) => [{
      address: logicalAddress,
      satoshis: 1200n,
      token: {
        amount: 0n,
        nft: {
          capability: 'none',
          commitment: encodeLogicalIdentityCommitment({
            deployerLockingBytecode: addressToLockScript(deployer), nonce: 0n, rootLockingBytecode: physicalLock(category),
          }),
        },
      },
    }],
  });
  const lock = physicalLock(setup.categoryId);
  // The SDK resolves it as the vault's one authenticated identity.
  const identity = await resolveLogicalIdentity(provider, logicalAddress);
  expect(identity.categoryId).toBe(setup.categoryId);
  expect(binToHex(identity.rootLockingBytecode)).toBe(binToHex(lock));
  const anchor = setup.extraUtxos![0]!;
  return {
    sc: StatefulContract.withCategory(contract, setup.categoryId),
    category: setup.categoryId,
    lock,
    logicalLock: addressToLockScript(logicalAddress),
    anchor: { txid: anchor.txid, vout: anchor.vout, satoshis: anchor.satoshis, commitment: anchor.token!.nft!.commitment },
    anchorUnlocking: createLogicalIdentityUnlocker(deployer, 0n).generateUnlockingBytecode({} as never),
  };
}

const rawCall = (caller: Deployed, vault: Deployed) => (): Promise<unknown> => (caller.sc as any)
  .pullRaw(vault.lock, AMOUNT).withExternalCall(vault.sc, 'withdraw', [AMOUNT]).send();

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

/** The VM's verdict on one input of `tx`, whose coins are live. */
async function inputPasses(provider: Provider, tx: Tx, inputIndex: number): Promise<boolean> {
  const sourceOutputs = await Promise.all(tx.inputs.map(async (input) => {
    const spent = await (provider as any).getLedgerOutput(binToHex(input.outpointTransactionHash), input.outpointIndex);
    return solidCashOutputToLibauthOutput({
      to: spent.lockingBytecode, amount: spent.satoshis, ...(spent.token === undefined ? {} : { token: spent.token }),
    });
  }));
  const vm = createVirtualMachineBch2026ForProvider(provider);
  return vm.stateSuccess(vm.evaluate({ transaction: tx, sourceOutputs, inputIndex } as never) as never) === true;
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
  const txid = `a2c7${coinNonce.toString(16).padStart(60, '0')}`;
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
const READ_CHUNK_BASE = '__internal__dynamicChunkInputBase';
const INPUT_LIST = /^__internal__extcallIdxList\d*$/;
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
    if (INPUT_LIST.test(input.name)) {
      const list = (decodeAuthenticationInstructions(instructions[at]!.data ?? new Uint8Array()) as Instruction[])
        .map((element) => encodePushdataValue(BigInt(inputOf(Number(valueOf(element)))), 'bigint'));
      instructions[at] = decodeAuthenticationInstructions(encodeDataPush(Uint8Array.of(
        ...list.flatMap((element) => [...element]),
      )))[0] as Instruction;
    }
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
 * `a` with every input and output of `b` after it (CallRecordSingleReader.e2e.test.ts): the coins and outputs of
 * `shared`, a callee both spend, are `a`'s, and `b`'s witnesses naming them name `a`'s.
 */
async function merge(
  provider: Provider, a: Tx, b: Tx, runs: ReadonlyMap<string, AbiFunction>, shared: string,
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
  const sharedInput = (index: number): boolean => ofCategory(coinsB[index]!.token?.category, shared);
  const sharedOutput = (output: TxOutput): boolean => ofCategory(output.token?.category, shared);
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

/** The digest of the vault's `withdraw(AMOUNT)` read at input `reader`: a typed call's and a raw call's edge. */
const withdrawDigest = (vault: Artifact, reader: number): Uint8Array => (
  callRecordDigest(abiOf(vault, 'withdraw'), [AMOUNT], {}, 0, reader)!);

/**
 * The caller at input `caller` restamps its own void record for the vault argument `after`. Its old record must be
 * the digest of the same run with `before`, so the restamp follows the caller's own encoding. A spend no caller
 * reads names no record output (`__internal__returnOutputIdx` -1) and pins none, so there is nothing to restamp.
 */
function restampOwnRecord(
  tx: Tx, caller: number, category: string, fn: AbiFunction, before: Uint8Array, after: Uint8Array,
): void {
  const instructions = decodeAuthenticationInstructions(tx.inputs[caller]!.unlockingBytecode) as Instruction[];
  const position = fn.inputs.findIndex((input) => input.name === CALL_RECORD_READER_INPUT);
  const reader = position < 0 ? CALL_RECORD_NO_READER : valueOf(instructions[instructions.length - 2 - position]!);
  const at = outputWith(tx, '51', category);
  if (at < 0) return;
  const record = tx.outputs[at]!;
  expect(binToHex(record.token!.nft!.commitment.slice(0, 31)))
    .toBe(binToHex(callRecordDigest(fn, [before, AMOUNT] as Params, {}, 0, reader)!));
  setDigest(record, callRecordDigest(fn, [after, AMOUNT] as Params, {}, 0, reader)!);
}

/**
 * The caller at input `caller` names the vault by its CREATE identity: its `vault` argument becomes the logical lock
 * and its anchor witness the index of the vault's anchor, co-spent and recreated after every other input and output.
 */
async function nameByIdentity(
  provider: Provider, tx: Tx, caller: number, fn: AbiFunction, vault: IdentifiedVault,
): Promise<void> {
  const instructions = decodeAuthenticationInstructions(tx.inputs[caller]!.unlockingBytecode) as Instruction[];
  expect(instructions).toHaveLength(fn.inputs.length + 2);
  const at = (name: string): number => {
    const position = fn.inputs.findIndex((input) => input.name === name);
    expect(position, `${fn.name} takes ${name}`).toBeGreaterThanOrEqual(0);
    return instructions.length - 2 - position;
  };
  const target = at('vault');
  expect(binToHex(instructions[target]!.data ?? new Uint8Array())).toBe(binToHex(vault.lock));
  instructions[target] = decodeAuthenticationInstructions(encodeDataPush(vault.logicalLock))[0] as Instruction;
  const anchor = at(ANCHOR);
  expect(valueOf(instructions[anchor]!)).toBe(-1n);
  instructions[anchor] = pushOf(BigInt(tx.inputs.length));
  tx.inputs[caller] = { ...tx.inputs[caller]!, unlockingBytecode: encodeAuthenticationInstructions(instructions as any) };
  tx.inputs.push({
    outpointTransactionHash: hexToBin(vault.anchor.txid), outpointIndex: vault.anchor.vout,
    sequenceNumber: 0xffffffff, unlockingBytecode: vault.anchorUnlocking,
  });
  const category = tx.outputs.find((output) => ofCategory(output.token?.category, vault.category))!.token!.category;
  tx.outputs.push({
    lockingBytecode: vault.logicalLock,
    valueSatoshis: vault.anchor.satoshis,
    token: { amount: 0n, category, nft: { capability: 'none', commitment: hexToBin(vault.anchor.commitment) } },
  });
  // The anchor's bytes.
  tx.inputs.push(await funderCoin(provider, 4000n));
}

interface SharedRun {
  readonly provider: Provider;
  readonly tx: Tx;
  readonly second: number;
  readonly vault: IdentifiedVault;
  readonly first: Deployed;
  readonly next: Deployed;
}

/**
 * Two callers each make the call, merged into one transaction where the vault runs once for the first. The second's
 * edge names its new input. `anchored`: the second names the vault by its CREATE identity.
 */
async function sharedRun(
  artifactSet: () => Record<string, Artifact>, callerName: string, entry: string,
  call: (caller: Deployed, vault: Deployed) => () => Promise<unknown>, anchored: boolean,
): Promise<SharedRun> {
  const provider = createTestProvider();
  const vault = await deployIdentifiedVault(provider, artifactSet().Vault);
  const first = await deployCaller(provider, artifactSet()[callerName]);
  const next = await deployCaller(provider, artifactSet()[callerName]);
  const fn = abiOf(artifactSet()[callerName], entry);
  const a = await capture(provider, call(first, vault));
  const b = await capture(provider, call(next, vault));
  const { tx, inputOf } = await merge(provider, a, b, new Map([[next.category, fn]]), vault.category);
  const second = inputOf(inputOfCoin(await coinsOf(provider, b), next.category, 'minting'));
  const edge = outputWith(tx, '5161', next.category);
  if (edge >= 0) setDigest(tx.outputs[edge]!, withdrawDigest(artifactSet().Vault, second));
  if (anchored) {
    restampOwnRecord(tx, second, next.category, fn, vault.lock, vault.logicalLock);
    await nameByIdentity(provider, tx, second, fn, vault);
  }
  return { provider, tx, second, vault, first, next };
}

describe('a raw call whose callee is named by its CREATE identity', () => {
  it('refuses a second caller sharing the callee\'s one run when it names the callee by its lock', async () => {
    const { provider, tx, second, vault, next } = await sharedRun(rawArtifacts, 'Puller', 'pullRaw', rawCall, false);
    // The reader pin: the vault's run names the first caller.
    const outcome = await outcomeOf(provider, tx);
    expect(outcome).not.toBe('ACCEPTED');
    expect(outcome).toContain('mandatory-script-verify-flag-failed');
    expect(outcome).toContain(`error in evaluating input index ${second}:`);
    expect((await next.sc.getState()).credited).toBe(0n);
    expect((await vault.sc.getState()).balance).toBe(BALANCE);
  }, 300_000);

  it('refuses a second caller sharing the callee\'s one run when it names the callee by its identity', async () => {
    const { provider, tx, second, vault, first, next } = await sharedRun(
      rawArtifacts, 'Puller', 'pullRaw', rawCall, true,
    );
    const outcome = await outcomeOf(provider, tx);
    expect(outcome).not.toBe('ACCEPTED');
    expect(outcome).toContain('mandatory-script-verify-flag-failed');
    expect(outcome).toContain(`error in evaluating input index ${second}:`);
    expect((await first.sc.getState()).credited).toBe(0n);
    expect((await next.sc.getState()).credited).toBe(0n);
    expect((await vault.sc.getState()).balance).toBe(BALANCE);
  }, 300_000);

  // The caller's own check of one honest caller naming the callee by its identity: the reader pin passes. The
  // callee's input is not this test's subject, so only the caller's input is evaluated.
  it('accepts one caller that names the callee by its identity at the caller\'s input', async () => {
    const provider = createTestProvider();
    const vault = await deployIdentifiedVault(provider, rawArtifacts().Vault);
    const puller = await deployCaller(provider, rawArtifacts().Puller);
    const fn = abiOf(rawArtifacts().Puller, 'pullRaw');
    const tx = await capture(provider, rawCall(puller, vault));
    const caller = inputOfCoin(await coinsOf(provider, tx), puller.category, 'minting');
    restampOwnRecord(tx, caller, puller.category, fn, vault.lock, vault.logicalLock);
    await nameByIdentity(provider, tx, caller, fn, vault);
    expect(await inputPasses(provider, tx, caller)).toBe(true);
    // The pin still binds the run to this caller: a reader witness naming another input fails at the caller.
    const vaultInput = inputOfCoin(await coinsOf(provider, tx), vault.category, 'minting');
    const instructions = decodeAuthenticationInstructions(tx.inputs[vaultInput]!.unlockingBytecode) as Instruction[];
    // As emitRawCalleeReaderPin reads it: an optional selector push, the record witness, then the reader.
    const reader = instructions[0]!.opcode === 0x04 ? 2 : 1;
    expect(valueOf(instructions[reader]!), 'the vault names its reader').toBe(BigInt(caller));
    instructions[reader] = pushOf(BigInt(vaultInput));
    tx.inputs[vaultInput] = {
      ...tx.inputs[vaultInput]!, unlockingBytecode: encodeAuthenticationInstructions(instructions as any),
    };
    expect(await inputPasses(provider, tx, caller)).toBe(false);
  }, 300_000);
});
