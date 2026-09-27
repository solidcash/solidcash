import { describe, expect, it } from 'vitest';
import { encodeDataPush } from '@bitauth/libauth';
import {
  FrameKind,
  INDEX_NONE,
  buildChunkCommitment,
  buildPushdataCommitment,
  encodeIntegerValue,
  packFixedWidthElement,
  splitValueIntoChunks,
  type RecordEntry,
  type StateLayout,
} from '@solidcash/utils';
import { seededCategory } from '../../../../solidc/test/per-call/master/validator-input.js';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import {
  EMPTY, USER_LOCK, compileAndDeploy, entryName, hexOf, master, masterInput, rootOf, seededAddress, selectorOf,
  token, userInput, validatorFor,
} from '../shapes/harness.js';
import {
  assertCompositionSettlement, createComposedDerivationHost, deriveDepthFirst, layOutChunkRun, layoutTransaction,
  participant, planChunkRun, type CompositionDraftPlan, type DraftMaster,
} from '../../../src/per-call/composer/index.js';

/**
 * One entry appending to one log three times.
 *
 * `Hub.go` calls `Log.append(id, item)` three times as three unrolled statements with distinct arguments; `append`
 * pushes onto the log's dynamic array `items` and emits an event. The compiler gives each call its own call site,
 * so the composition carries three call records and the callee runs on one master per call.
 *
 * The log's `items` is a chunk-packed array: its bytes live in a run of chunk UTXOs locked by the value's own
 * collection covenant, and the emitted body reads that run from the transaction's co-spent chunk inputs and closes
 * each frame's segment against the transaction's chunk outputs. A write that changes the run's width creates or
 * removes chunks, and the composer lays those records out: a chunk only the later stage holds is created as a
 * trailing output, and one only the earlier stage holds is spent as a funder input. What the run still does not
 * carry is a value from one frame to the next: the transaction's chunk output at the run's index holds the final
 * element stream, and a frame's close compares its own computed value against it, so only a frame whose value is
 * the final one closes. The file pins that limit, and the derivation probe compiles a log without the event and
 * states the appends against it. The three-call shape and the dynamic array are the toy's.
 */

const HUB_LABEL = 'same entry appends hub';
const LOG_LABEL = 'same entry appends log';
const LOG_ADDRESS = seededAddress(LOG_LABEL);
const HUB_CATEGORY = seededCategory(HUB_LABEL);
const LOG_CATEGORY = seededCategory(LOG_LABEL);
const VALIDATOR_ID = 'validator';
const HEADER_ID = 'header';
const USER_ID = 'user';

/** The three unrolled calls the toy's `Hub.go` makes. */
const APPENDS: readonly { readonly id: bigint; readonly item: bigint }[] = [
  { id: 1n, item: 10n },
  { id: 2n, item: 20n },
  { id: 3n, item: 30n },
];

/** The toy's source with `appends` as the Hub's unrolled calls. */
function toySource(appends: readonly { readonly id: bigint; readonly item: bigint }[]): string {
  return 'pragma solidcash ^0.13.0;'
    + ' interface ILog { function append(int id, int item); }'
    + ' contract Log {'
    + '   int[] items;'
    + '   event Appended(int indexed id, int item);'
    + '   function append(int id, int item) { this.items.push(item); emit Appended(id, item); require(true); }'
    + ' }'
    + ' contract Hub {'
    + '   function go() {'
    + appends.map((append) => `     ILog(0x${hexOf(LOG_ADDRESS)}).append(${append.id}, ${append.item});`).join('\n')
    + '     require(true);'
    + '   }'
    + ' }';
}

/** The same shape without the emit, so the run's own limit is what a probe meets. */
function runSource(items: readonly bigint[]): string {
  return 'pragma solidcash ^0.13.0;'
    + ' interface ILog { function append(int item); }'
    + ' contract Log {'
    + '   int[] items;'
    + '   function append(int item) { this.items.push(item); require(true); }'
    + ' }'
    + ' contract Hub {'
    + '   function go() {'
    + items.map((item) => `     ILog(0x${hexOf(LOG_ADDRESS)}).append(${item});`).join('\n')
    + '     require(true);'
    + '   }'
    + ' }';
}

/** The exact error a shipped call raised, or a failure when it returned normally. */
function refusalOf(run: () => unknown): { readonly name?: string; readonly code?: string; readonly message: string } {
  try {
    run();
  } catch (error) {
    const refusal = error as { name?: string; code?: string; message: string };
    return { name: refusal.name, code: refusal.code, message: refusal.message };
  }
  throw new Error('the shipped per-call path accepted the shape, so there is no refusal to record');
}

const ELEMENT_WIDTH = packFixedWidthElement(1n, 'int256').length;

/** The element stream a chunk-packed `int[]` holds: each element packed at the type's fixed width. */
function itemsBytes(values: readonly bigint[]): Uint8Array {
  const bytes = new Uint8Array(values.length * ELEMENT_WIDTH);
  values.forEach((value, index) => bytes.set(packFixedWidthElement(value, 'int256'), index * ELEMENT_WIDTH));
  return bytes;
}

/** The data NFT's header commitment for a value of this element stream, from the shipped encoder. */
function headerOf(layout: StateLayout, bytes: Uint8Array): Uint8Array {
  return new Uint8Array(Buffer.from(buildPushdataCommitment(layout, { items: bytes }, 0), 'hex'));
}

/** One chunk commitment of a run holding this element stream, from the shipped encoder. */
function chunkOf(index: number, bytes: Uint8Array): Uint8Array {
  return new Uint8Array(Buffer.from(buildChunkCommitment(index, bytes), 'hex'));
}

/**
 * Compiles the run source, deploys both contracts, and plans `appends` against an initial element stream.
 *
 * The log's element stream is read at every frame boundary, and each frame declares the run's whole view for its
 * own append: the header's length and one entry per chunk the two stages hold. The run's records follow the band the
 * emitted body reads: chunks both the initial and the final stage hold are kept as the contract's state UTXOs,
 * chunks only the final stage holds are created as trailing outputs, and chunks only the initial stage holds are
 * spent as funder inputs. The plan places the caller, the validator, one callee master per append, then the log's
 * records, then the funder inputs.
 */
function build(initial: readonly bigint[], appends: readonly bigint[]): {
  readonly plan: CompositionDraftPlan;
  readonly artifacts: ReturnType<typeof compileAndDeploy>['artifacts'];
  readonly contracts: ReturnType<typeof compileAndDeploy>['contracts'];
  readonly chunkIds: readonly string[];
} {
  const { artifacts, contracts } = compileAndDeploy(runSource(appends), { Hub: HUB_LABEL, Log: LOG_LABEL });
  const hub = contracts.Hub!;
  const log = contracts.Log!;
  const layout = artifacts.Log!.stateLayout!;
  const validator = validatorFor(HUB_CATEGORY);

  const frames = appends.length;
  const headerIndex = frames + 2;
  const base = headerIndex + layout.dataNftCount;

  // The element stream at each frame boundary, and the chunk commitments each stage holds.
  const stages = [0, ...appends.map((_unused, index) => index + 1)]
    .map((count) => itemsBytes([...initial, ...appends.slice(0, count)]));
  const headers = stages.map((bytes) => headerOf(layout, bytes));
  const chunksAt = (stage: number): readonly Uint8Array[] =>
    splitValueIntoChunks(stages[stage]!).map((piece, index) => chunkOf(index, piece));

  const selector = selectorOf(artifacts, 'Log', 'append');
  const pushFor = (index: number): readonly Uint8Array[] => [selector, encodeIntegerValue(appends[index]!)];

  const hubMaster = master({
    master: 'hub-1',
    contract: 'Hub',
    entry: 'go',
    program: hub.program,
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: hub.address, value: 0n },
    facts: {
      contract: 'Hub', functionName: 'go', kind: FrameKind.ROOT, callerIsUser: true,
      originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
    },
    enteredBy: USER_ID,
    origin: USER_ID,
    calls: appends.map((_unused, index) => ({
      kind: FrameKind.CALL, callee: `log-${index + 1}`, target: log.address, value: 0n,
      argumentPushes: pushFor(index),
    })),
    segments: Array.from({ length: frames + 1 }, () => []),
  });

  const logMaster = (frame: number): DraftMaster => {
    const before = chunksAt(frame);
    const after = chunksAt(frame + 1);
    // The run's whole view for this frame: what the append before it left, and what this append computes. A chunk
    // only the later stage holds is created, and one only the earlier stage holds is removed.
    const entries: RecordEntry[] = [];
    for (let offset = 0; offset < Math.max(before.length, after.length); offset += 1) {
      const index = base + offset;
      if (offset < before.length && offset < after.length) {
        entries.push({ in: index, out: index, viewIn: before[offset]!, viewOut: after[offset]! });
      } else if (offset < after.length) {
        entries.push({ in: INDEX_NONE, out: index, viewIn: EMPTY, viewOut: after[offset]! });
      } else {
        entries.push({ in: index, out: INDEX_NONE, viewIn: before[offset]!, viewOut: EMPTY });
      }
    }
    return master({
      master: `log-${frame + 1}`,
      contract: 'Log',
      entry: 'append',
      program: log.program,
      frame: { kind: FrameKind.CALL, sender: hub.address, self: log.address, value: 0n },
      facts: {
        contract: 'Log', functionName: 'append', kind: FrameKind.CALL, callerIsUser: false,
        originEqualsCaller: false, makesExternalCall: false, mastersOfContract: frames,
      },
      enteredBy: 'hub-1',
      origin: USER_ID,
      argumentPushes: pushFor(frame),
      segments: [[
        { in: headerIndex, out: headerIndex, viewIn: headers[frame]!, viewOut: headers[frame + 1]! },
        ...entries,
      ]],
    });
  };

  const run = layOutChunkRun({
    plan: planChunkRun({ layout, variable: 'items', spent: stages[0]!, written: stages[frames]! }),
    category: LOG_CATEGORY,
    base,
    writer: frames + 1,
    valueSatoshis: 1_000n,
    removedLock: USER_LOCK,
  });
  const kept = run.records.filter((record) => record.role === 'kept');
  const created = run.records.filter((record) => record.role === 'created');
  const removed = run.records.filter((record) => record.role === 'removed');
  const logState = [HEADER_ID, ...kept.map((record) => record.id)];
  const funderInputBase = layoutTransaction([
    { contract: 'Hub', masters: ['hub-1'], validator: { id: VALIDATOR_ID, settles: [] }, state: [] },
    {
      contract: 'Log',
      masters: Array.from({ length: frames }, (_unused, index) => `log-${index + 1}`),
      state: logState,
    },
  ]).funderInputBase;

  const plan: CompositionDraftPlan = {
    blocks: [
      { contract: 'Hub', masters: ['hub-1'], validator: { id: VALIDATOR_ID, settles: [] }, state: [] },
      {
        contract: 'Log',
        masters: Array.from({ length: frames }, (_unused, index) => `log-${index + 1}`),
        state: logState,
      },
    ],
    userInputs: [
      ...removed.map((record) => ({ id: record.id, index: record.index })),
      { id: USER_ID, index: funderInputBase + removed.length },
    ],
    masters: [hubMaster, ...Array.from({ length: frames }, (_unused, index) => logMaster(index))],
    inputs: {
      'hub-1': { source: masterInput(hub) },
      ...Object.fromEntries(Array.from({ length: frames },
        (_unused, index) => [`log-${index + 1}`, { source: masterInput(log) }])),
      [VALIDATOR_ID]: {
        source: {
          lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(HUB_CATEGORY, 'mutable'),
        },
      },
      [HEADER_ID]: {
        source: {
          lockingBytecode: USER_LOCK, valueSatoshis: 20_000n,
          token: token(LOG_CATEGORY, 'mutable', headers[0]!),
        },
        output: {
          lockingBytecode: USER_LOCK, valueSatoshis: 20_000n,
          token: token(LOG_CATEGORY, 'mutable', headers[frames]!),
        },
        unlockingBytecode: encodeDataPush(new Uint8Array([1])),
      },
      ...Object.fromEntries(run.records.filter((record) => record.input !== undefined)
        .map((record) => [record.id, record.input!])),
      [USER_ID]: userInput(),
    },
    ...(created.length === 0 ? {} : { trailingOutputs: created.map((record) => record.output!) }),
    validator: {
      id: VALIDATOR_ID,
      covers: ['Log'],
      settles: [{
        category: LOG_CATEGORY,
        stateInputs: [HEADER_ID, ...kept.map((record) => record.id), ...removed.map((record) => record.id)],
      }],
      redeemScript: validator.redeem,
    },
  };
  return { plan, artifacts, contracts, chunkIds: run.records.map((record) => record.id) };
}

/** The machine's verdict on one participant's own input of the assembled transaction. */
function verdictAt(draft: ReturnType<typeof createComposedDerivationHost>['draft'], id: string): string {
  const program = draft.programFor('hub-1');
  const vm = compositionMachine();
  const state = vm.evaluate({
    inputIndex: participant(draft.layout, id).index,
    sourceOutputs: program.sourceOutputs,
    transaction: program.transaction,
  });
  return vm.stateSuccess(state) === true ? 'accepted' : `refused: ${String(state.error)}`;
}

describe('one entry appending to one log three times', () => {
  it('publishes one call site per call, so the callee runs on one master per append', () => {
    const { artifacts } = compileAndDeploy(toySource(APPENDS), { Hub: HUB_LABEL, Log: LOG_LABEL });
    const hub = (artifacts.Hub!.composition as {
      stopSites: { entries: { functionName: string; sites: { sites: unknown[] } }[] };
    }).stopSites.entries.find((entry) => entry.functionName === entryName('Hub', 'go'))!;
    expect(hub.sites.sites).toStrictEqual([
      { kind: 'call', site: 0, callIndex: 0, descriptor: 0 },
      { kind: 'call', site: 1, callIndex: 1, descriptor: 1 },
      { kind: 'call', site: 2, callIndex: 2, descriptor: 2 },
      { kind: 'segmentClose', site: 3, segmentIndex: 0 },
      { kind: 'segmentClose', site: 4, segmentIndex: 1 },
      { kind: 'segmentClose', site: 5, segmentIndex: 2 },
      { kind: 'segmentClose', site: 6, segmentIndex: 3 },
    ]);
    expect(artifacts.Log!.stateLayout?.variables?.map((variable) => `${variable.name}:${variable.dynamic}`))
      .toStrictEqual(['items:true']);
  });

  it('lays a run that grows from empty out: the chunk is created with no input to spend', () => {
    const { artifacts } = compileAndDeploy(toySource(APPENDS), { Hub: HUB_LABEL, Log: LOG_LABEL });
    const layout = artifacts.Log!.stateLayout!;
    const written = itemsBytes(APPENDS.map((append) => append.item));

    // The log starts with no items, so its run holds no chunk and the appends create the first one.
    const plan = planChunkRun({ layout, variable: 'items', spent: EMPTY, written });
    expect(plan.spent.chunks).toHaveLength(0);
    expect(plan.written.chunks).toHaveLength(1);

    const run = layOutChunkRun({ plan, category: LOG_CATEGORY, base: 7, writer: 0, valueSatoshis: 1_000n });
    expect(run.records.map((record) => record.role)).toStrictEqual(['created']);
    expect(run.records[0]!.input).toBeUndefined();
    expect(run.records[0]!.output?.token).toStrictEqual({
      category: LOG_CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment: plan.written.chunks[0] },
    });
    expect(run.entries).toStrictEqual([
      { in: INDEX_NONE, out: 7, viewIn: EMPTY, viewOut: plan.written.chunks[0] },
    ]);
  });

  it('chains each frame\'s run declaration from what the frame before it wrote', () => {
    const { artifacts } = compileAndDeploy(toySource(APPENDS), { Hub: HUB_LABEL, Log: LOG_LABEL });
    const layout = artifacts.Log!.stateLayout!;
    const stages = [0, 1, 2, 3].map((count) =>
      itemsBytes(APPENDS.slice(0, count).map((append) => append.item)));
    const headers = stages.map((bytes) => headerOf(layout, bytes));
    const chunks = stages.map((bytes) => chunkOf(0, bytes));

    // The first frame creates the run's chunk; each later frame reads what the frame before it wrote.
    const frames = [0, 1, 2].map((frame) => [
      { in: 1, out: 1, viewIn: headers[frame]!, viewOut: headers[frame + 1]! },
      frame === 0
        ? { in: INDEX_NONE, out: 3, viewIn: EMPTY, viewOut: chunks[1]! }
        : { in: 3, out: 3, viewIn: chunks[frame]!, viewOut: chunks[frame + 1]! },
    ]);
    expect(() => assertCompositionSettlement(
      frames.map((segments, index) => ({ master: `log-${index + 1}`, segments: [segments] })),
      {
        inputCommitments: new Map([[1, headers[0]!]]),
        outputCommitments: new Map([[1, headers[3]!], [3, chunks[3]!]]),
      },
    )).not.toThrow();
  });

  it('settles one append: the frame reads the run it spends and writes it once', () => {
    const single = build([7n], [10n]);
    const { host, draft } = createComposedDerivationHost({
      vm: compositionMachine(),
      artifacts: [single.artifacts.Hub!, single.artifacts.Log!],
      plan: single.plan,
    });
    const derived = deriveDepthFirst(rootOf('Hub', 'go', 'hub-1'), host);
    expect(derived.completed.map((frame) => frame.master)).toStrictEqual(['log-1', 'hub-1']);
    expect(verdictAt(draft, 'log-1')).toBe('accepted');
    expect(verdictAt(draft, 'hub-1')).toBe('accepted');
    expect(verdictAt(draft, VALIDATOR_ID)).toBe('accepted');

    // The run's output carries the appended element stream, and the log's header the value's byte length.
    const program = draft.programFor('hub-1');
    expect(program.transaction.outputs[participant(draft.layout, single.chunkIds[0]!).index]!.token?.nft?.commitment)
      .toStrictEqual(chunkOf(0, itemsBytes([7n, 10n])));
    expect(program.transaction.outputs[participant(draft.layout, HEADER_ID).index]!.token?.nft?.commitment)
      .toStrictEqual(headerOf(single.artifacts.Log!.stateLayout!, itemsBytes([7n, 10n])));
  });

  it('does not carry a run one frame writes to the next: the second append stalls', () => {
    // The second frame reads the run from the transaction's one chunk input, which holds the spent value rather
    // than the value the first frame wrote, so the record its segment declares is not what its body computes.
    const pair = build([7n], [10n, 20n]);
    const { host } = createComposedDerivationHost({
      vm: compositionMachine(),
      artifacts: [pair.artifacts.Hub!, pair.artifacts.Log!],
      plan: pair.plan,
    });
    const refusal = refusalOf(() => deriveDepthFirst(rootOf('Hub', 'go', 'hub-1'), host));
    expect(refusal.name).toBe('PerCallComposerError');
    expect(refusal.code).toBe('PER_CALL_DERIVATION_STALLED');
    expect(refusal.message).toMatch(/master "log-1" of Log\.append\(\) filled no witness at site 0/);
  });

  it('composes the three appends from empty, and stalls where each frame closes its own run', () => {
    // The run is laid out now — its first chunk is created, so the composition assembles — but the transaction
    // writes one chunk output, holding the final element stream, and a frame's close compares its own computed
    // value against it. Only a frame whose value is the final one closes, so the first append already stalls.
    const three = build([], APPENDS.map((append) => append.item));
    const { host } = createComposedDerivationHost({
      vm: compositionMachine(),
      artifacts: [three.artifacts.Hub!, three.artifacts.Log!],
      plan: three.plan,
    });
    const refusal = refusalOf(() => deriveDepthFirst(rootOf('Hub', 'go', 'hub-1'), host));
    expect(refusal.name).toBe('PerCallComposerError');
    expect(refusal.code).toBe('PER_CALL_DERIVATION_STALLED');
    expect(refusal.message).toMatch(/master "log-1" of Log\.append\(\) filled no witness at site 0 \(close of segment 0\)/);
  });

  it('refuses a run whose written chunk the frame did not compute', () => {
    // The control for the accept above: the same settled transaction with the chunk output rewritten to a value no
    // frame computed makes the callee's own input refused.
    const single = build([7n], [10n]);
    const { host, draft } = createComposedDerivationHost({
      vm: compositionMachine(),
      artifacts: [single.artifacts.Hub!, single.artifacts.Log!],
      plan: single.plan,
    });
    deriveDepthFirst(rootOf('Hub', 'go', 'hub-1'), host);

    const vm = compositionMachine();
    const program = draft.programFor('hub-1');
    const chunkIndex = participant(draft.layout, single.chunkIds[0]!).index;
    const outputs = program.transaction.outputs.map((output, index) => (index === chunkIndex
      ? { ...output, token: token(LOG_CATEGORY, 'mutable', chunkOf(0, itemsBytes([7n, 99n]))) }
      : output));
    const state = vm.evaluate({
      inputIndex: participant(draft.layout, 'log-1').index,
      sourceOutputs: program.sourceOutputs,
      transaction: { ...program.transaction, outputs },
    });
    expect(vm.stateSuccess(state)).not.toBe(true);
  });
});
