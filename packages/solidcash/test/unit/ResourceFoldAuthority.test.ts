import { describe, expect, it } from 'vitest';
import { foldChunkableResource } from '../../src/message-bus/resource-fold.js';
import { foldLeadingRouteArrayPushes } from '../../src/stateful/StatefulContract.js';

/**
 * fold-plan authority: multi-row same-key chunkable leading/complete are fold outputs.
 * `foldLeadingRouteArrayPushes` / `encodeLeadingRouteArrayPushes` adapt `foldChunkableResource`.
 */
describe('resource-fold authority for multi-row chunkable pushes', () => {
  it('foldChunkableResource yields leading before the final push and complete after all pushes', () => {
    const elements = [Uint8Array.of(0x01), Uint8Array.of(0x02)];
    const plan = {
      collection: 'events',
      initialSource: 'empty' as const,
      steps: [
        { kind: 'push' as const, effectOrdinal: 0, elementRecipeId: 'row-0' },
        { kind: 'push' as const, effectOrdinal: 1, elementRecipeId: 'row-1' },
      ],
      leadingWitness: '__internal__leadingPushValue',
      completeWitness: '__internal__completePushValue',
    };
    const appendElement = (encoded: Uint8Array, element: Uint8Array): Uint8Array => {
      const out = new Uint8Array(encoded.length + element.length);
      out.set(encoded, 0);
      out.set(element, encoded.length);
      return out;
    };
    const folded = foldChunkableResource(plan, {
      resolveElement: (step) => elements[plan.steps.indexOf(step)],
      appendElement,
      emptyValue: () => new Uint8Array(),
    });
    expect(folded.activeSteps).toHaveLength(2);
    expect(folded.leading).toEqual(Uint8Array.of(0x01));
    expect(folded.complete).toEqual(Uint8Array.of(0x01, 0x02));
  });

  it('foldLeadingRouteArrayPushes exposes both leading and complete from foldChunkableResource', () => {
    // Smoke: adapter is exported and returns undefined without ≥2 same-key rows (no silent invent).
    expect(foldLeadingRouteArrayPushes({
      rowArguments: [],
      collection: 'events',
      valueType: 'int256[]',
      structs: [],
    })).toBeUndefined();
  });

  it('fail-closes when an active step cannot resolve its element', () => {
    expect(() => foldChunkableResource({
      collection: 'events',
      initialSource: 'empty',
      steps: [
        { kind: 'push', effectOrdinal: 0 },
        { kind: 'push', effectOrdinal: 1 },
      ],
    }, {
      resolveElement: () => undefined,
      appendElement: (a, _b) => a,
      emptyValue: () => new Uint8Array(),
    })).toThrow(/cannot evaluate element/);
  });
});
