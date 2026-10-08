import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

// A returning handler that owns a runtime mapping loop journals through its own per-row access vector. A
// compiler-owned route publishes one vector per batch row, so the row vector's cardinality is the selected
// handler's own stream count. Folding such a handler body into the route would charge it the route-wide union.
const SOURCE = `contract SegmentBankReturnWidths() {
  mapping(int => int) records;

  function applyVoid(int count, int base) public {
    for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      this.records[base + cursor] = cursor + 1;
    }
    require(true);
  }

  function applyOne(int count, int base) public returns (int) {
    for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      this.records[base + cursor] = cursor + 11;
    }
    require(true);
    return base + count;
  }

  function applyTwo(int count, int base) public returns (int, int) {
    for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      this.records[base + cursor] = cursor + 101;
    }
    require(true);
    return (base + count, count);
  }
}`;

describe('kernel handler loop stream scope', () => {
  it('keeps a returning handler mapping loop in its own stream space, not the route union', () => {
    const artifact = compileString(SOURCE, KERNEL);
    for (const name of ['applyVoid', 'applyOne', 'applyTwo']) {
      expect(artifact.abi.find((entry) => entry.name === name)?.sortedUpsertLoopInfo, name)
        .toHaveLength(1);
    }
    // Reverting the clone-inlining fence folds applyOne/applyTwo into the route, whose union then publishes one
    // stream per distinct inlined loop. The route must publish none: each handler owns its own access vector.
    expect(artifact.messageBus?.route.sortedUpsertLoopInfo ?? []).toHaveLength(0);
  });
});
