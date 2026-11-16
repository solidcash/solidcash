/**
 * An event record carries each argument as the push its covenant made. The compiler pushes an `address` event argument
 * whole, as a minimal push of its bytes (`emitGenericPushdataEncode`, libauth's `encodeDataPush`): 20 zero bytes, which
 * a refused `ecrecoverEvm` answers, are a 20-byte push, and address(0), the empty value, is OP_0. A record the SDK
 * builds from values must spell them the same, also inside a struct or an array. The state encoder still reads any
 * all-zero address as address(0).
 */
import { describe, expect, it } from 'vitest';
import { bigIntToVmNumber, binToHex, encodeDataPush, hexToBin } from '@bitauth/libauth';
import {
  completeEventCommitment,
  encodeEventCommitment,
  encodeEventParameter,
  encodeEventPushdataValue,
  encodePushdataValue,
  type StructDefinitionInfo,
} from '../src/index.js';

const ZERO20 = new Uint8Array(20);
const ZERO20_PUSH = `14${'00'.repeat(20)}`;
const P2PKH = hexToBin('76a91471782e8159265ed94bd35b8e699c08f53a6f38c688ac');

describe('an address event argument is pushed as its covenant pushes it', () => {
  it('keeps 20 zero bytes a 20-byte push, where the state encoder writes address(0)', () => {
    expect(binToHex(encodeEventParameter(ZERO20, { type: 'address' }))).toBe(ZERO20_PUSH);
    expect(encodeEventParameter(ZERO20, { type: 'address' })).toEqual(encodeDataPush(ZERO20));
    expect(binToHex(encodeEventPushdataValue(ZERO20, 'address payable'))).toBe(ZERO20_PUSH);
    // Other all-zero values are their own pushes too, as libauth's minimal push spells them.
    for (const zeros of [new Uint8Array(1), new Uint8Array(32)]) {
      expect(encodeEventParameter(zeros, { type: 'address' })).toEqual(encodeDataPush(zeros));
    }
    // State records and the arguments of a call still read an all-zero address as address(0).
    expect(binToHex(encodePushdataValue(ZERO20, 'address'))).toBe('00');
  });

  it('spells address(0) and a lock as before', () => {
    // address(0) compiles to the empty value: as bytes, as ethers' zero address, and as the integer zero.
    for (const zero of [new Uint8Array(0), '0x0000000000000000000000000000000000000000', 0n]) {
      expect(binToHex(encodeEventParameter(zero, { type: 'address' }))).toBe('00');
    }
    expect(encodeEventParameter(P2PKH, { type: 'address' })).toEqual(encodeDataPush(P2PKH));
    expect(encodeEventParameter(`0x${binToHex(P2PKH)}`, { type: 'address' })).toEqual(encodeDataPush(P2PKH));
  });

  it('keeps 20 zero bytes in a struct field and in an array element', () => {
    const structs: StructDefinitionInfo[] = [{
      name: 'Signed', fields: [{ name: 'who', type: 'address' }, { name: 'nonce', type: 'uint8' }],
    }];
    expect(binToHex(encodeEventParameter({ who: ZERO20, nonce: 7n }, { type: 'Signed' }, structs)))
      .toBe(`${ZERO20_PUSH}57`);
    expect(binToHex(encodeEventParameter([ZERO20, P2PKH], { type: 'address[]' })))
      .toBe(`52${ZERO20_PUSH}${binToHex(encodeDataPush(P2PKH))}`);
    // The state encoder writes the same values with address(0) in both places.
    expect(binToHex(encodePushdataValue({ who: ZERO20, nonce: 7n }, 'Signed', structs))).toBe('0057');
  });

  it('builds and completes a whole record from values', () => {
    const parameters = [{ type: 'uint256' }, { type: 'address' }];
    const record = encodeEventCommitment(parameters, [0n, ZERO20]);
    expect(binToHex(record)).toBe(`00${ZERO20_PUSH}`);
    // A derived commitment holding only the last argument's push is completed from the values.
    expect(binToHex(completeEventCommitment(hexToBin(ZERO20_PUSH), parameters, [0n, ZERO20])))
      .toBe(`00${ZERO20_PUSH}`);
    // A bytes20 argument was already a 20-byte push.
    expect(binToHex(encodeEventParameter(ZERO20, { type: 'bytes20' }))).toBe(ZERO20_PUSH);
  });

  it('pushes an enum argument, which the ABI spells by its enum\'s name, as its ordinal', () => {
    // The covenant pushes an enum as an integer, minimally; a record spells the same field `bigint`.
    for (const ordinal of [0n, 1n, 16n, 17n]) {
      expect(encodeEventParameter(ordinal, { type: 'Color' })).toEqual(encodeDataPush(bigIntToVmNumber(ordinal)));
      expect(encodeEventParameter(ordinal, { type: 'Color' })).toEqual(encodePushdataValue(ordinal, 'bigint'));
    }
    // A built-in type keeps refusing an integer.
    expect(() => encodeEventParameter(1n, { type: 'bytes' })).toThrow('Cannot convert value to bytes for type bytes');
  });
});
