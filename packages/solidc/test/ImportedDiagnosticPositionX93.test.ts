import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// X93. A `Location` carries no file identity, so a diagnostic printing a bare `at line N` cites a line that is
// real in an IMPORTED file and impossible in the file the user named. Measured on the mistswap corpus:
// `ERC20Mock.sol` is 15 lines and reports `unused variable 'errorMessage' at line 170` (SafeMath.sol's line 170)
// and `'msg.sender' used at line 17` (Context.sol's); `KashiPairMock.sol` is 22 lines and reports `line 990`.
//
// The label is resolved from a map keyed on the `Location` INSTANCE rather than the AST node, because lowering
// passes clone nodes and carry the same Location by reference. Node identity alone resolved 3 of 17 positions on
// `ERC20Mock.sol`; Location identity resolved 17 of 17.

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

describe('X93: a diagnostic position inside an imported file names that file', () => {
  // C.sol declares the unused parameter at ITS line 3. B.sol re-exports C; A (the root) imports B.
  // Nothing in the root file has a line 3 body, so an unlabelled `at line 3` is unattributable.
  const C = '\npragma solidity ^0.8.20;\nlibrary L { function pick(uint256 a, uint256 unusedArg) internal pure'
    + ' returns (uint256) { return a; } }\n';
  const B = 'pragma solidity ^0.8.20;\nimport "./C.sol";\n';
  const resolver = (p: string): { source: string; id: string } | undefined => {
    if (p === './B.sol') return { source: B, id: '/B.sol' };
    if (p === './C.sol') return { source: C, id: '/C.sol' };
    return undefined;
  };
  const opt = { importResolver: resolver, rootFileId: '/main.sol', solidityImportCompat: true };
  const root = 'pragma solidity ^0.8.20;\nimport "./B.sol";\ncontract Root { uint256 public x;\n'
    + ' function f(uint256 a) public { x = L.pick(a, 1); } }';

  it('names the DECLARING file, not the importer that only re-exports it (the transitive hostile)', () => {
    const warns = warningsOf(() => compileString(root, opt));
    const hit = warns.find((w) => /unused variable 'unusedArg'/.test(w));
    expect(hit).toBeDefined();
    // The position is line 3 of C.sol. A shallow map claims it for B.sol (the direct import), which is a
    // SPECIFIC AND FALSE label - worse than none. Pinned here so that regression cannot pass silently.
    expect(hit).toContain('at line 3 of imported "/C.sol"');
    expect(hit).not.toContain('"/B.sol"');
  });

  it('GUARD: the root file\'s OWN unused variable is left UNLABELLED', () => {
    // Without this, a blanket label would credit the fix for positions that were never wrong.
    const withOwn = 'pragma solidity ^0.8.20;\nimport "./B.sol";\ncontract Root { uint256 public x;\n'
      + ' function f(uint256 a) public { uint256 mine = 7; x = L.pick(a, 1); } }';
    const warns = warningsOf(() => compileString(withOwn, opt));
    const own = warns.find((w) => /unused variable 'mine'/.test(w));
    expect(own).toBeDefined();
    expect(own).not.toContain('of imported');
    // ...while the imported one in the SAME compile is still labelled, so the guard is not vacuous.
    expect(warns.find((w) => /unused variable 'unusedArg'/.test(w))).toContain('of imported "/C.sol"');
  });

  it('GUARD: a contract with no imports prints the position exactly as before', () => {
    const noImports = 'pragma solidity ^0.8.20;\ncontract Solo { uint256 public x;\n'
      + ' function f(uint256 a) public { uint256 mine = 7; x = a; } }';
    const warns = warningsOf(() => compileString(noImports, { solidityImportCompat: true }));
    const own = warns.find((w) => /unused variable 'mine'/.test(w));
    expect(own).toBe("Warning: unused variable 'mine' at line 3.");
  });

  it('resolves a position on a node CLONED by inheritance expansion', () => {
    // `virtual` and the unused params of an inherited body live on CLONES of the base's nodes, so a map keyed on
    // node identity misses them entirely. The clone carries the base's Location by reference, so this resolves.
    const base = 'pragma solidity ^0.8.20;\nabstract contract Base {\n'
      + ' function hook(uint256 from, uint256 to) internal virtual { }\n}\n';
    const r = (p: string): { source: string; id: string } | undefined => (
      p === './Base.sol' ? { source: base, id: '/Base.sol' } : undefined);
    const src = 'pragma solidity ^0.8.20;\nimport "./Base.sol";\n'
      + 'contract Child is Base { uint256 public x; function f() public { hook(1, 2); x = 1; } }';
    const warns = warningsOf(() => compileString(src,
      { importResolver: r, rootFileId: '/main.sol', solidityImportCompat: true }));
    const virt = warns.find((w) => /'virtual' function modifier is a no-op/.test(w));
    expect(virt).toContain('at line 3 of imported "/Base.sol"');
    const unused = warns.filter((w) => /unused variable '(from|to)'/.test(w));
    expect(unused.length).toBeGreaterThan(0);
    for (const u of unused) expect(u).toContain('at line 3 of imported "/Base.sol"');
  });

  it('resolves the `msg.sender` position, which is the KashiPairMock line-990 shape', () => {
    const base = 'pragma solidity ^0.8.20;\nabstract contract Ctx {\n'
      + ' function _who() internal view returns (address) { return msg.sender; }\n}\n';
    const r = (p: string): { source: string; id: string } | undefined => (
      p === './Ctx.sol' ? { source: base, id: '/Ctx.sol' } : undefined);
    const src = 'pragma solidity ^0.8.20;\nimport "./Ctx.sol";\n'
      + 'contract Child is Ctx { address public a; function f() public { a = _who(); } }';
    const warns = warningsOf(() => compileString(src,
      { importResolver: r, rootFileId: '/main.sol', solidityImportCompat: true }));
    const hit = warns.find((w) => /'msg\.sender' used/.test(w));
    expect(hit).toContain('at line 3 of imported "/Ctx.sol"');
  });
});
