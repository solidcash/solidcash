import type { AbiFunction } from '@solidcash/utils';
import { describe, expect, it, vi } from 'vitest';
import { loadCreateBuilderDynamicChunks } from '../../src/stateful/sc-load-create-builder-dynamic-chunks.js';
import type { MessageBusRuntimeAbiFunction } from '../../src/stateful/sc-batch-raw.js';

const route: AbiFunction = { name: 'route', inputs: [], entryLoopWrites: ['unused', 'records'] };
const append: AbiFunction = { name: 'append', inputs: [], entryLoopWrites: ['records'] };
const read: AbiFunction = { name: 'read', inputs: [] };
const row = (handler: AbiFunction): NonNullable<MessageBusRuntimeAbiFunction['messageBusRowArguments']>[number] => ({
  handler, args: [],
});

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
  it('does not materialize sibling-handler collections from a shared route union', async () => {
    const selected: MessageBusRuntimeAbiFunction = { ...route, messageBusRowArguments: [row(append)] };
    expect(await plan(selected)).toEqual(['records']);
  });

  it.each([{ rows: [] }, { rows: [row(read)] }])('keeps an explicitly non-writing selection empty ($rows)', async ({ rows }) => {
    const selected: MessageBusRuntimeAbiFunction = { ...route, messageBusRowArguments: rows };
    expect(await plan(selected)).toEqual([]);
  });

  it('uses delegate row selection for a promoted entry ABI without embedded rows', async () => {
    const wrapper: AbiFunction = { name: 'forward', inputs: [], entryLoopWrites: ['local'] };
    expect(await plan(wrapper, {
      entryAbiFunction: route,
      lowLevelCallUtxoGroups: [{
        callMode: 'delegatecall', compilerRoute: { abiFunction: route, rowArguments: [row(append)] },
        externalContract: { inner: { artifact: {} } },
      }] as never,
    })).toEqual(['local', 'records']);
  });

  it('retains fixed and runtime plans before deduplicated selected collections', async () => {
    const selected: MessageBusRuntimeAbiFunction = {
      ...route, messageBusRowArguments: [row(append), row(append)],
    };
    expect(await plan(selected, {
      batchPredCommitments: new Map([['fixed', []]]),
      sortedLoopCommitments: new Map([['records', []]]),
      runtimeLoopDerivedCounts: new Map([['runtime', 2]]), sortedInserts: [{ collection: 'insert' }],
    })).toEqual(['fixed', 'records', 'runtime', 'insert']);
  });

  it('preserves direct or legacy ABI writes when no selected rows are available', async () => {
    expect(await plan(route)).toEqual(['unused', 'records']);
  });
});
