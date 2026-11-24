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
 * became one classifying pass per side that also counts minting uniqueness; and again when the token container
 * covenant lost its merge path and the keep of an unnamed container refused a minting NFT (the master pin's destroy
 * arm moved them only while every contract carried it); and again when the own-category count pinned each record
 * beside a count-path call at its own index (C3); and again when the data-record covenant, whose lock the master
 * rebuilds to check its records, defined its authority bind and its category once; and again when a drained container
 * left a sweepable filler in place of a zero-value output (c2d8ed7ea); and again when `genesisCalls` went on by
 * default, so these record-sound contracts carry the genesis step and their marker (with `genesisCalls: false` each is
 * the previous bytecode less the trailing marker push, which A7 drops when the option is off); and again when a call
 * record named its reader, so each entry takes the reader witness (without it each is the previous bytecode). A framed
 * compile may add artifacts, but it may not make these two directs disagree.
 */

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

const STATE_CONTRACT = 'pragma solidcash ^0.52.0;'
  + ' contract Counter(pubkey admin) {'
  + '   int public counter;'
  + '   function increment(sig s) {'
  + '     require(checkSig(s, admin));'
  + '     this.counter = this.counter + 1;'
  + '   }'
  + ' }';

const SENDER_CONTRACT = 'pragma solidcash ^0.52.0;'
  + ' contract Gate(address owner) {'
  + '   int public hits;'
  + '   function bump() { require(msg.sender == owner); this.hits = this.hits + 1; }'
  + ' }';

const CASES = [
  { name: 'a stateful contract with a signature check', source: STATE_CONTRACT,
    pinnedSha256: 'c647d0988c7931c2cd75fdf210df65cb67f7f4b823098c3c3e2bd4c4dcd1a611' },
  { name: 'a stateful contract that reads msg.sender', source: SENDER_CONTRACT,
    pinnedSha256: 'd39e4f6939ba1ca106015d952722471a2479523e48b7c3e06fda1355c4f12a66' },
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
