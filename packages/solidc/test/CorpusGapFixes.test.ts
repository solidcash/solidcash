import { describe, it, expect } from 'vitest';
import { computeErc7201SlotNumber } from '@solidcash/utils';
import { compileString, compileStringMulti } from '../src/index.js';

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
  it('lowers a local byte write via the memory-pointer model (byte-splice; VM-covered in MemoryModelBytes)', () => {
    // A mutable `new bytes(n)` buffer that is byte-indexed + returned converts to a __yulmem pointer, so `d[i] = v`
    // lowers to a single in-place byte splice - no longer byte-identical to the value-copy slice+concat (which the
    // whole-var REASSIGNMENT form below still uses, since a reassignment taints the buffer back to value-copy).
    expect(cc('contract C { function f(uint256 i, bytes1 v) external pure returns (bytes memory) {'
      + ' bytes memory d = new bytes(9); d[i] = v; return d; } }')).toBe('C');
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

describe('address is implicitly castable to address payable (payable is a no-op on BCH; OZ 0.6.x _msgSender)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts `return msg.sender` into an `address payable` return (OZ Context._msgSender)', () => {
    expect(cc('contract C { function _msgSender() internal view returns (address payable) { return msg.sender; }'
      + ' function f() public view returns (address payable) { return _msgSender(); } }')).toBe('C');
  });
  it('accepts assigning a plain address to an address payable variable', () => {
    expect(cc('contract C { function f(address a) public pure returns (address payable) { address payable p = a;'
      + ' return p; } }')).toBe('C');
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
  it('requires a compile-time string literal namespace id (no runtime value)', () => {
    expect(() => cc('contract C { function f(string memory id) external pure returns (uint256) {'
      + ' return erc7201(id); } }')).toThrow(/compile-time string literal/);
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
  it('still REJECTS a REACHABLE internal msg.data reader (not silently pruned)', () => {
    // Called from a public function, so live: it must NOT be pruned - the error surfaces (a wrong prune would be
    // a silent miscompile). msg.data inside a live subroutine remains unsupported (a separate threading fix).
    expect(() => compileString('contract C { function _live() internal view returns (bytes memory) { return msg.data; }'
      + ' function f() public returns (bytes memory) { return _live(); } }', { solidityImportCompat: true }))
      .toThrow(/msg.data is only available at an entry point/);
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
  it('mapping element m[k].x() is byte-identical to the hoist', () => {
    const S = 'struct S { ' + FP + ' x; } mapping(uint => S) m;';
    const direct = `contract C { ${S} ${H} function f() public returns (uint) { m[0].x = h; return m[0].x(); } }`;
    const hoist = `contract C { ${S} ${H} function f() public returns (uint) {`
      + ` m[0].x = h; ${FP} fp = m[0].x; return fp(); } }`;
    expect(bc(direct)).toBe(bc(hoist));
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
    expect(() => compileString(src, { solidityImportCompat: true, sortedMappingsAll: false })).not.toThrow();
  });
  it('same under C2-default (the -1 slot no longer trips the sorted read)', () => {
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  });
});

describe('C2 (sorted) mapping write in a runtime loop: fixed-bound unrolls, dynamic diff-key insert loop', () => {
  // A C2 write inside a DYNAMIC loop is a per-iteration sorted-linked-list INSERT (co-spend the bracketing
  // predecessor, mint one NEW node; the SDK derives the evolving list). Fixed-bound loops are unrolled to static
  // writes before codegen; the dynamic single-varying-key case now compiles via emitSortedInsertLoopBody (never
  // crashes at "Block slot not found: entry[0]", never silently degrades to the omittable entry model).
  const mk = (loop: string): string => 'contract C() { mapping(int => bigint) m;'
    + ` function f(int[] ks, int v, pubkey pk, sig s) { require(checkSig(s, pk)); ${loop} } }`;
  it('unrolls a fixed-bound C2 loop', () => {
    expect(() => compileString(mk('for (int i = 0; i < 3; i++) { m[ks[i]] = v; }'),
      { sortedMappingsAll: true, forceStateful: true })).not.toThrow();
  });
  it('compiles a dynamic diff-key C2 insert loop (per-iteration sorted insert, not fail-closed)', () => {
    const art = compileString(mk('for (int i = 0; i < ks.length; i++) { m[ks[i]] = v; }'),
      { sortedMappingsAll: true, forceStateful: true });
    expect(art.abi.find((f) => f.name === 'f')?.sortedInsertLoops).toContain('m');
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
