/**
 * layout-sentinel / PredOut: compose relocatable PredOut/dyn sync uses tagged layout sentinels.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SCRIPT_ABSENT,
  SCRIPT_INACTIVE,
  decodeLayoutCoordinate,
  encodeLayoutCoordinate,
  layoutWitnessIsActiveCoordinate,
} from '../../src/message-bus/layout-sentinels.js';
import {
  applyParticipantAbsoluteWitnesses,
  resolveParticipantAbsoluteWitnesses,
} from '../../src/message-bus/layout-resolver.js';

describe('layout-sentinel / PredOut PredOut/sentinel compose sync', () => {
  it('layoutWitnessIsActiveCoordinate accepts coordinates and refuses tagged sentinels', () => {
    expect(layoutWitnessIsActiveCoordinate(0n)).toBe(true);
    expect(layoutWitnessIsActiveCoordinate(23n)).toBe(true);
    expect(layoutWitnessIsActiveCoordinate(BigInt(SCRIPT_ABSENT))).toBe(false);
    expect(layoutWitnessIsActiveCoordinate(BigInt(SCRIPT_INACTIVE))).toBe(false);
    expect(layoutWitnessIsActiveCoordinate(encodeLayoutCoordinate({ kind: 'absent' }))).toBe(false);
    expect(layoutWitnessIsActiveCoordinate(encodeLayoutCoordinate({ kind: 'inactive' }))).toBe(false);
    expect(layoutWitnessIsActiveCoordinate(encodeLayoutCoordinate({
      kind: 'inactive',
      preservedIndex: 2,
    }))).toBe(false);
    expect(layoutWitnessIsActiveCoordinate('23')).toBe(false);
    expect(layoutWitnessIsActiveCoordinate(-1)).toBe(false);
  });

  it('decodeLayoutCoordinate round-trips the same classes compose must respect', () => {
    expect(decodeLayoutCoordinate(42n)).toEqual({ kind: 'coordinate', index: 42 });
    expect(decodeLayoutCoordinate(BigInt(SCRIPT_ABSENT)).kind).toBe('absent');
    expect(decodeLayoutCoordinate(BigInt(SCRIPT_INACTIVE)).kind).toBe('inactive');
  });

  it('apply path still skips inactive PredOut sentinels while writing active physical absolutes', () => {
    const publishedBase = 100;
    const witnesses = resolveParticipantAbsoluteWitnesses({
      participant: 0,
      publishedBase,
      blockSize: 40,
      trailingBase: 5,
      trailingCapacity: 30,
      predOuts: [{
        witnessName: '__internal__vmapBatchPredOut_1',
        physicalLocalOffset: 7,
      }],
    });
    const inputs = [
      { name: '__internal__vmapBatchPredOut_0' },
      { name: '__internal__vmapBatchPredOut_1' },
    ];
    const params: unknown[] = [
      encodeLayoutCoordinate({ kind: 'inactive' }),
      4n, // provisional concrete local — apply overwrites from physical resolve
    ];
    const applied = applyParticipantAbsoluteWitnesses({
      inputs,
      params,
      witnesses,
      participant: 0,
    });
    expect(params[0]).toBe(encodeLayoutCoordinate({ kind: 'inactive' }));
    expect(params[1]).toBe(witnesses.predOuts.get('__internal__vmapBatchPredOut_1'));
    expect(params[1]).toBe(BigInt(publishedBase + 7));
    expect(applied.written.map((entry) => entry.name)).toEqual(['vmapBatchPredOut_1']);
  });

  it('compose.ts gates relocatable PredOut/dyn on layoutWitnessIsActiveCoordinate', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const bus = join(here, '../../src/message-bus');
    const src = [
      readFileSync(join(bus, 'compose.ts'), 'utf8'),
      readFileSync(join(bus, 'compose-assemble.ts'), 'utf8'),
    ].join('\n');
    expect(src).toContain("from './layout-sentinels.js'");
    expect(src).toContain('layoutWitnessIsActiveCoordinate');
    const codeLines = src.split('\n').filter((line) => {
      const t = line.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    });
    // The relocatable discovery loop must not rely on raw `value < 0n` alone.
    const rawNegativeGate = codeLines.filter((line) => (
      /typeof value !== 'bigint' \|\| value < 0n/.test(line)
      || /value < 0n \|\| value >= BigInt\(candidate\.limit\)/.test(line)
    ));
    expect(rawNegativeGate).toEqual([]);
    expect(src).toContain('!layoutWitnessIsActiveCoordinate(value)');
  });
});
