import { describe, expect, it } from 'vitest';
import {
  encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import {
  asmToScript, buildPushdataCommitment, encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress,
  type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../../solidc/src/compiler.js';
import { fillPlaceholders } from '../../../../solidc/src/framed/master/placeholders.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { SIGHASH_ALL, callerUnlockingBytecode } from '../frames/caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, categorySlotValue, dataRecordLock, seededCategory,
} from '../../../../solidc/test/framed/master/validator-input.js';

/**
 * The census a standalone master runs over the transaction's own state UTXOs.
 *
 * A master that stands alone settles the record its segment declares. It compares each input's own token against
 * the index the segment declared, so a record the frame declares but the transaction does not spend fails the walk.
 * The other census refusals on the same contract (an undeclared state UTXO, and a declaration that does not start
 * at the spent commitment or end at the written one) are in `solidc/test/framed/master/record-settlement.test.ts`.
 *
 * The source is compiled framed, the reserved slots are filled the way a deployment fills them, and the verdict
 * is the BCH-2026 machine's on a real transaction. The refusal is shown beside the spend it mutates.
 */

const CATEGORY = seededCategory('hostile record census');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const ADDRESS = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
/** A state record's lock: the entry only requires input and output to agree, so any lock serves. */
const STATE_LOCK = dataRecordLock(CATEGORY);

const SOURCE = 'pragma solidcash ^0.14.0;'
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

const artifact = compileString(SOURCE, { composition: 'framed' });
const program = fillPlaceholders(
  scriptToBytecode(asmToScript(artifact.bytecode)),
  artifact.composition!.placeholders,
  { category: categorySlotValue(CATEGORY), contractAddress: ADDRESS, templateHash: TEMPLATE_HASH },
);
const masterLock = encodeLockingBytecodeP2sh32(hash256(program));
const MASTER_VALUE = 20_000n;
const USER_VALUE = 100_000n;

/** A data-NFT commitment holding one integer, in the shipped encoder's form. */
function commitment(counter: bigint): Uint8Array {
  return new Uint8Array(Buffer.from(buildPushdataCommitment(artifact.stateLayout!, { counter }, 0), 'hex'));
}

const BEFORE = commitment(5n);
const AFTER = commitment(6n);
const EMPTY = new Uint8Array(0);

const token = (
  capability: 'minting' | 'mutable',
  commitmentBytes: Uint8Array = EMPTY,
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: Uint8Array } } =>
  ({ category: CATEGORY, amount: 0n, nft: { capability, commitment: commitmentBytes } });

interface SpendOptions {
  /** Give the record's input no token, so the transaction does not actually spend a state UTXO there. */
  readonly inputIsNotARecord?: boolean;
}

/** Builds the standalone master, its declared record and the user, and evaluates the master's own input. */
function evaluate(options: SpendOptions = {}): { accepted: boolean; objection?: string } {
  const recordInputHasToken = options.inputIsNotARecord !== true;
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
      viewIn: recordInputHasToken ? BEFORE : EMPTY,
      viewOut: AFTER,
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
  const recordInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(2),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: encodeDataPush(new Uint8Array([1])),
  };
  const userInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(4),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: callerUnlockingBytecode(SIGHASH_ALL),
  };

  const masterOutput = { lockingBytecode: masterLock, valueSatoshis: MASTER_VALUE, token: token('minting') };
  const recordOutput = { lockingBytecode: STATE_LOCK, valueSatoshis: MASTER_VALUE, token: token('mutable', AFTER) };
  const userOutput = { lockingBytecode: USER_LOCK, valueSatoshis: USER_VALUE };

  const inputs = [masterInput, recordInput, userInput];
  const outputs = [masterOutput, recordOutput, userOutput];

  const masterSource = { lockingBytecode: masterLock, valueSatoshis: MASTER_VALUE, token: token('minting') };
  const recordSource = {
    lockingBytecode: STATE_LOCK,
    valueSatoshis: MASTER_VALUE,
    ...(recordInputHasToken ? { token: token('mutable', BEFORE) } : {}),
  };
  const userSource = { lockingBytecode: USER_LOCK, valueSatoshis: USER_VALUE };
  const sourceOutputs = [masterSource, recordSource, userSource];

  const transaction = { version: 2, inputs, outputs, locktime: 0 };
  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex: MASTER_INDEX, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

describe('a standalone master settles exactly the record its segment declares', () => {
  it('accepts a declaration that matches the record the transaction spends and writes', () => {
    expect(evaluate()).toStrictEqual({ accepted: true });
  });

  it('refuses a record the frame declares but the transaction does not spend', () => {
    // The segment names input 1, but that input carries no state token: the frame claims to settle a record that
    // is not there. The control spends the very record the same declaration names.
    const declared = evaluate({ inputIsNotARecord: true });
    expect(declared.accepted).toBe(false);
    expect(declared.objection).toBeDefined();
    expect(evaluate()).toStrictEqual({ accepted: true });
  });
});
