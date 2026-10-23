import { describe, expect, it } from 'vitest';
import { encodeDataPush } from '@bitauth/libauth';
import {
  FrameKind, INDEX_NONE, buildEntryNftCovenantScript, computeCollectionHash, encodeIntegerValue, bytesToHex,
  type RecordEntry,
} from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { scriptToLockingBytecode } from '../../../src/utils.js';
import { encodeEntryCommitment, headSentinelCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import {
  USER_LOCK, compileAndDeploy, entryName, hexOf, master, masterInput, rootOf, seededAddress, selectorOf, token,
  userInput, validatorFor,
} from '../shapes/harness.js';
import {
  createComposedDerivationHost, deriveComposition, layOutMappingWrites, participant, planMappingWrite,
  readPublishedStopSites, type CompositionDraftPlan, type DraftMaster, type MappingNodePlacement,
} from '../../../src/framed/composer/index.js';

/**
 * One entry inserting, updating and deleting one key across three calls in one transaction.
 *
 * `Hub.run` calls `Ledger.insert(1, 10)`, `Ledger.update(1, 20)` and `Ledger.remove(1)`. The compiler gives each
 * call its own call site, so the composition carries three call records and the callee runs on one master per
 * call. `records` is a sorted mapping, so each write touches a node UTXO: an insert splices a created node in
 * beside its predecessor, an update rewrites the target in place, and a delete writes the key's default value back
 * over it (the collection never unlinks a node).
 *
 * The key's node is one UTXO, and a transaction gives it one input and one output. The insert creates it, so the
 * update that follows has no input to spend it at; the composer declares the node the insert created at the
 * transaction's output and has each later frame carry on from the view the one before it left. The whole shipped
 * path runs: the source through the shipped compiler, both programs through the shipped deployment, the composer
 * planning and laying the writes out, and the BCH-2026 machine asked for a verdict on the frames.
 */

const HUB_LABEL = 'sorted entry lifecycle hub';
const LEDGER_LABEL = 'sorted entry lifecycle ledger';
const LEDGER_ADDRESS = seededAddress(LEDGER_LABEL);
const VALIDATOR_ID = 'validator';
const HEAD_ID = 'head';
const SITE_ID = 'site';
const USER_ID = 'user';
const KEY = 1n;
const INSERTED = 10n;
const UPDATED = 20n;
const DEFAULT = 0n;
// The inserting master sits last among the Ledger masters, so the node it creates lands at the output just past
// its own input. The head the insert relinks is a state input that recreates in place after the masters, and the
// user follows.
// The hub, its validator, the facet it binds, the ledger's three masters, then the created node, its head and the user.
const CREATED_INDEX = 6;
const HEAD_INDEX = 7;
const USER_INDEX = 8;
const ZERO_SLOT = new Uint8Array(32);
const VALUE_TAIL_BYTES = 64;

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ILedger {'
  + '   function insert(int key, int value);'
  + '   function update(int key, int value);'
  + '   function remove(int key);'
  + ' }'
  + ' contract Ledger {'
  + '   mapping(int => int) records;'
  + '   function insert(int key, int value) { this.records[key] = value; require(true); }'
  + '   function update(int key, int value) { this.records[key] = value; require(true); }'
  + '   function remove(int key) { delete this.records[key]; require(true); }'
  + ' }'
  + ' contract Hub {'
  + '   function run() {'
  + `     ILedger(0x${hexOf(LEDGER_ADDRESS)}).insert(${KEY}, ${INSERTED});`
  + `     ILedger(0x${hexOf(LEDGER_ADDRESS)}).update(${KEY}, ${UPDATED});`
  + `     ILedger(0x${hexOf(LEDGER_ADDRESS)}).remove(${KEY});`
  + '     require(true);'
  + '   }'
  + ' }';

const KEY_PUSH = encodeIntegerValue(KEY);
const encodeValue = (value: bigint): Uint8Array => encodeIntegerValue(value);
/** The head one insert leaves: relinked to the key's slot, its value tail kept. */
const relinkedHead = (slot: Uint8Array): Uint8Array =>
  encodeEntryCommitment(ZERO_SLOT, slot, new Uint8Array(VALUE_TAIL_BYTES));
/** The key's node after one write, from the shipped sorted-list encoder. */
const node = (slot: Uint8Array, value: bigint): Uint8Array => encodeEntryCommitment(slot, ZERO_SLOT, encodeValue(value));

/** The whole composition: the plan the composer lays out, its segments, and the draft the derivation fills. */
function drive(): {
  readonly draft: ReturnType<typeof createComposedDerivationHost>['draft'];
  readonly derived: ReturnType<typeof deriveComposition>;
  readonly segments: readonly (readonly RecordEntry[])[];
  readonly nodeAfter: Uint8Array;
  readonly headAfter: Uint8Array;
} {
  const { artifacts, contracts } = compileAndDeploy(SOURCE, { Hub: HUB_LABEL, Ledger: LEDGER_LABEL });
  const hub = contracts.Hub!;
  const ledger = contracts.Ledger!;
  const validator = validatorFor(hub.category);

  const head = headSentinelCommitment();
  // The three writes of the one key, planned against the view each frame's predecessor leaves: the insert splices
  // the created node in beside the head, the update rewrites it, and the delete writes its default value back.
  const insertPlan = planMappingWrite({ keys: [KEY_PUSH], value: INSERTED, inventory: [head], encodeValue });
  const created = insertPlan.written.find((entry) => !entry.existed)!;
  const updatePlan = planMappingWrite({
    keys: [KEY_PUSH], value: UPDATED, inventory: [insertPlan.written[0]!.after, created.after], encodeValue,
  });
  const removePlan = planMappingWrite({
    keys: [KEY_PUSH], value: DEFAULT, inventory: [insertPlan.written[0]!.after, updatePlan.written[0]!.after], encodeValue,
  });

  const slot = keyToSlotMulti([KEY_PUSH]);
  const placements = new Map<string, MappingNodePlacement>([
    [bytesToHex(ZERO_SLOT), { in: HEAD_INDEX, out: HEAD_INDEX }],
    [bytesToHex(slot), { out: CREATED_INDEX }],
  ]);
  const segments = layOutMappingWrites(
    [[insertPlan], [updatePlan], [removePlan]],
    { placementOf: (candidate) => placements.get(bytesToHex(candidate)) },
  );

  const selector = (entry: string): Uint8Array => selectorOf(artifacts, 'Ledger', entry);
  const ledgerMaster = (
    id: string, entry: string, argumentPushes: readonly Uint8Array[], masterSegments: readonly (readonly RecordEntry[])[],
  ): DraftMaster => master({
    master: id, contract: 'Ledger', entry, program: ledger.program,
    frame: { kind: FrameKind.CALL, sender: hub.address, self: ledger.address, value: 0n },
    facts: {
      contract: 'Ledger', functionName: entry, kind: FrameKind.CALL,
      callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 3,
    },
    enteredBy: 'hub-1', origin: USER_ID,
    argumentPushes,
    segments: masterSegments,
    dispatches: true,
  });

  const hubMaster: DraftMaster = master({
    master: 'hub-1', contract: 'Hub', entry: 'run', program: hub.program,
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: hub.address, value: 0n },
    facts: {
      contract: 'Hub', functionName: 'run', kind: FrameKind.ROOT,
      callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
    },
    enteredBy: USER_ID, origin: USER_ID,
    calls: [
      { kind: FrameKind.CALL, callee: 'insert-1', target: ledger.address, value: 0n,
        argumentPushes: [selector('insert'), encodeValue(INSERTED), KEY_PUSH] },
      { kind: FrameKind.CALL, callee: 'update-1', target: ledger.address, value: 0n,
        argumentPushes: [selector('update'), encodeValue(UPDATED), KEY_PUSH] },
      { kind: FrameKind.CALL, callee: 'remove-1', target: ledger.address, value: 0n,
        argumentPushes: [selector('remove'), KEY_PUSH] },
    ],
    segments: [[], [], [], []],
  });

  // The node sits at the mapping collection's own entry covenant; the head the transaction spends carries the
  // genesis commitment, and the created node is written at the inserting master's own adjacent output.
  const entryLock = scriptToLockingBytecode(
    buildEntryNftCovenantScript(
      ledger.category, computeCollectionHash(artifacts.Ledger!.stateLayout!.collections![0]!.signature),
    ),
    'p2sh32',
  );
  const headAfter = insertPlan.written[0]!.after;
  const nodeAfter = removePlan.written[0]!.after;
  const headSource = { lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token(ledger.category, 'mutable', head) };

  const plan: CompositionDraftPlan = {
    blocks: [
      { contract: 'Hub', masters: ['hub-1'], validator: { id: VALIDATOR_ID, settles: [] }, state: [] },
      { contract: 'Ledger', masters: ['update-1', 'remove-1', 'insert-1'], state: [] },
    ],
    userInputs: [
      { id: SITE_ID, index: CREATED_INDEX },
      { id: HEAD_ID, index: HEAD_INDEX },
      { id: USER_ID, index: USER_INDEX },
    ],
    masters: [
      hubMaster,
      ledgerMaster('insert-1', 'insert', [selector('insert'), encodeValue(INSERTED), KEY_PUSH], [segments[0]!]),
      ledgerMaster('update-1', 'update', [selector('update'), encodeValue(UPDATED), KEY_PUSH], [segments[1]!]),
      ledgerMaster('remove-1', 'remove', [selector('remove'), KEY_PUSH], [segments[2]!]),
    ],
    inputs: {
      'hub-1': { source: masterInput(hub) },
      'insert-1': { source: masterInput(ledger) },
      'update-1': { source: masterInput(ledger) },
      'remove-1': { source: masterInput(ledger) },
      [VALIDATOR_ID]: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(hub.category, 'mutable') },
      },
      // A created record is one no input recreates, so a signed input carries the output the insert frame writes it
      // at, one past that frame's own input.
      [SITE_ID]: {
        source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
        output: { lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token(ledger.category, 'mutable', nodeAfter) },
        unlockingBytecode: userInput().unlockingBytecode,
      },
      [HEAD_ID]: {
        source: headSource,
        output: { ...headSource, token: token(ledger.category, 'mutable', headAfter) },
        unlockingBytecode: encodeDataPush(new Uint8Array([1])),
      },
      [USER_ID]: userInput(),
    },
    validator: {
      id: VALIDATOR_ID, covers: ['Ledger'],
      settles: [{ category: ledger.category, stateInputs: [HEAD_ID] }],
      redeemScript: validator.redeem,
    },
  };

  const { host, draft } = createComposedDerivationHost({
    vm: compositionMachine(), artifacts: [artifacts.Hub!, artifacts.Ledger!], plan,
  });
  // A call record carries no callee until the derivation resolves each site to the master it reaches, so the
  // composition is derived before any frame runs: the hub's own records name the three ledger frames.
  const derived = deriveComposition([rootOf('Hub', 'run', 'hub-1')], host);
  return { draft, derived, segments, nodeAfter, headAfter };
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

let driven: ReturnType<typeof drive> | undefined;

/** The composition, derived once: the cases that read it change nothing in it. */
function sharedDrive(): ReturnType<typeof drive> {
  driven ??= drive();
  return driven;
}

describe('one entry inserting, updating and deleting one key in one transaction', () => {
  it('publishes one call site per call, each naming its own method', () => {
    const { artifacts } = compileAndDeploy(SOURCE, { Hub: HUB_LABEL, Ledger: LEDGER_LABEL });
    const hub = readPublishedStopSites(artifacts.Hub!).entries
      .find((entry) => entry.functionName === entryName('Hub', 'run'))!;
    expect(hub.calls.map((call) => call.functionName)).toStrictEqual(['insert', 'update', 'remove']);
    expect(new Set(hub.calls.map((call) => call.selector)).size).toBe(3);
    expect(hub.sites.sites).toStrictEqual([
      { kind: 'call', site: 0, callIndex: 0, descriptor: 0 },
      { kind: 'call', site: 1, callIndex: 1, descriptor: 1 },
      { kind: 'call', site: 2, callIndex: 2, descriptor: 2 },
      { kind: 'segmentClose', site: 3, segmentIndex: 0 },
      { kind: 'segmentClose', site: 4, segmentIndex: 1 },
      { kind: 'segmentClose', site: 5, segmentIndex: 2 },
      { kind: 'segmentClose', site: 6, segmentIndex: 3 },
    ]);
    expect(artifacts.Ledger!.stateLayout?.mappings?.map((mapping) => `${mapping.name}:${mapping.sorted}`))
      .toStrictEqual(['records:true']);
  });

  it('lays the created node out: each later frame carries on from the view the one before it left', () => {
    const { segments, nodeAfter } = sharedDrive();
    const slot = keyToSlotMulti([KEY_PUSH]);

    // The insert relinks the head in place and creates the node at the adjacent output; the update and the delete
    // have no input to read the created node at, so they name that output and chain from the view before.
    expect(nodeAfter).toStrictEqual(node(slot, DEFAULT));
    expect(segments[0]).toStrictEqual<RecordEntry[]>([
      { in: HEAD_INDEX, out: HEAD_INDEX, viewIn: headSentinelCommitment(), viewOut: relinkedHead(slot) },
      { in: INDEX_NONE, out: CREATED_INDEX, viewIn: new Uint8Array(0), viewOut: node(slot, INSERTED) },
    ]);
    expect(segments[1]).toStrictEqual<RecordEntry[]>([
      { in: INDEX_NONE, out: CREATED_INDEX, viewIn: node(slot, INSERTED), viewOut: node(slot, UPDATED) },
    ]);
    expect(segments[2]).toStrictEqual<RecordEntry[]>([
      { in: INDEX_NONE, out: CREATED_INDEX, viewIn: node(slot, UPDATED), viewOut: node(slot, DEFAULT) },
    ]);
    // The chain links: each frame reads exactly what the frame before it wrote.
    expect(segments[1]![0]!.viewIn).toStrictEqual(segments[0]![1]!.viewOut);
    expect(segments[2]![0]!.viewIn).toStrictEqual(segments[1]![0]!.viewOut);
  });

  // The creating frame's head and node outputs are asserted, with every other frame's, by the whole lifecycle below.

  it('refuses a frame whose declared close is not the one its body computed', () => {
    // The control for the accepts below: each frame closes against the view its own segment declares, so a
    // declaration rewritten to a value no frame wrote is refused rather than resolved.
    const { draft } = drive();
    draft.blockOf('insert-1').segments[0]![1]!.viewOut = node(keyToSlotMulti([KEY_PUSH]), 99n);
    expect(verdictAt(draft, 'insert-1')).toBe('refused: Program failed an OP_VERIFY operation.');
    // Each frame closes against its own declaration, so update-1 accepts until its own one changes.
    expect(verdictAt(draft, 'update-1')).toBe('accepted');

    draft.blockOf('update-1').segments[0]![0]!.viewOut = node(keyToSlotMulti([KEY_PUSH]), 99n);
    expect(verdictAt(draft, 'update-1')).toBe('refused: Program failed an OP_VERIFY operation.');
  });

  it('settles the whole insert, update and delete lifecycle, every input accepting', () => {
    // The derivation resolves each of the hub's call records to the frame it reaches, and one transaction writes
    // two records: the head the insert relinks, and the node the insert creates and both later frames rewrite.
    // Each commitment is read back through the shipped sorted-list encoder, and each frame's own segment declares
    // the view it reads and the view it writes.
    const { draft, derived, nodeAfter, headAfter } = sharedDrive();
    const slot = keyToSlotMulti([KEY_PUSH]);
    const program = draft.programFor('hub-1');
    expect(derived.completed.map((frame) => frame.master))
      .toStrictEqual(['insert-1', 'update-1', 'remove-1', 'hub-1']);
    // Each call record names the frame the derivation resolved it to, in source order.
    expect(draft.blockOf('hub-1').calls.map((call) => call.calleeRef)).toStrictEqual([
      participant(draft.layout, 'insert-1').index,
      participant(draft.layout, 'update-1').index,
      participant(draft.layout, 'remove-1').index,
    ]);
    expect(program.transaction.outputs[HEAD_INDEX]!.token?.nft?.commitment).toStrictEqual(relinkedHead(slot));
    expect(program.transaction.outputs[CREATED_INDEX]!.token?.nft?.commitment).toStrictEqual(node(slot, DEFAULT));
    expect(nodeAfter).toStrictEqual(node(slot, DEFAULT));
    expect(headAfter).toStrictEqual(relinkedHead(slot));

    expect(draft.blockOf('insert-1').segments[0]![1]!.viewOut).toStrictEqual(node(slot, INSERTED));
    expect(draft.blockOf('update-1').segments[0]![0]!.viewOut).toStrictEqual(node(slot, UPDATED));
    expect(draft.blockOf('remove-1').segments[0]![0]!.viewOut).toStrictEqual(node(slot, DEFAULT));

    for (const id of ['hub-1', 'insert-1', 'update-1', 'remove-1', 'validator']) {
      expect(`${id}: ${verdictAt(draft, id)}`).toBe(`${id}: accepted`);
    }
  });
});
