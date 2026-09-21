import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { ethers } from 'ethers';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract, messageBus } from '../../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const OPTIONS = {
  forceStateful: true,
  messageBus: true,
  maximumInputBytes: 1_000_000,
  solidityImportCompat: true,
  suppressWarnings: true,
} as const;

const PRODUCER = `pragma solidity ^0.8.0;
contract ScalarSource {
  function read(uint seed) public pure returns (uint) {
    return seed + 11;
  }
}`;

const COORDINATOR = `pragma solidity ^0.8.0;
interface IScalarSource { function read(uint seed) external returns (uint); }

contract StoreCoordinator(address source) {
  uint public stored;

  function apply(uint seed) public {
    uint next = IScalarSource(source).read(seed);
    this.stored = next;
    require(true);
  }
}`;

const CHUNKED_COORDINATOR = `pragma solidity ^0.8.0;
interface IScalarSource { function read(uint seed) external returns (uint); }

contract StoreCoordinator(address source) {
  bytes public stored;

  function apply(uint seed) public {
    uint next = IScalarSource(source).read(seed);
    this.stored = abi.encodePacked(next, next, next, next, next, next, next, next);
    require(true);
  }
}`;

const SINK = `pragma solidity ^0.8.0;
struct ForwardedValue { bytes data; uint timestamp; }
contract ScalarSink {
  bytes public received;
  function accept(ForwardedValue memory value) public {
    this.received = value.data;
    require(true);
  }
}`;

const FORWARDING_COORDINATOR = `pragma solidity ^0.8.0;
struct ForwardedValue { bytes data; uint timestamp; }
interface IScalarSource { function read(uint seed) external returns (uint); }
interface IScalarSink { function accept(ForwardedValue memory value) external; }

contract StoreAndForward(address source, address sink) {
  uint public stored;
  function apply(uint seed) public {
    uint next = IScalarSource(source).read(seed);
    this.stored = next;
    IScalarSink(sink).accept(ForwardedValue({data: abi.encodePacked(this.stored), timestamp: 0}));
    require(true);
  }
}`;

/**
 * A caller which keeps an authenticated callee result in its OWN state (rather than only forwarding it as
 * another call's argument) must publish that state under both conventions. The structured forwarding case
 * also checks that a later call can read, pack, and authenticate the field after the write.
 */
describe('result-dependent state write parity', () => {
  it('stores an authenticated producer result in the caller state', async () => {
    await expect(runCase(true)).resolves.toBeUndefined();
  }, 180_000);

  it('stores a discovered producer result with no provisional seed', async () => {
    await expect(runCase(false)).resolves.toBeUndefined();
  }, 180_000);

  it('stores a discovered producer result in a chunkable caller value', async () => {
    await expect(runCase(false, true)).resolves.toBeUndefined();
  }, 180_000);

  it('packs a stored producer result into a later structured graph call', async () => {
    const observations: Array<{ convention: string; stored: bigint; received: string }> = [];
    for (const messageBusKernel of [true, false]) {
      const provider = createMessageBusCapstoneTestProvider();
      const options = { ...OPTIONS, messageBusKernel };
      const sourceArtifact = compileString(PRODUCER, options);
      const sourceBase = new Contract(sourceArtifact, [], { provider });
      const sourceSetup = await setupStatefulUtxos(
        provider, sourceBase, sourceArtifact.stateLayout!, {}, { saltContract: true },
      );
      const source = StatefulContract.withCategory(
        sourceBase.withCategory(hexToBin(sourceSetup.categoryId)), sourceSetup.categoryId,
      );
      const sinkArtifact = compileString(SINK, options);
      const sinkBase = new Contract(sinkArtifact, [], { provider });
      const sinkSetup = await setupStatefulUtxos(
        provider, sinkBase, sinkArtifact.stateLayout!, {}, { saltContract: true },
      );
      const sink = StatefulContract.withCategory(
        sinkBase.withCategory(hexToBin(sinkSetup.categoryId)), sinkSetup.categoryId,
      );
      const coordinatorArtifact = compileString(FORWARDING_COORDINATOR, options);
      expect(coordinatorArtifact.messageBus?.convention)
        .toBe(messageBusKernel ? 'kernel-row-loop' : 'legacy-unroll');
      const coordinatorBase = new Contract(
        coordinatorArtifact, [source.inner.lockingBytecode, sink.inner.lockingBytecode], { provider },
      );
      const coordinatorSetup = await setupStatefulUtxos(
        provider, coordinatorBase, coordinatorArtifact.stateLayout!, { stored: 0n }, { saltContract: true },
      );
      const coordinator = StatefulContract.withCategory(
        coordinatorBase.withCategory(hexToBin(coordinatorSetup.categoryId)), coordinatorSetup.categoryId,
        { externals: { IScalarSource: source, IScalarSink: sink } },
      );
      const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
      const call = messageBus.compose({
        preparedCalls: [
          { contract: coordinator, functionName: 'apply', args: [5n] },
          { contract: source, functionName: 'read', args: [5n], callsiteId: 0 },
          { contract: sink, functionName: 'accept', args: [{
            data: hexToBin(ethers.solidityPacked(['uint256'], [16n]).slice(2)), timestamp: 0n,
          }], callsiteId: 1 },
        ],
        funder,
        changeAddress: funder.unlocker.generateLockingBytecode(),
      });
      const builder = await call.build();
      const transaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      const vm = createVirtualMachineBch2026ForProvider(provider);
      for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
        expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
          `${coordinatorArtifact.messageBus?.convention} input ${inputIndex}`).toBe(true);
      }
      await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
      observations.push({
        convention: coordinatorArtifact.messageBus?.convention ?? 'unknown',
        stored: (await coordinator.getState()).stored as bigint,
        received: binToHex((await sink.getState()).received as Uint8Array),
      });
    }
    expect(observations).toEqual([
      { convention: 'kernel-row-loop', stored: 16n, received: `${'00'.repeat(31)}10` },
      { convention: 'legacy-unroll', stored: 16n, received: `${'00'.repeat(31)}10` },
    ]);
  }, 180_000);
});

const runCase = async (seedProvisionalResult: boolean, chunked = false): Promise<void> => {
    const observations: Array<{ convention: string; stored: string }> = [];
    for (const messageBusKernel of [true, false]) {
      const provider = createMessageBusCapstoneTestProvider();
      const compileOptions = { ...OPTIONS, messageBusKernel };
      const producerArtifact = compileString(PRODUCER, compileOptions);
      const producerBase = new Contract(producerArtifact, [], { provider });
      const producerSetup = await setupStatefulUtxos(
        provider, producerBase, producerArtifact.stateLayout!, {}, { saltContract: true },
      );
      const producer = StatefulContract.withCategory(
        producerBase.withCategory(hexToBin(producerSetup.categoryId)), producerSetup.categoryId,
      );
      const coordinatorArtifact = compileString(chunked ? CHUNKED_COORDINATOR : COORDINATOR, compileOptions);
      expect(coordinatorArtifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
        .toMatchObject({ eligible: true });
      const coordinatorBase = new Contract(
        coordinatorArtifact, [producer.inner.lockingBytecode], { provider },
      );
      const coordinatorSetup = await setupStatefulUtxos(
        provider, coordinatorBase, coordinatorArtifact.stateLayout!,
        chunked ? {} : { stored: 0n }, { saltContract: true },
      );
      const coordinator = StatefulContract.withCategory(
        coordinatorBase.withCategory(hexToBin(coordinatorSetup.categoryId)), coordinatorSetup.categoryId,
        { externals: { IScalarSource: producer } },
      );
      const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
      const result = hexToBin(ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [16n]).slice(2));
      const call = messageBus.compose({
        preparedCalls: [
          { contract: coordinator, functionName: 'apply', args: [5n] },
          {
            contract: producer, functionName: 'read', args: [5n], callsiteId: 0,
            ...(seedProvisionalResult && { provisionalResultCommitment: result }),
          },
        ],
        funder,
        changeAddress: funder.unlocker.generateLockingBytecode(),
      });
      const builder = await call.build();
      const transaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      const vm = createVirtualMachineBch2026ForProvider(provider);
      for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
        expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
          `${coordinatorArtifact.messageBus?.convention} input ${inputIndex}`).toBe(true);
      }
      await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
      const state = await coordinator.getState();
      const raw = state.stored;
      const storedHex = typeof raw === 'string'
        ? raw.replace(/^0x/, '')
        : typeof raw === 'bigint' ? raw.toString(16) : binToHex(raw as Uint8Array);
      if (chunked) {
        // 8 packed 32-byte words carrying the produced value, i.e. a chunkable (> 60 B) caller state write.
        expect(storedHex.length).toBe(512);
        expect(storedHex).toContain(`${'00'.repeat(31)}10`);
      }
      observations.push({
        convention: coordinatorArtifact.messageBus?.convention ?? 'unknown',
        stored: storedHex,
      });
    }
    expect(observations).toEqual(chunked
      ? [
        { convention: 'kernel-row-loop', stored: `${'00'.repeat(31)}10`.repeat(8) },
        { convention: 'legacy-unroll', stored: `${'00'.repeat(31)}10`.repeat(8) },
      ]
      : [
        { convention: 'kernel-row-loop', stored: '10' },
        { convention: 'legacy-unroll', stored: '10' },
      ]);
};
