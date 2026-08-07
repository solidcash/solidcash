import { describe, expect, it } from 'vitest';
import { compileString, compileStringMulti } from '../../src/compiler.js';

describe('message-bus compilation selection', () => {
  const STATEFUL_LEAF = `
    contract Leaf {
      int value;
      function set(int next) public { value = next; require(next >= 0); }
    }
  `;

  it('defaults a graph-free stateful contract to direct-only compilation', () => {
    const artifact = compileString(STATEFUL_LEAF);
    expect(artifact.messageBus).toBeUndefined();
    expect(artifact.compiler.options?.messageBus).toBe(false);
  });

  it('treats explicit true as an opt-in that skips narrowing and builds a graph-free leaf participant', () => {
    const artifact = compileString(STATEFUL_LEAF, { messageBus: true });
    expect(artifact.messageBus).toBeDefined();
    expect(artifact.compiler.options?.messageBus).toBe(true);
  });

  // Explicit true is a request, not an assertion: it opts out of graph-edge narrowing but keeps the direct-only
  // fallback, so a contract with no possible route still compiles. Only the internal verifier-program mode
  // (`required`) treats a missing route as fatal.
  it('falls back to direct-only when explicit true has no atomic participant route', () => {
    const artifact = compileString(`contract Stateless {
      function check(int value) public pure { require(value >= 0); }
    }`, { messageBus: true });
    expect(artifact.contractName).toBe('Stateless');
    expect(artifact.messageBus).toBeUndefined();
  });

  it('automatically selects message-bus planning for an external call graph', () => {
    const artifact = compileString(`
      interface ISink { function set(int value) external; }
      contract Caller(address sink) {
        int calls;
        function run(int value) public {
          ISink(sink).set(value);
          calls = calls + 1;
          require(value >= 0);
        }
      }
    `);
    expect(artifact.compiler.options?.messageBus).toBe(true);
    expect(artifact.messageBus).toBeDefined();
  });

  it('selects independently for each primary contract in a multi-artifact compile', () => {
    const artifacts = compileStringMulti(`
      interface ISink { function set(int value) external; }
      contract Leaf { int value; function set(int next) public { value = next; require(next >= 0); } }
      contract Caller(address sink) {
        int calls;
        function run(int value) public {
          ISink(sink).set(value);
          calls = calls + 1;
          require(value >= 0);
        }
      }
    `);
    expect(artifacts.Leaf.messageBus).toBeUndefined();
    expect(artifacts.Caller.messageBus).toBeDefined();
  });
});
