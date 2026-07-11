import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

const COUNTER = `pragma solidcash >=0.8.0;
interface ICounter { public bigint counter; function increment(pubkey owner, sig s); }
contract Counter() is ICounter {
  bigint counter;
  function increment(pubkey owner, sig s) { require(checkSig(s, owner)); this.counter = this.counter + 1; }
}`;

// A foreign fn-ptr held in a STRUCT FIELD, fixed method (increment) on a runtime address. It lowers to an
// interface-typed field + the shipped struct-field-chain external call `s.fn.increment(..)`, so the callee is
// co-spent + verified via the struct chain - the nested analogue of the fixed-method state-var pointer.
const HOLDER = `pragma solidcash >=0.8.0;
interface ICounter { public bigint counter; function increment(pubkey owner, sig s); }
contract Holder() {
  struct S { function(pubkey, sig) external fn; bigint bumps; }
  S s;
  function register(address a) { this.s.fn = ICounter(a).increment; }
  function bump(pubkey pk, sig si) { require(checkSig(si, pk)); s.fn(pk, si); this.s.bumps = this.s.bumps + 1; }
}`;

describe('foreign fn-ptr in a STRUCT FIELD (fixed method on a runtime address)', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('co-spends the callee through a seeded struct-field pointer', async () => {
    const ca = compileString(COUNTER); const ha = compileString(HOLDER);

    const counter = new Contract(ca, [], { provider });
    const { categoryId: cc } = await setupStatefulUtxos(
      provider, counter, ca.stateLayout!, { counter: 5n }, { saltContract: true },
    );
    const cAddr = counter.withCategory(hexToBin(cc)).lockingBytecode;

    // Seed the struct field (now an interface-typed address) with the callee's locking bytecode.
    const holder = new Contract(ha, [], { provider });
    const { categoryId: hc } = await setupStatefulUtxos(
      provider, holder, ha.stateLayout!, { s: { fn: hexToBin(cAddr), bumps: 0n } }, { saltContract: true },
    );
    const holderSc = StatefulContract.withCategory(holder, hc);
    const counterSc = StatefulContract.withCategory(counter, cc);

    const tx = await holderSc.bump(alicePub, sig())
      .withExternalCall(counterSc, 'increment', [alicePub, sig()])
      .send();
    expect(tx.txid).toBeDefined();
    expect((await holderSc.getState()).s.bumps).toBe(1n);
    expect((await counterSc.getState()).counter).toBe(6n);
  });

  it('register() installs the struct-field pointer, then bump() calls through it', async () => {
    const ca = compileString(COUNTER); const ha = compileString(HOLDER);

    const counter = new Contract(ca, [], { provider });
    const { categoryId: cc } = await setupStatefulUtxos(
      provider, counter, ca.stateLayout!, { counter: 5n }, { saltContract: true },
    );
    const cAddr = counter.withCategory(hexToBin(cc)).lockingBytecode;

    const holder = new Contract(ha, [], { provider });
    const { categoryId: hc } = await setupStatefulUtxos(
      provider, holder, ha.stateLayout!, { s: { fn: new Uint8Array(), bumps: 0n } }, { saltContract: true },
    );
    const holderSc = StatefulContract.withCategory(holder, hc);
    const counterSc = StatefulContract.withCategory(counter, cc);

    const regTx = await holderSc.register(hexToBin(cAddr)).send();
    expect(regTx.txid).toBeDefined();

    const tx = await holderSc.bump(alicePub, sig())
      .withExternalCall(counterSc, 'increment', [alicePub, sig()])
      .send();
    expect(tx.txid).toBeDefined();
    expect((await holderSc.getState()).s.bumps).toBe(1n);
    expect((await counterSc.getState()).counter).toBe(6n);
  });
});
