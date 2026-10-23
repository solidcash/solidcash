import { describe, expect, it } from 'vitest';
import {
  computeFunctionSelector, computeFunctionSignature, type ArtifactMap, type PublishedCallSite,
} from '@solidcash/utils';
import { compileString, compileStringMulti } from '../../../src/compiler.js';
import { publishedRefusals } from './refused-entry.js';

/**
 * The token-call shapes OpenZeppelin's SafeERC20 uses, compiled framed.
 *
 * SafeERC20 writes its token calls as call data built by `abi.encodeCall` (5.x) or `abi.encodeWithSelector` (the
 * vendored 4.9.3) and then invokes them through `address(token).call(data)`. The convention's intent is that such a
 * call compiles as a typed call of the named function, so the call's argument digest and its result stay canonical.
 *
 * What the shipped compiler does today: a payload that names its method statically compiles as that typed call,
 * whether the payload is written at the call site or held in a local, whether or not the result is bound, and
 * whether the method is named through the interface (`abi.encodeCall(IERC20.f, ..)`) or through an interface-typed
 * variable (`abi.encodeCall(token.f, ..)`). A payload the compiler cannot name - a raw selector literal, a selector
 * it only holds at run time, or a payload passed into a helper as opaque `bytes` - leaves the call on the direct
 * path's opaque-return machinery, which a framed body does not emit, so that body is refused by name. The
 * `code.length` gate the helper uses beside the call is served.
 *
 * Each case drives a real source through the shipped compile entry point and reads the refusal the compile
 * publishes; the code-length case reads the entry it serves.
 */

/** The reason a result-binding `abi.encode*` low-level call refuses its body. */
const OPAQUE_RETURN_REFUSAL = "the call to '__raw__' takes the direct path's return-event or value-transfer "
  + 'machinery, which a framed body does not emit';

/**
 * The P2SH test the framed `.code` extractor emits, with `17` and `23` the P2SH20 and P2SH32 lengths.
 *
 * The framed gate takes this extractor, not the boolean "is a contract" fold the message-bus graph path uses: a
 * target that is no P2SH lock, a plain account or the zero address, answers empty code, as the EVM answers an
 * account without code, and a P2SH contract target answers its script.
 */
const CODE_EXTRACT_TEST = 'OP_SIZE OP_DUP 17 OP_NUMEQUAL OP_SWAP 23 OP_NUMEQUAL OP_BOOLOR OP_NOTIF OP_DROP OP_0 OP_ELSE';

/** A caller whose token call data is built by `abi.encodeCall` and invoked through `address(token).call`. */
const ENCODE_CALL_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IToken { function transfer(address to, int amount); }'
  + ' contract Caller {'
  + '   function callIt(address token, address to, int amount) {'
  + '     bytes data = abi.encodeCall(IToken.transfer, (to, amount));'
  + '     (bool ok, bytes ret) = address(token).call(data);'
  + '     require(ok);'
  + '   }'
  + ' }';

/** The same call data built by a raw selector, as the vendored 4.9.3 helper spells it. */
const ENCODE_SELECTOR_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Caller {'
  + '   function callIt(address token, address to, int amount) {'
  + '     bytes data = abi.encodeWithSelector(hex"a9059cbb", to, amount);'
  + '     (bool ok, bytes ret) = address(token).call(data);'
  + '     require(ok);'
  + '   }'
  + ' }';

/** The same call with no result bound, which the compiler keeps as a bare low-level call. */
const BARE_CALL_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IToken { function transfer(address to, int amount); }'
  + ' contract Caller {'
  + '   function callIt(address token, address to, int amount) {'
  + '     bytes data = abi.encodeCall(IToken.transfer, (to, amount));'
  + '     address(token).call(data);'
  + '     require(true);'
  + '   }'
  + ' }';

/** The `address.code.length` gate `Address.functionCall` uses to tell a contract from a plain account. */
const CODE_LENGTH_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Caller { function check(address token) { require(token.code.length > 0); } }';

/** The typed call the same argument values would make, which the convention serves. */
const TYPED_CALL_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IToken { function transfer(address to, int amount); }'
  + ' contract Caller {'
  + '   function callIt(IToken token, address to, int amount) { token.transfer(to, amount); require(true); }'
  + ' }';

/** The same `abi.encodeCall` payload, but its method named through the `IToken`-typed variable `token`. */
const VARIABLE_RECEIVER_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IToken { function transfer(address to, int amount); }'
  + ' contract Caller {'
  + '   function callIt(IToken token, address to, int amount) {'
  + '     bytes data = abi.encodeCall(token.transfer, (to, amount));'
  + '     (bool ok, bytes ret) = address(token).call(data);'
  + '     require(ok);'
  + '     require(true);'
  + '   }'
  + ' }';

/** The same payload passed through a value-returning helper's `bytes` parameter, as `Address.functionCall` does. */
const HELPER_PARAMETER_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IToken { function transfer(address to, int amount) returns (bool); }'
  + ' library Addr { function functionCall(address target, bytes data) internal returns (bytes) {'
  + '   (bool success, bytes returndata) = target.call(data); require(success); return returndata; } }'
  + ' contract Caller {'
  + '   using Addr for address;'
  + '   function callIt(IToken token, address to, int amount) {'
  + '     bytes data = abi.encodeCall(token.transfer, (to, amount));'
  + '     address(token).functionCall(data);'
  + '     require(true);'
  + '   }'
  + ' }';

const compile = (source: string): ArtifactMap => compileStringMulti(source, { composition: 'framed' });

/** The refusal a source's compile publishes, as `entry: reason`, or '' when every body is served. */
const refusalMessage = (source: string): string =>
  publishedRefusals(compile(source)).map((refused) => `${refused.functionName}: ${refused.reason}`).join(' | ');

/** The selector `IToken.transfer(address,int)` compiles to, which a served call site names. */
const TRANSFER_SELECTOR =
  Buffer.from(computeFunctionSelector(computeFunctionSignature('transfer', ['address', 'int256']))).toString('hex');

/** The call sites one entry publishes, or a failure naming the entries the artifact does carry. */
function publishedCallSites(artifacts: ArtifactMap, functionName: string): readonly PublishedCallSite[] {
  const composition = artifacts.Caller!.composition!;
  const entry = composition.stopSites?.entries.find((item) => item.functionName === functionName);
  if (entry === undefined) {
    throw new Error(`the artifact publishes no entry "${functionName}"; it carries `
      + `${(composition.stopSites?.entries ?? []).map((item) => item.functionName).join(', ') || 'none'}`);
  }
  return entry.calls;
}

describe('SafeERC20 token-call shapes under framed', () => {
  it('compiles a body whose abi.encodeCall payload is invoked through address(token).call, as the typed call', () => {
    // The payload names the method statically, so the body compiles as `IToken(token).transfer(to, amount)` and
    // publishes that call site rather than being refused for the call data's own shape.
    const artifacts = compile(ENCODE_CALL_SOURCE);
    expect(publishedRefusals(artifacts)).toEqual([]);
    expect(publishedCallSites(artifacts, 'Caller.callIt()')).toEqual([
      expect.objectContaining({
        interfaceName: 'IToken', functionName: 'transfer', selector: TRANSFER_SELECTOR,
      }),
    ]);
  });

  it('refuses the same body when the payload carries a raw selector instead of a named function', () => {
    expect(refusalMessage(ENCODE_SELECTOR_SOURCE)).toBe(`Caller.callIt(): ${OPAQUE_RETURN_REFUSAL}`);
  });

  it('compiles a bare low-level call with no result bound, as the typed call', () => {
    const artifacts = compile(BARE_CALL_SOURCE);
    expect(publishedRefusals(artifacts)).toEqual([]);
    expect(publishedCallSites(artifacts, 'Caller.callIt()')).toEqual([
      expect.objectContaining({
        interfaceName: 'IToken', functionName: 'transfer', selector: TRANSFER_SELECTOR,
      }),
    ]);
  });

  it('serves the address.code.length gate the helper uses beside the call', () => {
    const artifacts = compile(CODE_LENGTH_SOURCE);
    expect(publishedRefusals(artifacts)).toEqual([]);
    const composition = artifacts.Caller!.composition!;
    const entry = composition.stopSites?.entries.find((item) => item.functionName === 'Caller.check()');
    expect(entry).toBeDefined();
    // No call is admitted or published: the gate is a plain predicate over the target's own script length.
    expect(entry!.calls).toEqual([]);
    expect(entry!.sites.sites.length).toBeGreaterThan(0);
  });

  it('compiles the gate through the .code extractor that answers empty code for a target with none', () => {
    const artifact = compileString(CODE_LENGTH_SOURCE, { composition: 'framed' });
    expect(artifact.bytecode).toContain(CODE_EXTRACT_TEST);
  });

  it('serves the typed call the same argument values would make', () => {
    const artifacts = compile(TYPED_CALL_SOURCE);
    expect(publishedRefusals(artifacts)).toEqual([]);
    expect(publishedCallSites(artifacts, 'Caller.callIt()')).toEqual([
      expect.objectContaining({
        interfaceName: 'IToken', functionName: 'transfer', selector: TRANSFER_SELECTOR,
      }),
    ]);
  });

  it('compiles a payload whose method is named through an interface-typed variable, as the typed call', () => {
    // `abi.encodeCall(token.transfer, ..)` names the method through `token`'s declared `IToken` type, so it
    // denotes the same call as the literal `IToken.transfer` spelling and publishes the same call site.
    const artifacts = compile(VARIABLE_RECEIVER_SOURCE);
    expect(publishedRefusals(artifacts)).toEqual([]);
    expect(publishedCallSites(artifacts, 'Caller.callIt()')).toEqual([
      expect.objectContaining({
        interfaceName: 'IToken', functionName: 'transfer', selector: TRANSFER_SELECTOR,
      }),
    ]);
  });

  it('refuses a payload passed through a value-returning helper parameter, naming the machinery it lacks', () => {
    // The payload is built at the caller and handed to `Addr.functionCall` as a `bytes` parameter, so the callee's
    // method is not known where the convention rewrites named payloads; the call keeps the direct path's opaque
    // return machinery, which a framed body does not emit.
    expect(refusalMessage(HELPER_PARAMETER_SOURCE)).toBe(`Caller.callIt(): ${OPAQUE_RETURN_REFUSAL}`);
  });
});
