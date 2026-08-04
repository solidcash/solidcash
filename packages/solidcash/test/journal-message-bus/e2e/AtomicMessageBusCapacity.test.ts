import {
  binToHex, createVirtualMachineBch2026, decodeAuthenticationInstructions, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract, messageBus } from '../../../src/index.js';
import { MESSAGE_BUS_VERIFIER_MIN_UNLOCKING_BYTECODE_BYTES } from '../../../src/stateful/covenant-helpers.js';
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
    transactionBytes: 22_550, callManifestBytes: 294,
    worstOperationCost: 1_997_038, worstMaximumOperationCost: 7_234_400,
    worstRatio: 0.2760474953002322,
    inputOperationCosts: [333_178, 314_871, 695, 1_877_975, 1_997_038, 27_321],
    inputMaximumOperationCosts: [1_593_600, 1_439_200, 34_400, 7_234_400, 7_234_400, 112_800],
  },
  4: {
    participants: 4, authenticatedParticipants: 4, slots: 12,
    transactionBytes: 46_222, callManifestBytes: 584,
    worstOperationCost: 3_464_908, worstMaximumOperationCost: 7_234_400,
    worstRatio: 0.47894891075970364,
    inputOperationCosts: [
      389_362, 438_200, 695, 438_200, 695, 389_107, 695,
      3_218_148, 3_464_908, 3_464_370, 3_381_370, 27_321,
    ],
    inputMaximumOperationCosts: [
      1_659_200, 1_970_400, 34_400, 1_970_400, 34_400, 1_439_200, 34_400,
      7_234_400, 7_234_400, 7_234_400, 7_234_400, 112_800,
    ],
  },
  5: {
    participants: 5, authenticatedParticipants: 5, slots: 15,
    transactionBytes: 58_181, callManifestBytes: 729,
    worstOperationCost: 4_203_995, worstMaximumOperationCost: 7_234_400,
    worstRatio: 0.5811117715359947,
    inputOperationCosts: [
      417_422, 475_769, 695, 475_769, 695, 475_769, 695, 426_161, 695,
      3_923_110, 4_203_995, 4_203_457, 4_202_900, 4_107_401, 27_321,
    ],
    inputMaximumOperationCosts: [
      1_692_000, 2_003_200, 34_400, 2_003_200, 34_400, 2_003_200, 34_400, 1_439_200, 34_400,
      7_234_400, 7_234_400, 7_234_400, 7_234_400, 7_234_400, 112_800,
    ],
  },
  8: {
    participants: 8, authenticatedParticipants: 8, slots: 24,
    transactionBytes: 94_563, callManifestBytes: 1_164,
    worstOperationCost: 6_561_081, worstMaximumOperationCost: 7_234_400,
    worstRatio: 0.9069281488444101,
    inputOperationCosts: [
      501_674, 588_548, 695, 588_556, 695, 588_556, 695, 588_556, 695, 588_556, 695,
      588_556, 695, 537_459, 695, 6_177_821, 6_561_081, 6_560_543, 6_559_986,
      6_559_429, 6_558_872, 6_558_315, 6_421_568, 27_321,
    ],
    inputMaximumOperationCosts: [
      1_791_200, 2_102_400, 34_400, 2_103_200, 34_400, 2_103_200, 34_400, 2_103_200,
      34_400, 2_103_200, 34_400, 2_103_200, 34_400, 1_440_000, 34_400,
      7_234_400, 7_234_400, 7_234_400, 7_234_400, 7_234_400, 7_234_400, 7_234_400, 7_234_400, 112_800,
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
  const verifierUnlockingLengths = builder.inputs
    .map((input, inputIndex) => ({ input, inputIndex }))
    .filter(({ input }) => input.token?.nft?.commitment.startsWith('4c335631'))
    .map(({ inputIndex }) => transaction.inputs[inputIndex].unlockingBytecode.length);
  expect(Math.min(...verifierUnlockingLengths)).toBeGreaterThanOrEqual(
    MESSAGE_BUS_VERIFIER_MIN_UNLOCKING_BYTECODE_BYTES,
  );
  if (participants === 8) {
    expect(Math.max(...verifierUnlockingLengths) - Math.min(...verifierUnlockingLengths)).toBeLessThanOrEqual(2);
    const reserveLengths = builder.inputs
      .filter((input) => input.token?.nft?.commitment.startsWith('4c335631'))
      .map((input) => (input.unlocker!.params[0] as Uint8Array).length);
    expect(new Set(reserveLengths).size).toBeGreaterThan(1);
  }
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
    console.log(`L3_ATOMIC_CAPACITY ${JSON.stringify(reading)}`);
    expect(reading).toEqual(EXPECTED[count]);
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
