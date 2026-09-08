import { describe, expect, it } from 'vitest';
import type { AbiFunction, Artifact, StateLayout } from '@cashscript/utils';
import type { ExternalCallUtxoGroup } from '../../src/stateful/StatefulTransactionBuilder.js';
import {
  chunkableWriterGroupIndex,
  computedStateWriterGroupIndex,
} from '../../src/stateful/StatefulContract.js';

const layout: StateLayout = {
  variables: [],
  dataNftCount: 0,
  commitmentLimit: 128,
  collections: [
    {
      name: 'notices',
      signature: 'notices:mapping(int => Notice[])',
      keyType: 'int',
      valueType: 'Notice[]',
      chunkableValue: true,
    },
    {
      name: 'balances',
      signature: 'balances:mapping(address => int)',
      keyType: 'address',
      valueType: 'int',
    },
  ],
};

function group(name: string, abi: AbiFunction, kernel = false): ExternalCallUtxoGroup {
  const artifact = {
    abi: [abi], stateLayout: layout,
    ...(kernel && { messageBus: { convention: 'kernel-row-loop' } }),
  } as unknown as Artifact;
  return {
    categoryId: '00'.repeat(32),
    stateLayout: layout,
    masterUtxo: {} as ExternalCallUtxoGroup['masterUtxo'],
    dataNftUtxos: [],
    requiredDataNftIndices: [],
    functionName: name,
    functionArgs: [],
    externalContract: { inner: { artifact } },
    compilerRoute: {
      abiFunction: abi,
      selector: new Uint8Array(4),
      blob: new Uint8Array(),
      args: [],
      logicalSelectors: [],
    },
  };
}

function fn(name: string, collection: string, operations: Array<'read' | 'write'>): AbiFunction {
  return {
    name,
    selector: '00000000',
    inputs: [],
    outputs: [],
    writesState: operations.includes('write'),
    entryAccesses: [{ collection, operations }],
  } as AbiFunction;
}

describe('compiler-owned participant identity', () => {
  it('selects a renamed computed writer and ignores a misleading ERC-named reader', () => {
    const decoy = group('transferFrom', fn('transferFrom', 'balances', ['read']));
    const renamed = group('applyLedgerDelta', fn('applyLedgerDelta', 'balances', ['write']));
    expect(computedStateWriterGroupIndex([decoy, renamed], [0, 1])).toBe(1);
  });

  it('fails closed when published effects identify more than one computed writer', () => {
    const first = group('alpha', fn('alpha', 'balances', ['write']));
    const second = group('beta', fn('beta', 'balances', ['write']));
    expect(computedStateWriterGroupIndex([first, second], [0, 1])).toBeUndefined();
  });

  it('selects a renamed chunkable writer and ignores publishJobEvent-shaped metadata', () => {
    const decoy = group('publishJobEvent', fn('publishJobEvent', 'balances', ['write']));
    const renamed = group('appendNotice', fn('appendNotice', 'notices', ['write']));
    expect(chunkableWriterGroupIndex([decoy, renamed])).toBe(1);
  });

  it('selects a chunkable writer from self-contained entry metadata without a state layout lookup', () => {
    const renamed = group('appendNotice', {
      ...fn('appendNotice', 'notices', ['write']),
      entryAccesses: [{
        collection: 'notices', keyParams: [], operations: ['write'], chunkableArrayValue: true,
      }],
    } as AbiFunction);
    renamed.stateLayout = { ...layout, collections: [] };
    (renamed.externalContract!.inner!.artifact as Artifact).stateLayout = renamed.stateLayout;
    expect(chunkableWriterGroupIndex([renamed])).toBe(0);
  });

  it('selects alpha-renamed legacy writers from exact planned continuation geometry', () => {
    const planned = (name: string, collectionName: string): ExternalCallUtxoGroup => {
      const stateLayout = {
        ...layout,
        collections: [{
          name: collectionName,
          signature: `${collectionName}:mapping(int => Notice[])`,
          keyType: 'int', valueType: 'Notice[]', chunkableValue: true,
        }],
      } as StateLayout;
      const abi = {
        name, selector: '00000000',
        inputs: [{ name: '__internal__valueChunkOutputBase', type: 'int' }],
        outputs: [], writesState: true,
        blockLayout: {
          blockSize: 2,
          slots: [
            { kind: 'master', offset: 0 },
            { kind: 'entry', offset: 1, slotIndex: 0 },
          ],
        },
      } as AbiFunction;
      const candidate = group(name, abi);
      candidate.stateLayout = stateLayout;
      (candidate.externalContract!.inner!.artifact as Artifact).stateLayout = stateLayout;
      candidate.valueChunkOutputBase = 10;
      candidate.valueChunkOutputCount = 2;
      return candidate;
    };
    expect(chunkableWriterGroupIndex([planned('publishJobEvent', 'jobEvents')])).toBe(0);
    expect(chunkableWriterGroupIndex([planned('appendNotice', 'notices')])).toBe(0);
    expect(chunkableWriterGroupIndex([
      planned('appendNotice', 'notices'), planned('recordHistory', 'history'),
    ])).toBe(-1);
    expect(chunkableWriterGroupIndex(
      [planned('publishJobEvent', 'jobEvents')], 'kernel-row-loop',
    )).toBe(-1);
  });

  it('retains the name fallback only when old artifacts publish no entry effects', () => {
    const legacy = group('transferFrom', {
      name: 'transferFrom', selector: '00000000', inputs: [], outputs: [], writesState: true,
    } as AbiFunction);
    expect(computedStateWriterGroupIndex([legacy], [0])).toBe(0);
  });

  it('does not recover application names from descriptor-free kernel artifacts', () => {
    const namedComputed = group('transferFrom', {
      name: 'transferFrom', selector: '00000000', inputs: [], outputs: [], writesState: true,
    } as AbiFunction, true);
    const namedChunkable = group('publishJobEvent', {
      name: 'publishJobEvent', selector: '00000000', inputs: [], outputs: [], writesState: true,
    } as AbiFunction, true);
    const renamedChunkable = group('appendNotice', {
      name: 'appendNotice', selector: '00000000', inputs: [], outputs: [], writesState: true,
    } as AbiFunction, true);

    expect(computedStateWriterGroupIndex([namedComputed], [0])).toBeUndefined();
    expect(chunkableWriterGroupIndex([namedChunkable])).toBe(-1);
    expect(chunkableWriterGroupIndex([renamedChunkable])).toBe(-1);
  });

  it('keeps descriptor-free legacy children name-independent under a kernel owner', () => {
    const namedComputed = group('transferFrom', {
      name: 'transferFrom', selector: '00000000', inputs: [], outputs: [], writesState: true,
    } as AbiFunction);
    const renamedComputed = group('applyLedgerDelta', {
      name: 'applyLedgerDelta', selector: '00000000', inputs: [], outputs: [], writesState: true,
    } as AbiFunction);
    const namedChunkable = group('publishJobEvent', {
      name: 'publishJobEvent', selector: '00000000', inputs: [], outputs: [], writesState: true,
    } as AbiFunction);
    const renamedChunkable = group('appendNotice', {
      name: 'appendNotice', selector: '00000000', inputs: [], outputs: [], writesState: true,
    } as AbiFunction);

    expect(computedStateWriterGroupIndex([namedComputed], [0], 'kernel-row-loop')).toBeUndefined();
    expect(computedStateWriterGroupIndex([renamedComputed], [0], 'kernel-row-loop')).toBeUndefined();
    expect(chunkableWriterGroupIndex([namedChunkable], 'kernel-row-loop')).toBe(-1);
    expect(chunkableWriterGroupIndex([renamedChunkable], 'kernel-row-loop')).toBe(-1);
  });
});
