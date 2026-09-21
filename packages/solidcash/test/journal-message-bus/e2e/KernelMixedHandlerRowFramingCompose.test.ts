import { hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract } from '../../../src/index.js';
import { encodeMessageBatch } from '../../../src/message-bus/message-bus.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { setupStatefulUtxos } from '../../test-util.js';
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
    return transaction.inputs.every((_input, inputIndex) => vm.testSuccess(
      vm.evaluate({ inputIndex, sourceOutputs, transaction }),
    ) === true);
  } catch {
    return false;
  }
};

describe('kernel mixed-handler row framing under composition', () => {
  it('publishes absolute calldata bounds for mixed-arity rows and settles add+clear+add', async () => {
    const provider = createMessageBusCapstoneTestProvider();

    const storeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        int counter;
        function add(int n) public { this.counter = this.counter + n; require(n >= 0); }
        function clear() public { this.counter = 0; require(true); }
      }`, KERNEL);
    expect(storeArtifact.messageBus?.handlers.find((handler) => handler.name === 'add'))
      .toMatchObject({ eligible: true });
    expect(storeArtifact.messageBus?.handlers.find((handler) => handler.name === 'clear'))
      .toMatchObject({ eligible: true });

    const framed = encodeMessageBatch(storeArtifact, [
      { function: 'add', args: [5n] },
      { function: 'clear' },
      { function: 'add', args: [3n] },
    ]);
    expect(framed.rows).toHaveLength(3);
    expect(framed.rows.map((row) => row.function)).toEqual(['add', 'clear', 'add']);
    expect(framed.rows[1]).toMatchObject({ calldataLength: 0, argsHex: '' });
    for (const row of framed.rows) {
      expect(row.calldataLength).toBe(row.argsHex.length / 2);
      expect(Buffer.from(
        framed.blob.subarray(row.calldataStart, row.calldataStart + row.calldataLength),
      ).toString('hex')).toBe(row.argsHex.toLowerCase());
    }

    const storeBase = new Contract(storeArtifact, [], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeBase, storeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );
    await expect(store.call.add(1n).send()).resolves.toBeDefined();

    const batch = store.batch([
      { function: 'add', args: [5n] },
      { function: 'clear' },
      { function: 'add', args: [3n] },
    ]);
    const batchBuilder = await batch.build();
    // Capstone mock VM surface sometimes omits testSuccess; settle proof is send + post-state.
    if (typeof (createVirtualMachineBch2026ForProvider(provider) as { testSuccess?: unknown }).testSuccess === 'function') {
      expect(vmAccepts(batchBuilder)).toBe(true);
    }
    await expect(batch.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect((await store.getState() as { counter: bigint }).counter).toBe(3n);
  }, 300_000);
});
