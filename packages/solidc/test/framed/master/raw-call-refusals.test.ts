import { describe, expect, it } from 'vitest';
import { refusalMessageOf } from './refused-entry.js';

/**
 * The call shapes the framed convention serves across a helper, and the inline-assembly boundary.
 *
 * A low-level call whose payload names an interface method is lowered to the typed call it denotes. The lowering
 * follows the payload as a local, so a payload handed to a helper whose own body makes the call is served once the
 * helper is inlined into the entry before the lowering runs - a helper that RETURNS included, which the inliners do
 * under the framed convention exactly so the payload is one the lowering can follow. A payload that names no method
 * is refused in `low-level-token-calls.test.ts`, and a verified-mapping write beside a call the source does not fix
 * in `refused-entry-shapes.test.ts`.
 *
 * A body that reaches an assembly block the lowering rewrote is served; a body that still reaches a block the
 * lowering left in place - native `assembly { OP_* }` has no Yul tree - is refused by name while the contract's
 * other bodies compile.
 *
 * Each case drives a real source through the shipped compile entry point and reads the refusal the compile
 * publishes beside the artifact.
 */

/** The reason a body that reaches an assembly block the lowering left in place is refused. */
const INLINE_ASSEMBLY_REASON = 'inline assembly is not composed framed';

const HEAD = 'pragma solidcash ^0.14.0;'
  + ' interface IToken { function transfer(address to, int amount) returns (bool); }';

/** The payload is a local, handed to a helper that makes the call and RETURNS what it produced. */
const PAYLOAD_ACROSS_RETURNING_HELPER = `${HEAD}`
  + ' library Addr {'
  + '   function forward(address target, bytes data) internal returns (bytes) {'
  + '     (bool ok, bytes ret) = address(target).call(data);'
  + '     require(ok);'
  + '     return ret;'
  + '   }'
  + ' }'
  + ' contract Caller { function callIt(address token, address to, int amount) {'
  + '   bytes data = abi.encodeCall(IToken.transfer, (to, amount));'
  + '   Addr.forward(token, data);'
  + '   require(true);'
  + ' } }';

/** The same payload handed to a VOID helper. */
const PAYLOAD_ACROSS_VOID_HELPER = `${HEAD}`
  + ' library Addr {'
  + '   function forward(address target, bytes data) internal {'
  + '     (bool ok, ) = address(target).call(data);'
  + '     require(ok);'
  + '   }'
  + ' }'
  + ' contract Caller { function callIt(address token, address to, int amount) {'
  + '   bytes data = abi.encodeCall(IToken.transfer, (to, amount));'
  + '   Addr.forward(token, data);'
  + '   require(true);'
  + ' } }';

/**
 * A body that holds native assembly beside one that does not.
 *
 * Native opcodes have no Yul tree, so the lowering leaves the block in place and only the body that reaches it is
 * refused; the other entry keeps its program.
 */
const ASSEMBLY_BESIDE_A_COMPILING_BODY = 'pragma solidcash ^0.14.0;'
  + ' contract Mixed {'
  + '   function withAsm() { assembly { OP_DUP OP_ADD 0x01 } require(true); }'
  + '   function plain() { require(true); }'
  + ' }';

/** An entry body whose assembly is memory loads, which the lowering rewrites into ordinary statements. */
const LOWERABLE_ASSEMBLY = 'pragma solidcash ^0.14.0;'
  + ' contract Reads {'
  + '   function pick(bytes blob) internal returns (int) {'
  + '     int head;'
  + '     assembly { head := mload(add(blob, 0x20)) }'
  + '     require(true);'
  + '     return head;'
  + '   }'
  + '   function read(bytes blob) { require(pick(blob) != 0); }'
  + ' }';

/** A helper's native assembly no body calls. */
const ASSEMBLY_IN_UNREACHED_HELPER = 'pragma solidcash ^0.14.0;'
  + ' library Lifted { function lift() internal { assembly { OP_DUP OP_ADD 0x01 } } }'
  + ' contract Caller { function callIt() { require(true); } }';

describe('a low-level call whose payload names a method the compiler can hold', () => {
  it('serves the payload when the helper that makes the call is inlined', () => {
    expect(refusalMessageOf(PAYLOAD_ACROSS_VOID_HELPER)).toBe('');
  });

  it('serves the payload when the helper returns, since the inliner runs before the lowering', () => {
    // The helper's body is spliced into the entry before the lowering, so the payload is a local the lowering
    // follows and the call compiles as the typed call it denotes rather than staying on the raw-return machinery.
    expect(refusalMessageOf(PAYLOAD_ACROSS_RETURNING_HELPER)).toBe('');
  });
});

describe('a body that reaches inline assembly', () => {
  it('serves a body whose assembly the lowering rewrites', () => {
    expect(refusalMessageOf(LOWERABLE_ASSEMBLY)).toBe('');
  });

  it('refuses only the body whose own assembly the lowering leaves, and compiles the other entry', () => {
    // The refusal is a fact about the body that reaches the block, published beside the artifact, not a refusal of
    // the contract: the sibling entry carries no assembly and keeps its program.
    expect(refusalMessageOf(ASSEMBLY_BESIDE_A_COMPILING_BODY))
      .toBe(`Mixed.withAsm(): ${INLINE_ASSEMBLY_REASON}`);
  });

  it('serves the contract when no body reaches the assembly helper', () => {
    expect(refusalMessageOf(ASSEMBLY_IN_UNREACHED_HELPER)).toBe('');
  });
});
