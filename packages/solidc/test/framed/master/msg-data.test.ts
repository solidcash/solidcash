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
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { categorySlotValue, seededCategory } from './validator-input.js';

/**
 * `msg.data` in a framed master: the frame's call data, the selector's push and the argument pushes, as the EVM's
 * is the calldata; empty for a value send, whose call data is the selector of `receive()` alone. `msg.sig` in the
 * fallback and `receive()` is that call data's selector, zero when it is empty.
 */

const CATEGORY = seededCategory('msg data');
const VALIDATOR_PROGRAM = new Uint8Array([0x51, 0x52]);
const ADDRESS = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(9));
const OTHER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(7));
const RECEIVE_SELECTOR = computeFunctionSelector(computeFunctionSignature('__receive', []));
const MISSING_SELECTOR = computeFunctionSelector('missing()');

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

const SELF = '   function self(bytes expected) { require(address(this) == expected); }';
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Probe {'
  + '   function data(int length) { require(msg.data.length == length); }'
  + SELF
  + '   receive() external payable { require(msg.data.length == 0); }'
  + ' }';
/** The same reads through a helper, from an entry, the fallback and `receive()`. */
const HELPER_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Probe {'
  + '   function _data() internal returns (bytes) { return msg.data; }'
  + '   function data(int length) { require(_data().length == length); }'
  + '   fallback(bytes input) external { require(_data() == input); }'
  + '   receive() external payable { require(_data().length == 0); }'
  + ' }';
/** The control: the same entries without a read of `msg.data`. */
const PLAIN_SOURCE = `pragma solidcash ^0.14.0; contract Probe { function data(int length) { require(length > 0); }${SELF} }`;

/** The machine's verdict on a user's frame into the compiled source carrying `callData`. */
function spend(source: string, callData: readonly Uint8Array[]): boolean {
  const artifact = compileString(source, { composition: 'framed' });
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
  compileString(source, { composition: 'framed' }).abi.find((row) => row.name === entry)!.selector!, 'hex',
));

describe('msg.data in a framed master', () => {
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

  it('is the same call data read through a helper, from an entry, the fallback and receive()', () => {
    const data = selectorOf(HELPER_SOURCE, 'data');
    expect(spend(HELPER_SOURCE, [data, encodeIntegerValue(6n)])).toBe(true);
    expect(spend(HELPER_SOURCE, [data, encodeIntegerValue(7n)])).toBe(false);
    // The fallback's input is the frame's call data, so its helper reads the same bytes.
    expect(spend(HELPER_SOURCE, [MISSING_SELECTOR, encodeIntegerValue(7n)])).toBe(true);
    expect(spend(HELPER_SOURCE, [RECEIVE_SELECTOR])).toBe(true);
  });

  it('is refused by name in a master with one entry, whose user frame carries no selector', () => {
    const sole = 'pragma solidcash ^0.14.0; contract Sole { function only() { require(msg.data.length > 0); } }';
    expect(() => compileString(sole, { composition: 'framed' })).toThrow(/msg\.data in a master with one entry/);
  });
});

type SigBody = 'fallback(bytes input) external' | 'receive() external payable';

/** A contract whose `body` requires `msg.sig`, read directly and through a helper, to be `expected`. */
const sigSource = (body: SigBody, expected: Uint8Array): string => {
  const literal = `0x${Buffer.from(expected).toString('hex')}`;
  return 'pragma solidcash ^0.14.0;'
    + ' contract Sig {'
    + '   function only() { require(true); }'
    + '   function _sig() internal returns (bytes4) { return msg.sig; }'
    + `   ${body} { require(msg.sig == ${literal} && _sig() == ${literal}); }`
    + ' }';
};

describe('msg.sig in a framed fallback and receive()', () => {
  const FALLBACK: SigBody = 'fallback(bytes input) external';
  const RECEIVE: SigBody = 'receive() external payable';

  it('is the selector a call data no body has carries, in the fallback it reaches', () => {
    expect(spend(sigSource(FALLBACK, MISSING_SELECTOR), [MISSING_SELECTOR, encodeIntegerValue(7n)])).toBe(true);
    // The fallback's own selector is none the call data carries.
    const own = selectorOf(sigSource(FALLBACK, MISSING_SELECTOR), '__fallback');
    expect(spend(sigSource(FALLBACK, own), [MISSING_SELECTOR])).toBe(false);
  });

  it('is zero in the fallback a value send reaches, its call data empty', () => {
    expect(spend(sigSource(FALLBACK, new Uint8Array(4)), [RECEIVE_SELECTOR])).toBe(true);
  });

  it('is zero in receive(), as the EVM reads a value send\'s empty call data', () => {
    expect(spend(sigSource(RECEIVE, new Uint8Array(4)), [RECEIVE_SELECTOR])).toBe(true);
    expect(spend(sigSource(RECEIVE, RECEIVE_SELECTOR), [RECEIVE_SELECTOR])).toBe(false);
  });
});
