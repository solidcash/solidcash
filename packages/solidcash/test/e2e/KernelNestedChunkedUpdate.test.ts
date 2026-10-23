import { hexToBin } from '@bitauth/libauth';
import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { isContractUnlocker } from '../../src/interfaces.js';
import { createBareP2pkhFeeFunder } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { messageBusVmAccepts } from '../journal-message-bus/e2e/vm-accepts.js';

describe('kernel participant-local identity and chunked updates', () => {
  it.each([[false, false], [true, false], [true, true]])(
    'persists both fixed-array and scalar updates (dynamic proxy: %s, separate handlers: %s)',
    async (proxied, separateHandlers) => {
      const provider = createMessageBusCapstoneTestProvider();
      const note = 'preserved record payload '.repeat(12);
      const banner = 'preserved dynamic state '.repeat(8);
      // An event is one NFT commitment (<= 128 bytes, never split), so it cannot carry the 300-byte record.
      const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      struct Record { string note; int16[2] consensus; uint claimed; }
      interface IStore { function release(uint key) external; }
      interface IClaim { function claim(uint key) external; }
      contract Store {
        ${proxied ? 'string public banner;' : ''}
        mapping(uint => Record) records;
        event Completed(uint key);
        ${proxied ? 'function initialize() public { this.banner = ""; }' : ''}
        function seed(uint key, Record memory value) public {
          this.records[key] = value;
          ${proxied ? `this.banner = "${banner}";` : ''}
        }
        function release(uint key) public {
          ${proxied ? `require(this.banner == "${banner}");` : ''}
          require(address(this) != address(0));
          Record memory current = this.records[key];
          current.consensus[0] = absolute(current.consensus[0]) + 1;
          current.consensus[1] = absolute(current.consensus[1]);
          this.records[key].consensus = current.consensus;
          ${separateHandlers ? '' : 'this.records[key].claimed = 1;'}
          emit Completed(key);
        }
        function claim(uint otherKey) public { this.records[otherKey].claimed = 1; }
        function absolute(int16 value) internal pure returns (int16) { return value < 0 ? -value : value; }
        function check(uint key) public view {
          Record memory current = this.records[key];
          require(current.note == "${note}" && current.consensus[0] == 1
            && current.consensus[1] == 1 && current.claimed == 1);
        }
      }
      contract Coordinator {
        uint public count;
        function initialize() public { this.count = 0; }
        function run(address store, uint key) public {
          IStore(store).release(key);
          ${separateHandlers ? 'IClaim(store).claim(key);' : ''}
          this.count = this.count + 1;
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
        messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
        optimizeForCompilationSpeed: true, sortedMappingsAll: false });
      const signer = new Signer(new Uint8Array(32).fill(0x76), provider);
      for (let index = 0; index < 20; index += 1) {
        await provider.addUtxo(signer.getAddress(), {
          txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
        });
      }
      const storeFactory = getContractFactory(artifacts.Store, signer);
      const proxyStore = proxied ? await upgrades.deployProxy(storeFactory, []) : undefined;
      const store = proxyStore?.proxy ?? await storeFactory.deploy();
      const coordinator = await upgrades.deployProxy(getContractFactory(artifacts.Coordinator, signer), []);
      coordinator.implementation._registerResolvedExternal('IStore', store);
      coordinator.implementation._registerResolvedExternal('IClaim', store);
      const seedArgs = [7n, [note, [0n, 1n], 0n]];
      await (proxyStore ? proxyStore.forward('seed', seedArgs) : store.call.seed(...seedArgs)).send();
      const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
      const composition = messageBus.compose({
        preparedCalls: [
          { contract: coordinator.proxy, executionArtifact: coordinator.implementation.inner.artifact,
            executor: coordinator.implementation, functionName: 'run',
            args: [store.inner.lockingBytecode, 7n] },
          { contract: store, functionName: 'release', args: [7n], callsiteId: 0,
            ...(proxyStore && { executionArtifact: proxyStore.implementation.inner.artifact,
              executor: proxyStore.implementation }) },
          ...(separateHandlers ? [{ contract: store, functionName: 'claim', args: [7n],
            callsiteId: 1,
            ...(proxyStore && { executionArtifact: proxyStore.implementation.inner.artifact,
              executor: proxyStore.implementation }) }] : []),
        ],
        funder, changeAddress: funder.unlocker.generateLockingBytecode(),
      });
      const builder = await composition.build();
      expect(messageBusVmAccepts(builder)).toBe(true);
      const storeIndex = builder.inputs.findIndex((input) => input.token?.category === store.categoryId
      && input.token.nft?.capability === 'minting');
      expect(storeIndex).toBeGreaterThan(0);
      const executorIndex = proxyStore ? builder.inputs.findIndex((input) => isContractUnlocker(input.unlocker)
      && input.unlocker.contract.artifact.contractName === 'Store') : storeIndex;
      const original = builder.inputs[executorIndex].unlocker;
      if (!isContractUnlocker(original)) throw new Error('Missing store route');
      for (const witness of [
        '__internal__graphSelfIdentityInput',
        ...(proxied ? ['__internal__dynamicChunkInputBase'] : []),
      ]) {
        const position = original.abiFunction.inputs.findIndex((input) => input.name === witness);
        expect(position).toBeGreaterThanOrEqual(0);
        const published = original.params[position] as bigint;
        // A batch selecting no dynamic writer publishes the chunk base read-only, tagged as -(base + 3).
        const readOnly = witness === '__internal__dynamicChunkInputBase' && published < -2n;
        const absolute = readOnly ? -published - 3n : published;
        expect(absolute).toBeGreaterThan(BigInt(storeIndex));
        // A local coordinate must never leak into the final aggregate transaction.
        const local = absolute - BigInt(storeIndex);
        const forged = [...original.params];
        forged[position] = readOnly ? -local - 3n : local;
        builder.inputs[executorIndex].unlocker = original.contract.createCompilerRouteUnlocker(
          original.abiFunction, hexToBin(original.abiFunction.selector!),
        )(...forged);
        expect(messageBusVmAccepts(builder)).toBe(false);
        builder.inputs[executorIndex].unlocker = original;
      }
      await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/u) });
      expect((await store.getEntries('records'))[0].value).toMatchObject({
        note, consensus: [1n, 1n], claimed: 1n,
      });
      if (proxied) expect((await store.getState()).banner).toBe(banner);
      else await expect(store.call.check(7n).send()).resolves.toBeDefined();
    }, 180_000,
  );
});
