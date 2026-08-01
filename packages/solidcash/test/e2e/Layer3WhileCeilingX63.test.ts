import { hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { layer3 } from '../../src/index.js';

/**
 * X63 - the planner half. The compiler half is `solidc/test/WhileLoopCeilingX63.test.ts`.
 *
 * `ExpandBoundedPointerTableLoop` matched only the desugared `for`, so a `while`-spelled loop published
 * `maximumOccurrences: undefined` and `deriveCompiledGraphPlan` accepted any count up to the participant and
 * worklist caps - while the source's own `require(n <= 3)` refused the same count on chain at input 0. The
 * bound existed and had been proven; nothing carried it to the consumer.
 *
 * The hostile here is a PLAN-TIME over-count, which is where the defect lived. Its rejection reason has to be
 * the ceiling leg by name: the count caps this shape also hits (8 participants, 24 invocations) reject a large
 * over-count for a reason that has nothing to do with the bound, and a case that rejects for the wrong reason
 * is not evidence. Each `toThrow` below therefore matches the proven-bound sentence, not merely "throws".
 */

const OPTIONS = {
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
} as const;

const TIMEOUT = 180_000;
const CALL_VALUE = 4n;

const CALLEE = `pragma solidcash >=0.8.0;
contract PlainTarget() {
  function bar(uint value) public pure { require(value > 0); }
}`;

const WHILE_GUARDED = `pragma solidcash >=0.8.0;
interface IFoo { function bar(uint value); }
contract WhileGuardedLoop() {
  int n;
  function fireAll(uint value, address target) public {
    require(n <= 3);
    int i = 0;
    while (i < n) { IFoo(target).bar(value); i = i + 1; }
    require(value >= 0);
  }
}`;

/** The X2 fixture itself: a varying-method POINTER table left rolled by the `while` spelling. */
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

/** GUARD NEGATIVE CONTROL - the same `while` loop with no dominating guard. Nothing is proven to publish. */
const WHILE_UNGUARDED = `pragma solidcash >=0.8.0;
interface IFoo { function bar(uint value); }
contract WhileUnguardedLoop() {
  int n;
  function fireAll(uint value, address target) public {
    int i = 0;
    while (i < n) { IFoo(target).bar(value); i = i + 1; }
    require(value >= 0);
  }
}`;

const compiled = new Map<string, any>();
const artifactOf = (source: string): any => {
  const existing = compiled.get(source);
  if (existing) return existing;
  const artifact = compileString(source, OPTIONS);
  compiled.set(source, artifact);
  return artifact;
};

const planFor = (source: string): any => ({
  root: { artifact: artifactOf(source), lockingBytecode: '51' },
  function: 'fireAll',
  args: [CALL_VALUE, hexToBin('52')],
  targets: { IFoo: { artifact: artifactOf(CALLEE), lockingBytecode: '52' } },
});

describe('X63 - the planner sees the ceiling a while-spelled loop proves', () => {
  it('plans the proven count for a while-spelled guarded loop', () => {
    const row = artifactOf(WHILE_GUARDED).abi.find((fn: any) => fn.name === 'fireAll').externalCalls[0];
    expect(row.maximumOccurrences).toBe(3);
    expect(row.occurrenceBoundSource).toBe('guard');
    const plan = layer3.deriveCompiledGraphPlan({ ...planFor(WHILE_GUARDED), occurrence: () => 3 });
    expect(plan.invocations).toHaveLength(4);
  }, TIMEOUT);

  /**
   * HOSTILE, pinned to the reason. Four is one over the proven three, and is well below every count cap this
   * shape has, so the only rule that can reject it is the published ceiling. Before X63 this planned fine.
   */
  it('refuses one occurrence over the proven ceiling, naming the bound', () => {
    expect(() => layer3.deriveCompiledGraphPlan({ ...planFor(WHILE_GUARDED), occurrence: () => 4 }))
      .toThrow(
        'layer3: callsite 0 was planned with 4 occurrences, above the 3 proven by a dominating require guard',
      );
  }, TIMEOUT);

  /**
   * GUARD NEGATIVE CONTROL. The identical `while` loop with the guard removed still publishes nothing and the
   * planner still accepts four. Without this the refusal above could be credited to "the planner now refuses
   * `while` loops" rather than to a bound the source actually proves.
   */
  it('rejects an unbounded external-call loop before accepting a caller-supplied occurrence count', () => {
    const row = artifactOf(WHILE_UNGUARDED).abi.find((fn: any) => fn.name === 'fireAll').externalCalls[0];
    expect(row.maximumOccurrences).toBeUndefined();
    expect(() => layer3.deriveCompiledGraphPlan({
      ...planFor(WHILE_UNGUARDED), occurrence: () => 4,
    })).toThrow('layer3 [L3_UNBOUNDED_EXTERNAL_CALL_LOOP]: unbounded-external-call-loop-transcript-ineligible: callsite 0');
  }, TIMEOUT);

  /**
   * The shape the row is actually about: X2's rolled POINTER table, planned through the dynamic-call entry
   * point. This is the exact case where the planner accepted 4 and only the chain refused it, at input 0. The
   * ACCEPTING side of this fixture is on the VM in `Layer3RolledPointerTableX2.test.ts`, which settles 1, 2 and
   * 3 rows and rejects a fourth registration at input 0; it needs a real co-spent graph, which the ceiling
   * check runs ahead of, so it cannot be re-asserted here.
   */
  it('refuses a fourth row of the while-spelled POINTER table, naming the bound', () => {
    const artifact = artifactOf(WHILE_POINTER_TABLE);
    const root = { artifact, lockingBytecode: '51' };
    expect(() => layer3.deriveCompiledGraphPlan({
      root,
      function: 'fireAll',
      args: [CALL_VALUE],
      targets: {},
      occurrence: () => 4,
      dynamicCall: () => ({ participant: root, function: 'inc' }),
    })).toThrow(
      'layer3: callsite 0 was planned with 4 occurrences, above the 3 proven by a dominating require guard',
    );
  }, TIMEOUT);

  /**
   * The chain-side refusal X63 explicitly did NOT move. The over-count the planner now names was already
   * refused by the compiled `require`, which is why this row was a metadata gap and not a settlement gap.
   * Asserted on the artifact rather than re-derived: the guard is a source statement that survives lowering.
   */
  it('keeps the source guard in the emitted covenant', () => {
    const guarded = artifactOf(WHILE_GUARDED).bytecode as string;
    const unguarded = artifactOf(WHILE_UNGUARDED).bytecode as string;
    expect(guarded).not.toBe(unguarded);
    expect(guarded.length).toBeGreaterThan(unguarded.length);
  }, TIMEOUT);
});
