import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { publishedRefusals } from '../../../../solidc/test/per-call/master/refused-entry.js';
import { hexOf, seededAddress } from '../shapes/harness.js';

/**
 * One entry appending to one log three times: `Hub.go` calls `Log.append` three times, and an append pushes onto the
 * log's dynamic array and emits an event. The shipped per-call lowering coalesces the repeated call to one target,
 * so no single master head can fix the set of call records the three sites need.
 */

const LOG = hexOf(seededAddress('same entry appends log'));

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface ILog { function append(int id, int item); }'
  + ' contract Log {'
  + '   int[] items;'
  + '   event Appended(int indexed id, int item);'
  + '   function append(int id, int item) { this.items.push(item); emit Appended(id, item); require(true); }'
  + ' }'
  + ' contract Hub {'
  + '   function go() {'
  + `     ILog(0x${LOG}).append(1, 10);`
  + `     ILog(0x${LOG}).append(2, 20);`
  + `     ILog(0x${LOG}).append(3, 30);`
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

describe('one entry appending to one log three times', () => {
  it('is refused today: a repeated call to one target has no fixed set of call records', () => {
    const refusal = compileRefusal(SOURCE);
    expect(refusal.code).toBe('PER_CALL_CODEGEN_UNAVAILABLE');
    expect(refusal.message)
      .toMatch(/the call to 'append' runs repeatedly/);
  });
});
