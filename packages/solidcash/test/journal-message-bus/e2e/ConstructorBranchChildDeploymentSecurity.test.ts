import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileStringMulti } from '@solidcash/solidc';
import { parsePushdataCommitment } from '@solidcash/utils';
import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
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

describe('conditional child-constructor genesis transcript security', () => {
  it('authenticates both constructor branches and rejects a forged child commitment', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`contract Unit(int seed, bool choose) {
        int baseline;
        int selected;
        int marker;
        constructor() {
          int adjusted = seed + 1;
          bool direction = choose;
          this.baseline = adjusted;
          this.selected = adjusted;
          if (direction) {
            this.baseline = adjusted + 5;
            this.selected = adjusted * 2;
            this.marker = int(1);
          } else {
            this.selected = adjusted + 3;
            this.marker = int(2);
          }
          require(seed >= 0);
        }
      }
      interface ICoordinator { function create(int seed, bool choose); }
      contract Coordinator() {
        function create(int seed, bool choose) public {
          Unit unit = new Unit(seed, choose);
          require(true);
        }
      }
      contract Driver(address coordinator) {
        function run(int seed, bool choose) public {
          ICoordinator(coordinator).create(seed, choose);
          require(true);
        }
      }`, {
      forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
    });
    const connect = async (artifact: Artifact, args: readonly unknown[] = []): Promise<StatefulContract> => {
      const base = new Contract(artifact, args as never[], { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const coordinator = (await connect(artifacts.Coordinator)).registerChild(artifacts.Unit);
    const driver = await connect(artifacts.Driver, [hexToBin(coordinator.inner.lockingBytecode)]);
    expect(artifacts.Coordinator.messageBus?.handlers.find((candidate) => candidate.name === 'create'))
      .toMatchObject({
        eligible: true,
        childDeployments: [{ genesisState: { kind: 'constructor', fields: [
          { name: 'baseline' }, { name: 'selected' }, { name: 'marker' },
        ] } }],
      });

    const fee = await createBareP2pkhFeeFunder(provider, 100_000n);
    const genesis = await createBareP2pkhFeeFunder(provider, 20_000n);
    const compose = (seed: bigint, choose: boolean): Promise<TransactionBuilder> => messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'run', args: [seed, choose] },
        { contract: coordinator, functionName: 'create', args: [seed, choose] },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
      childDeployments: [{ invocationIndex: 1, siteIndex: 0, funder: genesis }],
    }).build();
    const childCommitment = (candidate: TransactionBuilder): { index: number, state: Record<string, unknown> } => {
      const index = candidate.outputs.findIndex((output) =>
        output.token?.category === genesis.utxo.txid && output.token.nft?.capability === 'mutable');
      expect(index).toBeGreaterThanOrEqual(0);
      return {
        index,
        state: parsePushdataCommitment(
          candidate.outputs[index].token!.nft!.commitment, artifacts.Unit.stateLayout!, 0,
        ),
      };
    };

    const selected = await compose(7n, true);
    expect(vmRejects(selected)).toBe(false);
    const selectedChild = childCommitment(selected);
    expect(selectedChild.state).toMatchObject({ baseline: 13n, selected: 16n, marker: 1n });

    const alternate = await compose(7n, false);
    expect(vmRejects(alternate)).toBe(false);
    expect(childCommitment(alternate).state).toMatchObject({ baseline: 8n, selected: 11n, marker: 2n });

    const forged = await compose(7n, true);
    const forgedChild = childCommitment(forged);
    const forgedCommitment = hexToBin(forged.outputs[forgedChild.index].token!.nft!.commitment);
    forgedCommitment[forgedCommitment.length - 1] ^= 0x01;
    forged.outputs[forgedChild.index].token!.nft!.commitment = binToHex(forgedCommitment);
    expect(vmRejects(forged)).toBe(true);

    await expect(compose(-2n, false)).rejects.toThrow(/BCH-2026 preflight failed/);
  }, 120_000);
});
