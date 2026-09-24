/**
 * branded layout coordinates: branded identity / coordinate types on the layout-resolver boundary.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  asAbsoluteInputIndex,
  asAbsoluteOutputIndex,
  asCategoryId,
  asCollectionName,
  asLocalSlotOffset,
  asParticipantId,
  type AbsoluteInputIndex,
  type AbsoluteOutputIndex,
  type ParticipantId,
} from '../../src/message-bus/kernel-brands.js';
import { resolveTransactionLayout } from '../../src/message-bus/layout-resolver.js';

describe('branded layout coordinates branded identity / coordinate types', () => {
  it('constructors brand valid values and fail closed on invalid ones', () => {
    expect(asParticipantId(0)).toBe(0);
    expect(asAbsoluteInputIndex(12)).toBe(12);
    expect(asAbsoluteOutputIndex(3)).toBe(3);
    expect(asLocalSlotOffset(5)).toBe(5);
    expect(asCategoryId('AaBb')).toBe('aabb');
    expect(asCollectionName('events')).toBe('events');

    expect(() => asParticipantId(-1)).toThrow(/ParticipantId must be a non-negative integer/);
    expect(() => asAbsoluteInputIndex(1.5)).toThrow(/AbsoluteInputIndex/);
    expect(() => asAbsoluteOutputIndex(-2)).toThrow(/AbsoluteOutputIndex/);
    expect(() => asLocalSlotOffset(-1)).toThrow(/LocalSlotOffset/);
    expect(() => asCategoryId('')).toThrow(/CategoryId must be a non-empty string/);
    expect(() => asCollectionName('')).toThrow(/CollectionName/);
  });

  it('brands are nominally distinct at the type level (documented assignability)', () => {
    // Runtime values are numbers/strings; TypeScript rejects cross-brand assignment without unwrap.
    const participant: ParticipantId = asParticipantId(1);
    const input: AbsoluteInputIndex = asAbsoluteInputIndex(10);
    const output: AbsoluteOutputIndex = asAbsoluteOutputIndex(10);
    // Same runtime value can be branded differently — brands prevent accidental mix at compile time.
    expect(participant as number).toBe(1);
    expect(input as number).toBe(output as number);
    // Structural proof that brand constructors live in the production module.
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, '../../src/message-bus/kernel-brands.ts'), 'utf8');
    expect(src).toContain("KernelBrand<number, 'ParticipantId'>");
    expect(src).toContain("KernelBrand<number, 'AbsoluteInputIndex'>");
    expect(src).toContain("KernelBrand<number, 'AbsoluteOutputIndex'>");
    expect(src).toContain("KernelBrand<string, 'CategoryId'>");
  });

  it('resolveTransactionLayout exposes branded participant / absolute coordinates', () => {
    const layout = resolveTransactionLayout({
      nonParticipantInputPrefix: 2,
      nonParticipantOutputPrefix: 1,
      participants: [
        { participant: 0, blockLayout: { blockSize: 10, trailingBase: 4, trailingCapacity: 6, slots: [] } },
        { participant: 1, blockLayout: { blockSize: 8, trailingBase: 3, trailingCapacity: 5, slots: [] } },
      ],
      dynamicBandClaims: [{ participant: 1, chunkCount: 2 }],
      valueChunkClaims: [{
        participant: 1, collection: 'events', bandOffset: 3, chunkCount: 1,
      }],
    });

    expect(layout.participants[0]?.participant).toBe(0);
    expect(layout.participants[0]?.inputBase).toBe(2);
    expect(layout.participants[0]?.outputBase).toBe(1);
    expect(layout.participants[1]?.inputBase).toBe(12);
    expect(layout.participants[1]?.outputBase).toBe(11);

    // Branded returns from absoluteInput / absoluteOutput.
    const absIn = layout.absoluteInput(1, 3);
    const absOut = layout.absoluteOutput(1, 3);
    expect(absIn).toBe(15);
    expect(absOut).toBe(14);
    expect(layout.dynamicBands[0]?.participant).toBe(1);
    expect(layout.valueChunkBands[0]?.collection).toBe('events');

    // Invalid local offset still fails closed through branded absolute helpers.
    expect(() => layout.absoluteInput(1, 99)).toThrow(/local-offset-in-block/);
    expect(() => layout.absoluteInput(-1, 0)).toThrow(/ParticipantId/);
  });

  it('layout-resolver production path imports and applies kernel brands (structural)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, '../../src/message-bus/layout-resolver.ts'), 'utf8');
    expect(src).toContain("from './kernel-brands.js'");
    expect(src).toContain('asParticipantId');
    expect(src).toContain('asAbsoluteInputIndex');
    expect(src).toContain('asAbsoluteOutputIndex');
    expect(src).toContain('participant: ParticipantId');
    expect(src).toContain('inputBase: AbsoluteInputIndex');
    expect(src).toContain('outputBase: AbsoluteOutputIndex');
    expect(src).toMatch(/absoluteInput\(participant: number, localOffset: number\): AbsoluteInputIndex/);
    expect(src).toMatch(/absoluteOutput\(participant: number, localOffset: number\): AbsoluteOutputIndex/);
  });
});
