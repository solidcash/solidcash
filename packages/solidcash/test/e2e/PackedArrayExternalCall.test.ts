import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

// Array-element external call over a BOUNDED, PACKED address[N] (a single blob field, not the dynamic
// chunk-backed array or an entry-NFT collection). This is the representation the solidityImportCompat
// bounded-value-array routing produces (AstBuilder), so it is what backs StableSwap's fixed `address[N]
// tokens` + IERC20(tokens[i]).transferFrom(...). VM-verifies the packed field reads back as the same
// pushdata(count)++elems blob the array-external-call loop consumes, and every element is co-spent + verified.
const PUBLISHER = `pragma solidcash >=0.8.0;
interface IEventSubscriber { public bigint received; function handleTransferEvent(uint256 value); }
contract Publisher() {
  address[2] packed subscriberList;
  function setSubscribers(address a, address b, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    this.subscriberList = [a, b];
  }
  function notify(uint256 value, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    for (uint256 i = 0; i < 2; i = i + 1) {
      IEventSubscriber(subscriberList[i]).handleTransferEvent(value);
    }
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

describe('array-element external call over a packed bounded address[N]', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('co-spends and verifies every element of a packed address[2]', async () => {
    const pubArt = compileString(PUBLISHER);
    const subArt = compileString(SUBSCRIBER);

    const sub1 = new Contract(subArt, [], { provider });
    const { categoryId: c1 } = await setupStatefulUtxos(
      provider, sub1, subArt.stateLayout!, { received: 0n }, { saltContract: true },
    );
    const sub1Lbc = sub1.withCategory(hexToBin(c1)).lockingBytecode;
    const sub2 = new Contract(subArt, [], { provider });
    const { categoryId: c2 } = await setupStatefulUtxos(
      provider, sub2, subArt.stateLayout!, { received: 0n }, { saltContract: true },
    );
    const sub2Lbc = sub2.withCategory(hexToBin(c2)).lockingBytecode;

    const pub = new Contract(pubArt, [], { provider });
    const { categoryId: pc } = await setupStatefulUtxos(
      provider, pub, pubArt.stateLayout!,
      { subscriberList: [hexToBin(sub1Lbc), hexToBin(sub2Lbc)] }, { saltContract: true },
    );

    const pubSc = StatefulContract.withCategory(pub, pc);
    const sub1Sc = StatefulContract.withCategory(sub1, c1);
    const sub2Sc = StatefulContract.withCategory(sub2, c2);

    pubSc.registerExternalArray('IEventSubscriber', [sub1Sc, sub2Sc]);

    const tx = await pubSc.notify(10n, alicePub, sig()).send();
    expect(tx.txid).toBeDefined();
    expect((await sub1Sc.getState()).received).toBe(10n);
    expect((await sub2Sc.getState()).received).toBe(10n);
  });
});
