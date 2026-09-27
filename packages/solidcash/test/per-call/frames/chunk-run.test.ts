import { describe, expect, it } from 'vitest';
import { createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import {
  FrameKind,
  encodeInt,
  validatorAddress,
  type RecordEntry,
  type StateLayout,
} from '@solidcash/utils';
import { compileString } from '../../../../solidc/src/compiler.js';
import { deployMaster } from '../../../src/per-call/deploy/index.js';
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
} from '../../../src/per-call/composer/index.js';
import { callerUnlockingBytecode } from '../../../../solidc/test/per-call/master/caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory,
} from '../../../../solidc/test/per-call/master/validator-input.js';

/**
 * A per-call master whose state is a string, composed from a plan the chunk plan states.
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
/** The data NFT's lock: the entry only requires the input and the output to agree, so any lock serves. */
const STATE_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x33));

const SOURCE = 'pragma solidcash ^0.13.0;'
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

const machine = (): ReturnType<typeof createVirtualMachineBch2026> => createVirtualMachineBch2026(false);
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
function build(options: { readonly filler?: boolean } = {}): {
  plan: CompositionDraftPlan;
  layout: StateLayout;
  chunkIds: readonly string[];
  base: number;
  stateIndex: number;
} {
  const artifact = compileString(SOURCE, { composition: 'per-call' });
  const stateLayout = artifact.stateLayout!;
  const master = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);

  // The band begins one layout width past the block's records, so the state NFT has to sit where the block puts it
  // and the run follows the contract's whole data-NFT width. The layout of the block without the run gives both.
  const fillerId = 'filler';
  const opened = layoutTransaction([{
    contract: 'Named', masters: [MASTER_ID], state: options.filler === true ? ['name', fillerId] : ['name'],
  }]);
  const stateIndex = participant(opened, 'name').index;
  const base = stateIndex + stateLayout.dataNftCount;

  const run = planChunkRun({ layout: stateLayout, variable: 'name', spent: SPENT, written: WRITTEN });
  const chunks = layOutChunkRun({
    plan: run, category: CATEGORY, base, writer: participant(opened, MASTER_ID).index, valueSatoshis: CHUNK_VALUE,
  });
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

  const stateIds = [...(options.filler === true ? ['name', fillerId] : ['name']), ...chunkIds];
  const plan: CompositionDraftPlan = {
    blocks: [{ contract: 'Named', masters: [MASTER_ID], state: stateIds }],
    userInputs: [{
      id: USER_ID,
      index: layoutTransaction([{ contract: 'Named', masters: [MASTER_ID], state: stateIds }]).funderInputBase,
    }],
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
        unlockingBytecode: encodeDataPush(encodeInt(1n)),
      },
      ...Object.fromEntries(chunks.records.map((record) => [record.id, record.input])),
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
  };
  return { plan, layout: stateLayout, chunkIds, base, stateIndex };
}

const ROOT = { contract: 'Named', functionName: ENTRY, kind: FrameKind.ROOT, master: MASTER_ID };

const compose = (options: Parameters<typeof build>[0] = {}): {
  host: ReturnType<typeof createComposedDerivationHost>['host'];
  draft: ReturnType<typeof createComposedDerivationHost>['draft'];
  built: ReturnType<typeof build>;
} => {
  const built = build(options);
  const { host, draft } = createComposedDerivationHost({
    artifacts: [compileString(SOURCE, { composition: 'per-call' })],
    plan: built.plan,
  });
  return { host, draft, built };
};

/** The machine's verdict on the master's own input, with the outputs optionally rewritten. */
function verdictAt(
  draft: ReturnType<typeof createComposedDerivationHost>['draft'],
  mutate?: (outputs: readonly VmOutput[]) => readonly VmOutput[],
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

  it('refuses a run one participant further on than the coordinate the body reads', () => {
    // The band is the compiler's arithmetic, not the plan's: with one more participant between the state NFT and
    // the run, the body addresses that participant as the run and the write it made there is refused.
    const { draft } = compose({ filler: true });
    expect(verdictAt(draft)).toContain('refused');
  });

  it('refuses a chunk output whose commitment the body did not compute', () => {
    const { draft, built } = compose();
    const wrong = (outputs: readonly VmOutput[]): readonly VmOutput[] => outputs.map((output, index) => (index === built.base
      ? { ...output, token: { category: CATEGORY, amount: 0n, nft: { capability: 'mutable' as const, commitment: new Uint8Array([7]) } } }
      : output));
    expect(verdictAt(draft, wrong)).toContain('refused');
  });

  it('refuses a filler in the band the plan claims to have written', () => {
    // The same transaction with the chunk output locked by something other than the collection covenant: the body
    // recomputes that address, so the writing is refused although the commitment matches.
    const { draft, built } = compose();
    const wrong = (outputs: readonly VmOutput[]): readonly VmOutput[] => outputs.map((output, index) => (index === built.base
      ? { ...output, lockingBytecode: STATE_LOCK }
      : output));
    expect(verdictAt(draft, wrong)).toContain('refused');
  });
});
