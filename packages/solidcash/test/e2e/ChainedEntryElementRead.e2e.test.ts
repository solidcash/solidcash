import { describe, it, expect } from 'vitest';
import { compileString, ChainedEntryElementReadError } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// A second element write to a mapping-entry ARRAY value chains from the prior write via the flat drop+re-push,
// which consumes the pending value before the element value/index is evaluated, so a read of the SAME entry
// inside that value read the STALE input. `m[k][0] = m[k][0] + 1; m[k][0] = m[k][0] + 1` SILENTLY persisted 1,
// not 2 (send OK, wrong value). Unlike the scalar and struct-field forms (which read the pending value), the
// array-element in-place chaining that would make this work is deferred, so it is a clean compile error
// (ChainedEntryElementReadError). Single writes/RMWs and distinct-index writes with non-entry values work.
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
