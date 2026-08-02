import { compileString } from '../direct-compile.js';
import { describe, expect, it, beforeAll } from 'vitest';
import type { Artifact, AbiFunction } from '@solidcash/utils';
import { StatefulContract } from '../../src/index.js';

/**
 * X176 - WHAT `writesState` ANSWERS, MEASURED AGAINST WHAT COMPOSERS ASK IT.
 *
 * THE CLAIM UNDER TEST. `writesState: true` is read by composers as "this handler mutates state". It does not
 * mean that. `computeWritesState` (solidc `artifact/Artifact.ts`) returns `false` ONLY when the body has no
 * stateful statement AND the function has no external call, child deploy, library delegate, dynamic write,
 * low-level call, split/merge or covenant-bypass modifier. Every other function is `true`, so `true` is "not
 * provably read-only" - in SDK terms "needs the state machinery" - and that is a strictly weaker claim.
 *
 * THE EVIDENCE THAT MADE IT WORTH SAYING SO, from the L2-F2 recovered population:
 *   `Foo.callBar`   publishes true, body is `bar.log();`  -  one external call, NOT ONE ASSIGNMENT
 *   `Attack.attack` publishes true, body is one external call, no assignment
 *   4 more handlers publish the flag ABSENT and are conservatively read as writing; all four belong to
 *   contracts with `dataNftCount === 0`, which have no state variable for any handler to change.
 * So of seven handlers counted as explicit writers, at least two write nothing, and of eleven counted as
 * state-changing, at least six do not change a state variable.
 *
 * THE DECISION, and it is a decision rather than a discovery. NOT renamed and NOT re-derived: the flag's
 * conservative direction is correct for its ONE consumer in `src/` - the derivation skip in `_prepareCall`,
 * which acts on `=== false` alone and fails closed on misclassification - and re-deriving it toward "mutates"
 * would make that consumer fail OPEN, skipping derivation for a handler whose only cause is an external call
 * and leaving its call group underived. The distinction is PUBLISHED ALONGSIDE instead, by
 * `StatefulContract.readWritesState`.
 *
 * WHAT THIS FILE DOES NOT ESTABLISH. `readWritesState` reports the evidence the ABI publishes; it cannot see a
 * body. A plain `this.x = y` publishes NOTHING an artifact itemizes as a write, so it reads `unattributed` -
 * which is the same reading a bus-mode journal reservation gets. Row 5 is that measurement, stated as a limit
 * rather than hidden. Closing it needs a compiler field; the hunk is handed over, not applied here.
 */

const SRC = `
pragma solidcash >=0.8.0;

interface ICounter {
    function bump() external;
}

contract Effects(pubkey admin) {
    bytes32 a;
    bytes32 b;
    mapping(bytes32 => bigint) balances;

    event Logged(bigint value);

    // Provably read-only: no stateful statement, nothing else that sets the flag.
    function peek() returns (bytes32) {
        return this.a;
    }

    // THE SHAPE THE FLAG MISREPORTS. One external call, no assignment.
    function callOut(bytes20 target) {
        ICounter(target).bump();
    }

    // A real state-variable write, itemized by NOTHING in the ABI.
    function touch() {
        this.a = this.b;
    }

    // A mapping write, which the ABI DOES itemize.
    function credit(bytes32 key, bigint value) {
        this.balances[key] = value;
    }

    // An emit: an output-shape effect, not a state variable.
    function announce(bigint value) {
        emit Logged(value);
    }

    function fork(bigint n, sig s) split(n) {
        require(n >= 1);
        require(checkSig(s, admin));
    }
}
`;

/** A stateless contract: no state variable, so `dataNftCount` is 0 and no handler can change one. */
const STATELESS = `
pragma solidcash >=0.8.0;

contract Stateless(pubkey admin) {
    function ping(sig s) {
        require(checkSig(s, admin));
    }
}
`;

let artifact: Artifact;
let statelessArtifact: Artifact;

const abiOf = (name: string): AbiFunction =>
  artifact.abi.find((entry) => entry.name === name)!;

describe('X176 - `writesState` means "needs the state machinery", not "mutates"', () => {
  beforeAll(() => {
    artifact = compileString(SRC);
    statelessArtifact = compileString(STATELESS, { forceStateful: true } as never);
  });

  it('1. MEASURED: a body of one external call and no assignment publishes writesState TRUE', () => {
    // The whole finding in one row. `callOut` assigns nothing and publishes `true`, so a composer reading the
    // flag as "mutates" counts a handler that cannot have changed a state variable.
    const callOut = abiOf('callOut');
    expect(callOut.writesState, '`callOut` no longer publishes the flag this row is about').toBe(true);
    expect((callOut.externalCalls?.length ?? 0), 'the external call is what sets it').toBeGreaterThan(0);

    const reading = StatefulContract.readWritesState(callOut);
    expect(reading.needsStateMachinery).toBe(true);
    expect(reading.provablyReadOnly).toBe(false);
    expect(reading.ownStateEvidence, 'nothing published says it changes its own state').toEqual([]);
    expect(reading.otherEffectEvidence).toContain('external-call');
    expect(reading.unattributed, 'the cause IS published, so this is not the residue case').toBe(false);
  }, 300_000);

  it('1b. GUARD: the same contract\'s read-only getter publishes FALSE and reads as proved', () => {
    // Differs from row 1 in the body alone - same contract, same state, same compile. Without it row 1 could be
    // passing because this compiler publishes `true` for everything.
    const peek = abiOf('peek');
    expect(peek.writesState).toBe(false);
    const reading = StatefulContract.readWritesState(peek);
    expect(reading.provablyReadOnly).toBe(true);
    expect(reading.needsStateMachinery).toBe(false);
    expect(reading.unattributed).toBe(false);
    expect([...reading.ownStateEvidence, ...reading.otherEffectEvidence]).toEqual([]);
  }, 300_000);

  it('2. the reading SEPARATES own-state evidence from every other effect', () => {
    // Four handlers, one flag value between them. A composer that stops at `writesState` sees `true` four times
    // and cannot tell a mapping write from an emit from an external call from a master-set split.
    //
    // MEASURED ASIDE, recorded not acted on: `credit` is a straight-line `m[k] = v` and publishes BOTH
    // `entryAccesses[write]` and `entryLoopWrites: ["balances"]`. Both are own-state evidence, so the reading
    // is unaffected; the containment check below is what keeps this row honest about it.
    const rows: Array<[string, string[], string[]]> = [
      ['credit', ['entry-write'], []],
      ['announce', [], ['emit']],
      ['callOut', [], ['external-call']],
      ['fork', [], ['split-merge']],
    ];
    for (const [name, own, other] of rows) {
      const abi = abiOf(name);
      expect(abi.writesState, `${name} is not published as a writer`).toBe(true);
      const reading = StatefulContract.readWritesState(abi);
      for (const cause of own) {
        expect(reading.ownStateEvidence, `${name} own-state evidence`).toContain(cause);
      }
      for (const cause of other) {
        expect(reading.otherEffectEvidence, `${name} other-effect evidence`).toContain(cause);
      }
      // THE DISCRIMINATING HALF: a handler with no own-state evidence must report NONE, or the split says
      // nothing. Three of the four are exactly that case.
      if (own.length === 0) {
        expect(reading.ownStateEvidence, `${name} claims own-state evidence it has none of`).toEqual([]);
      }
    }
  }, 300_000);

  it('3. a contract with NO data NFT settles the question structurally', () => {
    // What closes the four absent-flag handlers. `dataNftCount === 0` means there is no persisted state
    // variable, so "does this handler mutate state" has no referent - and that is visible from the artifact
    // without running anything.
    expect(statelessArtifact.stateLayout.dataNftCount).toBe(0);
    const ping = statelessArtifact.abi.find((entry) => entry.name === 'ping')!;
    const reading = StatefulContract.readWritesState(ping, statelessArtifact);
    expect(reading.contractHasNoState).toBe(true);
    expect(reading.ownStateEvidence).toEqual([]);
  }, 300_000);

  it('3b. GUARD: the stateful contract does NOT read as stateless', () => {
    // Differs from row 3 in the artifact alone. Without it row 3 would pass against a reader that returns
    // `contractHasNoState: true` unconditionally.
    expect(artifact.stateLayout.dataNftCount).toBeGreaterThan(0);
    expect(StatefulContract.readWritesState(abiOf('credit'), artifact).contractHasNoState).toBe(false);
    // And with no artifact supplied the answer is false rather than optimistic: absence of evidence is not
    // evidence that the contract has no state.
    expect(StatefulContract.readWritesState(abiOf('credit')).contractHasNoState).toBe(false);
  }, 300_000);

  it('4. the ABSENT case is not read as a proof of anything', () => {
    // A stateless compile publishes no `writesState` at all. Absent must read as "needs the machinery" (the
    // conservative direction) and never as `provablyReadOnly`.
    const stateless = compileString(STATELESS);
    const ping = stateless.abi.find((entry) => entry.name === 'ping')!;
    expect(ping.writesState, 'this row is about the ABSENT case').toBeUndefined();
    const reading = StatefulContract.readWritesState(ping, stateless);
    expect(reading.published).toBeUndefined();
    expect(reading.needsStateMachinery, 'absent must read as needing the machinery').toBe(true);
    expect(reading.provablyReadOnly).toBe(false);
  }, 300_000);

  it('5. THE LIMIT, stated: a plain state-variable write is UNATTRIBUTED', () => {
    // The residue, and the reason the compiler hunk is handed over rather than declared unnecessary. `touch`
    // assigns a state variable and the ABI itemizes nothing about it, so the reading cannot distinguish it
    // from a handler whose flag was set by something the ABI also does not publish. What it CAN say is that
    // the answer is not published - which is strictly more than `writesState: true` says on its own.
    const touch = abiOf('touch');
    expect(touch.writesState).toBe(true);
    const reading = StatefulContract.readWritesState(touch, artifact);
    expect(reading.unattributed, 'the ABI itemized a cause for a plain assignment').toBe(true);
    expect(reading.ownStateEvidence).toEqual([]);
    expect(reading.otherEffectEvidence).toEqual([]);
    // And it is NOT reported as "does not mutate": unattributed is the unknown leg, not a negative.
    expect(reading.provablyReadOnly).toBe(false);
  }, 300_000);

  it('5b. GUARD: the mapping writer in the same contract is NOT unattributed', () => {
    // Differs from row 5 in which kind of write the body performs. Without it row 5 would pass against a
    // reader that reports `unattributed` for everything.
    expect(StatefulContract.readWritesState(abiOf('credit'), artifact).unattributed).toBe(false);
  }, 300_000);
});
