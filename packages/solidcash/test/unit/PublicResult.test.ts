import { decodedAddressEncoding, type Artifact, type StateValue } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { decorateFunctionResult } from '../../src/stateful/public-result.js';

const structs = [{
  name: 'Record', fields: [{ name: 'recipient', type: 'address' }, { name: 'digest', type: 'bytes32' }],
}];
const fn = { name: 'read', inputs: [], outputs: [{ type: 'Record[]' }], resultEncoding: 'evm-abi-v1' as const };
const artifact = { structs } as Artifact;

describe('public typed result projection', () => {
  it('projects only address fields and leaves cached state and aliased bytes untouched', () => {
    const word = new Uint8Array(32);
    word.fill(0x42, 12);
    const stored = [{ recipient: word, digest: word }];
    const result = decorateFunctionResult(stored, fn, artifact) as any;
    expect(result[0].recipient).toEqual(word.slice(12));
    expect(result[0].digest).toBe(word);
    expect(decodedAddressEncoding(result[0].recipient)).toBe('evm-abi-v1');
    expect(decodedAddressEncoding(result[0].digest)).toBeUndefined();
    expect(result.toArray()[0].recipient).toBe(result[0].recipient);
    expect(stored[0].recipient).toBe(word);
    expect(Object.hasOwn(stored, 'toArray')).toBe(false);
    expect(decodedAddressEncoding(word)).toBeUndefined();
  });

  it('preserves native 32-byte addresses and rejects noncanonical EVM words', () => {
    const word = new Uint8Array(32).fill(0x42);
    const stored = [{ recipient: word, digest: word }];
    const native = decorateFunctionResult(stored, { ...fn, resultEncoding: 'compact-pushdata-v1' }, artifact) as any;
    expect(native[0].recipient).toEqual(word);
    expect(decodedAddressEncoding(native[0].recipient)).toBe('compact-pushdata-v1');
    expect(() => decorateFunctionResult(stored, fn, artifact)).toThrow(/canonical 20-byte identity/);
  });

  it('uses explicit result encoding rather than inferring from the source or byte shape', () => {
    const stored: StateValue = [{ recipient: new Uint8Array(), digest: new Uint8Array(32) }];
    const result = decorateFunctionResult(stored, fn, artifact) as any;
    expect(result[0].recipient).toEqual(new Uint8Array(20));
    const native = decorateFunctionResult(stored, { ...fn, resultEncoding: undefined }, artifact) as any;
    expect(native[0].recipient).toEqual(new Uint8Array());
  });
});
