import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type Disposition = 'policy-valid' | 'attack-implies-dust' | 'pending-c3-capacity';

interface X152Target {
  readonly file: string;
  readonly title: string;
  readonly disposition: Disposition;
}

interface DeliberateBoundary {
  readonly file: string;
  readonly title: string;
  readonly rule: string;
}

/**
 * X152's validated q4 instrument observed 1,782 broadcasts. Four byte-invalid rows were deliberate boundary
 * tests; the eight rows below were hostiles intended to prove a covenant. Keep this manifest executable so a
 * renamed, deleted, or silently untracked target makes the census red rather than changing its denominator.
 */
const TARGETS: readonly X152Target[] = Object.freeze([
  {
    file: 'Layer3Balanced.test.ts',
    title: 'HOSTILE: an extra output (breaking the balanced closure) is rejected',
    disposition: 'policy-valid',
  },
  {
    file: 'Layer3Exhaustiveness.test.ts',
    title: 'HOSTILE: OMITTING the committed event record is rejected',
    disposition: 'policy-valid',
  },
  {
    file: 'Layer3NPartyMutual.test.ts',
    title: 'R1 CLOSED: siphoning satoshis from the controller output is rejected',
    disposition: 'policy-valid',
  },
  {
    file: 'Layer3ConditionalEmitSlot.test.ts',
    title: 'SEC-8 hostile: rejects a container drain on a NOT-taken conditional transfer',
    disposition: 'attack-implies-dust',
  },
  {
    file: 'Layer3EmissionEffectEscape.test.ts',
    title: 'rejects a sibling-only batch that drains the co-spent container',
    disposition: 'attack-implies-dust',
  },
  {
    file: 'Layer3EmissionEffectEscape.test.ts',
    title: 'rejects an effect-carrying sibling batch that drains the co-spent container',
    disposition: 'attack-implies-dust',
  },
  {
    file: 'Layer3BoundedMaximumGraphC3.test.ts',
    title: 'HOSTILE: an injected ninth participant is refused - by the SDK gate, then by the controller',
    disposition: 'pending-c3-capacity',
  },
  {
    file: 'Layer3BoundedMaximumGraphC3.test.ts',
    title: 'HOSTILE: the same injection with the ninth block burned is refused at input 106',
    disposition: 'pending-c3-capacity',
  },
]);

/** The four byte-invalid broadcasts excluded from X152 because exercising the byte boundary is their subject. */
const DELIBERATE_BOUNDARIES: readonly DeliberateBoundary[] = Object.freeze([
  {
    file: 'L4FinalizedBytesGate.test.ts',
    title: 'FAIL_CLOSED: a 202-byte change script is refused, and 201 through the same path is not',
    rule: 'relay-locking-bytes',
  },
  {
    file: 'L4FinalizedBytesGate.test.ts',
    title: 'FAIL_CLOSED: a dust change output is refused on the send path that the mock network ACCEPTS',
    rule: 'output-dust',
  },
  {
    file: 'Layer3SemanticProfile.test.ts',
    title: 'executes an oversized input under BCH-2026 semantics without claiming ordinary-limit fit',
    rule: 'consensus-unlocking-bytes',
  },
  {
    file: 'X121StrictPreflightDecision.test.ts',
    title: '5. maximumInputBytes reaches the decider too: 12,003 bytes clears a published 1,000,000',
    rule: 'consensus-unlocking-bytes',
  },
]);

const here = dirname(fileURLToPath(import.meta.url));

describe('X152 hostile byte-policy census', () => {
  it('reproduces the validated eight-target population and every named test still exists', () => {
    expect(TARGETS, 'an empty X152 census is never a result').not.toHaveLength(0);
    expect(TARGETS).toHaveLength(8);
    expect(new Set(TARGETS.map(({ file, title }) => `${file}\0${title}`)).size).toBe(TARGETS.length);
    expect(TARGETS.filter(({ disposition }) => disposition === 'policy-valid')).toHaveLength(3);
    expect(TARGETS.filter(({ disposition }) => disposition === 'attack-implies-dust')).toHaveLength(3);
    expect(TARGETS.filter(({ disposition }) => disposition === 'pending-c3-capacity')).toHaveLength(2);

    expect(DELIBERATE_BOUNDARIES).toHaveLength(4);
    expect(new Set(DELIBERATE_BOUNDARIES.map(({ file, title }) => `${file}\0${title}`)).size)
      .toBe(DELIBERATE_BOUNDARIES.length);

    for (const target of [...TARGETS, ...DELIBERATE_BOUNDARIES]) {
      const source = readFileSync(resolve(here, target.file), 'utf8');
      expect(source, `${target.file}: missing X152 target '${target.title}'`).toContain(target.title);
    }
  });
});
