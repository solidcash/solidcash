import {
  binToHex, createVirtualMachineBch2026, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract, layer3 } from '../../src/index.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../test-util.js';
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
    participants: 2, authenticatedParticipants: 2, slots: 4,
    transactionBytes: 13_628, transcriptBytes: 359,
    worstOperationCost: 2_375_352, worstMaximumOperationCost: 5_009_600,
    worstRatio: 0.4741600127754711,
    inputOperationCosts: [2_424_394, 2_375_352, 695, 27_321],
    inputMaximumOperationCosts: [5_544_800, 5_009_600, 34_400, 112_800],
  },
  4: {
    participants: 4, authenticatedParticipants: 4, slots: 8,
    transactionBytes: 28_526, transcriptBytes: 713,
    worstOperationCost: 3_835_073, worstMaximumOperationCost: 5_009_600,
    worstRatio: 0.7655447540721814,
    inputOperationCosts: [3_935_394, 3_965_572, 695, 3_965_034, 695, 3_835_073, 695, 27_321],
    inputMaximumOperationCosts: [5_893_600, 5_648_800, 34_400, 5_648_800, 34_400, 5_009_600, 34_400, 112_800],
  },
  5: {
    participants: 5, authenticatedParticipants: 5, slots: 10,
    transactionBytes: 36_098, transcriptBytes: 890,
    worstOperationCost: 4_607_995, worstMaximumOperationCost: 5_009_600,
    worstRatio: 0.9198329207920792,
    inputOperationCosts: [
      4_734_934, 4_754_691, 695, 4_754_153, 695, 4_753_596, 695, 4_607_995, 695, 27_321,
    ],
    inputMaximumOperationCosts: [
      6_068_000, 5_681_600, 34_400, 5_681_600, 34_400, 5_681_600, 34_400, 5_009_600, 34_400, 112_800,
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
  const transcript = layer3.extractSingleTxCarrier(builder.inputs[0].unlocker!.generateUnlockingBytecode({
    inputIndex: 0,
    sourceOutputs,
    transaction,
  }));
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
  it.each([2, 4, 5])('fits a %i-participant compiled chain under stock BCH-2026 limits', async (count) => {
    const builder = await buildChain(count);
    const reading = measure(count, builder);
    expect(reading.transactionBytes).toBeLessThanOrEqual(100_000);
    expect(reading.worstRatio).toBeLessThanOrEqual(1);
    expect(reading.authenticatedParticipants).toBe(count);
    expect(reading.slots).toBeGreaterThan(count);
    expect(reading).toEqual(EXPECTED[count]);
    console.log(`L3_SINGLE_TX_CAPACITY ${JSON.stringify(reading)}`);
    // The ordinary suite pins exact stock-VM costs. An explicit live run broadcasts the same finalized bytes;
    // filter for the five-participant case to prove the maximum admitted physical/resource shape on BCHN.
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
