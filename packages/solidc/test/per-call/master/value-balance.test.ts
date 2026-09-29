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
import { fillPlaceholders } from '../../../src/per-call/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory } from './validator-input.js';

/**
 * `address(this).balance` in a per-call master (spec 4b): the value of the containers the transaction spends, with
 * the frame's value credited and the sends the body has made so far taken out, as the EVM's balance stands at that
 * point of the execution.
 */

const CATEGORY = seededCategory('value balance');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const ADDRESS = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const CONTAINER_LOCK = encodeLockingBytecodeP2sh32(
  hash256(scriptToBytecode(buildSatoshiContainerCovenantScript(CATEGORY))),
);

type Artifact = ReturnType<typeof compileString>;
type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Bank {'
  + '   receive() external payable { require(true); }'
  + '   function check(int expected) { require(address(this).balance == expected); }'
  + '   function top(int expected) payable { require(address(this).balance == expected); }'
  + '   function sweep() { this.transfer(msg.sender, address(this).balance); }'
  + '   function spend(int amount, int expected) {'
  + '     this.transfer(msg.sender, amount);'
  + '     require(address(this).balance == expected);'
  + '   }'
  + ' }';

const OTHER_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Peek {'
  + '   function peek(address who) { require(who.balance > 0); }'
  + '   function own() { require(address(this).balance >= 0); }'
  + ' }';

const artifact: Artifact = compileString(SOURCE, { composition: 'per-call' });

function deployed(): { program: Uint8Array; lock: Uint8Array } {
  const { placeholders } = artifact.composition!;
  const program = fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), placeholders, {
    category: categorySlotValue(CATEGORY),
    contractAddress: ADDRESS,
    ...(placeholders.templateHashOffset === undefined ? {} : { templateHash: TEMPLATE_HASH }),
  });
  return { program, lock: encodeLockingBytecodeP2sh32(hash256(program)) };
}

const selectorOf = (entry: string): Uint8Array =>
  Uint8Array.from(Buffer.from(artifact.abi.find((row) => row.name === entry)!.selector!, 'hex'));
const container = (value: bigint): VmOutput => ({ lockingBytecode: CONTAINER_LOCK, valueSatoshis: value });
const payment = (value: bigint): VmOutput => ({ lockingBytecode: USER_LOCK, valueSatoshis: value });

interface Spend {
  readonly entry: string;
  readonly args: readonly Uint8Array[];
  readonly value?: bigint;
  readonly containersIn: readonly bigint[];
  /** The outputs after the master and the user's change: the first at index 2. */
  readonly trailing: readonly VmOutput[];
  readonly sends?: readonly number[];
}

function verdict(spend: Spend): { accepted: boolean; objection?: string } {
  const { program, lock } = deployed();
  const block: WitnessBlock = {
    kind: 0, callerRef: 1, originRef: 1, validatorRef: 0xffff, sender: USER_LOCK, self: ADDRESS,
    value: spend.value ?? 0n, retval: new Uint8Array(0), calls: [], segments: [[]], events: [],
    sends: [...(spend.sends ?? [])],
  };
  const input = (fill: number, unlockingBytecode: Uint8Array): VmTransaction['inputs'][number] => ({
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(fill), sequenceNumber: 0xffffffff,
    unlockingBytecode,
  });
  const master: VmOutput = {
    lockingBytecode: lock, valueSatoshis: 20_000n,
    token: { category: CATEGORY, amount: 0n, nft: { capability: 'minting', commitment: new Uint8Array(0) } },
  };
  const transaction: VmTransaction = {
    version: 2,
    inputs: [
      input(1, new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(block)),
        ...encodeArgumentList([selectorOf(spend.entry), ...spend.args]),
        ...encodeDataPush(program),
      ])),
      input(2, callerUnlockingBytecode()),
      ...spend.containersIn.map((_, index) => input(3 + index, encodeDataPush(new Uint8Array([1])))),
    ],
    outputs: [master, payment(1_000n), ...spend.trailing],
    locktime: 0,
  };
  const sourceOutputs: VmProgram['sourceOutputs'] = [
    master, payment(100_000n), ...spend.containersIn.map(container),
  ];
  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex: 0, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

const int = (value: bigint): Uint8Array => encodeIntegerValue(value);

describe('address(this).balance, compiled per-call', () => {
  it('is the value of the containers the transaction spends', () => {
    const spend = (expected: bigint): { accepted: boolean } => verdict({
      entry: 'check', args: [int(expected)], containersIn: [30_000n, 20_000n], trailing: [container(50_000n)],
    });
    expect(spend(50_000n)).toStrictEqual({ accepted: true });
    expect(spend(49_999n).accepted).toBe(false);
  });

  it('credits the value the frame receives', () => {
    const spend = (expected: bigint): { accepted: boolean } => verdict({
      entry: 'top', args: [int(expected)], value: 10_000n, containersIn: [50_000n], trailing: [container(60_000n)],
    });
    expect(spend(60_000n)).toStrictEqual({ accepted: true });
    expect(spend(50_000n).accepted).toBe(false);
  });

  it('takes out what the body has already sent', () => {
    const spend = (expected: bigint): { accepted: boolean } => verdict({
      entry: 'spend',
      // The first parameter's push lands last.
      args: [int(expected), int(10_000n)],
      containersIn: [50_000n],
      trailing: [container(40_000n), payment(10_000n)],
      sends: [3],
    });
    expect(spend(40_000n)).toStrictEqual({ accepted: true });
    expect(spend(50_000n).accepted).toBe(false);
  });

  it('pays out the whole balance', () => {
    expect(verdict({
      entry: 'sweep', args: [], containersIn: [30_000n, 20_000n], trailing: [container(1_000n), payment(50_000n)],
      sends: [3],
    })).toStrictEqual({ accepted: true });
    expect(verdict({
      entry: 'sweep', args: [], containersIn: [30_000n, 20_000n], trailing: [container(1_000n), payment(49_999n)],
      sends: [3],
    }).accepted).toBe(false);
  });

  it('is published for the builder, which spends every container for an entry that reads it', () => {
    const readers = (artifact.composition as { balanceReaders?: readonly string[] }).balanceReaders;
    expect(readers).toStrictEqual(['Bank.check()', 'Bank.top()', 'Bank.sweep()', 'Bank.spend()']);
  });

  it('refuses by name a body that reads another address\'s balance', () => {
    const other = compileString(OTHER_SOURCE, { composition: 'per-call' });
    const refused = other.composition!.refusedEntries ?? [];
    expect(refused.map((entry) => entry.functionName)).toStrictEqual(['Peek.peek()']);
    expect(refused[0]!.reason).toMatch(/reads the balance of an address other than its own/);
  });
});
