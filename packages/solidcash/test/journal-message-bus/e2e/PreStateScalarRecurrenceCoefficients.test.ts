import { binToHex } from '@bitauth/libauth';
import { encodeEventCommitment } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
} as const;

describe('authenticated pre-state scalar recurrence coefficients', () => {
  it('settles the exact 64-iteration boundary and rejects a forged coefficient-derived event', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`contract PreStateCoefficient() {
      int total;
      int coefficient;
      event Tick(int value);
      function run(int limit) public {
        for (int cursor = 1; cursor < limit; cursor = cursor + 2) {
          this.total = this.total + this.coefficient * cursor;
          emit Tick(this.total);
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'run'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { total: 0n, coefficient: 1n }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, setup.categoryId);
    const builder = await contract.batch([{ function: 'run', args: [129n] }]).build();
    const transaction = builder.buildLibauthTransaction();
    const event = artifact.events!.find((candidate) => candidate.name === 'Tick')!;
    const eventOutputs = transaction.outputs.filter(
      (output) => output.token?.nft?.capability === 'none',
    );
    expect(eventOutputs).toHaveLength(64);
    expect(eventOutputs.map((output) => binToHex(output.token!.nft!.commitment)))
      .toEqual(Array.from({ length: 64 }, (_, index) => {
        const value = BigInt(index + 1) ** 2n;
        return binToHex(encodeEventCommitment(event.parameters, [value], artifact.structs));
      }));

    const vm = createVirtualMachineBch2026ForProvider(provider);
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }

    const forgedIndex = transaction.outputs.indexOf(eventOutputs[31]);
    const forgedOutput = transaction.outputs[forgedIndex];
    const hostileTransaction = {
      ...transaction,
      outputs: transaction.outputs.map((output, index) => index === forgedIndex ? {
        ...output,
        token: {
          ...forgedOutput.token!,
          nft: { ...forgedOutput.token!.nft!, commitment: Uint8Array.of(1) },
        },
      } : output),
    };
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: 0, sourceOutputs, transaction: hostileTransaction,
    }))).not.toBe(true);
  }, 180_000);
});
