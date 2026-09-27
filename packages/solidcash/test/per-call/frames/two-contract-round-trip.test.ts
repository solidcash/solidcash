import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { hexOf, seededAddress } from '../shapes/harness.js';

/**
 * A two-contract round trip, compiled per-call. The spec's worked example, "Example: `A -> B -> B -> A`", enters
 * `A.f` which calls `B.g`, which calls `B.h` inline, which calls back into `A.k`: `A` is entered twice, so its two
 * entries make different numbers of external calls.
 *
 * One head serves every body a master dispatches, so the compiler used to refuse this shape outright. The head now
 * walks the call section with the length the block declares and leaves that length for the body, which pins it to
 * the number of calls its own source makes, so the shape compiles and deploys. What is asserted here is that front
 * door and the two controls that mutate only the property that used to close it; the composition itself is what the
 * two controls do not exercise, and it is recorded as the next wall in the plan's log rather than claimed here.
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
  + '   function f(uint256 x) returns (uint256) {'
  + '     count = count + 1;'
  + `     uint256 r = IB(0x${hexOf(B_ADDRESS)}).g(x);`
  + '     last = r;'
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
  + '     uint256 y = h(x);'
  + '     return y + total;'
  + '   }'
  + '   function h(uint256 x) internal returns (uint256) {'
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
  it('is emitted for the caller whose two entries make different numbers of external calls', () => {
    const outcome = compilePerCall(ROUND_TRIP);

    // `A` is entered twice: `f` calls out, `k` only writes state. One master serves both because the walk reads
    // the call count the block declares and each body pins it to its own.
    expect(outcome.refusal).toBeUndefined();
    expect(outcome.artifacts?.A?.composition?.convention).toBe('per-call');
    expect(outcome.artifacts?.B?.composition?.convention).toBe('per-call');
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
