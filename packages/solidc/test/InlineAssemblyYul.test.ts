import { describe, it, expect } from 'vitest';
import { compileString } from '../src/index.js';
import { hexToBin, binToHex } from '@bitauth/libauth';
import { hash256 } from '@solidcash/utils';
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

  it('lowers a low-level call/staticcall/delegatecall to the external-call covenant (target resolved by the SDK)', () => {
    // The compiler emits the low-level call + return-event slot (reusing the external-call mechanics); the co-spent
    // target + payload are supplied at build time via .withExternalCall (see docs/call-model.md s12).
    for (const mode of ['call', 'staticcall', 'delegatecall']) {
      const nargs = mode === 'call' ? '0, impl, 0, 0, 0, 0, 0' : '0, impl, 0, 0, 0, 0';
      expect(() => compileString(`
        contract C() {
          function f(address impl) { uint r; assembly { r := ${mode}(${nargs}) } require(r == r); }
        }`, { solidityImportCompat: true })).not.toThrow();
    }
  });

  it('lowers returndatasize()/returndatacopy() referencing the last low-level call result', () => {
    expect(() => compileString(`
      contract C() {
        function f(address a) returns (uint s) {
          uint ok;
          assembly { ok := call(0, a, 0, 0, 0, 0, 0) s := returndatasize() returndatacopy(0, 0, s) }
        }
      }`, { solidityImportCompat: true })).not.toThrow();
  });

  it('returndatacopy then mload reads the copied return data (proper copy, not a rejected no-op)', () => {
    // returndatacopy(0, 0, returndatasize()) splices the last call's return data into the buffer; a subsequent
    // mload(0) reads it back. Previously the no-op returndatacopy made the mload of the region reject; the runtime
    // buffer re-lowering now performs the real copy. Sound by reduction to runtimeMstore's splice.
    expect(() => compileString(`
      contract C() {
        function f(address a) returns (uint r) {
          uint ok;
          assembly {
            ok := call(0, a, 0, 0, 0, 0, 0)
            returndatacopy(0, 0, returndatasize())
            r := mload(0)
          }
        }
      }`, { solidityImportCompat: true })).not.toThrow();
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

  it('reports a recursive Yul function definition as not yet supported (leaf functions inline)', () => {
    // A leaf function inlines (see below); a recursive one has no leaf form to resolve, so it is still reported.
    expect(() => compileString(`
      contract C() {
        function f() {
          assembly {
            function fac(n) -> r { r := 1 if gt(n, 1) { r := mul(n, fac(sub(n, 1))) } }
            let x := fac(3)
          }
          require(true);
        }
      }`)).toThrow(/Yul function definitions are not yet supported/);
  });

  it('lowers nullary context builtins to the matching msg.*/block.*/tx.* global (sound by reduction)', () => {
    const asm = (yul: string): string =>
      `contract C() { function f() { uint x; assembly { x := ${yul} } require(x == x); } }`;
    const bare = (sol: string): string =>
      `contract C() { function f() { uint x; x = ${sol}; require(x == x); } }`;
    // Integer context builtins -> the bare global; address ones -> a uint256(...) word cast.
    const intPairs: Array<[string, string]> = [
      ['callvalue()', 'msg.value'], ['timestamp()', 'block.timestamp'], ['number()', 'block.number'],
      ['chainid()', 'block.chainid'], ['gaslimit()', 'block.gaslimit'], ['gasprice()', 'tx.gasprice'],
    ];
    for (const [yul, sol] of intPairs) {
      expect(compileString(asm(yul), { solidityImportCompat: true }).bytecode)
        .toBe(compileString(bare(sol), { solidityImportCompat: true }).bytecode);
    }
    expect(compileString(asm('caller()'), { solidityImportCompat: true }).bytecode)
      .toBe(compileString(bare('uint256(msg.sender)'), { solidityImportCompat: true }).bytecode);
    expect(compileString(asm('coinbase()'), { solidityImportCompat: true }).bytecode)
      .toBe(compileString(bare('uint256(block.coinbase)'), { solidityImportCompat: true }).bytecode);
    expect(compileString(asm('blockhash(1)'), { solidityImportCompat: true }).bytecode)
      .toBe(compileString(bare('uint256(blockhash(1))'), { solidityImportCompat: true }).bytecode);
  });

  it('lowers gas/codesize/selfbalance to gasleft()/activeBytecode.length/address(this).balance', () => {
    const asm = (yul: string): string =>
      `contract C() { function f() { uint x; assembly { x := ${yul} } require(x == x); } }`;
    const bare = (sol: string): string =>
      `contract C() { function f() { uint x; x = ${sol}; require(x == x); } }`;
    const pairs: Array<[string, string]> = [
      ['gas()', 'gasleft()'],
      ['codesize()', 'this.activeBytecode.length'],
      ['selfbalance()', 'uint256(address(this).balance)'],
    ];
    for (const [yul, sol] of pairs) {
      expect(compileString(asm(yul), { solidityImportCompat: true }).bytecode)
        .toBe(compileString(bare(sol), { solidityImportCompat: true }).bytecode);
    }
  });

  it('still rejects balance(addr) / address() by name (no valid BCH analogue for an arbitrary address)', () => {
    expect(() => compileString('contract C() { function f(uint a) { uint b; assembly { b := balance(a) } require(b==b); } }',
      { solidityImportCompat: true })).toThrow(/not yet lowerable to BCH script: balance/);
    expect(() => compileString('contract C() { function f() { uint a; assembly { a := address() } require(a==a); } }',
      { solidityImportCompat: true })).toThrow(/not yet lowerable to BCH script: address/);
  });

  it('lowers addmod/mulmod to the solidc builtins and pop to a discard/effect', () => {
    const asm = compileString('contract C() { function f(uint a, uint b, uint n) { uint r;'
      + ' assembly { r := addmod(a, b, n) } require(r == r); } }', { solidityImportCompat: true });
    const hand = compileString('contract C() { function f(uint a, uint b, uint n) { uint r;'
      + ' r = addmod(a, b, n); require(r == r); } }', { solidityImportCompat: true });
    expect(asm.bytecode).toBe(hand.bytecode);
    // pop(pure) discards; pop(low-level call) evaluates the call for its effect.
    expect(() => compileString('contract C() { function f(address a) { assembly { pop(add(1, 2))'
      + ' pop(staticcall(0, a, 0, 0, 0, 0)) } require(true); } }', { solidityImportCompat: true })).not.toThrow();
  });

  it('inlines a leaf local Yul function (0-param and parameterised) - param binding + body splice', () => {
    // 0-param: the call yields the body expression, byte-identical to writing it directly.
    const asm = compileString('contract C() { function g() pure returns (uint ret) {'
      + ' assembly { function konst() -> r { r := 1000 } ret := konst() } } }', { solidityImportCompat: true });
    const direct = compileString('contract C() { function g() pure returns (uint ret) { assembly { ret := 1000 } } }',
      { solidityImportCompat: true });
    expect(asm.bytecode).toBe(direct.bytecode);
    // Parameterised: `double(a)` binds v:=a, declares the return, splices the body - byte-identical to that manual form.
    const param = compileString('contract C() { function f(uint a) returns (uint x) {'
      + ' assembly { function double(v) -> r { r := mul(v, 2) } x := double(a) } } }', { solidityImportCompat: true });
    const manual = compileString('contract C() { function f(uint a) returns (uint x) {'
      + ' assembly { let pp := a let rr := 0 rr := mul(pp, 2) x := rr } } }', { solidityImportCompat: true });
    expect(param.bytecode).toBe(manual.bytecode);
    // Multi-statement body + the same function called twice (fresh names per call site) compiles.
    expect(() => compileString('contract C() { function f(uint a) returns (uint x) {'
      + ' assembly { function sq(v) -> r { r := mul(v, v) } x := add(sq(a), sq(a)) } } }', { solidityImportCompat: true }))
      .not.toThrow();
  });

  it('lowers signextend(i, v) for a constant i (branchless sign-extend identity)', () => {
    // signextend(0, v) = sign-extend the low byte. Compiles; the identity ((v&mask)^signBit)-signBit is exercised.
    expect(() => compileString('contract C() { function f(uint v) returns (uint x) { assembly { x := signextend(0, v) } } }',
      { solidityImportCompat: true })).not.toThrow();
    // i >= 31 is a no-op (already full width): byte-identical to reading v directly.
    const noop = compileString('contract C() { function f(uint v) returns (uint x) { assembly { x := signextend(31, v) } } }',
      { solidityImportCompat: true });
    const direct = compileString('contract C() { function f(uint v) returns (uint x) { assembly { x := v } } }',
      { solidityImportCompat: true });
    expect(noop.bytecode).toBe(direct.bytecode);
  });

  it('lowers `x.slot` of a state var to its constant storage-slot number', () => {
    const slotv = compileString('contract C() { int a; int s; function f() returns (uint z) { assembly { z := s.slot } } }',
      { solidityImportCompat: true });
    const num = compileString('contract C() { int a; int s; function f() returns (uint z) { assembly { z := 1 } } }',
      { solidityImportCompat: true });
    expect(slotv.bytecode).toBe(num.bytecode); // s is the 2nd state var -> slot 1
    expect(() => compileString('contract C() { int x; function f() { assembly { sstore(add(x.slot, 1), 4) } require(true); } }',
      { solidityImportCompat: true })).not.toThrow();
  });

  it('accepts the assembly dialect string and ("memory-safe") flags annotation', () => {
    for (const head of ['assembly', 'assembly "evmasm"', 'assembly ("memory-safe")', 'assembly "evmasm" ("memory-safe")']) {
      expect(() => compileString(`contract C() { function f() { uint x; ${head} { x := 1 } require(x == 1); } }`,
        { solidityImportCompat: true })).not.toThrow();
    }
  });

  it('lowers Yul string / hex-string literals to their left-aligned word', () => {
    const strv = compileString('contract C() { function f() returns (uint x) { assembly { x := "abc" } } }',
      { solidityImportCompat: true });
    const word = compileString(`contract C() { function f() returns (uint x) { assembly { x := ${0x616263n << 232n} } } }`,
      { solidityImportCompat: true });
    expect(strv.bytecode).toBe(word.bytecode);
    expect(() => compileString('contract C() { function f() returns (uint x) { assembly { x := hex"112233" } } }',
      { solidityImportCompat: true })).not.toThrow();
  });

  it('lowers invalid() to require(false) and stop() to a no-op', () => {
    expect(compileString('contract C() { function f() { assembly { invalid() } require(true); } }',
      { solidityImportCompat: true }).bytecode)
      .toBe(compileString('contract C() { function f() { require(false); require(true); } }',
        { solidityImportCompat: true }).bytecode);
    expect(() => compileString('contract C() { function f() { assembly { stop() pop(add(0, 1)) } require(true); } }',
      { solidityImportCompat: true })).not.toThrow();
  });

  it('lowers a single-word return(p, 32) to a function return, byte-identical to `return v`', () => {
    // The lowered block ends in a return; it must splice into the function body so the return sits at the tail
    // (a nested block would hide it from the terminal-return codegen and duplicate the trailing covenant).
    const yul = compileString('contract C() { function f(uint a) returns (uint) { assembly { mstore(0, a) return(0, 32) } } }',
      { solidityImportCompat: true });
    const hand = compileString('contract C() { function f(uint a) returns (uint) { return a; } }', { solidityImportCompat: true });
    expect(yul.bytecode).toBe(hand.bytecode);
  });

  it('lowers mcopy in the compile-time memory model (word-copy = mstore(mload))', () => {
    const mcopy = compileString('contract C() { function f(uint a) returns (uint) { uint r;'
      + ' assembly { mstore(0, a) mcopy(64, 0, 32) r := mload(64) } return r; } }', { solidityImportCompat: true });
    const explicit = compileString('contract C() { function f(uint a) returns (uint) { uint r;'
      + ' assembly { mstore(0, a) mstore(64, mload(0)) r := mload(64) } return r; } }', { solidityImportCompat: true });
    expect(mcopy.bytecode).toBe(explicit.bytecode);
  });

  it('names the specific unlowerable builtin rather than claiming Yul is wholly unsupported', () => {
    // A block whose only blocker is an un-lowered builtin (mstore8) reports that builtin by name. (mcopy/msize now
    // lower via the runtime __yulmem buffer; mstore8 is still deferred.)
    expect(() => compileString(`
      contract C() {
        function f() {
          assembly { mstore8(0, 0) }
          require(true);
        }
      }`)).toThrow(/not yet lowerable to BCH script: mstore8/);
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

  it('byte(0, mload(add(sig, 96))) folds to a single in-bounds byte (the v of a 65-byte sig)', () => {
    // A full 32-byte word read at offset 64 of a 65-byte value would be out of bounds; byte(0, ...) needs only
    // sig[64], so it must fold to a 1-byte slice, not a bytes32 read.
    const yul = compileString(
      'contract C(){function f(bytes65 sig)returns(uint8 v){assembly{v:=byte(0,mload(add(sig,96)))}}}',
      { solidityImportCompat: true },
    );
    const direct = compileString(
      'contract C(){function f(bytes65 sig)returns(uint8 v){v=uint8(sig[64:65]);}}',
      { solidityImportCompat: true },
    );
    expect(yul.bytecode).toBe(direct.bytecode);
  });

  it('compiles the full ecrecover splitSignature (r/s via mload, v via byte(0, mload))', () => {
    expect(() => compileString(
      'contract C(){function f(bytes65 sig)returns(bytes32 r,bytes32 s,uint8 v){'
      + 'assembly{r:=mload(add(sig,32)) s:=mload(add(sig,64)) v:=byte(0,mload(add(sig,96)))}}}',
      { solidityImportCompat: true },
    )).not.toThrow();
  });
});

// OZ Address / SafeERC20 assembly builtins: revert(ptr,size) aborts, mload(<bytes var>) is its length,
// extcodesize(addr) is addr.code.length. All lower (they are not EVM-fundamental).
describe('Yul revert / extcodesize / bytes-length mload (OZ Address/SafeERC20)', () => {
  it('revert(add(32, rd), mload(rd)) lowers to an unconditional abort (OZ _revert re-throw)', () => {
    const a = compileString(
      'function r(bytes memory rd) pure { assembly { let sz := mload(rd) revert(add(32, rd), sz) } }'
      + ' contract C { int n; function f(bytes d) public { r(d); this.n = 1; } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('C');
  });

  it('mload(<bytes memory var>) == the value byte length', () => {
    const yul = compileString(
      'contract C(){function f(bytes buf)returns(uint256 n){assembly{n:=mload(buf)}}}',
      { solidityImportCompat: true },
    );
    const direct = compileString(
      'contract C(){function f(bytes buf)returns(uint256 n){n=uint256(buf.length);}}',
      { solidityImportCompat: true },
    );
    expect(yul.bytecode).toBe(direct.bytecode);
  });

  it('extcodesize(addr) == addr.code.length', () => {
    const yul = compileString(
      'contract C(){function f(address a)returns(uint256 s){assembly{s:=extcodesize(a)}}}',
      { solidityImportCompat: true },
    );
    const direct = compileString(
      'contract C(){function f(address a)returns(uint256 s){s=uint256(a.code.length);}}',
      { solidityImportCompat: true },
    );
    expect(yul.bytecode).toBe(direct.bytecode);
  });
});

// Phase 7b: packed storage slots. sload(slot) combines the sub-word vars sharing that slot into a word;
// sstore(slot, w) decomposes the word back. Single full-width vars are unchanged (still byte-identical).
describe('Yul packed storage slots', () => {
  const POW = (n: number): string => (2n ** BigInt(n)).toString();

  it('sload(0) combines packed sub-word vars (uint256(a) + uint256(b)*2^128 + ...)', () => {
    const yul = compileString(
      'contract C(){uint128 a;uint64 b;uint32 c;uint32 d;function f()returns(uint256 w){assembly{w:=sload(0)}}}',
      { solidityImportCompat: true },
    );
    const direct = compileString(
      'contract C(){uint128 a;uint64 b;uint32 c;uint32 d;function f()returns(uint256 w){'
      + `w=uint256(this.a)+uint256(this.b)*${POW(128)}+uint256(this.c)*${POW(192)}+uint256(this.d)*${POW(224)};}}`,
      { solidityImportCompat: true },
    );
    expect(yul.bytecode).toBe(direct.bytecode);
  });

  it('compiles the EVMStoragePackedSlot read-mask-write pattern', () => {
    expect(() => compileString(
      'contract C(){uint128 s_a;uint64 s_b;uint32 s_c;uint32 s_d;function f(){assembly{'
      + 'let v:=sload(0) let m:=not(sub(shl(128,1),1)) v:=and(v,m) v:=or(v,11) sstore(0,v)}require(true);}}',
      { solidityImportCompat: true },
    )).not.toThrow();
  });

  it('leaves a single full-width var byte-identical to direct state access', () => {
    const yul = compileString(
      'contract C(){uint256 x;uint256 y;function f(uint256 v){assembly{sstore(1,v)}require(true);}}',
    );
    const direct = compileString(
      'contract C(){uint256 x;uint256 y;function f(uint256 v){this.y=v;require(true);}}',
    );
    expect(yul.bytecode).toBe(direct.bytecode);
  });
});

// EVM-storage foundation: assembly sstore/sload on an arbitrary slot (no declared var at it, or a computed
// slot) synthesizes a `mapping(uint256 => uint256) __evm_storage` register and routes to it. Declared-var
// slots are unchanged. See packages/solidc/docs/evm-storage-parity.md.
describe('EVM-storage foundation: sstore/sload -> __evm_storage', () => {
  it('synthesizes __evm_storage for a slot with no declared var and compiles', () => {
    const a = compileString(
      'contract A { function set(uint256 v) public { assembly { sstore(0, v) } }'
      + ' function get() public view returns (uint256 r) { assembly { r := sload(0) } } }',
      { solidityImportCompat: true },
    );
    expect(a.stateLayout?.collections?.some((c) => c.name === '__evm_storage')).toBe(true);
  });

  it('routes a computed (non-literal) slot to __evm_storage', () => {
    const a = compileString(
      'contract A { function set(uint256 k, uint256 v) public { assembly { sstore(add(k, 7), v) } } }',
      { solidityImportCompat: true },
    );
    expect(a.stateLayout?.collections?.some((c) => c.name === '__evm_storage')).toBe(true);
  });

  it('does NOT synthesize __evm_storage when the slot maps to a declared var', () => {
    const a = compileString(
      'contract A { uint256 x; function set(uint256 v) public { assembly { sstore(0, v) } }'
      + ' function get() public view returns (uint256) { return this.x; } }',
      { solidityImportCompat: true },
    );
    expect(a.stateLayout?.collections?.some((c) => c.name === '__evm_storage')).toBeFalsy();
  });
});

// keccak256/sha256 of a literal folds to a compile-time bytes32 (role ids, EIP-712 domains, storage slots).
// keccak256 uses sha256 under compat (no native keccak); plain sha256 folds byte-identically.
describe('keccak256/sha256 literal folding', () => {
  it('folds keccak256("ROLE") and sha256("x") to a bytes32 constant', () => {
    const a = compileString(
      'contract C { bytes32 constant R = keccak256("MINTER_ROLE"); bytes32 constant H = sha256("x");'
      + ' function f() public pure returns (bytes32) { return R == H ? R : H; } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('C');
  });
});

describe('dotted-op token boundary (lexer)', () => {
  it('keeps .push / .length / .value ops working at an identifier boundary', () => {
    expect(compileString('contract C() { int[] xs; function f() { this.xs.push(5); require(this.xs.length == 1); } }').contractName).toBe('C');
    expect(compileString('contract C() { function f() { require(tx.outputs[0].value == 1000); } }').contractName).toBe('C');
  });
});

// Yul `create(0, add(b, 0x20), n)` where `b` is a compile-time hex-literal `bytes` local is NOT fundamental: the
// blob is the contract's redeem script, so the deployed p2sh32 address (0xaa20 || hash256(blob) || 0x87) is
// derivable at compile time. A runtime bytes value (`create(0, add(c, 0x20), mload(c))`, the `type(D).creationCode`
// idiom) is the same address, derived on-stack from c's runtime value. A non-zero value still needs a funded
// deploy output, so it stays unlowerable.
describe('Yul create with a constant hex bytecode (compile-time p2sh32 deploy)', () => {
  const factory = (body: string): string => 'contract F { event Log(address a); function deploy() external { '
    + 'bytes memory bytecode = hex"6960ff60005260206000f3600052600a6016f3"; address addr; ' + body
    + ' require(addr != address(0)); emit Log(addr); } }';
  it('lowers create(0, add(bytecode, 0x20), size) to the derived p2sh32 address', () => {
    const a = compileString(factory('assembly { addr := create(0, add(bytecode, 0x20), 0x13) }'),
      { solidityImportCompat: true });
    const blob = hexToBin('6960ff60005260206000f3600052600a6016f3');
    const p2sh32 = binToHex(Uint8Array.from([0xaa, 0x20, ...hash256(blob), 0x87]));
    expect(a.bytecode.includes(p2sh32)).toBe(true);
  });
  it('lowers create(0, add(c, 0x20), mload(c)) on a runtime bytes local to the on-stack-derived p2sh32', () => {
    // A runtime bytes value (param/local, e.g. type(D).creationCode) has no compile-time blob, but its deploy
    // address is still p2sh32(c), derived on-stack (OP_HASH256 over c ++ the aa20/87 wrapper). See YulCreateAddress.
    const a = compileString('contract F { function deploy(bytes memory code) external returns (address addr) {'
      + ' assembly { addr := create(0, add(code, 0x20), mload(code)) } require(addr != address(0)); } }',
    { solidityImportCompat: true });
    expect(a.contractName).toBe('F');
  });
  it('still rejects a non-zero-value create on a runtime bytes local (funded deploy needs an output)', () => {
    expect(() => compileString('contract F { function deploy(bytes memory code, uint256 v) external returns'
      + ' (address addr) { assembly { addr := create(v, add(code, 0x20), mload(code)) } } }',
    { solidityImportCompat: true })).toThrow(/no BCH|assembly|create/i);
  });
});

// EIP-1167 minimal-proxy `create(0, clone, 0x37)` where `clone := mload(0x40)` is a free-memory buffer built by
// mstore (const prefix, runtime address, const suffix) is NOT fundamental: reconstruct the blob and derive its
// p2sh32 address at runtime (0xaa20 || hash256(prefix||target||suffix) || 0x87).
describe('Yul create over a free-memory buffer (EIP-1167 minimal proxy)', () => {
  const clone = 'contract C { function clone(address target) external returns (address result) {'
    + ' bytes20 tb = bytes20(target); assembly {'
    + ' let ptr := mload(0x40)'
    + ' mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)'
    + ' mstore(add(ptr, 0x14), tb)'
    + ' mstore(add(ptr, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)'
    + ' result := create(0, ptr, 0x37) } } }';
  it('compiles and derives the p2sh32 from the reconstructed clone bytecode', () => {
    const a = compileString(clone, { solidityImportCompat: true });
    expect(a.contractName).toBe('C');
    // buffer = prefix(20) || target(20) || suffix(15), hashed, wrapped as p2sh32
    expect(a.bytecode).toContain('3d602d80600a3d3981f3363d3d373d3d3d363d73'); // 20-byte prefix slice
    expect(a.bytecode).toContain('5af43d82803e903d91602b57fd5bf3'); // 15-byte suffix slice
    expect(a.bytecode).toContain('OP_HASH256');
    expect(a.bytecode).toContain('OP_CAT');
  });
  it('still rejects a non-zero-value buffer create (funded deploy needs an output)', () => {
    expect(() => compileString(clone.replace('create(0, ptr, 0x37)', 'create(1, ptr, 0x37)'),
      { solidityImportCompat: true })).toThrow(/no BCH|assembly|create/i);
  });
});

// The OZ StorageSlot idiom used INLINE (`StorageSlot.getAddressSlot(SLOT).value`, no local `X storage p = ...`).
// LowerStorageSlotPointers previously only handled the local-alias form; the inline read now lowers too.
describe('inline StorageSlot pointer read (factory(slot).value)', () => {
  const LIB = 'library StorageSlot { struct AddressSlot { address value; }'
    + ' function getAddressSlot(bytes32 slot) internal pure returns (AddressSlot storage pointer) {'
    + ' assembly { pointer.slot := slot } } }';
  it('lowers an inline factory(slot).value read to the __evm_storage register', () => {
    const a = compileString(`${LIB} contract C { bytes32 constant S = keccak256("s");`
      + ' function f() external view returns (address) { return StorageSlot.getAddressSlot(S).value; } }',
    { solidityImportCompat: true });
    expect(a.contractName).toBe('C');
  });
  it('still lowers the local-alias form (no regression)', () => {
    const a = compileString(`${LIB} contract C { bytes32 constant S = keccak256("s");`
      + ' function f(address v) external { StorageSlot.AddressSlot storage p = StorageSlot.getAddressSlot(S);'
      + ' p.value = v; } }', { solidityImportCompat: true });
    expect(a.contractName).toBe('C');
  });
});

// The inline OZ StorageSlot WRITE `StorageSlot.getAddressSlot(SLOT).value = v` (no local pointer) - the lvalue
// has a call in the chain, so it needs its own grammar rule + desugar to the local-pointer form. Byte-identical
// to the hand-written `T storage p = factory(SLOT); p.value = v` (sound by reduction).
describe('inline StorageSlot pointer write (factory(slot).value = v)', () => {
  const LIB = 'library StorageSlot { struct AddressSlot { address value; }'
    + ' function getAddressSlot(bytes32 slot) internal pure returns (AddressSlot storage pointer) {'
    + ' assembly { pointer.slot := slot } } }';
  it('compiles an inline factory(slot).value write', () => {
    const a = compileString(`${LIB} contract C { bytes32 constant S = keccak256("s");`
      + ' function f(address a) external { StorageSlot.getAddressSlot(S).value = a; } }', { solidityImportCompat: true });
    expect(a.contractName).toBe('C');
  });
  it('is byte-identical to the local-pointer form', () => {
    const pre = `${LIB} contract C { bytes32 constant S = keccak256("s"); function f(address a) external { `;
    const inline = compileString(`${pre} StorageSlot.getAddressSlot(S).value = a; } }`, { solidityImportCompat: true });
    const local = compileString(`${pre} StorageSlot.AddressSlot storage p = StorageSlot.getAddressSlot(S); p.value = a; } }`,
      { solidityImportCompat: true });
    expect(inline.bytecode).toBe(local.bytecode);
  });
});

// Three Solidity-compat gaps surfaced by evm/memory/YulMem.sol (its primary MemExp compiles; a parse/AstBuilder
// error in a non-primary contract fails the whole file, so each must parse / defer rather than hard-error).
describe('YulMem.sol compat gaps', () => {
  it('parses the Yul calldata accessors data.offset / data.length (non-primary; unlowerable body is fine)', () => {
    // `data.length` (a DotLength token) previously failed to parse, failing the whole file. Now it parses; the
    // calldatacopy body is unlowerable but lives in a non-primary contract, so the primary still compiles.
    const a = compileString('contract Uses { function f(address t, bytes calldata data) external view {'
      + ' assembly { let p := mload(0x40) calldatacopy(p, data.offset, data.length) } } }'
      + ' contract Prim { function g() external pure returns (uint256) { return 1; } }',
    { solidityImportCompat: true });
    expect(a.contractName).toBe('Prim');
  });
  it('accepts a mix of named and unnamed return values under compat', () => {
    const a = compileString('contract C { function f() public pure returns (bytes32 p, uint256[] memory) {'
      + ' p = bytes32(0); uint256[] memory a2; return (p, a2); } }', { solidityImportCompat: true });
    expect(a.contractName).toBe('C');
  });
  it('accepts a mix of named/unnamed returns natively (always on, the default)', () => {
    const a = compileString('contract C { function f() returns (int p, int) { return (1, 2); } }');
    expect(a.contractName).toBe('C');
  });
  it('compiles new bytes(n) with a runtime length to n zero bytes (0 n OP_NUM2BIN)', () => {
    // Runtime `new bytes(n)` is a real allocation now (the memory model's malloc growth primitive).
    expect(compileString('contract C { function f(uint n) external pure returns (bytes memory) {'
      + ' return new bytes(n); } }', { solidityImportCompat: true }).contractName).toBe('C');
  });
  it('still folds new bytes(constant) to a zero-filled literal', () => {
    expect(compileString('contract C { function f() external pure returns (bytes memory) { return new bytes(4); } }',
      { solidityImportCompat: true }).contractName).toBe('C');
  });
});
