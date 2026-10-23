import { describe, expect, it } from 'vitest';
import { layoutWithFacets } from '../shapes/harness.js';
import { createVirtualMachineBch2026 } from '@bitauth/libauth';
import {
  FrameKind,
  buildMasterUnlockingBytecode,
  buildPushdataCommitment,
  encodeArgumentList,
  encodeEventCommitment,
  encodeIntegerValue,
  type Artifact,
  type WitnessBlock,
} from '@solidcash/utils';
import {
  decideValidator, type FramedTransaction, type TokenShape,
} from '../../../../solidc/src/framed/validator/index.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import {
  stateRecordLockingBytecode, stateRecordUnlockingBytecode,
} from '../../../src/framed/deploy/index.js';
import {
  USER_LOCK, VALIDATOR_PROGRAM, compileAndDeploy, composeAndDerive, entryName, hexOf, master, masterInput,
  rootOf, seededAddress, selectorOf, token, userInput, userInputs, validatorFor,
} from '../shapes/harness.js';
import {
  participant, type CompositionDraftPlan, type ContractBlock, type DraftMaster,
} from '../../../src/framed/composer/index.js';
import { eventOutput } from '../../../../solidc/test/framed/master/event-input.js';

/**
 * A witness block relabelled after the user signed.
 *
 * A user's `SIGHASH_ALL` signature commits to the outputs but never to the other inputs' unlocking bytecode, so a
 * re-player may hand a composition a different witness block for any covered master. This case asks what the
 * shipped code does with such a spend: the master's own frame checks the block it carries, and the validator judges
 * the blocks against one another, so a relabelled block that claims what the execution did not do fails every
 * check, while a relabelled block every check admits leaves the transaction's outputs exactly the ones the user
 * signed.
 *
 * The whole shipped path runs: real sources through `compileStringMulti` with the framed convention, the shipped
 * deployment, the composer laying out and assembling the composition, the derivation judging it, and the BCH-2026
 * machine answering on the assembled transaction. Each mutation rewrites one or two covered masters' blocks through
 * the same builder the composer used and leaves the user's signature bytes untouched.
 */

const LABEL = 'witness relabeling ledger';
const ROOT_MASTER = 'ledger-start';
const CALLED_MASTER = 'ledger-note';
const VALIDATOR_ID = 'validator';
const RECORD_ID = 'record';
const USER_ID = 'user';

/** The value the callee's own code returns, and the constant the root writes to its record. */
const ANSWER = 7n;
/** The value a relabelled block records in place of `ANSWER`. */
const OTHER = 8n;

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface INote { function note() returns (int); }'
  + ' contract Ledger {'
  + '   int public count;'
  + '   event Log(int value);'
  + `   function start() { this.count = ${ANSWER}; int r = INote(0x${hexOf(seededAddress(LABEL))}).note();`
  + '     emit Log(r); require(r > 0); }'
  + `   function note() returns (int) { return ${ANSWER}; }`
  + ' }';

type Deployment = ReturnType<typeof compileAndDeploy>;
type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmSourceOutputs = VmProgram['sourceOutputs'];

const BLOCKS: readonly ContractBlock[] = [
  {
    contract: 'Ledger',
    masters: [ROOT_MASTER, CALLED_MASTER],
    validator: { id: VALIDATOR_ID, settles: [] },
    state: [RECORD_ID],
  },
];

interface Fixture {
  readonly deployment: Deployment;
  readonly plan: CompositionDraftPlan;
  readonly outcome: ReturnType<typeof composeAndDerive>;
  readonly rootIndex: number;
  readonly calledIndex: number;
  readonly validatorIndex: number;
  readonly signed: VmProgram;
}

/** A data-NFT commitment holding one integer, in the shipped state encoder's form. */
function commitment(artifact: Artifact, count: bigint): Uint8Array {
  return new Uint8Array(Buffer.from(buildPushdataCommitment(artifact.stateLayout!, { count }, 0), 'hex'));
}

/**
 * Compiles, deploys, plans, assembles and derives the composition: a root that writes its record, calls a callee
 * for one value and emits it, and a validator that covers both masters and settles the record.
 */
function setup(): Fixture {
  const deployment = compileAndDeploy(SOURCE, { Ledger: LABEL });
  const artifact = deployment.artifacts.Ledger as Artifact;
  const ledger = deployment.contracts.Ledger!;
  const layout = layoutWithFacets(BLOCKS);
  const validator = validatorFor(ledger.category);
  const categoryHex = Buffer.from(ledger.category).toString('hex');
  const rootIndex = participant(layout, ROOT_MASTER).index;
  const recordIndex = participant(layout, RECORD_ID).index;
  const event = artifact.events![0]!;
  const before = commitment(artifact, 5n);
  const after = commitment(artifact, ANSWER);
  const args = (name: string): Uint8Array => selectorOf(deployment.artifacts, 'Ledger', name);

  const facts = (
    functionName: string, kind: number,
  ): DraftMaster['facts'] => ({
    contract: 'Ledger', functionName, kind,
    callerIsUser: kind === FrameKind.ROOT, originEqualsCaller: kind === FrameKind.ROOT,
    makesExternalCall: kind === FrameKind.ROOT, mastersOfContract: 2,
  });

  const startMaster: DraftMaster = {
    ...master({
      master: ROOT_MASTER, contract: 'Ledger', entry: 'start', program: ledger.program,
      facts: facts('start', FrameKind.ROOT),
      frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: ledger.address, value: 0n },
      enteredBy: USER_ID, origin: USER_ID,
      calls: [{
        kind: FrameKind.CALL, callee: CALLED_MASTER, target: ledger.address, value: 0n,
        argumentPushes: [args('note')],
      }],
      segments: [[{ in: recordIndex, out: recordIndex, viewIn: before, viewOut: after }], []],
      argumentPushes: [args('start')],
      dispatches: true,
    }),
    events: [layout.participantCount],
  };
  const noteMaster: DraftMaster = {
    ...master({
      master: CALLED_MASTER, contract: 'Ledger', entry: 'note', program: ledger.program,
      facts: facts('note', FrameKind.CALL),
      frame: { kind: FrameKind.CALL, sender: ledger.address, self: ledger.address, value: 0n },
      enteredBy: ROOT_MASTER, origin: USER_ID,
      argumentPushes: [args('note')],
    }),
    retval: encodeArgumentList([encodeIntegerValue(ANSWER)]),
  };

  const plan: CompositionDraftPlan = {
    blocks: BLOCKS,
    userInputs: userInputs([USER_ID], layout.participantCount),
    masters: [startMaster, noteMaster],
    inputs: {
      [ROOT_MASTER]: { source: masterInput(ledger) },
      [CALLED_MASTER]: { source: masterInput(ledger) },
      [VALIDATOR_ID]: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(ledger.category, 'mutable') },
      },
      [RECORD_ID]: {
        source: {
          lockingBytecode: stateRecordLockingBytecode(categoryHex), valueSatoshis: 20_000n,
          token: token(ledger.category, 'mutable', before),
        },
        output: {
          lockingBytecode: stateRecordLockingBytecode(categoryHex), valueSatoshis: 20_000n,
          token: token(ledger.category, 'mutable', after),
        },
        unlockingBytecode: stateRecordUnlockingBytecode(categoryHex, rootIndex, 1),
      },
      [USER_ID]: userInput(),
    },
    trailingOutputs: [
      eventOutput(ledger.category, event.signature, encodeEventCommitment(event.parameters, [ANSWER])),
    ],
    validator: {
      id: VALIDATOR_ID, covers: [],
      settles: [{ category: ledger.category, stateInputs: [RECORD_ID] }],
      redeemScript: validator.redeem,
    },
  };

  const outcome = composeAndDerive(plan, [deployment.artifacts.Ledger!], [rootOf('Ledger', 'start', ROOT_MASTER)]);
  const signed = outcome.draft.programFor(ROOT_MASTER);
  return {
    deployment,
    plan,
    outcome,
    rootIndex,
    calledIndex: participant(layout, CALLED_MASTER).index,
    validatorIndex: participant(layout, VALIDATOR_ID).index,
    signed,
  };
}

/** The assembled transaction restated in the shape the derivation reads; nothing here decides anything. */
function modelOf(transaction: VmProgram['transaction'], sourceOutputs: VmSourceOutputs): FramedTransaction {
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
    inputs: transaction.inputs.map((input, index) => ({
      index,
      value: sourceOutputs[index]!.valueSatoshis,
      lockingBytecode: sourceOutputs[index]!.lockingBytecode,
      unlockingBytecode: input.unlockingBytecode,
      token: shape(sourceOutputs[index]!),
      outpointTransactionHash: input.outpointTransactionHash,
      outpointIndex: input.outpointIndex,
    })),
    outputs: transaction.outputs.map((output, index) => ({
      index, value: output.valueSatoshis, lockingBytecode: output.lockingBytecode, token: shape(output),
    })),
  };
}

/** The signed transaction with the listed masters' blocks rebuilt from the mutated blocks. */
function relabel(fixture: Fixture, blocks: Readonly<Record<string, WitnessBlock>>): VmTransaction {
  const transaction = structuredClone(fixture.signed.transaction) as VmTransaction;
  for (const [frameId, block] of Object.entries(blocks)) {
    const spec = fixture.plan.masters.find((candidate) => candidate.master === frameId)!;
    const index = participant(fixture.outcome.draft.layout, frameId).index;
    transaction.inputs[index]!.unlockingBytecode =
      buildMasterUnlockingBytecode(block, spec.argumentPushes, spec.redeemScript);
  }
  return transaction;
}

/** The machine's verdict on one input of a mutated spend. */
function verdict(
  transaction: VmTransaction,
  sourceOutputs: VmSourceOutputs,
  inputIndex: number,
): { accepted: boolean; objection?: string } {
  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

/** The machine verdicts on the root, the callee and the validator, in that order. */
function contractVerdicts(
  fixture: Fixture,
  transaction: VmTransaction,
): readonly { accepted: boolean; objection?: string }[] {
  return [fixture.rootIndex, fixture.calledIndex, fixture.validatorIndex]
    .map((index) => verdict(transaction, fixture.signed.sourceOutputs, index));
}

/** A byte fingerprint of the outputs, so a relabelling's effect on them is compared over their whole content. */
function outputsFingerprint(outputs: VmProgram['transaction']['outputs']): string {
  const fingerprintToken = (held: unknown): string => (held === undefined
    ? '-' : JSON.stringify(held, (_key, value) => {
      if (typeof value === 'bigint') return value.toString();
      if (value instanceof Uint8Array) return Buffer.from(value).toString('hex');
      return value;
    }));
  return outputs.map((output) => [
    output.valueSatoshis.toString(),
    Buffer.from(output.lockingBytecode).toString('hex'),
    fingerprintToken(output.token),
  ].join('|')).join('||');
}

/** The derivation's decision on a mutated spend, keyed to the shipped validator program. */
function decisionOf(fixture: Fixture, transaction: VmTransaction): ReturnType<typeof decideValidator> {
  return decideValidator(modelOf(transaction, fixture.signed.sourceOutputs), {
    validatorTemplate: VALIDATOR_PROGRAM, validatorInputIndex: fixture.validatorIndex,
  });
}

/** The block the derivation produced for a master, as the mutation's starting point. */
function blockOf(fixture: Fixture, frameId: string): WitnessBlock {
  return structuredClone(fixture.outcome.draft.blockOf(frameId)) as WitnessBlock;
}

describe('a witness block relabelled after the user signed', () => {
  it('accepts the assembled composition on every contract input', () => {
    const fixture = setup();
    expect(fixture.outcome.completed.map((frame) => frame.functionName))
      .toStrictEqual([entryName('Ledger', 'note'), entryName('Ledger', 'start')]);
    expect(contractVerdicts(fixture, fixture.signed.transaction).map((row) => row.accepted))
      .toStrictEqual([true, true, true]);
    expect(decisionOf(fixture, fixture.signed.transaction).accepted).toBe(true);
  });

  it('accepts an unchanged rebuild of the root\'s block, so the builder below is not what refuses', () => {
    // The control: the root's unlocking bytecode is rebuilt through the same builder with no field changed.
    const fixture = setup();
    const rebuilt = relabel(fixture, { [ROOT_MASTER]: blockOf(fixture, ROOT_MASTER) });
    expect(verdict(rebuilt, fixture.signed.sourceOutputs, fixture.rootIndex).accepted).toBe(true);
    expect(outputsFingerprint(rebuilt.outputs)).toBe(outputsFingerprint(fixture.signed.transaction.outputs));
  });

  it('refuses a callee whose block records a return its own code did not compute', () => {
    // The callee's own frame compares the recorded `retval` against the blob its `return` built, so a frame that
    // claims another value is refused where it runs. The root's record still names the computed value, so the root
    // accepts and only the validator refuses the disagreement. Pins the half where the relabelling fails a check.
    const fixture = setup();
    const block = blockOf(fixture, CALLED_MASTER);
    block.retval = encodeArgumentList([encodeIntegerValue(OTHER)]);
    const relabelled = relabel(fixture, { [CALLED_MASTER]: block });

    expect(verdict(relabelled, fixture.signed.sourceOutputs, fixture.calledIndex).accepted).toBe(false);
    expect(verdict(relabelled, fixture.signed.sourceOutputs, fixture.rootIndex).accepted).toBe(true);
    // The retval check runs in the validator's facet, at the input after the head.
    expect(verdict(relabelled, fixture.signed.sourceOutputs, fixture.validatorIndex + 1).accepted).toBe(false);
    expect(decisionOf(fixture, relabelled).accepted).toBe(false);
  });

  it('refuses a callee whose block shifts to a frame kind its own code does not admit', () => {
    // The callee runs a message call; shifting the declaration to the internal kind reaches an arm its head does
    // not emit an accept for, so its own input fails. The root only reads the callee's call data, which is
    // unchanged, and still accepts. Pins the half where the relabelling fails a check.
    const fixture = setup();
    const block = blockOf(fixture, CALLED_MASTER);
    block.kind = FrameKind.INTERNAL;
    const relabelled = relabel(fixture, { [CALLED_MASTER]: block });

    expect(verdict(relabelled, fixture.signed.sourceOutputs, fixture.calledIndex).accepted).toBe(false);
    expect(verdict(relabelled, fixture.signed.sourceOutputs, fixture.rootIndex).accepted).toBe(true);
    expect(decisionOf(fixture, relabelled).accepted).toBe(false);
  });

  it('refuses a root whose block declares more calls than its own code made', () => {
    // The root's body pins the declared call count to the number of calls its source makes, so a block that adds a
    // second record is refused by the root itself. The callee is untouched and still accepts. Pins the half where
    // the relabelling fails a check.
    const fixture = setup();
    const block = blockOf(fixture, ROOT_MASTER);
    block.calls = [...block.calls, { ...structuredClone(block.calls[0]!) }];
    block.segments = [...block.segments, []];
    const relabelled = relabel(fixture, { [ROOT_MASTER]: block });

    expect(verdict(relabelled, fixture.signed.sourceOutputs, fixture.rootIndex).accepted).toBe(false);
    expect(verdict(relabelled, fixture.signed.sourceOutputs, fixture.calledIndex).accepted).toBe(true);
    expect(decisionOf(fixture, relabelled).accepted).toBe(false);
  });

  it('refuses a segment whose block declares a record view its own code did not compute', () => {
    // The root's body computes the commitment its write leaves and closes against the segment's declaration, so a
    // block that records another view is refused where it runs. The transaction's output still carries the computed
    // commitment, which is why the declaration, not the output, is what fails. Pins the half where the relabelling
    // fails a check.
    const fixture = setup();
    const block = blockOf(fixture, ROOT_MASTER);
    const entry = block.segments[0]![0]!;
    entry.viewOut = Buffer.from(commitment(fixture.deployment.artifacts.Ledger as Artifact, 99n));
    const relabelled = relabel(fixture, { [ROOT_MASTER]: block });

    expect(verdict(relabelled, fixture.signed.sourceOutputs, fixture.rootIndex).accepted).toBe(false);
    expect(verdict(relabelled, fixture.signed.sourceOutputs, fixture.calledIndex).accepted).toBe(true);
    expect(decisionOf(fixture, relabelled).accepted).toBe(false);
  });

  it('refuses a frame whose block drops the event its own code emitted', () => {
    // The root's body pins the declared event count to the number of events it emits, so a block that lists none
    // while the body emits one is refused by the root. The callee emits nothing and is unaffected. Pins the half
    // where the relabelling fails a check.
    const fixture = setup();
    const block = blockOf(fixture, ROOT_MASTER);
    block.events = [];
    const relabelled = relabel(fixture, { [ROOT_MASTER]: block });

    expect(verdict(relabelled, fixture.signed.sourceOutputs, fixture.rootIndex).accepted).toBe(false);
    expect(verdict(relabelled, fixture.signed.sourceOutputs, fixture.calledIndex).accepted).toBe(true);
    expect(decisionOf(fixture, relabelled).accepted).toBe(false);
  });

  it('refuses a relabelled call value at the caller\'s site and at the callee\'s head', () => {
    // The validator binds the call record's value to the callee's own value claim, so two blocks that agree on
    // another value pass it. The caller's site passes no value, so its record must carry none, and the callee has no
    // payable body, so its frame takes none. Pins the half where the relabelling fails a check.
    const fixture = setup();
    const root = blockOf(fixture, ROOT_MASTER);
    root.calls[0]!.value = 1_000n;
    const callee = blockOf(fixture, CALLED_MASTER);
    callee.value = 1_000n;
    const relabelled = relabel(fixture, { [ROOT_MASTER]: root, [CALLED_MASTER]: callee });

    expect(contractVerdicts(fixture, relabelled).map((row) => row.accepted)).toStrictEqual([false, false, true]);
    expect(decisionOf(fixture, relabelled).accepted).toBe(true);
    expect(outputsFingerprint(relabelled.outputs)).toBe(outputsFingerprint(fixture.signed.transaction.outputs));
  });
});
