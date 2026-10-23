import { describe, expect, it } from 'vitest';
import {
  FrameKind, bytesEqual, encodeEventCommitment, validatorAddress,
} from '@solidcash/utils';
import { eventOutput } from '../../../../solidc/test/framed/master/event-input.js';
import type { CompositionDraftPlan, DraftInput } from '../../../src/framed/composer/index.js';
import { compositionEventLogs } from '../../../src/framed/receipt/index.js';
import {
  USER_LOCK, VALIDATOR_PROGRAM, composeAndDerive, compileAndDeploy, hexOf, master, masterInput,
  rootOf, seededAddress, selectorOf, token, userInput, userInputs, validatorFor,
} from '../shapes/harness.js';

/**
 * The receipt a composition's declared event outputs read back into.
 *
 * A caller wants what ethers gives it: a log per event, naming the address that emitted it and the decoded fields.
 * These cases drive the shipped path end to end — compile, deploy, compose, derive, machine verdict — and then read
 * the accepted composition's own declared event outputs through `compositionEventLogs`, so every coordinate comes
 * from the composer and every commitment from the shipped encoders. The nested case is the one that matters: an
 * event a callee frame emitted inside a caller's transaction is reported with the callee's address.
 */

/** A user input that recreates itself as a stated event output, the way a plan lays a trailing event out. */
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

/** The lock a plan states for an event output: the shipped covenant for the contract's category and signature. */
function eventLock(category: Uint8Array, signature: string): Uint8Array {
  return eventOutput(category, signature, new Uint8Array(0)).lockingBytecode;
}

/** The participants whose machine verdict was a refusal, named with the refusal. */
function refusedInputs(outcome: ReturnType<typeof composeAndDerive>): string[] {
  return outcome.verdicts.filter((verdict) => !verdict.accepted)
    .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
}

describe('an event emitted by a nested frame', () => {
  const BIG = 452312848583266388373324160190187140051835877600158453279131187530910662656n;
  const EMITTER_LABEL = 'the nested event emitter';
  const emitterAddress = seededAddress(EMITTER_LABEL);
  // The caller emits an event of its own and then calls the emitter, whose own event the nested frame emits.
  const SOURCE = 'pragma solidcash ^0.14.0;'
    + ' interface IEmitter { function fire(); }'
    + ' contract Emitter { event Report(int a, int b, int c, int d, int e);'
    + `   function fire() { emit Report(${BIG}, ${BIG}, ${BIG}, ${BIG}, ${BIG}); require(true); } }`
    + ' contract Caller { event Ping(int x);'
    + `   function start() { emit Ping(1); IEmitter(0x${hexOf(emitterAddress)}).fire.call(); require(true); } }`;

  /** The nested plan, with the caller's own event at output 3 and the callee's at 4. */
  function buildNested(callerValues: readonly bigint[] = [1n]): {
    plan: CompositionDraftPlan;
    artifacts: ReturnType<typeof compileAndDeploy>['artifacts'];
    contracts: ReturnType<typeof compileAndDeploy>['contracts'];
  } {
    const { artifacts, contracts } = compileAndDeploy(SOURCE, {
      Caller: 'the emitting caller', Emitter: EMITTER_LABEL,
    });
    const caller = contracts.Caller!;
    const emitter = contracts.Emitter!;
    const callerEvent = artifacts.Caller!.events![0]!;
    const emitterEvent = artifacts.Emitter!.events![0]!;
    const validator = validatorFor(caller.category);
    const fire = selectorOf(artifacts, 'Emitter', 'fire');
    const payload = encodeEventCommitment(callerEvent.parameters, [...callerValues]);

    const plan: CompositionDraftPlan = {
      blocks: [
        { contract: 'Caller', masters: ['caller-1'], validator: { id: 'validator', settles: [] }, state: [] },
        { contract: 'Emitter', masters: ['emitter-1'], state: [] },
      ],
      userInputs: [
        // The facet the validator binds is one participant ahead of the users.
        { id: 'event-caller', index: 4 },
        { id: 'event-emitter', index: 5 },
        { id: 'user', index: 6 },
      ],
      masters: [
        {
          ...master({
            master: 'caller-1', contract: 'Caller', entry: 'start', program: caller.program,
            facts: {
              contract: 'Caller', functionName: 'start', kind: FrameKind.ROOT,
              callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
            },
            frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: caller.address, value: 0n },
            enteredBy: 'user', origin: 'user',
            calls: [{
              kind: FrameKind.CALL, callee: 'emitter-1', target: emitter.address,
              value: 0n, argumentPushes: [fire],
            }],
          }),
          // The facet the validator binds is one participant ahead of the events.
          events: [4],
        },
        {
          ...master({
            master: 'emitter-1', contract: 'Emitter', entry: 'fire', program: emitter.program,
            facts: {
              contract: 'Emitter', functionName: 'fire', kind: FrameKind.CALL,
              callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
            },
            frame: { kind: FrameKind.CALL, sender: caller.address, self: emitter.address, value: 0n },
            enteredBy: 'caller-1', origin: 'user', argumentPushes: [fire],
          }),
          // The facet the validator binds is one participant ahead of the events.
          events: [5],
        },
      ],
      inputs: {
        'caller-1': { source: masterInput(caller) },
        'emitter-1': { source: masterInput(emitter) },
        validator: {
          source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(caller.category, 'mutable') },
        },
        'event-caller': eventInput(eventLock(caller.category, callerEvent.signature), caller.category, payload),
        'event-emitter': eventInput(
          eventLock(emitter.category, emitterEvent.signature), emitter.category,
          encodeEventCommitment(emitterEvent.parameters, [BIG, BIG, BIG, BIG, BIG]),
        ),
        user: userInput(),
      },
      validator: { id: 'validator', covers: ['Emitter'], settles: [], redeemScript: validator.redeem },
    };
    return { plan, artifacts, contracts };
  }

  it('reports the callee\'s event with the callee\'s address and the caller\'s with the caller\'s', () => {
    const { plan, artifacts, contracts } = buildNested();
    const caller = contracts.Caller!;
    const emitter = contracts.Emitter!;

    const outcome = composeAndDerive(plan, [artifacts.Caller!, artifacts.Emitter!], [
      rootOf('Caller', 'start', 'caller-1'),
    ]);
    expect(refusedInputs(outcome)).toStrictEqual([]);

    const logs = compositionEventLogs(outcome.draft, [artifacts.Caller!, artifacts.Emitter!], {
      validatorProgram: VALIDATOR_PROGRAM,
    });
    // The events sit one participant on: the caller, the head, the facet it binds, then the events.
    expect(logs.map((log) => log.outputIndex)).toStrictEqual([4, 5]);

    // The caller's own event, reported with the caller's address.
    const ping = logs.find((log) => log.eventName === 'Ping')!;
    expect(ping.emitter).toBe('caller-1');
    expect(ping.contract).toBe('Caller');
    expect(ping.eventSignature).toBe(artifacts.Caller!.events![0]!.signature);
    expect(ping.values).toStrictEqual([1n]);
    expect(ping.args).toStrictEqual({ x: 1n });
    expect(ping.address).toStrictEqual(caller.address);

    // The nested frame's event, reported with the callee's address and its fields in declared order.
    const report = logs.find((log) => log.eventName === 'Report')!;
    expect(report.emitter).toBe('emitter-1');
    expect(report.contract).toBe('Emitter');
    expect(report.eventSignature).toBe(artifacts.Emitter!.events![0]!.signature);
    expect(report.address).toStrictEqual(emitter.address);
    expect(report.address).toStrictEqual(validatorAddress(emitter.category, VALIDATOR_PROGRAM));
    expect(report.values).toStrictEqual([BIG, BIG, BIG, BIG, BIG]);
    expect(Object.keys(report.args)).toStrictEqual(
      artifacts.Emitter!.events![0]!.parameters.map((parameter) => parameter.name),
    );
    expect(report.args).toStrictEqual({ a: BIG, b: BIG, c: BIG, d: BIG, e: BIG });

    // The reported address is the emitter's `addrV`, not the event covenant the output sits at.
    const covenantLock = outcome.draft.programFor('emitter-1').transaction.outputs[4]!.lockingBytecode;
    expect(bytesEqual(report.address, covenantLock)).toBe(false);
  });

  it('refuses a payload the listing entry did not compute, so no log is reached for it', () => {
    // The caller emits `Ping(1)`. A plan that states a different payload at the caller's event output is one the
    // caller's own body does not close against, so the derivation refuses before it completes and the receipt is
    // never read. Measured: the segment's close is where the refusal lands, not a per-input verdict after the fact.
    const { plan, artifacts } = buildNested([9n]);
    expect(() => composeAndDerive(plan, [artifacts.Caller!, artifacts.Emitter!], [
      rootOf('Caller', 'start', 'caller-1'),
    ])).toThrow(/FRAMED_DERIVATION_STALLED/);
  });
});

describe('a composition that emits nothing', () => {
  const SOURCE = 'pragma solidcash ^0.14.0; contract Solo { function ping() { require(true); } }';

  it('reports no logs', () => {
    const { artifacts, contracts } = compileAndDeploy(SOURCE, { Solo: 'a quiet contract' });
    const solo = contracts.Solo!;
    const plan: CompositionDraftPlan = {
      blocks: [{ contract: 'Solo', masters: ['solo-1'], state: [] }],
      userInputs: userInputs(['user'], 1),
      masters: [master({
        master: 'solo-1', contract: 'Solo', entry: 'ping', program: solo.program,
        facts: {
          contract: 'Solo', functionName: 'ping', kind: FrameKind.ROOT,
          callerIsUser: true, originEqualsCaller: true, makesExternalCall: false, mastersOfContract: 1,
        },
        frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: solo.address, value: 0n },
        enteredBy: 'user', origin: 'user',
      })],
      inputs: { 'solo-1': { source: masterInput(solo) }, user: userInput() },
    };
    const outcome = composeAndDerive(plan, [artifacts.Solo!], [rootOf('Solo', 'ping', 'solo-1')]);
    expect(refusedInputs(outcome)).toStrictEqual([]);
    expect(compositionEventLogs(outcome.draft, [artifacts.Solo!], { validatorProgram: VALIDATOR_PROGRAM }))
      .toStrictEqual([]);
  });
});

describe('an event covenant no frame lists', () => {
  const EMITTER_LABEL = 'the unlisted event emitter';
  const emitterAddress = seededAddress(EMITTER_LABEL);
  const SOURCE = 'pragma solidcash ^0.14.0;'
    + ' interface IEmitter { function fire(); }'
    + ' contract Emitter { event Report(int a);'
    + '   function fire() { emit Report(7); require(true); } }'
    + ' contract Caller { event Ping(int x);'
    + `   function start() { emit Ping(1); IEmitter(0x${hexOf(emitterAddress)}).fire.call(); require(true); } }`;

  it('is not reported, because the frames are the census', () => {
    const { artifacts, contracts } = compileAndDeploy(SOURCE, {
      Caller: 'the emitting caller for the stray output', Emitter: EMITTER_LABEL,
    });
    const caller = contracts.Caller!;
    const emitter = contracts.Emitter!;
    const callerEvent = artifacts.Caller!.events![0]!;
    const emitterEvent = artifacts.Emitter!.events![0]!;
    const validator = validatorFor(caller.category);
    const fire = selectorOf(artifacts, 'Emitter', 'fire');

    const plan: CompositionDraftPlan = {
      blocks: [
        { contract: 'Caller', masters: ['caller-1'], validator: { id: 'validator', settles: [] }, state: [] },
        { contract: 'Emitter', masters: ['emitter-1'], state: [] },
      ],
      userInputs: [
        // The facet the validator binds is one participant ahead of the users.
        { id: 'event-caller', index: 4 },
        { id: 'event-emitter', index: 5 },
        { id: 'user', index: 6 },
      ],
      masters: [
        {
          ...master({
            master: 'caller-1', contract: 'Caller', entry: 'start', program: caller.program,
            facts: {
              contract: 'Caller', functionName: 'start', kind: FrameKind.ROOT,
              callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
            },
            frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: caller.address, value: 0n },
            enteredBy: 'user', origin: 'user',
            calls: [{
              kind: FrameKind.CALL, callee: 'emitter-1', target: emitter.address,
              value: 0n, argumentPushes: [fire],
            }],
          }),
          // The facet the validator binds is one participant ahead of the events.
          events: [4],
        },
        {
          ...master({
            master: 'emitter-1', contract: 'Emitter', entry: 'fire', program: emitter.program,
            facts: {
              contract: 'Emitter', functionName: 'fire', kind: FrameKind.CALL,
              callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
            },
            frame: { kind: FrameKind.CALL, sender: caller.address, self: emitter.address, value: 0n },
            enteredBy: 'caller-1', origin: 'user', argumentPushes: [fire],
          }),
          // The facet the validator binds is one participant ahead of the events.
          events: [5],
        },
      ],
      inputs: {
        'caller-1': { source: masterInput(caller) },
        'emitter-1': { source: masterInput(emitter) },
        validator: {
          source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(caller.category, 'mutable') },
        },
        'event-caller': eventInput(
          eventLock(caller.category, callerEvent.signature), caller.category,
          encodeEventCommitment(callerEvent.parameters, [1n]),
        ),
        'event-emitter': eventInput(
          eventLock(emitter.category, emitterEvent.signature), emitter.category,
          encodeEventCommitment(emitterEvent.parameters, [7n]),
        ),
        user: userInput(),
      },
      validator: { id: 'validator', covers: ['Emitter'], settles: [], redeemScript: validator.redeem },
    };

    const outcome = composeAndDerive(plan, [artifacts.Caller!, artifacts.Emitter!], [
      rootOf('Caller', 'start', 'caller-1'),
    ]);
    expect(refusedInputs(outcome)).toStrictEqual([]);

    const derived = outcome.draft.programFor('caller-1').transaction.outputs;
    const listed = compositionEventLogs(outcome.draft, [artifacts.Caller!, artifacts.Emitter!], {
      validatorProgram: VALIDATOR_PROGRAM,
    });
    expect(listed.map((log) => log.outputIndex)).toStrictEqual([4, 5]);

    // The transaction carries one more output locked by a listed event's own covenant, but no frame lists it, so
    // the frames' declarations are the census and it is not reported.
    const stray = eventOutput(caller.category, callerEvent.signature, encodeEventCommitment(callerEvent.parameters, [1n]));
    const withStray = compositionEventLogs(outcome.draft, [artifacts.Caller!, artifacts.Emitter!], {
      validatorProgram: VALIDATOR_PROGRAM,
      outputs: [...derived, stray as unknown as (typeof derived)[number]],
    });
    expect(withStray.map((log) => log.outputIndex)).toStrictEqual([4, 5]);
  });
});
