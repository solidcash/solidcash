import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// Regression: a second write to a mapping-entry struct field chained from the prior write, but the FLAT
// (scopeDepth 0) chaining path consumed the pending value before the field-assign's value expression was
// evaluated, so a read of the SAME entry inside that value saw the STALE input. `m[k].x = 5; m[k].x = m[k].x
// + 1` SILENTLY persisted 1, not 6, and it diverged from the branch (scopeDepth>0) path which already read
// the pending value. Fixed by always updating a chained field write in place (chainInPlace = canChain), so
// the read-after-write of a struct-entry field is Solidity-correct and matches the scalar-entry behavior.
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
