import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// Arrays: return types, state-array push/pop, tuple / fixed-array assignment.

describe('Array return types, unnamed params, array locals, bare delete', () => {
  it('accepts an array return type', () => {
    const a = compileString('contract C() { int[3] arr; function f() returns (int[] memory) { int[] r; return r; } }');
    expect(a.contractName).toBe('C');
  });

  it('accepts unnamed parameters (interface signatures)', () => {
    const a = compileString('interface I { function transfer(address, uint256) external returns (bool); } contract C() { int n; function g() { this.n = 1; } }');
    expect(a.contractName).toBe('C');
  });

  it('rejects access through an uninitialized storage array pointer in Solidity compatibility mode', () => {
    expect(() => compileString(
      'contract C() { int n; function f() { int[] storage r; this.n = r.length; } }',
      { evmCompat: true },
    )).toThrow(/storage pointer 'r' may be accessed before it is initialized/);
  });

  it('accepts bare `delete m[k]` (routed to state)', () => {
    const a = compileString('contract C() { mapping(int => int) m; function f(int k) { delete m[k]; } }');
    expect(a.contractName).toBe('C');
  });
});

describe('SBE-14: bare state-array push/pop (Solidity idiom) routes to state, like this.arr.push', () => {
  const src = (op: string): string =>
    `contract C() { uint256[] arr; function f(uint256 x, sig s, pubkey pk) { require(checkSig(s, pk)); ${op}; } }`;
  it('bare arr.push(x) compiles identically to this.arr.push(x)', () => {
    expect(compileString(src('arr.push(x)'), { evmCompat: true }).bytecode)
      .toBe(compileString(src('this.arr.push(x)'), { evmCompat: true }).bytecode);
  });
  it('bare arr.pop() compiles identically to this.arr.pop()', () => {
    expect(compileString(src('arr.pop()'), { evmCompat: true }).bytecode)
      .toBe(compileString(src('this.arr.pop()'), { evmCompat: true }).bytecode);
  });
});

// `T storage x = arr.push()` - Solidity's no-arg push returns a reference to the new element. Desugars to a
// captured-index alias: `uint i = arr.length; T d; arr.push(d); /* x -> arr[i] */`, so writes/reads of x hit the
// real element. Sound by reduction: byte-identical to that explicit form.
describe('storage pointer to a freshly-pushed array element (T storage x = arr.push())', () => {
  const P = 'contract C(){struct S{int a;int b;}S[] arr;function f()external{';
  it('compiles a push-pointer populate', () => {
    const a = compileString(`${P}S storage x=arr.push();x.a=1;x.b=2;require(arr[0].a==1);}}`, { evmCompat: true });
    expect(a.bytecode.length).toBeGreaterThan(0);
  });
  it('is byte-identical to the explicit captured-index form (sound by reduction)', () => {
    const sugar = compileString(`${P}S storage x=arr.push();x.a=1;x.b=2;require(arr[0].a==1);}}`, { evmCompat: true });
    const hand = compileString(`${P}uint i=arr.length;S d;arr.push(d);arr[i].a=1;arr[i].b=2;require(arr[0].a==1);}}`,
      { evmCompat: true });
    expect(sugar.bytecode).toBe(hand.bytecode);
  });
  it('captures a distinct index per push (two live pointers stay correct)', () => {
    const a = compileString(`${P}S storage x=arr.push();x.a=1;S storage y=arr.push();y.a=2;`
      + 'require(arr[0].a==1);require(arr[1].a==2);}}', { evmCompat: true });
    expect(a.bytecode.length).toBeGreaterThan(0);
  });
});

// `delete d[i]` where d is a LOCAL array resets the element to its type default. It parses as a MappingDeleteNode
// the symbol table rejects; desugars to `d[i] = <default>` (a working local array-element write). State arrays
// route to StateArrayDelete before this fires.
describe('local array-element delete (int[] d; delete d[i])', () => {
  it('resets a local array element to the type default', () => {
    expect(compileString('contract C(){function f()external{int[] d=new int[](3);d[0]=5;delete d[0];require(d[0]==0);}}',
      { evmCompat: true }).contractName).toBe('C');
  });
  it('is byte-identical to d[i] = default (sound by reduction)', () => {
    const pre = 'contract C(){function f()external{int[] d=new int[](3);d[0]=5;';
    const del = compileString(`${pre}delete d[0];require(d[0]==0);}}`, {
      evmCompat: true, messageBus: false,
    });
    const assign = compileString(`${pre}d[0]=0;require(d[0]==0);}}`, {
      evmCompat: true, messageBus: false,
    });
    expect(del.bytecode).toBe(assign.bytecode);
  });
});

describe('local array-element assignment', () => {
  it('reuses the decoded length when rebuilding a fixed array', () => {
    const artifact = compileString('contract C { function f(uint256 x) public returns(uint256) {'
      + ' uint256[5] memory p; p[0]=x; p[1]=x+1; p[2]=x+2; p[3]=x+3; p[4]=x+4;'
      + ' return p[4]; } }', { evmCompat: true, messageBus: false });
    expect(artifact.debug.bytecode.length / 2).toBeLessThan(1200);
  });

  it('coalesces ordered writes into a fresh fixed array before a dependent write', () => {
    const artifact = compileString('uint8 constant WHO_BUYER=0; uint8 constant WHO_SELLER=1;'
      + ' uint8 constant WHO_MARKETPLACE=2; uint8 constant WHO_PROTOCOL=3;'
      + ' uint8 constant WHO_ARBITRATOR=4;'
      + ' contract C { function f(uint256 amount, uint256[5] memory split)'
      + ' public returns(uint256[5] memory) { uint256[5] memory p;'
      + ' p[WHO_BUYER]=split[WHO_BUYER]*amount; p[WHO_SELLER]=split[WHO_SELLER]*amount;'
      + ' p[WHO_MARKETPLACE]=split[WHO_MARKETPLACE]*amount;'
      + ' p[WHO_ARBITRATOR]=split[WHO_ARBITRATOR]*amount;'
      + ' p[WHO_PROTOCOL]=amount-p[WHO_BUYER]-p[WHO_SELLER]-p[WHO_MARKETPLACE]-p[WHO_ARBITRATOR];'
      + ' return p; } }', { evmCompat: true });
    // 753 in the merged tree: ungating the mutability rules shrank the shape, and the audit's runtime range
    // checks add bytes back, so the budget stays the one this line already carried rather than the shrink's 700.
    // 792 after the October hardening (standalone return-carrier refusal, canonical array-parameter walk).
    // 819 measured after the trailing batch-width binding landed on the direct convention.
    // 845 with call records (D50): the entry digests its own call into its record and counts its carriers.
    expect(artifact.debug.bytecode.length / 2).toBeLessThan(860);
  });

  it('forwards a complete fixed-array projection at an external return boundary', () => {
    const prefix = 'uint8 constant B=0; uint8 constant S=1; uint8 constant M=2;'
      + ' uint8 constant P=3; uint8 constant A=4; contract C {'
      + ' function calculate(uint256 amount) internal pure returns(uint256[5] memory) {'
      + ' uint256[5] memory payments; payments[B]=amount/10; payments[S]=amount/5;'
      + ' payments[M]=amount/5; payments[A]=amount/10;'
      + ' payments[P]=amount-payments[B]-payments[S]-payments[M]-payments[A];'
      + ' return payments; }'
      + ' function claim(uint256 amount) external pure returns(uint256[5] memory) {'
      + ' uint256[5] memory payments=calculate(amount);';
    const projected = compileString(`${prefix}return [payments[B],payments[S],payments[M],`
      + 'payments[P],payments[A]];}}', { evmCompat: true });
    const forwarded = compileString(`${prefix}return payments;}}`, { evmCompat: true });
    expect(projected.bytecode).toBe(forwarded.bytecode);

    const reordered = compileString(`${prefix}return [payments[S],payments[B],payments[M],`
      + 'payments[P],payments[A]];}}', { evmCompat: true });
    expect(reordered.bytecode).not.toBe(forwarded.bytecode);

    const parameterPrefix = 'contract C { function claim(uint256[5] memory payments)'
      + ' external pure returns(uint256[5] memory) {';
    const parameterProjection = compileString(`${parameterPrefix}return [payments[0],payments[1],`
      + 'payments[2],payments[3],payments[4]];}}', { evmCompat: true });
    const parameterForward = compileString(`${parameterPrefix}return payments;}}`, { evmCompat: true });
    expect(parameterProjection.bytecode).not.toBe(parameterForward.bytecode);
  });
});

describe('Tuple forwarding and whole fixed-array assignment', () => {
  it('forwards a tuple-returning call directly in a return statement', () => {
    // `return g()` where g returns (int, int) forwards the tuple's components (Solidity tuple forwarding),
    // not a single ((int, int)) value.
    const a = compileString('contract C { function g() private pure returns (int, int) { return (1, 2); }'
      + ' function h() private pure returns (int, int) { return g(); }'
      + ' function f() { (int a, int b) = h(); require(a == 1 && b == 2); } }');
    expect(a.contractName).toBe('C');
  });

  it('assigns a whole fixed-size array to a state array element-wise', () => {
    const a = compileString('contract C { int[2] xs;'
      + ' function f(int[2] memory _xs) { xs = _xs; require(this.xs[0] == _xs[0]); } }');
    expect(a.contractName).toBe('C');
  });
});

// Whole fixed-array copy where the element types differ (bytes widening): `bytes2[N] = bytes1[N]`. The whole
// arrays are not implicitly castable, so it desugars to element-wise writes with an explicit element cast
// `data2[i] = bytes2(data1[i])` - byte-identical to that form. Same-element / int-widening copies are unaffected.
describe('whole fixed-array copy with a per-element bytes conversion (bytes2[N] = bytes1[N])', () => {
  it('compiles bytes1[2] -> bytes2[2] whole-array copy', () => {
    expect(compileString('contract C{bytes1[2] d1;bytes2[2] d2;function f()external{d2=d1;require(true);}}',
      { evmCompat: true }).contractName).toBe('C');
  });
  it('is byte-identical to the explicit element-wise cast form', () => {
    const whole = compileString('contract C{bytes1[2] d1;bytes2[2] d2;function f()external{d2=d1;require(true);}}',
      { evmCompat: true, messageBus: false });
    const explicit = compileString('contract C{bytes1[2] d1;bytes2[2] d2;'
      + 'function f()external{d2[0]=bytes2(d1[0]);d2[1]=bytes2(d1[1]);require(true);}}', {
      evmCompat: true, messageBus: false,
    });
    expect(whole.bytecode).toBe(explicit.bytecode);
  });
  it('leaves a same-type whole-array copy unchanged', () => {
    expect(compileString('contract C{uint256[3] d1;uint256[3] d2;function f()external{d2=d1;require(true);}}',
      { evmCompat: true }).contractName).toBe('C');
  });
});

describe('whole fixed state-array copy with address mutability widening', () => {
  it('copies address payable[N] into address[N] element-wise', () => {
    expect(compileString('contract C { address[2] a; address payable[2] b;'
      + ' function f() public { a = b; require(a[0] == b[0]); } }',
    { evmCompat: true }).contractName).toBe('C');
  });
  it('still rejects the reverse address[N] to address payable[N] conversion', () => {
    expect(() => compileString('contract C { address payable[2] a; address[2] b;'
      + ' function f() public { a = b; } }', { evmCompat: true })).toThrow();
  });
});

// A whole DYNAMIC array copy with differing element types (`bytes10[] = bytes8[]`, which pack differently) can't
// be a same-layout copy; DesugarDynamicArrayCopyCast (pre-semantic, before the loop-cache pass) rewrites it to
// `delete d2; for (i) d2.push(bytes10(d1[i]));`. Sound by construction: canonical copy loop reusing the byte-
// identical-verified element cast; every primitive (delete, push, cast) is independently verified.
describe('whole dynamic-array copy with a per-element bytes conversion (bytes10[] = bytes8[])', () => {
  const P = 'contract C{bytes8[] d1;bytes10[] d2;function f()external{d1.push(bytes8(uint64(1)));';
  it('compiles a dynamic bytes8[] -> bytes10[] copy (repacking loop)', () => {
    expect(compileString(`${P}d2=d1;require(true);}}`, { evmCompat: true }).contractName).toBe('C');
  });
  it('leaves a same-type dynamic copy unchanged (no loop)', () => {
    expect(compileString('contract C{bytes8[] d1;bytes8[] d2;function f()external{d1.push(bytes8(uint64(1)));'
      + 'd2=d1;require(true);}}', { evmCompat: true }).contractName).toBe('C');
  });
  it('re-packs a calldata array into a wider fixed-bytes state array', () => {
    expect(compileString('contract C{bytes10[] d;function f(bytes8[] calldata src)external{d=src;require(true);}}',
      { evmCompat: true }).contractName).toBe('C');
  });
  it('re-packs a memory local array into a wider fixed-bytes state array', () => {
    expect(compileString('contract C{bytes10[] d;function f()external{bytes4[] memory src=new bytes4[](1);'
      + 'd=src;require(true);}}', { evmCompat: true }).contractName).toBe('C');
  });
});

// `mapping(K => T[][])` indexed more than one array level deep (`m[k][i][j]`) is supported: DesugarNestedArrayWrite
// lowers it to a whole-value read + local nested access + write-back (`T[][] t = m[k]; t[i][j] ...; m[k] = t`),
// reusing the proven whole-value RW + local nested-array paths. (VM roundtrip in solidcash MappingArray2dWrite.)
describe('multi-dimensional array-value mapping access m[k][i][j]', () => {
  it('read m[k][i][j] compiles (hoisted whole-value read + local index)', () => {
    expect(compileString('contract C() { mapping(int => int[][]) m; '
      + 'function f(int k, int i, int j) { require(m[k][i][j] == 0); } }').contractName).toBe('C');
  });
  it('write m[k][i][j] = v compiles (whole-value read-modify-write-back)', () => {
    expect(compileString('contract C() { mapping(int => int[][]) m; '
      + 'function f(int k, int i, int j, int v, pubkey pk, sig s) { require(checkSig(s, pk)); m[k][i][j] = v; } }').contractName).toBe('C');
  });
  it('single-level m[k][i] on mapping(K => T[]) still compiles', () => {
    expect(compileString('contract C() { mapping(int => int[]) m; '
      + 'function f(int k, int i) { require(m[k][i] == 0); } }').contractName).toBe('C');
  });
});
