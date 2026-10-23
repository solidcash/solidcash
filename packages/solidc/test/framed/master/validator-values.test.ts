import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import {
  asmToScript, buildPushdataCommitment, buildSatoshiContainerCovenantScript, encodeArgumentList, encodeIntegerValue,
  encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress,
  type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, VALIDATOR_INPUT_SPAN, categorySlotValue, dataRecordLock, seededCategory,
  validatorFacetPlacements, validatorSpend,
} from './validator-input.js';

/**
 * V7's value rule: a contract entered twice in one transaction is weighed as a whole by the validator that settles
 * it. Its containers grow by at least what its frames receive less what they pay, and no two of its frames list the
 * same send. Neither master weighs the value itself, since neither is its contract's only master.
 */

const CATEGORY = seededCategory('validator values till');
const TEMPLATE_HASH = sha256(REAL_VALIDATOR_PROGRAM);
const ADDRESS = validatorAddress(CATEGORY, REAL_VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const CONTAINER_LOCK = encodeLockingBytecodeP2sh32(
  hash256(scriptToBytecode(buildSatoshiContainerCovenantScript(CATEGORY))),
);

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Till {'
  + '   int public total;'
  + '   function deposit() payable { this.total = this.total + msg.value; }'
  + '   function pay(int amount) { this.total = this.total + 1; this.transfer(msg.sender, amount); }'
  + ' }';
const artifact = compileStringMulti(SOURCE, { composition: 'framed' }).Till!;
const PROGRAM = fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), artifact.composition!.placeholders, {
  category: categorySlotValue(CATEGORY), contractAddress: ADDRESS, templateHash: TEMPLATE_HASH,
});
const LOCK = encodeLockingBytecodeP2sh32(hash256(PROGRAM));
const selectorOf = (entry: string): Uint8Array =>
  Uint8Array.from(Buffer.from(artifact.abi.find((row) => row.name === entry)!.selector!, 'hex'));
const view = (total: bigint): Uint8Array =>
  Uint8Array.from(Buffer.from(buildPushdataCommitment(artifact.stateLayout!, { total }, 0), 'hex'));

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

/** Inputs: the two masters, the validator with its facet, the record, the user, then the containers spent. */
const FIRST = 0;
const SECOND = 1;
const VALIDATOR = 2;
const RECORD = VALIDATOR + VALIDATOR_INPUT_SPAN;
const USER = RECORD + 1;

const token = (capability: 'minting' | 'mutable', commitment: Uint8Array = new Uint8Array(0)): VmOutput['token'] =>
  ({ category: CATEGORY, amount: 0n, nft: { capability, commitment } });
const container = (value: bigint): VmOutput => ({ lockingBytecode: CONTAINER_LOCK, valueSatoshis: value });
const payment = (value: bigint): VmOutput => ({ lockingBytecode: USER_LOCK, valueSatoshis: value });

/** One of the two frames: its entry, its call data, the value it carries, its record views and its sends. */
interface Frame {
  readonly entry: 'deposit' | 'pay';
  readonly args: readonly Uint8Array[];
  readonly value: bigint;
  readonly views: readonly [bigint, bigint];
  readonly sends: readonly number[];
}

/** Every contract input's verdict for two frames of Till, the containers spent and the trailing outputs. */
function verdicts(
  frames: readonly [Frame, Frame], containersIn: readonly bigint[], trailing: readonly VmOutput[],
): Record<'first' | 'second' | 'validator', boolean> {
  const validator = validatorSpend(CATEGORY, {
    roots: [FIRST, SECOND], masters: [FIRST, SECOND], settles: [{ category: CATEGORY, stateInputs: [RECORD] }],
  });
  const facets = validatorFacetPlacements();
  const block = (frame: Frame): WitnessBlock => ({
    kind: 0, callerRef: USER, originRef: USER, validatorRef: VALIDATOR, sender: USER_LOCK, self: ADDRESS,
    value: frame.value, retval: new Uint8Array(0), calls: [],
    segments: [[{ in: RECORD, out: RECORD, viewIn: view(frame.views[0]), viewOut: view(frame.views[1]) }]],
    events: [], sends: [...frame.sends],
  });
  const input = (fill: number, unlockingBytecode: Uint8Array): VmTransaction['inputs'][number] => ({
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(fill), sequenceNumber: 0xffffffff,
    unlockingBytecode,
  });
  const masterInput = (fill: number, frame: Frame): VmTransaction['inputs'][number] => input(fill, new Uint8Array([
    ...encodeDataPush(encodeWitnessBlock(block(frame))),
    ...encodeArgumentList([selectorOf(frame.entry), ...frame.args]),
    ...encodeDataPush(PROGRAM),
  ]));
  const master: VmOutput = { lockingBytecode: LOCK, valueSatoshis: 20_000n, token: token('minting') };
  const validatorOutput: VmOutput = { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token('mutable') };
  const inputs = [
    masterInput(1, frames[0]),
    masterInput(2, frames[1]),
    input(3, validator.unlockingBytecode),
    ...facets.map((facet, at) => input(VALIDATOR + 1 + at, facet.input.unlockingBytecode)),
    input(RECORD, encodeDataPush(new Uint8Array([1]))),
    input(USER, callerUnlockingBytecode()),
    ...containersIn.map((_value, index) => input(USER + 1 + index, encodeDataPush(new Uint8Array([1])))),
  ];
  const sourceOutputs: VmProgram['sourceOutputs'] = [
    master, master, validatorOutput,
    ...facets.map((facet) => facet.output),
    { lockingBytecode: dataRecordLock(CATEGORY), valueSatoshis: 20_000n, token: token('mutable', view(frames[0].views[0])) },
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
    ...containersIn.map(container),
  ];
  const outputs: VmOutput[] = [
    master, master, validatorOutput,
    ...facets.map((facet) => facet.output),
    { lockingBytecode: dataRecordLock(CATEGORY), valueSatoshis: 20_000n, token: token('mutable', view(frames[1].views[1])) },
    payment(1_000n),
    ...trailing,
  ];
  const transaction: VmTransaction = { version: 2, inputs, outputs, locktime: 0 };
  const vm = compositionMachine();
  const accepted = (inputIndex: number): boolean =>
    vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })) === true;
  return { first: accepted(FIRST), second: accepted(SECOND), validator: accepted(VALIDATOR) };
}

const ACCEPTED = { first: true, second: true, validator: true };

describe('a contract entered twice, weighed by the validator that settles it', () => {
  const deposit = (value: bigint, views: readonly [bigint, bigint]): Frame => ({
    entry: 'deposit', args: [], value, views, sends: [],
  });
  const deposits: [Frame, Frame] = [deposit(10_000n, [0n, 10_000n]), deposit(5_000n, [10_000n, 15_000n])];

  it('accepts two deposits whose value the containers receive together', () => {
    expect(verdicts(deposits, [], [container(15_000n)])).toStrictEqual(ACCEPTED);
    expect(verdicts(deposits, [], [container(10_000n), container(5_000n)])).toStrictEqual(ACCEPTED);
  });

  it('is refused by the validator when the containers receive less than both deposits', () => {
    // Either frame alone is covered by 10,000 of growth: only the contract as a whole shows the shortfall.
    expect(verdicts(deposits, [], [container(10_000n)])).toStrictEqual({ ...ACCEPTED, validator: false });
  });

  const pay = (amount: bigint, views: readonly [bigint, bigint], send: number): Frame => ({
    entry: 'pay', args: [encodeIntegerValue(amount)], value: 0n, views, sends: [send],
  });
  // Outputs from 6: a container, the first send, a container, the second send.
  const payments: [Frame, Frame] = [pay(7_000n, [0n, 1n], 7), pay(4_000n, [1n, 2n], 9)];

  it('accepts two sends each after a container, paid from the containers together', () => {
    const trailing = [container(20_000n), payment(7_000n), container(19_000n), payment(4_000n)];
    expect(verdicts(payments, [50_000n], trailing)).toStrictEqual(ACCEPTED);
  });

  it('is refused by the validator when the containers give up more than both sends pay', () => {
    const trailing = [container(20_000n), payment(7_000n), container(18_000n), payment(4_000n)];
    expect(verdicts(payments, [50_000n], trailing)).toStrictEqual({ ...ACCEPTED, validator: false });
  });

  it('is refused by the validator when both frames list the same send', () => {
    // Two equal sends listed once: each master pins its send to output 7, and the containers keep what paying both
    // would leave, so only counting the output once shows that one of the sends was never paid.
    const shared: [Frame, Frame] = [pay(7_000n, [0n, 1n], 7), pay(7_000n, [1n, 2n], 7)];
    const trailing = [container(36_000n), payment(7_000n)];
    expect(verdicts(shared, [50_000n], trailing)).toStrictEqual({ ...ACCEPTED, validator: false });
    // The control: the same two sends listed at their own outputs.
    const own: [Frame, Frame] = [pay(7_000n, [0n, 1n], 7), pay(7_000n, [1n, 2n], 9)];
    const honest = [container(20_000n), payment(7_000n), container(16_000n), payment(7_000n)];
    expect(verdicts(own, [50_000n], honest)).toStrictEqual(ACCEPTED);
  });
});
