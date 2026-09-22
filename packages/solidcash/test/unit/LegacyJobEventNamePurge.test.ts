/**
 * F5′: remaining JobEvent / publishJobEvent planning compares are legacy-adapter only.
 * Kernel convention must not open writer discovery from those application names.
 */
import { describe, expect, it } from 'vitest';
import {
  legacyGroupLooksLikePublishJobEvent,
  legacyIsPublishJobEventName,
  permitsLegacyScalarNameHeuristics,
} from '../../src/stateful/legacy-planning-heuristics.js';
import {
  permitsLegacyNamedValueChunkFallback,
} from '../../src/stateful/StatefulTransactionBuilder.js';

describe('F5′ JobEvent name purge (legacy adapter only)', () => {
  it('legacyIsPublishJobEventName is exact — alpha-renames do not match', () => {
    expect(legacyIsPublishJobEventName('publishJobEvent')).toBe(true);
    expect(legacyIsPublishJobEventName('publishJobEventV2')).toBe(false);
    expect(legacyIsPublishJobEventName('setRecord')).toBe(false);
    expect(legacyIsPublishJobEventName(undefined)).toBe(false);
  });

  it('legacyGroupLooksLikePublishJobEvent reads only adapter helper names', () => {
    expect(legacyGroupLooksLikePublishJobEvent({ functionName: 'publishJobEvent' })).toBe(true);
    expect(legacyGroupLooksLikePublishJobEvent({
      logicalFunctionName: 'publishJobEvent',
      functionName: 'other',
    })).toBe(true);
    expect(legacyGroupLooksLikePublishJobEvent({
      compilerRoute: { abiFunction: { name: 'publishJobEvent' } },
    })).toBe(true);
    expect(legacyGroupLooksLikePublishJobEvent({ functionName: 'publishRecord' })).toBe(false);
  });

  it('kernel-row-loop forbids legacy named value-chunk and scalar name heuristics', () => {
    const kernelGroup = {
      logicalArtifact: { messageBus: { convention: 'kernel-row-loop' as const } },
      functionName: 'publishJobEvent',
    };
    expect(permitsLegacyNamedValueChunkFallback([kernelGroup as never])).toBe(false);
    expect(permitsLegacyNamedValueChunkFallback([], 'kernel-row-loop')).toBe(false);
    expect(permitsLegacyScalarNameHeuristics('kernel-row-loop')).toBe(false);
  });

  it('renaming publishJobEvent does not open kernel legacy fallback', () => {
    const renamed = {
      logicalArtifact: { messageBus: { convention: 'kernel-row-loop' as const } },
      functionName: 'emitLedgerEvent',
    };
    const original = {
      logicalArtifact: { messageBus: { convention: 'kernel-row-loop' as const } },
      functionName: 'publishJobEvent',
    };
    // Both refuse legacy fallback under kernel convention — planning outcome identical.
    expect(permitsLegacyNamedValueChunkFallback([renamed as never])).toBe(false);
    expect(permitsLegacyNamedValueChunkFallback([original as never])).toBe(false);
    expect(legacyGroupLooksLikePublishJobEvent(renamed)).toBe(false);
    expect(legacyGroupLooksLikePublishJobEvent(original)).toBe(true);
  });

  it('source has no unguarded publishJobEvent string compares in planning filters', async () => {
    // Structural: STB planning filters must call legacyGroupLooksLikePublishJobEvent / legacyIsPublishJobEventName.
    const fs = await import('node:fs');
    const src = fs.readFileSync(
      new URL('../../src/stateful/StatefulTransactionBuilder.ts', import.meta.url),
      'utf8',
    );
    const codeLines = src.split('\n').filter((line) => {
      const t = line.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    });
    const literalCompares = codeLines.filter((line) => (
      /===\s*'publishJobEvent'|==\s*'publishJobEvent'|includes\('publishJobEvent'\)/.test(line)
    ));
    expect(literalCompares).toEqual([]);
  });
});
