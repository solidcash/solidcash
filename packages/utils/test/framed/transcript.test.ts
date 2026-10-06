import { describe, expect, it } from 'vitest';
import {
  CATEGORY_LENGTH,
  TRANSCRIPT_MAGIC,
  TRANSCRIPT_VERSION,
  decodeTranscript,
  encodeTranscript,
} from '../../src/framed/index.js';
import { concatBytes, hexToBytes } from '../../src/framed/primitives.js';
import { expectFramedRejection, toBytes, toHex } from './helpers.js';
import { TRANSCRIPT_ABBA } from './vectors/witness-block.js';
import { CATEGORY_A } from './vectors/identity.js';

const abbaTranscript = (): Parameters<typeof encodeTranscript>[0] => ({
  roots: [...TRANSCRIPT_ABBA.roots],
  masters: [...TRANSCRIPT_ABBA.masters],
  settles: TRANSCRIPT_ABBA.settles.map((settled) => ({
    category: hexToBytes(settled.category),
    stateInputs: [...settled.stateInputs],
    createdOutputs: [...settled.createdOutputs],
  })),
});

describe('transcript constants', () => {
  it('carries the frozen magic, version and category length', () => {
    expect(toHex(TRANSCRIPT_MAGIC)).toBe('504337');
    expect(TRANSCRIPT_VERSION).toBe(2);
    expect(CATEGORY_LENGTH).toBe(32);
  });
});

describe('transcript codec', () => {
  it('encodes the ABBA transcript to the recorded bytes', () => {
    expect(toHex(encodeTranscript(abbaTranscript()))).toBe(TRANSCRIPT_ABBA.hex);
  });

  it('decodes the ABBA transcript', () => {
    expect(decodeTranscript(toBytes(TRANSCRIPT_ABBA.hex))).toEqual(abbaTranscript());
  });

  it('round trips', () => {
    const encoded = encodeTranscript(decodeTranscript(toBytes(TRANSCRIPT_ABBA.hex)));
    expect(toHex(encoded)).toBe(TRANSCRIPT_ABBA.hex);
  });
});

describe('transcript rejection', () => {
  it('rejects a bad magic', () => {
    const bytes = toBytes(TRANSCRIPT_ABBA.hex);
    bytes[0] = 0x51;
    expectFramedRejection(() => decodeTranscript(bytes), /not a transcript/);
  });

  it('rejects an unknown version', () => {
    const bytes = toBytes(TRANSCRIPT_ABBA.hex);
    bytes[3] = 0x03;
    expectFramedRejection(() => decodeTranscript(bytes), /unsupported transcript version/);
  });

  it('rejects a trailing byte', () => {
    const bytes = concatBytes([toBytes(TRANSCRIPT_ABBA.hex), Uint8Array.of(0x00)]);
    expectFramedRejection(() => decodeTranscript(bytes), /trailing byte/);
  });

  it('rejects a truncated field', () => {
    const bytes = toBytes(TRANSCRIPT_ABBA.hex).subarray(0, 40);
    expectFramedRejection(() => decodeTranscript(bytes), /truncated/);
  });

  it('rejects a settled category that is not 32 bytes', () => {
    expectFramedRejection(
      () => encodeTranscript({ roots: [], masters: [], settles: [{ category: new Uint8Array(31), stateInputs: [0] }] }),
      /category/,
    );
  });

  it('carries a settled contract that lists no state input', () => {
    // A contract can be settled while the transaction spends none of its state: several of its masters are
    // covered, and it has no records of its own. The empty list is what V7 compares the transaction against.
    const transcript = {
      roots: [], masters: [], settles: [{ category: hexToBytes(CATEGORY_A), stateInputs: [], createdOutputs: [] }],
    };
    expect(decodeTranscript(encodeTranscript(transcript))).toEqual(transcript);
  });

  it('carries a settled contract whose transaction creates a record', () => {
    // A created record has no input, so it is named by the trailing output it appears at. The list is what tells
    // the validator that such an index is a created record rather than a spent input.
    const transcript = {
      roots: [], masters: [], settles: [{ category: hexToBytes(CATEGORY_A), stateInputs: [3], createdOutputs: [6, 7] }],
    };
    const encoded = encodeTranscript(transcript);
    expect(toHex(encoded)).toBe(
      '50433702000001'
      + CATEGORY_A
      + '0103020607',
    );
    expect(decodeTranscript(encoded)).toEqual(transcript);
  });
});
