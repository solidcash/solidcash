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
import { buildMasterHeadScript } from '../../../src/framed/master/master-head.js';
import { findPlaceholderOffsets } from '../../../src/framed/master/master-program.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, categorySlotValue, dataRecordLock, seededCategory, validatorSpend,
} from './validator-input.js';

/**
 * A compiled master that runs as a DELEGATE frame on another contract's records.
 *
 * A proxy's fallback delegatecalls its implementation, so the implementation's master runs on the proxy's records
 * with the proxy's `address(this)` and `msg.sender`. A state site in that frame checks a record's category against
 * the category of the contract the records belong to - the caller's, not the code that executes - so the head
 * leaves the records' owner as a slot and the check resolves through it. A frame that owns its records leaves its
 * own input in that slot, which is what a root, message-call or read-only frame resolves to either way.
 *
 * The contract under test is compiled through the shipped entry point and its record written the way a deployment
 * writes one; the caller is a stand-in master whose frame the validator covers, and the record carries the caller's
 * category. The machine's own verdict on the implementation input is the assertion, so the accept is the check
 * under test and the refusals are the same transaction with the record's category mutated.
 */

const CATEGORY_PROXY = seededCategory('delegate frame proxy');
const CATEGORY_IMPL = seededCategory('delegate frame implementation');
const CATEGORY_OTHER = seededCategory('delegate frame other');
/** The shipped validator program. The masters hash it, and the validator input runs it. */
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const ADDRESS_IMPL = validatorAddress(CATEGORY_IMPL, VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
/** A record's lock: the entry only requires input and output to agree, so any lock serves. */
const RECORD_LOCK = dataRecordLock(CATEGORY_PROXY);

const CALLER_INDEX = 0;
const IMPL_INDEX = 1;
const VALIDATOR_INDEX = 2;
const RECORD_INDEX = 3;
const USER_INDEX = 4;

/** The implementation: one integer field and a writing entry, which reads and writes the record it runs on. */
const IMPL_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Counter {'
  + '   int public counter;'
  + '   function increment() {'
  + '     this.counter = this.counter + 1;'
  + '     require(this.counter > 0);'
  + '   }'
  + ' }';

const implArtifact = compileString(IMPL_SOURCE, { composition: 'framed' });
const implProgram = fillPlaceholders(
  scriptToBytecode(asmToScript(implArtifact.bytecode)),
  implArtifact.composition!.placeholders,
  { category: categorySlotValue(CATEGORY_IMPL), contractAddress: ADDRESS_IMPL, templateHash: TEMPLATE_HASH },
);
const implLock = encodeLockingBytecodeP2sh32(hash256(implProgram));
const MASTER_VALUE = 20_000n;
const USER_VALUE = 100_000n;

/** A data-NFT commitment holding one integer, in the shipped encoder's form. */
const commitment = (counter: bigint): Uint8Array =>
  hexToBin(buildPushdataCommitment(implArtifact.stateLayout!, { counter }, 0));

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

/**
 * The caller: a stand-in master whose UTXO carries the caller's category, which is what the implementation's
 * record-category check resolves to. The implementation never reads its program, so the test evaluates only the
 * implementation's input; this input exists to be the records' owner and to carry the token that names it.
 */
const callerProgram = ((): Uint8Array => {
  const head = buildMasterHeadScript({ blockOnTop: true });
  const filled = fillPlaceholders(
    head.script,
    { version: 1, ...findPlaceholderOffsets(head.script, head.validatorHashSlotOffset !== undefined) },
    { category: categorySlotValue(CATEGORY_PROXY), contractAddress: new Uint8Array(35) },
  );
  // The head leaves the four frame values, the category-owner index and the block's declared call count; the body
  // drops them and accepts.
  return new Uint8Array([
    ...filled,
    Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP,
    Opcodes.OP_1,
  ]);
})();
const callerLock = encodeLockingBytecodeP2sh32(hash256(callerProgram));

interface CompositionOptions {
  /** The category the records carry. The caller's own category is what a delegate frame's records must carry. */
  readonly recordCategory?: Uint8Array;
  /** Change the category of the record output alone, so only the write side is mutated. */
  readonly outputRecordCategory?: Uint8Array;
}

/** Builds the composition and evaluates the implementation's master input. */
function evaluate(options: CompositionOptions = {}): { accepted: boolean; objection?: string } {
  const recordCategory = options.recordCategory ?? CATEGORY_PROXY;
  const outputCategory = options.outputRecordCategory ?? recordCategory;

  const validator = validatorSpend(CATEGORY_PROXY, {
    roots: [CALLER_INDEX], masters: [CALLER_INDEX, IMPL_INDEX], settles: [],
  });

  const callerBlock: WitnessBlock = {
    kind: 0,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender: USER_LOCK,
    self: callerLock,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [{
      kind: 3,
      target: ADDRESS_IMPL,
      value: 0n,
      calleeRef: IMPL_INDEX,
      argsHash: sha256(new Uint8Array(0)),
      result: new Uint8Array(0),
    }],
    segments: [[], []],
    events: [],
    sends: [],
  };
  // The implementation runs on the caller's records: its `address(this)` and `msg.sender` are the caller's, which
  // the validator binds, and it settles no record of its own.
  const implBlock: WitnessBlock = {
    kind: 3,
    callerRef: CALLER_INDEX,
    originRef: USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender: USER_LOCK,
    self: callerLock,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [],
    segments: [[{ in: RECORD_INDEX, out: RECORD_INDEX, viewIn: BEFORE, viewOut: AFTER }]],
    events: [],
    sends: [],
  };

  const inputs = [
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(1),
      sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(callerBlock)), ...encodeDataPush(callerProgram),
      ]),
    },
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(2),
      sequenceNumber: 0xffffffff,
      // The delegate call carries the callee's call data: the selector the fallback forwarded, which a master with
      // one entry requires to be that entry's own.
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(implBlock)),
        ...encodeDataPush(hexToBin(implArtifact.abi.find((row) => row.name === 'increment')!.selector!)),
        ...encodeDataPush(implProgram),
      ]),
    },
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(3),
      sequenceNumber: 0xffffffff,
      unlockingBytecode: validator.unlockingBytecode,
    },
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(5),
      sequenceNumber: 0xffffffff,
      unlockingBytecode: encodeDataPush(new Uint8Array([1])),
    },
    {
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(4),
      sequenceNumber: 0xffffffff,
      unlockingBytecode: callerUnlockingBytecode(),
    },
  ];
  const outputs = [
    { lockingBytecode: callerLock, valueSatoshis: MASTER_VALUE, token: token(CATEGORY_PROXY, 'minting') },
    { lockingBytecode: implLock, valueSatoshis: MASTER_VALUE, token: token(CATEGORY_IMPL, 'minting') },
    { lockingBytecode: validator.lock, valueSatoshis: MASTER_VALUE, token: token(CATEGORY_PROXY, 'mutable') },
    { lockingBytecode: RECORD_LOCK, valueSatoshis: MASTER_VALUE, token: token(outputCategory, 'mutable', AFTER) },
    { lockingBytecode: USER_LOCK, valueSatoshis: USER_VALUE },
  ];
  const sourceOutputs = [
    { lockingBytecode: callerLock, valueSatoshis: MASTER_VALUE, token: token(CATEGORY_PROXY, 'minting') },
    { lockingBytecode: implLock, valueSatoshis: MASTER_VALUE, token: token(CATEGORY_IMPL, 'minting') },
    { lockingBytecode: validator.lock, valueSatoshis: MASTER_VALUE, token: token(CATEGORY_PROXY, 'mutable') },
    { lockingBytecode: RECORD_LOCK, valueSatoshis: MASTER_VALUE, token: token(recordCategory, 'mutable', BEFORE) },
    { lockingBytecode: USER_LOCK, valueSatoshis: USER_VALUE },
  ];

  const transaction: VmTransaction = { version: 2, inputs, outputs, locktime: 0 };
  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex: IMPL_INDEX, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String(state.error) };
}

describe('a compiled master running as a delegate frame', () => {
  it('is emitted as a framed master', () => {
    expect(implArtifact.composition?.convention).toBe('framed');
  });

  it('is accepted when the record carries the caller\'s category', () => {
    expect(evaluate()).toStrictEqual({ accepted: true });
  });

  it('is refused when the record carries a foreign category', () => {
    expect(evaluate({ recordCategory: CATEGORY_OTHER }).accepted).toBe(false);
  });

  it('is refused when the record carries the executing code\'s own category', () => {
    // The records belong to the caller, so the implementation's own category is not the one they are pinned with.
    expect(evaluate({ recordCategory: CATEGORY_IMPL }).accepted).toBe(false);
  });

  it('is refused when only the written record carries a foreign category', () => {
    expect(evaluate({ outputRecordCategory: CATEGORY_OTHER }).accepted).toBe(false);
  });
});
