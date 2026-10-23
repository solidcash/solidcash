import { binToHex, hexToBin } from '@bitauth/libauth';
import { buildValueChunkCommitment, encodePushdataValue, splitValueIntoValueChunks } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';

const options = {
  forceStateful: true, messageBus: true, messageBusKernel: true, messageBusGraphContext: true,
  evmCompat: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
} as const;

describe('kernel repeated chunkable whole-entry writes', () => {
  it('threads replacement, an intermediate read, and two updates into one terminal continuation', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Record { string note; uint256 revision; bool settled; }
      contract Store {
        mapping(uint256 => Record) records;
        function replace(uint256 key, string memory note, uint256 revision) public {
          records[key] = Record(note, revision, false);
        }
        function advance(uint256 key) public {
          Record memory current = records[key];
          current.revision = current.revision + 1;
          current.settled = true;
          records[key] = current;
        }
        function configure(uint256 key, uint16[2] calldata counters) public {
          records[key].revision = counters[0] + counters[1];
        }
        function check(uint256 key, string memory note, uint256 revision, bool settled) public view {
          Record memory current = records[key];
          require(current.note == note && current.revision == revision && current.settled == settled);
        }
      }`, options);
    expect(artifact.messageBus?.fixedChunkableWritePolicy?.pooledSelectors).toEqual(
      ['replace', 'advance', 'configure'].map((name) => artifact.abi.find((fn) => fn.name === name)!.selector!).sort(),
    );
    const coordinatorArtifact = compileString(`pragma solidity ^0.8.0;
      interface IStore {
        function replace(uint256 key, string memory note, uint256 revision) external;
        function advance(uint256 key) external;
        function configure(uint256 key, uint16[2] calldata counters) external;
        function check(uint256 key, string memory note, uint256 revision, bool settled) external;
      }
      contract Coordinator {
        function update(address store, uint256 key, string memory note) public {
          IStore(store).replace(key, note, 7);
          IStore(store).configure(key, [uint16(6), uint16(8)]);
          IStore(store).check(key, note, 14, false);
          IStore(store).advance(key);
          IStore(store).advance(key);
        }
      }`, options);
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
    const store = StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    const coordinatorBase = new Contract(coordinatorArtifact, [], { provider });
    const coordinatorSetup = await setupStatefulUtxos(
      provider, coordinatorBase, coordinatorArtifact.stateLayout!, {}, { saltContract: true },
    );
    const coordinator = StatefulContract.withCategory(
      coordinatorBase.withCategory(hexToBin(coordinatorSetup.categoryId)), coordinatorSetup.categoryId,
      { externals: { IStore: store } },
    );
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const note = 'repeated resource mutation '.repeat(8);
    const composition = messageBus.compose({
      calls: [
        coordinator.call.update(store.inner.lockingBytecode, 5n, note),
        store.call.replace(5n, note, 7n),
        store.call.configure(5n, [6n, 8n]),
        store.call.check(5n, note, 14n, false),
        store.call.advance(5n),
        store.call.advance(5n),
      ],
      funder, changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const inputIndex = builder.inputs.findIndex(({ unlocker }) => 'contract' in unlocker
      && unlocker.contract.name === artifact.contractName
      && unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(inputIndex).toBeGreaterThanOrEqual(0);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction }))).toBe(true);
    const chunks = splitValueIntoValueChunks(encodePushdataValue(
      { note, revision: 16n, settled: true }, 'Record', artifact.structs,
    ));
    expect(chunks.length).toBeGreaterThan(1);
    const chunkIndex = chunks.length - 1;
    const expected = buildValueChunkCommitment(chunkIndex, chunks[chunkIndex]);
    const outputIndex = transaction.outputs.findIndex((output) => output.token?.nft
      && binToHex(output.token.nft.commitment) === expected);
    expect(outputIndex).toBeGreaterThanOrEqual(0);
    const staleChunks = splitValueIntoValueChunks(encodePushdataValue(
      { note, revision: 14n, settled: false }, 'Record', artifact.structs,
    ));
    const stale = structuredClone(transaction);
    stale.outputs[outputIndex].token!.nft!.commitment = hexToBin(
      buildValueChunkCommitment(chunkIndex, staleChunks[chunkIndex]),
    );
    expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction: stale }))).not.toBe(true);
    const wrongOwner = structuredClone(transaction);
    wrongOwner.outputs[outputIndex].lockingBytecode = new Uint8Array([0x51]);
    expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction: wrongOwner }))).not.toBe(true);
    await expect(builder.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/u) });
    await expect(store.call.check(5n, note, 16n, true).send()).resolves.toBeDefined();
  }, 180_000);
});
