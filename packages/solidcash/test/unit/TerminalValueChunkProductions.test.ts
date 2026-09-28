import { binToHex } from '@bitauth/libauth';
import { computeCollectionHash } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import type { PreparedAtomicMessageBusCall } from '../../src/message-bus/compose-prepared-invocation.js';
import { retainTerminalValueChunkProductions } from '../../src/message-bus/terminal-value-chunk-productions.js';
import {
  terminalValueChunkProducerClaim, type ValueChunkProducerMutationRow, type ValueChunkProducerSourceSite,
} from '../../src/stateful/ValueChunkProducerIdentity.js';

const categoryId = '31'.repeat(32);
const collectionSignature = 'records:mapping(uint256 => bytes)';
const collectionHash = binToHex(computeCollectionHash(collectionSignature));
const stateOwner = { categoryId, lockingBytecode: '51' };
const resourceIdentity = `${categoryId}:${collectionHash}:${'42'.repeat(32)}`;
const site = (ordinal: number): ValueChunkProducerSourceSite => ({
  sourceEffectDomainId: '91'.repeat(32), sourceCallsiteId: ordinal,
  occurrenceIndex: 0, sourceEffectOrdinal: ordinal,
});
const row = (selector: string, ordinals: number[], nested = false): ValueChunkProducerMutationRow => ({
  selector,
  producerPath: { status: 'complete', context: {
    version: 1, sourcePath: nested ? [site(0), site(6), site(0)] : [site(0)],
  } },
  handler: { selector, sourceEffectOrder: 'linear', entryAccesses: [{
    collection: collectionSignature, operations: ['write'], mutationEffectOrdinals: ordinals,
  }] },
});
const production = (
  source: ValueChunkProducerMutationRow,
): NonNullable<PreparedAtomicMessageBusCall['valueChunkProductions']>[number] => ({
  stateOwner,
  write: {
    categoryId, collection: 'records', collectionSignature, collectionHash,
    keySlot: '42'.repeat(32), entryAccessSlot: 0, routeSlot: 0,
    operation: 'update', outputBase: 10, outputCount: 2,
  },
  claim: terminalValueChunkProducerClaim({
    rows: [source], collectionIdentities: [collectionSignature],
    executionLockingBytecode: '51', stateOwnerCategoryId: categoryId,
    stateOwnerLockingBytecode: '51', resourceIdentity,
  })!,
  value: new Uint8Array(200).fill(source.selector === '01020304' ? 1 : 2),
});

describe('terminal transported value production selection', () => {
  it.each([false, true])('selects a later nested writer with a smaller local ordinal (reversed: %s)', (reversed) => {
    const early = row('01020304', [5]);
    const late = row('05060708', [1], true);
    const earlierValue = production(early);
    const terminalValue = production(late);
    const candidates = new Map([['early', earlierValue], ['late', terminalValue]]);
    if (reversed) {
      candidates.delete('early');
      candidates.set('early', earlierValue);
    }
    retainTerminalValueChunkProductions(candidates, { rows: [early, late], executionLockingBytecode: '51' });
    expect([...candidates.values()]).toEqual([terminalValue]);
  });

  it('orders repeated occurrences by the route even when local mutation ordinals are equal', () => {
    const early = row('01020304', [5]);
    const late = { ...row('01020304', [5]), producerPath: {
      status: 'complete' as const, context: { version: 1 as const, sourcePath: [{ ...site(0), occurrenceIndex: 1 }] },
    } };
    const terminalValue = production(late);
    const candidates = new Map([['late', terminalValue], ['early', production(early)]]);
    retainTerminalValueChunkProductions(candidates, { rows: [early, late], executionLockingBytecode: '51' });
    expect([...candidates.values()]).toEqual([terminalValue]);
  });

  it.each(['missing', 'domain', 'path', 'ordinal', 'flow'])(
    'refuses a missing or inconsistent terminal claim (%s) without dropping evidence', (difference) => {
      const early = row('01020304', [5]);
      const late = row('05060708', [1], true);
      const terminalValue = structuredClone(production(late));
      if (difference === 'domain') terminalValue.claim.producer.mutationEffectDomainId = 'ab'.repeat(32);
      if (difference === 'path') terminalValue.claim.producer.sourcePath = [site(0), site(6)];
      if (difference === 'ordinal') terminalValue.claim.producer.mutationSourceEffectOrdinal = 2;
      const candidates = new Map([['early', production(early)]]);
      if (difference !== 'missing') candidates.set('late', terminalValue);
      const before = [...candidates];
      const finalRow = difference === 'flow'
        ? { ...late, handler: { ...late.handler, sourceEffectOrder: 'unsupported-flow' as const } } : late;
      expect(() => retainTerminalValueChunkProductions(candidates, {
        rows: [early, finalRow], executionLockingBytecode: '51',
      })).toThrow(/omit the routed terminal producer/);
      expect([...candidates]).toEqual(before);
    },
  );

  it('refuses different state owners even when one would otherwise be superseded', () => {
    const early = row('01020304', [5]);
    const late = row('05060708', [1], true);
    const earlierValue = structuredClone(production(early));
    earlierValue.stateOwner.lockingBytecode = '52';
    earlierValue.claim.producer.stateOwner.lockingBytecode = '52';
    const candidates = new Map([['early', earlierValue], ['late', production(late)]]);
    expect(() => retainTerminalValueChunkProductions(candidates, {
      rows: [early, late], executionLockingBytecode: '51',
    })).toThrow(/multiple state owners/);
    expect(candidates.size).toBe(2);
  });
});
