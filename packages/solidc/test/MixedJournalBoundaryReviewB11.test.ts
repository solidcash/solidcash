import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

// Message-bus compilation is several seconds per contract; the default 5s budget is not enough under the
// parallel-file load the solidc project runs with.
const COMPILE_TIMEOUT_MS = 60_000;

const busOptions = {
  forceStateful: true,
  hiddenBatch: true,
  messageBusController: `aa20${'11'.repeat(32)}87`,
  messageBusControllerCategory: '22'.repeat(32),
};
const plainOptions = { forceStateful: true };
const solidityBusOptions = { ...busOptions, solidityImportCompat: true };

/**
 * Round-11 independent review of S2 (`MixedJournalBoundaryS2.test.ts`), and X33's repair of what it found.
 *
 * S2 replaced two internal compiler errors with named diagnostics at the boundary between the dynamic-storage
 * journal and the collection journal. Its guard, in `LowerCollectionJournalHelpers.visitContract`, was:
 *
 *     fn.parameters[0]?.name === `__dj_${fn.name}` && touchesCollection(fn)
 *
 * and `touchesCollection` walked `fn.body` ONLY. The rows below attack that scope; every one of them reached
 * `Block layout not available while compiling 'helper'`, the internal error S2 was built to replace.
 *
 * X33 replaced the body-only walk with a reach over the intra-contract call graph, so the rows now assert the
 * NAMED diagnostic and additionally pin which callee carries the collection access. The over-approximation
 * controls live in `MixedJournalBoundaryS2.test.ts`.
 */

describe('B/round-11 review of S2 (CLOSED by X33): the guard follows calls', () => {
  const direct = `pragma solidcash >=0.8.0;
contract PlainMixedBoundary() {
  string note;
  mapping(address => bigint) balances;
  function set(address who, bigint amount, string t) public {
    this.helper(who, amount, t);
    require(true);
  }
  function helper(address who, bigint amount, string t) internal {
    this.note = t;
    this.balances[who] = this.balances[who] + amount;
  }
}`;

  // The ONLY difference: the collection statement moved out of `helper` into a second internal callee.
  const indirect = `pragma solidcash >=0.8.0;
contract IndirectMixedBoundary() {
  string note;
  mapping(address => bigint) balances;
  function set(address who, bigint amount, string t) public {
    this.helper(who, amount, t);
    require(true);
  }
  function helper(address who, bigint amount, string t) internal {
    this.note = t;
    this.inner(who, amount);
  }
  function inner(address who, bigint amount) internal {
    this.balances[who] = this.balances[who] + amount;
  }
}`;

  const twoHops = `pragma solidcash >=0.8.0;
contract TwoHopBoundary() {
  string note;
  mapping(address => bigint) balances;
  function set(address who, bigint amount, string t) public {
    this.helper(who, amount, t);
    require(true);
  }
  function helper(address who, bigint amount, string t) internal {
    this.note = t;
    this.mid(who, amount);
  }
  function mid(address who, bigint amount) internal { this.inner(who, amount); }
  function inner(address who, bigint amount) internal {
    this.balances[who] = this.balances[who] + amount;
  }
}`;

  // A read is enough: the boundary is about sharing one exit, which S2 established with its own read row.
  const indirectRead = `pragma solidcash >=0.8.0;
contract IndirectReadBoundary() {
  string note;
  mapping(address => bigint) balances;
  function tag(address who, string t) public {
    this.helper(who, t);
    require(true);
  }
  function helper(address who, string t) internal {
    this.note = t;
    this.inner(who);
  }
  function inner(address who) internal view { require(this.balances[who] >= 0); }
}`;

  it('CONTROL: the direct form is refused by name, exactly as S2 pins it', () => {
    expect(() => compileString(direct, plainOptions)).toThrow(
      /Handler 'helper' writes unbounded bytes\/string state and also reaches a collection entry/,
    );
  }, COMPILE_TIMEOUT_MS);

  /**
   * CLOSED. The internal compiler error must not come back for ANY of these, so each row asserts both the
   * named diagnostic and the absence of the internal sentinel.
   */
  it('CLOSED: one internal call hop is named, not an internal error', () => {
    expect(() => compileString(indirect, plainOptions)).toThrow(
      /Handler 'helper' writes unbounded bytes\/string state and also reaches a collection entry/,
    );
    expect(() => compileString(indirect, plainOptions))
      .not.toThrow(/Block layout not available/);
  }, COMPILE_TIMEOUT_MS);

  it('CLOSED: two hops behave identically - the repair is not depth-limited', () => {
    // The message names the callee that actually carries the access, not the intermediate hop.
    expect(() => compileString(twoHops, plainOptions))
      .toThrow(/reached through 'inner'/);
    expect(() => compileString(twoHops, plainOptions))
      .not.toThrow(/Block layout not available/);
  }, COMPILE_TIMEOUT_MS);

  it('CLOSED: an indirect collection READ is caught the same way', () => {
    expect(() => compileString(indirectRead, plainOptions))
      .toThrow(/Handler 'helper' writes unbounded bytes\/string state/);
    expect(() => compileString(indirectRead, plainOptions))
      .not.toThrow(/Block layout not available/);
  }, COMPILE_TIMEOUT_MS);

  it('CLOSED: message-bus mode reaches the same diagnostic', () => {
    expect(() => compileString(indirect, busOptions))
      .toThrow(/Handler 'helper' writes unbounded bytes\/string state/);
    expect(() => compileString(indirect, busOptions))
      .not.toThrow(/Block layout not available/);
  }, COMPILE_TIMEOUT_MS);
});

/**
 * SETTLED, and the round-11 label was wrong: the divergence is not between the two DIALECTS, it is between the
 * two SPELLINGS of the dynamic state write. `this.note = tag` is a `StateAssignNode` from the parser; the bare
 * `note = tag` is an `AssignNode` over an `IdentifierNode` until symbol resolution, which runs after these
 * lowerings. `analyseFunctionFootprint` therefore never records `state:note` for the bare form, the hidden-batch
 * synthesis point sees no dynamic touch, no `__scb_dynamic_<handler>` sibling clone is created, and
 * `LowerDynamicStateJournalHelpers` never converts anything - so the guard has no `__dj_` parameter to fire on.
 *
 * That is the SAME gap X19 closed for collections one resource kind over: X19's own comment records that a bare
 * `m[k] = v` is an ArrayAssign until resolution and that omitting it made one spelling of a write invisible to
 * every pre-semantic caller. The scalar/dynamic spelling was left behind.
 *
 * The four cells below are the evidence. Solidity syntax with `this.note` is REFUSED and `.scash` with the bare
 * `note` is ADMITTED, which is what rules the front end out as the cause.
 *
 * WHICH SIDE IS RIGHT: the admitted form. It settles on the BCH-2026 VM with both legs authenticated - see
 * `packages/solidcash/test/e2e/S2BareSpellingSettlement.test.ts`. The refusal is the over-strict side, and it
 * is over-strict only because the `this.` spelling reaches a code path (the dj-converted clone) that genuinely
 * cannot code-generate, not because the SHAPE is unsupportable.
 */
describe('B/round-11 review of S2: owner-local fallback and configured graph refusal', () => {
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

  const solidity = (body: string): string => `pragma solidity ^0.8.0;
contract MixedBoundarySol {
  string note;
  mapping(address => uint256) balances;
  function set(address who, uint256 amount, string memory tag) public {
    ${body}
    require(amount >= 0);
  }
}`;

  it('owner-local .scash and Solidity forms compile directly without publishing an unsettled route', () => {
    const scashArtifact = compileString(scash('this.note = tag;'), plainOptions);
    const solidityArtifact = compileString(
      solidity('this.note = tag;\n    balances[who] = balances[who] + amount;'),
      { ...plainOptions, solidityImportCompat: true },
    );
    expect(scashArtifact.hiddenBatch).toBeUndefined();
    // Solidity compatibility synthesizes state getters, so their safe route
    // may remain; only the unsettled mutating handler must be omitted.
    expect(solidityArtifact.hiddenBatch?.handlers.find((entry: any) => entry.name === 'set')).toMatchObject({
      eligible: false,
      rejectionReason: 'dynamic-and-collection-route-not-enabled',
    });
    expect(scashArtifact.abi.find((entry: any) => entry.name === 'set')).toBeDefined();
    expect(solidityArtifact.abi.find((entry: any) => entry.name === 'set')).toBeDefined();
  }, COMPILE_TIMEOUT_MS * 2);

  it('configured graph: the .scash `this.` spelling is refused with and without solidityImportCompat', () => {
    expect(() => compileString(scash('this.note = tag;'), busOptions))
      .toThrow(/Handler 'set' writes unbounded bytes\/string state/);
    expect(() => compileString(scash('this.note = tag;'), solidityBusOptions))
      .toThrow(/Handler 'set' writes unbounded bytes\/string state/);
  }, COMPILE_TIMEOUT_MS);

  it('the same .scash program with the BARE spelling is ADMITTED - the front end is not the cause', () => {
    const artifact = compileString(scash('note = tag;'), busOptions);
    expect(artifact.stateLayout!.variables.find((entry: any) => entry.name === 'note')!.dynamic).toBe(true);
    expect(artifact.stateLayout!.collections!.map((entry: any) => entry.name)).toContain('balances');
    // Both legs reach the published route, so this is not one leg being dropped.
    expect(artifact.hiddenBatch!.route!.dynamicWrites).toEqual(['note']);
    expect(artifact.hiddenBatch!.route!.entryAccesses!.map((entry: any) => entry.collection))
      .toContain('balances');
  }, COMPILE_TIMEOUT_MS);

  it('configured graph: the Solidity program with the `this.` spelling is refused', () => {
    expect(() => compileString(
      solidity('this.note = tag;\n    balances[who] = balances[who] + amount;'), solidityBusOptions,
    )).toThrow(/Handler 'set' writes unbounded bytes\/string state/);
  }, COMPILE_TIMEOUT_MS);

  it('the Solidity bare form compiles, carrying both legs', () => {
    const both = compileString(
      solidity('note = tag;\n    balances[who] = balances[who] + amount;'), solidityBusOptions,
    );
    expect(both.stateLayout!.variables.find((entry: any) => entry.name === 'note')!.dynamic).toBe(true);
    expect(both.stateLayout!.collections!.map((entry: any) => entry.name)).toContain('balances');

    const dynamicOnly = compileString(solidity('note = tag;'), solidityBusOptions);
    const collectionOnly = compileString(
      solidity('balances[who] = balances[who] + amount;'), solidityBusOptions,
    );
    // Neither leg was dropped: the admitted artifact differs from both single-leg controls.
    expect(both.bytecode).not.toBe(dynamicOnly.bytecode);
    expect(both.bytecode).not.toBe(collectionOnly.bytecode);
    expect(both.bytecode.length).toBeGreaterThan(dynamicOnly.bytecode.length);
    expect(both.bytecode.length).toBeGreaterThan(collectionOnly.bytecode.length);
  }, COMPILE_TIMEOUT_MS * 3);
});
