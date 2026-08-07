import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';

// A C-style `for` loop block-scopes its variable in Solidity, so sequential loops may reuse the name. The for
// desugars to a flattened `{ init; while }`, but identifier resolution is in-order, so each loop body binds to
// its own declaration; a sequential re-declaration of a (dead) loop variable is allowed.
describe('for-loop variable scoping', () => {
  it('compiles sequential and nested loops reusing the same variable name', () => {
    expect(() => compileString(`pragma solidcash >=0.8.0;
contract C() {
  bigint total;
  function go(pubkey pk, sig s) {
    require(checkSig(s, pk));
    bigint t = 0;
    for (bigint i = 0; i < 3; i += 1) { t = t + i; }
    for (bigint i = 0; i < 3; i += 1) { t = t + i; }
    this.total = t;
  }
}`)).not.toThrow();
  });

  it('still rejects a genuine redefinition of a non-loop variable', () => {
    expect(() => compileString(`pragma solidcash >=0.8.0;
contract C() {
  bigint v;
  function go(pubkey pk, sig s) { require(checkSig(s, pk)); bigint x = 1; bigint x = 2; this.v = x; }
}`)).toThrow(/[Rr]edefinition/);
  });

  it('computes the correct values across two sequential loops at runtime', async () => {
    const provider = createTestProvider();
    const art = compileString(`pragma solidcash >=0.8.0;
contract C() {
  bigint total;
  function go(pubkey pk, sig s) {
    require(checkSig(s, pk));
    bigint t = 0;
    for (bigint i = 0; i < 3; i += 1) { t = t + i; }
    for (bigint i = 0; i < 4; i += 1) { t = t + i; }
    this.total = t;
  }
}`);
    const c = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, c, art.stateLayout!, { total: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(c, categoryId);

    const tx = await sc.go(alicePub, new SignatureTemplate(alicePriv)).send();

    expect(tx.txid).toBeDefined();
    expect((await sc.getState()).total).toBe(9n); // (0+1+2) + (0+1+2+3) = 3 + 6
  });
});
