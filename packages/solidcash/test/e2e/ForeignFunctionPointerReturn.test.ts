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
    expect(tx.txid).toBeDefined();
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
    expect(tx.txid).toBeDefined();
    expect((await counterSc.getState()).counter).toBe(6n);
    expect((await passerSc.getState()).last).toBe(6n); // returned via the return-event NFT
  });
});
