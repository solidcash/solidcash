import { bigIntToVmNumber, binToHex } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import type { AbiFunction, Artifact } from '@solidcash/utils';
import type { StatefulContract } from '../../src/stateful/StatefulContract.js';
import { encodeEntryCommitment, keyToSlotMulti } from '../../src/stateful/SortedList.js';
import { getEntryNftAddress } from '../../src/stateful/covenant-helpers.js';
import { deriveDirectCollectionLengthResult } from '../../src/message-bus/compute-recipe-producer-state.js';

const category = 'ab'.repeat(31) + '54';
const collection = {
  name: 'values', signature: 'values:mapping(uint256 => uint8[])', kind: 'mapping' as const,
  keyType: 'uint256', valueType: 'uint8[]', sorted: true, chunkableValue: true,
};
const artifact = {
  contractName: 'SelectedImplementation',
  stateLayout: { variables: [], dataNftCount: 0, collections: [collection] },
} as unknown as Artifact;
const abiFunction = {
  name: 'valuesLength',
  inputs: [{ name: 'key', type: 'uint256' }], outputs: [{ type: 'uint256' }],
  writesState: false,
  directCollectionLengthReturn: { collection: 'values', keyParams: ['key'] },
} as AbiFunction;

describe('direct collection-length compute producer', () => {
  it('reads the exact key from the runtime-selected proxy category and implementation layout', async () => {
    const slot = keyToSlotMulti([bigIntToVmNumber(7n)], collection);
    const commitment = binToHex(encodeEntryCommitment(
      slot, new Uint8Array(32), Uint8Array.from([5, 0, 0, 0, 0x52, 11, 0, 12, 0]),
    ));
    let queried = 0;
    // Direct entry covenants bind a 35-byte master lock. A proxy's records bind the proxy's, not the executor's.
    const ownerLock = `aa20${'5a'.repeat(32)}87`;
    let ownerEntryAddress = '';
    const provider = {
      network: 'regtest',
      getUtxos: async (address: string) => {
        queried += 1;
        if (address !== ownerEntryAddress) return [];
        return [
          { txid: '11'.repeat(32), vout: 0, satoshis: 1000n,
            token: { category: 'cd'.repeat(31) + '32', nft: { capability: 'mutable', commitment } } },
          { txid: '22'.repeat(32), vout: 0, satoshis: 1000n,
            token: { category, nft: { capability: 'mutable', commitment } } },
        ];
      },
    };
    ownerEntryAddress = getEntryNftAddress({
      artifact, provider, addressType: 'p2sh32', lockingBytecode: ownerLock,
    } as never, category, collection.signature);
    const owner = {
      categoryId: category,
      inner: {
        name: 'Proxy', artifact: { contractName: 'Proxy' }, provider, addressType: 'p2sh32', lockingBytecode: ownerLock,
      },
    } as unknown as StatefulContract;
    const executor = {
      categoryId: 'ef'.repeat(31) + '10',
      inner: {
        name: 'SelectedImplementation', artifact, provider, addressType: 'p2sh32',
        lockingBytecode: `aa20${'6b'.repeat(32)}87`,
      },
    } as unknown as StatefulContract;
    expect(await deriveDirectCollectionLengthResult({
      artifact, abiFunction, args: [7n], owner, executor, hasPriorOwnerWrite: false,
    })).toBe(2n);
    expect(queried).toBe(1);
    expect(await deriveDirectCollectionLengthResult({
      artifact, abiFunction, args: [8n], owner, executor, hasPriorOwnerWrite: false,
    })).toBe(0n);
  });

  it('does not replay pre-state after an earlier write to the same physical owner', async () => {
    const owner = {} as StatefulContract;
    expect(await deriveDirectCollectionLengthResult({
      artifact, abiFunction, args: [7n], owner, hasPriorOwnerWrite: true,
    })).toBeUndefined();
  });
});
