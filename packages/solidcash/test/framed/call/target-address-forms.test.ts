import { describe, expect, it } from 'vitest';
import { bytesToHex } from '@solidcash/utils';
import { framedValidator } from 'solidc';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { makeCallResolver, resolveCallTarget } from '../../../src/framed/proxy/call-resolution.js';
import { planHopExternalCalls, routingOf } from '../../../src/framed/proxy/external-calls.js';
import { addressPayloadToLockingBytecode } from '../../../src/utils.js';

/**
 * The forms an address argument arrives in, and the one that names the zero address.
 *
 * An `address` in the language is a locking bytecode, while a caller reaching this hop through the compatibility
 * layer carries the 20-byte identity an EVM ABI uses, as bytes or as a `0x` string. Both name the same address as
 * the lock of that hash, so a target computed from one has to be read through that identity rather than taken as a
 * byte string, and a caller that names the zero address in either form names it once.
 *
 * A site the source names as the zero address has no deployment to place a callee on, which the hop answers by
 * stating no record for the site and letting the entry's own body decide. The cases below take the target from the
 * shipped resolver and drive the site through the shipped planner, so the zero address is recognized by the code
 * the hop runs rather than by a reimplementation here.
 */

const VALIDATOR_PROGRAM = framedValidator.buildValidatorProgram();

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ISink { function ping(); }'
  + ' contract Sink { int public hits; function ping() { this.hits = this.hits + 1; require(true); } }'
  + ' contract Caller { function go(address target) { ISink(target).ping(); require(true); } }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const caller = artifacts.Caller!;
const sink = artifacts.Sink!;

const SINK_CATEGORY = 'b7'.repeat(31) + '48';

/** The zero address as the compatibility layer states it: the EVM payload, in each form it can take. */
const ZERO_PAYLOAD = new Uint8Array(20);
const ZERO_STRING = `0x${'00'.repeat(20)}`;
/** The locking bytecode the payload names, which is the other form the same address arrives in. */
const ZERO_LOCK = addressPayloadToLockingBytecode(ZERO_PAYLOAD);
/** A payload that is not the zero address, and the lock it names. */
const SOME_PAYLOAD = new Uint8Array(20).fill(0x11);
const SOME_LOCK = addressPayloadToLockingBytecode(SOME_PAYLOAD);
const SOME_STRING = `0x${bytesToHex(SOME_PAYLOAD)}`;

/** The target the shipped resolver states for the one call site, from the caller's own facts. */
function siteTarget(arg: unknown): Uint8Array | undefined {
  const row = routingOf(caller, 'go').find((candidate) => candidate.interfaceName === 'ISink')!;
  const inputs = { artifact: caller, functionName: 'go', args: [arg] };
  return resolveCallTarget(row, inputs as never, makeCallResolver(inputs as never), 0);
}

/** The plan the shipped hop derives for the entry, with the one address argument. */
async function plan(arg: unknown): Promise<Awaited<ReturnType<typeof planHopExternalCalls>>> {
  return planHopExternalCalls({
    provider: new MockNetworkProvider(),
    artifact: caller,
    functionName: 'go',
    args: [arg] as never,
    externals: { ISink: { artifact: sink, categoryId: SINK_CATEGORY } },
    validatorProgram: VALIDATOR_PROGRAM,
  });
}

describe('the target of a call whose address the caller carries', () => {
  it('widens a 20-byte payload to the lock of that hash, so both forms of one address name it', () => {
    expect(bytesToHex(siteTarget(SOME_PAYLOAD)!)).toBe(bytesToHex(SOME_LOCK));
    expect(bytesToHex(siteTarget(SOME_STRING)!)).toBe(bytesToHex(SOME_LOCK));
    expect(bytesToHex(siteTarget(SOME_LOCK)!)).toBe(bytesToHex(SOME_LOCK));
    expect(bytesToHex(SOME_LOCK)).not.toBe(bytesToHex(SOME_PAYLOAD));
  });

  it('reads the zero address as no target, whichever of its forms the caller states', () => {
    expect(siteTarget(ZERO_PAYLOAD)).toBeUndefined();
    expect(siteTarget(ZERO_LOCK)).toBeUndefined();
    expect(siteTarget(ZERO_STRING)).toBeUndefined();
  });

  it('plans no callee for the site, so the entry\'s own body decides', async () => {
    for (const form of [ZERO_PAYLOAD, ZERO_LOCK, ZERO_STRING]) {
      const derived = await plan(form);
      expect(derived.callees.map((frame) => frame.functionName)).not.toContain('Sink.ping()');
      expect(derived.calls).toHaveLength(0);
    }
  });
});
