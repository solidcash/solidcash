import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2sh32, hash256 } from '@bitauth/libauth';
import { layoutWithFacets } from './harness.js';
import {
  FrameKind,
  buildEntryNftCovenantScript,
  bytesToHex,
  computeCollectionHash,
  encodeChunkableValueTail,
  scriptToBytecode,
  type RecordEntry,
} from '@solidcash/utils';
import { publishedRefusals } from '../../../../solidc/test/framed/master/refused-entry.js';
import { encodeFunctionArgument } from '../../../src/Argument.js';
import { createUnlockingBytecode } from '../../../src/utils.js';
import { encodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
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
} from './harness.js';
import {
  participant,
  planMappingDelete,
  type CompositionDraftPlan,
  type DraftMaster,
} from '../../../src/framed/composer/index.js';

/**
 * One entry deleting a node of a `mapping(string => string)`.
 *
 * The compiler lowers a sorted `delete m[k]` to an upsert of the value type's default, so the entry writes the
 * node's value tail back to the empty string while the node keeps its slot and successor. This is the shape a
 * title stored under a string key uses: a title is cleared without the list unlinking its node.
 *
 * A root calls the delete through an interface. The node the frame spends is one entry UTXO whose value tail is
 * the shipped chunkable-value encoding of the title it held; the plan comes from the shipped delete-side planner,
 * the frame's one record group declares the node recreated in place, and the BCH-2026 machine is asked for a
 * verdict on every contract input.
 */

const HUB_LABEL = 'string mapping delete hub';
const TAGS_LABEL = 'string mapping delete tags';
const TAGS_ADDRESS = seededAddress(TAGS_LABEL);
const KEY = new TextEncoder().encode('title');
const TITLE = new TextEncoder().encode('first title');
const ZERO_SLOT = new Uint8Array(32);
/** The empty string's tail: the shipped encoder's default for a chunkable value. */
const DEFAULT_TAIL = encodeChunkableValueTail(new Uint8Array());
/** A title's value tail, which the shipped encoder length-prefixes before the value's own bytes. */
const titleTail = (title: Uint8Array): Uint8Array => encodeChunkableValueTail(title);

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ITags { function remove(string k); }'
  + ' contract Tags {'
  + '   mapping(string => string) tags;'
  + '   function remove(string k) { delete this.tags[k]; require(true); }'
  + ' }'
  + ' contract Hub {'
  + `   function run() { ITags(0x${hexOf(TAGS_ADDRESS)}).remove("title"); require(true); }`
  + ' }';

const MASTER_ID = 'tags-1';
const HUB_MASTER_ID = 'hub-1';
const NODE_ID = 'node';
const VALIDATOR_ID = 'validator';
const USER_ID = 'user';
/** The node's own master sits second, after the hub block's master and validator. */
// The Tags master sits after the Hub, its validator and the facet the validator binds.
const NODE_MASTER_INDEX = 3;

const { artifacts, contracts } = compileAndDeploy(SOURCE, { Hub: HUB_LABEL, Tags: TAGS_LABEL });
const HUB = contracts.Hub!;
const TAGS = contracts.Tags!;
const ARTIFACT = artifacts.Tags!;
const COLLECTION = ARTIFACT.stateLayout!.collections![0]!;
const ENTRY_REDEEM = scriptToBytecode(
  buildEntryNftCovenantScript(TAGS.category, computeCollectionHash(COLLECTION.signature)),
);
const ENTRY_LOCK = encodeLockingBytecodeP2sh32(hash256(ENTRY_REDEEM));
/** The entry covenant's `<masterInputIndex> <flag>` unlocking; flag 1 is the write path. */
const entryUnlock = (masterInputIndex: number, flag: bigint): Uint8Array =>
  createUnlockingBytecode('p2sh32', ENTRY_REDEEM, [
    encodeFunctionArgument(flag, 'bigint') as Uint8Array,
    encodeFunctionArgument(BigInt(masterInputIndex), 'bigint') as Uint8Array,
  ]);

/** The node the frame spends, from the shipped sorted-list encoder, and the delete's plan for it. */
const SLOT = keyToSlotMulti([KEY]);
const NODE_BEFORE = encodeEntryCommitment(SLOT, ZERO_SLOT, titleTail(TITLE));
const DELETE_PLAN = planMappingDelete({
  keys: [KEY], inventory: [NODE_BEFORE], encodeDefault: () => DEFAULT_TAIL,
});
const NODE_AFTER = DELETE_PLAN.written[0]!.after;

/** The plan: a root hub that calls the delete, the validator, and the node the delete rewrites. */
function buildPlan(): {
  readonly plan: CompositionDraftPlan;
  readonly nodeIndex: number;
  readonly tagsIndex: number;
} {
  const blocks: CompositionDraftPlan['blocks'] = [
    {
      contract: 'Hub', masters: [HUB_MASTER_ID],
      validator: { id: VALIDATOR_ID, settles: [] as readonly string[] }, state: [],
    },
    { contract: 'Tags', masters: [MASTER_ID], state: [NODE_ID] },
  ];
  const layout = layoutWithFacets(blocks);
  const nodeIndex = participant(layout, NODE_ID).index;
  const tagsIndex = participant(layout, MASTER_ID).index;
  const record: RecordEntry = { in: nodeIndex, out: nodeIndex, viewIn: NODE_BEFORE, viewOut: NODE_AFTER };
  const selector = selectorOf(artifacts, 'Tags', 'remove');
  const validator = validatorFor(HUB.category);

  const hubMaster: DraftMaster = master({
    master: HUB_MASTER_ID, contract: 'Hub', entry: 'run', program: HUB.program,
    facts: {
      contract: 'Hub', functionName: entryName('Hub', 'run'), kind: FrameKind.ROOT,
      callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: HUB.address, value: 0n },
    enteredBy: USER_ID, origin: USER_ID,
    calls: [{
      kind: FrameKind.CALL, callee: MASTER_ID, target: TAGS.address, value: 0n,
      argumentPushes: [selector, KEY],
    }],
    segments: [[], []],
  });
  const tagsMaster: DraftMaster = master({
    master: MASTER_ID, contract: 'Tags', entry: 'remove', program: TAGS.program,
    facts: {
      contract: 'Tags', functionName: entryName('Tags', 'remove'), kind: FrameKind.CALL,
      callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.CALL, sender: HUB.address, self: TAGS.address, value: 0n },
    enteredBy: HUB_MASTER_ID, origin: USER_ID,
    argumentPushes: [selector, KEY],
    segments: [[record]],
    dispatches: true,
  });

  const nodeSource = {
    lockingBytecode: ENTRY_LOCK, valueSatoshis: 20_000n, token: token(TAGS.category, 'mutable', NODE_BEFORE),
  };
  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: userInputs([USER_ID], layout.participantCount),
    masters: [hubMaster, tagsMaster],
    inputs: {
      [HUB_MASTER_ID]: { source: masterInput(HUB) },
      [MASTER_ID]: { source: masterInput(TAGS) },
      [VALIDATOR_ID]: {
        source: {
          lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(HUB.category, 'mutable'),
        },
      },
      [NODE_ID]: {
        source: nodeSource,
        output: { ...nodeSource, token: token(TAGS.category, 'mutable', NODE_AFTER) },
        unlockingBytecode: entryUnlock(NODE_MASTER_INDEX, 1n),
      },
      [USER_ID]: userInput(),
    },
    validator: {
      id: VALIDATOR_ID, covers: ['Tags'],
      settles: [],
      redeemScript: validator.redeem,
    },
  };
  return { plan, nodeIndex, tagsIndex };
}

const ROOT = rootOf('Hub', 'run', HUB_MASTER_ID);

describe('an entry deleting a node of a string-keyed string mapping', () => {
  it('serves the delete entry: no refusal is published and the entry takes only its key', () => {
    expect(ARTIFACT.composition?.convention).toBe('framed');
    expect(publishedRefusals(artifacts)).toStrictEqual([]);
    expect(ARTIFACT.abi.map((entry) => entry.name)).toStrictEqual(['remove']);
    expect(ARTIFACT.abi[0]!.inputs.map((input) => input.name)).toStrictEqual(['k']);
  });

  it('plans the delete as the body writes it: the node stays with the value type default', () => {
    // The node keeps its slot and successor; only the value tail becomes the empty string's.
    expect(NODE_AFTER).toStrictEqual(encodeEntryCommitment(SLOT, ZERO_SLOT, DEFAULT_TAIL));
    expect(DELETE_PLAN.removed).toBe(false);
    expect(DELETE_PLAN.written[0]!.existed).toBe(true);
    expect(bytesToHex(NODE_AFTER)).not.toBe(bytesToHex(NODE_BEFORE));
    // The default tail is the length prefix alone, since the empty value inlines.
    expect(DEFAULT_TAIL).toStrictEqual(new Uint8Array([0, 0, 0, 0]));
  });

  it('settles the delete: the frame derives, every contract input is accepted, and the node carries the default', () => {
    const built = buildPlan();
    const outcome = composeAndDerive(built.plan, [artifacts.Hub!, ARTIFACT], [ROOT]);
    // The delete frame runs before the root that called it, and the call record names the frame it reached.
    expect(outcome.completed.map((frame) => frame.functionName))
      .toStrictEqual([entryName('Tags', 'remove'), entryName('Hub', 'run')]);
    expect(outcome.draft.blockOf(HUB_MASTER_ID).calls.map((call) => call.calleeRef)).toStrictEqual([built.tagsIndex]);
    // Every contract input is accepted by the BCH-2026 machine.
    const rejected = outcome.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
    expect(rejected).toStrictEqual([]);
    // The node's own output carries the shipped encoder's default tail, read back from the transaction.
    const written = outcome.transaction.outputs[built.nodeIndex]!.token!.nft!.commitment;
    expect(bytesToHex(written)).toBe(bytesToHex(NODE_AFTER));
    expect(bytesToHex(written)).toBe(bytesToHex(encodeEntryCommitment(SLOT, ZERO_SLOT, DEFAULT_TAIL)));
  });

  it('refuses a frame whose declared close is not the one its body computed', () => {
    // The control for the accept above: the frame closes against the view its own segment declares, so a
    // declaration rewritten to a value no frame wrote is refused rather than resolved.
    const built = buildPlan();
    (built.plan.masters[1]!.segments[0]![0]! as RecordEntry).viewOut =
      encodeEntryCommitment(SLOT, ZERO_SLOT, titleTail(new TextEncoder().encode('other title')));
    expect(() => composeAndDerive(built.plan, [artifacts.Hub!, ARTIFACT], [ROOT])).toThrow();
  });
});
