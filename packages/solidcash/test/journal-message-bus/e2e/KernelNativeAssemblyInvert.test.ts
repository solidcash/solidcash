import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const vmAccepts = (builder: TransactionBuilder): boolean => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) === true);
};

describe('kernel native assembly OP_INVERT', () => {
  it('executes a closed byte inversion in the BCH-2026 VM and rejects a false result', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`contract Invert() {
      function valid() public {
        assembly { 0xa50f OP_INVERT 0x5af0 OP_EQUALVERIFY }
        require(true);
      }
      function invalid() public {
        assembly { 0xa50f OP_INVERT 0x5af1 OP_EQUALVERIFY }
        require(true);
      }
    }`, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
      suppressWarnings: true,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'valid')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'invalid')?.eligible).toBe(true);
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );

    const built = await contract.batch([{ function: 'valid', args: [] }]).build();
    expect(vmAccepts(built)).toBe(true);
    const invalid = await contract.batch([{ function: 'invalid', args: [] }]).build();
    expect(vmAccepts(invalid)).toBe(false);
  }, 120_000);
});
