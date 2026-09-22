import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { messageBus } from '../../src/index.js';

const sample = (): messageBus.AtomicMessageBusCallManifest => ({
  participants: [
    { lockingBytecode: '51'.repeat(64), stateCategory: '11'.repeat(32), fixedSize: 2, actualSize: 2,
      maximumSize: 2, trailingUsed: 0, returnOffset: 0xffff },
    { lockingBytecode: '52'.repeat(64), stateCategory: '22'.repeat(32), fixedSize: 2, actualSize: 3,
      maximumSize: 7, trailingUsed: 1, returnOffset: 1 },
  ],
  rows: [
    {
      kind: 0, owner: 0, consumer: 1, slot: 0, mode: 0, sourceOffset: 0, targetOffset: 0,
      selectorHex: '12345678', position: 1, parent: 0xffff, depth: 0, subtreeEnd: 1,
      subjectHex: '51', argsHex: '01', resultHex: '', effectHex: '',
    },
    {
      kind: 2, owner: 1, consumer: 0, slot: 1, mode: 0, sourceOffset: 0xffff, targetOffset: 1,
      selectorHex: 'abcdef01', position: 2, parent: 0xffff, depth: 0, subtreeEnd: 4,
      subjectHex: 'abcd', argsHex: '', resultHex: '', effectHex: 'beef',
    },
  ],
});

describe('atomic single-transaction codec', () => {
  it('round-trips one canonical callManifest and messageEnvelope', () => {
    const value = sample();
    const encoded = messageBus.encodeAtomicMessageBusCallManifest(value);
    expect(messageBus.decodeAtomicMessageBusCallManifest(encoded)).toEqual(value);
    const messageEnvelope = messageBus.encodeAtomicMessageEnvelope(value);
    expect(messageEnvelope.length).toBeGreaterThanOrEqual(messageBus.ATOMIC_MESSAGE_ENVELOPE_MIN_BYTES);
    expect(messageBus.decodeAtomicMessageEnvelope(messageEnvelope)).toEqual(value);
    expect(() => messageBus.decodeAtomicMessageEnvelope(new Uint8Array(255))).toThrow(/at least 256 bytes/);
    expect(() => messageBus.encodeAtomicMessageEnvelope({
      ...value,
      participants: value.participants.map((participant) => ({ ...participant, lockingBytecode: '51' })),
    })).toThrow(/at least 256 bytes/);
  });

  it('keeps ordinary participants on V1 and round-trips separate output identities on V2', () => {
    const ordinary = sample();
    const v1 = messageBus.encodeAtomicMessageBusCallManifest(ordinary);
    expect(binToHex(v1.slice(0, 8))).toBe(messageBus.ATOMIC_MESSAGE_BUS_DOMAIN);
    expect(messageBus.decodeAtomicMessageBusCallManifest(v1)).toEqual(ordinary);

    const upgraded: messageBus.AtomicMessageBusCallManifest = {
      ...ordinary,
      participants: ordinary.participants.map((participant, index) => ({
        ...participant,
        outputLockingBytecode: index === 0 ? '53'.repeat(64) : participant.lockingBytecode,
      })),
    };
    const v2 = messageBus.encodeAtomicMessageBusCallManifest(upgraded);
    expect(binToHex(v2.slice(0, 8))).toBe(messageBus.ATOMIC_MESSAGE_BUS_DOMAIN_V2);
    expect(messageBus.decodeAtomicMessageBusCallManifest(v2)).toEqual({ ...upgraded, version: 2 });
    expect(v2).not.toEqual(v1);

    expect(() => messageBus.encodeAtomicMessageBusCallManifest({
      ...upgraded, version: 1,
    })).toThrow(/V1 cannot authenticate a distinct participant output/);
    expect(() => messageBus.encodeAtomicMessageBusCallManifest({
      ...ordinary, version: 2,
      participants: ordinary.participants.map((participant) => ({
        ...participant, outputLockingBytecode: participant.lockingBytecode,
      })),
    })).toThrow(/V2 requires at least one distinct participant output/);
  });

  it('round-trips canonical lifecycle geometry only on V3 and rejects authority drift', () => {
    const ordinary = sample();
    const lifecycle = {
      version: 1 as const, kind: 'split' as const, count: 2,
      inputSpan: 1, outputSpan: 3, balancedSpan: 3,
      inputTail: 'funding' as const, outputTail: 'created-masters' as const,
    };
    const participants = ordinary.participants.map((participant, index) => index === 0 ? {
      ...participant, outputLockingBytecode: participant.lockingBytecode,
      fixedSize: 1, actualSize: 3, maximumSize: 3, trailingUsed: 2, returnOffset: 0xffff,
      lifecycle,
    } : { ...participant, outputLockingBytecode: participant.lockingBytecode });
    const value: messageBus.AtomicMessageBusCallManifest = {
      ...ordinary, version: 3, participants,
    };
    const encoded = messageBus.encodeAtomicMessageBusCallManifest(value);
    expect(binToHex(encoded.slice(0, 8))).toBe(messageBus.ATOMIC_MESSAGE_BUS_DOMAIN_V3);
    expect(messageBus.decodeAtomicMessageBusCallManifest(encoded)).toEqual(value);
    expect(() => messageBus.encodeAtomicMessageBusCallManifest({ ...value, version: 2 }))
      .toThrow(/cannot authenticate participant lifecycle/);
    expect(() => messageBus.encodeAtomicMessageBusCallManifest({
      ...value, participants: [participants[0], { ...participants[1], outputLockingBytecode: undefined }],
    })).toThrow(/must spell its output locking bytecode/);
    expect(() => messageBus.encodeAtomicMessageBusCallManifest({
      ...value, participants: [{ ...participants[0], lifecycle: { ...lifecycle, count: 3 } }, participants[1]],
    })).toThrow(/non-canonical lifecycle geometry/);
    expect(() => messageBus.encodeAtomicMessageBusCallManifest({
      ...value, participants: [{ ...participants[0], lifecycle: {
        ...lifecycle, outputTail: 'reclaim' as const,
      } }, participants[1]],
    })).toThrow(/non-canonical lifecycle geometry/);
    expect(() => messageBus.encodeAtomicMessageBusCallManifest({
      ...value, participants: [{ ...participants[0], actualSize: 2 }, participants[1]],
    })).toThrow(/exact balanced span/);

    const lifecycleModeOffset = 13 + 4 + 2 + 64 + 2 + 64 + 32 + 6;
    const badMode = encoded.slice(); badMode[lifecycleModeOffset] = 3;
    expect(() => messageBus.decodeAtomicMessageBusCallManifest(badMode))
      .toThrow(/non-canonical lifecycle geometry/);
    const zeroCount = encoded.slice();
    zeroCount[lifecycleModeOffset + 1] = 0; zeroCount[lifecycleModeOffset + 2] = 0;
    expect(() => messageBus.decodeAtomicMessageBusCallManifest(zeroCount))
      .toThrow(/non-canonical lifecycle geometry/);
  });

  it('round-trips KTS1 signature provenance only on V4 and rejects malformed or misplaced frames', () => {
    const ordinary = sample();
    const scalarFrame = `4b545331010100000100${'ab'.repeat(32)}`;
    const participants = ordinary.participants.map((participant) => ({
      ...participant, outputLockingBytecode: participant.lockingBytecode,
    }));
    const value: messageBus.AtomicMessageBusCallManifest = {
      ...ordinary, version: 4, participants,
      rows: [{ ...ordinary.rows[0], transactionSignatureFrameHex: scalarFrame }, ordinary.rows[1]],
    };
    const encoded = messageBus.encodeAtomicMessageBusCallManifest(value);
    expect(binToHex(encoded.slice(0, 8))).toBe(messageBus.ATOMIC_MESSAGE_BUS_DOMAIN_V4);
    expect(messageBus.decodeAtomicMessageBusCallManifest(encoded)).toEqual(value);
    expect(() => messageBus.encodeAtomicMessageBusCallManifest({ ...value, version: 3 }))
      .toThrow(/cannot authenticate transaction-signature provenance/);
    expect(() => messageBus.encodeAtomicMessageBusCallManifest({ ...value, rows: ordinary.rows }))
      .toThrow(/V4 requires transaction-signature provenance/);
    expect(() => messageBus.encodeAtomicMessageBusCallManifest({
      ...value, rows: [{ ...ordinary.rows[0], transactionSignatureFrameHex: `4b5453310201${scalarFrame.slice(12)}` }],
    })).toThrow(/does not require SIGHASH_ALL/);
    expect(() => messageBus.encodeAtomicMessageBusCallManifest({
      ...value, rows: [{ ...ordinary.rows[0], transactionSignatureFrameHex:
        `4b54533101010000010102ffff${'ab'.repeat(32)}` }],
    })).toThrow(/unknown signature path segment/);
    expect(() => messageBus.encodeAtomicMessageBusCallManifest({
      ...value, rows: [{ ...ordinary.rows[1], transactionSignatureFrameHex: scalarFrame }],
    })).toThrow(/non-invocation row/);

    const changedCoveredProgram = {
      ...value, rows: [{ ...value.rows[0], transactionSignatureFrameHex:
        `${scalarFrame.slice(0, -64)}${'ac'.repeat(32)}` }, value.rows[1]],
    };
    expect(messageBus.encodeAtomicMessageBusCallManifest(changedCoveredProgram)).not.toEqual(encoded);
  });

  it('rejects malformed or truncated V2 output identities', () => {
    const value: messageBus.AtomicMessageBusCallManifest = {
      ...sample(),
      version: 2,
      participants: sample().participants.map((participant, index) => ({
        ...participant, outputLockingBytecode: index === 0 ? '53'.repeat(64) : participant.lockingBytecode,
      })),
    };
    expect(() => messageBus.encodeAtomicMessageBusCallManifest({
      ...value,
      participants: [{ ...value.participants[0], outputLockingBytecode: '' }, value.participants[1]],
    })).toThrow(/output locking bytecode is empty/);
    const encoded = messageBus.encodeAtomicMessageBusCallManifest(value);
    // V2's first output-identity frame begins after domain/length/count, sizes, and the input-identity frame.
    const outputLengthOffset = 13 + 4 + 2 + value.participants[0].lockingBytecode.length / 2;
    const malformed = encoded.slice();
    malformed[outputLengthOffset] = 0xff;
    malformed[outputLengthOffset + 1] = 0xff;
    expect(() => messageBus.decodeAtomicMessageBusCallManifest(malformed)).toThrow(/truncated/);
    const nonCanonical = encoded.slice();
    nonCanonical.fill(0x51, outputLengthOffset + 2, outputLengthOffset + 2 + 64);
    expect(() => messageBus.decodeAtomicMessageBusCallManifest(nonCanonical))
      .toThrow(/V2 requires at least one distinct participant output/);
  });

  it('places complete blocks contiguously before the fee tail', () => {
    expect(messageBus.atomicMessageBusPhysicalLayout([2, 3, 1])).toEqual({
      participantInputs: [0, 2, 5], verifierInputs: [6, 7, 8],
      verifierInput: 8, feeInput: 9, totalSlots: 10,
    });
  });

  it('rejects domain, declared length, participant count, truncation, suffix, and messageEnvelope mutations', () => {
    const encoded = messageBus.encodeAtomicMessageBusCallManifest(sample());
    for (const offset of [0, 8, 12]) {
      const changed = encoded.slice(); changed[offset] ^= 1;
      expect(() => messageBus.decodeAtomicMessageBusCallManifest(changed)).toThrow();
    }
    expect(() => messageBus.decodeAtomicMessageBusCallManifest(encoded.slice(0, -1))).toThrow();
    expect(() => messageBus.decodeAtomicMessageBusCallManifest(Uint8Array.from([...encoded, 0]))).toThrow();
    const messageEnvelope = messageBus.encodeAtomicMessageEnvelope(sample());
    for (const offset of [0, 4]) {
      const changed = messageEnvelope.slice(); changed[offset] ^= 1;
      expect(() => messageBus.decodeAtomicMessageEnvelope(changed)).toThrow();
    }
    expect(() => messageBus.decodeAtomicMessageEnvelope(Uint8Array.from([...messageEnvelope, 0]))).toThrow();
  });

  it('rejects mutations to participant boundaries and every row discriminator', () => {
    const encoded = messageBus.encodeAtomicMessageBusCallManifest(sample());
    // Header is 13 bytes; first fixedSize/actualSize fields start there.
    for (const offset of [12, 13, 15]) {
      const changed = encoded.slice(); changed[offset] ^= 0xff;
      expect(() => messageBus.decodeAtomicMessageBusCallManifest(changed)).toThrow();
    }
    const decoded = messageBus.decodeAtomicMessageBusCallManifest(encoded);
    expect(() => messageBus.encodeAtomicMessageBusCallManifest({ ...decoded, rows: [
      { ...decoded.rows[0], kind: 7 }, ...decoded.rows.slice(1),
    ] })).toThrow(/unknown kind/);
    expect(() => messageBus.encodeAtomicMessageBusCallManifest({ ...decoded, rows: [
      { ...decoded.rows[0], kind: 5 }, ...decoded.rows.slice(1),
    ] })).not.toThrow();
    expect(() => messageBus.encodeAtomicMessageBusCallManifest({ ...decoded, rows: [
      { ...decoded.rows[0], owner: 2 }, ...decoded.rows.slice(1),
    ] })).toThrow(/unknown participant/);
  });

  it('accepts variable spans and rejects malformed actual usage or capacity overflow', () => {
    expect(() => messageBus.atomicMessageBusPhysicalLayout([1, 0])).toThrow(/positive integer/);
    expect(() => messageBus.encodeAtomicMessageBusCallManifest({ ...sample(), participants: [
      sample().participants[0], { ...sample().participants[1], actualSize: 4 },
    ] })).toThrow(/variable span/);
    expect(() => messageBus.encodeAtomicMessageBusCallManifest({ ...sample(), participants: [
      sample().participants[0], { ...sample().participants[1], actualSize: 8, trailingUsed: 6 },
    ] })).toThrow(/variable span/);
    expect(() => messageBus.encodeAtomicMessageBusCallManifest({
      ...sample(), rows: Array.from({ length: 65 }, () => sample().rows[0]),
    })).not.toThrow();
    expect(() => messageBus.encodeAtomicMessageBusCallManifest({
      ...sample(), rows: Array.from({ length: messageBus.ATOMIC_MESSAGE_BUS_MAX_ROWS + 1 }, () => sample().rows[0]),
    })).toThrow(/row count/);
  });

  it('relocates a later participant when actual chunk use changes without changing local rows', () => {
    const base = sample();
    const oneChunk = {
      ...base,
      participants: [{
        ...base.participants[0], actualSize: 3, maximumSize: 7, trailingUsed: 1,
      }, base.participants[1]],
    };
    const fiveChunks = {
      ...oneChunk,
      participants: [{ ...oneChunk.participants[0], actualSize: 7, trailingUsed: 5 }, oneChunk.participants[1]],
    };
    expect(messageBus.atomicMessageBusPhysicalLayout(oneChunk.participants.map((p) => p.actualSize)))
      .toMatchObject({ participantInputs: [0, 3], verifierInputs: [6, 7], verifierInput: 7, feeInput: 8 });
    expect(messageBus.atomicMessageBusPhysicalLayout(fiveChunks.participants.map((p) => p.actualSize)))
      .toMatchObject({ participantInputs: [0, 7], verifierInputs: [10, 11], verifierInput: 11, feeInput: 12 });
    expect(fiveChunks.rows).toEqual(oneChunk.rows);
    expect(messageBus.decodeAtomicMessageBusCallManifest(messageBus.encodeAtomicMessageBusCallManifest(fiveChunks)))
      .toEqual(fiveChunks);
  });

  it('is injective under every single-byte mutation of a canonical callManifest', () => {
    const encoded = messageBus.encodeAtomicMessageBusCallManifest(sample());
    for (let offset = 0; offset < encoded.length; offset += 1) {
      const changed = encoded.slice();
      changed[offset] ^= 1;
      try {
        const decoded = messageBus.decodeAtomicMessageBusCallManifest(changed);
        expect(decoded, `mutation at byte ${offset} decoded to the original value`).not.toEqual(sample());
        expect(messageBus.encodeAtomicMessageBusCallManifest(decoded), `mutation at byte ${offset} was non-canonical`)
          .toEqual(changed);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    }
  });

  it('round-trips messageEnvelope payloads across Bitcoin Script push-size boundaries', () => {
    for (const payloadBytes of [0, 75, 76, 255, 256, 1024]) {
      const value: messageBus.AtomicMessageBusCallManifest = {
        ...sample(), rows: [{ ...sample().rows[0], effectHex: 'ab'.repeat(payloadBytes) }],
      };
      const messageEnvelope = messageBus.encodeAtomicMessageEnvelope(value);
      expect(messageBus.decodeAtomicMessageEnvelope(messageEnvelope)).toEqual(value);
    }
  });
});
