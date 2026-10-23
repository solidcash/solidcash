/**
 * Framed October 2026 CRITICAL holes. Each case compiles through this worktree and is evaluated on the
 * composition machine (the real BCH 2026 VM with the limits a validator program needs). The authorized
 * transaction is accepted. The attack the verifier names is rejected.
 */
import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import {
  argsHash, asmToScript, buildPushdataCommitment, computeFunctionSelector, computeFunctionSignature,
  encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress, validatorRedeemScript, type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../src/compiler.js';
import { fillPlaceholders } from '../src/framed/master/placeholders.js';
import { compositionMachine } from './framed/machine.js';
import { callerUnlockingBytecode } from './framed/master/caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, categorySlotValue, dataRecordLock, seededCategory, validatorFacetPlacements,
  validatorSpend,
} from './framed/master/validator-input.js';

const ZEROS = new Uint8Array(128);
const INDEX_NONE = 0xffff;

describe('FM-1 a bare-lock mutable NFT is not the validator', () => {
  const label = (text: string): Uint8Array => sha256(new TextEncoder().encode(text));
  const CATEGORY_CALLER = seededCategory('fm1 caller');
  const CATEGORY_CALLEE = seededCategory('fm1 callee');
  const ATTACKER = seededCategory('fm1 attacker category');
  const TEMPLATE_HASH = sha256(REAL_VALIDATOR_PROGRAM);
  const ADDRESS_CALLER = validatorAddress(CATEGORY_CALLER, REAL_VALIDATOR_PROGRAM);
  const ADDRESS_CALLEE = validatorAddress(CATEGORY_CALLEE, REAL_VALIDATOR_PROGRAM);
  const USER_LOCK = encodeLockingBytecodeP2pkh(label('fm1 user').slice(0, 20));
  const CALLEE_SELECTOR = computeFunctionSelector(computeFunctionSignature('ping', []));
  const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');
  const SOURCE = 'pragma solidcash ^0.14.0;'
    + ' interface ICallee { function ping(); }'
    + ' contract Callee { function ping() { require(true); } }'
    + ' contract Caller {'
    + '   int public counter;'
    + '   function callIt() {'
    + `     ICallee(0x${toHex(ADDRESS_CALLEE)}).ping.call();`
    + '     this.counter = this.counter + 1;'
    + '   }'
    + ' }';
  const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
  const program = (name: string, category: Uint8Array, address: Uint8Array): Uint8Array => {
    const artifact = artifacts[name]!;
    return fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), artifact.composition!.placeholders, {
      category: categorySlotValue(category), contractAddress: address, templateHash: TEMPLATE_HASH,
    });
  };
  const CALLER_PROGRAM = program('Caller', CATEGORY_CALLER, ADDRESS_CALLER);
  const CALLEE_PROGRAM = program('Callee', CATEGORY_CALLEE, ADDRESS_CALLEE);
  const counterView = (counter: bigint): Uint8Array => new Uint8Array(Buffer.from(
    buildPushdataCommitment(artifacts.Caller!.stateLayout!, { counter }, 0), 'hex',
  ));
  const BEFORE = counterView(5n);
  const AFTER = counterView(6n);
  const VALUE = 20_000n;
  const EMPTY = new Uint8Array(0);
  type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
  type VmTransaction = NonNullable<VmProgram['transaction']>;
  type VmOutput = VmTransaction['outputs'][number];
  const token = (category: Uint8Array, capability: 'minting' | 'mutable', commitment: Uint8Array = EMPTY): VmOutput['token'] =>
    ({ category, amount: 0n, nft: { capability, commitment } });
  const CALLER = 0;
  const STATE = 1;
  const VALIDATOR = 2;
  const FACETS = validatorFacetPlacements();
  const USER = VALIDATOR + 1 + FACETS.length;
  const CALLEE = USER + 1;

  function spend(fake: boolean): { caller: boolean; validator: boolean } {
    const validator = validatorSpend(CATEGORY_CALLER, { roots: [CALLER], masters: [CALLER, CALLEE], settles: [] });
    const outpoint = (index: number): Uint8Array => label(`fm1 outpoint ${index}`);
    const input = (index: number, unlockingBytecode: Uint8Array): VmTransaction['inputs'][number] => ({
      outpointIndex: 0, outpointTransactionHash: outpoint(index), sequenceNumber: 0xffffffff, unlockingBytecode,
    });
    const callerBlock: WitnessBlock = {
      kind: 0, callerRef: USER, originRef: USER, validatorRef: VALIDATOR, sender: USER_LOCK, self: ADDRESS_CALLER,
      value: 0n, retval: EMPTY,
      calls: [{
        kind: 1, target: ADDRESS_CALLEE, value: 0n, calleeRef: CALLEE,
        argsHash: argsHash(CALLEE_SELECTOR, EMPTY), result: EMPTY,
      }],
      segments: [
        [{ in: STATE, out: STATE, viewIn: BEFORE, viewOut: BEFORE }],
        [{ in: STATE, out: STATE, viewIn: BEFORE, viewOut: AFTER }],
      ],
      events: [], sends: [],
    };
    const calleeBlock: WitnessBlock = {
      kind: 1, callerRef: CALLER, originRef: USER, validatorRef: VALIDATOR, sender: ADDRESS_CALLER, self: ADDRESS_CALLEE,
      value: 0n, retval: EMPTY, calls: [], segments: [[]], events: [], sends: [],
    };
    const fakeRedeem = validatorRedeemScript(ATTACKER, REAL_VALIDATOR_PROGRAM);
    const bare = Uint8Array.of(0x6d, 0x51);
    const validatorUnlock = fake
      ? new Uint8Array([...encodeDataPush(Uint8Array.of(0x00)), ...encodeDataPush(fakeRedeem)])
      : validator.unlockingBytecode;
    const validatorLock = fake ? bare : validator.lock;
    const validatorCategory = fake ? ATTACKER : CATEGORY_CALLER;
    const callerMaster: VmOutput = {
      lockingBytecode: encodeLockingBytecodeP2sh32(hash256(CALLER_PROGRAM)), valueSatoshis: VALUE,
      token: token(CATEGORY_CALLER, 'minting'),
    };
    const calleeMaster: VmOutput = {
      lockingBytecode: encodeLockingBytecodeP2sh32(hash256(CALLEE_PROGRAM)), valueSatoshis: VALUE,
      token: token(CATEGORY_CALLEE, 'minting'),
    };
    const validatorOutput: VmOutput = {
      lockingBytecode: validatorLock, valueSatoshis: VALUE, token: token(validatorCategory, 'mutable'),
    };
    const record = (commitment: Uint8Array): VmOutput => ({
      lockingBytecode: dataRecordLock(CATEGORY_CALLER), valueSatoshis: VALUE,
      token: token(CATEGORY_CALLER, 'mutable', commitment),
    });
    const inputs = [
      input(CALLER, new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(callerBlock)), ...encodeDataPush(CALLER_PROGRAM),
      ])),
      input(STATE, encodeDataPush(new Uint8Array([1]))),
      input(VALIDATOR, validatorUnlock),
      ...FACETS.map((facet, at) => ({ ...facet.input, outpointTransactionHash: outpoint(VALIDATOR + 1 + at) })),
      input(USER, callerUnlockingBytecode()),
      input(CALLEE, new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(calleeBlock)), ...encodeDataPush(CALLEE_SELECTOR),
        ...encodeDataPush(CALLEE_PROGRAM),
      ])),
    ];
    const facetOutputs = FACETS.map((facet) => facet.output);
    const sourceOutputs = [
      callerMaster, record(BEFORE), validatorOutput, ...facetOutputs,
      { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n }, calleeMaster,
    ];
    const outputs = [
      callerMaster, record(AFTER), validatorOutput, ...facetOutputs,
      { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n }, calleeMaster,
    ];
    const transaction: VmTransaction = { version: 2, inputs, outputs, locktime: 0 };
    const vm = compositionMachine();
    const accepted = (inputIndex: number): boolean =>
      vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })) === true;
    return {
      caller: accepted(CALLER),
      validator: accepted(VALIDATOR) && FACETS.every((_, at) => accepted(VALIDATOR + 1 + at)),
    };
  }

  it('FM-1 accepts the genuine validator and rejects a bare-lock stand-in', () => {
    expect(spend(false), 'FM-1 authorized').toEqual({ caller: true, validator: true });
    expect(spend(true).caller, 'FM-1 bare-lock validator').toBe(false);
  });
});

describe('FW-1 and FW-2 against the genuine validator', () => {
  const CATEGORY_COUNTER = seededCategory('fw counter');
  const CATEGORY_POKER = seededCategory('fw poker');
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
  const COUNTER_ROOT = 0;
  const POKER_ROOT = 1;
  const COUNTER_CALLED = 2;
  const COUNTER_VALIDATOR = 3;
  const COUNTER_FACET = 4;
  const COUNTER_RECORD = 7;
  const token = (category: Uint8Array, capability: 'minting' | 'mutable', commitment: Uint8Array = new Uint8Array(0)): VmOutput['token'] =>
    ({ category, amount: 0n, nft: { capability, commitment } });

  function settlement(mode: 'honest' | 'reset' | 'delete'): Record<string, boolean> {
    const counterValidator = validatorSpend(CATEGORY_COUNTER, {
      roots: [COUNTER_ROOT, POKER_ROOT],
      masters: [COUNTER_ROOT, POKER_ROOT, COUNTER_CALLED],
      settles: [{ category: CATEGORY_COUNTER, stateInputs: [COUNTER_RECORD] }],
    });
    const rootEntry = mode === 'reset'
      ? { in: INDEX_NONE, out: COUNTER_RECORD, viewIn: ZEROS, viewOut: counterView(1n) }
      : { in: COUNTER_RECORD, out: COUNTER_RECORD, viewIn: counterView(5n), viewOut: counterView(6n) };
    const calledHonest = mode === 'reset'
      ? { in: COUNTER_RECORD, out: COUNTER_RECORD, viewIn: counterView(1n), viewOut: counterView(2n) }
      : { in: COUNTER_RECORD, out: COUNTER_RECORD, viewIn: counterView(6n), viewOut: counterView(7n) };
    const calledEntries = mode === 'delete'
      ? [calledHonest, { in: COUNTER_RECORD, out: INDEX_NONE, viewIn: counterView(7n), viewOut: counterView(7n) }]
      : [calledHonest];
    const written = mode === 'reset' ? counterView(2n) : mode === 'delete' ? counterView(1000n) : counterView(7n);
    const rootBlock: WitnessBlock = {
      kind: 0, callerRef: 9, originRef: 9, validatorRef: COUNTER_VALIDATOR,
      sender: USER_LOCK, self: ADDRESS_COUNTER, value: 0n, retval: new Uint8Array(0), calls: [],
      segments: [[rootEntry]], events: [], sends: [],
    };
    const pokerBlock: WitnessBlock = {
      kind: 0, callerRef: 9, originRef: 9, validatorRef: COUNTER_VALIDATOR,
      sender: USER_LOCK, self: ADDRESS_POKER, value: 0n, retval: new Uint8Array(0),
      calls: [{
        kind: 1, target: ADDRESS_COUNTER, value: 0n, calleeRef: COUNTER_CALLED,
        argsHash: argsHash(BUMP_SELECTOR, new Uint8Array(0)), result: new Uint8Array(0),
      }],
      segments: [
        [{ in: 8, out: 8, viewIn: POKER_VIEW, viewOut: POKER_VIEW }],
        [{ in: 8, out: 8, viewIn: POKER_VIEW, viewOut: POKER_VIEW }],
      ],
      events: [], sends: [],
    };
    const calledBlock: WitnessBlock = {
      kind: 1, callerRef: POKER_ROOT, originRef: 9, validatorRef: COUNTER_VALIDATOR,
      sender: ADDRESS_POKER, self: ADDRESS_COUNTER, value: 0n, retval: new Uint8Array(0), calls: [],
      segments: [calledEntries], events: [], sends: [],
    };
    const counterLock = encodeLockingBytecodeP2sh32(hash256(COUNTER_PROGRAM));
    const pokerLock = encodeLockingBytecodeP2sh32(hash256(POKER_PROGRAM));
    const facet = validatorFacetPlacements()[0]!;
    const input = (fill: number, unlockingBytecode: Uint8Array): VmTransaction['inputs'][number] => ({
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(fill), sequenceNumber: 0xffffffff,
      unlockingBytecode,
    });
    const inputs = [
      input(1, new Uint8Array([...encodeDataPush(encodeWitnessBlock(rootBlock)), ...encodeDataPush(COUNTER_PROGRAM)])),
      input(2, new Uint8Array([...encodeDataPush(encodeWitnessBlock(pokerBlock)), ...encodeDataPush(POKER_PROGRAM)])),
      input(3, new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(calledBlock)), ...encodeDataPush(BUMP_SELECTOR),
        ...encodeDataPush(COUNTER_PROGRAM),
      ])),
      input(4, counterValidator.unlockingBytecode),
      input(5, facet.input.unlockingBytecode),
      input(6, encodeDataPush(new Uint8Array([1]))),
      input(7, encodeDataPush(new Uint8Array([1]))),
      input(8, encodeDataPush(new Uint8Array([1]))),
      input(9, encodeDataPush(new Uint8Array([1]))),
      input(10, callerUnlockingBytecode()),
    ];
    const masters: VmOutput[] = [
      { lockingBytecode: counterLock, valueSatoshis: 20_000n, token: token(CATEGORY_COUNTER, 'minting') },
      { lockingBytecode: pokerLock, valueSatoshis: 20_000n, token: token(CATEGORY_POKER, 'minting') },
      { lockingBytecode: counterLock, valueSatoshis: 20_000n, token: token(CATEGORY_COUNTER, 'minting') },
      { lockingBytecode: counterValidator.lock, valueSatoshis: 20_000n, token: token(CATEGORY_COUNTER, 'mutable') },
      { lockingBytecode: facet.output.lockingBytecode, valueSatoshis: 20_000n },
      { lockingBytecode: USER_LOCK, valueSatoshis: 20_000n },
      { lockingBytecode: USER_LOCK, valueSatoshis: 20_000n },
    ];
    const sourceOutputs: VmProgram['sourceOutputs'] = [
      ...masters,
      { lockingBytecode: dataRecordLock(CATEGORY_COUNTER), valueSatoshis: 20_000n, token: token(CATEGORY_COUNTER, 'mutable', counterView(5n)) },
      { lockingBytecode: dataRecordLock(CATEGORY_POKER), valueSatoshis: 20_000n, token: token(CATEGORY_POKER, 'mutable', POKER_VIEW) },
      { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
    ];
    const outputs: VmOutput[] = [
      ...masters,
      { lockingBytecode: dataRecordLock(CATEGORY_COUNTER), valueSatoshis: 20_000n, token: token(CATEGORY_COUNTER, 'mutable', written) },
      { lockingBytecode: dataRecordLock(CATEGORY_POKER), valueSatoshis: 20_000n, token: token(CATEGORY_POKER, 'mutable', POKER_VIEW) },
      { lockingBytecode: USER_LOCK, valueSatoshis: 90_000n },
    ];
    const transaction: VmTransaction = { version: 2, inputs, outputs, locktime: 0 };
    const vm = compositionMachine();
    const accepted = (inputIndex: number): boolean =>
      vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })) === true;
    return {
      counterRoot: accepted(COUNTER_ROOT),
      counterCalled: accepted(COUNTER_CALLED),
      counterValidator: accepted(COUNTER_VALIDATOR),
      counterFacet: accepted(COUNTER_FACET),
    };
  }

  it('FW-1 a created-form declaration at a spent record does not reset it, and the honest chain does', () => {
    expect(settlement('honest'), 'FW-1 authorized').toEqual({
      counterRoot: true, counterCalled: true, counterValidator: true, counterFacet: true,
    });
    expect(settlement('reset').counterValidator, 'FW-1 zeroed record').toBe(false);
  });

  it('FV-1 a created-form record at a spent record\'s input index is refused, and the honest chain is not', () => {
    expect(settlement('honest').counterValidator, 'FV-1 authorized').toBe(true);
    expect(settlement('reset').counterValidator, 'FV-1 created form at a spent index').not.toBe(true);
  });

  it('FW-2 a trailing delete does not exempt a written record, and the honest write does', () => {
    expect(settlement('honest').counterCalled, 'FW-2 authorized').toBe(true);
    expect(settlement('delete').counterCalled, 'FW-2 trailing delete').toBe(false);
  });
});
