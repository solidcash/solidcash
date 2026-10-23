import { describe, expect, it } from 'vitest';
import {
  encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import {
  asmToScript, concatBytes, decodePushdataValue, encodeIntegerValue, encodePushdataValue, encodeWitnessBlock,
  scriptToBytecode, sha256, validatorAddress,
  type CompositionPlaceholders, type StructDefinitionInfo, type WitnessBlock,
} from '@solidcash/utils';
import { compileString, compileStringMulti } from '../../../src/compiler.js';
import { refusalOf } from './refused-entry.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory } from './validator-input.js';

/**
 * An entry that returns a fixed-size array or a struct, settled against the frame's witness `retval`.
 *
 * The frame compares the blob the entry's own `return` built with the bytes the block records, and an array or a
 * struct is one value the language holds already encoded — under a Solidity import, the ABI encoding of its
 * members, and otherwise an array's length-prefixed packed elements and a struct's pushdata blob of its fields —
 * so the comparison is the one a scalar return makes. The sources' values and the expectations below come from
 * shipped encoders, and each returned blob is read back through the shipped decoder, so a case that agreed with the
 * program by construction could not pass: the machine is asked for a verdict in both directions.
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

/** A struct of scalar members, returned as one pushdata blob of its fields. */
const PAIR_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' struct Pair { int x; int y; }'
  + ' contract Answer { function claim() returns (Pair) { return Pair(1, 2); } }';

/** A struct with a dynamic `string` member. */
const TAG_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' struct Rec { string tag; int n; }'
  + ' contract Answer { function claim() returns (Rec) { return Rec("hi", 3); } }';

/** A struct with a dynamic `string[]` member. */
const TAGS_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' struct Tagged { string[] tags; int n; }'
  + ' contract Answer { function claim() returns (Tagged) { return Tagged(["a", "b"], 3); } }';

/** A struct whose mapping member is state, so it has no value a return could compare. */
const MAPPING_MEMBER_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' struct Bad { mapping(int => int) m; int n; }'
  + ' contract Answer { function claim() returns (Bad) { revert("no"); } }';

/** An entry returning an external function pointer, which is an (address, selector) pair and not one item. */
const POINTER_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Answer { function claim() returns (function(int) external returns (int)) { revert("no"); } }';

/** The member types the shipped decoder reads each returned blob back through. */
const STRUCT_DEFS: readonly StructDefinitionInfo[] = [
  { name: 'Pair', fields: [{ name: 'x', type: 'bigint' }, { name: 'y', type: 'bigint' }] },
  { name: 'Rec', fields: [{ name: 'tag', type: 'string' }, { name: 'n', type: 'bigint' }] },
  { name: 'Tagged', fields: [{ name: 'tags', type: 'string[]' }, { name: 'n', type: 'bigint' }] },
];

const pairBlob = (x: bigint, y: bigint): Uint8Array => concatBytes([
  encodePushdataValue(x, 'bigint'), encodePushdataValue(y, 'bigint'),
]);
const recBlob = (tag: string, n: bigint): Uint8Array => concatBytes([
  encodePushdataValue(tag, 'string'), encodePushdataValue(n, 'bigint'),
]);
const taggedBlob = (tags: readonly string[], n: bigint): Uint8Array => concatBytes([
  encodePushdataValue([...tags], 'string[]'), encodePushdataValue(n, 'bigint'),
]);

/** The member values a returned blob decodes back to through the shipped decoder. */
const decoded = (blob: Uint8Array, type: string): unknown => decodePushdataValue(blob, 0, type, STRUCT_DEFS).value;

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
  compileString(source, { composition: 'framed', evmCompat: true } as never);

/** Asks the machine whether a master whose filled program is `filled` is accepted with one `retval` recorded. */
function verdictOf(filled: Uint8Array, retval: Uint8Array): boolean {
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
  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex: 1, sourceOutputs: [callerSource, masterSource], transaction });
  return vm.stateSuccess(state) === true;
}

/** The filled program of the `Answer` the source compiles, with the deployment slots written. */
function fillAnswer(artifact: { bytecode: string; composition?: { placeholders: CompositionPlaceholders } }): Uint8Array {
  return fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), artifact.composition!.placeholders, {
    category: categorySlotValue(CATEGORY), contractAddress: ADDRESS, templateHash: TEMPLATE_HASH,
  });
}

/** Asks the machine whether the Solidity-import master for `source` is accepted with one `retval` recorded. */
function accepted(retval: Uint8Array, source: string = SOURCE): boolean {
  return verdictOf(fillAnswer(compiling(source)), retval);
}

/** Asks the machine whether the native master for `source` is accepted with one `retval` recorded. */
function nativeAccepted(retval: Uint8Array, source: string): boolean {
  const artifacts = compileStringMulti(source, { composition: 'framed' });
  return verdictOf(fillAnswer(artifacts.Answer!), retval);
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

describe('an entry that returns a struct', () => {
  it('settles against the blob its own return built, and refuses a frame that records others', () => {
    // The block records the pushdata blob of the fields the body returned, and the body's own comparison is what
    // accepts it; a different blob is a value the entry did not compute.
    expect(nativeAccepted(pairBlob(1n, 2n), PAIR_SOURCE)).toBe(true);
    expect(nativeAccepted(pairBlob(1n, 3n), PAIR_SOURCE)).toBe(false);
    expect(nativeAccepted(encodePushdataValue(1n, 'bigint'), PAIR_SOURCE)).toBe(false);
    expect(nativeAccepted(new Uint8Array(0), PAIR_SOURCE)).toBe(false);
    // The blob the entry computed reads back to the member values through the shipped decoder.
    expect(decoded(pairBlob(1n, 2n), 'Pair')).toStrictEqual({ x: 1n, y: 2n });
  });

  it('carries a string member and a string[] member as one pushdata blob', () => {
    // A dynamic member is framed inside the blob, so the whole struct is still one value the frame compares.
    expect(nativeAccepted(recBlob('hi', 3n), TAG_SOURCE)).toBe(true);
    expect(nativeAccepted(taggedBlob(['a', 'b'], 3n), TAGS_SOURCE)).toBe(true);
    expect(decoded(recBlob('hi', 3n), 'Rec')).toStrictEqual({ tag: 'hi', n: 3n });
    expect(decoded(taggedBlob(['a', 'b'], 3n), 'Tagged')).toStrictEqual({ tags: ['a', 'b'], n: 3n });
    // A dynamic member recorded as other bytes is refused like any other mismatch.
    expect(nativeAccepted(recBlob('yo', 3n), TAG_SOURCE)).toBe(false);
    expect(nativeAccepted(taggedBlob(['a'], 3n), TAGS_SOURCE)).toBe(false);
  });
});

describe('an entry whose return type is still composite', () => {
  it('refuses a struct the language cannot hold as one value', () => {
    // A mapping is state held by entry NFTs, not a value, so a struct carrying one has no encoding a `return`
    // could leave as the compared blob; the compiler refuses the shape.
    expect(() => compileStringMulti(MAPPING_MEMBER_SOURCE, { composition: 'framed' }))
      .toThrow(/return values of an external\/public function/);
  });

  it('refuses an entry that returns an external function pointer', () => {
    // A function pointer is an (address, selector) pair, so it is not one item the frame's comparison can hold.
    const refusal = refusalOf(POINTER_SOURCE);
    expect(refusal.code).toBe('FRAMED_CODEGEN_UNAVAILABLE');
    expect(refusal.message).toContain('returns a function pointer');
  });
});
