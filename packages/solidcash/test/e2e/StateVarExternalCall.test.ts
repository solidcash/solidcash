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

// A holds the callee in an interface-typed STATE VAR (not a constructor/function param). The external call
// `counterRef.increment(..)` reads the address from A's own self-pinned state.
const READER = `pragma solidcash >=0.8.0;
interface ICounter { public bigint counter; function increment(pubkey owner, sig s); }
contract Reader() {
  ICounter counterRef;
  bigint bumps;
  function bump(pubkey pk, sig s) { require(checkSig(s, pk)); counterRef.increment(pk, s); this.bumps = this.bumps + 1; }
}`;

describe('state-var external-call target', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('calls a callee whose address lives in an interface-typed state var', async () => {
    const counterArt = compileString(COUNTER);
    const readerArt = compileString(READER);

    const counter = new Contract(counterArt, [], { provider });
    const { categoryId: counterCat } = await setupStatefulUtxos(
      provider, counter, counterArt.stateLayout!, { counter: 5n }, { saltContract: true },
    );
    const counterAddr = counter.withCategory(hexToBin(counterCat)).lockingBytecode;

    const reader = new Contract(readerArt, [], { provider });
    // counterRef is an `address` field: store the callee's locking bytecode as raw bytes.
    const { categoryId: readerCat } = await setupStatefulUtxos(
      provider, reader, readerArt.stateLayout!, { counterRef: hexToBin(counterAddr), bumps: 0n }, { saltContract: true },
    );

    const readerSc = StatefulContract.withCategory(reader, readerCat);
    const counterSc = StatefulContract.withCategory(counter, counterCat);

    const tx = await readerSc.bump(alicePub, sig())
      .withExternalCall(counterSc, 'increment', [alicePub, sig()])
      .send();
    expect(tx.txid).toBeDefined();
    expect((await readerSc.getState()).bumps).toBe(1n);
    expect((await counterSc.getState()).counter).toBe(6n);
  });
});
