import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../src/compiler.js';
import { hexOf, seededAddress } from '../../../../solidcash/test/framed/shapes/harness.js';

/**
 * The operand the direct path threads into a body for its call's return event.
 *
 * A direct-convention body reads the value a callee returned out of the output that carries the return event, so
 * the semantic pass injects a parameter naming that output — bare when one call returns a value, indexed per
 * returning slot when several do. A framed master writes no such output: the frame records the value in `retval`
 * and the body takes the call's result from its own witness record where the call is made, so the operand is dead
 * in this program and must not refuse the contract or reach a caller through the published interface.
 */

const FIRST = hexOf(seededAddress('return operand first'));
const SECOND = hexOf(seededAddress('return operand second'));

const HEAD = 'pragma solidcash ^0.14.0;';

const INTERFACES = ' interface IOne { function one() returns (int); }'
  + ' interface ITwo { function two() returns (int); }';

/** Two calls that both return a value, which is the shape the semantic pass names per slot. */
const TWO_RETURNING_CALLS = HEAD + INTERFACES
  + ' contract Caller {'
  + '   function go() {'
  + `     int a = IOne(0x${FIRST}).one();`
  + `     int b = ITwo(0x${SECOND}).two();`
  + '     require(a + b > 0);'
  + '   }'
  + ' }';

/** One such call, whose operand is the bare name rather than an indexed one. */
const ONE_RETURNING_CALL = HEAD + INTERFACES
  + ' contract Caller {'
  + '   function go() {'
  + `     int a = IOne(0x${FIRST}).one();`
  + '     require(a > 0);'
  + '   }'
  + ' }';

const compiling = (source: string): ReturnType<typeof compileStringMulti> =>
  compileStringMulti(source, { composition: 'framed' });

/** Every parameter the compiled unit publishes for one contract's entries, synthetic ones included. */
const publishedParameters = (source: string, contract: string): readonly string[] =>
  (compiling(source)[contract]?.abi ?? [])
    .flatMap((entry) => (entry.inputs ?? []).map((input) => input.name));

describe('an entry whose calls return values', () => {
  it('is admitted, and the per-slot return-event operand is stripped rather than published', () => {
    // The operand exists in the direct convention's frame; a caller of this master cannot know it, so publishing
    // it would ask for a value no caller holds.
    const parameters = publishedParameters(TWO_RETURNING_CALLS, 'Caller');
    expect(parameters.some((name) => name.startsWith('__internal__externalReturnOutputIdx'))).toBe(false);
    expect(parameters.some((name) => name.startsWith('__internal__'))).toBe(false);
  });

  it('is admitted in the one-call shape too, whose operand carries the bare name', () => {
    expect(publishedParameters(ONE_RETURNING_CALL, 'Caller')).toStrictEqual([]);
  });
});
