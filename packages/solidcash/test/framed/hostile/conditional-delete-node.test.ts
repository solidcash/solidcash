import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2sh32, hash256 } from '@bitauth/libauth';
import {
  FrameKind, buildEntryNftCovenantScript, bytesToHex, computeCollectionHash, encodeChunkableValueTail,
  encodeIntegerValue, scriptToBytecode, type RecordEntry,
} from '@solidcash/utils';
import {
  MASTER_INDEX, created, declarationOf, deployFramedMaster, evaluateMasterSpend, head, node, spent,
  type DeployedMaster, type PlacedRecord,
} from '../../../../solidc/test/framed/master/record-spend.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { encodeFunctionArgument } from '../../../src/Argument.js';
import { createUnlockingBytecode } from '../../../src/utils.js';
import { bytesToSlotValue, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import {
  USER_LOCK, compileAndDeploy, composeAndDerive, entryName, hexOf, layoutWithFacets, master, masterInput, rootOf,
  seededAddress, selectorOf, token, userInput, userInputs, validatorFor, type ShapeOutcome,
} from '../shapes/harness.js';
import { participant, type CompositionDraftPlan, type DraftCall } from '../../../src/framed/composer/index.js';

/**
 * A sorted-mapping delete a branch guards, in a framed frame (audit DS-6).
 *
 * `if (c > 0) { delete tags[k]; }` is a one-target batch whose every target is conditional and a soft delete. Its
 * frame ran the batch transition and the delete's close only where the input at the slot's fixed offset from the
 * master carried the key's node, and that input is the spender's to place. With a plain input there neither ran,
 * the segment close left the batch's group to them, and settlement chains declared views to the transaction without
 * re-deriving the write: the node could be written back with its successor dropped, hiding the rest of the list, or
 * with a value the body did not leave. The frame now settles the delete at the node its group names, wherever it
 * sits. Each verdict is the BCH-2026 machine's on the master's own input.
 *
 * The delete then read and closed the node against the transaction's own input and output, so beside another frame
 * of the contract writing the node in the same transaction it refused an honest composition, and held the view it
 * declared for a later frame only on slot and successor. It now reads and closes against its declared views, as a
 * framed write does, and settlement chains them. Beside a write of the same collection the delete is one target of
 * a batch, and a group declaring the deleted key inserted is refused by that close. A write of a value that chunks
 * ahead of the delete is refused by name: where the keys meet and the delete does not run, it would be lost.
 *
 * A key the list does not hold has no node to clear: the group declares the node that brackets the key kept, and the
 * delete, taken or skipped, proves the key absent there and leaves the node as it was. Beside a write of its collection
 * the write's insert may relink that node, and no link may name the deleted key's slot, which no node carries.
 */

const encoder = new TextEncoder();
const slotOf = (key: Uint8Array): Uint8Array => keyToSlotMulti([key]);
/** The deleted key and the key after it in the list, in slot order. */
const [KEY_TEXT, NEXT_TEXT] = bytesToSlotValue(slotOf(encoder.encode('title')))
  < bytesToSlotValue(slotOf(encoder.encode('topic'))) ? ['title', 'topic'] as const : ['topic', 'title'] as const;
const KEY = encoder.encode(KEY_TEXT);
const SLOT = slotOf(KEY);
const NEXT = slotOf(encoder.encode(NEXT_TEXT));
const ZERO = new Uint8Array(32);
const TITLE = encodeChunkableValueTail(encoder.encode('first title'));
const CLEARED = encodeChunkableValueTail(new Uint8Array());
/** The key's node, linked to the next key's. */
const BEFORE = node(SLOT, NEXT, TITLE);
const DELETED = node(SLOT, NEXT, CLEARED);
const YES = encodeIntegerValue(1n);
const NO = encodeIntegerValue(0n);

const TAGS_BODY = ' contract Tags {'
  + '   mapping(string => string) tags;'
  + '   function remove(string k, int c) { if (c > 0) { delete this.tags[k]; } require(true); }'
  + ' }';
const TAGS = deployFramedMaster(`pragma solidcash ^0.14.0;${TAGS_BODY}`, 'framed conditional delete');
const LOCK = TAGS.collectionLock('tags');
const ENTRY_SLOT = TAGS.artifact.abi.find((fn) => fn.name === 'remove')!.blockLayout!.slots
  .find((slot) => slot.kind === 'entry')!;
/** The input the slot's fixed offset from the master names. */
const FIXED = MASTER_INDEX + ENTRY_SLOT.offset;

/** The master's verdict with the node spent at `at`, declared from `BEFORE` to `after`; inputs short of it are plain. */
const accepts = (c: Uint8Array, at: number, after: Uint8Array): boolean =>
  evaluateMasterSpend(TAGS, { args: [c, KEY], records: [spent(LOCK, at, BEFORE, after)] }).accepted;

describe('a framed delete a branch guards settles at the node its group names', () => {
  it('publishes the delete as a conditional soft-delete slot', () => {
    expect(ENTRY_SLOT.conditional).toBe(true);
    expect(ENTRY_SLOT.softDelete).toBe(true);
  });

  it('settles the delete and the skip with the node at the fixed offset', () => {
    expect(accepts(YES, FIXED, DELETED)).toBe(true);
    expect(accepts(NO, FIXED, BEFORE)).toBe(true);
  });

  it('refuses the node at the fixed offset written back with its successor dropped', () => {
    expect(accepts(YES, FIXED, node(SLOT, ZERO, CLEARED))).toBe(false);
    expect(accepts(NO, FIXED, node(SLOT, ZERO, TITLE))).toBe(false);
  });

  it('settles the delete and the skip with a plain input at the fixed offset and the node past it', () => {
    expect(accepts(YES, FIXED + 1, DELETED)).toBe(true);
    expect(accepts(NO, FIXED + 1, BEFORE)).toBe(true);
  });

  it('refuses the node past a plain input at the fixed offset written back with its successor dropped', () => {
    expect(accepts(YES, FIXED + 1, node(SLOT, ZERO, CLEARED))).toBe(false);
    expect(accepts(NO, FIXED + 1, node(SLOT, ZERO, TITLE))).toBe(false);
  });

  it('refuses the node past a plain input at the fixed offset declared at a value the body did not leave', () => {
    expect(accepts(YES, FIXED + 1, BEFORE)).toBe(false);
    expect(accepts(NO, FIXED + 1, DELETED)).toBe(false);
  });
});

const HUB_LABEL = 'framed conditional delete hub';
const TAGS_LABEL = 'framed conditional delete tags';
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ITags { function remove(string k, int c); }'
  + TAGS_BODY
  + ' contract Hub {'
  + `   function run() { ITags(0x${hexOf(seededAddress(TAGS_LABEL))}).remove("${KEY_TEXT}", 1); require(true); }`
  + ' }';

let removeDeployment: ReturnType<typeof compileAndDeploy> | undefined;

/** The Hub's `run`, calling `remove` of Tags, whose one record is the node spent at `before`, declared to `after`. */
function composeRemove(before: Uint8Array, after: Uint8Array): ShapeOutcome {
  const { artifacts, contracts } = (removeDeployment ??= compileAndDeploy(SOURCE, { Hub: HUB_LABEL, Tags: TAGS_LABEL }));
  const hub = contracts.Hub!;
  const tags = contracts.Tags!;
  const redeem = scriptToBytecode(buildEntryNftCovenantScript(
    tags.category, computeCollectionHash(artifacts.Tags!.stateLayout!.collections![0]!.signature),
  ));
  const entryLock = encodeLockingBytecodeP2sh32(hash256(redeem));
  const blocks: CompositionDraftPlan['blocks'] = [
    { contract: 'Hub', masters: ['hub-1'], validator: { id: 'validator', settles: [] }, state: [] },
    { contract: 'Tags', masters: ['tags-1'], state: ['node'] },
  ];
  const layout = layoutWithFacets(blocks);
  const nodeIndex = participant(layout, 'node').index;
  const record: RecordEntry = { in: nodeIndex, out: nodeIndex, viewIn: before, viewOut: after };
  const pushes = [selectorOf(artifacts, 'Tags', 'remove'), YES, KEY];
  const validator = validatorFor(hub.category);
  const nodeSource = {
    lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token(tags.category, 'mutable', before),
  };
  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: userInputs(['user'], layout.participantCount),
    masters: [
      master({
        master: 'hub-1', contract: 'Hub', entry: 'run', program: hub.program,
        facts: {
          contract: 'Hub', functionName: entryName('Hub', 'run'), kind: FrameKind.ROOT,
          callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
        },
        frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: hub.address, value: 0n },
        enteredBy: 'user', origin: 'user',
        calls: [{ kind: FrameKind.CALL, callee: 'tags-1', target: tags.address, value: 0n, argumentPushes: pushes }],
        segments: [[], []],
      }),
      master({
        master: 'tags-1', contract: 'Tags', entry: 'remove', program: tags.program,
        facts: {
          contract: 'Tags', functionName: entryName('Tags', 'remove'), kind: FrameKind.CALL,
          callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
        },
        frame: { kind: FrameKind.CALL, sender: hub.address, self: tags.address, value: 0n },
        enteredBy: 'hub-1', origin: 'user', argumentPushes: pushes, segments: [[record]], dispatches: true,
      }),
    ],
    inputs: {
      'hub-1': { source: masterInput(hub) },
      'tags-1': { source: masterInput(tags) },
      validator: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(hub.category, 'mutable') },
      },
      node: {
        source: nodeSource,
        output: { ...nodeSource, token: token(tags.category, 'mutable', after) },
        // The entry covenant's write path: `<masterInputIndex> <flag 1>`.
        unlockingBytecode: createUnlockingBytecode('p2sh32', redeem, [
          encodeFunctionArgument(1n, 'bigint') as Uint8Array,
          encodeFunctionArgument(BigInt(participant(layout, 'tags-1').index), 'bigint') as Uint8Array,
        ]),
      },
      user: userInput(),
    },
    validator: { id: 'validator', covers: ['Tags'], settles: [], redeemScript: validator.redeem },
  };
  return composeAndDerive(plan, [artifacts.Hub!, artifacts.Tags!], [rootOf('Hub', 'run', 'hub-1')]);
}

describe('a framed delete a branch guards, called through a composition', () => {
  it('settles the delete: every contract input is accepted and the node carries the default', () => {
    const outcome = composeRemove(BEFORE, DELETED);
    expect(refusalsOf(outcome)).toStrictEqual([]);
    expect(nodeOutput(outcome)).toBe(bytesToHex(DELETED));
  });

  it('settles the delete of a key the list does not hold: the head that brackets it is kept', () => {
    const outcome = composeRemove(head(NEXT), head(NEXT));
    expect(refusalsOf(outcome)).toStrictEqual([]);
    expect(nodeOutput(outcome)).toBe(bytesToHex(head(NEXT)));
  });
});

/** The node holding `text`, linked to the next key's. */
const holding = (text: string): Uint8Array => node(SLOT, NEXT, encodeChunkableValueTail(encoder.encode(text)));

const PAIR_HUB_LABEL = 'framed conditional delete pair hub';
const PAIR_TAGS_LABEL = 'framed conditional delete pair tags';
const PAIR_TAGS = hexOf(seededAddress(PAIR_TAGS_LABEL));
const PAIR_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ITags { function put(string k, string v); function remove(string k, int c); }'
  + ' contract Tags {'
  + '   mapping(string => string) tags;'
  + '   function put(string k, string v) { this.tags[k] = v; require(true); }'
  + '   function remove(string k, int c) { if (c > 0) { delete this.tags[k]; } require(true); }'
  + ' }'
  + ' contract Hub {'
  + `   function putThenRemove(string v, int c) { ITags(0x${PAIR_TAGS}).put("${KEY_TEXT}", v);`
  + `     ITags(0x${PAIR_TAGS}).remove("${KEY_TEXT}", c); require(true); }`
  + `   function removeThenPut(string v) { ITags(0x${PAIR_TAGS}).remove("${KEY_TEXT}", 1);`
  + `     ITags(0x${PAIR_TAGS}).put("${KEY_TEXT}", v); require(true); }`
  + ' }';

let pairDeployment: ReturnType<typeof compileAndDeploy> | undefined;
const deployedPair = (): ReturnType<typeof compileAndDeploy> =>
  (pairDeployment ??= compileAndDeploy(PAIR_SOURCE, { Hub: PAIR_HUB_LABEL, Tags: PAIR_TAGS_LABEL }));

type Views = Pick<RecordEntry, 'viewIn' | 'viewOut'>;

/** One run of the Hub: its entry, the value `put` writes, `c`, and the views each Tags frame declares. */
interface PairRun {
  readonly entry: 'putThenRemove' | 'removeThenPut';
  readonly value: string;
  readonly c: bigint;
  readonly put: Views;
  readonly remove: Views;
}

/** The honest run: each frame declares the node as the frame before it left it. */
function honestRun(entry: PairRun['entry'], value: string, c = 1n): PairRun {
  const written = holding(value);
  if (entry === 'removeThenPut') {
    return { entry, value, c: 1n, remove: { viewIn: BEFORE, viewOut: DELETED }, put: { viewIn: DELETED, viewOut: written } };
  }
  const removed = c > 0n ? DELETED : written;
  return { entry, value, c, put: { viewIn: BEFORE, viewOut: written }, remove: { viewIn: written, viewOut: removed } };
}

/**
 * The Hub calls `put` and `remove` of Tags in the run's order, so Tags runs on two masters and the validator the Hub
 * owns (V9: the root's category) settles the node: one record each frame declares, chained from the input to the
 * output in the order the frames run.
 */
function composePair(run: PairRun): ShapeOutcome {
  const { artifacts, contracts } = deployedPair();
  const hub = contracts.Hub!;
  const tags = contracts.Tags!;
  const redeem = scriptToBytecode(buildEntryNftCovenantScript(
    tags.category, computeCollectionHash(artifacts.Tags!.stateLayout!.collections![0]!.signature),
  ));
  const entryLock = encodeLockingBytecodeP2sh32(hash256(redeem));
  const blocks: CompositionDraftPlan['blocks'] = [
    { contract: 'Hub', masters: ['hub-1'], validator: { id: 'validator', settles: [] }, state: [] },
    { contract: 'Tags', masters: ['put-1', 'remove-1'], state: ['node'] },
  ];
  const layout = layoutWithFacets(blocks);
  const nodeIndex = participant(layout, 'node').index;
  const putFirst = run.entry === 'putThenRemove';
  const value = encoder.encode(run.value);
  const putPushes = [selectorOf(artifacts, 'Tags', 'put'), value, KEY];
  const removePushes = [selectorOf(artifacts, 'Tags', 'remove'), encodeIntegerValue(run.c), KEY];
  const call = (callee: string, argumentPushes: Uint8Array[]): DraftCall => ({
    kind: FrameKind.CALL, callee, target: tags.address, value: 0n, argumentPushes,
  });
  const tagsMaster = (
    id: string, entry: 'put' | 'remove', pushes: Uint8Array[], views: Views,
  ): ReturnType<typeof master> => master({
    master: id, contract: 'Tags', entry, program: tags.program,
    facts: {
      contract: 'Tags', functionName: entryName('Tags', entry), kind: FrameKind.CALL,
      callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 2,
    },
    frame: { kind: FrameKind.CALL, sender: hub.address, self: tags.address, value: 0n },
    enteredBy: 'hub-1', origin: 'user', argumentPushes: pushes, dispatches: true,
    segments: [[{ in: nodeIndex, out: nodeIndex, ...views }]],
  });
  const validator = validatorFor(hub.category);
  const nodeSource = {
    lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token(tags.category, 'mutable', BEFORE),
  };
  const last = putFirst ? run.remove.viewOut : run.put.viewOut;
  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: userInputs(['user'], layout.participantCount),
    masters: [
      master({
        master: 'hub-1', contract: 'Hub', entry: run.entry, program: hub.program,
        facts: {
          contract: 'Hub', functionName: entryName('Hub', run.entry), kind: FrameKind.ROOT,
          callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
        },
        frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: hub.address, value: 0n },
        enteredBy: 'user', origin: 'user', dispatches: true,
        argumentPushes: [
          selectorOf(artifacts, 'Hub', run.entry), ...(putFirst ? [encodeIntegerValue(run.c)] : []), value,
        ],
        calls: putFirst
          ? [call('put-1', putPushes), call('remove-1', removePushes)]
          : [call('remove-1', removePushes), call('put-1', putPushes)],
      }),
      tagsMaster('put-1', 'put', putPushes, run.put),
      tagsMaster('remove-1', 'remove', removePushes, run.remove),
    ],
    inputs: {
      'hub-1': { source: masterInput(hub) },
      'put-1': { source: masterInput(tags) },
      'remove-1': { source: masterInput(tags) },
      validator: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(hub.category, 'mutable') },
      },
      node: {
        source: nodeSource,
        output: { ...nodeSource, token: token(tags.category, 'mutable', last) },
        // The entry covenant's write path: `<masterInputIndex> <flag 1>`.
        unlockingBytecode: createUnlockingBytecode('p2sh32', redeem, [
          encodeFunctionArgument(1n, 'bigint') as Uint8Array,
          encodeFunctionArgument(BigInt(participant(layout, 'put-1').index), 'bigint') as Uint8Array,
        ]),
      },
      user: userInput(),
    },
    validator: {
      id: 'validator', covers: ['Tags'], settles: [{ category: tags.category, stateInputs: ['node'] }],
      redeemScript: validator.redeem,
    },
  };
  return composeAndDerive(plan, [artifacts.Hub!, artifacts.Tags!], [rootOf('Hub', run.entry, 'hub-1')]);
}

/** The participants whose own input the machine refuses in the draft's transaction as it stands. */
function refusing(draft: ShapeOutcome['draft']): string[] {
  const program = draft.programFor('hub-1');
  const vm = compositionMachine();
  return draft.layout.participants.flatMap((placed) => {
    const state = vm.evaluate({
      inputIndex: placed.index, sourceOutputs: program.sourceOutputs, transaction: program.transaction,
    });
    return vm.stateSuccess(state) === true ? [] : [placed.id];
  });
}

/** Replaces the views the frame's one record declares. */
function redeclare(draft: ShapeOutcome['draft'], id: string, views: Partial<Views>): void {
  const block = draft.blockOf(id);
  block.segments[0] = [{ ...block.segments[0]![0]!, ...views }];
}

/** The commitment the transaction leaves on the node. */
const nodeOutput = (outcome: ShapeOutcome): string => {
  const index = participant(outcome.draft.layout, 'node').index;
  return bytesToHex(outcome.transaction.outputs[index]!.token!.nft!.commitment);
};

const refusalsOf = (outcome: ShapeOutcome): string[] => outcome.verdicts.filter((verdict) => !verdict.accepted)
  .map((verdict) => `${verdict.participant}: ${verdict.objection}`);

describe('a framed delete a branch guards, beside another frame of its contract writing the node', () => {
  it('settles the delete after an earlier frame rewrote the node: the node ends at the default', () => {
    const outcome = composePair(honestRun('putThenRemove', 'kept title'));
    expect(refusalsOf(outcome)).toStrictEqual([]);
    expect(nodeOutput(outcome)).toBe(bytesToHex(DELETED));
  });

  it('settles the skip after an earlier frame rewrote the node: the node keeps that frame\'s value', () => {
    const outcome = composePair(honestRun('putThenRemove', 'kept title', 0n));
    expect(refusalsOf(outcome)).toStrictEqual([]);
    expect(nodeOutput(outcome)).toBe(bytesToHex(holding('kept title')));
  });

  it('settles a later frame\'s write over the deleted node: the node ends at that frame\'s value', () => {
    const outcome = composePair(honestRun('removeThenPut', 'new title'));
    expect(refusalsOf(outcome)).toStrictEqual([]);
    expect(nodeOutput(outcome)).toBe(bytesToHex(holding('new title')));
  });

  it('refuses the delete frame declaring the node at a view the earlier frame did not leave', () => {
    // The frame is consistent with its own declaration; settlement holds it to the earlier frame's output.
    const { draft } = composePair(honestRun('putThenRemove', 'kept title'));
    redeclare(draft, 'remove-1', { viewIn: BEFORE });
    const refused = refusing(draft);
    expect(refused.length).toBeGreaterThan(0);
    expect(refused.filter((id) => !id.startsWith('validator'))).toStrictEqual([]);
  });

  it('refuses the delete frame leaving the node uncleared for a later frame that clears it', () => {
    // Each view chains, and the transaction ends at the default, but the delete frame's own end view is not it.
    const outcome = composePair(honestRun('removeThenPut', ''));
    expect(refusalsOf(outcome)).toStrictEqual([]);
    redeclare(outcome.draft, 'remove-1', { viewOut: BEFORE });
    redeclare(outcome.draft, 'put-1', { viewIn: BEFORE });
    expect(refusing(outcome.draft)).toStrictEqual(['remove-1']);
  });
});

/** Three keys in slot order: a predecessor, the key `edit` deletes, and the key it writes. */
const [LOW, MID, HIGH] = ['alpha', 'gamma', 'omega'].map((text) => encoder.encode(text)).sort((left, right) => {
  const [a, b] = [bytesToSlotValue(slotOf(left)), bytesToSlotValue(slotOf(right))];
  return a < b ? -1 : a > b ? 1 : 0;
}) as [Uint8Array, Uint8Array, Uint8Array];
const SLOT_LOW = slotOf(LOW);
const SLOT_MID = slotOf(MID);
const SLOT_HIGH = slotOf(HIGH);
const OLD = encodeChunkableValueTail(encoder.encode('old'));
const WRITTEN = encodeChunkableValueTail(encoder.encode('written'));

/** `edit`'s write precedes a guarded delete of its collection: a swap-remove alias of a value that chunks. */
const EDIT = 'pragma solidcash ^0.14.0;'
  + ' contract Tags {'
  + '   mapping(string => string) tags;'
  + '   function edit(string a, string v, string k, int c) {'
  + '     this.tags[a] = v; if (c > 0) { delete this.tags[k]; } require(true);'
  + '   }'
  + ' }';

/** The parameter naming each target of `entry`, in the order its frame declares their groups: the targets' slots. */
const targetKeys = (deployed: DeployedMaster, entry: string): string[] => deployed.artifact.abi
  .find((fn) => fn.name === entry)!.entryAccesses!
  .filter((access) => access.operations.includes('write') || access.operations.includes('delete'))
  .sort((left, right) => left.slotIndex! - right.slotIndex!)
  .map((access) => access.keyParams[0]!);

/** The master's verdict on `tidy(HIGH, "written", MID, c)`, each target's group of records declared in frame order. */
const tidies = (c: Uint8Array, groups: Readonly<Record<string, readonly PlacedRecord[]>>): boolean =>
  evaluateMasterSpend(tidyMaster(), {
    args: [c, MID, encoder.encode('written'), HIGH],
    records: targetKeys(tidyMaster(), 'tidy').flatMap((key) => groups[key] ?? []),
  }).accepted;

describe('a framed delete a branch guards, in one batch beside a write of its collection', () => {
  const lock = (): Uint8Array => tidyMaster().collectionLock('tags');
  /** HIGH's node, the list's last, which the write rewrites in place. */
  const write = (): PlacedRecord => spent(lock(), 3, node(SLOT_HIGH, ZERO, OLD), node(SLOT_HIGH, ZERO, WRITTEN));

  it('refuses by name a write of a value that chunks ahead of the delete, which it could not land on', () => {
    // Where the keys meet and the delete does not run, the write would be lost.
    expect(compileStringMulti(EDIT, { composition: 'framed' }).Tags!.composition?.refusedEntries)
      .toStrictEqual([{ functionName: 'Tags.edit()', reason: expect.stringContaining('the write would be lost') }]);
  });

  it('declares the write and the delete as the batch\'s two targets', () => {
    expect([...targetKeys(tidyMaster(), 'tidy')].sort()).toStrictEqual(['a', 'k']);
  });

  it('settles the delete and the skip with the deleted key\'s node rewritten in place', () => {
    // The list `MID -> HIGH`: the delete clears MID's node where it runs and keeps it where it does not.
    const mid = node(SLOT_MID, SLOT_HIGH, OLD);
    expect(tidies(YES, { a: [write()], k: [spent(lock(), 2, mid, node(SLOT_MID, SLOT_HIGH, CLEARED))] })).toBe(true);
    expect(tidies(NO, { a: [write()], k: [spent(lock(), 2, mid)] })).toBe(true);
  });

  it('refuses the deleted key\'s group declared as an insert: its predecessor relinked to a created node', () => {
    // The list `LOW -> HIGH` holds no node for MID. The group relinks LOW to MID beside MID's node created at the
    // default, which no write binds: the delete's close finds LOW's node where it ends MID's, cleared or kept.
    const low = spent(lock(), 2, node(SLOT_LOW, SLOT_HIGH, OLD), node(SLOT_LOW, SLOT_MID, OLD));
    const inserted = created(lock(), 4, node(SLOT_MID, SLOT_HIGH, CLEARED));
    expect(tidies(YES, { a: [write()], k: [low, inserted] })).toBe(false);
    expect(tidies(NO, { a: [write()], k: [low, inserted] })).toBe(false);
  });
});

/** The master's verdict on `remove(MID, c)`, its group's records as declared: the list holds LOW and HIGH. */
const removes = (c: Uint8Array, records: readonly PlacedRecord[]): boolean =>
  evaluateMasterSpend(TAGS, { args: [c, MID], records }).accepted;

/** LOW's node, linked to `next`. */
const lowNode = (next: Uint8Array, tail: Uint8Array = OLD): Uint8Array => node(SLOT_LOW, next, tail);

describe('a framed delete a branch guards, of a key the list does not hold', () => {
  it('settles the delete and the skip with the kept node that brackets the key', () => {
    // LOW before HIGH, LOW the tail, and the head before HIGH: each is the node the key would follow.
    for (const bracket of [lowNode(SLOT_HIGH), lowNode(ZERO), head(SLOT_HIGH)]) {
      expect(removes(YES, [spent(LOCK, FIXED, bracket)])).toBe(true);
      expect(removes(NO, [spent(LOCK, FIXED, bracket)])).toBe(true);
    }
  });

  it('refuses a kept node that does not bracket the key', () => {
    // HIGH's node sits past the key; the head, with LOW between it and the key, links short of it.
    for (const other of [node(SLOT_HIGH, ZERO, OLD), head(SLOT_LOW)]) {
      expect(removes(YES, [spent(LOCK, FIXED, other)])).toBe(false);
      expect(removes(NO, [spent(LOCK, FIXED, other)])).toBe(false);
    }
  });

  it('refuses the node that brackets the key written back with its successor dropped or a value changed', () => {
    for (const after of [lowNode(ZERO), lowNode(SLOT_HIGH, CLEARED)]) {
      expect(removes(YES, [spent(LOCK, FIXED, lowNode(SLOT_HIGH), after)])).toBe(false);
      expect(removes(NO, [spent(LOCK, FIXED, lowNode(SLOT_HIGH), after)])).toBe(false);
    }
  });

  it('refuses the key\'s group declared as an insert: the bracketing node relinked to a created node', () => {
    const relinked = spent(LOCK, FIXED, lowNode(SLOT_HIGH), lowNode(SLOT_MID));
    const inserted = created(LOCK, FIXED + 1, node(SLOT_MID, SLOT_HIGH, CLEARED));
    expect(removes(YES, [relinked, inserted])).toBe(false);
    expect(removes(NO, [relinked, inserted])).toBe(false);
  });
});

/**
 * `edit` with the delete ahead of the write. `edit`'s write precedes a delete of its collection, so it is a swap-remove
 * alias, refused for a value that chunks; this one is not, and may insert its key.
 */
let tidyDeployment: DeployedMaster | undefined;
const tidyMaster = (): DeployedMaster => (tidyDeployment ??= deployFramedMaster('pragma solidcash ^0.14.0;'
  + ' contract Tags {'
  + '   mapping(string => string) tags;'
  + '   function tidy(string a, string v, string k, int c) {'
  + '     if (c > 0) { delete this.tags[k]; } this.tags[a] = v; require(true);'
  + '   }'
  + ' }', 'framed conditional delete ahead of a write'));

/** The records a spend lays the transaction out with, and the segment its frame declares. */
interface DeclaredSpend { readonly records: PlacedRecord[]; readonly declared: RecordEntry[] }

/** The master's verdicts on `(HIGH, "written", MID, c)`, its entry's one, with the delete taken, then skipped. */
const verdicts = (deployed: DeployedMaster, spend: DeclaredSpend): boolean[] => [YES, NO].map((c) =>
  evaluateMasterSpend(deployed, { args: [c, MID, encoder.encode('written'), HIGH], ...spend }).accepted);

/**
 * `tidy`'s write inserting HIGH after `bracket`, the list's last node, which brackets MID too: the write's group relinks
 * it to `link` beside HIGH's created node, and the delete's keeps it as the group before it left it.
 */
const insertBeside = (bracket: (next: Uint8Array) => Uint8Array, link: Uint8Array): DeclaredSpend => {
  const lock = tidyMaster().collectionLock('tags');
  const relinked = bracket(link);
  const inserted = node(SLOT_HIGH, ZERO, WRITTEN);
  const declared: RecordEntry[] = [];
  let current = bracket(ZERO);
  for (const key of targetKeys(tidyMaster(), 'tidy')) {
    if (key === 'k') {
      declared.push({ in: 2, out: 2, viewIn: current, viewOut: current });
      continue;
    }
    declared.push({ in: 2, out: 2, viewIn: current, viewOut: relinked });
    declared.push({ in: 0xffff, out: 3, viewIn: new Uint8Array(), viewOut: inserted });
    current = relinked;
  }
  return { records: [spent(lock, 2, bracket(ZERO), relinked), created(lock, 3, inserted)], declared };
};

describe('a framed delete a branch guards, of a key the list does not hold, beside a write of its collection', () => {
  /** HIGH's node, the list's last, which the write rewrites in place. */
  const write = (deployed: DeployedMaster): PlacedRecord => spent(deployed.collectionLock('tags'), 3,
    node(SLOT_HIGH, ZERO, OLD), node(SLOT_HIGH, ZERO, WRITTEN));
  /** The entry's groups as the records declare them, `a`'s the write's and `k`'s the delete's. */
  const groups = (
    deployed: DeployedMaster, entry: string, a: readonly PlacedRecord[], k: readonly PlacedRecord[],
  ): DeclaredSpend => {
    const records = targetKeys(deployed, entry).flatMap((key) => (key === 'a' ? a : k));
    return { records, declared: declarationOf(records) };
  };
  const edited = (k: Uint8Array): DeclaredSpend => groups(tidyMaster(), 'tidy', [write(tidyMaster())],
    [spent(tidyMaster().collectionLock('tags'), 2, k)]);

  it('settles the delete and the skip with the bracketing node kept beside the write\'s update', () => {
    // The list `LOW -> HIGH` holds no node for MID: LOW brackets it.
    expect(verdicts(tidyMaster(), edited(lowNode(SLOT_HIGH)))).toStrictEqual([true, true]);
  });

  it('settles the delete and the skip with the bracketing node the write\'s insert relinks', () => {
    // LOW as the list's last, or the empty list's head, brackets both MID and HIGH, which the write splices in.
    expect(verdicts(tidyMaster(), insertBeside((next) => lowNode(next), SLOT_HIGH))).toStrictEqual([true, true]);
    expect(verdicts(tidyMaster(), insertBeside((next) => head(next), SLOT_HIGH))).toStrictEqual([true, true]);
  });

  it('refuses -2 at the delete, outside the skippable writes, where the kept node does not bracket the key', () => {
    // MID held after LOW, its group declared as LOW kept; MID absent and the head kept with LOW between them.
    for (const other of [lowNode(SLOT_MID), head(SLOT_LOW)]) {
      expect(verdicts(tidyMaster(), edited(other))).toStrictEqual([false, false]);
    }
  });

  it('refuses -2 at the write, which the derivation never reads as skipped: its group one kept record', () => {
    // LOW, the list's last, kept by both groups: a skipped write's shape, at a write neither guarded nor an alias.
    const kept = spent(tidyMaster().collectionLock('tags'), 2, lowNode(ZERO));
    expect(verdicts(tidyMaster(), groups(tidyMaster(), 'tidy', [kept], [kept]))).toStrictEqual([false, false]);
  });

  it('refuses a link to the deleted key\'s slot, which no node carries', () => {
    // LOW relinked to MID for HIGH's insert, which leaves HIGH's node unreachable.
    expect(verdicts(tidyMaster(), insertBeside((next) => lowNode(next), SLOT_MID))).toStrictEqual([false, false]);
  });
});
