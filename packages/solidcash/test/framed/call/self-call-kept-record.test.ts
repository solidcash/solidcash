import { describe, expect, it } from 'vitest';
import {
  FrameKind, buildPushdataCommitment, encodeIntegerValue, type Artifact,
} from '@solidcash/utils';
import {
  entryRecordReadUnlock, stateRecordLockingBytecode, stateRecordUnlockingBytecode,
} from '../../../src/framed/deploy/index.js';
import { encodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import type { CompositionDraftPlan, DraftRecordEntry } from '../../../src/framed/composer/index.js';
import {
  USER_LOCK, compileAndDeploy, composeAndDerive, hexOf, master, masterInput, rootOf, seededAddress, selectorOf,
  token, userInput,
} from '../shapes/harness.js';

/**
 * A framed frame that keeps a sorted-mapping node record and writes a data record, entered by a user.
 *
 * Two bodies read the same mapping node. `readThrough` passes the read as an argument of a self-call
 * (`this.onlySelfRecord(this.bal[k])`), which the framed lowering keeps as an `OP_DEFINE` subroutine that runs
 * as the contract; the control holds the read in a local and writes the scalar itself. The frame's witness block
 * declares the kept node and the written data record in both cases, and the whole shipped path runs: the source
 * through the shipped compiler, both programs through the shipped deployment, the composer laying the frame out,
 * the derivation filling it, and the BCH-2026 machine asked for a verdict on every contract input.
 *
 * The self-calling contract declares two entries (`onlySelfRecord` and `readThrough`), so its master dispatches
 * over several bodies and a user's frame leads its call data with the entry's four-byte selector: a frame that
 * omits it stops at the master's `emitEntrySelectorSizeCheck` (`OP_SIZE OP_4 OP_NUMEQUALVERIFY`), which the
 * derivation reports only as a stall. The control has a single entry, so its master carries no selector.
 */

const ZERO_SLOT = new Uint8Array(32);
const LABEL = 'self-call kept record tok';
const ADDRESS = seededAddress(LABEL);
const RECORD_INDEX = 1;
const NODE_INDEX = 2;

const SELF_CALL = 'pragma solidcash ^0.14.0; contract Tok { mapping(address => int) bal; int seen;'
  + ' function onlySelfRecord(int x) { this.seen = x; require(true); }'
  + ` function readThrough() { this.onlySelfRecord(this.bal[0x${hexOf(ADDRESS)}]); require(true); } }`;

const LOCAL_READ = 'pragma solidcash ^0.14.0; contract Tok { mapping(address => int) bal; int seen;'
  + ` function readThrough() { int v = this.bal[0x${hexOf(ADDRESS)}]; this.seen = v; require(true); } }`;

interface Case {
  readonly plan: CompositionDraftPlan;
  readonly artifacts: Record<string, Artifact>;
  readonly nodeCommitment: Uint8Array;
  readonly before: Uint8Array;
  readonly after: Uint8Array;
}

/** Compiles and plans one source: the frame declares the kept node and the written data record at fixed indices. */
function buildCase(source: string): Case {
  const { artifacts, contracts } = compileAndDeploy(source, { Tok: LABEL });
  const tok = contracts.Tok!;
  const layout = artifacts.Tok!.stateLayout!;
  const collection = layout.collections!.find((candidate) => candidate.name === 'bal')!;
  const categoryHex = hexOf(tok.category);
  const commitment = (seen: bigint): Uint8Array =>
    new Uint8Array(Buffer.from(buildPushdataCommitment(layout, { seen }, 0), 'hex'));
  const before = commitment(0n);
  const after = commitment(100n);
  const nodeCommitment = encodeEntryCommitment(keyToSlotMulti([ADDRESS]), ZERO_SLOT, encodeIntegerValue(100n));
  const readUnlock = entryRecordReadUnlock(categoryHex, collection.signature);

  // The two bodies read the same node, so both frames declare it kept; only the self-calling contract dispatches.
  const dispatches = artifacts.Tok!.abi.filter((row) => row.selector !== undefined).length > 1;
  const segments: (readonly DraftRecordEntry[])[] = [[
    { in: RECORD_INDEX, out: RECORD_INDEX, viewIn: before, viewOut: after },
    { in: NODE_INDEX, out: NODE_INDEX, viewIn: nodeCommitment, viewOut: nodeCommitment },
  ]];
  const recordSource = {
    lockingBytecode: stateRecordLockingBytecode(categoryHex),
    valueSatoshis: 20_000n,
    token: token(tok.category, 'mutable', before),
  };
  const plan: CompositionDraftPlan = {
    blocks: [{ contract: 'Tok', masters: ['tok-1'], state: ['record', 'node'] }],
    userInputs: [{ id: 'user', index: 3 }],
    masters: [master({
      master: 'tok-1', contract: 'Tok', entry: 'readThrough', program: tok.program,
      frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: ADDRESS, value: 0n },
      facts: {
        contract: 'Tok', functionName: 'readThrough', kind: FrameKind.ROOT,
        callerIsUser: true, originEqualsCaller: true, makesExternalCall: false, mastersOfContract: 1,
      },
      enteredBy: 'user', origin: 'user',
      segments,
      ...(dispatches
        ? { argumentPushes: [selectorOf(artifacts, 'Tok', 'readThrough')], dispatches: true }
        : {}),
    })],
    inputs: {
      'tok-1': { source: masterInput(tok) },
      record: {
        source: recordSource,
        output: { ...recordSource, token: token(tok.category, 'mutable', after) },
        unlockingBytecode: stateRecordUnlockingBytecode(categoryHex, 0, 1),
      },
      node: {
        source: {
          lockingBytecode: readUnlock.lockingBytecode, valueSatoshis: 1_500n,
          token: token(tok.category, 'mutable', nodeCommitment),
        },
        unlockingBytecode: readUnlock.unlockingBytecode,
      },
      user: userInput(),
    },
  };
  return { plan, artifacts, nodeCommitment, before, after };
}

describe('a user-entered frame that keeps a mapping node and writes a data record', () => {
  it('settles the read taken as a self-call argument, keeping the node and writing the record', () => {
    const { plan, artifacts, nodeCommitment, after } = buildCase(SELF_CALL);
    const outcome = composeAndDerive(plan, [artifacts.Tok!], [rootOf('Tok', 'readThrough', 'tok-1')]);

    expect(outcome.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(outcome.completed.map((frame) => frame.functionName)).toStrictEqual(['Tok.readThrough()']);

    const nodeIndex = outcome.draft.layout.participants.find((placed) => placed.id === 'node')!.index;
    const recordIndex = outcome.draft.layout.participants.find((placed) => placed.id === 'record')!.index;
    // The node the read resolves is recreated unchanged; the record carries the value the body wrote.
    expect(new Uint8Array(outcome.transaction.outputs[nodeIndex]!.token!.nft!.commitment))
      .toStrictEqual(nodeCommitment);
    expect(new Uint8Array(outcome.transaction.outputs[recordIndex]!.token!.nft!.commitment)).toStrictEqual(after);
  });

  it('settles the same read held in a local, as the accepted control', () => {
    const { plan, artifacts, nodeCommitment, after } = buildCase(LOCAL_READ);
    const outcome = composeAndDerive(plan, [artifacts.Tok!], [rootOf('Tok', 'readThrough', 'tok-1')]);

    expect(outcome.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(outcome.completed.map((frame) => frame.functionName)).toStrictEqual(['Tok.readThrough()']);

    const nodeIndex = outcome.draft.layout.participants.find((placed) => placed.id === 'node')!.index;
    const recordIndex = outcome.draft.layout.participants.find((placed) => placed.id === 'record')!.index;
    expect(new Uint8Array(outcome.transaction.outputs[nodeIndex]!.token!.nft!.commitment))
      .toStrictEqual(nodeCommitment);
    expect(new Uint8Array(outcome.transaction.outputs[recordIndex]!.token!.nft!.commitment)).toStrictEqual(after);
  });
});
