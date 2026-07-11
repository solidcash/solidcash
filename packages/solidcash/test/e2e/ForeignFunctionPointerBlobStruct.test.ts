import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

const HANDLER = `pragma solidcash >=0.8.0;
interface IH { public bigint counter; function inc(pubkey o, sig s); function dec(pubkey o, sig s); }
contract Handler() is IH { bigint counter;
  function inc(pubkey o, sig s) { require(checkSig(s, o)); this.counter = this.counter + 1; }
  function dec(pubkey o, sig s) { require(checkSig(s, o)); this.counter = this.counter - 1; } }`;

// A RECEIVED-value foreign fn-ptr held in a STRUCT FIELD (method carried in the value) - the general blob model.
// The field lowers to a bytes blob `selector ++ address`; the call slices it into the audited external call.
const HOLDER = `pragma solidcash >=0.8.0;
interface IH { public bigint counter; function inc(pubkey o, sig s); function dec(pubkey o, sig s); }
contract Holder() {
  struct S { function(pubkey, sig) external fn; bigint bumps; }
  S s;
  function store(function(pubkey, sig) external y, pubkey pk, sig si) { require(checkSig(si, pk)); this.s = S(y, 0); }
  function run(pubkey pk, sig si) { require(checkSig(si, pk)); s.fn(pk, si); this.s = S(s.fn, this.s.bumps + 1); }
}`;

const blob = (sel: Uint8Array, addr: Uint8Array): Uint8Array => {
  const b = new Uint8Array(sel.length + addr.length); b.set(sel); b.set(addr, sel.length); return b;
};

describe('foreign fn-ptr RECEIVED value in a STRUCT FIELD (blob model)', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('calls through a seeded blob struct field (selector ++ address)', async () => {
    const ha = compileString(HANDLER); const ma = compileString(HOLDER);
    const inc = hexToBin(ha.abi.find((f) => f.name === 'inc')!.selector!);

    const handler = new Contract(ha, [], { provider });
    const { categoryId: hc } = await setupStatefulUtxos(
      provider, handler, ha.stateLayout!, { counter: 5n }, { saltContract: true },
    );
    const hAddr = handler.withCategory(hexToBin(hc)).lockingBytecode;

    const holder = new Contract(ma, [], { provider });
    const { categoryId: mc } = await setupStatefulUtxos(
      provider, holder, ma.stateLayout!, { s: { fn: blob(inc, hexToBin(hAddr)), bumps: 0n } }, { saltContract: true },
    );
    const holderSc = StatefulContract.withCategory(holder, mc);
    const handlerSc = StatefulContract.withCategory(handler, hc);

    const tx = await holderSc.run(alicePub, sig())
      .withExternalCall(handlerSc, 'inc', [alicePub, sig()])
      .send();
    expect(tx.txid).toBeDefined();
    expect((await holderSc.getState()).s.bumps).toBe(1n);
    expect((await handlerSc.getState()).counter).toBe(6n);
  });

  it('stores a received blob pointer then calls it (store -> run)', async () => {
    const ha = compileString(HANDLER); const ma = compileString(HOLDER);
    const inc = hexToBin(ha.abi.find((f) => f.name === 'inc')!.selector!);

    const handler = new Contract(ha, [], { provider });
    const { categoryId: hc } = await setupStatefulUtxos(
      provider, handler, ha.stateLayout!, { counter: 5n }, { saltContract: true },
    );
    const hAddr = handler.withCategory(hexToBin(hc)).lockingBytecode;

    const holder = new Contract(ma, [], { provider });
    const { categoryId: mc } = await setupStatefulUtxos(
      provider, holder, ma.stateLayout!, { s: { fn: new Uint8Array(), bumps: 0n } }, { saltContract: true },
    );
    const holderSc = StatefulContract.withCategory(holder, mc);
    const handlerSc = StatefulContract.withCategory(handler, hc);

    await holderSc.store(blob(inc, hexToBin(hAddr)), alicePub, sig()).send();

    const tx = await holderSc.run(alicePub, sig())
      .withExternalCall(handlerSc, 'inc', [alicePub, sig()])
      .send();
    expect(tx.txid).toBeDefined();
    expect((await holderSc.getState()).s.bumps).toBe(1n);
    expect((await handlerSc.getState()).counter).toBe(6n);
  });
});
