import { describe, expect, it, vi } from 'vitest';
import { compileString } from '../../src/compiler.js';

const SOURCE = `interface IValue { function read(int seed) external returns (int); }
contract Coordinator(address source) {
  int public stored;
  function apply(int seed) public {
    int value = IValue(source).read(seed);
    this.stored = value;
    require(true);
  }
}`;

const OPTIONS = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  messageBusGraphContext: true,
  maximumInputBytes: 1_000_000,
  __artifactCache: false,
  __strictNoInternalRecovery: true,
} as const;

describe('kernel observation-only diagnostics', () => {
  it('does not change production bytecode when route argument tracing is enabled', () => {
    const prior = process.env.SOLIDC_DEBUG_ARG_ORDER;
    const trace = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      delete process.env.SOLIDC_DEBUG_ARG_ORDER;
      const cleanFailures: unknown[] = [];
      const clean = compileString(SOURCE, { ...OPTIONS, __attemptFailureBox: { failures: cleanFailures } });
      process.env.SOLIDC_DEBUG_ARG_ORDER = '1';
      const tracedFailures: unknown[] = [];
      const traced = compileString(SOURCE, { ...OPTIONS, __attemptFailureBox: { failures: tracedFailures } });

      expect(cleanFailures).toEqual([]);
      expect(tracedFailures).toEqual([]);
      expect(clean.messageBus?.convention).toBe('kernel-row-loop');
      expect(traced.bytecode).toBe(clean.bytecode);
      expect(traced.debug.bytecode).toBe(clean.debug.bytecode);
      expect(traced.messageBus?.route.selector).toBe(clean.messageBus?.route.selector);
      expect(trace.mock.calls.some(([message]) => message === 'message-bus-caller-band')).toBe(true);
    } finally {
      if (prior === undefined) delete process.env.SOLIDC_DEBUG_ARG_ORDER;
      else process.env.SOLIDC_DEBUG_ARG_ORDER = prior;
      trace.mockRestore();
    }
  });
});
