import { describe, expect, it } from 'vitest';
import { binToHex, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { INDEX_NONE, bytesToHex, encodePushdataValue, type RecordEntry } from '@solidcash/utils';
import { SortedList, bytesToSlotValue, encodeEntryCommitment, keyToSlot } from '../../../src/stateful/SortedList.js';
import {
  PerCallComposerError,
  assertRecordChains,
  layOutMappingWrites,
  planMappingWrite,
  type MappingNodePlacement,
  type MappingNodePlacements,
} from '../../../src/per-call/composer/index.js';
import type { Utxo } from '../../../src/interfaces.js';

/**
 * The mapping plan, driven through the shipped sorted-list encoders.
 *
 * A mapping is a sorted list of node UTXOs whose commitment is slot||nextKey||value. The tests build a two-node
 * list (the HEAD sentinel and one stored key) and read every expected commitment back from the shipped encoders —
 * `keyToSlot` and `SortedList.planUpdate`/`planInsert` — rather than hard-coding hex. The value tail is produced by
 * the shipped pushdata encoder, so the plan, the list and the expectations all agree by construction.
 */

/** One entry-NFT UTXO, as the sorted list reads the state UTXOs. */
const entryUtxo = (txid: string, commitment: Uint8Array): Utxo => ({
  txid,
  vout: 0,
  satoshis: 1500n,
  token: { category: '11'.repeat(32), amount: 0n, nft: { capability: 'mutable', commitment: binToHex(commitment) } },
});

const ZERO_SLOT = new Uint8Array(32);
const EMPTY_TAIL = new Uint8Array(64);
const value = (n: bigint): Uint8Array => encodePushdataValue(n, 'uint256');

/** Two keys ordered by slot, so the lower one lands in the gap between HEAD and the stored node. */
function twoKeys(): { lower: { key: Uint8Array; slot: Uint8Array }; upper: { key: Uint8Array; slot: Uint8Array } } {
  const keyed = ['account-a', 'account-b', 'account-c'].map((name) => {
    const key = utf8ToBin(name);
    return { key, slot: keyToSlot(key) };
  });
  keyed.sort((left, right) => {
    const lv = bytesToSlotValue(left.slot);
    const rv = bytesToSlotValue(right.slot);
    return lv < rv ? -1 : 1;
  });
  return { lower: keyed[0]!, upper: keyed[2]! };
}

/** The two-node list: HEAD points at the stored node, which points at +infinity. */
function twoNodeList(): {
  lower: { key: Uint8Array; slot: Uint8Array };
  upper: { key: Uint8Array; slot: Uint8Array };
  list: SortedList;
  inventory: Uint8Array[];
  headCommitment: Uint8Array;
  upperCommitment: Uint8Array;
} {
  const { lower, upper } = twoKeys();
  const headCommitment = encodeEntryCommitment(ZERO_SLOT, upper.slot, EMPTY_TAIL);
  const upperCommitment = encodeEntryCommitment(upper.slot, ZERO_SLOT, value(100n));
  const utxos = [entryUtxo('00'.repeat(32), headCommitment), entryUtxo('aa'.repeat(32), upperCommitment)];
  return {
    lower,
    upper,
    list: SortedList.fromUtxos(utxos),
    inventory: utxos.map((utxo) => hexToBin(utxo.token!.nft!.commitment)),
    headCommitment,
    upperCommitment,
  };
}

const encodeValue = (n: bigint): Uint8Array => value(n);

/** A placement lookup keyed by the slot's hex. */
const placementsOf = (bySlot: ReadonlyMap<string, MappingNodePlacement>): MappingNodePlacements => ({
  placementOf: (slot) => bySlot.get(bytesToHex(slot)),
});

describe('planning a mapping write against the state the transaction spends', () => {
  it('updates a present key by rewriting only its value tail', () => {
    const { upper, list, inventory, upperCommitment } = twoNodeList();
    const expected = list.planUpdate(upper.slot, value(200n));

    const plan = planMappingWrite({ keys: [upper.key], value: 200n, inventory, encodeValue });

    expect(plan.existed).toBe(true);
    expect(plan.removed).toBe(false);
    expect(plan.written).toHaveLength(1);
    expect(plan.written[0]!.existed).toBe(true);
    expect(plan.written[0]!.before).toStrictEqual(upperCommitment);
    expect(plan.written[0]!.after).toStrictEqual(expected.newCommitment);
  });

  it('inserts an absent key by relinking the predecessor and creating the node ahead of it', () => {
    const { lower, list, inventory, headCommitment } = twoNodeList();
    const expected = list.planInsert(lower.slot, value(300n));

    const plan = planMappingWrite({ keys: [lower.key], value: 300n, inventory, encodeValue });

    expect(plan.existed).toBe(false);
    expect(plan.written).toHaveLength(2);
    // The predecessor is relinked in place; the new node points at the successor it displaced.
    expect(plan.written[0]!.slot).toStrictEqual(expected.predecessor.slot);
    expect(plan.written[0]!.existed).toBe(true);
    expect(plan.written[0]!.before).toStrictEqual(headCommitment);
    expect(plan.written[0]!.after).toStrictEqual(expected.predNewCommitment);
    expect(plan.written[1]!.existed).toBe(false);
    expect(plan.written[1]!.after).toStrictEqual(expected.newNodeCommitment);
  });

  it('deletes a present key by relinking the predecessor around it', () => {
    const { lower, upper } = twoNodeList();
    // Build a three-node list so the deleted upper key has a lower predecessor to relink around.
    const headToLower = encodeEntryCommitment(ZERO_SLOT, lower.slot, EMPTY_TAIL);
    const lowerNode = encodeEntryCommitment(lower.slot, upper.slot, value(50n));
    const upperNode = encodeEntryCommitment(upper.slot, ZERO_SLOT, value(100n));
    const utxos = [
      entryUtxo('00'.repeat(32), headToLower),
      entryUtxo('bb'.repeat(32), lowerNode),
      entryUtxo('cc'.repeat(32), upperNode),
    ];
    const threeNode = SortedList.fromUtxos(utxos);
    const threeInventory = utxos.map((utxo) => hexToBin(utxo.token!.nft!.commitment));
    const expected = threeNode.planDelete(upper.slot);

    const plan = planMappingWrite({ keys: [upper.key], value: undefined, inventory: threeInventory, encodeValue });

    expect(plan.existed).toBe(true);
    expect(plan.removed).toBe(true);
    expect(plan.target?.slot).toStrictEqual(upper.slot);
    expect(plan.predecessor?.slot).toStrictEqual(lower.slot);
    expect(plan.written).toHaveLength(1);
    expect(plan.written[0]!.slot).toStrictEqual(lower.slot);
    expect(plan.written[0]!.after).toStrictEqual(expected.predNewCommitment);
    // The relinked predecessor is the lower node's own next, which the shipped list also produced.
    expect(plan.written[0]!.after).toStrictEqual(encodeEntryCommitment(lower.slot, ZERO_SLOT, value(50n)));
  });

  it('leaves the inventory alone when the write removes a key it does not hold', () => {
    const { lower, inventory } = twoNodeList();
    const plan = planMappingWrite({ keys: [lower.key], value: undefined, inventory, encodeValue });
    expect(plan.existed).toBe(false);
    expect(plan.removed).toBe(false);
    expect(plan.written).toStrictEqual([]);
  });
});

describe('laying the plans out as the record entries each segment declares', () => {
  it('names the update, then the insert, as the two segments run', () => {
    const { lower, upper, list, inventory, headCommitment, upperCommitment } = twoNodeList();
    const updatePlan = planMappingWrite({ keys: [upper.key], value: 200n, inventory, encodeValue });
    const insertPlan = planMappingWrite({ keys: [lower.key], value: 300n, inventory, encodeValue });
    const expectedUpdate = list.planUpdate(upper.slot, value(200n));
    const expectedInsert = list.planInsert(lower.slot, value(300n));

    const segments = layOutMappingWrites(
      [[updatePlan], [insertPlan]],
      placementsOf(new Map([
        [bytesToHex(upper.slot), { in: 2, out: 2 }],
        [bytesToHex(lower.slot), { out: 5 }],
        [bytesToHex(ZERO_SLOT), { in: 1, out: 1 }],
      ])),
    );

    // The update recreates its node in place, so its input and output indices agree.
    expect(segments).toHaveLength(2);
    expect(segments[0]).toStrictEqual<RecordEntry[]>([
      { in: 2, out: 2, viewIn: upperCommitment, viewOut: expectedUpdate.newCommitment },
    ]);
    // The insert's predecessor is relinked in place and the new node is created at a trailing output.
    expect(segments[1]).toStrictEqual<RecordEntry[]>([
      { in: 1, out: 1, viewIn: headCommitment, viewOut: expectedInsert.predNewCommitment },
      { in: INDEX_NONE, out: 5, viewIn: new Uint8Array(0), viewOut: expectedInsert.newNodeCommitment },
    ]);
  });

  it('declares the chained shape a later segment must carry', () => {
    const { lower, list, inventory, headCommitment } = twoNodeList();
    const insertPlan = planMappingWrite({ keys: [lower.key], value: 300n, inventory, encodeValue });
    const expected = list.planInsert(lower.slot, value(300n));

    const segments = layOutMappingWrites(
      [[insertPlan]],
      placementsOf(new Map([
        [bytesToHex(lower.slot), { out: 5 }],
        [bytesToHex(ZERO_SLOT), { in: 1, out: 1 }],
      ])),
    );
    const [predecessor, created] = segments[0]!;

    // The predecessor's declaration starts from what the transaction spends and ends at the relinked node.
    expect(predecessor!.viewIn).toStrictEqual(headCommitment);
    expect(predecessor!.viewOut).toStrictEqual(expected.predNewCommitment);
    expect(predecessor!.in).toBe(predecessor!.out);
    // The created node has no input, so its declaration before the segment is the create sentinel.
    expect(created!.in).toBe(INDEX_NONE);
    expect(created!.viewIn).toStrictEqual(new Uint8Array(0));
    expect(created!.out).toBe(5);

    // The shipped settlement check agrees that the declarations chain from input to output.
    expect(() => assertRecordChains(segments, {
      inputCommitments: new Map([[1, headCommitment]]),
      outputCommitments: new Map([[1, expected.predNewCommitment], [5, expected.newNodeCommitment]]),
    })).not.toThrow();
  });
});

describe('what the mapping plan refuses', () => {
  it('refuses a key whose predecessor is absent from the inventory', () => {
    const { lower } = twoNodeList();
    let raised: unknown;
    try {
      planMappingWrite({ keys: [lower.key], value: 1n, inventory: [], encodeValue });
    } catch (error) {
      raised = error;
    }
    expect(raised).toBeInstanceOf(PerCallComposerError);
    expect((raised as PerCallComposerError).code).toBe('PER_CALL_MAPPING_UNPLANNABLE');
    expect((raised as PerCallComposerError).message).toMatch(/holds no predecessor below it/);
  });

  it('refuses a write whose node has no index the layout placed', () => {
    const { lower, inventory } = twoNodeList();
    const insertPlan = planMappingWrite({ keys: [lower.key], value: 300n, inventory, encodeValue });

    // The created node was given no output, so the insert has nowhere to put it.
    const noCreatedOutput = placementsOf(new Map([[bytesToHex(ZERO_SLOT), { in: 1, out: 1 }]]));
    expect(() => layOutMappingWrites([[insertPlan]], noCreatedOutput))
      .toThrow(/PER_CALL_MAPPING_UNPLANNABLE: the mapping node .* needs an output index/);

    // The predecessor was given no input, so the execution cannot spend the node it must relink.
    const noPredecessorInput = placementsOf(new Map([[bytesToHex(lower.slot), { out: 5 }]]));
    expect(() => layOutMappingWrites([[insertPlan]], noPredecessorInput))
      .toThrow(/PER_CALL_MAPPING_UNPLANNABLE: the mapping node .* needs an input index/);
  });
});
