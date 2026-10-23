import { describe, expect, it } from 'vitest';
import {
  FrameKind, argsHash, decodeWitnessBlock, encodeArgumentList, encodeIntegerValue, encodeResultList,
  splitFirstPush, type Artifact,
} from '@solidcash/utils';
import {
  USER_LOCK, compileAndDeploy, composeAndDerive, hexOf, masterInput, rootOf, seededAddress, selectorOf,
  token, userInput, userInputs, validatorFor,
} from '../shapes/harness.js';
import { type CompositionDraftPlan, type DraftMaster } from '../../../src/framed/composer/index.js';

/**
 * A read's result feeding a later call: `Claimer.f` reads a fee from `Fee.fee` and passes it to `Pay.pay`.
 *
 * The composer now fills a call record's `result` from its callee's declared `retval`, so the caller reads the fee
 * out of the first record and recomputes the second call's digest from it. The plan's own `Y3` shape — `A.f(id)`
 * computes `fee = B.fee(id)` then calls `C.pay(id, fee)` — settles when `id` is a value the running code holds,
 * which is `tx.inputs.length` below (a user-entered root carries no call data, so it cannot take the parameter the
 * plan writes; `composer/assemble.test.ts` pins that refusal). A later call that also passes a compile-time argument
 * settles: the caller's run-time digest folds in the constant's wire push with its framing byte intact, so the
 * callee's call data hashes to the record the caller checks.
 */

const CLAIMER_LABEL = 'later call claimer';
const FEE_LABEL = 'later call fee';
const PAY_LABEL = 'later call pay';
const FEE = hexOf(seededAddress(FEE_LABEL));
const PAY = hexOf(seededAddress(PAY_LABEL));

/** Where the later call's second argument comes from. */
type IdMode = 'literal' | 'runtime';
const LITERAL_ID = 7n;
/** The composed transaction's input count: the three masters, the validator, the facet it binds and the user. */
const RUNTIME_ID = 6n;

/** The source, with `id` taken from a literal or the running transaction's input count. */
function source(mode: IdMode): string {
  const id = mode === 'literal' ? LITERAL_ID.toString() : 'id';
  const declare = mode === 'runtime' ? '     int id = tx.inputs.length;\n' : '';
  return 'pragma solidcash ^0.14.0;'
    + ' interface IFee { function fee(int id) view returns (int); }'
    + ' interface IPay { function pay(int id, int amount); }'
    + ' contract Fee { function fee(int id) view returns (int) { return id * 2; } }'
    + ' contract Pay { function pay(int id, int amount) { require(amount > 0); } }'
    + ' contract Claimer {'
    + '   function f() {'
    + declare
    + `     int fee = IFee(0x${FEE}).fee(${id});`
    + `     IPay(0x${PAY}).pay(${id}, fee);`
    + '     require(true);'
    + '   }'
    + ' }';
}

type MasterIdentity = Pick<
DraftMaster, 'master' | 'contract' | 'functionName' | 'program' | 'facts' | 'frame' | 'enteredBy' | 'origin'
>;

function draftMaster(spec: Partial<DraftMaster> & MasterIdentity): DraftMaster {
  return {
    calls: [], retval: new Uint8Array(0), segments: [[]], events: [], sends: [],
    argumentPushes: [], redeemScript: spec.program, ...spec,
  };
}

/** The plan every case drives, with `id` supplied however the source under test takes it. */
interface Built {
  readonly plan: CompositionDraftPlan;
  readonly artifacts: readonly Pick<Artifact, 'composition'>[];
  readonly id: bigint;
  readonly idPush: Uint8Array;
  readonly feePush: Uint8Array;
  readonly feeRetval: Uint8Array;
  readonly paySelector: Uint8Array;
}

function build(mode: IdMode): Built {
  const { artifacts, contracts } = compileAndDeploy(source(mode), {
    Claimer: CLAIMER_LABEL, Fee: FEE_LABEL, Pay: PAY_LABEL,
  });
  const claimer = contracts.Claimer!;
  const validator = validatorFor(claimer.category);
  const id = mode === 'literal' ? LITERAL_ID : RUNTIME_ID;
  const idPush = encodeIntegerValue(id);
  const feePush = encodeIntegerValue(id * 2n);
  const feeSelector = selectorOf(artifacts, 'Fee', 'fee');
  const paySelector = selectorOf(artifacts, 'Pay', 'pay');
  const plan: CompositionDraftPlan = {
    blocks: [
      { contract: 'Claimer', masters: ['claimer-1'], validator: { id: 'validator', settles: [] }, state: [] },
      { contract: 'Fee', masters: ['fee-1'], state: [] },
      { contract: 'Pay', masters: ['pay-1'], state: [] },
    ],
    // The facet the validator binds is one participant ahead of the user.
    userInputs: userInputs(['user'], 5),
    masters: [
      draftMaster({
        master: 'claimer-1', contract: 'Claimer', functionName: 'Claimer.f()', program: claimer.program,
        facts: {
          contract: 'Claimer', functionName: 'f', kind: FrameKind.ROOT,
          callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
        },
        frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: claimer.address, value: 0n },
        enteredBy: 'user', origin: 'user', segments: [[], [], []],
        calls: [
          {
            kind: FrameKind.STATIC, callee: 'fee-1', target: seededAddress(FEE_LABEL), value: 0n,
            argumentPushes: [feeSelector, idPush],
          },
          {
            // The call data carries the last parameter's push first, so `amount` (the fee) leads `id`.
            kind: FrameKind.CALL, callee: 'pay-1', target: seededAddress(PAY_LABEL), value: 0n,
            argumentPushes: [paySelector, feePush, idPush],
          },
        ],
      }),
      draftMaster({
        master: 'fee-1', contract: 'Fee', functionName: 'Fee.fee()', program: contracts.Fee!.program,
        facts: {
          contract: 'Fee', functionName: 'fee', kind: FrameKind.STATIC,
          callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
        },
        frame: { kind: FrameKind.STATIC, sender: claimer.address, self: seededAddress(FEE_LABEL), value: 0n },
        enteredBy: 'claimer-1', origin: 'user', argumentPushes: [feeSelector, idPush],
        // The read's return value, which the caller's record must carry for the digest it recomputes to match.
        retval: encodeResultList([feePush]),
      }),
      draftMaster({
        master: 'pay-1', contract: 'Pay', functionName: 'Pay.pay()', program: contracts.Pay!.program,
        facts: {
          contract: 'Pay', functionName: 'pay', kind: FrameKind.CALL,
          callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
        },
        frame: { kind: FrameKind.CALL, sender: claimer.address, self: seededAddress(PAY_LABEL), value: 0n },
        enteredBy: 'claimer-1', origin: 'user', argumentPushes: [paySelector, feePush, idPush],
      }),
    ],
    inputs: {
      'claimer-1': { source: masterInput(claimer) },
      'fee-1': { source: masterInput(contracts.Fee!) },
      'pay-1': { source: masterInput(contracts.Pay!) },
      validator: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(claimer.category, 'mutable') },
      },
      user: userInput(),
    },
    validator: { id: 'validator', covers: ['Fee', 'Pay'], settles: [], redeemScript: validator.redeem },
  };
  return {
    plan,
    artifacts: [artifacts.Claimer!, artifacts.Fee!, artifacts.Pay!],
    id,
    idPush,
    feePush,
    feeRetval: encodeResultList([feePush]),
    paySelector,
  };
}

const ROOT = rootOf('Claimer', 'f', 'claimer-1');

/** One master's witness block, read back from the unlocking bytecode the composer built, through the shipped codec. */
function blockOf(unlocking: Uint8Array): ReturnType<typeof decodeWitnessBlock> {
  return decodeWitnessBlock(splitFirstPush(unlocking).payload);
}

describe('a read whose result a later call consumes', () => {
  it('settles when the later call also passes a compile-time argument', () => {
    // The composer fills the read's record with the callee's `retval`, and the later call mixes that run-time fee
    // with the compile-time `id`. The constant argument's push keeps its framing byte in the caller's digest (the
    // wire push for `7` is `0x57`, not the value `0x07`), so it equals the record's digest and the callee's call
    // data, and the derivation settles.
    const built = build('literal');
    const outcome = composeAndDerive(built.plan, built.artifacts, [ROOT]);

    const rejected = outcome.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
    expect(rejected).toStrictEqual([]);
    expect(outcome.completed.map((frame) => frame.master)).toStrictEqual(['fee-1', 'pay-1', 'claimer-1']);

    const claimer = blockOf(outcome.draft.unlockingBytecodeOf('claimer-1'));
    expect(claimer.calls[0]!.result).toStrictEqual(built.feeRetval);
    // The later call's recorded digest is the one the shipped encoders produce from the pushes the callee carries.
    expect(claimer.calls[1]!.argsHash)
      .toStrictEqual(argsHash(built.paySelector, encodeArgumentList([built.feePush, built.idPush])));
  });

  it('settles the plan\'s Y3 shape when the id is a run-time value, accepted at every contract input', () => {
    const built = build('runtime');
    const outcome = composeAndDerive(built.plan, built.artifacts, [ROOT]);

    // The source's `tx.inputs.length` is the input count the composed transaction actually has, so the argument
    // the plan stated is the one the body computed.
    expect(outcome.transaction.inputs.length).toBe(Number(built.id));

    // The read is derived before the call it feeds, and that call before the root that resumes past both.
    expect(outcome.completed.map((frame) => frame.master)).toStrictEqual(['fee-1', 'pay-1', 'claimer-1']);

    // Every contract input of the assembled transaction passes the BCH-2026 machine.
    const rejected = outcome.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
    expect(rejected).toStrictEqual([]);

    // The claimer's own block, read back from the bytes the machine evaluates: the static read's record carries its
    // callee's return value, and the later void call carries no result.
    const claimer = blockOf(outcome.draft.unlockingBytecodeOf('claimer-1'));
    expect(claimer.calls).toHaveLength(2);
    expect(claimer.calls[0]!.result).toStrictEqual(built.feeRetval);
    expect(claimer.calls[1]!.result).toStrictEqual(new Uint8Array(0));
    expect(blockOf(outcome.draft.unlockingBytecodeOf('fee-1')).retval).toStrictEqual(built.feeRetval);

    // The later call's recorded digest is the one the shipped encoders produce from the call data the callee carries
    // (`fee` then `id`), which is what the caller's body recomputes from the read's value; the machine accepting the
    // caller's input is the proof the two agree.
    expect(claimer.calls[1]!.argsHash)
      .toStrictEqual(argsHash(built.paySelector, encodeArgumentList([built.feePush, built.idPush])));

    // The masters are recreated in place, so each contract's post-state is its own lock and its own category.
    const byMaster = new Map(outcome.contractInputs.map((input) => [input.id, input.index]));
    for (const frameId of ['claimer-1', 'fee-1', 'pay-1']) {
      const inputSource = built.plan.inputs[frameId]!.source;
      const output = outcome.transaction.outputs[byMaster.get(frameId)!]!;
      expect(output.lockingBytecode).toStrictEqual(inputSource.lockingBytecode);
      expect(output.token!.category).toStrictEqual(inputSource.token!.category);
    }
  });
});
