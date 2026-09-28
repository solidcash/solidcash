import { describe, expect, it } from 'vitest';
import { FrameKind, buildPushdataCommitment, type Artifact, type RecordEntry } from '@solidcash/utils';
import {
  VALIDATOR_PROGRAM_REASONS, decideValidator, type PerCallTransaction, type TokenShape,
} from '../../../../solidc/src/per-call/validator/index.js';
import { stateRecordLockingBytecode, stateRecordUnlockingBytecode } from '../../../src/per-call/deploy/index.js';
import {
  USER_LOCK, VALIDATOR_PROGRAM, compileAndDeploy, composeAndDerive, entryName, hexOf, master, masterInput,
  rootOf, seededAddress, selectorOf, token, userInput, userInputs, validatorFor,
} from '../shapes/harness.js';
import {
  layoutTransaction, participant, type CompositionDraftPlan, type ContractBlock, type DraftMaster,
} from '../../../src/per-call/composer/index.js';

/**
 * The shipped validator program does not enforce the order of a master's declared segments.
 *
 * A record's declarations chain in the order the validator derives (V6): the first starts at the commitment the
 * transaction spends, each later one carries on from the view the one before it left, and the last writes the
 * commitment the transaction writes. Swapping one master's two declared segments puts a declaration first whose
 * start is the view a later frame leaves, so the chain does not start where the record does. The derivation refuses
 * that as `V7_CHAIN_START_MISMATCH`.
 *
 * The on-chain program follows the same declarations order-free: it starts at the record's spent commitment and
 * takes whichever declaration reads there, so the swapped list still chains start-to-end and the program accepts
 * it. The divergence is pinned here rather than closed: the program holds the declarations but not the order their
 * frames ran in, and deriving that order on chain is the missing half of V6.
 *
 * The whole shipped path runs: real sources through `compileStringMulti` with the per-call convention, the shipped
 * deployment, the composer laying out and assembling the composition, the derivation judging it, and the BCH-2026
 * machine answering on the assembled transaction. The control runs the same composition with the declarations in
 * order; the hostile swaps `A.f`'s two segments and changes nothing else.
 */

const A_LABEL = 'reordered segments contract a';
const B_LABEL = 'reordered segments contract b';

const A_ROOT = 'a-f';
const A_CALLED = 'a-k';
const B_MASTER = 'b-g';
const VALIDATOR_ID = 'validator';
const RECORD_ID = 'record';
const USER_ID = 'user';

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface IB { function g(); }'
  + ' interface IA { function k(); }'
  + ` contract B { function g() { IA(0x${hexOf(seededAddress(A_LABEL))}).k.call(); require(true); } }`
  + ' contract A {'
  + '   int public count;'
  + '   function f() {'
  + '     this.count = this.count + 1;'
  + `     IB(0x${hexOf(seededAddress(B_LABEL))}).g.call();`
  + '     this.count = this.count + 1;'
  + '     require(this.count > 0);'
  + '   }'
  + '   function k() { this.count = this.count + 1; require(this.count > 0); }'
  + ' }';

type Deployment = ReturnType<typeof compileAndDeploy>;

interface Fixture {
  readonly deployment: Deployment;
  readonly before: Uint8Array;
  readonly afterFirst: Uint8Array;
  readonly afterCalled: Uint8Array;
  readonly written: Uint8Array;
}

/** A data-NFT commitment holding one integer, in the shipped state encoder's form. */
function commitment(artifact: Artifact, count: bigint): Uint8Array {
  return new Uint8Array(Buffer.from(buildPushdataCommitment(artifact.stateLayout!, { count }, 0), 'hex'));
}

function setup(): Fixture {
  const deployment = compileAndDeploy(SOURCE, { A: A_LABEL, B: B_LABEL });
  const artifacts = deployment.artifacts.A as Artifact;
  return {
    deployment,
    before: commitment(artifacts, 5n),
    afterFirst: commitment(artifacts, 6n),
    afterCalled: commitment(artifacts, 7n),
    written: commitment(artifacts, 8n),
  };
}

/** The blocks of the composition: contract `A` with its validator and record, then the callee contract. */
const BLOCKS: readonly ContractBlock[] = [
  { contract: 'A', masters: [A_ROOT, A_CALLED], validator: { id: VALIDATOR_ID, settles: [] }, state: [RECORD_ID] },
  { contract: 'B', masters: [B_MASTER], state: [] },
];

/** One record declaration: the commitment the segment reads and the one it writes. */
function entry(recordIndex: number, viewIn: Uint8Array, viewOut: Uint8Array): RecordEntry {
  return { in: recordIndex, out: recordIndex, viewIn, viewOut };
}

/**
 * The plan the composer lays out and assembles.
 *
 * `A.f` runs segment 0, then `B.g` calls `A.k`, then `A.f` resumes in segment 1. The record is spent holding `5`,
 * `5 -> 6` in the entry's first segment, `6 -> 7` in the called entry, and `7 -> 8` in the entry's second segment,
 * so the transaction writes `8` at the record's index. `swapped` exchanges the entry's two declared segments.
 */
function planFor(fixture: Fixture, swapped: boolean): CompositionDraftPlan {
  const { contracts, artifacts } = fixture.deployment;
  const a = contracts.A!;
  const b = contracts.B!;
  const layout = layoutTransaction(BLOCKS);
  const recordIndex = participant(layout, RECORD_ID).index;
  const rootIndex = participant(layout, A_ROOT).index;
  const categoryHex = Buffer.from(a.category).toString('hex');
  const [first, last] = [
    entry(recordIndex, fixture.before, fixture.afterFirst),
    entry(recordIndex, fixture.afterCalled, fixture.written),
  ];
  const validator = validatorFor(a.category);
  const args = (contract: string, name: string): Uint8Array => selectorOf(artifacts, contract, name);

  const facts = (
    contract: string, functionName: string, kind: number, makesExternalCall: boolean, mastersOfContract: number,
  ): DraftMaster['facts'] => ({
    contract, functionName, kind,
    callerIsUser: kind === FrameKind.ROOT, originEqualsCaller: kind === FrameKind.ROOT,
    makesExternalCall, mastersOfContract,
  });

  const rootMaster: DraftMaster = master({
    master: A_ROOT, contract: 'A', entry: 'f', program: a.program,
    facts: facts('A', 'f', FrameKind.ROOT, true, 2),
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: a.address, value: 0n },
    enteredBy: USER_ID, origin: USER_ID,
    calls: [{ kind: FrameKind.CALL, callee: B_MASTER, target: b.address, value: 0n, argumentPushes: [args('B', 'g')] }],
    segments: swapped ? [[last], [first]] : [[first], [last]],
    argumentPushes: [args('A', 'f')],
    dispatches: true,
  });
  const calleeMaster: DraftMaster = master({
    master: B_MASTER, contract: 'B', entry: 'g', program: b.program,
    facts: facts('B', 'g', FrameKind.CALL, true, 1),
    frame: { kind: FrameKind.CALL, sender: a.address, self: b.address, value: 0n },
    enteredBy: A_ROOT, origin: USER_ID,
    calls: [{ kind: FrameKind.CALL, callee: A_CALLED, target: a.address, value: 0n, argumentPushes: [args('A', 'k')] }],
    argumentPushes: [args('B', 'g')],
  });
  const calledMaster: DraftMaster = master({
    master: A_CALLED, contract: 'A', entry: 'k', program: a.program,
    facts: facts('A', 'k', FrameKind.CALL, false, 2),
    frame: { kind: FrameKind.CALL, sender: b.address, self: a.address, value: 0n },
    enteredBy: B_MASTER, origin: USER_ID,
    segments: [[entry(recordIndex, fixture.afterFirst, fixture.afterCalled)]],
    argumentPushes: [args('A', 'k')],
  });

  return {
    blocks: BLOCKS,
    userInputs: userInputs([USER_ID], layout.participantCount),
    masters: [rootMaster, calleeMaster, calledMaster],
    inputs: {
      [A_ROOT]: { source: masterInput(a) },
      [A_CALLED]: { source: masterInput(a) },
      [B_MASTER]: { source: masterInput(b) },
      [VALIDATOR_ID]: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(a.category, 'mutable') },
      },
      [RECORD_ID]: {
        source: {
          lockingBytecode: stateRecordLockingBytecode(categoryHex), valueSatoshis: 20_000n,
          token: token(a.category, 'mutable', fixture.before),
        },
        output: {
          lockingBytecode: stateRecordLockingBytecode(categoryHex), valueSatoshis: 20_000n,
          token: token(a.category, 'mutable', fixture.written),
        },
        unlockingBytecode: stateRecordUnlockingBytecode(categoryHex, rootIndex, 1),
      },
      [USER_ID]: userInput(),
    },
    validator: {
      id: VALIDATOR_ID, covers: ['B'],
      settles: [{ category: a.category, stateInputs: [RECORD_ID] }],
      redeemScript: validator.redeem,
    },
  };
}

/** The assembled transaction restated in the shape the derivation reads; nothing here decides anything. */
function modelOf(outcome: ReturnType<typeof composeAndDerive>): PerCallTransaction {
  const program = outcome.draft.programFor(A_ROOT);
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

interface Composed {
  readonly outcome: ReturnType<typeof composeAndDerive>;
  readonly transaction: PerCallTransaction;
  readonly validatorIndex: number;
  readonly rootIndex: number;
  readonly calledIndex: number;
  readonly completed: string[];
}

function compose(swapped: boolean): Composed {
  const fixture = setup();
  const { artifacts } = fixture.deployment;
  const outcome = composeAndDerive(
    planFor(fixture, swapped), [artifacts.A!, artifacts.B!], [rootOf('A', 'f', A_ROOT)]);
  return {
    outcome,
    transaction: modelOf(outcome),
    validatorIndex: participant(outcome.draft.layout, VALIDATOR_ID).index,
    rootIndex: participant(outcome.draft.layout, A_ROOT).index,
    calledIndex: participant(outcome.draft.layout, A_CALLED).index,
    completed: outcome.completed.map((frame) => frame.functionName),
  };
}

function decisionOf(composed: Composed): ReturnType<typeof decideValidator> {
  return decideValidator(composed.transaction, {
    validatorTemplate: VALIDATOR_PROGRAM, validatorInputIndex: composed.validatorIndex,
  });
}

function verdictOf(composed: Composed, participantId: string): { accepted: boolean; objection?: string } {
  const found = composed.outcome.verdicts.find((verdict) => verdict.participant === participantId)!;
  return found.accepted ? { accepted: true } : { accepted: false, objection: found.objection };
}

describe('a master whose declared segments are out of order', () => {
  it('accepts the control, whose declarations chain in the derived order', () => {
    const composed = compose(false);
    expect(composed.completed).toStrictEqual([
      entryName('A', 'k'), entryName('B', 'g'), entryName('A', 'f'),
    ]);
    expect(decisionOf(composed).accepted).toBe(true);
    // The control is a spend every input accepts, so the swap below is the only difference from an honest spend.
    expect(composed.outcome.verdicts.map((verdict) => `${verdict.participant}:${verdict.accepted}`))
      .toStrictEqual(['a-f:true', 'a-k:true', 'validator:true', 'record:true', 'b-g:true']);
  });

  it('refuses the swapped spend by name, and the machine accepts it anyway', () => {
    // The derivation walks the declarations in the order it derived, so the entry's first segment starts at `7`,
    // which is not the `5` the record is spent holding: `V7_CHAIN_START_MISMATCH`.
    const composed = compose(true);
    expect(composed.completed).toStrictEqual([
      entryName('A', 'k'), entryName('B', 'g'), entryName('A', 'f'),
    ]);
    const decision = decisionOf(composed);
    expect(decision.rejection?.reason).toBe('V7_CHAIN_START_MISMATCH');
    expect(decision.rejection?.index).toBe(participant(composed.outcome.draft.layout, RECORD_ID).index);

    // The program follows the same declarations order-free: `5 -> 6 -> 7 -> 8` still chains from the spent
    // commitment to the written one, so it accepts the entry's input and the validator's alike. `V7` is in the
    // reason list but the ordering half of it is not emitted.
    expect(VALIDATOR_PROGRAM_REASONS).toContain('V7_CHAIN_START_MISMATCH');
    expect(verdictOf(composed, A_ROOT)).toStrictEqual({ accepted: true });
    expect(verdictOf(composed, VALIDATOR_ID)).toStrictEqual({ accepted: true });
  });
});
