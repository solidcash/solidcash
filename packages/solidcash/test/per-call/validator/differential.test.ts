/**
 * The property-based differential harness.
 *
 * The generator lays out valid compositions and applies exactly one mutation to each. Every case is handed to both
 * real modules — the derivation in the compiler package and the independent reference model in the SDK — and the two
 * must agree on whether it is accepted, on the check it is rejected by, and on the execution order they derive.
 *
 * The PRNG is deterministic, so any failure reproduces from its seed (printed in the case name).
 */

import { describe, expect, test } from 'vitest';
import { generateCases, type GeneratedCase } from './generator.js';
import { materialise, planComposition, type Composition } from './fixture.js';
import { decideBoth, disagreement, describeOrder } from './harness.js';

interface Tally {
  accepted: number;
  rejected: number;
  refusedByCodec: number;
}

/** Runs every case and returns the disagreements, the plan failures and the tally. */
function runCases(cases: readonly GeneratedCase[]): { failures: string[]; planFailures: string[]; tally: Tally } {
  const failures: string[] = [];
  const planFailures: string[] = [];
  const tally: Tally = { accepted: 0, rejected: 0, refusedByCodec: 0 };

  for (const testCase of cases) {
    let composition: Composition;
    try {
      composition = planComposition(testCase.plan);
    } catch (error) {
      planFailures.push(`${testCase.name}: ${(error as Error).message}`);
      continue;
    }
    testCase.mutate(composition);

    let transaction;
    try {
      transaction = materialise(composition);
    } catch (error) {
      // The frozen codec refuses some mutations outright (for example an entry that is created and deleted at
      // once). Those bytes cannot exist on chain, so there is nothing for the two models to decide.
      tally.refusedByCodec += 1;
      continue;
    }

    const both = decideBoth(transaction, composition.validatorIndex);
    const difference = disagreement(both);
    if (difference !== undefined) {
      failures.push(
        `${testCase.name}: ${difference} `
        + `[derivation ${both.derivation.accepted ? 'accepted' : `${both.derivation.rejection?.check}/${both.derivation.rejection?.reason}`}, `
        + `reference ${both.reference.accepted ? 'accepted' : `${both.reference.check}/${both.reference.reason}`}, `
        + `derivation order ${describeOrder(both.derivation.order)}, reference order ${describeOrder(both.reference.order)}]`,
      );
    }
    if (both.derivation.accepted) tally.accepted += 1;
    else tally.rejected += 1;
  }

  return { failures, planFailures, tally };
}

describe('differential harness', () => {
  test('every generated composition decides the same way in both models (seed 0x5eed)', () => {
    const cases = generateCases(0x5eed, 120);
    const { failures, planFailures, tally } = runCases(cases);

    expect(planFailures).toEqual([]);
    expect(failures).toEqual([]);
    // A harness that only ever sees one outcome would not be testing agreement, and a harness that quietly skipped
    // half its cases through codec refusals would not be testing much either.
    expect(tally.accepted).toBeGreaterThanOrEqual(10);
    expect(tally.rejected).toBeGreaterThanOrEqual(20);
    expect(tally.accepted + tally.rejected).toBeGreaterThanOrEqual(100);
    expect(tally.refusedByCodec).toBeLessThanOrEqual(20);
  });

  test('every generated composition decides the same way in both models (seed 0x9c311)', () => {
    const cases = generateCases(0x9c311, 120);
    const { failures, planFailures, tally } = runCases(cases);

    expect(planFailures).toEqual([]);
    expect(failures).toEqual([]);
    expect(tally.accepted).toBeGreaterThanOrEqual(10);
    expect(tally.rejected).toBeGreaterThanOrEqual(20);
    expect(tally.accepted + tally.rejected).toBeGreaterThanOrEqual(100);
    expect(tally.refusedByCodec).toBeLessThanOrEqual(20);
  });
});
