import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  HashType,
  SignatureAlgorithm,
  SignatureTemplate,
  type TransactionBuilder,
} from '../../../src/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
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
  it('covenants an immutable aggregate sig[] leaf to all outputs', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`contract MultisigLedger() {
      int total;
      struct Authorization { sig[] proofs; int nonce; }
      function verify(Authorization auth, pubkey[] authorities) internal {
        require(checkMultiSig(auth.proofs, authorities));
      }
      function add(Authorization auth, pubkey[] authorities, int amount) public {
        verify(auth, authorities);
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
        function: 'add', callMode: 'call', args: [{ proofs, nonce: 0n }, [alicePub, bobPub], 1n],
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

  it('forwards detached signature arrays through typed graph edges', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const leafArtifact = compileString(`contract SignatureLeaf() {
      int total;
      function authorize(sig[] proofs, pubkey[] authorities, int amount) public {
        require(checkMultiSig(proofs, authorities));
        this.total = this.total + amount;
        require(true);
      }
      function authorizeFixed(sig[2] proofs, pubkey[2] authorities, int amount) public {
        require(checkMultiSig(proofs, authorities));
        this.total = this.total + amount;
        require(true);
      }
    }`, KERNEL);
    const leafBase = new Contract(leafArtifact, [], { provider });
    const leafSetup = await setupStatefulUtxos(
      provider, leafBase, leafArtifact.stateLayout!, { total: 0n }, { saltContract: true },
    );
    const leaf = StatefulContract.withCategory(
      leafBase.withCategory(hexToBin(leafSetup.categoryId)), leafSetup.categoryId,
    );
    const rootArtifact = compileString(`interface ISignatureLeaf {
      function authorize(sig[] proofs, pubkey[] authorities, int amount);
      function authorizeFixed(sig[2] proofs, pubkey[2] authorities, int amount);
    }
    contract SignatureRoot(address target) {
      function forward(sig[] proofs, pubkey[] authorities, int amount) public {
        ISignatureLeaf(target).authorize(proofs, authorities, amount);
        require(true);
      }
      function construct(sig first, sig second, pubkey[] authorities, int amount) public {
        ISignatureLeaf(target).authorize([first, second], authorities, amount);
        require(true);
      }
      function forwardFixed(sig[2] proofs, pubkey[2] authorities, int amount) public {
        ISignatureLeaf(target).authorizeFixed(proofs, authorities, amount);
        require(true);
      }
    }`, KERNEL);
    const rootBase = new Contract(rootArtifact, [hexToBin(leaf.inner.lockingBytecode)], { provider });
    const rootSetup = await setupStatefulUtxos(
      provider, rootBase, rootArtifact.stateLayout!, {}, { saltContract: true },
    );
    const root = StatefulContract.withCategory(
      rootBase.withCategory(hexToBin(rootSetup.categoryId)), rootSetup.categoryId,
    );
    const authorities = [alicePub, bobPub];
    const build = async (
      kind: 'forward' | 'construct' | 'fixed', hashType?: HashType,
    ): Promise<TransactionBuilder> => {
      const proofs = [ecdsa(alicePriv, hashType), ecdsa(bobPriv, hashType)];
      const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
      const rootCall = kind === 'forward'
        ? root.call.forward(proofs, authorities, 1n)
        : kind === 'construct'
          ? root.call.construct(proofs[0], proofs[1], authorities, 1n)
          : root.call.forwardFixed(proofs, authorities, 1n);
      const leafCall = kind === 'fixed'
        ? leaf.call.authorizeFixed(proofs, authorities, 1n)
        : leaf.call.authorize(proofs, authorities, 1n);
      return messageBus.compose({
        calls: [rootCall, leafCall],
        funder: fee,
        changeAddress: fee.unlocker.generateLockingBytecode(),
      }).build();
    };

    expect(vmAccepts(await build('forward'))).toBe(true);
    expect(vmAccepts(await build('construct'))).toBe(true);
    expect(vmAccepts(await build('fixed'))).toBe(true);
    await expect(build('forward', HashType.SIGHASH_NONE))
      .rejects.toThrow(/BCH-2026 preflight failed.*OP_VERIFY/);

    const tampered = await build('construct', HashType.SIGHASH_ALL);
    const transaction = tampered.buildLibauthTransaction();
    transaction.outputs.at(-1)!.valueSatoshis += 1n;
    const sourceOutputs = generateLibauthSourceOutputs(tampered.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    expect(transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
      vm.evaluate({ inputIndex, sourceOutputs, transaction }),
    ) === true)).toBe(false);
  }, 180_000);
});
