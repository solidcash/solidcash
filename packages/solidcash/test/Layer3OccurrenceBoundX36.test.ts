import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import type { Artifact } from '@solidcash/utils';
import { layer3 } from '../src/index.js';

/**
 * X36: `planCompiledGraph` enforces the same reached-row bound `deriveCompiledGraphPlan` does.
 *
 * `deriveCompiledGraphPlan` receives a per-callsite count from the derivation probe and checks it against the
 * published bound. `planCompiledGraph` receives ROWS, so the bound has to be recovered from them - and the
 * recovery must not lean on `bindConsumerCallsites`, whose name-based attribution is an acknowledged guess
 * (measured below: two callsites of one name collapse onto the first). The handler's TOTAL published capacity
 * is guess-free, and refusing above it is the same refusal by the same words.
 *
 * The load-bearing many-to-one shapes are pinned first, because they are what a blanket arity rule breaks: a
 * loop callsite legitimately answers many rows, an unbounded loop fails closed under v1, and a collapsed
 * repeated-call callsite answers exactly the rows it names.
 */
const OPTIONS = {
  forceStateful: true,
  hiddenBatch: true,
  messageBusController: `aa20${'11'.repeat(32)}87`,
  messageBusControllerCategory: '22'.repeat(32),
};

const CALLER = `pragma solidcash >=0.8.0;
interface IX36 { function bar(uint value); }
contract X36Caller() {
  int n;
  function once(address next, uint value) public {
    IX36(next).bar(value);
    require(value >= 0);
  }
  function conditional(address next, uint value, bool take) public {
    if (take) { IX36(next).bar(value); }
    require(value >= 0);
  }
  function guarded(address next, uint value) public {
    require(n <= 3);
    for (int i = 0; i < n; i = i + 1) { IX36(next).bar(value); }
    require(value >= 0);
  }
  function unbounded(address next, uint value) public {
    for (int i = 0; i < n; i = i + 1) { IX36(next).bar(value); }
    require(value >= 0);
  }
  function twoOnce(address first, address second, uint value) public {
    IX36(first).bar(value);
    IX36(second).bar(value);
    require(value >= 0);
  }
}`;

const CALLEE = `pragma solidcash >=0.8.0;
contract X36Callee() {
  uint total;
  function bar(uint value) public { this.total = this.total + value; require(value >= 0); }
}`;

/**
 * X31's pair. The two differ by exactly one field: the caller either moves 900 satoshis itself, or attaches
 * them to the outgoing call as an option. Both publish the same direct-mode `transferCount` and the same
 * direct block slots, which is why the direct layout cannot be the discriminator.
 */
const FIRST_PARTY_TRANSFER = `pragma solidcash >=0.8.0;
interface IX36 { function bar(uint value); }
contract X31FirstParty() {
  function run(address next, uint value, bytes recipient) public {
    this.transfer(recipient, 900);
    IX36(next).bar(value);
    require(value >= 0);
  }
}`;

const VALUE_OPTION = `pragma solidcash >=0.8.0;
interface IX36 { function bar(uint value); }
contract X31Option() {
  function run(address next, uint value, bytes recipient) public {
    IX36(next).bar{value: 900}(value);
    require(value >= 0 && recipient.length >= 0);
  }
}`;

/** Two calls to one interface method collapse into ONE callsite that names both rows. */
const REPEATED_CALLER = `pragma solidcash >=0.8.0;
interface IX36 { function bar(uint value); }
contract X36RepeatedCaller() {
  function twice(address next, uint first, uint second) public {
    IX36(next).bar(first);
    IX36(next).bar(second);
    require(first >= 0 && second >= 0);
  }
}`;

const caller = compileString(CALLER, OPTIONS);
const callee = compileString(CALLEE, OPTIONS);
const repeated = compileString(REPEATED_CALLER, { ...OPTIONS, repeatedExternalBatch: true });

const clone = (artifact: Artifact): any => JSON.parse(JSON.stringify(artifact));
const callsitesOf = (artifact: Artifact, name: string): any[] =>
  artifact.abi.find((entry) => entry.name === name)!.externalCalls as any[];

/** One root on `root`, then `rows` children answering `bar` on the callee. */
const plan = (rootArtifact: Artifact, name: string, rows: number, rootArgs: unknown[]): unknown =>
  layer3.planCompiledGraph([
    { artifact: rootArtifact, lockingBytecode: '51' },
    { artifact: callee, lockingBytecode: '52' },
  ], [
    { parent: null, callee: 0, function: name, args: rootArgs as any },
    ...Array.from({ length: rows }, () => ({
      parent: 0, callee: 1, function: 'bar', args: [4n], callMode: 'call' as const,
    })),
  ]);

const target = new Uint8Array([0x52]);

describe('X36: planCompiledGraph enforces the published reached-row bound', () => {
  it('publishes the bounds the whole file is measured against', () => {
    expect(callsitesOf(caller, 'once')[0]).toMatchObject({ occurrence: 'once', maximumOccurrences: 1 });
    expect(callsitesOf(caller, 'conditional')[0])
      .toMatchObject({ occurrence: 'conditional', maximumOccurrences: 1 });
    expect(callsitesOf(caller, 'guarded')[0])
      .toMatchObject({ occurrence: 'loop', maximumOccurrences: 3, occurrenceBoundSource: 'guard' });
    // A guard bounds from above only, so an under-count stays honest and must not be refused.
    expect(callsitesOf(caller, 'guarded')[0].minimumOccurrences).toBeUndefined();
    expect(callsitesOf(caller, 'unbounded')[0].occurrence).toBe('loop');
    expect(callsitesOf(caller, 'unbounded')[0].maximumOccurrences).toBeUndefined();
    expect(callsitesOf(caller, 'twoOnce').map((call) => call.occurrence)).toEqual(['once', 'once']);
    const collapsed = callsitesOf(repeated, 'twice');
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].occurrence ?? 'once').toBe('once');
    expect(collapsed[0].batchInvocations).toHaveLength(2);
  }, 240_000);

  // LOAD-BEARING, first: every shape whose rows legitimately outnumber its callsites still plans.
  it.each([1, 2, 3])('plans %i rows against a guard-bounded loop callsite', (rows) => {
    expect(() => plan(caller, 'guarded', rows, [target, 4n])).not.toThrow();
  });

  it('refuses rows against a loop whose source publishes no finite v1 bound', () => {
    expect(() => plan(caller, 'unbounded', 5, [target, 4n])).toThrow(expect.objectContaining({
      code: 'L3_UNBOUNDED_EXTERNAL_CALL_LOOP',
      message: expect.stringContaining('unbounded-external-call-loop-transcript-ineligible: callsite 0'),
    }));
  });

  it('applies the same structured refusal in native worklist derivation', () => {
    expect(() => layer3.deriveCompiledGraphPlan({
      root: { artifact: caller, lockingBytecode: '51' },
      function: 'unbounded', args: [target, 4n],
      targets: { IX36: { artifact: callee, lockingBytecode: '52' } },
      occurrence: () => 1,
    })).toThrow(expect.objectContaining({ code: 'L3_UNBOUNDED_EXTERNAL_CALL_LOOP' }));
  });

  it('keeps a compiler-bounded loop derivable at its published ceiling', () => {
    const derived = layer3.deriveCompiledGraphPlan({
      root: { artifact: caller, lockingBytecode: '51' },
      function: 'guarded', args: [target, 4n],
      targets: { IX36: { artifact: callee, lockingBytecode: '52' } },
      occurrence: () => 3,
    });
    expect(derived.invocations).toHaveLength(4);
  });

  it('plans both rows of a collapsed repeated-call callsite', () => {
    // The callsite is `once`; its capacity is the two rows it NAMES, not one.
    expect(() => plan(repeated, 'twice', 2, [target, 4n, 5n])).not.toThrow();
    // A third row is still refused, by the count the callsite NAMES rather than by the occurrence wording.
    expect(() => plan(repeated, 'twice', 3, [target, 4n, 5n]))
      .toThrow('layer3: callsite 0 collapses 2 repeated calls, but 3 rows were planned');
  });

  it('plans one row per `once` callsite of a handler that has two', () => {
    expect(() => plan(caller, 'twoOnce', 2, [target, target, 4n])).not.toThrow();
  });

  // THE GAP. Three children used to bind one `once` callsite with no plan-time error at all.
  it.each([2, 3])('refuses %i rows against a single `once` callsite', (rows) => {
    expect(() => plan(caller, 'once', rows, [target, 4n])).toThrow(
      `layer3: callsite 0 is a once callsite reached at most once, but ${rows} occurrences were planned`,
    );
  });

  it('refuses two rows against a conditional callsite', () => {
    expect(() => plan(caller, 'conditional', 2, [target, 4n, true])).toThrow(
      'layer3: callsite 0 is a conditional callsite reached at most once, but 2 occurrences were planned',
    );
    // The conditional's own admitted counts are unaffected: zero and one both plan.
    expect(() => plan(caller, 'conditional', 1, [target, 4n, true])).not.toThrow();
  });

  it('refuses a row count above a guard-proven loop ceiling, naming the provenance', () => {
    expect(() => plan(caller, 'guarded', 4, [target, 4n])).toThrow(
      'layer3: callsite 0 was planned with 4 occurrences, above the 3 proven by a dominating require guard',
    );
  });

  it('refuses three rows against a handler whose two `once` callsites total two', () => {
    expect(() => plan(caller, 'twoOnce', 3, [target, target, 4n])).toThrow(
      'layer3: callsite 1 is a once callsite reached at most once, but 2 occurrences were planned',
    );
  });

  /**
   * ENTRY-POINT AGREEMENT. The same artifact, the same over-count, the same words - which is the whole point
   * of routing both through `occurrenceCountViolation` rather than each spelling the bound out again.
   */
  it('refuses the same over-count with the same words through either entry point', () => {
    const message = (build: () => unknown): string => {
      try {
        build();
      } catch (error) {
        return (error as Error).message;
      }
      return 'ACCEPTED';
    };
    const derived = message(() => layer3.deriveCompiledGraphPlan({
      root: { artifact: caller, lockingBytecode: '51' },
      function: 'guarded',
      args: [target, 4n],
      targets: { IX36: Array.from({ length: 4 }, () => ({ artifact: callee, lockingBytecode: '52' })) },
      occurrence: () => 4,
    }));
    expect(derived).toBe(
      'layer3: callsite 0 was planned with 4 occurrences, above the 3 proven by a dominating require guard',
    );
    expect(message(() => plan(caller, 'guarded', 4, [target, 4n]))).toBe(derived);
  }, 240_000);

  /**
   * The bound is computed from the handler's published capacity rather than from `bindConsumerCallsites`,
   * because that attribution is wrong here and refusing on it would be a false rejection: `conditional` and
   * `once` are two separate callsites, yet a two-row plan on a handler carrying both binds both rows to the
   * FIRST. Recorded as a measurement, not asserted as desirable.
   */
  it('MEASURED: name-based binding collapses two same-named callsites onto the first', () => {
    const mixed = compileString(`pragma solidcash >=0.8.0;
interface IX36 { function bar(uint value); }
contract X36Mixed() {
  function both(address next, uint value, bool take) public {
    IX36(next).bar(value);
    if (take) { IX36(next).bar(value); }
    require(value >= 0);
  }
}`, OPTIONS);
    const calls = callsitesOf(mixed, 'both');
    expect(calls.map((call) => call.occurrence)).toEqual(['once', 'conditional']);
    const built = plan(mixed, 'both', 2, [target, 4n, true]) as any;
    // Both rows report callsite 0; the conditional callsite answers neither. The plan is still admitted,
    // because the handler's two callsites publish a capacity of two and two rows were planned.
    expect(built.invocations.map((invocation: any) => invocation.consumerCallsiteId))
      .toEqual([undefined, calls[0].callsiteId, calls[0].callsiteId]);
  }, 240_000);
});

describe('X36 audit: checks that used to run on only one entry point', () => {
  /**
   * `deriveCompiledGraphPlan` reads the compiler-authored mode through `edgeCallMode`, which refuses a delegate
   * edge outright. `planCompiledGraph` read it only when the caller supplied NO mode, so labelling a delegate
   * callsite `call` executed it as an ordinary call, unseen by either check.
   */
  it('refuses a delegatecall callsite the caller labels an ordinary call', () => {
    const delegating = clone(caller);
    delegating.abi.find((entry: any) => entry.name === 'once').externalCalls[0].callMode = 'delegatecall';
    expect(() => layer3.planCompiledGraph([
      { artifact: delegating, lockingBytecode: '51' },
      { artifact: callee, lockingBytecode: '52' },
    ], [
      { parent: null, callee: 0, function: 'once', args: [target, 4n] },
      { parent: 0, callee: 1, function: 'bar', args: [4n], callMode: 'call' },
    ])).toThrow('layer3: delegatecall is not a participant-graph call mode');
    // Control: the same graph and the same explicit mode, with the published mode left alone.
    expect(() => plan(caller, 'once', 1, [target, 4n])).not.toThrow();
  });

  /**
   * The call-option refusal reads the DIRECT-mode ABI entry, so an artifact whose SCB1 handler exists while
   * its ABI entry does not had nothing left to compare against and the check was skipped entirely.
   * `deriveCompiledGraphPlan` refuses that artifact through `functionAbi`.
   */
  it('refuses a participant row whose handler exists but whose ABI entry does not', () => {
    const hidden = clone(callee);
    hidden.abi = hidden.abi.filter((entry: any) => entry.name !== 'bar');
    expect(hidden.hiddenBatch.handlers.some((handler: any) => handler.name === 'bar')).toBe(true);
    expect(() => layer3.planCompiledGraph([
      { artifact: caller, lockingBytecode: '51' },
      { artifact: hidden, lockingBytecode: '52' },
    ], [
      { parent: null, callee: 0, function: 'once', args: [target, 4n] },
      { parent: 0, callee: 1, function: 'bar', args: [4n], callMode: 'call' },
    ])).toThrow("layer3: participant 1 declares no ABI function 'bar'");
  });
});

/**
 * X31's remaining half: the call-option refusal is ONE check, and its narrowing is the handler projection.
 */
describe('X31: one call-option refusal, discriminated by the handler projection', () => {
  const firstParty = compileString(FIRST_PARTY_TRANSFER, OPTIONS);
  const option = compileString(VALUE_OPTION, OPTIONS);
  const slotTally = (slots: readonly { kind: string }[]): Record<string, number> =>
    slots.reduce<Record<string, number>>((tally, slot) =>
      ({ ...tally, [slot.kind]: (tally[slot.kind] ?? 0) + 1 }), {});
  const handlerOf = (artifact: Artifact): any =>
    artifact.hiddenBatch!.handlers.find((candidate) => candidate.name === 'run');
  const routeSlots = (artifact: Artifact): Record<string, number> =>
    slotTally((artifact.hiddenBatch!.route.blockLayout?.slots ?? []) as any);
  const directSlots = (artifact: Artifact): Record<string, number> =>
    slotTally((artifact.abi.find((entry) => entry.name === 'run')!.blockLayout?.slots ?? []) as any);

  it('MEASURED: the direct layout cannot tell a carried transfer from a dropped option', () => {
    // Identical on both sides, which is exactly why refusing on the direct layout alone would refuse every
    // value-moving function rather than the dropped ones.
    expect(firstParty.abi.find((entry) => entry.name === 'run')!.transferCount).toBe(1);
    expect(option.abi.find((entry) => entry.name === 'run')!.transferCount).toBe(1);
    expect(directSlots(firstParty)).toEqual({ master: 1, satoshiContainer: 1, transfer: 1 });
    expect(directSlots(option)).toEqual(directSlots(firstParty));

    // The discriminator. The compiler CARRIES the first-party transfer into the route - one handler entry and
    // eight route `transfer` slots - and DROPS the option, contributing neither.
    expect(handlerOf(firstParty).transfers).toHaveLength(1);
    expect(handlerOf(option).transfers).toBeUndefined();
    expect(routeSlots(firstParty)).toEqual({ master: 1, satoshiContainer: 1, transfer: 8 });
    expect(routeSlots(option)).toEqual({ master: 1 });
    // Neither is rejected as a handler, so batch eligibility is not doing the separating either.
    expect(handlerOf(firstParty).eligible).toBe(true);
    expect(handlerOf(option).eligible).toBe(true);
  }, 240_000);

  it('admits the carried transfer and refuses the dropped option, identically on both entry points', () => {
    const recipient = new Uint8Array([0x76, 0xa9]);
    const message = (build: () => unknown): string => {
      try {
        build();
      } catch (error) {
        return (error as Error).message;
      }
      return 'ACCEPTED';
    };
    const viaPlan = (artifact: Artifact): (() => unknown) => () => layer3.planCompiledGraph([
      { artifact, lockingBytecode: '51' },
      { artifact: callee, lockingBytecode: '52' },
    ], [
      { parent: null, callee: 0, function: 'run', args: [target, 4n, recipient] },
      { parent: 0, callee: 1, function: 'bar', args: [4n], callMode: 'call' },
    ]);
    const viaDerive = (artifact: Artifact): (() => unknown) => () => layer3.deriveCompiledGraphPlan({
      root: { artifact, lockingBytecode: '51' },
      function: 'run',
      args: [target, 4n, recipient],
      targets: { IX36: { artifact: callee, lockingBytecode: '52' } },
    });

    // The honest control: the same value movement, carried rather than dropped, plans through both.
    expect(message(viaPlan(firstParty))).toBe('ACCEPTED');
    expect(message(viaDerive(firstParty))).toBe('ACCEPTED');

    // One function, so one wording. Two copies of this check could report the same fault differently.
    const refusal = 'layer3: function \'run\' of participant 51 declares 1 value option(s)/transfer(s), '
      + 'which the transcript row does not bind; call options are not an admitted graph edge';
    expect(message(viaPlan(option))).toBe(refusal);
    expect(message(viaDerive(option))).toBe(refusal);
  }, 240_000);
});
