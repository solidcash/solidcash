/**
 * constraint fixpoint: semantic claim derivation loop records claim fingerprints on MonotoneCell
 * (same lattice family as resource/chunk converges).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  finalizeSemanticClaimLattice,
  recordSemanticClaimPass,
} from '../../src/message-bus/compose-semantic-claim-loop.js';
import { MonotoneCell } from '../../src/message-bus/monotone-lattice.js';

describe('constraint fixpoint semantic claim monotone lattice', () => {
  it('advances placeholders and refuses a repeated non-final claim state', () => {
    const lattice = new MonotoneCell<string>();
    const seen = new Set<string>();
    recordSemanticClaimPass(lattice, seen, 'pass-a');
    expect(lattice.get()).toEqual({ tag: 'placeholder', hint: 'pass-a' });
    recordSemanticClaimPass(lattice, seen, 'pass-b');
    expect(lattice.get()).toEqual({ tag: 'placeholder', hint: 'pass-b' });
    expect(() => recordSemanticClaimPass(lattice, seen, 'pass-a'))
      .toThrow(/repeated non-final claim state/);
  });

  it('resolves the lattice on stable admit and refuses a different resolved value', () => {
    const lattice = new MonotoneCell<string>();
    const seen = new Set<string>();
    recordSemanticClaimPass(lattice, seen, 'stable');
    finalizeSemanticClaimLattice(lattice, 'stable');
    expect(lattice.get()).toEqual({ tag: 'resolved', value: 'stable' });
    expect(() => finalizeSemanticClaimLattice(lattice, 'other'))
      .toThrow(/resolved value cannot change/);
  });

  it('runComposeSemanticClaimLoop wires MonotoneCell helpers on the shipped path', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(
      join(here, '../../src/message-bus/compose-semantic-claim-loop.ts'),
      'utf8',
    );
    expect(src).toMatch(/new MonotoneCell<string>\(\)/);
    expect(src).toMatch(/recordSemanticClaimPass\(claimLattice,\s*seenClaimStates,\s*claimState\)/);
    expect(src).toMatch(/finalizeSemanticClaimLattice\(claimLattice,\s*latestClaimState\)/);
  });
});
