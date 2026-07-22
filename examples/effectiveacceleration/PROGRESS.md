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
   resolve a compiled artifact **by name** from `config.paths.artifacts/solidcash` (`<dir>/<Name>.json` or
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

### To push the pass count up (next) - PROXY GAPS mapped 2026-07-19
Isolated (minimal repros) what the admin block needs beyond bug #2:
- **events in a delegate function fail the proxy delegatecall** (KEY BLOCKER): `emit E(..)` inside a `delegate`
  function reverts at input 2 (the impl) `ip=89 OP_2DROP`-region - the event's extra OP_RETURN output isn't
  accounted for by the impl's auto-derivation covenant when the state transition runs via delegatecall. Every
  admin test emits (Paused/Unpaused/OwnershipTransferred/VersionChanged), so this blocks nearly all of them.
  Deep covenant fix (delegatecall + event output + auto-derivation), likely in the StatefulContract/GTT WIP path.
- **state getters on the proxy handle: FIXED** (commit 7d660444) - `wrapDispatch` now routes a bare state-var
  name to the underlying proxy contract's getter, so `marketplace.version()` / `marketplace.paused()` read on the
  handle (Solidity-parity). Verified: proxy.version()/paused() + a delegate setter round-trip (setVersion(25) ->
  version() == 25n). (Minor open: `deployProxy(..., { initializer:false, initialState })` seeds 0, not the given
  value - the default-proxy genesis seed path; the setter path works so it is not blocking.)
- **owner == msg.sender EVM-address wall** (the 3-way fork above): owner/transferOwnership + every
  `.withArgs(<address>)` event assertion need the address-identity decision.
Confirmed working through the proxy: a `delegate` setter WITHOUT emit + state read via `proxy.proxy.<var>()`.
So the achievable order is: fix events-in-delegatecall -> expose proxy getters -> pick the address model ->
add register/job functions.

## 2026-07-20 - deeper probing: the address model bottoms out at msg.sender mechanics
- **`msg.sender` as a stored/compared value fails at the covenant level even in a DIRECT call** (`this.owner =
  msg.sender` reverts at the `msg.sender` statement, `O.scash:1`, both `address` and `bytes` typed). msg.sender is
  wired for C2 mapping KEYS (`bal[msg.sender]` in transfer fns), not for being stored/returned. The SDK defaults
  `_msgSenderCategory` to 32 zeros (-> the tx.origin branch), but the tx.origin resolution reverts for a plain
  signer call. Root is in `emitMsgSender`/`emitTxOrigin` (GTT) + the msg.sender provisioning (StatefulContract.ts)
  = the user's active WIP. So `owner()==deployer.address` (and every admin/registry/job path keyed by the caller)
  needs this msg.sender work FIRST - it's the dominant EA blocker, not just admin.
- **Hypothesis for the address model (untested, blocked by the above):** type identity state as `address`, store
  the msg.sender lockscript, and let the SDK getter/event-decoder turn the P2PKH lockscript back into the CashAddr
  - which equals `signer.getAddress()`. This would give `owner()==deployer.address` WITHOUT changing msg.sender to
  emit a 20-byte pkh (much less invasive than the full ETH-address model). Verify once msg.sender-as-value works.
- **Two clean portbacks landed while probing** (not blocked): proxy handle state getters (7d660444, above) and
  **initialState accepts JS numbers** (487299f3) - `deploy({ initialState:{ count: 1 } })` coerces like ethers
  (was bigint-only; mirrors the Argument.ts arg coercion).

### Net: the EA suite is blocked on TWO deep compiler-covenant items, both in the user's WIP files
1. `msg.sender` as a stored/compared identity (dominant - gates admin/registry/job/escrow).
2. events in a `delegate` function (gates the emit assertions).
Both sit in `GenerateTargetTraversal.ts` (emitMsgSender/emitTxOrigin/delegatecall covenant) + `StatefulContract.ts`
- hand off to the compiler owner. The harness itself + the proxy/deploy machinery are proven and green.

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

## 2026-07-20 UPDATE - msg.sender RESOLVED (both direct + deployProxy); it was a bounded SDK bug, not deep codegen
`this.owner = msg.sender` + `require(msg.sender == this.owner)` (onlyOwner) now work 100%, for a NORMAL contract
AND for `upgrades.deployProxy` of an `initialize` that sets owner = msg.sender:
- **direct** (070352b2): the covenant's emitTxOrigin needs the sender's native P2PKH input; the SDK only forced it
  for msg.sender-keyed MAPPINGS. Now forced for any `usesMsgSender` (not IFoo(msg.sender)).
- **deployProxy** (b5a13daa + e546250b): the delegatecall arg-assembly skipped `__internal__msgSenderCategory`
  (partial arg list), AND ProxyContract.forward didn't connect the runner (so `_signer` was unset -> dummy funder
  -> emitTxOrigin found no P2PKH). Fixed both: inject msgSenderCategory + connect the proxy to the runner + force a
  signer funder for delegatecall'd msg.sender impls.
Verified e2e incl. onlyOwner reverting a non-owner and the old owner after transfer. So the admin block's
`onlyOwner` authorization is now unblocked; what remains for the FULL admin tests is: (a) events-in-delegatecall
(`OwnershipTransferred`/`Paused`/... emit), and (b) `owner() == deployer.address` needs the address getter to
decode the stored P2PKH lockscript to a CashAddr (currently returns raw bytes). Both are separate from msg.sender.

## 2026-07-20 UPDATE 2 - owner()==address FIXED; events narrowed to a forward output-positioning gap
- **owner() == deployer.address: FIXED** (commit fd8153b0). The `address` state getter now decodes the stored
  P2PKH lockscript to its CashAddress, so both sides are p2pkh addresses (per user guidance). Verified direct +
  proxy; onlyOwner + owner-equality both work now.
- **events in a delegate function (via proxy): NARROWED, not yet fixed.** Not a covenant category bug
  (emitEventCovenantVerification uses the RUNTIME master category, correct for delegates). The gap is SDK
  tx-building: the SDK builds the forward tx from the PROXY `__forward`'s block-layout, which has only a
  lowLevelCall slot and NO event slot (the impl emits, not __forward). The external-call event-output path
  (StatefulTransactionBuilder ~1282, `group.blockLayout` + `group.eventOutputs`) is for A-calls-B (B has its own
  state) and doesn't apply to a delegatecall (impl runs on the PROXY's state). So the impl's event NFT is not
  placed at the impl-block-layout position its covenant checks. FIX DIRECTION: when forwarding a delegatecall to
  an impl that emits, the SDK must add the impl's event NFT output(s) at the impl's block-layout position (like a
  direct call does). Parallels the msg.sender fix (SDK tx-building, not codegen). Non-trivial; not done.

## 2026-07-20 - REAL Solidity cross-compilation (moving off stubs) + ecrecover + empty-array-loop fix
User: "next attempt to compile ../effectiveacceleration.ai/contract VERBATIM; keep the resolved shims but reinstate
core files; identify portbacks; native BCH cross-compile so ecrecover = ecrecoverP2pkh (gated by an `ecrecover`
compiler option)." `contracts/` + `test/` here are ALREADY byte-verbatim vs the real source (diff -rq empty), so
nothing to reinstate. The shift this attempt: cross-compile the REAL `.sol` instead of hand-written `contracts-scash`
stubs. Three compiler/harness portbacks landed (commits on solidcash_v0.13.1):
- **`ecrecover: 'p2pkh'` compiler option (7f3bd68c):** Solidity's 4-arg `ecrecover(h,v,r,s)` had no bare-name
  SolidCash builtin -> all 5 ecrecover-using files failed "Undefined reference to symbol ecrecover" (OZ ECDSA). The
  option aliases it to `ecrecoverP2pkh` (native BCH signer address) or `ecrecoverEvm` (keccak address); byte-identical
  to the projection, inherits its VM-proven recovery.
- **`solidcash compile` cross-compiles `.sol` (05886711):** the @solidcash/testing compile task now also compiles
  `.sol` via compileFileMulti (Hardhat parity), skipping vendored @scope/node_modules import trees. `tasks/compile-real.mjs`
  drives it against the real source into `artifacts-real/`. RESULT: **17/22 files -> 22 real name-resolvable artifacts**
  (full Unicrow escrow suite + FakeToken/ERC20 + TreasurySplit + MockSablier + all interfaces). Real Unicrow ctor
  arity matches the fixture's `Unicrow.deploy(claim, arbitrator, dispute, gov, fee)`; real FakeToken ctor = (name, symbol).
- **empty-array-loop elimination (2c060e0c):** fixed a compiler regression where `_updateJobWhitelist(id, allowed,
  new address[](0))` failed "sorted mapping whitelistWorkers not yet compiled" - the empty inlined loop's C2 write
  corrupted a shared entry slot. Now the dead 0-iteration loop is dropped post-inline (sound). All 4 Marketplace
  advance past it.

**Cross-compile bench = 10/15** (real `.sol`, opts `{solidityImportCompat:true, ecrecover:'p2pkh'}`). The 5 fails are
DEEP compiler regressions in the C2/block-layout codegen (NOT harness gaps), both in the compiler owner's active lane:
1. **Marketplace V1/V2/V3 + DataV1 = `Block slot not found: entry[0]`** in `publishJobPost` (`jobs.push()` struct-array
   + storage-ptr field writes + many external calls + an event; the epilogue expects an entry slot the block layout
   didn't allocate). A separate regression, revealed once whitelistWorkers was fixed; not minimally reproducible.
2. **EACCToken = `_balances`** C2 sorted mapping (multitransfer RMW-in-loop).

So the drop-in harness + real cross-compilation pipeline are proven for the 17 compiling files; the marketplace.test.ts
fixture stays blocked on the real MarketplaceV1 compiling (still needs the entry[0] + _balances C2 fixes). The
`contracts-scash/` stubs remain as the fallback for the test until then (kept, per "do not delete the shims").

## 2026-07-20 (cont) - RECONCILED to 14/15: all 4 Marketplace cross-compile
User: "attempt to fix this yourself." The 10/15 was a compiler REGRESSION (not options - all historical drivers use
the same `{solidityImportCompat:true}`). Peeled the Marketplace whitelistWorkers -> entry[0] -> `new address[](1)`
-> nested-write chain (commit 6275653c, 3 linked fixes in UnrollFixedBoundEntryLoop + GTT): hasMappingWrite now
detects nested/multi-key mapping writes (the key fix), mutatedNames excludes only length-changing ops (push/pop/
delete, not element writes - so `new address[](1); a[0]=w;` folds), and the GTT branch mapping-write pre-allocation
skips inLoop slots (fixes "Block slot not found: entry[0]" in publishJobPost). **All 4 Marketplace (V1/V2/V3/DataV1)
now cross-compile; bench 14/15, only EACCToken `_balances` (multitransfer C2 RMW-loop) remains.** solidc 2210 green.
`node tasks/compile-real.mjs` now emits real Marketplace artifacts too, so the marketplace.test.ts fixture can begin
moving off the MarketplaceV1/DataV1 stubs (runtime deploy of the real Marketplace is the next validation step; the
deep msg.sender/events-in-delegatecall runtime walls from earlier this session still apply to a real deploy).

## 2026-07-20 (cont2) - EACCToken DONE: bench 15/15, THE ENTIRE EACC SUITE cross-compiles
User: "do the EACCToken." Its `multitransfer` (`for(i) _transfer(msg.sender, recipients[i], amounts[i])` -> OZ v5
`_update`) failed `_balances` "sorted mapping not yet compiled". Root cause (BDBG-traced): the credit's per-key value
is a single-assign LOCAL after inlining (`int v = amounts[i]; _balances[to] += v`), so the C2 upsert setup saw
hasValue=false and bailed. Fix (commit eab5811d): the setup now sees through a single-assign value local
(findSingleAssignLocalInit) to `amounts[i]`, so the multiTransfer credit + msg.sender debit + branches all compile.
VM-PROVEN sound (MultiTransferOzShape.test.ts: the exact OZ shape - value-local credit + read-into-local debit -
gives byte-identical results to the direct form). **All 15 EACC contracts (EACCToken + 4 Marketplace + full Unicrow
suite + FakeToken + TreasurySplit + MockSablier + libraries) now cross-compile from real OZ-v5 Solidity verbatim.**
`node tasks/compile-real.mjs` emits every contract's artifact.

## 2026-07-20 (cont3) - REAL artifacts wired into the test; RUNTIME deploy is the next frontier
Now that all 15 EACC contracts cross-compile (15/15), switched the harness OFF the contracts-scash stubs onto the
REAL cross-compiled artifacts: `solidcash.config.ts` paths.contracts -> the real source, paths.artifacts ->
artifacts-real/ (28 real artifacts via `tasks/compile-real.mjs`), solc { solidityImportCompat, ecrecover:'p2pkh' }.
The stubs are KEPT (per "do not delete the shims") as the fallback. `npx vitest run` -> marketplace.test.ts loads +
runs all 66 tests against REAL contracts (no stubs, no source edits).

**FIRST RUNTIME WALL (the fixture's very first deploy): SDK genesis state derivation.** `deployUnicrowSuite ->
Unicrow.deploy(...)` fails "Failed to derive initial state commitments from constructor. Ensure the constructor
writes all state variables." (StatefulContract.ts:3042). ROOT: `requiredIndices = constructorAbi.requiredNftIndices
?? all dataNft indices` - the SDK VM-probes the ctor and requires a commitment for EVERY state-var NFT, but the real
OZ Unicrow ctor writes only its immutables (unicrowClaim/arbitrator/dispute/governance/protocolFee); the rest
(escrows mapping, counters) default to 0/empty and aren't written. This is a normal Solidity pattern the genesis
derivation doesn't handle. FIX (deep, spans compile + SDK, the auto-derivation WIP area): the constructor's
requiredNftIndices should be only the WRITTEN indices, and the SDK should seed unwritten state vars with their zero
default. Not a bounded patch.

**Runtime frontier for the full 66-test suite (multi-session, the SDK/runtime layer, largely mapped earlier):**
1. Genesis state derivation for real ctors (above) - gates EVERY deploy.
2. `upgrades.deployProxy(MarketplaceV1, [..])` - real impl `initialize` must be a `delegate` fn for the proxy path.
3. msg.sender across register/job/escrow flows (mostly FIXED this month: 070352b2/e546250b), events-in-delegatecall.
4. getCreateAddress/getNonce CREATE precompute (worked around), FakeToken ERC20 deploy + transfers.
5. The escrow state machine + ECDSA signMessage (now that native ecrecover exists) + encryption + IPFS (the last
   describe blocks).
So: **cross-compilation is DONE (15/15, real Solidity -> BCH bytecode); running the suite is a dedicated RUNTIME/SDK
phase, gated first on genesis state derivation for real constructors.** The harness + real artifacts are proven; the
tests execute against real contracts and stop at the SDK deploy layer, not at the harness.

## 2026-07-20 (cont4) - reverted config to stubs; REAL Unicrow (32KB) exceeds BCH's 10KB script/stack limit
Pointed the harness at real artifacts (cont3) and drove the marketplace fixture's first deploy. Finding (distinct
from the stub deploy-wall the user is debugging in memory ea_deploy_wall): the REAL cross-compiled Unicrow is ~32 KB
of bytecode. The deploy probe (StatefulContract, VM-probes the ctor to derive genesis) fails TWO BCH VM limits in
sequence: (1) "unlocking bytecode exceeds maximum: 10000 bytes" (`consensus.maximumBytecodeLength`, the P2SH redeem
= the 32KB contract), then after raising that locally, (2) "stack item exceeds maximum: 10000 bytes" (the 32KB redeem
is PUSHED as a stack item, `maximumStackItemLength`). Both are BCH consensus/relay limits (10 KB) that the real OZ
Unicrow (and the bigger Marketplace) exceed - a FUNDAMENTAL constraint for deploying large ported contracts on BCH,
NOT a harness/SDK bug. A drop-in TEST env can raise the LOCAL probe VM's limits to validate the covenant logic, but
the derive path is the user's active C2 WIP (memory ea_deploy_wall "do NOT touch"), so that belongs to them. Reverted
paths.artifacts to the stub `artifacts/` (the debugging setup); artifacts-real/ is kept for when large-contract
deploy lands. **So: cross-compilation is 15/15 (real Solidity -> BCH); the runtime deploy of the LARGE real contracts
is gated on BCH's 10 KB script/stack limit + the user's C2 derive WIP.**

## 2026-07-22 - sharded-artifact integration resumed against upstream sources
The harness now points directly at `/Code/effectiveacceleration.ai/contract/contracts` and `artifacts-real`; no
contract or test source is edited. Project compilation selects `<Contract>.split.json` automatically for oversized
artifacts. Exercising real OZ inheritance found and fixed two generic planner defects:

- Synthetic facets no longer revalidate already-resolved `override(Base)` metadata after the flattened contract is
  renamed. This unblocked OZ's `override(Nonces)` path.
- Compiler-generated maintenance entry points such as `__updateBlockOracle` remain root-owned rather than being
  treated as user-facing movable shards.

The next sharding level is now explicit: entry-point-only facets are insufficient for the real OZ contracts.
`EACCToken.approve` alone produces a 14,992-byte facet, and FakeToken currently exposes inherited-constructor/helper
pruning (`_mint` becomes unresolved in a synthetic facet). The next implementation step is safe intra-entry helper
partitioning/pruning; ordinary whole-project cross-compilation remains 15/15.
