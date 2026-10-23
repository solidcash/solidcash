import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import {
  asmToScript, encodeArgumentList, encodeIntegerValue, encodeWitnessBlock, scriptToBytecode, sha256,
  validatorAddress,
  type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { categorySlotValue, seededCategory } from './validator-input.js';

/**
 * Arithmetic beside an integer literal in a framed body: the literal takes the bounded operand's type, as Solidity
 * converts it, so the result is range-checked, and wraps inside `unchecked`. Each entry's condition holds for every
 * integer, so only the result's range can refuse it.
 */

const CATEGORY = seededCategory('checked literal');
const VALIDATOR_PROGRAM = new Uint8Array([0x51, 0x52]);
const ADDRESS = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(Uint8Array.from({ length: 20 }, (_, index) => 0x60 + index));
const outpointHash = (first: number): Uint8Array => Uint8Array.from({ length: 32 }, (_, index) => first + index);

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Bounds {'
  + '   function inc(uint8 a) { require(a + 1 > a); }'
  + '   function dec(uint256 a) { require(a - 1 < a); }'
  + '   function lead(uint256 a) { require(1 - a <= 1); }'
  + '   function signedDec(int8 a) { require(a - 1 < a); }'
  + '   function compound(uint8 a) { uint8 b = a; b += 1; require(b > a); }'
  + '   function postfix(uint8 a) { uint8 b = a; uint8 c = b++; require(b > c); }'
  + '   function wraps(uint8 a) { unchecked { require(a - 1 == 255); } }'
  + '   function widened(uint8 a) { require(a * 10000 / 10000 == a); }'
  + '   function widenedLead(uint8 a) { require(10000 * a / 10000 == a); }'
  + '   function widenedSum(uint8 a) { require(a + 1000 > a); }'
  + '   function widenedWraps(uint8 a) { unchecked { require(a * 10000 == 50000); } }'
  + '   function noCommonType(int8 a) { require(a * 300 / 300 == a); }'
  + ' }';
const ARTIFACT = compileString(SOURCE, { composition: 'framed' });
const PROGRAM = fillPlaceholders(scriptToBytecode(asmToScript(ARTIFACT.bytecode)), ARTIFACT.composition!.placeholders, {
  category: categorySlotValue(CATEGORY), contractAddress: ADDRESS, templateHash: TEMPLATE_HASH,
});

/** The machine's verdict on a user's frame calling `entry` with `argument`. */
function spend(entry: string, argument: bigint): boolean {
  const selector = Uint8Array.from(Buffer.from(ARTIFACT.abi.find((row) => row.name === entry)!.selector!, 'hex'));
  const block: WitnessBlock = {
    kind: 0, callerRef: 0, originRef: 0, validatorRef: 0xffff, sender: USER_LOCK, self: ADDRESS, value: 0n,
    retval: new Uint8Array(0), calls: [], segments: [[]], events: [], sends: [],
  };
  const master: VmOutput = {
    lockingBytecode: encodeLockingBytecodeP2sh32(hash256(PROGRAM)), valueSatoshis: 20_000n,
    token: { category: CATEGORY, amount: 0n, nft: { capability: 'minting', commitment: new Uint8Array(0) } },
  };
  const callData = [selector, encodeIntegerValue(argument)];
  const transaction: VmTransaction = {
    version: 2,
    inputs: [
      {
        outpointIndex: 0, outpointTransactionHash: outpointHash(0x01), sequenceNumber: 0xffffffff,
        unlockingBytecode: callerUnlockingBytecode(),
      },
      {
        outpointIndex: 0, outpointTransactionHash: outpointHash(0x41), sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array([
          ...encodeDataPush(encodeWitnessBlock(block)), ...encodeArgumentList(callData), ...encodeDataPush(PROGRAM),
        ]),
      },
    ],
    outputs: [{ lockingBytecode: USER_LOCK, valueSatoshis: 100_000n }, master],
    locktime: 0,
  };
  const sourceOutputs = [{ lockingBytecode: USER_LOCK, valueSatoshis: 100_000n }, master];
  const vm = compositionMachine(false);
  return vm.stateSuccess(vm.evaluate({ inputIndex: 1, sourceOutputs, transaction })) === true;
}

describe('arithmetic beside an integer literal in a framed body', () => {
  it.each([
    ['a + 1 on a uint8', 'inc', 254n, 255n],
    ['a - 1 on a uint256', 'dec', 1n, 0n],
    ['1 - a on a uint256', 'lead', 1n, 2n],
    ['a - 1 on an int8', 'signedDec', -127n, -128n],
    ['b += 1 on a uint8', 'compound', 254n, 255n],
    ['b++ read as a value on a uint8', 'postfix', 254n, 255n],
  ])('checks %s', (_shape, entry, inside, past) => {
    expect([spend(entry, inside), spend(entry, past)]).toStrictEqual([true, false]);
  });

  it('wraps a - 1 on a uint8 inside unchecked, as Solidity does', () => {
    expect([spend('wraps', 0n), spend('wraps', 1n)]).toStrictEqual([true, false]);
  });

  // A literal that does not fit the bounded operand gives the operation the literal's own smallest type, as
  // Solidity's common type does: `a * 10000` on a uint8 is checked, and wraps, as a uint16.
  it.each([
    ['a * 10000 on a uint8, as a uint16', 'widened', 6n, 7n],
    ['10000 * a on a uint8, as a uint16', 'widenedLead', 6n, 7n],
  ])('checks %s', (_shape, entry, inside, past) => {
    expect([spend(entry, inside), spend(entry, past)]).toStrictEqual([true, false]);
  });

  it('accepts a + 1000 on a uint8 at its top, which a uint8 result would refuse', () => {
    expect([spend('widenedSum', 0n), spend('widenedSum', 255n)]).toStrictEqual([true, true]);
  });

  it('wraps a * 10000 on a uint8 as a uint16 inside unchecked', () => {
    expect([spend('widenedWraps', 5n), spend('widenedWraps', 7n)]).toStrictEqual([true, false]);
  });

  it('keeps the bounded type and its check where the literal\'s type takes no int8', () => {
    expect([spend('noCommonType', 0n), spend('noCommonType', 1n)]).toStrictEqual([true, false]);
  });
});
