import { hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract } from '../../../src/index.js';
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
  solidityImportCompat: true,
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

/**
 * Pure self fixed-layout struct state write under KERNEL: rebuild a nested Detail slot and mutate a
 * fixed `T[N]` marks index on the same Record (no chunked leaves). Same-contract multi-call
 * messageBus.compose collapses to one graph invocation, so this settles via kernel batch rows.
 */
describe('kernel self fixed-struct state write under composition', () => {
  it('settles Detail rebuild and marks[i] writes in one kernel batch', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Detail { uint16 code; uint8 status; }
      struct Record { uint256 value; Detail detail; uint16[2] marks; }
      contract Acc {
        Record record;
        function setDetailCode(uint16 code) public {
          // Nested fixed-int leaf assigns are not valid targets; rebuild the Detail slot.
          record.detail = Detail(code, record.detail.status);
          require(true);
        }
        function setMark(uint256 index, uint16 value) public {
          record.marks[index] = value;
          require(true);
        }
      }`, KERNEL);
    for (const name of ['setDetailCode', 'setMark']) {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === name))
        .toMatchObject({ eligible: true });
    }

    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {
      record: {
        value: 1n,
        detail: { code: 0n, status: 2n },
        marks: [3n, 4n],
      },
    }, { saltContract: true });
    const sc = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const call = sc.batch([
      { function: 'setDetailCode', args: [70n] },
      { function: 'setMark', args: [1n, 9n] },
    ]);
    call.addInput(funder.utxo, funder.unlocker);
    const builder = await call.build();
    expect(vmAccepts(builder)).toBe(true);
    expect(builder.inputs.some((input) => 'contract' in input.unlocker && 'params' in input.unlocker))
      .toBe(true);

    await expect(call.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });

    const state = await sc.getState() as {
      record: { value: bigint; detail: { code: bigint; status: bigint }; marks: bigint[] };
    };
    expect(state.record.value).toBe(1n);
    expect(state.record.detail).toEqual({ code: 70n, status: 2n });
    expect(state.record.marks).toEqual([3n, 9n]);
  }, 180_000);
});
