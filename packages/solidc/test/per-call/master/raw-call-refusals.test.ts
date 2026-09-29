import { describe, expect, it } from 'vitest';
import { refusalMessageOf } from './refused-entry.js';

/**
 * The two call shapes the per-call convention still refuses beside a call it serves.
 *
 * A low-level call the compiler cannot name as the typed call it denotes keeps the direct path's return-event
 * machinery, which a per-call body does not emit. Two spellings stay on that machinery after the lowering that
 * rewrites a namable payload to its typed call: a payload that names a method but reaches the call across a helper
 * that RETURNS (so the payload local the lowering follows does not exist yet where it runs), and a payload that
 * names no method at all (a raw selector the compiler cannot resolve to an interface).
 *
 * The second shape is a verified-mapping write beside a call whose occurrence the source does not fix. A verified
 * mapping's write declares its records in the segment the write lands in, and the derivation locates that segment
 * by the fixed number of calls that precede it; a call that only some paths make moves that segment, which the run
 * time position mode cannot follow.
 *
 * Beside them sits the gate a body that reaches inline assembly trips. It refuses by reachability rather than per
 * body, so the cases fix both ends: an unreached assembly helper is served, and a body that reaches one fails the
 * contract.
 *
 * Each case drives a real source through the shipped compile entry point and reads the refusal the compile
 * publishes beside the artifact; the served bodies beside them fix where each refusal begins.
 */

/** The reason a body that keeps the direct path's opaque-return machinery is refused. */
const RAW_REFUSAL = "the call to '__raw__' takes the direct path's return-event or value-transfer machinery, "
  + 'which a per-call body does not emit';

/** The reason a verified-mapping write behind a call the source does not fix is refused. */
const WRITE_BEHIND_CALL_REFUSAL = 'the body writes a verified mapping behind a call whose occurrence the source '
  + 'does not fix, and the derived operands cannot follow the segment the write lands in';

const HEAD = 'pragma solidcash ^0.13.0;'
  + ' interface IToken { function transfer(address to, int amount) returns (bool); }';

/** The payload names the method, but the call sits in a helper that RETURNS, so the lowering cannot reach it. */
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

/** The same payload handed to a VOID helper, which the lowering inlines into the caller and then resolves. */
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

/** The per-call convention composes no inline assembly, so a body that reaches any is refused contract-wide. */
const INLINE_ASSEMBLY_REFUSAL = 'the per-call composition convention does not support this contract: '
  + 'inline assembly is not composed per-call';

/** A body that calls a helper whose own body holds inline assembly. */
const ASSEMBLY_IN_REACHED_HELPER = 'pragma solidcash ^0.13.0;'
  + ' library Lifted { function lift() internal { assembly { OP_DUP OP_ADD 0x01 } } }'
  + ' contract Caller { function callIt() { Lifted.lift(); require(true); } }';

/** The same helper, which no body calls: the reachability the gate reads is what refuses, not the helper alone. */
const ASSEMBLY_IN_UNREACHED_HELPER = 'pragma solidcash ^0.13.0;'
  + ' library Lifted { function lift() internal { assembly { OP_DUP OP_ADD 0x01 } } }'
  + ' contract Caller { function callIt() { require(true); } }';

describe('a low-level call whose payload names a method the compiler can hold', () => {
  it('serves the payload when the helper that makes the call is inlined', () => {
    expect(refusalMessageOf(PAYLOAD_ACROSS_VOID_HELPER)).toBe('');
  });

  it('refuses the payload when the helper returns, naming the machinery the body lacks', () => {
    // The payload local the lowering follows is created only when the returning helper is inlined, which happens
    // after the lowering runs, so the call stays on the direct path's opaque-return machinery.
    expect(refusalMessageOf(PAYLOAD_ACROSS_RETURNING_HELPER)).toBe(`Caller.callIt(): ${RAW_REFUSAL}`);
  });
});

describe('a low-level call whose payload names no method', () => {
  it('refuses the body, keeping the direct path\'s opaque-return machinery', () => {
    expect(refusalMessageOf(OPAQUE_SELECTOR_PAYLOAD)).toBe(`Caller.callIt(): ${RAW_REFUSAL}`);
  });
});

describe('a body that reaches inline assembly', () => {
  it('serves the contract when no body reaches the assembly helper', () => {
    expect(refusalMessageOf(ASSEMBLY_IN_UNREACHED_HELPER)).toBe('');
  });

  it('refuses the whole contract when a body reaches it', () => {
    // The gate refuses by reachability, before any per-body refusal: a body that reaches inline assembly fails
    // the contract rather than only itself.
    expect(() => refusalMessageOf(ASSEMBLY_IN_REACHED_HELPER)).toThrow(INLINE_ASSEMBLY_REFUSAL);
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
