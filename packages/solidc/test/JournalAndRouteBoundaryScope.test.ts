import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

// Message-bus compilation is several seconds per contract; the default budget is not enough under the
// parallel-file load the solidc project runs with.
const COMPILE_TIMEOUT_MS = 60_000;

const busOptions = {
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
};
const plainOptions = { forceStateful: true };

// Message-bus compilation dominates this file's cost and the solidc project runs its files in parallel, so
// every source here is compiled at most once however many rows read it.
const compiled = new Map<string, unknown>();
const once = (source: string, options: Record<string, unknown>): any => {
  const key = `${JSON.stringify(options)}::${source}`;
  if (!compiled.has(key)) compiled.set(key, compileString(source, options));
  return compiled.get(key);
};

/**
 * X34 - the SCOPE of the dynamic-plus-collection journal refusal, measured rather than assumed.
 *
 * `MixedJournalBoundaryReviewB11.test.ts` records that the `this.`-spelled dynamic write is REFUSED beside a
 * collection access and the bare spelling is ADMITTED, and it exercises that in message-bus mode. Round 16 asked
 * whether the refusal is wider than the defect. It is not, and the rows below are the part of that measurement
 * which can be pinned from outside the compiler.
 *
 * The premise recorded when X34 was opened - that removing the guard makes the `this.` program compile
 * BYTE-IDENTICAL to the bare form - is true of the PLAIN path but is a property of the BASELINE, not of the
 * removal: with a single handler and no batch route there is no `__scb_dynamic_` clone, so nothing carries a
 * `__dj_` parameter and the guard never fires. That leg is already admitted today, which the first two rows pin.
 *
 * The legs the guard does refuse were measured with the guard disabled in a copy of the compiler. Every one of
 * them then reaches `Block layout not available while compiling '<name>'` - the internal compiler error S2 was
 * built to replace - and produces no artifact at all, so there is nothing to settle on the VM:
 *
 *   bus, single handler, `this.`   ->  Block layout not available while compiling '__scb_dynamic_set'
 *   plain, internal helper         ->  Block layout not available while compiling 'helper'
 *   bus, internal helper           ->  Block layout not available while compiling 'helper'
 *
 * The documented over-approximation in `callGraphReach` (a function-pointer callsite reaches every address-taken
 * function regardless of arity) could not be turned into a false refusal either: the arity-mismatched case fails
 * to compile with the guard disabled, and fails identically when the dynamic write is deleted outright, so that
 * program is broken independently of this boundary.
 *
 * DISCRIMINATOR: the guard fires exactly when `LowerDynamicStateJournalHelpers` has converted a function into a
 * returning chunk-value handler (it carries a `__dj_<name>` first parameter) AND the intra-contract call graph
 * from it reaches a collection entry. Which SPELLING is used decides whether that conversion happens at all.
 */
describe('X34: the dynamic-plus-collection refusal is bus-scoped for a single handler', () => {
  const scash = (noteWrite: string): string => `pragma solidcash >=0.8.0;
contract MixedBoundary() {
  string note;
  mapping(address => bigint) balances;
  function set(address who, bigint amount, string tag) public {
    ${noteWrite}
    this.balances[who] = this.balances[who] + amount;
    require(amount >= 0);
  }
}`;

  it('PLAIN: both spellings compile and are byte-identical, so this leg is already admitted', () => {
    const thisSpelling = once(scash('this.note = tag;'), plainOptions);
    const bareSpelling = once(scash('note = tag;'), plainOptions);
    expect(thisSpelling.bytecode).toBe(bareSpelling.bytecode);
    expect(thisSpelling.debug.bytecode).toBe(bareSpelling.debug.bytecode);
  }, COMPILE_TIMEOUT_MS * 2);

  // The companion half - that the BARE spelling of this same program IS admitted in bus mode - is already
  // pinned by `MixedJournalBoundaryReviewB11.test.ts`, and compiling it again here is the most expensive row in
  // the file (a bus route over chunk-backed storage), so this row asserts only the side that diverges.
  it('BUS: the `this.` spelling reaches the dj conversion and is refused', () => {
    expect(() => compileString(scash('this.note = tag;'), busOptions))
      .toThrow(/Handler 'set' writes unbounded bytes\/string state/);
  }, COMPILE_TIMEOUT_MS);
});

/**
 * X35 - the route admits a handler that writes an unbounded string AND a collection entry, while refusing the
 * simpler handler that writes only the string. That ordering is not evidence the predicate is keyed on the wrong
 * thing; the block layout is what settles it.
 *
 * `hiddenBatchKeyWitnesses.length > 0` is a proxy for "this handler pins the route's physical entry slot".
 * `computeBlockLayout` pushes `kind: 'entry'` with NO `conditional` flag, so the entry slot is present on every
 * row of the block whichever handler that row selects. Measured with the predicate disabled in a copy of the
 * compiler: the admitted set changes and the SLOT LIST does not - identical `master, dataNft, entry` in both
 * builds. So relaxing it does not remove the entry NFT from a scalar row's block; it only stops requiring that
 * something in that row constrains the entry's post-state, which is the SEC-9 / SEC-15 class.
 *
 * WHAT IT SHOULD KEY ON: whether the route's entry slots are pinned on every row - which today means making
 * them per-row `conditional` - not on whether this particular handler happens to carry key witnesses. Until
 * those slots are conditional the present key is the correct conservative proxy, and this row stays refused.
 * The rows below pin both halves of that reasoning so a later relaxation has to move the slot flag as well.
 */
describe('X35: the mixed-route refusal tracks the entry slot, not the handler', () => {
  const mixed = (scalarBody: string): string => `pragma solidcash >=0.8.0;
contract Mixed() {
  bigint total;
  mapping(address => bigint) balances;
  function bump(address who, bigint a) public { ${scalarBody} require(a >= 0); }
  function credit(address who, bigint a) public {
    this.balances[who] = this.balances[who] + a; require(a >= 0);
  }
}`;

  it('refuses the scalar-only handler and admits the one that also writes a collection entry', () => {
    const scalarOnly = once(mixed('this.total = this.total + a;'), busOptions);
    const alsoCollection = once(
      mixed('this.total = this.total + a; this.balances[who] = this.balances[who] + a;'), busOptions,
    );
    const reasonOf = (artifact: any, name: string): unknown =>
      artifact.hiddenBatch.handlers.find((handler: any) => handler.name === name);
    expect(reasonOf(scalarOnly, 'bump')).toMatchObject({
      eligible: false, rejectionReason: 'mixed-scalar-and-collection-route-not-enabled',
    });
    expect(reasonOf(alsoCollection, 'bump')).toMatchObject({ eligible: true });
  }, COMPILE_TIMEOUT_MS * 2);

  it('the entry slot is unconditional, so a refused row would still carry the entry NFT', () => {
    const artifact = once(mixed('this.total = this.total + a;'), busOptions);
    const entrySlots = artifact.hiddenBatch.route.blockLayout.slots
      .filter((slot: any) => slot.kind === 'entry');
    expect(entrySlots.length).toBeGreaterThan(0);
    // Not `conditional`: the slot exists on every row of the block, whichever handler that row selects. That is
    // why admitting a handler which pins nothing there is a soundness question and not a capacity question.
    expect(entrySlots.every((slot: any) => slot.conditional !== true)).toBe(true);
  }, COMPILE_TIMEOUT_MS);
});
