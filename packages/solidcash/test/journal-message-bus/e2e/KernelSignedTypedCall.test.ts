import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  HashType,
  SignatureTemplate,
  type TransactionBuilder,
} from '../../../src/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { alicePriv, alicePub } from '../../fixture/vars.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;

const vmAccepts = (builder: TransactionBuilder): boolean => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) === true);
};

describe('kernel signed typed external-call rows', () => {
  it('executes with SIGHASH_ALL and rejects NONE and SINGLE', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const receiverArtifact = compileString(`contract Receiver() {
      int stored;
      function store(int next) public { this.stored = next; require(true); }
      function check(int expected) public { require(this.stored == expected); }
    }`, KERNEL);
    const receiverBase = new Contract(receiverArtifact, [], { provider });
    const receiverSetup = await setupStatefulUtxos(
      provider, receiverBase, receiverArtifact.stateLayout!, { stored: 0n }, { saltContract: true },
    );
    const receiverInner = receiverBase.withCategory(hexToBin(receiverSetup.categoryId));
    const receiver = StatefulContract.withCategory(receiverInner, receiverSetup.categoryId);

    const senderArtifact = compileString(`interface IReceiver { function store(int next); }
      contract Sender(pubkey authority, address receiver) {
        function forward(sig proof, int next) public {
          require(checkSig(proof, authority));
          IReceiver(receiver).store(next);
          require(true);
        }
        function control() public { require(true); }
      }`, KERNEL);
    expect(senderArtifact.messageBus?.handlers.find((handler) => handler.name === 'forward')).toMatchObject({
      eligible: true,
      transactionSignaturePolicy: { hashType: 'all', parameterIndices: [0] },
    });
    const senderBase = new Contract(
      senderArtifact, [alicePub, hexToBin(receiverInner.lockingBytecode)], { provider },
    );
    const senderSetup = await setupStatefulUtxos(
      provider, senderBase, senderArtifact.stateLayout!, {}, { saltContract: true },
    );
    const sender = StatefulContract.withCategory(
      senderBase.withCategory(hexToBin(senderSetup.categoryId)), senderSetup.categoryId,
    );
    const build = async (hashType?: HashType): Promise<TransactionBuilder> => {
      const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
      return messageBus.compose({
        calls: [
          sender.call.forward(new SignatureTemplate(alicePriv, hashType), 7n),
          receiver.call.store(7n),
        ],
        funder: fee,
        changeAddress: fee.unlocker.generateLockingBytecode(),
      }).build();
    };

    expect(vmAccepts(await build(HashType.SIGHASH_ALL))).toBe(true);
    await expect(build(HashType.SIGHASH_NONE)).rejects.toThrow(/BCH-2026 preflight failed.*OP_VERIFY/);
    await expect(build(HashType.SIGHASH_SINGLE)).rejects.toThrow(/BCH-2026 preflight failed.*OP_VERIFY/);

    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    await expect(messageBus.compose({
      calls: [
        sender.call.forward(new SignatureTemplate(alicePriv), 7n),
        receiver.call.store(7n),
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(receiver.call.check(7n).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  }, 180_000);
});
