import { describe, expect, it } from 'vitest';
import { FrameKind, bytesToHex } from '@solidcash/utils';
import {
  layOutChunkRun, participant, planChunkRun,
  type CompositionDraftPlan, type DraftRecordEntry,
} from '../../../../solidcash/src/framed/composer/index.js';
import { compositionMachine } from '../machine.js';
import {
  stateRecordLockingBytecode, stateRecordUnlockingBytecode,
} from '../../../../solidcash/src/framed/deploy/index.js';
import {
  USER_LOCK, compileAndDeploy, composeAndDerive, hexOf, layoutWithFacets, master, masterInput, rootOf,
  seededAddress, selectorOf, token, userInput, validatorFor,
} from '../../../../solidcash/test/framed/shapes/harness.js';
import { seededCategory } from './validator-input.js';

/**
 * A framed master whose body both touches a dynamic value and makes an external call, settled end to end.
 *
 * The entry reads a `string` state variable, appends to it and calls a stateless callee, so its one execution is
 * declared as two segments: the read before the call and the write after it. Both segments declare the state
 * record and the value's chunk run, and the first segment's written views are the second segment's read views.
 * Every coordinate comes from the composer's own plan: the layout places the block, the chunk plan places the run,
 * and the derivation and the BCH-2026 machine are the shipped ones.
 */

const APP_LABEL = 'dynamic call settlement';
const CALLEE_LABEL = 'dynamic call settlement callee';
const APP_MASTER = 'app-1';
const CALLEE_MASTER = 'callee-1';
const VALIDATOR_ID = 'validator';
const USER_ID = 'user';

const APP_CATEGORY = seededCategory(APP_LABEL);
const CALLEE_ADDRESS = seededAddress(CALLEE_LABEL);

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IPing { function ping(); }'
  + ' contract Callee { function ping() { require(true); } }'
  + ' contract Appender {'
  + '   string public name;'
  + '   function append() {'
  + '     this.name = string.concat(this.name, "!");'
  + `     IPing(0x${hexOf(CALLEE_ADDRESS)}).ping.call();`
  + '     require(true);'
  + '   }'
  + ' }';

const { artifacts, contracts } = compileAndDeploy(SOURCE, {
  Appender: APP_LABEL,
  Callee: CALLEE_LABEL,
});
const app = contracts.Appender!;
const callee = contracts.Callee!;
const stateLayout = artifacts.Appender!.stateLayout!;

const VALUE = 20_000n;
const CHUNK_VALUE = 1_000n;
const utf8 = (text: string): Uint8Array => new Uint8Array(Buffer.from(text, 'utf8'));
/** The value the transaction spends and the one the entry writes, both inside one chunk. */
const SPENT = utf8('hello');
const WRITTEN = utf8('hello!');

const run = planChunkRun({ layout: stateLayout, variable: 'name', spent: SPENT, written: WRITTEN });

interface Built {
  readonly plan: CompositionDraftPlan;
  readonly base: number;
  readonly stateIndex: number;
}

/** The plan of the composition, with every coordinate the composer's own plan states. */
function build(): Built {
  const appCategory = APP_CATEGORY;
  const blocks = (state: readonly string[]): CompositionDraftPlan['blocks'] => [
    { contract: 'Appender', masters: [APP_MASTER], validator: { id: VALIDATOR_ID, settles: [] }, state },
    { contract: 'Callee', masters: [CALLEE_MASTER], state: [] },
  ];

  // The state NFT stays at its own index, so the block is laid out first with only the header, the run is placed
  // past it, and the kept chunks then become participants after the header (and any filler).
  const opened = layoutWithFacets(blocks(['name']));
  const stateIndex = participant(opened, 'name').index;
  const masterIndex = participant(opened, APP_MASTER).index;
  const base = stateIndex + stateLayout.dataNftCount;

  const chunks = layOutChunkRun({
    plan: run, category: appCategory, base, writer: masterIndex, valueSatoshis: CHUNK_VALUE, removedLock: USER_LOCK,
  });
  const kept = chunks.records.filter((record) => record.role === 'kept');
  const created = chunks.records.filter((record) => record.role === 'created');
  const removed = chunks.records.filter((record) => record.role === 'removed');

  const finalBlocks = blocks(['name', ...kept.map((record) => record.id)]);
  const layout = layoutWithFacets(finalBlocks);

  // Every written view is left to the derivation: the body computes it, so the plan states only what each segment
  // reads at its start (the spent commitment).
  const readEntries: DraftRecordEntry[] = [
    { in: stateIndex, out: stateIndex, viewIn: run.spent.header },
    ...kept.map((record): DraftRecordEntry => ({ in: record.index, out: record.index, viewIn: record.viewIn })),
  ];
  const writeEntries: DraftRecordEntry[] = [
    { in: stateIndex, out: stateIndex, viewIn: run.spent.header },
    ...chunks.entries.map((entry): DraftRecordEntry => ({ in: entry.in, out: entry.out, viewIn: entry.viewIn })),
  ];

  const selector = selectorOf(artifacts, 'Callee', 'ping');
  const appMaster = master({
    master: APP_MASTER, contract: 'Appender', entry: 'append', program: app.program,
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: app.address, value: 0n },
    facts: {
      contract: 'Appender', functionName: 'append', kind: FrameKind.ROOT,
      callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
    },
    enteredBy: USER_ID, origin: USER_ID,
    calls: [{ kind: FrameKind.CALL, callee: CALLEE_MASTER, target: callee.address, value: 0n,
      argumentPushes: [selector] }],
    segments: [readEntries, writeEntries],
  });
  const calleeEntry = master({
    master: CALLEE_MASTER, contract: 'Callee', entry: 'ping', program: callee.program,
    frame: { kind: FrameKind.CALL, sender: app.address, self: callee.address, value: 0n },
    facts: {
      contract: 'Callee', functionName: 'ping', kind: FrameKind.CALL,
      callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
    },
    enteredBy: APP_MASTER, origin: USER_ID, calls: [], segments: [[]], argumentPushes: [selector],
  });

  const headerLock = stateRecordLockingBytecode(bytesToHex(appCategory));
  const plan: CompositionDraftPlan = {
    blocks: finalBlocks,
    userInputs: [
      ...removed.map((record) => ({ id: record.id, index: record.index })),
      { id: USER_ID, index: layout.funderInputBase + removed.length },
    ],
    masters: [appMaster, calleeEntry],
    inputs: {
      [APP_MASTER]: { source: masterInput(app) },
      [CALLEE_MASTER]: { source: masterInput(callee) },
      [VALIDATOR_ID]: {
        source: { lockingBytecode: validatorFor(appCategory).lock, valueSatoshis: VALUE,
          token: token(appCategory, 'mutable') },
      },
      name: {
        source: { lockingBytecode: headerLock, valueSatoshis: VALUE,
          token: token(appCategory, 'mutable', run.spent.header) },
        output: { lockingBytecode: headerLock, valueSatoshis: VALUE,
          token: token(appCategory, 'mutable', run.written.header) },
        unlockingBytecode: stateRecordUnlockingBytecode(bytesToHex(appCategory), masterIndex, 1),
      },
      ...Object.fromEntries(chunks.records
        .filter((record) => record.input !== undefined)
        .map((record) => [record.id, record.input!])),
      [USER_ID]: userInput(),
    },
    ...(created.length === 0 ? {} : { trailingOutputs: created.map((record) => record.output!) }),
    validator: {
      id: VALIDATOR_ID,
      covers: ['Callee'],
      redeemScript: validatorFor(appCategory).redeem,
      settles: [],
    },
  };
  return { plan, base, stateIndex };
}

const built = build();
const outcome = composeAndDerive(
  built.plan, [artifacts.Appender!, artifacts.Callee!],
  [rootOf('Appender', 'append', APP_MASTER)],
);

describe('a framed master whose dynamic write shares the frame with a call', () => {
  it('derives the callee before its caller', () => {
    expect(outcome.completed.map((frame) => `${frame.contract}.${frame.functionName}`)).toStrictEqual([
      'Callee.Callee.ping()', 'Appender.Appender.append()',
    ]);
  });

  it('lays the run out at the index the emitted body reads: one width past the state record', () => {
    expect(participant(outcome.draft.layout, `name#${built.base}`).index).toBe(built.base);
    expect(built.base).toBe(built.stateIndex + stateLayout.dataNftCount);
    const declared = outcome.draft.blockOf(APP_MASTER).segments
      .map((segment) => segment.map((entry) => `${entry.in}/${entry.out}`));
    // Both segments declare the state record and the run, chained by the views the derivation learned.
    expect(declared[0]).toStrictEqual([`${built.stateIndex}/${built.stateIndex}`, `${built.base}/${built.base}`]);
    expect(declared[1]).toStrictEqual([`${built.stateIndex}/${built.stateIndex}`, `${built.base}/${built.base}`]);
  });

  it('accepts every contract input of the settled transaction', () => {
    const rejected = outcome.verdicts.filter((verdict) => !verdict.accepted);
    expect(rejected).toStrictEqual([]);
    // The master, the callee, the validator with its facet and the two records are all asked.
    expect(outcome.verdicts.length).toBe(6);
  });

  it('refuses a chunk output whose commitment the body did not compute', () => {
    // The control: the settled derivation's run output carries a commitment the body never computed, so the master
    // recomputes the chunk and refuses it.
    const program = outcome.draft.programFor(APP_MASTER);
    const outputs = program.transaction.outputs.map((output, index) => index === built.base
      ? { ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment: new Uint8Array([7]) } } }
      : output);
    const machine = compositionMachine();
    const state = machine.evaluate({
      inputIndex: program.inputIndex,
      sourceOutputs: program.sourceOutputs,
      transaction: { ...program.transaction, outputs },
    });
    expect(machine.stateSuccess(state)).not.toBe(true);
  });
});
