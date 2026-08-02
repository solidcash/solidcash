import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

// A plain-`address` state var behind an interface cast: `address counterRef; ... ICounter(counterRef).increment(..)`.
// The target is read from A's OWN self-pinned state (SynthesizeExternalAddressLocals synthesizes an __extaddr_
// local), never a caller witness - see docs/extcall-target-pinning.md.
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
  function bump(pubkey pk, sig s) { require(checkSig(s, pk)); ICounter(counterRef).increment(pk, s); this.bumps = this.bumps + 1; }
}`;

describe('sound external-call target pinning', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('P1: calls a callee whose address lives in a plain-address state var behind a cast', async () => {
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
    expect((await counterSc.getState()).counter).toBe(6n);
  });

  it('NEGATIVE: co-spending a different contract than the one in state is rejected (target substitution)', async () => {
    const counterArt = compileString(COUNTER);
    const readerArt = compileString(READER);

    // The genuine callee stored in counterRef.
    const counterA = new Contract(counterArt, [], { provider });
    const { categoryId: catA } = await setupStatefulUtxos(
      provider, counterA, counterArt.stateLayout!, { counter: 5n }, { saltContract: true },
    );
    const addrA = counterA.withCategory(hexToBin(catA)).lockingBytecode;

    // A DIFFERENT counter the attacker tries to co-spend instead.
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

    // counterRef holds addrA, but we co-spend counterB: identity OP_EQUALVERIFY must fail closed.
    await expect(
      readerSc.bump(alicePub, sig()).withExternalCall(counterBSc, 'increment', [alicePub, sig()]).send(),
    ).rejects.toThrow(
      /^layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation\.$/,
    );
  });

  it('P2: an address-literal target compiles and records addressLiteral in the ABI (un-satisfiable pin)', () => {
    const art = compileString(
      'interface IFoo { function x() external; } '
      + 'contract C { function g() external { IFoo(0x1234567890123456789012345678901234567890).x(); } }',
      { solidityImportCompat: true, forceStateful: true },
    );
    const g = art.abi.find((f) => f.name === 'g')!;
    expect(g.externalCalls?.[0]?.addressLiteral).toBe('1234567890123456789012345678901234567890');
    expect(g.externalCalls?.[0]?.addressParam).toBeUndefined();
  });
});
