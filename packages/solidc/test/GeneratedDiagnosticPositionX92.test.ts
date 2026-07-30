import { describe, it, expect } from 'vitest';
import { compileString } from '../src/index.js';

// X92. A diagnostic raised during semantic analysis of the MERGED ast can sit on a node the hidden-batch route
// parse built, and a `Location` carries no origin, so the message printed a bare `at line N` for a position that
// exists only inside a string the compiler generated. X71's guard covers the other site - a failure of the parse
// itself - and cannot reach this one.
//
// THE CHEAPEST LIVE INSTANCE IS A SIX-LINE FILE. Measured at `3281ece9` on the fixture below: the same symbol,
// `__scb_graph_msg_value`, is reported at line 67 under `+hiddenBatch` and at line 116 under `+controller`. Both
// are beyond a 6-line file, and the 49-line shift comes from an option that changes the generated preamble and
// nothing the user wrote. No edit to the contract can name either position.
//
// The mark is stamped at CONSTRUCTION, by `withGeneratedSource` around the route parse, rather than walked
// afterwards: later lowering passes clone and re-parent nodes, so a post-parse walk misses everything they
// create.
//
// THREE THINGS ARE PINNED HERE, AND THE SECOND IS WHY. A blanket label would "fix" positions that were never
// wrong, and there are two other channels that must keep their own answer: the root file's own position, which is
// correctly bare, and an IMPORTED file's position, which X93 labels with the declaring file. All three are
// asserted in the same compiles, so neither label can be credited for the other's subject.

/** Captures everything the compiler prints while compiling. */
function warningsOf(fn: () => void): string[] {
  const out: string[] = [];
  const log = console.log; const err = console.error; const warn = console.warn; const info = console.info;
  console.log = (...a: unknown[]): void => { out.push(a.map(String).join(' ')); };
  console.error = console.warn = console.info = console.log;
  try { fn(); } catch { /* diagnostics are the subject; a rejected compile still emits them */ } finally {
    console.log = log; console.error = err; console.warn = warn; console.info = info;
  }
  return out;
}

const CONTROLLER_LBC = `aa20${'11'.repeat(32)}87`;
const CONTROLLER_CATEGORY = '22'.repeat(32);
const DIRECT = { solidityImportCompat: true, ecrecover: 'p2pkh' as const };
const HIDDEN_BATCH = { ...DIRECT, forceStateful: true, experimentalHiddenBatch: true };
const CONTROLLER = {
  ...HIDDEN_BATCH,
  experimentalMessageBusController: CONTROLLER_LBC,
  experimentalMessageBusControllerCategory: CONTROLLER_CATEGORY,
};

/**
 * SIX LINES, and the count matters: every route position cited below is beyond it. The unused local exists so
 * the compile ALSO emits a position that is real in this file, which is the control on the label.
 */
const SIX = [
  'pragma solidity ^0.8.20;',
  'contract Vault {',
  '  uint256 public total;',
  '  function deposit() public payable {',
  '    uint256 mine = 7; total = total + msg.value;',
  '} }',
].join('\n');
const SIX_LINES = 6;

const ROUTE_LABEL = "of the hidden-batch route generated for 'Vault', not of your file";

const graphWarnings = (warns: string[]): string[] => warns.filter((w) => /__scb_graph_/.test(w));
const lineOf = (warning: string): number => Number(/at line (\d+)/.exec(warning)![1]);

describe('X92: a diagnostic position inside the generated route says so', () => {
  it('labels every __scb_graph_* position with the route that generated it', () => {
    expect(SIX.split('\n')).toHaveLength(SIX_LINES);
    const warns = warningsOf(() => compileString(SIX, HIDDEN_BATCH));
    const graph = graphWarnings(warns);
    // NOT VACUOUS. A run that produced no `__scb_graph_*` diagnostic at all would satisfy an `every` over an
    // empty list, which is the exact shape of a guard whose subject stopped existing. Measured at `3281ece9`:
    // 16 of them on this fixture.
    expect(graph.length, 'the fixture emits no generated-route diagnostic to label').toBeGreaterThan(0);
    for (const warning of graph) {
      expect(warning, 'a generated-route position is printed as if it were in the user file')
        .toContain(ROUTE_LABEL);
      // And the position really is unattributable in the file the user named, which is what makes the label
      // load-bearing rather than decorative.
      expect(lineOf(warning)).toBeGreaterThan(SIX_LINES);
    }
    // The recorded instance, by name. Measured at `3281ece9`: line 67.
    const msgValue = graph.find((w) => /__scb_graph_msg_value/.test(w));
    expect(msgValue).toBeDefined();
    expect(msgValue).toContain(ROUTE_LABEL);
  });

  it('the SAME symbol moves when an unrelated compile option changes the preamble', () => {
    const first = graphWarnings(warningsOf(() => compileString(SIX, HIDDEN_BATCH)))
      .find((w) => /__scb_graph_msg_value/.test(w))!;
    const second = graphWarnings(warningsOf(() => compileString(SIX, CONTROLLER)))
      .find((w) => /__scb_graph_msg_value/.test(w))!;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    // THE REASON THE LABEL IS NOT OPTIONAL. Declaring a graph controller changes nothing the user wrote and
    // moves this position by 49 lines: 67 -> 116, measured at `3281ece9`. A bare `at line N` would be citing
    // two different lines of a 6-line file for one unchanged symbol.
    expect(lineOf(first)).toBeGreaterThan(SIX_LINES);
    expect(lineOf(second)).toBeGreaterThan(SIX_LINES);
    expect(lineOf(second), 'the position no longer shifts, so this control has no subject')
      .not.toBe(lineOf(first));
    expect(first).toContain(ROUTE_LABEL);
    expect(second).toContain(ROUTE_LABEL);
  });

  it('GUARD: the same contract in DIRECT mode carries no label at all', () => {
    // Without this, a blanket caveat would be credited for positions that were never wrong. The marked
    // positions exist ONLY inside a synthesized route, so the discriminating set is bus-mode compiles.
    const warns = warningsOf(() => compileString(SIX, DIRECT));
    const own = warns.find((w) => /unused variable 'mine'/.test(w));
    expect(own).toBe("Warning: unused variable 'mine' at line 5.");
    expect(warns.filter((w) => w.includes('not of your file'))).toEqual([]);
    expect(graphWarnings(warns)).toEqual([]);
  });

  it('GUARD: in the SAME bus compile the file\'s OWN position stays bare while route positions are labelled',
    () => {
      // One compile, both channels, so the guard cannot be satisfied by a mode that emits only one of them.
      const warns = warningsOf(() => compileString(SIX, HIDDEN_BATCH));
      const own = warns.filter((w) => /unused variable 'mine'/.test(w));
      expect(own.length, 'the in-file control position is gone, so this guard has no subject')
        .toBeGreaterThan(0);
      for (const warning of own) {
        expect(warning).not.toContain('not of your file');
        expect(warning).not.toContain('of imported');
        expect(lineOf(warning)).toBeLessThanOrEqual(SIX_LINES);
      }
      expect(graphWarnings(warns).length).toBeGreaterThan(0);
    });
});

describe('X92: an imported position keeps X93\'s label under bus-mode compilation', () => {
  // The two labels resolve from different evidence - one is stamped on the Location by the parse that built it,
  // the other is inferred from import reachability - so a compile that has both is the only place they can be
  // shown not to clobber each other.
  const LIB = ['', 'pragma solidity ^0.8.20;',
    'library L { function pick(uint256 a, uint256 unusedArg) internal pure returns (uint256) { return a; } }',
    ''].join('\n');
  const ROOT = [
    'pragma solidity ^0.8.20;',
    'import "./L.sol";',
    'contract Vault {',
    '  uint256 public total;',
    '  function deposit() public payable { total = total + L.pick(msg.value, 1); }',
    '}',
  ].join('\n');
  const resolver = (path: string): { source: string; id: string } | undefined => (
    path === './L.sol' ? { source: LIB, id: '/L.sol' } : undefined);
  const withResolver = <T extends object>(options: T): T & {
    importResolver: typeof resolver; rootFileId: string;
  } => ({ ...options, importResolver: resolver, rootFileId: '/main.sol' });

  it('names the declaring file for the imported position and the route for the generated ones', () => {
    expect(ROOT.split('\n')).toHaveLength(SIX_LINES);
    const warns = warningsOf(() => compileString(ROOT, withResolver(CONTROLLER)));
    const imported = warns.find((w) => /unused variable 'unusedArg'/.test(w));
    expect(imported, 'the imported control position is gone, so this test has no subject').toBeDefined();
    // X93's label, unchanged: line 3 of the file that DECLARES it. It must not be relabelled as generated -
    // that would be a specific false label, which is worse than none.
    expect(imported).toContain('at line 3 of imported "/L.sol"');
    expect(imported).not.toContain('not of your file');
    // ...and the route positions in the SAME compile carry X92's label instead.
    const graph = graphWarnings(warns);
    expect(graph.length, 'the bus compile emits no generated-route diagnostic').toBeGreaterThan(0);
    for (const warning of graph) {
      expect(warning).toContain(ROUTE_LABEL);
      expect(warning).not.toContain('of imported');
    }
  });

  it('GUARD: the imported label is identical without the bus, so the route mark did not produce it', () => {
    const warns = warningsOf(() => compileString(ROOT, withResolver(DIRECT)));
    const imported = warns.find((w) => /unused variable 'unusedArg'/.test(w));
    expect(imported).toBe('Warning: unused variable \'unusedArg\' at line 3 of imported "/L.sol".');
    expect(graphWarnings(warns)).toEqual([]);
  });
});
