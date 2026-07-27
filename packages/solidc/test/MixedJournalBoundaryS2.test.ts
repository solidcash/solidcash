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

/**
 * S2 - the two boundaries of the shared scalar/collection/dynamic journal.
 *
 * `LowerDynamicStateJournalHelpers` runs immediately before `LowerCollectionJournalHelpers` and converts a
 * helper which writes one chunk-backed bytes/string state variable into a returning value handler. The
 * collection pass then declines that same helper, because its return arity is no longer zero, and its
 * collection accesses stayed raw inside an OP_INVOKE body. Both downstream consequences were internal
 * compiler errors rather than diagnostics, measured at this baseline:
 *
 *   Block layout not available while compiling '__scb_dynamic_set'
 *   Found parameters (...) in call to function '__scb_resource_move' where parameters (...) were expected
 *
 * The second boundary is a bare `return;` inside a helper the collection journal DOES take. The pass appends
 * the journalled entry values as a new single exit, so the user's own `return;` was reported by the type
 * checker as a return-arity mismatch against a tuple the user never wrote.
 */

const dynamicPlusCollection = (handler: string): string => `pragma solidcash >=0.8.0;
    contract MixedBoundary() {
      string note;
      mapping(address => bigint) balances;${handler}
    }`;

describe('S2 dynamic-plus-collection journal boundary', () => {
  it('rejects a resource-shaped handler that also writes unbounded string state', () => {
    expect(() => compileString(dynamicPlusCollection(`
      function move(address from, address to, bigint amount, string tag) public {
        this.note = tag;
        this.balances[from] = this.balances[from] - amount;
        this.balances[to] = this.balances[to] + amount;
        require(amount >= 0);
      }`), busOptions)).toThrow(
      /Handler 'move' writes unbounded bytes\/string state and also reaches a collection entry/,
    );
  }, COMPILE_TIMEOUT_MS);

  it('rejects a single-entry handler that also writes unbounded string state', () => {
    expect(() => compileString(dynamicPlusCollection(`
      function set(address who, bigint amount, string tag) public {
        this.note = tag;
        this.balances[who] = this.balances[who] + amount;
        require(amount >= 0);
      }`), busOptions)).toThrow(/Handler 'set' writes unbounded bytes\/string state/);
  }, COMPILE_TIMEOUT_MS);

  it('rejects the same combination when the collection access is only a READ', () => {
    // A read still leaves a raw C2 access whose witness parameters no call site forwards, so the boundary is
    // about sharing one exit, not about two writes racing.
    expect(() => compileString(dynamicPlusCollection(`
      function tag(address who, string t) public {
        this.note = t;
        require(this.balances[who] >= 0);
      }`), busOptions)).toThrow(/Handler 'tag' writes unbounded bytes\/string state/);
  }, COMPILE_TIMEOUT_MS);

  it('rejects the same combination for unbounded bytes as well as string', () => {
    expect(() => compileString(`pragma solidcash >=0.8.0;
    contract MixedBoundaryBytes() {
      bytes note;
      mapping(address => bigint) balances;
      function set(address who, bigint amount, bytes t) public {
        this.note = t;
        this.balances[who] = this.balances[who] + amount;
        require(amount >= 0);
      }
    }`, busOptions)).toThrow(/Handler 'set' writes unbounded bytes\/string state/);
  }, COMPILE_TIMEOUT_MS);

  it('rejects a plain internal helper with the same combination, outside message-bus mode', () => {
    // The interference is between two lowering passes, not between the bus route and anything else: the same
    // helper reached 'Block layout not available while compiling ...' with no bus options at all.
    expect(() => compileString(`pragma solidcash >=0.8.0;
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
    }`, plainOptions)).toThrow(/Handler 'helper' writes unbounded bytes\/string state/);
  }, COMPILE_TIMEOUT_MS);

  // Controls: every neighbouring shape still compiles, so the boundary is exactly the shared exit and not
  // "dynamic state and collections cannot appear in one contract".
  it('admits an unbounded write and a collection write in DIFFERENT handlers', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
    contract SplitBoundary() {
      string note;
      mapping(address => bigint) balances;
      function tag(string t) public { this.note = t; require(true); }
      function set(address who, bigint amount) public {
        this.balances[who] = this.balances[who] + amount;
        require(amount >= 0);
      }
    }`, busOptions);
    expect(artifact.hiddenBatch).toBeDefined();
  }, COMPILE_TIMEOUT_MS);

  it('admits a dynamic ARRAY write beside a collection write in one handler', () => {
    // Dynamic arrays are not chunk-journalled by `LowerDynamicStateJournalHelpers`, so they never reach the
    // rejected combination. Pinned so a later widening of that pass has to revisit this boundary.
    const artifact = compileString(`pragma solidcash >=0.8.0;
    contract ArrayBoundary() {
      bigint[] log;
      mapping(address => bigint) balances;
      function move(address from, address to, bigint amount) public {
        this.log.push(amount);
        this.balances[from] = this.balances[from] - amount;
        this.balances[to] = this.balances[to] + amount;
        require(amount >= 0);
      }
    }`, busOptions);
    expect(artifact.hiddenBatch).toBeDefined();
  }, COMPILE_TIMEOUT_MS);

  it('admits an unbounded write with no collection at all', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
    contract DynamicOnly() {
      bigint moves;
      string note;
      function tag(string t) public { this.moves = this.moves + 1; this.note = t; require(true); }
    }`, busOptions);
    expect(artifact.hiddenBatch).toBeDefined();
  }, COMPILE_TIMEOUT_MS);
});

describe('S2 collection-journal early-return boundary', () => {
  const mixed = (body: string): string => `pragma solidcash >=0.8.0;
    contract EarlyReturnBoundary() {
      bigint moves;
      mapping(address => bigint) balances;${body}
    }`;

  it('names the handler and the reason instead of reporting a synthesized return-arity mismatch', () => {
    expect(() => compileString(mixed(`
      function move(address from, address to, bigint amount) public {
        this.moves = this.moves + 1;
        if (amount == 0) { require(true); return; }
        this.balances[from] = this.balances[from] - amount;
        this.balances[to] = this.balances[to] + amount;
        require(amount >= 0);
      }`), busOptions)).toThrow(
      /Collection journal helper 'move' cannot contain an early return/,
    );
  }, COMPILE_TIMEOUT_MS);

  it('does not report a return-type mismatch against the journal tuple the user never wrote', () => {
    // The previous message was `Return type mismatch: expected (bigint, bigint) but found ()`, pointing at the
    // user's own `return;`. Pin its absence so the diagnostic cannot regress to blaming valid source.
    expect(() => compileString(mixed(`
      function move(address from, address to, bigint amount) public {
        this.moves = this.moves + 1;
        if (amount == 0) { require(true); return; }
        this.balances[from] = this.balances[from] - amount;
        this.balances[to] = this.balances[to] + amount;
        require(amount >= 0);
      }`), busOptions)).not.toThrow(/Return type mismatch/);
  }, COMPILE_TIMEOUT_MS);

  // The admitted counterparts - a loop `break` and an unreached `revert` in the same cloned handler class -
  // are compiled AND settled on the BCH-2026 VM by `Layer3MixedJournalS2.test.ts`, so they are not compiled a
  // second time here: message-bus compilation is several seconds each and this project runs files in parallel.
});
