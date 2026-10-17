import { createHash } from 'crypto';
import { describe, expect, it } from 'vitest';
import { compileString } from '../../../src/compiler.js';

/**
 * The `direct` convention is the shipped one, and the framed work must not fork it. Every case compiles once
 * with the option omitted and once with `composition: 'direct'`, and those two artifacts must be the same bytecode.
 * The hashes are that bytecode. They moved once when an integer literal beside a bounded operand took its type, so
 * `x + 1` carries the range check Solidity gives it, and again after later direct-convention fixes: a signature
 * check stays at the front of the entry the SDK signs, and `msg.sender` is read from the authenticated execution
 * frame; once more when the record and container covenants were bound to the contract's own lock; and again when
 * the mutable-output check tried the locks the contract mints before scanning inputs; and again when the slot scans
 * became one classifying pass per side that also counts minting uniqueness. A framed compile may add artifacts, but
 * it may not make these two directs disagree.
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
    pinnedSha256: 'ef7fd532e1de13f25296747e20791b9419d1eb6824898ed7be28635ec25e8eae' },
  { name: 'a stateful contract that reads msg.sender', source: SENDER_CONTRACT,
    pinnedSha256: '1359f3e91e81bed6596baea510775772e3b306f75db16e0f8479208172abbae0' },
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
