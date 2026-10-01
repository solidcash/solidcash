import { describe, expect, it } from 'vitest';
import { INDEX_NONE, decodeTranscript, decodeWitnessBlock, encodeArgumentList, splitFirstPush } from '@solidcash/utils';
import {
  assembleComposition, declaredValidators, UnresolvedReferenceError, type CompositionPlan, type PlannedMaster,
} from '../../../src/per-call/composer/assemble.js';
import { assertValidatorCoverage, ValidatorCoverageError } from '../../../src/per-call/composer/need-test.js';
import { FrameKind } from '@solidcash/utils';

/**
 * Assembling a composition, checked by reading the result back with the shipped codec.
 *
 * The assembly's whole job is turning identities into absolute input indices, so the test decodes the assembled
 * unlocking bytecodes and asserts the references that landed in them. An index off by one is exactly the defect this
 * is meant to prevent, and only decoding the bytes shows it.
 */

const CATEGORY = new Uint8Array(32).fill(0x5a);
const USER_ID = 'user';
const USER_INDEX = 0;
const SENDER = new Uint8Array([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x22), 0x88, 0xac]);
const SELF_A = new Uint8Array([0xaa, 0x20, ...new Uint8Array(32).fill(0x33), 0x87]);
const SELF_B = new Uint8Array([0xaa, 0x20, ...new Uint8Array(32).fill(0x44), 0x87]);
const SELECTOR = new Uint8Array([0x11, 0x22, 0x33, 0x44]);
const ARG = new Uint8Array([0x09]);
const empty = new Uint8Array(0);

const callerMaster = (calls: PlannedMaster['calls']): PlannedMaster => ({
  master: 'Ledger#0',
  contract: 'Ledger',
  facts: {
    contract: 'Ledger',
    functionName: 'deposit',
    kind: FrameKind.ROOT,
    callerIsUser: true,
    originEqualsCaller: true,
    makesExternalCall: calls.length > 0,
    mastersOfContract: 1,
  },
  frame: { kind: FrameKind.ROOT, sender: SENDER, self: SELF_A, value: 0n },
  enteredBy: USER_ID,
  origin: USER_ID,
  calls,
  retval: empty,
  segments: Array.from({ length: calls.length + 1 }, () => []),
  events: [],
  sends: [],
  argumentPushes: [],
  redeemScript: new Uint8Array([0x51, 0x52]),
});

/**
 * A callee, carrying the call data its caller recorded: a call's arguments live in the callee's unlocking bytecode,
 * so the callee's pushes are the caller's, not the callee's own.
 */
const calleeMaster = (
  argumentPushes: readonly Uint8Array[] = [],
  overrides: Partial<PlannedMaster> = {},
): PlannedMaster => ({
  master: 'Vault#0',
  contract: 'Vault',
  facts: {
    contract: 'Vault',
    functionName: 'credit',
    kind: FrameKind.CALL,
    callerIsUser: false,
    originEqualsCaller: false,
    makesExternalCall: false,
    mastersOfContract: 1,
  },
  frame: { kind: FrameKind.CALL, sender: SELF_A, self: SELF_B, value: 0n },
  enteredBy: 'Ledger#0',
  origin: USER_ID,
  calls: [],
  retval: empty,
  segments: [[]],
  events: [],
  sends: [],
  argumentPushes: [...argumentPushes],
  redeemScript: new Uint8Array([0x53, 0x54]),
  ...overrides,
});

const callToVault = (): PlannedMaster['calls'][number] => ({
  kind: FrameKind.CALL,
  callee: 'Vault#0',
  target: SELF_B,
  value: 0n,
  argumentPushes: [SELECTOR, ARG],
  result: new Uint8Array([0x14]),
});

/** A plan whose first block holds the caller and the validator, and whose second holds the callee. */
const planWithValidator = (): CompositionPlan => ({
  blocks: [
    { contract: 'Ledger', masters: ['Ledger#0'], validator: { id: 'validator', settles: [] }, state: [] },
    { contract: 'Vault', masters: ['Vault#0'], state: [] },
  ],
  userInputs: [{ id: USER_ID, index: USER_INDEX }],
  masters: [callerMaster([callToVault()]), calleeMaster([SELECTOR, ARG])],
  validator: {
    id: 'validator',
    // B is covered although it is not settled: it has one master that self-settles, but the call into it still
    // needs its edge bound.
    covers: ['Vault'],
    redeemScript: new Uint8Array([...CATEGORY, 0x01, 0x51, 0x52]),
    settles: [],
  },
});

/** Reads an assembled input's witness block back through the shipped decoder. */
function blockOf(input: { unlockingBytecode: Uint8Array }): ReturnType<typeof decodeWitnessBlock> {
  return decodeWitnessBlock(splitFirstPush(input.unlockingBytecode).payload);
}

describe('assembling a composition', () => {
  it('places every participant at the layout index and returns the inputs in that order', () => {
    const assembly = assembleComposition(planWithValidator());
    expect(assembly.inputs.map((input) => `${input.id}@${input.index}`)).toStrictEqual(['Ledger#0@0', 'validator@1', 'Vault#0@2']);
  });

  it('resolves each master\'s caller, origin and validator references to absolute indices', () => {
    const assembly = assembleComposition(planWithValidator());
    const [a0, , b0] = assembly.inputs;
    const caller = blockOf(a0!);
    // The root's caller and origin are the user's signed input, and it is covered by the validator at index 1.
    expect(caller.callerRef).toBe(USER_INDEX);
    expect(caller.originRef).toBe(USER_INDEX);
    expect(caller.validatorRef).toBe(1);

    const callee = blockOf(b0!);
    // The callee was entered by the caller's master and keeps the same origin.
    expect(callee.callerRef).toBe(0);
    expect(callee.originRef).toBe(USER_INDEX);
    expect(callee.validatorRef).toBe(1);
  });

  it('resolves a call to the callee\'s absolute index and hashes its arguments canonically', () => {
    const assembly = assembleComposition(planWithValidator());
    expect(assembly.calls).toHaveLength(1);
    expect(assembly.calls[0]!.calleeRef).toBe(2);
    expect(assembly.calls[0]!.from).toBe('Ledger#0');

    // The hash in the block is the one the assembly reported, over the selector and the pushed argument.
    const caller = blockOf(assembly.inputs[0]!);
    expect([...caller.calls[0]!.argsHash]).toStrictEqual([...assembly.calls[0]!.argsHash]);
    expect(caller.calls[0]!.calleeRef).toBe(2);
    expect(encodeArgumentList([ARG]).length).toBeGreaterThan(0);
  });

  it('builds the transcript from the layout: the roots, every master, and what the validator settles', () => {
    const plan = planWithValidator();
    const assembly = assembleComposition({
      ...plan,
      blocks: [
        { contract: 'Ledger', masters: ['Ledger#0', 'Ledger#1'], validator: { id: 'validator', settles: ['Ledger'] }, state: ['DA'] },
        { contract: 'Vault', masters: ['Vault#0'], state: [] },
      ],
      masters: [
        callerMaster([callToVault(), { ...callToVault(), callee: 'Ledger#1', target: SELF_A }]),
        calleeMaster([SELECTOR, ARG]),
        calleeMaster([SELECTOR, ARG], { master: 'Ledger#1', contract: 'Ledger' }),
      ],
      validator: {
        id: 'validator',
        covers: ['Vault'],
        redeemScript: Uint8Array.from(declaredValidators(plan)[0]!.redeemScript),
        settles: [{ category: CATEGORY, stateInputs: ['DA'] }],
      },
    });
    expect(assembly.transcripts).toHaveLength(1);
    expect(assembly.transcripts[0]!.validator).toBe('validator');
    const transcript = decodeTranscript(
      splitFirstPush(assembly.inputs.find((input) => input.id === 'validator')!.unlockingBytecode).payload,
    );
    // The layout puts the caller's masters and its validator first, then its state, then the callee's block:
    // Ledger#0@0, Ledger#1@1, validator@2, DA@3, Vault#0@4. Ledger#0 is the only root and every master is covered.
    expect(transcript.roots).toStrictEqual([0]);
    expect(transcript.masters).toStrictEqual([0, 1, 4]);
    expect(transcript.settles).toHaveLength(1);
    expect(transcript.settles[0]!.stateInputs).toStrictEqual([3]);
    expect(transcript.settles[0]!.category.length).toBe(32);
  });

  it('leaves the validator reference absent for a standalone master', () => {
    const plan = planWithValidator();
    const assembly = assembleComposition({
      blocks: [{ contract: 'Ledger', masters: ['Ledger#0'], state: [] }],
      userInputs: plan.userInputs,
      masters: [callerMaster([])],
    });
    expect(blockOf(assembly.inputs[0]!).validatorRef).toBe(INDEX_NONE);
    expect(assembly.transcripts).toStrictEqual([]);
  });

  it('refuses a plan whose entry needs a validator and has none', () => {
    const plan = planWithValidator();
    // A calls B, so A needs a validator; without one the composition cannot be checked.
    expect(() => assembleComposition({
      ...plan,
      blocks: [{ contract: 'Ledger', masters: ['Ledger#0'], state: [] }, { contract: 'Vault', masters: ['Vault#0'], state: [] }],
      validator: undefined,
    })).toThrow(ValidatorCoverageError);
  });

  it('refuses a reference that has no place in the composition', () => {
    const plan = planWithValidator();
    expect(() => assembleComposition({
      ...plan,
      masters: [{ ...callerMaster([callToVault()]), enteredBy: 'nobody' }, calleeMaster([SELECTOR, ARG])],
    })).toThrow(UnresolvedReferenceError);
  });

  it('refuses a master that calls itself', () => {
    const plan = planWithValidator();
    expect(() => assembleComposition({
      ...plan,
      masters: [{ ...callerMaster([{ ...callToVault(), callee: 'Ledger#0' }]) }],
      validator: undefined,
    })).toThrow(/calls itself/);
  });

  it('refuses a user input that collides with a participant', () => {
    const plan = planWithValidator();
    expect(() => assembleComposition({
      ...plan,
      userInputs: [{ id: 'Ledger#0', index: 9 }],
    })).toThrow(/both a participant and a user input/);
  });

  it('checks coverage through the same rule the composer exposes', () => {
    // The assembly must not invent its own admissibility rule.
    expect(() => assertValidatorCoverage([{
      facts: callerMaster([callToVault()]).facts,
      hasValidator: false,
    }])).toThrow(ValidatorCoverageError);
  });
});

describe('the call data a callee carries', () => {
  /**
   * Builds only the plans the call-data rule needs. The rule runs before the layout, so these plans deliberately skip
   * the participants a whole composition needs; the case where a callee carries exactly what its caller recorded is
   * covered by the composition above, which does have them.
   */
  const planWith = (masters: readonly PlannedMaster[]): CompositionPlan => ({
    blocks: [{ contract: 'Ledger', masters: masters.map((master) => master.master), state: [] }],
    userInputs: [{ id: USER_ID, index: 0 }],
    masters,
  });

  it('refuses a callee carrying call data its caller did not record', () => {
    // The caller committed to the selector and one argument; the callee carries only the selector.
    expect(() => assembleComposition(planWith([
      callerMaster([callToVault()]),
      calleeMaster([SELECTOR]),
    ]))).toThrow(/carries call data its caller did not record/);
  });

  it('refuses a master nobody calls that carries call data', () => {
    // A user's entry has no call data, so a master with none cannot carry any.
    expect(() => assembleComposition(planWith([
      calleeMaster([SELECTOR, ARG]),
    ]))).toThrow(/entered by a user, so it carries no call data/);
  });

  it('refuses two callers that pass different arguments to one callee', () => {
    // A callee is one input with one call data, so the two cannot both be right.
    expect(() => assembleComposition(planWith([
      { ...callerMaster([callToVault()]), master: 'Ledger#0' },
      { ...callerMaster([{ ...callToVault(), argumentPushes: [SELECTOR] }]), master: 'Ledger#2', enteredBy: USER_ID },
      calleeMaster([SELECTOR, ARG]),
    ]))).toThrow(/called with different arguments by more than one caller/);
  });

  it('refuses a call that does not begin with a four-byte selector', () => {
    const shortSelector = { ...callToVault(), argumentPushes: [new Uint8Array([0x11])] };
    expect(() => assembleComposition(planWith([
      callerMaster([shortSelector]),
      calleeMaster([new Uint8Array([0x11])]),
    ]))).toThrow(/does not begin with a 4-byte selector/);
  });
});

describe('the trailing outputs a plan declares', () => {
  /** The composition's participants occupy 0, 1 and 2, so the trailing region starts at 3. */
  const withEventAt = (index: number): CompositionPlan => ({
    ...planWithValidator(),
    masters: [callerMaster([callToVault()]), calleeMaster([SELECTOR, ARG], { events: [index] })],
  });

  it('allocates one output per event and reports where they are', () => {
    const assembly = assembleComposition(withEventAt(3));
    expect(assembly.outputs.trailingBase).toBe(3);
    expect(assembly.outputs.eventIndices).toStrictEqual([3]);
    expect(assembly.outputs.sendIndices).toStrictEqual([]);
    expect(assembly.outputs.changeIndex).toBe(4);
  });

  it('refuses an event the trailing region does not put there', () => {
    // The region allocates 3 for the event a plan lists, so a plan listing 5 describes a different transaction.
    expect(() => assembleComposition(withEventAt(5))).toThrow(/lists events at \[5\].*puts them at \[3\]/s);
  });

  it('refuses two events at the same output, which would make the event log ambiguous', () => {
    expect(() => assembleComposition({
      ...planWithValidator(),
      masters: [
        callerMaster([callToVault()]),
        calleeMaster([SELECTOR, ARG], { events: [3, 3] }),
      ],
    })).toThrow();
  });

  it('refuses an event at a participant\'s own output', () => {
    // Every participant recreates at its index, so an event cannot sit there.
    expect(() => assembleComposition(withEventAt(0))).toThrow();
  });

  it('allocates a output per created record after the events and sends', () => {
    // The event takes output 3, so the created record takes the next one.
    const created = { in: INDEX_NONE, out: 4, viewIn: new Uint8Array(0), viewOut: new Uint8Array([0x01]) };
    const assembly = assembleComposition({
      ...planWithValidator(),
      masters: [
        callerMaster([callToVault()]),
        // One segment, because a master with no calls has one: the created record lives in it.
        calleeMaster([SELECTOR, ARG], { events: [3], segments: [[created]] }),
      ],
    });
    // The event takes 3, so the created record takes 4 and change follows it.
    expect(assembly.outputs.eventIndices).toStrictEqual([3]);
    expect(assembly.outputs.createdIndices).toStrictEqual([4]);
    expect(assembly.outputs.changeIndex).toBe(5);
  });

  it('reports empty regions for a plan that emits and sends nothing', () => {
    const assembly = assembleComposition(planWithValidator());
    expect(assembly.outputs.eventIndices).toStrictEqual([]);
    expect(assembly.outputs.sendIndices).toStrictEqual([]);
    expect(assembly.outputs.createdIndices).toStrictEqual([]);
    expect(assembly.outputs.changeIndex).toBe(3);
  });
});
