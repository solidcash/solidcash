# EffectiveAcceleration -> SolidCash drop-in: PROGRESS

Goal: run EA's `test/marketplace.test.ts` (a real Hardhat/ethers/TypeChain/OZ-upgrades suite, ~3357 lines,
66 tests) under `@solidcash/testing` with **zero edits to the project's test files** - only aliasing +
config + portbacks. This is the Hardhat-config-compatibility stress test.

## STATUS (2026-07-19): drop-in LOADS + all 66 tests RUN under our harness; failing at the CONTRACT layer.

`npx vitest run` -> `marketplace.test.ts (66 tests | 66 failed)`. Every failure is now the SAME contract-level
cause: `getContractFactory("Unicrow")` -> `no artifact named "Unicrow"` (the fixture deploys 6 Solidity
contracts we have not ported yet). i.e. **the entire Hardhat/ethers/chai harness surface resolved and executed
with no test edits** - the remaining work is porting the contracts, not the harness.

### What WORKS (validated by the run)
- **Aliasing (zero test edits)** - `vitest.config.ts` redirects the project's bare imports to our code:
  `hardhat`->`@solidcash/testing`, `chai`->`@solidcash/testing/chai`,
  `@nomicfoundation/hardhat-toolbox/network-helpers`->`@solidcash/testing/network-helpers`,
  side-effect plugins (`@nomicfoundation/hardhat-ethers|-chai-matchers`, `@openzeppelin/hardhat-upgrades`)->our
  modules, type-only (`hardhat/types`, `.../signers`) + `chai-subset`/`chai-as-promised`->stubs, and the
  app-dep `@noble/ciphers` subpaths->the installed v2 `.js` variants (+ a `randomBytes` shim). `../typechain-types`
  -> a local stub exporting the 4 `*__factory` values.
- **`import { ethers, config, upgrades } from 'hardhat'`** all resolve; `ethers.getSigners()` ran (config
  mnemonic + `m/44'/60'/0'/0` path), `loadFixture(deployContractsFixture)` ran, `getContractFactory("Name")`
  resolved-by-name and threw the expected "no artifact" (proving the name->artifact portback works).
- **Config-driven HRE** - `vitest.setup.ts` `await initHre()` loads `solidcash.config.ts` into the active HRE;
  the lazy `ethers`/`config`/`network` exports reflect it.

### Portbacks landed this session (in `@solidcash/testing` + `solidcash`)
1. `hre.ethers.getContractFactory("Name")` / `getContractAt("Name", addr)` / `deployContract("Name", ...)` -
   resolve a compiled artifact **by name** from `config.paths.artifacts` (`<dir>/<Name>.json` or
   `<dir>/<Name>.sol/<Name>.json`). (`loadArtifactByName` in hre.ts)
2. **Config-driven, lazy HRE exports** - `ethers`/`network`/`config`/`run`/`hre` are proxies over the active
   HRE singleton, so a setup-file `initHre()` (loading `solidcash.config.ts`) takes effect.
3. **hardhat-shaped `config`** - `config.networks.<name>.accounts.{mnemonic,path,count,initialIndex}`
   (`hardhatCompatConfig`), so `import { config } from 'hardhat'` reads the way ported suites expect.
4. **`getSigners` honours config mnemonic + derivation path** (`MockNetworkProvider.getSigners`/`getSigner`
   gained a `path` option; hre threads `config.accounts.path`).
5. **`containSubset`** matcher (chai-subset parity) in the chai shim.
6. **Per-contract artifact output (Hardhat layout)** - `solidcash compile` emits one `<Contract>.json`
   per contract, nested `artifacts/<sources>/<File>.scash/<Contract>.json` (mirrors Hardhat); `loadArtifactByName`
   resolves a contract by name across the tree. This is what makes `getContractFactory("MarketplaceV1")` match.

## DEPLOY-PATH findings (2026-07-19, from a minimal `Unicrow` stub)
Walking `getContractFactory("Unicrow").deploy(...)` surfaced + fixed two harness gaps, then hit the real one:
- FIXED: artifact-name resolution deduped the flat `<file>.json` vs nested `<Contract>.json` (same contract).
- FIXED (portback): `getContractFactory(name)` now defaults its runner to **signers[0]** (the deployer that
  funds the genesis), mirroring hardhat - previously it defaulted to the read-only provider.
- **NEXT PORTBACK / contract shape**: `ContractFactory.deploy` requires a STATEFUL contract ("Unicrow is not a
  stateful contract"). The EA contracts DO have state, so each must be a stateful `.scash` (state vars + genesis
  initial state); the fixture calls `.deploy(ctorArgs)` (Unicrow/FakeToken) and `upgrades.deployProxy(F, [args])`
  (Marketplace/MarketplaceData). Mapping the fixture's positional CONSTRUCTOR args -> our stateful genesis
  initial state is the first thing to wire per contract. `contracts-scash/Unicrow.scash` is the WIP starting point.

## CONTRACTS STUBBED + DEPLOY PROVEN (2026-07-19)
All 6 fixture contracts now exist as stateful `.scash` stubs under `contracts-scash/` (7 artifacts, all
name-resolvable): `Unicrow`/`UnicrowDispute`/`UnicrowArbitrator`/`UnicrowClaim` (address-storing), `FakeToken`
(ERC-20 stub), `MarketplaceV1` (`initialize` delegate + owner/version/data-addr state), `MarketplaceDataV1`.
A minimal `.deploy(...)` of a stateful stub SUCCEEDS end to end (mints a genesis data-NFT), validating the whole
factory->genesis path. Two more portbacks landed getting here:
- **number->bigint arg coercion** (`Argument.ts`): ethers accepts a JS `number` for uint/int; `deploy(...,69)` now
  works (safe-integer coercion). Commit 6ff3e5ba.
- **`Signer.address` sync property** (ethers-parity): ported suites read `signer.address` (was undefined; only
  `getAddress()` existed). Commit 89f85071.

## THE WALL: EVM address-identity model (2026-07-19, VERIFIED)
`deployContractsFixture` now runs into a **fundamental** EVM-vs-BCH gap in its CREATE-address precompute block
(`deployUnicrowSuite`, test lines 53-92), NOT a missing harness feature:
```
let transactionCount = await deployer.getNonce();                         // (1)
const UnicrowContractAddress = getCreateAddress({ from: deployer.address, nonce }); // (2)
```
- (1) `Signer.getNonce()` intentionally throws - BCH UTXO has no per-account nonce. A counter would be a fiction
  that feeds (2) a wrong address (fail-open); we keep it throwing (sound).
- (2) `getCreateAddress` is imported from the **real `ethers`** (NOT aliasable) and REQUIRES a 20-byte `0x` hex
  `from` - VERIFIED: `getCreateAddress({from: <cashaddr>})` throws "invalid address"; `{from: 0x+20byte}` works.
  Our `.address` is a CashAddress. So the precompute block cannot run drop-in.
- Even past (1)+(2), the admin tests assert `owner() == deployer.address`. `owner()` stores `msg.sender`, which
  our codegen emits as a **locking bytecode** (~25B P2PKH, via tx.origin/minting verification) - NOT a 20-byte
  address. There is **no single `.address` value** that satisfies both `getCreateAddress` (needs 0x+20B) and
  `owner()==.address` (needs the lockscript). This is the core identity-model conflict.

### The fork (needs a direction decision)
1. **Keep BCH-native** (`.address`=cashaddr, `msg.sender`=lockscript): sound; these specific EVM-isms
   (getCreateAddress/getNonce CREATE-prediction, ETH-address equality) can't run drop-in and would need per-fixture
   simplification (violates zero-edit for THOSE lines only).
2. **ETH-style `.address` (`0x`+pkh)**: unblocks getCreateAddress + the whole deploy phase (precompute addrs are
   only unused stub ctor-args here) + JS-level ETH-address equality. But diverges from `getAddress()` (cashaddr)
   and still needs (3) for `owner()==.address` to actually pass.
3. **Full pkh-based EVM identity under evmCompat**: `msg.sender` emits the 20-byte pkh, `.address`=`0x`+pkh,
   `address` type = 20-byte pkh end to end. Properly unblocks the fixture's identity model; BIG codegen change
   (msg.sender currently emits a lockscript; touches external calls, funding, C2 keys). Multi-session.

## BREAKTHROUGH (2026-07-19): deployContractsFixture COMPLETES; all 66 tests reach their bodies
The fixture went from "throws at `deployer.getNonce()` (test line 53)" to fully deploying all 6 contracts +
FakeToken + the transfers. **3 tests pass** (up from 0); the remaining 63 fail on contract-completeness (I only
stubbed a few functions - `transferOwnership`/`register*`/`publishJobPost`/... don't exist yet) and the
owner==msg.sender EVM-address wall - NOT harness gaps. Portbacks that got here (per the user's direction to
"fan out funding utxos" + "redirect getCreateAddress to our sdk-builder"):
- **On-demand genesis funding fan-out** (`ContractFactory.selectGenesisFundingUtxo`): the deploy step self-sends
  a fresh vout-0 coin when none exists, so one signer deploys any number of contracts (the fixture does ~9).
- **`getCreateAddress`/`getCreate2Address` redirect** (`@solidcash/testing/ethers-shim`, aliased as `ethers`):
  re-exports real ethers from its subpaths (no alias recursion) + returns a deterministic BCH p2sh address, since
  our identity is the token category (genesis txid + salt), not f(deployer, nonce). Real address = `.getAddress()`.
- **`getNonce()` -> 0** drop-in emulation in `hre.getSigners` (base Signer still throws; emulation is harness-only).
- **`ProxyContract.connect` re-wraps in `wrapDispatch`** so `proxy.connect(signer).implFn()` dispatches (was
  "not a function") - a real SDK bug fix (`upgrades.ts`).

### Two SDK bugs surfaced (in the proxy/delegatecall path), both now FIXED
1. FIXED: proxy `connect()` dropped implementation-function dispatch (above).
2. FIXED (was mis-diagnosed as "address write"): the real trigger is a **single-function proxy-impl**. The
   compiler INLINES a lone entry point with no 4-byte selector dispatch (GTT `emitFunctionDefinesAndDispatch`),
   but the proxy covenant verifies the impl's calldata begins with the function selector, so a selector-less
   single-function impl fails `OP_EQUALVERIFY` (`SolidCashProxy.scash:5`). Fix: a single **delegate** function on a
   proxy impl keeps the selector dispatch (compiler GTT + SDK `Contract.ts` unlock, symmetric); non-delegate
   single-function contracts still inline. LIBRARIES are excluded (`node.isLibraryContract` / `artifact.isLibrary`)
   - their own delegatecall path expects selector-less calldata, and including them regressed the branded-library
   master-gate (foreign consumer no longer rejected). MarketplaceDataV1 is back to its natural single-function form
   (`initialize` writes the address). Regression: compiler 2175/2175, LibraryDelegate 11/11, UpgradesDeployProxy 6/6.

### To push the pass count up (next, all contract-side)
Add the missing MarketplaceV1/MarketplaceDataV1 functions (pause/unpause/paused/version getters exist; need
transferOwnership/owner, register user/arbitrator, mece tags, publishJobPost + JobEvent emission). The owner and
msg.sender-authenticated paths stay blocked until the address-identity fork (above) is chosen.

## NEXT: port the contracts (simplification allowed). Build order (per the test's describe blocks):
The fixture `deployContractsFixture` (test lines 137-191) must deploy, so ALL of these need name-resolvable
artifacts under `contracts-scash/` -> `artifacts/`:
- `Unicrow`, `UnicrowDispute`, `UnicrowArbitrator`, `UnicrowClaim` - **stubs are fine** (addresses are only
  stored + a few `Pay`/`Release`/`Challenge`/`Arbitrated` events asserted in escrow tests, which come last).
- `FakeToken` - a minimal ERC-20 (`transfer`/`approve`/`balanceOf` + `constructor(name,symbol)`); the fixture
  transfers 1000e18 to user1/user2 and they `approve` the marketplace.
- `MarketplaceV1` - deploy via `upgrades.deployProxy(Factory, [unicrow, unicrowDispute, unicrowArbitrator,
  treasury, fee])`. For the FIRST describe ("admin", 8 tests) only need: owner/`transferOwnership`/
  `OwnershipTransferred`, `pause`/`unpause`/`paused`/`Paused`/`Unpaused`, `version`/`setVersion`/
  `VersionChanged`, `initialize` (revert-on-reinit -> `InvalidInitialization`), `setMarketplaceDataAddress`.
- `MarketplaceDataV1` - deploy via `upgrades.deployProxy(Factory, [marketplace])`. Needed from the SECOND
  describe on: user/arbitrator registry + `JobEvent` emission + `getJob`/`getJobs`/`getEvents`.

Then, per describe block: admin -> register user -> register arbitrator -> mece tags -> job posting
(`JobEvent` fn-predicate `.withArgs`, `decodeJobCreatedEvent` round-trip) -> escrow state machine (Unicrow +
`signMessage`/ECDSA + encryption) last.

## Known non-harness blockers (documented, not harness gaps)
- **App-dep version skew**: EA pins `@noble/ciphers@^0.5.3` (subpaths `/chacha`,`/crypto`,`/utils`); viem pulled
  `@noble/ciphers@2.2.0` (`.js` subpaths, `randomBytes` moved). Worked around with vitest aliases + a
  `randomBytes` shim. `viem` is installed at the monorepo root.
- **BCH vs EVM semantics**: `getSigners()` returns BCH cashaddr signers (not 0x addresses); ECDSA `signMessage`
  and Ethereum-address equality in the escrow/takeJob tests will need contract-side simplification. `getBytes`/
  `keccak256`/`AbiCoder`/`getCreateAddress` come from real `ethers` (chain-agnostic, work as-is).
- **`revertedWithCustomError`** here only uses the `{interface: Factory.createInterface()}` form; our matcher is
  best-effort (matches the error name in the revert message) - fine for `InvalidInitialization` etc.
- **IPFS** (`publishToIpfs`/`getFromIpfs`) - the integration test is annotated "requires ipfs service running".

## How to run
```
cd examples/effectiveacceleration
npx vitest run          # marketplace.test.ts, 66 tests
```
Config: `solidcash.config.ts` (EA mnemonic + ETH path), `vitest.config.ts` (aliases), `vitest.setup.ts`
(initHre + matchers), `typechain-types/` + `stubs/` (drop-in shims).
