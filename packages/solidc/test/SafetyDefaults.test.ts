import { describe, it, expect, vi } from 'vitest';
import { compileString } from '../src/index.js';
import * as Errors from '../src/Errors.js';

// Behaviours that used to be gated behind solidityImportCompat but are now plain SolidCash defaults.
// See packages/solidc/docs/solidity-import-compat.md ("SolidCash defaults" section).

// Spending paths that perform no require()/verification and change no state compile to an
// unconditionally-spendable script. By default this is a warning; enforceFinalRequire makes it a hard error.
describe('FinalRequire: warning by default, error under enforceFinalRequire', () => {
  const unverifiedPaths: [string, string][] = [
    ['do-while with no require', 'contract Loopy() { function doLoop() { int i = 0;'
      + ' do { i = i + 1; } while (i < tx.inputs.length); } }'],
    ['final local array push', 'contract Test() { function test() { int[] arr = [1, 2, 3]; arr.push(4); } }'],
    ['final array push after a console.log', 'contract Test() { function test() { int[] arr = [1, 2, 3];'
      + ' int x = 5; console.log(x); arr.push(1); } }'],
    ['do-while loop no require', 'pragma solidcash >=0.8.0; contract BadLoop() { function doLoop() { int i = 0;'
      + ' do { i = i + 1; } while (i < 3); } }'],
    ['for loop no require', 'contract ForLoopNoRequire() { function doLoop() { int total = 0;'
      + ' for (int i = 0; i < 3; i = i + 1) { total = total + 1; } } }'],
    ['if-branch local with no verification', 'contract Test() { function hello(sig s, pubkey pk) {'
      + ' if (checkSig(s, pk)) { string x = "Hello"; } } }'],
  ];

  it.each(unverifiedPaths)('compiles by default (warning): %s', (_label, src) => {
    const warn = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(compileString(src).contractName).toBeTruthy();
    warn.mockRestore();
  });

  it.each(unverifiedPaths)('throws FinalRequireStatementError under enforceFinalRequire: %s', (_label, src) => {
    expect(() => compileString(src, { enforceFinalRequire: true })).toThrow(Errors.FinalRequireStatementError);
  });

  it('emits the unconditionally-spendable warning by default', () => {
    const warn = vi.spyOn(console, 'log').mockImplementation(() => {});
    compileString('contract C() { function f(int i) pure { if (i <= 100) { revert("x"); } } }');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unconditionally-spendable'));
    warn.mockRestore();
  });

  it('allows a non-final require to gate the path (require not last)', () => {
    const a = compileString('contract C() { mapping(int=>int) m; function f(int k) { require(k > 0); delete m[k]; } }');
    expect(a.contractName).toBe('C');
  });
});

// Empty receive()/fallback() are idiomatic, so they synthesize a state-preserving no-op spend path natively
// (with a warning). Other empty functions stay an EmptyFunctionError unless solidityImportCompat is set.
describe('Empty receive/fallback synthesized by default', () => {
  it('compiles an empty receive() natively and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(compileString('contract C() { receive() external payable {} }').contractName).toBe('C');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('receive()'));
    warn.mockRestore();
  });

  it('compiles an empty fallback() natively and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(compileString('contract C() { fallback() external {} }').contractName).toBe('C');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('fallback()'));
    warn.mockRestore();
  });

  it('still rejects a regular empty function natively', () => {
    expect(() => compileString('contract C() { function f() {} }')).toThrow(Errors.EmptyFunctionError);
  });

  it('synthesizes a regular empty function under solidityImportCompat', () => {
    expect(compileString('contract C() { function f() {} }', { solidityImportCompat: true }).contractName).toBe('C');
  });
});

// A synthesized empty body must be a state-preserving no-op, not a hole in the covenant. It compiles to the
// EXACT same bytecode as an explicit require(true) - i.e. the full Guarded self-preservation (master + value
// + commitment) a stateful contract gives any non-state-accessing function - so spending it cannot drain or
// corrupt state.
describe('Synthesized empty bodies are self-preserving no-ops', () => {
  it('empty regular function (compat) compiles identically to explicit require(true)', () => {
    const empty = compileString('contract C() { int n; function f() {} }', { solidityImportCompat: true });
    const explicit = compileString('contract C() { int n; function f() { require(true); } }', { solidityImportCompat: true });
    expect(empty.bytecode).toBe(explicit.bytecode);
  });

  it('empty receive() (native) compiles identically to explicit require(true)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const empty = compileString('contract C() { int n; receive() external payable {} }');
    const explicit = compileString('contract C() { int n; receive() external payable { require(true); } }');
    warn.mockRestore();
    expect(empty.bytecode).toBe(explicit.bytecode);
  });

  it('the synthesized no-op carries the state self-preservation covenant', () => {
    // private state var: a public one synthesizes a getter that pushes the contract over the subroutine-extraction
    // threshold, hex-encoding these opcodes (still present, just not as names). Visibility is irrelevant here.
    const empty = compileString('contract C() { int private n; function f() {} }', { solidityImportCompat: true });
    expect(empty.bytecode).toContain('OP_UTXOBYTECODE');
    expect(empty.bytecode).toContain('OP_OUTPUTBYTECODE');
  });
});
