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

const HEAVY_HOP = `
interface IHeavyCapacityHop { function run(int value) returns (int); }
contract HeavyCapacityHop(address next) {
  int marker;
  function run(int value) public returns (int) {
    int result = IHeavyCapacityHop(next).run(value);
    this.marker = value;
    return result;
  }
}`;

const HEAVY_ROOT = `
interface IHeavyCapacityRootHop { function run(int value) returns (int); }
contract HeavyCapacityRoot(address next) {
  int marker;
  function root(int value) public {
    int result = IHeavyCapacityRootHop(next).run(value);
    this.marker = value;
    require(result >= 0);
  }
}`;

const HEAVY_SINK = `contract HeavyCapacitySink() {
  int marker;
  function run(int value) public returns (int) {
    this.marker = value;
    require(value >= 0);
    return value;
  }
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
    transactionBytes: 22_280, callManifestBytes: 294,
    worstOperationCost: 1_966_870, worstMaximumOperationCost: 7_234_400,
    worstRatio: 0.27187741899812007,
    inputOperationCosts: [
      338_474, 319_697, 695, 1_926_268, 1_966_870, 27_321,
    ],
    inputMaximumOperationCosts: [
      1_492_800, 1_324_000, 34_400, 7_234_400, 7_234_400, 112_800,
    ],
  },
  4: {
    participants: 4, authenticatedParticipants: 4, slots: 12,
    transactionBytes: 45_682, callManifestBytes: 584,
    worstOperationCost: 3_440_850, worstMaximumOperationCost: 7_234_400,
    worstRatio: 0.4756234103726639,
    inputOperationCosts: [
      394_658, 443_055, 695, 443_055, 695, 393_933, 695, 3_309_563, 3_440_850, 3_440_312, 3_333_014,
      27_321,
    ],
    inputMaximumOperationCosts: [
      1_558_400, 1_862_400, 34_400, 1_862_400, 34_400, 1_324_000, 34_400, 7_234_400, 7_234_400,
      7_234_400, 7_234_400, 112_800,
    ],
  },
  5: {
    participants: 5, authenticatedParticipants: 5, slots: 15,
    transactionBytes: 57_506, callManifestBytes: 729,
    worstOperationCost: 4_175_349, worstMaximumOperationCost: 7_234_400,
    worstRatio: 0.5771520789560987,
    inputOperationCosts: [
      422_718, 480_624, 695, 480_624, 695, 480_624, 695, 430_987, 695, 4_036_086, 4_175_349, 4_174_811,
      4_174_254, 4_049_951, 27_321,
    ],
    inputMaximumOperationCosts: [
      1_591_200, 1_895_200, 34_400, 1_895_200, 34_400, 1_895_200, 34_400, 1_324_000, 34_400, 7_234_400,
      7_234_400, 7_234_400, 7_234_400, 7_234_400, 112_800,
    ],
  },
  8: {
    participants: 8, authenticatedParticipants: 8, slots: 24,
    transactionBytes: 93_483, callManifestBytes: 1_164,
    worstOperationCost: 6_518_671, worstMaximumOperationCost: 7_234_400,
    worstRatio: 0.901065879685945,
    inputOperationCosts: [
      506_970, 593_403, 695, 593_411, 695, 593_411, 695, 593_411, 695, 593_411, 695, 593_411, 695,
      542_285, 695, 6_355_480, 6_518_671, 6_518_133, 6_517_576, 6_517_019, 6_516_462, 6_515_905,
      6_336_836, 27_321,
    ],
    inputMaximumOperationCosts: [
      1_690_400, 1_994_400, 34_400, 1_995_200, 34_400, 1_995_200, 34_400, 1_995_200, 34_400, 1_995_200,
      34_400, 1_995_200, 34_400, 1_324_800, 34_400, 7_234_400, 7_234_400, 7_234_400, 7_234_400,
      7_234_400, 7_234_400, 7_234_400, 7_234_400, 112_800,
    ],
  },
});

const buildChain = async (participants: number): Promise<TransactionBuilder> => {
  const provider = createMessageBusCapstoneTestProvider();
  const rootArtifact = compileString(ROOT, { forceStateful: true, messageBus: true });
  const hopArtifact = compileString(HOP, { forceStateful: true, messageBus: true });
  const sinkArtifact = compileString(SINK, { forceStateful: true, messageBus: true });
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

/** R-1 regression: every participant adds a state-resource effect to the returning chain. */
const buildResourceHeavyChain = async (participants: number): Promise<TransactionBuilder> => {
  const provider = createMessageBusCapstoneTestProvider();
  const rootArtifact = compileString(HEAVY_ROOT, { forceStateful: true, messageBus: true });
  const hopArtifact = compileString(HEAVY_HOP, { forceStateful: true, messageBus: true });
  const sinkArtifact = compileString(HEAVY_SINK, { forceStateful: true, messageBus: true });
  const connect = async (base: Contract, artifact: ReturnType<typeof compileString>): Promise<StatefulContract> => {
    const setup = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, { marker: 0n }, { saltContract: true },
    );
    return StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );
  };
  const contracts: StatefulContract[] = [await connect(new Contract(sinkArtifact, [], { provider }), sinkArtifact)];
  for (let index = participants - 2; index >= 1; index -= 1) {
    contracts.unshift(await connect(new Contract(
      hopArtifact, [contracts[0].inner.lockingBytecode], { provider },
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
    console.log(`MESSAGE_BUS_ATOMIC_CAPACITY ${JSON.stringify(reading)}`);
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
  }, 600_000);

  it.skipIf(Boolean(process.env.TESTS_USE_REGTEST)).each([6, 8])(
    'converges a %i-participant resource-heavy chain without the former pass refusal', async (count) => {
      const builder = await buildResourceHeavyChain(count);
      const transaction = builder.buildLibauthTransaction();
      const verifier = builder.inputs.findIndex((input) => input.token?.nft?.commitment.startsWith('4c335631'));
      expect(verifier).toBeGreaterThanOrEqual(0);
      const envelope = decodeAuthenticationInstructions(transaction.inputs[verifier].unlockingBytecode)[0];
      if (!envelope || !('data' in envelope)) throw new Error('heavy capacity fixture has no messageEnvelope');
      expect(messageBus.decodeAtomicMessageEnvelope(envelope.data).participants).toHaveLength(count);
      expect(encodeTransaction(transaction).length).toBeLessThanOrEqual(100_000);
    }, 300_000,
  );

  // The composition pass converges under the diagnostic profile, but these deliberately resource-heavy shapes
  // exceed stock BCH-2026 operation-cost density on a live node. Pin that boundary rather than timing out while
  // treating a consensus refusal as a composition regression.
  it.runIf(Boolean(process.env.TESTS_USE_REGTEST)).each([6, 8])(
    'classifies a %i-participant resource-heavy chain as over the live operation-cost budget', async (count) => {
      await expect(buildResourceHeavyChain(count)).rejects.toThrow(/operation cost density limit/);
    }, 300_000,
  );
});
