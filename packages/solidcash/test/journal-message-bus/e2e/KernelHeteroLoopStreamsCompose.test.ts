import { bigIntToVmNumber, binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

const vmAccepts = (builder: TransactionBuilder): boolean => {
  try {
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(builder.provider);
    return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
      vm.evaluate({ inputIndex, sourceOutputs, transaction }),
    ) === true);
  } catch {
    return false;
  }
};

const slotHex = (key: bigint): string => binToHex(keyToSlotMulti([bigIntToVmNumber(key)]));

describe('kernel heterogeneous loop streams under composition', () => {
  it('settles int+bytes writeBoth via messageBus.compose (n>=2, inline and ≥61B) and long chunks via batch', async () => {
    const provider = createMessageBusCapstoneTestProvider();

    const storeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        mapping(int => int) scores;
        mapping(int => bytes) payloads;
        function writeBoth(int n, bytes payload) public {
          for (int i = 0; i < n; i = i + 1) {
            scores[i] = i + 10;
            payloads[i] = payload;
          }
          require(true);
        }
      }`, KERNEL);
    const writeBoth = storeArtifact.abi.find((candidate) => candidate.name === 'writeBoth')!;
    expect(storeArtifact.messageBus?.handlers.find((handler) => handler.name === 'writeBoth'))
      .toMatchObject({ eligible: true });
    expect(storeArtifact.stateLayout?.collections?.find((collection) => collection.name === 'payloads'))
      .toMatchObject({ chunkableValue: true });
    expect(writeBoth.sortedUpsertLoopInfo).toEqual([
      expect.objectContaining({
        collection: 'scores', journalAccessStreamIndex: 0, journalExecutionGroup: 0, op: 'set',
        valueRuntimeExpression: true, valueArrayOffset: '10',
      }),
      expect.objectContaining({
        collection: 'payloads', journalAccessStreamIndex: 1, journalExecutionGroup: 0, op: 'set',
      }),
    ]);
    expect(new Set(writeBoth.sortedUpsertLoopInfo?.map((stream) => stream.varyingArrayParam)).size).toBe(1);

    const storeBase = new Contract(storeArtifact, [], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeBase, storeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IStore {
        function writeBoth(int n, bytes payload) external;
      }
      contract Caller() {
        function poke(address store, int n, bytes payload) public {
          IStore(store).writeBoth(n, payload);
          require(true);
        }
      }`, KERNEL);
    const callerBase = new Contract(callerArtifact, [], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    caller._registerResolvedExternal('IStore', store);

    const callsite = callerArtifact.abi.find((entry) => entry.name === 'poke')
      ?.externalCalls?.find((call) => call.functionName === 'writeBoth');
    expect(callsite?.callsiteId).toBeDefined();

    // Seed INSERT via direct call; compose/batch settle the UPDATE path.
    const seed = new Uint8Array(20).fill(0x11);
    await expect(store.call.writeBoth(2n, seed).send()).resolves.toBeDefined();

    const expectPostState = async (payload: Uint8Array): Promise<void> => {
      const [scoreEntries, payloadEntries] = await Promise.all([
        store.getEntries('scores'), store.getEntries('payloads'),
      ]);
      for (const key of [0n, 1n]) {
        const slot = slotHex(key);
        expect(scoreEntries.find((entry) => binToHex(entry.slot) === slot)?.value).toBe(key + 10n);
        expect(payloadEntries.find((entry) => binToHex(entry.slot) === slot)?.value).toEqual(payload);
      }
    };

    // Inline (≤60B) and external (≥61B) loop-nested chunkable tails both settle under messageBus.compose once
    // the route publishes a balanced trailing band and composed loop mints occupy in-band valueChunkOutputs.
    for (const payload of [
      new Uint8Array(20).fill(0x41),
      new Uint8Array(60).fill(0x43),
      new Uint8Array(61).fill(0x44),
      new Uint8Array(130).fill(0x42),
    ]) {
      const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
      const composition = messageBus.compose({
        preparedCalls: [{
          contract: caller,
          functionName: 'poke',
          args: [store.inner.lockingBytecode, 2n, payload],
        }, {
          contract: store,
          functionName: 'writeBoth',
          args: [2n, payload],
          callsiteId: callsite!.callsiteId,
        }],
        funder: fee,
        changeAddress: fee.unlocker.generateLockingBytecode(),
      });

      const builder = await composition.build();
      expect(vmAccepts(builder)).toBe(true);
      await expect(composition.send()).resolves.toMatchObject({
        txid: expect.stringMatching(/^[0-9a-f]{64}$/),
      });
      await expectPostState(payload);
    }

    // Batch long-chunk path remains a regression for direct kernel settlement without a nested Caller→Store graph.
    const longPayload = new Uint8Array(190).fill(0x45);
    const longBuilder = await store.batch([{ function: 'writeBoth', args: [2n, longPayload] }]).build();
    expect(vmAccepts(longBuilder)).toBe(true);
    await expect(store.batch([{ function: 'writeBoth', args: [2n, longPayload] }]).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    await expectPostState(longPayload);
  }, 300_000);
});
