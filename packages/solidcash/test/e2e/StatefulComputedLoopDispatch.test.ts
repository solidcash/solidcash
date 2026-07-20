import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

// STATEFUL computed per-iteration target loop `IFoo(pairFor(path[i], path[i+1])).m(value)` (the Router02 _swap shape
// on a stateful caller). The compiler rewrites the target to a synthesized `address[] __internal__loopTargets0[i]`
// witness; the stateful SDK autoderivation fills that witness with the co-spent instance addresses (registered via
// registerExternalArray, in co-spend order) and the loop-slot expansion co-spends each - so a stateful caller needs
// no explicit builder call, only registration. The path VALUES are irrelevant (the rewrite bypassed on-chain
// pairFor); only path.length drives the loop bound, and the witness identity check binds each co-spend.
const PUBLISHER = `pragma solidcash >=0.8.0;
interface IFoo { public bigint received; function handleTransferEvent(uint256 value); }
contract Publisher() {
  bigint notifyCount;
  function notify(address[] path, uint256 value, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    this.notifyCount = this.notifyCount + 1;
    for (uint256 i = 0; i < path.length - 1; i = i + 1) {
      IFoo(L.pairFor(path[i], path[i+1])).handleTransferEvent(value);
    }
  }
}
library L {
  function pairFor(address a, address b) internal pure returns (address) {
    return address(uint160(uint256(uint160(a)) + uint256(uint160(b))));
  }
}`;

const SUBSCRIBER = `pragma solidcash >=0.8.0;
contract Subscriber() {
  bigint received;
  function handleTransferEvent(uint256 value) {
    this.received = this.received + int(value);
    require(int(value) >= 0);
  }
}`;

describe('stateful computed-target loop (IFoo(pairFor(path[i], path[i+1])).m() on a stateful caller)', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('autoderives the witness + co-spends the registered instances; each is called', async () => {
    const pubArt = compileString(PUBLISHER);
    const subArt = compileString(SUBSCRIBER);

    const sub1 = new Contract(subArt, [], { provider });
    const { categoryId: c1 } = await setupStatefulUtxos(
      provider, sub1, subArt.stateLayout!, { received: 0n }, { saltContract: true },
    );
    const sub2 = new Contract(subArt, [], { provider });
    const { categoryId: c2 } = await setupStatefulUtxos(
      provider, sub2, subArt.stateLayout!, { received: 0n }, { saltContract: true },
    );

    const pub = new Contract(pubArt, [], { provider });
    const { categoryId: pc } = await setupStatefulUtxos(
      provider, pub, pubArt.stateLayout!, { notifyCount: 0n }, { saltContract: true },
    );

    const pubSc = StatefulContract.withCategory(pub, pc);
    const sub1Sc = StatefulContract.withCategory(sub1, c1);
    const sub2Sc = StatefulContract.withCategory(sub2, c2);

    // Register the two co-spend targets (the "pairs") for IFoo, in co-spend order. The witness is filled from these.
    pubSc.registerExternalArray('IFoo', [sub1Sc, sub2Sc]);

    // 3 dummy path tokens -> path.length - 1 = 2 iterations -> the 2 registered instances are co-spent.
    const path = [hexToBin('aa'.repeat(35)), hexToBin('bb'.repeat(35)), hexToBin('cc'.repeat(35))];
    const tx = await pubSc.notify(path, 10n, alicePub, sig()).send();
    expect(tx.txid).toBeDefined();
    expect((await sub1Sc.getState()).received).toBe(10n);
    expect((await sub2Sc.getState()).received).toBe(10n);
    expect((await pubSc.getState()).notifyCount).toBe(1n);
  });
});
