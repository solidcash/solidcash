import { describe, expect, it } from 'vitest';
import {
  FrameKind, decodePushdataValue, encodePushdataValue, decodeWitnessBlock, splitFirstPush,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import {
  USER_LOCK, compileAndDeploy, composeAndDerive, entryName, hexOf, master, masterInput, rootOf, seededAddress,
  selectorOf, token, userInput, userInputs, validatorFor,
} from '../shapes/harness.js';
import { type CompositionDraftPlan } from '../../../src/framed/composer/index.js';
import { layoutWithFacets } from '../shapes/harness.js';

/**
 * A `pure` callee reached as a read-only frame, with a fixed-size array on both boundaries.
 *
 * The caller's entry calls the callee's `pure` entry with an array it fills at run time, and the callee carries one
 * call data. The array value itself is the shipped encoder's output, so the callee's element reads and the caller's
 * record agree by construction. The pair below runs the whole path (compile, deploy, compose, derive, the BCH-2026
 * machine) and asserts on the composer's own block, the order the derivation completed in, and the array decoded out
 * of the caller's call record.
 *
 * The site's digest is computed from the value the code holds, and the callee reading the elements it was handed is
 * what shows that digest is the wire's. A value the source states at compile time is `fixed-array-calls.test.ts`'s.
 */

const CALLER_LABEL = 'static frame caller';
const CALLEE_LABEL = 'static frame callee';
const CALLEE = hexOf(seededAddress(CALLEE_LABEL));
/** The array the caller passes, in the one encoding the callee's own decoder reads. */
const ELEMENTS = [1n, 2n];
const ARGUMENT = encodePushdataValue(ELEMENTS, 'uint16[2]');

/** The two-contract unit; the caller's argument is whatever the caller body hands its call. */
function source(argumentExpression: string, declarations = ''): string {
  return 'pragma solidcash ^0.14.0;'
    + ' interface ICal { function f(uint16[2] xs) pure returns (uint16[2]); }'
    + ' contract Cal { function f(uint16[2] xs) pure returns (uint16[2]) {'
    + '   require(xs[0] == 1); require(xs[1] == 2); return xs; } }'
    + ' contract Caller { function start() {'
    + `   ${declarations}`
    + `   uint16[2] r = ICal(0x${CALLEE}).f(${argumentExpression});`
    + '   require(r[0] == 1); require(r[1] == 2); require(true); } }';
}

/** The pair as one plan: the caller names the callee's read-only frame and carries its call data. */
function planFor(argumentExpression: string, declarations = ''): {
  readonly artifacts: ReturnType<typeof compileStringMulti>;
  readonly plan: CompositionDraftPlan;
} {
  const { artifacts, contracts } = compileAndDeploy(source(argumentExpression, declarations), {
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
    userInputs: userInputs(['user'], layoutWithFacets(blocks).participantCount),
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
  return { artifacts, plan };
}

/** Asserts the whole path on one argument expression: every input accepted and the value read back out. */
function driveArgument(argumentExpression: string, declarations = ''): void {
  const { artifacts, plan } = planFor(argumentExpression, declarations);
  const outcome = composeAndDerive(plan, [artifacts.Caller!, artifacts.Cal!],
    [rootOf('Caller', 'start', 'caller-1')]);

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
}

describe('a pure callee reached as a static frame', () => {
  it('carries a fixed-size array the caller builds at run time, accepted at every contract input', () => {
    // The argument is a local the caller fills element by element, so the site's digest is over a value the code
    // holds at run time rather than one the source states; the callee reading the elements it was sent is the proof
    // that the digest and the wire agree.
    driveArgument('xs', 'uint16[2] xs; xs[0] = 1; xs[1] = 2;');
  });
});
