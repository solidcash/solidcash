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

describe('kernel native assembly literal OP_IFDUP', () => {
  it('executes both deterministic heights and rejects a false result in the BCH-2026 VM', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`contract ConditionalDuplicate() {
      function truthy() public {
        assembly { OP_7 OP_IFDUP OP_7 OP_NUMEQUALVERIFY OP_7 OP_NUMEQUALVERIFY }
        require(true);
      }
      function falsey() public {
        assembly { OP_0 OP_IFDUP OP_0 OP_NUMEQUALVERIFY }
        require(true);
      }
      function invalid() public {
        assembly { OP_7 OP_IFDUP OP_8 OP_NUMEQUALVERIFY OP_7 OP_NUMEQUALVERIFY }
        require(true);
      }
    }`, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
      suppressWarnings: true,
    });
    for (const name of ['truthy', 'falsey', 'invalid']) {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === name)?.eligible).toBe(true);
    }
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );

    expect(vmAccepts(await contract.batch([{ function: 'truthy', args: [] }]).build())).toBe(true);
    expect(vmAccepts(await contract.batch([{ function: 'falsey', args: [] }]).build())).toBe(true);
    expect(vmAccepts(await contract.batch([{ function: 'invalid', args: [] }]).build())).toBe(false);
  }, 120_000);
});
