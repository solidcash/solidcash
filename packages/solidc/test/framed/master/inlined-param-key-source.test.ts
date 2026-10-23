import { describe, expect, it } from 'vitest';
import { compileString } from '../../../src/compiler.js';

// A helper that makes an external call and writes a mapping keyed by its own parameter is inlined into the caller
// (the call is why), binding each value parameter to a fresh compiler-owned local. The write then reaches code
// generation with that copy as its key. The key source must still be the caller's parameter: publishing the copy
// as an opaque expression makes a framed master materialize it at its batch-witness derivation, which shifts the
// frame and unsettles a later segment close.
const ADDR = '76a914' + '11'.repeat(20) + '88ac';
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ISink { function take(int amount); }'
  + ' contract Impl {'
  + '   mapping(address => uint) awarded;'
  + '   function _record(address to, uint amount, bool byWorker) internal {'
  + `     ISink(0x${ADDR}).take(amount);`
  + '     if (byWorker) { this.awarded[to] = amount; }'
  + '     require(true);'
  + '   }'
  + '   function record(address to, uint amount) { _record(to, amount, true); require(true); }'
  + ' }';

describe('a mapping key an inliner copied from a parameter', () => {
  it('stays the caller\'s parameter rather than an opaque expression', () => {
    const artifact = compileString(SOURCE, { composition: 'framed' });
    const access = artifact.abi.find((row) => row.name === 'record')!
      .entryAccesses!.find((entry) => entry.collection === 'awarded')!;
    expect(access.keyParams).toEqual(['to']);
    // The artifact publishes no per-key source when every key is a parameter; it publishes one when a key is an
    // opaque expression the SDK must derive, which is the shape this regression reintroduced.
    expect(access.keySources).toBeUndefined();
  });
});
