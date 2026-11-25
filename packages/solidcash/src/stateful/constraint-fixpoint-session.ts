/**
 * Multi-domain monotone constraint fixpoint used while deriving a stateful transaction.
 *
 * Direct calls record one pass per domain; a repeated joint state is reported through the caller's cycle
 * message so a non-converging derivation still fails closed.
 */

export interface ConstraintFixpointSession {
  getPhase(): 'open' | 'finalized';
  jointStateKey(): string;
  recordDomainPass(domain: string, stateKey: string, cycleMessage: string): void;
  finalize(): string;
  runSpeculative<T>(body: (session: ConstraintFixpointSession) => T): T;
  clear(): void;
}

export function createConstraintFixpointSession(): ConstraintFixpointSession {
  let phase: 'open' | 'finalized' = 'open';
  const domains = new Map<string, string>();
  const joint = (): string => [...domains.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([domain, key]) => `${domain}=${key}`)
    .join(';');
  const session: ConstraintFixpointSession = {
    getPhase: () => phase,
    jointStateKey: joint,
    recordDomainPass: (domain, stateKey, cycleMessage) => {
      const prior = domains.get(domain);
      if (prior !== undefined && prior !== stateKey) throw new Error(cycleMessage);
      domains.set(domain, stateKey);
    },
    finalize: () => {
      phase = 'finalized';
      return joint();
    },
    clear: () => { domains.clear(); phase = 'open'; },
    runSpeculative: (body) => {
      const snapshot = new Map(domains);
      try {
        return body(session);
      } catch (error) {
        domains.clear();
        for (const [domain, key] of snapshot) domains.set(domain, key);
        throw error;
      }
    },
  };
  return session;
}
