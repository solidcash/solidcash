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

Result: **83 passed, 109 failed (192 total)**. See the per-suite table under "Original EVM suite parity".

## Original EVM suite parity

`.parity-project` compiles the original SushiSwap V2 contracts and runs the original six test files under
SolidHat. Latest results (`vitest run --config vitest.solidhat.config.ts test`):

| Suite | Passing / Total | Remaining blocker |
|---|---|---|
| `UniswapV2Factory` | 15 / 15 | — |
| `UniswapV2ERC20` | 14 / 14 | — |
| `UniswapV2Pair` | 26 / 36 | flash/reentrancy circular calls (6); migrator circular call (3); protocol-fee entry lane (1) |
| `Libraries` | 21 / 37 | CREATE2-identity targets (5); TransferHelper raw-return decoding and absent-selector calls (11); ETH value (2) |
| `UniswapV2Router02` | 4 / 74 | a Router-built transaction must deploy the pair through the factory (nested child deploy; the probe leaves `extcallMasterIdx -1`); CREATE2-identity pair targets; `msg.value`/WETH satoshi model |
| `SushiRoll` | 3 / 16 | factory participant authority in atomic composition, CREATE2-identity pair targets, ETH value |
| **Total** | **83 / 192** | |

The original EVM Hardhat suite in `/Code/sushi-port` remains untouched.

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
  source; the SDK resolves the producer's authenticated value before hashing the slot. This is the groundwork
  for the protocol-fee recipient entry, which still needs an inactive-lane batch path when the fee is zero.
- A failing outlined library body is attributed from the trace's executed instructions even when the failing
  step exposes no control stack, so a `require` inside an inlined library (SafeMath) reports its message.
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

### Remaining architectural gaps (captured failures)

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
