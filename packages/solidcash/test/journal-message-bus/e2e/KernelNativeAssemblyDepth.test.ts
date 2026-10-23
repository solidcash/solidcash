import { binToHex, hexToBin } from '@bitauth/libauth';
import { parsePushdataCommitment } from '@solidcash/utils';
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

describe('kernel native assembly discarded ambient reads', () => {
  it.each([
    ['stack depth', 'OP_DEPTH OP_DROP'],
    ['active bytecode', 'OP_ACTIVEBYTECODE OP_DROP'],
  ])('executes a discarded %s independently of the route frame and preserves state authentication', async (_name, asm) => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`contract Register() {
      int marker;
      function update(int next) public {
        assembly { ${asm} }
        this.marker = next;
        require(true);
      }
    }`, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
      suppressWarnings: true,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'update'))
      .toMatchObject({ eligible: true });
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );

    const canonical = await contract.batch([{ function: 'update', args: [23n] }]).build();
    expect(vmAccepts(canonical)).toBe(true);
    const stateIndex = canonical.outputs.findIndex((output) =>
      output.token?.category === setup.categoryId && output.token.nft?.capability === 'mutable');
    expect(stateIndex).toBeGreaterThanOrEqual(0);
    expect(parsePushdataCommitment(
      canonical.outputs[stateIndex].token!.nft!.commitment, artifact.stateLayout!, 0,
    )).toMatchObject({ marker: 23n });

    const forged = await contract.batch([{ function: 'update', args: [23n] }]).build();
    const forgedStateIndex = forged.outputs.findIndex((output) =>
      output.token?.category === setup.categoryId && output.token.nft?.capability === 'mutable');
    const commitment = hexToBin(forged.outputs[forgedStateIndex].token!.nft!.commitment);
    commitment[commitment.length - 1] ^= 0x01;
    forged.outputs[forgedStateIndex].token!.nft!.commitment = binToHex(commitment);
    expect(vmAccepts(forged)).toBe(false);
  }, 120_000);
});
