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
node ../packages/testing/dist/cli.js compile   # 30 sources -> 41 artifacts
node ../packages/testing/dist/cli.js test
```

Result: **29 passed, 163 failed (192 total)**.

| Suite | Passed / total | Dominant blocker |
| --- | ---: | --- |
| `UniswapV2Factory` | 11 / 15 | `createPair` child-address covenant |
| `UniswapV2ERC20` | 0 / 14 | `createPair`, then `pair.mint` |
| `UniswapV2Pair` | 0 / 36 | `createPair`, then `mint`/`burn` |
| `Libraries` | 15 / 37 | `TestFactory.createPair`, EVM `pairFor` |
| `SushiRoll` | 0 / 16 | ETH transfer / roll semantics |
| `UniswapV2Router02` | 3 / 74 | `createPair`, ETH overloads, value container |

Harness parity added for this run: `artifacts.readArtifact` returns Hardhat-shaped hex bytecode, and
`ethers.solidityPacked` accepts CashAddresses. Those fixes moved the Factory suite from 10/15 to 11/15.

The two core blockers are the factory's unpatched constructor placeholder (see above) and the pair's
`mint`/`burn` state derivation, which reports an identity-output collision when the pair co-spends its two
token covenants. Router and SushiRoll additionally need an ETH/value model that BCH does not have.

## Original EVM suite parity

`.parity-project` compiles the original SushiSwap V2 contracts and runs the original six test files under
SolidHat. Latest results (`vitest run --config vitest.solidhat.config.ts test`):

| Suite | Passing / Total | Remaining blocker |
|---|---|---|
| `UniswapV2Factory` | 15 / 15 | — |
| `UniswapV2ERC20` | 14 / 14 | — |
| `UniswapV2Pair` | 26 / 36 | flash/reentrancy circular calls (6); migrator circular call (3); protocol-fee entry lane (1) |
| `Libraries` | 20 / 37 | TransferHelper raw-return decoding (9); `TestFactory` runtime-code `create2` blocks `pairFor`/`getReserves`/`getAmounts*` (6); ETH value (2) |
| `UniswapV2Router02` | 4 / 74 | `TestFactory` runtime-code `create2` blocks pair creation; then `msg.value`/WETH satoshi model |
| `SushiRoll` | 0 / 16 | same ETH/value family; setup approves fail preflight |
| **Total** | **79 / 192** | |

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
- `address(uint160(uint256(x)))` and every integer-to-address cast under `evmCompat` now produce exactly the
  low 20 bytes of the big-endian word (the raw Solidity identity), while `address(0)` stays the empty value.
  A short numeric identity previously took the P2PKH fallback and aborted at `OP_SPLIT`.
- The test-side identity is now the same address value the SDK feeds to the covenant:
  `cashAddressToEthHex` resolves a registered deployment's value locking bytecode instead of decoding the
  CashAddress string (the logical and physical locks can differ), and an unpredicted `getCreate2Address`
  answers the EVM `keccak256(0xff ++ factory ++ salt ++ initCodeHash)[12:]` identity instead of an arbitrary
  placeholder.

### Remaining architectural gaps (captured failures)

- **`create2` with a runtime code value.** `TestFactory.createPair` stores the pair creation code in a
  `bytes` state variable and passes it to Yul `create2`. The compiler cannot publish a `deployTarget` for a
  template that is only known at runtime, so no child is deployed and the returned address is empty; the
  `PairCreated` address binding then fails `OP_VERIFY` at ip 3870 of `createPair`. The real
  `UniswapV2Factory` (compile-time `type(UniswapV2Pair).creationCode`) passes all 15 tests, so the failure is
  specific to the runtime-code form used by the shared test factory.
- **`UniswapV2Library.pairFor` versus a BCH child address.** `pairFor` computes the EVM CREATE2 identity from
  the token pair, while a BCH pair's address commits to its funding category, which the covenant cannot know
  before creation. The pure hash now matches the EVM expectation, but the value the factory writes into
  `getPair` is the deployed child, so the pre-creation assertion and the post-creation assertion cannot both
  hold without a registry read (the native port's approach). The Router depends on this same value for
  `mint`/`transferFrom`, so its liquidity paths inherit the gap.
- **Ether value.** The original tests pass wei (`parseEther("1")`) as `msg.value`; BCH satoshis cannot carry
  those magnitudes, and the contracts compare `msg.value` against wei-denominated token amounts. A value model
  must scale both sides or the Router/SushiRoll ETH paths cannot be expressed.
