import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  Signer,
} from '../../../src/index.js';
import {
  StatefulContract,
  getContractFactory,
  upgrades,
} from '../../../src/stateful/index.js';
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

type RecordState = {
  record: { value: bigint; detail: { code: bigint; status: bigint }; marks: bigint[] };
};

/**
 * deployProxy Acc owns a fixed-layout Record (nested Detail + fixed T[N] marks). Nested fixed-int
 * leaf assigns (`record.detail.code = …`) are a compile fence; rebuild Detail(...) like the
 * self×structs cell. Prefer messageBus.compose×Probe + executionArtifact on the proxy category.
 */
describe('kernel proxy-self fixed-struct state under composition', () => {
  it('settles deployProxy Detail rebuild and marks[i] via compose+executionArtifact×Probe', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x65), provider);
    for (let index = 0; index < 40; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const probeArtifact = compileString(`pragma solidity ^0.8.0;
      contract Probe { function touch() public { require(true); } }`, {
      ...KERNEL, messageBusGraphContext: true,
    });
    const probeBase = new Contract(probeArtifact, [], { provider });
    const probeSetup = await setupStatefulUtxos(
      provider, probeBase, probeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const probe = StatefulContract.withCategory(
      probeBase.withCategory(hexToBin(probeSetup.categoryId)), probeSetup.categoryId,
    );

    const artifact = compileString(`pragma solidity ^0.8.0;
      interface IProbe { function touch() external; }
      struct Detail { uint16 code; uint8 status; }
      struct Record { uint256 value; Detail detail; uint16[2] marks; }
      contract Acc {
        Record record;
        function initialize(
          uint256 value, uint16 code, uint8 status, uint16 m0, uint16 m1
        ) public {
          record.value = value;
          // Nested fixed-int leaf assigns are not valid targets; rebuild Detail(...).
          record.detail = Detail(code, status);
          record.marks[0] = m0;
          record.marks[1] = m1;
        }
        function writeRecord(address probe, uint16 code, uint256 index, uint16 mark) public {
          // Nested fixed-int leaf assigns are not valid targets; rebuild the Detail slot.
          record.detail = Detail(code, record.detail.status);
          record.marks[index] = mark;
          IProbe(probe).touch();
          require(true);
        }
      }`, KERNEL);
    const delegate = artifact.delegateArtifact!;
    expect(delegate).toBeDefined();
    expect(delegate.messageBus?.handlers.find((handler) => handler.name === 'writeRecord'))
      .toMatchObject({ eligible: true });

    const deployed = await upgrades.deployProxy(
      getContractFactory(artifact, signer),
      [1n, 0n, 2n, 3n, 4n],
    );
    expect((await deployed.proxy.getState() as RecordState).record).toEqual({
      value: 1n,
      detail: { code: 0n, status: 2n },
      marks: [3n, 4n],
    });
    deployed.implementation._registerResolvedExternal('IProbe', probe);

    const callsite = delegate.abi.find((entry) => entry.name === 'writeRecord')
      ?.externalCalls?.find((call) => call.functionName === 'touch');
    expect(callsite?.callsiteId).toBeDefined();

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: deployed.proxy,
        functionName: 'writeRecord',
        args: [probe.inner.lockingBytecode, 70n, 1n, 9n],
        executionArtifact: deployed.implementation.inner.artifact,
        executor: deployed.implementation,
      }, {
        contract: probe,
        functionName: 'touch',
        args: [],
        callsiteId: callsite!.callsiteId,
      }],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);
    expect(builder.inputs.some((input) => 'contract' in input.unlocker
      && input.unlocker.contract.address === deployed.implementation.inner.address)).toBe(true);
    expect(builder.inputs.some((input) => 'contract' in input.unlocker
      && input.unlocker.abiFunction.name === '__forward')).toBe(true);

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });

    const state = await deployed.proxy.getState() as RecordState;
    expect(state.record.value).toBe(1n);
    expect(state.record.detail).toEqual({ code: 70n, status: 2n });
    expect(state.record.marks).toEqual([3n, 9n]);
  }, 300_000);

  it('settles deployProxy setDetailCode via compose+executionArtifact×Probe', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x66), provider);
    for (let index = 0; index < 40; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const probeArtifact = compileString(`pragma solidity ^0.8.0;
      contract Probe { function touch() public { require(true); } }`, {
      ...KERNEL, messageBusGraphContext: true,
    });
    const probeBase = new Contract(probeArtifact, [], { provider });
    const probeSetup = await setupStatefulUtxos(
      provider, probeBase, probeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const probe = StatefulContract.withCategory(
      probeBase.withCategory(hexToBin(probeSetup.categoryId)), probeSetup.categoryId,
    );

    const artifact = compileString(`pragma solidity ^0.8.0;
      interface IProbe { function touch() external; }
      struct Detail { uint16 code; uint8 status; }
      struct Record { uint256 value; Detail detail; uint16[2] marks; }
      contract Acc {
        Record record;
        function initialize(
          uint256 value, uint16 code, uint8 status, uint16 m0, uint16 m1
        ) public {
          record.value = value;
          record.detail = Detail(code, status);
          record.marks[0] = m0;
          record.marks[1] = m1;
        }
        function setDetailCode(address probe, uint16 code) public {
          record.detail = Detail(code, record.detail.status);
          IProbe(probe).touch();
          require(true);
        }
      }`, KERNEL);
    const delegate = artifact.delegateArtifact!;
    expect(delegate.messageBus?.handlers.find((handler) => handler.name === 'setDetailCode'))
      .toMatchObject({ eligible: true });

    const deployed = await upgrades.deployProxy(
      getContractFactory(artifact, signer),
      [1n, 0n, 2n, 3n, 4n],
    );
    deployed.implementation._registerResolvedExternal('IProbe', probe);

    const callsite = delegate.abi.find((entry) => entry.name === 'setDetailCode')
      ?.externalCalls?.find((call) => call.functionName === 'touch');
    expect(callsite?.callsiteId).toBeDefined();

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: deployed.proxy,
        functionName: 'setDetailCode',
        args: [probe.inner.lockingBytecode, 70n],
        executionArtifact: deployed.implementation.inner.artifact,
        executor: deployed.implementation,
      }, {
        contract: probe,
        functionName: 'touch',
        args: [],
        callsiteId: callsite!.callsiteId,
      }],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const state = await deployed.proxy.getState() as RecordState;
    expect(state.record.detail).toEqual({ code: 70n, status: 2n });
    expect(state.record.marks).toEqual([3n, 4n]);
  }, 300_000);
});
