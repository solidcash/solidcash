import { decodedAddressEncoding, type Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import type { Contract } from '../../src/Contract.js';
import { buildNamespaces, type BuildNamespacesHost } from '../../src/stateful/sc-build-namespaces.js';

function fixture(solidityImportCompat: boolean): {
  getters: Record<string, (...args: any[]) => Promise<any>>;
  stored: {
    records: { party: { recipient: Uint8Array; digest: Uint8Array }; reviewers: Uint8Array[] }[][];
    owner: Uint8Array;
    digest: Uint8Array;
  };
  word: Uint8Array;
} {
  const word = new Uint8Array(32);
  word.fill(0x42, 12);
  const record = { party: { recipient: word, digest: word }, reviewers: [word] };
  const stored = { records: [[record]], owner: word, digest: word };
  const artifact = {
    abi: [], compiler: { options: { solidityImportCompat } },
    structs: [
      { name: 'Party', fields: [{ name: 'recipient', type: 'address payable' }, { name: 'digest', type: 'bytes32' }] },
      { name: 'Record', fields: [{ name: 'party', type: 'Party' }, { name: 'reviewers', type: 'address[]' }] },
    ],
    stateLayout: {
      variables: [
        { name: 'records', type: 'Record[][1]' }, { name: 'owner', type: 'address' }, { name: 'digest', type: 'bytes32' },
      ],
      collections: [
        { name: 'catalog', kind: 'mapping', keyType: 'uint256', valueType: 'Record' },
        { name: 'catalogRows', kind: 'mapping', keyType: 'uint256', keyTypes: ['uint256', 'bool'],
          valueType: 'Record[][1]' },
      ],
    },
  } as unknown as Artifact;
  const host = {
    getState: async () => stored,
    getEntries: async (name: string) => (name === 'catalogRows'
      ? [{ keys: [0n, true], value: stored.records }] : [{ key: 0n, value: record }]),
  } as unknown as BuildNamespacesHost;
  buildNamespaces(host, { artifact, stateLayout: artifact.stateLayout } as Contract);
  return { getters: host.state as Record<string, (...args: any[]) => Promise<any>>, stored, word };
}

describe('typed state namespace results', () => {
  it.each([true, false])('uses declared state types with Solidity compatibility %s', async (solidity) => {
    const { getters, stored, word } = fixture(solidity);
    const expected = solidity ? word.slice(12) : word;
    const encoding = solidity ? 'evm-abi-v1' : 'compact-pushdata-v1';
    const indexed = await getters.records(0n, 0n);
    const whole = await getters.records();
    const mapped = await getters.catalog(0n);
    for (const record of [indexed, whole[0][0], mapped, indexed.toObject()]) {
      expect(record.party.recipient).toEqual(expected);
      expect(decodedAddressEncoding(record.party.recipient)).toBe(encoding);
      expect(record.reviewers).toEqual([expected]);
      expect(record.party.digest).toBe(word);
      expect(decodedAddressEncoding(record.party.digest)).toBeUndefined();
    }
    expect(await getters.owner()).toEqual(expected);
    expect(await getters.digest()).toBe(word);
    expect(stored.records[0][0].party.recipient).toBe(word);
    expect(decodedAddressEncoding(word)).toBeUndefined();
    expect(Object.hasOwn(stored.records, 'toArray')).toBe(false);
    await expect(getters.records(3n)).rejects.toThrow(/out of bounds/);
    expect(await getters.catalog(1n)).toBeUndefined();
  });

  it('rejects a malformed Solidity address without rewriting an identically shaped bytes32', async () => {
    const { getters, word } = fixture(true);
    word[0] = 1;
    await expect(getters.owner()).rejects.toThrow(/canonical 20-byte identity/);
    await expect(getters.records(0n, 0n)).rejects.toThrow(/canonical 20-byte identity/);
    expect(await getters.digest()).toBe(word);
  });

  it.each([true, false])('separates composite mapping keys from array indices with Solidity compatibility %s', async (solidity) => {
    const { getters, stored, word } = fixture(solidity);
    const expected = solidity ? word.slice(12) : word;
    const indexed = await getters.catalogRows(0n, true, 0, '0');
    const partial = await getters.catalogRows(0n, true, 0n);
    const whole = await getters.catalogRows(0n, true);
    expect(indexed).toBeDefined();
    for (const record of [indexed, partial[0], whole[0][0], indexed.toObject()]) {
      expect(record.party.recipient).toEqual(expected);
      expect(record.party.digest).toBe(word);
    }
    expect(await getters.catalogRows(1n, true)).toBeUndefined();
    for (const index of [-1n, 1n, 0.5, 'invalid', true, new Uint8Array([0])]) {
      await expect(getters.catalogRows(0n, true, index)).rejects.toThrow(/out of bounds/);
    }
    await expect(getters.catalogRows(0n, true, 0n, 0n, 0n)).rejects.toThrow(/not indexable/);
    await expect(getters.catalog(0n, 0n)).rejects.toThrow(/not indexable/);
    expect(stored.records[0][0].party.recipient).toBe(word);
    expect(decodedAddressEncoding(word)).toBeUndefined();
  });
});
