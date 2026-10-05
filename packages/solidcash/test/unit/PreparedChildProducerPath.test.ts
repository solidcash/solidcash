import { describe, expect, it } from 'vitest';
import type { PreparedAtomicMessageBusCall } from '../../src/message-bus/compose.js';
import { prepareCreateBuilderLowLevelNestedCaches } from '../../src/stateful/sc-prepare-create-builder-low-level-nested-caches.js';
import { valueChunkEffectDomainId } from '../../src/stateful/ValueChunkProducerIdentity.js';

const source = { sourceCallsiteId: 2, occurrenceIndex: 0, sourceEffectOrdinal: 5 };
const contract = (lockingBytecode: string): PreparedAtomicMessageBusCall['contract'] => (
  { inner: { lockingBytecode } } as PreparedAtomicMessageBusCall['contract']
);
const root = (): PreparedAtomicMessageBusCall => ({
  contract: contract('51'),
  functionName: 'apply',
  selector: '01020304',
  args: [],
  producerPath: { status: 'complete', context: { version: 1, sourcePath: [] } },
});
const caches = (): ReturnType<typeof prepareCreateBuilderLowLevelNestedCaches> => prepareCreateBuilderLowLevelNestedCaches({
  signer: undefined,
  inner: {},
  syncMockParticipantOracle: async () => {},
  resolveExternalArgs: () => [],
}, {
  abiFunction: undefined,
  physicalAbiFunction: undefined,
  earlySignerUtxos: undefined,
  sharedFunderPool: undefined,
  sharedFunderSnapshot: undefined,
  timingEnabled: false,
  externalCallUtxoGroups: [],
  identityAnchors: [],
  identityAnchorBandByAddress: new Map(),
});

describe('prepared child producer paths', () => {
  it('derives a path from a parent materialized after the nested caches were created', async () => {
    const cache = await caches();
    let nodes: PreparedAtomicMessageBusCall[] | undefined = cache.preparedAtomicNodes;
    const path = (): ReturnType<typeof cache.preparedChildProducerPath> => (
      cache.preparedChildProducerPath(nodes?.[0], source)
    );
    expect(path()).toEqual({ status: 'unavailable' });

    nodes = [root()];
    expect(path()).toEqual({ status: 'complete', context: { version: 1, sourcePath: [{
      sourceEffectDomainId: valueChunkEffectDomainId('51', '01020304'),
      ...source,
    }] } });

    nodes = [{ ...root(), selector: '05060708' }];
    expect(path()).toMatchObject({ context: { sourcePath: [{
      sourceEffectDomainId: valueChunkEffectDomainId('51', '05060708'),
    }] } });
  });

  it('extends the exact ancestor path and uses delegate execution identity', async () => {
    const cache = await caches();
    const first = cache.preparedChildProducerPath(root(), source);
    const parent = { ...root(), producerPath: first, executor: contract('52') };
    const childSource = { ...source, sourceCallsiteId: 7, sourceLogicalIndex: 3, occurrenceIndex: 1 };
    const child = cache.preparedChildProducerPath(parent, childSource);
    expect(child).toEqual({ status: 'complete', context: { version: 1, sourcePath: [
      { sourceEffectDomainId: valueChunkEffectDomainId('51', '01020304'), ...source },
      { sourceEffectDomainId: valueChunkEffectDomainId('52', '01020304'), ...childSource },
    ] } });
    expect(first).toMatchObject({ context: { sourcePath: [expect.any(Object)] } });
  });

  it('retains unavailable identity when parent metadata or compiler coordinates are absent', async () => {
    const cache = await caches();
    for (const parent of [undefined, { ...root(), producerPath: undefined },
      { ...root(), selector: undefined }]) {
      expect(cache.preparedChildProducerPath(parent, source)).toEqual({ status: 'unavailable' });
    }
    expect(cache.preparedChildProducerPath(root(), { ...source, sourceEffectOrdinal: undefined }))
      .toEqual({ status: 'unavailable' });
  });
});
