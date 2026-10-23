import {
  binToHex, createVirtualMachineBch2026, decodeAuthenticationInstructions, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { MESSAGE_BUS_VERIFIER_MIN_UNLOCKING_BYTECODE_BYTES } from '../../../src/stateful/covenant-helpers.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider, verifierInputCosts } from './message-bus-semantic-profile.js';

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

// Exact stock-VM snapshot of the finalized two-party bytes; the property is the bounds asserted before it (the
// chain fits the stock limits). Re-pinned after the atomic bus stages changed callee and route bytecode: only the
// two participant inputs and the transaction bytes moved (kernel 24_303 -> 24_189 B, legacy 24_747 -> 24_672 B);
// the verifier inputs are unchanged. The kernel worst input stays participant 1, the legacy worst a verifier.
// Re-pinned again after the route dropped its redundant positional batch self-check: both participant inputs
// shrank by the same ~38-39 B of verifier-observed operation cost, and the transaction by 260 B in each convention.
// Again after the token container covenant lost its merge path and the keep of an unnamed container refused a
// minting NFT: each participant's bytecode is 27 B smaller, so the transaction is 54 B smaller in each convention.
// Again when the forged-log pin skipped outputs of other categories (2286a2d7c): participant 1 is 1 B (kernel) and
// 3 B (legacy) larger and about 35,000 units cheaper.
// Again for the C3 record pins (each own-category record held at its own index, the route's past its block): each
// participant input is 88-95 B larger and 4,400-7,200 units dearer; the verifier inputs are unchanged.
// Again when the graph verifier bound the participant's actual block size instead of its maximum: the first verifier
// input is 60 units dearer, and the bytes are unchanged.
// Again on 2026-10-23. The call-records merge (0639d52bd) had moved the transaction 22 B (kernel) and 21 B (legacy)
// and the participant inputs. Binding the leaf route's physical size then adds 10 B and 8 B, all on the sink: its
// route argument and binder, and 580 units on its verifier.
const EXPECTED_TWO_PARTY: Readonly<Record<'kernel' | 'legacy', CapacityReading>> = Object.freeze({
  kernel: {
    participants: 2, authenticatedParticipants: 2, slots: 6,
    transactionBytes: 24_172, callManifestBytes: 294,
    worstOperationCost: 27_321, worstMaximumOperationCost: 112_800,
    worstRatio: 0.24220744680851064,
    inputOperationCosts: [
      420_568, 387_785, 695, 957_089, 817_981, 27_321,
    ],
    inputMaximumOperationCosts: [
      2_416_000, 1_914_400, 34_400, 7_234_400, 7_234_400, 112_800,
    ],
  },
  legacy: {
    participants: 2, authenticatedParticipants: 2, slots: 6,
    transactionBytes: 24_655, callManifestBytes: 294,
    worstOperationCost: 2_373_927, worstMaximumOperationCost: 7_234_400,
    worstRatio: 0.3281442828707287,
    inputOperationCosts: [
      413_098, 412_160, 695, 2_373_927, 1_864_134, 27_321,
    ],
    inputMaximumOperationCosts: [
      2_348_800, 2_368_000, 34_400, 7_234_400, 7_234_400, 112_800,
    ],
  },
});

const buildChain = async (
  participants: number,
  messageBusKernel = true,
): Promise<TransactionBuilder> => {
  const provider = createMessageBusCapstoneTestProvider();
  const options = { forceStateful: true, messageBus: true, messageBusKernel } as const;
  const rootArtifact = compileString(ROOT, options);
  const hopArtifact = compileString(HOP, options);
  const sinkArtifact = compileString(SINK, options);
  const convention = messageBusKernel ? 'kernel-row-loop' : 'legacy-unroll';
  if ([rootArtifact, hopArtifact, sinkArtifact].some((artifact) => artifact.messageBus?.convention !== convention)) {
    throw new Error(`capacity fixture did not compile with the requested ${convention} convention`);
  }
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
  const builder = await messageBus.compose({
    calls: contracts.map((contract, index) => index === 0 ? contract.call.root(1n) : contract.call.run(1n)),
    funder: fee,
    changeAddress: fee.unlocker.generateLockingBytecode(),
  }).build();
  if (process.env.MESSAGE_BUS_VERIFIER_COST_LOG) verifierInputCosts(builder);
  return builder;
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
  const builder = await messageBus.compose({
    calls: contracts.map((contract, index) => index === 0 ? contract.call.root(1n) : contract.call.run(1n)),
    funder: fee,
    changeAddress: fee.unlocker.generateLockingBytecode(),
  }).build();
  if (process.env.MESSAGE_BUS_VERIFIER_COST_LOG) verifierInputCosts(builder);
  return builder;
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

const stockVmErrors = (builder: TransactionBuilder): string[] => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026(false);
  return transaction.inputs.flatMap((_input, inputIndex) => {
    const result = vm.evaluate({ inputIndex, sourceOutputs, transaction }) as { error?: string };
    return result.error === undefined ? [] : [result.error];
  });
};

describe('atomic single-transaction capacity', () => {
  it('keeps successful return-output observations stable across independent graph identities', async () => {
    // Each setup uses distinct participant/category identities. Before successful output-covenant observations
    // were authoritative, some identities left a schema-shaped 32-byte stack word near an `int256` result; the
    // generic fallback could select that unrelated word and make result claims oscillate between fixed-point passes.
    for (let index = 0; index < 16; index += 1) {
      const builder = await buildChain(4, true);
      expect(builder.inputs).toHaveLength(builder.outputs.length);
    }
  }, 600_000);

  it.each([
    { convention: 'kernel' as const, messageBusKernel: true },
    { convention: 'legacy' as const, messageBusKernel: false },
  ])('fits a 2-participant $convention chain under stock BCH-2026 limits', async ({
    convention, messageBusKernel,
  }) => {
    const count = 2;
    const builder = await buildChain(count, messageBusKernel);
    const reading = measure(count, builder);
    expect(reading.transactionBytes).toBeLessThanOrEqual(100_000);
    expect(reading.worstRatio).toBeLessThanOrEqual(1);
    expect(reading.authenticatedParticipants).toBe(count);
    expect(reading.slots).toBeGreaterThan(count);
    console.log(`MESSAGE_BUS_ATOMIC_CAPACITY ${JSON.stringify(reading)}`);
    expect(reading).toEqual(EXPECTED_TWO_PARTY[convention]);
    // The ordinary suite pins exact stock-VM costs. This live branch proves that the same finalized two-party
    // bytes are accepted by BCHN.
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

  // The verifier inputs were the dense ones. The cost reduction that lowered the two-party pins moved the
  // 4-participant legacy and the 6- and 7-participant kernel chains under the stock density ceiling too, so every
  // standard-size chain is classified as accepted; the property is unchanged: each listed composition is
  // classified against the stock operation-cost density limit.
  it.each([
    { count: 4, messageBusKernel: false, convention: 'legacy' },
    { count: 4, messageBusKernel: true, convention: 'kernel' },
    { count: 5, messageBusKernel: true, convention: 'kernel' },
    { count: 6, messageBusKernel: true, convention: 'kernel' },
    { count: 7, messageBusKernel: true, convention: 'kernel' },
  ])('accepts a $count-participant $convention chain under the stock operation-density boundary', async ({
    count, messageBusKernel,
  }) => {
    const builder = await buildChain(count, messageBusKernel);
    const transaction = builder.buildLibauthTransaction();
    expect(encodeTransaction(transaction).length).toBeLessThanOrEqual(100_000);
    expect(stockVmErrors(builder)).not.toContainEqual(expect.stringMatching(/operation cost density limit/));
  }, 600_000);

  // Each participant's covenant carries the October hardening (container sums, foreign-token keep, record census),
  // so eight participants no longer fit a standard transaction: 102,186 B when this row moved. Its verifiers now
  // fit their density budget, so only the size bound refuses it.
  it('classifies an 8-participant kernel chain over the standard size and under the stock operation-density boundary',
    async () => {
      const builder = await buildChain(8, true);
      expect(encodeTransaction(builder.buildLibauthTransaction()).length).toBeGreaterThan(100_000);
      expect(stockVmErrors(builder)).not.toContainEqual(expect.stringMatching(/operation cost density limit/));
    }, 600_000);

  it.skipIf(Boolean(process.env.TESTS_USE_REGTEST)).each([6])(
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

  // Only the standard size bound needs the relaxed profile now: every input fits its stock density budget.
  it.skipIf(Boolean(process.env.TESTS_USE_REGTEST)).each([8])(
    'converges a %i-participant resource-heavy chain only under the relaxed semantic profile', async (count) => {
      const builder = await buildResourceHeavyChain(count);
      const transaction = builder.buildLibauthTransaction();
      expect(encodeTransaction(transaction).length).toBeGreaterThan(100_000);
      expect(stockVmErrors(builder)).not.toContainEqual(expect.stringMatching(/operation cost density limit/));
    }, 300_000,
  );

  // These resource-heavy shapes exceeded stock BCH-2026 density on a live node while the verifier inputs were
  // dense; the 8-participant mock reading above now fits that budget, so the standard-size 6-participant chain is
  // classified as within it on the node as well.
  it.runIf(Boolean(process.env.TESTS_USE_REGTEST)).each([6])(
    'classifies a %i-participant resource-heavy chain as within the live operation-cost budget', async (count) => {
      const builder = await buildResourceHeavyChain(count);
      expect(stockVmErrors(builder)).not.toContainEqual(expect.stringMatching(/operation cost density limit/));
    }, 300_000,
  );
});
