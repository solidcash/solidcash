/**
 * B5.6: the `args` call option parses only on `new`, and the compiler's `__solidcash_` prefix is reserved.
 *
 * The deployer path itself is not built yet (B5.4), so an `args` instantiation parses and is then refused with the
 * reason `args-outside-deployer-new` when the child is stateless: that refusal proves the parse succeeded.
 */
import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

const P = 'pragma solidcash ^0.51.0;';

describe('B5.6: new C{args: (...)}', () => {
  it('parses one contract argument', () => {
    expect(() => compileString(`${P} contract Child(int limit) { function poke() { require(limit > 0); } }`
      + ' contract Parent() { function make(int v) { Child c = new Child{args: v}(); c.poke(); } }'))
      .toThrow(/args-outside-deployer-new/);
  });

  it('parses a parenthesized list of contract arguments', () => {
    expect(() => compileString(`${P} contract Child(int a, bytes20 b) { function poke() { require(a > 0); } }`
      + ' contract Parent() { function make(int v, bytes20 w) { Child c = new Child{args: (v, w)}(); c.poke(); } }'))
      .toThrow(/args-outside-deployer-new/);
  });

  it('refuses args outside new as an unknown call option', () => {
    expect(() => compileString(`${P} contract C { function f(int x) { } function g(int x) { this.f{args: x}(); } }`))
      .toThrow(/Unknown call option 'args'/);
  });

  it.each([
    ['event', 'contract C { event E(int __solidcash_x); }'],
    ['function', 'contract C { function __solidcash_f() { } }'],
    ['modifier', 'contract C { modifier __solidcash_m() { _; } }'],
    ['state variable', 'contract C { int __solidcash_s; }'],
    ['parameter', 'contract C { function f(int __solidcash_p) { } }'],
    ['file-level constant', 'int constant __solidcash_v = 1; contract C { function f() { } }'],
    ['library', 'library L { function __solidcash_l() internal pure { } } contract C { function f() { } }'],
    ['interface', 'interface I { function __solidcash_i() external; } contract C { function f() { } }'],
    ['inherited contract', 'contract B { int __solidcash_b; } contract C is B { function f() { } }'],
    ['contract name', 'contract __solidcash_C { function f() { } }'],
  ])('refuses a %s named with the reserved prefix', (_kind, source) => {
    expect(() => compileString(`${P} ${source}`)).toThrow(/reserved/);
  });

  it('refuses an assignment to an undeclared reserved local', () => {
    expect(() => compileString(`${P} contract C { function f() { __solidcash_created = 1; } }`))
      .toThrow(/reserved/);
  });
});
