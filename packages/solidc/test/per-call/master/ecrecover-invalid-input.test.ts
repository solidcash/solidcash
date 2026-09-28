import { describe, expect, it } from 'vitest';
import { compileString, compileStringMulti } from '../../../src/compiler.js';
import { publishedRefusals } from './refused-entry.js';

/**
 * `ecrecover` and the EVM's invalid-input rule, on the per-call path.
 *
 * The EVM's `ecrecover(hash, v, r, s)` returns `address(0)` for every invalid input - an empty or malformed
 * signature, an out-of-range `s`, a `v` that is not 27/28 - and only aborts on a genuine execution failure. A
 * source that ports `require(ecrecover(...) == expected)` therefore relies on the zero result to make the require
 * evaluate false rather than halt the script.
 *
 * On the shipped per-call compiler the recovery value comes from a co-spent side-car pair, and the master head
 * does not locate co-spent side-car inputs. So every body that makes an `ecrecover` call is refused by name,
 * whatever its arguments: a valid recovery, an empty signature, `v = 0`, `v = 1`, an out-of-range `s`, the
 * all-zero digest, and both projections are refused with the same reason. The per-call path serves no recovery at
 * all, so the invalid-input rule is not reachable there; the cases below pin that refusal.
 *
 * The control compiles the same valid source on the direct convention, where the call is served and marked as
 * recovery compute - so what is refused is the per-call convention's side-car limitation, not the builtin.
 */

/** The reason every ecrecover body is refused by the per-call master. */
const RECOVERY_REFUSAL = 'a compute side-car needs co-spent inputs the master head does not locate';

/** A standard compressed pubkey the recovery result is compared against. */
const SIGNER = '0x021111111111111111111111111111111111111111111111111111111111111111';

/** A P2PKH locking bytecode the projections are compared against. */
const SIGNER_P2PKH = '0x76a914' + '11'.repeat(20) + '88ac';

/** A valid recovery used normally: the recovered key is compared with the signer. */
const VALID_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Auth {'
  + '   function check(bytes32 h, int v, bytes32 r, bytes32 s) {'
  + `     require(ecrecoverPubKey(h, v, r, s) == pubkey(${SIGNER}));`
  + '   }'
  + ' }';

/**
 * An empty or short signature. The native builtin takes four scalars, so this is the shape a port writes: the
 * signature arrives as `bytes`, its length is the caller's check, and `r`/`s`/`v` are sliced out and handed to the
 * builtin. Whether the blob is empty, short or well-formed is a run-time fact of the argument.
 */
const SHORT_SIGNATURE_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Verifier {'
  + '   function verify(bytes32 hash, bytes signature) {'
  + '     bytes32 r = bytes32(signature.slice(0, 32));'
  + '     bytes32 s = bytes32(signature.slice(32, 64));'
  + '     int v = int(signature.slice(64, 65));'
  + `     require(ecrecoverPubKey(hash, v, r, s) == pubkey(${SIGNER}));`
  + '   }'
  + ' }';

/** The pre-EIP-155 recovery ids `0` and `1`, which the EVM's `ecrecover` rejects (it accepts only 27/28). */
const V_ZERO_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Auth {'
  + '   function check(bytes32 h, bytes32 r, bytes32 s) {'
  + `     require(ecrecoverPubKey(h, 0, r, s) == pubkey(${SIGNER}));`
  + '   }'
  + ' }';

const V_ONE_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Auth {'
  + '   function check(bytes32 h, bytes32 r, bytes32 s) {'
  + `     require(ecrecoverPubKey(h, 1, r, s) == pubkey(${SIGNER}));`
  + '   }'
  + ' }';

/** An out-of-range `s` (the field maximum, far above the curve order), which the EVM rejects. */
const S_OUT_OF_RANGE_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Auth {'
  + '   function check(bytes32 h, int v, bytes32 r) {'
  + '     require(ecrecoverPubKey(h, v, r,'
  + '       bytes32(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff))'
  + `       == pubkey(${SIGNER}));`
  + '   }'
  + ' }';

/** An all-zero digest and zero signature words, the closest four-scalar spelling of "no signature". */
const ALL_ZERO_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Auth {'
  + '   function check() {'
  + `     require(ecrecoverPubKey(bytes32(0), 0, bytes32(0), bytes32(0)) == pubkey(${SIGNER}));`
  + '   }'
  + ' }';

/** The EVM-address projection: `ecrecoverEvm(hash, v, r, s)` returns a 20-byte address. */
const EVM_PROJECTION_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Auth {'
  + '   function check(bytes32 h, int v, bytes32 r, bytes32 s) {'
  + `     require(ecrecoverEvm(h, v, r, s) == bytes20(${'0x' + '11'.repeat(20)}));`
  + '   }'
  + ' }';

/** The bare Solidity name, which the `ecrecover` option maps to the P2PKH projection. */
const BARE_NAME_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Auth {'
  + '   function check(bytes32 h, int v, bytes32 r, bytes32 s) {'
  + `     require(ecrecover(h, v, r, s) == address(${SIGNER_P2PKH}));`
  + '   }'
  + ' }';

type Artifacts = Record<string, { composition?: unknown }>;

const compilePerCall = (source: string, options: Record<string, unknown> = {}): Artifacts =>
  compileStringMulti(source, { composition: 'per-call', ...options } as never) as Artifacts;

/** The refusal a per-call compile publishes, as `entry: reason`, or '' when every body is served. */
const refusalMessage = (source: string, options: Record<string, unknown> = {}): string =>
  publishedRefusals(compilePerCall(source, options))
    .map((refused) => `${refused.functionName}: ${refused.reason}`).join(' | ');

const CASES = [
  { name: 'a valid recovery used normally', source: VALID_SOURCE, entry: 'Auth.check()', options: {} },
  { name: 'an empty or short signature', source: SHORT_SIGNATURE_SOURCE, entry: 'Verifier.verify()', options: {} },
  { name: 'a recovery id of 0', source: V_ZERO_SOURCE, entry: 'Auth.check()', options: {} },
  { name: 'a recovery id of 1', source: V_ONE_SOURCE, entry: 'Auth.check()', options: {} },
  { name: 'an out-of-range s', source: S_OUT_OF_RANGE_SOURCE, entry: 'Auth.check()', options: {} },
  { name: 'an all-zero digest and signature', source: ALL_ZERO_SOURCE, entry: 'Auth.check()', options: {} },
  { name: 'the EVM-address projection', source: EVM_PROJECTION_SOURCE, entry: 'Auth.check()', options: {} },
  { name: 'the bare name in P2PKH mode', source: BARE_NAME_SOURCE, entry: 'Auth.check()',
    options: { ecrecover: 'p2pkh' } },
] as const;

describe('ecrecover on the per-call path refuses every input shape', () => {
  for (const { name, source, entry, options } of CASES) {
    it(`refuses the body for ${name}`, () => {
      expect(refusalMessage(source, options)).toBe(`${entry}: ${RECOVERY_REFUSAL}`);
    });
  }
});

describe('the direct convention serves the recovery the per-call path refuses', () => {
  it('compiles a valid recovery and marks it as recovery compute', () => {
    const artifact = compileString(VALID_SOURCE);
    const fn = (artifact.abi as { name: string; ecrecoverCompute?: boolean; ecrecoverArgParams?: unknown }[])
      .find((entry) => entry.name === 'check');
    expect(fn?.ecrecoverCompute).toBe(true);
    expect(fn?.ecrecoverArgParams).toEqual([['h', 'v', 'r', 's']]);
  });

  it('compiles the bare name once the ecrecover option selects the projection', () => {
    const artifact = compileString(BARE_NAME_SOURCE, { ecrecover: 'p2pkh' });
    const fn = (artifact.abi as { name: string; ecrecoverCompute?: boolean }[])
      .find((entry) => entry.name === 'check');
    expect(fn?.ecrecoverCompute).toBe(true);
  });
});

describe('the refusal is a property of the body that makes the call', () => {
  it('serves the sibling body and refuses only the recovery body by name', () => {
    const source = 'pragma solidcash ^0.13.0;'
      + ' contract Mixed {'
      + '   function good() { require(true); }'
      + '   function bad(bytes32 h, int v, bytes32 r, bytes32 s) {'
      + `     require(ecrecoverPubKey(h, v, r, s) == pubkey(${SIGNER}));`
      + '   }'
      + ' }';
    const refusals = publishedRefusals(compilePerCall(source));
    expect(refusals.map((refused) => refused.functionName)).toStrictEqual(['Mixed.bad()']);
    expect(refusals[0]!.reason).toBe(RECOVERY_REFUSAL);
  });
});
