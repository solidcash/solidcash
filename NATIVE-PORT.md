# SushiSwap V2 on SolidCash / SolidHat

This worktree compiles the SushiSwap V2 core contracts with `solidc` for Bitcoin Cash and runs a native
SolidHat suite against the mock network.

## Run

```sh
node packages/testing/dist/cli.js compile
node packages/testing/dist/cli.js test
```

The project config is `solidcash.config.ts`; the curated BCH sources are in `.sushi/contracts`. The original
EVM contracts and tests in `/Code/sushi-port` are untouched.

## Result

- 23 sources compile to 31 artifacts.
- 28 native tests pass.
- Covered natively: `TestERC20` (mint, transfer, allowance, fee, failure modes), the `UniswapV2Factory`
  admin and read surface, the BCH pair registry, pair address prediction, a directly deployed
  `UniswapV2Pair` (initialize, reserves, LP ERC20, approvals),
  `Math`/`SafeMath`/`UQ112x112`/`UniswapV2Library`/`TransferHelper`.

## BCH-native pair creation and discovery

A BCH child address is deterministic. Given the pair template, the child category (the funding outpoint's
txid), the token addresses/categories and the CREATE2 salt, the SDK predicts the p2sh32 locking address before
the transaction exists:

```ts
const predicted = new Contract(pairArtifact, [], {
  provider, category: hexToBin(funding.txid), addressType: 'p2sh32',
});
// predicted.address is the pair's locking address
```

The pair also has a *logical* address, which the SDK predicts from the deployer and nonce:
`deriveLogicalCreateAddress(deployer, nonce)`. `test/prediction.test.ts` pins both predictions against the
deployed pair.

An EVM `pairFor(factory, tokenA, tokenB)` derives the address from the factory and the token pair alone. On
BCH the category is part of the locking script, so a covenant that receives only the factory and the tokens
cannot know it. SDK callers that know the funding category can predict the address; the on-chain
`UniswapV2Library.pairFor` reads the registry, which is the discovery surface available to a covenant.

The BCH flow is:

1. **Deploy the pair** directly, passing the factory address to the constructor:
   `new UniswapV2Pair(factory)`.
2. **Initialize once** with `initialize(token0, token1)`, using the canonical `sortTokens` order. The
   constructor records the factory; the initialization is permissionless but one-shot.
3. **Register the pair** with `factory.registerPair(tokenA, tokenB, pair)`. The fee setter is the listing
   authority, so a fake pair cannot enter the registry. Registration writes both `getPair` directions,
   appends to `allPairs`, and emits `PairCreated`.
4. **Discover the pair** by reading `factory.getPair(token0, token1)` (or `allPairs`). The returned value is
   the pair's canonical SDK identity and can be used with `getContractAt`/`ethers.Contract`.

`UniswapV2Library.pairFor` is now a view that reads the factory registry instead of hashing a CREATE2
preimage. The native suite exercises it with the external-call witness:

```ts
await lib.call.pairFor(factory, tokenA, tokenB)
  .withExternalCall(factory, 'getPair', [token0, token1])
  .staticCall();
```

The same witness pattern reads reserves through the library:

```ts
await lib.call.getReserves(factory, tokenA, tokenB)
  .withExternalCall(factory, 'getPair', [token0, token1])
  .withExternalCall(pair, 'getReserves', [])
  .staticCall();
```

A Router port should take pair addresses in its path, or provide the same external-call witnesses.

## SolidCash fixes in this worktree

- `TransactionBuilder.send`: a send with no exact message-bus receipt judges bytes against the destination
  provider's consensus limits instead of the hard-coded BCH 10,000-byte default. The mock publishes 10 MB.
- `StatefulContract._isPureRead`: an omitted `writesState` flag counts as a read when the compiler published a
  `view`/`pure` modifier.
- `forceStateful: true`: stateless library/test contracts get a master NFT and a `returnEvent` slot, so
  `staticCall` can decode their values. This closes the pure-reader gap; all library readers now pass.
- `StatefulFunctionCall.staticCall` now forwards `externalCallInfos` to the return-value derive. A view that
  reaches an external contract (the registry-backed `pairFor`) can be read without sending.
- `commitmentLimit: 128`: the CLI would otherwise inherit the mock's 1,000,000-byte commitment ceiling, which
  changes event chunking and child data-NFT layout.

## Remaining work

- `UniswapV2Factory.createPair` (a `new Child{salt}` inside the factory) still computes the child address
  from `type(UniswapV2Pair).creationCode` **before** the SDK replaces the 27-byte constructor-argument
  placeholder with the factory identity. The SDK's predicted/actual child address therefore differs from
  the address the factory covenant writes into `getPair`. The registry flow avoids the mismatch. A compiler
  fix would apply the same placeholder substitution in the factory's `create2` codegen.
- `mint`/`burn` do not settle under the current SDK state derive: the pair's mapping batch and the LP entry
  outputs trip `Executing identity output collides with an independently owned covenant output`. The registry
  and read paths are unaffected. The BCH copy locks the first `MINIMUM_LIQUIDITY` at a dead identity and
  disables the protocol-fee mint, but the derivation collision remains.
- Router, WETH9 and SushiRoll are not in the native source set: they rely on ETH transfer, `callStatic`,
  EIP-712/permit or CREATE2 address derivation. ERC20 permit and `DOMAIN_SEPARATOR` were removed.
- `swap` has no return value and is compiled, but a native swap test needs the same mapping/liquidity path as
  `mint`/`burn`.

## Parity run against the original EVM suite

The original contract tree and test suite are copied into `.parity-project`. They compile natively:

```sh
cd .parity-project
node ../packages/testing/dist/cli.js compile   # 30 sources -> 40 artifacts
node ../packages/testing/dist/cli.js test
```

Result: **107 passed, 85 failed (192 total)**. See the per-suite table under "Original EVM suite parity".

## Original EVM suite parity

`.parity-project` compiles the original SushiSwap V2 contracts and runs the original six test files under
SolidHat. Latest results (`vitest run --config vitest.solidhat.config.ts test`: 107 passed, 85 failed of 192):

| Suite | Passing / Total | Remaining blocker |
|---|---|---|
| `UniswapV2Factory` | 15 / 15 | — |
| `UniswapV2ERC20` | 14 / 14 | — |
| `UniswapV2Pair` | 27 / 36 | flash/reentrancy circular calls (6); migrator circular call (3) |

The protocol-fee lane now passes. `_mintFee` writes `balanceOf[_feeTo]`, where `_feeTo` is a local declared
`address(0)` and reassigned from `factory.feeToAndMigrator()`. Key collection keeps the declaration initializer,
so that write's canonical key is `cast:address(lit:0)` and it merges with the first-mint
`balanceOf[address(0)]` write into one entry slot. The compiler now keeps that merged slot and publishes the fee
site's producer key as an **alternative** on the entry: `{ key: 'producer:2:0', activation: … }`. The activation is
a decidable recipe over frame facts, `feeTo != 0 && kLast != 0 && sqrt(reserve0·reserve1) > sqrt(kLast) &&
totalSupply·(rootK − rootKLast) / (rootK·5 + rootKLast) > 0`. The SDK evaluates it with the authenticated external
return for `producer:2:0`; when it holds, the alternative key replaces the literal key, otherwise the primary
`cast:address(lit:0)` key applies. The entry's value stays trace-derived, so the census and event geometry are
unchanged. The producer key is not added as a separate key param, which is what regressed the three mint/burn/kLast
cases in the earlier split-slot experiment. `mints protocol fees after reserve growth when feeTo is set` passes,
and `mints proportional liquidity`, `clears kLast when fees are turned off`, `burns liquidity and returns the
underlying tokens`, `skips the fee mint when the fee amount rounds to zero` and `mints the first liquidity` stay
green.
| `Libraries` | 37 / 37 | — |
| `UniswapV2Router02` | 11 / 74 | a Router-built transaction must deploy the pair through the factory (nested child deploy); `msg.value`/WETH satoshi model. The Router now publishes a route (see below), so its own `factory`/`quote`/amount getters are co-spendable |
| `SushiRoll` | 3 / 16 | the pair created inside the roll transaction; the pair address derived from a live `oldRouter.factory()` result; the migrator-style circular `A->B->A` read |
| **Total** | **107 / 192** | |

`UniswapV2Pair > swap > accepts tokens that return no data on transfer` used to be order-dependent: it took
`customPair.token0() === nrt.getAddress()` to choose which token to swap. The getter returned the 20-byte Solidity
identity while `getAddress()` names the deployed contract, so the comparison was false and the test moved the
wrong token whenever the no-data token was `token0`. A `public address` state getter now resolves a registered
deployment's address (`decorateStateAccessorResult` with a resolver from `buildNamespaces`), and the harness
equality bridge equates a logical address, a physical address, and an EVM projection identity that name one
deployment. The test now passes deterministically in each order; the whole-project run is 107/192.

The counts above were re-measured from a **clean rebuild** of every package (`rm -rf packages/*/dist
packages/*/tsconfig.build.tsbuildinfo`, `tsc -b`) and a clean parity compile, with the pair's message-bus route
enabled in `.parity-project/solidcash.config.ts`. A package `dist` left partially stale by an
abandoned experiment can produce a false failure that a clean build does not reproduce (it showed an extra
`UniswapV2ERC20 > transferFrom > decrements a finite allowance and transfers` failure whose failing require was the
conditional allowance check); re-run a clean build before attributing a single case to the compiler.
The six files are also run one at a time for the reproducible counts: a combined run deploys six fixtures in
parallel, and on a loaded host one `beforeEach` exceeded vitest's 10 s default hook timeout and reported as a
test failure (measured: 103/192 combined against 107/192 per file). The parity config raises `hookTimeout` to
60 s, after which the combined run reports the same 107/192 as the per-file runs.
Evidence: `final10-parity-all.log` (107/192 combined, raised hook timeout), `final9-*.log` (per-file),
`final9-native.log` (28/28), `final9-hardhat.log` (192/192).

The original EVM Hardhat suite in `/Code/sushi-port` remains untouched.

### Message-bus route admission for the pair and the router

The pair's returning state readers were the last shape without a route. Three compiler changes land together:

- `messageBusHandlersByContract` selects a route's entry points per contract. The pair's default selection
  admits its collection getters (`allowance`, `balanceOf`, `nonces`), so the scalar `getReserves` reader is
  refused as `mixed-scalar-and-collection-route-not-enabled`. Selecting `['getReserves']` for the pair publishes
  a scalar-only route with `getReserves` eligible. `mint` still cannot join: a conditional scalar write beside
  mapping rows and an event has no row-local settlement, and it stays `KERNEL_LAYOUT`
  (`conditional-scalar-collection-event-settlement`). Regression:
  `packages/solidc/test/journal-message-bus/PairRouteAdmission.test.ts`.
- `InlineReturningStateHelpers` accepts an implicit named-return body (a route clone is snapshotted before
  `NamedReturnTransformation` appends its tail). This is what removes the X118 refusal of `_mintFee` -> `_mint`.
  The explicit-return path is unchanged byte-for-byte; only fall-through bodies take the new lowering.
- A route clone that reaches a call target selected by an internal loop index has no row binding for the
  direct-function witness array. SymbolTable now refuses that handler by name
  (`GraphHandlerShapeError`, attributed to the clone) instead of leaving an untyped
  `__internal__loopTargets<n>` access that failed the whole contract's final typecheck. Regression:
  `packages/solidc/test/journal-message-bus/GraphLoopTargetAdmission.test.ts`. This is what lets
  `UniswapV2Router02` publish a route at all; it admits `WETH`, `__receive`, `addLiquidity`, `factory`,
  `getAmountIn`, `getAmountOut`, `quote`, `removeLiquidity` and `removeLiquidityWithPermit`.

Compiling the pair under the message bus (with or without a routed handler) changes its direct-entry ABI: the
vmap batch for `transferFrom` is split differently, and the ERC20-via-pair `transferFrom` then fails preflight
(`OP_VERIFY`), 14 -> 13. The parity project therefore keeps the pair on its established direct lowering with
`messageBusByContract` (`UniswapV2Pair: false`, `SushiSwapPair: false`). A regression
(`PairRouteAdmission.test.ts > per-contract message-bus opt-out`) asserts the opted-out contract's bytecode is
identical to a `messageBus: false` build while a sibling still publishes its route. The route capability stays
available for a participant whose direct entries do not change.

Route admission now admits a scalar state write that shares its arm with the row/event settlement, and keeps
refusing the complementary shape (a scalar in one arm while a sibling arm settles a row or event). Both sides are
measured: `packages/solidcash/test/e2e/KernelConditionalScalarRoute.test.ts` sends the admitted shape on both
branches, and `fence-complementary-fails.log` records the refused shape failing the preflight when the fence is
bypassed. The pair's `mint` is refused by the same fence (`kLast = 0` in `_mintFee`); its other handlers keep
their routes, and the parity project compiles the pair with the route enabled.

### Parity fixes in the compiler/SDK

- `abi.encodeWithSelector` folds a `bytes4 constant` initialized from `keccak256(bytes("sig"))` so a raw call
  publishes its selector and the SDK can pin the callee.
- A vmap key spelled `address(this)` resolves to the spending input's own locking bytecode (previously it fell
  back to the empty key and collided with `address(0)`).
- External-call argument expressions evaluate `SafeMath.add/sub/mul/div` and a mapping `stateAccess` against the
  build's loaded entry nodes.
- The harness rebuilds a stateful handle from a registered child; the pair's burn/mint state derivation and
  `getContractAt` now use the same salt/category identity the creator used.
- ethers v6 call shape: `contract.fn.staticCall(...)` / `.send(...)` on the function property, with a trailing
  `{ value }` overrides object split out of the ABI arguments.
- The stateful keccak probe now co-spends the block slots its master reads before the side-car binding (entry
  proofs), so `permit` resolves all five nested preimages. Entry slots are padded from the compiler-declared
  block layout and recreated in the probe transaction.
- A deployed child is re-registered with its connected `StatefulContract` handle, so a later external call
  through a factory-created pair has `getFullState`.
- Address arguments for an external-call target are normalised to their locking bytecode like every other
  address argument; leaving the CashAddress string made `require(to != token0)` compare UTF-8 text.
- The mock provider auto-mines a transaction at the block-oracle timestamp instead of tip+1, so
  `block.timestamp` inside the covenant equals the block the receipt reports (price accumulators).
- The compiler records a mapping key that is a tuple component of another call's return as a `producer` key
  source; the SDK resolves the producer's authenticated value before hashing the slot.
- A 20-byte address value whose own deployment lock narrows to it is a lock-derived identity, not an unowned
  CREATE2 projection. `isCreate2ProjectedAddressValue` now uses the same payload match as
  `findDeploymentByAddressValue`, so a factory-created pair addressed as a runtime argument resolves to its
  co-spendable child. This removes the misleading CREATE2 refusal from the Pair migrator and SushiRoll paths.
- A merged fixed entry can publish `alternatives: [{ key, activation? }]`. The compiler derives the alternative
  from the other write sites' key labels and the branch guards each site runs under; the SDK evaluates the
  activation with `evalComputedKey` and uses the alternative key when it holds. The key label language gained
  `producer:<callsite>:<result>`, `call:sqrt/min/max`, division, modulo and address-versus-zero equality for this.
  This resolves the protocol-fee recipient entry without splitting the slot. Focused regressions:
  `packages/solidc/test/MergedEntryKeyAlternative.test.ts` and
  `packages/solidcash/test/unit/EntryKeyAlternativeActivation.test.ts`.
- A public `constant` has an ABI getter but no state variable, so the message-bus route's scalar-getter branch
  emitted a call to a function that does not exist (`decimals`). The route now publishes the folded literal.
  Regression: `packages/solidc/test/journal-message-bus/PublicConstantGetterRoute.test.ts`.
- The SDK can batch two *different* returning methods of one callee into one message-bus route
  (`sc-build-shared-method-external-batch.ts`): the transitive discovery hook builds rows for the shared direct
  call and the new transitive call, attaches the route to both logical groups, and the shared group keeps the
  physical input. A **single** direct call has the same row builder available (`buildSingleMethodExternalBatch`),
  but wiring it into the nested-callee prelude regressed the native registry read (a bus-direct `getPair` route
  aliased entry slots 0 and 1), so it stays unwired. The repeated-batch witness resolver also understands a
  swappable `balanceOf` key pool, so `transferFrom(owner, pair)` plus `balanceOf(pair)` can share a route.
  Regression: `packages/solidcash/test/unit/SharedMethodExternalBatch.test.ts`.
  This path cannot be enabled end to end: compiling a token or factory with `messageBus: true` rewrites its
  **direct** entries. A bus-compiled `TestERC20` (after making its emitting helper void) cannot be resolved by
  `getContractAt` after `pair.token0()` returns its 20-byte identity (the Pair fixture stops at deployment
  lookup), and a raw `safeTransfer` fails preflight comparing a 64-byte entry/event commitment with an 8-byte
  witness at input 1; the legacy `messageBusKernel: false` lowering fails the same comparison (ip 908). A
  bus-compiled factory emits `PairCreated.token0` as a 35-byte locking bytecode instead of the 20-byte ABI
  identity (2 Factory tests). Those contracts are kept on the direct lowering in the parity project (only the
  pair opts into the route), so the counts above are direct-artifact counts apart from the pair itself.
  Evidence: `pair-typedbus1.log`, `lib-legacybus-tail.log`, `lib-single-route1.log`,
  `twostep-bus7.log`, `twostep-bus10.log`, `factory-bus-suite.log`.
- A failing outlined library body is attributed from the trace's executed instructions even when the failing
  step exposes no control stack, so a `require` inside an inlined library (SafeMath) reports its message.
- A loop-expanded callee's master advances by its whole physical width. A stateful pair co-spends its master
  **and** the data NFT holding its reserves, so the compiler publishes `__internal__loopTargetStride<n>` and the
  SDK fills it from the resolved group's `blockInputs.length` (fallback `1 + dataNftUtxos.length`). Iteration 1+
  therefore lands on the next callee's master instead of the first callee's data NFT. The stateful returning-loop
  e2e test asserts the built caller's stride witness is `2` for a two-callee (three-token) path, and a second
  case runs a three-callee (four-token) route: iteration 2 must read the third callee's master, four inputs past
  the first, and every callee's own return event is accumulated (total 30). A stride of one reaches the first
  callee's data NFT at iteration 1, and a per-iteration `+1` cannot reach the third callee at all. Library
  `pairFor`, `getReserves`, `getAmountsOut` and `getAmountsIn` all pass.
- A keccak256 call inside an outlined free function (an imported `internal` library helper such as
  `UniswapV2Library.pairFor`) now gets a compute side-car basis from the entry points that reach it. When every
  reaching entry reserves the same side-car offsets the helper bakes that layout; when the offsets differ (a
  handler without a block-info oracle packs the band one slot lower) the call edge threads the caller's
  absolute side-car input index through the invocation frame. Before this the helper fell back to the
  stateless count-relative read and named the funder, so `pairFor` failed at its first keccak binding.
- The external-call expression evaluator executes a compiler-published pure-helper program, including tuple
  assignments and tuple returns, implicit named returns, unchecked blocks, `keccak256` over a packed operand,
  address ordering and Solidity's big-endian `uint`/`address` casts. A target shaped
  `IUniswapV2Pair(address(pairFor(factory, a, b))).getReserves()` therefore resolves to the same digest the
  covenant computes instead of dropping the callee (`ExternalCallPredicate.test.ts` compiles a CREATE2 helper
  and compares the evaluated target with an independently computed digest).
- An unset synthesized array witness (`__internal__loopTargets<n>`, `__internal__viewReturn<n>`) now defaults
  to the zero-length pushdata array (`00`) rather than `0n`. A build whose pre-call guard proves a loop call
  unreachable no longer stops at argument encoding ("Value for type address[] should be a Uint8Array or hex
  string"); its unlocking script stays well formed so the covenant's own require remains the authority.
- A reached (non-conditional) callsite that cannot be pinned now fails with
  `External call planning could not pin the callee for …` instead of skipping group materialization and leaving
  every caller topology witness at its default (`extcallMasterIdx = 0`), which surfaced as an unrelated
  `OP_VERIFY`. The message names the co-spend requirement, a target created in the same transaction, and the
  absent lock projection of a CREATE2 identity (`ExternalCallPredicate.test.ts` drives the orchestrator entry
  point).
- `address(uint160(uint256(x)))` and every integer-to-address cast under `evmCompat` now produce exactly the
  low 20 bytes of the big-endian word (the raw Solidity identity), while `address(0)` stays the empty value.
  A short numeric identity previously took the P2PKH fallback and aborted at `OP_SPLIT`.
- The test-side identity is now the same address value the SDK feeds to the covenant:
  `cashAddressToEthHex` resolves a registered deployment's value locking bytecode instead of decoding the
  CashAddress string (the logical and physical locks can differ), and an unpredicted `getCreate2Address`
  answers the EVM `keccak256(0xff ++ factory ++ salt ++ initCodeHash)[12:]` identity instead of an arbitrary
  placeholder. When the caller supplies a canonical Uniswap/Sushi pair init-code hash, the EVM identity is
  answered even if a BCH child can be predicted: that call is asking for `pairFor`'s value, not the child
  address.
- The deployment registry projects the canonical EVM CREATE2 identity for every factory child from its
  recorded parent lock, salt and the canonical pair init hashes. `findDeploymentByAddressValue` and the chai
  address matcher use that projection, so a contract that computes `pairFor` and stores/returns the identity
  names the same deployed pair as its CashAddress.
- `TestFactory` inherits `UniswapV2Factory` instead of storing the EVM pair creation code. Its `create2`
  lowering then shares the production child template and constructor-placeholder substitution, and it no
  longer carries a dormant multi-kilobyte `bytes` state variable.
- The harness exposes `provider.getBalance(address)` as the address's UTXO sum, and a deployment whose ABI
  moves native value (a `transferCount` or a satoshi-container slot) is funded with an initial container
  balance. A payable helper can then reach its own covenant before failing on the transfer itself.
- A straight-line keccak256 read whose side-car coordinate is negative now fails closed instead of reading
  `tx.inputs[-1]`: it drops the preimage argument and produces a 32-byte zero digest. The coordinate is the
  SDK's marker for an absent side-car (a pruned call) or a borrowed slot read from the wrong frame item. A
  reached use then projects an address no deployment matches, while the contract's own earlier require stays
  the authority. This settled the Router/SushiRoll expired-deadline paths, whose external-call argument
  (the hoisted `UniswapV2Library.pairFor`) is evaluated before the deadline require
  (`KeccakMissingSidecarGuard.test.ts` asserts the shipped body bytes for both an outlined helper and an
  entry body).
- A conditional external call whose target cannot be resolved is now stated as not taken instead of failing
  the build. The caller's own covenant keeps the guard, so a spend that reaches the call fails closed at the
  call site, while an unreached branch (the pair's `if (msg.sender == migrator)` guard, where `migrator` is
  another call's return) needs no callee UTXO. A transitive group that targets a participant a direct call
  already co-spends (the Router's token `transferFrom` and the pair's `balanceOf`) now shares that physical
  block instead of registering a duplicate master input.
- A two-step Router path (create the pair with `factory.createPair`, then `router.addLiquidity`) now reaches
  the factory `getPair` probe: the Router's `_addLiquidity` guard reads it, and the probe seeds a placeholder
  record (`af56c512…01 00`) where the factory covenant expects the mapped pair address (evidence:
  `router-twostep-probe.log`). Ethereum's own `addLiquidity` creates the pair inside the
  Router transaction; a BCH output cannot be spent by the transaction that creates it, so the fresh-pair
  shape remains unsupported.
- A three-entry sorted batch (`transferFrom`: allowance + owner balance UPDATEs and a cold recipient balance
  INSERT) now keeps the insert's NEW node at its entry slot. A repair that reordered "predecessor at the entry
  slot, successor at a later entry" matched a *mirrored predecessor co-spend* whose next key happened to point
  at the owner UPDATE, and swapped that update into the NEW's coordinate. The next probe then never revealed the
  NEW node, so the final spend compared the entry against the owner update. The reorder now requires the
  candidate's next key to be the `insertedSlot` the compiler descriptor publishes
  (`ThreeEntryTransferFromInsert.test.ts` drives the shipped compiler + SDK through `approve` then a nested
  `transferFrom` whose recipient has no entry yet). This settled both multi-entry `transferFrom` Library cases.
- A raw low-level call (`token.call(payload)`) whose callee declares no return value now reads its returndata
  from the record's *absence* instead of a synthesized carrier. A contract whose entries return values refuses
  every unpinned carrier of its own category (a void entry emits a record count of zero), so seeding a
  placeholder made the callee abort with `OP_NUMEQUALVERIFY` (0 records expected, 1 present). The SDK now
  states the return coordinate as `-1` for such a callee and seeds no event; the compiler's opaque return read
  branches on a negative index and yields `(success = true, data = empty)`. This settled
  `safeApprove`/`safeTransfer`/`safeTransferFrom` "accepts a token that returns no data"
  (`RawCallEmptyReturn.test.ts` sends a real raw call to a void `set` and asserts the callee state and the
  caller's empty-returndata branch).
- A dynamic stateful keccak256 loop now mints deterministic compute side-car stand-ins when the provider
  exposes `addUtxo` (the mock network), matching the fixed-slot resolver, and probes with synthetic
  placeholders first so an early-abort path can prove the loop is never reached. On a real provider it still
  requires explicitly deployed mutable-NFT side-cars
  (`Keccak256.test.ts`, "provisions the dynamic keccak256 side-cars on a provider that supports it").
- A non-linear sorted batch whose rows share one proof names the single republished predecessor output for every
  row; the non-republishing row used to carry `-1` and the covenant read `tx.outputs[-1]`. A linear batch keeps
  `-1` there, because its two-lane and rows-table verifiers test that sentinel explicitly. Regression:
  `packages/solidcash/test/e2e/KernelSharedBatchPredecessor.test.ts` (empty and pre-seeded mapping); the repro
  fails on the previous planner with `requested index: -1` and passes with the change.

### Computed external targets (resolved)

A computed target's on-chain value is an EVM identity, while a co-spent callee is authenticated by its BCH
locking bytecode. `UniswapV2Library.pairFor` returns a keccak CREATE2 address, so no lock projects to it and
the epilogue's identity check could never pass. Both shapes now take a compiler-published witness that the SDK
fills from the deployment it co-spends, and the loop's per-iteration coordinates follow the physical layout:

- **Loop stride.** `__internal__loopTargetStride<n>` is a `bigint` witness beside the `__internal__loopTargets<n>`
  array. The compiler cannot see a callee's private state footprint, and a pair's `getReserves()` co-spends its
  master *and* the data NFT holding the reserves: iteration `i`'s master is `base + i*2`, not `base + i`. The SDK
  fills the stride from the composed block width (`blockInputs.length`, else `1 + dataNftUtxos.length`), and the
  inline-loop dispatch multiplies the loop index by it. One-hop chains looked correct because iteration 0's
  offset is zero; the second hop read the first callee's data NFT and failed the identity compare.
- **Pair position.** The witness holds one entry per pair in path order, so the index is the *lower* of the two
  element indices: `path[i], path[i+1]` -> `i`, and the backward chain's `path[i-1], path[i]` -> `i-1`.
  `findLoopIndexInComputedTarget` now chooses the expression with the smallest literal offset instead of the
  first bare loop counter; `getAmountsIn` walks backwards and previously read one element past the witness,
  shifting every co-spend and return event by one.
- **Straight-line targets.** An `__extaddr_` local hoisted from `IFoo(pairFor(..)).m()` still evaluates the
  computed address, but the pin now reads `__internal__computedCallTarget<n>`, a lock witness the SDK fills from
  the resolved deployment's execution lock. This settled `UniswapV2Library.getReserves` and removed the
  `CREATE2 identity … no Bitcoin Cash locking bytecode commits to it` refusal for a factory-created pair.
- **Candidate scope.** The legacy-caller fallback for `__internal__loopTargets<n>` derives its candidates from
  the loop's own source array: each adjacent pair is `keccak256(sort(tokenA, tokenB))` under the factory's
  address form, matched against registered children's salts. Previously it registered every factory child that
  implemented the interface, so a second test in the same process fed its loop the first test's pairs (the
  suite passed in isolation and failed at the return decode in the full file). The path values name logical
  deployments, so the salt uses each deployment's execution lock.
- **CREATE2 projection.** `isCreate2ProjectedAddressValue` now returns false when exactly one registered child
  projects to the value: the SDK substitutes that child's lock and the co-spend authenticates it. Only zero or
  several owners remain a dead end.

### Remaining architectural gaps (captured failures)

- **An outlined keccak helper inside a runtime loop (resolved).** `UniswapV2Library.getAmountsOut` hashes in
  a `for` loop over the path, so the entry flags `keccakLoopReads` and the SDK provisions preimages from the
  trailing band at `master + blockSize + counter`. The hoisted `pairFor` target is an outlined body that
  batches two keccak calls into one side-car, so a call inside the loop must thread *this iteration's*
  trailing coordinate and keep the member ordinal instead of re-reading the fixed `keccakSideCar` slot.
  Three changes made the two schemes agree:
  - `GenerateTargetTraversal` emits the trailing coordinate (`block base + blockSize + counter`) as the
    call-edge slot when `keccakLoopActive`, so the callee's fixed-slot read no longer addresses a container
    or a funder pad.
  - `scanKeccakBatchReads` derives `(slot, member)` from the trace's `[arg, ordinal, index]` shape, and
    `sc-resolve-stateful-keccak-loop`/`StatefulContract` key side-cars by their trailing base
    (`blockLayout.trailingBase`) rather than the fixed slot offset.
  - The loop-declared counter is no longer treated as a fixed alias by `SynthesizeExternalAddressLocals`,
    which had hoisted the `pairFor(factory, path[i], path[i+1])` target to the body top and evaluated it
    (with `i` frozen at its initializer) before the deadline `require`.
  The entry-time alt-stack anchor is part of the scheme: an outlined body captures the hidden slot at its own
  entry (where its depth is exact), `emitKeccakComputeCall` reads that copy non-destructively per batch, and
  the epilogue restores the alt stack. The earlier standalone anchor experiment failed only because the
  resolver still gave the batch its own side-car per read. Measured effect:
  Router 6/74 → 11/74 and Libraries 21/37 → 23/37. Regressions: `KeccakResultNft.test.ts` ("groups a batched
  helper body by side-car and keeps each call's member", "reads a dynamic-loop call by its side-car index").
- **A computed external target's ABI return inside a dynamic loop (one hop resolved; two hops open).**
  `UniswapV2Library.getAmountsOut` calls
  `IUniswapV2Pair(pairFor(factory, path[i], path[i + 1])).getReserves()`. The earlier ip 121/127 `length > index`
  failure was **not** a return decode: the compiler rewrites the computed target to a synthesized
  `__internal__loopTargets<n>[i]` witness, and the SDK left that witness empty (no external-target instances were
  registered for `IUniswapV2Pair`), so the first iteration failed the witness bounds check. Four fixes make the
  one-hop form work end to end:
  - the orchestrator falls back to the session's deployment registry for a loop slot with no explicit entries,
    registering the interface-implementing **factory children** in registration order (the caller covenant binds
    every co-spent input to its own witness element, so a candidate set cannot forge a callee);
  - a return probe now precomputes the callee's return for **any** returning loop occurrence, not only when the
    result is stored into an array, and it does so for calls whose return event is a dedicated output band as well
    as an in-block event;
  - that precompute encodes the whole ABI result vector for a multi-output call (`getReserves` -> three words);
  - the inline-loop typed-return path decodes an `evm-abi-v1` result with the same ABI tuple decoder the
    straight-line call uses, instead of reading the tuple as native compact pushes (which collapsed it into the
    first `uint112` and failed its range check on a 95-byte number).
  Measured on a two-token path against a seeded pair: `getAmountsOut` returns `[1000, 906]` through the shipped
  compiler and builder. A fifth fix was needed for the two-callee layout: the planned return-event index counted
  only the caller's master + data NFTs, so a caller with a keccak/ecrecover side-car or its own return event put
  the first loop-expanded return event on top of the second callee's data NFT. Counting those fixed block slots
  now lays the caller at outputs 0-2, the two callee blocks at 3-6 and the two return events at 7-8. The
  three-token path then fails at the caller's call-record digest check (ip 256 in the caller body): both seeded
  return events carry the **same** 128-byte record (`<record digest> || <96-byte tuple>`), so iteration 1 cannot
  match the digest the caller derives from its own `path[i], path[i+1]` arguments. Giving each loop-expanded
  occurrence its own record digest is the next blocker; `getAmountsIn` shares it. Both library chained tests use
  a three-token path, so the Libraries count is unchanged at 23/37.

- **A Router-built transaction that deploys a pair through the factory.** `addLiquidity` calls
  `factory.createPair` inside `_addLiquidity` when the pair is absent, then immediately calls
  `IUniswapV2Pair(pair).getReserves()` and `pair.mint()` on the pair it just created. A BCH transaction cannot
  spend an output it creates, so the new pair has no co-spendable master and the planner reports
  `External call planning could not pin the callee for IUniswapV2Pair.getReserves …`.
  A two-step split was tested explicitly: a top-level `factory.createPair` succeeds (15/15 Factory), and a
  following `router.addLiquidity` on the now-existing pair still fails with
  `External call to IUniswapV2Pair.getReserves targets CREATE2 identity '<20 bytes>', which no Bitcoin Cash
  locking bytecode commits to`. Giving the child a genesis binding NFT was also tested: the factory covenant
  rejects the extra output at broadcast (`mandatory-script-verify-flag-failed`, 4 createPair cases), so no
  on-chain anchor can carry the CREATE2 value. A top-level factory `createPair` passes all 15 Factory tests,
  so the gap is specifically a child used by its creator in the same transaction.
- **`UniswapV2Library.pairFor` versus a BCH child address.** `pairFor` computes the EVM CREATE2 identity, while
  a BCH pair's address commits to its funding category. The SDK now registers the canonical EVM CREATE2
  projection for each factory child (from its recorded parent, salt and the canonical pair init hashes), so
  the identity resolves to the deployed pair and the `pairFor` test passes. The projection is a session-local
  alias; no on-chain value commits to it.
- **Ether value.** The original tests pass wei (`parseEther("1")`) as `msg.value`; BCH satoshis cannot carry
  those magnitudes, and the contracts compare `msg.value` against wei-denominated token amounts. A value model
  must scale both sides or the Router/SushiRoll ETH paths cannot be expressed.
- **A CREATE2 identity cannot be authenticated on-chain.** `pairFor` returns
  `keccak256(0xff ++ factory ++ salt ++ initCodeHash)[12:]`. The caller covenant checks the co-spent callee as
  either the lock-derived identity (`hash160`/payload of its locking bytecode) or a co-spent SCID identity
  anchor whose canonical lock and commitment name that callee. A CREATE2 address commits to an EVM init-code
  hash, so no BCH lock projects to it, and an anchor cannot carry it: the anchor's lock must hash to the
  identity, and a raw 20-byte lock equal to the identity is not spendable. The SDK now evaluates the nested
  `pairFor` expression (see the pure-helper bullet) and pins the registered child through its CREATE2
  projection, then refuses the call with a named error (identity, and the on-chain requirement) instead of
  assembling a transaction that fails `OP_VERIFY`. This is the shared limit behind the `getReserves`/
  `getAmounts*` cases, the Router pair targets and the SushiRoll pair targets.
- **The pair's writers cannot join a route, so a Router transaction cannot co-spend one pair twice.** The
  Router's `addLiquidity` calls `IUniswapV2Pair.getReserves` (view) and then `IUniswapV2Pair.mint`, both
  returning, on one pair master. The direct convention refuses two returning methods on one state owner
  ("Direct external calls to getReserves and mint share one state owner but both return values"). A route is
  the documented way out, and `getReserves` is routable, but `mint` is refused as
  `conditional-scalar-collection-event-settlement`: the fee-mint arm writes `totalSupply` (a scalar) beside
  `balanceOf` rows and a `Transfer` event, and the kernel journal has no row-local settlement identity for
  that scalar. `burn` is refused because the `Burn` event is wider than one commitment, and `swap` because
  its effect set shrinks the route. `removeLiquidity` (burn) and every token swap hit the same two refusals.
  A pre-created pair does not change this: the manual two-step still fails at the same direct-call refusal.
  The Router's route (which now admits `addLiquidity`, `factory`, `quote` and the amount getters) is a
  prerequisite but cannot substitute for a routable pair writer.
  Measured, not assumed: with `messageBusHandlersByContract: { UniswapV2Pair: ['getReserves', 'mint'] }`, the
  contract compile still reports `{"handler":"mint","gate":"conditional-scalar-collection-event-settlement"}`
  (`narrow-fence-pair-mint.log`). The fence itself was narrowed and re-measured. It now admits a scalar state
  write that shares its arm with the row/event settlement: `KernelConditionalScalarRoute` drives
  `if (key > 0) { flags[key] = true; appends += 1; emit Appended(key); }` through the shipped sender on both
  branches (scalar 1 on the arm, 0 off it, row present on the arm and absent off it). The shape it still
  refuses is the complementary one, a scalar in one arm while a *sibling* arm settles a row or event.
  Measurement places the defect behind that fence. On an *unsplit* contract the complementary shape assembles and
  executes in every combination of arm split and result shape (same or complementary arm x void or returning
  handler; all four pass and `appends` settles to 1). The failure first attributed to complementarity reproduced
  with **no scalar write at all**: a route handler whose non-linear sorted batch writes two keys that share one
  proof planned `__internal__vmapBatchPredOut = -1` for the row that does not republish the predecessor (the other
  row named the one republished output), and the spent predecessor input then read `tx.outputs[-1]` —
  `Program attempted to read from an invalid transaction output index ... requested index: -1`. Compiling with
  `split: 'off'` failed identically, so it was never a size fragment: the six-instruction program is the
  shared-predecessor entry covenant.
  That binding is fixed: a non-linear batch now names the single republished predecessor output for every row that
  shares the proof, while a linear batch keeps `-1` there for its two-lane and rows-table verifiers, which test
  that sentinel explicitly. Regression: `packages/solidcash/test/e2e/KernelSharedBatchPredecessor.test.ts`
  (empty mapping and a pre-seeded entry outside the inserted pair's gap); it fails before the change with the
  exact `requested index: -1` error and passes after.
  The pair-specific `transferFrom` failure on that path is fixed. Bus-compiling the pair moves the allowance
  write to the one layout lane that is not a loop entry (the bus lowering marks both `balanceOf` lanes `inLoop`),
  so the planner pins that lane as an exact sorted-batch target. Its value came from the ternary's **preserve**
  arm: `evalComputedKey` cannot evaluate `binop:!=(map:allowance(…), TypeIntrospectionNode{max})`, and the planner
  treated an unevaluable condition as false. The published target then carried the old allowance (100 where the
  covenant computed 60), and preflight failed its own target check (`ip 353`,
  `OP_OUTPUTTOKENCOMMITMENT`/`OP_EQUALVERIFY`). An unevaluable condition now leaves the value to trace derivation,
  so the planner pins the lane only when the taken arm is known.
  With that change the parity project compiles the pair with its route enabled
  (`messageBusByContract: { UniswapV2Pair: true, SushiSwapPair: true }`) and the ERC20 suite, which drives the LP
  token through the pair, is 14/14; it was 13/14 before the change. The whole-project count with the route enabled
  is unchanged at 107/192.
  The bus-compiled pair measures 20,809 bytes against the 10,000-byte P2SH script limit (artifact
  `deployability.status = "over-budget"`), so the routed pair fits the parity harness while a mainnet deployment
  needs a compressed route.
  The pair's `_mintFee` still trips the fence (`kLast = 0` sits in an arm whose sibling mints `balanceOf[_feeTo]`
  and emits), so `mint` stays refused; the fence narrowing that admits same-arm settlement does not apply to that
  complementary arm. Bypassing the wide-event gate for `burn` instead lands on the same
  `conditional-scalar-collection-event-settlement` refusal. The fence state is unchanged, so the Router ceiling
  remains the 11 tests that never seed a pair (address getters, two deadline guards, four pure library-math
  cases) and the SushiRoll ceiling its 3 non-pair tests.
  Evidence: `matrix-two-branch-seed.log`, `sorted-insert-head.log`, `fence-complementary-detail.log`.
- **An emitting, value-returning helper with a guarded early return now inlines, so a fee-on-transfer token keeps
  its message-bus route.** `InlineReturningStateHelpers` folded only an early return adjacent to the tail
  (`if (c) return a; return b;`). `TestERC20._transfer` has `if (failTransfers) return false; … emit Transfer(…);
  return true;`; the helper stayed behind `OP_INVOKE`, route synthesis refused the retained helper (`Helper
  '_transfer' emits an event and is invoked internally as a value-returning subroutine, whose event would be
  dropped at its exit`), every route rung failed, and the token's artifact silently fell back to direct-only. The
  pass now rewrites the guarded shape into one result temp with the continuation nested in the guard's `else`
  (`T __rh_ret; pre; if (c) { __rh_ret = a; } else { rest; __rh_ret = b; } return __rh_ret;`), which preserves
  evaluation order, side effects and local scope. The helper then inlines and `TestERC20` synthesizes its route
  (`transfer`, `transferFrom` and the fused `transferAndBalance` are admitted). Pinned by
  `packages/solidc/test/EmittingEarlyReturnHelperRoute.test.ts`, which fails on the direct-only fallback when the
  normalization is removed. This is a route-synthesis fix, not a parity gain: a direct pair call that reaches a
  route-compiled token now co-spends the token's logical-identity anchor *after* the pair's own input block. The
  anchor must be recreated, and at its same absolute input index it lands on the pair's own LP `balanceOf`
  INSERT output; the transaction assembles, then fails the pair's anchor check (`BCH-2026 preflight failed at
  input 16: Program failed an OP_VERIFY`). Appending the anchor past the caller's band and filling the anchor
  witness by token category were both measured and do not resolve it, so the test token is opted out
  (`messageBusByContract.TestERC20: false`) and the mixed direct/route anchor layout is recorded here as the
  next blocker for composing `transferFrom` with `balanceOf`. Parity stays 107/192 (Factory 15, ERC20 14, Pair
  27, Libraries 37, Router 11, SushiRoll 3); native 28/28; Hardhat 192/192. Evidence:
  `round15-compile.log`, `round15-parity.log`, `round15-native.log`, `round15-hardhat.log`.
- **Same-transaction child creation is refused by the compiler, and the two candidate workarounds are measured
  closed.** The direct model already folds create-and-configure (`new C(); c.initialize(...)`) into the child's
  genesis, but only for a straight-line callee. A callee with control flow — the pair's `mint` — is refused by
  name: `Cannot call 'mint()' on 'c' in the transaction that deploys it with 'new Child(...)': the call would
  co-spend Child as an input, but this transaction creates it as an output, and a UTXO cannot be both created and
  spent in one transaction. … One-transaction deploy-then-configure folding for this call is in progress (see
  packages/solidc/docs/deploy-then-call-fold.md)`. The fold replays a straight-line body (a conditional scalar
  write included, pinned by `DeployThenCallFold.test.ts > folds a deterministic conditional child-state
  initializer`); a body that writes a mapping entry, reads another contract or emits is outside the replay
  (`DeployThenCallFold.test.ts > refuses a deploy-then-call whose callee …`, three cases). The pair's `mint` does
  all three, so no deploy fold reaches it. Replaying the real pair is measured: a probe
  `UniswapV2Pair p = new UniswapV2Pair(); p.mint(to)` is refused at that call, and the first statement the replay
  cannot take is `(uint112 _reserve0, uint112 _reserve1,) = getReserves();` (`TupleAssignmentNode`,
  `UniswapV2Pair.sol:131:8`); behind it the fold's vocabulary has no internal call, external read, mapping
  read/write, emit or loop (each refused on its own in `probe-fold5.log`). Compiling the same shape with
  `composition: 'framed'` raises the same refusal, and the framed master compiler refuses contract creation
  outright (`support.ts`: "contract creation needs the witness `CREATE` checks, which are not emitted yet").
  A framed body that also calls the fresh child is refused earlier, at the call: "the framed composition convention
  does not support a call on a contract created in the same transaction: the child's entry would need a spent
  master of its own". Refusing before the direct fold keeps a `foldedIntoDeploy` call node out of the body, which
  is what makes the framed stop-site table assert (`an execution with 0 call(s) closes 1 segment(s): got 2`) when
  the creation guard is lifted; pinned by `packages/solidc/test/framed/master/deploy-then-call-refusal.test.ts`,
  which also asserts the direct fold of the same source.
  Lifting the creation guard under a probe flag and skipping the folded nodes reaches master codegen, which stops at
  `the compiled master reserves its address slot more than once` (the child's address slot and the parent's are
  both reserved for one patch offset). The
  validator side already represents a minted callee (`state.masterSet` includes `mintedRef(output)` and V5 has a
  CREATE arm), but no script executes a minted master: the child's block comes from the transcript, so the entry's
  body would be trusted rather than verified. A CREATE frame therefore needs the child's entry inlined into a
  spent master's script, the same runtime state-transition subroutine the direct path needs. Evidence:
  `probe-framed-create.log` (stop-site assertion), `probe-framed-create-stage2.log` (address-slot reservation).
  Creating the pair top-level first does not help the Router either: `_addLiquidity` reads
  `IUniswapV2Pair.getReserves` and then calls `IUniswapV2Pair.mint`, and the builder refuses two distinct
  returning methods on one state owner without a compiled route (`Direct external calls to getReserves and mint
  share one state owner but both return values`). The pair's `mint` cannot join a kernel route (the fence above)
  and its `getReserves` reader is the scalar sibling the mixed-route gate refuses, so no authenticated
  multi-method route exists to model it. A fold that satisfied the Router would therefore have to inline the
  pair's first entry *including* its own external reads (`balanceOf` on both tokens) and decode another
  contract's state layout at compile time; an interface carries neither. The 63 Router and 13 SushiRoll failures
  stay blocked on that gap. Evidence: `precreated-router.log`, `fold-control-flow.log`.
- **A bare EOA value send has no modelled path, and a direct call to `receive()` publishes no hidden sender
  frame.** `Signer.sendTransaction` throws (`has no equivalent on Bitcoin Cash`), and the Router's `receive()`
  reads `msg.sender`, so a value-only call needs the same hidden `__internal__msgSenderCategory` /
  `__internal__msgSenderAnchorIdx` frame as any other direct entry. The receive ABI hard-codes `inputs: []` while
  the compiled body declares those parameters; calling `__receive({ value })` therefore fails the VM with
  `Tried to read from an invalid stack index. Current stack depth: 0; requested depth: 0`. Publishing the
  declared parameters (measured) still leaves the direct call with an empty unlocking stack, so the one Router
  case that sends plain Ether stays unmodelled. Evidence: `tmp-receive` probe; the compiler fix was reverted
  rather than shipped without a passing path.
- **A contract cannot call itself in one transaction.** The pair's `migrator.desiredLiquidity()` and the flash
  callback's reentrant `mint`/`burn`/`swap`/`skim`/`sync` target the primary contract, whose master UTXO is
  already an input. The migrator tests therefore stop in transitive discovery ("Circular A->B->A calls are not
  supported"), and the reentrancy tests cannot express the callback's revert as a co-spent call. Both are
  UTXO-geometry limits, not codegen defects.
- **A false pre-call guard removes the call block that positions the trailing keccak band.** For an expired
  deadline the Router's calls are provably unreachable, so the planner drops every external-call group. The
  build then stops with "stateful dynamic keccak256 loop: the front-region inputs ... do not fill the slots
  before the trailing side-car region". Keeping the calls instead would demand co-spends for CREATE2 pair
  targets, so the deadline paths remain blocked between the two limits.
- **Dormant large `bytes` state.** A factory that stores the pair creation code in `bytes` state (the old
  `TestFactory`) makes every spend recreate its chunks; the broadcast VM then fails `OP_VERIFY` even though
  the SDK preflight passed. `TestFactory` now inherits the production factory and stores nothing.

## Raw low-level calls without a callee

A raw `address.call(...)` does not propagate a callee failure: EVM answers `(success, returndata)` and the
caller's own `require` decides the outcome. Three shapes have no co-spendable callee covenant, and all three are
now modelled on the caller's frame instead of refused:

- a call to a contract that has no matching function (and no fallback) answers `(false, "")`;
- a call whose callee covenant would fail answers `(false, "")` (probed on the callee's own covenant with the
  caller's identity; unsupported probe shapes keep the ordinary co-spend path);
- a value-only call to a plain account answers `(true, "")` and produces the payment as a transfer output.

The compiler publishes `__internal__extcallMasterIdx<slot>` for every raw opaque call, so the SDK can state an
absent callee as a negative master index. The callsite binding and the epilogue identity/preservation checks are
skipped for that sentinel, and `__internal__externalReturnOutputIdx` states the answer: `-1` is `(true, "")` and
`-2` is `(false, "")`. A return coordinate below `-1` is read by an emitted branch that pushes
`success = false` and an empty blob, so the caller's `require` raises its own reason (for example
`TransferHelper: TRANSFER_FAILED`) rather than the callee's.

Regressions: `packages/solidcash/test/e2e/RawCallEmptyReturn.test.ts` adds the absent-selector and
reverting-callee cases through the shipped planner (deployment registration, no `withExternalCall`), and the
original TransferHelper block in `Libraries` covers the value-only account case. `Libraries` is 37/37;
`Factory` 15/15, `ERC20` 14/14, `Pair` 27/36, `Router` 11/74, `SushiRoll` 3/16 are unchanged. The BCH-native
suite is 28/28 and the original Hardhat suite 192/192.
