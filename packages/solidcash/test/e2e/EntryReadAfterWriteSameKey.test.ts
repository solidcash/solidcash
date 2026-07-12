import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// Regression: a mapping READ after a write to the SAME key in the same function returned the STALE on-chain
// input commitment, not the pending write. `m[k] = m[k] + 1; m[k] = m[k] + 1;` SILENTLY persisted +1 (the
// second read saw the original 0), and `m[k] = 5; require(m[k] == 5)` failed OP_VERIFY. Fixed in
// visitMappingAccess: a scalar whole-value read of a NON-pre-allocated pending write decodes the pending
// (encoded) value via emitPushdataDecodeLastField (the slotIndex uniquely identifies the runtime key, so no
// key check is needed). Mirrors the dynamic-array read-after-write. Invisible to the compile-only bench.
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
