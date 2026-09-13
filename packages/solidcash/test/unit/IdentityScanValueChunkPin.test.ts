import { encodeInt, Op, sha256 as sha256Sync, VALUE_CHUNK_SIZE, VALUE_HEAD_SIZE } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import {
  applyRedeemLockToChunks,
  chunksFromJobEventsValue as chunksFromEncodedValue,
  extractIdentityScanValueChunkPin,
  resolveValueChunkWriteCategory,
  selectHashedValueForChunkPin,
  type ValueChunkWriteDescriptor,
// Exercise the shipped build used by downstream consumers.
} from '../../dist/stateful/StatefulTransactionBuilder.js';

const p2sh32 = (payload: Uint8Array): Uint8Array => {
  const lock = new Uint8Array(35);
  lock[0] = 0xaa;
  lock[1] = 0x20;
  lock.set(payload.subarray(0, 32), 2);
  lock[34] = 0x87;
  return lock;
};

const identityScanState = (stack: Uint8Array[]): {
  ip: number;
  instructions: Array<{ opcode: number }>;
  stack: Uint8Array[];
} => ({
  ip: 1,
  instructions: [
    { opcode: Op.OP_DROP },
    { opcode: Op.OP_EQUALVERIFY },
    { opcode: Op.OP_2DROP },
  ],
  stack,
});

describe('identity-scan value-chunk pin', () => {
  it('recovers the redeem lock and nNew from matches==expected EQUALVERIFY', () => {
    const payload = new Uint8Array(180).fill(0x41);
    const digest = sha256Sync(payload);
    const lock = p2sh32(sha256Sync(Uint8Array.of(0x99)));
    const pin = extractIdentityScanValueChunkPin([identityScanState([
      payload,
      digest,
      lock,
      encodeInt(2n),
      new Uint8Array(),
    ])]);

    expect(pin).toEqual({ lockingBytecode: lock, nNew: 2 });

    const selected = selectHashedValueForChunkPin([[
      payload, digest, lock, encodeInt(2n), new Uint8Array(),
    ]], pin!.lockingBytecode, pin!.nNew);
    expect(selected?.value).toEqual(payload);
    expect(selected?.lockingBytecode).toEqual(lock);

    const chunks = applyRedeemLockToChunks(
      chunksFromEncodedValue(selected!.value, selected!.lockingBytecode),
      selected!.lockingBytecode,
    );
    expect(chunks).toHaveLength(Math.ceil((payload.length - VALUE_HEAD_SIZE) / VALUE_CHUNK_SIZE));
    expect(chunks).toHaveLength(2);
    expect(chunks.every((chunk) => chunk.lockingBytecode === selected!.lockingBytecode)).toBe(true);
  });
  it('prefers the full value whose sha256 matches a len4||root||head28 tail on the stack', () => {
    const payload = new Uint8Array(180).fill(0x41);
    const decoy = new Uint8Array(200).fill(0x42);
    const digest = sha256Sync(payload);
    const lock = p2sh32(sha256Sync(Uint8Array.of(0x55)));
    const length = new Uint8Array(4);
    new DataView(length.buffer).setUint32(0, payload.length, true);
    const tail = new Uint8Array([...length, ...digest, ...payload.slice(0, VALUE_HEAD_SIZE)]);
    const selected = selectHashedValueForChunkPin([[
      decoy, payload, tail, lock, encodeInt(2n),
    ]], lock, 2);
    expect(selected, 'expected a root-authenticated value').toBeDefined();
    expect(selected!.value.length, `got length ${selected!.value.length}`).toBe(180);
    expect(selected!.value[0]).toBe(0x41);
    expect(selected!.lockingBytecode).toEqual(lock);
  });

  it('accepts a planner/args candidate that matches the valueTail root when the stack lacks the full blob', () => {
    const payload = new Uint8Array(180).fill(0x41);
    const decoy = new Uint8Array(200).fill(0x42);
    const digest = sha256Sync(payload);
    const lock = p2sh32(sha256Sync(Uint8Array.of(0x66)));
    const length = new Uint8Array(4);
    new DataView(length.buffer).setUint32(0, payload.length, true);
    const tail = new Uint8Array([...length, ...digest, ...payload.slice(0, VALUE_HEAD_SIZE)]);
    // Stack has only the tail + a decoy — no full root-matching value.
    const selected = selectHashedValueForChunkPin([[
      decoy, tail, lock, encodeInt(2n),
    ]], lock, 2, [payload]);
    expect(selected?.value).toEqual(payload);
    expect(selected?.lockingBytecode).toEqual(lock);
  });

  it('rejects an args candidate that does not match an on-stack digest before valueTail exists', () => {
    const authentic = new Uint8Array(180).fill(0x41);
    const forged = new Uint8Array(176).fill(0x43);
    const digest = sha256Sync(authentic);
    const lock = p2sh32(sha256Sync(Uint8Array.of(0x66)));
    // Probe exposes sha256(authentic) but not a 64-byte valueTail yet.
    const selected = selectHashedValueForChunkPin([[
      authentic, digest, lock, encodeInt(2n),
    ]], lock, 2, [forged]);
    expect(selected?.value).toEqual(authentic);
    expect(selected!.value.length).toBe(180);
  });
  it('recovers the pin when the VM reports the following OP_2DROP as the failure ip', () => {
    const value = new Uint8Array(180).fill(0x43);
    const lock = p2sh32(sha256Sync(Uint8Array.of(0x77)));
    const pin = extractIdentityScanValueChunkPin([{
      ip: 2,
      instructions: [
        { opcode: Op.OP_DROP },
        { opcode: Op.OP_EQUALVERIFY },
        { opcode: Op.OP_2DROP },
      ],
      stack: [value, lock, encodeInt(2n), new Uint8Array()],
    }]);
    expect(pin).toEqual({ lockingBytecode: lock, nNew: 2 });
  });

  it('ignores EQUALVERIFY that is not the identity-scan count pin', () => {
    const lock = p2sh32(sha256Sync(Uint8Array.of(0x11)));
    const value = new Uint8Array(180).fill(0x42);
    expect(extractIdentityScanValueChunkPin([{
      ip: 0,
      instructions: [{ opcode: Op.OP_EQUALVERIFY }, { opcode: Op.OP_DROP }],
      stack: [value, lock, lock],
    }])).toBeUndefined();
  });

  it('places nested identity-scan chunks under a multi-resource category claim', () => {
    const categoryId = 'ee'.repeat(32);
    const otherCategory = '14'.repeat(32);
    const writes: ValueChunkWriteDescriptor[] = [
      {
        categoryId: otherCategory,
        collection: 'records',
        collectionSignature: 'records:mapping(uint256 => Record)',
        collectionHash: 'aa'.repeat(32),
        keySlot: '01'.repeat(32),
        entryAccessSlot: 0,
        routeSlot: 0,
        operation: 'insert',
        outputBase: 8,
        outputCount: 1,
      },
      {
        categoryId,
        collection: 'history',
        collectionSignature: 'history:mapping(uint256 => Change[])',
        collectionHash: 'bb'.repeat(32),
        keySlot: '02'.repeat(32),
        entryAccessSlot: 0,
        routeSlot: 0,
        operation: 'insert',
        outputBase: 12,
        outputCount: 2,
      },
    ];
    expect(resolveValueChunkWriteCategory(
      { status: 'multi', writes },
      categoryId,
      otherCategory,
    )).toBe(categoryId);
    expect(resolveValueChunkWriteCategory(
      { status: 'multi', writes },
      undefined,
      otherCategory,
    )).toBeUndefined();
  });
});
