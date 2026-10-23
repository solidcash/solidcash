import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import {
  argsHash, asmToScript, buildPushdataCommitment, encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress,
  type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, categorySlotValue, dataRecordLock, seededCategory, validatorFacetPlacements,
  validatorSpend,
} from './validator-input.js';

/**
 * A contract with two masters in one transaction is settled by one validator that covers both.
 *
 * Counter's two masters run in two call trees: a user bumps it directly, and a user's Poker bumps it through a call.
 * Each tree has its own validator. Neither master settles Counter's record, since neither is its contract's only
 * master; so unless one validator covers both and settles Counter, nothing ties the record's output to what the
 * frames computed. The attack writes a counter no frame computed.
 */

const CATEGORY_COUNTER = seededCategory('split settlement counter');
const CATEGORY_POKER = seededCategory('split settlement poker');
const TEMPLATE_HASH = sha256(REAL_VALIDATOR_PROGRAM);
const ADDRESS_COUNTER = validatorAddress(CATEGORY_COUNTER, REAL_VALIDATOR_PROGRAM);
const ADDRESS_POKER = validatorAddress(CATEGORY_POKER, REAL_VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICounter { function bump(); }'
  + ' contract Counter { int public counter; function bump() { this.counter = this.counter + 1; } }'
  + ' contract Poker { address public target; function poke() { ICounter(this.target).bump(); } }';
const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });

const program = (name: string, category: Uint8Array, address: Uint8Array): Uint8Array => {
  const artifact = artifacts[name]!;
  return fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), artifact.composition!.placeholders, {
    category: categorySlotValue(category), contractAddress: address, templateHash: TEMPLATE_HASH,
  });
};
const COUNTER_PROGRAM = program('Counter', CATEGORY_COUNTER, ADDRESS_COUNTER);
const POKER_PROGRAM = program('Poker', CATEGORY_POKER, ADDRESS_POKER);
const BUMP_SELECTOR = new Uint8Array(Buffer.from(
  artifacts.Counter!.abi.find((entry) => entry.name === 'bump')!.selector!, 'hex',
));
const counterView = (counter: bigint): Uint8Array => new Uint8Array(Buffer.from(
  buildPushdataCommitment(artifacts.Counter!.stateLayout!, { counter }, 0), 'hex',
));
const POKER_VIEW = new Uint8Array(Buffer.from(
  buildPushdataCommitment(artifacts.Poker!.stateLayout!, { target: ADDRESS_COUNTER }, 0), 'hex',
));

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

/**
 * Inputs: Counter's root master, Poker's root master, Counter's called master, Counter's validator with its facet,
 * Poker's validator with its facet, the two records, then the user. Each validator's facet sits directly after its
 * head, which is where the head's binding reads it.
 */
const COUNTER_ROOT = 0;
const POKER_ROOT = 1;
const COUNTER_CALLED = 2;
const COUNTER_VALIDATOR = 3;
const COUNTER_FACET = 4;
const POKER_VALIDATOR = 5;
const POKER_FACET = 6;
const COUNTER_RECORD = 7;
const POKER_RECORD = 8;
const USER = 9;

type Capability = 'minting' | 'mutable';
const token = (
  category: Uint8Array, capability: Capability, commitment: Uint8Array = new Uint8Array(0),
): VmOutput['token'] =>
  ({ category, amount: 0n, nft: { capability, commitment } });

/** Every contract input's verdict when the Counter record's output carries `written`. */
function verdicts(written: bigint, split: boolean): Record<string, boolean> {
  // Split: each tree has its own validator. Joined: Counter's validator covers both trees and settles Counter.
  const counterValidator = split
    ? validatorSpend(CATEGORY_COUNTER, { roots: [COUNTER_ROOT], masters: [COUNTER_ROOT], settles: [] })
    : validatorSpend(CATEGORY_COUNTER, {
      roots: [COUNTER_ROOT, POKER_ROOT],
      masters: [COUNTER_ROOT, POKER_ROOT, COUNTER_CALLED],
      settles: [{ category: CATEGORY_COUNTER, stateInputs: [COUNTER_RECORD] }],
    });
  const pokerValidator = validatorSpend(CATEGORY_POKER, {
    roots: [POKER_ROOT], masters: [POKER_ROOT, COUNTER_CALLED], settles: [],
  });
  const calledValidator = split ? POKER_VALIDATOR : COUNTER_VALIDATOR;
  const rootBlock: WitnessBlock = {
    kind: 0, callerRef: USER, originRef: USER, validatorRef: COUNTER_VALIDATOR,
    sender: USER_LOCK, self: ADDRESS_COUNTER, value: 0n, retval: new Uint8Array(0), calls: [],
    segments: [[{ in: COUNTER_RECORD, out: COUNTER_RECORD, viewIn: counterView(5n), viewOut: counterView(6n) }]],
    events: [], sends: [],
  };
  const pokerBlock: WitnessBlock = {
    kind: 0, callerRef: USER, originRef: USER, validatorRef: calledValidator,
    sender: USER_LOCK, self: ADDRESS_POKER, value: 0n, retval: new Uint8Array(0),
    calls: [{
      kind: 1, target: ADDRESS_COUNTER, value: 0n, calleeRef: COUNTER_CALLED,
      argsHash: argsHash(BUMP_SELECTOR, new Uint8Array(0)), result: new Uint8Array(0),
    }],
    segments: [
      [{ in: POKER_RECORD, out: POKER_RECORD, viewIn: POKER_VIEW, viewOut: POKER_VIEW }],
      [{ in: POKER_RECORD, out: POKER_RECORD, viewIn: POKER_VIEW, viewOut: POKER_VIEW }],
    ],
    events: [], sends: [],
  };
  const calledBlock: WitnessBlock = {
    kind: 1, callerRef: POKER_ROOT, originRef: USER, validatorRef: calledValidator,
    sender: ADDRESS_POKER, self: ADDRESS_COUNTER, value: 0n, retval: new Uint8Array(0), calls: [],
    segments: [[{ in: COUNTER_RECORD, out: COUNTER_RECORD, viewIn: counterView(6n), viewOut: counterView(7n) }]],
    events: [], sends: [],
  };
  const counterLock = encodeLockingBytecodeP2sh32(hash256(COUNTER_PROGRAM));
  const pokerLock = encodeLockingBytecodeP2sh32(hash256(POKER_PROGRAM));
  // Both validators run the shipped program, so they bind the same facet code and the same lock.
  const facet = validatorFacetPlacements()[0]!;
  const input = (fill: number, unlockingBytecode: Uint8Array): VmTransaction['inputs'][number] => ({
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(fill), sequenceNumber: 0xffffffff,
    unlockingBytecode,
  });
  const inputs = [
    input(1, new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(rootBlock)), ...encodeDataPush(COUNTER_PROGRAM),
    ])),
    input(2, new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(pokerBlock)), ...encodeDataPush(POKER_PROGRAM),
    ])),
    input(3, new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(calledBlock)), ...encodeDataPush(BUMP_SELECTOR),
      ...encodeDataPush(COUNTER_PROGRAM),
    ])),
    input(4, counterValidator.unlockingBytecode),
    input(5, facet.input.unlockingBytecode),
    input(6, split ? pokerValidator.unlockingBytecode : encodeDataPush(new Uint8Array([1]))),
    input(7, split ? facet.input.unlockingBytecode : encodeDataPush(new Uint8Array([1]))),
    input(8, encodeDataPush(new Uint8Array([1]))),
    input(9, encodeDataPush(new Uint8Array([1]))),
    input(10, callerUnlockingBytecode()),
  ];
  // Joined, Poker's validator is not spent: its place holds a plain coin, and its facet's place too.
  const masters: VmOutput[] = [
    { lockingBytecode: counterLock, valueSatoshis: 20_000n, token: token(CATEGORY_COUNTER, 'minting') },
    { lockingBytecode: pokerLock, valueSatoshis: 20_000n, token: token(CATEGORY_POKER, 'minting') },
    { lockingBytecode: counterLock, valueSatoshis: 20_000n, token: token(CATEGORY_COUNTER, 'minting') },
    { lockingBytecode: counterValidator.lock, valueSatoshis: 20_000n, token: token(CATEGORY_COUNTER, 'mutable') },
    { lockingBytecode: facet.output.lockingBytecode, valueSatoshis: 20_000n },
    split
      ? { lockingBytecode: pokerValidator.lock, valueSatoshis: 20_000n, token: token(CATEGORY_POKER, 'mutable') }
      : { lockingBytecode: USER_LOCK, valueSatoshis: 20_000n },
    split
      ? { lockingBytecode: facet.output.lockingBytecode, valueSatoshis: 20_000n }
      : { lockingBytecode: USER_LOCK, valueSatoshis: 20_000n },
  ];
  const sourceOutputs: VmProgram['sourceOutputs'] = [
    ...masters,
    {
      lockingBytecode: dataRecordLock(CATEGORY_COUNTER), valueSatoshis: 20_000n,
      token: token(CATEGORY_COUNTER, 'mutable', counterView(5n)),
    },
    {
      lockingBytecode: dataRecordLock(CATEGORY_POKER), valueSatoshis: 20_000n,
      token: token(CATEGORY_POKER, 'mutable', POKER_VIEW),
    },
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];
  const outputs: VmOutput[] = [
    ...masters,
    {
      lockingBytecode: dataRecordLock(CATEGORY_COUNTER), valueSatoshis: 20_000n,
      token: token(CATEGORY_COUNTER, 'mutable', counterView(written)),
    },
    {
      lockingBytecode: dataRecordLock(CATEGORY_POKER), valueSatoshis: 20_000n,
      token: token(CATEGORY_POKER, 'mutable', POKER_VIEW),
    },
    { lockingBytecode: USER_LOCK, valueSatoshis: 90_000n },
  ];
  const transaction: VmTransaction = { version: 2, inputs, outputs, locktime: 0 };
  const vm = compositionMachine();
  const accepted = (inputIndex: number): boolean =>
    vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })) === true;
  return {
    counterRoot: accepted(COUNTER_ROOT),
    poker: accepted(POKER_ROOT),
    counterCalled: accepted(COUNTER_CALLED),
    counterValidator: accepted(COUNTER_VALIDATOR),
    counterFacet: accepted(COUNTER_FACET),
    ...(split ? { pokerValidator: accepted(POKER_VALIDATOR), pokerFacet: accepted(POKER_FACET) } : {}),
  };
}

const JOINED_ACCEPT = {
  counterRoot: true, poker: true, counterCalled: true, counterValidator: true, counterFacet: true,
};

describe('a contract with a master in each of two call trees', () => {
  it('is settled when one validator covers both trees, and a forged record is refused', () => {
    expect(verdicts(7n, false)).toStrictEqual(JOINED_ACCEPT);
    expect(verdicts(1000n, false).counterValidator).toBe(false);
  });

  it('is refused by both facets when each tree has its own validator, forged record or not', () => {
    // Before V8 counted a contract's masters over the whole transaction, every input accepted the forged record.
    // The rule that a shared contract has to be settled is one the split runs in each validator's facet at
    // `head + 1`, so a tree whose validator settles nothing is refused there and the heads themselves accept.
    expect(verdicts(1000n, true)).toStrictEqual({
      counterRoot: true, poker: true, counterCalled: true, counterValidator: true, counterFacet: false,
      pokerValidator: true, pokerFacet: false,
    });
    expect(verdicts(7n, true)).toStrictEqual({
      counterRoot: true, poker: true, counterCalled: true, counterValidator: true, counterFacet: false,
      pokerValidator: true, pokerFacet: false,
    });
  });
});
