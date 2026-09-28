import { describe, expect, it } from 'vitest';
import { compileString, compileStringMulti } from '../../../src/compiler.js';
import { isServed, publishedRefusals, refusalMessageOf } from './refused-entry.js';

/**
 * A body that touches a dynamic value and makes an external call is refused by name.
 *
 * A dynamic value's bytes live in a run of chunk NFTs whose first coordinate the head derives from the record block
 * the frame declares. A call ends the segment the code before it runs in, so a body that makes one declares its
 * records per segment — and a frame that both touches a dynamic value and makes a call has no one declaration the
 * head can locate the run from. The body is published as a refusal rather than emitted; before this, the emitted
 * body crashed code generation when the call returned a value, and it produced a program that could not settle
 * when the call did not.
 */

/** The callee address every source calls, a compile-time bytes20. */
const TARGET = '0x' + '11'.repeat(20);

/** The refusal every such body publishes, as the shipped compiler writes it. */
const REFUSAL = 'the body reads or writes a dynamic value and makes an external call, so the value\'s chunk run '
  + 'and the call\'s blocks share the frame\'s records, which the master cannot locate from one declaration';

const returningInterface = ' interface IAnswer { function answer() returns (int); }';
const voidInterface = ' interface IPing { function ping(); }';

const WRITE_WITH_RETURNING_CALL = 'pragma solidcash ^0.13.0;'
  + returningInterface
  + ' contract A {'
  + '   string[] public names;'
  + `   function push() { this.names.push("hi"); int r = IAnswer(${TARGET}).answer(); require(r == 1); }`
  + ' }';

const WRITE_WITH_VOID_CALL = 'pragma solidcash ^0.13.0;'
  + voidInterface
  + ' contract A {'
  + '   string[] public names;'
  + `   function push() { this.names.push("hi"); IPing(${TARGET}).ping.call(); require(true); }`
  + ' }';

const RECORD_ARRAY_WITH_CALL = 'pragma solidcash ^0.13.0;'
  + voidInterface
  + ' contract A {'
  + '   struct P { int x; }'
  + '   P[] public pts;'
  + `   function push() { this.pts.push(P(1)); IPing(${TARGET}).ping.call(); require(true); }`
  + ' }';

const READ_WITH_CALL = 'pragma solidcash ^0.13.0;'
  + voidInterface
  + ' contract A {'
  + '   string public name;'
  + `   function check() { IPing(${TARGET}).ping.call(); require(this.name.length >= 0); }`
  + ' }';

/** The write on its own: the frame's segments do not multiply, so the run is locatable. */
const WRITE_WITHOUT_CALL = 'pragma solidcash ^0.13.0;'
  + ' contract A {'
  + '   string[] public names;'
  + '   function push() { this.names.push("hi"); require(true); }'
  + ' }';

/** A call with no dynamic value: there is no run to locate. */
const CALL_WITHOUT_DYNAMIC = 'pragma solidcash ^0.13.0;'
  + voidInterface
  + ' contract B {'
  + `   function callIt() { IPing(${TARGET}).ping.call(); require(true); }`
  + ' }';

describe('a body that touches a dynamic value and makes an external call', () => {
  it('no longer crashes code generation for the write with a returning call', () => {
    // The compile publishes the refusal; it does not throw a stack-variable error from the emitter.
    expect(() => compileString(WRITE_WITH_RETURNING_CALL, { composition: 'per-call' })).not.toThrow();
    expect(refusalMessageOf(WRITE_WITH_RETURNING_CALL)).toContain(REFUSAL);
  });

  it('names the entry the refusal belongs to', () => {
    const refusals = publishedRefusals(compileStringMulti(WRITE_WITH_RETURNING_CALL, { composition: 'per-call' }) as
      Record<string, { composition?: unknown }>);
    expect(refusals).toStrictEqual([{ functionName: 'A.push()', reason: REFUSAL }]);
  });

  it('refuses the write whatever the call returns', () => {
    expect(refusalMessageOf(WRITE_WITH_VOID_CALL)).toContain(REFUSAL);
  });

  it('refuses a record-shaped dynamic array the same way', () => {
    expect(refusalMessageOf(RECORD_ARRAY_WITH_CALL)).toContain(REFUSAL);
  });

  it('refuses a read of a dynamic value as well as a write', () => {
    expect(refusalMessageOf(READ_WITH_CALL)).toContain(REFUSAL);
  });

  it('serves the write when the body makes no call', () => {
    expect(isServed(WRITE_WITHOUT_CALL)).toBe(true);
  });

  it('serves the call when the body touches no dynamic value', () => {
    expect(isServed(CALL_WITHOUT_DYNAMIC)).toBe(true);
  });
});
