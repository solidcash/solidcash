# Handoff: SolidCash 0.51.0 and what is open (2026-11-16)

This note is for whoever picks the work up next, human or agent. It records where the branches are, how the work
was run, what the user decided, and every item still open, with pointers. The scripts it names are in
[`scripts/`](scripts/).

## Where things are

- **SolidCash 0.51.0 is out** (2026-11-16). The six packages are on npm as `latest`, published from master at
  `eda85a88d`, which is tagged `v0.51.0`. Master and the tag are pushed to `origin`
  (`github.com/solidcash/solidcash`). [Publishing](#publishing-2026-11-16) says how it went.
- **master** merged `release/0.51.0` (`5b9c9d712`), then took `eda85a88d`, which gives testing, solidhat and
  create-solidhat the pack rules utils and solidc have. Before the merge, master was at `a04d90c7c`, which
  `release/0.51.0` already contained.
- **`post-0.51.0`** (worktree `/Code/cashscript/.worktrees/post-0.51.0`) carries the work after the release:
  - the `gitHead` fields dropped;
  - the lint cleared;
  - the publishing notes;
  - this handoff;
  - then the open items below.

  Master moves to it only by a fast-forward. Neither is pushed past the tag.
- **`release/0.51.0`** (worktree `/Code/cashscript/.worktrees/release-0.51.0`) was the release candidate:
  `deployer-spec` at `7d8fb3900`, merged with master (`6c32f972a`), then a raw-call probe fix (`ed9de1ad9`), a stale
  debug dump removed (`f9ca3e948`), the 0.51.0 version (`d0d7718b3`) and the docs. It is not pushed; master holds it.
- **`deployer-spec`** stays at `7d8fb3900`, the line before the master merge.
- **What 0.51.0 contains**: 616 non-merge commits since 0.50.1 (`mainnet-final`, `95f051c36`). These comprise:
  - master's 2026-11-11 landing (the sushi line, caller edges, void-call binding, the single-container pragmas);
  - the other party's `deployer-coins` work (deployer coins, from 2026-11-12);
  - this line's fixes on top: the deployer spec, call targets, ecrecover parity, nested callers and loop payments.

  `CHANGELOG.md` and `website/docs/releases/` say what changed for users.

### Release verification (2026-11-16)

- **Merge check.** 57 SDK files that make low-level, raw, compat or nested calls ran once on the merged tree. 396
  passed and 1 failed: master's new `CompatCallFullCalleeBlock`, fixed by `ed9de1ad9`. The probe-fix set then
  passed: 13 files, 84 of 84.
- **Version bump.** `test/generation`, `test/compiler` and `CashScript014Port` passed after the bump: 673 of 673.
- **Full suites, once, at `d0d7718b3`.** Approved by the user. The results are in [Full run](#full-run) below.
- **Bytecode against 0.50.1**, measured with `scripts/compare-bytecode.mts`:
  - the stateless examples and a framed counter are unchanged;
  - a direct counter grows 1,231 → 1,416 B;
  - an evmCompat ERC20 grows 4,880 → 5,184 B.
- **SolidPool's pools** against the `deployer-coins` build SolidPool links today: BchPool 4,865 → 4,948 B and
  TokenPool 5,896 → 5,986 B. The two deployers keep their sizes, but their bytes change because the child lock
  changes. 0.50.1 cannot compile the pools at all, since it lacks `pragma satoshicontainer`.

### Full run

At `d0d7718b3`, once, on a snapshot worktree:

- **solidc:** 527 files, 8,067 tests: 8,061 passed, 6 skipped, 0 failed (14 min).
- **utils:** 580 tests, 579 passed. The failure was a stale expectation in `StateDecodeCanonical`: a one-byte `bytes`
  value encodes as its minimal push since `0c21df4b2`. Fixed in `0fdd163bf`; the file then passed, 13 of 13.
- **testing:** 165 of 165.
- **solidhat:** 73 tests: 70 passed, 1 skipped, 2 failed in `init.test.ts`. Both failures come from the worktree
  layout:
  - `create-solidhat` had no build;
  - the generated project's `node_modules` link lacked `vitest`, because worktrees reach third-party packages by the
    upward lookup.

  With both fixed, the file passed: 22 passed, 1 skipped. `mkwt.sh` and `full-run.sh` now handle both.
- **solidcash:** the whole package including e2e. 1,781 files, 10,986 tests: 10,763 passed, 0 failed, 215 skipped,
  8 todo (86 min). The skipped and todo counts are those of the 2026-11-12 release battery: 191 + 24 skipped,
  5 + 3 todo.

Every package suite is therefore green at the release candidate, apart from the stale utils expectation fixed in
`0fdd163bf` and the two solidhat cases that need a full `node_modules`.

### Publishing (2026-11-16)

- **Pack rules.** testing, solidhat and create-solidhat had none. Their tarballs would have carried `src/`, `test/`,
  the build's `tsbuildinfo` and their vitest configs, and solidhat's its `docs/` notes. `eda85a88d` gives them
  utils' `.npmignore`, so all six ship `dist` only. The tarballs hold:

  | Package | Files |
  |---|---|
  | utils | 126 |
  | solidc | 618 |
  | solidcash | 1,752 |
  | testing | 81 |
  | solidhat | 75 |
  | create-solidhat | 9 |

  utils, testing, solidhat and create-solidhat have the file counts of their 0.50.0 tarballs.
- **Gates.**
  - A clean rebuild of all six from the tag.
  - The package smoke (`yarn test:package-smoke`) on that rebuild.
  - The suites had passed on the same package code: only a utils test changed after `d0d7718b3`.
  - Lint was skipped at the user's word. solidc and solidcash failed it with 106 style errors, all in test files;
    they were cleared after the release on `post-0.51.0`.
- **How.**
  - `yarn publish-all --ignore-scripts` published utils, then npm asked for the second factor again.
  - The account's second factor is a security key. npm refuses the write and prints a sign-in link. The user
    signs in there and gets a one-time password, and each password publishes one package. npm then accepts writes
    without a password for a few minutes.
  - npm also processes a publish asynchronously, so lerna's `from-package` saw utils as missing and would have
    published it again.
  - The other five therefore went out one at a time with npm itself. [`scripts/publish-one.sh`](scripts/publish-one.sh)
    is that procedure, made general.
- **Checked afterwards.**
  - npm's checksums equal those in the publish logs.
  - A fresh install of the six from npm holds one copy of each.
  - Its `solidc` reports 0.51.0, compiles `pragma solidcash ^0.51.0`, and refuses `^0.50.0`.
- **Metadata.** On npm, solidc and solidcash 0.51.0 name `bf02a4b6…` as their `gitHead`, as solidcash 0.50.1 did.
  The 2026-06-11 rename copied that field into their `package.json` from the upstream packages, and npm keeps a
  `gitHead` the manifest already has. `15e1020f5` drops the field, but a published version keeps its metadata.

## SolidPool (bch-next) on 0.51.0

SolidPool needs this release: its contracts use `pragma satoshicontainer single`, `pragma tokencontainer single`,
`this.payMinerFee` and deployer `new`, none of which 0.50.1 has.

bch-next rebased its contracts on 0.51.0 on 2026-11-16. The commits are `4ce6491` and `fe2cd91`, on its master,
`browser-native-engine` and `pool-contracts`. Its `package.json` still names the 0.50.x packages, though, and its
`Dockerfile.indexer` installs them from npm. Adopting 0.51.0 is SolidPool's own release step:

1. Pin the five `@solidcash/*` dependencies to 0.51.0, now on npm, and drop any local links.
2. Change `pragma solidcash ^0.50.0` to `^0.51.0` in the six contract sources. The artifacts embed the source
   and are regenerated in the next step.
3. Regenerate the artifacts (`npm run contracts:build`). They are stale even against the `deployer-coins` link,
   and `contracts:check` fails today.
4. Rebuild the browser bundles (`web:build`), re-measure the README's numbers, and run `npm test`. That covers
   `contracts:check`, `verifier:check`, the four contract test files, `wallet-signing`, `app-flows` and the service
   tests.

   Steps 2 to 4 were rehearsed on 2026-11-16 in a sandbox: a clone of bch-next's HEAD (`9e46da1`), its
   `@solidcash/*` linked to `release/0.51.0`. The six pragma lines changed, `contracts:build` regenerated eight
   artifacts, and every step of `npm test` passed:
   - `contracts:check`: all six match their sources;
   - both verifier checks;
   - the contract tests: 23 passed, 1 skipped;
   - `wallet-signing`;
   - `app-flows`;
   - `tamper` and `forge`.

   `extract-vk.ts` resolves `Verifier.sol` as `../tornado-core` beside the repository. A clone placed elsewhere needs
   the path as an argument.
5. Redeploy: the pools' addresses change.

**The independent review** ([CONFORMANCE-0.51.0.md](CONFORMANCE-0.51.0.md)) checked whether the code 0.51.0
compiles for the pools and deployers enforces what their sources and docs state.

- **Counts.** 70 rules: 67 enforced, 1 not enforced as worded, 2 unclear. No compiler defect was found.
- **For SolidPool to settle:**
  - **T9.** `TokenPool.deposit` checks only that an asset coin's lock is 25 bytes long (`TokenPool.scash` line 202),
    while the README says a P2PKH. The reviewer found no consequence, and only a miner can make such a coin.
  - **U1 and U2.** `withdraw` relies on the Groth16 verifier's coins for "the master is input 0" and for the
    statement offset. The verifier is not compiled by SolidCash and was not reviewed.
  - **README.** Three places under "Pool deployers" are stale against 0.51.0, all in the safe direction:
    - creations the README says the chain takes are rejected now;
    - an honest satoshi coin needs at least 1,200 sat;
    - a token creation through `new` builds.

Findings from committing bch-next's pending work on 2026-11-15. Not acted on; bch-next is not this line's to change:

- **Not pushed:** 17 commits on `pool-contracts` (`189da99..7a23e94`).
- **Deployer artifacts stale:** they no longer match the linked SolidCash.
- **Bundle embeds an uncommitted tree:** the committed bundle embeds `groth16_composed`'s uncommitted working
  tree.
- **README contradicts the code:** the README says no page reads PoolCreated, but the indexer does.
- **Disclaimer lost:** the redesign commit `25192b7` dropped the UI footer's "Not audited. Use at your own risk."
  and its Terms button.
- **Smaller items:**
  - audit evidence cites `/Code/tmp` paths;
  - `devnet-account.ts` holds a fixed key (local chain only);
  - `Dockerfile.indexer` uses registry packages;
  - the IndexedDB transaction cache is not verified by hash.

## How the work was run

- **Agents and lander.** Agents work in their own worktrees (`scripts/mkwt.sh <name> <base> --branch`) and leave
  patches or commits. The lander commits them, cherry-picks them onto the line, and typechecks every commit
  (`scripts/tc-commits.sh`).
- **Agent test discipline.** The repository's `CLAUDE.md` ("Agent test discipline") governs agents: they read the
  code and run their own new or changed tests once, with no probes, suites, neighbours or corpus compiles. The
  lander runs those.
- **No wide runs without approval.** Test runs name files (`scripts/union-run.sh`, which refuses an empty list). A
  whole package suite needs the user's approval each time (`scripts/full-run.sh`). Once, a missing list file turned
  a union run into a full solidc run; that is why the empty-list guard exists.
- **Compiler changes.** Size pins, hashes and drift tripwires live in test files. When a compiler change moves
  bytes, find them by running every test file that pins a size or hash. Compare a change across the corpus with
  `scripts/corpus-snapshot.mjs` (352 `.scash` files), and across the release samples with
  `scripts/compare-bytecode.mts`.
- **Commits.** Commit in logical chunks, each typechecked. Take every number in a message from a measurement. Push
  only when the user asks.
- **Never touch:**
  - `/Code/cashscript` itself: never `cd` there, and run git from a worktree. Master is checked out there, so a merge
    or fast-forward of master the user asks for runs as `git -C /Code/cashscript`;
  - `git stash`;
  - the `deployer-coins` worktree (another party);
  - tornado-36's `deployer-genesis-pins`;
  - `/Code/tornado/bch-next` and `groth16_composed`.
- **The next version bump.** `scripts/bump.py` did this one: edit its version pair and run it with `--dry` first.
- **Landing checks learned after the release** (2026-11-16). A TARGET-6 over-refusal reached the local master
  because:
  - the union that landed it did not list the test that compiles the EACC Marketplace;
  - the next union reported that test's four cases as skipped, not failed. It skips when the EACC checkout seems
    missing, and the checkout was there, so a file check failed under load.

  So a landing now also:
  - compiles the EACC corpus (`/Code/effectiveacceleration.ai/contract/contracts/*.sol`, `evmCompat`) with the
    released and the new compiler, and compares the results;
  - compares every union's skipped tests, file by file, with the release's full run (`full/*.json`).

  On the `/Code` mount, a cherry-pick of several commits in one command can stop with a spurious "local changes
  would be overwritten"; pick one commit per command.

## What the user decided

- **Deployer coins.** The deployer-coins spec
  (`docs/wip/deployer-coins/solidcash-new-through-deployer-coins.md`) was cleared on 2026-11-12, scope accepted.
  SolidPool keeps two registries (BCH pools, token pools) when it moves to deployer `new`.
- **The spec work.** "Do all remaining work towards completeness, soundness and security of the spec" (2026-11-14)
  covered:
  - each arm's exact-stack check placed literally first, which changes every direct address;
  - `genesisCalls` on by default.
- **Call targets** (2026-11-15):
  - computed call targets keep the spender's witness and warn;
  - a raw call with a payload must run its target;
  - a loop's view answers are kept only for keccak256-computed targets, with a warning;
  - a typed payload reads the callee's record;
  - a plain send answers `(true, "")` only.
- **The release** (2026-11-16): version 0.51.0, the full suites run once, then an independent review by a Fable
  model. Its findings come to the user; they are not merged on their own.
- **Publishing** (2026-11-16):
  - master carries 0.51.0, and the tag `v0.51.0` points at master;
  - publish the six packages, skipping lint;
  - push master and the tag;
  - then finish the lint, fix this handoff, and go on with the open items.

## Open items

Each item has its home doc; this list gathers them. The security ledger is
`docs/security/security-audit-2026-10-16.md` ("Call targets", "Container sums" and the older "Open" sections). The
spec status is in `docs/wip/deployer-coins/solidcash-new-through-deployer-coins.md`.

**After the release (2026-11-16).** The agents of `nested-guard`, `keccak-band` and `raw-send-target` worked the items
below. Each worked on its own branch, and the lander landed the result. None is still running. What they found and
left is listed under the classes further down.

**Landed after the release** (on `post-0.51.0`):

- **The two known issues from 0.50.0** (`f5185b232`, `071e8a69c`), both reproduced on 0.51.0 first.
  - A nested callee's external call under a false `block.number` or `block.timestamp` guard spent the callee,
    because discovery gave the guard no block clock. The clock now comes from the pool coin the callee's run reads,
    and call arguments that read the block resolve.
  - A called contract's only conditional call, when not made, named an input that is not the callee, so every such
    run was refused. It is now stated as not made (-1), as at the root.
  - Checks: `NestedCalleeBlockGuard.e2e` passed 4 of 4 (0 of 4 before the fix). A union of 125 nested-call SDK
    files passed: 1,129 tests passed, 3 skipped, 0 failed.
- **A called contract's undecided guard** (`42478d5ef`, `5a1ade82d`, `28ff018a3`, `b6e82bcfa`, `c481c8ef1`).
  - Discovery kept a call under a guard it could not evaluate, so a false guard spent the callee. Examples are a
    guard reading an earlier call's result, or a mapping entry.
  - It now decides the guard in the called contract's frame, with the block clock, the entries the guard reads and
    the earlier calls' results. Otherwise it refuses by name (`CallGuardUndecidedError`).
  - The compiler publishes `conditionUnpublished` for a call under a guard it cannot write down. It is ABI only, so
    no bytecode moves.
  - The late pass and the delegatecall path read the block clock. A delegate's callee or a late frame states a
    skipped single call as -1.
  - A false `require` on the block before a called contract's call is refused by the VM.
  - Checks: `NestedCalleeGuardDecision.e2e` passed 2 of 2, `NestedCalleeOtherPathsGuard.e2e` 4 of 4, and
    `NestedCalleeBlockGuard.e2e` 5 of 5. A combined union with the keccak follow-ups also passed. It covered every
    nested-call, delegatecall, keccak256, side-car, chunk and artifact test: 93 solidc files (3,445 passed, 10
    skipped) and 356 solidcash files (3,148 passed, 16 skipped), none failed.
- **The keccak256 trailing band** (`d924cd68b`, `c23ca4de0`, `612da652d`, `9f47268d7`; follow-ups `d7b8083c7`,
  `3aa7d6af8`, `aed354f3a`).
  - A chain beside a collection walk or a dynamic write took the same indexes after the block as the walk's
    entries or the write's new chunks. It is now refused (`keccak-chain-shares-trailing-band`).
  - A chain beside chunks it only reads, and a loop beside read chunks with a mapping loop, per-turn payments or
    events, compiled but could not be spent: the SDK put the chunks before the side-cars. The SDK now puts the
    side-cars first, and each shape spends on the VM, with tamper cases refused.
  - A loop after a mapping loop beside read chunks is refused, because the compiler's own indexes disagree. A loop
    with read chunks and an external call is refused by the SDK, whose output assembly cannot lay it out.
  - Checks: the four new or changed test files passed (3, 1, 5 and 4 tests). Across the corpus snapshot of 352
    files, nothing is newly refused and no bytes or ABI moved. A union of every file that names keccak256, side-cars
    or dynamic chunks passed: 51 solidc files (2,062 passed, 6 skipped) and 167 solidcash files (1,632 passed, 12
    skipped), none failed.
  - Follow-ups:
    - A chain beside a mapping loop, per-turn payments or events collided too, because the runs' cursors start at 0
      and only a keccak256 loop seeds them; it is refused now.
    - `612da652d` had refused a loop beside a read and a fixed sorted write, which works; `d7b8083c7` lets it
      compile again.
    - Side-cars and read chunks beside a fixed sorted write now spend: `KeccakSideCarsBesideSortedBatch.e2e`, 4 of 4,
      with tamper cases.
    - The corpus is still unchanged, and the combined union below covers them.
- **DELEGATE-1, an expression-form delegatecall not pinned** (`5aee903a3`; CRITICAL for the contracts it reaches).
  The ledger's "Delegatecall target" section has the details.
  - With `(bool ok, bytes data) = impl.delegatecall(input)`, a spender could co-spend any implementation, or none,
    and set the caller's state; it was VM-confirmed on the 0.51.0 code.
  - The statement form, library calls and the SDK's default proxy were pinned all along.
  - 0.50.1 has the same code, by reading.
  - No corpus, example or SolidPool contract uses the expression form.
  - A 0.51.1 patch release is the user's decision.
- **TARGET-6, a low-level call bound to its target's value before the function wrote it** (`ea5d53251`,
  `ad4a6b785`). It now binds the written value where it runs, or is refused by name.
  - Follow-ups:
    - message-bus routes (`8af553985`);
    - framed and constructor refusals (`d3f89113b`);
    - the SDK's auto-wiring (`c07b59e3f`);
    - a field-path test for "written first" (`a54d42e9e`, `95325fdbe`).
  - The field-path fix repairs an over-refusal of the first version. It had refused the EACC MarketplaceV1 to V3
    ports, which 0.51.0 compiles, on the local master only. See the landing checks under "How the work was run".
- Checks for both:
  - `DelegatecallTargetPin` passed 24 of 24 (6 failed before the fix);
  - `LowLevelCallSiteTarget` passed 10, and its e2e 9;
  - the 352-file corpus is unchanged (no bytes or ABI moved, nothing newly refused);
  - a union of every file on low-level calls, delegatecall and call targets, plus the release's merge-check list
    and the size-pin candidates, passed: 108 solidc files (3,189 passed, 6 skipped) and 259 solidcash files (2,156
    passed, 13 skipped), none failed.
- **The root path's undecided guard and the short-circuit condition** (`0f37960bc`, `03a33de2d`, `e175c40c7`,
  `676ba27b4`, `5db31ec0e`).
  - A root raw call to a callee that reads no `msg.sender`, under a guard the SDK could not decide, was made on a
    guess. On the VM, the callee was spent with the guard false. It is now refused by name, unless a caller edge
    guards it; a typed call has one, so the caller's covenant refuses the false case.
  - A call in the right operand of `&&` or `||` inside a branch was published with the operand alone. On the VM,
    the callee was spent with the branch false. The condition now includes the branch.
  - The late pass refuses an undecidable guard, and discovery refuses an unplannable loop, unless an edge guards it.
  - MasterChef's `deposit` and the Sushi tests still pass.
- **Checks for the TARGET-6 follow-ups and the root-path work**, run together in the lander worktree `land-3`:
  - a superset union of 141 solidc and 824 solidcash files, covering the split, delegate, nested, keccak,
    root-call and artifact tests. Its only failures were the over-refusals the field-path fix then repaired: four
    cases in solidc and one framed case in solidcash. Its skips matched the release's full run, file by file.
  - after the fix: the corpus is unchanged, and the EACC corpus compiles as with 0.51.0. A union passed of the
    low-level-call lists, every framed call and conformance test, the route tests and the Marketplace test: 109
    solidc files (3,199 passed, 6 skipped) and 424 solidcash files (2,857 passed, 29 skipped), none failed. Its
    skips matched the release's full run.
**Soundness, documented:**

- **Computed call targets** (TARGET-3, by decision): the callee is the spender's witness, and every such call
  compiles with `[computed-call-target-unverified]`.
- **Hidden `false`** (TARGET-5, by decision): an opaque `bytes`, selector-literal or `abi.encodeWithSignature`
  payload can still hide a callee's `false` behind `(true, "")`.
- **Left after TARGET-6** (by reading, not run on the VM; the ledger's "Call targets" Open list has them):
  - under `evmCompat`, a cached mapping-entry field write under another key can leave the call on the old target
    when the keys are equal;
  - a call through a field of a memory copy, made after a write of that field, binds the written value;
  - a statement-form value call through a stored struct field crashes code generation.
- **20-byte lock** (LOW, needs a miner): an output with a 20-byte lock is non-standard but valid in a block, and
  under `evmCompat` it could stand for an EVM address.
- **CONTAINER-SUM-1:** not determined whether 0.50.1 is affected, because the test's honest spend does not build
  on the 0.50.1 tree. CONTAINER-SUM-2 is VM-confirmed on 0.50.1 (message-bus kernel routes, experimental there).
- **Guards the SDK decides at build time.** The root, discovery, the late pass and the delegatecall path now decide a
  guard or refuse it (see "Landed after the release"). What remains:
  - an explicit `withExternalCall` list at the root evaluates no guard, so an edgeless call named there can still
    be spent uncalled;
  - guards are decided on the state and call results as they are when building. An earlier call in the same
    transaction that changes them is not modelled.
  - The delegatecall path refuses an unpublishable guard even for a callee that reads `msg.sender` and would get an
    edge. This is conservative, not unsound.

  An early `return` and a ternary arm do carry their conditions; that was checked from the compiler.

**Refused by name (fail closed), could be built later:**

- a constructor that writes its call target after the call, since the genesis body's after-body check reads the
  variable;
- two calls through one variable reassigned between them;
- a payment from a message-bus participant compiled direct-only;
- a typed `{value:}` call to a co-spent callee, whose payment would be stuck at its master lock;
- a called contract's own `blockhash(n)` read, and a called contract's low-level call with a payload;
- `tx.origin` passed on through a callee laid out by its ordinary build.

**Not refused yet:** none known. The two keccak256 items listed here at the release are settled: a chain beside a
mapping loop, payments or events is refused, and side-cars beside a fixed sorted write work.

**Found during the 0.51.0 merge and after (SDK, fails closed):**

- A fixed mapping write or read before a keccak256 loop stops the loop's probe. The probe stands an `OP_TRUE` coin in
  each entry slot, and the write checks its proof input inline. The call then fails at the VM. A chain has no probe
  and is not affected.
- An evmCompat root that makes a typed call and a compat low-level call was refused at input 0 in an agent's test.
  It is not explained: finding out needs diagnostic runs, which the agents' test rule leaves to the lander.

- Master's compat-call callee groups (`7766bf6f5`) are materialized after transitive discovery, so they get no
  nested refusals and no transitive callees. A compat callee that itself calls on, reads `blockhash` or makes a
  low-level call fails at the VM rather than by name.
- The raw-call read probe (`_deriveReturnValue`) cannot lay out a callee block beyond master, data records and
  record. `ed9de1ad9` now skips the probe there, and the co-spend's preflight decides.

**Tests and docs missing:**

- no test of a typed `{value:}` call through a call-site register to a stateful callee;
- the framed `evmCompat` exact-byte ecrecover comparison;
- `eventValueOfArgument` covers scalars only;
- the collection-chain SDK flag is static;
- `deploymentRecipes.ts` records a transfer's recipient as written, not as the P2PKH lock it pays;
- no script typechecks the test files (vitest strips the types). Under `tsconfig.framed-tests.json`, the 24 files
  the lint touched hold 61 type errors, all older than the lint (found 2026-11-16).

**Won't fix:**

- Recovery to R = ±G or ±φ(G). It needs a new side-car type that changes shared locks, and affects only nonce
  1, -1 or λ signatures.

**Other parties:**

- The `deployer-coins` branch (another party's) still has the A7 constructor-call holes that `deployer-spec` fixed.
  `release/0.51.0` supersedes it, but its owner should know.
- tornado-36's `deployer-genesis-pins` (`04c92f528`) is contained in this line; the worktree stays theirs.

## Worktrees and branches

Under `/Code/cashscript/.worktrees`:

**Keep:**

- `post-0.51.0`, the line after the release;
- `release-0.51.0` and `deployer-spec`, until the user says otherwise;
- `release-review`, until the conformance review has been read: it holds the review's tests and their verdicts.

**Worktrees after the release.** The agents' worktrees (`lint-0.51`, `keccak-band`, `nested-guard`,
`raw-send-target`) and the lander's (`land-2`, `land-3`) were removed once their work had landed. Their branches stay.

**The release is out, so these can go, on the user's word:**

- `release-0.51.0-full`, the full-run snapshot;
- `release-base-0.50.1`, the 0.50.1 build used for the comparisons;
- `deployer-spec-tc`;
- `deployer-complete`, `deployer-fixes` and `deployer-trial`, all frozen history.

**Not this line's:**

- `deployer-coins`;
- `deployer-genesis-pins`;
- `tornado-framed`;
- `tre`.

The 25 agent branches `deployer-spec-*` (busgen through transitive) are all merged by cherry-pick and can be
deleted.
