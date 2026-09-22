import { describe, expect, it } from 'vitest';
import {
  legacyIsJobEventsCollection,
  legacyIsPublishJobEventName,
  legacyScalarNameHints,
  permitsLegacyScalarNameHeuristics,
} from '../../src/stateful/legacy-planning-heuristics.js';
import { permitsLegacyNamedValueChunkFallback } from '../../src/stateful/StatefulTransactionBuilder.js';

describe('legacy planning heuristics isolation (item 1)', () => {
  it('exposes JobEvent / jobEvents name matchers only via the legacy adapter module', () => {
    expect(legacyIsPublishJobEventName('publishJobEvent')).toBe(true);
    expect(legacyIsPublishJobEventName('setRecord')).toBe(false);
    expect(legacyIsJobEventsCollection('jobEvents')).toBe(true);
    expect(legacyIsJobEventsCollection('records')).toBe(false);
  });

  it('kernel-row-loop forbids legacy named value-chunk fallback and scalar name heuristics', () => {
    expect(permitsLegacyNamedValueChunkFallback([], 'kernel-row-loop')).toBe(false);
    expect(permitsLegacyScalarNameHeuristics('kernel-row-loop')).toBe(false);
    expect(permitsLegacyScalarNameHeuristics('legacy-unroll')).toBe(true);
  });

  it('alpha-renaming scalar function names changes legacy hints but kernel path ignores them', () => {
    const resetHints = legacyScalarNameHints('reset');
    const foobarHints = legacyScalarNameHints('foobar');
    expect(resetHints.zero).toBe(true);
    expect(foobarHints.zero).toBe(false);

    // Kernel convention: name heuristics disabled — both names yield the same (disabled) policy.
    expect(permitsLegacyScalarNameHeuristics('kernel-row-loop')).toBe(false);
    const kernelUsesHints = permitsLegacyScalarNameHeuristics('kernel-row-loop');
    expect(kernelUsesHints && resetHints.zero).toBe(false);
    expect(kernelUsesHints && foobarHints.zero).toBe(false);
  });

  it('kernel artifact groups cannot take the publishJobEvent name branch', () => {
    const kernelGroup = {
      logicalArtifact: { messageBus: { convention: 'kernel-row-loop' as const } },
      functionName: 'publishJobEvent',
    };
    expect(permitsLegacyNamedValueChunkFallback([kernelGroup as never])).toBe(false);
  });
});
