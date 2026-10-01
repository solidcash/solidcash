import { binToHex, hexToBin } from '@bitauth/libauth';
import { BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import type { Output, UnlockableUtxo } from '../../src/interfaces.js';
import {
  materializeTransportedContinuations, selectTransportedContinuationResourceSlots,
  selectTransportedContinuationSlots,
  transportedContinuationSpanClaims, type TransportedContinuationOutput,
} from '../../src/message-bus/materialize-transported-continuations.js';
import { minimumActualSizeForComputedValueChunkClaims } from '../../src/message-bus/compose-recipes.js';

const categoryId = '71'.repeat(32);
const transportedResourceIdentity = `${categoryId}:${'12'.repeat(20)}:${'34'.repeat(32)}`;
const lock = (byte: number): Uint8Array => Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(byte), 0x87]);
const chunks: TransportedContinuationOutput[] = [0, 1].map((index) => ({
  offset: 6 + index, categoryId, resourceIdentity: transportedResourceIdentity,
  lockingBytecode: lock(0x31),
  commitment: `${index.toString(16).padStart(2, '0')}00010203`,
}));

function fixture(): { inputs: UnlockableUtxo[]; outputs: Output[] } {
  const inputs = Array.from({ length: 9 }, (_, index) => ({
    txid: '11'.repeat(32), vout: index, satoshis: 5000n,
    unlocker: { generateLockingBytecode: () => hexToBin(BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX) },
  })) as UnlockableUtxo[];
  const outputs: Output[] = inputs.map((input) => ({ to: Uint8Array.of(0x51), amount: input.satoshis }));
  for (const [index, chunk] of chunks.entries()) {
    // The local builder appended the new root early; reserved destinations remain balanced pads.
    outputs[2 + index] = {
      to: chunk.lockingBytecode, amount: 1200n,
      token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: chunk.commitment } },
    };
    outputs[chunk.offset] = { to: Uint8Array.of(0x51), amount: inputs[chunk.offset].satoshis };
  }
  return { inputs, outputs };
}

describe('transported continuation materialization', () => {
  it('selects an unowned trailing band beside a distinct local continuation', () => {
    const builder = fixture();
    for (let index = 2; index < builder.outputs.length; index += 1) {
      builder.outputs[index] = { to: Uint8Array.of(0x51), amount: 5000n };
    }
    const localResource = `${categoryId}:${'56'.repeat(20)}:${'78'.repeat(32)}`;
    builder.outputs[8] = {
      to: lock(0x42), amount: 1200n,
      token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: '00000102' } },
    };
    const transported = `${categoryId}:${'12'.repeat(20)}:${'34'.repeat(32)}`;
    const selected = selectTransportedContinuationSlots(
      builder, [2, 3, 4, 5, 6, 7, 8],
      chunks.map((chunk) => ({
        categoryId: chunk.categoryId, commitment: chunk.commitment,
        lockingBytecode: chunk.lockingBytecode, resourceIdentity: transported,
      })),
      [{ offset: 108, resourceIdentity: localResource, resourcePart: 'chunk:0' }], 100,
    );
    expect(selected).toEqual([6, 7]);
  });

  it('respects a distinct compiler span before its output is materialized', () => {
    const builder = fixture();
    for (let index = 2; index < builder.outputs.length; index += 1) {
      builder.outputs[index] = { to: Uint8Array.of(0x51), amount: 1000n };
    }
    const other = `${categoryId}:${'56'.repeat(20)}:${'78'.repeat(32)}`;
    expect(selectTransportedContinuationSlots(builder, [2, 3, 4, 5, 6, 7, 8],
      chunks.map(({ categoryId: category, commitment, lockingBytecode, resourceIdentity: resource }) => ({
        categoryId: category, commitment, lockingBytecode, resourceIdentity: resource,
      })), [{ offset: 108, resourceIdentity: other, resourcePart: 'chunk:0' }], 100)).toEqual([6, 7]);
  });

  it('accepts a balanced OP_TRUE pad whose dust amount differs from its funder input', () => {
    const builder = fixture();
    for (let index = 2; index < builder.outputs.length; index += 1) {
      builder.outputs[index] = { to: Uint8Array.of(0x51), amount: 1000n };
    }
    const transported = `${categoryId}:${'12'.repeat(20)}:${'34'.repeat(32)}`;
    expect(selectTransportedContinuationSlots(builder, [2, 3, 4, 5, 6, 7, 8],
      chunks.map((chunk) => ({
        categoryId: chunk.categoryId, commitment: chunk.commitment,
        lockingBytecode: chunk.lockingBytecode, resourceIdentity: transported,
      })), [], 100)).toEqual([7, 8]);
  });

  it('does not lose conflicting or unidentified local owners at a candidate slot', () => {
    const builder = fixture();
    for (let index = 2; index < builder.outputs.length; index += 1) {
      builder.outputs[index] = { to: Uint8Array.of(0x51), amount: 5000n };
    }
    const transported = `${categoryId}:${'12'.repeat(20)}:${'34'.repeat(32)}`;
    const other = `${categoryId}:${'56'.repeat(20)}:${'78'.repeat(32)}`;
    const transportedChunks = chunks.map((chunk) => ({
      categoryId: chunk.categoryId, commitment: chunk.commitment,
      lockingBytecode: chunk.lockingBytecode, resourceIdentity: transported,
    }));
    const claims = [
      { offset: 108, resourceIdentity: other, resourcePart: 'chunk:0' },
      { offset: 108, resourceIdentity: transported, resourcePart: 'chunk:1' },
    ];
    expect(selectTransportedContinuationSlots(builder, [2, 3, 4, 5, 6, 7, 8],
      transportedChunks, claims, 100)).toEqual([6, 7]);
    expect(selectTransportedContinuationSlots(builder, [2, 3, 4, 5, 6, 7, 8],
      transportedChunks, [
        { offset: 108, resourceIdentity: transported, resourcePart: 'chunk:0' },
        { offset: 108, resourceIdentity: transported, resourcePart: 'chunk:1' },
      ], 100)).toEqual([6, 7]);
    expect(selectTransportedContinuationSlots(builder, [2, 3, 4, 5, 6, 7, 8],
      transportedChunks, [{ offset: 108, resourcePart: 'chunk:1' }], 100)).toEqual([6, 7]);
  });

  it('accepts a same-resource provisional NFT only with its category, capability, and lock intact', () => {
    const transported = `${categoryId}:${'12'.repeat(20)}:${'34'.repeat(32)}`;
    const transportedChunks = chunks.map((chunk) => ({
      categoryId: chunk.categoryId, commitment: chunk.commitment,
      lockingBytecode: chunk.lockingBytecode, resourceIdentity: transported,
    }));
    const localClaim = [{
      offset: 108, resourceIdentity: transported, resourcePart: 'chunk:1',
      categoryId, commitment: '0100ffff', lockingBytecode: chunks[1]!.lockingBytecode,
    }];
    const select = (builder: ReturnType<typeof fixture>): number[] | undefined =>
      selectTransportedContinuationSlots(builder, [2, 3, 4, 5, 6, 7, 8],
        transportedChunks, localClaim, 100);
    const builder = fixture();
    for (let index = 2; index < builder.outputs.length; index += 1) {
      builder.outputs[index] = { to: Uint8Array.of(0x51), amount: 5000n };
    }
    builder.outputs[8] = {
      to: chunks[1]!.lockingBytecode, amount: 1200n,
      token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: '0100ffff' } },
    };
    expect(select(builder)).toEqual([7, 8]);
    const valid = structuredClone(builder.outputs[8]);
    builder.outputs[8].token!.category = '82'.repeat(32);
    expect(select(builder)).toEqual([6, 7]);
    builder.outputs[8] = structuredClone(valid);
    builder.outputs[8].token!.nft!.capability = 'none';
    expect(select(builder)).toEqual([6, 7]);
    builder.outputs[8] = structuredClone(valid);
    builder.outputs[8].token!.amount = 1n;
    expect(select(builder)).toEqual([6, 7]);
    builder.outputs[8] = structuredClone(valid);
    builder.outputs[8].to = lock(0x42);
    expect(select(builder)).toEqual([6, 7]);
  });

  it('does not adopt a token-bearing same-resource output with a different commitment', () => {
    const builder = fixture();
    for (let index = 2; index < builder.outputs.length; index += 1) {
      builder.outputs[index] = { to: Uint8Array.of(0x51), amount: 5000n };
    }
    builder.inputs[8].token = { category: categoryId, amount: 0n,
      nft: { capability: 'mutable', commitment: '0100aaaa' } };
    builder.outputs[8] = { to: chunks[1]!.lockingBytecode, amount: 1200n,
      token: { category: categoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: '0100ffff' } } };
    expect(selectTransportedContinuationSlots(builder, [2, 3, 4, 5, 6, 7, 8],
      chunks.map(({ categoryId: category, commitment, lockingBytecode, resourceIdentity }) => ({
        categoryId: category, commitment, lockingBytecode, resourceIdentity,
      })), [{
        offset: 108, resourceIdentity: transportedResourceIdentity, resourcePart: 'chunk:1',
        categoryId, commitment: '0100ffff', lockingBytecode: chunks[1]!.lockingBytecode,
      }],
      100)).toEqual([6, 7]);
  });

  it('requires a matching local claim before replacing a mutable predecessor pad', () => {
    const builder = fixture();
    for (let index = 2; index < builder.outputs.length; index += 1) {
      builder.outputs[index] = { to: Uint8Array.of(0x51), amount: 5000n };
    }
    const transported = `${categoryId}:${'12'.repeat(20)}:${'34'.repeat(32)}`;
    const transportedChunks = chunks.map((chunk) => ({
      categoryId: chunk.categoryId, commitment: chunk.commitment,
      lockingBytecode: chunk.lockingBytecode, resourceIdentity: transported,
    }));
    const select = (claims: Parameters<typeof selectTransportedContinuationSlots>[3] = []): number[] | undefined =>
      selectTransportedContinuationSlots(
        builder, [2, 3, 4, 5, 6, 7, 8], transportedChunks, claims, 100,
    );
    builder.inputs[8].token = {
      category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: '0000abcd' },
    };
    expect(select()).toEqual([6, 7]);
    const planned = [{ offset: 108, resourceIdentity: transported,
      resourcePart: 'chunk:1', categoryId, commitment: '00', lockingBytecode: lock(0x42) }];
    expect(select(planned)).toEqual([7, 8]);
    builder.inputs[8].token!.category = '82'.repeat(32);
    expect(select(planned)).toEqual([6, 7]);
    builder.inputs[8].token!.category = categoryId;
    materializeTransportedContinuations(builder, [2, 3, 4, 5, 6, 7, 8], [
      { ...chunks[0]!, offset: 7 }, { ...chunks[1]!, offset: 8 },
    ], planned, 100);
    expect(builder.outputs[8].token?.nft?.commitment).toBe(chunks[1]!.commitment);
    expect(builder.inputs[8].token?.nft?.commitment).toBe('0000abcd');
  });

  it('replaces stale transported-resource spans while retaining all unrelated collision checks', () => {
    const resourceA = `${categoryId}:${'12'.repeat(20)}:${'34'.repeat(32)}`;
    const resourceB = `${categoryId}:${'56'.repeat(20)}:${'78'.repeat(32)}`;
    const part = (resourceIdentity: string, offset: number, index = 0): {
      resourceIdentity: string; offset: number; resourcePart: string;
    } => ({
      resourceIdentity, offset, resourcePart: `chunk:${index}`,
    });
    const final = [part(resourceA, 46), part(resourceB, 47), part(resourceB, 48, 1)];
    const stale = [part(resourceA, 46), part(resourceA, 47, 1), part(resourceB, 46)];
    const reconciled = transportedContinuationSpanClaims(stale, final);
    expect(reconciled).toEqual(final);
    expect(minimumActualSizeForComputedValueChunkClaims(0, 40, 2, 9, reconciled)).toBe(9);
    const unrelated = part(`${categoryId}:${'90'.repeat(20)}:${'ab'.repeat(32)}`, 47);
    expect(() => minimumActualSizeForComputedValueChunkClaims(0, 40, 2, 9,
      transportedContinuationSpanClaims([...stale, unrelated], final))).toThrow(/claimed by both/);
    expect(() => minimumActualSizeForComputedValueChunkClaims(0, 40, 2, 9,
      transportedContinuationSpanClaims(stale, [part(resourceA, 46), part(resourceB, 46)])))
      .toThrow(/claimed by both/);
  });

  it('moves an already materialized run into its reserved band exactly once', () => {
    const builder = fixture();
    materializeTransportedContinuations(builder, [2, 3, 4, 5, 6, 7], chunks);
    expect(builder.outputs.slice(2, 4)).toEqual([
      { to: Uint8Array.of(0x51), amount: 5000n }, { to: Uint8Array.of(0x51), amount: 5000n },
    ]);
    for (const chunk of chunks) {
      expect(builder.outputs[chunk.offset]).toMatchObject({
        to: chunk.lockingBytecode, amount: 5000n,
        token: { category: categoryId, nft: { commitment: chunk.commitment } },
      });
      expect(builder.outputs.filter((output) => output.to instanceof Uint8Array
        && binToHex(output.to) === binToHex(chunk.lockingBytecode)
        && output.token?.nft?.commitment === chunk.commitment)).toHaveLength(1);
    }
    const once = structuredClone(builder.outputs);
    materializeTransportedContinuations(builder, [2, 3, 4, 5, 6, 7], chunks);
    expect(builder.outputs).toEqual(once);
  });

  it('rejects a stale same-resource output with a different commitment before mutation', () => {
    const builder = fixture();
    const oldCommitment = '0000ffff';
    builder.outputs[2].token!.nft!.commitment = oldCommitment;
    const before = structuredClone(builder.outputs);
    expect(() => materializeTransportedContinuations(
      builder, [2, 3, 4, 5, 6, 7], chunks,
      [{
        offset: 102, resourceIdentity: transportedResourceIdentity, resourcePart: 'chunk:0',
        categoryId, commitment: oldCommitment, lockingBytecode: chunks[0]!.lockingBytecode,
      }], 100,
    )).toThrow(/distinct local output for the same resource/);
    expect(builder.outputs).toEqual(before);
  });

  it('preserves a separately claimed resource occupying a stale transported span', () => {
    const builder = fixture();
    const other = `${categoryId}:${'56'.repeat(20)}:${'78'.repeat(32)}`;
    const otherCommitment = '0000beef';
    const otherLock = lock(0x42);
    builder.outputs[2] = {
      to: otherLock, amount: 1200n,
      token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: otherCommitment } },
    };
    const otherOutput = structuredClone(builder.outputs[2]);
    materializeTransportedContinuations(builder, [2, 3, 4, 5, 6, 7], chunks, [
      {
        offset: 102, resourceIdentity: transportedResourceIdentity, resourcePart: 'chunk:0',
        categoryId, commitment: chunks[0]!.commitment, lockingBytecode: chunks[0]!.lockingBytecode,
      },
      {
        offset: 102, resourceIdentity: other, resourcePart: 'chunk:0',
        categoryId, commitment: otherCommitment, lockingBytecode: otherLock,
      },
    ], 100);
    expect(builder.outputs[2]).toEqual(otherOutput);
  });

  it('reuses exact local outputs on non-dummy and token-bearing inputs across a protected gap', () => {
    const builder = fixture();
    for (let index = 2; index < builder.outputs.length; index += 1) {
      builder.outputs[index] = { to: Uint8Array.of(0x51), amount: 5000n };
    }
    const resourceB = `${categoryId}:${'56'.repeat(20)}:${'78'.repeat(32)}`;
    const b = { categoryId, resourceIdentity: resourceB, commitment: '0000beef', lockingBytecode: lock(0x42) };
    builder.inputs[6].token = { category: categoryId, amount: 0n,
      nft: { capability: 'mutable', commitment: '0000aaaa' } };
    builder.outputs[6] = { to: lock(0x53), amount: 1200n,
      token: { category: categoryId, amount: 0n,
        nft: { capability: 'none', commitment: 'predecessor' } } };
    for (const [index, chunk] of chunks.entries()) {
      if (index === 0) {
        builder.inputs[7 + index].unlocker = {
          ...builder.inputs[7 + index].unlocker,
          generateLockingBytecode: () => Uint8Array.of(0x51),
        };
      } else {
        builder.inputs[7 + index].token = { category: categoryId, amount: 0n,
          nft: { capability: 'mutable', commitment: `${index.toString(16).padStart(2, '0')}00aaaa` } };
      }
      builder.outputs[7 + index] = { to: chunk.lockingBytecode, amount: 1200n,
        token: { category: categoryId, amount: 0n,
          nft: { capability: 'mutable', commitment: chunk.commitment } } };
    }
    const localClaims = [
      { offset: 106, resourceIdentity: resourceB, resourcePart: 'chunk:0',
        categoryId, commitment: '00', lockingBytecode: b.lockingBytecode },
      ...chunks.map((chunk, index) => ({
        offset: 107 + index, resourceIdentity: transportedResourceIdentity,
        resourcePart: `chunk:${index}`, categoryId, commitment: chunk.commitment,
        lockingBytecode: chunk.lockingBytecode,
      })),
    ];
    const selected = selectTransportedContinuationResourceSlots(builder,
      [2, 3, 4, 5, 6, 7, 8], [
        { chunks: [b] },
        { chunks: chunks.map(({ categoryId: category, commitment, lockingBytecode, resourceIdentity }) => ({
          categoryId: category, commitment, lockingBytecode, resourceIdentity,
        })) },
      ], localClaims, 100);
    expect(selected).toEqual([[5], [7, 8]]);
    const predecessor = structuredClone(builder.outputs[6]);
    const existing = structuredClone(builder.outputs.slice(7, 9));
    materializeTransportedContinuations(builder, [2, 3, 4, 5, 6, 7, 8], [
      { ...b, offset: 5 },
      ...chunks.map((chunk, index) => ({ ...chunk, offset: 7 + index })),
    ], localClaims, 100);
    expect(builder.outputs[5].token?.nft?.commitment).toBe(b.commitment);
    expect(builder.outputs[6]).toEqual(predecessor);
    expect(builder.outputs.slice(7, 9)).toEqual(existing);
  });

  it.each(['wrong category', 'noncanonical commitment'])(
    'rejects an exact local run with a %s token predecessor', (fault) => {
      const builder = fixture();
      for (const chunk of chunks) {
        builder.outputs[chunk.offset] = { to: chunk.lockingBytecode, amount: 1200n,
          token: { category: categoryId, amount: 0n,
            nft: { capability: 'mutable', commitment: chunk.commitment } } };
      }
      builder.inputs[6].token = { category: fault === 'wrong category' ? '82'.repeat(32) : categoryId,
        amount: 0n, nft: { capability: 'mutable', commitment: fault === 'wrong category'
          ? '0000aaaa' : 'not-a-chunk' } };
      const claims = chunks.map((chunk, index) => ({
        offset: 106 + index, resourceIdentity: transportedResourceIdentity,
        resourcePart: `chunk:${index}`, categoryId, commitment: chunk.commitment,
        lockingBytecode: chunk.lockingBytecode,
      }));
      expect(selectTransportedContinuationResourceSlots(builder, [6, 7], [{
        chunks: chunks.map(({ categoryId: category, commitment, lockingBytecode, resourceIdentity }) => ({
          categoryId: category, commitment, lockingBytecode, resourceIdentity,
        })),
      }], claims, 100)).toBeUndefined();
      const before = structuredClone(builder.outputs);
      expect(() => materializeTransportedContinuations(builder, [6, 7], chunks, claims, 100))
        .toThrow(/balanced trailing slot/);
      expect(builder.outputs).toEqual(before);
    },
  );

  it('never overwrites a token-bearing same-resource output with a different root', () => {
    const builder = fixture();
    builder.inputs[6].token = { category: categoryId, amount: 0n,
      nft: { capability: 'mutable', commitment: '0000aaaa' } };
    builder.outputs[6] = { to: chunks[0]!.lockingBytecode, amount: 1200n,
      token: { category: categoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: '0000ffff' } } };
    const before = structuredClone(builder.outputs);
    expect(() => materializeTransportedContinuations(builder, [2, 3, 6, 7], chunks, [{
      offset: 106, resourceIdentity: transportedResourceIdentity, resourcePart: 'chunk:0',
      categoryId, commitment: '0000ffff', lockingBytecode: chunks[0]!.lockingBytecode,
    }], 100)).toThrow(/cannot overwrite a token-bearing local output/);
    expect(builder.outputs).toEqual(before);
  });

  it('preserves a token-bearing predecessor beneath stale value-chunk metadata', () => {
    const builder = fixture();
    builder.inputs[2].token = {
      category: categoryId, amount: 0n, nft: { capability: 'none', commitment: 'predecessor' },
    };
    builder.outputs[2] = {
      to: lock(0x53), amount: 1200n,
      token: { category: categoryId, amount: 0n,
        nft: { capability: 'none', commitment: 'successor' } },
    };
    const predecessorOutput = structuredClone(builder.outputs[2]);
    materializeTransportedContinuations(builder, [2, 3, 4, 5, 6, 7], chunks, [{
      offset: 102, resourceIdentity: transportedResourceIdentity, resourcePart: 'chunk:0',
      categoryId, commitment: '00', lockingBytecode: lock(0x42),
    }], 100);
    expect(builder.outputs[2]).toEqual(predecessorOutput);
    expect(builder.outputs[6].token?.nft?.commitment).toBe(chunks[0]!.commitment);
  });

  it('rejects an unidentified mutable local output owner before mutation', () => {
    const builder = fixture();
    const unidentified = structuredClone(builder.outputs[2]);
    unidentified.to = lock(0x53);
    builder.outputs[2] = unidentified;
    const before = structuredClone(builder.outputs);
    expect(() => materializeTransportedContinuations(builder, [2, 3, 4, 5, 6, 7], chunks, [
      {
        offset: 102, resourceIdentity: transportedResourceIdentity, resourcePart: 'chunk:0',
        categoryId, commitment: chunks[0]!.commitment, lockingBytecode: chunks[0]!.lockingBytecode,
      },
      {
        offset: 102, resourcePart: 'chunk:0', categoryId,
        commitment: unidentified.token!.nft!.commitment,
        lockingBytecode: unidentified.to as Uint8Array,
      },
    ], 100)).toThrow(/unidentified local output owner/);
    expect(builder.outputs).toEqual(before);
  });

  it.each(['category', 'lock', 'commitment', 'capability', 'amount', 'token input', 'other input', 'outside band'])(
    'preserves an output differing by %s', (difference) => {
      const builder = fixture();
      const output = builder.outputs[2];
      if (difference === 'category') output.token!.category = '82'.repeat(32);
      if (difference === 'lock') output.to = lock(0x53);
      if (difference === 'commitment') output.token!.nft!.commitment = '0000040506';
      if (difference === 'capability') output.token!.nft!.capability = 'none';
      if (difference === 'amount') output.token!.amount = 1n;
      if (difference === 'token input') builder.inputs[2].token = structuredClone(output.token);
      if (difference === 'other input') builder.inputs[2].unlocker = {
        ...builder.inputs[2].unlocker, generateLockingBytecode: () => Uint8Array.of(0x51),
      };
      const before = structuredClone(output);
      materializeTransportedContinuations(builder, difference === 'outside band' ? [3, 6, 7] : [2, 3, 6, 7], chunks);
      expect(builder.outputs[2]).toEqual(before);
      expect(builder.outputs[3].token).toBeUndefined();
    },
  );

  it('rejects an invalid destination before changing any output', () => {
    const builder = fixture();
    const before = structuredClone(builder.outputs);
    expect(() => materializeTransportedContinuations(builder, [2, 3, 6], chunks)).toThrow('balanced trailing slot');
    expect(builder.outputs).toEqual(before);
  });

  it('rejects wrong-part or false physical attribution before replacing a provisional same-resource output', () => {
    const candidate = chunks.map(({ categoryId: category, commitment, lockingBytecode, resourceIdentity }) => ({
      categoryId: category, commitment, lockingBytecode, resourceIdentity,
    }));
    for (const fault of ['wrong part', 'wrong physical commitment']) {
      const builder = fixture();
      builder.outputs[6] = { to: chunks[0]!.lockingBytecode, amount: 1200n,
        token: { category: categoryId, amount: 0n,
          nft: { capability: 'mutable', commitment: '0000ffff' } } };
      const claim = {
        offset: 106, resourceIdentity: transportedResourceIdentity,
        resourcePart: fault === 'wrong part' ? 'chunk:1' : 'chunk:0',
        categoryId, commitment: fault === 'wrong physical commitment' ? '0000aaaa' : '0000ffff',
        lockingBytecode: chunks[0]!.lockingBytecode,
      };
      expect(selectTransportedContinuationSlots(builder, [6, 7], candidate, [claim], 100))
        .toBeUndefined();
      const before = structuredClone(builder.outputs);
      expect(() => materializeTransportedContinuations(builder, [6, 7], chunks, [claim], 100))
        .toThrow(/unattributed local output/);
      expect(builder.outputs).toEqual(before);
    }
    const builder = fixture();
    builder.outputs[6] = { to: chunks[0]!.lockingBytecode, amount: 1200n,
      token: { category: categoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: '0000ffff' } } };
    const attributed = [{
      offset: 106, resourceIdentity: transportedResourceIdentity, resourcePart: 'chunk:0',
      categoryId, commitment: '0000ffff', lockingBytecode: chunks[0]!.lockingBytecode,
    }];
    expect(selectTransportedContinuationSlots(builder, [6, 7], candidate, attributed, 100))
      .toEqual([6, 7]);
    materializeTransportedContinuations(builder, [6, 7], chunks, attributed, 100);
    expect(builder.outputs[6].token?.nft?.commitment).toBe(chunks[0]!.commitment);
    const once = structuredClone(builder.outputs);
    materializeTransportedContinuations(builder, [6, 7], chunks);
    expect(builder.outputs).toEqual(once);
  });

  it('uses an owned claim on a vacant pad without overwriting another owner or output', () => {
    const candidate = chunks.map(({ categoryId: category, commitment, lockingBytecode, resourceIdentity }) => ({
      categoryId: category, commitment, lockingBytecode, resourceIdentity,
    }));
    const planned = {
      offset: 106, resourceIdentity: transportedResourceIdentity, resourcePart: 'chunk:0',
      categoryId, commitment: '00', lockingBytecode: lock(0x42),
    };
    const builder = fixture();
    expect(selectTransportedContinuationSlots(builder, [6, 7], candidate, [planned], 100))
      .toEqual([6, 7]);
    materializeTransportedContinuations(builder, [6, 7], chunks, [planned], 100);
    expect(builder.outputs[6].token?.nft?.commitment).toBe(chunks[0]!.commitment);

    for (const fault of ['other resource', 'other part', 'occupied output']) {
      const denied = fixture();
      const claim = { ...planned,
        resourceIdentity: fault === 'other resource'
          ? `${categoryId}:${'56'.repeat(20)}:${'78'.repeat(32)}` : planned.resourceIdentity,
        resourcePart: fault === 'other part' ? 'chunk:1' : planned.resourcePart,
      };
      if (fault === 'occupied output') denied.outputs[6] = { to: lock(0x53), amount: 5000n };
      expect(selectTransportedContinuationSlots(denied, [6, 7], candidate, [claim], 100))
        .toBeUndefined();
      const before = structuredClone(denied.outputs);
      expect(() => materializeTransportedContinuations(denied, [6, 7], chunks, [claim], 100))
        .toThrow(/claimed local output/);
      expect(denied.outputs).toEqual(before);
    }
  });
});
