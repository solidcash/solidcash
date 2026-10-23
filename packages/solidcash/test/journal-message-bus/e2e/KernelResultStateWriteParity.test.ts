import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { ethers } from 'ethers';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const OPTIONS = {
  forceStateful: true,
  messageBus: true,
  maximumInputBytes: 1_000_000,
  evmCompat: true,
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

/**
 * A caller which keeps an authenticated callee result in its OWN state (rather than only forwarding it as
 * another call's argument) must publish that state under both conventions. The forwarding case is covered by
 * KernelMultiResultGraphParity; this is the store-only case, which is the shape the marketplace `take job`
 * graph needs for `jobs[jobId].escrowId`.
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
