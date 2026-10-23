import { describe, expect, it } from 'vitest';
import { createVirtualMachineBch2026 } from '@bitauth/libauth';
import {
  FrameKind,
  INDEX_NONE,
  buildMasterUnlockingBytecode,
  buildPushdataCommitment,
  bytesToHex,
  computeFunctionSelector,
  computeFunctionSignature,
  encodeEventCommitment,
  validatorAddress,
  type RecordEntry,
  type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import {
  decideValidator, type FramedTransaction, type TokenShape,
} from '../../../../solidc/src/framed/validator/index.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import {
  deployMaster, stateRecordLockingBytecode, stateRecordUnlockingBytecode,
} from '../../../src/framed/deploy/index.js';
import {
  createComposedDerivationHost,
  deriveDepthFirst,
  participant,
  type CompositionDraft,
  type CompositionDraftPlan,
  type DraftMaster,
} from '../../../src/framed/composer/index.js';
import { callerUnlockingBytecode } from '../../../../solidc/test/framed/master/caller-input.js';
import { eventOutput } from '../../../../solidc/test/framed/master/event-input.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory, validatorSpend,
} from '../../../../solidc/test/framed/master/validator-input.js';

/**
 * A two-contract round trip in which both contracts keep their state in data-NFT records, driven from source
 * through the shipped composer and derivation to a machine verdict and a validator decision.
 *
 * `A.f` runs on the entry the user reached, calls `B.g`, and `B.g` calls back into `A.k`, so `A` runs on two
 * masters while `B` runs on one. `A`'s one record is written by `A.f` segment 0, then by `A.k`, then by `A.f`
 * segment 1, so its declaration is chained across three frames; `B`'s record is written by `B.g` segment 0 and
 * again in segment 1, and `B` is its own single master, so it settles itself. Because `A` runs on two masters the
 * validator settles it and lists `A`'s record as the state input the transaction spends.
 *
 * Everything is shipped: the sources through `compileStringMulti` with the framed option, both programs through
 * the shipped deployment, the composer laying the two contracts' blocks out and assembling the caller, the masters
 * and the validator, and the derivation walking the call graph depth first. Each frame's code reads its record from
 * its own segment's declaration and closes against the commitment that segment declares, so a record written by
 * several frames in one transaction can be settled: the derivation completes callee first, every contract input is
 * accepted by the machine, and the validator's own decision accepts the transcript. The tests below also pin the
 * refusals that hold the declarations to the frames' own computations and to the transaction.
 *
 * The entry emits after its call returns, so the transaction is spec 5.2's output set complete: the six
 * participants' recreations at 0-5, the event at 6 and the user's change behind it at 7. A plan that leaves the
 * entry's own event unstated cannot be derived, which pins the event region to the block that declares it. The
 * validator input is a separate limit: the shipped program's operation cost on this shape is within 1% of the
 * density its own script sets, so the emitting shape's walk is refused by that limit, measured and pinned below.
 */

const CATEGORY_A = seededCategory('round trip stateful A');
const CATEGORY_B = seededCategory('round trip stateful B');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const ADDRESS_A = validatorAddress(CATEGORY_A, VALIDATOR_PROGRAM);
const ADDRESS_B = validatorAddress(CATEGORY_B, VALIDATOR_PROGRAM);
const CATEGORY_A_HEX = bytesToHex(CATEGORY_A);
const CATEGORY_B_HEX = bytesToHex(CATEGORY_B);
const USER_LOCK = new Uint8Array([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x22), 0x88, 0xac]);

const ENTRY_F = 'A.f()';
const ENTRY_K = 'A.k()';
const ENTRY_G = 'B.g()';
const A_FIRST = 'a-1';
const A_SECOND = 'a-2';
const B_MASTER = 'b-1';
const VALIDATOR_ID = 'validator';
const RECORD_A = 'record-a';
const RECORD_B = 'record-b';
const USER_ID = 'user';

// The layout is one block per contract: `A`'s masters, its validator and its record, then `B`'s master and its
// record, then the user. A participant recreates at its own index, so these are also the output indices.
const A_FIRST_INDEX = 0;
const B_MASTER_INDEX = 5;
const RECORD_A_INDEX = 4;
const RECORD_B_INDEX = 6;
// The two A masters, the validator, the facet it binds, A's record, B's master and B's record precede it.
const USER_INDEX = 7;
// The first output past the six participants, where the layout opens the trailing region: the same indices spec
// 5.2's worked transaction has, with the entry's event at 6 and the user's change behind it at 7.
const EVENT_INDEX = 7;
const CHANGE_INDEX = 8;

const F_SELECTOR = computeFunctionSelector(computeFunctionSignature('f', []));
const G_SELECTOR = computeFunctionSelector(computeFunctionSignature('g', []));
const K_SELECTOR = computeFunctionSelector(computeFunctionSignature('k', []));
const VALUE = 20_000n;

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IB { function g(); }'
  + ' interface IA { function k(); }'
  + ' contract B {'
  + '   int public total;'
  + '   function g() {'
  + '     this.total = this.total + 1;'
  + `     IA(0x${Buffer.from(ADDRESS_A).toString('hex')}).k.call();`
  + '     this.total = this.total + 1;'
  + '     require(this.total > 0);'
  + '   }'
  + ' }'
  + ' contract A {'
  + '   int public count;'
  + '   event Log(int value);'
  + '   function f() {'
  + '     this.count = this.count + 1;'
  + `     IB(0x${Buffer.from(ADDRESS_B).toString('hex')}).g.call();`
  + '     this.count = this.count + 1;'
  + '     emit Log(7);'
  + '     require(this.count > 0);'
  + '   }'
  + '   function k() {'
  + '     this.count = this.count + 1;'
  + '     require(this.count > 0);'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const aArtifact = artifacts.A!;
const bArtifact = artifacts.B!;

/** A data-NFT commitment holding one integer, in the shipped encoder's form. */
const recordA = (count: bigint): Uint8Array =>
  new Uint8Array(Buffer.from(buildPushdataCommitment(aArtifact.stateLayout!, { count }, 0), 'hex'));
const recordB = (total: bigint): Uint8Array =>
  new Uint8Array(Buffer.from(buildPushdataCommitment(bArtifact.stateLayout!, { total }, 0), 'hex'));

/** What `A`'s record holds as the transaction spends it, after each segment, and as it is written. */
const A_SPENT = recordA(5n);
const A_AFTER_F0 = recordA(6n);
const A_AFTER_K = recordA(7n);
const A_WRITTEN = recordA(8n);
/** What `B`'s record holds as the transaction spends it, after `B.g` segment 0, and as it is written. */
const B_SPENT = recordB(10n);
const B_AFTER_G0 = recordB(11n);
const B_WRITTEN = recordB(12n);

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmToken = NonNullable<VmProgram['sourceOutputs'][number]['token']>;

const empty = new Uint8Array(0);
const token = (
  category: Uint8Array,
  capability: 'minting' | 'mutable',
  commitmentBytes: Uint8Array = empty,
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment: commitmentBytes } });

/** A record kept in place, read where its index is and written where the chain leaves it. */
const kept = (record: number, viewIn: Uint8Array, viewOut: Uint8Array): RecordEntry =>
  ({ in: record, out: record, viewIn, viewOut });

/** The declarations a correctly chained round trip makes, one list per entry's segment. */
function segmentsOf(): {
  readonly aFirst: readonly (readonly RecordEntry[])[];
  readonly aSecond: readonly (readonly RecordEntry[])[];
  readonly bMaster: readonly (readonly RecordEntry[])[];
} {
  return {
    aFirst: [[kept(RECORD_A_INDEX, A_SPENT, A_AFTER_F0)], [kept(RECORD_A_INDEX, A_AFTER_K, A_WRITTEN)]],
    aSecond: [[kept(RECORD_A_INDEX, A_AFTER_F0, A_AFTER_K)]],
    bMaster: [[kept(RECORD_B_INDEX, B_SPENT, B_AFTER_G0)], [kept(RECORD_B_INDEX, B_AFTER_G0, B_WRITTEN)]],
  };
}

/**
 * The compiled, deployed and planned round trip.
 *
 * The plan supplies each segment's record declarations and the commitment the transaction writes for `A`'s record;
 * the composer supplies every coordinate, including the records' indices, which the segments name.
 */
function buildComposition(options: {
  readonly segments?: ReturnType<typeof segmentsOf>;
  readonly recordAWritten?: Uint8Array;
  /** Whether the plan states the event `A.f` emits. A plan that omits it leaves the entry's own event unlisted. */
  readonly event?: boolean;
} = {}): { plan: CompositionDraftPlan; artifacts: ReturnType<typeof compileStringMulti> } {
  const segments = options.segments ?? segmentsOf();
  const listsTheEvent = options.event ?? true;
  const a = deployMaster(aArtifact, CATEGORY_A, VALIDATOR_PROGRAM);
  const b = deployMaster(bArtifact, CATEGORY_B, VALIDATOR_PROGRAM);

  // `A` runs on two masters and `B` on one, so A's validator settles A while B settles itself. Every entry into
  // either contract points at that one validator, so it covers B without settling it.
  const validator = validatorSpend(CATEGORY_A, {
    roots: [0], masters: [0, 1, 4], settles: [{ category: CATEGORY_A, stateInputs: [RECORD_A_INDEX] }],
  });

  const facts = (
    contract: string, functionName: string, kind: number, mastersOfContract: number,
    makesExternalCall: boolean, callerIsUser: boolean,
  ): DraftMaster['facts'] => ({
    contract, functionName, kind, callerIsUser, originEqualsCaller: callerIsUser,
    makesExternalCall, mastersOfContract,
  });

  const aFirst: DraftMaster = {
    master: A_FIRST,
    contract: 'A',
    functionName: ENTRY_F,
    program: a.script,
    facts: facts('A', 'f', FrameKind.ROOT, 2, true, true),
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: ADDRESS_A, value: 0n },
    enteredBy: USER_ID,
    origin: USER_ID,
    calls: [{
      kind: FrameKind.CALL, callee: B_MASTER, target: ADDRESS_B, value: 0n, argumentPushes: [G_SELECTOR],
    }],
    retval: empty,
    segments: segments.aFirst,
    events: listsTheEvent ? [EVENT_INDEX] : [],
    sends: [],
    argumentPushes: [F_SELECTOR],
    redeemScript: a.script,
    dispatches: true,
  };
  const bMaster: DraftMaster = {
    master: B_MASTER,
    contract: 'B',
    functionName: ENTRY_G,
    program: b.script,
    facts: facts('B', 'g', FrameKind.CALL, 1, true, false),
    frame: { kind: FrameKind.CALL, sender: ADDRESS_A, self: ADDRESS_B, value: 0n },
    enteredBy: A_FIRST,
    origin: USER_ID,
    calls: [{
      kind: FrameKind.CALL, callee: A_SECOND, target: ADDRESS_A, value: 0n, argumentPushes: [K_SELECTOR],
    }],
    retval: empty,
    segments: segments.bMaster,
    events: [],
    sends: [],
    argumentPushes: [G_SELECTOR],
    redeemScript: b.script,
  };
  const aSecond: DraftMaster = {
    master: A_SECOND,
    contract: 'A',
    functionName: ENTRY_K,
    program: a.script,
    facts: facts('A', 'k', FrameKind.CALL, 2, false, false),
    frame: { kind: FrameKind.CALL, sender: ADDRESS_B, self: ADDRESS_A, value: 0n },
    enteredBy: B_MASTER,
    origin: USER_ID,
    calls: [],
    retval: empty,
    segments: segments.aSecond,
    events: [],
    sends: [],
    argumentPushes: [K_SELECTOR],
    redeemScript: a.script,
  };

  const masterSource = (
    lockingBytecode: Uint8Array,
    category: Uint8Array,
  ): { lockingBytecode: Uint8Array; valueSatoshis: bigint; token: ReturnType<typeof token> } =>
    ({ lockingBytecode, valueSatoshis: VALUE, token: token(category, 'minting') });

  const plan: CompositionDraftPlan = {
    blocks: [
      { contract: 'A', masters: [A_FIRST, A_SECOND], validator: { id: VALIDATOR_ID, settles: [] }, state: [RECORD_A] },
      { contract: 'B', masters: [B_MASTER], state: [RECORD_B] },
    ],
    userInputs: [{ id: USER_ID, index: USER_INDEX }],
    masters: [aFirst, bMaster, aSecond],
    inputs: {
      [A_FIRST]: { source: masterSource(a.lockingBytecode, CATEGORY_A) },
      [A_SECOND]: { source: masterSource(a.lockingBytecode, CATEGORY_A) },
      [B_MASTER]: { source: masterSource(b.lockingBytecode, CATEGORY_B) },
      [VALIDATOR_ID]: {
        source: { lockingBytecode: validator.lock, valueSatoshis: VALUE, token: token(CATEGORY_A, 'mutable') },
      },
      // Each record sits at its own contract's data-NFT covenant; the composed spend carries that covenant's
      // write-path unlocking with the index of a master of its category.
      [RECORD_A]: {
        source: {
          lockingBytecode: stateRecordLockingBytecode(CATEGORY_A_HEX), valueSatoshis: VALUE,
          token: token(CATEGORY_A, 'mutable', A_SPENT),
        },
        output: {
          lockingBytecode: stateRecordLockingBytecode(CATEGORY_A_HEX), valueSatoshis: VALUE,
          token: token(CATEGORY_A, 'mutable', options.recordAWritten ?? A_WRITTEN),
        },
        unlockingBytecode: stateRecordUnlockingBytecode(CATEGORY_A_HEX, A_FIRST_INDEX, 1),
      },
      [RECORD_B]: {
        source: {
          lockingBytecode: stateRecordLockingBytecode(CATEGORY_B_HEX), valueSatoshis: VALUE,
          token: token(CATEGORY_B, 'mutable', B_SPENT),
        },
        output: {
          lockingBytecode: stateRecordLockingBytecode(CATEGORY_B_HEX), valueSatoshis: VALUE,
          token: token(CATEGORY_B, 'mutable', B_WRITTEN),
        },
        unlockingBytecode: stateRecordUnlockingBytecode(CATEGORY_B_HEX, B_MASTER_INDEX, 1),
      },
      [USER_ID]: {
        source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
        unlockingBytecode: callerUnlockingBytecode(),
      },
    },
    // The entry emits after its call returns, so the plan states the event as the trailing output the layout opens
    // past the participants, in place of the payload the body computes.
    trailingOutputs: listsTheEvent
      ? [eventOutput(
        CATEGORY_A,
        aArtifact.events![0]!.signature,
        encodeEventCommitment(aArtifact.events![0]!.parameters, [7n]),
      )]
      : [],
    validator: {
      id: VALIDATOR_ID,
      covers: ['B'],
      // `A` runs on two masters, so its validator settles it and lists its record as the state input it spends.
      // `B` runs on one master and settles itself, so the transcript does not settle it.
      settles: [{ category: CATEGORY_A, stateInputs: [RECORD_A] }],
      redeemScript: validator.redeem,
    },
  };

  return { plan, artifacts };
}

const ROOT = { contract: 'A', functionName: ENTRY_F, kind: FrameKind.ROOT, master: A_FIRST };

function machine(): ReturnType<typeof createVirtualMachineBch2026> {
  return compositionMachine();
}

/** The machine's verdict on one input of the assembled transaction. */
function verdict(
  vm: ReturnType<typeof createVirtualMachineBch2026>,
  program: VmProgram,
  inputIndex: number,
): { accepted: boolean; objection?: string } {
  const state = vm.evaluate({ inputIndex, sourceOutputs: program.sourceOutputs, transaction: program.transaction });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

/** The composer's draft of one plan, before any derivation fills a witness. */
function compose(options: Parameters<typeof buildComposition>[0] = {}): {
  draft: CompositionDraft;
  plan: CompositionDraftPlan;
} {
  const { plan, artifacts: compiled } = buildComposition(options);
  const { draft } = createComposedDerivationHost({
    vm: compositionMachine(), artifacts: [compiled.A!, compiled.B!], plan });
  return { draft, plan };
}

/**
 * Drives the whole shipped path to completion and returns the finished draft and the derivation's result.
 */
function deriveFresh(options: Parameters<typeof buildComposition>[0] = {}): {
  draft: CompositionDraft;
  plan: CompositionDraftPlan;
  result: ReturnType<typeof deriveDepthFirst>;
} {
  const { plan, artifacts: compiled } = buildComposition(options);
  const { host, draft } = createComposedDerivationHost({
    vm: compositionMachine(), artifacts: [compiled.A!, compiled.B!], plan });
  const result = deriveDepthFirst(ROOT, host);
  return { draft, plan, result };
}

let derived: ReturnType<typeof deriveFresh> | undefined;

/** The default round trip, derived once: the cases that read it change nothing in it. */
function deriveRoundTrip(): ReturnType<typeof deriveFresh> {
  derived ??= deriveFresh();
  return derived;
}

/**
 * The assembled transaction as the validator's derivation models it.
 *
 * The machine reads a program, the derivation reads inputs and outputs. Nothing here decides anything; it only
 * re-states what the machine was handed, so the derivation can be asked about the bytes the machine ran.
 */
function toModel(program: VmProgram): FramedTransaction {
  const shape = (held: VmToken | undefined): TokenShape => (held === undefined
    ? { category: empty, capability: 0, hasNft: false, nftCommitment: empty, amount: 0n }
    : {
      category: held.category,
      capability: capabilityOf(held),
      hasNft: held.nft !== undefined,
      nftCommitment: held.nft?.commitment ?? empty,
      amount: held.amount,
    });
  return {
    inputs: program.transaction.inputs.map((input, index) => ({
      index,
      value: program.sourceOutputs[index]!.valueSatoshis,
      lockingBytecode: program.sourceOutputs[index]!.lockingBytecode,
      unlockingBytecode: input.unlockingBytecode,
      token: shape(program.sourceOutputs[index]!.token),
      outpointTransactionHash: input.outpointTransactionHash,
      outpointIndex: input.outpointIndex,
    })),
    outputs: program.transaction.outputs.map((output, index) => ({
      index, value: output.valueSatoshis, lockingBytecode: output.lockingBytecode, token: shape(output.token),
    })),
  };
}

/** The capability number the derivation uses for the machine's token. */
function capabilityOf(held: VmToken): number {
  if (held.nft?.capability === 'minting') return 2;
  if (held.nft?.capability === 'mutable') return 1;
  return 0;
}

describe('a two-contract round trip where both contracts keep records', () => {
  it('publishes a state layout and a framed descriptor for both contracts', () => {
    expect(aArtifact.composition?.convention).toBe('framed');
    expect(bArtifact.composition?.convention).toBe('framed');
    expect(aArtifact.stateLayout).toBeTruthy();
    expect(bArtifact.stateLayout).toBeTruthy();
    expect(deployMaster(aArtifact, CATEGORY_A, VALIDATOR_PROGRAM).script.length).toBeGreaterThan(0);
    expect(deployMaster(bArtifact, CATEGORY_B, VALIDATOR_PROGRAM).script.length).toBeGreaterThan(0);
  });

  it('lays each record out away from the master that reads it, at the index the segments name', () => {
    const { draft } = compose();
    expect(participant(draft.layout, A_FIRST).index).toBe(0);
    expect(participant(draft.layout, A_SECOND).index).toBe(1);
    expect(participant(draft.layout, VALIDATOR_ID).index).toBe(2);
    expect(participant(draft.layout, RECORD_A).index).toBe(RECORD_A_INDEX);
    expect(participant(draft.layout, B_MASTER).index).toBe(5);
    expect(participant(draft.layout, RECORD_B).index).toBe(RECORD_B_INDEX);
    expect(draft.blockOf(A_FIRST).segments.map((segment) => segment.map((entry) => entry.in)))
      .toStrictEqual([[RECORD_A_INDEX], [RECORD_A_INDEX]]);
    expect(draft.blockOf(A_SECOND).segments.map((segment) => segment.map((entry) => entry.in)))
      .toStrictEqual([[RECORD_A_INDEX]]);
    expect(draft.blockOf(B_MASTER).segments.map((segment) => segment.map((entry) => entry.in)))
      .toStrictEqual([[RECORD_B_INDEX], [RECORD_B_INDEX]]);
  });

  it('derives the round trip depth first, each callee before its caller', () => {
    const { result } = deriveRoundTrip();
    // The entry's call reaches `B.g`, whose call reaches the re-entered `A.k`; each callee completes before the
    // execution that called it resumes.
    expect(result.completed.map((frame) => frame.master)).toStrictEqual([A_SECOND, B_MASTER, A_FIRST]);
  });

  it('accepts every contract input', () => {
    const { draft } = deriveRoundTrip();
    const vm = machine();
    const program = draft.programFor(A_FIRST);
    const at = (id: string): { accepted: boolean; objection?: string } =>
      verdict(vm, program, participant(draft.layout, id).index);
    expect(at(A_FIRST).objection ?? 'accepted').toBe('accepted');
    expect(at(A_SECOND).objection ?? 'accepted').toBe('accepted');
    expect(at(B_MASTER).objection ?? 'accepted').toBe('accepted');
    // Each record is spent under its own contract's data-NFT covenant, whose script the machine evaluates.
    expect(at(RECORD_A).objection ?? 'accepted').toBe('accepted');
    expect(at(RECORD_B).objection ?? 'accepted').toBe('accepted');
  });

  it('is accepted at the validator input on the composition profile', () => {
    // The validator input carries the program and the transcript in one unlocking bytecode, so this asserts what
    // the shipped program decides about the shape rather than what a real chain's size budget allows: the suites
    // run on the profile the plan's gate is stated against, and the real-chain numbers are recorded by the
    // validator suite's published-density measurement. The padding block the program carries exists for that
    // density - a byte of the input's own unlocking bytecode buys 800 operation-cost units, and the block is what
    // pays for the walk over the covered masters on the emitting shape.
    const { draft } = deriveRoundTrip();
    const verdictAt = verdict(machine(), draft.programFor(A_FIRST), participant(draft.layout, VALIDATOR_ID).index);
    expect(verdictAt.objection ?? '').toBe('');
    expect(verdictAt.accepted).toBe(true);
  });

  it('lays the emitted event and the user\'s change at the outputs past the participants', () => {
    // Spec 5.2's set complete: the event at 6, the first output the layout opens past the six participants, and
    // the funder's change behind it at 7.
    const { draft, plan } = deriveRoundTrip();
    const outputs = draft.programFor(A_FIRST).transaction.outputs;
    const event = outputs[EVENT_INDEX]!;

    expect(outputs.length).toBe(CHANGE_INDEX + 1);
    expect(event).toStrictEqual(plan.trailingOutputs![0]);
    expect(event.token?.category).toStrictEqual(CATEGORY_A);
    expect(event.token?.nft?.capability).toBe('none');
    expect(event.token?.nft?.commitment)
      .toStrictEqual(encodeEventCommitment(aArtifact.events![0]!.parameters, [7n]));
    expect(draft.blockOf(A_FIRST).events).toStrictEqual([EVENT_INDEX]);

    const change = outputs[CHANGE_INDEX]!;
    expect(change.lockingBytecode).toStrictEqual(USER_LOCK);
    expect(change.token).toBeUndefined();
  });

  it('cannot derive a plan that leaves the emitting entry\'s event unstated', () => {
    // The entry pins the list the block declares to the events its own source emits, so the plan has to state the
    // output that carries them: with none stated the entry's own program refuses and the derivation, which asks the
    // program, cannot fill its first site.
    const { plan, artifacts: compiled } = buildComposition({ event: false });
    const { host } = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: [compiled.A!, compiled.B!], plan });
    expect(() => deriveDepthFirst(ROOT, host)).toThrowError(/FRAMED_DERIVATION_STALLED/);
  });

  it('recreates every participant and leaves each record where its last declaration wrote it', () => {
    const { draft } = deriveRoundTrip();
    const program = draft.programFor(A_FIRST);
    const indexOf = (id: string): number => participant(draft.layout, id).index;
    const outputAt = (id: string): NonNullable<VmProgram['transaction']>['outputs'][number] =>
      program.transaction.outputs[indexOf(id)]!;

    // A master and the validator are recreated in place: the same lock and the same token shape, the master still
    // holding the minting NFT of its own category.
    for (const id of [A_FIRST, A_SECOND, B_MASTER, VALIDATOR_ID]) {
      const source = program.sourceOutputs[indexOf(id)]!;
      expect(outputAt(id).lockingBytecode).toStrictEqual(source.lockingBytecode);
      expect(outputAt(id).token?.category).toStrictEqual(source.token?.category);
      expect(outputAt(id).token?.nft?.capability).toBe(source.token?.nft?.capability);
    }

    // A record's output carries the commitment the last frame to write it declared, which is the end of the chain
    // the settlement walks: `A`'s record is written by the entry twice and by the re-entered entry between them.
    for (const [record, master] of [[RECORD_A, A_FIRST], [RECORD_B, B_MASTER]] as const) {
      const written = draft.blockOf(master).segments.flat().filter((entry) => entry.out !== INDEX_NONE);
      expect(written.length).toBeGreaterThan(0);
      expect(outputAt(record).token?.nft?.commitment).toStrictEqual(written.at(-1)!.viewOut);
    }
  });

  it('decides the same transaction accepted, every check accepted in the spec order', () => {
    const { draft } = deriveRoundTrip();
    const decision = decideValidator(toModel(draft.programFor(A_FIRST)), {
      validatorTemplate: VALIDATOR_PROGRAM,
      validatorInputIndex: participant(draft.layout, VALIDATOR_ID).index,
    });

    expect(decision.outcomes.map((outcome) => `${outcome.check}:${outcome.status}`)).toStrictEqual([
      'V1:accepted', 'V2:accepted', 'V3:accepted', 'V4:accepted', 'V5:accepted', 'V6:accepted',
      'V7:accepted', 'V8:accepted', 'V9:accepted', 'V10:accepted', 'V11:accepted',
    ]);
    // The entry's first segment, the callee's, the re-entered entry, the callee's second segment, then the
    // entry's. `B` has one master, so its single settlement is its own.
    const at = (master: string): number => participant(draft.layout, master).index;
    expect((decision.order ?? []).map((step) => `(${step.master},${step.segment})`))
      .toStrictEqual([`(${at(A_FIRST)},0)`, `(${at(B_MASTER)},0)`, `(${at(A_SECOND)},0)`,
        `(${at(B_MASTER)},1)`, `(${at(A_FIRST)},1)`]);
  });

  it('refuses a frame whose computed commitment is not its segment\'s declared viewOut', () => {
    // The re-entered entry's one segment declares the record ending at `7`, which its own code computes. Declaring
    // `8` there while the code still computes `7` makes the master refuse, even though every other check holds.
    const at = (second: readonly RecordEntry[]): { accepted: boolean; objection?: string } => {
      const segments = segmentsOf();
      const { plan, artifacts: compiled } = buildComposition({ segments: { ...segments, aSecond: [second] } });
      const { draft } = createComposedDerivationHost({
        vm: compositionMachine(), artifacts: [compiled.A!, compiled.B!], plan });
      return verdict(machine(), draft.programFor(A_SECOND), participant(draft.layout, A_SECOND).index);
    };
    expect(at([kept(RECORD_A_INDEX, A_AFTER_F0, A_AFTER_K)]).objection ?? 'accepted').toBe('accepted');
    const wrong = at([kept(RECORD_A_INDEX, A_AFTER_F0, A_WRITTEN)]);
    expect(wrong.accepted).toBe(false);
    expect(wrong.objection).toContain('OP_VERIFY');
  });

  it('refuses a frame whose read is not its segment\'s declared viewIn', () => {
    // The re-entered entry reads the record from its own segment's declaration. Declaring the record still spent at
    // `5` makes its code compute `6`, which is not the `7` the segment declares it left.
    const at = (second: readonly RecordEntry[]): { accepted: boolean; objection?: string } => {
      const segments = segmentsOf();
      const { plan, artifacts: compiled } = buildComposition({ segments: { ...segments, aSecond: [second] } });
      const { draft } = createComposedDerivationHost({
        vm: compositionMachine(), artifacts: [compiled.A!, compiled.B!], plan });
      return verdict(machine(), draft.programFor(A_SECOND), participant(draft.layout, A_SECOND).index);
    };
    expect(at([kept(RECORD_A_INDEX, A_AFTER_F0, A_AFTER_K)]).objection ?? 'accepted').toBe('accepted');
    expect(at([kept(RECORD_A_INDEX, A_SPENT, A_AFTER_K)]).accepted).toBe(false);
  });

  it('refuses a standalone master whose last declaration is not the transaction\'s output', () => {
    // `B` runs on one master, so it settles its own record and the head holds its last declared viewOut to the
    // transaction's output at the record's index. The declarations and the body agree on `12`; a transaction that
    // writes `11` there is refused by the settlement the master runs itself, not by the body's own close.
    const { draft } = deriveRoundTrip();
    const program = draft.programFor(B_MASTER);
    const index = participant(draft.layout, B_MASTER).index;
    expect(verdict(machine(), program, index).objection ?? 'accepted').toBe('accepted');
    const written = program.transaction.outputs.map((output, at) => (at === RECORD_B_INDEX
      ? { ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment: B_AFTER_G0 } } }
      : output));
    const wrong = verdict(machine(), {
      ...program, transaction: { ...program.transaction, outputs: written },
    }, index);
    expect(wrong.accepted).toBe(false);
    expect(wrong.objection).toContain('OP_VERIFY');
  });

  it('refuses the settlement when a later segment does not carry on from the one before it', () => {
    // Every segment is internally consistent and every commitment the transaction spends or writes is unchanged;
    // the control replaces the entry's first record declaration with one the re-entered entry's write does not
    // continue from, which only the settlement walk compares.
    const { draft, plan } = deriveRoundTrip();
    const model = toModel(draft.programFor(A_FIRST));
    const master = plan.masters.find((candidate) => candidate.master === A_FIRST)!;
    const block = structuredClone(draft.blockOf(A_FIRST)) as WitnessBlock;
    block.segments[0] = [kept(RECORD_A_INDEX, A_SPENT, A_AFTER_K)];
    block.segments[1] = [kept(RECORD_A_INDEX, A_AFTER_K, A_AFTER_K)];
    (model.inputs[participant(draft.layout, A_FIRST).index]! as { unlockingBytecode: Uint8Array }).unlockingBytecode =
      buildMasterUnlockingBytecode(block, master.argumentPushes, master.redeemScript);
    (model.outputs[participant(draft.layout, RECORD_A).index]!.token as { nftCommitment: Uint8Array }).nftCommitment =
      A_AFTER_K;

    const decision = decideValidator(model, {
      validatorTemplate: VALIDATOR_PROGRAM,
      validatorInputIndex: participant(draft.layout, VALIDATOR_ID).index,
    });
    expect(decision.outcomes.map((outcome) => `${outcome.check}:${outcome.status}`)).toContain('V7:rejected');
    expect(decision.rejection?.reason).toBe('V7_CHAIN_BROKEN');
  });
});
