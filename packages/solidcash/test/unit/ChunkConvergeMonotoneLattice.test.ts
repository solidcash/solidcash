/**
 * constraint fixpoint / item-10 follow-on: value-chunk and dynamic-chunk converge loops share the
 * monotone lattice used by fixed-state resource converge (placeholder → resolve + freeze).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  MonotoneCell,
  finalizeMonotonePass,
  recordMonotonePass,
} from '../../src/message-bus/monotone-lattice.js';
import { convergeMessageBusComputedDynamicChunkOutputs } from '../../src/message-bus/computed-dynamic-chunks.js';
import { convergeMessageBusComputedValueChunkOutputs } from '../../src/message-bus/computed-value-chunks.js';
import {
  finalizeSemanticClaimLattice,
  recordSemanticClaimPass,
} from '../../src/message-bus/compose-semantic-claim-loop.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { TransactionBuilder } from '../../src/TransactionBuilder.js';

const messageBusDir = join(dirname(fileURLToPath(import.meta.url)), '../../src/message-bus');

describe('constraint fixpoint chunk converge monotone lattice', () => {
  it('value-chunk converge returns frozen empty geometry when no assembly is describable', () => {
    const builder = new TransactionBuilder({ provider: new MockNetworkProvider() });
    const result = convergeMessageBusComputedValueChunkOutputs(builder);
    expect(result).toEqual({ repairs: 0, rounds: 0, ownedOutputs: [], outputs: [] });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('dynamic-chunk converge returns frozen empty geometry when no assembly is describable', () => {
    const builder = new TransactionBuilder({ provider: new MockNetworkProvider() });
    const result = convergeMessageBusComputedDynamicChunkOutputs(builder);
    expect(result).toEqual({ repairs: 0, rounds: 0, ownedOutputs: [], outputs: [] });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('shared MonotoneCell still refuses a resolved→different-resolved regression', () => {
    const cell = new MonotoneCell<string>();
    cell.advance({ tag: 'placeholder', hint: 'a:00' });
    cell.resolve('a:51');
    expect(() => cell.resolve('a:00')).toThrow(/resolved value cannot change/);
  });

  it('resource/value/dyn/semantic converges call shared recordMonotonePass / finalizeMonotonePass', () => {
    for (const file of [
      'computed-value-chunks.ts',
      'computed-dynamic-chunks.ts',
      'preflight.ts',
      'compose-semantic-claim-loop.ts',
    ]) {
      const src = readFileSync(join(messageBusDir, file), 'utf8');
      expect(src).toContain('recordMonotonePass');
      expect(src).toContain('finalizeMonotonePass');
    }
    const lattice = new MonotoneCell<string>();
    const seen = new Set<string>();
    recordMonotonePass(lattice, seen, 'pass-a', 'cycle');
    expect(() => recordMonotonePass(lattice, seen, 'pass-a', 'cycle')).toThrow(/cycle/);
    finalizeMonotonePass(lattice, 'final');
    expect(lattice.get()).toEqual({ tag: 'resolved', value: 'final' });

    const claimLattice = new MonotoneCell<string>();
    const claimSeen = new Set<string>();
    recordSemanticClaimPass(claimLattice, claimSeen, 'claim-a');
    expect(() => recordSemanticClaimPass(claimLattice, claimSeen, 'claim-a'))
      .toThrow(/repeated non-final claim state/);
    finalizeSemanticClaimLattice(claimLattice, 'claim-final');
    expect(claimLattice.get()).toEqual({ tag: 'resolved', value: 'claim-final' });
  });
});
