/**
 * composition settlement session: CompositionSettlementSession isolates STB settlement maps across builds.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensurePersistedJobEventsInputs } from '../../src/stateful/stb-ensure-persisted-job-events-inputs.js';
import {
  persistedCompatibilityContinuation,
  persistedJobEventsUnlockRecipe,
} from '../../src/stateful/value-chunk-persist.js';
import {
  CompositionSettlementSession,
  createCompositionSettlementSession,
  getCompositionSettlementSession,
  isPersistedCompatibilityValueChunkReady,
  isPersistedJobEventsReady,
  legacyPersistedValueChunkLock,
  legacyPersistedValueChunkValue,
  legacyRememberValueChunkLock,
  legacyRememberValueChunkValue,
  runWithCompositionSettlementSession,
  legacyStageValueChunkValue,
  markPersistedCompatibilityValueChunkReady,
  StatefulTransactionBuilder,
} from '../../src/stateful/StatefulTransactionBuilder.js';

describe('composition settlement session CompositionSettlementSession', () => {
  afterEach(() => {
    StatefulTransactionBuilder.clearPersistedJobEvents();
  });

  it('isolates mutations between two independent sessions', () => {
    const a = createCompositionSettlementSession();
    const b = createCompositionSettlementSession();
    const categoryId = 'aa'.repeat(32);
    const value = new Uint8Array(80);
    value[0] = 0x4c;
    value[1] = 0xb4;
    const lock = new Uint8Array(35);
    lock[0] = 0xaa;
    lock[1] = 0x20;
    lock[34] = 0x87;

    legacyRememberValueChunkValue(categoryId, value, a);
    legacyRememberValueChunkLock(categoryId, lock, a);

    expect(legacyPersistedValueChunkValue(categoryId, a)).toEqual(value);
    expect(legacyPersistedValueChunkLock(categoryId, a)).toEqual(lock);
    expect(legacyPersistedValueChunkValue(categoryId, b)).toBeUndefined();
    expect(legacyPersistedValueChunkLock(categoryId, b)).toBeUndefined();
    // Default session also unaffected.
    expect(legacyPersistedValueChunkValue(categoryId)).toBeUndefined();
  });

  it('shared session sees mutations from helpers that inject it', () => {
    const shared = createCompositionSettlementSession();
    const categoryId = 'bb'.repeat(32);
    const value = new Uint8Array(64).fill(1);
    legacyStageValueChunkValue(categoryId, value, shared);
    legacyRememberValueChunkValue(categoryId, value, shared);
    expect(legacyPersistedValueChunkValue(categoryId, shared)).toEqual(value);

    // Same instance via runWith also sees the value.
    const seen = runWithCompositionSettlementSession(shared, () => (
      legacyPersistedValueChunkValue(categoryId)
    ));
    expect(seen).toEqual(value);
  });

  it('embeds ValueChunkWriteStagingSession in each CompositionSettlementSession', () => {
    const a = createCompositionSettlementSession();
    const b = createCompositionSettlementSession();
    expect(a.valueChunkWriteStaging).toBeInstanceOf(Object);
    expect(a.valueChunkWriteStaging).not.toBe(b.valueChunkWriteStaging);
    expect(a).toBeInstanceOf(CompositionSettlementSession);
    expect(getCompositionSettlementSession()).toBeInstanceOf(CompositionSettlementSession);
  });

  it('path-effect activation/settle-time ExecutionContext: isolates ExecutionContextLifecycle per CompositionSettlementSession', () => {
    const a = createCompositionSettlementSession();
    const b = createCompositionSettlementSession();
    expect(a.executionContexts).not.toBe(b.executionContexts);
    expect(a.executionContexts.getPhase()).toBe('open');
    a.executionContexts.settle();
    expect(a.executionContexts.getPhase()).toBe('settled');
    expect(b.executionContexts.getPhase()).toBe('open');
  });

  it('clear on one session does not wipe another', () => {
    const a = createCompositionSettlementSession();
    const b = createCompositionSettlementSession();
    const categoryId = 'cc'.repeat(32);
    const lock = new Uint8Array(35);
    lock[0] = 0xaa;
    lock[1] = 0x20;
    lock[34] = 0x87;
    legacyRememberValueChunkLock(categoryId, lock, a);
    legacyRememberValueChunkLock(categoryId, lock, b);
    a.clear(categoryId);
    expect(legacyPersistedValueChunkLock(categoryId, a)).toBeUndefined();
    expect(legacyPersistedValueChunkLock(categoryId, b)).toEqual(lock);
  });

  it('clearing one persisted compatibility category keeps another ready', () => {
    const session = createCompositionSettlementSession();
    const first = 'aa'.repeat(32);
    const second = 'bb'.repeat(32);
    runWithCompositionSettlementSession(session, () => {
      markPersistedCompatibilityValueChunkReady(first);
      markPersistedCompatibilityValueChunkReady(second);
      expect(isPersistedJobEventsReady(first)).toBe(true);
      expect(isPersistedJobEventsReady(second)).toBe(true);
      expect(isPersistedJobEventsReady()).toBe(true);
      expect(isPersistedCompatibilityValueChunkReady(second)).toBe(true);
    });
    session.clear(first);
    runWithCompositionSettlementSession(session, () => {
      expect(isPersistedJobEventsReady(first)).toBe(false);
      expect(isPersistedJobEventsReady(second)).toBe(true);
      expect(isPersistedJobEventsReady()).toBe(true);
      expect(isPersistedCompatibilityValueChunkReady(first)).toBe(false);
    });
    session.clear(second);
    expect(runWithCompositionSettlementSession(session, () => isPersistedJobEventsReady())).toBe(false);
  });

  it('does not pair a compatibility lock with another category value', () => {
    const session = createCompositionSettlementSession();
    const first = 'aa'.repeat(32);
    const second = 'bb'.repeat(32);
    const createdValue = new Uint8Array(80);
    createdValue.set(new TextEncoder().encode('Created'), 10);
    const lock = new Uint8Array(35);
    lock[0] = 0xaa;
    lock[1] = 0x20;
    lock[34] = 0x87;
    legacyRememberValueChunkValue(first, createdValue, session);
    legacyRememberValueChunkLock(second, lock, session);
    expect(session.persistedJobEventsLocks.get(second)).toEqual(lock);
    expect(session.observedValueChunkStatesByCategory.has(second)).toBe(false);
    expect(session.createdDigestLocks.has(second)).toBe(false);
    legacyRememberValueChunkValue(second, new Uint8Array(80).fill(7), session);
    expect(session.observedValueChunkStatesByCategory.has(second)).toBe(true);
    expect(session.createdDigestLocks.has(second)).toBe(false);
  });

  it('does not restore a predecessor through another category recipe', async () => {
    const session = createCompositionSettlementSession();
    const selected = 'aa'.repeat(32);
    const unrelated = 'bb'.repeat(32);
    session.persistedJobEventsRecipes.set(unrelated, {
      slot: new Uint8Array(32), root: new Uint8Array(32),
      collection: 'jobEvents', categoryId: unrelated,
    });
    const unrelatedLock = new Uint8Array(35);
    session.persistedJobEventsLocks.set(unrelated, unrelatedLock);
    session.persistedJobEventsValues.set(unrelated, new Uint8Array(80));
    session.persistedJobEventsSpends.set(unrelated, [{ txid: '01' } as never]);
    const requestedCategories: string[] = [];
    const host = {
      externalCallUtxoGroups: [{ functionName: 'transferFrom' }],
      messageBusConvention: 'legacy-unroll',
      builderOptions: { provider: { network: 'chipnet' } },
      allInputs: [],
      setPendingJobEventsPredecessors: () => {},
      getChunkableValueWriteBand: () => ({ start: 1, end: 1, nNew: 1 }),
      persistedValueChunkCategory: () => selected,
      chunkableValueWriteCategory: () => selected,
      isInitialChunkableValueWrite: () => false,
      isPersistedChunkableValueWriteReady: () => true,
      persistedValueChunkWrite: () => undefined,
      hasChunkableValueWriteMetadata: () => false,
      permitsLegacyNamedValueChunkFallback: () => true,
      chunkableValueWriteGroups: () => ({ externalIndex: -1, externalIndices: [], lowLevelIndex: -1 }),
      findMintingInputIndex: (categoryId: string) => {
        requestedCategories.push(categoryId);
        return -1;
      },
      placeJobEventsPredecessorInputs: () => {},
    };
    expect(runWithCompositionSettlementSession(session, () => persistedJobEventsUnlockRecipe(selected)))
      .toBeUndefined();
    expect(runWithCompositionSettlementSession(session, () => persistedCompatibilityContinuation(selected)))
      .toEqual({ lockingBytecode: undefined, value: undefined, spends: [] });
    await runWithCompositionSettlementSession(session, () => ensurePersistedJobEventsInputs(host as never));
    expect(requestedCategories).toEqual([selected]);
  });

  it('STB production helpers and clearPersistedJobEvents go through settlement()', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const persistSrc = readFileSync(
      join(here, '../../src/stateful/value-chunk-persist.ts'),
      'utf8',
    );
    const stbSrc = readFileSync(
      join(here, '../../src/stateful/StatefulTransactionBuilder.ts'),
      'utf8',
    );
    expect(persistSrc).toContain('export class CompositionSettlementSession');
    expect(persistSrc).toContain('runWithCompositionSettlementSession');
    expect(stbSrc).toContain('settlement().clear(categoryId)');
    // Module-level Map declarations for settlement caches must not remain in STB.
    expect(stbSrc).not.toMatch(/^const legacyPersistedValueChunkValues = new Map/m);
    expect(stbSrc).not.toMatch(/^const legacyPersistedValueChunkLocks = new Map/m);
    expect(stbSrc).not.toMatch(/^const observedValueChunksByCollection = new Map/m);
    expect(stbSrc).not.toMatch(/^const persistedJobEventsValues = new Map/m);
  });
});
