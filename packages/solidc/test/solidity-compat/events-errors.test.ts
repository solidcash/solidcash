import { describe, it, expect } from 'vitest';
import { compileString } from './helpers.js';

// Focused regression guards derived from the Solidity compiler corpus.
describe('event indexed-parameter limits', () => {
  const cc = (declaration: string): string => compileString(
    `contract C { ${declaration} }`,
    { solidityImportCompat: true },
  ).contractName;

  it('rejects more than three indexed parameters on ordinary events', () => {
    expect(() => cc('event E(uint indexed a, uint indexed b, uint indexed c, uint indexed d);'))
      .toThrow(/more than 3 indexed arguments/i);
  });

  it('rejects more than four indexed parameters on anonymous events', () => {
    expect(() => cc(
      'event E(uint indexed a, uint indexed b, uint indexed c, uint indexed d, uint indexed e) anonymous;',
    )).toThrow(/more than 4 indexed arguments.*anonymous event/i);
  });

  it('accepts each event form at its indexed-parameter limit', () => {
    expect(cc('event E(uint indexed a, uint indexed b, uint indexed c);')).toBe('C');
    expect(cc(
      'event E(uint indexed a, uint indexed b, uint indexed c, uint indexed d) anonymous;',
    )).toBe('C');
  });
});

describe('reserved built-in error names', () => {
  const cc = (declaration: string): string => compileString(
    `${declaration} contract C { function f() public { require(true); } }`,
    { solidityImportCompat: true },
  ).contractName;

  it.each(['error Error(uint value);', 'error Panic(bytes2 code);'])(
    'rejects redeclaration of a built-in error in %s',
    (declaration) => expect(() => cc(declaration)).toThrow(/built-in errors.*cannot be re-defined/i),
  );

  it('retains non-reserved user error names', () => {
    expect(cc('error ErrorCode(uint value); error Panicked(bytes2 code);')).toBe('C');
  });
});

describe('Solidity custom-error ABI parameter types', () => {
  const cc = (source: string): string => compileString(
    `${source} contract C { function f() public { require(true); } }`,
    { solidityImportCompat: true },
  ).contractName;

  it('rejects internal function pointers', () => {
    expect(() => cc('error Bad(function() internal callback);'))
      .toThrow(/internal or recursive type.*error parameter/i);
  });

  it('rejects directly and indirectly recursive structs', () => {
    expect(() => cc('struct S { S[] children; } error Bad(S value);'))
      .toThrow(/internal or recursive type.*error parameter/i);
    expect(() => cc('struct A { B[] children; } struct B { A parent; } error Bad(A value);'))
      .toThrow(/internal or recursive type.*error parameter/i);
  });

  it('retains nonrecursive structs and external function handles', () => {
    expect(cc(
      'struct S { uint value; bytes data; }'
      + ' error Structured(S value); error Callback(function() external callback);',
    )).toBe('C');
  });
});

describe('Solidity custom-error selector collisions', () => {
  const cc = (source: string): string => compileString(source, {
    solidityImportCompat: true,
  }).contractName;

  it('rejects colliding signatures declared in one contract', () => {
    expect(() => cc('contract C { error gsf(); error tgeo(); }'))
      .toThrow(/same 4-byte selector.*gsf/i);
  });

  it('rejects a collision between library and contract errors', () => {
    expect(() => cc(
      'library L { error gsf(); } contract C { error tgeo();'
      + ' function f(bool a) public { if (a) revert L.gsf(); else revert tgeo(); } }',
    )).toThrow(/same 4-byte selector.*gsf/i);
  });

  it('retains distinct selectors and duplicate references to one signature', () => {
    expect(cc('library L { error Fine(); } contract C { error Other(uint value); }')).toBe('C');
  });
});

describe('Solidity custom-error call contexts', () => {
  const cc = (body: string): string => compileString(
    `error E(uint value); contract C { function f() public { ${body} } }`,
    { solidityImportCompat: true },
  ).contractName;

  it('rejects a custom error used as an ordinary call or assert argument', () => {
    expect(() => cc('E(1);')).toThrow(/only be used with a revert statement.*require error/i);
    expect(() => cc('assert(E(1));')).toThrow(/only be used with a revert statement.*require error/i);
    expect(() => compileString(
      'error FreeError(); function f() pure { FreeError(); }',
      { solidityImportCompat: true },
    )).toThrow(/only be used with a revert statement.*require error/i);
    expect(() => compileString(
      'error FreeError(); function f() pure { assert(FreeError()); }',
      { solidityImportCompat: true },
    )).toThrow(/only be used with a revert statement.*require error/i);
  });

  it('rejects a namespaced library error used as an ordinary call', () => {
    expect(() => compileString(
      'library L { error Bad(); } contract C { function f() public { L.Bad(); } }',
      { solidityImportCompat: true },
    )).toThrow(/only be used with a revert statement.*require error/i);
  });

  it('retains custom errors in revert and require contexts', () => {
    expect(cc('if (false) revert E(1); require(true, E(2));')).toBe('C');
  });
});

describe('Solidity anonymous event selectors', () => {
  it('rejects a namespaced anonymous library event selector in functions and initializers', () => {
    expect(() => compileString(
      'library L { event E() anonymous; }'
      + ' contract C { function f() public pure returns (bytes32) { return L.E.selector; } }',
      { solidityImportCompat: true },
    )).toThrow(/Anonymous event 'L\.E'.*does not have a selector/i);
    expect(() => compileString(
      'library L { event E() anonymous; } contract C { bytes32 x = L.E.selector; }',
      { solidityImportCompat: true },
    )).toThrow(/Anonymous event 'L\.E'.*does not have a selector/i);
    expect(() => compileString(
      'contract C { event E() anonymous;'
      + ' function f() public pure returns (bytes32) { return E.selector; } }',
      { solidityImportCompat: true },
    )).toThrow(/Anonymous event 'E'.*does not have a selector/i);
  });

  it('retains selectors for ordinary events', () => {
    expect(compileString(
      'library L { event E(); }'
      + ' contract C { function f() public pure returns (bytes32) { return L.E.selector; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('Solidity named event overload ambiguity', () => {
  it('rejects overloads sharing a named-argument set in different orders', () => {
    expect(() => compileString(
      'contract C { event E(uint u, string s); event E(string s, uint u);'
      + ' function f() public { emit E({u: 2, s: "abc"}); } }',
      { solidityImportCompat: true },
    )).toThrow(/No unique declaration.*overloaded event 'E'/i);
  });

  it('rejects ambiguity through implicit literal conversions', () => {
    expect(() => compileString(
      'contract C { event E(uint u, string s); event E(bytes s, int u);'
      + ' function f() public { emit E({u: 2, s: "abc"}); } }',
      { solidityImportCompat: true },
    )).toThrow(/No unique declaration.*overloaded event 'E'/i);
  });

  it('retains a uniquely named event overload and reorders its arguments', () => {
    expect(compileString(
      'contract C { event E(uint a, bool b); event E(bytes x, string y);'
      + ' function f() public { emit E({b: true, a: 2}); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('Solidity contract event shadowing', () => {
  it('hides a same-named file event from bare emit lookup', () => {
    expect(() => compileString(
      'event E(); contract C { event E(uint value); function f() public { emit E(); } }',
      { solidityImportCompat: true },
    )).toThrow(/expects 1 arguments.*got 0/i);
  });

  it('retains a file-level event when the contract does not shadow its name', () => {
    expect(compileString(
      'event E(); contract C { function f() public { emit E(); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('retains qualified and inherited lexical event lookup', () => {
    expect(compileString(
      'event F(uint value); library L { event E(uint value); } interface I { event E(uint value); }'
      + ' contract Base { function f() public { emit I.E(1); emit F(1); } }'
      + ' contract C is Base { event E(string value); event F(string value);'
      + ' function g() public { emit E("ok"); emit L.E(1); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('event argument literal coercion', () => {
  const bc = (arg: string): string => compileString(
    `contract C { event E(bytes3 indexed value); function f() public { emit E(${arg}); } }`,
    { solidityImportCompat: true },
  ).bytecode;

  it('right-pads a string literal for a bytesN event parameter', () => {
    expect(bc('"abc"')).toBe(bc('hex"616263"'));
  });
});

describe('future soft-keyword names in function types and errors', () => {
  it('accepts transient as a deprecated function-type and custom-error parameter name', () => {
    expect(compileString(
      'error E(uint transient); contract C { function (uint transient) external transient y;'
      + ' function transient() public pure {} }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('crash-bucket triage (internal errors -> clean diagnostics or fixes)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('resolves a struct field that forward-references a later user-defined value type', () => {
    // `struct S { U u; }` before `type U is address;` crashed artifact generation on the unresolved field type.
    expect(cc('struct S { U u; } contract C { S s; function f() external pure { require(true); } } type U is address;'))
      .toBe('C');
  });
  it('lowers assignment-as-expression on a state variable in a short-circuit branch', () => {
    // An unconditional assignment-as-expression (arg / left-of-&& / initializer) is now HOISTED to a statement
    // (DesugarPostfixExpressions.visitAssignmentExpression). A conditional right operand is instead lowered to
    // a nested branch so its state write executes only when short-circuit evaluation reaches it.
    expect(compileString('contract C { bool b; function f() external {'
      + ' if (b && (b = false)) {} require(true); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
  it('compiles assignment-as-argument f(x = v) by hoisting it (BentoBox domain separator)', () => {
    // `_calculateDomainSeparator(DOMAIN_SEPARATOR_CHAIN_ID = chainId)` - the assignment argument hoists to
    // `x = v;` before the call statement, so a STATE-var target compiles (no assignment-as-expression restriction).
    expect(cc('contract C { uint256 cid; bytes32 ds; function calc(uint256 c) internal pure returns (bytes32){'
      + ' return bytes32(c); } constructor() { ds = calc(cid = 5); } }')).toBe('C');
    // A local-var assignment argument works too, and the assigned value is what is passed.
    expect(cc('contract C { function calc(uint256 c) internal pure returns (uint256){ return c; }'
      + ' function f(uint256 y) external pure returns (uint256){ uint256 x; uint256 r = calc(x = y); return r + x; } }'))
      .toBe('C');
  });
  it('compiles a compound bitwise assignment whose codegen emits a location-less instruction', () => {
    // Source-map generation used to crash on the missing location; it now serialises an empty entry.
    expect(cc('contract C { function f(uint x, uint y) external pure returns (uint) { x |= y; return x; } }')).toBe('C');
  });
});

describe('crash-bucket triage round 2 (internal errors -> clean diagnostics)', () => {
  it('threads the originating msg.sig through an internal function', () => {
    const src = 'contract C { function f() external pure { g(); } function g() internal pure { require(msg.sig == 0x00000000); } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
  });
  it('compiles a statement call on a deploy-into-state contract variable', () => {
    // A zero-argument void call is not a constructor external READ and must remain a call after deployment.
    const src = 'contract C { event e(); function f() public { emit e(); } }'
      + ' contract D { C c; constructor() { c = new C(); c.f(); } function g() public { require(true); } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('D');
  });
});

describe('external function pointers in events', () => {
  it('encodes both self and foreign values as selector plus address', () => {
    const art = compileString('contract C { event E(function() external indexed);'
      + ' function f() public { emit E(this.f); emit E(C(address(0x1234)).f); } }',
    { solidityImportCompat: true });
    expect(art.contractName).toBe('C');
  });
  it('retains an unused internal-function event declaration but rejects an attempted emit', () => {
    expect(compileString('contract C { event E(function() internal); }',
      { solidityImportCompat: true }).contractName).toBe('C');
    expect(() => compileString('contract C { event E(function() internal);'
      + ' function target() internal {} function f() public { emit E(target); } }',
    { solidityImportCompat: true })).toThrow(/not supported as an event parameter/);
    expect(() => compileString('struct S { S[] ss; } contract C {'
      + ' event E1(function() internal); event E2(S); }',
    { solidityImportCompat: true })).toThrow(/not supported as an event parameter/);
  });
});

describe('qualified custom error resolution', () => {
  it('selects the error declared by the qualifier despite a same-named local declaration', () => {
    expect(compileString('contract D { error E(uint value); } contract C { error E();'
      + ' function f() public { revert D.E(1); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('custom error name uniqueness', () => {
  it('rejects error overloads and effective-scope function collisions', () => {
    const compat = { solidityImportCompat: true };
    expect(() => compileString('error E(uint); error E(bytes32); contract C {}', compat))
      .toThrow();
    expect(() => compileString('contract A { function E() public {} }'
      + ' contract B is A { error E(uint); }', compat)).toThrow();
    expect(() => compileString('contract A { error E(uint); }'
      + ' contract B is A { error E(bytes32); }', compat)).toThrow();
  });
});

describe('exact event signature redeclarations', () => {
  it('rejects file-level and inherited duplicates while retaining true overloads', () => {
    const compat = { solidityImportCompat: true };
    expect(() => compileString('event E(uint); event E(uint); contract C {}', compat)).toThrow();
    expect(() => compileString('contract A { event E(uint); }'
      + ' contract B is A { event E(uint indexed); }', compat)).toThrow();
    expect(compileString('contract A { event E(uint); }'
      + ' contract B is A { event E(bytes32); }', compat).contractName).toBe('B');
  });
});

describe('reserved-name exceptions for events', () => {
  it('accepts this and super only through the event-name grammar alternative', () => {
    expect(compileString('event this(); event super(); event _(); contract C {}',
      { solidityImportCompat: true }).contractName).toBe('C');
    expect(() => compileString('contract C { uint this; }',
      { solidityImportCompat: true })).toThrow();
  });
});
