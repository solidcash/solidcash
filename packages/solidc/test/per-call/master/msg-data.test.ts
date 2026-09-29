import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import {
  asmToScript, computeFunctionSelector, computeFunctionSignature, encodeArgumentList, encodeIntegerValue,
  encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress,
  type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/per-call/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { categorySlotValue, seededCategory } from './validator-input.js';

/**
 * `msg.data` in a per-call master: the frame's call data, the selector's push and the argument pushes, as the EVM's
 * is the calldata; empty for a value send, whose call data is the selector of `receive()` alone.
 */

const CATEGORY = seededCategory('msg data');
const VALIDATOR_PROGRAM = new Uint8Array([0x51, 0x52]);
const ADDRESS = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(9));
const OTHER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(7));
const RECEIVE_SELECTOR = computeFunctionSelector(computeFunctionSignature('__receive', []));

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

const SELF = '   function self(bytes expected) { require(address(this) == expected); }';
const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Probe {'
  + '   function data(int length) { require(msg.data.length == length); }'
  + SELF
  + '   receive() external payable { require(msg.data.length == 0); }'
  + ' }';
/** The control: the same entries without a read of `msg.data`. */
const PLAIN_SOURCE = `pragma solidcash ^0.13.0; contract Probe { function data(int length) { require(length > 0); }${SELF} }`;

/** The machine's verdict on a user's frame into the compiled source carrying `callData`. */
function spend(source: string, callData: readonly Uint8Array[]): boolean {
  const artifact = compileString(source, { composition: 'per-call' });
  const program = fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), artifact.composition!.placeholders, {
    category: categorySlotValue(CATEGORY), contractAddress: ADDRESS, templateHash: TEMPLATE_HASH,
  });
  const block: WitnessBlock = {
    kind: 0, callerRef: 0, originRef: 0, validatorRef: 0xffff, sender: USER_LOCK, self: ADDRESS, value: 0n,
    retval: new Uint8Array(0), calls: [], segments: [[]], events: [], sends: [],
  };
  const master: VmOutput = {
    lockingBytecode: encodeLockingBytecodeP2sh32(hash256(program)), valueSatoshis: 20_000n,
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
          ...encodeDataPush(encodeWitnessBlock(block)), ...encodeArgumentList(callData), ...encodeDataPush(program),
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

const selectorOf = (source: string, entry: string): Uint8Array => Uint8Array.from(Buffer.from(
  compileString(source, { composition: 'per-call' }).abi.find((row) => row.name === entry)!.selector!, 'hex',
));

describe('msg.data in a per-call master', () => {
  it('leaves the frame values where every entry reads them', () => {
    // The control: the same entry in a contract that never reads msg.data.
    expect(spend(PLAIN_SOURCE, [selectorOf(PLAIN_SOURCE, 'self'), ADDRESS])).toBe(true);
    expect(spend(SOURCE, [selectorOf(SOURCE, 'self'), ADDRESS])).toBe(true);
    expect(spend(SOURCE, [selectorOf(SOURCE, 'self'), OTHER_LOCK])).toBe(false);
  });

  it('is the frame\'s call data', () => {
    // The selector's push (five bytes) and the length's (one byte, a small number's own opcode).
    const data = selectorOf(SOURCE, 'data');
    expect(encodeArgumentList([data, encodeIntegerValue(6n)]).length).toBe(6);
    expect(spend(SOURCE, [data, encodeIntegerValue(6n)])).toBe(true);
    expect(spend(SOURCE, [data, encodeIntegerValue(7n)])).toBe(false);
  });

  it('is empty for the selector of receive() alone', () => {
    expect(spend(SOURCE, [RECEIVE_SELECTOR])).toBe(true);
  });

  it('is refused by name in a master with one entry, whose user frame carries no selector', () => {
    const sole = 'pragma solidcash ^0.13.0; contract Sole { function only() { require(msg.data.length > 0); } }';
    expect(() => compileString(sole, { composition: 'per-call' })).toThrow(/msg\.data in a master with one entry/);
  });
});
