import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

describe('address mapping key encoding metadata', () => {
  it.each([
    { evmCompat: false, encoding: undefined },
    { evmCompat: true, encoding: 'identity20' },
  ])('describes typed and aliased keys with $evmCompat compatibility', (options) => {
    const artifact = compileString(`type Account is address;
      contract Store() {
        mapping(Account => mapping(bytes32 => int)) records;
        mapping(bytes32 => int) raw;
        function record(Account who, bytes32 key) public {
          this.records[who][key] = 42;
          this.raw[key] = 7;
          require(true);
        }
      }`, {
      messageBus: false, suppressWarnings: true,
      evmCompat: options.evmCompat,
    });
    const collections = artifact.stateLayout!.collections!;
    expect(collections.find((entry) => entry.name === 'records')).toMatchObject({
      keyType: 'address', keyTypes: ['address', 'bytes32'], sorted: true,
    });
    expect(collections.find((entry) => entry.name === 'records')!.addressKeyEncoding).toBe(options.encoding);
    expect(collections.find((entry) => entry.name === 'raw')!.addressKeyEncoding).toBeUndefined();
    expect(artifact.stateLayout!.mappings!.find((entry) => entry.name === 'records')!.addressKeyEncoding)
      .toBe(options.encoding);
  });
});
