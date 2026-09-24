import { describe, expect, it } from 'vitest';
import {
  finalizeMonotonePass,
  MonotoneCell,
  recordMonotonePass,
} from '../../src/message-bus/monotone-lattice.js';

/**
 * constraint fixpoint: deferred-compute discovery (devOracle) uses the shared monotone pass helpers.
 * Recipe mode never enters the discovery loop (deferred-compute recipe gate); the lattice still refuse cycles.
 */
describe('constraint fixpoint deferred-compute discovery monotone lattice', () => {
  it('recordMonotonePass advances placeholders and refuses repeated unresolved states', () => {
    const lattice = new MonotoneCell<string>();
    const seen = new Set<string>();
    recordMonotonePass(
      lattice, seen, '0@1,2', 'messageBus: deferred-compute discovery entered a repeated unresolved state',
    );
    recordMonotonePass(
      lattice, seen, '0@1', 'messageBus: deferred-compute discovery entered a repeated unresolved state',
    );
    expect(seen.size).toBe(2);
    expect(lattice.get()).toEqual({ tag: 'placeholder', hint: '0@1' });
    expect(() => recordMonotonePass(
      lattice, seen, '0@1,2', 'messageBus: deferred-compute discovery entered a repeated unresolved state',
    )).toThrow(/repeated unresolved state/);
  });

  it('finalizeMonotonePass resolves the discovery lattice when sidecars clear', () => {
    const lattice = new MonotoneCell<string>();
    const seen = new Set<string>();
    recordMonotonePass(
      lattice, seen, '1@3', 'messageBus: deferred-compute discovery entered a repeated unresolved state',
    );
    finalizeMonotonePass(lattice, 'deferred-compute:resolved');
    expect(lattice.get()).toEqual({ tag: 'resolved', value: 'deferred-compute:resolved' });
  });
});
