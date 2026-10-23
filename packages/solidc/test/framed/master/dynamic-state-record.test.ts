import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
  hexToBin,
} from '@bitauth/libauth';
import {
  asmToScript, buildChunkCommitment, buildEntryNftCovenantScript, buildPushdataCommitment,
  computeCollectionHash, dynamicChunkSignature, encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress,
  type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, categorySlotValue, dataRecordLock, seededCategory } from './validator-input.js';

/**
 * A framed master whose state is a string, settled on the BCH-2026 machine.
 *
 * A `string` state variable is not held in its data NFT: the NFT carries the value's length, and the bytes live in
 * a run of 120-byte chunk NFTs. The direct convention's SDK computes where that run starts from the entry's
 * physical block layout and hands the coordinate to the body as an argument. A framed master takes no argument
 * list, so it derives the same coordinate from the record block its own frame declares and the layout's width, and
 * the body reads it from the head.
 *
 * The transaction below lays the run out the way that derivation reads it: the record block at indexes 2 and 3,
 * away from the master at index 0, with the chunk run immediately past the block. Both records are declared per
 * segment and both are recreated in place. A coordinate taken from the master's own input rather than from the
 * declaration would land on index 2 and read the state record as a chunk, so the accept below is the derivation's.
 * The entry appends a byte to the value, so the body reassembles the old chunk, writes the longer value's chunk,
 * and updates the length header - the whole read-modify-write path. Each refusal is paired with the accept it
 * mutates.
 */

const CATEGORY = seededCategory('dynamic state record');
const TEMPLATE_HASH = sha256(REAL_VALIDATOR_PROGRAM);
const ADDRESS = validatorAddress(CATEGORY, REAL_VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
/** The state record's lock: the entry only requires the input and output to agree, so any lock serves. */
const STATE_LOCK = dataRecordLock(CATEGORY);

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Named {'
  + '   string public name;'
  + '   function append() { this.name = string.concat(this.name, "!"); }'
  + ' }';

const MASTER_INDEX = 0;
const USER_INDEX = 1;
const STATE_INDEX = 2;
const CHUNK_INDEX = 3;

const artifact = compileString(SOURCE, { composition: 'framed' });
const program = fillPlaceholders(
  scriptToBytecode(asmToScript(artifact.bytecode)),
  artifact.composition!.placeholders,
  { category: categorySlotValue(CATEGORY), contractAddress: ADDRESS, templateHash: TEMPLATE_HASH },
);
const masterLock = encodeLockingBytecodeP2sh32(hash256(program));
const MASTER_VALUE = 20_000n;
const STATE_VALUE = 20_000n;
const CHUNK_VALUE = 1_000n;
const USER_VALUE = 100_000n;

/** The chunk collection's own covenant address: the run's NFTs are locked by the collection it belongs to. */
const CHUNK_LOCK = encodeLockingBytecodeP2sh32(hash256(scriptToBytecode(buildEntryNftCovenantScript(
  CATEGORY, computeCollectionHash(dynamicChunkSignature('name', 'string')),
))));

/** A chunk's unlocking bytecode: the master whose write authorizes it, and the flag that takes the write path. */
const CHUNK_UNLOCKING_BYTECODE = new Uint8Array([0x00, 0x51]);

const utf8 = (text: string): Uint8Array => new Uint8Array(Buffer.from(text, 'utf8'));
const OLD_VALUE = utf8('AB');
const NEW_VALUE = utf8('AB!');

/** The data NFT's commitment for a value of this length: the length header, as the shipped encoder writes it. */
const lengthHeader = (value: Uint8Array): Uint8Array =>
  hexToBin(buildPushdataCommitment(artifact.stateLayout!, { name: value }, 0));
const chunkCommitment = (index: number, value: Uint8Array): Uint8Array =>
  hexToBin(buildChunkCommitment(index, value));

const BEFORE = lengthHeader(OLD_VALUE);
const AFTER = lengthHeader(NEW_VALUE);

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

function token(
  category: Uint8Array, capability: 'minting' | 'mutable' | 'none', commitmentBytes: Uint8Array = new Uint8Array(0),
): VmOutput['token'] {
  return { category, amount: 0n, nft: { capability, commitment: commitmentBytes } };
}

interface SpendOptions {
  /** The length header the transaction actually writes, when it differs from the one the body computed. */
  readonly writtenHeader?: Uint8Array;
  /** The chunk the transaction writes, when it differs from the one the body computed. */
  readonly writtenChunk?: Uint8Array;
  /** The chunk the transaction spends, when it differs from the one the segment declares. */
  readonly spentChunk?: Uint8Array;
  /** Drop the segment's declaration of the chunk run. */
  readonly undeclaredChunk?: boolean;
}

/** Builds the master, its record and the chunk run, and evaluates the master's own input. */
function evaluate(options: SpendOptions = {}): { accepted: boolean; objection?: string } {
  const spentChunk = options.spentChunk ?? chunkCommitment(0, OLD_VALUE);
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
    segments: [[
      { in: STATE_INDEX, out: STATE_INDEX, viewIn: BEFORE, viewOut: options.writtenHeader ?? AFTER },
      ...(options.undeclaredChunk === true
        ? []
        : [{
          in: CHUNK_INDEX,
          out: CHUNK_INDEX,
          viewIn: spentChunk,
          viewOut: options.writtenChunk ?? chunkCommitment(0, NEW_VALUE),
        }]),
    ]],
    events: [],
    sends: [],
  };

  const masterInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(1),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: new Uint8Array([...encodeDataPush(encodeWitnessBlock(block)), ...encodeDataPush(program)]),
  };
  const userInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(4),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: callerUnlockingBytecode(),
  };
  const stateInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(2),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: encodeDataPush(new Uint8Array([1])),
  };
  const chunkInput = {
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(3),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: CHUNK_UNLOCKING_BYTECODE,
  };

  const masterOutput = { lockingBytecode: masterLock, valueSatoshis: MASTER_VALUE, token: token(CATEGORY, 'minting') };
  const userOutput = { lockingBytecode: USER_LOCK, valueSatoshis: USER_VALUE };
  const stateOutput = {
    lockingBytecode: STATE_LOCK,
    valueSatoshis: STATE_VALUE,
    token: token(CATEGORY, 'mutable', options.writtenHeader ?? AFTER),
  };
  const chunkOutput = {
    lockingBytecode: CHUNK_LOCK,
    valueSatoshis: CHUNK_VALUE,
    token: token(CATEGORY, 'mutable', options.writtenChunk ?? chunkCommitment(0, NEW_VALUE)),
  };

  const transaction: VmTransaction = {
    version: 2,
    inputs: [masterInput, userInput, stateInput, chunkInput],
    outputs: [masterOutput, userOutput, stateOutput, chunkOutput],
    locktime: 0,
  };
  const sourceOutputs = [
    masterOutput,
    { lockingBytecode: USER_LOCK, valueSatoshis: USER_VALUE },
    { lockingBytecode: STATE_LOCK, valueSatoshis: STATE_VALUE, token: token(CATEGORY, 'mutable', BEFORE) },
    { lockingBytecode: CHUNK_LOCK, valueSatoshis: CHUNK_VALUE, token: token(CATEGORY, 'mutable', spentChunk) },
  ];

  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex: MASTER_INDEX, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String(state.error) };
}

describe('a framed master whose state is a string', () => {
  it('is emitted as a framed master', () => {
    expect(artifact.composition?.convention).toBe('framed');
  });

  it('is accepted when the declared records chain from what the transaction spends to what it writes', () => {
    expect(evaluate()).toStrictEqual({ accepted: true });
  });

  it('is refused when the segment does not declare the chunk run it spends', () => {
    expect(evaluate({ undeclaredChunk: true }).accepted).toBe(false);
  });

  it('is refused when the declared chunk viewIn is not the commitment the transaction spends', () => {
    expect(evaluate({ spentChunk: chunkCommitment(0, utf8('ZZ')) }).accepted).toBe(false);
  });

  it('is refused when the written chunk is not the one the body computed', () => {
    expect(evaluate({ writtenChunk: chunkCommitment(0, utf8('XY')) }).accepted).toBe(false);
  });

  it('is refused when the written length header is not the one the body computed', () => {
    expect(evaluate({ writtenHeader: BEFORE }).accepted).toBe(false);
  });
});
