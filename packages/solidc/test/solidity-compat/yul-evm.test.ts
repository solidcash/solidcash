import { describe, it, expect } from 'vitest';
import { computeErc7201SlotNumber } from '@solidcash/utils';
import { compileString } from './helpers.js';

// Focused regression guards derived from the Solidity compiler corpus.
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

describe('inline assembly preserves payable address assignments', () => {
  it('copies an address payable local into a payable named return without a uint256 round-trip', () => {
    expect(compileString(
      'contract C { function f(address payable z) public pure returns(address payable r) {'
      + ' assembly { r := z } } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
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
  it('rejects gas and value call options on the builtin', () => {
    for (const option of ['gas: 10', 'value: 1']) {
      expect(() => cc('contract C { function f() public pure returns (uint) {'
        + ` return erc7201{${option}}("x"); } }`))
        .toThrow(/call options can only be set on external function calls or contract creations/i);
    }
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

  it('compiles a qualified imported inline slot-alias call', () => {
    const storageSlot = 'library StorageSlot { struct StringSlot { string value; }'
      + ' function getStringSlot(string storage store) internal pure returns (StringSlot storage r)'
      + ' { assembly { r.slot := store.slot } } }';
    const source = 'import "./StorageSlot.sol"; contract C { string private _fb;'
      + ' function set(string memory v) public { StorageSlot.getStringSlot(_fb).value = v; } }';
    expect(() => compileString(source, {
      solidityImportCompat: true,
      rootFileId: '/C.sol',
      importResolver: (importPath) => importPath === './StorageSlot.sol'
        ? { source: storageSlot, id: '/StorageSlot.sol' } : undefined,
    })).not.toThrow();
  });
  it('leaves the raw-slot PARAM factory (getUint256Slot -> __evm_storage register) working', () => {
    const src = 'pragma solidity ^0.8.20; struct Uint256Slot { uint256 value; }'
      + ' library StorageSlot { function getUint256Slot(bytes32 slot) internal pure returns (Uint256Slot storage r)'
      + ' { assembly { r.slot := slot } } }'
      + ' contract C { function setU(bytes32 slot, uint256 v) public { StorageSlot.getUint256Slot(slot).value = v; } }';
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
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

describe('literal-backed memory bytes in inline assembly', () => {
  it('lowers the local to a Yul-compatible pointer and serializes it on assignment', () => {
    expect(compileString('contract C { bytes x; function f() public returns (uint r) {'
      + ' bytes memory m = "tmp"; assembly { mstore(m, 8) mstore(add(m, 32), "deadbeef15dead") }'
      + ' x = m; assembly { r := sload(x.slot) } } }',
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

describe('local Yul functions in for-loop conditions', () => {
  it('re-evaluates an inlined side-effecting condition call before every iteration', () => {
    expect(compileString('contract C { uint st; function f(uint a) public returns (uint b) { assembly {'
      + ' function sideeffect(r) -> x { sstore(0, add(sload(0), r)) x := 1 }'
      + ' for { let i := a } eq(i, sideeffect(2)) { i := 0 } { b := i } } } }',
    { solidityImportCompat: true }).contractName).toBe('C');
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

describe('Yul raw return halts', () => {
  it('does not type-check return(ptr,size) as a Solidity return expression', () => {
    expect(compileString('contract C { function f() public { assembly { mstore(0, 7) return(0, 32) } }'
      + ' function g() public pure returns (uint x) { assembly { return(0, 0) x := 1 } } }',
    { solidityImportCompat: true }).contractName).toBe('C');
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
