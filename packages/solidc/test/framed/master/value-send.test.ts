import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import {
  asmToScript, buildSatoshiContainerCovenantScript, encodeArgumentList, encodeIntegerValue, encodeWitnessBlock,
  scriptToBytecode, sha256, validatorAddress, type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory, validatorSpend } from './validator-input.js';

/**
 * A framed contract paying its sends from its satoshi containers (spec 4b), driven through the real entry.
 *
 * A frame that settles alone may spend the contract's containers: their growth plus the value its listed sends pay
 * must cover the value it receives, so the containers shrink by at most what the contract's own code sends. The
 * sends follow one of the contract's containers in a run, which ties them to the frame: no output is counted by
 * two sends. A frame another master of its contract shares lists no send until the validator accounts for them.
 */

const CATEGORY = seededCategory('value send');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const ADDRESS = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const CONTAINER_LOCK = encodeLockingBytecodeP2sh32(
  hash256(scriptToBytecode(buildSatoshiContainerCovenantScript(CATEGORY))),
);

const MASTER_VALUE = 20_000n;
const AMOUNT = 10_000n;

type Artifact = ReturnType<typeof compileString>;
type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

/** One send to the frame's sender. */
const PAY_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Payer { function pay(int amount) { this.transfer(msg.sender, amount); require(true); } }';

/** Two sends to the frame's sender. */
const PAY_TWO_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Payer {'
  + '   function pay(int a, int b) { this.transfer(msg.sender, a); this.transfer(msg.sender, b); require(true); }'
  + ' }';

/** A deposit through receive() and a release that pays it out. */
const ESCROW_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Escrow {'
  + '   receive() external payable { require(true); }'
  + '   function release(int amount) { this.transfer(msg.sender, amount); require(true); }'
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

function deploy(source: string): { program: Uint8Array; lock: Uint8Array } {
  const artifact = compile(source);
  const { placeholders } = artifact.composition!;
  const program = fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), placeholders, {
    category: categorySlotValue(CATEGORY),
    contractAddress: ADDRESS,
    ...(placeholders.templateHashOffset === undefined ? {} : { templateHash: TEMPLATE_HASH }),
  });
  return { program, lock: encodeLockingBytecodeP2sh32(hash256(program)) };
}

function token(capability: 'minting' | 'mutable'): VmOutput['token'] {
  return { category: CATEGORY, amount: 0n, nft: { capability, commitment: new Uint8Array(0) } };
}

function selectorOf(source: string, entry: string): Uint8Array {
  return Uint8Array.from(Buffer.from(compile(source).abi.find((row) => row.name === entry)!.selector!, 'hex'));
}

const container = (value: bigint): VmOutput => ({ lockingBytecode: CONTAINER_LOCK, valueSatoshis: value });
const payment = (value: bigint): VmOutput => ({ lockingBytecode: USER_LOCK, valueSatoshis: value });

/** A spend of a compiled master at input 0: the user at 1, then the second master and the validator, if any. */
interface Spend {
  readonly source: string;
  readonly argumentPushes: Uint8Array;
  readonly value?: bigint;
  /** The outputs after every participant's, the first at `trailingBase(spend)`. */
  readonly trailing: readonly VmOutput[];
  readonly sends: readonly number[];
  /** Container inputs, after the participants. */
  readonly containersIn?: readonly bigint[];
  readonly validator?: { readonly secondMaster: boolean };
}

/** The index of the first output after the participants. */
function trailingBase(spend: Pick<Spend, 'validator'>): number {
  if (spend.validator === undefined) return 2;
  return spend.validator.secondMaster ? 4 : 3;
}

function verdict(spend: Spend): { accepted: boolean; objection?: string } {
  const { program, lock } = deploy(spend.source);
  const userIndex = 1;
  const validatorIndex = spend.validator === undefined ? undefined : trailingBase(spend) - 1;
  const block: WitnessBlock = {
    kind: 0,
    callerRef: userIndex,
    originRef: userIndex,
    validatorRef: validatorIndex ?? 0xffff,
    sender: USER_LOCK,
    self: ADDRESS,
    value: spend.value ?? 0n,
    retval: new Uint8Array(0),
    calls: [],
    segments: [[]],
    events: [],
    sends: [...spend.sends],
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
  const validatorOutput: VmOutput[] = validator === undefined
    ? []
    : [{ lockingBytecode: validator.lock, valueSatoshis: MASTER_VALUE, token: token('mutable') }];
  const inputs = [
    input(1, new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(block)), ...spend.argumentPushes, ...encodeDataPush(program),
    ])),
    input(2, callerUnlockingBytecode()),
    ...(spend.validator?.secondMaster === true ? [input(3, encodeDataPush(new Uint8Array([1])))] : []),
    ...(validator === undefined ? [] : [input(4, validator.unlockingBytecode)]),
    ...(spend.containersIn ?? []).map((_, index) => input(5 + index, encodeDataPush(new Uint8Array([1])))),
  ];
  const sourceOutputs: VmProgram['sourceOutputs'] = [
    master,
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
    ...(spend.validator?.secondMaster === true ? [master] : []),
    ...validatorOutput,
    ...(spend.containersIn ?? []).map(container),
  ];
  const outputs: VmOutput[] = [
    master,
    payment(1_000n),
    ...(spend.validator?.secondMaster === true ? [master] : []),
    ...validatorOutput,
    ...spend.trailing,
  ];
  const transaction: VmTransaction = { version: 2, inputs, outputs, locktime: 0 };
  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex: 0, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

describe('a send paid from the contract\'s containers, compiled framed', () => {
  const pay = (overrides: Partial<Spend> = {}): { accepted: boolean } => verdict({
    source: PAY_SOURCE,
    argumentPushes: encodeArgumentList([encodeIntegerValue(AMOUNT)]),
    trailing: [container(40_000n), payment(AMOUNT)],
    sends: [3],
    containersIn: [50_000n],
    ...overrides,
  });

  it('is accepted when the containers shrink by what the send pays', () => {
    expect(pay()).toStrictEqual({ accepted: true });
    // A funder may pay the send instead: the containers need not shrink.
    expect(pay({ containersIn: [], trailing: [container(1_000n), payment(AMOUNT)] })).toStrictEqual({ accepted: true });
  });

  it('is refused when the containers shrink by more than the send pays', () => {
    expect(pay({ trailing: [container(30_000n), payment(AMOUNT)] }).accepted).toBe(false);
  });

  it('leaves the value to the validator when another master of the contract shares the transaction', () => {
    const covered = (secondMaster: boolean): Partial<Spend> => ({
      validator: { secondMaster }, sends: [secondMaster ? 5 : 4],
    });
    expect(pay(covered(false))).toStrictEqual({ accepted: true });
    expect(pay(covered(true))).toStrictEqual({ accepted: true });
    // Shared, the containers are weighed by the validator (V7), but the send still follows one of them.
    expect(pay({ ...covered(true), trailing: [container(30_000n), payment(AMOUNT)] })).toStrictEqual({ accepted: true });
    expect(pay({ ...covered(true), trailing: [payment(40_000n), payment(AMOUNT)] }).accepted).toBe(false);
  });
});

describe('two sends paid from the contract\'s containers, compiled framed', () => {
  const pay = (sends: number[], trailing: VmOutput[]): { accepted: boolean } => verdict({
    source: PAY_TWO_SOURCE,
    argumentPushes: encodeArgumentList([encodeIntegerValue(AMOUNT), encodeIntegerValue(AMOUNT)]),
    trailing,
    sends,
    containersIn: [50_000n],
  });

  it('is accepted when the sends follow the container in a run', () => {
    expect(pay([3, 4], [container(30_000n), payment(AMOUNT), payment(AMOUNT)])).toStrictEqual({ accepted: true });
  });

  it('is refused when one output is listed for both sends', () => {
    // Both sends pay the same lock the same amount, so one output would satisfy both bodies' pins, and the
    // containers would give up twice what the transaction pays.
    expect(pay([3, 3], [container(30_000n), payment(AMOUNT)]).accepted).toBe(false);
  });

  it('is refused when the sends are not a run', () => {
    expect(pay([3, 5], [container(30_000n), payment(AMOUNT), payment(1_000n), payment(AMOUNT)]).accepted)
      .toBe(false);
  });
});

describe('an escrow that takes a deposit and pays it out, compiled framed', () => {
  const call = (entry: string, args: readonly Uint8Array[], spend: Partial<Spend>): { accepted: boolean } => verdict({
    source: ESCROW_SOURCE,
    argumentPushes: encodeArgumentList([selectorOf(ESCROW_SOURCE, entry), ...args]),
    trailing: [],
    sends: [],
    ...spend,
  });

  it('takes the deposit into a container and releases it from there', () => {
    expect(call('__receive', [], { value: AMOUNT, trailing: [container(AMOUNT)] })).toStrictEqual({ accepted: true });
    expect(call('release', [encodeIntegerValue(AMOUNT)], {
      containersIn: [AMOUNT], trailing: [container(1_000n), payment(AMOUNT)], sends: [3],
    })).toStrictEqual({ accepted: true });
  });

  it('refuses a release that takes more than it pays, and value sent to it', () => {
    expect(call('release', [encodeIntegerValue(AMOUNT)], {
      containersIn: [3n * AMOUNT], trailing: [container(1_000n), payment(AMOUNT)], sends: [3],
    }).accepted).toBe(false);
    expect(call('release', [encodeIntegerValue(AMOUNT)], {
      value: AMOUNT, trailing: [container(AMOUNT + 1_000n), payment(AMOUNT)], sends: [3],
    }).accepted).toBe(false);
  });
});
