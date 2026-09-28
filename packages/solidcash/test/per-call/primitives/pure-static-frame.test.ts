import { describe, expect, it } from 'vitest';
import {
  FrameKind, decodePushdataValue, encodePushdataValue, decodeWitnessBlock, splitFirstPush,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { publishedRefusals } from '../../../../solidc/test/per-call/master/refused-entry.js';
import {
  USER_LOCK, compileAndDeploy, composeAndDerive, entryName, hexOf, master, masterInput, rootOf, seededAddress,
  selectorOf, token, userInput, userInputs, validatorFor,
} from '../shapes/harness.js';
import { layoutTransaction, type CompositionDraftPlan } from '../../../src/per-call/composer/index.js';

/**
 * A `pure` callee reached as a read-only frame, with a fixed-size array on both boundaries.
 *
 * The caller's entry calls the callee's `pure` entry with an array value the source states at compile time, so the
 * site folds one digest and the callee carries one call data. The array value itself is the shipped encoder's
 * output, so the callee's element reads and the caller's record agree by construction. The pair below runs the
 * whole path — compile, deploy, compose, derive, the BCH-2026 machine — and asserts on the composer's own block,
 * the order the derivation completed in, and the array decoded out of the caller's call record.
 *
 * The read-only frame is admitted when the array argument is a compile-time value. A run-time array argument is
 * refused by the compiler, and the refusal is pinned below by its exact message.
 */

const CALLER_LABEL = 'static frame caller';
const CALLEE_LABEL = 'static frame callee';
const CALLEE = hexOf(seededAddress(CALLEE_LABEL));
/** The array the caller passes, in the one encoding the callee's own decoder reads. */
const ELEMENTS = [1n, 2n];
const ARGUMENT = encodePushdataValue(ELEMENTS, 'uint16[2]');

/** The two-contract unit; the caller's argument is whatever the caller body hands its call. */
function source(argumentExpression: string, declarations = ''): string {
  return 'pragma solidcash ^0.13.0;'
    + ' interface ICal { function f(uint16[2] xs) pure returns (uint16[2]); }'
    + ' contract Cal { function f(uint16[2] xs) pure returns (uint16[2]) {'
    + '   require(xs[0] == 1); require(xs[1] == 2); return xs; } }'
    + ' contract Caller { function start() {'
    + `   ${declarations}`
    + `   uint16[2] r = ICal(0x${CALLEE}).f(${argumentExpression});`
    + '   require(r[0] == 1); require(r[1] == 2); require(true); } }';
}

describe('a pure callee reached as a static frame', () => {
  it('carries a fixed-size array argument in and its result back out, accepted at every contract input', () => {
    const { artifacts, contracts } = compileAndDeploy(source(`hex"${hexOf(ARGUMENT)}"`), {
      Caller: CALLER_LABEL, Cal: CALLEE_LABEL,
    });
    const caller = contracts.Caller!;
    const callee = contracts.Cal!;
    const selector = selectorOf(artifacts, 'Cal', 'f');
    const argumentPushes = [selector, ARGUMENT];
    const validator = validatorFor(caller.category);
    const blocks: CompositionDraftPlan['blocks'] = [
      { contract: 'Caller', masters: ['caller-1'], validator: { id: 'validator', settles: [] }, state: [] },
      { contract: 'Cal', masters: ['cal-1'], state: [] },
    ];
    const plan: CompositionDraftPlan = {
      blocks,
      userInputs: userInputs(['user'], layoutTransaction(blocks).participantCount),
      masters: [
        master({
          master: 'caller-1', contract: 'Caller', entry: 'start', program: caller.program,
          facts: {
            contract: 'Caller', functionName: 'start', kind: FrameKind.ROOT,
            callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
          },
          frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: caller.address, value: 0n },
          enteredBy: 'user', origin: 'user',
          calls: [{ kind: FrameKind.STATIC, callee: 'cal-1', target: callee.address, value: 0n, argumentPushes }],
        }),
        {
          ...master({
            master: 'cal-1', contract: 'Cal', entry: 'f', program: callee.program,
            facts: {
              contract: 'Cal', functionName: 'f', kind: FrameKind.STATIC,
              callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
            },
            frame: { kind: FrameKind.STATIC, sender: caller.address, self: callee.address, value: 0n },
            enteredBy: 'caller-1', origin: 'user', argumentPushes,
          }),
          // The callee returns the argument it read, so the frame's result is the same encoding.
          retval: ARGUMENT,
        },
      ],
      inputs: {
        'caller-1': { source: masterInput(caller) },
        'cal-1': { source: masterInput(callee) },
        validator: {
          source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(caller.category, 'mutable') },
        },
        user: userInput(),
      },
      validator: { id: 'validator', covers: ['Cal'], settles: [], redeemScript: validator.redeem },
    };

    const outcome = composeAndDerive(plan, [artifacts.Caller!, artifacts.Cal!], [
      rootOf('Caller', 'start', 'caller-1'),
    ]);

    expect(outcome.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`)).toStrictEqual([]);
    expect(outcome.completed.map((frame) => frame.functionName))
      .toStrictEqual([entryName('Cal', 'f'), entryName('Caller', 'start')]);

    // The caller's own record names the callee's read-only frame, and its result is the callee's return.
    const callerBlock = decodeWitnessBlock(splitFirstPush(outcome.draft.unlockingBytecodeOf('caller-1')).payload);
    expect(callerBlock.calls[0]!.kind).toBe(FrameKind.STATIC);
    expect(callerBlock.calls[0]!.result).toStrictEqual(ARGUMENT);
    // The returned array, read back out of the call record with the shipped decoder.
    const decoded = decodePushdataValue(callerBlock.calls[0]!.result, 0, 'uint16[2]');
    expect(decoded.value).toStrictEqual(ELEMENTS);
    expect(decoded.bytesConsumed).toBe(callerBlock.calls[0]!.result.length);
    // The callee's own frame records the same value it returned.
    expect(decodeWitnessBlock(splitFirstPush(outcome.draft.unlockingBytecodeOf('cal-1')).payload).retval)
      .toStrictEqual(ARGUMENT);
  });

  it('refuses a run-time array argument: the caller cannot fold the digest its record must carry', () => {
    const runTime = source('xs', 'uint16[2] xs; xs[0] = 1; xs[1] = 2;');
    const refusals = publishedRefusals(compileStringMulti(runTime, { composition: 'per-call' }) as
      Record<string, { composition?: unknown }>);

    expect(refusals).toStrictEqual([{
      functionName: 'Caller.start()',
      reason: "the call to 'f' passes a run-time argument whose value the compiler cannot encode into one push, "
        + 'so the caller cannot compute the digest its record must carry',
    }]);
  });
});
