import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const P = 'pragma solidcash ^0.52.0;';

describe('unsafe(1) value-moving body is refused', () => {
  it('rejects an unsafe(1) body that moves satoshis', () => {
    expect(() => compileString(`${P} contract C() { int counter;
      function drain(bytes20 recipient) unsafe(1) {
        this.transfer(new LockingBytecodeP2PKH(recipient), 1000);
      }
    }`)).toThrow(/unsafe\(1\).*transfers|cannot use transfers/i);
  });

  it('accepts an unsafe(1) body that performs no value movement', () => {
    expect(() => compileString(`${P} contract C(pubkey admin) { int counter;
      function admin1(sig s) unsafe(1) { require(checkSig(s, admin)); }
    }`)).not.toThrow();
  });
});
