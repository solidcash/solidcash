import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import {
  asmToScript, buildPushdataCommitment, buildSatoshiContainerCovenantScript, encodeArgumentList,
  encodeIntegerValue, encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress, type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, categorySlotValue, dataRecordLock, seededCategory, validatorSpend,
} from './validator-input.js';

/**
 * Value received by a framed master (spec 4b): `receive()` and payable entries, driven through the real entry.
 *
 * A frame's value is credited only when the contract's satoshi containers grow by at least that much, so the
 * cases put container outputs and inputs around a compiled master and mutate one fact at a time. A body that is
 * not payable refuses any value, a master whose frame another master of its contract shares takes none, and a
 * container is never spent for nothing.
 */

const CATEGORY = seededCategory('value receive');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const ADDRESS = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
/** The contract's container lock, built by the SDK's own covenant builder. */
const CONTAINER_LOCK = encodeLockingBytecodeP2sh32(
  hash256(scriptToBytecode(buildSatoshiContainerCovenantScript(CATEGORY))),
);

const MASTER_VALUE = 20_000n;
const AMOUNT = 10_000n;
/** A value whose sign bit is set: the script reads it as a negative number. */
const NEGATIVE_AMOUNT = (1n << 63n) + AMOUNT;

type Artifact = ReturnType<typeof compileString>;
type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

/** A contract whose only entry is `receive()`, so the master has no dispatcher. */
const RECEIVE_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Vault { receive() external payable { require(true); } }';

/** `receive()` beside a payable and a non-payable function, behind the dispatcher. */
const MIXED_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Vault {'
  + '   receive() external payable { require(true); }'
  + '   function deposit() public payable { require(msg.value > 0); }'
  + '   function ping(int x) public { require(x >= 0); }'
  + ' }';

/** No payable body at all. */
const PLAIN_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Plain { function ping(int x) public { require(x >= 0); } }';

/** `receive()` that books what it receives in a record. */
const LEDGER_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Ledger {'
  + '   int public received;'
  + '   receive() external payable { this.received = this.received + msg.value; }'
  + ' }';

const compiledBySource = new Map<string, Artifact>();
const compile = (source: string): Artifact => {
  let artifact = compiledBySource.get(source);
  if (artifact === undefined) {
    artifact = compileString(source, { composition: 'framed' });
    compiledBySource.set(source, artifact);
  }
  return artifact;
};

/** The deployed program and lock: the reserved slots filled the way deployment fills them. */
function deploy(source: string): { artifact: Artifact; program: Uint8Array; lock: Uint8Array } {
  const artifact = compile(source);
  const { placeholders } = artifact.composition!;
  const program = fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), placeholders, {
    category: categorySlotValue(CATEGORY),
    contractAddress: ADDRESS,
    ...(placeholders.templateHashOffset === undefined ? {} : { templateHash: TEMPLATE_HASH }),
  });
  return { artifact, program, lock: encodeLockingBytecodeP2sh32(hash256(program)) };
}

function token(capability: 'minting' | 'mutable', commitment: Uint8Array = new Uint8Array(0)): VmOutput['token'] {
  return { category: CATEGORY, amount: 0n, nft: { capability, commitment } };
}

/** The selector an artifact publishes for an entry. */
function selectorOf(source: string, entry: string): Uint8Array {
  return Uint8Array.from(Buffer.from(compile(source).abi.find((row) => row.name === entry)!.selector!, 'hex'));
}

/** One spend of a compiled master at input 0, the user's signed input after it. */
interface Spend {
  readonly source: string;
  readonly value: bigint;
  readonly argumentPushes?: Uint8Array;
  /** Container outputs, after the master's recreation (and the record's). */
  readonly containersOut?: readonly bigint[];
  /** Container inputs, after the user's. */
  readonly containersIn?: readonly bigint[];
  /** A record the entry reads and writes, at input and output 1. */
  readonly state?: { readonly committed: Uint8Array; readonly written: Uint8Array };
  /** A second master of the contract, and the validator the frame then names. */
  readonly validator?: { readonly secondMaster: boolean };
}

/** Builds the spend and asks the BCH-2026 machine about the master's input. */
function verdict(spend: Spend): { accepted: boolean; objection?: string } {
  const { program, lock } = deploy(spend.source);
  const record = spend.state;
  const recordCount = record === undefined ? 0 : 1;
  const userIndex = 1 + recordCount;
  const secondMasterIndex = userIndex + 1;
  const validatorIndex = spend.validator === undefined
    ? undefined
    : secondMasterIndex + (spend.validator.secondMaster ? 1 : 0);
  const block: WitnessBlock = {
    kind: 0,
    callerRef: userIndex,
    originRef: userIndex,
    validatorRef: validatorIndex ?? 0xffff,
    sender: USER_LOCK,
    self: ADDRESS,
    value: spend.value,
    retval: new Uint8Array(0),
    calls: [],
    segments: [record === undefined ? [] : [{ in: 1, out: 1, viewIn: record.committed, viewOut: record.written }]],
    events: [],
    sends: [],
  };
  const validator = validatorIndex === undefined
    ? undefined
    : validatorSpend(CATEGORY, { roots: [0], masters: [0], settles: [] });
  const input = (fill: number, unlockingBytecode: Uint8Array): VmTransaction['inputs'][number] => ({
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(fill),
    sequenceNumber: 0xffffffff,
    unlockingBytecode,
  });
  const master: VmOutput = { lockingBytecode: lock, valueSatoshis: MASTER_VALUE, token: token('minting') };
  const inputs = [
    input(1, new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(block)),
      ...(spend.argumentPushes ?? new Uint8Array(0)),
      ...encodeDataPush(program),
    ])),
    ...(record === undefined ? [] : [input(2, encodeDataPush(new Uint8Array([1])))]),
    input(3, callerUnlockingBytecode()),
    ...(spend.validator?.secondMaster === true ? [input(4, encodeDataPush(new Uint8Array([1])))] : []),
    ...(validator === undefined ? [] : [input(5, validator.unlockingBytecode)]),
    ...(spend.containersIn ?? []).map((_, index) => input(6 + index, encodeDataPush(new Uint8Array([1])))),
  ];
  const sourceOutputs: VmProgram['sourceOutputs'] = [
    master,
    ...(record === undefined
      ? []
      : [{ lockingBytecode: dataRecordLock(CATEGORY), valueSatoshis: MASTER_VALUE, token: token('mutable', record.committed) }]),
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
    ...(spend.validator?.secondMaster === true ? [master] : []),
    ...(validator === undefined
      ? []
      : [{ lockingBytecode: validator.lock, valueSatoshis: MASTER_VALUE, token: token('mutable') }]),
    ...(spend.containersIn ?? []).map((value) => ({ lockingBytecode: CONTAINER_LOCK, valueSatoshis: value })),
  ];
  // Every participant is recreated at its own index; the user's change sits at the user's, containers after them.
  const outputs: VmOutput[] = [
    master,
    ...(record === undefined
      ? []
      : [{ lockingBytecode: dataRecordLock(CATEGORY), valueSatoshis: MASTER_VALUE, token: token('mutable', record.written) }]),
    { lockingBytecode: USER_LOCK, valueSatoshis: 1_000n },
    ...(spend.validator?.secondMaster === true ? [master] : []),
    ...(validator === undefined
      ? []
      : [{ lockingBytecode: validator.lock, valueSatoshis: MASTER_VALUE, token: token('mutable') }]),
    ...(spend.containersOut ?? []).map((value) => ({ lockingBytecode: CONTAINER_LOCK, valueSatoshis: value })),
  ];
  const transaction: VmTransaction = { version: 2, inputs, outputs, locktime: 0 };
  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex: 0, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

describe('receive(), compiled framed', () => {
  it('is an entry of the master, published under its selector', () => {
    const artifact = compile(RECEIVE_SOURCE);
    expect(artifact.composition!.refusedEntries ?? []).toStrictEqual([]);
    expect(artifact.abi.find((row) => row.name === '__receive')?.selector).toMatch(/^[0-9a-f]{8}$/);
  });

  it('credits a value its containers receive', () => {
    expect(verdict({ source: RECEIVE_SOURCE, value: AMOUNT, containersOut: [AMOUNT] })).toStrictEqual({ accepted: true });
    // A container that already holds value may take the new value in with it.
    expect(verdict({
      source: RECEIVE_SOURCE, value: AMOUNT, containersIn: [50_000n], containersOut: [50_000n + AMOUNT],
    })).toStrictEqual({ accepted: true });
    expect(verdict({ source: RECEIVE_SOURCE, value: 0n })).toStrictEqual({ accepted: true });
  });

  it('is refused when its containers receive less than the value', () => {
    expect(verdict({ source: RECEIVE_SOURCE, value: AMOUNT }).accepted).toBe(false);
    expect(verdict({ source: RECEIVE_SOURCE, value: AMOUNT, containersOut: [AMOUNT - 1n] }).accepted).toBe(false);
    // Value moved from one container to another is not received.
    expect(verdict({
      source: RECEIVE_SOURCE, value: AMOUNT, containersIn: [AMOUNT], containersOut: [AMOUNT],
    }).accepted).toBe(false);
  });

  it('is refused for a value the script reads as negative', () => {
    expect(verdict({ source: RECEIVE_SOURCE, value: NEGATIVE_AMOUNT }).accepted).toBe(false);
    expect(verdict({ source: RECEIVE_SOURCE, value: NEGATIVE_AMOUNT, containersIn: [AMOUNT] }).accepted).toBe(false);
  });

  it('never lets its containers be spent for nothing', () => {
    expect(verdict({ source: RECEIVE_SOURCE, value: 0n, containersIn: [50_000n] }).accepted).toBe(false);
    expect(verdict({
      source: RECEIVE_SOURCE, value: 0n, containersIn: [50_000n], containersOut: [49_999n],
    }).accepted).toBe(false);
    // The control: a container merged into another keeps its value.
    expect(verdict({
      source: RECEIVE_SOURCE, value: 0n, containersIn: [30_000n, 20_000n], containersOut: [50_000n],
    })).toStrictEqual({ accepted: true });
  });

  it('leaves the value to the validator when another master of its contract shares the transaction', () => {
    const alone = { source: RECEIVE_SOURCE, containersOut: [AMOUNT], validator: { secondMaster: false } };
    expect(verdict({ ...alone, value: AMOUNT })).toStrictEqual({ accepted: true });
    expect(verdict({ ...alone, value: AMOUNT, containersOut: [] }).accepted).toBe(false);
    // Shared, the frame is weighed with every other frame of its contract by the validator (V7), not by itself.
    const shared = { ...alone, validator: { secondMaster: true } };
    expect(verdict({ ...shared, value: AMOUNT })).toStrictEqual({ accepted: true });
    expect(verdict({ ...shared, value: AMOUNT, containersOut: [] })).toStrictEqual({ accepted: true });
  });
});

describe('payable and non-payable entries behind one dispatcher, compiled framed', () => {
  const call = (entry: string, value: bigint, args: readonly Uint8Array[] = []): { accepted: boolean } => verdict({
    source: MIXED_SOURCE,
    value,
    argumentPushes: encodeArgumentList([selectorOf(MIXED_SOURCE, entry), ...args]),
    containersOut: value > 0n ? [value] : [],
  });

  it('dispatches receive() by its selector', () => {
    expect(compile(MIXED_SOURCE).composition!.refusedEntries ?? []).toStrictEqual([]);
    expect(call('__receive', AMOUNT)).toStrictEqual({ accepted: true });
  });

  it('lets a payable function read the value it receives', () => {
    expect(call('deposit', AMOUNT)).toStrictEqual({ accepted: true });
    expect(call('deposit', 0n).accepted).toBe(false);
  });

  it('refuses value sent to a function that is not payable', () => {
    expect(call('ping', AMOUNT, [encodeIntegerValue(1n)]).accepted).toBe(false);
    expect(call('ping', 0n, [encodeIntegerValue(1n)])).toStrictEqual({ accepted: true });
  });
});

describe('a contract with no payable body, compiled framed', () => {
  it('refuses any value', () => {
    const spend = { source: PLAIN_SOURCE, argumentPushes: encodeArgumentList([encodeIntegerValue(1n)]) };
    expect(verdict({ ...spend, value: AMOUNT, containersOut: [AMOUNT] }).accepted).toBe(false);
    expect(verdict({ ...spend, value: 0n })).toStrictEqual({ accepted: true });
  });
});

describe('receive() that books the value in a record, compiled framed', () => {
  const ledger = deploy(LEDGER_SOURCE);
  const commitment = (received: bigint): Uint8Array =>
    new Uint8Array(Buffer.from(buildPushdataCommitment(ledger.artifact.stateLayout!, { received }, 0), 'hex'));

  it('writes the value its containers receive', () => {
    const state = { committed: commitment(5n), written: commitment(5n + AMOUNT) };
    expect(verdict({ source: LEDGER_SOURCE, value: AMOUNT, state, containersOut: [AMOUNT] }))
      .toStrictEqual({ accepted: true });
    expect(verdict({ source: LEDGER_SOURCE, value: AMOUNT, state }).accepted).toBe(false);
  });
});
