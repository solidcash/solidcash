import { createHash } from 'crypto';
import { describe, expect, it } from 'vitest';
import { compileString } from '../../../src/compiler.js';

/**
 * The `direct` convention is the shipped one, and the per-call work must not move it. Every case below pins the
 * artifact bytecode it produced before the per-call modules existed: a second compile without the option, and a
 * hash of the emitted ASM. The per-call convention may add artifacts, but it may not change this one. The pins moved
 * once, by the user's decision: an integer literal beside a bounded operand now takes its type, so `x + 1` carries
 * the range check Solidity gives it on every path.
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
    pinnedSha256: '74a96bf9f5f50e469cd718e20b7a45b5663964bf30c53b6ee25d91987c00f61a' },
  { name: 'a stateful contract that reads msg.sender', source: SENDER_CONTRACT,
    pinnedSha256: '37e73f9ca61e8a4ffd8a4239f6a47d2b7f05b7c6378cd40a21bface38a9ebb4a' },
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
