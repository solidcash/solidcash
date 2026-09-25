/**
 * Golden vectors for the canonical value encodings.
 *
 * Each `expected` is the one byte string the wire format allows for the value, recorded outside the module under
 * test. The minimal-push traps are the values whose obvious encoding is not the one libauth's `encodeDataPush`
 * produces: `0x00` is not `OP_0`, and `0x01`/`0x10`/`0x81` are folded into number opcodes.
 */

export interface PushVector {
  readonly name: string;
  /** The raw argument value. */
  readonly value: string;
  /** The single minimal push of that value. */
  readonly expected: string;
}

const fill = (length: number): string => 'ab'.repeat(length);

export const ARGUMENT_PUSHES: readonly PushVector[] = [
  { name: 'empty argument', value: '', expected: '00' },
  { name: 'one byte 0x01 folds to OP_1', value: '01', expected: '51' },
  { name: 'one byte 0x10 folds to OP_16', value: '10', expected: '60' },
  { name: 'one byte 0x81 folds to OP_1NEGATE', value: '81', expected: '4f' },
  { name: 'one byte 0x00 stays a direct push', value: '00', expected: '0100' },
  { name: 'one byte 0x11 stays a direct push', value: '11', expected: '0111' },
  { name: 'one byte 0x80 stays a direct push', value: '80', expected: '0180' },
  { name: '75 bytes: the last direct push', value: fill(75), expected: `4b${fill(75)}` },
  { name: '76 bytes: OP_PUSHDATA1', value: fill(76), expected: `4c4c${fill(76)}` },
  { name: '255 bytes: OP_PUSHDATA1 at its maximum', value: fill(255), expected: `4cff${fill(255)}` },
  { name: '256 bytes: OP_PUSHDATA2', value: fill(256), expected: `4d0001${fill(256)}` },
];

/** Minimal script numbers, the canonical integer encoding. */
export const INTEGER_VALUES: readonly { value: string; expected: string }[] = [
  { value: '0', expected: '' },
  { value: '1', expected: '01' },
  { value: '-1', expected: '81' },
  { value: '127', expected: '7f' },
  { value: '128', expected: '8000' },
  { value: '256', expected: '0001' },
];

export interface ArgsHashVector {
  readonly name: string;
  readonly selector: string;
  /** The concatenated argument pushes, exactly as they appear between the witness block and the redeem script. */
  readonly args: string;
  readonly expected: string;
}

/**
 * `SHA256(selector || args)` cases. `g(3)` has one argument whose push is `OP_3`; `k()` has none; the last two
 * differ from `g(3)` by one argument byte, to show the hash moves with it.
 */
export const ARGS_HASHES: readonly ArgsHashVector[] = [
  {
    name: 'g(3)',
    selector: '05060708',
    args: '53',
    expected: '1549f3e688b3d33465dc04feeacd3423c2d7fda2b08b6031997e209ab636dfca',
  },
  {
    name: 'k()',
    selector: '0d0e0f10',
    args: '',
    expected: '21ba31f43e0914cd61d80ec2c998fbf0a13f467e1b340dcea6b407c65f941ab7',
  },
  {
    name: 'g(4) differs from g(3) by one argument byte',
    selector: '05060708',
    args: '54',
    expected: '1de54bdc7d36f19e6306375228163de03bef7dd9ade882b26d1c0e8503346ef4',
  },
];
