import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  CONTRACT_LOCK_LENGTH,
  P2PKH_LOCK_LENGTH,
  SELECTOR_LENGTH,
  argsHash,
  assertAddressValue,
  decodeIntegerValue,
  encodeArgumentList,
  encodeArgumentPayload,
  encodeBooleanValue,
  encodeCallDataArguments,
  encodeIntegerValue,
  encodeRawValue,
  encodeResultList,
  isAddressValue,
} from '../../src/framed/index.js';
import { concatBytes, hexToBytes } from '../../src/framed/primitives.js';
import { expectFramedRejection, toBytes, toHex } from './helpers.js';
import { ARGUMENT_PUSHES, ARGS_HASHES, INTEGER_VALUES } from './vectors/canonical.js';
import { ADDRESS_A, USER_LOCK } from './vectors/identity.js';

const independentSha256 = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

describe('canonical argument encoding', () => {
  it('has the address and selector lengths the wire format names', () => {
    expect(P2PKH_LOCK_LENGTH).toBe(25);
    expect(CONTRACT_LOCK_LENGTH).toBe(35);
    expect(SELECTOR_LENGTH).toBe(4);
  });

  for (const vector of ARGUMENT_PUSHES) {
    it(`encodes ${vector.name}`, () => {
      expect(toHex(encodeArgumentPayload(toBytes(vector.value)))).toBe(vector.expected);
    });
  }

  it('encodes an argument list as the concatenated pushes in the order given', () => {
    const values = [Uint8Array.of(0x03), hexToBytes('aabb'), new Uint8Array(0)];
    expect(toHex(encodeArgumentList(values))).toBe('5302aabb00');
    expect(toHex(encodeArgumentList(values))).toBe(
      toHex(concatBytes(values.map((value) => encodeArgumentPayload(value)))),
    );
  });

  it('encodes call data arguments with the first parameter\'s push last', () => {
    // The callee's body reads its first parameter from the top of the stack, so the call data has to leave that
    // parameter's push for last, whichever order the values are named in.
    const values = [Uint8Array.of(0x03), hexToBytes('aabb'), new Uint8Array(0)];
    expect(toHex(encodeCallDataArguments(values))).toBe('0002aabb53');
    expect(toHex(encodeCallDataArguments(values))).toBe(toHex(encodeArgumentList([...values].reverse())));
    expect(toHex(encodeCallDataArguments(values))).not.toBe(toHex(encodeArgumentList(values)));
  });
});

describe('argsHash', () => {
  for (const vector of ARGS_HASHES) {
    it(`hashes ${vector.name}`, () => {
      const selector = toBytes(vector.selector);
      expect(selector.length).toBe(SELECTOR_LENGTH);
      expect(toHex(argsHash(selector, toBytes(vector.args)))).toBe(vector.expected);
      expect(toHex(argsHash(selector, toBytes(vector.args))))
        .toBe(independentSha256(concatBytes([selector, toBytes(vector.args)])));
    });
  }

  it('changes when one argument byte changes', () => {
    const gh3 = ARGS_HASHES.find((vector) => vector.name === 'g(3)')!;
    const gh4 = ARGS_HASHES.find((vector) => vector.name.startsWith('g(4)'))!;
    expect(gh3.args).not.toBe(gh4.args);
    expect(gh3.expected).not.toBe(gh4.expected);
    expect(toHex(argsHash(toBytes(gh3.selector), toBytes(gh3.args))))
      .not.toBe(toHex(argsHash(toBytes(gh4.selector), toBytes(gh4.args))));
  });

  it('rejects a selector that is not four bytes', () => {
    expectFramedRejection(() => argsHash(new Uint8Array(3), new Uint8Array(0)), /selector is 4 bytes/);
    expectFramedRejection(() => argsHash(new Uint8Array(5), new Uint8Array(0)), /selector is 4 bytes/);
  });
});

describe('canonical integer values', () => {
  for (const vector of INTEGER_VALUES) {
    it(`encodes and decodes ${vector.value}`, () => {
      const encoded = encodeIntegerValue(BigInt(vector.value));
      expect(toHex(encoded)).toBe(vector.expected);
      expect(decodeIntegerValue(encoded)).toBe(BigInt(vector.value));
    });
  }

  it('rejects a value that is not a bigint', () => {
    expectFramedRejection(() => encodeIntegerValue(1 as unknown as bigint));
  });
});

describe('canonical boolean, raw and result values', () => {
  it('encodes true and false as the script numbers 1 and 0', () => {
    expect(toHex(encodeBooleanValue(true))).toBe('01');
    expect(toHex(encodeBooleanValue(false))).toBe('00');
  });

  it('leaves raw bytes unchanged', () => {
    const value = hexToBytes('deadbeef');
    expect(toHex(encodeRawValue(value))).toBe('deadbeef');
  });

  it('encodes a result list with the argument-list encoding', () => {
    const values = [Uint8Array.of(0x14), new Uint8Array(0)];
    expect(toHex(encodeResultList(values))).toBe(toHex(encodeArgumentList(values)));
  });
});

describe('address values', () => {
  it('accepts a user lock and a contract lock', () => {
    expect(isAddressValue(hexToBytes(USER_LOCK))).toBe(true);
    expect(isAddressValue(hexToBytes(ADDRESS_A))).toBe(true);
  });

  it('rejects a length no address form uses', () => {
    expect(isAddressValue(new Uint8Array(30))).toBe(false);
    expect(isAddressValue(new Uint8Array(0))).toBe(false);
    expectFramedRejection(() => assertAddressValue(new Uint8Array(30), 'sender'), /sender is 30 byte/);
    expectFramedRejection(() => assertAddressValue(new Uint8Array(0), 'self'));
  });
});
