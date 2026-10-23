import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const P = 'pragma solidcash ^0.14.0;';
const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
} as const;

describe('message-bus witness ordinal publication', () => {
  it('publishes each eligible handler\'s stable dispatch ordinal', () => {
    const artifact = compileString(`${P} contract C(pubkey admin) { int count;
      function a(sig s) public { require(checkSig(s, admin)); this.count = this.count + 1; }
      function b(sig s) public { require(checkSig(s, admin)); this.count = this.count + 2; }
    }`, KERNEL);
    const eligible = (artifact.messageBus?.handlers ?? []).filter((handler) => handler.eligible);
    expect(eligible.map((handler) => handler.name)).toEqual(['a', 'b']);
    eligible.forEach((handler, index) => expect(handler.witnessOrdinal).toBe(index));
  });
});

describe('unsafe(1) value-moving body is refused', () => {
  it('rejects an unsafe(1) body that moves satoshis', () => {
    expect(() => compileString(`${P} contract C() { int counter;
      function drain(bytes20 recipient) unsafe(1) {
        this.transfer(new LockingBytecodeP2PKH(recipient), 1000);
      }
    }`, { messageBus: false })).toThrow(/unsafe\(1\).*transfers|cannot use transfers/i);
  });

  it('accepts an unsafe(1) body that performs no value movement', () => {
    expect(() => compileString(`${P} contract C(pubkey admin) { int counter;
      function admin1(sig s) unsafe(1) { require(checkSig(s, admin)); }
    }`, { messageBus: false })).not.toThrow();
  });
});
