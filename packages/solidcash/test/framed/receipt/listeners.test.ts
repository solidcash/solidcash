import { describe, expect, it } from 'vitest';
import { FrameKind, encodeEventCommitment } from '@solidcash/utils';
import { eventOutput } from '../../../../solidc/test/framed/master/event-input.js';
import type { CompositionDraftPlan, DraftInput } from '../../../src/framed/composer/index.js';
import {
  compositionLogListeners, type CompositionEventLog,
} from '../../../src/framed/receipt/index.js';
import {
  USER_LOCK, VALIDATOR_PROGRAM, composeAndDerive, compileAndDeploy, hexOf, master, masterInput,
  rootOf, seededAddress, selectorOf, token, userInput, validatorFor,
} from '../shapes/harness.js';

/**
 * Delivering a composition's logs to the handlers registered for their contracts.
 *
 * A caller registers a handler for the address of the contract it cares about; delivering a composition's logs
 * reaches exactly the handlers registered for the address each log was emitted by. The nested case is the one that
 * matters: an event a callee frame emitted inside a caller's transaction is delivered to the callee's handler, not
 * the caller's.
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

const BIG = 452312848583266388373324160190187140051835877600158453279131187530910662656n;
const EMITTER_LABEL = 'the nested listener emitter';
const emitterAddress = seededAddress(EMITTER_LABEL);

// The caller emits an event of its own and then calls the emitter, whose nested frame emits another.
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IEmitter { function fire(); }'
  + ' contract Emitter { event Report(int a);'
  + `   function fire() { emit Report(${BIG}); require(true); } }`
  + ' contract Caller { event Ping(int x);'
  + `   function start() { emit Ping(1); IEmitter(0x${hexOf(emitterAddress)}).fire.call(); require(true); } }`;

/** Compiles, deploys and plans the nested composition, then derives and evaluates it. */
function composeFresh(): {
  readonly draft: ReturnType<typeof composeAndDerive>['draft'];
  readonly artifacts: ReturnType<typeof compileAndDeploy>['artifacts'];
  readonly contracts: ReturnType<typeof compileAndDeploy>['contracts'];
} {
  const { artifacts, contracts } = compileAndDeploy(SOURCE, {
    Caller: 'the listening caller', Emitter: EMITTER_LABEL,
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
            kind: FrameKind.CALL, callee: 'emitter-1', target: emitter.address, value: 0n, argumentPushes: [fire],
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
        encodeEventCommitment(emitterEvent.parameters, [BIG]),
      ),
      user: userInput(),
    },
    validator: { id: 'validator', covers: ['Emitter'], settles: [], redeemScript: validator.redeem },
  };

  const outcome = composeAndDerive(plan, [artifacts.Caller!, artifacts.Emitter!], [
    rootOf('Caller', 'start', 'caller-1'),
  ]);
  expect(outcome.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  return { draft: outcome.draft, artifacts, contracts };
}

let shared: ReturnType<typeof composeFresh> | undefined;

/** The nested composition, derived once: each case registers its own handlers and only reads it. */
function composed(): ReturnType<typeof composeFresh> {
  shared ??= composeFresh();
  return shared;
}

describe('a composition\'s logs delivered to registered handlers', () => {
  it('reaches only the handler registered for the emitting contract', () => {
    const { draft, artifacts, contracts } = composed();
    const listeners = compositionLogListeners();
    const callerLogs: CompositionEventLog[] = [];
    const emitterLogs: CompositionEventLog[] = [];
    listeners.addListener(contracts.Caller!.address, (log) => callerLogs.push(log));
    listeners.addListener(contracts.Emitter!.address, (log) => emitterLogs.push(log));

    const delivered = listeners.deliverComposition(draft, [artifacts.Caller!, artifacts.Emitter!], {
      validatorProgram: VALIDATOR_PROGRAM,
    });

    expect(delivered.map((log) => log.eventName)).toStrictEqual(['Ping', 'Report']);
    // The caller's handler sees only the caller's own event, and the emitter's only the nested frame's.
    expect(callerLogs.map((log) => log.eventName)).toStrictEqual(['Ping']);
    expect(emitterLogs.map((log) => log.eventName)).toStrictEqual(['Report']);
  });

  it('delivers a nested emitter\'s log to its own contract\'s handler', () => {
    const { draft, artifacts, contracts } = composed();
    const listeners = compositionLogListeners();
    const emitterLogs: CompositionEventLog[] = [];
    listeners.addListener(contracts.Emitter!.address, (log) => emitterLogs.push(log));

    listeners.deliverComposition(draft, [artifacts.Caller!, artifacts.Emitter!], {
      validatorProgram: VALIDATOR_PROGRAM,
    });

    expect(emitterLogs).toHaveLength(1);
    const report = emitterLogs[0]!;
    expect(report.eventName).toBe('Report');
    expect(report.emitter).toBe('emitter-1');
    // The log names the emitting frame's contract address, not the root's.
    expect(report.address).toStrictEqual(contracts.Emitter!.address);
    expect(report.values).toStrictEqual([BIG]);
  });

  it('stops delivering to a handler that was removed', () => {
    const { draft, artifacts, contracts } = composed();
    const listeners = compositionLogListeners();
    const delivered: string[] = [];
    const subscription = listeners.addListener(contracts.Caller!.address, (log) => delivered.push(log.eventName));
    expect(listeners.listenerCount(contracts.Caller!.address)).toBe(1);

    listeners.deliverComposition(draft, [artifacts.Caller!, artifacts.Emitter!], {
      validatorProgram: VALIDATOR_PROGRAM,
    });
    expect(delivered).toStrictEqual(['Ping']);

    subscription.remove();
    expect(listeners.listenerCount(contracts.Caller!.address)).toBe(0);
    listeners.deliverComposition(draft, [artifacts.Caller!, artifacts.Emitter!], {
      validatorProgram: VALIDATOR_PROGRAM,
    });
    expect(delivered).toStrictEqual(['Ping']);
  });

  it('registers several handlers for one address and removes one of them', () => {
    const { draft, artifacts, contracts } = composed();
    const listeners = compositionLogListeners();
    const first: string[] = [];
    const second: string[] = [];
    const subscription = listeners.addListener(contracts.Caller!.address, (log) => first.push(log.eventName));
    listeners.addListener(contracts.Caller!.address, (log) => second.push(log.eventName));

    listeners.deliverComposition(draft, [artifacts.Caller!, artifacts.Emitter!], {
      validatorProgram: VALIDATOR_PROGRAM,
    });
    expect(first).toStrictEqual(['Ping']);
    expect(second).toStrictEqual(['Ping']);

    subscription.remove();
    listeners.deliverComposition(draft, [artifacts.Caller!, artifacts.Emitter!], {
      validatorProgram: VALIDATOR_PROGRAM,
    });
    expect(first).toStrictEqual(['Ping']);
    expect(second).toStrictEqual(['Ping', 'Ping']);
  });
});
