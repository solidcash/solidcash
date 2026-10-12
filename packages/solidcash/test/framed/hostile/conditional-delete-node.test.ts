import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2sh32, hash256 } from '@bitauth/libauth';
import {
  FrameKind, buildEntryNftCovenantScript, bytesToHex, computeCollectionHash, encodeChunkableValueTail,
  encodeIntegerValue, scriptToBytecode, type RecordEntry,
} from '@solidcash/utils';
import {
  MASTER_INDEX, deployFramedMaster, evaluateMasterSpend, node, spent,
} from '../../../../solidc/test/framed/master/record-spend.js';
import { encodeFunctionArgument } from '../../../src/Argument.js';
import { createUnlockingBytecode } from '../../../src/utils.js';
import { bytesToSlotValue, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import {
  USER_LOCK, compileAndDeploy, composeAndDerive, entryName, hexOf, layoutWithFacets, master, masterInput, rootOf,
  seededAddress, selectorOf, token, userInput, userInputs, validatorFor,
} from '../shapes/harness.js';
import { participant, type CompositionDraftPlan } from '../../../src/framed/composer/index.js';

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
const TAGS = deployFramedMaster(`pragma solidcash ^0.13.0;${TAGS_BODY}`, 'framed conditional delete');
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
const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface ITags { function remove(string k, int c); }'
  + TAGS_BODY
  + ' contract Hub {'
  + `   function run() { ITags(0x${hexOf(seededAddress(TAGS_LABEL))}).remove("${KEY_TEXT}", 1); require(true); }`
  + ' }';

describe('a framed delete a branch guards, called through a composition', () => {
  it('settles the delete: every contract input is accepted and the node carries the default', () => {
    const { artifacts, contracts } = compileAndDeploy(SOURCE, { Hub: HUB_LABEL, Tags: TAGS_LABEL });
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
    const record: RecordEntry = { in: nodeIndex, out: nodeIndex, viewIn: BEFORE, viewOut: DELETED };
    const pushes = [selectorOf(artifacts, 'Tags', 'remove'), YES, KEY];
    const validator = validatorFor(hub.category);
    const nodeSource = {
      lockingBytecode: entryLock, valueSatoshis: 20_000n, token: token(tags.category, 'mutable', BEFORE),
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
          output: { ...nodeSource, token: token(tags.category, 'mutable', DELETED) },
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
    const outcome = composeAndDerive(plan, [artifacts.Hub!, artifacts.Tags!], [rootOf('Hub', 'run', 'hub-1')]);
    expect(outcome.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.participant}: ${verdict.objection}`)).toStrictEqual([]);
    expect(bytesToHex(outcome.transaction.outputs[nodeIndex]!.token!.nft!.commitment)).toBe(bytesToHex(DELETED));
  });
});
