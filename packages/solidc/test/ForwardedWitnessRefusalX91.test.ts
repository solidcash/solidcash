import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';
import { ForwardedWitnessError } from '../src/generation/GenerateTargetTraversal.js';

/**
 * X91. X42's `blockhash` half escaped its own guard, and the escape is wider than the hidden batch.
 *
 * X42 refuses `new C(..)` and `blockhash(n)` in `visitFunctionDefinition` when `node.graphEmissionHandler` is
 * set. That flag marks only the hidden-batch handlers that ALSO make a tail-form external call. The crash is
 * not a property of the handler's effects at all - it belongs to the CALL EDGE:
 *
 *   1. SymbolTableTraversal appends `__internal__blockhashInputIndex` to any function with `usesBlockhash`.
 *      Unlike `__internal__msgSenderCategory`, that injection is NOT skipped for a route or a graph handler.
 *   2. TypeCheckTraversal.forwardInternalReturnOutputIdx auto-forwards it at an internal call site as an
 *      identifier naming "the caller's own same-named param".
 *   3. A caller that declares no such param therefore receives a reference to a name it does not have, and
 *      code generation died on the bare internal
 *      `Expected variable '__internal__blockhashInputIndex' does not exist on the stack`.
 *
 * Two callers can be in that position, with DIFFERENT remedies, so they are named apart:
 *
 *   route-cannot-carry-blockhash-oracle-index      a generated `__scb1` route without an authenticated graph
 *                                                  controller. A controller-backed route now reserves a
 *                                                  compiler-planned row-local oracle band instead.
 *   caller-cannot-forward-blockhash-oracle-index   an ordinary function that does not read blockhash itself.
 *                                                  It simply was not given one - and reading blockhash there
 *                                                  fixes the call. Reached on the plain DIRECT route, with no
 *                                                  hidden batch in the picture at all.
 *
 * DIAGNOSTIC ONLY. The no-artifact property is asserted below rather than assumed: every shape that threw the
 * bare internal error still produces no artifact, and every shape that compiled still compiles byte-identically
 * (see the byte table in `+0 bytes` below). The refusal is a pre-check on exactly the condition the argument
 * loop would abort on, placed before the journal-context picks, the hidden-context pushes and the argument
 * evaluation, so no partially lowered call is left behind.
 *
 * The deploy half of X42 does NOT escape this way, measured rather than assumed: `new C(..)` injects no
 * synthetic witness, so a route-eligible handler that deploys and makes no external call compiles onto the
 * route unchanged.
 */

const CTRL = {
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
};
// These controls pin the physical direct-route witness behavior, independent of the compiler's default route.
const DIRECT = { forceStateful: true, experimentalHiddenBatch: false };
const HB = { experimentalHiddenBatch: true, forceStateful: true };
const HB_CTRL = { ...HB, ...CTRL };

// A route-eligible handler that reads blockhash and makes NO external call: not a graph emission handler, so
// X42's gate never sees it.
const BH_ROUTED = `pragma solidcash >=0.8.0;
contract W() {
  bytes32 seen;
  int hits;
  function record(int n) public { this.seen = blockhash(n); this.hits = this.hits + 1; require(n >= 0); }
}`;

// An ordinary caller of a blockhash-reading subroutine. No route anywhere.
const BH_VIA_HELPER = `pragma solidcash >=0.8.0;
contract W() {
  bytes32 seen;
  int hits;
  function peek(int n) internal returns (bytes32) { return blockhash(n); }
  function record(int n) public { this.seen = this.peek(n); this.hits = this.hits + 1; require(n >= 0); }
}`;

// Same, through a PUBLIC function's internal-call subroutine.
const BH_VIA_PUBLIC = `pragma solidcash >=0.8.0;
contract W() {
  bytes32 seen;
  int hits;
  function peek(int n) public returns (bytes32) { require(n >= 0); return blockhash(n); }
  function record(int n) public { this.seen = this.peek(n); this.hits = this.hits + 1; require(n >= 0); }
}`;

// Two blockhash reads in one routed handler (the witness is a single base index + ordinal, so one miss).
const BH_TWICE = `pragma solidcash >=0.8.0;
contract W() {
  bytes32 a;
  bytes32 b;
  function record(int n, int m) public { this.a = blockhash(n); this.b = blockhash(m); require(n >= 0); }
}`;

// CONTROL: blockhash in a function the route does NOT admit (msg.sender demotes it), beside a routed one.
const BH_UNROUTABLE = `pragma solidcash >=0.8.0;
contract W() {
  bytes32 seen;
  int hits;
  mapping(address => int) tally;
  function record(int n) public {
    this.seen = blockhash(n);
    this.tally[msg.sender] = this.tally[msg.sender] + 1;
    require(n >= 0);
  }
  function bump(int n) public { this.hits = this.hits + 1; require(n >= 0); }
}`;

// CONTROL: the other FORWARDABLE witness on its own.
const MSG_SENDER = `pragma solidcash >=0.8.0;
contract W() {
  mapping(address => int) tally;
  function record(int n) public { this.tally[msg.sender] = this.tally[msg.sender] + 1; require(n >= 0); }
}`;

// CONTROL: X42's other half. `new C(..)` in a route-eligible handler with no external call.
const DEPLOY_ROUTED = `pragma solidcash >=0.8.0;
contract Child(int seed) {
  bigint stored;
  function bump(uint v) public { this.stored = this.stored + int(v); require(int(v) >= 0); }
}
contract D() {
  int hits;
  function spawn(int n) public { new Child(7); this.hits = this.hits + 1; require(n >= 0); }
}`;

// CONTROL: neither witness.
const BASELINE = `pragma solidcash >=0.8.0;
contract P() {
  int hits;
  function bump(int n) public { this.hits = this.hits + 1; require(n >= 0); }
}`;

const compile = (src: string, options: object): { ok: true; bytes: number } | { ok: false; error: Error } => {
  try {
    return { ok: true, bytes: compileString(src, options as never).bytecode.length };
  } catch (error) {
    return { ok: false, error: error as Error };
  }
};

const expectRefusal = (src: string, options: object, reason: string): Error => {
  const result = compile(src, options);
  expect(result.ok, 'expected a refusal, got an artifact').toBe(false);
  const error = (result as { ok: false; error: Error }).error;
  expect(error).toBeInstanceOf(ForwardedWitnessError);
  expect((error as ForwardedWitnessError).reason).toBe(reason);
  // The internal invariant message is gone.
  expect(error.message).not.toContain('does not exist on the stack');
  return error;
};

describe('X91: a forwarded synthetic witness the caller cannot supply is refused by name', () => {
  it('a routed blockhash handler requires, then uses, the authenticated graph oracle band', () => {
    const error = expectRefusal(BH_ROUTED, HB, 'route-cannot-carry-blockhash-oracle-index');
    expect(error.message).toContain('hidden-batch route');
    const artifact = compileString(BH_ROUTED, HB_CTRL);
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'record')?.eligible).toBe(true);
    expect(artifact.hiddenBatch?.route.graphBlockhashOracle?.readWidth).toBe(1);
  });

  it('two blockhash reads in one routed handler are refused the same way', () => {
    expectRefusal(BH_TWICE, HB, 'route-cannot-carry-blockhash-oracle-index');
  });

  it('an ordinary caller of a blockhash subroutine is refused on the DIRECT route (no hidden batch)', () => {
    for (const src of [BH_VIA_HELPER, BH_VIA_PUBLIC]) {
      const error = expectRefusal(src, DIRECT, 'caller-cannot-forward-blockhash-oracle-index');
      expect(error.message).toContain('does not itself read blockhash');
    }
  });

  it('blames a position in the USER source, not in the generated route (X76 class)', () => {
    // The forwarded identifier was synthesized at the call site, which for a routed handler is inside
    // compiler-generated __scb1 text. Blaming it printed a line in a file the user cannot act on.
    const error = expectRefusal(BH_ROUTED, HB, 'route-cannot-carry-blockhash-oracle-index');
    const match = error.message.match(/at Line (\d+), Column (\d+)$/);
    expect(match, `no position in: ${error.message}`).not.toBeNull();
    const line = Number(match![1]);
    const sourceLines = BH_ROUTED.split('\n');
    expect(line).toBeGreaterThan(0);
    expect(line).toBeLessThanOrEqual(sourceLines.length);
    // It points at the blockhash read itself.
    expect(sourceLines[line - 1]).toContain('blockhash(');
  });

  it('CONTROL: the same effects on shapes that compiled still compile, byte-identical', () => {
    // Re-measured at b27dc1c4 after the centralized transcript carrier; any drift is a behaviour change.
    const table: [string, string, object, number][] = [
      ['blockhash, unroutable + routed', BH_UNROUTABLE, DIRECT, 2495],
      ['blockhash, unroutable + routed', BH_UNROUTABLE, HB, 3873],
      ['blockhash, routed handler', BH_ROUTED, DIRECT, 3737],
      ['blockhash twice', BH_TWICE, DIRECT, 2823],
      ['msg.sender only', MSG_SENDER, DIRECT, 6061],
      ['msg.sender only', MSG_SENDER, HB, 6061],
      ['msg.sender only', MSG_SENDER, HB_CTRL, 4265],
      ['deploy in routed handler', DEPLOY_ROUTED, DIRECT, 5276],
      ['deploy in routed handler', DEPLOY_ROUTED, HB, 4327],
      ['baseline', BASELINE, DIRECT, 3540],
      ['baseline', BASELINE, HB, 2447],
      ['baseline', BASELINE, HB_CTRL, 3613],
    ];
    for (const [label, src, options, bytes] of table) {
      const result = compile(src, options);
      expect(result.ok, `${label} stopped compiling`).toBe(true);
      expect((result as { ok: true; bytes: number }).bytes, label).toBe(bytes);
    }
  });

  it('CONTROL: the verified remedies actually compile', () => {
    // Direct-route shape: give the CALLER a blockhash read of its own, so it carries a witness to forward.
    const callerReadsToo = `pragma solidcash >=0.8.0;
contract W() {
  bytes32 seen;
  bytes32 also;
  int hits;
  function peek(int n) internal returns (bytes32) { return blockhash(n); }
  function record(int n) public {
    this.also = blockhash(n);
    this.seen = this.peek(n);
    this.hits = this.hits + 1;
    require(n >= 0);
  }
}`;
    expect(compile(callerReadsToo, DIRECT).ok).toBe(true);
    // Routed shape: keep the read in a function the route does not admit.
    expect(compile(BH_UNROUTABLE, HB).ok).toBe(true);
    // Routed shape: compile off the route.
    expect(compile(BH_ROUTED, DIRECT).ok).toBe(true);
  });
});
