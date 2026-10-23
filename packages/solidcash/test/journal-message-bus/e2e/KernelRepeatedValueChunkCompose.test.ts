import { bigIntToVmNumber, binToHex, hexToBin } from '@bitauth/libauth';
import {
  buildValueChunkCommitment, encodeChunkableValueTail, encodePushdataValue,
  sha256, splitValueIntoValueChunks,
} from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import {
  getEntryNftAddress, getValueChunkAddress, getValueChunkLockingBytecode,
} from '../../../src/stateful/covenant-helpers.js';
import { encodeEntryCommitment, keyToSlot } from '../../../src/stateful/SortedList.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';
import { messageBusVmAccepts } from './vm-accepts.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true,
  maximumInputBytes: 1_000_000, evmCompat: true, suppressWarnings: true,
} as const;
const storeArtifact = compileString(`pragma solidity ^0.8.0;
contract Store() {
  struct Record { bytes payload; }
  mapping(uint => Record[]) records;
  function append(uint key, bytes memory value) public {
    this.records[key].push(Record(value));
    require(true);
  }
}`, KERNEL);

describe('kernel repeated chunk-backed mapping values', () => {
  it.each([
    { name: 'chunked prior value at key zero', priorBytes: 150, key: 0n },
    { name: 'inline prior value', priorBytes: 15, key: 7n },
    { name: 'empty prior array', priorBytes: 0, key: 9n },
  ])('persists two appends with $name', async ({ priorBytes, key }) => {
    const provider = createMessageBusCapstoneTestProvider();
    const base = new Contract(storeArtifact, [], { provider });
    const priorRecords = priorBytes > 0 ? [{ payload: new Uint8Array(priorBytes).fill(0x21) }] : [];
    const previous = encodePushdataValue(priorRecords, 'Record[]', storeArtifact.structs);
    const slot = keyToSlot(bigIntToVmNumber(key));
    // Seed a complete sorted list, including its HEAD link, without a separate empty HEAD.
    const seeded = await setupStatefulUtxos(provider, base, {
      ...storeArtifact.stateLayout!, collections: [],
    }, {}, {
      saltContract: true,
      // Entry and value-chunk covenants bind the master's lock: seed them for the category-pinned master.
      extraOutputs: (categoryId) => [{
        address: getEntryNftAddress(base.withCategory(hexToBin(categoryId)), categoryId, 'records'),
        satoshis: 10_000n,
        token: { amount: 0n, nft: {
          capability: 'mutable', commitment: binToHex(encodeEntryCommitment(
            new Uint8Array(32), slot, new Uint8Array(64),
          )),
        } },
      }, {
        address: getEntryNftAddress(base.withCategory(hexToBin(categoryId)), categoryId, 'records'),
        satoshis: 10_000n,
        token: { amount: 0n, nft: {
          capability: 'mutable', commitment: binToHex(encodeEntryCommitment(
            slot, new Uint8Array(32), encodeChunkableValueTail(previous),
          )),
        } },
      }, ...splitValueIntoValueChunks(previous).map((chunk, index) => ({
        address: getValueChunkAddress(
          base.withCategory(hexToBin(categoryId)), categoryId, 'records', slot, sha256(previous),
        ),
        satoshis: 10_000n,
        token: { amount: 0n, nft: {
          capability: 'mutable', commitment: buildValueChunkCommitment(index, chunk),
        } },
      }))],
    });
    const store = StatefulContract.withCategory(
      base.withCategory(hexToBin(seeded.categoryId)), seeded.categoryId,
    );
    const first = new Uint8Array(140).fill(0x31);
    const second = new Uint8Array(90).fill(0x42);
    const call = store.batch([
      { function: 'append', args: [key, first] },
      { function: 'append', args: [key, second] },
    ]);
    // The resulting chunk vector is larger than the seeded prior value. Supply independent BCH for the newly
    // minted chunk outputs; the state/entry NFT inputs must remain value-conserving, not implicitly overfunded.
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    call.addInput(funder.utxo, funder.unlocker);
    const builder = await call.build();
    const expected = encodePushdataValue([
      ...priorRecords, { payload: first }, { payload: second },
    ], 'Record[]', storeArtifact.structs);
    const lock = getValueChunkLockingBytecode(
      store.categoryId, 'records', slot, sha256(expected), hexToBin(store.inner.lockingBytecode),
    );
    const chunks = builder.buildLibauthTransaction().outputs
      .filter((output) => binToHex(output.lockingBytecode) === binToHex(lock))
      .map((output) => binToHex(output.token!.nft!.commitment));
    expect(chunks).toEqual(splitValueIntoValueChunks(expected)
      .map((chunk, index) => buildValueChunkCommitment(index, chunk)));
    expect(messageBusVmAccepts(builder)).toBe(true);
    await expect(builder.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/u) });
  }, 180_000);
});
