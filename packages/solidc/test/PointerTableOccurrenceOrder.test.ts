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
  experimentalHiddenBatch: true,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
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

  it('publishes a fixed literal trip count as an explicit loop ceiling', () => {
    const [call] = callsites(FIXED_LOOP_PLAIN_CALL);
    expect(call.occurrence).toBe('loop');
    expect(call.maximumOccurrences).toBe(3);
  }, TIMEOUT);

  /**
   * Recorded GAPS, reported to the integration owner rather than changed here. In each of these the loop IS
   * expanded or refused correctly and the caller covenant still emits exactly the rows the source executes -
   * so an inflated count is rejected on-chain - but NO explicit per-callsite ceiling reaches the artifact:
   *
   *  - a single-selector pointer table is expanded but not coalesced, because coalescing keys on
   *    `selectorArrayVar`/`fnPtrCall`, which a table with one possible method never sets;
   *  - a multi-group function is not coalesced either, since coalescing admits exactly one group;
   *  - a loop holding an ordinary interface call is never seen by `ExpandBoundedPointerTableLoop` at all
   *    (it counts only POINTER dispatches), so it is neither expanded nor refused, even with no source bound.
   *
   * `deriveCompiledGraphPlan` validates a loop occurrence as
   * `maximumOccurrences === undefined || count <= maximumOccurrences`, so the third case accepts any count up
   * to the global 24-invocation ceiling. The first two publish `conditional` callsites, whose count the planner
   * caps at one each, so their bound is structural rather than published.
   */
  it.each([
    ['a single-selector pointer table', FIXED_SELECTOR_SINGLE_LOOP, 'conditional', 3],
    ['a multi-group function', TWO_GROUPS, 'conditional', 4],
  ])('GAP: publishes no explicit loop ceiling for %s', (_label, source, occurrence, count) => {
    const calls = callsites(source);
    expect(calls).toHaveLength(count as number);
    for (const call of calls) {
      expect(call.occurrence).toBe(occurrence);
      expect(call.maximumOccurrences).toBeUndefined();
    }
    const summary = summaryOf(source as string);
    expect(summary.bounded).toBe(false);
    expect(summary.maximumDirectInvocations).toBeUndefined();
  }, TIMEOUT);

  it.each([
    ['a require-bounded runtime trip count', RUNTIME_LOOP_PLAIN_CALL],
    ['an entirely unbounded runtime trip count', UNBOUNDED_LOOP_PLAIN_CALL],
  ])('GAP: publishes an unbounded loop occurrence for a plain interface call under %s', (_label, source) => {
    const artifact = artifactOf(source);
    // The function reaches the graph surface: it is an admitted hidden-batch handler.
    expect(artifact.hiddenBatch!.handlers.map((handler) => handler.name)).toContain('fireAll');
    const [call, ...rest] = callsites(source);
    expect(rest).toHaveLength(0);
    expect(call.occurrence).toBe('loop');
    expect(call.maximumOccurrences).toBeUndefined();
    expect(summaryOf(source).bounded).toBe(false);
  }, TIMEOUT);
});
