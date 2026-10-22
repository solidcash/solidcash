import { binToHex } from '@bitauth/libauth';
import {
  decodeEvmNotationEventValue,
  decodePackedEventArray,
  decodePushdataValue,
  encodeEvmNotationEventValue,
  encodePushdataValue,
  packFixedWidthArray,
  packFixedWidthElement,
  peekPushdataEncodedLength,
  unpackFixedWidthArray,
  unpackFixedWidthElement,
  type StateValue,
} from '../src/index.js';

const bytes = (...values: number[]): Uint8Array => Uint8Array.from(values);
const filled = (length: number, byte = 0xab): Uint8Array => new Uint8Array(length).fill(byte);
const concat = (...parts: Uint8Array[]): Uint8Array => Uint8Array.from(parts.flatMap((part) => [...part]));

/** Fixed-width negative zero: a zero magnitude with the sign bit of the last byte set. */
const negativeZero = (width: number): Uint8Array => {
  const out = new Uint8Array(width);
  out[width - 1] = 0x80;
  return out;
};

/** Encode with the state encoder, decode, and require the same value from exactly the encoded bytes. */
const roundTrip = (value: StateValue, type: string): Uint8Array => {
  const encoded = encodePushdataValue(value, type);
  const decoded = decodePushdataValue(encoded, 0, type);
  expect(decoded.value).toEqual(value);
  expect(decoded.bytesConsumed).toBe(encoded.length);
  return encoded;
};

describe('state decoders refuse non-canonical encodings', () => {
  it('refuses a direct one-byte push of 1..16 or -1 for an int-like type', () => {
    for (const type of ['bigint', 'int', 'uint8', 'int256', 'fixed128x18']) {
      for (let n = 1; n <= 16; n += 1) {
        expect(() => decodePushdataValue(bytes(0x01, n), 0, type)).toThrow(/non-canonical/);
      }
    }
    for (const type of ['bigint', 'int', 'int8']) {
      expect(() => decodePushdataValue(bytes(0x01, 0x81), 0, type)).toThrow(/non-canonical/);
    }
  });

  it('refuses OP_PUSHDATA1 under 76 bytes and OP_PUSHDATA2 under 256 bytes', () => {
    expect(() => decodePushdataValue(bytes(0x4c, 0x00), 0, 'bytes')).toThrow(/non-canonical/);
    expect(() => decodePushdataValue(concat(bytes(0x4c, 3), filled(3)), 0, 'bytes')).toThrow(/non-canonical/);
    expect(() => decodePushdataValue(concat(bytes(0x4c, 75), filled(75)), 0, 'bytes')).toThrow(/non-canonical/);
    expect(() => decodePushdataValue(concat(bytes(0x4c, 75), filled(75, 0x61)), 0, 'string'))
      .toThrow(/non-canonical/);
    expect(() => decodePushdataValue(bytes(0x4c, 0x01, 0x11), 0, 'bigint')).toThrow(/non-canonical/);
    expect(() => decodePushdataValue(concat(bytes(0x4d, 3, 0), filled(3)), 0, 'bytes')).toThrow(/non-canonical/);
    expect(() => decodePushdataValue(concat(bytes(0x4d, 75, 0), filled(75)), 0, 'bytes')).toThrow(/non-canonical/);
    expect(() => decodePushdataValue(concat(bytes(0x4d, 255, 0), filled(255)), 0, 'bytes'))
      .toThrow(/non-canonical/);
    expect(() => decodePushdataValue(bytes(0x4d, 0x01, 0x00, 0x11), 0, 'bigint')).toThrow(/non-canonical/);
    // The length-only peek used to pre-filter candidates mirrors the decoder.
    expect(peekPushdataEncodedLength(concat(bytes(0x4c, 3), filled(3)))).toBeUndefined();
    expect(peekPushdataEncodedLength(concat(bytes(0x4d, 255, 0), filled(255)))).toBeUndefined();
  });

  it('refuses the raw script number 0x01 as a bool', () => {
    // The covenant decoder reads only 0x51 as true, so 0x01 would read true here and false on chain.
    expect(() => decodePushdataValue(bytes(0x01), 0, 'bool')).toThrow(/Invalid boolean encoding/);
    expect(() => decodePushdataValue(bytes(0x02), 0, 'bool')).toThrow(/Invalid boolean encoding/);
  });

  it('refuses a direct push of a bytes1 value the encoder folds to OP_1..OP_16 or OP_1NEGATE', () => {
    for (let n = 1; n <= 16; n += 1) {
      expect(() => decodePushdataValue(bytes(0x01, n), 0, 'bytes1')).toThrow(/non-canonical/);
    }
    expect(() => decodePushdataValue(bytes(0x01, 0x81), 0, 'bytes1')).toThrow(/non-canonical/);
  });

  it('refuses a non-minimal pushdata number, including negative zero', () => {
    expect(() => decodePushdataValue(bytes(0x01, 0x80), 0, 'bigint')).toThrow();
    expect(() => decodePushdataValue(bytes(0x01, 0x00), 0, 'bigint')).toThrow();
    expect(() => decodePushdataValue(bytes(0x02, 0x05, 0x00), 0, 'int')).toThrow();
  });

  it('refuses fixed-width negative zero and a fixed-width bool other than 0x00 / 0x01', () => {
    const widths: Array<[string, number]> = [
      ['int8', 2], ['uint8', 2], ['int256', 33], ['uint256', 33], ['fixed128x18', 17],
    ];
    for (const [type, width] of widths) {
      expect(() => unpackFixedWidthElement(negativeZero(width), type)).toThrow(/non-canonical/);
    }
    expect(() => unpackFixedWidthArray(concat(packFixedWidthElement(1n, 'int256'), negativeZero(33)), 'int256'))
      .toThrow(/non-canonical/);
    // A packed array state value reads its elements through the same unpacker.
    expect(() => decodePushdataValue(concat(bytes(0x51), negativeZero(33)), 0, 'int256[]')).toThrow(/non-canonical/);
    expect(() => unpackFixedWidthElement(bytes(0x02), 'bool')).toThrow(/non-canonical/);
    expect(() => unpackFixedWidthElement(bytes(0xff), 'bool')).toThrow(/non-canonical/);
  });

  it('refuses a non-canonical event-array count and evm-notation bool', () => {
    const elements = packFixedWidthArray([1n, 2n, 3n, 4n, 5n], 'uint8');
    expect(() => decodePackedEventArray(concat(bytes(0x01, 0x05), elements), 0, 'uint8[]')).toThrow(/non-canonical/);
    expect(() => decodeEvmNotationEventValue(bytes(0x02), 0, 'bool')).toThrow(/non-canonical/);
  });
});

describe('canonical encodings round-trip', () => {
  it('round-trips pushdata ints across the opcode and sign-byte boundaries', () => {
    const values = [0n, -1n, 1n, 15n, 16n, 17n, -16n, -17n, 127n, -127n, 128n, -128n, 255n, 256n, 0x7fffn, 0x8000n,
      -0x8000n];
    for (const value of values) {
      roundTrip(value, 'bigint');
      roundTrip(value, 'int');
    }
    expect(binToHex(roundTrip(0n, 'bigint'))).toBe('00');
    expect(binToHex(roundTrip(-1n, 'bigint'))).toBe('4f');
    expect(binToHex(roundTrip(1n, 'bigint'))).toBe('51');
    expect(binToHex(roundTrip(16n, 'bigint'))).toBe('60');
    expect(binToHex(roundTrip(17n, 'bigint'))).toBe('0111');
    expect(binToHex(roundTrip(-16n, 'bigint'))).toBe('0190');
    expect(binToHex(roundTrip(127n, 'bigint'))).toBe('017f');
    expect(binToHex(roundTrip(128n, 'bigint'))).toBe('028000');
    expect(binToHex(roundTrip(-128n, 'bigint'))).toBe('028080');
    for (const value of [(1n << 255n) - 1n, -(1n << 255n)]) roundTrip(value, 'int');
    for (const value of [0n, 1n, 16n, 17n, 127n, 128n, 255n]) roundTrip(value, 'uint8');
    for (const value of [-128n, -17n, -1n, 0n, 127n]) roundTrip(value, 'int8');
    // 75- and 76-byte numbers sit on the direct-push / OP_PUSHDATA1 boundary.
    expect(roundTrip(1n << 592n, 'bigint')[0]).toBe(75);
    expect(roundTrip(1n << 600n, 'bigint').slice(0, 2)).toEqual(bytes(0x4c, 76));
  });

  it('round-trips bools and every bytes1 value', () => {
    expect(binToHex(roundTrip(true, 'bool'))).toBe('51');
    expect(binToHex(roundTrip(false, 'bool'))).toBe('00');
    for (let byte = 0; byte <= 0xff; byte += 1) roundTrip(bytes(byte), 'bytes1');
    expect(binToHex(encodePushdataValue(bytes(0x00), 'bytes1'))).toBe('0100');
    expect(binToHex(encodePushdataValue(bytes(0x05), 'bytes1'))).toBe('55');
    expect(binToHex(encodePushdataValue(bytes(0x80), 'bytes1'))).toBe('0180');
    expect(binToHex(encodePushdataValue(bytes(0x81), 'bytes1'))).toBe('4f');
  });

  it('round-trips byte strings across the push-opcode boundaries', () => {
    for (const length of [0, 1, 2, 75, 76, 255, 256, 300]) {
      const encoded = roundTrip(filled(length), 'bytes');
      expect(peekPushdataEncodedLength(encoded)).toBe(encoded.length);
    }
    expect(binToHex(roundTrip(bytes(0x05), 'bytes'))).toBe('0105');
  });

  it('keeps the two narrow forms honest writers produce', () => {
    // An unlocking-bytecode argument frame carries the MINIMALDATA push (encodeDataPush) of a one-byte value.
    expect(decodePushdataValue(bytes(0x55), 0, 'bytes').value).toEqual(bytes(0x05));
    expect(decodePushdataValue(bytes(0x4f), 0, 'bytes').value).toEqual(bytes(0x81));
    // The compiler encodes an empty bytes1 stack value (bytes1(false)) as OP_0, read as the zero byte.
    expect(decodePushdataValue(bytes(0x00), 0, 'bytes1').value).toEqual(bytes(0x00));
  });

  it('round-trips fixed-width elements, including zero, -1 and the type bounds', () => {
    const cases: Array<[string, bigint[]]> = [
      ['int8', [-128n, -1n, 0n, 1n, 127n]],
      ['uint8', [0n, 1n, 128n, 255n]],
      ['int256', [-(1n << 255n), -1n, 0n, 1n, 16n, 17n, 128n, (1n << 255n) - 1n]],
      ['uint256', [0n, 1n, (1n << 256n) - 1n]],
      ['fixed128x18', [-(1n << 127n), -1n, 0n, (1n << 127n) - 1n]],
    ];
    for (const [type, values] of cases) {
      for (const value of values) {
        expect(unpackFixedWidthElement(packFixedWidthElement(value, type), type)).toBe(value);
      }
      expect(unpackFixedWidthArray(packFixedWidthArray(values, type), type)).toEqual(values);
    }
    expect(unpackFixedWidthElement(new Uint8Array(33), 'int256')).toBe(0n);
    expect(unpackFixedWidthElement(packFixedWidthElement(true, 'bool'), 'bool')).toBe(true);
    expect(unpackFixedWidthElement(packFixedWidthElement(false, 'bool'), 'bool')).toBe(false);
  });

  it('round-trips fixed-width arrays as state values and event arguments', () => {
    for (const length of [0, 5, 16, 17]) {
      const values = Array.from({ length }, (_unused, index) => BigInt(index));
      const encoded = roundTrip(values, 'uint8[]');
      const decoded = decodePackedEventArray(encoded, 0, 'uint8[]');
      expect(decoded.value).toEqual(values);
      expect(decoded.bytesConsumed).toBe(encoded.length);
    }
    expect(decodeEvmNotationEventValue(encodeEvmNotationEventValue(true, 'bool'), 0, 'bool').value).toBe(true);
    expect(decodeEvmNotationEventValue(encodeEvmNotationEventValue(false, 'bool'), 0, 'bool').value).toBe(false);
  });
});
