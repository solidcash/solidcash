import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

describe('chunked (>60 B) value in a sorted per-iteration loop', () => {
  it('compiles a per-key bytes loop and publishes the chunkable upsert-loop metadata', () => {
    const artifact = compileString(`
      contract C() {
        mapping(int => bytes) m;
        function fill(int[] ks, bytes[] vs) public {
          for (int i = 0; i < ks.length; i = i + 1) { m[ks[i]] = vs[i]; }
          require(true);
        }
      }
    `, { messageBus: false, suppressWarnings: true });

    const collection = artifact.stateLayout?.collections?.find((c) => c.name === 'm');
    expect(collection?.sorted).toBe(true);
    expect(collection?.chunkableValue).toBe(true);

    const fill = artifact.abi.find((f) => f.name === 'fill')!;
    expect(fill.sortedUpsertLoopInfo).toBeDefined();
    expect(fill.sortedUpsertLoopInfo![0]).toMatchObject({
      op: 'set',
      valueArrayParam: 'vs',
    });
  });

  it('compiles a per-key string loop writing an invariant long value', () => {
    const artifact = compileString(`
      contract C() {
        mapping(int => string) m;
        function fill(int[] ks, string v) public {
          for (int i = 0; i < ks.length; i = i + 1) { m[ks[i]] = v; }
          require(true);
        }
      }
    `, { messageBus: false, suppressWarnings: true });

    const fill = artifact.abi.find((f) => f.name === 'fill')!;
    expect(fill.sortedUpsertLoopInfo).toBeDefined();
  });
});
