import { hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract, HashType, SignatureAlgorithm, SignatureTemplate, StatefulContract,
  type TransactionBuilder,
} from '../../../src/index.js';
import { encodeMessageBatch } from '../../../src/message-bus/message-bus.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { alicePriv, alicePub, bobPriv, bobPub } from '../../fixture/vars.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true,
} as const;

const ecdsa = (privateKey: Uint8Array, hashType?: HashType): SignatureTemplate =>
  new SignatureTemplate(privateKey, hashType, SignatureAlgorithm.ECDSA);

const vmAccepts = (builder: TransactionBuilder): boolean => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) === true);
};

describe('kernel transaction-bound multisignature arrays', () => {
  it('covenants every direct sig[] element to all outputs', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`contract MultisigLedger() {
      int total;
      function add(sig[] proofs, pubkey[] authorities, int amount) public {
        require(checkMultiSig(proofs, authorities));
        this.total = this.total + amount;
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'add'))
      .toMatchObject({
        eligible: true,
        usesTransactionSignature: true,
        transactionSignaturePolicy: { hashType: 'all', parameterIndices: [0] },
      });
    expect(artifact.messageBus?.route.inputs).toContainEqual(expect.objectContaining({
      name: '__message_bus_sig_0_0_rows', type: 'sig[][]',
    }));

    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, { total: 0n }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );
    const build = async (proofs: SignatureTemplate[]): Promise<TransactionBuilder> => {
      const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
      const encoded = encodeMessageBatch(artifact, [{
        function: 'add', callMode: 'call', args: [proofs, [alicePub, bobPub], 1n],
      }]);
      const call = contract._batchRaw(encoded.blob, encoded.routeWitnesses);
      call.addInput(fee.utxo, fee.unlocker);
      return call.build();
    };

    const valid = await build([ecdsa(alicePriv), ecdsa(bobPriv)]);
    expect(vmAccepts(valid)).toBe(true);
    const allWithoutUtxos = await build([
      ecdsa(alicePriv, HashType.SIGHASH_ALL), ecdsa(bobPriv, HashType.SIGHASH_ALL),
    ]);
    expect(vmAccepts(allWithoutUtxos)).toBe(true);

    const empty = await build([]);
    expect(vmAccepts(empty)).toBe(false);
    const mixedHashTypes = await build([
      ecdsa(alicePriv), ecdsa(bobPriv, HashType.SIGHASH_NONE),
    ]);
    expect(vmAccepts(mixedHashTypes)).toBe(false);

    const tampered = await build([
      ecdsa(alicePriv, HashType.SIGHASH_ALL), ecdsa(bobPriv, HashType.SIGHASH_ALL),
    ]);
    const transaction = tampered.buildLibauthTransaction();
    transaction.outputs.at(-1)!.valueSatoshis += 1n;
    const sourceOutputs = generateLibauthSourceOutputs(tampered.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    expect(transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
      vm.evaluate({ inputIndex, sourceOutputs, transaction }),
    ) === true)).toBe(false);
  }, 180_000);
});
