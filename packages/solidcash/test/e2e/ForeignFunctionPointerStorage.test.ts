import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

// A 2-method callee so its co-spend unlocking carries a selector (single-method selector elision is a follow-up).
const HANDLER = `pragma solidcash >=0.8.0;
interface IH { public bigint counter; function inc(pubkey o, sig s); function dec(pubkey o, sig s); }
contract Handler() is IH { bigint counter;
  function inc(pubkey o, sig s) { require(checkSig(s, o)); this.counter = this.counter + 1; }
  function dec(pubkey o, sig s) { require(checkSig(s, o)); this.counter = this.counter - 1; } }`;

// A foreign fn-ptr STATE var holding a RECEIVED value (`this.stored = y`, method carried in the value). It
// flattens to an `address stored` + a `bytes4 __fnsel_stored` companion; `save` stores both, `run` calls through
// the pair (state-address co-spend + runtime selector + per-call master index). store_function's `x = y` case.
const STORE = `pragma solidcash >=0.8.0;
interface IH { public bigint counter; function inc(pubkey o, sig s); function dec(pubkey o, sig s); }
contract Store() {
  function(pubkey, sig) external stored;
  bigint bumps;
  function save(function(pubkey, sig) external y, pubkey pk, sig s) {
    require(checkSig(s, pk)); this.stored = y; this.bumps = this.bumps + 1;
  }
  function run(pubkey pk, sig s) { require(checkSig(s, pk)); stored(pk, s); this.bumps = this.bumps + 1; }
}`;

describe('foreign fn-ptr STATE storage of a received value (x = y)', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('calls through a seeded (address, selector) pair - the storage-read co-spend', async () => {
    const ha = compileString(HANDLER); const sa = compileString(STORE);
    const inc = hexToBin(ha.abi.find((f) => f.name === 'inc')!.selector!);

    const handler = new Contract(ha, [], { provider });
    const { categoryId: hc } = await setupStatefulUtxos(
      provider, handler, ha.stateLayout!, { counter: 5n }, { saltContract: true },
    );
    const hAddr = handler.withCategory(hexToBin(hc)).lockingBytecode;

    // Seed the flattened pointer directly: stored = callee address, __fnsel_stored = inc's selector.
    const store = new Contract(sa, [], { provider });
    const { categoryId: sc } = await setupStatefulUtxos(
      provider, store, sa.stateLayout!,
      { stored: hexToBin(hAddr), __fnsel_stored: inc, bumps: 0n }, { saltContract: true },
    );

    const storeSc = StatefulContract.withCategory(store, sc);
    const handlerSc = StatefulContract.withCategory(handler, hc);

    const tx = await storeSc.run(alicePub, sig())
      .withExternalCall(handlerSc, 'inc', [alicePub, sig()])
      .send();
    expect(tx.txid).toBeDefined();
    expect((await storeSc.getState()).bumps).toBe(1n);
    expect((await handlerSc.getState()).counter).toBe(6n);
  });

  it('stores a received foreign pointer then calls it in a later tx (save -> run)', async () => {
    const ha = compileString(HANDLER); const sa = compileString(STORE);
    const inc = hexToBin(ha.abi.find((f) => f.name === 'inc')!.selector!);

    const handler = new Contract(ha, [], { provider });
    const { categoryId: hc } = await setupStatefulUtxos(
      provider, handler, ha.stateLayout!, { counter: 5n }, { saltContract: true },
    );
    const hAddr = handler.withCategory(hexToBin(hc)).lockingBytecode;

    // Deploy with an EMPTY pointer; `save` must be what installs it.
    const store = new Contract(sa, [], { provider });
    const { categoryId: sc } = await setupStatefulUtxos(
      provider, store, sa.stateLayout!,
      { stored: new Uint8Array(), __fnsel_stored: new Uint8Array(4), bumps: 0n }, { saltContract: true },
    );
    const storeSc = StatefulContract.withCategory(store, sc);
    const handlerSc = StatefulContract.withCategory(handler, hc);

    // save: install the pointer (address + selector) into state.
    const saveTx = await storeSc.save(hexToBin(hAddr), inc, alicePub, sig()).send();
    expect(saveTx.txid).toBeDefined();
    expect((await storeSc.getState()).bumps).toBe(1n);

    // run: call through the stored pointer, co-spending the callee.
    const runTx = await storeSc.run(alicePub, sig())
      .withExternalCall(handlerSc, 'inc', [alicePub, sig()])
      .send();
    expect(runTx.txid).toBeDefined();
    expect((await storeSc.getState()).bumps).toBe(2n);
    expect((await handlerSc.getState()).counter).toBe(6n);
  });
});

// A stored foreign pointer whose call RETURNS a value: the return flows back through the return-event (data) NFT
// and is captured into caller state - reusing the external-call return infrastructure through the fn-ptr call.
const HANDLER_R = `pragma solidcash >=0.8.0;
interface IH { public bigint counter;
  function inc(pubkey o, sig s) returns (bigint); function dec(pubkey o, sig s) returns (bigint); }
contract Handler() is IH { bigint counter;
  function inc(pubkey o, sig s) returns (bigint) { require(checkSig(s, o)); this.counter = this.counter + 1; return this.counter; }
  function dec(pubkey o, sig s) returns (bigint) { require(checkSig(s, o)); this.counter = this.counter - 1; return this.counter; } }`;

const STORE_R = `pragma solidcash >=0.8.0;
interface IH { public bigint counter;
  function inc(pubkey o, sig s) returns (bigint); function dec(pubkey o, sig s) returns (bigint); }
contract Store() {
  function(pubkey, sig) external returns (bigint) stored;
  bigint lastResult;
  function save(function(pubkey, sig) external returns (bigint) y, pubkey pk, sig s) {
    require(checkSig(s, pk)); this.stored = y; this.lastResult = 0;
  }
  function run(pubkey pk, sig s) { require(checkSig(s, pk)); this.lastResult = stored(pk, s); }
}`;

describe('foreign fn-ptr STATE storage with a RETURN value (return-event NFT)', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('captures the stored pointer call return value into caller state', async () => {
    const ha = compileString(HANDLER_R); const sa = compileString(STORE_R);
    const inc = hexToBin(ha.abi.find((f) => f.name === 'inc')!.selector!);

    const handler = new Contract(ha, [], { provider });
    const { categoryId: hc } = await setupStatefulUtxos(
      provider, handler, ha.stateLayout!, { counter: 5n }, { saltContract: true },
    );
    const hAddr = handler.withCategory(hexToBin(hc)).lockingBytecode;

    const store = new Contract(sa, [], { provider });
    const { categoryId: sc } = await setupStatefulUtxos(
      provider, store, sa.stateLayout!,
      { stored: hexToBin(hAddr), __fnsel_stored: inc, lastResult: 0n }, { saltContract: true },
    );
    const storeSc = StatefulContract.withCategory(store, sc);
    const handlerSc = StatefulContract.withCategory(handler, hc);

    const tx = await storeSc.run(alicePub, sig())
      .withExternalCall(handlerSc, 'inc', [alicePub, sig()])
      .send();
    expect(tx.txid).toBeDefined();
    // inc bumped counter 5 -> 6 and returned 6; the return-event NFT carried 6 back into lastResult.
    expect((await handlerSc.getState()).counter).toBe(6n);
    expect((await storeSc.getState()).lastResult).toBe(6n);
  });
});
