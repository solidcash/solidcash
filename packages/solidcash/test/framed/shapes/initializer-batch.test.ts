import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2sh32, hash256 } from '@bitauth/libauth';
import { layoutWithFacets } from './harness.js';
import {
  FrameKind,
  INDEX_NONE,
  buildEntryNftCovenantScript,
  buildPushdataCommitment,
  bytesToHex,
  computeCollectionHash,
  encodeChunkableValueTail,
  encodeEventCommitment,
  scriptToBytecode,
  type RecordEntry,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { eventOutput } from '../../../../solidc/test/framed/master/event-input.js';
import { seededCategory, REAL_VALIDATOR_PROGRAM } from '../../../../solidc/test/framed/master/validator-input.js';
import {
  deployMaster,
  stateRecordLockingBytecode,
  stateRecordUnlockingBytecode,
} from '../../../src/framed/deploy/index.js';
import {
  layOutMappingBatch,
  participant,
  planMappingBatch,
  type CompositionDraftPlan,
  type DraftMaster,
  type MappingNodePlacement,
} from '../../../src/framed/composer/index.js';
import {
  composeAndDerive,
  entryName,
  master,
  masterInput,
  rootOf,
  seededAddress,
  token,
  userInput,
  userInputs,
  validatorFor,
  type DeployedContract,
  USER_LOCK,
} from './harness.js';
import {
  bytesToSlotValue,
  decodeEntryCommitment,
  encodeEntryCommitment,
  headSentinelCommitment,
  keyToSlotMulti,
} from '../../../src/stateful/SortedList.js';
import { createUnlockingBytecode } from '../../../src/utils.js';
import { encodeFunctionArgument } from '../../../src/Argument.js';

/**
 * An initializer that writes its state record, inserts eight keys into an empty `mapping(string => string)` and
 * emits, in one frame entered by a user: the shape of the marketplace data contract's `initialize`.
 *
 * The body verifies its eight writes as one sorted batch, which decides every predecessor against the list it
 * started from, so all eight share the head. The plan comes from the shipped batch planner and encoders.
 */

const LABEL = 'initializer batch';
const CATEGORY = seededCategory(LABEL);
const CATEGORY_HEX = bytesToHex(CATEGORY);
const HUB = seededAddress('initializer batch hub');
const PREVIOUS_HUB = seededAddress('initializer batch previous hub');

const encoder = new TextEncoder();
const TAGS = [
  ['DA', 'DIGITAL_AUDIO'], ['DV', 'DIGITAL_VIDEO'], ['DT', 'DIGITAL_TEXT'], ['DS', 'DIGITAL_SOFTWARE'],
  ['DO', 'DIGITAL_OTHERS'], ['NDG', 'NON_DIGITAL_GOODS'], ['NDS', 'NON_DIGITAL_SERVICES'],
  ['NDO', 'NON_DIGITAL_OTHERS'],
].map(([key, value]) => ({ key: encoder.encode(key), value: encoder.encode(value) }));

const RECORD_ID = 'record';
const HEAD_ID = 'head';
const VALIDATOR_ID = 'validator';
const USER_ID = 'user';
const MASTER = 'registry-1';
const MASTER_INDEX = 0;

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Registry {'
  + '   address owner;'
  + '   address hub;'
  + '   mapping(string => string) tags;'
  + '   event HubChanged(address hub);'
  + '   function initialize(address hub_) {'
  + '     this.owner = msg.sender;'
  + '     this.hub = hub_;'
  + TAGS.map(({ key, value }) => `     this.tags["${new TextDecoder().decode(key)}"] = "${new TextDecoder().decode(value)}";`)
    .join('')
  + '     emit HubChanged(hub_);'
  + '     require(true);'
  + '   }'
  + '   function tag(string k) view returns (string) { return this.tags[k]; }'
  + ' }';

const artifact = compileStringMulti(SOURCE, { composition: 'framed' }).Registry!;
const deployed = deployMaster(artifact, CATEGORY, REAL_VALIDATOR_PROGRAM);
const DEPLOYED: DeployedContract = {
  name: artifact.contractName, category: CATEGORY, address: deployed.address,
  program: deployed.script, lockingBytecode: deployed.lockingBytecode,
};
const EVENT = artifact.events![0]!;
const ENTRY_REDEEM = scriptToBytecode(
  buildEntryNftCovenantScript(CATEGORY, computeCollectionHash(artifact.stateLayout!.collections![0]!.signature)),
);
const ENTRY_LOCK = encodeLockingBytecodeP2sh32(hash256(ENTRY_REDEEM));
const ENTRY_UNLOCK = createUnlockingBytecode('p2sh32', ENTRY_REDEEM, [
  encodeFunctionArgument(1n, 'bigint') as Uint8Array,
  encodeFunctionArgument(BigInt(MASTER_INDEX), 'bigint') as Uint8Array,
]);
const ROOT = rootOf(artifact.contractName, 'initialize', MASTER);

const recordOf = (owner: Uint8Array, hub: Uint8Array): Uint8Array =>
  new Uint8Array(Buffer.from(buildPushdataCommitment(artifact.stateLayout!, { owner, hub }, 0), 'hex'));
const RECORD_BEFORE = recordOf(PREVIOUS_HUB, PREVIOUS_HUB);
const RECORD_AFTER = recordOf(USER_LOCK, HUB);

const BATCH = planMappingBatch({
  writes: TAGS.map(({ key, value }) => ({ keys: [key], value })),
  inventory: [headSentinelCommitment()],
  encodeValue: encodeChunkableValueTail,
});
const SLOTS = TAGS.map(({ key }) => keyToSlotMulti([key]));
/** A node no write made, at the collection's own covenant. */
const FORGED = encodeEntryCommitment(keyToSlotMulti([encoder.encode('FORGED')]), new Uint8Array(32),
  encodeChunkableValueTail(encoder.encode('a node no write made')));

/**
 * The composition: the record written, the head relinked, eight nodes created after the event. `relinkLowest`
 * replaces the lowest created node's successor, in its declaration and its output alike; `forged` declares one more
 * created record, a node no write made, after the batch's groups or between its first two.
 */
function buildPlan(options: { readonly relinkLowest?: Uint8Array; readonly forged?: 'after' | 'between' } = {}): {
  readonly plan: CompositionDraftPlan;
  readonly headIndex: number;
  readonly created: readonly number[];
} {
  const blocks = [{
    contract: artifact.contractName, masters: [MASTER],
    validator: { id: VALIDATOR_ID, settles: [] as readonly string[] }, state: [RECORD_ID, HEAD_ID],
  }];
  const layout = layoutWithFacets(blocks);
  const recordIndex = participant(layout, RECORD_ID).index;
  const headIndex = participant(layout, HEAD_ID).index;
  const eventIndex = layout.participantCount;
  const between = options.forged === 'between';
  const created = SLOTS.map((_, position) => eventIndex + 1 + position + (between && position >= 1 ? 1 : 0));
  const forgedIndex = between ? eventIndex + 2 : eventIndex + 1 + SLOTS.length;
  const placements = new Map<string, MappingNodePlacement>([
    [bytesToHex(new Uint8Array(32)), { in: headIndex, out: headIndex }],
    ...SLOTS.map((slot, position): [string, MappingNodePlacement] => [bytesToHex(slot), { out: created[position]! }]),
  ]);

  const lowest = [...SLOTS].sort((a, b) => (bytesToSlotValue(a) < bytesToSlotValue(b) ? -1 : 1))[0]!;
  const nodeOf = (slot: Uint8Array): Uint8Array => {
    const planned = BATCH.written.find((node) => bytesToHex(node.slot) === bytesToHex(slot))!.after;
    if (options.relinkLowest === undefined || bytesToHex(slot) !== bytesToHex(lowest)) return planned;
    return encodeEntryCommitment(slot, options.relinkLowest, decodeEntryCommitment(planned).value);
  };
  const entries = layOutMappingBatch(BATCH, { placementOf: (slot) => placements.get(bytesToHex(slot)) })
    .map((entry, index, all): RecordEntry => (entry.in === INDEX_NONE
      ? { ...entry, viewOut: nodeOf(SLOTS[all.slice(0, index).filter((e) => e.in === INDEX_NONE).length]!) }
      : entry));
  const forgedRecord: RecordEntry = { in: INDEX_NONE, out: forgedIndex, viewIn: new Uint8Array(0), viewOut: FORGED };
  const declared = options.forged === undefined ? entries
    : between ? [...entries.slice(0, 2), forgedRecord, ...entries.slice(2)] : [...entries, forgedRecord];
  const headAfter = BATCH.written[0]!.after;

  const selector = new Uint8Array(Buffer.from(
    artifact.abi.find((entry) => entry.name === 'initialize')!.selector!, 'hex'));
  const registryMaster: DraftMaster = {
    ...master({
      master: MASTER, contract: artifact.contractName, entry: 'initialize', program: DEPLOYED.program,
      facts: {
        contract: artifact.contractName, functionName: entryName(artifact.contractName, 'initialize'),
        kind: FrameKind.ROOT, callerIsUser: true, originEqualsCaller: true,
        makesExternalCall: false, mastersOfContract: 1,
      },
      frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: DEPLOYED.address, value: 0n },
      enteredBy: USER_ID, origin: USER_ID, calls: [],
      segments: [[{ in: recordIndex, out: recordIndex, viewIn: RECORD_BEFORE, viewOut: RECORD_AFTER }, ...declared]],
      argumentPushes: [selector, HUB], dispatches: true,
    }),
    events: [eventIndex],
  };

  const recordSource = {
    lockingBytecode: stateRecordLockingBytecode(CATEGORY_HEX), valueSatoshis: 20_000n,
    token: token(CATEGORY, 'mutable', RECORD_BEFORE),
  };
  const headSource = {
    lockingBytecode: ENTRY_LOCK, valueSatoshis: 1_500n, token: token(CATEGORY, 'mutable', headSentinelCommitment()),
  };
  const nodes = SLOTS.map((slot) => ({
    lockingBytecode: ENTRY_LOCK, valueSatoshis: 1_500n, token: token(CATEGORY, 'mutable', nodeOf(slot)),
  }));
  const fake = { lockingBytecode: ENTRY_LOCK, valueSatoshis: 1_500n, token: token(CATEGORY, 'mutable', FORGED) };
  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: userInputs([USER_ID], layout.participantCount),
    masters: [registryMaster],
    inputs: {
      [MASTER]: { source: masterInput(DEPLOYED) },
      [VALIDATOR_ID]: {
        source: {
          lockingBytecode: validatorFor(CATEGORY).lock, valueSatoshis: 20_000n, token: token(CATEGORY, 'mutable'),
        },
      },
      [RECORD_ID]: {
        source: recordSource,
        output: { ...recordSource, token: token(CATEGORY, 'mutable', RECORD_AFTER) },
        unlockingBytecode: stateRecordUnlockingBytecode(CATEGORY_HEX, MASTER_INDEX, 1),
      },
      [HEAD_ID]: {
        source: headSource,
        output: { ...headSource, token: token(CATEGORY, 'mutable', headAfter) },
        unlockingBytecode: ENTRY_UNLOCK,
      },
      [USER_ID]: userInput(),
    },
    trailingOutputs: [
      eventOutput(CATEGORY, EVENT.signature, encodeEventCommitment(EVENT.parameters, [HUB])),
      ...(options.forged === undefined ? nodes
        : between ? [nodes[0]!, fake, ...nodes.slice(1)] : [...nodes, fake]),
    ],
    validator: {
      id: VALIDATOR_ID, covers: [],
      settles: [],
      redeemScript: validatorFor(CATEGORY).redeem,
    },
  };
  return { plan, headIndex, created };
}

describe('an initializer that writes its record, inserts eight keys into an empty mapping and emits', () => {
  it('settles: every contract input is accepted, and the outputs walk the eight keys in slot order', () => {
    const built = buildPlan();
    const outcome = composeAndDerive(built.plan, [artifact], [ROOT]);
    expect(outcome.completed.map((frame) => frame.functionName))
      .toStrictEqual([entryName(artifact.contractName, 'initialize')]);
    expect(outcome.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`)).toStrictEqual([]);

    // From the head, each output's successor names the next node, ascending, until the list ends.
    const outputs = outcome.transaction.outputs;
    const nodes = new Map(built.created.map((index) => {
      const commitment = outputs[index]!.token!.nft!.commitment;
      return [bytesToHex(decodeEntryCommitment(commitment).slot), commitment] as const;
    }));
    let next = decodeEntryCommitment(outputs[built.headIndex]!.token!.nft!.commitment).nextKey;
    const walked: bigint[] = [];
    while (bytesToSlotValue(next) !== 0n) {
      walked.push(bytesToSlotValue(next));
      next = decodeEntryCommitment(nodes.get(bytesToHex(next))!).nextKey;
    }
    expect(walked).toStrictEqual(SLOTS.map((slot) => bytesToSlotValue(slot)).sort((a, b) => (a < b ? -1 : 1)));
  });

  it('refuses a chain whose lowest node skips the other seven', () => {
    const built = buildPlan({ relinkLowest: new Uint8Array(32) });
    expect(() => composeAndDerive(built.plan, [artifact], [ROOT]))
      .toThrow('FRAMED_DERIVATION_STALLED: master "registry-1" of Registry.initialize()');
  });

  it('refuses a created record no write made, declared after the groups or between them', () => {
    // Settlement admits a created record wherever a frame declares one, so the body must declare no more than it
    // wrote: its state records, then one record per update and two per insert.
    for (const forged of ['after', 'between'] as const) {
      expect(() => composeAndDerive(buildPlan({ forged }).plan, [artifact], [ROOT]))
        .toThrow('FRAMED_DERIVATION_STALLED: master "registry-1" of Registry.initialize()');
    }
  });
});
