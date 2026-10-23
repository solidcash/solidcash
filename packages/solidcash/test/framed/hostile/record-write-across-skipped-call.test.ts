import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { encodeIntegerValue, buildPushdataCommitment, bytesToHex, FrameKind, type RecordEntry } from '@solidcash/utils';
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
 * A record written before a guarded call, which a frame re-entering the writer below that call changes.
 *
 * The writer's calls vary on its paths, so its end closes the segment its own calls have reached: where the guard
 * skips the call, that is the write's own segment, and the record it wrote is left to the epilogue's close of the
 * view the body rebuilt; where the call is made, the end holds the record kept in the segment past the call. A callee
 * that calls back into the writer and changes the record there leaves that segment beginning at the changed view.
 * Holding the record kept there is what refuses the writer declaring it back at the view it wrote, which would drop
 * the re-entered frame's change: a close that exempted the written record on every path would accept that lost
 * update. Declaring the record at the changed view meets the epilogue's close of the view the writer rebuilt, so the
 * re-entered change is refused either way.
 */

const LEDGER_LABEL = 'record write across skipped call ledger';
const SINK_LABEL = 'record write across skipped call sink';
const LEDGER = hexOf(seededAddress(LEDGER_LABEL));
const SINK = hexOf(seededAddress(SINK_LABEL));

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ISink { function take(); }'
  + ' interface ILedger { function bump(); }'
  + ` contract Sink { function take() { ILedger(0x${LEDGER}).bump(); require(true); } }`
  + ' contract Ledger {'
  + '   int total;'
  + '   function setThenRelay(int amount) {'
  + '     this.total = amount;'
  + `     if (amount > 10) { ISink(0x${SINK}).take(); }`
  + '     require(true);'
  + '   }'
  + '   function bump() { this.total = this.total + 100; require(true); }'
  + ' }';

const { artifacts, contracts } = compileAndDeploy(SOURCE, { Ledger: LEDGER_LABEL, Sink: SINK_LABEL });
const record = (total: bigint): Uint8Array => new Uint8Array(Buffer.from(
  buildPushdataCommitment(artifacts.Ledger!.stateLayout!, { total }, 0), 'hex'));
const BEFORE = record(0n);
const SKIPPED = record(5n);
const WRITTEN = record(11n);
const BUMPED = record(111n);

type View = readonly [Uint8Array, Uint8Array];

/**
 * `setThenRelay(amount)` on the ledger, whose callee calls back into `bump` when the guard holds. The writer
 * declares its record `views.set`, one view pair per segment, and the re-entered frame `views.bump`.
 */
function plan(amount: bigint, views: { readonly set: readonly View[]; readonly bump?: View }): CompositionDraftPlan {
  const ledger = contracts.Ledger!;
  const sink = contracts.Sink!;
  const relays = views.bump !== undefined;
  const blocks: CompositionDraftPlan['blocks'] = [
    {
      contract: 'Ledger', masters: relays ? ['set-1', 'bump-1'] : ['set-1'],
      validator: { id: 'validator', settles: [] }, state: ['record'],
    },
    ...(relays ? [{ contract: 'Sink', masters: ['take-1'], state: [] }] : []),
  ];
  const layout = layoutWithFacets(blocks);
  const index = participant(layout, 'record').index;
  const declared = ([viewIn, viewOut]: View): RecordEntry => ({ in: index, out: index, viewIn, viewOut });
  const setPushes = [selectorOf(artifacts, 'Ledger', 'setThenRelay'), encodeIntegerValue(amount)];
  const takePushes = [selectorOf(artifacts, 'Sink', 'take')];
  const bumpPushes = [selectorOf(artifacts, 'Ledger', 'bump')];
  const lock = stateRecordLockingBytecode(bytesToHex(ledger.category));
  const validator = validatorFor(ledger.category);
  const final = views.set[views.set.length - 1]![1];
  return {
    blocks,
    userInputs: userInputs(['user'], layout.funderInputBase),
    masters: [
      master({
        master: 'set-1', contract: 'Ledger', entry: 'setThenRelay', program: ledger.program,
        facts: {
          contract: 'Ledger', functionName: entryName('Ledger', 'setThenRelay'), kind: FrameKind.ROOT,
          callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: relays ? 2 : 1,
        },
        frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: ledger.address, value: 0n },
        enteredBy: 'user', origin: 'user',
        calls: relays
          ? [{ kind: FrameKind.CALL, callee: 'take-1', target: sink.address, value: 0n, argumentPushes: takePushes }]
          : [],
        segments: views.set.map((view) => [declared(view)]),
        argumentPushes: setPushes, dispatches: true,
      }),
      ...(relays ? [
        master({
          master: 'take-1', contract: 'Sink', entry: 'take', program: sink.program,
          facts: {
            contract: 'Sink', functionName: entryName('Sink', 'take'), kind: FrameKind.CALL,
            callerIsUser: false, originEqualsCaller: false, makesExternalCall: true, mastersOfContract: 1,
          },
          frame: { kind: FrameKind.CALL, sender: ledger.address, self: sink.address, value: 0n },
          enteredBy: 'set-1', origin: 'user',
          calls: [{ kind: FrameKind.CALL, callee: 'bump-1', target: ledger.address, value: 0n, argumentPushes: bumpPushes }],
          argumentPushes: takePushes,
        }),
        master({
          master: 'bump-1', contract: 'Ledger', entry: 'bump', program: ledger.program,
          facts: {
            contract: 'Ledger', functionName: entryName('Ledger', 'bump'), kind: FrameKind.CALL,
            callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 2,
          },
          frame: { kind: FrameKind.CALL, sender: sink.address, self: ledger.address, value: 0n },
          enteredBy: 'take-1', origin: 'user',
          segments: [[declared(views.bump!)]],
          argumentPushes: bumpPushes, dispatches: true,
        }),
      ] : []),
    ],
    inputs: {
      'set-1': { source: masterInput(ledger) },
      ...(relays ? { 'bump-1': { source: masterInput(ledger) }, 'take-1': { source: masterInput(sink) } } : {}),
      validator: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(ledger.category, 'mutable') },
      },
      record: {
        source: { lockingBytecode: lock, valueSatoshis: 20_000n, token: token(ledger.category, 'mutable', BEFORE) },
        output: { lockingBytecode: lock, valueSatoshis: 20_000n, token: token(ledger.category, 'mutable', final) },
        unlockingBytecode: stateRecordUnlockingBytecode(bytesToHex(ledger.category),
          participant(layout, 'set-1').index, 1),
      },
      user: userInput(),
    },
    validator: {
      id: 'validator', covers: relays ? ['Sink'] : [],
      settles: [{ category: ledger.category, stateInputs: ['record'] }],
      redeemScript: validator.redeem,
    },
  };
}

/**
 * Derives the composition from the writer and reports the frame the execution is refused at, if any, with the view
 * the writer declares and the one its code computes at the close it fails on.
 */
function derive(amount: bigint, views: Parameters<typeof plan>[1]): {
  readonly code?: string;
  readonly report: CompositionRefusal;
  readonly close?: readonly [string, string];
} {
  const compositionArtifacts = [artifacts.Ledger!, artifacts.Sink!];
  const { host, draft } = createComposedDerivationHost({
    vm: compositionMachine(), artifacts: compositionArtifacts, plan: plan(amount, views),
  });
  let code: string | undefined;
  try {
    deriveDepthFirst(rootOf('Ledger', 'setThenRelay', 'set-1'), host);
  } catch (caught) {
    code = (caught as { code?: string }).code;
  }
  const reading = readComputedDeclaration({
    vm: compositionMachine(), program: draft.programFor('set-1'), maximumCommitmentBytes: 128,
  });
  return {
    ...(code === undefined ? {} : { code }),
    report: reportCompositionRefusal({ draft, artifacts: compositionArtifacts, vm: compositionMachine() }),
    ...(reading.ok ? { close: [binToHex(reading.declared), binToHex(reading.computed)] as const } : {}),
  };
}

describe('a record written before a guarded call, changed by a frame that re-enters the writer below it', () => {
  it('is accepted where the guard skips the call, the record closed against the view the body rebuilt', () => {
    const { code, report } = derive(5n, { set: [[BEFORE, SKIPPED]] });
    expect(code).toBeUndefined();
    expect(report.accepted).toBe(true);
  });

  it('is refused where the writer declares the record back at the view it wrote, dropping the re-entered change', () => {
    const { code, report, close } = derive(11n, {
      set: [[BEFORE, WRITTEN], [BUMPED, WRITTEN]], bump: [WRITTEN, BUMPED],
    });
    expect(code).toBe('FRAMED_DERIVATION_STALLED');
    expect(report.accepted).toBe(false);
    expect(report.innermost!.master).toBe('set-1');
    expect(report.refusals.map((refusal) => refusal.master)).not.toContain('bump-1');
    // The end holds the record kept past the call: the view it ends with there is the one the segment began with.
    expect(close).toStrictEqual([binToHex(WRITTEN), binToHex(BUMPED)]);
  });

  it('is refused where the writer declares the record at the re-entered change', () => {
    const { code, report, close } = derive(11n, {
      set: [[BEFORE, WRITTEN], [BUMPED, BUMPED]], bump: [WRITTEN, BUMPED],
    });
    expect(code).toBe('FRAMED_DERIVATION_STALLED');
    expect(report.accepted).toBe(false);
    expect(report.innermost!.master).toBe('set-1');
    expect(report.refusals.map((refusal) => refusal.master)).not.toContain('bump-1');
    // The epilogue closes the record against the view the writer rebuilt from the value it wrote.
    expect(close).toStrictEqual([binToHex(BUMPED), binToHex(WRITTEN)]);
  });
});
