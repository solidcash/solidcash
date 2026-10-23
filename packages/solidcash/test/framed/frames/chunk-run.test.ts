import { describe, expect, it } from 'vitest';
import { createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import {
  FrameKind,
  INDEX_NONE,
  bytesToHex,
  encodeInt,
  validatorAddress,
  type RecordEntry,
  type StateLayout,
} from '@solidcash/utils';
import { compileString } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import {
  deployMaster, stateRecordLockingBytecode, stateRecordUnlockingBytecode,
} from '../../../src/framed/deploy/index.js';
import {
  chunkRecordId,
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
 * A framed master whose state is a string, composed from a plan the chunk plan states.
 *
 * A `string` state variable is not held in the data NFT that declares it: the NFT carries the value's byte length
 * and the bytes live in chunk NFTs locked by the value's own collection covenant. The emitted body addresses that
 * run as a band beginning one layout width past the record block its frame declares, so the plan has to place it
 * there — which is what `layOutChunkRun` does with the index the layout gives the block's records.
 *
 * Everything below is shipped: the source through the compiler, the master through the deployment, the run through
 * the chunk plan, the transaction through the composer and the derivation, and the verdict through the BCH-2026
 * machine. The control moves the band one slot and the machine refuses, so the accept is the compiler's coordinate
 * rather than a coordinate the test chose.
 */

const CATEGORY = seededCategory('chunk run');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const ADDRESS = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
/** The data NFT's lock: the data-NFT covenant the contract's category derives. */
const STATE_LOCK = stateRecordLockingBytecode(bytesToHex(CATEGORY));

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Named {'
  + '   string public name;'
  + '   function append() { this.name = string.concat(this.name, "!"); }'
  + ' }';

const ENTRY = 'Named.append()';
const MASTER_ID = 'named-1';
const USER_ID = 'user';
const VALUE = 20_000n;
const CHUNK_VALUE = 1_000n;
const EMPTY = new Uint8Array(0);

const utf8 = (text: string): Uint8Array => new Uint8Array(Buffer.from(text, 'utf8'));
/** The value the transaction spends and the one the entry writes, both inside one chunk. */
const SPENT = utf8('hello');
const WRITTEN = utf8('hello!');

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmOutput = NonNullable<NonNullable<VmProgram['transaction']>['outputs'][number]>;

const machine = (): ReturnType<typeof createVirtualMachineBch2026> => compositionMachine();
const token = (
  category: Uint8Array, capability: 'minting' | 'mutable', commitment: Uint8Array = EMPTY,
): VmOutput['token'] => ({ category, amount: 0n, nft: { capability, commitment } });

/**
 * The plan of a composition that writes the value once.
 *
 * `filler` puts one more participant between the block's state NFT and the run, so the run sits one slot past the
 * coordinate the emitted body reads. That is the control which shows the accept below is the compiler's own
 * arithmetic rather than a coordinate the plan picked.
 */
function build(options: {
  readonly filler?: boolean;
  readonly source?: string;
  readonly spent?: Uint8Array;
  readonly written?: Uint8Array;
} = {}): {
    plan: CompositionDraftPlan;
    layout: StateLayout;
    source: string;
    chunkIds: readonly string[];
    base: number;
    stateIndex: number;
  } {
  const source = options.source ?? SOURCE;
  const spentBytes = options.spent ?? SPENT;
  const writtenBytes = options.written ?? WRITTEN;
  const artifact = compileString(source, { composition: 'framed' });
  const stateLayout = artifact.stateLayout!;
  const master = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);

  // The band begins one layout width past the block's records, so the state NFT has to sit where the block puts it
  // and the run follows the contract's whole data-NFT width. The layout of the block without the run gives both.
  const fillerId = 'filler';
  const opened = layoutTransaction([{
    contract: 'Named', masters: [MASTER_ID], state: options.filler === true ? ['name', fillerId] : ['name'],
  }]);
  const stateIndex = participant(opened, 'name').index;
  const masterIndex = participant(opened, MASTER_ID).index;
  const base = stateIndex + stateLayout.dataNftCount;

  const run = planChunkRun({ layout: stateLayout, variable: 'name', spent: spentBytes, written: writtenBytes });
  const chunks = layOutChunkRun({
    plan: run, category: CATEGORY, base, writer: participant(opened, MASTER_ID).index, valueSatoshis: CHUNK_VALUE,
    removedLock: USER_LOCK,
  });
  const kept = chunks.records.filter((record) => record.role === 'kept');
  const created = chunks.records.filter((record) => record.role === 'created');
  const removed = chunks.records.filter((record) => record.role === 'removed');
  const chunkIds = chunks.records.map((record) => record.id);

  const stateEntry: RecordEntry = {
    in: stateIndex, out: stateIndex, viewIn: run.spent.header, viewOut: run.written.header,
  };
  const masterEntry: DraftMaster = {
    master: MASTER_ID,
    contract: 'Named',
    functionName: ENTRY,
    program: master.script,
    facts: {
      contract: 'Named', functionName: 'append', kind: FrameKind.ROOT,
      callerIsUser: true, originEqualsCaller: true, makesExternalCall: false, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: ADDRESS, value: 0n },
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

  // Kept chunks are the run's participants, at the band the body reads; created chunks are trailing outputs and
  // removed chunks are funder inputs, both at the indices past them.
  const stateIds = [...(options.filler === true ? ['name', fillerId] : ['name']), ...kept.map((record) => record.id)];
  const funderInputBase = layoutTransaction([{ contract: 'Named', masters: [MASTER_ID], state: stateIds }])
    .funderInputBase;
  const chunkInputs = chunks.records.filter((record) => record.input !== undefined);
  const plan: CompositionDraftPlan = {
    blocks: [{ contract: 'Named', masters: [MASTER_ID], state: stateIds }],
    userInputs: [
      ...removed.map((record) => ({ id: record.id, index: record.index })),
      { id: USER_ID, index: funderInputBase + removed.length },
    ],
    masters: [masterEntry],
    inputs: {
      [MASTER_ID]: {
        source: { lockingBytecode: master.lockingBytecode, valueSatoshis: VALUE, token: token(CATEGORY, 'minting') },
      },
      name: {
        source: { lockingBytecode: STATE_LOCK, valueSatoshis: VALUE, token: token(CATEGORY, 'mutable', run.spent.header) },
        output: {
          lockingBytecode: STATE_LOCK, valueSatoshis: VALUE, token: token(CATEGORY, 'mutable', run.written.header),
        },
        // The header is a data NFT rewritten in place, so its spend carries the covenant's write path.
        unlockingBytecode: stateRecordUnlockingBytecode(bytesToHex(CATEGORY), masterIndex, 1),
      },
      ...Object.fromEntries(chunkInputs.map((record) => [record.id, record.input!])),
      ...(options.filler === true
        ? {
          [fillerId]: {
            source: { lockingBytecode: USER_LOCK, valueSatoshis: VALUE, token: token(CATEGORY, 'mutable') },
            unlockingBytecode: encodeDataPush(encodeInt(1n)),
          },
        }
        : {}),
      [USER_ID]: {
        source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
        unlockingBytecode: callerUnlockingBytecode(),
      },
    },
    ...(created.length === 0 ? {} : { trailingOutputs: created.map((record) => record.output!) }),
  };
  return { plan, layout: stateLayout, source, chunkIds, base, stateIndex };
}

const ROOT = { contract: 'Named', functionName: ENTRY, kind: FrameKind.ROOT, master: MASTER_ID };

const compose = (options: Parameters<typeof build>[0] = {}): {
  host: ReturnType<typeof createComposedDerivationHost>['host'];
  draft: ReturnType<typeof createComposedDerivationHost>['draft'];
  built: ReturnType<typeof build>;
} => {
  const built = build(options);
  const { host, draft } = createComposedDerivationHost({
    vm: compositionMachine(),
    artifacts: [compileString(built.source, { composition: 'framed' })],
    plan: built.plan,
  });
  return { host, draft, built };
};

/** The machine's verdict on the master's own input, with the outputs optionally rewritten. */
function verdictAt(
  draft: ReturnType<typeof createComposedDerivationHost>['draft'],
  mutate?: (outputs: readonly VmOutput[]) => VmOutput[],
): string {
  const program = draft.programFor(MASTER_ID);
  const vm = machine();
  const state = vm.evaluate({
    inputIndex: program.inputIndex,
    sourceOutputs: program.sourceOutputs,
    transaction: { ...program.transaction, outputs: mutate?.(program.transaction.outputs) ?? program.transaction.outputs },
  });
  return vm.stateSuccess(state) === true ? 'accepted' : `refused: ${String(state.error)}`;
}

/** The machine's verdict on the data NFT's own input, spent under the contract's covenant lock. */
function stateVerdictAt(draft: ReturnType<typeof createComposedDerivationHost>['draft']): string {
  const program = draft.programFor(MASTER_ID);
  const vm = machine();
  const state = vm.evaluate({
    inputIndex: participant(draft.layout, 'name').index,
    sourceOutputs: program.sourceOutputs,
    transaction: program.transaction,
  });
  return vm.stateSuccess(state) === true ? 'accepted' : `refused: ${String(state.error)}`;
}

describe('a state whose value lives in chunks', () => {
  it('derives the run the chunk plan states', () => {
    const { host, draft, built } = compose();
    const derived = deriveDepthFirst(ROOT, host);
    expect(derived.completed.map((frame) => frame.master)).toStrictEqual([MASTER_ID]);
    // The plan's band is where the layout puts it: the run follows the contract's data NFTs, one width past them.
    expect(built.base).toBe(built.stateIndex + built.layout.dataNftCount);
    expect(built.chunkIds.map((id) => participant(draft.layout, id).index)).toStrictEqual([built.base]);
    expect(built.chunkIds).toStrictEqual([chunkRecordId('name', built.base)]);
  });

  it('accepts the master that wrote it, with the run written where the plan stated it', () => {
    const { draft, built } = compose();
    expect(verdictAt(draft)).toBe('accepted');
    // The header data NFT is spent under the contract's covenant, whose script the machine evaluates.
    expect(stateVerdictAt(draft)).toBe('accepted');

    const program = draft.programFor(MASTER_ID);
    const chunk = program.transaction.outputs[built.base]!;
    const run = planChunkRun({ layout: built.layout, variable: 'name', spent: SPENT, written: WRITTEN });
    // The chunk output is the value's own collection covenant carrying the written commitment, and the input it
    // recreates carried the spent one.
    expect(chunk.token).toStrictEqual({ category: CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment: run.written.chunks[0] } });
    expect(program.sourceOutputs[built.base]?.token?.nft?.commitment).toStrictEqual(run.spent.chunks[0]);
    expect(chunk.lockingBytecode).toStrictEqual(program.sourceOutputs[built.base]?.lockingBytecode);
    // The segment declares the header and the run, which is what the body closes against.
    expect(draft.blockOf(MASTER_ID).segments.flat().map((entry) => `${entry.in}/${entry.out}`))
      .toStrictEqual([`${built.stateIndex}/${built.stateIndex}`, `${built.base}/${built.base}`]);
  });

  it('accepts a run that grows, writing a created chunk at the index past the kept ones', () => {
    // 120 bytes fill one chunk and 121 need two, so the write creates a second chunk: no input at its record, and
    // an output where the emitted body computes it.
    const spentBytes = new Uint8Array(120).fill(0x61);
    // The entry appends a byte, so the written value is the spent one plus `!`, which crosses into a second chunk.
    const writtenBytes = new Uint8Array([...spentBytes, 0x21]);
    const { host, draft, built } = compose({ spent: spentBytes, written: writtenBytes });
    expect(deriveDepthFirst(ROOT, host).completed.map((frame) => frame.master)).toStrictEqual([MASTER_ID]);
    expect(verdictAt(draft)).toBe('accepted');
    expect(stateVerdictAt(draft)).toBe('accepted');

    const run = planChunkRun({ layout: built.layout, variable: 'name', spent: spentBytes, written: writtenBytes });
    const program = draft.programFor(MASTER_ID);
    const keptIndex = participant(draft.layout, chunkRecordId('name', built.base)).index;
    const createdIndex = keptIndex + 1;
    expect(program.transaction.outputs[keptIndex]!.token?.nft?.commitment).toStrictEqual(run.written.chunks[0]);
    expect(program.transaction.outputs[createdIndex]!.token).toStrictEqual({
      category: CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment: run.written.chunks[1] },
    });
    expect(draft.blockOf(MASTER_ID).segments.flat().map((entry) => `${entry.in}/${entry.out}`))
      .toStrictEqual([`${built.stateIndex}/${built.stateIndex}`, `${built.base}/${built.base}`,
        `${INDEX_NONE}/${createdIndex}`]);
  });

  it('accepts a run that grows by more than one chunk in a single write', () => {
    // The entry appends a run of bytes, so one write crosses two chunk boundaries: 100 bytes are one chunk and the
    // 250-byte result is three, which creates the second and third chunks beside the kept first one.
    const tail = 'b'.repeat(150);
    const growSource = 'pragma solidcash ^0.14.0;'
      + ' contract Named {'
      + '   string public name;'
      + `   function append() { this.name = string.concat(this.name, "${tail}"); }`
      + ' }';
    const spentBytes = new Uint8Array(100).fill(0x61);
    const writtenBytes = utf8(`${'a'.repeat(100)}${tail}`);
    const { host, draft, built } = compose({ source: growSource, spent: spentBytes, written: writtenBytes });
    expect(deriveDepthFirst(ROOT, host).completed.map((frame) => frame.master)).toStrictEqual([MASTER_ID]);
    expect(verdictAt(draft)).toBe('accepted');
    expect(stateVerdictAt(draft)).toBe('accepted');

    const run = planChunkRun({ layout: built.layout, variable: 'name', spent: spentBytes, written: writtenBytes });
    expect(run.spent.chunks).toHaveLength(1);
    expect(run.written.chunks).toHaveLength(3);
    const program = draft.programFor(MASTER_ID);
    const keptIndex = participant(draft.layout, chunkRecordId('name', built.base)).index;
    expect(program.transaction.outputs[keptIndex]!.token?.nft?.commitment).toStrictEqual(run.written.chunks[0]);
    // The header data NFT carries the new value's length, from the shipped header encoder.
    expect(program.transaction.outputs[built.stateIndex]!.token?.nft?.commitment).toStrictEqual(run.written.header);
    // The two chunks past the kept one are created records, placed as trailing outputs at the indices the layout
    // gives them, each carrying the commitment the body computed.
    const created = run.written.chunks.slice(1);
    const createdIndices = draft.trailingOutputs.map((output) => output.index);
    expect(createdIndices).toHaveLength(created.length);
    createdIndices.forEach((index, offset) => {
      expect(program.transaction.outputs[index]!.token).toStrictEqual({
        category: CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment: created[offset] },
      });
    });
    expect(draft.blockOf(MASTER_ID).segments.flat().map((entry) => `${entry.in}/${entry.out}`)).toStrictEqual([
      `${built.stateIndex}/${built.stateIndex}`, `${built.base}/${built.base}`,
      ...createdIndices.map((index) => `${INDEX_NONE}/${index}`),
    ]);
  });

  it('accepts a run that shrinks, spending a chunk and writing no record back', () => {
    // 121 bytes need two chunks and a five-byte write needs one, so the second chunk is removed: spent with the
    // write's authorization and no record written at its index.
    const shrinkSource = 'pragma solidcash ^0.14.0;'
      + ' contract Named {'
      + '   string public name;'
      + '   function append() { this.name = "short"; }'
      + ' }';
    const spentBytes = new Uint8Array(121).fill(0x61);
    const writtenBytes = utf8('short');
    const { host, draft, built } = compose({ source: shrinkSource, spent: spentBytes, written: writtenBytes });
    expect(deriveDepthFirst(ROOT, host).completed.map((frame) => frame.master)).toStrictEqual([MASTER_ID]);
    expect(verdictAt(draft)).toBe('accepted');
    expect(stateVerdictAt(draft)).toBe('accepted');

    const run = planChunkRun({ layout: built.layout, variable: 'name', spent: spentBytes, written: writtenBytes });
    expect(run.spent.chunks).toHaveLength(2);
    expect(run.written.chunks).toHaveLength(1);
    const program = draft.programFor(MASTER_ID);
    const keptIndex = participant(draft.layout, chunkRecordId('name', built.base)).index;
    const removedIndex = keptIndex + 1;
    expect(program.transaction.outputs[keptIndex]!.token?.nft?.commitment).toStrictEqual(run.written.chunks[0]);
    expect(program.sourceOutputs[removedIndex]!.token?.nft?.commitment).toStrictEqual(run.spent.chunks[1]);
    // The removed chunk's index writes no record: the output there is the funder's, paid to a plain lock.
    expect(program.transaction.outputs[removedIndex]!.token).toBeUndefined();
    expect(program.transaction.outputs[removedIndex]!.lockingBytecode).not.toStrictEqual(
      program.sourceOutputs[removedIndex]!.lockingBytecode,
    );
    expect(draft.blockOf(MASTER_ID).segments.flat().map((entry) => `${entry.in}/${entry.out}`))
      .toStrictEqual([`${built.stateIndex}/${built.stateIndex}`, `${built.base}/${built.base}`,
        `${removedIndex}/${INDEX_NONE}`]);
  });

  it('refuses a run one participant further on than the coordinate the body reads', () => {
    // The band is the compiler's arithmetic, not the plan's: with one more participant between the state NFT and
    // the run, the body addresses that participant as the run and the write it made there is refused.
    const { draft } = compose({ filler: true });
    expect(verdictAt(draft)).toContain('refused');
  });

  it('refuses a chunk output whose commitment the body did not compute', () => {
    const { draft, built } = compose();
    const wrong = (outputs: readonly VmOutput[]): VmOutput[] => outputs.map((output, index) => (index === built.base
      ? { ...output, token: { category: CATEGORY, amount: 0n, nft: { capability: 'mutable' as const, commitment: new Uint8Array([7]) } } }
      : output));
    expect(verdictAt(draft, wrong)).toContain('refused');
  });

  it('refuses a filler in the band the plan claims to have written', () => {
    // The same transaction with the chunk output locked by something other than the collection covenant: the body
    // recomputes that address, so the writing is refused although the commitment matches.
    const { draft, built } = compose();
    const wrong = (outputs: readonly VmOutput[]): VmOutput[] => outputs.map((output, index) => (index === built.base
      ? { ...output, lockingBytecode: STATE_LOCK }
      : output));
    expect(verdictAt(draft, wrong)).toContain('refused');
  });
});
