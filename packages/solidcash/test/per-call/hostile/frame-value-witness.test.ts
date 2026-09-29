import { describe, expect, it } from 'vitest';
import { FrameKind, buildMasterUnlockingBytecode, type WitnessBlock } from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import {
  USER_LOCK, compileAndDeploy, composeAndDerive, entryName, hexOf, master, masterInput, rootOf, seededAddress,
  selectorOf, token, userInput, userInputs, validatorFor,
} from '../shapes/harness.js';
import { layoutWithFacets } from '../shapes/harness.js';
import {
  participant, type CompositionDraftPlan, type ContractBlock,
} from '../../../src/per-call/composer/index.js';

/**
 * The frame's own `value` slot, as a composed root declares it.
 *
 * A master's witness block carries one `value` the frame claims to receive, and the entry's own `msg.value` is read
 * from it. A master that neither is payable nor sends fixes that slot at zero in its head: the check is the head's
 * own, not the validator's, because `msg.value` belongs to the frame the code runs. This case mutates exactly that
 * slot on the assembled spend — rebuilt through the same builder the composer used — and asks the machine for a
 * verdict, with the unchanged rebuild beside it as the control.
 *
 * The whole shipped path runs: real sources through `compileStringMulti` with the per-call convention, the shipped
 * deployment, the composer laying out and assembling the composition, the derivation judging it, and the BCH-2026
 * machine answering on the assembled transaction.
 */

const CALLER_LABEL = 'frame value caller';
const CALLEE_LABEL = 'frame value callee';
const CALLER_MASTER = 'caller-1';
const CALLEE_MASTER = 'callee-1';
const VALIDATOR_ID = 'validator';
const USER_ID = 'user';

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Callee { function ping() { require(true); } }'
  + ' contract Caller {'
  + `   function callIt() { ICallee(0x${hexOf(seededAddress(CALLEE_LABEL))}).ping.call(); require(true); }`
  + ' }';

const BLOCKS: readonly ContractBlock[] = [
  { contract: 'Caller', masters: [CALLER_MASTER], validator: { id: VALIDATOR_ID, settles: [] }, state: [] },
  { contract: 'Callee', masters: [CALLEE_MASTER], state: [] },
];

type VmProgram = Parameters<ReturnType<typeof compositionMachine>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;

/** Compiles, deploys, plans, assembles and derives the composition: a caller, its callee and the validator. */
function build(): { plan: CompositionDraftPlan; outcome: ReturnType<typeof composeAndDerive> } {
  const { artifacts, contracts } = compileAndDeploy(SOURCE, { Caller: CALLER_LABEL, Callee: CALLEE_LABEL });
  const caller = contracts.Caller!;
  const callee = contracts.Callee!;
  const validator = validatorFor(caller.category);
  const ping = selectorOf(artifacts, 'Callee', 'ping');

  const plan: CompositionDraftPlan = {
    blocks: BLOCKS,
    userInputs: userInputs([USER_ID], layoutWithFacets(BLOCKS).participantCount),
    masters: [
      master({
        master: CALLER_MASTER, contract: 'Caller', entry: 'callIt', program: caller.program,
        facts: {
          contract: 'Caller', functionName: entryName('Caller', 'callIt'), kind: FrameKind.ROOT,
          callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
        },
        frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: caller.address, value: 0n },
        enteredBy: USER_ID, origin: USER_ID,
        calls: [{ kind: FrameKind.CALL, callee: CALLEE_MASTER, target: callee.address, value: 0n, argumentPushes: [ping] }],
      }),
      master({
        master: CALLEE_MASTER, contract: 'Callee', entry: 'ping', program: callee.program,
        facts: {
          contract: 'Callee', functionName: entryName('Callee', 'ping'), kind: FrameKind.CALL,
          callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
        },
        frame: { kind: FrameKind.CALL, sender: caller.address, self: callee.address, value: 0n },
        enteredBy: CALLER_MASTER, origin: USER_ID, argumentPushes: [ping],
      }),
    ],
    inputs: {
      [CALLER_MASTER]: { source: masterInput(caller) },
      [CALLEE_MASTER]: { source: masterInput(callee) },
      [VALIDATOR_ID]: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(caller.category, 'mutable') },
      },
      [USER_ID]: userInput(),
    },
    validator: { id: VALIDATOR_ID, covers: ['Callee'], settles: [], redeemScript: validator.redeem },
  };

  const outcome = composeAndDerive(
    plan, [artifacts.Caller!, artifacts.Callee!], [rootOf('Caller', 'callIt', CALLER_MASTER)],
  );
  return { plan, outcome };
}

/** The machine's verdict on one input of a program. */
function verdict(program: VmProgram, index: number): { accepted: boolean; objection?: string } {
  const vm = compositionMachine();
  const state = vm.evaluate({
    inputIndex: index, sourceOutputs: program.sourceOutputs, transaction: program.transaction,
  });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

/** The assembled spend with the caller's block rebuilt from `block` through the same builder the composer used. */
function withCallerBlock(
  plan: CompositionDraftPlan, outcome: ReturnType<typeof composeAndDerive>, block: WitnessBlock,
): VmProgram {
  const spec = plan.masters.find((candidate) => candidate.master === CALLER_MASTER)!;
  const program = outcome.draft.programFor(CALLER_MASTER);
  const transaction = structuredClone(program.transaction) as VmTransaction;
  transaction.inputs[participant(outcome.draft.layout, CALLER_MASTER).index]!.unlockingBytecode =
    buildMasterUnlockingBytecode(block, spec.argumentPushes, spec.redeemScript);
  return { ...program, transaction };
}

/** A copy of the caller's own derived block. */
function callerBlock(outcome: ReturnType<typeof composeAndDerive>): WitnessBlock {
  return structuredClone(outcome.draft.blockOf(CALLER_MASTER)) as WitnessBlock;
}

describe("a composed frame's own value slot", () => {
  it('accepts the assembled composition on every contract input', () => {
    const { outcome } = build();
    expect(outcome.verdicts.map((row) => `${row.participant}: ${row.objection ?? 'accepted'}`))
      .toStrictEqual(['caller-1: accepted', 'validator: accepted', 'validator/1: accepted', 'callee-1: accepted']);
  });

  it('accepts an unchanged rebuild of the caller\'s block, so the builder below is not what refuses', () => {
    const { plan, outcome } = build();
    const program = withCallerBlock(plan, outcome, callerBlock(outcome));
    expect(verdict(program, participant(outcome.draft.layout, CALLER_MASTER).index)).toStrictEqual({ accepted: true });
  });

  it('refuses a frame that claims a value its code is not payable for', () => {
    // The caller's entry is neither payable nor sends, so its head fixes the frame's value at zero. A block claiming
    // value would let the entry's own `msg.value` be a number no output paid. The validator's edges read only the
    // caller's calls, not the root's own value, so the refusal is the caller's own head.
    const { plan, outcome } = build();
    const block = callerBlock(outcome);
    block.value = 1n;
    const program = withCallerBlock(plan, outcome, block);
    const callerIndex = participant(outcome.draft.layout, CALLER_MASTER).index;
    expect(verdict(program, callerIndex).accepted).toBe(false);
    expect(verdict(program, participant(outcome.draft.layout, VALIDATOR_ID).index)).toStrictEqual({ accepted: true });
    expect(verdict(program, participant(outcome.draft.layout, CALLEE_MASTER).index)).toStrictEqual({ accepted: true });
  });
});
