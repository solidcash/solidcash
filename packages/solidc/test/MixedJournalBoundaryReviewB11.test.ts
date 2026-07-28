import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

// Message-bus compilation is several seconds per contract; the default 5s budget is not enough under the
// parallel-file load the solidc project runs with.
const COMPILE_TIMEOUT_MS = 60_000;

const busOptions = {
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
};
const plainOptions = { forceStateful: true };
const solidityBusOptions = { ...busOptions, solidityImportCompat: true };

/**
 * Round-11 independent review of S2 (`MixedJournalBoundaryS2.test.ts`).
 *
 * S2 replaced two internal compiler errors with named diagnostics at the boundary between the dynamic-storage
 * journal and the collection journal. Its guard, in `LowerCollectionJournalHelpers.visitContract`, is:
 *
 *     fn.parameters[0]?.name === `__dj_${fn.name}` && touchesCollection(fn)
 *
 * and `touchesCollection` walks `fn.body` ONLY. The rows below attack that scope.
 */

describe('B/round-11 review of S2: the guard is one AST level deep', () => {
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
   * OPEN. `touchesCollection` never descends through a call, so moving the collection statement one internal
   * call away silences the guard and the pre-S2 internal compiler error returns unchanged. This asserts
   * today's behaviour so a fix FAILS this row loudly rather than closing it silently.
   */
  it('OPEN: one internal call hop silences the guard and restores the pre-S2 internal error', () => {
    expect(() => compileString(indirect, plainOptions))
      .toThrow(/Block layout not available while compiling 'helper'/);
    expect(() => compileString(indirect, plainOptions))
      .not.toThrow(/writes unbounded bytes\/string state/);
  }, COMPILE_TIMEOUT_MS);

  it('OPEN: two hops behave identically - the evasion is not depth-limited', () => {
    expect(() => compileString(twoHops, plainOptions))
      .toThrow(/Block layout not available while compiling 'helper'/);
  }, COMPILE_TIMEOUT_MS);

  it('OPEN: an indirect collection READ evades the guard the same way', () => {
    expect(() => compileString(indirectRead, plainOptions))
      .toThrow(/Block layout not available while compiling 'helper'/);
  }, COMPILE_TIMEOUT_MS);

  it('OPEN: the evasion is not a plain-mode artifact - message-bus mode reaches the same error', () => {
    expect(() => compileString(indirect, busOptions))
      .toThrow(/Block layout not available while compiling 'helper'/);
  }, COMPILE_TIMEOUT_MS);
});

/**
 * MEASURED, and deliberately NOT called a defect. S2's rejected combination - one handler writing chunk-backed
 * unbounded state AND reaching a collection entry - is refused in `.scash` and ADMITTED when the same program
 * is written in Solidity syntax. `solidityImportCompat` alone does not move the boundary; the dialect does.
 *
 * Which side is right is UNDETERMINED here. The admitted artifact is not byte-identical to either single-leg
 * control, so neither leg was silently dropped at the bytecode level, but no VM settlement of the admitted
 * form was run, so this is not evidence that the admitted lowering is sound - only that the two front ends
 * disagree about whether the shape is supported at all.
 */
describe('B/round-11 review of S2: the boundary is dialect-dependent', () => {
  const scash = `pragma solidcash >=0.8.0;
contract MixedBoundary() {
  string note;
  mapping(address => bigint) balances;
  function set(address who, bigint amount, string tag) public {
    this.note = tag;
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

  it('MEASURED: the .scash form is refused with and without solidityImportCompat', () => {
    expect(() => compileString(scash, busOptions))
      .toThrow(/Handler 'set' writes unbounded bytes\/string state/);
    expect(() => compileString(scash, solidityBusOptions))
      .toThrow(/Handler 'set' writes unbounded bytes\/string state/);
  }, COMPILE_TIMEOUT_MS);

  it('MEASURED: the Solidity form of the same program compiles, carrying both legs', () => {
    const both = compileString(
      solidity('note = tag;\n    balances[who] = balances[who] + amount;'), solidityBusOptions,
    );
    // The state layout confirms this is the same combination: a chunk-backed dynamic variable AND a
    // C2 collection, in one handler.
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
