import { describe, expect, it } from 'vitest';
import { createVirtualMachineBch2026, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import {
  FrameKind,
  INDEX_NONE,
  buildPushdataCommitment,
  bytesToHex,
  validatorAddress,
  type RecordEntry,
} from '@solidcash/utils';
import { compileString } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import {
  chunkRecordLockingBytecode, deployMaster, stateRecordLockingBytecode, stateRecordUnlockingBytecode,
} from '../../../src/framed/deploy/index.js';
import {
  createComposedDerivationHost,
  deriveDepthFirst,
  layOutChunkRun,
  layoutTransaction,
  participant,
  planChunkRun,
  type ChunkRecordPlacement,
  type CompositionDraftPlan,
  type DraftMaster,
} from '../../../src/framed/composer/index.js';
import { hopEntryWrites } from '../../../src/framed/proxy/entry-writes.js';
import { callerUnlockingBytecode } from '../../../../solidc/test/framed/master/caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory,
} from '../../../../solidc/test/framed/master/validator-input.js';

/**
 * Two dynamic values written by one entry, composed from the runs the chunk plan states.
 *
 * `layOutChunkRun` lays each value's run out on its own. The segment declares the runs in the order the values are
 * declared, each one record per chunk of the wider of its two versions, so the composition places every kept chunk
 * as a participant, every created chunk as a trailing output and every removed chunk as a participant spent with a
 * plain output at its index, and declares each record at the index the transaction carries it. The master accepts
 * the composition when the first value grows or shrinks beside the second; the controls declare the later run where
 * the first value's old or new count alone ends, and forge a chunk output.
 *
 * The hop that plans a call's writes lays the two runs the same way, in the order the artifact publishes for them
 * (`dynamicWriteOrder`).
 */

const USER_LOCK = encodeLockingBytecodeP2pkh(Uint8Array.from({ length: 20 }, (_, at) => 0x5b + at * 3));
const MASTER_ID = 'pair-1';
const USER_ID = 'user';
const STATE_ID = 'pair-state';
const VALUE = 20_000n;
const CHUNK_VALUE = 1_000n;
const EMPTY = new Uint8Array(0);

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmOutput = NonNullable<NonNullable<VmProgram['transaction']>['outputs'][number]>;

const distinct = (length: number, seed: number): Uint8Array =>
  Uint8Array.from({ length }, (_, at) => (seed + at * 11) & 0xff);
const token = (
  category: Uint8Array, capability: 'minting' | 'mutable', commitment: Uint8Array = EMPTY,
): VmOutput['token'] => ({ category, amount: 0n, nft: { capability, commitment } });

/** One entry's two writes: the values the deployment holds and the literals the body writes. */
interface Shape {
  readonly label: string;
  readonly first: readonly [Uint8Array, Uint8Array];
  readonly second: readonly [Uint8Array, Uint8Array];
}

const source = (shape: Shape): string => 'pragma solidcash ^0.14.0;'
  + ' contract Pair { bytes public first; bytes public second;'
  + ` function set() { this.first = 0x${bytesToHex(shape.first[1])}; this.second = 0x${bytesToHex(shape.second[1])}; }`
  + ' }';

/** How the later run is declared: past every record of the first, or where one of the first's counts alone ends. */
type Placement = 'wider' | 'spent' | 'written';

/** Plans both writes of `shape` and lays the transaction out, declaring the later run as `placement` says. */
function draftOf(shape: Shape, placement: Placement): {
  readonly host: ReturnType<typeof createComposedDerivationHost>['host'];
  readonly draft: ReturnType<typeof createComposedDerivationHost>['draft'];
  readonly firstOutput: number;
} {
  const category = seededCategory(`dynamic values together ${shape.label}`);
  const artifact = compileString(source(shape), { composition: 'framed' });
  const layout = artifact.stateLayout!;
  const master = deployMaster(artifact, category, REAL_VALIDATOR_PROGRAM);
  const stateLock = stateRecordLockingBytecode(bytesToHex(category));
  const masterIndex = participant(
    layoutTransaction([{ contract: 'Pair', masters: [MASTER_ID], state: [STATE_ID] }]), MASTER_ID,
  ).index;

  // Each run is laid out on its own; the indices below replace the band the planner assumes.
  const laid = (['first', 'second'] as const).map((variable) => {
    const [spent, written] = shape[variable];
    const plan = planChunkRun({ layout, variable, spent, written });
    return layOutChunkRun({
      plan, category, base: 0, writer: masterIndex, valueSatoshis: CHUNK_VALUE, removedLock: USER_LOCK,
    }).records;
  });
  const all = laid.flat();
  const kept = all.filter((record) => record.role === 'kept');
  const created = all.filter((record) => record.role === 'created');
  const removed = all.filter((record) => record.role === 'removed');

  // A kept chunk is a participant and a created one a trailing output. A removed one is a participant too, whose own
  // index carries the plain output its satoshis are paid to: the run census leaves no record where a dropped chunk
  // was spent, which a created output placed there would be.
  const spentIds = [...kept, ...removed].map((record) => record.id);
  const opened = layoutTransaction([
    { contract: 'Pair', masters: [MASTER_ID], state: [STATE_ID, ...spentIds] },
  ]);
  const stateIndex = participant(opened, STATE_ID).index;
  const indexOf = (record: ChunkRecordPlacement): RecordEntry => {
    const at = record.role === 'created' ? undefined : participant(opened, record.id).index;
    return {
      in: at ?? INDEX_NONE,
      out: record.role === 'kept' ? at! : record.role === 'created'
        ? opened.participantCount + created.indexOf(record) : INDEX_NONE,
      viewIn: record.viewIn,
      viewOut: record.viewOut,
    };
  };
  const [firstRun, secondRun] = laid.map((records) => records.map(indexOf));
  const cut = placement === 'wider' ? firstRun!.length
    : placement === 'spent' ? firstRun!.filter((entry) => entry.in !== INDEX_NONE).length
      : firstRun!.filter((entry) => entry.out !== INDEX_NONE).length;
  const runs = [...firstRun!.slice(0, cut), ...secondRun!, ...firstRun!.slice(cut)];

  const header = (side: 0 | 1): Uint8Array => hexToBin(buildPushdataCommitment(layout, {
    first$len: BigInt(shape.first[side].length), second$len: BigInt(shape.second[side].length),
  }, 0));
  const stateEntry: RecordEntry = { in: stateIndex, out: stateIndex, viewIn: header(0), viewOut: header(1) };
  const masterEntry: DraftMaster = {
    master: MASTER_ID,
    contract: 'Pair',
    functionName: 'Pair.set()',
    program: master.script,
    facts: {
      contract: 'Pair', functionName: 'set', kind: FrameKind.ROOT,
      callerIsUser: true, originEqualsCaller: true, makesExternalCall: false, mastersOfContract: 1,
    },
    frame: {
      kind: FrameKind.ROOT, sender: USER_LOCK, self: validatorAddress(category, REAL_VALIDATOR_PROGRAM), value: 0n,
    },
    enteredBy: USER_ID,
    origin: USER_ID,
    calls: [],
    retval: EMPTY,
    segments: [[stateEntry, ...runs]],
    events: [],
    sends: [],
    argumentPushes: [],
    redeemScript: master.script,
  };

  const plan: CompositionDraftPlan = {
    blocks: [{ contract: 'Pair', masters: [MASTER_ID], state: [STATE_ID, ...spentIds] }],
    userInputs: [{ id: USER_ID, index: opened.funderInputBase }],
    masters: [masterEntry],
    inputs: {
      [MASTER_ID]: {
        source: { lockingBytecode: master.lockingBytecode, valueSatoshis: VALUE, token: token(category, 'minting') },
      },
      [STATE_ID]: {
        source: { lockingBytecode: stateLock, valueSatoshis: VALUE, token: token(category, 'mutable', header(0)) },
        output: { lockingBytecode: stateLock, valueSatoshis: VALUE, token: token(category, 'mutable', header(1)) },
        unlockingBytecode: stateRecordUnlockingBytecode(bytesToHex(category), masterIndex, 1),
      },
      ...Object.fromEntries(all.filter((record) => record.input !== undefined)
        .map((record) => [record.id, record.input!])),
      [USER_ID]: {
        source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
        unlockingBytecode: callerUnlockingBytecode(),
      },
    },
    ...(created.length === 0 ? {} : { trailingOutputs: created.map((record) => record.output!) }),
  };

  const { host, draft } = createComposedDerivationHost({ vm: compositionMachine(), artifacts: [artifact], plan });
  return { host, draft, firstOutput: runs.find((entry) => entry.out !== INDEX_NONE)?.out ?? -1 };
}

/** Plans both writes of `shape` with the later run past every record of the first, and derives the composition. */
function compose(shape: Shape): {
  readonly draft: ReturnType<typeof createComposedDerivationHost>['draft'];
  readonly completed: readonly string[];
  readonly firstOutput: number;
} {
  const { host, draft, firstOutput } = draftOf(shape, 'wider');
  const derived = deriveDepthFirst(
    { contract: 'Pair', functionName: 'Pair.set()', kind: FrameKind.ROOT, master: MASTER_ID },
    host,
  );
  return { draft, completed: derived.completed.map((frame) => frame.master), firstOutput };
}

/** The machine's verdict on the master's own input, with the outputs optionally rewritten. */
function verdict(
  draft: ReturnType<typeof createComposedDerivationHost>['draft'],
  mutate?: (outputs: readonly VmOutput[]) => readonly VmOutput[],
): string {
  const program = draft.programFor(MASTER_ID);
  const vm = compositionMachine();
  const state = vm.evaluate({
    inputIndex: program.inputIndex,
    sourceOutputs: program.sourceOutputs,
    transaction: {
      ...program.transaction,
      outputs: [...(mutate?.(program.transaction.outputs) ?? program.transaction.outputs)],
    },
  });
  return vm.stateSuccess(state) === true ? 'accepted' : `refused: ${String(state.error)}`;
}

/** The machine's verdict on the master of a composition whose views the plan states in full, without deriving. */
function settles(shape: Shape, placement: Placement): string {
  return verdict(draftOf(shape, placement).draft);
}

const SHORT = distinct(6, 0x21);
const OTHER_SHORT = distinct(9, 0x33);
/** 150 bytes need two chunks. */
const LONG = distinct(150, 0x45);
const OTHER_LONG = distinct(130, 0x57);

const SHAPES: readonly Shape[] = [
  { label: 'the first value grown', first: [SHORT, LONG], second: [OTHER_SHORT, SHORT] },
  { label: 'the first value shrunk', first: [LONG, SHORT], second: [OTHER_SHORT, SHORT] },
  { label: 'the first shrunk and the second grown', first: [LONG, SHORT], second: [OTHER_SHORT, OTHER_LONG] },
  { label: 'the first value emptied', first: [SHORT, EMPTY], second: [OTHER_LONG, OTHER_SHORT] },
];

describe.each(SHAPES)('two dynamic runs laid out by the chunk plan: $label', (shape) => {
  it('derives and is accepted with the later run past every record of the first', () => {
    const { draft, completed } = compose(shape);
    expect(completed).toStrictEqual([MASTER_ID]);
    expect(verdict(draft)).toBe('accepted');
  });

  it('is refused when a chunk output carries a commitment the body did not compute', () => {
    const { draft, firstOutput } = compose(shape);
    const forged = (outputs: readonly VmOutput[]): readonly VmOutput[] => outputs.map((output, index) => (
      index === firstOutput
        ? { ...output, token: { ...output.token!, nft: { capability: 'mutable' as const, commitment: distinct(7, 0x69) } } }
        : output));
    expect(verdict(draft, forged)).toContain('refused');
  });
});

describe('two dynamic runs whose later run is declared at one of the first value\'s own counts', () => {
  it('is accepted as planned, before any derivation, with the later run past every record of the first', () => {
    expect(settles(SHAPES[0]!, 'wider')).toBe('accepted');
    expect(settles(SHAPES[1]!, 'wider')).toBe('accepted');
  });

  it('is refused after a growth when the later run follows the first value\'s spent chunks alone', () => {
    expect(settles(SHAPES[0]!, 'spent')).toContain('refused');
  });

  it('is refused after a shrink when the later run follows the first value\'s written chunks alone', () => {
    expect(settles(SHAPES[1]!, 'written')).toContain('refused');
  });
});

describe('the hop that plans a call\'s writes', () => {
  it('lays an entry that writes two dynamic values as one run per value, in the order the artifact publishes', () => {
    const shape = SHAPES[0]!;
    const artifact = compileString(source(shape), { composition: 'framed' });
    expect(artifact.abi.find((fn) => fn.name === 'set')?.dynamicWriteOrder).toStrictEqual(['first', 'second']);
    // The record the body writes states each value's length, which sizes its run: two chunks, then one.
    const written = hexToBin(buildPushdataCommitment(artifact.stateLayout!, {
      first$len: BigInt(shape.first[1].length), second$len: BigInt(shape.second[1].length),
    }, 0));
    const writes = hopEntryWrites({
      artifact, functionName: 'set', callerLockingBytecode: USER_LOCK, writtenCommitments: [written],
    })!;
    const category = seededCategory('dynamic values together hop');
    const laid = writes.lay({
      indexOf: (id) => { throw new Error(`no participant ${id}`); },
      proxyMasterIndex: 1, createdBase: 10, recordAmount: CHUNK_VALUE, category, learnedViews: [],
    });
    // A deployment's own first hop starts from the empty values, so every chunk is created, the first value's ahead.
    expect(laid.entries.map((entry) => [entry.in, entry.out]))
      .toStrictEqual([[INDEX_NONE, 10], [INDEX_NONE, 11], [INDEX_NONE, 12]]);
    const lock = (variable: string): string =>
      bytesToHex(chunkRecordLockingBytecode(bytesToHex(category), variable, 'bytes'));
    expect(laid.trailingOutputs.map((output) => bytesToHex(output.lockingBytecode)))
      .toStrictEqual([lock('first'), lock('first'), lock('second')]);
  });
});
