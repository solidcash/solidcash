import { describe, it, expect } from 'vitest';
import { computeErc7201SlotNumber } from '@solidcash/utils';
import { compileString, compileStringMulti } from '../src/index.js';

// Compile-level regression guards for solc-corpus gap fixes (see examples/solidity-corpus/PROGRESS.md).

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

describe('Solidity function-context restrictions', () => {
  const cc = (src: string): string =>
    compileString(src, { solidityImportCompat: true }).contractName;

  it('rejects a function with the same name as its contract', () => {
    expect(() => cc('contract A { function A() public {} }'))
      .toThrow(/cannot have the same name as its contract/i);
  });

  it('rejects internal function-pointer parameters on concrete constructors', () => {
    expect(() => cc('contract A { constructor(function() internal callback) {} }'))
      .toThrow(/internal function type is not allowed in a concrete constructor/i);
  });

  it('allows an internal function-pointer parameter on an abstract constructor', () => {
    expect(cc('abstract contract A { constructor(function() internal callback) {} }')).toBe('A');
  });

  it('rejects msg.data inside receive while retaining it in fallback', () => {
    expect(() => cc('contract C { receive() external payable { msg.data; } }'))
      .toThrow(/msg\.data.*cannot be used inside a receive/i);
    expect(cc('contract C { fallback() external { msg.data; } }')).toBe('C');
  });
});

describe('modifier declaration source validation', () => {
  const cc = (src: string): string =>
    compileString(src, { solidityImportCompat: true }).contractName;

  it('rejects duplicate data locations on modifier parameters', () => {
    expect(() => cc('contract C { modifier m(string storage memory value) { _; } }'))
      .toThrow(/multiple data locations specified/i);
  });

  it('requires a data location for reference-type modifier parameters', () => {
    expect(() => cc('contract C { modifier m(uint[] values) { _; } }'))
      .toThrow(/data location must be.*but none was given/i);
  });

  it('rejects return arguments in modifier bodies while retaining bare return', () => {
    expect(() => cc('contract C { modifier m() { _; return 7; } }'))
      .toThrow(/return arguments are not allowed in modifiers/i);
    expect(cc('contract C { modifier m() { _; return; } function f() public m {} }')).toBe('C');
  });
});

describe('transient and storage declaration placement', () => {
  const cc = (src: string): string =>
    compileString(src, { solidityImportCompat: true }).contractName;

  it('rejects an explicit storage location on state variables', () => {
    expect(() => cc('contract C { uint storage value; }'))
      .toThrow(/state variables are implicitly storage/i);
    expect(() => cc('contract C { uint transient storage value; }'))
      .toThrow(/state variables are implicitly storage/i);
  });

  it('rejects transient on local variables', () => {
    expect(() => cc('contract C { function f() public pure { uint transient value = 0; } }'))
      .toThrow(/transient data location is only valid on state variables/i);
  });

  it('rejects constant, immutable, and initialized transient state', () => {
    expect(() => cc('contract C { uint constant transient VALUE = 0; }'))
      .toThrow(/transient cannot be used with constant or immutable/i);
    expect(() => cc('contract C { uint immutable transient value; }'))
      .toThrow(/transient cannot be used with constant or immutable/i);
    expect(() => cc('contract C { uint transient value = 1; }'))
      .toThrow(/initialization of transient state variables is not supported/i);
  });

  it('retains uninitialized value-type transient state', () => {
    expect(cc('contract C { uint transient value; function f() public { value = 1; } }')).toBe('C');
  });
});

describe('function-type state declaration compatibility', () => {
  const cc = (src: string): string =>
    compileString(src, { solidityImportCompat: true }).contractName;

  it('allows payable only on external function types', () => {
    expect(() => cc('contract C { function(uint) internal payable returns(uint) callback; }'))
      .toThrow(/only external function types can be payable/i);
    expect(cc('contract C { function(uint) external payable returns(uint) callback; }')).toBe('C');
  });

  it('rejects internal function types nested in an external function type', () => {
    expect(() => cc('contract C { function(function() internal) external callback; }'))
      .toThrow(/internal function types cannot be used inside an external function type/i);
    expect(() => cc('contract C { function() external returns(function() internal) callback; }'))
      .toThrow(/internal function types cannot be used inside an external function type/i);
  });

  it('rejects publicly exposed internal function-type state', () => {
    expect(() => cc('contract C { function(bytes memory) public callback; }'))
      .toThrow(/internal function types cannot be exposed by public state variables/i);
    expect(() => cc('contract C { function(bytes memory) internal public callback; }'))
      .toThrow(/internal function types cannot be exposed by public state variables/i);
  });

  it('retains private/internal state and public external function types', () => {
    expect(cc(
      'contract C { function(bytes memory) internal private localCallback;'
      + ' function(address payable) view internal returns(address payable) payableAddressCallback;'
      + ' function(bytes memory) external public remoteCallback; }',
    )).toBe('C');
  });
});

describe('constant zero-divisor diagnostics', () => {
  const cc = (src: string): string =>
    compileString(src, { solidityImportCompat: true }).contractName;

  it('rejects division and modulo by a resolved zero constant', () => {
    expect(() => cc('contract C { uint constant Z = 0; uint constant X = 7 / Z; }'))
      .toThrow(/division by zero/i);
    expect(() => cc('contract C { uint constant O = 1; uint constant X = 7 % (O - 1); }'))
      .toThrow(/modulo zero/i);
  });

  it('rejects addmod and mulmod with a resolved zero modulus', () => {
    expect(() => cc('contract C { uint constant Z = 0; uint constant X = addmod(3, 4, Z); }'))
      .toThrow(/arithmetic modulo zero/i);
    expect(() => cc('contract C { uint constant O = 1; uint constant X = mulmod(3, 4, O - 1); }'))
      .toThrow(/arithmetic modulo zero/i);
  });

  it('retains non-zero constant arithmetic', () => {
    expect(cc(
      'contract C { uint constant D = 2; uint constant A = 8 / D;'
      + ' uint constant B = 7 % D; uint constant X = addmod(A, B, D); }',
    )).toBe('C');
  });
});

describe('inline-only library declaration validation', () => {
  const cc = (src: string): string =>
    compileString(src, { solidityImportCompat: true }).contractName;

  it('requires locations on reference-type parameters and returns before the declaration-artifact return', () => {
    expect(() => cc('library L { function f(uint[] values) internal pure {} }'))
      .toThrow(/data location must be.*but none was given/i);
    expect(() => cc('library L { function f() private pure returns(uint[]) {} }'))
      .toThrow(/data location must be.*but none was given/i);
  });

  it('retains explicit library parameter and return locations', () => {
    expect(cc(
      'library L { function f(uint[] memory values) internal pure returns(uint[] memory out) { return values; } }',
    )).toBe('L');
  });
});

describe('msg.value payable-context validation', () => {
  const cc = (src: string): string =>
    compileString(src, { solidityImportCompat: true }).contractName;

  it('rejects msg.value in a nonpayable constructor or public function', () => {
    expect(() => cc('contract C { constructor() { uint x = msg.value; } }'))
      .toThrow(/msg\.value.*payable constructors/i);
    expect(() => cc('contract C { function f() public view returns(uint) { return msg.value; } }'))
      .toThrow(/msg\.value.*payable.*public/i);
  });

  it('applies the same rule to msg.value introduced through a modifier argument', () => {
    expect(() => cc(
      'contract C { modifier m(uint x) { _; } function f() public view m(msg.value) {} }',
    )).toThrow(/msg\.value.*payable.*public/i);
  });

  it('retains payable entry points and internal helper reads', () => {
    expect(cc(
      'library L { function read() public view returns(uint) { return msg.value; } }'
      + ' contract C { uint initial = msg.value; constructor() payable { uint x = msg.value; }'
      + ' function f() public payable returns(uint) { return msg.value; }'
      + ' function g() internal view returns(uint) { return msg.value; }'
      + ' function h() public returns(uint) { return msg.value; } }',
    )).toBe('C');
  });
});

describe('hex string separator validation', () => {
  const cc = (literal: string): string => compileString(
    `contract C { function f() public pure { bytes memory x = ${literal}; } }`,
    { solidityImportCompat: true },
  ).contractName;

  it.each(['hex"_1234"', 'hex"1234_"', 'hex"12__34"', 'hex"1_234"'])(
    'rejects invalid separator placement in %s',
    (literal) => expect(() => cc(literal)).toThrow(/hex string separator/i),
  );

  it('accepts separators between complete byte groups', () => {
    expect(cc('hex"12_3456_789012"')).toBe('C');
  });
});

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

describe('constant index range validation', () => {
  const cc = (body: string): string => compileString(
    `contract C { function f() public pure { ${body} } }`,
    { solidityImportCompat: true },
  ).contractName;

  it('rejects literal fixed-bytes indices at or beyond the byte width', () => {
    expect(() => cc('bytes32 b; bytes1 x = b[64];')).toThrow(/out of bounds/i);
  });

  it('rejects uint256-overflowing constant indices', () => {
    const huge = '888888888888888888888888888888888888888888888888888888888888888888888888888888888888';
    expect(() => cc(`bytes memory b; bytes1 x = b[${huge}];`))
      .toThrow(/cannot be represented as an unsigned integer/i);
  });

  it('checks folded constant indices against fixed array bounds', () => {
    expect(() => cc('bytes[32] memory a; bytes memory x = a[8**90];')).toThrow(/out of bounds/i);
  });

  it('retains in-range fixed bytes and array indexing', () => {
    expect(cc('bytes32 b; bytes1 x = b[31]; bytes[2] memory a; bytes memory y = a[1];')).toBe('C');
  });
});

describe('Solidity numeric literal syntax', () => {
  const cc = (value: string, compat = true): string => compileString(
    `contract C { uint x = ${value}; }`,
    { solidityImportCompat: compat },
  ).contractName;

  it.each(['01', '098', '0100', '01 gwei'])('rejects legacy octal-looking integer %s', (value) => {
    expect(() => cc(value)).toThrow(/octal numbers not allowed/i);
  });

  it('requires whitespace before a denomination', () => {
    expect(() => cc('1wei')).toThrow(/identifier-start.*end of a number/i);
    expect(() => cc('1.5gwei')).toThrow(/identifier-start.*end of a number/i);
    expect(cc('1 wei')).toBe('C');
  });

  it('rejects the removed Solidity finney denomination but retains the native BCH unit', () => {
    expect(() => cc('1 finney')).toThrow(/finney/i);
    expect(cc('1 finney', false)).toBe('C');
  });

  it('retains zero-prefixed fractions, exponents, and standalone zero', () => {
    expect(cc('0')).toBe('C');
    expect(cc('0e2')).toBe('C');
    expect(cc('0.5 ether')).toBe('C');
  });
});

describe('Solidity UDVT underlying value types', () => {
  const cc = (definition: string, compat = true): string => compileString(
    `${definition} contract C { function f() public { require(true); } }`,
    { solidityImportCompat: compat },
  ).contractName;

  it.each(['type DynamicBytes is bytes;', 'type Text is string;'])(
    'rejects a dynamic reference underlying in %s',
    (definition) => expect(() => cc(definition)).toThrow(/underlying type.*not a value type/i),
  );

  it('retains elementary value-type underlyings', () => {
    expect(cc('type Word is bytes32; type Count is uint256; type Account is address;')).toBe('C');
  });

  it('retains native SolidCash dynamic-byte and string wrappers', () => {
    expect(cc('type DynamicBytes is bytes; type Text is string;', false)).toBe('C');
  });
});

describe('Solidity enum member limit', () => {
  const cc = (count: number): string => {
    const members = Array.from({ length: count }, (_, i) => `M${i}`).join(',');
    return compileString(
      `enum E { ${members} } contract C { E value; }`,
      { solidityImportCompat: true },
    ).contractName;
  };

  it('rejects an enum with more than 256 members', () => {
    expect(() => cc(257)).toThrow(/enum with more than 256 members/i);
  });

  it('accepts an enum at the 256-member limit', () => {
    expect(cc(256)).toBe('C');
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

describe('Solidity free-function contract context', () => {
  it("rejects 'this' outside a contract", () => {
    expect(() => compileString(
      'contract C {} function f() { this; }',
      { solidityImportCompat: true },
    )).toThrow(/'this'.*not available.*free function/i);
  });

  it("retains 'this' inside a contract function", () => {
    expect(compileString(
      'contract C { function f() public { address a = address(this); require(a == address(this)); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
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

describe('Solidity free-function duplicate signatures', () => {
  it('rejects two or more identical file-level function declarations', () => {
    expect(() => compileString(
      'function f() pure returns (uint) { return 1; }'
      + ' function f() pure returns (uint) { return 2; }',
      { solidityImportCompat: true },
    )).toThrow(/Redefinition of function 'f\(\)'/i);
    expect(() => compileString(
      'function f(uint x) pure returns (uint) { return x; }'
      + ' function f(uint x) pure returns (uint) { return x + 1; }'
      + ' function f(uint x) pure returns (uint) { return x + 2; }',
      { solidityImportCompat: true },
    )).toThrow(/Redefinition of function 'f\(uint256\)'/i);
  });

  it('retains file-level overloads with distinct parameter types', () => {
    expect(compileString(
      'function f(uint x) pure returns (uint) { return x; }'
      + ' function f(bytes32 x) pure returns (bytes32) { return x; }'
      + ' contract C { function g(uint x) public pure returns (uint) { return f(x); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('Solidity free-function call options', () => {
  it('rejects gas and value options on direct free-function calls', () => {
    for (const option of ['gas: 1', 'value: 1']) {
      expect(() => compileString(
        `function f() { f{${option}}(); }`,
        { solidityImportCompat: true },
      )).toThrow(/call options.*external function calls or contract creations/i);
    }
  });

  it('retains call options on an external interface call from a free function', () => {
    expect(compileString(
      'interface I { function f() external payable; }'
      + ' function call(I target) { target.f{gas: 1, value: 1}(); }'
      + ' contract C { function run(I target) public { call(target); require(true); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('Solidity pure free-function storage mutation', () => {
  it('rejects writes through a storage reference parameter', () => {
    expect(() => compileString(
      'function g(uint[] storage x) pure { x[0] = 1; }',
      { solidityImportCompat: true },
    )).toThrow(/pure function 'g'.*cannot modify storage parameter 'x'/i);
  });

  it('retains the same storage mutation in a non-pure free function', () => {
    expect(compileString(
      'function g(uint[] storage x) { x[0] = 1; }',
      { solidityImportCompat: true },
    ).contractName).toBe('definitions');
  });
});

describe('Solidity free-function literal overload ambiguity', () => {
  it('rejects an integer literal accepted by multiple bounded overloads', () => {
    expect(() => compileString(
      'function g(uint8) {} function g(uint16) {} function t() { g(2); }',
      { solidityImportCompat: true },
    )).toThrow(/No unique declaration.*overloaded function 'g'/i);
  });

  it('retains an explicit cast which uniquely selects an overload', () => {
    expect(compileString(
      'function g(uint8) {} function g(uint16) {}'
      + ' contract C { function t() public { g(uint8(2)); require(true); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
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

describe('Solidity state variables are not internally callable getters', () => {
  it('rejects bare call syntax on an implicitly visible mapping', () => {
    expect(() => compileString(
      'contract C { mapping(uint => uint) m; uint a = m(1000); }',
      { solidityImportCompat: true },
    )).toThrow();
  });

  it('rejects bare call syntax even on an explicitly public mapping', () => {
    expect(() => compileString(
      'contract C { mapping(uint => uint) public m;'
      + ' function f() public view returns (uint) { return m(1000); } }',
      { solidityImportCompat: true },
    )).toThrow();
  });

  it('retains an explicitly external self-call to the public getter', () => {
    expect(compileString(
      'contract C { mapping(uint => uint) public m;'
      + ' function f() public view returns (uint) { return this.m(1000); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('Solidity low-level call value options', () => {
  it.each(['staticcall', 'delegatecall'])('rejects {value: ...} on %s before helper pruning', (method) => {
    expect(() => compileString(
      `contract C { function f() pure internal { address(10).${method}{value: 7, gas: 3}(""); } }`,
      { solidityImportCompat: true },
    )).toThrow(new RegExp(`value.*${method}`, 'i'));
  });

  it('retains the inert gas option on staticcall', () => {
    expect(compileString(
      'contract C { function f(address a, bytes memory d) public {'
      + ' a.staticcall{gas: 3}(d); require(true); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('Solidity pragma range compatibility', () => {
  const ok = (range: string): string => compileString(
    `pragma solidity ${range}; contract C { function f() public { require(true); } }`,
    { solidityImportCompat: true },
  ).contractName;

  it('accepts disjunctions, hyphen ranges, and bare integer bounds', () => {
    expect(ok('0.8.17 || 0.4.1 - 0.9.0')).toBe('C');
    expect(ok('0.4.0 - 0.9.0 || 0.4.1 - 0.6.2')).toBe('C');
    expect(ok('< 142857')).toBe('C');
  });

  it('retains Solidity diagnostics for malformed range combinations', () => {
    expect(() => ok('0.4.1 - 0.6.2 0.8.17')).toThrow();
    expect(() => ok('0.8.17 0.4.1 - 0.6.2')).toThrow();
    expect(() => ok('^0^1')).toThrow(/version pragma conjunction/);
    expect(() => ok('4294967296')).toThrow(/exceeds uint32/);
  });
});

describe('implicit fixed-bytes widening at array element write boundaries', () => {
  const cc = (src: string): string =>
    compileString(src, { solidityImportCompat: true, forceStateful: true, chunkedArrays: true }).contractName;

  it('right-pads bytesM assigned into a wider bytesN fixed-state-array element', () => {
    expect(cc('contract C { bytes17[2] a; function f(bytes8 x) public { a[0] = a[1] = x; } }')).toBe('C');
  });

  it('right-pads bytesM pushed or assigned into a wider bytesN dynamic-state-array element', () => {
    expect(cc('contract C { bytes17[] a; function f(bytes8 x) public { a.push(x); a[0] = x; } }')).toBe('C');
  });
});

describe('hex string literals assigned to string values', () => {
  it('accepts a hex literal in state, local initialization, and local reassignment contexts', () => {
    const src = 'contract C { string s; function f() public { s = hex"41424344";'
      + ' string memory a = hex"4546"; a = hex"4748"; require(bytes(a).length == 2); } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
  });
  it('rejects malformed UTF-8 in a hex literal assigned to string', () => {
    expect(() => compileString('contract C { string s = hex"a000"; }', { solidityImportCompat: true }))
      .toThrow();
  });
});

describe('Yul low-level-call success assigned to a typed bool', () => {
  it('retains bool when staticcall assigns an existing high-level bool local', () => {
    const src = 'contract C { function f(address a) public returns (bool success) {'
      + ' assembly { success := staticcall(gas(), a, 0, 0, 0, 0)'
      + ' switch success case 0 { invalid() } } require(success || !success); } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
  });
  it('inlines a low-level-call helper with `if (c) return a; return b;` into its entry point', () => {
    const src = 'contract C { function g(address a) internal returns (uint) { bool success;'
      + ' assembly { success := staticcall(gas(), a, 0, 0, 0, 0) switch success case 0 { invalid() } }'
      + ' if (!success) return 1; return 0; }'
      + ' function f(address a) public returns (bool) { return g(a) == 0; } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('Solidity keywords as Yul identifiers', () => {
  it('accepts keyword-named Yul locals', () => {
    expect(compileString('contract C { function f() public pure { assembly {'
      + ' let abstract := 1 let contract := 2 let memory := 3 let uint := 4'
      + ' pop(add(abstract, contract)) } } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('rejects EVM instructions and object-format builtins as Yul declaration names', () => {
    const invalid = [
      'assembly { let mod := 2 }',
      'assembly { function add(mstore) -> sstore {} }',
      'assembly { function dup1(dup2) -> dup3 {} let dup4 }',
      'assembly { let linkersymbol := 1 let datacopy := 1 let swap16 := 1 }',
      'assembly { let basefee function tload() {} }',
      'assembly { if 1 { let blobhash } for { let mcopy } 1 {} {} }',
    ];
    for (const body of invalid) {
      expect(() => compileString(
        `contract C { function f() public pure { ${body} } }`,
        { solidityImportCompat: true },
      )).toThrow(/identifier '.*' is reserved/);
    }
  });

  it('continues to accept ordinary custom Yul declaration names', () => {
    expect(compileString(
      'contract C { function f() public pure { assembly {'
      + ' function twice(value) -> result { result := add(value, value) } let output := twice(2) } } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('allows version-gated instruction names before their activating fork', () => {
    const fixtures = [
      ['basefee', '<=berlin'],
      ['prevrandao', '<paris'],
      ['mcopy', '<cancun'],
      ['tload', '<cancun'],
      ['clz', '<osaka'],
    ];
    for (const [name, evmVersion] of fixtures) {
      expect(compileString(
        `contract C { function f() public pure { assembly { let ${name} := 1 } } }`
        + `\n// ====\n// EVMVersion: ${evmVersion}\n// ----`,
        { solidityImportCompat: true },
      ).contractName).toBe('C');
    }
  });

  it('does not rewrite the high-level block.prevrandao member for a pre-Paris target', () => {
    expect(compileString(
      'contract C { function f() public view returns (uint) { return block.prevrandao; } }'
      + '\n// ====\n// EVMVersion: <paris\n// ----',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('pure function inline-assembly effects', () => {
  it('rejects environment, state, external-call, and creation instructions', () => {
    const effects = [
      'chainid()', 'basefee()', 'blobbasefee()', 'blobhash(0)', 'prevrandao()', 'difficulty()',
      'selfbalance()', 'sload(0)', 'tload(0)', 'staticcall(0, 1, 2, 3, 4, 5)', 'create2(0, 1, 2, 3)',
    ];
    for (const effect of effects) {
      expect(() => compileString(
        `contract C { function f() public pure { assembly { pop(${effect}) } } }`,
        { solidityImportCompat: true },
      )).toThrow(/declared pure.*reads state or the environment/);
    }
  });

  it('accepts arithmetic and memory-only inline assembly in pure functions', () => {
    expect(compileString(
      'contract C { function f(uint x) public pure returns (uint y) {'
      + ' assembly { mstore(0, add(x, 1)) y := mload(0)'
      + ' let n := returndatasize() returndatacopy(0, 0, n) } } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('pure and view state effects', () => {
  it('rejects scalar and mapping reads from pure functions', () => {
    const invalid = [
      'uint x; function f() public pure returns (uint) { return x; }',
      'mapping(uint => uint) m; function f(uint k) public pure returns (uint) { return m[k]; }',
      'struct S { uint x; } S s; function f() internal pure returns (S storage) { return s; }'
      + ' function g() public pure { f().x; }',
    ];
    for (const body of invalid) {
      expect(() => compileString(`contract C { ${body} }`, { solidityImportCompat: true }))
        .toThrow(/pure.*cannot read contract state/);
    }
  });

  it('rejects msg.value in pure function bodies and modifier arguments', () => {
    const invalid = [
      'function f() public pure returns (uint) { return msg.value; }',
      'modifier m(uint value) { require(value >= 0); _; } function f() public pure m(msg.value) {}',
      'modifier m() { require(msg.value >= 0); _; } function f() public pure m {}',
    ];
    for (const body of invalid) {
      expect(() => compileString(`contract C { ${body} }`, { solidityImportCompat: true }))
        .toThrow(/pure.*cannot read 'msg.value'/);
    }
  });

  it('rejects transient reads in pure functions and writes in view functions', () => {
    expect(() => compileString(
      'contract C { uint transient x; function f() public pure returns (uint) { return x; } }',
      { solidityImportCompat: true },
    )).toThrow(/pure.*cannot read transient state/);
    expect(() => compileString(
      'contract C { uint transient x; function f() public view { x = 1; } }',
      { solidityImportCompat: true },
    )).toThrow(/view.*cannot modify transient state/);
  });

  it('enforces mutability when calling external function-pointer locals', () => {
    const invalid = [
      'function f() public pure { function() external fp; fp(); }',
      'function f() public pure { function() external view fp; fp(); }',
      'function f() public view { function() external fp; fp(); }',
    ];
    for (const body of invalid) {
      expect(() => compileString(`contract C { ${body} }`, { solidityImportCompat: true }))
        .toThrow(/function cannot call a '.*' function pointer/);
    }
    expect(compileString(
      'contract C { function f() public pure { function() external pure fp; fp; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('rejects view external interface calls from pure free/operator helpers', () => {
    expect(() => compileString(
      'type T is uint; I constant TARGET = I(address(0));'
      + ' function add(T a, T b) pure returns (T) { return TARGET.read(a, b); }'
      + ' using {add as +} for T global;'
      + ' interface I { function read(T, T) external view returns (T); }',
      { solidityImportCompat: true },
    )).toThrow(/pure.*cannot call 'view' external function/);
  });

});

describe('Yul byte builtin word type', () => {
  it('can compare byte(0, mload(ptr)) with an integer word', () => {
    expect(compileString('contract C { function f(bytes memory data) public pure returns (bool ret) {'
      + ' assembly { ret := iszero(lt(byte(0, mload(add(data, 0x20))), 0xC0)) } } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('dead Yul library-address bindings', () => {
  it('drops an unused binding to a declared library but not an unknown identifier', () => {
    expect(compileString(
      'library L {} contract C { function f() public pure { assembly { let x := L } } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
    expect(() => compileString(
      'contract C { function f() public pure { assembly { let x := Unknown } } }',
      { solidityImportCompat: true },
    )).toThrow(/Undefined reference|Unsupported inline assembly/);
  });
});

describe('Yul byte() result assigned to a uint256 word', () => {
  it('reinterprets the bytes1 AST result as the uint256 Yul target word', () => {
    const src = 'contract C { function f(uint256 x) public returns (uint256 a) {'
      + ' assembly { a := byte(31, x) } } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('Yul bytes32 memory offsets are uint256 words', () => {
  it('accepts a keccak256 result as the offset of runtime mstore', () => {
    const src = 'contract C { function f() public pure {'
      + ' assembly { mstore(keccak256(0, 20), 7) } } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('using-for method named length', () => {
  it('distinguishes a callable library method from the built-in .length property', () => {
    const artifact = compileString(
      'library D { function length(string memory self) public returns (uint) { return bytes(self).length; } }'
      + ' contract C { using D for string; string x;'
      + ' function f() public returns (uint) { x = "abc"; return x.length(); }'
      + ' function g() public returns (uint) { string memory s = "abc"; return s.length(); } }',
      { solidityImportCompat: true },
    );
    expect(artifact.contractName).toBe('C');
  });
});

describe('nested public array and mapping getters', () => {
  const ok = (decl: string, setup: string, call: string): string => compileString(
    `contract C { ${decl} constructor() { ${setup} }`
    + ` function f() public view returns (uint) { return ${call}; } }`,
    { solidityImportCompat: true },
  ).contractName;

  it('synthesizes all array indices after a mapping key', () => {
    expect(ok(
      'mapping(uint => uint[][]) public m;',
      'm[0].push(); m[0][0].push(); m[0][0][0] = 42;',
      'this.m(0, 0, 0)',
    )).toBe('C');
  });

  it('synthesizes every dimension of a nested public array', () => {
    expect(ok(
      'uint[][] public a;',
      'a.push(); a[0].push(); a[0][0] = 42;',
      'this.a(0, 0)',
    )).toBe('C');
  });

  it('resolves an enum-typed public getter before the main symbol pass', () => {
    expect(compileString(
      'contract C { enum Choice { Left, Right } Choice public choice;'
      + ' function f() public view returns (Choice) { return this.choice(); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
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

describe('no-arg push on a struct array appends the struct default (data.push() on Data[])', () => {
  const bc = (src: string): string => compileString(src, { solidityImportCompat: true }).bytecode;
  const mk = (body: string): string => 'contract C { struct Data { uint256 x; uint256 y; } Data[] data;'
    + ` function f(uint256 n) public { ${body} require(true); } }`;
  it('reduces data.push() to data.push(Data(0,0)) (byte-identical)', () => {
    expect(bc(mk('data.push();'))).toBe(bc(mk('data.push(Data(0,0));')));
  });
  it('handles no-arg struct push inside a while-grow loop (loop-cache path)', () => {
    expect(bc(mk('while (data.length < n) data.push();')))
      .toBe(bc(mk('while (data.length < n) data.push(Data(0,0));')));
  });
});

describe('struct storage reference returned by no-arg push', () => {
  const bc = (src: string): string => compileString(src, { solidityImportCompat: true }).bytecode;

  it('reduces rows.push().field = value to a push of the final struct value', () => {
    const head = 'contract C { struct S { uint x; uint y; } S[] rows; function f(uint v) public {';
    expect(bc(`${head} rows.push().x = v; } }`)).toBe(bc(`${head} rows.push(S(v, 0)); } }`));
  });

  it('supports push-return field writes and indexed field updates on mapping-entry struct arrays', () => {
    const head = 'contract C { struct S { uint x; uint y; } mapping(uint => S[]) rows;'
      + ' function f(uint k, uint i, uint v) public {';
    expect(bc(`${head} rows[k].push().x = v; } }`)).toBe(bc(`${head} rows[k].push(S(v, 0)); } }`));
    expect(bc(`${head} rows[k][i].y = v; } }`))
      .toBe(bc(`${head} rows[k][i] = S(rows[k][i].x, v); } }`));
  });

  it('roundtrips an array-field write through a fixed struct array in a nested mapping', () => {
    expect(compileString('contract C { struct S { uint x; uint[] items; }'
      + ' mapping(uint => mapping(uint => S[5])) rows;'
      + ' function f(uint a, uint b, uint i, uint j, uint v) public {'
      + ' rows[a][b][i].items[j] = v; require(true); } }',
    { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });
});

describe('bare array member references are no-op statements', () => {
  const bc = (src: string): string => compileString(src, { solidityImportCompat: true }).bytecode;
  const mk = (type: string, statement: string): string => `contract C { ${type} data;`
    + ` function f() public returns (uint256 x) { x = 2; ${statement} x = 3; } }`;

  it('drops a bare dynamic-array pop member reference', () => {
    expect(bc(mk('uint256[]', 'data.pop;'))).toBe(bc(mk('uint256[]', '')));
  });

  it('drops a bare bytes pop member reference', () => {
    expect(bc(mk('bytes', 'data.pop;'))).toBe(bc(mk('bytes', '')));
  });
});

describe('bare ABI builtin function references are no-op statements', () => {
  const bc = (body: string): string => compileString(
    `contract C { function f() public pure { ${body} } }`,
    { solidityImportCompat: true },
  ).bytecode;

  it('drops all bare abi function references', () => {
    expect(bc('abi.encode; abi.encodePacked; abi.encodeWithSelector; abi.encodeWithSignature; abi.decode;'))
      .toBe(bc(''));
  });

  it('drops a bare assert function reference', () => {
    expect(bc('assert;')).toBe(bc(''));
  });
});

describe('cycle-safe AST metadata walks', () => {
  const ok = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;

  it('handles a self-function reference passed to abi.encode', () => {
    expect(ok('contract C { function f() public view { abi.encode(this.f); } }')).toBe('C');
  });

  it('handles comparisons of self-function references', () => {
    expect(ok('contract C { function f() public view returns (bool) { return this.f == this.f; } }')).toBe('C');
  });

  it('handles deleted function-pointer locals and state variables', () => {
    expect(ok('contract C { function(uint) external returns(uint) x;'
      + ' function(uint) internal returns(uint) y; function f() public { delete x;'
      + ' function(uint) internal returns(uint) a = y; delete a; delete y; } }')).toBe('C');
  });

  it('rejects delete on a function declaration rather than treating it as a function-pointer variable', () => {
    expect(() => ok('contract C { function f() public { delete f; } }'))
      .toThrow(/where type variable was expected/);
  });

  it('handles a self-call inside try/catch nested in a loop', () => {
    expect(ok('contract C { function f() public returns(uint) {'
      + ' while (1 == 1) try this.f() returns (uint b) { b = 2; } catch { } } }')).toBe('C');
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

describe('legacy soft-keyword struct type name', () => {
  it('accepts a struct named error and uses it as a state-variable type', () => {
    expect(compileString(
      'struct error { uint value; } contract C { error item;'
      + ' function f(uint x) public returns(uint) { item.value = x; return item.value; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('discarded type-reference statements', () => {
  const bc = (body: string): string => compileString(
    `contract C { struct S { uint a; uint b; } function f() public pure { ${body} } }`,
    { solidityImportCompat: true },
  ).bytecode;

  it('drops scalar and fixed-array forms of primitive and struct type references', () => {
    expect(bc('S; S[7]; uint; uint[7];')).toBe(bc(''));
  });

  it('rejects a type-expression array bound that does not fit uint256', () => {
    expect(() => bc(`S[${'5'.repeat(132)}];`)).toThrow(/does not fit uint256/);
  });

  it('drops dynamic/multidimensional primitive arrays, including a parenthesized type expression', () => {
    expect(bc('int[][]; int[2][]; (int[][][]);')).toBe(bc(''));
  });

  it('validates dimensions even though the resulting type expression is discarded', () => {
    expect(() => bc('int[0][];')).toThrow(/positive and fit uint256/);
    expect(() => bc('int[unknown][];')).toThrow(/compile-time integer constant/);
  });
});

describe('named arguments participate in overload resolution', () => {
  const ok = (body: string): string => compileString(
    'contract C { function f(uint x) internal {} function f(uint x,uint y) internal {}'
    + ' function f(uint u,string memory s,bool b) internal {} function f(uint u,uint s,uint b) internal {}'
    + ` function call() public { ${body} } }`,
    { solidityImportCompat: true },
  ).contractName;

  it('selects by parameter-name set and then by reordered argument types', () => {
    expect(ok('f({x:1}); f({y:2,x:1}); f({b:true,s:"abc",u:1});')).toBe('C');
  });

  it('rejects named overloads that remain ambiguous after name-aware type matching', () => {
    expect(() => compileString(
      'contract D { function f(uint x,string memory y) internal {}'
      + ' function f(bytes memory y,int x) internal {}'
      + ' function call() internal { f({x:1,y:"abc"}); } }',
      { solidityImportCompat: true },
    )).toThrow(/ambiguous .*overload/i);
  });
});

describe('underscore function names remain distinct from modifier placeholders', () => {
  it('declares and calls _(), while a bare _; remains a no-op placeholder-shaped statement', () => {
    expect(compileString(
      'contract C { function _() public pure returns(uint) { return 88; }'
      + ' function g() public pure returns(uint) { return _(); }'
      + ' function h() public pure returns(uint) { _; return 33; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('bare call-option function references are no-op statements', () => {
  const bc = (body: string): string => compileString(
    `contract C { function f() external payable {} function g(address a) external pure { ${body} } }`,
    { solidityImportCompat: true },
  ).bytecode;

  it('drops value/gas options when no call follows', () => {
    expect(bc('a.call{value:42}; a.call{gas:42}; a.staticcall{gas:42}; a.delegatecall{gas:42};'))
      .toBe(bc(''));
  });

  it('still rejects unknown and duplicate options before discarding the reference', () => {
    expect(() => bc('a.call{random:42};')).toThrow(/unknown call option/i);
    expect(() => bc('a.call{gas:2,gas:5};')).toThrow(/duplicate call option/i);
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

describe('block.coinbase is address payable', () => {
  it('returns it as payable and permits the normal payable-to-address widening', () => {
    expect(compileString(
      'contract C { function p() public view returns(address payable) { return block.coinbase; }'
      + ' function a() public view returns(address) { return block.coinbase; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('inline assembly preserves payable address assignments', () => {
  it('copies an address payable local into a payable named return without a uint256 round-trip', () => {
    expect(compileString(
      'contract C { function f(address payable z) public pure returns(address payable r) {'
      + ' assembly { r := z } } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('address.codehash is bytes32', () => {
  it('returns a fixed bytes32 and remains assignable to unbounded bytes', () => {
    expect(compileString(
      'contract C { function f(address a) public view returns(bytes32) { return a.codehash; }'
      + ' function g(address a) public view returns(bytes memory) { return a.codehash; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('mapping and array members in internal function types', () => {
  it('accepts named nested mappings as parameters and mapping returns', () => {
    expect(compileString(
      'contract C { function(mapping(uint key => mapping(uint sub => uint value) entries) storage) internal fp;'
      + ' function f(function(mapping(uint=>uint) storage) internal cb) internal pure {}'
      + ' function g(function() internal returns(mapping(uint=>uint) storage) cb) internal pure {} }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('rejects conflicting names across a nested mapping chain', () => {
    expect(() => compileString(
      'contract C { mapping(uint same => mapping(uint other => uint same) value) data; }',
      { solidityImportCompat: true },
    )).toThrow(/conflicting parameter name/i);
  });
});

describe('modifiers declared in libraries', () => {
  it('expands the library modifier on namespaced and using-for calls without binding a same-name contract modifier', () => {
    expect(compileString(
      'library L { struct S { uint v; } modifier mod(S storage s) { s.v++; _; }'
      + ' function add(S storage s) internal mod(s) { s.v += 0x100; } }'
      + ' contract C { using L for *; L.S s; modifier mod(L.S storage) { revert(); _; }'
      + ' function f() public returns(uint) { s.add(); L.add(s); return s.v; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('rejects virtual/unimplemented library modifiers and modifiers on file-level free functions', () => {
    expect(() => compileString('library L { modifier m virtual { _; } }', { solidityImportCompat: true }))
      .toThrow(/library cannot be virtual/i);
    expect(() => compileString('library L { modifier m; }', { solidityImportCompat: true }))
      .toThrow(/must have an implementation/i);
    expect(() => compileString('function f() m {}', { solidityImportCompat: true }))
      .toThrow(/not allowed on free functions/i);
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

describe('underscores in hexadecimal number literals', () => {
  it('accepts separators between hex digits and emits the same bytes as the unseparated form', () => {
    const separated = compileString(
      'contract C { function f() pure returns (bytes4) { return 0x8765_4321; } }',
      { solidityImportCompat: true },
    );
    const plain = compileString(
      'contract C { function f() pure returns (bytes4) { return 0x87654321; } }',
      { solidityImportCompat: true },
    );
    expect(separated.bytecode).toBe(plain.bytecode);
  });

  it('rejects leading, trailing, and repeated separators', () => {
    for (const literal of ['0x_12', '0x12_', '0x12__34']) {
      expect(() => compileString(
        `contract C { function f() pure returns (uint) { return ${literal}; } }`,
        { solidityImportCompat: true },
      )).toThrow();
    }
  });
});

describe('pragma directives after file-level declarations', () => {
  it('accepts a pragma between a user-defined value type and a contract', () => {
    expect(compileString(
      'type T is int224; pragma solidity >=0.0.0; contract C { function f() pure returns (T) {'
      + ' return T.wrap(1); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('still requires pragma experimental solidity at the beginning of the source unit', () => {
    expect(() => compileString(
      'contract C {} pragma experimental solidity;',
      { solidityImportCompat: true },
    )).toThrow(/only be set at the beginning/i);
  });
});

describe('metatype expressions as first-class expressions', () => {
  it('drops a bare type(C) expression and accepts member access through parentheses', () => {
    const bare = compileString(
      'contract D {} contract C { function f() pure { type(D); } }',
      { solidityImportCompat: true },
    );
    const empty = compileString(
      'contract D {} contract C { function f() pure {} }',
      { solidityImportCompat: true },
    );
    expect(bare.bytecode).toBe(empty.bytecode);
    expect(compileString(
      'contract C { function f() pure returns (uint8) { return (type(uint8)).max; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('rejects a struct metatype even when the result is discarded', () => {
    expect(() => compileString(
      'contract C { struct S { uint x; } function f() pure { type(S); } }',
      { solidityImportCompat: true },
    )).toThrow(/invalid struct type/i);
  });
});

describe('data location on function-TYPE params/returns (function(string memory) internal)', () => {
  const ok = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts a data location on a function-type parameter', () => {
    expect(ok('contract C { function h(string memory) internal pure { }'
      + ' function f() public { function(string memory) internal pure fp = h; fp("x"); require(true); } }')).toBe('C');
  });
  it('accepts a data location on a function-type return', () => {
    expect(ok('contract C { function() pure internal returns (bytes memory) fp;'
      + ' function f() public { require(true); } }')).toBe('C');
  });
  it('separates underscore-prefixed names from bounded primitive function-type members', () => {
    expect(ok('contract C { function set(bytes6 x) internal {} function f() public {'
      + ' function(bytes6 _name) internal fp = set; fp("abcdef"); require(true); } }')).toBe('C');
  });
  it('does not crash when a function-type member is an unresolvable name (falls back to an address handle)', () => {
    // IFoo is undeclared; the member must not reach FunctionType.toString as undefined.
    expect(ok('contract C { function(IFoo memory) internal fp; function f() public { require(true); } }')).toBe('C');
  });
  it('synthesizes a correctly typed fall-through default for a function-pointer return', () => {
    expect(ok('contract C { function f(function() external x) public'
      + ' returns (function() external returns(uint)) {} }')).toBe('C');
  });
});

describe('bare uint(x) cast == uint256(x)', () => {
  // `uint` is Solidity's alias for `uint256`. The typeCast grammar only covers bounded `uintN`, so bare `uint`
  // reaches the function-call builder; it is rewritten to a uint256 cast, producing identical bytecode.
  const mk = (t: string): string => `contract C() { function f(int x, int e) { require(int(${t}(x)) == e); } }`;

  it('compiles uint(x) and matches uint256(x) bytecode', () => {
    const uintBc = compileString(mk('uint'), { solidityImportCompat: true }).bytecode;
    const uint256Bc = compileString(mk('uint256'), { solidityImportCompat: true }).bytecode;
    expect(uintBc).toBe(uint256Bc);
  });

  it('accepts uint(x) in index and argument positions', () => {
    const art = compileString(`contract C() {
      function g(int outcome, int e) { require(uint(outcome) == uint(e)); }
    }`, { solidityImportCompat: true });
    expect(art.contractName).toBe('C');
  });
});

describe('enum / contract mapping key types', () => {
  // A mapping key of an enum, or of a contract type, previously left the key type undefined and crashed a later
  // pass on `.toString()`. Enum keys are int-backed; a contract-type key resolves to an address handle.
  it('compiles mapping(Enum => V) (int-backed key)', () => {
    const art = compileString(`contract C() {
      enum Status { Pending, Active, Closed }
      mapping(Status => uint256) counts;
      function set(Status k, uint256 v, pubkey pk, sig s) { require(checkSig(s, pk)); counts[k] = v; }
    }`, { solidityImportCompat: true });
    expect(art.contractName).toBe('C');
  });

  it('compiles a contract-type mapping key (resolves to an address handle)', () => {
    const art = compileString(`contract C() {
      enum E { A, B }
      mapping(C => bool) a;
      mapping(address => bool) b;
      mapping(E => bool) c;
    }`, { solidityImportCompat: true });
    expect(art.contractName).toBe('C');
  });
});

describe('bare uint/int in type() introspection (compat only)', () => {
  it('type(uint).max / type(int).min resolve under solidityImportCompat', () => {
    const art = compileString(`contract C() {
      function f(uint256 a, int b) { require(type(uint).max == a); require(type(int).min == b); }
    }`, { solidityImportCompat: true });
    expect(art.contractName).toBe('C');
  });

  it('native solidcash still requires the explicit width (type(int) throws)', () => {
    expect(() => compileString(`contract C() {
      function f(int e) { require(type(int).min == e); }
    }`)).toThrow(/introspection/);
  });
});

describe('user-defined value type over address', () => {
  // `type MyAddr is address;` - address is bytes-backed (a locking bytecode), so it is a valid UDVT underlying
  // type. wrap/unwrap are identity casts over the address.
  it('compiles a UDVT wrapping address and its wrap/unwrap', () => {
    const art = compileString(`contract C() {
      type A is address;
      function f(address x, address e) { A a = A.wrap(x); require(A.unwrap(a) == e); }
    }`, { solidityImportCompat: true });
    expect(art.contractName).toBe('C');
  });
});

describe('library-namespaced member access', () => {
  // A library enum is registered under its bare name, so `L.E.Member` (member access) and `L.E` (as a type)
  // strip the `L.` and behave like the unqualified enum - byte-identical to the bare form.
  const lib = 'library L { enum Dir { Left, Right } }\n';

  it('L.E.Member compiles and matches the bare enum member bytecode', () => {
    const qualified = compileString(`${lib}contract C() {
      function f(int e) { L.Dir d = L.Dir.Right; require(int(d) == e); }
    }`, { solidityImportCompat: true }).bytecode;
    const bare = compileString(`contract C() { enum Dir { Left, Right }
      function f(int e) { Dir d = Dir.Right; require(int(d) == e); }
    }`, { solidityImportCompat: true }).bytecode;
    expect(qualified).toBe(bare);
  });

  // `L.f({named})` parses as a named method call on `L`; when L is a library it routes to the namespaced library
  // function call `L.f(...)`, reordered against the callee's params - byte-identical to the positional form.
  const mathLib = 'library M { function sub(uint256 x, uint256 y) internal pure returns (uint256) { return x - y; } }\n';

  it('L.f({named}) matches the positional call and reorders args', () => {
    const named = compileString(`${mathLib}contract C() {
      function f(uint256 e) { require(M.sub({y: 2, x: 9}) == e); }
    }`, { solidityImportCompat: true }).bytecode;
    const positional = compileString(`${mathLib}contract C() {
      function f(uint256 e) { require(M.sub(9, 2) == e); }
    }`, { solidityImportCompat: true }).bytecode;
    expect(named).toBe(positional);
  });
});

describe('bare state-struct field write (Solidity form of this.s.field = v)', () => {
  // In Solidity a state var is written without `this.`; `s.field = v` where s is a state struct rebuilds the
  // struct and stores it back, identical to the explicit `this.s.field = v` (byte-for-byte).
  it('bare s.field = v matches this.s.field = v bytecode', () => {
    const bare = compileString(`contract C() { struct S { uint256 x; uint256 y; } S s;
      function f(uint256 e) { s.x = 13; s.y = 4; require(s.x == e); }
    }`, { solidityImportCompat: true }).bytecode;
    const thisPrefixed = compileString(`contract C() { struct S { uint256 x; uint256 y; } S s;
      function f(uint256 e) { this.s.x = 13; this.s.y = 4; require(this.s.x == e); }
    }`, { solidityImportCompat: true }).bytecode;
    expect(bare).toBe(thisPrefixed);
  });

  it('handles a nested field chain (a.b.x = v)', () => {
    const art = compileString(`contract C() { struct Inner { uint256 x; } struct Outer { Inner b; } Outer a;
      function f(uint256 e) { a.b.x = 13; require(a.b.x == e); }
    }`, { solidityImportCompat: true });
    expect(art.contractName).toBe('C');
  });

  it('a local struct field write is unaffected (stays a local rebuild)', () => {
    const art = compileString(`contract C() { struct S { uint256 x; }
      function f(uint256 e) { S memory s = S(1); s.x = 13; require(s.x == e); }
    }`, { solidityImportCompat: true });
    expect(art.contractName).toBe('C');
  });
});

describe('mapping-bearing struct scalar field write (flattened to s__field)', () => {
  // A struct state var with a mapping field flattens to per-field state (`s__a` scalar + `s__c` mapping). The
  // read side already resolves `s.a` -> `s__a`; the scalar field WRITE `s.a = v` must mirror it (a mapping/array
  // field with a key keeps its own collection-write path). Runtime is covered by MappingStructScalarWrite e2e.
  const decl = 'struct S { uint256 a; bytes b; mapping(uint256 => uint256) c; } S s;';

  it('writes a scalar field of a mapping-bearing struct', () => {
    const art = compileString(`contract C() { ${decl}
      function f(uint256 e) { s.a = 7; require(s.a == e); }
    }`, { solidityImportCompat: true });
    expect(art.contractName).toBe('C');
  });

  it('writes a bytes field and a compound scalar, and the mapping field still uses a keyed write', () => {
    const art = compileString(`contract C() { ${decl}
      function f(uint256 k, uint256 v) { s.a = 2; s.a += 5; s.b = 0x616263; s.c[k] = v; require(s.c[k] == v); }
    }`, { solidityImportCompat: true });
    expect(art.contractName).toBe('C');
  });
});

describe('hex string literal -> bytesN (right-padded)', () => {
  // Solidity widens a short `hex"..."` bytes literal to a larger bytesN by right-padding (the same rule as a
  // string literal). Verified byte-identical to the explicitly padded literal.
  it('assigns a short hex literal to a wider bytesN, byte-identical to the padded form', () => {
    const short = compileString(`contract C() {
      function f() returns (bytes5 b) { b = hex"043245"; require(b != 0x0000000000); }
    }`, { solidityImportCompat: true }).bytecode;
    const padded = compileString(`contract C() {
      function f() returns (bytes5 b) { b = hex"0432450000"; require(b != 0x0000000000); }
    }`, { solidityImportCompat: true }).bytecode;
    expect(short).toBe(padded);
  });

  it('coerces in a declaration and a state assignment; over-long is still rejected', () => {
    expect(compileString(`contract C() { bytes8 s;
      function f() { bytes32 b = hex"012233"; s = hex"0102"; require(b != 0x0 || s != 0x0); }
    }`, { solidityImportCompat: true }).contractName).toBe('C');
    expect(() => compileString(`contract C() {
      function f() { bytes2 b = hex"010203"; require(b != 0x0); }
    }`, { solidityImportCompat: true })).toThrow(/can not be assigned/);
  });
});

describe('struct field types: struct arrays and forward / recursive references', () => {
  // A struct field may be an array of a struct/enum (`T[]`), and struct names are pre-registered so a field can
  // reference a struct defined LATER (forward reference) or itself through a dynamic array (recursive).
  it('resolves a struct-array field with the element struct defined first', () => {
    const art = compileString(`contract C() {
      struct T { uint256 x; } struct S { uint256 a; T[] sub; } S s;
      function f() { s.a = 1; }
    }`, { solidityImportCompat: true });
    expect(art.contractName).toBe('C');
  });

  it('resolves a forward reference to a struct defined later', () => {
    const art = compileString(`contract C() {
      struct S { uint256 a; T[] sub; bytes b; } struct T { uint256 x; } S s;
      function f() { s.a = 1; }
    }`, { solidityImportCompat: true });
    expect(art.contractName).toBe('C');
  });

  it('compiles a self-recursive struct declaration without stack-overflowing', () => {
    const art = compileString(`contract C() {
      struct R { uint256 v; R[] children; } R r;
      function f() { r.v = 1; }
    }`, { solidityImportCompat: true });
    expect(art.contractName).toBe('C');
  });

  it('accepts an unused array of a mapping-bearing storage-only struct', () => {
    expect(compileString('contract C { struct Outer { Inner[1] values; }'
      + ' struct Inner { uint x; mapping(uint => Outer)[] entries; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('still rejects a directly recursive fixed struct array', () => {
    expect(() => compileString('contract C { struct S { uint x; S[1] child; } }',
      { solidityImportCompat: true })).toThrow(/not supported as a struct field|recursive struct/);
  });
});

describe('view-function state-effect validation', () => {
  const bad = (body: string, prefix = ''): void => {
    expect(() => compileString(
      `${prefix} contract C { uint x; uint[] a; function f(address target) public view { ${body} } }`,
      { solidityImportCompat: true },
    )).toThrow(/view|state|modif/i);
  };

  it('rejects direct state writes and dynamic-array mutation', () => {
    bad('x = 1;');
    bad('a.push();');
  });

  it('rejects contract creation and non-static low-level calls', () => {
    bad('new D();', 'contract D {}');
    bad('target.call("");');
  });

  it('rejects non-view internal calls and transient Yul writes', () => {
    expect(() => compileString(
      'contract C { function g() public {} function f() public view { C.g(); } }',
      { solidityImportCompat: true },
    )).toThrow(/view|state|modif/i);
    expect(() => compileString(
      'contract C { function f() public view { assembly { tstore(0, 0) } } }',
      { solidityImportCompat: true },
    )).toThrow(/view|state|modif/i);
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

describe('Solidity explicit conversion boundaries', () => {
  const compat = { solidityImportCompat: true };

  it('requires equal widths for integer/fixed-bytes casts', () => {
    for (const expression of [
      "uint256(bytes1(''))",
      "uint32(bytes32(''))",
      'bytes1(uint256(0))',
      'bytes32(uint32(0))',
    ]) {
      expect(() => compileString(
        `contract C { function f() public pure { ${expression}; } }`,
        compat,
      )).toThrow(/cast|conversion/i);
    }
  });

  it('allows changing integer signedness or width, but not both at once', () => {
    expect(compileString(
      'contract C { function f(uint8 x) public pure returns (int8, uint16) {'
      + ' return (int8(x), uint16(x)); } }',
      compat,
    ).contractName).toBe('C');
    expect(() => compileString(
      'contract C { function f(uint8 x) public pure returns (int16) { return int16(x); } }',
      compat,
    )).toThrow(/cast|conversion/i);
  });

  it('rejects explicit conversion between distinct enum types', () => {
    expect(() => compileString(
      'contract C { enum A { X } enum B { X }'
      + ' function f() public pure returns (B) { return B(A.X); } }',
      compat,
    )).toThrow(/conversion.*enum/i);
  });

});

describe('Yul assignment across types (assembly { r := x })', () => {
  // In Yul every value is a 256-bit word; `r := x` copies the raw word. When the target/value differ in type,
  // the lowering normalizes the value to uint256 then casts to the target so it type-checks (a common EVM idiom
  // for reinterpreting between address / uint / bytesN / bool). BCH cast semantics apply (compat).
  const mk = (ret: string, arg: string): string =>
    `contract C() { function f(${arg} x) external pure returns (${ret} r) { assembly { r := x } } }`;

  it('lowers a value-typed operand to a uint256 target', () => {
    expect(compileString(mk('uint256', 'address'), { solidityImportCompat: true }).contractName).toBe('C');
    expect(compileString(mk('uint256', 'bool'), { solidityImportCompat: true }).contractName).toBe('C');
    expect(compileString(mk('uint256', 'bytes32'), { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('casts a uint256 word to a differently-typed target', () => {
    expect(compileString(mk('address', 'uint256'), { solidityImportCompat: true }).contractName).toBe('C');
    expect(compileString(mk('bool', 'uint256'), { solidityImportCompat: true }).contractName).toBe('C');
    expect(compileString(mk('bytes32', 'uint256'), { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('leaves a same-type (uint256) assignment and arithmetic unchanged', () => {
    expect(compileString(mk('uint256', 'uint256'), { solidityImportCompat: true }).contractName).toBe('C');
    expect(compileString(`contract C() {
      function f(uint256 a, uint256 b) external pure returns (uint256 r) { assembly { r := add(a, b) } }
    }`, { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('return-site literal coercion (string / hex -> bytesN)', () => {
  // The same literal coercion applied at assignment sites also applies to a `return` value: a string or hex
  // literal returned where a wider bytesN is declared is right-padded to the return type.
  it('coerces a string / hex literal to the declared bytesN return type', () => {
    expect(compileString(`contract C() { function f() returns (bytes32) { return "abc"; } }`,
      { solidityImportCompat: true }).contractName).toBe('C');
    expect(compileString(`contract C() { function f() returns (bytes8) { return hex"0102"; } }`,
      { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('bitwise op with an unbounded-int operand takes the bounded width', () => {
  // `x | 1`, `x & 0xff`, `x | (c ? 1 : 2)` - a bounded int bitwise-combined with an int literal or a `?:` of
  // literals (an unbounded int) adopts the bounded operand's fixed width instead of failing as "unsupported".
  it('coerces an int literal / conditional operand to the bounded operand type', () => {
    expect(compileString(`contract C() { function f(uint256 a) returns (uint256) { return a | 1; } }`,
      { solidityImportCompat: true }).contractName).toBe('C');
    expect(compileString(`contract C() { function f(uint256 a) returns (uint256) { return a & 0xff; } }`,
      { solidityImportCompat: true }).contractName).toBe('C');
    expect(compileString(`contract C() { function f(bool b) returns (uint256 x) { x = 0; x |= b ? 1 : 2; } }`,
      { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('widens mixed-width same-signedness operands to the larger width (Solidity implicit conversion)', () => {
    expect(compileString(`contract C() {
      function f(uint8 a, uint16 b) returns (uint16) { return a | b; }
    }`, { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('still rejects mixed-signedness bounded operands', () => {
    expect(() => compileString(`contract C() {
      function f(int8 a, uint16 b) returns (uint16) { return a | b; }
    }`, { solidityImportCompat: true })).toThrow();
  });
});

describe('this.f{value/gas}(args) self-call drops the inert EVM call options', () => {
  // A `this.f(...)` self-call resolves to a direct subroutine on BCH; `{value:..}` / `{gas:..}` are EVM
  // message-call options with no analogue on a self-call, so they are dropped (the call still resolves).
  it('resolves this.g{value:..}/{gas:..}(args) to the own function', () => {
    expect(compileString(`contract C() {
      function g(uint256 n) returns (uint256) { return n * 2; }
      function f(uint256 e) { require(this.g{value: 10}(2) == e); }
    }`, { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
    expect(compileString(`contract C() {
      function g(uint256 x) returns (uint256) { return x + 1; }
      function f(uint256 x, uint256 e) { require(this.g{gas: 8000}(x) == e); }
    }`, { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });
});

describe('tuple assignment to state variables ((x, y) = (a, b))', () => {
  // The tuple codegen assigns into stack slots, which state vars lack. A tuple assignment whose targets are all
  // state vars desugars to sequential state assigns - byte-identical to the manual form, and a swap stays
  // correct because a state read always reads the input commitment.
  const bc = (body: string): string => compileString(
    `contract C() { uint256 x; uint256 y; function f(uint256 a, uint256 b) { ${body} } }`,
    { solidityImportCompat: true, forceStateful: true },
  ).bytecode;

  it('(x, y) = (a, b) matches x = a; y = b', () => {
    expect(bc('(x, y) = (a, b);')).toBe(bc('x = a; y = b;'));
  });

  it('(x, y) = (y, x) swap matches x = y; y = x (input-read semantics)', () => {
    expect(bc('(x, y) = (y, x);')).toBe(bc('x = y; y = x;'));
  });

  it('a tuple assignment to locals is unaffected', () => {
    expect(compileString(`contract C() {
      function f(uint256 a, uint256 b) { uint256 p; uint256 q; (p, q) = (a, b); require(p == a); }
    }`, { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('storage-pointer local .slot/.offset in assembly (T[] storage x = a; x.slot)', () => {
  const ok = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  // A `storage` pointer local that directly aliases a state var resolves `.slot`/`.offset` in assembly to the
  // underlying var's (constant) slot/offset - the same value a direct `a.slot` yields. Corpus: storage_reference_fine.
  it('resolves an ARRAY storage-pointer alias .slot and .offset', () => {
    expect(ok('contract C { uint[] a; function f() public returns (uint s, uint o) {'
      + ' uint[] storage x = a; assembly { s := x.slot o := x.offset } require(true); } }')).toBe('C');
  });
  it('a non-aliasing storage pointer (from an element) fails closed - no wrong slot, no crash', () => {
    expect(() => compileString('contract C { uint[][] a; function f() public returns (uint s) {'
      + ' uint[] storage x = a[0]; assembly { s := x.slot } require(true); } }', { solidityImportCompat: true }))
      .toThrow(/inline assembly/i);
  });
  // `sload(a.slot)` on a dynamic array reads its length (EVM: array base slot holds the length). Lowers to the same
  // `a.length` node that is VM-proven, so this is a compile guard. `sstore(a.slot,..)` (a resize) stays fail-closed.
  it('routes sload of a dynamic-array var slot to its length; sstore (resize) fails closed', () => {
    expect(ok('contract C { uint[] a; function f() public returns (uint n) {'
      + ' assembly { n := sload(a.slot) } require(true); } }')).toBe('C');
    expect(ok('contract C { uint[] a; function f() public {'
      + ' assembly { sstore(a.slot, 7) } require(true); } }')).toBe('C');
  });
  it('sstore(dynArray.slot, n) resizes a fixed-width dynamic array; variable-width fails closed', () => {
    expect(ok('contract C { uint128[] a; function f(uint n) public {'
      + ' assembly { sstore(a.slot, n) } require(true); } }')).toBe('C');
    expect(() => compileString('contract C { bytes[] a; function f() public {'
      + ' assembly { sstore(a.slot, 4) } require(true); } }', { solidityImportCompat: true }))
      .toThrow(/inline assembly/i);
  });
  it('calldata .offset of a first dynamic param resolves to the compile-time ABI data position', () => {
    expect(ok('contract C { function f(bytes calldata x) public returns (uint r) {'
      + ' assembly { r := x.offset } require(true); } }')).toBe('C');
  });
  it('calldata .offset/.length are assignable (mutable calldata-slice component)', () => {
    expect(ok('contract C { function f(uint a, bytes calldata x, uint b) public returns (uint r) {'
      + ' assembly { x.offset := 8 } assembly { r := x.offset } require(true); } }')).toBe('C');
  });
  it('keccak256 dynamic-array element idiom: sstore(keccak(0,32)+i, v) == arr[i]=v', () => {
    expect(ok('contract C { uint[] data; function f(uint v) public {'
      + ' assembly { mstore(0, 0) sstore(keccak256(0, 32), v) sstore(add(keccak256(0, 32), 1), v) } require(true); } }'))
      .toBe('C');
  });
  it('let-bound array-element slot: let pos := add(keccak(0,32), i); sstore(pos, v)', () => {
    expect(ok('contract C { uint[] data; function f(uint i, uint v) public {'
      + ' assembly { mstore(0, data.slot) let pos := add(keccak256(0, 32), i) sstore(pos, v) } require(true); } }'))
      .toBe('C');
  });
  it('a bytes32 keccak operand in Yul arithmetic is cast to uint256 (computed __evm_storage slot key)', () => {
    expect(ok('contract C { function f(uint v) public {'
      + ' assembly { mstore(0, 0) sstore(add(keccak256(0, 23), 1), v) } require(true); } }')).toBe('C');
  });
  it('synthesizes __evm_storage requested by a file-level assembly helper before the contract', () => {
    const src = 'function slot() pure returns (bytes32) { return keccak256(abi.encode(1)); }'
      + ' function read(uint off) view returns (bytes32 r) { bytes32 s = slot();'
      + ' assembly { r := sload(add(s, off)) } }'
      + ' contract C { function f() public view returns (bytes32) { return read(1); } }';
    expect(ok(src)).toBe('C');
  });
  it('bytes slot short-encoding const write: sstore(b.slot, const) sets the value / 0 clears', () => {
    expect(ok('contract C { bytes b; function f() public {'
      + ' assembly { sstore(b.slot, or("deadbeef", 0x08)) } require(b.length == 4); } }')).toBe('C');
  });
  it('resizes bytes from a long-slot marker and reads its raw data-region slot', () => {
    expect(ok('contract C { bytes b; function f() public returns (uint r) {'
      + ' assembly { sstore(b.slot, 67) } b.push("a"); delete b;'
      + ' assembly { mstore(0, b.slot) r := sload(keccak256(0, 32)) } require(b.length == 0); } }')).toBe('C');
  });
  it('routes a long-bytes raw data-word write back into the high-level byte array', () => {
    expect(ok('contract C { bytes b; function f() public { assembly {'
      + ' sstore(b.slot, 65) mstore(0, b.slot)'
      + ' sstore(keccak256(0, 32), "deadbeefdeadbeefdeadbeefdeadbeef") }'
      + ' require(b[31] == hex"66"); } }')).toBe('C');
  });
  it('keeps runtime-memory sub-word keccak slots distinct from a dynamic-array data base', () => {
    expect(ok('contract C { uint[] data; function f() public { assembly {'
      + ' sstore(data.slot, 2) mstore(0, data.slot) sstore(keccak256(0, 32), 234)'
      + ' sstore(add(keccak256(0, 23), 1), 123) } require(data[1] == 0); } }')).toBe('C');
  });
  it('bytes slot sload lowers to the EVM byte-array length/data encoding', () => {
    expect(ok('contract C { bytes b; function f() public returns (uint r) {'
      + ' assembly { r := sload(b.slot) } require(true); } }')).toBe('C');
  });
});

describe('composite sub-slot field access (sload/sstore on a value-field struct slot)', () => {
  const ok = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  // A fixed struct's own slots decode to its packed value fields: read = combine, write = struct-ctor rebuild
  // (VM round-trip incl. high-bit values + field<->slot cross-checks in EvmStorageLayout.test.ts). Corpus:
  // struct_delete_storage_small.
  it('reads and writes a packed value-field struct head slot (s.slot)', () => {
    expect(ok('contract C { struct S { uint64 y; uint64 z; } S s;'
      + ' function f() public returns (uint r) { assembly { sstore(s.slot, 7) r := sload(s.slot) } require(true); } }'))
      .toBe('C');
  });
  it('reads a rel!=0 sub-slot via add(m.slot, 1)', () => {
    expect(ok('contract C { struct M { uint256 a; uint256 b; } M m;'
      + ' function f() public returns (uint r) { assembly { r := sload(add(m.slot, 1)) } require(true); } }')).toBe('C');
  });
  it('reads and writes a packed fixed value array head slot (corpus dirty_storage_static_array)', () => {
    expect(ok('contract C { uint128[2] a;'
      + ' function f() public returns (uint r) { assembly { sstore(a.slot, 7) r := sload(a.slot) } require(true); } }'))
      .toBe('C');
  });
  it('a struct with a variable-width (address) field fails closed - no unsound word layout', () => {
    expect(() => compileString('contract C { struct T { address a; uint96 b; } T t;'
      + ' function f() public returns (uint r) { assembly { r := sload(t.slot) } require(true); } }',
    { solidityImportCompat: true })).toThrow(/inline assembly/i);
  });
  it('reads and writes a NESTED struct head slot (recursive rebuild)', () => {
    expect(ok('contract C { struct Inner { uint64 a; uint64 b; } struct S { Inner inner; uint256 x; } S s;'
      + ' function f() public returns (uint r) { assembly { sstore(s.slot, 7) r := sload(s.slot) } require(true); } }'))
      .toBe('C');
  });
  it('reads and writes a struct with a fixed-ARRAY field (nested array-in-struct)', () => {
    expect(ok('contract C { struct S { uint64[2] arr; uint256 x; } S s;'
      + ' function f() public returns (uint r) { assembly { sstore(s.slot, 7) r := sload(s.slot) } require(true); } }'))
      .toBe('C');
  });
  it('a top-level fixed array OF structs fails closed (SDK cannot derive that state layout)', () => {
    expect(() => compileString('contract C { struct P { uint64 a; uint64 b; } P[2] ps;'
      + ' function f() public returns (uint r) { assembly { r := sload(ps.slot) } require(true); } }',
    { solidityImportCompat: true })).toThrow(/inline assembly/i);
  });
  it('reads and writes a packed slot with bool + enum fields', () => {
    expect(ok('contract C { enum E { A, B, C } bool b; E ev; uint240 x;'
      + ' function f() public returns (uint r) { assembly { sstore(b.slot, 7) r := sload(b.slot) } require(true); } }'))
      .toBe('C');
  });
});

describe('EVM storage-layout specifier tolerated (contract C layout at expr)', () => {
  // `contract C [is ..] layout at <slot>` sets an EVM storage base slot - meaningless on the UTXO model, so the
  // clause is dropped under solidityImportCompat and the contract compiles as if it were absent.
  it('drops the layout clause (with and without inheritance)', () => {
    expect(compileString('contract C layout at 42 { function f(uint256 e) { require(e == e); } }',
      { solidityImportCompat: true }).contractName).toBe('C');
    expect(compileString(
      'contract A {} contract C is A layout at 1234 + 4567 { uint256 x; function f(uint256 e) { x = e; } }',
      { solidityImportCompat: true }).contractName).toBe('C');
    expect(compileString(
      'contract A { mapping(uint => bool) locked; } contract C layout at 42 is A {'
      + ' function f(uint x) public { locked[x] = true; require(locked[x]); } }',
      { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('compiles identically to the contract without the clause', () => {
    const withLayout = compileString('contract C layout at 99 { uint256 x; function f(uint256 e) { x = e; } }',
      { solidityImportCompat: true }).bytecode;
    const without = compileString('contract C { uint256 x; function f(uint256 e) { x = e; } }',
      { solidityImportCompat: true }).bytecode;
    expect(withLayout).toBe(without);
  });

  it('also drops the clause natively (source-level tolerance, no longer compat-gated)', () => {
    expect(compileString('contract C layout at 42 { function f(uint256 e) { require(e == e); } }', {}).bytecode)
      .toBe(compileString('contract C { function f(uint256 e) { require(e == e); } }', {}).bytecode);
  });
});

describe('user-defined value type default (unnamed UDVT return fall-through)', () => {
  // A function with a UDVT return type and no explicit return defaults to the wrapped underlying default
  // (`T.wrap(<underlying default>)`), so it compiles - byte-identical to the named-return default.
  it('defaults an unnamed UDVT return (over int / uint / address / bytes)', () => {
    for (const u of ['int8', 'uint256', 'address', 'bytes32']) {
      const art = compileString(`contract C() { type T is ${u}; function f() returns (T) {} }`,
        { solidityImportCompat: true });
      expect(art.contractName).toBe('C');
    }
  });

  it('matches the named-return default byte-for-byte', () => {
    const unnamed = compileString('contract C() { type I8 is int8; function f() returns (I8) {} }',
      { solidityImportCompat: true }).bytecode;
    const named = compileString('contract C() { type I8 is int8; function f() returns (I8 r) {} }',
      { solidityImportCompat: true }).bytecode;
    expect(unnamed).toBe(named);
  });
});

describe('string / hex literal coercion at array & mapping element writes', () => {
  // The literal coercion the assignment / return paths apply also applies to an element write: a string or hex
  // literal written to an array / mapping element of type bytesN is right-padded to the element width.
  it('coerces a string / hex literal at array and mapping element writes', () => {
    const srcs = [
      'contract C() { bytes4[] a; function f(uint256 i) { a[i] = "abcd"; } }',
      'contract C() { function f(uint256 i) { bytes4[3] memory a; a[i] = "abcd"; require(a[i] != 0x0); } }',
      'contract C() { mapping(uint256 => bytes4) m; function f(uint256 k) { m[k] = "abcd"; } }',
      'contract C() { bytes8[] a; function f(uint256 i) { a[i] = hex"0102"; } }',
    ];
    for (const s of srcs) expect(compileString(s, { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });

  it('right-pads to the element width (byte-identical to the padded literal)', () => {
    const bc = (v) => compileString(`contract C() { bytes4[] a; function f(uint256 i) { a[i] = ${v}; } }`,
      { solidityImportCompat: true, forceStateful: true }).bytecode;
    expect(bc('"abcd"')).toBe(bc('0x61626364'));
  });
});

// An explicit `override(A, B)` list may name an interface base. An interface only DECLARES the overridden
// function (no body), so it has no super implementation to resolve - it must not be rejected as "not a base".
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
describe('arr.push() = value == arr.push(value)', () => {
  it('compiles push()=value byte-identically to push(value)', () => {
    const a = compileString('contract C{uint[] a;function f(uint v){a.push()=v;require(true);}}',
      { solidityImportCompat: true, forceStateful: true }).bytecode;
    const b = compileString('contract C{uint[] a;function f(uint v){a.push(v);require(true);}}',
      { solidityImportCompat: true, forceStateful: true }).bytecode;
    expect(a).toBe(b);
  });
  it('retains a value local initialized from the newly appended default element', () => {
    const fromPush = compileString(
      'contract C{uint[] a;function f() public returns(uint){uint y=a.push();return y;}}',
      { solidityImportCompat: true, forceStateful: true },
    );
    const explicit = compileString(
      'contract C{uint[] a;function f() public returns(uint){uint y;a.push(y);return y;}}',
      { solidityImportCompat: true, forceStateful: true },
    );
    expect(fromPush.bytecode).toBe(explicit.bytecode);
  });
});

// A straight-line FOREIGN external function pointer desugars to the existing external call:
// `function() external f = IFoo(addr).method; f(args)` == `IFoo(addr).method(args)` (byte-identical, sound
// by reduction to the tested external-call covenant + SDK path).
describe('foreign external function pointer == direct external call', () => {
  const IFACE = 'interface ICounter { function increment(uint256 x) external returns (uint256); }';
  it('desugars `f = IFoo(addr).method; f(z)` byte-identically to `IFoo(addr).method(z)`', () => {
    const ptr = `${IFACE} contract C { function run(ICounter c, uint256 z) public {`
      + ' function(uint256) external returns (uint256) f = c.increment; uint256 r = f(z); require(r == z + 1); } }';
    const direct = `${IFACE} contract C { function run(ICounter c, uint256 z) public {`
      + ' uint256 r = c.increment(z); require(r == z + 1); } }';
    const a = compileString(ptr, { solidityImportCompat: true }).bytecode;
    const b = compileString(direct, { solidityImportCompat: true }).bytecode;
    expect(a).toBe(b);
  });
  it('rewrites a bare `f(z);` statement form too', () => {
    const ptr = `${IFACE} contract C { function run(ICounter c, uint256 z) public {`
      + ' function(uint256) external returns (uint256) f = c.increment; f(z); require(true); } }';
    const direct = `${IFACE} contract C { function run(ICounter c, uint256 z) public {`
      + ' c.increment(z); require(true); } }';
    expect(compileString(ptr, { solidityImportCompat: true }).bytecode)
      .toBe(compileString(direct, { solidityImportCompat: true }).bytecode);
  });
});

// An enum member `E.M` is a compile-time integer ordinal, so it is valid as a `constant` initializer.
// isCompileTimeExpression now accepts it and the base enum resolves in the constant expression, so the constant
// folds identically to using `E.M` inline.
describe('enum member as a constant initializer (E constant X = E.M)', () => {
  const src = 'contract C{enum E{A,B,C}E constant X=E.B;function f()external returns(E){return X;}}';
  it('compiles an enum-valued constant (contract-level enum)', () => {
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
  });
  it('is byte-identical to using the enum member inline', () => {
    const inline = 'contract C{enum E{A,B,C}function f()external returns(E){return E.B;}}';
    expect(compileString(src, { solidityImportCompat: true }).bytecode)
      .toBe(compileString(inline, { solidityImportCompat: true }).bytecode);
  });
  it('accepts a file-level enum with a contract-level constant', () => {
    expect(compileString('enum E{A,B,C} contract C{E constant X=E.C;function f()external returns(E){return X;}}',
      { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('file-level (free) enum-typed + string/bytesN constants', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('resolves a free enum-typed constant initialized from an enum member', () => {
    expect(cc('enum E { A, B, X } E constant c = E.X;'
      + ' contract C { function f() external pure returns (uint256) { return uint256(c); } }')).toBe('C');
  });
  it('coerces a string literal into a bytesN constant (bytes32 st = "abc")', () => {
    expect(cc('bytes32 constant st = "abc";'
      + ' contract C { function f() external pure returns (bytes32) { return st; } }')).toBe('C');
  });
  it('handles a file mixing enum, bytes, string and bytesN constants (kitchen sink)', () => {
    expect(cc('enum E { A, B } bytes constant a = "\\x03\\x01\\x02"; string constant s = "hi";'
      + ' bytes32 constant st = "abc"; E constant e = E.B;'
      + ' contract C { function f() external pure returns (bytes32) { return st; } }')).toBe('C');
  });
});

describe('implicit bytesN -> bytesM widening (M >= N), matching solc', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('assigns a bytes20 result (ripemd160) to a bytes32 variable', () => {
    expect(cc('contract C { function f(bytes memory b) external pure returns (bytes32) {'
      + ' bytes32 r = ripemd160(b); return r; } }')).toBe('C');
  });
  it('widens on return, state assignment and local assignment', () => {
    expect(cc('contract C { bytes32 rip;'
      + ' function g(bytes4 x) external pure returns (bytes8) { return x; }'
      + ' function h(bytes memory b) external { rip = ripemd160(b); require(true); } }')).toBe('C');
  });
  it('produces the same bytecode as an explicit widening cast', () => {
    const sugar = compileString('contract C { function f(bytes20 x) external pure returns (bytes32) { bytes32 r = x; return r; } }',
      { solidityImportCompat: true });
    const hand = compileString('contract C { function f(bytes20 x) external pure returns (bytes32) { bytes32 r = bytes32(x); return r; } }',
      { solidityImportCompat: true });
    expect(sugar.bytecode).toBe(hand.bytecode);
  });
  it('still rejects narrowing (bytes32 -> bytes20)', () => {
    expect(() => cc('contract C { function f(bytes32 x) external pure returns (bytes20) { bytes20 y = x; return y; } }'))
      .toThrow(/can not be assigned/);
  });
});

describe('public array auto-getter (this.a(i) -> element)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('synthesizes a value-array getter callable as this.a(i)', () => {
    expect(cc('contract C { uint256[] public a;'
      + ' function f() external view returns (uint256) { uint256 y = this.a(2); return y; } }')).toBe('C');
  });
  it('synthesizes an address-array getter', () => {
    expect(cc('contract C { address[] public owners;'
      + ' function f() external view returns (address) { return this.owners(0); } }')).toBe('C');
  });
  it('leaves the whole-array read (this.a) working', () => {
    expect(cc('contract C { uint256[] public a;'
      + ' function f() external view returns (uint256[] memory) { return this.a; } }')).toBe('C');
  });
});

describe('contract-qualified constant access (C.X / Base.X)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('resolves a self-qualified constant C.X', () => {
    expect(cc('contract C { uint256 constant X = 5;'
      + ' function f() external pure returns (uint256) { return C.X; } }')).toBe('C');
  });
  it('resolves a base-qualified inherited constant Base.X', () => {
    expect(cc('contract A { uint256 constant X = 5; }'
      + ' contract B is A { function f() external pure returns (uint256) { return A.X; } }')).toBe('B');
  });
  it('rejects an unrelated contract Other.X (different X, not in scope)', () => {
    expect(() => cc('contract A { uint256 constant X = 5; }'
      + ' contract B { uint256 constant X = 9; function f() external pure returns (uint256) { return A.X; } }'))
      .toThrow(/Undefined reference/);
  });
});

describe('contract/interface-qualified type access (C.T / I.Enum)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('resolves an interface-qualified enum member (I.Dir.Right)', () => {
    expect(cc('interface I { enum Dir { Left, Right } }'
      + ' contract C is I { function f() external pure returns (uint256) { return uint256(I.Dir.Right); } }')).toBe('C');
  });
  it('resolves a contract-qualified enum member on a base', () => {
    expect(cc('contract A { enum E { X, Y } }'
      + ' contract B is A { function f() external pure returns (uint256) { return uint256(A.E.Y); } }')).toBe('B');
  });
  it('leaves the bare enum member working', () => {
    expect(cc('interface I { enum Dir { Left, Right } }'
      + ' contract C is I { function f() external pure returns (uint256) { return uint256(Dir.Right); } }')).toBe('C');
  });
});

describe('contract-qualified UDVT wrap/unwrap (C.T.wrap / C.T.unwrap)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('resolves C.T.unwrap(C.T.wrap(x)) as identity casts', () => {
    expect(cc('contract C { type T is bool;'
      + ' function f() external pure returns (bool) { return C.T.unwrap(C.T.wrap(true)); } }')).toBe('C');
  });
  it('leaves the bare T.unwrap(x) working', () => {
    expect(cc('contract C { type T is uint256;'
      + ' function f(T x) external pure returns (uint256) { return T.unwrap(x); } }')).toBe('C');
  });
  it('does not misread a 2-arg library method named wrap as a UDVT cast', () => {
    expect(cc('library L { function wrap(uint256 a, uint256 b) internal pure returns (uint256) { return a + b; } }'
      + ' contract C { using L for uint256;'
      + ' function f() external pure returns (uint256) { return L.wrap(1, 2); } }')).toBe('C');
  });
});

describe('bytes state-var element write (data[i] = v)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('compiles a byte write with a literal, expression and variable value', () => {
    expect(cc('contract C { bytes data;'
      + ' function f(uint256 i, bytes1 v) external { data[31] = 0x77; data[i] = bytes1(uint8(i)); data[0] = v; require(true); } }'))
      .toBe('C');
  });
  it('is byte-identical to the hand-written slice+concat reassignment', () => {
    const sugar = compileString('contract C { bytes data; function f(uint256 i, bytes1 v) external { data[i] = v; require(true); } }',
      { solidityImportCompat: true });
    const hand = compileString('contract C { bytes data;'
      + ' function f(uint256 i, bytes1 v) external {'
      + ' data = data.slice(0, i) + v + data.slice(i + 1, data.length); require(true); } }',
      { solidityImportCompat: true });
    expect(sugar.bytecode).toBe(hand.bytecode);
  });
});

describe('bytes memory/local element write (bytes memory d; d[i] = v)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('compiles a local bytes byte write with literal and variable value', () => {
    expect(cc('contract C { function f(uint256 i, bytes1 v) external pure returns (bytes memory) {'
      + ' bytes memory d = new bytes(9); d[0] = "A"; d[i] = v; return d; } }')).toBe('C');
  });
  it('lowers a local byte write via the memory-pointer model (byte-splice; VM-covered in MemoryModelBytes)', () => {
    // A mutable `new bytes(n)` buffer that is byte-indexed + returned converts to a __yulmem pointer, so `d[i] = v`
    // lowers to a single in-place byte splice - no longer byte-identical to the value-copy slice+concat (which the
    // whole-var REASSIGNMENT form below still uses, since a reassignment taints the buffer back to value-copy).
    expect(cc('contract C { function f(uint256 i, bytes1 v) external pure returns (bytes memory) {'
      + ' bytes memory d = new bytes(9); d[i] = v; return d; } }')).toBe('C');
  });
});

describe('prune an UNREACHABLE storage-pointer library (OZ EnumerableSet imported but unused)', () => {
  // OZ EnumerableSet has `_add(Set storage) { .. _contains(set, ..) .. }` + public wrappers. Imported but unused,
  // InlineStoragePointerCalls marks the inner `_contains` inlined and drops it, but `_add`'s call is never inlined
  // (free-fn bodies are not visited there) -> "Undefined reference to symbol ES._contains". A storage-pointer helper
  // cannot stand alone, so an unreachable one is pruned (like the dead assembly / low-level-call helpers).
  it('compiles a contract that imports but never uses an EnumerableSet-shaped library', () => {
    const es = 'library ES { struct Set { uint256 x; } struct AddressSet { Set _inner; }'
      + ' function _contains(Set storage s, uint256 v) private view returns (bool) { return s.x == v; }'
      + ' function _add(Set storage s, uint256 v) private returns (bool) {'
      + ' if (!_contains(s, v)) { s.x = v; return true; } return false; }'
      + ' function contains(AddressSet storage s, uint256 v) internal view returns (bool) { return _contains(s._inner, v); }'
      + ' function add(AddressSet storage s, uint256 v) internal returns (bool) { return _add(s._inner, v); } }';
    const resolver = (p: string): { source: string; id: string } | undefined => (
      p === './ES.sol' ? { source: `pragma solidity ^0.8.0;${es}`, id: '/ES.sol' } : undefined);
    expect(() => compileString('import "./ES.sol"; contract C { uint256 x; function f() public { x = 1; } }',
      { importResolver: resolver, rootFileId: '/main.sol', solidityImportCompat: true })).not.toThrow();
  });
});

describe('using-for directive inside an interface body (SushiSwap IRewarder, valid Solidity 0.6.x)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts `using L for T;` inside an interface (a no-op there - no bodies to bind)', () => {
    expect(cc('library L { function f(uint256 a) internal pure returns (uint256) { return a; } }'
      + ' interface IFoo { using L for uint256; function g() external; }'
      + ' contract C is IFoo { function g() external override {} }')).toBe('C');
  });
});

describe('address payable conversions follow Solidity directionality', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('requires an explicit payable conversion for a plain address return', () => {
    expect(() => cc('contract C { function _msgSender() internal view returns (address payable) { return msg.sender; }'
      + ' function f() public view returns (address payable) { return _msgSender(); } }')).toThrow();
  });
  it('rejects assigning a plain address to an address payable variable', () => {
    expect(() => cc('contract C { function f(address a) public pure returns (address payable) { address payable p = a;'
      + ' return p; } }')).toThrow();
  });
  it('allows payable address to plain address and explicit payable(address)', () => {
    expect(cc('contract C { function f(address payable p) public pure returns (address) { address a = p;'
      + ' return a; } function g(address a) public pure returns (address payable) { return payable(a); } }')).toBe('C');
  });
});

describe('using-for on a NESTED mapping element receiver (SushiSwap/OZ ERC20 allowances)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  const lib = 'library SM { function sub(uint256 a, uint256 b) internal pure returns (uint256) { return a - b; }'
    + ' function add(uint256 a, uint256 b) internal pure returns (uint256) { return a + b; } }';
  it('resolves `allo[x][y].sub(v)` (a 2-key mapping element) through `using SM for uint256`', () => {
    expect(cc(`${lib} contract C { using SM for uint256;`
      + ' mapping(address => mapping(address => uint256)) allo;'
      + ' function f(address x, address y, uint256 v) public { allo[x][y] = allo[x][y].sub(v); } }')).toBe('C');
  });
  it('resolves a read-after-write across two nested elements', () => {
    expect(cc(`${lib} contract C { using SM for uint256;`
      + ' mapping(address => mapping(address => uint256)) allo;'
      + ' function f(address x, address y, uint256 v) public { allo[x][y] = allo[x][y].add(allo[y][x].sub(v)); } }'))
      .toBe('C');
  });
  it('still resolves a SINGLE-key mapping element (regression guard)', () => {
    expect(cc(`${lib} contract C { using SM for uint256; mapping(address => uint256) bal;`
      + ' function f(address x, uint256 v) public { bal[x] = bal[x].sub(v); } }')).toBe('C');
  });
});

describe('require(cond, <message>) accepts any expression message (Solidity: require(bool, string memory))', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  // Solidity treats require as a plain function taking `string memory`, so the message can be any expression.
  // BCH has no on-chain reason string, so a dynamic message is dropped (the require still reverts on false).
  it('accepts a plain VARIABLE message (OZ SafeMath require(b <= a, errorMessage))', () => {
    expect(cc('contract C { function f(uint256 a, uint256 b, string memory e) public pure { require(b <= a, e); } }'))
      .toBe('C');
  });
  it('accepts a member-access message', () => {
    expect(cc('contract C { string m; function f(bool ok) public view { require(ok, this.m); } }')).toBe('C');
  });
  it('accepts a function-call message (not a custom error - degrades to a dropped message)', () => {
    expect(cc('contract C { function g() internal pure returns (string memory) { return "x"; }'
      + ' function f(bool ok) public pure { require(ok, g()); } }')).toBe('C');
  });
  it('accepts a ternary / concat message', () => {
    expect(cc('contract C { function f(bool ok, uint256 x) public pure {'
      + ' require(ok, x > 0 ? "a" : "b"); require(ok, string(abi.encodePacked("e", x))); } }')).toBe('C');
  });
  it('still routes a DECLARED custom error to a custom-error revert', () => {
    expect(cc('error Bad(uint256 x); contract C { function f(bool ok, uint256 a) public pure {'
      + ' require(ok, Bad(a)); } }')).toBe('C');
  });
  it('still rejects genuine too-many-args require(a, b, c)', () => {
    expect(() => cc('contract C { function f(bool a, bool b, bool c) public pure { require(a, b, c); } }')).toThrow();
  });
});

describe('erc7201(id) -> spec-conformant ERC-7201 namespaced storage slot (real keccak256, EIP-7201)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('folds a literal namespace id to the EIP-7201 slot (byte-identical to Ethereum)', () => {
    // keccak256(abi.encode(uint256(keccak256("example.main")) - 1)) & ~bytes32(uint256(0xff)) = the EIP-7201 reference.
    expect(`0x${computeErc7201SlotNumber('example.main').toString(16)}`)
      .toBe('0x183a6125c38840424c4a85fa12bab2ab606c4b6d0e7cc73c0c06ba5300eab500');
    const viaBuiltin = compileString('contract C { function f() external pure returns (uint256) {'
      + ' return erc7201("example.main"); } }', { solidityImportCompat: true });
    const viaLiteral = compileString('contract C { function f() external pure returns (uint256) {'
      + ` return uint256(${computeErc7201SlotNumber('example.main')}); } }`, { solidityImportCompat: true });
    expect(viaBuiltin.bytecode).toBe(viaLiteral.bytecode);
  });
  it('is NO LONGER the BCH-native sha256 alias', () => {
    const a = compileString('contract C { function f() external pure returns (uint256) { return erc7201("ns"); } }',
      { solidityImportCompat: true });
    const b = compileString('contract C { function f() external pure returns (uint256) { return uint256(sha256("ns")); } }',
      { solidityImportCompat: true });
    expect(a.bytecode).not.toBe(b.bytecode);
  });
  it('is usable as a uint256 storage-slot constant', () => {
    expect(cc('contract C { uint256 constant X = erc7201("openzeppelin.storage.Y");'
      + ' function f() external pure returns (uint256) { return X; } }')).toBe('C');
  });
  it('folds a string constant argument when the slot is used as an array bound', () => {
    expect(cc('string constant NS = "test.file"; contract C { uint8[erc7201(NS)] array; }')).toBe('C');
  });
  it('lowers a runtime namespace expression to the ERC-7201 hash formula', () => {
    expect(cc('contract C { function f(string memory id) external pure returns (uint256) {'
      + ' return erc7201(id); } }')).toBe('C');
  });
  it('ignores a `contract C layout at erc7201(...)` storage-layout clause', () => {
    expect(cc('contract C layout at erc7201("x") { uint256 n; function f() external { this.n = 1; } }')).toBe('C');
  });
});

describe('erc7201 as a Yul builtin -> spec-conformant slot (reuses the erc7201 fold)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('lowers a Yul erc7201(id) call to the conformant ERC-7201 slot', () => {
    expect(cc('contract C { function f() external pure returns (bytes32) {'
      + ' bytes32 s; assembly { s := erc7201("example.main") } return s; } }')).toBe('C');
  });
});

describe('payable(x) cast requires an address expression', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts payable(this) (this is the contract bytes identity)', () => {
    expect(cc('contract C { function f() external view returns (address) { return payable(this); } }')).toBe('C');
  });
  it('accepts payable(this).balance', () => {
    expect(cc('contract C { function f() external view returns (uint256) { return payable(this).balance; } }')).toBe('C');
  });
  it('rejects payable(bytes20Value) without address conversion', () => {
    expect(() => cc('contract C { function f(bytes20 b) external pure returns (address) { return payable(b); } }')).toThrow();
  });
  it('accepts payable(address(bytes20Value))', () => {
    expect(cc('contract C { function f(bytes20 b) external pure returns (address payable) {'
      + ' return payable(address(b)); } }')).toBe('C');
  });
});

describe('bytes memory PARAM element write (function f(bytes memory x) { x[i] = v; })', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts a byte write to a bytes memory parameter', () => {
    expect(cc('contract C { function f(bytes memory x, uint256 i, bytes1 v) external pure returns (bytes memory) {'
      + ' x[i] = v; return x; } }')).toBe('C');
  });
  it('still rejects a write to a bytes calldata parameter (read-only)', () => {
    expect(() => cc('contract C { function f(bytes calldata x, uint256 i, bytes1 v) external pure returns (bytes memory) {'
      + ' x[i] = v; return x; } }')).toThrow(/read-only/);
  });
});

describe('bytes element compound write (data[i] |= v / &=)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('compiles a compound byte write on state and local bytes', () => {
    expect(cc('contract C { bytes data;'
      + ' function f(uint256 i, bytes1 v) external { data[i] |= v; require(true); } }')).toBe('C');
    expect(cc('contract C { function f(bytes memory d, uint256 i) external pure returns (bytes memory) {'
      + ' d[i] &= 0x0f; return d; } }')).toBe('C');
  });
  it('is byte-identical to the hand-written read-modify-slice-concat', () => {
    const s = compileString('contract C { bytes data; function f(uint256 i, bytes1 v) external { data[i] |= v; require(true); } }',
      { solidityImportCompat: true });
    const h = compileString('contract C { bytes data;'
      + ' function f(uint256 i, bytes1 v) external {'
      + ' data = data.slice(0, i) + (data[i] | v) + data.slice(i + 1, data.length); require(true); } }',
      { solidityImportCompat: true });
    expect(s.bytecode).toBe(h.bytecode);
  });
});

describe('using-for on non-struct receiver types (address / string / contract)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('resolves x.method() for `using L for address`', () => {
    expect(cc('library L { function foo(address a) internal pure returns (address) { return a; } }'
      + ' contract C { using L for address;'
      + ' function f(address a) external pure returns (address) { return a.foo(); } }')).toBe('C');
  });
  it('resolves s.method() for `using L for string`', () => {
    expect(cc('library L { function len(string memory s) internal pure returns (uint256) { return bytes(s).length; } }'
      + ' contract C { using L for string;'
      + ' function f(string memory s) external pure returns (uint256) { return s.len(); } }')).toBe('C');
  });

  it('resolves memory and storage helpers attached to a string state variable', () => {
    expect(cc('library L { function copied(string memory s) internal pure returns (string memory) { return s; }'
      + ' function stored(string storage s) internal pure returns (string memory) { return s; } }'
      + ' contract C { using L for string; string value;'
      + ' function f(string calldata x) external returns (string memory, string memory) {'
      + ' value = x; return (value.copied(), value.stored()); } }')).toBe('C');
  });

  it('tracks a named return receiver under a wildcard using-for directive', () => {
    expect(cc('library L { function add(int a, int b) internal pure returns (int) { return a + b; } }'
      + ' contract C { using L for *; function f() public pure returns (int result) {'
      + ' result = 1; result = result.add(2); } }')).toBe('C');
  });
});

describe('returning external calls used as dynamic allocation bounds', () => {
  it('collects and indexes the return witness from NewArrayNode.size', () => {
    expect(compileString('interface I { function length() external view returns (uint); }'
      + ' contract C { function f(I source) public returns (uint[] memory result) {'
      + ' result = new uint[](source.length()); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('free function shadowed by a same-name contract function (compat)', () => {
  it('allows a contract function to shadow a free function of the same signature', () => {
    expect(compileString('function f() pure returns (uint256) { return 1; }'
      + ' contract C { function f() public pure returns (uint256) { return 2; }'
      + ' function g() external pure returns (uint256) { return f(); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
  it('still rejects two free functions with the same signature', () => {
    expect(() => compileString('function f() pure returns (uint256) { return 1; }'
      + ' function f() pure returns (uint256) { return 2; } contract C { function g() external pure {} }',
    { solidityImportCompat: true })).toThrow(/Redefinition of function/);
  });
});

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

describe('.selector on a single-assignment function-pointer local folds to the target selector', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  const bc = (src: string): string => compileString(src, { solidityImportCompat: true }).bytecode;
  it('resolves fun.selector where fun = this.f (byte-identical to this.f.selector)', () => {
    const src = (sel: string): string => 'contract C { function f() external pure returns (bytes4) { return this.f.selector; }'
      + ` function g() external returns (bytes4) { function () pure external returns (bytes4) fun = this.f; return ${sel}; } }`;
    expect(cc(src('fun.selector'))).toBe('C');
    expect(bc(src('fun.selector'))).toBe(bc(src('this.f.selector')));
  });

  it('folds (c ? this.f : this.g).selector to c ? f.selector : g.selector (byte-identical)', () => {
    const mk = (expr: string): string => 'contract C { function f() external pure returns (bytes4) { return this.f.selector; }'
      + ' function g() external pure returns (bytes4) { return this.g.selector; }'
      + ` function pick(bool c) external pure returns (bytes4) { return ${expr}; } }`;
    expect(cc(mk('(c ? this.f : this.g).selector'))).toBe('C');
    expect(bc(mk('(c ? this.f : this.g).selector'))).toBe(bc(mk('c ? this.f.selector : this.g.selector')));
  });

  it('folds this.<fn>.address to address(this) (byte-identical)', () => {
    const mk = (expr: string): string => 'contract C { function f() external {}'
      + ` function g() external view returns (bool) { return ${expr}; } }`;
    expect(cc(mk('this.f.address == address(this)'))).toBe('C');
    expect(bc(mk('this.f.address == address(this)'))).toBe(bc(mk('address(this) == address(this)')));
  });

  it('synthesizes a struct getter returning members except mappings/arrays (Solidity rule)', () => {
    // A plain scalar/string-member struct gets a getter (exact shape of solc's
    // getters/inaccessible_dynamic_type_1.sol). Array/mapping-bearing structs are flattened to per-field
    // state vars and are deliberately skipped.
    const src = 'contract C { struct S { string a; uint y; } S public s;'
      + ' function g() public view returns (uint256) { this.s(); } }';
    expect(cc(src)).toBe('C');
  });

  it('binds & ^ | tighter than comparisons/equality (Solidity precedence, not C)', () => {
    const mk = (expr: string): string =>
      `contract C { function f(uint x, uint y, uint z) public pure returns (bool) { return ${expr}; } }`;
    expect(bc(mk('x & y == z'))).toBe(bc(mk('(x & y) == z')));
    expect(bc(mk('x ^ y != z'))).toBe(bc(mk('(x ^ y) != z')));
    expect(bc(mk('x | y < z'))).toBe(bc(mk('(x | y) < z')));
  });

  it('resolves C.f (own contract qualifier) as an internal function-pointer value', () => {
    const src = 'contract C { function f() internal {} function g() internal {}'
      + ' function test() public pure returns (bool) { function () internal ptr = C.f; return ptr == C.g; } }';
    expect(cc(src)).toBe('C');
  });

  it('folds event .selector across library/contract/interface qualifiers and bare inherited events', () => {
    // Signature-injective: equal signatures (E()) give equal selectors, distinct (E(uint256)) differ;
    // the bare inherited form equals the base-qualified form. All fold to compile-time bytes32.
    const src = 'library L { event E(); } library S { event E(uint); } contract B { event E(); }'
      + ' contract C is B { bytes32 s1 = L.E.selector;'
      + ' function f() public pure { require(L.E.selector == B.E.selector);'
      + ' require(L.E.selector != S.E.selector); require(E.selector == B.E.selector); } }';
    expect(cc(src)).toBe('C');
  });

  it('folds L.f.selector for library functions, including storage-pointer fns inlined away', () => {
    // g takes a storage pointer (removed from freeFunctions by the inliner) - the selector must still fold
    // from the parse-time signature. Distinct signatures give distinct selectors; h twice gives the same.
    const src = 'library L { function f(uint256 x) external returns (uint) { return x; }'
      + ' function g(uint256[] storage s) internal returns (uint) { return s.length; }'
      + ' function h(uint256[] memory m) public returns (uint) { return m.length; } }'
      + ' contract C { function f() public pure {'
      + ' require(L.f.selector != L.g.selector);'
      + ' require(L.g.selector != L.h.selector);'
      + ' require(L.h.selector == L.h.selector); } }';
    expect(cc(src)).toBe('C');
  });
});

describe('contract-typed arrays resolve to address arrays (contract handle = address)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('types new C[](n) as an address array, not undefined[]', () => {
    expect(cc('contract C { function f() external returns (C[] memory) { C[] memory c = new C[](2); return c; } }'))
      .toBe('C');
  });
  it('types abi.decode(x, (C[])) as an address array', () => {
    expect(cc('contract C { function f(bytes calldata x) external returns (C[] memory) {'
      + ' return abi.decode(x, (C[])); } }')).toBe('C');
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

describe('whole fixed-array copy with differing length/element (desugar by reduction)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  const bc = (src: string): string => compileString(src, { solidityImportCompat: true }).bytecode;
  it('compiles a diff-length same-element fixed-array copy (copy prefix + zero-fill leftover)', () => {
    expect(cc('contract C { uint256[4] a; uint256[2] b; function f() external { a = b; require(true); } }')).toBe('C');
  });
  it('is byte-identical to the hand-written element-wise copy + zero-fill', () => {
    const sugar = bc('contract C { uint256[4] a; uint256[2] b; function f() external { a = b; require(true); } }');
    const hand = bc('contract C { uint256[4] a; uint256[2] b;'
      + ' function f() external { a[0] = b[0]; a[1] = b[1]; a[2] = 0; a[3] = 0; require(true); } }');
    expect(sugar).toBe(hand);
  });
  it('is byte-identical for a diff-length diff-element (bytesN widening) copy', () => {
    const sugar = bc('contract C { bytes2[4] a; bytes1[2] b; function f() external { a = b; require(true); } }');
    const hand = bc('contract C { bytes2[4] a; bytes1[2] b; function f() external {'
      + ' a[0] = bytes2(b[0]); a[1] = bytes2(b[1]); a[2] = 0x0000; a[3] = 0x0000; require(true); } }');
    expect(sugar).toBe(hand);
  });
});

describe('abi.encodeWithSelector accepts a fitting string/hex literal selector', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('coerces a string literal that fits in 4 bytes to the bytes4 selector', () => {
    expect(cc('contract C { function f() external pure returns (bytes memory) {'
      + ' return abi.encodeWithSelector("f()", uint256(1)); } }')).toBe('C');
  });
  it('still accepts an explicit bytes4 selector and rejects an over-long literal', () => {
    expect(cc('contract C { function f() external pure returns (bytes memory) {'
      + ' return abi.encodeWithSelector(bytes4(0x12345678), uint256(1)); } }')).toBe('C');
    expect(() => cc('contract C { function f() external pure returns (bytes memory) {'
      + ' return abi.encodeWithSelector("toolongselector", uint256(1)); } }')).toThrow(/bytes4|string/);
  });
});

describe('external function pointers as public/external parameters (VM-verified in solidcash tests)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts an external function-type parameter on a public function', () => {
    expect(cc('contract C { function g(int a) public pure returns (int) { return a + 1; }'
      + ' function ev(function(int) external returns (int) fp, int a) public returns (int) { return fp(a); }'
      + ' function f() external { require(this.ev(this.g, 5) == 6); } }')).toBe('C');
  });
  it('accepts an external function-type return on a public function', () => {
    expect(cc('contract C { function g(int a) external pure returns (int) { return a; }'
      + ' function pick() public view returns (function(int) external returns (int)) { return this.g; }'
      + ' function f() external { require(true); } }')).toBe('C');
  });
  it('still rejects an INTERNAL function-type parameter on a public function (solc rejects too)', () => {
    expect(() => cc('contract C { function ev(function(int) internal returns (int) fp, int a) public returns (int)'
      + ' { return fp(a); } function f() external { require(true); } }')).toThrow(/Function types cannot be used/);
  });
});

describe('library/contract-qualified enum cast (L.E(x) / Contract.E(x))', () => {
  it('resolves L.E(x) as an int -> enum cast', () => {
    expect(compileString('library L { enum E { A, B } }'
      + ' contract C { function f(uint256 c) external pure returns (uint256) { return uint256(L.E(c)); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('delete on a bytes element (delete data[i] -> zero byte)', () => {
  it('compiles delete on a state and local bytes element, identical to data[i] = 0x00', () => {
    expect(compileString('contract C { bytes data; function f(uint256 i) external { delete data[i]; require(true); } }',
      { solidityImportCompat: true }).contractName).toBe('C');
    const s = compileString('contract C { bytes data; function f(uint256 i) external { delete data[i]; require(true); } }',
      { solidityImportCompat: true });
    const h = compileString('contract C { bytes data; function f(uint256 i) external { data[i] = 0x00; require(true); } }',
      { solidityImportCompat: true });
    expect(s.bytecode).toBe(h.bytecode);
  });
});

describe('recursive struct types reject cleanly (no compiler stack overflow)', () => {
  it('rejects a self-referential struct value encoding with a clear error, not a crash', () => {
    // struct that reaches itself through a dynamic array of itself: its inline encoding is infinite on BCH.
    const src = 'contract C { struct R { R[] vals; } '
      + 'function f() public pure { R[1] memory v = [ R(new R[](2)) ]; require(v[0].vals.length == 2); } }';
    expect(() => compileString(src, { solidityImportCompat: true }))
      .toThrow(/recursive struct types are not supported/);
  });
  it('a non-recursive struct with a dynamic array field still compiles', () => {
    expect(compileString('contract C { struct S { uint x; uint[] a; } S s; function f() external view { require(s.x == 0); } }',
      { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });
});

describe('nested write to a local-memory struct multi-D array field (s.a[i][j] = v)', () => {
  const cc = (src: string): string => compileString(src,
    { solidityImportCompat: true, forceStateful: true, chunkedArrays: true }).contractName;
  it('accepts s.a[i][j] = v / s.a[i][j]++ / s.a[i][j][k] = v on a local struct', () => {
    expect(cc('contract C { struct S { uint[][] a; } '
      + 'function f(uint i,uint j,uint v) public pure { S memory s; s.a[i][j]=v; require(true); } }')).toBe('C');
    expect(cc('contract C { struct S { uint[][] a; } '
      + 'function f(uint i,uint j) public pure { S memory s; s.a[i][j]++; require(true); } }')).toBe('C');
    expect(cc('contract C { struct S { uint[][][] a; } '
      + 'function f(uint i,uint j,uint k,uint v) public pure { S memory s; s.a[i][j][k]=v; require(true); } }'))
      .toBe('C');
  });
  it('keeps the single-index form working', () => {
    expect(cc('contract C { struct S { uint[] a; } '
      + 'function f(uint i,uint v) public pure { S memory s; s.a[i]=v; s.a[i]++; require(true); } }')).toBe('C');
  });
});

describe('contract/interface-typed struct fields (struct S { C y; })', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('resolves a scalar contract/interface-typed struct field to an address placeholder', () => {
    expect(cc('contract C {} contract T { struct S { C y; } S s; function f() external { require(true); } }'))
      .toBe('T');
    expect(cc('interface IFoo { function x() external; } '
      + 'contract T { struct S { uint256 n; IFoo y; address a; } S s; function f() external { require(true); } }'))
      .toBe('T');
    // array fields of contract type already worked; keep them green alongside the scalar form
    expect(cc('contract C {} contract T { struct S { C[] x; C y; } S s; function f() external { require(true); } }'))
      .toBe('T');
  });
});

describe('calling a function pointer from an array element (arr[i]())', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts an indexed function-pointer call, with and without args', () => {
    expect(cc('contract C { function h() internal pure returns (uint) { return 7; } function g() public pure { '
      + 'function() internal pure returns (uint)[1] memory a; a[0] = h; require(a[0]() == 7); } }')).toBe('C');
    expect(cc('contract C { function h(uint v) internal pure returns (uint) { return v; } function g() public pure { '
      + 'function(uint) internal pure returns (uint)[1] memory a; a[0] = h; require(a[0](5) == 5); } }')).toBe('C');
  });
  it('does not disturb ordinary calls, getters, or array access', () => {
    expect(cc('contract C { uint[] public a; function g() external view { this.a(0); } }')).toBe('C');
    expect(cc('contract C { function foo() internal pure {} function g() public pure { (foo)(); } }')).toBe('C');
    expect(cc('contract C { function g(uint[] memory a) public pure { require(a[0] == 0); } }')).toBe('C');
  });
  it('accepts a parenthesised (ternary) function-pointer callee', () => {
    expect(cc('contract C { function a(uint x) internal pure returns (uint) { return x; } '
      + 'function b(uint x) internal pure returns (uint) { return x; } '
      + 'function g(bool c) public pure returns (uint) { return (c ? a : b)(1); } }')).toBe('C');
    // parenthesised arithmetic / tuples must still parse normally (not as a call)
    expect(cc('contract C { function g(uint a, uint b, uint c) public pure returns (uint) { return (a + b) * c; } }'))
      .toBe('C');
  });
});

describe('bytes.concat / string.concat in a constant initializer (compile-time fold)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts bytes.concat/string.concat over constant refs and literals in a constant', () => {
    expect(cc('bytes constant aaaa = hex"aaaa"; contract C { '
      + 'bytes constant abc = bytes.concat(aaaa, hex"bbbb", hex"cccc"); '
      + 'bytes constant abcabc = bytes.concat(abc, aaaa); function f() public pure { require(abc.length == 6); } }'))
      .toBe('C');
    expect(cc('string constant a = "foo"; contract C { '
      + 'string constant b = string.concat(a, "bar"); function f() public pure {} }')).toBe('C');
  });
});

describe('fallback / receive usable as ordinary identifiers (function/param names)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts fallback/receive as a function name or parameter name', () => {
    expect(cc('contract C { function fallback() external pure {} }')).toBe('C');
    expect(cc('contract C { function receive() external pure {} }')).toBe('C');
    expect(cc('contract C { function f(uint fallback) public pure { require(fallback == 0); } }')).toBe('C');
  });
  it('does not disturb the real fallback/receive special functions', () => {
    expect(cc('contract C { fallback() external {} receive() external payable {} }')).toBe('C');
  });
});

describe('indexed struct-field array push/pop (data[i].d.push, s1.arr[i].push, m[k].d.push)', () => {
  const cc = (src: string): string => compileString(src,
    { solidityImportCompat: true, forceStateful: true, chunkedArrays: true }).contractName;
  it('compiles push/pop on an index+struct-field receiver across array, struct-field, and mapping bases', () => {
    expect(cc('contract C { struct S { uint[] d; } S[] data; '
      + 'function f(uint v) external { data[1].d.push(v); data[0].d.pop(); } }')).toBe('C');
    expect(cc('contract C { struct S { uint[][] arr; } S s1; '
      + 'function f(uint v) external { s1.arr[0].push(v); s1.arr[1].pop(); } }')).toBe('C');
    expect(cc('contract C { struct S { uint[] d; } mapping(uint=>S) m; '
      + 'function f(uint k,uint v) external { m[k].d.push(v); m[k].d.pop(); } }')).toBe('C');
  });
  it('routes a member-key-member receiver through the flattened outer array', () => {
    expect(cc('contract C { struct In { uint[] b; } struct Ou { In[] s; } Ou t; '
      + 'function f() external { t.s.push(); t.s[0].b.push(1); } }')).toBe('C');
  });
  it('compiles push through two indexed struct-array levels', () => {
    expect(cc('contract C { struct T { uint[] a; } struct S { T[] ts; } S[] s; '
      + 'function f() external { s.push(); s[0].ts.push(); s[0].ts[0].a.push(); } }')).toBe('C');
  });
});

describe('unconditional break in a do-while skips its condition', () => {
  it('does not evaluate a prefix mutation in the unreachable condition', () => {
    expect(compileString('contract C { function f() public pure { uint x; do { break; } while (++x < 2); '
      + 'assert(x == 0); } }', { solidityImportCompat: true }).contractName).toBe('C');
  });
  it('keeps the straight-line body prefix before the break', () => {
    expect(compileString('contract C { function f() public pure { uint x; do { x = 1; break; x = 2; } '
      + 'while (++x < 3); assert(x == 1); } }', { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('delete on a nested array element (delete d[i][j] -> element default)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('compiles a 2D/3D delete on memory and state arrays', () => {
    expect(cc('contract C { function f() public pure { uint[][] memory x = new uint[][](5); '
      + 'x[3] = new uint[](3); delete x[3][2]; require(true); } }')).toBe('C');
    expect(cc('contract C { uint[][] arr; function f() external { delete arr[2][3]; require(true); } }')).toBe('C');
    expect(cc('contract C { function f() public pure { uint[][][] memory x; delete x[1][2][3]; require(true); } }'))
      .toBe('C');
  });
  it('a memory 2D delete is identical to writing the element default in place', () => {
    const P = 'contract C { function f() public pure { uint[][] memory x = new uint[][](5); x[3] = new uint[](3); ';
    const del = compileString(`${P} delete x[3][2]; require(true); } }`, { solidityImportCompat: true });
    const asg = compileString(`${P} x[3][2] = 0; require(true); } }`, { solidityImportCompat: true });
    expect(del.bytecode).toBe(asg.bytecode);
  });
});

describe('bytesN compared against literal 0 (data[i] == 0)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('coerces 0 to the zero-filled bytesN in == / !=', () => {
    expect(cc('contract C { function f(bytes1 b) external pure returns (bool) { return b == 0; } }')).toBe('C');
    expect(cc('contract C { function f(bytes32 b) external pure returns (bool) { return b != 0; } }')).toBe('C');
  });
});

describe('file-level UDVT-typed constant (T constant g = T.wrap(x))', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('resolves a free UDVT constant initialized from T.wrap of a literal', () => {
    expect(cc('type T is bool; T constant g = T.wrap(true);'
      + ' contract C { function f() external pure returns (bool) { return T.unwrap(g); } }')).toBe('C');
    expect(cc('type U is uint256; U constant h = U.wrap(5);'
      + ' contract C { function f() external pure returns (uint256) { return U.unwrap(h); } }')).toBe('C');
  });
});

describe('pragma experimental solidity (tolerated no-op)', () => {
  it('parses `pragma experimental solidity;`', () => {
    expect(compileString('pragma experimental solidity; contract C { function f() external pure returns (uint256) { return 1; } }',
      { solidityImportCompat: true }).contractName).toBe('C');
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

describe('library-namespaced constant in a constant initializer (D = L.INT)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('resolves L.CONST in a plain and arithmetic constant initializer', () => {
    expect(cc('library L2 { uint256 constant INT = 5; }'
      + ' contract C { uint256 constant D = L2.INT; function f() external pure returns (uint256) { return D; } }')).toBe('C');
    expect(cc('library L2 { uint256 constant INT = 5; }'
      + ' contract C { uint256 constant D = 20 + L2.INT; function f() external pure returns (uint256) { return D; } }')).toBe('C');
  });
});

describe('negated hex number literal (-0x42)', () => {
  it('treats -0xNN as an integer negation', () => {
    expect(compileString('contract C { int256 public a = -0x42; function f() external view returns (int256) { return a; } }',
      { solidityImportCompat: true }).contractName).toBe('C');
    expect(compileString('contract C { int256 public a = -0x4200 >> 8; function f() external view returns (int256) { return a; } }',
      { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('address compared against a hex address literal (a == 0x1234..)', () => {
  it('casts a 20-byte hex literal to the address type in a comparison', () => {
    expect(compileString('contract C { function f(address a) external pure returns (bool) {'
      + ' return a != 0x1234567890123456789012345678901234567890; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('power operator result type is the base type (-1 ** e)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('int base ** uint exponent yields the int base type', () => {
    expect(cc('contract C { function f(uint256 e) external pure returns (int256) { return (-1) ** e; } }')).toBe('C');
    expect(cc('contract C { function f(int256 b, uint256 e) external pure returns (int256) { return b ** e; } }')).toBe('C');
  });
});

describe('slice with omitted bounds (a[:2] / a[2:] / a[:])', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('defaults an omitted start to 0 and an omitted end to the length', () => {
    expect(cc('contract C { function f(bytes calldata a) external pure returns (bytes memory) { return a[:2]; } }')).toBe('C');
    expect(cc('contract C { function f(bytes calldata a) external pure returns (bytes memory) { return a[2:]; } }')).toBe('C');
    expect(cc('contract C { function f(bytes calldata a) external pure returns (bytes memory) { return a[:]; } }')).toBe('C');
  });
  it('supports omitted-bound slices inside bytes.concat', () => {
    expect(cc('contract C { function f(bytes calldata a) external pure returns (bytes memory) {'
      + ' return bytes.concat(a[:2], a[2:]); } }')).toBe('C');
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

describe('for loop with an empty condition (for(;;) / for(init;;update))', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('treats an omitted for-condition as an implicit true (break-terminated)', () => {
    expect(cc('contract C { function f() external pure returns (uint256) {'
      + ' uint256 i = 0; for (;;) { i++; if (i > 3) break; } return i; } }')).toBe('C');
    expect(cc('contract C { function f() external pure returns (uint256) {'
      + ' uint256 i = 0; for (uint256 j = 0; ; j++) { i++; if (i > 3) break; } return i; } }')).toBe('C');
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

describe('tuple destructure in a for-loop init and update', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts a tuple init and a tuple update', () => {
    expect(cc('contract C { function f() external pure returns (uint256) { uint256 r = 0;'
      + ' for ((uint256 x, uint256 y) = (0, 1); x < 10; (x, y) = (x + 1, y + 1)) { r += y; } return r; } }')).toBe('C');
  });
  it('a tuple for-init is byte-identical to hand-desugared declarations', () => {
    const s = compileString('contract C { function f() external pure returns (uint256) { uint256 r = 0;'
      + ' for ((uint256 x, uint256 y) = (0, 1); x < 3; x++) { r += y; } return r; } }', { solidityImportCompat: true });
    const h = compileString('contract C { function f() external pure returns (uint256) { uint256 r = 0;'
      + ' uint256 x = 0; uint256 y = 1; for (; x < 3; x++) { r += y; } return r; } }', { solidityImportCompat: true });
    expect(s.bytecode).toBe(h.bytecode);
  });
});

describe('ABI-coder pragmas are no-ops (v2 is the Solidity 0.8 default)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('treats experimental ABIEncoderV2 / abicoder v1 / abicoder v2 as no-ops', () => {
    for (const p of ['pragma experimental ABIEncoderV2;', 'pragma abicoder v2;', 'pragma abicoder v1;']) {
      expect(cc(`${p} contract C { function f() external pure returns (uint256) { return 1; } }`)).toBe('C');
    }
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

describe('bounded integer state assignments and unsigned negation', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;

  it('rejects state initializer literals outside the destination range', () => {
    for (const declaration of ['int8 x = -129', 'int8 x = 128', 'uint8 x = -1', 'uint8 x = 700']) {
      expect(() => cc(`contract C { ${declaration}; }`)).toThrow(/out of range/);
    }
  });

  it('applies the same range check to later local and state assignments', () => {
    expect(() => cc('contract C { uint8 x; function f() public { x = 256; } }')).toThrow(/out of range/);
    expect(() => cc('contract C { function f() public pure { uint8 x; x = 256; } }')).toThrow(/out of range/);
  });

  it('rejects unary negation of unsigned values while retaining signed negation', () => {
    expect(() => cc('contract C { function f(uint256 x) public pure { -x; } }'))
      .toThrow(/Unary negation cannot be applied to unsigned type/);
    expect(cc('contract C { function f(int256 x) public pure returns (int256) { return -x; } }')).toBe('C');
  });
});

describe('function-type and state-variable modifier consistency', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;

  it('rejects repeated or conflicting function-type modifiers', () => {
    for (const modifiers of ['pure pure', 'pure view', 'internal external']) {
      expect(() => cc(`contract C { function f() public pure { function() ${modifiers} g; } }`))
        .toThrow(/Function type (modifier|has multiple)/);
    }
  });

  it('retains one visibility and one mutability modifier', () => {
    expect(cc('contract C { function f(function() external payable g) public pure {} }')).toBe('C');
  });

  it('rejects repeated or conflicting constant and immutable state modifiers', () => {
    for (const modifiers of ['constant constant', 'immutable immutable', 'constant immutable']) {
      expect(() => cc(`contract C { uint ${modifiers} x; }`))
        .toThrow(/State variable mutability specified more than once/);
    }
  });
});

describe('unchecked block placement', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;

  it('rejects nested unchecked blocks', () => {
    expect(() => cc('contract C { function f() public pure { unchecked { unchecked { uint x = 1; } } } }'))
      .toThrow(/Unchecked blocks cannot be nested/);
  });

  it('rejects unchecked as an unbraced control-flow body', () => {
    expect(() => cc('contract C { function f() public pure { while (true) unchecked { } } }'))
      .toThrow(/only be used inside regular blocks/);
  });

  it('rejects modifier placeholders inside unchecked blocks', () => {
    expect(() => cc('contract C { modifier m() { unchecked { _; } } }'))
      .toThrow(/Modifier placeholders cannot be used inside unchecked blocks/);
  });

  it('retains a non-nested unchecked block inside a regular block', () => {
    expect(cc('contract C { function f() public pure returns (uint) { unchecked { return 1 + 2; } } }'))
      .toBe('C');
  });
});

describe('state and library declaration capabilities', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;

  it('rejects external visibility on scalar, mapping, and array state variables', () => {
    for (const declaration of ['uint external x', 'mapping(uint => uint) external x', 'uint[] external x']) {
      expect(() => cc(`contract C { ${declaration}; }`)).toThrow(/State variables cannot have external visibility/);
    }
  });

  it('retains public, internal, and private state visibility', () => {
    expect(cc('contract C { uint public x; uint internal y; uint private z; }')).toBe('C');
  });

  it('rejects payable library functions while retaining nonpayable functions', () => {
    expect(() => cc('library L { function f() public payable {} } contract C {}'))
      .toThrow(/library functions cannot be payable/);
    expect(cc('library L { function f() public pure returns (uint) { return 1; } } contract C {}')).toBe('C');
  });
});

describe('fixed-point is a solidcash extension (solc leaves it unimplemented)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('compiles fixed-point arithmetic that solc rejects (UnimplementedFeatureError)', () => {
    expect(cc('contract C { function f() external pure returns (ufixed) { ufixed a = 1.5; ufixed b = 2.5; return a + b; } }'))
      .toBe('C');
    expect(cc('contract C { function f() external pure returns (fixed) { fixed a = -1.5; return a; } }')).toBe('C');
  });
});

describe('int/uint casts are accepted like solc (signedness)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts explicit int<->uint casts when the width is unchanged', () => {
    for (const [from, to] of [['uint256', 'int256'], ['int256', 'uint256'], ['uint16', 'int16'], ['int64', 'uint64']]) {
      expect(cc(`contract C { function f(${from} x) external pure returns (${to}) { return ${to}(x); } }`)).toBe('C');
    }
  });
  it('requires a nested cast when changing signedness and width', () => {
    expect(() => cc('contract C { function f(uint16 x) external pure returns (int8) { return int8(x); } }'))
      .toThrow(/cast|conversion/i);
    expect(cc('contract C { function f(uint16 x) external pure returns (int8) { return int8(int16(x)); } }'))
      .toBe('C');
  });
  it('rejects implicit int+uint mixing (like solc)', () => {
    expect(() => cc('contract C { function f(int256 a, uint256 b) external pure returns (uint256) { return a + b; } }'))
      .toThrow(/unequal types/);
  });
});

describe('fixed-width-element array slice arr[start:end] (VM-verified in solidcash/test/ArraySlice.test.ts)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('compiles slices of value-element arrays (uint256[], int8[], bytes32[])', () => {
    for (const t of ['uint256', 'int8', 'bytes32']) {
      expect(cc(`contract C { function f(${t}[] calldata b, uint256 s, uint256 e) external pure returns (${t}[] memory) {`
        + ' return b[s:e]; } }')).toBe('C');
    }
  });
  it('compiles slices in abi.encode and with omitted bounds', () => {
    expect(cc('contract C { function f(uint256[] calldata b) external pure returns (bytes memory) {'
      + ' return abi.encode(b[1:3], b[:], b[2:]); } }')).toBe('C');
  });
  it('still rejects a slice of a struct-element array (pushdata, not packed offsets)', () => {
    expect(() => cc('contract C { struct S { uint256 a; }'
      + ' function f(S[] calldata b) external pure returns (S[] memory) { return b[1:2]; } }'))
      .toThrow(/slice/);
  });
});

describe('array dimensions accept compile-time constant expressions', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('compiles power/arithmetic dimensions (2**10, 2**10 + 3, N * 2)', () => {
    expect(cc('contract C { uint256[2**10] a; function f() external { require(true); } }')).toBe('C');
    expect(cc('contract C { uint256[2**10 + 3] a; function f() external { require(true); } }')).toBe('C');
    expect(cc('contract C { uint256 constant N = 4; uint256[N * 2] a; function f() external { require(true); } }'))
      .toBe('C');
  });
  it('still compiles plain-literal, named-constant, unbounded and nested dimensions', () => {
    expect(cc('contract C { uint256[5] a; function f() external { require(true); } }')).toBe('C');
    expect(cc('contract C { uint256 constant N = 3; uint256[N] a; function f() external { require(true); } }')).toBe('C');
    expect(cc('contract C { uint256[] a; function f() external { require(true); } }')).toBe('C');
    expect(cc('contract C { uint256[2][3] a; function f() external { require(true); } }')).toBe('C');
  });
  it('rejects a non-constant array dimension', () => {
    expect(() => cc('contract C { function f(uint256 n) external { uint256[n] memory a; require(true); } }'))
      .toThrow(/compile-time integer constant|Mismatched|Unexpected/);
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
  it('rejects same-name parent+child errors even when signatures differ', () => {
    expect(() => cc('contract A { error E(); } contract B is A { error E(uint256 n);'
      + ' function f(bool b) external { if (b) revert E(); revert E(1); } }')).toThrow();
  });
});

describe('modifier local variables are renamed uniquely per application', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('applies the same modifier multiple times without redeclaring its local', () => {
    expect(cc('contract C { uint256 public a; modifier mod(uint256 x) { uint256 b = x; a += b; _; a -= b; }'
      + ' function f(uint256 x) public mod(2) mod(5) mod(x) returns (uint256) { return a; } }')).toBe('C');
  });
  it('lets a modifier local share a name with a function parameter', () => {
    expect(cc('contract C { modifier mod1 { uint8 a = 1; uint8 b = 2; _; }'
      + ' function f(bool a) public mod1 returns (uint256 r) { return a ? 1 : 0; } }')).toBe('C');
  });
  it('renames inline-Yul references to a modifier local in each application', () => {
    expect(cc('contract C { uint x; modifier m() { uint t; assembly {'
      + ' function f() -> x { x := 8 } t := f() } x = t; _; }'
      + ' function f() public m m returns (uint r) { assembly { r := 1 } } }')).toBe('C');
  });
  it('resolves super calls and independently clones tuple-declared locals in modifier bodies', () => {
    const src = 'contract A { function active() internal returns(bool,bool){return(true,true);} }'
      + ' contract C is A { modifier ready { (bool ok,bool yes)=super.active(); require(ok&&yes); _; }'
      + ' function f() public ready { require(true); } function g() public ready { require(true); } }';
    expect(cc(src)).toBe('C');
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

describe('bare block statements introduce a nested scope (VM-verified in solidcash/test/BareBlockScope.test.ts)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('compiles disjoint sibling blocks that reuse a name', () => {
    expect(cc('contract C { function f() external { { uint x = 1; require(x > 0); } { uint x = 2; require(x > 0); } } }'))
      .toBe('C');
  });
  it('compiles a nested block inside unchecked and a block that reads an outer local', () => {
    expect(cc('contract C { function f() external { unchecked { { uint m = 5; require(m == 5); } } } }')).toBe('C');
    expect(cc('contract C { function f() external { uint a = 1; { uint b = 2; require(a + b == 3); } require(a == 1); } }'))
      .toBe('C');
  });
  it('alpha-renames a block local that shadows a live outer local', () => {
    expect(cc('contract C { function f() external {'
      + ' uint b = 1; { uint b = 2; require(b == 2); } require(b == 1); } }')).toBe('C');
  });
});

describe('msg.data reachability', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts msg.data at an external entry point', () => {
    expect(cc('contract C { function f() external pure returns (bytes memory) { return msg.data; } }')).toBe('C');
  });
  it('reconstructs msg.data inside a self-external-called function from its selector and arguments', () => {
    const src = 'contract C { function g(uint256 x) external pure returns (bytes memory) { x; return msg.data; }'
      + ' function f() external view returns (bytes memory) { return this.g(1); } }';
    expect(cc(src)).toBe('C');
  });
});

describe('parenthesised single-variable declaration (solc one-element tuple decl)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts (T a) = expr as a plain declaration', () => {
    expect(cc('contract C { function g() internal pure returns (uint) { return 2; }'
      + ' function f() external { (uint a) = g(); require(a == 2); } }')).toBe('C');
    expect(cc('contract C { function f() external { (uint d) = 2; require(d == 2); } }')).toBe('C');
  });
  it('accepts an array-typed parenthesised single declaration', () => {
    expect(cc('contract C { function f() external { (uint[3] memory x) = [uint(1), 2, 3]; require(x[0] == 1); } }'))
      .toBe('C');
  });
  it('leaves a parenthesised existing-lvalue assignment (a) = b as a plain assignment', () => {
    expect(cc('contract C { function f() external { int a; (a) = 5; require(a == 5); } }')).toBe('C');
  });
});

describe('soft keywords as declaration and variable names', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  const ok = (src: string): void => { expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow(); };
  it('accepts contract/struct/enum/type/event named with a soft keyword', () => {
    ok('contract transient { function f() external pure { require(true); } }');
    ok('struct transient { uint layout; } contract C { function f() external pure { require(true); } }');
    ok('enum error { layout, at } contract C { function f() external pure { require(true); } }');
    ok('type error is int; contract C { function f() external pure { require(true); } }');
  });
  it('accepts a state/local variable named with a soft keyword', () => {
    expect(cc('contract C { uint leave = 1; function f() external { require(leave == 1); } }')).toBe('C');
    expect(cc('contract C { function f() external { uint leave = 1; require(leave == 1); } }')).toBe('C');
  });
  it('accepts require as a parameter or named return while retaining contextual require statements', () => {
    expect(cc('contract C { function f(uint require) pure public returns (uint) { require = 2; return require; } }'))
      .toBe('C');
    expect(cc('contract C { function f() pure public returns (uint require) { require = 2; } }')).toBe('C');
    expect(cc('contract C { function f(bool ok_) public { require(ok_); } }')).toBe('C');
  });
  it('accepts Solidity legacy function-name exceptions this, super, and underscore', () => {
    const artifact = compileString(
      'contract C { function this() public {} function super() public {} function _() public {} }',
      { solidityImportCompat: true },
    );
    expect(artifact.abi.map((entry) => entry.name)).toEqual(['this', 'super', '_']);
    expect(() => compileString(
      'contract C { function this() internal {} function super() internal {} function _() internal {} }',
      { solidityImportCompat: true },
    )).toThrow(/reserved for internal\/private functions/);
  });
  it('accepts an error named with a soft keyword and reverting through it', () => {
    ok('error error(uint a); contract C { function f() external pure { revert error(2); } }');
  });
  it('still parses require/revert statements and the transient data location', () => {
    expect(cc('contract C { uint transient t; function f(int x) external { t = 1; require(x > 0 && t == 1); } }')).toBe('C');
    expect(cc('contract C { error E(); function f(bool b) external { if (b) revert E(); require(!b); } }')).toBe('C');
  });
});

describe('complex-lvalue tuple targets (index/member chains in tuple slots)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('assigns to index and member targets, holes, and nested field arrays', () => {
    expect(cc('contract C { function f(int a, int b) external { int[3] x; (x[0], x[2]) = (a, b);'
      + ' require(x[0] == a && x[2] == b); } }')).toBe('C');
    expect(cc('struct S { int v; int w; } contract C { function f() external { S memory s; (s.v, s.w) = (1, 2);'
      + ' require(s.v == 1 && s.w == 2); } }')).toBe('C');
    expect(cc('contract C { function f() external { int[3] m; int a; (m[0], , a) = (1, 2, 3);'
      + ' require(m[0] == 1 && a == 3); } }')).toBe('C');
  });
  it('falls back (does not miscompile) when a target aliases an RHS read', () => {
    // (x[0], x[1]) = (x[1], x[0]) reads target base x in the RHS -> the alias-safe desugar declines it, and the
    // general tuple path rejects the complex slot rather than emitting a wrong sequential write.
    expect(() => compileString('contract C { function f() external { int[2] x; (x[0], x[1]) = (x[1], x[0]);'
      + ' require(true); } }', { solidityImportCompat: true })).toThrow();
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

describe('whole-struct <-> mapping-entry copies (VM-verified in solidcash/test/e2e/MappingStructCopy.test.ts)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  const P = 'struct S { bytes b; uint u; } contract C { mapping(uint => S) m; mapping(uint => S) m2; S s;';
  it('writes a struct constructor into a mapping entry (named and positional)', () => {
    expect(cc(`${P} function f() external { m[0] = S({b: "x", u: 7}); require(true); } }`)).toBe('C');
    expect(cc(`${P} function f() external { m[0] = S("x", 7); require(true); } }`)).toBe('C');
  });
  it('reads a whole mapping entry into a struct state variable', () => {
    expect(cc(`${P} function f() external { s = m[0]; require(true); } }`)).toBe('C');
  });
  it('copies a whole entry into another mapping entry', () => {
    expect(cc(`${P} function f() external { m2[0] = m[0]; require(true); } }`)).toBe('C');
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

describe('struct storage pointer to a state variable aliases (VM in solidcash/StructStoragePointer.test.ts)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  const P = 'contract C { struct S { uint x; uint u; } S s;';
  it('accepts field write / whole assign / delete through a non-flattened struct storage pointer', () => {
    expect(cc(`${P} function f() external { S storage sL = s; sL.u = 5; require(true); } }`)).toBe('C');
    expect(cc(`${P} S s2; function f() external { S storage sL = s; sL = s2; require(true); } }`)).toBe('C');
    expect(cc(`${P} function f() external { S storage sL = s; delete sL.u; require(true); } }`)).toBe('C');
  });
});

describe('parenthesised / arithmetic constant array dimensions', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts a parenthesised or arithmetic constant as an array dimension', () => {
    expect(cc('contract C { uint constant L1 = (2); uint constant L2 = (2 + 1) / 1; uint[L1] a1; uint[L2] a2;'
      + ' function f() external { require(a1.length == 2 && a2.length == 3); } }')).toBe('C');
    expect(cc('contract C { uint[(2 + 1) + 1] a; function f() external { require(a.length == 4); } }')).toBe('C');
  });
  it('resolves a constant array dimension that references another constant', () => {
    expect(cc('contract C { uint constant B = 2; uint constant A = B + 1; uint[A] a;'
      + ' function f() external { require(a.length == 3); } }')).toBe('C');
  });
  it('still rejects a non-integer-typed constant as a dimension', () => {
    expect(() => compileString('contract C { bytes constant S = 0x00; int[S] xs; function f() external { require(true); } }',
      { solidityImportCompat: true })).toThrow(/compile-time integer constant/);
  });
});

describe('parenthesised simple call target (foo)() / (L.f)() / (blockhash)(n)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('unwraps redundant parentheses around a simple callee', () => {
    expect(cc('contract C { function foo() internal pure returns (uint) { return 7; }'
      + ' function f() external pure returns (uint) { return (foo)(); } }')).toBe('C');
    expect(cc('library L { function f() internal pure returns (uint) { return 3; } }'
      + ' contract C { function g() external pure returns (uint) { return (L.f)(); } }')).toBe('C');
    expect(cc('contract C { function f() external view returns (bytes32) { return (blockhash)(block.number - 1); } }'))
      .toBe('C');
  });
});

describe('mapping-entry array/bytes element access m[k][i] (VM in solidcash/MappingEntryArrayElement.test.ts)', () => {
  const cc = (src: string): string =>
    compileString(src, { solidityImportCompat: true, forceStateful: true, chunkedArrays: true }).contractName;
  it('reads an element of an array/bytes-valued mapping entry (entrySlotIndex now recurses index bases)', () => {
    expect(cc('contract C { mapping(uint => uint16[]) ma; function r() external view { require(ma[0][0] == 13); } }'))
      .toBe('C');
    expect(cc('contract C { mapping(uint => bytes) ma; function r() external view returns (bytes1) { return ma[0][0]; } }'))
      .toBe('C');
    expect(cc('contract C { struct S { uint16[] a; } mapping(uint => S) m;'
      + ' function r() external view { require(m[0].a[1] == 5); } }')).toBe('C');
  });
});

describe('push onto a nested flattened-struct-field array t.s.b.push() (VM in solidcash/NestedFieldPush.test.ts)', () => {
  const cc = (src: string): string =>
    compileString(src, { solidityImportCompat: true, forceStateful: true, chunkedArrays: true }).contractName;
  it('collapses the nested member chain so the array-field push resolves', () => {
    expect(cc('contract C { struct Inner { uint[] b; } struct S { Inner s; uint u; } S t;'
      + ' function f() external { t.s.b.push(1); } }')).toBe('C');
    expect(cc('contract C { struct Inner { uint[] b; } struct S { Inner s; uint u; } S t;'
      + ' function f() external { t.s.b.pop(); } }')).toBe('C');
  });
});

describe('chained getter returning a contract + using-for on computed receivers', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  const MATH = 'library Math { function mul(uint a, uint b) internal pure returns (uint) { return a * b; }'
    + ' function add(uint a, uint b) internal pure returns (uint) { return a + b; }'
    + ' function mul(int a, int b) internal pure returns (int) { return a * b; } }\n';

  it('calls a method on the contract a public-var getter returns (A.g().m())', () => {
    expect(cc('contract Token { function balanceOf(address a) public returns (uint) { return 0; } }'
      + ' contract Event { Token public collateralToken; }'
      + ' contract C { Event ev; function f() public returns (uint)'
      + ' { return ev.collateralToken().balanceOf(address(this)); } }')).toBe('C');
  });

  it('resolves a chained getter on a contract-typed LOCAL (market = markets[i])', () => {
    expect(cc('contract Token { function approve(address a, uint v) public returns (bool) { return true; } }'
      + ' contract Event { Token public collateralToken; }'
      + ' contract C { Event[] markets; function f(uint i) public returns (bool)'
      + ' { Event m = markets[i]; return m.collateralToken().approve(address(this), 1); } }')).toBe('C');
  });

  it('resolves using-for on an arithmetic-expression receiver ((a-b).mul(c))', () => {
    expect(cc(`${MATH}contract C { using Math for *;`
      + ' function f(uint a, uint b, uint c) public pure returns (uint) { return (a - b).mul(c); } }')).toBe('C');
  });

  it('resolves an overloaded chained using-for call (x.mul(a).add(b))', () => {
    expect(cc(`${MATH}contract C { using Math for *;`
      + ' function f(uint x, uint a, uint b) public pure returns (uint) { return x.mul(a).add(b); } }')).toBe('C');
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

describe('contract/interface type as a mapping VALUE type', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  // The key type already defaulted an unknown name to an address handle; the value type did not, so
  // `mapping(K => IFoo)` tripped UnsupportedMappingValueTypeError('undefined'). Now both match.
  it('resolves an interface/contract mapping value to an address handle', () => {
    expect(cc('interface IEv {} contract C { mapping(bytes32 => IEv) m;'
      + ' function f(bytes32 k) public returns (address) { return address(m[k]); } }')).toBe('C');
    expect(cc('contract Ev {} contract C { mapping(bytes32 => Ev) public events; }')).toBe('C');
  });
});

describe('external call on the current contract type (self-type)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('calls another instance of the contract via a cast to its own type (M(addr).m())', () => {
    expect(cc('contract M { uint x; function set(uint c) public { x = c; }'
      + ' function upgrade(address a) public { M(a).set(x); } }')).toBe('M');
    expect(cc('contract M { uint x; function set(uint c) public { x = c; }'
      + ' function upgrade(address a) public { M u = M(a); u.set(x); } }')).toBe('M');
  });
  it('leaves this.method() self-calls working', () => {
    expect(cc('contract M { uint x; function set(uint c) public { x = c; } function f() public { this.set(1); } }'))
      .toBe('M');
  });
  it('still rejects an interface inheriting a contract (solc parity)', () => {
    expect(() => cc('contract C {} interface I is C {}')).toThrow();
  });
});

describe('branch-local external-call target capture', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  // A contract/interface-typed local declared inside a branch (here a restricted modifier's if-wrapper) is
  // popped before the epilogue co-spend verification; the capture pass hoists it to a function-top local.
  it('compiles an external call on a local declared in a modifier-induced branch (Migrations shape)', () => {
    expect(cc('contract M { uint x; function set(uint c) public { x = c; }'
      + ' modifier r() { if (x == 0) _; }'
      + ' function upgrade(address a) public r { M u = M(a); u.set(x); } }')).toBe('M');
  });
  it('compiles an external call on a local declared in an explicit if-branch', () => {
    expect(cc('interface IM { function set(uint x) external; }'
      + ' contract C { address t; function f(bool ok) public { if (ok) { IM u = IM(t); u.set(5); } } }')).toBe('C');
  });
});

describe('string-literal mapping key coerced to bytesN (compat)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  // `m["foo"]` where the key type is bytesN right-pads the literal like an assignment value does; byte-identical
  // to the explicit `m[hex"666f6f00..00"]` form. This matches Solidity (a string literal implicitly converts to a
  // bytesN it fits), so the coercion is now a default (native too), not compat-gated.
  it('coerces a string-literal key on write, read, and delete', () => {
    expect(cc('contract C { mapping(bytes16 => uint) m;'
      + ' function f() public { m["foo"] = 2; require(m["foo"] == 2); delete m["foo"]; } }')).toBe('C');
  });
  it('coerces an empty-string key against a bytes1 key type', () => {
    expect(cc('contract C { mapping(bytes1 => uint) m; function f() public { m[""] = 2; require(m[""] == 2); } }'))
      .toBe('C');
  });
  it('also coerces the string->bytesN key natively (coercion now default-on, Solidity parity)', () => {
    expect(compileString('pragma solidcash >=0.8.0; contract C() { mapping(bytes16 => int) m;'
      + ' function f() { this.m["foo"] = 2; require(this.m["foo"] == 2); } }').contractName).toBe('C');
  });
});

describe('foreign external fn-ptr state var (fixed method on runtime address)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  const IF = 'interface IFoo { function addTwo(uint x) external returns(uint); }';
  // `x = IFoo(a).addTwo; x(v)` lowers to an address state var + IFoo(x).addTwo(v) (the tested state-address
  // external call). Sound by reduction; VM-verified in ForeignFunctionPointerStateVar.test.ts.
  it('lowers a single-method foreign fn-ptr state var to an address + fixed-method call', () => {
    expect(cc(`${IF} contract C { function(uint) external returns(uint) x;`
      + ' function set(address a) public { x = IFoo(a).addTwo; }'
      + ' function callIt(uint v) public returns(uint) { return x(v); } }')).toBe('C');
  });
  // A varying method must NOT be classified (would need a runtime selector) - stays rejected, never miscompiled.
  it('does not lower a fn-ptr state var whose method varies (stays unclassified)', () => {
    const src = 'interface IFoo { function a(uint x) external returns(uint); function b(uint x) external returns(uint); }'
      + ' contract C { function(uint) external returns(uint) x;'
      + ' function set(address addr, bool t) public { if (t) x = IFoo(addr).a; else x = IFoo(addr).b; }'
      + ' function callIt(uint v) public returns(uint) { return x(v); } }';
    expect(() => compileString(src, { solidityImportCompat: true })).toThrow();
  });
});

describe('foreign external fn-ptr parameter (per-call master index)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  // A called `function(..) external` PARAM lowers to an address param + a bytes4 selector param + a per-call
  // `__internal__extcallMasterIdx<i>` the SDK fills. VM-verified in ForeignFunctionPointerParam.test.ts
  // (single + multi-call binding).
  it('lowers a called foreign fn-ptr param to address + selector + a master-index hidden param', () => {
    const art = compileString('contract C { function eval(function(uint) external returns(uint) y, uint v)'
      + ' public returns(uint) { return y(v); } }', { solidityImportCompat: true });
    const inputs = art.abi.find((f) => f.name === 'eval')!.inputs.map((i) => `${i.name}:${i.type}`);
    expect(inputs).toContain('y:address');
    expect(inputs).toContain('__fnsel_y:bytes4');
    expect(inputs.some((i) => i.startsWith('__internal__extcallMasterIdx'))).toBe(true);
  });
  // A fn-ptr param passed a SELF-REF (`this.f`) at an internal call site stays a functionId (not lowered), so the
  // internal OP_INVOKE path keeps working (the duality: self-ref = functionId, foreign = address+selector).
  it('does NOT lower a fn-ptr param passed a self-ref internally (stays a functionId)', () => {
    const art = compileString('contract C { function g(int x) public pure returns(int) { return x + 1; }'
      + ' function ev(function(int) external returns(int) fp, int a) public returns(int) { return fp(a); }'
      + ' function u(int x) public { require(this.ev(this.g, x) == x + 1); } }', { solidityImportCompat: true });
    const evInputs = art.abi.find((f) => f.name === 'ev')!.inputs.map((i) => i.name);
    expect(evInputs).not.toContain('__fnsel_fp'); // not lowered - stays the internal functionId form
  });
});

describe('foreign external fn-ptr STATE storage of a received value (x = y)', () => {
  // A fn-ptr state var assigned a RECEIVED value flattens to an `address` field + a `bytes4 __fnsel_<name>`
  // companion; the stored param splits into (address, selector) and the call marks fnPtrCall + a per-call index.
  // VM-verified in ForeignFunctionPointerStorage.test.ts (seed, save->run, and return-event capture).
  it('flattens the fn-ptr state var + splits the stored param + marks the call fnPtrCall', () => {
    const art = compileString('contract C { function(uint) external returns(uint) stored;'
      + ' function save(function(uint) external returns(uint) y) public { stored = y; }'
      + ' function run(uint v) public returns(uint) { return stored(v); } }', { solidityImportCompat: true });
    const stateVars = art.stateLayout!.variables.map((v) => `${v.name}:${v.type}`);
    expect(stateVars).toContain('stored:address');          // fn-ptr var lowered to address
    expect(stateVars).toContain('__fnsel_stored:bytes4');   // companion selector field injected
    const saveInputs = art.abi.find((f) => f.name === 'save')!.inputs.map((i) => `${i.name}:${i.type}`);
    expect(saveInputs).toContain('y:address');              // stored param split: address part
    expect(saveInputs).toContain('__fnsel_y:bytes4');       // stored param split: selector part
    const run = art.abi.find((f) => f.name === 'run')!;
    expect(run.externalCalls!.some((e) => e.fnPtrCall)).toBe(true);
    expect(run.inputs.some((i) => i.name.startsWith('__internal__extcallMasterIdx'))).toBe(true);
  });
  // A self-ref (functionId) fn-ptr state var must NOT be flattened to address+selector (that path is separate).
  it('does not flatten a fn-ptr state var assigned a self-ref (stays the functionId form)', () => {
    const art = compileString('contract C { function(uint) internal returns(uint) fp;'
      + ' function g(uint x) internal returns(uint) { return x + 1; }'
      + ' function set() public { fp = g; } function run(uint v) public returns(uint) { return fp(v); } }',
    { solidityImportCompat: true });
    const stateVars = art.stateLayout!.variables.map((v) => v.name);
    expect(stateVars).not.toContain('__fnsel_fp'); // internal pointer keeps its functionId representation
  });
});

describe('foreign external fn-ptr in a STRUCT FIELD (fixed method on a runtime address)', () => {
  const IF = 'interface IFoo { function addTwo(uint x) external returns(uint); }';
  // A fixed-method fn-ptr struct field lowers to an interface-typed field + the shipped `s.field.m()` chain call.
  // VM-verified in ForeignFunctionPointerStructField.test.ts (seeded + register->call).
  it('retypes the fn-ptr struct field to interface-typed + dispatches its fixed method', () => {
    const art = compileString(`${IF} contract C { struct S { function(uint) external returns(uint) fn; uint x; }`
      + ' S s; function reg(address a) public { s.fn = IFoo(a).addTwo; }'
      + ' function run(uint v) public returns(uint) { return s.fn(v); } }', { solidityImportCompat: true });
    const sDef = art.structs!.find((s) => s.name === 'S')!;
    expect(sDef.fields.find((f) => f.name === 'fn')!.type).toBe('address'); // fn-ptr field lowered to address
    const run = art.abi.find((f) => f.name === 'run')!;
    expect(run.externalCalls!.some((e) => e.functionName === 'addTwo')).toBe(true); // fixed-method chain call
  });
});

describe('foreign external fn-ptr ARRAY dispatch table (fixed method on runtime addresses)', () => {
  const IF = 'interface IFoo { function ping(uint x) external; }';
  // A fixed-method fn-ptr array lowers to a plain address[] state var. Solidity call semantics: a bare
  // `fns[idx](v)` calls ONLY element idx (single computed-receiver co-spend); the notify-all loop spelling
  // `for (..) { fns[i](v); }` maps to the broadcast covenant. VM-verified in ForeignFunctionPointerArrayTable.
  it('bare fns[idx](v) is a SINGLE-element call (no broadcast loop)', () => {
    const art = compileString(`${IF} contract C { function(uint) external[] fns;`
      + ' function reg(address a) public { this.fns.push(IFoo(a).ping); }'
      + ' function fire(uint v) public { fns[0](v); } }', { solidityImportCompat: true });
    const fns = art.stateLayout!.variables.find((v) => v.name === 'fns')!;
    expect(fns.type).toBe('address[]'); // fn-ptr array collection moved to a plain address[] state var
    const fire = art.abi.find((f) => f.name === 'fire')!;
    expect(fire.externalCalls!.some((e) => !e.loopArrayVar && e.functionName === 'ping')).toBe(true);
  });

  it('the loop spelling for (..) { fns[i](v); } is the broadcast (array co-spend loop)', () => {
    const art = compileString(`${IF} contract C { function(uint) external[] fns;`
      + ' function reg(address a) public { this.fns.push(IFoo(a).ping); }'
      + ' function fire(uint v) public { for (uint i = 0; i < 2; i++) { fns[i](v); } } }',
    { solidityImportCompat: true });
    const fire = art.abi.find((f) => f.name === 'fire')!;
    expect(fire.externalCalls!.some((e) => e.loopArrayVar === 'fns' && e.functionName === 'ping')).toBe(true);
  });
});

describe('foreign external fn-ptr RETURNED from an internal helper (beta-reduced)', () => {
  const IF = 'interface IFoo { function addTwo(uint x) external returns(uint); }';
  // A side-effect-free internal helper returning IFace(a).m inlines into `p = IFace(a).m` at the call site, which
  // the straight-line desugar reduces to the external call. VM-verified in ForeignFunctionPointerReturn.test.ts.
  it('inlines the returned pointer into the call site as an external call', () => {
    const art = compileString(`${IF} contract C {`
      + ' function make(address a) internal returns (function(uint) external returns(uint)) { return IFoo(a).addTwo; }'
      + ' function use(address a, uint v) public returns(uint) {'
      + '   function(uint) external returns(uint) p = make(a); return p(v); } }', { solidityImportCompat: true });
    const use = art.abi.find((f) => f.name === 'use')!;
    expect(use.externalCalls!.some((e) => e.interfaceName === 'IFoo' && e.functionName === 'addTwo')).toBe(true);
    expect(art.abi.some((f) => f.name === 'make')).toBe(false); // the helper is inlined away
  });
  // Passing a foreign member to a helper that calls it inlines to the external call; a self-ref (internal param)
  // is left to the OP_INVOKE path (the duality). VM-verified in ForeignFunctionPointerReturn.test.ts.
  it('inlines a foreign member passed to a helper into the external call', () => {
    const art = compileString(`${IF} contract C {`
      + ' function relay(function(uint) external returns(uint) cb, uint v) internal returns(uint) { return cb(v); }'
      + ' function use(address a, uint v) public returns(uint) { return relay(IFoo(a).addTwo, v); } }',
    { solidityImportCompat: true });
    const use = art.abi.find((f) => f.name === 'use')!;
    expect(use.externalCalls!.some((e) => e.interfaceName === 'IFoo' && e.functionName === 'addTwo')).toBe(true);
    expect(art.abi.some((f) => f.name === 'relay')).toBe(false); // inlined away
  });
  it('does NOT inline a self-ref passed to an internal-pointer helper (stays OP_INVOKE)', () => {
    // internal fn-ptr param + self-ref arg must keep compiling via the existing functionId path.
    expect(() => compileString('contract C {'
      + ' function g(uint x) internal returns(uint) { return x + 1; }'
      + ' function relay(function(uint) internal returns(uint) cb, uint v) internal returns(uint) { return cb(v); }'
      + ' function use(uint v) public returns(uint) { return relay(g, v); } }', { solidityImportCompat: true }))
      .not.toThrow();
  });
});

describe('contract metatype constants', () => {
  it('preserves creationCode/runtimeCode contract metadata when constants are inlined', () => {
    const artifacts = compileStringMulti('contract A {} contract B {'
      + ' bytes constant creationCode = type(A).creationCode;'
      + ' bytes constant runtimeCode = type(A).runtimeCode;'
      + ' function nonEmpty() public pure returns (bool) {'
      + ' return creationCode.length > 0 && runtimeCode.length > 0; } }',
    { solidityImportCompat: true });
    expect(artifacts.B.contractName).toBe('B');
  });

  it('compiles runtimeCode dependencies referenced from a reachable free function', () => {
    const artifact = compileString('contract C { uint public x = 2; }'
      + ' function hasCode() returns (bool) { return type(C).runtimeCode.length > 0; }'
      + ' contract D { function f() public returns (bool) { return hasCode(); } }',
    { solidityImportCompat: true });
    expect(artifact.contractName).toBe('D');
  });

  it('preserves word alignment of creationCode/runtimeCode memory pointers in Yul', () => {
    const artifacts = compileStringMulti('contract D { function f() public pure returns (uint) { return 7; } }'
      + ' contract C { function diff() public pure returns (uint remainder) {'
      + ' bytes memory a = type(D).creationCode; bytes memory b = type(D).runtimeCode;'
      + ' assembly { remainder := mod(sub(b, a), 0x20) } } }',
    { solidityImportCompat: true });
    expect(artifacts.C.contractName).toBe('C');
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

describe('unreachable internal contract-bytecode references', () => {
  it('drops an uncalled inherited helper that deploys the derived contract', () => {
    const artifact = compileString('contract C { function foo() internal { new D(); }'
      + ' function callFoo() virtual public { foo(); } }'
      + ' contract D is C { function callFoo() override public {} }',
    { solidityImportCompat: true });
    expect(artifact.contractName).toBe('D');
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

describe('Yul dirty bits on external function components', () => {
  it('drops proven above-width dirt before pointer comparison cleanup', () => {
    const art = compileString('contract C { function g() external {} function f() public returns (bool) {'
      + ' function() external p = this.g; assembly {'
      + ' p.address := or(p.address, shl(160, sub(0, 1)))'
      + ' p.selector := or(p.selector, shl(32, sub(0, 1))) }'
      + ' function() external q = this.g; return p == q; } }',
    { solidityImportCompat: true });
    expect(art.contractName).toBe('C');
  });
  it('preserves arbitrary address-component mutation for a later read', () => {
    expect(compileString('contract C { function g() external {} function f() public returns (address) {'
      + ' function() external p = this.g; assembly { p.address := 1 } return p.address; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('zero-initialized internal function-pointer dispatch', () => {
  it('preserves the invalid-pointer failure after an external state pointer is representation-lowered', () => {
    const art = compileString('contract C {'
      + ' function(function(uint) external returns(uint)) internal returns(uint) ev;'
      + ' function(uint) external returns(uint) x;'
      + ' function store(function(uint) external returns(uint) y) public { x = y; }'
      + ' function t() public returns(uint) { return ev(x); } }',
    { solidityImportCompat: true });
    expect(art.contractName).toBe('C');
  });
});

describe('foreign external fn-ptr .selector / .address members', () => {
  const IF = 'interface IFoo { function addTwo(uint x) external returns(uint); }';
  // `f.selector` / `f.address` on an alias reduce to the member's compile-time selector / the cast address (the
  // EVM `function external` value members). f.selector -> IFoo.addTwo.selector (VM-proven in the varying dispatch).
  it('rewrites f.selector to the aliased member selector (bytes4)', () => {
    const art = compileString(`${IF} contract C {`
      + ' function use(address a) public returns(bytes4) {'
      + '   function(uint) external returns(uint) f = IFoo(a).addTwo; return f.selector; } }',
    { solidityImportCompat: true });
    expect(art.abi.find((x) => x.name === 'use')!.outputs![0].type).toBe('bytes4');
  });
  it('rewrites f.address to the interface-cast address', () => {
    const art = compileString(`${IF} contract C {`
      + ' function use(address a) public returns(address) {'
      + '   function(uint) external returns(uint) f = IFoo(a).addTwo; return f.address; } }',
    { solidityImportCompat: true });
    expect(art.abi.find((x) => x.name === 'use')!.outputs![0].type).toBe('address');
  });
  it('reads the address component of a received external function parameter', () => {
    const art = compileString('contract C { function g(function() external cb) public returns (address) {'
      + ' return cb.address; } }', { solidityImportCompat: true });
    expect(art.abi.find((x) => x.name === 'g')!.outputs![0].type).toBe('address');
  });
  it('assigns an address-typed Solidity local to a function pointer address in Yul', () => {
    const art = compileString('contract C { function target() external {}'
      + ' function f(address replacement) public view returns (address) {'
      + ' function() external fp = this.target; assembly { fp.address := replacement }'
      + ' return fp.address; } }', { solidityImportCompat: true });
    expect(art.abi.find((x) => x.name === 'f')!.outputs![0].type).toBe('address');
  });
  it('rewrites a direct interface-member address to the cast address', () => {
    const art = compileString('contract C { function f() public view returns (address) {'
      + ' return C(address(0x1234)).f.address; } }', { solidityImportCompat: true });
    expect(art.abi.find((x) => x.name === 'f')!.outputs![0].type).toBe('address');
  });
  it('encodes a self external-function member stored in a struct blob', () => {
    const art = compileString('contract C { struct S { function() external returns (uint) f; uint b; }'
      + ' function invoke(S memory s) public returns (uint) { return s.f() + s.b; }'
      + ' function g() public returns (uint) { return 7; }'
      + ' function test() public returns (uint) { return this.invoke(S(this.g, 3)); } }',
    { solidityImportCompat: true });
    expect(art.contractName).toBe('C');
  });
  it('dispatches a blob function-pointer field through indexed and nested struct receivers', () => {
    const art = compileString('struct I { uint a; function(uint) external returns (uint) fp; }'
      + ' struct S { I inner; } contract C { S[2] rows;'
      + ' function plusOne(uint x) public returns (uint) { return x + 1; }'
      + ' constructor() { rows[0] = S(I(1, this.plusOne)); }'
      + ' function run(uint x) public returns (uint) { return rows[0].inner.fp(x); }'
      + ' function runTwice(uint x) public { rows[0].inner.fp(x); rows[0].inner.fp(x); } }',
    { solidityImportCompat: true });
    expect(art.contractName).toBe('C');
  });
});

describe('deploy-then-call fold THROUGH a local fn-ptr (#2 slice, sound by reduction)', () => {
  // `p = (new Other()).m; p()` (deploy + take the fresh child's method as a local pointer + call) reduces via
  // the alias desugar to `(new Other()).m()` = the shipped deploy-then-call fold. Assert byte-identity to the
  // direct form (the fold is VM-tested), so the fn-ptr form is sound by reduction.
  it('compiles byte-identically to the direct deploy-then-call fold', () => {
    const other = 'contract Other { int counter; function bump() external { this.counter = this.counter + 1; require(true); } }';
    const direct = `${other} contract C { function use() public { (new Other()).bump(); require(true); } }`;
    const fnptr = `${other} contract C { function use() public {`
      + ' function() external p = (new Other()).bump; p(); require(true); } }';
    const a = compileStringMulti(direct, { solidityImportCompat: true }).C;
    const b = compileStringMulti(fnptr, { solidityImportCompat: true }).C;
    expect(b.bytecode).toBe(a.bytecode);
    expect(b.abi.find((f) => f.name === 'use')!.deployTargets)
      .toEqual(a.abi.find((f) => f.name === 'use')!.deployTargets);
  });
});

describe('address(L) library-as-address (EVM library-linking parity, corpus library_to_address.sol)', () => {
  // `address(L)` where L is a library resolves to the library's link-time address = a synthesized
  // `__libAddr_L` address constructor arg (the same one the delegate-call path uses). Sound by reduction:
  // it becomes a read of a normal address constructor param.
  it('synthesizes a __libAddr_L constructor arg for address(L) on an inline library', () => {
    const art = compileString(
      'library L {} contract C { function f() public pure returns (address) { return address(L); } }',
      { solidityImportCompat: true });
    expect(art.constructorInputs.find((i) => i.name === '__libAddr_L')?.type).toBe('address');
  });
  it('reuses one __libAddr_L param for address(L) alongside a library call', () => {
    const art = compileString(
      'library L { function sq(uint v) internal pure returns (uint) { return v*v; } }'
      + ' contract C { function f() public pure returns (address) { return address(L); }'
      + ' function g(uint x) public pure returns (uint) { return L.sq(x); } }',
      { solidityImportCompat: true });
    expect(art.constructorInputs.filter((i) => i.name === '__libAddr_L').length).toBe(1);
  });
  it('does not rewrite address(x) where x is a non-library local', () => {
    const art = compileString(
      'contract C { function f(address x) public pure returns (address) { return address(x); } }',
      { solidityImportCompat: true });
    expect(art.constructorInputs.find((i) => i.name?.startsWith('__libAddr_'))).toBeUndefined();
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

describe('inlines internal value helpers that make an EXTERNAL contract call (OZ _isEscrowMember shape)', () => {
  const ok = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  const iface = 'interface I { function g(uint id) external view returns (uint); }';
  it('inlines an external-call helper called as a require argument (was a phantom-param arity error)', () => {
    // `_h` makes an external call `t.g(id)` (a dotted FunctionCall not in funcByName), which injects the external-
    // call covenant param; as an OP_INVOKE subroutine it cannot forward it. Detected like a low-level-call helper
    // and inlined at its expression call site (the existing state-helper expression hoisting handles it).
    expect(ok(iface + ' contract C { I t; function _h(uint id) internal view returns (bool) { return t.g(id) > 0; }'
      + ' function f(uint id) public view { require(_h(id), "x"); } }')).toBe('C');
  });
  it('inlines an external-call helper on an IMMUTABLE receiver used in a binary expression', () => {
    expect(ok(iface + ' contract C { I immutable t; constructor(address a) { t = I(a); }'
      + ' function _h(uint id) internal view returns (uint) { return t.g(id); }'
      + ' function f(uint id) public view returns (uint) { return 1 + _h(id); } }')).toBe('C');
  });
});

// A low-level `.call`/`.staticcall`/`.delegatecall` on a struct-FIELD address receiver (`t.dest.call(..)`) was
// rejected: resolveLowLevelReceiverType missed a state-var base (StateAccessNode) and a mapping collection base
// (collectionMap), so it fell through to the interface path (MethodCallNotSupported); and the field receiver was
// not sourceable in codegen. Now the receiver resolves AND is hoisted into an address local. MultiSigWallet's
// `transaction.destination.call{value:}(transaction.data)` shape.
describe('low-level .call on a struct-field address receiver (MultiSigWallet transaction.destination.call)', () => {
  const ok = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  const S = 'struct T { address dest; bytes data; }';
  it('plain state-struct field: t.dest.call(t.data)', () => {
    expect(ok(`${S} contract C { T t; function f() public {`
      + ' (bool okk,) = t.dest.call(t.data); require(okk); } }')).toBe('C');
  });
  it('mapping-value struct field: m[id].dest.call(m[id].data)', () => {
    expect(ok(`${S} contract C { mapping(uint => T) m; function f(uint id) public {`
      + ' (bool okk,) = m[id].dest.call(m[id].data); require(okk); } }')).toBe('C');
  });
  it('array-element struct field via a storage pointer (transactions[id] inlined)', () => {
    expect(ok(`${S} contract C { mapping(uint => T) transactions; function f(uint id) public {`
      + ' T storage txn = transactions[id]; (bool okk,) = txn.dest.call(txn.data); require(okk); } }')).toBe('C');
  });
  it('staticcall on a struct-field receiver', () => {
    expect(ok(`${S} contract C { T t; function f() public view returns (bool okk) {`
      + ' (okk,) = t.dest.staticcall(t.data); } }')).toBe('C');
  });
});

// `(stateVar,) = <tuple RHS>` - a PARTIAL tuple assignment (with a discarded `,` slot) to an EXISTING state
// variable. The all-captured `(a, b) = f()` desugars to temps + state writes, but the skip slot made
// desugarStateTupleAssignment bail, so the codegen treated the state var as a stack slot: "Expected variable
// 'z' does not exist on the stack". The desugar now preserves skips. `(bool ok,) = addr.call(data)` with `ok`
// pre-declared is the driver (MultiSigWallet-style low-level-call return capture).
describe('partial tuple-assign to a state variable ((z,) = f() / (z,) = addr.call(x))', () => {
  const ok = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  const two = 'function two() pure returns (bool, uint) { return (true, 1); }';
  it('partial tuple-assign of a multi-return call to a state var', () => {
    expect(ok(`${two} contract C { bool z; function f() public { (z,) = two(); require(z); } }`)).toBe('C');
  });
  it('partial tuple-assign of a low-level-call return to a state var', () => {
    expect(ok('contract C { bool z; function f(address d, bytes calldata x) public {'
      + ' (z,) = d.call(x); require(z); } }')).toBe('C');
  });
  it('still works with all slots captured to state vars (regression)', () => {
    expect(ok(`${two} contract C { bool z; uint u; function f() public { (z, u) = two(); require(z); } }`)).toBe('C');
  });
  it('partial tuple-assign to a mixed state + skip + local target', () => {
    expect(ok('function three() pure returns (bool, uint, uint) { return (true, 1, 2); }'
      + ' contract C { bool z; function f() public { uint local; (z, , local) = three(); require(z && local == 2); } }')).toBe('C');
  });
});

// `(m[k].f,) = <single tuple-valued RHS>` - a COMPLEX (mapping/array/struct-field) lvalue as a tuple target with
// a single-expression (call) RHS. desugarComplexTupleAssignment handled only the per-slot `(a,b)=(e1,e2)` form,
// so a call RHS left the complex slot mis-recorded as `{name:'m'}` -> "Undefined reference to symbol m". The new
// desugarComplexTupleSingleRhs destructures into typed temps + per-slot writes. MultiSigWallet's
// `(transaction.executed,) = ...` where `Transaction storage transaction = transactions[id]`.
describe('complex-lvalue tuple target with a single (call) RHS ((m[k].f,) = g())', () => {
  const ok = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  const two = 'function two() pure returns (bool, uint) { return (true, 1); }';
  const S = 'struct T { bool e; uint v; }';
  it('mapping-value struct field target', () => {
    expect(ok(`${two} ${S} contract C { mapping(uint => T) m;`
      + ' function f(uint id) public { (m[id].e,) = two(); require(m[id].e); } }')).toBe('C');
  });
  it('mapping-value struct field via a storage pointer', () => {
    expect(ok(`${two} ${S} contract C { mapping(uint => T) m;`
      + ' function f(uint id) public { T storage t = m[id]; (t.e, t.v) = two(); require(t.e && t.v == 1); } }')).toBe('C');
  });
  it('array-element struct field target', () => {
    expect(ok(`${two} ${S} contract C { T[] xs;`
      + ' function f(uint id) public { (xs[id].e,) = two(); require(xs[id].e); } }')).toBe('C');
  });
  it('low-level-call return into a struct-field via storage pointer (no value transfer)', () => {
    expect(ok(`${S} contract C { mapping(uint => T) m; function f(uint id, address d, bytes calldata x) public {`
      + ' T storage t = m[id]; (t.e,) = d.call(x); } }')).toBe('C');
  });
});

// `addmod`/`mulmod` in a CONSTANT initializer - pure integer builtins, compile-time when their args are. Only
// abi.encode*/keccak(literal) folded before; addmod/mulmod fell through to "Constant must be initialized with a
// compile-time expression". Now accepted (isCompileTimeExpression) + typed BIGINT (resolveConstantExpression-
// Identifiers), inlined at each use like abi.encode. Corpus: math_builtin_opcode_based_const_args.
describe('addmod/mulmod in a constant initializer', () => {
  const ok = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('addmod with literal args', () => {
    expect(ok('uint256 constant a = addmod(1, 8, 7); contract C { function f() public pure returns (uint) { return a; } }')).toBe('C');
  });
  it('mulmod with literal args', () => {
    expect(ok('uint256 constant a = mulmod(3, 8, 7); contract C { function f() public pure returns (uint) { return a; } }')).toBe('C');
  });
  it('addmod with a constant arg (resolves the ref)', () => {
    expect(ok('uint256 constant k = 7; uint256 constant a = addmod(1, 8, k);'
      + ' contract C { function f() public pure returns (uint) { return a; } }')).toBe('C');
  });
  it('keccak256 in a const with a NON-literal arg (const ref) - FoldHashLiterals is literal-only', () => {
    expect(ok('bytes constant d = hex"ffff"; bytes32 constant k = keccak256(d);'
      + ' contract C { function f() public pure returns (bytes32) { return k; } }')).toBe('C');
  });
  it('keccak256 in a const with an abi.encode arg', () => {
    expect(ok('bytes32 constant k = keccak256(abi.encode(uint256(7)));'
      + ' contract C { function f() public pure returns (bytes32) { return k; } }')).toBe('C');
  });
});

// A global builtin can be invoked for side effects/checks while discarding its value. Statement calls used to
// consult only user-defined overloads, even though the same builtin resolved normally in an expression.
describe('discarded global-builtin return values', () => {
  it('accepts addmod/mulmod calls in statement position', () => {
    expect(compileString('contract C { function f(uint256 d) public pure returns (uint256) {'
      + ' addmod(1, 2, d); mulmod(1, 2, d); return 2; } }', { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('bare struct type expression statements', () => {
  it('treats a library-qualified struct type as a no-op value expression', () => {
    expect(compileString('library L { struct S { uint x; } } contract C {'
      + ' function f() public pure returns (uint) { L.S; return 1; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('discarded UDVT conversion function references', () => {
  it('treats T.wrap and T.unwrap as no-op statements when their values are discarded', () => {
    expect(compileString('type MyAddress is address; contract C { function f() public pure {'
      + ' MyAddress.wrap; MyAddress.unwrap; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('qualified interface enum references', () => {
  it('resolves I.Enum.Member alongside inherited bare and library-qualified enum members', () => {
    expect(compileString('interface I { enum Direction { A, B } } library L {'
      + ' function f() public pure returns (I.Direction) { return I.Direction.B; } }'
      + ' contract C is I { function f() public pure returns (Direction) { return Direction.B; }'
      + ' function g() public pure returns (I.Direction) { return I.Direction.B; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
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

describe('overloaded external self-call resolution', () => {
  it('defers this.f overload selection through inert value/gas call options', () => {
    expect(compileString('contract C {'
      + ' function f(uint x) external payable returns (uint) { return 1; }'
      + ' function f(uint x, uint y) external payable returns (uint) { return 2; }'
      + ' function g() public payable returns (uint, uint) {'
      + ' return (this.f{value: 10}(2), this.f{gas: 10000}(2, 3)); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('normalizes named-argument this.f calls to the ordinary external self-call path', () => {
    expect(compileString('contract C { function f(int256 a, int256 b, int256 c) public pure returns (int256) {'
      + ' return a + b + c; } function g() public view { this.f({c: 1, b: 2, a: 3}); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
    expect(() => compileString('contract C { function f(int256 a) public {}'
      + ' function g() public { this.f({missing: 1}); } }',
    { solidityImportCompat: true })).toThrow(/named|matches|argument/i);
  });
});

describe('public constant ABI getters', () => {
  it('synthesizes a zero-argument getter callable through this.CONSTANT()', () => {
    const artifact = compileString('contract C { uint256 public constant MIN = 1000;'
      + ' function f() public view returns (uint256) { return this.MIN(); } }',
    { solidityImportCompat: true });
    expect(artifact.contractName).toBe('C');
    expect(artifact.abi.some((entry) => entry.name === 'MIN')).toBe(true);
  });
});

describe('public external-function state variable getter', () => {
  it('synthesizes a zero-argument getter returning the stored function pointer', () => {
    const artifact = compileString('contract C { function (uint256) external public x;'
      + ' function g(uint256) public {} function set() public { x = this.g; }'
      + ' function read() public view returns (function(uint256) external) { return this.x(); } }',
    { solidityImportCompat: true });
    expect(artifact.contractName).toBe('C');
  });

  it('does not synthesize an ABI getter for an internal-function state variable', () => {
    const artifact = compileString('contract C { function (uint256) internal x;'
      + ' function g(uint256) internal {} }', { solidityImportCompat: true });
    expect(artifact.abi.some((entry) => entry.name === 'x')).toBe(false);
  });

  it('keeps a bare call bound to the stored pointer rather than its synthesized getter', () => {
    expect(compileString('contract C { function () external returns (uint) public g;'
      + ' function f() public { g = this.X; function () external returns (uint) e = this.g();'
      + ' assert(e() == g()); } function X() public pure returns (uint) { return 42; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('nested named memory return allocation shared with Yul', () => {
  it('keeps an unchecked string allocation and constant byte table in the same memory buffer', () => {
    const src = 'library B { bytes private constant TABLE = "abcd";'
      + ' function enc(uint256 n) internal pure returns (string memory result) {'
      + ' if (n == 0) return ""; unchecked { result = new string(n); }'
      + ' bytes memory table = TABLE; assembly ("memory-safe") {'
      + ' let p := add(result, 32) let t := add(table, 1) mstore(p, mload(t)) } return result; } }'
      + ' contract C { function f(uint256 n) public pure returns (string memory) { return B.enc(n); } }';
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  });
});

describe('internal forwarding of chunked mapping value witnesses', () => {
  it('passes same-named bytes witnesses from an entry point into its internal reader', () => {
    const src = 'contract C { mapping(uint256 => string) m;'
      + ' function read(uint256 k) private view returns (string memory) { return m[k]; }'
      + ' function f(uint256 k) public view returns (string memory) { return read(k); } }';
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  });
});

describe('contract constant scope and numeric type introspection', () => {
  it('allows contract constants to shadow globals/builtins and types min/max initializers', () => {
    expect(compileString('uint256 constant minGlobal = type(uint256).min; contract C {'
      + ' uint256 constant min = type(uint256).min; uint256 constant max = type(uint256).max; }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('discarded global function references', () => {
  it('treats compiler-special bare global names as no-op statements', () => {
    expect(compileString('contract C { function f() public pure {'
      + ' erc7201; selfdestruct; super; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('rejects bare super outside an ordinary contract member', () => {
    expect(() => compileString('contract C {} function f() pure { super; }',
      { solidityImportCompat: true })).toThrow(/Undefined reference/);
    expect(() => compileString('library L { function f() public { (super); } }',
      { solidityImportCompat: true })).toThrow(/Undefined reference/);
  });

  it('discards a declared interface function reference but rejects an unknown member', () => {
    const iface = 'interface I { function transfer(address to, uint256 value) external returns (bool); }';
    expect(compileString(`${iface} contract C { function f() public pure { I.transfer; } }`,
      { solidityImportCompat: true }).contractName).toBe('C');
    expect(() => compileString(`${iface} contract C { function f() public pure { I.missing; } }`,
      { solidityImportCompat: true })).toThrow(/Undefined|Struct|Method|reference/);
    expect(() => compileString('contract A { function f() external {} function f(uint256) external {} }'
      + ' contract C { function g() public pure { A.f; } }',
    { solidityImportCompat: true })).toThrow(/not unique|Undefined|reference/);
  });
});

// `IFoo(<state chain>).m()` - a plain-`address` field reached through self-pinned STATE, cast to an interface
// (the cast supplies the callee ABI). Generalizes the `IFoo(stateVar)` cast to a struct-field/mapping-value/array
// chain, hoisting `IFoo(chain)` into a synthesized __extaddr_ local. This is the EACC Marketplace shape
// (`IERC20(job.token).transfer(..)` where `JobPost storage job = jobs[id]`); the storage pointer is already
// inlined to `jobs[id].token` by AstBuilder, so it reaches the pass as a mapping-struct-field cast.
describe('synthesizes __extaddr for IFoo(<self-pinned state chain>).method() (EACC IERC20(job.token) shape)', () => {
  const ok = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  const iface = 'interface ITok { function transfer(address to, uint256 v) external returns (bool); }';
  const struc = 'struct Job { address token; address creator; }';
  it('casts a mapping-struct field: IFoo(jobs[id].token).transfer(..)', () => {
    expect(ok(iface + ' ' + struc + ' contract C { mapping(uint256 => Job) public jobs;'
      + ' function pay(uint256 id) public { ITok(jobs[id].token).transfer(msg.sender, 1); require(true); } }')).toBe('C');
  });
  it('casts a state-struct-var field: IFoo(j.token).transfer(..)', () => {
    expect(ok(iface + ' ' + struc + ' contract C { Job public j;'
      + ' function pay() public { ITok(j.token).transfer(msg.sender, 1); require(true); } }')).toBe('C');
  });
  it('casts a struct STORAGE-POINTER field (AstBuilder inlines job -> jobs[id])', () => {
    expect(ok(iface + ' ' + struc + ' contract C { mapping(uint256 => Job) public jobs;'
      + ' function pay(uint256 id) public { Job storage job = jobs[id];'
      + ' ITok(job.token).transfer(msg.sender, 1); require(true); } }')).toBe('C');
  });
  it('dedups two identical-chain casts to ONE synthesized local (compiles, no re-decl)', () => {
    expect(ok(iface + ' ' + struc + ' contract C { mapping(uint256 => Job) public jobs;'
      + ' function pay(uint256 id) public { ITok(jobs[id].token).transfer(msg.sender, 1);'
      + ' ITok(jobs[id].token).transfer(msg.sender, 2); require(true); } }')).toBe('C');
  });
});

// `IFoo(param.field).m()` - a field of a FUNCTION PARAM cast to an interface. Caller-supplied, so the sound
// "caller chooses whom to call" shape (extcall-target-pinning.md's param row), NOT an author-fixed value lifted
// to a caller input. This is Unicrow's `IERC20(input.currency).balanceOf(..)` (input is a calldata struct param).
describe('synthesizes __extaddr for IFoo(<param-rooted field>).method() (caller-witness, EACC input.currency)', () => {
  const ok = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  const iface = 'interface ITok { function transfer(address to, uint256 v) external returns (bool); }';
  // A struct state root so the pass visits functions (the shape appears alongside struct state in practice).
  const base = 'struct Inp { address currency; } struct Job { address token; }';
  it('casts a param struct field: IFoo(inp.currency).transfer(..)', () => {
    expect(ok(iface + ' ' + base + ' contract C { mapping(uint256 => Job) public jobs;'
      + ' function pay(Inp calldata inp) public { ITok(inp.currency).transfer(msg.sender, 1); require(true); } }')).toBe('C');
  });
  it('does NOT hoist a bare param cast (codegen already sources the param directly)', () => {
    expect(ok(iface + ' ' + base + ' contract C { mapping(uint256 => Job) public jobs;'
      + ' function pay(address t) public { ITok(t).transfer(msg.sender, 1); require(true); } }')).toBe('C');
  });
});

// InlineReturningStateHelpers.applyRename must NOT rename a struct-FIELD member that shares a name with an inlined
// local. Unicrow calculateSplits: `uint16 arbitratorFee = a.consensus ? a.arbitratorFee : 0;` - the local
// `arbitratorFee` and the field `a.arbitratorFee` collide; the catch-all rename corrupted `a.arbitratorFee` ->
// `a.__rh0_arbitratorFee` -> "Struct has no field __rh0_arbitratorFee". Fixed by skipping FieldAccessNode.name.
describe('inlined value helper: local sharing a struct-field name does not corrupt the field access', () => {
  const ok = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('compiles a single-tail-return external-call helper with a field-name-colliding local (Unicrow calculateSplits)', () => {
    const src = 'interface IArb { function calc(uint16 x) external view returns (uint16); }'
      + ' struct Arb { bool consensus; uint16 arbitratorFee; }'
      + ' contract C { IArb arb; mapping(uint => Arb) arbs;'
      + ' function _split(Arb memory a) internal view returns (uint16[2] memory) {'
      + '   uint16 arbitratorFee = a.consensus ? a.arbitratorFee : 0;'
      + '   uint16[2] memory s; s[0] = arb.calc(arbitratorFee); s[1] = a.arbitratorFee; return s; }'
      + ' function go(uint id) public view returns (uint16[2] memory) {'
      + '   uint16[2] memory r = _split(arbs[id]); return r; } }';
    expect(ok(src)).toBe('C');
  });
  it('rebuilds the NESTED struct on a packed struct-array element write (Marketplace jobs[i].roles.creator)', () => {
    // `arr[i].roles.creator = v` (members [roles, creator]): the packed-array rebuild placed the raw `v` (address)
    // at the `roles` position instead of reconstructing `Roles(v, arr[i].roles.arbitrator, arr[i].roles.worker)`,
    // failing "Found (uint8,address,uint256) in call to 'Post' where (uint8,Roles,uint256)". Drove MarketplaceV1's
    // `JobPost storage jobPost = jobs[jobId]; jobPost.roles.creator = msg.sender`.
    const S = 'struct Roles { address creator; address arbitrator; address worker; }'
      + ' struct Post { uint8 state; Roles roles; uint256 amount; }';
    const ok = (body: string): string => compileString(
      `${S} contract C { Post[] jobs; function f(uint id) public { ${body} require(true); } }`,
      { solidityImportCompat: true },
    ).contractName;
    expect(ok('jobs[id].roles.creator = msg.sender;')).toBe('C');            // direct
    expect(ok('Post storage p = jobs[id]; p.roles.creator = msg.sender;')).toBe('C'); // via storage pointer
    expect(ok('jobs[id].roles.worker = msg.sender; jobs[id].amount = 5;')).toBe('C'); // nested + flat, same elem
  });
  it('rebuilds a DEEPER (3-level) nested struct-array element write', () => {
    const S = 'struct Inner { address a; address b; } struct Mid { Inner inner; uint8 tag; }'
      + ' struct Outer { uint8 state; Mid mid; uint256 amount; }';
    const src = `${S} contract C { Outer[] xs; function f(uint id) public {`
      + ' xs[id].mid.inner.a = msg.sender; require(true); } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
  });
  it('renames abi.encodeCall(token.method) interfaceName when the helper is inlined (OZ SafeERC20.forceApprove)', () => {
    // `_enc` is inlined (reads state bal[id]), renaming its `token` param to `__rh0_token`. The abi.encodeCall's
    // interfaceName field ('token') must be renamed too, else "Interface 'token' referenced in abi.encodeCall is
    // not defined". Caller arg is `tk` (not `token`), so a dangling un-renamed `token` cannot accidentally resolve.
    const src = 'interface IERC20 { function approve(address s, uint256 v) external returns (bool); }'
      + ' contract C { mapping(uint => uint) bal;'
      + ' function _enc(IERC20 token, address s, uint256 v, uint id) internal view returns (bytes memory) {'
      + '   uint x = bal[id]; return abi.encodeCall(token.approve, (s, v + x)); }'
      + ' function f(IERC20 tk, address s, uint256 v, uint id) public view returns (bytes memory) {'
      + '   bytes memory d = _enc(tk, s, v, id); return d; } }';
    expect(ok(src)).toBe('C');
  });
});

// Calling a function-POINTER struct field directly: `s.x()`, `t[i].x()`, `m[k].x()`, `s.inner.x()`. These
// parse as a namespaced call / method call (not an indirect call), so were rejected ("Undefined reference to
// symbol s.x" / "Method calls are only supported on interface..."). SymbolTableTraversal now rewrites them to
// an IndirectCallNode reading the field (the proven `function() fp = s.x; fp()` value path). VM behavior is in
// packages/solidcash/test/FnPtrStructFieldCall.test.ts; here we byte-check equivalence to the hoist form.
describe('call a function-pointer struct field directly (s.x(), t[i].x(), m[k].x())', () => {
  const bc = (src: string): string => compileString(src, { solidityImportCompat: true }).bytecode;
  const H = 'function h() internal pure returns (uint) { return 7; }';
  const HA = 'function h(uint a) internal pure returns (uint) { return a + 1; }';
  const FP = 'function() internal pure returns (uint)';
  const FPA = 'function(uint) internal pure returns (uint)';

  it('plain struct s.x() is byte-identical to the hoist `fp = s.x; fp()`', () => {
    const S = 'struct S { ' + FP + ' x; }';
    const direct = `contract C { ${S} ${H} function f() public pure returns (uint) { S memory s; s.x = h; return s.x(); } }`;
    const hoist = `contract C { ${S} ${H} function f() public pure returns (uint) {`
      + ` S memory s; s.x = h; ${FP} fp = s.x; return fp(); } }`;
    expect(bc(direct)).toBe(bc(hoist));
  });
  it('struct-array element t[i].x() is byte-identical to the hoist', () => {
    const S = 'struct S { ' + FP + ' x; } S[1] t;';
    const direct = `contract C { ${S} ${H} function f() public returns (uint) { t[0].x = h; return t[0].x(); } }`;
    const hoist = `contract C { ${S} ${H} function f() public returns (uint) {`
      + ` t[0].x = h; ${FP} fp = t[0].x; return fp(); } }`;
    expect(bc(direct)).toBe(bc(hoist));
  });
  it('accepts direct and hoisted mapping element function-pointer calls under C2', () => {
    const S = 'struct S { ' + FP + ' x; } mapping(uint => S) m;';
    const direct = `contract C { ${S} ${H} function f() public returns (uint) { m[0].x = h; return m[0].x(); } }`;
    const hoist = `contract C { ${S} ${H} function f() public returns (uint) {`
      + ` m[0].x = h; ${FP} fp = m[0].x; return fp(); } }`;
    expect(bc(direct)).not.toHaveLength(0);
    expect(bc(hoist)).not.toHaveLength(0);
  });
  it('accepts the arg-passing forms s.x(3) / t[i].x(3) / m[k].x(3) / nested s.inner.x()', () => {
    const name = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
    const S = 'struct S { ' + FPA + ' x; }';
    expect(name(`contract C { ${S} ${HA} function f() public pure returns (uint) {`
      + ' S memory s; s.x = h; return s.x(3); } }')).toBe('C');
    expect(name(`contract C { ${S} S[1] t; ${HA} function f() public returns (uint) {`
      + ' t[0].x = h; return t[0].x(3); } }')).toBe('C');
    expect(name(`contract C { ${S} mapping(uint => S) m; ${HA} function f() public returns (uint) {`
      + ' m[0].x = h; return m[0].x(3); } }')).toBe('C');
    expect(name(`contract C { struct I { ${FP} x; } struct S2 { I inner; } ${H}`
      + ' function f() public pure returns (uint) { S2 memory s; s.inner.x = h; return s.inner.x(); } }')).toBe('C');
  });
  it('does not disturb a genuine namespaced call that looks like `base.member()` (enum + library)', () => {
    // `Lib.f()` and `E.A` share the `base.member` shape; the rewrite must only fire when `base` is a struct var.
    const name = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
    expect(name('library Lib { function f() internal pure returns (uint) { return 1; } }'
      + ' contract C { function g() public pure returns (uint) { return Lib.f(); } }')).toBe('C');
  });
});

describe('low-level call with mapping-entry operands (block-layout slot allocation)', () => {
  // `t.dest.call{value: t.val}(t.data)` where t = txs[id] reads mapping entries in the calldata, the {value}
  // option, and the target. collectEntryAccesses/assignEntrySlotIndices now walk a low-level call's data /
  // callOptions / targetExpression so each gets a block-layout slot (was "Block slot not found: entry[-1]").
  const src = 'contract C { struct T { address dest; uint val; bytes data; bool done; } mapping(uint=>T) txs;'
    + ' function exec(uint id) public { T storage t = txs[id]; (t.done,) = t.dest.call{value: t.val}(t.data); } }';
  it('allocates entry slots for a .call{value:} with entry operands (default entry model)', () => {
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  });
  it('same under C2-default (the -1 slot no longer trips the sorted read)', () => {
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  });
  it('resolves the collection behind a same-named synthesized public getter', () => {
    const inherited = 'contract Base { struct T { address dest; uint val; bytes data; bool done; }'
      + ' mapping(uint=>T) public txs; function exec(uint id) public {'
      + ' T storage t = txs[id]; (t.done,) = t.dest.call{value: t.val}(t.data); } }'
      + ' contract C is Base {}';
    expect(() => compileString(inherited, { solidityImportCompat: true })).not.toThrow();
  });
});

describe('inline deploy receiver in a file-level free function', () => {
  it('hoists and folds (new C()).x() before the free function is inlined', () => {
    const src = 'contract Child { uint public x = 2; }'
      + ' function readFresh() returns (uint) { return (new Child()).x(); }'
      + ' contract C { function f() public returns (uint) { return readFresh(); } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('deploy expression nested in a state-array push', () => {
  const child = 'contract D { uint public x; }';
  it('hoists contract/address/struct-wrapped deploy values before encoding the pushed element', () => {
    const direct = compileString(`${child} contract C { D[] ds; constructor() { ds.push(new D()); } }`,
      { solidityImportCompat: true });
    const manual = compileString(`${child} contract C { D[] ds; constructor() { D d = new D(); ds.push(d); } }`,
      { solidityImportCompat: true });
    expect(direct.bytecode).toBe(manual.bytecode);
    expect(() => compileString(`${child} contract C { address[] ds; constructor() {`
      + ' ds.push(address(new D())); } }', { solidityImportCompat: true })).not.toThrow();
    expect(() => compileString(`${child} contract C { struct S { address d; } S[] rows; constructor() {`
      + ' rows.push(S(address(new D()))); } }', { solidityImportCompat: true })).not.toThrow();
  });
});

describe('contract reads through plain-address state struct fields', () => {
  it('promotes constructor reads and pins normal-function calls through a synthesized state-read local', () => {
    const art = compileString('contract D { uint public x; } contract C { struct S { address d; } S s;'
      + ' constructor() { s.d = address(new D()); assert(D(s.d).x() == 0); }'
      + ' function f() public view returns (uint) { return D(s.d).x(); } }',
    { solidityImportCompat: true });
    expect(art.stateLayout?.constructorInputs.some((i) => i.name.startsWith('__ctorread_D_x_'))).toBe(true);
    expect(art.abi.find((f) => f.name === 'f')?.externalCalls?.[0].addressParam)
      .toMatch(/^__extaddr_/);
  });
  it('promotes a constructor read with literal arguments but not a side-effectful argument', () => {
    const head = 'contract D { function x(uint v) public pure returns (uint) { return v; } }';
    const art = compileString(`${head} contract C { D d; uint z; constructor() { z = d.x(2); } }`,
      { solidityImportCompat: true });
    expect(art.stateLayout?.constructorInputs.some((i) => i.name.startsWith('__ctorread_d_x_'))).toBe(true);
    expect(() => compileString(`${head} contract C { D d; uint z; constructor() { z = d.x(z++); } }`,
      { solidityImportCompat: true })).toThrow();
  });
});

describe('C2 (sorted) mapping write in a runtime loop: fixed-bound unrolls, dynamic diff-key insert loop', () => {
  // A C2 write inside a DYNAMIC loop is a per-iteration sorted-linked-list INSERT (co-spend the bracketing
  // predecessor, mint one NEW node; the SDK derives the evolving list). Fixed-bound loops are unrolled to static
  // writes before codegen (each a full emitSortedValueUpsert that verifies the ACTUAL value). The DYNAMIC range-splice
  // body (emitSortedInsertLoopBody) assigns every new node the SAME LOOP-INVARIANT value, so it supports a bool
  // literal (`m[k[i]] = true`) OR an int-kind INVARIANT PARAM (`m[k[i]] = v`): the SDK mints valueTail = encode(v) and
  // the covenant PICKs v + EQUALVERIFYs node.value == v (VM-proven in SortedInsertLoopValue). A PER-KEY value
  // (`m[k[i]] = vs[i]`) and an RMW (`+= v`) are instead handled by the per-iteration UPSERT loop (source-order 1:1
  // co-spend/mint, update+insert - SortedUpsertLoop), NOT the range-splice. Only the loop var (`= i`, neither a param
  // nor an array element) still falls to the clean SortedMappingCodegenPendingError.
  const mkBigint = (loop: string): string => 'contract C() { mapping(int => bigint) m;'
    + ` function f(int[] ks, int[] vs, int v, pubkey pk, sig s) { require(checkSig(s, pk)); ${loop} } }`;
  const boolLoop = 'contract C() { mapping(int => bool) m;'
    + ' function f(int[] ks, pubkey pk, sig s) { require(checkSig(s, pk));'
    + ' for (int i = 0; i < ks.length; i++) { m[ks[i]] = true; } } }';
  const abiOf = (loop: string): ReturnType<typeof compileString>['abi'][number] | undefined =>
    compileString(mkBigint(loop), { forceStateful: true }).abi.find((f) => f.name === 'f');
  const silOf = (loop: string): string[] | undefined => abiOf(loop)?.sortedInsertLoops;
  it('unrolls a fixed-bound C2 loop (static upserts handle the actual value)', () => {
    expect(() => compileString(mkBigint('for (int i = 0; i < 3; i++) { m[ks[i]] = v; }'),
      { forceStateful: true })).not.toThrow();
  });
  it('compiles a dynamic bool-value C2 set loop via the upsert loop (op=set, multi-gap + update)', () => {
    // bool `= true`/`= false` now routes to the upsert loop (bool = int 1/0) - gains multi-gap + update, not just the
    // one-gap range-splice.
    const art = compileString(boolLoop, { forceStateful: true });
    const info = art.abi.find((f) => f.name === 'f')?.sortedUpsertLoopInfo?.[0];
    expect(info?.op).toBe('set');
  });
  it('compiles an INVARIANT-PARAM value loop (m[ks[i]] = v) via the upsert loop (op=set, gains UPDATE support)', () => {
    // `= <param>` now routes to the upsert loop (was the insert-only range-splice) - update+insert, same-gap chaining.
    const info = abiOf('for (int i = 0; i < ks.length; i++) { m[ks[i]] = v; }')?.sortedUpsertLoopInfo?.[0];
    expect(info?.op).toBe('set');
    expect(info?.valueScalarParam).toBe('v');
  });
  it('compiles a PER-KEY value loop (m[ks[i]] = vs[i]) via the upsert loop (op=set)', () => {
    const info = abiOf('for (int i = 0; i < ks.length; i++) { m[ks[i]] = vs[i]; }')?.sortedUpsertLoopInfo?.[0];
    expect(info?.op).toBe('set');
    expect(info?.valueArrayParam).toBe('vs');
  });
  it('compiles a fixed-amount RMW loop (m[ks[i]] += v) via the upsert loop (op=+, invariant-param value)', () => {
    const info = abiOf('for (int i = 0; i < ks.length; i++) { m[ks[i]] += v; }')?.sortedUpsertLoopInfo?.[0];
    expect(info?.op).toBe('+');
    expect(info?.valueScalarParam).toBe('v');
  });
  it('fails closed on a loop-var value (m[ks[i]] = i, not a param)', () => {
    expect(() => silOf('for (int i = 0; i < ks.length; i++) { m[ks[i]] = i; }'))
      .toThrow(/C2 linked-list transition generator/);
  });
});

describe('low-level .call target through inlined-local aliases traced to a self-pinned state chain (EACC #2)', () => {
  // OZ SafeERC20 forceApprove's `_callOptionalReturnBool` does `address(token).call(data)`; after the SafeERC20/
  // Address chain inlines, the receiver is `address(__rh0_token)` where `token` bound to `IERC20(coll[k].field)`.
  // SynthesizeExternalAddressLocals now traces the receiver through casts + inliner-local aliases (and single-
  // assignment user locals) back to the self-pinned state chain and hoists it, so the covenant pins the co-spent
  // callee to that chain (__extaddr_ll_ source), NOT a caller input. A reassignable local is NOT traced (a caller
  // could rebind it - the forgery extcall-target-pinning.md forbids), so it fails closed.
  const src = (mid: string): string => 'pragma solidcash >=0.8.0;'
    + ' interface IEcho { function ping(pubkey o, sig s); } struct Config { address token; }'
    + ' contract C() { Config config; int calls;'
    + ' function _callBool(IEcho tok, bytes data) internal returns (bool) { bool ok, bytes r = address(tok).call(data); return ok; }'
    + ` function f(bytes data, address attacker, pubkey pk, sig s) { require(checkSig(s, pk)); ${mid}`
    + ' bool ok = _callBool(token, data); require(ok); this.calls = this.calls + 1; } }';
  const extcallOf = (s: string): { addressStateVar?: string } | undefined => compileString(s, {}).abi
    .find((f) => f.name === 'f')?.externalCalls?.find((e) => e.opaqueReturn);

  it('sources a single-assignment user-local intermediary from the state chain (Marketplace token = IERC20(job.token))', () => {
    expect(extcallOf(src('IEcho token = IEcho(config.token);'))?.addressStateVar).toBe('ll_config_token');
  });
  it('fails closed on a REASSIGNED local (a caller-rebindable target is never hoisted)', () => {
    expect(() => compileString(src('IEcho token = IEcho(config.token); token = IEcho(attacker);'), {}))
      .toThrow(/external call target address must be a constructor\/function parameter/);
  });
  it('sources a DIRECT address(config.token).call cast (no helper) from the state chain', () => {
    const direct = 'pragma solidcash >=0.8.0; struct Config { address token; } contract C() { Config config; bytes32 d;'
      + ' function f(bytes data, pubkey pk, sig s) { require(checkSig(s, pk));'
      + ' bool ok, bytes r = address(config.token).call(data); require(ok); this.d = sha256(data); } }';
    expect(compileString(direct, {}).abi.find((f) => f.name === 'f')?.externalCalls?.find((e) => e.opaqueReturn)
      ?.addressStateVar).toBe('ll_config_token');
  });
});

describe('prune unreachable inline-assembly free functions (EACC EACCToken: dead OZ Strings/MessageHashUtils)', () => {
  // An imported library ships an assembly helper the contract never calls. Its EVM memory-primitive assembly
  // (scratch-memory mstore + keccak256, like MessageHashUtils.toEthSignedMessageHash) does not type-check on BCH,
  // but it is dead code: PruneUnreachableFreeFunctions now treats an inline-assembly free fn as prunable-when-
  // unreachable (previously only low-level-call helpers were), so the whole compile no longer fails on code that
  // never runs. A REACHABLE assembly helper is still kept (and still fails), so nothing live is silently dropped.
  const lib = 'library MHU {'
    + ' function toEthSignedMessageHash(bytes32 h) internal pure returns (bytes32 d) {'
    + ' assembly { mstore(0x00, "\\x19Ethereum Signed Message:\\n32") mstore(0x1c, h) d := keccak256(0x00, 0x3c) } }'
    + ' function plain(uint256 a) internal pure returns (uint256) { return a + 1; } }';
  const resolver = (p: string): { source: string; id: string } | undefined => (
    p === './MHU.sol' ? { source: `pragma solidity ^0.8.20;${lib}`, id: '/MHU.sol' } : undefined);
  const opt = { importResolver: resolver, rootFileId: '/main.sol', solidityImportCompat: true };

  it('drops an UNREACHABLE assembly helper so its EVM-memory assembly never blocks the compile', () => {
    const code = 'import { MHU } from "./MHU.sol"; contract C { uint256 public x; function f() public { x = MHU.plain(1); } }';
    expect(() => compileString(code, opt)).not.toThrow();
  });
  it('keeps a REACHABLE assembly helper (nothing live is dropped - it is still compiled, and here still rejected)', () => {
    const code = 'import { MHU } from "./MHU.sol";'
      + ' contract C { bytes32 public x; function f(bytes32 h) public { x = MHU.toEthSignedMessageHash(h); } }';
    // Reachable -> kept -> its scratch-memory assembly is genuinely reached; it must NOT silently vanish.
    expect(() => compileString(code, opt)).toThrow();
  });
});

describe('external-call target through a single-assignment local intermediary (EACC Marketplace takeJob / unicrow)', () => {
  // Two Marketplace shapes where the target hides behind a single-assignment local: (a) a STORAGE-POINTER base
  // (`JobPost storage job = jobs[id]; IERC20 token = IERC20(job.token); ...call`) the AstBuilder did not inline, so
  // `job.token` must be resolved to `jobs[id].token`; (b) an interface local (`IUnicrow u = IUnicrow(unicrowAddress);
  // u.pay()`) the codegen cannot source ("variable 'unicrow' does not exist on the stack"). Both hoist the resolved
  // self-pinned target. A REASSIGNED local is not traced (falls back to the caller-witness local source).
  it('resolves a storage-pointer local base at a low-level .call target (job.token -> jobs[id].token)', () => {
    const src = 'pragma solidcash >=0.8.0; interface ITok { function ping(pubkey o, sig s); }'
      + ' struct Job { address token; } contract C() { mapping(int => Job) jobs; int calls;'
      + ' function _callBool(ITok tok, bytes data) internal returns (bool) { bool ok, bytes r = address(tok).call(data); return ok; }'
      + ' function f(int jobId, bytes data, pubkey pk, sig s) { require(checkSig(s, pk));'
      + ' Job storage job = jobs[jobId]; ITok token = ITok(job.token);'
      + ' bool ok = _callBool(token, data); require(ok); this.calls = this.calls + 1; } }';
    const ec = compileString(src, {}).abi.find((f) => f.name === 'f')?.externalCalls?.find((e) => e.opaqueReturn);
    expect(ec?.addressStateVar).toBe('ll_jobs_jobId_token');
  });
  it('hoists an interface local intermediary IUnicrow u = IUnicrow(unicrowAddress); u.pay() from the state var', () => {
    const src = 'pragma solidcash >=0.8.0; interface IUnicrow { function pay(int amt, pubkey o, sig s); }'
      + ' contract C() { address unicrowAddress; int calls;'
      + ' function f(int amt, pubkey pk, sig s) { require(checkSig(s, pk));'
      + ' IUnicrow u = IUnicrow(unicrowAddress); u.pay(amt, pk, s); this.calls = this.calls + 1; } }';
    const ec = compileString(src, {}).abi.find((f) => f.name === 'f')?.externalCalls?.[0];
    expect(ec?.addressParam).toBe('__extaddr_unicrowAddress_IUnicrow');
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

describe('C2-default: OVERLOADED internal C2-writer chain inlines by (name, arity) (OZ ERC20 _approve/3 -> _approve/4)', () => {
  // `_approve/3` calls `_approve/4` (which writes the C2 `_allowances`). InlineStoragePointerCalls resolved callees
  // and its recursion guard by NAME only, so the arity-4 call inside `_approve/3` was never inlined yet `_approve`
  // was dropped by name -> "Undefined reference to symbol _approve". Overload-aware (name, arity) resolution fixes it.
  it('compiles the overloaded _approve chain that writes a nested C2 mapping', () => {
    const src = 'pragma solidity ^0.8.20; contract Base {'
      + ' mapping(address => mapping(address => uint256)) private _allowances;'
      + ' function _approve(address o, address s, uint256 v, bool e) internal { _allowances[o][s] = v; }'
      + ' function _approve(address o, address s, uint256 v) internal { _approve(o, s, v, true); }'
      + ' function approve(address s, uint256 v) public returns (bool) { _approve(msg.sender, s, v); return true; } }'
      + ' contract Derived is Base {}';
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
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

describe('postfix on a mapping/array element in a return: `return m[k]++` (OZ Nonces._useNonce)', () => {
  // `return m[k]++` returns the pre-value: hoist `m[k] = m[k]+1` before, reconstruct `m[k]-1`. isLeftmostBaseRef
  // required the first base ref to BE the operand, but for `m[k]++` the operand is the Mapping/ArrayAccess and the
  // first `m` ref is the identifier INSIDE it - now accepted (the base is still not read before the postfix). A base
  // read BEFORE the postfix (`m[a] + m[b]++`) still fails closed (the reconstruction would see the post-value).
  it('lowers `return m[k]++` on a mapping element', () => {
    expect(() => compileString('pragma solidity ^0.8.20; contract C { mapping(uint=>uint) m;'
      + ' function f(uint k) public returns (uint) { return m[k]++; } }', { solidityImportCompat: true })).not.toThrow();
  });
  it('still FAILS CLOSED when the base is read before the postfix (`return m[a] + m[b]++`)', () => {
    expect(() => compileString('pragma solidity ^0.8.20; contract C { mapping(uint=>uint) m;'
      + ' function f(uint a, uint b) public returns (uint) { return m[a] + m[b]++; } }', { solidityImportCompat: true }))
      .toThrow(/read before the/);
  });
});

describe('StorageSlot slot-ALIAS factory: getStringSlot(ref).value = v is a direct write of the aliased ref (EACCToken)', () => {
  // OZ StorageSlot.getStringSlot(string storage store) does `assembly { r.slot := store.slot }` - it aliases the
  // return pointer to `store`'s slot, so `getStringSlot(ref).value = v` is just `ref = v`. That routes a string/bytes
  // through the native dynamic-storage write (not the word-granular __evm_storage register a raw-slot factory uses).
  // The value-returning factory's `r.slot := store.slot` was previously an unlowerable Yul block.
  const lib = ' struct StringSlot { string value; } library StorageSlot {'
    + ' function getStringSlot(string storage store) internal pure returns (StringSlot storage r)'
    + ' { assembly { r.slot := store.slot } } }';
  it('compiles the LOCAL slot-alias form (S storage d = getStringSlot(_fb); d.value = v)', () => {
    const src = 'pragma solidity ^0.8.20;' + lib + ' contract C { string _fb;'
      + ' function set(string memory v) public { StringSlot storage d = StorageSlot.getStringSlot(_fb); d.value = v; } }';
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  });
  it('compiles the INLINE slot-alias form (getStringSlot(_fb).value = v)', () => {
    const src = 'pragma solidity ^0.8.20;' + lib + ' contract C { string _fb;'
      + ' function set(string memory v) public { StorageSlot.getStringSlot(_fb).value = v; } }';
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  });
  it('leaves the raw-slot PARAM factory (getUint256Slot -> __evm_storage register) working', () => {
    const src = 'pragma solidity ^0.8.20; struct Uint256Slot { uint256 value; }'
      + ' library StorageSlot { function getUint256Slot(bytes32 slot) internal pure returns (Uint256Slot storage r)'
      + ' { assembly { r.slot := slot } } }'
      + ' contract C { function setU(bytes32 slot, uint256 v) public { StorageSlot.getUint256Slot(slot).value = v; } }';
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  });
});

describe('early return inside an `unchecked` block in a LIBRARY function (OZ Math.tryAdd)', () => {
  // `unchecked { uint c = a + b; if (c < a) return (false, 0); return (true, c); }` as a library function: the
  // early return inside the unchecked block must be nested into if/else (EarlyReturnTransformation now recurses into
  // unchecked, and no longer skips a single-statement body), else codegen's visitBranch desyncs the fall-through
  // stack and throws "Expected variable 'c' does not exist on the stack".
  const src = 'library Math { function tryAdd(uint256 a, uint256 b) internal pure returns (bool, uint256) {'
    + ' unchecked { uint256 c = a + b; if (c < a) return (false, 0); return (true, c); } } }'
    + ' contract C { using Math for uint256; function f(uint256 x, uint256 y) public pure returns (uint256) {'
    + ' (bool ok, uint256 r) = Math.tryAdd(x, y); require(ok); return r; } }';
  it('compiles a called library tryAdd with an unchecked early return', () => {
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  });
  it('compiles when tryAdd is DEAD (uncalled) too', () => {
    const dead = 'library Math { function tryAdd(uint256 a, uint256 b) internal pure returns (bool, uint256) {'
      + ' unchecked { uint256 c = a + b; if (c < a) return (false, 0); return (true, c); } } }'
      + ' contract C { function f(uint256 x) public pure returns (uint256) { return x; } }';
    expect(() => compileString(dead, { solidityImportCompat: true })).not.toThrow();
  });
});

describe('dead assembly library helper is pruned even after its assembly fully lowers (OZ Math.mulDiv)', () => {
  // A DEAD library fn whose assembly lowers to plain ops (mulmod) leaves no residual assembly block, so the prune
  // pass would miss it by post-lowering detection; LowerInlineAssembly now stamps `hadInlineAssembly` before
  // lowering so PruneUnreachableFreeFunctions still drops it. Without the drop it reaches codegen and fails.
  it('prunes an unreachable fully-lowerable-assembly helper', () => {
    const src = 'library Math { function mulHi(uint256 a, uint256 b) internal pure returns (uint256 result) {'
      + ' unchecked { uint256 prod0 = a * b; assembly { let mm := mulmod(a, b, not(0)) result := sub(mm, prod0) }'
      + ' if (result == 0) { return prod0; } return result; } } }'
      + ' contract C { function f(uint256 x) public pure returns (uint256) { return x; } }';
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  });
  it('KEEPS a reachable assembly helper (still compiles when actually used)', () => {
    const src = 'library Math { function dbl(uint256 a) internal pure returns (uint256 r) {'
      + ' assembly { r := add(a, a) } } }'
      + ' contract C { using Math for uint256; function f(uint256 x) public pure returns (uint256) {'
      + ' return Math.dbl(x); } }';
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

describe('legacy 0.6.x low-level call-option syntax target.call.value(v)(data) / .call.gas(g)(data)', () => {
  // Superseded by `.call{value:v}(data)`; MistSwap Timelock.executeTransaction uses the old form. `.value` lexes
  // as the DotValue token (shared with `tx.outputs[i].value`), `.gas` as `'.' Identifier` - both desugar to a
  // MethodCall carrying call options, the same node the modern brace form produces.
  const ok = (src: string): void => {
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  };
  const mk = (call: string): string => 'pragma solidity ^0.6.0; contract T {'
    + ` function exec(address target, uint256 v, bytes memory cd) public returns (bool) { (bool okk, bytes memory r)`
    + ` = ${call}; return okk; } }`;
  it('accepts target.call.value(v)(data)', () => ok(mk('target.call.value(v)(cd)')));
  it('accepts target.call.gas(v)(data)', () => ok(mk('target.call.gas(v)(cd)')));
  it('is equivalent to the modern brace form', () => ok(mk('target.call{value: v}(cd)')));
  it('does not disturb tx.outputs[i].value introspection', () => {
    ok('contract T { function f() public returns (int) { require(tx.outputs[0].value >= 0); return tx.outputs[0].value; } }');
  });
});

describe('internally-called PUBLIC low-level-call helper is inlined (Multicall2 tryAggregate pattern)', () => {
  // A public value-returning helper that makes a low-level call injects an entry-only covenant param, so it cannot
  // be an OP_INVOKE subroutine. An internal call to it must inline (while its own public definition stays a
  // dispatched entry); previously the internal call hit a phantom-param arity mismatch. Transitive chains too.
  const ok = (src: string): void => {
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  };
  it('inlines an internal call to a public low-level-call helper', () => {
    ok('contract T { function helper(address a, bytes memory d) public returns (bool) {'
      + ' (bool okk, bytes memory r) = a.call(d); return okk; }'
      + ' function outer(address a, bytes memory d) public returns (bool) { return helper(a, d); } }');
  });
  it('inlines a transitive chain of public low-level-call helpers', () => {
    ok('contract T { function inner(address a, bytes memory d) public returns (bool) {'
      + ' (bool okk, bytes memory r) = a.call(d); return okk; }'
      + ' function mid(address a, bytes memory d) public returns (bool) { return inner(a, d); }'
      + ' function outer(address a, bytes memory d) public returns (bool) { return mid(a, d); } }');
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

describe('Solidity <0.7 `now` aliases block.timestamp (shadowing respected)', () => {
  const ok = (src: string): void => {
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  };
  it('resolves a bare `now` to block.timestamp', () => {
    ok('pragma solidity ^0.6.0; contract T { uint256 d;'
      + ' function f() public view returns (bool) { return now >= d; } }');
  });
  it('does not alias a `now` declared as a local variable', () => {
    ok('pragma solidity ^0.8.0; contract T {'
      + ' function f() public pure returns (uint256) { uint256 now = 5; return now; } }');
  });
  it('does not alias a `now` declared as a parameter', () => {
    ok('pragma solidity ^0.8.0; contract T {'
      + ' function f(uint256 now) public pure returns (uint256) { return now; } }');
  });
});

describe('nested mapping to a struct value, outer index a number literal (COMP checkpoints)', () => {
  // `mapping(K1 => mapping(K2 => Struct))` read `m[k][0].field`: the trailing `[0]` parses as a tuple index, and
  // the inner `m[k]` previously over-resolved to the innermost struct so indexing it failed. Route the whole chain
  // through the mapping-access path so both keys resolve together. Single-level `m[0].field` already worked.
  const S = 'struct CP { uint32 fromBlock; uint256 votes; }';
  const ok = (body: string): void => {
    expect(() => compileString(`contract T { ${S}`
      + ' mapping(address => mapping(uint32 => CP)) public cps;'
      + ` function f(address a, uint32 n) public view returns (uint256) { ${body} } }`,
    { solidityImportCompat: true })).not.toThrow();
  };
  it('reads a field via a literal outer index', () => ok('return cps[a][0].votes;'));
  it('reads the whole struct to memory via a literal outer index', () => ok('CP memory c = cps[a][0]; return c.votes;'));
  it('still works with an expression outer index', () => ok('return cps[a][n - 1].votes;'));
});

describe('interface-cast using-for + resolved-back-edge recursion robustness (OZ SafeERC20 shape)', () => {
  const ok = (src: string): void => {
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  };
  const lib = 'interface IERC20 { function transfer(address to, uint256 v) external returns (bool); }'
    + ' library SafeERC20 { function safeTransfer(IERC20 token, address to, uint256 v) internal {'
    + ' require(token.transfer(to, v), "fail"); } }';
  it('rewrites IERC20(x).safeTransfer(to,v) -> SafeERC20.safeTransfer(IERC20(x),to,v)', () => {
    ok(`pragma solidity ^0.8.0; ${lib} contract C { using SafeERC20 for IERC20;`
      + ' function f(address x, address to, uint256 v) public { IERC20(x).safeTransfer(to, v); } }');
  });
  it('handles the cast rewrite nested in a block and mixed with a genuine interface method', () => {
    ok(`pragma solidity ^0.8.0; ${lib} contract C { using SafeERC20 for IERC20;`
      + ' function f(address x, address to, uint256 v, bool c) public {'
      + ' if (c) { IERC20(x).safeTransfer(to, v); } require(IERC20(x).transfer(to, v)); } }');
  });
  it('does not stack-overflow the SymbolTable analysis walks on the OZ SafeERC20 _callOptionalReturn chain', () => {
    // The ad-hoc analysis walks (collectLoopWrittenSlotKeys, keccakCallInLoop, bodyContainsStateWrites,
    // addLoopVaryingVars) must not follow resolved back-edges (FunctionCall.resolvedFunction etc.) - the deep OZ
    // SafeERC20 -> _callOptionalReturn -> low-level-call chain re-traversed them into a stack overflow. The
    // extcall-target-sourcing limit is a separate, expected wall; the point here is NO "Maximum call stack size".
    const src = 'pragma solidity ^0.8.0;'
      + ' interface IERC20 { function transfer(address to, uint256 v) external returns (bool); }'
      + ' library SafeERC20 {'
      + ' function safeTransfer(IERC20 token, address to, uint256 v) internal {'
      + ' _callOptionalReturn(token, abi.encodeWithSelector(token.transfer.selector, to, v)); }'
      + ' function _callOptionalReturn(IERC20 token, bytes memory data) private {'
      + ' (bool okk, bytes memory ret) = address(token).call(data); require(okk, "fail"); } }'
      + ' contract C { using SafeERC20 for IERC20;'
      + ' function f(address x, address to, uint256 v, uint256 n) public {'
      + ' for (uint256 i = 0; i < n; i++) { IERC20(x).safeTransfer(to, v); } } }';
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow(/Maximum call stack/);
  });
});

describe('clearer diagnostic for an external call on an interface-typed struct-field receiver', () => {
  // `pool.lpToken.balanceOf(..)` where the field is an interface type: the receiver IS an interface instance, so the
  // generic "only supported on interface/contract instances" error was misleading. Give the accurate limitation +
  // the hoist-to-local workaround (which compiles for a non-inlined receiver; the co-spent target then traces).
  const I = 'interface IERC20 { function balanceOf(address a) external view returns (uint256); }';
  it('captures an interface field from a mutable C2 mapping-entry cache at the call site', () => {
    const src = `pragma solidity ^0.8.0; ${I} contract C { struct Pool { IERC20 lpToken; uint256 x; }`
      + ' mapping(uint256 => Pool) pools; function f(uint256 k) public returns (uint256) {'
      + ' Pool storage pool = pools[k]; pool.x++; return pool.lpToken.balanceOf(address(this)); } }';
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  });
  it('captures a state-backed struct field after its constructor assignment, at the call site', () => {
    const src = 'pragma solidity ^0.8.0; contract D { uint256 public x; } contract C {'
      + ' struct S { D d; } S s; constructor() { s.d = new D(); require(s.d.x() == 0); }'
      + ' function f() public view returns (uint256) { return s.d.x(); } }';
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  });
  it('still rejects an interface field from a reassignable memory struct', () => {
    const src = `pragma solidity ^0.8.0; ${I} contract C { struct Pool { IERC20 lpToken; uint256 x; }`
      + ' function f(IERC20 a, IERC20 b, bool c) public view returns (uint256) {'
      + ' Pool memory pool = Pool(a, 0); if (c) pool = Pool(b, 1);'
      + ' return pool.lpToken.balanceOf(address(this)); } }';
    expect(() => compileString(src, { solidityImportCompat: true }))
      .toThrow(/interface-typed struct field or computed receiver/);
  });
  it('the hoist-to-local workaround compiles', () => {
    const src = `pragma solidity ^0.8.0; ${I} contract C { struct Pool { IERC20 lpToken; uint256 x; } Pool[] poolInfo;`
      + ' function f(uint256 pid) public view returns (uint256) {'
      + ' IERC20 r = poolInfo[pid].lpToken; return r.balanceOf(address(this)); } }';
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  });
});

describe('using-for on an interface-typed struct-field / state-var receiver (not hoisted as an external call)', () => {
  // A `using L for IERC20` library method on an interface-typed struct FIELD (`pool.lpToken.tag()`) is a using-for
  // call, NOT an external call: SynthesizeExternalAddressLocals must not hoist it into an __extaddr_ address local
  // (which drops the interface and breaks dispatch), and tryResolveUsingFor must match the binding by interface NAME
  // (an interface-typed receiver's toString() is the bare 'address', but the binding is keyed by the interface).
  const lib = 'interface IERC20 { function balanceOf(address a) external view returns (uint256); }'
    + ' library L { function tag(IERC20 t) internal pure returns (uint256) { return 7; } }';
  const ok = (src: string): void => {
    expect(() => compileString(`pragma solidity ^0.8.0; ${lib} ${src}`, { solidityImportCompat: true })).not.toThrow();
  };
  it('resolves a pure library method on an interface-typed struct field', () => {
    ok('contract C { struct Pool { IERC20 lpToken; uint256 x; } Pool[] poolInfo; using L for IERC20; uint256 s;'
      + ' function f(uint256 pid) public { Pool storage pool = poolInfo[pid]; s = pool.lpToken.tag(); } }');
  });
  it('still hoists a genuine interface method on the same struct field (external call, param index)', () => {
    ok('contract C { struct Pool { IERC20 lpToken; uint256 x; } Pool[] poolInfo; uint256 s;'
      + ' function g(uint256 pid) public { Pool storage pool = poolInfo[pid]; s = pool.lpToken.balanceOf(address(this)); } }');
  });
});

describe('chained overloaded using-for + interface-local-var dispatch (MistSwap SafeMath/SafeERC20)', () => {
  const opts = { solidityImportCompat: true };
  const ok = (src: string): void => {
    expect(() => compileString(`pragma solidity ^0.8.0; ${src}`, opts)).not.toThrow();
  };

  // `t.sub(x).add(y)` where SafeMath OVERLOADS sub(a,b)/sub(a,b,msg) (OZ). The inner `.sub` lowers to a namespaced
  // library call whose overload (hence return type) is not yet resolved; the outer `.add` must still infer uint256
  // from it (by the unique arg-count) or it fell through to MethodCallNotSupported. MasterChef `set()` line 136.
  const SM = 'library SafeMath { function add(uint256 a, uint256 b) internal pure returns (uint256){ return a+b; }'
    + ' function sub(uint256 a, uint256 b) internal pure returns (uint256){ return sub(a,b,"s"); }'
    + ' function sub(uint256 a, uint256 b, string memory m) internal pure returns (uint256){'
    + ' require(b<=a,m); return a-b; } }';
  it('resolves a chained call through an overloaded library method', () => {
    ok(`${SM} contract C { using SafeMath for uint256; uint256 t;`
      + ' function f(uint256 x, uint256 y) public { t = t.sub(x).add(y); } }');
  });

  // `using SafeERC20 for IERC20` on a LOCAL interface var: a library method (safeApprove) rewrites to
  // SafeERC20.safeApprove, but an INTERFACE method (balanceOf, NOT declared by SafeERC20) must stay an external
  // call - the AstBuilder must not blindly rewrite it to a non-existent SafeERC20.balanceOf. MasterChef migrate().
  const SE = 'interface IERC20 { function balanceOf(address a) external view returns (uint256);'
    + ' function approve(address s, uint256 v) external returns (bool); }'
    + ' library SafeERC20 { function safeApprove(IERC20 tok, address s, uint256 v) internal { tok.approve(s,v); } }';
  it('keeps an interface method external while rewriting the library method on a local interface var', () => {
    ok(`${SE} contract C { using SafeERC20 for IERC20;`
      + ' function f(IERC20 tok) public view returns (uint256) { return tok.balanceOf(address(this)); }'
      + ' function g(IERC20 tok, uint256 v) public { tok.safeApprove(address(this), v); } }');
  });

  // A using-for method on a COMPUTED (binary-op) receiver `(a - b).add(c)` (UniswapV2Library.quote): the operator
  // preserves the operand type, so the `.add` binds to `using SafeMath for uint256` even though the receiver has no
  // .type yet. Was MethodCallNotSupported (resolveLowLevelReceiverType returned undefined for a BinaryOpNode).
  it('resolves a using-for method on a computed binary-op receiver', () => {
    ok('library SafeMath { function add(uint256 a, uint256 b) internal pure returns (uint256){ return a+b; } }'
      + ' contract C { using SafeMath for uint256; uint256 s;'
      + ' function f(uint256 a, uint256 b, uint256 c) public { s = (a - b).add(c); } }');
  });

  // A returning library helper that makes an external call (`getReservesFor -> pair.getReserves()`) reached only
  // THROUGH another inlined helper (`_mid`) must inline transitively - else the external-call covenant param surfaces
  // as phantom params at the call site (`Found parameters (..) where (.., bigint, bytes4, bigint) were expected`).
  // SushiRoll `_addLiquidity -> UniswapV2Library.getReserves`. The target is a param here, so it fully compiles.
  const PAIR = 'interface IPair { function getReserves() external view returns (uint112, uint112, uint32); }'
    + ' library Lib { function getReservesFor(IPair pair) internal view returns (uint rA, uint rB){'
    + ' (uint r0, uint r1,) = pair.getReserves(); (rA, rB) = (r0, r1); } }';
  it('inlines a returning external-call library helper reached transitively through another helper', () => {
    ok(`${PAIR} contract C {`
      + ' function _mid(IPair pair) internal view returns (uint x, uint y){ (x, y) = Lib.getReservesFor(pair); }'
      + ' function f(IPair pair) public view returns (uint x, uint y){ (x, y) = _mid(pair); } }');
  });

  // A COMPUTED external-call target `IFoo(pairFor(factory, a, b)).m()` (MistSwap `IUniswapV2Pair(pairFor(..))`):
  // the address is an author-written pure computation over params/state, hoisted into an __extaddr_ local so the
  // co-spend pins the runtime-computed target - was "external call target address must be a param". A pure computed
  // target (params only) compiles; a target embedding an external call (`pairFor(router.factory())`) stays a clean
  // "must be a param" error (the transitive case). VM-proven sound in ComputedExtcallTarget.test.ts.
  const COMP = 'interface IPair { function getReserves() external view returns (uint112, uint112, uint32); }'
    + ' library Lib { function pairFor(address f, address a, address b) internal pure returns (address){ return a; }'
    + ' function getReserves(address factory, address a, address b) internal view returns (uint rA, uint rB){'
    + ' (uint r0, uint r1,) = IPair(pairFor(factory, a, b)).getReserves(); (rA, rB) = (r0, r1); } }';
  it('hoists a computed external-call target IFoo(pairFor(..)) rooted in params', () => {
    ok(`${COMP} contract C { function f(address factory, address a, address b) public view returns (uint x, uint y){`
      + ' (x, y) = Lib.getReserves(factory, a, b); } }');
  });

  // The create2 address form wraps the computed call in numeric/address casts: `IPair(address(uint(keccak256(..))))`.
  // castComputedTarget / hasComputedCastTarget unwrap the cast chain so the wrapped call still hoists into an
  // __extaddr_ local. The allLeavesBodyTop gate and the co-spend identity pin are unchanged, so a target whose leaves
  // are not all params/self-pinned state still fails closed (never a caller-substitutable witness).
  it('hoists a cast-WRAPPED computed external-call target IFoo(address(comp(a)))', () => {
    ok('interface IFoo { function m(uint256 x) external; }'
      + ' contract C { function comp(address a) internal pure returns (address){ return a; }'
      + ' function f(address a) public { IFoo(address(comp(a))).m(5); } }');
  });
  it('fails closed on a cast-wrapped computed target with a non-param/state (mutable local) leaf', () => {
    expect(() => compileString('pragma solidity ^0.8.0;'
      + ' interface IFoo { function m(uint256 x) external; }'
      + ' contract C { function comp(address a) internal pure returns (address){ return a; }'
      + ' function f(address a) public { address b = a; b = address(0); IFoo(address(comp(b))).m(5); } }', opts))
      .toThrow(/target address must be a constructor\/function parameter/);
  });

  // A computed target whose leaves are TUPLE-DESTRUCTURED locals (`(a, b) = (x, y)` swap-loop / `(t0, t1) =
  // sortTokens(x, y)` pairFor) resolves each element to its per-slot RHS / the i-th call return, so allLeavesBodyTop
  // sees param/state leaves and hoists. localInits is pre-populated whole-body (order-independent) and the alias
  // resolver follows a bare-identifier chain (`__rh5_x = __rh3_x = x`) across inline levels. UniswapV2Library.
  it('hoists a computed target whose leaves are tuple-destructured locals', () => {
    ok('interface IPair { function m(uint256 x) external; } contract C { address factory;'
      + ' function comp(address f, address u, address v) internal pure returns (address){ return f; }'
      + ' function g(address x, address y) public { (address a, address b) = (x, y); IPair(comp(factory, a, b)).m(5); } }');
  });
  it('hoists a computed target whose leaves are a tuple destructured from a call', () => {
    ok('interface IPair { function m(uint256 x) external; } contract C {'
      + ' function sortT(address u, address v) internal pure returns (address, address){ return u < v ? (u, v) : (v, u); }'
      + ' function comp(address u, address v) internal pure returns (address){ return u; }'
      + ' function g(address x, address y) public { (address a, address b) = sortT(x, y); IPair(comp(a, b)).m(5); } }');
  });

  // A TRANSITIVE computed target: a leaf is a single-assign local that is a pinned EXTERNAL-CALL RETURN
  // (`factory = router.factory()`), which only exists mid-body. castTransitiveTarget keeps it as a live materialised
  // leaf (substituteAliasesInPlace inlineOnly + containsExternalCall) and places the __extaddr_ decl right before the
  // use (visitBlock), where it is live. SOUND: at-most-param-permissive; a mutable-local leaf still fails closed.
  // SushiRoll `IUniswapV2Pair(pairFor(IUniswapV2Factory(router.factory()), a, b)).getReserves()`.
  it('hoists a transitive computed target rooted in a pinned call-return local', () => {
    ok('interface IPair { function m(uint256 x) external; }'
      + ' interface IRouter { function factory() external view returns (address); }'
      + ' contract C { IRouter router;'
      + ' function comp(address f, address a, address b) internal pure returns (address){ return f; }'
      + ' function g(address a, address b) public {'
      + ' address factory = router.factory(); IPair(comp(factory, a, b)).m(5); } }');
  });
  it('fails closed on a transitive target rooted in a reassignable local', () => {
    expect(() => compileString('pragma solidity ^0.8.0;'
      + ' interface IPair { function m(uint256 x) external; }'
      + ' contract C { function comp(address f) internal pure returns (address){ return f; }'
      + ' function g(address a) public { address x = a; x = address(0); IPair(comp(x)).m(5); } }', opts))
      .toThrow(/target address must be a constructor\/function parameter/);
  });

  // A BRANCH-LOCAL external-call target (declared inside an `if`, used by a cast/low-level call in that branch) is
  // hoisted to the function-body top so the co-spend reads it at the epilogue - UniswapV2Pair.mint's `migrator`
  // (nested-branch), was "Expected variable 'migrator' does not exist on the stack". The external call stays
  // conditional; VM-proven sound in BranchLocalExtcallTarget.test.ts.
  it('hoists a doubly-nested branch-local external-call target to the body top', () => {
    ok('interface IFactory { function migrator() external view returns (address); }'
      + ' interface IMigrator { function desiredLiquidity() external view returns (uint256); }'
      + ' contract C { address factory; function f(address sender, uint256 ts) public view returns (uint256 liq){'
      + ' liq = 0; if (ts == 0) { address migrator = IFactory(factory).migrator();'
      + ' if (sender == migrator) { liq = IMigrator(migrator).desiredLiquidity(); } } } }');
  });
});

describe('using-for external-call library method on an interface-typed state var (OZ SafeERC20 pattern)', () => {
  // `IERC20 public token; using SafeERC20 for IERC20; token.safeTransfer(..)` - safeTransfer is a using-for LIBRARY
  // method (whose body does a low-level/external call), NOT an IERC20 method. It must be rewritten to
  // `SafeERC20.safeTransfer(token, ..)` PRE-inlining (in RedesugarImportedUsingForCalls) so the external-call helper
  // reaches its inliner; a SymbolTable-time resolution is too late (the helper's covenant param then surfaces).
  const lib = 'interface IERC20 { function transfer(address to, uint256 v) external returns (bool); }'
    + ' library SafeERC20 { function safeTransfer(IERC20 token, address to, uint256 v) internal {'
    + ' require(token.transfer(to, v), "f"); } }';
  const ok = (src: string): void => {
    expect(() => compileString(`pragma solidity ^0.8.0; ${lib} ${src}`, { solidityImportCompat: true })).not.toThrow();
  };
  it('compiles token.safeTransfer(..) on an interface state var', () => {
    ok('contract C { IERC20 tok; using SafeERC20 for IERC20;'
      + ' function f(address to, uint256 v) public { tok.safeTransfer(to, v); } }');
  });
  it('leaves a genuine interface method (tok.transfer) as an external call', () => {
    ok('contract C { IERC20 tok; using SafeERC20 for IERC20;'
      + ' function f(address to, uint256 v) public { require(tok.transfer(to, v)); } }');
  });
});

describe('opaque MultiCall over a struct-array parameter (Multicall2 calls[i].target.call(calls[i].callData))', () => {
  // The opaque loop dispatch `targets[i].call(data[i])` (working over parallel address[]/bytes[] arrays) extended
  // to a struct-array param `Call[] { address target; bytes callData; }` where the target and calldata are FIELDS
  // of each element. The covenant is the same per-iteration inline loop (emitInlineLoopExternalCall), pinning each
  // co-spent callee to `calls[i].target` (decoded via visitFieldAccess); the array parameter is resolved through
  // inliner SSA aliases (`__rh<N>_calls`) back to the real param so the GTT gate + SDK recognise it.
  const ok = (src: string): void => {
    expect(() => compileString(`pragma experimental ABIEncoderV2; ${src}`, { solidityImportCompat: true })).not.toThrow();
  };
  it('compiles the direct struct-array opaque loop', () => {
    ok('contract C { struct Call { address target; bytes callData; }'
      + ' function aggregate(Call[] memory calls) public returns (bytes[] memory out){ out = new bytes[](calls.length);'
      + ' for (uint i = 0; i < calls.length; i++) { (bool s, bytes memory r) = calls[i].target.call(calls[i].callData);'
      + ' require(s); out[i] = r; } } }');
  });
  it('compiles the inlined struct-array opaque loop (calls param aliased through a returning helper)', () => {
    ok('contract C { struct Call { address target; bytes callData; } struct Result { bool success; bytes returnData; }'
      + ' function tryAggregate(bool rs, Call[] memory calls) public returns (Result[] memory out){'
      + ' out = new Result[](calls.length);'
      + ' for (uint i = 0; i < calls.length; i++) { (bool s, bytes memory r) = calls[i].target.call(calls[i].callData);'
      + ' if (rs) { require(s); } out[i] = Result(s, r); } }'
      + ' function tryBlockAndAggregate(bool rs, Call[] memory calls) public returns (uint bn, Result[] memory out){'
      + ' bn = block.number; out = tryAggregate(rs, calls); } }');
  });
});

describe('inlined helper with an interface-cast external-call target (clone .call/.expression aliasing)', () => {
  // A MethodCallStatementNode holds its call in both `.call` and (post-first-traversal) `.expression` as the SAME
  // object. cloneNode used to split them when inlining a helper body, so a later target hoist rewrote `.expression`
  // while SymbolTableTraversal re-derived from the stale `.call` - losing an `IFactory(factory).createPair()`
  // co-spend target ("must be a constructor/function parameter"). cloneNode now re-aliases them. Router02 _addLiquidity.
  it('resolves IFactory(factory).m() inside an inlined storage-pointer helper', () => {
    expect(() => compileString('pragma experimental ABIEncoderV2;'
      + ' interface IFactory { function getPair(address a, address b) external view returns (address);'
      + ' function createPair(address a, address b) external returns (address); }'
      + ' contract C { address factory; mapping(address => uint256) data;'
      + ' function _helper(mapping(address => uint256) storage d, address a, address b) internal {'
      + ' if (IFactory(factory).getPair(a, b) == address(0)) { IFactory(factory).createPair(a, b); } d[a] = 1; }'
      + ' function f(address a, address b) external { _helper(data, a, b); } }', { solidityImportCompat: true }))
      .not.toThrow();
  });
});

describe('Yul create2 deploy lowering (UniswapV2Factory createPair)', () => {
  // `bytes code = type(C).creationCode; assembly { pair := create2(0, add(code,0x20), mload(code), salt) }` lowers
  // to a native `new C{salt: salt}()` deploy (LowerInlineAssembly, pre-semantic), reusing the fully-plumbed deploy
  // covenant + SDK deployFrom. Only a create2 over a resolvable type(C).creationCode local qualifies; an unknown
  // runtime buffer stays unlowerable and fails closed with the clear "no BCH equivalent" diagnostic.
  const opts = { solidityImportCompat: true };
  it('lowers create2 over type(C).creationCode to new C{salt}()', () => {
    expect(() => compileString('pragma experimental ABIEncoderV2;'
      + ' contract Child { uint256 v; function setv(uint256 x) external { v = x; } }'
      + ' contract Factory { mapping(address => address) pairs;'
      + ' function make(address token, bytes32 salt) external returns (address pair) {'
      + ' bytes memory code = type(Child).creationCode;'
      + ' assembly { pair := create2(0, add(code, 0x20), mload(code), salt) } pairs[token] = pair; } }', opts))
      .not.toThrow();
  });
  it('lowers create2 over a runtime bytes-local to a salt-baked p2sh32 address (EIP-1167 clone factory)', () => {
    // Not a `type(C).creationCode` deploy: a create2 over an arbitrary bytes buffer (BentoBox `deploy`'s EIP-1167
    // clone) computes the p2sh32 of `<salt> OP_DROP || bytecode`, mirroring the `create` handler (whose whole-bytes
    // -local case already compiles) but salt-distinguished. The deployed EVM proxy has no functional BCH contract,
    // so a call on the address fails closed at runtime; the address computation itself compiles.
    expect(() => compileString('contract C { function f(bytes memory code, bytes32 salt) external returns (address p){'
      + ' assembly { p := create2(0, add(code, 0x20), mload(code), salt) } } }', opts))
      .not.toThrow();
  });
  it('fails closed on a create2 with a non-zero value (a funded deploy needs an output, not lowered here)', () => {
    expect(() => compileString('contract C { function f(bytes memory code, bytes32 salt) external returns (address p){'
      + ' assembly { p := create2(1, add(code, 0x20), mload(code), salt) } } }', opts))
      .toThrow(/create2.*no BCH equivalent/);
  });
});

describe('using-for external-call library method on an interface-typed struct FIELD (MasterChef pattern)', () => {
  // `Pool storage pool = poolInfo[pid]; pool.lpToken.safeTransfer(..)` (MasterChef deposit/withdraw): the receiver is
  // an interface-typed struct field. Rewrite pre-inlining via the receiver-type chain (poolInfo -> Pool -> lpToken =
  // IERC20 bound by `using SafeERC20 for IERC20`), so the external-call helper inlines and its target is self-pinned.
  const lib = 'interface IERC20 { function transfer(address to, uint256 v) external returns (bool);'
    + ' function balanceOf(address a) external view returns (uint256); }'
    + ' library SafeERC20 { function safeTransfer(IERC20 token, address to, uint256 v) internal {'
    + ' require(token.transfer(to, v), "f"); } }';
  const ok = (body: string): void => {
    expect(() => compileString(`pragma solidity ^0.8.0; ${lib} contract C { struct Pool { IERC20 lpToken; uint256 x; }`
      + ` Pool[] poolInfo; using SafeERC20 for IERC20; uint256 s; function f(uint256 pid, address to, uint256 v)`
      + ` public { Pool storage pool = poolInfo[pid]; ${body} } }`, { solidityImportCompat: true })).not.toThrow();
  };
  it('compiles safeTransfer on an interface-typed struct field', () => ok('pool.lpToken.safeTransfer(to, v);'));
  it('mixes a using-for external-call method and a genuine interface method on the same field', () => {
    ok('pool.lpToken.safeTransfer(to, v); s = pool.lpToken.balanceOf(address(this));');
  });
});

describe('bytes-pointer advance in assembly (OZ/BoringCrypto _getRevertMsg)', () => {
  // `assembly { _returnData := add(_returnData, 0x04) }` advances an EVM bytes-memory pointer past the 4-byte
  // Error(string) selector. On BCH bytes are values, so it lowers to the slice `_returnData[4:]` (VM-proven
  // byte-exact in solidcash RevertMsgSlice.test.ts). This unblocks BoringBatchable-derived contracts
  // (BentoBoxV1, MasterChefV2) at the _getRevertMsg wall.
  const opts = { solidityImportCompat: true };
  it('lowers add(bytesMemory, N) to a slice so _getRevertMsg compiles', () => {
    expect(() => compileString('pragma solidity ^0.8.0; contract C {'
      + ' function f(bytes memory _returnData) public pure returns (string memory) {'
      + ' if (_returnData.length < 68) return "silent";'
      + ' assembly { _returnData := add(_returnData, 0x04) }'
      + ' return abi.decode(_returnData, (string)); } }', opts)).not.toThrow();
  });
  it('leaves add(int, N) arithmetic untouched (only bytes vars slice)', () => {
    expect(() => compileString('pragma solidity ^0.8.0; contract C {'
      + ' function f(uint256 x) public pure returns (uint256 y) {'
      + ' assembly { y := add(x, 0x04) } } }', opts)).not.toThrow();
  });
});

describe('interface/contract-typed constant (BentoBoxV1 USE_ETHEREUM = IERC20(0))', () => {
  // `IERC20 constant U = IERC20(0)`: the parser emits a FunctionCall for the user-type cast (not a CastNode), and
  // an interface-named constant type must default to a tagged address handle. Both the const-init compile-time
  // check and the FunctionCall->address-cast fold recognize the interface, so the constant type-checks against an
  // address value (VM-proven usable in solidcash InterfaceConst.test.ts).
  const opts = { solidityImportCompat: true };
  const iface = 'interface IERC20 { function transfer(address to, uint256 v) external returns (bool); }';
  it('compiles a private interface-typed constant initialized with IERC20(0)', () => {
    expect(() => compileString(`pragma solidity ^0.8.0; ${iface} contract C {`
      + ' IERC20 private constant USE_ETHEREUM = IERC20(0);'
      + ' function f(IERC20 t) public view returns (bool) { return t == USE_ETHEREUM; } }', opts)).not.toThrow();
  });
  it('compiles a bare (no-visibility) interface-typed constant', () => {
    expect(() => compileString(`pragma solidity ^0.8.0; ${iface} contract C {`
      + ' IERC20 constant U = IERC20(0);'
      + ' function f(IERC20 t) public view returns (bool) { return t != U; } }', opts)).not.toThrow();
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

describe('library sibling constant inside an inlined low-level call (BoringERC20 SIG_TRANSFER_FROM)', () => {
  // A library's own `bytes4 private constant SIG` referenced unqualified inside a low-level-call helper
  // (`t.call(abi.encodeWithSelector(SIG, ..))`) is registered qualified (`L.SIG`). The helper is inlined into the
  // consumer before semantic analysis, losing the library context - so the ref must be qualified up front (mirrors
  // the sibling-call qualification). Direct use / encodeWithSelector-only already worked; the low-level call did not.
  const opts = { solidityImportCompat: true };
  const lib = 'library L { bytes4 private constant SIG = 0x23b872dd;'
    + ' function f(address t) internal returns (bytes memory) {'
    + ' (bool ok, bytes memory d) = t.call(abi.encodeWithSelector(SIG, t)); return d; } }';
  it('resolves a library sibling constant used in an inlined low-level call', () => {
    expect(() => compileString(`pragma solidity ^0.8.0; ${lib}`
      + ' contract C { function g(address t) public { L.f(t); } }', opts)).not.toThrow();
  });
  it('still resolves a param that shadows a sibling constant name', () => {
    const lib2 = 'library L { bytes4 private constant SIG = 0x23b872dd;'
      + ' function f(address t, bytes4 SIG) internal returns (bytes memory) {'
      + ' (bool ok, bytes memory d) = t.call(abi.encodeWithSelector(SIG, t)); return d; } }';
    expect(() => compileString(`pragma solidity ^0.8.0; ${lib2}`
      + ' contract C { function g(address t) public { L.f(t, 0x11223344); } }', opts)).not.toThrow();
  });
});

describe('MasterChefV2 semantic walls (struct scoping + using-for receiver resolution)', () => {
  const opts = { solidityImportCompat: true };
  it('a contract struct shadows a same-named interface struct (distinct contract-scoped types)', () => {
    // IMasterChef.UserInfo{uint256 rewardDebt} vs MasterChefV2.UserInfo{int256 rewardDebt} - distinct types that
    // must not collide in the global structMap. The contract's wins the bare name; the interface's stays qualified.
    expect(() => compileString('pragma solidity ^0.8.0;'
      + ' interface IMC { struct UserInfo { uint256 amount; uint256 rewardDebt; } function d(uint256 p) external; }'
      + ' contract C { struct UserInfo { uint256 amount; int256 rewardDebt; }'
      + ' mapping(uint256 => UserInfo) userInfo;'
      + ' function f(uint256 p) public view returns (int256) { return userInfo[p].rewardDebt; } }', opts)).not.toThrow();
  });
  const bm = 'library BoringMath { function sub(uint256 a, uint256 b) internal pure returns (uint256) { return a - b; } }';
  it('using-for method binds on an array .length receiver (lpToken.length.sub(1))', () => {
    expect(() => compileString(`pragma solidity ^0.8.0; ${bm} contract C { using BoringMath for uint256;`
      + ' address[] lpToken;'
      + ' function f() public view returns (uint256) { return lpToken.length.sub(1); } }', opts)).not.toThrow();
  });
  it('using-for method binds on block.number via the integer-width fallback (block.number.sub(x))', () => {
    // block.number is modeled uint32 (block oracle) but the BoringMath binding is uint256 - the widening is safe.
    expect(() => compileString(`pragma solidity ^0.8.0; ${bm} contract C { using BoringMath for uint256;`
      + ' function f(uint256 x) public view returns (uint256) { return block.number.sub(x); } }', opts)).not.toThrow();
  });
});

describe('loop-body vars are not single-assign (Router02 per-iteration computed target)', () => {
  // A var declared / tuple-bound inside a loop re-runs each iteration (position-dependent). It must NOT be treated
  // as a single-assign local, or a computed external-call target `IFoo(pairFor(.., path[i], ..))` would resolve
  // path[i] to a fixed index and hoist outside the loop (a wrong co-spend). SEAL correctly does NOT mis-hoist such
  // a per-iteration target; the collect phase instead rewrites it to read a synthesized `__internal__loopTargets<n>`
  // address[] witness param (the SDK fills it with the co-spend targets for the route) and reuses the typed inline
  // loop dispatch (identity co-spend + preservation). A NON-loop computed target (single-assign leaves) still hoists.
  const opts = { solidityImportCompat: true };
  const iface = 'interface IFoo { function m(uint256 x) external; }';
  const lib = 'library L { function at(address f, address a) internal pure returns (address) {'
    + ' return address(uint160(uint256(uint160(f)) + uint256(uint160(a)))); } }';
  it('a NON-loop computed external-call target still compiles (single-assign leaves unaffected)', () => {
    expect(() => compileString(`pragma solidity ^0.8.0; ${iface} ${lib} contract C { address factory;`
      + ' function f(address t) public { address a = t; IFoo(L.at(factory, a)).m(5); } }', opts)).not.toThrow();
  });
  it('a per-iteration computed external-call target compiles via a synthesized loopTargets witness param', () => {
    const art = compileString(`pragma solidity ^0.8.0; ${iface} ${lib} contract C { address factory;`
      + ' function f(address[] memory path) public { for (uint i; i < path.length; i++) {'
      + ' IFoo(L.at(factory, path[i])).m(5); } } }', opts);
    const fn = art.abi.find((a) => a.name === 'f');
    expect(fn?.inputs.some((inp) => inp.name.startsWith('__internal__loopTargets'))).toBe(true);
  });
});

describe('typed per-iteration external dispatch over a param array (IFoo(targets[i]).m(..))', () => {
  // Extends the opaque inline-loop dispatch (Multicall2 `targets[i].call(data[i])`) to a TYPED void call: same
  // per-iteration identity co-spend + preservation, no opaque return-event. VM-proven (co-spend validates and a
  // mismatching target claim is rejected) in solidcash TypedLoopDispatch.test.ts. This is the codegen Router02's
  // swap loop reuses once its computed pairFor target is rewritten to a witness array element.
  it('compiles a typed void call over a calldata/param address array in a loop', () => {
    expect(() => compileString('pragma solidcash >=0.8.0;'
      + ' contract C() { function run(address[] targets, int x) {'
      + ' for (uint i = 0; i < targets.length; i++) { IFoo(targets[i]).m(x); } } }'
      + ' interface IFoo { function m(int x) external; }')).not.toThrow();
  });
});

describe('ecrecover(hash, v, r, s) alias maps to a recovery projection under the ecrecover option', () => {
  // Solidity's 4-arg `ecrecover` has no bare-name SolidCash builtin; the `ecrecover` compat option aliases it to a
  // real recovery projection so ports (OZ ECDSA.tryRecover) cross-compile. Byte-identical to writing the projection
  // directly, so it inherits the VM-proven ecrecoverP2pkh/Evm correctness (solidcash EcrecoverRecovery.test.ts).
  const bc = (src: string, opt: object): string =>
    compileString(src, { solidityImportCompat: true, ...opt }).bytecode;
  const mkAddr = (fn: string): string => 'contract C { function f(bytes32 h, uint8 v, bytes32 r, bytes32 s) public {'
    + ` address a = ${fn}(h, v, r, s); require(a == a); } }`;
  const mkB20 = (fn: string): string => 'contract C { function f(bytes32 h, uint8 v, bytes32 r, bytes32 s) public {'
    + ` bytes20 a = ${fn}(h, v, r, s); require(a == a); } }`;
  it("ecrecover:'p2pkh' is byte-identical to ecrecoverP2pkh (native BCH signer address)", () => {
    expect(bc(mkAddr('ecrecover'), { ecrecover: 'p2pkh' })).toBe(bc(mkAddr('ecrecoverP2pkh'), {}));
  });
  it("ecrecover:'evm' is byte-identical to ecrecoverEvm (20-byte keccak address)", () => {
    expect(bc(mkB20('ecrecover'), { ecrecover: 'evm' })).toBe(bc(mkB20('ecrecoverEvm'), {}));
  });
  it("solidityImportCompat defaults ecrecover to the exact EVM projection", () => {
    expect(bc(mkB20('ecrecover'), {})).toBe(bc(mkB20('ecrecover'), { ecrecover: 'evm' }));
  });
  it('native mode keeps bare ecrecover undefined without an explicit projection', () => {
    expect(() => compileString(mkAddr('ecrecover'))).toThrow(/Undefined reference to symbol ecrecover/);
  });
});

describe('a loop over a compile-time-empty new-array is eliminated (post-inline dead loop)', () => {
  // `_updateJobWhitelist(id, allowed, new address[](0))` (EACC Marketplace publishJobPost): after inlining, the
  // `disallowed` loop iterates over `new address[](0)` = 0 times. A second UnrollFixedBoundEntryLoop pass (post-
  // inline) folds the constant bound and drops the dead loop, so its C2 sorted-mapping write never reaches codegen
  // (was: SortedMappingCodegenPendingError 'whitelistWorkers'). Sound: the body provably never runs.
  const ok = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('compiles an internal C2 mapping-write loop called with new T[](0)', () => {
    expect(ok('contract C { mapping(uint256 => mapping(address => bool)) w;'
      + ' function upd(uint256 id, address[] memory a, address[] memory d) internal {'
      + ' for (uint256 i = 0; i < a.length; i++) { w[id][a[i]] = true; }'
      + ' for (uint256 i = 0; i < d.length; i++) { w[id][d[i]] = false; } }'
      + ' function pub(uint256 id, address[] memory a) public { upd(id, a, new address[](0)); require(true); }'
      + ' function pub2(uint256 id, address[] memory d) public { upd(id, new address[](0), d); require(true); } }'))
      .toBe('C');
  });
  it('does NOT fold a loop over a PUSHED new-array (soundness: length changed, fail-closed not dropped)', () => {
    // `a.push(..)` changes the length, so `new address[](0)` is no longer provably empty (mutatedNames excludes a).
    // The loop must NOT be dropped - it stays and fails closed on the still-unsupported dynamic C2 write. Proves
    // the length fold never silently removes a loop whose array could be non-empty. (An element write `a[i]=v`
    // keeps the length, so it stays foldable - covered by the EACC `new address[](1); a[0]=w;` path above.)
    expect(() => compileString('contract C { mapping(address => bool) w;'
      + ' function f() public { address[] memory a = new address[](0); a.push(address(0));'
      + ' for (uint256 i = 0; i < a.length; i++) { w[a[i]] = true; } require(true); } }',
    { solidityImportCompat: true })).toThrow(/C2 linked-list transition generator|only available.*storage/);
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

describe('RETURNING storage-pointer library fn on a mapping element (BentoBox addElastic, stmt + expr position)', () => {
  // A struct-storage-pointer fn that RETURNS a value AND mutates the pointer (BoringRebase `addElastic(Rebase
  // storage,..) returns(uint)`). InlineReturningStateHelpers now read-modify-writes the element inside its hoisting
  // machinery, so the mutation persists AND the return value is captured - in statement position (discarded) and
  // expression position (return used). Was: "Undefined reference to symbol <param>" (grabbed by the read-oriented
  // eligibleStructPtr inline that left the write's param dangling).
  const ok = (src: string): string => compileString(src, { solidityImportCompat: true, forceStateful: true }).contractName;
  const LIB = 'struct T { int base; int elastic; }'
    + ' library L { function addElastic(T storage t, int e) returns (int newElastic) { newElastic = t.elastic = t.elastic + e; } }';
  it('statement position: L.addElastic(this.m[k], e) - return discarded', () => {
    expect(ok(`${LIB} contract C() { mapping(int => T) m;`
      + ' function f(int k, int e) { L.addElastic(this.m[k], e); require(true); } }')).toBe('C');
  });
  it('expression position: this.last = L.addElastic(this.m[k], e) - return assigned', () => {
    expect(ok(`${LIB} contract C() { mapping(int => T) m; int last;`
      + ' function f(int k, int e) { this.last = L.addElastic(this.m[k], e); require(true); } }')).toBe('C');
  });
  it('expression position in a require comparison (BentoBox shape): require(max >= addElastic(..))', () => {
    expect(ok(`${LIB} contract C() { mapping(int => T) m;`
      + ' function f(int k, int e, int max) { require(max >= L.addElastic(this.m[k], e)); } }')).toBe('C');
  });
  it('using-for method spelling this.m[k].addElastic(e), both positions', () => {
    expect(ok(`${LIB} contract C() { using L for T; mapping(int => T) m; int last;`
      + ' function f(int k, int e) { this.m[k].addElastic(e); this.last = this.m[k].addElastic(e); require(true); } }')).toBe('C');
  });
});

describe('BARE mapping access (no this.) as a storage-pointer arg - real-Solidity spelling', () => {
  // Solidity code without `this.` writes `totals[k].addElastic(x)` / `L.f(totals[k], x)`; the bare `totals[k]`
  // parses as an array-access on the mapping-name identifier, not a MappingAccessNode, so the inline RMW must
  // normalize it to a mapping access (else "Undefined state variable 'totals'"). Both the void and returning passes.
  const ok = (src: string): string => compileString(src, { solidityImportCompat: true, forceStateful: true }).contractName;
  const VOID = 'struct T { int base; int elastic; }'
    + ' library L { function addBase(T storage t, int x) { t.base += x; } }';
  const RET = 'struct T { int base; int elastic; }'
    + ' library L { function addElastic(T storage t, int e) returns (int c) { c = t.elastic = t.elastic + e; } }';
  it('void bare L.addBase(totals[k], x)', () => {
    expect(ok(`${VOID} contract C() { mapping(int => T) totals;`
      + ' function f(int k, int x) { L.addBase(totals[k], x); require(true); } }')).toBe('C');
  });
  it('void bare using-for totals[k].addBase(x)', () => {
    expect(ok(`${VOID} contract C() { using L for T; mapping(int => T) totals;`
      + ' function f(int k, int x) { totals[k].addBase(x); require(true); } }')).toBe('C');
  });
  it('returning bare totals[k].addElastic(e), statement + expression (public mapping)', () => {
    expect(ok(`${RET} contract C() { using L for T; mapping(int => T) public totals; int last;`
      + ' function f(int k, int e, int max) { totals[k].addElastic(e); last = L.addElastic(totals[k], e); require(max >= totals[k].addElastic(e)); } }'))
      .toBe('C');
  });
});

describe('abi.decode to an interface/contract type (BentoBox/Kashi)', () => {
  // `abi.decode(data, (IERC20))` - an interface/contract handle is an address on BCH, so it decodes as address
  // (byte-identical to `abi.decode(data, (address))`). Was: "Unsupported type 'IERC20' in abi.decode".
  const bc = (src: string): string => compileString(src, { solidityImportCompat: true, forceStateful: true }).bytecode;
  it('decodes an interface type identically to address (sound by reduction)', () => {
    const iface = 'interface IERC20 { function x() external; } contract C() { address o;'
      + ' function f(bytes memory d, pubkey pk, sig s) { require(checkSig(s, pk));'
      + ' (IERC20 t, uint256 n) = abi.decode(d, (IERC20, uint256)); o = address(t); require(n == n); } }';
    const addr = 'contract C() { address o;'
      + ' function f(bytes memory d, pubkey pk, sig s) { require(checkSig(s, pk));'
      + ' (address t, uint256 n) = abi.decode(d, (address, uint256)); o = t; require(n == n); } }';
    expect(bc(iface)).toBe(bc(addr));
  });
  it('still resolves a registered struct type as a struct (not defaulted to address)', () => {
    expect(compileString('struct P { int a; int b; } contract C() {'
      + ' function f(bytes memory d, pubkey pk, sig s) {'
      + ' require(checkSig(s, pk)); P p = abi.decode(d, (P)); require(p.a == p.a); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('overloaded returning-helper inline disambiguated by return arity (Kashi RebaseLibrary.add)', () => {
  // Two same-arity overloads differing by return count (`add(R,x,bool) returns (R,base)` vs `add(R,x,base) returns R`).
  // A using-for method call in the bodies marks them for inline; the ambiguous inline is disambiguated by RETURN
  // ARITY at the call site (a 1-value assign -> the 1-return overload, a tuple -> the K-return one) rather than
  // failing "Cannot inline call ... multiple N-argument overloads". Advances KashiPairMediumRiskV1 past this wall.
  const ok = (src: string): string => compileString(src, { solidityImportCompat: true, forceStateful: true }).contractName;
  const LIB = 'struct R { int e; int b; }'
    + ' library M { function id(int a) internal pure returns (int) { return a; } }'
    + ' library L { using M for int;'
    + ' function add(R memory total, int x, bool up) internal pure returns (R memory, int base) {'
    + ' base = up ? x.id()+1 : x.id(); total.e = total.e+x; total.b = total.b+base; return (total, base); }'
    + ' function add(R memory total, int x, int base) internal pure returns (R memory) {'
    + ' total.e = total.e+x.id(); total.b = total.b+base; return total; } }';
  it('compiles both call contexts (1-value assign and tuple destructure) of the ambiguous overload', () => {
    expect(ok(`${LIB} contract C() { using L for R; R rr;`
      + ' function one(int x, int b) { R t = R(0,0); t = t.add(x, b); this.rr = t; require(true); }'
      + ' function two(int x) { R t = R(0,0); int bb; (t, bb) = t.add(x, true); this.rr = t; require(bb >= 0); } }')).toBe('C');
  });
});

describe('writable bytes view of a storage string', () => {
  it('supports push and indexed writes through bytes(s)', () => {
    expect(compileString('contract C { string x; function f() public {'
      + ' bytes(x).push(0); bytes(x)[0] = bytes1(uint8(1)); require(true); } }',
    { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });
});

describe('field writes through a storage-reference-returning call', () => {
  it('supports a plain internal helper call as the lvalue base', () => {
    expect(compileString('contract C { struct S { uint x; } mapping(uint => S) m;'
      + ' function ref(uint k) internal view returns (S storage r) { return m[k]; }'
      + ' function f(uint k, uint v) public { ref(k).x = v; require(true); } }',
    { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });
});

describe('prefix mutation of a no-argument push result', () => {
  it('reduces ++a.push() to pushing default(T) + 1', () => {
    const compat = { solidityImportCompat: true, forceStateful: true };
    const prefixed = compileString('contract C { uint[] a; function f() public { ++a.push(); require(true); } }', compat);
    const reduced = compileString('contract C { uint[] a; function f() public { a.push(uint(1)); require(true); } }', compat);
    expect(prefixed.bytecode).toBe(reduced.bytecode);
  });

  it('applies the same reduction through an indexed struct-array field', () => {
    expect(compileString(
      'contract C { struct S { int[][] d; } S[] data; constructor() {'
      + ' data.push(); data.push(); data[1].d.push(); data[1].d.push();'
      + ' data[1].d.push(); data[1].d.push(); }'
      + ' function f() public { ++data[1].d[3].push(); } }',
      { solidityImportCompat: true, forceStateful: true },
    ).contractName).toBe('C');
  });
});

describe('indexed write through a parenthesized mapping-storage rebind', () => {
  it('reduces (p = other)[k] = v to rebind followed by indexed write', () => {
    const head = 'contract C { mapping(uint => uint) a; mapping(uint => uint) b;'
      + ' function f(uint k, uint v) public { mapping(uint => uint) storage p = a;';
    const tail = ' require(true); } }';
    const compat = { solidityImportCompat: true, forceStateful: true };
    const combined = compileString(`${head} (p = b)[k] = v;${tail}`, compat);
    const sequential = compileString(`${head} p = b; p[k] = v;${tail}`, compat);
    expect(combined.bytecode).toBe(sequential.bytecode);
  });
});

describe('push through a simple storage-return alias helper', () => {
  it('mutates the direct bytes state target returned by a zero-arg helper', () => {
    expect(compileString('contract C { bytes data;'
      + ' function getData() internal view returns (bytes storage) { return data; }'
      + ' function f() public { getData().push("a"); require(true); } }',
    { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });

  it('preserves a push-only helper prelude before pushing through its returned array element', () => {
    expect(compileString('contract C { int[][] values;'
      + ' function slot() internal returns (int[] storage) {'
      + ' values.push(); values.push(); values.push(); return values[2]; }'
      + ' function f() public { slot().push(); require(values[2].length > 0); } }',
    { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });
});

describe('prefix mutation of a local struct field expression', () => {
  it('rebuilds the struct when the field is incremented in a for-loop update', () => {
    expect(compileString(
      'contract C { struct S { uint x; uint y; }'
      + ' function f() public { S memory s = S(0, 7);'
      + ' for (uint i = 0; i < 3; ++s.x) { i = i + 1; } require(s.y == 7); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('indexed aggregate fields in local struct arrays', () => {
  it('writes fixed-array and bytes fields through an indexed struct element', () => {
    expect(compileString('contract C { struct S { uint[2] a; bytes b; }'
      + ' function f() public returns (uint, bytes1) { S[] memory z = new S[](2);'
      + ' z[1].a[0] = 4; z[1].b = new bytes(2); z[1].b[1] = "B";'
      + ' return (z[1].a[0], z[1].b[1]); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('rebuilds a struct array nested inside a local struct, including an indexed array field', () => {
    expect(compileString('contract C { struct T { uint y; uint[] a; }'
      + ' struct S { uint x; T[] rows; } function f() public pure returns (uint, uint) {'
      + ' S memory s; s.rows = new T[](2); s.rows[0].y = 5;'
      + ' s.rows[1].a = new uint[](2); s.rows[1].a[1] = 6;'
      + ' return (s.rows[0].y, s.rows[1].a[1]); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('writes a nested dynamic-array field through a state struct-array element', () => {
    expect(compileString('contract C { struct S { uint[][] rows; } S[] data;'
      + ' function f() public { while (data.length < 1) data.push();'
      + ' while (data[0].rows.length < 1) data[0].rows.push();'
      + ' while (data[0].rows[0].length < 1) data[0].rows[0].push();'
      + ' data[0].rows[0][0] = 8; require(data[0].rows[0][0] == 8); } }',
    { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });

  it('rebuilds a struct selected through multiple state-array dimensions', () => {
    expect(compileString('contract C { struct T { uint x; uint y; uint[] z; } T[2][] rows;'
      + ' function f() public { rows.push(); rows[0][1].x = 11; rows[0][1].y = 12;'
      + ' rows[0][1].z.push(1); require(rows[0][1].x == 11); } }',
    { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });
});

describe('mixed integer and fixed-point arithmetic', () => {
  it('promotes a typed integer operand to the fixed-point scale', () => {
    expect(compileString('contract C { function f(uint64 x) public pure returns (ufixed128x18) {'
      + ' return x + ufixed128x18(2); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('nested struct fields in mapping values', () => {
  it('rebuilds the top-level field while retaining the mapping key', () => {
    expect(compileString('contract C { struct N { uint x; uint y; } struct S { uint a; N n; }'
      + ' mapping(uint => S) data; function f(uint k) public {'
      + ' data[k].n.x = 3; data[k].n.y = 4; require(data[k].n.x == 3); } }',
    { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });
});

describe('dynamic state-array copies with wider fixed rows', () => {
  it('copies shared elements and zero-fills the wider destination row', () => {
    expect(compileString('contract C { uint[4][] rows; function f(uint[2][] memory src) public {'
      + ' rows = src; require(rows.length == src.length); } }',
    { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });

  it('copies a shorter fixed local outer array and zero-fills state-array tail rows', () => {
    expect(compileString('contract C { uint[2][3] rows; function f() public {'
      + ' uint[2][2] memory src; src[0][0] = 1; rows = src; require(rows[2][0] == 0); } }',
    { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });

  it('recursively widens nested fixed rows and zero-fills both dimensions', () => {
    expect(compileString('contract C { uint120[6][3] dst; uint48[5][2] src; function f() public {'
      + ' src[0][1] = 7; dst = src; require(dst[0][1] == 7 && dst[2][0] == 0); } }',
    { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });

  it('widens every element when pushing a dynamic state array into a nested dynamic array', () => {
    expect(compileString('contract C { bytes16[] inner; bytes32[][] data; function f() public {'
      + ' data.push(inner); require(data.length > 0); } }',
    { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });

});

describe('narrow integer arrays in the Yul memory model', () => {
  it('uses full EVM words and narrows dirty uint8 words on high-level reads', () => {
    expect(compileString('contract C { function f() public pure returns (uint8) {'
      + ' uint8[] memory a = new uint8[](1); assembly { mstore(add(a, 32), 258) } return a[0]; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('unwraps and rewraps integer-backed UDVT array words', () => {
    expect(compileString('type Tiny is uint8; contract C { function f(Tiny v) public pure returns (Tiny) {'
      + ' Tiny[] memory a = new Tiny[](1); a[0] = v; assembly { mstore(add(a, 32), 258) } return a[0]; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('resets a deleted memory-array pointer to the Yul null pointer', () => {
    expect(compileString('contract C { function f() public pure returns (uint r) {'
      + ' uint[] memory a = new uint[](1); delete a; assembly { r := mload(a) } } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('materializes an inline array allocation from a memory-struct rebuild', () => {
    expect(compileString('contract C { struct S { uint8[] a; } function f() public pure returns (uint8) {'
      + ' S memory s; s.a = new uint8[](1); assembly { mstore(add(s, 64), 257) } return s.a[0]; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('materializes independently decoded dynamic arrays as Yul pointers', () => {
    expect(compileString('contract C { function f(bytes memory b) public view returns (bool same, bool atOffset) {'
      + ' (uint256[] memory a, uint256[] memory c) = abi.decode(b, (uint256[], uint256[]));'
      + ' assembly { same := eq(a, c) atOffset := eq(a, add(b, 0x60)) } } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('nested library helpers that perform external calls', () => {
  const iface = 'interface I { function ping() external; }';
  const consumer = ' contract C { function run(I target) public { L.outer(target); require(true); } }';

  it('inlines a same-library external-call helper in the retained wrapper body', () => {
    expect(compileString(iface
      + ' library L { function inner(I t) internal { t.ping(); }'
      + ' function outer(I t) internal { inner(t); } }'
      + consumer, { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('inlines a cross-library external-call helper in the retained wrapper body', () => {
    expect(compileString(iface
      + ' library M { function inner(I t) internal { t.ping(); } }'
      + ' library L { function outer(I t) internal { M.inner(t); } }'
      + consumer, { solidityImportCompat: true }).contractName).toBe('C');
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

describe('discarded elementary-type expressions', () => {
  it('accepts bounded integer type names as no-effect statements', () => {
    expect(compileString('contract C { function f() public returns (uint256 r) {'
      + ' uint256; uint256; int256 x = -7; return uint256(x); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('rebuilds nested struct and aggregate members through a local struct-array element', () => {
    expect(compileString('contract C { struct T { uint y; uint[] a; }'
      + ' struct S { uint x; T t; T[] ts; } function f() public pure returns (uint, uint) {'
      + ' S[] memory s = new S[](2); s[0].t.y = 3; s[1].ts = new T[](2);'
      + ' s[1].ts[0].y = 5; s[1].ts[1].a = new uint[](2); s[1].ts[1].a[1] = 6;'
      + ' return (s[0].t.y, s[1].ts[1].a[1]); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('retains an otherwise unread local struct array through nested writes', () => {
    expect(compileString('contract C { struct T { uint y; uint[] a; }'
      + ' struct S { uint x; T t; T[] ts; } function f() public pure {'
      + ' S[] memory s = new S[](2); s[0].t.y = 3; s[1].ts = new T[](2);'
      + ' s[1].ts[0].y = 5; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('parenthesized using-for calls with named arguments', () => {
  it('unwraps (receiver.method)({name: value}) like the direct method-call form', () => {
    expect(compileString('library D { struct S { uint a; }'
      + ' function mul(S storage self, uint x) public returns (uint) { return self.a *= x; } }'
      + ' contract C { using D for D.S; D.S public x;'
      + ' function f(uint a) public returns (uint) { x.a = 6; return (x.mul)({x: a}); } }',
    { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });
});

describe('discarded contract-creation options', () => {
  it('accepts new C{salt/value: ...} without an invocation argument list', () => {
    expect(compileString('contract D { constructor() payable {} } contract C {'
      + ' function f() pure internal { new D{salt: "abc", value: 3}; new D{salt: "abc"};'
      + ' new D{value: 5 + 5}; } }', { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('parenthesized array-member invocation', () => {
  it('lowers (data.pop)() like data.pop()', () => {
    expect(compileString('contract C { int[] data; function f() public returns (uint) {'
      + ' data.push(1); (data.pop)(); return data.length; } }',
    { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });
});

describe('call options on function-pointer identifiers', () => {
  it('retains gas options while lowering a state external-function pointer call', () => {
    expect(compileString('contract C { function(uint) external returns (uint) x;'
      + ' function f() public { x{gas: 2}(1); } }',
    { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });

  it('rejects value options on a non-payable external-function pointer', () => {
    expect(() => compileString('contract C { function(uint) external returns (uint) x;'
      + ' function f() public { x{value: 2}(1); } }',
    { solidityImportCompat: true, forceStateful: true })).toThrow(/value.*non-payable function type/i);
  });

  it('retains value options while lowering a payable external-function pointer call', () => {
    expect(compileString('contract C { function(uint) external payable returns (uint) x;'
      + ' function f() public { x{value: 2}(1); } }',
    { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });
});

describe('Solidity function-type mutability conversions', () => {
  const declaration = (actual: string, expected: string): string =>
    `contract C { function h() ${actual === 'nonpayable' ? '' : actual} external {}`
    + ` function f() external view returns (bytes4) {`
    + ` function() ${expected === 'nonpayable' ? '' : expected} external g = this.h; return g.selector; } }`;

  it.each([
    ['nonpayable', 'payable'], ['nonpayable', 'pure'], ['nonpayable', 'view'],
    ['payable', 'pure'], ['payable', 'view'], ['pure', 'payable'],
    ['view', 'payable'], ['view', 'pure'],
  ])('rejects %s -> %s', (actual, expected) => {
    expect(() => compileString(declaration(actual, expected), {
      solidityImportCompat: true,
    })).toThrow();
  });

  it.each([
    ['pure', 'view'], ['pure', 'nonpayable'], ['view', 'nonpayable'], ['payable', 'nonpayable'],
  ])('retains %s -> %s', (actual, expected) => {
    expect(compileString(declaration(actual, expected), {
      solidityImportCompat: true,
    }).contractName).toBe('C');
  });
});

describe('empty abi.decode schema', () => {
  it('accepts abi.decode(data, ()) as an empty tuple expression', () => {
    expect(compileString('contract C { function f() public pure { abi.decode("abc", ()); } }',
      { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('unitary tuple parentheses in abi.decode schemas', () => {
  it('normalizes nested unitary parentheses around scalar and array element types', () => {
    expect(compileString('struct S { int a; } contract C { function f() pure public {'
      + ' abi.decode("", (((uint)))); abi.decode("", ((((S)))));'
      + ' abi.decode("", ((uint)[2])); abi.decode("", (((uint))[5][6])); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('contextual value member method calls', () => {
  it('allows a using-for library method named value', () => {
    expect(compileString('library L { function value(function() internal a, uint256 b) internal {} }'
      + ' contract C { using L for function() internal; function f() public {'
      + ' function() internal x; x.value(42); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('function-reference members after call options', () => {
  it('accepts a discarded .address member after value options', () => {
    expect(compileString('contract C { function f(address) payable external returns (bool) {'
      + ' this.f{value: 42}.address; } }', { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('rejects non-function-value members after call options', () => {
    expect(() => compileString('contract C { function f() external { this.f{gas: 1}.nope; } }',
      { solidityImportCompat: true })).toThrow(/no member 'nope'/);
  });
});

describe('empty tuple ternary expressions', () => {
  it('evaluates the condition and accepts discarded tuple values plus returned empty tuples', () => {
    expect(compileString('contract C { function f(bool b) public pure {'
      + ' b ? () : (); b ? (1, 2) : (3, 4); return b ? () : (); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('parenthesized delete targets', () => {
  it('deletes local identifiers through redundant parentheses', () => {
    expect(compileString('contract C { function f(bool b) public pure {'
      + ' delete(b); delete((((b)))); } }', { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('evaluates and discards deletion of a temporary array element', () => {
    expect(compileString('contract C { function f() public pure { delete ([""][0]); } }',
      { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('contextual-keyword function calls', () => {
  it('calls a free function named unsafe', () => {
    expect(compileString('function unsafe() pure returns (uint256 x) { assembly { x := 42 } }'
      + ' contract C { constructor() { unsafe(); } function f() public pure { unsafe(); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('discarded tuple expressions with builtin references', () => {
  it('accepts and discards (abi.encode, value)', () => {
    expect(compileString('contract C { function f() pure { (abi.encode, ""); } }',
      { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('chained indirect function calls', () => {
  it('compiles x()()()() through nested internal function-pointer returns', () => {
    expect(compileString('contract C { function f0() public returns (uint) { return 2; }'
      + ' function f1() internal returns (function() internal returns (uint)) { return f0; }'
      + ' function f2() internal returns (function() internal returns (function() internal returns (uint))) { return f1; }'
      + ' function f3() internal returns (function() internal returns (function() internal returns (function() internal returns (uint)))) { return f2; }'
      + ' function f() public returns (uint) {'
      + ' function() internal returns(function() internal returns(function() internal returns(function() internal returns(uint)))) x;'
      + ' x = f3; return x()()()(); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('nested tuple assignment targets', () => {
  it('flattens nested targets and preserves omitted slots', () => {
    expect(compileString('contract C { function f() public pure returns (uint) {'
      + ' uint a; ((, a)) = (1, 2); return a; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('accepts redundant wrappers around nested tuple targets and values', () => {
    expect(compileString('contract C { function f() public pure returns (uint) {'
      + ' uint a; (((, a),)) = ((1, 2), 3);'
      + ' ((,, a)) = ((((((1, 3, (((((2))))))))))); return a; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('recognizes a nested target after a plain first slot', () => {
    expect(compileString('contract C { function f() public pure returns (bytes memory) {'
      + ' bytes a; bytes b; bytes c;'
      + ' (a, (b, c)) = ("0", ("1", "2")); return bytes.concat(a, b, c); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('accepts completely omitted nested targets', () => {
    expect(compileString('contract C { function f() public pure {'
      + ' ((, ), ) = ((7, 8), 9); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('expands a skipped outer target across every nested RHS leaf', () => {
    expect(compileString('contract C { function f() public pure returns (uint) {'
      + ' uint a; (a,) = (4, (8, 16, 32)); return a; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('parenthesized discarded tuple expressions', () => {
  it('evaluates and discards tuple components through redundant wrappers', () => {
    expect(compileString('contract C { function f() public pure { (("", 2)); (("", "")); } }',
      { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('parenthesized explicit tuple assignment values', () => {
  it('destructures a tuple RHS through redundant wrappers', () => {
    expect(compileString('contract C { function f() public pure returns (uint) {'
      + ' uint a; (,, a) = ((((((1, 3, (((((2))))))))))); return a; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('contextual overloaded internal function references', () => {
  it('selects the overload matching the destination function-pointer type', () => {
    expect(compileString('contract C { function i() internal pure {}'
      + ' function g(function() internal pure x) internal view { x = i; }'
      + ' function g(function() external pure x) external view {'
      + ' function(function() internal pure) internal view y; y = g; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('ignores synthetic return-routing parameters when matching a public function', () => {
    expect(compileString('contract C { function x() public returns (uint) { return 1; }'
      + ' function y() public returns (uint) { return 2; }'
      + ' function f(bool c) public returns (uint) {'
      + ' function() returns (uint) z = c ? x : y; return z(); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('function-pointer parameters shadow contract functions', () => {
  it('dispatches the lexical pointer when a contract method has the same name', () => {
    expect(compileString('contract C { function(uint) returns (uint) p; function g() public pure {}'
      + ' function f(function(uint) returns (uint) g) internal returns (uint) { return g(2); }'
      + ' function run() public returns (uint) { return f(p); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('three-level chained array push', () => {
  it('appends defaults through every array level', () => {
    expect(compileString('contract C { uint[][][] data; function f() public {'
      + ' data.push().push().push(); require(data.length == 1); } }',
    { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });

  it('assigns the element returned by the final push', () => {
    expect(compileString('contract C { uint[][][] data; function f() public {'
      + ' data.push().push().push() = 2; require(data[0][0][0] == 2); } }',
    { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });
});

describe('push-return assignment on bytes[]', () => {
  it('folds the fresh inner bytes mutation into the outer append', () => {
    const compile = (body: string): string => compileString(
      `contract C { bytes[] data; function f(bytes1 v) public { ${body}
       require(data.length == 1 && data[0].length == 1 && data[0][0] == v); } }`,
      { solidityImportCompat: true },
    ).bytecode;
    expect(compile('data.push().push() = v;')).toBe(compile('data.push(bytes(v));'));
  });

  it('indexes the fresh bytes element with a dynamic expression', () => {
    expect(compileString(
      `contract C { bytes[] data; function f(bytes1 v) public { data.push().push() = v;
       uint i = data.length - 1; uint j = data[i].length - 1;
       require(data[i][j] == v); } }`,
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('compound assignment to a pushed element', () => {
  it('applies the operator to the appended element default', () => {
    expect(compileString('contract C { int[] data; function f() public {'
      + ' data.push() -= 1; require(data[0] == -1); } }',
    { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });
});

describe('explicit array conversion', () => {
  it('converts a calldata array slice to the same dynamic array type', () => {
    expect(compileString('contract C { function f(uint256[] calldata x, uint256 s, uint256 e)'
      + ' external returns (uint256) { return uint256[](x[s:e]).length; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('function-reference members after call options in expressions', () => {
  it('reads address and selector after validating gas/value options', () => {
    expect(compileString('contract C { function g() external payable {}'
      + ' function f() external returns (bool) { return this.g{gas: 42}.address == this.g.address'
      + ' && this.g{value: 1}.selector == this.g.selector; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('chained method-return function calls', () => {
  it('invokes an external function pointer returned by a self method', () => {
    expect(compileString('contract C { function f(uint256 x) public pure returns (uint256) { return 2*x; }'
      + ' function g() public view returns (function(uint256) external returns (uint256)) { return this.f; }'
      + ' function h(uint256 x) public returns (uint256) { return this.g()(x) + 1; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('delete through nested mapping-struct paths', () => {
  it('flattens interleaved keys and members to the nested collection', () => {
    expect(compileString('struct D { mapping(uint256 => uint256) supply; }'
      + ' struct P { mapping(uint256 => D) data; } contract C { mapping(address => P) providers;'
      + ' function f(address sender, uint256 height, uint256 round) public {'
      + ' delete providers[sender].data[height].supply[round]; require(true); } }',
    { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });
});

describe('experimental standard-library imports', () => {
  it('accepts direct, aliased, and namespace std.module imports as compiler-provided no-ops', () => {
    for (const directive of [
        'import std.stub;',
        'import std.stub as stub;',
        'import * as stub from std.stub;',
        'import { identity } from std.stub;',
        'import { identity as id, other } from std.stub;',
      ]) {
      expect(() => compileString(`pragma experimental solidity; ${directive}`,
        { solidityImportCompat: true })).not.toThrow();
    }
  });
});

describe('multipart prefixed string literals', () => {
  it('concatenates adjacent unicode and hex string parts', () => {
    expect(compileString('contract C { function u() public pure returns (string memory) {'
      + ' return unicode"foo" unicode"😃" unicode"!"; }'
      + ' function h() public pure returns (bytes4) { return hex"dead" hex"beef"; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('escaped-newline string continuations', () => {
  it('removes escaped LF and CRLF line breaks from plain and unicode strings', () => {
    expect(compileString('contract C { function f() public pure returns (string memory, string memory) {'
      + ' return ("left\\\n right", unicode"up\\\r\n down"); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('multiline storage-layout specifiers', () => {
  it('ignores EVM layout-at clauses across NatSpec comments while preserving the contract body', () => {
    expect(compileString('contract C\n'
      + ' /// layout docs\n'
      + ' layout at\n'
      + ' /** expression docs */\n'
      + ' 0x1234\n'
      + ' { function f() public pure returns (uint256) { return 7; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('parser-recovery function layout clause', () => {
  it('ignores an incomplete function-level `layout at` clause in Solidity import compatibility mode', () => {
    expect(compileString(
      'contract C { function f() public pure layout at { } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('scientific rational integer constants', () => {
  it('preserves a fractional exponent literal until the enclosing constant expression is integral', () => {
    expect(compileString(
      'uint constant HALF_RANGE = 2**256 * 500e-3;'
      + ' contract C { function f() public pure returns (uint) { return HALF_RANGE; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('state-variable initializer assignment chains', () => {
  it('preserves inner state writes before the outer immutable initialization', () => {
    expect(compileString(
      'contract C { uint immutable z = 2; uint immutable x = z = y = 3;'
      + ' uint immutable y = 5; function f() public view returns (uint) { return x + y + z; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
    expect(compileString(
      'contract D { int immutable x = x = 5; function f() public view returns (int) { return x; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('D');
  });

  it('recognizes a current-contract-qualified target before that state slot is registered', () => {
    expect(compileString(
      'contract C { uint x = (C).x = 2; function f() public view returns (uint) { return x; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
    expect(compileString(
      'contract B { uint x = 1; } contract C is B { uint y = (B).x = 3; }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('retains pure-read and view-write diagnostics for qualified state access', () => {
    expect(() => compileString(
      'contract A { uint x; } contract C is A { function f() public pure returns (uint) { return A.x; } }',
      { solidityImportCompat: true },
    )).toThrow(/pure.*cannot read/i);
    expect(() => compileString(
      'contract A { uint x; } contract C is A { function f() public view { A.x = 2; } }',
      { solidityImportCompat: true },
    )).toThrow(/cannot modify/i);
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

describe('fixed local external-function-pointer arrays', () => {
  it('tracks assigned methods through indexed abi.encodeCall targets and selector aliases', () => {
    expect(compileString(
      'contract C { function target() external pure {} function f() external returns (bytes4) {'
      + ' function() external[2] memory callbacks; callbacks[0] = this.target; callbacks[1] = this.target;'
      + ' function() external pointer = callbacks[1];'
      + ' bytes memory a = abi.encodeCall(callbacks[0], ());'
      + ' bytes memory b = abi.encodeCall(pointer, ());'
      + ' assert(bytes4(a) == pointer.selector); return bytes4(b); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('indexed function-pointer call options', () => {
  it('retains value and gas options on a pointer selected from an inline array', () => {
    expect(compileString(
      'contract C { function a() external payable returns (uint) { return 1; }'
      + ' function b() external payable returns (uint) { return 2; }'
      + ' function f() public payable returns (uint) {'
      + ' return [this.a, this.b][0]{value: 1, gas: 100000}(); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('standalone generic-storage libraries', () => {
  it('emits a declaration artifact while retaining storage-pointer functions for import/inlining', () => {
    const artifact = compileString(
      'library Set { struct Data { mapping(uint => bool) flags; }'
      + ' function insert(Data storage self, uint value) public returns (bool) {'
      + ' if (self.flags[value]) return false; self.flags[value] = true; return true; } }',
      { solidityImportCompat: true },
    );
    expect(artifact.contractName).toBe('Set');
    expect(artifact.bytecode).toBe('');
  });
});

describe('returning a no-argument array push', () => {
  it('appends and returns the fresh element default', () => {
    const fromPush = compileString(
      'contract C { uint[] x; function f() public returns (uint) { return x.push(); } }',
      { solidityImportCompat: true, forceStateful: true },
    );
    const explicit = compileString(
      'contract C { uint[] x; function f() public returns (uint) { x.push(0); return 0; } }',
      { solidityImportCompat: true, forceStateful: true },
    );
    expect(fromPush.bytecode).toBe(explicit.bytecode);
  });
});

describe('statement-form using-for library calls', () => {
  it('resolves external, public, and internal library members through the same binding', () => {
    expect(compileString('library L { function e(uint x) external pure {}'
      + ' function p(uint x) public pure {} function i(uint x) internal pure {} }'
      + ' using L for uint; contract C { function f() public pure { uint x; x.e(); x.p(); x.i(); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('parenthesized tuple-valued ternaries', () => {
  it('evaluates a wrapped ternary condition once and discards the selected tuple', () => {
    expect(compileString('contract C { function f() public pure returns (bool) { bool flag;'
      + ' ((flag = true) ? (1, 2, 3) : (3, 2, 1)); return flag; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('discarded user-defined array type expressions', () => {
  it('accepts a struct array type without turning ordinary indexed values into no-ops', () => {
    expect(compileString('contract C { struct S { uint256 x; } function f(uint256[] memory a)'
      + ' public pure returns (uint256) { S[7][]; a[0]; return 3; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('declared methods shadow SolidCash conveniences', () => {
  it('resolves this.transfer to a user-defined method before the satoshi-transfer intrinsic', () => {
    expect(compileString('contract C { function transfer(uint256 x) public pure {}'
      + ' function f() public { this.transfer(10); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('abi.encodeCall through a self-function pointer alias', () => {
  it('uses the aliased external method selector for a bare pointer target', () => {
    expect(compileString('contract C { function target(uint256 a, uint256 b) external {}'
      + ' function f(uint256 x, uint256 y) public view returns (bytes memory) {'
      + ' function(uint256, uint256) external p = this.target; return abi.encodeCall(p, (x, y)); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('preserves side effects when a helper returns the encoded self pointer', () => {
    expect(compileString('contract C { bool touched; function target(uint256 a) external {}'
      + ' function pointer() public returns (function(uint256) external) {'
      + ' touched = true; return this.target; }'
      + ' function f(uint256 x) public returns (bytes memory) { return abi.encodeCall(pointer(), (x)); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('declaration selectors in constant initializers', () => {
  it('folds function, event, and error selectors before contract functions are registered', () => {
    expect(compileString('event GlobalEvent(); error GlobalError();'
      + ' bytes32 constant GE = GlobalEvent.selector; bytes4 constant GX = GlobalError.selector;'
      + ' interface I { function ping(uint256 x) external; }'
      + ' contract Base { function inherited() public { require(true); } }'
      + ' contract C is Base { event LocalEvent(uint256 x); error LocalError(uint256 x);'
      + ' bytes4 constant A = I.ping.selector; bytes4 constant B = this.own.selector;'
      + ' bytes4 constant D = super.inherited.selector; bytes32 constant E = LocalEvent.selector;'
      + ' bytes4 constant F = C.LocalError.selector; function own() external { require(true); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('keeps same-signature errors distinct by scope and folds selectors in function bodies', () => {
    expect(compileString('library L { error E(); } library T { error E(); }'
      + ' library S { error E(uint256 x); } error E(); interface I { error E(); }'
      + ' contract C { function f() public pure returns (bytes4) {'
      + ' assert(L.E.selector == T.E.selector); assert(L.E.selector != S.E.selector);'
      + ' assert(E.selector == I.E.selector); return L.E.selector; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('still rejects Solidity-reserved zero and all-one custom-error selectors', () => {
    expect(() => compileString('error buyAndFree22457070633(uint256); contract C {}',
      { solidityImportCompat: true })).toThrow('reserved selector 0x00000000');
    expect(() => compileString('error test266151307(); contract C {}',
      { solidityImportCompat: true })).toThrow('reserved selector 0xffffffff');
  });
});

describe('selectors from contract-valued call receivers', () => {
  it('evaluates only the selected ternary receiver before returning its method selector', () => {
    expect(compileString('contract A { function f() public { require(true); }'
      + ' function g() public { require(true); } } contract C { A a = new A(); bool touched;'
      + ' function getContract() public returns (A) { touched = true; return a; }'
      + ' function test(bool b) public returns (bytes4) {'
      + ' return (b ? getContract().f : getContract().g).selector; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('using-for method named selector on function values', () => {
  it('prefers the declared library method over selector metadata syntax', () => {
    expect(compileString('library L { function selector(function(uint256) internal pure returns (uint256) fn,'
      + ' uint256 x) internal pure returns (uint256) { return fn(x) * 2; } }'
      + ' contract C { using L for function(uint256) internal pure returns (uint256);'
      + ' function identity(uint256 x) internal pure returns (uint256) { return x; }'
      + ' function test(uint256 x) public pure returns (uint256) { return identity.selector(x); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('using-for on an external self-function value', () => {
  it('reconstructs the complete receiver signature for this.identity.double(value)', () => {
    const src = 'library L { function double(function(uint256) external pure returns (uint256) fn,'
      + ' uint256 x) internal pure returns (uint256) { return fn(x) * 2; } }'
      + ' contract C { using L for function(uint256) external pure returns (uint256);'
      + ' function identity(uint256 x) external pure returns (uint256) { return x; }'
      + ' function test(uint256 x) public returns (uint256) { return this.identity.double(x); } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('does not guess an overloaded function receiver', () => {
    const src = 'library L { function tag(function(uint256) external fn) internal pure {} }'
      + ' contract C { using L for function(uint256) external;'
      + ' function f(uint256) external {} function f(bytes32) external {}'
      + ' function test() public { this.f.tag(); } }';
    expect(() => compileString(src, { solidityImportCompat: true })).toThrow();
  });
});

describe('runtime selector reads from received external function pointers', () => {
  it('reads the selector half of the lowered address-selector ABI pair', () => {
    const artifact = compileString('contract C { function f() external returns (bytes4) {'
      + ' return this.f.selector; } function h(function() external p) public returns (bytes4) {'
      + ' return p.selector; } }', { solidityImportCompat: true });
    expect(artifact.contractName).toBe('C');
    expect(artifact.abi.find((entry) => entry.name === 'h')?.inputs.map((input) => input.type))
      .toEqual(['address', 'bytes4', 'bigint']);
  });

  it('reads an uninitialized local pointer as the default zero selector at runtime', () => {
    expect(compileString('contract C { function f() public pure returns (bytes4) {'
      + ' function() external g; g.selector; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('selects the proven self method returned through a named return variable', () => {
    expect(compileString('contract C { function target() external { require(true); }'
      + ' function pointer() public view returns (function() external p) { p = this.target; }'
      + ' function f() public returns (bytes4) { return pointer().selector; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('discarded contract-qualified function references', () => {
  it('accepts an external function literally named selector with and without metadata access', () => {
    expect(compileString('contract C { constructor() { C.selector.selector; C.selector; }'
      + ' function selector() external pure returns (uint256) { return 3; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('contract-qualified internal function-pointer state variables', () => {
  it('keeps a pointer assigned in one entry point and called from another', () => {
    expect(compileString('contract C { function() returns (uint256) internal x;'
      + ' function set() public { C.x = g; } function g() public pure returns (uint256) { return 2; }'
      + ' function get() public returns (uint256) { return C.x(); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('whole-mapping storage aliases', () => {
  it('routes indexed array pushes through the aliased state mapping', () => {
    expect(compileString('contract C { mapping(uint256 key => uint256[] values) data;'
      + ' function f() external { mapping(uint256 key => uint256[] values) storage alias_ = data;'
      + ' alias_[1].push(2); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('inherited state-struct field writes', () => {
  it('rebuilds an inherited struct whose type was unavailable while parsing the derived body', () => {
    expect(compileString('struct S { uint256 x; address a; bool b; } contract A { S public s; }'
      + ' contract C is A { function init() public { s.x = 7; s.a = address(0x1234); s.b = true; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('literal-backed memory bytes in inline assembly', () => {
  it('lowers the local to a Yul-compatible pointer and serializes it on assignment', () => {
    expect(compileString('contract C { bytes x; function f() public returns (uint r) {'
      + ' bytes memory m = "tmp"; assembly { mstore(m, 8) mstore(add(m, 32), "deadbeef15dead") }'
      + ' x = m; assembly { r := sload(x.slot) } } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('mapping storage-pointer rebinding', () => {
  it('routes uses after a direct reassignment to the new state mapping', () => {
    expect(compileString('contract C { mapping(uint8 => uint8) m1; mapping(uint8 => uint8) m2;'
      + ' function f() public returns (uint8, uint8) { mapping(uint8 => uint8) storage m = m1;'
      + ' m[1] = 42; m = m2; m[2] = 21; return (m1[1], m2[2]); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('removes a mapping pointer from a parallel tuple assignment and retains scalar writes', () => {
    expect(compileString('contract C { mapping(uint8 => uint8) m1; mapping(uint8 => uint8) m2;'
      + ' function f() public returns (uint8, uint8) { mapping(uint8 => uint8) storage m = m1;'
      + ' uint8 v; (m, v) = (m2, 21); m[2] = v; return (m1[2], m2[2]); } }',
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

describe('self staticcall dispatch and bytes-length narrowing', () => {
  it('dispatches abi.encodeCall payloads internally and permits reusing the return-data variable', () => {
    expect(compileString('contract Shape { function a(uint x) external pure {} }'
      + ' contract C { function a(uint x) external pure returns (uint) { return x + 1; }'
      + ' function test() public returns (uint r) { bool ok; bytes memory result;'
      + ' (ok, result) = address(this).staticcall(abi.encodeCall(Shape.a, 1));'
      + ' require(ok && result.length == 32); r = abi.decode(result, (uint));'
      + ' (ok, result) = address(this).staticcall(abi.encodeCall(Shape.a, 10));'
      + ' require(ok && result.length == 32); return r + abi.decode(result, (uint)); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('ends a bytesN flow narrowing when the guarded variable is reassigned', () => {
    expect(compileString('contract C { function f(bytes memory first, bytes memory second)'
      + ' public pure returns (bytes memory) { bytes memory value = first;'
      + ' require(value.length == 32); value = second; return value; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('memory string parameters referenced by Yul', () => {
  it('materializes the ABI value into shared linear memory and exposes its pointer', () => {
    expect(compileString('contract C { function f(string memory s) public returns (bool ret) {'
      + ' assembly { let a := keccak256(s, 32) let b := keccak256(s, 8) ret := eq(a, b) } } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('pointer-backed named memory-bytes returns', () => {
  it('serializes Yul-mutated buffers initialized from a parameter or literal', () => {
    expect(compileString('function copy(bytes memory pattern) pure returns (bytes memory out) {'
      + ' out = pattern; assembly { mcopy(add(out, 0x20), add(out, 0x20), 0) } }'
      + ' contract C { function literal() public pure returns (bytes memory out) {'
      + ' out = hex"010203"; assembly { mcopy(add(out, 0x20), add(out, 0x20), 0) } }'
      + ' function copied(bytes memory value) public pure returns (bytes memory) { return copy(value); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('preserves the null pointer of an uninitialized named bytes return', () => {
    expect(compileString('contract C { function f(bytes memory src) public pure returns (bytes memory dst) {'
      + ' assembly { mcopy(add(dst, 0x1f), add(src, 0x1f), 0x01)'
      + ' mcopy(add(dst, 0x20), add(src, 0x00), 0x08)'
      + ' mcopy(add(dst, 0x28), add(src, 0x28), 0x10)'
      + ' mcopy(add(dst, 0x38), add(src, 0x00), 0x08) } } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('materializes an abi.encode result before exposing its pointer to Yul', () => {
    expect(compileString('contract C { function f(string calldata x) external returns (bytes memory r) {'
      + ' uint p; assembly { p := mload(0x40) } r = abi.encode(x);'
      + ' assembly { if iszero(eq(p, r)) { revert(0, 0) } } } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('runtime Yul clz', () => {
  it('lowers a word operand with fixed binary-search branches', () => {
    expect(compileString('contract C { function f(uint256 x) public pure returns (bytes32 ret) {'
      + ' assembly { ret := clz(x) } } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('function pointers as Yul words', () => {
  it('exposes the internal function id and permits raw pointer assignment', () => {
    expect(compileString('contract C { function target() internal {} function() internal stored;'
      + ' function read() public returns (uint word) { function() internal local = stored;'
      + ' assembly { word := local } }'
      + ' function copy() public { function() internal a = target; function() internal b;'
      + ' assembly { b := a } b(); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('tuple assignment targets returned by storage push()', () => {
  it('appends assigned values across flat, nested, indexed, and aliased targets', () => {
    expect(compileString('contract C { bytes1[] x; bytes1[] z; function f() public {'
      + ' (x.push(), x.push()) = (0, 0);'
      + ' ((x.push(), x.push()), x.push()) = ((0, 0), 0);'
      + ' (x.push(), x[0]) = (0, 0);'
      + ' bytes1[] storage y = x; (x.push(), y.push()) = (0, 0);'
      + ' (x.push(), z.push()) = (0, 0); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('supports the same push-return assignment targets on bytes storage', () => {
    expect(compileString('contract C { bytes x; function f() public {'
      + ' (x.push(), x.push()) = (0, 0);'
      + ' (((x.push())), (x.push())) = (0, 0); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('storage-pointer expression inlining with same-arity overloads', () => {
  it('ignores an overload that has no reducible single-return body', () => {
    expect(compileString('library D { struct S { uint a; }'
      + ' function mul(S storage self, uint x) public returns (uint) { return self.a * x; }'
      + ' function mul(S storage, bytes32) public returns (bytes32) {} }'
      + ' contract C { using D for D.S; D.S x;'
      + ' function f(uint a) public returns (uint) { return x.mul(a); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('UDVT dynamic state-array copies', () => {
  it('copies fixed-width UDVT arrays from calldata and memory into chunk-packed state', () => {
    expect(compileString('type Small is uint16; type Left is bytes2; contract C {'
      + ' Small[] public small; Left[] public left;'
      + ' function fromCalldata(Small[] calldata values) external { small = values; }'
      + ' function fromMemory(Left[] memory values) public { left = values; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('copies address-backed UDVT arrays through the framed chunk layout', () => {
    expect(compileString('type Account is address; contract C { Account[] public accounts;'
      + ' function set(Account[] calldata values) external { accounts = values; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('calldata aggregate pointers in Yul', () => {
  it('exposes the ABI offset of a fixed-array element derived from a dynamic calldata array', () => {
    expect(compileString('contract C { function f(uint[2][] calldata x) public returns (uint offset) {'
      + ' uint[2] calldata t = x[1]; assembly { offset := t } } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('rebinds calldata struct views to known parameter offsets', () => {
    expect(compileString('contract C { struct S { uint x; } struct T { uint x; uint y; }'
      + ' function f(S calldata s, T calldata t) public pure returns (uint a, uint b) {'
      + ' assembly { s := t t := 4 } return (s.x, t.x); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('Yul memory words for UDVT struct fields', () => {
  it('unwraps mload fields and wraps mstore values through the underlying type', () => {
    expect(compileString('type MyInt is int64; struct Pair { MyInt a; MyInt b; }'
      + ' contract C { function f(Pair memory p) public pure returns (bytes32 first) {'
      + ' assembly { first := mload(p) mstore(add(p, 0x20), 3) } } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('fixed memory arrays shared with Yul', () => {
  it('uses element zero as the pointer base and narrows loaded words to the element type', () => {
    expect(compileString('contract C { function wide() public pure returns (uint256 value) {'
      + ' uint256[1] memory m; assembly { mstore(m, 0xdeadbeef) } return m[0]; }'
      + ' function narrow() public pure returns (uint8 value) {'
      + ' uint8[1] memory m; assembly { mstore(m, 257) } return m[0]; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('serializes an initialized fixed array when passing it to a call after Yul mutation', () => {
    expect(compileString('contract C { function g(uint8[2] calldata s) external pure returns (uint8) {'
      + ' return s[0]; } function f(uint a) public returns (uint8) { uint8[2] memory m = [0, 0];'
      + ' assembly { mstore(m, a) } return this.g(m); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('uninitialized dynamic memory arrays shared with Yul', () => {
  it('materializes a nonzero pointer to a zero length word', () => {
    expect(compileString('contract C { function f() public pure { uint[] memory x; uint y;'
      + ' assembly { y := x } assert(y != 0); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('case-sensitive UDVT operator targets', () => {
  it('does not collapse a UDVT named Int to the primitive int', () => {
    expect(compileString('type Int is int64; using { add as + } for Int global;'
      + ' function add(Int a, Int b) pure returns (Int) {'
      + ' return Int.wrap(Int.unwrap(a) + Int.unwrap(b)); }'
      + ' contract C { function f(Int a, Int b) public pure returns (Int) { return a + b; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('encodes UDVT event parameters through their underlying type', () => {
    expect(compileString('type Bool is bool; contract C { event Probe(Bool value);'
      + ' function probe(Bool value) public { emit Probe(value); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('rejects non-global, contract-scoped, and duplicate operator definitions', () => {
    expect(() => compileString('type Int is int64; using { add as + } for Int;'
      + ' function add(Int a, Int b) pure returns (Int) { return a; } contract C {}',
    { solidityImportCompat: true })).toThrow(/file-level global/);
    expect(() => compileString('type Int is int64; function add(Int a, Int b) pure returns (Int) { return a; }'
      + ' contract C { using { add as + } for Int global; }',
    { solidityImportCompat: true })).toThrow(/file-level global/);
    expect(() => compileString('type Int is int64; using { add as +, sub as + } for Int global;'
      + ' function add(Int a, Int b) pure returns (Int) { return a; }'
      + ' function sub(Int a, Int b) pure returns (Int) { return b; } contract C {}',
    { solidityImportCompat: true })).toThrow(/already has a definition/);
  });
});

describe('Solidity constant-expression bitwise width', () => {
  it('restores int256 width after arithmetic and unary constant expressions', () => {
    expect(compileString('contract C { function f() public pure returns (int) {'
      + ' return (2 + 2) & ~1; } }', { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('infers uint256 for an all-positive full-width mask', () => {
    expect(compileString('contract C { function f(uint r) public pure returns (bool) {'
      + ' return r == (((2 ** 224 - 1) << 32) | 0xef15dead); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('interface metatype names', () => {
  it('folds type(I).name to the declared interface name', () => {
    expect(compileString('interface I { function f() external; } contract C {'
      + ' function name() public pure returns (string memory) { return type(I).name; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('abi.encodeCall source ABI parameters', () => {
  it('excludes compiler-only state/covenant parameters from self-target argument validation', () => {
    expect(compileString('contract C { bool touched; function target(uint x, uint y) external returns (uint) {'
      + ' touched = true; return x + y; } function encoded() public view returns (bytes memory) {'
      + ' return abi.encodeCall(this.target, (12, 13)); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('contextually converts string literals to fixed bytes parameters', () => {
    expect(compileString('contract C { function target(bytes2 value) external {}'
      + ' function encoded() public view returns (bytes memory) {'
      + ' return abi.encodeCall(this.target, ("ab")); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('empty ABI encodings', () => {
  it('encodes empty argument lists as empty bytes', () => {
    expect(compileString('contract C { function encoded() public pure returns (bytes memory, bytes memory) {'
      + ' return (abi.encode(), abi.encodePacked()); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('local Yul functions in for-loop conditions', () => {
  it('re-evaluates an inlined side-effecting condition call before every iteration', () => {
    expect(compileString('contract C { uint st; function f(uint a) public returns (uint b) { assembly {'
      + ' function sideeffect(r) -> x { sstore(0, add(sload(0), r)) x := 1 }'
      + ' for { let i := a } eq(i, sideeffect(2)) { i := 0 } { b := i } } } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('call options in inlined state helpers', () => {
  it('alpha-renames helper parameters referenced by deployment options', () => {
    expect(compileString('contract D {} contract C { uint x;'
      + ' function deploy(uint amount) internal { x = 1; new D{salt: bytes32(amount)}(); }'
      + ' function f() public { deploy(2); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('tuple locals shadowing contract members', () => {
  it('allows a tuple-declared local to shadow a state variable', () => {
    expect(compileString('contract C { uint x; function pair() internal pure returns (bool, uint) {'
      + ' return (true, 1); } function f() public { (bool ok, uint x) = pair(); require(ok && x == 1); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('constructor argument literal coercion', () => {
  it('contextually converts a string literal to a fixed-bytes constructor parameter', () => {
    expect(compileString('contract D { bytes3 value; constructor(bytes3 v) { value = v; } }'
      + ' contract C { D d; constructor() { d = new D("abc"); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('UDVT arrays in struct fields', () => {
  it('resolves a contract-level UDVT before building struct field types', () => {
    expect(compileString('contract C { type U is uint; struct S { U[] values; }'
      + ' function f() public { S memory s; s.values = new U[](1); s.values[0] = U.wrap(7); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('contract-scoped UDVT shadowing', () => {
  it('allows a contract type to shadow a file-level type declaration', () => {
    expect(compileString('type T is uint; contract C { type T is uint; T value; }',
      { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('UDVT arguments in selector-based self calls', () => {
  it('re-wraps an underlying ABI value when reducing a low-level self call', () => {
    expect(compileString('contract C { type T is int; function target(T x) external returns (T) { return x; }'
      + ' function f() public { (bool ok,) = address(this).call('
      + ' abi.encodeWithSelector(this.target.selector, int(-5))); require(ok); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('qualified custom error resolution', () => {
  it('selects the error declared by the qualifier despite a same-named local declaration', () => {
    expect(compileString('contract D { error E(uint value); } contract C { error E();'
      + ' function f() public { revert D.E(1); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('contract declarations shadowing file-level types', () => {
  it('lets a contract-scoped enum and struct win over same-named file declarations', () => {
    expect(compileString('enum E { FILE } struct S { uint fileValue; } contract C {'
      + ' enum E { LOCAL } struct S { address localValue; }'
      + ' function f() public view { E e = E.LOCAL; S memory s = S(address(this)); e; s; } }',
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

describe('conditional increment expressions', () => {
  it('keeps prefix and postfix mutations inside the selected ternary arm', () => {
    expect(compileString('contract C { function f(uint b) public pure { uint x = 2;'
      + ' uint y = b > 0 ? x++ : --x; assert(y <= 2); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('lowers a ternary assigned to a named return local', () => {
    expect(compileString('contract C { uint a; bool choose;'
      + ' function f() public returns (uint c) { c = choose ? a + 10 : ++a; assert(c >= a); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('public transient state getters', () => {
  it('synthesizes an entry getter and inlines a self getter read to the transaction-local binding', () => {
    const artifact = compileString('contract C { int8 public transient x;'
      + ' function f() public returns (int8) { x = -1; return this.x(); } }',
    { solidityImportCompat: true });
    expect(artifact.abi.map((entry) => entry.name)).toEqual(expect.arrayContaining(['x', 'f']));
  });

  it('lowers transient references introduced by modifier expansion', () => {
    expect(compileString('contract C { uint16 transient x;'
      + ' modifier m(uint16 v) { x += v + 10; _; }'
      + ' function f() public m(x) returns (uint16) { x *= 10; return x; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('initializes synthesized transient getters in secondary source contracts', () => {
    const artifact = compileString('contract B { uint256 transient public value; }'
      + ' contract A { B b; function f() public view returns (uint256) { return b.value(); } }',
    { solidityImportCompat: true });
    expect(artifact.contractName).toBe('A');
  });
});

describe('user-defined gasleft shadowing', () => {
  it('resolves a zero-argument contract function before the BCH gas shim', () => {
    expect(compileString('contract C {'
      + ' function gasleft() public pure returns (bytes32) { return "abc"; }'
      + ' function f() public pure returns (bytes32) { return gasleft(); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('public state getter function values', () => {
  it('contextually treats uncalled this.x as the external getter function', () => {
    const artifact = compileString('contract C { uint immutable public x = 42;'
      + ' function h() public view returns (function () external view returns (uint)) { return this.x; } }',
    { solidityImportCompat: true });
    expect(artifact.abi.map((entry) => entry.name)).toEqual(expect.arrayContaining(['x', 'h']));
  });
});

describe('Solidity constants in Yul word locals', () => {
  it('normalizes bool and fixed-bytes constants to uint256 let bindings', () => {
    expect(compileString('contract C { uint constant x = 2**20; bool constant b = true;'
      + ' bytes4 constant s = "ab"; function f() public pure {'
      + ' assembly { let c1 := x let c2 := b let c3 := s } } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('fixed array dimension range validation', () => {
  it('rejects zero and values above uint256 before choosing the state representation', () => {
    expect(() => compileString('contract C { uint[0] a; }',
      { solidityImportCompat: true })).toThrow(/positive integer/);
    expect(() => compileString('contract C { uint[2**256] a; }',
      { solidityImportCompat: true })).toThrow(/too large/);
  });
});

describe('ABI coder pragma selection', () => {
  it('rejects invalid, repeated, and conflicting source-unit selections', () => {
    const compat = { solidityImportCompat: true };
    expect(() => compileString('pragma abicoder v3; contract C {}', compat)).toThrow(/either.*v1.*v2/);
    expect(() => compileString('pragma abicoder v2; pragma abicoder v2; contract C {}', compat))
      .toThrow(/already been selected/);
    expect(() => compileString('pragma experimental ABIEncoderV2; pragma abicoder v1; contract C {}', compat))
      .toThrow(/already been selected/);
    for (const source of [
      'pragma abicoder "v1"; contract C {}',
      'pragma abicoder "v2"; contract C {}',
      'pragma abicoder v2; pragma experimental ABIEncoderV2; contract C {}',
    ]) {
      expect(compileString(source, compat).contractName).toBe('C');
    }
  });
});

describe('nested internal-only ABI parameter types', () => {
  it('rejects internal function pointers and mappings nested in entry-point aggregates', () => {
    const compat = { solidityImportCompat: true };
    expect(() => compileString('contract C { struct S { function() internal[2] callbacks; }'
      + ' function f(S memory value) public {} }', compat)).toThrow(/Function types cannot be used/);
    expect(() => compileString('contract C { struct S { mapping(uint => uint) values; }'
      + ' function f(S memory value) public {} }', compat)).toThrow(/Function types cannot be used/);
  });
});

describe('Solidity array length mutation receivers', () => {
  it('permits push/pop only on dynamic storage arrays', () => {
    const compat = { solidityImportCompat: true };
    expect(() => compileString('contract C { function f() public { uint[] memory x; x.push(); } }', compat))
      .toThrow(/only available.*storage/);
    expect(() => compileString('contract C { uint[3] x; function f() public { x.pop(); } }', compat))
      .toThrow(/fixed-size storage/);
    expect(compileString('contract C { uint[] x; function f() public { x.push(1); x.pop(); } }',
      compat).contractName).toBe('C');
  });
});

describe('library names as array element types', () => {
  it('rejects library arrays and metatype indexing while retaining contract arrays', () => {
    const compat = { solidityImportCompat: true };
    expect(() => compileString('library L {} contract C { function f() public { L[] memory x; } }', compat))
      .toThrow(/Invalid use of library name/);
    expect(() => compileString('library L {} contract C { function f() public { new L[](2); } }', compat))
      .toThrow(/Invalid use of library name/);
    expect(() => compileString('library L { function f() public { L[0]; } }', compat))
      .toThrow(/Index access.*library/);
    expect(compileString('contract A {} contract C { function f() public { A[] memory x; } }',
      compat).contractName).toBe('C');
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

describe('Yul raw return halts', () => {
  it('does not type-check return(ptr,size) as a Solidity return expression', () => {
    expect(compileString('contract C { function f() public { assembly { mstore(0, 7) return(0, 32) } }'
      + ' function g() public pure returns (uint x) { assembly { return(0, 0) x := 1 } } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('code-baked integer address call targets', () => {
  it('pins explicit address(integer-literal) targets as covenant literals', () => {
    expect(compileString('interface I { function f() external returns (uint); }'
      + ' contract C { function g() public returns (uint) {'
      + ' (address(1).call("")); return I(address(2)).f(); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
  it('retains an empty-script address(0) literal through an explicit contract cast', () => {
    expect(compileString('contract Target { function f() public {} }'
      + ' contract C { function g() public { Target(address(0)).f(); require(true); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
  it('does not expose an omitted-visibility Solidity state variable as a public getter', () => {
    expect(() => compileString('contract Target { uint hidden; }'
      + ' contract C { function g() public { Target(address(0)).hidden(); } }',
    { solidityImportCompat: true })).toThrow();
  });
  it('does not synthesize an omitted-visibility mapping getter that materializes its value type', () => {
    expect(compileString('contract C { mapping(uint => uint[2**100]) hidden; }',
      { solidityImportCompat: true }).contractName).toBe('C');
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

describe('parenthesized contract member calls', () => {
  it('dispatches ((d.f))() like d.f()', () => {
    expect(compileString('contract D { function f() external {} }'
      + ' contract C { function g(D d) public { ((d.f))(); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('constant interface call targets', () => {
  it('pins the literal behind an interface/address constant instead of reading a stack variable', () => {
    expect(compileString(
      'interface I { function f() external; }'
      + ' contract C { I constant X = I(address(4)); function g() public { X.f(); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('state assignments in short-circuit branch conditions', () => {
  it('keeps right-side && and || writes conditional', () => {
    expect(compileString('contract C { bool b; function f(bool choose) public {'
      + ' if (choose && (b = true)) {} if (choose || (b = false)) {} } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('discarded using-for function values', () => {
  it('accepts a uniquely attached library member without calling it', () => {
    expect(compileString('library L { function twice(uint x) public pure returns (uint) { return x * 2; } }'
      + ' contract C { using L for uint; function f(uint x) public pure { x.twice; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('does not guess among overloaded attached members', () => {
    expect(() => compileString('library L {'
      + ' function f(uint x) public pure returns (uint) { return x; }'
      + ' function f(uint x, uint y) public pure returns (uint) { return x + y; } }'
      + ' contract C { using L for uint; function g(uint x) public pure { x.f; } }',
    { solidityImportCompat: true })).toThrow();
  });
});

describe('fixed-array using-for methods named like array builtins', () => {
  it('dispatches attached push and pop methods instead of dynamic-array operations', () => {
    expect(compileString(
      'library L { function push(uint[2] memory a) internal {}'
      + ' function pop(uint[2] memory a) internal {} }'
      + ' contract C { using L for uint[2]; function f() public {'
      + ' uint[2] memory input; input.push(); input.pop(); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('imported enum declaration types', () => {
  it('re-resolves an imported enum placeholder before typing a local initializer', () => {
    expect(compileString(
      'import "./Enums.sol"; contract C { function f(Color c) public pure returns (Color) {'
      + ' Color local = Color.Red; return c == local ? Color.Green : c; } }',
      {
        solidityImportCompat: true,
        importResolver: (path) => path === './Enums.sol'
          ? { source: 'enum Color { Red, Green }', id: '/Enums.sol' }
          : undefined,
        rootFileId: '/main.sol',
      },
    ).contractName).toBe('C');
  });
});

describe('contextual hex-number arithmetic', () => {
  it('types a constant arithmetic tree from its integer destination', () => {
    const hex = compileString('contract C { uint constant X = 0x123 + 0x456;'
      + ' function f() public pure returns (uint) { return X + 1; } }',
    { solidityImportCompat: true });
    const decimal = compileString('contract C { uint constant X = 291 + 1110;'
      + ' function f() public pure returns (uint) { return X + 1; } }',
    { solidityImportCompat: true });
    expect(hex.bytecode).toBe(decimal.bytecode);
  });

  it('applies integer context to local initializers and state assignments', () => {
    expect(compileString('contract C { uint x; function f() public {'
      + ' uint y = 0x12 * 0x3; x = y + (0x8 << 1); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('retains Solidity rejection of an excessive constant shift count', () => {
    expect(() => compileString('contract C { uint x = 0x42 << 0x100000000; }',
      { solidityImportCompat: true })).toThrow(/uint32 constant limit/);
  });

  it('interprets complemented hex-number literals as integers in nested bitwise expressions', () => {
    expect(compileString('contract C { function f() public pure {'
      + ' int x = ~1 | (~0xff ^ 0); assert((~1 | (~0xff & 0)) == -2); assert(x < 0); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('propagates integer assignment context through ternary arithmetic branches', () => {
    expect(compileString('contract C { function f(bool t, bool f) public pure { uint8 a;'
      + ' a = (t ? 0x3f : 0xff) + (f ? 0x3f : 0xff);'
      + ' a = (true ? 0x3f : 0xff) + (false ? 0x3f : 0xff); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('contextually typed inline-array literals', () => {
  it('interprets hex-number elements from an integer array destination', () => {
    const hex = compileString('contract C { function f() public pure returns (uint[2] memory) {'
      + ' uint[2] memory a = [0x111, 0x333333]; return a; } }',
    { solidityImportCompat: true });
    const decimal = compileString('contract C { function f() public pure returns (uint[2] memory) {'
      + ' uint[2] memory a = [273, 3355443]; return a; } }',
    { solidityImportCompat: true });
    expect(hex.bytecode).toBe(decimal.bytecode);
  });

  it('right-pads a string literal from a fixed-bytes array destination', () => {
    expect(compileString('contract C { function f() public pure {'
      + ' bytes7[2] memory a = [bytes7("A"), "B"]; assert(a[1] == bytes7("B")); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('discarded library values', () => {
  it('accepts a library namespace and unique member as no-effect statements', () => {
    expect(compileString('library L { function f(uint x) public pure returns (uint) { return x; } }'
      + ' contract C { function g() public pure { L; L.f; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('does not discard an unknown library member', () => {
    expect(() => compileString('library L { function f() public pure {} }'
      + ' contract C { function g() public pure { L.missing; } }',
    { solidityImportCompat: true })).toThrow();
  });
});

describe('nested lexical local shadowing', () => {
  it('alpha-renames an inner binding while its initializer still reads the outer binding', () => {
    const shadowed = compileString('contract C { function f() public pure returns (uint) {'
      + ' uint x = 7; { x = 3; uint x = x; x = 4; } return x; } }',
    { solidityImportCompat: true });
    const renamed = compileString('contract C { function f() public pure returns (uint) {'
      + ' uint x = 7; { x = 3; uint inner = x; inner = 4; } return x; } }',
    { solidityImportCompat: true });
    expect(shadowed.bytecode).toBe(renamed.bytecode);
  });

  it('retains the duplicate diagnostic for declarations in the same lexical block', () => {
    expect(() => compileString('contract C { function f() public pure { uint x; uint x; } }',
      { solidityImportCompat: true })).toThrow(/Redefinition of variable x/);
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

describe('bare inherited dynamic-array mutations', () => {
  it('classifies push and pop as state-array operations after inheritance expansion', () => {
    expect(compileString('contract A { uint[] public values; }'
      + ' contract C is A { function f() public { values.push(1); values.pop(); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('state-struct tuple swaps', () => {
  it('captures both struct values before writing either state slot', () => {
    expect(compileString('contract C { struct S { uint a; uint b; } S x; S y;'
      + ' function f() public { (x, y) = (y, x); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('straight-line value deploy block layout', () => {
  it('reserves a transfer slot for a value deploy nested in a constructor state assignment', () => {
    expect(compileString('contract D { constructor(bytes3 x) payable {} } contract C { D d;'
      + ' constructor() payable { d = new D{value: 10}("abc"); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('external contract method references', () => {
  it('materializes C(address).f as an address-selector function value', () => {
    expect(compileString('contract C { function f(uint x) external pure returns (uint) { return x; }'
      + ' function g() public pure returns (function(uint) external pure returns (uint)) {'
      + ' return C(address(0x1234)).f; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('try/catch return-path validation', () => {
  it('requires a return only on the compiled try path because VM failure is fatal', () => {
    expect(compileString('contract C { function f() public returns (uint) {'
      + ' try this.f() returns (uint x) { return x; } catch { } } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('try/catch clause validation', () => {
  const cc = (body: string): string => compileString(
    `contract C { function f() public returns (uint) { ${body} } }`,
    { solidityImportCompat: true },
  ).contractName;

  it('rejects empty returns and catch parameter lists', () => {
    expect(() => cc('try this.f() returns () {} catch {}')).toThrow(/requires at least one parameter/);
    expect(() => cc('try this.f() {} catch () {}')).toThrow(/cannot be empty/);
  });

  it('rejects unknown and duplicate catch clause kinds', () => {
    expect(() => cc('try this.f() {} catch Other(uint x) {}')).toThrow(/Invalid catch clause name/);
    expect(() => cc('try this.f() {} catch Error(string memory x) {}'
      + ' catch Error(string memory y) {}')).toThrow(/already has a Error catch clause/);
    expect(() => cc('try this.f() {} catch {} catch (bytes memory data) {}'))
      .toThrow(/already has a low-level catch clause/);
  });

  it('validates Error, Panic, and low-level catch signatures', () => {
    expect(() => cc('try this.f() {} catch Error(uint x) {}')).toThrow(/Error\(string memory/);
    expect(() => cc('try this.f() {} catch Panic(bytes memory data) {}')).toThrow(/Panic\(uint256/);
    expect(() => cc('try this.f() {} catch (uint x) {}')).toThrow(/bytes memory/);
  });

  it('retains each correctly shaped catch clause', () => {
    expect(cc('try this.f() returns (uint x) { return x; }'
      + ' catch Error(string memory reason) { return 1; }'
      + ' catch Panic(uint256 code) { return code; }'
      + ' catch (bytes memory data) { return data.length; }')).toBe('C');
  });
});

describe('try expression and return-clause typing', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;

  it('rejects try on an internal function call', () => {
    expect(() => cc('contract C { function f() public returns (uint) { try f() {} catch {} return 1; } }'))
      .toThrow(/Try can only be used with external function calls and contract creation/);
  });

  it('requires the returns clause to match the external call arity', () => {
    expect(() => cc('contract C { function f() public returns (uint, uint) {'
      + ' try this.f() returns (uint x) { return (x, x); } catch {} } }'))
      .toThrow(/declares 1 values, but the expression returns 2/);
  });

  it('requires exact return types rather than implicit convertibility', () => {
    expect(() => cc('contract C { function f() public returns (uint8, uint256) {'
      + ' try this.f() returns (uint256 x, int256 y) { return (uint8(x), uint256(y)); } catch {} } }'))
      .toThrow(/Try return type must exactly match/);
  });

  it('rejects storage data locations on try-return bindings', () => {
    expect(() => cc('contract C { function f() public returns (string memory) {'
      + ' try this.f() returns (string storage value) { return value; } catch {} } }'))
      .toThrow(/storage.*only valid on internal or private functions/);
  });

  it('retains an exact external self-call returns clause', () => {
    expect(cc('contract C { function f() public returns (uint8, uint256) {'
      + ' try this.f() returns (uint8 x, uint256 y) { return (x, y); } catch {} } }')).toBe('C');
  });

  it('retains library calls and contract creation as valid try targets', () => {
    expect(cc('library L { function f(uint x) public returns (uint) { return x; } }'
      + ' contract C { function run() public returns (uint) {'
      + ' try L.f(1) returns (uint x) { return x; } catch { return 0; } } }')).toBe('C');
    expect(cc('contract D { constructor(uint x) {} } contract C {'
      + ' function run() public returns (bytes memory) {'
      + ' try new D(1) returns (D d) { return address(d); } catch { return ""; } } }')).toBe('C');
  });
});

describe('immutable declaration eligibility', () => {
  const compat = (src: string): string =>
    compileString(src, { solidityImportCompat: true }).contractName;

  it('rejects arrays and structs as non-value immutable types', () => {
    expect(() => compat('contract C { uint[] immutable values; }'))
      .toThrow(/immutable variables cannot have a non-value type/i);
    expect(() => compat('contract C { struct S { int x; } S immutable value; }'))
      .toThrow(/immutable variables cannot have a non-value type/i);
    expect(() => compat('contract C { struct S { mapping(uint => address) values; } S immutable value; }'))
      .toThrow(/immutable variables cannot have a non-value type/i);
  });

  it('rejects immutable external function pointers', () => {
    expect(() => compat('contract C { function() external immutable callback; }'))
      .toThrow(/immutable variables of external function type are not supported/i);
    expect(compat('contract C { function() internal returns (uint) immutable callback; }')).toBe('C');
  });

  it('retains SolidCash-native immutable collections', () => {
    expect(compileString('contract C { uint[] immutable values; }').contractName).toBe('C');
  });
});

describe('abi.encodeWithSelector contextual zero', () => {
  it('implicitly converts literal zero to bytes4', () => {
    expect(compileString('contract C { function f() public pure returns (bytes memory) {'
      + ' return abi.encodeWithSelector(0); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('contextual fixed-bytes tuple literals', () => {
  it('right-pads string literals in tuple declarations and reassignments', () => {
    expect(compileString('contract C { function f() public pure {'
      + ' (bytes32 a, bytes16 b) = ("test", "testz");'
      + ' (a, b) = ("next", "value"); assert(a != bytes32(uint256(0))); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('all-zero hex-number fixed-bytes coercion', () => {
  it('ignores the written zero width but still rejects nonzero narrowing', () => {
    expect(compileString('contract C { function f() public pure {'
      + ' bytes1 a = 0x000; bytes8 b = 0x0;'
      + ' assert(a == bytes1(uint8(0)) && b == bytes8(uint64(0))); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
    expect(() => compileString('contract C { function f() public pure { bytes1 a = 0x001; } }',
      { solidityImportCompat: true })).toThrow();
  });
});

describe('ABI-decoded payable address binding', () => {
  it('retains a payable local qualifier without relaxing ordinary address assignment', () => {
    expect(compileString('contract C { function f(bytes memory data) public pure returns (address payable) {'
      + ' address payable target = abi.decode(data, (address)); return target; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
    expect(() => compileString('contract C { function f(address source) public pure {'
      + ' address payable target = source; } }', { solidityImportCompat: true })).toThrow();
  });
});

describe('self public array-of-struct getter destructuring', () => {
  it('inlines each ABI-visible struct field while retaining indexed state reads', () => {
    expect(compileString('contract C { struct Item { uint x; uint y; } Item[] public items;'
      + ' function f() public view returns (uint) { (uint x, uint y) = this.items(0); return x + y; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('self public struct getter with external function member', () => {
  it('synthesizes the complete tuple of contract and external-function fields', () => {
    expect(compileString('contract D {} contract C { struct S { D d;'
      + ' function () external returns (uint) f; } S public s; function test() public view {'
      + ' (D d, function () external returns (uint) f) = this.s();'
      + ' assert(d == s.d); assert(address(d) == address(this)); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('retains a nested value-struct member after dynamic-field state flattening', () => {
    expect(compileString('contract C { struct T { uint t; }'
      + ' struct S { uint x; T t; bool b; uint[] a; } S public s; function f() public view {'
      + ' uint y; bool c; T memory t; (y, t, c) = this.s();'
      + ' assert(y == s.x); assert(c == s.b); assert(t.t == s.t.t); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

});

describe('storage struct references returned by no-argument push', () => {
  it('passes both a named and inline fresh storage element to an internal helper', () => {
    expect(compileString('contract C { struct S { uint x; } S[] array;'
      + ' function g(S storage s, uint y) internal { s.x = y; }'
      + ' function f(uint y) public { S storage s = array.push(); g(s, y); }'
      + ' function h(uint y) public { g(array.push(), y); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('fixed arrays containing mappings', () => {
  it('uses the complete array-index and mapping-key collection path through a returning storage helper', () => {
    expect(compileString('contract C { mapping(uint8 => uint8)[2] a; mapping(uint8 => uint8)[2] b;'
      + ' function setInternal(mapping(uint8 => uint8)[2] storage m, uint8 key, uint8 x, uint8 y)'
      + ' internal returns (uint8, uint8) { uint8 ox = m[0][key]; uint8 oy = m[1][key];'
      + ' m[0][key] = x; m[1][key] = y; return (ox, oy); }'
      + ' function set(uint8 key, uint8 x, uint8 y) public returns (uint8 ox, uint8 oy) {'
      + ' (ox, oy) = setInternal(a, key, x, y); }'
      + ' function get(uint8 key) public view returns (uint8, uint8) { return (a[0][key], a[1][key]); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('folds the compile-time length and retains direct mixed-key reads and writes', () => {
    expect(compileString('contract C { mapping(uint => uint)[2] entries;'
      + ' function f(uint k, uint v) public returns (uint) {'
      + ' require(entries.length == 2); entries[1][k] = v; return entries[1][k]; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('substitutes a mapping pointer bound to a runtime-selected fixed-array element', () => {
    expect(compileString('contract C { mapping(uint => uint)[2] severalMaps;'
      + ' function set(mapping(uint => uint) storage map) internal {'
      + ' severalMaps[0][0] = 42; map[0] = 2; assert(severalMaps[0][0] == 42); }'
      + ' function f(uint x) public { require(x < severalMaps.length); set(severalMaps[x]); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
    expect(compileString('contract C { mapping(uint => uint)[2][2] maps;'
      + ' function set(mapping(uint => uint) storage map) internal {'
      + ' map[0] = 42; assert(map[0] == 42); assert(maps[0][0][0] == 42); }'
      + ' function f(uint x) public { require(x < 2); set(maps[x][0]); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('cast-wrapped same-transaction deploy calls', () => {
  const contracts = 'interface IShort { function f() external pure returns (bytes32); }'
    + ' contract Long { function f() external pure returns (uint[20] memory) {} }';

  it('folds the concrete callee and discards an intentionally mismatched interface result', () => {
    expect(compileString(contracts + ' contract C { function test() public returns (uint) {'
      + ' Long fresh = new Long(); uint before; assembly { before := mload(0x40) }'
      + ' IShort(address(fresh)).f(); uint after; assembly { after := mload(0x40) } return after - before; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('does not erase a mismatched ABI result used as a value', () => {
    expect(() => compileString(contracts + ' contract C { function test() public returns (bytes32) {'
      + ' Long fresh = new Long(); return IShort(address(fresh)).f(); } }',
    { solidityImportCompat: true })).toThrow(/Cannot call 'f\(\)'/);
  });

  it('folds an inline deployment hidden by address and interface casts', () => {
    const src = 'contract Child { uint x; function f() public returns (uint) { x = 3; return 1; } }'
      + ' interface IView { function f() external view returns (uint); }'
      + ' contract C { function test() public returns (uint) { return IView(address(new Child())).f(); } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('state-backed external target through address casts', () => {
  it('records a contract-typed immutable as the persisted callee address source', () => {
    const src = 'contract Child { function f() external pure returns (uint) { return 0; } }'
      + ' interface IChild { function f() external pure returns (uint); }'
      + ' contract C { Child immutable child = new Child();'
      + ' function g() public returns (uint) { return IChild(address(child)).f(); } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
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

describe('file-level operator functions in per-contract compilation', () => {
  it('retains the implementation referenced only by a global using-for directive', () => {
    const src = 'type Small is int32; using {add as +} for Small global;'
      + ' function add(Small x, Small y) pure returns (Small) {'
      + ' return Small.wrap(Small.unwrap(x) + Small.unwrap(y)); }'
      + ' contract C { function f(Small x, Small y) public pure returns (Small) { return x + y; } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('inlines binary and unary operator helpers that call an interface on a pure helper result', () => {
    const src = 'type Small is int32; using {add as +, inc as -} for Small global;'
      + ' interface ICalc { function mul(Small, Small) external pure returns (Small);'
      + ' function next(Small) external pure returns (Small); }'
      + ' function load() pure returns (ICalc) { return ICalc(address(0)); }'
      + ' function add(Small x, Small y) pure returns (Small) { return load().mul(x, y); }'
      + ' function inc(Small x) pure returns (Small) { return load().next(x); }'
      + ' contract C { function f(Small x, Small y) public returns (Small) { return x + y; }'
      + ' function g(Small x) public returns (Small) { return -x; } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
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

describe('own-contract-qualified state arrays', () => {
  it('treats C.a push/pop/index/length exactly like bare state access', () => {
    const qualified = compileString('contract C { uint[] a; function f() public {'
      + ' C.a.push(2); require(C.a[C.a.length - 1] == 2); C.a.pop(); require(C.a.length == 0); } }',
    { solidityImportCompat: true });
    const bare = compileString('contract C { uint[] a; function f() public {'
      + ' a.push(2); require(a[a.length - 1] == 2); a.pop(); require(a.length == 0); } }',
    { solidityImportCompat: true });
    expect(qualified.bytecode).toBe(bare.bytecode);
  });
});

describe('delete on a flattened struct with array leaves', () => {
  it('routes fixed-array writes through the collection and clears every finite leaf', () => {
    const src = 'contract C { struct S { uint32 a; uint32[3] b; uint32[] x; } S s;'
      + ' function f() public { s.a = 1; s.b[0] = 2; s.b[1] = 3;'
      + ' s.x.push(4); delete s;'
      + ' require(s.a == 0 && s.b[0] == 0 && s.b[1] == 0 && s.x.length == 0); } }';
    expect(compileString(src, { solidityImportCompat: true, chunkedArrays: true }).contractName).toBe('C');
  });
});

describe('whole fixed-array literals on flattened struct fields', () => {
  it('uses the same collection writes as explicit indexed assignments', () => {
    const compile = (body: string): string => compileString(
      `contract C { struct S { uint8[2] x; mapping(uint => uint) m; } S src;
       constructor() { ${body} } function f() public { require(src.x[0] == 3 && src.x[1] == 5); } }`,
      { solidityImportCompat: true },
    ).bytecode;
    expect(compile('src.x = [3, 5];')).toBe(compile('src.x[0] = 3; src.x[1] = 5;'));
  });

  it('copies value and array leaves between flattened state structs while retaining mappings', () => {
    expect(compileString(
      `contract C { struct S { uint8[2] x; uint8 y; mapping(uint => uint) m; } S src; S dst;
       constructor() { src.x = [3, 5]; src.y = 7; src.m[0] = 9; dst = src; }
       function f() public { require(dst.x[0] == 3 && dst.x[1] == 5 && dst.y == 7); } }`,
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('whole storage aliases to flattened structs', () => {
  it('routes scalar and mapping-field writes through the aliased state leaves', () => {
    const alias = compileString(
      `contract C { struct S { uint sum; mapping(uint => uint) m; } S s;
       function f() public { S storage p = s; p.sum = 4; p.m[1] = 7;
       require(s.sum == 4 && s.m[1] == 7); } }`,
      { solidityImportCompat: true },
    ).bytecode;
    const direct = compileString(
      `contract C { struct S { uint sum; mapping(uint => uint) m; } S s;
       function f() public { s.sum = 4; s.m[1] = 7; require(s.sum == 4 && s.m[1] == 7); } }`,
      { solidityImportCompat: true },
    ).bytecode;
    expect(alias).toBe(direct);
  });

  it('flattens nested mapping fields in a struct storage parameter before inlining', () => {
    const helper = compileString(
      `contract C { struct S { mapping(uint => uint) m; uint sum; } struct T { uint x; S s; } T t;
       function put(T storage p) internal { p.s.m[1] = 7; p.s.sum = 7; }
       function f() public { put(t); require(t.s.m[1] == 7 && t.s.sum == 7); } }`,
      { solidityImportCompat: true },
    ).bytecode;
    const direct = compileString(
      `contract C { struct S { mapping(uint => uint) m; uint sum; } struct T { uint x; S s; } T t;
       function f() public { t.s.m[1] = 7; t.s.sum = 7; require(t.s.m[1] == 7 && t.s.sum == 7); } }`,
      { solidityImportCompat: true },
    ).bytecode;
    expect(helper).toBe(direct);
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

describe('defined-later struct storage-return helpers', () => {
  it('rebuilds a field written through an inline call regardless of declaration order', () => {
    expect(compileString(
      `contract C { struct S { uint x; } S[4] data;
       function f(uint v) public { get().x = v; require(data[1].x == v); }
       function get() internal view returns (S storage p) { return data[1]; } }`,
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('dead mapping-bearing storage-pointer return helpers', () => {
  it('prunes unreachable internal/private helpers with no standalone VM representation', () => {
    expect(compileString(
      `contract C { mapping(uint => uint)[] m;
       function dead() internal view returns (mapping(uint => uint)[] storage) { return m; }
       function alsoDead() private view returns (mapping(uint => uint)[] storage r) { r = m; } }`,
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('increment and decrement on flattened struct scalar leaves', () => {
  it('matches explicit checked addition and subtraction', () => {
    const compile = (body: string): string => compileString(
      `contract C { struct S { uint x; S[] children; } S s;
       function f() public { s.x = 10; ${body} require(s.x == 10); } }`,
      { solidityImportCompat: true },
    ).bytecode;
    expect(compile('++s.x; s.x++; --s.x; s.x--;'))
      .toBe(compile('s.x = s.x + 1; s.x = s.x + 1; s.x = s.x - 1; s.x = s.x - 1;'));
  });
});

describe('recursive mapping-bearing struct flattening', () => {
  it('does not recursively expand an unused self-referential mapping declaration', () => {
    expect(compileString('contract C { struct S { uint z; mapping(uint => S) next; } S data;'
      + ' function f() public pure { require(true); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('does not recursively expand mutually recursive mapping declarations', () => {
    expect(compileString('contract C { struct A { uint x; mapping(uint => B) b; }'
      + ' struct B { uint y; mapping(uint => A) a; } A data;'
      + ' function f() public pure { require(true); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('return lowering through stacked loop modifiers', () => {
  it('propagates a synthesized break through modifier-inserted lexical blocks', () => {
    expect(compileString(`contract C {
      uint x;
      modifier m() { for (uint i = 0; i < 2; i++) { _; ++x; return; } }
      function f() public m m returns (uint) {
        for (uint i = 0; i < 2; i++) { ++x; return 42; }
      }
    }`, { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });
});

describe('discarded payable-address method references', () => {
  it('evaluates the receiver without invoking bare transfer/send members', () => {
    expect(compileString('contract C { fallback() external payable {'
      + ' payable(this).transfer; payable(this).send; } function f() public pure { require(true); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('UDVT operator overloads on state values', () => {
  it('resolves the overload from a state-access operand before type checking', () => {
    expect(compileString('type U8 is uint8; using { add as + } for U8 global;'
      + ' function add(U8 a, U8 b) pure returns (U8) {'
      + ' return U8.wrap(U8.unwrap(a) + U8.unwrap(b)); }'
      + ' contract C { U8 x = U8.wrap(1); function f() public {'
      + ' x = x + U8.wrap(1); require(U8.unwrap(x) > 0); } }',
    { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });
});

describe('UDVT operator declaration validation', () => {
  const cc = (src: string): string =>
    compileString(src, { solidityImportCompat: true }).contractName;

  it('rejects non-global and interface-scoped operator directives', () => {
    expect(() => cc('type T is uint; function add(T a, T b) pure returns (T) { return a; }'
      + ' using { add as + } for T; contract C {}'))
      .toThrow(/Operators can only be defined in a file-level global/);
    expect(() => cc('type T is uint; function add(T a, T b) pure returns (T) { return a; }'
      + ' interface I { using { add as + } for T; } contract C {}'))
      .toThrow(/file-level global/);
  });

  it('rejects duplicate operator definitions', () => {
    expect(() => cc('type T is uint;'
      + ' function add(T a, T b) pure returns (T) { return a; }'
      + ' function sub(T a, T b) pure returns (T) { return b; }'
      + ' using { add as +, sub as + } for T global; contract C {}'))
      .toThrow(/more than one definition/);
  });

  it('requires pure functions with exact operand and return types', () => {
    expect(() => cc('type T is uint; function add(T a) pure returns (T) { return a; }'
      + ' using { add as + } for T global; contract C {}'))
      .toThrow(/Wrong parameters/);
    expect(() => cc('type T is uint; function add(T a, T b) view returns (T) { return a; }'
      + ' using { add as + } for T global; contract C {}'))
      .toThrow(/Only pure free functions/);
    expect(() => cc('type T is uint; function add(T a, T b) pure returns (uint) { return 0; }'
      + ' using { add as + } for T global; contract C {}'))
      .toThrow(/Wrong return parameters/);
  });

  it('retains valid arithmetic and comparison definitions', () => {
    expect(cc('type T is uint;'
      + ' function add(T a, T b) pure returns (T) { return a; }'
      + ' function eq(T a, T b) pure returns (bool) { return true; }'
      + ' using { add as +, eq as == } for T global;'
      + ' contract C { function f(T a, T b) public pure returns (bool) { return a + b == a; } }')).toBe('C');
    expect(cc('type T is uint; function add(T a, T b) pure returns (T) { return a; }'
      + ' using { add as +, add as + } for T global; contract C {}')).toBe('C');
  });
});

describe('using-for attachment declaration validation', () => {
  const cc = (src: string): string =>
    compileString(src, { solidityImportCompat: true }).contractName;

  it('requires explicit file-level and specific-function target types', () => {
    expect(() => cc('library L {} using L for *; contract C {}'))
      .toThrow(/type has to be specified explicitly at file level/i);
    expect(() => cc('function id(uint x) pure returns (uint) { return x; }'
      + ' using { id } for *; contract C {}'))
      .toThrow(/type has to be specified explicitly when attaching specific functions/i);
    expect(() => cc('function id(uint x) pure returns (uint) { return x; }'
      + ' contract C { using { id } for *; }'))
      .toThrow(/type has to be specified explicitly when attaching specific functions/i);
  });

  it('requires an attached free function to have a receiver parameter', () => {
    expect(() => cc('function one() pure returns (uint) { return 1; }'
      + ' using { one } for uint; contract C {}'))
      .toThrow(/does not have any parameters/);
  });

  it('retains explicitly typed attachments and contract-level library wildcards', () => {
    expect(cc('function id(uint x) pure returns (uint) { return x; }'
      + ' library L { function f(uint x) internal pure returns (uint) { return x; } }'
      + ' using { id } for uint; contract C { using L for *; }')).toBe('C');
  });

  it('preserves native specific-function wildcards', () => {
    expect(compileString('function id(uint x) pure returns (uint) { return x; }'
      + ' using { id } for *; contract C {}').contractName).toBe('C');
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

describe('discarded contract fixed-array type expressions', () => {
  it('drops a declared contract type with a literal bound but not an unknown runtime base', () => {
    expect(compileString('contract C { function f() public pure { C[0]; } }',
      { solidityImportCompat: true }).contractName).toBe('C');
    expect(() => compileString('contract C { function f() public pure { Unknown[0]; } }',
      { solidityImportCompat: true })).toThrow(/Undefined reference/);
  });

  it('drops a contract-qualified struct fixed-array type expression', () => {
    expect(compileString('contract C { struct S { uint x; }'
      + ' function f() public pure { C.S[10]; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('discarded contract metatype references', () => {
  it('drops declared current and sibling contract types while retaining unknown-name diagnostics', () => {
    expect(compileStringMulti('contract A { function f() public pure { A; B; } } contract B {}',
      { solidityImportCompat: true }).A.contractName).toBe('A');
    expect(() => compileString('contract C { function f() public pure { Unknown; } }',
      { solidityImportCompat: true })).toThrow(/Undefined reference/);
  });
});

describe('sibling-contract-qualified enums', () => {
  it('resolves the qualified enum type and member from another contract in the source unit', () => {
    const artifacts = compileStringMulti('contract Types { enum Status { One, Two } }'
      + ' contract C { function f() public pure returns (Types.Status) { return Types.Status.Two; } }',
    { solidityImportCompat: true });
    expect(artifacts.C.contractName).toBe('C');
  });
});

describe('tx-named storage aliases in tuple lvalues', () => {
  it('rewrites a member target through the mapping-entry alias', () => {
    expect(compileString('contract C { struct T { bool executed; }'
      + ' mapping(uint => T) transactions; function f(uint id, address target) public {'
      + ' T storage tx = transactions[id];'
      + ' (tx.executed,) = target.call(""); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('parallel whole-struct storage-pointer rebinding', () => {
  it('snapshots aliases while swapping pointer targets in a mixed state tuple', () => {
    expect(compileString('contract C { struct S { uint a; uint b; } S x; S y;'
      + ' function f() public { S storage x_local = x; S storage y_local = y; S storage z_local = x;'
      + ' (x, y_local, x_local, z_local) = (y, x_local, y_local, y); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
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

describe('exact rational constants with negative exponents', () => {
  it('folds an exact reciprocal before integer division can truncate it', () => {
    const rational = compileString(
      'contract C { function f() public pure returns (int) { return (-1 / 2) ** -1; } }',
      { solidityImportCompat: true },
    );
    const integer = compileString(
      'contract C { function f() public pure returns (int) { return -2; } }',
      { solidityImportCompat: true },
    );
    expect(rational.bytecode).toBe(integer.bytecode);
  });
});

describe('forward constant dependency validation', () => {
  it('resolves an acyclic forward chain while still rejecting a genuine cycle', () => {
    expect(compileString('contract C { uint constant a = b * c; uint constant b = 7;'
      + ' uint constant c = 4 + d; uint constant d = 2 + b;'
      + ' function f() public pure returns (uint) { return a; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
    expect(() => compileString(
      'contract C { uint constant a = b + 1; uint constant b = a + 1; }',
      { solidityImportCompat: true },
    )).toThrow(/compile-time/i);
  });

  it('retains Solidity rejection when the dependency validator depth is exhausted', () => {
    const declarations = Array.from({ length: 270 }, (_, i) =>
      `uint constant c${i} = ${i === 269 ? '1' : `c${i + 1}`};`).join('');
    expect(() => compileString(`contract C { ${declarations} }`,
      { solidityImportCompat: true })).toThrow(/compile-time/i);
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

describe('explicit array-pointer casts', () => {
  it('parses a dynamic array cast before the scalar cast alternative', () => {
    expect(compileString('contract C { uint[] a; uint[] b; function f() public view {'
      + ' uint[] storage c = a; uint[] storage d = b; d = uint[](c); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('delete of a freshly pushed array element', () => {
  const bc = (body: string): string => compileString(
    `contract C { uint[][] data; function f() public { ${body} } }`,
    { solidityImportCompat: true },
  ).bytecode;

  it('retains the push side effect for scalar and nested fresh elements', () => {
    expect(bc('delete data.push(); delete data.push().push();'))
      .toBe(bc('data.push(); data.push().push();'));
  });
});

describe('current-contract-qualified state deletion', () => {
  it('routes delete C.x through the same state reset as delete this.x', () => {
    const bc = (statement: string): string => compileString(
      `contract C { uint x; function f() public { ${statement} } }`,
      { solidityImportCompat: true },
    ).bytecode;
    expect(bc('delete C.x;')).toBe(bc('delete this.x;'));
  });
});

describe('returning helpers with mapping storage parameters', () => {
  it('inlines the mapping pointer while preserving the old-value return', () => {
    expect(compileString(
      'contract C { mapping(uint8 => uint8) a;'
      + ' function setInternal(mapping(uint8 => uint8) storage m, uint8 key, uint8 value)'
      + ' internal returns (uint8) { uint8 oldValue = m[key]; m[key] = value; return oldValue; }'
      + ' function set(uint8 key, uint8 value) public returns (uint8) {'
      + ' return setInternal(a, key, value); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('numeric nested-mapping reads', () => {
  it('flattens tuple-index parser nodes into one multi-key state access', () => {
    expect(compileString(
      'contract C { mapping(uint => mapping(uint => mapping(uint => uint))) map;'
      + ' function f() public { map[13][14][15] = 42; require(map[13][14][15] == 42); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('bare blobhash builtin reference', () => {
  it('discards the uncalled reference while retaining the callable builtin', () => {
    expect(compileString(
      'contract C { function f(uint i) public pure returns (bytes32) { blobhash; return blobhash(i); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('retains the undeclared-builtin diagnostic for an explicit pre-Cancun target', () => {
    expect(() => compileString(
      'contract C { function f() public pure { blobhash; } }'
      + '\n// ====\n// EVMVersion: <=shanghai\n// ----\n',
      { solidityImportCompat: true },
    )).toThrow(/blobhas_|undefined reference|undeclared/i);
  });
});

describe('deleting flattened struct array leaves', () => {
  it('clears the collection and resolves a storage alias slot for Yul resize', () => {
    expect(compileString(
      'contract C { struct S { uint a; uint[] x; } S s; function f() public {'
      + ' s.x.push(42); delete s.x; uint[] storage x = s.x;'
      + ' assembly { sstore(x.slot, 3) } require(s.x.length == 3); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('Yul external function-pointer component reads', () => {
  it('reads selector as a right-aligned uint256 word', () => {
    expect(compileString(
      'contract C { function target() external {} function f() public returns (uint selector) {'
      + ' function() external fp = this.target; assembly { selector := fp.selector } } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('reads the address from an erased fixed foreign pointer alias', () => {
    expect(compileString(
      'contract C { function target() external {} function f() public returns (address value) {'
      + ' function() external fp = C(address(0x1234)).target;'
      + ' assembly { value := fp.address } } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('persists a Yul selector assignment for later high-level reads', () => {
    expect(compileString(
      'contract C { function target() external {} function f(uint32 replacement) public returns (uint32) {'
      + ' function() external fp = this.target; assembly { fp.selector := replacement }'
      + ' return uint32(fp.selector); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('persists a Yul address assignment for later component reads', () => {
    expect(compileString(
      'contract C { function f() public returns (address result) { function() external fp;'
      + ' assembly { fp.address := 0x42 fp.selector := 0x23 } result = fp.address; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('Yul slots through erased storage-pointer aliases', () => {
  it('resolves mapping and struct pointers to their underlying layout slots', () => {
    expect(compileString(
      'contract C { mapping(uint => uint) m0; mapping(uint => uint) m1;'
      + ' struct S { uint value; } S s; function f(uint i) public returns (uint slot) {'
      + ' mapping(uint => uint) storage p = m1; S storage q = s;'
      + ' assembly { switch i case 0 { slot := p.slot } default { sstore(q.slot, 7) slot := q.offset } }'
      + ' } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('Yul assignment to a named storage return slot', () => {
  it('lowers the canonical pointer assignment to a high-level storage return', () => {
    expect(compileString(
      'contract C { struct S { bool flag; } S s;'
      + ' function pointer() internal view returns (S storage result) {'
      + ' assembly { result.slot := s.slot } } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('does not treat a loop-carried slot assignment as definite initialization', () => {
    expect(() => compileString(
      'contract C { struct S { bool flag; } S s;'
      + ' function pointer() internal view returns (S storage result) {'
      + ' assembly { for {} eq(0, 0) { result.slot := s.slot } {} } } }',
      { solidityImportCompat: true },
    )).toThrow(/Unsupported inline assembly/);
  });

  it('recognizes a for-loop initializer as definite named-return initialization', () => {
    expect(compileString(
      'contract C { struct S { bool flag; } S s;'
      + ' function pointer() internal view returns (S storage result) { assembly {'
      + ' for { result.slot := s.slot } iszero(1) {} {} } } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('recognizes exhaustive switch assignment, including reverting arms', () => {
    expect(compileString(
      'contract C { struct S { bool flag; } S s;'
      + ' function pointer(uint choice) internal view returns (S storage result) { assembly {'
      + ' switch choice case 0 { revert(0, 0) } default { result.slot := s.slot } } } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('does not treat a switch without a default as definite initialization', () => {
    expect(() => compileString(
      'contract C { struct S { bool flag; } S s;'
      + ' function pointer(uint choice) internal view returns (S storage result) { assembly {'
      + ' switch choice case 0 { result.slot := s.slot } } } }',
      { solidityImportCompat: true },
    )).toThrow(/Unsupported inline assembly|Expected variable/);
  });
});

describe('Yul initialization of local storage-pointer aliases', () => {
  it('substitutes later high-level field access with the recovered state target', () => {
    expect(compileString(
      'contract C { struct S { bool flag; } S s; function f() public { S storage p;'
      + ' assembly { p.slot := s.slot } p.flag = true; require(s.flag); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('recognizes a loop initializer and an exhaustive switch as definite', () => {
    expect(compileString(
      'contract C { struct S { bool flag; } S s; function f(bool choose) public { S storage p;'
      + ' assembly { for { p.slot := s.slot } iszero(1) {} {} } p.flag = choose; require(s.flag == choose); }'
      + ' function g(bool choose) internal pure { S storage p; assembly {'
      + ' switch choose case 0 { p.slot := s.slot } default { p.slot := s.slot } } p; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('keeps conditionally initialized local pointers unsupported', () => {
    expect(() => compileString(
      'contract C { struct S { bool flag; } S s; function f(bool choose) internal pure { S storage p;'
      + ' assembly { if choose { p.slot := s.slot } } p; } }',
      { solidityImportCompat: true },
    )).toThrow(/Unsupported inline assembly/);
  });
});

describe('Yul transient-state slot layout', () => {
  it('packs transient slots separately and cleans tstore values to the declared type', () => {
    expect(compileString(
      'contract C { uint256 persistent; uint8 transient x; uint16 transient y;'
      + ' function f() public returns (uint slot, uint offset, uint value) { assembly {'
      + ' slot := y.slot offset := y.offset tstore(x.slot, 0xffff) value := tload(x.slot) } } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('dynamic Yul byte index', () => {
  it('extracts a big-endian byte and guards indices outside the 32-byte word', () => {
    expect(compileString(
      'contract C { function f(uint index, uint word) public returns (uint value) {'
      + ' assembly { value := byte(index, word) } } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('assembly-defined named calldata return views', () => {
  it('materializes an implicit bytes calldata return from its assigned offset and length', () => {
    expect(compileString(
      'contract C { function f() public pure returns (bytes calldata value) {'
      + ' assembly { value.offset := 0 value.length := 4 } } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('materializes the view before an explicit tail return', () => {
    expect(compileString(
      'contract C { function f() public pure returns (bytes calldata value) {'
      + ' assembly { value.offset := 0 value.length := 4 } return value; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('keeps view mutation with intermediate high-level reads unsupported', () => {
    expect(() => compileString(
      'contract C { function f() public pure returns (bytes calldata value) {'
      + ' assembly { value.offset := 0 value.length := 4 } uint n = value.length; return value; } }',
      { solidityImportCompat: true },
    )).toThrow(/Unsupported inline assembly/);
  });
});

describe('nested local Yul function inlining', () => {
  it('simplifies nested leaf functions before inlining their parent', () => {
    expect(compileString(
      'contract C { function f() public returns (uint out) { assembly {'
      + ' function outer(a) -> r { function square(x) -> y { y := mul(x, x) } r := square(a) }'
      + ' out := outer(7) } } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('keeps recursive local Yul functions unsupported', () => {
    expect(() => compileString(
      'contract C { function f(uint n) public returns (uint out) { assembly {'
      + ' function recurse(x) -> y { y := recurse(sub(x, 1)) } out := recurse(n) } } }',
      { solidityImportCompat: true },
    )).toThrow(/Unsupported inline assembly/);
  });
});

describe('Yul base slots for flattened state structs', () => {
  it('maps the struct root slot to its first flattened collection leaf', () => {
    expect(compileString(
      'contract C { struct S { uint8[] values; } S s; function f() public { s.values.push();'
      + ' assembly { mstore(0, s.slot) sstore(keccak256(0, 0x20), 257) }'
      + ' require(s.values[0] == 1); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('no-argument pushes on both sides of a struct-field assignment', () => {
  it('preserves right-before-left evaluation while appending both default elements', () => {
    expect(compileString('contract C { struct S { int[] b; } S s;'
      + ' struct T { S s; } T t; function f() public { s.b.push() = t.s.b.push(); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('indexed reads through an array storage-pointer alias', () => {
  it('substitutes the aliased outer-array element before applying the local index', () => {
    expect(compileString('contract C { uint[][] data; function f() public { data.push();'
      + ' uint[] storage row = data[0]; row.push(8);'
      + ' require(row[row.length - 1] == data[0][data[0].length - 1]); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('selfdestruct implies a stateful contract', () => {
  it('creates the master-NFT state layout without an explicit state declaration or forceStateful option', () => {
    const artifact = compileString(
      'contract C { function destroy(address payable recipient) public { selfdestruct(recipient); } }',
      { solidityImportCompat: true },
    );
    expect(artifact.stateLayout).toBeDefined();
  });

  it('still requires Solidity payable-address conversion for the recipient', () => {
    expect(() => compileString(
      'contract C { function destroy(address recipient) public { selfdestruct(recipient); } }',
      { solidityImportCompat: true },
    )).toThrow(/recipient|payable/i);
  });
});

describe('value-bearing deployment implies a stateful parent', () => {
  it('emits parent state layout without an explicit state declaration or forceStateful option', () => {
    const artifact = compileString(
      'contract Child { constructor() payable {} }'
      + ' contract C { function deploy() public payable { new Child{value: 10}(); } }',
      { solidityImportCompat: true },
    );
    expect(artifact.stateLayout).toBeDefined();
  });

  it('still rejects value sent to a nonpayable constructor or from a pure function', () => {
    expect(() => compileString(
      'contract Child { constructor() {} }'
      + ' contract C { function deploy() public payable { new Child{value: 10}(); } }',
      { solidityImportCompat: true },
    )).toThrow(/not payable/i);
    expect(() => compileString(
      'contract Child { constructor() payable {} }'
      + ' contract C { function deploy() public pure { new Child{value: 10}(); } }',
      { solidityImportCompat: true },
    )).toThrow(/pure or view/i);
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

describe('default struct pushes into mapping-held arrays', () => {
  it('resolves the synthesized struct constructor before type checking and code generation', () => {
    expect(compileString(
      'contract C { struct S { uint8 x; } mapping(uint8 => S[]) values;'
      + ' constructor() { values[0].push(); }'
      + ' function f() public { values[1].push(); values[1][0].x = 7;'
      + ' require(values[1][0].x == 7); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('library storage pointers to mappings with typed keys', () => {
  it('inlines void writes and value-returning reads for contract and enum keys', () => {
    expect(compileString(
      'interface I {} enum E { A, B }'
      + ' library L {'
      + ' function setI(mapping(I => uint8) storage m, I k, uint8 v) external { m[k] = v; }'
      + ' function getI(mapping(I => uint8) storage m, I k) external returns (uint8) { return m[k]; }'
      + ' function setE(mapping(E => uint8) storage m, E k, uint8 v) external { m[k] = v; }'
      + ' function getE(mapping(E => uint8) storage m, E k) external returns (uint8) { return m[k]; } }'
      + ' contract C { mapping(I => uint8) im; mapping(E => uint8) em;'
      + ' function f(I ik, E ek, uint8 v) public { L.setI(im, ik, v); L.setE(em, ek, v);'
      + ' require(L.getI(im, ik) == v && L.getE(em, ek) == v); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
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

describe('flattened library struct pointers bound to mapping entries', () => {
  it('propagates the entry key through scalar and dynamic-array fields', () => {
    expect(compileString(
      'library L { struct S { uint a; uint[] b; } function set(S storage s) public {'
      + ' s.a = 7; while (s.b.length < 4) s.b.push(); s.b[3] = 8; } }'
      + ' contract C { mapping(string => L.S) data; function f() public { L.set(data["abc"]);'
      + ' require(data["abc"].a == 7 && data["abc"].b[3] == 8); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('mapping reads inside a try success block', () => {
  it('allocates and stamps the entry slot for the compiled try path', () => {
    expect(compileString(
      'contract C { mapping(uint => uint[]) public m; constructor() { m[0].push(42); }'
      + ' function f() public view { try this.m(0, 0) returns (uint y) {'
      + ' assert(y == m[0][0]); } catch { assert(false); } } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('tuple-declared locals in repeatedly inlined void helpers', () => {
  it('alpha-renames declaration slots and their later tuple reassignments per call site', () => {
    expect(compileString(
      'contract C { uint[] values;'
      + ' function read(uint x) internal pure returns (bool, uint) { return (true, x); }'
      + ' function add(uint x) internal { (bool success, uint value) = read(x);'
      + ' (success, value) = read(value + 1); require(success); values.push(value); }'
      + ' function f() public { add(1); add(2); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('multi-return internal collection helpers', () => {
  it('normalizes to one tail return before returning-state-helper inlining', () => {
    expect(compileString(
      'contract C { mapping(uint => uint) values;'
      + ' function update(uint k) internal returns (bool) {'
      + ' if (values[k] > 1) { delete values[k]; return true; }'
      + ' if (values[k] == 1) { values[k] = 2; return true; }'
      + ' else { values[k] = 1; return false; } }'
      + ' function f(uint k) public returns (bool) { return update(k); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('Solidity fallback signatures', () => {
  const cc = (fallback: string): string => compileString(
    `contract C { ${fallback} }`,
    { solidityImportCompat: true },
  ).contractName;

  it('accepts the empty and forwarding fallback signatures', () => {
    expect(cc('fallback() external {}')).toBe('C');
    expect(cc('fallback(bytes calldata input) external returns (bytes memory output) { return input; }')).toBe('C');
  });

  it('requires forwarding input and output together', () => {
    expect(() => cc('fallback() external returns (bytes memory output) {}')).toThrow(/Fallback function/);
    expect(() => cc('fallback(bytes calldata input) external {}')).toThrow(/Fallback function/);
  });

  it('requires calldata input and one memory bytes output', () => {
    expect(() => cc('fallback(bytes memory input) external returns (bytes memory output) {}'))
      .toThrow(/Fallback function/);
    expect(() => cc('fallback(bytes calldata input) external returns (bytes calldata output) {}'))
      .toThrow(/Fallback function/);
    expect(() => cc('fallback(bytes calldata input) external returns (bytes memory, bytes memory) {}'))
      .toThrow(/Fallback function/);
    expect(() => cc('fallback(bytes calldata input) external returns (uint output) {}'))
      .toThrow(/Fallback function/);
  });
});

describe('unbraced control-flow variable declarations', () => {
  const reject = (body: string): void => {
    expect(() => compileString(
      `contract C { function f(uint x) public pure { ${body} } }`,
      { solidityImportCompat: true },
    )).toThrow(/Variable declarations can only be used inside blocks/);
  };

  it('rejects declarations as bare branch and loop bodies', () => {
    reject('if (x > 0) uint y;');
    reject('if (x > 0) {} else uint y;');
    reject('while (x > 0) uint y;');
    reject('do uint y; while (x > 0);');
    reject('for (uint i = 0; i < x; ++i) uint y;');
  });

  it('retains braced declarations and ordinary unbraced statements', () => {
    expect(compileString(
      'contract C { function f(uint x) public pure { if (x > 0) { uint y; } while (x > 0) break; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('global using-for target types', () => {
  it('accepts a file-level user-defined value type target', () => {
    expect(compileString(
      'type T is uint; function f(T x) pure returns (T) { return x; } using {f} for T global;'
      + ' contract C { function g(T x) public pure returns (T) { return x.f(); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('rejects built-in, aggregate, contract, interface, and wildcard global targets', () => {
    const sources = [
      'using {f} for uint global; function f(uint x) pure returns (uint) { return x; } contract C {}',
      'using L for uint[] global; library L {} contract C {}',
      'using {f} for C global; function f(C x) pure returns (C) { return x; } contract C {}',
      'using {f} for I global; function f(I x) pure returns (I) { return x; } interface I {} contract C {}',
      'using {f} for * global; function f(uint x) pure returns (uint) { return x; } contract C {}',
    ];
    for (const source of sources) {
      expect(() => compileString(source, { solidityImportCompat: true }))
        .toThrow(/Can only use ["']global["'] with user-defined value types/);
    }
  });
});

describe('Solidity index-range slice sources', () => {
  const cc = (source: string): string => compileString(
    `contract C { ${source} }`,
    { solidityImportCompat: true },
  ).contractName;

  it('accepts dynamic calldata arrays, bytes, nested slices, and msg.data', () => {
    expect(cc('function f(uint[] calldata x) external pure { x[1:][1:2]; }')).toBe('C');
    expect(cc('function f(bytes calldata x) external pure returns (bytes memory) { return x[:]; }')).toBe('C');
    expect(cc('bytes b; function f() public { b = msg.data[:]; }')).toBe('C');
  });

  it('rejects memory, storage, and fixed calldata sources', () => {
    expect(() => cc('function f(uint[] memory x) public pure { x[1:2]; }')).toThrow(/dynamic calldata arrays/);
    expect(() => cc('uint[] x; function f() public view { x[1:2]; }')).toThrow(/dynamic calldata arrays/);
    expect(() => cc('function f(uint[2] calldata x) external pure { x[1:2]; }'))
      .toThrow(/dynamic calldata arrays/);
  });

  it('does not restrict the explicit native slice member', () => {
    expect(cc('function f(bytes memory x) public pure returns (bytes memory) { return x.slice(1, 2); }')).toBe('C');
  });
});

describe('required Solidity data locations', () => {
  it('rejects omitted locations on reference-type parameters and returns', () => {
    const invalid = [
      'contract C { function f(uint[] x) internal pure {} }',
      'contract C { function f() private pure returns (bytes x) {} }',
      'contract C { struct S { uint x; } function f(S x) public pure {} }',
    ];
    for (const source of invalid) {
      expect(() => compileString(source, { solidityImportCompat: true }))
        .toThrow(/Data location must be/);
    }
  });

  it('accepts explicit locations and preserves native SolidCash omission', () => {
    expect(compileString(
      'contract C { function f(uint[] memory x) internal pure {}'
      + ' function g() private pure returns (bytes memory x) {} }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
    expect(compileString(
      'contract C { function f(bytes x) internal pure { require(x.length >= 0); } }',
      { solidityImportCompat: false },
    ).contractName).toBe('C');
  });
});

describe('parameter mutability keywords', () => {
  it('rejects constant and immutable on function and modifier parameters or returns', () => {
    const invalid = [
      'contract C { function f(uint constant x) public {} }',
      'contract C { function f() public returns (uint immutable x) {} }',
      'contract C { modifier m(uint constant x) { _; } }',
    ];
    for (const source of invalid) {
      expect(() => compileString(source, { solidityImportCompat: true }))
        .toThrow(/keyword can only be used for state variables/);
    }
  });

  it('retains constant and immutable state declarations', () => {
    expect(compileString(
      'contract C { uint constant X = 1; uint immutable y; constructor() { y = 2; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('ABI coder v1 type restrictions', () => {
  it('rejects structs and nested/dynamic-element arrays at ABI boundaries', () => {
    const invalid = [
      'pragma abicoder v1; contract C { function f(uint[][] calldata x) external {} }',
      'pragma abicoder v1; contract C { constructor(uint[][] memory x) {} }',
      'pragma abicoder v1; struct S { uint x; } contract C { event E(S); }',
      'pragma abicoder v1; contract C { function f() public pure returns (string[][] memory) {} }',
    ];
    for (const source of invalid) {
      expect(() => compileString(source, { solidityImportCompat: true }))
        .toThrow(/only supported in ABI coder v2/);
    }
  });

  it('accepts legacy-supported arrays and all ABI v2 shapes', () => {
    expect(compileString(
      'pragma abicoder v1; contract C { function f(uint[] calldata x) external {} }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
    expect(compileString(
      'pragma abicoder v2; struct S { uint x; } contract C { event E(S);'
      + ' function f(uint[][] calldata x) external {} }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
    expect(compileString(
      'pragma abicoder v1; abstract contract C { constructor(uint[][][] memory x) {} }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('SPDX source-unit identifiers', () => {
  it('rejects multiple line or block-comment identifiers', () => {
    const invalid = [
      '// SPDX-License-Identifier: MIT\n// SPDX-License-Identifier: GPL-3.0\ncontract C {}',
      '/* SPDX-License-Identifier: MIT\\nSPDX-License-Identifier: GPL-3.0 */ contract C {}',
      '/* SPDX-License-Identifier: MIT */ /* SPDX-License-Identifier: MIT */ contract C {}',
    ];
    for (const source of invalid) {
      expect(() => compileString(source, { solidityImportCompat: true }))
        .toThrow(/Multiple SPDX license identifiers/);
    }
  });

  it('accepts one combined identifier and ignores tag-shaped string contents', () => {
    expect(compileString(
      '// SPDX-License-Identifier: MIT OR GPL-3.0\ncontract C {}',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
    expect(compileString(
      'contract C { string constant S = "SPDX-License-Identifier: MIT"; }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
    expect(compileString(
      'contract C { /* SPDX-License-Identifier: MIT */ }\n// ----\n'
      + '// Warning: SPDX-License-Identifier: <SPDX-License>',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('transient state value types', () => {
  it('rejects arrays, mappings, structs, and dynamic bytes/string', () => {
    const invalid = [
      'contract C { uint[] transient x; }',
      'contract C { uint[3] transient x; }',
      'contract C { mapping(uint => uint) transient x; }',
      'struct S { uint x; } contract C { S transient x; }',
      'contract C { bytes transient x; string transient y; }',
    ];
    for (const source of invalid) {
      expect(() => compileString(source, { solidityImportCompat: true }))
        .toThrow(/Transient data location is only supported for value types/);
    }
  });

  it('accepts transient scalar value types', () => {
    expect(compileString(
      'contract C { uint transient x; bytes32 transient y;'
      + ' function f(uint a) public { x = a; y = bytes32(a); require(x == a); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('non-type declarations in type positions', () => {
  it('rejects error, function, and modifier names as types', () => {
    const invalid = [
      'error E(uint); function f(E x) pure returns (uint) {}',
      'error E(); contract C { function f() public pure { E x; } }',
      'contract C { modifier mod() { _; } function f() public { mod x; } }',
      'contract C { function foo() public {} function f() public { foo x; } }',
      'contract C { function f() public {} struct S { f x; } }',
    ];
    for (const source of invalid) {
      expect(() => compileString(source, { solidityImportCompat: true }))
        .toThrow(/Name has to refer to a user-defined type/);
    }
  });

  it('keeps unresolved contract and interface type placeholders valid', () => {
    expect(compileString(
      'interface I { function ping() external; } contract C {'
      + ' function f(I target) public { require(address(target) != address(0)); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('Unicode directional markers in comments and strings', () => {
  it('rejects underflow and unclosed override scopes per token', () => {
    const invalid = [
      'contract C { // close \u202c\n }',
      'contract C { /* open \u202e */ }',
      'contract C { function f() public pure { string memory s = unicode"close \u202c"; } }',
      'contract C { function f() public pure { string memory s = unicode"open \u202e"; } }',
    ];
    for (const source of invalid) {
      expect(() => compileString(source, { solidityImportCompat: true }))
        .toThrow(/direction(?:al)? override/);
    }
  });

  it('accepts balanced nested markers and validates each token independently', () => {
    expect(compileString(
      'contract C { /* balanced \u202e\u202d\u202c\u202c */'
      + ' function f() public pure { string memory s = unicode"balanced \u202a\u202c"; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
    expect(() => compileString(
      'contract C { /* open \u202e */ /* close \u202c */ }',
      { solidityImportCompat: true },
    )).toThrow(/directional override|underflow/);
  });
});

describe('source-unit declaration namespace', () => {
  it('rejects duplicate and cross-kind source declarations', () => {
    const invalid = [
      'enum E { A } contract E {}',
      'enum E { A } enum E { B }',
      'contract C {} function C() {}',
      'uint constant c = 7; function c() returns (uint) {}',
      'contract X {} contract X {}',
      'contract S {} struct S { uint a; }',
      'struct S { uint a; } contract S {}',
      'struct S { uint a; } struct S { uint b; }',
      'type T is uint; type T is int;',
      'event E(uint); error E(uint);',
    ];
    for (const source of invalid) {
      expect(() => compileString(source, { solidityImportCompat: true }))
        .toThrow(/Identifier .* is already declared/);
    }
  });

  it('retains valid free-function and event overload sets', () => {
    expect(compileString(
      'event E(uint); event E(bytes32);'
      + ' function f(uint x) pure returns (uint) { return x; }'
      + ' function f(bytes32 x) pure returns (bytes32) { return x; } contract C {}',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('contract-local declaration namespace', () => {
  it('rejects value/function/event conflicts and duplicate aggregate members', () => {
    const invalid = [
      'contract C { event f(); function f() public {} }',
      'contract C { uint f; function f() public {} }',
      'contract C { function f(uint) public pure {} uint public f; }',
      'contract C { uint constant f = 1; function f() public pure {} }',
      'contract C { modifier f() { _; } function f() public {} }',
      'contract C { struct S { uint x; bool x; } }',
      'contract C { enum E { A, B, A } }',
    ];
    for (const source of invalid) {
      expect(() => compileString(source, { solidityImportCompat: true }))
        .toThrow(/Identifier .* is already declared/);
    }
  });

  it('retains function and event overload sets', () => {
    expect(compileString(
      'contract C { event E(uint); event E(bytes32);'
      + ' function f(uint) public {} function f(bytes32) public {} }',
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

describe('oversized Solidity memory types', () => {
  it('rejects fixed array components whose memory head exceeds 32 bits', () => {
    const invalid = [
      'contract C { function f(bytes32[1263941234127518272] memory x) public pure {} }',
      'contract C { function f(uint[2**30][] memory x) public pure {} }',
      'contract C { function f(uint[2**16][2**16][] memory x) public pure {} }',
      'contract C { function f() public pure { abi.decode("", (bytes1[999999999])); } }',
      'struct T { uint[] x; } struct S { T[222222222222222222222222222] sub; }'
      + ' contract C { function f() public pure returns (S memory s) {} }',
    ];
    for (const source of invalid) {
      expect(() => compileString(source, { solidityImportCompat: true }))
        .toThrow(/Type too large for memory/);
    }
  });

  it('accepts ordinary fixed memory arrays below the limit', () => {
    expect(compileString(
      'contract C { function f(uint[32][32] memory x) public pure returns (uint) { return x[0][0]; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('abi.encodePacked supported source types', () => {
  it('rejects structs, nested arrays, and arrays of dynamic values', () => {
    const invalid = [
      'contract C { struct S { uint x; } function f(S memory s) public pure { abi.encodePacked(s); } }',
      'contract C { function f() public pure { abi.encodePacked([new uint[](2), new uint[](3)]); } }',
      'contract C { struct S { uint x; } function f(S[] memory s) public pure { abi.encodePacked(s); } }',
      'contract C { function f(string[] memory s) public pure { abi.encodePacked(s); } }',
    ];
    for (const source of invalid) {
      expect(() => compileString(source, { solidityImportCompat: true }))
        .toThrow(/Type not supported in packed mode/);
    }
  });

  it('accepts scalar values, bytes/string, and one-dimensional value arrays', () => {
    expect(compileString(
      'contract C { function f(uint[] memory a, bytes memory b, string memory s)'
      + ' public pure returns (bytes memory) { return abi.encodePacked(uint(1), a, b, s); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
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

describe('explicit using-for function references', () => {
  it('rejects non-functions, builtins, and ambiguous overload sets', () => {
    const invalid = [
      'event E(); type T is uint; using {E} for T;',
      'type T is uint; using {keccak256 as +} for T global;',
      'type T is uint; using {Err as +} for T global; error Err(T a, T b);',
      'type T is uint; library L {} using {L as +} for T global;',
      'function f(uint x) pure returns (uint) { return x; }'
      + ' function f(bytes32 x) pure returns (bytes32) { return x; } using {f} for uint;',
    ];
    for (const source of invalid) {
      expect(() => compileString(source, { solidityImportCompat: true }))
        .toThrow(/not a function name or not unique/);
    }
  });

  it('accepts one unique free or qualified library function', () => {
    expect(compileString(
      'function twice(uint x) pure returns (uint) { return x * 2; }'
      + ' library L { function inc(uint x) internal pure returns (uint) { return x + 1; } }'
      + ' using {twice, L.inc} for uint; contract C {'
      + ' function f(uint x) public pure returns (uint) { return x.twice().inc(); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
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

describe('Solidity function visibility spelling', () => {
  it('requires interface functions to be external', () => {
    for (const visibility of ['', ' internal', ' private', ' public']) {
      expect(() => compileString(
        `interface I { function f()${visibility}; }`,
        { solidityImportCompat: true },
      )).toThrow(/interfaces must be declared external/);
    }
  });

  it('accepts external interface functions without changing contract compatibility defaults', () => {
    expect(compileString(
      'interface I { function f() external; }'
      + ' abstract contract C { function g() internal virtual; function h() {} }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('bare override on root declarations', () => {
  it('rejects functions, public getters, modifiers, and fallback without a base declaration', () => {
    const invalid = [
      'contract C { function f() public override {} }',
      'contract C { uint public override value; }',
      'contract C { mapping(address => uint) public override values; }',
      'contract C { modifier m() override { _; } }',
      'contract C { fallback() external override {} }',
    ];
    for (const source of invalid) {
      expect(() => compileString(source, { solidityImportCompat: true }))
        .toThrow(/override specified but does not override anything/);
    }
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
  it('requires an override when direct ancestor and descendant bases expose distinct origins', () => {
    expect(() => compileString(
      'contract A { function f() public pure virtual {} }'
      + ' contract B is A { function f() public pure virtual override {} }'
      + ' contract C is A, B {}',
      { solidityImportCompat: true },
    )).toThrow(/Diamond inheritance conflict/);
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
