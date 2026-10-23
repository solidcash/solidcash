import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import {
  createBareP2pkhFeeFunder, createTestProvider, genesisFtContainer, setupStatefulUtxos,
} from '../../test-util.js';

const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;

describe('kernel external token-container composition', () => {
  it.each(['public', 'external'] as const)(
    'settles and authenticates a token transfer through a %s source handler', async (visibility) => {
      const provider = createTestProvider();
      const artifact = compileString(`contract Vault() {
        function move(bytes32 category, bytes recipient, int amount) ${visibility} {
          this.tokens[category].transfer(recipient, amount);
          require(true);
        }
      }`, KERNEL);
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'move')).toMatchObject({
        eligible: true,
      });

      const inner = new Contract(artifact, [], { provider });
      const { categoryId } = await setupStatefulUtxos(
        provider, inner, artifact.stateLayout!, {}, { saltContract: true },
      );
      const contract = StatefulContract.withCategory(inner, categoryId);
      // Containers bind the master's lock: fund them for the category-pinned master.
      const token = await genesisFtContainer(provider, contract.inner, categoryId, [100n]);
      const recipientFunder = await createBareP2pkhFeeFunder(provider, 100_000n);
      const recipient = recipientFunder.unlocker.generateLockingBytecode();
      const builder = await contract.batch([{
        function: 'move', args: [hexToBin(token.category), recipient, 7n],
      }]).build();
      const transaction = builder.buildLibauthTransaction();
      const tokenOutputs = transaction.outputs.filter((output) => output.token
        && binToHex(output.token.category) === token.category);
      expect(tokenOutputs.some((output) => output.token?.amount === 7n
        && binToHex(output.lockingBytecode) === binToHex(recipient))).toBe(true);
      expect(tokenOutputs.some((output) => output.token?.amount === 93n)).toBe(true);

      const vm = createVirtualMachineBch2026ForProvider(provider);
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
        expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
          `${visibility} input ${inputIndex}`).toBe(true);
      }

      const hostile = builder.buildLibauthTransaction();
      const payment = hostile.outputs.find((output) => output.token?.amount === 7n
        && binToHex(output.lockingBytecode) === binToHex(recipient));
      expect(payment).toBeDefined();
      payment!.token!.amount += 1n;
      const routeInput = builder.inputs.findIndex((input) =>
        'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
      expect(vm.stateSuccess(vm.evaluate({ inputIndex: routeInput, sourceOutputs, transaction: hostile })))
        .not.toBe(true);
    },
    180_000,
  );
});
