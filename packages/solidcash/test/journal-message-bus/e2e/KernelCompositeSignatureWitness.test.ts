import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  SignatureTemplate,
} from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import {
  createBareP2pkhFeeFunder, createTestProvider, setupStatefulUtxos,
} from '../../test-util.js';
import {
  alicePriv, alicePub, bobPriv, bobPub,
} from '../../fixture/vars.js';

const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;

describe('kernel composite transaction-signature witnesses', () => {
  it('restores and checks fixed and dynamic signature leaves in the selected row', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract NeutralAuthorization() {
      struct Proof { sig authorization; pubkey owner; }
      struct Envelope { Proof[2] fixedProofs; Proof[][] proofGroups; int nonce; }
      function apply(Envelope envelope) public {
        require(checkSig(envelope.fixedProofs[1].authorization, envelope.fixedProofs[1].owner));
        require(envelope.proofGroups.length == 1 && envelope.proofGroups[0].length == 1);
        require(checkSig(
          envelope.proofGroups[0][0].authorization,
          envelope.proofGroups[0][0].owner
        ));
        require(envelope.nonce >= 0);
      }
    }`, KERNEL);

    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.route.inputs).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: '__message_bus_sig_0_0_0_rows', type: 'sig[2][]' }),
      expect.objectContaining({ name: '__message_bus_sig_0_0_1_rows', type: 'sig[][][]' }),
    ]));

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    // Struct arguments also accept their canonical positional ABI-tuple representation. Use that form all the
    // way down so signature extraction is proven against tuple indices, not only object field names.
    const proof = (owner: Uint8Array, privateKey: Uint8Array): [SignatureTemplate, Uint8Array] => [
      new SignatureTemplate(privateKey), owner,
    ];
    // FunctionArgument cannot express a positional struct tuple mixing signatures and byte fields.
    const envelope = (nonce: bigint): FunctionArgument => ([
      [proof(alicePub, alicePriv), proof(bobPub, bobPriv)],
      [[proof(alicePub, alicePriv)]],
      nonce,
    ] as unknown as FunctionArgument);
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.batch([{ function: 'apply', args: [envelope(1n)] }]);
    const fee = await createBareP2pkhFeeFunder(provider);
    call.addInput(fee.utxo, fee.unlocker);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 180_000);
});
