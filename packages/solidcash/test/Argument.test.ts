import { describe, it, expect } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { encodeInt, bytesToHex } from '@solidcash/utils';
import { encodeFunctionArgument, SignatureTemplate } from '../src/index.js';
import { resolveAddressArguments } from '../src/Argument.js';
import { addressToLockScript } from '../src/utils.js';
import { aliceAddress, alicePriv, bobAddress, bobPriv, carolAddress } from './fixture/vars.js';

describe('encodeFunctionArgument: empty arrays', () => {
  it('preserves the zero count prefix through the outer unlocking-script push', () => {
    expect(encodeFunctionArgument([], 'address[]')).toEqual(Uint8Array.from([0x01, 0x00]));
  });
});

describe('encodeFunctionArgument: address arrays', () => {
  it('normalizes hex locking bytecodes at address-typed leaves of nested arrays', () => {
    const lockingBytecode = addressToLockScript(aliceAddress);
    const hex = binToHex(lockingBytecode);
    expect(encodeFunctionArgument([hex, `0x${hex}`, aliceAddress, '0x0000000000000000000000000000000000000000'], 'address[]'))
      .toEqual(encodeFunctionArgument([
        lockingBytecode, lockingBytecode, lockingBytecode, new Uint8Array(),
      ], 'address[]'));
    expect(encodeFunctionArgument([[hex], [`0x${hex}`, aliceAddress]], 'address[][]'))
      .toEqual(encodeFunctionArgument([[lockingBytecode], [lockingBytecode, lockingBytecode]], 'address[][]'));
  });
});

describe('encodeFunctionArgument: numeric arrays', () => {
  it('coerces safe JS integer leaves in fixed and nested integer arrays', () => {
    expect(encodeFunctionArgument([0, 10_000, 0, 69] as unknown as bigint[], 'uint16[4]'))
      .toEqual(encodeFunctionArgument([0n, 10_000n, 0n, 69n], 'uint16[4]'));
    expect(encodeFunctionArgument([[1, 2], [3, 4]] as unknown as bigint[][], 'uint256[2][2]'))
      .toEqual(encodeFunctionArgument([[1n, 2n], [3n, 4n]], 'uint256[2][2]'));
  });
});

describe('encodeFunctionArgument: deferred signature arrays', () => {
  it('preserves a sig[] template vector until the transaction is final', () => {
    const signatures = [new SignatureTemplate(alicePriv), new SignatureTemplate(bobPriv)];
    expect(encodeFunctionArgument(signatures, 'sig[]')).toBe(signatures);
  });

  it('preserves a sig[][] template matrix until the transaction is final', () => {
    const signatures = [[new SignatureTemplate(alicePriv)], [new SignatureTemplate(bobPriv)]];
    expect(encodeFunctionArgument(signatures, 'sig[][]')).toBe(signatures);
  });

  it('preserves deeper signature arrays recursively', () => {
    const signatures = [[[new SignatureTemplate(alicePriv)]], [[new SignatureTemplate(bobPriv)]]];
    expect(encodeFunctionArgument(signatures, 'sig[][][]')).toBe(signatures);
  });
});

// SDK encoding of enum-typed arguments. Enums are int-backed; an enum value (bigint) encodes as int
// even though the ABI type is the enum name (which is not a recognized primitive type string).
describe('encodeFunctionArgument: enum types', () => {
  it('encodes an int-backed enum value as int', () => {
    expect(encodeFunctionArgument(1n, 'Color')).toEqual(encodeInt(1n));
    expect(encodeFunctionArgument(100n, 'Status')).toEqual(encodeInt(100n));
  });

  it('rejects a non-bigint value for an enum type', () => {
    expect(() => encodeFunctionArgument('green', 'Color')).toThrow(/Unrecognized type/);
  });

  it('still rejects a genuinely unknown type with a non-int value', () => {
    expect(() => encodeFunctionArgument(true as unknown as bigint, 'NotAType')).toThrow(/Unrecognized type/);
  });
});

// SDK encoding of function-pointer arguments. A function value is the target's integer functionId,
// so it encodes as int even though the ABI type string is `function(...)returns(...)`.
describe('encodeFunctionArgument: function pointer types', () => {
  it('encodes a function pointer (functionId) as int', () => {
    expect(encodeFunctionArgument(0n, 'function(int)returns(int)')).toEqual(encodeInt(0n));
    expect(encodeFunctionArgument(3n, 'function(bytes)returns(bool)')).toEqual(encodeInt(3n));
    expect(encodeFunctionArgument(2n, 'function()')).toEqual(encodeInt(2n));
  });

  it('rejects a non-bigint function pointer value', () => {
    expect(() => encodeFunctionArgument('double' as unknown as bigint, 'function(int)returns(int)')).toThrow();
  });
});

// Hardhat/MistSwap suites pass ethers-v5 BigNumber (or the testing-package shim) into constructor
// args via getBigNumber(). Without coercion, encode throws "Found type 'object' where type 'uint256'".
describe('encodeFunctionArgument: ethers BigNumber / numeric objects', () => {
  it('coerces an object with toBigInt() (testing BigNumber shim)', () => {
    const bn = { _value: 1_000_000_000_000_000_000n, toBigInt: () => 1_000_000_000_000_000_000n };
    expect(encodeFunctionArgument(bn as unknown as bigint, 'uint256')).toEqual(
      encodeInt(1_000_000_000_000_000_000n),
    );
  });

  it('coerces an ethers-v5-shaped BigNumber ({_hex,_isBigNumber})', () => {
    const bn = { _hex: '0x64', _isBigNumber: true, toString: () => '100' };
    expect(encodeFunctionArgument(bn as unknown as bigint, 'uint256')).toEqual(encodeInt(100n));
  });

  it('coerces a BN.js-like object via toString(10)', () => {
    const bn = { toString: (base?: number) => (base === 10 || base === undefined ? '42' : '2a') };
    expect(encodeFunctionArgument(bn as unknown as bigint, 'int')).toEqual(encodeInt(42n));
  });

  it('still rejects a plain non-numeric object', () => {
    expect(() => encodeFunctionArgument({ foo: 1 } as unknown as bigint, 'uint256')).toThrow(/object/);
  });
});

describe('encodeFunctionArgument: struct field-name independence', () => {
  const namedStructs = [{
    name: 'Named',
    fields: [{ name: 'address_', type: 'bytes' }, { name: 'timestamp_', type: 'uint32' }],
  }];
  const renamedStructs = [{
    name: 'Renamed',
    fields: [{ name: 'payload', type: 'bytes' }, { name: 'observedAt', type: 'uint32' }],
  }];

  it('does not reinterpret a bytes field because it is named address_', () => {
    const named = { address_: aliceAddress, timestamp_: 0n };
    const renamed = { payload: aliceAddress, observedAt: 0n };

    const expected = encodeFunctionArgument({
      address_: new TextEncoder().encode(aliceAddress), timestamp_: 0n,
    }, 'Named', namedStructs);
    expect(encodeFunctionArgument(named, 'Named', namedStructs)).toEqual(expected);
    expect(encodeFunctionArgument(renamed, 'Renamed', renamedStructs)).toEqual(expected);
    expect(expected).not.toEqual(encodeFunctionArgument({
      address_: addressToLockScript(aliceAddress), timestamp_: 0n,
    }, 'Named', namedStructs));
    expect(named.address_).toBe(aliceAddress);
  });

  it('does not make a JobEventData type name alter bytes semantics', () => {
    const structs = [{
      name: 'JobEventData',
      fields: [
        { name: 'type_', type: 'uint8' },
        { name: 'address_', type: 'bytes' },
        { name: 'data_', type: 'bytes' },
        { name: 'timestamp_', type: 'uint32' },
      ],
    }];
    const event = { type_: 1n, address_: aliceAddress, data_: '', timestamp_: 0n };

    expect(encodeFunctionArgument(event, 'JobEventData', structs)).toEqual(encodeFunctionArgument({
      ...event,
      address_: new TextEncoder().encode(aliceAddress),
    }, 'JobEventData', structs));
    expect(encodeFunctionArgument(event, 'JobEventData', structs)).not.toEqual(encodeFunctionArgument({
      ...event,
      address_: addressToLockScript(aliceAddress),
    }, 'JobEventData', structs));
    expect(event.address_).toBe(aliceAddress);
  });

  it('normalizes address-typed leaves by type through objects and positional tuples', () => {
    const structs = [
      {
        name: 'NamedAddress',
        fields: [{ name: 'address_', type: 'address' }, { name: 'payload', type: 'bytes' }],
      },
      {
        name: 'RenamedAddress',
        fields: [{ name: 'recipient', type: 'address' }, { name: 'address_', type: 'bytes' }],
      },
    ];
    const lockingBytecode = addressToLockScript(aliceAddress);
    const opaqueAddressText = new TextEncoder().encode(aliceAddress);

    expect(encodeFunctionArgument({
      address_: aliceAddress,
      payload: aliceAddress,
    }, 'NamedAddress', structs)).toEqual(encodeFunctionArgument({
      address_: lockingBytecode,
      payload: opaqueAddressText,
    }, 'NamedAddress', structs));
    expect(encodeFunctionArgument([
      aliceAddress,
      aliceAddress,
    ], 'RenamedAddress', structs)).toEqual(encodeFunctionArgument([
      lockingBytecode,
      opaqueAddressText,
    ], 'RenamedAddress', structs));
  });

  it('normalizes a 20-byte address payload to the locking bytecode every other form names', () => {
    const lockingBytecode = addressToLockScript(aliceAddress);
    const payload = lockingBytecode.slice(3, 23);

    expect(encodeFunctionArgument(payload, 'address')).toEqual(lockingBytecode);
    expect(encodeFunctionArgument(`0x${bytesToHex(payload)}`, 'address')).toEqual(lockingBytecode);
    expect(encodeFunctionArgument([payload], 'address[]'))
      .toEqual(encodeFunctionArgument([lockingBytecode], 'address[]'));
    // Anything that is not the payload form keeps the bytes it arrived as: a lock stays a lock, `address(0)` stays
    // empty, and a `bytes` parameter is never reinterpreted because its value happens to be 20 bytes long.
    expect(encodeFunctionArgument(lockingBytecode, 'address')).toEqual(lockingBytecode);
    expect(encodeFunctionArgument(new Uint8Array(0), 'address')).toEqual(new Uint8Array(0));
    expect(encodeFunctionArgument(payload, 'bytes')).toEqual(payload);
  });

  it('normalizes address leaves recursively through arrays of structs', () => {
    const structs = [{
      name: 'Envelope',
      fields: [{ name: 'recipient', type: 'address' }, { name: 'address_', type: 'bytes' }],
    }];
    const lockingBytecode = addressToLockScript(aliceAddress);
    const opaqueAddressText = new TextEncoder().encode(aliceAddress);
    const cashAddressValues = [[
      { recipient: aliceAddress, address_: aliceAddress },
      { recipient: aliceAddress, address_: aliceAddress },
    ]];
    const typedValues = [[
      { recipient: lockingBytecode, address_: opaqueAddressText },
      { recipient: lockingBytecode, address_: opaqueAddressText },
    ]];

    expect(encodeFunctionArgument(cashAddressValues, 'Envelope[][]', structs))
      .toEqual(encodeFunctionArgument(typedValues, 'Envelope[][]', structs));
  });
});

// An ethers contract call resolves its arguments before it encodes them: a value at an `address` position that names
// its address through `getAddress()` (a signer, a contract) stands for that address, wherever the position sits.
describe('resolveAddressArguments: values that name an address', () => {
  const syncAddressable = { getAddress: (): string => aliceAddress };
  const asyncAddressable = { getAddress: async (): Promise<string> => bobAddress };

  it('resolves a sync and an async getAddress() and a promised address, leaving strings and bytes as given', async () => {
    const lock = addressToLockScript(carolAddress);
    const resolved = await resolveAddressArguments(
      ['address', 'address', 'address', 'address', 'address'].map((type) => ({ type })),
      [syncAddressable, asyncAddressable, Promise.resolve(carolAddress), carolAddress, lock] as never,
    );
    expect(resolved).toEqual([aliceAddress, bobAddress, carolAddress, carolAddress, lock]);
    expect(resolved[4]).toBe(lock);
  });

  it('resolves through nested and fixed-size address arrays', async () => {
    const resolved = await resolveAddressArguments(
      [{ type: 'address[][]' }, { type: 'address[3]' }],
      [
        [[syncAddressable], [asyncAddressable, carolAddress]],
        [asyncAddressable, carolAddress, syncAddressable],
      ] as never,
    );
    expect(resolved).toEqual([[[aliceAddress], [bobAddress, carolAddress]], [bobAddress, carolAddress, aliceAddress]]);
  });

  it('resolves a struct\'s address field, keyed or positional, and through an array of structs', async () => {
    const structs = [
      {
        name: 'Payee',
        fields: [{ name: 'who', type: 'address' }, { name: 'note', type: 'bytes' }, { name: 'share', type: 'uint16' }],
      },
      { name: 'Split', fields: [{ name: 'payees', type: 'Payee[]' }, { name: 'owner', type: 'address' }] },
    ];
    const note = Uint8Array.of(1, 2);
    const split = {
      payees: [{ who: asyncAddressable, note, share: 3n }, [syncAddressable, note, 4n]],
      owner: syncAddressable,
    };
    const [keyed, positional, resolvedSplit] = await resolveAddressArguments(
      [{ type: 'Payee' }, { type: 'Payee' }, { type: 'Split' }],
      [{ who: syncAddressable, note, share: 1n }, [asyncAddressable, note, 2n], split] as never,
      structs,
    );
    expect(keyed).toEqual({ who: aliceAddress, note, share: 1n });
    expect(positional).toEqual([bobAddress, note, 2n]);
    const byAddress = { payees: [{ who: bobAddress, note, share: 3n }, [aliceAddress, note, 4n]], owner: aliceAddress };
    expect(resolvedSplit).toEqual(byAddress);
    expect(encodeFunctionArgument(resolvedSplit!, 'Split', structs))
      .toEqual(encodeFunctionArgument(byAddress, 'Split', structs));
    // The caller's own value is left as it was.
    expect(split.owner).toBe(syncAddressable);
  });

  it('leaves every other position as given, and a container in which nothing resolved as the same object', async () => {
    const structs = [{ name: 'Tagged', fields: [{ name: 'tag', type: 'bytes' }, { name: 'who', type: 'address' }] }];
    const addresses = [carolAddress];
    const tagged = { tag: syncAddressable, who: carolAddress };
    const pending = Promise.resolve(5n);
    const [sameArray, number, bytes, sameStruct, kept] = await resolveAddressArguments(
      [{ type: 'address[]' }, { type: 'uint256' }, { type: 'bytes' }, { type: 'Tagged' }, { type: 'uint256' }],
      [addresses, 5n, syncAddressable, tagged, pending] as never,
      structs,
    );
    expect(sameArray).toBe(addresses);
    expect(number).toBe(5n);
    expect(bytes).toBe(syncAddressable);
    expect(sameStruct).toBe(tagged);
    expect(kept).toBe(pending);
  });
});
