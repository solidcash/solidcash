import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

// A COMPUTED external-call target `ICounter(passthrough(counterRef)).increment(..)`: the address is the result of an
// author-written pure computation over self-pinned state, hoisted by SynthesizeExternalAddressLocals into an
// __extaddr_ local (castComputedTarget). The bytecode computes it deterministically, so the co-spend identity check
// `input.lbc == <computed>` is real - the same audited __extaddr_ dispatch as a state-var/param target, not a caller
// witness (docs/extcall-target-pinning.md). This models MistSwap's `IUniswapV2Pair(pairFor(..)).getReserves()`.
const COUNTER = `pragma solidcash >=0.8.0;
interface ICounter { public bigint counter; function increment(pubkey owner, sig s); }
contract Counter() is ICounter {
  bigint counter;
  function increment(pubkey owner, sig s) { require(checkSig(s, owner)); this.counter = this.counter + 1; }
}`;

const READER = `pragma solidcash >=0.8.0;
interface ICounter { public bigint counter; function increment(pubkey owner, sig s); }
contract Reader() {
  address counterRef;
  bigint bumps;
  function passthrough(address a) returns (address) { return a; }
  function bump(pubkey pk, sig s) {
    require(checkSig(s, pk));
    ICounter(passthrough(counterRef)).increment(pk, s);
    this.bumps = this.bumps + 1;
  }
}`;

describe('computed external-call target pinning', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('co-spends the callee at the runtime-COMPUTED address and increments it', async () => {
    const counterArt = compileString(COUNTER);
    const readerArt = compileString(READER);

    const counter = new Contract(counterArt, [], { provider });
    const { categoryId: counterCat } = await setupStatefulUtxos(
      provider, counter, counterArt.stateLayout!, { counter: 5n }, { saltContract: true },
    );
    const counterAddr = counter.withCategory(hexToBin(counterCat)).lockingBytecode;

    const reader = new Contract(readerArt, [], { provider });
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
    // The covenant computed passthrough(counterRef) == counterRef and pinned the co-spend to the real counter.
    expect((await counterSc.getState()).counter).toBe(6n);
  });

  it('NEGATIVE: co-spending a different contract than the computed target fails closed', async () => {
    const counterArt = compileString(COUNTER);
    const readerArt = compileString(READER);

    const counterA = new Contract(counterArt, [], { provider });
    const { categoryId: catA } = await setupStatefulUtxos(
      provider, counterA, counterArt.stateLayout!, { counter: 5n }, { saltContract: true },
    );
    const addrA = counterA.withCategory(hexToBin(catA)).lockingBytecode;

    const counterB = new Contract(counterArt, [], { provider });
    const { categoryId: catB } = await setupStatefulUtxos(
      provider, counterB, counterArt.stateLayout!, { counter: 99n }, { saltContract: true },
    );

    const reader = new Contract(readerArt, [], { provider });
    const { categoryId: readerCat } = await setupStatefulUtxos(
      provider, reader, readerArt.stateLayout!, { counterRef: hexToBin(addrA), bumps: 0n }, { saltContract: true },
    );

    const readerSc = StatefulContract.withCategory(reader, readerCat);
    const counterBSc = StatefulContract.withCategory(counterB, catB);

    // counterRef holds addrA (so the computed target is addrA), but we co-spend counterB: the identity check
    // `input.lbc == passthrough(counterRef)` must fail closed - the caller cannot substitute the computed target.
    await expect(
      readerSc.bump(alicePub, sig()).withExternalCall(counterBSc, 'increment', [alicePub, sig()]).send(),
    ).rejects.toThrow(
      'messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.',
    );
  });
});
