// Mapping-entry write behavior pins: read-after-write, writes in loops, chained struct-field and
// array-element writes.
import { describe, it, expect } from 'vitest';
import { compileString, EntryWriteInLoopError, ChainedEntryElementReadError } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

describe('read-after-write same key', () => {
  // A mapping read after a same-key write returned the STALE input commitment (`m[k]+=1; m[k]+=1` kept
  // 1); visitMappingAccess now decodes the pending write value (slotIndex uniquely identifies the key).
  async function dep(src: string): Promise<any> {
    return getContractFactory(compileString(src, { forceStateful: true }), await fundedSigner()).deploy();
  }
  const M = (body: string): string => `contract C { mapping(int => int) m;
    ${body}
    function chk(int k, int ev) external { require(m[k] == ev); } }`;

  describe('mapping read-after-write on the same key', () => {
    it('double read-modify-write accumulates (m[k]+1 twice -> +2, not +1)', async () => {
      const sc = await dep(M('function f(int k) external { m[k] = m[k] + 1; m[k] = m[k] + 1; require(true); }'));
      await sc.f(9n).send();
      await sc.chk(9n, 2n).send();
    });

    it('compound += twice accumulates', async () => {
      const sc = await dep(M('function f(int k) external { m[k] += 1; m[k] += 1; require(true); }'));
      await sc.f(2n).send();
      await sc.chk(2n, 2n).send();
    });

    it('write then read the written value back in a require (was OP_VERIFY fail)', async () => {
      const sc = await dep(M('function f(int k) external { m[k] = 5; require(m[k] == 5); }'));
      await sc.f(5n).send();
    });

    it('write then read for a follow-on computation (m[k]=3; m[k]=m[k]*2 -> 6)', async () => {
      const sc = await dep(M('function f(int k) external { m[k] = 3; m[k] = m[k] * 2; require(true); }'));
      await sc.f(1n).send();
      await sc.chk(1n, 6n).send();
    });

    it('write one key then read it into another (m[a]=5; m[b]=m[a] -> m[b]=5)', async () => {
      const sc = await dep(M('function f(int a, int b) external { m[a] = 5; m[b] = m[a]; require(true); }'));
      await sc.f(1n, 2n).send();
      await sc.chk(2n, 5n).send();
    });

    it('REGRESSION: read-before-write (check-then-deduct) still works', async () => {
      const sc = await dep(M('function f(int k, int a) external { require(m[k] >= a); m[k] = m[k] - a; }'));
      await sc.f(1n, 0n).send();
    });

    it('REGRESSION: single read-modify-write unchanged (+1)', async () => {
      const sc = await dep(M('function f(int k) external { m[k] = m[k] + 1; require(true); }'));
      await sc.f(1n).send();
      await sc.chk(1n, 1n).send();
    });

    it('REGRESSION: transfer across two different keys', async () => {
      const sc = await dep(M('function f(int a, int b, int v) external { m[a] = m[a] - v; m[b] = m[b] + v; require(true); }'));
      await sc.f(1n, 2n, 3n).send();
    });
  });
});

describe('write in loop', () => {
  // A pure-write mapping loop (`for(i<n) m[k[i]]=v[i]`) now compiles to a runtime counter-indexed entry-mint
  // covenant loop, and a fixed-bound loop unrolls to N static writes - both sound. A read-modify-write or a
  // delete in a loop stays rejected (stale-read / omission unsoundness): still EntryWriteInLoopError.
  const rej = (src: string): void => {
    expect(() => compileString(src, { forceStateful: true })).toThrow(EntryWriteInLoopError);
  };
  const dep = async (src: string): Promise<any> =>
    getContractFactory(compileString(src, { forceStateful: true }), await fundedSigner()).deploy();
  const MAP = (body: string): string => `contract C { mapping(int => int) m;
    ${body}
    function chk(int k, int ev) external { require(m[k] == ev); } }`;
  const ARR = (body: string): string => `contract C { int[3] a;
    ${body}
    function chk(int idx, int ev) external { require(a[idx] == ev); } }`;

  describe('entry-backed state write inside a loop', () => {
    it('rejects a mapping read-modify-write in a loop (invariant key, stale read)', () => {
      rej(MAP('function f(int k, int n) external { for (int i = 0; i < n; i++) { m[k] = m[k] + 1; } require(true); }'));
    });

    it('rejects a mapping delete in a loop', () => {
      rej(MAP('function f(int n) external { for (int i = 0; i < n; i++) { delete m[i]; } require(true); }'));
    });

    it('writes distinct mapping keys in a dynamic for-loop (m[i]=i+1 for i<n)', async () => {
      const sc = await dep(MAP('function f(int n) external { for (int i = 0; i < n; i++) { m[i] = i + 1; } require(true); }'));
      await sc.f(3n).send();
      await sc.chk(0n, 1n).send();
      await sc.chk(2n, 3n).send();
    });

    it('writes mapping keys in a while loop (m[i]=1 for i<n)', async () => {
      const sc = await dep(MAP('function f(int n) external { int i = 0; while (i < n) { m[i] = 1; i = i + 1; } require(true); }'));
      await sc.f(2n).send();
      await sc.chk(1n, 1n).send();
    });

    it('writes fixed-size state array elements over a constant range (unrolled)', async () => {
      const sc = await dep(ARR('function f() external { for (int i = 0; i < 3; i++) { a[i] = i + 1; } require(true); }'));
      await sc.f().send();
      await sc.chk(0n, 1n).send();
      await sc.chk(2n, 3n).send();
    });

    it('read-modify-writes fixed-size state array elements in a fixed loop (unrolled)', async () => {
      const sc = await dep(ARR('function f() external { for (int i = 0; i < 3; i++) { a[i] = a[i] + 1; } require(true); }'));
      await sc.f().send();
      await sc.chk(1n, 1n).send();
    });

    it('allows a mapping read BEFORE a loop (no entry write in the loop)', async () => {
      const sc: any = await getContractFactory(compileString(MAP(
        'function f(int k, int n) external { int x = m[k]; int t = 0; for (int i = 0; i < n; i++) { t = t + x; } require(t >= 0); }'),
      { forceStateful: true }), await fundedSigner()).deploy();
      await sc.f(7n, 3n).send();
    });

    it('allows a straight-line mapping read-modify-write outside any loop', async () => {
      const sc: any = await getContractFactory(compileString(MAP(
        'function f(int k) external { m[k] = m[k] + 1; m[k] = m[k] + 1; require(true); }'),
      { forceStateful: true }), await fundedSigner()).deploy();
      await sc.f(9n).send();
      await sc.chk(9n, 2n).send();
    });

    it('allows a straight-line fixed-size array write outside any loop', async () => {
      const sc: any = await getContractFactory(compileString(
        'contract C { int[3] a; function f() external { a[0] = 1; a[1] = 2; a[2] = 3; require(true); }'
        + ' function chk(int idx, int ev) external { require(a[idx] == ev); } }',
        { forceStateful: true }), await fundedSigner()).deploy();
      await sc.f().send();
      await sc.chk(0n, 1n).send();
      await sc.chk(2n, 3n).send();
    });
  });
});

describe('chained struct-field rmw', () => {
  // A chained struct-entry field write consumed the pending value before evaluating its RHS, so a same-
  // entry read saw stale state (`m[k].x=5; m[k].x=m[k].x+1` kept 1); chained writes now update in place.
  const S = (body: string): string => `contract C { struct S { int x; int y; } mapping(int => S) m;
    ${body}
    function chkX(int k, int ev) external { require(m[k].x == ev); }
    function chkY(int k, int ev) external { require(m[k].y == ev); } }`;
  const dep = async (body: string): Promise<any> =>
    getContractFactory(compileString(S(body), { forceStateful: true }), await fundedSigner()).deploy();

  describe('chained struct-entry field read-modify-write', () => {
    it('literal write then read-modify-write of the same field accumulates (5 -> 6)', async () => {
      const sc = await dep('function f(int k) external { m[k].x = 5; m[k].x = m[k].x + 1; require(true); }');
      await sc.f(1n).send();
      await sc.chkX(1n, 6n).send();
    });

    it('compound += on the same field twice accumulates (-> 2)', async () => {
      const sc = await dep('function f(int k) external { m[k].x += 1; m[k].x += 1; require(true); }');
      await sc.f(1n).send();
      await sc.chkX(1n, 2n).send();
    });

    it('write one field, then write another field computed from the first', async () => {
      const sc = await dep('function f(int k, int a) external { m[k].x = a; m[k].y = m[k].x + 1; require(true); }');
      await sc.f(3n, 10n).send();
      await sc.chkX(3n, 10n).send();
      await sc.chkY(3n, 11n).send();
    });

    it('single field read-modify-write still works (-> 1)', async () => {
      const sc = await dep('function f(int k) external { m[k].x = m[k].x + 1; require(true); }');
      await sc.f(1n).send();
      await sc.chkX(1n, 1n).send();
    });

    it('chained writes to two different fields with literals', async () => {
      const sc = await dep('function f(int k) external { m[k].x = 5; m[k].y = 7; require(true); }');
      await sc.f(1n).send();
      await sc.chkX(1n, 5n).send();
      await sc.chkY(1n, 7n).send();
    });
  });
});

describe('chained array-element read', () => {
  // A chained mapping-entry ARRAY-element write whose value/index reads the same entry saw stale state
  // (`m[k][0]+=1` twice kept 1); rejected (ChainedEntryElementReadError) until in-place chaining lands.
  const A = (body: string): string => `contract C { mapping(int => int[3]) m;
    ${body}
    function chk(int k, int i, int ev) external { require(m[k][i] == ev); } }`;
  const dep = async (body: string): Promise<any> =>
    getContractFactory(compileString(A(body), { forceStateful: true }), await fundedSigner()).deploy();
  const rej = (body: string): void => {
    expect(() => compileString(A(body), { forceStateful: true })).toThrow(ChainedEntryElementReadError);
  };

  describe('chained mapping-entry array-element write whose value reads the same entry', () => {
    it('rejects: read-modify-write of the same element twice', () => {
      rej('function f(int k) external { m[k][0] = m[k][0] + 1; m[k][0] = m[k][0] + 1; require(true); }');
    });

    it('rejects: write one index, then write another index computed from the first', () => {
      rej('function f(int k) external { m[k][0] = 5; m[k][1] = m[k][0] + 1; require(true); }');
    });

    it('allows a single element write', async () => {
      const sc = await dep('function f(int k) external { m[k][0] = 5; require(true); }');
      await sc.f(1n).send();
      await sc.chk(1n, 0n, 5n).send();
    });

    it('allows a single element read-modify-write', async () => {
      const sc = await dep('function f(int k) external { m[k][0] = m[k][0] + 1; require(true); }');
      await sc.f(1n).send();
      await sc.chk(1n, 0n, 1n).send();
    });

    it('allows writes to two different indices with literal values', async () => {
      const sc = await dep('function f(int k) external { m[k][0] = 5; m[k][1] = 7; require(true); }');
      await sc.f(1n).send();
      await sc.chk(1n, 0n, 5n).send();
      await sc.chk(1n, 1n, 7n).send();
    });
  });
});
