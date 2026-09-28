import { describe, expect, it } from 'vitest';
import { computeFunctionSelector, computeFunctionSignature } from '@solidcash/utils';
import { compileString, compileStringMulti } from '../../../src/compiler.js';
import { publishedRefusals } from './refused-entry.js';

/**
 * The token-call shapes OpenZeppelin's SafeERC20 uses, compiled per-call.
 *
 * SafeERC20 writes its token calls as call data built by `abi.encodeCall` (5.x) or `abi.encodeWithSelector` (the
 * vendored 4.9.3) and then invokes them through `address(token).call(data)`. The convention's intent is that such a
 * call compiles as a typed call of the named function, so the call's argument digest and its result stay canonical.
 *
 * What the shipped compiler does today: the body that carries the call is refused by name, not the contract, and
 * the reason differs by whether the call's result is bound. A body that binds `(bool ok, bytes ret)` keeps the call
 * on the direct path's opaque-return machinery, which a per-call body does not emit; a body that drops the result
 * keeps it as a bare low-level call. Neither is admitted, so the argument digest is never published. The
 * `code.length` gate the helper uses beside the call is served, and so is the equivalent typed call.
 *
 * Each case drives a real source through the shipped compile entry point and reads the refusal the compile
 * publishes; the code-length case reads the entry it serves.
 */

/** The reason a result-binding `abi.encode*` low-level call refuses its body. */
const OPAQUE_RETURN_REFUSAL = "the call to '__raw__' takes the direct path's return-event or value-transfer "
  + 'machinery, which a per-call body does not emit';

/** The reason a bare low-level call refuses its body. */
const BARE_LOW_LEVEL_REFUSAL = 'a low-level call needs the witness `calls[]` checks, which are not emitted yet';

/**
 * The P2SH validation the general `.code` extractor emits, with `17` and `23` the P2SH20 and P2SH32 lengths.
 *
 * The per-call gate takes this extractor, not the boolean "is a contract" fold the message-bus graph path uses, so
 * it accepts only P2SH locking bytecode and fails the script for anything else. A plain account or zero-address
 * target therefore does not answer 0; a P2SH contract target does answer non-zero.
 */
const CODE_EXTRACT_VERIFY = 'OP_SIZE OP_NIP OP_DUP 17 OP_EQUAL OP_OVER 23 OP_EQUAL OP_BOOLOR OP_VERIFY';

/** A caller whose token call data is built by `abi.encodeCall` and invoked through `address(token).call`. */
const ENCODE_CALL_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface IToken { function transfer(address to, int amount); }'
  + ' contract Caller {'
  + '   function callIt(address token, address to, int amount) {'
  + '     bytes data = abi.encodeCall(IToken.transfer, (to, amount));'
  + '     (bool ok, bytes ret) = address(token).call(data);'
  + '     require(ok);'
  + '   }'
  + ' }';

/** The same call data built by a raw selector, as the vendored 4.9.3 helper spells it. */
const ENCODE_SELECTOR_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Caller {'
  + '   function callIt(address token, address to, int amount) {'
  + '     bytes data = abi.encodeWithSelector(hex"a9059cbb", to, amount);'
  + '     (bool ok, bytes ret) = address(token).call(data);'
  + '     require(ok);'
  + '   }'
  + ' }';

/** The same call with no result bound, which the compiler keeps as a bare low-level call. */
const BARE_CALL_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface IToken { function transfer(address to, int amount); }'
  + ' contract Caller {'
  + '   function callIt(address token, address to, int amount) {'
  + '     bytes data = abi.encodeCall(IToken.transfer, (to, amount));'
  + '     address(token).call(data);'
  + '     require(true);'
  + '   }'
  + ' }';

/** The `address.code.length` gate `Address.functionCall` uses to tell a contract from a plain account. */
const CODE_LENGTH_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Caller { function check(address token) { require(token.code.length > 0); } }';

/** The typed call the same argument values would make, which the convention serves. */
const TYPED_CALL_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface IToken { function transfer(address to, int amount); }'
  + ' contract Caller {'
  + '   function callIt(IToken token, address to, int amount) { token.transfer(to, amount); require(true); }'
  + ' }';

type Artifacts = Record<string, { composition?: unknown }>;

const compile = (source: string): Artifacts => compileStringMulti(source, { composition: 'per-call' }) as Artifacts;

/** The refusal a source's compile publishes, as `entry: reason`, or '' when every body is served. */
const refusalMessage = (source: string): string =>
  publishedRefusals(compile(source)).map((refused) => `${refused.functionName}: ${refused.reason}`).join(' | ');

describe('SafeERC20 token-call shapes under per-call', () => {
  it('refuses a body whose abi.encodeCall payload is invoked through address(token).call', () => {
    expect(refusalMessage(ENCODE_CALL_SOURCE)).toBe(`Caller.callIt(): ${OPAQUE_RETURN_REFUSAL}`);
  });

  it('refuses the same body when the payload carries a raw selector instead of a named function', () => {
    expect(refusalMessage(ENCODE_SELECTOR_SOURCE)).toBe(`Caller.callIt(): ${OPAQUE_RETURN_REFUSAL}`);
  });

  it('refuses a bare low-level call with no result bound', () => {
    expect(refusalMessage(BARE_CALL_SOURCE)).toBe(`Caller.callIt(): ${BARE_LOW_LEVEL_REFUSAL}`);
  });

  it('serves the address.code.length gate the helper uses beside the call', () => {
    const artifacts = compile(CODE_LENGTH_SOURCE);
    expect(publishedRefusals(artifacts)).toEqual([]);
    const composition = artifacts.Caller!.composition as {
      stopSites?: { entries?: { functionName: string; calls: unknown[]; sites: { sites: unknown[] } }[] };
    };
    const entry = composition.stopSites?.entries?.find((item) => item.functionName === 'Caller.check()');
    expect(entry).toBeDefined();
    // No call is admitted or published: the gate is a plain predicate over the target's own script length.
    expect(entry!.calls).toEqual([]);
    expect(entry!.sites.sites.length).toBeGreaterThan(0);
  });

  it('compiles the gate through the P2SH-only .code extractor', () => {
    const artifact = compileString(CODE_LENGTH_SOURCE, { composition: 'per-call' });
    expect(artifact.bytecode).toContain(CODE_EXTRACT_VERIFY);
  });

  it('serves the typed call the same argument values would make', () => {
    const artifacts = compile(TYPED_CALL_SOURCE);
    expect(publishedRefusals(artifacts)).toEqual([]);
    const composition = artifacts.Caller!.composition as {
      stopSites?: { entries?: { functionName: string; calls: { interfaceName: string; functionName: string;
        selector: string }[] }[] };
    };
    const entry = composition.stopSites?.entries?.find((item) => item.functionName === 'Caller.callIt()');
    expect(entry).toBeDefined();
    const selector = computeFunctionSelector(computeFunctionSignature('transfer', ['address', 'int256']));
    expect(entry!.calls).toEqual([
      expect.objectContaining({
        interfaceName: 'IToken',
        functionName: 'transfer',
        selector: Buffer.from(selector).toString('hex'),
      }),
    ]);
  });
});
