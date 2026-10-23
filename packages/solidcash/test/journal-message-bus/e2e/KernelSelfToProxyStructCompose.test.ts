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

/**
 * self→proxy × fixed structs: non-proxy Caller.poke → deployProxy Acc.writeRecord under compose with
 * executionArtifact/executor. Rebuild Detail(...) and mutate fixed T[N] marks[i] on the proxy category
 * (nested fixed-int leaf assigns remain a compile fence).
 */
describe('kernel self→proxy fixed-struct compose', () => {
  it('settles Caller.poke→deployProxy Acc writeRecord under compose with executionArtifact', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x75), provider);
    for (let index = 0; index < 40; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const implArtifact = compileString(`pragma solidity ^0.8.0;
      struct Detail { uint16 code; uint8 status; }
      struct Record { uint256 value; Detail detail; uint16[2] marks; }
      contract Acc {
        Record record;
        function initialize() public {
          record.value = 1;
          record.detail = Detail(0, 2);
          record.marks[0] = 3;
          record.marks[1] = 4;
        }
        function writeRecord(uint16 code, uint256 index, uint16 mark) public {
          // Nested fixed-int leaf assigns are not valid targets; rebuild the Detail slot.
          record.detail = Detail(code, record.detail.status);
          record.marks[index] = mark;
          require(true);
        }
      }`, KERNEL);
    const delegate = implArtifact.delegateArtifact!;
    expect(delegate).toBeDefined();
    expect(delegate.messageBus?.handlers.find((handler) => handler.name === 'writeRecord'))
      .toMatchObject({ eligible: true });

    const deployed = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);
    const seeded = await deployed.proxy.getState() as {
      record: { value: bigint; detail: { code: bigint; status: bigint }; marks: bigint[] };
    };
    expect(seeded.record.value).toBe(1n);
    expect(seeded.record.detail).toEqual({ code: 0n, status: 2n });
    expect(seeded.record.marks).toEqual([3n, 4n]);

    const callerArtifact = compileString(`pragma solidity ^0.8.0;
      interface IAcc { function writeRecord(uint16 code, uint256 index, uint16 mark) external; }
      contract Caller {
        function poke(address acc, uint16 code, uint256 index, uint16 mark) public {
          IAcc(acc).writeRecord(code, index, mark);
          require(true);
        }
      }`, KERNEL);
    expect(callerArtifact.messageBus?.handlers.find((handler) => handler.name === 'poke'))
      .toMatchObject({ eligible: true });
    const callerBase = new Contract(callerArtifact, [], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    caller._registerResolvedExternal('IAcc', deployed.proxy);

    const callsite = callerArtifact.abi.find((entry) => entry.name === 'poke')
      ?.externalCalls?.find((call) => call.functionName === 'writeRecord');
    expect(callsite?.callsiteId).toBeDefined();

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller,
        functionName: 'poke',
        args: [deployed.proxy.inner.lockingBytecode, 70n, 1n, 9n],
      }, {
        contract: deployed.proxy,
        functionName: 'writeRecord',
        args: [70n, 1n, 9n],
        callsiteId: callsite!.callsiteId,
        executionArtifact: deployed.implementation.inner.artifact,
        executor: deployed.implementation,
      }],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);
    expect(builder.inputs.some((input) => 'contract' in input.unlocker
      && input.unlocker.contract.address === deployed.implementation.inner.address)).toBe(true);
    expect(builder.inputs.some((input) => 'contract' in input.unlocker
      && input.unlocker.abiFunction.name === '__forward'
      && input.unlocker.contract.address === deployed.proxy.inner.address)).toBe(true);

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });

    const state = await deployed.proxy.getState() as {
      record: { value: bigint; detail: { code: bigint; status: bigint }; marks: bigint[] };
    };
    expect(state.record.value).toBe(1n);
    expect(state.record.detail).toEqual({ code: 70n, status: 2n });
    expect(state.record.marks).toEqual([3n, 9n]);
  }, 300_000);
});
