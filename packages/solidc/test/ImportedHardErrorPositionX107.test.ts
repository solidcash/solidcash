import { describe, it, expect } from 'vitest';
import { compileString } from '../src/index.js';

// X107. X93 labelled the WARN side. Hard errors still printed a bare `at Line N, Column M`, and measured on
// the mistswap corpus 21 of those named a file too short to hold the line - the headline being `ERC20Mock.sol`
// (15 lines) reporting `AssignTypeError ... at Line 16`, where line 16 belongs to Context.sol. Six further
// positions were imported lines that happened to FIT the root file, which is worse: silently wrong rather
// than obviously wrong.
//
// The mechanism is a construction-time stamp, not a reachability walk: `AstBuilder` already receives the id of
// the file it is parsing, so the parse KNOWS which file it is reading. That is why it cannot name a
// re-exporting intermediate, and why it needs no import list to be present.
//
// Counterpart pins: `ImportedDiagnosticPositionX93.test.ts` (the warn side, map-based) and
// `GeneratedDiagnosticPositionX92.test.ts` (generated source, which must WIN over any file label).

/** Captures everything the compiler prints, and the error it threw, since both are the subject here. */
function compileCapturing(fn: () => void): { logs: string[]; error: Error | undefined } {
  const logs: string[] = [];
  const log = console.log; const err = console.error; const warn = console.warn; const info = console.info;
  console.log = (...a: unknown[]): void => { logs.push(a.map(String).join(' ')); };
  console.error = console.warn = console.info = console.log;
  let error: Error | undefined;
  try { fn(); } catch (e) { error = e as Error; } finally {
    console.log = log; console.error = err; console.warn = warn; console.info = info;
  }
  return { logs, error };
}

describe('X107: a HARD error inside an imported file names the file that holds it', () => {
  // C.sol holds a type error at ITS line 3. B.sol only re-exports C. main.sol is 4 lines, so a bare
  // `at Line 3` is a position that EXISTS in the root file and is wrong there - the silent case.
  const C = 'pragma solidity ^0.8.20;\nlibrary L {\n function bad(uint256 a) internal pure returns (uint256)'
    + ' { bytes memory b = a; return a; }\n}\n';
  const B = 'pragma solidity ^0.8.20;\nimport "./C.sol";\n';
  const resolver = (p: string): { source: string; id: string } | undefined => {
    if (p === './B.sol') return { source: B, id: '/B.sol' };
    if (p === './C.sol') return { source: C, id: '/C.sol' };
    return undefined;
  };
  const opt = { importResolver: resolver, rootFileId: '/main.sol', solidityImportCompat: true };
  const root = 'pragma solidity ^0.8.20;\nimport "./B.sol";\ncontract Root { uint256 public x;\n'
    + ' function f(uint256 a) public { x = L.bad(a); } }';

  it('names the HOLDING file, not the intermediate that only re-exports it', () => {
    const { error } = compileCapturing(() => compileString(root, opt));
    expect(error?.name).toBe('AssignTypeError');
    expect(error?.message).toContain('at Line 3, Column 59 of imported "/C.sol"');
    // A shallow attribution would claim the DIRECT import, which is a specific and false label.
    expect(error?.message).not.toContain('"/B.sol"');
  });

  it('GUARD: the root file\'s OWN hard error stays UNLABELLED in a compile that HAS resolved imports', () => {
    // Without this, a blanket label would credit the fix for positions that were never wrong. The import is
    // resolved and clean here, so the only reason this position is bare is that it really is the root's.
    const cleanC = 'pragma solidity ^0.8.20;\nlibrary L2 { function twice(uint256 a) internal pure'
      + ' returns (uint256) { return a + a; } }\n';
    const only = (p: string): { source: string; id: string } | undefined => (
      p === './C.sol' ? { source: cleanC, id: '/C.sol' } : undefined);
    const ownError = 'pragma solidity ^0.8.20;\nimport "./C.sol";\ncontract Own { uint256 public x;\n'
      + ' function f(uint256 a) public { bytes memory wrong = a; x = L2.twice(a); } }';
    const { error } = compileCapturing(() => compileString(ownError, {
      importResolver: only, rootFileId: '/main.sol', solidityImportCompat: true,
    }));
    expect(error?.name).toBe('AssignTypeError');
    expect(error?.message).toMatch(/at Line \d+, Column \d+$/);
    expect(error?.message).not.toContain('of imported');
  });

  it('a contract with no imports at all is inert: no label, on either channel', () => {
    // The stamp is only non-empty for a parse of an imported file, so this shape cannot exercise it. Pinned
    // so that a future "label everything" regression is caught by something.
    const bare = 'pragma solidity ^0.8.20;\ncontract Bare { uint256 public x;\n'
      + ' function f(uint256 a) public { bytes memory wrong = a; x = a; } }';
    const { logs, error } = compileCapturing(() => compileString(bare, { solidityImportCompat: true }));
    expect(error?.message).toMatch(/at Line \d+, Column \d+$/);
    expect(error?.message).not.toContain('of imported');
    expect(logs.join('\n')).not.toContain('of imported');
  });
});

describe('X107: the two warn sites that bypassed the shared helper', () => {
  // Both lived in SymbolTableTraversal and printed a bare position: one called diagLine before the stamp
  // existed, the other inlined `at line ${line}` and never called diagLine at all. 39 false labels total.
  const senderLib = 'pragma solidity ^0.8.20;\nlibrary M {\n function who() internal view returns (address)'
    + ' { return msg.sender; }\n}\n';
  const only = (p: string): { source: string; id: string } | undefined => (
    p === './C.sol' ? { source: senderLib, id: '/C.sol' } : undefined);

  it('the msg.sender warning names the imported file that holds the use', () => {
    const root = 'pragma solidity ^0.8.20;\nimport "./C.sol";\ncontract R2 { address public a;\n'
      + ' function f() public { a = M.who(); require(true); } }';
    const { logs } = compileCapturing(() => compileString(root, {
      importResolver: only, rootFileId: '/main.sol', solidityImportCompat: true,
    }));
    const hit = logs.find((w) => /'msg\.sender' used/.test(w));
    expect(hit).toBeDefined();
    expect(hit).toContain('at line 3 of imported "/C.sol"');
  });

  it('GUARD: the same warning for a use in the ROOT file stays unlabelled in the same compile', () => {
    // Discriminates "the label is attached to the right position" from "the label is attached to everything".
    const both = 'pragma solidity ^0.8.20;\nimport "./C.sol";\ncontract R3 { address public a;\n'
      + ' function f() public { a = msg.sender; a = M.who(); require(true); } }';
    const { logs } = compileCapturing(() => compileString(both, {
      importResolver: only, rootFileId: '/main.sol', solidityImportCompat: true,
    }));
    const hits = logs.filter((w) => /'msg\.sender' used/.test(w));
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits.some((w) => /at line \d+\. On BCH/.test(w))).toBe(true);
    expect(hits.some((w) => w.includes('of imported "/C.sol"'))).toBe(true);
  });
});

describe('X107: a Location interpolated whole printed "[object Object]"', () => {
  it('the negative-exponent refusal reports a real position', () => {
    // GenerateTargetTraversal did `at ${node.location}`, stringifying the object. The F3 census recorded
    // "at [object Object]" as a real corpus outcome, so this was reaching users.
    const src = 'pragma solidcash >=0.8.0;\ncontract NE { int public t;\n function f(int a) public'
      + ' { t = a ** -2; require(true); } }';
    const { error } = compileCapturing(() => compileString(src, {}));
    expect(error?.name).toBe('NegativeExponentError');
    expect(error?.message).not.toContain('[object Object]');
    expect(error?.message).toContain('Negative exponent -2 in exponentiation at Line 3, Column 32');
  });
});
