import { describe, expect, it } from 'vitest';
import { FrameKind, computeEventNameHash, encodeEventCommitment, hash256 } from '@solidcash/utils';
import {
  compileAndDeploy, composeAndDerive, entryName, hexOf, seededAddress, token, userInput, USER_LOCK,
  selectorOf, validatorFor,
} from '../shapes/harness.js';
import { categorySlotValue } from '../../../../solidc/test/framed/master/validator-input.js';
import type { CompositionDraftPlan, DraftInput, DraftMaster } from '../../../src/framed/composer/index.js';

type CompositionFeedback = ReturnType<typeof composeAndDerive>;

/**
 * Events laid out by the shipped composer and decided by the machine.
 *
 * The event region of a transaction is trailing, so a plan that lists events has to give each one an output the
 * composer materialises. The composer's draft takes an output for every input it places, so the tests below place
 * the event outputs at the trailing indices the layout allocates and give the root user its own input past them.
 * Every event covenant is rebuilt here the way the body rebuilds it, from the emitting contract's category.
 */

/** The lock the emitting body recomputes: category pin, event-signature hash and the relative timelock. */
function eventCovenantLock(category: Uint8Array, signature: string): Uint8Array {
  const nameHash = computeEventNameHash(signature);
  const script = new Uint8Array([
    0xc0, 0xce, 0x01, 0x20, 0x7f, 0x7c,
    0x20, ...categorySlotValue(category),
    0x88, 0x00,
    0x88, 0x14, ...nameHash,
    0x75, 0x02, 0x90, 0x00, 0xb2, 0x75,
    0x51,
  ]);
  return new Uint8Array([0xaa, 0x20, ...hash256(script), 0x87]);
}

/** One input carrying an event output: the plan's output override is the covenant the body will recompute. */
function eventInput(lock: Uint8Array, category: Uint8Array, payload: Uint8Array): DraftInput {
  return {
    source: { lockingBytecode: USER_LOCK, valueSatoshis: 1_000n },
    unlockingBytecode: new Uint8Array([0x51]),
    output: {
      lockingBytecode: lock,
      valueSatoshis: 1_000n,
      token: { category, amount: 0n, nft: { capability: 'none', commitment: payload } },
    },
  };
}

function acceptedInputs(verdicts: CompositionFeedback['verdicts']): string[] {
  return verdicts.filter((verdict) => !verdict.accepted)
    .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
}

describe('the events one transaction carries', () => {
  const SOURCE = 'pragma solidcash ^0.14.0;'
    + ' contract Log {'
    + '   event First(int x);'
    + '   event Second(int y);'
    + '   function fire() { emit First(1); emit Second(2); require(true); }'
    + ' }';

  it('places two events at distinct trailing outputs and the machine accepts both', () => {
    const { artifacts, contracts } = compileAndDeploy(SOURCE, { Log: 'two events at one contract' });
    const log = contracts.Log!;
    const events = artifacts.Log!.events!;
    const indices = [1, 2];
    const payloads = [
      encodeEventCommitment(events[0]!.parameters, [1n]),
      encodeEventCommitment(events[1]!.parameters, [2n]),
    ];
    const locks = events.map((event) => eventCovenantLock(log.category, event.signature));

    const master: DraftMaster = {
      master: 'log-1', contract: 'Log', functionName: entryName('Log', 'fire'), program: log.program,
      facts: {
        contract: 'Log', functionName: 'fire', kind: FrameKind.ROOT,
        callerIsUser: true, originEqualsCaller: true, makesExternalCall: false, mastersOfContract: 1,
      },
      frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: log.address, value: 0n },
      enteredBy: 'user', origin: 'user', calls: [], retval: new Uint8Array(0),
      segments: [[]], events: indices, sends: [], argumentPushes: [], redeemScript: log.program,
    };
    const plan: CompositionDraftPlan = {
      blocks: [{ contract: 'Log', masters: ['log-1'], state: [] }],
      userInputs: [{ id: 'event-0', index: indices[0]! }, { id: 'event-1', index: indices[1]! }, { id: 'user', index: 3 }],
      masters: [master],
      inputs: {
        'log-1': { source: { lockingBytecode: log.lockingBytecode, valueSatoshis: 20_000n, token: token(log.category, 'minting') } },
        'event-0': eventInput(locks[0]!, log.category, payloads[0]!),
        'event-1': eventInput(locks[1]!, log.category, payloads[1]!),
        user: {
          source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
          unlockingBytecode: userInput().unlockingBytecode,
        },
      },
    };

    const outcome = composeAndDerive(plan, [artifacts.Log!], [
      { contract: 'Log', functionName: entryName('Log', 'fire'), kind: FrameKind.ROOT, master: 'log-1' },
    ]);

    // The composer allocated the two trailing event outputs at the indices the plan named.
    expect(outcome.draft.assembly.outputs.eventIndices).toStrictEqual([1, 2]);
    expect(acceptedInputs(outcome.verdicts)).toStrictEqual([]);
  });
});

describe('an event emitted by a nested frame', () => {
  const emitterAddress = seededAddress('nested event emitter');
  // The unit-level event survey marks every contract in a unit that contains an emit, so the root also emits.
  const SOURCE = 'pragma solidcash ^0.14.0;'
    + ' interface IEmitter { function fire(); }'
    + ' contract Emitter { event Report(int a, int b, int c, int d, int e);'
    + '   function fire() {'
    + '     emit Report(452312848583266388373324160190187140051835877600158453279131187530910662656,'
    + '                 452312848583266388373324160190187140051835877600158453279131187530910662656,'
    + '                 452312848583266388373324160190187140051835877600158453279131187530910662656,'
    + '                 452312848583266388373324160190187140051835877600158453279131187530910662656,'
    + '                 452312848583266388373324160190187140051835877600158453279131187530910662656);'
    + '     require(true); } }'
    + ' contract Caller { event Ping(int x);'
    + `   function start() { emit Ping(1); IEmitter(0x${hexOf(emitterAddress)}).fire.call(); require(true); } }`;

  it('settles a payload above the 128-byte commitment size, emitted by the callee', () => {
    const { artifacts, contracts } = compileAndDeploy(SOURCE, {
      Caller: 'nested event caller', Emitter: 'nested event emitter',
    });
    const caller = contracts.Caller!;
    const emitter = contracts.Emitter!;
    const callerEvent = artifacts.Caller!.events![0]!;
    const emitterEvent = artifacts.Emitter!.events![0]!;
    const big = 452312848583266388373324160190187140051835877600158453279131187530910662656n;
    const callerPayload = encodeEventCommitment(callerEvent.parameters, [1n]);
    const emitterPayload = encodeEventCommitment(emitterEvent.parameters, [big, big, big, big, big]);
    expect(emitterPayload.length).toBeGreaterThan(128);

    const validator = validatorFor(caller.category);
    const selector = selectorOf(artifacts, 'Emitter', 'fire');
    const callerMaster: DraftMaster = {
      master: 'caller-1', contract: 'Caller', functionName: entryName('Caller', 'start'), program: caller.program,
      facts: {
        contract: 'Caller', functionName: 'start', kind: FrameKind.ROOT,
        callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
      },
      frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: caller.address, value: 0n },
      enteredBy: 'user', origin: 'user',
      calls: [{ kind: FrameKind.CALL, callee: 'emitter-1', target: emitter.address, value: 0n, argumentPushes: [selector] }],
      retval: new Uint8Array(0), segments: [[], []],
      // The facet the validator binds is one participant ahead of the events.
      events: [4], sends: [], argumentPushes: [], redeemScript: caller.program,
    };
    const emitterMaster: DraftMaster = {
      master: 'emitter-1', contract: 'Emitter', functionName: entryName('Emitter', 'fire'), program: emitter.program,
      facts: {
        contract: 'Emitter', functionName: 'fire', kind: FrameKind.CALL,
        callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
      },
      frame: { kind: FrameKind.CALL, sender: caller.address, self: emitter.address, value: 0n },
      enteredBy: 'caller-1', origin: 'user', calls: [], retval: new Uint8Array(0), segments: [[]],
      // The facet the validator binds is one participant ahead of the events.
      events: [5], sends: [], argumentPushes: [selector], redeemScript: emitter.program,
    };
    const plan: CompositionDraftPlan = {
      blocks: [
        { contract: 'Caller', masters: ['caller-1'], validator: { id: 'validator', settles: [] }, state: [] },
        { contract: 'Emitter', masters: ['emitter-1'], state: [] },
      ],
      // The facet the validator binds is one participant ahead of the users.
      userInputs: [{ id: 'event-0', index: 4 }, { id: 'event-1', index: 5 }, { id: 'user', index: 6 }],
      masters: [callerMaster, emitterMaster],
      inputs: {
        'caller-1': { source: { lockingBytecode: caller.lockingBytecode, valueSatoshis: 20_000n, token: token(caller.category, 'minting') } },
        'emitter-1': { source: { lockingBytecode: emitter.lockingBytecode, valueSatoshis: 20_000n, token: token(emitter.category, 'minting') } },
        validator: { source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(caller.category, 'mutable') } },
        'event-0': eventInput(eventCovenantLock(caller.category, callerEvent.signature), caller.category, callerPayload),
        'event-1': eventInput(eventCovenantLock(emitter.category, emitterEvent.signature), emitter.category, emitterPayload),
        user: {
          source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
          unlockingBytecode: userInput().unlockingBytecode,
        },
      },
      validator: { id: 'validator', covers: ['Emitter'], settles: [], redeemScript: validator.redeem },
    };

    const outcome = composeAndDerive(plan, [artifacts.Caller!, artifacts.Emitter!], [
      { contract: 'Caller', functionName: entryName('Caller', 'start'), kind: FrameKind.ROOT, master: 'caller-1' },
    ]);

    expect(outcome.draft.assembly.outputs.eventIndices).toStrictEqual([4, 5]);
    expect(acceptedInputs(outcome.verdicts)).toStrictEqual([]);
    // The callee's own event is one of the two records the transaction creates.
    expect(outcome.verdicts.find((verdict) => verdict.participant === 'emitter-1')?.accepted).toBe(true);
  });
});
