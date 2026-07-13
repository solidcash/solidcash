import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

// Regression: a VALUE-RETURNING external call while the caller reads TWO OR MORE dynamic-storage arrays
// (preserved chunk co-spends) silently failed at send: build() places the chunk preservation outputs BEFORE
// the callee outputs, but getEntryOutputBase (the chain root under getReturnEventOutputBase) did not count
// them, so the derivation searched the wrong output range, never extracted the return-event commitment, and
// the callee rejected the placeholder. ONE chunk passed only by the range's inclusive upper bound. Fixed by
// counting the chunk-before-callee outputs at the chain root (matches the witness-side formula).
const RH = `pragma solidcash >=0.8.0;
contract RetHandler() { bigint counter;
  function inc(uint256 v) returns (uint256) { this.counter = this.counter + int(v); require(int(v) >= 0); return uint256(this.counter); } }`;

describe('value-returning external call + multiple dynamic-array reads', () => {
  it('returns correctly while the caller reads two chunked arrays', async () => {
    const provider = createTestProvider();
    const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
    const ra = compileString(RH);
    const rh = new Contract(ra, [], { provider });
    const { categoryId: rc } = await setupStatefulUtxos(
      provider, rh, ra.stateLayout!, { counter: 40n }, { saltContract: true },
    );
    const rhSc = StatefulContract.withCategory(rh, rc);
    const rhAddr = rh.withCategory(hexToBin(rc)).lockingBytecode;

    const TA = `pragma solidcash >=0.8.0;
    interface IR { public bigint counter; function inc(uint256 v) returns (uint256); }
    contract T() { int[] a; int[] b; address target; bigint last;
      function seed(pubkey pk, sig s) { require(checkSig(s, pk)); this.a.push(7); this.b.push(9); }
      function fire(uint256 v, pubkey pk, sig s) { require(checkSig(s, pk)); int x = a[0]; int y = b[0]; this.last = int(IR(target).inc(v)) + x + y - x - y; } }`;
    const ta = compileString(TA);
    const t = new Contract(ta, [], { provider });
    const { categoryId: tc } = await setupStatefulUtxos(
      provider, t, ta.stateLayout!, { a: [], b: [], target: hexToBin(rhAddr), last: 0n }, { saltContract: true },
    );
    const tSc = StatefulContract.withCategory(t, tc);
    await tSc.seed(alicePub, sig()).send();

    await tSc.fire(2n, alicePub, sig()).withExternalCall(rhSc, 'inc', [2n]).send();
    expect((await tSc.getState()).last).toBe(42n);
    expect((await rhSc.getState()).counter).toBe(42n);
  });
});
