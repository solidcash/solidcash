import { describe, expect, it } from 'vitest';
import { FrameKind } from '@solidcash/utils';
import {
  compileAndDeploy, composeAndDerive, entryName, hexOf, rootOf, seededAddress, token, userInput, USER_LOCK,
  selectorOf, validatorFor,
} from '../shapes/harness.js';
import type { CompositionDraftPlan, DraftMaster } from '../../../src/framed/composer/index.js';

/**
 * A callee that authorizes its caller from the frame it was reached in.
 *
 * `msg.sender` is the caller master's address, carried in the callee's witness block rather than read from the
 * transaction's own inputs, so an accepted spend is the composer's frame reaching that callee check. The `tx.origin`
 * guard across the same hop is `toys/identity.test.ts`'s.
 */

const CALLER_ADDRESS = seededAddress('nested authority caller');
const CAL_ADDRESS = seededAddress('nested authority cal');

/** Compiles a Caller -> Cal composition whose callee entry is guarded by `guard`, and settles it. */
function settleGuard(guard: string): ReturnType<typeof composeAndDerive> {
  const source = 'pragma solidcash ^0.14.0;'
    + ' interface ICal { function check(); }'
    + ` contract Cal { function check() { ${guard} require(true); } }`
    + ' contract Caller { function start() {'
    + `   ICal(0x${hexOf(CAL_ADDRESS)}).check.call(); require(true); } }`;
  const { artifacts, contracts } = compileAndDeploy(source, {
    Caller: 'nested authority caller', Cal: 'nested authority cal',
  });
  const caller = contracts.Caller!;
  const cal = contracts.Cal!;
  const validator = validatorFor(caller.category);
  const selector = selectorOf(artifacts, 'Cal', 'check');

  const callerMaster: DraftMaster = {
    master: 'caller-1', contract: 'Caller', functionName: entryName('Caller', 'start'), program: caller.program,
    facts: {
      contract: 'Caller', functionName: 'start', kind: FrameKind.ROOT,
      callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: caller.address, value: 0n },
    enteredBy: 'user', origin: 'user',
    calls: [{ kind: FrameKind.CALL, callee: 'cal-1', target: cal.address, value: 0n, argumentPushes: [selector] }],
    retval: new Uint8Array(0), segments: [[], []], events: [], sends: [], argumentPushes: [], redeemScript: caller.program,
  };
  const calMaster: DraftMaster = {
    master: 'cal-1', contract: 'Cal', functionName: entryName('Cal', 'check'), program: cal.program,
    facts: {
      contract: 'Cal', functionName: 'check', kind: FrameKind.CALL,
      callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
    },
    // The callee's sender is the caller's address; its origin is the root user's input.
    frame: { kind: FrameKind.CALL, sender: caller.address, self: cal.address, value: 0n },
    enteredBy: 'caller-1', origin: 'user', calls: [], retval: new Uint8Array(0), segments: [[]],
    events: [], sends: [], argumentPushes: [selector], redeemScript: cal.program,
  };
  const plan: CompositionDraftPlan = {
    blocks: [
      { contract: 'Caller', masters: ['caller-1'], validator: { id: 'validator', settles: [] }, state: [] },
      { contract: 'Cal', masters: ['cal-1'], state: [] },
    ],
    // The facet the validator binds is one participant ahead of the user.
    userInputs: [{ id: 'user', index: 4 }],
    masters: [callerMaster, calMaster],
    inputs: {
      'caller-1': { source: { lockingBytecode: caller.lockingBytecode, valueSatoshis: 20_000n, token: token(caller.category, 'minting') } },
      'cal-1': { source: { lockingBytecode: cal.lockingBytecode, valueSatoshis: 20_000n, token: token(cal.category, 'minting') } },
      validator: { source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(caller.category, 'mutable') } },
      user: {
        source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
        unlockingBytecode: userInput().unlockingBytecode,
      },
    },
    validator: { id: 'validator', covers: ['Cal'], settles: [], redeemScript: validator.redeem },
  };
  return composeAndDerive(plan, [artifacts.Caller!, artifacts.Cal!], [rootOf('Caller', 'start', 'caller-1')]);
}

/** The machine's objections to a composition, naming the input that was rejected. */
function objections(outcome: ReturnType<typeof composeAndDerive>): string[] {
  return outcome.verdicts.filter((verdict) => !verdict.accepted)
    .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
}

describe('authorization read from the frame a call produced', () => {
  it('settles a callee whose entry guards on msg.sender against its caller', () => {
    const outcome = settleGuard(`require(msg.sender == 0x${hexOf(CALLER_ADDRESS)});`);
    expect(objections(outcome)).toStrictEqual([]);
    expect(outcome.completed.map((frame) => frame.functionName))
      .toStrictEqual([entryName('Cal', 'check'), entryName('Caller', 'start')]);
  });
});
