import { describe, expect, test } from 'vitest';
import { accepted, expectRefusal, laidOut } from './validator-machine.js';
import { materialise } from '../validator/fixture.js';
import { abbaPlan } from '../validator/plans.js';

/**
 * A call graph with a cycle: a caller can reach a master it is called by.
 *
 * A transcript lists roots and edges, and the derived order is the depth-first walk of that graph. A cycle would
 * make the walk non-terminating or visit a master twice, so V6 refuses it (`V6_MASTER_VISITED_TWICE`). In practice
 * a cycle cannot even be built: every edge names its caller, and a master's own block records exactly one
 * `callerRef`, so the master a cycle turns through would have to record two callers. The first of the two edges the
 * derivation walks is refused by V5 as a caller mismatch, which is what this case pins.
 *
 * The mutation adds one edge to the reference `A.f -> B.g -> A.k -> B.g -> A.f` composition, closing the cycle
 * `B.g -> A.k -> B.g`; the reference composition is the faithful spend beside it.
 */
describe('a caller cycle in the derived call graph', () => {
  test('accepts the reference composition, so the edge below is the only difference', () => {
    const composition = laidOut(abbaPlan());
    expect(accepted(materialise(composition), composition.validatorIndex)).toBe(true);
  });

  test('is refused at the caller binding, because the master it turns through records one caller', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const root = composition.blocks.get('A.f')!;
    const middle = composition.blocks.get('B.g')!;
    const leaf = composition.blocks.get('A.k')!;
    const middleIndex = composition.masterIndex.get('B.g')!;

    // The leaf repeats the root's edge back to the middle, so `B.g` is now reachable twice and the graph turns
    // through it. Its `callerRef` stays the root's, so the leaf's own record disagrees with it.
    const edge = root.calls.find((call) => call.calleeRef === middleIndex)!;
    leaf.calls = [{ ...edge, calleeRef: middleIndex }];
    leaf.segments = [[], []];
    expect(middle.callerRef).toBe(composition.masterIndex.get('A.f')!);

    expectRefusal(materialise(composition), index, 'V5_CALLER_MISMATCH');
  });
});
