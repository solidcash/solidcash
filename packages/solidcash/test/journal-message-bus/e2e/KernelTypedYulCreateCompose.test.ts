import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileStringMulti } from '@solidcash/solidc';
import { parsePushdataCommitment } from '@solidcash/utils';
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
  it.each(['create', 'create2'] as const)(
    'materializes compiler-resolved constructor args for %s and rejects a forged genesis commitment', async (opcode) => {
      const provider = createMessageBusCapstoneTestProvider();
      const artifacts = compileStringMulti(`
      contract Unit(int initial) {
        int marker;
        constructor() { this.marker = initial; }
      }
      interface IFactory { function materialize(int initial, bytes32 salt) external; }
      contract Factory() {
        function materialize(int initial, bytes32 salt) public {
          bytes memory creation = abi.encodePacked(type(Unit).creationCode, abi.encode(initial));
          assembly { let child := ${opcode}(0, add(creation, 0x20), mload(creation)${opcode === 'create2' ? ', salt' : ''}) }
          require(true);
        }
      }
      contract Driver(address factory) {
        function run(int initial, bytes32 salt) public { IFactory(factory).materialize(initial, salt); require(true); }
      }
    `, {
        forceStateful: true,
        messageBus: true,
        messageBusKernel: true,
        evmCompat: true,
        suppressWarnings: true,
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
      const handler = artifacts.Factory.messageBus?.handlers.find((candidate) => candidate.name === 'materialize');
      expect(handler).toMatchObject({
        eligible: true,
        childDeployments: [{
          contractName: 'Unit', totalOutputCount: 2,
          constructorArgs: [{ kind: 'handlerInput', inputIndex: 0 }],
        }],
      });
      if (opcode === 'create2') {
        expect(handler?.childDeployments?.[0].salt).toMatchObject({ kind: 'handlerInput', inputIndex: 1 });
      } else {
        expect(handler?.childDeployments?.[0]).not.toHaveProperty('salt');
      }

      const fee = await createBareP2pkhFeeFunder(provider, 100_000n);
      const genesis = await createBareP2pkhFeeFunder(provider, 20_000n);
      const salt = hexToBin('42'.repeat(32));
      const build = (): Promise<TransactionBuilder> => messageBus.compose({
        preparedCalls: [
          { contract: driver, functionName: 'run', args: [23n, salt] },
          { contract: factory, functionName: 'materialize', args: [23n, salt] },
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
      )).toMatchObject({ marker: 23n });

      const forged = await build();
      const forgedIndex = forged.outputs.findIndex((output) =>
        output.token?.category === genesis.utxo.txid && output.token.nft?.capability === 'mutable');
      const commitment = hexToBin(forged.outputs[forgedIndex].token!.nft!.commitment);
      commitment[commitment.length - 1] ^= 0x01;
      forged.outputs[forgedIndex].token!.nft!.commitment = binToHex(commitment);
      expect(vmRejects(forged)).toBe(true);
    }, 120_000);
});
