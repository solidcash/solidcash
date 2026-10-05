/**
 * constraint fixpoint: multi-constraint fixpoint session beyond per-domain MonotoneCell loops.
 *
 * Owns named domain lattices and a joint seen-state set so resource / value /
 * dyn / claim-style converges can share one cycle fingerprint across domains.
 */

import {
  MonotoneCell,
  finalizeMonotonePass,
  recordMonotonePass,
} from './monotone-lattice.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';

export type ConstraintFixpointPhase = 'open' | 'running' | 'finalized';

export type ConstraintDomainPass = {
  domain: string;
  stateKey: string;
};

/** Serializable restore point for speculative multi-domain attempts. */
export type ConstraintFixpointSnapshot = {
  phase: ConstraintFixpointPhase;
  passCount: number;
  domainKeys: Readonly<Record<string, string>>;
  jointSeen: readonly string[];
  /** Lattice tags per domain (unknown / placeholder hint / resolved value). */
  domainStates: Readonly<Record<string, { tag: 'unknown' } | { tag: 'placeholder'; hint?: string } | { tag: 'resolved'; value: string }>>;
};

/**
 * Multi-domain monotone fixpoint session.
 * Each domain keeps its own {@link MonotoneCell}; joint cycle detection uses the
 * sorted concatenation of domain state keys so cross-domain regressions fail closed.
 * Snapshots enable speculative multi-domain attempts beyond fingerprint-only tracking.
 */
export class ConstraintFixpointSession {
  private phase: ConstraintFixpointPhase = 'open';
  private readonly domains = new Map<string, MonotoneCell<string>>();
  private readonly domainKeys = new Map<string, string>();
  private readonly jointSeen = new Set<string>();
  private passCount = 0;
  private readonly maximumPasses: number;

  constructor(options?: { maximumPasses?: number }) {
    this.maximumPasses = options?.maximumPasses ?? Number.POSITIVE_INFINITY;
  }

  getPhase(): ConstraintFixpointPhase {
    return this.phase;
  }

  getPassCount(): number {
    return this.passCount;
  }

  getMaximumPasses(): number {
    return this.maximumPasses;
  }

  /** Ensure a named domain lattice exists (idempotent). */
  ensureDomain(domain: string): MonotoneCell<string> {
    if (this.phase === 'finalized') {
      throw new Error(`constraint-fixpoint: cannot ensureDomain after finalize (${domain})`);
    }
    let cell = this.domains.get(domain);
    if (cell === undefined) {
      cell = new MonotoneCell<string>();
      this.domains.set(domain, cell);
    }
    if (this.phase === 'open') this.phase = 'running';
    return cell;
  }

  domainNames(): readonly string[] {
    return [...this.domains.keys()].sort();
  }

  getDomain(domain: string): MonotoneCell<string> | undefined {
    return this.domains.get(domain);
  }

  /** Current joint fingerprint from recorded domain keys (sorted by domain name). */
  jointStateKey(): string {
    return this.domainNames()
      .map((domain) => `${domain}=${this.domainKeys.get(domain) ?? ''}`)
      .join('|');
  }

  /**
   * Record one domain pass. Updates that domain's lattice, then refuses if the
   * joint fingerprint across all domains has been seen before.
   */
  recordDomainPass(domain: string, stateKey: string, cycleMessage?: string): void {
    if (this.phase === 'finalized') {
      throw new Error(`constraint-fixpoint: cannot record after finalize (${domain})`);
    }
    const cell = this.ensureDomain(domain);
    const domainSeen = new Set<string>();
    // Domain-local cycle still refuses via recordMonotonePass when the same
    // domain key repeats without joint progress — feed only the latest key.
    const prior = this.domainKeys.get(domain);
    if (prior !== undefined) domainSeen.add(prior);
    recordMonotonePass(
      cell,
      domainSeen,
      stateKey,
      cycleMessage ?? `constraint-fixpoint: domain '${domain}' entered a repeated state`,
    );
    this.domainKeys.set(domain, stateKey);
    const joint = this.jointStateKey();
    if (this.jointSeen.has(joint)) {
      throw new Error(
        cycleMessage
          ?? `constraint-fixpoint: joint state repeated (${joint})`,
      );
    }
    this.jointSeen.add(joint);
    this.passCount += 1;
    this.assertPassBudget(cycleMessage);
    this.phase = 'running';
  }

  /** Record several domain passes atomically (all keys applied, then one joint check). */
  recordPasses(passes: readonly ConstraintDomainPass[], cycleMessage?: string): void {
    if (this.phase === 'finalized') {
      throw new Error('constraint-fixpoint: cannot recordPasses after finalize');
    }
    for (const pass of passes) {
      const cell = this.ensureDomain(pass.domain);
      cell.advance({ tag: 'placeholder', hint: pass.stateKey });
      this.domainKeys.set(pass.domain, pass.stateKey);
    }
    const joint = this.jointStateKey();
    if (this.jointSeen.has(joint)) {
      throw new Error(
        cycleMessage ?? `constraint-fixpoint: joint state repeated (${joint})`,
      );
    }
    this.jointSeen.add(joint);
    this.passCount += 1;
    this.assertPassBudget(cycleMessage);
    this.phase = 'running';
  }

  private assertPassBudget(cycleMessage?: string): void {
    if (this.passCount <= this.maximumPasses) return;
    throw new Error(
      cycleMessage
        ?? `constraint-fixpoint: exceeded maximumPasses=${this.maximumPasses} (passCount=${this.passCount})`,
    );
  }

  /** Capture a restore point for speculative multi-domain attempts. */
  snapshot(): ConstraintFixpointSnapshot {
    const domainStates: Record<string, ConstraintFixpointSnapshot['domainStates'][string]> = {};
    for (const domain of this.domainNames()) {
      domainStates[domain] = this.domains.get(domain)!.get();
    }
    const domainKeys: Record<string, string> = {};
    for (const [domain, key] of this.domainKeys) domainKeys[domain] = key;
    return {
      phase: this.phase,
      passCount: this.passCount,
      domainKeys,
      jointSeen: [...this.jointSeen],
      domainStates,
    };
  }

  /**
   * Restore a prior {@link snapshot}. Domains present only after the snapshot are dropped.
   * Fail-closed after finalize.
   */
  restore(snapshot: ConstraintFixpointSnapshot): void {
    if (this.phase === 'finalized' && snapshot.phase !== 'finalized') {
      throw new Error('constraint-fixpoint: cannot restore a pre-finalize snapshot after finalize');
    }
    this.domains.clear();
    this.domainKeys.clear();
    this.jointSeen.clear();
    for (const [domain, state] of Object.entries(snapshot.domainStates)) {
      const cell = new MonotoneCell<string>();
      if (state.tag === 'placeholder') {
        cell.advance({ tag: 'placeholder', hint: state.hint });
      } else if (state.tag === 'resolved') {
        cell.resolve(state.value);
      }
      this.domains.set(domain, cell);
    }
    for (const [domain, key] of Object.entries(snapshot.domainKeys)) {
      this.domainKeys.set(domain, key);
    }
    for (const joint of snapshot.jointSeen) this.jointSeen.add(joint);
    this.passCount = snapshot.passCount;
    this.phase = snapshot.phase;
  }

  /**
   * Run a speculative body; restore the pre-call snapshot if the body throws.
   * Successful bodies keep their recorded passes.
   */
  runSpeculative<T>(body: (session: ConstraintFixpointSession) => T): T {
    if (this.phase === 'finalized') {
      throw new Error('constraint-fixpoint: cannot runSpeculative after finalize');
    }
    const prior = this.snapshot();
    try {
      return body(this);
    } catch (error) {
      this.restore(prior);
      throw error;
    }
  }

  /** Resolve every domain to its last recorded key and freeze the session. */
  finalize(cycleMessage?: string): string {
    if (this.phase === 'finalized') return this.jointStateKey();
    const joint = this.jointStateKey();
    if (this.domains.size === 0) {
      this.phase = 'finalized';
      return joint;
    }
    if (this.jointSeen.has(joint) === false && this.passCount > 0) {
      // Final joint key should already be recorded by the last pass; if not, admit it once.
      this.jointSeen.add(joint);
    }
    for (const domain of this.domainNames()) {
      const key = this.domainKeys.get(domain);
      if (key === undefined) {
        throw new Error(
          cycleMessage
            ?? `constraint-fixpoint: finalize missing key for domain '${domain}'`,
        );
      }
      finalizeMonotonePass(this.ensureDomain(domain), key);
    }
    this.phase = 'finalized';
    return joint;
  }

  clear(): void {
    this.domains.clear();
    this.domainKeys.clear();
    this.jointSeen.clear();
    this.passCount = 0;
    this.phase = 'open';
  }
}

export function createConstraintFixpointSession(
  options?: { maximumPasses?: number },
): ConstraintFixpointSession {
  return new ConstraintFixpointSession(options);
}

// Every provisional builder of a composition shares its build's tracker. Explicit ownership
// survives await boundaries without holding a process-global session across concurrent builds.
const builderSessions = new WeakMap<TransactionBuilder, ConstraintFixpointSession>();

export function bindBuilderConstraintFixpoint(
  builder: TransactionBuilder,
  session: ConstraintFixpointSession,
): void {
  const previous = builderSessions.get(builder);
  if (previous !== undefined && previous !== session) {
    throw new Error('constraint-fixpoint: cannot change a builder\'s composition owner');
  }
  builderSessions.set(builder, session);
}

export function builderConstraintFixpoint(builder: TransactionBuilder): ConstraintFixpointSession | undefined {
  return builderSessions.get(builder);
}
