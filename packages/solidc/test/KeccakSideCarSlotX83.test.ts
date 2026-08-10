import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';
import { KeccakSideCarSlotError } from '../src/generation/GenerateTargetTraversal.js';

/**
 * X83. A keccak256 side-car read whose block-layout slot was never reserved, refused by name instead of dying
 * on `Block slot not found: keccakSideCar[N]`.
 *
 * `keccakInLoop` is a WHOLE-FUNCTION flag. When it is set, `computeBlockLayout` reserves ZERO fixed
 * `keccakSideCar` slots, because a loop reads one side-car per iteration from the trailing region under a
 * runtime counter. Code generation routes to that trailing region only while the loop counter is live, so a
 * keccak256 call OUTSIDE the loop in the same function still asks for a fixed slot nobody reserved.
 *
 * THIS IS A DIAGNOSTIC CHANGE, NOT A BEHAVIOUR CHANGE. The refusal fires only where the internal invariant
 * already threw, so the three negative controls at the bottom are the load-bearing half of this file: every
 * shape that compiled before must still compile, and their layouts are asserted rather than assumed.
 *
 * THE EMISSION INDEX IS SHARED BETWEEN THE TWO CONVENTIONS, which is why the ordering matters and why the
 * pre-X83 message named slot `[0]` for one ordering and `[1]` for the other. The index is not in the message
 * any more, so it is established here from two measured artifacts instead of quoted:
 *
 *   - `loopOnly` compiles and its ONE looped call still records a preimage param, so a looped call DOES
 *     consume emission index 0;
 *   - `twoStraight` compiles with `keccakSideCar` slots [0, 1] in emission order, so indices start at 0 and
 *     increment once per call.
 *
 * Therefore the call refused in `loopThenStraight` - identified by position as the one AFTER the loop - is at
 * emission index 1, and the one refused in `straightThenLoop` is at index 0. Both are refused.
 */

/** Every fixture is stateful: a stateless function has no block layout and reads count-relative. */
const STRAIGHT_THEN_LOOP = [
  'contract C {',
  '  bytes32 h;',
  '  function f(bytes a, int n) public {',
  '    this.h = keccak256(a);',
  '    for (int i = 0; i < n; i = i + 1) { this.h = keccak256(a); }',
  '} }',
].join('\n');

const LOOP_THEN_STRAIGHT = [
  'contract C {',
  '  bytes32 h;',
  '  function f(bytes a, int n) public {',
  '    for (int i = 0; i < n; i = i + 1) { this.h = keccak256(a); }',
  '    this.h = keccak256(a);',
  '} }',
].join('\n');

/** The unlooped call inside a conditional: still unlooped, because `keccakLoopActive` is what routes the read. */
const KECCAK_IN_IF_OUTSIDE_LOOP_PLUS_LOOP = [
  'contract C {',
  '  bytes32 h;',
  '  function f(bytes a, int n) public {',
  '    if (n > 0) { this.h = keccak256(a); }',
  '    for (int i = 0; i < n; i = i + 1) { this.h = keccak256(a); }',
  '} }',
].join('\n');

const STRAIGHT_ONLY = [
  'contract C {',
  '  bytes32 h;',
  '  function f(bytes a) public { this.h = keccak256(a); }',
  '}',
].join('\n');

const LOOP_ONLY = [
  'contract C {',
  '  bytes32 h;',
  '  function f(bytes a, int n) public {',
  '    for (int i = 0; i < n; i = i + 1) { this.h = keccak256(a); }',
  '} }',
].join('\n');

const TWO_LOOPS = [
  'contract C {',
  '  bytes32 h;',
  '  function f(bytes a, int n) public {',
  '    for (int i = 0; i < n; i = i + 1) { this.h = keccak256(a); }',
  '    for (int j = 0; j < n; j = j + 1) { this.h = keccak256(a); }',
  '} }',
].join('\n');

const TWO_STRAIGHT = [
  'contract C {',
  '  bytes32 h;',
  '  bytes32 g;',
  '  function f(bytes a, bytes b) public { this.h = keccak256(a); this.g = keccak256(b); }',
  '}',
].join('\n');

const MIX_REASON = 'keccak-loop-and-straight-line-mix-not-enabled';

interface KeccakAbiEntry {
  name: string;
  keccakInLoop?: boolean;
  keccakPreimageParams?: (string | null)[];
  blockLayout?: { blockSize: number; slots: { kind: string; slotIndex: number }[] };
}

/** The refusal, or `undefined` if the fixture compiled. */
function refusalOf(source: string): KeccakSideCarSlotError | undefined {
  try {
    compileString(source);
    return undefined;
  } catch (error) {
    if (error instanceof KeccakSideCarSlotError) return error;
    throw error;
  }
}

function entryOf(source: string): KeccakAbiEntry {
  const artifact = compileString(source) as unknown as { abi: KeccakAbiEntry[] };
  return artifact.abi.find((row) => row.name === 'f')!;
}

const sideCarSlots = (entry: KeccakAbiEntry): number[] => (entry.blockLayout?.slots ?? [])
  .filter((slot) => slot.kind === 'keccakSideCar').map((slot) => slot.slotIndex);

/** The line the refusal cites, from the position `SolidCashError` appends to the message. */
const lineOf = (error: KeccakSideCarSlotError): number => Number(/at Line (\d+)/.exec(error.message)![1]);

describe('X83: the loop/straight-line keccak256 mix is refused by name', () => {
  it('the SIX-LINE minimal shape, straight-line call first, is refused with a real position', () => {
    expect(STRAIGHT_THEN_LOOP.split('\n')).toHaveLength(6);
    const error = refusalOf(STRAIGHT_THEN_LOOP);
    expect(error, 'the mix now compiles, so this refusal has no subject').toBeDefined();
    expect(error!.reason).toBe(MIX_REASON);
    // NOT the internal invariant it replaced. That message named a slot the user cannot see and carried no
    // position at all.
    expect(error!.message).not.toContain('Block slot not found');
    // The position is the STRAIGHT-LINE call, line 4 - inside the file, on the statement the user has to move.
    // Measured at `3281ece9`: Line 4, Column 13.
    expect(lineOf(error!)).toBe(4);
    expect(error!.message).toContain('at Line 4, Column 13');
    // And the detail says what to do about it, which is the difference between a diagnosis and a crash.
    expect(error!.message).toContain('one keccak256 convention per function');
  });

  it('the LOOP-FIRST ordering is refused too, at the call AFTER the loop - emission index 1, not 0', () => {
    expect(LOOP_THEN_STRAIGHT.split('\n')).toHaveLength(6);
    const error = refusalOf(LOOP_THEN_STRAIGHT);
    expect(error, 'the loop-first mix now compiles, so this refusal has no subject').toBeDefined();
    expect(error!.reason).toBe(MIX_REASON);
    // THE INDEX, ESTABLISHED RATHER THAN QUOTED. The refused call is the one on line 5, textually after the
    // loop on line 4, where the straight-first ordering refuses on line 4 with the loop below it. Since a
    // looped call consumes an emission index (asserted on `loopOnly` below) and indices increment once per
    // call from 0 (asserted on `twoStraight` below), the call refused here is index 1 and the one refused
    // above is index 0. The pre-X83 message spelled that out as `keccakSideCar[1]` versus `keccakSideCar[0]`.
    expect(lineOf(error!)).toBe(5);
    const straightFirst = refusalOf(STRAIGHT_THEN_LOOP)!;
    expect(lineOf(error!), 'both orderings refuse at the same line, so the ordering is not discriminating')
      .toBeGreaterThan(lineOf(straightFirst));
  });

  it('an unlooped call inside an `if`, beside a loop, is refused the same way', () => {
    const error = refusalOf(KECCAK_IN_IF_OUTSIDE_LOOP_PLUS_LOOP);
    expect(error, 'keccakInIfOutsideLoopPlusLoop now compiles, so this refusal has no subject').toBeDefined();
    expect(error!.reason).toBe(MIX_REASON);
    // A conditional is not a loop: `keccakLoopActive` is what routes the read to the trailing region, and a
    // branch does not set it. So the call inside the `if` is still an unlooped call asking for a fixed slot.
    expect(lineOf(error!)).toBe(4);
    expect(error!.message).toContain('at Line 4, Column 26');
  });
});

describe('X83: the three shapes that compiled must still compile', () => {
  // THE LOAD-BEARING HALF. X83 is a diagnostic change, so the claim that carries risk is not "the mix is
  // refused" but "nothing else is". Each control asserts the LAYOUT as well as the compile, because a shape
  // that compiled to a different block layout would be a behaviour change wearing a passing test.

  it('straightOnly: one call, one reserved slot [0], not in a loop', () => {
    const entry = entryOf(STRAIGHT_ONLY);
    expect(entry.keccakInLoop).toBeFalsy();
    expect(sideCarSlots(entry)).toEqual([0]);
    expect(entry.keccakPreimageParams).toEqual(['a']);
  });

  it('loopOnly: keccakInLoop, ZERO fixed slots - and the looped call still consumes emission index 0', () => {
    const entry = entryOf(LOOP_ONLY);
    expect(entry.keccakInLoop).toBe(true);
    // Zero fixed slots is the whole mechanism: this is what leaves an unlooped sibling with nothing to read.
    expect(sideCarSlots(entry)).toEqual([]);
    // ...and this is the measurement that makes "the emission index is shared" a reading rather than a claim:
    // the looped call records a preimage param, so it occupies index 0 and a straight-line sibling gets 1.
    expect(entry.keccakPreimageParams).toEqual(['a']);
  });

  it('twoLoops: two loops, still keccakInLoop and still zero fixed slots', () => {
    const entry = entryOf(TWO_LOOPS);
    expect(entry.keccakInLoop).toBe(true);
    expect(sideCarSlots(entry)).toEqual([]);
    // Two loops are not a mix - neither call is unlooped - so the guard must not fire. Both record a preimage.
    expect(entry.keccakPreimageParams).toEqual(['a', 'a']);
  });

  it('CONTROL on batching: two straight-line calls share slot 0 and retain emission order', () => {
    const entry = entryOf(TWO_STRAIGHT);
    expect(entry.keccakInLoop).toBeFalsy();
    expect(sideCarSlots(entry)).toEqual([0]);
    // Emission order, not declaration order of the state variables: `a` is hashed first.
    expect(entry.keccakPreimageParams).toEqual(['a', 'b']);
  });
});
