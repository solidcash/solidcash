import { describe, expect, it } from 'vitest';
import { scriptToBytecode } from '@solidcash/utils';
import { layer3 } from '../src/index.js';

const sample = (): layer3.SingleTxBusTranscript => ({
  participants: [
    { lockingBytecode: '51', masterCategory: '11'.repeat(32), base: 0, blockSize: 2,
      policyHash: 'aa'.repeat(32), trailingCapacity: 0 },
    { lockingBytecode: '52', masterCategory: '22'.repeat(32), base: 2, blockSize: 3,
      policyHash: 'bb'.repeat(32), trailingBase: 2, trailingCapacity: 1 },
  ],
  rows: [
    {
      kind: 0, owner: 0, consumer: 1, slot: 0, mode: 0, sourceSlot: 0, targetSlot: 2,
      selectorHex: '12345678', position: 1, subjectHex: '51', argsHex: '01', resultHex: '', effectHex: '',
    },
    {
      kind: 2, owner: 1, consumer: 0, slot: 4, mode: 0, sourceSlot: 0xffff, targetSlot: 4,
      selectorHex: 'abcdef01', position: 2, subjectHex: 'abcd', argsHex: '', resultHex: '', effectHex: 'beef',
    },
  ],
});

describe('controllerless single-transaction codec', () => {
  it('round-trips one canonical transcript and carrier', () => {
    const value = sample();
    const encoded = layer3.encodeSingleTxBusTranscript(value);
    expect(layer3.decodeSingleTxBusTranscript(encoded)).toEqual(value);
    expect(layer3.decodeSingleTxCarrier(layer3.encodeSingleTxCarrier(value))).toEqual(value);
  });

  it('places complete blocks contiguously before the fee tail', () => {
    expect(layer3.singleTxBusPhysicalLayout([2, 3, 1])).toEqual({
      participantInputs: [0, 2, 5], feeInput: 6, totalSlots: 7,
    });
  });

  it('rejects domain, version, declared length, truncation, suffix, and carrier mutations', () => {
    const encoded = layer3.encodeSingleTxBusTranscript(sample());
    for (const offset of [0, 8, 9]) {
      const changed = encoded.slice(); changed[offset] ^= 1;
      expect(() => layer3.decodeSingleTxBusTranscript(changed)).toThrow();
    }
    expect(() => layer3.decodeSingleTxBusTranscript(encoded.slice(0, -1))).toThrow();
    expect(() => layer3.decodeSingleTxBusTranscript(Uint8Array.from([...encoded, 0]))).toThrow();
    const carrier = layer3.encodeSingleTxCarrier(sample());
    for (const offset of [0, 4]) {
      const changed = carrier.slice(); changed[offset] ^= 1;
      expect(() => layer3.decodeSingleTxCarrier(changed)).toThrow();
    }
    expect(() => layer3.decodeSingleTxCarrier(Uint8Array.from([...carrier, 0]))).toThrow();
  });

  it('rejects mutations to participant boundaries and every row discriminator', () => {
    const encoded = layer3.encodeSingleTxBusTranscript(sample());
    // Header is 14 bytes; first base/blockSize fields start there.
    for (const offset of [13, 14, 16]) {
      const changed = encoded.slice(); changed[offset] ^= 0xff;
      expect(() => layer3.decodeSingleTxBusTranscript(changed)).toThrow();
    }
    const decoded = layer3.decodeSingleTxBusTranscript(encoded);
    expect(() => layer3.encodeSingleTxBusTranscript({ ...decoded, rows: [
      { ...decoded.rows[0], kind: 7 }, ...decoded.rows.slice(1),
    ] })).toThrow(/unknown kind/);
    expect(() => layer3.encodeSingleTxBusTranscript({ ...decoded, rows: [
      { ...decoded.rows[0], owner: 2 }, ...decoded.rows.slice(1),
    ] })).toThrow(/unknown participant/);
  });

  it('rejects gaps, overlap, absent masters, malformed trailing regions, and capacity overflow', () => {
    expect(() => layer3.singleTxBusPhysicalLayout([1, 0])).toThrow(/positive integer/);
    expect(() => layer3.encodeSingleTxBusTranscript({ ...sample(), participants: [
      sample().participants[0], { ...sample().participants[1], base: 3 },
    ] })).toThrow(/contiguous/);
    expect(() => layer3.encodeSingleTxBusTranscript({ ...sample(), participants: [
      sample().participants[0], { ...sample().participants[1], trailingBase: 1 },
    ] })).toThrow(/trailing region/);
    expect(() => layer3.encodeSingleTxBusTranscript({
      ...sample(), rows: Array.from({ length: 25 }, () => sample().rows[0]),
    })).toThrow(/row count/);
  });

  it('inserts and extracts the carrier at the canonical SCB1 unlocking position', () => {
    const original = scriptToBytecode([
      Uint8Array.from([0x53, 0x43, 0x42, 0x31]), Uint8Array.from([1, 2, 3]),
      Uint8Array.from([4, 5]), Uint8Array.from({ length: 90 }, () => 6),
    ]);
    const withCarrier = layer3.insertSingleTxCarrier(original, sample());
    expect(layer3.extractSingleTxCarrier(withCarrier)).toEqual(sample());
    // Selector, positional batch, and every suffix push remain exact.
    expect(withCarrier.slice(0, 9)).toEqual(original.slice(0, 9));
    expect(withCarrier.slice(withCarrier.length - (original.length - 9))).toEqual(original.slice(9));
    expect(() => layer3.extractSingleTxCarrier(original)).toThrow(/carrier/);
    const nonScb = original.slice(); nonScb[1] ^= 1;
    expect(() => layer3.insertSingleTxCarrier(nonScb, sample())).toThrow(/not an SCB1 route/);
  });

  it('rejects non-minimal and truncated carrier push framing', () => {
    const original = scriptToBytecode([
      Uint8Array.from([0x53, 0x43, 0x42, 0x31]), Uint8Array.from([1, 2, 3]), Uint8Array.of(4),
    ]);
    const withCarrier = layer3.insertSingleTxCarrier(original, sample());
    const carrierAt = 9;
    const nonMinimal = Uint8Array.from([
      ...withCarrier.slice(0, 5), 76, 3, ...withCarrier.slice(6),
    ]);
    expect(() => layer3.extractSingleTxCarrier(nonMinimal)).toThrow(/non-minimal/);
    expect(() => layer3.extractSingleTxCarrier(withCarrier.slice(0, -withCarrier.length + carrierAt + 2)))
      .toThrow(/truncated/);
  });

  it('is injective under every single-byte mutation of a canonical transcript', () => {
    const encoded = layer3.encodeSingleTxBusTranscript(sample());
    for (let offset = 0; offset < encoded.length; offset += 1) {
      const changed = encoded.slice();
      changed[offset] ^= 1;
      try {
        const decoded = layer3.decodeSingleTxBusTranscript(changed);
        expect(decoded, `mutation at byte ${offset} decoded to the original value`).not.toEqual(sample());
        expect(layer3.encodeSingleTxBusTranscript(decoded), `mutation at byte ${offset} was non-canonical`)
          .toEqual(changed);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    }
  });

  it('round-trips framing boundaries across direct, PUSHDATA1, and PUSHDATA2 carriers', () => {
    for (const payloadBytes of [0, 75, 76, 255, 256, 1024]) {
      const value: layer3.SingleTxBusTranscript = {
        ...sample(), rows: [{ ...sample().rows[0], effectHex: 'ab'.repeat(payloadBytes) }],
      };
      const carrier = layer3.encodeSingleTxCarrier(value);
      expect(layer3.decodeSingleTxCarrier(carrier)).toEqual(value);
      const unlocking = scriptToBytecode([
        Uint8Array.from([0x53, 0x43, 0x42, 0x31]), Uint8Array.from([1, 2]), Uint8Array.from([2, 3]),
      ]);
      expect(layer3.extractSingleTxCarrier(layer3.insertSingleTxCarrier(unlocking, value))).toEqual(value);
    }
  });
});
