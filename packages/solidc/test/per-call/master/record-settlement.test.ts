import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256, hexToBin, Opcodes,
} from '@bitauth/libauth';
import {
  asmToScript, buildPushdataCommitment, encodeWitnessBlock, scriptToBytecode, sha256,
  validatorAddress, type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/per-call/master/placeholders.js';
import { callerUnlockingBytecode } from './caller-input.js';

/**
 * A standalone master settles the record its entry reads and writes.
 *
 * The block declares, per segment, the whole commitment each record has at the segment's start and end. A master
 * that stands alone — its contract's only master, entered by a user, making no external call — is the one that
 * settles them: the declarations have to begin at the commitment the transaction spends and end at the commitment
 * it writes, and the state UTXOs spent have to be exactly the records it declared.
 *
 * The cases drive the real entry point: the source is compiled with `compileString` for the per-call convention,
 * the reserved slots are filled the way a deployment fills them, and the machine's own accept/reject verdict on the
 * master's input is the assertion. Each refusal is paired with the accept it mutates, so the refusal is the check
 * under test rather than a malformed transaction.
 *
 * A record's chain across several segments is not exercised here: self-settlement applies only to a master that
 * makes no external call, and a block with no call has one segment, so the cross-segment clause has nothing to
 * chain. That clause belongs to validator settlement, which this tree does not emit.
 */

const CATEGORY = new Uint8Array(32).fill(0x61);
/** The validator program; a standalone master never runs it and only needs its address. */
const VALIDATOR_PROGRAM = new Uint8Array([Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_1]);
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const ADDRESS = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
/** A state record's lock: the entry only requires input and output to agree, so any lock serves. */
const STATE_LOCK = encodeLockingBytecodeP2sh32(hash256(new Uint8Array([9, 9, 9])));

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Counter {'
  + '   int public counter;'
  + '   function increment() {'
  + '     this.counter = this.counter + 1;'
  + '     require(this.counter > 0);'
  + '   }'
  + ' }';

const MASTER_INDEX = 0;
const STATE_INDEX = 1;
const USER_INDEX = 2;

const artifact = compileString(SOURCE, { composition: 'per-call' });
const program = fillPlaceholders(
  scriptToBytecode(asmToScript(artifact.bytecode)),
  artifact.composition!.placeholders,
  { category: CATEGORY, contractAddress: ADDRESS, templateHash: TEMPLATE_HASH },
);
const masterLock = encodeLockingBytecodeP2sh32(hash256(program));
const MASTER_VALUE = 20_000n;
const USER_VALUE = 100_000n;

/** A data-NFT commitment holding one integer, in the shipped encoder's form. */
function commitment(counter: bigint): Uint8Array {
  return hexToBin(buildPushdataCommitment(artifact.stateLayout!, { counter }, 0));
}

const BEFORE = commitment(5n);
const AFTER = commitment(6n);

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

function token(
  category: Uint8Array,
  capability: 'minting' | 'mutable' | 'none',
  commitmentBytes: Uint8Array = new Uint8Array(0),
): VmOutput['token'] {
  return { category, amount: 0n, nft: { capability, commitment: commitmentBytes } };
}

interface SpendOptions {
  /** The commitment the segment declares the record starts at. */
  readonly viewIn?: Uint8Array;
  /** The commitment the segment declares the record ends at. */
  readonly viewOut?: Uint8Array;
  /** The commitment the state UTXO actually carries. */
  readonly inputCommitment?: Uint8Array;
  /** The commitment the state output actually carries. */
  readonly outputCommitment?: Uint8Array;
  /** The value the state output carries. */
  readonly outputValue?: bigint;
  /** Spend a second state UTXO the segment does not declare. */
  readonly undeclaredState?: boolean;
}

/** Builds the master, its record and the user's input, and evaluates the master's own input. */
function evaluate(options: SpendOptions = {}): { accepted: boolean; objection?: string } {
  const inputCommitment = options.inputCommitment ?? BEFORE;
  const outputCommitment = options.outputCommitment ?? AFTER;
  const block: WitnessBlock = {
    kind: 0,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: 0xffff,
    sender: USER_LOCK,
    self: ADDRESS,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [],
    segments: [[{
      in: STATE_INDEX,
      out: STATE_INDEX,
      viewIn: options.viewIn ?? BEFORE,
      viewOut: options.viewOut ?? AFTER,
    }]],
    events: [],
    sends: [],
  };

  const masterInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(1),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: new Uint8Array([...encodeDataPush(encodeWitnessBlock(block)), ...encodeDataPush(program)]),
  };
  const stateInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(2),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: encodeDataPush(new Uint8Array([1])),
  };
  const userInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(4),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: callerUnlockingBytecode(),
  };
  const undeclaredInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(5),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: encodeDataPush(new Uint8Array([1])),
  };

  const masterOutput = { lockingBytecode: masterLock, valueSatoshis: MASTER_VALUE, token: token(CATEGORY, 'minting') };
  const stateOutput = {
    lockingBytecode: STATE_LOCK,
    valueSatoshis: options.outputValue ?? MASTER_VALUE,
    token: token(CATEGORY, 'mutable', outputCommitment),
  };
  const userOutput = { lockingBytecode: USER_LOCK, valueSatoshis: USER_VALUE };

  const inputs = options.undeclaredState === true
    ? [masterInput, stateInput, undeclaredInput, userInput]
    : [masterInput, stateInput, userInput];
  const outputs = [masterOutput, stateOutput, userOutput];
  const sourceOutputs = [
    masterOutput,
    { lockingBytecode: STATE_LOCK, valueSatoshis: MASTER_VALUE, token: token(CATEGORY, 'mutable', inputCommitment) },
    { lockingBytecode: USER_LOCK, valueSatoshis: USER_VALUE },
    ...(options.undeclaredState === true
      ? [{ lockingBytecode: STATE_LOCK, valueSatoshis: MASTER_VALUE, token: token(CATEGORY, 'mutable', BEFORE) }]
      : []),
  ];

  const transaction: VmTransaction = { version: 2, inputs, outputs, locktime: 0 };
  const vm = createVirtualMachineBch2026(false);
  const state = vm.evaluate({ inputIndex: MASTER_INDEX, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String(state.error) };
}

describe('a standalone master that reads and writes a record', () => {
  it('publishes a per-call master whose record declaration matches the transaction', () => {
    expect(artifact.composition?.convention).toBe('per-call');
  });

  it('is accepted when the declared views chain from the spent commitment to the written one', () => {
    expect(evaluate()).toStrictEqual({ accepted: true });
  });

  it('is refused when the first viewIn is not the commitment the transaction spends', () => {
    expect(evaluate({ viewIn: AFTER }).accepted).toBe(false);
    // The input is untouched, so the refusal is the declaration's own check.
    expect(evaluate({ inputCommitment: BEFORE, viewIn: BEFORE }).accepted).toBe(true);
  });

  it('is refused when the last viewOut is not the commitment the transaction writes', () => {
    expect(evaluate({ viewOut: BEFORE }).accepted).toBe(false);
    expect(evaluate({ outputCommitment: AFTER, viewOut: AFTER }).accepted).toBe(true);
  });

  it('is refused when a state UTXO is spent that the segment does not declare', () => {
    expect(evaluate({ undeclaredState: true }).accepted).toBe(false);
    // The same transaction without the extra state UTXO is accepted.
    expect(evaluate({ undeclaredState: false }).accepted).toBe(true);
  });

  it('is refused when the record keeps less value than it held', () => {
    expect(evaluate({ outputValue: MASTER_VALUE - 1n }).accepted).toBe(false);
    expect(evaluate({ outputValue: MASTER_VALUE }).accepted).toBe(true);
  });
});
