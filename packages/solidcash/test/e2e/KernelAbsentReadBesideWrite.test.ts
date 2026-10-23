import { binToHex } from '@bitauth/libauth';
import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { getEntryNftLockingBytecode } from '../../src/stateful/covenant-helpers.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { createBareP2pkhFeeFunder } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { messageBusVmAccepts } from '../journal-message-bus/e2e/vm-accepts.js';

describe('kernel absent sorted reads beside writes', () => {
  it.each([
    { populated: false, optimizeForCompilationSpeed: true },
    { populated: true, optimizeForCompilationSpeed: true },
    { populated: false, optimizeForCompilationSpeed: false },
    { populated: true, optimizeForCompilationSpeed: false },
  ])('preserves an absent profile while appending a different collection (%j)', async ({
    populated, optimizeForCompilationSpeed,
  }) => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      struct Profile { uint16 fee; string label; }
      interface ILedger {
        function fee(address key) external view returns (uint);
        function append(uint key, bytes memory value) external;
      }
      contract Ledger {
        uint public count;
        address[] public members;
        mapping(address => Profile) public profiles;
        mapping(uint => bytes[]) public messages;
        function initialize() public { this.count = 0; }
        function register() public {
          this.profiles[msg.sender] = Profile(7, "member");
          this.members.push(msg.sender);
        }
        function update(address key, uint16 nextFee) public { this.profiles[key].fee = nextFee; }
        function fee(address key) public view returns (uint) { return uint(this.profiles[key].fee); }
        function append(uint key, bytes memory value) public { this.messages[key].push(value); }
      }
      contract Coordinator {
        uint public count;
        function initialize() public { this.count = 0; }
        function run(address ledger, uint key, bytes memory value) public {
          require(ILedger(ledger).fee(address(0)) == 0);
          ILedger(ledger).append(key, value);
          this.count += 1;
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed, sortedMappingsAll: false });
    // The route is the union of the fixed sorted writes: profile writers occupy 0-7 and the
    // messages append occupies 8-9. The absent profile read is not one of those writes.
    expect(artifacts.Ledger.delegateArtifact!.messageBus!.route.sortedBatchInfo).toEqual([
      { collection: 'profiles', slotIndices: [0, 1, 2, 3, 4, 5, 6, 7] },
      { collection: 'messages', slotIndices: [8, 9] },
    ]);
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6d), provider);
    for (let index = 0; index < 16; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const ledger = await upgrades.deployProxy(getContractFactory(artifacts.Ledger, signer), []);
    const coordinator = await upgrades.deployProxy(getContractFactory(artifacts.Coordinator, signer), []);
    coordinator.implementation._registerResolvedExternal('ILedger', ledger.proxy);
    if (populated) await ledger.forward('update', [signer.getAddress(), 7n]).send();
    const beforeProfiles = await ledger.proxy.getEntries('profiles');
    const beforeMembers = (await ledger.proxy.getFullState()).state.members;
    const value = new Uint8Array(160).fill(0x42);
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: coordinator.proxy, executionArtifact: coordinator.implementation.inner.artifact,
          executor: coordinator.implementation, functionName: 'run',
          args: [ledger.proxy.inner.lockingBytecode, 7n, value] },
        { contract: ledger.proxy, executionArtifact: ledger.implementation.inner.artifact,
          executor: ledger.implementation, functionName: 'fee', args: [new Uint8Array(20)], callsiteId: 0 },
        { contract: ledger.proxy, executionArtifact: ledger.implementation.inner.artifact,
          executor: ledger.implementation, functionName: 'append', args: [7n, value], callsiteId: 1 },
      ],
      funder, changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    expect(messageBusVmAccepts(builder)).toBe(true);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const profileCollection = artifacts.Ledger.stateLayout!.collections!.find((entry) => entry.name === 'profiles')!;
    const profileLock = binToHex(getEntryNftLockingBytecode(
      ledger.proxy.inner, ledger.proxy.categoryId, profileCollection.signature,
    ));
    const proofOutput = transaction.outputs.findIndex((output) => binToHex(output.lockingBytecode) === profileLock);
    expect(proofOutput).toBeGreaterThanOrEqual(0);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    for (const mutation of ['lock', 'next'] as const) {
      const forged = structuredClone(transaction);
      if (mutation === 'lock') forged.outputs[proofOutput].lockingBytecode = Uint8Array.of(0x51);
      else forged.outputs[proofOutput].token!.nft!.commitment[32] ^= 1;
      expect(forged.inputs.every((_input, inputIndex) => vm.stateSuccess(
        vm.evaluate({ inputIndex, sourceOutputs, transaction: forged }),
      ) === true)).toBe(false);
    }
    await composition.send();
    expect(await ledger.proxy.getEntries('profiles')).toEqual(beforeProfiles);
    expect((await ledger.proxy.getFullState()).state.members).toEqual(beforeMembers);
    expect((await ledger.proxy.getEntries('messages'))[0].value).toEqual([value]);
    expect((await coordinator.proxy.getState()).count).toBe(1n);
  }, 180_000);
});
