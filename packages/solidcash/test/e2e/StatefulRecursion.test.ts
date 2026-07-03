import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';

// A recursive call in a STATEFUL function (the function-modifier bench contract's `decrement`). The block-layout
// conditional-entry walk followed the resolvedFunction back-reference into the callee's body, so a self-call (or
// any call cycle) recursed forever ("Maximum call stack size exceeded"); it now skips that back-reference, as do
// the entry-slot pre-scan walks. (Recursion executes via OP_DEFINE/OP_INVOKE dispatch, not inlining.)
const SELF = `pragma solidcash >=0.8.0;
contract C() {
  int x;
  function decrement(int i, pubkey pk, sig s) {
    require(checkSig(s, pk));
    this.x = this.x - i;
    if (i > 1) { decrement(i - 1, pk, s); }
  }
}`;

// A recursive PURE helper whose result feeds a single state write: exercises the same walk (run -> sumTo ->
// sumTo) and round-trips on-chain.
const PURE = `pragma solidcash >=0.8.0;
contract C() {
  int x;
  function run(int n, pubkey pk, sig s) { require(checkSig(s, pk)); this.x = sumTo(n); }
  function sumTo(int n) returns (int) { if (n <= 1) { return n; } return n + sumTo(n - 1); }
  function chk(int e) { require(this.x == e); }
}`;

describe('recursion in a stateful contract no longer crashes the compiler', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('a stateful self-recursive function compiles (was: compiler crash)', () => {
    expect(() => compileString(SELF, { forceStateful: true })).not.toThrow();
  });

  it('a recursive pure helper feeding a state write compiles and runs', async () => {
    const artifact = compileString(PURE, { forceStateful: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { x: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    await sc.run(4n, alicePub, sig()).send();   // 4+3+2+1 = 10
    await sc.chk(10n).send();
  });
});
