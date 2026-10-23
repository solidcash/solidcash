import { describe, expect, it } from 'vitest';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { FrameKind, encodeIntegerValue, type FrameKindValue } from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { publishedRefusals } from '../../../../solidc/test/framed/master/refused-entry.js';
import {
  compileAndDeploy, composeAndDerive, entryName, hexOf, master, rootOf, seededAddress, token, userInput,
  userInputs, USER_LOCK, selectorOf, validatorFor,
} from '../shapes/harness.js';
import {
  createComposedDerivationHost, deriveDepthFirst,
  type CompositionDraftPlan, type DraftMaster,
} from '../../../src/framed/composer/index.js';

/**
 * Reads and calls whose shape depends on state or on a loop.
 *
 * A loop whose trip count is a run-time value still has one call site, so a witness with one record settles the
 * single iteration the caller asked for. A call behind a branch whose arms make different numbers of calls is
 * served too: the body carries how many calls it made, so an arm that calls settles over the record it made, and
 * the same call written inside a switch, whose arms need not agree, is still refused by name. A read of another
 * contract's state is refused before code generation, and a static read whose callee reverts stops the derivation
 * because no step's witness is ever accepted.
 */

const CAL = seededAddress('reads and loops cal');
const LOOPER = seededAddress('reads and loops looper');

describe('a call inside a data-dependent loop', () => {
  const SOURCE = 'pragma solidcash ^0.14.0;'
    + ' interface ILooper { function go(int n); }'
    + ' interface ICal { function ping(); }'
    + ' contract Cal { function ping() { require(true); } }'
    + ' contract Looper { function go(int n) {'
    + `   for (int i = 0; i < n; i = i + 1) { ICal(0x${hexOf(CAL)}).ping.call(); } require(true); } }`
    + ' contract Caller { function start() {'
    + `   ILooper(0x${hexOf(LOOPER)}).go.call(1); require(true); } }`;

  it('settles the one iteration the caller asks for, accepted by the machine', () => {
    const { artifacts, contracts } = compileAndDeploy(SOURCE, {
      Caller: 'reads and loops caller', Looper: 'reads and loops looper', Cal: 'reads and loops cal',
    });
    const caller = contracts.Caller!;
    const looper = contracts.Looper!;
    const cal = contracts.Cal!;
    const validator = validatorFor(caller.category);
    const goSelector = selectorOf(artifacts, 'Looper', 'go');
    const pingSelector = selectorOf(artifacts, 'Cal', 'ping');
    const one = encodeIntegerValue(1n);
    const planMaster = (
      id: string, contract: string, entry: string, kind: FrameKindValue, sender: Uint8Array, enteredBy: string,
      calls: DraftMaster['calls'], argumentPushes: readonly Uint8Array[],
    ): DraftMaster => ({
      master: id, contract, functionName: entryName(contract, entry), program: contracts[contract]!.program,
      facts: {
        contract, functionName: entry, kind, callerIsUser: kind === FrameKind.ROOT,
        originEqualsCaller: kind === FrameKind.ROOT, makesExternalCall: calls.length > 0, mastersOfContract: 1,
      },
      frame: { kind, sender, self: contracts[contract]!.address, value: 0n }, enteredBy, origin: 'user', calls,
      retval: new Uint8Array(0), segments: Array.from({ length: calls.length + 1 }, () => []),
      events: [], sends: [], argumentPushes, redeemScript: contracts[contract]!.program,
    });
    const plan: CompositionDraftPlan = {
      blocks: [
        { contract: 'Caller', masters: ['caller-1'], validator: { id: 'validator', settles: [] }, state: [] },
        { contract: 'Looper', masters: ['looper-1'], state: [] },
        { contract: 'Cal', masters: ['cal-1'], state: [] },
      ],
      // The facet the validator binds is one participant ahead of the user.
      userInputs: [{ id: 'user', index: 5 }],
      masters: [
        planMaster('caller-1', 'Caller', 'start', FrameKind.ROOT, USER_LOCK, 'user',
          [{ kind: FrameKind.CALL, callee: 'looper-1', target: looper.address, value: 0n, argumentPushes: [goSelector, one] }], []),
        planMaster('looper-1', 'Looper', 'go', FrameKind.CALL, caller.address, 'caller-1',
          [{ kind: FrameKind.CALL, callee: 'cal-1', target: cal.address, value: 0n, argumentPushes: [pingSelector] }], [goSelector, one]),
        planMaster('cal-1', 'Cal', 'ping', FrameKind.CALL, looper.address, 'looper-1', [], [pingSelector]),
      ],
      inputs: {
        'caller-1': { source: { lockingBytecode: caller.lockingBytecode, valueSatoshis: 20_000n, token: token(caller.category, 'minting') } },
        'looper-1': { source: { lockingBytecode: looper.lockingBytecode, valueSatoshis: 20_000n, token: token(looper.category, 'minting') } },
        'cal-1': { source: { lockingBytecode: cal.lockingBytecode, valueSatoshis: 20_000n, token: token(cal.category, 'minting') } },
        validator: { source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(caller.category, 'mutable') } },
        user: {
          source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
          unlockingBytecode: userInput().unlockingBytecode,
        },
      },
      validator: { id: 'validator', covers: ['Looper', 'Cal'], settles: [], redeemScript: validator.redeem },
    };

    const outcome = composeAndDerive(plan, [artifacts.Caller!, artifacts.Looper!, artifacts.Cal!], [rootOf('Caller', 'start', 'caller-1')]);
    const rejected = outcome.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
    expect(rejected).toStrictEqual([]);
  });
});

describe('a call whose execution depends on a run-time value', () => {
  const CHOOSER = seededAddress('reads and loops chooser');
  const SOURCE = 'pragma solidcash ^0.14.0;'
    + ' interface IChooser { function go(int n); }'
    + ' interface ICal { function ping(); }'
    + ' contract Cal { function ping() { require(true); } }'
    + ' contract Chooser { function go(int n) {'
    + `   if (n > 0) { ICal(0x${hexOf(CAL)}).ping.call(); } require(true); } }`
    + ' contract Caller { function start() {'
    + `   IChooser(0x${hexOf(CHOOSER)}).go.call(1); require(true); } }`;

  it('is served, publishes its call site, and settles the arm that calls', () => {
    // The body makes zero or one call, a number its source does not fix, so it carries how many it made and binds
    // the record that number names. The composition drives the arm that calls, over the one record it declared.
    const { artifacts, contracts } = compileAndDeploy(SOURCE, {
      Caller: 'reads and loops caller', Chooser: 'reads and loops chooser', Cal: 'reads and loops cal',
    });
    const composition = artifacts.Chooser!.composition!;
    expect(composition.refusedEntries ?? []).toStrictEqual([]);
    expect(composition.stopSites?.entries.find((entry) => entry.functionName === 'Chooser.go()')
      ?.calls.map((call) => call.functionName)).toStrictEqual(['ping']);

    const caller = contracts.Caller!;
    const chooser = contracts.Chooser!;
    const cal = contracts.Cal!;
    const validator = validatorFor(caller.category);
    const goSelector = selectorOf(artifacts, 'Chooser', 'go');
    const pingSelector = selectorOf(artifacts, 'Cal', 'ping');
    const one = encodeIntegerValue(1n);
    const plan: CompositionDraftPlan = {
      blocks: [
        { contract: 'Caller', masters: ['caller-1'], validator: { id: 'validator', settles: [] }, state: [] },
        { contract: 'Chooser', masters: ['chooser-1'], state: [] },
        { contract: 'Cal', masters: ['cal-1'], state: [] },
      ],
      // The facet the validator binds is one participant ahead of the user.
      userInputs: userInputs(['user'], 5),
      masters: [
        master({
          master: 'caller-1', contract: 'Caller', entry: 'start', program: caller.program,
          frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: caller.address, value: 0n },
          facts: {
            contract: 'Caller', functionName: 'start', kind: FrameKind.ROOT, callerIsUser: true,
            originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
          },
          enteredBy: 'user', origin: 'user',
          calls: [{
            kind: FrameKind.CALL, callee: 'chooser-1', target: chooser.address, value: 0n,
            argumentPushes: [goSelector, one],
          }],
        }),
        master({
          master: 'chooser-1', contract: 'Chooser', entry: 'go', program: chooser.program,
          frame: { kind: FrameKind.CALL, sender: caller.address, self: chooser.address, value: 0n },
          facts: {
            contract: 'Chooser', functionName: 'go', kind: FrameKind.CALL, callerIsUser: false,
            originEqualsCaller: false, makesExternalCall: true, mastersOfContract: 1,
          },
          enteredBy: 'caller-1', origin: 'user',
          calls: [{
            kind: FrameKind.CALL, callee: 'cal-1', target: cal.address, value: 0n,
            argumentPushes: [pingSelector],
          }],
          argumentPushes: [goSelector, one],
        }),
        master({
          master: 'cal-1', contract: 'Cal', entry: 'ping', program: cal.program,
          frame: { kind: FrameKind.CALL, sender: chooser.address, self: cal.address, value: 0n },
          facts: {
            contract: 'Cal', functionName: 'ping', kind: FrameKind.CALL, callerIsUser: false,
            originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
          },
          enteredBy: 'chooser-1', origin: 'user', calls: [], argumentPushes: [pingSelector],
        }),
      ],
      inputs: {
        'caller-1': {
          source: {
            lockingBytecode: caller.lockingBytecode, valueSatoshis: 20_000n, token: token(caller.category, 'minting'),
          },
        },
        'chooser-1': {
          source: {
            lockingBytecode: chooser.lockingBytecode, valueSatoshis: 20_000n,
            token: token(chooser.category, 'minting'),
          },
        },
        'cal-1': {
          source: {
            lockingBytecode: cal.lockingBytecode, valueSatoshis: 20_000n, token: token(cal.category, 'minting'),
          },
        },
        validator: {
          source: {
            lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(caller.category, 'mutable'),
          },
        },
        user: {
          source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
          unlockingBytecode: userInput().unlockingBytecode,
        },
      },
      validator: { id: 'validator', covers: ['Chooser', 'Cal'], settles: [], redeemScript: validator.redeem },
    };

    const outcome = composeAndDerive(
      plan, [artifacts.Caller!, artifacts.Chooser!, artifacts.Cal!], [rootOf('Caller', 'start', 'caller-1')],
    );
    const rejected = outcome.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
    expect(rejected).toStrictEqual([]);
  });

  it('is refused by name when the call sits in a switch, whose arms need not agree', () => {
    const source = 'pragma solidcash ^0.14.0;'
      + ' interface ICal { function ping(); }'
      + ' contract Cal { function ping() { require(true); } }'
      + ' contract Chooser { function go(uint sel) {'
      + `   switch (sel) { case 0: ICal(0x${hexOf(CAL)}).ping.call(); break; default: require(true); }`
      + '   require(true); } }';
    const refusals = publishedRefusals(compileStringMulti(source, { composition: 'framed' }));
    expect(refusals.map((refused) => refused.reason).join(' | '))
      .toMatch(/is in a body that switches, and its arms need not make the same number of calls/);
  });
});

describe('a read of state that belongs to another contract', () => {
  it('is refused before code generation: the block layout of the read is unavailable', () => {
    const ledger = seededAddress('reads and loops ledger');
    const source = 'pragma solidcash ^0.14.0;'
      + ' interface ILedger { public int counter; }'
      + ' contract Ledger { int public counter; function bump() { this.counter = this.counter + 1; require(true); } }'
      + ' contract Reader { function peek() returns (int) {'
      + `   return ILedger(0x${hexOf(ledger)}).counter; } }`;
    expect(() => compileStringMulti(source, { composition: 'framed' }))
      .toThrow(/Block layout not available while compiling 'peek'/);
  });
});

describe('a static read whose callee reverts', () => {
  const CAL_ADDRESS = seededAddress('reverting read cal');

  const read = (calleeBody: string): string => 'pragma solidcash ^0.14.0;'
    + ' interface ICal { function check(); }'
    + ` contract Cal { function check() { ${calleeBody} require(true); } }`
    + ' contract Reader { function start() {'
    + `   ICal(0x${hexOf(CAL_ADDRESS)}).check.staticcall(); require(true); } }`;

  /** Composes the read and derives it, evaluating the reader's own input. */
  function deriveStaticRead(source: string): ReturnType<typeof createComposedDerivationHost> {
    const { artifacts, contracts } = compileAndDeploy(source, { Reader: 'reverting read reader', Cal: 'reverting read cal' });
    const reader = contracts.Reader!;
    const cal = contracts.Cal!;
    const validator = validatorFor(reader.category);
    const selector = selectorOf(artifacts, 'Cal', 'check');
    const build = (
      id: string, contract: string, entry: string, kind: FrameKindValue, sender: Uint8Array, enteredBy: string,
      calls: DraftMaster['calls'], argumentPushes: readonly Uint8Array[], retval: Uint8Array = new Uint8Array(0),
    ): DraftMaster => ({
      master: id, contract, functionName: entryName(contract, entry), program: contracts[contract]!.program,
      facts: {
        contract, functionName: entry, kind, callerIsUser: kind === FrameKind.ROOT,
        originEqualsCaller: kind === FrameKind.ROOT, makesExternalCall: calls.length > 0, mastersOfContract: 1,
      },
      frame: { kind, sender, self: contracts[contract]!.address, value: 0n }, enteredBy, origin: 'user', calls,
      retval, segments: Array.from({ length: calls.length + 1 }, () => []),
      events: [], sends: [], argumentPushes, redeemScript: contracts[contract]!.program,
    });
    const plan: CompositionDraftPlan = {
      blocks: [
        { contract: 'Reader', masters: ['reader-1'], validator: { id: 'validator', settles: [] }, state: [] },
        { contract: 'Cal', masters: ['cal-1'], state: [] },
      ],
      // The facet the validator binds is one participant ahead of the user.
      userInputs: [{ id: 'user', index: 4 }],
      masters: [
        build('reader-1', 'Reader', 'start', FrameKind.ROOT, USER_LOCK, 'user',
          [{ kind: FrameKind.STATIC, callee: 'cal-1', target: cal.address, value: 0n, argumentPushes: [selector] }], []),
        build('cal-1', 'Cal', 'check', FrameKind.STATIC, reader.address, 'reader-1', [], [selector] ),
      ],
      inputs: {
        'reader-1': { source: { lockingBytecode: reader.lockingBytecode, valueSatoshis: 20_000n, token: token(reader.category, 'minting') } },
        'cal-1': { source: { lockingBytecode: cal.lockingBytecode, valueSatoshis: 20_000n, token: token(cal.category, 'minting') } },
        validator: { source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(reader.category, 'mutable') } },
        user: {
          source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
          unlockingBytecode: userInput().unlockingBytecode,
        },
      },
      validator: { id: 'validator', covers: ['Cal'], settles: [], redeemScript: validator.redeem },
    };
    const { host, draft } = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: [artifacts.Reader!, artifacts.Cal!], plan });
    deriveDepthFirst({ contract: 'Reader', functionName: entryName('Reader', 'start'), kind: FrameKind.ROOT, master: 'reader-1' }, host);
    return { host, draft };
  }

  it('settles the faithful read and stalls the derivation when the callee requires false', () => {
    expect(() => deriveStaticRead(read(''))).not.toThrow();
    expect(() => deriveStaticRead(read('require(false);'))).toThrow(/FRAMED_DERIVATION_STALLED/);
  });
});
