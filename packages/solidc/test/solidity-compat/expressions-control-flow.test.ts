import { describe, it, expect } from 'vitest';
import { compileString } from './helpers.js';

// Focused regression guards derived from the Solidity compiler corpus.
describe('Solidity function-context restrictions', () => {
  const cc = (src: string): string =>
    compileString(src, { solidityImportCompat: true }).contractName;

  it('rejects a function with the same name as its contract', () => {
    expect(() => cc('contract A { function A() public {} }'))
      .toThrow(/cannot have the same name as its contract/i);
  });

  it('rejects internal function-pointer parameters on concrete constructors', () => {
    expect(() => cc('contract A { constructor(function() internal callback) {} }'))
      .toThrow(/internal function type is not allowed in a concrete constructor/i);
  });

  it('allows an internal function-pointer parameter on an abstract constructor', () => {
    expect(cc('abstract contract A { constructor(function() internal callback) {} }')).toBe('A');
  });

  it('rejects msg.data inside receive while retaining it in fallback', () => {
    expect(() => cc('contract C { receive() external payable { msg.data; } }'))
      .toThrow(/msg\.data.*cannot be used inside a receive/i);
    expect(cc('contract C { fallback() external { msg.data; } }')).toBe('C');
  });
});

describe('constant zero-divisor diagnostics', () => {
  const cc = (src: string): string =>
    compileString(src, { solidityImportCompat: true }).contractName;

  it('rejects division and modulo by a resolved zero constant', () => {
    expect(() => cc('contract C { uint constant Z = 0; uint constant X = 7 / Z; }'))
      .toThrow(/division by zero/i);
    expect(() => cc('contract C { uint constant O = 1; uint constant X = 7 % (O - 1); }'))
      .toThrow(/modulo zero/i);
  });

  it('rejects addmod and mulmod with a resolved zero modulus', () => {
    expect(() => cc('contract C { uint constant Z = 0; uint constant X = addmod(3, 4, Z); }'))
      .toThrow(/arithmetic modulo zero/i);
    expect(() => cc('contract C { uint constant O = 1; uint constant X = mulmod(3, 4, O - 1); }'))
      .toThrow(/arithmetic modulo zero/i);
  });

  it('retains non-zero constant arithmetic', () => {
    expect(cc(
      'contract C { uint constant D = 2; uint constant A = 8 / D;'
      + ' uint constant B = 7 % D; uint constant X = addmod(A, B, D); }',
    )).toBe('C');
  });
});

describe('hex string separator validation', () => {
  const cc = (literal: string): string => compileString(
    `contract C { function f() public pure { bytes memory x = ${literal}; } }`,
    { solidityImportCompat: true },
  ).contractName;

  it.each(['hex"_1234"', 'hex"1234_"', 'hex"12__34"', 'hex"1_234"'])(
    'rejects invalid separator placement in %s',
    (literal) => expect(() => cc(literal)).toThrow(/hex string separator/i),
  );

  it('accepts separators between complete byte groups', () => {
    expect(cc('hex"12_3456_789012"')).toBe('C');
  });
});

describe('constant index range validation', () => {
  const cc = (body: string): string => compileString(
    `contract C { function f() public pure { ${body} } }`,
    { solidityImportCompat: true },
  ).contractName;

  it('rejects literal fixed-bytes indices at or beyond the byte width', () => {
    expect(() => cc('bytes32 b; bytes1 x = b[64];')).toThrow(/out of bounds/i);
  });

  it('rejects uint256-overflowing constant indices', () => {
    const huge = '888888888888888888888888888888888888888888888888888888888888888888888888888888888888';
    expect(() => cc(`bytes memory b; bytes1 x = b[${huge}];`))
      .toThrow(/cannot be represented as an unsigned integer/i);
  });

  it('checks folded constant indices against fixed array bounds', () => {
    expect(() => cc('bytes[32] memory a; bytes memory x = a[8**90];')).toThrow(/out of bounds/i);
  });

  it('retains in-range fixed bytes and array indexing', () => {
    expect(cc('bytes32 b; bytes1 x = b[31]; bytes[2] memory a; bytes memory y = a[1];')).toBe('C');
  });
});

describe('Solidity low-level call value options', () => {
  it.each(['staticcall', 'delegatecall'])('rejects {value: ...} on %s before helper pruning', (method) => {
    expect(() => compileString(
      `contract C { function f() pure internal { address(10).${method}{value: 7, gas: 3}(""); } }`,
      { solidityImportCompat: true },
    )).toThrow(new RegExp(`value.*${method}`, 'i'));
  });

  it('retains the inert gas option on staticcall', () => {
    expect(compileString(
      'contract C { function f(address a, bytes memory d) public {'
      + ' a.staticcall{gas: 3}(d); require(true); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('cycle-safe AST metadata walks', () => {
  const ok = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;

  it('handles a self-function reference passed to abi.encode', () => {
    expect(ok('contract C { function f() public view { abi.encode(this.f); } }')).toBe('C');
  });

  it('handles comparisons of self-function references', () => {
    expect(ok('contract C { function f() public view returns (bool) { return this.f == this.f; } }')).toBe('C');
  });

  it('handles deleted function-pointer locals and state variables', () => {
    expect(ok('contract C { function(uint) external returns(uint) x;'
      + ' function(uint) internal returns(uint) y; function f() public { delete x;'
      + ' function(uint) internal returns(uint) a = y; delete a; delete y; } }')).toBe('C');
  });

  it('rejects delete on a function declaration rather than treating it as a function-pointer variable', () => {
    expect(() => ok('contract C { function f() public { delete f; } }'))
      .toThrow(/where type variable was expected/);
  });

  it('handles a self-call inside try/catch nested in a loop', () => {
    expect(ok('contract C { function f() public returns(uint) {'
      + ' while (1 == 1) try this.f() returns (uint b) { b = 2; } catch { } } }')).toBe('C');
  });
});

describe('named arguments participate in overload resolution', () => {
  const ok = (body: string): string => compileString(
    'contract C { function f(uint x) internal {} function f(uint x,uint y) internal {}'
    + ' function f(uint u,string memory s,bool b) internal {} function f(uint u,uint s,uint b) internal {}'
    + ` function call() public { ${body} } }`,
    { solidityImportCompat: true },
  ).contractName;

  it('selects by parameter-name set and then by reordered argument types', () => {
    expect(ok('f({x:1}); f({y:2,x:1}); f({b:true,s:"abc",u:1});')).toBe('C');
  });

  it('rejects named overloads that remain ambiguous after name-aware type matching', () => {
    expect(() => compileString(
      'contract D { function f(uint x,string memory y) internal {}'
      + ' function f(bytes memory y,int x) internal {}'
      + ' function call() internal { f({x:1,y:"abc"}); } }',
      { solidityImportCompat: true },
    )).toThrow(/ambiguous .*overload/i);
  });
});

describe('bare call-option function references are no-op statements', () => {
  const bc = (body: string): string => compileString(
    `contract C { function f() external payable {} function g(address a) external pure { ${body} } }`,
    { solidityImportCompat: true },
  ).bytecode;

  it('drops value/gas options when no call follows', () => {
    expect(bc('a.call{value:42}; a.call{gas:42}; a.staticcall{gas:42}; a.delegatecall{gas:42};'))
      .toBe(bc(''));
  });

  it('still rejects unknown and duplicate options before discarding the reference', () => {
    expect(() => bc('a.call{random:42};')).toThrow(/unknown call option/i);
    expect(() => bc('a.call{gas:2,gas:5};')).toThrow(/duplicate call option/i);
  });
});

describe('bitwise op with an unbounded-int operand takes the bounded width', () => {
  // `x | 1`, `x & 0xff`, `x | (c ? 1 : 2)` - a bounded int bitwise-combined with an int literal or a `?:` of
  // literals (an unbounded int) adopts the bounded operand's fixed width instead of failing as "unsupported".
  it('coerces an int literal / conditional operand to the bounded operand type', () => {
    expect(compileString('contract C() { function f(uint256 a) returns (uint256) { return a | 1; } }',
      { solidityImportCompat: true }).contractName).toBe('C');
    expect(compileString('contract C() { function f(uint256 a) returns (uint256) { return a & 0xff; } }',
      { solidityImportCompat: true }).contractName).toBe('C');
    expect(compileString('contract C() { function f(bool b) returns (uint256 x) { x = 0; x |= b ? 1 : 2; } }',
      { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('widens mixed-width same-signedness operands to the larger width (Solidity implicit conversion)', () => {
    expect(compileString(`contract C() {
      function f(uint8 a, uint16 b) returns (uint16) { return a | b; }
    }`, { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('still rejects mixed-signedness bounded operands', () => {
    expect(() => compileString(`contract C() {
      function f(int8 a, uint16 b) returns (uint16) { return a | b; }
    }`, { solidityImportCompat: true })).toThrow();
  });
});

describe('arr.push() = value == arr.push(value)', () => {
  it('compiles push()=value byte-identically to push(value)', () => {
    const a = compileString('contract C{uint[] a;function f(uint v){a.push()=v;require(true);}}',
      { solidityImportCompat: true, forceStateful: true }).bytecode;
    const b = compileString('contract C{uint[] a;function f(uint v){a.push(v);require(true);}}',
      { solidityImportCompat: true, forceStateful: true }).bytecode;
    expect(a).toBe(b);
  });
  it('retains a value local initialized from the newly appended default element', () => {
    const fromPush = compileString(
      'contract C{uint[] a;function f() public returns(uint){uint y=a.push();return y;}}',
      { solidityImportCompat: true, forceStateful: true },
    );
    const explicit = compileString(
      'contract C{uint[] a;function f() public returns(uint){uint y;a.push(y);return y;}}',
      { solidityImportCompat: true, forceStateful: true },
    );
    expect(fromPush.bytecode).toBe(explicit.bytecode);
  });
});

// A straight-line FOREIGN external function pointer desugars to the existing external call:
// `function() external f = IFoo(addr).method; f(args)` == `IFoo(addr).method(args)` (byte-identical, sound
// by reduction to the tested external-call covenant + SDK path).

describe('implicit bytesN -> bytesM widening (M >= N), matching solc', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('assigns a bytes20 result (ripemd160) to a bytes32 variable', () => {
    expect(cc('contract C { function f(bytes memory b) external pure returns (bytes32) {'
      + ' bytes32 r = ripemd160(b); return r; } }')).toBe('C');
  });
  it('widens on return, state assignment and local assignment', () => {
    expect(cc('contract C { bytes32 rip;'
      + ' function g(bytes4 x) external pure returns (bytes8) { return x; }'
      + ' function h(bytes memory b) external { rip = ripemd160(b); require(true); } }')).toBe('C');
  });
  it('produces the same bytecode as an explicit widening cast', () => {
    const sugar = compileString('contract C { function f(bytes20 x) external pure returns (bytes32) { bytes32 r = x; return r; } }',
      { solidityImportCompat: true });
    const hand = compileString('contract C { function f(bytes20 x) external pure returns (bytes32) { bytes32 r = bytes32(x); return r; } }',
      { solidityImportCompat: true });
    expect(sugar.bytecode).toBe(hand.bytecode);
  });
  it('still rejects narrowing (bytes32 -> bytes20)', () => {
    expect(() => cc('contract C { function f(bytes32 x) external pure returns (bytes20) { bytes20 y = x; return y; } }'))
      .toThrow(/can not be assigned/);
  });
});

describe('bytes memory/local element write (bytes memory d; d[i] = v)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('compiles a local bytes byte write with literal and variable value', () => {
    expect(cc('contract C { function f(uint256 i, bytes1 v) external pure returns (bytes memory) {'
      + ' bytes memory d = new bytes(9); d[0] = "A"; d[i] = v; return d; } }')).toBe('C');
  });
  it('lowers a local byte write via the memory-pointer model (byte-splice; VM-covered in MemoryModelBytes)', () => {
    // A mutable `new bytes(n)` buffer that is byte-indexed + returned converts to a __yulmem pointer, so `d[i] = v`
    // lowers to a single in-place byte splice - no longer byte-identical to the value-copy slice+concat (which the
    // whole-var REASSIGNMENT form below still uses, since a reassignment taints the buffer back to value-copy).
    expect(cc('contract C { function f(uint256 i, bytes1 v) external pure returns (bytes memory) {'
      + ' bytes memory d = new bytes(9); d[i] = v; return d; } }')).toBe('C');
  });
});

describe('require(cond, <message>) accepts any expression message (Solidity: require(bool, string memory))', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  // Solidity treats require as a plain function taking `string memory`, so the message can be any expression.
  // BCH has no on-chain reason string, so a dynamic message is dropped (the require still reverts on false).
  it('accepts a plain VARIABLE message (OZ SafeMath require(b <= a, errorMessage))', () => {
    expect(cc('contract C { function f(uint256 a, uint256 b, string memory e) public pure { require(b <= a, e); } }'))
      .toBe('C');
  });
  it('accepts a member-access message', () => {
    expect(cc('contract C { string m; function f(bool ok) public view { require(ok, this.m); } }')).toBe('C');
  });
  it('accepts a function-call message (not a custom error - degrades to a dropped message)', () => {
    expect(cc('contract C { function g() internal pure returns (string memory) { return "x"; }'
      + ' function f(bool ok) public pure { require(ok, g()); } }')).toBe('C');
  });
  it('accepts a ternary / concat message', () => {
    expect(cc('contract C { function f(bool ok, uint256 x) public pure {'
      + ' require(ok, x > 0 ? "a" : "b"); require(ok, string(abi.encodePacked("e", x))); } }')).toBe('C');
  });
  it('still routes a DECLARED custom error to a custom-error revert', () => {
    expect(cc('error Bad(uint256 x); contract C { function f(bool ok, uint256 a) public pure {'
      + ' require(ok, Bad(a)); } }')).toBe('C');
  });
  it('still rejects genuine too-many-args require(a, b, c)', () => {
    expect(() => cc('contract C { function f(bool a, bool b, bool c) public pure { require(a, b, c); } }')).toThrow();
  });
});

describe('bytes memory PARAM element write (function f(bytes memory x) { x[i] = v; })', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts a byte write to a bytes memory parameter', () => {
    expect(cc('contract C { function f(bytes memory x, uint256 i, bytes1 v) external pure returns (bytes memory) {'
      + ' x[i] = v; return x; } }')).toBe('C');
  });
  it('still rejects a write to a bytes calldata parameter (read-only)', () => {
    expect(() => cc('contract C { function f(bytes calldata x, uint256 i, bytes1 v) external pure returns (bytes memory) {'
      + ' x[i] = v; return x; } }')).toThrow(/read-only/);
  });
});

describe('bytes.concat / string.concat in a constant initializer (compile-time fold)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts bytes.concat/string.concat over constant refs and literals in a constant', () => {
    expect(cc('bytes constant aaaa = hex"aaaa"; contract C { '
      + 'bytes constant abc = bytes.concat(aaaa, hex"bbbb", hex"cccc"); '
      + 'bytes constant abcabc = bytes.concat(abc, aaaa); function f() public pure { require(abc.length == 6); } }'))
      .toBe('C');
    expect(cc('string constant a = "foo"; contract C { '
      + 'string constant b = string.concat(a, "bar"); function f() public pure {} }')).toBe('C');
  });
});

describe('fallback / receive usable as ordinary identifiers (function/param names)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts fallback/receive as a function name or parameter name', () => {
    expect(cc('contract C { function fallback() external pure {} }')).toBe('C');
    expect(cc('contract C { function receive() external pure {} }')).toBe('C');
    expect(cc('contract C { function f(uint fallback) public pure { require(fallback == 0); } }')).toBe('C');
  });
  it('does not disturb the real fallback/receive special functions', () => {
    expect(cc('contract C { fallback() external {} receive() external payable {} }')).toBe('C');
  });
});

describe('unconditional break in a do-while skips its condition', () => {
  it('does not evaluate a prefix mutation in the unreachable condition', () => {
    expect(compileString('contract C { function f() public pure { uint x; do { break; } while (++x < 2); '
      + 'assert(x == 0); } }', { solidityImportCompat: true }).contractName).toBe('C');
  });
  it('keeps the straight-line body prefix before the break', () => {
    expect(compileString('contract C { function f() public pure { uint x; do { x = 1; break; x = 2; } '
      + 'while (++x < 3); assert(x == 1); } }', { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('slice with omitted bounds (a[:2] / a[2:] / a[:])', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('defaults an omitted start to 0 and an omitted end to the length', () => {
    expect(cc('contract C { function f(bytes calldata a) external pure returns (bytes memory) { return a[:2]; } }')).toBe('C');
    expect(cc('contract C { function f(bytes calldata a) external pure returns (bytes memory) { return a[2:]; } }')).toBe('C');
    expect(cc('contract C { function f(bytes calldata a) external pure returns (bytes memory) { return a[:]; } }')).toBe('C');
  });
  it('supports omitted-bound slices inside bytes.concat', () => {
    expect(cc('contract C { function f(bytes calldata a) external pure returns (bytes memory) {'
      + ' return bytes.concat(a[:2], a[2:]); } }')).toBe('C');
  });
});

describe('for loop with an empty condition (for(;;) / for(init;;update))', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('treats an omitted for-condition as an implicit true (break-terminated)', () => {
    expect(cc('contract C { function f() external pure returns (uint256) {'
      + ' uint256 i = 0; for (;;) { i++; if (i > 3) break; } return i; } }')).toBe('C');
    expect(cc('contract C { function f() external pure returns (uint256) {'
      + ' uint256 i = 0; for (uint256 j = 0; ; j++) { i++; if (i > 3) break; } return i; } }')).toBe('C');
  });
});

describe('unchecked block placement', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;

  it('rejects nested unchecked blocks', () => {
    expect(() => cc('contract C { function f() public pure { unchecked { unchecked { uint x = 1; } } } }'))
      .toThrow(/Unchecked blocks cannot be nested/);
  });

  it('rejects unchecked as an unbraced control-flow body', () => {
    expect(() => cc('contract C { function f() public pure { while (true) unchecked { } } }'))
      .toThrow(/only be used inside regular blocks/);
  });

  it('rejects modifier placeholders inside unchecked blocks', () => {
    expect(() => cc('contract C { modifier m() { unchecked { _; } } }'))
      .toThrow(/Modifier placeholders cannot be used inside unchecked blocks/);
  });

  it('retains a non-nested unchecked block inside a regular block', () => {
    expect(cc('contract C { function f() public pure returns (uint) { unchecked { return 1 + 2; } } }'))
      .toBe('C');
  });
});

describe('bare block statements introduce a nested scope (VM-verified in solidcash/test/BareBlockScope.test.ts)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('compiles disjoint sibling blocks that reuse a name', () => {
    expect(cc('contract C { function f() external { { uint x = 1; require(x > 0); } { uint x = 2; require(x > 0); } } }'))
      .toBe('C');
  });
  it('compiles a nested block inside unchecked and a block that reads an outer local', () => {
    expect(cc('contract C { function f() external { unchecked { { uint m = 5; require(m == 5); } } } }')).toBe('C');
    expect(cc('contract C { function f() external { uint a = 1; { uint b = 2; require(a + b == 3); } require(a == 1); } }'))
      .toBe('C');
  });
  it('alpha-renames a block local that shadows a live outer local', () => {
    expect(cc('contract C { function f() external {'
      + ' uint b = 1; { uint b = 2; require(b == 2); } require(b == 1); } }')).toBe('C');
  });
});

describe('parenthesised simple call target (foo)() / (L.f)() / (blockhash)(n)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('unwraps redundant parentheses around a simple callee', () => {
    expect(cc('contract C { function foo() internal pure returns (uint) { return 7; }'
      + ' function f() external pure returns (uint) { return (foo)(); } }')).toBe('C');
    expect(cc('library L { function f() internal pure returns (uint) { return 3; } }'
      + ' contract C { function g() external pure returns (uint) { return (L.f)(); } }')).toBe('C');
    expect(cc('contract C { function f() external view returns (bytes32) { return (blockhash)(block.number - 1); } }'))
      .toBe('C');
  });
});

describe('foreign external fn-ptr parameter (per-call master index)', () => {
  // A called `function(..) external` PARAM lowers to an address param + a bytes4 selector param + a per-call
  // `__internal__extcallMasterIdx<i>` the SDK fills. VM-verified in ForeignFunctionPointerParam.test.ts
  // (single + multi-call binding).
  it('lowers a called foreign fn-ptr param to address + selector + a master-index hidden param', () => {
    const art = compileString('contract C { function eval(function(uint) external returns(uint) y, uint v)'
      + ' public returns(uint) { return y(v); } }', { solidityImportCompat: true });
    const inputs = art.abi.find((f) => f.name === 'eval')!.inputs.map((i) => `${i.name}:${i.type}`);
    expect(inputs).toContain('y:address');
    expect(inputs).toContain('__fnsel_y:bytes4');
    expect(inputs.some((i) => i.startsWith('__internal__extcallMasterIdx'))).toBe(true);
  });
  // A fn-ptr param passed a SELF-REF (`this.f`) at an internal call site stays a functionId (not lowered), so the
  // internal OP_INVOKE path keeps working (the duality: self-ref = functionId, foreign = address+selector).
  it('does NOT lower a fn-ptr param passed a self-ref internally (stays a functionId)', () => {
    const art = compileString('contract C { function g(int x) public pure returns(int) { return x + 1; }'
      + ' function ev(function(int) external returns(int) fp, int a) public returns(int) { return fp(a); }'
      + ' function u(int x) public { require(this.ev(this.g, x) == x + 1); } }', { solidityImportCompat: true });
    const evInputs = art.abi.find((f) => f.name === 'ev')!.inputs.map((i) => i.name);
    expect(evInputs).not.toContain('__fnsel_fp'); // not lowered - stays the internal functionId form
  });
});

describe('foreign external fn-ptr RETURNED from an internal helper (beta-reduced)', () => {
  const IF = 'interface IFoo { function addTwo(uint x) external returns(uint); }';
  // A side-effect-free internal helper returning IFace(a).m inlines into `p = IFace(a).m` at the call site, which
  // the straight-line desugar reduces to the external call. VM-verified in ForeignFunctionPointerReturn.test.ts.
  it('inlines the returned pointer into the call site as an external call', () => {
    const art = compileString(`${IF} contract C {`
      + ' function make(address a) internal returns (function(uint) external returns(uint)) { return IFoo(a).addTwo; }'
      + ' function use(address a, uint v) public returns(uint) {'
      + '   function(uint) external returns(uint) p = make(a); return p(v); } }', { solidityImportCompat: true });
    const use = art.abi.find((f) => f.name === 'use')!;
    expect(use.externalCalls!.some((e) => e.interfaceName === 'IFoo' && e.functionName === 'addTwo')).toBe(true);
    expect(art.abi.some((f) => f.name === 'make')).toBe(false); // the helper is inlined away
  });
  // Passing a foreign member to a helper that calls it inlines to the external call; a self-ref (internal param)
  // is left to the OP_INVOKE path (the duality). VM-verified in ForeignFunctionPointerReturn.test.ts.
  it('inlines a foreign member passed to a helper into the external call', () => {
    const art = compileString(`${IF} contract C {`
      + ' function relay(function(uint) external returns(uint) cb, uint v) internal returns(uint) { return cb(v); }'
      + ' function use(address a, uint v) public returns(uint) { return relay(IFoo(a).addTwo, v); } }',
    { solidityImportCompat: true });
    const use = art.abi.find((f) => f.name === 'use')!;
    expect(use.externalCalls!.some((e) => e.interfaceName === 'IFoo' && e.functionName === 'addTwo')).toBe(true);
    expect(art.abi.some((f) => f.name === 'relay')).toBe(false); // inlined away
  });
  it('does NOT inline a self-ref passed to an internal-pointer helper (stays OP_INVOKE)', () => {
    // internal fn-ptr param + self-ref arg must keep compiling via the existing functionId path.
    expect(() => compileString('contract C {'
      + ' function g(uint x) internal returns(uint) { return x + 1; }'
      + ' function relay(function(uint) internal returns(uint) cb, uint v) internal returns(uint) { return cb(v); }'
      + ' function use(uint v) public returns(uint) { return relay(g, v); } }', { solidityImportCompat: true }))
      .not.toThrow();
  });
});

describe('unreachable internal contract-bytecode references', () => {
  it('drops an uncalled inherited helper that deploys the derived contract', () => {
    const artifact = compileString('contract C { function foo() internal { new D(); }'
      + ' function callFoo() virtual public { foo(); } }'
      + ' contract D is C { function callFoo() override public {} }',
    { solidityImportCompat: true });
    expect(artifact.contractName).toBe('D');
  });
});

describe('inlines internal value helpers that make an EXTERNAL contract call (OZ _isEscrowMember shape)', () => {
  const ok = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  const iface = 'interface I { function g(uint id) external view returns (uint); }';
  it('inlines an external-call helper called as a require argument (was a phantom-param arity error)', () => {
    // `_h` makes an external call `t.g(id)` (a dotted FunctionCall not in funcByName), which injects the external-
    // call covenant param; as an OP_INVOKE subroutine it cannot forward it. Detected like a low-level-call helper
    // and inlined at its expression call site (the existing state-helper expression hoisting handles it).
    expect(ok(iface + ' contract C { I t; function _h(uint id) internal view returns (bool) { return t.g(id) > 0; }'
      + ' function f(uint id) public view { require(_h(id), "x"); } }')).toBe('C');
  });
  it('inlines an external-call helper on an IMMUTABLE receiver used in a binary expression', () => {
    expect(ok(iface + ' contract C { I immutable t; constructor(address a) { t = I(a); }'
      + ' function _h(uint id) internal view returns (uint) { return t.g(id); }'
      + ' function f(uint id) public view returns (uint) { return 1 + _h(id); } }')).toBe('C');
  });
});

describe('direct external call through an interface-valued state mapping', () => {
  it('resolves the mapping value ABI before public-getter symbol shadowing', () => {
    const src = 'interface IStrategy { function exit(uint256 balance) external returns (int256); }'
      + ' contract C { mapping(address => IStrategy) public strategy;'
      + ' function f(address token, uint256 balance) public {'
      + ' int256 change = strategy[token].exit(balance); require(change == change); } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('native lowering of canonical Solidity self batches', () => {
  it('publishes batch(bytes[],bool) as an ordered local-route SDK alias', () => {
    const artifact = compileString('contract C { uint public x; function set(uint v) public { x = v; }'
      + ' function batch(bytes[] calldata calls, bool revertOnFail) external payable'
      + ' returns (bool[] memory successes, bytes[] memory results) {'
      + ' successes = new bool[](calls.length); results = new bytes[](calls.length);'
      + ' for (uint i = 0; i < calls.length; i++) {'
      + ' (bool success, bytes memory result) = address(this).delegatecall(calls[i]);'
      + ' require(success || !revertOnFail); successes[i] = success; results[i] = result; } } }',
    { solidityImportCompat: true });
    expect(artifact.abi.find((fn) => fn.name === 'batch')?.nativeSelfBatchDispatcher).toBe(true);
  });
});

describe('conditionally evaluated external-read helpers', () => {
  it('beta-reduces a named-return helper inside a short-circuit RHS without hoisting it', () => {
    const src = 'interface I { function balanceOf(address a) external view returns (uint); }'
      + ' contract C { mapping(I => uint) public held;'
      + ' function _balance(I token) internal view returns (uint amount) {'
      + ' amount = token.balanceOf(address(this)) + held[token]; }'
      + ' function f(I token, bool skip, uint total) public view {'
      + ' require(skip || _balance(token) >= total); } }';
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  });
});

describe('cast-wrapped low-level call targets', () => {
  it('pins address(local).call(data) to the live local locking bytecode', () => {
    const src = 'contract C { function f(address a, address b, bool pickA, bytes calldata data) public {'
      + ' address target = pickA ? a : b; (bool ok,) = address(target).call(data); require(ok); } }';
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  });
});

// A low-level `.call`/`.staticcall`/`.delegatecall` on a struct-FIELD address receiver (`t.dest.call(..)`) was
// rejected: resolveLowLevelReceiverType missed a state-var base (StateAccessNode) and a mapping collection base
// (collectionMap), so it fell through to the interface path (MethodCallNotSupported); and the field receiver was
// not sourceable in codegen. Now the receiver resolves AND is hoisted into an address local. MultiSigWallet's
// `transaction.destination.call{value:}(transaction.data)` shape.

describe('complex-lvalue tuple target with a single (call) RHS ((m[k].f,) = g())', () => {
  const ok = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  const two = 'function two() pure returns (bool, uint) { return (true, 1); }';
  const S = 'struct T { bool e; uint v; }';
  it('mapping-value struct field target', () => {
    expect(ok(`${two} ${S} contract C { mapping(uint => T) m;`
      + ' function f(uint id) public { (m[id].e,) = two(); require(m[id].e); } }')).toBe('C');
  });
  it('mapping-value struct field via a storage pointer', () => {
    expect(ok(`${two} ${S} contract C { mapping(uint => T) m;`
      + ' function f(uint id) public { T storage t = m[id]; (t.e, t.v) = two(); require(t.e && t.v == 1); } }')).toBe('C');
  });
  it('array-element struct field target', () => {
    expect(ok(`${two} ${S} contract C { T[] xs;`
      + ' function f(uint id) public { (xs[id].e,) = two(); require(xs[id].e); } }')).toBe('C');
  });
  it('low-level-call return into a struct-field via storage pointer (no value transfer)', () => {
    expect(ok(`${S} contract C { mapping(uint => T) m; function f(uint id, address d, bytes calldata x) public {`
      + ' T storage t = m[id]; (t.e,) = d.call(x); } }')).toBe('C');
  });
});

// `addmod`/`mulmod` in a CONSTANT initializer - pure integer builtins, compile-time when their args are. Only
// abi.encode*/keccak(literal) folded before; addmod/mulmod fell through to "Constant must be initialized with a
// compile-time expression". Now accepted (isCompileTimeExpression) + typed BIGINT (resolveConstantExpression-
// Identifiers), inlined at each use like abi.encode. Corpus: math_builtin_opcode_based_const_args.

describe('addmod/mulmod in a constant initializer', () => {
  const ok = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('addmod with literal args', () => {
    expect(ok('uint256 constant a = addmod(1, 8, 7); contract C { function f() public pure returns (uint) { return a; } }')).toBe('C');
  });
  it('mulmod with literal args', () => {
    expect(ok('uint256 constant a = mulmod(3, 8, 7); contract C { function f() public pure returns (uint) { return a; } }')).toBe('C');
  });
  it('addmod with a constant arg (resolves the ref)', () => {
    expect(ok('uint256 constant k = 7; uint256 constant a = addmod(1, 8, k);'
      + ' contract C { function f() public pure returns (uint) { return a; } }')).toBe('C');
  });
  it('keccak256 in a const with a NON-literal arg (const ref) - FoldHashLiterals is literal-only', () => {
    expect(ok('bytes constant d = hex"ffff"; bytes32 constant k = keccak256(d);'
      + ' contract C { function f() public pure returns (bytes32) { return k; } }')).toBe('C');
  });
  it('keccak256 in a const with an abi.encode arg', () => {
    expect(ok('bytes32 constant k = keccak256(abi.encode(uint256(7)));'
      + ' contract C { function f() public pure returns (bytes32) { return k; } }')).toBe('C');
  });
});

// A global builtin can be invoked for side effects/checks while discarding its value. Statement calls used to
// consult only user-defined overloads, even though the same builtin resolved normally in an expression.

describe('discarded global-builtin return values', () => {
  it('accepts addmod/mulmod calls in statement position', () => {
    expect(compileString('contract C { function f(uint256 d) public pure returns (uint256) {'
      + ' addmod(1, 2, d); mulmod(1, 2, d); return 2; } }', { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('overloaded external self-call resolution', () => {
  it('defers this.f overload selection through inert value/gas call options', () => {
    expect(compileString('contract C {'
      + ' function f(uint x) external payable returns (uint) { return 1; }'
      + ' function f(uint x, uint y) external payable returns (uint) { return 2; }'
      + ' function g() public payable returns (uint, uint) {'
      + ' return (this.f{value: 10}(2), this.f{gas: 10000}(2, 3)); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('normalizes named-argument this.f calls to the ordinary external self-call path', () => {
    expect(compileString('contract C { function f(int256 a, int256 b, int256 c) public pure returns (int256) {'
      + ' return a + b + c; } function g() public view { this.f({c: 1, b: 2, a: 3}); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
    expect(() => compileString('contract C { function f(int256 a) public {}'
      + ' function g() public { this.f({missing: 1}); } }',
    { solidityImportCompat: true })).toThrow(/named|matches|argument/i);
  });
});

describe('discarded global function references', () => {
  it('treats compiler-special bare global names as no-op statements', () => {
    expect(compileString('contract C { function f() public pure {'
      + ' erc7201; selfdestruct; super; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('rejects bare super outside an ordinary contract member', () => {
    expect(() => compileString('contract C {} function f() pure { super; }',
      { solidityImportCompat: true })).toThrow(/Undefined reference/);
    expect(() => compileString('library L { function f() public { (super); } }',
      { solidityImportCompat: true })).toThrow(/Undefined reference/);
  });

  it('discards a declared interface function reference but rejects an unknown member', () => {
    const iface = 'interface I { function transfer(address to, uint256 value) external returns (bool); }';
    expect(compileString(`${iface} contract C { function f() public pure { I.transfer; } }`,
      { solidityImportCompat: true }).contractName).toBe('C');
    expect(() => compileString(`${iface} contract C { function f() public pure { I.missing; } }`,
      { solidityImportCompat: true })).toThrow(/Undefined|Struct|Method|reference/);
    expect(() => compileString('contract A { function f() external {} function f(uint256) external {} }'
      + ' contract C { function g() public pure { A.f; } }',
    { solidityImportCompat: true })).toThrow(/not unique|Undefined|reference/);
  });
});

// `IFoo(<state chain>).m()` - a plain-`address` field reached through self-pinned STATE, cast to an interface
// (the cast supplies the callee ABI). Generalizes the `IFoo(stateVar)` cast to a struct-field/mapping-value/array
// chain, hoisting `IFoo(chain)` into a synthesized __extaddr_ local. This is the EACC Marketplace shape
// (`IERC20(job.token).transfer(..)` where `JobPost storage job = jobs[id]`); the storage pointer is already
// inlined to `jobs[id].token` by AstBuilder, so it reaches the pass as a mapping-struct-field cast.

describe('synthesizes __extaddr for IFoo(<param-rooted field>).method() (caller-witness, EACC input.currency)', () => {
  const ok = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  const iface = 'interface ITok { function transfer(address to, uint256 v) external returns (bool); }';
  // A struct state root so the pass visits functions (the shape appears alongside struct state in practice).
  const base = 'struct Inp { address currency; } struct Job { address token; }';
  it('casts a param struct field: IFoo(inp.currency).transfer(..)', () => {
    expect(ok(iface + ' ' + base + ' contract C { mapping(uint256 => Job) public jobs;'
      + ' function pay(Inp calldata inp) public { ITok(inp.currency).transfer(msg.sender, 1); require(true); } }')).toBe('C');
  });
  it('does NOT hoist a bare param cast (codegen already sources the param directly)', () => {
    expect(ok(iface + ' ' + base + ' contract C { mapping(uint256 => Job) public jobs;'
      + ' function pay(address t) public { ITok(t).transfer(msg.sender, 1); require(true); } }')).toBe('C');
  });
});

// InlineReturningStateHelpers.applyRename must NOT rename a struct-FIELD member that shares a name with an inlined
// local. Unicrow calculateSplits: `uint16 arbitratorFee = a.consensus ? a.arbitratorFee : 0;` - the local
// `arbitratorFee` and the field `a.arbitratorFee` collide; the catch-all rename corrupted `a.arbitratorFee` ->
// `a.__rh0_arbitratorFee` -> "Struct has no field __rh0_arbitratorFee". Fixed by skipping FieldAccessNode.name.

describe('C2-default: OVERLOADED internal C2-writer chain inlines by (name, arity) (OZ ERC20 _approve/3 -> _approve/4)', () => {
  // `_approve/3` calls `_approve/4` (which writes the C2 `_allowances`). InlineStoragePointerCalls resolved callees
  // and its recursion guard by NAME only, so the arity-4 call inside `_approve/3` was never inlined yet `_approve`
  // was dropped by name -> "Undefined reference to symbol _approve". Overload-aware (name, arity) resolution fixes it.
  it('compiles the overloaded _approve chain that writes a nested C2 mapping', () => {
    const src = 'pragma solidity ^0.8.20; contract Base {'
      + ' mapping(address => mapping(address => uint256)) private _allowances;'
      + ' function _approve(address o, address s, uint256 v, bool e) internal { _allowances[o][s] = v; }'
      + ' function _approve(address o, address s, uint256 v) internal { _approve(o, s, v, true); }'
      + ' function approve(address s, uint256 v) public returns (bool) { _approve(msg.sender, s, v); return true; } }'
      + ' contract Derived is Base {}';
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  });
});

describe('legacy 0.6.x low-level call-option syntax target.call.value(v)(data) / .call.gas(g)(data)', () => {
  // Superseded by `.call{value:v}(data)`; MistSwap Timelock.executeTransaction uses the old form. `.value` lexes
  // as the DotValue token (shared with `tx.outputs[i].value`), `.gas` as `'.' Identifier` - both desugar to a
  // MethodCall carrying call options, the same node the modern brace form produces.
  const ok = (src: string): void => {
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  };
  const mk = (call: string): string => 'pragma solidity ^0.6.0; contract T {'
    + ' function exec(address target, uint256 v, bytes memory cd) public returns (bool) { (bool okk, bytes memory r)'
    + ` = ${call}; return okk; } }`;
  it('accepts target.call.value(v)(data)', () => ok(mk('target.call.value(v)(cd)')));
  it('accepts target.call.gas(v)(data)', () => ok(mk('target.call.gas(v)(cd)')));
  it('is equivalent to the modern brace form', () => ok(mk('target.call{value: v}(cd)')));
  it('does not disturb tx.outputs[i].value introspection', () => {
    ok('contract T { function f() public returns (int) { require(tx.outputs[0].value >= 0); return tx.outputs[0].value; } }');
  });
});

describe('internally-called PUBLIC low-level-call helper is inlined (Multicall2 tryAggregate pattern)', () => {
  // A public value-returning helper that makes a low-level call injects an entry-only covenant param, so it cannot
  // be an OP_INVOKE subroutine. An internal call to it must inline (while its own public definition stays a
  // dispatched entry); previously the internal call hit a phantom-param arity mismatch. Transitive chains too.
  const ok = (src: string): void => {
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  };
  it('inlines an internal call to a public low-level-call helper', () => {
    ok('contract T { function helper(address a, bytes memory d) public returns (bool) {'
      + ' (bool okk, bytes memory r) = a.call(d); return okk; }'
      + ' function outer(address a, bytes memory d) public returns (bool) { return helper(a, d); } }');
  });
  it('inlines a transitive chain of public low-level-call helpers', () => {
    ok('contract T { function inner(address a, bytes memory d) public returns (bool) {'
      + ' (bool okk, bytes memory r) = a.call(d); return okk; }'
      + ' function mid(address a, bytes memory d) public returns (bool) { return inner(a, d); }'
      + ' function outer(address a, bytes memory d) public returns (bool) { return mid(a, d); } }');
  });
});

describe('Solidity <0.7 `now` aliases block.timestamp (shadowing respected)', () => {
  const ok = (src: string): void => {
    expect(() => compileString(src, { solidityImportCompat: true })).not.toThrow();
  };
  it('resolves a bare `now` to block.timestamp', () => {
    ok('pragma solidity ^0.6.0; contract T { uint256 d;'
      + ' function f() public view returns (bool) { return now >= d; } }');
  });
  it('does not alias a `now` declared as a local variable', () => {
    ok('pragma solidity ^0.8.0; contract T {'
      + ' function f() public pure returns (uint256) { uint256 now = 5; return now; } }');
  });
  it('does not alias a `now` declared as a parameter', () => {
    ok('pragma solidity ^0.8.0; contract T {'
      + ' function f(uint256 now) public pure returns (uint256) { return now; } }');
  });
  it('rejects the removed global without a legacy pragma', () => {
    expect(() => compileString(
      'contract T { function f() public view returns (uint256) { return now; } }',
      { solidityImportCompat: true },
    )).toThrow(/now.*deprecated.*block\.timestamp/i);
  });
});

describe('Solidity for-loop lexical scoping', () => {
  const cc = (src: string): string => compileString(src, {
    solidityImportCompat: true,
  }).contractName;

  it('does not expose an initializer declaration after the loop', () => {
    expect(() => cc('contract C { function f() public pure {'
      + ' for (uint x = 0; x < 2; x++) { x = 1; } x = 4; } }'))
      .toThrow(/Undeclared identifier.*x/i);
  });

  it('does not expose a body declaration to the update expression', () => {
    expect(() => cc('contract C { function f() public pure {'
      + ' for (;; y++) { uint y = 3; } } }'))
      .toThrow(/Undeclared identifier.*y/i);
  });

  it('retains initializer scope across condition, body, and update', () => {
    expect(cc('contract C { function f() public pure {'
      + ' for (uint x = 0; x < 2; x++) { uint y = x; } } }')).toBe('C');
  });
});

describe('loop-body vars are not single-assign (Router02 per-iteration computed target)', () => {
  // A var declared / tuple-bound inside a loop re-runs each iteration (position-dependent). It must NOT be treated
  // as a single-assign local, or a computed external-call target `IFoo(pairFor(.., path[i], ..))` would resolve
  // path[i] to a fixed index and hoist outside the loop (a wrong co-spend). SEAL correctly does NOT mis-hoist such
  // a per-iteration target; the collect phase instead rewrites it to read a synthesized `__internal__loopTargets<n>`
  // address[] witness param (the SDK fills it with the co-spend targets for the route) and reuses the typed inline
  // loop dispatch (identity co-spend + preservation). A NON-loop computed target (single-assign leaves) still hoists.
  const opts = { solidityImportCompat: true };
  const iface = 'interface IFoo { function m(uint256 x) external; }';
  const lib = 'library L { function at(address f, address a) internal pure returns (address) {'
    + ' return address(uint160(uint256(uint160(f)) + uint256(uint160(a)))); } }';
  it('a NON-loop computed external-call target still compiles (single-assign leaves unaffected)', () => {
    expect(() => compileString(`pragma solidity ^0.8.0; ${iface} ${lib} contract C { address factory;`
      + ' function f(address t) public { address a = t; IFoo(L.at(factory, a)).m(5); } }', opts)).not.toThrow();
  });
  it('a per-iteration computed external-call target compiles via a synthesized loopTargets witness param', () => {
    const art = compileString(`pragma solidity ^0.8.0; ${iface} ${lib} contract C { address factory;`
      + ' function f(address[] memory path) public { for (uint i; i < path.length; i++) {'
      + ' IFoo(L.at(factory, path[i])).m(5); } } }', opts);
    const fn = art.abi.find((a) => a.name === 'f');
    expect(fn?.inputs.some((inp) => inp.name.startsWith('__internal__loopTargets'))).toBe(true);
  });
  it('supports several calls through one per-iteration interface local', () => {
    const art = compileString(`pragma solidity 0.6.12;
      interface IFoo { function a() external view returns (uint); function b() external view returns (uint);
        function label() external view returns (string memory); }
      contract C { function f(address[] memory targets) public view returns (uint[] memory out) {
        out = new uint[](targets.length);
        for (uint i; i < targets.length; i++) { IFoo target = IFoo(targets[i]);
          string memory ignored = target.label(); string memory direct = IFoo(targets[i]).label();
          out[i] = target.a() + target.b() + bytes(ignored).length + bytes(direct).length; }
      } }`, opts);
    const fn = art.abi.find((a) => a.name === 'f');
    // A BCH master UTXO cannot service several view methods in one transaction; the compatibility query receives
    // one value-witness array per distinct return slot instead of attempting duplicate co-spends.
    expect(fn?.inputs.filter((inp) => inp.name.startsWith('__internal__viewReturn'))).toHaveLength(3);
  });
  it('dispatches an inlined loop-local receiver assigned from an external result', () => {
    expect(() => compileString(`pragma solidity 0.6.12;
      interface IPair { function reserve() external view returns (uint); }
      interface IFactory { function pair(address token) external view returns (IPair); }
      contract C { IFactory factory;
        function rate(address token) public view returns (uint) {
          IPair p; p = factory.pair(token); return p.reserve();
        }
        function rates(address[] memory tokens) public view returns (uint[] memory out) {
          out = new uint[](tokens.length);
          for (uint i; i < tokens.length; i++) out[i] = rate(tokens[i]);
        }
      }`, opts)).not.toThrow();
  });
});

describe('ecrecover(hash, v, r, s) alias maps to a recovery projection under the ecrecover option', () => {
  // Solidity's 4-arg `ecrecover` has no bare-name SolidCash builtin; the `ecrecover` compat option aliases it to a
  // real recovery projection so ports (OZ ECDSA.tryRecover) cross-compile. Byte-identical to writing the projection
  // directly, so it inherits the VM-proven ecrecoverP2pkh/Evm correctness (solidcash EcrecoverRecovery.test.ts).
  const bc = (src: string, opt: object): string =>
    compileString(src, { solidityImportCompat: true, ...opt }).bytecode;
  const mkAddr = (fn: string): string => 'contract C { function f(bytes32 h, uint8 v, bytes32 r, bytes32 s) public {'
    + ` address a = ${fn}(h, v, r, s); require(a == a); } }`;
  const mkB20 = (fn: string): string => 'contract C { function f(bytes32 h, uint8 v, bytes32 r, bytes32 s) public {'
    + ` bytes20 a = ${fn}(h, v, r, s); require(a == a); } }`;
  it("ecrecover:'p2pkh' is byte-identical to ecrecoverP2pkh (native BCH signer address)", () => {
    expect(bc(mkAddr('ecrecover'), { ecrecover: 'p2pkh' })).toBe(bc(mkAddr('ecrecoverP2pkh'), {}));
  });
  it("ecrecover:'evm' is byte-identical to ecrecoverEvm (20-byte keccak address)", () => {
    expect(bc(mkB20('ecrecover'), { ecrecover: 'evm' })).toBe(bc(mkB20('ecrecoverEvm'), {}));
  });
  it('solidityImportCompat defaults ecrecover to the exact EVM projection', () => {
    expect(bc(mkB20('ecrecover'), {})).toBe(bc(mkB20('ecrecover'), { ecrecover: 'evm' }));
  });
  it('native mode keeps bare ecrecover undefined without an explicit projection', () => {
    expect(() => compileString(mkAddr('ecrecover'))).toThrow(/Undefined reference to symbol ecrecover/);
  });
});

describe('prefix mutation of a no-argument push result', () => {
  it('reduces ++a.push() to pushing default(T) + 1', () => {
    const compat = { solidityImportCompat: true, forceStateful: true };
    const prefixed = compileString('contract C { uint[] a; function f() public { ++a.push(); require(true); } }', compat);
    const reduced = compileString('contract C { uint[] a; function f() public { a.push(uint(1)); require(true); } }', compat);
    expect(prefixed.bytecode).toBe(reduced.bytecode);
  });

  it('applies the same reduction through an indexed struct-array field', () => {
    expect(compileString(
      'contract C { struct S { int[][] d; } S[] data; constructor() {'
      + ' data.push(); data.push(); data[1].d.push(); data[1].d.push();'
      + ' data[1].d.push(); data[1].d.push(); }'
      + ' function f() public { ++data[1].d[3].push(); } }',
      { solidityImportCompat: true, forceStateful: true },
    ).contractName).toBe('C');
  });
});

describe('discarded contract-creation options', () => {
  it('accepts new C{salt/value: ...} without an invocation argument list', () => {
    expect(compileString('contract D { constructor() payable {} } contract C {'
      + ' function f() pure internal { new D{salt: "abc", value: 3}; new D{salt: "abc"};'
      + ' new D{value: 5 + 5}; } }', { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('contextual value member method calls', () => {
  it('allows a using-for library method named value', () => {
    expect(compileString('library L { function value(function() internal a, uint256 b) internal {} }'
      + ' contract C { using L for function() internal; function f() public {'
      + ' function() internal x; x.value(42); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('empty tuple ternary expressions', () => {
  it('evaluates the condition and accepts discarded tuple values plus returned empty tuples', () => {
    expect(compileString('contract C { function f(bool b) public pure {'
      + ' b ? () : (); b ? (1, 2) : (3, 4); return b ? () : (); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('parenthesized delete targets', () => {
  it('deletes local identifiers through redundant parentheses', () => {
    expect(compileString('contract C { function f(bool b) public pure {'
      + ' delete(b); delete((((b)))); } }', { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('evaluates and discards deletion of a temporary array element', () => {
    expect(compileString('contract C { function f() public pure { delete ([""][0]); } }',
      { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('discarded tuple expressions with builtin references', () => {
  it('accepts and discards (abi.encode, value)', () => {
    expect(compileString('contract C { function f() pure { (abi.encode, ""); } }',
      { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('chained indirect function calls', () => {
  it('compiles x()()()() through nested internal function-pointer returns', () => {
    expect(compileString('contract C { function f0() public returns (uint) { return 2; }'
      + ' function f1() internal returns (function() internal returns (uint)) { return f0; }'
      + ' function f2() internal returns (function() internal returns (function() internal returns (uint))) { return f1; }'
      + ' function f3() internal returns (function() internal returns (function() internal returns (function() internal returns (uint)))) { return f2; }'
      + ' function f() public returns (uint) {'
      + ' function() internal returns(function() internal returns(function() internal returns(function() internal returns(uint)))) x;'
      + ' x = f3; return x()()()(); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('nested tuple assignment targets', () => {
  it('flattens nested targets and preserves omitted slots', () => {
    expect(compileString('contract C { function f() public pure returns (uint) {'
      + ' uint a; ((, a)) = (1, 2); return a; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('accepts redundant wrappers around nested tuple targets and values', () => {
    expect(compileString('contract C { function f() public pure returns (uint) {'
      + ' uint a; (((, a),)) = ((1, 2), 3);'
      + ' ((,, a)) = ((((((1, 3, (((((2))))))))))); return a; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('recognizes a nested target after a plain first slot', () => {
    expect(compileString('contract C { function f() public pure returns (bytes memory) {'
      + ' bytes a; bytes b; bytes c;'
      + ' (a, (b, c)) = ("0", ("1", "2")); return bytes.concat(a, b, c); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('accepts completely omitted nested targets', () => {
    expect(compileString('contract C { function f() public pure {'
      + ' ((, ), ) = ((7, 8), 9); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('expands a skipped outer target across every nested RHS leaf', () => {
    expect(compileString('contract C { function f() public pure returns (uint) {'
      + ' uint a; (a,) = (4, (8, 16, 32)); return a; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('parenthesized discarded tuple expressions', () => {
  it('evaluates and discards tuple components through redundant wrappers', () => {
    expect(compileString('contract C { function f() public pure { (("", 2)); (("", "")); } }',
      { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('parenthesized explicit tuple assignment values', () => {
  it('destructures a tuple RHS through redundant wrappers', () => {
    expect(compileString('contract C { function f() public pure returns (uint) {'
      + ' uint a; (,, a) = ((((((1, 3, (((((2))))))))))); return a; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('contextual overloaded internal function references', () => {
  it('selects the overload matching the destination function-pointer type', () => {
    expect(compileString('contract C { function i() internal pure {}'
      + ' function g(function() internal pure x) internal view { x = i; }'
      + ' function g(function() external pure x) external view {'
      + ' function(function() internal pure) internal view y; y = g; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('ignores synthetic return-routing parameters when matching a public function', () => {
    expect(compileString('contract C { function x() public returns (uint) { return 1; }'
      + ' function y() public returns (uint) { return 2; }'
      + ' function f(bool c) public returns (uint) {'
      + ' function() returns (uint) z = c ? x : y; return z(); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('push-return assignment on bytes[]', () => {
  it('folds the fresh inner bytes mutation into the outer append', () => {
    const compile = (body: string): string => compileString(
      `contract C { bytes[] data; function f(bytes1 v) public { ${body}
       require(data.length == 1 && data[0].length == 1 && data[0][0] == v); } }`,
      { solidityImportCompat: true },
    ).bytecode;
    expect(compile('data.push().push() = v;')).toBe(compile('data.push(bytes(v));'));
  });

  it('indexes the fresh bytes element with a dynamic expression', () => {
    expect(compileString(
      `contract C { bytes[] data; function f(bytes1 v) public { data.push().push() = v;
       uint i = data.length - 1; uint j = data[i].length - 1;
       require(data[i][j] == v); } }`,
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  }, 120_000);
});

describe('compound assignment to a pushed element', () => {
  it('applies the operator to the appended element default', () => {
    expect(compileString('contract C { int[] data; function f() public {'
      + ' data.push() -= 1; require(data[0] == -1); } }',
    { solidityImportCompat: true, forceStateful: true }).contractName).toBe('C');
  });
});

describe('chained method-return function calls', () => {
  it('invokes an external function pointer returned by a self method', () => {
    expect(compileString('contract C { function f(uint256 x) public pure returns (uint256) { return 2*x; }'
      + ' function g() public view returns (function(uint256) external returns (uint256)) { return this.f; }'
      + ' function h(uint256 x) public returns (uint256) { return this.g()(x) + 1; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('escaped-newline string continuations', () => {
  it('removes escaped LF and CRLF line breaks from plain and unicode strings', () => {
    expect(compileString('contract C { function f() public pure returns (string memory, string memory) {'
      + ' return ("left\\\n right", unicode"up\\\r\n down"); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('parser-recovery function layout clause', () => {
  it('ignores an incomplete function-level `layout at` clause in Solidity import compatibility mode', () => {
    expect(compileString(
      'contract C { function f() public pure layout at { } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('scientific rational integer constants', () => {
  it('preserves a fractional exponent literal until the enclosing constant expression is integral', () => {
    expect(compileString(
      'uint constant HALF_RANGE = 2**256 * 500e-3;'
      + ' contract C { function f() public pure returns (uint) { return HALF_RANGE; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('parenthesized tuple-valued ternaries', () => {
  it('evaluates a wrapped ternary condition once and discards the selected tuple', () => {
    expect(compileString('contract C { function f() public pure returns (bool) { bool flag;'
      + ' ((flag = true) ? (1, 2, 3) : (3, 2, 1)); return flag; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('declared methods shadow SolidCash conveniences', () => {
  it('resolves this.transfer to a user-defined method before the satoshi-transfer intrinsic', () => {
    expect(compileString('contract C { function transfer(uint256 x) public pure {}'
      + ' function f() public { this.transfer(10); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('pointer-backed named memory-bytes returns', () => {
  it('serializes Yul-mutated buffers initialized from a parameter or literal', () => {
    expect(compileString('function copy(bytes memory pattern) pure returns (bytes memory out) {'
      + ' out = pattern; assembly { mcopy(add(out, 0x20), add(out, 0x20), 0) } }'
      + ' contract C { function literal() public pure returns (bytes memory out) {'
      + ' out = hex"010203"; assembly { mcopy(add(out, 0x20), add(out, 0x20), 0) } }'
      + ' function copied(bytes memory value) public pure returns (bytes memory) { return copy(value); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('preserves the null pointer of an uninitialized named bytes return', () => {
    expect(compileString('contract C { function f(bytes memory src) public pure returns (bytes memory dst) {'
      + ' assembly { mcopy(add(dst, 0x1f), add(src, 0x1f), 0x01)'
      + ' mcopy(add(dst, 0x20), add(src, 0x00), 0x08)'
      + ' mcopy(add(dst, 0x28), add(src, 0x28), 0x10)'
      + ' mcopy(add(dst, 0x38), add(src, 0x00), 0x08) } } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('materializes an abi.encode result before exposing its pointer to Yul', () => {
    expect(compileString('contract C { function f(string calldata x) external returns (bytes memory r) {'
      + ' uint p; assembly { p := mload(0x40) } r = abi.encode(x);'
      + ' assembly { if iszero(eq(p, r)) { revert(0, 0) } } } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('Solidity constant-expression bitwise width', () => {
  it('restores int256 width after arithmetic and unary constant expressions', () => {
    expect(compileString('contract C { function f() public pure returns (int) {'
      + ' return (2 + 2) & ~1; } }', { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('infers uint256 for an all-positive full-width mask', () => {
    expect(compileString('contract C { function f(uint r) public pure returns (bool) {'
      + ' return r == (((2 ** 224 - 1) << 32) | 0xef15dead); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('tuple locals shadowing contract members', () => {
  it('allows a tuple-declared local to shadow a state variable', () => {
    expect(compileString('contract C { uint x; function pair() internal pure returns (bool, uint) {'
      + ' return (true, 1); } function f() public { (bool ok, uint x) = pair(); require(ok && x == 1); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('conditional increment expressions', () => {
  it('keeps prefix and postfix mutations inside the selected ternary arm', () => {
    expect(compileString('contract C { function f(uint b) public pure { uint x = 2;'
      + ' uint y = b > 0 ? x++ : --x; assert(y <= 2); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('lowers a ternary assigned to a named return local', () => {
    expect(compileString('contract C { uint a; bool choose;'
      + ' function f() public returns (uint c) { c = choose ? a + 10 : ++a; assert(c >= a); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('user-defined gasleft shadowing', () => {
  it('resolves a zero-argument contract function before the BCH gas shim', () => {
    expect(compileString('contract C {'
      + ' function gasleft() public pure returns (bytes32) { return "abc"; }'
      + ' function f() public pure returns (bytes32) { return gasleft(); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('parenthesized contract member calls', () => {
  it('dispatches ((d.f))() like d.f()', () => {
    expect(compileString('contract D { function f() external {} }'
      + ' contract C { function g(D d) public { ((d.f))(); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('constant interface call targets', () => {
  it('pins the literal behind an interface/address constant instead of reading a stack variable', () => {
    expect(compileString(
      'interface I { function f() external; }'
      + ' contract C { I constant X = I(address(4)); function g() public { X.f(); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('contextual hex-number arithmetic', () => {
  it('types a constant arithmetic tree from its integer destination', () => {
    const hex = compileString('contract C { uint constant X = 0x123 + 0x456;'
      + ' function f() public pure returns (uint) { return X + 1; } }',
    { solidityImportCompat: true });
    const decimal = compileString('contract C { uint constant X = 291 + 1110;'
      + ' function f() public pure returns (uint) { return X + 1; } }',
    { solidityImportCompat: true });
    expect(hex.bytecode).toBe(decimal.bytecode);
  });

  it('applies integer context to local initializers and state assignments', () => {
    expect(compileString('contract C { uint x; function f() public {'
      + ' uint y = 0x12 * 0x3; x = y + (0x8 << 1); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('retains Solidity rejection of an excessive constant shift count', () => {
    expect(() => compileString('contract C { uint x = 0x42 << 0x100000000; }',
      { solidityImportCompat: true })).toThrow(/uint32 constant limit/);
  });

  it('interprets complemented hex-number literals as integers in nested bitwise expressions', () => {
    expect(compileString('contract C { function f() public pure {'
      + ' int x = ~1 | (~0xff ^ 0); assert((~1 | (~0xff & 0)) == -2); assert(x < 0); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('propagates integer assignment context through ternary arithmetic branches', () => {
    expect(compileString('contract C { function f(bool t, bool f) public pure { uint8 a;'
      + ' a = (t ? 0x3f : 0xff) + (f ? 0x3f : 0xff);'
      + ' a = (true ? 0x3f : 0xff) + (false ? 0x3f : 0xff); } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('nested lexical local shadowing', () => {
  it('alpha-renames an inner binding while its initializer still reads the outer binding', () => {
    const shadowed = compileString('contract C { function f() public pure returns (uint) {'
      + ' uint x = 7; { x = 3; uint x = x; x = 4; } return x; } }',
    { solidityImportCompat: true });
    const renamed = compileString('contract C { function f() public pure returns (uint) {'
      + ' uint x = 7; { x = 3; uint inner = x; inner = 4; } return x; } }',
    { solidityImportCompat: true });
    expect(shadowed.bytecode).toBe(renamed.bytecode);
  });

  it('retains the duplicate diagnostic for declarations in the same lexical block', () => {
    expect(() => compileString('contract C { function f() public pure { uint x; uint x; } }',
      { solidityImportCompat: true })).toThrow(/Redefinition of variable x/);
  });
});

describe('external contract method references', () => {
  it('materializes C(address).f as an address-selector function value', () => {
    expect(compileString('contract C { function f(uint x) external pure returns (uint) { return x; }'
      + ' function g() public pure returns (function(uint) external pure returns (uint)) {'
      + ' return C(address(0x1234)).f; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('try/catch return-path validation', () => {
  it('requires a return only on the compiled try path because VM failure is fatal', () => {
    expect(compileString('contract C { function f() public returns (uint) {'
      + ' try this.f() returns (uint x) { return x; } catch { } } }',
    { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('try/catch clause validation', () => {
  const cc = (body: string): string => compileString(
    `contract C { function f() public returns (uint) { ${body} } }`,
    { solidityImportCompat: true },
  ).contractName;

  it('rejects empty returns and catch parameter lists', () => {
    expect(() => cc('try this.f() returns () {} catch {}')).toThrow(/requires at least one parameter/);
    expect(() => cc('try this.f() {} catch () {}')).toThrow(/cannot be empty/);
  });

  it('rejects unknown and duplicate catch clause kinds', () => {
    expect(() => cc('try this.f() {} catch Other(uint x) {}')).toThrow(/Invalid catch clause name/);
    expect(() => cc('try this.f() {} catch Error(string memory x) {}'
      + ' catch Error(string memory y) {}')).toThrow(/already has a Error catch clause/);
    expect(() => cc('try this.f() {} catch {} catch (bytes memory data) {}'))
      .toThrow(/already has a low-level catch clause/);
  });

  it('validates Error, Panic, and low-level catch signatures', () => {
    expect(() => cc('try this.f() {} catch Error(uint x) {}')).toThrow(/Error\(string memory/);
    expect(() => cc('try this.f() {} catch Panic(bytes memory data) {}')).toThrow(/Panic\(uint256/);
    expect(() => cc('try this.f() {} catch (uint x) {}')).toThrow(/bytes memory/);
  });

  it('retains each correctly shaped catch clause', () => {
    expect(cc('try this.f() returns (uint x) { return x; }'
      + ' catch Error(string memory reason) { return 1; }'
      + ' catch Panic(uint256 code) { return code; }'
      + ' catch (bytes memory data) { return data.length; }')).toBe('C');
  });
});

describe('try expression and return-clause typing', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;

  it('rejects try on an internal function call', () => {
    expect(() => cc('contract C { function f() public returns (uint) { try f() {} catch {} return 1; } }'))
      .toThrow(/Try can only be used with external function calls and contract creation/);
  });

  it('requires the returns clause to match the external call arity', () => {
    expect(() => cc('contract C { function f() public returns (uint, uint) {'
      + ' try this.f() returns (uint x) { return (x, x); } catch {} } }'))
      .toThrow(/declares 1 values, but the expression returns 2/);
  });

  it('requires exact return types rather than implicit convertibility', () => {
    expect(() => cc('contract C { function f() public returns (uint8, uint256) {'
      + ' try this.f() returns (uint256 x, int256 y) { return (uint8(x), uint256(y)); } catch {} } }'))
      .toThrow(/Try return type must exactly match/);
  });

  it('rejects storage data locations on try-return bindings', () => {
    expect(() => cc('contract C { function f() public returns (string memory) {'
      + ' try this.f() returns (string storage value) { return value; } catch {} } }'))
      .toThrow(/storage.*only valid on internal or private functions/);
  });

  it('retains an exact external self-call returns clause', () => {
    expect(cc('contract C { function f() public returns (uint8, uint256) {'
      + ' try this.f() returns (uint8 x, uint256 y) { return (x, y); } catch {} } }')).toBe('C');
  });

  it('retains library calls and contract creation as valid try targets', () => {
    expect(cc('library L { function f(uint x) public returns (uint) { return x; } }'
      + ' contract C { function run() public returns (uint) {'
      + ' try L.f(1) returns (uint x) { return x; } catch { return 0; } } }')).toBe('C');
    expect(cc('contract D { constructor(uint x) {} } contract C {'
      + ' function run() public returns (bytes memory) {'
      + ' try new D(1) returns (D d) { return address(d); } catch { return ""; } } }')).toBe('C');
  });
});

describe('file-level operator functions in per-contract compilation', () => {
  it('retains the implementation referenced only by a global using-for directive', () => {
    const src = 'type Small is int32; using {add as +} for Small global;'
      + ' function add(Small x, Small y) pure returns (Small) {'
      + ' return Small.wrap(Small.unwrap(x) + Small.unwrap(y)); }'
      + ' contract C { function f(Small x, Small y) public pure returns (Small) { return x + y; } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('inlines binary and unary operator helpers that call an interface on a pure helper result', () => {
    const src = 'type Small is int32; using {add as +, inc as -} for Small global;'
      + ' interface ICalc { function mul(Small, Small) external pure returns (Small);'
      + ' function next(Small) external pure returns (Small); }'
      + ' function load() pure returns (ICalc) { return ICalc(address(0)); }'
      + ' function add(Small x, Small y) pure returns (Small) { return load().mul(x, y); }'
      + ' function inc(Small x) pure returns (Small) { return load().next(x); }'
      + ' contract C { function f(Small x, Small y) public returns (Small) { return x + y; }'
      + ' function g(Small x) public returns (Small) { return -x; } }';
    expect(compileString(src, { solidityImportCompat: true }).contractName).toBe('C');
  });
});

describe('Solidity source metadata syntax validation', () => {
  const cc = (src: string): string =>
    compileString(src, { solidityImportCompat: true }).contractName;

  it('rejects non-ASCII SPDX license identifiers in compatibility mode', () => {
    expect(() => cc('// SPDX-License-Identifier: GPL-3.0 ⡉\ncontract C {}'))
      .toThrow(/Invalid SPDX license identifier/);
    expect(() => cc('// SPDX-License-Identifier: ⡉\ncontract C {}'))
      .toThrow(/Invalid SPDX license identifier/);
    expect(cc('// SPDX-License-Identifier: GPL-3.0 OR MIT\ncontract C {}')).toBe('C');
    expect(compileString('// SPDX-License-Identifier: GPL-3.0 ⡉\ncontract C {}').contractName).toBe('C');
  });

  it('rejects duplicate memory-safe assembly options while retaining warning-only unknown options', () => {
    expect(() => cc('contract C { function f() public pure {'
      + ' assembly ("memory-safe", "memory-safe") {} } }'))
      .toThrow(/marked memory-safe multiple times/);
    expect(() => cc('contract C { function f() public pure {'
      + ' assembly "evmasm" ("memory-safe", "memory-safe") {} } }'))
      .toThrow(/marked memory-safe multiple times/);
    expect(cc('contract C { function f() public pure { assembly ("a", "b", "a") {} } }')).toBe('C');
    expect(cc('contract C { function f() public pure { assembly "evmasm" ("memory-safe") {} } }')).toBe('C');
  });
});

describe('exact rational constants with negative exponents', () => {
  it('folds an exact reciprocal before integer division can truncate it', () => {
    const rational = compileString(
      'contract C { function f() public pure returns (int) { return (-1 / 2) ** -1; } }',
      { solidityImportCompat: true },
    );
    const integer = compileString(
      'contract C { function f() public pure returns (int) { return -2; } }',
      { solidityImportCompat: true },
    );
    expect(rational.bytecode).toBe(integer.bytecode);
  });
});

describe('forward constant dependency validation', () => {
  it('resolves an acyclic forward chain while still rejecting a genuine cycle', () => {
    expect(compileString('contract C { uint constant a = b * c; uint constant b = 7;'
      + ' uint constant c = 4 + d; uint constant d = 2 + b;'
      + ' function f() public pure returns (uint) { return a; } }',
    { solidityImportCompat: true }).contractName).toBe('C');
    expect(() => compileString(
      'contract C { uint constant a = b + 1; uint constant b = a + 1; }',
      { solidityImportCompat: true },
    )).toThrow(/compile-time/i);
  });

  it('retains Solidity rejection when the dependency validator depth is exhausted', () => {
    const declarations = Array.from({ length: 270 }, (_, i) =>
      `uint constant c${i} = ${i === 269 ? '1' : `c${i + 1}`};`).join('');
    expect(() => compileString(`contract C { ${declarations} }`,
      { solidityImportCompat: true })).toThrow(/compile-time/i);
  });
});

describe('bare blobhash builtin reference', () => {
  it('discards the uncalled reference while retaining the callable builtin', () => {
    expect(compileString(
      'contract C { function f(uint i) public pure returns (bytes32) { blobhash; return blobhash(i); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('retains the undeclared-builtin diagnostic for an explicit pre-Cancun target', () => {
    expect(() => compileString(
      'contract C { function f() public pure { blobhash; } }'
      + '\n// ====\n// EVMVersion: <=shanghai\n// ----\n',
      { solidityImportCompat: true },
    )).toThrow(/blobhas_|undefined reference|undeclared/i);
  });
});

describe('tuple-declared locals in repeatedly inlined void helpers', () => {
  it('alpha-renames declaration slots and their later tuple reassignments per call site', () => {
    expect(compileString(
      'contract C { uint[] values;'
      + ' function read(uint x) internal pure returns (bool, uint) { return (true, x); }'
      + ' function add(uint x) internal { (bool success, uint value) = read(x);'
      + ' (success, value) = read(value + 1); require(success); values.push(value); }'
      + ' function f() public { add(1); add(2); } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});

describe('Solidity fallback signatures', () => {
  const cc = (fallback: string): string => compileString(
    `contract C { ${fallback} }`,
    { solidityImportCompat: true },
  ).contractName;

  it('accepts the empty and forwarding fallback signatures', () => {
    expect(cc('fallback() external {}')).toBe('C');
    expect(cc('fallback(bytes calldata input) external returns (bytes memory output) { return input; }')).toBe('C');
  });

  it('requires forwarding input and output together', () => {
    expect(() => cc('fallback() external returns (bytes memory output) {}')).toThrow(/Fallback function/);
    expect(() => cc('fallback(bytes calldata input) external {}')).toThrow(/Fallback function/);
  });

  it('requires calldata input and one memory bytes output', () => {
    expect(() => cc('fallback(bytes memory input) external returns (bytes memory output) {}'))
      .toThrow(/Fallback function/);
    expect(() => cc('fallback(bytes calldata input) external returns (bytes calldata output) {}'))
      .toThrow(/Fallback function/);
    expect(() => cc('fallback(bytes calldata input) external returns (bytes memory, bytes memory) {}'))
      .toThrow(/Fallback function/);
    expect(() => cc('fallback(bytes calldata input) external returns (uint output) {}'))
      .toThrow(/Fallback function/);
  });
});

describe('Solidity index-range slice sources', () => {
  const cc = (source: string): string => compileString(
    `contract C { ${source} }`,
    { solidityImportCompat: true },
  ).contractName;

  it('accepts dynamic calldata arrays, bytes, nested slices, and msg.data', () => {
    expect(cc('function f(uint[] calldata x) external pure { x[1:][1:2]; }')).toBe('C');
    expect(cc('function f(bytes calldata x) external pure returns (bytes memory) { return x[:]; }')).toBe('C');
    expect(cc('bytes b; function f() public { b = msg.data[:]; }')).toBe('C');
  });

  it('rejects memory, storage, and fixed calldata sources', () => {
    expect(() => cc('function f(uint[] memory x) public pure { x[1:2]; }')).toThrow(/dynamic calldata arrays/);
    expect(() => cc('uint[] x; function f() public view { x[1:2]; }')).toThrow(/dynamic calldata arrays/);
    expect(() => cc('function f(uint[2] calldata x) external pure { x[1:2]; }'))
      .toThrow(/dynamic calldata arrays/);
  });

  it('does not restrict the explicit native slice member', () => {
    expect(cc('function f(bytes memory x) public pure returns (bytes memory) { return x.slice(1, 2); }')).toBe('C');
  });
});

describe('required Solidity data locations', () => {
  it('infers omitted locations on reference-type parameters and returns', () => {
    const accepted = [
      'contract C { function f(uint[] x) internal pure {} }',
      'contract C { function f() private pure returns (bytes x) {} }',
      'contract C { struct S { uint x; } function f(S x) public pure {} }',
    ];
    for (const source of accepted) {
      expect(compileString(source, { solidityImportCompat: true }).contractName).toBe('C');
    }
  });

  it('accepts explicit locations and preserves native SolidCash omission', () => {
    expect(compileString(
      'contract C { function f(uint[] memory x) internal pure {}'
      + ' function g() private pure returns (bytes memory x) {} }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
    expect(compileString(
      'contract C { function f(bytes x) internal pure { require(x.length >= 0); } }',
      { solidityImportCompat: false },
    ).contractName).toBe('C');
  });
});

describe('SPDX source-unit identifiers', () => {
  it('rejects multiple line or block-comment identifiers', () => {
    const invalid = [
      '// SPDX-License-Identifier: MIT\n// SPDX-License-Identifier: GPL-3.0\ncontract C {}',
      '/* SPDX-License-Identifier: MIT\\nSPDX-License-Identifier: GPL-3.0 */ contract C {}',
    ];
    for (const source of invalid) {
      expect(() => compileString(source, { solidityImportCompat: true }))
        .toThrow(/Multiple SPDX license identifiers/);
    }
  });

  it('accepts repeated identical identifiers', () => {
    expect(compileString(
      '// SPDX-License-Identifier: MIT\n/* SPDX-License-Identifier: MIT */ contract C {}',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('accepts one combined identifier and ignores tag-shaped string contents', () => {
    expect(compileString(
      '// SPDX-License-Identifier: MIT OR GPL-3.0\ncontract C {}',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
    expect(compileString(
      'contract C { string constant S = "SPDX-License-Identifier: MIT"; }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
    expect(compileString(
      'contract C { /* SPDX-License-Identifier: MIT */ }\n// ----\n'
      + '// Warning: SPDX-License-Identifier: <SPDX-License>',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('accepts retained SPDX headers in explicitly flattened source units', () => {
    expect(compileString(
      '// SPDX-License-Identifier: MIT\n// File contracts/C.sol\n'
      + '// SPDX-License-Identifier: GPL-3.0\ncontract C {}',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });
});
