import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import {
  asmToScript, encodeIntegerValue, encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress,
  type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/per-call/master/placeholders.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory } from './validator-input.js';

/**
 * An entry that returns a fixed-size array, settled against the frame's witness `retval`.
 *
 * The frame compares the blob the entry's own `return` built with the bytes the block records, and a fixed array
 * is one value the language holds already encoded — under a Solidity import, the ABI words of its elements — so the
 * comparison is the one a scalar return makes. The source's element values and the expectations below come from one
 * list, and the words are built with the shipped integer encoder, so a case that agreed with the program by
 * construction could not pass: the machine is asked for a verdict in both directions.
 */

const CATEGORY = seededCategory('composite return');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const ADDRESS = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));

/** The elements the entry stores, which the source is generated from and the recorded value is built from. */
const VALUES = [1n, 2n, 3n, 4n, 5n];

const SOURCE = 'pragma solidity ^0.8.0;\n'
  + 'contract Answer { function claim() returns (uint256[5] memory) {'
  + ' uint256[5] memory a;'
  + VALUES.map((value, index) => ` a[${index}] = ${value};`).join('')
  + ' return a; } }';

/** A struct return, which the frame still has no encoding to compare. */
const STRUCT_SOURCE = 'pragma solidity ^0.8.0;\n'
  + 'contract Answer { struct Pair { uint256 a; uint256 b; }'
  + ' function claim() returns (Pair memory) { return Pair(1, 2); } }';

/** One element as the ABI holds it: a 32-byte big-endian word, which is what the entry's own encoding writes. */
function abiWord(value: bigint): Uint8Array {
  const word = new Uint8Array(32);
  const encoded = encodeIntegerValue(value);
  word.set(encoded, 32 - encoded.length);
  return word;
}

const wordList = (values: readonly bigint[]): Uint8Array =>
  new Uint8Array(values.flatMap((value) => [...abiWord(value)]));

const compiling = (source: string): ReturnType<typeof compileString> =>
  compileString(source, { composition: 'per-call', solidityImportCompat: true } as never);

const scriptBytes = (source: string): Uint8Array =>
  scriptToBytecode(asmToScript(compiling(source).bytecode));

/** Asks the machine whether the master is accepted with one `retval` recorded in its frame. */
function accepted(retval: Uint8Array, source: string = SOURCE): boolean {
  const artifact = compiling(source);
  const filled = fillPlaceholders(scriptBytes(source), artifact.composition!.placeholders, {
    category: categorySlotValue(CATEGORY), contractAddress: ADDRESS, templateHash: TEMPLATE_HASH,
  });
  const lock = encodeLockingBytecodeP2sh32(hash256(filled));
  const block: WitnessBlock = {
    kind: 0,
    callerRef: 0,
    originRef: 0,
    validatorRef: 0xffff,
    sender: USER_LOCK,
    self: ADDRESS,
    value: 0n,
    retval,
    calls: [],
    segments: [[]],
    events: [],
    sends: [],
  };
  const masterSource = {
    lockingBytecode: lock,
    valueSatoshis: 20_000n,
    token: { category: CATEGORY, amount: 0n, nft: { capability: 'minting' as const, commitment: new Uint8Array(0) } },
  };
  const callerSource = { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n };
  const transaction = {
    version: 2,
    inputs: [
      {
        outpointIndex: 0,
        outpointTransactionHash: new Uint8Array(32).fill(7),
        sequenceNumber: 0xffffffff,
        unlockingBytecode: callerUnlockingBytecode(),
      },
      {
        outpointIndex: 0,
        outpointTransactionHash: new Uint8Array(32).fill(8),
        sequenceNumber: 0xffffffff,
        // A master with one entry is reached directly, so the unlocking bytecode is its block and its program.
        unlockingBytecode: new Uint8Array([
          ...encodeDataPush(encodeWitnessBlock(block)),
          ...encodeDataPush(filled),
        ]),
      },
    ],
    outputs: [callerSource, masterSource],
    locktime: 0,
  };
  const vm = createVirtualMachineBch2026(false);
  const state = vm.evaluate({ inputIndex: 1, sourceOutputs: [callerSource, masterSource], transaction });
  return vm.stateSuccess(state) === true;
}

describe('an entry that returns a fixed-size array', () => {
  it('settles against the words its own return built, and refuses a frame that records others', () => {
    // The accept is the entry's own encoding reaching the frame: the block records the words of the elements the
    // body stored, and the body's comparison is what accepts it.
    expect(accepted(wordList(VALUES))).toBe(true);
    // One element changed, so the recorded value is one the entry did not compute.
    expect(accepted(wordList([1n, 2n, 3n, 4n, 6n]))).toBe(false);
    // A shorter list is a different value, not a prefix the comparison would accept.
    expect(accepted(wordList([1n, 2n, 3n, 4n]))).toBe(false);
    expect(accepted(new Uint8Array(0))).toBe(false);
  });
});

describe('an entry whose return type is still composite', () => {
  it('is refused by name for a struct, which the frame has no encoding to compare', () => {
    let refusal: { code?: string; message: string } | undefined;
    try {
      compiling(STRUCT_SOURCE);
    } catch (error) {
      refusal = error as { code?: string; message: string };
    }
    expect(refusal?.code).toBe('PER_CALL_CODEGEN_UNAVAILABLE');
    expect(refusal?.message).toContain("the entry point 'claim' returns a struct");
  });
});
