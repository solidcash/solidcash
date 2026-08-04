import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

// Array-element external call: `for (i < subscriberList.length) IEventSubscriber(subscriberList[i]).m()`.
// The SDK co-spends every subscriber in array order; the covenant reads the array and loop-verifies each
// co-spent callee's master LBC == subscriberList[i] (the EventsAdvanced pattern).
// The publisher's sig authorizes the publisher's own input; it is NOT forwarded to subscribers
// (one sig cannot validate multiple inputs - each has a distinct sighash). Subscribers update state
// permissionlessly when co-spent; the publisher covenant verifies each callee's identity + selector.
const PUBLISHER = `pragma solidcash >=0.8.0;
interface IEventSubscriber { public bigint received; function handleTransferEvent(uint256 value); }
contract Publisher() {
  address[] subscriberList;
  function setSubscribers(address a, address b, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    this.subscriberList = [a, b];
  }
  function notify(uint256 value, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    for (uint256 i = 0; i < subscriberList.length; i = i + 1) {
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

// A mapping target (not a chunk-packed state array) is rejected at compile time.
const MAPPING_TARGET = `pragma solidcash >=0.8.0;
interface IEventSubscriber { public bigint received; function handleTransferEvent(uint256 value); }
contract C() {
  mapping(uint256 => address) subs;
  function notify(uint256 value, uint256 n, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    for (uint256 i = 0; i < n; i = i + 1) {
      IEventSubscriber(subs[i]).handleTransferEvent(value);
    }
  }
}`;

// Four-element variant: the array spans >1 chunk (see the multi-chunk test).
const PUBLISHER4 = `pragma solidcash >=0.8.0;
interface IEventSubscriber { public bigint received; function handleTransferEvent(uint256 value); }
contract Publisher() {
  address[] subscriberList;
  function setSubscribers(address a, address b, address c, address d, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    this.subscriberList = [a, b, c, d];
  }
  function notify(uint256 value, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    for (uint256 i = 0; i < subscriberList.length; i = i + 1) {
      IEventSubscriber(subscriberList[i]).handleTransferEvent(value);
    }
  }
}`;

describe('array-element external call (IFoo(arr[i]).m() loop)', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('co-spends and verifies every subscriber in the array', async () => {
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
      { subscriberList: [] }, { saltContract: true },
    );

    const pubSc = StatefulContract.withCategory(pub, pc);
    const sub1Sc = StatefulContract.withCategory(sub1, c1);
    const sub2Sc = StatefulContract.withCategory(sub2, c2);

    // Write the subscriber LBCs into the dynamic array on-chain (creates the chunk UTXOs).
    await pubSc.setSubscribers(hexToBin(sub1Lbc), hexToBin(sub2Lbc), alicePub, sig()).send();

    pubSc.registerExternalArray('IEventSubscriber', [sub1Sc, sub2Sc]);

    const tx = await pubSc.notify(10n, alicePub, sig()).send();
    expect(tx.txid).toBeDefined();
    expect((await sub1Sc.getState()).received).toBe(10n);
    expect((await sub2Sc.getState()).received).toBe(10n);
  });

  // 4 p2sh32 addresses = 4 x 36 framed bytes = 144 B > the 120-byte chunk => 2 chunks, with element 3
  // straddling the boundary. Validates the read loop reassembles + co-spends across chunk boundaries.
  it('co-spends an array spanning multiple chunks (4 subscribers, 2 chunks)', async () => {
    const pubArt = compileString(PUBLISHER4);
    const subArt = compileString(SUBSCRIBER);

    const subs: { lbc: string; sc: StatefulContract }[] = [];
    for (let i = 0; i < 4; i++) {
      const c = new Contract(subArt, [], { provider });
      const { categoryId } = await setupStatefulUtxos(
        provider, c, subArt.stateLayout!, { received: 0n }, { saltContract: true },
      );
      subs.push({
        lbc: c.withCategory(hexToBin(categoryId)).lockingBytecode,
        sc: StatefulContract.withCategory(c, categoryId),
      });
    }

    const pub = new Contract(pubArt, [], { provider });
    const { categoryId: pc } = await setupStatefulUtxos(
      provider, pub, pubArt.stateLayout!, { subscriberList: [] }, { saltContract: true },
    );
    const pubSc = StatefulContract.withCategory(pub, pc);

    await pubSc.setSubscribers(...subs.map((s) => hexToBin(s.lbc)), alicePub, sig()).send();

    pubSc.registerExternalArray('IEventSubscriber', subs.map((s) => s.sc));

    await pubSc.notify(10n, alicePub, sig()).send();
    for (const s of subs) expect((await s.sc.getState()).received).toBe(10n);
  });

  it('rejects a mapping-keyed external-call target at compile time', () => {
    expect(() => compileString(MAPPING_TARGET)).toThrow(/must be a state array/);
  });
});
