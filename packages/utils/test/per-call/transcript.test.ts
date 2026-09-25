import { describe, expect, it } from 'vitest';
import {
  CATEGORY_LENGTH,
  TRANSCRIPT_MAGIC,
  TRANSCRIPT_VERSION,
  decodeTranscript,
  encodeTranscript,
} from '../../src/per-call/index.js';
import { concatBytes, hexToBytes } from '../../src/per-call/primitives.js';
import { expectPerCallRejection, toBytes, toHex } from './helpers.js';
import { TRANSCRIPT_ABBA } from './vectors/witness-block.js';
import { CATEGORY_A } from './vectors/identity.js';

const abbaTranscript = (): Parameters<typeof encodeTranscript>[0] => ({
  roots: [...TRANSCRIPT_ABBA.roots],
  masters: [...TRANSCRIPT_ABBA.masters],
  settles: TRANSCRIPT_ABBA.settles.map((settled) => ({
    category: hexToBytes(settled.category),
    stateInputs: [...settled.stateInputs],
  })),
});

describe('transcript constants', () => {
  it('carries the frozen magic, version and category length', () => {
    expect(toHex(TRANSCRIPT_MAGIC)).toBe('504337');
    expect(TRANSCRIPT_VERSION).toBe(1);
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
    expectPerCallRejection(() => decodeTranscript(bytes), /not a transcript/);
  });

  it('rejects an unknown version', () => {
    const bytes = toBytes(TRANSCRIPT_ABBA.hex);
    bytes[3] = 0x02;
    expectPerCallRejection(() => decodeTranscript(bytes), /unsupported transcript version/);
  });

  it('rejects a trailing byte', () => {
    const bytes = concatBytes([toBytes(TRANSCRIPT_ABBA.hex), Uint8Array.of(0x00)]);
    expectPerCallRejection(() => decodeTranscript(bytes), /trailing byte/);
  });

  it('rejects a truncated field', () => {
    const bytes = toBytes(TRANSCRIPT_ABBA.hex).subarray(0, 40);
    expectPerCallRejection(() => decodeTranscript(bytes), /truncated/);
  });

  it('rejects a settled category that is not 32 bytes', () => {
    expectPerCallRejection(
      () => encodeTranscript({ roots: [], masters: [], settles: [{ category: new Uint8Array(31), stateInputs: [0] }] }),
      /category/,
    );
  });

  it('rejects a settled contract that lists no state input', () => {
    expectPerCallRejection(
      () => encodeTranscript({ roots: [], masters: [], settles: [{ category: hexToBytes(CATEGORY_A), stateInputs: [] }] }),
      /no state input/,
    );
  });
});
