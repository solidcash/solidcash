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

  it('rejects Yul create (runtime-bytecode deploy) and explains the typed-new path', () => {
    expect(() => compileString(`
      contract C() {
        function f() {
          assembly { let a := create(0, 0, 0) }
          require(true);
        }
      }`)).toThrow(/'create' has no BCH equivalent.*new Contract/);
  });

  it('rejects a low-level delegatecall and explains it needs a known target', () => {
    expect(() => compileString(`
      contract C() {
        function f(address impl) {
          assembly { let r := delegatecall(gas(), impl, 0, 0, 0, 0) }
          require(true);
        }
      }`)).toThrow(/'delegatecall' has no BCH equivalent.*known target/);
  });

  it('compiles calldataload/calldatasize against function parameters', () => {
    // calldata = msg.sig ++ abi-encoded args; calldataload(4 + 32*k) reads the k-th arg, calldatasize = 4+32n.
    expect(() => compileString(`
      contract C() {
        function f(uint256 x, uint256 y) {
          uint256 a = 0;
          uint256 n = 0;
          assembly { a := calldataload(36) n := calldatasize() }
          require(a == y);
          require(n == 68);
        }
      }`)).not.toThrow();
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

// Phase 4: sstore/sload route to the existing state read/write codegen, tstore/tload to a function-scoped
// local. Verified by byte-identical compilation to the direct (heavily-tested) forms.
describe('Yul storage and transient lowering', () => {
  it('sstore(slot)/sload(slot) compile identically to direct state access', () => {
    const yul = compileString(
      'contract C(){uint256 s_x;uint256 s_y;function f(uint256 v){assembly{sstore(1,v)}require(true);}}',
    );
    const direct = compileString(
      'contract C(){uint256 s_x;uint256 s_y;function f(uint256 v){this.s_y=v;require(true);}}',
    );
    expect(yul.bytecode).toBe(direct.bytecode);
  });

  it('the .slot form resolves to the same state variable as the literal slot', () => {
    const bySlotName = compileString(
      'contract C(){uint256 s_x;uint256 s_y;function f(uint256 v){assembly{sstore(s_y.slot,v)}require(true);}}',
    );
    const byNumber = compileString(
      'contract C(){uint256 s_x;uint256 s_y;function f(uint256 v){assembly{sstore(1,v)}require(true);}}',
    );
    expect(bySlotName.bytecode).toBe(byNumber.bytecode);
  });

  it('tstore/tload compile to a zero-init function-scoped local', () => {
    const yul = compileString(
      'contract C(){function f(uint256 v,uint256 e){uint256 a=0;assembly{tstore(7,v) a:=tload(7)}require(a==e);}}',
    );
    const direct = compileString(
      'contract C(){function f(uint256 v,uint256 e){uint256 __yul_tslot_7=0;uint256 a=0;'
      + '__yul_tslot_7=v;a=__yul_tslot_7;require(a==e);}}',
    );
    expect(yul.bytecode).toBe(direct.bytecode);
  });
});

// Phase 5: constant-offset memory scratch. mstore records a word, keccak256 over a constant region concats the
// covered words. Verified by byte-identical compilation to keccak256(bytes.concat(...)) and to a direct read.
describe('Yul memory (constant-offset scratch)', () => {
  it('mstore + keccak256 over a constant region == keccak256(bytes.concat(...))', () => {
    const yul = compileString(
      'contract C(){function f(bytes32 a,bytes32 b)returns(bytes32 value){'
      + 'assembly{mstore(0,a) mstore(0x20,b) value:=keccak256(0,0x40)}}}',
      { solidityImportCompat: true },
    );
    const direct = compileString(
      'contract C(){function f(bytes32 a,bytes32 b)returns(bytes32 value){'
      + 'value=keccak256(bytes.concat(bytes32(a),bytes32(b)));}}',
      { solidityImportCompat: true },
    );
    expect(yul.bytecode).toBe(direct.bytecode);
  });

  it('mstore + mload round-trips the stored word', () => {
    const yul = compileString(
      'contract C(){function f(uint256 x,uint256 e){uint256 a=0;assembly{mstore(0,x) a:=mload(0)}require(a==e);}}',
    );
    const direct = compileString(
      'contract C(){function f(uint256 x,uint256 e){uint256 a=0;a=x;require(a==e);}}',
    );
    expect(yul.bytecode).toBe(direct.bytecode);
  });

  it('mload(add(ptr, off)) on a bytes parameter == bytes32(ptr[off-32 : off]) (the ECDSA-split pattern)', () => {
    const yul = compileString(
      'contract C(){function f(bytes buf)returns(bytes32 r,bytes32 s){'
      + 'assembly{r:=mload(add(buf,32)) s:=mload(add(buf,64))}}}',
      { solidityImportCompat: true },
    );
    const direct = compileString(
      'contract C(){function f(bytes buf)returns(bytes32 r,bytes32 s){r=bytes32(buf[0:32]);s=bytes32(buf[32:64]);}}',
      { solidityImportCompat: true },
    );
    expect(yul.bytecode).toBe(direct.bytecode);
  });

  it('accepts soft-keyword identifiers (e.g. sig) as Yul variables', () => {
    expect(() => compileString(
      'contract C(){function f(bytes sig)returns(bytes32 r){assembly{r:=mload(add(sig,32))}}}',
      { solidityImportCompat: true },
    )).not.toThrow();
  });
});
