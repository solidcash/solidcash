import { describe, expect, it } from 'vitest';
import {
  FrameKind, decodeIntegerValue, decodePushdataValue, decodeWitnessBlock, encodeIntegerValue, encodePushdataValue,
  splitFirstPush,
} from '@solidcash/utils';
import {
  USER_LOCK, compileAndDeploy, composeAndDerive, entryName, hexOf, master, masterInput, rootOf, seededAddress,
  selectorOf, token, userInput, userInputs, validatorFor,
} from '../shapes/harness.js';
import { type CompositionDraftPlan, type DraftMaster } from '../../../src/framed/composer/index.js';
import { layoutWithFacets } from '../shapes/harness.js';

/**
 * Fixed-size array arguments and results across a read-only call.
 *
 * Each case passes an array whose bytes are the shipped pushdata encoder's output, so the array the callee reads
 * is the caller's own value and the value the caller stores is the callee's return. The callee's body requires the
 * elements it read; the derivation completing is the machine accepting that read. The caller's call record is
 * decoded back with the same shipped decoder, so the stored value is asserted rather than assumed.
 *
 * uint16[2] and an array the caller builds at run time are `pure-static-frame.test.ts`'s.
 */

const USER = 'user';

/** One end-to-end case: a call of `Cal.f` with a fixed-size array boundary. */
interface ArrayCase {
  readonly label: string;
  /** The callee's array type, as the source spells it. */
  readonly type: string;
  /** The argument's encoding, which the caller's source embeds as a compile-time value... */
  readonly argument: Uint8Array;
  /** ...unless the case states the argument in the source directly. */
  readonly argumentExpression?: string;
  /** The array the callee returns, as its element values. */
  readonly result: readonly bigint[];
  /** The source of the pair, with the callee address and the caller's argument already filled in. */
  readonly source: (calleeAddress: string, argument: string) => string;
}

/** Compiles and deploys the case, composes and derives it, and returns the caller's decoded call record. */
function drive(spec: ArrayCase): readonly bigint[] {
  const calleeLabel = `array calls ${spec.label}`;
  const calleeAddress = hexOf(seededAddress(calleeLabel));
  const argument = spec.argumentExpression ?? `hex"${hexOf(spec.argument)}"`;
  const { artifacts, contracts } = compileAndDeploy(spec.source(calleeAddress, argument), {
    Caller: 'array calls caller', Cal: calleeLabel,
  });
  const caller = contracts.Caller!;
  const callee = contracts.Cal!;
  const selector = selectorOf(artifacts, 'Cal', 'f');
  const argumentPushes = [selector, spec.argument];
  const expectedResult = encodePushdataValue([...spec.result], spec.type);
  const validator = validatorFor(caller.category);
  const calleeMaster: DraftMaster = {
    ...master({
      master: 'cal-1', contract: 'Cal', entry: 'f', program: callee.program,
      facts: {
        contract: 'Cal', functionName: 'f', kind: FrameKind.STATIC,
        callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
      },
      frame: { kind: FrameKind.STATIC, sender: caller.address, self: callee.address, value: 0n },
      enteredBy: 'caller-1', origin: 'user', argumentPushes,
    }),
    retval: expectedResult,
  };
  const blocks: CompositionDraftPlan['blocks'] = [
    { contract: 'Caller', masters: ['caller-1'], validator: { id: 'validator', settles: [] }, state: [] },
    { contract: 'Cal', masters: ['cal-1'], state: [] },
  ];
  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: userInputs([USER], layoutWithFacets(blocks).participantCount),
    masters: [
      master({
        master: 'caller-1', contract: 'Caller', entry: 'start', program: caller.program,
        facts: {
          contract: 'Caller', functionName: 'start', kind: FrameKind.ROOT,
          callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
        },
        frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: caller.address, value: 0n },
        enteredBy: USER, origin: USER,
        calls: [{ kind: FrameKind.STATIC, callee: 'cal-1', target: callee.address, value: 0n, argumentPushes }],
      }),
      calleeMaster,
    ],
    inputs: {
      'caller-1': { source: masterInput(caller) },
      'cal-1': { source: masterInput(callee) },
      validator: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(caller.category, 'mutable') },
      },
      [USER]: userInput(),
    },
    validator: { id: 'validator', covers: ['Cal'], settles: [], redeemScript: validator.redeem },
  };

  const outcome = composeAndDerive(plan, [artifacts.Caller!, artifacts.Cal!], [rootOf('Caller', 'start', 'caller-1')]);
  expect(outcome.verdicts.filter((verdict) => !verdict.accepted)
    .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`)).toStrictEqual([]);
  expect(outcome.completed.map((frame) => frame.functionName))
    .toStrictEqual([entryName('Cal', 'f'), entryName('Caller', 'start')]);

  // The callee returned the result the plan recorded, and the caller's record carries it.
  expect(decodeWitnessBlock(splitFirstPush(outcome.draft.unlockingBytecodeOf('cal-1')).payload).retval)
    .toStrictEqual(expectedResult);
  const record = decodeWitnessBlock(splitFirstPush(outcome.draft.unlockingBytecodeOf('caller-1')).payload).calls[0]!;
  expect(record.result).toStrictEqual(expectedResult);
  const decoded = decodePushdataValue(record.result, 0, spec.type);
  expect(decoded.bytesConsumed).toBe(record.result.length);
  return decoded.value as unknown as readonly bigint[];
}

/** A callee that requires the elements it read and returns them unchanged. */
const identitySource = (type: string, requirements: readonly string[]): ArrayCase['source'] =>
  (calleeAddress: string, argument: string): string => 'pragma solidcash ^0.14.0;'
    + ` interface ICal { function f(${type} xs) pure returns (${type}); }`
    + ` contract Cal { function f(${type} xs) pure returns (${type}) {`
    + `${requirements.map((check) => `   require(${check});`).join('')} return xs; } }`
    + ' contract Caller { function start() {'
    + `   ${type} r = ICal(0x${calleeAddress}).f(${argument});`
    + `${requirements.map((check) => `   require(${check.replace(/xs/g, 'r')});`).join('')} require(true); } }`;

describe('fixed-size array arguments and results across a read-only call', () => {
  it('drives uint16[4] in and out', () => {
    const spec: ArrayCase = {
      label: 'uint16[4]', type: 'uint16[4]', argument: encodePushdataValue([1n, 2n, 3n, 4n], 'uint16[4]'),
      result: [1n, 2n, 3n, 4n],
      source: identitySource('uint16[4]', ['xs[0] == 1', 'xs[1] == 2', 'xs[2] == 3', 'xs[3] == 4']),
    };
    expect(drive(spec)).toStrictEqual([1n, 2n, 3n, 4n]);
  });

  it('drives an int16[2] argument with a negative element', () => {
    const spec: ArrayCase = {
      label: 'int16[2]', type: 'int16[2]', argument: encodePushdataValue([-1n, 2n], 'int16[2]'),
      result: [-1n, 2n],
      source: identitySource('int16[2]', ['xs[0] == -1', 'xs[1] == 2']),
    };
    expect(drive(spec)).toStrictEqual([-1n, 2n]);
  });

  it('drives a uint16[5] return the callee computes from a scalar argument', () => {
    const argument = encodeIntegerValue(1n);
    const spec: ArrayCase = {
      label: 'uint16[5] return', type: 'uint16[5]', argument, argumentExpression: decodeIntegerValue(argument).toString(),
      result: [1n, 2n, 3n, 4n, 5n],
      source: (calleeAddress: string, argumentExpression: string): string => 'pragma solidcash ^0.14.0;'
        + ' interface ICal { function f(uint16 x) pure returns (uint16[5]); }'
        + ' contract Cal { function f(uint16 x) pure returns (uint16[5]) {'
        + '   uint16[5] r; r[0] = x; r[1] = x + 1; r[2] = x + 2; r[3] = x + 3; r[4] = x + 4; return r; } }'
        + ' contract Caller { function start() {'
        + `   uint16[5] r = ICal(0x${calleeAddress}).f(${argumentExpression});`
        + '   require(r[0] == 1); require(r[4] == 5); require(true); } }',
    };
    expect(drive(spec)).toStrictEqual([1n, 2n, 3n, 4n, 5n]);
  });
});
