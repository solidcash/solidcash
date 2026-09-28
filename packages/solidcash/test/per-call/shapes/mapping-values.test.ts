import { describe, expect, it } from 'vitest';
import {
  FrameKind,
  INDEX_NONE,
  buildEntryNftCovenantScript,
  bytesToHex,
  computeCollectionHash,
  encodeChunkableValueTail,
  scriptToBytecode,
  sha256,
  type RecordEntry,
} from '@solidcash/utils';
import { publishedRefusals } from '../../../../solidc/test/per-call/master/refused-entry.js';
import { encodeFunctionArgument } from '../../../src/Argument.js';
import { createUnlockingBytecode, scriptToLockingBytecode } from '../../../src/utils.js';
import {
  bytesToSlotValue,
  decodeEntryCommitment,
  encodeEntryCommitment,
  headSentinelCommitment,
  keyToSlotMulti,
} from '../../../src/stateful/SortedList.js';
import {
  composeAndDerive,
  compileAndDeploy,
  entryName,
  hexOf,
  master,
  masterInput,
  rootOf,
  seededAddress,
  selectorOf,
  token,
  userInput,
  userInputs,
  validatorFor,
  USER_LOCK,
  type DeployedContract,
} from './harness.js';
import {
  layoutTransaction,
  participant,
  planMappingWrite,
  type CompositionDraftPlan,
  type DraftMaster,
} from '../../../src/per-call/composer/index.js';

/**
 * A `mapping(string => string)` set, a long value read from the frame's witness block, and an initializer's inserts.
 *
 * A node's value tail holds a value of at most 60 bytes inline and a longer one as its hash, so a body reading a
 * long value takes the value itself from the value list its frame's block carries and checks it against that hash.
 * A body that only writes reads nothing, so its value slot stays empty. Each case is a hub calling the entry
 * through an interface, the mapping's nodes spent as entry UTXOs, and the BCH-2026 machine asked about every input.
 */

const encoder = new TextEncoder();
const KEY = encoder.encode('title');
const FIRST = encoder.encode('first title');
const SECOND = encoder.encode('second title');
/** Past the 60 bytes a node's tail holds inline, so the tail carries the value's hash. */
const LONG = encoder.encode('a note long enough that the node keeps only its hash and the reader brings the value itself');
/** The same length with its last byte changed, so only the hash can tell the two apart. */
const FORGED = Uint8Array.from(LONG, (byte, index) => (index === LONG.length - 1 ? byte ^ 1 : byte));
const ZERO_SLOT = new Uint8Array(32);
const SLOT = keyToSlotMulti([KEY]);

const TAGS_ADDRESS = seededAddress('mapping values tags');
const NOTES_ADDRESS = seededAddress('mapping values notes');
const REGISTRY_ADDRESS = seededAddress('mapping values registry');
/** Two keys an initializer writes in one frame, each with a short value. */
const INITIAL = [
  { key: encoder.encode('DA'), value: encoder.encode('DIGITAL_AUDIO') },
  { key: encoder.encode('DV'), value: encoder.encode('DIGITAL_VIDEO') },
];
const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface ITags { function put(string k, string v); }'
  + ' interface INotes { function check(string k, string v); }'
  + ' contract Tags {'
  + '   mapping(string => string) tags;'
  + '   function put(string k, string v) { this.tags[k] = v; require(true); }'
  + ' }'
  + ' contract Notes {'
  + '   mapping(string => string) notes;'
  + '   function check(string k, string v) { require(this.notes[k] == v); }'
  + ' }'
  + ' contract SetHub {'
  + `   function run() { ITags(0x${hexOf(TAGS_ADDRESS)}).put("${text(KEY)}", "${text(SECOND)}"); require(true); }`
  + ' }'
  + ' contract ReadHub {'
  + `   function run() { INotes(0x${hexOf(NOTES_ADDRESS)}).check("${text(KEY)}", "${text(LONG)}"); require(true); }`
  + ' }'
  + ' interface IRegistry { function init(); }'
  + ' contract Registry {'
  + '   mapping(string => string) tags;'
  + `   function init() { ${INITIAL.map(({ key, value }) => `this.tags["${text(key)}"] = "${text(value)}";`).join(' ')}`
  + '     require(true); }'
  + ' }'
  + ' contract InitHub {'
  + `   function run() { IRegistry(0x${hexOf(REGISTRY_ADDRESS)}).init(); require(true); }`
  + ' }';

const { artifacts, contracts } = compileAndDeploy(SOURCE, {
  SetHub: 'mapping values set hub', ReadHub: 'mapping values read hub', InitHub: 'mapping values init hub',
  Tags: 'mapping values tags', Notes: 'mapping values notes', Registry: 'mapping values registry',
});

const HUB_MASTER = 'hub-1';
const ENTRY_MASTER = 'entry-1';
const NODE_ID = 'node';
const VALIDATOR_ID = 'validator';
const USER_ID = 'user';

/** The node a frame spends at its entry covenant, unlocked on the write path its master authorizes. */
function nodeInput(contract: DeployedContract, contractName: string, before: Uint8Array, after: Uint8Array,
  masterIndex: number): CompositionDraftPlan['inputs'][string] {
  const collection = artifacts[contractName]!.stateLayout!.collections![0]!;
  const redeem = scriptToBytecode(
    buildEntryNftCovenantScript(contract.category, computeCollectionHash(collection.signature)),
  );
  const source = {
    lockingBytecode: scriptToLockingBytecode(redeem, 'p2sh32'), valueSatoshis: 20_000n,
    token: token(contract.category, 'mutable', before),
  };
  return {
    source,
    output: { ...source, token: token(contract.category, 'mutable', after) },
    unlockingBytecode: createUnlockingBytecode('p2sh32', redeem, [
      encodeFunctionArgument(1n, 'bigint') as Uint8Array,
      encodeFunctionArgument(BigInt(masterIndex), 'bigint') as Uint8Array,
    ]),
  };
}

interface Shape {
  readonly hub: string;
  readonly entryContract: string;
  readonly entry: string;
  readonly argumentPushes: readonly Uint8Array[];
  readonly before: Uint8Array;
  readonly after: Uint8Array;
  readonly values?: readonly Uint8Array[];
}

/** A hub calling the entry, the validator settling the entry's contract, and the node the entry touches. */
function buildPlan(shape: Shape): { readonly plan: CompositionDraftPlan; readonly nodeIndex: number } {
  const hub = contracts[shape.hub]!;
  const entryContract = contracts[shape.entryContract]!;
  const blocks: CompositionDraftPlan['blocks'] = [
    { contract: shape.hub, masters: [HUB_MASTER], validator: { id: VALIDATOR_ID, settles: [] }, state: [] },
    { contract: shape.entryContract, masters: [ENTRY_MASTER], state: [NODE_ID] },
  ];
  const layout = layoutTransaction(blocks);
  const nodeIndex = participant(layout, NODE_ID).index;
  const record: RecordEntry = { in: nodeIndex, out: nodeIndex, viewIn: shape.before, viewOut: shape.after };
  const selector = selectorOf(artifacts, shape.entryContract, shape.entry);
  const validator = validatorFor(hub.category);

  const hubMaster: DraftMaster = master({
    master: HUB_MASTER, contract: shape.hub, entry: 'run', program: hub.program,
    facts: {
      contract: shape.hub, functionName: entryName(shape.hub, 'run'), kind: FrameKind.ROOT,
      callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: hub.address, value: 0n },
    enteredBy: USER_ID, origin: USER_ID,
    calls: [{
      kind: FrameKind.CALL, callee: ENTRY_MASTER, target: entryContract.address, value: 0n,
      argumentPushes: [selector, ...shape.argumentPushes],
    }],
    segments: [[], []],
  });
  const entryMaster: DraftMaster = {
    ...master({
      master: ENTRY_MASTER, contract: shape.entryContract, entry: shape.entry, program: entryContract.program,
      facts: {
        contract: shape.entryContract, functionName: entryName(shape.entryContract, shape.entry),
        kind: FrameKind.CALL, callerIsUser: false, originEqualsCaller: false, makesExternalCall: false,
        mastersOfContract: 1,
      },
      frame: { kind: FrameKind.CALL, sender: hub.address, self: entryContract.address, value: 0n },
      enteredBy: HUB_MASTER, origin: USER_ID,
      argumentPushes: [selector, ...shape.argumentPushes],
      segments: [[record]],
      dispatches: true,
    }),
    ...(shape.values === undefined ? {} : { values: shape.values }),
  };

  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: userInputs([USER_ID], layout.participantCount),
    masters: [hubMaster, entryMaster],
    inputs: {
      [HUB_MASTER]: { source: masterInput(hub) },
      [ENTRY_MASTER]: { source: masterInput(entryContract) },
      [VALIDATOR_ID]: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(hub.category, 'mutable') },
      },
      [NODE_ID]: nodeInput(entryContract, shape.entryContract, shape.before, shape.after,
        participant(layout, ENTRY_MASTER).index),
      [USER_ID]: userInput(),
    },
    validator: {
      id: VALIDATOR_ID, covers: [shape.entryContract],
      settles: [{ category: entryContract.category, stateInputs: [NODE_ID] }],
      redeemScript: validator.redeem,
    },
  };
  return { plan, nodeIndex };
}

/** The machine's objections, one per refused input. */
function refused(outcome: ReturnType<typeof composeAndDerive>): string[] {
  return outcome.verdicts.filter((verdict) => !verdict.accepted)
    .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
}

describe('a string-keyed string mapping set', () => {
  const before = encodeEntryCommitment(SLOT, ZERO_SLOT, encodeChunkableValueTail(FIRST));
  const written = planMappingWrite({
    keys: [KEY], value: SECOND, inventory: [before], encodeValue: encodeChunkableValueTail,
  }).written[0]!;
  // Call data carries the arguments last parameter first.
  const shape = (after: Uint8Array): Shape => ({
    hub: 'SetHub', entryContract: 'Tags', entry: 'put', argumentPushes: [SECOND, KEY], before, after,
  });

  it('is served: no refusal is published and the entry takes only its key and value', () => {
    expect(publishedRefusals(artifacts)).toStrictEqual([]);
    expect(artifacts.Tags!.abi.find((entry) => entry.name === 'put')!.inputs.map((input) => input.name))
      .toStrictEqual(['k', 'v']);
  });

  it('settles: the node carries the value the body wrote, and every contract input is accepted', () => {
    const built = buildPlan(shape(written.after));
    const outcome = composeAndDerive(built.plan, [artifacts.SetHub!, artifacts.Tags!], [rootOf('SetHub', 'run', HUB_MASTER)]);
    expect(outcome.completed.map((frame) => frame.functionName))
      .toStrictEqual([entryName('Tags', 'put'), entryName('SetHub', 'run')]);
    expect(refused(outcome)).toStrictEqual([]);
    const commitment = outcome.transaction.outputs[built.nodeIndex]!.token!.nft!.commitment;
    expect(bytesToHex(commitment))
      .toBe(bytesToHex(encodeEntryCommitment(SLOT, ZERO_SLOT, encodeChunkableValueTail(SECOND))));
  });

  it('refuses a close the body did not compute', () => {
    const built = buildPlan(shape(encodeEntryCommitment(SLOT, ZERO_SLOT, encodeChunkableValueTail(FIRST))));
    expect(() => composeAndDerive(built.plan, [artifacts.SetHub!, artifacts.Tags!], [rootOf('SetHub', 'run', HUB_MASTER)]))
      .toThrow('PER_CALL_DERIVATION_STALLED: master "entry-1" of Tags.put()');
  });
});

describe('a long mapping value read from the frame\'s block', () => {
  const node = encodeEntryCommitment(SLOT, ZERO_SLOT, encodeChunkableValueTail(LONG));
  const shape = (values?: readonly Uint8Array[]): Shape => ({
    hub: 'ReadHub', entryContract: 'Notes', entry: 'check', argumentPushes: [LONG, KEY], before: node, after: node,
    ...(values === undefined ? {} : { values }),
  });
  const compose = (values?: readonly Uint8Array[]): ReturnType<typeof composeAndDerive> => composeAndDerive(
    buildPlan(shape(values)).plan, [artifacts.ReadHub!, artifacts.Notes!], [rootOf('ReadHub', 'run', HUB_MASTER)],
  );

  /** The read's own frame stops at the close of its one segment when the value it reads is not the one hashed. */
  const STALL = 'PER_CALL_DERIVATION_STALLED: master "entry-1" of Notes.check() filled no witness at site 0 '
    + '(close of segment 0)';

  it('keeps the value out of the node: the tail holds its hash', () => {
    expect(LONG.length).toBeGreaterThan(60);
    expect(bytesToHex(node)).toContain(bytesToHex(sha256(LONG)));
    expect(bytesToHex(node)).not.toContain(bytesToHex(LONG));
  });

  it('settles when the block lists the value, and every contract input is accepted', () => {
    const outcome = compose([LONG]);
    expect(outcome.completed.map((frame) => frame.functionName))
      .toStrictEqual([entryName('Notes', 'check'), entryName('ReadHub', 'run')]);
    expect(refused(outcome)).toStrictEqual([]);
    expect(outcome.draft.blockOf(ENTRY_MASTER).values).toStrictEqual([LONG]);
  });

  it('refuses a listed value other than the one the node\'s hash names', () => {
    expect(FORGED.length).toBe(LONG.length);
    expect(() => compose([FORGED])).toThrow(STALL);
  });

  it('refuses a read whose block lists no value', () => {
    expect(() => compose()).toThrow(STALL);
  });
});

describe('an initializer inserting two keys into an empty mapping in one frame', () => {
  const HEAD_ID = 'head';
  const registry = contracts.Registry!;
  const hub = contracts.InitHub!;
  const slots = INITIAL.map(({ key }) => keyToSlotMulti([key]));
  // A batch decides each predecessor against the list it started from: both keys splice in after the head, the
  // created nodes form one ascending chain, and the head is written once and declared by each insert's group.
  const ascending = [...slots].sort((a, b) => (bytesToSlotValue(a) < bytesToSlotValue(b) ? -1 : 1));
  const headAfter = encodeEntryCommitment(ZERO_SLOT, ascending[0]!,
    decodeEntryCommitment(headSentinelCommitment()).value);
  const node = (position: number, next: Uint8Array): Uint8Array =>
    encodeEntryCommitment(slots[position]!, next, encodeChunkableValueTail(INITIAL[position]!.value));
  const successorOf = (slot: Uint8Array): Uint8Array => ascending[ascending.indexOf(slot) + 1] ?? ZERO_SLOT;
  const NODES = INITIAL.map((_, position) => node(position, successorOf(slots[position]!)));

  function buildInitPlan(nodes: readonly Uint8Array[]): CompositionDraftPlan {
    const blocks: CompositionDraftPlan['blocks'] = [
      { contract: 'InitHub', masters: [HUB_MASTER], validator: { id: VALIDATOR_ID, settles: [] }, state: [] },
      { contract: 'Registry', masters: [ENTRY_MASTER], state: [HEAD_ID] },
    ];
    const layout = layoutTransaction(blocks);
    const headIndex = participant(layout, HEAD_ID).index;
    const created = [layout.participantCount, layout.participantCount + 1];
    const records = INITIAL.flatMap((_, position): RecordEntry[] => [
      { in: headIndex, out: headIndex, viewIn: position === 0 ? headSentinelCommitment() : headAfter, viewOut: headAfter },
      { in: INDEX_NONE, out: created[position]!, viewIn: new Uint8Array(0), viewOut: nodes[position]! },
    ]);
    const selector = selectorOf(artifacts, 'Registry', 'init');
    const validator = validatorFor(hub.category);
    const head = nodeInput(registry, 'Registry', headSentinelCommitment(), headAfter,
      participant(layout, ENTRY_MASTER).index);

    const hubMaster: DraftMaster = master({
      master: HUB_MASTER, contract: 'InitHub', entry: 'run', program: hub.program,
      facts: {
        contract: 'InitHub', functionName: entryName('InitHub', 'run'), kind: FrameKind.ROOT,
        callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
      },
      frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: hub.address, value: 0n },
      enteredBy: USER_ID, origin: USER_ID,
      calls: [{
        kind: FrameKind.CALL, callee: ENTRY_MASTER, target: registry.address, value: 0n, argumentPushes: [selector],
      }],
      segments: [[], []],
    });
    const registryMaster: DraftMaster = master({
      master: ENTRY_MASTER, contract: 'Registry', entry: 'init', program: registry.program,
      facts: {
        contract: 'Registry', functionName: entryName('Registry', 'init'), kind: FrameKind.CALL,
        callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
      },
      frame: { kind: FrameKind.CALL, sender: hub.address, self: registry.address, value: 0n },
      enteredBy: HUB_MASTER, origin: USER_ID,
      argumentPushes: [selector],
      segments: [records],
      dispatches: true,
    });

    return {
      blocks,
      userInputs: userInputs([USER_ID], layout.participantCount),
      masters: [hubMaster, registryMaster],
      inputs: {
        [HUB_MASTER]: { source: masterInput(hub) },
        [ENTRY_MASTER]: { source: masterInput(registry) },
        [VALIDATOR_ID]: {
          source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(hub.category, 'mutable') },
        },
        [HEAD_ID]: head,
        [USER_ID]: userInput(),
      },
      trailingOutputs: nodes.map((commitment) => ({
        lockingBytecode: head.source.lockingBytecode, valueSatoshis: 1_500n,
        token: token(registry.category, 'mutable', commitment),
      })),
      validator: {
        id: VALIDATOR_ID, covers: ['Registry'],
        settles: [{ category: registry.category, stateInputs: [HEAD_ID], createdOutputs: created }],
        redeemScript: validator.redeem,
      },
    };
  }

  const compose = (nodes: readonly Uint8Array[]): ReturnType<typeof composeAndDerive> => composeAndDerive(
    buildInitPlan(nodes), [artifacts.InitHub!, artifacts.Registry!], [rootOf('InitHub', 'run', HUB_MASTER)],
  );

  it('settles: both nodes are created from the one head, and every contract input is accepted', () => {
    const outcome = compose(NODES);
    expect(outcome.completed.map((frame) => frame.functionName))
      .toStrictEqual([entryName('Registry', 'init'), entryName('InitHub', 'run')]);
    expect(refused(outcome)).toStrictEqual([]);
  });

  it('refuses a chain whose lower node skips the other key', () => {
    const lower = slots.indexOf(ascending[0]!);
    const skipping = NODES.map((commitment, position) => (position === lower ? node(position, ZERO_SLOT) : commitment));
    expect(() => compose(skipping)).toThrow('PER_CALL_DERIVATION_STALLED: master "entry-1" of Registry.init()');
  });
});
