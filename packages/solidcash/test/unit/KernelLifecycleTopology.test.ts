import { describe, expect, it } from 'vitest';
import {
  bindKernelLifecycleTransaction, planKernelLifecycleTopology, type KernelLifecycleTransactionPoint,
} from '../../src/stateful/KernelLifecycleTopology.js';

const preservedIdentity = {
  lockingBytecode: 'participant', tokenCategory: 'participant', nftCapability: 'minting',
  nftCommitment: 'preserve', tokenAmount: 'nondecrease', satoshis: 'preserve',
};
const splitPreservedIdentity = { ...preservedIdentity, tokenAmount: 'preserve' };
const consumedIdentity = {
  lockingBytecode: 'participant', tokenCategory: 'participant', nftCapability: 'minting',
  nftCommitment: 'unconstrained', tokenAmount: 'unconstrained', satoshis: 'reclaim',
};
const createdIdentity = {
  lockingBytecode: 'participant', tokenCategory: 'participant', nftCapability: 'minting',
  nftCommitment: 'empty', tokenAmount: 'zero', satoshis: 'funded',
};
const fixedOne = { source: 'fixed', value: 1 };
const parameterCount = { source: 'parameter', parameterIndex: 0, addend: 0 };

// The deliberately mutable inferred shape keeps hostile metadata mutations concise.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const splitTopology = () => ({
  version: 2,
  kind: 'split',
  coordinate: 'participant',
  categoryCensus: {
    tokenCategory: 'participant', nftCapability: 'minting',
    inputCount: fixedOne, outputCount: { ...parameterCount, addend: 1 },
  },
  inputSpans: [
    { mode: 'preserve', offset: 0, count: fixedOne, identity: splitPreservedIdentity },
  ],
  outputSpans: [
    { mode: 'preserve', offset: 0, count: fixedOne, identity: splitPreservedIdentity },
    { mode: 'create', offset: 1, count: parameterCount, identity: createdIdentity },
  ],
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const mergeTopology = () => ({
  version: 2,
  kind: 'merge',
  coordinate: 'participant',
  categoryCensus: {
    tokenCategory: 'participant', nftCapability: 'minting',
    inputCount: { ...parameterCount, addend: 1 }, outputCount: fixedOne,
  },
  inputSpans: [
    { mode: 'preserve', offset: 0, count: fixedOne, identity: preservedIdentity },
    { mode: 'consume', offset: 1, count: parameterCount, identity: consumedIdentity },
  ],
  outputSpans: [
    { mode: 'preserve', offset: 0, count: fixedOne, identity: preservedIdentity },
  ],
});

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const owner = 'aa20';
const category = '11'.repeat(31) + 'ee';
const point = (overrides: Partial<KernelLifecycleTransactionPoint> = {}): KernelLifecycleTransactionPoint => ({
  lockingBytecode: owner,
  tokenCategory: category,
  nftCapability: 'minting' as const,
  nftCommitment: 'abcd',
  tokenAmount: 2n,
  satoshis: 1000n,
  ...overrides,
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const splitFrame = () => ({
  participantLockingBytecode: owner,
  participantTokenCategory: category,
  inputBase: 0,
  outputBase: 0,
  inputs: [point()],
  outputs: [point(), point({ nftCommitment: '', tokenAmount: 0n }), point({ nftCommitment: '', tokenAmount: 0n })],
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const mergeFrame = () => ({
  participantLockingBytecode: owner,
  participantTokenCategory: category,
  inputBase: 0,
  outputBase: 0,
  inputs: [point(), point({ nftCommitment: '0102' }), point({ nftCommitment: '0304' })],
  outputs: [point()],
});

const selfdestructTopology = (): Record<string, unknown> => ({
  version: 2,
  kind: 'selfdestruct',
  coordinate: 'participant',
  categoryCensus: {
    tokenCategory: 'participant', nftCapability: 'minting',
    inputCount: fixedOne, outputCount: { source: 'fixed', value: 0 },
  },
  inputSpans: [
    { mode: 'consume', offset: 0, count: fixedOne, identity: consumedIdentity },
  ],
  outputSpans: [],
});

describe('kernel lifecycle topology planning prerequisite', () => {
  it('resolves canonical split, merge, and selfdestruct participant spans', () => {
    expect(planKernelLifecycleTopology(selfdestructTopology(), [])).toEqual({
      kind: 'selfdestruct',
      categoryCensus: { inputCount: 1, outputCount: 0 },
      inputSpans: [{ mode: 'consume', offset: 0, count: 1 }],
      outputSpans: [],
    });
    expect(planKernelLifecycleTopology(splitTopology(), [2n])).toEqual({
      kind: 'split',
      categoryCensus: { inputCount: 1, outputCount: 3 },
      inputSpans: [{ mode: 'preserve', offset: 0, count: 1 }],
      outputSpans: [
        { mode: 'preserve', offset: 0, count: 1 },
        { mode: 'create', offset: 1, count: 2 },
      ],
    });
    expect(planKernelLifecycleTopology(mergeTopology(), [3])).toEqual({
      kind: 'merge',
      categoryCensus: { inputCount: 4, outputCount: 1 },
      inputSpans: [
        { mode: 'preserve', offset: 0, count: 1 },
        { mode: 'consume', offset: 1, count: 3 },
      ],
      outputSpans: [{ mode: 'preserve', offset: 0, count: 1 }],
    });
  });

  it('resolves preserve and consume resourcePrefix beside minting spans', () => {
    const splitPrefixed = clone(splitTopology()) as ReturnType<typeof splitTopology> & {
      resourcePrefix?: { dataNftCount: number; mode: string; nftIndices: number[] };
    };
    splitPrefixed.resourcePrefix = { dataNftCount: 1, mode: 'preserve', nftIndices: [0] };
    splitPrefixed.outputSpans[1]!.offset = 2;
    expect(planKernelLifecycleTopology(splitPrefixed, [2n])).toMatchObject({
      kind: 'split',
      resourcePrefix: { dataNftCount: 1, mode: 'preserve', nftIndices: [0] },
      outputSpans: [
        { mode: 'preserve', offset: 0, count: 1 },
        { mode: 'create', offset: 2, count: 2 },
      ],
    });

    const retiredPrefixed = clone(selfdestructTopology()) as ReturnType<typeof selfdestructTopology> & {
      resourcePrefix?: { dataNftCount: number; mode: string; nftIndices: number[] };
    };
    retiredPrefixed.resourcePrefix = { dataNftCount: 1, mode: 'consume', nftIndices: [0] };
    expect(planKernelLifecycleTopology(retiredPrefixed, [])).toMatchObject({
      kind: 'selfdestruct',
      resourcePrefix: { dataNftCount: 1, mode: 'consume', nftIndices: [0] },
    });

    const mismatched = clone(splitPrefixed);
    mismatched.resourcePrefix = { dataNftCount: 1, mode: 'consume', nftIndices: [0] };
    expect(() => planKernelLifecycleTopology(mismatched, [2n])).toThrow(/resourcePrefix\.mode/);
    const sparse = clone(splitPrefixed);
    sparse.resourcePrefix = { dataNftCount: 1, mode: 'preserve', nftIndices: [1] };
    expect(() => planKernelLifecycleTopology(sparse, [2n])).toThrow(/nftIndices/);
  });

  it('rejects missing, extra, shifted, and inconsistent spans', () => {
    const missing = clone(splitTopology());
    missing.outputSpans.pop();
    const extra = clone(splitTopology());
    extra.inputSpans.push(clone(extra.inputSpans[0]!));
    const shifted = clone(splitTopology());
    shifted.outputSpans[1]!.offset = 2;
    const widenedCount = clone(mergeTopology());
    widenedCount.inputSpans[1]!.count.addend = 1;

    for (const topology of [missing, extra, shifted, widenedCount]) {
      expect(() => planKernelLifecycleTopology(topology, [2n, 2n])).toThrow();
    }
  });

  it('rejects every widened participant identity dimension', () => {
    const identityMutations = [
      ['lockingBytecode', 'foreign'],
      ['tokenCategory', 'foreign'],
      ['nftCapability', 'mutable'],
      ['nftCommitment', 'preserve'],
      ['tokenAmount', 'nondecrease'],
      ['satoshis', 'preserve'],
    ] as const;
    for (const [field, value] of identityMutations) {
      const topology = clone(splitTopology());
      topology.outputSpans[1]!.identity[field] = value;
      expect(() => planKernelLifecycleTopology(topology, [2n]), field).toThrow();
    }
  });

  it('rejects missing and widened transaction-wide category censuses', () => {
    const missing = clone(splitTopology()) as Record<string, unknown>;
    delete missing.categoryCensus;
    const wrongCategory = clone(splitTopology());
    wrongCategory.categoryCensus.tokenCategory = 'foreign';
    const wrongCapability = clone(splitTopology());
    wrongCapability.categoryCensus.nftCapability = 'mutable';
    const extraOutput = clone(splitTopology());
    extraOutput.categoryCensus.outputCount.addend = 2;
    for (const topology of [missing, wrongCategory, wrongCapability, extraOutput]) {
      expect(() => planKernelLifecycleTopology(topology, [2n])).toThrow();
    }
  });

  it('rejects unknown schemas and unusable runtime counts', () => {
    const extended = { ...splitTopology(), unauthenticatedHint: true };
    expect(() => planKernelLifecycleTopology(extended, [2n])).toThrow(/unsupported schema/);
    expect(() => planKernelLifecycleTopology(splitTopology(), [0n])).toThrow(/positive safe integer/);
    expect(() => planKernelLifecycleTopology(splitTopology(), ['2'])).toThrow(/positive safe integer/);
    expect(() => planKernelLifecycleTopology(splitTopology(), [BigInt(Number.MAX_SAFE_INTEGER) + 1n]))
      .toThrow(/positive safe integer/);
  });

  it('binds exact split and merge transaction frames', () => {
    const split = bindKernelLifecycleTransaction(splitTopology(), [2n], splitFrame());
    expect(split).toMatchObject({
      kind: 'split', inputBase: 0, outputBase: 0,
      categoryCensus: { inputCount: 1, outputCount: 3 },
    });
    expect(Array.from(split.transcript.slice(0, 4))).toEqual([0x4b, 0x4c, 0x43, 0x32]);
    expect(bindKernelLifecycleTransaction(mergeTopology(), [2n], mergeFrame())).toMatchObject({
      kind: 'merge', categoryCensus: { inputCount: 3, outputCount: 1 },
    });
  });

  it('rejects split identity, created-output, and census tampering', () => {
    const wrongOwner = splitFrame();
    wrongOwner.outputs[1]!.lockingBytecode = 'bb20';
    const wrongCategory = splitFrame();
    wrongCategory.outputs[1]!.tokenCategory = '22'.repeat(31) + 'dd';
    const dirtyCreated = splitFrame();
    dirtyCreated.outputs[1]!.nftCommitment = '00';
    const unfundedCreated = splitFrame();
    unfundedCreated.outputs[1]!.satoshis = 0n;
    const extraCategory = splitFrame();
    extraCategory.inputs.push(point());
    for (const frame of [wrongOwner, wrongCategory, dirtyCreated, unfundedCreated, extraCategory]) {
      expect(() => bindKernelLifecycleTransaction(splitTopology(), [2n], frame)).toThrow();
    }
  });

  it('rejects preserved-master and merge-input tampering', () => {
    const inflatedSplit = splitFrame();
    inflatedSplit.outputs[0]!.tokenAmount = 3n;
    const shiftedSplit = splitFrame();
    shiftedSplit.outputBase = 1;
    for (const frame of [inflatedSplit, shiftedSplit]) {
      expect(() => bindKernelLifecycleTransaction(splitTopology(), [2n], frame)).toThrow();
    }
    const changedCommitment = mergeFrame();
    changedCommitment.outputs[0]!.nftCommitment = 'ffff';
    const reducedTokens = mergeFrame();
    reducedTokens.outputs[0]!.tokenAmount = 1n;
    const changedValue = mergeFrame();
    changedValue.outputs[0]!.satoshis = 999n;
    const foreignConsumed = mergeFrame();
    foreignConsumed.inputs[2]!.lockingBytecode = 'bb20';
    for (const frame of [changedCommitment, reducedTokens, changedValue, foreignConsumed]) {
      expect(() => bindKernelLifecycleTransaction(mergeTopology(), [2n], frame)).toThrow();
    }
  });
});
