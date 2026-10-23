import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../../src/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { createBareP2pkhFeeFunder } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  evmCompat: true,
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
 * proxy→foreign-proxy × structs: deployProxy Acc.poke → deployProxy Store.writeRecord under compose
 * with dual executionArtifact/executor. Rebuilds nested Detail (leaf assign remains a compile fence).
 */
describe('kernel proxy → foreign-proxy fixed-struct under composition', () => {
  it('settles deployProxy poke→deployProxy Store Detail rebuild under compose with dual executionArtifact', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x4a), provider);
    for (let index = 0; index < 60; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const storeArtifact = compileString(`pragma solidity ^0.8.0;
      struct Detail { uint16 code; uint8 status; }
      struct Record { uint256 value; Detail detail; uint16[2] marks; }
      contract Store {
        Record record;
        function initialize() public {
          record.value = 1;
          record.detail = Detail(0, 2);
          record.marks[0] = 3;
          record.marks[1] = 4;
        }
        function writeRecord(uint16 code, uint256 index, uint16 mark) public {
          record.detail = Detail(code, record.detail.status);
          record.marks[index] = mark;
          require(true);
        }
      }`, KERNEL);
    expect(storeArtifact.delegateArtifact).toBeDefined();
    expect(storeArtifact.delegateArtifact!.messageBus?.handlers.find((h) => h.name === 'writeRecord'))
      .toMatchObject({ eligible: true });

    const store = await upgrades.deployProxy(getContractFactory(storeArtifact, signer), []);
    const seeded = await store.proxy.getState() as {
      record: { value: bigint; detail: { code: bigint; status: bigint }; marks: bigint[] };
    };
    expect(seeded.record.value).toBe(1n);
    expect(seeded.record.detail).toEqual({ code: 0n, status: 2n });
    expect(seeded.record.marks).toEqual([3n, 4n]);

    const callerArtifact = compileString(`pragma solidity ^0.8.0;
      interface IStore { function writeRecord(uint16 code, uint256 index, uint16 mark) external; }
      contract Acc {
        uint256 count;
        function initialize() public { this.count = 0; }
        function poke(address store, uint16 code, uint256 index, uint16 mark) public {
          IStore(store).writeRecord(code, index, mark);
          this.count = this.count + 1;
          require(true);
        }
      }`, KERNEL);
    const delegate = callerArtifact.delegateArtifact!;
    expect(delegate).toBeDefined();
    expect(delegate.messageBus?.handlers.find((h) => h.name === 'poke'))
      .toMatchObject({ eligible: true });

    const caller = await upgrades.deployProxy(getContractFactory(callerArtifact, signer), []);
    caller.implementation._registerResolvedExternal('IStore', store.proxy);
    const callsite = delegate.abi.find((entry) => entry.name === 'poke')
      ?.externalCalls?.find((call) => call.functionName === 'writeRecord');
    expect(callsite?.callsiteId).toBeDefined();

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller.proxy,
        functionName: 'poke',
        args: [store.proxy.inner.lockingBytecode, 70n, 1n, 9n],
        executionArtifact: caller.implementation.inner.artifact,
        executor: caller.implementation,
      }, {
        contract: store.proxy,
        functionName: 'writeRecord',
        args: [70n, 1n, 9n],
        callsiteId: callsite!.callsiteId,
        executionArtifact: store.implementation.inner.artifact,
        executor: store.implementation,
      }],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);

    const forwardInputs = builder.inputs.filter((input) => 'contract' in input.unlocker
      && input.unlocker.abiFunction.name === '__forward');
    expect(forwardInputs.length).toBeGreaterThanOrEqual(2);

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });

    const state = await store.proxy.getState() as {
      record: { value: bigint; detail: { code: bigint; status: bigint }; marks: bigint[] };
    };
    expect(state.record.value).toBe(1n);
    expect(state.record.detail).toEqual({ code: 70n, status: 2n });
    expect(state.record.marks).toEqual([3n, 9n]);
    expect((await caller.proxy.getState()).count).toBe(1n);
  }, 300_000);
});
