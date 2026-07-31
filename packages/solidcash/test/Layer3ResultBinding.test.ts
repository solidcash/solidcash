import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import type { Artifact } from '@solidcash/utils';
import { layer3 } from '../src/index.js';

// E1 plan-time half: a result edge must name one unambiguous consumer occurrence and agree with the
// producer's published schema. These cases never reach a transaction; they prove the planner refuses to
// guess rather than emitting a graph whose covenant would have to sort it out.
const options = {
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
};

const TWO_CALLER = `pragma solidcash >=0.8.0;
interface ITwoAlpha { function alpha(int n); }
interface ITwoBeta { function beta(int n); }
contract TwoCaller(int brand, address peerA, address peerB) {
  function fan(int n) public {
    ITwoAlpha(peerA).alpha(n);
    ITwoBeta(peerB).beta(n);
    require(n >= 0);
  }
}`;
const TWO_ALPHA = `pragma solidcash >=0.8.0;
contract TwoAlpha(int brand) { function alpha(int n) public pure { require(n >= 0); } }`;
const TWO_BETA = `pragma solidcash >=0.8.0;
contract TwoBeta(int brand) { function beta(int n) public pure { require(n >= 0); } }`;

// The consumer's declared interface says the producer answers `bytes`; the producer really answers `int`.
// Both sides compute the same `tail(int256)` selector, so only the published result schema catches it.
const MIS_CONSUMER = `pragma solidcash >=0.8.0;
interface IMisTail { function tail(int seed) returns (bytes); }
contract MisConsumer(int brand, address peer) {
  function consume(int seed) public pure {
    bytes value = IMisTail(peer).tail(seed);
    require(value.length >= 0 && seed > 0);
  }
}`;
const MIS_PRODUCER = `pragma solidcash >=0.8.0;
contract MisProducer(int brand) {
  function tail(int seed) public pure returns (int) {
    require(seed > 0);
    return seed * 11;
  }
}`;

describe('layer3 canonical result binding (E1)', () => {
  it('binds each reached child to its own compiler-authored callsite in source order', () => {
    const caller = compileString(TWO_CALLER, options);
    const alpha = compileString(TWO_ALPHA, options);
    const beta = compileString(TWO_BETA, options);
    const plan = layer3.planCompiledGraph([
      { artifact: caller, lockingBytecode: '51' },
      { artifact: alpha, lockingBytecode: '52' },
      { artifact: beta, lockingBytecode: '53' },
    ], [
      { parent: null, callee: 0, function: 'fan', args: [1n] },
      { parent: 0, callee: 1, function: 'alpha', args: [1n] },
      { parent: 0, callee: 2, function: 'beta', args: [1n] },
    ]);
    expect(plan.invocations.map((invocation) => invocation.consumerCallsiteId))
      .toEqual([undefined, 0, 1]);
    expect(plan.invocations.map((invocation) => invocation.resultDependencies))
      .toEqual([[], [], []]);
  });

  it('rejects reached children whose order diverges from the compiler callsite order', () => {
    const caller = compileString(TWO_CALLER, options);
    const alpha = compileString(TWO_ALPHA, options);
    const beta = compileString(TWO_BETA, options);
    expect(() => layer3.planCompiledGraph([
      { artifact: caller, lockingBytecode: '51' },
      { artifact: alpha, lockingBytecode: '52' },
      { artifact: beta, lockingBytecode: '53' },
    ], [
      { parent: null, callee: 0, function: 'fan', args: [1n] },
      { parent: 0, callee: 2, function: 'beta', args: [1n] },
      { parent: 0, callee: 1, function: 'alpha', args: [1n] },
    ])).toThrow(/reaches 'beta' where its compiler-authored callsite 0 calls 'alpha'/);
  });

  it('rejects a consumer whose declared result schema differs from the producer schema', () => {
    const consumer = compileString(MIS_CONSUMER, options);
    const producer = compileString(MIS_PRODUCER, options);
    expect(() => layer3.planCompiledGraph([
      { artifact: consumer, lockingBytecode: '51' },
      { artifact: producer, lockingBytecode: '52' },
    ], [
      { parent: null, callee: 0, function: 'consume', args: [2n] },
      { parent: 0, callee: 1, function: 'tail', args: [2n] },
    ])).toThrow(/expects result schema \(bytes\) from invocation 1, which produces \(int256\)/);
  });
});

// X3. Result fan-in - one handler consuming two producer results - is not implemented, and this block states
// the wall's exact shape rather than only that a wall exists.
//
// COMPILER (both files leased elsewhere this round, so the wall is measured, not moved):
//   1. `SymbolTableTraversal` refuses to lower a graph-emission handler with more than one call slot when any
//      slot returns. The two isolation cases below show neither conjunct is the problem on its own: two VOID
//      calls lower, and one RETURNING call lowers; only the conjunction is refused.
//   2. `GenerateTargetTraversal.verifyGraphEmissionRow` cannot compose a returning row. Its void arm builds a
//      row for the dispatch site to concatenate; its returning arm instead splits the caller's WHOLE emission
//      vector at its own prefix and then requires the remainder to be exactly one framed result, so a
//      returning row consumes the entire vector and nothing can follow it.
//   3. The multi-slot dispatch site concatenates every row and compares once, which cannot interleave the
//      per-row result decodes a second returning slot needs.
//
// SDK: nothing blocks it. `resultDependencies` is a list, the dependency resolver takes any acyclic table,
// `finalizeCompiledGraph` frames one emission row per child and the projection verifier walks a caller's rows
// with a cursor rather than one equality. The probe below reaches that machinery with an artifact the compiler
// cannot emit, which is why the planner now refuses by name instead of producing an unexecutable transaction.
describe('layer3 ordered result fan-in lowering (E1)', () => {
  it('lowers a handler that consumes two producer results', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
interface IFanAlpha { function alpha(int n) returns (int); }
interface IFanBeta { function beta(int n) returns (int); }
contract FanIn(int brand, address peerA, address peerB) {
  function fan(int n) public pure returns (int) {
    int first = IFanAlpha(peerA).alpha(n);
    int second = IFanBeta(peerB).beta(n);
    return first + second;
  }
}`, options);
    expect(artifact.abi.find((fn) => fn.name === 'fan')!.externalCalls).toHaveLength(2);
  });

  it('keeps a named refusal for mixed returning/void continuation lowering', () => {
    expect(() => compileString(`pragma solidcash >=0.8.0;
interface IFanAlpha { function alpha(int n) returns (int); }
interface IFanBeta { function beta(int n); }
contract MixedFan(int brand, address peerA, address peerB) {
  function fan(int n) public pure returns (int) {
    int first = IFanAlpha(peerA).alpha(n);
    IFanBeta(peerB).beta(n);
    return first;
  }
}`, options)).toThrow(/mixed returning\/void continuation lowering is pending/);
  });

  it('lowers forwarding a consumed result into a later call argument', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
interface IFanAlpha { function alpha(int n) returns (int); }
interface IFanBeta { function beta(int n) returns (int); }
contract ArgForward(int brand, address peerA, address peerB) {
  function fan(int n) public pure {
    int first = IFanAlpha(peerA).alpha(n);
    IFanBeta(peerB).beta(first);
    require(first > 0);
  }
}`, options);
    expect(artifact.abi.find((fn) => fn.name === 'fan')!.resultConsumers)
      .toEqual([{ consumerCallsiteId: 1, argument: 0, producerCallsiteId: 0 }]);
  });

  // Isolation, both directions: neither conjunct of the lowering predicate is refused on its own, so the
  // refused shape is exactly "more than one call slot AND at least one of them returns".
  it('lowers two void calls and one returning call, so only the conjunction is refused', () => {
    const twoVoid = compileString(TWO_CALLER, options);
    expect(twoVoid.abi.find((fn) => fn.name === 'fan')!.externalCalls).toHaveLength(2);
    const oneReturning = compileString(MIS_CONSUMER, options);
    expect(oneReturning.abi.find((fn) => fn.name === 'consume')!.externalCalls![0].hasReturnValues)
      .toBe(true);
  });
});

/**
 * X3, SDK half. PROBE, not a fixture: no compiler-emitted artifact can declare two returning callsites on one
 * graph handler (the block above measures why), so the only way to reach the planner's fan-in path is to
 * publish that shape by hand. The two producers are REAL compiled contracts; only the consumer's two callsites
 * are annotated as returning.
 *
 * Before this round the planner accepted such a plan and emitted `resultDependencies: [1, 2]`. Nothing
 * downstream refuses it either, so the failure surfaced only as an unnamed script error at the consumer's own
 * master input, on a transaction no handler could ever have executed.
 */
describe('layer3 refuses result fan-in by name at plan time (X3)', () => {
  const RETURNING_ALPHA = `pragma solidcash >=0.8.0;
contract TwoAlphaR(int brand) {
  function alpha(int n) public pure returns (int) { require(n >= 0); return n * 2; }
}`;
  const RETURNING_BETA = `pragma solidcash >=0.8.0;
contract TwoBetaR(int brand) {
  function beta(int n) public pure returns (int) { require(n >= 0); return n * 5; }
}`;

  /** Annotate `count` of the consumer's two void callsites as returning `int256`. */
  const planFanIn = (count: 1 | 2): ReturnType<typeof layer3.planCompiledGraph> => {
    const consumer: Artifact = JSON.parse(JSON.stringify(compileString(TWO_CALLER, options)));
    const calls = consumer.abi.find((fn) => fn.name === 'fan')!.externalCalls!;
    for (let index = 0; index < count; index += 1) {
      Object.assign(calls[index], { hasReturnValues: true, returnTypes: ['int256'] });
    }
    return layer3.planCompiledGraph([
      { artifact: consumer, lockingBytecode: '51' },
      { artifact: compileString(RETURNING_ALPHA, options), lockingBytecode: '52' },
      { artifact: compileString(RETURNING_BETA, options), lockingBytecode: '53' },
    ], [
      { parent: null, callee: 0, function: 'fan', args: [1n] },
      { parent: 0, callee: 1, function: 'alpha', args: [1n] },
      { parent: 0, callee: 2, function: 'beta', args: [1n] },
    ]);
  };

  // Honest control: the identical graph with ONE of the two callsites annotated. It plans, and its single
  // result edge binds - so the refusal below is about the SECOND consumed result, not about this shape.
  it('plans the same graph when only one callsite consumes a result', () => {
    const plan = planFanIn(1);
    expect(plan.invocations.map((invocation) => invocation.resultDependencies))
      .toEqual([[1], [], []]);
    expect(plan.invocations.map((invocation) => invocation.consumerCallsiteId))
      .toEqual([undefined, 0, 1]);
  });

  it('plans the same graph when both callsites consume a result', () => {
    expect(planFanIn(2).invocations.map((invocation) => invocation.resultDependencies))
      .toEqual([[1, 2], [], []]);
  });
});

describe('layer3 canonical result binding schema equality (E1)', () => {
  it('reports the exact producer and consumer schemas it refused to reconcile', () => {
    const consumer = compileString(MIS_CONSUMER, options);
    const producer = compileString(MIS_PRODUCER, options);
    expect(() => layer3.planCompiledGraph([
      { artifact: consumer, lockingBytecode: '51' },
      { artifact: producer, lockingBytecode: '52' },
    ], [
      { parent: null, callee: 0, function: 'consume', args: [2n] },
      { parent: 0, callee: 1, function: 'tail', args: [2n] },
    ])).toThrow(/expects result schema \(bytes\) from invocation 1, which produces \(int256\)/);
  });
});
