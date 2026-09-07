import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileStringMulti } from 'solidc';
import { parsePushdataCommitment } from '@solidcash/utils';
import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract, messageBus } from '../../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { assertAuthenticatingVmEvidence } from '../vm-evidence.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const vmRejects = (candidate: TransactionBuilder): boolean => {
  assertAuthenticatingVmEvidence(candidate);
  const transaction = candidate.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(candidate.inputs);
  const vm = createVirtualMachineBch2026ForProvider(candidate.provider);
  return transaction.inputs.some((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) !== true);
};

describe('typed Yul CREATE kernel composition', () => {
  it('materializes the compiler-resolved child and rejects a forged genesis commitment', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`
      contract Unit() {
        int marker;
        constructor() { this.marker = 7; }
      }
      interface IFactory { function materialize() external; }
      contract Factory() {
        function materialize() public {
          bytes memory creation = type(Unit).creationCode;
          assembly { let child := create(0, add(creation, 0x20), mload(creation)) }
          require(true);
        }
      }
      contract Driver(address factory) {
        function run() public { IFactory(factory).materialize(); require(true); }
      }
    `, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      solidityImportCompat: true,
      maximumInputBytes: 1_000_000,
    });
    const connect = async (
      artifact: Artifact, constructorArgs: readonly unknown[] = [],
    ): Promise<StatefulContract> => {
      const base = new Contract(artifact, constructorArgs as never[], { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const factory = (await connect(artifacts.Factory)).registerChild(artifacts.Unit);
    const driver = await connect(artifacts.Driver, [hexToBin(factory.inner.lockingBytecode)]);
    expect(artifacts.Factory.messageBus?.handlers.find((candidate) => candidate.name === 'materialize'))
      .toMatchObject({
        eligible: true,
        childDeployments: [{ contractName: 'Unit', totalOutputCount: 2 }],
      });

    const fee = await createBareP2pkhFeeFunder(provider, 100_000n);
    const genesis = await createBareP2pkhFeeFunder(provider, 20_000n);
    const build = (): Promise<TransactionBuilder> => messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'run', args: [] },
        { contract: factory, functionName: 'materialize', args: [] },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
      childDeployments: [{ invocationIndex: 1, siteIndex: 0, funder: genesis }],
    }).build();

    const canonical = await build();
    expect(vmRejects(canonical)).toBe(false);
    const dataOutputIndex = canonical.outputs.findIndex((output) =>
      output.token?.category === genesis.utxo.txid && output.token.nft?.capability === 'mutable');
    expect(dataOutputIndex).toBeGreaterThanOrEqual(0);
    expect(parsePushdataCommitment(
      canonical.outputs[dataOutputIndex].token!.nft!.commitment, artifacts.Unit.stateLayout!, 0,
    )).toMatchObject({ marker: 7n });

    const forged = await build();
    const forgedIndex = forged.outputs.findIndex((output) =>
      output.token?.category === genesis.utxo.txid && output.token.nft?.capability === 'mutable');
    const commitment = hexToBin(forged.outputs[forgedIndex].token!.nft!.commitment);
    commitment[commitment.length - 1] ^= 0x01;
    forged.outputs[forgedIndex].token!.nft!.commitment = binToHex(commitment);
    expect(vmRejects(forged)).toBe(true);
  }, 120_000);
});
