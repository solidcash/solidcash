import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

const HANDLER = `pragma solidcash >=0.8.0;
interface IHandler { public bigint counter; function inc(pubkey o, sig s); function dec(pubkey o, sig s); }
contract Handler() is IHandler { bigint counter; function inc(pubkey o, sig s) { require(checkSig(s, o)); this.counter = this.counter + 1; } function dec(pubkey o, sig s) { require(checkSig(s, o)); this.counter = this.counter - 1; } }`;

// A FOREIGN function pointer PASSED as a parameter and called (store_function shape). The callee master input
// index is a per-call param the SDK fills, so the covenant reads the right co-spent callee regardless of layout.
const CALLER = `pragma solidcash >=0.8.0;
interface IHandler { public bigint counter; function inc(pubkey o, sig s); function dec(pubkey o, sig s); }
contract Caller() {
  bigint bumps;
  function relay(function(pubkey, sig) external y, pubkey pk, sig s) {
    require(checkSig(s, pk));
    y(pk, s);
    this.bumps = this.bumps + 1;
  }
}`;

describe('foreign function-pointer parameter (per-call master index)', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('co-spends the callee at the pointer address + dispatches its selector', async () => {
    const ha = compileString(HANDLER); const ca = compileString(CALLER);
    const inc = hexToBin(ha.abi.find((f) => f.name === 'inc')!.selector!);
    const handler = new Contract(ha, [], { provider });
    const { categoryId: hc } = await setupStatefulUtxos(provider, handler, ha.stateLayout!, { counter: 5n }, { saltContract: true });
    const hAddr = handler.withCategory(hexToBin(hc)).lockingBytecode;
    const caller = new Contract(ca, [], { provider });
    const { categoryId: cc } = await setupStatefulUtxos(provider, caller, ca.stateLayout!, { bumps: 0n }, { saltContract: true });
    const cSc = StatefulContract.withCategory(caller, cc); const hSc = StatefulContract.withCategory(handler, hc);
    const tx = await cSc.relay(hexToBin(hAddr), inc, alicePub, sig())
      .withExternalCall(hSc, 'inc', [alicePub, sig()]).send();
    expect(tx.txid).toBeDefined();
    expect((await cSc.getState()).bumps).toBe(1n);
    expect((await hSc.getState()).counter).toBe(6n);
  });
});

describe('foreign fn-ptr params: MULTIPLE calls bind to the proper callee (per-call index)', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  const H = `pragma solidcash >=0.8.0;
    interface IH { public bigint counter; function inc(pubkey o, sig s); function dec(pubkey o, sig s); }
    contract H() is IH { bigint counter;
      function inc(pubkey o, sig s) { require(checkSig(s, o)); this.counter = this.counter + 1; }
      function dec(pubkey o, sig s) { require(checkSig(s, o)); this.counter = this.counter - 1; } }`;
  const C2 = `pragma solidcash >=0.8.0;
    interface IH { public bigint counter; function inc(pubkey o, sig s); function dec(pubkey o, sig s); }
    contract C2() { bigint n;
      function relay2(function(pubkey,sig) external a, function(pubkey,sig) external b, pubkey pk, sig s) {
        require(checkSig(s, pk)); a(pk, s); b(pk, s); this.n = this.n + 1; } }`;

  it('dispatches two different callees (A.inc + B.dec) - not the first for both', async () => {
    const ha = compileString(H); const ca = compileString(C2);
    const incSel = hexToBin(ha.abi.find((f) => f.name === 'inc')!.selector!);
    const decSel = hexToBin(ha.abi.find((f) => f.name === 'dec')!.selector!);

    const a = new Contract(ha, [], { provider });
    const { categoryId: ac } = await setupStatefulUtxos(provider, a, ha.stateLayout!, { counter: 10n }, { saltContract: true });
    const aAddr = a.withCategory(hexToBin(ac)).lockingBytecode;
    const b = new Contract(ha, [], { provider });
    const { categoryId: bc } = await setupStatefulUtxos(provider, b, ha.stateLayout!, { counter: 20n }, { saltContract: true });
    const bAddr = b.withCategory(hexToBin(bc)).lockingBytecode;
    const caller = new Contract(ca, [], { provider });
    const { categoryId: cc } = await setupStatefulUtxos(provider, caller, ca.stateLayout!, { n: 0n }, { saltContract: true });

    const cSc = StatefulContract.withCategory(caller, cc);
    const aSc = StatefulContract.withCategory(a, ac); const bSc = StatefulContract.withCategory(b, bc);
    // a -> A.inc (10->11), b -> B.dec (20->19). If binding were "first match", both would hit the same callee.
    const tx = await cSc.relay2(hexToBin(aAddr), incSel, hexToBin(bAddr), decSel, alicePub, sig())
      .withExternalCall(aSc, 'inc', [alicePub, sig()])
      .withExternalCall(bSc, 'dec', [alicePub, sig()])
      .send();
    expect(tx.txid).toBeDefined();
    expect((await aSc.getState()).counter).toBe(11n);
    expect((await bSc.getState()).counter).toBe(19n);
  });
});
