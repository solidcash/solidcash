# BchNativeWrapper: an ERC-20 over an existing CashTokens category (design)

Kind: design, implemented on `feat/bch-native-wrapper` over master `c2ede0be8` (`667a07d70`, `f15afb05b`,
`e72f00338`, `7b5e6bbdf`), which fast-forwards master; not merged yet. Written 2026-10-21 against master `063f32514` and revised three times the same
day with the user's answers (sections 11 and 12). The decisions are D41 to D45 in `docs/framed/DECISIONS.md`, which
wins over this file.

Sources: `packages/solidcash/contracts/` (ERC20, BchNative and its layers), `docs/bcmr/DESIGN.md` (section 6),
`packages/solidc/docs/native-erc20.md` (supply model, reserve container), `docs/framed/AUDIT_MSG_SENDER.md` (F12) and
OpenZeppelin Contracts' `ERC20Wrapper` (`token/ERC20/extensions/ERC20Wrapper.sol`). The sizes are measured on the
implementation with `messageBus: false`; section 10 lists the tests and their one mocknet run.

## 1. Summary

BchNative gives a ledger token a bearer form: fungible CashTokens of a category X, which the deployment creates beside
the contract's category C (`nativeToken.funding`) and premints into the reserve or mints to holders. A wrapper works the
other way round. X already exists, minted by someone else, and the token is an ERC-20 ledger over it. Units enter only
by `wrap`, against tokens a holder moves into the reserve, and leave only by `unwrap`. The deployment creates no
category and mints nothing. This is OpenZeppelin's `ERC20Wrapper` for CashTokens.

BchNative's boundary already works for any category. X is a constructor argument, kept as the immutable
`_nativeCategory` that keys the reserve container (D33). The first `wrap` creates the container, and
`TetherNativeToken.test.ts` already deploys against a category its deployment did not create. The design adds:

1. `BchNativeWrapper.scash`, a complete ERC-20 whose ledger is private to it, so that nothing but its own `wrap` and
   `unwrap` can change the supply (section 2). It also has OZ's `underlying()` view.
2. A scale hook in BchNative, which BchNativeMultiplier overrides instead of overriding `wrap` and `unwrap`, so that the
   creator's scaling composes with a boundary the wrapper keeps final (3.2).
3. `examples/MinimalWrappedToken.scash`.
4. A deploy option, `nativeToken.category`, that names the existing category, mints nothing, and checks the contract
   before anything is broadcast (section 4).
5. A BCMR publication for C alone that names X (section 5).

Name, symbol, decimals and scaling belong to the token's creator (3.4). Neither the extension nor the SDK assumes
anything about them.

## 2. An honest totalSupply

`totalSupply()` is the number of wrapped units in existence. Each is backed in the reserve by one native unit, or by
one native unit per `multiplier` units when the creator inherits BchNativeMultiplier. It is not the native token's
supply. That supply was fixed in X's genesis, most of it circulates outside the wrapper, and no contract can read it on
chain.

The wrapper keeps the ledger, `_balances`, `_allowances` and `_totalSupply`, `private`, with the functions that write
it. The compiler refuses a derived contract that touches private state, and it refuses to override a function its
parent did not mark `virtual`. So:

- Only the wrapper's own code writes the ledger. Transfers move existing units, and only `wrap` and `unwrap` change the
  supply.
- `wrap` and `unwrap` are final. `wrap` credits exactly what the call proves its reserve grew by, and `unwrap` debits
  before it pays out.
- `totalSupply()`, `balanceOf()`, `allowance()` and `underlying()` are final, so a derived contract cannot make them
  answer anything but the ledger.
- BchNative's credit and debit hooks fail (`require(false)`), so BchNative's own boundary, reached through a qualified
  `BchNative.wrap(...)` call, can credit nothing.
- `transfer`, `approve` and `transferFrom` stay `virtual` for policy. An override can refuse a transfer or route
  `msg.sender`'s own units elsewhere through `super`, but it cannot reach another holder's balance or the supply.

`BchNativeWrapper.test.ts` compiles each refusal: writing `_balances` or `_totalSupply` from a derived contract, and
overriding `totalSupply()`, `wrap`, the failing credit hook or the multiplier's scale. A `transfer` override that calls
`super.transfer` compiles.

What remains open:

- **A custom scale.** A creator who scales without BchNativeMultiplier overrides `_nativeAmount`, and that override
  decides how many native units a ledger amount needs. That is the creator's responsibility. BchNativeMultiplier's
  override is final and refuses an amount it cannot convert exactly.
- **A hand-built genesis.** Constructors are not enforced on chain (security audit F12), so whoever builds the genesis
  without the SDK can give it any balances. It can be checked off chain by deriving the genesis from the artifact and
  the constructor arguments, and comparing. A factory contract, whose script checks its children's genesis, would make
  the check binding.
- **Lifecycle entries.** `upgrade` replaces the code, and `selfdestruct` can spend the reserve. The SDK does not
  refuse them (D43): the supply is then only as honest as whoever can call them.
- **Events.** A derived contract can emit the inherited `Transfer` event, so a supply counted from events is only as
  honest as the concrete contract. `totalSupply()` cannot be faked.

## 3. The contracts

### 3.1 BchNativeWrapper

```solidity
abstract contract BchNativeWrapper is BchNative {
    mapping(address account => uint256) private _balances;
    mapping(address account => mapping(address spender => uint256)) private _allowances;
    private uint256 _totalSupply;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(bytes32 underlying_) BchNative(underlying_) { }

    function underlying() public view returns (bytes32) { return this._nativeCategory; }
    function totalSupply() public view returns (uint256) { return this._totalSupply; }
    // balanceOf, allowance: as ERC20.scash.
    // transfer, approve, transferFrom (virtual), and the private _transfer, _update and _spendAllowance: ERC20.scash's
    // code with the helpers private.

    function _nativeCredit(address, uint256) internal override { require(false); }
    function _nativeDebit(address, uint256) internal override { require(false); }

    // BchNative's wrap and unwrap, final, writing the private ledger where BchNative calls the hooks.
    function wrap(int amount) override { ... }
    function unwrap(address to, int amount) override { ... }
}
```

- The ledger code is ERC20.scash's, so the OZ v5.6.1 semantics carry over: the `uint256.max` infinite allowance, the
  zero-address checks, and the events. Mirroring it matters for size: a first, differently shaped ledger came out
  372 B larger.
- The category is in the byte order `this.tokens[...]` takes, which is the order wallets print. A deployer passes
  `hexToBin(categoryHex)`, and `underlying()` answers the same bytes.
- The surface stays `wrap`/`unwrap`, BchNative's one surface since the 2026-10-19 rename.

### 3.2 Changes to BchNative and BchNativeMultiplier

BchNative applies a conversion hook at both ends of the boundary:

```solidity
// The native amount that moves across the reserve for a ledger amount; a scaling layer overrides it.
function _nativeAmount(int amount) internal view virtual returns (int) { return amount; }
```

`wrap` requires the reserve to grow by exactly `_nativeAmount(amount)` (D44), and `unwrap` pays `_nativeAmount(amount)`.
Both still credit and debit `amount` ledger units. BchNativeMultiplier stops overriding `wrap` and `unwrap` and overrides the hook
alone, final:

```solidity
function _nativeAmount(int amount) internal view override returns (int) {
    require(amount % this._nativeMultiplier == 0);
    return amount / this._nativeMultiplier;
}
```

Today BchNativeMultiplier overrides `wrap` and `unwrap` themselves. A wrapper that keeps those final cannot inherit it:
the compiler reports a diamond conflict on `wrap`.

### 3.3 Size

Measured on `13712fb9b` and again on `c2ede0be8`, with `messageBus: false`:

| Contract | Before | Implemented |
| --- | --- | --- |
| `MinimalNativeToken` (`ERC20, BchNative`) | 7,374 | 7,395 |
| `MultiplierToken` (`ERC20, BchNative, BchNativeMultiplier(100)`) | 7,514 | 7,513 |
| `MinimalWrappedToken` (`BchNativeWrapper`) | | 7,465 |
| `BchNativeWrapper, BchNativeMultiplier(100)` | | 7,594 |
| `BchNativeWrapper, BchNativeMultiplier(100), ERC20Metadata` with `decimals()` | | 8,701 |

The hook adds 22 B to MinimalNativeToken and exact growth takes 1 B off. `wrap` and `unwrap` both call the hook, so
the compiler defines it as a shared function, and the one more function renumbers the compiler helpers' ids; at
`063f32514` the same hook cost 14 B. Every BchNative token that does not scale pays it (D42). The private state and the
failing hooks cost nothing.

### 3.4 What the creator decides

- **Name, symbol and decimals.** The extension carries no metadata. The creator inherits ERC20Metadata and overrides
  `decimals()`, or writes the views.
- **Scaling.** The creator inherits BchNativeMultiplier, overrides `_nativeAmount`, or does without. Neither the
  extension nor the SDK assumes any relation between the ledger's decimals and the underlying's.
- **Policy.** The creator overrides `transfer`, `approve` and `transferFrom` (calling `super`) and BchNative's
  `_nativeCanWrap` and `_nativeCanUnwrap`. The emit hooks stay virtual too. BlackList composes.

### 3.5 What does not compose

- **BchNativeQuarantine.** Its `claimDeposit` credits through `_nativeCredit`, which fails here.
- **Third-party ledgers** (the npm OZ ERC20, Tether). They keep their own ledger, inherit BchNative, and deploy with the
  same `nativeToken.category`. Their supply is then only as honest as their ledger.
- **The framed convention.** An ERC20-shaped ledger does not split: under `split: 'func'` its `transfer` is an
  indivisible closure of 13,236 B, just as MinimalNativeToken's is today. A framed wrapper keeps `FramedNativeToken`'s
  two-frame ledger and inherits BchNative, with the same caveat as a third-party ledger.

### 3.6 The example

```solidity
contract MinimalWrappedToken() is BchNativeWrapper {
    constructor(bytes32 underlying_) BchNativeWrapper(underlying_) { }
}
```

## 4. Deployment

### 4.1 Genesis

```text
in   0     funding coin (vout 0)          C = its txid
out  0     identity output of C
out  1     BCMR publication, when requested
out  2..   masters, data NFTs, mapping heads, ...; change last
```

No input or output carries X. The first `wrap` creates the reserve container, as it does today for a token whose
genesis minted its supply to holders.

### 4.2 The option

```ts
nativeToken?: {
  funding?: Utxo; funder?: Unlocker; reserve?: bigint; bearer?: { amount: bigint; to: string }; scale?: bigint;
  /** An existing category the token wraps: the genesis creates no category and mints nothing. */
  category?: string;
};
```

- `category` is 64 hex characters, as wallets print it.
- It is refused beside `funding`, which creates a category, and beside `reserve` or `bearer`, because all of an
  existing category's fungible amounts were created in its genesis.
- `scale` is the creator's statement of their multiplier, published in the BCMR extension (section 5). Today
  `nativeToken.scale` must be a power of ten, because the SDK derives the bearer token's BCMR decimals from it. A
  wrapper publishes no bearer identity, so neither that rule nor the 18-decimal warning applies.
- Every entry point reaches `prepareMetadata` through `deployStatefulContract` (`src/stateful/sc-deploy.ts`):
  `StatefulContract.deploy`, `ContractFactory`, `SplitContractBundle` (the root's genesis) and the framed deploy. One
  change covers them all.

### 4.3 Checks before broadcasting

The checks run on the probe genesis that `probeTokenFacts` already deploys for a premint, through a broadcast-holding
overlay (BCMR DESIGN 6.4).

1. The category in the probe's state, read through the variable the artifact publishes as the container key
   (`nativeCategoryStateVariable`), equals `category`. This catches a wrong or byte-reversed constructor argument. An
   artifact that keys no container by state is refused, because it would wrap nothing.
2. When the ABI carries EIP-20 `totalSupply()`, it reads 0 on the probe. An unreadable `totalSupply()` is refused, as
   it is for a premint.
3. `category` is neither C nor the AuthGuard AuthKey category. An existing category cannot be either, because its
   vout-0 coin is spent, but a stated category that does not exist yet can.

A wrapper with an `upgrade` or `selfdestruct` entry deploys like any other contract (D43).

Not checked: name, symbol, decimals, the scale, or that X exists. A wrapper over a category nobody holds never wraps
anything. A wrapper over a txid whose vout-0 coin is unspent wraps whatever that coin's eventual genesis mints, which
is the deployer's risk.

### 4.4 Without the option

A wrapper deployed without `nativeToken` still works, as `TetherNativeToken.test.ts` shows, but it skips the checks.
The SDK cannot infer the intent from the contract, because it does not select behaviour by name (AGENTS.md).

## 5. BCMR

The wrapper owns C's identity and nothing else. X's identity belongs to X's issuer. Its authchain starts at X's
authbase, which this genesis does not spend (BCMR R1, R2), so a registry published here cannot speak for X, and it does
not try.

- `identities` holds C alone. Its snapshot carries what the contract and the options state, as for any contract: the
  name, and `token.symbol` and `token.decimals` exactly as `symbol()` and `decimals()` answer. No native scale is
  applied, because C has no bearer unit. BCMR's own symbol rule (R5) applies as it does to every publication.
- The snapshot's `solidcash-native-token` extension names the underlying and the reserve:
  `{ underlying, reserveLockingBytecode, scale, ledgerSupply: 'totalSupply()' }`. The reserve lock is the (C, X)
  container lock, known before the first `wrap` puts a coin there. With it, anyone can compare the reserve with the
  supply at any time (section 6).

## 6. What can diverge

| Value | Can drift from | Cause | Status |
| --- | --- | --- | --- |
| `totalSupply()` | the reserve, which ends up larger | X paid to the reserve container's address outside a `wrap` | harmless, since the excess backs no units; `wrap` requires exact growth (D44), so a deposit cannot overpay |
| `totalSupply()` | the reserve, which ends up smaller | a hand-built genesis, a lifecycle entry, or a custom scale (section 2) | the SDK refuses the first two in its own deployments; an explorer detects any of them from the extension |
| `balanceOf(a)` | what `a` can unwrap | with a multiplier m, wrap and unwrap take multiples of m but transfers do not, so up to m - 1 units per holder cannot leave | follows from the creator's scaling |
| `this.tokens[X].tokenAmount` in a call | the whole reserve | a call sees only the containers it spends (D40) | never read it as the total |
| the published reserve lock | where the reserve sits | an upgrade moves every container coin to a lock bound to the new master (D45) | a later publication names the new lock |
| a supply counted from `Transfer` events | `totalSupply()` | a derived contract can emit the inherited event | read `totalSupply()` |
| `name()`, `symbol()`, `decimals()` | the underlying's BCMR | they are the creator's, and X's issuer can change theirs | by design |

The sum of `balanceOf` equals `totalSupply()` by construction; only a hand-built genesis could break it.
`allowance()` and `underlying()` cannot drift.

## 7. Conventions

- Message bus: a route carries a state-keyed container under a fixed key (D36).
- Split: the option rides the root's genesis, whose category keys the container. `TetherNativeToken.test.ts` wraps
  through `usdt.root.getTokenContainerAddress`.
- Framed: see 3.5. The census refuses fungible amounts of C only (`docs/framed/SPEC_FRAMED_TRANSACTION.md`, S2), and X
  is never C.

## 8. Properties particular to an existing category

- X may have a live minting NFT, held by its issuer. It mints NFTs of X, never fungible amounts, and it is not a
  master: the container accepts only the contract's own lock holding a minting NFT of C (`bindMintingAuthorityLock`,
  `masterCategoryRead` in `buildTokenContainerCovenantScript`). A deposit that carries an NFT of X credits nothing for
  it.
- Several wrappers of one X can coexist, each with its own C and its own container lock. A wrapper is identified by C.

## 9. Alternatives considered

- **Guards on ERC20.scash** (the second draft): the wrapper inherits ERC20.scash and overrides `_mint` and `_burn` with
  `require(false)`, at no cost. But a qualified call, `ERC20._mint(...)`, still reaches the original (the prototype
  compiles it to the ledger write), and the ledger stays `internal`, so a derived contract can write it directly.
- **Making ERC20.scash's own ledger private.** That is OZ's own visibility, but ERC20.scash must keep an internal `_mint`
  for ordinary tokens, and a wrapper built on it inherits that mint. Every token that writes the ledger directly would
  also move to `_mint` and `_burn` (MinimalNativeToken +11 B).
- **A compiler rule that a final override seals the base implementation against qualified calls.** It would make the
  guards binding, but it departs from Solidity, where `Base.f()` always reaches the base.
- **An on-chain backing check**, `totalSupply() <= reserve x scale` at every boundary call. A call cannot see the whole
  reserve, and a failing check would freeze every `wrap` and `unwrap` instead of preventing the mint.

## 10. Implementation and tests

| Part | Code | Tests |
| --- | --- | --- |
| The extension and the example | `contracts/BchNativeWrapper.scash`, `contracts/examples/MinimalWrappedToken.scash` | `test/e2e/BchNativeWrapper.test.ts` (new) |
| The scale hook and exact growth | `contracts/BchNative.scash`, `contracts/BchNativeMultiplier.scash`, `contracts/BchNativeQuarantine.scash` | `MinimalNativeToken.test.ts` (re-pinned), `BchNativeMultiplier.test.ts` |
| `nativeToken.category` and its checks | `src/bcmr/deployment.ts` (`wrappedCategory`, `prepareMetadata`); `src/stateful/sc-deploy.ts` (the reserve lock for the extension) | the new file |
| The registry for C alone | `src/bcmr/deployment.ts` | the new file |
| Every container coin migrates (D45) | `packages/solidc/src/generation/GenerateTargetTraversal.ts` (`emitUpgradeTokenBandCount` and the indices after the band), `src/stateful/sc-upgrade.ts` | `TokenContainerUpgradeMigration.test.ts` (three new cases) |
| The `virtual` warning (D45) | `packages/solidc/src/semantic/SymbolTableTraversal.ts` | `ImportedDiagnosticPositionX93.test.ts` (its probe dropped) |
| Docs | `contracts/README.md`, `docs/bcmr/DESIGN.md` 6.8, `website/docs/guides/deployment.md`, `docs/design/CONCEPT_VALIDATION.md` | |

Paths are under `packages/solidcash/` unless stated. Each test file ran once on mocknet: the new file 6/6,
`MinimalNativeToken` and `BchNativeMultiplier` 8/8, X93 5/5, and `TokenContainerUpgradeMigration` 5/6: its sixth case,
the reserve over two coins, built and broadcast its upgrade, then failed on an assertion that read an address string as
bytes. With the assertion fixed, that title passed when run alone (6/6). The new file covers:

1. The size budget and ABI of `MinimalWrappedToken`.
2. The seal: a derived contract that writes the ledger, overrides `totalSupply()`, `wrap` or the multiplier's scale does
   not compile. A qualified `BchNative.wrap(...)` call compiles, and the VM refuses it.
3. An issuer creates X in a genesis of its own, minting to alice and bob, before the wrapper exists. The wrapper deploys
   with `nativeToken: { category: X }`. Its genesis has no X input or output, and `underlying()` answers X. Bob wraps
   600, which creates the container, and transfers 250 to alice on the ledger. Alice unwraps 250 back to bearer X.
   `totalSupply()` is then 350, and so is the reserve. A deposit of 101 does not wrap 100, and then wraps 101.
4. A wrapper with `BchNativeMultiplier(100)` credits 500 units for 5 native units and refuses 550.
5. Refusals before broadcasting: `category` beside `funding`, `reserve` or `bearer`, malformed, equal to C, or with a
   scale of 0; a constructor argument other than `category`, the byte-reversed one included; a genesis with a supply;
   a contract that keys no reserve by state.
6. The registry: C's identity only, with the contract's own fields and the extension.

## 11. Decisions taken

By the user, 2026-10-21:

- "override _mint with an require(false)": the failing hooks of section 2. On ERC20.scash's `_mint` the guard does not
  hold against `ERC20._mint(...)`, which led to the private ledger.
- "name, symbol and decimals should be defined by the contract creator. they are responsible for scaling or inheriting
  from scaling contract. we do not need to make any assumptions and do customizations on our side": the extension
  carries no metadata, the SDK checks no metadata and no scale, and BchNativeMultiplier composes (3.2).
- "we should be honest about the totalSupply as much as possible": sections 2 and 6.
- "you are allowed to modify the base/abstract contracts too": the scale hook in BchNative and BchNativeMultiplier.

Kept from the first draft without objection: `underlying()` (75 B) and the option's name, `nativeToken.category`.

## 12. Answers to the open questions

By the user, 2026-10-21, on the four questions revision 3 left open:

1. "1. yes.": the hook's cost is accepted (D42).
2. "2. no. should be general.": the SDK refuses no lifecycle entry in a wrapper deployment (D43).
3. "3. same as on solidity/evm": `wrap` requires exact growth, as do BchNative's own `wrap` and BchNativeQuarantine's
   `deposit` (D44). The framed path compiles the same comparison, and the message bus admits one growth-reading row per
   batch (D36), so neither needed a change.
4. "4. fix": both findings are fixed (D45). The first was misstated here: in the direct convention every call spends
   the reserve's coin and re-creates it, so deposits do not add coins; framed containers (D40) bind no master and do not
   migrate. A direct reserve spreads over several coins only when tokens are paid to its lock, after which a call may
   merge a deposit into that coin. The finding was worse than stated, though: `wrap` and `unwrap` are two access sites
   of one category, so the SDK named the same coin twice, and a BchNative token with an `upgrade` entry could not
   upgrade at all.
