import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

describe('kernel returned struct mutation', () => {
  it.each([
    { replace: true, optimizeForCompilationSpeed: true },
    { replace: false, optimizeForCompilationSpeed: true },
    { replace: true, optimizeForCompilationSpeed: false },
    { replace: false, optimizeForCompilationSpeed: false },
  ])('passes updated arrays to a later call (%j)', async ({ replace, optimizeForCompilationSpeed }) => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      struct Record { uint16[2] weights; int8[2] votes; uint64 revision; }
      interface IStore {
        function read(uint key) external view returns (Record memory);
        function save(uint key, uint16[2] memory weights, int8[2] memory votes, uint64 revision) external;
      }
      contract Store {
        mapping(uint => Record) public records;
        function seed(uint key) public { this.records[key] = Record([0, 100], [0, 1], 9); }
        function read(uint key) public view returns (Record memory) { return this.records[key]; }
        function save(uint key, uint16[2] memory weights, int8[2] memory votes, uint64 revision) public {
          this.records[key] = Record(weights, votes, revision);
        }
      }
      contract Editor {
        uint constant FIRST = 0;
        uint constant SECOND = 1;
        uint public count;
        function initialize() public { this.count = 0; }
        function edit(address store, uint key, bool replace, uint16[2] memory next) public {
          Record memory record = IStore(store).read(key);
          if (replace) {
            record.weights[FIRST] = next[FIRST];
            record.weights[SECOND] = next[SECOND];
            record.votes[0] = record.votes[0] + 1;
            record.votes[1] = -record.votes[1];
          } else {
            record.weights[1] = 75;
            record.votes[1] = record.votes[1] + 1;
          }
          record.revision = record.revision + 1;
          IStore(store).save(key, record.weights, record.votes, record.revision);
          this.count += 1;
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed, sortedMappingsAll: false });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6e), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const store = await getContractFactory(artifacts.Store, signer).deploy();
    const editor = await upgrades.deployProxy(getContractFactory(artifacts.Editor, signer), []);
    editor.implementation._registerResolvedExternal('IStore', store);
    await store.call.seed(7n).send();
    await editor.forward('edit', [store.inner.lockingBytecode, 7n, replace, [80n, 20n]]).send();
    expect((await store.getEntries('records'))[0].value).toEqual({
      weights: replace ? [80n, 20n] : [0n, 75n],
      votes: replace ? [1n, -1n] : [0n, 2n],
      revision: 10n,
    });
    expect((await editor.proxy.getState()).count).toBe(1n);
  }, 180_000);
});
