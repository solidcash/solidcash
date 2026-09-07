import { hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract, HashType, messageBus, SignatureTemplate, StatefulContract, type TransactionBuilder,
} from '../../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { alicePriv, alicePub } from '../../fixture/vars.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true,
} as const;

const vmAccepts = (builder: TransactionBuilder): boolean => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) === true);
};

describe('kernel transaction-bound upgrade signature', () => {
  it('accepts SIGHASH_ALL and rejects weaker authorization and output tampering in the BCH-2026 VM', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const currentArtifact = compileString(`contract Current(pubkey authority) {
      int marker;
      function replace(sig proof) public upgrade { require(checkSig(proof, authority)); }
    }`, KERNEL);
    const replacementArtifact = compileString(`contract Replacement(pubkey authority) {
      int marker;
      function read() public view returns (int) { return this.marker; }
    }`, KERNEL);
    expect(currentArtifact.messageBus?.handlers.find((handler) => handler.name === 'replace'))
      .toMatchObject({ eligible: true, usesTransactionSignature: true });

    const base = new Contract(currentArtifact, [alicePub], { provider });
    const setup = await setupStatefulUtxos(
      provider, base, currentArtifact.stateLayout!, { marker: 7n }, { saltContract: true },
    );
    const current = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );
    const coordinatorArtifact = compileString(`interface ICurrent {
      function replace(sig proof);
    }
    contract Coordinator(address target) {
      function forward(sig proof) public {
        ICurrent(target).replace(proof);
        require(true);
      }
    }`, KERNEL);
    const coordinatorBase = new Contract(
      coordinatorArtifact, [hexToBin(current.inner.lockingBytecode)], { provider },
    );
    const coordinatorSetup = await setupStatefulUtxos(
      provider, coordinatorBase, coordinatorArtifact.stateLayout!, {}, { saltContract: true },
    );
    const coordinator = StatefulContract.withCategory(
      coordinatorBase.withCategory(hexToBin(coordinatorSetup.categoryId)), coordinatorSetup.categoryId,
    );
    const build = async (signature: SignatureTemplate): Promise<TransactionBuilder> => {
      const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
      return messageBus.compose({
        calls: [
          coordinator.call.forward(signature),
          current.call.replace(signature).upgradeTo(replacementArtifact, [alicePub]),
        ],
        funder: fee,
        changeAddress: fee.unlocker.generateLockingBytecode(),
      }).build();
    };

    const valid = await build(new SignatureTemplate(alicePriv));
    expect(vmAccepts(valid)).toBe(true);
    const allWithoutUtxos = await build(new SignatureTemplate(alicePriv, HashType.SIGHASH_ALL));
    expect(vmAccepts(allWithoutUtxos)).toBe(true);

    await expect(build(new SignatureTemplate(alicePriv, HashType.SIGHASH_NONE)))
      .rejects.toThrow(/BCH-2026 preflight failed.*OP_VERIFY/);

    const tampered = await build(new SignatureTemplate(alicePriv));
    const tamperedTransaction = tampered.buildLibauthTransaction();
    tamperedTransaction.outputs.at(-1)!.valueSatoshis += 1n;
    const sources = generateLibauthSourceOutputs(tampered.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    expect(tamperedTransaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
      vm.evaluate({ inputIndex, sourceOutputs: sources, transaction: tamperedTransaction }),
    ) === true)).toBe(false);
  }, 180_000);
});
