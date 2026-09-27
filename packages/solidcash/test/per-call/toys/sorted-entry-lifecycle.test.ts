import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { publishedRefusals } from '../../../../solidc/test/per-call/master/refused-entry.js';
import { hexOf, seededAddress } from '../shapes/harness.js';

/**
 * Insert, update and delete of one key across three calls of one Hub entry in one transaction. The three writes reach
 * one target, so the shipped per-call lowering coalesces them and no single master head can fix the call records.
 */

const LEDGER = hexOf(seededAddress('sorted entry lifecycle ledger'));

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface ILedger {'
  + '   function insert(int key, int value);'
  + '   function update(int key, int value);'
  + '   function remove(int key);'
  + ' }'
  + ' contract Ledger {'
  + '   mapping(int => int) records;'
  + '   function insert(int key, int value) { this.records[key] = value; require(true); }'
  + '   function update(int key, int value) { this.records[key] = value; require(true); }'
  + '   function remove(int key) { delete this.records[key]; require(true); }'
  + ' }'
  + ' contract Hub {'
  + '   function run() {'
  + `     ILedger(0x${LEDGER}).insert(1, 10);`
  + `     ILedger(0x${LEDGER}).update(1, 20);`
  + `     ILedger(0x${LEDGER}).remove(1);`
  + '     require(true);'
  + '   }'
  + ' }';

/** The code and message the shipped compile raises, or a failure when it accepts the source. */
function compileRefusal(source: string): { readonly code?: string; readonly message: string } {
  // The refusal a compile publishes for a body it cannot serve, or the one it throws when the master itself is a
  // shape the convention does not have.
  try {
    const refusals = publishedRefusals(compileStringMulti(source, { composition: 'per-call' }) as
      Record<string, { composition?: unknown }>);
    if (refusals.length === 0) {
      throw new Error('the shipped per-call compiler served the source, so there is no refusal to record');
    }
    return {
      code: 'PER_CALL_CODEGEN_UNAVAILABLE',
      message: refusals.map((refused) => `${refused.functionName}: ${refused.reason}`).join(' | '),
    };
  } catch (error) {
    const refusal = error as { code?: string; message: string };
    if (refusal.code !== undefined) return { code: refusal.code, message: refusal.message };
    throw error;
  }
}

describe('one entry inserting, updating and deleting one key in one transaction', () => {
  it('is refused today: the three writes reach one target from one entry, so the call records are not fixed', () => {
    const refusal = compileRefusal(SOURCE);
    expect(refusal.code).toBe('PER_CALL_CODEGEN_UNAVAILABLE');
    expect(refusal.message)
      .toMatch(/the call to 'insert' runs repeatedly/);
  });
});
