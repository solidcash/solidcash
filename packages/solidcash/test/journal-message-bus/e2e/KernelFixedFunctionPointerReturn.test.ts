import { binToHex, hexToBin } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { compileStringMulti } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, messageBus, StatefulContract } from '../../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const vmAccepts = (builder: TransactionBuilder): boolean => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) === true);
};

describe('kernel fixed function-pointer return BCH VM', () => {
  it('commits the fixed self function id and rejects a forged return event', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`pragma solidity ^0.8.0;
      interface Sink {
        function touch() external;
      }
      contract C {
        function target(uint value) external pure returns (uint) { return value + 1; }
        function pointer(address sink) public returns (function(uint) external returns (uint)) {
          Sink(sink).touch();
          return this.target;
        }
      }
      contract Leaf {
        function touch() public { require(true); }
      }
    `, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
      solidityImportCompat: true,
    });
    const artifact = artifacts.C;
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pointer'))
      .toMatchObject({ eligible: true });
    const connect = async (selected: Artifact, args: readonly unknown[] = []): Promise<StatefulContract> => {
      const base = new Contract(selected, args as never[], { provider });
      const setup = await setupStatefulUtxos(
        provider, base, selected.stateLayout!, {}, { saltContract: true },
      );
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const contract = await connect(artifact);
    const leaf = await connect(artifacts.Leaf);
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract, functionName: 'pointer', args: [leaf.inner.lockingBytecode] },
        { contract: leaf, functionName: 'touch', args: [] },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    const canonical = await composition.build();
    expect(vmAccepts(canonical)).toBe(true);
    const hostile = await composition.build();
    const returnOutput = hostile.outputs.find((output) => output.token?.category === contract.categoryId
      && output.token.nft?.capability === 'none');
    if (!returnOutput?.token?.nft) throw new Error('test could not locate the function-id return output');
    const commitment = hexToBin(returnOutput.token.nft.commitment);
    expect(commitment.length).toBeGreaterThan(0);
    commitment[commitment.length - 1] ^= 1;
    returnOutput.token.nft.commitment = binToHex(commitment);
    expect(vmAccepts(hostile)).toBe(false);
  }, 120_000);
});
