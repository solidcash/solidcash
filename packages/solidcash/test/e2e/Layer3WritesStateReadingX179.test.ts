import { describe, expect, it } from 'vitest';
import { compileFile, compileFileMulti, compileString } from 'solidc';

/**
 * X179, SECOND FINDING. WHAT `writesState` ACTUALLY ANSWERS.
 *
 * The board has been reading `writesState: true` as "this handler mutates a state variable" and counting
 * writers with it. It does not answer that. `computeWritesState` in `packages/solidc/src/artifact/Artifact.ts`
 * is a CONSERVATIVE read-only proof - its own docblock says "Any doubt -> true", and the adjacent note on
 * `journalReservedDynamicWritesOnly` states the contract outright: `writesState` is the flag that answers
 * "output state == input state". Nine legs set it true, and one of them is
 *
 *     if ((func.externalCalls?.length ?? 0) > 0) return true;
 *
 * so a handler whose whole body is one external call and no assignment publishes it TRUE.
 *
 * THE FLAG IS ONE-SIDED, AND SOUND IN ONE DIRECTION ONLY. `false` means the compiler PROVED the output state
 * equals the input state. `true` means it proved nothing. Every consumer in this tree reads it in the sound
 * direction and none reads it as "mutates" - `StatefulContract` tests `writesState === false` for the
 * derivation skip and for its single-output path, and `graph.ts` refuses a `staticcall` target that is not
 * `writesState === false`. So this is a naming and counting hazard, not a live misuse.
 *
 * THE PRECISE ANSWER IS ALREADY PUBLISHED, in `invocationAnalysis.functions[].writes` - the per-function write
 * footprint, empty for a handler that assigns nothing. This file pins the 2x2 that separates the two fields,
 * so a count of "writers" is taken from the field that answers it.
 *
 * NEITHER FIELD IS A PROOF. Both are artifact fields the spender hands the planner and nothing in the
 * transaction commits to `invocationAnalysis` (see `dynamicVariablesOf` in `graph.ts`). This says which field
 * answers which question, not that either can be trusted from an untrusted artifact.
 */

const SBE = `${process.env.SBE_ROOT ?? '/Code/solidity-by-example'}/contracts/src`;
const TX_ORIGIN = `${SBE}/hacks/phishing-with-tx-origin/TxOrigin.sol`;
const EXTERNAL = `${SBE}/hacks/hiding-malicious-code-with-external-contract/ExternalContract.sol`;

const BUS = {
  solidityImportCompat: true,
  ecrecover: 'p2pkh',
  forceStateful: true,
  hiddenBatch: true,
  messageBusController: `aa20${'11'.repeat(32)}87`,
  messageBusControllerCategory: '22'.repeat(32),
};

/** A real writer and a real getter on one contract, so the discriminating control is the same compile. */
const LOCAL = `pragma solidcash >=0.8.0;
contract X179Writes() {
  int knob;
  function bump() { knob = knob + 1; require(true); }
  function read() returns (int) { return knob; }
}`;

interface Reading {
  writesState: boolean | undefined;
  /** State variables the per-function footprint says this handler WRITES. */
  writes: readonly string[];
}

const read = (artifact: any, handler: string): Reading => ({
  writesState: artifact.abi.find((entry: any) => entry.name === handler)?.writesState,
  writes: artifact.invocationAnalysis?.functions
    ?.find((fn: any) => fn.name === handler)?.writes ?? [],
});

describe('X179: `writesState` is a read-only proof, not a mutation flag', () => {
  it('MEASURED: two published `writesState: true` handlers write NOTHING', () => {
    const attack = read(compileFile(TX_ORIGIN, BUS as never) as any, 'attack');
    const callBar = read((compileFileMulti(EXTERNAL, BUS as never) as any).Foo, 'callBar');
    console.log(`[X179W] Attack.attack ${JSON.stringify(attack)}`);
    console.log(`[X179W] Foo.callBar ${JSON.stringify(callBar)}`);
    // Both bodies are one external call and no assignment. The flag says true; the footprint says nothing.
    expect(attack.writesState).toBe(true);
    expect(attack.writes).toEqual([]);
    expect(callBar.writesState).toBe(true);
    expect(callBar.writes).toEqual([]);
  }, 300_000);

  /**
   * THE DISCRIMINATING CONTROL, and it is what makes the row above a reading rather than a coincidence: on a
   * handler that DOES assign, both fields agree, and on a getter both fields agree the other way. So the two
   * fields differ on exactly one class - the conservative legs - and the external-call leg is one of them.
   */
  it('CONTROL: a real writer and a real getter agree on both fields', () => {
    const artifact = compileString(LOCAL, BUS as never) as any;
    const bump = read(artifact, 'bump');
    const getter = read(artifact, 'read');
    console.log(`[X179W] X179Writes.bump ${JSON.stringify(bump)}`);
    console.log(`[X179W] X179Writes.read ${JSON.stringify(getter)}`);
    expect(bump.writesState).toBe(true);
    expect(bump.writes).toEqual(['state:knob']);
    expect(getter.writesState).toBe(false);
    expect(getter.writes).toEqual([]);
  }, 300_000);
});
