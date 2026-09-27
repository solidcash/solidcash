import { describe, expect, it } from 'vitest';
import { FrameKind } from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { composeDraft, participant, type CompositionDraftPlan } from '../../../src/per-call/composer/index.js';
import {
  USER_LOCK, composeAndDerive, compileAndDeploy, entryName, hexOf, master, masterInput,
  rootOf, seededAddress, selectorOf, selectorOfSignature, token, userInput, userInputs, validatorFor,
  type DeployedContract,
} from './harness.js';

/**
 * The composition shapes the per-call composer has to lay out.
 *
 * A shape is which contracts a transaction enters and how they call each other. Each supported shape below is run
 * through the same shipped functions — one compile, one deployment, one composer, one derivation, one machine — and
 * asserted on the composer's own coordinates: the layout it assigned, the order the derivation completed, and the
 * machine's verdict on every contract input. The shapes the shipped code does not support are asserted to refuse,
 * and only through the real error the shipped code raises.
 */

/** Fails the test naming the participating input that the machine rejected, and why. */
function expectEveryContractInputAccepted(outcome: ReturnType<typeof composeAndDerive>): void {
  const rejected = outcome.verdicts.filter((verdict) => !verdict.accepted);
  expect(rejected.map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`)).toStrictEqual([]);
}

/** Asserts the derivation filled the same bytes assembly produced, so the composer's two outputs agree. */
function expectDerivationConvergedWithAssembly(
  outcome: ReturnType<typeof composeAndDerive>,
  masterIds: readonly string[],
): void {
  expect(outcome.draft.layout).toBe(outcome.draft.assembly.layout);
  for (const masterId of masterIds) {
    const assembled = outcome.draft.assembly.inputs.find((input) => input.id === masterId)!;
    expect(outcome.draft.unlockingBytecodeOf(masterId)).toStrictEqual(assembled.unlockingBytecode);
  }
}

describe('one contract entered once with no calls', () => {
  const SOURCE = 'pragma solidcash ^0.13.0; contract Solo { function ping() { require(true); } }';

  it('lays out one master and its user, derives the single segment, and the machine accepts it', () => {
    const { artifacts, contracts } = compileAndDeploy(SOURCE, { Solo: 'a contract entered once' });
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

    // One master at 0, then the user that entered it; no validator, because the entry stands alone.
    expect(participant(outcome.draft.layout, 'solo-1').index).toBe(0);
    expect(outcome.draft.layout.funderInputBase).toBe(1);
    expect(outcome.draft.assembly.transcript).toBeUndefined();
    expect(outcome.completed.map((frame) => frame.functionName)).toStrictEqual([entryName('Solo', 'ping')]);
    expectEveryContractInputAccepted(outcome);
    expectDerivationConvergedWithAssembly(outcome, ['solo-1']);
  });
});

describe('two contracts where the first calls the second', () => {
  const calleeAddress = seededAddress('the called contract');
  const SOURCE = 'pragma solidcash ^0.13.0;'
    + ' interface ICallee { function ping(); }'
    + ' contract Callee { function ping() { require(true); } }'
    + ' contract Caller {'
    + `   function callIt() { ICallee(0x${hexOf(calleeAddress)}).ping.call(); require(true); }`
    + ' }';

  it('places the callee after the caller and its validator, runs the callee first, and the machine accepts the spend', () => {
    const { artifacts, contracts } = compileAndDeploy(SOURCE, {
      Caller: 'the calling contract', Callee: 'the called contract',
    });
    const caller = contracts.Caller!;
    const callee = contracts.Callee!;
    const validator = validatorFor(caller.category);
    const ping = selectorOf(artifacts, 'Callee', 'ping');

    const plan: CompositionDraftPlan = {
      blocks: [
        { contract: 'Caller', masters: ['caller-1'], validator: { id: 'validator', settles: [] }, state: [] },
        { contract: 'Callee', masters: ['callee-1'], state: [] },
      ],
      userInputs: userInputs(['user'], 3),
      masters: [
        master({
          master: 'caller-1', contract: 'Caller', entry: 'callIt', program: caller.program,
          facts: {
            contract: 'Caller', functionName: 'callIt', kind: FrameKind.ROOT,
            callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
          },
          frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: caller.address, value: 0n },
          enteredBy: 'user', origin: 'user',
          calls: [{ kind: FrameKind.CALL, callee: 'callee-1', target: callee.address, value: 0n, argumentPushes: [ping] }],
        }),
        master({
          master: 'callee-1', contract: 'Callee', entry: 'ping', program: callee.program,
          facts: {
            contract: 'Callee', functionName: 'ping', kind: FrameKind.CALL,
            callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
          },
          frame: { kind: FrameKind.CALL, sender: caller.address, self: callee.address, value: 0n },
          enteredBy: 'caller-1', origin: 'user', argumentPushes: [ping],
        }),
      ],
      inputs: {
        'caller-1': { source: masterInput(caller) },
        'callee-1': { source: masterInput(callee) },
        validator: { source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(caller.category, 'mutable') } },
        user: userInput(),
      },
      validator: { id: 'validator', covers: ['Callee'], settles: [], redeemScript: validator.redeem },
    };

    const outcome = composeAndDerive(plan, [artifacts.Caller!, artifacts.Callee!], [rootOf('Caller', 'callIt', 'caller-1')]);

    // The caller's block holds its master and the validator that binds the call edge; the callee follows.
    expect(['caller-1', 'validator', 'callee-1'].map((id) => participant(outcome.draft.layout, id).index)).toStrictEqual([0, 1, 2]);
    // The derivation completes the callee before the caller resumes.
    expect(outcome.completed.map((frame) => frame.functionName))
      .toStrictEqual([entryName('Callee', 'ping'), entryName('Caller', 'callIt')]);
    // The one call record resolves to the callee's layout index.
    expect(outcome.draft.assembly.calls.map((call) => call.calleeRef)).toStrictEqual([2]);
    expectEveryContractInputAccepted(outcome);
    expectDerivationConvergedWithAssembly(outcome, ['caller-1', 'callee-1']);
  });
});

describe('two independent roots of two different contracts', () => {
  const SOURCE = 'pragma solidcash ^0.13.0;'
    + ' contract First { function left() { require(true); } }'
    + ' contract Second { function right() { require(true); } }';

  it('lays out both masters and both users with no validator, and the machine accepts every input', () => {
    const { artifacts, contracts } = compileAndDeploy(SOURCE, {
      First: 'the first independent contract', Second: 'the second independent contract',
    });
    const first = contracts.First!;
    const second = contracts.Second!;
    const plan: CompositionDraftPlan = {
      blocks: [
        { contract: 'First', masters: ['first-1'], state: [] },
        { contract: 'Second', masters: ['second-1'], state: [] },
      ],
      userInputs: userInputs(['user-first', 'user-second'], 2),
      masters: [
        master({
          master: 'first-1', contract: 'First', entry: 'left', program: first.program,
          facts: {
            contract: 'First', functionName: 'left', kind: FrameKind.ROOT,
            callerIsUser: true, originEqualsCaller: true, makesExternalCall: false, mastersOfContract: 1,
          },
          frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: first.address, value: 0n },
          enteredBy: 'user-first', origin: 'user-first',
        }),
        master({
          master: 'second-1', contract: 'Second', entry: 'right', program: second.program,
          facts: {
            contract: 'Second', functionName: 'right', kind: FrameKind.ROOT,
            callerIsUser: true, originEqualsCaller: true, makesExternalCall: false, mastersOfContract: 1,
          },
          frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: second.address, value: 0n },
          enteredBy: 'user-second', origin: 'user-second',
        }),
      ],
      inputs: {
        'first-1': { source: masterInput(first) },
        'second-1': { source: masterInput(second) },
        'user-first': userInput(),
        'user-second': userInput(),
      },
    };

    const outcome = composeAndDerive(plan, [artifacts.First!, artifacts.Second!], [
      rootOf('First', 'left', 'first-1'),
      rootOf('Second', 'right', 'second-1'),
    ]);

    // Neither root calls the other, so neither needs a validator and each keeps its own user as caller and origin.
    expect(participant(outcome.draft.layout, 'first-1').index).toBe(0);
    expect(participant(outcome.draft.layout, 'second-1').index).toBe(1);
    expect(outcome.draft.assembly.transcript).toBeUndefined();
    expect(outcome.completed.map((frame) => frame.functionName))
      .toStrictEqual([entryName('First', 'left'), entryName('Second', 'right')]);
    expectEveryContractInputAccepted(outcome);
    expectDerivationConvergedWithAssembly(outcome, ['first-1', 'second-1']);
  });
});

describe('one contract entering another of its own entries', () => {
  it('is emitted although the root entry calls and the self-called entry does not', () => {
    // The user enters `start`, which calls `inner` on the same contract, so the contract runs on two masters. One
    // master head serves both: it walks the call section with the length the block declares, and each entry pins
    // that length to the calls its own source makes.
    const ownAddress = seededAddress('the self-calling contract');
    const source = 'pragma solidcash ^0.13.0;'
      + ' interface IOwn { function inner(); }'
      + ' contract Own {'
      + `   function start() { IOwn(0x${hexOf(ownAddress)}).inner.call(); require(true); }`
      + '   function inner() { require(true); }'
      + ' }';
    const artifacts = compileStringMulti(source, { composition: 'per-call' });
    expect(artifacts.Own?.composition?.convention).toBe('per-call');
    expect(artifacts.Own?.abi.map((entry) => entry.name).sort()).toEqual(['inner', 'start']);
  });

  it('is refused by the compiler when the self-call target is address(this): the site holds no single value to check', () => {
    const source = 'pragma solidcash ^0.13.0;'
      + ' interface IOwn { function inner(); }'
      + ' contract Own {'
      + '   function start() { IOwn(address(this)).inner.call(); require(true); }'
      + '   function inner() { require(true); }'
      + ' }';
    expect(() => compileStringMulti(source, { composition: 'per-call' }))
      .toThrow(/does not hold as one value/);
  });
});

describe('a call and a return call between two contracts', () => {
  it('is emitted although the re-entered contract\'s entries make different numbers of calls', () => {
    // The first contract's `begin` calls the second's `respond`; `respond` calls the first's `finish`, so the first
    // contract is entered twice. Its two entries make different numbers of calls, and one head serves both because
    // the body that runs pins the block's declared length to its own.
    const firstAddress = seededAddress('the returning contract');
    const secondAddress = seededAddress('the called-back contract');
    const source = 'pragma solidcash ^0.13.0;'
      + ' interface ISecond { function respond(); }'
      + ' interface IFirst { function finish(); }'
      + ' contract First {'
      + `   function begin() { ISecond(0x${hexOf(secondAddress)}).respond.call(); require(true); }`
      + '   function finish() { require(true); }'
      + ' }'
      + ' contract Second {'
      + `   function respond() { IFirst(0x${hexOf(firstAddress)}).finish.call(); require(true); }`
      + ' }';
    const artifacts = compileStringMulti(source, { composition: 'per-call' });
    expect(artifacts.First?.abi.map((entry) => entry.name).sort()).toEqual(['begin', 'finish']);
    expect(artifacts.Second?.abi.map((entry) => entry.name)).toEqual(['respond']);
  });
});

describe('a three-contract chain that calls back to the first', () => {
  it('is emitted although two contracts in the chain are re-entered', () => {
    // First.begin -> Second.middle -> Third.end -> Second.back -> First.finish. Both First and Second are entered
    // twice, each through a second entry that makes no call; each contract's master serves both of its entries.
    const firstAddress = seededAddress('the chain head');
    const secondAddress = seededAddress('the chain middle');
    const thirdAddress = seededAddress('the chain tail');
    const source = 'pragma solidcash ^0.13.0;'
      + ' interface ISecond { function middle(); function back(); }'
      + ' interface IThird { function end(); }'
      + ' interface IFirst { function finish(); }'
      + ' contract First {'
      + `   function begin() { ISecond(0x${hexOf(secondAddress)}).middle.call(); require(true); }`
      + '   function finish() { require(true); }'
      + ' }'
      + ' contract Second {'
      + `   function middle() { IThird(0x${hexOf(thirdAddress)}).end.call(); require(true); }`
      + `   function back() { IFirst(0x${hexOf(firstAddress)}).finish.call(); require(true); }`
      + ' }'
      + ' contract Third {'
      + `   function end() { ISecond(0x${hexOf(secondAddress)}).back.call(); require(true); }`
      + ' }';
    const artifacts = compileStringMulti(source, { composition: 'per-call' });
    expect(artifacts.First?.abi.map((entry) => entry.name).sort()).toEqual(['begin', 'finish']);
    expect(artifacts.Second?.abi.length).toBe(2);
    expect(artifacts.Third?.abi.length).toBe(1);
  });
});

describe('two entry points of one contract entered independently', () => {
  const SOURCE = 'pragma solidcash ^0.13.0;'
    + ' contract Twin { function left() { require(true); } function right() { require(true); } }';

  /** Two masters of one contract, one validator, entered by two separate users. */
  function planFor(twin: DeployedContract, withSelectors: boolean): CompositionDraftPlan {
    const validator = validatorFor(twin.category);
    const left = selectorOfSignature('left');
    const right = selectorOfSignature('right');
    const build = (masterId: string, entry: string, user: string, selector: Uint8Array): ReturnType<typeof master> => master({
      master: masterId, contract: 'Twin', entry, program: twin.program,
      facts: {
        contract: 'Twin', functionName: entry, kind: FrameKind.ROOT,
        callerIsUser: true, originEqualsCaller: true, makesExternalCall: false, mastersOfContract: 2,
      },
      frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: twin.address, value: 0n },
      enteredBy: user, origin: user,
      ...(withSelectors ? { argumentPushes: [selector] } : {}),
    });
    return {
      blocks: [{ contract: 'Twin', masters: ['twin-left', 'twin-right'], validator: { id: 'validator', settles: [] }, state: [] }],
      userInputs: userInputs(['user-left', 'user-right'], 3),
      masters: [build('twin-left', 'left', 'user-left', left), build('twin-right', 'right', 'user-right', right)],
      inputs: {
        'twin-left': { source: masterInput(twin) },
        'twin-right': { source: masterInput(twin) },
        validator: { source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(twin.category, 'mutable') } },
        'user-left': userInput(),
        'user-right': userInput(),
      },
      validator: { id: 'validator', covers: [], settles: [], redeemScript: validator.redeem },
    };
  }

  it('is refused by the composer: a user-entered master may not carry the call data that names its entry', () => {
    const { contracts } = compileAndDeploy(SOURCE, { Twin: 'two entries of one contract' });
    // The only field that carries the entry's selector is the master's call data, and the composer refuses call
    // data on a master nobody calls, so the selector cannot reach the dispatcher through this plan.
    expect(() => composeDraft(planFor(contracts.Twin!, true)))
      .toThrow(/entered by a user, so it carries no call data/);
  });

  it('is refused by the derivation when the selector is left out: the master never reaches an entry', () => {
    const { artifacts, contracts } = compileAndDeploy(SOURCE, { Twin: 'two entries of one contract' });
    expect(() => composeAndDerive(planFor(contracts.Twin!, false), [artifacts.Twin!], [
      rootOf('Twin', 'left', 'twin-left'),
      rootOf('Twin', 'right', 'twin-right'),
    ])).toThrow(/PER_CALL_DERIVATION_STALLED/);
  });
});
