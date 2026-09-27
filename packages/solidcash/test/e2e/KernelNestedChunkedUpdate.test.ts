import { hexToBin } from '@bitauth/libauth';
import { compileStringMulti } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Signer, getContractFactory, messageBus, upgrades } from '../../src/index.js';
import { isContractUnlocker } from '../../src/interfaces.js';
import { createBareP2pkhFeeFunder } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { messageBusVmAccepts } from '../journal-message-bus/e2e/vm-accepts.js';

describe('kernel participant-local identity and chunked updates', () => {
  it('persists both fixed-array and scalar updates after authenticating the public self identity', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const note = 'preserved record payload '.repeat(12);
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      struct Record { string note; int16[2] consensus; uint claimed; }
      interface IStore { function release(uint key) external; }
      contract Store {
        mapping(uint => Record) records;
        event Completed(uint key, Record record);
        function seed(uint key, Record memory value) public {
          records[key] = value;
        }
        function release(uint key) public {
          require(address(this) != address(0));
          Record memory current = records[key];
          current.consensus[0] = absolute(current.consensus[0]) + 1;
          current.consensus[1] = absolute(current.consensus[1]);
          records[key].consensus = current.consensus;
          records[key].claimed = 1;
          emit Completed(key, current);
        }
        function absolute(int16 value) internal pure returns (int16) { return value < 0 ? -value : value; }
        function check(uint key) public view {
          Record memory current = records[key];
          require(current.note == "${note}" && current.consensus[0] == 1
            && current.consensus[1] == 1 && current.claimed == 1);
        }
      }
      contract Coordinator {
        uint public count;
        function initialize() public { this.count = 0; }
        function run(address store, uint key) public {
          IStore(store).release(key);
          this.count = this.count + 1;
        }
      }`, { forceStateful: true, solidityImportCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
      optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const signer = new Signer(new Uint8Array(32).fill(0x76), provider);
    for (let index = 0; index < 20; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
      });
    }
    const store = await getContractFactory(artifacts.Store, signer).deploy();
    const coordinator = await upgrades.deployProxy(getContractFactory(artifacts.Coordinator, signer), []);
    coordinator.implementation._registerResolvedExternal('IStore', store);
    await store.call.seed(7n, [note, [0n, 1n], 0n]).send();
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: coordinator.proxy, executionArtifact: coordinator.implementation.inner.artifact,
          executor: coordinator.implementation, functionName: 'run',
          args: [store.inner.lockingBytecode, 7n] },
        { contract: store, functionName: 'release', args: [7n], callsiteId: 0 },
      ],
      funder, changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    expect(messageBusVmAccepts(builder)).toBe(true);
    const storeIndex = builder.inputs.findIndex((input) => isContractUnlocker(input.unlocker)
      && input.unlocker.contract.artifact.contractName === 'Store');
    expect(storeIndex).toBeGreaterThan(0);
    const original = builder.inputs[storeIndex].unlocker;
    if (!isContractUnlocker(original)) throw new Error('Missing store route');
    const anchorIndex = original.abiFunction.inputs.findIndex(
      (input) => input.name === '__internal__graphSelfIdentityInput',
    );
    expect(anchorIndex).toBeGreaterThanOrEqual(0);
    const absolute = original.params[anchorIndex] as bigint;
    expect(absolute).toBeGreaterThan(BigInt(storeIndex));
    // A local coordinate must never leak into the final aggregate transaction.
    const forged = [...original.params];
    forged[anchorIndex] = absolute - BigInt(storeIndex);
    builder.inputs[storeIndex].unlocker = original.contract.createCompilerRouteUnlocker(
      original.abiFunction, hexToBin(original.abiFunction.selector!),
    )(...forged);
    expect(messageBusVmAccepts(builder)).toBe(false);
    builder.inputs[storeIndex].unlocker = original;
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/u) });
    await expect(store.call.check(7n).send()).resolves.toBeDefined();
  }, 180_000);
});
