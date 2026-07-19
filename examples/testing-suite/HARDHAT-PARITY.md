# SolidCash Testing Suite: Hardhat + ethers Parity Roadmap

Goal: make `examples/testing-suite` a **drop-in replacement** for a Hardhat + ethers +
`@nomicfoundation/hardhat-toolbox` project, so that Solidity/Hardhat contracts ported to `.scash`
(e.g. `../effectiveacceleration.ai/contract`, `../mistswap/mistswap`) can keep their test files,
signer setup, contract factories, fixtures, matchers and task scripts with minimal edits.

This file is the **persistent, cross-session checklist**. Update the checkboxes and append to the
Session Log as work lands. Do NOT delete completed items (they document the mapping); mark them `[x]`.

> **RESOLVED 2026-07-19 - the harness lives in `@solidcash/testing` (`packages/testing`).** The complete harness
> modules were MOVED there from `solidcash/src/hardhat` (per user: "consolidate into @solidcash/testing"). The
> earlier incomplete files (`accounts`/`environment`/`factory`/`compile`) were replaced. SDK-level primitives
> stay in `solidcash` (MockNetworkProvider snapshot/time, the `solidcash/vitest` matchers, `SnapshotRestorer`
> export, ContractFactory, Signer, BlockOracleUpdater) and the harness imports them from the `solidcash` package.
> **Public surface**: `@solidcash/testing` (main = HRE/ethers/tasks/config), `@solidcash/testing/chai`,
> `@solidcash/testing/network-helpers`, `@solidcash/testing/ethers`; CLI bin `solidcash` -> `dist/cli.js`.
> The testing-suite imports `@solidcash/testing` (aliased to `hardhat`/`chai`/`@nomicfoundation/hardhat-network-helpers`
> in vitest.config). solidcash's harness subpaths + the SDK-side bin were removed; `ethers` moved back to the
> SDK's devDependencies (it is now a direct dep of `@solidcash/testing`).

## Legend

- `[ ]` TODO   `[~]` partial / exists but not wired into the harness   `[x]` done   `[-]` N/A on BCH UTXO (see rationale)
- Priority: **P0** blocks basic parity or used heavily in the ported suites; **P1** important; **P2** nice-to-have.
- Evidence: usage counts observed in the two real ported projects. `EA` = effectiveacceleration.ai
  (Hardhat 2.22 + toolbox + ethers v6 + Mocha/Chai, 158 tests). `MS` = mistswap (Hardhat 2.0 + waffle +
  ethers v5 + Mocha/Chai, ~15 test files).

## What already exists at the SDK level (foundation)

The `solidcash` SDK already ships a deliberate ethers-v6 / hardhat parity layer. Most primitives exist;
the gap is that the **testing-suite scaffold uses none of it**, plus the missing harness layer
(tasks/HRE/config/CLI), fixtures, time-travel and several matchers. Confirmed present:

- `Contract`, `TransactionBuilder` (`.debug()` local VM eval, `.send()`, `.build()`, `.getVmResourceUsage()`).
- `StatefulContract` as an ethers `Contract`: `new(address|category, artifact, runner)`, `at()`, `connect()`,
  `attach()`, `getFunction()`, `runner`/`interface`/`target`/`getAddress()`, `deploy`/`deployFrom`/`upgrade`/
  `destroy`/`split`/`merge`, `deployProxy`/`upgrades`.
- Events facade: `queryFilter`/`queryEvents`/`filters`/`getEvent`/`on`/`once`/`off`/`removeAllListeners` (polling).
- `Signer`, `HDSigner` (`fromPhrase`/`fromSeed`/`createRandom`/`fromExtendedKey`/`deriveChild`/`extendedKey`/
  `neuter`), `HDPublicSigner`, `signersFromMnemonic`.
- `MockNetworkProvider`: `mine()`, `setBlockHeight()`, `reset()`, `addUtxo()`, `addTokenUtxos()`/
  `addTokenUtxosDynamic()`, `getSigners()`/`getSigner()` (uses the real hardhat `test test ... junk` mnemonic
  as `DEFAULT_MNEMONIC`). `FailingMockNetworkProvider` for broadcast-failure paths.
- `ContractFactory` / `getContractFactory` / `deployContract`, returning a `DeployedContract` with
  `waitForDeployment()` + `deploymentTransaction()`. `ContractBundle` for multi-artifact.
- Vitest matchers (`solidcash/vitest`): `toLog`, `toFailRequire`, `toFailRequireWith`, `toBeReverted`,
  `toBeRevertedWith`, `toRevert`, `toRevertWith`, `toEmit` (accepts literal or predicate args).
- Test data: `randomUtxo`, `randomToken`, `randomNFT`, `gatherBchUtxos`, `attachWait`.

## Three decisions - LOCKED 2026-07-19 (by user)

The `(Phase A/B, Px)` tags on the workstreams below are now **effort/dependency hints, not a gate** (per D3
everything is in scope together). Order by the revised sequencing section.

- [x] **D1 - Vitest engine + Mocha/Chai shims that redirect to Vitest.** Vitest stays the actual runner.
  Provide (a) Mocha-API globals (`describe`/`it`/`before`/`beforeEach`/`after` - Vitest already supplies these
  via `globals:true`) and (b) a **Chai-style shim** (`import { expect } from 'solidcash/chai'`, and/or a `chai`
  alias) whose `.to.be.revertedWith(...)` / `.to.emit(...).withArgs(...)` / `.to.equal(...)` / `.to.be.reverted`
  chaining delegates to the existing Vitest `expect.extend` matcher engine. Goal: a ported file that
  `import { expect } from "chai"` + uses chai chaining runs under Vitest unmodified. (Reshapes WS7 plumbing + WS11.)
- [x] **D2 - Mirror BOTH Hardhat v2 and v3, abstracted.** Expose a **v2-compatible surface** as the primary API
  (global-style `hre.ethers.*`, `task(name).addParam().setAction((args, hre) => ...)`, `loadFixture` import),
  but structure the internals around a **connection/HRE seam** so a v3 mode (`hre.network.create()` returning
  `{ ethers, networkHelpers }`, builder-style tasks, ethers-first-arg matchers) can layer on later without a
  rewrite. (Reshapes WS2 + WS7 matcher signatures - support both `.changeTokenBalance(acct, d)` and the v3
  `.changeTokenBalance(ethers, token, acct, d)` shapes.)
- [x] **D3 - Build the full CLI/HRE + config NOW, alongside the helpers.** No phasing gate. WS1 (config loader)
  + WS2 (task registry + `solidcash` CLI + HRE) are in scope immediately, together with the library helpers
  (fixtures/signers/matchers/time-travel/utils). See the revised sequencing section.

## BCH UTXO vs EVM account: permanent impedance mismatches

Document these so no session wastes time chasing an EVM idiom that cannot map. Provide a throwing shim with a
clear message where a ported test may call it.

- [-] `impersonateAccount` / `getImpersonatedSigner` / `stopImpersonatingAccount` - **N/A**. BCH has no
  account abstraction; you hold keys. Parity = hand the test the key (`getSigners()` already returns signers
  with private keys). Shim should throw "no account impersonation on BCH; use getSigners()/a SignatureTemplate".
  (EA: 0, MS: 0 - safe.)
- [-] `setBalance(addr, wei)` to an EXACT value - **partial N/A**. Funding is additive via `addUtxo`; you
  cannot subtract without `reset()`. Provide `fundAddress(addr, sats)` (additive) + document.
- [-] `setStorageAt` / `setCode` / `setNonce` - **N/A**. No global mutable account storage; state lives in
  covenant UTXOs. `setState`/`setEntry` on `StatefulContract` are the covenant analogue.
- [-] `estimateGas` / gas reporter / `callStatic` returning a value - **partial**. BCH fees are size-based, not
  gas; closest is `TransactionBuilder.getVmResourceUsage()` (ops/op-cost/sigchecks/hash-iters). `callStatic`
  (MS: 1) maps to `TransactionBuilder.debug()` reading the VM stack / an `emitReturn` value.
- [-] ENS (`resolveName`/`lookupAddress`) - **N/A**.
- [-] Signer EVM members (`sendTransaction`, `signTransaction`, `signTypedData`, `getNonce`, `populate*`) -
  already **stubbed to throw** "no equivalent on BCH". Keep, but see WS8 for EIP-712 which IS portable.

---

# Workstreams

## WS1 - Project scaffold and config  (Phase B, P1)

- [x] `solidcash.config.ts` loaded by the CLI (D3): `paths` (contracts/artifacts/tests), `networks`,
  `defaultNetwork`, `mnemonic`, `accounts`, `solc`. `loadConfig()` imports .ts/.mjs/.js. DONE.
- [x] `defineConfig()` typed identity helper. DONE.
- [x] Network registry: `createProvider(name, cfg)` maps name/type -> Mock/Regtest/Electrum, so `--network`
  swaps providers without test edits. DONE.
- [x] Default test mnemonic surfaced in config (`test test ... junk`). DONE.
- [ ] `namedAccounts` analogue (MS hardhat-deploy). P2.

## WS2 - Task system, HRE and CLI  (Phase B, P1)

Today: only `tasks/compile.ts` run via `tsx`; `solidcash` has no `bin`; no task registry, HRE, or config loader.

- [x] CLI entry: `@solidcash/testing` bin `solidcash` -> `dist/cli.js`, `solidcash <task> [--network n] [args]`.
  Runs via `node packages/testing/dist/cli.js` (or `npx solidcash` after `yarn install` relinks the bin). DONE.
- [x] Built-in tasks: `compile` (dynamic-imports solidc), `test` (spawns vitest), `run <script>` (hre global),
  `clean`, `node` (info). DONE. `console` REPL TODO.
- [x] Task registry API (hardhat v2): `task(name, desc?).addParam/.addOptionalParam/.addFlag/
  .addPositionalParam/.addVariadicPositionalParam(...).setAction(async (args, hre) => ...)` + `subtask`. DONE.
- [ ] HRE-equivalent object injected into task actions and scripts: `{ network, config, artifacts, ...harness }`
  where `harness` exposes `getSigners`, `getContractFactory`, `getContractAt`, `deployContract`, providers.
  D2 LOCKED: primary shape = v2 global `hre.ethers.*`; build it over a **connection/HRE seam** so a v3
  `hre.network.create() -> { ethers, networkHelpers }` mode can layer on. `hre.ethers` = a thin binding of the
  WS8 ethers-shim + WS3/WS4 helpers to the active network.
- [x] `hre.run(name, args)` programmatic task invocation. DONE. (v3 `hre.tasks.getTask` accessor also present.)
- [ ] `hardhat-deploy` analogue (MS uses `deployments.deploy` + `deploy/` scripts + `tags`/`dependencies`
  graph + `deployments.createFixture`). P2 unless MS deploy scripts must run.

## WS3 - Signers and accounts  (Phase A, P0)

- [x] `getSigners(count?, opts?)` returning pre-funded signers (`MockNetworkProvider.getSigners`, test-util
  `getSigners`). EA: 14, MS: 11.
- [x] `getSigner(index?)`, `fundedSigner()`.
- [x] HD derivation from a mnemonic (`HDSigner`, `signersFromMnemonic`), watch-only (`HDPublicSigner`).
  EA derives extra wallets via `HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(m), path)` (17 uses) - map to
  `HDSigner.fromPhrase` / `deriveChild`.
- [x] `signer.address` / `getAddress()`; `.connect(signer)` per-call sender switch. EA: connect 451, MS: 99.
- [x] `signer.signMessage(bytes)` (BCH signed-message). EA: 28.
- [x] **Network-agnostic `getSigners`.** `hre.ethers.getSigners()` prefers `provider.getSigners` (Mock) and
  falls back to `signersFromMnemonic(provider)` for others (funding is the caller's job on live nets). DONE.
  (Regtest auto-funding still TODO.)
- [ ] `Wallet.createRandom()` analogue returning a funded ad-hoc signer (EA uses `Wallet.createRandom`). P1.
- [-] `getImpersonatedSigner` - N/A (see impedance list). Provide throwing shim.

## WS4 - Contract factory, deployment and attach  (Phase A, P0)

- [x] `getContractFactory(artifact, runner)` + `factory.deploy(...args, overrides?)` (stateful). EA: 42/32, MS: 65/74.
- [x] `deployContract(artifact, args?, runner?, overrides?)` one-shot (hardhat-ethers shortcut).
- [x] `.waitForDeployment()` + `.deploymentTransaction()` on the deployed handle. EA: 25.
- [x] `.getAddress()` everywhere an address is needed. EA: 315 (incl signer.getAddress).
- [x] `.attach(addressOrCategory)` (StatefulContract.attach / ContractBundle.attach). MS: 12.
- [x] `upgrades.deployProxy(factory, [initArgs])` / `upgrades.upgradeProxy(addr, factoryV2)`. EA: 10/2 - central.
- [x] **`getContractAt(artifact, addressOrCategory, runner?)`** on `hre.ethers` (-> `StatefulContract.at`). DONE.
  (Stateless-artifact variant TODO.)
- [~] **Stateless-contract factory parity.** A stateless `Contract` "deploys" by funding its address; there is
  no `getContractFactory`/`deploy`/`attach` for stateless. Provide a uniform factory that, for a stateless
  artifact, constructs `new Contract` + funds it and returns a handle with `getAddress`/`waitForDeployment`
  (no-op). P1 - MS contracts (tokens/pairs) are mostly stateless-style deploys.
- [~] **`.deployed()` (ethers v5)** alias of `waitForDeployment`. MS: 38. Trivial alias for v5 drop-in. P1.
- [ ] `getCreateAddress({from, nonce})` analogue for pre-computing a deploy address (EA: 9, wires circular
  deps). BCH analogue = predict child p2sh32 (already possible via `new Contract({category})`); expose a
  named helper. P1.
- [ ] `new ethers.Contract(addr, abi, signer)` bare form (MS: 2) -> already `new StatefulContract(addr, art, runner)`.
  Document the mapping. P2.

## WS5 - Fixtures and snapshots  (Phase A, P0)

The single biggest modern-parity gap: **`loadFixture` does not exist** in the SDK. EA uses it 122 times as the
per-test state-reset backbone. MS does not use fixtures (redeploys in `before`/`beforeEach`).

- [x] **`loadFixture(namedFn)`** with hardhat semantics: cache keyed by **function identity**; first call runs
  the fixture and takes a snapshot; later calls **restore the snapshot** (do NOT re-run) and return the memoized
  return value; reject anonymous fixtures. DONE (`solidcash/network-helpers`). (Independent deep-clone snapshots,
  so unlike EVM restore never invalidates newer ones.)
- [x] Snapshot primitive: **`takeSnapshot() -> { restore(), snapshotId }`** on `MockNetworkProvider`, backed by
  mem-cash indexer `snapshot()`/`restore()` (deep-clone of the full chain+mempool state + tip height/time). DONE.
  Regtest analogue still a no-op / TODO.
- [x] `clearSnapshots()` and integration so each `it` starts from the fixture snapshot. DONE.
- [ ] `deployments.createFixture` analogue (MS/hardhat-deploy) if WS2 hardhat-deploy is pursued. P2.

> **Hardhat-compliance note (reviewed 2026-07-19, kept as-is by user).** API is compliant: `takeSnapshot() ->
> { restore(): Promise<void>, snapshotId: string }`, repeatable restore, `loadFixture(namedFn)` rejects
> anonymous fixtures + caches by function identity + restores-not-reruns, and the snapshot covers full chain
> state (UTXOs, mempool, headers/tip incl. timestamp+height). `snapshotId` is a hex-quantity string like
> Hardhat's (Number/BigInt-parseable). ONE deliberate divergence in the *mechanism*: Hardhat uses a DESTRUCTIVE
> `evm_snapshot` STACK (revert-to-N invalidates snapshots > N, so `loadFixture` prunes + RE-RUNS invalidated
> fixtures, and the id is load-bearing), whereas ours uses INDEPENDENT deep clones (mem-cash `snapshot()`/
> `restore()`): restore never invalidates other snapshots, `loadFixture` never prunes/re-runs, and the id is
> cosmetic (per-provider counter; restore is driven by the retained clone). For the standard one-fixture-per-test
> pattern they are identical; for interleaved multi-fixture use ours restores the exact captured state instead of
> re-running, which is strictly more robust for fixtures that violate Hardhat's "must not depend on external
> mutable state" rule. DEFERRED: an opt-in exact-Hardhat-stack mode (monotonic load-bearing ids + invalidation +
> fixture re-run) - not the default because it would re-introduce that footgun.

## WS6 - Time and block control  (Phase A, P0)

Height advancement exists; **timestamp/time control does NOT** (mock block time is hardcoded `1700000000`).

- [x] `mine(blocks?)` advance block height (`MockNetworkProvider.mine`, `RegtestNetworkProvider.mine`).
- [x] `setBlockHeight(n)` (~ `mineUpTo`).
- [x] **`mineUpTo(height)`** (`MockNetworkProvider.mineUpTo` + `solidcash/network-helpers`). DONE.
- [~] **`advanceBlock()` / `advanceBlockTo(n)`** ethers-v5/waffle aliases - covered by `mine`/`mineUpTo`; add the
  literal names if a MS port needs them verbatim. P1.
- [x] **Block timestamp control**: `time.latest()/increase(sec)/increaseTo(ts)/setNextBlockTimestamp(ts)/
  duration.{seconds..years}`. mock is now indexer-authoritative for block time (`setNextBlockTimestamp` is a
  mem-cash pending value; `increase`/`increaseTo` are immediate + mine). **These drive Solidity `block.timestamp`
  / `block.number`** (the Hardhat surface) via the oracle bridge below - NOT `tx.locktime`. DONE.
- [x] **block.* oracle bridge**: `mockBlockOracleRpc(provider)` sources height/time from the mock chain so a
  `BlockOracleUpdater` propagates harness time-travel into a contract's `__block_timestamp`/`__block_number`
  registers. Proven by `test/block-timestamp.test.ts` (TimeVault withdraw locks then unlocks). DONE.
- [ ] **Raw RPC shim**: intercept `provider.send("evm_increaseTime"|"evm_mine"|"evm_setNextBlockTimestamp")` so
  ported EA/MS time-travel calls (which call raw RPC) run verbatim. P1.
- [x] `mine` auto-confirm on `sendRawTransaction` (mock mines a block on send).

## WS7 - Assertion matchers (chai + vitest)  (Phase A, P0)

Today: 8 Vitest-only matchers. Need chai-plugin parity (D1) and several missing matchers. Map EVM ether ->
BCH sats, ERC-20 -> CashToken FT.

Revert / require:
- [x] `revertedWith(reason|regex)` (`toBeRevertedWith`/`toRevertWith`). EA: 123, MS: 50.
- [x] `reverted` / `to.be.reverted` (`toBeReverted`/`toRevert`). EA: 32, MS: 4.
- [~] **`revertedWithCustomError(target, name).withArgs(...)`** - best-effort in the chai shim (asserts a revert
  whose message mentions the error name). Full custom-error selector decoding from failed-VM state + typed
  `withArgs` still TODO. EA: 21.
- [ ] `revertedWithoutReason()` P2. `revertedWithPanic(code?)` - map to VM error classes if meaningful, else
  descope. P2. (EA/MS: 0.)

Events:
- [~] **`emit(contract, event).withArgs(...)`** - present as `toEmit(contract, name, args)` (Vitest) with
  literal OR predicate args, but NOT the chai `.to.emit(...).withArgs(...)` chaining shape, and it decodes from
  a freshly built tx (not a post-`send()` receipt). Add: (1) chai-plugin chaining form; (2) **function-predicate
  withArgs** (EA relies on this heavily, 51 uses - callback that throws on mismatch, returns true on match);
  (3) post-send/mined-tx event assertion path; (4) `.not.to.emit`. EA: emit 59 / withArgs 51, MS: emit 71 / withArgs 55. P0.

Balance change (chai shim; `actual` is an action fn/promise, measured before/after):
- [x] **`changeBchBalance(s)(account(s), delta(s))`** (ether-balance analogue, sats). DONE.
- [x] **`changeTokenBalance(s)(category, account(s), delta(s))`** for CashToken FTs. DONE. (v3 ethers-first-arg
  shape not yet accepted - v2 shape only.)

Numeric / value (BigInt-first; note the runner often covers these natively):
- [x] `equal` on BigInt (Vitest `toEqual`/`toBe`, chai `.equal` via a BigInt plugin). EA: 575, MS: 116.
- [x] `closeTo(expected, tolerance)` for BigInt (chai shim, manual bigint-abs). DONE. EA: 20.
- [x] `greaterThan`/`gt`/`lessThan`/`lt`/`at.least`(gte)/`most`(lte)/`within` BigInt-aware (chai shim). DONE.
- [~] `properAddress` (valid cashaddr) DONE; `properHex(len)`/`hexEqual` TODO. P2.

Framework plumbing:
- [ ] **Chai-style shim over Vitest (D1 LOCKED)**: `import { expect } from 'solidcash/chai'` exposing
  `.to.be.revertedWith` / `.to.be.reverted` / `.to.emit(...).withArgs(...)` / `.to.equal` / `.to.be.closeTo` /
  `.to.be.gt`/`.within` chaining that delegates to the Vitest `expect.extend` matchers; plus Mocha-API globals
  (Vitest supplies describe/it/before/beforeEach via `globals:true`). A **`chai` module alias** makes a ported
  file's `import { expect } from "chai"` resolve to the shim so it runs under Vitest unmodified. DONE.
- [x] `chai-as-promised` interop: `.to.be.rejected` / `.rejectedWith(...)` for async throws (chai shim). DONE. EA: 10.
- [ ] `chai-subset` interop: `.to.containSubset([{...}])` for partial struct-array match. EA: 6. P2 (third-party
  plugin - may just work under a chai build).

## WS8 - ethers utility shim  (DONE - forwarded to ethers v6 per user decision)

`solidcash/ethers` (and `hre.ethers.*`) re-export the chain-agnostic utils from real `ethers` v6 (user: "reuse
ethers.js ... so that we do not reimplement everything"); only the v5-compat pieces v6 dropped are shimmed.

- [x] Units: `parseEther`/`formatEther`/`parseUnits`/`formatUnits` (ethers v6; EVM 18-decimals). DONE.
- [x] `getBigNumber(n, decimals=18)` + an `ethers.BigNumber`-shaped v5 shim over `bigint` (add/sub/mul/div/pow/
  eq/lt/gt/toBigInt/...). DONE (MS 419/431).
- [x] Hashing: `keccak256`, `id`, `solidityPacked`/`solidityPackedKeccak256` (ethers). DONE.
- [x] ABI: `AbiCoder`/`AbiCoder.defaultAbiCoder()`/`Interface` (ethers, real coder). DONE.
- [x] Bytes/hex: `getBytes`/`hexlify`/`toUtf8Bytes`/`concat`/`zeroPad*` (ethers). DONE.
- [x] Constants: `ZeroAddress`/`ZeroHash`/`MaxUint256`/`MaxInt256`/`WeiPerEther` + v5 `constants`/`utils` namespaces. DONE.
- [~] **EIP-712 / signed structured data.** `SigningKey`/`Signature`/`Mnemonic` re-exported from ethers; BCH-native
  `hashTypedData`/`verifyTypedData`-on-BCH-signing helpers still TODO. EA: SigningKey 25, MS: permit cluster.

## WS9 - Events, receipts and decoding  (Phase A, P1)

- [x] `tx.wait(confirmations?)` on send result (`attachWait`); instant on mock.
- [x] `queryFilter(filters.X(indexed))` -> `EventLog[]` with `.args`. EA: 13, MS: reads via receipt instead.
- [ ] **`(await tx.wait()).events[i].args`** receipt-event extraction (ethers v5, MS: 9 - extracts deployed
  pair/clone addresses). Provide `receipt.events`/`receipt.logs` decoded against the artifact ABI. P0 for MS.
- [ ] Typechain-style struct outputs: named field access + **`.toObject()`** on returned structs. EA: 16 uses of
  `.toObject()`. Ensure `StatefulContract` getters/return-decoding surface named fields + `.toObject()`. P1.
- [ ] App-level event byte-decoders (EA `decodeJobCreatedEvent` etc. over the raw `data_` field) - project code,
  but the harness must expose the raw event commitment bytes so such decoders work. P2.
- [x] `on`/`once` live subscription (polling). EA/MS tests: 0 (use queryFilter/receipt). Keep.

## WS10 - Test data and utilities  (Phase A, P1)

- [x] `randomUtxo`/`randomToken`/`randomNFT`.
- [ ] `getBigNumber(amount, decimals)` (WS8) + `ADDRESS_ZERO`/`AddressZero` constants (MS helper). P0 for MS.
- [ ] Sushi/MistSwap-style `prepare(this, [names])` + `deploy(this, [[name, factory, args]])` helpers, or a
  documented idiomatic equivalent, so MS `test/utilities/index.ts` ports. P2 (project glue, not core).
- [ ] `duration.{seconds..years}` (WS6) exported as a util. P1.
- [ ] Coin-selection helpers already exist (`gatherBchUtxos`, `gatherFungibleTokenUtxos`). P2 doc.

## WS11 - Framework support, docs and a ported example  (P1)

- [ ] `solidcash/chai` shim (Vitest-backed, D1) + `solidcash/vitest` (exists) both documented; note the `chai`
  alias trick for running ported files unmodified.
- [ ] `docs/testing-setup.md` (the README already links `solidcash.org/docs/sdk/testing-setup`) covering:
  signers, fixtures, factories, matchers, time control, network switching, and the EVM->BCH idiom map.
- [ ] **Migration guide**: a table mapping every hardhat/ethers/chai API in this doc to its SolidCash call,
  plus the N/A list with the recommended BCH pattern.
- [ ] A **fully ported example test** in `test/` that exercises fixtures + signers + factory + matchers +
  time-travel end to end (e.g. port `hodl_vault` or a small EA/MS contract) as the executable parity proof.
- [ ] Expand `contracts/` beyond the 2 toy contracts to include a stateful contract and a token contract so the
  harness features are demonstrable.

---

# Evidence matrix (API usage in the two ported projects)

Priority signal: an API used many times across the real ported suites is P0 even if this doc lists it P1.

| API surface                         | EA (toolbox/ethers6/Mocha) | MS (waffle/ethers5/Mocha) | Status |
|-------------------------------------|----------------------------|---------------------------|--------|
| `loadFixture`                       | 122                        | 0 (before/beforeEach)     | `[ ]`  |
| `.connect(signer)`                  | 451                        | 99                        | `[x]`  |
| `getSigners`                        | 14                         | 11                        | `[x]`/network-agnostic `[ ]` |
| `getContractFactory` / `.deploy`    | 42 / 32                    | 65 / 74                   | `[x]`  |
| `.deployed()` (v5)                  | 0                          | 38                        | `[ ]` alias |
| `.attach()`                         | tasks only                 | 12                        | `[x]`  |
| `waitForDeployment`                 | 25                         | 0                         | `[x]`  |
| `upgrades.deployProxy/upgradeProxy` | 10 / 2                     | 0                         | `[x]`  |
| `getAddress()`                      | 315                        | via `.address`            | `[x]`  |
| `revertedWith`                      | 123                        | 50                        | `[x]`  |
| `to.be.reverted`                    | 32                         | 4                         | `[x]`  |
| `revertedWithCustomError(.withArgs)`| 21                         | 0                         | `[ ]`  |
| `emit` / `withArgs`                 | 59 / 51 (fn-predicate)     | 71 / 55                   | `[~]`  |
| `changeTokenBalance(s)`             | 0                          | 2                         | `[ ]`  |
| `.equal` on BigInt                  | 575                        | 116                       | `[x]`  |
| `closeTo` / `greaterThan` (BigInt)  | 20 / 44                    | 0                         | `[ ]`  |
| `containSubset` (chai-subset)       | 6                          | 0                         | `[ ]`  |
| `rejectedWith` (chai-as-promised)   | 10                         | 0                         | `[ ]`  |
| time-travel (`evm_increaseTime`/`increase`/`duration`) | 4+4 raw RPC | increase/duration/latest  | `[ ]`  |
| block-height advance (`advanceBlockTo`) | 0                      | 32                        | `[~]` (mine/setBlockHeight) |
| `queryFilter(filters.X)`            | 13                         | 0 (receipt)               | `[x]`  |
| `tx.wait().events[].args`           | tx.wait 9                  | 9                         | `[ ]`  |
| `parseEther`/`formatEther`          | 91 / 47                    | 2                         | `[ ]`  |
| `getBigNumber` / BigNumber          | 0                          | 419 / 431                 | `[ ]`  |
| `keccak256`                         | 37                         | 21                        | `[ ]` shim |
| `AbiCoder.defaultAbiCoder`          | 28                         | 47                        | `[ ]` shim |
| `getBytes`/`toUtf8Bytes`            | 45 / 8                     | 10 (`toUtf8Bytes`)        | `[ ]` shim |
| `ZeroAddress`/`MaxUint256`          | 48 / 11                    | 6 / 2                     | `[ ]` shim |
| `SigningKey` ECDH / EIP-712 permit  | 25                         | permit cluster            | `[ ]`  |
| custom `task(...)`                  | 31                         | ~40                       | `[ ]`  |
| hardhat-deploy (`deployments.*`)    | 0                          | 14 scripts                | `[ ]` P2 |
| `impersonateAccount`                | 0                          | 0                         | `[-]` N/A |
| network-helpers `time.*`/`setBalance` (direct) | 0 (raw RPC)     | 0 (helper file)           | `[ ]`  |

---

# Revised sequencing (D3: everything in scope; order by dependency, not phase)

Foundational seams FIRST (D2/D3), then the helpers that bind to them, then polish:

1. **Seams:** connection/HRE abstraction (WS2) + `solidcash.config.ts` loader + network registry (WS1) +
   `solidcash` CLI skeleton (`compile`/`test`/`node`/`run`/`clean`) (WS2). Establishes the v2-surface-over-
   v3-seam that everything else binds to.
2. **Runner shim (D1):** `solidcash/chai` Vitest-backed shim + `chai` alias + Mocha-API globals (WS7/WS11).
3. **Core helpers:** WS5 `loadFixture`+snapshot/restore (P0), WS6 timestamp/time-travel + `advanceBlockTo`/
   `mineUpTo` (P0), WS3 network-agnostic `getSigners` (P0), WS4 `getContractAt`/stateless factory/`.deployed()`.
4. **Matchers:** `revertedWithCustomError`, `emit().withArgs(predicate)`, `changeBchBalance`/`changeTokenBalance`,
   BigInt `closeTo`/`gt`/`within` - in BOTH v2 and v3 arg-shapes (D2) (WS7).
5. **Utils + receipts:** WS8 `getBigNumber`/units/constants/AbiCoder/keccak shim (P0 for MS), WS9 receipt
   `.events[].args` + `.toObject()` (P0 for MS), WS8 EIP-712 permits.
6. **Task ports + docs:** WS2 the 31 EA + ~40 MS `task(...)` definitions, WS2 hardhat-deploy analogue (P2),
   WS11 docs + migration guide + a fully ported example test + expanded `contracts/`.

---

# Session Log (append-only)

- 2026-07-19: Doc created from a 4-quadrant deep dive (SDK surface, EA usage, MistSwap usage, canonical
  Hardhat v3 + ethers v6 spec). Baseline: SDK ethers-parity layer largely exists; harness/fixtures/time-travel/
  several matchers are the gap. No code changed yet.
- 2026-07-19: **D1/D2/D3 LOCKED by user.** D1 = Vitest engine + Mocha/Chai shims that redirect to Vitest (not a
  separate chai build). D2 = mirror BOTH v2 and v3, abstracted (v2 surface primary over a connection/HRE seam).
  D3 = build full CLI/HRE + config NOW, no phasing. Decisions section + WS2/WS7/WS11 + sequencing updated
  accordingly. Next: start the seams (WS2 connection/HRE + WS1 config + CLI skeleton) per revised sequencing.
- 2026-07-19: **IMPLEMENTED end-to-end (all in `packages/solidcash/src/hardhat/*`, subpaths `solidcash/hardhat`,
  `solidcash/chai`, `solidcash/network-helpers`, `solidcash/ethers`; CLI bin `solidcash`).**
  - **mem-cash snapshot/restore** (owned repo `../mem-cash`): added `snapshot()`/`restore()` to storage + core
    Node + indexer (deep-clone via structuredClone), and `setNextBlockTimestamp()` (pending next-block ts) +
    monotonic `mine()` default (never goes backwards). +8 mem-cash tests (331 green). PUBLISHED as
    `@mem-cash/*@0.0.7`; solidcash depends on `@mem-cash/electrum`+`@mem-cash/validation@^0.0.7` from npm (the
    earlier manual dist-copy workaround is gone). THIS backs loadFixture snapshots + time control.
  - **WS5 fixtures**: `loadFixture` (named-fn cache key, restore-not-rerun), `takeSnapshot`/`restore`,
    `clearSnapshots` on `MockNetworkProvider.takeSnapshot()` (indexer snapshot + height). DONE.
  - **WS6 time/block**: `MockNetworkProvider` now indexer-authoritative for block time (removed drifting
    `blockTime` field); `mine`/`mineUpTo`/`setNextBlockTimestamp` (pending, mem-cash) / `increaseTime`
    (immediate, uses REAL tip height so setChainTip sticks); `time.*` (latest/increase/increaseTo/duration).
    **block.timestamp/block.number bridge**: `mockBlockOracleRpc(provider)` feeds `BlockOracleUpdater` from the
    mock chain, so `time.increaseTo` moves the on-chain `block.timestamp` register (proven: TimeVault withdraw
    covenant locks then unlocks). This is the Hardhat time surface, NOT tx.locktime. DONE.
  - **WS1 config**: `solidcash.config.ts` + `defineConfig` + `loadConfig` (imports .ts/.mjs/.js). DONE.
  - **WS2 tasks/HRE/CLI**: `task()/subtask()` v2 builder + registry, `hre` (config/network/ethers/networkHelpers/
    run) over a `network.create()` v3 seam (D2), builtin tasks compile/test/run/clean/node, `solidcash` CLI bin.
    DONE (hardhat-deploy analogue still TODO).
  - **WS3 signers**: `hre.ethers.getSigners/getSigner` bound to the active provider (network-agnostic: prefers
    `provider.getSigners`, falls back to `signersFromMnemonic`). DONE.
  - **WS4 factory**: `hre.ethers.getContractFactory/getContractAt/deployContract` (getContractAt = new). `.attach`
    via StatefulContract. `.deployed()` v5 alias + getCreateAddress-BCH still TODO.
  - **WS7 matchers (D1 chai shim over Vitest)**: `expect(x).to.be.revertedWith/reverted/revertedWithCustomError
    (best-effort).withArgs / .emit(c,e).withArgs(obj|positional) / .equal / .closeTo / .gt/.lt/.gte/.lte/.within /
    .true/.false / .properAddress / .changeBchBalance(s) / .changeTokenBalance(s) / .rejected/.rejectedWith`.
    Delegates to the Vitest matchers in TestExtensions. `chai` module alias makes ported `import {expect} from
    "chai"` resolve here. DONE (core set; full withArgs-predicate on emit + chai-subset TODO).
  - **WS8 ethers utils (forwarded to ethers v6 per user)**: re-export parseEther/formatEther/parseUnits/keccak256/
    id/AbiCoder/getBytes/hexlify/toUtf8Bytes/ZeroAddress/MaxUint256/SigningKey/Mnemonic/getCreateAddress/... + v5
    shims `BigNumber`, `getBigNumber`, `ethers.utils.*`, `ethers.constants.*`. DONE.
  - **WS11**: demo tests `test/{harness,ported-style,block-timestamp}.test.ts` (14 pass); `solidcash.config.ts`;
    vitest aliases (hardhat/chai/network-helpers). Migration-guide doc + expanded contracts still TODO.
  - **Regression**: SDK unit 770/780 pass (1 pre-existing `debugging.test.ts` BCH_2023_05 debug-log failure,
    provider-independent - `debug()` is pure libauth). BlockOracle e2e 52/52. mem-cash 331/331. Full e2e running.
  - **Pre-existing (NOT us)**: `test/transfer_with_timeout.test.ts` fails on `tx.time` covenant (fork codegen
    drift; reproduces with a plain provider; testing-suite is excluded from CI so it drifted). Out of scope.
  - **Still TODO** (see workstreams): hardhat-deploy analogue, `.deployed()` alias, receipt `.events[].args` +
    `.toObject()`, emit `.withArgs` positional/predicate polish, EIP-712 helpers, migration guide, more contracts.
- 2026-07-19: **DISCOVERED committed `packages/testing` (`@solidcash/testing`)** - the user's earlier, unused,
  less-complete Hardhat-style harness (stub loadFixture, non-ethers getSigners, no time-travel/chai). My complete
  harness lived in `solidcash/src/hardhat`. Surfaced the overlap; reverted the SDK-side `solidcash` bin.
- 2026-07-19: **CONSOLIDATED into `@solidcash/testing` (per user).** MOVED the 10 harness modules from
  `solidcash/src/hardhat/*` to `packages/testing/src/*`, rewiring their external imports to the `solidcash`
  package; replaced the earlier incomplete files. Removed `solidcash/src/hardhat` + the harness subpath exports +
  the stale dist; exported `SnapshotRestorer`/`MOCK_DEFAULT_BLOCK_TIME` from `solidcash`; moved `ethers` to the
  SDK's devDeps and added it to `@solidcash/testing` deps. Added `@solidcash/testing` exports map + kept its
  `solidcash` bin (`dist/cli.js`). Updated the testing-suite (aliases -> `@solidcash/testing[/chai|/network-helpers]`,
  demo imports, config, package.json dep, README). Rebuilt solidcash + `@solidcash/testing` clean; testing-suite
  17/17 green; CLI works; lint clean; SDK sanity green. Regenerated (un-staled) artifacts kept.
- 2026-07-19: **Real-world drop-in validation - EA `marketplace.test.ts` (`examples/effectiveacceleration`).**
  Copied EffectiveAcceleration's Hardhat project and ran its 3357-line, 66-test `marketplace.test.ts` under
  `@solidcash/testing` with ZERO test edits (pure vitest `resolve.alias` + a `vitest.setup.ts` `initHre()`).
  All 66 tests LOAD + RUN under our harness; they fail uniformly at the contract layer
  (`getContractFactory("Unicrow")` -> no artifact) - the Hardhat/ethers/chai plumbing is proven; remaining =
  porting ~6 contracts to `.scash`. Details + roadmap: `examples/effectiveacceleration/PROGRESS.md`.
  **Portbacks landed:** `ethers.getContractFactory("Name")`/`getContractAt`/`deployContract` resolve artifacts
  BY NAME from `config.paths.artifacts` (`loadArtifactByName`); config-driven LAZY `ethers`/`network`/`config`/
  `run`/`hre` exports (Proxies over the active HRE singleton, so a setup-file `initHre()` applies);
  hardhat-shaped `config` (`config.networks.<n>.accounts.{mnemonic,path,count}`); `getSigners` honours the
  config mnemonic + derivation path (`MockNetworkProvider.getSigners/getSigner` gained `path`); `containSubset`
  chai matcher. `viem` + `@noble/ciphers` installed at the monorepo root. testing-suite still 17/17.
