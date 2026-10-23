import { bigIntToVmNumber, binToHex, hexToBin } from '@bitauth/libauth';
import {
  buildValueChunkCommitment, encodeChunkableValueTail, encodePushdataValue, sha256, splitValueIntoValueChunks,
} from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  Signer,
} from '../../src/index.js';
import {
  StatefulContract,
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import { getEntryNftAddress, getValueChunkAddress } from '../../src/stateful/covenant-helpers.js';
import { encodeEntryCommitment, keyToSlot } from '../../src/stateful/SortedList.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

const options = {
  forceStateful: true, messageBus: true, messageBusKernel: true, messageBusGraphContext: true,
  evmCompat: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
  sortedMappingsAll: false,
} as const;

describe('kernel stored incoming-entry values', () => {
  it.each(['field', 'array'])('preserves long fields through a nested %s update', async (mode) => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x63), provider);
    for (let index = 0; index < 24; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Record { uint256 amount; bytes payload; int16[2] marks; }
      function magnitude(int16 value) pure returns (int16) { return value >= 0 ? value : -value; }
      contract Archive() {
        mapping(uint256 => Record) records;
        function update(uint256 key, uint256 amount) public {
          ${mode === 'field' ? 'records[key].amount = amount;' : `
            Record memory record = records[key];
            record.marks[0] = magnitude(record.marks[0]) + 1;
            record.marks[1] = magnitude(record.marks[1]);
            records[key].marks = record.marks;
          `}
          require(true);
        }
      }`, options);
    const base = new Contract(artifact, [], { provider });
    // Entries and chunks bind the master lock, which is the category-pinned contract's.
    const pinned = (categoryId: string): Contract => base.withCategory(hexToBin(categoryId));
    const payload = new Uint8Array(180).fill(0x53);
    const previous = encodePushdataValue({ amount: 5n, payload, marks: [-2n, -3n] }, 'Record', artifact.structs);
    const slot = keyToSlot(bigIntToVmNumber(7n));
    const seeded = await setupStatefulUtxos(provider, base, {
      ...artifact.stateLayout!, collections: [],
    }, {}, {
      saltContract: true,
      extraOutputs: (categoryId) => [{
        address: getEntryNftAddress(pinned(categoryId), categoryId, 'records'), satoshis: 10_000n,
        token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(
          new Uint8Array(32), slot, new Uint8Array(64),
        )) } },
      }, {
        address: getEntryNftAddress(pinned(categoryId), categoryId, 'records'), satoshis: 10_000n,
        token: { amount: 0n, nft: { capability: 'mutable', commitment: binToHex(encodeEntryCommitment(
          slot, new Uint8Array(32), encodeChunkableValueTail(previous),
        )) } },
      }, ...splitValueIntoValueChunks(previous).map((chunk, index) => ({
        address: getValueChunkAddress(pinned(categoryId), categoryId, 'records', slot, sha256(previous)), satoshis: 10_000n,
        token: { amount: 0n, nft: { capability: 'mutable', commitment: buildValueChunkCommitment(index, chunk) } },
      }))],
    });
    const archive = StatefulContract.withCategory(base.withCategory(hexToBin(seeded.categoryId)), seeded.categoryId);
    const driverArtifact = compileString(`pragma solidity ^0.8.0;
      interface IArchive {
        function update(uint256 key, uint256 amount) external;
      }
      contract Driver() {
        uint256 calls;
        function initialize() public { this.calls = 0; }
        function run(address target, uint256 key, uint256 amount) public {
          IArchive(target).update(key, amount);
          this.calls = this.calls + 1; require(true);
        }
      }`, options);
    const driver = await upgrades.deployProxy(getContractFactory(driverArtifact, signer), []);
    driver.implementation._registerResolvedExternal('IArchive', archive);
    await expect(driver.forward('run', [await archive.getAddress(), 7n, 23n]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/u) });
    const entries = await archive.getEntries('records');
    expect(entries).toHaveLength(1);
    expect(entries[0].value).toEqual({ amount: mode === 'field' ? 23n : 5n, payload,
      marks: mode === 'field' ? [-2n, -3n] : [3n, 3n] });
    expect(binToHex((entries[0].value as { payload: Uint8Array }).payload)).toBe('53'.repeat(180));
  }, 180_000);
});
