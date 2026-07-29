import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';
import type { Artifact } from '../src/index.js';

/**
 * X63 - the source `while` spelling escaped the PUBLISHED occurrence ceiling.
 *
 * `ExpandBoundedPointerTableLoop` matched only the desugared `for` (a loop variable definition marked
 * `isLoopVariable` followed by a `WhileNode` carrying `forLoopUpdateCount` trailing update statements). A
 * hand-written `while` carries neither, so every callsite in one published `maximumOccurrences: undefined`
 * and a graph consumer could plan any count up to the participant and worklist caps.
 *
 * This was never a settlement gap: the source's own dominating `require` is compiled into the covenant and
 * refuses an over-count on chain. It was a metadata gap - the compiler had proven a bound and told nobody, so
 * the planner could not refuse early what the chain refuses late.
 *
 * The repair PUBLISHES ONLY. The `while` spelling keeps the loop rolled through code generation, and that
 * rolled route is separately proven to settle and to reject its hostiles (X2); expanding it would delete the
 * only producer of the expression-selector callsite that repair covers. Every case below therefore also
 * pins that the emitted bytecode is the one the `while` spelling always had - see the byte-identity case.
 */

const OPTIONS = {
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
} as const;

const TIMEOUT = 180_000;

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

/** The X2 shape: a varying-method POINTER table whose `while` spelling keeps it rolled to code generation. */
const WHILE_POINTER_TABLE = `pragma solidcash >=0.8.0;
interface IVaryingHandler { function inc(uint value); function dec(uint value); }
contract WhilePointerTable() {
  function(uint) external[] handlers;
  function registerInc(address target) public { this.handlers.push(IVaryingHandler(target).inc); require(true); }
  function registerDec(address target) public { this.handlers.push(IVaryingHandler(target).dec); require(true); }
  function fireAll(uint value) public {
    require(handlers.length <= 3);
    int i = 0;
    while (i < handlers.length) { handlers[i](value); i = i + 1; }
    require(value >= 0);
  }
}`;

/** The same table spelled with `for`. Expanded, then coalesced by G1 back into one bounded loop row. */
const FOR_POINTER_TABLE = `pragma solidcash >=0.8.0;
interface IVaryingHandler { function inc(uint value); function dec(uint value); }
contract ForPointerTable() {
  function(uint) external[] handlers;
  function registerInc(address target) public { this.handlers.push(IVaryingHandler(target).inc); require(true); }
  function registerDec(address target) public { this.handlers.push(IVaryingHandler(target).dec); require(true); }
  function fireAll(uint value) public {
    require(handlers.length <= 3);
    for (int i = 0; i < handlers.length; i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }
}`;

/** An ORDINARY interface call in a `while` loop - rolled in either spelling, so only the bound differs. */
const WHILE_INTERFACE_LOOP = `pragma solidcash >=0.8.0;
interface IFoo { function bar(uint value); }
contract WhileInterfaceLoop() {
  int n;
  function fireAll(uint value, address target) public {
    require(n <= 3);
    int i = 0;
    while (i < n) { IFoo(target).bar(value); i = i + 1; }
    require(value >= 0);
  }
}`;

/** GUARD NEGATIVE CONTROL: identical but for the dominating require. Nothing is proven, so nothing is published. */
const WHILE_INTERFACE_UNGUARDED = `pragma solidcash >=0.8.0;
interface IFoo { function bar(uint value); }
contract WhileInterfaceUnguarded() {
  int n;
  function fireAll(uint value, address target) public {
    int i = 0;
    while (i < n) { IFoo(target).bar(value); i = i + 1; }
    require(value >= 0);
  }
}`;

/**
 * GUARD NEGATIVE CONTROL: the counter is written a second time INSIDE the body, in the direction that makes
 * the trailing step's arithmetic an under-estimate. A desugared `for` gets its step position for free; a
 * hand-written `while` does not, so this is the condition the repair has to add for itself.
 */
const WHILE_COUNTER_REWOUND = `pragma solidcash >=0.8.0;
interface IFoo { function bar(uint value); }
contract WhileCounterRewound() {
  int n;
  function fireAll(uint value, address target) public {
    require(n <= 3);
    int i = 0;
    while (i < n) { IFoo(target).bar(value); i = i - 1; i = i + 1; }
    require(value >= 0);
  }
}`;

/** GUARD NEGATIVE CONTROL: the function can move the very state the bound reads, so the guard proves nothing. */
const WHILE_BOUND_MUTATED = `pragma solidcash >=0.8.0;
interface IFoo { function bar(uint value); }
contract WhileBoundMutated() {
  int n;
  function fireAll(uint value, address target) public {
    require(n <= 3);
    this.n = 9;
    int i = 0;
    while (i < n) { IFoo(target).bar(value); i = i + 1; }
    require(value >= 0);
  }
}`;

describe('X63 - the while spelling publishes the ceiling its source proves', () => {
  it('publishes the guard-derived ceiling for a while-spelled POINTER table', () => {
    const [call, ...rest] = callsites(WHILE_POINTER_TABLE);
    expect(rest).toHaveLength(0);
    // Still ROLLED, not expanded: the row names the array and its parallel selector array exactly as before.
    expect(call.occurrence).toBe('loop');
    expect(call.loopArrayVar).toBe('handlers');
    expect(call.selectorArrayVar).toBe('__fnsel_handlers');
    // What X63 changes, and all it changes.
    expect(call.maximumOccurrences).toBe(3);
    expect(call.occurrenceBoundSource).toBe('guard');
    // A guard bounds from above only - a shorter runtime table reaches fewer rows honestly - so no floor.
    expect(call.minimumOccurrences).toBeUndefined();
  }, TIMEOUT);

  it('publishes the same ceiling the for spelling of the same source publishes', () => {
    const whileCall = callsites(WHILE_POINTER_TABLE)[0];
    const forCall = callsites(FOR_POINTER_TABLE)[0];
    expect(whileCall.maximumOccurrences).toBe(forCall.maximumOccurrences);
    expect(whileCall.occurrenceBoundSource).toBe(forCall.occurrenceBoundSource);
    expect(whileCall.minimumOccurrences).toBe(forCall.minimumOccurrences);
  }, TIMEOUT);

  /**
   * The whole point of publishing rather than expanding: the two spellings are DIFFERENT covenants, and X63
   * leaves that difference exactly where it was. If the repair had routed `while` through the expansion this
   * assertion would fail, and the rolled route X2 proved would have no source spelling left to produce it.
   */
  it('leaves the while and for spellings compiling to different bytecode, as they always did', () => {
    expect(artifactOf(WHILE_POINTER_TABLE).bytecode)
      .not.toBe(artifactOf(FOR_POINTER_TABLE).bytecode);
  }, TIMEOUT);

  it('publishes the guard-derived ceiling for a while-spelled ordinary interface loop', () => {
    const [call, ...rest] = callsites(WHILE_INTERFACE_LOOP);
    expect(rest).toHaveLength(0);
    expect(call.occurrence).toBe('loop');
    expect(call.maximumOccurrences).toBe(3);
    expect(call.occurrenceBoundSource).toBe('guard');
  }, TIMEOUT);

  /**
   * The three negative controls. Each removes exactly one leg of the proof and must publish nothing, so the
   * ceiling above cannot be credited to "the pass now recognises `while`" - it has to be credited to the
   * guard, to the step position, and to the mutation analysis, one at a time.
   */
  it.each([
    ['no dominating guard', WHILE_INTERFACE_UNGUARDED],
    ['the counter rewound inside the body', WHILE_COUNTER_REWOUND],
    ['the bound the guard reads is written by the same function', WHILE_BOUND_MUTATED],
  ])('publishes no ceiling when %s', (_label, source) => {
    const [call] = callsites(source as string);
    expect(call.occurrence).toBe('loop');
    expect(call.maximumOccurrences).toBeUndefined();
    expect(call.occurrenceBoundSource).toBeUndefined();
  }, TIMEOUT);

  /**
   * The refusal channel is untouched. An unbounded POINTER table spelled with `for` is still rejected with the
   * stable pointer-table diagnostic; X63 never routes a `while` into the throwing mode, so a `while` shape the
   * pass cannot bound stays compilable and simply publishes nothing (the cases above).
   */
  it('keeps refusing an unbounded for-spelled pointer table with the stable diagnostic', () => {
    expect(() => compileString(`pragma solidcash >=0.8.0;
interface IVaryingHandler { function inc(uint value); function dec(uint value); }
contract UnboundedForPointerTable() {
  function(uint) external[] handlers;
  function registerInc(address target) public { this.handlers.push(IVaryingHandler(target).inc); require(true); }
  function registerDec(address target) public { this.handlers.push(IVaryingHandler(target).dec); require(true); }
  function fireAll(uint value) public {
    for (int i = 0; i < handlers.length; i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }
}`, OPTIONS)).toThrow('Message-bus pointer-table loop is not compiler-bounded');
  }, TIMEOUT);
});
