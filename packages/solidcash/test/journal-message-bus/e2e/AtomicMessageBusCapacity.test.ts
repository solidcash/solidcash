import {
  binToHex, createVirtualMachineBch2026, decodeAuthenticationInstructions, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract, messageBus } from '../../../src/index.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const HOP = `
interface ICapacityHop { function run(int value) returns (int); }
contract CapacityHop(int marker, address next) {
  function run(int value) public returns (int) {
    int result = ICapacityHop(next).run(value);
    require(marker >= 0);
    return result + 1;
  }
}`;

const ROOT = `
interface ICapacityRootHop { function run(int value) returns (int); }
contract CapacityRoot(address next) {
  function root(int value) public {
    int result = ICapacityRootHop(next).run(value);
    require(result >= value);
  }
}`;

const SINK = `contract CapacitySink(int marker) {
  function run(int value) public pure returns (int) { require(value >= 0); return value; }
}`;

interface CapacityReading {
  participants: number;
  authenticatedParticipants: number;
  slots: number;
  transactionBytes: number;
  callManifestBytes: number;
  worstOperationCost: number;
  worstMaximumOperationCost: number;
  worstRatio: number;
  inputOperationCosts: number[];
  inputMaximumOperationCosts: number[];
}

const EXPECTED: Readonly<Record<number, CapacityReading>> = Object.freeze({
  2: {
    participants: 2, authenticatedParticipants: 2, slots: 6,
    transactionBytes: 18_798, callManifestBytes: 294,
    worstOperationCost: 1_982_886, worstMaximumOperationCost: 5_819_200,
    worstRatio: 0.34074890019246634,
    inputOperationCosts: [320_795, 302_488, 695, 1_863_609, 1_982_886, 27_321],
    inputMaximumOperationCosts: [1_593_600, 1_439_200, 34_400, 5_648_000, 5_819_200, 112_800],
  },
  4: {
    participants: 4, authenticatedParticipants: 4, slots: 12,
    transactionBytes: 41_418, callManifestBytes: 584,
    worstOperationCost: 3_369_538, worstMaximumOperationCost: 6_051_200,
    worstRatio: 0.5568379825489159,
    inputOperationCosts: [
      379_009, 427_847, 695, 427_847, 695, 378_754, 695,
      3_206_184, 3_453_698, 3_453_160, 3_369_538, 27_321,
    ],
    inputMaximumOperationCosts: [
      1_659_200, 1_970_400, 34_400, 1_970_400, 34_400, 1_439_200, 34_400,
      5_945_600, 6_548_800, 6_548_800, 6_051_200, 112_800,
    ],
  },
  5: {
    participants: 5, authenticatedParticipants: 5, slots: 15,
    transactionBytes: 53_409, callManifestBytes: 729,
    worstOperationCost: 4_096_729, worstMaximumOperationCost: 6_167_200,
    worstRatio: 0.6642769814502529,
    inputOperationCosts: [
      408_084, 466_431, 695, 466_431, 695, 466_431, 695, 416_823, 695,
      3_912_347, 4_193_986, 4_193_448, 4_192_891, 4_096_729, 27_321,
    ],
    inputMaximumOperationCosts: [
      1_692_000, 2_003_200, 34_400, 2_003_200, 34_400, 2_003_200, 34_400, 1_439_200, 34_400,
      6_094_400, 6_697_600, 6_697_600, 6_697_600, 6_167_200, 112_800,
    ],
  },
  8: {
    participants: 8, authenticatedParticipants: 8, slots: 24,
    transactionBytes: 92_126, callManifestBytes: 1_164,
    worstOperationCost: 6_414_376, worstMaximumOperationCost: 6_515_200,
    worstRatio: 0.9845248035363457,
    inputOperationCosts: [
      495_381, 582_255, 695, 582_263, 695, 582_263, 695, 582_263, 695, 582_263, 695,
      582_263, 695, 531_166, 695, 6_170_662, 6_554_676, 6_554_138, 6_553_581,
      6_553_024, 6_552_467, 6_551_910, 6_414_376, 27_321,
    ],
    inputMaximumOperationCosts: [
      1_791_200, 2_102_400, 34_400, 2_103_200, 34_400, 2_103_200, 34_400, 2_103_200,
      34_400, 2_103_200, 34_400, 2_103_200, 34_400, 1_440_000, 34_400, 6_541_600,
      7_144_800, 7_144_800, 7_144_800, 7_144_800, 7_144_800, 7_144_800, 6_515_200, 112_800,
    ],
  },
});

const buildChain = async (participants: number): Promise<TransactionBuilder> => {
  const provider = createMessageBusCapstoneTestProvider();
  const rootArtifact = compileString(ROOT, { forceStateful: true });
  const hopArtifact = compileString(HOP, { forceStateful: true });
  const sinkArtifact = compileString(SINK, { forceStateful: true });
  const connect = async (base: Contract, artifact: ReturnType<typeof compileString>): Promise<StatefulContract> => {
    const setup = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, {}, { saltContract: true },
    );
    return StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );
  };
  const contracts: StatefulContract[] = [await connect(
    new Contract(sinkArtifact, [BigInt(participants - 1)], { provider }), sinkArtifact,
  )];
  for (let index = participants - 2; index >= 1; index -= 1) {
    contracts.unshift(await connect(new Contract(
      hopArtifact, [BigInt(index), contracts[0].inner.lockingBytecode], { provider },
    ), hopArtifact));
  }
  contracts.unshift(await connect(
    new Contract(rootArtifact, [contracts[0].inner.lockingBytecode], { provider }), rootArtifact,
  ));
  const fee = await createBareP2pkhFeeFunder(provider, 2_000_000n);
  return messageBus.compose({
    calls: contracts.map((contract, index) => index === 0 ? contract.call.root(1n) : contract.call.run(1n)),
    funder: fee,
    changeAddress: fee.unlocker.generateLockingBytecode(),
  }).build();
};

const measure = (participants: number, builder: TransactionBuilder): CapacityReading => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026(false);
  let worstOperationCost = 0;
  let worstMaximumOperationCost = 0;
  const inputOperationCosts: number[] = [];
  const inputMaximumOperationCosts: number[] = [];
  for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
    const result = vm.evaluate({ inputIndex, sourceOutputs, transaction }) as {
      error?: string;
      metrics: { operationCost: number; maximumOperationCost: number };
    };
    expect(result.error, `participant ${participants}, input ${inputIndex}`).toBeUndefined();
    inputOperationCosts.push(result.metrics.operationCost);
    inputMaximumOperationCosts.push(result.metrics.maximumOperationCost);
    if (result.metrics.operationCost / result.metrics.maximumOperationCost
      > worstOperationCost / Math.max(1, worstMaximumOperationCost)) {
      worstOperationCost = result.metrics.operationCost;
      worstMaximumOperationCost = result.metrics.maximumOperationCost;
    }
  }
  const verifierIndex = builder.inputs.findIndex(
    (input) => input.token?.nft?.commitment.startsWith('4c335631'),
  );
  if (verifierIndex < 0) throw new Error('capacity fixture has no deployed message bus verifier input');
  const messageEnvelope = decodeAuthenticationInstructions(
    builder.inputs[verifierIndex].unlocker!.generateUnlockingBytecode({
      inputIndex: verifierIndex,
      sourceOutputs,
      transaction,
    }),
  )[0];
  if (!messageEnvelope || !('data' in messageEnvelope)) throw new Error('capacity fixture verifier has no messageEnvelope push');
  const callManifest = messageBus.decodeAtomicMessageEnvelope(messageEnvelope.data);
  return {
    participants,
    authenticatedParticipants: callManifest.participants.length,
    slots: transaction.inputs.length,
    transactionBytes: encodeTransaction(transaction).length,
    callManifestBytes: messageBus.encodeAtomicMessageBusCallManifest(callManifest).length,
    worstOperationCost,
    worstMaximumOperationCost,
    worstRatio: worstOperationCost / worstMaximumOperationCost,
    inputOperationCosts,
    inputMaximumOperationCosts,
  };
};

describe('atomic single-transaction capacity', () => {
  it.each([2, 4, 5, 8])('fits a %i-participant compiled chain under stock BCH-2026 limits', async (count) => {
    const builder = await buildChain(count);
    const reading = measure(count, builder);
    expect(reading.transactionBytes).toBeLessThanOrEqual(100_000);
    expect(reading.worstRatio).toBeLessThanOrEqual(1);
    expect(reading.authenticatedParticipants).toBe(count);
    expect(reading.slots).toBeGreaterThan(count);
    expect(reading).toEqual(EXPECTED[count]);
    console.log(`L3_ATOMIC_CAPACITY ${JSON.stringify(reading)}`);
    // The ordinary suite pins exact stock-VM costs. An explicit live run broadcasts the same finalized bytes;
    // filter for the eight-participant case to prove the maximum admitted physical/resource shape on BCHN.
    if (process.env.TESTS_USE_REGTEST) {
      const finalizedHex = binToHex(encodeTransaction(builder.buildLibauthTransaction()));
      await expect(builder.send()).resolves.toMatchObject({
        txid: expect.stringMatching(/^[0-9a-f]{64}$/),
      });
      // There is no reusable execution authority: the exact same transaction is rejected after its participant
      // and resource UTXOs have been consumed by the first standard-policy broadcast.
      await expect(builder.provider.sendRawTransaction(finalizedHex)).rejects.toThrow();
    }
  }, 300_000);
});
