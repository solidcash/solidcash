/**
 * F19: StatefulContract residual publishJobEvent compares go through the legacy adapter.
 * Kernel convention must not open writer / value-candidate discovery from those names.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  legacyGroupLooksLikePublishJobEvent,
  legacyIsPublishJobEventName,
} from '../../src/stateful/legacy-planning-heuristics.js';
import { chunkableWriterGroupIndex } from '../../src/stateful/StatefulContract.js';
import { permitsLegacyNamedValueChunkFallback } from '../../src/stateful/StatefulTransactionBuilder.js';

describe('F19 StatefulContract JobEvent name purge', () => {
  it('chunkableWriterGroupIndex refuses kernel groups even when named publishJobEvent', () => {
    const kernelPublish = {
      functionName: 'publishJobEvent',
      logicalArtifact: { messageBus: { convention: 'kernel-row-loop' as const } },
    };
    const kernelRenamed = {
      functionName: 'emitLedgerEvent',
      logicalArtifact: { messageBus: { convention: 'kernel-row-loop' as const } },
    };
    // No published entry effects / chunkable descriptors → legacy last-resort would apply,
    // but kernel convention closes the gate identically for both names.
    expect(permitsLegacyNamedValueChunkFallback([kernelPublish as never])).toBe(false);
    expect(permitsLegacyNamedValueChunkFallback([kernelRenamed as never])).toBe(false);
    expect(chunkableWriterGroupIndex([kernelPublish as never], 'kernel-row-loop')).toBe(-1);
    expect(chunkableWriterGroupIndex([kernelRenamed as never], 'kernel-row-loop')).toBe(-1);
  });

  it('legacy last-resort still recognizes publishJobEvent only via adapter helper', () => {
    expect(legacyIsPublishJobEventName('publishJobEvent')).toBe(true);
    expect(legacyIsPublishJobEventName('emitLedgerEvent')).toBe(false);
    expect(legacyGroupLooksLikePublishJobEvent({
      functionName: 'other',
      logicalFunctionName: 'publishJobEvent',
    })).toBe(true);
    expect(legacyGroupLooksLikePublishJobEvent({ functionName: 'emitLedgerEvent' })).toBe(false);
  });

  it('alpha-renaming publishJobEvent leaves kernel planning outcome unchanged', () => {
    const original = {
      functionName: 'publishJobEvent',
      logicalArtifact: { messageBus: { convention: 'kernel-row-loop' as const } },
    };
    const renamed = {
      functionName: 'publishRecord',
      logicalArtifact: { messageBus: { convention: 'kernel-row-loop' as const } },
    };
    expect(chunkableWriterGroupIndex([original as never], 'kernel-row-loop')).toBe(
      chunkableWriterGroupIndex([renamed as never], 'kernel-row-loop'),
    );
    expect(chunkableWriterGroupIndex([original as never], 'kernel-row-loop')).toBe(-1);
  });

  it('StatefulContract.ts has no unguarded publishJobEvent string compares', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, '../../src/stateful/StatefulContract.ts'), 'utf8');
    expect(src).toContain('legacyIsPublishJobEventName');
    expect(src).toContain("from './legacy-planning-heuristics.js'");
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
