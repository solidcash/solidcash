import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';
import { PointerTableBoundError } from '../src/semantic/PointerTableBound.js';

// Message-bus compilation is several seconds per contract; the default 5s budget is not enough under the
// parallel-file load the solidc project runs with.
const COMPILE_TIMEOUT_MS = 60_000;

const busOptions = {
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
};

const table = (body: string): string => `pragma solidcash >=0.8.0;
interface IH { function inc(uint value); function dec(uint value); }
contract BoundedTable() {
  function(uint) external[] handlers;
  function registerInc(address target) public { this.handlers.push(IH(target).inc); require(true); }
  function registerDec(address target) public { this.handlers.push(IH(target).dec); require(true); }
${body}
}`;

const runtimeSized = table(`  function fireAll(uint value) public {
    require(handlers.length <= 3);
    for (int i = 0; i < handlers.length; i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }`);

describe('message-bus pointer-table bound', () => {
  it('publishes the proven ceiling as one bounded loop callsite', () => {
    const artifact = compileString(runtimeSized, busOptions);
    const summary = artifact.invocationAnalysis!.functions.find((fn) => fn.name === 'fireAll')!;
    expect(summary.bounded).toBe(true);
    expect(summary.maximumDirectInvocations).toBe(3);
    expect(summary.externalCalls).toHaveLength(1);
    expect(summary.externalCalls![0]).toMatchObject({ occurrence: 'loop', maximumOccurrences: 3 });
  }, COMPILE_TIMEOUT_MS);

  it('proves a bound from a parameter guard as well as from a table-length guard', () => {
    const artifact = compileString(table(`  function fireN(uint value, int n) public {
    require(n <= 2);
    for (int i = 0; i < n; i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }`), busOptions);
    const summary = artifact.invocationAnalysis!.functions.find((fn) => fn.name === 'fireN')!;
    expect(summary.externalCalls![0]).toMatchObject({ occurrence: 'loop', maximumOccurrences: 2 });
  }, COMPILE_TIMEOUT_MS);

  it('keeps a fixed literal trip count exact', () => {
    const artifact = compileString(table(`  function fireAll(uint value) public {
    for (int i = 0; i < 2; i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }`), busOptions);
    const summary = artifact.invocationAnalysis!.functions.find((fn) => fn.name === 'fireAll')!;
    expect(summary.externalCalls![0]).toMatchObject({ occurrence: 'loop', maximumOccurrences: 2 });
  }, COMPILE_TIMEOUT_MS);

  it.each([
    [
      'an unbounded trip count',
      `  function fireAll(uint value) public {
    for (int i = 0; i < handlers.length; i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }`,
      'add a dominating require that bounds the trip count by an integer literal',
    ],
    [
      'a bound this function can move',
      `  function fireAll(uint value, address extra) public {
    require(handlers.length <= 3);
    for (int i = 0; i < handlers.length; i = i + 1) {
      handlers[i](value); this.handlers.push(IH(extra).inc);
    }
    require(value >= 0);
  }`,
      "this function can change 'handlers', which the bound depends on",
    ],
    [
      'a bound above the expansion maximum',
      `  function fireAll(uint value) public {
    require(handlers.length <= 40);
    for (int i = 0; i < handlers.length; i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }`,
      'the proven bound of 40 reached rows exceeds the maximum of 24',
    ],
    [
      'a control-flow escape',
      `  function fireAll(uint value) public {
    require(handlers.length <= 3);
    for (int i = 0; i < handlers.length; i = i + 1) {
      if (value > 0) { break; } handlers[i](value);
    }
    require(value >= 0);
  }`,
      'the loop body uses break, continue or return',
    ],
    [
      'a non-literal loop initializer',
      `  function fireFrom(uint value, int start) public {
    require(handlers.length <= 3);
    for (int i = start; i < handlers.length; i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }`,
      'the loop initializer is not an integer literal',
    ],
    [
      'two dispatches in one iteration',
      `  function fireAll(uint value) public {
    require(handlers.length <= 3);
    for (int i = 0; i < handlers.length; i = i + 1) { handlers[i](value); handlers[i](value); }
    require(value >= 0);
  }`,
      'the loop body holds 2 pointer dispatches; exactly one is admitted',
    ],
  ])('rejects %s with an exact diagnostic', (_name, body, detail) => {
    let thrown: unknown;
    try {
      compileString(table(body), busOptions);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(PointerTableBoundError);
    expect((thrown as Error).message)
      .toContain(`Message-bus pointer-table loop is not compiler-bounded: ${detail}`);
  }, COMPILE_TIMEOUT_MS);

  /**
   * Bound-provenance escapes, from Worker B's hostile review of G1.
   *
   * Each ESCAPE is byte-equivalent in effect to a CONTROL the pass already refused, and each was ACCEPTED with a
   * published `maximumOccurrences: 3` before this fix. The worst is the tuple swap: `require(n <= 3)` runs, the
   * swap then raises `n`, and the expansion emits only three guarded rows - a silently truncated prefix, which is
   * exactly what the guard exists to prevent. `TupleAssignmentNode` was never tracked as a write; the write is
   * real and survives to codegen. The other two move the write, or the read, one call deep.
   */
  it.each([
    [
      'a bound raised by a tuple swap',
      `  function fireAll(uint value, int m) public {
    int n = m;
    require(n <= 3);
    (n, m) = (m, n);
    for (int i = 0; i < n; i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }`,
      "this function can change 'n', which the bound depends on",
    ],
    [
      'a bound mutated through an internal call',
      `  function bump(address extra) internal { this.handlers.push(IH(extra).inc); }
  function fireAll(uint value, address extra) public {
    require(handlers.length <= 3);
    bump(extra);
    for (int i = 0; i < handlers.length; i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }`,
      "this function can change 'handlers', which the bound depends on",
    ],
    [
      'a bound read through a getter over a mutated table',
      `  function rows() internal view returns (int) { return handlers.length; }
  function fireAll(uint value, address extra) public {
    require(rows() <= 3);
    this.handlers.push(IH(extra).inc);
    for (int i = 0; i < rows(); i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }`,
      "this function can change 'handlers', which the bound depends on",
    ],
  ])('rejects %s', (_name, body, detail) => {
    let thrown: unknown;
    try {
      compileString(table(body), busOptions);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(PointerTableBoundError);
    expect((thrown as Error).message)
      .toContain(`Message-bus pointer-table loop is not compiler-bounded: ${detail}`);
  }, COMPILE_TIMEOUT_MS);

  // The honest controls for the three escapes above: a write the bound does NOT depend on must stay admitted,
  // otherwise the fix would have been bought by rejecting valid contracts.
  it.each([
    [
      'a tuple swap of locals the bound does not depend on',
      `  function fireAll(uint value, int p, int q) public {
    require(handlers.length <= 3);
    (p, q) = (q, p);
    for (int i = 0; i < handlers.length; i = i + 1) { handlers[i](value); }
    require(value >= 0 && p >= 0 && q >= 0);
  }`,
    ],
    [
      'an internal call that writes something else',
      `  int counter;
  function bump() internal { this.counter = counter + 1; }
  function fireAll(uint value) public {
    require(handlers.length <= 3);
    bump();
    for (int i = 0; i < handlers.length; i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }`,
    ],
    [
      'a getter bound over a table nothing writes',
      `  function rows() internal view returns (int) { return handlers.length; }
  function fireAll(uint value) public {
    require(rows() <= 3);
    for (int i = 0; i < rows(); i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }`,
    ],
  ])('still admits %s', (_name, body) => {
    const artifact = compileString(table(body), busOptions);
    const summary = artifact.invocationAnalysis!.functions.find((fn) => fn.name === 'fireAll')!;
    expect(summary.externalCalls![0]).toMatchObject({ occurrence: 'loop', maximumOccurrences: 3 });
  }, COMPILE_TIMEOUT_MS);

  /**
   * The same blind spot in the OLDER `UnrollFixedBoundEntryLoop`, which G1 inherited rather than created, and
   * which was exploitable in its own right: its `new T[](N)` length fold trusts a local that is never mutated,
   * a tuple swap was not counted as a mutation, and a folded size of ZERO deletes the loop as provably-dead
   * code. Before the fix this compiled with NO entry accesses at all - the two mapping writes vanished. The
   * byte-equivalent plain reassignment was already refused.
   */
  it.each([
    ['a tuple swap', '(empty, full) = (full, empty);'],
    ['a plain reassignment', 'empty = full;'],
  ])('refuses to fold a `new T[](0)` length across %s', (_name, mutation) => {
    const source = `contract UnrollFold {
  mapping(int => int) m;
  function run(int v) external {
    int[] memory empty = new int[](0);
    int[] memory full = new int[](2);
    full[0] = 7;
    full[1] = 8;
    ${mutation}
    for (int i = 0; i < empty.length; i = i + 1) { m[i] = full[i]; }
    require(v >= 0);
  }
}`;
    expect(() => compileString(source, { forceStateful: true }))
      .toThrow(/cannot be represented by the C2 linked-list transition generator/);
  }, COMPILE_TIMEOUT_MS);

  it('still folds a `new T[](N)` length when nothing rebinds the local', () => {
    const artifact = compileString(`contract UnrollHonest {
  mapping(int => int) m;
  function run(int v) external {
    int[] memory full = new int[](2);
    full[0] = 7;
    full[1] = 8;
    for (int i = 0; i < full.length; i = i + 1) { m[i] = full[i]; }
    require(v >= 0);
  }
}`, { forceStateful: true });
    // Folded to two constant-index writes, i.e. two distinct fixed entry slots.
    expect(artifact.abi.find((fn) => fn.name === 'run')!.entryAccesses).toHaveLength(2);
  }, COMPILE_TIMEOUT_MS);

  it('leaves the ordinary broadcast route untouched outside message-bus mode', () => {
    const source = table(`  function fireAll(uint value) public {
    for (int i = 0; i < handlers.length; i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }`);
    // No controller: the same unbounded source compiles, and keeps ONE whole-table broadcast callsite rather
    // than the message-bus per-element expansion.
    const artifact = compileString(source, { forceStateful: true });
    const fireAll = artifact.abi.find((fn) => fn.name === 'fireAll')!;
    expect(fireAll.externalCalls).toHaveLength(1);
    expect(fireAll.externalCalls![0].loopArrayVar).toBe('handlers');
    expect(fireAll.externalCalls![0].selectorArrayVar).toBe('__fnsel_handlers');
    expect(fireAll.inputs.some((input) => input.name.startsWith('__internal__extcallMasterIdx'))).toBe(false);
  }, COMPILE_TIMEOUT_MS);
});

/**
 * X170. The graph handler synthesized from a bus function is OP_DEFINE'd, so its chunk-backed table read is
 * emitted into an outlined body, whose trailing run the SDK addresses from the INVOKING ENTRY's footprint.
 * X151 refused every such read; the refusal was over-broad and took the three cases above to 17/19.
 *
 * The two contracts below are identical but for ONE token: which of two declared tables the handler reads.
 * That single difference is the whole attacked field - whether a read-only run belonging to another table sits
 * in front of this one in the layout the entry publishes.
 */
const twoTables = (read: 'alpha' | 'beta'): string => `pragma solidcash >=0.8.0;
interface IH { function inc(uint value); function dec(uint value); }
contract TwoTables() {
  function(uint) external[] alpha;
  function(uint) external[] beta;
  function registerA(address target) public { this.alpha.push(IH(target).inc); require(true); }
  function registerB(address target) public { this.beta.push(IH(target).inc); require(true); }
  function fire(uint value) public {
    for (int i = 0; i < 2; i = i + 1) { ${read}[i](value); }
    require(value >= 0);
  }
}`;

describe('message-bus outlined chunk-read basis', () => {
  // GUARD NEGATIVE CONTROL. `alpha` is declared first, so the entry co-spends its run at the same base the
  // outlined body indexes from: nothing precedes it and the two bases agree. Compiles.
  it('admits an outlined table read whose basis agrees with the invoking entry', () => {
    const artifact = compileString(twoTables('alpha'), busOptions);
    // The published footprint is the thing the basis is derived from, so it is what the control has to pin.
    expect(artifact.abi.find((fn) => fn.name === 'fire')!.dynamicReads).toEqual(['alpha']);
  }, COMPILE_TIMEOUT_MS);

  // SUBJECT. `beta` is declared second and the entry reads BOTH tables, so the run the SDK co-spends for
  // `beta` sits behind `alpha`'s while the outlined graph handler has no ordinary-call base parameter.
  it('refuses an outlined graph table read whose basis disagrees with the invoking entry', () => {
    expect(() => compileString(twoTables('beta'), busOptions)).toThrow(
      /Chunk-backed read of 'beta' in outlined function '__scb_graph_fire' addresses the trailing run at base/,
    );
    expect(() => compileString(twoTables('beta'), busOptions))
      .toThrow(/entry point '__scb1' .* co-spends it at base 2\+0 after \[alpha\]/);
  }, COMPILE_TIMEOUT_MS);
});
