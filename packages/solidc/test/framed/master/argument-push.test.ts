import { describe, expect, it } from 'vitest';
import {
  Opcodes, encodeDataPush, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import { bigIntToVmNumber } from '@bitauth/libauth';
import { canonicalPushScript } from '../../../src/framed/master/argument-push.js';
import { compositionMachine } from '../machine.js';

/**
 * The canonical push fragment against libauth's own encoder.
 *
 * The fragment exists so a caller can hash the argument pushes it computed at run time, and the bytes it produces
 * have to be the bytes a deployment writes for the same argument. libauth's `encodeDataPush` is that authority,
 * so the expectation of every case is its answer for the same value, and nothing in the test restates the rule.
 *
 * Each case runs the shipped fragment on the BCH-2026 machine: the value is the unlocking bytecode's push and the
 * redeem script is the fragment followed by an equality against the encoder's answer, so the input succeeds
 * exactly when the two agree.
 */

/** Whether the fragment, applied to `value`, leaves exactly the encoder's push of `canonical`. */
function pushesTo(
  value: Uint8Array,
  numeric: boolean,
  canonical: Uint8Array = value,
): { accepted: boolean; objection?: string } {
  const expected = encodeDataPush(canonical);
  const redeemScript = new Uint8Array([
    ...canonicalPushScript(numeric),
    ...encodeDataPush(expected),
    Opcodes.OP_EQUAL,
  ]);
  const lock = encodeLockingBytecodeP2sh32(hash256(redeemScript));
  const transaction = {
    version: 2,
    inputs: [{
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32),
      sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array([...encodeDataPush(value), ...encodeDataPush(redeemScript)]),
    }],
    outputs: [{ lockingBytecode: lock, valueSatoshis: 10_000n }],
    locktime: 0,
  };
  const sourceOutputs = [{ lockingBytecode: lock, valueSatoshis: 10_000n }];
  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex: 0, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

/** The raw values a push form is chosen for: every boundary of the encoding. */
const RAW_VALUES: readonly Uint8Array[] = [
  new Uint8Array([]),
  Uint8Array.from([0x01]),
  Uint8Array.from([0x04]),
  Uint8Array.from([0x10]),
  Uint8Array.from([0x11]),
  Uint8Array.from([0x81]),
  Uint8Array.from([0xff]),
  Uint8Array.from([0x01, 0x02, 0x03]),
  new Uint8Array(75).fill(0x07),
  new Uint8Array(76).fill(0x07),
  new Uint8Array(255).fill(0x07),
  new Uint8Array(256).fill(0x07),
];

/** Minimal script numbers, whose canonical encoding is already what the fragment is handed. */
const NUMBERS: readonly bigint[] = [0n, 1n, 4n, 16n, 17n, 75n, 76n, 127n, -1n, -127n, 255n, 256n, 65535n, 65536n];

describe('the canonical push of a value', () => {
  it('emits what the encoder emits for every raw value', () => {
    for (const value of RAW_VALUES) {
      expect({ bytes: value.length, ...pushesTo(value, false) }).toStrictEqual({ bytes: value.length, accepted: true });
    }
  });

  it('emits what the encoder emits for every minimal number', () => {
    for (const number of NUMBERS) {
      const minimal = bigIntToVmNumber(number);
      expect({ number: String(number), ...pushesTo(minimal, true) })
        .toStrictEqual({ number: String(number), accepted: true });
    }
  });

  it('minimises a number the code happened to format with a trailing zero', () => {
    // `12` written as two bytes is the same number, and the wire carries the one-byte form.
    expect(pushesTo(Uint8Array.from([0x0c, 0x00]), true, Uint8Array.from([0x0c]))).toStrictEqual({ accepted: true });
    // Without the numeric form the same bytes are a two-byte value, and the two pushes differ.
    expect(pushesTo(Uint8Array.from([0x0c, 0x00]), false, Uint8Array.from([0x0c])).accepted).toBe(false);
  });

  it('refuses a value whose push is not the one the encoder writes', () => {
    // The equality the harness ends on is what makes the case above evidence: a longer value under a numeric
    // reading leaves the encoder's bytes for a different value, and the input fails.
    expect(pushesTo(Uint8Array.from([0x00, 0x01]), true).accepted).toBe(true);
    expect(pushesTo(Uint8Array.from([0x00, 0x01, 0x00]), true).accepted).toBe(false);
  });
});
