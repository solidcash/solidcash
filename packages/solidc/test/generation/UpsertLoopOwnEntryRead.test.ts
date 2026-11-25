import { describe, expect, it } from 'vitest';
import { compileString, compileStringMulti } from '../../src/compiler.js';

// A sorted-mapping loop write `m[k] = m[k] + v` is the compact transition the covenant folds into the entry it
// co-spends (`op` '+' or '-'): the new value is that entry's old value plus or minus `v`. Only a read of the entry the
// write assigns, the same mapping at the same key, is that old value. Any read of a mapping on the left of `+` or `-`
// used to be taken for it, so `bal[ks[i]] = bal[7] + 1` stored `bal[ks[i]] + 1`: with bal[3] = 5 and bal[7] = 50,
// `put([3])` stored 6 where the EVM stores 51. A write whose operand is another entry stores an absolute value (`op`
// 'set'), which the covenant computes from that entry's own authenticated read. The same held for a counter loop, where
// LowerVMapCounterLoops marked any such read as the entry's own transition read.
const book = (body: string): string => `contract Book() { mapping(int => int) bal; mapping(int => int) other;
  event Seen(int k, int v);
  function seed(int a, int v) { this.bal[a] = v; }
  function put(int[] ks, int[] vs) { for (int i = 0; i < ks.length; i++) { ${body} } } }`;
const safeMath = (body: string): string => `pragma solidity ^0.8.0;
library SafeMath {
  function add(uint256 a, uint256 b) internal pure returns (uint256) { uint256 c = a + b; require(c >= a); return c; }
  function sub(uint256 a, uint256 b) internal pure returns (uint256) { require(b <= a); return a - b; }
}
contract Book {
  using SafeMath for uint256;
  mapping(uint256 => uint256) bal;
  mapping(uint256 => uint256) other;
  function seed(uint256 a, uint256 v) public { bal[a] = v; }
  function put(uint256[] memory ks, uint256[] memory vs) public {
    for (uint256 i = 0; i < ks.length; i++) { ${body} }
  }
}`;
const quiet = { suppressWarnings: true };
const conventions = {
  auto: (source: string, options: object = {}) => compileString(source, { ...quiet, ...options }),
  direct: (source: string, options: object = {}) => compileString(source, { ...quiet, ...options }),
  framed: (source: string, options: object = {}) => Object.values(compileStringMulti(source, {
    ...quiet, composition: 'framed', ...options,
  })).find((artifact) => artifact.abi.some((entry) => entry.name === 'put'))!,
};

/** The published op of the loop's write to `bal`. */
const opOf = (artifact: ReturnType<typeof compileString>): string | undefined => artifact.abi
  .find((entry) => entry.name === 'put')?.sortedUpsertLoopInfo?.find((info) => info.collection === 'bal')?.op;

describe('a sorted-mapping loop write folds only its own entry', () => {
  it.each([
    ['another entry of the mapping', 'this.bal[ks[i]] = this.bal[7] + 1;'],
    ['another entry, subtracted from', 'this.bal[ks[i]] = this.bal[7] - 1;'],
    ['the same key of another mapping', 'this.bal[ks[i]] = this.other[ks[i]] + 1;'],
    ['another key of the array', 'this.bal[ks[i]] = this.bal[ks[0]] + 1;'],
    ['another entry beside a per-turn value', 'this.bal[ks[i]] = this.bal[7] + vs[i];'],
    ['another entry, with an event per turn', 'this.bal[ks[i]] = this.bal[7] + 1; emit Seen(ks[i], i);'],
    ['another mapping, with an event per turn', 'this.bal[ks[i]] = this.other[ks[i]] + 1; emit Seen(ks[i], i);'],
  ])('stores the value of a write that reads %s', (_label, body) => {
    for (const [name, compile] of Object.entries(conventions)) {
      expect([name, opOf(compile(book(body)))]).toStrictEqual([name, 'set']);
    }
  });

  it.each([
    ['+', 'this.bal[ks[i]] += vs[i];'],
    ['-', 'this.bal[ks[i]] -= vs[i];'],
    ['+', 'this.bal[ks[i]] = this.bal[ks[i]] + 1;'],
    ['-', 'this.bal[ks[i]] = this.bal[ks[i]] - vs[i];'],
    ['+', 'int v = vs[i]; this.bal[ks[i]] += v;'],
    ['+', 'int k = ks[i]; this.bal[k] = this.bal[ks[i]] + 1;'],
    ['+', 'this.bal[ks[i]] += vs[i]; emit Seen(ks[i], i);'],
    ['-', 'this.bal[ks[i]] -= vs[i]; emit Seen(ks[i], i);'],
  ])('folds `%s` into the entry for `%s`', (op, body) => {
    for (const [name, compile] of Object.entries(conventions)) {
      expect([name, opOf(compile(book(body)))]).toStrictEqual([name, op]);
    }
  });

  it('folds a using-for add or sub only into the entry it is called on', () => {
    const evm = { evmCompat: true };
    for (const [name, compile] of Object.entries(conventions)) {
      for (const [body, expected] of [
        ['bal[ks[i]] = bal[7].add(1);', 'set'],
        ['bal[ks[i]] = bal[7].sub(1);', 'set'],
        ['bal[ks[i]] = other[ks[i]].add(vs[i]);', 'set'],
        ['bal[ks[i]] = bal[ks[i]].add(vs[i]);', '+'],
        ['bal[ks[i]] = bal[ks[i]].sub(vs[i]);', '-'],
      ] as const) {
        expect([name, body, opOf(compile(safeMath(body), evm))]).toStrictEqual([name, body, expected]);
      }
    }
  });

  it('folds a counter loop\'s write only into the entry it reads, on the compiler-described layout too', () => {
    const counter = (body: string): string => `contract C() { mapping(int => int) slots; mapping(int => int) other;
      event Hit(int v);
      function put(int n, int amount) public { for (int i = 0; i < n; i = i + 1) { ${body} } require(true); }
      function control() public { require(true); } }`;
    const kernel = { forceStateful: true};
    for (const [body, expected] of [
      ['slots[i] = slots[i] + amount;', '+'], ['slots[i] = slots[i] - amount;', '-'], ['slots[i] += amount;', '+'],
      ['slots[i] = slots[i] + amount; emit Hit(i);', '+'],
      ['slots[i] = slots[7] + amount;', 'set'], ['slots[i] = slots[7] + amount; emit Hit(i);', 'set'],
      ['slots[i] = other[i] + amount;', 'set'],
    ] as const) {
      for (const [name, options] of [['kernel', kernel], ['auto', {}], ['direct', {}]] as const) {
        const loop = compileString(counter(body), { ...quiet, ...options }).abi.find((entry) => entry.name === 'put')
          ?.sortedUpsertLoopInfo?.find((info) => info.collection === 'slots');
        expect([name, body, loop?.op]).toStrictEqual([name, body, expected]);
      }
    }
  }, 300_000);
});
