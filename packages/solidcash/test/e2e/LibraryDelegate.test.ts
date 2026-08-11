import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { hexToBin } from '@bitauth/libauth';
import {
  Contract, StatefulContract, StatefulTransactionBuilder, createDataNftUnlocker,
} from '../../src/index.js';
import { Artifact, parsePushdataCommitment } from '@solidcash/utils';
import { addressToLockScript } from '../../src/utils.js';
import {
  createTestProvider, getTxOutputs, setupStatefulUtxos, type StatefulUtxoSetup,
} from '../test-util.js';

const input0Preflight = 'messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.';
const input2Preflight = 'messageBus: BCH-2026 preflight failed at input 2: Program failed an OP_VERIFY operation.';

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
    const proxyArt = compileString(PROXY, { allowUnsafeOperations: true });
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
    const proxyArt = compileString(MISMATCH_PROXY, { allowUnsafeOperations: true });
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
    const proxyArt = compileString(PROXY, { allowUnsafeOperations: true });

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
    ).rejects.toThrow(input2Preflight);
  });

  // A branded library through the L.f() auto-wire path (registerLibrary), not just the proxy/impl withDelegatecall
  // path. Both categories are pre-chosen (categoryOverride) so the consumer can link to the branded library
  // address while the library is branded to the consumer's category - no deploy-time circularity. Mock-only:
  // categoryOverride seeds UTXOs at a chosen category via addUtxo, which a real regtest node cannot do.
  it.skipIf(process.env.TESTS_USE_REGTEST)('works through the L.f() auto-wire path (registerLibrary)', async () => {
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

    // Library branded to the consumer's category (via the SDK helper); its address is then known and linked.
    const libContract = StatefulContract.brandedLibrary(libArt, consumerCat, { provider });
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

  // Args + branding together: a forwarded argument reaches a BRANDED library through the auto-wire path.
  it.skipIf(process.env.TESTS_USE_REGTEST)('forwards an argument through a branded library', async () => {
    const provider = createTestProvider();
    const COUNTER = 'library Counter { bigint counter; '
      + 'function incrementBy(bigint n) public { this.counter = this.counter + n; } }';
    const resolver = (p: string): { source: string; id: string } | undefined =>
      (p.includes('counter') ? { source: COUNTER, id: 'counter' } : undefined);
    const CONSUMER = 'import { Counter } from "./counter.scash"; '
      + 'contract C() { bigint counter; function bumpBy(bigint n) { Counter.incrementBy(n); } }';
    const libArt = compileString(COUNTER, { brandLibrary: true });
    const consumerArt = compileString(CONSUMER, { importResolver: resolver });

    const consumerCat = `${'66'.repeat(31)}aa`;
    const libCat = `${'77'.repeat(31)}bb`;

    const libContract = StatefulContract.brandedLibrary(libArt, consumerCat, { provider });
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
    const tx = await consumerSc.call.bumpBy(9n).send();
    const consumerNft = getTxOutputs(tx).find(
      (o) => o.token?.nft?.capability === 'mutable' && o.token?.category === consumerCat,
    );
    const state = parsePushdataCommitment(consumerNft!.token!.nft!.commitment, consumerArt.stateLayout!, 0);
    expect(state.counter).toBe(9n);
  });

  // registerLibrary catches a library branded to the WRONG category at registration time (before send).
  it('registerLibrary rejects a library branded to a different category', () => {
    const provider = createTestProvider();
    const libArt = compileString(LIB, { brandLibrary: true });
    const proxyArt = compileString(PROXY, { allowUnsafeOperations: true });
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

// ---------------------------------------------------------------------------
// SEC-4: the library-sugar delegate co-spend must be PINNED
// ---------------------------------------------------------------------------

/**
 * `L.f()` desugars to a delegatecall whose AST node carries `synthesizedFromLibraryCall`. Every C1 rule in
 * SymbolTableTraversal keyed off `hasExplicitDelegatecall`, which excludes exactly those nodes, so
 * `pinsDelegateCoSpend` was FALSE for a pure library-call function and the callsite emitted NO covenant at all -
 * while the per-function `!functionHasDelegatecall` gate still skipped the consumer's ENTIRE state covenant.
 * The consumer's data NFT sub-covenant self-authorizes on the master's minting NFT, so nothing was left.
 *
 * MEASURED on the BCH-2026 VM, baseline -> fixed (consumer state 0, one-line delegate library):
 *
 *   honest, real library co-spent, settle 1     ACCEPTED count=1    -> ACCEPTED count=1
 *   HOSTILE library co-spent, settle 999        ACCEPTED count=999  -> REJECTED at input 0
 *   NO delegate co-spent at all, settle 999     ACCEPTED count=999  -> REJECTED at input 0
 *
 * The third row is the severe one: a spender rewrote a consumer's state with no delegate present at all, in a
 * shipped language feature, with no diagnostic. Attribution control: disabling ONLY the new emitter (leaving
 * every semantic-analysis change in place) made both hostile rows settle again.
 */
describe('SEC-4: L.f() pins the library co-spend', () => {
  const ONE_FN = 'pragma solidcash >=0.8.0; library Counter { bigint count; '
    + 'function increment() public { this.count = this.count + 1; } }';
  // Same layout, same `increment()` signature (so the SAME selector); only the body and therefore the locking
  // bytecode differ. That makes "which script was co-spent" the single varying field.
  const HOSTILE_FN = 'pragma solidcash >=0.8.0; library Counter { bigint count; '
    + 'function increment() public { this.count = 999; } }';
  const TWO_FN = 'pragma solidcash >=0.8.0; library Pair { bigint count; '
    + 'function increment() public { this.count = this.count + 1; } '
    + 'function wipe() public { this.count = 0; } }';
  const CONSUMER_ONE = 'pragma solidcash >=0.8.0; import { Counter } from "./counter.scash"; '
    + 'contract LibConsumer() { bigint count; function bump() { Counter.increment(); } }';
  const CONSUMER_TWO = 'pragma solidcash >=0.8.0; import { Pair } from "./pair.scash"; '
    + 'contract PairConsumer() { bigint count; function bump() { Pair.increment(); } }';

  const resolve = (source: string, id: string) =>
    (path: string): { source: string; id: string } | undefined => (path.includes(id) ? { source, id } : undefined);

  const oneFnLibArtifact = compileString(ONE_FN);
  const hostileLibArtifact = compileString(HOSTILE_FN);
  const twoFnLibArtifact = compileString(TWO_FN);
  const oneFnConsumerArtifact = compileString(CONSUMER_ONE, { importResolver: resolve(ONE_FN, 'counter') });
  const twoFnConsumerArtifact = compileString(CONSUMER_TWO, { importResolver: resolve(TWO_FN, 'pair') });

  const failingInput = (message: string): number | null => {
    const match = /(?:error in evaluating input index|preflight failed at input) (\d+)/.exec(message);
    return match ? Number(match[1]) : null;
  };

  /** The co-spent library group, unlocked through its own auto-`delegate` public function. */
  function libraryGroup(
    artifact: Artifact, deployed: { contract: Contract; setup: StatefulUtxoSetup }, fn: string,
  ): unknown {
    return {
      categoryId: deployed.setup.categoryId,
      stateLayout: artifact.stateLayout!,
      masterUtxo: {
        ...deployed.setup.masterUtxo, unlocker: (deployed.contract.unlock as any)[fn](0n),
      },
      dataNftUtxos: deployed.setup.dataNftUtxos.map((nft) => ({
        ...nft, unlocker: createDataNftUnlocker(deployed.contract, 2, deployed.setup.categoryId),
      })),
      requiredDataNftIndices: deployed.setup.dataNftUtxos.map((_nft, index) => index),
      functionName: fn,
      functionArgs: [0n],
      externalContract: null,
    };
  }

  /**
   * Build the spend with a RAW StatefulTransactionBuilder rather than the auto-wiring `call.bump()` path: an
   * attacker does not use our SDK, so the co-spend set is chosen freely here.
   */
  async function spend(options: {
    libArtifact: Artifact; consumerArtifact: Artifact; libId: string;
    coSpend: 'honest' | 'hostile' | 'none'; libFunction?: string; settled: bigint;
  }): Promise<string> {
    const provider = createTestProvider();
    const library = new Contract(options.libArtifact, [], { provider });
    const librarySetup = await setupStatefulUtxos(
      provider, library, options.libArtifact.stateLayout!, { count: 0n }, { saltContract: true },
    );
    // The deployed library sits at its CATEGORY-PINNED address (setupStatefulUtxos / withCategory), which is
    // also the address the consumer links: `__libAddr_L` is a constructor argument, so the consumer's own
    // p2sh32 commits to it and no caller can choose it.
    const libraryPinned = library.withCategory(hexToBin(librarySetup.categoryId));
    const hostile = new Contract(hostileLibArtifact, [], { provider });
    const hostileSetup = await setupStatefulUtxos(
      provider, hostile, hostileLibArtifact.stateLayout!, { count: 0n }, { saltContract: true },
    );
    const hostilePinned = hostile.withCategory(hexToBin(hostileSetup.categoryId));
    const linked = addressToLockScript(libraryPinned.address);
    const consumer = new Contract(options.consumerArtifact, [linked] as never[], { provider });
    const consumerSetup = await setupStatefulUtxos(
      provider, consumer, options.consumerArtifact.stateLayout!, { count: 0n }, { saltContract: true },
    );
    const consumerPinned = consumer.withCategory(hexToBin(consumerSetup.categoryId));

    const groups: unknown[] = [];
    if (options.coSpend === 'honest') {
      groups.push(libraryGroup(options.libArtifact, { contract: libraryPinned, setup: librarySetup },
        options.libFunction ?? 'increment'));
    }
    if (options.coSpend === 'hostile') {
      groups.push(libraryGroup(hostileLibArtifact, { contract: hostilePinned, setup: hostileSetup }, 'increment'));
    }

    const builder = new StatefulTransactionBuilder({
      provider,
      stateLayout: options.consumerArtifact.stateLayout!,
      categoryId: consumerSetup.categoryId,
      masterUtxo: { ...consumerSetup.masterUtxo, unlocker: (consumerPinned.unlock as any).bump() },
      dataNftUtxos: consumerSetup.dataNftUtxos.map((nft) => ({
        ...nft, unlocker: createDataNftUnlocker(consumerPinned, 0, consumerSetup.categoryId),
      })),
      ...(groups.length > 0 ? { externalCallUtxoGroups: groups as never } : {}),
    } as never).setState('count', options.settled);

    return builder.send()
      .then((tx: any) => {
        const output = getTxOutputs(tx).find(
          (candidate: any) => candidate.token?.category === consumerSetup.categoryId
            && candidate.token?.nft?.capability === 'mutable',
        );
        const state = parsePushdataCommitment(
          output!.token!.nft!.commitment, options.consumerArtifact.stateLayout!, 0,
        ) as Record<string, bigint>;
        return `ACCEPTED count=${state.count}`;
      })
      .catch((error: Error) => error.message);
  }

  /** Positive control: the refusals below are the hostile co-spend, not the whole class. */
  it('still settles the honest spend with the linked library co-spent', async () => {
    expect(await spend({
      libArtifact: oneFnLibArtifact, consumerArtifact: oneFnConsumerArtifact, libId: 'counter',
      coSpend: 'honest', settled: 1n,
    })).toBe('ACCEPTED count=1');
  }, 120_000);

  it('refuses an implementation the library author never wrote', async () => {
    const message = await spend({
      libArtifact: oneFnLibArtifact, consumerArtifact: oneFnConsumerArtifact, libId: 'counter',
      coSpend: 'hostile', settled: 999n,
    });
    expect(message).toBe(input0Preflight);
    expect(failingInput(message)).toBe(0);
  }, 120_000);

  /**
   * The severe row, and the one with no caller-supplied address to blame: no delegate is co-spent at ALL and the
   * consumer's state is still rewritten. The refusal must come from the consumer's own covenant (input 0).
   */
  it('refuses a state rewrite with no delegate co-spent at all', async () => {
    const message = await spend({
      libArtifact: oneFnLibArtifact, consumerArtifact: oneFnConsumerArtifact, libId: 'counter',
      coSpend: 'none', settled: 999n,
    });
    expect(message).toBe(input0Preflight);
    expect(failingInput(message)).toBe(0);
  }, 120_000);

  /**
   * A selector-dispatched library (>= 2 public functions) also pins WHICH function ran. Honest control differs
   * only in the co-spent library function.
   */
  it('settles the named library function and refuses a substituted one', async () => {
    expect(await spend({
      libArtifact: twoFnLibArtifact, consumerArtifact: twoFnConsumerArtifact, libId: 'pair',
      coSpend: 'honest', libFunction: 'increment', settled: 1n,
    })).toBe('ACCEPTED count=1');

    const substituted = await spend({
      libArtifact: twoFnLibArtifact, consumerArtifact: twoFnConsumerArtifact, libId: 'pair',
      coSpend: 'honest', libFunction: 'wipe', settled: 0n,
    });
    expect(substituted).toBe(input0Preflight);
    expect(failingInput(substituted)).toBe(0);
  }, 240_000);
});
