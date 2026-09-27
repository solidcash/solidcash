import { describe, expect, it } from 'vitest';
import { bytesToHex, encodeIntegerValue } from '@solidcash/utils';
import { encodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compileAndDeploy, entryName, hexOf, seededAddress } from '../shapes/harness.js';
import {
  layOutMappingWrites, planMappingWrite, type MappingNodePlacement,
} from '../../../src/per-call/composer/index.js';

/**
 * One entry inserting, updating and deleting one key across three calls in one transaction.
 *
 * `Hub.run` calls `Ledger.insert(1, 10)`, `Ledger.update(1, 20)` and `Ledger.remove(1)`. The compiler gives each
 * call its own call site, so the composition carries three call records and the callee runs on one master per
 * call. `records` is a sorted mapping, so each write touches a node UTXO: an insert splices a created node in
 * beside its predecessor, an update rewrites the target in place, and a delete relinks the predecessor around it.
 *
 * The key's node is one UTXO, and a transaction gives it one input and one output. The insert creates it, so the
 * update that follows has no input to spend it at and the node plan refuses the write by name; the same holds for
 * a delete of the node an earlier write created. The file pins this limit: the three call sites publish, and the
 * three writes of one key cannot be placed on one transaction's single node.
 */

const HUB_LABEL = 'sorted entry lifecycle hub';
const LEDGER_LABEL = 'sorted entry lifecycle ledger';
const LEDGER_ADDRESS = seededAddress(LEDGER_LABEL);
const KEY = 1n;
const INSERTED = 10n;
const UPDATED = 20n;
const EXISTING = 7n;

const SOURCE = 'pragma solidcash ^0.13.0;'
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

/** The zero successor a node at the end of the sorted list carries. */
const ZERO_SLOT = new Uint8Array(32);
/** A predecessor slot below the key's own, so the key's node has a bracketing node to splice through. */
const PREDECESSOR_SLOT = new Uint8Array(32);
/** Where the node and the key sit in a transaction: the predecessor lives at input/output 1, the node at 2. */
const PREDECESSOR_PLACEMENT: readonly [string, MappingNodePlacement] = [bytesToHex(PREDECESSOR_SLOT), { in: 1, out: 1 }];

/** One node's commitment: the slot, the successor it points at, and the value it carries. */
function node(slot: Uint8Array, value: bigint): Uint8Array {
  return new Uint8Array(Buffer.from(encodeEntryCommitment(slot, ZERO_SLOT, encodeIntegerValue(value)), 'hex'));
}

describe('one entry inserting, updating and deleting one key in one transaction', () => {
  it('publishes one call site per call, each naming its own method', () => {
    const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
    const hub = (artifacts.Hub!.composition as {
      stopSites: { entries: { functionName: string; calls: { functionName: string; selector: string }[]; sites: { sites: unknown[] } }[] };
    }).stopSites.entries.find((entry) => entry.functionName === entryName('Hub', 'run'))!;
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

  it('cannot update the node its own insert created: one transaction gives the key one input', () => {
    const { artifacts } = compileAndDeploy(SOURCE, { Hub: HUB_LABEL, Ledger: LEDGER_LABEL });
    const layout = artifacts.Ledger!.stateLayout!;
    const slot = keyToSlotMulti([encodeIntegerValue(KEY)]);
    const encodeValue = (value: bigint): Uint8Array => encodeIntegerValue(value);

    // The insert splices the created node in beside its predecessor and does not spend it.
    const insert = planMappingWrite({ keys: [encodeIntegerValue(KEY)], value: INSERTED, inventory: [node(PREDECESSOR_SLOT, EXISTING)], encodeValue });
    const placements = new Map<string, MappingNodePlacement>([PREDECESSOR_PLACEMENT, [bytesToHex(slot), { out: 2 }]]);
    const insertion = layOutMappingWrites([[insert]], { placementOf: (candidate) => placements.get(bytesToHex(candidate)) });
    expect(insertion.flat().map((entry) => `${entry.in}/${entry.out}`)).toStrictEqual(['1/1', '65535/2']);

    // The update reads the node the insert created; the layout gives that node an output, because the insert
    // created it, but no input, because a transaction cannot spend the output it writes.
    const update = planMappingWrite({
      keys: [encodeIntegerValue(KEY)], value: UPDATED,
      inventory: [insert.written[0]!.after, insert.written[1]!.after], encodeValue,
    });
    const refusal = refusalOf(() => layOutMappingWrites([[update]], { placementOf: (candidate) => placements.get(bytesToHex(candidate)) }));
    expect(refusal.name).toBe('PerCallComposerError');
    expect(refusal.code).toBe('PER_CALL_MAPPING_UNPLANNABLE');
    expect(refusal.message).toMatch(/needs an input index the layout gives it none of/);

    // A node the transaction spends is laid out: the refusal above is the created node's missing input, not a
    // write the plan cannot express at all.
    const spent = new Map<string, MappingNodePlacement>([[bytesToHex(slot), { in: 2, out: 2 }]]);
    const existing = planMappingWrite({
      keys: [encodeIntegerValue(KEY)], value: UPDATED, inventory: [node(slot, EXISTING)], encodeValue,
    });
    expect(layOutMappingWrites([[existing]], { placementOf: (candidate) => spent.get(bytesToHex(candidate)) }))
      .toStrictEqual([[{ in: 2, out: 2, viewIn: node(slot, EXISTING), viewOut: node(slot, UPDATED) }]]);
  });

  it('cannot delete the node its own insert created either', () => {
    const { artifacts } = compileAndDeploy(SOURCE, { Hub: HUB_LABEL, Ledger: LEDGER_LABEL });
    const slot = keyToSlotMulti([encodeIntegerValue(KEY)]);
    const encodeValue = (value: bigint): Uint8Array => encodeIntegerValue(value);
    const insert = planMappingWrite({ keys: [encodeIntegerValue(KEY)], value: INSERTED, inventory: [node(PREDECESSOR_SLOT, EXISTING)], encodeValue });
    const placements = new Map<string, MappingNodePlacement>([PREDECESSOR_PLACEMENT, [bytesToHex(slot), { out: 2 }]]);
    const remove = planMappingWrite({
      keys: [encodeIntegerValue(KEY)], value: undefined,
      inventory: [insert.written[0]!.after, insert.written[1]!.after], encodeValue,
    });
    // The delete relinks the predecessor around the target, which is a node the transaction never spends.
    const refusal = refusalOf(() => layOutMappingWrites([[remove]], { placementOf: (candidate) => placements.get(bytesToHex(candidate)) }));
    expect(refusal.code).toBe('PER_CALL_MAPPING_UNPLANNABLE');
    expect(refusal.message).toMatch(/needs an input index the layout gives it none of/);
  });
});
