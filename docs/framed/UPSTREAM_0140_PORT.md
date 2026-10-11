# Porting CashScript 0.14.0 onto SolidCash

Branch `feat/port-cashscript-0.14`, forked from `feat/per-call` at `738115ba9` (2026-10-11), worktree
`.worktrees/port-0.14`. Upstream: tag `v0.14.0` (`5f0eaffb6`), fork point `a34616620` (v0.13.0, the parent of our
scaffold commit `d3aa31f17`). 80 non-merge upstream commits lie between them.

Method: no merge and no patch replay (`W8_PORT_DECISION.md` measured both). Each upstream commit is judged by the
shape of the code it changes: where our tree has the same shape, the behaviour is ported onto the renamed files
(`cashc` -> `solidc`, `cashscript` -> `solidcash`); where our tree implements the feature its own way, or the
feature belongs to the CashScript language rather than ours, it is recorded and left alone. Breaking API changes
are ported with the old names kept as deprecated aliases, so existing callers keep compiling.

Decisions: **PORT** (ported here), **HAVE** (already in our tree, ours or an earlier port), **OWN** (our tree has
its own design for the feature; nothing to take), **N/A** (does not apply to SolidCash), **SKIP** (deliberately not
taken, reason given), **HELD** (built and measured, waiting on a decision).

Landed on this branch: `3de9e5652` (builder, signature template, arguments), `2431de781` (debugging),
`19702c923` (network providers), `fafd303c7` (compiler). Tests: `packages/solidcash/test/CashScript014Port.test.ts`
and `packages/solidc/test/CashScript014Port.test.ts`.

## SDK (`packages/cashscript` -> `packages/solidcash`)

| upstream | subject | decision | notes |
|---|---|---|---|
| `8964e5d7c` | `MockNetworkProvider.addUtxo()` returns the UTXO | HAVE | `addUtxo(): Promise<Utxo>` |
| `57ca18b17` | `TransactionBuilder.calculateTransactionFee()` | PORT | |
| `1024ddf5f` | more local `TransactionBuilder` validation | PORT (part) | typed errors with the existing messages; NFT commitment length against the provider's `consensusLimits`. Tx size, unlocking size, OP_RETURN size and minimum fee are already decided at `send()` by the finalized-byte gate and the mock's relay policy, so they are not duplicated in `build()` |
| `3a9b337a7` | `includePrerelease` in the debug compiler version check | PORT | |
| `7bcaf86dc` | SDK debugging for user-defined functions | OWN | `debugging.ts` attributes failures inside `OP_INVOKE` bodies through `invokeDebug` |
| `a5ce8c4f5` | stack trace for failing requires inside functions | PORT (adapted) | built on our `invokeDebug` frames, upstream's `  at fn (file:line) - statement` format |
| `981eb07f1` | `SignatureTemplate`: `SighashType`, properties instead of getters, no `bchForkId` | PORT (compatible) | new names added; `HashType`, `getHashType()`, `getPublicKey()`, `getSignatureAlgorithm()` stay as deprecated aliases |
| `616996b5a` `ee2804c3b` | mock: resubmitting a transaction warns instead of throwing | SKIP | our mock models node acceptance, and a node refuses a transaction it already has |
| `f05ef0dd5` | size placeholder P2PKH inputs at their signed size | PORT | |
| `a39275c9a` | input `lockingBytecode`, unlocker mismatch check, mock tx validation | PORT (adapted) | a UTXO that states its `lockingBytecode` (ours is an optional `Uint8Array`) is refused when a contract, P2PKH or placeholder unlocker spends another lock; checked at build time against the signed source outputs, since stateful composition can rebind an unlocker after `addInput`. Providers do not start setting the field on every listing (framed reads match category listings by it). `Unlocker.generateLockingBytecode` stays: our side-car, framed and message-bus unlockers build source outputs from it. Electrum protocol 1.5.0 and `headers.get_tip`: PORT. Our mock already validates every transaction (mem-cash), including locktime finality |
| `4982ce5b8` | electrum-cash 4.4.0, vitest 5 | SKIP | dependency bumps; lockfile pinned (`W8_PORT_DECISION.md`) |
| `a1ce2bc14` | SDK audit findings | PORT (part) | invalid hex and `pubkey` length in arguments, `setLocktime()` range, `send()` no longer reports a retrieval failure as a failed transaction, fee-per-byte display rounding, final `require(variable)` attribution, mock txid case. Electrum request counting and mock lock-hex case: HAVE. Mock non-final locktime: HAVE (mem-cash `bad-txns-nonfinal`). Vitest 5 matcher types: SKIP (we are on vitest 4) |
| `233ec9fa4` | do not misreport a VM resource limit when debugging | PORT | |
| `5e46aa7f7` | log reassigned variables after their final use | HAVE | `9fd44ec92` |

## Compiler (`packages/cashc` -> `packages/solidc`)

| upstream | subject | decision | notes |
|---|---|---|---|
| `cd1c74589` | custom syntax error listeners | HAVE | `ast/error-listeners.ts`, `CompilerOptions.errorListener` |
| `5d8f3cba2` | export `ast/Location` | HAVE | |
| `b7119e195` | location data in tuple assignment errors | HAVE | symbol table and type check both stamp `node.location` |
| `1597840a1` | `ParseError` messages | HAVE | `normaliseSyntaxErrorMessage` |
| `42e8ad81d` `3e82d2ae0` | source tags for scope cleanup and loop condition | N/A | extends 0.13.0's source-tag annotations, which our generator never adopted |
| `009e11c5f` `3a6cfd245` | user-defined functions, multiple return values | OWN | Solidity internal and free functions, `OP_DEFINE`/`OP_INVOKE` |
| `5c681ffd8` `1903a3476` | global constants, constant arithmetic | OWN | file-level `constant` definitions |
| `e491f8fcd` | push overhead in the function inlining size check | N/A | upstream's inliner |
| `b3471bbdd` `ff9e63143` | in-memory import resolution, shared resolution | OWN + PORT | `importResolver` / `createMapResolver` are ours; upstream's `compileString(code, { files })` is added as a shorthand. Upstream's `warningListener`: SKIP, our warnings are console output with `suppressWarnings`, and inner variant compiles suppress theirs, so a listener needs the warnings collected at their sources first |
| `79efcf08e` | pragma version handling for imported files | PORT | `VersionError` names the imported file whose pragma failed |
| `687f70e1e` | imports from `node_modules` | HAVE | `compileFile`'s resolver walks up `node_modules` |
| `ab739817b` `07a1667b7` | reassignment inside tuple assignments | OWN | existing-lvalue tuple slots; mixing them with declarations stays refused, as in Solidity |
| `faa73a446` `a16604059` `7b699480a` | `unused` modifier; unused variables warn; dead-assignment warning | N/A | our compiler never refuses an unused variable (Solidity semantics) |
| `40d7e01e5` | date literals parsed in UTC | PORT | |
| `d2e359342` | compiler audit findings | HAVE | `4e570d684` (tuple narrowing deliberately skipped there, reasons in its message) |
| `9459e33fb` | `slice()` variable final use | HAVE | `SymbolTableTraversal.visitSlice` visits end before start |
| `c43df8892` | nulldata chunks over 255 bytes at runtime | PORT | |
| `4f157e241` | for-loop init that reassigns | HAVE | our `for` is lowered before codegen; upstream's scenario passes and is now a test |
| `e97d4c367` | doc comment on int parameter enforcement | SKIP | comment only |

## Optimiser (`packages/utils`)

| upstream | subject | decision | notes |
|---|---|---|---|
| `425e9bd66` `0a48bbc98` `37bf465dd` `52c2b43f7` `1849769f5`, rule in `ab739817b` | peephole rules | HELD | see below |
| `202ec4d23` | remove the old optimiser | SKIP | ours is the compatibility oracle |
| `498b9ea20` | optimiser speed | OWN | our engine has its own conversion hoist and compiled rules |

## Not taken: docs, website, CI, versions, fixture layout

`1ef2f3d87` `5303f9949` `52b2be621` `92bd877d0` `02e63a00f` `dd3694442` `53f286b59` `53bee2336` `14f7c06b2`
`42be08910` `1c37959fc` `9f7662bd9` `387e3b792` `d8b1c35fe` `71a243b65` (docs, website, spellcheck, CI);
`b5248b51a` `a4f112abb` `790d4a2c6` `2fe39181a` `6ec38a408` `5c16940e7` `61a4b6a10` `bd95aa5b7` `3ed8b46bb`
`2a2e0507f` `ac35856e7` `b79b93b53` `3bef546c1` (versions, dependencies); `ab46c4905` `45b3fbce7` `625d84426`
`4c46aa351` (their fixture layout and tests).

## The peephole rules (HELD)

Upstream's new rules were applied to both engines, appended after every existing rule in the same order (so
`optimiseBytecodeOld` stays an exact cross-check), without upstream's two `OP_3DUP` rules, which upstream itself
disabled for their operation cost. Measured on the 301-contract `valid-contract-files` corpus
(`scripts/bytecode-size-bench.ts`, `scripts/density-headroom.ts`), 2026-10-11:

- 90 of 297 compiled contracts change; total script bytes 103,002 -> 102,558 (-444, -0.43%); largest cuts
  `event_anonymous_mixed` -7.7%, `event_overloaded` -4.4%, `event_multiple` -4.2%; one contract grows 1 byte
  (`msg_sig_data`, 112 -> 113).
- The cross-check holds on every contract (same 4 compile refusals as the baseline, all security refusals).
- Script-derived operation-cost budget 92,143,200 -> 91,788,000 (-0.39%), up to -2.8% for one contract
  (`address_code`).

They are not landed because of the trade `outlining_vs_operation_density` recorded: for a p2sh32 spend every byte
removed is 800 units of operation-cost budget removed, and a peephole rule saves only the cost of the instructions it
removes, so a straight-line spend loses headroom while a loop gains it. Whether ordinary spends should carry a
density reserve before more bytes are cut is a user decision. The patch applies cleanly on this branch; landing it
also re-pins the generation fixtures whose bytecode it changes.
