import { describe, expect, it } from 'vitest';
import { compileString } from '../../../src/compiler.js';

/**
 * `new LockingBytecodeP2PKH(hash)` and the other built-in locking bytecode classes build an output's locking bytecode;
 * they do not create a contract. The framed convention refuses a contract creation without a salt, and that refusal
 * must not catch a built-in class, or a framed contract cannot pay a P2PKH output.
 */
const PAY = (lock: string): string => `pragma solidcash ^0.52.0;
contract Pays(pubkey owner, bytes20 to) {
  int public n;
  function pay(sig s) public {
    require(checkSig(s, owner));
    this.n += 1;
    this.transfer(${lock}, 1000);
  }
}`;

describe('framed built-in locking bytecode instantiation', () => {
  it('compiles a framed payment to new LockingBytecodeP2PKH(...)', () => {
    expect(() => compileString(PAY('new LockingBytecodeP2PKH(to)'), { composition: 'direct' })).not.toThrow();
    expect(() => compileString(PAY('new LockingBytecodeP2PKH(to)'), { composition: 'framed' })).not.toThrow();
  });

  it('compiles a framed payment to new LockingBytecodeP2SH20(...)', () => {
    expect(() => compileString(PAY('new LockingBytecodeP2SH20(to)'), { composition: 'framed' })).not.toThrow();
  });
});
