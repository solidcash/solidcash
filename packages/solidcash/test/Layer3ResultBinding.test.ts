import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
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

// Result fan-in - one handler consuming two producer results - is not implemented. Every shape that needs
// it stops at one compiler diagnostic, so the boundary is a single stable rejection rather than a partial
// lowering. Recorded here so a later relaxation has an exact before/after.
describe('layer3 result fan-in is scoped out with one stable diagnostic (E1)', () => {
  const AT_MOST_ONE = /requires call\/staticcall edges and at most one returning call/;

  it('rejects a handler that consumes two producer results', () => {
    expect(() => compileString(`pragma solidcash >=0.8.0;
interface IFanAlpha { function alpha(int n) returns (int); }
interface IFanBeta { function beta(int n) returns (int); }
contract FanIn(int brand, address peerA, address peerB) {
  function fan(int n) public pure returns (int) {
    int first = IFanAlpha(peerA).alpha(n);
    int second = IFanBeta(peerB).beta(n);
    return first + second;
  }
}`, options)).toThrow(AT_MOST_ONE);
  });

  it('rejects a handler that mixes one returning call with one void call', () => {
    expect(() => compileString(`pragma solidcash >=0.8.0;
interface IFanAlpha { function alpha(int n) returns (int); }
interface IFanBeta { function beta(int n); }
contract MixedFan(int brand, address peerA, address peerB) {
  function fan(int n) public pure returns (int) {
    int first = IFanAlpha(peerA).alpha(n);
    IFanBeta(peerB).beta(n);
    return first;
  }
}`, options)).toThrow(AT_MOST_ONE);
  });

  it('rejects forwarding a consumed result into a later call argument', () => {
    expect(() => compileString(`pragma solidcash >=0.8.0;
interface IFanAlpha { function alpha(int n) returns (int); }
interface IFanBeta { function beta(int n); }
contract ArgForward(int brand, address peerA, address peerB) {
  function fan(int n) public pure {
    int first = IFanAlpha(peerA).alpha(n);
    IFanBeta(peerB).beta(first);
    require(first > 0);
  }
}`, options)).toThrow(AT_MOST_ONE);
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
