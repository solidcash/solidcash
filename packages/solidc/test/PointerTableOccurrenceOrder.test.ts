import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';
import type { Artifact } from '../src/index.js';

/**
 * G2 - the published occurrence sequence is the source execution order.
 *
 * The caller's covenant consumes one row per reached occurrence in the order its expanded callsites execute,
 * and the SDK builds the emission vector by walking `abi.externalCalls` in array order. Those two orders must be
 * the same order the source writes, otherwise an honest transcript is rejected and a permuted one could be
 * accepted. The VM half of this is proven in the SDK's `Layer3OccurrenceExhaustion.test.ts`; this file pins the
 * published order itself, including across several dispatch groups in one function, where a single loop cannot
 * show it. It also records which shapes publish an explicit ceiling and which do not.
 */

const OPTIONS = {
  forceStateful: true,
  hiddenBatch: true,
  messageBusController: `aa20${'11'.repeat(32)}87`,
  messageBusControllerCategory: '22'.repeat(32),
} as const;

const TIMEOUT = 120_000;

/** Message-bus compilation of these fixtures costs seconds; compile each source once. */
const compiled = new Map<string, Artifact>();
const artifactOf = (source: string): Artifact => {
  const existing = compiled.get(source);
  if (existing) return existing;
  const artifact = compileString(source, OPTIONS);
  compiled.set(source, artifact);
  return artifact;
};

const callsites = (source: string): any[] =>
  [...(artifactOf(source).abi.find((fn) => fn.name === 'fireAll')!.externalCalls ?? [])];

/** The parameter each published callsite forwards, which is what distinguishes one dispatch group from another. */
const forwardedParameters = (source: string): (number | undefined)[] =>
  callsites(source).map((call) => call.argSources?.[0]?.paramIndex);

const summaryOf = (source: string): any =>
  artifactOf(source).invocationAnalysis!.functions.find((fn) => fn.name === 'fireAll')!;

/** One group, VARYING selector: the shape G1 coalesces into a single bounded loop callsite. */
const VARYING_SINGLE_LOOP = `pragma solidcash >=0.8.0;
interface IVaryingHandler { function inc(uint value); function dec(uint value); }
contract VaryingSingleLoop() {
  function(uint) external[] handlers;
  function registerInc(address target) public { this.handlers.push(IVaryingHandler(target).inc); require(true); }
  function registerDec(address target) public { this.handlers.push(IVaryingHandler(target).dec); require(true); }
  function fireAll(uint value) public {
    require(handlers.length <= 3);
    for (int i = 0; i < handlers.length; i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }
}`;

/** One group, SINGLE selector: the same loop, expanded but not coalesced. */
const FIXED_SELECTOR_SINGLE_LOOP = `pragma solidcash >=0.8.0;
interface IVaryingHandler { function inc(uint value); function dec(uint value); }
contract FixedSelectorSingleLoop() {
  function(uint) external[] handlers;
  function registerInc(address target) public { this.handlers.push(IVaryingHandler(target).inc); require(true); }
  function fireAll(uint value) public {
    require(handlers.length <= 3);
    for (int i = 0; i < handlers.length; i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }
}`;

const TWO_GROUPS = `pragma solidcash >=0.8.0;
interface IVaryingHandler { function inc(uint value); function dec(uint value); }
contract TwoGroups() {
  function(uint) external[] first;
  function(uint) external[] second;
  function registerFirst(address target) public { this.first.push(IVaryingHandler(target).inc); require(true); }
  function registerSecond(address target) public { this.second.push(IVaryingHandler(target).dec); require(true); }
  function fireAll(uint a, uint b) public {
    require(first.length <= 2);
    require(second.length <= 2);
    for (int i = 0; i < first.length; i = i + 1) { first[i](a); }
    for (int j = 0; j < second.length; j = j + 1) { second[j](b); }
    require(a >= 0);
  }
}`;

const LOOP_THEN_STRAIGHT = `pragma solidcash >=0.8.0;
interface IVaryingHandler { function inc(uint value); function dec(uint value); }
contract LoopThenStraight() {
  function(uint) external[] handlers;
  function registerInc(address target) public { this.handlers.push(IVaryingHandler(target).inc); require(true); }
  function fireAll(uint a, uint b, address tail) public {
    require(handlers.length <= 2);
    for (int i = 0; i < handlers.length; i = i + 1) { handlers[i](a); }
    IVaryingHandler(tail).dec(b);
    require(a >= 0);
  }
}`;

const RUNTIME_LOOP_PLAIN_CALL = `pragma solidcash >=0.8.0;
interface IFoo { function bar(uint value); }
contract RuntimeLoopPlainCall() {
  int n;
  function fireAll(uint value, address target) public {
    require(n <= 3);
    for (int i = 0; i < n; i = i + 1) { IFoo(target).bar(value); }
    require(value >= 0);
  }
}`;

const UNBOUNDED_LOOP_PLAIN_CALL = `pragma solidcash >=0.8.0;
interface IFoo { function bar(uint value); }
contract UnboundedLoopPlainCall() {
  int n;
  function fireAll(uint value, address target) public {
    for (int i = 0; i < n; i = i + 1) { IFoo(target).bar(value); }
    require(value >= 0);
  }
}`;

const FIXED_LOOP_PLAIN_CALL = `pragma solidcash >=0.8.0;
interface IFoo { function bar(uint value); }
contract FixedLoopPlainCall() {
  function fireAll(uint value, address target) public {
    for (int i = 0; i < 3; i = i + 1) { IFoo(target).bar(value); }
    require(value >= 0);
  }
}`;

describe('pointer-table occurrence ordering', () => {
  it('publishes one bounded loop callsite with an explicit ceiling for a varying-selector group', () => {
    const [call, ...rest] = callsites(VARYING_SINGLE_LOOP);
    expect(rest).toHaveLength(0);
    expect(call.occurrence).toBe('loop');
    expect(call.maximumOccurrences).toBe(3);
    expect(call.selectorArrayVar).toBe('__fnsel_handlers');
    expect(summaryOf(VARYING_SINGLE_LOOP).bounded).toBe(true);
  }, TIMEOUT);

  it('publishes two dispatch groups as one contiguous source-ordered callsite sequence', () => {
    const calls = callsites(TWO_GROUPS);
    // The proven ceiling of each group is two, so the whole function is four ordered occurrences.
    expect(calls).toHaveLength(4);
    expect(calls.map((call) => call.callsiteId)).toEqual([0, 1, 2, 3]);
    // Group boundary: the first loop forwards parameter 0, the second forwards parameter 1. A published order
    // that interleaved the groups would show as [0, 1, 0, 1] here.
    expect(forwardedParameters(TWO_GROUPS)).toEqual([0, 0, 1, 1]);
    // Every occurrence of a group answers that group's interface method, in group order.
    expect(calls.map((call) => call.functionName)).toEqual(['inc', 'inc', 'dec', 'dec']);
    // Each occurrence keeps its own physical co-spend slot, assigned in the same order.
    expect(calls.map((call) => call.computedOffset ?? 0)).toEqual([0, 1, 2, 3]);
  }, TIMEOUT);

  it('orders an expanded loop group before a following straight-line callsite', () => {
    const calls = callsites(LOOP_THEN_STRAIGHT);
    expect(calls).toHaveLength(3);
    expect(calls.map((call) => call.occurrence)).toEqual(['conditional', 'conditional', 'once']);
    expect(forwardedParameters(LOOP_THEN_STRAIGHT)).toEqual([0, 0, 1]);
    expect(calls.map((call) => call.functionName)).toEqual(['inc', 'inc', 'dec']);
  }, TIMEOUT);

  it('publishes a fixed literal trip count as an exact loop occurrence, floor and ceiling', () => {
    const [call] = callsites(FIXED_LOOP_PLAIN_CALL);
    expect(call.occurrence).toBe('loop');
    expect(call.maximumOccurrences).toBe(3);
    // X4: the count cannot vary, so the floor is published too and a consumer planning 2 rows is wrong before
    // a transaction exists rather than after the VM rejects one.
    expect(call.minimumOccurrences).toBe(3);
    expect(call.occurrenceBoundSource).toBe('literal');
  }, TIMEOUT);

  it('publishes a require-derived pointer-table ceiling with no floor', () => {
    const [call] = callsites(VARYING_SINGLE_LOOP);
    expect(call.maximumOccurrences).toBe(3);
    // The guard bounds the table from above only; a shorter runtime table reaches fewer rows honestly.
    expect(call.minimumOccurrences).toBeUndefined();
    expect(call.occurrenceBoundSource).toBe('guard');
  }, TIMEOUT);

  /**
   * Board 4.7, first two recorded gaps, CLOSED here.
   *
   * Both shapes are expanded correctly and both were already fail-closed on chain, but neither published a
   * per-callsite ceiling: coalescing keys on `selectorArrayVar`/`fnPtrCall`, which a single-method table never
   * sets, and admits exactly one group. Rather than widen coalescing - which would rewrite the published row
   * count and the slot correspondence the planner depends on - each expanded row now carries the ceiling it
   * always had structurally. A `conditional` row is reached at most once by construction, so `1` is a proven
   * ceiling, and the function summary aggregates them into the same total the expansion proved.
   */
  it.each([
    ['a single-selector pointer table', FIXED_SELECTOR_SINGLE_LOOP, 3],
    ['a multi-group function', TWO_GROUPS, 4],
  ])('publishes an explicit per-callsite ceiling for %s', (_label, source, count) => {
    const calls = callsites(source as string);
    expect(calls).toHaveLength(count as number);
    for (const call of calls) {
      expect(call.occurrence).toBe('conditional');
      expect(call.maximumOccurrences).toBe(1);
      // A conditional row can be skipped, so it never carries a floor.
      expect(call.minimumOccurrences).toBeUndefined();
    }
    const summary = summaryOf(source as string);
    expect(summary.bounded).toBe(true);
    expect(summary.maximumDirectInvocations).toBe(count);
  }, TIMEOUT);

  /**
   * Board 4.7, third recorded gap, CLOSED for every shape whose source carries a bound.
   *
   * A loop holding an ordinary interface call keeps its rolled form - `ExpandBoundedPointerTableLoop` expands
   * only POINTER dispatches - so nothing about the emitted covenant changes. What changes is that the ceiling
   * the source already proves reaches the artifact, through the same guard and mutation analysis the pointer
   * table demands, so the planner has a compiler-proven number to check a chosen row count against.
   */
  it('publishes a require-derived ceiling for a rolled loop holding an ordinary interface call', () => {
    const artifact = artifactOf(RUNTIME_LOOP_PLAIN_CALL);
    expect(artifact.hiddenBatch!.handlers.map((handler) => handler.name)).toContain('fireAll');
    const [call, ...rest] = callsites(RUNTIME_LOOP_PLAIN_CALL);
    expect(rest).toHaveLength(0);
    expect(call.occurrence).toBe('loop');
    expect(call.maximumOccurrences).toBe(3);
    expect(call.minimumOccurrences).toBeUndefined();
    expect(call.occurrenceBoundSource).toBe('guard');
    expect(summaryOf(RUNTIME_LOOP_PLAIN_CALL).bounded).toBe(true);
  }, TIMEOUT);

  /**
   * REMAINING SCOPE, not a gap that this round closes.
   *
   * A loop whose trip count has no source bound at all proves nothing, so nothing is published and
   * `deriveCompiledGraphPlan` still admits any count up to the global 24-invocation transcript ceiling. The
   * caller covenant emits exactly the rows the source executes, so an inflated count is rejected on chain;
   * what is absent is a plan-time bound, and no compiler analysis can invent one. Closing this means either
   * refusing the shape at compile time - which would reject `Layer3CompiledGraph`'s established
   * `LoopGraph.repeat` acceptance case - or having the planner refuse an unproven ceiling, which lives in the
   * SDK worklist.
   */
  it('SCOPED: publishes no ceiling for a loop whose trip count the source never bounds', () => {
    const artifact = artifactOf(UNBOUNDED_LOOP_PLAIN_CALL);
    expect(artifact.hiddenBatch!.handlers.map((handler) => handler.name)).toContain('fireAll');
    const [call, ...rest] = callsites(UNBOUNDED_LOOP_PLAIN_CALL);
    expect(rest).toHaveLength(0);
    expect(call.occurrence).toBe('loop');
    expect(call.maximumOccurrences).toBeUndefined();
    expect(call.minimumOccurrences).toBeUndefined();
    expect(summaryOf(UNBOUNDED_LOOP_PLAIN_CALL).bounded).toBe(false);
  }, TIMEOUT);

  it('bounds every external callsite a rolled loop body holds', () => {
    const calls = callsites(`pragma solidcash >=0.8.0;
interface IFoo { function bar(uint value); function baz(uint value); }
contract TwoCallsOneLoop() {
  int n;
  function fireAll(uint value, address t) public {
    require(n <= 2);
    for (int i = 0; i < n; i = i + 1) { IFoo(t).bar(value); IFoo(t).baz(value); }
    require(value >= 0);
  }
}`);
    expect(calls.map((call) => call.functionName)).toEqual(['bar', 'baz']);
    for (const call of calls) {
      expect(call.maximumOccurrences).toBe(2);
      expect(call.occurrenceBoundSource).toBe('guard');
    }
  }, TIMEOUT);

  it('attaches a proven ceiling to an array-element loop callsite', () => {
    const [call] = callsites(`pragma solidcash >=0.8.0;
interface IFoo { function bar(uint value); }
contract ArrayElementLoop() {
  address[] targets;
  function register(address t) public { this.targets.push(t); require(true); }
  function fireAll(uint value) public {
    require(targets.length <= 3);
    for (uint i = 0; i < targets.length; i = i + 1) { IFoo(targets[i]).bar(value); }
    require(value >= 0);
  }
}`);
    expect(call.loopArrayVar).toBe('targets');
    expect(call.maximumOccurrences).toBe(3);
    expect(call.occurrenceBoundSource).toBe('guard');
  }, TIMEOUT);

  /**
   * A rolled-loop ceiling is matched to its ABI row positionally, so it is published only when every
   * ceiling-less loop row has a proven ceiling. One unbounded loop beside a bounded one therefore publishes
   * NOTHING rather than risk attaching the proven bound to the wrong row.
   */
  it('publishes no rolled-loop ceiling when one loop in the function is unbounded', () => {
    const calls = callsites(`pragma solidcash >=0.8.0;
interface IFoo { function bar(uint value); }
contract MixedLoops() {
  int n; int m;
  function fireAll(uint value, address t) public {
    require(n <= 2);
    for (int i = 0; i < n; i = i + 1) { IFoo(t).bar(value); }
    for (int j = 0; j < m; j = j + 1) { IFoo(t).bar(value); }
    require(value >= 0);
  }
}`);
    expect(calls).toHaveLength(2);
    for (const call of calls) expect(call.maximumOccurrences).toBeUndefined();
  }, TIMEOUT);

  /**
   * The rolled-loop ceiling runs the SAME mutation analysis the pointer-table expansion demands, so a bound
   * the function can move afterwards proves nothing - the G1 escape class must not reappear on this path.
   */
  it('refuses a rolled-loop ceiling whose bound the function itself can move', () => {
    const [call] = callsites(`pragma solidcash >=0.8.0;
interface IFoo { function bar(uint value); }
contract MovableBound() {
  int n;
  function fireAll(uint value, address t) public {
    require(n <= 2);
    this.n = 9;
    for (int i = 0; i < n; i = i + 1) { IFoo(t).bar(value); }
    require(value >= 0);
  }
}`);
    expect(call.occurrence).toBe('loop');
    expect(call.maximumOccurrences).toBeUndefined();
    expect(call.occurrenceBoundSource).toBeUndefined();
  }, TIMEOUT);
});
