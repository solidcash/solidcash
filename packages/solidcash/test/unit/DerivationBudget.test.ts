import { buildMessageBusResourceBudgets, type Artifact } from '@solidcash/utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareDeriveFullPhase2Loop } from '../../src/stateful/sc-prepare-derive-full-phase2-loop.js';
import type { StatefulTransactionBuilder } from '../../src/stateful/StatefulTransactionBuilder.js';

function prepare(
  messageBus?: Artifact['messageBus'], persistWidthAtEntry = 0,
): ReturnType<typeof prepareDeriveFullPhase2Loop> {
  const host = {
    inner: { provider: {} as never, artifact: { messageBus } },
    maxDerivationIterations: 20,
    lastDerivationIterations: 0,
  };
  const stb = {
    getLoopEntryVars: () => [],
    getRuntimeLoopEventOutputs: () => [],
    getRuntimeLoopTransferOutputs: () => [],
    getValueChunkVars: () => [],
    getDynamicChunkVars: () => [],
    seedPersistedJobEventsBand: () => {},
    seedOptimisticScalarWrites: () => {},
    seedOptimisticArrayElementWrites: () => {},
    getOptimisticPermutationCount: () => 1,
  } as unknown as StatefulTransactionBuilder;
  return prepareDeriveFullPhase2Loop(host, stb, {
    entryAccessesLength: 0,
    emitInfosLength: 39,
    requiredNftIndicesLength: 1,
    persistWidthAtEntry,
    debugTargetDerivation: false,
    dummyLbc: new Uint8Array(),
    delegatecallInputIndex: undefined,
  });
}

const kernel = {
  convention: 'kernel-row-loop',
  resourceBudgets: buildMessageBusResourceBudgets({ maximumRows: 39 }),
} as Artifact['messageBus'];

afterEach(() => vi.unstubAllEnvs());

describe('participant derivation budget', () => {
  it('uses the published kernel ceiling, including when persisted chunks are already seeded', () => {
    const ceiling = kernel!.resourceBudgets!.maximumSemanticDerivationPasses;
    expect(prepare(kernel).maxIterations).toBe(ceiling);
    expect(prepare(kernel, 3).maxIterations).toBe(ceiling);
  });

  it('preserves legacy iteration defaults and persisted-chunk bounds', () => {
    expect(prepare().maxIterations).toBe(20);
    expect(prepare(undefined, 3).maxIterations).toBe(8);
  });

  it('fails closed when a kernel artifact has no published derivation budget', () => {
    expect(() => prepare({ ...kernel!, resourceBudgets: undefined }))
      .toThrow(/maximumSemanticDerivationPasses/);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid published ceiling %s', (ceiling) => {
    expect(() => prepare({ ...kernel!, resourceBudgets: {
      ...kernel!.resourceBudgets!, maximumSemanticDerivationPasses: ceiling,
    } })).toThrow(/maximumSemanticDerivationPasses/);
  });

  it('allows diagnostic iteration limits only to lower the published ceiling', () => {
    vi.stubEnv('SOLIDC_DEBUG_MAX_DERIVATION_ITERATIONS', '2');
    expect(prepare(kernel).maxIterations).toBe(2);
    vi.stubEnv('SOLIDC_DEBUG_MAX_DERIVATION_ITERATIONS', '99999');
    expect(prepare(kernel).maxIterations).toBe(kernel!.resourceBudgets!.maximumSemanticDerivationPasses);
  });
});
