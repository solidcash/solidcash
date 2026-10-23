import { bigIntToVmNumber, binToHex, hexToBin } from '@bitauth/libauth';
import {
  buildValueChunkCommitment, encodeChunkableValueTail, encodePushdataValue,
  sha256, splitValueIntoValueChunks,
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
import type { PreparedAtomicMessageBusCall } from '../../src/message-bus/compose-prepared-invocation.js';
import type { StatefulTransactionBuilder } from '../../src/stateful/StatefulTransactionBuilder.js';
import {
  getEntryNftAddress, getValueChunkAddress,
} from '../../src/stateful/covenant-helpers.js';
import { encodeEntryCommitment, keyToSlot } from '../../src/stateful/SortedList.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true,
  maximumInputBytes: 1_000_000, evmCompat: true, suppressWarnings: true,
} as const;

describe('atomic value-chunk publication across nested builder phases', () => {
  it('publishes the complete value for nonadjacent external appends', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x58), provider);
    for (let index = 0; index < 40; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
      });
    }
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Store() {
        struct Record { bytes payload; }
        mapping(uint => Record[]) records;
        function append(uint key, bytes memory value) public {
          this.records[key].push(Record(value));
          require(true);
        }
        function length(uint key) public view returns (uint) {
          return this.records[key].length;
        }
      }`, KERNEL);
    const base = new Contract(artifact, [], { provider });
    // Entries and chunks bind the master lock, which is the category-pinned contract's.
    const pinned = (categoryId: string): Contract => base.withCategory(hexToBin(categoryId));
    const key = 0n;
    const slot = keyToSlot(bigIntToVmNumber(key));
    const prior = [{ payload: new Uint8Array(150).fill(0x21) }];
    const previous = encodePushdataValue(prior, 'Record[]', artifact.structs);
    const seeded = await setupStatefulUtxos(provider, base, {
      ...artifact.stateLayout!, collections: [],
    }, {}, {
      saltContract: true,
      extraOutputs: (categoryId) => [{
        address: getEntryNftAddress(pinned(categoryId), categoryId, 'records'), satoshis: 10_000n,
        token: { amount: 0n, nft: {
          capability: 'mutable', commitment: binToHex(encodeEntryCommitment(
            new Uint8Array(32), slot, new Uint8Array(64),
          )),
        } },
      }, {
        address: getEntryNftAddress(pinned(categoryId), categoryId, 'records'), satoshis: 10_000n,
        token: { amount: 0n, nft: {
          capability: 'mutable', commitment: binToHex(encodeEntryCommitment(
            slot, new Uint8Array(32), encodeChunkableValueTail(previous),
          )),
        } },
      }, ...splitValueIntoValueChunks(previous).map((chunk, index) => ({
        address: getValueChunkAddress(pinned(categoryId), categoryId, 'records', slot, sha256(previous)),
        satoshis: 10_000n,
        token: { amount: 0n, nft: {
          capability: 'mutable', commitment: buildValueChunkCommitment(index, chunk),
        } },
      }))],
    });
    const store = StatefulContract.withCategory(
      base.withCategory(hexToBin(seeded.categoryId)), seeded.categoryId,
    );
    const callerArtifact = compileString(`pragma solidity ^0.8.0;
      interface IStore {
        function append(uint key, bytes memory value) external;
        function length(uint key) external view returns (uint);
      }
      contract Caller() {
        uint count;
        function initialize() public { this.count = 0; }
        function appendTwice(address store, uint key, bytes memory first, bytes memory second) public {
          IStore(store).append(key, first);
          uint length = IStore(store).length(key);
          IStore(store).append(key, second);
          this.count = length;
          require(true);
        }
      }`, KERNEL);
    const caller = await upgrades.deployProxy(getContractFactory(callerArtifact, signer), []);
    caller.implementation._registerResolvedExternal('IStore', store);
    const first = new Uint8Array(140).fill(0x31);
    const second = new Uint8Array(90).fill(0x42);
    const call = caller.forward('appendTwice', [
      store.inner.lockingBytecode, key, first, second,
    ]);
    // Inspect the stateful preparation boundary used by transparent atomic send(), before .build()
    // materializes the legacy transaction and hides the prepared invocation graph.
    const preparedBuilder = await (call as unknown as {
      _applyOverrides(): Promise<StatefulTransactionBuilder & {
        __preparedAtomicCalls?: readonly PreparedAtomicMessageBusCall[];
      }>;
    })._applyOverrides();
    const preparedCalls = preparedBuilder.__preparedAtomicCalls;
    expect(preparedCalls).toBeDefined();
    const productions = preparedCalls!.flatMap((entry) => entry.valueChunkProductions ?? []);
    const expected = encodePushdataValue([
      ...prior, { payload: first }, { payload: second },
    ], 'Record[]', artifact.structs);
    expect(productions).toHaveLength(1);
    expect(productions[0]!.value).toEqual(expected);

    const writers = preparedCalls!.filter((entry) => entry.functionName === 'append');
    expect(writers).toHaveLength(2);
    expect(writers[0]!.valueChunkProductions ?? []).toHaveLength(0);
    expect(writers[1]!.valueChunkProductions).toHaveLength(1);
    const terminalPath = writers[1]!.producerPath;
    expect(terminalPath?.status).toBe('complete');
    expect(productions[0]!.claim.producer.sourcePath)
      .toEqual(terminalPath?.status === 'complete' ? terminalPath.context.sourcePath : undefined);

    // Authenticated result propagation can change an earlier writer after preparation. All writers
    // must refresh one complete resource value, with only the terminal writer publishing its lane.
    const refreshedFirst = new Uint8Array(170).fill(0x53);
    expect(writers[0]!.resolveValueChunkProductionsFromArgs!([key, refreshedFirst])).toEqual([]);
    const refreshed = writers[1]!.resolveValueChunkProductionsFromArgs!([key, second]);
    expect(refreshed).toHaveLength(1);
    expect(refreshed[0]!.value).toEqual(encodePushdataValue([
      ...prior, { payload: refreshedFirst }, { payload: second },
    ], 'Record[]', artifact.structs));
  }, 180_000);
});
