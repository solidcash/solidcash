import { describe, it, expect } from 'vitest';
import { compileString } from '../src/index.js';
import { UnsupportedInlineAssemblyError } from '../src/Errors.js';

// Phase 1 of Yul inline-assembly support: the Yul sub-grammar parses (no more opaque ':' ParseError on `:=`)
// and every assembly block yields a clear diagnostic instead of being silently ignored. Native BCH-ASM
// (bare OP_* opcodes) is unaffected. See packages/solidc/docs/yul-inline-assembly.md.

describe('Yul inline assembly (Phase 1: parse + diagnostics)', () => {
  it('still compiles native BCH-ASM (bare opcodes are not Yul)', () => {
    expect(() => compileString(`
      contract C() {
        function f() {
          assembly {
            OP_1
            OP_1
            OP_ADD
            OP_2
            OP_NUMEQUALVERIFY
          }
          require(true);
        }
      }`)).not.toThrow();
  });

  it('compiles Yul value-computation (lowered to the main AST)', () => {
    expect(() => compileString(`
      contract C() {
        function f(int a, int b) {
          int z = 0;
          assembly { z := add(a, b) }
          require(z == 0);
        }
      }`)).not.toThrow();
  });

  it('rejects an OUT builtin with a "no BCH equivalent" message', () => {
    expect(() => compileString(`
      contract C() {
        function f() {
          assembly { let x := pc() }
          require(true);
        }
      }`)).toThrow(/'pc' has no BCH equivalent/);
  });

  it('treats calldataload as supportable (pending), not "no BCH equivalent"', () => {
    // calldata = msg.sig ++ abi-encoded args, so calldataload routes; it is deferred to codegen, not rejected.
    expect(() => compileString(`
      contract C() {
        function f() {
          assembly { let x := calldataload(4) }
          require(true);
        }
      }`)).toThrow(/Yul code generation is not yet implemented/);
  });

  it('hard-rejects verbatim (raw EVM bytecode injection)', () => {
    expect(() => compileString(`
      contract C() {
        function f() {
          assembly { let x := verbatim_0i_1o(hex"60") }
          require(true);
        }
      }`)).toThrow(UnsupportedInlineAssemblyError);
  });

  it('reports Yul function definitions as not yet supported', () => {
    expect(() => compileString(`
      contract C() {
        function f() {
          assembly {
            function double(v) -> r { r := mul(v, 2) }
            let x := double(2)
          }
          require(true);
        }
      }`)).toThrow(/Yul function definitions are not yet supported/);
  });

  it('compiles Yul control-flow (for / switch / if) lowered to the main AST', () => {
    expect(() => compileString(`
      contract C() {
        function f() {
          int z = 0;
          assembly {
            for { let i := 0 } lt(i, 10) { i := add(i, 1) } { z := add(z, 1) }
            switch z case 0 { z := 1 } default { z := 2 }
            if lt(z, 5) { z := 5 }
          }
          require(z == 10);
        }
      }`)).not.toThrow();
  });
});
