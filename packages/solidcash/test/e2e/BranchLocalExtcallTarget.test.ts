import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

// A BRANCH-LOCAL external-call target: the target var is declared inside an `if` and used by a cast external call
// in that branch (UniswapV2Pair.mint's `migrator`). HoistBranchLocalExtcallTargets moves the DECLARATION to the
// function-body top (keeping the external call in the branch) so the co-spend PICKs it at the epilogue - equivalent
// to the working function-top-target shape, so the pin stays sound (extcall-target-pinning.md).
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
  function bump(int gate, pubkey pk, sig s) {
    require(checkSig(s, pk));
    if (gate == 0) {
      address target = counterRef;
      ICounter(target).increment(pk, s);
    }
    this.bumps = this.bumps + 1;
  }
}`;

describe('branch-local external-call target pinning', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('co-spends the callee named by a BRANCH-LOCAL target and increments it', async () => {
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

    const tx = await readerSc.bump(0n, alicePub, sig())
      .withExternalCall(counterSc, 'increment', [alicePub, sig()])
      .send();
    expect(tx.txid).toBeDefined();
    expect((await readerSc.getState()).bumps).toBe(1n);
    expect((await counterSc.getState()).counter).toBe(6n);
  });

  it('NEGATIVE: co-spending a different contract than the branch-local target fails closed', async () => {
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

    await expect(
      readerSc.bump(0n, alicePub, sig()).withExternalCall(counterBSc, 'increment', [alicePub, sig()]).send(),
    ).rejects.toThrow();
  });
});
