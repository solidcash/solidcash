import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
  hexToBin,
} from '@bitauth/libauth';
import {
  asmToScript, buildPushdataCommitment, buildSatoshiContainerCovenantScript, encodeArgumentList, encodeIntegerValue,
  encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress, type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, categorySlotValue, dataRecordLock, seededCategory } from './validator-input.js';

/**
 * A master that settles its record alone keeps the record's value whether or not its frame sends (D2, T39).
 *
 * A send is paid from the contract's containers (spec 4b), never from its record, so a frame that sends has no claim
 * on the record's value: the record written back holds at least what it held, as a frame that sends nothing keeps
 * it. That holds for a record the body writes, one it only reads, and one it never touches but its frame declares.
 */

const CATEGORY = seededCategory('record value send');
const ADDRESS = validatorAddress(CATEGORY, REAL_VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
/** A state record's lock: the master only requires the record's input and output to agree. */
const STATE_LOCK = dataRecordLock(CATEGORY);
const CONTAINER_LOCK = encodeLockingBytecodeP2sh32(
  hash256(scriptToBytecode(buildSatoshiContainerCovenantScript(CATEGORY))),
);
const RECORD_VALUE = 20_000n;
const AMOUNT = 10_000n;

type Access = 'writes' | 'reads' | 'ignores';
const ACCESS: Record<Access, string> = {
  writes: ' this.paid = this.paid + amount;',
  reads: ' require(this.paid >= 0);',
  ignores: '',
};

/** The entry's access to the record, with and without the send that follows it. */
const source = (access: Access, sends: boolean): string => 'pragma solidcash ^0.14.0;'
  + ' contract Till {'
  + '   int paid;'
  + `   function pay(int amount) {${ACCESS[access]}${sends ? ' this.transfer(msg.sender, amount);' : ''}`
  + ' require(true); }'
  + ' }';

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

/** The master's verdict on a frame that declares the record and writes it back holding `recordOut`. */
function verdict(access: Access, sends: boolean, recordOut: bigint): boolean {
  const artifact = compileString(source(access, sends), { composition: 'framed' });
  const program = fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), artifact.composition!.placeholders, {
    category: categorySlotValue(CATEGORY), contractAddress: ADDRESS, templateHash: sha256(REAL_VALIDATOR_PROGRAM),
  });
  const commitment = (paid: bigint): Uint8Array =>
    hexToBin(buildPushdataCommitment(artifact.stateLayout!, { paid }, 0));
  const after = access === 'writes' ? 5n + AMOUNT : 5n;
  const token = (capability: 'minting' | 'mutable', bytes: Uint8Array = new Uint8Array(0)): VmOutput['token'] =>
    ({ category: CATEGORY, amount: 0n, nft: { capability, commitment: bytes } });
  // Inputs: the master, its record, the user, then the container a send pays from.
  const block: WitnessBlock = {
    kind: 0, callerRef: 2, originRef: 2, validatorRef: 0xffff, sender: USER_LOCK, self: ADDRESS, value: 0n,
    retval: new Uint8Array(0), calls: [],
    segments: [[{ in: 1, out: 1, viewIn: commitment(5n), viewOut: commitment(after) }]],
    events: [], sends: sends ? [4] : [],
  };
  const input = (fill: number, unlockingBytecode: Uint8Array): VmTransaction['inputs'][number] => ({
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(fill), sequenceNumber: 0xffffffff,
    unlockingBytecode,
  });
  const master: VmOutput = {
    lockingBytecode: encodeLockingBytecodeP2sh32(hash256(program)), valueSatoshis: RECORD_VALUE, token: token('minting'),
  };
  const record = (value: bigint, paid: bigint): VmOutput =>
    ({ lockingBytecode: STATE_LOCK, valueSatoshis: value, token: token('mutable', commitment(paid)) });
  const user: VmOutput = { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n };
  const container = (value: bigint): VmOutput => ({ lockingBytecode: CONTAINER_LOCK, valueSatoshis: value });
  const transaction: VmTransaction = {
    version: 2,
    inputs: [
      input(1, new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(block)), ...encodeArgumentList([encodeIntegerValue(AMOUNT)]),
        ...encodeDataPush(program),
      ])),
      input(2, encodeDataPush(new Uint8Array([1]))),
      input(3, callerUnlockingBytecode()),
      ...(sends ? [input(4, encodeDataPush(new Uint8Array([1])))] : []),
    ],
    outputs: [
      master, record(recordOut, after), user,
      ...(sends ? [container(50_000n - AMOUNT), { lockingBytecode: USER_LOCK, valueSatoshis: AMOUNT }] : []),
    ],
    locktime: 0,
  };
  const sourceOutputs = [master, record(RECORD_VALUE, 5n), user, ...(sends ? [container(50_000n)] : [])];
  const vm = compositionMachine();
  return vm.stateSuccess(vm.evaluate({ inputIndex: 0, sourceOutputs, transaction })) === true;
}

describe('a record a master settles alone keeps its value', () => {
  for (const access of ['writes', 'reads', 'ignores'] as const) {
    for (const sends of [false, true]) {
      it(`when the entry ${access} it${sends ? ' and pays a send from a container' : ' and sends nothing'}`, () => {
        expect(verdict(access, sends, RECORD_VALUE)).toBe(true);
        expect(verdict(access, sends, RECORD_VALUE - 1_000n)).toBe(false);
      });
    }
  }
});
