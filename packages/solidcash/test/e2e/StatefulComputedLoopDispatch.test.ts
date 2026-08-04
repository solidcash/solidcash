import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
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

// Multi-method interface: >1 callable function -> selector verification, so the ABI gains a selector param AFTER
// the loopTargets witness. Validates the stateful fill's ABI ordering (externalCallInputBase, loopTargets, selector).
const PUBLISHER_MULTI = `pragma solidcash >=0.8.0;
interface IFoo { public bigint received; function handleTransferEvent(uint256 value); function ping(uint256 x); }
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

const SUBSCRIBER_MULTI = `pragma solidcash >=0.8.0;
contract Subscriber() {
  bigint received;
  function handleTransferEvent(uint256 value) {
    this.received = this.received + int(value);
    require(int(value) >= 0);
  }
  function ping(uint256 x) {
    require(x >= 0);
  }
}`;

// RETURNING computed-target loop: the loop accumulates each callee's RETURN value (read from a per-iteration
// return-event the callee mints). This is the getReserves half of Router02's fee-on-transfer swap - a returning
// call inside the computed-target loop. Validates the typed-returning inline-loop dispatch (return-event verify +
// typed decode) end to end.
const PUBLISHER_RET = `pragma solidcash >=0.8.0;
interface IFoo { public bigint received; function tally(uint256 value) returns (int); }
contract Publisher() {
  bigint total;
  function notify(address[] path, uint256 value, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    int s = 0;
    for (uint256 i = 0; i < path.length - 1; i = i + 1) {
      s = s + IFoo(L.pairFor(path[i], path[i+1])).tally(value);
    }
    this.total = s;
  }
}
library L {
  function pairFor(address a, address b) internal pure returns (address) {
    return address(uint160(uint256(uint160(a)) + uint256(uint160(b))));
  }
}`;

const SUBSCRIBER_RET = `pragma solidcash >=0.8.0;
contract Subscriber() {
  bigint received;
  function tally(uint256 value) returns (int) {
    this.received = this.received + int(value);
    return this.received;
  }
}`;

// Multi-use view+mutate on a stateful caller: `int r = pair.getReserve(); pair.swap(amt)`. getReserve is a VIEW
// whose result the compiler turns into the `__internal__viewReturn0` witness; the stateful autoderivation AUTO-FILLS
// it by reading each co-spent pair's state (convention: the view returns the pair's first-N state fields). swap is
// the co-spend (a user-param arg so it auto-resolves). Verifies the filled reserves are read on-chain (accumulated).
const PUBLISHER_VM = `pragma solidcash >=0.8.0;
interface IPair { public bigint reserve; function getReserve() external view returns (int); function swap(int amt) external; }
contract Publisher() {
  bigint total;
  function notify(address[] path, int amt, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    int s = 0;
    for (uint256 i = 0; i < path.length - 1; i = i + 1) {
      IPair pair = IPair(L.pairFor(path[i], path[i+1]));
      int r = pair.getReserve();
      pair.swap(amt);
      s = s + r;
    }
    this.total = s;
  }
}
library L { function pairFor(address a, address b) internal pure returns (address) {
  return address(uint160(uint256(uint160(a)) + uint256(uint160(b)))); } }`;

const SUBSCRIBER_VM = `pragma solidcash >=0.8.0;
contract Subscriber() {
  bigint reserve;
  function getReserve() external view returns (int) { return this.reserve; }
  function swap(int amt) external { this.reserve = this.reserve + amt; require(amt >= 0); }
}`;

describe('stateful multi-use view+mutate autoderivation (getReserve view witness auto-filled from pair state)', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('auto-fills __internal__viewReturn0 from each co-spent pair state; the covenant reads it', async () => {
    const pubArt = compileString(PUBLISHER_VM);
    const subArt = compileString(SUBSCRIBER_VM);
    const sub1 = new Contract(subArt, [], { provider });
    const { categoryId: c1 } = await setupStatefulUtxos(
      provider, sub1, subArt.stateLayout!, { reserve: 5n }, { saltContract: true },
    );
    const sub2 = new Contract(subArt, [], { provider });
    const { categoryId: c2 } = await setupStatefulUtxos(
      provider, sub2, subArt.stateLayout!, { reserve: 7n }, { saltContract: true },
    );
    const pub = new Contract(pubArt, [], { provider });
    const { categoryId: pc } = await setupStatefulUtxos(
      provider, pub, pubArt.stateLayout!, { total: 0n }, { saltContract: true },
    );
    const pubSc = StatefulContract.withCategory(pub, pc);
    pubSc.registerExternalArray('IPair', [StatefulContract.withCategory(sub1, c1), StatefulContract.withCategory(sub2, c2)]);

    const path = [hexToBin('aa'.repeat(35)), hexToBin('bb'.repeat(35)), hexToBin('cc'.repeat(35))];
    await pubSc.notify(path, 0n, alicePub, sig()).send();
    // The SDK auto-filled viewReturn0 = [5, 7] from the pairs' `reserve` state; total = 5 + 7 = 12.
    expect((await pubSc.getState()).total).toBe(12n);
  });
});

describe('stateful RETURNING computed-target loop (s += IFoo(pairFor(..)).tally(v))', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('reads each callee return-event, typed-decodes it, accumulates the returns', async () => {
    const pubArt = compileString(PUBLISHER_RET);
    const subArt = compileString(SUBSCRIBER_RET);
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
      provider, pub, pubArt.stateLayout!, { total: 0n }, { saltContract: true },
    );
    const pubSc = StatefulContract.withCategory(pub, pc);
    const sub1Sc = StatefulContract.withCategory(sub1, c1);
    const sub2Sc = StatefulContract.withCategory(sub2, c2);
    pubSc.registerExternalArray('IFoo', [sub1Sc, sub2Sc]);

    const path = [hexToBin('aa'.repeat(35)), hexToBin('bb'.repeat(35)), hexToBin('cc'.repeat(35))];
    await pubSc.notify(path, 10n, alicePub, sig()).send();
    // each callee tally(10) -> received 0->10, returns 10; s = 10 + 10 = 20
    expect((await sub1Sc.getState()).received).toBe(10n);
    expect((await sub2Sc.getState()).received).toBe(10n);
    expect((await pubSc.getState()).total).toBe(20n);
  });
});

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

  it('scales to a 3-hop route (3 co-spent instances, path.length 4)', async () => {
    const pubArt = compileString(PUBLISHER);
    const subArt = compileString(SUBSCRIBER);
    const subs: { c1: string; sc: StatefulContract }[] = [];
    for (let i = 0; i < 3; i++) {
      const c = new Contract(subArt, [], { provider });
      const { categoryId } = await setupStatefulUtxos(
        provider, c, subArt.stateLayout!, { received: 0n }, { saltContract: true },
      );
      subs.push({ c1: categoryId, sc: StatefulContract.withCategory(c, categoryId) });
    }
    const pub = new Contract(pubArt, [], { provider });
    const { categoryId: pc } = await setupStatefulUtxos(
      provider, pub, pubArt.stateLayout!, { notifyCount: 0n }, { saltContract: true },
    );
    const pubSc = StatefulContract.withCategory(pub, pc);
    pubSc.registerExternalArray('IFoo', subs.map((s) => s.sc));

    const path = ['aa', 'bb', 'cc', 'dd'].map((x) => hexToBin(x.repeat(35))); // 4 tokens -> 3 pairs
    await pubSc.notify(path, 5n, alicePub, sig()).send();
    for (const s of subs) expect((await s.sc.getState()).received).toBe(5n);
  });

  it('fills the witness correctly when the interface is multi-method (selector param follows in the ABI)', async () => {
    const pubArt = compileString(PUBLISHER_MULTI);
    const subArt = compileString(SUBSCRIBER_MULTI);
    // Sanity: the ABI must order externalCallInputBase, then loopTargets, then the selector param.
    const runInputs = pubArt.abi.find((f) => f.name === 'notify')!.inputs.map((i) => i.name);
    const iBase = runInputs.indexOf('__internal__externalCallInputBase');
    const iWit = runInputs.findIndex((n) => n.startsWith('__internal__loopTargets'));
    const iSel = runInputs.findIndex((n) => n.startsWith('__internal__externalCallSelector'));
    expect(iBase).toBeGreaterThanOrEqual(0);
    expect(iWit).toBeGreaterThan(iBase);
    expect(iSel).toBeGreaterThan(iWit);

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
    pubSc.registerExternalArray('IFoo', [StatefulContract.withCategory(sub1, c1), StatefulContract.withCategory(sub2, c2)]);

    const path = [hexToBin('aa'.repeat(35)), hexToBin('bb'.repeat(35)), hexToBin('cc'.repeat(35))];
    await pubSc.notify(path, 7n, alicePub, sig()).send();
    expect((await StatefulContract.withCategory(sub1, c1).getState()).received).toBe(7n);
    expect((await StatefulContract.withCategory(sub2, c2).getState()).received).toBe(7n);
  });
});
