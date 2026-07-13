import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

// A permissionless callee (no checkSig) so the table covenant can co-spend it.
const HANDLER = `pragma solidcash >=0.8.0;
interface IH { public bigint counter; function inc(uint256 v); function dec(uint256 v); }
contract Handler() is IH {
  bigint counter;
  function inc(uint256 v) { this.counter = this.counter + int(v); require(int(v) >= 0); }
  function dec(uint256 v) { this.counter = this.counter - int(v); require(int(v) >= 0); }
}`;

// A VARYING-method foreign fn-ptr dispatch table: the array holds `IH(a).inc` for some elements and `IH(a).dec`
// for others. It lowers to `address[] fns` + a parallel `bytes[] __fnsel_fns` selector array; each push records
// the element's selector, and the array call co-spends every callee and verifies its co-spent method == that
// element's on-chain selector (broadcast, each element calling its OWN method).
const TABLE = `pragma solidcash >=0.8.0;
interface IH { public bigint counter; function inc(uint256 v); function dec(uint256 v); }
contract Table() {
  function(uint256) external[] fns;
  bigint bumps;
  function registerInc(address a, pubkey pk, sig s) {
    require(checkSig(s, pk)); this.fns.push(IH(a).inc); this.bumps = this.bumps + 1;
  }
  function registerDec(address a, pubkey pk, sig s) {
    require(checkSig(s, pk)); this.fns.push(IH(a).dec); this.bumps = this.bumps + 1;
  }
  function fireAll(uint256 v, pubkey pk, sig s) {
    require(checkSig(s, pk)); for (int i = 0; i < 2; i++) { fns[i](v); } this.bumps = this.bumps + 1;
  }
}`;

describe('foreign fn-ptr ARRAY dispatch table (varying method per element)', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
  const ha = compileString(HANDLER);
  const ta = compileString(TABLE);

  const deployHandler = async (counter: bigint): Promise<{ sc: any; addr: Uint8Array }> => {
    const c = new Contract(ha, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, c, ha.stateLayout!, { counter }, { saltContract: true });
    return { sc: StatefulContract.withCategory(c, categoryId), addr: c.withCategory(hexToBin(categoryId)).lockingBytecode };
  };

  it('co-spends every callee with its OWN registered method (inc vs dec)', async () => {
    const { sc: c0Sc, addr: c0Addr } = await deployHandler(5n);
    const { sc: c1Sc, addr: c1Addr } = await deployHandler(20n);

    const table = new Contract(ta, [], { provider });
    const { categoryId: tc } = await setupStatefulUtxos(
      provider, table, ta.stateLayout!, { fns: [], __fnsel_fns: [], bumps: 0n }, { saltContract: true },
    );
    const tableSc = StatefulContract.withCategory(table, tc);

    await tableSc.registerInc(hexToBin(c0Addr), alicePub, sig()).send();  // fns[0] = (c0, inc)
    await tableSc.registerDec(hexToBin(c1Addr), alicePub, sig()).send();  // fns[1] = (c1, dec)

    tableSc.registerExternalArray('IH', [c0Sc, c1Sc], ['inc', 'dec']);
    const tx = await tableSc.fireAll(3n, alicePub, sig()).send();
    expect(tx.txid).toBeDefined();

    // Broadcast: c0's OWN method inc(3) -> 5 + 3; c1's OWN method dec(3) -> 20 - 3.
    expect((await c0Sc.getState()).counter).toBe(8n);
    expect((await c1Sc.getState()).counter).toBe(17n);
  });

  it('rejects co-spending an element with the WRONG method (covenant binds each to its on-chain selector)', async () => {
    const { sc: c0Sc, addr: c0Addr } = await deployHandler(5n);
    const table = new Contract(ta, [], { provider });
    const { categoryId: tc } = await setupStatefulUtxos(
      provider, table, ta.stateLayout!, { fns: [], __fnsel_fns: [], bumps: 0n }, { saltContract: true },
    );
    const tableSc = StatefulContract.withCategory(table, tc);
    await tableSc.registerInc(hexToBin(c0Addr), alicePub, sig()).send();  // fns[0] pushed as (c0, inc)

    // Provision c0 with dec (wrong): the on-chain selector for element 0 is inc's, so the co-spent dec method
    // fails the covenant's per-element selector check.
    tableSc.registerExternalArray('IH', [c0Sc], ['dec']);
    await expect(tableSc.fireAll(3n, alicePub, sig()).send()).rejects.toThrow();
  });
});
