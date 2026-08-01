import { asmToBytecode } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

/**
 * L2 ADVERSARIAL REVIEW of SEC-18 (`GenerateTargetTraversal.ts:1760-1790`,
 * `computeScalarJournalClosures`).
 *
 * SEC-18 widened the scalar-journal closure from `writerIds.has(id)` to
 * `writerIds.has(id) || routeReachable.has(id)`, then excluded `graphEmissionHandler` clones from
 * `routeReachable` for a frame-arity reason.
 *
 * Two things this file pins.
 *
 * 1. FINDING L2-F2. The widening turns an honest contract that COMPILED at the SEC-18 baseline
 *    (`1cd218c9^`) into a bare internal code-generation `Error`. The shape is a resource-shaped
 *    bus route whose handler gets a `_self_alias` clone and reads a scalar state slot. The alias
 *    joins the widened closure (route-reachable, reads a slot, writes nothing) and then the site
 *    that invokes it has no journal context on the stack. Fail-closed, so not a soundness defect,
 *    but it is an availability regression with no name, no source position and no remedy.
 *
 *    The discriminating set below differs one field at a time:
 *      V1  scalar read, no msg.sender, writer present   -> CRASHES (base: 1483 B artifact)
 *      V2  scalar read, no msg.sender, NO writer at all -> CRASHES  (writer is not the trigger)
 *      V3  no scalar read                              -> compiles (the read IS the trigger)
 *      V4  scalar read WITH msg.sender                  -> compiles (the emission-clone exclusion
 *                                                          shields exactly the stale-reading shape)
 *      V5  scalar read, no msg.sender, DIRECT mode      -> compiles (blast radius is bus routes)
 *
 *    V4 is the sharp part: the variant SEC-18 still serves the PRE-state is the one that compiles,
 *    and its sound sibling is the one refused.
 *
 * 2. The byte cost of the widening as a function of READER COUNT, measured against the same
 *    baseline. It is linear at roughly +4 B per additional pure reader with a fixed onset, so it is
 *    not superlinear. The absolute figures live in the review doc; this file pins the SHAPE, which
 *    is what a later change would break.
 */

const BUS_OPTIONS = {
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
} as const;

/**
 * A resource-shaped bus route: one collection reached under a SHARED key and a ROW-LOCAL key, which
 * is what makes `compiler.ts:1478` emit the `_self_alias` clone.
 */
const resourceVault = (guardBody: string, writerBody: string): string => `pragma solidcash >=0.8.0;
  contract Vault() {
    bigint balance;
    mapping(address => bigint) ledger;
    function withdraw(bigint amount) public {
      ${writerBody}
      require(amount >= 0);
    }
    function assertFloor(bigint floor, address who, address other) public {
      require(this.ledger[who] >= 0);
      require(this.ledger[other] >= 0);
      ${guardBody}
    }
  }`;

const SCALAR_READ = 'require(this.balance >= floor);';
const WRITES_BALANCE = 'this.balance = this.balance - amount;';
const NO_WRITE = 'require(amount >= 0);';

describe('L2 review of SEC-18 - the widened journal closure', () => {
  // BOTH INVERTED WHEN THE FIX LANDED. These recorded a real regression: SEC-18's widening turned an
  // honest contract into a bare `Missing journal context` error with no name, position or remedy, and it
  // was not confined to this fixture - three real corpus contracts crashed the same way, of which
  // TreasurySplit and SushiRoll are fixed by the same change. The cause was that `routeReachable` admits
  // the route's CALLEES and never the route itself, so `invokesJournalHandler` was computed true against an
  // empty `candidateJournalSlots`. Fail-closed throughout, so it was never a soundness defect.
  it('L2-F2 V1: the honest resource-shaped route with a scalar read now COMPILES', () => {
    const artifact = compileString(resourceVault(SCALAR_READ, WRITES_BALANCE), BUS_OPTIONS);
    expect(artifact.bytecode.length).toBeGreaterThan(0);
  });

  it('L2-F2 V2: and it compiles with no writer of the slot at all', () => {
    // Still isolates `routeReachable` rather than `writerIds` as the admitting disjunct: nothing on this
    // route writes `balance`. Kept as a distinct case because the two reached the crash by different
    // disjuncts, so a fix covering only one of them would leave this red.
    const artifact = compileString(resourceVault(SCALAR_READ, NO_WRITE), BUS_OPTIONS);
    expect(artifact.bytecode.length).toBeGreaterThan(0);
  });

  it('L2-F2 V3 NEGATIVE CONTROL on the READ: the same route without the scalar read compiles', () => {
    // Differs from V1 in the guard body only. No scalar slot, so `slots.size > 0` is false and the
    // alias never joins the closure.
    const artifact = compileString(resourceVault('require(floor >= 0);', WRITES_BALANCE), BUS_OPTIONS);
    expect(artifact.bytecode.length).toBeGreaterThan(0);
  });

  it('L2-F2 V4 NEGATIVE CONTROL on msg.sender: the STALE-READING variant is the one that compiles', () => {
    // Differs from V1 by one added predicate. `msg.sender` puts `assertFloor` in `graphTailHandlers`,
    // so its `__scb_resource_` clone carries `graphEmissionHandler` and is EXCLUDED from the widened
    // closure - which both spares it the crash and leaves it reading the pre-transaction value.
    const artifact = compileString(
      resourceVault(`${SCALAR_READ} require(msg.sender == who);`, WRITES_BALANCE), BUS_OPTIONS,
    );
    const clone = artifact.invocationAnalysis!.functions
      .find((entry) => entry.name === '__scb_resource_assertFloor');
    expect(clone).toBeDefined();
    expect(clone!.reads).toContain('state:balance');
    expect(clone!.writes).toEqual([]);
    // And the name X111's gate looks for is absent, so that gate cannot see this clone. See
    // Layer3SecurityReviewL2X111.test.ts L2-F1b for the planner-level consequence.
    expect(artifact.invocationAnalysis!.functions
      .some((entry) => entry.name === '__scb_graph_assertFloor')).toBe(false);
  });

  it('L2-F2 V5 NEGATIVE CONTROL on the ROUTE: direct mode compiles, so the regression is bus-only', () => {
    const artifact = compileString(resourceVault(SCALAR_READ, WRITES_BALANCE), { forceStateful: true });
    expect(artifact.bytecode.length).toBeGreaterThan(0);
  });

  it('L2-F2 the self-alias clone is what the widening admits, and it writes nothing', () => {
    // The V4 spelling is used because V1 does not compile; the alias's footprint is the same either
    // way, which is why the crash reaches it. This pins the exact function named in the crash.
    const artifact = compileString(
      resourceVault(`${SCALAR_READ} require(msg.sender == who);`, WRITES_BALANCE), BUS_OPTIONS,
    );
    const alias = artifact.invocationAnalysis!.functions
      .find((entry) => entry.name === '__scb_resource_assertFloor_self_alias');
    expect(alias).toBeDefined();
    expect(alias!.reads).toContain('state:balance');
    expect(alias!.writes).toEqual([]);
  });
});

/** n pure scalar readers of one journalled slot, one writer. Reader count is the only axis. */
const readerVault = (readers: number): string => {
  const functions = [`function withdraw(bigint amount) public {
      this.balance = this.balance - amount;
      require(amount >= 0);
    }`];
  for (let index = 0; index < readers; index += 1) {
    functions.push(`function assertFloor${index}(bigint floor) public {
      require(this.balance >= floor);
      require(floor >= 0);
    }`);
  }
  return `pragma solidcash >=0.8.0;
  contract Vault() {
    bigint balance;
    ${functions.join('\n    ')}
  }`;
};

describe('L2 review of SEC-18 - reader-count cost shape', () => {
  it('the widened closure costs a bounded, monotone amount per added pure reader', () => {
    // Measured against 1cd218c9^, the SEC-18 delta at 1..8 readers is
    // +15/+9/+13/+21/+24/+28/+32/+36 B on the canonical redeem metric. The absolute sizes move with
    // any codegen change, so what is pinned is the SHAPE: total size monotone in reader count, and a
    // marginal cost per added reader bounded well below the per-reader body itself, which is what
    // "not superlinear" means operationally.
    const sizes = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((readers) =>
      asmToBytecode(compileString(readerVault(readers), BUS_OPTIONS).bytecode).length);
    for (let index = 1; index < sizes.length; index += 1) {
      expect(sizes[index]).toBeGreaterThan(sizes[index - 1]);
    }
    const marginals = sizes.slice(2).map((size, index) => size - sizes[index + 1]);
    expect(Math.max(...marginals)).toBeLessThan(80);
  }, 120_000);
});
