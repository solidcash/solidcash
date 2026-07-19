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
