import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
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

describe('kernel mixed-handler row framing under composition', () => {
  it('publishes absolute calldata bounds and settles add+clear+add via messageBus.compose', async () => {
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

    const framed = messageBus.encodeMessageBatch(storeArtifact, [
      { function: 'add', args: [5n] },
      { function: 'clear' },
      { function: 'add', args: [3n] },
    ]);
    expect(framed.rows).toHaveLength(3);
    expect(framed.rows.map((row) => row.function)).toEqual(['add', 'clear', 'add']);
    expect(framed.rows[1]).toMatchObject({ calldataLength: 0, argsHex: '' });
    for (const row of framed.rows) {
      expect(row.calldataLength).toBe(row.argsHex.length / 2);
      expect(binToHex(messageBus.sliceMessageBatchRowCalldata(framed.blob, row)))
        .toBe(row.argsHex.toLowerCase());
    }

    const storeBase = new Contract(storeArtifact, [], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeBase, storeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );
    await expect(store.call.add(1n).send()).resolves.toBeDefined();

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IStore {
        function add(int n) external;
        function clear() external;
      }
      contract Caller() {
        function poke(address store, int first, int second) public {
          IStore(store).add(first);
          IStore(store).clear();
          IStore(store).add(second);
          require(true);
        }
      }`, KERNEL);
    const poke = callerArtifact.abi.find((entry) => entry.name === 'poke');
    const batch = poke?.externalCalls?.[0];
    expect(batch?.batchInvocations).toEqual([
      expect.objectContaining({ sourceCallsiteId: 0, logicalIndex: 0, selector: expect.any(String) }),
      expect.objectContaining({ sourceCallsiteId: 1, logicalIndex: 1, inputs: [] }),
      expect.objectContaining({ sourceCallsiteId: 2, logicalIndex: 2 }),
    ]);
    // Mixed-arity: clear (zero args) sits between two add rows in one physical batch.
    expect(batch?.batchInvocations?.[1]?.inputs).toEqual([]);
    expect(batch?.batchInvocations?.[0]?.inputs?.length).toBe(1);

    const callerBase = new Contract(callerArtifact, [], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    caller._registerResolvedExternal('IStore', store);

    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const physical = batch!.callsiteId!;
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller,
        functionName: 'poke',
        args: [store.inner.lockingBytecode, 5n, 3n],
      }, {
        contract: store,
        functionName: 'add',
        args: [5n],
        callsiteId: physical,
        sourceCallsiteId: 0,
        sourceLogicalIndex: 0,
        batchLogicalIndex: 0,
      }, {
        contract: store,
        functionName: 'clear',
        args: [],
        callsiteId: physical,
        sourceCallsiteId: 1,
        sourceLogicalIndex: 1,
        batchLogicalIndex: 1,
      }, {
        contract: store,
        functionName: 'add',
        args: [3n],
        callsiteId: physical,
        sourceCallsiteId: 2,
        sourceLogicalIndex: 2,
        batchLogicalIndex: 2,
      }],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);
    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect((await store.getState() as { counter: bigint }).counter).toBe(3n);
  }, 300_000);

  it('fail-closes when a mixed-arity blob is decoded against the wrong row schema length', () => {
    const storeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        int counter;
        function add(int n) public { this.counter = this.counter + n; require(n >= 0); }
        function clear() public { this.counter = 0; require(true); }
      }`, KERNEL);
    // encodeMessageBatch publishes framed rows and verifies each via sliceMessageBatchRowCalldata.
    const framed = messageBus.encodeMessageBatch(storeArtifact, [
      { function: 'add', args: [5n] },
      { function: 'clear' },
      { function: 'add', args: [3n] },
    ]);
    for (const row of framed.rows) {
      expect(binToHex(messageBus.sliceMessageBatchRowCalldata(framed.blob, row)))
        .toBe(row.argsHex.toLowerCase());
    }
    const clearRow = framed.rows[1]!;
    expect(clearRow.calldataLength).toBe(0);

    // handler-frame ABI residual: shipped public API fail-closes unframed / hostile consumer walks.
    expect(() => messageBus.sliceMessageBatchRowCalldata(framed.blob, {
      row: clearRow.row,
      argsHex: clearRow.argsHex,
    })).toThrow(/unframed: missing calldataStart\/Length/);
    expect(() => messageBus.sliceMessageBatchRowCalldata(framed.blob, {
      row: clearRow.row,
      calldataStart: clearRow.calldataStart,
      calldataLength: framed.blob.length + 1,
    })).toThrow(/walked past authenticated blob bounds/);
    expect(() => messageBus.sliceMessageBatchRowCalldata(framed.blob, {
      ...clearRow,
      calldataLength: framed.rows[2]!.calldataLength,
    })).toThrow(/row framing mismatch|does not match encoded arguments/);
  });
});
