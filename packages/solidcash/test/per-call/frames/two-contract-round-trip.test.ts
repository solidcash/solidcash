import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { hexOf, seededAddress } from '../shapes/harness.js';

/**
 * A two-contract round trip, compiled per-call. The spec's worked example, "Example: `A -> B -> B -> A`", enters
 * `A.f` which calls `B.g`, which calls `B.h` inline, which calls back into `A.k`: `A` is entered twice, so its two
 * entries make different numbers of external calls. The shipped compiler refuses it before any master exists.
 */

const A_ADDRESS = seededAddress('the entering contract');
const B_ADDRESS = seededAddress('the returning contract');

/** The refusal the shipped compiler raises for the round trip, as the code, message and context it carries. */
interface CompilerRefusal {
  readonly code: string;
  readonly message: string;
  readonly context: Record<string, unknown>;
}

/** Compiles a unit per-call, reporting the shipped refusal instead of letting it escape. */
function compilePerCall(source: string): {
  readonly artifacts?: ReturnType<typeof compileStringMulti>;
  readonly refusal?: CompilerRefusal;
} {
  try {
    return { artifacts: compileStringMulti(source, { composition: 'per-call' }) };
  } catch (error) {
    return { refusal: error as CompilerRefusal };
  }
}

/** The worked example: `A.f -> B.g -> B.h inline -> A.k`, so `A` is entered twice. */
const ROUND_TRIP = 'pragma solidcash ^0.13.0;'
  + ' interface IB { function g(uint256 x) returns (uint256); }'
  + ' interface IA { function k() returns (uint256); }'
  + ' contract A {'
  + '   uint256 count;'
  + '   uint256 hits;'
  + '   uint256 last;'
  + '   event Counted(uint256 r);'
  + '   function f(uint256 x) returns (uint256) {'
  + '     count = count + 1;'
  + `     uint256 r = IB(0x${hexOf(B_ADDRESS)}).g(x);`
  + '     last = r;'
  + '     emit Counted(r);'
  + '     return r;'
  + '   }'
  + '   function k() returns (uint256) {'
  + '     hits = hits + 1;'
  + '     return count;'
  + '   }'
  + ' }'
  + ' contract B {'
  + '   uint256 total;'
  + '   function g(uint256 x) returns (uint256) {'
  + '     total = total + x;'
  + '     uint256 y = this.h(x);'
  + '     return y + total;'
  + '   }'
  + '   function h(uint256 x) returns (uint256) {'
  + '     total = total + 1;'
  + `     return IA(0x${hexOf(A_ADDRESS)}).k();`
  + '   }'
  + ' }';

/**
 * The same two contracts with `A`'s two entries each making one external call.
 *
 * This is the one property the refusal names, changed and nothing else: `A.k` calls out, so both entries agree on
 * how many call records the master head's tail holds.
 */
const EVEN_CALL_COUNTS = 'pragma solidcash ^0.13.0;'
  + ' interface IB { function g(uint256 x) returns (uint256); function h(uint256 x) returns (uint256); }'
  + ' interface IA { function k() returns (uint256); }'
  + ' contract A {'
  + '   uint256 count;'
  + '   function f(uint256 x) returns (uint256) {'
  + '     count = count + 1;'
  + `     return IB(0x${hexOf(B_ADDRESS)}).g(x);`
  + '   }'
  + '   function k() returns (uint256) {'
  + '     count = count + 1;'
  + `     return IB(0x${hexOf(B_ADDRESS)}).h(count);`
  + '   }'
  + ' }'
  + ' contract B {'
  + '   uint256 total;'
  + '   function g(uint256 x) returns (uint256) {'
  + '     total = total + x;'
  + `     return IA(0x${hexOf(A_ADDRESS)}).k();`
  + '   }'
  + '   function h(uint256 x) returns (uint256) {'
  + '     total = total + 1;'
  + `     return IA(0x${hexOf(A_ADDRESS)}).k();`
  + '   }'
  + ' }';

/** The two contracts with no call back at all: `A` calls `B` once and each contract has a single entry. */
const ONE_WAY = 'pragma solidcash ^0.13.0;'
  + ' interface IB { function g(uint256 x) returns (uint256); }'
  + ' contract A {'
  + '   uint256 count;'
  + '   function f(uint256 x) returns (uint256) {'
  + '     count = count + 1;'
  + `     return IB(0x${hexOf(B_ADDRESS)}).g(x);`
  + '   }'
  + ' }'
  + ' contract B {'
  + '   uint256 total;'
  + '   function g(uint256 x) returns (uint256) {'
  + '     total = total + x;'
  + '     return total;'
  + '   }'
  + ' }';

describe('a two-contract round trip compiled per-call', () => {
  it('is refused at the front door: the caller\'s two entries make different numbers of external calls', () => {
    const outcome = compilePerCall(ROUND_TRIP);

    // No master is emitted, so nothing can be deployed, composed or evaluated for this shape.
    expect(outcome.artifacts).toBeUndefined();
    expect(outcome.refusal?.code).toBe('PER_CALL_CODEGEN_UNAVAILABLE');
    expect(outcome.refusal?.message).toBe(
      'solidc [PER_CALL_CODEGEN_UNAVAILABLE]: the per-call composition convention does not support this contract: '
      + 'the entries make different numbers of external calls, but a master has one head that fixes how many call '
      + 'records the tail holds',
    );
    expect(outcome.refusal?.context).toStrictEqual({
      requested: 'per-call',
      reason: 'the entries make different numbers of external calls, but a master has one head that fixes how many '
        + 'call records the tail holds',
      contract: 'A',
    });
  });

  it('is admitted again when the caller\'s two entries are given one external call each', () => {
    // The control mutates only the property the refusal names, and the shipped compiler then emits both masters.
    const outcome = compilePerCall(EVEN_CALL_COUNTS);
    expect(outcome.refusal).toBeUndefined();
    expect(outcome.artifacts?.A).toBeTruthy();
    expect(outcome.artifacts?.B).toBeTruthy();
  });

  it('is admitted again when the call back is removed', () => {
    const outcome = compilePerCall(ONE_WAY);
    expect(outcome.refusal).toBeUndefined();
    expect(outcome.artifacts?.A).toBeTruthy();
    expect(outcome.artifacts?.B).toBeTruthy();
  });
});
