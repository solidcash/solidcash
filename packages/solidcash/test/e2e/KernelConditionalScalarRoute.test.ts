import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import { getContractFactory, upgrades } from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { createBareP2pkhFeeFunder } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { messageBusVmAccepts } from '../journal-message-bus/e2e/vm-accepts.js';

/**
 * A scalar state write that only one branch performs, beside a mapping row and an event in the same arm. The
 * kernel journal used to refuse this shape by name (`conditional-scalar-collection-event-settlement`,
 * `KERNEL_LAYOUT`); the fixed entry/effect frame does settle it, so route admission keeps the handler and the
 * covenant must show the scalar updated on the arm's path and unchanged off it.
 *
 * `append` writes `flags[key]` (a row), `appends` (the scalar) and `Appended` (the event) inside `if (key > 0)`.
 * The unchecked case (`key == 0`) proves the frame publishes the scalar's pre-state rather than a placeholder.
 */
describe('kernel route with a branch-selected scalar write', () => {
  it.each([{ key: 7n, expected: 1n }, { key: 0n, expected: 0n }])(
    'settles the scalar and the row for key $key', async ({ key, expected }) => {
      const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface ILedger {
        function append(uint key, bytes memory message) external;
        function label(uint key) external view returns (bytes memory);
      }
      contract Ledger {
        address public controller;
        uint64 public initialized;
        address public owner;
        bool public paused;
        uint public appends;
        mapping(uint => bytes[]) public messages;
        mapping(uint => bytes) public labels;
        mapping(uint => bool) public flags;
        event Appended(uint indexed key);
        function initialize() public { this.initialized = 1; this.owner = msg.sender; }
        function setController(address value) public { this.controller = value; }
        function setPaused(bool value) public { this.paused = value; }
        function append(uint key, bytes memory message) public {
          this.messages[key].push(message);
          if (key > 0) {
            this.flags[key] = true;
            appends = appends + 1;
            emit Appended(key);
          }
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
        suppressWarnings: true, optimizeForCompilationSpeed: true });
      // Admission is the first half of the claim: the handler keeps its route (before the fix it was refused as
      // `conditional-scalar-collection-event-settlement` and the compose below threw "not batch eligible").
      expect(artifacts.Ledger.messageBus?.handlers.find((handler) => handler.name === 'append'))
        .toMatchObject({ eligible: true });
      const provider = createMessageBusCapstoneTestProvider();
      const signer = new Signer(new Uint8Array(32).fill(0x6d), provider);
      for (let index = 0; index < 16; index += 1) await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
      });
      const ledger = await upgrades.deployProxy(getContractFactory(artifacts.Ledger, signer), []);
      const coordinator = await upgrades.deployProxy(getContractFactory(artifacts.Coordinator, signer), []);
      coordinator.implementation._registerResolvedExternal('ILedger', ledger.proxy);
      const message = new Uint8Array(160).fill(0x42);
      const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
      const composition = messageBus.compose({
        preparedCalls: [
          { contract: coordinator.proxy, executionArtifact: coordinator.implementation.inner.artifact,
            executor: coordinator.implementation, functionName: 'run',
            args: [ledger.proxy.inner.lockingBytecode, key, message] },
          { contract: ledger.proxy, executionArtifact: ledger.implementation.inner.artifact,
            executor: ledger.implementation, functionName: 'append', args: [key, message], callsiteId: 0 },
          { contract: ledger.proxy, executionArtifact: ledger.implementation.inner.artifact,
            executor: ledger.implementation, functionName: 'label', args: [key], callsiteId: 1 },
        ],
        funder, changeAddress: funder.unlocker.generateLockingBytecode(),
      });
      expect(messageBusVmAccepts(await composition.build())).toBe(true);
      await composition.send();
      const after = await ledger.proxy.getState();
      expect((after as { appends: bigint }).appends).toBe(expected);
      expect(await ledger.proxy.getEntries('flags')).toHaveLength(key > 0n ? 1 : 0);
      expect((await coordinator.proxy.getState()).count).toBe(1n);
    }, 180_000);
});
