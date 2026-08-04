import { describe, it, expect } from 'vitest';
import { compileString, compileStringMulti } from './helpers.js';

// Focused regression guards derived from the Solidity compiler corpus.
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

describe('address.codehash is bytes32', () => {
  it('returns a fixed bytes32 and remains assignable to unbounded bytes', () => {
    expect(compileString(
      'contract C { function f(address a) public view returns(bytes32) { return a.codehash; }'
      + ' function g(address a) public view returns(bytes memory) { return a.codehash; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
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
      'type T is int224; pragma solidity >=0.0.0; contract C { function f() public pure returns (T) {'
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

  it('requires explicit conversion between enums and integers', () => {
    expect(() => compileString(
      'contract C { enum E { A, B } uint value;'
      + ' constructor() { value = E.B; } }',
      compat,
    )).toThrow(/assign|type/i);
    expect(() => compileString(
      'contract C { enum E { A, B }'
      + ' function f(uint x) public pure returns (E) { return x; } }',
      compat,
    )).toThrow(/return type mismatch|type/i);
  });

  it('retains explicit enum/integer conversions and same-enum assignment', () => {
    expect(compileString(
      'contract C { enum E { A, B } E value;'
      + ' constructor() { value = E.B; uint x = uint(E.B); value = E(x); } }',
      compat,
    ).contractName).toBe('C');
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

describe('discarded UDVT conversion function references', () => {
  it('treats T.wrap and T.unwrap as no-op statements when their values are discarded', () => {
    expect(compileString('type MyAddress is address; contract C { function f() public pure {'
      + ' MyAddress.wrap; MyAddress.unwrap; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('contract constant scope and numeric type introspection', () => {
  it('allows contract constants to shadow globals/builtins and types min/max initializers', () => {
    expect(compileString('uint256 constant minGlobal = type(uint256).min; contract C {'
      + ' uint256 constant min = type(uint256).min; uint256 constant max = type(uint256).max; }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('Solidity function visibility version boundary', () => {
  it('requires explicit visibility in current Solidity compatibility mode', () => {
    expect(() => compileString(
      'pragma solidity ^0.8.0; contract C { function f() pure {} }',
      { solidityImportCompat: true },
    )).toThrow(/No visibility specified.*public/i);
  });

  it('retains pre-0.5 and native SolidCash default visibility', () => {
    expect(compileString(
      'pragma solidity ^0.4.26; contract C { function f() pure {} }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
    expect(compileString('contract C { function f() pure {} }').contractName).toBe('C');
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

describe('mixed integer and fixed-point arithmetic', () => {
  it('promotes a typed integer operand to the fixed-point scale', () => {
    expect(compileString('contract C { function f(uint64 x) public pure returns (ufixed128x18) {'
      + ' return x + ufixed128x18(2); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
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

describe('contextual-keyword function calls', () => {
  it('calls a free function named unsafe', () => {
    expect(compileString('function unsafe() pure returns (uint256 x) { assembly { x := 42 } }'
      + ' contract C { constructor() { unsafe(); } function f() public pure { unsafe(); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
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

describe('interface metatype names', () => {
  it('folds type(I).name to the declared interface name', () => {
    expect(compileString('interface I { function f() external; } contract C {'
      + ' function name() public pure returns (string memory) { return type(I).name; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('contract-scoped UDVT shadowing', () => {
  it('allows a contract type to shadow a file-level type declaration', () => {
    expect(compileString('type T is uint; contract C { type T is uint; T value; }',
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

describe('Solidity-only declaration syntax validation', () => {
  const cc = (src: string): string =>
    compileString(src, { solidityImportCompat: true }).contractName;

  it('rejects constant local variables and state data locations', () => {
    expect(() => cc('contract C { uint[] memory values; }'))
      .toThrow(/State variables cannot specify the 'memory' data location/);
    expect(() => cc('contract C { function f() public pure { uint constant x = 1; } }'))
      .toThrow(/constant.*not allowed on local variables/i);
  });

  it('rejects trailing commas in enums and named arguments', () => {
    expect(() => cc('contract C { enum E { A, } }'))
      .toThrow(/Expected enum member after trailing comma/);
    expect(() => cc('contract C { function f(uint x) public pure {}'
      + ' function g() public pure { f({x: 1, }); } }'))
      .toThrow(/Unexpected trailing comma in named arguments/);
  });

  it('rejects unsupported assembly dialects and payable mapping keys', () => {
    expect(() => cc('contract C { function f() public pure { assembly "other" {} } }'))
      .toThrow(/Only "evmasm" assembly is supported/);
    expect(() => cc('contract C { mapping(address payable => uint) values; }'))
      .toThrow(/Mapping key type must be "address"/);
  });

  it('retains native extensions and valid Solidity spellings', () => {
    expect(compileString('contract C { uint[] memory values; enum E { A, }'
      + ' function f() public pure { uint constant x = 1; } }').contractName).toBe('C');
    expect(cc('contract C { mapping(address => uint) values; enum E { A }'
      + ' function f(uint x) public pure {} function g() public pure { f({x: 1}); } }')).toBe('C');
    expect(cc('contract C { function f() public pure { assembly ("a", "b") {} } }')).toBe('C');
  });
});

describe('Solidity pragma validation', () => {
  const cc = (src: string): string =>
    compileString(src, { solidityImportCompat: true }).contractName;

  it('rejects missing, malformed, and unsupported experimental feature names', () => {
    expect(() => cc('pragma experimental; contract C {}'))
      .toThrow(/Experimental feature name is missing/);
    expect(() => cc('pragma experimental unknown; contract C {}'))
      .toThrow(/Unsupported experimental feature name/);
    expect(() => cc('pragma experimental SMTChecker extra; contract C {}'))
      .toThrow(/Unsupported experimental feature name/);
  });

  it('rejects duplicate or conflicting experimental language modes', () => {
    expect(() => cc('pragma experimental __test; pragma experimental __test; contract C {}'))
      .toThrow(/Duplicate experimental feature name/);
    expect(() => cc('pragma experimental __test; pragma experimental solidity; contract C {}'))
      .toThrow(/Only one experimental language mode/);
  });

  it('rejects unknown pragmas while retaining known no-op compiler switches', () => {
    expect(() => cc('pragma thisdoesntexist; contract C {}')).toThrow(/Unknown pragma/);
    expect(cc('pragma experimental SMTChecker; contract C {}')).toBe('C');
    expect(cc('pragma experimental __test; contract C {}')).toBe('C');
    expect(cc('pragma abicoder v2; pragma experimental ABIEncoderV2; contract C {}')).toBe('C');
  });
});

describe('Solidity string literal UTF-8 validation', () => {
  const cc = (src: string): string =>
    compileString(src, { solidityImportCompat: true }).contractName;

  it('requires the unicode prefix for non-ASCII source characters', () => {
    expect(() => cc('contract C { string value = "😃"; }'))
      .toThrow(/use a unicode-prefixed string literal/);
    expect(cc('contract C { string value = unicode"😃"; }')).toBe('C');
    expect(compileString('contract C { string value = "😃"; }').contractName).toBe('C');
  });

  it('rejects malformed UTF-8 formed by hexadecimal byte escapes', () => {
    expect(() => cc(String.raw`contract C { string value = "\xa0\x00"; }`))
      .toThrow(/can not be assigned|invalid UTF-8 sequence/);
    expect(() => cc(String.raw`contract C { function f() public pure returns (string memory) {
      return "\xc1";
    } }`)).toThrow(/Return type mismatch|not castable|invalid UTF-8 sequence/);
  });

  it('accepts valid UTF-8 byte escapes and ordinary ASCII escapes', () => {
    expect(cc(String.raw`contract C { string value = "\xc2\xa0\n"; }`)).toBe('C');
    const escaped = compileString(String.raw`contract C {
      function f() public pure returns (bytes memory) { return "\xc2\xa0"; }
    }`, { solidityImportCompat: true });
    const hex = compileString(`contract C {
      function f() public pure returns (bytes memory) { return hex"c2a0"; }
    }`, { solidityImportCompat: true });
    expect(escaped.bytecode).toBe(hex.bytecode);
  });
});

describe('Solidity address literal validation', () => {
  const cc = (src: string): string =>
    compileString(src, { solidityImportCompat: true }).contractName;

  it('validates checksums on 40-digit address-like literals', () => {
    expect(() => cc('contract C { address value = 0xFA0bFc97E48458494Ccd857e1A85DC91F7F0046E; }'))
      .toThrow(/invalid checksum/);
    expect(() => cc('contract C { address value = 0xfa0bfc97e48458494ccd857e1a85dc91f7f0046e; }'))
      .toThrow(/invalid checksum/);
    expect(cc('contract C { address value = 0xfA0bFc97E48458494Ccd857e1A85DC91F7F0046E; }')).toBe('C');
  });

  it('rejects address-like near-length spellings and oversized address casts', () => {
    expect(() => cc('contract C { address value = 0xA0bFc97E48458494Ccd857e1A85DC91F7F0046E; }'))
      .toThrow(/exactly 40 hex digits/);
    expect(() => cc('contract C { address value = 0xFA0bFc97E48458494Ccd857e1A85DC91F7F0046E0; }'))
      .toThrow(/exactly 40 hex digits/);
    expect(() => cc('contract C { function f() public pure {'
      + ' address(0x11223345567aaaaaaaaaaaaaaaaaaaaaaaaaaaaa0112233445566778899001122); } }'))
      .toThrow(/not castable/);
  });

  it('retains ordinary numeric hex literals and native address-like spellings', () => {
    expect(cc('contract C { uint value = 0x1234;'
      + ' address numeric = 0x1234567890123456789012345678901234567890; }')).toBe('C');
    expect(compileString('contract C { address value ='
      + ' 0xFA0bFc97E48458494Ccd857e1A85DC91F7F0046E; }').contractName).toBe('C');
  });
});

describe('Solidity fixed-bytes literal conversion widths', () => {
  const cc = (src: string): string =>
    compileString(src, { solidityImportCompat: true }).contractName;

  it('rejects oversized hex-string casts while allowing exact and shorter byte strings', () => {
    expect(() => cc('contract C { function f() public pure { bytes2(hex"123456"); } }'))
      .toThrow(/not castable/);
    expect(cc('contract C { bytes2 a = bytes2(hex"12");'
      + ' bytes2 b = bytes2(hex"1234"); }')).toBe('C');
  });

  it('requires non-zero numeric hex literals to have the exact bytesN width', () => {
    expect(() => cc('contract C { function f() public pure { bytes2(0xFF); } }'))
      .toThrow(/not castable/);
    expect(() => cc('contract C { function f() public pure { bytes2(0x10000); } }'))
      .toThrow(/not castable/);
    expect(cc('contract C { bytes2 value = bytes2(0x1234); }')).toBe('C');
  });

  it('rejects non-zero decimal literals and retains zero plus native conversions', () => {
    expect(() => cc('contract C { function f() public pure { bytes2(1); } }'))
      .toThrow(/not castable/);
    expect(cc('contract C { bytes1 a = bytes1(0); bytes2 b = bytes2(0x00000); }')).toBe('C');
    expect(compileString(
      'contract C { bytes2 value = bytes2(1); }',
      { solidityImportCompat: false },
    ).contractName).toBe('C');
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

  it('rejects a genuinely unknown type nested in a struct and retains forward contract types', () => {
    expect(() => compileString(
      'library L { struct Nested { Non y; }'
        + ' function f(function(Nested memory) external) external pure {} }',
      { solidityImportCompat: true },
    )).toThrow(/Unknown contract or interface type 'Non'/);

    expect(compileString(
      'contract C { struct S { Later value; } function f(S memory) internal pure {} } contract Later {}',
      { solidityImportCompat: true },
    ).contractName).toBe('Later');
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
