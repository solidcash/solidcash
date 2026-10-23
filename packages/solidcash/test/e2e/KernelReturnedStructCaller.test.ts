import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

describe('kernel returned struct caller context', () => {
  it.each([true, false])('uses the contract caller instead of the signer (caller owns record: %s)', async (ownerIsCaller) => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      struct Record { address owner; uint16[2] weights; }
      interface IStore {
        function read(uint key) external view returns (Record memory);
        function save(uint key, uint16[2] memory weights) external;
      }
      interface IEditor { function edit(uint key) external; }
      contract Store {
        mapping(uint => Record) public records;
        function seed(uint key, address owner) public { this.records[key] = Record(owner, [0, 100]); }
        function read(uint key) public view returns (Record memory) { return this.records[key]; }
        function save(uint key, uint16[2] memory weights) public { this.records[key].weights = weights; }
      }
      contract Editor(address store) {
        uint public count;
        function edit(uint key) public {
          Record memory record = IStore(store).read(key);
          if (msg.sender == record.owner) {
            record.weights[0] = 100;
            record.weights[1] = 0;
          }
          IStore(store).save(key, record.weights);
          this.count += 1;
        }
      }
      contract Caller {
        uint public count;
        function initialize() public { this.count = 0; }
        function run(address editor, uint key) public {
          IEditor(editor).edit(key);
          this.count += 1;
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6f), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const store = await getContractFactory(artifacts.Store, signer).deploy();
    const editor = await getContractFactory(artifacts.Editor, signer).deploy(store.inner.address);
    const caller = await upgrades.deployProxy(getContractFactory(artifacts.Caller, signer), []);
    editor._registerResolvedExternal('IStore', store);
    caller.implementation._registerResolvedExternal('IEditor', editor);
    await store.call.seed(7n, ownerIsCaller ? await caller.getAddress() : signer.getAddress()).send();
    const expected = ownerIsCaller ? [100n, 0n] : [0n, 100n];
    const call = caller.forward('run', [editor.inner.lockingBytecode, 7n]);
    const prepared = await (call as unknown as {
      _applyOverrides(): Promise<{ __preparedAtomicCalls?: readonly { functionName: string; args: unknown[] }[] }>;
    })._applyOverrides();
    expect(prepared.__preparedAtomicCalls?.find((entry) => entry.functionName === 'save')?.args)
      .toEqual([7n, expected]);
    await call.send();
    expect(((await store.getEntries('records'))[0].value as { weights: bigint[] }).weights).toEqual(expected);
    expect((await editor.getState()).count).toBe(1n);
    expect((await caller.proxy.getState()).count).toBe(1n);
  }, 180_000);
});
