import { describe, expect, it } from 'vitest';
import { refusalMessageOf } from './refused-entry.js';

/**
 * The call shapes the per-call convention serves, and the two it still refuses beside them.
 *
 * A low-level call whose payload names an interface method is lowered to the typed call it denotes. The lowering
 * follows the payload as a local, so a payload handed to a helper whose own body makes the call is served once the
 * helper is inlined into the entry before the lowering runs - a helper that RETURNS included, which the inliners do
 * under the per-call convention exactly so the payload is one the lowering can follow.
 *
 * What stays refused: a payload that names no method (a selector literal no held interface declares), and a
 * verified-mapping write beside a call whose occurrence the source does not fix (the write declares its records in
 * the segment it lands in, and the derivation locates that segment by the fixed number of calls before it).
 *
 * Beside them sit the inline-assembly cases. A body that reaches an assembly block the lowering rewrote is served;
 * a body that still reaches a block the lowering left in place - native `assembly { OP_* }` has no Yul tree - is
 * refused by name while the contract's other bodies compile.
 *
 * Each case drives a real source through the shipped compile entry point and reads the refusal the compile
 * publishes beside the artifact; the served bodies beside them fix where each refusal begins.
 */

/** The reason a body that keeps the direct path's opaque-return machinery is refused. */
const RAW_REFUSAL = "the call to '__raw__' takes the direct path's return-event or value-transfer machinery, "
  + 'which a per-call body does not emit';

/** The reason a body that reaches an assembly block the lowering left in place is refused. */
const INLINE_ASSEMBLY_REASON = 'inline assembly is not composed per-call';

/** The reason a verified-mapping write behind a call the source does not fix is refused. */
const WRITE_BEHIND_CALL_REFUSAL = 'the body writes a verified mapping behind a call whose occurrence the source '
  + 'does not fix, and the derived operands cannot follow the segment the write lands in';

const HEAD = 'pragma solidcash ^0.13.0;'
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

/** The payload names no method: the selector is a literal no interface the compiler holds declares. */
const OPAQUE_SELECTOR_PAYLOAD = 'pragma solidcash ^0.13.0;'
  + ' contract Caller { function callIt(address token, address to, int amount) {'
  + '   bytes data = abi.encodeWithSelector(hex"a9059cbb", to, amount);'
  + '   (bool ok, bytes ret) = address(token).call(data);'
  + '   require(ok);'
  + ' } }';

/** A verified-mapping write with a call behind a branch: the write lands in a segment the branch moves. */
const WRITE_BEHIND_BRANCHED_CALL = 'pragma solidcash ^0.13.0;'
  + ' interface IOther { function ping(); }'
  + ' contract Ledger {'
  + '   address other;'
  + '   mapping(address => int) balances;'
  + '   function move(address from, address to, int value, bool flag) {'
  + '     if (flag) { IOther(other).ping(); }'
  + '     balances[from] = balances[from] - value;'
  + '     balances[to] = balances[to] + value;'
  + '     require(true);'
  + '   }'
  + ' }';

/** The same write with a call that repeats, whose count the source does not fix either. */
const WRITE_BEHIND_LOOPED_CALL = 'pragma solidcash ^0.13.0;'
  + ' interface IOther { function ping(); }'
  + ' contract Ledger {'
  + '   address other;'
  + '   mapping(address => int) balances;'
  + '   function move(address from, address to, int value, int turns) {'
  + '     for (int i = 0; i < turns; i = i + 1) { IOther(other).ping(); }'
  + '     balances[from] = balances[from] - value;'
  + '     require(true);'
  + '   }'
  + ' }';

/** The same write with no call beside it, which the derivation serves. */
const WRITE_ALONE = 'pragma solidcash ^0.13.0;'
  + ' contract Ledger {'
  + '   mapping(address => int) balances;'
  + '   function move(address from, address to, int value) {'
  + '     balances[from] = balances[from] - value;'
  + '     balances[to] = balances[to] + value;'
  + '     require(true);'
  + '   }'
  + ' }';

/**
 * A body that holds native assembly beside one that does not.
 *
 * Native opcodes have no Yul tree, so the lowering leaves the block in place and only the body that reaches it is
 * refused; the other entry keeps its program.
 */
const ASSEMBLY_BESIDE_A_COMPILING_BODY = 'pragma solidcash ^0.13.0;'
  + ' contract Mixed {'
  + '   function withAsm() { assembly { OP_DUP OP_ADD 0x01 } require(true); }'
  + '   function plain() { require(true); }'
  + ' }';

/** An entry body whose assembly is memory loads, which the lowering rewrites into ordinary statements. */
const LOWERABLE_ASSEMBLY = 'pragma solidcash ^0.13.0;'
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
const ASSEMBLY_IN_UNREACHED_HELPER = 'pragma solidcash ^0.13.0;'
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

describe('a low-level call whose payload names no method', () => {
  it('refuses the body, keeping the direct path\'s opaque-return machinery', () => {
    expect(refusalMessageOf(OPAQUE_SELECTOR_PAYLOAD)).toBe(`Caller.callIt(): ${RAW_REFUSAL}`);
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

describe('a verified-mapping write beside a call the source does not fix', () => {
  it('serves the write when no call sits beside it', () => {
    expect(refusalMessageOf(WRITE_ALONE)).toBe('');
  });

  it('refuses the write when the call sits behind a branch', () => {
    expect(refusalMessageOf(WRITE_BEHIND_BRANCHED_CALL)).toBe(`Ledger.move(): ${WRITE_BEHIND_CALL_REFUSAL}`);
  });

  it('refuses the write when the call repeats in a loop', () => {
    expect(refusalMessageOf(WRITE_BEHIND_LOOPED_CALL)).toBe(`Ledger.move(): ${WRITE_BEHIND_CALL_REFUSAL}`);
  });
});
