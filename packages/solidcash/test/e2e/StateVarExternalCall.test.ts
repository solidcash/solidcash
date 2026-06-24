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

// Contract-typed (not interface) external-call target: the callee is referenced by its CONTRACT name. The
// callee is compiled standalone; the caller embeds an identical definition purely for type resolution (the
// dispatch verifies the runtime co-spent callee's bytecode against the address stored in state).
const CT_CALLEE = `pragma solidcash >=0.8.0;
contract CtCounter() {
  bigint counter;
  function increment(pubkey owner, sig s) { require(checkSig(s, owner)); this.counter = this.counter + 1; }
}`;

const CT_CALLER = `pragma solidcash >=0.8.0;
contract CtCounter() {
  bigint counter;
  function increment(pubkey owner, sig s) { require(checkSig(s, owner)); this.counter = this.counter + 1; }
}
contract CtReader() {
  CtCounter counterRef;
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

  it('calls a contract-typed (non-interface) callee held in a state var', async () => {
    const calleeArt = compileString(CT_CALLEE);
    const callerArt = compileString(CT_CALLER);

    const callee = new Contract(calleeArt, [], { provider });
    const { categoryId: calleeCat } = await setupStatefulUtxos(
      provider, callee, calleeArt.stateLayout!, { counter: 5n }, { saltContract: true },
    );
    const calleeAddr = callee.withCategory(hexToBin(calleeCat)).lockingBytecode;

    const reader = new Contract(callerArt, [], { provider });
    const { categoryId: readerCat } = await setupStatefulUtxos(
      provider, reader, callerArt.stateLayout!, { counterRef: hexToBin(calleeAddr), bumps: 0n }, { saltContract: true },
    );

    const readerSc = StatefulContract.withCategory(reader, readerCat);
    const calleeSc = StatefulContract.withCategory(callee, calleeCat);

    const tx = await readerSc.bump(alicePub, sig())
      .withExternalCall(calleeSc, 'increment', [alicePub, sig()])
      .send();
    expect(tx.txid).toBeDefined();
    expect((await readerSc.getState()).bumps).toBe(1n);
    expect((await calleeSc.getState()).counter).toBe(6n);
  });
});
