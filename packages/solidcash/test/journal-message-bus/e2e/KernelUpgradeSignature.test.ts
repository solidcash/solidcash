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

// An in-place upgrade leaves a participant's records at the old master lock (CRYPTO-4), so each upgradable Current
// keeps no record beyond its master NFT.
describe('kernel transaction-bound upgrade signature', () => {
  it('authenticates two detached aggregate signatures through one exact helper body', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const currentArtifact = compileString(`contract Current() {
      struct Auth { sig first; sig second; pubkey key; int nonce; }
      modifier authorized(Auth selected) {
        require(checkSig(selected.first, selected.key)); require(checkSig(selected.second, selected.key)); _;
      }
      function replace(Auth auth) public upgrade authorized(auth) { require(auth.nonce >= 0); }
    }`, KERNEL);
    const replacementArtifact = compileString(`contract Replacement() {
      struct Auth { sig first; sig second; pubkey key; int nonce; }
      function read() public view returns (int) { return 1; }
    }`, KERNEL);
    expect(currentArtifact.messageBus?.handlers.find((handler) => handler.name === 'replace'))
      .toMatchObject({
        eligible: true, usesTransactionSignature: true,
        transactionSignaturePolicy: { hashType: 'all', parameterIndices: [0] },
      });
    expect(currentArtifact.messageBus?.route.inputs).toContainEqual(expect.objectContaining({
      name: '__message_bus_sig_0_0_0_rows', type: 'sig[]',
    }));
    expect(currentArtifact.messageBus?.route.inputs).toContainEqual(expect.objectContaining({
      name: '__message_bus_sig_0_0_1_rows', type: 'sig[]',
    }));

    const base = new Contract(currentArtifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, base, currentArtifact.stateLayout!, {}, { saltContract: true },
    );
    const current = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );
    const coordinatorArtifact = compileString(`
      struct Auth { sig first; sig second; pubkey key; int nonce; }
      interface ICurrent { function replace(Auth auth); }
      contract Coordinator(address target) {
        function forward(Auth auth) public { ICurrent(target).replace(auth); require(true); }
      }
    `, KERNEL);
    const coordinatorBase = new Contract(
      coordinatorArtifact, [hexToBin(current.inner.lockingBytecode)], { provider },
    );
    const coordinatorSetup = await setupStatefulUtxos(
      provider, coordinatorBase, coordinatorArtifact.stateLayout!, {}, { saltContract: true },
    );
    const coordinator = StatefulContract.withCategory(
      coordinatorBase.withCategory(hexToBin(coordinatorSetup.categoryId)), coordinatorSetup.categoryId,
    );
    const build = async (hashType?: HashType): Promise<TransactionBuilder> => {
      const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
      const auth = {
        first: new SignatureTemplate(alicePriv, hashType), second: new SignatureTemplate(alicePriv, hashType), key: alicePub,
        nonce: 1n,
      };
      return messageBus.compose({
        calls: [
          coordinator.call.forward(auth),
          current.call.replace(auth).upgradeTo(replacementArtifact, []),
        ],
        funder: fee,
        changeAddress: fee.unlocker.generateLockingBytecode(),
      }).build();
    };

    expect(vmAccepts(await build())).toBe(true);
    await expect(build(HashType.SIGHASH_NONE))
      .rejects.toThrow(/BCH-2026 preflight failed.*OP_VERIFY/);

    const tampered = await build(HashType.SIGHASH_ALL);
    const transaction = tampered.buildLibauthTransaction();
    transaction.outputs.at(-1)!.valueSatoshis += 1n;
    const sourceOutputs = generateLibauthSourceOutputs(tampered.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    expect(transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
      vm.evaluate({ inputIndex, sourceOutputs, transaction }),
    ) === true)).toBe(false);
  }, 180_000);

  it('accepts SIGHASH_ALL and rejects weaker authorization and output tampering in the BCH-2026 VM', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const currentArtifact = compileString(`contract Current(pubkey authority) {
      function identity(sig value) internal pure returns (sig) { return value; }
      function verify(sig selected, pubkey key) internal { require(checkSig(selected, key)); }
      function replace(sig proof) public upgrade {
        verify(identity(proof), authority);
        require(true);
      }
    }`, KERNEL);
    const replacementArtifact = compileString(`contract Replacement(pubkey authority) {
      function read() public view returns (int) { return 1; }
    }`, KERNEL);
    expect(currentArtifact.messageBus?.handlers.find((handler) => handler.name === 'replace'))
      .toMatchObject({
        eligible: true, usesTransactionSignature: true,
        transactionSignaturePolicy: {
          hashType: 'all', parameterIndices: [0],
          coveredBytecodes: [expect.objectContaining({ parameterIndex: 0 })],
        },
      });

    const base = new Contract(currentArtifact, [alicePub], { provider });
    const setup = await setupStatefulUtxos(
      provider, base, currentArtifact.stateLayout!, {}, { saltContract: true },
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

  it('allows an all-output-signed ordinary leaf in a graph containing another participant upgrade', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const currentArtifact = compileString(`contract Current() {
      function replace() public upgrade { require(true); }
    }`, KERNEL);
    const replacementArtifact = compileString(`contract Replacement() {
      function read() public view returns (int) { return 1; }
    }`, KERNEL);
    const currentBase = new Contract(currentArtifact, [], { provider });
    const currentSetup = await setupStatefulUtxos(
      provider, currentBase, currentArtifact.stateLayout!, {}, { saltContract: true },
    );
    const current = StatefulContract.withCategory(
      currentBase.withCategory(hexToBin(currentSetup.categoryId)), currentSetup.categoryId,
    );
    const authorizerArtifact = compileString(`contract Authorizer(pubkey authority) {
      int approvals;
      function verify(sig selected, pubkey key) private { require(checkSig(selected, key)); }
      function authorize(sig proof) public {
        this.approvals = this.approvals + 1;
        verify(proof, authority);
        require(true);
      }
    }`, KERNEL);
    expect(authorizerArtifact.messageBus?.handlers.find((handler) => handler.name === 'authorize'))
      .toMatchObject({
        eligible: true,
        transactionSignaturePolicy: { hashType: 'all', parameterIndices: [0] },
      });
    const authorizerBase = new Contract(authorizerArtifact, [alicePub], { provider });
    const authorizerSetup = await setupStatefulUtxos(
      provider, authorizerBase, authorizerArtifact.stateLayout!, { approvals: 0n }, { saltContract: true },
    );
    const authorizer = StatefulContract.withCategory(
      authorizerBase.withCategory(hexToBin(authorizerSetup.categoryId)), authorizerSetup.categoryId,
    );
    const coordinatorArtifact = compileString(`interface IAuthorizer { function authorize(sig proof); }
      interface ICurrent { function replace(); }
      contract Coordinator(address authorizer, address target) {
        function execute(sig proof) public {
          IAuthorizer(authorizer).authorize(proof);
          ICurrent(target).replace();
          require(true);
        }
      }`, KERNEL);
    const coordinatorBase = new Contract(coordinatorArtifact, [
      hexToBin(authorizer.inner.lockingBytecode), hexToBin(current.inner.lockingBytecode),
    ], { provider });
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
          coordinator.call.execute(signature),
          authorizer.call.authorize(signature),
          current.call.replace().upgradeTo(replacementArtifact, []),
        ],
        funder: fee,
        changeAddress: fee.unlocker.generateLockingBytecode(),
      }).build();
    };

    const valid = await build(new SignatureTemplate(alicePriv));
    expect(vmAccepts(valid)).toBe(true);
    await expect(build(new SignatureTemplate(alicePriv, HashType.SIGHASH_NONE)))
      .rejects.toThrow(/BCH-2026 preflight failed.*OP_VERIFY/);

    const tampered = await build(new SignatureTemplate(alicePriv, HashType.SIGHASH_ALL));
    const transaction = tampered.buildLibauthTransaction();
    transaction.outputs.at(-1)!.valueSatoshis += 1n;
    const sources = generateLibauthSourceOutputs(tampered.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    expect(transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
      vm.evaluate({ inputIndex, sourceOutputs: sources, transaction }),
    ) === true)).toBe(false);
  }, 180_000);
});
