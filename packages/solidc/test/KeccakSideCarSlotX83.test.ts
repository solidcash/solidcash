import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';
import { KeccakSideCarSlotError } from '../src/generation/GenerateTargetTraversal.js';

/**
 * X83. The loop/straight-line keccak256 mix in one stateful function.
 *
 * `keccakInLoop` is a WHOLE-FUNCTION flag. A loop reads one side-car per iteration from the trailing region past
 * blockSize under a runtime counter; code generation leaves such a function unbatched, so a keccak256 call OUTSIDE
 * the loop reads the fixed `keccakSideCar` slot whose slotIndex is its emission index. The layout used to reserve
 * no fixed slot for such a function, and the mix was refused by name. The pre-scan now records each straight-line
 * call's emission index and the layout reserves exactly those slots inside the block, disjoint from the loop's
 * trailing region, so the mix compiles.
 *
 * THE EMISSION INDEX IS SHARED BETWEEN THE TWO CONVENTIONS: a looped call consumes an index too (asserted on
 * `loopOnly`), so the straight-line call after a loop reads slot 1 and the one before it reads slot 0.
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

const CONSTRUCTOR_ONLY = [
  'contract C {',
  '  bytes32 h;',
  '  constructor(bytes a) { this.h = keccak256(a); }',
  '  function get() public view returns (bytes32) { return this.h; }',
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

interface KeccakAbiEntry {
  name: string;
  keccakInLoop?: boolean;
  keccakChainReads?: boolean;
  keccakPreimageParams?: (string | null)[];
  blockLayout?: { blockSize: number; trailingBase?: number; slots: { kind: string; slotIndex: number }[] };
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

function entryOf(source: string, name = 'f'): KeccakAbiEntry {
  const artifact = compileString(source) as unknown as { abi: KeccakAbiEntry[] };
  return artifact.abi.find((row) => row.name === name)!;
}

const sideCarSlots = (entry: KeccakAbiEntry): number[] => (entry.blockLayout?.slots ?? [])
  .filter((slot) => slot.kind === 'keccakSideCar').map((slot) => slot.slotIndex);

describe('X83: the loop/straight-line keccak256 mix reserves one fixed slot per straight-line call', () => {
  it('straight-line call first: slot 0, the looped call reads the trailing region', () => {
    expect(refusalOf(STRAIGHT_THEN_LOOP)).toBeUndefined();
    const entry = entryOf(STRAIGHT_THEN_LOOP);
    expect(entry.keccakInLoop).toBe(true);
    expect(sideCarSlots(entry)).toEqual([0]);
    expect(entry.keccakPreimageParams).toEqual(['a', 'a']);
  });

  it('loop first: the straight-line call is emission index 1, so the reserved slot is 1, not 0', () => {
    expect(refusalOf(LOOP_THEN_STRAIGHT)).toBeUndefined();
    const entry = entryOf(LOOP_THEN_STRAIGHT);
    expect(entry.keccakInLoop).toBe(true);
    expect(sideCarSlots(entry)).toEqual([1]);
    expect(entry.keccakPreimageParams).toEqual(['a', 'a']);
  });

  it('an unlooped call inside an `if`, beside a loop, is straight-line and reserves slot 0', () => {
    expect(refusalOf(KECCAK_IN_IF_OUTSIDE_LOOP_PLUS_LOOP)).toBeUndefined();
    const entry = entryOf(KECCAK_IN_IF_OUTSIDE_LOOP_PLUS_LOOP);
    expect(entry.keccakInLoop).toBe(true);
    expect(sideCarSlots(entry)).toEqual([0]);
  });
});

describe('X83: the shapes that compiled before keep their layouts', () => {
  // Each control asserts the LAYOUT as well as the compile: the mix reservation must not touch a function that
  // is all straight-line or all looped.

  it('straightOnly: one unbounded call chains (no fixed slot, no reserved band: its side-cars follow the block)', () => {
    const entry = entryOf(STRAIGHT_ONLY);
    expect(entry.keccakInLoop).toBeFalsy();
    expect(entry.keccakChainReads).toBe(true);
    expect(sideCarSlots(entry)).toEqual([]);
    expect(entry.blockLayout?.slots.some((slot) => slot.kind === 'trailing')).toBe(false);
    expect(entry.blockLayout?.trailingBase).toBeUndefined();
    expect(entry.keccakPreimageParams).toEqual(['a']);
  });

  it('constructor: the same unbounded call keeps fixed slot [0] (the deploy probe builds no chain)', () => {
    const entry = entryOf(CONSTRUCTOR_ONLY, '__construct');
    expect(entry.keccakChainReads).toBeFalsy();
    expect(sideCarSlots(entry)).toEqual([0]);
    expect(entry.keccakPreimageParams).toEqual(['a']);
  });

  it('loopOnly: keccakInLoop, ZERO fixed slots - and the looped call still consumes emission index 0', () => {
    const entry = entryOf(LOOP_ONLY);
    expect(entry.keccakInLoop).toBe(true);
    // No straight-line call, so no fixed slot: the loop reads only the trailing region.
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
