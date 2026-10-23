import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import {
  asmToScript, buildPushdataCommitment, computeFunctionSelector, computeFunctionSignature, encodeWitnessBlock,
  scriptToBytecode, sha256, validatorAddress, type RecordEntry, type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, categorySlotValue, dataRecordLock, seededCategory } from './validator-input.js';

/**
 * A stateful master whose entries are reached through its own dispatcher reads its state where its frame says it
 * is.
 *
 * The dispatcher hands each entry to an `OP_INVOKE`d body, which shares the head's frame. The state the body
 * reads is not at a fixed offset from the master's own input: the record is wherever the frame's first segment
 * declared it, and the body has to read that declaration out of the frame it is running on. Each case below
 * compiles the source through the shipped compiler, fills the deployment slots the way a deployment fills them,
 * and asks the BCH-2026 machine for a verdict on the master's own input.
 */

const CATEGORY = seededCategory('dispatched state');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const ADDRESS = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
const OWNER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(9));
/** The data record sits at the data-NFT covenant, which the master pins. */
const RECORD_LOCK = dataRecordLock(CATEGORY);
const VALUE = 20_000n;

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Dispatch {'
  + '   int public counter;'
  + '   function bump() { this.counter = this.counter + 1; require(this.counter > 0); }'
  + '   function clear() { this.counter = 0; require(this.counter == 0); }'
  + ' }';

const artifact = compileString(SOURCE, { composition: 'framed' });
const program = fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), artifact.composition!.placeholders, {
  category: categorySlotValue(CATEGORY), contractAddress: ADDRESS, templateHash: TEMPLATE_HASH,
});
const lock = encodeLockingBytecodeP2sh32(hash256(program));
const SELECTOR = computeFunctionSelector(computeFunctionSignature('bump', []));

/** A data-NFT commitment holding one integer, in the shipped encoder's form. */
const commitment = (counter: bigint): Uint8Array =>
  new Uint8Array(Buffer.from(buildPushdataCommitment(artifact.stateLayout!, { counter }, 0), 'hex'));

const BEFORE = commitment(5n);
const AFTER = commitment(6n);

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmInput = NonNullable<VmProgram['transaction']>['inputs'][number];
type VmOutput = NonNullable<VmProgram['transaction']>['outputs'][number];

const token = (
  category: Uint8Array,
  capability: 'minting' | 'mutable' | 'none',
  commitmentBytes: Uint8Array = new Uint8Array(0),
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable' | 'none'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment: commitmentBytes } });

const MASTER_INDEX = 1;
const CALLER_INDEX = 0;
const NEAR_RECORD = 2;
const FAR_RECORD = 3;

interface Options {
  /** Put the record at the last index instead of right after its master. */
  readonly recordLast?: boolean;
  /** The segment's declaration, defaulting to a kept record at the index the layout puts it. */
  readonly declared?: (record: number) => RecordEntry;
  /** The commitment the state output actually carries. */
  readonly outputCommitment?: Uint8Array;
}

function build(options: Options = {}): Omit<VmProgram, 'inputIndex'> {
  const record = options.recordLast === true ? FAR_RECORD : NEAR_RECORD;
  const declaration = options.declared?.(record)
    ?? { in: record, out: record, viewIn: BEFORE, viewOut: AFTER };

  const block: WitnessBlock = {
    kind: 0,
    callerRef: CALLER_INDEX,
    originRef: CALLER_INDEX,
    validatorRef: 0xffff,
    sender: OWNER_LOCK,
    self: ADDRESS,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [],
    segments: [[declaration]],
    events: [],
    sends: [],
  };

  const plainInput = (fillByte: number): VmInput => ({
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(fillByte),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: encodeDataPush(new Uint8Array([1])),
  });

  const inputs: VmInput[] = [];
  const outputs: VmOutput[] = [];
  const sourceOutputs: VmProgram['sourceOutputs'] = [];
  inputs[CALLER_INDEX] = {
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(7), sequenceNumber: 0xffffffff,
    unlockingBytecode: callerUnlockingBytecode(),
  };
  outputs[CALLER_INDEX] = { lockingBytecode: OWNER_LOCK, valueSatoshis: 100_000n };
  sourceOutputs[CALLER_INDEX] = outputs[CALLER_INDEX];
  inputs[MASTER_INDEX] = {
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(2), sequenceNumber: 0xffffffff,
    unlockingBytecode: new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(block)), ...encodeDataPush(SELECTOR), ...encodeDataPush(program),
    ]),
  };
  outputs[MASTER_INDEX] = {
    lockingBytecode: lock, valueSatoshis: VALUE, token: token(CATEGORY, 'minting'),
  };
  sourceOutputs[MASTER_INDEX] = outputs[MASTER_INDEX];
  // Every index the record does not take carries a plain input and output, so the settlement's census has an
  // input to walk that holds no token of the contract's category.
  for (const index of [NEAR_RECORD, FAR_RECORD]) {
    if (index === record) continue;
    inputs[index] = plainInput(index + 2);
    outputs[index] = { lockingBytecode: OWNER_LOCK, valueSatoshis: VALUE };
    sourceOutputs[index] = outputs[index];
  }
  inputs[record] = plainInput(record + 2);
  outputs[record] = {
    lockingBytecode: RECORD_LOCK,
    valueSatoshis: VALUE,
    token: token(CATEGORY, 'mutable', options.outputCommitment ?? AFTER),
  };
  sourceOutputs[record] = {
    lockingBytecode: RECORD_LOCK, valueSatoshis: VALUE, token: token(CATEGORY, 'mutable', BEFORE),
  };

  return { sourceOutputs, transaction: { version: 2, inputs, outputs, locktime: 0 } };
}

/** The master input's verdict in the BCH-2026 machine. */
function verdict(options: Options = {}): boolean {
  const built = build(options);
  const vm = compositionMachine();
  return vm.stateSuccess(vm.evaluate({
    inputIndex: MASTER_INDEX, sourceOutputs: built.sourceOutputs, transaction: built.transaction,
  })) === true;
}

describe('a stateful master whose entries are dispatched', () => {
  it('publishes a dispatcher selector for each entry', () => {
    expect(SELECTOR.length).toBe(4);
    expect(artifact.stateLayout).toBeDefined();
  });

  it('reads and writes its record where the frame declares it, right after the master', () => {
    expect(verdict()).toBe(true);
  });

  it('reads and writes its record when the layout puts it away from the master', () => {
    // The body reaches the record through the index its own frame declared, so a layout that does not put the
    // record next to the master is as good as one that does.
    expect(verdict({ recordLast: true })).toBe(true);
  });

  it('is refused when the frame declares an index the transaction holds no record at', () => {
    // The record is at the far index, and the declaration names the near one, which the body would then read.
    const misdeclared = (): RecordEntry =>
      ({ in: NEAR_RECORD, out: NEAR_RECORD, viewIn: BEFORE, viewOut: AFTER });
    expect(verdict({ recordLast: true, declared: misdeclared })).toBe(false);
    expect(verdict()).toBe(true);
  });

  it('writes to the record index its frame declared, not to the one that precedes it', () => {
    // The declaration and the output carry counter `7`, while the body computed `6` from the commitment it read:
    // the write only refuses if the body read the spent commitment and compared against the output it declared.
    const seven = commitment(7n);
    expect(verdict({
      declared: (record) => ({ in: record, out: record, viewIn: BEFORE, viewOut: seven }),
      outputCommitment: seven,
    })).toBe(false);
    expect(verdict()).toBe(true);
  });
});
