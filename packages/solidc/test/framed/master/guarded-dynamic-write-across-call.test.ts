import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { FrameKind, bytesToHex, encodeIntegerValue } from '@solidcash/utils';
import {
  createComposedDerivationHost, deriveDepthFirst, layOutChunkRun, participant, planChunkRun, reportCompositionRefusal,
  type CompositionDraftPlan, type CompositionRefusal, type DraftRecordEntry,
} from '../../../../solidcash/src/framed/composer/index.js';
import { compositionMachine } from '../machine.js';
import {
  stateRecordLockingBytecode, stateRecordUnlockingBytecode,
} from '../../../../solidcash/src/framed/deploy/index.js';
import {
  USER_LOCK, compileAndDeploy, entryName, hexOf, layoutWithFacets, master, masterInput, rootOf, seededAddress,
  selectorOf, token, userInput, userInputs, validatorFor,
} from '../../../../solidcash/test/framed/shapes/harness.js';

/**
 * A dynamic value whose write a branch guards, or that the body writes outright, in a frame that makes a call after
 * the write.
 *
 * The frame reads the value where it pre-allocates the guarded write, before the call, and pins the value's run in
 * its last segment, past the call: an arm that skips the write pins the value it read back, and one that takes it pins
 * the value it wrote. A frame re-entering the writer during the call and rewriting the value leaves the last segment
 * beginning at the rewritten run. The pin wrote over it: every input accepted the writer declaring the run back at
 * the value from before the call, and the value its arm wrote over the change, both a lost update. The run must now
 * begin the last segment as the frame read it, so both are refused at the writer, as is the rewritten run carried on:
 * the frame's code holds no read of it. A callee that does not re-enter leaves the run as the frame read it, and
 * the skipped and the taken writes settle. A write no branch guards is read and kept the same way where a call
 * follows it, so the value it pins over a re-entered change is refused too, and it settles where nothing re-enters.
 * Every master, the validator and its facet, and each record are asked for their verdict on the composed transaction.
 */

const NAMER_LABEL = 'guarded dynamic write across call namer';
const RELAY_LABEL = 'guarded dynamic write across call relay';
const QUIET_LABEL = 'guarded dynamic write across call quiet';
const NAMER = hexOf(seededAddress(NAMER_LABEL));
const RELAY = hexOf(seededAddress(RELAY_LABEL));
const QUIET = hexOf(seededAddress(QUIET_LABEL));

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IRelay { function take(); }'
  + ' interface INamer { function shout(); }'
  + ` contract Relay { function take() { INamer(0x${NAMER}).shout(); require(true); } }`
  + ' contract Quiet { function take() { require(true); } }'
  + ' contract Namer {'
  + '   string public name;'
  + `   function maybeRename(int c) { if (c > 10) { this.name = "taken"; } IRelay(0x${RELAY}).take(); require(true); }`
  + `   function maybeRenameQuietly(int c) { if (c > 10) { this.name = "taken"; } IRelay(0x${QUIET}).take();`
  + '     require(true); }'
  + `   function renameThenRelay(int c) { this.name = "taken"; IRelay(0x${RELAY}).take(); require(c > 0); }`
  + `   function renameThenQuiet(int c) { this.name = "taken"; IRelay(0x${QUIET}).take(); require(c > 0); }`
  + '   function shout() { this.name = "HELLO"; require(true); }'
  + ' }';

const { artifacts, contracts } = compileAndDeploy(SOURCE, { Namer: NAMER_LABEL, Relay: RELAY_LABEL, Quiet: QUIET_LABEL });
const namer = contracts.Namer!;
const stateLayout = artifacts.Namer!.stateLayout!;
const utf8 = (text: string): Uint8Array => new Uint8Array(Buffer.from(text, 'utf8'));
/** The one chunk a five-byte value occupies, as its record commits to it. */
const chunkOf = (text: string): Uint8Array => planChunkRun({
  layout: stateLayout, variable: 'name', spent: utf8(text), written: utf8(text),
}).spent.chunks[0]!;
const SPENT = 'hello';

/** The callee the writer calls: the relay re-enters the writer's `shout`, the quiet callee does not. */
type Callee = 'Relay' | 'Quiet';

/** Whether the writer's write is guarded (`maybeRename`) or made outright (`renameThen...`). */
type Write = 'guarded' | 'outright';

/** The writer's entry for the write and the callee. */
function writerEntry(write: Write, callee: Callee): string {
  if (write === 'outright') return callee === 'Relay' ? 'renameThenRelay' : 'renameThenQuiet';
  return callee === 'Relay' ? 'maybeRename' : 'maybeRenameQuietly';
}

/**
 * The writer's `entry(c)`, spending the run at `hello`. Its last segment begins the run at `lastIn`, the value the
 * re-entered `shout` leaves or the one the first segment kept, and ends it at `final`, which the transaction's chunk
 * output carries.
 */
function plan(entry: string, callee: Callee, c: bigint, lastIn: string, final: string): CompositionDraftPlan {
  const reentered = callee === 'Relay';
  const target = contracts[callee]!;
  const blocks = (state: readonly string[]): CompositionDraftPlan['blocks'] => [
    {
      contract: 'Namer', masters: reentered ? ['set-1', 'shout-1'] : ['set-1'],
      validator: { id: 'validator', settles: [] }, state,
    },
    { contract: callee, masters: ['take-1'], state: [] },
  ];
  // The header stays at its own index, so the run is placed one data width past it, as the body addresses it.
  const opened = layoutWithFacets(blocks(['name']));
  const stateIndex = participant(opened, 'name').index;
  const setIndex = participant(opened, 'set-1').index;
  const base = stateIndex + stateLayout.dataNftCount;
  const net = planChunkRun({ layout: stateLayout, variable: 'name', spent: utf8(SPENT), written: utf8(final) });
  const chunks = layOutChunkRun({
    plan: net, category: namer.category, base, writer: setIndex, valueSatoshis: 1_000n, removedLock: USER_LOCK,
  });
  const kept = chunks.records.filter((record) => record.role === 'kept');
  const finalBlocks = blocks(['name', ...kept.map((record) => record.id)]);
  const layout = layoutWithFacets(finalBlocks);
  // Every value here is five bytes long, so the header the run's length commits to never changes.
  const header = net.spent.header;
  const entries = (chunkIn: string, chunkOut: string): DraftRecordEntry[] => [
    { in: stateIndex, out: stateIndex, viewIn: header, viewOut: header },
    { in: base, out: base, viewIn: chunkOf(chunkIn), viewOut: chunkOf(chunkOut) },
  ];
  const takePushes = [selectorOf(artifacts, callee, 'take')];
  const shoutPushes = [selectorOf(artifacts, 'Namer', 'shout')];
  const headerLock = stateRecordLockingBytecode(bytesToHex(namer.category));
  const validator = validatorFor(namer.category);
  return {
    blocks: finalBlocks,
    userInputs: userInputs(['user'], layout.funderInputBase),
    masters: [
      master({
        master: 'set-1', contract: 'Namer', entry, program: namer.program,
        facts: {
          contract: 'Namer', functionName: entryName('Namer', entry), kind: FrameKind.ROOT, callerIsUser: true,
          originEqualsCaller: true, makesExternalCall: true, mastersOfContract: reentered ? 2 : 1,
        },
        frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: namer.address, value: 0n },
        enteredBy: 'user', origin: 'user',
        calls: [{ kind: FrameKind.CALL, callee: 'take-1', target: target.address, value: 0n, argumentPushes: takePushes }],
        segments: [entries(SPENT, SPENT), entries(lastIn, final)],
        argumentPushes: [selectorOf(artifacts, 'Namer', entry), encodeIntegerValue(c)], dispatches: true,
      }),
      master({
        master: 'take-1', contract: callee, entry: 'take', program: target.program,
        facts: {
          contract: callee, functionName: entryName(callee, 'take'), kind: FrameKind.CALL, callerIsUser: false,
          originEqualsCaller: false, makesExternalCall: reentered, mastersOfContract: 1,
        },
        frame: { kind: FrameKind.CALL, sender: namer.address, self: target.address, value: 0n },
        enteredBy: 'set-1', origin: 'user',
        calls: reentered
          ? [{ kind: FrameKind.CALL, callee: 'shout-1', target: namer.address, value: 0n, argumentPushes: shoutPushes }]
          : [],
        argumentPushes: takePushes,
      }),
      ...(reentered ? [
        master({
          master: 'shout-1', contract: 'Namer', entry: 'shout', program: namer.program,
          facts: {
            contract: 'Namer', functionName: entryName('Namer', 'shout'), kind: FrameKind.CALL, callerIsUser: false,
            originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 2,
          },
          frame: { kind: FrameKind.CALL, sender: target.address, self: namer.address, value: 0n },
          enteredBy: 'take-1', origin: 'user',
          segments: [entries(SPENT, 'HELLO')],
          argumentPushes: shoutPushes, dispatches: true,
        }),
      ] : []),
    ],
    inputs: {
      'set-1': { source: masterInput(namer) },
      'take-1': { source: masterInput(target) },
      ...(reentered ? { 'shout-1': { source: masterInput(namer) } } : {}),
      validator: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(namer.category, 'mutable') },
      },
      name: {
        source: { lockingBytecode: headerLock, valueSatoshis: 20_000n, token: token(namer.category, 'mutable', header) },
        output: { lockingBytecode: headerLock, valueSatoshis: 20_000n, token: token(namer.category, 'mutable', header) },
        unlockingBytecode: stateRecordUnlockingBytecode(bytesToHex(namer.category), setIndex, 1),
      },
      ...Object.fromEntries(kept.map((record) => [record.id, record.input!])),
      user: userInput(),
    },
    validator: {
      id: 'validator', covers: [callee],
      settles: reentered
        ? [{ category: namer.category, stateInputs: ['name', ...kept.map((record) => record.id)] }]
        : [],
      redeemScript: validator.redeem,
    },
  };
}

interface Outcome {
  readonly code?: string;
  readonly report: CompositionRefusal;
  /** Each participant's verdict on the composed transaction, by its plan id. */
  readonly verdicts: Readonly<Record<string, boolean>>;
  /** The commitment the transaction's chunk output carries. */
  readonly run: string;
}

/** Derives the composition from the writer, then asks every participant for its verdict on the transaction. */
function derive(callee: Callee, c: bigint, lastIn: string, final: string, write: Write = 'guarded'): Outcome {
  const compositionArtifacts = [artifacts.Namer!, artifacts[callee]!];
  const entry = writerEntry(write, callee);
  const { host, draft } = createComposedDerivationHost({
    vm: compositionMachine(), artifacts: compositionArtifacts, plan: plan(entry, callee, c, lastIn, final),
  });
  let code: string | undefined;
  try {
    deriveDepthFirst(rootOf('Namer', entry, 'set-1'), host);
  } catch (caught) {
    code = (caught as { code?: string }).code;
  }
  const program = draft.programFor('set-1');
  const machine = compositionMachine();
  const verdicts = Object.fromEntries(draft.layout.participants.map((placed) => [placed.id, machine.stateSuccess(
    machine.evaluate({ inputIndex: placed.index, sourceOutputs: program.sourceOutputs, transaction: program.transaction }),
  ) === true]));
  const runIndex = participant(draft.layout, 'name').index + stateLayout.dataNftCount;
  return {
    ...(code === undefined ? {} : { code }),
    report: reportCompositionRefusal({ draft, artifacts: compositionArtifacts, vm: compositionMachine() }),
    verdicts,
    run: binToHex(program.transaction.outputs[runIndex]!.token!.nft!.commitment),
  };
}

/** Expects the writer refused, every other participant accepting its own part of the transaction. */
function expectRefusedAtWriter(outcome: Outcome): void {
  expect(outcome.code).toBe('FRAMED_DERIVATION_STALLED');
  expect(outcome.report.accepted).toBe(false);
  expect(outcome.report.innermost!.master).toBe('set-1');
  expect(outcome.verdicts['set-1']).toBe(false);
  expect(Object.entries(outcome.verdicts).filter(([id, accepted]) => id !== 'set-1' && !accepted)).toStrictEqual([]);
}

/** Expects every participant to accept, the run settled at `final`. */
function expectSettled(outcome: Outcome, final: string): void {
  expect(outcome.code).toBeUndefined();
  expect(outcome.report.accepted).toBe(true);
  expect(Object.entries(outcome.verdicts).filter(([, accepted]) => !accepted)).toStrictEqual([]);
  expect(outcome.run).toBe(binToHex(chunkOf(final)));
}

describe('a dynamic value a frame writes, or skips writing, before a call', () => {
  it('is refused declared back at the value read before the call, where the frame skipped its write', () => {
    expectRefusedAtWriter(derive('Relay', 5n, 'HELLO', SPENT));
  });

  it('is refused pinning the value its arm wrote over the change the re-entered frame made', () => {
    expectRefusedAtWriter(derive('Relay', 11n, 'HELLO', 'taken'));
  });

  it('refuses the re-entered change carried on as well, which the skipping frame never read', () => {
    expectRefusedAtWriter(derive('Relay', 5n, 'HELLO', 'HELLO'));
  });

  it('settles the skipped write, the run held at the value the frame read, where nothing re-enters', () => {
    expectSettled(derive('Quiet', 5n, SPENT, SPENT), SPENT);
  });

  it('settles the taken write, the run pinned at the value its arm wrote, where nothing re-enters', () => {
    expectSettled(derive('Quiet', 11n, SPENT, 'taken'), 'taken');
  });

  it('is refused pinning a write no branch guards over the change the re-entered frame made', () => {
    expectRefusedAtWriter(derive('Relay', 1n, 'HELLO', 'taken', 'outright'));
  });

  it('settles a write no branch guards, the run pinned at the value written, where nothing re-enters', () => {
    expectSettled(derive('Quiet', 1n, SPENT, 'taken', 'outright'), 'taken');
  });
});
