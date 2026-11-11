import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';

/**
 * A straight-line keccak256 read whose side-car coordinate is negative must fail closed instead of reading
 * `tx.inputs[-1]`.
 *
 * The coordinate comes from the SDK: a caller's absolute side-car slot for an outlined helper, or a block-layout
 * slot. The SDK binds a missing side-car to -1 (the call that would consume the hash cannot run for this spend),
 * and a borrowed slot can also be read from the wrong frame item. Either way a negative coordinate names no
 * side-car. The emitted read then takes the preimage's SHA256: a reached use projects an address no deployment
 * matches, two different preimages never share a digest, and an earlier require still reverts with its own message.
 *
 * Asserted on the shipped body bytes rather than by re-deriving the code path: `OP_DUP OP_0 OP_LESSTHAN OP_IF`
 * (`76 00 9f 63`), the consumed frame, `OP_SHA256` (`a8`), then `OP_ELSE` (`67`) before the side-car read
 * (`OP_INPUTBYTECODE`, `ca`).
 */
const GUARD_OPEN = '76009f63';
const GUARD_ARM = /76009f63(?:75|6d)+a867/;

/** A user library function called from two entries, so the compiler ships it as an outlined OP_INVOKE body. */
const OUTLINED_HELPER = `library L {
  function h(bytes32 a, bytes32 b) internal pure returns (bytes32) { return keccak256(abi.encodePacked(a, b)); }
}
contract C {
  bytes32 public x;
  function f(bytes32 a, bytes32 b) external { x = L.h(a, b); }
  function g(bytes32 a, bytes32 b) external { x = L.h(b, a); }
}`;

const STRAIGHT_LINE = `contract C {
  bytes32 public x;
  function f(address a, address b) external { x = keccak256(abi.encodePacked(a, b)); }
}`;

const OPTIONS = { evmCompat: true, forceStateful: true, composition: 'direct' as const };

describe('a keccak256 side-car read with a negative coordinate fails closed', () => {
  it('outlined helper: negative slot -> drop the frame and hash the preimage', () => {
    const artifact = compileString(OUTLINED_HELPER, OPTIONS);
    const helper = Object.values(artifact.debug.invokeDebug)
      .find((body) => body.name === 'L.h');
    expect(helper).toBeDefined();
    // OP_DROP, OP_DROP, OP_SHA256, OP_ELSE
    const arm = GUARD_ARM.exec(helper!.bytecode);
    expect(arm).not.toBeNull();
    // The guarded read is the ELSE arm: the input index is read only when it is non-negative.
    expect(helper!.bytecode.slice(arm!.index + arm![0].length)).toContain('ca');
  });

  it('entry body: the same guard wraps a straight-line read (peephole drops may fold)', () => {
    const artifact = compileString(STRAIGHT_LINE, OPTIONS);
    const bodies = Object.values(artifact.functionBodies).map((body) => String(body));
    const guarded = bodies.filter((body) => GUARD_ARM.test(body));
    expect(guarded.length).toBeGreaterThan(0);
    // The digest is followed by ELSE and then the only side-car read in this function.
    const body = guarded[0]!;
    expect(body.slice(body.indexOf(GUARD_OPEN))).toContain('ca');
  });
});
