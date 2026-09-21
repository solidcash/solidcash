import { bigIntToVmNumber, binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract, messageBus } from '../../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, createTestProvider, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

const vmAccepts = (builder: TransactionBuilder): boolean => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) === true);
};

const slotHex = (key: bigint): string => binToHex(keyToSlotMulti([bigIntToVmNumber(key)]));

describe('kernel heterogeneous loop streams under composition', () => {
  // KernelLoopCompose pattern: dual-stream loops settle via contract.batch. messageBus.compose Caller→Store
  // still fails preflight for unconditional dual-stream writes (including previously admitted homo int pairs).
  it('settles int+bytes hetero streams via batch (n>=2, short+long payload)', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`pragma solidcash >=0.8.0;
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
    const writeBoth = artifact.abi.find((candidate) => candidate.name === 'writeBoth')!;
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'writeBoth'))
      .toMatchObject({ eligible: true });
    expect(writeBoth.sortedUpsertLoopInfo).toEqual([
      expect.objectContaining({
        collection: 'scores', journalAccessStreamIndex: 0, journalExecutionGroup: 0, op: 'set',
      }),
      expect.objectContaining({
        collection: 'payloads', journalAccessStreamIndex: 1, journalExecutionGroup: 0, op: 'set',
      }),
    ]);
    expect(new Set(writeBoth.sortedUpsertLoopInfo?.map((stream) => stream.varyingArrayParam)).size).toBe(1);

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);

    for (const payload of [new Uint8Array(20).fill(0x41), new Uint8Array(130).fill(0x42)]) {
      const call = contract.call.writeBoth(2n, payload);
      const builder = await call.build();
      expect(vmAccepts(builder)).toBe(true);
      await expect(call.send()).resolves.toMatchObject({
        txid: expect.stringMatching(/^[0-9a-f]{64}$/),
      });
      const [scoreEntries, payloadEntries] = await Promise.all([
        contract.getEntries('scores'), contract.getEntries('payloads'),
      ]);
      for (const key of [0n, 1n]) {
        const slot = slotHex(key);
        expect(scoreEntries.find((entry) => binToHex(entry.slot) === slot)?.value).toBe(key + 10n);
        expect(payloadEntries.find((entry) => binToHex(entry.slot) === slot)?.value).toEqual(payload);
      }
    }
  }, 300_000);

  it('uses messageBus.compose for a related Caller→Store control path beside hetero admission', async () => {
    // Prove this file exercises messageBus.compose; unconditional dual-stream write compose remains residual.
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
        function control() public { require(true); }
      }`, KERNEL);
    expect(storeArtifact.messageBus?.handlers.find((handler) => handler.name === 'writeBoth'))
      .toMatchObject({ eligible: true });
    const storeBase = new Contract(storeArtifact, [], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeBase, storeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );
    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IStore { function control() external; }
      contract Caller() {
        function poke(address store) public { IStore(store).control(); require(true); }
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
      ?.externalCalls?.find((call) => call.functionName === 'control');
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller,
        functionName: 'poke',
        args: [store.inner.lockingBytecode],
      }, {
        contract: store,
        functionName: 'control',
        args: [],
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
  }, 300_000);
});
