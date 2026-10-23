import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2sh32, hash256 } from '@bitauth/libauth';
import { layoutWithFacets } from './harness.js';
import {
  FrameKind,
  buildEntryNftCovenantScript,
  buildPushdataCommitment,
  bytesToHex,
  computeCollectionHash,
  encodeIntegerValue,
  encodeResultList,
  scriptToBytecode,
  type FrameKindValue,
} from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import {
  stateRecordLockingBytecode,
  stateRecordUnlockingBytecode,
} from '../../../src/framed/deploy/index.js';
import {
  layOutMappingWrites,
  participant,
  planMappingWrite,
  type CompositionDraftPlan,
  type DraftMaster,
  type MappingNodePlacement,
} from '../../../src/framed/composer/index.js';
import {
  encodeEntryCommitment,
  keyToSlotMulti,
} from '../../../src/stateful/SortedList.js';
import { createUnlockingBytecode } from '../../../src/utils.js';
import { encodeFunctionArgument } from '../../../src/Argument.js';
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
 * A user-entered root calls a judge's entry; the judge reads an escrow's state, gates on the transaction's own
 * block time and then calls the escrow's own `challenge`.
 *
 * The root is entered by the user and calls `Judge.gate`. The judge reads the escrow's recorded payment block
 * through the escrow's read-only `Escrow.paidAt()` entry, which is a `STATIC` call, requires the transaction's
 * locktime to be strictly after that block with the language's own time form, `require(tx.time >= paidAt + 1)` so
 * the compiler emits the check, and then calls `Escrow.challenge()`.
 *
 * The escrow's recorded payment block and the count `challenge` writes are two entries of two mappings, so the
 * read frame resolves one node and the write frame rewrites another; both are records of the same contract, settled
 * by one validator. Every coordinate comes from `layoutTransaction`/`participant`, every commitment from the shipped
 * mapping planner, and every verdict from the BCH-2026 machine: the compiler, `deployMaster`, the composer, the
 * derivation and the machine all run.
 *
 * Time on this convention is the transaction's nLocktime, fixed once in the plan, so the judge's gate and the
 * refusals below move only that one number. The last case drives the same composition over one data-NFT state
 * record instead of two mapping nodes, and records where that geometry stands.
 */

const ROOT_LABEL = 'time gated challenge root';
const JUDGE_LABEL = 'time gated challenge judge';
const ESCROW_LABEL = 'time gated challenge escrow';
const JUDGE_ADDRESS = hexOf(seededAddress(JUDGE_LABEL));
const ESCROW_ADDRESS = hexOf(seededAddress(ESCROW_LABEL));

const RECORD_ID = 'record';
const PAY_NODE_ID = 'payments';
const CHALLENGE_NODE_ID = 'challenges';
const VALIDATOR_ID = 'validator';
const USER_ID = 'user';
const ROOT_MASTER = 'root-1';
const JUDGE_MASTER = 'judge-1';
const PAID_AT_MASTER = 'paidAt-1';
const CHALLENGE_MASTER = 'challenge-1';

/** The escrow's recorded payment block, a compile-time constant of this test, and the count `challenge` writes. */
const PAYMENT_BLOCK = 1000n;
const PAYMENT_KEY = 1n;
const CHALLENGE_KEY = 2n;
const CHALLENGE_COUNT_BEFORE = 0n;
const CHALLENGE_COUNT_AFTER = 1n;
const ZERO_SLOT = new Uint8Array(32);

/** The plan's locktime: the block strictly after the payment, and a sequence that lets `OP_CHECKLOCKTIMEVERIFY` run. */
const LOCKTIME_AFTER_PAYMENT = Number(PAYMENT_BLOCK) + 1;
const NON_FINAL_SEQUENCE = 0xfffffffe;

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IJudge { function gate(); }'
  + ' interface IEscrow {'
  + '   function paidAt() view returns (int);'
  + '   function challenge();'
  + ' }'
  + ' contract Root {'
  + `   function enter() { IJudge(0x${JUDGE_ADDRESS}).gate(); require(true); }`
  + ' }'
  + ' contract Judge {'
  + '   function gate() {'
  + `     int paidAtBlock = IEscrow(0x${ESCROW_ADDRESS}).paidAt();`
  + '     require(tx.time >= paidAtBlock + 1);'
  + `     IEscrow(0x${ESCROW_ADDRESS}).challenge();`
  + '     require(true);'
  + '   }'
  + ' }'
  + ' contract Escrow {'
  + '   mapping(int => int) payments;'
  + '   mapping(int => int) challenges;'
  + '   function paidAt() view returns (int) { return this.payments[1]; }'
  + '   function challenge() { this.challenges[2] = this.challenges[2] + 1; require(true); }'
  + ' }';

const built = compileAndDeploy(SOURCE, {
  Root: ROOT_LABEL, Judge: JUDGE_LABEL, Escrow: ESCROW_LABEL,
});
const ROOT_DEPLOYED = built.contracts.Root!;
const JUDGE_DEPLOYED = built.contracts.Judge!;
const ESCROW_DEPLOYED = built.contracts.Escrow!;

/** The payments mapping's node: the recorded payment block, one entry that no frame writes. */
const PAY_SLOT = keyToSlotMulti([encodeIntegerValue(PAYMENT_KEY)]);
const PAY_NODE = encodeEntryCommitment(PAY_SLOT, ZERO_SLOT, encodeIntegerValue(PAYMENT_BLOCK));

/** The challenges mapping's node: the count `challenge` rewrites, from the shipped mapping planner. */
const CHALLENGE_KEY_PUSH = encodeIntegerValue(CHALLENGE_KEY);
const CHALLENGE_SLOT = keyToSlotMulti([CHALLENGE_KEY_PUSH]);
const CHALLENGE_WRITE = planMappingWrite({
  keys: [CHALLENGE_KEY_PUSH], value: CHALLENGE_COUNT_AFTER, inventory: [
    encodeEntryCommitment(CHALLENGE_SLOT, ZERO_SLOT, encodeIntegerValue(CHALLENGE_COUNT_BEFORE)),
  ],
  encodeValue: (value) => encodeIntegerValue(value),
});
const CHALLENGE_NODE_BEFORE = encodeEntryCommitment(CHALLENGE_SLOT, ZERO_SLOT, encodeIntegerValue(CHALLENGE_COUNT_BEFORE));
const CHALLENGE_NODE_AFTER = CHALLENGE_WRITE.written[0]!.after;

/** One mapping's node covenant, and the `<masterInputIndex> <flag>` unlocking that authorizes its spend. */
interface NodeCovenant {
  readonly lock: Uint8Array;
  readonly unlock: (masterInputIndex: number, flag: bigint) => Uint8Array;
}
function collectionLock(collection: string): NodeCovenant {
  const info = built.artifacts.Escrow!.stateLayout!.collections!.find((entry) => entry.name === collection)!;
  const redeem = scriptToBytecode(
    buildEntryNftCovenantScript(ESCROW_DEPLOYED.category, computeCollectionHash(info.signature)));
  return {
    lock: encodeLockingBytecodeP2sh32(hash256(redeem)),
    unlock: (masterInputIndex, flag) => createUnlockingBytecode('p2sh32', redeem, [
      encodeFunctionArgument(flag, 'bigint') as Uint8Array,
      encodeFunctionArgument(BigInt(masterInputIndex), 'bigint') as Uint8Array,
    ]),
  };
}
const PAYMENTS = collectionLock('payments');
const CHALLENGES = collectionLock('challenges');

/** The plan: the root, the judge, the escrow's read frame and write frame, the validator and the two records. */
function buildPlan(locktime: number): {
  readonly plan: CompositionDraftPlan;
  readonly payIndex: number;
  readonly challengeNodeIndex: number;
  readonly judgeIndex: number;
} {
  const validator = validatorFor(ROOT_DEPLOYED.category);
  const gateSelector = selectorOf(built.artifacts, 'Judge', 'gate');
  const paidAtSelector = selectorOf(built.artifacts, 'Escrow', 'paidAt');
  const challengeSelector = selectorOf(built.artifacts, 'Escrow', 'challenge');

  const blocks: CompositionDraftPlan['blocks'] = [
    { contract: 'Root', masters: [ROOT_MASTER], validator: { id: VALIDATOR_ID, settles: [] }, state: [] },
    { contract: 'Judge', masters: [JUDGE_MASTER], state: [] },
    {
      contract: 'Escrow', masters: [PAID_AT_MASTER, CHALLENGE_MASTER],
      state: [PAY_NODE_ID, CHALLENGE_NODE_ID],
    },
  ];
  const layout = layoutWithFacets(blocks);
  const payIndex = participant(layout, PAY_NODE_ID).index;
  const challengeNodeIndex = participant(layout, CHALLENGE_NODE_ID).index;
  const challengeIndex = participant(layout, CHALLENGE_MASTER).index;
  const paidAtIndex = participant(layout, PAID_AT_MASTER).index;
  const judgeIndex = participant(layout, JUDGE_MASTER).index;
  const participantCount = layout.participantCount;

  const escrowMaster = (entry: 'paidAt' | 'challenge', kind: FrameKindValue): DraftMaster => master({
    master: entry === 'paidAt' ? PAID_AT_MASTER : CHALLENGE_MASTER,
    contract: 'Escrow', entry, program: ESCROW_DEPLOYED.program,
    facts: {
      contract: 'Escrow', functionName: entry, kind,
      callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 2,
    },
    frame: { kind, sender: JUDGE_DEPLOYED.address, self: ESCROW_DEPLOYED.address, value: 0n },
    enteredBy: JUDGE_MASTER, origin: USER_ID,
    argumentPushes: [selectorOf(built.artifacts, 'Escrow', entry)],
  });

  const rootMaster = master({
    master: ROOT_MASTER, contract: 'Root', entry: 'enter', program: ROOT_DEPLOYED.program,
    facts: {
      contract: 'Root', functionName: 'enter', kind: FrameKind.ROOT,
      callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: ROOT_DEPLOYED.address, value: 0n },
    enteredBy: USER_ID, origin: USER_ID,
    calls: [{
      kind: FrameKind.CALL, callee: JUDGE_MASTER, target: JUDGE_DEPLOYED.address, value: 0n,
      argumentPushes: [gateSelector],
    }],
  });
  const judgeMaster = master({
    master: JUDGE_MASTER, contract: 'Judge', entry: 'gate', program: JUDGE_DEPLOYED.program,
    facts: {
      contract: 'Judge', functionName: 'gate', kind: FrameKind.CALL,
      callerIsUser: false, originEqualsCaller: false, makesExternalCall: true, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.CALL, sender: ROOT_DEPLOYED.address, self: JUDGE_DEPLOYED.address, value: 0n },
    enteredBy: ROOT_MASTER, origin: USER_ID,
    argumentPushes: [gateSelector],
    calls: [
      {
        kind: FrameKind.STATIC, callee: PAID_AT_MASTER, target: ESCROW_DEPLOYED.address, value: 0n,
        argumentPushes: [paidAtSelector],
      },
      {
        kind: FrameKind.CALL, callee: CHALLENGE_MASTER, target: ESCROW_DEPLOYED.address, value: 0n,
        argumentPushes: [challengeSelector],
      },
    ],
  });

  const placements = new Map<string, MappingNodePlacement>([
    [bytesToHex(CHALLENGE_SLOT), { in: challengeNodeIndex, out: challengeNodeIndex }],
  ]);
  const writeSegment = layOutMappingWrites([[CHALLENGE_WRITE]], {
    placementOf: (candidate) => placements.get(bytesToHex(candidate)),
  })[0]!;

  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: userInputs([USER_ID], participantCount),
    masters: [
      rootMaster,
      judgeMaster,
      {
        // The read frame resolves the payments node where its own segment declares it, and leaves it.
        ...escrowMaster('paidAt', FrameKind.STATIC),
        retval: encodeResultList([encodeIntegerValue(PAYMENT_BLOCK)]),
        segments: [[{ in: payIndex, out: payIndex, viewIn: PAY_NODE, viewOut: PAY_NODE }]],
      },
      {
        // The write frame rewrites the challenges node from the count it holds to the one the body computes.
        ...escrowMaster('challenge', FrameKind.CALL),
        segments: [[...writeSegment]],
      },
    ],
    locktime,
    sequenceNumber: NON_FINAL_SEQUENCE,
    inputs: {
      [ROOT_MASTER]: { source: masterInput(ROOT_DEPLOYED) },
      [JUDGE_MASTER]: { source: masterInput(JUDGE_DEPLOYED) },
      [PAID_AT_MASTER]: { source: masterInput(ESCROW_DEPLOYED) },
      [CHALLENGE_MASTER]: { source: masterInput(ESCROW_DEPLOYED) },
      [VALIDATOR_ID]: {
        source: {
          lockingBytecode: validator.lock, valueSatoshis: 20_000n,
          token: token(ROOT_DEPLOYED.category, 'mutable'),
        },
      },
      [PAY_NODE_ID]: {
        source: {
          lockingBytecode: PAYMENTS.lock, valueSatoshis: 20_000n,
          token: token(ESCROW_DEPLOYED.category, 'mutable', PAY_NODE),
        },
        // The read frame leaves the node where it is, so it takes the covenant's read-only path.
        unlockingBytecode: PAYMENTS.unlock(paidAtIndex, 0n),
      },
      [CHALLENGE_NODE_ID]: {
        source: {
          lockingBytecode: CHALLENGES.lock, valueSatoshis: 20_000n,
          token: token(ESCROW_DEPLOYED.category, 'mutable', CHALLENGE_NODE_BEFORE),
        },
        output: {
          lockingBytecode: CHALLENGES.lock, valueSatoshis: 20_000n,
          token: token(ESCROW_DEPLOYED.category, 'mutable', CHALLENGE_NODE_AFTER),
        },
        unlockingBytecode: CHALLENGES.unlock(challengeIndex, 1n),
      },
      [USER_ID]: userInput(),
    },
    validator: {
      id: VALIDATOR_ID, covers: ['Judge', 'Escrow'],
      settles: [{ category: ESCROW_DEPLOYED.category, stateInputs: [PAY_NODE_ID, CHALLENGE_NODE_ID] }],
      redeemScript: validator.redeem,
    },
  };
  return { plan, payIndex, challengeNodeIndex, judgeIndex };
}

const ARTIFACTS = [built.artifacts.Root!, built.artifacts.Judge!, built.artifacts.Escrow!];
const ROOT = rootOf('Root', 'enter', ROOT_MASTER);

interface AfterPayment {
  readonly builtPlan: ReturnType<typeof buildPlan>;
  readonly outcome: ReturnType<typeof composeAndDerive>;
}
let afterPayment: AfterPayment | undefined;
/** The composition at a locktime after the payment, derived once: the settle reads it and the refusal clones it. */
function derivedAfterPayment(): AfterPayment {
  if (afterPayment === undefined) {
    const builtPlan = buildPlan(LOCKTIME_AFTER_PAYMENT);
    afterPayment = { builtPlan, outcome: composeAndDerive(builtPlan.plan, ARTIFACTS, [ROOT]) };
  }
  return afterPayment;
}

describe('a user-entered root that reaches an escrow through a judge gated on the escrow\'s payment block', () => {
  it('compiles all three contracts and serves the escrow\'s read and write entries', () => {
    for (const name of ['Root', 'Judge', 'Escrow']) {
      expect(built.artifacts[name]?.composition?.convention).toBe('framed');
    }
    expect(built.artifacts.Escrow?.abi.map((entry) => entry.name).sort()).toStrictEqual(['challenge', 'paidAt']);
  });

  it('settles: every contract input is accepted and the escrow\'s record carries what `challenge` computed', () => {
    const { builtPlan, outcome } = derivedAfterPayment();

    // The judge's read frame runs first, then the escrow entry it calls, then the judge and the root.
    expect(outcome.completed.map((frame) => frame.functionName)).toStrictEqual([
      entryName('Escrow', 'paidAt'), entryName('Escrow', 'challenge'),
      entryName('Judge', 'gate'), entryName('Root', 'enter'),
    ]);

    // The judge's read-only frame is served exactly where the layout places it, and every contract input passes.
    const rejected = outcome.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
    expect(rejected).toStrictEqual([]);
    expect(outcome.verdicts.filter((verdict) => verdict.accepted).map((verdict) => verdict.participant).sort())
      .toStrictEqual([ROOT_MASTER, JUDGE_MASTER, PAID_AT_MASTER, CHALLENGE_MASTER, VALIDATOR_ID,
        `${VALIDATOR_ID}/1`, PAY_NODE_ID, CHALLENGE_NODE_ID].sort());

    // The transaction's one clock reaches every frame.
    expect(outcome.transaction.locktime).toBe(LOCKTIME_AFTER_PAYMENT);
    for (const input of outcome.transaction.inputs) expect(input.sequenceNumber).toBe(NON_FINAL_SEQUENCE);

    // The challenges node's output carries the state `challenge` computed, read back through the shipped planner.
    const written = outcome.transaction.outputs[builtPlan.challengeNodeIndex]!.token!.nft!.commitment;
    expect(bytesToHex(written)).toBe(bytesToHex(CHALLENGE_NODE_AFTER));
    expect(bytesToHex(written)).not.toBe(bytesToHex(CHALLENGE_NODE_BEFORE));
    // The read frame leaves the payments node where it was.
    expect(outcome.transaction.outputs[builtPlan.payIndex]!.token!.nft!.commitment).toStrictEqual(PAY_NODE);
  });

  it('refuses the same composition at the payment block, with the machine naming the locktime check', () => {
    // The derived bytes are settled; only the transaction's one clock moves, back to the payment's own block, so
    // the judge's gate is not yet true. The program refuses at `OP_CHECKLOCKTIMEVERIFY`, and the machine reports
    // both times: this is the machine's refusal, not the driver's.
    const { builtPlan, outcome } = derivedAfterPayment();
    const program = outcome.draft.programFor(JUDGE_MASTER);
    const early = structuredClone(outcome.transaction) as typeof outcome.transaction;
    early.locktime = Number(PAYMENT_BLOCK);

    const vm = compositionMachine();
    const state = vm.evaluate({
      inputIndex: builtPlan.judgeIndex, sourceOutputs: program.sourceOutputs, transaction: early,
    });
    expect(vm.stateSuccess(state)).not.toBe(true);
    const objection = String((state as { error?: unknown }).error);
    expect(objection).toContain('OP_CHECKLOCKTIMEVERIFY');
    expect(objection).toContain(`Transaction locktime: ${Number(PAYMENT_BLOCK)}`);
    expect(objection).toContain(`required locktime: ${LOCKTIME_AFTER_PAYMENT}`);
  });

  it('stalls the derivation when the plan itself fixes a locktime that is not after the payment', () => {
    // The plan is the layer that fixes the one clock, so a plan whose own locktime is the payment's block leaves
    // the judge's gate false before any spend and the driver reports the stalled step.
    const builtPlan = buildPlan(Number(PAYMENT_BLOCK));
    expect(() => composeAndDerive(builtPlan.plan, ARTIFACTS, [ROOT]))
      .toThrow(/FRAMED_DERIVATION_STALLED/);
  });
});

/**
 * The same composition over one data-NFT state record.
 *
 * Here the escrow keeps its payment block in a scalar, so its contract is a single data-NFT record that the
 * read-only `paidAt` frame reads and the `challenge` frame rewrites: the layout places one record, and both frames
 * declare it. The read frame declares the record it reads and leaves it, and the write frame carries on from the
 * same commitment to the one its body computes, exactly as `buildPushdataCommitment` materializes those states.
 *
 * The case records where this geometry stands rather than papering over it.
 */

const SINGLE_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IJudge { function gate(); }'
  + ' interface IEscrow {'
  + '   function paidAt() view returns (int);'
  + '   function challenge();'
  + ' }'
  + ' contract Root {'
  + `   function enter() { IJudge(0x${JUDGE_ADDRESS}).gate(); require(true); }`
  + ' }'
  + ' contract Judge {'
  + '   function gate() {'
  + `     int paidAtBlock = IEscrow(0x${ESCROW_ADDRESS}).paidAt();`
  + '     require(tx.time >= paidAtBlock + 1);'
  + `     IEscrow(0x${ESCROW_ADDRESS}).challenge();`
  + '     require(true);'
  + '   }'
  + ' }'
  + ' contract Escrow {'
  + '   int internal paidAtBlock;'
  + '   function paidAt() view returns (int) { return this.paidAtBlock; }'
  + '   function challenge() { this.paidAtBlock = this.paidAtBlock + 1; require(true); }'
  + ' }';

const single = compileAndDeploy(SINGLE_SOURCE, {
  Root: ROOT_LABEL, Judge: JUDGE_LABEL, Escrow: ESCROW_LABEL,
});
const SINGLE_ESCROW = single.contracts.Escrow!;
const SINGLE_ESCROW_HEX = bytesToHex(SINGLE_ESCROW.category);
const SINGLE_ARTIFACTS = [single.artifacts.Root!, single.artifacts.Judge!, single.artifacts.Escrow!];

/** The escrow's one data-NFT record at a value of its `paidAtBlock`, from the shipped encoder. */
function singleRecordOf(paidAtBlock: bigint): Uint8Array {
  return new Uint8Array(Buffer.from(
    buildPushdataCommitment(single.artifacts.Escrow!.stateLayout!, { paidAtBlock }, 0), 'hex'));
}
const SINGLE_RECORD_BEFORE = singleRecordOf(PAYMENT_BLOCK);
const SINGLE_RECORD_AFTER = singleRecordOf(PAYMENT_BLOCK + 1n);

/** The plan over the one record: the read frame leaves it and the write frame carries it to the counted value. */
function buildSingleRecordPlan(locktime: number): CompositionDraftPlan {
  const root = single.contracts.Root!;
  const judge = single.contracts.Judge!;
  const validator = validatorFor(root.category);
  const gateSelector = selectorOf(single.artifacts, 'Judge', 'gate');
  const paidAtSelector = selectorOf(single.artifacts, 'Escrow', 'paidAt');
  const challengeSelector = selectorOf(single.artifacts, 'Escrow', 'challenge');

  const blocks: CompositionDraftPlan['blocks'] = [
    { contract: 'Root', masters: [ROOT_MASTER], validator: { id: VALIDATOR_ID, settles: [] }, state: [] },
    { contract: 'Judge', masters: [JUDGE_MASTER], state: [] },
    { contract: 'Escrow', masters: [PAID_AT_MASTER, CHALLENGE_MASTER], state: [RECORD_ID] },
  ];
  const layout = layoutWithFacets(blocks);
  const recordIndex = participant(layout, RECORD_ID).index;
  const challengeIndex = participant(layout, CHALLENGE_MASTER).index;
  const participantCount = layout.participantCount;

  const escrowMaster = (entry: 'paidAt' | 'challenge', kind: FrameKindValue): DraftMaster => master({
    master: entry === 'paidAt' ? PAID_AT_MASTER : CHALLENGE_MASTER,
    contract: 'Escrow', entry, program: SINGLE_ESCROW.program,
    facts: {
      contract: 'Escrow', functionName: entry, kind,
      callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 2,
    },
    frame: { kind, sender: judge.address, self: SINGLE_ESCROW.address, value: 0n },
    enteredBy: JUDGE_MASTER, origin: USER_ID,
    argumentPushes: [selectorOf(single.artifacts, 'Escrow', entry)],
  });

  return {
    blocks,
    userInputs: userInputs([USER_ID], participantCount),
    masters: [
      master({
        master: ROOT_MASTER, contract: 'Root', entry: 'enter', program: root.program,
        facts: {
          contract: 'Root', functionName: 'enter', kind: FrameKind.ROOT,
          callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
        },
        frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: root.address, value: 0n },
        enteredBy: USER_ID, origin: USER_ID,
        calls: [{
          kind: FrameKind.CALL, callee: JUDGE_MASTER, target: judge.address, value: 0n,
          argumentPushes: [gateSelector],
        }],
      }),
      master({
        master: JUDGE_MASTER, contract: 'Judge', entry: 'gate', program: judge.program,
        facts: {
          contract: 'Judge', functionName: 'gate', kind: FrameKind.CALL,
          callerIsUser: false, originEqualsCaller: false, makesExternalCall: true, mastersOfContract: 1,
        },
        frame: { kind: FrameKind.CALL, sender: root.address, self: judge.address, value: 0n },
        enteredBy: ROOT_MASTER, origin: USER_ID,
        argumentPushes: [gateSelector],
        calls: [
          {
            kind: FrameKind.STATIC, callee: PAID_AT_MASTER, target: SINGLE_ESCROW.address, value: 0n,
            argumentPushes: [paidAtSelector],
          },
          {
            kind: FrameKind.CALL, callee: CHALLENGE_MASTER, target: SINGLE_ESCROW.address, value: 0n,
            argumentPushes: [challengeSelector],
          },
        ],
      }),
      {
        ...escrowMaster('paidAt', FrameKind.STATIC),
        retval: encodeResultList([encodeIntegerValue(PAYMENT_BLOCK)]),
        segments: [[{
          in: recordIndex, out: recordIndex, viewIn: SINGLE_RECORD_BEFORE, viewOut: SINGLE_RECORD_BEFORE,
        }]],
      },
      {
        ...escrowMaster('challenge', FrameKind.CALL),
        segments: [[{
          in: recordIndex, out: recordIndex, viewIn: SINGLE_RECORD_BEFORE, viewOut: SINGLE_RECORD_AFTER,
        }]],
      },
    ],
    locktime,
    sequenceNumber: NON_FINAL_SEQUENCE,
    inputs: {
      [ROOT_MASTER]: { source: masterInput(root) },
      [JUDGE_MASTER]: { source: masterInput(judge) },
      [PAID_AT_MASTER]: { source: masterInput(SINGLE_ESCROW) },
      [CHALLENGE_MASTER]: { source: masterInput(SINGLE_ESCROW) },
      [VALIDATOR_ID]: {
        source: {
          lockingBytecode: validator.lock, valueSatoshis: 20_000n,
          token: token(root.category, 'mutable'),
        },
      },
      [RECORD_ID]: {
        source: {
          lockingBytecode: stateRecordLockingBytecode(SINGLE_ESCROW_HEX), valueSatoshis: 20_000n,
          token: token(SINGLE_ESCROW.category, 'mutable', SINGLE_RECORD_BEFORE),
        },
        output: {
          lockingBytecode: stateRecordLockingBytecode(SINGLE_ESCROW_HEX), valueSatoshis: 20_000n,
          token: token(SINGLE_ESCROW.category, 'mutable', SINGLE_RECORD_AFTER),
        },
        unlockingBytecode: stateRecordUnlockingBytecode(SINGLE_ESCROW_HEX, challengeIndex, 1),
      },
      [USER_ID]: userInput(),
    },
    validator: {
      id: VALIDATOR_ID, covers: ['Judge', 'Escrow'],
      settles: [{ category: SINGLE_ESCROW.category, stateInputs: [RECORD_ID] }],
      redeemScript: validator.redeem,
    },
  };
}

let singleRun: { readonly plan: CompositionDraftPlan; readonly outcome: ReturnType<typeof composeAndDerive> } | undefined;
/** The single-record composition, derived once: the settle reads it and the refusal copies the outputs it changes. */
function derivedSingle(): NonNullable<typeof singleRun> {
  if (singleRun === undefined) {
    const plan = buildSingleRecordPlan(LOCKTIME_AFTER_PAYMENT);
    singleRun = { plan, outcome: composeAndDerive(plan, SINGLE_ARTIFACTS, [rootOf('Root', 'enter', ROOT_MASTER)]) };
  }
  return singleRun;
}

describe('the same composition over one data-NFT state record', () => {
  it('settles: the frame that only reads the record closes against its own declaration', () => {
    // One record, read by the read-only frame and written by the `challenge` frame. The reading frame's segment
    // declares the record kept, and its close holds it to that declaration: the transaction's own output carries
    // the value the other frame writes, so a close that read the transaction would refuse a spend the design
    // wants. Every contract input is accepted, and the record's output carries what `challenge` computed.
    const { plan, outcome } = derivedSingle();

    expect(outcome.completed.map((frame) => frame.functionName)).toStrictEqual([
      entryName('Escrow', 'paidAt'), entryName('Escrow', 'challenge'),
      entryName('Judge', 'gate'), entryName('Root', 'enter'),
    ]);
    const rejected = outcome.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
    expect(rejected).toStrictEqual([]);
    expect(outcome.verdicts.filter((verdict) => verdict.accepted)
      .map((verdict) => verdict.participant).sort())
      .toStrictEqual([ROOT_MASTER, JUDGE_MASTER, PAID_AT_MASTER, CHALLENGE_MASTER, VALIDATOR_ID,
        `${VALIDATOR_ID}/1`, RECORD_ID].sort());

    // The record the reading frame left carries the counted value the writing frame computed.
    const written = outcome.transaction.outputs[planRecordIndex(plan)]!.token!.nft!.commitment;
    expect(bytesToHex(written)).toBe(bytesToHex(SINGLE_RECORD_AFTER));
    expect(bytesToHex(written)).not.toBe(bytesToHex(SINGLE_RECORD_BEFORE));
  });

  it('refuses a record output no frame computed, on the same composition', () => {
    const { plan, outcome: { draft } } = derivedSingle();
    const recordIndex = planRecordIndex(plan);
    const program = draft.programFor(CHALLENGE_MASTER);
    const wrong = singleRecordOf(PAYMENT_BLOCK + 100n);
    const transaction = {
      ...program.transaction,
      outputs: program.transaction.outputs.map((output, index) => (index === recordIndex
        ? { ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment: wrong } } }
        : output)),
    };
    const vm = compositionMachine();
    const state = vm.evaluate({
      inputIndex: participant(draft.layout, VALIDATOR_ID).index,
      sourceOutputs: program.sourceOutputs, transaction,
    });
    expect(vm.stateSuccess(state)).not.toBe(true);
  });
});

/** The layout index the plan's single record sits at. */
function planRecordIndex(plan: CompositionDraftPlan): number {
  return participant(layoutWithFacets(plan.blocks), RECORD_ID).index;
}
