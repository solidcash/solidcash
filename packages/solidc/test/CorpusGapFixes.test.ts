import { describe, it, expect } from 'vitest';
import { compileString } from '../src/index.js';

// Compile-level regression guards for solc-corpus gap fixes (see examples/solidity-corpus/PROGRESS.md).

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

  it('still rejects two bounded ints of different width', () => {
    expect(() => compileString(`contract C() {
      function f(uint8 a, uint16 b) returns (uint16) { return a | b; }
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
