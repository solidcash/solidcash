import { binToHex, hexToBin } from '@bitauth/libauth';
import { buildChunkCommitment, splitValueIntoChunks } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { getDynamicChunkAddress, getEntryNftAddress } from '../../../src/stateful/covenant-helpers.js';
import { setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';
import { messageBusVmAccepts } from './vm-accepts.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true,
  maximumInputBytes: 1_000_000, suppressWarnings: true,
} as const;

describe('kernel selected loop entries beside dynamic chunks', () => {
  it('preserves chunk placement without minting entries for unselected sibling handlers', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`contract Store() {
      bytes archive;
      mapping(string => string) labels;
      function label(string key, string value) public { this.labels[key] = value; require(true); }
      function archiveValue(bytes value) public { this.archive = value; require(true); }
    }`, KERNEL);
    expect(artifact.messageBus!.route.entryLoopWrites).toContain('labels');
    const prior = new Uint8Array(160).fill(0x31);
    const base = new Contract(artifact, [], { provider });
    const seeded = await setupStatefulUtxos(provider, base, artifact.stateLayout!, { archive: prior }, {
      saltContract: true,
      // Chunk covenants bind the master's lock: seed them for the category-pinned master.
      extraOutputs: (categoryId) => splitValueIntoChunks(prior).map((chunk, index) => ({
        address: getDynamicChunkAddress(base.withCategory(hexToBin(categoryId)), categoryId, 'archive', 'bytes'),
        satoshis: 10_000n,
        token: { amount: 0n, nft: {
          capability: 'mutable', commitment: buildChunkCommitment(index, chunk),
        } },
      })),
    });
    const store = StatefulContract.withCategory(base.withCategory(hexToBin(seeded.categoryId)), seeded.categoryId);
    const labels = getEntryNftAddress(store.inner, store.categoryId, 'labels');
    const beforeLabels = await provider.getUtxos(labels);
    const value = new Uint8Array(150).fill(0x42);
    const composition = store.batch([{ function: 'archiveValue', args: [value] }]);
    const builder = await composition.build();
    expect(messageBusVmAccepts(builder)).toBe(true);
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/u) });
    expect(await provider.getUtxos(labels)).toEqual(beforeLabels);
    const state = await store.getState();
    expect(state.archive instanceof Uint8Array ? binToHex(state.archive) : state.archive).toBe(binToHex(value));
  }, 180_000);
});
