/* eslint-disable max-len */
import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

const verifyPreflight = 'layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.';

// A storage pointer to a (non-flattened) struct state variable is an ALIAS, not a copy: writes through the
// pointer reach the state variable. Previously `S storage sL = s` silently fell through to a local copy, so
// `sL.f = v` / `sL = other` wrote the local and left `s` unchanged (a silent miscompile). VM-verified: each
// write and its read-back check run in SEPARATE txs (a state write lands in the output).
const provider = createTestProvider();

async function mk(src: string): Promise<StatefulContract> {
  const art = compileString(src, { solidityImportCompat: true, forceStateful: true });
  const c = new Contract(art, [], { provider });
  const { categoryId } = await setupStatefulUtxos(provider, c, art.stateLayout!, {}, { saltContract: true });
  return StatefulContract.withCategory(c, categoryId);
}

const SRC = `contract C {
    struct S { uint x; uint u; }
    S s;
    S seed;
    function wrField() public { S storage sL = s; sL.u = 5; sL.x = 9; }
    function wrWhole() public { seed.x = 7; seed.u = 8; S storage sL = s; sL = seed; }
    function chkField() public view { require(s.u == 5 && s.x == 9); }
    function chkWhole() public view { require(s.x == 7 && s.u == 8); }
    function chkWrong() public view { require(s.u == 111); }
    function readThroughAlias() public view { S storage sL = s; require(sL.u == 5 && sL.x == 9); }
    function delField() public { s.u = 5; S storage sL = s; delete sL.u; }
    function chkDeleted() public view { require(s.u == 0); }
}`;

describe('struct storage pointer to a state variable is an alias (runtime)', () => {
  it('writes per-field through the pointer to the state variable', async () => {
    const sc = await mk(SRC);
    await sc.wrField().send();
    expect(await sc.chkField().send()).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
  });
  it('a wrong expectation reverts (the field write really reached s)', async () => {
    const sc = await mk(SRC);
    await sc.wrField().send();
    await expect(sc.chkWrong().send()).rejects.toThrow(verifyPreflight);
  });
  it('whole-assigns through the pointer to the state variable', async () => {
    const sc = await mk(SRC);
    await sc.wrWhole().send();
    expect(await sc.chkWhole().send()).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
  });
  it('reads through the pointer', async () => {
    const sc = await mk(SRC);
    await sc.wrField().send();
    expect(await sc.readThroughAlias().send()).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
  });
  it('deletes a field through the pointer (clears the state variable, not a local copy)', async () => {
    const sc = await mk(SRC);
    await sc.delField().send();
    expect(await sc.chkDeleted().send()).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
  });
});
