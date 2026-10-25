import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';

/**
 * A straight-line keccak256 read whose side-car coordinate is negative must fail closed instead of reading
 * `tx.inputs[-1]`.
 *
 * The coordinate comes from the SDK: a caller's absolute side-car slot for an outlined helper, or a block-layout
 * slot. The SDK binds a missing side-car to -1 (the call that would consume the hash cannot run for this spend),
 * and a borrowed slot can also be read from the wrong frame item. Either way a negative coordinate names no
 * side-car. The emitted read then drops the preimage argument and produces a 32-byte placeholder: a reached use
 * projects an address no deployment matches, while an earlier require still reverts with its own message.
 *
 * Asserted on the shipped body bytes rather than by re-deriving the code path: `OP_DUP OP_0 OP_LESSTHAN OP_IF`
 * (`76 00 9f 63`), the consumed frame, a 32-byte zero push, then `OP_ELSE` (`67`) before the side-car read
 * (`OP_INPUTBYTECODE`, `ca`).
 */
const GUARD_OPEN = '76009f63';
const ZERO_DIGEST_PUSH = `20${'00'.repeat(32)}`;

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
  it('outlined helper: negative slot -> drop the frame and push a zero digest', () => {
    const artifact = compileString(OUTLINED_HELPER, OPTIONS);
    const helper = Object.values(artifact.debug.invokeDebug)
      .find((body) => body.name === 'L.h');
    expect(helper).toBeDefined();
    // OP_DROP, OP_DROP, OP_DROP, PUSHBYTES_32(zeros), OP_ELSE
    expect(helper!.bytecode).toContain(`${GUARD_OPEN}757575${ZERO_DIGEST_PUSH}67`);
    // The guarded read is the ELSE arm: the input index is read only when it is non-negative.
    expect(helper!.bytecode.indexOf('ca')).toBeGreaterThan(helper!.bytecode.indexOf(`${GUARD_OPEN}`));
    expect(helper!.bytecode.indexOf('ca')).toBeGreaterThan(helper!.bytecode.indexOf(`${ZERO_DIGEST_PUSH}67`));
  });

  it('entry body: the same guard wraps a straight-line read (peephole drops may fold)', () => {
    const artifact = compileString(STRAIGHT_LINE, OPTIONS);
    const bodies = Object.values(artifact.functionBodies).map((body) => String(body));
    const guarded = bodies.filter((body) => body.includes(GUARD_OPEN)
      && /76009f63(?:75|6d75)+20/.test(body));
    expect(guarded.length).toBeGreaterThan(0);
    // The placeholder is followed by ELSE and then the only side-car read in this function.
    const body = guarded[0]!;
    const guardAt = body.indexOf(GUARD_OPEN);
    expect(body.slice(guardAt)).toMatch(new RegExp(`^76009f63(?:75|6d75)+20${'00'.repeat(32)}67`));
    expect(body.slice(guardAt)).toContain('ca');
  });
});
