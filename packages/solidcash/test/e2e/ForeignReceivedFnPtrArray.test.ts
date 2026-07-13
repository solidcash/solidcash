import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

const HANDLER = `pragma solidcash >=0.8.0;
interface IH { public bigint counter; function inc(uint256 v); function dec(uint256 v); }
contract Handler() is IH {
  bigint counter;
  function inc(uint256 v) { this.counter = this.counter + int(v); require(int(v) >= 0); }
  function dec(uint256 v) { this.counter = this.counter - int(v); require(int(v) >= 0); }
}`;

// A RECEIVED-value foreign fn-ptr dispatch table: `reg` takes a fn-ptr VALUE (address + selector carried in
// the value) and pushes it - the method is NOT known at the push site. Lowers to `address[] fns` + a parallel
// `bytes[] __fnsel_fns` + the `__FnPtr_A(fns[i]).__call` loop. Because the callee layout is unknown for a
// received pointer, each iteration reads its callee master input index from the SDK-filled
// `__internal__extcallIdxList` witness (identity-bound to arr[i], strictly increasing) - the STATEFUL callees
// here (master + 1 data NFT each) are exactly what a compile-time stride could not span.
const TABLE = `pragma solidcash >=0.8.0;
contract Table() {
  function(uint256) external[] fns;
  bigint bumps;
  function reg(function(uint256) external p, pubkey pk, sig s) {
    require(checkSig(s, pk)); this.fns.push(p); this.bumps = this.bumps + 1;
  }
  function fire(uint256 v, pubkey pk, sig s) {
    require(checkSig(s, pk)); fns[0](v); this.bumps = this.bumps + 1;
  }
}`;

describe('foreign RECEIVED-value fn-ptr array dispatch table', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
  const ha = compileString(HANDLER);
  const ta = compileString(TABLE);
  const incSel = hexToBin(ha.abi.find((f) => f.name === 'inc')!.selector!);
  const decSel = hexToBin(ha.abi.find((f) => f.name === 'dec')!.selector!);
  const fnPtrIface = ta.abi.find((f) => f.name === 'fire')!.externalCalls![0].interfaceName;

  const deployHandler = async (counter: bigint): Promise<{ sc: any; addr: Uint8Array }> => {
    const c = new Contract(ha, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, c, ha.stateLayout!, { counter }, { saltContract: true });
    return { sc: StatefulContract.withCategory(c, categoryId), addr: c.withCategory(hexToBin(categoryId)).lockingBytecode };
  };

  const deployTable = async (): Promise<any> => {
    const table = new Contract(ta, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, table, ta.stateLayout!, { fns: [], __fnsel_fns: [], bumps: 0n }, { saltContract: true },
    );
    return StatefulContract.withCategory(table, categoryId);
  };

  it('dispatches each received pointer to its OWN method (inc vs dec, stateful callees)', async () => {
    const { sc: c0Sc, addr: c0Addr } = await deployHandler(5n);
    const { sc: c1Sc, addr: c1Addr } = await deployHandler(20n);
    const tableSc = await deployTable();

    // Pass a fn-ptr VALUE (address + selector) to reg; the method rides in the value, not the push site.
    await tableSc.reg(hexToBin(c0Addr), incSel, alicePub, sig()).send();
    await tableSc.reg(hexToBin(c1Addr), decSel, alicePub, sig()).send();

    tableSc.registerExternalArray(fnPtrIface, [c0Sc, c1Sc], ['inc', 'dec']);
    const tx = await tableSc.fire(3n, alicePub, sig()).send();
    expect(tx.txid).toBeDefined();

    expect((await c0Sc.getState()).counter).toBe(8n);   // c0.inc(3): 5 + 3
    expect((await c1Sc.getState()).counter).toBe(17n);  // c1.dec(3): 20 - 3
  });

  it('dispatches HETEROGENEOUS callees (different data-NFT counts - impossible for any fixed stride)', async () => {
    // A fat-state callee: counter + two bytes70 pads exceed one 128-byte commitment -> 2+ data NFTs, so its
    // co-spend group is wider than Handler's (master + 1). Only per-element witness indices can span both.
    const FAT = `pragma solidcash >=0.8.0;
    contract FatHandler() {
      bigint counter;
      bytes70 pad1;
      bytes70 pad2;
      function inc(uint256 v) { this.counter = this.counter + int(v); require(int(v) >= 0); }
    }`;
    const fa = compileString(FAT);
    const fatDataNfts = fa.stateLayout!.variables.reduce((m, v) => Math.max(m, v.nftIndex ?? 0), 0) + 1;
    expect(fatDataNfts).toBeGreaterThan(1); // must actually be wider than Handler (else the test proves nothing)

    const { sc: c0Sc, addr: c0Addr } = await deployHandler(5n);
    const fat = new Contract(fa, [], { provider });
    const { categoryId: fc } = await setupStatefulUtxos(
      provider, fat, fa.stateLayout!,
      { counter: 100n, pad1: new Uint8Array(70), pad2: new Uint8Array(70) }, { saltContract: true },
    );
    const fatSc = StatefulContract.withCategory(fat, fc);
    const fatAddr = fat.withCategory(hexToBin(fc)).lockingBytecode;
    const tableSc = await deployTable();

    await tableSc.reg(hexToBin(c0Addr), incSel, alicePub, sig()).send();
    await tableSc.reg(hexToBin(fatAddr), hexToBin(fa.abi.find((f) => f.name === 'inc')!.selector!), alicePub, sig()).send();

    tableSc.registerExternalArray(fnPtrIface, [c0Sc, fatSc], ['inc', 'inc']);
    const tx = await tableSc.fire(7n, alicePub, sig()).send();
    expect(tx.txid).toBeDefined();

    expect((await c0Sc.getState()).counter).toBe(12n);    // 5 + 7
    expect((await fatSc.getState()).counter).toBe(107n);  // 100 + 7
  });

  it('rejects provisioning an element with the WRONG method (per-element on-chain selector binding)', async () => {
    const { sc: c0Sc, addr: c0Addr } = await deployHandler(5n);
    const tableSc = await deployTable();
    await tableSc.reg(hexToBin(c0Addr), incSel, alicePub, sig()).send();  // fns[0] carries inc's selector

    tableSc.registerExternalArray(fnPtrIface, [c0Sc], ['dec']);
    await expect(tableSc.fire(3n, alicePub, sig()).send()).rejects.toThrow();
  });
});
