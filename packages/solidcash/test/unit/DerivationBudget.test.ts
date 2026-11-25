import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareDeriveFullPhase2Loop } from '../../src/stateful/sc-prepare-derive-full-phase2-loop.js';
import type { StatefulTransactionBuilder } from '../../src/stateful/StatefulTransactionBuilder.js';

function prepare(persistWidthAtEntry = 0): ReturnType<typeof prepareDeriveFullPhase2Loop> {
  const host = {
    inner: { provider: {} as never, artifact: {} },
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

afterEach(() => vi.unstubAllEnvs());

describe('participant derivation budget', () => {
  it('preserves legacy iteration defaults and persisted-chunk bounds', () => {
    expect(prepare().maxIterations).toBe(20);
    expect(prepare(3).maxIterations).toBe(8);
  });
});
