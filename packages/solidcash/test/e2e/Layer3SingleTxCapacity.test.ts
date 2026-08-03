import {
  createVirtualMachineBch2026, encodeTransaction, hexToBin,
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
    transactionBytes: 15_289, transcriptBytes: 359,
    worstOperationCost: 2_597_211, worstMaximumOperationCost: 5_725_600,
    worstRatio: 0.4536137697359229,
    inputOperationCosts: [2_555_789, 2_597_211, 695, 27_321],
    inputMaximumOperationCosts: [6_157_600, 5_725_600, 34_400, 112_800],
  },
  4: {
    participants: 4, authenticatedParticipants: 4, slots: 8,
    transactionBytes: 31_737, transcriptBytes: 713,
    worstOperationCost: 4_192_306, worstMaximumOperationCost: 5_725_600,
    worstRatio: 0.7322037865027246,
    inputOperationCosts: [4_141_635, 4_213_139, 695, 4_212_527, 695, 4_192_306, 695, 27_321],
    inputMaximumOperationCosts: [6_506_400, 6_268_800, 34_400, 6_268_800, 34_400, 5_725_600, 34_400, 112_800],
  },
  5: {
    participants: 5, authenticatedParticipants: 5, slots: 10,
    transactionBytes: 40_084, transcriptBytes: 890,
    worstOperationCost: 5_032_915, worstMaximumOperationCost: 5_725_600,
    worstRatio: 0.8790196660611989,
    inputOperationCosts: [
      4_978_598, 5_047_401, 695, 5_046_789, 695, 5_046_158, 695, 5_032_915, 695, 27_321,
    ],
    inputMaximumOperationCosts: [
      6_680_800, 6_301_600, 34_400, 6_301_600, 34_400, 6_301_600, 34_400, 5_725_600, 34_400, 112_800,
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
      await expect(builder.send()).resolves.toMatchObject({
        txid: expect.stringMatching(/^[0-9a-f]{64}$/),
      });
    }
  }, 180_000);
});
