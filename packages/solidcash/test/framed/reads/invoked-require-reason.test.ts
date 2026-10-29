import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import { deploy } from '../call/value-harness.js';

/**
 * A refusal inside a library function the entry invokes names that function's own `require`.
 *
 * `M.add` and `M.sub` compile to bodies of one shape, each with its `require` at the same place in its own body, so
 * a reason read by the failing pointer alone could be either message. The read names the body that was running.
 */

const MAX = (1n << 256n) - 1n;

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' library M {'
  + '   function add(uint x, uint y) internal pure returns (uint z) {'
  + '     unchecked { z = x + y; } require(z >= x, "m-add-overflow"); }'
  + '   function sub(uint x, uint y) internal pure returns (uint z) {'
  + '     unchecked { z = x - y; } require(z <= x, "m-sub-underflow"); } }'
  + ' contract Calc { using M for uint; uint256 public unit = 1;'
  + '   function plus(uint x, uint y) external pure returns (uint) { return x.add(y); }'
  + '   function minus(uint x, uint y) external pure returns (uint) { return x.sub(y); } }';

const calc = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never).Calc!;

describe('a refusal inside an invoked library function', () => {
  it('names the require of the body that refused, not the one at the same place in another', async () => {
    const deployed = await deploy(calc);
    const read = (functionName: string, args: readonly bigint[]): ReturnType<typeof readFramedEntry> =>
      readFramedEntry({
        provider: deployed.provider, artifact: calc, categoryId: deployed.categoryId, functionName, args,
        vm: compositionMachine(),
      });
    const minus = await read('minus', [0n, 1n]);
    expect(minus.accepted).toBe(false);
    expect(minus.refusal?.innermost?.reason.message).toBe('m-sub-underflow');
    const plus = await read('plus', [MAX, 1n]);
    expect(plus.accepted).toBe(false);
    expect(plus.refusal?.innermost?.reason.message).toBe('m-add-overflow');
  });
});
