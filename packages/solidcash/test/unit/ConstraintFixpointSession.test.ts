/**
 * constraint fixpoint: multi-constraint fixpoint session beyond per-domain MonotoneCell loops.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  createConstraintFixpointSession,
} from '../../src/message-bus/constraint-fixpoint-session.js';
import {
  createCompositionSettlementSession,
  finalizeActiveConstraintFixpoint,
  recordActiveConstraintPass,
  runActiveConstraintSpeculative,
  runWithCompositionSettlementSession,
  settlement,
  selectActiveConstraintCandidate,
  tryRecordActiveConstraintPass,
} from '../../src/stateful/value-chunk-persist.js';

const messageBusDir = join(dirname(fileURLToPath(import.meta.url)), '../../src/message-bus');

describe('constraint fixpoint ConstraintFixpointSession', () => {
  it('records per-domain passes and finalizes joint state', () => {
    const session = createConstraintFixpointSession();
    expect(session.getPhase()).toBe('open');

    session.recordDomainPass('resource', 'r0');
    session.recordDomainPass('value', 'v0');
    expect(session.getPhase()).toBe('running');
    expect(session.jointStateKey()).toBe('resource=r0|value=v0');
    expect(session.getPassCount()).toBe(2);

    session.recordDomainPass('resource', 'r1');
    expect(session.jointStateKey()).toBe('resource=r1|value=v0');

    const finalKey = session.finalize();
    expect(finalKey).toBe('resource=r1|value=v0');
    expect(session.getPhase()).toBe('finalized');
    expect(session.getDomain('resource')?.get()).toEqual({ tag: 'resolved', value: 'r1' });
    expect(session.getDomain('value')?.get()).toEqual({ tag: 'resolved', value: 'v0' });
    expect(() => session.recordDomainPass('resource', 'r2')).toThrow(/after finalize/);
  });

  it('refuses repeated joint fingerprints across domains', () => {
    const session = createConstraintFixpointSession();
    session.recordPasses([
      { domain: 'resource', stateKey: 'a' },
      { domain: 'claim', stateKey: 'c0' },
    ]);
    session.recordPasses([
      { domain: 'resource', stateKey: 'b' },
      { domain: 'claim', stateKey: 'c1' },
    ]);
    expect(() => session.recordPasses([
      { domain: 'resource', stateKey: 'a' },
      { domain: 'claim', stateKey: 'c0' },
    ])).toThrow(/joint state repeated/);
  });

  it('refuses immediate domain-local repeats', () => {
    const session = createConstraintFixpointSession();
    session.recordDomainPass('dyn', 'd0');
    expect(() => session.recordDomainPass('dyn', 'd0')).toThrow(/repeated state/);
  });

  it('clear() resets phase and domains', () => {
    const session = createConstraintFixpointSession();
    session.recordDomainPass('resource', 'r0');
    session.finalize();
    session.clear();
    expect(session.getPhase()).toBe('open');
    expect(session.domainNames()).toEqual([]);
    expect(session.getPassCount()).toBe(0);
  });

  it('CompositionSettlementSession owns an isolated constraintFixpoint', () => {
    const a = createCompositionSettlementSession();
    const b = createCompositionSettlementSession();
    a.constraintFixpoint.recordDomainPass('resource', 'a0');
    expect(a.constraintFixpoint.getPassCount()).toBe(1);
    expect(b.constraintFixpoint.getPassCount()).toBe(0);
    a.clear();
    expect(a.constraintFixpoint.getPhase()).toBe('open');
    expect(a.constraintFixpoint.getPassCount()).toBe(0);
  });

  it('recordActiveConstraintPass / finalizeActiveConstraintFixpoint drive the live settlement session', () => {
    settlement().clear();
    recordActiveConstraintPass('resource', 'r0', 'cycle');
    recordActiveConstraintPass('value-chunk', 'v0', 'cycle');
    expect(settlement().constraintFixpoint.jointStateKey()).toBe('resource=r0|value-chunk=v0');
    expect(settlement().constraintFixpoint.domainNames()).toEqual(['resource', 'value-chunk']);
    const finalKey = finalizeActiveConstraintFixpoint();
    expect(finalKey).toBe('resource=r0|value-chunk=v0');
    expect(settlement().constraintFixpoint.getPhase()).toBe('finalized');
    expect(finalizeActiveConstraintFixpoint()).toBe(finalKey);
    settlement().clear();
    expect(settlement().constraintFixpoint.getPhase()).toBe('open');
  });

  it('snapshot/restore and runSpeculative support richer joint attempts', () => {
    const session = createConstraintFixpointSession({ maximumPasses: 3 });
    session.recordDomainPass('resource', 'r0');
    const snap = session.snapshot();
    session.recordDomainPass('value-chunk', 'v0');
    expect(session.jointStateKey()).toBe('resource=r0|value-chunk=v0');
    session.restore(snap);
    expect(session.jointStateKey()).toBe('resource=r0');
    expect(session.getPassCount()).toBe(1);
    expect(session.domainNames()).toEqual(['resource']);

    expect(() => session.runSpeculative((s) => {
      s.recordDomainPass('resource', 'r1');
      s.recordDomainPass('claim', 'c0');
      throw new Error('boom');
    })).toThrow(/boom/);
    expect(session.jointStateKey()).toBe('resource=r0');
    expect(session.getPassCount()).toBe(1);

    session.runSpeculative((s) => {
      s.recordDomainPass('resource', 'r1');
      s.recordDomainPass('claim', 'c0');
    });
    expect(session.jointStateKey()).toBe('claim=c0|resource=r1');
    expect(() => session.recordDomainPass('dyn', 'd0')).toThrow(/maximumPasses/);
  });

  it('admit-time converge modules call recordActiveConstraintPass', () => {
    for (const file of [
      'preflight.ts',
      'computed-value-chunks.ts',
      'computed-dynamic-chunks.ts',
      'compose-semantic-claim-loop.ts',
      'compose-assemble.ts',
      'compose-admit.ts',
      'compose-assembly-runtime.ts',
      'compose-settlement-context.ts',
    ]) {
      const src = readFileSync(join(messageBusDir, file), 'utf8');
      if (file === 'compose-admit.ts') {
        expect(src).toContain('finalizeActiveConstraintFixpoint');
        expect(src).toContain('runActiveConstraintSpeculative');
        expect(src).toContain('planEffectsUnderLifecycle');
        expect(src).toContain('assertComposeSlotsCoverEffectPlans');
        expect(src).toContain('pruneComposeSlotInventoryByEffectPlans');
      } else if (file === 'compose-assembly-runtime.ts' || file === 'compose-settlement-context.ts') {
        expect(src).toContain('slotInventory');
      } else if (
        file === 'preflight.ts'
        || file === 'computed-value-chunks.ts'
        || file === 'computed-dynamic-chunks.ts'
      ) {
        // constraint fixpoint: converge loops use selectActiveConstraintCandidate (multi-candidate API).
        expect(src).toContain('selectActiveConstraintCandidate');
        if (file === 'preflight.ts') expect(src).toContain('resource-otc-conflict');
      } else {
        expect(src).toContain('recordActiveConstraintPass');
      }
    }
  });

  it('constraint fixpoint: runActiveConstraintSpeculative restores joint state on throw (admit-path)', () => {
    const session = createCompositionSettlementSession();
    runWithCompositionSettlementSession(session, () => {
      recordActiveConstraintPass('resource', 'r0', 'cycle');
      expect(settlement().constraintFixpoint.jointStateKey()).toBe('resource=r0');
      expect(() => runActiveConstraintSpeculative((fixpoint) => {
        fixpoint.recordDomainPass('resource', 'r1');
        fixpoint.recordDomainPass('value-chunk', 'v0');
        throw new Error('speculative-admit-fail');
      })).toThrow(/speculative-admit-fail/);
      expect(settlement().constraintFixpoint.jointStateKey()).toBe('resource=r0');
      expect(settlement().constraintFixpoint.getPassCount()).toBe(1);

      const kept = runActiveConstraintSpeculative((fixpoint) => {
        fixpoint.recordDomainPass('resource', 'r1');
        return fixpoint.jointStateKey();
      });
      expect(kept).toBe('resource=r1');
      expect(finalizeActiveConstraintFixpoint()).toBe('resource=r1');
    });
  });

  it('constraint fixpoint: tryRecordActiveConstraintPass soft-exits on joint cycle (converge-loop)', () => {
    const session = createCompositionSettlementSession();
    runWithCompositionSettlementSession(session, () => {
      expect(tryRecordActiveConstraintPass('resource', 'r0', 'cycle')).toBe(true);
      expect(tryRecordActiveConstraintPass('value-chunk', 'v0', 'cycle')).toBe(true);
      // Repeating the exact joint fingerprint restores and returns false.
      expect(tryRecordActiveConstraintPass('resource', 'r0', 'cycle')).toBe(false);
      expect(settlement().constraintFixpoint.jointStateKey()).toBe('resource=r0|value-chunk=v0');
      expect(settlement().constraintFixpoint.getPassCount()).toBe(2);
    });
  });

  it('constraint fixpoint: selectActiveConstraintCandidate picks first non-cycling proposal key', () => {
    const session = createCompositionSettlementSession();
    runWithCompositionSettlementSession(session, () => {
      expect(tryRecordActiveConstraintPass('resource-proposals', '0:aa|1:bb', 'cycle')).toBe(true);
      const picked = selectActiveConstraintCandidate(
        'resource-proposals',
        ['0:aa|1:bb', '0:aa', '1:cc'],
        'cycle',
      );
      expect(picked).toEqual({ stateKey: '0:aa', index: 1 });
      expect(settlement().constraintFixpoint.jointStateKey()).toContain('resource-proposals=0:aa');
      expect(selectActiveConstraintCandidate(
        'resource-proposals',
        ['0:aa|1:bb', '0:aa'],
        'cycle',
      )).toBeUndefined();
    });
  });
});
