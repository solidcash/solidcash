/**
 * A4.4's collection journal at compile time: which constructors get a deployer with journal rows, and which A4.1
 * refuses (`ctor-collection-shape`, `genesis-site`). The rows and their check are exercised in the VM by the SDK's
 * DeployerJournal end-to-end tests.
 */
import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';
import {
  CREATE_OPERATION_BUDGET, JOURNAL_ITEM_LIMIT, JOURNAL_RECORD_HEADER, journalCostBound,
} from '../src/semantic/RewriteConstructorJournals.js';

const P = 'pragma solidcash ^0.50.0;';
const S = 'pragma solidity ^0.8.20;';

const compile = (source: string, options: Record<string, unknown> = {}): { artifact: any; warnings: string[] } => {
  const warnings: string[] = [];
  const artifact = compileString(source, {
    deployer: true, messageBus: false, warningListener: (warning: { message: string }) => warnings.push(warning.message),
    ...options,
  } as never);
  return { artifact, warnings };
};
const rowsOf = (artifact: any): Array<[string, number]> =>
  artifact.deployer?.collectionRows.map((row: any) => [row.collection, row.appendSites]);

describe('A4.4: a constructor that accesses a collection gets journal rows', () => {
  it('one row per append site, a journal depth for the SDK, and a HEAD and entry rows in the layout', () => {
    const { artifact } = compile(`${P} contract C { mapping(int => int) m; int n;
      constructor() { m[5] = 2; m[3] = 4; } function f() public { n = n + 1; } }`);
    expect(rowsOf(artifact)).toEqual([['m', 2]]);
    expect(artifact.deployer.collectionRows[0].journalDepth).toEqual(expect.any(Number));
    const kinds = artifact.deployer.abi.find((fn: any) => fn.name === 'create').blockLayout.slots.map((slot: any) => slot.kind);
    expect(kinds).toEqual(['master', 'dataNft', 'head', 'entry', 'entry']);
  });

  it('accepts nested keys, a write of the default, a read with no write, and an inlined helper', () => {
    expect(rowsOf(compile(`${P} contract C { mapping(int => mapping(int => int)) mm; int n;
      constructor() { mm[1][2] = 3; n = mm[1][2]; } function f() public { n = n + 1; } }`).artifact)).toEqual([['mm', 1]]);
    expect(rowsOf(compile(`${P} contract C { mapping(int => bool) b; int n;
      constructor() { b[1] = true; b[2] = false; } function f() public { n = n + 1; } }`).artifact)).toEqual([['b', 2]]);
    expect(rowsOf(compile(`${P} contract C { mapping(int => int) m; int n;
      constructor() { n = m[3]; } function f() public { n = n + 1; } }`).artifact)).toEqual([]);
    expect(rowsOf(compile(`${P} contract C { mapping(bytes20 => int) bal; int supply;
      constructor(bytes20 a) { _mint(a, 100); }
      function _mint(bytes20 to, int v) internal { bal[to] = bal[to] + v; supply = supply + v; }
      function f(bytes20 a) public { bal[a] = 1; } }`).artifact)).toEqual([['bal', 1]]);
  });

  it('accepts the OpenZeppelin premint with decimals() and a SafeMath add', () => {
    expect(rowsOf(compile(`${S} contract T { mapping(address => uint256) private _balances; uint256 private _totalSupply;
      function decimals() public pure returns (uint8) { return 18; }
      constructor() { _mint(msg.sender, 1000000 * 10 ** decimals()); }
      function _mint(address account, uint256 value) internal { _totalSupply += value; _balances[account] += value; }
      function transfer(address to, uint256 v) public returns (bool) { _balances[msg.sender] -= v; _balances[to] += v; return true; } }`,
    { evmCompat: true }).artifact)).toEqual([['_balances', 1]]);
    expect(rowsOf(compile(`${S} library SafeMath { function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b; require(c >= a); return c; } }
      contract T { using SafeMath for uint256; mapping(address => uint256) _balances; uint256 n;
      constructor() { _balances[msg.sender] = _balances[msg.sender].add(5); }
      function f() public { n = n + 1; } }`, { evmCompat: true }).artifact)).toEqual([['_balances', 1]]);
  });
});

describe('A4.1: what the journal refuses', () => {
  const refusal = (source: string): { reason: string | undefined; warning: string } => {
    const { artifact, warnings } = compile(source);
    return { reason: artifact.deployerUnsupported, warning: warnings.find((warning) => warning.includes('no deployer')) ?? '' };
  };

  it('a read or a write inside a loop', () => {
    for (const body of ['for (int i = 0; i < 2; i = i + 1) { m[i] = 1; }', 'for (int i = 0; i < 2; i = i + 1) { n = n + m[i]; }']) {
      const { reason, warning } = refusal(`${P} contract C { mapping(int => int) m; int n; constructor() { ${body} } function f() public { n = n + 1; } }`);
      expect(reason).toBe('ctor-collection-shape');
      expect(warning).toContain('inside a loop');
    }
  });

  it('a call that may write a collection inside another statement, and an increment beside an access', () => {
    expect(refusal(`${P} contract C { mapping(int => int) m; int n; constructor() { m[1] = g(); }
      function g() internal returns (int) { m[2] = 3; return 4; } function f() public { n = n + 1; } }`).warning)
      .toContain('not a whole statement of its own');
    expect(refusal(`${P} contract C { mapping(int => int) m; int n; constructor() { int i = 1; m[i] = ++i; }
      function f() public { n = n + 1; } }`).warning).toContain('increments or decrements');
  });

  it('a constructor local named like a collection', () => {
    const { reason } = refusal(`${P} contract C { mapping(int => int) m; int n; constructor() { m[1] = 2; int k = 3; { int m2 = k; n = m2; } }
      function f() public { n = n + 1; } }`);
    expect(reason).toBeUndefined();
  });
});

describe('A4.4: a constructor writes a struct-valued collection', () => {
  const STRUCT = 'struct S { uint64 a; bytes20 b; bool c; }';
  const refusal = (
    source: string, options: Record<string, unknown> = {},
  ): { reason: string | undefined; warning: string } => {
    const { artifact, warnings } = compile(source, options);
    return { reason: artifact.deployerUnsupported, warning: warnings.find((warning) => warning.includes('no deployer')) ?? '' };
  };

  it('one append per whole write and per field write, compound, nested and through this', () => {
    expect(rowsOf(compile(`${P} contract C { ${STRUCT} mapping(int => S) m; uint64 n;
      constructor() { m[1] = S(5, bytes20(0), true); m[2].a = 7; m[2].c = true; m[1].a += 2; n = m[1].a; }
      function f(int k) public { n = m[k].a; } }`).artifact)).toEqual([['m', 4]]);
    expect(rowsOf(compile(`${P} contract C { struct T { uint64 p; bool q; } struct S { uint64 a; T t; }
      mapping(int => mapping(int => S)) mm; uint64 n;
      constructor() { mm[1][2].t.p = 5; this.mm[2][1].t = T(6, true); n = mm[1][2].t.p; }
      function f(int k) public { n = mm[k][k].t.p; } }`).artifact)).toEqual([['mm', 2]]);
    // Only reads: no record, so no bound on the value.
    expect(rowsOf(compile(`${P} contract C { struct S { bytes10 a; bytes10 b; bytes10 c; bytes10 d; bytes10 e; bytes10 f; }
      mapping(int => S) m; bytes10 n; constructor() { n = m[1].a; } function f(int k) public { n = m[k].a; } }`).artifact))
      .toEqual([]);
  });

  it('refuses a struct whose encoding may exceed the 64 bytes an entry holds, or that holds an array', () => {
    const big = refusal(`${P} contract C { struct S { bytes10 a; bytes10 b; bytes10 c; bytes10 d; bytes10 e; bytes10 f; }
      mapping(int => S) m; bytes10 n; constructor() { m[1].a = bytes10(0); } function f(int k) public { n = m[k].a; } }`);
    expect(big.reason).toBe('ctor-collection-shape');
    expect(big.warning).toContain('whose value S may encode to 66 bytes, more than the 64 an entry holds');
    const array = refusal(`${P} contract C { struct S { uint8[2] a; bool c; } mapping(int => S) m; bool n;
      constructor() { m[1].c = true; } function f(int k) public { n = m[k].c; } }`);
    expect(array.reason).toBe('ctor-collection-shape');
    expect(array.warning).toContain('holds a field of type uint8[2], whose encoded size the journal does not bound');
  });

  it('refuses a struct that takes more than one coin', () => {
    const { reason, warning } = refusal(`${P} contract C { struct S { string name; uint64 a; } mapping(int => S) m; uint64 n;
      constructor() { m[1].a = 1; } function f(int k) public { n = m[k].a; } }`);
    expect(reason).toBe('ctor-collection-shape');
    expect(warning).toContain('whose value takes more than one coin');
  });

  it('refuses an access through a storage local bound with a key that is not a literal', () => {
    for (const source of [
      `${P} contract C(int k) { ${STRUCT} mapping(int => S) m; uint64 n;
        constructor() { S storage s = m[k]; s.a = 5; } function f(int j) public { n = m[j].a; } }`,
      `${P} contract C(int k) { ${STRUCT} mapping(int => S) m; uint64 n; function g() internal { S storage s = m[k]; n = s.a; }
        constructor() { g(); } function f(int j) public { n = m[j].a; } }`,
      `${P} contract C(int k) { mapping(int => mapping(int => int)) mm; int n;
        constructor() { mapping(int => int) storage inner = mm[k]; inner[1] = 2; } function f(int j) public { n = mm[j][j]; } }`,
    ]) {
      const { reason, warning } = refusal(source);
      expect(reason).toBe('ctor-collection-shape');
      expect(warning).toContain('through a storage local whose binding holds a key that is not a literal');
    }
    // A literal key names one entry however often the parser rebuilds it; a binding outside the constructor is not
    // in the deployer program.
    expect(rowsOf(compile(`${P} contract C { ${STRUCT} mapping(int => S) m; uint64 n;
      constructor() { S storage s = m[1]; s.a = 5; s.c = true; } function f(int j) public { n = m[j].a; } }`).artifact))
      .toEqual([['m', 2]]);
    expect(rowsOf(compile(`${P} contract C { ${STRUCT} mapping(int => S) m; uint64 n;
      constructor() { m[1].a = 5; } function f(int j) public { S storage s = m[j]; n = s.a; } }`).artifact))
      .toEqual([['m', 1]]);
  });

  it('refuses a modifier storage parameter bound to an entry, whose expansion copies it', () => {
    const { reason, warning } = refusal(`${S} contract C { struct T { uint64 a; bool c; } mapping(uint256 => T) m; uint256 x;
      modifier touch(T storage t) { t.a = 1; _; }
      constructor() touch(m[1]) { x = 2; } function f(uint256 k) public { x = m[k].a; } }`, { evmCompat: true });
    expect(reason).toBe('ctor-collection-shape');
    expect(warning).toContain('a modifier\'s storage parameter is bound to an entry of a collection');
  });
});

describe('A4.4 "Bounds": a journal within one stack item, its operations within create\'s budget', () => {
  const source = (appends: number, looks = 0): string => `${P} contract C { mapping(int => int) m; int n;
    constructor() { ${Array.from({ length: appends }, (_, i) => `m[${i + 1}] = ${i + 1};`).join(' ')}
      ${Array.from({ length: looks }, (_, i) => `n = n + m[${i + 1}];`).join(' ')} }
    function f() public { n = n + 1; } }`;
  const bounded = (appends: number, box: Record<string, unknown> = {}, looks = 0): {
    reason: string | undefined; warning: string; cost: number;
  } => {
    const testBox: Record<string, unknown> = { ...box };
    const { artifact, warnings } = compile(source(appends, looks), { __deployerTestBox: testBox });
    return {
      reason: artifact.deployerUnsupported,
      warning: warnings.find((warning) => warning.includes('no deployer')) ?? '',
      cost: testBox.journalCost as number,
    };
  };
  // An int is an int256: a record holds 34 bytes of slot and size and at most 33 of value.
  const record = JOURNAL_RECORD_HEADER + 33;

  it('bounds the journals from their appends, their looks and their record bound', () => {
    expect(bounded(4).cost).toBe(journalCostBound({ appends: 4, looks: 0, valueBound: 33 }));
    expect(bounded(4, {}, 3).cost).toBe(journalCostBound({ appends: 4, looks: 3, valueBound: 33 }));
    expect(bounded(5).cost).toBeGreaterThan(bounded(4).cost);
  });

  it('refuses a constructor whose journals could cost more than the operation budget', () => {
    const budget = bounded(6).cost;
    expect(bounded(6, { journalBudget: budget }).reason).toBeUndefined();
    const over = bounded(7, { journalBudget: budget });
    expect(over.reason).toBe('ctor-collection-shape');
    expect(over.warning).toContain(`'m' ${bounded(7).cost} for 7 appends and 0 looks`);
    expect(over.warning).toContain(`more than the operation budget of ${budget} of a 10,000-byte input`);
  });

  it('refuses a journal that could outgrow one stack item', () => {
    expect(bounded(6, { journalItemLimit: 6 * record }).reason).toBeUndefined();
    const over = bounded(7, { journalItemLimit: 6 * record });
    expect(over.reason).toBe('ctor-collection-shape');
    expect(over.warning).toContain(`could hold 7 records of up to ${record} bytes, ${7 * record} bytes, more than the `
      + `${6 * record} bytes of one stack item`);
  });

  it('keeps the largest constructor whose create input fits 10,000 bytes far under both bounds', () => {
    // C's own constructor arm grows with each write, so its code fills the create input before the journals come
    // near either bound.
    const largest = bounded(12);
    expect(largest.reason).toBeUndefined();
    expect(largest.cost).toBeLessThan(CREATE_OPERATION_BUDGET / 2);
    expect(12 * record).toBeLessThan(JOURNAL_ITEM_LIMIT / 10);
    expect(bounded(14).reason).toBe('unlocking-too-large');
  });
});

describe('B7.18: C\'s own constructor arm, compiled with a deployer', () => {
  it('compiles a read its static plan cannot serve, which a plain compile still refuses', () => {
    const source = `${P} contract C { struct S { uint64 a; bool c; } mapping(int => S) m; uint64 n;
      constructor() { m[2].a = 7; n = m[2].a; } function f(int k) public { n = m[k].a; } }`;
    expect(rowsOf(compile(source).artifact)).toEqual([['m', 1]]);
    expect(() => compileString(source, { messageBus: false } as never))
      .toThrow(/a read of `m\[2\]` in the constructor after the write/);
  });
});
