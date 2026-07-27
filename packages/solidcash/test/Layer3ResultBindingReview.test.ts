import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import type { Artifact } from '@solidcash/utils';
import { layer3 } from '../src/index.js';

// Independent hostile review of E1 (worker C reviewing worker B).
//
// `isRuntimeResolvedCallsite()` returns true when `possibleTargets` is non-empty, which skips BOTH the
// positional callsite-name check and the producer/consumer result-schema equality check. These cases pin
// how far that widening actually reaches.
const options = {
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
};

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

// A varying-selector pointer table: the only source shape the compiler ever attaches `possibleTargets` to
// (`Artifact.ts` spreads it strictly inside `...(ec.selectorArrayVar && ...)`). Two registrars are needed,
// because a single reachable method needs no per-element selector array.
const SELECTOR_TABLE = `pragma solidcash >=0.8.0;
interface IH { function inc(uint value); function dec(uint value); }
contract BoundedTable() {
  function(uint) external[] handlers;
  function registerInc(address target) public { this.handlers.push(IH(target).inc); require(true); }
  function registerDec(address target) public { this.handlers.push(IH(target).dec); require(true); }
  function fireAll(uint value) public {
    require(handlers.length <= 3);
    for (int i = 0; i < handlers.length; i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }
}`;

/** Deep-clone an artifact so a review case can inject an ABI field the compiler would never emit. */
const clone = (artifact: Artifact): any => JSON.parse(JSON.stringify(artifact));

describe('E1 review: the possibleTargets widening in isRuntimeResolvedCallsite (worker C)', () => {
  it('the compiler emits possibleTargets ONLY alongside selectorArrayVar, so the disjunct is redundant', () => {
    // The one source shape that reaches the emitting branch, compiled both with and without the message-bus
    // controller options. A varying-selector pointer table IS admissible as a graph participant - the bus
    // artifact does have a `hiddenBatch` route - so the widening is not unreachable for that reason.
    // It is redundant for a different reason: `selectorArrayVar` is set on the same callsite, and that
    // disjunct precedes `possibleTargets` in `isRuntimeResolvedCallsite`, so removing the
    // `possibleTargets` clause changes nothing for any artifact this compiler produces.
    for (const [artifact, expectedLoopArray] of [
      [compileString(SELECTOR_TABLE, options), undefined],
      [compileString(SELECTOR_TABLE, { forceStateful: true }), 'handlers'],
    ] as const) {
      const call = artifact.abi.find((entry) => entry.name === 'fireAll')!.externalCalls![0];
      expect(call.possibleTargets?.map((target) => target.functionName)).toEqual(['dec', 'inc']);
      expect(call.selectorArrayVar).toBe('__fnsel_handlers');
      expect(call.loopArrayVar).toBe(expectedLoopArray);
    }

    // Same invariant over every other fixture in this file: no callsite carries `possibleTargets` at all.
    for (const source of [MIS_CONSUMER, MIS_PRODUCER, TWO_CALLER, TWO_ALPHA, TWO_BETA]) {
      const artifact = compileString(source, options);
      expect(artifact.hiddenBatch).toBeDefined();
      for (const entry of artifact.abi) {
        for (const call of entry.externalCalls ?? []) {
          expect(call.possibleTargets).toBeUndefined();
        }
      }
    }
  }, 240_000);

  it('an artifact that DOES carry possibleTargets alone silences the result-schema check', () => {
    // Same graph as the committed `rejects a consumer whose declared result schema differs` case, with one
    // ABI field injected. The planner stops refusing, which shows the widening is real for any artifact
    // this compiler did not produce - a hand-written or third-party artifact, or a future compiler that
    // publishes `possibleTargets` for a pinned-target callsite.
    const consumer = clone(compileString(MIS_CONSUMER, options));
    const producer = compileString(MIS_PRODUCER, options);
    const callsite = consumer.abi.find((entry: any) => entry.name === 'consume').externalCalls[0];
    expect(callsite.selectorArrayVar).toBeUndefined();
    callsite.possibleTargets = [{ functionName: 'tail', selector: '00000000' }];
    const plan = layer3.planCompiledGraph([
      { artifact: consumer, lockingBytecode: '51' },
      { artifact: producer, lockingBytecode: '52' },
    ], [
      { parent: null, callee: 0, function: 'consume', args: [2n] },
      { parent: 0, callee: 1, function: 'tail', args: [2n] },
    ]);
    // The consumer declares `bytes`, the producer answers `int256`, and the plan is built anyway.
    expect(plan.invocations[0].resultDependencies).toEqual([1]);
    expect(plan.invocations[1].resultTypes).toEqual(['int256']);
  });

  it('an artifact that DOES carry possibleTargets alone silences the callsite-order check', () => {
    const caller = clone(compileString(TWO_CALLER, options));
    const alpha = compileString(TWO_ALPHA, options);
    const beta = compileString(TWO_BETA, options);
    const calls = caller.abi.find((entry: any) => entry.name === 'fan').externalCalls;
    calls[0].possibleTargets = [{ functionName: 'alpha', selector: '00000000' }];
    calls[1].possibleTargets = [{ functionName: 'beta', selector: '00000000' }];
    // Reached in the reverse of the compiler-authored source order.
    const plan = layer3.planCompiledGraph([
      { artifact: caller, lockingBytecode: '51' },
      { artifact: alpha, lockingBytecode: '52' },
      { artifact: beta, lockingBytecode: '53' },
    ], [
      { parent: null, callee: 0, function: 'fan', args: [1n] },
      { parent: 0, callee: 2, function: 'beta', args: [1n] },
      { parent: 0, callee: 1, function: 'alpha', args: [1n] },
    ]);
    // `beta` is bound to callsite 0 and `alpha` to callsite 1: the exact inversion the committed case
    // rejects with "reaches 'beta' where its compiler-authored callsite 0 calls 'alpha'".
    expect(plan.invocations.map((invocation) => invocation.consumerCallsiteId))
      .toEqual([undefined, 0, 1]);
  });
});
