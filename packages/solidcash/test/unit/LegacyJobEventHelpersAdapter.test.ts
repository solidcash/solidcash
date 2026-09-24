/**
 * legacy JobEvent helper facade/legacy JobEvent naming retirement: JobEvent helper API routes through the legacy adapter facade.
 * legacy JobEvent naming retirement: JobEvent-branded public aliases deleted; only neutral legacy* exports remain.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  legacyComputePublishValueChunkBand,
  legacyLiveValueChunkBandWidth,
  legacyPersistedValueChunkWidth,
} from '../../src/stateful/legacy-job-event-helpers.js';
import {
  CompositionSettlementSession,
  runWithCompositionSettlementSession,
} from '../../src/stateful/StatefulTransactionBuilder.js';

describe('legacy JobEvent helper facade/legacy JobEvent naming retirement JobEvent helper API adapter', () => {
  it('canonical legacy* helpers remain the public band/persist API', () => {
    expect(legacyLiveValueChunkBandWidth({ plannedWidth: 2, persistWidth: 3 })).toBe(3);
    expect(legacyComputePublishValueChunkBand({
      start: 10,
      liveWidth: legacyLiveValueChunkBandWidth({ plannedWidth: 2 }),
    })).toEqual({ start: 10, end: 11, nNew: 2 });
  });

  it('adapter persist width reads the settlement session (production path)', () => {
    const session = new CompositionSettlementSession();
    expect(runWithCompositionSettlementSession(session, () => legacyPersistedValueChunkWidth('missing')))
      .toBe(0);
  });

  it('legacy JobEvent naming retirement: JobEvent-branded aliases are deleted from STB / adapter / index', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const sc = readFileSync(join(here, '../../src/stateful/StatefulContract.ts'), 'utf8');
    const index = readFileSync(join(here, '../../src/stateful/index.ts'), 'utf8');
    const adapter = readFileSync(join(here, '../../src/stateful/legacy-job-event-helpers.ts'), 'utf8');
    const stb = readFileSync(join(here, '../../src/stateful/StatefulTransactionBuilder.ts'), 'utf8');

    expect(adapter).toContain("from './StatefulTransactionBuilder.js'");
    expect(adapter).toContain('legacyLiveValueChunkBandWidth');
    expect(adapter).toContain('legacyComputePublishValueChunkBand');
    expect(adapter).not.toContain('liveJobEventsBandWidth');
    expect(adapter).not.toContain('computePublishJobEventsBand');
    expect(adapter).not.toContain('persistedJobEventsWidth');

    // phase-boundary extract: STB may define the legacy* wrappers inline or re-export them from early-value-chunk-helpers.
    expect(
      stb.includes('export function legacyLiveValueChunkBandWidth(')
      || (stb.includes('legacyLiveValueChunkBandWidth')
        && stb.includes("from './early-value-chunk-helpers.js'")),
    ).toBe(true);
    expect(stb).not.toContain('export const liveJobEventsBandWidth');
    expect(stb).not.toContain('export const computePublishJobEventsBand');
    expect(stb).not.toContain('export const persistedJobEventsWidth');

    expect(sc).toContain("from './legacy-job-event-helpers.js'");
    expect(sc).toMatch(/legacyLiveValueChunkBandWidth[\s\S]*from '\.\/legacy-job-event-helpers\.js'/);
    expect(sc).not.toContain('liveJobEventsBandWidth(');
    expect(sc).not.toContain('persistedJobEventsWidth(');

    expect(index).toContain('legacyLiveValueChunkBandWidth');
    expect(index).not.toContain('liveJobEventsBandWidth');
    expect(index).not.toContain('computePublishJobEventsBand');
    expect(index).not.toContain('persistedJobEventsWidth');
  });

  it('alpha-rename of publishJobEvent does not change adapter band math', () => {
    const a = legacyComputePublishValueChunkBand({ start: 5, liveWidth: 4 });
    expect(a).toEqual({ start: 5, end: 8, nNew: 4 });
  });
});
