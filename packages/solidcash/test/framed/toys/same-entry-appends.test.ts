import { describe, expect, it } from 'vitest';
import { layoutWithFacets } from '../shapes/harness.js';
import {
  FrameKind,
  INDEX_NONE,
  buildChunkCommitment,
  buildPushdataCommitment,
  bytesToHex,
  encodeEventCommitment,
  encodeIntegerValue,
  packFixedWidthElement,
  splitValueIntoChunks,
  type RecordEntry,
  type StateLayout,
} from '@solidcash/utils';
import { seededCategory } from '../../../../solidc/test/framed/master/validator-input.js';
import {
  stateRecordLockingBytecode, stateRecordUnlockingBytecode,
} from '../../../src/framed/deploy/index.js';
import { eventOutput } from '../../../../solidc/test/framed/master/event-input.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import {
  EMPTY, USER_LOCK, compileAndDeploy, entryName, hexOf, master, masterInput, rootOf, seededAddress, selectorOf,
  token, userInput, validatorFor,
} from '../shapes/harness.js';
import {
  assertCompositionSettlement, createComposedDerivationHost, deriveDepthFirst, layOutChunkRun,
  participant, planChunkRun, readPublishedStopSites, type CompositionDraftPlan, type DraftMaster,
} from '../../../src/framed/composer/index.js';

/**
 * One entry appending to one log three times.
 *
 * `Hub.go` calls `Log.append(id, item)` three times as three unrolled statements with distinct arguments; `append`
 * pushes onto the log's dynamic array `items` and emits an event. The compiler gives each call its own call site,
 * so the composition carries three call records and the callee runs on one master per call.
 *
 * The log's `items` is a chunk-packed array: its bytes live in a run of chunk UTXOs locked by the value's own
 * collection covenant. Each frame reads and closes the run against the view its own segment declares, rather than
 * against the transaction's chunk inputs and outputs: the input holds the value the transaction spent and the
 * output the value the last frame wrote, while the frame must continue from what the frame before it wrote. A
 * write that changes the run's width creates or removes chunks, and the composer lays those records out: a chunk
 * only the later stage holds is created as a trailing output, and one only the earlier stage holds is spent as a
 * funder input. Because the frame addresses the run through its own declaration, a run that exists when the
 * transaction starts is carried from one frame to the next, and so is a run the transaction itself creates: a
 * created record has no input, so it is named by the trailing output it appears at and the settlement transcript
 * carries that output as a created record, which is what tells the validator the index is a created record rather
 * than a spent state UTXO. Both are settled below, with the run's chunks and header read back through the shipped
 * encoders.
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
  return 'pragma solidcash ^0.14.0;'
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

/** The same shape without the event, which is the source the machine cases below run. */
function runSource(items: readonly bigint[]): string {
  return 'pragma solidcash ^0.14.0;'
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
function build(initial: readonly bigint[], appends: readonly bigint[], withEvents = false): {
  readonly plan: CompositionDraftPlan;
  readonly artifacts: ReturnType<typeof compileAndDeploy>['artifacts'];
  readonly contracts: ReturnType<typeof compileAndDeploy>['contracts'];
  readonly chunkIds: readonly string[];
} {
  const source = withEvents
    ? toySource(appends.map((item, index) => ({ id: BigInt(index + 1), item })))
    : runSource(appends);
  const { artifacts, contracts } = compileAndDeploy(source, { Hub: HUB_LABEL, Log: LOG_LABEL });
  const hub = contracts.Hub!;
  const log = contracts.Log!;
  const layout = artifacts.Log!.stateLayout!;
  const validator = validatorFor(HUB_CATEGORY);

  const frames = appends.length;
  // The hub, its validator, the facet it binds, then one log master per frame, then the header record.
  const headerIndex = frames + 3;
  // The run band sits one layout width past the frame's declared record block, so it does not move with the event
  // region, which is a trailing output the layout places after the participants.
  const base = headerIndex + layout.dataNftCount;

  // The element stream at each frame boundary, and the chunk commitments each stage holds.
  const stages = [0, ...appends.map((_unused, index) => index + 1)]
    .map((count) => itemsBytes([...initial, ...appends.slice(0, count)]));
  const headers = stages.map((bytes) => headerOf(layout, bytes));
  const chunksAt = (stage: number): readonly Uint8Array[] =>
    splitValueIntoChunks(stages[stage]!).map((piece, index) => chunkOf(index, piece));

  const selector = selectorOf(artifacts, 'Log', 'append');
  // `append`'s parameters are (id, item), so the callee's argument pushes carry the last parameter first.
  const pushFor = (index: number): readonly Uint8Array[] => (withEvents
    ? [selector, encodeIntegerValue(appends[index]!), encodeIntegerValue(BigInt(index + 1))]
    : [selector, encodeIntegerValue(appends[index]!)]);

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
      if (offset < before.length && offset < after.length) {
        const index = runIndexOf(offset);
        entries.push({ in: index, out: index, viewIn: before[offset]!, viewOut: after[offset]! });
      } else if (offset < after.length) {
        const index = runIndexOf(offset);
        entries.push({ in: INDEX_NONE, out: index, viewIn: EMPTY, viewOut: after[offset]! });
      } else {
        // A removed chunk is spent at its own band index, which is where the transaction already carries it.
        entries.push({ in: base + offset, out: INDEX_NONE, viewIn: before[offset]!, viewOut: EMPTY });
      }
    }
    return {
      ...master({
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
      }),
      events: [],
    };
  };

  // The events the appends emit, at the trailing outputs the layout allocates for them.
  const emitted = withEvents
    ? artifacts.Log!.events!.slice(0, 1).flatMap((event) =>
      appends.map((item, index) =>
        eventOutput(LOG_CATEGORY, event.signature, encodeEventCommitment(event.parameters, [BigInt(index + 1), item]))))
    : [];

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
  const trailing = [...emitted, ...created.map((record) => record.output!)];
  const logState = [HEADER_ID, ...kept.map((record) => record.id)];
  const funderInputBase = layoutWithFacets([
    { contract: 'Hub', masters: ['hub-1'], validator: { id: VALIDATOR_ID, settles: [] }, state: [] },
    {
      contract: 'Log',
      masters: Array.from({ length: frames }, (_unused, index) => `log-${index + 1}`),
      state: logState,
    },
  ]).funderInputBase;

  // Where the transaction actually carries each of the run's chunks. A chunk the final stage keeps is a participant
  // at its own band index, while one the final stage creates is a trailing output after the events, so a run created
  // in the trailing region sits at different coordinates than the band the body reads it from.
  const runIndexOf = (offset: number): number => (offset < kept.length
    ? base + offset
    : funderInputBase + emitted.length + (offset - kept.length));

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
    masters: [
      hubMaster,
      ...Array.from({ length: frames }, (_unused, index) => ({
        ...logMaster(index),
        // One event per append, at the trailing output the layout gives it.
        events: withEvents ? [funderInputBase + index] : [],
      })),
    ],
    inputs: {
      'hub-1': { source: masterInput(hub) },
      ...Object.fromEntries(Array.from({ length: frames },
        (_unused, index) => [`log-${index + 1}`, { source: masterInput(log) }])),
      [VALIDATOR_ID]: {
        source: {
          lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(HUB_CATEGORY, 'mutable'),
        },
      },
      // The header is the log's data NFT, so it sits at the covenant its category derives; the composed spend
      // carries that covenant's write path with a log master's index (the hub's master and validator precede the
      // log's masters, so `log-1` is at index 2).
      [HEADER_ID]: {
        source: {
          lockingBytecode: stateRecordLockingBytecode(bytesToHex(LOG_CATEGORY)), valueSatoshis: 20_000n,
          token: token(LOG_CATEGORY, 'mutable', headers[0]!),
        },
        output: {
          lockingBytecode: stateRecordLockingBytecode(bytesToHex(LOG_CATEGORY)), valueSatoshis: 20_000n,
          token: token(LOG_CATEGORY, 'mutable', headers[frames]!),
        },
        // The first log master sits after the hub, its validator and the facet the validator binds.
        unlockingBytecode: stateRecordUnlockingBytecode(bytesToHex(LOG_CATEGORY), 3, 1),
      },
      ...Object.fromEntries(run.records.filter((record) => record.input !== undefined)
        .map((record) => [record.id, record.input!])),
      [USER_ID]: userInput(),
    },
    ...(trailing.length === 0 ? {} : { trailingOutputs: trailing }),
    validator: {
      id: VALIDATOR_ID,
      covers: ['Log'],
      settles: [{
        category: LOG_CATEGORY,
        stateInputs: [HEADER_ID, ...kept.map((record) => record.id), ...removed.map((record) => record.id)],
        // A chunk the transaction creates has no input to name, so it is declared by the trailing output it
        // appears at: the frames' later declarations address it by that index.
        createdOutputs: created.map((_record, offset) => funderInputBase + emitted.length + offset),
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

let composed: {
  readonly three: ReturnType<typeof build>;
  readonly draft: ReturnType<typeof createComposedDerivationHost>['draft'];
  readonly derived: ReturnType<typeof deriveDepthFirst>;
} | undefined;
/**
 * The three appends over a one-element run, derived once: the compose case reads the draft, and the refusal, the
 * file's last case, rewrites a declaration in it.
 */
function composedThree(): NonNullable<typeof composed> {
  if (composed === undefined) {
    const three = build([7n], APPENDS.map((append) => append.item));
    const { host, draft } = createComposedDerivationHost({
      vm: compositionMachine(),
      artifacts: [three.artifacts.Hub!, three.artifacts.Log!],
      plan: three.plan,
    });
    composed = { three, draft, derived: deriveDepthFirst(rootOf('Hub', 'go', 'hub-1'), host) };
  }
  return composed;
}

describe('one entry appending to one log three times', () => {
  it('publishes one call site per call, so the callee runs on one master per append', () => {
    const { artifacts } = compileAndDeploy(toySource(APPENDS), { Hub: HUB_LABEL, Log: LOG_LABEL });
    const hub = readPublishedStopSites(artifacts.Hub!).entries
      .find((entry) => entry.functionName === entryName('Hub', 'go'))!;
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

  // One and two appends are narrower than the three below, on the same path: each frame reads the run the frame
  // before it wrote.

  it('composes the three appends, each frame reading the run the frame before it wrote', () => {
    // The run starts with one element. Each append reads the view the frame before it declared and closes its
    // own segment against the view it declares, so the value grows one element at a time even though the
    // transaction's chunk input holds the value it spent and its chunk outputs the value the last frame wrote.
    // The last append crosses 120 bytes, so the transaction creates a second chunk beside the kept one.
    const { three, draft, derived } = composedThree();
    expect(derived.completed.map((frame) => frame.master)).toStrictEqual(['log-1', 'log-2', 'log-3', 'hub-1']);
    expect(verdictAt(draft, 'log-1')).toBe('accepted');
    expect(verdictAt(draft, 'log-2')).toBe('accepted');
    expect(verdictAt(draft, 'log-3')).toBe('accepted');
    expect(verdictAt(draft, 'hub-1')).toBe('accepted');
    expect(verdictAt(draft, VALIDATOR_ID)).toBe('accepted');
    expect(verdictAt(draft, HEADER_ID)).toBe('accepted');

    // The run's chunks hold the whole element stream and the log's header its byte length, all read back through
    // the encoders the composer shipped. The kept chunk recreates in place; the last append creates the next.
    const values = [7n, ...APPENDS.map((append) => append.item)];
    const chunks = splitValueIntoChunks(itemsBytes(values)).map((piece, index) => chunkOf(index, piece));
    expect(chunks).toHaveLength(2);
    const program = draft.programFor('hub-1');
    const keptIndex = participant(draft.layout, three.chunkIds[0]!).index;
    expect(program.transaction.outputs[keptIndex]!.token?.nft?.commitment).toStrictEqual(chunks[0]);
    expect(program.transaction.outputs[keptIndex + 1]!.token?.nft?.commitment).toStrictEqual(chunks[1]);
    expect(program.transaction.outputs[participant(draft.layout, HEADER_ID).index]!.token?.nft?.commitment)
      .toStrictEqual(headerOf(three.artifacts.Log!.stateLayout!, itemsBytes(values)));
  });

  // A run the transaction creates without events, and events over a kept run, are each narrower than the case
  // below: three appends that create the run and emit one event each.

  it('settles the per-append events beside a run the transaction creates', () => {
    // The run does not exist when the transaction starts, so the first append creates its chunk while every append
    // emits. The created chunk's output is a trailing output after the events, so its index is not the band the
    // frame reads the run from: the frame's own segment declares the index, and the body checks the transaction at
    // that declaration. The plan declares the created record where the trailing region puts it, and the whole
    // composition derives and settles with the created chunk, the header and every event read back.
    const three = build([], APPENDS.map((append) => append.item), true);
    const { host, draft } = createComposedDerivationHost({
      vm: compositionMachine(),
      artifacts: [three.artifacts.Hub!, three.artifacts.Log!],
      plan: three.plan,
    });
    const derived = deriveDepthFirst(rootOf('Hub', 'go', 'hub-1'), host);
    expect(derived.completed.map((frame) => frame.master)).toStrictEqual(['log-1', 'log-2', 'log-3', 'hub-1']);
    expect(verdictAt(draft, 'log-1')).toBe('accepted');
    expect(verdictAt(draft, 'log-2')).toBe('accepted');
    expect(verdictAt(draft, 'log-3')).toBe('accepted');
    expect(verdictAt(draft, 'hub-1')).toBe('accepted');
    expect(verdictAt(draft, VALIDATOR_ID)).toBe('accepted');
    expect(verdictAt(draft, HEADER_ID)).toBe('accepted');

    const values = APPENDS.map((append) => append.item);
    const chunks = splitValueIntoChunks(itemsBytes(values)).map((piece, index) => chunkOf(index, piece));
    expect(chunks).toHaveLength(1);
    const program = draft.programFor('hub-1');
    // The created chunk is a trailing output the plan placed after the events; the plan's declaration is where the
    // transaction carries it.
    expect(draft.trailingOutputs).toHaveLength(APPENDS.length + 1);
    const createdIndex = draft.trailingOutputs[APPENDS.length]!.index;
    expect(program.transaction.outputs[createdIndex]!.token?.nft?.commitment).toStrictEqual(chunks[0]);
    expect(program.transaction.outputs[participant(draft.layout, HEADER_ID).index]!.token?.nft?.commitment)
      .toStrictEqual(headerOf(three.artifacts.Log!.stateLayout!, itemsBytes(values)));
    // One event per append, each carrying the payload the body computed.
    const event = three.artifacts.Log!.events![0]!;
    const eventIndices = draft.assembly.outputs.eventIndices;
    expect(eventIndices).toHaveLength(APPENDS.length);
    APPENDS.forEach((append, index) => {
      const payload = encodeEventCommitment(event.parameters, [BigInt(index + 1), append.item]);
      expect(program.transaction.outputs[eventIndices[index]!]!.token?.nft).toStrictEqual({
        capability: 'none', commitment: payload,
      });
    });
  });

  it('refuses a run whose declared close is not the one the frame computed', () => {
    // The control for the accept above: the body computes the run its append writes and closes the segment
    // against the view the segment declares, so a declaration rewritten to a value no frame computed is refused.
    const { draft } = composedThree();
    const record = draft.blockOf('log-1').segments[0]!;
    record[record.length - 1]!.viewOut = chunkOf(0, itemsBytes([7n, 99n]));

    const vm = compositionMachine();
    const program = draft.programFor('hub-1');
    const state = vm.evaluate({
      inputIndex: participant(draft.layout, 'log-1').index,
      sourceOutputs: program.sourceOutputs,
      transaction: program.transaction,
    });
    expect(vm.stateSuccess(state)).not.toBe(true);
  });
});
