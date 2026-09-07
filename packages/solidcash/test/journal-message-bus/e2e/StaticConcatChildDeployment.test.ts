import { binToHex, encodeTransaction, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { compileStringMulti } from 'solidc';
import { parsePushdataCommitment, sha256 } from '@solidcash/utils';
import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract, messageBus } from '../../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { assertAuthenticatingVmEvidence } from '../vm-evidence.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;

const vmRejects = (candidate: TransactionBuilder): boolean => {
  assertAuthenticatingVmEvidence(candidate);
  const transaction = candidate.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(candidate.inputs);
  const vm = createVirtualMachineBch2026ForProvider(candidate.provider);
  return transaction.inputs.some((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) !== true);
};

describe('static concat child deployment', () => {
  it.each([
    {
      label: 'bytes.concat',
      child: `contract Child(bytes5 joined) {
        bytes5 stored;
        constructor() { this.stored = joined; }
        function keep() public { require(true); }
      }`,
      parameterList: 'bytes2 first, bytes3 second',
      parameterNames: 'first, second',
      deploymentExpression: 'bytes5(bytes.concat(first, second))',
      args: [hexToBin('abcd'), hexToBin('cafe01')],
      expectedState: hexToBin('abcdcafe01'),
      expectedRecipe: { kind: 'cast', resultType: 'bytes5', operand: { kind: 'concat', resultType: 'bytes' } },
    },
    {
      label: 'string.concat',
      child: `contract Child(bytes32 digest) {
        bytes32 stored;
        constructor() { this.stored = digest; }
        function keep() public { require(true); }
      }`,
      parameterList: 'string first, string second',
      parameterNames: 'first, second',
      deploymentExpression: 'sha256(string.concat(first, second))',
      args: ['Stra', 'ße'],
      expectedState: sha256(utf8ToBin('Straße')),
      expectedRecipe: {
        kind: 'hash', algorithm: 'sha256',
        operand: { kind: 'concat', resultType: 'string' },
      },
    },
  ])('admits, materializes, and VM-authenticates $label', async ({
    child, parameterList, parameterNames, deploymentExpression, args, expectedState, expectedRecipe,
  }) => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`${child}
      interface IFactory { function create(${parameterList}); }
      contract Factory() {
        function create(${parameterList}) public {
          Child child = new Child(${deploymentExpression});
          require(true);
        }
      }
      contract Driver(address factory) {
        function run(${parameterList}) public {
          IFactory(factory).create(${parameterNames});
          require(true);
        }
      }
    `, KERNEL);
    const connect = async (artifact: Artifact, constructorArgs: readonly unknown[] = []): Promise<StatefulContract> => {
      const base = new Contract(artifact, constructorArgs as never[], { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const factory = (await connect(artifacts.Factory)).registerChild(artifacts.Child);
    const driver = await connect(artifacts.Driver, [hexToBin(factory.inner.lockingBytecode)]);
    expect(artifacts.Factory.messageBus?.handlers.find((handler) => handler.name === 'create')).toMatchObject({
      eligible: true,
      childDeployments: [{ constructorArgs: [expectedRecipe] }],
    });

    const fee = await createBareP2pkhFeeFunder(provider, 100_000n);
    const genesis = await createBareP2pkhFeeFunder(provider, 20_000n);
    const transaction = await messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'run', args },
        { contract: factory, functionName: 'create', args },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
      childDeployments: [{ invocationIndex: 1, siteIndex: 0, funder: genesis }],
    }).build();
    expect(vmRejects(transaction)).toBe(false);
    const dataOutput = transaction.outputs.find((output) => output.token?.category === genesis.utxo.txid
      && output.token.nft?.capability === 'mutable');
    expect(dataOutput).toBeDefined();
    const state = parsePushdataCommitment(
      dataOutput!.token!.nft!.commitment, artifacts.Child.stateLayout!, 0,
    );
    expect(binToHex(state.stored as Uint8Array)).toBe(binToHex(expectedState));

    dataOutput!.token!.nft!.commitment = '01';
    expect(vmRejects(transaction)).toBe(true);
    // Keep the raw transaction encoding exercised too: all recipe-derived outputs must remain serializable.
    expect(encodeTransaction(transaction.buildLibauthTransaction()).length).toBeGreaterThan(0);
  }, 120_000);
});
