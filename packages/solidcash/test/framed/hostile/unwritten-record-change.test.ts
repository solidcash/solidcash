import { describe, expect, it } from 'vitest';
import { layoutWithFacets } from '../shapes/harness.js';
import {
  FrameKind, buildPushdataCommitment, bytesToHex, encodeIntegerValue, type RecordEntry,
} from '@solidcash/utils';
import { stateRecordLockingBytecode, stateRecordUnlockingBytecode } from '../../../src/framed/deploy/index.js';
import {
  USER_LOCK, compileAndDeploy, composeAndDerive, entryName, hexOf, master, masterInput, rootOf, seededAddress,
  selectorOf, token, userInput, userInputs, validatorFor,
} from '../shapes/harness.js';
import {
  participant, type CompositionDraftPlan, type DraftMaster,
} from '../../../src/framed/composer/index.js';

/**
 * A record declared changed in a segment its frame's code does not write it in (T44).
 *
 * Settlement chains whatever views a frame declares, so a frame's code has to account for every record it declares:
 * a record it does not write in a segment is declared kept there. Each entry below settles with its honest
 * declarations and stalls with the same record declared changed where its code does not change it: an entry that
 * never touches the record, one that writes it before a call and would see it changed after, a guard written
 * before and after a call whose intermediate value a callee would read, and a call only some paths make, whose
 * segments the frame counts as it runs.
 */

const PING_ADDRESS = seededAddress('unwritten record change ping');
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IPing { function ping(); }'
  + ' contract Ping { function ping() { require(true); } }'
  + ' contract Ledger {'
  + '   int count;'
  + '   function noop() { require(true); }'
  + `   function maybe(int b) { if (b > 0) { IPing(0x${hexOf(PING_ADDRESS)}).ping(); } require(true); }`
  + `   function touch() { IPing(0x${hexOf(PING_ADDRESS)}).ping(); require(true); }`
  + `   function bump(int id) { this.count = id + 1; IPing(0x${hexOf(PING_ADDRESS)}).ping(); require(true); }`
  + `   function guard() { this.count = 1; IPing(0x${hexOf(PING_ADDRESS)}).ping(); this.count = 0; require(true); }`
  + '   function countOf() view returns (int) { return this.count; }'
  + ' }';

const { artifacts, contracts } = compileAndDeploy(SOURCE, {
  Ledger: 'unwritten record change ledger', Ping: 'unwritten record change ping',
});
const commitment = (count: bigint): Uint8Array => new Uint8Array(Buffer.from(
  buildPushdataCommitment(artifacts.Ledger!.stateLayout!, { count }, 0), 'hex'));
const ZERO = commitment(0n);
const ONE = commitment(1n);
const EIGHT = commitment(8n);
const FAKE = commitment(999n);

type Entry = 'noop' | 'touch' | 'bump' | 'guard' | 'maybe';
type Views = readonly (readonly [Uint8Array, Uint8Array])[];

/** The composition: `entry` runs on the ledger with its record declared `views`, one pair per segment. */
function plan(entry: Entry, views: Views): CompositionDraftPlan {
  const ledger = contracts.Ledger!;
  const ping = contracts.Ping!;
  const calls = views.length - 1;
  const blocks: CompositionDraftPlan['blocks'] = [
    { contract: 'Ledger', masters: ['ledger-1'], validator: { id: 'validator', settles: [] }, state: ['record'] },
    ...(calls > 0 ? [{ contract: 'Ping', masters: ['ping-1'], state: [] }] : []),
  ];
  const layout = layoutWithFacets(blocks);
  const record = participant(layout, 'record').index;
  const pingPushes = [selectorOf(artifacts, 'Ping', 'ping')];
  const ledgerMaster = master({
    master: 'ledger-1', contract: 'Ledger', entry, program: ledger.program,
    facts: {
      contract: 'Ledger', functionName: entryName('Ledger', entry), kind: FrameKind.ROOT,
      callerIsUser: true, originEqualsCaller: true, makesExternalCall: calls > 0, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: ledger.address, value: 0n },
    enteredBy: 'user', origin: 'user',
    calls: calls > 0 ? [{
      kind: FrameKind.CALL, callee: 'ping-1', target: ping.address, value: 0n, argumentPushes: pingPushes,
    }] : [],
    segments: views.map(([viewIn, viewOut]): RecordEntry[] => [{ in: record, out: record, viewIn, viewOut }]),
    argumentPushes: [selectorOf(artifacts, 'Ledger', entry), ...(entry === 'bump' ? [encodeIntegerValue(7n)] : []),
      ...(entry === 'maybe' ? [encodeIntegerValue(1n)] : [])],
    dispatches: true,
  });
  const pingMaster: DraftMaster = master({
    master: 'ping-1', contract: 'Ping', entry: 'ping', program: ping.program,
    facts: {
      contract: 'Ping', functionName: entryName('Ping', 'ping'), kind: FrameKind.CALL,
      callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.CALL, sender: ledger.address, self: ping.address, value: 0n },
    enteredBy: 'ledger-1', origin: 'user', argumentPushes: pingPushes,
  });
  const lock = stateRecordLockingBytecode(bytesToHex(ledger.category));
  const validator = validatorFor(ledger.category);
  return {
    blocks,
    userInputs: userInputs(['user'], layout.funderInputBase),
    masters: calls > 0 ? [ledgerMaster, pingMaster] : [ledgerMaster],
    inputs: {
      'ledger-1': { source: masterInput(ledger) },
      ...(calls > 0 ? { 'ping-1': { source: masterInput(ping) } } : {}),
      validator: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(ledger.category, 'mutable') },
      },
      record: {
        source: { lockingBytecode: lock, valueSatoshis: 20_000n, token: token(ledger.category, 'mutable', ZERO) },
        output: {
          lockingBytecode: lock, valueSatoshis: 20_000n,
          token: token(ledger.category, 'mutable', views[views.length - 1]![1]),
        },
        unlockingBytecode: stateRecordUnlockingBytecode(bytesToHex(ledger.category),
          participant(layout, 'ledger-1').index, 1),
      },
      user: userInput(),
    },
    validator: {
      id: 'validator', covers: calls > 0 ? ['Ping'] : [],
      settles: [],
      redeemScript: validator.redeem,
    },
  };
}

const compose = (entry: Entry, views: Views): ReturnType<typeof composeAndDerive> => composeAndDerive(
  plan(entry, views), [artifacts.Ledger!, artifacts.Ping!], [rootOf('Ledger', entry, 'ledger-1')]);
const refusals = (outcome: ReturnType<typeof composeAndDerive>): readonly string[] => outcome.verdicts
  .filter((verdict) => !verdict.accepted).map((verdict) => `${verdict.participant}: ${verdict.objection}`);

describe('a record declared changed where its frame does not write it', () => {
  it('settles each entry with its record declared as its code leaves it', () => {
    expect(refusals(compose('noop', [[ZERO, ZERO]]))).toStrictEqual([]);
    expect(refusals(compose('touch', [[ZERO, ZERO], [ZERO, ZERO]]))).toStrictEqual([]);
    expect(refusals(compose('bump', [[ZERO, EIGHT], [EIGHT, EIGHT]]))).toStrictEqual([]);
    expect(refusals(compose('guard', [[ZERO, ONE], [ONE, ZERO]]))).toStrictEqual([]);
  });

  it('refuses the record declared changed by code that never touches it', () => {
    expect(() => compose('noop', [[ZERO, FAKE]])).toThrow(/FRAMED_DERIVATION_STALLED/);
    expect(() => compose('touch', [[ZERO, ZERO], [ZERO, FAKE]])).toThrow(/FRAMED_DERIVATION_STALLED/);
    expect(() => compose('touch', [[ZERO, FAKE], [FAKE, FAKE]])).toThrow(/FRAMED_DERIVATION_STALLED/);
  });

  it('refuses the record declared changed around a call from the value the code wrote', () => {
    // Rewritten after the write, so the transaction would end at a value no code computed.
    expect(() => compose('bump', [[ZERO, EIGHT], [EIGHT, FAKE]])).toThrow(/FRAMED_DERIVATION_STALLED/);
    // The guard shown unset while the call runs, so a callee re-entering would pass it.
    expect(() => compose('guard', [[ZERO, ZERO], [ZERO, ZERO]])).toThrow(/FRAMED_DERIVATION_STALLED/);
  });

  it('refuses the record declared changed around a call only some paths make', () => {
    expect(refusals(compose('maybe', [[ZERO, ZERO], [ZERO, ZERO]]))).toStrictEqual([]);
    expect(() => compose('maybe', [[ZERO, ZERO], [ZERO, FAKE]])).toThrow(/FRAMED_DERIVATION_STALLED/);
    expect(() => compose('maybe', [[ZERO, FAKE], [FAKE, FAKE]])).toThrow(/FRAMED_DERIVATION_STALLED/);
  });
});
