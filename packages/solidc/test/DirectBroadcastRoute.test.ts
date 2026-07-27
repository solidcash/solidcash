import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

/**
 * Direct (non-message-bus) function-pointer broadcast route.
 *
 * `d941b139` silently changed this route by making the broadcast receiver use the live loop index for EVERY
 * compilation, and by letting a fixed-bound pointer loop trigger the general unroll pass. Both were restored in
 * G1. Comparing bytecode against a pre-regression build is not something a committed test can do, so this file
 * pins the ABI properties that actually changed: one whole-table broadcast callsite that names the array and
 * its parallel selector array, no per-element master-index witnesses, and no split into single-element rows.
 */

const COMPILE_TIMEOUT_MS = 60_000;

const table = (body: string): string => `pragma solidcash >=0.8.0;
interface IH { function inc(uint value); function dec(uint value); }
contract DirectBroadcast() {
  function(uint) external[] handlers;
  function registerInc(address target) public { this.handlers.push(IH(target).inc); require(true); }
  function registerDec(address target) public { this.handlers.push(IH(target).dec); require(true); }
${body}
}`;

const RUNTIME_SIZED = table(`  function fireAll(uint value) public {
    for (int i = 0; i < handlers.length; i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }`);

// A FIXED literal trip count is the shape the regression hit hardest: it was unrolled into two single-element
// `once` callsites and grew the contract by 22.8%.
const FIXED_TRIP_COUNT = table(`  function fireTwo(uint value) public {
    for (int i = 0; i < 2; i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }`);

describe('direct function-pointer broadcast route', () => {
  it.each([
    ['a runtime-sized table', RUNTIME_SIZED, 'fireAll'],
    ['a fixed literal trip count', FIXED_TRIP_COUNT, 'fireTwo'],
  ])('keeps %s as one index-independent whole-table callsite', (_name, source, functionName) => {
    const artifact = compileString(source, { forceStateful: true });
    const fn = artifact.abi.find((candidate) => candidate.name === functionName)!;
    expect(fn.externalCalls).toHaveLength(1);
    expect(fn.externalCalls![0].loopArrayVar).toBe('handlers');
    expect(fn.externalCalls![0].selectorArrayVar).toBe('__fnsel_handlers');
    expect(fn.externalCalls![0].occurrence).toBe('loop');
    // A per-element master-index witness is the signature of the message-bus per-row expansion; the direct
    // covenant verifies the whole table in its epilogue and must not ask the caller for one.
    expect(fn.inputs.some((input) => input.name.startsWith('__internal__extcallMasterIdx'))).toBe(false);
  }, COMPILE_TIMEOUT_MS);

  it('leaves a non-pointer fixed-bound mapping-write loop unrolled', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
contract DirectMappingUnroll() {
  mapping(int => int) balances;
  function fill(int base) public {
    for (int i = 0; i < 3; i = i + 1) { this.balances[i] = base + i; }
    require(base >= 0);
  }
}`, { forceStateful: true });
    const fill = artifact.abi.find((candidate) => candidate.name === 'fill')!;
    // Three unrolled entry slots, not one rolled loop: the pointer-loop gating change must not disturb this.
    expect(fill.entryAccesses).toHaveLength(3);
  }, COMPILE_TIMEOUT_MS);
});
