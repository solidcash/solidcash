import { describe, expect, it } from 'vitest';
import { createVirtualMachineBch2026, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import {
  FrameKind,
  INDEX_NONE,
  bytesToHex,
  encodePushdataValue,
  packFixedWidthArray,
  validatorAddress,
  type RecordEntry,
} from '@solidcash/utils';
import { compileString } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import {
  deployMaster, stateRecordLockingBytecode, stateRecordUnlockingBytecode,
} from '../../../src/framed/deploy/index.js';
import {
  createComposedDerivationHost,
  deriveDepthFirst,
  layOutChunkRun,
  layoutTransaction,
  participant,
  planChunkRun,
  type CompositionDraftPlan,
  type DraftMaster,
} from '../../../src/framed/composer/index.js';
import { callerUnlockingBytecode } from '../../../../solidc/test/framed/master/caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory,
} from '../../../../solidc/test/framed/master/validator-input.js';

/**
 * `bytes` and dynamic-array state runs, composed from a plan the chunk plan states.
 *
 * `frames/chunk-run.test.ts` drives a `string`. The same planner lays out a `bytes` value and a chunk-packed array:
 * `planChunkRun` takes the value's encoded bytes, which for an array is its element stream (packed at a fixed
 * element's width, framed behind a count push for an `address`), and derives the header and every chunk through the
 * shipped encoders; `layOutChunkRun` keeps, creates and removes chunks one layout width past the frame's data NFT.
 * Each plan below derives, and the machine accepts the master that wrote the value; the control rewrites one chunk
 * output to a commitment the body did not compute.
 */

const USER_LOCK = encodeLockingBytecodeP2pkh(Uint8Array.from({ length: 20 }, (_, at) => 0x51 + at));
const MASTER_ID = 'kinds-1';
const USER_ID = 'user';
const VALUE = 20_000n;
const CHUNK_VALUE = 1_000n;
const EMPTY = new Uint8Array(0);

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmOutput = NonNullable<NonNullable<VmProgram['transaction']>['outputs'][number]>;

const distinct = (length: number, seed: number): Uint8Array =>
  Uint8Array.from({ length }, (_, at) => (seed + at * 5) & 0xff);
const token = (
  category: Uint8Array, capability: 'minting' | 'mutable', commitment: Uint8Array = EMPTY,
): VmOutput['token'] => ({ category, amount: 0n, nft: { capability, commitment } });

interface Shape {
  readonly label: string;
  readonly source: string;
  readonly contract: string;
  readonly entry: string;
  readonly variable: string;
  /** The value's encoding before and after the entry. */
  readonly spent: Uint8Array;
  readonly written: Uint8Array;
}

/** Plans one write of `shape`, lays the transaction out, and derives it. */
function compose(shape: Shape): {
  readonly draft: ReturnType<typeof createComposedDerivationHost>['draft'];
  readonly completed: readonly string[];
  readonly roles: readonly string[];
  readonly base: number;
} {
  const category = seededCategory(`chunk run kinds ${shape.label}`);
  const artifact = compileString(shape.source, { composition: 'framed' });
  const layout = artifact.stateLayout!;
  const master = deployMaster(artifact, category, REAL_VALIDATOR_PROGRAM);
  const stateLock = stateRecordLockingBytecode(bytesToHex(category));

  const opened = layoutTransaction([{ contract: shape.contract, masters: [MASTER_ID], state: [shape.variable] }]);
  const stateIndex = participant(opened, shape.variable).index;
  const masterIndex = participant(opened, MASTER_ID).index;
  const base = stateIndex + layout.dataNftCount;

  const run = planChunkRun({ layout, variable: shape.variable, spent: shape.spent, written: shape.written });
  const chunks = layOutChunkRun({
    plan: run, category, base, writer: masterIndex, valueSatoshis: CHUNK_VALUE, removedLock: USER_LOCK,
  });
  const kept = chunks.records.filter((record) => record.role === 'kept');
  const created = chunks.records.filter((record) => record.role === 'created');
  const removed = chunks.records.filter((record) => record.role === 'removed');

  const stateEntry: RecordEntry = {
    in: stateIndex, out: stateIndex, viewIn: run.spent.header, viewOut: run.written.header,
  };
  const masterEntry: DraftMaster = {
    master: MASTER_ID,
    contract: shape.contract,
    functionName: `${shape.contract}.${shape.entry}()`,
    program: master.script,
    facts: {
      contract: shape.contract, functionName: shape.entry, kind: FrameKind.ROOT,
      callerIsUser: true, originEqualsCaller: true, makesExternalCall: false, mastersOfContract: 1,
    },
    frame: {
      kind: FrameKind.ROOT, sender: USER_LOCK, self: validatorAddress(category, REAL_VALIDATOR_PROGRAM), value: 0n,
    },
    enteredBy: USER_ID,
    origin: USER_ID,
    calls: [],
    retval: EMPTY,
    segments: [[stateEntry, ...chunks.entries]],
    events: [],
    sends: [],
    argumentPushes: [],
    redeemScript: master.script,
  };

  const stateIds = [shape.variable, ...kept.map((record) => record.id)];
  const funderInputBase = layoutTransaction([{ contract: shape.contract, masters: [MASTER_ID], state: stateIds }])
    .funderInputBase;
  const plan: CompositionDraftPlan = {
    blocks: [{ contract: shape.contract, masters: [MASTER_ID], state: stateIds }],
    userInputs: [
      ...removed.map((record) => ({ id: record.id, index: record.index })),
      { id: USER_ID, index: funderInputBase + removed.length },
    ],
    masters: [masterEntry],
    inputs: {
      [MASTER_ID]: {
        source: { lockingBytecode: master.lockingBytecode, valueSatoshis: VALUE, token: token(category, 'minting') },
      },
      [shape.variable]: {
        source: { lockingBytecode: stateLock, valueSatoshis: VALUE, token: token(category, 'mutable', run.spent.header) },
        output: { lockingBytecode: stateLock, valueSatoshis: VALUE, token: token(category, 'mutable', run.written.header) },
        unlockingBytecode: stateRecordUnlockingBytecode(bytesToHex(category), masterIndex, 1),
      },
      ...Object.fromEntries(chunks.records.filter((record) => record.input !== undefined)
        .map((record) => [record.id, record.input!])),
      [USER_ID]: {
        source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
        unlockingBytecode: callerUnlockingBytecode(),
      },
    },
    ...(created.length === 0 ? {} : { trailingOutputs: created.map((record) => record.output!) }),
  };

  const { host, draft } = createComposedDerivationHost({ vm: compositionMachine(), artifacts: [artifact], plan });
  const derived = deriveDepthFirst(
    { contract: shape.contract, functionName: masterEntry.functionName, kind: FrameKind.ROOT, master: MASTER_ID },
    host,
  );
  return {
    draft,
    completed: derived.completed.map((frame) => frame.master),
    roles: chunks.records.map((record) => record.role),
    base,
  };
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

const pragma = 'pragma solidcash ^0.14.0;';
const uints = (values: readonly bigint[]): Uint8Array => packFixedWidthArray([...values], 'uint256');
const locks = (seeds: readonly number[]): Uint8Array[] =>
  seeds.map((seed) => encodeLockingBytecodeP2pkh(distinct(20, seed)));

const BYTES_FULL = distinct(120, 0x21);
const BYTES_LONG = distinct(150, 0x23);
const BYTES_SHORT = distinct(9, 0x25);

const SHAPES: readonly (Shape & { readonly roles: readonly string[] })[] = [
  {
    label: 'bytes append',
    source: `${pragma} contract Blob { bytes public data;`
      + ' function append() { this.data = bytes.concat(this.data, 0x21); } }',
    contract: 'Blob',
    entry: 'append',
    variable: 'data',
    spent: BYTES_FULL,
    written: new Uint8Array([...BYTES_FULL, 0x21]),
    roles: ['kept', 'created'],
  },
  {
    label: 'bytes overwrite',
    source: `${pragma} contract Blob { bytes public data; function reset() { this.data = 0x${bytesToHex(BYTES_SHORT)}; } }`,
    contract: 'Blob',
    entry: 'reset',
    variable: 'data',
    spent: BYTES_LONG,
    written: BYTES_SHORT,
    roles: ['kept', 'removed'],
  },
  {
    label: 'uint push',
    source: `${pragma} contract Ledger { uint[] public items; function add() { this.items.push(44); } }`,
    contract: 'Ledger',
    entry: 'add',
    variable: 'items',
    spent: uints([1n, 2n, 3n]),
    written: uints([1n, 2n, 3n, 44n]),
    roles: ['kept', 'created'],
  },
  {
    label: 'uint pop',
    source: `${pragma} contract Ledger { uint[] public items; function drop() { this.items.pop(); } }`,
    contract: 'Ledger',
    entry: 'drop',
    variable: 'items',
    spent: uints([1n, 2n, 3n, 4n]),
    written: uints([1n, 2n, 3n]),
    roles: ['kept', 'removed'],
  },
  {
    label: 'address push',
    source: `${pragma} contract Ledger { address[] public items; function join() { this.items.push(msg.sender); } }`,
    contract: 'Ledger',
    entry: 'join',
    variable: 'items',
    spent: encodePushdataValue(locks([0x31, 0x41]), 'address[]'),
    written: encodePushdataValue([...locks([0x31, 0x41]), USER_LOCK], 'address[]'),
    roles: ['kept'],
  },
];

describe.each(SHAPES)('a $label run laid out by the chunk plan', (shape) => {
  it('derives and is accepted with the run the plan states', () => {
    const { draft, completed, roles } = compose(shape);
    expect(completed).toStrictEqual([MASTER_ID]);
    expect(roles).toStrictEqual(shape.roles);
    expect(verdict(draft)).toBe('accepted');
    // The segment declares the header, then every chunk in the run's order: kept and removed chunks name their
    // input, created chunks name none.
    const declared = draft.blockOf(MASTER_ID).segments.flat();
    expect(declared.slice(1).map((entry) => (entry.in === INDEX_NONE ? 'created' : entry.out === INDEX_NONE
      ? 'removed' : 'kept'))).toStrictEqual(shape.roles);
  });

  it('is refused when a chunk output carries a commitment the body did not compute', () => {
    const { draft, base } = compose(shape);
    const forged = (outputs: readonly VmOutput[]): readonly VmOutput[] => outputs.map((output, index) => (index === base
      ? { ...output, token: { ...output.token!, nft: { capability: 'mutable' as const, commitment: distinct(7, 0x77) } } }
      : output));
    expect(verdict(draft, forged)).toContain('refused');
  });
});
