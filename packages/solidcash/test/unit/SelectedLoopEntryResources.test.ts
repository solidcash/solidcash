import type { AbiFunction } from '@solidcash/utils';
import { describe, expect, it, vi } from 'vitest';
import { loadCreateBuilderDynamicChunks } from '../../src/stateful/sc-load-create-builder-dynamic-chunks.js';

const route: AbiFunction = { name: 'route', inputs: [], entryLoopWrites: ['unused', 'records'] };

async function plan(
  abi: AbiFunction,
  overrides: Partial<Parameters<typeof loadCreateBuilderDynamicChunks>[1]> = {},
): Promise<string[]> {
  const result = await loadCreateBuilderDynamicChunks({
    categoryId: '11'.repeat(31) + 'ee',
    inner: { stateLayout: { collections: [] }, artifact: {}, provider: {} },
    evaluateExternalExpression: vi.fn(), hydrateExternalPredicateState: vi.fn(), vmapCounterDomain: vi.fn(),
  }, {
    dynamicVarInfos: [], dynamicChunkVars: [], valueChunkGc: [], onChainState: {} as never,
    stateLayout: { variables: [], collections: [] } as never, overrides: undefined,
    abiFunction: abi, entryAbiFunction: abi, lowLevelCallUtxoGroups: [],
    nestedDelegateProxyGroupByLowLevel: new Map(), batchPredCommitments: new Map(),
    sortedLoopCommitments: new Map(), runtimeLoopDerivedCounts: new Map(), sortedInserts: [],
    args: [], entryArgs: [], finalArgs: [], eventDefs: [], runtimeEventNftLockingBytecodes: new Map(),
    runtimeLoopEntrySegments: [], dynamicWrites: [], activeDynamicWrites: new Set(), externalCallUtxoGroups: [],
    routeRowIndex: () => 0, selectedRowArgument: vi.fn(),
    entryNftLockingBytecodes: new Map(['unused', 'records', 'fixed', 'runtime', 'insert', 'local'].map((name) => [
      name, Uint8Array.of(0x51),
    ])),
    ...overrides,
  });
  return result.loopEntryVars.map((variable) => variable.collection);
}

describe('selected loop-entry resources', () => {
  it('preserves direct or legacy ABI writes when no selected rows are available', async () => {
    expect(await plan(route)).toEqual(['unused', 'records']);
  });
});
