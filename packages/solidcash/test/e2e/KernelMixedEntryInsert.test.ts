import { binToHex } from '@bitauth/libauth';
import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { isContractUnlocker } from '../../src/interfaces.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { getEntryNftLockingBytecode } from '../../src/stateful/covenant-helpers.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { createBareP2pkhFeeFunder } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { messageBusVmAccepts } from '../journal-message-bus/e2e/vm-accepts.js';

describe('kernel mixed continuation and scalar entry insertion', () => {
  it.each([
    { secondInsert: false, existing: false },
    { secondInsert: true, existing: false },
    { secondInsert: true, existing: true },
  ])('inserts a scalar entry ($secondInsert/$existing)', async ({ secondInsert, existing }) => {
    const provider = createMessageBusCapstoneTestProvider();
    const payload = 'retained record payload '.repeat(16);
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      struct Record { string payload; uint count; }
      struct Stats { uint16 score; uint256 count; }
      struct Note { string text; uint count; }
      interface ILedger { function update(uint key) external; }
      contract Ledger {
        bytes public first;
        bytes public second;
        mapping(uint => Record) public records;
        mapping(uint => Stats) public stats;
        ${secondInsert ? 'mapping(uint => Stats) public extraStats;' : ''}
        mapping(uint => Note[]) public notes;
        function initialize() public { this.first = hex"0102"; this.second = hex"0304"; }
        function seed(uint key, string memory payload) public {
          this.records[key] = Record(payload, 0);
        }
        ${existing ? 'function seedStats(uint key) public { this.stats[key] = Stats(3, 10); }' : ''}
        function update(uint key) public {
          require(this.notes[key].length == 0);
          this.records[key].count += 1;
          Stats storage result = this.stats[key];
          result.score = 7;
          result.count += 1;
          ${secondInsert ? 'this.extraStats[key] = Stats(9, 2);' : ''}
        }
      }
      contract Coordinator {
        uint public count;
        function initialize() public { this.count = 0; }
        function run(address ledger, uint key) public {
          ILedger(ledger).update(key);
          this.count += 1;
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    expect(artifacts.Ledger.stateLayout?.collections?.find((collection) => collection.name === 'stats'))
      .toMatchObject({ sorted: true });
    const signer = new Signer(new Uint8Array(32).fill(0x67), provider);
    for (let index = 0; index < 20; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
      });
    }
    const ledger = await upgrades.deployProxy(getContractFactory(artifacts.Ledger, signer), []);
    const caller = await upgrades.deployProxy(getContractFactory(artifacts.Coordinator, signer), []);
    caller.implementation._registerResolvedExternal('ILedger', ledger.proxy);
    await expect(ledger.forward('seed', [7n, payload]).send()).resolves.toBeDefined();
    if (existing) await expect(ledger.forward('seedStats', [7n]).send()).resolves.toBeDefined();
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: caller.proxy, executionArtifact: caller.implementation.inner.artifact,
          executor: caller.implementation, functionName: 'run', args: [ledger.proxy.inner.lockingBytecode, 7n] },
        { contract: ledger.proxy, executionArtifact: ledger.implementation.inner.artifact,
          executor: ledger.implementation, functionName: 'update', args: [7n], callsiteId: 0 },
      ],
      funder, changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    const assertState = async (): Promise<void> => {
      expect((await ledger.proxy.getEntries('records'))[0].value).toMatchObject({ payload, count: 1n });
      expect((await ledger.proxy.getEntries('stats'))[0].value).toMatchObject({ score: 7n, count: existing ? 11n : 1n });
      if (secondInsert) {
        expect((await ledger.proxy.getEntries('extraStats'))[0].value).toMatchObject({ score: 9n, count: 2n });
      }
      expect((await ledger.proxy.getState()).first).toEqual(Uint8Array.of(1, 2));
      expect((await ledger.proxy.getState()).second).toEqual(Uint8Array.of(3, 4));
    };
    const builder = await composition.build();
    expect(messageBusVmAccepts(builder)).toBe(true);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const inputIndex = builder.inputs.findIndex(({ unlocker }) => isContractUnlocker(unlocker)
      && unlocker.contract.artifact.contractName === 'Ledger');
    expect(inputIndex).toBeGreaterThanOrEqual(0);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    for (const collectionName of ['stats', ...(secondInsert ? ['extraStats'] : [])]) {
      const collection = artifacts.Ledger.stateLayout!.collections!.find((entry) => entry.name === collectionName)!;
      const entryLock = binToHex(getEntryNftLockingBytecode(
        ledger.proxy.inner, ledger.proxy.categoryId, collection.signature,
      ));
      const outputIndex = transaction.outputs.findIndex((output) => binToHex(output.lockingBytecode) === entryLock
        && output.token?.nft && output.token.nft.commitment.slice(0, 32).some((byte) => byte !== 0));
      expect(outputIndex).toBeGreaterThanOrEqual(0);
      for (const mutation of ['lock', 'value'] as const) {
        const forged = structuredClone(transaction);
        if (mutation === 'lock') forged.outputs[outputIndex].lockingBytecode = Uint8Array.of(0x51);
        else forged.outputs[outputIndex].token!.nft!.commitment[64] ^= 1;
        expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction: forged }))).not.toBe(true);
      }
    }
    await composition.send();
    await assertState();
  }, 180_000);
});
