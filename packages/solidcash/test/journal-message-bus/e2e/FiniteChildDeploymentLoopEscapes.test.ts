import { hexToBin } from '@bitauth/libauth';
import { parsePushdataCommitment } from '@solidcash/utils';
import type { Artifact } from '@solidcash/utils';
import { compileStringMulti } from '@solidcash/solidc';
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

describe('finite child-deployment loop escapes', () => {
  it('settles static continue/break deployments in source order and rejects a forged child', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`contract Unit(int seed) {
        int marker;
        constructor() { this.marker = seed; }
        function keep() public { require(true); }
      }
      interface IFactory { function create(int base); }
      contract Factory() {
        function create(int base) public {
          for (int i = 0; i < 6; i = i + 1) {
            if (i % 2 == 0) continue;
            Unit child = new Unit(base + i);
            if (i == 3) break;
          }
          require(true);
        }
      }
      contract Driver(address factory) {
        function run(int base) public { IFactory(factory).create(base); require(true); }
      }`, { forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000 });
    const connect = async (artifact: Artifact, args: readonly unknown[] = []): Promise<StatefulContract> => {
      const base = new Contract(artifact, args as never[], { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const factory = (await connect(artifacts.Factory)).registerChild(artifacts.Unit);
    const driver = await connect(artifacts.Driver, [hexToBin(factory.inner.lockingBytecode)]);
    const handler = artifacts.Factory.messageBus?.handlers.find((candidate) => candidate.name === 'create');
    expect(handler).toMatchObject({ eligible: true });
    expect(handler?.childDeployments?.map((site) => [site.siteIndex, site.spanOffset, site.occurrence]))
      .toEqual([[0, 0, 'once'], [1, 2, 'once']]);

    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const geneses = await Promise.all(Array.from({ length: 2 }, () =>
      createBareP2pkhFeeFunder(provider, 20_000n)));
    const build = (): Promise<TransactionBuilder> => messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'run', args: [7n] },
        { contract: factory, functionName: 'create', args: [7n] },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
      childDeployments: geneses.map((funder, siteIndex) => ({ invocationIndex: 1, siteIndex, funder })),
    }).build();

    const canonical = await build();
    expect(vmRejects(canonical)).toBe(false);
    const childOutputs = geneses.map((genesis) => {
      const index = canonical.outputs.findIndex((output) => output.token?.category === genesis.utxo.txid
        && output.token.nft?.capability === 'mutable');
      expect(index).toBeGreaterThanOrEqual(0);
      return { index, output: canonical.outputs[index] };
    });
    expect(childOutputs.map(({ index }) => index)).toEqual([
      childOutputs[0].index, childOutputs[0].index + 2,
    ]);
    expect(childOutputs.map(({ output }) => parsePushdataCommitment(
      output.token!.nft!.commitment, artifacts.Unit.stateLayout!, 0,
    ).marker)).toEqual([8n, 10n]);

    const forged = await build();
    forged.outputs.find((output) => output.token?.category === geneses[1].utxo.txid
      && output.token.nft?.capability === 'mutable')!.token!.nft!.commitment = '09';
    expect(vmRejects(forged)).toBe(true);
  }, 120_000);
});
