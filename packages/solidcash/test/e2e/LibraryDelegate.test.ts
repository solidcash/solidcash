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

  it('passes a literal argument through to the library (SDK reconstructs it)', async () => {
    const provider = createTestProvider();
    const resolver = (p: string): { source: string; id: string } | undefined =>
      (p.includes('counter') ? { source: COUNTER_ARG, id: 'counter' } : undefined);
    // Consumer passes a compile-time literal, not a forwarded parameter.
    const litConsumerSrc = 'import { Counter } from "./counter.scash"; '
      + 'contract C() { bigint count; function bump() { Counter.incrementBy(7); } }';
    const counterArt = compileString(COUNTER_ARG);
    const consumerArt = compileString(litConsumerSrc, { importResolver: resolver });

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
    const consumerNft = getTxOutputs(tx).find(
      (o) => o.token?.nft?.capability === 'mutable' && o.token?.category === consumerCat,
    );
    const state = parsePushdataCommitment(consumerNft!.token!.nft!.commitment, consumerArt.stateLayout!, 0);
    expect(state.count).toBe(7n);
  });
});

// 3b contention: a BRANDED library (compilerOptions.brandLibrary) pins the co-spent proxy master's category to
// its `__brand` ctor arg, so it can be spent only alongside its owning consumer's master - it rides that one
// master's serialization (zero marginal contention). Verified here: the owning consumer succeeds; a foreign
// consumer's master is rejected by the brand-check.
describe('library-contracts 3b: branded library master-gate (contention)', () => {
  it('accepts the owning consumer master and rejects a foreign master', async () => {
    const provider = createTestProvider();
    const libArt = compileString(LIB, { brandLibrary: true });
    expect(libArt.brandedLibrary).toBe(true);
    const proxyArt = compileString(PROXY);

    // Owning consumer first, so its category is known; then brand the library to it via the SDK helper
    // (StatefulContract.libraryBrand reverses the display categoryId to the internal order OP_UTXOTOKENCATEGORY
    // returns).
    const proxyContract = new Contract(proxyArt, [], { provider });
    const { categoryId: proxyCat } = await setupStatefulUtxos(
      provider, proxyContract, proxyArt.stateLayout!, { counter: 0n }, { saltContract: true },
    );

    const libContract = new Contract(libArt, [StatefulContract.libraryBrand(proxyCat)], { provider });
    const { categoryId: libCat } = await setupStatefulUtxos(
      provider, libContract, libArt.stateLayout!, { counter: 0n }, { saltContract: true },
    );

    const proxySc = StatefulContract.withCategory(proxyContract, proxyCat);
    const libSc = StatefulContract.withCategory(libContract, libCat);

    // Owning consumer (master category == brand) succeeds.
    const tx = await proxySc.call.__fallback().withDelegatecall(libSc, 'increment', []).send();
    expect(tx.txid).toBeDefined();

    // Foreign consumer (master category != brand) is rejected by the brand-check.
    const foreignProxy = new Contract(proxyArt, [], { provider });
    const { categoryId: foreignCat } = await setupStatefulUtxos(
      provider, foreignProxy, proxyArt.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const foreignSc = StatefulContract.withCategory(foreignProxy, foreignCat);
    await expect(
      foreignSc.call.__fallback().withDelegatecall(libSc, 'increment', []).send(),
    ).rejects.toThrow();
  });

  // A branded library through the L.f() auto-wire path (registerLibrary), not just the proxy/impl withDelegatecall
  // path. Both categories are pre-chosen (categoryOverride) so the consumer can link to the branded library
  // address while the library is branded to the consumer's category - no deploy-time circularity.
  it('works through the L.f() auto-wire path (registerLibrary)', async () => {
    const provider = createTestProvider();
    const COUNTER = 'library Counter { bigint counter; function increment() public { this.counter = this.counter + 1; } }';
    const resolver = (p: string): { source: string; id: string } | undefined =>
      (p.includes('counter') ? { source: COUNTER, id: 'counter' } : undefined);
    const CONSUMER = 'import { Counter } from "./counter.scash"; '
      + 'contract C() { bigint counter; function bump() { Counter.increment(); } }';
    const libArt = compileString(COUNTER, { brandLibrary: true });
    const consumerArt = compileString(CONSUMER, { importResolver: resolver });

    const consumerCat = `${'11'.repeat(31)}aa`;
    const libCat = `${'22'.repeat(31)}bb`;

    // Library branded to the consumer's category; its address is then known and linked into the consumer.
    const libContract = new Contract(libArt, [StatefulContract.libraryBrand(consumerCat)], { provider });
    const libAddr = hexToBin(libContract.withCategory(hexToBin(libCat)).lockingBytecode);
    const consumer = new Contract(consumerArt, [libAddr], { provider });

    await setupStatefulUtxos(
      provider, libContract, libArt.stateLayout!, { counter: 0n }, { saltContract: true, categoryOverride: libCat },
    );
    await setupStatefulUtxos(
      provider, consumer, consumerArt.stateLayout!, { counter: 0n },
      { saltContract: true, categoryOverride: consumerCat },
    );

    const consumerSc = StatefulContract.withCategory(consumer, consumerCat);
    const libSc = StatefulContract.withCategory(libContract, libCat);

    consumerSc.registerLibrary('Counter', libSc);
    const tx = await consumerSc.call.bump().send();
    const consumerNft = getTxOutputs(tx).find(
      (o) => o.token?.nft?.capability === 'mutable' && o.token?.category === consumerCat,
    );
    const state = parsePushdataCommitment(consumerNft!.token!.nft!.commitment, consumerArt.stateLayout!, 0);
    expect(state.counter).toBe(1n);
  });

  // registerLibrary catches a library branded to the WRONG category at registration time (before send).
  it('registerLibrary rejects a library branded to a different category', () => {
    const provider = createTestProvider();
    const libArt = compileString(LIB, { brandLibrary: true });
    const proxyArt = compileString(PROXY);
    const consumerCat = `${'33'.repeat(31)}cc`;
    const consumer = new Contract(proxyArt, [], { provider });
    const consumerSc = StatefulContract.withCategory(consumer, consumerCat);

    // Branded to some OTHER category, not consumerCat.
    const wrongBrand = StatefulContract.libraryBrand(`${'44'.repeat(31)}dd`);
    const libContract = new Contract(libArt, [wrongBrand], { provider });
    const libSc = StatefulContract.withCategory(libContract, `${'55'.repeat(31)}ee`);

    expect(() => consumerSc.registerLibrary('Counter', libSc)).toThrow(/not branded to this contract/i);
  });
});
