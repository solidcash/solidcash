import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import { Contract, StatefulContract } from '../../src/index.js';
import { parsePushdataCommitment } from '@solidcash/utils';
import { createTestProvider, getTxOutputs, setupStatefulUtxos } from '../test-util.js';

// library-contracts 3b: a state-touching LIBRARY (docs/library-contracts.md) lowers to a delegate contract
// (auto-delegated public functions). This probes the consumer side: a proxy delegatecalls the library via the
// EXISTING delegatecall machinery (withDelegatecall), running the library's function against the PROXY's state.
// A library function written as plain Solidity (no `delegate` keyword) is the delegate impl.
const LIB = `pragma solidcash >=0.8.0;
library Counter {
  bigint counter;
  function increment() public { this.counter = this.counter + 1; }
}`;

const PROXY = `pragma solidcash >=0.8.0;
contract DelegatecallProxy() {
  bigint counter;
  function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
  fallback(bytes input) external {
    address impl = address(0x76a91489abcdefabbaabbaabbaabbaabbaabbaabbaabba88ac);
    impl.delegatecall(input);
    require(input.length > 0);
  }
}`;

describe('library-contracts 3b: consumer delegatecalls a state-touching library', () => {
  it('runs the library function against the proxy state via the existing delegatecall path', async () => {
    const provider = createTestProvider();
    const libArt = compileString(LIB);
    const proxyArt = compileString(PROXY);
    expect(libArt.isLibrary).toBe(true);

    const proxyContract = new Contract(proxyArt, [], { provider });
    const { categoryId: proxyCatId } = await setupStatefulUtxos(
      provider, proxyContract, proxyArt.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const libContract = new Contract(libArt, [], { provider });
    const { categoryId: libCatId } = await setupStatefulUtxos(
      provider, libContract, libArt.stateLayout!, { counter: 0n }, { saltContract: true },
    );

    const proxySc = StatefulContract.withCategory(proxyContract, proxyCatId);
    const libSc = StatefulContract.withCategory(libContract, libCatId);

    const tx = await proxySc.call.__fallback()
      .withDelegatecall(libSc, 'increment', [])
      .send();
    expect(tx.txid).toBeDefined();

    // The library's increment ran against the PROXY's state: proxy counter 0 -> 1.
    const proxyDataNft = getTxOutputs(tx).find(
      (o) => o.token?.nft?.capability === 'mutable' && o.token?.category === proxyCatId,
    );
    expect(proxyDataNft).toBeDefined();
    const state = parsePushdataCommitment(proxyDataNft!.token!.nft!.commitment, proxyArt.stateLayout!, 0);
    expect(state.counter).toBe(1n);
  });

  // Soundness guard: the caller's state layout must match the library's, or the delegate writes the wrong
  // field and corrupts caller state. The library's `counter` is at slot 0; this proxy has `other` at slot 0.
  it('rejects a caller whose state layout does not match the library', async () => {
    const provider = createTestProvider();
    const libArt = compileString(LIB);
    const MISMATCH_PROXY = `pragma solidcash >=0.8.0;
contract DelegatecallProxy() {
  bigint other;
  bigint counter;
  function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
  fallback(bytes input) external {
    address impl = address(0x76a91489abcdefabbaabbaabbaabbaabbaabbaabbaabba88ac);
    impl.delegatecall(input);
    require(input.length > 0);
  }
}`;
    const proxyArt = compileString(MISMATCH_PROXY);
    const proxyContract = new Contract(proxyArt, [], { provider });
    const { categoryId: proxyCatId } = await setupStatefulUtxos(
      provider, proxyContract, proxyArt.stateLayout!, { other: 0n, counter: 0n }, { saltContract: true },
    );
    const libContract = new Contract(libArt, [], { provider });
    const { categoryId: libCatId } = await setupStatefulUtxos(
      provider, libContract, libArt.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const proxySc = StatefulContract.withCategory(proxyContract, proxyCatId);
    const libSc = StatefulContract.withCategory(libContract, libCatId);

    expect(() => proxySc.call.__fallback().withDelegatecall(libSc, 'increment', []))
      .toThrow(/layout mismatch/i);
  });
});

// 3b `L.f()` sugar, end-to-end: a consumer written in plain Solidity (imports the library, calls `L.f()`,
// no delegate/delegatecall keyword) runs the library function against its OWN state. The compiler desugars
// `Counter.increment()` to a delegatecall (+ a synthesized __libAddr_Counter ctor arg); the SDK co-spends the
// library via withDelegatecall.
describe('library-contracts 3b: L.f() sugar end-to-end', () => {
  const COUNTER = 'library Counter { bigint count; function increment() public { this.count = this.count + 1; } }';
  const CONSUMER = 'import { Counter } from "./counter.scash"; '
    + 'contract C() { bigint count; function bump() { Counter.increment(); } }';

  it('a consumer calling L.f() mutates its own state through the library', async () => {
    const provider = createTestProvider();
    const resolver = (p: string): { source: string; id: string } | undefined =>
      (p.includes('counter') ? { source: COUNTER, id: 'counter' } : undefined);
    const counterArt = compileString(COUNTER);
    const consumerArt = compileString(CONSUMER, { importResolver: resolver });

    // Deploy the library.
    const counter = new Contract(counterArt, [], { provider });
    const { categoryId: counterCat } = await setupStatefulUtxos(
      provider, counter, counterArt.stateLayout!, { count: 0n }, { saltContract: true },
    );
    const counterAddr = hexToBin(counter.withCategory(hexToBin(counterCat)).lockingBytecode);

    // Deploy the consumer, linked to the library's address (the synthesized __libAddr_Counter ctor arg).
    const consumer = new Contract(consumerArt, [counterAddr], { provider });
    const { categoryId: consumerCat } = await setupStatefulUtxos(
      provider, consumer, consumerArt.stateLayout!, { count: 0n }, { saltContract: true },
    );

    const consumerSc = StatefulContract.withCategory(consumer, consumerCat);
    const counterSc = StatefulContract.withCategory(counter, counterCat);

    const tx = await consumerSc.call.bump()
      .withDelegatecall(counterSc, 'increment', [])
      .send();
    expect(tx.txid).toBeDefined();

    // The consumer's own state was incremented through the library: count 0 -> 1.
    const consumerNft = getTxOutputs(tx).find(
      (o) => o.token?.nft?.capability === 'mutable' && o.token?.category === consumerCat,
    );
    expect(consumerNft).toBeDefined();
    const state = parsePushdataCommitment(consumerNft!.token!.nft!.commitment, consumerArt.stateLayout!, 0);
    expect(state.count).toBe(1n);
  });

  // Auto-wire: the caller registers the library once (registerLibrary) and calls L.f() with NO manual
  // withDelegatecall - the SDK derives the delegatecall co-spend from the artifact's libraryDelegateCalls.
  it('auto-wires the delegatecall from registerLibrary (no manual withDelegatecall)', async () => {
    const provider = createTestProvider();
    const resolver = (p: string): { source: string; id: string } | undefined =>
      (p.includes('counter') ? { source: COUNTER, id: 'counter' } : undefined);
    const counterArt = compileString(COUNTER);
    const consumerArt = compileString(CONSUMER, { importResolver: resolver });

    const counter = new Contract(counterArt, [], { provider });
    const { categoryId: counterCat } = await setupStatefulUtxos(
      provider, counter, counterArt.stateLayout!, { count: 0n }, { saltContract: true },
    );
    const counterAddr = hexToBin(counter.withCategory(hexToBin(counterCat)).lockingBytecode);

    const consumer = new Contract(consumerArt, [counterAddr], { provider });
    const { categoryId: consumerCat } = await setupStatefulUtxos(
      provider, consumer, consumerArt.stateLayout!, { count: 0n }, { saltContract: true },
    );

    const consumerSc = StatefulContract.withCategory(consumer, consumerCat);
    const counterSc = StatefulContract.withCategory(counter, counterCat);

    consumerSc.registerLibrary('Counter', counterSc);
    const tx = await consumerSc.call.bump().send();
    expect(tx.txid).toBeDefined();

    const consumerNft = getTxOutputs(tx).find(
      (o) => o.token?.nft?.capability === 'mutable' && o.token?.category === consumerCat,
    );
    const state = parsePushdataCommitment(consumerNft!.token!.nft!.commitment, consumerArt.stateLayout!, 0);
    expect(state.count).toBe(1n);
  });

  // Auto-wire safety: calling L.f() without registering the library is a clear build error, not a silent
  // missing co-spend.
  it('throws a clear error if the library is not registered', async () => {
    const provider = createTestProvider();
    const resolver = (p: string): { source: string; id: string } | undefined =>
      (p.includes('counter') ? { source: COUNTER, id: 'counter' } : undefined);
    const counterArt = compileString(COUNTER);
    const consumerArt = compileString(CONSUMER, { importResolver: resolver });

    const counter = new Contract(counterArt, [], { provider });
    const { categoryId: counterCat } = await setupStatefulUtxos(
      provider, counter, counterArt.stateLayout!, { count: 0n }, { saltContract: true },
    );
    const counterAddr = hexToBin(counter.withCategory(hexToBin(counterCat)).lockingBytecode);
    const consumer = new Contract(consumerArt, [counterAddr], { provider });
    const { categoryId: consumerCat } = await setupStatefulUtxos(
      provider, consumer, consumerArt.stateLayout!, { count: 0n }, { saltContract: true },
    );
    const consumerSc = StatefulContract.withCategory(consumer, consumerCat);

    await expect(consumerSc.call.bump().send()).rejects.toThrow(/not.*registered|registerLibrary/i);
  });
});

// 3b arguments: a consumer forwards its OWN parameter to the library (`function bumpBy(n) { L.incrementBy(n); }`).
// The SDK reads the consumer call's value and supplies it to the library unlocker (the delegatecall data is not
// on-chain), so the library mutates the consumer's shared state by that amount.
describe('library-contracts 3b: forwarded arguments end-to-end', () => {
  const COUNTER_ARG = 'library Counter { bigint count; '
    + 'function incrementBy(bigint n) public { this.count = this.count + n; } }';
  const CONSUMER_ARG = 'import { Counter } from "./counter.scash"; '
    + 'contract C() { bigint count; function bumpBy(bigint n) { Counter.incrementBy(n); } }';

  it('forwards the consumer parameter to the library and mutates shared state by that amount', async () => {
    const provider = createTestProvider();
    const resolver = (p: string): { source: string; id: string } | undefined =>
      (p.includes('counter') ? { source: COUNTER_ARG, id: 'counter' } : undefined);
    const counterArt = compileString(COUNTER_ARG);
    const consumerArt = compileString(CONSUMER_ARG, { importResolver: resolver });

    const counter = new Contract(counterArt, [], { provider });
    const { categoryId: counterCat } = await setupStatefulUtxos(
      provider, counter, counterArt.stateLayout!, { count: 0n }, { saltContract: true },
    );
    const counterAddr = hexToBin(counter.withCategory(hexToBin(counterCat)).lockingBytecode);

    const consumer = new Contract(consumerArt, [counterAddr], { provider });
    const { categoryId: consumerCat } = await setupStatefulUtxos(
      provider, consumer, consumerArt.stateLayout!, { count: 0n }, { saltContract: true },
    );

    const consumerSc = StatefulContract.withCategory(consumer, consumerCat);
    const counterSc = StatefulContract.withCategory(counter, counterCat);

    consumerSc.registerLibrary('Counter', counterSc);
    const tx = await consumerSc.call.bumpBy(5n).send();
    expect(tx.txid).toBeDefined();

    const consumerNft = getTxOutputs(tx).find(
      (o) => o.token?.nft?.capability === 'mutable' && o.token?.category === consumerCat,
    );
    const state = parsePushdataCommitment(consumerNft!.token!.nft!.commitment, consumerArt.stateLayout!, 0);
    expect(state.count).toBe(5n);
  });
});
