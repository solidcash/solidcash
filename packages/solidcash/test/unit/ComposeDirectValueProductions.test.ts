import { bigIntToVmNumber } from '@bitauth/libauth';
import { describe, expect, it, vi } from 'vitest';
import { stageUniqueDirectValueProductions } from '../../src/message-bus/compose-direct-value-productions.js';
import { keyToSlotMulti } from '../../src/stateful/SortedList.js';
import type { CallDescriptor } from '../../src/message-bus/compose-prepared-invocation.js';

const categoryId = '31'.repeat(32);
const collection = {
  name: 'records', signature: 'records:mapping(uint256 => bytes)',
  keyType: 'uint256', keyTypes: ['uint256'], valueType: 'bytes', chunkableValue: true,
};
const slot = keyToSlotMulti([bigIntToVmNumber(1n)], collection);
const handler = {
  name: 'replace', selector: '01020304', sourceEffectOrder: 'linear',
  inputs: [{ name: 'key', type: 'uint256' }, { name: 'next', type: 'bytes' }],
  outputs: [],
  entryAccesses: [{
    slotIndex: 0, collection: collection.name, keyParams: ['key'], operations: ['write'],
    mutationEffectOrdinals: [3],
    storedValueSource: {
      version: 1, execution: 'unconditional-once', mutationEffectOrdinal: 3,
      valueType: 'bytes', expression: {
        kind: 'source', type: 'bytes', source: { kind: 'forward', paramIndex: 1 },
      },
    },
  }],
};
const artifact = {
  abi: [handler], stateLayout: { collections: [collection] },
  messageBus: { fixedChunkableWritePolicy: { selectors: [handler.selector] } },
};
const value = new Uint8Array(100).fill(0x42);
const contract = {
  categoryId,
  inner: { lockingBytecode: '51', artifact },
  getEntries: vi.fn(async () => [{ slot, value: new Uint8Array([0x01]) }]),
  _resolveExternalArgs: vi.fn((sources: Array<{ paramIndex: number }>, args: unknown[]) => (
    sources.map((source) => args[source.paramIndex])
  )),
};
const descriptor = (): CallDescriptor => ({
  contract, artifact, functionName: handler.name, selector: handler.selector,
  args: [1n, value],
  producerPath: {
    status: 'complete', context: { version: 1, sourcePath: [{
      sourceEffectDomainId: '91'.repeat(32), sourceCallsiteId: 2,
      occurrenceIndex: 0, sourceEffectOrdinal: 4,
    }] },
  },
} as unknown as CallDescriptor);

describe('direct graph value productions', () => {
  it('leaves repeated writes to one owner and collection for ordered route folding', async () => {
    const otherWrite = descriptor();
    otherWrite.artifact = {
      ...artifact,
      abi: [{ ...handler, entryAccesses: [{ ...handler.entryAccesses[0], storedValueSource: undefined }] }],
    } as unknown as CallDescriptor['artifact'];
    const calls = [descriptor(), otherWrite];
    await stageUniqueDirectValueProductions(calls, async () => ({}));
    expect(calls.every((call) => call.valueChunkProductions === undefined)).toBe(true);
  });

  it('stages one compiler-authenticated whole-value write for the runtime-resolved direct owner', async () => {
    const calls = [descriptor()];
    await stageUniqueDirectValueProductions(calls, async () => ({}));
    expect(calls[0].valueChunkProductions).toHaveLength(1);
    const production = calls[0].valueChunkProductions![0]!;
    expect(production.value).toEqual(value);
    expect(production.write).toMatchObject({
      categoryId, collection: collection.name, operation: 'update', outputBase: -1, outputCount: 0,
    });
    expect(production.claim.producer.sourcePath).toEqual(
      calls[0].producerPath?.status === 'complete' ? calls[0].producerPath.context.sourcePath : [],
    );
  });
});
