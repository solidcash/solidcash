import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import {
  buildChunkCommitment, buildEntryNftCovenantScript, computeCollectionHash, encodeInt, encodePushdataValue,
  packFixedWidthArray, type PrimitiveStateValue,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { encodeEntryCommitment, keyToSlot } from '../../../../solidcash/src/stateful/SortedList.js';
import { scriptToLockingBytecode } from '../../../../solidcash/src/utils.js';
import {
  chunkLock, deployChunkRunContract, distinctBytes, distinctLock, evaluateChunkRuns, type ChunkRunContract,
  type ChunkRunMutation, type LeadingRecord,
} from './chunk-run-input.js';

/**
 * A framed master whose entry writes two dynamic values, settled on the BCH-2026 machine.
 *
 * The segment declares the values' runs in the order the values are declared, each one record per chunk of the wider
 * of its spent and written versions, so a later run starts past every record of the runs before it: past the chunks
 * an earlier value consumes when it shrinks, and past the ones it creates when it grows. Every rule of the run census
 * holds for each value: its old chunks are consumed from its own chunk address, a position past them is created from
 * nothing, a position past its new chunks writes nothing, and nothing is declared past the last run.
 *
 * Each family below drives the honest shapes, then moves one fact of an accepted transaction: the later run declared
 * where the first value's old count ends after a growth (its records sit where the first value's created chunks
 * belong) or where its new count ends after a shrink (where the first value's consumed chunks belong), a chunk a
 * shrink drops left unspent or written back, one more chunk created past a run, and a chunk the body did not compute.
 */

const SHORT = distinctBytes(5, 0x11);
const OTHER_SHORT = distinctBytes(9, 0x1d);
/** 200 bytes need two chunks. */
const LONG = distinctBytes(200, 0x17);
const OTHER_LONG = distinctBytes(170, 0x29);
const EMPTY = new Uint8Array(0);
const chunk = (index: number, bytes: Uint8Array): Uint8Array => hexToBin(buildChunkCommitment(index, bytes));
const concat = (...parts: Uint8Array[]): Uint8Array => new Uint8Array(parts.flatMap((part) => [...part]));
const FOREIGN_CHUNK = chunk(0, distinctBytes(6, 0x63));
const ORPHAN_CHUNK = chunk(1, distinctBytes(4, 0x65));

const deploy = (source: string, label: string): ChunkRunContract =>
  deployChunkRunContract(compileString(source, { composition: 'framed' }), label);

/** A spent and a written version of one value. */
type Versions = readonly [Uint8Array, Uint8Array];

const pairSource = (type: string, entry: string): string => 'pragma solidcash ^0.14.0;'
  + ' contract Pair {'
  + `   ${type} public first;`
  + `   ${type} public second;`
  + `   ${entry}`
  + ' }';

// A `bytes` pair runs the same census at its own chunk address, which `dynamic-bytes-record.test.ts` drives.
describe('a framed master that overwrites two string values', () => {
  const type = 'string';
  const pair = deploy(
    pairSource(type, `function set(${type} x, ${type} y) { this.first = x; this.second = y; }`), `${type} pair`,
  );
  const set = (first: Versions, second: Versions, mutation: ChunkRunMutation = {}): boolean =>
    evaluateChunkRuns(pair, {
      args: [first[1], second[1]],
      runs: [
        { variable: 'first', type, spent: first[0], written: first[1] },
        { variable: 'second', type, spent: second[0], written: second[1] },
      ],
    }, mutation).accepted;

  it('is emitted as a framed master', () => {
    expect(pair.artifact.composition?.convention).toBe('framed');
    expect(pair.artifact.composition!.refusedEntries).toBeUndefined();
  });

  it('accepts both values rewritten at the same widths', () => {
    expect(set([SHORT, OTHER_SHORT], [OTHER_SHORT, SHORT])).toBe(true);
  });

  it('accepts the first value grown from one chunk to two', () => {
    expect(set([SHORT, LONG], [OTHER_SHORT, SHORT])).toBe(true);
  });

  it('accepts the first value shrunk from two chunks to one', () => {
    expect(set([LONG, SHORT], [OTHER_SHORT, SHORT])).toBe(true);
  });

  it('accepts both values grown', () => {
    expect(set([SHORT, LONG], [OTHER_SHORT, OTHER_LONG])).toBe(true);
  });

  it('accepts one value shrunk while the other grows, either way round', () => {
    expect(set([LONG, SHORT], [OTHER_SHORT, OTHER_LONG])).toBe(true);
    expect(set([SHORT, LONG], [OTHER_LONG, OTHER_SHORT])).toBe(true);
  });

  it('accepts either value emptied, its only chunk consumed', () => {
    expect(set([SHORT, EMPTY], [OTHER_SHORT, SHORT])).toBe(true);
    expect(set([SHORT, LONG], [OTHER_SHORT, EMPTY])).toBe(true);
  });

  it('accepts the first value written from nothing beside a second that shrinks', () => {
    expect(set([EMPTY, LONG], [OTHER_LONG, OTHER_SHORT])).toBe(true);
  });

  it('refuses the later run declared where the first value\'s old count ends after it grows', () => {
    expect(set([SHORT, LONG], [OTHER_SHORT, SHORT], { laterRunsAt: 'spent' })).toBe(false);
  });

  it('refuses the later run declared where the first value\'s new count ends after it shrinks', () => {
    expect(set([LONG, SHORT], [OTHER_SHORT, SHORT], { laterRunsAt: 'written' })).toBe(false);
  });

  it('accepts a later run that only creates beside a growth, and one that only consumes beside a shrink', () => {
    expect(set([SHORT, LONG], [EMPTY, OTHER_SHORT])).toBe(true);
    expect(set([LONG, SHORT], [OTHER_SHORT, EMPTY])).toBe(true);
  });

  it('refuses a later run that only creates declared at the old count, or only consumes at the new count', () => {
    // The created chunk has an output and no input; the consumed one an input and no output.
    expect(set([SHORT, LONG], [EMPTY, OTHER_SHORT], { laterRunsAt: 'spent' })).toBe(false);
    expect(set([LONG, SHORT], [OTHER_SHORT, EMPTY], { laterRunsAt: 'written' })).toBe(false);
  });

  it('refuses a chunk a shrink drops left unspent, in either run', () => {
    expect(set([LONG, SHORT], [OTHER_SHORT, SHORT], { leaveRemoved: true })).toBe(false);
    expect(set([SHORT, LONG], [OTHER_LONG, OTHER_SHORT], { run: 1, leaveRemoved: true })).toBe(false);
  });

  it('refuses a chunk a shrink drops written back at the address, in either run', () => {
    expect(set([LONG, SHORT], [OTHER_SHORT, SHORT], { keepRemoved: true })).toBe(false);
    expect(set([SHORT, LONG], [OTHER_LONG, OTHER_SHORT], { run: 1, keepRemoved: true })).toBe(false);
  });

  it('refuses one more chunk created past the runs, at either value\'s address', () => {
    expect(set([LONG, SHORT], [OTHER_SHORT, SHORT], { orphan: ORPHAN_CHUNK })).toBe(false);
    expect(set([SHORT, LONG], [OTHER_SHORT, SHORT], { run: 1, orphan: ORPHAN_CHUNK })).toBe(false);
  });

  it('refuses a chunk the body did not compute, in either run', () => {
    expect(set([SHORT, LONG], [OTHER_SHORT, SHORT], { writtenChunk: FOREIGN_CHUNK })).toBe(false);
    expect(set([LONG, SHORT], [OTHER_SHORT, OTHER_LONG], { run: 1, writtenChunk: FOREIGN_CHUNK })).toBe(false);
  });

  it('refuses the later run\'s old chunk spent from the first value\'s chunk address', () => {
    const spentInputLock = chunkLock(pair, 'first', type);
    expect(set([LONG, SHORT], [OTHER_SHORT, SHORT], { run: 1, spentInputLock })).toBe(false);
  });
});

describe('a framed master that appends to two string values', () => {
  // Both values are read and written back, so the later value's read loop steps past the earlier value's run too.
  const append = deploy(pairSource('string',
    'function add(string x, string y) {'
    + ' this.first = string.concat(this.first, x); this.second = string.concat(this.second, y); }'), 'string appends');
  // The later value is read before the earlier one is written: the read steps past the run the declaration states.
  const readFirst = deploy(pairSource('string',
    'function swap(string x, string y) {'
    + ' string memory kept = this.second; this.first = x; this.second = string.concat(kept, y); }'), 'string swap');
  // The earlier value is read, then the later one, then the earlier one written: only the body's whole footprint
  // says the later read steps past a run the body writes.
  const relayed = deploy(pairSource('string',
    'function relay(string x) {'
    + ' string memory moved = this.first; this.second = string.concat(this.second, moved); this.first = x; }'),
  'string relay');
  const BANG = distinctBytes(1, 0x21);
  const MARK = distinctBytes(2, 0x3f);
  /** 120 bytes fill one chunk exactly, so one more byte needs a second. */
  const FULL = distinctBytes(120, 0x13);
  const OTHER_FULL = distinctBytes(120, 0x2b);

  const add = (first: Uint8Array, second: Uint8Array, mutation: ChunkRunMutation = {}): boolean =>
    evaluateChunkRuns(append, {
      args: [BANG, MARK],
      runs: [
        { variable: 'first', type: 'string', spent: first, written: concat(first, BANG) },
        { variable: 'second', type: 'string', spent: second, written: concat(second, MARK) },
      ],
    }, mutation).accepted;
  const swap = (first: Versions, second: Uint8Array, mutation: ChunkRunMutation = {}): boolean =>
    evaluateChunkRuns(readFirst, {
      args: [first[1], MARK],
      runs: [
        { variable: 'first', type: 'string', spent: first[0], written: first[1] },
        { variable: 'second', type: 'string', spent: second, written: concat(second, MARK) },
      ],
    }, mutation).accepted;

  it('accepts the first value crossing into a second chunk', () => {
    expect(add(FULL, SHORT)).toBe(true);
  });

  it('accepts both values crossing into a second chunk', () => {
    expect(add(FULL, distinctBytes(119, 0x2f))).toBe(true);
  });

  it('accepts the second value crossing alone', () => {
    expect(add(SHORT, OTHER_FULL)).toBe(true);
  });

  it('refuses the later run declared where the first value\'s old count ends', () => {
    expect(add(FULL, SHORT, { laterRunsAt: 'spent' })).toBe(false);
  });

  it('refuses a later chunk the body did not compute', () => {
    expect(add(FULL, SHORT, { run: 1, writtenChunk: FOREIGN_CHUNK })).toBe(false);
  });

  it('accepts a read made before the earlier value is written, whether that value grows or shrinks', () => {
    expect(swap([SHORT, LONG], OTHER_SHORT)).toBe(true);
    expect(swap([LONG, SHORT], OTHER_SHORT)).toBe(true);
    expect(swap([LONG, EMPTY], OTHER_FULL)).toBe(true);
  });

  it('refuses that read\'s run declared at either of the earlier value\'s own counts', () => {
    expect(swap([SHORT, LONG], OTHER_SHORT, { laterRunsAt: 'spent' })).toBe(false);
    expect(swap([LONG, SHORT], OTHER_SHORT, { laterRunsAt: 'written' })).toBe(false);
  });

  it('accepts a later read past a run the body writes only after reading both values', () => {
    const relay = (first: Versions, second: Uint8Array, mutation: ChunkRunMutation = {}): boolean =>
      evaluateChunkRuns(relayed, {
        args: [first[1]],
        runs: [
          { variable: 'first', type: 'string', spent: first[0], written: first[1] },
          { variable: 'second', type: 'string', spent: second, written: concat(second, first[0]) },
        ],
      }, mutation).accepted;
    expect(relay([SHORT, LONG], OTHER_SHORT)).toBe(true);
    expect(relay([LONG, SHORT], OTHER_SHORT)).toBe(true);
    expect(relay([SHORT, LONG], OTHER_SHORT, { laterRunsAt: 'spent' })).toBe(false);
  });

  it('refuses that read served by a chunk spent from the earlier value\'s chunk address', () => {
    // The input carries the later value's own commitment; only its address belongs to the earlier value.
    expect(swap([LONG, SHORT], OTHER_SHORT, { run: 1, spentInputLock: chunkLock(readFirst, 'first', 'string') }))
      .toBe(false);
  });
});

/** An array element kind: how a run holds its values, and how the entry's argument carries one. */
interface ElementKind {
  readonly label: string;
  readonly element: string;
  readonly type: string;
  /** Distinct element values, as many as the shapes below need. */
  readonly values: readonly PrimitiveStateValue[];
  /** The value a push appends. */
  readonly added: PrimitiveStateValue;
  /** How many elements fill the first chunk: one more needs a second. */
  readonly perChunk: number;
  readonly encode: (values: readonly PrimitiveStateValue[]) => Uint8Array;
  readonly argument: (value: PrimitiveStateValue) => Uint8Array;
}

const KINDS: readonly ElementKind[] = [
  {
    // Packed at its 32-byte width with no count.
    label: 'a uint256[]',
    element: 'uint',
    type: 'uint256[]',
    values: [5n, 600n, 70_000n, 8_000_000n, 900_000_000n],
    added: 4_242n,
    perChunk: 3,
    encode: (values) => packFixedWidthArray([...values], 'uint256'),
    argument: (value) => encodeInt(value as bigint),
  },
  {
    // Framed behind a count push, each element behind its own length.
    label: 'an address[]',
    element: 'address',
    type: 'address[]',
    values: [0x13, 0x25, 0x37, 0x49, 0x5b].map((seed) => distinctLock(seed)),
    added: distinctLock(0x6d),
    perChunk: 4,
    encode: (values) => encodePushdataValue([...values], 'address[]'),
    argument: (value) => value as Uint8Array,
  },
];

describe.each(KINDS)('a framed master that writes a string beside $label', (kind) => {
  const mixSource = (entry: string, order: 'label first' | 'items first' = 'label first'): string =>
    'pragma solidcash ^0.14.0;'
    + ' contract Mix {'
    + (order === 'label first'
      ? `   string public label; ${kind.element}[] public items;`
      : `   ${kind.element}[] public items; string public label;`)
    + `   ${entry}`
    + ' }';
  const deployMix = (entry: string, label: string, order?: 'items first'): ChunkRunContract =>
    deploy(mixSource(entry, order), `${kind.label} ${label}`);
  const grow = deployMix(`function grow(string x, ${kind.element} v) { this.label = x; this.items.push(v); }`, 'grow');
  const shrink = deployMix('function shrink(string x) { this.label = x; this.items.pop(); }', 'shrink');
  // The push reads the array before the label is written.
  const pushFirst = deployMix(
    `function pushFirst(${kind.element} v, string x) { this.items.push(v); this.label = x; }`, 'push first',
  );
  const itemsFirst = deployMix(
    `function grow(${kind.element} v, string x) { this.items.push(v); this.label = x; }`, 'items first', 'items first',
  );

  const held = (count: number): PrimitiveStateValue[] => kind.values.slice(0, count) as PrimitiveStateValue[];
  /** An array the deployment has never written holds no bytes. */
  const spentItems = (values: readonly PrimitiveStateValue[]): Uint8Array =>
    (values.length === 0 ? EMPTY : kind.encode(values));

  const pushed = (
    contract: ChunkRunContract, label: Versions, items: readonly PrimitiveStateValue[],
    mutation: ChunkRunMutation = {},
  ): boolean => {
    const labelRun = { variable: 'label', type: 'string', spent: label[0], written: label[1] };
    const itemsRun = {
      variable: 'items', type: kind.type, spent: spentItems(items), written: kind.encode([...items, kind.added]),
    };
    return evaluateChunkRuns(contract, {
      args: contract === grow ? [label[1], kind.argument(kind.added)] : [kind.argument(kind.added), label[1]],
      runs: contract === itemsFirst ? [itemsRun, labelRun] : [labelRun, itemsRun],
    }, mutation).accepted;
  };
  const popped = (label: Versions, items: readonly PrimitiveStateValue[], mutation: ChunkRunMutation = {}): boolean =>
    evaluateChunkRuns(shrink, {
      args: [label[1]],
      runs: [
        { variable: 'label', type: 'string', spent: label[0], written: label[1] },
        { variable: 'items', type: kind.type, spent: spentItems(items), written: kind.encode(items.slice(0, -1)) },
      ],
    }, mutation).accepted;

  it('is emitted as a framed master for every entry, with the shapes crossing chunk boundaries as stated', () => {
    for (const contract of [grow, shrink, pushFirst, itemsFirst]) {
      expect(contract.artifact.composition?.convention).toBe('framed');
      expect(contract.artifact.composition!.refusedEntries).toBeUndefined();
    }
    expect(kind.encode(held(kind.perChunk)).length).toBeLessThanOrEqual(120);
    expect(kind.encode(held(kind.perChunk + 1)).length).toBeGreaterThan(120);
  });

  it('accepts the label grown beside a push inside one chunk', () => {
    expect(pushed(grow, [SHORT, LONG], held(2))).toBe(true);
  });

  it('accepts the label shrunk beside a push inside one chunk', () => {
    expect(pushed(grow, [LONG, SHORT], held(2))).toBe(true);
  });

  it('accepts both grown: the label and a push into a second chunk', () => {
    expect(pushed(grow, [SHORT, LONG], held(kind.perChunk))).toBe(true);
  });

  it('accepts one shrunk while the other grows, either way round', () => {
    expect(pushed(grow, [LONG, SHORT], held(kind.perChunk))).toBe(true);
    expect(popped([SHORT, LONG], held(kind.perChunk + 1))).toBe(true);
  });

  it('accepts the label emptied beside a push', () => {
    expect(pushed(grow, [SHORT, EMPTY], held(2))).toBe(true);
  });

  it('accepts a push onto an empty array beside a label that grows', () => {
    expect(pushed(grow, [SHORT, LONG], [])).toBe(true);
  });

  it('accepts the push read before the label is written, whether the label grows or shrinks', () => {
    expect(pushed(pushFirst, [SHORT, LONG], held(2))).toBe(true);
    expect(pushed(pushFirst, [LONG, SHORT], held(kind.perChunk))).toBe(true);
  });

  it('accepts the array declared first, its run leading the label\'s', () => {
    expect(pushed(itemsFirst, [SHORT, LONG], held(kind.perChunk))).toBe(true);
    expect(pushed(itemsFirst, [LONG, SHORT], held(2))).toBe(true);
  });

  it('refuses the later run declared where the first value\'s old count ends after it grows', () => {
    expect(pushed(grow, [SHORT, LONG], held(2), { laterRunsAt: 'spent' })).toBe(false);
    expect(pushed(pushFirst, [SHORT, LONG], held(2), { laterRunsAt: 'spent' })).toBe(false);
    expect(pushed(itemsFirst, [SHORT, LONG], held(kind.perChunk), { laterRunsAt: 'spent' })).toBe(false);
  });

  it('refuses the later run declared where the first value\'s new count ends after it shrinks', () => {
    expect(pushed(grow, [LONG, SHORT], held(2), { laterRunsAt: 'written' })).toBe(false);
    expect(pushed(pushFirst, [LONG, SHORT], held(kind.perChunk), { laterRunsAt: 'written' })).toBe(false);
  });

  it('refuses a chunk a shrink drops left unspent, in either run', () => {
    expect(pushed(grow, [LONG, SHORT], held(2), { leaveRemoved: true })).toBe(false);
    expect(popped([SHORT, LONG], held(kind.perChunk + 1), { run: 1, leaveRemoved: true })).toBe(false);
  });

  it('refuses one more chunk created past the runs, at either value\'s address', () => {
    expect(pushed(grow, [LONG, SHORT], held(2), { orphan: ORPHAN_CHUNK })).toBe(false);
    expect(pushed(grow, [SHORT, LONG], held(2), { run: 1, orphan: ORPHAN_CHUNK })).toBe(false);
  });

  it('refuses a chunk the body did not compute, in either run', () => {
    expect(pushed(grow, [SHORT, LONG], held(2), { writtenChunk: FOREIGN_CHUNK })).toBe(false);
    // The array's chunk as it was before the push, which the body did not write.
    const stale = chunk(0, kind.encode(held(kind.perChunk)));
    expect(pushed(grow, [LONG, SHORT], held(kind.perChunk), { run: 1, writtenChunk: stale })).toBe(false);
  });
});

describe('a framed master that pops a uint256[] to nothing beside a string', () => {
  const shrink = deploy('pragma solidcash ^0.14.0; contract Mix { string public label; uint[] public items;'
    + ' function shrink(string x) { this.label = x; this.items.pop(); } }', 'uint256 pop to nothing');
  const popLast = (label: Versions, mutation: ChunkRunMutation = {}): boolean => evaluateChunkRuns(shrink, {
    args: [label[1]],
    runs: [
      { variable: 'label', type: 'string', spent: label[0], written: label[1] },
      { variable: 'items', type: 'uint256[]', spent: packFixedWidthArray([9n], 'uint256'), written: EMPTY },
    ],
  }, mutation).accepted;

  it('accepts the array emptied, its only chunk consumed, beside a label that grows or shrinks', () => {
    expect(popLast([SHORT, LONG])).toBe(true);
    expect(popLast([LONG, SHORT])).toBe(true);
  });

  it('refuses the array\'s only chunk left unspent or declared where the label\'s new count ends', () => {
    expect(popLast([SHORT, LONG], { run: 1, leaveRemoved: true })).toBe(false);
    expect(popLast([LONG, SHORT], { laterRunsAt: 'written' })).toBe(false);
  });
});

describe('a framed master that writes a mapping beside its dynamic values', () => {
  // The batch's walk holds every record past its group to the records the body pinned: a run counts the wider of
  // its two versions, so a shrink's consumed chunks are among them.
  const ledgerSource = (values: string, entry: string): string => 'pragma solidcash ^0.14.0;'
    + ' contract Ledger {'
    + `   ${values}`
    + '   mapping(address => uint) public balances;'
    + `   ${entry}`
    + ' }';
  const one = deploy(ledgerSource('string public label;',
    'function set(address who, uint amount, string x) { this.balances[who] = amount; this.label = x; }'),
  'ledger one value');
  const two = deploy(ledgerSource('string public label; string public note;',
    'function set(address who, uint amount, string x, string y) {'
    + ' this.balances[who] = amount; this.label = x; this.note = y; }'), 'ledger two values');

  const WHO = distinctBytes(20, 0x35);
  const SLOT = keyToSlot(WHO);
  const ZERO_SLOT = new Uint8Array(32);
  const AMOUNT = new Uint8Array([42]);
  const nodeLock = (contract: ChunkRunContract): Uint8Array => scriptToLockingBytecode(buildEntryNftCovenantScript(
    contract.category, computeCollectionHash(contract.artifact.stateLayout!.collections![0]!.signature),
  ), 'p2sh32');
  /** The key the list holds: its node is rewritten in place. */
  const update = (contract: ChunkRunContract): LeadingRecord[] => [{
    lock: nodeLock(contract),
    viewIn: encodeEntryCommitment(SLOT, ZERO_SLOT, new Uint8Array([7])),
    viewOut: encodeEntryCommitment(SLOT, ZERO_SLOT, AMOUNT),
  }];
  /** The key the empty list does not hold: the head is relinked to it and its node created. */
  const insert = (contract: ChunkRunContract): LeadingRecord[] => [
    {
      lock: nodeLock(contract),
      viewIn: encodeEntryCommitment(ZERO_SLOT, ZERO_SLOT),
      viewOut: encodeEntryCommitment(ZERO_SLOT, SLOT),
    },
    { lock: nodeLock(contract), viewIn: EMPTY, viewOut: encodeEntryCommitment(SLOT, ZERO_SLOT, AMOUNT) },
  ];

  const setOne = (
    group: LeadingRecord[], label: Versions, mutation: ChunkRunMutation = {},
  ): boolean => evaluateChunkRuns(one, {
    args: [WHO, AMOUNT, label[1]],
    leading: group,
    runs: [{ variable: 'label', type: 'string', spent: label[0], written: label[1] }],
  }, mutation).accepted;
  const setTwo = (label: Versions, note: Versions, mutation: ChunkRunMutation = {}): boolean =>
    evaluateChunkRuns(two, {
      args: [WHO, AMOUNT, label[1], note[1]],
      leading: update(two),
      runs: [
        { variable: 'label', type: 'string', spent: label[0], written: label[1] },
        { variable: 'note', type: 'string', spent: note[0], written: note[1] },
      ],
    }, mutation).accepted;

  it('is emitted as a framed master for both entries', () => {
    for (const contract of [one, two]) {
      expect(contract.artifact.composition?.convention).toBe('framed');
      expect(contract.artifact.composition!.refusedEntries).toBeUndefined();
    }
  });

  it('accepts the run grown beside an update and beside an insert, the shape already served', () => {
    expect(setOne(update(one), [SHORT, LONG])).toBe(true);
    expect(setOne(insert(one), [SHORT, LONG])).toBe(true);
  });

  it('accepts the run shrunk from two chunks to one beside an update and beside an insert', () => {
    expect(setOne(update(one), [LONG, SHORT])).toBe(true);
    expect(setOne(insert(one), [LONG, SHORT])).toBe(true);
  });

  it('accepts the run emptied beside an update', () => {
    expect(setOne(update(one), [SHORT, EMPTY])).toBe(true);
  });

  it('accepts two runs beside an update, the first shrunk and the second grown, and the other way round', () => {
    expect(setTwo([LONG, SHORT], [OTHER_SHORT, OTHER_LONG])).toBe(true);
    expect(setTwo([SHORT, LONG], [OTHER_LONG, OTHER_SHORT])).toBe(true);
  });

  it('refuses a shrink that leaves the chunk it drops unspent, or writes it back', () => {
    expect(setOne(update(one), [LONG, SHORT], { leaveRemoved: true })).toBe(false);
    expect(setOne(update(one), [LONG, SHORT], { keepRemoved: true })).toBe(false);
    expect(setTwo([SHORT, LONG], [OTHER_LONG, OTHER_SHORT], { run: 1, leaveRemoved: true })).toBe(false);
  });

  it('refuses one more chunk created past the run beside the batch', () => {
    expect(setOne(update(one), [LONG, SHORT], { orphan: ORPHAN_CHUNK })).toBe(false);
    expect(setTwo([LONG, SHORT], [OTHER_SHORT, OTHER_LONG], { run: 1, orphan: ORPHAN_CHUNK })).toBe(false);
  });

  it('refuses a chunk the body did not compute beside the batch', () => {
    expect(setOne(update(one), [LONG, SHORT], { writtenChunk: FOREIGN_CHUNK })).toBe(false);
    expect(setTwo([LONG, SHORT], [OTHER_SHORT, OTHER_LONG], { run: 1, writtenChunk: FOREIGN_CHUNK })).toBe(false);
  });

  it('refuses the later run declared at either of the first value\'s own counts beside the batch', () => {
    expect(setTwo([SHORT, LONG], [OTHER_SHORT, SHORT], { laterRunsAt: 'spent' })).toBe(false);
    expect(setTwo([LONG, SHORT], [OTHER_SHORT, SHORT], { laterRunsAt: 'written' })).toBe(false);
  });
});
