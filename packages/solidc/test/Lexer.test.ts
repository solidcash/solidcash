import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// Lexer: identifier / keyword / number-literal edge cases (exponents, units, soft keywords, literal-0 coercion).

describe('A3: identifiers matching [eE][0-9]+ are not mis-lexed as exponents', () => {
  it.each(['e2', 'e1', 'E5', 'e10'])('accepts %s as an identifier', (name) => {
    const artifact = compileString(`
      contract C() { int n; function f() { int ${name} = 5; this.n = ${name}; } }`);
    expect(artifact.contractName).toBe('C');
  });

  it('still lexes integer, underscore, and scientific number literals', () => {
    const artifact = compileString(`
      contract C() {
        int n;
        function f() { this.n = 123; this.n = 1_000; this.n = 1e3; }
      }`);
    expect(artifact.contractName).toBe('C');
  });

  // The fix unblocks repeated tuple-declarations whose error vars were named e1/e2 (the original
  // mis-diagnosis): the parser handles them fine once the names lex as identifiers.
  it('parses repeated tuple-declarations using e1/e2 names', () => {
    const artifact = compileString(`
      function g(int a) returns (int, int) { return (a, a); }
      function f(int a) returns (int) {
        int e1, int p = g(a);
        int e2, int q = g(a);
        return e1 + p + e2 + q;
      }
      contract C() { function go() { require(f(1) == 4); } }`);
    expect(artifact.contractName).toBe('C');
  });
});

describe('Soft keywords (reserved in SolidCash, valid identifiers in Solidity)', () => {
  it.each([
    ['param named error, read in body', 'contract C() { int n; function f(int error) { this.n = error; } }'],
    ['function named deploy', 'contract C() { int n; function deploy() { this.n = 1; } }'],
    ['local named revert', 'contract C() { int n; function f() { int revert = 5; this.n = revert; } }'],
    ['local named delegate', 'contract C() { int n; function f() { int delegate = 3; this.n = delegate; } }'],
    ['local named global', 'contract C() { int n; function f() { int global = 7; this.n = global; } }'],
    ['struct field named error', 'struct S { int error; } contract C() { int n; function f(int v) { this.n = v; } }'],
  ])('%s', (_l, src) => {
    expect(compileString(src).contractName).toBe('C');
  });

  it('the `deploy` modifier keyword was removed - deploy is a plain identifier, not a modifier', () => {
    // A function named `deploy` still parses (deploy is now a normal identifier).
    expect(compileString('contract C() { int n; function deploy() { this.n = 1; } }').contractName).toBe('C');
    // `deploy` in modifier position is no longer a keyword - it reads as an undefined custom modifier.
    expect(() => compileString('contract C() { int n; function f() deploy { this.n = 1; } }'))
      .toThrow(/[Uu]ndefined modifier/);
  });
});

describe('BCH crypto types + number units usable as identifiers (lexer split)', () => {
  it.each([
    ['var named sig', 'contract C(){ int n; function f() { int sig = 5; this.n = sig; } }'],
    ['var named bits', 'contract C(){ int n; function f() { int bits = 3; this.n = bits; } }'],
    ['param named pubkey', 'contract C(){ int n; function f(int pubkey) { this.n = pubkey; } }'],
    ['var named datasig', 'contract C(){ int n; function f() { int datasig = 7; this.n = datasig; } }'],
  ])('%s', (_l, src) => { expect(compileString(src).contractName).toBe('C'); });

  it('still parses the crypto types + number units (no regression)', () => {
    expect(compileString('contract C(){ int n; function f(sig s, pubkey pk, datasig d, bytes32 m) { require(checkSig(s, pk)); require(checkDataSig(d, m, pk)); this.n = 5 bits; } }').contractName).toBe('C');
  });
});

describe('malformed bounded-type spellings are identifiers', () => {
  it('accepts non-canonical uint/bytes/fixed spellings as variable names', () => {
    expect(compileString(
      'contract C { uint uint7; uint bytes01; uint uint300; uint fixed1x01; uint ufixed0x0; }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('keeps canonical bounded types reserved in identifier positions', () => {
    for (const name of ['uint8', 'int256', 'bytes32', 'fixed8x0', 'ufixed256x80']) {
      expect(() => compileString(`contract C { uint ${name}; }`, { solidityImportCompat: true })).toThrow();
    }
  });
});

// The integer literal 0 (and only 0) implicitly converts to any bytesN (all-zero bytes) - a common idiom
// (`bytes32 constant SLOT = 0`, EVM storage slot 0). Non-zero int literals still error, matching Solidity.
describe('integer literal 0 coerces to bytesN', () => {
  it('accepts `bytes32 = 0` as local, state-assign, and constant; rejects non-zero', () => {
    const a = compileString(
      'contract C { bytes32 constant S = 0; function f() public pure returns (bytes32 x) {'
      + ' bytes20 y = 0; x = 0; require(x == S); require(y == bytes20(0)); } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('C');
    expect(() => compileString('contract C { function f() public pure returns (bytes32 r) { r = 5; } }',
      { solidityImportCompat: true })).toThrow(/can not be assigned/);
  });
});

// The literal-0 -> bytesN coercion applies at every assignment site (not just var-defs): state var, mapping
// value, array element, function/event args, and return - matching Solidity's `0` -> bytesN convertibility.
describe('literal 0 -> bytesN at all assignment sites', () => {
  it('coerces 0 in state/mapping/array/arg/return/emit positions', () => {
    const a = compileString(
      'contract C { bytes32 s; bytes32[3] arr; mapping(uint256 => bytes32) m; event E(bytes32 t);'
      + ' function g(bytes32 x) internal pure {}'
      + ' function f(uint256 k) public returns (bytes32) { this.s = 0; this.arr[0] = 0; this.m[k] = 0;'
      + ' g(0); emit E(0); return 0; } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('C');
  });
});

// A value unit (wei/gwei/ether) after a decimal literal (`0.2 ether`) folds to an integer, the same units the
// integer form (`1 ether`) already accepts. Common in ported Solidity.
describe('decimal literal with a value unit (0.2 ether)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts and folds `0.2 ether` to its integer value', () => {
    expect(cc('contract C { function f() public pure returns (bool) {'
      + ' require(0.2 ether == 200000000000000000); return true; } }')).toBe('C');
  });
  it('accepts `1.5 gwei`', () => {
    expect(cc('contract C { function f() public pure returns (bool) {'
      + ' require(1.5 gwei == 1500000000); return true; } }')).toBe('C');
  });
});

// Unspaced subtraction of a number literal (`i-1`, `a[i-1]`, `i-2*3`) was lexed as `i` `-1` (a signed literal),
// so it failed to parse. A leading minus is no longer part of a number literal; negation is a unary operator.
describe('unspaced subtraction of a number literal (i-1)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('parses `i-1`', () => {
    expect(cc('contract C { function f(uint i) public pure returns (uint) { return i-1; } }')).toBe('C');
  });
  it('parses `a[i-1]` (subtraction in an index)', () => {
    expect(cc('contract C { function f(uint[] memory a, uint i) public pure returns (uint) {'
      + ' return a[i-1]; } }')).toBe('C');
  });
  it('parses `i-2*3`', () => {
    expect(cc('contract C { function f(uint i) public pure returns (uint) { uint x = i-2*3; return x; } }'))
      .toBe('C');
  });
  it('still folds `-1` to a negative literal', () => {
    expect(cc('contract C { function f() public pure returns (int) { require(-1 < 0); return -1; } }')).toBe('C');
  });
  it('still rejects a constant negative array index', () => {
    expect(() => compileString('contract C { function f() public pure { uint[3] memory a; uint v = a[-1];'
      + ' require(v == 0); } }', { solidityImportCompat: true })).toThrow();
  });
});
