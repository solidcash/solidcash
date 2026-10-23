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
import { compileString, compileStringMulti } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, VALIDATOR_INPUT_SPAN, categorySlotValue, seededCategory, validatorFacetPlacements,
  validatorSpend,
} from './validator-input.js';

/**
 * A framed `fallback()` at the EVM's dispatch: a selector a body has runs that body, and any other runs the
 * fallback, with the call data as its input. A value send carries the selector of `receive()` alone, the EVM's
 * empty call data, so a contract without `receive()` takes it in a payable fallback, whose input is then empty.
 *
 * Every case is a real transaction asked of the BCH-2026 machine, so the verdict is which body the call data reached.
 */

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

const RECEIVE_SELECTOR = computeFunctionSelector(computeFunctionSignature('__receive', []));
const MISSING_SELECTOR = computeFunctionSelector('missing()');

describe('a framed master with a fallback, entered by a user', () => {
  const CATEGORY = seededCategory('fallback dispatch');
  const VALIDATOR_PROGRAM = new Uint8Array([0x51, 0x52]);
  const ADDRESS = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
  const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
  const OWNER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(9));
  const OTHER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(7));
  // `bump` and the fallback require different facts, so a verdict names the body that ran.
  const SOURCE = 'pragma solidcash ^0.14.0;'
    + ' contract Sink(address owner, bytes expected) {'
    + '   function bump() { require(msg.sender == owner); }'
    + '   fallback(bytes input) external { require(input == expected); }'
    + ' }';
  const artifact = compileString(SOURCE, { composition: 'framed' });
  const BUMP_SELECTOR = new Uint8Array(Buffer.from(artifact.abi.find((entry) => entry.name === 'bump')!.selector!,
    'hex'));
  const FALLBACK_SELECTOR = new Uint8Array(Buffer.from(
    artifact.abi.find((entry) => entry.name === '__fallback')!.selector!, 'hex',
  ));

  /** The machine's verdict on the master for a user's frame carrying `callData`. */
  function spend(callData: readonly Uint8Array[], expected: Uint8Array, owner: Uint8Array = OWNER_LOCK): boolean {
    const filled = fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)),
      artifact.composition!.placeholders, {
        category: categorySlotValue(CATEGORY), contractAddress: ADDRESS, templateHash: TEMPLATE_HASH,
      });
    // `expected` is declared last, so the unlocker pushes it before `owner`.
    const redeemScript = new Uint8Array([...encodeDataPush(expected), ...encodeDataPush(owner), ...filled]);
    const lock = encodeLockingBytecodeP2sh32(hash256(redeemScript));
    const block: WitnessBlock = {
      kind: 0,
      callerRef: 0,
      originRef: 0,
      validatorRef: 0xffff,
      sender: OWNER_LOCK,
      self: ADDRESS,
      value: 0n,
      retval: new Uint8Array(0),
      calls: [],
      segments: [[]],
      events: [],
      sends: [],
    };
    const master: VmOutput = {
      lockingBytecode: lock,
      valueSatoshis: 20_000n,
      token: { category: CATEGORY, amount: 0n, nft: { capability: 'minting', commitment: new Uint8Array(0) } },
    };
    const transaction: VmTransaction = {
      version: 2,
      inputs: [
        {
          outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(7), sequenceNumber: 0xffffffff,
          unlockingBytecode: callerUnlockingBytecode(),
        },
        {
          outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(2), sequenceNumber: 0xffffffff,
          unlockingBytecode: new Uint8Array([
            ...encodeDataPush(encodeWitnessBlock(block)),
            ...callData.flatMap((push) => [...encodeDataPush(push)]),
            ...encodeDataPush(redeemScript),
          ]),
        },
      ],
      outputs: [{ lockingBytecode: OWNER_LOCK, valueSatoshis: 100_000n }, master],
      locktime: 0,
    };
    const sourceOutputs = [{ lockingBytecode: OWNER_LOCK, valueSatoshis: 100_000n }, master];
    const vm = compositionMachine(false);
    return vm.stateSuccess(vm.evaluate({ inputIndex: 1, sourceOutputs, transaction })) === true;
  }

  /** The call data band a frame carries: each push as the unlocking bytecode encodes it. */
  const band = (callData: readonly Uint8Array[]): Uint8Array =>
    new Uint8Array(callData.flatMap((push) => [...encodeDataPush(push)]));

  it('runs the body a known selector names', () => {
    expect(spend([BUMP_SELECTOR], new Uint8Array([1]))).toBe(true);
    expect(spend([BUMP_SELECTOR], new Uint8Array([1]), OTHER_LOCK)).toBe(false);
  });

  it('runs the fallback for a selector no body has, with the call data as its input', () => {
    const callData = [MISSING_SELECTOR, new Uint8Array([7]), new Uint8Array(40).fill(3)];
    expect(spend(callData, band(callData))).toBe(true);
    // Another input is refused, so the fallback is the body that ran, on the whole band.
    expect(spend(callData, band([MISSING_SELECTOR, new Uint8Array([8]), new Uint8Array(40).fill(3)]))).toBe(false);
    expect(spend([MISSING_SELECTOR], band([MISSING_SELECTOR]))).toBe(true);
    // The owner `bump` requires is not the fallback's concern.
    expect(spend([MISSING_SELECTOR], band([MISSING_SELECTOR]), OTHER_LOCK)).toBe(true);
  });

  it('reaches the fallback through no selector of its own', () => {
    expect(spend([FALLBACK_SELECTOR], band([FALLBACK_SELECTOR]))).toBe(true);
  });

  it('hands the fallback empty call data for a frame carrying the selector of receive() alone', () => {
    expect(spend([RECEIVE_SELECTOR], new Uint8Array(0))).toBe(true);
    expect(spend([RECEIVE_SELECTOR], band([RECEIVE_SELECTOR]))).toBe(false);
    // The selector of receive() with arguments is call data like any other.
    const callData = [RECEIVE_SELECTOR, new Uint8Array([7])];
    expect(spend(callData, band(callData))).toBe(true);
  });
});

describe('a contract paying another contract that has a fallback, compiled framed', () => {
  const CATEGORY_PAYER = seededCategory('value fallback payer');
  const CATEGORY_PAYEE = seededCategory('value fallback payee');
  const TEMPLATE_HASH = sha256(REAL_VALIDATOR_PROGRAM);
  const ADDRESS_PAYER = validatorAddress(CATEGORY_PAYER, REAL_VALIDATOR_PROGRAM);
  const ADDRESS_PAYEE = validatorAddress(CATEGORY_PAYEE, REAL_VALIDATOR_PROGRAM);
  const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
  const containerLock = (category: Uint8Array): Uint8Array => encodeLockingBytecodeP2sh32(
    hash256(scriptToBytecode(buildSatoshiContainerCovenantScript(category))),
  );
  const PAYER_CONTAINER = containerLock(CATEGORY_PAYER);
  const PAYEE_CONTAINER = containerLock(CATEGORY_PAYEE);
  const AMOUNT = 10_000n;
  const SOURCE = 'pragma solidcash ^0.14.0;'
    + ' contract Tip { function note() { require(true); } fallback() external payable { require(msg.value > 0); } }'
    + ' contract Sole { fallback() external payable { require(msg.value > 0); } }'
    + ' contract Quiet { function note() { require(true); }'
    + '   fallback(bytes input) external payable { require(input.length == 0); } }'
    + ' contract Closed { function note() { require(true); } fallback() external { require(true); } }'
    + ' contract Refuses { function note() { require(true); } fallback() external payable { require(false); } }'
    + ' contract Both { receive() external payable { require(true); } fallback() external payable { require(false); } }'
    + ' contract Payer { function pay(bytes to, int amount) { this.transfer(to, amount); require(true); } }';
  const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });

  const program = (name: string, category: Uint8Array, address: Uint8Array): Uint8Array => {
    const artifact = artifacts[name]!;
    return fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), artifact.composition!.placeholders, {
      category: categorySlotValue(category), contractAddress: address, templateHash: TEMPLATE_HASH,
    });
  };
  const token = (category: Uint8Array, capability: 'minting' | 'mutable'): VmOutput['token'] =>
    ({ category, amount: 0n, nft: { capability, commitment: new Uint8Array(0) } });

  /** Every contract input's verdict for a payment of `AMOUNT` to `payee`, whose containers receive `payeeOut`. */
  function verdicts(payee: string, payeeOut: bigint = AMOUNT): Record<'payer' | 'payee' | 'validator', boolean> {
    const payerProgram = program('Payer', CATEGORY_PAYER, ADDRESS_PAYER);
    const payeeProgram = program(payee, CATEGORY_PAYEE, ADDRESS_PAYEE);
    const validator = validatorSpend(CATEGORY_PAYER, { roots: [0], masters: [0, 1], settles: [] });
    const facets = validatorFacetPlacements();
    // Inputs: the payer, the payee, the validator with its facet, then the user and the container.
    const userIndex = 2 + VALIDATOR_INPUT_SPAN;
    const payerBlock: WitnessBlock = {
      kind: 0,
      callerRef: userIndex,
      originRef: userIndex,
      validatorRef: 2,
      sender: USER_LOCK,
      self: ADDRESS_PAYER,
      value: 0n,
      retval: new Uint8Array(0),
      calls: [{
        kind: 1,
        target: ADDRESS_PAYEE,
        value: AMOUNT,
        calleeRef: 1,
        argsHash: sha256(RECEIVE_SELECTOR),
        result: new Uint8Array(0),
      }],
      segments: [[], []],
      events: [],
      sends: [],
    };
    const payeeBlock: WitnessBlock = {
      kind: 1,
      callerRef: 0,
      originRef: userIndex,
      validatorRef: 2,
      sender: ADDRESS_PAYER,
      self: ADDRESS_PAYEE,
      value: AMOUNT,
      retval: new Uint8Array(0),
      calls: [],
      segments: [[]],
      events: [],
      sends: [],
    };
    const input = (fill: number, unlockingBytecode: Uint8Array): VmTransaction['inputs'][number] => ({
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(fill), sequenceNumber: 0xffffffff,
      unlockingBytecode,
    });
    const inputs = [
      input(1, new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(payerBlock)),
        ...encodeArgumentList([encodeIntegerValue(AMOUNT), ADDRESS_PAYEE]),
        ...encodeDataPush(payerProgram),
      ])),
      input(2, new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(payeeBlock)), ...encodeDataPush(RECEIVE_SELECTOR),
        ...encodeDataPush(payeeProgram),
      ])),
      input(3, validator.unlockingBytecode),
      ...facets.map((facet) => facet.input),
      input(4, callerUnlockingBytecode()),
      input(5, encodeDataPush(new Uint8Array([1]))),
    ];
    const participants: VmOutput[] = [
      {
        lockingBytecode: encodeLockingBytecodeP2sh32(hash256(payerProgram)), valueSatoshis: 20_000n,
        token: token(CATEGORY_PAYER, 'minting'),
      },
      {
        lockingBytecode: encodeLockingBytecodeP2sh32(hash256(payeeProgram)), valueSatoshis: 20_000n,
        token: token(CATEGORY_PAYEE, 'minting'),
      },
      { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(CATEGORY_PAYER, 'mutable') },
      ...facets.map((facet) => facet.output),
    ];
    const sourceOutputs: VmProgram['sourceOutputs'] = [
      ...participants,
      { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
      { lockingBytecode: PAYER_CONTAINER, valueSatoshis: 50_000n },
    ];
    const outputs: VmOutput[] = [
      ...participants,
      { lockingBytecode: USER_LOCK, valueSatoshis: 1_000n },
      { lockingBytecode: PAYEE_CONTAINER, valueSatoshis: payeeOut },
      { lockingBytecode: PAYER_CONTAINER, valueSatoshis: 40_000n },
    ];
    const transaction: VmTransaction = { version: 2, inputs, outputs, locktime: 0 };
    const vm = compositionMachine();
    const accepted = (inputIndex: number): boolean =>
      vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })) === true;
    return { payer: accepted(0), payee: accepted(1), validator: accepted(2) };
  }

  it('runs a payable fallback beside other entries when the payee has no receive()', () => {
    expect(verdicts('Tip')).toStrictEqual({ payer: true, payee: true, validator: true });
    // The control: a fallback that refuses is the body the value send reached.
    expect(verdicts('Refuses').payee).toBe(false);
  });

  it('runs a payable fallback that is the contract\'s only body', () => {
    expect(verdicts('Sole')).toStrictEqual({ payer: true, payee: true, validator: true });
  });

  it('hands the fallback empty call data for the value send', () => {
    expect(verdicts('Quiet')).toStrictEqual({ payer: true, payee: true, validator: true });
  });

  it('is refused by the payee when its containers receive less than the value', () => {
    expect(verdicts('Tip', AMOUNT - 1n).payee).toBe(false);
    expect(verdicts('Sole', AMOUNT - 1n).payee).toBe(false);
  });

  it('is refused by a payee whose fallback is not payable', () => {
    expect(verdicts('Closed').payee).toBe(false);
  });

  it('runs receive() rather than the fallback when the payee has both', () => {
    expect(verdicts('Both')).toStrictEqual({ payer: true, payee: true, validator: true });
  });
});
