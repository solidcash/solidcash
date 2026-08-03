import {
  binToHex, createVirtualMachineBch2026, decodeAuthenticationInstructions, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract, layer3 } from '../../../src/index.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createLayer3CapstoneTestProvider } from './layer3-semantic-profile.js';

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
  transcriptBytes: number;
  worstOperationCost: number;
  worstMaximumOperationCost: number;
  worstRatio: number;
  inputOperationCosts: number[];
  inputMaximumOperationCosts: number[];
}

const EXPECTED: Readonly<Record<number, CapacityReading>> = Object.freeze({
  2: {
    participants: 2, authenticatedParticipants: 2, slots: 6,
    transactionBytes: 16_485, transcriptBytes: 358,
    worstOperationCost: 1_943_070, worstMaximumOperationCost: 4_903_200,
    worstRatio: 0.39628609887420463,
    inputOperationCosts: [234_742, 219_428, 695, 1_823_701, 1_943_070, 27_321],
    inputMaximumOperationCosts: [1_552_000, 1_395_200, 34_400, 4_799_200, 4_903_200, 112_800],
  },
  4: {
    participants: 4, authenticatedParticipants: 4, slots: 12,
    transactionBytes: 38_397, transcriptBytes: 712,
    worstOperationCost: 3_368_897, worstMaximumOperationCost: 5_469_600,
    worstRatio: 0.6159311467017697,
    inputOperationCosts: [
      287_448, 336_384, 695, 336_384, 695, 290_414, 695,
      3_199_433, 3_312_326, 3_311_788, 3_368_897, 27_321,
    ],
    inputMaximumOperationCosts: [
      1_617_600, 1_931_200, 34_400, 1_931_200, 34_400, 1_395_200, 34_400,
      5_431_200, 5_970_400, 5_970_400, 5_469_600, 112_800,
    ],
  },
  5: {
    participants: 5, authenticatedParticipants: 5, slots: 15,
    transactionBytes: 50_661, transcriptBytes: 889,
    worstOperationCost: 4_124_872, worstMaximumOperationCost: 5_752_800,
    worstRatio: 0.7170198859685718,
    inputOperationCosts: [
      313_801, 372_246, 695, 372_246, 695, 372_246, 695, 325_907, 695,
      3_931_371, 4_050_435, 4_049_897, 4_049_340, 4_124_872, 27_321,
    ],
    inputMaximumOperationCosts: [
      1_650_400, 1_964_000, 34_400, 1_964_000, 34_400, 1_964_000, 34_400, 1_395_200, 34_400,
      5_747_200, 6_286_400, 6_286_400, 6_286_400, 5_752_800, 112_800,
    ],
  },
  8: {
    participants: 8, authenticatedParticipants: 8, slots: 24,
    transactionBytes: 92_705, transcriptBytes: 1_420,
    worstOperationCost: 6_564_889, worstMaximumOperationCost: 6_602_400,
    worstRatio: 0.9943185811220162,
    inputOperationCosts: [
      392_868, 479_840, 695, 479_848, 695, 479_848, 695, 479_848, 695, 479_848, 695,
      479_848, 695, 432_394, 695, 6_303_029, 6_440_606, 6_440_068, 6_439_511,
      6_438_954, 6_438_397, 6_437_840, 6_564_889, 27_321,
    ],
    inputMaximumOperationCosts: [
      1_749_600, 2_063_200, 34_400, 2_064_000, 34_400, 2_064_000, 34_400, 2_064_000,
      34_400, 2_064_000, 34_400, 2_064_000, 34_400, 1_396_000, 34_400, 6_696_000,
      7_235_200, 7_235_200, 7_235_200, 7_235_200, 7_235_200, 7_235_200, 6_602_400, 112_800,
    ],
  },
});

const buildChain = async (participants: number): Promise<TransactionBuilder> => {
  const provider = createLayer3CapstoneTestProvider();
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
  return layer3.compose({
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
  if (verifierIndex < 0) throw new Error('capacity fixture has no deployed Layer-3 verifier input');
  const carrier = decodeAuthenticationInstructions(
    builder.inputs[verifierIndex].unlocker!.generateUnlockingBytecode({
      inputIndex: verifierIndex,
      sourceOutputs,
      transaction,
    }),
  )[0];
  if (!carrier || !('data' in carrier)) throw new Error('capacity fixture verifier has no carrier push');
  const transcript = layer3.decodeSingleTxCarrier(carrier.data);
  return {
    participants,
    authenticatedParticipants: transcript.participants.length,
    slots: transaction.inputs.length,
    transactionBytes: encodeTransaction(transaction).length,
    transcriptBytes: layer3.encodeSingleTxBusTranscript(transcript).length,
    worstOperationCost,
    worstMaximumOperationCost,
    worstRatio: worstOperationCost / worstMaximumOperationCost,
    inputOperationCosts,
    inputMaximumOperationCosts,
  };
};

describe('controllerless single-transaction capacity', () => {
  it.each([2, 4, 5, 8])('fits a %i-participant compiled chain under stock BCH-2026 limits', async (count) => {
    const builder = await buildChain(count);
    const reading = measure(count, builder);
    expect(reading.transactionBytes).toBeLessThanOrEqual(100_000);
    expect(reading.worstRatio).toBeLessThanOrEqual(1);
    expect(reading.authenticatedParticipants).toBe(count);
    expect(reading.slots).toBeGreaterThan(count);
    expect(reading).toEqual(EXPECTED[count]);
    console.log(`L3_SINGLE_TX_CAPACITY ${JSON.stringify(reading)}`);
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
