import { describe, expect, it } from 'vitest';
import { planKernelLifecycleTopology } from '../../src/stateful/KernelLifecycleTopology.js';

const preservedIdentity = {
  lockingBytecode: 'participant', tokenCategory: 'participant', nftCapability: 'minting',
  nftCommitment: 'preserve', tokenAmount: 'nondecrease', satoshis: 'preserve',
};
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
    { mode: 'preserve', offset: 0, count: fixedOne, identity: preservedIdentity },
  ],
  outputSpans: [
    { mode: 'preserve', offset: 0, count: fixedOne, identity: preservedIdentity },
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

describe('kernel lifecycle topology planning prerequisite', () => {
  it('resolves canonical split and merge participant spans', () => {
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
});
