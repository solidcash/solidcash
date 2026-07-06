import { describe, it, expect } from 'vitest';
import { compileString } from '../src/index.js';

// Structs, mappings, and nested lvalue writes: field/element writes, storage pointers, and delete.

describe('B7: a returning function that reads a mapping must not crash', () => {
  it('compiles a function that returns a mapping read', () => {
    const artifact = compileString(`
      contract C() {
        int n;
        mapping(int => int) m;
        function get(int k) returns (int) { return this.m[k]; }
        function go() { this.n = this.n + 1; }
      }`);
    expect(artifact.abi.find((f) => f.name === 'get')).toBeDefined();
  });

  it('compiles a returning function that reads a struct field from a mapping', () => {
    const artifact = compileString(`
      struct S { int a; int b; }
      contract C() {
        int n;
        mapping(int => S) m;
        function getA(int k) returns (int) { return this.m[k].a; }
        function go() { this.n = this.n + 1; }
      }`);
    expect(artifact.abi.find((f) => f.name === 'getA')).toBeDefined();
  });
});

describe('SBE-9: imported enum/struct types + hex-literal-as-int + implicit named return', () => {
  it('resolves an enum-typed state var imported from another file', () => {
    const resolver = (p: string): { source: string; id: string } | undefined => (p.includes('Decl')
      ? { source: 'enum Status { Pending, Shipped }', id: 'Decl' } : undefined);
    const a = compileString('pragma solidity ^0.8.26;\nimport "./Decl.sol";\ncontract Enum { Status public status; }',
      { solidityImportCompat: true, importResolver: resolver });
    expect(a.contractName).toBe('Enum');
  });

  it('treats a hex number literal as a big-endian int when compared with an int (compat)', () => {
    const a = compileString('pragma solidity ^0.8.26;\ncontract C { function f(uint256 x) external pure returns (bool) { return x >= 0x100000000000000000000000000000000; } }',
      { solidityImportCompat: true });
    expect(a.contractName).toBe('C');
  });

  it('keeps int-vs-hex-literal a type error in native SolidCash (no flag)', () => {
    expect(() => compileString('contract C() { function f() { require(tx.version == 0x02); } }')).toThrow();
  });

  // Solidity hex `0x..` is a context-driven number literal. Under compat it coerces to int in every integer
  // context (not just comparisons); natively `0x..` stays bytes, so each native form is a type error.
  describe('hex literals are Solidity-compatible numbers in integer contexts (compat)', () => {
    const intContexts: [string, string][] = [
      ['local var init', 'contract C() { function f() { int x = 0xff; require(x == 255); } }'],
      ['state assign', 'contract C() { int n; function f(sig s, pubkey pk) { require(checkSig(s, pk)); this.n = 0xff; } }'],
      ['return value', 'contract C() { function f() returns (int) { return 0xff; } }'],
      ['function argument', 'contract C() { function g(int v) internal returns (bool) { return v >= 0; } function f() { require(g(0xff)); } }'],
      ['mapping value', 'contract C() { mapping(int => int) m; function f(sig s, pubkey pk) { require(checkSig(s, pk)); m[1] = 0xff; } }'],
      ['constant', 'contract C() { int constant MASK = 0xff; function f() { require(MASK == 255); } }'],
    ];

    it.each(intContexts)('coerces hex -> int under compat: %s', (_label, src) => {
      expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
    });

    it.each(intContexts)('keeps it a type error natively: %s', (_label, src) => {
      expect(() => compileString(src)).toThrow();
    });

    it('leaves a bytesN target as a bytes literal in both modes (no coercion)', () => {
      const src = 'contract C() { function f() { bytes2 b = 0x1234; require(b == 0x1234); } }';
      expect(compileString(src).contractName).toBe('C');
      expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
    });
  });

  it('returns named returns implicitly when there is no explicit return', () => {
    const a = compileString('contract C() { function f(int x, sig s, pubkey pk) returns (int r) { r = x + 1; require(checkSig(s, pk)); } }');
    expect(a.contractName).toBe('C');
  });
});

describe('SBE-10: storage-pointer locals + block.timestamp + stmt-form interface calls', () => {
  it('aliases a mapping-struct storage pointer for read and write', () => {
    const a = compileString(`contract C() {
      struct S { int a; bool b; }
      mapping(int => S) m;
      function f(int k, int v) { S storage s = m[k]; require(s.a >= 0); s.a += v; s.b = true; }
    }`);
    expect(a.contractName).toBe('C');
  });

  it('aliases a struct-array storage pointer', () => {
    const a = compileString(`contract C() {
      struct T { bigint x; bool done; }
      T[] arr;
      function f(int i) { T storage t = arr[i]; require(!t.done); t.x = 5; }
    }`);
    expect(a.contractName).toBe('C');
  });

  it('maps block.timestamp to tx.locktime under solidityImportCompat', () => {
    // private `t`: a public state var synthesizes a getter that triggers subroutine extraction, hex-encoding
    // OP_TXLOCKTIME. The mapping under test is visibility-independent.
    const a = compileString(`pragma solidity ^0.8.26;
      contract C { uint256 private t; function f(uint256 startAt) external { require(startAt >= block.timestamp); t = startAt; } }`,
    { solidityImportCompat: true });
    expect(a.bytecode).toContain('OP_TXLOCKTIME');
  });

  it('routes a statement-form interface call on a constructor-param var (2-arg .transfer is not satoshi send)', () => {
    const a = compileString(`interface IERC20 { function transfer(address t, uint256 a) external returns (bool); }
      contract C(IERC20 token) { uint256 n; function f(address to, uint256 amt) external { token.transfer(to, amt); n = 1; } }`,
    { solidityImportCompat: true });
    expect(a.contractName).toBe('C');
  });
});

// Raw `mapping(K=>V) storage p = m;` local pointer (not struct-wrapped): a whole-mapping alias, so `p[k]...`
// rewrites to `m[k]...` and passing `p` substitutes `m`. Mirrors the storage-pointer parameter, without a call.
describe('raw mapping storage pointer local (mapping(K=>V) storage p = m)', () => {
  const P = 'contract C(){mapping(uint=>uint) m;function f()external{';
  it('is byte-identical to direct mapping access (sound by reduction)', () => {
    const ptr = compileString(`${P}mapping(uint=>uint) storage p=m;p[0]=1;require(p[0]==1);}}`, { solidityImportCompat: true });
    const direct = compileString(`${P}m[0]=1;require(m[0]==1);}}`, { solidityImportCompat: true });
    expect(ptr.bytecode).toBe(direct.bytecode);
  });
  it('passes the pointer to a mapping-storage-param helper', () => {
    const a = compileString('contract C(){mapping(uint=>uint) m;function h(mapping(uint=>uint) storage a)internal{a[0]=1;}'
      + `${'function f()external{'}mapping(uint=>uint) storage p=m;h(p);require(m[0]==1);}}`, { solidityImportCompat: true });
    expect(a.contractName).toBe('C');
  });
});

// A function returning a `mapping storage` pointer is inlined (no runtime value), then the pointer local is
// lowered by LowerMappingStorageAlias: `mapping storage m = get()` where get inlines to a bare mapping or a
// ternary `c ? a : b`. Each `m[k]` use becomes the underlying access / a branch / a ternary. Sound by reduction.
describe('returns (mapping storage) - pointer-returning function + conditional alias', () => {
  const CH = 'library L { function ch(mapping(uint256=>uint256) storage a, mapping(uint256=>uint256) storage b, bool c)'
    + ' internal view returns (mapping(uint256=>uint256) storage) { return c ? a : b; } }';
  it('unconditional return: `get(){return mp;}` local pointer is byte-identical to direct access', () => {
    const sugar = compileString('contract C { mapping(uint256=>uint256) mp;'
      + ' function get() internal view returns (mapping(uint256=>uint256) storage) { return mp; }'
      + ' function f() external { mapping(uint256=>uint256) storage p = get(); p[0] = 1; require(mp[0]==1); } }',
    { solidityImportCompat: true });
    const direct = compileString('contract C { mapping(uint256=>uint256) mp;'
      + ' function f() external { mp[0] = 1; require(mp[0]==1); } }', { solidityImportCompat: true });
    expect(sugar.bytecode).toBe(direct.bytecode);
  });
  it('conditional local pointer m = c?a:b: reads/writes are byte-identical to the branch/ternary form', () => {
    const sugar = compileString(`${CH} contract C { mapping(uint256=>uint256) a; mapping(uint256=>uint256) b; bigint r;`
      + ' function f(bool c, uint256 k, uint256 v) external { mapping(uint256=>uint256) storage m = L.ch(a,b,c);'
      + ' this.r = m[k]; m[k] = v; require(true); } }', { solidityImportCompat: true });
    const hand = compileString('contract C { mapping(uint256=>uint256) a; mapping(uint256=>uint256) b; bigint r;'
      + ' function f(bool c, uint256 k, uint256 v) external { bool __c = c; this.r = __c ? a[k] : b[k];'
      + ' if (__c) { a[k] = v; } else { b[k] = v; } require(true); } }', { solidityImportCompat: true });
    expect(sugar.bytecode).toBe(hand.bytecode);
  });
  it('direct-indexed call result L.ch(a,b,c)[k] is byte-identical to c ? a[k] : b[k]', () => {
    const sugar = compileString(`${CH} contract C { mapping(uint256=>uint256) a; mapping(uint256=>uint256) b;`
      + ' function g(bool c, uint256 k) external view returns (uint256) { return L.ch(a,b,c)[k]; } }',
    { solidityImportCompat: true });
    const hand = compileString('contract C { mapping(uint256=>uint256) a; mapping(uint256=>uint256) b;'
      + ' function g(bool c, uint256 k) external view returns (uint256) { return c ? a[k] : b[k]; } }',
    { solidityImportCompat: true });
    expect(sugar.bytecode).toBe(hand.bytecode);
  });
});

// A function returning a REASSIGNED `mapping storage` pointer (`returns (mapping storage r){ r=a; r[1]=42; r=b;
// r[1]=84; }`) is resolved by InlineMappingReturnFunctions into its ordered side effects (each `r[k]=v` bound to
// whichever mapping r aliases at that point) + the mapping it finally aliases, and inlined at call sites. Sound by
// reduction: byte-identical to the hand-resolved side effects. Also covers `f()[k]=v` (a call-indexed write,
// desugared to a `mapping storage __t = f(); __t[k]=v` local at parse).
describe('returns (reassigned mapping storage) - dataflow-resolved + inlined', () => {
  const F = 'mapping(uint256=>uint256) a; mapping(uint256=>uint256) b;'
    + ' function f() internal returns (mapping(uint256=>uint256) storage r) { r=a; r[1]=42; r=b; r[1]=84; }';
  it('`mapping storage m = f(); m[k]=v` is byte-identical to the hand-resolved side effects', () => {
    const sugar = compileString(`contract C { ${F} function h() external { mapping(uint256=>uint256) storage m = f();`
      + ' m[2]=17; require(true); } }', { solidityImportCompat: true });
    const hand = compileString('contract C { mapping(uint256=>uint256) a; mapping(uint256=>uint256) b;'
      + ' function h() external { a[1]=42; b[1]=84; b[2]=17; require(true); } }', { solidityImportCompat: true });
    expect(sugar.bytecode).toBe(hand.bytecode);
  });
  it('`f()[k]=v` (call-indexed write) is byte-identical to the hand-resolved side effects', () => {
    const sugar = compileString(`contract C { ${F} function g() external { f()[2]=21; require(true); } }`,
      { solidityImportCompat: true });
    const hand = compileString('contract C { mapping(uint256=>uint256) a; mapping(uint256=>uint256) b;'
      + ' function g() external { a[1]=42; b[1]=84; b[2]=21; require(true); } }', { solidityImportCompat: true });
    expect(sugar.bytecode).toBe(hand.bytecode);
  });
  it('resolves a pointer reassigned to a conditional (both g() and h() call sites)', () => {
    const a = compileString(`contract test { mapping(uint8 => uint8) a; mapping(uint8 => uint8) b;`
      + ' function f() internal returns (mapping(uint8 => uint8) storage r) { r = a; r[1] = 42; r = b; r[1] = 84; }'
      + ' function g() public returns (uint8, uint8) { f()[2] = 21; return (a[1], b[2]); }'
      + ' function h() public returns (uint8, uint8) { mapping(uint8 => uint8) storage m = f(); m[2] = 17;'
      + ' return (a[1], b[2]); } }', { solidityImportCompat: true });
    expect(a.contractName).toBe('test');
  });
});

describe('SBE-11: local struct member assignment (desugars to a struct rebuild)', () => {
  it('assigns a field of a local struct', () => {
    const a = compileString('contract C() { struct S { int a; bool b; } int n; function f(int v) { S memory s; s.a = v; this.n = s.a; } }');
    expect(a.contractName).toBe('C');
  });
  it('supports compound assignment on a local struct field', () => {
    const a = compileString('contract C() { struct S { int a; bool b; } int n; function f(int v) { S memory s = S(1, false); s.a += v; this.n = s.a; } }');
    expect(a.contractName).toBe('C');
  });
});

describe('mapping reads in the constructor (genesis = empty mapping)', () => {
  it('allows the read-before-write uniqueness pattern (read resolves to the genesis default)', () => {
    // The MultiSig `require(!isOwner[a])` pattern: at genesis the mapping is empty, so the read is false.
    expect(compileString('contract C(bytes20 a) { mapping(bytes20 => bool) isOwner; int n;'
      + ' constructor() { require(!this.isOwner[a]); this.isOwner[a] = true; this.n = 1; } }').contractName).toBe('C');
  });

  it('allows reading an uninitialized mapping element into a local in the constructor', () => {
    expect(compileString('contract C(int k) { mapping(int=>int) m; int n;'
      + ' constructor() { int v = this.m[k]; this.n = v; } }').contractName).toBe('C');
  });

  it('still blocks mapping deletes in the constructor', () => {
    expect(() => compileString('contract C(int k) { mapping(int=>int) m; int n;'
      + ' constructor() { delete this.m[k]; this.n = 1; } }')).toThrow();
  });
});

describe('storage-pointer parameters and constant-index state access', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;

  it('inlines a void mapping-storage-pointer mutator (m[k] = v)', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { mapping(address => uint256) bal;'
      + ' function f(address k, uint256 v) public { _set(bal, k, v); }'
      + ' function _set(mapping(address => uint256) storage m, address k, uint256 v) internal { m[k] = v; } }')).toBe('C');
  });

  it('inlines array and struct storage-pointer params (DataLocations _f shape)', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { struct S { uint256 foo; } uint256[] arr; mapping(uint256 => S) ms;'
      + ' function f() public { _f(arr, ms[1]); }'
      + ' function _f(uint256[] storage a, S storage s) internal {} }')).toBe('C');
  });

  it('resolves bare state mapping access with a constant key (m[1].foo)', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { struct S { uint256 foo; } mapping(uint256 => S) m;'
      + ' function f() public returns (uint256) { return m[1].foo; } }')).toBe('C');
  });

  it('aliases and reads a storage pointer bound to a constant-key mapping element', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { struct S { uint256 foo; } mapping(uint256 => S) m;'
      + ' function f() public returns (uint256) { S storage s = m[1]; return s.foo; } }')).toBe('C');
  });

  it('still treats a real multi-return tuple index as a tuple', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { function f() public pure returns (uint256) { (uint256 a, uint256 b) = g(); return a + b; }'
      + ' function g() internal pure returns (uint256, uint256) { return (1, 2); } }')).toBe('C');
  });

  it('synthesizes a default empty-array return for an empty-bodied array-returning function', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { function g(uint256[] memory a) public returns (uint256[] memory) {} }')).toBe('C');
  });
});

describe('mapping-bearing struct state variables (flattened)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;

  it('compiles a struct with a mapping field used as state', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { struct Holder { mapping(address => uint256) bal; } Holder h;'
      + ' function f() public { require(true); } }')).toBe('C');
  });

  it('reads a mapping struct field (h.bal[k])', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { struct Holder { mapping(address => uint256) bal; } Holder h;'
      + ' function g(address k) public returns (uint256) { return h.bal[k]; } }')).toBe('C');
  });

  it('writes a mapping struct field (h.bal[k] = v) and compound (+=)', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { struct Holder { mapping(address => uint256) bal; } Holder h;'
      + ' function s(address k, uint256 v) public { h.bal[k] = v; h.bal[k] += v; } }')).toBe('C');
  });

  it('flattens multiple mapping fields into independent collections (set/get)', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { struct M { mapping(address => uint256) bal; mapping(address => bool) seen; } M m;'
      + ' function set(address k, uint256 v) public { m.bal[k] = v; m.seen[k] = true; }'
      + ' function get(address k) public returns (uint256) { if (!m.seen[k]) { return 0; } return m.bal[k]; } }')).toBe('C');
  });

  it('exposes flattened mapping fields as named collections in the artifact', () => {
    const art = compileString('pragma solidity ^0.8.0; contract C { struct M { mapping(address => uint256) bal; } M m;'
      + ' function s(address k, uint256 v) public { m.bal[k] = v; } }', { solidityImportCompat: true });
    const names = (art.stateLayout?.collections ?? []).map((c) => c.name);
    expect(names).toContain('m__bal');
  });

  it('still rejects an unsupported (non-mapping) struct field type', () => {
    expect(() => cc('pragma solidity ^0.8.0; contract C { struct Bad { function() external f; } Bad b;'
      + ' function f() public { require(true); } }')).toThrow();
  });

  it('allows field names that share a prefix with a dotted op (values, pushCount, lengths)', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { struct B { uint256 values; uint256 pushCount; uint256 lengths; } B box;'
      + ' function g() public returns (uint256) { return box.values + box.pushCount + box.lengths; } }')).toBe('C');
  });

  it('supports a mapping struct field named `values` (IterableMapping shape)', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { struct Map { mapping(address => uint256) values; } Map map;'
      + ' function set(address k, uint256 v) public { map.values[k] = v; }'
      + ' function get(address k) public returns (uint256) { return map.values[k]; } }')).toBe('C');
  });
});

describe('mapping-bearing struct array fields', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  const base = 'pragma solidity ^0.8.0; contract C { struct Map { address[] keys; mapping(address => uint256) vals; } Map m;';

  it('pushes to a struct array field (m.keys.push)', () => {
    expect(cc(`${base} function p(address k) public { m.keys.push(k); } }`)).toBe('C');
  });

  it('pops a struct array field (m.keys.pop)', () => {
    expect(cc(`${base} function pp() public { m.keys.pop(); } }`)).toBe('C');
  });

  it('reads length and index of a struct array field', () => {
    expect(cc(`${base} function n() public returns (uint256) { return m.keys.length; }`
      + ' function g(uint256 i) public returns (address) { return m.keys[i]; } }')).toBe('C');
  });

  it('writes a struct array field element (m.keys[i] = v)', () => {
    expect(cc(`${base} function s(uint256 i, address v) public { m.keys[i] = v; } }`)).toBe('C');
  });
});

describe('abi.decode with array and struct types in the type list', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;

  it('accepts an array type (uint256[]) in the abi.decode type list', () => {
    expect(cc('contract C { function f(bytes data) returns (uint256 x, uint256[] arr) {'
      + ' (x, arr) = abi.decode(data, (uint256, uint256[])); } }')).toBe('C');
  });

  it('accepts a struct type in the abi.decode type list', () => {
    expect(cc('struct S { uint256 a; } contract C {'
      + ' function f(bytes data) returns (uint256 x, uint256[] arr, S s) {'
      + ' (x, arr, s) = abi.decode(data, (uint256, uint256[], S)); } }')).toBe('C');
  });
});

// `.value` as a writable struct field: `.value` lexes as one DotValue token (for msg.value / {value:} call
// options), so it was rejected in lvalue member position (reads already worked). A new `lvMember` grammar
// rule accepts it. Common in OZ StorageSlot (`AddressSlot.value`), ERC checkpoints, etc.
describe('`.value` as a writable struct field name', () => {
  it('compiles `s.value = x` / `s.value += x` (assignment + compound)', () => {
    const a = compileString(
      'contract C { struct S { uint256 value; } function f(uint256 x) public pure returns (uint256) {'
      + ' S memory s; s.value = x; s.value += 1; return s.value; } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('C');
  });
});

// `delete X.field` (reset a struct field to its default) resets it via the same struct-rebuild path as
// `X.field = <default>`. Only `delete X`, `delete X[k]` were supported before.
describe('delete on a struct field (delete X.field)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('deletes a scalar struct field', () => {
    expect(cc('contract C { struct S { uint x; bytes32 h; }'
      + ' function f() public pure returns (uint) { S memory s; s.x = 5; delete s.h; return s.x; } }')).toBe('C');
  });
  it('deletes a nested struct field (b.a.x)', () => {
    expect(cc('contract C { struct A { uint x; } struct B { A a; uint y; }'
      + ' function f() public pure returns (uint) { B memory b; b.y = 3; delete b.a.x; return b.y; } }')).toBe('C');
  });
});

// A struct field has no in-place element write, so `s.arr[i] = v` (local struct, array field) desugars to a
// read-modify-rebuild: `T tmp = s.arr; tmp[i] = v; s.arr = tmp;`. Reduces to tested array-write + rebuild.
describe('nested lvalue write: local struct array-field element (s.arr[i] = v)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('writes an element of a fixed-size array field', () => {
    expect(cc('contract C { struct S { uint[3] arr; }'
      + ' function f(uint i) public pure returns (uint) { S memory s; s.arr[i] = 5; return s.arr[i]; } }')).toBe('C');
  });
  it('supports compound assignment on an array-field element', () => {
    expect(cc('contract C { struct S { uint[3] arr; }'
      + ' function f(uint i) public pure returns (uint) { S memory s; s.arr[i] += 5; return s.arr[i]; } }')).toBe('C');
  });
  it('does not regress a plain struct scalar field write', () => {
    expect(cc('contract C { struct S { uint x; }'
      + ' function f() public pure returns (uint) { S memory s; s.x = 5; return s.x; } }')).toBe('C');
  });
});

// `m[i].arr[j] = v` (state mapping -> struct value -> array-field element) desugars to a read-modify-write:
// `S t = m[i]; t.arr[j] = v; m[i] = t;`. The interleaved index-member-index chain now parses (lvPart grammar).
describe('nested lvalue write: state mapping struct array-field element (m[i].arr[j] = v)', () => {
  const pre = 'contract C { struct S { uint[3] arr; } mapping(uint=>S) m;'
    + ' function f(uint i, uint j, uint v, sig s, pubkey pk) public { require(checkSig(s,pk)); ';
  const post = ' } }';
  const cc = (body: string): string =>
    compileString(pre + body + post, { solidityImportCompat: true }).contractName;
  it('compiles the write', () => {
    expect(cc('m[i].arr[j] = v;')).toBe('C');
  });
  it('supports compound assignment', () => {
    expect(cc('m[i].arr[j] += v;')).toBe('C');
  });
  it('desugars byte-for-byte to the explicit `S t = m[i]; t.arr[j] = v; m[i] = t;` form', () => {
    const item1 = compileString(pre + 'm[i].arr[j] = v;' + post, { solidityImportCompat: true });
    const explicit = compileString(pre + 'S t = m[i]; t.arr[j] = v; m[i] = t;' + post, { solidityImportCompat: true });
    expect(item1.bytecode).toBe(explicit.bytecode);
  });
  it('does not regress a mapping struct scalar field write (m[i].a = v)', () => {
    expect(compileString('contract C { struct S { uint a; } mapping(uint=>S) m;'
      + ' function f(uint i, uint v, sig s, pubkey pk) public { require(checkSig(s,pk)); m[i].a = v; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

// `m[i].f = v` where m is a LOCAL struct array (`S[] memory`): the parser makes a MappingFieldAssignNode the
// symbol table would reject (m is not a state collection). Desugars to an element rebuild with field f replaced:
// `m[i] = S(m[i].f0, .., v, ..)` - reads m[i].f and whole-element writes already work. Sound by reduction.
describe('local struct-array element field write (S[] memory m; m[i].f = v)', () => {
  const P = 'contract C(){struct S{int a;int b;}function f()external{S[] memory m=new S[](3);';
  it('compiles a local memory struct-array field write', () => {
    expect(compileString(`${P}m[0].a=1;m[1].b=2;require(m[0].a==1);}}`, { solidityImportCompat: true }).contractName)
      .toBe('C');
  });
  it('is byte-identical to the explicit element rebuild (sound by reduction)', () => {
    const sugar = compileString(`${P}m[0].a=1;require(m[0].a==1);}}`, { solidityImportCompat: true });
    const hand = compileString(`${P}m[0]=S(1,m[0].b);require(m[0].a==1);}}`, { solidityImportCompat: true });
    expect(sugar.bytecode).toBe(hand.bytecode);
  });
});

// `X[i].c[j] = v` where X is a state OR local struct array and c is an array field (interleaved index-member-
// index). Struct-array elements have no in-place field-array write, so desugars to a whole-element RMW
// `S t = X[i]; t.c[j] = v; X[i] = t;` (bare-element read/write resolve state-or-local). Sound by reduction.
describe('struct-array element array-field write (X[i].c[j] = v)', () => {
  const S = 'struct S{int a;int[] c;}';
  it('compiles a state struct-array nested array-field write', () => {
    expect(compileString(`contract C(){${S}S[] s;function f()external{s.push(S(1,new int[](3)));`
      + 's[0].c[1]=9;require(s[0].c[1]==9);}}', { solidityImportCompat: true }).contractName).toBe('C');
  });
  it('compiles a local memory struct-array nested array-field write', () => {
    expect(compileString(`contract C(){${S}function f()external{S[] memory m=new S[](2);m[0].c=new int[](2);`
      + 'm[0].c[1]=7;require(m[0].c[1]==7);}}', { solidityImportCompat: true }).contractName).toBe('C');
  });
  it('supports compound assignment (X[i].c[j] += v)', () => {
    expect(compileString(`contract C(){${S}S[] s;function f(uint i,uint j,int v)external{s.push(S(1,new int[](3)));`
      + 's[i].c[j]+=v;require(true);}}', { solidityImportCompat: true }).contractName).toBe('C');
  });
  it('is byte-identical to the explicit whole-element RMW (sound by reduction)', () => {
    const P = `contract C(){${S}S[] s;function f()external{s.push(S(1,new int[](3)));`;
    const sugar = compileString(`${P}s[0].c[1]=9;require(s[0].c[1]==9);}}`, { solidityImportCompat: true });
    const hand = compileString(`${P}S t=s[0];t.c[1]=9;s[0]=t;require(s[0].c[1]==9);}}`, { solidityImportCompat: true });
    expect(sugar.bytecode).toBe(hand.bytecode);
  });
});

// A struct-with-a-mapping-field flattens each field to a `<var>__<field>` state collection; a trailing member
// after the flattened mapping index (`o.data[k2].valid = v`) writes the value-struct scalar field.
describe('nested lvalue write: struct-with-mapping field (o.data[k2].valid = v)', () => {
  const decl = 'contract C { struct Inner { bool valid; } struct Outer { mapping(uint=>Inner) data; } Outer o;';
  const cc = (body: string): string => compileString(
    `${decl} function f(uint k2, bool b, sig s, pubkey pk) public { require(checkSig(s,pk)); ${body} } }`,
    { solidityImportCompat: true },
  ).contractName;
  it('writes a scalar field of the value struct behind the flattened mapping', () => {
    expect(cc('o.data[k2].valid = b;')).toBe('C');
  });
  it('still writes the whole value struct (o.data[k2] = Inner(b))', () => {
    expect(cc('o.data[k2] = Inner(b);')).toBe('C');
  });
});

// The deepest case: `mapping(K => struct{ mapping })`. The value struct's mapping field flattens through the outer
// key into a nested state mapping `providers__data[k][k2]`, so `providers[k].data[k2].valid = v` resolves.
describe('nested lvalue write: mapping of struct-with-mapping (providers[k].data[k2].valid = v)', () => {
  const decl = 'contract C { struct Inner { bool valid; uint amt; } struct Outer { mapping(uint=>Inner) data; bool active; }'
    + ' mapping(address=>Outer) providers;';
  const cc = (body: string): string => compileString(
    `${decl} function f(address k, uint k2, bool b, uint v, sig s, pubkey pk) public { require(checkSig(s,pk)); ${body} } }`,
    { solidityImportCompat: true },
  ).contractName;
  it('writes a scalar field of the innermost value struct', () => {
    expect(cc('providers[k].data[k2].valid = b;')).toBe('C');
  });
  it('supports a compound write on the innermost value struct field', () => {
    expect(cc('providers[k].data[k2].amt += v;')).toBe('C');
  });
  it('writes the whole innermost value struct', () => {
    expect(cc('providers[k].data[k2] = Inner(b, v);')).toBe('C');
  });
  it('writes a scalar field of the outer value struct (providers[k].active = b)', () => {
    expect(cc('providers[k].active = b;')).toBe('C');
  });
  it('reads through the whole chain (providers[k].data[k2].valid)', () => {
    expect(cc('require(providers[k].data[k2].valid == b);')).toBe('C');
  });
  it('desugars byte-for-byte to the manually-flattened nested mapping form', () => {
    const flattened = compileString('contract C { struct Inner { bool valid; } struct Outer { mapping(uint=>Inner) data; }'
      + ' mapping(address=>Outer) providers;'
      + ' function f(address k, uint k2, bool b, sig s, pubkey pk) public { require(checkSig(s,pk));'
      + ' providers[k].data[k2].valid = b; } }', { solidityImportCompat: true });
    const manual = compileString('contract C { struct Inner { bool valid; } mapping(address=>mapping(uint=>Inner)) providers__data;'
      + ' function f(address k, uint k2, bool b, sig s, pubkey pk) public { require(checkSig(s,pk));'
      + ' providers__data[k][k2].valid = b; } }', { solidityImportCompat: true });
    expect(flattened.bytecode).toBe(manual.bytecode);
  });
});
