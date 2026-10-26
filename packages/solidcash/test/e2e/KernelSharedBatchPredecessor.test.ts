import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import { getContractFactory, upgrades } from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { createBareP2pkhFeeFunder } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { messageBusVmAccepts } from '../journal-message-bus/e2e/vm-accepts.js';

/**
 * Two keys of one sorted mapping that fall in the same proof gap share one predecessor. A non-linear batch's
 * verifier reads the predecessor output for every active row, so every row of that proof has to name the single
 * republished predecessor. It used to carry `-1` on the row that does not republish it, and the covenant then read
 * `tx.outputs[-1]` (`Program attempted to read from an invalid transaction output index ... requested index: -1`).
 *
 * The route batches all of the mapping's lanes, so the general verifier runs; a direct call with two rows takes the
 * linear two-lane verifier, which keeps `-1` there. Both cases are exercised: the mapping starts empty in one case
 * and holds an entry whose key is outside the inserted pair's gap in the other.
 */
describe('sorted batch rows sharing one predecessor', () => {
  it.each([false, true])('inserts two keys beside an existing entry (pre-seeded: %s)', async (preseeded) => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface ILedger {
        function append(uint key, uint other) external;
        function label(uint key) external view returns (bytes memory);
      }
      contract Ledger {
        uint64 public initialized;
        mapping(uint => bytes) public labels;
        mapping(uint => bool) public flags;
        event Appended(uint indexed key);
        function initialize() public { this.initialized = 1; }
        function seed(uint key) public { this.flags[key] = true; }
        function append(uint key, uint other) public {
          this.flags[key] = true;
          this.flags[other] = false;
          emit Appended(key);
        }
        function label(uint key) public view returns (bytes memory) { return this.labels[key]; }
      }
      contract Coordinator {
        uint public count;
        function initialize() public { this.count = 0; }
        function run(address ledger, uint key, uint other) public {
          ILedger(ledger).append(key, other);
          require(ILedger(ledger).label(key).length == 0);
          this.count = this.count + 1;
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true, messageBusKernel: true,
      messageBusGraphContext: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
      optimizeForCompilationSpeed: true });
    expect(artifacts.Ledger.messageBus?.handlers.find((handler) => handler.name === 'append'))
      .toMatchObject({ eligible: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6d), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const ledger = await upgrades.deployProxy(getContractFactory(artifacts.Ledger, signer), []);
    const coordinator = await upgrades.deployProxy(getContractFactory(artifacts.Coordinator, signer), []);
    coordinator.implementation._registerResolvedExternal('ILedger', ledger.proxy);
    if (preseeded) await ledger.forward('seed', [9n]).send();
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: coordinator.proxy, executionArtifact: coordinator.implementation.inner.artifact,
          executor: coordinator.implementation, functionName: 'run',
          args: [ledger.proxy.inner.lockingBytecode, 7n, 5n] },
        { contract: ledger.proxy, executionArtifact: ledger.implementation.inner.artifact,
          executor: ledger.implementation, functionName: 'append', args: [7n, 5n], callsiteId: 0 },
        { contract: ledger.proxy, executionArtifact: ledger.implementation.inner.artifact,
          executor: ledger.implementation, functionName: 'label', args: [7n], callsiteId: 1 },
      ],
      funder, changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    expect(messageBusVmAccepts(await composition.build())).toBe(true);
    await composition.send();
    expect(await ledger.proxy.getEntries('flags')).toHaveLength(preseeded ? 3 : 2);
    expect((await coordinator.proxy.getState()).count).toBe(1n);
  }, 180_000);
});
