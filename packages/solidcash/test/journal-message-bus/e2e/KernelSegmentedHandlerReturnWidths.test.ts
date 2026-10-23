import { decodePushdataValue, KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
} as const;

const SOURCE = `contract SegmentBankReturnWidths() {
  mapping(int => int) records;

  function applyVoid(int count, int base) public {
    for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      this.records[base + cursor] = cursor + 1;
    }
    require(true);
  }

  function applyOne(int count, int base) public returns (int) {
    for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      this.records[base + cursor] = cursor + 11;
    }
    require(true);
    return base + count;
  }

  function applyTwo(int count, int base) public returns (int, int) {
    for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      this.records[base + cursor] = cursor + 101;
    }
    require(true);
    return (base + count, count);
  }

  function check(int key, int expected) public {
    require(this.records[key] == expected);
  }
}`;

describe('kernel segmented handler return widths', () => {
  it('round-trips an unchanged non-empty segment bank through idempotent rows', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'applyVoid'))
      .toMatchObject({ eligible: true });

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const rows = [
      { function: 'applyVoid', args: [1n, 40n] },
      { function: 'applyVoid', args: [1n, 40n] },
    ];
    const call = contract.batch(rows);
    const builder = await call.build();
    const routeInputIndex = builder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    const routeUnlocker = builder.inputs[routeInputIndex]?.unlocker;
    if (!routeUnlocker || !('params' in routeUnlocker)) throw new Error('kernel route input is missing');
    const firstSegmentInputIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === `${KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX}0`);
    const firstSegment = decodePushdataValue(
      routeUnlocker.params[firstSegmentInputIndex] as Uint8Array, 0, 'bytes[]',
    );
    expect((firstSegment.value as Uint8Array[]).length).toBeGreaterThan(0);

    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
        `batch input ${inputIndex}`).toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    await expect(contract.call.check(40n, 1n).send()).resolves.toBeDefined();
  }, 180_000);

  it('preserves a multi-segment journal through repeated void, one-value, and two-value handler invokes', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, KERNEL);
    for (const name of ['applyVoid', 'applyOne', 'applyTwo']) {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === name), name)
        .toMatchObject({ eligible: true });
    }

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const call = contract.batch([
      { function: 'applyVoid', args: [1n, 40n] },
      { function: 'applyOne', args: [1n, 60n] },
      { function: 'applyTwo', args: [1n, 80n] },
    ]);
    const builder = await call.build();
    const routeInputIndex = builder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    const routeUnlocker = builder.inputs[routeInputIndex]?.unlocker;
    if (!routeUnlocker || !('params' in routeUnlocker)) throw new Error('kernel route input is missing');
    let segmentRecordCount = 0;
    let nonEmptySegmentCount = 0;
    artifact.messageBus!.route.inputs.forEach((input, inputIndex) => {
      if (!input.name.startsWith(KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX)) return;
      const encoded = routeUnlocker.params[inputIndex] as Uint8Array;
      const decoded = decodePushdataValue(encoded, 0, 'bytes[]');
      expect(decoded.bytesConsumed).toBe(encoded.length);
      const recordCount = (decoded.value as Uint8Array[]).length;
      segmentRecordCount += recordCount;
      if (recordCount > 0) nonEmptySegmentCount += 1;
    });
    expect(segmentRecordCount).toBeGreaterThanOrEqual(4);
    expect(nonEmptySegmentCount).toBeGreaterThanOrEqual(2);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
        `batch input ${inputIndex}`).toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const expectedRanges = [
      { base: 40n, expected: [1n] },
      { base: 60n, expected: [11n] },
      { base: 80n, expected: [101n] },
    ] as const;
    for (const range of expectedRanges) {
      for (let offset = 0; offset < range.expected.length; offset += 1) {
        await expect(contract.call.check(range.base + BigInt(offset), range.expected[offset]).send(),
          `key ${range.base + BigInt(offset)}`).resolves.toBeDefined();
      }
    }
  }, 180_000);
});
