import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../src/compiler.js';
import { publishedRefusals } from './refused-entry.js';

/**
 * A public body that writes a sorted mapping, reached by a `this.` self-call, is refused by name.
 *
 * Such a body compiles as a subroutine of the body that self-calls it, and a subroutine returns at the body's values
 * before the sorted-batch transition epilogue and the segment close run. So the predecessor relink of an insert, the
 * distinct-target check and the collection's node-count census are never emitted in the caller's frame, and the
 * caller carries none of the callee's writes (its own accesses name the call, not the mapping nodes). Only the
 * inline per-target output pin the body emits survives, which proves each written node's own commitment but not the
 * topology around it. A forged segment could then settle two nodes for one key, or a node the sorted list skips. The
 * admission refuses the writing body by name, whatever its caller's calls, and the caller with it; called directly,
 * the body's own entry frame emits the transition and settles it.
 *
 * Before this, a caller that made no external call before the invocation, or one whose only call came after it,
 * composed the unverified frame; only a call that preceded the invocation refused it, and then for the wrong reason
 * (the segment the write lands in, rather than the transition never being emitted at all).
 */

const SOURCE = (call: 'none' | 'before' | 'after' | 'conditionalBefore'): string => 'pragma solidcash ^0.14.0;'
  + ' interface IOther { function ping(); }'
  + ' contract Other { function ping() { require(true); } }'
  + ' contract Ledger {'
  + '   mapping(address => int) bal;'
  + '   function transfer(address to, int amount) {'
  + '     this.bal[msg.sender] = this.bal[msg.sender] - amount;'
  + '     this.bal[to] = this.bal[to] + amount;'
  + '     require(true);'
  + '   }'
  + `   function sweep(${call === 'conditionalBefore' ? 'bool c' : ''}) {`
  + `     ${call === 'before' ? 'IOther(0x7676a914111111111111111111111111111111111111111188ac).ping.call();' : ''}`
  + `     ${call === 'conditionalBefore' ? 'if (c) { IOther(0x7676a914111111111111111111111111111111111111111188ac).ping.call(); }' : ''}`
  + '     this.transfer(0x7676a914222222222222222222222222222222222222222288ac, 5);'
  + `     ${call === 'after' ? 'IOther(0x7676a914111111111111111111111111111111111111111188ac).ping.call();' : ''}`
  + '     require(true); }'
  + ' }';

/** The refusal a self-called sorted-mapping writer carries: its transition is never emitted in the caller's frame. */
const TRANSFER_REASON = 'the body derives a sorted-mapping write and is run as a subroutine by a self-call, whose '
  + 'frame never emits the batch transition that proves the write\'s topology (the predecessor relink, the '
  + 'distinct-target check and the node count); call it directly so its own entry frame proves it';
/** The caller is refused with it: it runs the refused body. */
const SWEEP_REASON = `it runs 'transfer', which the master cannot serve: ${TRANSFER_REASON}`;

describe('a public body that writes a sorted mapping, reached by a self-call', () => {
  for (const call of ['none', 'after', 'before', 'conditionalBefore'] as const) {
    it(`refuses the writing body by name, with its caller (${call})`, () => {
      const refusals = publishedRefusals(compileStringMulti(SOURCE(call), { composition: 'framed' }));
      expect(refusals.map((refused) => refused.functionName).sort())
        .toStrictEqual(['Ledger.sweep()', 'Ledger.transfer()']);
      expect(refusals.find((refused) => refused.functionName === 'Ledger.transfer()')!.reason).toBe(TRANSFER_REASON);
      expect(refusals.find((refused) => refused.functionName === 'Ledger.sweep()')!.reason).toBe(SWEEP_REASON);
    });
  }
});
