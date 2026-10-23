import { describe, expect, it } from 'vitest';
import type { Artifact, PublishedWriteSegment } from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';

/**
 * The write facts an entry publishes for a dynamic value, and the fields each write leaves unchanged.
 *
 * A partial element update is compiled as a whole-element construction whose untouched fields are read back out
 * of the element, so the artifact names those fields as preserved. A write to a data record likewise names the
 * state variable it rebuilt, so a guarded call reading another field of that record stays decided by the incoming
 * state instead of being forced to state a record the execution may skip.
 */

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Ledger {'
  + '   struct Job { int state; int timestamp; int amount; }'
  + '   Job[] jobs;'
  + '   address public target;'
  + '   function preserved(int jobId) {'
  + '     this.jobs[jobId].state = 1;'
  + '     require(this.jobs[jobId].timestamp >= 0);'
  + '     require(true);'
  + '   }'
  + '   function changed(int jobId) {'
  + '     this.jobs[jobId].timestamp = 1;'
  + '     require(true);'
  + '   }'
  + ' }';

const ledger: Artifact = compileStringMulti(SOURCE, { composition: 'framed' }).Ledger!;

/** The write facts the artifact publishes for one entry, by the identity a builder looks one up by. */
function writeFacts(entryName: string): readonly PublishedWriteSegment[] {
  const entry = ledger.composition?.stopSites?.entries
    .find((candidate) => candidate.functionName === `Ledger.${entryName}()`);
  return entry?.writeSegments ?? [];
}

describe('the fields a dynamic-value write leaves unchanged, as the artifact publishes them', () => {
  it('names the untouched fields of the element the write rebuilds', () => {
    const dynamic = writeFacts('preserved').find((write) => write.variable === 'jobs');
    expect(dynamic?.preservedFields).toBeDefined();
    // The write sets `state`, so `state` changes; the other fields are read back from the element unchanged.
    expect(dynamic?.preservedFields).toContain('timestamp');
    expect(dynamic?.preservedFields).toContain('amount');
    expect(dynamic?.preservedFields).not.toContain('state');
  });

  it('does not preserve the field a write recomputes', () => {
    const dynamic = writeFacts('changed').find((write) => write.variable === 'jobs');
    expect(dynamic?.preservedFields).not.toContain('timestamp');
    expect(dynamic?.preservedFields).toContain('state');
  });

  it('names the state variable a record write rebuilt', () => {
    const record = writeFacts('preserved').find((write) => write.record !== undefined);
    expect(record?.writtenVariables).toContain('jobs');
  });
});
