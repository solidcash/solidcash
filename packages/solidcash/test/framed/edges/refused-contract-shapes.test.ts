import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { publishedRefusals } from '../../../../solidc/test/framed/master/refused-entry.js';

/**
 * The contract shapes the framed path refuses by name.
 *
 * Each source is a real `.scash` unit handed to the shipped compiler with the framed convention, and each
 * assertion is the refusal the shipped code raises: an error code plus the fragment that names the fact.
 *
 * The shapes the framed path admits are not pinned here. Each settles in the case its refusal names: a value send
 * in `solidc/test/framed/master/send-output.test.ts`, a recovery precompile and a keccak side-car in
 * `solidc/test/framed/master/ecrecover-invalid-input.test.ts` and `composer/keccak-side-car.test.ts`, a
 * constructor that hashes in `deploy/genesis.test.ts`, a composite return and a struct argument in
 * `solidc/test/framed/master/composite-return.test.ts` and `composed-arguments.test.ts`, and a string-keyed
 * string mapping in `shapes/mapping-values.test.ts` and `shapes/string-mapping-delete.test.ts`.
 */

/** The message the compiler raises for a framed shape it will not emit. */
function refusal(source: string): string {
  try {
    const refusals = publishedRefusals(compileStringMulti(source, { composition: 'framed' }));
    if (refusals.length === 0) return '';
    return `FRAMED_CODEGEN_UNAVAILABLE: ${refusals.map((refused) => `${refused.functionName}: `
      + `${refused.reason}`).join(' | ')}`;
  } catch (error) {
    return (error as Error).message;
  }
}

// A body holding native assembly, as SafeERC20's re-raise of a callee's revert does, is refused by name in
// `solidc/test/framed/master/raw-call-refusals.test.ts`.

describe('a low-level call', () => {
  it('is refused by name: the witness call checks are not emitted', () => {
    const source = 'pragma solidcash ^0.14.0;'
      + ' contract Low { function f(address target) { target.call(hex"12345678"); require(true); } }';
    const message = refusal(source);
    expect(message).toContain('FRAMED_CODEGEN_UNAVAILABLE');
    expect(message).toContain('a low-level call needs the witness `calls[]` checks');
  });
});

describe('a keccak compute side-car', () => {
  it('is refused by name inside a loop whose bound is no counted recurrence', () => {
    const source = 'pragma solidcash ^0.14.0;'
      + ' contract Hashes {'
      + '   bytes32 h;'
      + '   function f(bytes a, int n) { int left = n; while (left > 0) { this.h = keccak256(a); left = left / 2; } }'
      + ' }';
    const message = refusal(source);
    expect(message).toContain('FRAMED_CODEGEN_UNAVAILABLE');
    expect(message).toContain('a keccak256 call in a loop whose counter or bound is not a recurrence');
  });
});
