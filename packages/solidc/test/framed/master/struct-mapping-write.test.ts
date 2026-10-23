import { describe, expect, it } from 'vitest';
import { encodeDataPush } from '@bitauth/libauth';
import { encodeIntegerValue } from '@solidcash/utils';
import { keyToSlotMulti } from '../../../../solidcash/src/stateful/SortedList.js';
import {
  created, deployFramedMaster, distinctBytes, evaluateMasterSpend, head, node, spent,
  type DeployedMaster, type PlacedRecord,
} from './record-spend.js';

/**
 * A framed master whose entry writes a mapping held inside a struct.
 *
 * A struct field that is a mapping is flattened into a collection of its own, named `<variable>__<field>`: a state
 * struct's mapping is keyed by the mapping's own keys, and a mapping of such structs prepends the outer key, so
 * `accounts[o].parts[k]` is the node `[o, k]` of `accounts__parts`. The struct's other fields are flattened the
 * same way, into the data record for a state struct and into collections of their own for a mapped one. The
 * shipped path runs whole; the controls pin the slot each flattening derives, the value the node carries, the data
 * record the frame declares beside its groups, and the collection each node belongs to.
 */

const PRAGMA = 'pragma solidcash ^0.14.0;';
const ACCOUNT = 'struct Account { uint total; mapping(address => uint) parts; }';
const K = distinctBytes(20, 0x13);
const O = distinctBytes(20, 0x2b);
const V = 42n;
const OLD = 7n;
const TOTAL = 5n;

const HOLDER = deployFramedMaster(`${PRAGMA} contract Holder { ${ACCOUNT} Account acc;`
  + ' function set(address k, uint v) { acc.parts[k] = v; } }', 'struct mapping holder');
const TALLY = deployFramedMaster(`${PRAGMA} contract Tally { ${ACCOUNT} Account acc;`
  + ' function add(address k, uint v) { acc.parts[k] = acc.parts[k] + v; acc.total = acc.total + v; } }',
'struct mapping tally');
const LISTS = deployFramedMaster(`${PRAGMA} contract Lists {`
  + ' struct Access { uint count; mapping(address => uint) allowed; mapping(address => uint) blocked; } Access lists;'
  + ' function allow(address k, uint v) { lists.allowed[k] = v; }'
  + ' function mirror(address k, address j) { lists.allowed[j] = lists.blocked[k]; } }', 'struct mapping lists');
const ACCOUNTS = deployFramedMaster(`${PRAGMA} contract Accounts { ${ACCOUNT}`
  + ' mapping(address => Account) accounts;'
  + ' function set(address o, address k, uint v) { accounts[o].parts[k] = v; }'
  + ' function clear(address o, address k) { delete accounts[o].parts[k]; } }', 'struct mapping accounts');
const LEDGER = deployFramedMaster(`${PRAGMA} contract Ledger { ${ACCOUNT}`
  + ' mapping(address => Account) accounts;'
  + ' function add(address o, address k, uint v) {'
  + '   accounts[o].parts[k] = accounts[o].parts[k] + v; accounts[o].total = accounts[o].total + v; } }',
'struct mapping ledger');
const NESTED = deployFramedMaster(`${PRAGMA} contract Nested {`
  + ' struct Inner { uint y; mapping(address => uint) m; } struct Outer { uint x; Inner inner; } Outer o;'
  + ' function set(address k, uint v) { o.inner.m[k] = v; } }', 'struct mapping nested');
const DEEP = deployFramedMaster(`${PRAGMA} contract Deep { ${ACCOUNT}`
  + ' struct Grid { uint size; mapping(address => mapping(uint => uint)) cells; }'
  + ' mapping(address => mapping(address => Account)) pairs; mapping(address => Grid) grids;'
  + ' function pair(address a, address b, address k, uint v) { pairs[a][b].parts[k] = v; }'
  + ' function cell(address o, address a, uint c, uint v) { grids[o].cells[a][c] = v; } }', 'struct mapping deep');
const POINTER = deployFramedMaster(`${PRAGMA} contract Pointer { ${ACCOUNT}`
  + ' mapping(address => Account) accounts;'
  + ' function _put(Account storage a, address k, uint v) internal { a.parts[k] = v; }'
  + ' function set(address o, address k, uint v) { _put(accounts[o], k, v); } }', 'struct mapping pointer');
const LOCAL = deployFramedMaster(`${PRAGMA} contract Local { ${ACCOUNT}`
  + ' mapping(address => Account) accounts;'
  + ' function set(address o, address k, uint v) { Account storage a = accounts[o]; a.parts[k] = v; } }',
'struct mapping local pointer');
const POS = 'struct Pos { uint a; uint b; }';
const SMS = deployFramedMaster(`${PRAGMA} contract Sms { ${POS}`
  + ' struct Account { uint total; mapping(address => Pos) positions; } Account acc;'
  + ' function setA(address k, uint v) { acc.positions[k].a = v; } }', 'struct value in state mapping');
const SMS2 = deployFramedMaster(`${PRAGMA} contract Sms2 { ${POS}`
  + ' struct Account { uint total; mapping(address => Pos) positions; }'
  + ' mapping(address => Account) accounts;'
  + ' function setA(address o, address k, uint v) { accounts[o].positions[k].a = v; } }',
'struct value in mapped mapping');

const value = (amount: bigint): Uint8Array => encodeIntegerValue(amount);

/** A small struct value's node tail: the 4-byte little-endian length, then each field as a minimal push. */
function structTail(fields: bigint[]): Uint8Array {
  const blob = new Uint8Array(fields.flatMap((field) => [...encodeDataPush(encodeIntegerValue(field))]));
  return new Uint8Array([blob.length & 0xff, (blob.length >> 8) & 0xff, 0, 0, ...blob]);
}

/** Whether the machine accepts the master's input when `entry` runs on `records` with `args`. */
function acceptsOf(master: DeployedMaster, entry?: string):
(args: readonly Uint8Array[], records: readonly PlacedRecord[]) => boolean {
  return (args, records) => evaluateMasterSpend(master, { entry, args, records }).accepted;
}

/** The data record kept as it is, declared ahead of the groups. */
function keptRecord(master: DeployedMaster, values: Record<string, bigint>, at: number): PlacedRecord {
  return spent(master.recordLock, at, master.record(values));
}

/** An insert into the empty list at `lock`: the head relinked to `slot`, then the node it creates. */
function insertInto(lock: Uint8Array, slot: Uint8Array, amount: bigint, at: number, createdAt: number):
PlacedRecord[] {
  return [
    spent(lock, at, head(), head(slot)),
    created(lock, createdAt, node(slot, undefined, value(amount))),
  ];
}

/** The node at `slot` rewritten in place from `before` to `after`. */
function rewrite(lock: Uint8Array, slot: Uint8Array, before: bigint, after: bigint, at: number): PlacedRecord {
  return spent(lock, at, node(slot, undefined, value(before)), node(slot, undefined, value(after)));
}

describe('a mapping held in a state struct', () => {
  const accepts = acceptsOf(HOLDER);
  const lock = HOLDER.collectionLock('acc__parts');
  const args = [value(V), K];
  const slot = keyToSlotMulti([K]);
  const kept = keptRecord(HOLDER, { acc__total: TOTAL }, 2);

  it('flattens the mapping into a collection of its own and the scalar into the data record', () => {
    expect(HOLDER.artifact.stateLayout?.collections?.map((collection) => collection.signature))
      .toStrictEqual(['acc__parts:mapping(address => uint256)']);
    expect(HOLDER.artifact.stateLayout?.variables?.map((variable) => variable.name)).toStrictEqual(['acc__total']);
  });

  it('is accepted for an insert and for an update, with the data record kept ahead of the groups', () => {
    expect(evaluateMasterSpend(HOLDER, { args, records: [kept, ...insertInto(lock, slot, V, 3, 4)] }))
      .toStrictEqual({ accepted: true });
    expect(evaluateMasterSpend(HOLDER, { args, records: [kept, rewrite(lock, slot, OLD, V, 3)] }))
      .toStrictEqual({ accepted: true });
  });

  it('refuses a node carrying a value the write did not compute', () => {
    expect(accepts(args, [kept, rewrite(lock, slot, OLD, V + 1n, 3)])).toBe(false);
  });

  it('refuses a frame that leaves the data record out or declares it after the groups', () => {
    // A frame that writes a verified mapping declares every data record ahead of its groups, and the groups are
    // named by their position past them.
    expect(accepts(args, [rewrite(lock, slot, OLD, V, 3)])).toBe(false);
    expect(accepts(args, [rewrite(lock, slot, OLD, V, 3), kept])).toBe(false);
  });
});

describe('a state struct whose mapping and scalar one entry writes together', () => {
  const accepts = acceptsOf(TALLY);
  const lock = TALLY.collectionLock('acc__parts');
  const args = [value(V), K];
  const slot = keyToSlotMulti([K]);
  const written = (total: bigint): PlacedRecord => ({
    ...spent(TALLY.recordLock, 2, TALLY.record({ acc__total: TOTAL })), after: TALLY.record({ acc__total: total }),
  });

  it('is accepted with the record and the node carrying what the body computed', () => {
    expect(evaluateMasterSpend(TALLY, {
      args, records: [written(TOTAL + V), rewrite(lock, slot, OLD, OLD + V, 3)],
    })).toStrictEqual({ accepted: true });
  });

  it('refuses a total or a node value the body did not compute', () => {
    expect(accepts(args, [written(TOTAL + V + 1n), rewrite(lock, slot, OLD, OLD + V, 3)])).toBe(false);
    expect(accepts(args, [written(TOTAL + V), rewrite(lock, slot, OLD, OLD + V + 1n, 3)])).toBe(false);
  });
});

describe('two mappings of one struct, keyed alike', () => {
  // `allowed` and `blocked` take the same keys, so a key's node has the same slot and commitment shape in both:
  // only the collection lock tells them apart.
  const allow = acceptsOf(LISTS, 'allow');
  const mirror = acceptsOf(LISTS, 'mirror');
  const allowed = LISTS.collectionLock('lists__allowed');
  const blocked = LISTS.collectionLock('lists__blocked');
  const slot = keyToSlotMulti([K]);
  const kept = keptRecord(LISTS, { lists__count: 1n }, 2);
  const allowArgs = [value(V), K];

  it('is accepted writing the field the entry names, in place and by an insert', () => {
    expect(allow(allowArgs, [kept, rewrite(allowed, slot, OLD, V, 3)])).toBe(true);
    expect(allow(allowArgs, [kept, ...insertInto(allowed, slot, V, 3, 4)])).toBe(true);
  });

  it('refuses the sibling field\'s node rewritten through the entry that writes the other', () => {
    expect(allow(allowArgs, [kept, rewrite(blocked, slot, OLD, V, 3)])).toBe(false);
  });

  it('refuses a node moved between the two fields', () => {
    const update = rewrite(allowed, slot, OLD, V, 3);
    // Spent from the sibling's lock and recreated at the written field's, and the other way round.
    expect(allow(allowArgs, [kept, { ...update, lock: blocked, writtenLock: allowed }])).toBe(false);
    expect(allow(allowArgs, [kept, { ...update, writtenLock: blocked }])).toBe(false);
  });

  it('refuses an insert whose head or created node sits at the sibling field', () => {
    const [relinked, createdNode] = insertInto(allowed, slot, V, 3, 4);
    expect(allow(allowArgs, [kept, { ...relinked!, lock: blocked }, createdNode!])).toBe(false);
    expect(allow(allowArgs, [kept, relinked!, { ...createdNode!, lock: blocked }])).toBe(false);
  });

  it('reads the field the body names, and refuses the other field\'s node offered as the read', () => {
    // `mirror(k, j)` copies `blocked[k]` into `allowed[j]`; `allowed[k]` has the read's slot but not its collection.
    const J = distinctBytes(20, 0x61);
    const mirrorArgs = [J, K];
    const read = (lock: Uint8Array): PlacedRecord => spent(lock, 3, node(slot, undefined, value(V)));
    const mirrored = rewrite(allowed, keyToSlotMulti([J]), OLD, V, 4);
    expect(mirror(mirrorArgs, [kept, read(blocked), mirrored])).toBe(true);
    expect(mirror(mirrorArgs, [kept, read(allowed), mirrored])).toBe(false);
    expect(mirror(mirrorArgs, [kept, { ...read(blocked), writtenLock: allowed }, mirrored])).toBe(false);
  });
});

describe('a mapping held in a struct that a mapping holds', () => {
  const set = acceptsOf(ACCOUNTS, 'set');
  const clear = acceptsOf(ACCOUNTS, 'clear');
  const lock = ACCOUNTS.collectionLock('accounts__parts');
  const args = [value(V), K, O];
  const slot = keyToSlotMulti([O, K]);

  it('flattens the field into one collection keyed by the outer key and then the field\'s own', () => {
    expect(ACCOUNTS.artifact.stateLayout?.collections?.map((collection) => collection.signature)).toStrictEqual([
      'accounts__total:mapping(address => uint256)',
      'accounts__parts:mapping(address => mapping(address => uint256))',
    ]);
  });

  it('derives the node of the outer key and the field key together and is accepted', () => {
    expect(set(args, insertInto(lock, slot, V, 2, 3))).toBe(true);
  });

  it('refuses the node of the field key alone, the keys in the other order, and another value', () => {
    expect(set(args, insertInto(lock, keyToSlotMulti([K]), V, 2, 3))).toBe(false);
    expect(set(args, insertInto(lock, keyToSlotMulti([K, O]), V, 2, 3))).toBe(false);
    expect(set(args, insertInto(lock, slot, V + 1n, 2, 3))).toBe(false);
  });

  it('refuses a node held at the struct\'s other field', () => {
    expect(set(args, [rewrite(ACCOUNTS.collectionLock('accounts__total'), slot, OLD, V, 2)])).toBe(false);
    expect(set(args, [rewrite(lock, slot, OLD, V, 2)])).toBe(true);
  });

  it('removes the entry by writing the default value into the same node', () => {
    const cleared = spent(lock, 2, node(slot, undefined, value(OLD)), node(slot));
    expect(clear([K, O], [cleared])).toBe(true);
    expect(clear([K, O], [rewrite(lock, slot, OLD, OLD, 2)])).toBe(false);
  });
});

describe('both fields of a mapped struct written by one entry', () => {
  const accepts = acceptsOf(LEDGER);
  const totals = LEDGER.collectionLock('accounts__total');
  const parts = LEDGER.collectionLock('accounts__parts');
  const args = [value(V), K, O];
  const totalSlot = keyToSlotMulti([O]);
  const partSlot = keyToSlotMulti([O, K]);
  // The groups follow the entry's slot order, which numbers the `total` field first.
  const honest = (): PlacedRecord[] => [
    rewrite(totals, totalSlot, TOTAL, TOTAL + V, 2),
    rewrite(parts, partSlot, OLD, OLD + V, 3),
  ];

  it('is accepted with each field\'s node carrying its own sum', () => {
    expect(evaluateMasterSpend(LEDGER, { args, records: honest() })).toStrictEqual({ accepted: true });
  });

  it('refuses the groups in the other order and a sum the body did not compute', () => {
    expect(accepts(args, [...honest()].reverse())).toBe(false);
    expect(accepts(args, [rewrite(totals, totalSlot, TOTAL, TOTAL + V + 1n, 2), honest()[1]!])).toBe(false);
  });
});

describe('a mapping held in a struct nested in a state struct', () => {
  const accepts = acceptsOf(NESTED);
  const lock = NESTED.collectionLock('o__inner__m');
  const args = [value(V), K];
  const kept = keptRecord(NESTED, { o__x: 3n, o__inner__y: 4n }, 2);

  it('flattens through both struct levels and is accepted', () => {
    expect(NESTED.artifact.stateLayout?.collections?.map((collection) => collection.name))
      .toStrictEqual(['o__inner__m']);
    expect(accepts(args, [kept, rewrite(lock, keyToSlotMulti([K]), OLD, V, 3)])).toBe(true);
  });

  it('refuses another value', () => {
    expect(accepts(args, [kept, rewrite(lock, keyToSlotMulti([K]), OLD, V + 1n, 3)])).toBe(false);
  });
});

describe('a struct-held mapping reached below the second key level', () => {
  const A = distinctBytes(20, 0x3d);
  const B = distinctBytes(20, 0x4f);
  const C = encodeIntegerValue(300n);

  it('keys a mapping of mappings of structs by both outer keys and the field key', () => {
    const pair = acceptsOf(DEEP, 'pair');
    const lock = DEEP.collectionLock('pairs__parts');
    const args = [value(V), K, B, A];
    expect(pair(args, insertInto(lock, keyToSlotMulti([A, B, K]), V, 2, 3))).toBe(true);
    expect(pair(args, insertInto(lock, keyToSlotMulti([A, B]), V, 2, 3))).toBe(false);
  });

  it('keys a nested mapping held in a mapped struct by the outer key and both of its own', () => {
    const cell = acceptsOf(DEEP, 'cell');
    const lock = DEEP.collectionLock('grids__cells');
    const args = [value(V), C, A, O];
    expect(cell(args, insertInto(lock, keyToSlotMulti([O, A, C]), V, 2, 3))).toBe(true);
    expect(cell(args, insertInto(lock, keyToSlotMulti([A, C]), V, 2, 3))).toBe(false);
  });
});

describe('a struct-held mapping written through a storage parameter', () => {
  const accepts = acceptsOf(POINTER);
  const lock = POINTER.collectionLock('accounts__parts');
  const args = [value(V), K, O];

  it('resolves the parameter to the mapped struct and is accepted', () => {
    expect(accepts(args, insertInto(lock, keyToSlotMulti([O, K]), V, 2, 3))).toBe(true);
  });

  it('refuses the node of the field key alone', () => {
    expect(accepts(args, insertInto(lock, keyToSlotMulti([K]), V, 2, 3))).toBe(false);
  });
});

describe('a struct-held mapping written through a local storage pointer', () => {
  // `Account storage a = accounts[o]; a.parts[k] = v` names the same flattened collection, keyed by the outer key
  // then the field key, as the direct `accounts[o].parts[k]`.
  const accepts = acceptsOf(LOCAL);
  const lock = LOCAL.collectionLock('accounts__parts');
  const args = [value(V), K, O];

  it('resolves the local pointer to the mapped struct and is accepted', () => {
    expect(accepts(args, insertInto(lock, keyToSlotMulti([O, K]), V, 2, 3))).toBe(true);
  });

  it('refuses the node of the field key alone or of the keys in the other order', () => {
    expect(accepts(args, insertInto(lock, keyToSlotMulti([K]), V, 2, 3))).toBe(false);
    expect(accepts(args, insertInto(lock, keyToSlotMulti([K, O]), V, 2, 3))).toBe(false);
  });
});

describe('a struct value held in a struct-held mapping', () => {
  // `acc.positions[k].a = v` reads the node's `Pos`, sets one field and writes the whole struct back; the node tail
  // is the struct value's blob, not a scalar.
  const lock = SMS.collectionLock('acc__positions');
  const slot = keyToSlotMulti([K]);
  const kept = spent(SMS.recordLock, 3, SMS.record({ acc__total: 1n }), SMS.record({ acc__total: 1n }));
  const posNode = (a: bigint, b: bigint): PlacedRecord =>
    spent(lock, 2, node(slot, undefined, structTail([5n, 9n])), node(slot, undefined, structTail([a, b])));

  it('flattens the field to a mapping whose value is the struct', () => {
    expect(SMS.artifact.stateLayout?.collections?.map((collection) => collection.signature))
      .toStrictEqual(['acc__positions:mapping(address => Pos)']);
  });

  it('writes the struct back with the one field set and the others kept, and is accepted', () => {
    expect(evaluateMasterSpend(SMS, { args: [value(V), K], records: [kept, posNode(V, 9n)] }))
      .toStrictEqual({ accepted: true });
  });

  it('refuses a struct value whose set field or whose kept field the body did not compute', () => {
    expect(evaluateMasterSpend(SMS, { args: [value(V), K], records: [kept, posNode(V + 1n, 9n)] }).accepted)
      .toBe(false);
    expect(evaluateMasterSpend(SMS, { args: [value(V), K], records: [kept, posNode(V, 8n)] }).accepted).toBe(false);
  });

  it('keys the same struct value by the outer key when a mapping holds the struct', () => {
    const lock2 = SMS2.collectionLock('accounts__positions');
    const slot2 = keyToSlotMulti([O, K]);
    const outer = (a: bigint, b: bigint): PlacedRecord =>
      spent(lock2, 2, node(slot2, undefined, structTail([5n, 9n])), node(slot2, undefined, structTail([a, b])));
    expect(evaluateMasterSpend(SMS2, { args: [value(V), K, O], records: [outer(V, 9n)] }))
      .toStrictEqual({ accepted: true });
    expect(evaluateMasterSpend(SMS2, { args: [value(V), K, O], records: [outer(V, 8n)] }).accepted).toBe(false);
    // The field key alone names no node of this collection.
    const inner = (a: bigint, b: bigint): PlacedRecord =>
      spent(lock2, 2, node(keyToSlotMulti([K]), undefined, structTail([5n, 9n])),
        node(keyToSlotMulti([K]), undefined, structTail([a, b])));
    expect(evaluateMasterSpend(SMS2, { args: [value(V), K, O], records: [inner(V, 9n)] }).accepted).toBe(false);
  });
});
