import { describe, expect, it } from 'vitest';
import { INDEX_NONE, decodeTranscript, decodeWitnessBlock, encodeArgumentList, splitFirstPush } from '@solidcash/utils';
import {
  assembleComposition, UnresolvedReferenceError, type CompositionPlan, type PlannedMaster,
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
  master: 'A0',
  contract: 'A',
  facts: {
    contract: 'A',
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
  segments: calls.length > 0 ? [[], []] : [[]],
  events: [],
  sends: [],
  argumentPushes: [],
  redeemScript: new Uint8Array([0x51, 0x52]),
});

const calleeMaster = (): PlannedMaster => ({
  master: 'B0',
  contract: 'B',
  facts: {
    contract: 'B',
    functionName: 'credit',
    kind: FrameKind.CALL,
    callerIsUser: false,
    originEqualsCaller: false,
    makesExternalCall: false,
    mastersOfContract: 1,
  },
  frame: { kind: FrameKind.CALL, sender: SELF_A, self: SELF_B, value: 0n },
  enteredBy: 'A0',
  origin: USER_ID,
  calls: [],
  retval: empty,
  segments: [[]],
  events: [],
  sends: [],
  argumentPushes: [],
  redeemScript: new Uint8Array([0x53, 0x54]),
});

const callToB = (): PlannedMaster['calls'][number] => ({
  kind: FrameKind.CALL,
  callee: 'B0',
  target: SELF_B,
  value: 0n,
  argumentPushes: [SELECTOR, ARG],
  result: new Uint8Array([0x14]),
});

/** A plan whose A block holds master A0 and the validator, and whose B block holds master B0. */
const planWithValidator = (): CompositionPlan => ({
  blocks: [
    { contract: 'A', masters: ['A0'], validator: { id: 'VA', settles: [] }, state: [] },
    { contract: 'B', masters: ['B0'], state: [] },
  ],
  userInputs: [{ id: USER_ID, index: USER_INDEX }],
  masters: [callerMaster([callToB()]), calleeMaster()],
  validator: {
    id: 'VA',
    // B is covered although it is not settled: it has one master that self-settles, but the call into it still
    // needs its edge bound.
    covers: ['B'],
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
    expect(assembly.inputs.map((input) => `${input.id}@${input.index}`)).toStrictEqual(['A0@0', 'VA@1', 'B0@2']);
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
    expect(assembly.calls[0]!.from).toBe('A0');

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
        { contract: 'A', masters: ['A0', 'A1'], validator: { id: 'VA', settles: ['A'] }, state: ['DA'] },
        { contract: 'B', masters: ['B0'], state: [] },
      ],
      masters: [callerMaster([callToB()]), calleeMaster(), { ...calleeMaster(), master: 'A1', contract: 'A' }],
      validator: {
        id: 'VA',
        covers: ['B'],
        redeemScript: Uint8Array.from(plan.validator!.redeemScript),
        settles: [{ category: CATEGORY, stateInputs: ['DA'] }],
      },
    });
    expect(assembly.transcript).toBeDefined();
    const transcript = decodeTranscript(
      splitFirstPush(assembly.inputs.find((input) => input.id === 'VA')!.unlockingBytecode).payload,
    );
    // The layout puts A's masters and validator first, then its state, then B's block: A0@0, A1@1, VA@2, DA@3,
    // B0@4. A0 is the composition's only root and every master is covered.
    expect(transcript.roots).toStrictEqual([0]);
    expect(transcript.masters).toStrictEqual([0, 1, 4]);
    expect(transcript.settles).toHaveLength(1);
    expect(transcript.settles[0]!.stateInputs).toStrictEqual([3]);
    expect(transcript.settles[0]!.category.length).toBe(32);
  });

  it('leaves the validator reference absent for a standalone master', () => {
    const plan = planWithValidator();
    const assembly = assembleComposition({
      blocks: [{ contract: 'A', masters: ['A0'], state: [] }],
      userInputs: plan.userInputs,
      masters: [callerMaster([])],
    });
    expect(blockOf(assembly.inputs[0]!).validatorRef).toBe(INDEX_NONE);
    expect(assembly.transcript).toBeUndefined();
  });

  it('refuses a plan whose entry needs a validator and has none', () => {
    const plan = planWithValidator();
    // A calls B, so A needs a validator; without one the composition cannot be checked.
    expect(() => assembleComposition({
      ...plan,
      blocks: [{ contract: 'A', masters: ['A0'], state: [] }, { contract: 'B', masters: ['B0'], state: [] }],
      validator: undefined,
    })).toThrow(ValidatorCoverageError);
  });

  it('refuses a reference that has no place in the composition', () => {
    const plan = planWithValidator();
    expect(() => assembleComposition({
      ...plan,
      masters: [{ ...callerMaster([callToB()]), enteredBy: 'nobody' }, calleeMaster()],
    })).toThrow(UnresolvedReferenceError);
  });

  it('refuses a master that calls itself', () => {
    const plan = planWithValidator();
    expect(() => assembleComposition({
      ...plan,
      masters: [{ ...callerMaster([{ ...callToB(), callee: 'A0' }]) }],
      validator: undefined,
    })).toThrow(/calls itself/);
  });

  it('refuses a user input that collides with a participant', () => {
    const plan = planWithValidator();
    expect(() => assembleComposition({
      ...plan,
      userInputs: [{ id: 'A0', index: 9 }],
    })).toThrow(/both a participant and a user input/);
  });

  it('checks coverage through the same rule the composer exposes', () => {
    // The assembly must not invent its own admissibility rule.
    expect(() => assertValidatorCoverage([{
      facts: callerMaster([callToB()]).facts,
      hasValidator: false,
    }])).toThrow(ValidatorCoverageError);
  });
});
