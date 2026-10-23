import { hexToBin } from '@bitauth/libauth';
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

describe('post-new folded child initialization transcript security', () => {
  it('authenticates combined constructor and initializer genesis without a child co-spend', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`contract Unit(int seed) {
        int baseline;
        int configured;
        int marker;
        constructor() { this.baseline = seed; }
        function initialize(int next, bool choose) public {
          if (choose) {
            this.configured = this.baseline + next;
            this.marker = int(1);
          } else {
            this.configured = this.baseline - next;
            this.marker = int(2);
          }
          require(true);
        }
      }
      interface ICoordinator { function materialize(int seed, int next, bool choose); }
      contract Coordinator() {
        int created;
        function materialize(int seed, int next, bool choose) public {
          Unit unit = new Unit(seed);
          unit.initialize(next, choose);
          this.created = this.created + 1;
          require(true);
        }
      }
      contract Driver(address coordinator) {
        function run(int seed, int next, bool choose) public {
          ICoordinator(coordinator).materialize(seed, next, choose);
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
    const selected = artifacts.Coordinator.messageBus?.handlers.find((candidate) =>
      candidate.name === 'materialize');
    expect(selected?.rejectionReason).toBeUndefined();
    expect(selected).toMatchObject({
      eligible: true,
      childDeployments: [{
        siteIndex: 0, hasFoldedChildCall: true,
        genesisState: { kind: 'constructor', fields: [
          { name: 'baseline' }, { name: 'configured' }, { name: 'marker' },
        ] },
      }],
    });

    const fee = await createBareP2pkhFeeFunder(provider, 100_000n);
    const genesis = await createBareP2pkhFeeFunder(provider, 20_000n);
    const seed = 7n;
    const next = 11n;
    const compose = (contract = coordinator, choose = true): Promise<TransactionBuilder> => messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'run', args: [seed, next, choose] },
        { contract, functionName: 'materialize', args: [seed, next, choose] },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
      childDeployments: [{ invocationIndex: 1, siteIndex: 0, funder: genesis }],
    }).build();

    const canonical = await compose();
    expect(vmRejects(canonical)).toBe(false);
    const childInput = canonical.inputs.findIndex((input) => input.txid === genesis.utxo.txid);
    expect(childInput).toBeGreaterThanOrEqual(0);
    expect(canonical.inputs.some((input) => input.token?.category === genesis.utxo.txid)).toBe(false);
    const childDataOutput = canonical.outputs.findIndex((output) =>
      output.token?.category === genesis.utxo.txid && output.token.nft?.capability === 'mutable');
    expect(childDataOutput).toBeGreaterThanOrEqual(0);
    expect(parsePushdataCommitment(
      canonical.outputs[childDataOutput].token!.nft!.commitment, artifacts.Unit.stateLayout!, 0,
    )).toMatchObject({ baseline: seed, configured: seed + next, marker: 1n });

    const alternate = await compose(coordinator, false);
    expect(vmRejects(alternate)).toBe(false);
    expect(parsePushdataCommitment(
      alternate.outputs[childDataOutput].token!.nft!.commitment, artifacts.Unit.stateLayout!, 0,
    )).toMatchObject({ baseline: seed, configured: seed - next, marker: 2n });

    const wrongCommitment = await compose();
    wrongCommitment.outputs[childDataOutput].token!.nft!.commitment = '01';
    expect(vmRejects(wrongCommitment)).toBe(true);

    const wrongOutput = await compose();
    wrongOutput.outputs[childDataOutput].to = Uint8Array.of(0x51);
    expect(vmRejects(wrongOutput)).toBe(true);

    const originalHandler = artifacts.Coordinator.messageBus!.handlers.find((candidate) =>
      candidate.name === 'materialize')!;
    const siteWithoutGenesis = { ...originalHandler.childDeployments![0], genesisState: undefined };
    const incompleteArtifact = {
      ...artifacts.Coordinator,
      messageBus: {
        ...artifacts.Coordinator.messageBus!,
        handlers: artifacts.Coordinator.messageBus!.handlers.map((candidate) => candidate === originalHandler
          ? { ...candidate, childDeployments: [siteWithoutGenesis] } : candidate),
      },
    } as Artifact;
    const incompleteInner = new Contract(incompleteArtifact, [], { provider })
      .withCategory(hexToBin(coordinator.categoryId));
    const incomplete = StatefulContract.withCategory(
      incompleteInner, coordinator.categoryId,
    ).registerChild(artifacts.Unit);
    await expect(compose(incomplete)).rejects.toThrow(/folded.*genesis|genesis.*folded/i);
  }, 120_000);
});
