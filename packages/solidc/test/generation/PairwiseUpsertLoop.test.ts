import { describe, expect, it } from 'vitest';
import { compileString, compileStringMulti } from '../../src/compiler.js';

// The SDK rewrites a sorted-mapping loop call's arrays - reordering a gap's new keys, merging a repeated key, netting
// the sender's own credit out - to reach the order the covenant folds. That keeps the call's meaning only when each turn
// is fixed by its own (key, value) pair, which the compiler publishes as `pairwise`, and `senderDebit` where each turn
// first debits msg.sender by what it credits. Both are SDK guidance, which the kernel's stream digest skips.
const book = (body: string): string => `contract Book() { int seen; int last; mapping(int => int) bal;
  event Seen(int k, int v);
  function seed(int a, int v) { this.bal[a] = v; }
  function put(int[] ks, int[] vs) { for (int i = 0; i < ks.length; i++) { ${body} } } }`;
const functions = (definitions: string): string => `contract Book() { mapping(int => int) bal; ${definitions} }`;
const token = (body: string, valueType = 'int'): string => `contract Token() { mapping(address => ${valueType}) bal;
  function setBal(address a, ${valueType} v) { this.bal[a] = v; }
  function run(address[] rs, ${valueType}[] amounts) { for (int i = 0; i < rs.length; i++) { ${body} } } }`;
const MULTI_TRANSFER = 'this.bal[msg.sender] -= amounts[i]; this.bal[rs[i]] += amounts[i];';
const quiet = { suppressWarnings: true };
const conventions = [quiet, { ...quiet, messageBus: false }];

const published = (source: string, fn: string, options: object = quiet): unknown => {
  const loop = compileString(source, options).abi.find((entry) => entry.name === fn)?.sortedUpsertLoopInfo?.[0];
  return [loop?.pairwise, loop?.senderDebit];
};

describe('a sorted-mapping loop whose turns its own pairs fix', () => {
  it.each([
    'this.bal[ks[i]] += vs[i];', 'this.bal[ks[i]] -= vs[i];', 'this.bal[ks[i]] = vs[i];', 'this.bal[ks[i]] = vs[i] + 5;',
    'this.bal[ks[i]] = 42;', 'delete this.bal[ks[i]];', 'this.bal[ks[i]] = this.bal[ks[i]] + 1;',
    'int v = vs[i]; this.bal[ks[i]] += v;',
  ])('publishes pairwise on `%s`', (body) => {
    for (const options of conventions) expect(published(book(body), 'put', options)).toStrictEqual([true, undefined]);
  });

  it.each([
    ['the value is the turn', 'this.bal[ks[i]] = 100 + i;'],
    ['the value is the counter', 'this.bal[ks[i]] = i;'],
    ['the value element is another turn\'s', 'this.bal[ks[i]] = vs[ks[i]];'],
    ['the value element is the next turn\'s', 'this.bal[ks[i]] = vs[i + 1];'],
    ['the base is another entry', 'this.bal[ks[i]] = this.bal[7] + 1;'],
    ['the value reads state', 'this.bal[ks[i]] += this.seen;'],
    ['a sibling write', 'this.bal[ks[i]] += vs[i]; this.seen = this.seen + 1;'],
    ['a write that sees the order', 'this.bal[ks[i]] = vs[i]; this.last = ks[i];'],
    ['a per-turn require', 'require(vs[i] > 0); this.bal[ks[i]] += vs[i];'],
    ['an event per turn', 'this.bal[ks[i]] = vs[i]; emit Seen(ks[i], i);'],
    ['an event after a read of the entry', 'emit Seen(ks[i], this.bal[ks[i]]); this.bal[ks[i]] += vs[i];'],
  ])('publishes nothing where %s', (_label, body) => {
    for (const options of conventions) expect(published(book(body), 'put', options)).toStrictEqual([undefined, undefined]);
  });

  it('reads the loop and the rest of the function, not only the turn', () => {
    const loop = 'for (int i = 0; i < ks.length; i++) { this.bal[ks[i]] += vs[i]; }';
    expect(published(functions(`function f(int[] ks, int[] vs) { require(ks.length == vs.length); ${loop} }`), 'f'))
      .toStrictEqual([true, undefined]);
    for (const [label, definition] of [
      ['a later read of the array', `function f(int[] ks, int[] vs) { ${loop} this.bal[0] = ks[0]; }`],
      ['a loop from one', 'function f(int[] ks, int[] vs) { for (int i = 1; i < ks.length; i++) { this.bal[ks[i]] += vs[i]; } }'],
      ['a bound other than the array', 'function f(int[] ks, int[] vs, int n) { for (int i = 0; i < n; i++) { this.bal[ks[i]] += vs[i]; } }'],
      ['a read of the counter after the loop', 'function f(int[] ks, int[] vs) { int i = 0; '
        + 'while (i < ks.length) { this.bal[ks[i]] += vs[i]; i = i + 1; } this.bal[1] = i; }'],
      ['an amount the function changes', 'function f(int[] ks, int a) { a = a + 1; for (int i = 0; i < ks.length; i++) { this.bal[ks[i]] += a; } }'],
    ]) {
      expect([label, published(functions(definition), 'f')]).toStrictEqual([label, [undefined, undefined]]);
    }
    expect(published(functions('function f(int[] ks, int a) { for (int i = 0; i < ks.length; i++) { this.bal[ks[i]] += a; } }'), 'f'))
      .toStrictEqual([true, undefined]);
  });

  it('publishes senderDebit where each turn first debits msg.sender, and only there, by what it credits', () => {
    for (const options of conventions) {
      expect(published(token(MULTI_TRANSFER), 'run', options)).toStrictEqual([true, true]);
      expect(published(token(MULTI_TRANSFER, 'uint'), 'run', options)).toStrictEqual([true, true]);
      // OpenZeppelin's `_update` shape: the amount and the sender's balance read into locals first.
      const oz = 'int v = amounts[i]; int fromBal = this.bal[msg.sender]; this.bal[msg.sender] = fromBal - v; '
        + 'this.bal[rs[i]] += v;';
      expect(published(token(oz), 'run', options)).toStrictEqual([true, true]);
      // A credit before the debit still commutes, but the SDK checks a self-credit only against a debit-first turn.
      expect(published(token('this.bal[rs[i]] += amounts[i]; this.bal[msg.sender] -= amounts[i];'), 'run', options))
        .toStrictEqual([true, undefined]);
    }
    // A debit the turn does not own, another write of the sender's entry, a store, or another turn's amount.
    const outside = 'function run(address[] rs, int[] amounts, int total) { this.bal[msg.sender] -= total; '
      + 'for (int i = 0; i < rs.length; i++) { this.bal[rs[i]] += amounts[i]; } }';
    expect(published(`contract Token() { mapping(address => int) bal; ${outside} }`, 'run')).toStrictEqual([true, undefined]);
    const extra = 'function run(address[] rs, int[] amounts, int fee) { this.bal[msg.sender] -= fee; '
      + `for (int i = 0; i < rs.length; i++) { ${MULTI_TRANSFER} } }`;
    expect(published(`contract Token() { mapping(address => int) bal; ${extra} }`, 'run')).toStrictEqual([true, undefined]);
    expect(published(token('this.bal[msg.sender] -= amounts[i]; this.bal[rs[i]] = amounts[i];'), 'run'))
      .toStrictEqual([undefined, undefined]);
    expect(published(token('this.bal[msg.sender] -= amounts[i]; this.bal[rs[i]] += amounts[rs.length - 1 - i];'), 'run'))
      .toStrictEqual([undefined, undefined]);
  });

  it('publishes neither on the framed convention, whose planner refuses a rewrite of its own', () => {
    const loop = (source: string, fn: string): unknown => {
      const artifact = Object.values(compileStringMulti(source, { ...quiet, composition: 'framed' }))
        .find((candidate) => candidate.abi.some((entry) => entry.name === fn));
      const info = artifact?.abi.find((entry) => entry.name === fn)?.sortedUpsertLoopInfo?.[0];
      return [info !== undefined, info?.pairwise, info?.senderDebit];
    };
    expect(loop(book('this.bal[ks[i]] += vs[i];'), 'put')).toStrictEqual([true, undefined, undefined]);
    expect(loop(token(MULTI_TRANSFER), 'run')).toStrictEqual([true, undefined, undefined]);
  });
});
