import { createHash } from 'crypto';
import { describe, expect, it } from 'vitest';
import { compileString } from '../../../src/compiler.js';

/**
 * The `direct` convention is the shipped one, and the framed work must not fork it. Every case compiles once
 * with the option omitted and once with `composition: 'direct'`, and those two artifacts must be the same bytecode.
 * The hashes are that bytecode. They moved once when an integer literal beside a bounded operand took its type, so
 * `x + 1` carries the range check Solidity gives it, and again after later direct-convention fixes: a signature
 * check stays at the front of the entry the SDK signs, and `msg.sender` is read from the authenticated execution
 * frame. A framed compile may add artifacts, but it may not make these two directs disagree.
 */

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

const STATE_CONTRACT = 'pragma solidcash ^0.13.0;'
  + ' contract Counter(pubkey admin) {'
  + '   int public counter;'
  + '   function increment(sig s) {'
  + '     require(checkSig(s, admin));'
  + '     this.counter = this.counter + 1;'
  + '   }'
  + ' }';

const SENDER_CONTRACT = 'pragma solidcash ^0.13.0;'
  + ' contract Gate(address owner) {'
  + '   int public hits;'
  + '   function bump() { require(msg.sender == owner); this.hits = this.hits + 1; }'
  + ' }';

const CASES = [
  { name: 'a stateful contract with a signature check', source: STATE_CONTRACT,
    pinnedSha256: '3df7177060937de14d9013ef41f0e5aa3ac90e90bfc8dbd8c0b9693f37ed119d' },
  { name: 'a stateful contract that reads msg.sender', source: SENDER_CONTRACT,
    pinnedSha256: '3c31dca38e1e5ed55b0b98709d58e7594628ad9ee630658e0736b9d0960fdc2f' },
] as const;

describe('the direct convention is unchanged', () => {
  for (const { name, source, pinnedSha256 } of CASES) {
    it(`emits the same bytecode with and without the explicit option for ${name}`, () => {
      const implicit = compileString(source);
      const explicit = compileString(source, { composition: 'direct' });
      expect(explicit.bytecode).toBe(implicit.bytecode);
    });

    it(`emits the pinned bytecode for ${name}`, () => {
      expect(sha256(compileString(source).bytecode)).toBe(pinnedSha256);
    });
  }
});
