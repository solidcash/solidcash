import { describe, expect, it } from 'vitest';
import {
  ARGS_HASH_LENGTH,
  INDEX_NONE,
  WITNESS_BLOCK_MAGIC,
  WITNESS_BLOCK_VERSION,
  argumentPushesOf,
  buildMasterUnlockingBytecode,
  decodeWitnessBlock,
  encodeWitnessBlock,
  readOwnWitnessBlock,
  splitFirstPush,
  splitLastPush,
} from '../../src/framed/index.js';
import { FrameKind } from '../../src/framed/frames.js';
import { concatBytes, hexToBytes } from '../../src/framed/primitives.js';
import { encodeArgumentPayload } from '../../src/framed/canonical.js';
import { expectFramedRejection, toBytes, toHex, toWitnessBlock } from './helpers.js';
import { BLOCKS, MALFORMED_WITNESS_BLOCKS } from './vectors/witness-block.js';
import { LOADER_CODE_A } from './vectors/identity.js';

describe('witness block constants', () => {
  it('carries the frozen magic, version and hash length', () => {
    expect(toHex(WITNESS_BLOCK_MAGIC)).toBe('5057');
    expect(WITNESS_BLOCK_VERSION).toBe(1);
    expect(ARGS_HASH_LENGTH).toBe(32);
    expect(INDEX_NONE).toBe(0xffff);
  });
});

describe('witness block encoding', () => {
  for (const [name, vector] of Object.entries(BLOCKS)) {
    it(`encodes ${name} to the recorded bytes`, () => {
      expect(toHex(encodeWitnessBlock(toWitnessBlock(vector)))).toBe(vector.hex);
    });
  }
});

describe('witness block round trip', () => {
  for (const [name, vector] of Object.entries(BLOCKS)) {
    it(`decodes ${name} back to the block it encoded`, () => {
      const block = toWitnessBlock(vector);
      const decoded = decodeWitnessBlock(toBytes(vector.hex));
      expect(decoded).toEqual(block);
      expect(toHex(encodeWitnessBlock(decoded))).toBe(vector.hex);
    });
  }
});

describe('witness block decode rejection', () => {
  const expectedMessage: Record<string, RegExp> = {
    BAD_MAGIC: /not a witness block/,
    UNKNOWN_VERSION: /unsupported witness block version/,
    UNKNOWN_FRAME_KIND: /unknown frame kind/,
    ROOT_CALL_KIND: /records a root frame/,
    SEGMENT_COUNT_MISMATCH: /one more segment than calls/,
    TRUNCATED_FIELD: /truncated/,
    TRAILING_BYTE: /trailing byte/,
  };

  for (const [name, vector] of Object.entries(MALFORMED_WITNESS_BLOCKS)) {
    it(`rejects ${name}: ${vector.reason}`, () => {
      expectFramedRejection(() => decodeWitnessBlock(toBytes(vector.hex)), expectedMessage[name]);
    });
  }

  it('rejects an absent callee reference', () => {
    // The byte image is the specification's: target, value, then calleeRef = 0xffff. Decoding always reads 32
    // fixed args-hash bytes, so a malformed call can only be rejected as it is read.
    expectFramedRejection(
      () => decodeWitnessBlock(toBytes(MALFORMED_WITNESS_BLOCKS.ABSENT_CALLEE!.hex)),
    );
  });
});

describe('witness block encode rejection', () => {
  it('rejects a call that records the root frame kind', () => {
    const block = toWitnessBlock(BLOCKS.ABBA_A_F!);
    block.calls[0]!.kind = FrameKind.ROOT;
    expectFramedRejection(() => encodeWitnessBlock(block), /records a root frame/);
  });

  it('rejects an args hash that is not 32 bytes', () => {
    const block = toWitnessBlock(BLOCKS.ABBA_A_F!);
    block.calls[0]!.argsHash = new Uint8Array(ARGS_HASH_LENGTH - 1);
    expectFramedRejection(() => encodeWitnessBlock(block), /args hash/);
  });

  it('rejects a callee reference that is absent', () => {
    const block = toWitnessBlock(BLOCKS.ABBA_A_F!);
    block.calls[0]!.calleeRef = INDEX_NONE;
    expectFramedRejection(() => encodeWitnessBlock(block), /no callee/);
  });

  it('rejects a segment count that is not calls plus one', () => {
    const block = toWitnessBlock(BLOCKS.ABBA_A_K!);
    block.segments.push([]);
    expectFramedRejection(() => encodeWitnessBlock(block), /one more segment than calls/);
  });

  it('accepts a record a frame creates before it has made any call', () => {
    // A frame that writes a new record before calling out is ordinary: it inserts into a mapping, or appends to an
    // array, as its first act. Nothing in the format restricts a creation to a later segment, so the first segment
    // of an execution may carry one, and it round trips.
    const block = toWitnessBlock(BLOCKS.EVENTS_AND_SENDS!);
    block.segments[0]![0]!.in = INDEX_NONE;
    const encoded = encodeWitnessBlock(block);
    const decoded = decodeWitnessBlock(encoded);
    expect(decoded.segments[0]![0]!.in).toBe(INDEX_NONE);
    expect(decoded.segments[0]![0]!.out).toBe(block.segments[0]![0]!.out);
  });

  it('rejects a record entry that is created and deleted at once', () => {
    const block = toWitnessBlock(BLOCKS.EVENTS_AND_SENDS!);
    block.segments[0]![0]!.in = INDEX_NONE;
    block.segments[0]![0]!.out = INDEX_NONE;
    expectFramedRejection(() => encodeWitnessBlock(block));
  });
});

describe('splitFirstPush', () => {
  const remainder = Uint8Array.from([0xdd, 0xee]);

  it('decodes OP_0 to the empty payload and keeps the remainder', () => {
    const { payload, rest } = splitFirstPush(concatBytes([Uint8Array.of(0x00), remainder]));
    expect(toHex(payload)).toBe('');
    expect(toHex(rest)).toBe('ddee');
  });

  it('decodes OP_1NEGATE to the byte 0x81', () => {
    const { payload, rest } = splitFirstPush(concatBytes([Uint8Array.of(0x4f), remainder]));
    expect(toHex(payload)).toBe('81');
    expect(toHex(rest)).toBe('ddee');
  });

  it('decodes every OP_1 through OP_16 to the byte it pushes', () => {
    for (let value = 1; value <= 16; value += 1) {
      const { payload, rest } = splitFirstPush(concatBytes([Uint8Array.of(0x50 + value), remainder]));
      expect(toHex(payload)).toBe(value.toString(16).padStart(2, '0'));
      expect(toHex(rest)).toBe('ddee');
    }
  });

  it('decodes the direct push form', () => {
    const payload = Uint8Array.from([0xaa, 0xbb, 0xcc]);
    const { payload: decoded, rest } = splitFirstPush(
      concatBytes([Uint8Array.of(payload.length), payload, remainder]),
    );
    expect(toHex(decoded)).toBe('aabbcc');
    expect(toHex(rest)).toBe('ddee');
  });

  it('decodes OP_PUSHDATA1', () => {
    const payload = Uint8Array.from([0xaa, 0xbb, 0xcc]);
    const { payload: decoded, rest } = splitFirstPush(
      concatBytes([Uint8Array.of(0x4c, payload.length), payload, remainder]),
    );
    expect(toHex(decoded)).toBe('aabbcc');
    expect(toHex(rest)).toBe('ddee');
  });

  it('decodes OP_PUSHDATA2', () => {
    const payload = Uint8Array.from([0xaa, 0xbb, 0xcc]);
    const { payload: decoded, rest } = splitFirstPush(
      concatBytes([Uint8Array.of(0x4d, payload.length, 0x00), payload, remainder]),
    );
    expect(toHex(decoded)).toBe('aabbcc');
    expect(toHex(rest)).toBe('ddee');
  });

  it('decodes OP_PUSHDATA4', () => {
    const payload = Uint8Array.from([0xaa, 0xbb, 0xcc]);
    const { payload: decoded, rest } = splitFirstPush(
      concatBytes([Uint8Array.of(0x4e, payload.length, 0x00, 0x00, 0x00), payload, remainder]),
    );
    expect(toHex(decoded)).toBe('aabbcc');
    expect(toHex(rest)).toBe('ddee');
  });

  it('rejects an unlocking bytecode that does not begin with a push', () => {
    expectFramedRejection(() => splitFirstPush(Uint8Array.of(0x87, 0x00)));
  });

  it('rejects an empty unlocking bytecode', () => {
    expectFramedRejection(() => splitFirstPush(new Uint8Array(0)), /empty unlocking bytecode/);
  });

  it('rejects a truncated length field and a truncated payload', () => {
    expectFramedRejection(() => splitFirstPush(Uint8Array.of(0x4d, 0x01)));
    expectFramedRejection(() => splitFirstPush(Uint8Array.of(0x03, 0x01, 0x02)));
  });
});

describe('master unlocking bytecode', () => {
  for (const [name, vector] of Object.entries(BLOCKS)) {
    const unlocking = (): Uint8Array => buildMasterUnlockingBytecode(
      toWitnessBlock(vector),
      [],
      hexToBytes(LOADER_CODE_A),
    );
    it(`puts the witness block push first for ${name}`, () => {
      const { payload } = splitFirstPush(unlocking());
      expect(toHex(payload)).toBe(vector.hex);
    });
  }

  it('argumentPushesOf of a master unlocking bytecode equals exactly the concatenated argument pushes', () => {
    const block = toWitnessBlock(BLOCKS.ABBA_A_F!);
    const argumentsIn = [Uint8Array.of(0x03)];
    const unlocking = buildMasterUnlockingBytecode(block, argumentsIn, hexToBytes(LOADER_CODE_A));
    const argumentPushes = concatBytes(argumentsIn.map((argument) => encodeArgumentPayload(argument)));
    expect(toHex(argumentPushes)).toBe('53');
    expect(toHex(argumentPushesOf(unlocking))).toBe(toHex(argumentPushes));
  });

  it('excludes the redeem-script push from the argument pushes, and recovers it separately', () => {
    const block = toWitnessBlock(BLOCKS.ABBA_A_F!);
    const argumentsIn = [Uint8Array.of(0x03)];
    const code = hexToBytes(LOADER_CODE_A);
    const unlocking = buildMasterUnlockingBytecode(block, argumentsIn, code);
    // The arguments and the script are told apart by the boundaries of the unlocking bytecode: the first push is
    // the witness block and the last is the redeem script. Hashing the script as an argument would never agree
    // with the callee's own hash, so the two must not be conflated.
    expect(toHex(argumentPushesOf(unlocking))).toBe('53');
    const afterBlock = splitFirstPush(unlocking).rest;
    expect(toHex(splitLastPush(afterBlock).payload)).toBe(toHex(code));
    expect(toHex(splitLastPush(afterBlock).leading)).toBe('53');
  });
});

describe('readOwnWitnessBlock', () => {
  it('reads back its own witness block', () => {
    const block = toWitnessBlock(BLOCKS.ABBA_A_K!);
    const unlocking = buildMasterUnlockingBytecode(block, [], hexToBytes(LOADER_CODE_A));
    const { block: read } = readOwnWitnessBlock(unlocking, block);
    expect(read).toEqual(block);
  });

  it('rejects a witness block other than the one the execution used', () => {
    const own = toWitnessBlock(BLOCKS.ABBA_A_K!);
    const other = toWitnessBlock(BLOCKS.ABBA_A_F!);
    const unlocking = buildMasterUnlockingBytecode(own, [], hexToBytes(LOADER_CODE_A));
    expectFramedRejection(
      () => readOwnWitnessBlock(unlocking, other),
      /not the witness block this execution used/,
    );
  });
});
