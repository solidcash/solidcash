import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import {
  asmToScript, buildSatoshiContainerCovenantScript, computeFunctionSelector, computeFunctionSignature,
  encodeArgumentList, encodeIntegerValue, encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress,
  type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, VALIDATOR_INPUT_SPAN, categorySlotValue, seededCategory, validatorFacetPlacements,
  validatorSpend,
} from './validator-input.js';

/**
 * A typed call carrying value, `IWrapper(w).deposit{value: amount}()`, compiled framed (spec 4b).
 *
 * The call's record carries the amount: the payer's own site holds the record's `value` to the amount its code
 * computed, the validator holds the callee's frame value to the record (V5), the payer's containers give up at most
 * what its records pass on, and the callee's containers receive at least its frame value. Each check sits with the
 * side that owns it, so each case mutates one fact and reads the verdict of the input that should refuse it. Both
 * masters settle alone beside the validator that binds their edge, whose verdict is its head's and its facet's.
 */

const CATEGORY_PAYER = seededCategory('typed call value payer');
const CATEGORY_WRAPPER = seededCategory('typed call value wrapper');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const ADDRESS_PAYER = validatorAddress(CATEGORY_PAYER, VALIDATOR_PROGRAM);
const ADDRESS_WRAPPER = validatorAddress(CATEGORY_WRAPPER, VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const containerLock = (category: Uint8Array): Uint8Array => encodeLockingBytecodeP2sh32(
  hash256(scriptToBytecode(buildSatoshiContainerCovenantScript(category))),
);
const PAYER_CONTAINER = containerLock(CATEGORY_PAYER);
const WRAPPER_CONTAINER = containerLock(CATEGORY_WRAPPER);
const DEPOSIT_SELECTOR = computeFunctionSelector(computeFunctionSignature('deposit', []));
const AMOUNT = 10_000n;
const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IWrapper { function deposit(); }'
  + ' contract Wrapper { function deposit() payable { require(msg.value > 0); } }'
  + ' contract Payer { function forward(int amount) {'
  + `   IWrapper(0x${toHex(ADDRESS_WRAPPER)}).deposit{value: amount}(); require(true); } }`;

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

/** Inputs: the payer, the wrapper, the validator with its facets, the user, then the payer's containers spent. */
const PAYER_INDEX = 0;
const WRAPPER_INDEX = 1;
const VALIDATOR_INDEX = 2;
const USER_INDEX = VALIDATOR_INDEX + VALIDATOR_INPUT_SPAN;

function program(name: string, category: Uint8Array, address: Uint8Array): Uint8Array {
  const artifact = artifacts[name]!;
  return fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), artifact.composition!.placeholders, {
    category: categorySlotValue(category), contractAddress: address, templateHash: TEMPLATE_HASH,
  });
}

const token = (category: Uint8Array, capability: 'minting' | 'mutable'): VmOutput['token'] =>
  ({ category, amount: 0n, nft: { capability, commitment: new Uint8Array(0) } });

interface Deposit {
  /** The value the payer's record carries and the value the wrapper's frame claims. */
  readonly recordValue?: bigint;
  readonly calleeValue?: bigint;
  /** The payer's containers spent and kept, and what the wrapper's containers receive. */
  readonly payerIn?: readonly bigint[];
  readonly payerOut?: readonly bigint[];
  readonly wrapperOut?: readonly bigint[];
}

/** Every contract input's verdict for one deposit. */
function verdicts(deposit: Deposit = {}): Record<'payer' | 'wrapper' | 'validator', boolean> {
  const payerProgram = program('Payer', CATEGORY_PAYER, ADDRESS_PAYER);
  const wrapperProgram = program('Wrapper', CATEGORY_WRAPPER, ADDRESS_WRAPPER);
  const validator = validatorSpend(CATEGORY_PAYER, {
    roots: [PAYER_INDEX], masters: [PAYER_INDEX, WRAPPER_INDEX], settles: [],
  });
  const facets = validatorFacetPlacements();
  const recordValue = deposit.recordValue ?? AMOUNT;
  const payerBlock: WitnessBlock = {
    kind: 0,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender: USER_LOCK,
    self: ADDRESS_PAYER,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [{
      kind: 1,
      target: ADDRESS_WRAPPER,
      value: recordValue,
      calleeRef: WRAPPER_INDEX,
      argsHash: sha256(DEPOSIT_SELECTOR),
      result: new Uint8Array(0),
    }],
    segments: [[], []],
    events: [],
    sends: [],
  };
  const wrapperBlock: WitnessBlock = {
    kind: 1,
    callerRef: PAYER_INDEX,
    originRef: USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender: ADDRESS_PAYER,
    self: ADDRESS_WRAPPER,
    value: deposit.calleeValue ?? recordValue,
    retval: new Uint8Array(0),
    calls: [],
    segments: [[]],
    events: [],
    sends: [],
  };
  const payerLock = encodeLockingBytecodeP2sh32(hash256(payerProgram));
  const wrapperLock = encodeLockingBytecodeP2sh32(hash256(wrapperProgram));
  const input = (fill: number, unlockingBytecode: Uint8Array): VmTransaction['inputs'][number] => ({
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(fill), sequenceNumber: 0xffffffff,
    unlockingBytecode,
  });
  const payerIn = deposit.payerIn ?? [50_000n];
  const inputs = [
    input(1, new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(payerBlock)),
      ...encodeArgumentList([encodeIntegerValue(AMOUNT)]),
      ...encodeDataPush(payerProgram),
    ])),
    input(2, new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(wrapperBlock)), ...encodeDataPush(DEPOSIT_SELECTOR),
      ...encodeDataPush(wrapperProgram),
    ])),
    input(3, validator.unlockingBytecode),
    ...facets.map((facet) => facet.input),
    input(4, callerUnlockingBytecode()),
    ...payerIn.map((_, index) => input(5 + index, encodeDataPush(new Uint8Array([1])))),
  ];
  const participants: VmOutput[] = [
    { lockingBytecode: payerLock, valueSatoshis: 20_000n, token: token(CATEGORY_PAYER, 'minting') },
    { lockingBytecode: wrapperLock, valueSatoshis: 20_000n, token: token(CATEGORY_WRAPPER, 'minting') },
    { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(CATEGORY_PAYER, 'mutable') },
    ...facets.map((facet) => facet.output),
  ];
  const sourceOutputs: VmProgram['sourceOutputs'] = [
    ...participants,
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
    ...payerIn.map((value) => ({ lockingBytecode: PAYER_CONTAINER, valueSatoshis: value })),
  ];
  const outputs: VmOutput[] = [
    ...participants,
    { lockingBytecode: USER_LOCK, valueSatoshis: 1_000n },
    ...(deposit.wrapperOut ?? [AMOUNT]).map((value) => ({ lockingBytecode: WRAPPER_CONTAINER, valueSatoshis: value })),
    ...(deposit.payerOut ?? [40_000n]).map((value) => ({ lockingBytecode: PAYER_CONTAINER, valueSatoshis: value })),
  ];
  const transaction: VmTransaction = { version: 2, inputs, outputs, locktime: 0 };
  const vm = compositionMachine();
  const accepted = (inputIndex: number): boolean =>
    vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })) === true;
  return {
    payer: accepted(PAYER_INDEX),
    wrapper: accepted(WRAPPER_INDEX),
    // The edge rules (V5) run in the validator's facet, the input after its head, so both have to accept.
    validator: accepted(VALIDATOR_INDEX) && facets.every((_, at) => accepted(VALIDATOR_INDEX + 1 + at)),
  };
}

describe('a typed call carrying value, compiled framed', () => {
  it('is served: the payer\'s entry is not refused', () => {
    expect(artifacts.Payer!.composition?.refusedEntries ?? []).toStrictEqual([]);
  });

  it('is accepted at every input when the wrapper\'s containers receive what the payer\'s give up', () => {
    expect(verdicts()).toStrictEqual({ payer: true, wrapper: true, validator: true });
    // A funder may pay the value instead: the payer's containers need not shrink.
    expect(verdicts({ payerIn: [], payerOut: [] })).toStrictEqual({ payer: true, wrapper: true, validator: true });
  });

  it('is refused by the wrapper when its containers receive less than its frame value', () => {
    expect(verdicts({ wrapperOut: [AMOUNT - 1n] }).wrapper).toBe(false);
  });

  it('is refused by the payer when its containers give up more than its call carries', () => {
    expect(verdicts({ payerOut: [30_000n] }).payer).toBe(false);
  });

  it('is refused by the payer when the record carries another value than the amount its code computed', () => {
    const relabelled = verdicts({ recordValue: AMOUNT - 1n, wrapperOut: [AMOUNT - 1n], payerOut: [40_001n] });
    expect(relabelled.payer).toBe(false);
    // The record and the wrapper's frame agree, so the refusal is the payer's own site.
    expect(relabelled.validator).toBe(true);
  });

  it('is refused by the validator when the wrapper\'s frame value is not the record\'s (V5)', () => {
    // The wrapper's frame claims less than the record, which its containers still cover, so only the edge refuses.
    expect(verdicts({ calleeValue: AMOUNT - 1n })).toStrictEqual({ payer: true, wrapper: true, validator: false });
  });
});
