import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

// External call whose target lives in a STRUCT FIELD of self-pinned state: `config.counter.increment(..)`
// where `config` is a struct state var and `counter` is an interface-typed field. SynthesizeExternalAddressLocals
// hoists the field read into an __extaddr_ local, so the dispatch pins the co-spent callee to the self-pinned
// field value (byte-identical to the audited plain-state-var path - see docs/extcall-target-pinning.md).
const COUNTER = `pragma solidcash >=0.8.0;
interface ICounter { public bigint counter; function increment(pubkey owner, sig s); }
contract Counter() is ICounter {
  bigint counter;
  function increment(pubkey owner, sig s) { require(checkSig(s, owner)); this.counter = this.counter + 1; }
}`;

const READER = `pragma solidcash >=0.8.0;
interface ICounter { public bigint counter; function increment(pubkey owner, sig s); }
struct Config { ICounter counter; }
contract Reader() {
  Config config;
  bigint bumps;
  function bump(pubkey pk, sig s) { require(checkSig(s, pk)); config.counter.increment(pk, s); this.bumps = this.bumps + 1; }
}`;

describe('struct-field external-call target pinning', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('calls a callee whose address lives in a struct field of self-pinned state', async () => {
    const counterArt = compileString(COUNTER);
    const readerArt = compileString(READER);

    const counter = new Contract(counterArt, [], { provider });
    const { categoryId: counterCat } = await setupStatefulUtxos(
      provider, counter, counterArt.stateLayout!, { counter: 5n }, { saltContract: true },
    );
    const counterAddr = counter.withCategory(hexToBin(counterCat)).lockingBytecode;

    const reader = new Contract(readerArt, [], { provider });
    const { categoryId: readerCat } = await setupStatefulUtxos(
      provider, reader, readerArt.stateLayout!,
      { config: { counter: hexToBin(counterAddr) }, bumps: 0n }, { saltContract: true },
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

  it('NEGATIVE: co-spending a different contract than the one in the struct field is rejected', async () => {
    const counterArt = compileString(COUNTER);
    const readerArt = compileString(READER);

    const counterA = new Contract(counterArt, [], { provider });
    const { categoryId: catA } = await setupStatefulUtxos(
      provider, counterA, counterArt.stateLayout!, { counter: 5n }, { saltContract: true },
    );
    const addrA = counterA.withCategory(hexToBin(catA)).lockingBytecode;

    // A DIFFERENT counter the attacker tries to co-spend instead of the one pinned in the field.
    const counterB = new Contract(counterArt, [], { provider });
    const { categoryId: catB } = await setupStatefulUtxos(
      provider, counterB, counterArt.stateLayout!, { counter: 99n }, { saltContract: true },
    );

    const reader = new Contract(readerArt, [], { provider });
    const { categoryId: readerCat } = await setupStatefulUtxos(
      provider, reader, readerArt.stateLayout!,
      { config: { counter: hexToBin(addrA) }, bumps: 0n }, { saltContract: true },
    );

    const readerSc = StatefulContract.withCategory(reader, readerCat);
    const counterBSc = StatefulContract.withCategory(counterB, catB);

    // config.counter holds addrA, but we co-spend counterB: identity OP_EQUALVERIFY must fail closed.
    await expect(
      readerSc.bump(alicePub, sig()).withExternalCall(counterBSc, 'increment', [alicePub, sig()]).send(),
    ).rejects.toThrow();
  });
});
