import { describe, expect, it } from 'vitest';
import { FrameKind, encodeArgumentList, encodeIntegerValue } from '@solidcash/utils';
import {
  USER_LOCK, compileAndDeploy, composeAndDerive, hexOf, masterInput, rootOf, seededAddress, selectorOf,
  token, userInput, userInputs, validatorFor,
} from '../shapes/harness.js';
import type { CompositionDraftPlan, DraftMaster } from '../../../src/per-call/composer/index.js';

/**
 * A read's result feeding a later call: `Claimer.f` reads a fee from `Fee.fee` (a view read, so a static frame) and
 * passes it to `Pay.pay`. The compiler compiles both entries, but the composer never fills a call record's `result`
 * field, so the caller recomputes the second call's digest from an empty result and stops.
 */

const CLAIMER_LABEL = 'later call claimer';
const FEE_LABEL = 'later call fee';
const PAY_LABEL = 'later call pay';
const CLAIMER = hexOf(seededAddress(CLAIMER_LABEL));
const FEE = hexOf(seededAddress(FEE_LABEL));
const PAY = hexOf(seededAddress(PAY_LABEL));

/** The source with `id` taken from the user when `withId`, and from a constant otherwise. */
function source(withId: boolean): string {
  const parameter = withId ? 'int id' : '';
  const id = withId ? 'id' : '7';
  return 'pragma solidcash ^0.13.0;'
    + ' interface IFee { function fee(int id) view returns (int); }'
    + ' interface IPay { function pay(int id, int amount); }'
    + ` contract Fee { function fee(int id) view returns (int) { return id * 2; } }`
    + ' contract Pay { function pay(int id, int amount) { require(amount > 0); } }'
    + ' contract Claimer {'
    + `   function f(${parameter}) {`
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

/** Compiles, deploys and plans the composition, then runs the shipped composer and derivation over it. */
function compose(withId: boolean): ReturnType<typeof composeAndDerive> {
  const { artifacts, contracts } = compileAndDeploy(source(withId), {
    Claimer: CLAIMER_LABEL, Fee: FEE_LABEL, Pay: PAY_LABEL,
  });
  const claimer = contracts.Claimer!;
  const validator = validatorFor(claimer.category);
  const idPush = encodeIntegerValue(7n);
  const feePush = encodeIntegerValue(14n);
  const feeSelector = selectorOf(artifacts, 'Fee', 'fee');
  const paySelector = selectorOf(artifacts, 'Pay', 'pay');
  const plan: CompositionDraftPlan = {
    blocks: [
      { contract: 'Claimer', masters: ['claimer-1'], validator: { id: 'validator', settles: [] }, state: [] },
      { contract: 'Fee', masters: ['fee-1'], state: [] },
      { contract: 'Pay', masters: ['pay-1'], state: [] },
    ],
    userInputs: userInputs(['user'], 4),
    masters: [
      draftMaster({
        master: 'claimer-1', contract: 'Claimer', functionName: 'Claimer.f()', program: claimer.program,
        facts: {
          contract: 'Claimer', functionName: 'f', kind: FrameKind.ROOT,
          callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
        },
        frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: claimer.address, value: 0n },
        enteredBy: 'user', origin: 'user', segments: [[], [], []],
        argumentPushes: withId ? [idPush] : [],
        calls: [
          {
            kind: FrameKind.STATIC, callee: 'fee-1', target: seededAddress(FEE_LABEL), value: 0n,
            argumentPushes: [feeSelector, idPush],
          },
          {
            kind: FrameKind.CALL, callee: 'pay-1', target: seededAddress(PAY_LABEL), value: 0n,
            argumentPushes: [paySelector, idPush, feePush],
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
        retval: encodeArgumentList([encodeIntegerValue(14n)]),
      }),
      draftMaster({
        master: 'pay-1', contract: 'Pay', functionName: 'Pay.pay()', program: contracts.Pay!.program,
        facts: {
          contract: 'Pay', functionName: 'pay', kind: FrameKind.CALL,
          callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
        },
        frame: { kind: FrameKind.CALL, sender: claimer.address, self: seededAddress(PAY_LABEL), value: 0n },
        enteredBy: 'claimer-1', origin: 'user', argumentPushes: [paySelector, idPush, feePush],
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
  return composeAndDerive(plan, [artifacts.Claimer!, artifacts.Fee!, artifacts.Pay!], [rootOf('Claimer', 'f', 'claimer-1')]);
}

/** The error a shipped call raised, or a failure when it returned normally. */
function refusalOf(run: () => unknown): { readonly name?: string; readonly code?: string; readonly message: string } {
  try {
    run();
  } catch (error) {
    const refusal = error as { name?: string; code?: string; message: string };
    return { name: refusal.name, code: refusal.code, message: refusal.message };
  }
  throw new Error('the shipped per-call composer accepted the composition, so there is no refusal to record');
}

describe('a read whose result a later call consumes', () => {
  it('is refused today when the root entry takes its argument: a user-entered master carries no call data', () => {
    const refusal = refusalOf(() => compose(true));
    expect(refusal.name).toBe('PerCallEncodingError');
    expect(refusal.message).toMatch(/is entered by a user, so it carries no call data/);
  });

  it('is refused today when the result is carried: the derivation stalls on the second call', () => {
    // Held with a constant id, the first call fills and its static callee settles; the second call never advances
    // because the caller's digest is computed from the call result the composer left empty.
    const refusal = refusalOf(() => compose(false));
    expect(refusal.code).toBe('PER_CALL_DERIVATION_STALLED');
    expect(refusal.message).toMatch(/filled no witness at site 1 \(call 1\)/);
  });
});
