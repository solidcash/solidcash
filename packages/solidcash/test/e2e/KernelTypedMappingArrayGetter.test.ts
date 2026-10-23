import { binToHex } from '@bitauth/libauth';
import {
  buildValueChunkCommitment, decodedAddressEncoding, encodeChunkableValueTail, encodePushdataValue,
  sha256, splitValueIntoValueChunks,
} from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { getEntryNftAddress, getValueChunkAddress } from '../../src/stateful/covenant-helpers.js';
import { encodeEntryCommitment, keyToSlotMulti } from '../../src/stateful/SortedList.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

describe('kernel typed mapping array getters', () => {
  it.each(['direct', 'proxy'])('reads an indexed struct from an authenticated %s mapping entry', async (mode) => {
    const artifact = compileString(`pragma solidity ^0.8.20;
      contract Directory {
        struct Note { address author; uint score; string text; bytes32 digest; }
        uint public count;
        mapping(address => Note[]) public notes;
        function initialize() public { this.count = 0; }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6c), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const factory = getContractFactory(artifact, signer);
    const proxy = mode === 'proxy' ? await upgrades.deployProxy(factory, []) : undefined;
    const stateOwner = proxy?.proxy ?? await factory.deploy();
    const directory = proxy ?? stateOwner.state;
    const identity = addressToLockScript(signer.getAddress()).slice(3, 23);
    const word = new Uint8Array(32);
    word.set(identity, 12);
    const note = 'typed mapping array '.repeat(12);
    // This is a read-boundary fixture: seed a category-owned entry and its content-addressed chunks.
    // Transaction writes are not part of the getter's key/index selection behavior.
    const collection = artifact.stateLayout!.collections!.find((entry) => entry.name === 'notes')!;
    const slot = keyToSlotMulti([word], collection);
    const encoded = encodePushdataValue([{ author: word, score: 7n, text: note, digest: word }],
      'Note[]', artifact.structs);
    await provider.addUtxo(getEntryNftAddress(stateOwner.inner, stateOwner.categoryId, 'notes'), {
      txid: 'fa'.repeat(32), vout: 0, satoshis: 10_000n,
      token: { category: stateOwner.categoryId, amount: 0n, nft: { capability: 'mutable',
        commitment: binToHex(encodeEntryCommitment(slot, new Uint8Array(32), encodeChunkableValueTail(encoded))) } },
    });
    for (const [index, chunk] of splitValueIntoValueChunks(encoded).entries()) {
      await provider.addUtxo(getValueChunkAddress(stateOwner.inner, stateOwner.categoryId, 'notes', slot, sha256(encoded)), {
        txid: 'fa'.repeat(32), vout: index + 1, satoshis: 10_000n,
        token: { category: stateOwner.categoryId, amount: 0n, nft: { capability: 'mutable',
          commitment: buildValueChunkCommitment(index, chunk) } },
      });
    }
    const storedBefore = await stateOwner.getEntries('notes');
    const indexed = await (directory as any).notes(word, 0n);
    const whole = await (directory as any).notes(word);
    expect(indexed).toBeDefined();
    for (const result of [indexed, whole[0], indexed.toObject()]) {
      expect(result.author).toEqual(identity);
      expect(decodedAddressEncoding(result.author)).toBe('evm-abi-v1');
      expect(result.score).toBe(7n);
      expect(result.text).toBe(note);
      expect(result.digest).toEqual(word);
      expect(decodedAddressEncoding(result.digest)).toBeUndefined();
    }
    await expect((directory as any).notes(word, 1n)).rejects.toThrow(/out of bounds/);
    const storedAfter = await stateOwner.getEntries('notes');
    expect(storedAfter).toEqual(storedBefore);
    expect((storedAfter[0].value as any[])[0].author).toEqual(word);
    expect(decodedAddressEncoding((storedAfter[0].value as any[])[0].author)).toBeUndefined();
  }, 180_000);
});
