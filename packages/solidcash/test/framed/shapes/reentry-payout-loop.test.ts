import { describe, expect, it } from 'vitest';
import {
  FrameKind,
  buildPushdataCommitment,
  encodeEventCommitment,
  encodeIntegerValue,
  encodeResultList,
  type Artifact,
  type CallStopSite,
  type RecordEntry,
} from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { eventOutput } from '../../../../solidc/test/framed/master/event-input.js';
import { stateRecordLockingBytecode, stateRecordUnlockingBytecode } from '../../../src/framed/deploy/index.js';
import {
  createComposedDerivationHost,
  participant,
  type CompositionDraftPlan,
  type DraftMaster,
} from '../../../src/framed/composer/index.js';
import { compositionEventLogs } from '../../../src/framed/receipt/index.js';
import { layoutWithFacets } from './harness.js';
import {
  USER_LOCK,
  compileAndDeploy,
  composeAndDerive,
  entryName,
  hexOf,
  master,
  masterInput,
  rootOf,
  seededAddress,
  selectorOf,
  token,
  userInput,
  userInputs,
  validatorFor,
} from './harness.js';

/**
 * A user-entered root that reaches an escrow whose `release` sets a guard, calls a claimer, and the claimer pays a
 * token once per share it computed.
 *
 * `Root.enter` calls `Escrow.release`. `release` is unguarded: it writes the escrow's record, sets the guard field,
 * and calls `Claimer.claim`. `claim` re-enters the escrow: a read-only read of the record `release` just wrote, a
 * read-only read of a third contract whose record names the payout's turns, a call into the escrow's guarded
 * `setClaimed`, and a loop that calls `Token.transfer` once per turn, so the number of token calls is data-dependent.
 * `claim` returns the amount it paid, `release` reads it back, and the root writes its own record and emits two
 * events.
 *
 * Every coordinate comes from `layoutTransaction`/`participant`, every commitment from the shipped encoders
 * (`buildPushdataCommitment`, `encodeEventCommitment`), and every verdict from the BCH-2026 machine. The compile,
 * the deployment, the composer, the derivation and the machine all run.
 */

const ROOT_LABEL = 'reentry payout root';
const ESCROW_LABEL = 'reentry payout escrow';
const CLAIMER_LABEL = 'reentry payout claimer';
const ORACLE_LABEL = 'reentry payout oracle';
const TOKEN_LABEL = 'reentry payout token';

const LABELS = {
  Root: ROOT_LABEL,
  Escrow: ESCROW_LABEL,
  Claimer: CLAIMER_LABEL,
  Oracle: ORACLE_LABEL,
  Token: TOKEN_LABEL,
};

const ESCROW_ADDRESS = hexOf(seededAddress(ESCROW_LABEL));
const CLAIMER_ADDRESS = hexOf(seededAddress(CLAIMER_LABEL));
const ORACLE_ADDRESS = hexOf(seededAddress(ORACLE_LABEL));
const TOKEN_ADDRESS = hexOf(seededAddress(TOKEN_LABEL));
const USER_ADDRESS = hexOf(USER_LOCK);

const VALIDATOR_ID = 'validator';
const USER_ID = 'user';
const ROOT_MASTER = 'root-1';
const RELEASE_MASTER = 'release-1';
const READ_MASTER = 'readRecord-1';
const SET_CLAIMED_MASTER = 'setClaimed-1';
const CLAIM_MASTER = 'claim-1';
const RATE_MASTER = 'rate-1';
const ROOT_RECORD = 'root-record';
const ESCROW_RECORD = 'escrow-record';
const ORACLE_RECORD = 'oracle-record';
const TOKEN_RECORD = 'token-record';

/** The record the escrow holds: `claiming` is the guard, `stored` is the value the entries write. */
const ESCROW_BEFORE = { claiming: 0n, stored: 0n };
const ESCROW_AFTER_RELEASE = { claiming: 1n, stored: 1n };
const ESCROW_AFTER_SETTLE = { claiming: 1n, stored: 2n };
const ROOT_BEFORE = { score: 0n };
const ROOT_AFTER = { score: 1n };
const TOKEN_BEFORE = { paid: 0n };

/** The token amount each turn of the payout moves. */
const SHARES = 1n;

/**
 * The source: `claim` runs the payout loop beside its fixed calls.
 *
 * Only the loop's own call site is marked one the source does not fix: the two reads and the guarded write carry
 * no marker, so the derivation fills them once each and resumes the loop's site once per turn.
 *
 * The loop's bound is the count the oracle holds, read through its own entry, so the compiled body carries no
 * literal trip count: the same body settles for however many turns the plan's record names. `release` returns
 * rather than compares the payout, so it too embeds no count.
 */
function source(): string {
  return 'pragma solidcash ^0.14.0;'
    + ' interface IClaimer { function claim() returns (int); }'
    + ' interface IEscrow {'
    + '   function release();'
    + '   function readRecord() view returns (int);'
    + '   function setClaimed(int value);'
    + ' }'
    + ' interface IOracle { function rate() view returns (int); }'
    + ' interface IToken { function transfer(address to, int amount); }'
    + ' contract Root {'
    + '   int public score;'
    + '   event Scored(int indexed score);'
    + '   event Noted(int note);'
    + '   function enter() {'
    + `     IEscrow(0x${ESCROW_ADDRESS}).release();`
    + '     this.score = 1;'
    + '     emit Scored(1);'
    + '     emit Noted(2);'
    + '     require(this.score == 1);'
    + '   }'
    + ' }'
    + ' contract Escrow {'
    + '   int public claiming;'
    + '   int public stored;'
    + '   function release() {'
    + '     this.stored = 1;'
    + '     this.claiming = 1;'
    + `     int paid = IClaimer(0x${CLAIMER_ADDRESS}).claim();`
    + '     require(paid >= 0);'
    + '   }'
    + '   function setClaimed(int value) {'
    + '     require(this.claiming == 1);'
    + '     this.stored = value;'
    + '     require(true);'
    + '   }'
    + '   function readRecord() view returns (int) { return this.stored; }'
    + ' }'
    + ' contract Claimer {'
    + '   function claim() returns (int) {'
    + `     int observed = IEscrow(0x${ESCROW_ADDRESS}).readRecord();`
    + '     require(observed == 1);'
    + `     int turns = IOracle(0x${ORACLE_ADDRESS}).rate();`
    + `     IEscrow(0x${ESCROW_ADDRESS}).setClaimed(2);`
    + '     int paid = 0;'
    + '     for (int i = 0; i < turns; i = i + 1) {'
    + `       IToken(0x${TOKEN_ADDRESS}).transfer(0x${USER_ADDRESS}, ${SHARES});`
    + '       paid = paid + 1;'
    + '     }'
    + '     return paid;'
    + '   }'
    + ' }'
    + ' contract Oracle {'
    + '   int public rateValue;'
    + '   function rate() view returns (int) { return this.rateValue; }'
    + ' }'
    + ' contract Token {'
    + '   int public paid;'
    + '   function transfer(address to, int amount) {'
    + '     this.paid = this.paid + amount;'
    + '     require(this.paid >= amount);'
    + '   }'
    + ' }';
}

/** One record kept in place: its input and output index, and the commitment each side holds. */
function kept(record: number, viewIn: Uint8Array, viewOut: Uint8Array): RecordEntry {
  return { in: record, out: record, viewIn, viewOut };
}

/** A record's commitment from the shipped encoder. */
function commitmentOf(layout: NonNullable<Artifact['stateLayout']>, fields: Record<string, bigint>): Uint8Array {
  return new Uint8Array(Buffer.from(buildPushdataCommitment(layout, fields, 0), 'hex'));
}

/** The whole plan one run declares, with the indices the layout assigned. */
interface Run {
  readonly plan: CompositionDraftPlan;
  readonly artifacts: ReturnType<typeof compileAndDeploy>['artifacts'];
  readonly rootRecordIndex: number;
  readonly escrowRecordIndex: number;
  readonly oracleRecordIndex: number;
  readonly tokenRecordIndex: number;
  readonly eventIndices: readonly number[];
  readonly escrowWritten: Uint8Array;
  readonly rootWritten: Uint8Array;
  readonly tokenWritten: Uint8Array;
  readonly oracleKept: Uint8Array;
}

/** Compiles, deploys and plans the shape for one loop bound. */
function build(trips: number): Run {
  const { artifacts, contracts } = compileAndDeploy(source(), LABELS);
  const root = contracts.Root!;
  const escrow = contracts.Escrow!;
  const claimer = contracts.Claimer!;
  const oracle = contracts.Oracle!;
  const tokenContract = contracts.Token!;
  const validator = validatorFor(root.category);

  const escrowHex = hexOf(escrow.category);
  const tokenHex = hexOf(tokenContract.category);
  const rootRec = (fields: Record<string, bigint>): Uint8Array =>
    commitmentOf(artifacts.Root!.stateLayout!, fields);
  const escrowRec = (fields: Record<string, bigint>): Uint8Array =>
    commitmentOf(artifacts.Escrow!.stateLayout!, fields);
  const oracleRec = (fields: Record<string, bigint>): Uint8Array =>
    commitmentOf(artifacts.Oracle!.stateLayout!, fields);
  const tokenRec = (fields: Record<string, bigint>): Uint8Array =>
    commitmentOf(artifacts.Token!.stateLayout!, fields);

  const transferMasters = Array.from({ length: trips }, (_unused, index) => `transfer-${index + 1}`);
  const blocks: CompositionDraftPlan['blocks'] = [
    {
      contract: 'Root', masters: [ROOT_MASTER],
      validator: { id: VALIDATOR_ID, settles: [] }, state: [ROOT_RECORD],
    },
    { contract: 'Escrow', masters: [RELEASE_MASTER, READ_MASTER, SET_CLAIMED_MASTER], state: [ESCROW_RECORD] },
    { contract: 'Claimer', masters: [CLAIM_MASTER], state: [] },
    { contract: 'Oracle', masters: [RATE_MASTER], state: [ORACLE_RECORD] },
    { contract: 'Token', masters: transferMasters, state: [TOKEN_RECORD] },
  ];
  const layout = layoutWithFacets(blocks);
  const rootIndex = participant(layout, ROOT_MASTER).index;
  const releaseIndex = participant(layout, RELEASE_MASTER).index;
  const rateIndex = participant(layout, RATE_MASTER).index;
  const firstTransferIndex = participant(layout, transferMasters[0]!).index;
  const rootRecordIndex = participant(layout, ROOT_RECORD).index;
  const escrowRecordIndex = participant(layout, ESCROW_RECORD).index;
  const oracleRecordIndex = participant(layout, ORACLE_RECORD).index;
  const tokenRecordIndex = participant(layout, TOKEN_RECORD).index;
  const eventIndices = [layout.participantCount, layout.participantCount + 1];

  const releaseSelector = selectorOf(artifacts, 'Escrow', 'release');
  const readSelector = selectorOf(artifacts, 'Escrow', 'readRecord');
  const setClaimedSelector = selectorOf(artifacts, 'Escrow', 'setClaimed');
  const claimSelector = selectorOf(artifacts, 'Claimer', 'claim');
  const rateSelector = selectorOf(artifacts, 'Oracle', 'rate');
  const transferSelector = selectorOf(artifacts, 'Token', 'transfer');

  const transferPushes = [transferSelector, encodeIntegerValue(SHARES), USER_LOCK];
  const escrowWritten = escrowRec(ESCROW_AFTER_SETTLE);
  const rootWritten = rootRec(ROOT_AFTER);
  const tokenWritten = tokenRec({ paid: BigInt(trips) * SHARES });
  // The loop turns as often as the oracle's record says, so the count is the plan's data.
  const oracleValue = { rateValue: BigInt(trips) };
  const oracleKept = oracleRec(oracleValue);

  const rootMaster: DraftMaster = {
    ...master({
      master: ROOT_MASTER, contract: 'Root', entry: 'enter', program: root.program,
      facts: {
        contract: 'Root', functionName: 'enter', kind: FrameKind.ROOT, callerIsUser: true,
        originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
      },
      frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: root.address, value: 0n },
      enteredBy: USER_ID, origin: USER_ID,
      calls: [{
        kind: FrameKind.CALL, callee: RELEASE_MASTER, target: escrow.address, value: 0n,
        argumentPushes: [releaseSelector],
      }],
      segments: [
        [kept(rootRecordIndex, rootRec(ROOT_BEFORE), rootRec(ROOT_BEFORE))],
        [kept(rootRecordIndex, rootRec(ROOT_BEFORE), rootRec(ROOT_AFTER))],
      ],
    }),
    events: [...eventIndices],
  };
  const releaseMaster = master({
    master: RELEASE_MASTER, contract: 'Escrow', entry: 'release', program: escrow.program,
    facts: {
      contract: 'Escrow', functionName: 'release', kind: FrameKind.CALL, callerIsUser: false,
      originEqualsCaller: false, makesExternalCall: true, mastersOfContract: 3,
    },
    frame: { kind: FrameKind.CALL, sender: root.address, self: escrow.address, value: 0n },
    enteredBy: ROOT_MASTER, origin: USER_ID,
    argumentPushes: [releaseSelector],
    calls: [{
      kind: FrameKind.CALL, callee: CLAIM_MASTER, target: claimer.address, value: 0n,
      argumentPushes: [claimSelector],
    }],
    segments: [[kept(escrowRecordIndex, escrowRec(ESCROW_BEFORE), escrowRec(ESCROW_AFTER_RELEASE))], []],
  });
  const claimMaster: DraftMaster = {
    ...master({
      master: CLAIM_MASTER, contract: 'Claimer', entry: 'claim', program: claimer.program,
      facts: {
        contract: 'Claimer', functionName: 'claim', kind: FrameKind.CALL, callerIsUser: false,
        originEqualsCaller: false, makesExternalCall: true, mastersOfContract: 1,
      },
      frame: { kind: FrameKind.CALL, sender: escrow.address, self: claimer.address, value: 0n },
      enteredBy: RELEASE_MASTER, origin: USER_ID,
      argumentPushes: [claimSelector],
      calls: [
        {
          kind: FrameKind.STATIC, callee: READ_MASTER, target: escrow.address, value: 0n,
          argumentPushes: [readSelector],
        },
        {
          kind: FrameKind.STATIC, callee: RATE_MASTER, target: oracle.address, value: 0n,
          argumentPushes: [rateSelector],
        },
        {
          kind: FrameKind.CALL, callee: SET_CLAIMED_MASTER, target: escrow.address, value: 0n,
          argumentPushes: [setClaimedSelector, encodeIntegerValue(2n)],
        },
        ...transferMasters.map((callee) => ({
          kind: FrameKind.CALL, callee, target: tokenContract.address, value: 0n,
          argumentPushes: transferPushes,
        })),
      ],
    }),
    retval: encodeResultList([encodeIntegerValue(BigInt(trips))]),
  };
  const readMaster: DraftMaster = {
    ...master({
      master: READ_MASTER, contract: 'Escrow', entry: 'readRecord', program: escrow.program,
      facts: {
        contract: 'Escrow', functionName: 'readRecord', kind: FrameKind.STATIC, callerIsUser: false,
        originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 3,
      },
      frame: { kind: FrameKind.STATIC, sender: claimer.address, self: escrow.address, value: 0n },
      enteredBy: CLAIM_MASTER, origin: USER_ID, argumentPushes: [readSelector],
      segments: [[kept(escrowRecordIndex, escrowRec(ESCROW_AFTER_RELEASE), escrowRec(ESCROW_AFTER_RELEASE))]],
    }),
    retval: encodeResultList([encodeIntegerValue(ESCROW_AFTER_RELEASE.stored)]),
  };
  const rateMaster: DraftMaster = {
    ...master({
      master: RATE_MASTER, contract: 'Oracle', entry: 'rate', program: oracle.program,
      facts: {
        contract: 'Oracle', functionName: 'rate', kind: FrameKind.STATIC, callerIsUser: false,
        originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
      },
      frame: { kind: FrameKind.STATIC, sender: claimer.address, self: oracle.address, value: 0n },
      enteredBy: CLAIM_MASTER, origin: USER_ID, argumentPushes: [rateSelector],
      segments: [[kept(oracleRecordIndex, oracleKept, oracleKept)]],
    }),
    retval: encodeResultList([encodeIntegerValue(oracleValue.rateValue)]),
  };
  const setClaimedMaster = master({
    master: SET_CLAIMED_MASTER, contract: 'Escrow', entry: 'setClaimed', program: escrow.program,
    facts: {
      contract: 'Escrow', functionName: 'setClaimed', kind: FrameKind.CALL, callerIsUser: false,
      originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 3,
    },
    frame: { kind: FrameKind.CALL, sender: claimer.address, self: escrow.address, value: 0n },
    enteredBy: CLAIM_MASTER, origin: USER_ID,
    argumentPushes: [setClaimedSelector, encodeIntegerValue(2n)],
    segments: [[kept(escrowRecordIndex, escrowRec(ESCROW_AFTER_RELEASE), escrowWritten)]],
  });
  const transferMaster = (turn: number): DraftMaster => master({
    master: `transfer-${turn}`, contract: 'Token', entry: 'transfer', program: tokenContract.program,
    facts: {
      contract: 'Token', functionName: 'transfer', kind: FrameKind.CALL, callerIsUser: false,
      originEqualsCaller: false, makesExternalCall: false, mastersOfContract: trips,
    },
    frame: { kind: FrameKind.CALL, sender: claimer.address, self: tokenContract.address, value: 0n },
    enteredBy: CLAIM_MASTER, origin: USER_ID, argumentPushes: transferPushes,
    segments: [[kept(tokenRecordIndex, tokenRec({ paid: BigInt(turn - 1) * SHARES }),
      tokenRec({ paid: BigInt(turn) * SHARES }))]],
  });

  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: userInputs([USER_ID], layout.participantCount),
    masters: [
      rootMaster, releaseMaster, claimMaster, readMaster, rateMaster, setClaimedMaster,
      ...transferMasters.map((_id, index) => transferMaster(index + 1)),
    ],
    inputs: {
      [ROOT_MASTER]: { source: masterInput(root) },
      [RELEASE_MASTER]: { source: masterInput(escrow) },
      [READ_MASTER]: { source: masterInput(escrow) },
      [SET_CLAIMED_MASTER]: { source: masterInput(escrow) },
      [CLAIM_MASTER]: { source: masterInput(claimer) },
      [RATE_MASTER]: { source: masterInput(oracle) },
      ...Object.fromEntries(transferMasters.map((id) => [id, { source: masterInput(tokenContract) }])),
      [VALIDATOR_ID]: {
        source: {
          lockingBytecode: validator.lock, valueSatoshis: 20_000n,
          token: token(root.category, 'mutable'),
        },
      },
      [ROOT_RECORD]: {
        source: {
          lockingBytecode: stateRecordLockingBytecode(hexOf(root.category)), valueSatoshis: 20_000n,
          token: token(root.category, 'mutable', rootRec(ROOT_BEFORE)),
        },
        output: {
          lockingBytecode: stateRecordLockingBytecode(hexOf(root.category)), valueSatoshis: 20_000n,
          token: token(root.category, 'mutable', rootWritten),
        },
        unlockingBytecode: stateRecordUnlockingBytecode(hexOf(root.category), rootIndex, 1),
      },
      [ESCROW_RECORD]: {
        source: {
          lockingBytecode: stateRecordLockingBytecode(escrowHex), valueSatoshis: 20_000n,
          token: token(escrow.category, 'mutable', escrowRec(ESCROW_BEFORE)),
        },
        output: {
          lockingBytecode: stateRecordLockingBytecode(escrowHex), valueSatoshis: 20_000n,
          token: token(escrow.category, 'mutable', escrowWritten),
        },
        unlockingBytecode: stateRecordUnlockingBytecode(escrowHex, releaseIndex, 1),
      },
      [ORACLE_RECORD]: {
        source: {
          lockingBytecode: stateRecordLockingBytecode(hexOf(oracle.category)), valueSatoshis: 20_000n,
          token: token(oracle.category, 'mutable', oracleKept),
        },
        output: {
          lockingBytecode: stateRecordLockingBytecode(hexOf(oracle.category)), valueSatoshis: 20_000n,
          token: token(oracle.category, 'mutable', oracleKept),
        },
        unlockingBytecode: stateRecordUnlockingBytecode(hexOf(oracle.category), rateIndex, 0),
      },
      [TOKEN_RECORD]: {
        source: {
          lockingBytecode: stateRecordLockingBytecode(tokenHex), valueSatoshis: 20_000n,
          token: token(tokenContract.category, 'mutable', tokenRec(TOKEN_BEFORE)),
        },
        output: {
          lockingBytecode: stateRecordLockingBytecode(tokenHex), valueSatoshis: 20_000n,
          token: token(tokenContract.category, 'mutable', tokenWritten),
        },
        unlockingBytecode: stateRecordUnlockingBytecode(tokenHex, firstTransferIndex, 1),
      },
      [USER_ID]: userInput(),
    },
    trailingOutputs: [
      eventOutput(root.category, artifacts.Root!.events![0]!.signature,
        encodeEventCommitment(artifacts.Root!.events![0]!.parameters, [1n])),
      eventOutput(root.category, artifacts.Root!.events![1]!.signature,
        encodeEventCommitment(artifacts.Root!.events![1]!.parameters, [2n])),
    ],
    validator: {
      id: VALIDATOR_ID,
      covers: ['Escrow', 'Claimer', 'Oracle', 'Token'],
      settles: [
        { category: escrow.category, stateInputs: [ESCROW_RECORD] },
        { category: tokenContract.category, stateInputs: [TOKEN_RECORD] },
      ],
      redeemScript: validator.redeem,
    },
  };

  return {
    plan, artifacts,
    rootRecordIndex, escrowRecordIndex, oracleRecordIndex, tokenRecordIndex, eventIndices,
    escrowWritten, rootWritten, tokenWritten, oracleKept,
  };
}

const ROOT = rootOf('Root', 'enter', ROOT_MASTER);

/** The artifact objects the composer and the receipt read, in the plan's contract order. */
function artifactList(run: Run): readonly Artifact[] {
  return [run.artifacts.Root!, run.artifacts.Escrow!, run.artifacts.Claimer!, run.artifacts.Oracle!,
    run.artifacts.Token!];
}

type DerivationDraft = ReturnType<typeof createComposedDerivationHost>['draft'];
type DerivedProgram = ReturnType<DerivationDraft['programFor']>;

/** The machine's verdict on one input of the derived transaction, with the outputs it evaluated as given. */
function verdictAtIndex(
  draft: DerivationDraft,
  inputIndex: number,
  outputs?: DerivedProgram['transaction']['outputs'],
): string {
  const program = draft.programFor(ROOT_MASTER);
  const vm = compositionMachine();
  const transaction = outputs === undefined ? program.transaction : { ...program.transaction, outputs };
  const state = vm.evaluate({ inputIndex, sourceOutputs: program.sourceOutputs, transaction });
  return vm.stateSuccess(state) === true ? 'accepted' : `refused: ${String(state.error)}`;
}

/** The participants whose input the machine refused, named with the refusal. */
function refused(outcome: ReturnType<typeof composeAndDerive>): string[] {
  return outcome.verdicts.filter((verdict) => !verdict.accepted)
    .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
}

const derivations = new Map<string, { readonly run: Run; readonly outcome: ReturnType<typeof composeAndDerive> }>();
/** One derivation per trip count: the cases that share one read it and change nothing in it. */
function derived(trips: number): { readonly run: Run; readonly outcome: ReturnType<typeof composeAndDerive> } {
  const key = String(trips);
  let found = derivations.get(key);
  if (found === undefined) {
    const run = build(trips);
    found = { run, outcome: composeAndDerive(run.plan, artifactList(run), [ROOT]) };
    derivations.set(key, found);
  }
  return found;
}

describe('a claimer that pays once per share, driven through the shipped path', () => {
  it('refuses a token record output no frame computed, on the same composition', () => {
    const { run, outcome: { draft } } = derived(2);
    const program = draft.programFor(ROOT_MASTER);
    const wrong = commitmentOf(run.artifacts.Token!.stateLayout!, { paid: 999n });
    const outputs = program.transaction.outputs.map((output, index) => (index === run.tokenRecordIndex
      ? { ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment: wrong } } }
      : output));
    expect(verdictAtIndex(draft, participant(draft.layout, VALIDATOR_ID).index, outputs))
      .toBe('refused: Program failed an OP_VERIFY operation.');
  });

  it('settles the payout loop written inside the claimer\'s fixed-call body', () => {
    // The shape as literally stated - `claim` does the read-only read, the oracle read, the guarded write and the
    // payout loop - derives in one execution. Only the loop's own call site is marked one the source does not fix;
    // the fixed calls keep their positions, so they and the loop's turns all fill, in order.
    const { run, outcome } = derived(2);
    const claim = run.artifacts.Claimer!.composition!.stopSites!.entries
      .find((entry) => entry.functionName === entryName('Claimer', 'claim'))!;
    expect(claim.sites.sites.filter((site): site is CallStopSite => site.kind === 'call')
      .map((site) => site.repeated ?? false))
      .toStrictEqual([false, false, false, true]);

    // The two reads, the guarded write and the loop's two turns each run on their own master, and `claim` resumes
    // only once they have.
    expect(outcome.completed.map((frame) => frame.master)).toStrictEqual([
      READ_MASTER, RATE_MASTER, SET_CLAIMED_MASTER, 'transfer-1', 'transfer-2',
      CLAIM_MASTER, RELEASE_MASTER, ROOT_MASTER,
    ]);
    // Every participant - every master, the validator and every record - is accepted by the machine.
    expect(refused(outcome)).toStrictEqual([]);

    // The escrow's record carries what `setClaimed` wrote, the token's what the loop paid, the oracle's what it
    // held and the root's its score; both events decode in declared order, at the outputs the layout gave them.
    const outputs = outcome.transaction.outputs;
    expect(outputs[run.escrowRecordIndex]!.token?.nft?.commitment).toStrictEqual(run.escrowWritten);
    expect(outputs[run.tokenRecordIndex]!.token?.nft?.commitment).toStrictEqual(run.tokenWritten);
    expect(outputs[run.oracleRecordIndex]!.token?.nft?.commitment).toStrictEqual(run.oracleKept);
    expect(outputs[run.rootRecordIndex]!.token?.nft?.commitment).toStrictEqual(run.rootWritten);
    const logs = compositionEventLogs(outcome.draft, artifactList(run));
    expect(logs.map((log) => log.eventName)).toStrictEqual(['Scored', 'Noted']);
    expect(logs.map((log) => log.values)).toStrictEqual([[1n], [2n]]);
    expect(logs.map((log) => log.outputIndex)).toStrictEqual([...run.eventIndices]);
  });

  it('turns the loop beside fixed calls as often as the plan declares records', () => {
    // The trip count is the count the oracle's record names, so the same compiled `claim` body settles for
    // however many turns the plan declares: the compiler publishes one repeated site, and the derivation resumes
    // it once per record. Two turns and four run from one body, each reading back the amount the loop moved.
    for (const trips of [2, 4]) {
      const { run, outcome } = derived(trips);
      expect(outcome.completed.filter((frame) => frame.master.startsWith('transfer-')).map((frame) => frame.master))
        .toStrictEqual(Array.from({ length: trips }, (_unused, index) => `transfer-${index + 1}`));
      expect(refused(outcome)).toStrictEqual([]);
      expect(outcome.transaction.outputs[run.tokenRecordIndex]!.token?.nft?.commitment)
        .toStrictEqual(commitmentOf(run.artifacts.Token!.stateLayout!, { paid: BigInt(trips) * SHARES }));
    }
  });

  it('refuses a store record output no frame computed, on the same composition', () => {
    // The root runs on one master, so no validator settles its record: the head the root's own input runs holds its
    // last declaration to the transaction's output, and that is the input the mutation is refused at. The validator
    // does not settle the store record, so it is unaffected by the same mutation.
    const { run, outcome: { draft } } = derived(2);
    const program = draft.programFor(ROOT_MASTER);
    const wrong = commitmentOf(run.artifacts.Root!.stateLayout!, { score: 7n });
    const outputs = program.transaction.outputs.map((output, index) => (index === run.rootRecordIndex
      ? { ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment: wrong } } }
      : output));
    expect(verdictAtIndex(draft, participant(draft.layout, ROOT_MASTER).index, outputs))
      .toBe('refused: Program failed an OP_VERIFY operation.');
    expect(verdictAtIndex(draft, participant(draft.layout, VALIDATOR_ID).index, outputs)).toBe('accepted');
  });
});
