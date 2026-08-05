import { describe, it, expect, vi } from 'vitest';
import { compileString } from './direct-compile.js';

// Data-location parity: calldata read-only enforcement.

describe('calldata read-only enforcement (Solidity data-location parity)', () => {
  const compiles = (body: string): string => compileString(`contract C() { ${body} }`).contractName;
  const REASON = /read-only 'calldata'/;

  it('rejects a direct write to a calldata parameter', () => {
    expect(() => compiles('function f(int[] calldata x) { x[0] = 5; require(true); }')).toThrow(REASON);
  });

  it('rejects a compound write to a calldata parameter', () => {
    expect(() => compiles('function f(int[] calldata x) { x[0] += 1; require(true); }')).toThrow(REASON);
  });

  it('rejects writing a calldata array element', () => {
    expect(() => compiles('function f(int[] calldata xs) { xs[0] = 5; require(true); }')).toThrow(REASON);
  });

  it('allows a whole calldata ARRAY rebind (x = y rebinds the pointer, not a data write)', () => {
    expect(compiles('function f(uint256[] calldata x, uint256[] calldata y, uint256 i)'
      + ' external returns (uint256) { x = y; return x[i]; }')).toBe('C');
  });

  it('rejects a calldata STRUCT field write (calldata structs are read-only)', () => {
    expect(() => compiles('struct S { int a; } function f(S calldata s) { s.a = 4; require(true); }')).toThrow(REASON);
  });

  it('allows whole calldata struct, bytes, and string rebinds while retaining read-only data', () => {
    expect(compiles('struct S { int a; } function f(S calldata s, S calldata t) { s = t; require(s.a == t.a); }'))
      .toBe('C');
    expect(compiles('function f(bytes calldata x, bytes calldata y) { x = y; require(x.length == y.length); }'))
      .toBe('C');
    expect(compiles('function f(string calldata x, string calldata y) { x = y; require(x.length == y.length); }'))
      .toBe('C');
  });

  it('still rejects bytes element writes after distinguishing them from calldata rebinds', () => {
    expect(() => compiles('function f(bytes calldata x) { x[0] = 0x01; require(true); }')).toThrow(REASON);
  });

  it('allows reading a calldata parameter', () => {
    expect(compiles('function f(int[] calldata x) { require(x[0] > 0); }')).toBe('C');
  });

  it('allows copying calldata into a plain variable and mutating the copy', () => {
    expect(compiles('function f(int[] calldata x) { int[] memory y = x; y[0] = 5; require(y[0] == 5); }')).toBe('C');
  });

  it('keeps memory parameters mutable (memory is the default, not read-only)', () => {
    expect(compiles('function f(int[] memory x) { x[0] = 5; require(x[0] == 5); }')).toBe('C');
  });

  it('no longer warns that memory / calldata are no-ops', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    compileString('contract C() { function f(bytes memory a, bytes calldata b)'
      + ' { require(b.length > 0); require(a.length > 0); } }');
    const noop = spy.mock.calls.some((c) => String(c[0]).includes('data location modifier is a no-op'));
    spy.mockRestore();
    expect(noop).toBe(false);
  });

  it('rejects data locations on value types', () => {
    expect(() => compiles('function f(int calldata x) { require(x > 0); }')).toThrow(/only valid for reference types/);
    expect(() => compiles('function f(address memory x) { require(x == x); }')).toThrow(/only valid for reference types/);
  });

  it('allows calldata locals bound from calldata and rejects memory-to-calldata bindings', () => {
    expect(compiles('function f(bytes calldata x) external { bytes calldata y = x; require(y.length > 0); }'))
      .toBe('C');
    expect(compiles('function f(bytes calldata x) external { bytes calldata y; y = x; require(y.length > 0); }'))
      .toBe('C');
    expect(() => compiles('function f(bytes memory x) { bytes calldata y = x; require(y.length > 0); }'))
      .toThrow(/cannot initialize calldata local/);
    expect(() => compiles('function f(bytes memory x) { bytes calldata y; y = x; require(y.length > 0); }'))
      .toThrow(/cannot rebind calldata local/);
    expect(compiles('function f(bytes calldata x, bool b) external { bytes calldata y;'
      + ' if (b) y = x; else y = x; require(y.length > 0); }')).toBe('C');
    expect(() => compiles('function f(bytes calldata x, bool b) external { bytes calldata y;'
      + ' if (b) y = x; require(y.length > 0); }')).toThrow(/may be read before it is initialized/);
  });

  it('rejects calldata constructor parameters', () => {
    expect(() => compileString('contract C { constructor(bytes calldata y) {} }'))
      .toThrow(/constructor parameters cannot have 'calldata'/);
  });

  it('rejects storage on externally callable parameters and returns', () => {
    expect(() => compiles('function f(int[] storage x) external { require(x.length > 0); }'))
      .toThrow(/only valid on internal or private/);
    expect(() => compiles('function f() external returns (int[] storage) { }'))
      .toThrow(/only valid on internal or private/);
  });

  it('allows storage parameters and returns on public/external library functions', () => {
    expect(compileString('library L { function f(mapping(uint => uint) storage m) external pure'
      + ' returns (mapping(uint => uint) storage) { return m; } }',
    { solidityImportCompat: true }).contractName).toBe('L');
    expect(compileString('library L { struct S { uint x; }'
      + ' function f(S storage s) public pure returns (S storage) { return s; } }',
    { solidityImportCompat: true }).contractName).toBe('L');
  });

  it('allows mapping-array storage pointers in libraries and rejects non-storage locations', () => {
    expect(compileString('library L { function f(mapping(uint => uint)[] storage m) external pure {} }',
      { solidityImportCompat: true }).contractName).toBe('L');
    expect(() => compileString(
      'contract C { function f(mapping(uint => uint)[] calldata m) external pure {} }',
      { solidityImportCompat: true },
    )).toThrow(/mapping-containing parameters must have 'storage'/);
    expect(() => compileString(
      'contract C { function f(mapping(uint => uint)[2] memory m) internal pure {} }',
      { solidityImportCompat: true },
    )).toThrow(/mapping-containing parameters must have 'storage'/);
    expect(() => compileString(
      'contract C { function f() internal pure { mapping(uint => uint)[] storage m; m; } }',
      { solidityImportCompat: true },
    )).toThrow(/storage pointer .* must be initialized/i);
  });

  it('tracks storage-pointer initialization across branches', () => {
    expect(compiles('struct S { int x; } S s; function f(bool b) internal {'
      + ' S storage p; if (b) p = s; else p = s; p; }')).toBe('C');
    expect(() => compiles('struct S { int x; } S s; function f(bool b) internal {'
      + ' S storage p; if (b) p = s; p; }'))
      .toThrow(/storage pointer 'p' may be accessed before it is initialized/);
    expect(() => compiles('struct S { int x; } S s; function f(bool b) internal {'
      + ' S storage p; while (b) { p = s; b = false; } p; }'))
      .toThrow(/storage pointer 'p' may be accessed before it is initialized/);
    expect(compiles('struct S { int x; } S s; function f(bool b) internal {'
      + ' S storage p = s; while (b) { p = s; b = false; } p; }')).toBe('C');
  });

  it('rejects invalid storage-pointer sources before alias lowering erases their location and type', () => {
    expect(() => compiles('uint[] data; function f(uint[] memory x) internal {'
      + ' uint[] storage p = data; p = x; }')).toThrow(/cannot bind storage pointer 'p' from memory reference/);
    expect(() => compiles('uint[] data; uint8[] small; function f() internal {'
      + ' uint[] storage p = data; p = small; }')).toThrow(/storage pointer 'p'.*cannot bind.*uint8\[\]/);
    expect(() => compiles('function f() internal { string storage p = "abc"; }'))
      .toThrow(/cannot bind storage pointer 'p' from a literal value/);
  });

  it('does not mistake a file-level free function for a library function', () => {
    expect(() => compileString('function f(bytes storage x) external returns (bytes storage) { return x; }',
      { solidityImportCompat: true })).toThrow(/free functions cannot have/i);
  });

  it('allows calldata returns for internal and externally callable functions', () => {
    expect(compiles('function f(bytes calldata x) internal pure returns (bytes calldata) { return x; }'
      + ' function g(bytes calldata x) external { require(f(x).length == x.length); }')).toBe('C');
    expect(compiles('function f(bytes calldata x) external pure returns (bytes calldata) { return x; }')).toBe('C');
    expect(compiles('function f(bytes calldata x) public pure returns (string calldata) { return string(x); }'))
      .toBe('C');
  });

  it('requires return data locations to match when overriding a non-external function', () => {
    expect(() => compileString(
      'abstract contract A { function f() public virtual view returns (uint[] calldata); }'
      + ' contract C is A { function f() public override view returns (uint[] memory) {} }',
      { solidityImportCompat: true },
    )).toThrow(/data locations must match/);
    expect(compileString(
      'abstract contract A { function f() external virtual view returns (uint[] calldata); }'
      + ' contract C is A { function f() public override view returns (uint[] memory) {} }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('allows storage-pointer parameters on abstract constructors only', () => {
    expect(compileString(
      'abstract contract A { constructor(mapping(uint => uint) storage m) { m[5] = 20; } }'
      + ' contract C is A { mapping(uint => uint) m; constructor() A(m) {} }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
    expect(compileString(
      'abstract contract A { constructor(uint[] storage a) {} }',
      { solidityImportCompat: true },
    ).contractName).toBe('A');
    expect(() => compileString(
      'contract C { constructor(uint[] storage a) {} }',
      { solidityImportCompat: true },
    )).toThrow(/storage.*only valid on internal or private/i);
  });

  it('rejects duplicate/conflicting locations and mutability modifiers', () => {
    expect(() => compiles('function f(bytes memory calldata x) external { require(x.length > 0); }'))
      .toThrow(/multiple data locations/);
    expect(() => compiles('function f() external payable view { require(true); }'))
      .toThrow(/multiple state mutability modifiers/);
  });

  it('fails closed when an unsupported memory consumer would otherwise break an alias group', () => {
    expect(() => compiles('function opaque(uint[] memory x) internal returns (uint[] memory) { return x; }'
      + ' function f() external { uint[] memory a = new uint[](1); uint[] memory b = a;'
      + ' uint[] memory c = opaque(a); b[0] = 7; require(c.length == 1); }'))
      .toThrow(/cannot yet preserve Solidity aliasing/);
  });
});
