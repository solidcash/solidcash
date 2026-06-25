import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';

// `compute` is a public (entry-point) function that returns a value -> it gets __internal__returnOutputIdx
// injected. `go` calls it INTERNALLY: the call hits compute's internal-call subroutine (no return event; the
// value is returned on the stack). Previously this failed (arity, then a dropped return value).
const SRC = `pragma solidcash >=0.8.0;
contract C() {
  bigint total;
  function compute(bigint x) public returns (bigint) { return x + x + 1; }
  function go(bigint v, pubkey pk, sig s) { require(checkSig(s, pk)); this.total = compute(v); }
}`;

describe('internal call to a public returning function', () => {
  const provider = createTestProvider();
  it('returns the value on the stack (no return event)', async () => {
    const art = compileString(SRC);
    const c = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, c, art.stateLayout!, { total: 0n }, { saltContract: true });
    const sc = StatefulContract.withCategory(c, categoryId);
    const tx = await sc.go(5n, alicePub, new SignatureTemplate(alicePriv)).send();
    expect(tx.txid).toBeDefined();
    expect((await sc.getState()).total).toBe(11n); // compute(5) = 5 + 5 + 1
  });

  // A public returning function with a `return` inside a loop keeps the event-blob return path for its
  // (unused) internal-call subroutine - the raw-return cleanup can't unwind a loop. Must still compile.
  it('compiles a public returning function with a return inside a loop', () => {
    expect(() => compileString(`pragma solidcash >=0.8.0;
contract C() {
  bigint r;
  function find(bigint t) public returns (bigint) {
    for (bigint i = 0; i < 3; i += 1) { if (i == t) { return i; } }
    return 99;
  }
  function go(pubkey pk, sig s) { require(checkSig(s, pk)); this.r = 1; }
}`)).not.toThrow();
  });
});
