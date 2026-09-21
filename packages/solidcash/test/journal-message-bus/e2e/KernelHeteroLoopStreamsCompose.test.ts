import { bigIntToVmNumber, binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract } from '../../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

const SOURCE = `pragma solidcash ^0.13.0;
contract KernelHeteroLoopStreams() {
  mapping(int => int) scores;
  mapping(int => bytes) payloads;
  function writeBoth(int n, bytes payload) public {
    for (int i = 0; i < n; i = i + 1) {
      this.scores[i] = i + 10;
      this.payloads[i] = payload;
    }
    require(true);
  }
  function checkScore(int key, int expected) public { require(this.scores[key] == expected); }
  function checkPayload(int key, bytes expected) public { require(this.payloads[key] == expected); }
}`;

describe('kernel heterogeneous loop streams under composition', () => {
  it('admits and settles int+bytes maps on one shared counter schedule', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, KERNEL);
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

    // Short inline bytes plus a long chunkable payload across two settles.
    for (const payload of [new Uint8Array(20).fill(0x41), new Uint8Array(130).fill(0x42)]) {
      const call = contract.call.writeBoth(2n, payload);
      const builder = await call.build();
      const transaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      const vm = createVirtualMachineBch2026ForProvider(provider);
      for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
        expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
          `payload ${payload.length}, input ${inputIndex}`).toBe(true);
      }
      await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });

      const updated = StatefulContract.withCategory(inner, categoryId);
      for (const key of [0n, 1n]) {
        await expect(updated.call.checkScore(key, key + 10n).send()).resolves.toBeDefined();
        await expect(updated.call.checkPayload(key, payload).send()).resolves.toBeDefined();
      }
      const entries = await updated.getEntries('payloads');
      for (const key of [0n, 1n]) {
        const slot = binToHex(keyToSlotMulti([bigIntToVmNumber(key)]));
        expect(entries.find((entry) => binToHex(entry.slot) === slot)?.value).toEqual(payload);
      }
    }
  }, 300_000);
});
