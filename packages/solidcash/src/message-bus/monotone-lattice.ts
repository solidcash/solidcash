/**
 * Monotone convergence lattice (backlog item 10).
 * Unknown → resolved; placeholder → final; unallocated → allocated.
 * Resolved values may not change to a different resolved value.
 */

export type LatticeState<T> =
  | { tag: 'unknown' }
  | { tag: 'placeholder'; hint?: T }
  | { tag: 'resolved'; value: T };

export class MonotoneCell<T> {
  private state: LatticeState<T> = { tag: 'unknown' };

  get(): LatticeState<T> {
    return this.state;
  }

  /** Advance toward resolved. Throws if a resolved value would change. */
  advance(next: LatticeState<T>): void {
    const cur = this.state;
    if (cur.tag === 'resolved') {
      if (next.tag === 'resolved' && !Object.is(cur.value, next.value)) {
        throw new Error('monotone-lattice: resolved value cannot change');
      }
      return;
    }
    if (cur.tag === 'placeholder' && next.tag === 'unknown') {
      throw new Error('monotone-lattice: cannot regress placeholder → unknown');
    }
    if (next.tag === 'unknown') return;
    this.state = next;
  }

  resolve(value: T): void {
    this.advance({ tag: 'resolved', value });
  }
}

export function freezeGeometry<T extends Record<string, unknown>>(
  geometry: T,
): Readonly<T> {
  return Object.freeze({ ...geometry });
}

/**
 * constraint fixpoint / item-10: record one non-final convergence fingerprint.
 * Repeated states refuse (cycle), matching resource/chunk/semantic-claim converges.
 */
export function recordMonotonePass(
  lattice: MonotoneCell<string>,
  seen: Set<string>,
  stateKey: string,
  cycleMessage: string,
): void {
  if (seen.has(stateKey)) {
    throw new Error(cycleMessage);
  }
  seen.add(stateKey);
  lattice.advance({ tag: 'placeholder', hint: stateKey });
}

/** Resolve the lattice when a converge loop admits a stable final state. */
export function finalizeMonotonePass(
  lattice: MonotoneCell<string>,
  stateKey: string,
): void {
  lattice.resolve(stateKey);
}
