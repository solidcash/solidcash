import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';

/**
 * Directly-dispatched chunkable / entry-loop handlers that share a route with preserved dynamic
 * arrays must receive `__internal__dynamicChunkInputBase`. Without it, NEW indices reconstruct from
 * a mis-picked owner (measured MDV1 publishJobEvent: pad@163 vs entry@161).
 */
describe('kernel dynamicChunkInputBase injection', () => {
  const opts = {
    forceStateful: true,
    messageBus: true,
    messageBusKernel: true,
  } as const;

  it('injects absolute dyn base on a chunkable-array push beside a dynamic array', () => {
    const artifact = compileString(`contract Journal() {
      bytes[] labels;
      mapping(int => int[]) events;
      function publish(int key, int value) {
        this.events[key].push(value);
        require(true);
      }
      function tag(bytes label) {
        this.labels.push(label);
        require(true);
      }
    }`, opts);
    const publish = artifact.abi.find((fn) => fn.name === 'publish');
    expect(publish?.entryAccesses?.some((a) => a.chunkableArrayValue === true)).toBe(true);
    expect(publish?.inputs?.some((input) => input.name === '__internal__dynamicChunkInputBase')).toBe(true);
  });

  it('does not force-inject dyn base on a plain mapping writer without chunkable/entry-loop needs', () => {
    const artifact = compileString(`contract Store() {
      mapping(int => int) scores;
      function setScore(int key, int value) {
        this.scores[key] = value;
        require(true);
      }
    }`, opts);
    const setScore = artifact.abi.find((fn) => fn.name === 'setScore');
    // No dynamic state on the route → injection predicate requires routeDynamicResources.length > 0.
    expect(setScore?.inputs?.some((input) => input.name === '__internal__dynamicChunkInputBase')).toBe(false);
  });
});
