# Handoff: SolidCash 0.51.0 and what is open (2026-11-16)

This note is for whoever picks the work up next, human or agent. It records where the branches are, how the work
was run, what the user decided, and every item still open, with pointers. The scripts it names are in
[`scripts/`](scripts/).

## Where things are

- **`release/0.51.0`** (worktree `/Code/cashscript/.worktrees/release-0.51.0`) is the release candidate:
  `deployer-spec` at `7d8fb3900`, merged with master (`6c32f972a`), then a raw-call probe fix (`ed9de1ad9`), a stale
  debug dump removed (`f9ca3e948`), the 0.51.0 version (`d0d7718b3`) and the docs. **Not pushed, not tagged, not
  published.** Pushing, tagging `v0.51.0` and publishing the six packages to npm are the user's to start.
- **`deployer-spec`** stays at `7d8fb3900`, the line before the master merge.
- **master** carries 0.51.0: on 2026-11-16 it merged `release/0.51.0` in a merge commit, so its tree is the release
  branch's. Before that it was at `a04d90c7c`, which `release/0.51.0` already contained. Not pushed either.
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

## SolidPool (bch-next) on 0.51.0

SolidPool needs this release: its contracts use `pragma satoshicontainer single`, `pragma tokencontainer single`,
`this.payMinerFee` and deployer `new`, none of which 0.50.1 has. Today `bch-next/node_modules/@solidcash/*` are
symlinks to the `deployer-coins` worktree, which has none of the fixes since 2026-11-14. Its
`Dockerfile.indexer` installs 0.50.x from npm. Adopting 0.51.0 is SolidPool's own release step:

1. Pin the five `@solidcash/*` dependencies to 0.51.0 and drop the worktree symlinks.
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
  - `/Code/cashscript` itself: never `cd` there, and run git from a worktree;
  - `git stash`;
  - the `deployer-coins` worktree (another party);
  - tornado-36's `deployer-genesis-pins`;
  - `/Code/tornado/bch-next` and `groth16_composed`.
- **The next version bump.** `scripts/bump.py` did this one: edit its version pair and run it with `--dry` first.

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

## Open items

Each item has its home doc; this list gathers them. The security ledger is
`docs/security/security-audit-2026-10-16.md` ("Call targets", "Container sums" and the older "Open" sections). The
spec status is in `docs/wip/deployer-coins/solidcash-new-through-deployer-coins.md`.

**Soundness, documented:**

- **Computed call targets** (TARGET-3, by decision): the callee is the spender's witness, and every such call
  compiles with `[computed-call-target-unverified]`.
- **Hidden `false`** (TARGET-5, by decision): an opaque `bytes`, selector-literal or `abi.encodeWithSignature`
  payload can still hide a callee's `false` behind `(true, "")`.
- **Raw value-only send after a write of its target:** it pays the value the target had at the start of the
  function. The spender cannot choose it, but the EVM would pay the new value. The SDK refuses to fill the callee
  in. A compile-time refusal would be better.
- **20-byte lock** (LOW, needs a miner): an output with a 20-byte lock is non-standard but valid in a block, and
  under `evmCompat` it could stand for an EVM address.
- **CONTAINER-SUM-1:** not determined whether 0.50.1 is affected, because the test's honest spend does not build
  on the 0.50.1 tree. CONTAINER-SUM-2 is VM-confirmed on 0.50.1 (message-bus kernel routes, experimental there).
- **Known issues from 0.50.0, not re-checked:**
  - a nested callee's external call under a false `block.number` or `block.timestamp` guard spends the callee
    anyway;
  - `block.number` in a nested callee's external-call arguments is unresolved.

**Refused by name (fail closed), could be built later:**

- a constructor that writes its call target after the call, since the genesis body's after-body check reads the
  variable;
- two calls through one variable reassigned between them;
- a payment from a message-bus participant compiled direct-only;
- a typed `{value:}` call to a co-spent callee, whose payment would be stuck at its master lock;
- a called contract's own `blockhash(n)` read, and a called contract's low-level call with a payload;
- `tx.origin` passed on through a callee laid out by its ordinary build.

**Not refused yet:**

- a keccak256 chain beside a collection walk or a dynamic-state write cannot be spent, and the compiler does not
  refuse it;
- a keccak256 loop beside read-only chunks together with a mapping loop, per-turn payments, events or an external
  call keeps the old input order, unchecked.

**Found during the 0.51.0 merge (SDK, fails closed):**

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
- `deploymentRecipes.ts` records a transfer's recipient as written, not as the P2PKH lock it pays.

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

- `release-0.51.0`;
- `deployer-spec`;
- `release-review`, until the conformance review has been read: it holds the review's tests and their verdicts.

**Remove when the release is out:**

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
