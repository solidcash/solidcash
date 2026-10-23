import { describe, expect, it } from 'vitest';
import { layoutWithFacets } from './harness.js';
import { FrameKind } from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import {
  composeDraft, participant, type CompositionDraftPlan,
} from '../../../src/framed/composer/index.js';
import {
  USER_LOCK, composeAndDerive, compileAndDeploy, entryName, hexOf, master, masterInput,
  rootOf, seededAddress, selectorOf, selectorOfSignature, token, userInput, userInputs, validatorFor,
  type DeployedContract,
} from './harness.js';

/**
 * The composition shapes the framed composer has to lay out.
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

/** The error a shipped call raised, or a failure when it returned normally. */
function shippedRefusal(run: () => unknown): Error {
  try {
    run();
  } catch (error) {
    return error as Error;
  }
  throw new Error('the shipped code accepted the composition, so there is no refusal to record');
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
  const SOURCE = 'pragma solidcash ^0.14.0; contract Solo { function ping() { require(true); } }';

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
    expect(outcome.draft.assembly.transcripts).toStrictEqual([]);
    expect(outcome.completed.map((frame) => frame.functionName)).toStrictEqual([entryName('Solo', 'ping')]);
    expectEveryContractInputAccepted(outcome);
    expectDerivationConvergedWithAssembly(outcome, ['solo-1']);
  });
});

describe('two contracts where the first calls the second', () => {
  const calleeAddress = seededAddress('the called contract');
  const SOURCE = 'pragma solidcash ^0.14.0;'
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
      // The facet the validator binds is one participant ahead of the user.
      userInputs: userInputs(['user'], 4),
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
    // The facet the validator binds sits at 2, so the callee follows at 3.
    expect(['caller-1', 'validator', 'callee-1'].map((id) => participant(outcome.draft.layout, id).index)).toStrictEqual([0, 1, 3]);
    // The derivation completes the callee before the caller resumes.
    expect(outcome.completed.map((frame) => frame.functionName))
      .toStrictEqual([entryName('Callee', 'ping'), entryName('Caller', 'callIt')]);
    // The one call record resolves to the callee's layout index.
    expect(outcome.draft.assembly.calls.map((call) => call.calleeRef)).toStrictEqual([3]);
    expectEveryContractInputAccepted(outcome);
    expectDerivationConvergedWithAssembly(outcome, ['caller-1', 'callee-1']);
  });
});

describe('two independent roots of two different contracts', () => {
  const SOURCE = 'pragma solidcash ^0.14.0;'
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
    expect(outcome.draft.assembly.transcripts).toStrictEqual([]);
    expect(outcome.completed.map((frame) => frame.functionName))
      .toStrictEqual([entryName('First', 'left'), entryName('Second', 'right')]);
    expectEveryContractInputAccepted(outcome);
    expectDerivationConvergedWithAssembly(outcome, ['first-1', 'second-1']);
  });
});

describe('one contract entering another of its own entries', () => {
  const ownAddress = seededAddress('the self-calling contract');
  const SOURCE = 'pragma solidcash ^0.14.0;'
    + ' interface IOwn { function inner(); }'
    + ' contract Own {'
    + `   function start() { IOwn(0x${hexOf(ownAddress)}).inner.call(); require(true); }`
    + '   function inner() { require(true); }'
    + ' }';

  it('runs on two masters of the one contract, derives the self-called entry first, '
    + 'and the machine accepts the spend', () => {
    const { artifacts, contracts } = compileAndDeploy(SOURCE, { Own: 'the self-calling contract' });
    const own = contracts.Own!;
    const validator = validatorFor(own.category);
    const start = selectorOf(artifacts, 'Own', 'start');
    const inner = selectorOf(artifacts, 'Own', 'inner');
    const plan: CompositionDraftPlan = {
      blocks: [{ contract: 'Own', masters: ['own-1', 'own-2'], validator: { id: 'validator', settles: [] }, state: [] }],
      // The facet the validator binds is one participant ahead of the user.
      userInputs: userInputs(['user'], 4),
      masters: [
        master({
          master: 'own-1', contract: 'Own', entry: 'start', program: own.program,
          facts: {
            contract: 'Own', functionName: 'start', kind: FrameKind.ROOT,
            callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 2,
          },
          frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: own.address, value: 0n },
          enteredBy: 'user', origin: 'user',
          argumentPushes: [start], dispatches: true,
          calls: [{ kind: FrameKind.CALL, callee: 'own-2', target: own.address, value: 0n, argumentPushes: [inner] }],
        }),
        master({
          master: 'own-2', contract: 'Own', entry: 'inner', program: own.program,
          facts: {
            contract: 'Own', functionName: 'inner', kind: FrameKind.CALL,
            callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 2,
          },
          frame: { kind: FrameKind.CALL, sender: own.address, self: own.address, value: 0n },
          enteredBy: 'own-1', origin: 'user', argumentPushes: [inner],
        }),
      ],
      inputs: {
        'own-1': { source: masterInput(own) },
        'own-2': { source: masterInput(own) },
        validator: { source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(own.category, 'mutable') } },
        user: userInput(),
      },
      validator: {
        id: 'validator', covers: [],
        // The contract runs on two masters, so the validator settles it; it keeps no records, so none is listed.
        settles: [{ category: own.category, stateInputs: [] }], redeemScript: validator.redeem,
      },
    };

    const outcome = composeAndDerive(plan, [artifacts.Own!], [rootOf('Own', 'start', 'own-1')]);

    expect(['own-1', 'own-2', 'validator'].map((id) => participant(outcome.draft.layout, id).index))
      .toStrictEqual([0, 1, 2]);
    // The self-called entry completes before the entry that called it.
    expect(outcome.completed.map((frame) => frame.functionName))
      .toStrictEqual([entryName('Own', 'inner'), entryName('Own', 'start')]);
    expect(outcome.draft.assembly.calls.map((call) => call.calleeRef)).toStrictEqual([1]);
    expectEveryContractInputAccepted(outcome);
    expectDerivationConvergedWithAssembly(outcome, ['own-1', 'own-2']);
  });

  it('is emitted when the self-call target is address(this): the site binds the record to the caller\'s own address', () => {
    // The self-call target may be spelled as the contract's own address. The caller's own code holds that address
    // as its frame `self`, so the site binds its record to it as it does a computed target. The run on two masters
    // is pinned by the identity toy (`toys/identity.test.ts`).
    const source = 'pragma solidcash ^0.14.0;'
      + ' interface IOwn { function inner(); }'
      + ' contract Own {'
      + '   function start() { IOwn(address(this)).inner.call(); require(true); }'
      + '   function inner() { require(true); }'
      + ' }';
    const artifacts = compileStringMulti(source, { composition: 'framed' });
    expect(artifacts.Own?.composition?.convention).toBe('framed');
    expect(artifacts.Own?.abi.map((entry) => entry.name).sort()).toEqual(['inner', 'start']);
  });
});

describe('a call and a return call between two contracts', () => {
  it('is emitted although the re-entered contract\'s entries make different numbers of calls', () => {
    // The first contract's `begin` calls the second's `respond`; `respond` calls the first's `finish`, so the first
    // contract is entered twice. Its two entries make different numbers of calls, and one head serves both because
    // the body that runs pins the block's declared length to its own.
    const firstAddress = seededAddress('the returning contract');
    const secondAddress = seededAddress('the called-back contract');
    const source = 'pragma solidcash ^0.14.0;'
      + ' interface ISecond { function respond(); }'
      + ' interface IFirst { function finish(); }'
      + ' contract First {'
      + `   function begin() { ISecond(0x${hexOf(secondAddress)}).respond.call(); require(true); }`
      + '   function finish() { require(true); }'
      + ' }'
      + ' contract Second {'
      + `   function respond() { IFirst(0x${hexOf(firstAddress)}).finish.call(); require(true); }`
      + ' }';
    const artifacts = compileStringMulti(source, { composition: 'framed' });
    expect(artifacts.First?.abi.map((entry) => entry.name).sort()).toEqual(['begin', 'finish']);
    expect(artifacts.Second?.abi.map((entry) => entry.name)).toEqual(['respond']);
  });
});

describe('a three-contract chain that calls back to the first', () => {
  // First.begin -> Second.middle -> Third.end -> Second.back -> First.finish. Both First and Second are entered
  // twice, each through a second entry that makes no call; each contract's master serves both of its entries.
  const firstAddress = seededAddress('the chain head');
  const secondAddress = seededAddress('the chain middle');
  const thirdAddress = seededAddress('the chain tail');
  const SOURCE = 'pragma solidcash ^0.14.0;'
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

  /**
   * The plan the chain is run from: the two entries of First and of Second, Third's one, the one validator, and
   * the user that entered the head. `rootSelector` off models a plan that leaves the multi-entry root without the
   * selector its dispatcher consumes, which is the plan fault the derivation reports as a stalled step.
   */
  function planFor(
    built: ReturnType<typeof compileAndDeploy>,
    options: { readonly rootSelector?: boolean } = {},
  ): CompositionDraftPlan {
    const { artifacts, contracts } = built;
    const first = contracts.First!;
    const second = contracts.Second!;
    const third = contracts.Third!;
    const validator = validatorFor(first.category);
    const begin = selectorOf(artifacts, 'First', 'begin');
    const finish = selectorOf(artifacts, 'First', 'finish');
    const middle = selectorOf(artifacts, 'Second', 'middle');
    const back = selectorOf(artifacts, 'Second', 'back');
    const end = selectorOf(artifacts, 'Third', 'end');
    const blocks = [
      { contract: 'First', masters: ['first-1', 'first-2'], validator: { id: 'validator', settles: [] }, state: [] },
      { contract: 'Second', masters: ['second-1', 'second-2'], state: [] },
      { contract: 'Third', masters: ['third-1'], state: [] },
    ];
    const rootSelector = options.rootSelector === false ? {} : { argumentPushes: [begin], dispatches: true };
    return {
      blocks,
      // The user follows the participants, at the index the layout reserves for the first funder.
      userInputs: userInputs(['user'], layoutWithFacets(blocks).funderInputBase),
      masters: [
        master({
          master: 'first-1', contract: 'First', entry: 'begin', program: first.program,
          facts: {
            contract: 'First', functionName: 'begin', kind: FrameKind.ROOT,
            callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 2,
          },
          frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: first.address, value: 0n },
          enteredBy: 'user', origin: 'user', ...rootSelector,
          calls: [{ kind: FrameKind.CALL, callee: 'second-1', target: second.address, value: 0n, argumentPushes: [middle] }],
        }),
        master({
          master: 'second-1', contract: 'Second', entry: 'middle', program: second.program,
          facts: {
            contract: 'Second', functionName: 'middle', kind: FrameKind.CALL,
            callerIsUser: false, originEqualsCaller: false, makesExternalCall: true, mastersOfContract: 2,
          },
          frame: { kind: FrameKind.CALL, sender: first.address, self: second.address, value: 0n },
          enteredBy: 'first-1', origin: 'user', argumentPushes: [middle],
          calls: [{ kind: FrameKind.CALL, callee: 'third-1', target: third.address, value: 0n, argumentPushes: [end] }],
        }),
        master({
          master: 'third-1', contract: 'Third', entry: 'end', program: third.program,
          facts: {
            contract: 'Third', functionName: 'end', kind: FrameKind.CALL,
            callerIsUser: false, originEqualsCaller: false, makesExternalCall: true, mastersOfContract: 1,
          },
          frame: { kind: FrameKind.CALL, sender: second.address, self: third.address, value: 0n },
          enteredBy: 'second-1', origin: 'user', argumentPushes: [end],
          calls: [{ kind: FrameKind.CALL, callee: 'second-2', target: second.address, value: 0n, argumentPushes: [back] }],
        }),
        master({
          master: 'second-2', contract: 'Second', entry: 'back', program: second.program,
          facts: {
            contract: 'Second', functionName: 'back', kind: FrameKind.CALL,
            callerIsUser: false, originEqualsCaller: false, makesExternalCall: true, mastersOfContract: 2,
          },
          frame: { kind: FrameKind.CALL, sender: third.address, self: second.address, value: 0n },
          enteredBy: 'third-1', origin: 'user', argumentPushes: [back],
          calls: [{ kind: FrameKind.CALL, callee: 'first-2', target: first.address, value: 0n, argumentPushes: [finish] }],
        }),
        master({
          master: 'first-2', contract: 'First', entry: 'finish', program: first.program,
          facts: {
            contract: 'First', functionName: 'finish', kind: FrameKind.CALL,
            callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 2,
          },
          frame: { kind: FrameKind.CALL, sender: second.address, self: first.address, value: 0n },
          enteredBy: 'second-2', origin: 'user', argumentPushes: [finish],
        }),
      ],
      inputs: {
        'first-1': { source: masterInput(first) },
        'first-2': { source: masterInput(first) },
        'second-1': { source: masterInput(second) },
        'second-2': { source: masterInput(second) },
        'third-1': { source: masterInput(third) },
        validator: {
          source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(first.category, 'mutable') },
        },
        user: userInput(),
      },
      validator: {
        // One validator, hosted by the head's block, covers the whole chain and settles the two re-entered contracts.
        id: 'validator', covers: ['Second', 'Third'],
        settles: [{ category: first.category, stateInputs: [] }, { category: second.category, stateInputs: [] }],
        redeemScript: validator.redeem,
      },
    };
  }

  it('derives the whole call-back chain end to end, callee first, and the machine accepts every contract input', () => {
    const built = compileAndDeploy(SOURCE, {
      First: 'the chain head', Second: 'the chain middle', Third: 'the chain tail',
    });
    const outcome = composeAndDerive(planFor(built), [
      built.artifacts.First!, built.artifacts.Second!, built.artifacts.Third!,
    ], [rootOf('First', 'begin', 'first-1')]);

    // Each contract's masters sit in entry order and the one validator follows the head's block.
    expect(['first-1', 'first-2', 'validator', 'second-1', 'second-2', 'third-1']
      .map((id) => participant(outcome.draft.layout, id).index)).toStrictEqual([0, 1, 2, 4, 5, 6]);
    expect(outcome.draft.layout.funderInputBase).toBe(7);
    // The chain closes: the entry the last call reaches completes first, the user's entry last.
    expect(outcome.completed.map((frame) => frame.functionName)).toStrictEqual([
      entryName('First', 'finish'), entryName('Second', 'back'), entryName('Third', 'end'),
      entryName('Second', 'middle'), entryName('First', 'begin'),
    ]);
    // Each call resolves to its callee's layout index.
    expect(outcome.draft.assembly.calls.map((call) => `${call.from}->${call.calleeRef}`))
      .toStrictEqual(['first-1->4', 'second-1->6', 'third-1->5', 'second-2->1']);
    // The one validator names every master that points at it and the user's entry as its root.
    expect(outcome.draft.assembly.transcripts.map((entry) => ({
      validator: entry.validator, roots: entry.transcript.roots, masters: entry.transcript.masters,
    }))).toStrictEqual([{ validator: 'validator', roots: [0], masters: [0, 1, 4, 5, 6] }]);
    expectEveryContractInputAccepted(outcome);
    expectDerivationConvergedWithAssembly(outcome, ['first-1', 'first-2', 'second-1', 'second-2', 'third-1']);
  });

  it('is refused by the derivation when the multi-entry root carries no selector, so its body is never reached', () => {
    // First serves two entries, so its program dispatches on the call data the user's input carries. A plan that
    // leaves the root without that selector stops the program inside the dispatcher, before its first call site,
    // so filling the call record moves nothing and the step reads as a stall rather than a program wall.
    const built = compileAndDeploy(SOURCE, {
      First: 'the chain head', Second: 'the chain middle', Third: 'the chain tail',
    });
    expect(() => composeAndDerive(planFor(built, { rootSelector: false }), [
      built.artifacts.First!, built.artifacts.Second!, built.artifacts.Third!,
    ], [rootOf('First', 'begin', 'first-1')])).toThrow(/FRAMED_DERIVATION_STALLED/);
  });
});

describe('two entry points of one contract entered independently', () => {
  const SOURCE = 'pragma solidcash ^0.14.0;'
    + ' contract Twin { function left() { require(true); } function right() { require(true); } }';

  /** Two masters of one contract, one validator, entered by two separate users. */
  function planFor(twin: DeployedContract, options: {
    readonly selectors: boolean;
    readonly dispatches?: boolean;
    readonly settles?: boolean;
  }): CompositionDraftPlan {
    const validator = validatorFor(twin.category);
    const left = selectorOfSignature('left');
    const right = selectorOfSignature('right');
    const build = (masterId: string, entry: string, user: string, selector: Uint8Array): ReturnType<typeof master> => ({
      ...master({
        master: masterId, contract: 'Twin', entry, program: twin.program,
        facts: {
          contract: 'Twin', functionName: entry, kind: FrameKind.ROOT,
          callerIsUser: true, originEqualsCaller: true, makesExternalCall: false, mastersOfContract: 2,
        },
        frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: twin.address, value: 0n },
        enteredBy: user, origin: user,
        ...(options.selectors ? { argumentPushes: [selector] } : {}),
      }),
      ...(options.dispatches === true ? { dispatches: true } : {}),
    });
    return {
      blocks: [{ contract: 'Twin', masters: ['twin-left', 'twin-right'], validator: { id: 'validator', settles: [] }, state: [] }],
      // The facet the validator binds is one participant ahead of the users.
      userInputs: userInputs(['user-left', 'user-right'], 4),
      masters: [build('twin-left', 'left', 'user-left', left), build('twin-right', 'right', 'user-right', right)],
      inputs: {
        'twin-left': { source: masterInput(twin) },
        'twin-right': { source: masterInput(twin) },
        validator: { source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(twin.category, 'mutable') } },
        'user-left': userInput(),
        'user-right': userInput(),
      },
      validator: {
        id: 'validator', covers: [],
        settles: options.settles === true ? [{ category: twin.category, stateInputs: [] }] : [],
        redeemScript: validator.redeem,
      },
    };
  }

  it('is served when each user-entered entry carries its own selector, and the machine accepts the spend', () => {
    const { artifacts, contracts } = compileAndDeploy(SOURCE, { Twin: 'two entries of one contract' });
    const outcome = composeAndDerive(
      planFor(contracts.Twin!, { selectors: true, dispatches: true, settles: true }),
      [artifacts.Twin!],
      [rootOf('Twin', 'left', 'twin-left'), rootOf('Twin', 'right', 'twin-right')],
    );

    // The one validator sits after the two masters it orders, and both roots complete in entry order.
    expect(['twin-left', 'twin-right', 'validator'].map((id) => participant(outcome.draft.layout, id).index))
      .toStrictEqual([0, 1, 2]);
    expect(outcome.completed.map((frame) => frame.functionName))
      .toStrictEqual([entryName('Twin', 'left'), entryName('Twin', 'right')]);
    expectEveryContractInputAccepted(outcome);
    expectDerivationConvergedWithAssembly(outcome, ['twin-left', 'twin-right']);
  });
});

describe('two independent pairs that each need their own validator', () => {
  // `Left` calls `LeftCallee`, `Right` calls `RightCallee`, and neither pair reaches the other, so each pair's first
  // root needs its own validator. The plan names one validator per pair, each hosted by the caller's block and
  // covering its own callee, so every master points at the validator that covers it.
  const leftCalleeAddress = seededAddress('the first callee');
  const rightCalleeAddress = seededAddress('the second callee');
  const SOURCE = 'pragma solidcash ^0.14.0;'
    + ' interface ILeftCallee { function ping(); }'
    + ' interface IRightCallee { function ping(); }'
    + ' contract Left {'
    + `   function callIt() { ILeftCallee(0x${hexOf(leftCalleeAddress)}).ping.call(); require(true); }`
    + ' }'
    + ' contract LeftCallee { function ping() { require(true); } }'
    + ' contract Right {'
    + `   function callIt() { IRightCallee(0x${hexOf(rightCalleeAddress)}).ping.call(); require(true); }`
    + ' }'
    + ' contract RightCallee { function ping() { require(true); } }';

  function planFor(built: ReturnType<typeof compileAndDeploy>, options: {
    readonly leftCovers?: readonly string[];
  } = {}): CompositionDraftPlan {
    const { artifacts, contracts } = built;
    const left = contracts.Left!;
    const leftCallee = contracts.LeftCallee!;
    const right = contracts.Right!;
    const rightCallee = contracts.RightCallee!;
    const leftValidator = validatorFor(left.category);
    const rightValidator = validatorFor(right.category);
    // The selector is read from the compiled callee's ABI, so the call data is the shipped one.
    const leftPing = selectorOf(artifacts, 'LeftCallee', 'ping');
    const rightPing = selectorOf(artifacts, 'RightCallee', 'ping');
    return {
      blocks: [
        { contract: 'Left', masters: ['left-1'], validator: { id: 'left-validator', settles: [] }, state: [] },
        { contract: 'LeftCallee', masters: ['left-callee-1'], state: [] },
        { contract: 'Right', masters: ['right-1'], validator: { id: 'right-validator', settles: [] }, state: [] },
        { contract: 'RightCallee', masters: ['right-callee-1'], state: [] },
      ],
      // Each validator binds a facet, so two participants precede the users.
      userInputs: userInputs(['user-left', 'user-right'], 8),
      masters: [
        master({
          master: 'left-1', contract: 'Left', entry: 'callIt', program: left.program,
          facts: {
            contract: 'Left', functionName: 'callIt', kind: FrameKind.ROOT,
            callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
          },
          frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: left.address, value: 0n },
          enteredBy: 'user-left', origin: 'user-left',
          calls: [{
            kind: FrameKind.CALL, callee: 'left-callee-1', target: leftCallee.address,
            value: 0n, argumentPushes: [leftPing],
          }],
        }),
        master({
          master: 'left-callee-1', contract: 'LeftCallee', entry: 'ping', program: leftCallee.program,
          facts: {
            contract: 'LeftCallee', functionName: 'ping', kind: FrameKind.CALL,
            callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
          },
          frame: { kind: FrameKind.CALL, sender: left.address, self: leftCallee.address, value: 0n },
          enteredBy: 'left-1', origin: 'user-left', argumentPushes: [leftPing],
        }),
        master({
          master: 'right-1', contract: 'Right', entry: 'callIt', program: right.program,
          facts: {
            contract: 'Right', functionName: 'callIt', kind: FrameKind.ROOT,
            callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
          },
          frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: right.address, value: 0n },
          enteredBy: 'user-right', origin: 'user-right',
          calls: [{
            kind: FrameKind.CALL, callee: 'right-callee-1', target: rightCallee.address,
            value: 0n, argumentPushes: [rightPing],
          }],
        }),
        master({
          master: 'right-callee-1', contract: 'RightCallee', entry: 'ping', program: rightCallee.program,
          facts: {
            contract: 'RightCallee', functionName: 'ping', kind: FrameKind.CALL,
            callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
          },
          frame: { kind: FrameKind.CALL, sender: right.address, self: rightCallee.address, value: 0n },
          enteredBy: 'right-1', origin: 'user-right', argumentPushes: [rightPing],
        }),
      ],
      inputs: {
        'left-1': { source: masterInput(left) },
        'left-callee-1': { source: masterInput(leftCallee) },
        'right-1': { source: masterInput(right) },
        'right-callee-1': { source: masterInput(rightCallee) },
        'left-validator': {
          source: { lockingBytecode: leftValidator.lock, valueSatoshis: 20_000n, token: token(left.category, 'mutable') },
        },
        'right-validator': {
          source: { lockingBytecode: rightValidator.lock, valueSatoshis: 20_000n, token: token(right.category, 'mutable') },
        },
        'user-left': userInput(),
        'user-right': userInput(),
      },
      validator: [
        {
          id: 'left-validator',
          covers: options.leftCovers ?? ['LeftCallee'],
          settles: [],
          redeemScript: leftValidator.redeem,
        },
        { id: 'right-validator', covers: ['RightCallee'], settles: [], redeemScript: rightValidator.redeem },
      ],
    };
  }

  it('binds each contract to its own validator and every input, the validators included, is accepted', () => {
    const built = compileAndDeploy(SOURCE, {
      Left: 'the first caller', LeftCallee: 'the first callee',
      Right: 'the second caller', RightCallee: 'the second callee',
    });
    const plan = planFor(built);
    const outcome = composeAndDerive(plan, [
      built.artifacts.Left!, built.artifacts.LeftCallee!, built.artifacts.Right!, built.artifacts.RightCallee!,
    ], [
      rootOf('Left', 'callIt', 'left-1'),
      rootOf('Right', 'callIt', 'right-1'),
    ]);

    // Each caller's block holds its master and its own validator; the callee's block follows.
    expect(['left-1', 'left-validator', 'left-callee-1', 'right-1', 'right-validator', 'right-callee-1']
      .map((id) => participant(outcome.draft.layout, id).index))
      // Each validator binds one facet, so the pairs are two participants wider than the masters.
      .toStrictEqual([0, 1, 3, 4, 5, 7]);
    expect(outcome.draft.layout.funderInputBase).toBe(8);
    // The callee of each pair completes before its caller, and the first pair is derived before the second.
    expect(outcome.completed.map((frame) => frame.functionName)).toStrictEqual([
      entryName('LeftCallee', 'ping'), entryName('Left', 'callIt'),
      entryName('RightCallee', 'ping'), entryName('Right', 'callIt'),
    ]);
    // Each call resolves to its own callee's layout index.
    expect(outcome.draft.assembly.calls.map((call) => `${call.from}->${call.calleeRef}`))
      .toStrictEqual(['left-1->3', 'right-1->7']);
    // Each validator's transcript names only the masters that point at it.
    expect(outcome.draft.assembly.transcripts.map((entry) => ({
      validator: entry.validator,
      roots: entry.transcript.roots,
      masters: entry.transcript.masters,
    }))).toStrictEqual([
      { validator: 'left-validator', roots: [0], masters: [0, 3] },
      { validator: 'right-validator', roots: [4], masters: [4, 7] },
    ]);
    expectEveryContractInputAccepted(outcome);
    expectDerivationConvergedWithAssembly(outcome, ['left-1', 'left-callee-1', 'right-1', 'right-callee-1']);
  });

  it('is refused by the composer: a contract two validators cover is covered twice', () => {
    const built = compileAndDeploy(SOURCE, {
      Left: 'the first caller', LeftCallee: 'the first callee',
      Right: 'the second caller', RightCallee: 'the second callee',
    });
    // The left pair's validator also claims `Right`, which the right pair's own validator hosts.
    const refusal = shippedRefusal(() => composeDraft(planFor(built, { leftCovers: ['LeftCallee', 'Right'] })));

    expect(refusal.name).toBe('FramedEncodingError');
    expect(refusal.message).toBe('"Right" is covered by more than one validator');
  });
});
