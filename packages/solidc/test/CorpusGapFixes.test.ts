import { describe, it, expect } from 'vitest';
import { compileString } from '../src/index.js';

// Compile-level regression guards for solc-corpus gap fixes (see examples/solidity-corpus/PROGRESS.md).

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
  it('does not crash when a function-type member is an unresolvable name (falls back to an address handle)', () => {
    // IFoo is undeclared; the member must not reach FunctionType.toString as undefined.
    expect(ok('contract C { function(IFoo memory) internal fp; function f() public { require(true); } }')).toBe('C');
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

describe('EVM storage-layout specifier tolerated (contract C layout at expr)', () => {
  // `contract C [is ..] layout at <slot>` sets an EVM storage base slot - meaningless on the UTXO model, so the
  // clause is dropped under solidityImportCompat and the contract compiles as if it were absent.
  it('drops the layout clause (with and without inheritance)', () => {
    expect(compileString('contract C layout at 42 { function f(uint256 e) { require(e == e); } }',
      { solidityImportCompat: true }).contractName).toBe('C');
    expect(compileString(
      'contract A {} contract C is A layout at 1234 + 4567 { uint256 x; function f(uint256 e) { x = e; } }',
      { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('compiles identically to the contract without the clause', () => {
    const withLayout = compileString('contract C layout at 99 { uint256 x; function f(uint256 e) { x = e; } }',
      { solidityImportCompat: true }).bytecode;
    const without = compileString('contract C { uint256 x; function f(uint256 e) { x = e; } }',
      { solidityImportCompat: true }).bytecode;
    expect(withLayout).toBe(without);
  });

  it('is compat-only: native solidcash still rejects the clause', () => {
    expect(() => compileString('contract C layout at 42 { function f() {} }', {})).toThrow();
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
      + ' function f(uint256 i, bytes1 v) external { data = data[0:i] + v + data[i+1:data.length]; require(true); } }',
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
  it('is byte-identical to the hand-written local slice+concat', () => {
    const sugar = compileString('contract C { function f(uint256 i, bytes1 v) external pure returns (bytes memory) {'
      + ' bytes memory d = new bytes(9); d[i] = v; return d; } }', { solidityImportCompat: true });
    const hand = compileString('contract C { function f(uint256 i, bytes1 v) external pure returns (bytes memory) {'
      + ' bytes memory d = new bytes(9); d = d[0:i] + v + d[i+1:d.length]; return d; } }', { solidityImportCompat: true });
    expect(sugar.bytecode).toBe(hand.bytecode);
  });
});

describe('erc7201 not supported: function -> uint256(sha256) alias + layout clause ignored', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('aliases erc7201(id) to a uint256 storage slot (usable in uint256 contexts)', () => {
    expect(cc('contract C { function f(string memory id) external pure returns (uint256) {'
      + ' return erc7201(id); } }')).toBe('C');
    expect(cc('contract C { uint256 constant X = erc7201("openzeppelin.storage.Y");'
      + ' function f() external pure returns (uint256) { return X; } }')).toBe('C');
  });
  it('is byte-identical to uint256(sha256(id))', () => {
    const a = compileString('contract C { function f() external pure returns (uint256) { return erc7201("ns"); } }',
      { solidityImportCompat: true });
    const b = compileString('contract C { function f() external pure returns (uint256) { return uint256(sha256("ns")); } }',
      { solidityImportCompat: true });
    expect(a.bytecode).toBe(b.bytecode);
  });
  it('ignores a `contract C layout at erc7201(...)` storage-layout clause', () => {
    expect(cc('contract C layout at erc7201("x") { uint256 n; function f() external { this.n = 1; } }')).toBe('C');
  });
});

describe('erc7201 as a Yul builtin -> sha256 (reuses the erc7201 alias)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('lowers a Yul erc7201(id) call to sha256(id)', () => {
    expect(cc('contract C { function f() external pure returns (bytes32) {'
      + ' bytes32 s; assembly { s := erc7201("example.main") } return s; } }')).toBe('C');
  });
});

describe('payable(x) cast on a bytes source (payable is a no-op on BCH)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts payable(this) (this is the contract bytes identity)', () => {
    expect(cc('contract C { function f() external view returns (address) { return payable(this); } }')).toBe('C');
  });
  it('accepts payable(this).balance', () => {
    expect(cc('contract C { function f() external view returns (uint256) { return payable(this).balance; } }')).toBe('C');
  });
  it('accepts payable(bytes20Value)', () => {
    expect(cc('contract C { function f(bytes20 b) external pure returns (address) { return payable(b); } }')).toBe('C');
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
      + ' function f(uint256 i, bytes1 v) external { data = data[0:i] + (data[i] | v) + data[i+1:data.length]; require(true); } }',
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
      + ' function g(uint256[] storage s) external returns (uint) { return s.length; }'
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
  it('still rejects an unsupported 3-level receiver (member-key-member) as a clean parse error', () => {
    expect(() => compileString('contract C { struct In { uint[] b; } struct Ou { In[] s; } Ou t; '
      + 'function f() external { t.s[0].b.push(1); } }', { solidityImportCompat: true }))
      .toThrow(/Unsupported .push\/.pop\/.delete receiver/);
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
    expect(cc('contract C { int256 x; fallback(bytes calldata i) virtual external { x = 1; } }')).toBe('C');
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
  it('accepts explicit int<->uint casts of every width', () => {
    for (const [from, to] of [['uint256', 'int256'], ['int256', 'uint256'], ['uint16', 'int8'], ['int64', 'uint128']]) {
      expect(cc(`contract C { function f(${from} x) external pure returns (${to}) { return ${to}(x); } }`)).toBe('C');
    }
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

describe('inherited modifier override + event/error overload do not falsely collide', () => {
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
  it('keeps same-name parent+child errors when signatures differ (error overloading)', () => {
    expect(cc('contract A { error E(); } contract B is A { error E(uint256 n);'
      + ' function f(bool b) external { if (b) revert E(); revert E(1); } }')).toBe('B');
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
  it('still rejects a block local that shadows a live outer local (codegen slots by name)', () => {
    expect(() => cc('contract C { function f() external { uint b = 1; { uint b = 2; require(b == 2); } require(b == 1); } }'))
      .toThrow(/Redefinition/);
  });
});

describe('msg.data reachability', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts msg.data at an external entry point', () => {
    expect(cc('contract C { function f() external pure returns (bytes memory) { return msg.data; } }')).toBe('C');
  });
  it('rejects msg.data inside a self-external-called function instead of crashing', () => {
    // this.g(...) lowers g to an internal subroutine where _redeemPushSize / OP_ACTIVEBYTECODE are unavailable.
    const src = 'contract C { function g(uint256 x) external pure returns (bytes memory) { x; return msg.data; }'
      + ' function f() external view returns (bytes memory) { return this.g(1); } }';
    expect(() => cc(src)).toThrow(/msg\.data is only available at an entry point/);
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
  it('rejects assignment-as-expression on a state variable instead of crashing', () => {
    expect(() => compileString('contract C { bool b; function f() external { if ((b = false) && b) {} require(true); } }',
      { solidityImportCompat: true })).toThrow(/assignment-as-expression on state variable/);
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
  it('rejects msg.sig in an internal function instead of emitting an undefined push', () => {
    const src = 'contract C { function f() external pure { g(); } function g() internal pure { require(msg.sig == 0x00000000); } }';
    expect(() => compileString(src, { solidityImportCompat: true })).toThrow(/msg\.sig is only available in a public/);
  });
  it('rejects a statement call on a deploy-into-state contract variable instead of crashing', () => {
    // `c = new C(); c.f()` on a stored deployed contract (aggregated-contract cluster) has no resolvable
    // callee identifier as a statement call.
    const src = 'contract C { event e(); function f() public { emit e(); } }'
      + ' contract D { C c; constructor() { c = new C(); c.f(); } function g() public { require(true); } }';
    expect(() => compileString(src, { solidityImportCompat: true })).toThrow(/Method calls are only supported/);
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
  // to the explicit `m[hex"666f6f00..00"]` form. Native mode stays strict (no implicit coercion).
  it('coerces a string-literal key on write, read, and delete', () => {
    expect(cc('contract C { mapping(bytes16 => uint) m;'
      + ' function f() public { m["foo"] = 2; require(m["foo"] == 2); delete m["foo"]; } }')).toBe('C');
  });
  it('coerces an empty-string key against a bytes1 key type', () => {
    expect(cc('contract C { mapping(bytes1 => uint) m; function f() public { m[""] = 2; require(m[""] == 2); } }'))
      .toBe('C');
  });
  it('still rejects the implicit string->bytesN key in native (strict) mode', () => {
    expect(() => compileString('pragma solidcash >=0.8.0; contract C() { mapping(bytes16 => int) m;'
      + ' function f() { this.m["foo"] = 2; } }')).toThrow();
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
