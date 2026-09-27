import { describe, expect, it } from 'vitest';
import { createVirtualMachineBch2026, encodeDataPush } from '@bitauth/libauth';
import {
  FrameKind,
  buildMasterUnlockingBytecode,
  buildPushdataCommitment,
  computeFunctionSelector,
  computeFunctionSignature,
  validatorAddress,
  type RecordEntry,
  type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import {
  decideValidator, type PerCallTransaction, type TokenShape,
} from '../../../../solidc/src/per-call/validator/index.js';
import { deployMaster } from '../../../src/per-call/deploy/index.js';
import {
  createComposedDerivationHost,
  deriveDepthFirst,
  participant,
  type CompositionDraft,
  type CompositionDraftPlan,
  type DraftMaster,
} from '../../../src/per-call/composer/index.js';
import { callerUnlockingBytecode } from '../../../../solidc/test/per-call/master/caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory, validatorSpend,
} from '../../../../solidc/test/per-call/master/validator-input.js';

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
 * Everything is shipped: the sources through `compileStringMulti` with the per-call option, both programs through
 * the shipped deployment, the composer laying the two contracts' blocks out and assembling the caller, the masters
 * and the validator, and the derivation walking the call graph depth first. What the composition produces is
 * accepted by the validator decision and by the machine on the validator input and on `B`'s master. The masters
 * that write `A`'s record are where the shipped path stops: each of them compares the whole commitment it
 * reconstructs against the transaction output at the record's index, and only one output can carry one value, so a
 * frame whose write is not the transaction's last write of that record cannot accept. The tests below pin that
 * refusal by name rather than passing over it.
 */

const CATEGORY_A = seededCategory('round trip stateful A');
const CATEGORY_B = seededCategory('round trip stateful B');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const ADDRESS_A = validatorAddress(CATEGORY_A, VALIDATOR_PROGRAM);
const ADDRESS_B = validatorAddress(CATEGORY_B, VALIDATOR_PROGRAM);
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
const RECORD_A_INDEX = 3;
const RECORD_B_INDEX = 5;
const USER_INDEX = 6;

const F_SELECTOR = computeFunctionSelector(computeFunctionSignature('f', []));
const G_SELECTOR = computeFunctionSelector(computeFunctionSignature('g', []));
const K_SELECTOR = computeFunctionSelector(computeFunctionSignature('k', []));
const VALUE = 20_000n;

const SOURCE = 'pragma solidcash ^0.13.0;'
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
  + '   function f() {'
  + '     this.count = this.count + 1;'
  + `     IB(0x${Buffer.from(ADDRESS_B).toString('hex')}).g.call();`
  + '     this.count = this.count + 1;'
  + '     require(this.count > 0);'
  + '   }'
  + '   function k() {'
  + '     this.count = this.count + 1;'
  + '     require(this.count > 0);'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
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
} = {}): { plan: CompositionDraftPlan; artifacts: ReturnType<typeof compileStringMulti> } {
  const segments = options.segments ?? segmentsOf();
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
    events: [],
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
      [RECORD_A]: {
        source: { lockingBytecode: USER_LOCK, valueSatoshis: VALUE, token: token(CATEGORY_A, 'mutable', A_SPENT) },
        output: {
          lockingBytecode: USER_LOCK, valueSatoshis: VALUE,
          token: token(CATEGORY_A, 'mutable', options.recordAWritten ?? A_WRITTEN),
        },
        unlockingBytecode: encodeDataPush(new Uint8Array([1])),
      },
      [RECORD_B]: {
        source: { lockingBytecode: USER_LOCK, valueSatoshis: VALUE, token: token(CATEGORY_B, 'mutable', B_SPENT) },
        output: {
          lockingBytecode: USER_LOCK, valueSatoshis: VALUE,
          token: token(CATEGORY_B, 'mutable', B_WRITTEN),
        },
        unlockingBytecode: encodeDataPush(new Uint8Array([1])),
      },
      [USER_ID]: {
        source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
        unlockingBytecode: callerUnlockingBytecode(),
      },
    },
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
  return createVirtualMachineBch2026({
    operationCostBudgetPerByte: 10_000_000,
    hashDigestIterationsPerByte: 10_000_000,
  });
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
  const { draft } = createComposedDerivationHost({ artifacts: [compiled.A!, compiled.B!], plan });
  return { draft, plan };
}

/**
 * Drives the whole shipped path and returns the draft as far as it got.
 *
 * The derivation fills `A.f`'s call and, inside it, `B.g`'s call; the re-entered master is then what stops it.
 */
function driveUntilStall(): { draft: CompositionDraft; plan: CompositionDraftPlan; error: Error } {
  const { plan, artifacts: compiled } = buildComposition();
  const { host, draft } = createComposedDerivationHost({ artifacts: [compiled.A!, compiled.B!], plan });
  try {
    deriveDepthFirst(ROOT, host);
  } catch (error) {
    return { draft, plan, error: error as Error };
  }
  throw new Error('the derivation was expected to stop on the re-entered master');
}

/**
 * The assembled transaction as the validator's derivation models it.
 *
 * The machine reads a program, the derivation reads inputs and outputs. Nothing here decides anything; it only
 * re-states what the machine was handed, so the derivation can be asked about the bytes the machine ran.
 */
function toModel(program: VmProgram): PerCallTransaction {
  const shape = (token: VmToken | undefined): TokenShape => (token === undefined
    ? { category: empty, capability: 0, hasNft: false, nftCommitment: empty, amount: 0n }
    : {
      category: token.category,
      capability: capabilityOf(token),
      hasNft: token.nft !== undefined,
      nftCommitment: token.nft?.commitment ?? empty,
      amount: token.amount,
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
function capabilityOf(token: VmToken): number {
  if (token.nft?.capability === 'minting') return 2;
  if (token.nft?.capability === 'mutable') return 1;
  return 0;
}

describe('a two-contract round trip where both contracts keep records', () => {
  it('publishes a state layout and a per-call descriptor for both contracts', () => {
    expect(aArtifact.composition?.convention).toBe('per-call');
    expect(bArtifact.composition?.convention).toBe('per-call');
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
    expect(participant(draft.layout, B_MASTER).index).toBe(4);
    expect(participant(draft.layout, RECORD_B).index).toBe(RECORD_B_INDEX);
    expect(draft.blockOf(A_FIRST).segments.map((segment) => segment.map((entry) => entry.in)))
      .toStrictEqual([[RECORD_A_INDEX], [RECORD_A_INDEX]]);
    expect(draft.blockOf(A_SECOND).segments.map((segment) => segment.map((entry) => entry.in)))
      .toStrictEqual([[RECORD_A_INDEX]]);
    expect(draft.blockOf(B_MASTER).segments.map((segment) => segment.map((entry) => entry.in)))
      .toStrictEqual([[RECORD_B_INDEX], [RECORD_B_INDEX]]);
  });

  it('reaches the re-entered master and stops on its record write', () => {
    const { error } = driveUntilStall();
    expect(error.name).toBe('PerCallComposerError');
    expect(error.message).toContain('PER_CALL_DERIVATION_STALLED');
    expect(error.message).toContain(`master "${A_SECOND}" of ${ENTRY_K}`);
    expect(error.message).toContain('site 0 (close of segment 0)');
  });

  it('refuses a master whose record write is not the commitment the transaction writes', () => {
    // The re-entered master's own code computes `5 + 1` from the record it spends and reconstructs that whole
    // commitment. The transaction's record output is the only thing the two runs below change: when it carries
    // what the code computed the master accepts, and when it carries the value the frame that writes last leaves
    // it refuses, so one output cannot carry both writes.
    const at = (recordAWritten: Uint8Array): { accepted: boolean; objection?: string } => {
      const { draft } = compose({ recordAWritten });
      const program = draft.programFor(A_SECOND);
      return verdict(machine(), program, participant(draft.layout, A_SECOND).index);
    };
    const mine = at(A_AFTER_F0);
    expect(mine.objection ?? 'accepted').toBe('accepted');
    const chained = at(A_WRITTEN);
    expect(chained.accepted).toBe(false);
    // The refusal is the reconstructed commitment failing its check, not a witness the derivation still owed.
    expect(chained.objection).toContain('OP_VERIFY');
  });

  it('accepts the composed declarations and the validator input, so the refusal is the masters\'', () => {
    const { draft } = driveUntilStall();
    const vm = machine();
    const program = draft.programFor(A_FIRST);
    const at = (id: string): { accepted: boolean; objection?: string } =>
      verdict(vm, program, participant(draft.layout, id).index);

    // The validator's own program accepts the transcript the composer assembled, and `B`'s single master settles
    // its own record across its two segments. Only the two `A` masters refuse, because each of them would have to
    // see the whole transaction carrying its own write.
    expect(at(VALIDATOR_ID).objection ?? 'accepted').toBe('accepted');
    expect(at(B_MASTER).objection ?? 'accepted').toBe('accepted');
    // Each `A` master reconstructs the whole record and requires the transaction's output to carry it; the two
    // failures are that check, not a callee the derivation had not reached yet.
    expect(at(A_FIRST).accepted).toBe(false);
    expect(at(A_FIRST).objection).toContain('OP_VERIFY');
    expect(at(A_SECOND).accepted).toBe(false);
    expect(at(A_SECOND).objection).toContain('OP_VERIFY');
  });

  it('decides the same transaction accepted, so the chained declarations are not what the masters refuse', () => {
    const { draft } = driveUntilStall();
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

  it('refuses the settlement when a later segment does not carry on from the one before it', () => {
    // Every segment is internally consistent and every commitment the transaction spends or writes is unchanged;
    // the control replaces the entry's first record declaration with one the re-entered entry's write does not
    // continue from, which only the settlement walk compares.
    const { draft, plan } = driveUntilStall();
    const model = toModel(draft.programFor(A_FIRST));
    const master = plan.masters.find((candidate) => candidate.master === A_FIRST)!;
    const block = structuredClone(draft.blockOf(A_FIRST)) as WitnessBlock;
    block.segments[0] = [kept(RECORD_A_INDEX, A_SPENT, A_AFTER_K)];
    block.segments[1] = [kept(RECORD_A_INDEX, A_AFTER_K, A_AFTER_K)];
    model.inputs[participant(draft.layout, A_FIRST).index]!.unlockingBytecode =
      buildMasterUnlockingBytecode(block, master.argumentPushes, master.redeemScript);
    model.outputs[participant(draft.layout, RECORD_A).index]!.token.nftCommitment = A_AFTER_K;

    const decision = decideValidator(model, {
      validatorTemplate: VALIDATOR_PROGRAM,
      validatorInputIndex: participant(draft.layout, VALIDATOR_ID).index,
    });
    expect(decision.outcomes.map((outcome) => `${outcome.check}:${outcome.status}`)).toContain('V7:rejected');
    expect(decision.rejection?.reason).toBe('V7_CHAIN_BROKEN');
  });
});
