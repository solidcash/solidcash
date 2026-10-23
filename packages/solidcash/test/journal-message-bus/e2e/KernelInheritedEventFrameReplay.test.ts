import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString, compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../../src/utils.js';
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

describe('kernel inherited event-frame replay', () => {
  it('retains an interface-inherited event through final participant relocation', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`pragma solidity ^0.8.0;
      interface RecorderApi {
        event Recorded(uint256 value);
        function record(uint256 value) external;
      }
      contract RecorderBase is RecorderApi {
        uint256 latest;
        function record(uint256 value) public {
          latest = value;
          emit Recorded(value);
          require(true);
        }
      }
      contract Recorder is RecorderBase {}
    `, KERNEL);
    const recorderArtifact = artifacts.Recorder;
    expect(recorderArtifact.events).toEqual([
      expect.objectContaining({ name: 'Recorded', signature: 'Recorded(uint256)' }),
    ]);
    // The top-level emit streams: the handler's runtime stream names the resolved interface-inherited signature.
    expect(recorderArtifact.messageBus?.handlers.find((handler) => handler.name === 'record')?.runtimeLoopEvents)
      .toEqual([expect.objectContaining({ eventSignatures: ['Recorded(uint256)'], stream: true })]);

    const recorderBase = new Contract(recorderArtifact, [], { provider });
    const recorderSetup = await setupStatefulUtxos(
      provider, recorderBase, recorderArtifact.stateLayout!, {}, { saltContract: true },
    );
    const recorder = StatefulContract.withCategory(
      recorderBase.withCategory(hexToBin(recorderSetup.categoryId)), recorderSetup.categoryId,
    );

    const rootArtifact = compileString(`pragma solidity ^0.8.0;
      interface RecorderApi { function record(uint256 value) external; }
      contract Root(address recorder) {
        function execute(
          uint256 a, uint256 b, uint256 c, uint256 d,
          uint256 e, uint256 f, uint256 g, uint256 h
        ) public {
          RecorderApi(recorder).record(a);
          RecorderApi(recorder).record(b);
          RecorderApi(recorder).record(c);
          RecorderApi(recorder).record(d);
          RecorderApi(recorder).record(e);
          RecorderApi(recorder).record(f);
          RecorderApi(recorder).record(g);
          RecorderApi(recorder).record(h);
          require(true);
        }
      }
    `, KERNEL);
    const rootBase = new Contract(rootArtifact, [recorder.inner.lockingBytecode], { provider });
    const rootSetup = await setupStatefulUtxos(
      provider, rootBase, rootArtifact.stateLayout!, {}, { saltContract: true },
    );
    const root = StatefulContract.withCategory(
      rootBase.withCategory(hexToBin(rootSetup.categoryId)), rootSetup.categoryId,
    );
    const externalCall = rootArtifact.abi.find((entry) => entry.name === 'execute')!
      .externalCalls!.find((call) => call.functionName === 'record')!;
    const sourceRows = externalCall.batchInvocations ?? [];
    expect(sourceRows).toHaveLength(8);
    const values = [17n, 23n, 29n, 31n, 37n, 41n, 43n, 47n];
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const builder = await messageBus.compose({
      preparedCalls: [
        { contract: root, functionName: 'execute', args: values },
        ...values.map((value, batchLogicalIndex) => ({
          contract: recorder,
          functionName: 'record',
          args: [value],
          callsiteId: externalCall.callsiteId,
          batchLogicalIndex,
          batchOccurrenceIndex: 0,
        })),
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    }).build();

    const eventLock = binToHex(addressToLockScript(recorder.getEventNftAddress('Recorded(uint256)')));
    const eventOutputIndices = builder.outputs.flatMap((output, index) => {
      const lockingBytecode = typeof output.to === 'string' ? undefined : binToHex(output.to);
      return lockingBytecode === eventLock
        && output.token?.category === recorderSetup.categoryId
        && output.token.nft?.capability === 'none' ? [index] : [];
    });
    expect(eventOutputIndices).toHaveLength(values.length);
    const recorderInputIndex = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Recorder'
      && input.unlocker.abiFunction.name === recorderArtifact.messageBus!.route.name);
    // Each row's record settles at the next output of the relocated participant's trailing band, in row order.
    const { trailingBase, trailingCapacity } = recorderArtifact.messageBus!.route.blockLayout!;
    expect(trailingCapacity).toBeGreaterThanOrEqual(values.length);
    expect(eventOutputIndices).toEqual(values.map((_value, index) => recorderInputIndex + trailingBase! + index));

    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
  }, 120_000);
});
