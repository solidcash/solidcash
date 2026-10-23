import { beforeAll, describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, decodeAuthenticationInstructions, encodeAuthenticationInstruction, encodeDataPush,
  encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin, vmNumberToBigInt,
} from '@bitauth/libauth';
import {
  INDEX_NONE, computeFunctionSelector, computeFunctionSignature, concatBytes, decodeTranscript, decodeWitnessBlock,
  encodeTranscript, encodeWitnessBlock, sha256, splitFirstPush, type Artifact, type WitnessBlock,
} from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { satoshiContainerLockingBytecode } from '../../../src/framed/deploy/index.js';
import { callFramedEntry, sendFramedValue, type FramedCallResult } from '../../../src/framed/call/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';
import { addressOf } from '../call/value-harness.js';

/**
 * A payment to a contract made without the recipient's master (spec section 9, T35).
 *
 * A value send to a lock that is not a user's is a `CALL` into the recipient's `receive()` carrying the amount
 * (spec 4b): the sender's own code chooses by the lock's length, and the recipient's master takes the value into
 * its containers. The accepted spend is derived through the shipped deployment, composer and machine; each case
 * changes one thing about it and names the input that refuses:
 *
 * - (a) the payment as a plain output listed as a send, the recipient's frame and the call record left out;
 * - (b) the same with the call record kept and the recipient's master left out;
 * - (c) a send listed to a P2SH32 lock where the body's code makes the call;
 * - (d) value reaching a contract's address while another contract's `receive()`, another body, or no validator
 *   runs beside it.
 *
 * Leaving an input out drops the output that recreates it and moves every later index down, in every block and
 * in the transcript, so each case is a whole transaction a builder could assemble.
 */

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Payer {'
  + '   int public paid;'
  + '   receive() external payable { require(true); }'
  + '   function pay(bytes to, int amount) { this.paid = this.paid + amount; this.transfer(to, amount); }'
  + ' }'
  + ' contract Vault {'
  + '   int public received;'
  + '   receive() external payable { this.received = this.received + msg.value; }'
  + '   function deposit() payable { this.received = this.received + msg.value; }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const AMOUNT = 7_000n;
const DEPOSIT = 20_000n;
const RECEIVE_SELECTOR = computeFunctionSelector(computeFunctionSignature('__receive', []));
const DEPOSIT_SELECTOR = hexToBin(artifacts.Vault!.abi.find((row) => row.name === 'deposit')!.selector!);

type VmProgram = Parameters<ReturnType<typeof compositionMachine>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmSourceOutput = VmProgram['sourceOutputs'][number];
type VmOutput = VmTransaction['outputs'][number];

/** A txid of distinct bytes, named by what it funds. */
const txidOf = (label: string): string => binToHex(sha256(utf8ToBin(label)));

/** One spend: the transaction, the outputs its inputs spend, and where each participant sits. */
interface Spend {
  readonly transaction: VmTransaction;
  readonly sourceOutputs: readonly VmSourceOutput[];
  readonly participants: readonly { readonly id: string; readonly index: number }[];
}

interface Payment {
  readonly spend: Spend;
  readonly result: FramedCallResult;
  readonly payerCategory: string;
  readonly vaultCategory: string;
}

/** The payment to the first vault, and the same payment to the second from the same chain state. */
let payments: { readonly first: Payment; readonly second: Payment } | undefined;

async function deployOn(provider: MockNetworkProvider, artifact: Artifact, label: string): Promise<string> {
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const fundingUtxo = { txid: txidOf(label), vout: 0, satoshis: 500_000n };
  await provider.addUtxo(funder.address, fundingUtxo);
  const deployment = await deployStatefulContract(artifact, [], {
    provider, fundingUtxo, funder: funder.unlock.spend(alicePub, signature), changeAddress: funder.address,
  });
  return deployment.categoryId;
}

beforeAll(async () => {
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const payerCategory = await deployOn(provider, artifacts.Payer!, 'payer funding');
  const vaultCategories = [
    await deployOn(provider, artifacts.Vault!, 'first vault funding'),
    await deployOn(provider, artifacts.Vault!, 'second vault funding'),
  ];
  const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
  await provider.addUtxo(binToHex(callerLock), { txid: txidOf('caller coin'), vout: 0, satoshis: 300_000n });
  await fundShippedFacets(provider);
  const caller = async (): Promise<Parameters<typeof sendFramedValue>[0]> => {
    const coins = (await provider.getUtxosForLockingBytecode(callerLock))
      .filter((utxo) => utxo.token === undefined)
      .sort((left, right) => (left.satoshis > right.satoshis ? -1 : 1));
    return {
      provider, artifact: artifacts.Payer!, categoryId: payerCategory, callerUtxo: coins[0]!,
      callerLockingBytecode: callerLock, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      vm: compositionMachine(), value: 0n,
    };
  };
  await sendFramedValue({ ...(await caller()), value: DEPOSIT });
  const snapshot = await provider.takeSnapshot();
  const pay = async (vaultCategory: string): Promise<Payment> => {
    await snapshot.restore();
    const result = await callFramedEntry({
      ...(await caller()),
      functionName: 'pay',
      args: [addressOf(artifacts.Vault!, vaultCategory), AMOUNT],
      externals: { Vault: { artifact: artifacts.Vault!, categoryId: vaultCategory } },
    });
    const spend: Spend = {
      transaction: structuredClone(result.transaction) as VmTransaction,
      sourceOutputs: result.sourceOutputs,
      participants: result.verdicts.map((verdict) => ({ id: verdict.id, index: verdict.index })),
    };
    return { spend, result, payerCategory, vaultCategory };
  };
  payments = { first: await pay(vaultCategories[0]!), second: await pay(vaultCategories[1]!) };
});

function payment(which: 'first' | 'second' = 'first'): Payment {
  if (payments === undefined) throw new Error('the payments were not composed');
  return payments[which];
}

const PAYER = 'master';
const VALIDATOR = 'validator';
const VALIDATOR_FACET = 'validator/1';
const RECIPIENT = 'receive-0';
const RECIPIENT_RECORD = 'receive-0-record-0';
/** The participants whose first push is a witness block. */
const MASTERS = [PAYER, RECIPIENT];

function indexIn(spend: Spend, id: string): number {
  const placed = spend.participants.find((candidate) => candidate.id === id);
  if (placed === undefined) throw new Error(`no participant "${id}"`);
  return placed.index;
}

/** The output index paying `lock`, which the case expects exactly once. */
function outputPaying(transaction: VmTransaction, lock: Uint8Array): number {
  const matches = transaction.outputs.flatMap((output, index) =>
    (binToHex(output.lockingBytecode) === binToHex(lock) ? [index] : []));
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

interface Change {
  /** Participants the spend leaves out, each with the output that recreated it. */
  readonly leaveOut?: readonly string[];
  /** Edits the outputs, the inputs already left out; an output it adds goes past every one a block names. */
  readonly transaction?: (transaction: VmTransaction) => void;
  /** Edits a master's block, re-pointed at the transaction the edit above left. */
  readonly block?: (id: string, block: WitnessBlock, transaction: VmTransaction) => void;
}

/** The spend with one change applied, every index re-pointed past the inputs it leaves out. */
function changed(spend: Spend, change: Change): Spend {
  const gone = (change.leaveOut ?? []).map((id) => indexIn(spend, id)).sort((left, right) => left - right);
  const moved = (index: number): number => {
    if (index === INDEX_NONE) return index;
    if (gone.includes(index)) return INDEX_NONE;
    return index - gone.filter((left) => left < index).length;
  };
  const participants = spend.participants
    .filter((placed) => !gone.includes(placed.index))
    .map((placed) => ({ id: placed.id, index: moved(placed.index) }));
  const transaction = structuredClone(spend.transaction) as VmTransaction;
  const sourceOutputs = [...spend.sourceOutputs];
  // Highest first, so each index still names its own input and the output that recreates it.
  for (const index of [...gone].reverse()) {
    transaction.inputs.splice(index, 1);
    transaction.outputs.splice(index, 1);
    sourceOutputs.splice(index, 1);
  }
  change.transaction?.(transaction);
  for (const placed of participants) {
    if (placed.id === VALIDATOR_FACET) continue;
    if (!MASTERS.includes(placed.id) && placed.id !== VALIDATOR) {
      // A record or a container: its first push names the input of the master that spends it.
      const unlocking = transaction.inputs[placed.index]!.unlockingBytecode;
      const [first] = decodeAuthenticationInstructions(unlocking);
      const opcode = first!.opcode;
      const master = opcode === 0 ? 0 : opcode >= 0x51 && opcode <= 0x60 ? opcode - 0x50
        : Number(vmNumberToBigInt((first as { readonly data: Uint8Array }).data));
      transaction.inputs[placed.index] = {
        ...transaction.inputs[placed.index]!,
        unlockingBytecode: concatBytes([
          encodeDataPush(bigIntToVmNumber(BigInt(moved(master)))),
          unlocking.slice(encodeAuthenticationInstruction(first!).length),
        ]),
      };
      continue;
    }
    const { payload, rest } = splitFirstPush(transaction.inputs[placed.index]!.unlockingBytecode);
    let first: Uint8Array;
    if (placed.id === VALIDATOR) {
      const transcript = decodeTranscript(payload);
      transcript.roots = transcript.roots.map(moved).filter((index) => index !== INDEX_NONE);
      transcript.masters = transcript.masters.map(moved).filter((index) => index !== INDEX_NONE);
      transcript.settles = transcript.settles.map((settled) => ({
        ...settled,
        stateInputs: settled.stateInputs.map(moved).filter((index) => index !== INDEX_NONE),
        createdOutputs: (settled.createdOutputs ?? []).map(moved),
      }));
      first = encodeTranscript(transcript);
    } else {
      const block = decodeWitnessBlock(payload);
      block.callerRef = moved(block.callerRef);
      block.originRef = moved(block.originRef);
      block.validatorRef = moved(block.validatorRef);
      block.calls = block.calls.map((call) => ({ ...call, calleeRef: moved(call.calleeRef) }));
      block.segments = block.segments.map((segment) =>
        segment.map((entry) => ({ ...entry, in: moved(entry.in), out: moved(entry.out) })));
      block.events = block.events.map(moved);
      block.sends = block.sends.map(moved);
      change.block?.(placed.id, block, transaction);
      first = encodeWitnessBlock(block);
    }
    transaction.inputs[placed.index] = {
      ...transaction.inputs[placed.index]!, unlockingBytecode: concatBytes([encodeDataPush(first), rest]),
    };
  }
  return { transaction, sourceOutputs, participants };
}

/** The machine's objection at one input, or undefined when it accepts. */
function objectionAt(spend: Spend, inputIndex: number): string | undefined {
  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex, sourceOutputs: [...spend.sourceOutputs], transaction: spend.transaction });
  return vm.stateSuccess(state) === true ? undefined : String((state as { readonly error?: unknown }).error);
}

/**
 * Every participant's objection, or undefined where it accepts. The validator is its head and its facet, so its
 * verdict is both inputs': the head checks the input that runs it, and the facet the rest.
 */
function objections(spend: Spend): Record<string, string | undefined> {
  const verdict: Record<string, string | undefined> = {};
  for (const placed of spend.participants) {
    const id = placed.id === VALIDATOR_FACET ? VALIDATOR : placed.id;
    verdict[id] ??= objectionAt(spend, placed.index);
  }
  return verdict;
}

/** Every participant's verdict on the BCH-2026 machine: true when its input is accepted. */
function verdicts(spend: Spend): Record<string, boolean> {
  return Object.fromEntries(Object.entries(objections(spend)).map(([id, objection]) => [id, objection === undefined]));
}

const vaultAddress = (which: 'first' | 'second' = 'first'): Uint8Array =>
  addressOf(artifacts.Vault!, payment(which).vaultCategory);
const vaultContainer = (which: 'first' | 'second' = 'first'): Uint8Array =>
  satoshiContainerLockingBytecode(payment(which).vaultCategory);

/** Replaces the recipient's container output with a plain output of the same value at the recipient's address. */
function paidToAddress(transaction: VmTransaction): void {
  transaction.outputs[outputPaying(transaction, vaultContainer())] =
    { lockingBytecode: vaultAddress(), valueSatoshis: AMOUNT } as VmOutput;
}

describe('a payment to a contract, composed through the shipped path', () => {
  it('is accepted at every input, the recipient\'s receive() taking the value into its container', () => {
    const { spend, result } = payment();
    expect(result.accepted).toBe(true);
    expect(Object.values(verdicts(spend)).every(Boolean)).toBe(true);
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual(['Vault.__receive()', 'Payer.pay()']);
    // The payer's block lists no send: the value is its call record's, into the recipient's master.
    const block = result.draft.blockOf(PAYER);
    expect(block.sends).toStrictEqual([]);
    expect(block.calls).toHaveLength(1);
    expect(block.calls[0]!.value).toBe(AMOUNT);
    expect(binToHex(block.calls[0]!.target)).toBe(binToHex(vaultAddress()));
    expect(block.calls[0]!.calleeRef).toBe(indexIn(spend, RECIPIENT));
    expect(binToHex(block.calls[0]!.argsHash)).toBe(binToHex(sha256(RECEIVE_SELECTOR)));
    expect(spend.transaction.outputs[outputPaying(spend.transaction, vaultContainer())]!.valueSatoshis).toBe(AMOUNT);
  });

  it('is accepted unchanged through the rebuild the cases use, so the rebuild is not what refuses', () => {
    expect(Object.values(verdicts(changed(payment().spend, {}))).every(Boolean)).toBe(true);
  });
});

/** The payer's block with its call record and the segment after it left out. */
function withoutCall(block: WitnessBlock): void {
  block.calls = [];
  block.segments = [block.segments[0]!];
}

/** Every participant but `refusing` accepts, and each of `refusing` refuses. */
function refusedBy(spend: Spend, ...refusing: string[]): void {
  const report = verdicts(spend);
  expect(report).toStrictEqual(Object.fromEntries(Object.keys(report).map((id) => [id, !refusing.includes(id)])));
}

describe('a payment to a contract made without the recipient\'s master (T35)', () => {
  /** The payment as a plain output at the recipient's address, listed as the payer's send. */
  const listedAtAddress = (block: WitnessBlock, transaction: VmTransaction): void => {
    block.sends = [outputPaying(transaction, vaultAddress())];
  };
  /** Leaves the recipient out, and with `alone` the validator too, so the payer claims to stand alone. */
  const leftOut = (alone: boolean): string[] =>
    [RECIPIENT, RECIPIENT_RECORD, ...(alone ? [VALIDATOR, VALIDATOR_FACET] : [])];

  it('(a) is refused by the payer as a plain output listed as a send, the frame and the call record left out', () => {
    for (const alone of [false, true]) {
      const spend = changed(payment().spend, {
        leaveOut: leftOut(alone),
        transaction: (transaction) => { paidToAddress(transaction); },
        block: (id, block, transaction) => {
          if (id !== PAYER) return;
          withoutCall(block);
          listedAtAddress(block, transaction);
        },
      });
      // The body computed a 35-byte lock, so it makes a call: the block's missing record and its listed send refuse.
      refusedBy(spend, PAYER);
    }
  });

  it('(b) is refused with the call record kept and the recipient\'s master left out', () => {
    // The record is kept as composed, naming the input the recipient's master held.
    const callee = indexIn(payment().spend, RECIPIENT);
    const keepRecord = (block: WitnessBlock): void => {
      block.calls = block.calls.map((call) => ({ ...call, calleeRef: callee }));
    };
    const listed = changed(payment().spend, {
      leaveOut: leftOut(false),
      transaction: (transaction) => { paidToAddress(transaction); },
      block: (id, block, transaction) => {
        if (id !== PAYER) return;
        keepRecord(block);
        listedAtAddress(block, transaction);
      },
    });
    refusedBy(listed, PAYER, VALIDATOR);
    // The value paid into the recipient's container as composed, with no send listed: its balance grows while its
    // receive() never runs.
    const intoContainer = changed(payment().spend, {
      leaveOut: leftOut(false),
      block: (id, block) => { if (id === PAYER) keepRecord(block); },
    });
    refusedBy(intoContainer, PAYER, VALIDATOR);
    // With no validator either, the payer is the one input left to refuse.
    const alone = changed(payment().spend, {
      leaveOut: leftOut(true),
      transaction: (transaction) => { paidToAddress(transaction); },
      block: (id, block, transaction) => {
        if (id !== PAYER) return;
        keepRecord(block);
        listedAtAddress(block, transaction);
      },
    });
    refusedBy(alone, PAYER);
  });

  it('(c) is refused by the payer when a send is listed to a P2SH32 lock its body pays through a call', () => {
    // The recipient's own container, the output its master grows, listed as the payer's send as well.
    const container = changed(payment().spend, {
      block: (id, block, transaction) => {
        if (id === PAYER) block.sends = [outputPaying(transaction, vaultContainer())];
      },
    });
    refusedBy(container, PAYER);
    // A second payment to the recipient's address, right after the payer's container and paid from the change.
    const doubled = changed(payment().spend, {
      transaction: (transaction) => {
        const changeIndex = transaction.outputs.length - 1;
        const change = transaction.outputs[changeIndex]!;
        transaction.outputs[changeIndex] = { ...change, valueSatoshis: change.valueSatoshis - AMOUNT };
        const payerContainer = outputPaying(transaction, satoshiContainerLockingBytecode(payment().payerCategory));
        transaction.outputs.splice(payerContainer + 1, 0, { lockingBytecode: vaultAddress(), valueSatoshis: AMOUNT });
      },
      block: (id, block, transaction) => { if (id === PAYER) listedAtAddress(block, transaction); },
    });
    refusedBy(doubled, PAYER);
  });

  it('(d) is refused by the validator when another contract\'s receive() takes the payment the body named', () => {
    const first = payment('first').spend;
    const second = payment('second').spend;
    expect(second.participants).toStrictEqual(first.participants);
    const transaction = structuredClone(first.transaction) as VmTransaction;
    const sourceOutputs = [...first.sourceOutputs];
    for (const id of [RECIPIENT, RECIPIENT_RECORD]) {
      const index = indexIn(first, id);
      transaction.inputs[index] = second.transaction.inputs[index]!;
      transaction.outputs[index] = second.transaction.outputs[index]!;
      sourceOutputs[index] = second.sourceOutputs[index]!;
    }
    transaction.outputs[outputPaying(transaction, vaultContainer('first'))] =
      second.transaction.outputs[outputPaying(second.transaction, vaultContainer('second'))]!;
    // Each master accepts its own frame: the payer's call data reaches a receive(), and the second vault's frame is
    // the one its own composition derived. The record's target is the first vault, so only the validator refuses.
    refusedBy({ transaction, sourceOutputs, participants: first.participants }, VALIDATOR);
  });

  it('(d) is refused by the payer and the validator when another payable body takes the value', () => {
    const spend = payment().spend;
    const index = indexIn(spend, RECIPIENT);
    const { payload, rest } = splitFirstPush(spend.transaction.inputs[index]!.unlockingBytecode);
    const { payload: selector, rest: redeem } = splitFirstPush(rest);
    expect(binToHex(selector)).toBe(binToHex(RECEIVE_SELECTOR));
    const transaction = structuredClone(spend.transaction) as VmTransaction;
    transaction.inputs[index] = {
      ...transaction.inputs[index]!,
      unlockingBytecode: concatBytes([encodeDataPush(payload), encodeDataPush(DEPOSIT_SELECTOR), redeem]),
    };
    // The recipient runs `deposit()`, which books the value as receive() would, so its own frame accepts.
    refusedBy({ ...spend, transaction }, PAYER, VALIDATOR);
  });

  it('(d) is refused by the recipient when its receive() runs but its container receives less than the value', () => {
    const spend = changed(payment().spend, {
      transaction: (transaction) => {
        const index = outputPaying(transaction, vaultContainer());
        transaction.outputs[index] = { ...transaction.outputs[index]!, valueSatoshis: AMOUNT - 1_000n };
        const changeIndex = transaction.outputs.length - 1;
        const change = transaction.outputs[changeIndex]!;
        transaction.outputs[changeIndex] = { ...change, valueSatoshis: change.valueSatoshis + 1_000n };
      },
    });
    refusedBy(spend, RECIPIENT);
  });

  it('(d) is refused by the payer when it claims to stand alone while it makes the call', () => {
    // The head's call count does not cover a value call, and with no validator nothing binds the callee to a master
    // of the named contract (V5, V11), so the payer's own call site refuses. Without that check the payer accepts.
    const spend = changed(payment().spend, { leaveOut: [VALIDATOR, VALIDATOR_FACET] });
    // The recipient's master refuses as well: a CALL frame needs a validator.
    refusedBy(spend, PAYER, RECIPIENT);
  });
});
