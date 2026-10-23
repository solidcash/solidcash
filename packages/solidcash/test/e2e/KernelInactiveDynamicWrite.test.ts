import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { createBareP2pkhFeeFunder } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { messageBusVmAccepts } from '../journal-message-bus/e2e/vm-accepts.js';

describe('kernel inactive dynamic writes beside mapping appends', () => {
  it.each([
    { populated: false, optimizeForCompilationSpeed: true },
    { populated: true, optimizeForCompilationSpeed: true },
    { populated: false, optimizeForCompilationSpeed: false },
    { populated: true, optimizeForCompilationSpeed: false },
  ])('does not materialize an empty sibling chunk (%j)', async ({ populated, optimizeForCompilationSpeed }) => {
    // An event is one NFT commitment (<= 128 bytes, never split), so it carries the key, not the 160-byte message.
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface ILedger {
        function append(uint key, bytes memory message) external;
        function label(uint key) external view returns (bytes memory);
      }
      contract Ledger {
        address public controller;
        address[] public members;
        address[] public observers;
        uint64 public initialized;
        bool public initializing;
        address public owner;
        bool public paused;
        mapping(uint => bytes[]) public messages;
        mapping(uint => bytes) public labels;
        mapping(address => bytes) public profiles;
        mapping(address => bytes) public observerProfiles;
        event Appended(uint indexed key);
        function initialize() public { this.initialized = 1; this.owner = msg.sender; }
        function setController(address value) public { this.controller = value; }
        function setPaused(bool value) public { this.paused = value; }
        function addMember(address value) public {
          this.profiles[value] = hex"ab";
          this.members.push(value);
        }
        function addObserver(address value) public {
          this.observerProfiles[value] = hex"cd";
          this.observers.push(value);
        }
        function append(uint key, bytes memory message) public {
          this.messages[key].push(message);
          emit Appended(key);
        }
        function label(uint key) public view returns (bytes memory) { return this.labels[key]; }
      }
      contract Coordinator {
        uint public count;
        function initialize() public { this.count = 0; }
        function run(address ledger, uint key, bytes memory message) public {
          ILedger(ledger).append(key, message);
          require(ILedger(ledger).label(key).length == 0);
          this.count += 1;
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed });
    expect(artifacts.Ledger.delegateArtifact!.messageBus?.handlers.find((handler) => handler.name === 'append'))
      .toMatchObject({ dynamicWrites: [] });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6c), provider);
    for (let index = 0; index < 16; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const ledger = await upgrades.deployProxy(getContractFactory(artifacts.Ledger, signer), []);
    const coordinator = await upgrades.deployProxy(getContractFactory(artifacts.Coordinator, signer), []);
    coordinator.implementation._registerResolvedExternal('ILedger', ledger.proxy);
    if (populated) await ledger.forward('addMember', [signer.getAddress()]).send();
    const before = await ledger.proxy.getFullState();
    const message = new Uint8Array(160).fill(0x42);
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: coordinator.proxy, executionArtifact: coordinator.implementation.inner.artifact,
          executor: coordinator.implementation, functionName: 'run',
          args: [ledger.proxy.inner.lockingBytecode, 7n, message] },
        { contract: ledger.proxy, executionArtifact: ledger.implementation.inner.artifact,
          executor: ledger.implementation, functionName: 'append', args: [7n, message], callsiteId: 0 },
        { contract: ledger.proxy, executionArtifact: ledger.implementation.inner.artifact,
          executor: ledger.implementation, functionName: 'label', args: [7n], callsiteId: 1 },
      ],
      funder, changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    expect(messageBusVmAccepts(await composition.build())).toBe(true);
    await composition.send();
    const after = await ledger.proxy.getFullState();
    expect(after.state.members).toEqual(before.state.members);
    expect(after.state.observers).toEqual([]);
    expect(after.dynamicChunkUtxos?.observers ?? []).toHaveLength(0);
    expect(after.dynamicChunkUtxos?.members ?? []).toHaveLength(populated ? 1 : 0);
    expect((await ledger.proxy.getEntries('messages'))[0].value).toEqual([message]);
    expect((await coordinator.proxy.getState()).count).toBe(1n);
  }, 180_000);
});
