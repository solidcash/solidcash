import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

// A permissionless callee (no checkSig) so it can be co-spent by the table covenant.
const COUNTER = `pragma solidcash >=0.8.0;
interface ICounter { public bigint counter; function increment(uint256 v); }
contract Counter() is ICounter {
  bigint counter;
  function increment(uint256 v) { this.counter = this.counter + int(v); require(int(v) >= 0); }
}`;

// A DISPATCH TABLE of foreign fn-ptrs (fixed method increment, varying address). The fn-ptr array lowers to a
// plain `address[]` + the shipped array-element co-spend `ICounter(fns[i]).increment(..)`, which BROADCASTS:
// the covenant co-spends + verifies + calls the method on EVERY registered callee (the notify-subscribers model).
const TABLE = `pragma solidcash >=0.8.0;
interface ICounter { public bigint counter; function increment(uint256 v); }
contract Table() {
  function(uint256) external[] fns;
  bigint bumps;
  function register(address a, pubkey pk, sig s) {
    require(checkSig(s, pk)); this.fns.push(ICounter(a).increment); this.bumps = this.bumps + 1;
  }
  function fireAll(uint256 v, pubkey pk, sig s) {
    require(checkSig(s, pk)); fns[0](v); this.bumps = this.bumps + 1;
  }
}`;

describe('foreign fn-ptr ARRAY dispatch table (fixed method on runtime addresses)', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('builds the table via push then co-spends every callee through fns[i]()', async () => {
    const ca = compileString(COUNTER); const ta = compileString(TABLE);

    const c0 = new Contract(ca, [], { provider });
    const { categoryId: cc0 } = await setupStatefulUtxos(
      provider, c0, ca.stateLayout!, { counter: 5n }, { saltContract: true },
    );
    const c0Addr = c0.withCategory(hexToBin(cc0)).lockingBytecode;
    const c1 = new Contract(ca, [], { provider });
    const { categoryId: cc1 } = await setupStatefulUtxos(
      provider, c1, ca.stateLayout!, { counter: 20n }, { saltContract: true },
    );
    const c1Addr = c1.withCategory(hexToBin(cc1)).lockingBytecode;

    const table = new Contract(ta, [], { provider });
    const { categoryId: tc } = await setupStatefulUtxos(
      provider, table, ta.stateLayout!, { fns: [], bumps: 0n }, { saltContract: true },
    );
    const tableSc = StatefulContract.withCategory(table, tc);
    const c0Sc = StatefulContract.withCategory(c0, cc0);
    const c1Sc = StatefulContract.withCategory(c1, cc1);

    await tableSc.register(hexToBin(c0Addr), alicePub, sig()).send();
    await tableSc.register(hexToBin(c1Addr), alicePub, sig()).send();

    tableSc.registerExternalArray('ICounter', [c0Sc, c1Sc]);
    const tx = await tableSc.fireAll(3n, alicePub, sig()).send();
    expect(tx.txid).toBeDefined();
    // The array call broadcasts: EVERY registered callee is co-spent + increment(3) is called on each.
    expect((await c0Sc.getState()).counter).toBe(8n);   // 5 + 3
    expect((await c1Sc.getState()).counter).toBe(23n);  // 20 + 3
  });
});
