import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../src/compiler.js';
import { publishedRefusals } from './refused-entry.js';

/**
 * The segment a self-called body's sorted-batch write lands in.
 *
 * A body that writes a sorted mapping derives its batch operands from the witness block's segment list, and the
 * segment it reads is the number of external calls its own code makes before the write. A `this.f()` self-call is
 * a subroutine rather than a record - it closes no segment - so the body's own count is right exactly while the
 * frame that invokes it has made no external call; a caller that makes one lands the write in a later segment than
 * the derivation reads. The admission refuses that shape by the name of the call rather than composing a frame
 * that cannot settle, and leaves the call-free caller composed.
 */

const SOURCE = (call: 'none' | 'before' | 'after'): string => 'pragma solidcash ^0.13.0;'
  + ' interface IOther { function ping(); }'
  + ' contract Other { function ping() { require(true); } }'
  + ' contract Ledger {'
  + '   mapping(address => int) bal;'
  + '   function transfer(address to, int amount) {'
  + '     this.bal[msg.sender] = this.bal[msg.sender] - amount;'
  + '     this.bal[to] = this.bal[to] + amount;'
  + '     require(true);'
  + '   }'
  + '   function sweep() {'
  + `     ${call === 'before' ? 'IOther(0x7676a914111111111111111111111111111111111111111188ac).ping.call();' : ''}`
  + ''
  + '     this.transfer(0x7676a914222222222222222222222222222222222222222288ac, 5);'
  + `     ${call === 'after' ? 'IOther(0x7676a914111111111111111111111111111111111111111188ac).ping.call();' : ''}`
  + '     require(true); }'
  + ' }';

describe('a self-called body that writes a sorted mapping', () => {
  it('is composed when the frame that invokes it makes no external call', () => {
    const artifacts = compileStringMulti(SOURCE('none'), { composition: 'per-call' });
    expect(publishedRefusals(artifacts)).toStrictEqual([]);
  });

  it('is composed when the caller\'s own call comes after the invocation', () => {
    // The write precedes the caller's call, so the segment it lands in is still the one the invocation ran in: the
    // admission refuses only a call the caller has already made.
    const artifacts = compileStringMulti(SOURCE('after'), { composition: 'per-call' });
    expect(publishedRefusals(artifacts)).toStrictEqual([]);
  });

  it('is refused by name, with its caller, when the caller calls before invoking it', () => {
    const refusals = publishedRefusals(compileStringMulti(SOURCE('before'), { composition: 'per-call' }));
    expect(refusals.map((refused) => refused.functionName).sort())
      .toStrictEqual(['Ledger.sweep()', 'Ledger.transfer()']);
    const transfer = refusals.find((refused) => refused.functionName === 'Ledger.transfer()')!;
    expect(transfer.reason).toBe('the body derives a verified-mapping write and is invoked by \'sweep\' after an '
      + 'external call: a subroutine reads the segment its own code names, and the caller\'s call puts the write in '
      + 'a later one');
    expect(refusals.find((refused) => refused.functionName === 'Ledger.sweep()')!.reason)
      .toMatch(/it runs 'transfer', which the master cannot serve/);
  });
});
