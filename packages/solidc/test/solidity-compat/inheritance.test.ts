import { describe, it, expect } from 'vitest';
import { compileString, compileStringRaw, compileStringMulti } from './helpers.js';

// Focused regression guards derived from the Solidity compiler corpus.
describe('constructor visibility compatibility', () => {
  const cc = (src: string): string =>
    compileString(src, { solidityImportCompat: true }).contractName;

  it('rejects external constructors', () => {
    expect(() => cc('contract C { constructor() external {} }'))
      .toThrow(/constructor cannot have external visibility/);
  });

  it('rejects internal constructors on concrete contracts', () => {
    expect(() => cc('contract C { constructor() internal {} }'))
      .toThrow(/non-abstract contracts cannot have internal constructors/);
  });

  it('rejects public constructors on abstract contracts', () => {
    expect(() => cc('abstract contract C { constructor() public {} }'))
      .toThrow(/abstract contracts cannot have public constructors/);
  });

  it('accepts the inverse legacy visibility combinations', () => {
    expect(cc('abstract contract C { constructor() internal {} }')).toBe('C');
    expect(cc('contract C { constructor() public {} }')).toBe('C');
    expect(cc('pragma solidity 0.6.12; contract C { constructor() internal {} }')).toBe('C');
  });
});

describe('abstract contract instantiation eligibility', () => {
  it('excludes legacy internal-constructor bases from multi-artifact output', () => {
    const artifacts = compileStringMulti(`
      pragma solidity 0.6.12;
      contract Base {
        event Initialized(int value);
        constructor() internal { emit Initialized(1); }
      }
      contract Child is Base { function use() public { require(true); } }
    `, { solidityImportCompat: true });
    expect(Object.keys(artifacts)).toEqual(['Child']);
  });

  it('rejects a forward reference instantiated before its abstract declaration', () => {
    expect(() => compileStringRaw(
      'contract B { A a; constructor() { a = new A(address(this)); } }'
      + ' abstract contract A { constructor(address) {} }',
      { solidityImportCompat: true },
    )).toThrow(/Cannot instantiate abstract contract 'A'/);
  });

  it('retains forward deployment of a concrete contract', () => {
    expect(compileStringRaw(
      'contract B { A a; constructor() { a = new A(address(this)); } }'
      + ' contract A { constructor(address) {} }',
      { solidityImportCompat: true },
    ).contractName).toBe('A');
  });
});

describe('abstract-contract modifier declaration validation', () => {
  it('rejects an implemented modifier without a placeholder before emitting a declaration artifact', () => {
    expect(() => compileString(
      'abstract contract A { function f() public view mod { require(true); } modifier mod() virtual {} }',
      { solidityImportCompat: true },
    )).toThrow(/must contain at least one.*placeholder/i);
  });

  it('still emits an abstract declaration when each implemented modifier has a placeholder', () => {
    expect(compileString(
      'abstract contract A { function f() public view mod { require(true); } modifier mod() virtual { _; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('A');
  });

  it('rejects an unimplemented modifier which is not virtual', () => {
    expect(() => compileString(
      'abstract contract A { modifier mod(); }',
      { solidityImportCompat: true },
    )).toThrow(/unimplemented modifier.*must be virtual/i);
  });
});

describe('inherited constructor argument compatibility', () => {
  const cc = (src: string): string =>
    compileString(src, { solidityImportCompat: true }).contractName;

  it('rejects concrete derived contracts which omit required base-constructor arguments', () => {
    expect(() => cc('contract A { constructor(uint x) {} } contract B is A {}'))
      .toThrow(/parent constructor invocation 'A' expects 1 arguments but got 0/i);
    expect(() => cc(
      'contract A { constructor(uint x) {} }'
      + ' contract B is A { constructor(bytes4 a, bytes28 b) {} }',
    )).toThrow(/parent constructor invocation 'A' expects 1 arguments but got 0/i);
  });

  it('allows an abstract derived contract to defer base-constructor arguments', () => {
    expect(cc('contract A { constructor(uint x) {} } abstract contract B is A {}')).toBe('B');
  });

  it('allows a direct descendant base to provide the shared ancestor constructor arguments', () => {
    expect(cc(
      'contract A { constructor(uint x) {} } contract B is A { constructor(uint x) A(x) {} }'
      + ' contract C is A, B { constructor(uint x) B(x) {} }',
    )).toBe('C');
    expect(cc(
      'contract A { constructor(uint x) {} } contract B is A(2) {} contract C is A, B {}',
    )).toBe('C');
  });

  it('rejects constructor arguments supplied to an interface base', () => {
    expect(() => cc('interface I {} contract C is I(2) {}'))
      .toThrow(/parent constructor invocation 'I' expects 0 arguments but got 1/i);
  });
});

describe('constructor-list invocation compatibility', () => {
  const cc = (src: string): string =>
    compileString(src, { solidityImportCompat: true }).contractName;

  it('rejects a bare modifier-style base constructor invocation', () => {
    expect(() => cc(
      'contract A { constructor() {} } contract B is A { constructor() A {} }',
    )).toThrow(/base constructor invocation 'A' must use parentheses/i);
    expect(() => cc(
      'abstract contract A { constructor(uint x, bool y) {} }'
      + ' abstract contract B is A { constructor() A {} }',
    )).toThrow(/base constructor invocation 'A' must use parentheses/i);
  });

  it('rejects a constructor-list call naming an unrelated contract or itself', () => {
    expect(() => cc('contract X {} contract C { constructor() X(5) {} }'))
      .toThrow(/parent invocation references 'X'/i);
    expect(() => cc('contract C { constructor() C() {} }'))
      .toThrow(/parent invocation references 'C'/i);
  });

  it('preserves genuine custom modifiers on constructors', () => {
    expect(cc('contract C { modifier m(uint x) { require(x == 1); _; } constructor() m(1) {} }')).toBe('C');
  });
});

describe('Solidity base-constructor argument validation', () => {
  it('rejects an out-of-range literal even when the base parameter is unused', () => {
    expect(() => compileString(
      'contract Base { constructor(uint8) {} } contract Derived is Base(300) {}',
      { solidityImportCompat: true },
    )).toThrow(/300.*uint8|uint8.*300/i);
  });

  it('rejects error and event declarations used as constructor arguments', () => {
    expect(() => compileString(
      'error E(uint, bool); contract Base { constructor(uint8) {} } contract D is Base(E) {}',
      { solidityImportCompat: true },
    )).toThrow(/E.*declaration.*not a value/i);
    expect(() => compileString(
      'contract Base { event E(uint); constructor(uint8) {} } contract D is Base(Base.E) {}',
      { solidityImportCompat: true },
    )).toThrow(/Base\.E.*declaration.*not a value/i);
  });

  it('retains an in-range argument consumed by the base constructor', () => {
    expect(compileString(
      'contract Base { uint8 public x; constructor(uint8 v) { x = v; } } contract D is Base(255) {}',
      { solidityImportCompat: true },
    ).contractName).toBe('D');
  });
});

describe('payable/external modifier ordering on receive() and constructor()', () => {
  const ok = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts receive() payable external (either order)', () => {
    const mk = (mods: string): string => `contract C { uint256 y; receive() ${mods} { y = y + 1; require(true); }`
      + ' function f() public { require(true); } }';
    expect(ok(mk('payable external'))).toBe('C');
    expect(ok(mk('external payable'))).toBe('C');
  });
  it('accepts payable after the parent invocation in a constructor', () => {
    const mk = (mods: string): string => 'contract A { constructor() {} }'
      + ` contract C is A { constructor() ${mods} { } function f() public { require(true); } }`;
    expect(ok(mk('A() payable'))).toBe('C');
    expect(ok(mk('payable A()'))).toBe('C');
  });
});

describe('block.coinbase is address payable', () => {
  it('returns it as payable and permits the normal payable-to-address widening', () => {
    expect(compileString(
      'contract C { function p() public view returns(address payable) { return block.coinbase; }'
      + ' function a() public view returns(address) { return block.coinbase; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('qualified base-contract modifiers', () => {
  it('selects the named base modifier instead of a same-name override', () => {
    expect(compileString(
      'contract A { uint x; modifier m virtual { x = 2; _; } }'
      + ' contract C is A { modifier m override { x = 1; _; }'
      + ' function f() public A.m returns (uint) { return x; }'
      + ' function g() public m returns (uint) { return x; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('rejects a qualifier that does not name an inherited modifier implementation', () => {
    expect(() => compileString(
      'contract A { modifier m { _; } } contract C is A { function f() public Missing.m {} }',
      { solidityImportCompat: true },
    )).toThrow(/undefined modifier/i);
  });

  it('rejects an implemented modifier whose body has no placeholder', () => {
    expect(() => compileString(
      'contract C { modifier stop { require(true); } function f() public stop { revert(); } }',
      { solidityImportCompat: true },
    )).toThrow(/must contain at least one.*placeholder/i);
  });
});

describe('fallback and receive override validation', () => {
  const compat = { solidityImportCompat: true };

  it('requires override on inherited fallback and receive declarations', () => {
    expect(() => compileString(
      'contract A { fallback() external virtual {} }'
      + ' contract C is A { fallback() external {} }',
      compat,
    )).toThrow(/override/i);
    expect(() => compileString(
      'contract A { receive() external payable virtual {} }'
      + ' contract C is A { receive() external payable {} }',
      compat,
    )).toThrow(/override/i);
  });

  it('retains inherited special functions and accepts explicit overrides', () => {
    expect(compileString(
      'contract A { fallback() external virtual {} receive() external payable virtual {} }'
      + ' contract B is A {} contract C is B {'
      + ' fallback() external override {} receive() external payable override {} }',
      compat,
    ).contractName).toBe('C');
  });

  it('does not let fallback and receive override one another', () => {
    expect(() => compileString(
      'contract A { receive() external payable virtual {} }'
      + ' contract C is A { fallback() external override {} }',
      compat,
    )).toThrow(/override.*nothing|does not override/i);
    expect(() => compileString(
      'contract A { fallback() external virtual {} }'
      + ' contract C is A { receive() external payable override {} }',
      compat,
    )).toThrow(/override.*nothing|does not override/i);
  });
});

describe('base-constructor argument path validation', () => {
  const compat = { solidityImportCompat: true };

  it('rejects constructor arguments supplied by two inheritance branches', () => {
    expect(() => compileString(
      'contract A { constructor(uint x) {} }'
      + ' contract B is A(1) {} contract C is A(2) {} contract D is B, C {}',
      compat,
    )).toThrow(/Duplicate parent constructor invocation|given twice/i);
  });

  it('rejects a derived invocation duplicated by an intermediate base', () => {
    expect(() => compileString(
      'contract A { constructor(uint x) {} } contract B is A(1) {}'
      + ' contract C is B { constructor() A(2) {} }',
      compat,
    )).toThrow(/Duplicate parent constructor invocation|given twice/i);
  });

  it('accepts a diamond with one shared ancestor invocation', () => {
    expect(compileString(
      'contract Root { constructor(uint x) {} } contract A is Root(1) {}'
      + ' contract B is A {} contract C is A {} contract D is B, C {}',
      compat,
    ).contractName).toBe('D');
  });
});

describe('override list may name an interface base', () => {
  it('accepts override(Contract, Interface) when overriding a function declared in both', () => {
    const art = compileString(
      'interface ERC20 { function transfer(address to, uint amount) external returns (bool); }'
      + ' contract ERC21 { function transfer(address to, uint amount) virtual external returns (bool) { return false; } }'
      + ' contract Token is ERC21, ERC20 {'
      + '   function transfer(address to, uint amount) override(ERC21, ERC20) external returns (bool) { return false; } }',
      { solidityImportCompat: true },
    );
    expect(art.contractName).toBe('Token');
  });
});

// Solidity `arr.push() = value` (no-arg push returns a reference to the new element, then assigns it) is
// exactly `arr.push(value)` on BCH (push the element type's default, then set it == push the value).

describe('function overload resolution (inheritance + entry-point synthetic params)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('keeps both inherited overloads after inheritance flattening', () => {
    // The merge used to key functions by name only and drop the second same-name overload as a diamond dup.
    expect(cc('contract B { function f(uint a) internal pure returns (uint) { return a; }'
      + ' function f(uint a, uint b) internal pure returns (uint) { return a + b; } }'
      + ' contract C is B { function g() external { require(f(1) == 1); require(f(1, 2) == 3); } }')).toBe('C');
  });
  it('resolves overloads of public functions (synthetic returnOutputIdx param excluded from matching)', () => {
    // Public entry points carry a synthetic `__internal__returnOutputIdx` parameter; overload matching must
    // ignore it, otherwise the 1-arg overload appears to take 2 params and cannot be selected.
    expect(cc('contract C { function f(uint256 k) public pure returns (uint256) { return k; }'
      + ' function f(uint256 a, uint256 b) public pure returns (uint256) { return a + b; }'
      + ' function g(uint256 x) public pure returns (uint256) { return f(x); } }')).toBe('C');
  });
  it('resolves base-qualified overloaded calls Base.init(c)', () => {
    expect(cc('contract Base { uint x; function init(uint a, uint b) public { x = a; }'
      + ' function init(uint a) public { x = a; } }'
      + ' contract Child is Base { function ci(uint c) public { Base.init(c); } }')).toBe('Child');
  });
});

describe('imported/sibling contracts with their own inheritance are flattened', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('instantiates a sibling contract that inherits a base (base merged in, not an undefined interface)', () => {
    // Previously only the primary contract was flattened, so a used/instantiated sibling that `is Base` kept an
    // unresolved base -> "undefined interface". Now non-ancestor imported/sibling contracts are flattened too.
    expect(cc('contract Base { function isSet() public view returns (bool) { return false; } }'
      + ' contract Mid is Base { }'
      + ' contract Top { function make() external returns (Mid) { return new Mid(); } }')).toBe('Top');
  });
  it('still resolves the primary contract diamond inheritance (no double-merge of a shared ancestor)', () => {
    expect(cc('contract A { function a() public pure returns (uint256) { return 1; } }'
      + ' contract B is A { } contract C is A { }'
      + ' contract D is B, C { function f() external pure returns (uint256) { return a(); } }')).toBe('D');
  });
});

describe('virtual/override on modifiers and fallback', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts virtual on a modifier (with and without parens)', () => {
    expect(cc('contract C { int256 x; modifier m() virtual { x = 2; _; }'
      + ' function f() external m { require(true); } }')).toBe('C');
    expect(cc('contract C { int256 x; modifier m virtual { x = 2; _; }'
      + ' function f() external m { require(true); } }')).toBe('C');
  });
  it('accepts virtual before external on a fallback', () => {
    expect(cc('contract C { int256 x; fallback() virtual external { x = 1; } }')).toBe('C');
  });
});

describe('power operator result type is the base type (-1 ** e)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('int base ** uint exponent yields the int base type', () => {
    expect(cc('contract C { function f(uint256 e) external pure returns (int256) { return (-1) ** e; } }')).toBe('C');
    expect(cc('contract C { function f(int256 b, uint256 e) external pure returns (int256) { return b ** e; } }')).toBe('C');
  });
});

describe('constructor with a modifier invocation', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts a modifier on a constructor (no args)', () => {
    expect(cc('contract C { int256 x; modifier m { x = 1; _; } constructor() m { x = 2; }'
      + ' function f() external view returns (int256) { return x; } }')).toBe('C');
  });
  it('accepts a parent invocation followed by a modifier', () => {
    expect(cc('contract A { constructor(uint256 a) {} }'
      + ' contract C is A { int256 x; modifier m { x = 1; _; } constructor() A(1) m { x = 2; }'
      + ' function f() external view returns (int256) { return x; } }')).toBe('C');
  });
});

describe('abstract modifier and receive (no body)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts an abstract modifier declaration', () => {
    expect(cc('abstract contract C { modifier mod virtual;'
      + ' function h() external pure returns (uint256) { return 1; } }')).toBe('C');
  });
  it('accepts an abstract receive declaration', () => {
    expect(cc('abstract contract C { receive() external virtual payable;'
      + ' function h() external pure returns (uint256) { return 1; } }')).toBe('C');
  });
});

describe('super in a constructor (C3-linearized, matching solc)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('resolves a direct super.f() call in a constructor', () => {
    expect(cc('contract A { function f() public virtual pure returns (uint256) { return 1; } }'
      + ' contract B is A { uint256 d; constructor() { d = super.f(); }'
      + ' function f() public virtual override pure returns (uint256) { return 2; } }')).toBe('B');
  });
  it('resolves diamond super.f() in a constructor through the C3 MRO', () => {
    expect(cc('contract A { function f() public virtual pure returns (uint256) { return 1; } }'
      + ' contract B is A { function f() public virtual override pure returns (uint256) { return super.f() | 2; } }'
      + ' contract C is A { function f() public virtual override pure returns (uint256) { return super.f() | 4; } }'
      + ' contract D is B, C { uint256 d; constructor() { d = super.f() | 8; }'
      + ' function f() public override(B, C) pure returns (uint256) { return 15; } }')).toBe('D');
  });
});

describe('base function call eligibility', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;

  it('rejects calling an external base function through super', () => {
    expect(() => cc('contract A { function f() external virtual pure {} }'
      + ' contract B is A { function f() public override pure { super.f(); } }'))
      .toThrow(/Cannot call external base function 'super\.f'/);
  });

  it('rejects calling an unimplemented base function through super or its contract name', () => {
    const prefix = 'abstract contract I { function a() internal view virtual returns (uint256); }';
    expect(() => cc(prefix
      + ' abstract contract C is I { function f() public view returns (uint256) { return super.a(); } }'))
      .toThrow(/Cannot call unimplemented base function 'super\.a'/);
    expect(() => cc(prefix
      + ' abstract contract C is I { function f() public view returns (uint256) { return I.a(); } }'))
      .toThrow(/Cannot call unimplemented base function 'I\.a'/);
  });
});

describe('inherited modifier override and declaration namespace collisions', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('lets a child modifier override a parent virtual/abstract modifier of the same name', () => {
    expect(cc('abstract contract A { function f() public mod returns (bool r) { return true; } modifier mod virtual; }'
      + ' contract C is A { modifier mod override { if (false) _; } }')).toBe('C');
  });
  it('keeps same-name parent+child events when signatures differ (event overloading)', () => {
    expect(cc('contract A { event Deposit(); } contract B { event Deposit(address a); }'
      + ' contract C is A, B { event Deposit(address a, uint256 n);'
      + ' function d() external { emit Deposit(); emit Deposit(address(0)); emit Deposit(address(0), 1); require(true); } }'))
      .toBe('C');
  });

  it('deduplicates identical event declarations across inherited scopes', () => {
    const artifacts = compileStringMulti(`
      interface I { event PairCreated(address a, address b); }
      contract A { event PairCreated(address a, address b); }
      contract C is A, I {
        event PairCreated(address a, address b);
        function create() public { emit PairCreated(address(0), address(0)); require(true); }
      }
    `, { solidityImportCompat: true });
    const events = artifacts.C.events ?? [];
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe('PairCreated');
  });
  it('rejects same-name parent+child errors even when signatures differ', () => {
    expect(() => cc('contract A { error E(); } contract B is A { error E(uint256 n);'
      + ' function f(bool b) external { if (b) revert E(); revert E(1); } }')).toThrow();
  });
});

describe('discarded qualified base-function references', () => {
  it('accepts a base function value used only as a no-op expression', () => {
    const src = 'contract B { function readX() internal virtual returns (uint) { return 3; } }'
      + ' contract C is B { constructor() { B.readX; }'
      + ' function readX() internal pure override returns (uint) { return 3; } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
  });
  it('routes a current-contract-qualified call through direct internal dispatch', () => {
    const qualified = compileString(
      'contract C { function f() public pure returns(uint){return 3;}'
      + ' function g() public pure returns(uint){return C.f();} }',
      { solidityImportCompat: true },
    );
    const direct = compileString(
      'contract C { function f() public pure returns(uint){return 3;}'
      + ' function g() public pure returns(uint){return f();} }',
      { solidityImportCompat: true },
    );
    expect(qualified.bytecode).toBe(direct.bytecode);
  });
  it('resolves a qualified inherited overload when the child has the same function name', () => {
    const artifact = compileString(
      'contract LibraryLock { bool initialized; function initialize() internal { initialized = true; } }'
      + ' contract C is LibraryLock { function initialize(uint value) external {'
      + ' require(!initialized && value > 0); LibraryLock.initialize(); } }',
      { solidityImportCompat: true },
    );
    expect(artifact.contractName).toBe('C');
  });
  it('preserves every overload of an explicitly callable overridden base function', () => {
    const src = 'contract A { function f(uint a) public virtual {} function f(uint a,uint b) public virtual {} }'
      + ' contract B is A { function f(uint a) public override {}'
      + ' function f(uint a,uint b) public override {} }'
      + ' contract C is B { function g(uint a) public { A.f(a); }'
      + ' function g(uint a,uint b) public { A.f(a,b); } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
  });
  it('rewrites an explicitly qualified inherited helper used as a function value', () => {
    const src = 'abstract contract S { function value() internal pure returns(uint){return 7;} }'
      + ' contract C is S { function() internal pure returns(uint) f;'
      + ' constructor(){ f = S.value; } function get() public view returns(uint){return f();} }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('chained getters on computed bases + inherited using-for', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  const MM = 'contract MM { function calc(address m, uint o) public returns (uint) { return 0; } }'
    + ' contract Market { MM public marketMaker; }\n';

  it('resolves a getter chain on a state-ARRAY element (markets[0].g().m())', () => {
    expect(cc(`${MM}contract C { Market[] markets; function f() public returns (uint)`
      + ' { return markets[0].marketMaker().calc(address(this), 1); } }')).toBe('C');
  });

  it('resolves a getter chain on a struct FIELD (s.mkt.g().m())', () => {
    expect(cc(`${MM}struct S { Market mkt; } contract C { S s; function f() public returns (uint)`
      + ' { return s.mkt.marketMaker().calc(address(this), 1); } }')).toBe('C');
  });

});

describe('contract-qualified named struct constructors', () => {
  it('resolves Lib.S({field: value}) as a type constructor rather than a method call', () => {
    const artifacts = compileStringMulti('contract Lib { struct S { uint a; uint b; } }'
      + ' contract C { function f() public pure returns (uint) {'
      + ' Lib.S memory x = Lib.S({a: 2, b: 3}); return x.b; } }',
    { solidityImportCompat: true });
    expect(artifacts.C.contractName).toBe('C');
  });
});

describe('override lists name transitive interface bases', () => {
  it('accepts override(Parent) inherited through a sub-interface', () => {
    expect(compileString('interface A { function f() external pure returns (uint); }'
      + ' interface B is A {} contract C is B {'
      + ' function f() external pure override(A) returns (uint) { return 1; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('prunes dead internal methods that read msg.data (inherited OZ Context._msgData)', () => {
  const ok = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('compiles when an UNREACHABLE internal method reads msg.data (dropped, not codegen-ed)', () => {
    // The dead `_msgData` never runs; msg.data is only reconstructible at an entry point, so keeping it would
    // fail the whole compile with MsgDataInSubroutineError. It is pruned by name-conservative reachability.
    expect(ok('contract C { function _msgData() internal view returns (bytes memory) { return msg.data; }'
      + ' function f() public { require(true); } }')).toBe('C');
  });
  it('threads entry msg.data through a reachable internal reader', () => {
    expect(ok('contract C { function _live() internal view returns (bytes memory) { return msg.data; }'
      + ' function f(uint x) public returns (bytes memory) { x; return _live(); } }')).toBe('C');
  });
  it('forwards entry msg.data transitively through internal callers', () => {
    expect(ok('contract C { function leaf() internal view returns (bytes memory) { return msg.data; }'
      + ' function middle() internal view returns (bytes memory) { return leaf(); }'
      + ' function f(uint x) public returns (bytes memory) { x; return middle(); } }')).toBe('C');
  });
  it('keeps msg.data at a public entry point (not an internal subroutine)', () => {
    expect(ok('contract C { function f() public returns (bytes memory) { return msg.data; } }')).toBe('C');
  });
});

describe('using-for reverse overrides the native bytes reverse member', () => {
  it('dispatches calldata bytes.reverse() to the attached library method', () => {
    expect(compileString('library L { function reverse(bytes calldata b) internal pure'
      + ' returns (bytes1, bytes1) { return (b[1], b[0]); } } contract C { using L for bytes;'
      + ' function f(bytes calldata b) external pure returns (bytes1, bytes1) { return b.reverse(); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('C2-default: an inherited method accessing its OWN contract private mapping (FakeToken ERC20 _update)', () => {
  // Under C2-default `_balances` is a sorted collection, so a C2-write helper (`_upd`) is inlined into its entry
  // caller (InlineStoragePointerCalls). The inlined `_balances[a]=v` then lives in the caller's context, whose
  // inheritedFrom differs from `_balances`'s - the private-collection check wrongly rejected it. tagModifierStateAccess
  // now tags the inlined collection access with its defining contract; the check consults `node.fromModifier` (like
  // the scalar private-var check), so an inherited method's access to its own contract's private mapping compiles,
  // while a DERIVED contract directly touching a base's private mapping still fails.
  const base = (deriveBody: string): string => 'pragma solidity ^0.8.20;'
    + ' contract Base { mapping(address => uint256) private _balances;'
    + '   function _upd(address a, uint256 v) internal { uint256 cur = _balances[a]; _balances[a] = cur + v; } }'
    + ` contract Derived is Base { ${deriveBody} }`;
  it('compiles read+write of a base private mapping through an inherited helper (C2-default)', () => {
    expect(() => compileString(base('function mint(address a, uint256 v) public { _upd(a, v); }'),
      { solidityImportCompat: true })).not.toThrow();
  });
  it('still REJECTS a derived contract accessing a base private mapping directly (real visibility violation)', () => {
    expect(() => compileString('pragma solidity ^0.8.20; contract Base { mapping(address => uint256) private _balances; }'
      + ' contract Derived is Base { function poke(address a, uint256 v) public { _balances[a] = v; } }',
    { solidityImportCompat: true })).toThrow(/Cannot access private collection '_balances'/);
  });
});

describe('same-named PRIVATE state var in different ancestors is origin-mangled, not a collision (EACCToken EIP712+ERC20 _name)', () => {
  // Solidity allows the same private state-var name in different ancestors (separate slots) - OZ EIP712 `_name`
  // alongside ERC20 `_name`. SolidCash flattens all ancestors, so it origin-mangles each colliding PRIVATE var
  // (declaration + own-contract references) before the merge. A same-named private var referenced by its own
  // contract's methods keeps working (each resolves to its own mangled slot).
  it('compiles two bases each with a private _name that its own method reads', () => {
    const src = 'pragma solidity ^0.8.20;'
      + ' contract A { string private _name; function aName() public view returns (string memory) { return _name; } }'
      + ' contract B { bytes32 private _name; function bName() public view returns (bytes32) { return _name; } }'
      + ' contract C is A, B { }';
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  });
  it('compiles the diamond-via-intermediate shape (ERC20Permit is ERC20, EIP712 both with _name)', () => {
    const src = 'pragma solidity ^0.8.20;'
      + ' contract ERC20 { string private _name; function n() public view returns (string memory) { return _name; } }'
      + ' contract EIP712 { bytes32 private _name; function h() public view returns (bytes32) { return _name; } }'
      + ' contract Permit is ERC20, EIP712 { } contract Tok is ERC20, Permit { }';
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  });
});

describe('override(Interface) survives flattening: a parent interface base carries up (EACCToken ERC20Permit.nonces)', () => {
  // `override(IInterface)` on an intermediate contract that `is IInterface` must stay valid after a derived
  // contract flattens the intermediate. expandContract now carries a merged parent's interface `implements` up
  // into the child, so the interface base is still found (was "'I' is not a base contract that declares it").
  it('compiles override(I) on an intermediate contract, flattened into a derived one', () => {
    const src = 'pragma solidity ^0.8.20; interface I { function f() external view returns (uint256); }'
      + ' contract Mid is I { function f() public view virtual override(I) returns (uint256) { return 1; } }'
      + ' contract Derived is Mid { }';
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  });
  it('compiles override(I, Base) multi-base after flattening', () => {
    const src = 'pragma solidity ^0.8.20; interface I { function f() external view returns (uint256); }'
      + ' contract Base { function f() public view virtual returns (uint256) { return 0; } }'
      + ' contract Mid is Base, I { function f() public view virtual override(I, Base) returns (uint256) { return 1; } }'
      + ' contract Derived is Mid { }';
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  });
});

describe('inherited `using L for T` resolves in a derived contract (OZ ERC20 SafeMath _mint/_burn)', () => {
  // A parent contract binds `using SafeMath for uint256` and its `_mint` does `_totalSupply.add(amt)` on a PRIVATE
  // inherited scalar. When the derived contract calls the inherited helper, (1) the binding must propagate so the
  // `.add()` member call resolves, and (2) synthesizing the receiver identifier while probing its type must carry
  // the inlined-modifier origin so the private-var visibility check is not falsely tripped.
  const base = 'library SM { function add(uint256 a, uint256 b) internal pure returns (uint256) { return a + b; } }'
    + ' contract ERC20Base { using SM for uint256; uint256 private _totalSupply; mapping(address => uint256) private'
    + ' _balances; function _mint(address a, uint256 amt) internal virtual { _totalSupply = _totalSupply.add(amt);'
    + ' _balances[a] = _balances[a].add(amt); } }';
  const resolver = (p: string): { source: string; id: string } | undefined =>
    (p === './B.sol' ? { source: base, id: '/B.sol' } : undefined);
  const ok = (src: string): void => {
    expect(() => compileString(src, { importResolver: resolver, rootFileId: '/main.sol', solidityImportCompat: true }))
      .not.toThrow();
  };
  it('derived call to inherited _mint (private scalar + C2 mapping via SafeMath) compiles', () => {
    ok('import {ERC20Base} from "./B.sol"; contract C is ERC20Base {'
      + ' function mint(address a, uint256 amt) public { _mint(a, amt); } }');
  });
  it('inherited binding is usable on the derived contract\'s own local too', () => {
    ok('import {ERC20Base} from "./B.sol"; contract C is ERC20Base {'
      + ' function f(uint256 a) public pure returns (uint256) { uint256 x = 1; return x.add(a); } }');
  });
});

describe('return f(); void tail form + base-as-primary derived-sibling flatten (SushiToken/MasterChef)', () => {
  const ok = (src: string): void => {
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  };
  // `return f();` in a VOID function where f is itself void (OZ/COMP `delegate` returns `_delegate(..)`).
  it('lowers return <void-call>() to <call>; return;', () => {
    ok('contract T { mapping(address => address) internal _d;'
      + ' function delegate(address x) external { return _delegate(msg.sender, x); }'
      + ' function _delegate(address a, address b) internal { _d[a] = b; } }');
  });
  it('still returns a value normally (value tail unaffected)', () => {
    ok('contract T { function outer() external returns (uint256) { return helper(); }'
      + ' function helper() internal returns (uint256) { return 5; } }');
  });
  // A derived contract inheriting a BASE with a constructor invoked in the inheritance list. When compileFileMulti
  // compiles the base as a primary, the derived sibling flattens and must resolve the primary as its parent.
  it('resolves a derived sibling whose parent invocation names the primary base', () => {
    const base = 'pragma solidity ^0.8.0;'
      + ' abstract contract Context { function _msgSender() internal view virtual returns (address) { return msg.sender; } }'
      + ' interface IERC20 { function totalSupply() external view returns (uint256); }'
      + ' contract Ownable is Context { address _o; constructor() { _o = _msgSender(); } }'
      + ' contract ERC20 is Context, IERC20 { string public nom; uint256 _ts;'
      + ' constructor(string memory n, string memory s) { nom = n; }'
      + ' function totalSupply() external view override returns (uint256) { return _ts; } }';
    const resolver = (p: string): { source: string; id: string } | undefined =>
      (p === './B.sol' ? { source: base, id: '/B.sol' } : undefined);
    expect(() => compileString(
      'import {ERC20, Ownable} from "./B.sol"; contract Tok is ERC20("Sushi", "SUSHI"), Ownable {'
      + ' function f() public { require(true); } }',
      { importResolver: resolver, rootFileId: '/main.sol', solidityImportCompat: true },
    )).not.toThrow();
  });
});

describe('inherited-private access via assignment-as-expression (BentoBoxV1 DOMAIN_SEPARATOR ctor)', () => {
  // MasterContractManager's ctor does `_DOMAIN_SEPARATOR = _calc(DOMAIN_SEPARATOR_CHAIN_ID = chainId)` - an
  // assignment-as-expression on its OWN private immutable. Hoisting `x = v` before the call leaves a fresh read
  // `x` in the argument; that read must carry the ctor's origin tag or the flattened child trips the
  // inherited-private-access check. The write keeps its tag; the read now copies it.
  const opts = { solidityImportCompat: true };
  const parent = 'contract Parent { uint256 private immutable X; uint256 private Y;'
    + ' constructor() public { Y = id(X = 5); }'
    + ' function id(uint256 v) internal pure returns (uint256) { return v; } }';
  it('compiles an ancestor ctor assigning its own private var as a call argument', () => {
    expect(() => compileString(`pragma solidity ^0.8.0; ${parent}`
      + ' contract Child is Parent { constructor() public Parent() {} function f() public {} }', opts)).not.toThrow();
  });
  it('compiles the parenthesized assignment-as-expression form too', () => {
    expect(() => compileString('pragma solidity ^0.8.0;'
      + ' contract P { uint256 private immutable X; uint256 private Y; constructor() public { Y = (X = 5); } }'
      + ' contract C is P { constructor() public P() {} function f() public {} }', opts)).not.toThrow();
  });
});

describe('void storage-pointer library fn on a mapping/array element (BentoBox BoringRebase shape)', () => {
  // `L.f(m[k])` / `m[k].f()` where L.f takes a `Struct storage` pointer and mutates it: InlineStoragePointerCalls
  // lowers the element arg to a read-modify-write (`S t = m[k]; <body>; m[k] = t;`) instead of substituting the
  // element into the mis-built AssignNode lvalue (was: "Undefined reference to symbol <param>"). The using-for
  // spelling resolves via RedesugarImportedUsingForCalls (struct-valued mapping element receiver -> L.f(m[k], ..)).
  const ok = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  const LIB = 'struct Total { int base; int elastic; }'
    + ' library L { function addBase(Total storage t, int x) { t.base += x; }'
    + ' function setBoth(Total storage t, int a, int b) { t.base = a; t.elastic = b; } }';
  it('direct call L.addBase(this.m[k], x) compiles', () => {
    expect(ok(`${LIB} contract C() { mapping(int => Total) m;`
      + ' function f(int k, int x) { L.addBase(this.m[k], x); require(true); } }')).toBe('C');
  });
  it('using-for m[k].addBase(x) method spelling compiles', () => {
    expect(ok(`${LIB} contract C() { using L for Total; mapping(int => Total) m;`
      + ' function f(int k, int x) { this.m[k].addBase(x); require(true); } }')).toBe('C');
  });
  it('storage-pointer fn on a state-ARRAY element arr[i] compiles', () => {
    expect(ok(`${LIB} contract C() { Total[] arr;`
      + ' function f(int i, int x) { L.addBase(this.arr[i], x); require(true); } }')).toBe('C');
  });
  it('a bare state-var struct arg still aliases by name (no RMW regression)', () => {
    expect(ok(`${LIB} contract C() { Total tot;`
      + ' function f(int x) { L.addBase(this.tot, x); require(true); } }')).toBe('C');
  });
});

describe('interface fallback declarations and abstract compliance', () => {
  const options = { solidityImportCompat: true };

  it('accepts an interface fallback while an abstract implementer defers remaining obligations', () => {
    expect(compileString('interface I { function f() external; function g() external; fallback() external; }'
      + ' abstract contract C is I { function f() public override {} }', options).contractName).toBe('C');
  });

  it('requires a concrete implementation of an inherited interface fallback', () => {
    expect(() => compileString('interface A { fallback() external; } interface I is A {}'
      + ' contract C is I { function f() public { require(true); } }', options))
      .toThrow(/does not implement fallback/);
  });

  it('accepts a concrete implementation of an inherited interface fallback', () => {
    expect(compileString('interface A { fallback() external; } interface I is A {}'
      + ' contract C is I { fallback() external { require(true); } }', options).contractName).toBe('C');
  });
});

describe('base-constructor assignment arguments', () => {
  it('evaluates contract-qualified state writes before substituting the assigned argument value', () => {
    expect(compileString(
      'contract B { uint immutable x; constructor(uint v) { x = v; } }'
      + ' contract C is B(C.y = 3) { uint immutable y;'
      + ' function f() public view returns (uint) { return x + y; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
    expect(compileString(
      'contract A { uint immutable x = x + 1; uint immutable y = x += 2;'
      + ' constructor(uint) m(x += 16) m(x += 32) { x += 64; x += 128; }'
      + ' modifier m(uint) { _; } function get() public view returns (uint) { return x; } }'
      + ' contract B is A(A.x += 8) { constructor(uint) {} }'
      + ' contract C is B { constructor() B(x += 4) {} }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('inherited state-struct field writes', () => {
  it('rebuilds an inherited struct whose type was unavailable while parsing the derived body', () => {
    expect(compileString('struct S { uint256 x; address a; bool b; } contract A { S public s; }'
      + ' contract C is A { function init() public { s.x = 7; s.a = address(0x1234); s.b = true; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('external self-calls through a base-contract cast', () => {
  it('uses the most-derived override, matching Solidity virtual dispatch', () => {
    expect(compileString('contract A { function f(uint256[] calldata a) external virtual returns (uint256) {'
      + ' return a[0]; } } contract B is A {'
      + ' function f(uint256[] memory a) public override returns (uint256) { return a[1]; }'
      + ' function g() public returns (uint256) { uint256[] memory m = new uint256[](2);'
      + ' m[0] = 42; m[1] = 23; return A(this).f(m); } }',
    { solidityImportCompat: true }).contractName).toBe('B');
  });
});

describe('constructor argument literal coercion', () => {
  it('contextually converts a string literal to a fixed-bytes constructor parameter', () => {
    expect(compileString('contract D { bytes3 value; constructor(bytes3 v) { value = v; } }'
      + ' contract C { D d; constructor() { d = new D("abc"); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('private base state-variable shadowing', () => {
  it('keeps the inaccessible base slot distinct from a child variable with the same name', () => {
    expect(compileString('contract A { uint private value; } contract B is A { uint value;'
      + ' function f() public { value = 1; } }',
    { solidityImportCompat: true }).contractName).toBe('B');
  });
});

describe('public variable explicit function override', () => {
  it('uses the generated getter to resolve sibling virtual functions', () => {
    expect(compileString('contract A { function foo() external virtual view returns(uint) { return 5; } }'
      + ' contract B { function foo() external virtual view returns(uint) { return 6; } }'
      + ' contract X is A, B { uint public override(A, B) foo; }',
    { solidityImportCompat: true }).contractName).toBe('X');
  });
});

describe('public getters implementing abstract functions', () => {
  it('accepts a public constant as a zero-argument abstract getter implementation', () => {
    expect(compileString('abstract contract A { function value() external pure virtual returns (uint); }'
      + ' contract C is A { uint public constant override value = 7; }',
    { solidityImportCompat: true }).abi.map((entry) => entry.name)).toContain('value');
  });

  it('accepts a public mapping-to-struct getter with matching tuple returns', () => {
    expect(compileString('abstract contract A { struct S { uint x; string y; }'
      + ' function data(address key) external virtual returns (uint, string memory); }'
      + ' contract C is A { mapping(address => S) public override data; }',
    { solidityImportCompat: true }).abi.map((entry) => entry.name)).toContain('data');
  });

  it('still rejects a genuinely unimplemented abstract function', () => {
    expect(() => compileString('abstract contract A { function f() public virtual; } contract C is A {}',
      { solidityImportCompat: true })).toThrow(/must implement abstract function/);
  });

  it('does not let a view state getter weaken an abstract pure function', () => {
    expect(() => compileString('abstract contract A {'
      + ' function value() external pure virtual returns (uint); }'
      + ' contract C is A { uint public override value; }',
    { solidityImportCompat: true })).toThrow();
  });
});

describe('public getter interface override lists', () => {
  const prefix = 'interface A { function foo() external returns (uint); }'
    + ' interface B { function foo() external returns (uint); }';

  it('requires every parallel interface provider in an explicit override list', () => {
    expect(() => compileString(prefix
      + ' contract C is A, B { uint public override(A) foo; }',
    { solidityImportCompat: true })).toThrow(/must specify bases.*A.*B|must specify bases.*B.*A/);
  });

  it('accepts a complete parallel interface override list', () => {
    expect(compileString(prefix
      + ' contract C is A, B { uint public override(A, B) foo; }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('lets a derived interface provider dominate its ancestor', () => {
    expect(compileString('interface A { function foo() external returns (uint); }'
      + ' interface B is A { function foo() external returns (uint); }'
      + ' contract C is B { uint public override(B) foo; }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('bare inherited dynamic-array mutations', () => {
  it('classifies push and pop as state-array operations after inheritance expansion', () => {
    expect(compileString('contract A { uint[] public values; }'
      + ' contract C is A { function f() public { values.push(1); values.pop(); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('private helpers in a directly compiled library', () => {
  it('retains an inline helper referenced by a library-scoped using-for binding', () => {
    const src = 'library L { using {L.bump} for uint;'
      + ' function bump(uint x) private pure returns (uint) { return x + 1; }'
      + ' function f() public pure returns (uint) { uint x = 1; return x.bump(); } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('L');
  });
});

describe('constructor external-read promotion', () => {
  it('does not replace a zero-argument void call with a deploy-input getter witness', () => {
    const src = 'contract Child { event E(); function f() public { emit E(); } }'
      + ' contract Parent { Child child; constructor() { child = new Child(); child.f(); } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('Parent');
  });

  it('captures a contract-typed state receiver after assigning it from a constructor parameter', () => {
    const src = 'contract Peer { function f() public pure {} }'
      + ' contract Parent { Peer peer; constructor(Peer other) { peer = other; other.f(); peer.f(); } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('Parent');
  });
});

describe('flattened storage-pointer constructor arguments', () => {
  it('prepends the mapping-entry key when substituting an inherited constructor parameter', () => {
    expect(compileString(
      `struct S { mapping(uint => uint) m; }
       abstract contract A { constructor(S storage p) { p.m[5] = 16; } }
       contract C is A { mapping(uint => S) data; constructor() A(data[1]) {}
       function f() public { require(data[1].m[5] == 16); } }`,
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('base-contract-qualified inherited state', () => {
  it('resolves a direct base qualifier to the inherited scalar state slot', () => {
    expect(compileString('contract Base { uint a; constructor(uint x) { a = x; } }'
      + ' contract C is Base { constructor() Base(2) { require(Base.a == a); } }',
    { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });

  it('rejects qualifying an inherited slot with the child rather than its declaring base', () => {
    expect(() => compileString('contract Base { uint internal a; }'
      + ' contract C is Base { function f() public view returns (uint) { return C.a; } }',
    { solidityImportCompat: true })).toThrow();
  });
});

describe('inherited constructor function-pointer arguments', () => {
  it('substitutes a constructor parameter used as the callee', () => {
    expect(compileString('abstract contract B { uint immutable x;'
      + ' constructor(function() internal returns (uint) fp) { x = fp(); } }'
      + ' contract C is B(C.f) { function f() internal view returns (uint) { return x + 2; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('retains the direct-constructor-only rule for immutable writes in the referenced helper', () => {
    expect(() => compileString('abstract contract B { uint immutable x;'
      + ' constructor(function() internal returns (uint) fp) { x = fp(); } }'
      + ' contract C is B(C.f) { function f() internal returns (uint) { return x = 2; } }',
    { solidityImportCompat: true })).toThrow(/immutable/i);
  });
});

describe('stateful child deployment from a constructor', () => {
  it('includes constructor bodies in parent covenant-statefulness detection', () => {
    const artifact = compileString(
      'contract Child { uint public value = 42; }'
      + ' contract C { constructor() { new Child(); } }',
      { solidityImportCompat: true },
    );
    expect(artifact.stateLayout).toBeDefined();
  });
});

describe('public state-variable getter override visibility', () => {
  it('allows external functions and rejects internal/private functions', () => {
    expect(compileString(
      'abstract contract A { function value() external virtual returns (uint); }'
      + ' contract C is A { uint public override value = 1; }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
    expect(() => compileString(
      'abstract contract A { function value() internal virtual returns (uint); }'
      + ' contract C is A { uint public override value = 1; }',
      { solidityImportCompat: true },
    )).toThrow(/only override an external function/);
  });
});

describe('parent-constructor argument substitution inside assertions', () => {
  it('replaces inherited constructor parameters throughout assert expressions', () => {
    expect(compileString(
      'contract A { int x; constructor(int a) { x = a; } }'
      + ' contract B is A { constructor(int b) A(b) { assert(x == b); } }'
      + ' contract C is B { constructor(int c) B(-c) { assert(x == -c); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('inherited declaration namespace', () => {
  it('rejects cross-kind names introduced by inheritance', () => {
    const invalid = [
      'contract A { function dup() public {} } contract B { event dup(); } contract C is A, B {}',
      'contract A { event dup(); } contract B { function dup() public {} } contract C is A, B {}',
      'contract A { uint public x; } contract C is A { function x() public returns (uint) {} }',
      'contract A { function mod(uint a) public {} } contract B is A { modifier mod(uint a) { _; } }',
      'contract A { modifier mod(uint a) { _; } } contract B is A { function mod(uint a) public {} }',
      'contract A { modifier mod(uint a) { _; } } contract B is A { uint public mod; }',
      'contract A { bool ok; } contract B { function ok() public returns (bool) { return true; } }'
      + ' contract C is A, B {}',
    ];
    for (const source of invalid) {
      expect(() => compileString(source, { solidityImportCompat: true }))
        .toThrow(/already defined in parent contract/);
    }
  });

  it('does not expose a private ancestor variable in the derived namespace', () => {
    expect(compileString(
      'contract A { uint private x; } contract B is A { function x() public pure returns (uint) { return 1; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('B');
  });

  it('retains inherited overloads beside an overriding getter and inherited internal functions beside a variable', () => {
    expect(compileString(
      'contract A { function foo() external virtual returns (uint) { return 1; }'
      + ' function foo(uint) external virtual returns (uint) { return 2; } }'
      + ' contract B is A { uint public override foo; }',
      { solidityImportCompat: true },
    ).contractName).toBe('B');
    expect(compileString(
      'contract A { function foo(uint) internal virtual pure returns (uint) { return 1; } }'
      + ' contract B is A { uint public foo; }',
      { solidityImportCompat: true },
    ).contractName).toBe('B');
  });
});

describe('override state mutability', () => {
  it('rejects less restrictive overrides and all payable transitions', () => {
    const invalid = [
      'contract A { function f() public pure virtual {} } contract B is A { function f() public view override {} }',
      'contract A { function f() public view virtual {} } contract B is A { function f() public override {} }',
      'contract A { function f() public payable virtual {} } contract B is A { function f() public override {} }',
      'contract A { function f() public virtual {} } contract B is A { function f() public payable override {} }',
    ];
    for (const source of invalid) {
      expect(() => compileString(source, { solidityImportCompat: true }))
        .toThrow(/changes state mutability/);
    }
  });

  it('accepts equal and stricter nonpayable overrides', () => {
    expect(compileString(
      'contract A { function f() public virtual {} function g() public view virtual {} }'
      + ' contract B is A { function f() public pure override {} function g() public pure override {} }',
      { solidityImportCompat: true },
    ).contractName).toBe('B');
  });
});

describe('override base-list uniqueness', () => {
  it('rejects duplicate bases on functions and public state variables', () => {
    const invalid = [
      'abstract contract A { function f() internal virtual returns (uint); }'
      + ' abstract contract B is A { function f() internal virtual override(A, A) returns (uint); }',
      'interface A { function foo() external view returns (uint); }'
      + ' contract B is A { uint public override(A, A) foo; }',
    ];
    for (const source of invalid) {
      expect(() => compileString(source, { solidityImportCompat: true }))
        .toThrow(/Duplicate contract 'A' in override list/);
    }
  });

  it('accepts a unique multi-base override list', () => {
    expect(compileString(
      'abstract contract A { function f() public virtual; }'
      + ' abstract contract B { function f() public virtual; }'
      + ' contract C is A, B { function f() public override(A, B) {} }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('private virtual functions', () => {
  it('rejects virtual on a private function', () => {
    expect(() => compileString(
      'abstract contract A { function f() private virtual returns (uint); }',
      { solidityImportCompat: true },
    )).toThrow(/'private' functions cannot be 'virtual'/);
  });

  it('accepts virtual on an internal function', () => {
    expect(compileString(
      'abstract contract A { function f() internal virtual returns (uint); }',
      { solidityImportCompat: true },
    ).contractName).toBe('A');
  });
});

describe('override lists on root contracts', () => {
  it('rejects a library named as an override base', () => {
    expect(() => compileString(
      'library L {} contract C { function f() public override(L) {} }',
      { solidityImportCompat: true },
    )).toThrow(/'L' is not a base contract/);
  });

  it('retains ordinary root contracts without override lists', () => {
    expect(compileString(
      'contract C { function f() public pure returns (uint) { return 1; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('modifier override validation', () => {
  it('requires an actual virtual base modifier with the same signature', () => {
    const invalid = [
      'contract A { modifier m() virtual { _; } }'
      + ' contract B is A { modifier m() { _; } }',
      'contract A { modifier m() { _; } }'
      + ' contract B is A { modifier m() override { _; } }',
      'contract A {} contract B is A { modifier m() override { _; } }',
      'contract A { modifier m(uint x) virtual { _; } }'
      + ' contract B is A { modifier m() override { _; } }',
    ];
    for (const source of invalid) {
      expect(() => compileString(source, { solidityImportCompat: true })).toThrow();
    }
  });

  it('accepts an explicit same-signature override of a virtual modifier', () => {
    expect(compileString(
      'contract A { modifier m(uint x) virtual { require(x > 0); _; } }'
      + ' contract B is A { modifier m(uint x) override { require(x < 10); _; }'
      + ' function f(uint x) public m(x) { require(true); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('B');
  });
});

describe('virtual function declaration rules', () => {
  it('requires virtual on an unimplemented contract function', () => {
    expect(() => compileString(
      'abstract contract A { function f() external; }',
      { solidityImportCompat: true },
    )).toThrow(/without implementation must be marked virtual/);
  });

  it('rejects virtual library functions', () => {
    expect(() => compileString(
      'library L { function f() internal pure virtual returns (uint) { return 0; } }',
      { solidityImportCompat: true },
    )).toThrow(/Library functions cannot be 'virtual'/);
  });

  it('rejects custom modifiers on unimplemented functions', () => {
    expect(() => compileString(
      'abstract contract A { modifier onlyOwner { _; }'
      + ' function f() public virtual onlyOwner; }',
      { solidityImportCompat: true },
    )).toThrow(/without implementation cannot have modifiers/);
  });
});

describe('unimplemented overrides of implemented functions', () => {
  it('rejects an abstract override when any overridden base has an implementation', () => {
    const invalid = [
      'contract A { function f() public virtual {} }'
      + ' abstract contract B is A { function f() public virtual override; }',
      'abstract contract A { function f() external virtual; }'
      + ' abstract contract B { function f() external virtual {} }'
      + ' abstract contract C is A, B { function f() external virtual override(A, B); }',
      'abstract contract A { function f() external virtual; }'
      + ' abstract contract B { function f() external virtual {} }'
      + ' abstract contract C is B, A { function f() external virtual override(A, B); }',
    ];
    for (const source of invalid) {
      expect(() => compileString(source, { solidityImportCompat: true }))
        .toThrow(/cannot override implemented function/);
    }
  });

  it('accepts an abstract override when every overridden base is abstract', () => {
    expect(compileString(
      'abstract contract A { function f() public virtual; }'
      + ' abstract contract B { function f() public virtual; }'
      + ' abstract contract C is A, B { function f() public virtual override(A, B); }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('bare override on root declarations', () => {
  it('rejects functions, modifiers, and fallback without a base declaration', () => {
    const invalid = [
      'contract C { function f() public override {} }',
      'contract C { modifier m() override { _; } }',
      'contract C { fallback() external override {} }',
    ];
    for (const source of invalid) {
      expect(() => compileString(source, { solidityImportCompat: true }))
        .toThrow(/override specified but does not override anything/);
    }
  });

  it('accepts getter override markers without a concrete base declaration', () => {
    expect(compileString('contract C { uint public override value; mapping(address => uint) public override values; }',
      { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('accepts the same declarations without override', () => {
    expect(compileString(
      'contract C { uint public value; modifier m() { _; }'
      + ' function f() public m {} fallback() external {} }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('public-getter override base lists', () => {
  it('rejects a named base which is not inherited', () => {
    expect(() => compileString(
      'interface A { function foo() external view returns (uint); } interface B {}'
      + ' contract C is A { uint public override(A, B) foo; }',
      { solidityImportCompat: true },
    )).toThrow(/'B' is not a base contract/);
  });

  it('accepts a direct interface named in a getter override list', () => {
    expect(compileString(
      'interface A { function foo() external view returns (uint); }'
      + ' contract C is A { uint public override(A) foo; }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('public-getter override signatures', () => {
  it('requires override only for an ABI-matching inherited function', () => {
    expect(() => compileString(
      'contract A { function foo() internal virtual view returns (uint) { return 1; } }'
      + ' contract C is A { uint public foo; }',
      { solidityImportCompat: true },
    )).toThrow(/Use 'override'/);
    expect(compileString(
      'contract A { function foo(uint) internal virtual pure returns (uint) { return 1; } }'
      + ' contract C is A { uint public foo; }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('rejects getter parameter and return shapes which match no base overload', () => {
    expect(() => compileString(
      'contract A { function balanceOf(uint) external virtual view returns (uint) { return 1; } }'
      + ' contract C is A { mapping(address => uint) public override balanceOf; }',
      { solidityImportCompat: true },
    )).toThrow(/does not override anything/);
    expect(() => compileString(
      'contract A { function foo() external virtual view returns (address) { return address(0); } }'
      + ' contract C is A { uint public override foo; }',
      { solidityImportCompat: true },
    )).toThrow(/does not match the overridden function return type/);
  });

  it('requires every undominated concrete provider in a multi-base override list', () => {
    expect(() => compileString(
      'contract A { function foo() external virtual view returns (uint) { return 1; } }'
      + ' contract B { function foo() external virtual view returns (uint) { return 2; } }'
      + ' contract C is A, B { uint public override foo; }',
      { solidityImportCompat: true },
    )).toThrow(/must specify bases/);
    expect(compileString(
      'contract A { function foo() external virtual view returns (uint) { return 1; } }'
      + ' contract B is A { function foo() external virtual override view returns (uint) { return 2; } }'
      + ' contract C { function foo() external virtual view returns (uint) { return 3; } }'
      + ' contract D is B, C { uint public override(B, C) foo; }',
      { solidityImportCompat: true },
    ).contractName).toBe('D');
  });
});

describe('function override provider lists', () => {
  it('rejects a named ancestor which does not declare the exact overload', () => {
    expect(() => compileString(
      'abstract contract A { function f(uint) internal virtual; }'
      + ' abstract contract B { function f() internal virtual; }'
      + ' abstract contract C is A, B { function f() internal virtual override(A, B); }',
      { solidityImportCompat: true },
    )).toThrow(/'A' is not a base contract that declares it/);
  });

  it('requires all undominated concrete providers and accepts a complete list', () => {
    const bases = 'abstract contract A { function f() internal virtual; }'
      + ' abstract contract B { function f() internal virtual; }';
    expect(() => compileString(
      `${bases} abstract contract C is A, B { function f() internal virtual override(A); }`,
      { solidityImportCompat: true },
    )).toThrow(/must specify bases/);
    expect(compileString(
      `${bases} abstract contract C is A, B { function f() internal virtual override(A, B); }`,
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('direct-base effective function origins', () => {
  it('uses the descendant implementation when one direct base dominates another', () => {
    expect(compileString(
      'contract A { function f() public pure virtual {} }'
      + ' contract B is A { function f() public pure virtual override {} }'
      + ' contract C is A, B {}',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('accepts an explicit resolution and an unchanged same-origin diamond', () => {
    expect(compileString(
      'contract A { function f() public pure virtual {} }'
      + ' contract B is A { function f() public pure virtual override {} }'
      + ' contract C is A, B { function f() public pure override(A, B) {} }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
    expect(compileString(
      'contract A { function f() public pure virtual {} }'
      + ' contract B is A {} contract C is A {} contract D is B, C {}',
      { solidityImportCompat: true },
    ).contractName).toBe('D');
    expect(compileString(
      'abstract contract A { function f() public pure virtual; }'
      + ' contract B is A { function f() public pure virtual override {} }'
      + ' contract C is A, B {}',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
    expect(compileString(
      'abstract contract A { function f() public virtual; }'
      + ' abstract contract B is A { function f() public virtual override; }'
      + ' abstract contract C is A {} abstract contract D is B, C {}',
      { solidityImportCompat: true },
    ).contractName).toBe('D');
  });
});

describe('inherited private function visibility', () => {
  it('rejects bare and explicitly qualified access from a derived source body', () => {
    for (const call of ['f()', 'Base.f()']) {
      expect(() => compileString(
        'contract Base { function f() private {} }'
          + ` contract Derived is Base { function g() public { ${call}; } }`,
        { solidityImportCompat: true },
      )).toThrow(/Undefined reference to symbol/);
    }
  });

  it('retains private calls in inherited base bodies and same-named derived functions', () => {
    expect(compileString(
      'contract Base { function f() private {} function g() public { f(); } }'
        + ' contract Derived is Base { function h() private {} function i() public { h(); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('Derived');
  });
});
