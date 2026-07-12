import { describe, it, expect } from 'vitest';
import { compileString, EntryWriteInLoopError } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// The entry-NFT model reserves ONE output slot per entry-backed access (a mapping keyed by descriptor, or a
// fixed-size state array element), so writing one inside a plain loop is unsound and compiled + ran WITHOUT
// error while corrupting state: distinct runtime keys/indices collapse onto one entry (only the last survives
// - SILENT data loss) and a read-modify-write reads the stale input. Now a clean compile error
// (EntryWriteInLoopError). Collection iteration (`for (k, v of m.entries)`) is the supported way to update.
const rej = (src: string): void => {
  expect(() => compileString(src, { forceStateful: true })).toThrow(EntryWriteInLoopError);
};
const MAP = (body: string): string => `contract C { mapping(int => int) m;
  ${body}
  function chk(int k, int ev) external { require(m[k] == ev); } }`;

describe('entry-backed state write inside a loop is rejected', () => {
  it('mapping read-modify-write (invariant key)', () => {
    rej(MAP('function f(int k, int n) external { for (int i = 0; i < n; i++) { m[k] = m[k] + 1; } require(true); }'));
  });

  it('mapping write-only over distinct keys (was silent data loss)', () => {
    rej(MAP('function f(int n) external { for (int i = 0; i < n; i++) { m[i] = i + 1; } require(true); }'));
  });

  it('mapping delete in a loop', () => {
    rej(MAP('function f(int n) external { for (int i = 0; i < n; i++) { delete m[i]; } require(true); }'));
  });

  it('mapping write in a while loop', () => {
    rej(MAP('function f(int n) external { int i = 0; while (i < n) { m[i] = 1; i = i + 1; } require(true); }'));
  });

  it('fixed-size state array element write over runtime indices (was silent data loss)', () => {
    rej('contract C { int[3] a; function f() external { for (int i = 0; i < 3; i++) { a[i] = i + 1; } require(true); }'
      + ' function chk(int idx, int ev) external { require(a[idx] == ev); } }');
  });

  it('fixed-size state array element read-modify-write in a loop', () => {
    rej('contract C { int[3] a; function f() external { for (int i = 0; i < 3; i++) { a[i] = a[i] + 1; } require(true); }'
      + ' function chk(int idx, int ev) external { require(a[idx] == ev); } }');
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
