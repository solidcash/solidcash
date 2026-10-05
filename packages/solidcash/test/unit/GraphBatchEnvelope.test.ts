import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { assertGraphBatchBlobEnvelope } from '../../src/message-bus/graph.js';

describe('graph batch envelope ceiling', () => {
  it.each([
    ['kernel-row-loop', 10_000],
    ['legacy-unroll', 520],
  ] as const)('enforces the %s ceiling without accepting oversized metadata', (convention, limit) => {
    const artifact = (maximumBlobBytes: number): Artifact => ({
      messageBus: { convention, maximumBlobBytes },
    } as Artifact);
    expect(() => assertGraphBatchBlobEnvelope(artifact(limit - 1), 0)).not.toThrow();
    expect(() => assertGraphBatchBlobEnvelope(artifact(limit), 0)).not.toThrow();
    expect(() => assertGraphBatchBlobEnvelope(artifact(limit + 1), 0)).toThrow(/wider than/);
  });
});
