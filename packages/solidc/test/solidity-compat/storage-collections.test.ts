import { describe, it, expect } from 'vitest';
import { compileString } from './helpers.js';

// Focused regression guards derived from the Solidity compiler corpus.
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

describe('legacy soft-keyword struct type name', () => {
  it('accepts a struct named error and uses it as a state-variable type', () => {
    expect(compileString(
      'struct error { uint value; } contract C { error item;'
      + ' function f(uint x) public returns(uint) { item.value = x; return item.value; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
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

  it('(x, y) = f() captures the multi-return before writing state', () => {
    const compileConstructor = (body: string): string => compileString(`contract C() {
      uint256 immutable x; uint256 immutable y;
      constructor() { ${body} }
      function f() private pure returns (uint256, uint256) { return (3, 4); }
      function check() { require(x == 3 && y == 4); }
    }`, { solidityImportCompat: true }).bytecode;
    expect(compileConstructor('(x, y) = f();'))
      .toBe(compileConstructor('uint256 a, uint256 b = f(); x = a; y = b;'));
  });

  it('a tuple assignment to locals is unaffected', () => {
    expect(compileString(`contract C() {
      function f(uint256 a, uint256 b) { uint256 p; uint256 q; (p, q) = (a, b); require(p == a); }
    }`, { solidityImportCompat: true }).contractName).toBe('C');
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
    const bc = (v: string): string => compileString(`contract C() { bytes4[] a; function f(uint256 i) { a[i] = ${v}; } }`,
      { solidityImportCompat: true, forceStateful: true }).bytecode;
    expect(bc('"abcd"')).toBe(bc('0x61626364'));
  });
});

// An explicit `override(A, B)` list may name an interface base. An interface only DECLARES the overridden
// function (no body), so it has no super implementation to resolve - it must not be rejected as "not a base".

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
      .toThrow(/Recursive struct types are unsupported/);
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
    expect(cc('pragma solidity 0.6.12; contract C {'
      + ' function f(uint256 x) public pure returns (uint256) { return -x; } }')).toBe('C');
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

describe('bare struct type expression statements', () => {
  it('treats a library-qualified struct type as a no-op value expression', () => {
    expect(compileString('library L { struct S { uint x; } } contract C {'
      + ' function f() public pure returns (uint) { L.S; return 1; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
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

describe('internal forwarding of chunked mapping value witnesses', () => {
  it('passes same-named bytes witnesses from an entry point into its internal reader', () => {
    const src = 'contract C { mapping(uint256 => string) m;'
      + ' function read(uint256 k) private view returns (string memory) { return m[k]; }'
      + ' function f(uint256 k) public view returns (string memory) { return read(k); } }';
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  });
});

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
    expect(compileString(iface + ' ' + struc + ' contract C { mapping(uint256 => Job) public jobs;'
      + ' function pay(uint256 id) public { ITok(jobs[id].token).transfer(msg.sender, 1);'
      + ' ITok(jobs[id].token).transfer(msg.sender, 2); require(true); } }', {
      solidityImportCompat: true, messageBus: true,
    }).contractName).toBe('C');
  });
});

// `IFoo(param.field).m()` - a field of a FUNCTION PARAM cast to an interface. Caller-supplied, so the sound
// "caller chooses whom to call" shape (extcall-target-pinning.md's param row), NOT an author-fixed value lifted
// to a caller input. This is Unicrow's `IERC20(input.currency).balanceOf(..)` (input is a calldata struct param).

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
    const compileBody = (body: string): string => compileString(
      `${S} contract C { Post[] jobs; function f(uint id) public { ${body} require(true); } }`,
      { solidityImportCompat: true },
    ).contractName;
    expect(compileBody('jobs[id].roles.creator = msg.sender;')).toBe('C');            // direct
    expect(compileBody('Post storage p = jobs[id]; p.roles.creator = msg.sender;')).toBe('C'); // via storage pointer
    expect(compileBody('jobs[id].roles.worker = msg.sender; jobs[id].amount = 5;')).toBe('C'); // nested + flat, same elem
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
  // co-spend/mint, update+insert - SortedUpsertLoop), NOT the range-splice. The loop var (`= i`) is per-iteration
  // too, so it takes the same upsert path.
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
  it('normalizes checked using-for add/sub wrappers in a per-key nested-mapping RMW loop', () => {
    const art = compileString('library M {'
      + ' function add(uint a,uint b) internal pure returns(uint c){require((c=a+b)>=b,"overflow");}'
      + ' function sub(uint a,uint b) internal pure returns(uint c){require((c=a-b)<=a,"underflow");}'
      + '} contract C { using M for uint; mapping(address=>mapping(address=>uint)) balanceOf;'
      + ' mapping(address=>address) masterContractOf; mapping(address=>mapping(address=>bool)) masterContractApproved;'
      + ' modifier allowed(address from){if(from!=msg.sender&&from!=address(this)){address master=masterContractOf[msg.sender];'
      + ' require(master!=address(0));require(masterContractApproved[master][from]);}_;}'
      + ' function f(address token,address from,address[] tos,uint[] shares) public allowed(from) {'
      + ' uint total; for(uint i=0;i<tos.length;i++){address to=tos[i];'
      + ' balanceOf[token][to]=balanceOf[token][to].add(shares[i]); total=total.add(shares[i]);}'
      + ' balanceOf[token][from]=balanceOf[token][from].sub(total); require(true); } }',
    { forceStateful: true, solidityImportCompat: true });
    const info = art.abi.find((f) => f.name === 'f')?.sortedUpsertLoopInfo?.[0];
    expect(info).toMatchObject({ collection: 'balanceOf', fixedKeyParams: ['token'],
      varyingArrayParam: 'tos', valueArrayParam: 'shares', op: '+' });
  });
  it('compiles a storage-library field RMW over loop-varying struct-mapping keys', () => {
    const art = compileString('struct R { uint128 elastic; uint128 base; } library L {'
      + ' function addElastic(R storage total,uint128 fee) internal returns(uint128 n){n=total.elastic=total.elastic+fee;}'
      + '} contract C { using L for R; mapping(address=>R) totals;'
      + ' function f(address[] tokens,uint128[] fees) public {'
      + ' for(uint i=0;i<tokens.length;i++){address token=tokens[i];require(totals[token].addElastic(fees[i])>=0);}'
      + ' require(true); } }', { forceStateful: true, solidityImportCompat: true });
    expect(art.abi.find((f) => f.name === 'f')?.sortedUpsertLoopInfo?.[0]).toMatchObject({
      collection: 'totals', varyingArrayParam: 'tokens', op: 'set', valueRuntimeExpression: true,
    });
  });
  it('traces an ABI-decoded key through an inlined external-call helper parameter', () => {
    const art = compileString('library M { function add(uint a, uint b) internal pure returns (uint) { return a+b; } }'
      + ' interface IV { function ping() external; } contract C { using M for uint; mapping(address => uint) m; IV v;'
      + ' function addOne(address to, uint share) public { m[to] = m[to].add(share); v.ping(); require(true); }'
      + ' function cook(uint[] actions, bytes[] datas) public { for (uint i=0; i<actions.length; i=i+1) {'
      + ' if (actions[i] == 1) { (address to, uint share) = abi.decode(datas[i], (address,uint)); addOne(to,share); }'
      + ' } require(true); } }', { forceStateful: true, solidityImportCompat: true });
    const info = art.abi.find((f) => f.name === 'cook')?.sortedUpsertLoopInfo?.[0];
    expect(info?.varyingArrayParam).toBe('datas');
    expect(info?.keyDecodeTupleIndex).toBe(0);
    expect(info?.predicateArrayParam).toBe('actions');
    expect(info?.valueRuntimeExpression).toBe(true);
  });
  it('tracks decoded keys and computed values through a returning external-call helper', () => {
    const art = compileString('interface IV { function ping() external; } contract C {'
      + ' mapping(address => uint) m; IV v; function addOne(address to, uint share) internal returns (uint fraction) {'
      + ' fraction = share + 1; if (fraction < 2) { return 0; } m[to] = m[to] + fraction; v.ping(); }'
      + ' function cook(uint[] actions, bytes[] datas) public { uint value1=0; for (uint i=0;i<actions.length;i=i+1) {'
      + ' if(actions[i]==1) { (address to,uint share)=abi.decode(datas[i],(address,uint)); value1=addOne(to,share); }'
      + ' } require(value1>=0); } }', { forceStateful: true, solidityImportCompat: true });
    const info = art.abi.find((f) => f.name === 'cook')?.sortedUpsertLoopInfo?.[0];
    expect(info?.varyingArrayParam).toBe('datas');
    expect(info?.keyDecodeTupleIndex).toBe(0);
    expect(info?.valueRuntimeExpression).toBe(true);
  });
  it('allocates independent C2 regions for multiple conditional collections in one runtime loop', () => {
    const art = compileString('contract C { mapping(address=>uint) a; mapping(address=>uint) b;'
      + ' function cook(uint[] actions,bytes[] datas) public { for(uint i=0;i<actions.length;i=i+1) {'
      + ' if(actions[i]==1){(address k,uint v)=abi.decode(datas[i],(address,uint));a[k]=a[k]+v;}'
      + ' else if(actions[i]==2){(address k,uint v)=abi.decode(datas[i],(address,uint));b[k]=b[k]+v;}'
      + '} require(true); } }', { forceStateful: true, solidityImportCompat: true });
    const infos = art.abi.find((f) => f.name === 'cook')?.sortedUpsertLoopInfo ?? [];
    expect(infos.map((info) => info.collection)).toEqual(['a', 'b']);
    expect(infos.map((info) => info.predicateEquals)).toEqual(['1', '2']);
  });
  it('routes a loop-var value (m[ks[i]] = i) through the per-iteration upsert loop', () => {
    // The range-splice insert loop assigns ONE loop-invariant value to every new node, so this used to fail
    // closed. The upsert loop mints each entry separately, which is the shape a per-iteration value needs.
    // SortedUpsertLoop.test.ts VM-proves each key receives its own index (setIndex([3,9]) -> 3 = 0, 9 = 1).
    expect(abiOf('for (int i = 0; i < ks.length; i++) { m[ks[i]] = i; }')?.sortedUpsertLoopInfo?.[0]?.op)
      .toBe('set');
  });
});

describe('low-level .call target through inlined-local aliases traced to a self-pinned state chain (EACC #2)', () => {
  // OZ SafeERC20 forceApprove's `_callOptionalReturnBool` does `address(token).call(data)`; after the SafeERC20/
  // Address chain inlines, the receiver is `address(__rh0_token)` where `token` bound to `IERC20(coll[k].field)`.
  // SynthesizeExternalAddressLocals now traces the receiver through casts + inliner-local aliases (and single-
  // assignment user locals) back to the self-pinned state chain and hoists it, so the covenant pins the co-spent
  // callee to that chain (__extaddr_ll_ source), NOT a caller input. A reassignable local is NOT traced (a caller
  // could rebind it - the forgery extcall-target-pinning.md forbids): it must never acquire a state-chain source.
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
  it('never hoists a REASSIGNED local (a caller-rebindable target gets no state-chain source)', () => {
    // The forgery this guards against is a target that CLAIMS a self-pinned state chain while the runtime value
    // is caller-chosen. `token` ends up bound to the `attacker` PARAMETER, which is the ordinary permitted form
    // (the identity check picks it off the stack), so compiling is fine - acquiring `ll_config_token` is not.
    expect(extcallOf(src('IEcho token = IEcho(config.token); token = IEcho(attacker);'))?.addressStateVar)
      .toBeUndefined();
  });
  it('sources a DIRECT address(config.token).call cast (no helper) from the state chain', () => {
    const direct = 'pragma solidcash >=0.8.0; struct Config { address token; } contract C() { Config config; bytes32 d;'
      + ' function f(bytes data, pubkey pk, sig s) { require(checkSig(s, pk));'
      + ' bool ok, bytes r = address(config.token).call(data); require(ok); this.d = sha256(data); } }';
    expect(compileString(direct, {}).abi.find((f) => f.name === 'f')?.externalCalls?.find((e) => e.opaqueReturn)
      ?.addressStateVar).toBe('ll_config_token');
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

describe('parenthesized array-member invocation', () => {
  it('lowers (data.pop)() like data.pop()', () => {
    expect(compileString('contract C { int[] data; function f() public returns (uint) {'
      + ' data.push(1); (data.pop)(); return data.length; } }',
    { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
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

describe('explicit array conversion', () => {
  it('converts a calldata array slice to the same dynamic array type', () => {
    expect(compileString('contract C { function f(uint256[] calldata x, uint256 s, uint256 e)'
      + ' external returns (uint256) { return uint256[](x[s:e]).length; } }',
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

describe('discarded user-defined array type expressions', () => {
  it('accepts a struct array type without turning ordinary indexed values into no-ops', () => {
    expect(compileString('contract C { struct S { uint256 x; } function f(uint256[] memory a)'
      + ' public pure returns (uint256) { S[7][]; a[0]; return 3; } }',
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

describe('UDVT arrays in struct fields', () => {
  it('resolves a contract-level UDVT before building struct field types', () => {
    expect(compileString('contract C { type U is uint; struct S { U[] values; }'
      + ' function f() public { S memory s; s.values = new U[](1); s.values[0] = U.wrap(7); } }',
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

describe('public state getter function values', () => {
  it('contextually treats uncalled this.x as the external getter function', () => {
    const artifact = compileString('contract C { uint immutable public x = 42;'
      + ' function h() public view returns (function () external view returns (uint)) { return this.x; } }',
    { solidityImportCompat: true });
    expect(artifact.abi.map((entry) => entry.name)).toEqual(expect.arrayContaining(['x', 'h']));
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

describe('state assignments in short-circuit branch conditions', () => {
  it('keeps right-side && and || writes conditional', () => {
    expect(compileString('contract C { bool b; function f(bool choose) public {'
      + ' if (choose && (b = true)) {} if (choose || (b = false)) {} } }',
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

describe('state-struct tuple swaps', () => {
  it('captures both struct values before writing either state slot', () => {
    expect(compileString('contract C { struct S { uint a; uint b; } S x; S y;'
      + ' function f() public { (x, y) = (y, x); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
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

describe('state-backed external target through address casts', () => {
  it('records a contract-typed immutable as the persisted callee address source', () => {
    const src = 'contract Child { function f() external pure returns (uint) { return 0; } }'
      + ' interface IChild { function f() external pure returns (uint); }'
      + ' contract C { Child immutable child = new Child();'
      + ' function g() public returns (uint) { return IChild(address(child)).f(); } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
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

describe('user-defined value type construction validation', () => {
  const cc = (src: string): string =>
    compileString(src, { solidityImportCompat: true }).contractName;

  it('rejects direct UDVT conversion syntax in favor of wrap', () => {
    expect(() => cc('type MyT is uint; contract C { function f() public pure { MyT(1); } }'))
      .toThrow(/not castable to type 'MyT'/);
  });

  it('requires one positional argument for wrap and unwrap', () => {
    expect(() => cc('type MyT is uint; contract C { function f() public pure { MyT.wrap(); } }'))
      .toThrow(/Wrong argument count.*expected 1/);
    expect(() => cc('type MyT is uint; contract C { function f() public pure {'
      + ' MyT.unwrap(MyT.wrap(1), MyT.wrap(2)); } }'))
      .toThrow(/Wrong argument count.*expected 1/);
  });

  it('requires unwrap to receive the same UDVT', () => {
    expect(() => cc('type MyT is uint; type MyU is uint; contract C {'
      + ' function f() public pure { MyT.unwrap(MyU.wrap(1)); } }'))
      .toThrow(/not castable|conversion/i);
  });

  it('retains valid Solidity wrap/unwrap', () => {
    expect(cc('type MyT is uint; function f() pure returns (uint) {'
      + ' return MyT.unwrap(MyT.wrap(1)); } contract C {}')).toBe('C');
  });
});

describe('Solidity constant state eligibility', () => {
  const cc = (src: string): string =>
    compileString(src, { solidityImportCompat: true }).contractName;

  it('requires every constant state variable to have an initializer', () => {
    expect(() => cc('contract C { uint constant value; }'))
      .toThrow(/Uninitialized constant variable/);
    expect(() => cc('contract C { struct S { uint x; } S public constant value; }'))
      .toThrow(/Uninitialized constant variable/);
  });

  it('rejects array, mapping, and struct constants', () => {
    expect(() => cc('contract C { uint[3] constant values = [uint(1), 2, 3]; }'))
      .toThrow(/Only constants of value type and byte array type/);
    expect(() => cc('contract C { mapping(uint => uint) constant values; }'))
      .toThrow(/Uninitialized constant variable|Only constants of value type and byte array type/);
    expect(() => cc('contract C { struct S { uint x; } S constant value = S(1); }'))
      .toThrow(/Only constants of value type and byte array type/);
  });

  it('retains initialized value, string, and bytes constants plus native aggregate constants', () => {
    expect(cc('contract C { uint constant N = 1; string constant S = "s";'
      + ' bytes constant B = hex"01"; }')).toBe('C');
    expect(compileString('contract C { uint[3] constant values = [uint(1), 2, 3]; }').contractName).toBe('C');
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
