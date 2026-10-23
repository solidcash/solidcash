import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
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

describe('kernel funder-gap two-participant placement', () => {
  it('funds the emitter event slot across a dense Caller→Emitter compose', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    // A conditional emit keeps its fixed event slot; a top-level one would stream in the trailing band.
    const emitterArtifact = compileString(`pragma solidity ^0.8.0;
      contract Emitter {
        event Ping(uint256 value);
        function ping(uint256 value) public {
          if (value > 0) { emit Ping(value); }
          require(true);
        }
      }`, KERNEL);
    expect(emitterArtifact.messageBus?.handlers.find((entry) => entry.name === 'ping'))
      .toMatchObject({ eligible: true });
    expect(emitterArtifact.messageBus?.route.blockLayout?.slots.some(
      (slot) => slot.kind === 'event' || slot.kind === 'returnEvent',
    )).toBe(true);

    const emitterBase = new Contract(emitterArtifact, [], { provider });
    const emitterSetup = await setupStatefulUtxos(
      provider, emitterBase, emitterArtifact.stateLayout!, {}, { saltContract: true },
    );
    const emitter = StatefulContract.withCategory(
      emitterBase.withCategory(hexToBin(emitterSetup.categoryId)), emitterSetup.categoryId,
    );

    const callerArtifact = compileString(`pragma solidity ^0.8.0;
      interface IEmitter { function ping(uint256 value) external; }
      contract Caller(address emitter) {
        function fire(uint256 value) public {
          IEmitter(emitter).ping(value);
          require(true);
        }
      }`, KERNEL);
    const callerBase = new Contract(callerArtifact, [emitter.inner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );

    const callsiteId = callerArtifact.abi.find((entry) => entry.name === 'fire')!
      .externalCalls!.find((call) => call.functionName === 'ping')!.callsiteId!;
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: caller, functionName: 'fire', args: [7n] },
        { contract: emitter, functionName: 'ping', args: [7n], callsiteId },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);

    const emitterRouteInput = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Emitter'
      && input.unlocker.abiFunction.name === emitterArtifact.messageBus!.route.name);
    const callerRouteInput = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Caller'
      && input.unlocker.abiFunction.name === callerArtifact.messageBus!.route.name);
    expect(callerRouteInput).toBeGreaterThanOrEqual(0);
    expect(emitterRouteInput).toBeGreaterThan(callerRouteInput);

    // Deferred external participant sits after the caller's full block (contiguous dense placement).
    const callerBlockSize = callerArtifact.messageBus!.route.blockLayout!.blockSize;
    expect(emitterRouteInput).toBeGreaterThanOrEqual(callerRouteInput + callerBlockSize);

    const transaction = builder.buildLibauthTransaction();
    const eventOutputs = transaction.outputs.filter((output) => {
      const category = output.token?.category;
      const categoryHex = typeof category === 'string'
        ? category.toLowerCase()
        : category !== undefined ? binToHex(category).toLowerCase() : '';
      return categoryHex === emitterSetup.categoryId.toLowerCase()
        && output.token?.nft?.capability === 'none'
        && (typeof output.token.nft.commitment === 'string'
          ? output.token.nft.commitment.length > 0
          : (output.token.nft?.commitment?.length ?? 0) > 0);
    });
    expect(eventOutputs.length).toBeGreaterThanOrEqual(1);
    // Event slot is funded (dust-viable satoshis), not a bare unfunded pad.
    expect(eventOutputs.every((output) => (output.valueSatoshis ?? 0n) > 0n)).toBe(true);

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  }, 120_000);
});
