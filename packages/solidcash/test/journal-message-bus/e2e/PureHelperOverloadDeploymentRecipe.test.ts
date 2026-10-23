import { hexToBin } from '@bitauth/libauth';
import { compileStringMulti } from '@solidcash/solidc';
import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
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

describe('resolved pure-helper overload deployment recipe', () => {
  it('settles the exact overload and rejects a redirected child output', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`
      contract Child(bytes32 digest) {
        int marker;
        function keep() public { require(true); }
      }
      interface IFactory { function create(bytes2 seed); }
      contract Factory() {
        function derive(bytes2 value) internal pure returns (bytes32) { return sha256(value); }
        function derive(bytes3 value) internal pure returns (bytes32) { return hash256(value); }
        function create(bytes2 seed) public {
          Child child = new Child(derive(seed));
          require(true);
        }
      }
      contract Driver(address factory) {
        function run(bytes2 seed) public {
          IFactory(factory).create(seed);
          require(true);
        }
      }
    `, KERNEL);
    const connect = async (
      artifact: Artifact, constructorArgs: readonly unknown[] = [],
    ): Promise<StatefulContract> => {
      const base = new Contract(artifact, constructorArgs as never[], { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const factory = (await connect(artifacts.Factory)).registerChild(artifacts.Child);
    const driver = await connect(artifacts.Driver, [hexToBin(factory.inner.lockingBytecode)]);
    expect(artifacts.Factory.messageBus?.handlers.find((candidate) => candidate.name === 'create'))
      .toMatchObject({
        eligible: true,
        childDeployments: [{ constructorArgs: [{
          kind: 'hash', algorithm: 'sha256', resultType: 'bytes32',
        }] }],
      });

    const fee = await createBareP2pkhFeeFunder(provider, 100_000n);
    const genesis = await createBareP2pkhFeeFunder(provider, 20_000n);
    const build = (): Promise<TransactionBuilder> => messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'run', args: [hexToBin('abcd')] },
        { contract: factory, functionName: 'create', args: [hexToBin('abcd')] },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
      childDeployments: [{ invocationIndex: 1, siteIndex: 0, funder: genesis }],
    }).build();

    const canonical = await build();
    expect(vmRejects(canonical)).toBe(false);
    const redirected = await build();
    const childOutput = redirected.outputs.find((output) => output.token?.category === genesis.utxo.txid);
    expect(childOutput).toBeDefined();
    childOutput!.to = hexToBin('6a');
    expect(vmRejects(redirected)).toBe(true);
  }, 120_000);
});
