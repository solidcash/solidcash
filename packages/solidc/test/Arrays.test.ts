import { describe, it, expect } from 'vitest';
import { compileString } from '../src/index.js';

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

  it('accepts an uninitialized array local (zero-init)', () => {
    const a = compileString('contract C() { int n; function f() { int[] r; this.n = r.length; } }');
    expect(a.contractName).toBe('C');
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
    expect(compileString(src('arr.push(x)'), { solidityImportCompat: true }).bytecode)
      .toBe(compileString(src('this.arr.push(x)'), { solidityImportCompat: true }).bytecode);
  });
  it('bare arr.pop() compiles identically to this.arr.pop()', () => {
    expect(compileString(src('arr.pop()'), { solidityImportCompat: true }).bytecode)
      .toBe(compileString(src('this.arr.pop()'), { solidityImportCompat: true }).bytecode);
  });
});

// `T storage x = arr.push()` - Solidity's no-arg push returns a reference to the new element. Desugars to a
// captured-index alias: `uint i = arr.length; T d; arr.push(d); /* x -> arr[i] */`, so writes/reads of x hit the
// real element. Sound by reduction: byte-identical to that explicit form.
describe('storage pointer to a freshly-pushed array element (T storage x = arr.push())', () => {
  const P = 'contract C(){struct S{int a;int b;}S[] arr;function f()external{';
  it('compiles a push-pointer populate', () => {
    const a = compileString(`${P}S storage x=arr.push();x.a=1;x.b=2;require(arr[0].a==1);}}`, { solidityImportCompat: true });
    expect(a.bytecode.length).toBeGreaterThan(0);
  });
  it('is byte-identical to the explicit captured-index form (sound by reduction)', () => {
    const sugar = compileString(`${P}S storage x=arr.push();x.a=1;x.b=2;require(arr[0].a==1);}}`, { solidityImportCompat: true });
    const hand = compileString(`${P}uint i=arr.length;S d;arr.push(d);arr[i].a=1;arr[i].b=2;require(arr[0].a==1);}}`,
      { solidityImportCompat: true });
    expect(sugar.bytecode).toBe(hand.bytecode);
  });
  it('captures a distinct index per push (two live pointers stay correct)', () => {
    const a = compileString(`${P}S storage x=arr.push();x.a=1;S storage y=arr.push();y.a=2;`
      + 'require(arr[0].a==1);require(arr[1].a==2);}}', { solidityImportCompat: true });
    expect(a.bytecode.length).toBeGreaterThan(0);
  });
});

// `delete d[i]` where d is a LOCAL array resets the element to its type default. It parses as a MappingDeleteNode
// the symbol table rejects; desugars to `d[i] = <default>` (a working local array-element write). State arrays
// route to StateArrayDelete before this fires.
describe('local array-element delete (int[] d; delete d[i])', () => {
  it('resets a local array element to the type default', () => {
    expect(compileString('contract C(){function f()external{int[] d=new int[](3);d[0]=5;delete d[0];require(d[0]==0);}}',
      { solidityImportCompat: true }).contractName).toBe('C');
  });
  it('is byte-identical to d[i] = default (sound by reduction)', () => {
    const pre = 'contract C(){function f()external{int[] d=new int[](3);d[0]=5;';
    const del = compileString(`${pre}delete d[0];require(d[0]==0);}}`, { solidityImportCompat: true });
    const assign = compileString(`${pre}d[0]=0;require(d[0]==0);}}`, { solidityImportCompat: true });
    expect(del.bytecode).toBe(assign.bytecode);
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
