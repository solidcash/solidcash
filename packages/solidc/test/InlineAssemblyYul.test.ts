import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';
import { hexToBin, binToHex } from '@bitauth/libauth';
import { bytecodeToAsm, computeFunctionSelectorHex, hash256, sourceMapToLocationData } from '@solidcash/utils';
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
        }`, { evmCompat: true })).not.toThrow();
    }
  });

  it('lowers returndatasize()/returndatacopy() referencing the last low-level call result', () => {
    expect(() => compileString(`
      contract C() {
        function f(address a) returns (uint s) {
          uint ok;
          assembly { ok := call(0, a, 0, 0, 0, 0, 0) s := returndatasize() returndatacopy(0, 0, s) }
        }
      }`, { evmCompat: true })).not.toThrow();
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
      }`, { evmCompat: true })).not.toThrow();
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
      expect(compileString(asm(yul), { evmCompat: true }).bytecode)
        .toBe(compileString(bare(sol), { evmCompat: true }).bytecode);
    }
    expect(compileString(asm('caller()'), { evmCompat: true }).bytecode)
      .toBe(compileString(bare('uint256(msg.sender)'), { evmCompat: true }).bytecode);
    expect(compileString(asm('coinbase()'), { evmCompat: true }).bytecode)
      .toBe(compileString(bare('uint256(block.coinbase)'), { evmCompat: true }).bytecode);
    expect(compileString(asm('blockhash(1)'), { evmCompat: true }).bytecode)
      .toBe(compileString(bare('uint256(blockhash(1))'), { evmCompat: true }).bytecode);
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
      expect(compileString(asm(yul), { evmCompat: true }).bytecode)
        .toBe(compileString(bare(sol), { evmCompat: true }).bytecode);
    }
  });

  it('lowers balance(addr)/extcodehash(addr)/address() to .balance/.codehash/address(this)', () => {
    const asm = (yul: string): string =>
      `contract C() { function f(address a) { uint b; assembly { b := ${yul} } require(b == b); } }`;
    const bare = (sol: string): string =>
      `contract C() { function f(address a) { uint b; b = ${sol}; require(b == b); } }`;
    const pairs: Array<[string, string]> = [
      ['balance(a)', 'uint256(a.balance)'],
      ['extcodehash(a)', 'uint256(a.codehash)'],
      ['address()', 'uint256(address(this))'],
    ];
    for (const [yul, sol] of pairs) {
      expect(compileString(asm(yul), { evmCompat: true }).bytecode)
        .toBe(compileString(bare(sol), { evmCompat: true }).bytecode);
    }
  });

  it('lowers addmod/mulmod to the solidc builtins and pop to a discard/effect', () => {
    const lowered = (modulus: string, body: (m: string) => string): string => compileString('contract C() {'
      + ` function f(uint a, uint b, uint n) { uint r; ${body(modulus)} require(r == r); } }`, { evmCompat: true }).bytecode;
    const asm = (m: string): string => `assembly { r := addmod(a, b, ${m}) }`;
    const hand = (m: string): string => `r = addmod(a, b, ${m});`;
    expect(lowered('7', asm)).toBe(lowered('7', hand));
    // A runtime modulus also takes the EVM's zero-modulus rule (0, where Solidity's addmod reverts).
    expect(lowered('n', asm)).not.toBe(lowered('n', hand));
    // pop(pure) discards; pop(low-level call) evaluates the call for its effect.
    expect(() => compileString('contract C() { function f(address a) { assembly { pop(add(1, 2))'
      + ' pop(staticcall(0, a, 0, 0, 0, 0)) } require(true); } }', { evmCompat: true })).not.toThrow();
  });

  it('inlines a leaf local Yul function (0-param and parameterised) - param binding + body splice', () => {
    // 0-param: the call yields the body expression, byte-identical to writing it directly.
    const asm = compileString('contract C() { function g() pure returns (uint ret) {'
      + ' assembly { function konst() -> r { r := 1000 } ret := konst() } } }', { evmCompat: true });
    const direct = compileString('contract C() { function g() pure returns (uint ret) { assembly { ret := 1000 } } }',
      { evmCompat: true });
    expect(asm.bytecode).toBe(direct.bytecode);
    // Parameterised: `double(a)` binds v:=a, declares the return, splices the body - byte-identical to that manual form.
    const param = compileString('contract C() { function f(uint a) returns (uint x) {'
      + ' assembly { function double(v) -> r { r := mul(v, 2) } x := double(a) } } }', { evmCompat: true });
    const manual = compileString('contract C() { function f(uint a) returns (uint x) {'
      + ' assembly { let pp := a let rr := 0 rr := mul(pp, 2) x := rr } } }', { evmCompat: true });
    expect(param.bytecode).toBe(manual.bytecode);
    // Multi-statement body + the same function called twice (fresh names per call site) compiles.
    expect(() => compileString('contract C() { function f(uint a) returns (uint x) {'
      + ' assembly { function sq(v) -> r { r := mul(v, v) } x := add(sq(a), sq(a)) } } }', { evmCompat: true }))
      .not.toThrow();
  });

  it('lowers signextend(i, v) for a constant i (branchless sign-extend identity)', () => {
    // signextend(0, v) = sign-extend the low byte. Compiles; the identity ((v&mask)^signBit)-signBit is exercised.
    expect(() => compileString('contract C() { function f(uint v) returns (uint x) { assembly { x := signextend(0, v) } } }',
      { evmCompat: true })).not.toThrow();
    // i >= 31 is a no-op (already full width): byte-identical to reading v directly.
    const noop = compileString('contract C() { function f(uint v) returns (uint x) { assembly { x := signextend(31, v) } } }',
      { evmCompat: true });
    const direct = compileString('contract C() { function f(uint v) returns (uint x) { assembly { x := v } } }',
      { evmCompat: true });
    expect(noop.bytecode).toBe(direct.bytecode);
  });

  it('lowers `x.slot` of a state var to its constant storage-slot number', () => {
    const slotv = compileString('contract C() { int a; int s; function f() returns (uint z) { assembly { z := s.slot } } }',
      { evmCompat: true });
    const num = compileString('contract C() { int a; int s; function f() returns (uint z) { assembly { z := 1 } } }',
      { evmCompat: true });
    expect(slotv.bytecode).toBe(num.bytecode); // s is the 2nd state var -> slot 1
    expect(() => compileString('contract C() { int x; function f() { assembly { sstore(add(x.slot, 1), 4) } require(true); } }',
      { evmCompat: true })).not.toThrow();
  });

  it('accepts the assembly dialect string and ("memory-safe") flags annotation', () => {
    for (const head of ['assembly', 'assembly "evmasm"', 'assembly ("memory-safe")', 'assembly "evmasm" ("memory-safe")']) {
      expect(() => compileString(`contract C() { function f() { uint x; ${head} { x := 1 } require(x == 1); } }`,
        { evmCompat: true })).not.toThrow();
    }
  });

  it('lowers Yul string / hex-string literals to their left-aligned word', () => {
    const strv = compileString('contract C() { function f() returns (uint x) { assembly { x := "abc" } } }',
      { evmCompat: true });
    const word = compileString(`contract C() { function f() returns (uint x) { assembly { x := ${0x616263n << 232n} } } }`,
      { evmCompat: true });
    expect(strv.bytecode).toBe(word.bytecode);
    expect(() => compileString('contract C() { function f() returns (uint x) { assembly { x := hex"112233" } } }',
      { evmCompat: true })).not.toThrow();
  });

  it('lowers invalid() to require(false), and stop() to a halt nothing after runs', () => {
    expect(compileString('contract C() { function f() { assembly { invalid() } require(true); } }',
      { evmCompat: true }).bytecode)
      .toBe(compileString('contract C() { function f() { require(false); require(true); } }',
        { evmCompat: true }).bytecode);
    // The dead `pc()` would leave the block unlowered, and the dead require would run, if either were kept.
    expect(compileString('contract C() { function f() { assembly { stop() let x := pc() } require(true); } }',
      { evmCompat: true }).bytecode)
      .toBe(compileString('contract C() { function f() { assembly { stop() } } }',
        { evmCompat: true }).bytecode);
  });

  it('ends the path of a switch arm that reverts, so the return in the other arm is the function\'s', () => {
    // The arm lowers to require(false), which fails the script: the return beside it is the tail, as in the
    // hand-written branch, and the dead require after the block is dropped. Before, the return was confined. Code
    // generation reads the arm's end as the nesting does, through a nested block too.
    const hand = compileString('contract C() { function f(uint c, uint a) returns (uint) {'
      + ' if (uint(c) == uint(0)) { revert(); } else { return a; } } }', { evmCompat: true });
    for (const arm of ['revert(0, 0)', 'invalid()', '{ revert(0, 0) }']) {
      const yul = compileString('contract C() { function f(uint c, uint a) returns (uint) { assembly {'
        + ` mstore(0, a) switch c case 0 { ${arm} } default { return(0, 32) } } require(a > 1); } }`,
      { evmCompat: true });
      expect(yul.bytecode).toBe(hand.bytecode);
    }
    // Raw bytes are no value of the results, so the confined form refused them; at the tail they are the result.
    expect(() => compileString('contract C() { function f(uint c, uint n) returns (bytes memory) {'
      + ' assembly { mstore(0, c) switch c case 0 { revert(0, 0) } default { return(0, n) } } } }',
    { evmCompat: true })).not.toThrow();
  });

  it('lowers a single-word return(p, 32) to a function return, byte-identical to `return v`', () => {
    // The lowered block ends in a return; it must splice into the function body so the return sits at the tail
    // (a nested block would hide it from the terminal-return codegen and duplicate the trailing covenant).
    const yul = compileString('contract C() { function f(uint a) returns (uint) { assembly { mstore(0, a) return(0, 32) } } }',
      { evmCompat: true, messageBus: false });
    const hand = compileString('contract C() { function f(uint a) returns (uint) { return a; } }', {
      evmCompat: true, messageBus: false,
    });
    expect(yul.bytecode).toBe(hand.bytecode);
    const unreachable = compileString('contract C() { function f(uint a) returns (uint) {'
      + ' assembly { mstore(0, a) return(0, 32) } return 5; } }', {
      evmCompat: true, messageBus: false,
    });
    expect(unreachable.bytecode).toBe(hand.bytecode);
  });

  it('drops the statements after return(p, 32), in its assembly block and after it, as it halts the call', () => {
    // The dead `pc()` would leave the block unlowered, and the dead require would run, if either were kept.
    const yul = compileString('contract C() { function f(uint a) returns (uint) {'
      + ' assembly { mstore(0, a) return(0, 32) let x := pc() } require(a > 1); } }',
    { evmCompat: true, messageBus: false });
    const hand = compileString('contract C() { function f(uint a) returns (uint) { return a; } }', {
      evmCompat: true, messageBus: false,
    });
    expect(yul.bytecode).toBe(hand.bytecode);
  });

  it('constant-folds clz(x) (leading-zero count of a 256-bit word)', () => {
    // clz(0)=256, clz(1)=255, clz(0x4000..0)=1 (bit 254 is the top set bit). Byte-identical to the folded literal.
    const asm = (yul: string): string =>
      `contract C() { function f() { uint r; assembly { r := ${yul} } require(r == r); } }`;
    const bare = (n: string): string =>
      `contract C() { function f() { uint r; r = ${n}; require(r == r); } }`;
    const pairs: Array<[string, string]> = [
      ['clz(0)', '256'],
      ['clz(1)', '255'],
      ['clz(0x4000000000000000000000000000000000000000000000000000000000000000)', '1'],
    ];
    for (const [yul, n] of pairs) {
      expect(compileString(asm(yul), { evmCompat: true }).bytecode)
        .toBe(compileString(bare(n), { evmCompat: true }).bytecode);
    }
  });

  it('lowers a runtime-size return(ptr, size) to the __yulmem byte slice', () => {
    // return(0, x) with a runtime size after constant mstores - the abicoder cross-call idiom. Compiles onto the
    // runtime __yulmem buffer (a bytes result), where the single-word compile-time path cannot apply.
    expect(() => compileString(
      'contract C() { function f(uint x) returns (bytes) { assembly { mstore(0, 0x20) mstore(0x20, 0x21) return(0, x) } } }',
      { evmCompat: true })).not.toThrow();
  });

  it('lowers codecopy/extcodecopy onto the runtime __yulmem buffer (own bytecode / addr.code source)', () => {
    expect(() => compileString(
      'contract C() { function f() { uint r; assembly { codecopy(0, 0, 32) r := mload(0) } require(r == r); } }',
      { evmCompat: true })).not.toThrow();
    expect(() => compileString(
      'contract C() { function f(address a) { uint r; assembly { extcodecopy(a, 0, 0, 32) r := mload(0) } require(r == r); } }',
      { evmCompat: true })).not.toThrow();
  });

  it('lowers calldatacopy: synthesized calldata (msg.sig ++ param words) + a bytes calldata param copy', () => {
    // General form copies the synthesized EVM calldata (msg.sig ++ 32-byte int-param words) into __yulmem.
    expect(() => compileString(
      'contract C() { function f(uint a, uint b) { uint r; assembly { calldatacopy(0, 0, 68) r := mload(0) } require(r == r); } }',
      { evmCompat: true })).not.toThrow();
    // `calldatacopy(dst, P.offset, P.length)` on a bytes calldata param copies the param's bytes directly.
    expect(() => compileString(
      'contract C() { function f(bytes data) { uint r; assembly { let p := mload(0x40) calldatacopy(p, data.offset, data.length) r := mload(p) } require(r == r); } }',
      { evmCompat: true })).not.toThrow();
  });

  it('lowers an empty `let x` and multi-var `let y, z` to zero-initialized words', () => {
    // `let x` == `let x := 0`; multi-var `let y, z` declares both, each 0. Byte-identical to explicit 0-inits.
    const asm = compileString('contract C() { function f() returns (uint a, uint b) { assembly { let x let y, z a := x b := z } } }',
      { evmCompat: true, messageBus: false });
    const hand = compileString('contract C() { function f() returns (uint a, uint b) { uint x = 0; uint y = 0; uint z = 0; a = x; b = z; } }',
      { evmCompat: true, messageBus: false });
    expect(asm.bytecode).toBe(hand.bytecode);
  });

  it('lowers switch cases with hex/string literal values', () => {
    expect(() => compileString(
      'contract C() { function f(uint s) { uint r; assembly { switch s case hex"1122" { r := 1 } case "ab" { r := 2 } default { r := 3 } } require(r == r); } }',
      { evmCompat: true })).not.toThrow();
  });

  it('lowers calldataload(0) / unaligned offsets via the synthesized calldata slice', () => {
    // calldataload(0) = the selector word (msg.sig + partial first arg); no longer a hard reject.
    expect(() => compileString('contract C() { function f() { uint w; assembly { w := calldataload(0) } require(w == w); } }',
      { evmCompat: true })).not.toThrow();
  });

  it('lowers x.length of a bytes/string calldata param and x.offset of a state var', () => {
    expect(() => compileString('contract C() { function f(bytes x) { uint l; assembly { l := x.length } require(l == l); } }',
      { evmCompat: true })).not.toThrow();
    expect(() => compileString('contract C() { uint256 a; uint256 x; function f() { uint s; uint o; assembly { s := x.slot o := x.offset } require(s == o); } }',
      { evmCompat: true })).not.toThrow();
  });

  it('normalizes a keccak256/sha256 result to a uint256 word in a let/assignment binding', () => {
    // `let a := keccak256(p, n)` binds a bytes32 hash to a uint256 Yul var - cast to the word (mstore keeps bytes32).
    expect(() => compileString(
      'contract C() { function f(uint v) returns (uint r) { assembly { mstore(0, v) let h := keccak256(0, 32) r := keccak256(0, 4) r := eq(r, h) } } }',
      { evmCompat: true })).not.toThrow();
  });

  it('drops a dead local Yul function (an unused def with a leave does not block the block; a called one inlines)', () => {
    expect(() => compileString(
      'contract C() { function f() returns (uint r) { assembly { function dead() { leave } function dbl(x) -> y { y := mul(x, 2) } r := dbl(21) } } }',
      { evmCompat: true })).not.toThrow();
  });

  it('normalizes a keccak256 sstore value and accepts a literal address for extcodesize/balance/extcodehash', () => {
    // sstore stores a word - a keccak256 value casts to uint256 (like a let binding).
    expect(() => compileString(
      'contract C() { function f(uint v) { assembly { sstore(0, keccak256(0, 32)) } require(v == v); } }',
      { evmCompat: true })).not.toThrow();
    // a literal (or word) address arg reinterprets to an AddressType, so extcodesize(0)/balance(0)/extcodehash(0) lower.
    expect(() => compileString(
      'contract C() { function f() view returns (uint s) { assembly { s := extcodesize(0) s := balance(0) s := extcodehash(0) } } }',
      { evmCompat: true })).not.toThrow();
  });

  it('inlines a local Yul function with an unconditional leave (dead code after the leave is dropped)', () => {
    // `function f() -> t { t := 2 leave t := 9 }` returns 2; the `t := 9` after the leave is dead.
    expect(() => compileString(
      'contract C() { function f() returns (uint w) { assembly { function g() -> t { t := 2 leave t := 9 } w := g() } } }',
      { evmCompat: true })).not.toThrow();
    // A recursive local function is still (correctly) unsupported.
    expect(() => compileString(
      'contract C() { function f() { assembly { function rec(n) -> r { switch n case 0 { r := 1 } default { r := rec(sub(n, 1)) } } let x := rec(3) } require(true); } }',
      { evmCompat: true })).toThrow(/not yet lowerable|local Yul function/);
  });

  it('lowers Yul inside a fallback/receive function (base traversal skips those separate fields)', () => {
    expect(() => compileString('contract C() { fallback() external { uint x; assembly { x := callvalue() } } }',
      { evmCompat: true })).not.toThrow();
    expect(() => compileString('contract C() { receive() external payable { uint x; assembly { x := caller() } } }',
      { evmCompat: true })).not.toThrow();
  });

  it('lowers mcopy in the compile-time memory model (word-copy = mstore(mload))', () => {
    const mcopy = compileString('contract C() { function f(uint a) returns (uint) { uint r;'
      + ' assembly { mstore(0, a) mcopy(64, 0, 32) r := mload(64) } return r; } }', { evmCompat: true });
    const explicit = compileString('contract C() { function f(uint a) returns (uint) { uint r;'
      + ' assembly { mstore(0, a) mstore(64, mload(0)) r := mload(64) } return r; } }', { evmCompat: true });
    expect(mcopy.bytecode).toBe(explicit.bytecode);
  });

  it('names the specific unlowerable builtin rather than claiming Yul is wholly unsupported', () => {
    // A block whose only blocker is an un-lowered builtin (loadimmutable - immutables are compiler-generated,
    // deferred) reports that builtin by name. (mstore8/mcopy/msize/codecopy/extcodecopy/calldatacopy now lower.)
    expect(() => compileString(`
      contract C() {
        function f() {
          uint x;
          assembly { x := loadimmutable("y") }
          require(x == x);
        }
      }`)).toThrow(/not yet lowerable to BCH script: loadimmutable/);
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
      { evmCompat: true, messageBus: false },
    );
    const direct = compileString(
      'contract C(){function f(bytes32 a,bytes32 b)returns(bytes32 value){'
      + 'value=keccak256(bytes.concat(bytes32(a),bytes32(b)));}}',
      { evmCompat: true, messageBus: false },
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
      { evmCompat: true, messageBus: false },
    );
    const direct = compileString(
      'contract C(){function f(bytes buf)returns(bytes32 r,bytes32 s){r=bytes32(buf.slice(0,32));s=bytes32(buf.slice(32,64));}}',
      { evmCompat: true, messageBus: false },
    );
    expect(yul.bytecode).toBe(direct.bytecode);
  });

  it('accepts soft-keyword identifiers (e.g. sig) as Yul variables', () => {
    expect(() => compileString(
      'contract C(){function f(bytes sig)returns(bytes32 r){assembly{r:=mload(add(sig,32))}}}',
      { evmCompat: true },
    )).not.toThrow();
  });

  it('byte(0, mload(add(sig, 96))) folds to a single in-bounds byte (the v of a 65-byte sig)', () => {
    // A full 32-byte word read at offset 64 of a 65-byte value would be out of bounds; byte(0, ...) needs only
    // sig[64], so it must fold to a 1-byte slice, not a bytes32 read.
    const yul = compileString(
      'contract C(){function f(bytes65 sig)returns(uint8 v){assembly{v:=byte(0,mload(add(sig,96)))}}}',
      { evmCompat: true, messageBus: false },
    );
    const asm = bytecodeToAsm(hexToBin(yul.debug.bytecode));
    // `byte` is a uint256 Yul operation, so its width-normalization need not be byte-identical to a source-level
    // bytes1 access. Pin the important lowering: skip 64 bytes and split exactly one byte, never load a 32-byte
    // word past the end of the 65-byte signature.
    expect(asm).toContain('40 OP_SPLIT OP_NIP OP_1 OP_SPLIT OP_DROP');
  });

  it('compiles the full ecrecover splitSignature (r/s via mload, v via byte(0, mload))', () => {
    expect(() => compileString(
      'contract C(){function f(bytes65 sig)returns(bytes32 r,bytes32 s,uint8 v){'
      + 'assembly{r:=mload(add(sig,32)) s:=mload(add(sig,64)) v:=byte(0,mload(add(sig,96)))}}}',
      { evmCompat: true },
    )).not.toThrow();
  });

  it('a LOCAL string used as a __yulmem pointer in assembly compiles like the bytes-local form (OZ ShortStrings.toString)', () => {
    // `string memory str = new string(32); assembly { mstore(str,len) mstore(add(str,0x20),w) } return str;` rides
    // the SAME __yulmem [length][data] block as a `bytes` local (string == unbounded bytes on BCH), so the emitted
    // script is byte-identical to the bytes form. This is the reachable OZ ShortStrings.toString shape (EACCToken).
    const asString = compileString(
      'contract C(){function f(bytes32 w,uint256 len)returns(string r){'
      + 'string memory str=new string(32);assembly{mstore(str,len) mstore(add(str,0x20),w)}return str;}}',
      { evmCompat: true },
    );
    const asBytes = compileString(
      'contract C(){function f(bytes32 w,uint256 len)returns(bytes r){'
      + 'bytes memory str=new bytes(32);assembly{mstore(str,len) mstore(add(str,0x20),w)}return str;}}',
      { evmCompat: true },
    );
    expect(asString.bytecode).toBe(asBytes.bytecode);
  });
});

// The assembly-statement bytecode region for source lines `lines`, canonicalized by dropping stack-layout
// plumbing (PICK/ROLL/DUP/... and their numeric immediates). The prologue legitimately differs between a
// materialized param and an already-resolved local __yulmem buffer and shifts the stack depth, so the raw
// bytecode differs; what must match is the MEMORY-op body (the mstore/mload splice = SPLIT/CAT/NUM2BIN/...).
const memoryOpBody = (src: string, lines: number[]): string[] => {
  const artifact = compileString(src, { evmCompat: true });
  const tokens = artifact.bytecode.split(' ');
  const locations = sourceMapToLocationData(artifact.debug.sourceMap);
  const region: string[] = [];
  for (let i = 0; i < Math.min(tokens.length, locations.length); i += 1) {
    const line = locations[i].location?.start.line;
    if (line !== undefined && lines.includes(line)) region.push(tokens[i]);
  }
  const STACK_PLUMBING = new Set(['OP_PICK', 'OP_ROLL', 'OP_INVOKE', 'OP_DUP', 'OP_SWAP', 'OP_OVER', 'OP_ROT',
    'OP_2DUP', 'OP_2SWAP', 'OP_3DUP', 'OP_2OVER', 'OP_2ROT', 'OP_NIP', 'OP_DROP', 'OP_TUCK', 'OP_2DROP', 'OP_0',
    'OP_TOALTSTACK', 'OP_FROMALTSTACK']);
  return region.filter((token) => !/^OP_[0-9]+$/.test(token) && !STACK_PLUMBING.has(token));
};

describe('bytes/string memory params and named returns as __yulmem pointers (mstore/mload/mcopy/keccak256)', () => {
  const cc = (src: string): string => compileString(src, { evmCompat: true }).contractName;

  // Every mandated shape in one cross-product: 4 materializations (bytes/string param, bytes/string named
  // return) x 4 pointer ops. The SAME op body is spliced (via __PTR__) into the materialized source and the
  // already-resolved local __yulmem buffer, and their assembly-region memory-op bodies must match.
  const OPS: Record<string, string> = {
    mstore: 'mstore(add(__PTR__, 0x20), 1)',
    mload: 'let w := mload(add(__PTR__, 0x20)) mstore(add(__PTR__, 0x20), w)',
    mcopy: 'mcopy(0, add(__PTR__, 0x20), 32)',
    keccak256: 'let w := keccak256(add(__PTR__, 0x20), 32) mstore(add(__PTR__, 0x20), w)',
  };
  const MATERIALIZED: Record<string, (op: string) => string> = {
    'param-bytes': (op) => `contract C {\n function f(bytes memory p) {\n  assembly { ${op.replace(/__PTR__/g, 'p')} }\n`
      + '  require(true);\n }\n}',
    'param-string': (op) => `contract C {\n function f(string memory p) {\n  assembly { ${op.replace(/__PTR__/g, 'p')} }\n`
      + '  require(true);\n }\n}',
    'namedreturn-bytes': (op) => 'contract C {\n function f() returns (bytes memory o) {\n'
      + `  assembly { ${op.replace(/__PTR__/g, 'o')} }\n }\n}`,
    'namedreturn-string': (op) => 'contract C {\n function f() returns (string memory o) {\n'
      + `  assembly { ${op.replace(/__PTR__/g, 'o')} }\n }\n}`,
  };
  const localBuffer = (op: string): string => 'contract C {\n function f() {\n  bytes memory b = new bytes(32);\n'
    + `  assembly { ${op.replace(/__PTR__/g, 'b')} }\n  require(true);\n }\n}`;

  it('lowers every materialization x pointer-op to the local __yulmem buffer memory-op body', () => {
    for (const [materialization, materialized] of Object.entries(MATERIALIZED)) {
      for (const [opName, opBody] of Object.entries(OPS)) {
        const matRegion = memoryOpBody(materialized(opBody), [3]);
        const localRegion = memoryOpBody(localBuffer(opBody), [4]);
        expect(matRegion, `${materialization} ${opName} produced no assembly region`).not.toHaveLength(0);
        expect(localRegion, `local ${opName} produced no assembly region`).not.toHaveLength(0);
        expect(matRegion, `${materialization} ${opName} memory-op body mismatch`).toEqual(localRegion);
      }
    }
  });

  it('materializes a string param byte-identically to the bytes form', () => {
    const mk = (t: string): string[] => compileString(
      `contract C(){function f(${t} memory p) returns (bytes32 r) {`
      + ' assembly { r := mload(add(p,0x20)) mstore(add(p,0x20), 1) } } }',
      { evmCompat: true }).bytecode.split(' ');
    // A returning entry digests its own call (D50): ordinal 0, then its selector, which the parameter type sets.
    const record = (t: string): string => `0000${computeFunctionSelectorHex(`f(${t})`, true)}`;
    const normalized = (t: string): string[] => {
      const tokens = mk(t);
      expect(tokens).toContain(record(t));
      return tokens.map((token) => (token === record(t) ? '<record>' : token));
    };
    expect(normalized('string')).toEqual(normalized('bytes'));
  });

  it('materializes an uninitialized named-return string byte-identically to the bytes form', () => {
    const mk = (t: string): string => compileString(
      `contract C(){function f(bytes32 w) returns (${t} memory o) {`
      + ' assembly { mstore(o, 32) mstore(add(o,0x20), w) } } }',
      { evmCompat: true });
    expect(mk('bytes').bytecode).toBe(mk('string').bytecode);
  });

  it('keeps the bridge-handled mload read on an unbounded bytes memory param', () => {
    // mload(add(buf,32)) on a bytes memory param is also a materialization candidate; the read must still
    // compile through the parseBytesPtr/bytesMemorySlice bridge (the ECDSA signature-split shape).
    expect(cc('contract C(){function f(bytes memory buf) returns (bytes32 r) {'
      + ' assembly { r := mload(add(buf, 32)) } } }')).toBe('C');
  });
});

// OZ Address / SafeERC20 assembly builtins: revert(ptr,size) aborts, mload(<bytes var>) is its length,
// extcodesize(addr) is addr.code.length. All lower (they are not EVM-fundamental).
describe('Yul revert / extcodesize / bytes-length mload (OZ Address/SafeERC20)', () => {
  it('revert(add(32, rd), mload(rd)) lowers to an unconditional abort (OZ _revert re-throw)', () => {
    const a = compileString(
      'function r(bytes memory rd) pure { assembly { let sz := mload(rd) revert(add(32, rd), sz) } }'
      + ' contract C { int n; function f(bytes d) public { r(d); this.n = 1; } }',
      { evmCompat: true },
    );
    expect(a.contractName).toBe('C');
  });

  it('mload(<bytes memory var>) == the value byte length', () => {
    const yul = compileString(
      'contract C(){function f(bytes buf)returns(uint256 n){assembly{n:=mload(buf)}}}',
      { evmCompat: true, messageBus: false },
    );
    const direct = compileString(
      'contract C(){function f(bytes buf)returns(uint256 n){n=uint256(buf.length);}}',
      { evmCompat: true, messageBus: false },
    );
    expect(yul.bytecode).toBe(direct.bytecode);
  });

  it('extcodesize(addr) == addr.code.length', () => {
    const yul = compileString(
      'contract C(){function f(address a)returns(uint256 s){assembly{s:=extcodesize(a)}}}',
      { evmCompat: true, messageBus: false },
    );
    const direct = compileString(
      'contract C(){function f(address a)returns(uint256 s){s=uint256(a.code.length);}}',
      { evmCompat: true, messageBus: false },
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
      { evmCompat: true, messageBus: false },
    );
    // Yul arithmetic is unchecked; `bigint` factors keep the source's sum unchecked too.
    const direct = compileString(
      'contract C(){uint128 a;uint64 b;uint32 c;uint32 d;function f()returns(uint256 w){'
      + `w=uint256(this.a)+uint256(this.b)*bigint(${POW(128)})+uint256(this.c)*bigint(${POW(192)})`
      + `+uint256(this.d)*bigint(${POW(224)});}}`,
      { evmCompat: true, messageBus: false },
    );
    expect(yul.bytecode).toBe(direct.bytecode);
  });

  it('compiles the EVMStoragePackedSlot read-mask-write pattern', () => {
    expect(() => compileString(
      'contract C(){uint128 s_a;uint64 s_b;uint32 s_c;uint32 s_d;function f(){assembly{'
      + 'let v:=sload(0) let m:=not(sub(shl(128,1),1)) v:=and(v,m) v:=or(v,11) sstore(0,v)}require(true);}}',
      { evmCompat: true },
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
      { evmCompat: true },
    );
    expect(a.stateLayout?.collections?.some((c) => c.name === '__evm_storage')).toBe(true);
  });

  it('routes a computed (non-literal) slot to __evm_storage', () => {
    const a = compileString(
      'contract A { function set(uint256 k, uint256 v) public { assembly { sstore(add(k, 7), v) } } }',
      { evmCompat: true },
    );
    expect(a.stateLayout?.collections?.some((c) => c.name === '__evm_storage')).toBe(true);
  });

  it('does NOT synthesize __evm_storage when the slot maps to a declared var', () => {
    const a = compileString(
      'contract A { uint256 x; function set(uint256 v) public { assembly { sstore(0, v) } }'
      + ' function get() public view returns (uint256) { return this.x; } }',
      { evmCompat: true },
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
      { evmCompat: true },
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
      { evmCompat: true });
    const blob = hexToBin('6960ff60005260206000f3600052600a6016f3');
    const p2sh32 = binToHex(Uint8Array.from([0xaa, 0x20, ...hash256(blob), 0x87]));
    expect(a.bytecode.includes(p2sh32)).toBe(true);
  });
  it('lowers create(0, add(c, 0x20), mload(c)) on a runtime bytes local to the on-stack-derived p2sh32', () => {
    // A runtime bytes value (param/local, e.g. type(D).creationCode) has no compile-time blob, but its deploy
    // address is still p2sh32(c), derived on-stack (OP_HASH256 over c ++ the aa20/87 wrapper). See YulCreateAddress.
    const a = compileString('contract F { function deploy(bytes memory code) external returns (address addr) {'
      + ' assembly { addr := create(0, add(code, 0x20), mload(code)) } require(addr != address(0)); } }',
    { evmCompat: true });
    expect(a.contractName).toBe('F');
  });
  it('still rejects a non-zero-value create on a runtime bytes local (funded deploy needs an output)', () => {
    expect(() => compileString('contract F { function deploy(bytes memory code, uint256 v) external returns'
      + ' (address addr) { assembly { addr := create(v, add(code, 0x20), mload(code)) } } }',
    { evmCompat: true })).toThrow(/no BCH|assembly|create/i);
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
    const a = compileString(clone, { evmCompat: true });
    expect(a.contractName).toBe('C');
    // buffer = prefix(20) || target(20) || suffix(15), hashed, wrapped as p2sh32
    expect(a.bytecode).toContain('3d602d80600a3d3981f3363d3d373d3d3d363d73'); // 20-byte prefix slice
    expect(a.bytecode).toContain('5af43d82803e903d91602b57fd5bf3'); // 15-byte suffix slice
    expect(a.bytecode).toContain('OP_HASH256');
    expect(a.bytecode).toContain('OP_CAT');
  });
  it('still rejects a non-zero-value buffer create (funded deploy needs an output)', () => {
    expect(() => compileString(clone.replace('create(0, ptr, 0x37)', 'create(1, ptr, 0x37)'),
      { evmCompat: true })).toThrow(/no BCH|assembly|create/i);
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
    { evmCompat: true });
    expect(a.contractName).toBe('C');
  });
  it('still lowers the local-alias form (no regression)', () => {
    const a = compileString(`${LIB} contract C { bytes32 constant S = keccak256("s");`
      + ' function f(address v) external { StorageSlot.AddressSlot storage p = StorageSlot.getAddressSlot(S);'
      + ' p.value = v; } }', { evmCompat: true });
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
      + ' function f(address a) external { StorageSlot.getAddressSlot(S).value = a; } }', { evmCompat: true });
    expect(a.contractName).toBe('C');
  });
  it('is byte-identical to the local-pointer form', () => {
    const pre = `${LIB} contract C { bytes32 constant S = keccak256("s"); function f(address a) external { `;
    const inline = compileString(`${pre} StorageSlot.getAddressSlot(S).value = a; } }`, { evmCompat: true });
    const local = compileString(`${pre} StorageSlot.AddressSlot storage p = StorageSlot.getAddressSlot(S); p.value = a; } }`,
      { evmCompat: true });
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
    { evmCompat: true });
    expect(a.contractName).toBe('Prim');
  });
  it('accepts a mix of named and unnamed return values under compat', () => {
    const a = compileString('contract C { function f() public pure returns (bytes32 p, uint256[] memory) {'
      + ' p = bytes32(0); uint256[] memory a2; return (p, a2); } }', { evmCompat: true });
    expect(a.contractName).toBe('C');
  });
  it('accepts a mix of named/unnamed returns natively (always on, the default)', () => {
    const a = compileString('contract C { function f() returns (int p, int) { return (1, 2); } }');
    expect(a.contractName).toBe('C');
  });
  it('compiles new bytes(n) with a runtime length to n zero bytes (0 n OP_NUM2BIN)', () => {
    // Runtime `new bytes(n)` is a real allocation now (the memory model's malloc growth primitive).
    expect(compileString('contract C { function f(uint n) external pure returns (bytes memory) {'
      + ' return new bytes(n); } }', { evmCompat: true }).contractName).toBe('C');
  });
  it('still folds new bytes(constant) to a zero-filled literal', () => {
    expect(compileString('contract C { function f() external pure returns (bytes memory) { return new bytes(4); } }',
      { evmCompat: true }).contractName).toBe('C');
  });
});
