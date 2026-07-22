import { hexToBin } from '@bitauth/libauth';
import { bytecodeToAsm } from '@solidcash/utils';
import { compileString } from '../src/index.js';

describe('general C2 bytecode sharing', () => {
  it('shares sorted-output authentication in a mapping write', () => {
    const artifact = compileString(
      'contract C { mapping(int=>bool) m; function f(int k) external { m[k]=true; require(true); } }',
      { forceStateful: true },
    );
    const asm = bytecodeToAsm(hexToBin(artifact.debug.bytecode));
    expect(asm).toContain('0910 OP_DEFINE');
    expect(artifact.bytecode.length / 2).toBeLessThan(1300);
  });

  it('shares a collection-specific entry address across reads and writes', () => {
    const artifact = compileString(
      'contract C { mapping(int=>bool) m; function f(int k) external {'
      + ' require(!m[k]); m[k]=true; require(true); } }',
      { forceStateful: true },
    );
    const asm = bytecodeToAsm(hexToBin(artifact.debug.bytecode));
    expect(asm).toContain('0011 OP_DEFINE');
    expect(artifact.bytecode.length / 2).toBeLessThan(1600);
  });

  it('shares the authenticated-absence bracket after three reads', () => {
    const artifact = compileString(
      'contract C { mapping(int=>bool) m; function f(int a,int b,int c) external {'
      + ' require(!m[a] && !m[b] && !m[c]); require(true); } }',
      { forceStateful: true },
    );
    const asm = bytecodeToAsm(hexToBin(artifact.debug.bytecode));
    expect(asm).toContain('0a10 OP_DEFINE');
  });

  it('shares repeated composite state traversal by structural type', () => {
    const artifact = compileString(
      'struct S { int a; int b; string c; address d; int e; } contract C { S[] x;'
      + ' function f(int i) external { require(x[i].a>=0); x[i].b=2; x[i].e=3; require(true); } }',
      { forceStateful: true },
    );
    const asm = bytecodeToAsm(hexToBin(artifact.debug.bytecode));
    expect(asm).toContain('0030 OP_DEFINE');
    expect(artifact.bytecode.length / 2).toBeLessThan(9300);
  });

  it('allocates collision-free structural and field-prefix helpers across entry points', () => {
    const artifact = compileString(
      'struct S { int a; string b; int c; } struct T { address a; bytes b; bool c; }'
      + ' contract C { S[] x; T[] y;'
      + ' function f(int i) external { require(x[i].c>=0); }'
      + ' function g(int i) external { require(x[i].c>=0); }'
      + ' function h(int i) external { require(x[i].c>=0 && y[i].c); }'
      + ' function j(int i) external { require(y[i].c); }'
      + ' function k(int i) external { require(y[i].c); } }',
      { forceStateful: true },
    );
    const asm = bytecodeToAsm(hexToBin(artifact.debug.bytecode));
    expect(asm).toContain('0040 OP_DEFINE');
    expect(asm).toContain('0140 OP_DEFINE');
    expect(asm).toContain('0050 OP_DEFINE');
    expect(asm).toContain('0150 OP_DEFINE');
    expect(artifact.bytecode.length / 2).toBeLessThan(3800);
  });

  it('shares repeated variable-width array element extraction', () => {
    const artifact = compileString(
      'struct S { int a; string b; int c; } contract C { S[] x;'
      + ' function f(int i) external { S[] a=x;'
      + ' require(a[i].c>=0 && a[i].c>=0 && a[i].c>=0); } }',
      { forceStateful: true },
    );
    const asm = bytecodeToAsm(hexToBin(artifact.debug.bytecode));
    expect(asm).toContain('0060 OP_DEFINE');
    expect(artifact.bytecode.length / 2).toBeLessThan(2800);
  });
});
