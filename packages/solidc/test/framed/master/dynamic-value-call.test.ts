import { describe, expect, it } from 'vitest';
import { compileString, compileStringMulti } from '../../../src/compiler.js';
import { isServed } from './refused-entry.js';

/**
 * A body that touches a dynamic value and makes an external call is served.
 *
 * A dynamic value's bytes live in a run of chunk NFTs whose first coordinate lies one layout width past the
 * frame's declared record block. The head parks that block's base and each body adds its own width, so a body
 * whose records are split into one segment per call still locates the run: the read resolves against the segment
 * its own calls have reached. The bodies below would each have been refused by name before, either because the
 * value's chunk run and the call's records shared one declaration, or because the width they need disagreed with
 * their siblings'.
 */

/** The callee address every source calls, a compile-time bytes20. */
const TARGET = '0x' + '11'.repeat(20);

const returningInterface = ' interface IAnswer { function answer() returns (int); }';
const voidInterface = ' interface IPing { function ping(); }';

const WRITE_WITH_RETURNING_CALL = 'pragma solidcash ^0.14.0;'
  + returningInterface
  + ' contract A {'
  + '   string[] public names;'
  + `   function push() { this.names.push("hi"); int r = IAnswer(${TARGET}).answer(); require(r == 1); }`
  + ' }';

const WRITE_WITH_VOID_CALL = 'pragma solidcash ^0.14.0;'
  + voidInterface
  + ' contract A {'
  + '   string[] public names;'
  + `   function push() { this.names.push("hi"); IPing(${TARGET}).ping.call(); require(true); }`
  + ' }';

const RECORD_ARRAY_WITH_CALL = 'pragma solidcash ^0.14.0;'
  + voidInterface
  + ' contract A {'
  + '   struct P { int x; }'
  + '   P[] public pts;'
  + `   function push() { this.pts.push(P(1)); IPing(${TARGET}).ping.call(); require(true); }`
  + ' }';

const READ_WITH_CALL = 'pragma solidcash ^0.14.0;'
  + voidInterface
  + ' contract A {'
  + '   string public name;'
  + `   function check() { IPing(${TARGET}).ping.call(); require(this.name.length >= 0); }`
  + ' }';

/** The write on its own: the frame's segments do not multiply, so the run is locatable. */
const WRITE_WITHOUT_CALL = 'pragma solidcash ^0.14.0;'
  + ' contract A {'
  + '   string[] public names;'
  + '   function push() { this.names.push("hi"); require(true); }'
  + ' }';

/** A call with no dynamic value: there is no run to locate. */
const CALL_WITHOUT_DYNAMIC = 'pragma solidcash ^0.14.0;'
  + voidInterface
  + ' contract B {'
  + `   function callIt() { IPing(${TARGET}).ping.call(); require(true); }`
  + ' }';

/** The entries one contract's artifact publishes in its ABI, in declaration order. */
function abiNames(source: string, contract: string): string[] {
  const artifacts = compileStringMulti(source, { composition: 'framed' });
  return (artifacts[contract]?.abi ?? []).map((entry) => entry.name);
}

describe('a body that touches a dynamic value and makes an external call', () => {
  it('serves the write with a returning call rather than crashing code generation', () => {
    expect(() => compileString(WRITE_WITH_RETURNING_CALL, { composition: 'framed' })).not.toThrow();
    expect(isServed(WRITE_WITH_RETURNING_CALL)).toBe(true);
    expect(abiNames(WRITE_WITH_RETURNING_CALL, 'A')).toStrictEqual(['push']);
  });

  it('serves the write whatever the call returns', () => {
    expect(isServed(WRITE_WITH_VOID_CALL)).toBe(true);
  });

  it('serves a record-shaped dynamic array the same way', () => {
    expect(isServed(RECORD_ARRAY_WITH_CALL)).toBe(true);
  });

  it('serves a read of a dynamic value as well as a write', () => {
    expect(isServed(READ_WITH_CALL)).toBe(true);
  });

  it('serves the write when the body makes no call', () => {
    expect(isServed(WRITE_WITHOUT_CALL)).toBe(true);
  });

  it('serves the call when the body touches no dynamic value', () => {
    expect(isServed(CALL_WITHOUT_DYNAMIC)).toBe(true);
  });
});
