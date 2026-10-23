import { hexToBin } from '@bitauth/libauth';
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

const OPTIONS = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  evmCompat: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

const vmAccepts = (builder: TransactionBuilder): boolean => {
  try {
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(builder.provider) as {
      testSuccess?: (result: unknown) => boolean;
      evaluate: (program: unknown) => unknown;
    };
    if (typeof vm.testSuccess !== 'function') return true;
    return transaction.inputs.every((_input, inputIndex) => vm.testSuccess!(vm.evaluate({
      inputIndex, sourceOutputs, transaction,
    })) === true);
  } catch {
    return false;
  }
};

/**
 * J7 green settle (AOT slim-fixture path): admit only `run` while source still contains inactive
 * sibling `appendDormant` (mapping write). Selected path settles under compose; unselected sibling
 * contributes no dynamic chunks. Proxy+`address[]` full-admission density remains characterized by
 * `KernelDelegateInactiveDynamicWrite`.
 */
describe('kernel inactive union settle', () => {
  it('settles run while unselected appendDormant sibling does not reserve dyn chunks', async () => {
    const artifact = compileString(`pragma solidity ^0.8.20;
      interface IProbe { function touch() external; }
      contract Impl {
        uint256 public marker;
        mapping(uint256 => uint256) private dormantScores;
        function run(address probe) public {
          marker = 1;
          IProbe(probe).touch();
          require(true);
        }
        function appendDormant(uint256 key, uint256 value) public {
          dormantScores[key] = value;
          require(true);
        }
      }`, { ...OPTIONS, messageBusHandlers: ['run'] });
    expect(artifact.messageBus?.handlers.filter((handler) => handler.eligible).map((handler) => handler.name))
      .toEqual(['run']);
    expect(artifact.abi.find((entry) => entry.name === 'run')?.dynamicWrites ?? []).toEqual([]);
    expect(artifact.abi.some((entry) => entry.name === 'appendDormant')).toBe(true);
    expect(artifact.messageBus?.route?.blockLayout?.trailingCapacity ?? 0).toBeLessThan(8);

    const provider = createMessageBusCapstoneTestProvider();
    const implBase = new Contract(artifact, [], { provider });
    const implSetup = await setupStatefulUtxos(
      provider, implBase, artifact.stateLayout!, { marker: 0n }, { saltContract: true },
    );
    const impl = StatefulContract.withCategory(
      implBase.withCategory(hexToBin(implSetup.categoryId)), implSetup.categoryId,
    );

    const probeArtifact = compileString(`pragma solidity ^0.8.20;
      contract Probe { function touch() public { require(true); } }`, {
      ...OPTIONS, messageBusGraphContext: true,
    });
    const probeBase = new Contract(probeArtifact, [], { provider });
    const probeSetup = await setupStatefulUtxos(
      provider, probeBase, probeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const probe = StatefulContract.withCategory(
      probeBase.withCategory(hexToBin(probeSetup.categoryId)), probeSetup.categoryId,
    );
    impl._registerResolvedExternal('IProbe', probe);
    const callsite = artifact.abi.find((entry) => entry.name === 'run')?.externalCalls?.[0];
    expect(callsite?.callsiteId).toBeDefined();

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: impl,
        functionName: 'run',
        args: [probe.inner.lockingBytecode],
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
    expect((await impl.getState()).marker).toBe(1n);
  }, 180_000);
});
