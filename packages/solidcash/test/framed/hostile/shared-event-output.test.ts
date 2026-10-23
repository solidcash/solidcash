import { describe, expect, it } from 'vitest';
import { layoutWithFacets } from '../shapes/harness.js';
import { createVirtualMachineBch2026 } from '@bitauth/libauth';
import {
  FrameKind, buildMasterUnlockingBytecode, encodeEventCommitment, type Artifact, type WitnessBlock,
} from '@solidcash/utils';
import {
  VALIDATOR_PROGRAM_REASONS, decideValidator, type FramedTransaction, type TokenShape,
} from '../../../../solidc/src/framed/validator/index.js';
import { eventOutput } from '../../../../solidc/test/framed/master/event-input.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import {
  USER_LOCK, VALIDATOR_PROGRAM, compileAndDeploy, composeAndDerive, entryName, hexOf, master, masterInput,
  rootOf, seededAddress, selectorOf, token, userInput, userInputs, validatorFor,
} from '../shapes/harness.js';
import {
  participant, type CompositionDraftPlan, type ContractBlock,
} from '../../../src/framed/composer/index.js';

/**
 * The shipped validator program refuses two frames that list the same event output.
 *
 * An event output belongs to the one frame that emitted it. Two frames naming one output would make the
 * settlement's attribution ambiguous, so every listed event output has to appear exactly once across the frames
 * that run on the contract. The derivation refuses a shared output as `V7_EVENT_OUTPUT_SHARED` and the program's
 * census gathers the listed indices and requires each exactly once, so the two agree rather than diverging.
 *
 * The composition is the one-contract self-call shape: `Own.start` calls `Own.inner`, so `Own` runs on two masters
 * and its validator settles it. Both entries emit the same event, and the plan states one event output per frame,
 * which is the faithful composition. The forgery rewrites the called frame's witness block to list the entry's own
 * event output and drops the now-unlisted second output, so the transaction carries one event where two frames
 * claim to have emitted it.
 *
 * The whole shipped path runs: the source through `compileStringMulti` with the framed convention, the shipped
 * deployment, the composer laying out and assembling the composition, the derivation judging it, and the BCH-2026
 * machine answering on the assembled transaction.
 */

const LABEL = 'shared event output contract';
const ROOT_MASTER = 'own-start';
const CALLED_MASTER = 'own-inner';
const VALIDATOR_ID = 'validator';
const USER_ID = 'user';

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IOwn { function inner(); }'
  + ' contract Own {'
  + '   event Log(int value);'
  + `   function start() { IOwn(0x${hexOf(seededAddress(LABEL))}).inner.call(); emit Log(7); require(true); }`
  + '   function inner() { emit Log(7); require(true); }'
  + ' }';

type Deployment = ReturnType<typeof compileAndDeploy>;
type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];

const BLOCKS: readonly ContractBlock[] = [
  { contract: 'Own', masters: [ROOT_MASTER, CALLED_MASTER], validator: { id: VALIDATOR_ID, settles: [] }, state: [] },
];

interface Fixture {
  readonly deployment: Deployment;
  readonly artifact: Artifact;
  readonly plan: CompositionDraftPlan;
}

/**
 * The plan the composer lays out and assembles: one event output per emitting frame, in frame order.
 *
 * The root is laid out before the frame it calls, which is also the order the layout opens the trailing event
 * region in, so the root's event sits at the first trailing index and the called frame's at the next.
 */
function setup(): Fixture {
  const deployment = compileAndDeploy(SOURCE, { Own: LABEL });
  const artifact = deployment.artifacts.Own as Artifact;
  const own = deployment.contracts.Own!;
  const layout = layoutWithFacets(BLOCKS);
  const validator = validatorFor(own.category);
  const event = artifact.events![0]!;
  const commitment = encodeEventCommitment(event.parameters, [7n]);
  const firstEvent = layout.participantCount;
  const args = (name: string): Uint8Array => selectorOf(deployment.artifacts, 'Own', name);

  const facts = (functionName: string, kind: number): {
    contract: string; functionName: string; kind: number; callerIsUser: boolean;
    originEqualsCaller: boolean; makesExternalCall: boolean; mastersOfContract: number;
  } => ({
    contract: 'Own', functionName, kind,
    callerIsUser: kind === FrameKind.ROOT, originEqualsCaller: kind === FrameKind.ROOT,
    makesExternalCall: kind === FrameKind.ROOT, mastersOfContract: 2,
  });

  const plan: CompositionDraftPlan = {
    blocks: BLOCKS,
    userInputs: userInputs([USER_ID], layout.participantCount),
    masters: [
      {
        ...master({
          master: ROOT_MASTER, contract: 'Own', entry: 'start', program: own.program,
          facts: facts('start', FrameKind.ROOT),
          frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: own.address, value: 0n },
          enteredBy: USER_ID, origin: USER_ID,
          calls: [{
            kind: FrameKind.CALL, callee: CALLED_MASTER, target: own.address, value: 0n,
            argumentPushes: [args('inner')],
          }],
          argumentPushes: [args('start')],
          dispatches: true,
        }),
        events: [firstEvent],
      },
      {
        ...master({
          master: CALLED_MASTER, contract: 'Own', entry: 'inner', program: own.program,
          facts: facts('inner', FrameKind.CALL),
          frame: { kind: FrameKind.CALL, sender: own.address, self: own.address, value: 0n },
          enteredBy: ROOT_MASTER, origin: USER_ID,
          argumentPushes: [args('inner')],
        }),
        events: [firstEvent + 1],
      },
    ],
    inputs: {
      [ROOT_MASTER]: { source: masterInput(own) },
      [CALLED_MASTER]: { source: masterInput(own) },
      [VALIDATOR_ID]: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(own.category, 'mutable') },
      },
      [USER_ID]: userInput(),
    },
    trailingOutputs: [
      eventOutput(own.category, event.signature, commitment),
      eventOutput(own.category, event.signature, commitment),
    ],
    validator: {
      id: VALIDATOR_ID, covers: [],
      settles: [{ category: own.category, stateInputs: [] }],
      redeemScript: validator.redeem,
    },
  };
  return { deployment, artifact, plan };
}

/** The assembled transaction restated in the shape the derivation reads; nothing here decides anything. */
function modelOf(program: VmProgram): FramedTransaction {
  type VmToken = { category: Uint8Array; amount: bigint; nft?: { capability: string; commitment: Uint8Array } };
  const shape = (holder: { readonly token?: VmToken }): TokenShape => (holder.token === undefined
    ? { category: new Uint8Array(0), capability: 0, hasNft: false, nftCommitment: new Uint8Array(0), amount: 0n }
    : {
      category: holder.token.category,
      capability: holder.token.nft?.capability === 'minting' ? 2 : (holder.token.nft?.capability === 'mutable' ? 1 : 0),
      hasNft: holder.token.nft !== undefined,
      nftCommitment: holder.token.nft?.commitment ?? new Uint8Array(0),
      amount: holder.token.amount,
    });
  return {
    inputs: program.transaction.inputs.map((input, index) => ({
      index,
      value: program.sourceOutputs[index]!.valueSatoshis,
      lockingBytecode: program.sourceOutputs[index]!.lockingBytecode,
      unlockingBytecode: input.unlockingBytecode,
      token: shape(program.sourceOutputs[index]!),
      outpointTransactionHash: input.outpointTransactionHash,
      outpointIndex: input.outpointIndex,
    })),
    outputs: program.transaction.outputs.map((output, index) => ({
      index, value: output.valueSatoshis, lockingBytecode: output.lockingBytecode, token: shape(output),
    })),
  };
}

/** Composes and derives the faithful plan, which is the bytes the forgery is a mutation of. */
function control(): { fixture: Fixture; outcome: ReturnType<typeof composeAndDerive> } {
  const fixture = setup();
  const { artifacts } = fixture.deployment;
  const outcome = composeAndDerive(
    fixture.plan, [artifacts.Own!], [rootOf('Own', 'start', ROOT_MASTER)]);
  return { fixture, outcome };
}

describe('two frames that list the same event output', () => {
  it('accepts the control, where each emitting frame lists its own output', () => {
    const { outcome } = control();
    expect(outcome.completed.map((frame) => frame.functionName))
      .toStrictEqual([entryName('Own', 'inner'), entryName('Own', 'start')]);
    const validatorIndex = participant(outcome.draft.layout, VALIDATOR_ID).index;
    const program = outcome.draft.programFor(ROOT_MASTER);
    expect(decideValidator(modelOf(program), {
      validatorTemplate: VALIDATOR_PROGRAM, validatorInputIndex: validatorIndex,
    }).accepted).toBe(true);
    expect(outcome.verdicts.every((verdict) => verdict.accepted)).toBe(true);
  });

  it('refuses the forged spend by name, and the machine refuses the same bytes', () => {
    // A plan that lists one output for two frames cannot be assembled at all: the trailing event region holds one
    // output per listed event and requires the plan's indices to be exactly the ones allocated, so the shipped
    // composer raises `FramedEncodingError` before any transaction exists. The forgery is therefore a mutation of
    // the assembled spend, which is the bytes a hostile builder would put on chain.
    const { fixture, outcome } = control();
    const program = outcome.draft.programFor(ROOT_MASTER);
    const calledIndex = participant(outcome.draft.layout, CALLED_MASTER).index;
    // The trailing region opens one past the last participant, which is also the root's event output.
    const firstEvent = outcome.draft.layout.participantCount;
    const calledMaster = fixture.plan.masters.find((candidate) => candidate.master === CALLED_MASTER)!;

    // The called frame's block now lists the root's event output instead of its own; the output it used to list is
    // dropped, so the transaction carries one event output and two frames that name it.
    const block = structuredClone(outcome.draft.blockOf(CALLED_MASTER)) as WitnessBlock;
    block.events = [firstEvent];
    const transaction = {
      ...program.transaction,
      inputs: program.transaction.inputs.map((input, index) => (index === calledIndex
        ? {
          ...input,
          unlockingBytecode: buildMasterUnlockingBytecode(
            block, calledMaster.argumentPushes, calledMaster.redeemScript),
        }
        : input)),
      outputs: [
        ...program.transaction.outputs.slice(0, firstEvent + 1),
        ...program.transaction.outputs.slice(firstEvent + 2),
      ],
    };
    const forged: VmProgram = { ...program, transaction };
    const validatorIndex = participant(outcome.draft.layout, VALIDATOR_ID).index;

    const decision = decideValidator(modelOf(forged), {
      validatorTemplate: VALIDATOR_PROGRAM, validatorInputIndex: validatorIndex,
    });
    expect(decision.rejection?.reason).toBe('V7_EVENT_OUTPUT_SHARED');

    // The program enforces the same rule: its census gathers every event index the frames on the settled contract
    // list and requires each to appear exactly once, so the shared output is refused on chain too.
    expect(VALIDATOR_PROGRAM_REASONS).toContain('V7_EVENT_OUTPUT_SHARED');
    const vm = compositionMachine();
    const state = vm.evaluate({
      inputIndex: validatorIndex,
      sourceOutputs: forged.sourceOutputs,
      transaction: forged.transaction,
    });
    expect(vm.stateSuccess(state)).not.toBe(true);
  });
});
