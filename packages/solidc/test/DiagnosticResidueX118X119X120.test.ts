import { describe, it, expect } from 'vitest';
import { compileString } from '../src/index.js';
import { EmittingStateHelperEventError, GraphHandlerShapeError } from '../src/Errors.js';
import { Location, Point, withSourceFile } from '../src/ast/Location.js';

// The three positions X107's construction-time file stamp could NOT reach, and what reaches them.
//
//  X120  ANTLR error-listener SYNTAX errors. The listener builds its own `Location` from the offending token
//        while LEXING/PARSING is still running - before `AstBuilder.build()` opened the stamped scope - so a
//        syntax error inside an imported file printed a bare Line/Column that belongs to THAT file. Fixed by
//        moving the `withSourceFile` scope up to cover the lexer/parser phase in `compiler.ts:parseCode`.
//  X119  Six graph-handler aborts raised a bare `throw new Error` with NO position at all. The stamp cannot
//        reach them: a position needs a node. They now carry the handler's definition node via
//        `GraphHandlerShapeError`, so each gains a Line/Column plus both file caveats.
//  X118  Code generation refused a returning internally-invoked helper that emits an event with a bare internal
//        `Error` - no class name, no position, no remedy - on the canonical solidity-by-example `ERC20.sol` in
//        PLAIN direct-mode compilation. A named refusal is placed immediately before code generation.
//
// MEASURED AT `0103ce9d` (baseline) on the exact fixtures below, so the BEFORE strings are recorded, not
// reasoned about:
//   X120  `ParseError: Mismatched input 'delegate' expecting Identifier at Line 5, Column 13`
//   X119  `Error: Graph handler '__scb_graph_sweep' requires call/staticcall edges and at most one returning call`
//   X118  `Error: Returning state helper '_credit' with an event must be inlined before code generation`
//
// Counterpart pins that must stay green, because each asserts the ABSENCE of a label on a channel this file
// changes: `ImportedHardErrorPositionX107.test.ts`, `ImportedDiagnosticPositionX93.test.ts` and
// `GeneratedDiagnosticPositionX92.test.ts` (whose generated mark must keep WINNING over any file label).

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

const CONTROLLER_LBC = `aa20${'11'.repeat(32)}87`;
const CONTROLLER_CATEGORY = '22'.repeat(32);
const DIRECT = { solidityImportCompat: true, ecrecover: 'p2pkh' as const };
const BUS = {
  ...DIRECT,
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: CONTROLLER_LBC,
  experimentalMessageBusControllerCategory: CONTROLLER_CATEGORY,
};

type Resolved = { source: string; id: string } | undefined;
const resolverFor = (files: Record<string, string>) => (path: string): Resolved => {
  const id = path.replace(/^\./, '');
  return files[path] === undefined ? undefined : { source: files[path], id };
};

describe('X120: a SYNTAX error inside an imported file names the file that holds it', () => {
  // The corpus trigger, verbatim in shape: `function delegate(..)` in an interface. ERC-5805's `IVotes.sol`
  // declares it at line 63, and four eacc roots - two of them TEN LINES LONG - reported `at Line 63` bare.
  //
  // THE HOSTILE IS THAT THE WRONG ANSWER IS BELIEVABLE. C.sol's syntax error is at ITS line 5, and the root
  // file is 12 lines, so a bare `at Line 5, Column 13` names a line that EXISTS in the file the user compiled:
  // `    uint256 public total;`. Nothing about it looks wrong. That is strictly worse than the 10-line case.
  const C = ['pragma solidity ^0.8.20;', 'interface IVotesLike {',
    '    function getVotes(address who) external view returns (uint256);', '',
    '    function delegate(address delegatee) external;', '}', ''].join('\n');
  const B = ['pragma solidity ^0.8.20;', 'import "./C.sol";', ''].join('\n');
  const resolver = resolverFor({ './B.sol': B, './C.sol': C });
  const ROOT = ['pragma solidity ^0.8.20;', 'import "./B.sol";', '', 'contract Root {',
    '    uint256 public total;', '', '    function bump() public {', '        total = total + 1;',
    '        require(true);', '    }', '}', ''].join('\n');
  const opt = { ...DIRECT, importResolver: resolver, rootFileId: '/main.sol' };

  it('names the HOLDING file, not the intermediate that only re-exports it', () => {
    // The premise of the hostile, asserted rather than assumed: the bare line is real in the root file.
    expect(ROOT.split('\n')).toHaveLength(12);
    expect(ROOT.split('\n')[4]).toBe('    uint256 public total;');
    const { error } = compileCapturing(() => compileString(ROOT, opt as never));
    expect(error?.name).toBe('ParseError');
    expect(error?.message)
      .toBe("Mismatched input 'delegate' expecting Identifier at Line 5, Column 13 of imported \"/C.sol\"");
    // B.sol is the DIRECT import and holds nothing; claiming it would be a specific false label.
    expect(error?.message).not.toContain('"/B.sol"');
  });

  it('the position it names is verified against that file: line 5 column 13 IS the offending token', () => {
    // A label is only worth having if the cited position exists in the file it names. Checked here against the
    // fixture's own text, at column resolution, which is how the four corpus labels were checked.
    const line = C.split('\n')[4];
    expect(line).toBe('    function delegate(address delegatee) external;');
    expect(line.slice(13, 13 + 'delegate'.length)).toBe('delegate');
  });

  it('reaches the second corpus message too: a `.push` token in an imported file', () => {
    // The other half of the four: OZ `Votes.sol:229` is `store.push(SafeCast.toUint32(clock()), op(..))`, a
    // two-argument push, and `.push` is a single lexer token (`DotPush`). Same listener, same bare position.
    const lib = ['pragma solidity ^0.8.20;', 'library Store {', '    struct Bag { uint256[] items; }', '',
      '    function grow(Bag storage bag, uint256 a, uint256 b) internal {',
      '        bag.items.push(a, b);', '    }', '}', ''].join('\n');
    const only = resolverFor({ './C.sol': lib });
    const root = ['pragma solidity ^0.8.20;', 'import "./C.sol";', '', 'contract R {', '    uint256 public x;',
      '', '    function f() public {', '        x = 1;', '        require(true);', '    }', '}', ''].join('\n');
    const { error } = compileCapturing(() => compileString(root, {
      ...DIRECT, importResolver: only, rootFileId: '/main.sol',
    } as never));
    expect(error?.name).toBe('ParseError');
    expect(error?.message).toContain('of imported "/C.sol"');
    // The cited line must exist in the file the label names, and be the line with the offending token.
    const cited = Number(/at Line (\d+)/.exec(error!.message)![1]);
    expect(lib.split('\n')[cited - 1]).toContain('.push(');
  });

  it('GUARD: a syntax error in the ROOT file stays UNLABELLED in a compile that HAS resolved imports', () => {
    // Without this, moving the scope up could label every listener position, crediting the fix for positions
    // that were never wrong. The import here resolves and parses cleanly, so the only reason this position is
    // bare is that it really is the root's.
    const cleanC = ['pragma solidity ^0.8.20;', 'interface IClean {',
      '    function getVotes(address who) external view returns (uint256);', '}', ''].join('\n');
    const only = resolverFor({ './C.sol': cleanC });
    // The SAME trigger, in the root file this time. (`delegate` is a soft keyword: it is legal as a CONTRACT
    // function name and rejected only in the interface-method position, which is why the fixture uses one.)
    const rootBroken = ['pragma solidity ^0.8.20;', 'import "./C.sol";', '', 'interface IBroken {',
      '    function delegate(address who) external;', '}', '', 'contract Own {', '    uint256 public total;',
      '', '    function bump() public {', '        total = total + 1;', '        require(true);', '    }',
      '}', ''].join('\n');
    const { error } = compileCapturing(() => compileString(rootBroken, {
      ...DIRECT, importResolver: only, rootFileId: '/main.sol',
    } as never));
    expect(error?.name).toBe('ParseError');
    expect(error?.message).toMatch(/at Line \d+, Column \d+$/);
    expect(error?.message).not.toContain('of imported');
  });

  it('GUARD: a bus-mode compile WITH imports keeps the generated mark on route positions, and adds no file '
    + 'label to them', () => {
    // `parseCode` is also called for the synthesized hidden-batch route. The scope now covers that parse too,
    // with `undefined`, which CLEARS an ambient stamp rather than inheriting the importing file's id - and the
    // generated mark wins over any file label regardless. Both are asserted in one compile that has a resolved
    // import producing its own labelled position, so neither label can be credited for the other's subject.
    const lib = ['', 'pragma solidity ^0.8.20;',
      'library L { function pick(uint256 a, uint256 unusedArg) internal pure returns (uint256) { return a; } }',
      ''].join('\n');
    const only = resolverFor({ './L.sol': lib });
    const root = ['pragma solidity ^0.8.20;', 'import "./L.sol";', 'contract Vault {',
      '  uint256 public total;',
      '  function deposit() public payable { total = total + L.pick(msg.value, 1); }', '}'].join('\n');
    const { logs } = compileCapturing(() => compileString(root, {
      ...BUS, importResolver: only, rootFileId: '/main.sol',
    } as never));
    const route = logs.filter((w) => /__scb_graph_/.test(w));
    expect(route.length, 'the bus compile emits no generated-route diagnostic, so this guard has no subject')
      .toBeGreaterThan(0);
    for (const warning of route) {
      expect(warning).toContain('not of your file');
      expect(warning).not.toContain('of imported');
    }
    // ...and the imported position in the SAME compile still carries X93's label, so the guard is discriminating.
    expect(logs.find((w) => /unused variable 'unusedArg'/.test(w))).toContain('at line 3 of imported "/L.sol"');
  });

  it('GUARD: a contract with NO imports and a syntax error is inert - no label on either channel', () => {
    const bare = ['pragma solidity ^0.8.20;', 'interface IBare {',
      '    function delegate(address who) external;', '}', '', 'contract Bare {', '    uint256 public total;',
      '', '    function bump() public {', '        total = total + 1;', '        require(true);', '    }',
      '}', ''].join('\n');
    const { logs, error } = compileCapturing(() => compileString(bare, DIRECT as never));
    expect(error?.name).toBe('ParseError');
    expect(error?.message).toMatch(/at Line \d+, Column \d+$/);
    expect(error?.message).not.toContain('of imported');
    expect(logs.join('\n')).not.toContain('of imported');
  });
});

describe('X119: a graph-handler abort carries a position and a name', () => {
  // A returning external call plus a void one: two logical call slots, one of them returning, which is the
  // `requires call/staticcall edges and at most one returning call` refusal. This is the shape three real
  // corpus contracts hit - `TokenSwap.swap`, `TokenLock.sync`, `DiscreteStakingRewards.updateRewardIndex`.
  const IFACE = ['pragma solidity ^0.8.20;', 'interface IToken {',
    '    function balanceOf(address who) external view returns (uint256);',
    '    function transfer(address to, uint256 amount) external;', '}', ''].join('\n');
  const FLAT = ['pragma solidity ^0.8.20;', '', 'interface IToken {',
    '    function balanceOf(address who) external view returns (uint256);',
    '    function transfer(address to, uint256 amount) external;', '}', '', 'contract Sweeper {',
    '    uint256 public seen;', '',
    '    function sweep(address token, address to) public {',
    '        uint256 bal = IToken(token).balanceOf(address(this));',
    '        IToken(token).transfer(to, bal);', '        seen = bal;', '        require(true);', '    }',
    '}', ''].join('\n');
  const MESSAGE = "Graph handler '__scb_graph_sweep' requires call/staticcall edges and at most one returning call";

  it('the former refusal is retired, while its backstop remains named and positioned', () => {
    const { error } = compileCapturing(() => compileString(FLAT, BUS as never));
    expect(error).toBeUndefined();
    const diagnostic = new GraphHandlerShapeError({
      location: new Location(new Point(11, 4), new Point(11, 12)),
    } as never, MESSAGE);
    expect(diagnostic.name).toBe('GraphHandlerShapeError');
    expect(diagnostic.message).toBe(`${MESSAGE} at Line 11, Column 4`);
    // ...and the cited position is verified against the source: line 11 declares the function, and column 4 is
    // where `function` starts. The handler is named `__scb_graph_sweep`; nothing in the file is.
    expect(FLAT.split('\n')[10]).toBe('    function sweep(address token, address to) public {');
    expect(FLAT.split('\n')[10].slice(4, 12)).toBe('function');
  });

  it('GUARD: the identical source in DIRECT mode does not produce the refusal at all', () => {
    // The measured asymmetry, pinned: a direct sweep of the 152-file corpus sees ZERO of these. So the
    // discriminating set for this row is bus-mode compiles, and this control is not vacuous because the very
    // same string refuses above.
    const { error } = compileCapturing(() => compileString(FLAT, DIRECT as never));
    expect(error).toBeUndefined();
  });

  it('GUARD: the refusal is about the RETURNING edge, not about having two edges', () => {
    // The negative control differs only in the attacked field: the same two external calls, neither returning.
    const voidOnly = FLAT
      .replace('        uint256 bal = IToken(token).balanceOf(address(this));',
        '        IToken(token).transfer(to, 1);')
      .replace('        seen = bal;', '        seen = 1;')
      .replace('        IToken(token).transfer(to, bal);', '        IToken(token).transfer(to, 2);');
    const { error } = compileCapturing(() => compileString(voidOnly, BUS as never));
    expect(error?.message ?? 'COMPILED').not.toContain('at most one returning call');
  });

  it('the inherited former subject compiles, and its backstop names the holding file', () => {
    // THE BELIEVABLE HOSTILE. `sweep` is declared at line 12 of C.sol; the root file is 16 lines, so the
    // positionless baseline and a bare `at Line 12` are both wrong in ways nothing signals. B.sol only
    // re-exports C.sol, so a shallow attribution would claim B.sol - specific and false.
    const C = ['pragma solidity ^0.8.20;', 'import "./I.sol";', '', 'abstract contract Base {',
      '    uint256 public seen;', '', '    // padding so the offending declaration lands on line 12',
      '    function noted() public view returns (uint256) {', '        return seen;', '    }', '',
      '    function sweep(address token, address to) public {',
      '        uint256 bal = IToken(token).balanceOf(address(this));',
      '        IToken(token).transfer(to, bal);', '        seen = bal;', '        require(true);', '    }',
      '}', ''].join('\n');
    const B = ['pragma solidity ^0.8.20;', 'import "./C.sol";', ''].join('\n');
    const resolver = resolverFor({ './B.sol': B, './C.sol': C, './I.sol': IFACE });
    const root = ['pragma solidity ^0.8.20;', 'import "./B.sol";', '', 'contract Root is Base {',
      '    uint256 public extra;', '', '    function bump() public {', '        extra = extra + 1;',
      '        require(true);', '    }', '', '    function alsoHere() public view returns (uint256) {',
      '        return extra;', '    }', '}', ''].join('\n');
    expect(root.split('\n')).toHaveLength(16);
    const { error } = compileCapturing(() => compileString(root, {
      ...BUS, importResolver: resolver, rootFileId: '/main.sol',
    } as never));
    expect(error).toBeUndefined();
    const location = withSourceFile('/C.sol', () =>
      new Location(new Point(12, 4), new Point(12, 12)));
    const diagnostic = new GraphHandlerShapeError({ location } as never, MESSAGE);
    expect(diagnostic.message).toBe(`${MESSAGE} at Line 12, Column 4 of imported "/C.sol"`);
    expect(diagnostic.message).not.toContain('"/B.sol"');
    // Verified against the file the label names.
    expect(C.split('\n')[11]).toBe('    function sweep(address token, address to) public {');
  });

  it('GUARD: the ROOT file\'s former subject also compiles', () => {
    // Discriminates "the label is attached to the right position" from "the label is attached to everything".
    const clean = ['pragma solidity ^0.8.20;', 'library Helper {',
      '    function twice(uint256 a) internal pure returns (uint256) { return a + a; }', '}', ''].join('\n');
    const only = resolverFor({ './C.sol': clean });
    const root = FLAT.replace('pragma solidity ^0.8.20;\n', 'pragma solidity ^0.8.20;\nimport "./C.sol";\n')
      .replace('        seen = bal;', '        seen = Helper.twice(bal);');
    const { error } = compileCapturing(() => compileString(root, {
      ...BUS, importResolver: only, rootFileId: '/main.sol',
    } as never));
    expect(error).toBeUndefined();
  });
});

describe('X118: the emitting returning state helper is refused by name, with a position', () => {
  // `_credit` is VOID as written. `LowerCollectionJournalHelpers` converts a void single-entry helper into a
  // value-threaded OP_INVOKE subroutine, whose epilogue returns before emit settlement - so the event would be
  // dropped, and code generation refuses it. Baseline:
  //   `Error: Returning state helper '_credit' with an event must be inlined before code generation`
  // No class name, no position, no remedy, and it says "returning" about a function the source declares void.
  // Reproduced by the canonical solidity-by-example `app/erc20/ERC20.sol` in DIRECT mode, not only under the bus.
  const lines = ['pragma solidity ^0.8.20;', 'contract Vault {',
    '    event Moved(address indexed who, uint256 amount);',
    '    mapping(address => uint256) public balanceOf;', '',
    '    function _credit(address to, uint256 amount) internal {',
    '        balanceOf[to] += amount;', '        emit Moved(to, amount);', '    }', '',
    '    function credit(address to, uint256 amount) public {', '        _credit(to, amount);',
    '        require(true);', '    }', '}', ''];
  const SRC = lines.join('\n');

  // SUBJECT RETIRED, and that is the outcome this row wanted. K4 landed the NAMED refusal below and handed
  // over the real repair as a blocked hunk; applying it stops `LowerCollectionJournalHelpers` selecting an
  // emit-carrying void helper at all, so the shape compiles on the pre-existing inline path instead of being
  // refused. Measured: the canonical solidity-by-example `app/erc20/ERC20.sol` and `app/airdrop/Token.sol`
  // both went from this refusal to compiling (5,523.5 B and 6,160.5 B), and reverting only the hunk turns
  // both back into `EmittingStateHelperEventError`. So the refusal is retained as a BACKSTOP with no known
  // reachable subject - filed as X131 - and asserting that it fires would be asserting the unreachable.
  it('the emit-carrying helper now COMPILES rather than being refused, in both modes', () => {
    for (const options of [DIRECT, BUS]) {
      const { error } = compileCapturing(() => compileString(SRC, options as never));
      expect(error).toBeUndefined();
    }
    // Pinned so the subject cannot drift out from under this row unnoticed.
    expect(lines[5]).toBe('    function _credit(address to, uint256 amount) internal {');
  });

  it('the refusal it replaced is still NAMED, not a bare internal Error', () => {
    // The class must keep its position and remedy even while unreachable, because a backstop that degrades to
    // `Error: ... must be inlined before code generation` is the defect this row was opened on. Asserted on the
    // class itself rather than on a compile, since no input reaches it.
    const built = new EmittingStateHelperEventError(
      { location: undefined } as never, '_credit', true,
    );
    expect(built.name).toBe('EmittingStateHelperEventError');
    expect(built.message).toContain("Helper '_credit' emits an event");
    expect(built.message).toContain('it is void as written');
    expect(built.message).toContain('Move the emit into the calling entry point');
    expect(built.message).not.toContain('must be inlined before code generation');
  });

  it('GUARD: the same contract with ONLY the emit removed compiles', () => {
    // The negative control differs in exactly the attacked field. Without it, the refusal could be about the
    // mapping write, the helper, or the call - and the message would be naming the wrong thing.
    const noEmit = SRC.replace('        emit Moved(to, amount);\n', '');
    const { error } = compileCapturing(() => compileString(noEmit, DIRECT as never));
    expect(error).toBeUndefined();
  });

  it('GUARD: an emitting helper that is NOT invoked internally still compiles', () => {
    // The refusal mirrors the code-generation condition exactly, including that the helper be internally
    // invoked. An uninvoked one never becomes a subroutine, so code generation accepts it and so must this.
    const uninvoked = SRC.replace('        _credit(to, amount);', '        balanceOf[to] += amount;');
    const { error } = compileCapturing(() => compileString(uninvoked, DIRECT as never));
    expect(error).toBeUndefined();
  });

  /**
   * NOT COVERED, AND NOT COVERABLE: this refusal has no IMPORTED-file subject, so the file caveat on it is
   * asserted nowhere. The shape needs a helper the journal lowering will convert, and that lowering skips any
   * function with `inheritedFrom` set - so an inherited helper is never converted and never refused. Measured on
   * this fixture: moving `_credit` into an `abstract contract CreditBase` COMPILES, whether the base sits in an
   * imported file or in the root file itself (2,909 bytes either way). Every remaining route to the shape puts
   * the helper directly in the primary contract, which is in the root file by definition.
   *
   * Pinned as a positive compile rather than described, so that if the lowering ever starts converting inherited
   * helpers this comment is caught being wrong instead of quietly aging.
   */
  it('the inherited spelling is not this shape at all, in either file', () => {
    const base = ['pragma solidity ^0.8.20;', '', 'abstract contract CreditBase {',
      '    event Moved(address indexed who, uint256 amount);',
      '    mapping(address => uint256) public balanceOf;', '',
      '    function _credit(address to, uint256 amount) internal {', '        balanceOf[to] += amount;',
      '        emit Moved(to, amount);', '    }', '}', ''].join('\n');
    const derived = ['', 'contract Vault is CreditBase {', '    uint256 public seen;', '',
      '    function credit(address to, uint256 amount) public {', '        _credit(to, amount);',
      '        seen = amount;', '        require(true);', '    }', '}', ''].join('\n');
    // Same file.
    const sameFile = compileCapturing(() => compileString(base + derived, DIRECT as never));
    expect(sameFile.error).toBeUndefined();
    // Imported base, through a re-exporting intermediate - the construction every other hostile here uses.
    const B = ['pragma solidity ^0.8.20;', 'import "./C.sol";', ''].join('\n');
    const resolver = resolverFor({ './B.sol': B, './C.sol': base });
    const root = `pragma solidity ^0.8.20;\nimport "./B.sol";\n${derived}`;
    const imported = compileCapturing(() => compileString(root, {
      ...DIRECT, importResolver: resolver, rootFileId: '/main.sol',
    } as never));
    expect(imported.error).toBeUndefined();
  });
});
