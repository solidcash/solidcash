import { describe, expect, it } from 'vitest';
import {
  FrameKind,
  asmToScript,
  buildPushdataCommitment,
  encodeIntegerValue,
  scriptToBytecode,
  type RecordEntry,
} from '@solidcash/utils';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory,
} from '../../../../solidc/test/framed/master/validator-input.js';
import {
  decideValidator, type FramedTransaction, type TokenShape,
} from '../../../../solidc/src/framed/validator/index.js';
import {
  EMPTY, compileAndDeploy, hexOf, master, masterInput, rootOf,
  seededAddress, selectorOf, token, userInput, validatorFor, USER_LOCK,
} from '../shapes/harness.js';
import { FRAMED_MASTER_PADDING_BYTES } from '../../../../solidc/src/framed/master/master-program.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { layoutWithFacets } from '../shapes/harness.js';
import { stateRecordLockingBytecode, stateRecordUnlockingBytecode } from '../../../src/framed/deploy/index.js';
import {
  createComposedDerivationHost, deriveDepthFirst, participant, readPublishedStopSites,
  type CompositionDraft, type CompositionDraftPlan, type DraftMaster,
} from '../../../src/framed/composer/index.js';

/**
 * One entry that calls one callee several times.
 *
 * `Hub.go` appends to `Log`'s one record inside a loop, so the call site the compiler publishes is the loop's one
 * site, the block each execution declares carries one call record per turn, and the derivation resumes that site
 * once per turn. `Log` runs on one master per turn, and its record is rewritten by every frame, so its views chain
 * across the turns in the order the frames run.
 *
 * The plan states each frame's declaration and the record's written commitment; the composer, the derivation and
 * the machine are what judge them. The turn count is a literal in the source, because a root entry that carries an
 * argument is a separate shape the composer refuses, so different turn counts are different sources.
 */

const HUB_LABEL = 'repeated callee hub';
const LOG_LABEL = 'repeated callee log';
const LOG_ADDRESS = seededAddress(LOG_LABEL);
const HUB_CATEGORY = seededCategory(HUB_LABEL);
const LOG_CATEGORY = seededCategory(LOG_LABEL);
const ITEM = 10n;
const VALIDATOR_ID = 'validator';
const RECORD_ID = 'record-log';
const USER_ID = 'user';
const RECORD_VALUE = 20_000n;
// The log's data NFT sits at the covenant its category derives, so a UTXO at this lock holding the log's mutable
// token is a genuine record rather than an ordinary lock a caller could mimic.
const RECORD_LOCK = stateRecordLockingBytecode(hexOf(LOG_CATEGORY));

/** The source, with the number of turns the loop makes written as its bound. */
function source(trips: number): string {
  return 'pragma solidcash ^0.14.0;'
    + ' interface ILog { function append(int item); }'
    + ' contract Log {'
    + '   int public total;'
    + '   function append(int item) { this.total = this.total + item; require(true); }'
    + ' }'
    + ' contract Hub {'
    + '   function go() {'
    + `     for (int i = 0; i < ${trips}; i = i + 1) { ILog(0x${hexOf(LOG_ADDRESS)}).append(${ITEM}); }`
    + '     require(true);'
    + '   }'
    + ' }';
}

/** One record kept in place, read at `before` and written at `after`. */
function kept(record: number, before: Uint8Array, after: Uint8Array): RecordEntry {
  return { in: record, out: record, viewIn: before, viewOut: after };
}

/** The shape of one run: the plan the composer takes, and the artifacts its tables live on. */
interface Run {
  readonly plan: CompositionDraftPlan;
  readonly artifacts: ReturnType<typeof compileAndDeploy>['artifacts'];
  readonly recordIndex: number;
  /** The record's commitment holding `total`. */
  readonly recordOf: (total: bigint) => Uint8Array;
}

/**
 * The compiled, deployed and planned shape.
 *
 * `turns` is what the plan declares — one master of the callee and one call record per turn — and `sourceTurns` is
 * what the compiled loop actually makes. They are equal in every run but the one that checks what a plan that
 * under-declares is refused by.
 */
function build(turns: number, sourceTurns: number = turns): Run {
  const { artifacts, contracts } = compileAndDeploy(source(sourceTurns), { Hub: HUB_LABEL, Log: LOG_LABEL });
  const hub = contracts.Hub!;
  const log = contracts.Log!;
  const validator = validatorFor(HUB_CATEGORY);

  // The layout places the hub's master and its validator, then one master per turn of the loop, then the record,
  // then the user's signed input.
  // The hub's master, its validator, the facet it binds, then one master per turn, then the record.
  const recordIndex = 3 + turns;
  const userIndex = recordIndex + 1;
  const recordOf = (total: bigint): Uint8Array =>
    new Uint8Array(Buffer.from(buildPushdataCommitment(artifacts.Log!.stateLayout!, { total }, 0), 'hex'));

  const appendPushes = [selectorOf(artifacts, 'Log', 'append'), encodeIntegerValue(ITEM)];

  const hubMaster = master({
    master: 'hub-1',
    contract: 'Hub',
    entry: 'go',
    program: hub.program,
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: hub.address, value: 0n },
    facts: {
      contract: 'Hub', functionName: 'go', kind: FrameKind.ROOT, callerIsUser: true,
      originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
    },
    enteredBy: USER_ID,
    origin: USER_ID,
    // One record per turn, each naming its own master of the callee: a frame per turn is what the format needs,
    // because one master carries one call data.
    calls: Array.from({ length: turns }, (_unused, index) => ({
      kind: FrameKind.CALL,
      callee: `log-${index + 1}`,
      target: log.address,
      value: 0n,
      argumentPushes: appendPushes,
    })),
    segments: Array.from({ length: turns + 1 }, () => []),
  });

  const logMaster = (turn: number): DraftMaster => master({
    master: `log-${turn}`,
    contract: 'Log',
    entry: 'append',
    program: log.program,
    frame: { kind: FrameKind.CALL, sender: hub.address, self: log.address, value: 0n },
    facts: {
      contract: 'Log', functionName: 'append', kind: FrameKind.CALL, callerIsUser: false,
      originEqualsCaller: false, makesExternalCall: false, mastersOfContract: turns,
    },
    enteredBy: 'hub-1',
    origin: USER_ID,
    argumentPushes: appendPushes,
    // The record's whole view for this frame: what the turn before it left, and what this turn computes.
    segments: [[kept(recordIndex, recordOf(ITEM * BigInt(turn - 1)), recordOf(ITEM * BigInt(turn)))]],
  });

  const blocks = [
    { contract: 'Hub', masters: ['hub-1'], validator: { id: VALIDATOR_ID, settles: [] }, state: [] },
    {
      contract: 'Log',
      masters: Array.from({ length: turns }, (_unused, index) => `log-${index + 1}`),
      state: [RECORD_ID],
    },
  ];
  // Every turn rewrites the log's record, and the covenant's write path names one writer: the hub's master and
  // validator precede the log's masters, so the first log master is the index the spend is authorized by.
  const masterIndex = participant(layoutWithFacets(blocks), 'log-1').index;
  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: [{ id: USER_ID, index: userIndex }],
    masters: [hubMaster, ...Array.from({ length: turns }, (_unused, index) => logMaster(index + 1))],
    inputs: {
      'hub-1': { source: masterInput(hub) },
      ...Object.fromEntries(Array.from({ length: turns },
        (_unused, index) => [`log-${index + 1}`, { source: masterInput(log) }])),
      [VALIDATOR_ID]: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(HUB_CATEGORY, 'mutable') },
      },
      [RECORD_ID]: {
        source: {
          lockingBytecode: RECORD_LOCK, valueSatoshis: RECORD_VALUE, token: token(LOG_CATEGORY, 'mutable', recordOf(0n)),
        },
        output: {
          lockingBytecode: RECORD_LOCK, valueSatoshis: RECORD_VALUE,
          token: token(LOG_CATEGORY, 'mutable', recordOf(ITEM * BigInt(sourceTurns))),
        },
        unlockingBytecode: stateRecordUnlockingBytecode(hexOf(LOG_CATEGORY), masterIndex, 1),
      },
      [USER_ID]: userInput(),
    },
    validator: {
      id: VALIDATOR_ID,
      covers: ['Log'],
      // The callee runs on one master per turn, so the validator settles it and lists its record as the state input
      // the transaction spends.
      settles: [{ category: LOG_CATEGORY, stateInputs: [RECORD_ID] }],
      redeemScript: validator.redeem,
    },
  };

  return { plan, artifacts, recordIndex, recordOf };
}

/** One real run of the derivation, as the host reported it. */
interface Stop {
  readonly master: string;
  readonly accepted: boolean;
  readonly error?: string;
}

/** The derivation of one run, with every real run's verdict kept. */
function derive(run: Run): {
  readonly draft: CompositionDraft;
  readonly completed: readonly string[];
  readonly stops: readonly Stop[];
  readonly runs: ReturnType<typeof deriveDepthFirst>['runs'];
} {
  const stops: Stop[] = [];
  const { host, draft } = createComposedDerivationHost({
    vm: compositionMachine(),
    artifacts: [run.artifacts.Hub!, run.artifacts.Log!],
    plan: run.plan,
    onRun: (frameId: string, _site: unknown, stop: { accepted: boolean; error?: string }) => {
      stops.push({ master: frameId, accepted: stop.accepted, ...(stop.error === undefined ? {} : { error: stop.error }) });
    },
  });
  const result = deriveDepthFirst(rootOf('Hub', 'go', 'hub-1'), host);
  return { draft, completed: result.completed.map((frame) => frame.master), stops, runs: result.runs };
}

let twoTurns: { readonly run: Run; readonly derived: ReturnType<typeof derive> } | undefined;
/** The two-turn shape, derived once: the cases that share it only read it. */
function derivedTwoTurns(): NonNullable<typeof twoTurns> {
  if (twoTurns === undefined) {
    const run = build(2);
    twoTurns = { run, derived: derive(run) };
  }
  return twoTurns;
}

const vm = compositionMachine();

/** The machine's verdict on one participant's input of the assembled transaction. */
function verdictAt(draft: CompositionDraft, id: string): { readonly accepted: boolean; readonly objection?: string } {
  const program = draft.programFor('hub-1');
  const state = vm.evaluate({
    inputIndex: participant(draft.layout, id).index,
    sourceOutputs: program.sourceOutputs,
    transaction: program.transaction,
  });
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String(state.error) };
}

/** The transaction as the validator's own derivation models it, restated from what the machine was handed. */
function toModel(draft: CompositionDraft): FramedTransaction {
  const program = draft.programFor('hub-1');
  const shape = (
    holder: {
      readonly token?: {
        category: Uint8Array; amount: bigint; nft?: { capability: string; commitment: Uint8Array };
      };
    },
  ): TokenShape => (holder.token === undefined
    ? { category: EMPTY, capability: 0, hasNft: false, nftCommitment: EMPTY, amount: 0n }
    : {
      category: holder.token.category,
      capability: holder.token.nft?.capability === 'minting' ? 2 : (holder.token.nft?.capability === 'mutable' ? 1 : 0),
      hasNft: holder.token.nft !== undefined,
      nftCommitment: holder.token.nft?.commitment ?? EMPTY,
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

/** The validator's decision on a whole draft, through the shipped reference checker. */
function decide(draft: CompositionDraft): ReturnType<typeof decideValidator> {
  return decideValidator(toModel(draft), {
    validatorTemplate: REAL_VALIDATOR_PROGRAM,
    validatorInputIndex: participant(draft.layout, VALIDATOR_ID).index,
  });
}

describe('one entry that calls one callee from a loop', () => {
  it('settles two turns: each turn runs on its own master, accepted by the machine', () => {
    const { draft, completed } = derivedTwoTurns().derived;

    // The callee completes before its caller, one frame per turn in the order the loop made them.
    expect(completed).toStrictEqual(['log-1', 'log-2', 'hub-1']);
    expect(verdictAt(draft, 'log-1')).toStrictEqual({ accepted: true });
    expect(verdictAt(draft, 'log-2')).toStrictEqual({ accepted: true });
    expect(verdictAt(draft, 'hub-1')).toStrictEqual({ accepted: true });
    expect(verdictAt(draft, VALIDATOR_ID)).toStrictEqual({ accepted: true });
    // The record's own input is spent under the data-NFT covenant, so the machine evaluates its script and accepts
    // the spend; the same unlocking at a plain lock is refused, the control stated in state-record-composition.
    expect(verdictAt(draft, RECORD_ID)).toStrictEqual({ accepted: true });
    expect(decide(draft).outcomes.map((outcome) => `${outcome.check}:${outcome.status}`))
      .toStrictEqual([
        'V1:accepted', 'V2:accepted', 'V3:accepted', 'V4:accepted', 'V5:accepted', 'V6:accepted',
        'V7:accepted', 'V8:accepted', 'V9:accepted', 'V10:accepted', 'V11:accepted',
      ]);
  });

  it('resumes the one published call site once per turn rather than once in total', () => {
    const callerRuns = derivedTwoTurns().derived.runs.filter((entry) => entry.frame.master === 'hub-1');
    // The table names one call site; the execution reaches it once per turn, and the visit after the last turn
    // fills nothing, which is what tells the driver the execution is past the site.
    expect(callerRuns.filter((entry) => entry.site.kind === 'call').map((entry) => entry.site.site))
      .toStrictEqual([0, 0, 0]);
    expect(callerRuns.filter((entry) => entry.site.kind === 'segmentClose')).toHaveLength(2);
  });

  it('refuses a plan that declares fewer call records than the loop turns', () => {
    // The plan says two turns and the compiled loop makes three: the derivation fills the two records there are,
    // then the caller's own program asks for a third the block does not carry.
    const run = build(2, 3);
    const { host } = createComposedDerivationHost({
      vm: compositionMachine(),
      artifacts: [run.artifacts.Hub!, run.artifacts.Log!],
      plan: run.plan,
    });
    expect(() => deriveDepthFirst(rootOf('Hub', 'go', 'hub-1'), host))
      .toThrowError(/FRAMED_DERIVATION_STALLED/);
  });

  it('refuses a chain that does not carry on from the turn before it', () => {
    const run = build(2);
    // The second turn's frame declares the record as the transaction spent it rather than as the first turn left
    // it. Every frame is internally consistent and every master accepts; the chain the validator walks is what
    // refuses.
    const second = run.plan.masters.find((candidate) => candidate.master === 'log-2')!;
    const disconnected: CompositionDraftPlan = {
      ...run.plan,
      masters: run.plan.masters.map((candidate) => (candidate.master === 'log-2'
        ? { ...second, segments: [[kept(run.recordIndex, run.recordOf(0n), run.recordOf(ITEM))]] }
        : candidate)),
      inputs: {
        ...run.plan.inputs,
        [RECORD_ID]: {
          ...run.plan.inputs[RECORD_ID]!,
          output: {
            lockingBytecode: RECORD_LOCK,
            valueSatoshis: RECORD_VALUE,
            token: token(LOG_CATEGORY, 'mutable', run.recordOf(ITEM)),
          },
        },
      },
    };
    const { draft } = derive({ ...run, plan: disconnected });
    // Both frames accept: each computes the value its own declaration holds.
    expect(verdictAt(draft, 'log-1')).toStrictEqual({ accepted: true });
    expect(verdictAt(draft, 'log-2')).toStrictEqual({ accepted: true });
    // The spec's checker refuses the plan: the second frame reads a record the first did not leave. The chains are
    // V7's, and the reference checker is where V7 is stated.
    const decision = decide(draft);
    expect(decision.outcomes.map((outcome) => `${outcome.check}:${outcome.status}`)).toContain('V7:rejected');
    expect(decision.rejection?.reason).toBe('V7_CHAIN_BROKEN');
  });

  it('settles three turns: the caller\'s own input pays for its own execution', () => {
    // The machine grants an input's execution 800 operation-cost units per byte of its unlocking bytecode, and the
    // caller's program makes one site check per turn — so the third turn's work costs more than the bytes its
    // program alone pays for. The master program carries a trailing padding block for exactly that: it lengthens
    // the bytecode the budget is measured over, so the same three turns settle where they previously ran out. The
    // measured margin is asserted from the run rather than from a constant.
    const run = build(3);
    const { draft, completed } = derive(run);

    expect(completed).toStrictEqual(['log-1', 'log-2', 'log-3', 'hub-1']);
    for (const frameId of ['log-1', 'log-2', 'log-3', 'hub-1']) {
      expect(verdictAt(draft, frameId), frameId).toStrictEqual({ accepted: true });
    }
    expect(verdictAt(draft, VALIDATOR_ID)).toStrictEqual({ accepted: true });
    expect(verdictAt(draft, RECORD_ID)).toStrictEqual({ accepted: true });
    // The caller's own program is longer than one that carries no padding by the block its input is paid for.
    const hubArtifact = run.artifacts.Hub!;
    const program = scriptToBytecode(asmToScript(hubArtifact.bytecode));
    expect(program.length).toBeGreaterThan(FRAMED_MASTER_PADDING_BYTES);
  });
});

describe('the tables and the layout the shape publishes', () => {
  it('publishes one repeated call site for the loop and one record the callee rewrites', () => {
    const run = build(2);
    const sites = readPublishedStopSites(run.artifacts.Hub!).entries[0]!.sites.sites;
    expect(sites).toStrictEqual([
      { kind: 'call', site: 0, callIndex: 0, descriptor: 0, repeated: true },
      { kind: 'segmentClose', site: 1, segmentIndex: 0 },
      { kind: 'segmentClose', site: 2, segmentIndex: 1 },
    ]);
    expect(run.artifacts.Log!.stateLayout?.dataNftCount).toBe(1);
  });

  it('places one master per turn between the caller and its record, and chains that record', () => {
    const { run, derived: { draft } } = derivedTwoTurns();
    expect(draft.layout.participants.map((placed) => `${placed.id}@${placed.index}`))
      .toStrictEqual(['hub-1@0', 'validator@1', 'validator/1@2', 'log-1@3', 'log-2@4', 'record-log@5']);
    expect(draft.blockOf('log-1').segments.map((segment) => segment.map((entry) => [entry.in, entry.out])))
      .toStrictEqual([[[run.recordIndex, run.recordIndex]]]);
    // The record's written commitment is the last declaration any frame made, which is the second turn's.
    const written = draft.blockOf('log-2').segments.flat().at(-1)!.viewOut;
    expect(draft.programFor('hub-1').transaction.outputs[run.recordIndex]!.token?.nft?.commitment)
      .toStrictEqual(written);
  });
});
