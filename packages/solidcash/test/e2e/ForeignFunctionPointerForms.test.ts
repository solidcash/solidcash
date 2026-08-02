// Foreign external function-pointer VALUE forms: param, return, state var, storage, struct field,
// single-method callee, cross-contract pass/return, blob struct, contract-member, member-to-internal.
import { describe, it, expect } from 'vitest';
import { compileString, compileStringMulti } from '../direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv, alicePkh } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

describe('param', () => {
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
      const { categoryId: hc } = await setupStatefulUtxos(
        provider, handler, ha.stateLayout!, { counter: 5n }, { saltContract: true },
      );
      const hAddr = handler.withCategory(hexToBin(hc)).lockingBytecode;
      const caller = new Contract(ca, [], { provider });
      const { categoryId: cc } = await setupStatefulUtxos(
        provider, caller, ca.stateLayout!, { bumps: 0n }, { saltContract: true },
      );
      const cSc = StatefulContract.withCategory(caller, cc); const hSc = StatefulContract.withCategory(handler, hc);
      const tx = await cSc.relay(hexToBin(hAddr), inc, alicePub, sig())
        .withExternalCall(hSc, 'inc', [alicePub, sig()]).send();
      expect(tx).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
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
      const { categoryId: ac } = await setupStatefulUtxos(
        provider, a, ha.stateLayout!, { counter: 10n }, { saltContract: true },
      );
      const aAddr = a.withCategory(hexToBin(ac)).lockingBytecode;
      const b = new Contract(ha, [], { provider });
      const { categoryId: bc } = await setupStatefulUtxos(
        provider, b, ha.stateLayout!, { counter: 20n }, { saltContract: true },
      );
      const bAddr = b.withCategory(hexToBin(bc)).lockingBytecode;
      const caller = new Contract(ca, [], { provider });
      const { categoryId: cc } = await setupStatefulUtxos(
        provider, caller, ca.stateLayout!, { n: 0n }, { saltContract: true },
      );

      const cSc = StatefulContract.withCategory(caller, cc);
      const aSc = StatefulContract.withCategory(a, ac); const bSc = StatefulContract.withCategory(b, bc);
      // a -> A.inc (10->11), b -> B.dec (20->19). If binding were "first match", both would hit the same callee.
      const tx = await cSc.relay2(hexToBin(aAddr), incSel, hexToBin(bAddr), decSel, alicePub, sig())
        .withExternalCall(aSc, 'inc', [alicePub, sig()])
        .withExternalCall(bSc, 'dec', [alicePub, sig()])
        .send();
      expect(tx).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
      expect((await aSc.getState()).counter).toBe(11n);
      expect((await bSc.getState()).counter).toBe(19n);
    });
  });
});

describe('returned pointer', () => {
  const COUNTER = `pragma solidcash >=0.8.0;
  interface ICounter { public bigint counter; function increment(pubkey owner, sig s); }
  contract Counter() is ICounter {
    bigint counter;
    function increment(pubkey owner, sig s) { require(checkSig(s, owner)); this.counter = this.counter + 1; }
  }`;

  // A foreign fn-ptr RETURNED from a side-effect-free internal helper. `make(a)` returns ICounter(a).increment;
  // it beta-reduces into `p = ICounter(a).increment` at the call site, which the straight-line desugar reduces to
  // the audited external call. Proves a fn-ptr can flow through an internal return + be called.
  const USER = `pragma solidcash >=0.8.0;
  interface ICounter { public bigint counter; function increment(pubkey owner, sig s); }
  contract User() {
    bigint bumps;
    function make(address a) internal returns (function(pubkey, sig) external) { return ICounter(a).increment; }
    function use(address a, pubkey pk, sig s) {
      require(checkSig(s, pk));
      function(pubkey, sig) external p = make(a);
      p(pk, s);
      this.bumps = this.bumps + 1;
    }
  }`;

  describe('foreign fn-ptr RETURNED from an internal helper (beta-reduced)', () => {
    const provider = createTestProvider();
    const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

    it('flows the returned pointer to the call site and co-spends the callee', async () => {
      const ca = compileString(COUNTER); const ua = compileString(USER);

      const counter = new Contract(ca, [], { provider });
      const { categoryId: cc } = await setupStatefulUtxos(
        provider, counter, ca.stateLayout!, { counter: 5n }, { saltContract: true },
      );
      const cAddr = counter.withCategory(hexToBin(cc)).lockingBytecode;

      const user = new Contract(ua, [], { provider });
      const { categoryId: uc } = await setupStatefulUtxos(
        provider, user, ua.stateLayout!, { bumps: 0n }, { saltContract: true },
      );
      const userSc = StatefulContract.withCategory(user, uc);
      const counterSc = StatefulContract.withCategory(counter, cc);

      const tx = await userSc.use(hexToBin(cAddr), alicePub, sig())
        .withExternalCall(counterSc, 'increment', [alicePub, sig()])
        .send();
      expect(tx).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
      expect((await userSc.getState()).bumps).toBe(1n);
      expect((await counterSc.getState()).counter).toBe(6n);
    });
  });

  // A foreign fn-ptr PASSED to a side-effect-free internal helper that calls it. `relay(cb, ..)` inlines with
  // cb -> ICounter(a).bump, so `cb(..)` becomes the external call; the callee's return flows back via the
  // return-event NFT into caller state.
  const COUNTER_R = `pragma solidcash >=0.8.0;
  interface ICounter { public bigint counter; function bump(pubkey o, sig s) returns (bigint); }
  contract Counter() is ICounter {
    bigint counter;
    function bump(pubkey o, sig s) returns (bigint) { require(checkSig(s, o)); this.counter = this.counter + 1; return this.counter; }
  }`;

  const PASSER = `pragma solidcash >=0.8.0;
  interface ICounter { public bigint counter; function bump(pubkey o, sig s) returns (bigint); }
  contract Passer() {
    bigint last;
    function relay(function(pubkey, sig) external returns (bigint) cb, pubkey pk, sig s) internal returns (bigint) {
      return cb(pk, s);
    }
    function use(address a, pubkey pk, sig s) { require(checkSig(s, pk)); this.last = relay(ICounter(a).bump, pk, s); }
  }`;

  describe('foreign fn-ptr PASSED to an internal helper that calls it (beta-reduced)', () => {
    const provider = createTestProvider();
    const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

    it('inlines the helper, co-spends the callee, and captures its return', async () => {
      const ca = compileString(COUNTER_R); const pa = compileString(PASSER);

      const counter = new Contract(ca, [], { provider });
      const { categoryId: cc } = await setupStatefulUtxos(
        provider, counter, ca.stateLayout!, { counter: 5n }, { saltContract: true },
      );
      const cAddr = counter.withCategory(hexToBin(cc)).lockingBytecode;

      const passer = new Contract(pa, [], { provider });
      const { categoryId: pc } = await setupStatefulUtxos(
        provider, passer, pa.stateLayout!, { last: 0n }, { saltContract: true },
      );
      const passerSc = StatefulContract.withCategory(passer, pc);
      const counterSc = StatefulContract.withCategory(counter, cc);

      const tx = await passerSc.use(hexToBin(cAddr), alicePub, sig())
        .withExternalCall(counterSc, 'bump', [alicePub, sig()])
        .send();
      expect(tx).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
      expect((await counterSc.getState()).counter).toBe(6n);
      expect((await passerSc.getState()).last).toBe(6n); // returned via the return-event NFT
    });
  });

  // A NON-inlinable (public) fn returning a foreign fn-ptr -> a bytes BLOB `selector ++ address`; the caller
  // receives it in a blob local and slices it into the audited external call (the general return path, blob model).
  const RETURNER = `pragma solidcash >=0.8.0;
  interface ICounter { public bigint counter; function increment(pubkey owner, sig s); }
  contract Returner() {
    bigint bumps;
    function getPtr(address a) public returns (function(pubkey, sig) external) { return ICounter(a).increment; }
    function use(address a, pubkey pk, sig s) {
      require(checkSig(s, pk));
      function(pubkey, sig) external p = getPtr(a);
      p(pk, s);
      this.bumps = this.bumps + 1;
    }
  }`;

  describe('foreign fn-ptr returned from a PUBLIC fn as a blob (general return path)', () => {
    const provider = createTestProvider();
    const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

    it('receives the returned blob in a local and co-spends the callee', async () => {
      const ca = compileString(COUNTER); const ra = compileString(RETURNER);

      const counter = new Contract(ca, [], { provider });
      const { categoryId: cc } = await setupStatefulUtxos(
        provider, counter, ca.stateLayout!, { counter: 5n }, { saltContract: true },
      );
      const cAddr = counter.withCategory(hexToBin(cc)).lockingBytecode;

      const returner = new Contract(ra, [], { provider });
      const { categoryId: rc } = await setupStatefulUtxos(
        provider, returner, ra.stateLayout!, { bumps: 0n }, { saltContract: true },
      );
      const returnerSc = StatefulContract.withCategory(returner, rc);
      const counterSc = StatefulContract.withCategory(counter, cc);

      const tx = await returnerSc.use(hexToBin(cAddr), alicePub, sig())
        .withExternalCall(counterSc, 'increment', [alicePub, sig()])
        .send();
      expect(tx).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
      expect((await returnerSc.getState()).bumps).toBe(1n);
      expect((await counterSc.getState()).counter).toBe(6n);
    });
  });
});

describe('state var (fixed method)', () => {
  const COUNTER = `pragma solidcash >=0.8.0;
  interface ICounter { public bigint counter; function increment(pubkey owner, sig s); }
  contract Counter() is ICounter {
    bigint counter;
    function increment(pubkey owner, sig s) { require(checkSig(s, owner)); this.counter = this.counter + 1; }
  }`;

  // A FOREIGN external function-pointer state var holding a fixed method (increment) on a runtime address. It
  // lowers to an `address` state var + the state-address external call ICounter(fn).increment(..), so the callee
  // is co-spent + verified exactly like a bare interface-typed state var - proving the fn-ptr reduction is sound.
  const READER = `pragma solidcash >=0.8.0;
  interface ICounter { public bigint counter; function increment(pubkey owner, sig s); }
  contract Reader() {
    function(pubkey, sig) external counterFn;
    bigint bumps;
    function register(address a) { this.counterFn = ICounter(a).increment; }
    function bump(pubkey pk, sig s) { require(checkSig(s, pk)); counterFn(pk, s); this.bumps = this.bumps + 1; }
  }`;

  describe('foreign function-pointer state var (fixed method on a runtime address)', () => {
    const provider = createTestProvider();
    const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

    it('lowers to an address state var and co-spends the callee through the pointer', async () => {
      const counterArt = compileString(COUNTER);
      const readerArt = compileString(READER);

      const counter = new Contract(counterArt, [], { provider });
      const { categoryId: counterCat } = await setupStatefulUtxos(
        provider, counter, counterArt.stateLayout!, { counter: 5n }, { saltContract: true },
      );
      const counterAddr = counter.withCategory(hexToBin(counterCat)).lockingBytecode;

      // The lowered `counterFn` is an address field: seed it with the callee's locking bytecode.
      const reader = new Contract(readerArt, [], { provider });
      const { categoryId: readerCat } = await setupStatefulUtxos(
        provider, reader, readerArt.stateLayout!, { counterFn: hexToBin(counterAddr), bumps: 0n }, { saltContract: true },
      );

      const readerSc = StatefulContract.withCategory(reader, readerCat);
      const counterSc = StatefulContract.withCategory(counter, counterCat);

      const tx = await readerSc.bump(alicePub, sig())
        .withExternalCall(counterSc, 'increment', [alicePub, sig()])
        .send();
      expect(tx).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
      expect((await readerSc.getState()).bumps).toBe(1n);
      expect((await counterSc.getState()).counter).toBe(6n);
    });
  });
});

describe('storage (received value)', () => {
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
      expect(tx).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
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
      expect(runTx).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
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
      expect(tx).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
      // inc bumped counter 5 -> 6 and returned 6; the return-event NFT carried 6 back into lastResult.
      expect((await handlerSc.getState()).counter).toBe(6n);
      expect((await storeSc.getState()).lastResult).toBe(6n);
    });
  });
});

describe('struct field', () => {
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
      expect(tx).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
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
      expect(tx).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
      expect((await holderSc.getState()).s.bumps).toBe(1n);
      expect((await counterSc.getState()).counter).toBe(6n);
    });
  });
});

describe('single-method callee', () => {
  // Single-method callee: dispatcher elided, no 4-byte selector prefix in the unlocking; the covenant
  // verifies the selector only when a 0x04 push leads, so identity alone pins the (only) method.
  const HANDLER = `pragma solidcash >=0.8.0;
  interface IH { public bigint counter; function inc(pubkey o, sig s); }
  contract Handler() is IH { bigint counter;
    function inc(pubkey o, sig s) { require(checkSig(s, o)); this.counter = this.counter + 1; } }`;

  const CALLER = `pragma solidcash >=0.8.0;
  interface IH { public bigint counter; function inc(pubkey o, sig s); }
  contract Caller() {
    bigint bumps;
    function relay(function(pubkey, sig) external y, pubkey pk, sig s) {
      require(checkSig(s, pk)); y(pk, s); this.bumps = this.bumps + 1;
    }
  }`;

  describe('foreign fn-ptr call to a SINGLE-method callee (selector elision)', () => {
    const provider = createTestProvider();
    const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

    it('co-spends + calls a single-method callee through a fn-ptr param', async () => {
      const ha = compileString(HANDLER); const ca = compileString(CALLER);
      const inc = hexToBin(ha.abi.find((f) => f.name === 'inc')!.selector!);

      const handler = new Contract(ha, [], { provider });
      const { categoryId: hc } = await setupStatefulUtxos(
        provider, handler, ha.stateLayout!, { counter: 5n }, { saltContract: true },
      );
      const hAddr = handler.withCategory(hexToBin(hc)).lockingBytecode;

      const caller = new Contract(ca, [], { provider });
      const { categoryId: cc } = await setupStatefulUtxos(
        provider, caller, ca.stateLayout!, { bumps: 0n }, { saltContract: true },
      );
      const cSc = StatefulContract.withCategory(caller, cc);
      const hSc = StatefulContract.withCategory(handler, hc);

      const tx = await cSc.relay(hexToBin(hAddr), inc, alicePub, sig())
        .withExternalCall(hSc, 'inc', [alicePub, sig()]).send();
      expect(tx).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
      expect((await cSc.getState()).bumps).toBe(1n);
      expect((await hSc.getState()).counter).toBe(6n);
    });
  });
});

describe('cross-contract', () => {
  // A hands a foreign fn-ptr to a DIFFERENT contract B over the external-call boundary. The fn-ptr member arg
  // splits into (address, selector) to match B's lowered param; B stores it and calls it in a later tx - the
  // cross-CONTRACT pass. Target/B/A compiled together (multi-contract).
  const SRC = `
  interface ITarget { public bigint counter; function inc(pubkey o, sig s) external; }
  interface IB { function register(function(pubkey,sig) external cb, pubkey pk, sig s) external; }
  contract Target is ITarget { bigint counter;
    function inc(pubkey o, sig s) external { require(checkSig(s, o)); this.counter = this.counter + 1; } }
  contract B {
    function(pubkey,sig) external stored;
    bigint n;
    function register(function(pubkey,sig) external cb, pubkey pk, sig s) public {
      require(checkSig(s, pk)); this.stored = cb; this.n = this.n + 1;
    }
    function fire(pubkey pk, sig s) public { require(checkSig(s, pk)); stored(pk, s); this.n = this.n + 1; }
  }
  contract A {
    bigint calls;
    function go(address b, address t, pubkey pk, sig s) public {
      require(checkSig(s, pk)); IB(b).register(ITarget(t).inc, pk, s); this.calls = this.calls + 1;
    }
  }`;

  describe('foreign fn-ptr PASSED cross-CONTRACT (A -> B.register -> B.fire)', () => {
    const arts = compileStringMulti(SRC, { solidityImportCompat: true });
    const provider = createTestProvider();
    const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

    it('A splits the fn-ptr arg for B, B stores it, B fires it against the target', async () => {
      const incSel = hexToBin(arts.Target.abi.find((f) => f.name === 'inc')!.selector!);

      const target = new Contract(arts.Target, [], { provider });
      const { categoryId: tc } = await setupStatefulUtxos(
        provider, target, arts.Target.stateLayout!, { counter: 5n }, { saltContract: true },
      );
      const tAddr = target.withCategory(hexToBin(tc)).lockingBytecode;

      const b = new Contract(arts.B, [], { provider });
      const { categoryId: bc } = await setupStatefulUtxos(
        provider, b, arts.B.stateLayout!, { stored: new Uint8Array(), n: 0n }, { saltContract: true },
      );
      const bAddr = b.withCategory(hexToBin(bc)).lockingBytecode;

      const a = new Contract(arts.A, [], { provider });
      const { categoryId: ac } = await setupStatefulUtxos(
        provider, a, arts.A.stateLayout!, { calls: 0n }, { saltContract: true },
      );

      const aSc = StatefulContract.withCategory(a, ac);
      const bSc = StatefulContract.withCategory(b, bc);
      const targetSc = StatefulContract.withCategory(target, tc);

      // tx1: A.go external-calls B.register, passing the fn-ptr (split to target address + inc selector). B stores it.
      const tx1 = await aSc.go(hexToBin(bAddr), hexToBin(tAddr), alicePub, sig())
        .withExternalCall(bSc, 'register', [hexToBin(tAddr), incSel, alicePub, sig()])
        .send();
      expect(tx1).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
      expect((await aSc.getState()).calls).toBe(1n);
      expect((await bSc.getState()).n).toBe(1n);

      // tx2: B.fire() co-spends the target through the stored pointer.
      const tx2 = await bSc.fire(alicePub, sig())
        .withExternalCall(targetSc, 'inc', [alicePub, sig()])
        .send();
      expect(tx2).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
      expect((await targetSc.getState()).counter).toBe(6n);
      expect((await bSc.getState()).n).toBe(2n);
    });
  });

  // A returns a fn-ptr to a DIFFERENT contract B via the return-event blob; B stores and co-spends through
  // it. IA under-declares A's state; the per-slot runtime master index keeps offsets correct.
  const RET_SRC = `
  interface ITarget { public bigint counter; function inc(pubkey o, sig s) external; }
  interface IA { function getPtr(address t) external returns (function(pubkey,sig) external); }
  contract Target is ITarget { bigint counter;
    function inc(pubkey o, sig s) external { require(checkSig(s, o)); this.counter = this.counter + 1; } }
  contract A { bigint dummy;
    function getPtr(address t) public returns (function(pubkey,sig) external) { return ITarget(t).inc; } }
  contract B {
    bigint n;
    function use(address a, address t, pubkey pk, sig s) public {
      require(checkSig(s, pk));
      function(pubkey,sig) external p = IA(a).getPtr(t);
      p(pk, s); this.n = this.n + 1;
    }
  }`;

  // The caller retypes the interface fn-ptr return to a bounded blob, detects a blob local from a cross-contract
  // call, and slices it into (address, selector) to dispatch the co-spent target. B captures A's returned blob
  // via the return-event NFT and fires the target through it, all in one transaction.
  describe('foreign fn-ptr RETURNED cross-CONTRACT (B <- A.getPtr)', () => {
    const arts = compileStringMulti(RET_SRC, { solidityImportCompat: true });
    const provider = createTestProvider();
    const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

    it('B receives A\'s returned fn-ptr blob and co-spends the target through it', async () => {
      const target = new Contract(arts.Target, [], { provider });
      const { categoryId: tc } = await setupStatefulUtxos(
        provider, target, arts.Target.stateLayout!, { counter: 5n }, { saltContract: true },
      );
      const tAddr = target.withCategory(hexToBin(tc)).lockingBytecode;

      const a = new Contract(arts.A, [], { provider });
      const { categoryId: ac } = await setupStatefulUtxos(
        provider, a, arts.A.stateLayout!, { dummy: 0n }, { saltContract: true },
      );
      const aAddr = a.withCategory(hexToBin(ac)).lockingBytecode;

      const b = new Contract(arts.B, [], { provider });
      const { categoryId: bc } = await setupStatefulUtxos(
        provider, b, arts.B.stateLayout!, { n: 0n }, { saltContract: true },
      );

      const aSc = StatefulContract.withCategory(a, ac);
      const bSc = StatefulContract.withCategory(b, bc);
      const targetSc = StatefulContract.withCategory(target, tc);

      const tx = await bSc.use(hexToBin(aAddr), hexToBin(tAddr), alicePub, sig())
        .withExternalCall(aSc, 'getPtr', [hexToBin(tAddr)])
        .withExternalCall(targetSc, 'inc', [alicePub, sig()])
        .send();
      expect(tx).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
      expect((await bSc.getState()).n).toBe(1n);
      expect((await targetSc.getState()).counter).toBe(6n);
    });
  });
});

describe('blob struct', () => {
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
      expect(tx).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
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
      expect(tx).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
      expect((await holderSc.getState()).s.bumps).toBe(1n);
      expect((await handlerSc.getState()).counter).toBe(6n);
    });
  });
});

describe('contract member', () => {
  // A contract instance's method accessed as a fn-ptr VALUE via the DIRECT member form `o.bump` (not the cast
  // `Other(o).bump`): DesugarContractMemberFnPtr rewrites it to the recognised member form. install() deploys
  // Other and stores o.bump; run() co-spends the deployed Other through the stored pointer.
  const SRC = `contract Other { int c;
    function bump() external { this.c = this.c + 1; require(true); } }
  contract C {
    function() external stored;
    bigint bumps;
    function install() public { Other o = new Other(); stored = o.bump; require(true); }
    function run() public { stored(); this.bumps = this.bumps + 1; }
  }`;

  describe('contract-member fn-ptr value via direct `o.method` syntax', () => {
    const arts = compileStringMulti(SRC, { solidityImportCompat: true });
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

    it('installs (deploys Other + stores o.bump) then runs (co-spends Other)', async () => {
      const deployFunding: Utxo = { txid: 'ee01'.repeat(16), vout: 0, satoshis: 200000n };
      await provider.addUtxo(p2pkh.address, deployFunding);
      const deployed = await StatefulContract.deploy(arts.C, [], {
        provider,
        fundingUtxo: deployFunding,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { stored: new Uint8Array(), bumps: 0n },
        changeAddress: p2pkh.address,
      });
      const c = deployed.contract;

      const installFunding: Utxo = { txid: 'ee02'.repeat(16), vout: 0, satoshis: 100000n };
      await provider.addUtxo(p2pkh.address, installFunding);
      const installed = await StatefulContract.deployFrom({
        provider,
        factory: c,
        deployFunctionName: 'install',
        deployFunctionArgs: [],
        childArtifact: arts.Other,
        childConstructorArgs: [],
        childInitialState: { c: 0n },
        fundingUtxo: installFunding,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        changeAddress: p2pkh.address,
      });
      const otherChild = installed.child as StatefulContract;
      // stored holds Other's freshly-deployed genesis address.
      expect(Buffer.from((await c.getState()).stored as Uint8Array).toString('hex'))
        .toBe(otherChild.inner.lockingBytecode);

      await provider.addUtxo(c.address, { txid: 'ee03'.repeat(16), vout: 0, satoshis: 100000n });
      const settled = await c.run().withExternalCall(otherChild, 'bump', []).send();
      expect(settled).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
      expect((await otherChild.getState()).c).toBe(1n);
      expect((await c.getState()).bumps).toBe(1n);
    });
  });
});

describe('member to internal', () => {
  // Pass a foreign fn-ptr MEMBER `IOther(t).bump` as an argument to an INTERNAL function that stores it to state
  // (the arg splits to address + selector to match the callee's lowered param). A later tx fires the stored
  // pointer, co-spending the target. This is the arg-passing building block of the corpus store_function.
  const SRC = `
  interface IOther { public bigint counter; function bump(pubkey o, sig s) external; }
  contract Other is IOther { bigint counter;
    function bump(pubkey o, sig s) external { require(checkSig(s, o)); this.counter = this.counter + 1; } }
  contract C {
    function(pubkey,sig) external stored;
    bigint n;
    function save(function(pubkey,sig) external cb) internal { this.stored = cb; }
    function install(address t, pubkey pk, sig s) public { require(checkSig(s, pk)); save(IOther(t).bump); this.n = this.n + 1; }
    function fire(pubkey pk, sig s) public { require(checkSig(s, pk)); stored(pk, s); this.n = this.n + 1; }
  }`;

  describe('pass a fn-ptr member to an internal function that stores it', () => {
    const arts = compileStringMulti(SRC, { solidityImportCompat: true });
    const provider = createTestProvider();
    const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

    it('install stores the passed member; fire co-spends the target through it', async () => {
      const other = new Contract(arts.Other, [], { provider });
      const { categoryId: tc } = await setupStatefulUtxos(
        provider, other, arts.Other.stateLayout!, { counter: 5n }, { saltContract: true },
      );
      const tAddr = other.withCategory(hexToBin(tc)).lockingBytecode;

      const c = new Contract(arts.C, [], { provider });
      const { categoryId: cc } = await setupStatefulUtxos(
        provider, c, arts.C.stateLayout!, { stored: new Uint8Array(), n: 0n }, { saltContract: true },
      );

      const cSc = StatefulContract.withCategory(c, cc);
      const otherSc = StatefulContract.withCategory(other, tc);

      // tx1: install() passes IOther(t).bump to the internal save(), which stores it.
      await cSc.install(hexToBin(tAddr), alicePub, sig()).send();
      expect((await cSc.getState()).n).toBe(1n);
      expect(Buffer.from((await cSc.getState()).stored as Uint8Array).toString('hex')).toBe(tAddr);

      // tx2: fire() co-spends Other through the stored pointer.
      const settled = await cSc.fire(alicePub, sig()).withExternalCall(otherSc, 'bump', [alicePub, sig()]).send();
      expect(settled).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
      expect((await otherSc.getState()).counter).toBe(6n);
      expect((await cSc.getState()).n).toBe(2n);
    });
  });
});
