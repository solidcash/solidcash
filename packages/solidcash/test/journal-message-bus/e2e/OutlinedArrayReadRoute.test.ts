import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

describe('outlined dynamic-array reader in an atomic route', () => {
  it('reads a non-empty chunk from the route trailing run', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`contract C() {
      struct Pair { int left; int right; }
      Pair[] values;
      function seed() public { this.values.push(Pair(7, 11)); require(true); }
      function write(int index, int value) public {
        this.values[index].left = value;
        require(true);
      }
      function read(int index) public returns (int) { return this.values[index].left; }
    }`, {
      forceStateful: true, messageBus: true, messageBusKernel: false, suppressWarnings: true,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'read'))
      .toMatchObject({ eligible: true });
    const base = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, {
      saltContract: true,
    });
    const contract = StatefulContract.withCategory(base.withCategory(hexToBin(categoryId)), categoryId);
    await contract.call.seed().send();
    expect(artifact.abi.find((entry) => entry.name === 'read')?.dynamicReads).toEqual(['values']);
    expect((await contract.getState()).values).toHaveLength(1);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const direct = await contract.call.read(0n).build();
    const directTransaction = direct.buildLibauthTransaction();
    const directSources = generateLibauthSourceOutputs(direct.inputs);
    for (let inputIndex = 0; inputIndex < directTransaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({
        inputIndex, sourceOutputs: directSources, transaction: directTransaction,
      })), `direct input ${inputIndex}`).toBe(true);
    }
    const built = await contract.batch([{ function: 'read', args: [0n] }]).build();
    const transaction = built.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(built.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    const routeInput = built.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(routeInput).toBeGreaterThanOrEqual(0);
    const firstChunk = routeInput + artifact.messageBus!.route.blockLayout!.trailingBase!;
    expect(sourceOutputs[firstChunk]?.token?.nft?.capability).toBe('mutable');
    const forgedSources = sourceOutputs.map((output) => ({
      ...output,
      token: output.token === undefined ? undefined : {
        ...output.token,
        nft: output.token.nft === undefined ? undefined : {
          ...output.token.nft, commitment: output.token.nft.commitment.slice(),
        },
      },
    }));
    forgedSources[firstChunk].token!.nft!.commitment[0] ^= 1;
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: routeInput, sourceOutputs: forgedSources, transaction,
    }))).not.toBe(true);
  }, 120_000);
});
