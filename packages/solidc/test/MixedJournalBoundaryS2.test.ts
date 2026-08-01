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
  it('owner-local default keeps the direct entry and omits the unsettled route', () => {
    const artifact = compileString(dynamicPlusCollection(`
      function move(address from, address to, bigint amount, string tag) public {
        this.note = tag;
        this.balances[from] = this.balances[from] - amount;
        this.balances[to] = this.balances[to] + amount;
        require(amount >= 0);
      }`), plainOptions);
    expect(artifact.abi.find((entry) => entry.name === 'move')).toBeDefined();
    expect(artifact.hiddenBatch).toBeUndefined();
  }, COMPILE_TIMEOUT_MS);

  it('configured controller rejects a resource-shaped handler that also writes unbounded string state', () => {
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

  it('configured controller rejects a single-entry handler that also writes unbounded string state', () => {
    expect(() => compileString(dynamicPlusCollection(`
      function set(address who, bigint amount, string tag) public {
        this.note = tag;
        this.balances[who] = this.balances[who] + amount;
        require(amount >= 0);
      }`), busOptions)).toThrow(/Handler 'set' writes unbounded bytes\/string state/);
  }, COMPILE_TIMEOUT_MS);

  it('configured controller rejects the same combination when the collection access is only a READ', () => {
    // A read still leaves a raw C2 access whose witness parameters no call site forwards, so the boundary is
    // about sharing one exit, not about two writes racing.
    expect(() => compileString(dynamicPlusCollection(`
      function tag(address who, string t) public {
        this.note = t;
        require(this.balances[who] >= 0);
      }`), busOptions)).toThrow(/Handler 'tag' writes unbounded bytes\/string state/);
  }, COMPILE_TIMEOUT_MS);

  it('configured controller rejects the same combination for unbounded bytes as well as string', () => {
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

/**
 * X33 - the guard was one AST level deep, found by Worker B reviewing S2.
 *
 * `touchesCollection` walked `fn.body` only. A state-touching callee is inlined into its caller and the
 * collection journal's own call-site rewrite puts the entry read and the write-back in the CALLER, so a
 * collection reached through an intra-contract call lands in the same OP_INVOKE body as a directly written
 * one. Moving the collection statement one hop restored `Block layout not available while compiling 'helper'`
 * - the exact internal error S2 replaced. The reach is now computed over the call graph.
 *
 * The rejection rows live in `MixedJournalBoundaryReviewB11.test.ts` (B's fixtures, unchanged). This block
 * pins the OTHER half: the shapes the widened reach must NOT swallow. The precedent is the footprint change
 * that published `collection:<local>:*` for local array writes and moved five corpus files; the same class of
 * over-approximation here would reject every dj-converted helper that merely calls something.
 */
describe('X33 collection reach over the call graph does not over-approximate', () => {
  const admitted = (label: string, source: string): void => {
    it(`admits ${label}`, () => {
      expect(compileString(source, plainOptions).bytecode.length).toBeGreaterThan(0);
    }, COMPILE_TIMEOUT_MS);
  };

  // The CALLER touching a collection is not the rejected shape: only what the dj-converted helper can reach.
  admitted('a collection write in the caller of an unbounded-write helper', `pragma solidcash >=0.8.0;
    contract CallerTouches() {
      string note;
      mapping(address => bigint) balances;
      function set(address who, bigint amount, string t) public {
        this.helper(t);
        this.balances[who] = this.balances[who] + amount;
        require(true);
      }
      function helper(string t) internal { this.note = t; }
    }`);

  admitted('a callee that writes plain scalar state', `pragma solidcash >=0.8.0;
    contract CalleeScalarOnly() {
      string note;
      bigint moves;
      mapping(address => bigint) balances;
      function set(bigint amount, string t) public { this.helper(amount, t); require(true); }
      function helper(bigint amount, string t) internal { this.note = t; this.bump(amount); }
      function bump(bigint amount) internal { this.moves = this.moves + amount; }
      function touch(address who) public { this.balances[who] = 1; require(true); }
    }`);

  admitted('a pure callee', `pragma solidcash >=0.8.0;
    contract CalleePure() {
      string note;
      mapping(address => bigint) balances;
      function set(bigint amount, string t) public { this.helper(amount, t); require(true); }
      function helper(bigint amount, string t) internal { this.note = t; require(this.dbl(amount) >= 0); }
      function dbl(bigint a) internal pure returns (bigint) { return a * 2; }
      function touch(address who) public { this.balances[who] = 1; require(true); }
    }`);

  // The locally-bound filter matters here: a LOCAL array element write is not a collection entry.
  admitted('a callee that writes a local array element', `pragma solidcash >=0.8.0;
    contract CalleeLocalArray() {
      string note;
      mapping(address => bigint) balances;
      function set(bigint amount, string t) public { this.helper(amount, t); require(true); }
      function helper(bigint amount, string t) internal { this.note = t; this.arr(amount); }
      function arr(bigint amount) internal {
        bigint[] memory xs = new bigint[](2);
        xs[0] = amount;
        require(xs[0] >= 0);
      }
      function touch(address who) public { this.balances[who] = 1; require(true); }
    }`);

  it('rejects through a PUBLIC callee too - visibility does not change where the access lands', () => {
    expect(() => compileString(`pragma solidcash >=0.8.0;
    contract CalleePublic() {
      string note;
      mapping(address => bigint) balances;
      function set(address who, bigint amount, string t) public { this.helper(who, amount, t); require(true); }
      function helper(address who, bigint amount, string t) internal { this.note = t; this.pub(who, amount); }
      function pub(address who, bigint amount) public {
        this.balances[who] = this.balances[who] + amount;
        require(true);
      }
    }`, plainOptions)).toThrow(/reached through 'pub'/);
  }, COMPILE_TIMEOUT_MS);

  // Function-pointer callsites name no target. The first repair rejected them outright, which fails closed on
  // shapes that COMPILE at the S2 baseline - both of the two below were measured compiling before the reach
  // existed, and the 7,343-file solc corpus moved ZERO files either way, so it could not have caught this.
  // The target set is over-approximated to the address-taken functions instead.
  admitted('a local function pointer whose target is collection-free', `pragma solidcash >=0.8.0;
    contract CalleeFnPtr() {
      string note;
      mapping(address => bigint) balances;
      function set(bigint amount, string t) public { this.helper(amount, t); require(true); }
      function helper(bigint amount, string t) internal {
        this.note = t;
        function(bigint) internal pure returns (bigint) f = dbl;
        require(f(amount) >= 0);
      }
      function dbl(bigint a) internal pure returns (bigint) { return a * 2; }
      function touch(address who) public { this.balances[who] = 1; require(true); }
    }`);

  admitted('a PARAMETER function pointer whose target is collection-free', `pragma solidcash >=0.8.0;
    contract ParamFnPtr() {
      string note;
      mapping(address => bigint) balances;
      function set(bigint amount, string t) public { this.helper(dbl, amount, t); require(true); }
      function helper(function(bigint) internal pure returns (bigint) cb, bigint amount, string t) internal {
        this.note = t;
        require(cb(amount) >= 0);
      }
      function dbl(bigint a) internal pure returns (bigint) { return a * 2; }
      function touch(address who) public { this.balances[who] = 1; require(true); }
    }`);

  it('rejects a local function pointer whose address-taken target reaches a collection', () => {
    expect(() => compileString(`pragma solidcash >=0.8.0;
    contract PtrToCollection() {
      string note;
      mapping(address => bigint) balances;
      function set(address who, bigint amount, string t) public {
        this.helper(who, amount, t);
        require(true);
      }
      function helper(address who, bigint amount, string t) internal {
        this.note = t;
        function(address, bigint) internal cb = credit;
        cb(who, amount);
      }
      function credit(address who, bigint amount) internal {
        this.balances[who] = this.balances[who] + amount;
      }
    }`, plainOptions)).toThrow(/Handler 'helper' writes unbounded bytes\/string state/);
  }, COMPILE_TIMEOUT_MS);

  it('rejects a PARAMETER function pointer whose address-taken target reaches a collection', () => {
    // The parameter form cannot be alias-eliminated to a named callsite, so this row exercises the
    // over-approximation itself rather than an earlier pass having already resolved the target.
    expect(() => compileString(`pragma solidcash >=0.8.0;
    contract ParamPtrToCollection() {
      string note;
      mapping(address => bigint) balances;
      function set(address who, bigint amount, string t) public {
        this.helper(credit, who, amount, t);
        require(true);
      }
      function helper(function(address, bigint) internal cb, address who, bigint amount, string t) internal {
        this.note = t;
        cb(who, amount);
      }
      function credit(address who, bigint amount) internal {
        this.balances[who] = this.balances[who] + amount;
      }
    }`, plainOptions)).toThrow(/Handler 'helper' writes unbounded bytes\/string state/);
  }, COMPILE_TIMEOUT_MS);

  it('names the callee that carries the access, not the intermediate hop', () => {
    expect(() => compileString(`pragma solidcash >=0.8.0;
    contract Diamond() {
      string note;
      bigint moves;
      mapping(address => bigint) balances;
      function set(address who, bigint amount, string t) public { this.helper(who, amount, t); require(true); }
      function helper(address who, bigint amount, string t) internal {
        this.note = t; this.b(amount); this.a(who, amount);
      }
      function a(address who, bigint amount) internal { this.c(who, amount); }
      function b(bigint amount) internal { this.moves = this.moves + amount; }
      function c(address who, bigint amount) internal { this.balances[who] = this.balances[who] + amount; }
    }`, plainOptions)).toThrow(/reached through 'c'/);
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
