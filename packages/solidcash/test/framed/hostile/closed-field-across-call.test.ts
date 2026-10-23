import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import {
  encodeIntegerValue, buildPushdataCommitment, bytesToHex, parsePushdataCommitment, FrameKind, type RecordEntry,
} from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { stateRecordLockingBytecode, stateRecordUnlockingBytecode } from '../../../src/framed/deploy/index.js';
import { readComputedDeclaration } from '../../../src/framed/deploy/declaration.js';
import {
  createComposedDerivationHost, deriveDepthFirst, participant, reportCompositionRefusal,
  type CompositionDraftPlan, type CompositionRefusal,
} from '../../../src/framed/composer/index.js';
import {
  USER_LOCK, compileAndDeploy, entryName, hexOf, layoutWithFacets, master, masterInput, rootOf, seededAddress,
  selectorOf, token, userInput, userInputs, validatorFor,
} from '../shapes/harness.js';

/**
 * A record field written before a call, which a frame re-entering the writer below that call changes, where the
 * writer's body ends.
 *
 * The writer makes its one call, so its record has two segments, and the field it wrote before the call is the
 * first one's: the second begins at the view the re-entered frame left. Where the end takes the record as written,
 * because another field is written past the call or because an arm writes the field there, the closed field is that
 * view's own. Rebuilding it from the value written before the call instead would accept the writer declaring the
 * record back at that value, which drops the re-entered change: that lost update is refused at the writer. The EVM's
 * outcome, the change kept, settles; so does the arm that writes past the call, and a callee that does not re-enter.
 *
 * A writer that makes the call in a loop runs a number of calls only its execution counts, past which the compiler
 * cannot tell by position which of its fields a call closed: it reads every pending field again after each call, so
 * the same lost update is refused there and the change kept settles.
 */

const LEDGER_LABEL = 'closed field across call ledger';
const SINK_LABEL = 'closed field across call sink';
const QUIET_LABEL = 'closed field across call quiet';
const LEDGER = hexOf(seededAddress(LEDGER_LABEL));
const SINK = hexOf(seededAddress(SINK_LABEL));
const QUIET = hexOf(seededAddress(QUIET_LABEL));

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ISink { function take(); }'
  + ' interface ILedger { function bump(); }'
  + ` contract Sink { function take() { ILedger(0x${LEDGER}).bump(); require(true); } }`
  + ' contract Quiet { function take() { require(true); } }'
  + ' contract Ledger {'
  + '   int total;'
  + '   int mark;'
  + `   function setThenMark(int amount) { this.total = amount; ISink(0x${SINK}).take(); this.mark = 1; require(true); }`
  + `   function setThenRaiseIfHigh(int amount) { this.total = amount; ISink(0x${SINK}).take();`
  + '     if (amount > 10) { this.total = amount + 1; } require(true); }'
  + `   function setThenMarkQuietly(int amount) { this.total = amount; ISink(0x${QUIET}).take(); this.mark = 1;`
  + '     require(true); }'
  + '   function setThenLoopMark(int amount, int turns) { this.total = amount;'
  + `     for (int i = 0; i < turns; i = i + 1) { ISink(0x${SINK}).take(); } this.mark = 1; require(true); }`
  + '   function bump() { this.total = this.total + 100; require(true); }'
  + ' }';

const { artifacts, contracts } = compileAndDeploy(SOURCE, { Ledger: LEDGER_LABEL, Sink: SINK_LABEL, Quiet: QUIET_LABEL });
const record = (total: bigint, mark = 0n): Uint8Array => new Uint8Array(Buffer.from(
  buildPushdataCommitment(artifacts.Ledger!.stateLayout!, { total, mark }, 0), 'hex'));
const BEFORE = record(0n);

type View = readonly [Uint8Array, Uint8Array];
type Callee = 'Sink' | 'Quiet';

/**
 * `entry(amount)` on the ledger, or `entry(amount, turns)` for the loop, whose one call goes to `callee`: the sink calls
 * back into `bump`, the quiet callee does not. The writer declares its record `views.set`, one view pair per segment,
 * and the re-entered frame `views.bump`.
 */
function plan(
  entry: string, amount: bigint, callee: Callee, views: { readonly set: readonly [View, View]; readonly bump?: View },
  turns?: bigint,
): CompositionDraftPlan {
  const ledger = contracts.Ledger!;
  const target = contracts[callee]!;
  const relays = callee === 'Sink';
  const blocks: CompositionDraftPlan['blocks'] = [
    {
      contract: 'Ledger', masters: relays ? ['set-1', 'bump-1'] : ['set-1'],
      validator: { id: 'validator', settles: [] }, state: ['record'],
    },
    { contract: callee, masters: ['take-1'], state: [] },
  ];
  const layout = layoutWithFacets(blocks);
  const index = participant(layout, 'record').index;
  const declared = ([viewIn, viewOut]: View): RecordEntry => ({ in: index, out: index, viewIn, viewOut });
  const setPushes = [
    selectorOf(artifacts, 'Ledger', entry), ...(turns === undefined ? [] : [encodeIntegerValue(turns)]),
    encodeIntegerValue(amount),
  ];
  const takePushes = [selectorOf(artifacts, callee, 'take')];
  const bumpPushes = [selectorOf(artifacts, 'Ledger', 'bump')];
  const lock = stateRecordLockingBytecode(bytesToHex(ledger.category));
  const validator = validatorFor(ledger.category);
  return {
    blocks,
    userInputs: userInputs(['user'], layout.funderInputBase),
    masters: [
      master({
        master: 'set-1', contract: 'Ledger', entry, program: ledger.program,
        facts: {
          contract: 'Ledger', functionName: entryName('Ledger', entry), kind: FrameKind.ROOT,
          callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: relays ? 2 : 1,
        },
        frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: ledger.address, value: 0n },
        enteredBy: 'user', origin: 'user',
        calls: [{ kind: FrameKind.CALL, callee: 'take-1', target: target.address, value: 0n, argumentPushes: takePushes }],
        segments: views.set.map((view) => [declared(view)]),
        argumentPushes: setPushes, dispatches: true,
      }),
      master({
        master: 'take-1', contract: callee, entry: 'take', program: target.program,
        facts: {
          contract: callee, functionName: entryName(callee, 'take'), kind: FrameKind.CALL,
          callerIsUser: false, originEqualsCaller: false, makesExternalCall: relays, mastersOfContract: 1,
        },
        frame: { kind: FrameKind.CALL, sender: ledger.address, self: target.address, value: 0n },
        enteredBy: 'set-1', origin: 'user',
        calls: relays
          ? [{ kind: FrameKind.CALL, callee: 'bump-1', target: ledger.address, value: 0n, argumentPushes: bumpPushes }]
          : [],
        argumentPushes: takePushes,
      }),
      ...(relays ? [
        master({
          master: 'bump-1', contract: 'Ledger', entry: 'bump', program: ledger.program,
          facts: {
            contract: 'Ledger', functionName: entryName('Ledger', 'bump'), kind: FrameKind.CALL,
            callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 2,
          },
          frame: { kind: FrameKind.CALL, sender: target.address, self: ledger.address, value: 0n },
          enteredBy: 'take-1', origin: 'user',
          segments: [[declared(views.bump!)]],
          argumentPushes: bumpPushes, dispatches: true,
        }),
      ] : []),
    ],
    inputs: {
      'set-1': { source: masterInput(ledger) },
      'take-1': { source: masterInput(target) },
      ...(relays ? { 'bump-1': { source: masterInput(ledger) } } : {}),
      validator: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(ledger.category, 'mutable') },
      },
      record: {
        source: { lockingBytecode: lock, valueSatoshis: 20_000n, token: token(ledger.category, 'mutable', BEFORE) },
        output: {
          lockingBytecode: lock, valueSatoshis: 20_000n, token: token(ledger.category, 'mutable', views.set[1][1]),
        },
        unlockingBytecode: stateRecordUnlockingBytecode(bytesToHex(ledger.category),
          participant(layout, 'set-1').index, 1),
      },
      user: userInput(),
    },
    validator: {
      id: 'validator', covers: [callee],
      settles: [{ category: ledger.category, stateInputs: ['record'] }],
      redeemScript: validator.redeem,
    },
  };
}

/**
 * Derives the composition from the writer and reports the frame the execution is refused at, if any, with the view
 * the writer declares and the one its code computes at the close it fails on, or the record the transaction settles
 * when it is accepted.
 */
function derive(entry: string, amount: bigint, callee: Callee, views: Parameters<typeof plan>[3], turns?: bigint): {
  readonly code?: string;
  readonly report: CompositionRefusal;
  readonly close?: readonly [string, string];
  readonly settled: Record<string, unknown>;
} {
  const compositionArtifacts = [artifacts.Ledger!, artifacts[callee]!];
  const { host, draft } = createComposedDerivationHost({
    vm: compositionMachine(), artifacts: compositionArtifacts, plan: plan(entry, amount, callee, views, turns),
  });
  let code: string | undefined;
  try {
    deriveDepthFirst(rootOf('Ledger', entry, 'set-1'), host);
  } catch (caught) {
    code = (caught as { code?: string }).code;
  }
  const program = draft.programFor('set-1');
  const reading = readComputedDeclaration({ vm: compositionMachine(), program, maximumCommitmentBytes: 128 });
  const output = program.transaction.outputs[participant(draft.layout, 'record').index]!;
  return {
    ...(code === undefined ? {} : { code }),
    report: reportCompositionRefusal({ draft, artifacts: compositionArtifacts, vm: compositionMachine() }),
    ...(reading.ok ? { close: [binToHex(reading.declared), binToHex(reading.computed)] as const } : {}),
    settled: parsePushdataCommitment(binToHex(output.token!.nft!.commitment), artifacts.Ledger!.stateLayout!, 0),
  };
}

/** Expects the writer refused at its own frame, the re-entered frame accepting, with the views at the close. */
function expectRefusedAtWriter(outcome: ReturnType<typeof derive>, declared: Uint8Array, computed: Uint8Array): void {
  expect(outcome.code).toBe('FRAMED_DERIVATION_STALLED');
  expect(outcome.report.accepted).toBe(false);
  expect(outcome.report.innermost!.master).toBe('set-1');
  expect(outcome.report.refusals.map((refusal) => refusal.master)).not.toContain('bump-1');
  expect(outcome.close).toStrictEqual([binToHex(declared), binToHex(computed)]);
}

describe('a record field written before a call, changed by a frame that re-enters the writer below it', () => {
  it('is refused declared back at the value written, where another field is written past the call', () => {
    const outcome = derive('setThenMark', 11n, 'Sink', {
      set: [[BEFORE, record(11n)], [record(111n), record(11n, 1n)]], bump: [record(11n), record(111n)],
    });
    // The end rebuilds the record from the view the segment past the call begins at, with the field written there.
    expectRefusedAtWriter(outcome, record(11n, 1n), record(111n, 1n));
  });

  it('settles with the re-entered change kept, where another field is written past the call', () => {
    const outcome = derive('setThenMark', 11n, 'Sink', {
      set: [[BEFORE, record(11n)], [record(111n), record(111n, 1n)]], bump: [record(11n), record(111n)],
    });
    expect(outcome.code).toBeUndefined();
    expect(outcome.report.accepted).toBe(true);
    expect(BigInt(outcome.settled.total as bigint)).toBe(111n);
    expect(BigInt(outcome.settled.mark as bigint)).toBe(1n);
  });

  it('is refused declared back at the value written, on the path whose arm skips the write past the call', () => {
    const outcome = derive('setThenRaiseIfHigh', 5n, 'Sink', {
      set: [[BEFORE, record(5n)], [record(105n), record(5n)]], bump: [record(5n), record(105n)],
    });
    // The path that skips the arm reads the field again where the arm would have written it.
    expectRefusedAtWriter(outcome, record(5n), record(105n));
  });

  it('settles with the re-entered change kept on the skipping path, and overwritten on the writing one', () => {
    const skipped = derive('setThenRaiseIfHigh', 5n, 'Sink', {
      set: [[BEFORE, record(5n)], [record(105n), record(105n)]], bump: [record(5n), record(105n)],
    });
    expect(skipped.code).toBeUndefined();
    expect(skipped.report.accepted).toBe(true);
    expect(BigInt(skipped.settled.total as bigint)).toBe(105n);
    const written = derive('setThenRaiseIfHigh', 11n, 'Sink', {
      set: [[BEFORE, record(11n)], [record(111n), record(12n)]], bump: [record(11n), record(111n)],
    });
    expect(written.code).toBeUndefined();
    expect(written.report.accepted).toBe(true);
    expect(BigInt(written.settled.total as bigint)).toBe(12n);
  });

  it('settles where the callee does not re-enter, the record past the call as the writer left it', () => {
    const outcome = derive('setThenMarkQuietly', 11n, 'Quiet', {
      set: [[BEFORE, record(11n)], [record(11n), record(11n, 1n)]],
    });
    expect(outcome.code).toBeUndefined();
    expect(outcome.report.accepted).toBe(true);
    expect(BigInt(outcome.settled.total as bigint)).toBe(11n);
  });

  it('is refused declared back at the value written, past a loop whose call the writer is re-entered below', () => {
    const outcome = derive('setThenLoopMark', 11n, 'Sink', {
      set: [[BEFORE, record(11n)], [record(111n), record(11n, 1n)]], bump: [record(11n), record(111n)],
    }, 1n);
    // The call's own turn reads the field again from the view the segment past it begins at.
    expectRefusedAtWriter(outcome, record(11n, 1n), record(111n, 1n));
  });

  it('settles with the re-entered change kept past a loop of calls', () => {
    const outcome = derive('setThenLoopMark', 11n, 'Sink', {
      set: [[BEFORE, record(11n)], [record(111n), record(111n, 1n)]], bump: [record(11n), record(111n)],
    }, 1n);
    expect(outcome.code).toBeUndefined();
    expect(outcome.report.accepted).toBe(true);
    expect(BigInt(outcome.settled.total as bigint)).toBe(111n);
    expect(BigInt(outcome.settled.mark as bigint)).toBe(1n);
  });
});
