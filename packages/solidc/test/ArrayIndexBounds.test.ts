import { describe, expect, it } from 'vitest';
import {
  binToHex, createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import {
  asmToScript, encodeChunkableValueTail, encodeIntegerValue, encodePushdataValue, packFixedWidthArray,
  scriptToBytecode, type Artifact,
} from '@solidcash/utils';
import { keyToSlotMulti } from '../../solidcash/src/stateful/SortedList.js';
import { compileString } from '../src/index.js';
import { deployFramedMaster, distinctBytes, evaluateMasterSpend, node, spent } from './framed/master/record-spend.js';
import { deployChunkRunContract, evaluateChunkRuns } from './framed/master/chunk-run-input.js';

/**
 * An index outside [0, length) fails on the BCH-2026 machine, as Solidity's index check reverts, on both conventions.
 *
 * A memory array, byte buffer or struct array lives in the function's linear buffer, where an unchecked element
 * address names a neighbouring word: an index past the end read or overwrote the next allocation's length word and
 * elements, and a negative `int` index read or overwrote the array's own length word. Each access now checks its
 * index against the length, and a literal index the type checker refuses elsewhere is refused here too.
 *
 * A value array, a mapping's array value and a state array index a value blob behind `index < length`: a negative
 * index splits at a negative offset, or scans a variable-width blob for an element it never reaches, and fails.
 */

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type Arg = bigint | Uint8Array;
const push = (arg: Arg): Uint8Array => (typeof arg === 'bigint' ? encodeIntegerValue(arg) : arg);

/** Verifies a direct spend of the single entry of a stateless contract with `args` in parameter order. */
function settleDirect(artifact: Artifact, args: readonly Arg[]): boolean {
  const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
  const pushes = [...args].reverse().flatMap((arg) => [...encodeDataPush(push(arg))]);
  const transaction: VmTransaction = {
    version: 2,
    locktime: 0,
    inputs: [{
      outpointIndex: 0, outpointTransactionHash: distinctBytes(32, 0x61), sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array([...pushes, ...encodeDataPush(redeem)]),
    }],
    outputs: [{ lockingBytecode: Uint8Array.from([0x51]), valueSatoshis: 1_000n }],
  };
  const sourceOutputs: VmProgram['sourceOutputs'] = [
    { lockingBytecode: encodeLockingBytecodeP2sh32(hash256(redeem)), valueSatoshis: 10_000n },
  ];
  return createVirtualMachineBch2026().verify({ sourceOutputs, transaction }) === true;
}

const P = 'pragma solidcash ^0.14.0;';

/** The entry `f` of `members`, settled on each convention. */
function conventions(members: string, label: string): Array<[string, (args: readonly Arg[]) => boolean]> {
  const source = `${P} contract C { ${members} }`;
  const direct = compileString(source, { messageBus: false });
  const master = deployFramedMaster(source, label);
  return [
    ['direct', (args) => settleDirect(direct, args)],
    ['framed', (args) => evaluateMasterSpend(master, { args: [...args].reverse().map(push), records: [] }).accepted],
  ];
}

/** Each convention accepts every honest argument list and refuses every out-of-range one. */
function expectBounds(members: string, label: string, honest: readonly Arg[][], outside: readonly Arg[][]): void {
  for (const [convention, settle] of conventions(members, label)) {
    const named = (args: readonly Arg[]): string =>
      `${convention} ${args.map((arg) => (typeof arg === 'bigint' ? arg : binToHex(arg))).join(',')}`;
    for (const args of honest) expect(settle(args), named(args)).toBe(true);
    for (const args of outside) expect(settle(args), named(args)).toBe(false);
  }
}

describe('a memory index outside the length', () => {
  it('refuses a value-array read past the end or below zero, which named the next allocation or the length word', () => {
    const members = 'function f(int i, uint e) { uint[] memory a = new uint[](3); uint[] memory b = new uint[](2);'
      + ' a[2] = 5; b[0] = 7; require(a[i] == e); }';
    // a[3] was b's length word, a[4] was b[0], and a[-1] was a's own length word.
    expectBounds(members, 'value array read', [[2n, 5n], [0n, 0n]], [[3n, 2n], [4n, 7n], [-1n, 3n]]);
  });

  it('refuses a value-array write past the end or below zero, which overwrote a length word', () => {
    const members = 'function f(int i, uint d, uint e) { uint[] memory a = new uint[](3);'
      + ' uint[] memory b = new uint[](2); a[i] = 9; require(a.length == d); require(b.length == e); }';
    expectBounds(members, 'value array write', [[2n, 3n, 2n]], [[3n, 3n, 9n], [-1n, 9n, 2n]]);
  });

  it('refuses a byte-buffer read or write past the length, which reached the padding and the next buffer', () => {
    const read = 'function f(int i, uint e) { bytes memory a = new bytes(3); bytes memory b = new bytes(2);'
      + ' a[2] = 0x05; b[0] = 0x07; require(uint8(a[i]) == e); }';
    expectBounds(read, 'byte buffer read', [[2n, 5n]], [[3n, 0n], [32n, 2n], [-1n, 0n]]);
    const write = 'function f(int i, uint e) { bytes memory a = new bytes(3); bytes memory b = new bytes(2);'
      + ' a[i] = 0x09; require(b.length == e); }';
    expectBounds(write, 'byte buffer write', [[2n, 2n]], [[32n, 9n], [32n, 2n]]);
  });

  it('refuses a struct-array element read, field write or element write past the end', () => {
    const struct = 'struct S { uint v; } ';
    const read = `${struct}function f(int i, uint e) { S[] memory a = new S[](2); a[0] = S(5); a[1] = S(6);`
      + ' S[] memory b = new S[](1); b[0] = S(7); require(a[i].v == e); }';
    // a[2] was the first element's struct word read as a pointer, and a[-1] the length word: both read zero.
    expectBounds(read, 'struct array read', [[1n, 6n], [0n, 5n]], [[2n, 0n], [-1n, 0n]]);
    const field = `${struct}function f(int i, uint e) { S[] memory a = new S[](1); a[0] = S(5);`
      + ' a[i].v = 9; require(a[0].v == e); }';
    expectBounds(field, 'struct array field write', [[0n, 9n]], [[1n, 5n], [-1n, 5n]]);
    const element = `${struct}function f(int i, uint e) { S[] memory a = new S[](2); a[0] = S(5);`
      + ' a[i] = S(9); require(a[0].v == e); }';
    // a[2] = S(9) stored the new struct's pointer (256) over the first element's field.
    expectBounds(element, 'struct array element write', [[1n, 5n], [0n, 9n]], [[2n, 256n], [2n, 5n]]);
  });

  it('refuses a delete past the end, which zeroed the next allocation\'s length word', () => {
    const members = 'function f(int i, uint e) { uint[] memory a = new uint[](2); uint[] memory b = new uint[](2);'
      + ' a[1] = 4; delete a[i]; require(b.length == e); }';
    expectBounds(members, 'value array delete', [[1n, 2n]], [[2n, 0n], [2n, 2n]]);
  });

  it('refuses a literal index past a dynamic array\'s length, and a literal run of writes that crosses it', () => {
    const read = 'function f(uint e) { uint[] memory a = new uint[](1); uint[] memory b = new uint[](2);'
      + ' require(a[1] == e); }';
    expectBounds(read, 'literal read', [], [[2n], [0n]]);
    const run = (length: number): string => `function f(uint e) { uint[] memory a = new uint[](${length});`
      + ' uint[] memory b = new uint[](2); a[0] = 4; a[1] = 5; require(b.length == e); }';
    expectBounds(run(2), 'literal run inside', [[2n]], []);
    expectBounds(run(1), 'literal run across', [], [[5n], [2n]]);
  });

  it('refuses an index past an array a struct field points at', () => {
    const members = 'struct T { uint[] a; } function f(int i, uint e) { uint[] memory x = new uint[](2); x[1] = 5;'
      + ' T memory s = T(x); uint[] memory b = new uint[](2); require(s.a[i] == e); }';
    // s.a[2] was the struct's own word, the pointer to x (128), and s.a[-1] was x's length word.
    expectBounds(members, 'chained array read', [[1n, 5n]], [[2n, 128n], [-1n, 2n]]);
  });

  it('indexes a fixed array that assembly observes without a length header', () => {
    const init = 'function f(int i, uint e) { uint[3] memory a = [uint(4), 5, 6]; uint p; assembly { p := a }'
      + ' require(a[i] == e); }';
    // The initializer stored each element one word past its slot, the last past the allocation: every call failed.
    expectBounds(init, 'fixed initializer', [[0n, 4n], [2n, 6n]], [[3n, 0n], [-1n, 0n]]);
    const del = 'function f(int i, uint e) { uint[3] memory a; uint p; assembly { p := a } a[0] = 4; a[1] = 5;'
      + ' delete a[0]; require(a[i] == e); }';
    // `delete a[0]` zeroed a[1].
    expectBounds(del, 'fixed delete', [[0n, 0n], [1n, 5n]], [[0n, 4n], [1n, 0n]]);
  });

  it('refuses at compile a negative literal index, and a literal index past a fixed bound', () => {
    const negative = `${P} contract C { function f(uint e) { uint[] memory a = new uint[](2); require(a[-1] == e); } }`;
    const past = `${P} contract C { function f(uint e) { uint[3] memory a; uint p; assembly { p := a }`
      + ' require(a[3] == e); } }';
    for (const options of [{ messageBus: false }, { composition: 'framed' as const }]) {
      expect(() => compileString(negative, options)).toThrow('Index out of bounds');
      expect(() => compileString(past, options)).toThrow('Index 3 out of bounds');
    }
  });
});

/** Readers and writers of a memory array whose index has a side effect, which each must take exactly once. */
const ONCE_MEMBERS = 'uint n; mapping(address => uint) m;'
  + ' function next() internal returns (uint) { this.n = this.n + 1; return this.n - 1; }'
  + ' function readOnce(uint e) { uint[] memory a = new uint[](3); a[0] = 7; a[1] = 8; a[2] = 9;'
  + ' uint before = this.n; uint x = a[next()]; require(this.n == before + 1); require(x == e); }'
  + ' function writeOnce(uint e) { uint[] memory a = new uint[](3); uint before = this.n; a[next()] = e;'
  + ' require(this.n == before + 1); require(a[before] == e); }'
  + ' function byteOnce(uint e) { bytes memory a = new bytes(3); a[1] = 0x05; uint before = this.n;'
  + ' uint x = uint8(a[next() + 1]); require(this.n == before + 1); require(x == e); }';

describe('a memory index evaluated once', () => {
  it('calls a function in the index once, for a word read, a word write and a byte read, per call', () => {
    // The load evaluated its address at both ends and once more in the check, so `next()` ran three times; the
    // record now steps n once, and the body's own `this.n == before + 1` holds.
    const master = deployFramedMaster(`${P} contract C { ${ONCE_MEMBERS} }`, 'memory index once');
    const spend = (entry: string, e: bigint, after: bigint): boolean => evaluateMasterSpend(master, {
      entry,
      args: [encodeIntegerValue(e)],
      records: [spent(master.recordLock, 2, master.record({ n: 0n }), master.record({ n: after }))],
    }).accepted;
    for (const [entry, e] of [['readOnce', 7n], ['writeOnce', 4n], ['byteOnce', 5n]] as const) {
      expect(spend(entry, e, 1n), entry).toBe(true);
      for (const after of [2n, 3n]) expect(spend(entry, e, after), `${entry} ${after}`).toBe(false);
    }
    expect(spend('readOnce', 8n, 1n)).toBe(false);
  });

  it('steps a postfix index once, for a write and a read', () => {
    const members = 'function f(uint e) { uint[] memory a = new uint[](3); uint i = 1; a[i++] = e; uint x = a[i++];'
      + ' require(i == 3); require(a[1] == e); require(x == 0); }';
    expectBounds(members, 'postfix index', [[6n]], []);
  });
});

describe('an index a counted loop keeps in range', () => {
  it('reads and writes without a check under `i < a.length`, `i < n` or a literal size, including nested loops', () => {
    const sum = 'function f(uint e) { uint[] memory a = new uint[](3); a[1] = 4; a[2] = 5; uint s = 0;'
      + ' for (uint i = 0; i < a.length; i++) { s = s + a[i]; } require(s == e); }';
    expectBounds(sum, 'loop length sum', [[9n]], [[0n]]);
    const fill = 'function f(uint n, uint e) { uint[] memory a = new uint[](n);'
      + ' for (uint i = 0; i < n; i++) { a[i] = i; } require(a[n - 1] == e); }';
    expectBounds(fill, 'loop size fill', [[3n, 2n]], [[3n, 1n]]);
    const copy = 'function f(int[] xs, uint e) { uint[] memory out = new uint[](xs.length);'
      + ' for (uint i = 0; i < xs.length; i++) { out[i] = uint(xs[i]) + 1; } require(out[1] == e); }';
    const xs = encodePushdataValue([4n, 5n], 'int[]');
    expectBounds(copy, 'loop length-of copy', [[xs, 6n]], [[xs, 5n]]);
    const bytes = 'function f(uint n, uint e) { bytes memory b = new bytes(n);'
      + ' for (uint i = 0; i < n; i++) { b[i] = 0x02; } require(uint8(b[n - 1]) == e); }';
    expectBounds(bytes, 'loop byte fill', [[3n, 2n]], [[3n, 0n]]);
    const nested = 'function f(uint e) { uint[] memory a = new uint[](3); a[0] = 1; a[1] = 2; a[2] = 3; uint s = 0;'
      + ' for (uint i = 0; i < a.length; i++) { for (uint j = i + 1; j < 3; j++) { s = s + a[i] * a[j]; } }'
      + ' require(s == e); }';
    expectBounds(nested, 'nested loops', [[11n]], [[0n]]);
  });

  it('keeps the check where the loop does not hold the index in range', () => {
    // Each refused index would read the next allocation's length word (2) or the array's own (3) unchecked.
    const ONE = encodePushdataValue([4n], 'int[]');
    const THREE = encodePushdataValue([4n, 5n, 6n], 'int[]');
    const shapes: Array<[string, string, Arg[][]]> = [
      ['turn steps the counter', 'function f(uint e) { uint[] memory a = new uint[](3); uint[] memory b = new uint[](2);'
        + ' uint x = 0; for (uint i = 0; i < a.length; i++) { i = i + 3; x = a[i]; } require(x == e); }', [[2n], [0n]]],
      // `delete a` points a at the null word; unchecked, a[0] read the reserved region's zero word.
      ['turn clears the array', 'function f(uint e) { uint[] memory a = new uint[](3); uint x = 7;'
        + ' for (uint i = 0; i < a.length; i++) { delete a; x = a[i]; } require(x == e); }', [[0n], [7n]]],
      ['condition steps the counter', 'function f(bool c, uint e) { uint[] memory a = new uint[](3);'
        + ' uint[] memory b = new uint[](2); uint x = 0; uint i = 0;'
        + ' while (i < a.length && (c || (i = i + 3) > 0)) { x = a[i]; i = i + 1; } require(x == e); }',
      [[0n, 2n], [0n, 0n]]],
      ['size written after the allocation', 'function f(uint n, uint e) { uint[] memory a = new uint[](n);'
        + ' uint[] memory b = new uint[](2); n = n + 1; uint x = 0; for (uint i = 0; i < n; i++) { x = a[i]; }'
        + ' require(x == e); }', [[2n, 2n], [2n, 0n]]],
      ['length source reassigned', 'function f(int[] xs, int[] ys, uint e) { uint[] memory out = new uint[](xs.length);'
        + ' uint[] memory b = new uint[](2); xs = ys; uint x = 0; for (uint i = 0; i < xs.length; i++) { x = out[i]; }'
        + ' require(x == e); }', [[ONE, THREE, 2n], [ONE, THREE, 0n]]],
      ['assembly beside the size', 'function f(uint n, uint e) { uint[] memory a = new uint[](n);'
        + ' uint[] memory b = new uint[](2); assembly { n := add(n, 1) } uint x = 0;'
        + ' for (uint i = 0; i < n; i++) { x = a[i]; } require(x == e); }', [[2n, 2n], [2n, 0n]]],
      ['another array', 'function f(uint e) { uint[] memory a = new uint[](3); uint[] memory b = new uint[](2);'
        + ' uint[] memory c = new uint[](2); uint x = 0; for (uint i = 0; i < a.length; i++) { x = b[i]; }'
        + ' require(x == e); }', [[2n], [0n]]],
      ['negative start', 'function f(uint e) { uint[] memory a = new uint[](3); uint x = 7;'
        + ' for (int i = -1; i < a.length; i++) { x = a[i]; } require(x == e); }', [[3n], [0n]]],
      ['inner start below zero', 'function f(uint e) { uint[] memory a = new uint[](3); uint x = 7;'
        + ' for (int i = 0; i < 3; i++) { for (int j = i - 1; j < 3; j++) { x = a[j]; } } require(x == e); }',
      [[3n], [0n]]],
    ];
    for (const [label, members, outside] of shapes) expectBounds(members, label, [], outside);
  });
});

describe('a negative index into a value blob', () => {
  it('refuses a negative index into a fixed-width or variable-width array argument', () => {
    const fixed = 'function f(int[] xs, int i, int e) { require(xs[i] == e); }';
    const xs = encodePushdataValue([4n, 5n], 'int[]');
    expectBounds(fixed, 'fixed argument', [[xs, 1n, 5n]], [[xs, -1n, 5n], [xs, -1n, 0n]]);
    // A variable-width scan counts down from a negative index without reaching zero, so it spends the whole
    // operation budget: one refusal per convention is enough.
    const variable = 'function f(bytes[] xs, int i, bytes e) { require(xs[i] == e); }';
    const second = distinctBytes(3, 0x47);
    const blobs = encodePushdataValue([distinctBytes(2, 0x31), second], 'bytes[]');
    expectBounds(variable, 'variable argument', [[blobs, 1n, second]], [[blobs, -1n, second]]);
  });

  it('refuses a negative framed index into a mapping\'s fixed-width or variable-width array value', () => {
    const id = encodeIntegerValue(7n);
    const slot = keyToSlotMulti([id]);
    const kinds = [distinctBytes(4, 0x15), distinctBytes(4, 0x3c)];
    const fixed = deployFramedMaster(`${P} contract C { mapping(uint => bytes4[]) logs;`
      + ' function at(uint id, int i, bytes4 e) { require(this.logs[id][i] == e); } }', 'negative mapping fixed');
    const fixedNode = node(slot, undefined, encodeChunkableValueTail(encodePushdataValue(kinds, 'bytes4[]')));
    const fixedAt = (i: bigint, e: Uint8Array): boolean => evaluateMasterSpend(fixed, {
      args: [e, encodeIntegerValue(i), id], records: [spent(fixed.collectionLock('logs'), 2, fixedNode)],
    }).accepted;
    expect(fixedAt(1n, kinds[1]!)).toBe(true);
    for (const e of [kinds[0]!, kinds[1]!, new Uint8Array(4)]) expect(fixedAt(-1n, e)).toBe(false);

    const notes = [distinctBytes(2, 0x52), distinctBytes(5, 0x6e)];
    const variable = deployFramedMaster(`${P} contract C { mapping(uint => bytes[]) notes;`
      + ' function at(uint id, int i, bytes e) { require(this.notes[id][i] == e); } }', 'negative mapping variable');
    const variableNode = node(slot, undefined, encodeChunkableValueTail(encodePushdataValue(notes, 'bytes[]')));
    const variableAt = (i: bigint, e: Uint8Array): boolean => evaluateMasterSpend(variable, {
      args: [e, encodeIntegerValue(i), id], records: [spent(variable.collectionLock('notes'), 2, variableNode)],
    }).accepted;
    expect(variableAt(1n, notes[1]!)).toBe(true);
    expect(variableAt(-1n, notes[1]!)).toBe(false);
  });

  it('refuses a negative framed index into a state array, read or written', () => {
    const values = [5n, 600n];
    const items = packFixedWidthArray(values, 'uint256');
    const contract = (entry: string, label: string): ReturnType<typeof deployChunkRunContract> => deployChunkRunContract(
      compileString(`${P} contract Ledger { uint[] public items; ${entry} }`, { composition: 'framed' }), label,
    );
    const check = contract('function check(int index, uint value) { uint count = this.items.length;'
      + ' require(this.items[index] == value); require(count > 0); }', 'negative state read');
    const read = (index: bigint, value: bigint): boolean => evaluateChunkRuns(check, {
      args: [encodeIntegerValue(index), encodeIntegerValue(value)],
      runs: [{ variable: 'items', type: 'uint256[]', spent: items, written: items }],
    }).accepted;
    expect(read(1n, 600n)).toBe(true);
    for (const value of [5n, 600n, 0n]) expect(read(-1n, value)).toBe(false);

    const put = contract('function put(int index, uint value) { this.items[index] = value; }', 'negative state write');
    const write = (index: bigint, written: readonly bigint[]): boolean => evaluateChunkRuns(put, {
      args: [encodeIntegerValue(index), encodeIntegerValue(9n)],
      runs: [{ variable: 'items', type: 'uint256[]', spent: items, written: packFixedWidthArray([...written], 'uint256') }],
    }).accepted;
    expect(write(1n, [5n, 9n])).toBe(true);
    for (const written of [[5n, 600n], [9n, 600n], [5n, 9n]]) expect(write(-1n, written)).toBe(false);
  });
});
