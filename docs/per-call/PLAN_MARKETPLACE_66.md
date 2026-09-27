# Marketplace 66/66 execution plan

Plan of record for making all 66 unchanged titles of the EffectiveAcceleration `marketplace.test.ts` green on
mock BCH-2026, without Marketplace/Unicrow source changes and without application-specific logic.

- Rationale and evidence: [`EVAL_REMOVE_BATCH_ENTRYPOINT.md`](./EVAL_REMOVE_BATCH_ENTRYPOINT.md). Section
  references below (e.g. "EVAL 2.5") point there.
- How to use:
  - Tick `[x]` when a step is done and its evidence is recorded in the Log (section 7).
  - Untick a scoreboard title if it regresses.
  - Add a dated note instead of silently rewording a step.
- This file is the only copy. Do not copy it into branches; edit it here. If this worktree is ever removed, move
  the file first.

---

## 1. Decisions (tick one option per line before Wave 1 starts)

- **D1. Goal text.** Today it requires `artifact.messageBus.convention === 'kernel-row-loop'` and the `OP_INVOKE`
  graph boundary.
  - [x] Re-scope: the kernel is left untouched while the per-call path is built beside it, behind an option, in a
    separate worktree; Phase 3 removes the kernel after M2 (recommended)
  - [ ] Lift the kernel requirement entirely
  - [ ] Keep the requirement (no redesign; section 4 does not apply)
  - 2026-09-25, user decision: the kernel work is ignored. The per-call path is built in a separate worktree and
    branch (Phase 0), and the goal there is 66/66 on that path.
  - 2026-09-25 (review): "stays as-is" means untouched while the per-call path is built: no edits, fixes or
    measurements. Phase 3 then removes it on `feat/per-call`, after M2. The ticked option's text was aligned with
    this in the follow-up, so the decisions block alone gives the right instruction.
- **D2. Canonical harness.**
  - [x] Root `vitest.marketplace.config.ts` + byte-identical upstream test (recommended)
  - [ ] `examples/effectiveacceleration` copy (drops upstream `test:1477`)
  - 2026-09-25, user decision: the root harness.
- **D3. Real-chain deployability.**
  - [x] Out of scope until M2: 66/66 on the mock first, and route-size gates leave its critical path; real-chain work
    follows as Phase R after M2 (recommended)
  - [ ] In scope now: Phase R runs alongside the 66
  - 2026-09-25, user decision: "out of scope until we make all 66 green on mock. then return to this to work out the
    real chain deployments". So real-chain work is Phase R, after M2, and starts with A9 (moved there from Wave 0).
  - 2026-09-25 (review): decide on numbers. The relay limit is 100,000 B per transaction (policy) and the consensus
    limit 1,000,000 B (libauth). Every entry carries its own copy of the code, so code splitting bounds each master
    but not the transaction: `arbitrate`, about 24 masters, comes to roughly 120-240 KB (spec section 12). The
    largest titles would therefore be non-standard, though consensus-valid. A9 measures this (Phase R). Either way,
    66/66 on the mock is a semantics result, not a deployability claim.
  - 2026-09-25 (follow-up): two layers. Per input, 10,000 B is consensus (libauth rejects longer unlocking bytecode
    before evaluation), so code splitting is required on a real chain. Per transaction, 100,000 B is only relay
    policy. So D3 asks "will these transactions relay, and what does submission cost", not "is this buildable". A9
    states both layers and the mitigations with their costs.
  - 2026-09-25 (third review): the option texts were aligned with the user's decision; the ticked one now names
    Phase R after M2. The reviewer suggests running A9 early, since loading the code instead of carrying it (spec 12)
    could bring real-chain deployment back sooner. The decision stands: after M2.
  - 2026-09-25 (fourth review): why waiting costs nothing. The only real-chain deadline is the `V_TEMPLATE` freeze at
    the first real-chain deployment, which D3 defers. B15 keeps the loader mitigation open after the freeze, so A9
    loses nothing by running in Phase R. The reviewer withdrew the "run A9 early" suggestion on this basis.
- **D4. Spike form.**
  - [x] Per-call units + one settlement per owner (recommended; EVAL 4.4)
  - [ ] Generic journal inside the existing route
  - [ ] Both, same time box
  - 2026-09-25: follows from the user's decisions. The kernel is ignored (D1), and the per-call spec is implemented
    in parallel workstreams (section 4).
- **D5. Uncommitted Codex WIP (43 files).**
  - [ ] Keep as a reference patch only; port reviewed hunks individually (recommended)
  - [ ] Apply wholesale on the clean branch
  - [ ] Discard
  - [x] Not applicable: ignored together with the kernel work (D1)
  - 2026-09-25: no longer applies. The kernel worktree and its WIP are ignored (D1).
- **D6. Master and validator pool sizes** (spec section 12).
  - A transaction can enter a contract at most once per master it owns.
  - A composition consumes one validator of its root contract.
  - Options:
    - [x] A config default for composing contracts (e.g. 12 masters, 4 validators), overridable per contract and
      applied at deployment (recommended)
    - [ ] Deploy with 1 master and `split` in the harness before the suite
    - [ ] Other: ____
  - 2026-09-25, user decision: as many masters as needed. The measured worst case is Unicrow, entered 9 times in
    one `arbitrate` (spec section 21).
- **D7. `msg.sender` inside `this.g()`** (spec R3, T23, open point 9).
  - Either way, internal calls and top-level calls keep the calling user.
  - The marketplace is not affected: its sources and Unicrow contain no `this.f()` call.
  - Options:
    - [x] `address(this)`, as in Solidity; the spec is written this way (recommended)
    - [ ] The caller, as today's compiler does. Changes which account `this.transfer` / `this.approve` touch, and
      needs a sender-passthrough witness plus a validator check whenever the self-call cannot run inline
  - 2026-09-25, user decision: "msg.sender behavior should be identical to solidity". This covers every call
    context, not only `this.g()`. See `AUDIT_MSG_SENDER.md`.
- **D8. Call receipts** (spec R10, T32; audit S2).
  - Without receipts, one user signature authorizes any number of calls in the user's name. The calls sit in
    unlocking bytecode, which no signature covers.
  - Options:
    - [ ] A receipt output per user-rooted call, so the signature covers the exact list of calls (cost: one output
      per user-rooted call)
    - [x] No receipts for now. The risk is a documented residual (spec R10, T32). Receipts and the cheaper "one root
      per signed input" limit are written up as options in spec section 14.1
  - 2026-09-25, user decision: "no receipts for now, but document this option".
  - 2026-09-25 (review): T32 is an accepted residual.
    - Owner: the project owner.
    - Revisit before any real-chain deployment (D3), when transactions are assembled by third parties (relayers,
      batchers), or when wallets cannot decode the witnesses (spec open point 15).
    - Cost if adopted: the 66 make one user call per transaction, so one receipt output per transaction.
    - Adding receipts later does not need a new `V_TEMPLATE` if each receipt is an event the root master checks
      (spec 14.1).
    - The review recommends receipts on for user-rooted calls. That would reopen this decision; it is not adopted.
  - 2026-09-25 (follow-up): the revisit trigger splits by threat (spec 14.1).
    - Untrusted assembler (relayers, batchers): receipt events the root master checks are enough, and can be added
      later, per contract.
    - Hostile code in the call graph, with every call in the user's name attributable: only the validator-enforced
      form works. It is inside `V_TEMPLATE`, so its deadline is the freeze (D9), whether or not hostile code ever
      appears. It binds every root whose calls reach an honest contract (spec 14.1).
    - The 66 have neither (the SDK assembles every transaction), so the residual is inert here.
- **D9. Address model** (spec open point 13, T36; audit S12, F9).
  - An address must be bound on-chain to exactly one contract. Today's anchors are forgeable.
  - Options:
    - [x] Category-derived: the address of the contract's transcript (validator) contract,
      `addrV(cat) = P2SH32(pin(cat) || V_TEMPLATE)`, seeded with the same category pin as every other contract. The
      SDK reserves genesis outpoints when a CREATE address is predicted
    - [ ] Deployer-and-nonce addresses with deployer-signed anchors checked on-chain. Residual: a deployer can bind a
      second contract to their own address
  - 2026-09-25, user decision: "seed the transcript with category pin like other contracts do". Recorded as: an
    address is `addrV(cat)` (spec R5, R8, V11; open point 13).
  - 2026-09-25, user decision: version 1 does not allow validator program changes. The proxy-upgrade pattern covers
    upgradeable logic, and non-proxy contracts are immutable in Solidity. `V_TEMPLATE` v1 is frozen.
  - 2026-09-25 (review), recorded without changing the decision:
    - Proxies cover defects in contract logic, not in `V_TEMPLATE`. A proxy's own address and settlement use
      `V_TEMPLATE`, so a v1 defect stays with every v1 contract, proxied or not (spec section 9).
    - The freeze binds from the first real-chain deployment (D3), after an external audit (4.7). Until then a change
      to `V_TEMPLATE` only changes test addresses.
    - Open for the user before the freeze binds: keep this address form, or derive addresses from a tiny frozen
      dispatcher that carries the pin and routes to a versioned program (the review's recommendation). A dispatcher
      needs someone to authorize a new version; for a proxy that could be its admin.
  - 2026-09-25 (follow-up):
    - Precondition: no real-chain deployment before the address form is decided and the external audit covers that
      form (4.7). With a dispatcher, the audit covers two programs.
    - The validator-enforced receipts (D8) belong to the same pre-freeze decision, since they live in `V_TEMPLATE`.
    - Open for the user: when to decide. The follow-up review says before A8, because A4 and A7 freeze the address
      derivation there. Now it is a spec edit; after A8 it is a version bump every stream rebases onto; after a
      real-chain deployment it cannot change.
  - 2026-09-25, user decision: confirm `addrV(cat)` now, final for v1. No dispatcher. `V_TEMPLATE`'s content can still
    change until the freeze binds at the first real-chain deployment; each change only moves test addresses. The
    validator-enforced receipts (D8) therefore stay possible until then.

---

## 2. Conventions

### Worktrees

| Name | Path | Role |
| --- | --- | --- |
| `WT_NEW` | `/Code/cashscript/.worktrees/per-call` | All work from Phase 0 on, branch `feat/per-call` from `ea7a48e27`. Holds the plan documents in `docs/per-call/`. |
| `WT_CODEX` | `/Code/cashscript/.worktrees/kernel-beta-candidate` | Kernel work, ignored. Not frozen, fixed or measured. Its copies of these documents were deleted on 2026-09-25, after 0.2's commit. |
| `WT_CLEAN` | `/Code/cashscript/.worktrees/kernel-baseline-ea7a48e27` | Detached at `ea7a48e27`, built. Measurement reference for this plan; otherwise unused. |

### Commands (run from the worktree root)

They use the D2 harness, the root `vitest.marketplace.config.ts`.

```bash
# build (or keep `yarn build:watch` running)
yarn build

# fresh marketplace compile - REQUIRED after any compiler change: the project cache key excludes compiler code
rm -rf .marketplace/cache .marketplace/artifacts
node --max-old-space-size=8192 packages/testing/dist/cli.js compile --jobs 4

# fixture smoke test: title #15 runs only the fixture plus view calls
timeout 900 yarn vitest run --config vitest.marketplace.config.ts --no-file-parallelism \
  -t 'mece tags read mece tag$'

# single title: '<describe> <it>$' (7 titles are named "sanity checks", so always include the describe)
timeout 900 yarn vitest run --config vitest.marketplace.config.ts --no-file-parallelism \
  -t 'take job sanity checks$'

# full run (about 10 minutes when everything fails fast)
timeout 3000 yarn vitest run --config vitest.marketplace.config.ts --no-file-parallelism --reporter=verbose \
  > /tmp/marketplace-runs/$(git rev-parse --short HEAD)-$(date +%m%d-%H%M).log 2>&1   # mkdir -p /tmp/marketplace-runs first
```

A new worktree gets its own `node_modules`, never a symlink to another tree:
`yarn install --frozen-lockfile --offline --non-interactive` (about 2 minutes, including the postinstall `yarn build`).
Then verify that every `node_modules` is a real directory and every link inside resolves into the new tree:

```bash
W=$(pwd); find node_modules packages/*/node_modules examples/*/node_modules -type l |
  while read l; do case "$(readlink -f "$l")" in "$W"/*) ;; *) echo "OUTSIDE $l";; esac; done
```

Fallback if the offline cache misses a package: `cp -a` from `WT_CLEAN`, then the same check.

### Guardrails (apply to every step)

- One writer per worktree. Other agents work read-only or in their own worktree.
- Before recording any number, run the stability check: `git status --porcelain | sort | md5sum`, wait 45 s,
  repeat, and require both hashes to match.
- Record numbers only from committed states. Put the commit hash in the Log.
- Reviews of these documents target a commit hash, since the files change while they are being edited.
- Never `git add -A`: stage reviewed files only. Never `git stash`: the stash stack is shared across worktrees.
- Never edit Marketplace/Unicrow sources or the test file.
- No application-name logic. Gate on every diff:

  ```bash
  git diff -U0 -- packages/solidc/src packages/solidcash/src |
    rg '^\+.*(Marketplace|jobs\b|publishJobPost|publishJobEvent|JobEvent|Unicrow|FakeToken)'
  ```

- Every substantive fix gets a neutral regression test (no application names).
- The kernel worktrees and branches are ignored: no edits, fixes or freezes. The new path lives in `WT_NEW`.
- No `OP_RETURN` outputs and no new bare `OP_1` outputs. Where a placeholder is unavoidable, it is a 1,000-sat P2PKH to
  the transaction funder, and it is found by layout position, never by script (Track P rules, section 3a).

---

## 3. Phase 0: a separate worktree and branch (time box: 1 working day)

Goal: a clean branch for the per-call path, with the plan documents in it. The current kernel work is ignored:
Phase 0 does not freeze, repair, measure or stabilize it (user decision 2026-09-25, D1).

### 0.1 Worktree and branch

- [x] `git worktree add /Code/cashscript/.worktrees/per-call -b feat/per-call ea7a48e27`.
  - `ea7a48e27` is the commit measured in this plan.
  - The fixture regression at that commit is on the kernel path the new branch replaces, so it is not fixed.
- [x] Install `node_modules` from the lockfile (section 2), verify that every link resolves into the new tree, and
  build. Done 2026-09-25: a real install, not a copy (see Log).

### 0.2 Documents

- [x] Copy these into the new branch under `docs/per-call/` (byte-identical, verified 2026-09-25):
  - `SPEC_PER_CALL_TRANSACTION.md`, `PLAN_MARKETPLACE_66.md`;
  - `AUDIT_MSG_SENDER.md`, `EVAL_REMOVE_BATCH_ENTRYPOINT.md`, `EVAL_PER_CALL_VS_KERNEL.md`;
  - `PLACEHOLDER_OUTPUTS_INVENTORY.md`, and `probes/`.
- [x] Commit them, staging only `docs/per-call/` (2026-09-25, user OK; see Log).
- [x] From then on the branch copy is the only copy. The copies in `WT_CODEX` were deleted on 2026-09-25 (user OK),
  after checking that each held only the copied content plus its "superseded" banner.

### 0.3 Harness

- [x] Decide D2: the root harness (2026-09-25).
- [x] Point the harness at the per-call path (`composition: 'per-call'`) for the new branch only. This needs C1, so
  it lands with Wave 1. (2026-09-27, `composition` is a first-class project-config key and the root
  `solidcash.config.ts` sets it; the marketplace compile then refuses on the first imported Solidity root with
  `PER_CALL_CODEGEN_UNAVAILABLE: imported definitions are emitted before the master head, so imports are not
  supported`, so the fixture title cannot run yet. See the Log.)
- [x] Keep the upstream test byte-identical. Title #32's un-awaited send is handled by SDK serialization (spec
  section 18), not in the test. (2026-09-27, `git status --porcelain` shows no change to
  `examples/effectiveacceleration/test/marketplace.test.ts` or to the application contract sources.)

### Phase 0 exit

- [x] `WT_NEW` builds.
- [x] The documents are committed there.
- [x] D2 and D3 are decided. D1, D4, D5, D6 and D7-D9 are settled.

---

## 3a. Track P: placeholder outputs (`OP_RETURN` exclusion, `OP_1` revisit)

Every site is listed in [`PLACEHOLDER_OUTPUTS_INVENTORY.md`](./PLACEHOLDER_OUTPUTS_INVENTORY.md) (groups A-F, clean
HEAD `ea7a48e27`).

**Sequencing** (revised 2026-09-25):
- The new branch applies P0 (rules) and P4 (conformance).
- P1-P3 change the kernel path's existing code, which this goal now ignores. They are not scheduled. Their site
  lists stay in the inventory for reference, and Phase 3 removes most of those sites with the kernel.

### P0. Rules (effective now, for all code, including the new path)

- [ ] Adopted: no `OP_RETURN` output in any transaction SolidCash builds. Not as a pad, not as a trailer or separator,
  and not as a data carrier: the transcript is never carried in `OP_RETURN` (spec R9 and section 14).
- [ ] Adopted: no new bare `OP_1` outputs.
- [ ] Adopted: where a placeholder output is unavoidable, it is a 1,000-sat P2PKH to the transaction funder (the fee
  payer, which is the change destination). No script counts a placeholder's value as contract value.
- [ ] Adopted: no code finds a placeholder by its script; it uses layout positions.

### P1-P3. Kernel-path sites (not scheduled)

- The `OP_RETURN` pads, `OP_1` pads, carriers and pins, dummy funders and on-demand UTXOs of today's path are listed
  in [`PLACEHOLDER_OUTPUTS_INVENTORY.md`](./PLACEHOLDER_OUTPUTS_INVENTORY.md), groups A-E.
- They are not fixed on the kernel path.
- Carry over one security item, and check it on the new path only: no proof may accept a relocated own-category NFT
  whose commitment a caller can influence (audit F9, spec T36).

### P4. New per-call path conformance

- [ ] The new path builds no `OP_RETURN` outputs, no bare `OP_1` outputs, no dummy funders and no UTXOs created on
  demand (spec R9, inventory summary). Checked as an acceptance item (section 4.6).
- [ ] Phase 3 deletes the remaining group C/D machinery together with the kernel path.

### Track P exit

- [ ] P0 rules adopted on the new branch.
- [ ] P4 conformance checked as an acceptance item (section 4.6).

---

## 3b. Track S: identity and authorization on today's path (`AUDIT_MSG_SENDER.md`)

The new path is designed to close these (the spec).
- With the kernel work ignored (D1), S1-S3 are not scheduled on today's path. They stay listed as known issues of
  today's path.
- S0, the conformance suite, is built on the new branch. It is the acceptance test for D7.

**S0. Conformance suite: the acceptance test for D7** (audit section 6).
- [ ] Turn the reference contexts (`probes/this-call-msg-sender/ref.sol`) into a differential suite:
  - compile each with solc and with solidc;
  - run in `@ethereumjs/evm` and on mocknet;
  - compare identities by role.
- [ ] Record today's pass/fail per row in the Log.

**S1. Critical fixes**, each with its probe turned into a regression test that must be rejected:
- [ ] F2: `msg.sender` / `tx.origin` accept a P2PKH input only if its signature hash type is `0x41` or `0x61`
  (`probe5`).
- [ ] F1 and F10: bind the callee's `msg.sender` to a call the caller made, not to presence (`probe4`), and not to a
  builder-chosen input of the caller's block.
- [ ] F9: write the hostile VM test first, then replace the forgeable anchors with the transcript address (D9).

**S2. High**
- [ ] F11: make proxy initialization atomic with proxy creation.
- [ ] F3: take `msg.sender` / `tx.origin` from an explicit reference, not the first P2PKH input.
- [ ] F4 and F14: one address per contract, `addrV(cat)` (D9). This is on the 66 path: the Unicrow and
  `onlyMarketplace` guards compare against these addresses.
- [ ] D9 in the SDK:
  - `getAddress()` returns `addrV(cat)`, and deployment bakes it into the master's code next to the category pin;
  - look-ahead: keep at least as many genesis-eligible UTXOs reserved per deployer as addresses can be predicted
    ahead (for example, top up when `getNonce()` is called). The `getCreateAddress` shim maps nonce `n + i` to the
    `i`-th reserved UTXO, and that deployment spends exactly it. The Unicrow fixture predicts four before deploying
    (`marketplace.test.ts:52-81`);
  - document that outside the look-ahead, preparing genesis-eligible UTXOs is the user's responsibility. Put it in
    `packages/solidc/docs/contract-creation.md`, next to "The fundamental constraint", and make the "too few
    reserved UTXOs" error point there.

**S3. Medium and low:** F5-F8, F12, F13, F15, F16, and the stale docs listed in the audit.

---

## 4. Implementation: parallel workstreams

The spec fixes every interface the parts share: the witness block, the encodings, `M`, the record
formats, the frames and the V-checks. That makes an optimistic, parallel implementation possible, replacing the
earlier spike-then-rebuild sequence:
- after a short interface freeze (Wave 0), independent coders build separate code paths;
- each coder owns a focused test set under its own path;
- the full suite runs only at integration milestones.

The gate is kept, moved to milestone I2.

**Every implementation item below is one checkbox with its spec reference.** Tick it when the code lands and its
focused tests pass. This checklist is the only place implementation status is tracked.

A traceability check on 2026-09-25 found every item has a checkbox here:
- every spec check: spec P1-P2, W0-W3, O1, N1, spec S1-S4, V1-V11, and the spec's state rules D1-D2;
- every threat, T1-T41;
- every edge case (section 23, 26 rows);
- every Part II mechanism.

Items not needed for the 66 are in 4.7.

### 4.0 How the swarm runs

- **Streams and ownership.** Each stream owns its code directories and its test directory, and writes nowhere else.
  Shared files (`GenerateTargetTraversal.ts`, `compiler.ts`, SDK entry points) change only through small hook
  commits declared in advance.
- **Parallelism.**
  - At most 4 coders run at once (box capacity), in waves.
  - Each coder has one worktree and branch, off `feat/per-call`. The coordinator merges them into `feat/per-call`.
  - A coder's worktree is deleted right after its merge is verified.
- **Interfaces.** Frozen at the end of Wave 0, with golden vectors. A later change needs a version bump, updated
  vectors and the coordinator's approval; every stream then rebases.
- **Focused tests.**
  - A coder runs only their stream's directory, plus the shared vector tests (`yarn vitest run <dir>`).
  - `packages/solidcash/test/per-call/MANIFEST.md` lists every stream's directories and current pass counts. The
    coordinator updates it at each merge.
- **Full runs.**
  - `yarn test` runs only at milestones I2 and M2, and before the final merge.
  - The marketplace suite runs only from I3 on, at most once a day.
  - Flaky or shared-state tests are first confirmed with targeted runs.
- **Guardrails** (section 2) apply to every stream.
- **Names.** A bare label in this plan is a plan label.
  - Plan labels: decisions D1-D9; Track P items P0-P4; Track S items S0-S3; stream items A1-A8, B1-B15, C1-C14,
    R0-R7, E1-E13, F1-F7, G1-G6; milestones I1-I3, L1-L7, M1-M2; toys Y1-Y7 (renamed from T1-T7, so they do not
    clash with threats T1-T41).
  - Spec labels that could clash always carry "spec": spec P1-P2, spec S1-S4, spec R1-R10, and the spec's state
    rules D1-D2. Labels that exist only in the spec (W0-W3, O1, N1, V1-V11, T1-T41) need no prefix.
  - Shapes are in backticks (`A`, `ABBA`); streams are "stream A" and so on.
  - In the spec, bare D1-D2 are its state rules, and plan decisions are written "plan Dn".

| Stream | Owns (code) | Focused tests |
| --- | --- | --- |
| A Interfaces | `packages/utils/src/per-call/` | `packages/utils/test/per-call/` (with `vectors/`) |
| B Validator | `packages/solidc/src/per-call/validator/`, `packages/solidcash/src/per-call/validator/` | `packages/solidcash/test/per-call/validator/` |
| C Frames and calls | `packages/solidc/src/per-call/master/`, plus declared hooks | `packages/solidc/test/per-call/master/`, `packages/solidcash/test/per-call/frames/` |
| R Records (view mode) | `packages/solidc/src/per-call/records/`, plus declared hooks | `packages/solidc/test/per-call/records/` (codegen), `packages/solidcash/test/per-call/records/` |
| E Composer | `packages/solidcash/src/per-call/composer/` | `packages/solidcash/test/per-call/composer/` |
| F Deployment and proxies | `packages/solidcash/src/per-call/deploy/`, `packages/solidcash/src/per-call/proxy/` | `packages/solidcash/test/per-call/deploy/` |
| G Acceptance tests | Tests only | `packages/solidcash/test/per-call/{conformance,edges,hostile,toys,shapes}/` |

**Feasibility and dependencies** (assessed 2026-09-25):
- **Sequential first.** Stream A (interfaces), because every other stream codes against it.
- **Safe to run in parallel:**
  - B: stub masters, no compiler.
  - E: it starts on stub scripts that follow the A5 stop-site schema, then switches to real artifacts.
  - F: mostly SDK.
  - G: tests written test-first against the spec.
- **Parallel with care.** C and R both touch compiler codegen. Each lives in its own new module behind a declared
  hook. R is the critical path and the main risk: one coder, slices R1 to R7 in order.
- **Where optimism is tested:**
  - I1 (`ABBA`) needs A, B, C, R1-R2 and E;
  - I2 (the gate) also needs R3-R5 and F5-F6, for the proxy toy Y4;
  - I3 needs F7.
- **Where it fails, and the fallback.** If R's view mode needs changes all over `GenerateTargetTraversal.ts`, or the
  interfaces keep changing after A8 (every change forces rebases), cut back to fewer, sequential streams. The I2
  kill criteria catch the first case. Re-estimate for the fallback: about 8-12 weeks in total, as for spike then
  rebuild; record it in the Log when the fallback is taken.
- **Estimated timeline:**
  - Wave 0: 2-3 days.
  - Wave 1: about 2 weeks with 4 coders.
  - Wave 2 and I1-I3: 1-2 weeks.
  - Ladder: 1-2 weeks.
  - About 5-7 weeks in total, against 8-12 for spike then rebuild.

**Prerequisites (done):**
- [x] Every open point on the 66 critical path specified in spec Part II (since revision 9).
- [x] D6: as many masters as needed. Measured need: Unicrow 9 per transaction, and MarketplaceData 5 through its
  proxy and implementation.

### 4.1 Wave 0: interfaces (two coders, about 2-3 days: stream A, and stream R's coder on R0)

- [x] A1 Witness block codec, version `PW 01` (spec 16): encode, decode, exact lengths, nothing trailing.
- [x] A2 `M` codec (spec 6): roots, masters, settles.
- [x] A3 Canonical encodings (spec 17): values; argument pushes with the minimal-push rule; `argsHash`; results;
  addresses as locking bytecode.
- [x] A4 `pin(cat)`, `addrV(cat)` and `H_V` helpers (spec R5, 4a, N1).
- [x] A5 Stop-site metadata schema in the artifact (spec 18): reads with their record, calls with their index,
  segment closes.
- [x] A6 Frame and call kind constants, and the record entry convention `(in, out)` (spec 4a, 16).
- [x] A7 Golden vectors:
  - the `ABBA` witness blocks, `M` and outputs (spec 5.1-5.3, 6);
  - `argsHash` cases, including the minimal-push traps;
  - `addrV` for sample categories;
  - one malformed block per T33 case.
- [x] A8 The interface freeze is recorded in the Log (version and vector hashes).
- A9 (size budget) moved to Phase R, after M2 (D3).
- [x] R0 Reuse proof for records (stream R's coder, in parallel with A: it reads only today's code). Focused tests
  showing that today's sorted-list and covenant helpers (`SortedList.ts`, `covenant-helpers.ts`, `state.ts`)
  implement the semantics spec section 20 assumes: exact read; absence by strict predecessor; insert with a relinked
  predecessor; update in place; delete as the default value; composite keys for nested mappings; the 60/64-byte value
  thresholds. Any gap found is written into spec section 20 before Wave 1.

### 4.2 Wave 1: core streams (B, C, R, E in parallel)

**Stream B: validator** (spec 3.2, 7.2). Its tests use hand-built transactions with stub masters (small scripts
holding minting NFTs, whose unlocking bytecode carries the A7 blocks), so B needs no compiler work.
- [x] B1 V1: recreation in place; a master of its own category present.
- [ ] B2 V2 (partial): parse `M` and every covered master's first-push witness block; reject any encoding the master
  would not accept. Emitted: the wire name and version, the root, master and settled-state indices, the witness-block
  shape and the empty settle tail. Not emitted: the remaining encoding rules.
- [x] B3 V3: completeness.
- [x] B4 V4: roots, and the forest rule.
- [ ] B5 V5 (partial): edges, for each kind. Emitted for an ordinary call: caller, kind, origin, value, sender,
  address, result, and the callee's own pushes hashed against the recorded digest. Not emitted: the `DELEGATE` target
  rule and the `INTERNAL` same-contract rule.
  - `CALL`, `STATIC`, `CREATE`: sender is the caller's `self`, and `self` is the recorded target;
  - `DELEGATE`: passthrough, and the callee's category matches the target (T37);
  - `INTERNAL`: passthrough, same contract;
  - for all kinds: origin, values (passed through for `DELEGATE` and `INTERNAL`), `retval`, and `argsHash` over the
    callee's argument pushes.
- [ ] B6 V6 (partial): every master visited exactly once, so cycles and unreachable masters are refused. The ordering
  half — a callee running between its caller's segments, so roots never interleave (T30) — needs the record chains
  and is open until B7 lands.
- [ ] B7 V7 (partial): no category settled twice. Open: the input rule, per-record chains across every frame on the
  contract's records, the census (containers, distinct event outputs), and values (spec S4). The census is now
  load-bearing rather than redundant: a master of a shared category stands its own down (`abe0de286`, the Log row),
  so until this check lands, an own-category immutable NFT at an output no frame lists is accepted for such a
  contract.
- [x] B8 V8: the settles set (two or more masters, or a `DELEGATE` or `INTERNAL` frame on the records). Both halves
  are emitted and each has its own refusal; the branch for the borrowed half was written but not called until
  `b52b7ec5b`, which an end-to-end refusal test caught.
- [x] B9 V9: owner policy.
- [x] B10 V10: static frames.
- [x] B11 V11: addresses, with `addrV` built from `OP_ACTIVEBYTECODE` (matches the A4 vectors).
- [x] B12 The `ABBA` golden transaction, with stub masters carrying the A7 blocks, is accepted. Verified
  green 2026-09-27: `validator/script.test.ts` "accepts the reference composition at the validator input" runs the
  shipped program over `abbaComposition()`, and `validator/golden.test.ts` derives `V1`-`V11` accepted in the
  section-8 order.
- [x] B13 One hostile unit test per V-check. Each rule the program emits has its own refusal in
  `validator/script.test.ts` (43 of them), beside `validator/hostile.test.ts` and the machine-level suite in
  `hostile/`.
- [x] B14 Reference model and differential tests. An independent TypeScript model of V1-V11, written from the spec
  text rather than from the script. A property-based harness generates valid and adversarial compositions (mutated
  witnesses, `M`, orders, record chains, edges) and requires the script and the model to agree on every accept and
  reject. B13 proves each check exists; B14 checks that the derived order and the record chaining agree with the
  spec over graphs nobody wrote by hand.
- [x] B15 No master-lock assumption in `V_TEMPLATE`. Masters are identified by category and minting capability only
  (V1, V3, V7); the census keeps every minting NFT at its master lock. This keeps the loader form (spec 12) open
  after the freeze. Checked by B14's model and one vector whose masters sit at a loader lock.

**Stream C: frames and calls** (spec 4a, spec R3, and spec 7.1: spec P1-P2, W0-W3, O1, N1).
- [x] C1 Option `composition: 'per-call'` and its single entry hook (a declared hook commit).
- [x] C2 spec P1: category pin; spec P2: recreation in place.
- [x] C3 W0: the first-push self-check.
- [x] C4 W1: frames.
  - `callerRef != self`.
  - `ROOT`: a P2PKH caller, hash type `0x41` or `0x61`, and `sender`.
  - `self` from the baked `addrX` (`ROOT`, `CALL`, `STATIC`, `CREATE`) or from the witness (`DELEGATE`,
    `INTERNAL`).
  - `msg.value = value`.
- [x] C5 O1: `tx.origin` from `originRef`, with the hash-type check; never the first-P2PKH scan.
- [x] C6 N1: the need test, and validator recognition through `H_V`.
- [x] C7 W2: calls. Kind and target recorded, `calleeRef != self`, in-script `argsHash` with minimal pushes (A3),
  result from the witness, segment closed at every call. Complete as of `0632ecdc6`: the call data's own order is
  now the order the digest is folded in, so a call with more than one argument is agreed on by the caller, the
  callee's body and the validator. The clauses landed over the call-site commits before it; this box is ticked by
  the commit that made the wire facts hold for any arity.
- [ ] C8 spec R3 call forms:
  - internal calls and `delegatecall` to own code, inline;
  - `this.g()` inline with `msg.sender = self`, replacing the `AstBuilder.ts:7323` behaviour under per-call;
  - a runtime target equal to self as a `CALL`;
  - `STATIC` for `view` and `pure`;
  - `try` must succeed (T22).
- [ ] C9 W3: events at their listed outputs; `sends[]` for P2PKH value sends; a value send to a contract as a `CALL`.
- [x] C10 Stop-site metadata emitted (A5). The per-call compiler derives each entry's sites from the calls it
  already compiles at their call sites and the segments they split the execution into — one `call` site per external
  call in execution order, then one `segmentClose` per segment, so `k` calls publish `2k + 1` sites — validates the
  table against the frozen schema before it is published, and attaches it to `artifact.composition`. The source-side
  facts a driver resolves a callee through (interface, method, target, selector) ride beside each call site, and no
  `read` site is published: the compiler does not hold the record identity a read resolves to, and an invented one
  would be worse than an omitted one.
- [x] C11 A code constant slot for `addrX`; stream F fills it at deployment.
- [ ] C12 SafeERC20 low-level calls (OpenZeppelin 5.0.2 and 4.9.3) lowered to typed calls; the `code.length` rule;
  `address(this).balance` constant-folded for value 0 (spec 17; section 23 rows 9-11).
- [ ] C13 `ecrecover` returns address 0 for invalid input (spec 23 row 22).
- [ ] C14 Fix: a public function that reads `msg.sender` and writes state fails `OP_VERIFY` when called internally
  (spec open point 9).

**Stream R: records and settlement, view mode** (spec 20, spec 7.1 checks spec S1-S4, spec 7.3). This is the main
risk. Take the slices in order, each with its own tests.
- [x] R1 Data NFTs: reads from `viewIn`, and writes compared with `viewOut` at segment close, reusing today's record
  encoders. A body now reads its own segment's declared view rather than the commitment the transaction spends:
  `declared-view.ts` walks the witness block from the body (stepping the call records and earlier segments by their
  declared widths) and leaves the view of the record at the coordinate it is given, failing instead of falling back
  when a segment declares nothing there; a source read and the close both go through it; a value written before an
  external call is marked as the closed segment's so a read after the call resolves from the declaration; and the
  end-of-body rebuild closes each record against the segment the frame last touched it in. The worked shape where
  `A`'s one record is written by three frames now derives end to end and every contract input is accepted, with four
  controls refused (a frame whose computed commitment is not its segment's `viewOut`, one whose read is not its
  segment's `viewIn`, a standalone master whose last declaration is not the transaction's output, and a settlement
  whose later segment does not carry on from the one before it). Turning the declared read off fails seven of that
  file's ten cases and dropping the call-site marking fails five. Remaining: the close is emitted where the
  end-of-body rebuild runs, so a frame that writes a record early and leaves it untouched later does not prove that
  early value against that segment's declaration; a record whose index changes between segments is not followed; and
  dynamic chunks still resolve against the transaction.
- [ ] R2 Self-settlement, spec S1-S4: chains, census, the input rule (spec S3), values. The spec's state rules D1
  and D2 in `STATE_CODE`, reusing today's data-NFT covenant with an added value pin.
- [ ] R3 Mapping nodes:
  - exact read, and absence proof by predecessor;
  - update in place;
  - insert: a created record plus a relinked predecessor;
  - delete as the default value;
  - nodes created and relinked across frames.
- [ ] R4 Long mapping values: the value arrives as a witness bound by the root, and each writing frame mints its
  version's chunks.
- [ ] R5 Dynamic `string`, `bytes`, `T[]`: consume every old chunk and create every new one. (partial: the master
  head now derives a body's chunk-run coordinate from the record block its own frame declares, and the machine
  accepts a compiled master whose entry appends to a `string` value — the old chunk consumed, the new one written,
  the length header updated — with a control refused when the run is undeclared or carries a value the code did not
  compute (`solidc/test/per-call/master/dynamic-state-record.test.ts`). The composer lays a run out as of
  `48e6b2d2c`: `planChunkRun` derives the value's header and chunk commitments through the shipped encoders and
  `layOutChunkRun` places the band one layout width past the block's declared records, locks every chunk with the
  value's own collection covenant and emits the record entry each one declares, and a plan built that way derives
  with the machine accepting the master that wrote the value (`solidcash/test/per-call/frames/chunk-run.test.ts`).
  What is missing is a write that changes the run's width — creating or deleting chunks — which the plan refuses by
  name, and `bytes`/`T[]` runs, which are unexercised.)
- [ ] R6 Mappings inside structs and nested mappings, through today's flattening and composite slots (spec 20).
- [ ] R7 Value pin (the spec's D2 rule) for mapping nodes and chunks, which carry none today (T39).
- Satoshi and token containers: not needed for the 66; deferred.

**Stream E: composer** (spec 5, 6, 10, 18).
- [x] E1 Resumable depth-first derivation from stop sites (A5): no fixpoint; a callee is derived first. The sites are published per entry by the compiler and read off the artifact (`2174295ca`), the driver resumes at the next published site and refuses a step that fills no witness, and the real host runs the compiled master twice per site — before and after the fill — counting the site filled only when the program strictly advanced, so a fill that moves nothing is a stall. A callee is derived before its caller resumes, which the tests assert as the order of completions. The composer lays out and assembles the draft itself as of `30aae727e`; the low-level host still accepts a hand-built run, and the plan's later items (reads of records, events, sends) are what remain of stream E.
- [x] E2 Witness assembly (A1), `M` (A2), block layout (spec 5), master and validator selection from the pools,
  several validators per transaction.
- [ ] E3 Reverts: the innermost reason, and custom errors with arguments, bubbled through callers; nothing is
  broadcast.
- [ ] E4 Reads: view calls as `STATIC` `ROOT` frames off-chain, nested views, and reverts from reads.
- [ ] E5 Events to ethers logs and receipts: category to `addrV`, including nested frames.
- [ ] E6 A serialization queue for sends that could touch the same masters, validators or records.
- [ ] E7 Time: locktime fixed before derivation; strictly later block times in the mock.
- [ ] E8 Simulation before funding: a send from an unfunded wallet reports its revert.
- [ ] E9 Snapshots: `loadFixture` restores SDK state (nonce, look-ahead reservations, pools, caches).
- [ ] E10 Listeners: `addListener` on the emitting address, including nested frames.
- [ ] E11 A test helper that deploys a contract with N masters and a validator pool, for the B, C, R and E tests
  before stream F lands.
- [x] E12 Pool exhaustion is refused before building, with `PER_CALL_POOL_EXHAUSTED` (spec 21). Tests: fill a master
  pool exactly, then ask for one more entry; a composition whose first root's contract has no validator.
- [x] E13 Derivation stalls are refused, with `PER_CALL_DERIVATION_STALLED` (spec 18). Tests: a step that fills no
  witness is refused; a 30-append derivation completes (no size cap).

### 4.3 Wave 2: deployment, proxies and acceptance tests (F and G, with R continuing)

**Stream F: deployment, pools, proxies, addresses** (spec 12, 19, 21, open point 13).
- [ ] F1 Genesis with the master pool, and the validator pool at `addrV(cat)`; sizes as needed (D6).
- [x] F2 Bake `addrX` into `code_X`; `getAddress()` returns `addrV(cat)`.
- [ ] F3 CREATE look-ahead:
  - reserve genesis-eligible UTXOs;
  - the `getCreateAddress` shim maps nonce `n + i` to the `i`-th reserved UTXO;
  - an error pointing at the documentation when too few are reserved.
- [ ] F4 User documentation in `packages/solidc/docs/contract-creation.md` on preparing genesis-eligible UTXOs.
- [ ] F5 The built-in proxy: an `implementation` field, and a fallback that delegatecalls with the arguments and
  result unchanged.
- [ ] F6 `deployProxy` in three transactions; `initialize` through the proxy; the `Initializable` flag in the proxy's
  records (title #8).
- [ ] F7 The fixture's 14 transactions on the per-call path, with the predicted Unicrow addresses equal to the
  deployed ones.
- `split` and `merge` admin functions: not needed for the 66; deferred.

**Stream G: acceptance tests.** They are written test-first against the spec, and fail until their streams land.
- [ ] G1 Conformance suite (Track S0): the 21 reference contexts, EVM against per-call.
- [ ] G2 One dedicated test per spec section 23 row, kept as a regression guard:
  - [ ] Row 1: Reentrancy guard kept in storage and crossed by re-entry (`U._status`, `UC._status`).
  - [ ] Row 2: A static call reads state its caller's caller wrote moments ago.
  - [ ] Row 3: Which callee runs, and how many times, depends on that state.
  - [ ] Row 4: Calls inside data-dependent loops, including a revert mid-loop.
  - [ ] Row 5: Revert after state-changing calls (7 checks).
  - [ ] Row 6: Custom errors raised in a callee and re-raised by SafeERC20 assembly.
  - [ ] Row 7: `tx.origin` authorizes a nested call.
  - [ ] Row 8: `msg.sender` guards on proxy and CREATE-predicted addresses.
  - [ ] Row 9: `code.length` of a target.
  - [ ] Row 10: `address(this).balance` compared with 0 in `functionCallWithValue`.
  - [ ] Row 11: Low-level call, `bool` return decoding, revert re-raise.
  - [ ] Row 12: Struct and array arguments and returns with dynamic members; `uint16[5]`, `uint256[5]`.
  - [ ] Row 13: Events above 128 bytes, emitted by nested frames and asserted.
  - [ ] Row 14: Two JobEvents in one transaction (five transactions).
  - [ ] Row 15: Writes after an external call.
  - [ ] Row 16: 24-hour windows, the challenge period, strictly later block times, `Rated` timestamp equal to the review's.
  - [ ] Row 17: Snapshots and six mid-test reloads.
  - [ ] Row 18: Reverts from unfunded senders (7).
  - [ ] Row 19: Reverts from view calls (6).
  - [ ] Row 20: Un-awaited sends and matchers.
  - [ ] Row 21: Live event listener raced against 1 s.
  - [ ] Row 22: `ecrecover` on `"0x"`, 65 zero bytes (v = 0), a 20-byte value.
  - [ ] Row 23: Records growing within one transaction and across 30 transactions.
  - [ ] Row 24: `string => string` mapping set and delete.
  - [ ] Row 25: Deep chains, four calls below M plus proxy hops, about 24 masters.
  - [ ] Row 26: A multi-megabyte master script in the mock (MarketplaceV1).
- [ ] G3 Hostile tests, one per threat (spec section 9); each must be rejected:
  - [ ] T1: execute on a non-master UTXO (loose BCH at `lockA`, or a foreign minting NFT placed there).
  - [ ] T2: forged `msg.sender` in standalone mode (`callerRef` pointing at a contract input, no validator).
  - [ ] T3: forged caller or call edge when a validator is present.
  - [ ] T4: a validator left out where one is needed.
  - [ ] T5: a fake validator (wrong derived lock, or no same-category mutable NFT).
  - [ ] T6: a master pointing to a validator that does not list it.
  - [ ] T7: split view across two validators (an edge or a contract's masters spanning them).
  - [ ] T8: forged arguments, selector or result.
  - [ ] T9: reordered segments; stale read (`A.k` placed before `A.f`'s write).
  - [ ] T10: self-settlement claimed while a second master of the contract exists.
  - [ ] T11: partial settlement of a multi-master contract.
  - [ ] T12: a state UTXO spent outside settlement.
  - [ ] T13: a forged or missing event.
  - [ ] T14: a master or validator drained, duplicated, or not recreated.
  - [ ] T15: an identity check keyed on a commitment instead of category, capability and lock.
  - [ ] T18: a second A master claims `callerRef` = the first A master, which made no such call, and calls an
    `onlySelf` function. Also a master that names itself as caller or callee.
  - [ ] T19: `callerRef` pointing at `DA` (a state UTXO at `stateA`) or at the validator.
  - [ ] T20: the root user's input signed with `ALL|ANYONECANPAY`, `NONE` and `SINGLE`, one variant each.
  - [ ] T21: `originRef` pointing at a second signed user in the transaction, at the root and on a callee.
  - [ ] T22: a witness that tries to select a `catch` branch of `try this.g()` or `try b.g()` is refused; the call
    must succeed.
  - [ ] T23: `this.g()` sees `address(this)`, and a caller-gated function reached through `this.g()` is refused. Use
    the EVM expectations recorded in the Log (2026-09-25 probe).
  - [ ] T24: a funder P2PKH placed before the root user's input is never taken as `msg.sender` or `tx.origin`.
  - [ ] T25: `this.g()` inline and `IA(t).g()` with `t == address(this)` on a second master give the same
    `msg.sender`.
  - [ ] T26/T27: a proxied call whose `DELEGATE` callee is not the proxy's current implementation (the fallback's
    target), and a master presenting its code lock instead of its address.
  - [ ] T28/T29: a `DELEGATE` / `INTERNAL` frame with a sender or self its caller lacks; a `CREATE` frame naming a
    creator that ran no `new`.
  - [ ] T30: a second root placed between a caller's segment and its callee (the vault-share reentrancy window), and
    one master's segments out of order.
  - [ ] T31: two masters naming each other as caller, with no user root.
  - [ ] T32 is a residual (D8). Add a test recording that an extra call naming an already-used signed input is
    accepted, so that adopting receipts later flips it.
  - [ ] T33: a witness block the master and the validator would read differently (trailing items, non-minimal pushes).
  - [ ] T34: a `STATIC` callee that writes a record or emits.
  - [ ] T35: a value send to a contract made as a plain output.
  - [ ] T36: a master whose `self` is not `addrV` of its category (V11), and a fake contract presenting another
    contract's address.
  - [ ] T37: a `DELEGATE` callee that is a master of other code than the named target, and an `INTERNAL` callee of
    another contract.
  - [ ] T38: an untouched state UTXO of a validator-settled contract consumed without an output.
  - [ ] T39: a record, master or validator recreated with less value.
  - [ ] T40: a callee claiming a `msg.value` its caller did not send.
  - [ ] T41: two frames listing the same event output.
  - [ ] T16 (non-critical): changing a master's witness after the user signed either fails or yields identical
    outputs.
  - T17 (pool contention) is liveness only: no test; pools are sized per section 21.
- [ ] G4 Toys (neutral names), each settling with exact post-state, events and balances:
  - [ ] **Y1 same-entry appends.** A `Hub` calls `Log.append(id, item)` k = 3 times; `append` pushes onto `items[id]`
    and emits. (The `publishJobEvent` shape.)
  - [ ] **Y2 re-entry.**
    - `Vault.release(id)` writes `recs[id].state = 1`, calls `Claimer.claim(id)`, and emits the returned amounts.
    - `claim` reads `vault.get(id)` and requires `state == 1`.
    - `claim` calls `vault.markClaimed(id)`, then `vault.pay(to, amt)` twice.
    - Each `pay` calls `Token.transfer`.
    - (The `release` / `claim` shape.)
  - [ ] **Y3 result into a later call.** `A.f(id)` computes `fee = B.fee(id)`, then calls `C.pay(id, fee)`.
  - [ ] **Y4 proxy.** Y1 with `Log` behind the SolidCash upgradeable proxy (spec open point 5).
  - [ ] **Y5 sorted entry lifecycle.** Insert, update, then delete of one key across three calls in one transaction.
  - [ ] **Y6 fan-in.** `A.go()` calls `Token.approve(U, amt)`, then `U.pull(amt)`; `pull` calls
    `Token.transferFrom(A, U, amt)`. (The `takeJob` shape.)
  - [ ] **Y7 identity.** In one contract `Tok`:
    - `sweep(t)` calls `this.transfer(t, bal[address(this)])`, which must debit the contract, not the user;
    - `this.onlySelf()` passes, while `onlySelf()` called directly by a user fails;
    - `this.ownerOnly()` called by the owner fails, as in the EVM;
    - an `Escrow.refund()` gated on `tx.origin`, reached through `Market.refund()`, sees the root user;
    - each expectation matches the EVM result of the same Solidity source (the Log's 2026-09-25 probe method).
- [ ] G5 The shapes of spec 5.4, with the same scripts and builder and no special case:
  - [ ] `A`
  - [ ] `AA`
  - [ ] `AB`
  - [ ] `ABBA`
  - [ ] `ABCBA`
  - [ ] `A.x` and `C.y`, independent: 0 validators
  - [ ] `AB` and `CD`, independent: 2 validators
  - [ ] `A.x` and `A.y`: 1 validator
- [ ] G6 Every edge of spec section 22 is exercised by at least one named test. The map is kept in `MANIFEST.md`.

### 4.4 Integration milestones and the gate

- [ ] **I1 `ABBA` end to end:** compiled masters (C, R1-R2), the composer (E) and the real validator (B). The outputs
  are exactly those of spec 5.2.
  - The outputs are 5.2's set complete as of `abe0de286` - six participants at 0-5, the event at 6, the user's change
    at 7 - the derivation completes callee first, and every contract input the machine is asked about is accepted.
    What is still open is the validator input's own spendability: the shipped program spends its operation-cost
    budget to within 1% on this shape and is 64 units over it once the entry emits (the Log row and the real-chain
    limits item below carry the numbers).
- [ ] **I2: toys G4 and shapes G5 settle, and G3 passes.** Gate:
  - [ ] **GO** requires:
    - 0 per-shape rules added;
    - derivation per entry;
    - no transcript parsing in masters.
  - [ ] **KILL** if any of these happens:
    - a toy needs a static per-shape recipe;
    - the settlement cannot do sorted-entry insert and delete generically;
    - re-entry needs a fixpoint across entries;
    - a shape in spec 5.4 needs a special case in contract code;
    - the compiler delta at I2 exceeds about 12K lines, the top of the estimate for all of master mode, or view mode
      needs a special case outside spec section 20's record kinds (`EVAL_PER_CALL_VS_KERNEL.md` sections 3 and 6);
    - deriving the re-entry toy Y2 takes more than 5 s;
    - a V-check has no hostile test, or a threat row marked Critical (spec section 9) has no test showing it is
      rejected. The residual rows (T17, T32) are not Critical; T32's test records that it is accepted;
    - I2 is not reached within 4 weeks of the interface freeze (A8). One extension of 2 weeks is allowed if I1 is
      green and every GO criterion holds, with a written re-estimate in the Log.
  - [x] Record the gate decision in the Log, with a date and one paragraph of rationale.
  - **On KILL:** stop the swarm, write the gate report (which criterion failed, with its numbers), and return to the
    project owner. The options are then to redesign the failing mechanism, to cut scope, or to stop. Nothing
    continues by default.
  - **Stream R's bus factor.** R is the main risk and has one coder. Every R slice gets a second coder's review
    before it merges, and `MANIFEST.md` records R's state per slice, so another coder can take it over.
- [ ] **I3: the fixture is green** on the D2 harness (F7).
- [ ] The solidhat/testing layer uses the composer when `composition: 'per-call'` is set, for the D2 harness only.
- [ ] **Ladder** (tick titles in the scoreboard as they turn green):
  - [ ] L1: fixture
  - [ ] L2: the 24 no-composition titles, class (a)
  - [ ] L3: #18 `post job 1`
  - [ ] L4: the other class-(d) titles (22)
  - [ ] **M1: at least 45/66 on one commit**, at or above every recorded run. The best full runs were 43/66 (legacy
    bus 08-20, kernel 09-16); the legacy bus's bail run passed 45 in a row (08-29)
  - [ ] L5: fan-in (11): #42, 45, 46, 48, 49, 53, 54, 55, 57, 58, 65
  - [ ] L6: `approveResult` / `refund` re-entry: #50, 51, 52
  - [ ] L7: `arbitrate` + integration: #59, 60, 61, 62, 66
  - [ ] **M2: 66/66 on two consecutive full runs of the same commit**, and on that commit:
    - G1 (the conformance suite, S0: the acceptance test for D7), G2 (edge cases), G3 (hostile), G4 (toys), G5
      (shapes) and G6 (edge coverage) green, and B14 agreeing;
    - Track P4 conformance green (4.6);
    - the I2 GO criteria still holding, and the I2 KILL conditions still clear: no per-shape recipe, no fixpoint, no
      shape special case, generic sorted-entry insert and delete, Y2 derived within 5 s;
    - the compiler delta recorded against the estimate (4.5). By M2 it also carries C12-C14, so the 12K bound is
      reported, not enforced.

    66/66 is a semantics result on the mock. It is not a security claim (the EVM hazards are reproduced on purpose)
    and not a deployability claim (D3); see spec section 15.

### 4.5 Measurements (record in the Log)

- [ ] New lines of code: compiler / SDK / tests.
- [ ] Per-shape admission rules or static footprint recipes added: must be 0.
- [ ] VM evaluations per composed transaction during derivation, for Y2 and Y6.
- [ ] Size of the validator program and of the witnesses per master (spec section 12).
- [ ] Wall time to derive and build Y2 and Y6.
- [ ] Wall time and size of the largest marketplace transaction: `arbitrate` 80-20, about 24 masters.
- [ ] Chunk outputs per `jobEvents` append, and over 30 updates of one job.
- [ ] VM runs per master during derivation (should be 1 with resumption, E1).

### 4.6 Rules

- [ ] Per-title time budget of 1 day. When it is exceeded, write a reduced neutral reproducer and move on.
- [ ] One full run per day at most. Single-title runs otherwise.
- [ ] Acceptance (Track P4): the new path builds no `OP_RETURN` outputs, no bare `OP_1` outputs, no dummy funders
  and no UTXOs created on demand.
- [ ] Track P rules (P0) hold for all new code.

### 4.7 Deferred: specified or listed, not needed for the 66

These are tracked here so nothing drops silently. Each needs its own decision before it is scheduled.
- [ ] Satoshi and token containers, and payable `ROOT` calls; value accounting beyond preservation (spec open point
  10).
- [ ] `split` / `merge` admin functions for pools.
- [ ] `CREATE` frames inside a composed transaction (spec R3, open point 14).
- [ ] Code-split contracts: facets and `INTERNAL` frames across facets (spec section 11, open point 11).
- [ ] Call receipts (D8, spec 14.1), which would close T32.
- [ ] Users other than P2PKH as callers (spec open point 8).
- [ ] Real-chain limits: validator size and density (open point 7), 10,000-byte masters (11), events above 128 bytes
  (16), and the 100,000 B relay limit with one code copy per entry (spec 12, A9).
  - Measured on the round trip's shape: the validator input's budget is 800 operation-cost units per byte of its own
    unlocking bytecode (4,722 bytes, so a maximum of 3,810,400) and the shipped program spends 3,772,568 of it on the
    same shape without an event - 1% of headroom - and 3,810,464 with one, 64 over. The terms on the emitting shape:
    28,668 evaluated instructions at 100 each, 919,364 bytes pushed, 377 hash iterations at 64, and 172 of arithmetic.
    So the next rule this stream adds has 37,832 units to fit in, and the bytes pushed are a lever as large as the
    instruction count. A leaner walk over the covered masters (whose unlocking bytecodes carry their whole programs),
    a smaller program or validator input padding (open point 7) comes before a larger shape is spendable.
- [ ] External audit of `V_TEMPLATE`, with B14's reference model, before the v1 freeze binds at the first real-chain
  deployment (D3, D9). Owner: the project owner, who engages the auditor; scheduled in Phase R.
- [x] The address form, decided before the freeze binds: `addrV(cat)`, final for v1, no dispatcher (user decision
  2026-09-25, D9). The validator-enforced receipts (D8) can still be added to `V_TEMPLATE` until the freeze binds.
- **Precondition for any real-chain deployment:** the two items above are done, and the audit covers the decided
  address form.
- **Not due within this goal.** D3 keeps real-chain deployment after M2, so the freeze, the audit and D8's receipt
  deadline do not come due before M2. They come due in Phase R, before the first real-chain deployment.
- [ ] A layout-compatibility rule for proxy upgrades: the implementation's records by name and type, with `__gap`
  carrying no record (spec 20).
- [ ] Atomic proxy initialization (audit F11, spec open point 5).
- [ ] Today's-path security fixes, Track S S1-S3 (section 3b).

---

## 5. Phase 3: delete and consolidate (after M2)

- [ ] Remove route synthesis (`__message_bus1`, `SCB1`), the row loop, and the `__internal__graph*` bands.
- [ ] Remove static footprint recipes: permutations, cursors, access programs, constructed-key replay,
  loop-domain proofs.
- [ ] Remove the per-shape logic in the layout resolver and the worklist.
- [ ] Reduce the admission catalog to `KERNEL_OPAQUE_EFFECT` and `KERNEL_FOREIGN_DELEGATE`.
- [ ] Retire or re-scope `messageBus`, `messageBusKernel` and `messageBusGraphContext`.
- [ ] Replace `scripts/kernel-beta-manifest.json` with a proof set for the new composition path.
- [ ] Track P4: delete the remaining group C/D machinery, i.e. the `P2SH32(OP_TRUE)` dummy funders and the
  `provider.addUtxo` minting (inventory).
- [ ] Full `yarn test` and `yarn build` green. Docs updated: `message-bus-kernel.md`, `call-model.md`,
  `auto-derivation.md`.

### Phase R: real-chain deployment (after M2, per D3)

- [ ] A9 Size budget, the first step. Owner: the coordinator; about 1 day; its result gives Phase R's estimate.
  Bytes per transaction for `arbitrate` and `approveResult`: masters x (code + witness + arguments + views), plus
  the validator with density padding, state inputs and outputs, from the per-call artifacts' per-function code
  sizes. The recorded result (Log) must state:
  - both layers, with numbers: per input, 10,000 B consensus (code splitting required); per transaction,
    100,000 B relay policy and 1,000,000 B consensus;
  - first, the loader (spec 12, mitigation 1): one copy per distinct code instead of per entry; each master's
    executed-instruction count against its budget of 8 instructions per unlocking byte; the padding needed; and the
    total against 100,000 B;
  - then the other mitigations with their costs: smaller facets (linear at best); direct submission to miners (an
    operational dependency); fewer entries per transaction (gives up atomicity, the design's premise).
- [ ] The precondition in 4.7 holds before any real-chain deployment.
- [ ] A separate harness at real limits: 10,000 B per input, 800 op-cost per byte, 128 B commitments, 100 KB relay.
- [ ] Facet-split the large handlers: the 75 KB entry closure, and the 90-200 KB contracts.

---

## 6. Scoreboard (canonical harness per D2; tick when green on the target branch)

Class legend (EVAL 2.2):
- (a) no cross-contract call;
- (d) repeated calls to one callee;
- (e) fan-in or re-entry.

Titles marked NEVER have not passed on any real compile to date.

### (a) No composition: Floor A (24)

- [ ] #1 admin > transfer owner
- [ ] #2 admin > non owner cannot transfer owner
- [ ] #3 admin > pause/unpause
- [ ] #4 admin > non pauser cannot pause
- [ ] #5 admin > non pauser cannot unpause
- [ ] #6 admin > set version
- [ ] #7 admin > non owner cannot set version
- [ ] #8 admin > can not call initializer
- [ ] #9 register user > register user
- [ ] #10 register user > update user
- [ ] #11 register arbitrator > register arbitrator
- [ ] #12 register arbitrator > update arbitrator
- [ ] #13 unicrow params > set unicrow markeplace address
- [ ] #14 unicrow params > set unicrow contract addresses
- [ ] #15 mece tags > read mece tag (fixture smoke test)
- [ ] #16 mece tags > update mece tag
- [ ] #17 mece tags > remove mece tag (`removeMeceTag` is `KERNEL_LAYOUT`-refused in current artifacts)
- [ ] #21 job posting > post job with arbitrator same as creator (reverts after calls)
- [ ] #22 job posting > post job with invalid token (reverts after calls)
- [ ] #23 job posting > post job with invalid amount (reverts inside the 3rd FakeToken call)
- [ ] #24 job posting > post job with invalid deadline (client-side rejection)
- [ ] #25 job posting > post job with invalid title
- [ ] #26 job posting > post job with invalid delivery method (reverts after calls)
- [ ] #27 job posting > post job from unregistered user (reverts after calls)

### (d) Repeated callee (23)

- [ ] #18 job posting > post job 1
- [ ] #19 job posting > post two jobs
- [ ] #20 job posting > post job with whitelist
- [ ] #28 job posting > post job with invalid mece tags
- [ ] #29 job posting > post job with unregistered arbitrator
- [ ] #30 job worker whitelisting > should whitelist worker
- [ ] #31 job updates > update job
- [ ] #32 job updates > update job arbitrator (un-awaited `registerPublicKey`, see 0.3)
- [ ] #33 job updates > update job tags
- [ ] #34 job updates > update job amounts
- [ ] #35 job updates > update job many times, get history
- [ ] #36 close job > close job before timeout
- [ ] #37 close job > close job after timeout
- [ ] #38 reopen job > reopen job before timeout
- [ ] #39 reopen job > reopen job after timeout
- [ ] #40 withdraw collateral > withdraw collateral
- [ ] #41 take job > sanity checks
- [ ] #43 take job > take job multiple
- [ ] #44 pay start job > sanity checks
- [ ] #47 post thread message > post thread message
- [ ] #56 dispute > sanity checks closed job
- [ ] #63 refuse arbitration > job closed
- [ ] #64 refuse arbitration > job not taken (NEVER)

### (e) Fan-in (11)

- [ ] #42 take job > take job
- [ ] #45 pay start job > pay start job
- [ ] #46 post thread message > sanity checks
- [ ] #48 deliver result > sanity checks
- [ ] #49 deliver result > deliver result
- [ ] #53 refund > refund
- [ ] #54 dispute > sanity checks no arbitrator
- [ ] #55 dispute > sanity checks with arbitrator
- [ ] #57 dispute > dispute creator
- [ ] #58 dispute > dispute worker
- [ ] #65 refuse arbitration > job taken (NEVER)

### (e) Re-entry through `approveResult` (3)

- [ ] #50 approve result and review > sanity checks
- [ ] #51 approve result and review > approve result
- [ ] #52 refund > sanity checks

### (e) Re-entry through `arbitrate` (5)

- [ ] #59 arbitrate > sanity checks (NEVER)
- [ ] #60 arbitrate > arbitrate 80-20 (NEVER)
- [ ] #61 arbitrate > arbitrate 0-100 (NEVER)
- [ ] #62 arbitrate > arbitrate 100-0 (NEVER)
- [ ] #66 integration test > integration test (NEVER)

---


## 7. Log (append-only; newest last)

| Date | Commit | Worktree | Harness | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| 2026-08-20 | (legacy bus) | effectiveacceleration-marketplace | upstream | 43/66 | Historical best, legacy bus (EVAL 2.5) |
| 2026-08-29 | (legacy bus) | effectiveacceleration-marketplace | upstream, bail | 45 in a row | Stopped at #46 |
| 2026-09-16 | 14a866091 | kernel-beta-candidate | root | 43/66 | Historical best, kernel (`HANDOFF_KERNEL_BETA_ROUND_NEXT.md:5453`) |
| 2026-09-25 | ea7a48e27 + 43-file WIP | kernel-beta-candidate | root | 0/66 | Fixture: covenant check at input 3 (`OP_EQUALVERIFY`, output token commitment) |
| 2026-09-25 | ea7a48e27 | kernel-baseline-ea7a48e27 | root | 0/66, 578 s | Fixture: SDK throw, unfilled `__internal__msgSenderAnchorIdx` on `initialize` (`sc-fix-create-builder-delegate-unlockers.ts:622`) |
| 2026-09-25 | ea7a48e27 | kernel-baseline-ea7a48e27 | probe | n/a | `msg.sender` in `this.g()`. EVM (solc 0.8.36, `@ethereumjs/evm`): internal `g()` = user, `this.g()` = `address(this)`, `tx.origin` = user, and `this.transfer` debits the contract. Today's compiler keeps the caller (`this.who() == msg.sender` passes). A public function that reads `msg.sender` and writes state fails `OP_VERIFY` when called internally. Probes: `probes/this-call-msg-sender/` |
| 2026-09-25 | ea7a48e27 | kernel-baseline-ea7a48e27 | probe | n/a | `msg.sender` security assessment (`AUDIT_MSG_SENDER.md`). VM-demonstrated on today's path: a contract caller identified by presence (X accepted `msg.sender == A` while A ran `ping()`, `probe4`), and a `SINGLE\|ANYONECANPAY` signature reused to take ownership (`probe5`). Code-confirmed: forgeable logical-address anchors (F9), builder-chosen caller identity on the bus graph path (F10), front-runnable proxy `initialize` (F11). Spec revision 7 fixes S1-S11; D8 and D9 are open. Probes: `probes/msg-sender-today/` |
| 2026-09-25 | n/a | kernel-beta-candidate | decision | n/a | D8: no call receipts for now, documented as an option (spec R10, 14.1; T32 residual). D9: an address is the transcript's category-pinned address, `addrV(cat) = P2SH32(pin(cat) \|\| V_TEMPLATE)` (spec R5, R8, V11) |
| 2026-09-25 | n/a | kernel-beta-candidate | spec recheck | n/a | Spec revision 8 after a completeness, sanity and security recheck. Fixed: proxies as proxy master + `DELEGATE` (the implementation-master model broke D1 and minting); `DELEGATE`/`INTERNAL` callee binding (T37, critical); V7 input side (T38); value preservation (T39); state UTXOs at `stateX`; witness block first; N1 under D9. Coverage (section 15): the model covers fan-in and re-entry, but not yet enough for 66/66; open point 4 (records) and open points 1-3, 5 and D6 are on the critical path |
| 2026-09-25 | n/a | kernel-beta-candidate | spec Part II | n/a | Spec revision 9. D9: `V_TEMPLATE` v1 frozen. Part II (sections 16-23) settles open points 1-6 from code surveys of the call graph, the 66 test flows and today's record formats. Largest transaction: `arbitrate` (20 calls, Unicrow x9, about 24 masters). Verdict: every mechanism the 66 use is specified; what remains is implementation risk |
| 2026-09-25 | n/a | kernel-beta-candidate | plan | n/a | Kernel work ignored (D1): Phase 0 is now a separate worktree `.worktrees/per-call` and branch `feat/per-call` from `ea7a48e27`, with no kernel freeze, repair, floor or reference run. Track P P1-P3 and Track S S1-S3 (today's path) not scheduled. D6: as many masters as needed; one dedicated test per edge case, kept as regression guards |
| 2026-09-25 | ea7a48e27 | kernel-baseline-ea7a48e27 | evaluation | n/a | `EVAL_PER_CALL_VS_KERNEL.md`. Measured: MarketplaceV1 kernel compile 8.6-9.0 s (admission 4.9 s + binder 2.6 s = two full compiles); FakeToken 1,228 vs 797 ms without the bus; MarketplaceV1, UnicrowClaim and UnicrowArbitrator refuse to compile without the bus (`MESSAGE_BUS_REQUIRED`). Estimates: per-call compile about 2x faster; derivation 2-4x less CPU if resumable; new code 20-35K lines against about 93K kernel-related SDK lines. Main risk: compiler view mode; kill criteria added to the gate |
| 2026-09-25 | n/a | kernel-beta-candidate | plan | n/a | Implementation restructured as parallel workstreams (section 4): Wave 0 interfaces (A), Wave 1 validator (B), frames and calls (C), records view mode (R), composer (E); Wave 2 deployment and proxies (F), acceptance tests (G); milestones I1-I3, gate at I2. Each stream owns its code and its focused test directory; full runs only at milestones. Traceability: every spec check, threat T1-T41, edge row and Part II mechanism has one checkbox (185 in section 4); deferred items listed in 4.7 |
| 2026-09-25 | ea7a48e27 | per-call | setup | n/a | Phase 0.1 done. Worktree `.worktrees/per-call`, branch `feat/per-call` at `ea7a48e27`. `node_modules` from a real `yarn install --frozen-lockfile --offline` (1m47s, including the postinstall `yarn build`), not copied or symlinked: every `node_modules` is a real directory, and all 222 links (workspace packages, `.bin`) resolve inside the worktree, none broken. `dist` built for 6 packages; `solidcash` resolves `solidc` and `@solidcash/utils` from this tree. Documents copied to `docs/per-call/` (0.2), uncommitted; the `WT_CODEX` copies carry a "superseded" banner. Session switched to this worktree |
| 2026-09-25 | ea7a48e27 | per-call | review | n/a | Independent review of spec revision 9, plan and eval; findings checked against the docs and code at `ea7a48e27` before folding in (spec revision 10). Confirmed and fixed: refusal codes are 7 `KERNEL_*` + 11 `MESSAGE_BUS_*` (the eval's 40 + 36 counted identifiers); D1/D5/M1 contradictions; section 15 counts (181 = 121 expecting a revert + 60 expecting none; 59 = 57 + 2); the I2 kill threshold (6K lay below the 6-12K estimate, now 12K); no rule for pool exhaustion or derivation stalls (now named refusals, E12, E13); nested-mapping slots, value thresholds and fixed-size arrays stated in spec 20 (`__gap` is dropped under `solidityImportCompat`, `compiler.ts:12452`); M2 now also requires G2, G3, B14 and P4; stream R gets a compiler test directory. Pinned with libauth: 100,000 B is the relay policy and 1,000,000 B the consensus transaction limit, so `arbitrate` on a real chain would be non-standard but consensus-valid (A9 measures it). Added: B14 reference model with differential tests, R0 reuse proof, external audit before the `V_TEMPLATE` freeze binds (4.7). Recorded, decisions unchanged: D8 residual with owner and revisit trigger (receipts can later be events the root master checks, so v1 stays); D9 note that proxies do not cover `V_TEMPLATE` defects, with the dispatcher address form open for the user |
| 2026-09-25 | ea7a48e27 | per-call | review follow-up | n/a | The reviewer verified the revision-10 fixes and accepted the three corrections (relay versus consensus size, `__gap`, counts). Folded in: the size question has two layers, checked in libauth (`bch-2023-instruction-set.js:48` rejects unlocking bytecode over 10,000 B before evaluation, so per input is consensus and code splitting is required; per transaction, 100,000 B is relay policy), which corrects this plan's own revision-10 table; A9 must state both layers and the four mitigations with costs; D8's trigger splits by threat (untrusted assembler: master-checked receipt events, addable later; hostile code: only validator-enforced receipts, which must precede the freeze); D9 precondition, no real-chain deployment before the address form is decided and audited; D1's ticked text aligned; eval retitled to revision 10; `__gap` cites the project compile configs. Open for the user: D2, D3, and when to decide D9's address form (the reviewer says before A8) |
| 2026-09-25 | docs commit | per-call | decisions | n/a | User decisions: D2 = the root harness; D3 = out of scope until 66/66 is green on the mock, then back to real-chain deployment (Phase R after M2, starting with A9, which moved there from Wave 0); D9 = `addrV(cat)` final for v1, no dispatcher. Phase 0 done except pointing the harness at the per-call path, which needs C1. The documents are committed on `feat/per-call` in the commit that adds this row, staging only `docs/per-call/` |
| 2026-09-25 | 173d788e6 | per-call | third review | n/a | Review of revision 10 (read while the files were being edited; reviews now target a commit hash). Every claim was checked against the docs, the code and libauth. Spec revision 11 fixes: absence proofs compare the masked slot `s(k)`, not `H(k)`, and slot 0 stays reserved (as `verified-mappings.md` 2.1 does today); values over 64 bytes take the length-prefixed form; the validator exhaustion clause could never fire, because one validator of the first root's category can cover every root (V9; section 5.4 `A.x` and `A.y`), so only a contract with no validator is refused; the step cap is replaced by a termination argument (one bounded execution per master); conservation wording is consistent (preservation is a floor); the validator-enforced receipts' deadline is the freeze. Corrected against the reviewer: loading the code instead of carrying it keeps one copy per distinct code (8, or 7, for `arbitrate`'s 24 masters), so about 3x fewer copies, not 8x; it ranks first and A9 measures it first; the reviewer's "only a standalone root is unbound" assumes every contract enforces its own need test, which hostile code does not. Plan: D3 option texts aligned (the reviewer's suggestion to run A9 early is recorded, and the decision stands); "revision 9" drift removed; label convention added and clashing spec labels prefixed; Wave 0 is two coders; B15 (no master-lock assumption in `V_TEMPLATE`); on-KILL disposition and stream R review; M2 re-checks G1-G6 and the I2 KILL conditions; owners for A9 and the audit; these items are not due within this goal. Section 4 now holds 193 checkboxes (the 185 of the earlier row was right when it was written) |
| 2026-09-25 | rev-11 commit | per-call | docs | n/a | Spec revision 11 committed, in the commit that adds this row (user OK). The superseded copies in `WT_CODEX` were deleted (user OK): six documents and `probes/`. Each was checked first: banner present, unchanged since the banner, never committed on any branch; `probes/` byte-identical to `docs/per-call/probes/` |
| 2026-09-25 | 5037bfd38 | per-call | fourth review | n/a | Review of revision 11. It read the working tree just before `5037bfd38`, which adds only the 0.2 bookkeeping to what it read; later rounds cite the commit they read. The reviewer verified every revision-11 fix, conceded both corrections (the loader keeps one copy per distinct code; hostile code can skip its own need test), withdrew the step-cap concern and the "run A9 early" suggestion, and gave worked loader totals: about 64 KB at 4 KB facets and 100-125 KB at the 10,000 B cap. Spec revision 12 adds those totals, the residual left even with validator-enforced receipts, both value thresholds side by side, and the validator refusal named by the first root's category. Corrected against the reviewer: "one validator per root category" is not needed, since V9 constrains only a group's first root. D3 gains its real rationale: the only deadline is the freeze, which D3 defers, and B15 keeps the loader open after it |

| 2026-09-25 | 6df597fd3 | per-call | interfaces | n/a | Interface freeze, version 1. `packages/utils/src/per-call/` publishes the witness block (`"PW" 01`), the transcript (`"PC7" 01`), the canonical encodings and `argsHash`, category pins and derived addresses, the record-entry convention and the stop-site schema; `packages/utils/test/per-call/vectors/` holds the golden vectors. 113 tests. A later change to any of them needs a version bump and updated vectors. |
| 2026-09-25 | 6df597fd3 | per-call | reuse proof | n/a | The shipped sorted-list, covenant-helper and state encoders were tested against the record semantics the design assumes: exact read, absence by strict predecessor on the masked slot, insert with a relinked predecessor, update in place, delete as the default value, composite keys resolving through one collection, and the value-tail thresholds. 29 tests, expectations built independently of the code under test. One divergence: section 20 states the direct-value case as a measurement ("canonical encoding at most 64 bytes"), while the shipped classifier decides it from the *type*, so a `sig` or an unbounded `bigint` mapping value is stored verbatim and can exceed the tail. See Deviations. |
| 2026-09-25 | 6df597fd3 | per-call | validator | n/a | V1-V11 derived as pure checks over a transaction description (`packages/solidc/src/per-call/validator/`), an independent reference model, one hostile test per check (18), and a seeded differential harness: 240 generated compositions over two seeds with zero accept/reject, rejection-check or derived-order disagreements. The golden re-entrant composition is accepted at the section 5.1 indices with the section 8 derived order. 25 tests. The master-side checks and the state rules are outside the derivation by design. |
| 2026-09-25 | 6df597fd3 | per-call | composer | n/a | Resumable depth-first derivation with one program run per published site and no transaction-wide fixpoint, witness and transcript assembly, block layout for the nine shapes of section 5.4, pool selection with several validators per transaction, and both refusals. 35 tests. Program execution is an injected step, so no script is evaluated. |
| 2026-09-25 | 6df597fd3 | per-call | defect | n/a | Three independent streams found the same decoder defect: `decodeWitnessBlock` read a call record as `kind, calleeRef, target, value`, so no block containing a call round-tripped through its own encoder. Fixed, together with two over-strict rules this work had introduced (a record created by a frame's first segment is permitted; the argument pushes are the pushes between the witness block and the redeem script). A consumer's local copy of the decoder was removed in favour of the frozen codec. |
| 2026-09-25 | 6df597fd3 | per-call | gate | n/a | Gate I2 is not reached. It requires the acceptance toys and shapes to settle under generic rules, which needs the master code generation and the record view mode, and neither exists. The recorded decision is therefore KILL, so the swarm stops and the gate report goes to the user. What the gate rests on: the interface is frozen and pinned by vectors; the validator's decision procedure exists with an independent model and a differential harness; the composer's derivation, assembly, layout and refusals exist; and the record-reuse claim the design depends on has been tested, with one divergence found. What is missing is the compiler path (streams C and R) and everything downstream that needs a compiled artifact. |
| 2026-09-25 | 6df597fd3 | per-call | measurement | n/a | Line delta: 9,195 insertions across 59 files, of which 4,043 source in 29 files and 5,152 tests in 30 files. The compiler source delta is 1,366 lines against the plan's 6-12K estimate and its 12K kill threshold, because the master code generation is the part that is not implemented. The composer suite, including vitest startup, runs in about 2.6 s; the plan's 5 s bound applies to deriving the re-entry toy, and the derivation driver is far inside it, but it times a stub step rather than script execution, so the bound is not yet genuinely tested. |
| 2026-09-25 | d90acd49b | per-call | prologue | n/a | The master prologue is implemented and evaluated in the VM: the category-ownership check and the recreation-in-place check, each isolated and exercised against real transactions, plus a stack-neutrality case proving the prefix leaves the stack as it found it. A faithful master recreation is accepted; an input with no token, a foreign category, a spent token without minting capability, an output that does not recreate the master at its index, a non-empty commitment, a different lock and an output worth less than the input are all rejected. 12 tests in `packages/solidcash/test/per-call/frames/`. The code generation that embeds this prologue into an artifact does not exist, so no compiled contract carries it yet. |
| 2026-09-25 | 2b57c1ce0 | per-call | reader | n/a | The witness block is read inside script: the first push of the input's own unlocking bytecode, bounded by the length that push declares, so the argument pushes and the redeem script that follow are excluded. Both push forms a realistic block can use are handled. The frame fields are then walked from the fixed-width header, leaving sender, the self claim, value and the remaining fields. Evaluated in the BCH-2026 VM: each field is compared against a value from outside the block so a wrong offset rejects, and a block mutated in one field fails at that field. 19 tests in `packages/solidcash/test/per-call/frames/`, alongside the prologue. The frame checks that follow (kind, caller reference, hash type, self against the code constant) are not written. |
| 2026-09-25 | 88ebb9650 | per-call | integration | n/a | The composition hook was investigated to see whether a compiled master can be emitted additively. It cannot, and the reason is now recorded at the call sites rather than as a guess. A master must take msg.sender, address(this), msg.value and tx.origin from its witness block, and today each is emitted inline from the transaction with no per-call branch: `emitMsgSender` and its `emitTxOrigin`/`emitMsgSenderMintingVerification` fallbacks (`GenerateTargetTraversal.ts:36133`, `:36247`), `emitMsgValue` (`:36178`, stateless branch at `:36198`), `address(this)` as `OP_INPUTINDEX OP_UTXOBYTECODE` (`:12956`) with `emitMasterInputIndex` (`:33917`) as the base of every state and category read, and `emitTxOrigin` (`:35884`) as a first-non-token-P2PKH scan. The synthetic frame parameter is injected at `SymbolTableTraversal.ts:3132` and its signature list built at `compiler.ts:10048`. The return check has no mechanism at all: entry points encode returns as return-events rather than leaving them on the stack to compare with `retval`. The artifact carries a single `bytecode` (`artifact.ts:1613`) and publishes per-selector bodies only on the message-bus path (`compiler.ts:14045`), so a per-entry master slot has to be freed. The category pin and `addrX` are deployment-time while the prologue needs a compile-time category, so the pin needs a placeholder that the SDK fills. Wrapping the traversal output with a prefix cannot work: the body would still compute the frame fields from the transaction, so the emitted master would claim the convention while violating W1, O1 and N1. The option therefore keeps refusing, and the direct path is pinned byte-identical by `solidc/test/per-call/master/direct-path-identity.test.ts`. |
| 2026-09-25 | ccc4acc44 | per-call | master emission | n/a | The composition option now emits a master for the shapes the compiler can carry: one inlined entry point, no selector dispatch, no external calls. The head removes the unlocking bytecode's own copy of the block, runs the ownership and recreation prologue with the reserved constant slots, reads the witness block, checks the root-frame rules, and leaves the frame fields as tracked stack slots; the four sites that emit `msg.sender`, `msg.value`, `address(this)` and `tx.origin` branch on those slots the way the message bus already branches on its logical context, so a frame field comes from the block rather than from the transaction. 29 tests in `solidc/test/per-call/master`, 13 of them VM-backed: a well-formed root spend is accepted and `kind`, `validatorRef`, `callerRef`, `sender`, `self`, `value`, `originRef`, the recreation and the value floor are each rejected on mutation, with a decoy caller input proving the fields come from the block. The direct path is unchanged and its pinned bytecode and assembly hashes still pass. Everything else is refused by name: two or more entry points, fallback, a constructor body, returning entries, external calls, `new`, function pointers, inline assembly, events, imports and side-cars. Also found and fixed: deployment read `artifact.bytecode` as hex although an artifact publishes assembly, so its slot offsets applied to a string — the fixture published hex too, which is why its tests passed while every real artifact would have failed. |
| 2026-09-25 | cc40519d3 | per-call | end-to-end | n/a | The join this path was missing: a contract is compiled for the convention, deployed through the shipped deployment, and the BCH-2026 virtual machine accepts a real spend of the result — 290-byte program, address `aa204cb9…b69287`, witness block 96 bytes at input 1 — with three controls refused (a root frame claiming a value, a foreign category, a non-root frame). Two runs are byte-identical. Committed as `solidcash/test/per-call/frames/compiled-master-spend.test.ts`, alongside the deploy suite's 28 tests including one that pins the program format in both directions. |
| 2026-09-25 | 8e37a6452 | per-call | dispatch | n/a | A contract with several entry points now compiles to one master whose entry is selected by the dispatcher selector that leads the argument pushes; the frame shift is handled by the stack model rather than by hand, with the head's frame names seeded into each dispatched body's sub-traversal. Evaluated in the BCH-2026 machine: each entry reachable by its own selector and running its own body, an unknown selector refused, the frame rules enforced per entry, and a contract whose entries take arguments reading the argument from below the head. 64 tests in `solidc/test/per-call`. The direct path is unchanged and its pinned hashes still pass. Cross-package acceptance: a two-entry contract compiled, deployed through the shipped deployment and spent once per entry leaves exit 0 (`multi-entry-spend.mjs`, scratch). The return check stays refused, now naming the entry: it needs a 32-bit length-prefixed field reader, a fifth frame slot, and the direct path's return-event machinery suppressed. |
| 2026-09-25 | 22ca95f07 | per-call | need test | n/a | Whether an entry needs a validator is now a decision the composer makes: it was reached by a call, it makes an external call, or the transaction spends more than one master of its contract. The standalone case is the same facts read from the other side, stated as the reasons that would disqualify it, and one rule composes them — a plan must cover every entry that needs a validator, and an entry with none must satisfy the conditions for standing alone. A validator is recognised through its redemption path: the last push of its unlocking bytecode is its redeem script, which must begin with the category pin and end with a program hashing to the constant every master carries. 58 tests in `solidcash/test/per-call/composer`. What is not done is the master emitting that check: N1 is still absent from the emitted program. |
| 2026-09-25 | f32d32f7f | per-call | calls and N1 | n/a | A composed frame now walks the whole witness block instead of discarding its variable-length tail, and checks the call shape: a callee that is not the master itself, the callee's own call data, the argument hash over the selector and the argument pushes, the recorded kind and target, and the result. Validator recognition is both halves the spec states — a mutable token of its own category, and a redeem script that is the category pin followed by a program hashing to `H_V` — with the transcript skipped rather than interpreted. Evaluated in the BCH-2026 machine with three inputs co-spent: a calling master, its callee and one validator are accepted; a mutated argument hash, a callee that is the caller itself, a wrong target, a missing validator where one is required, a validator running another program and a validator of another category are each refused. The stream also found and fixed a signedness defect in the in-script reader: push lengths were decoded with a signed conversion, so any witness block between 128 and 255 bytes was misread. 74 tests in `solidc/test/per-call`. The composed path is reachable only through the head builder — the compiler still refuses a contract that makes an external call because the master needs `H_V`, which the compiler has no deployment-time value for. |
| 2026-09-25 | 1827bd21b | per-call | assembly | n/a | The composer assembles a whole composition: the plan speaks in identities and the assembly resolves them to absolute input indices once, from one layout, so a reference cannot come to mean two different things. Coverage is stated rather than derived from settlement, because a validator covers a contract whose single master still settles itself. Every unresolved reference, a self-call, a contract covered twice and a user input colliding with a participant are refused; the transcript is ordered by index so two builders produce the same bytes. Its own end-to-end test spends through the assembly, so the assembly is the thing under test rather than a helper beside it. 68 tests in `solidcash/test/per-call/composer`. |
| 2026-09-25 | 31cdc7875 | per-call | hash slot | n/a | The descriptor grows an optional third slot for the validator program's hash. A master that can be reached through a call has to check that the validator it points at runs the expected program, and that program's hash exists only once the validator is deployed; a master that stands alone never reads it, so a contract whose entries make no external call reserves nothing. Filling or omitting the value against what the descriptor declares is refused in both directions. 39 tests in `solidcash/test/per-call/deploy`. |
| 2026-09-25 | cfc22775c | per-call | deployment | n/a | Deployment fills the program hash where the descriptor reserves a slot for it, and verification reads it back and compares it. Verification's byte-exterior check now covers every declared slot rather than the two it was written for: with a third slot a filled hash was reported as a byte changed outside the slots, which the new test caught. |
| 2026-09-25 | 371b35a46 | per-call | compiled caller | n/a | The composed path is reachable from `compileString`: a contract whose entry makes an external call compiles to a master that recognises its validator against the reserved hash slot, and publishes three offsets. Measured: a standalone contract publishes `{version:1, categoryOffset:4, addressOffset:259}` unchanged, a calling one publishes `{version:1, categoryOffset:1, addressOffset:430, templateHashOffset:575}`. The call is checked by the head rather than lowered — the body's direct-path external call and its epilogue verification are elided — so admitted calls are narrow. Evaluated in the BCH-2026 machine: a compiled caller master, a callee and a validator accept together, and a mutated program hash refuses both masters while the validator's own script still accepts, which attributes the refusal to the reserved-slot check. Standalone scripts verified byte-identical (stateless and stateful) before and after. 79 tests in `solidc/test/per-call`. |
| 2026-09-25 | ece64f9e7 | per-call | settlement | n/a | The composer chains a plan's record declarations into one transition: each segment declares a record's whole commitment at its start and its end, so the first has to agree with what the transaction spends, each later one with the declaration before it, and the last with what it writes. A record touched by more than one master chains across executions in the order they ran, which the caller supplies because only the derivation knows it. Also refused: a record created twice, touched after deletion, or moved between indices. 83 tests in `solidcash/test/per-call/composer`. |
| 2026-09-25 | 5eece5ec3 | per-call | compiled callee | n/a | Both sides of a composition now compile: a master admits the call frame kind and emits its arm, requiring a validator because the edge is the validator's to bind, and every per-call master therefore reserves the program hash slot. Measured: a standalone master publishes `{categoryOffset:4, addressOffset:161, templateHashOffset:313}` and a caller `{categoryOffset:4, addressOffset:448, templateHashOffset:602}`. Evaluated in the BCH-2026 machine with both masters compiled: the caller, the callee and a validator accept co-spent; the callee also accepts a direct user entry; a call frame naming no validator is refused, as is a frame claiming the root arm's caller shape or its zero value, each with the validator still accepting so the refusal is attributable. The per-call root-frame script changed — the convention is unreleased — while the direct convention's pinned bytes still pass. 85 tests in `solidc/test/per-call`. |
| 2026-09-25 | f8b9818c1 | per-call | signature hash type | n/a | A root frame's caller signature must now commit to the transaction: the head reads the caller's unlocking bytecode, takes its first push and requires its last byte to be `SIGHASH_ALL` or `SIGHASH_ALL|SIGHASH_UTXOS`, which differ only in bit five, so masking that bit accepts exactly those two and rejects `NONE`, `SINGLE` and `ANYONECANPAY` combinations. That closes threat T20, which the spec marks Critical. Evaluated in the BCH-2026 machine: both accepted values pass on the compiled and deployed master, `0x01`, `0x02` and `0x03` are refused, a caller with no push at all is refused rather than misread, and a call frame is unaffected because a caller that is a master carries no signature — the co-spent callee and validator still accept while a root caller is refused. Fixtures that spent a master now give the caller a signature through a shared per-directory helper, since a caller with no signature is refused where it used to be accepted. 91 tests in `solidc/test/per-call`, 33 in `solidcash/test/per-call/frames`. |
| 2026-09-25 | 043dc8427 | per-call | values | n/a | The composer checks that a plan's values hold: a record keeps at least the value it had unless a listed send pays from it, and a listed send is paid exactly, meaning the output it names holds exactly what it claims. A created record starts from nothing, so preservation asks a floor of zero of it, and a send the funder pays asks nothing of any record. 96 tests in `solidcash/test/per-call/composer`. |
| 2026-09-25 | ef2cb5511 | per-call | call arguments | n/a | A call that passes arguments is now admitted. The argument hash was a compile-time constant over the selector alone; it is now read from the callee — its call data is everything between its witness block and its redeem script, the selector push is split off, and `SHA256(selector || argument pushes)` is computed in script and compared against the hash the caller recorded. One path serves both shapes, so the constant is gone. Adds a script helper that drops the last push of a byte string, beside the ones that split the first, with the same length-prefix signedness fix. Evaluated in the BCH-2026 machine with two compiled masters and a covering validator: a call with arguments is accepted, the argument reaches the callee's own body, and a mutated recorded hash, a mutated argument push and a different selector are each refused. 100 tests in `solidc/test/per-call`. |
| 2026-09-25 | 0dffc209e | per-call | call data | n/a | The composer requires a callee to carry exactly the call data its caller recorded: a call's arguments live in the callee's unlocking bytecode and the caller commits to their hash, so the callee's call data is its caller's to name. A callee is one input with one call data, so two callers passing different arguments cannot both be right, a master nobody calls carries none, and a call that does not begin with a four-byte selector is refused. 100 tests in `solidcash/test/per-call/composer`. |
| 2026-09-25 | 52d85c409 | per-call | whole tail | n/a | The tail walk no longer drops what follows the call records: it walks the segment section, checks each record entry's shape (kept has `in == out`, created has no `in`, deleted has no `out`), requires the segment count to be one more than the call count, then checks each listed event output carries an immutable token of the contract's category with strictly increasing output indices, each listed send output is a P2PKH, and nothing follows the last field. That closes T33 and the event and send sections of T41 and S4. 20 VM-proven cases in `solidc/test/per-call/master/witness-tail.test.ts`, plus three admission cases, 123 tests in `solidc/test/per-call`. The stream found that token-category introspection omits the capability byte when a token has none, so an immutable pin is the bare category and the minting byte has to be stripped from what introspection reports. |
| 2026-09-25 | c11d17781 | per-call | output regions | n/a | The composer requires a plan's output regions not to collide: a record, an event and a send each hold a different thing, so one output holds one of them, and two events at one output would make the event log ambiguous. 107 tests in `solidcash/test/per-call/composer`. |
| 2026-09-25 | e74bf88bc | per-call | immutable pin | n/a | The category pin now handles a token with no capability: introspection reports the bare category there, so a pin built as category-then-capability could never match an immutable token. A VM test holds both forms — the immutable case passes, the pair against an immutable token fails, and each capability is proved separately. Every existing caller pins a mutable or minting capability, so nothing emitted changes. 119 tests in `utils/test/per-call`, six in `solidcash/test/per-call/frames`. |
| 2026-09-25 | bd63ce654 | per-call | events | n/a | A compiled entry can now spend its own event. The head leaves each listed output index as a tracked stack slot and the body takes the index from there, instead of reading the direct path's block layout, which a master does not have. The split is explicit: the head establishes that each listed output carries an immutable token of the contract's category, that the list strictly increases and that its length is the count the entry fixes; the body computes the payload and requires the output at its slot to commit to it. The per-call arm of the immutable-output pin also refuses an own-category immutable token at an output the witness does not list. Verified in the BCH-2026 machine: the spend is accepted with the event at the listed output, and refused for another category, a mutable capability, no token, a payload the body did not compute, a lock that is not the covenant, an empty event list, and an unlisted token beside the event. 138 tests in `solidc/test/per-call`. A compiled event contract is 1165 bytes of program and the head grows two bytes per listed event. |
| 2026-09-25 | 8f55f828f | per-call | trailing outputs | n/a | The assembly allocates the trailing region — one output per event, one per send, one per created record, then change — reports it, and requires the plan's declared indices to be the ones allocated, so a caller is never its own source of output coordinates. An event or a send at a participant's own output is refused. 113 tests in `solidcash/test/per-call/composer`. |
| 2026-09-25 | this round | per-call | correction | n/a | Two records were wrong and are corrected here. **The gate.** A KILL was recorded when the gate had merely not been reached; the plan kills only if I2 is not reached within four weeks of the interface freeze, which is 2026-10-23, and one two-week extension is allowed when I1 is green and every GO criterion holds. The gate is therefore **not yet due**, and work continues to that deadline with no extension claimed. The Log row that recorded KILL is left in place as history. **The validator.** Items B1-B15 and E1 were ticked on the strength of TypeScript derivations: V1-V11 exist as pure checks with one hostile test per check, an independent reference model and a differential harness over generated compositions, and E1 as a resumable derivation driven by an injected step. `V_TEMPLATE` — the program that would enforce those checks on chain — does not exist, and every VM test uses a stand-in validator program whose hash the master recognises but whose rules it never runs. Those items are unticked until the script exists, and the derivations are recorded as the reference to test it against. |
| 2026-09-25 | a07e00d98 | per-call | forged arguments | n/a | A review found that a forged call argument was accepted, and it was right. The caller recomputed the argument hash from the callee's own bytes and compared it against the hash in its own witness block, and both are chosen by whoever builds the transaction, so a pair that agreed with itself passed every check and the call ran with the caller's authority carrying an argument its source never passed (T8). A failing case was written first and is now green: the record's hash must equal the digest the caller's **own code** computes from the source's argument values, and the retained callee-bytes check ties the callee to the same record. An argument that is not a compile-time value is refused by name, since the caller cannot compute a digest for it. 139 tests in `solidc/test/per-call`. The check is still emitted once per master in the head rather than at each call site, which is the larger change the same review asks for and the reason every entry must still make the same calls. |
| 2026-09-25 | d9ec701b5 | per-call | record settlement | n/a | A standalone master now settles the data-NFT record its entry reads and writes against its own segment views, in the master head, without `V_TEMPLATE`: each declared record's `in`/`out` carry the category with the mutable capability, `UTXOTOKENCOMMITMENT(in)` equals the declared `viewIn`, `OUTPUTTOKENCOMMITMENT(out)` equals the declared `viewOut`, the output keeps the input's value, every input carrying the category is the declared record and no other is, and no output carrying it goes undeclared. That is S1's endpoints, S3's input rule, the census and S4's value floor for the shape that can stand alone. 7 VM cases driven through the real entry point, 146 tests in `solidc/test/per-call`; the direct convention is byte-identical. **Two findings, both precise.** First, the cross-segment chain — "every later `viewIn` equals the previous `viewOut`" — **cannot be driven by a self-settling master**: S applies only to a master that made no DELEGATE or INTERNAL call, N1 lets only a master with no external call stand alone, and the layout fixes one segment per call, so such a master always has exactly one segment and the clause is vacuous for it. That clause is V7's, so it needs the validator program: **the validator is what unblocks the rest of the records stream, not the other way round.** Second, a listed send does not name the record that pays it (spec 16 versus 7.1 S4), so the value rule cannot be enforced as the off-chain mirror states it; the floor is emitted only when there are no sends, which is every compiled master today. |

---

| 2026-09-26 | 13aaad66c | per-call | validator program | n/a | The validator program is emitted and enforced by the machine for its first rules: the validator recreates itself and a master of its category is spent (V1), the transcript's wire name, version and root count parse and every root index is in range (V2, partial), and the first root's category is the validator's (V9). A differential suite runs every generated composition through both the program and the derivation, requiring the program to refuse what the derivation refuses for a rule it claims and never to refuse what the derivation accepts; it passes over 400 generated cases plus one targeted test per rule. Two defects the machine exposed were fixed in the emission (`OP_NIP` keeps the tail of a split, and `OP_SIZE` does not consume its item, so a duplicate taken to measure one leaked a stack item per loop iteration). The address derivation now pushes the pin for the same reason a contract's does. Finding: the reference composition is already at the published operation-cost density before any program runs, so the program cannot fit inside it without a smaller program or unlocking padding. |

| 2026-09-26 | 9f21fb5e5 | per-call | call sites | n/a | A call's checks are emitted where the source makes the call. The site's own code reads its witness block, walks to the record its index names, and requires the record's kind, target and `calleeRef` to be the site's, its `argsHash` to be the digest the code computes from the source's own argument values, and the co-spent callee's call data to hash to the same digest. The value the body uses for the call is the record's result, so a call whose result the caller uses compiles; a site that returns nothing requires an empty result. A test changes the callee's argument and the recorded hash together and expects the caller to be refused, with the callee's own input still accepted. What stays positional is which record a site addresses, so calls remain unconditional and unrepeated. |

| 2026-09-26 | 9f21fb5e5 | per-call | fifth review | n/a | Corrections after the fifth review. The send rule was reverted to the wire form: the frozen codec, its vectors and every consumer write `{ out }`, and the revision that added a paying record to the spec never reached the codec. Section 20's clause that any value over 64 bytes takes the length prefix is removed, because the shipped classifier decides the form from the type. The reasoning that put the validator first was wrong: the spec's self-settlement condition is one master that made no `DELEGATE` or `INTERNAL` call, not one that made no call at all, so a master with ordinary calls has several segments and chains them itself; what blocked that chain was compiling calls at their call site. The order of the remaining work is restated in the gate report, and the kill criterion is recorded as untestable rather than trended. |

| 2026-09-26 | 3033a1fbd | per-call | census attempt | n/a | The census exemption for a validator of the contract's own category was implemented (the head parks its reserved validator-program hash on the alternate stack; the census reads it and admits a state token that is the declared record or a recognised validator of the category, keeping the strict rule when no hash is parked). The impostor control refuses as it should, and every existing settlement test passes with the hash taken, but the accept case for a hand-built validator input does not, and the cause is the recognition's reading of the validator's unlocking bytecode rather than the census. Unverified script is not shipped: the change was reverted to the committed state and the diagnosis recorded. |

| 2026-09-26 | 8acc2d640, dbfd3495a | per-call | byte order | n/a | The category byte order is settled everywhere: a pin, a reserved category slot, `addrV` and the recognition that reads them are built in the chain's order, while a token handed to the machine stays in the display order (`OP_UTXOTOKENCATEGORY` answers with the display category reversed, measured against libauth). The suites that check a pin now use seeded categories, so a category of one repeated byte can no longer hide a missing reversal, and a deployment test reads the slot back out of a real deployment and requires the chain order. Repeated-byte categories remain only in tests of the deployment format itself. |

| 2026-09-26 | 9ad622305 | per-call | census | n/a | The census admits the contract's own validator. A state token of the contract's category is allowed when input i and output i are both locked to the address baked into the master, so settling a record can consume and recreate the validator in place without the census calling it an unexpected mutable. The address is read from the running script rather than from a second placeholder, and the pushes the census compares are rewritten to the post-optimiser payload offset, because the optimiser moves the slot and the baked offset would otherwise be compared against the wrong bytes. |

| 2026-09-26 | fe317b366, 89643c3f2, bfca66217, 408b01a9f, 7a6010303, a02658692, bcdf73cf2, 63bbc70d4, fbeae527e, b52b7ec5b | per-call | validator program | n/a | Seven of the eleven checks are now enforced by the shipped program and differentially tested against the derivation over 400 generated compositions plus one targeted refusal each: V1, V3, V4, V8, V9, V10, V11. Two more are partial and are not claimed: V5 covers an ordinary call completely — the callee must record the same caller, kind, origin, value, sender, address and result, and its own pushes must hash to the recorded digest — but not the `DELEGATE` target rule or the `INTERNAL` same-contract rule; V2 parses the transcript and every covered master's witness block without deciding every encoding rule. V6 contributes reachability, so cycles and unreachable masters are refused and each covered master is entered exactly once, while its ordering half — a callee running between its caller's segments — is carried by the record chains and is not emitted, so V6 is not claimed either. V7 contributes one rule, that no category is settled twice. The settlement rule is complete, both halves: `b52b7ec5b` fixed a borrowed-frame branch that was written but never called, and an end-to-end case with one root master delegating into a second contract is accepted when the transcript settles the caller's contract and refused when it does not. The program's own lock is the address of the script running it, and every covered master presents the address of its own category. |

| 2026-09-26 | reverted | per-call | value floor attempt | n/a | V7's value floor was implemented as the one chain rule that needs no record grouping: an entry naming both the input it recreates and the output it is recreated at must leave that output holding at least what the input held, less what the writing frame's send list pays. The frame's send values are summed on the alternate stack above the settled categories, and only frames of a settled contract are examined. It works for the single-contract plan — a record written one satoshi short is refused — but it refuses compositions the derivation accepts across the generated corpus (41 of 400), including unmutated ones, and it does not fire for the reference composition's record at all. Two symptoms, so at least two defects in the frame walk or the send sum; unverified script is not shipped, so it was reverted to `2822497bc`. The pieces to check first: whether the send sum matches the derivation's per-frame `paid`, and why the reference composition's entry is skipped. |

| 2026-09-26 | reverted | per-call | value floor, isolated | n/a | The value floor was rebuilt and measured one piece at a time with the fragment run alone over the fixture's real transactions, replacing the validator's redeem with the fragment. Two facts. The floor itself is sound: with the send total taken as zero it accepts every frame of the reference composition, and in the full program it refuses a record written one satoshi short on the single-contract plan. The send total is where it breaks: on that same plan the frame whose send list is `1000` sums to `10000`, an output the frame does not send from, so the walk into the send list lands in another section of the block. The expectation came from the plan (`sendValues`), not from a literal. Reverted to `10bfd686f`; the next attempt should count the block sections the walk consumes against the codec before touching the entry arithmetic. |

| 2026-09-26 | n/a | per-call | value floor, section audit | n/a | Negative evidence worth keeping. The send walk was checked against the codec field by field and against the program's own trusted `consumeWitnessBlock`: ten header bytes (magic, version, kind, three references), the two length-prefixed addresses, the eight-byte value, the four-byte retval, then calls, segments, events and sends, each a `u16` count with `dropCall`/`dropSegment`/a two-byte drop per item. That is the same sequence `consumeWitnessBlock` already uses and passes with. Also, the wrong total is produced by a clean evaluation, not an error, so the send loop consumed exactly as many items as its count claimed — the cursor was somewhere with that many bytes, not at the true send section where only one index remains. So the defect is above the send loop, in how the second pass reaches it, and the next attempt should read the frame's own block out of the transaction and compare its section boundaries against `encodeWitnessBlock` rather than reasoning from the total. |

| 2026-09-26 | n/a | per-call | value floor, bisected | n/a | The walk was bisected with the fragment run alone, stopping at each read and comparing against the fixture's own block. Three reads are correct: the walk lands on the send count (`1` for the frame that pays and `0` for the frame that does not), and it reads the send list's first entry (`5`, the index the fixture allocated). The read that disagrees is the value: the machine reports something other than the planned `1000` for that output index, so the fault is in the value read or in the transaction the harness hands the machine, not in the walk. Next: print the machine's whole output list for that transaction beside the fixture's, and compare index by index. |

| 2026-09-26 | ecd65f0b9 | per-call | fixture list order | 435 passed | `materialise` numbers each output by its position in the fixture's list rather than by the index the fixture allocated, so a list that was not sorted by index would hand the machine one output's content under another's index — which is exactly what a check reading `OP_OUTPUTVALUE` would then see. It is not the cause: the reference and single-contract compositions both list their inputs and their outputs in strictly increasing index order, with no repeats. Four tests now assert that, so the next reader of a value through an output index can rely on it. The value read itself is still unexplained, and the remaining instrument is the one that worked before: have the probe compare against several candidate values and report which one the machine agrees with. |

| 2026-09-26 | n/a | per-call | value floor parked | 435 passed | The transaction is not the cause: the modelled transaction holds exactly the planned send value at the index the frame lists, so the fixture and the transaction agree. With the walk, the send count and the send index all verified correct, the disagreement is inside the value read itself — either the fragment's use of `OP_OUTPUTVALUE` or that opcode's answer in this instruction set — and it stays unexplained after four attempts. Parked rather than pursued further: the record value floor is one rule of V7, while the three items that gate the first end-to-end milestone — a second master reading state from a segment view, the composer driving real scripts, and settling a record across several segments — have not started. V7 therefore remains partial in the plan, with the duplicate-settle rule enforced and the value floor, the chains and the census open. |

| 2026-09-26 | 660819e7a | per-call | cross-segment settlement, where it is blocked | 435 passed | Located, not yet changed. The block is `assertStandalone` in `master-head.ts`: it refuses whenever the master has any call site, so a master with ordinary calls never reaches the settlement path and its frame is checked as if it had one segment. The spec's condition is narrower — one master that made no `DELEGATE` or `INTERNAL` call — so the refusal should key on the kind of the calls, not their number, and the settlement that follows has to chain each record's views across the frame's own segments rather than compare a single segment against the spent UTXOs and the written outputs. That is the first I1-critical-path item to take: calls are already compiled at their call site, which was what the earlier note said blocked this chain. |

| 2026-09-26 | dae989726 | per-call | records read | 573 passed | A stateful master's body now reads and writes its data-NFT block where its own frame's first segment declared it, not at a fixed offset from the input the frame runs on. The tail walk parks that segment's declared record indices on the alternate stack; the head hands them to the body as tracked slots; and every state site — the read, the write, the bytecode and category preservation, the category check, and the value and token preservation — addresses the input or output block through them. A segment that declares no record parks the sentinel, so a read through it fails its index instead of reading another input. The sites with a compiled sibling stay inline for a per-call master, because a shared helper would bake in a depth the invoking frame does not share. Two cases drive the shipped path — source through the shipped compiler, the deployment slots filled, the BCH-2026 machine asked for a verdict: a dispatched stateful master whose record sits away from its master, and a master whose execution is split at a call with its record last. Both fail with the slots taken away, so the read path and not the settlement is what they prove. The direct convention is byte-identical; the identity tests pin it. Focused suites from a fresh `yarn build`: 113 utils + 193 solidc + 267 SDK = 573. |
| 2026-09-26 | 95707003a | per-call | run-time arguments | 202 solidc + 267 SDK | A call site's record digest can now be computed from values the caller holds when it calls, and not only folded from compile-time ones. An argument that is not a constant is admitted when its declared type is a scalar; the site turns the value it holds into the push the wire carries — empty, `OP_1`-`OP_16`, `OP_1NEGATE`, one to 75 bytes under their own length, then `PUSHDATA1` and `PUSHDATA2` with the length's own minimal encoding — concatenates `selector \|\| pushes`, hashes it, and the record check compares the record against that digest taken from the alternate stack rather than against a constant. Five cases drive the shipped path: a bounded number (`tx.inputs.length`) and bytes (`tx.origin`), each accepted at the caller, the callee and the validator; refused when the record carries another digest; refused when the callee carries other pushes; and refused when the callee's body sees the wrong value. A fragment test compares the emitted push against libauth's `encodeDataPush` over raw values, numbers and a non-minimal `0c00`. The direct convention's identity tests still pass byte for byte. |
| 2026-09-26 | 0632ecdc6 | per-call | argument order | 114 utils + 207 solidc + 267 SDK | The two-argument refusal seen last round was the symptom; this is the cause. A callee's call data carries the last parameter's push first and the first parameter's push last: the compiled body reads its parameters off the stack and the item the first parameter names is the one on top, which the measured two-parameter body shows by reading its first parameter at depth 4, immediately above the frame's four values — and the SDK's own unlocking-bytecode comment documents the same order. The compiler folded the digest in parameter order, so the two sides could never agree: with the pushes in wire order the callee accepted while the caller refused, and with them in parameter order the caller accepted while the callee's body misread both. The order is now stated once, in `encodeCallDataArguments` (values named in parameter order, pushes in the order the wire carries them), and the run-time digest folds the values in that same order. Four new cases cover both digest paths — two run-time arguments (a number and bytes) and two compile-time ones — each accepted at the caller, the callee and the validator in wire order, and each refused when the same two values are ordered the way the source names them, which is a call the callee's body would accept but whose own caller refuses. All four fail against the previous order and pass against this one, measured by putting the two emissions and the digest builder back, rebuilding and re-running. The spec's `args` sentence and the canonical module's header both claimed parameter order and are corrected; the composer's plan interface now states which order it takes. |
| 2026-09-26 | 0632ecdc6 | per-call | goal start state | 114 + 207 + 267, twice | Recorded before changing code. The branch tip is `0632ecdc6`, the argument-order fix whose row is above. The three focused suites run twice with identical counts — 114 in 5 files (`@solidcash/utils`), 207 in 26 files (`solidc`), 267 in 25 files (`solidcash`), 588 in total — and the forced project-reference build exits 0; both captures are in the goal's scratch dir. The first unchecked item in this document is section 0.3's "Point the harness at the per-call path (`composition: 'per-call'`) for the new branch only", which the plan gates on C1 and this goal's own scope leaves with the harness. |
| 2026-09-26 | 2174295ca | per-call | stop sites and the shipped host | 114 + 212 + 274 | The composer's derivation no longer needs a stand-in. The per-call compiler now publishes each entry's stop sites (C10 above) and attaches them to `artifact.composition`; a new host in `packages/solidcash/src/per-call/composer/shipped-host.ts` reads that table for `sitesFor` and, for `step`, runs the compiled placeholder-filled master program in the BCH-2026 machine twice — once with the site's witness unfilled, once after the fill — reporting the site as filled only when the program strictly advanced (it accepted, or stopped further along its own `ip`). A fill that does not move the program is reported as nothing, which the driver refuses as a stall; a test asserts exactly that. Tests drive the real path: source through `compileStringMulti`, the deployment slots filled, the host's runs over the compiled programs, and the derivation's own result asserted (the caller stops at its call site with the call record unfilled, the callee completes first, then the caller's two segment closes). The two gaps are stated in the module rather than hidden: the step cannot *discover* the site from the VM alone (the compiled head publishes no per-site program offset, so the driver names the site and the two runs prove the fill is what moved it), and the draft transaction's geometry is still supplied by the caller of the host because the composer's layout and assembly are not wired to it yet. |
| 2026-09-26 | 2174295ca | per-call | program density, and the covered-master evidence | 114 + 212 + 274 | Two measurements, one question closed. The plan's open point — whether the shipped validator program fits the published operation-cost density — is answered by a committed test that evaluates the reference composition's validator input at the real 800 cost per byte: the input accepts, with 4,757 bytes of unlocking plus locking against a 3,805,600 budget (program 4,639 bytes). The suite's own comment claimed the opposite (that the reference composition was already at the density before any program ran), and it is corrected. The comment beside it now says the relaxed profile is there so a case decides a rule and not a budget. Beside that, the covered-master rule gains the evidence it was missing: the existing tests refused a covered master naming the absent sentinel, and a new case refuses the same master when it names a *real* input that is not this validator — the program refuses with `V3_MASTER_NOT_POINTING_HERE` and the independent derivation agrees. With the `emitCompleteness` call removed as a control the new case fails, so it drives the shipped program. The rule itself landed earlier (`fe317b366`, `a02658692`); what is recorded here is the measurement and the missing hostile case. |
| 2026-09-26 | a67217f5a | per-call | harness, unchanged | 114 + 212 + 276, twice | The marketplace harness still runs the legacy kernel path and was not run for this goal, so its count is not evidence for anything landed here; the plan's Non-goals leave it on that path until it is pointed at the composition convention (section 0.3, the first unchecked item at this goal's start). What is measured instead is the focused suites per package — 114, 213 and 276 by the tip of this goal's range, identical on two runs — and the program's own cost at the published density. One boundary is pinned with them: a real compile cannot yet produce an entry that calls twice, so the table's multi-call shape is exercised through the derivation alone. |
| 2026-09-26 | 63218466d | per-call | the return check | 114 + 223 + 283 | An entry that returns a value is admitted, and it settles that value against the frame's `retval`. The head parks the field as a tracked slot whenever any entry of the master returns; each entry body compares the blob its own `return` built against it, and a void entry requires the field to have recorded nothing. One scalar value is admitted; several values, structs, arrays, mappings, tuples, function pointers and token containers are refused by name with the reason. A stateful read that returns what it read and a stateful write that returns what it wrote are both machine-verified, each refused when the frame records another value — the write case carries the record's own two commitments, so the same frame settles both the value and the write. The direct convention keeps its return-event output, and the return-event operand is stripped only for a composed master. Enabling: `STATIC` calls become the next reachable item, since a view method now compiles; they are still refused by name ("a callee cannot yet run a static frame"). |
| 2026-09-26 | 30aae727e | per-call | the composer's draft | 114 + 223 + 283 | The derivation host no longer takes the draft transaction's geometry from its caller. A plan plus the compiled artifacts is enough: the composer lays out which input each master runs at, builds the block each execution starts from with every call left unresolved, and re-encodes a run's unlocking bytecode from the block it currently holds, so the step that fills a callee's index is what makes the compiled caller accept. The new draft module is driven by the real host in its own tests: the real caller stops at its call site and accepts only after the fill, the callee completes first, and the derived unlocking bytecode converges on what assembly produced for the same plan. One test places the validator and the callee where the plan chose rather than where a hand-built draft would, so the host cannot go back to a caller's geometry. Seams still stated rather than hidden: a run may still be supplied by hand to the low-level host, the plan must name its masters and supply each input's source output, only a call's callee reference is written as a witness (segment closes are no-ops and no read sites are published), and the assembled outputs are the participants' source outputs recreated in place rather than a broadcastable transaction. |
| 2026-09-26 | baa158461 | per-call | the returning write | 114 + 225 + 283 | The return check's read path was verified and its write path was not. An entry that writes its record and returns the value it wrote has to settle two things from one frame: the record's two commitments, and the value the frame records. Both are asserted against the BCH-2026 machine, and the same spend is refused when the frame records the value the entry *read* rather than the one it wrote, so the comparison is against what the code computed rather than against whatever the frame held. |
| 2026-09-26 | 1f43d4251 | per-call | read-only frames | 114 + 232 + 283 | A read now compiles where it used to be refused. A `.staticcall`, and a plain read of a `view` or `pure` method, records the static frame kind and the master head has an arm for it, so a caller reads another master without pretending the read is a message call; a caller that self-settles its records keeps settling them when it reads, because a read-only callee runs on its own records. A delegatecall is still refused by name — a delegate frame runs on its caller's records, and the head's context check does not recognise such a caller — as is a read whose target is only known at run time. Driving the machine: the read is accepted at the caller, the callee and the validator both ways it can be written; a record that names a message call is refused by the caller's own kind check; a static frame that writes its record is refused by the validator's static-frame rule; and the self-settlement change the work needed is control-verified by reverting it and watching a stateful read's refusal disappear. Enabling them: the two composition facts this round had already landed — a site that folds its argument digest from run-time values, and a frame that records what it returned — now compose with the read: a read whose argument is the transaction's own input count is accepted at all three inputs, refused when the call data carries another value and refused when the callee records another return. |
| 2026-09-27 | b66358ee1 | per-call | call shapes | 114 + 256 + 283 | Two call shapes real contracts need were refused by name, and both now compile. A target that is only known when the code runs: the site takes the expected target from the value the caller's own code computed — the mechanism a run-time argument digest already uses — and compares the record's `target` field against those bytes, so a caller can call an address it read from its own state, a parameter or a local. A target whose category must match the callee's (the transaction's own sender) and a target the caller does not hold as one value are still refused by name. An entry that calls twice: the composed body no longer expects the direct path's hidden call-selector operand, which only the direct path's own call verification reads, so an entry can make two calls and each site reads its own record. The tests vary each record in turn — a wrong target on either, the second repeating the first, the two swapped, a foreign selector digest, and a callee reference naming the caller — and the caller refuses each. Measured against the four shapes the marketplace needs, this closes the first and takes the first step on the second; delegatecall and mapping records are still refused, and a mapping write is refused for the same reason a two-call entry was (a hidden operand the composed body was not taking). |
| 2026-09-27 | 6dc8d41de | per-call | per-entry call descriptors | 114 + 263 + 283 | A contract whose entries make different calls was refused because the descriptors were derived once for the whole contract and indexed per function: entry b's site resolved to entry a's descriptor, and the published stop-site table named the first entry's callees for every entry. The descriptors are now derived and published per entry, the compiler carries them keyed by entry, and each entry's body resolves its sites against its own list — so two entry points calling different methods at different targets each compile, and each is accepted at its own caller, its callees and the validator and refused when its own record is mutated. Entries that make different *numbers* of calls are still refused by name, because the head walks one count; making the walk count-driven would also mean rewriting the self-settlement walk's call loop, which is the next step rather than this one. A latent corruption surfaced while exercising this and is fixed: the per-call call-site scripts were emitted as flat arrays of numbers, so the shared-span outliner could cut inside a data push and a multi-entry body invoked a malformed program; they are emitted as a real script now, which keeps every push whole. The direct convention's identity tests stay green. |
| 2026-09-27 | 50ceb957c | per-call | focused suites | 114 + 263 + 284 | The composer's per-master VM runs reuse a verdict instead of re-running, so a derivation step costs one program run rather than three. The three focused suites are green at this commit: 114 in 5 files (`@solidcash/utils`), 263 in 32 (`solidc`), 284 in 27 (`solidcash`). The harness is still on the legacy path here. |
| 2026-09-27 | 7754374ac | per-call | composed spend and record settlement | 114 + 263 + 288 | A plan can now state the output an input recreates, which is what a record an execution wrote needs: that output carries the commitment the code computed, which no input describes, while a master and a validator keep the default of being recreated as they were. With that, a stateful composition settles through the shipped path end to end in one test: the source through the shipped compiler with the per-call option, both programs through `deployMaster`, the composer laying the composition out and assembling it, the shipped derivation filling the call site, and the BCH-2026 machine accepting the master's own input with its record declared once per segment at the third index, away from the master that reads it; the same composition whose segments declare no record is refused, by the body's own read first and by the derivation as a stalled step. A composed spend is driven the same way and accepted on every contract input, twice on the same bytes, with two controls refused: a callee index naming an input the call did not reach, and a master not recreated in place. |
| 2026-09-27 | e7409adca | per-call | harness pointed | n/a (the compile refuses) | The harness now selects the composition convention: `composition` is a first-class project-config key (`packages/testing/src/config.ts`, `builtin-tasks.ts`) passed through only when set, and the root `solidcash.config.ts` the D2 harness loads sets it, as does the example project it mirrors. The upstream test and the application contract sources are untouched. The marketplace compile then fails closed on its first imported Solidity root: `PER_CALL_CODEGEN_UNAVAILABLE: the per-call composition convention does not support this contract: imported definitions are emitted before the master head, so imports are not supported`. No fixture title runs, so the ladder stands at "fixture: blocked at compile" and I3/M1/M2 are not reached. |
| 2026-09-27 | a60f433fc | per-call | import admission | 114 + 266 + 334 | The admission rule refused every unit with imports; it now refuses only what an import *emits*. A declaration-only import leaves the compiled program byte-identical, which two cases assert (same bytes, same published slots) before the filled master is spent in the machine and refused for a mismatched frame; an import whose library functions become definitions is still refused by name. The marketplace compile then gets one wall further and stops at the first root's constructor (`a constructor body makes the contract dispatch by selector, which the master head cannot precede`), which every marketplace root has — so the ladder is still "blocked at compile", now at the constructor rather than at the import. |
| 2026-09-27 | 35bdfe72f | per-call | hostile and shapes suites | 114 + 266 + 334 | Two focused directories land, both driving the shipped path and the machine: a hostile suite whose every case is a spend the machine must refuse beside the faithful spend it mutates (loose funds at a master's lock, a master not recreated in place, a covered master presenting an address its category does not derive, a validator UTXO that is not the mutable NFT its script pins, a call record naming the wrong input or carrying another argument digest, an event output the body did not compute, a declared record the transaction does not spend, a state UTXO no segment declares), and a shapes suite where the compositions the same scripts must serve are laid out and derived callee-first and settled in the machine, with the refused shapes asserted by the reason the code gives (entries of one contract making different numbers of external calls; a user entering a multi-entry master; a two-master contract whose validator has nothing to settle). |
| 2026-09-27 | bf4a47915 | per-call | constructor bodies | 114 + 271 + 335 | A contract with a constructor body now compiles as a per-call master. The constructor is one more selector-dispatched body behind the same head, admitted exactly when it asks the head for nothing the head fixes for the entries (no external call, no event, no send, no hidden side-car operand); each refusal names what the body would need. The call data's selector is kept for the dispatcher whenever the master dispatches more than one body. The tests chain two machine spends — the constructor's frame writes the commitment the entry's frame reads, so the value the entry requires is provably the value the constructor computed — and refuse a mutated argument and a record carrying another value. The marketplace compile advances past its constructor and stops on the next shape: a constructor that writes a mapping carries a batch-slot operand the head does not supply, refused by name. |
| 2026-09-27 | 0af283aa7 | per-call | the witness-block boundary | 114 + 271 + 335 | The emitted validator program already parses each covered master's first push and requires the block codec to consume it exactly (landed in `e1ca66300` and successors), so the assignment's check needed no program edit. What was missing was a machine case for the boundary itself: a covered master's block with a trailing byte, and one truncated by a byte, each beside the faithful composition the program and the derivation accept. Both corruptions are rejected by the derivation as `V2_MASTER_WITNESS_BLOCK_MALFORMED` and refused by the machine. Deleting the program's size check makes the machine accept the trailing byte, so the case drives the shipped check. |
| 2026-09-27 | (no code) | per-call | the mapping wall is measured | 114 + 271 + 335 (unchanged) | The wall the marketplace compile stops on is a body that writes a mapping, and the operand it carries (`__internal__vmapBatchSlot_<n>`) is a run-time sorted-list coordinate the direct convention's SDK supplies from its batch plan (`StatefulContract.ts:10046,10301,10353`). The per-call path has no batch planner, so the refusal stands rather than being relaxed: the emitted batch settlement would read that operand by stack depth and pick a frame slot. Landing it needs three things in order — a per-call settlement for sorted writes that authenticates the entry input and output from the frame's declared records instead of SDK operands (`GenerateTargetTraversal.ts:23455`, `:24323`), a head settlement that chains more than one record per segment (`frame-tail.ts:494` refuses two today, and only the first record's indices are parked), and a mapping plan in the per-call composer. Measured: no other refusal in the two focused suites changes, and the compile's first error is byte-identical. |
| 2026-09-27 | (no code) | per-call | the multi-record settlement is designed | 114 + 271 + 335 (unchanged) | The mapping path needs three pieces, and the first is analysed here so the next round implements it against a plan rather than a guess. **Multi-record chaining**: a chain's identity is the record's index (a record is kept in place, created at an index or deleted at one, so one index names one chain for a whole execution). Rather than a register per record — their number is settlement's business, not the entry's — the walk sweeps one index at a time over the whole block, tracking three scalars per sweep (`seenIn`, `seenOut`, `lastView`); the pass count is a run-time value and the loop body is emitted once, so nothing is unrolled. The layout that makes the depths tractable is `[block, count, lastView, seenOut, seenIn, segments]` on the main stack with the index and each declaration's four fields parked above it on the alt stack, restored by `OP_ROLL` (a fixed group rotates by one for `m-1` rolls, which is how the block is put back on top after a scalar update). **Sorted-write coordinates**: the emitted batch settlement reads `__internal__vmapBatchSlot_/Proof_/Next_/PredOut_` — the slot is recomputable in script (`emitSortedKeyHash`), while `proof` and `predOut` are the physical input and output indices a segment's declaration already carries, so the per-call emission takes them from the declaration matched to the target. **Composer plan**: the record lists each segment must declare, derived from the node encodings. All three are refused until proven, so the compile's first error stays byte-identical. |
| 2026-09-27 | bb5ce6f53 | per-call | the mapping plan | 114 + 271 + 343 | The composer can derive what a mapping write declares: a sorted list of node UTXOs whose commitment is slot, next key and value tail, where an insert rewrites the predecessor it links to and creates the node, an update rewrites the node in place and a delete relinks the predecessor. `planMappingWrite` reads the inventory of commitments the state UTXOs hold and returns the nodes to write; `layOutMappingWrites` turns them into the record declarations the segments carry — a spent node naming the input it is read at and the output it recreates at, a created node with no input index, a deleted target with no output index. Every expected commitment in its tests comes from the shipped sorted-list encoders rather than hard-coded hex, and the refusals name a missing predecessor and a placement with no index for a node it must spend or write. |
| 2026-09-27 | c44994de8 | per-call | the multi-record settlement | 114 + 277 + 343 | A segment can now settle every record it declares, which is what a mapping write needs: an insert declares the predecessor it relinks and the node it creates. The chain's identity is the record's index, so the walk sweeps one index at a time over the block carrying three values and no table, and the pass count is a run-time value the body need not be unrolled for. Every rule the single-record walk established is preserved (the spent commitment starts the chain, each declaration carries on, the last is what the transaction writes, the value floor, the census with its validator exception), and a chain may now also begin at an output — a record created by one declaration and read back by a later one chains through the same registers. The tests drive the emitted walk over real transactions: two records chained across two segments, two in one segment each chaining independently, a kept record beside a created one, three declarations of one record, a deletion beside a chain that carries on, and each control refused. Two bugs found in the way are worth recording: `OP_UNTIL` exits when its condition is *true*, so all three loops were initially inverted, and `OP_BEGIN` is a do-while, so a segment declaring no record ran its declaration body once. |
## Deviations
- The category reversal is measured against libauth itself: `OP_UTXOTOKENCATEGORY` pushes `token.category.slice().reverse()` (`bch-2023-tokens.js:213`), and libauth stores the category in display order. So a pin, a reserved category slot and `addrV` are built in the chain's order, and a token is handed to the machine in display order. The master side was affected too: `deployMaster` filled the slot as given and the emitted prologue compared it with the reversed answer, so every real deployment would fail its own category check. The master tests could not see it: all of them use a category of one repeated byte, which reads the same reversed, and one fixture was even chosen around an earlier bug (`fill(0x61)`, an inert `OP_NOP`).
- The whole fix was implemented and verified in one working tree, and reverted rather than landed: the rule in one place (`chainCategory`, used by the validator redeem/address helpers, the emitted pins and the deployment fill), the two pin defects, and a new seeded-category suite (a compiled master spent with the real validator program and a real transcript) that fails before the fix and passes after. The SDK suite passed 228/228 with it, the validator program itself included. What blocked the landing is the legacy master fixtures: they present a stand-in program and a filler transcript, so they need the same real program and transcript, and none of them carries a seeded category. That conversion is the next attempt's first job, and the new suite is saved for it.
- Measured, twice: the machine answers `OP_UTXOTOKENCATEGORY` with the token's category reversed relative to what it is handed, the same reversal the state path applies (`packages/utils/src/state.ts:135`). So a pin and a reserved category slot are built in the chain's order and a token handed to the machine stays in the display order. The master tests cannot see this — their categories are constant-filled, hence symmetric under the reversal — and the validator fixture, whose categories are not, is where it surfaced.
- With that convention applied everywhere, the pinned-pin fixes (the recognition reading the pushed pin, the program comparing its own pin with the token its input holds) still do not pass the compiled-caller suite, so a further check on the head's path is wrong. The next diagnostic has to instrument the caller's own evaluation and read the master program out of the input's unlocking bytecode, because the composition the test builds carries no field for it.
- The per-call tests mix the two byte orders a category id has. The machine's token category and its `OP_UTXOTOKENCATEGORY` answer with the reverse of the id the compiler and the SDK exchange — the reversal the state path already applies (`packages/utils/src/state.ts`, `StatefulContract.ts:5305`) — and the fixture and master tests hand the machine the display order. That is why the pushed pin looked broken: the machine's answer for a fixture token equals the model's category reversed, byte for byte. Every test that fills the reserved category slot or builds a machine token has to speak the chain's order, and then the pushed-pin fixes can be verified; until then the two defects stay unshipped.
- The recognition fix for the pushed pin was written, verified in isolation (a validator presented as `push(pin) || program` is accepted, and one whose UTXO carries no token is refused with a failing pin comparison), and reverted with the rest: the fixture-based master suite still refuses the caller with an `OP_VERIFY` even though that fixture's redeem begins with the pushed pin, its program hash matches the master's reserved slot and its validator input holds a mutable NFT of the contract's category — the same three facts the isolated case uses. So the next look belongs in the head's own composition of the recognition with the tail and frame checks, not in the recognition script.
- The pin in front of the validator program is pushed, but the master's recognition still splits the redeem script at 33 bytes, the unpushed layout, and the program itself never compares its pin with the token its own input holds. Both are real defects and both fail closed; a fix was written (one shared constant for the pushed length, the program comparing its pin with `OP_UTXOTOKENCATEGORY`, and the recognition reading the pushed form) and not shipped, because the comparison it adds fails against the validator suite's own fixture: the machine's `OP_UTXOTOKENCATEGORY` for the input the fixture spends returns a 33-byte value that is neither the model's category for that input (`079b2af8…`) nor the pin the fixture pushed, although the model's inputs are index-ordered and that input's token is a mutable NFT of the contract's category. That has to be understood before the comparison can be trusted, and it may mean the validator suite is spending a different input than it believes.
- The tests that build a validator by hand still assemble the unpushed-pin redeem, so nothing currently spends a compiled master together with the real program: the master suites use a stand-in validator and the validator suite uses the fixture. One test that spends a compiled master beside the real program is the missing link.

- The validator program exists and enforces V1, V9 and the transcript's header and root indices (magic, version, a
  nonzero root count, every root index in range). V2's master-witness and settle-input parsing, V3-V8, V10 and V11 are
  still pure checks with hostile tests, a reference model and a differential harness, and no VM test outside the
  validator suite runs the program yet: the master-side tests still use a small stand-in whose hash the master
  recognises.
- The address derivation pushes the category pin in front of the program: a bare pin is 32 arbitrary bytes and the
  machine executes them as opcodes, so `addrV(cat)` hashes `push(pin(cat)) || V_TEMPLATE`. Every derived address
  moved with the fix, and the identity vectors were regenerated from libauth's own encoders.
- The published operation-cost density (800 per byte) is exhausted by the reference composition before any program
  runs, so the program cannot fit inside it: the validator suite evaluates under the relaxed cost profile, and either
  a smaller program or unlocking padding is required on a real chain (spec section 12).
- The composer executes no scripts: program execution is an injected step function, so derivation, assembly, layout and refusals are exercised while evaluation is not.
- The checklist has no item for the selector dispatch, which every multi-entry contract needs; it was implemented as a prerequisite rather than as a listed unit of work.
- A call's checks are emitted at the call site: the site's own code walks its witness block to the record it names and binds that record's kind, target, calleeRef and argument digest to the source's values, so the digest the code compares against is computed from the code's own operands rather than from the callee's bytes. What is still positional is which record a site addresses: a site's index is fixed by the source, so conditionals and loops over calls remain refused.
- An admitted call takes only compile-time argument values (a literal number, boolean, string or byte string): the caller folds them to a digest at compile time, so a runtime-valued argument is refused by name rather than bound. An admitted call targets an address the source bakes in and is neither conditional nor repeated: the site's code now walks to its own record by position, and a site's position is fixed by the source, so an entry still makes the calls it always makes. A call whose result the caller uses now compiles, and the body uses the record's result.
- Every entry of a calling master must make the same calls, because one head checks one call set.
- A standalone stateful master keeps a prepended pooled-constants prefix ahead of the head; it is stack-neutral, but the head is not literally the script's first bytes for that shape.
- A read-only call site is refused rather than recorded: the emitted kind branch has no static arm.
- A single-entry callee does not check the selector it was entered with; the selector is the caller's to check against the callee's own data.
- Dropping the last push to find a callee's redeem script scans forward by declared length, so its cost grows with the number of pushes before that script. Bounded by the unlocking-bytecode limit, and not measured at scale.
- The record count of each segment is walked rather than required to a compile-time expectation, because which records a segment touches is settlement's business.
- Nothing chains the segment views on chain: the section's structure is checked and the record entries' shapes are checked, but the records a segment computed are not compared with the views it declared.
- No compiled contract produces a send yet: a transfer is refused by name because the recipient lock is a runtime value.
- Event outputs must be strictly increasing, which is stronger than the spec's pairwise-distinct requirement.
- Conditional emits are admitted by the tail shape, which fixes the count, but have no VM case.
- The immutable-output pin's per-call arm is VM-proven for single-entry and dispatched masters, not for a stateful per-call contract, because the records stream is unfinished.
- Records view mode is partial: a standalone master settles a single data-NFT record against its segment views on chain, but the reads still come through the direct covenant at the layout offset the settlement then pins, and a segment declaring two or more records is refused fail-closed until the mapping-node work.
- The cross-segment chain is not emitted: a self-settling master is required to make no external call, so it has exactly one segment and the clause is vacuous for it. That requirement is stronger than the spec's, which lets a contract settle its own records whenever it has one master that made no `DELEGATE` or `INTERNAL` call — such a master may make ordinary calls and then has two or more segments whose chain is its own business. Compiling calls where they happen (now landed) is what unblocks the chain; the validator is what a contract entered more than once needs.
- An attempt at the census exemption got the stack accounting right and the refusal right, and stopped there: the emitted arm still refuses a hand-built validator input, so the failure is inside the recognition's own expectations about a validator's unlocking bytecode (what precedes the redeem script and what the reader accepts there), not in the census. Taking the reserved hash off the alternate stack into the settlement stack and keeping the strict census rule leaves every existing settlement test passing, so that part is sound; the accept case needs the validator presentation built the way the recognition reads it.
- Admitting a validator of the contract's own category into the settlement census needs the validator program's hash at the census point, and the head consumes its reserved slot in the need test. Pushing the slot a second time does not work: a descriptor publishes one offset per slot, so the second push is never filled. The slot has to be kept for the whole head, which is a change to the head's emission order and to the settlement script's use of the alternate stack.
- The standalone settlement census refuses every mutable token of the contract other than the record it declares, so a self-settling master of X in a transaction that also spends a validator of X's own category — which the spec's S2 allows — is refused. The validator's recreated token has to be admitted; latent while a self-settling master can still make no external call.
- A listed send carries no paying record on the wire, so the value floor is emitted only for an entry that lists no send. The spec was reverted to the wire form rather than the codec version-bumped: v1 pays a send from the contract's state record, and the 66 make no BCH send.
- The harness is not pointed at the composition path, and the size budget stays in Phase R after M2 as decided.
- The cross-segment chain is emitted: a master walks every segment of its execution in order, so the first declaration
  begins at the commitment the transaction spends, each later one carries on from the one before it, and the last ends
  at the commitment the transaction writes, and the census runs once over the whole chain. The chain's registers park
  on the alternate stack between segments. Because the settlement is emitted in the validator arm too, behind a count
  of the contract's masters, a master that makes ordinary calls now settles its own records whenever it is its
  category's only master in the transaction, which the spec's S clause allows and which a single-master callee needs.
  One chain per master: a segment declaring several records, a later segment declaring a record the chain does not
  name, and a segment whose declaration does not chain are refused fail-closed rather than settled partly.
- A compiled body still reads its state as `OP_INPUTINDEX + offset`, so in a composed transaction the record has to sit
  immediately after its master; reading it out of the segment views instead is the remaining gap between a master's
  declaration and the state its body computed. A body whose record sits elsewhere is refused, not silently misread.
- The settlement's own tests are 13 cases that drive the emitted walk on its own over real witness blocks and
  transactions (chained, unchained, empty segments, created and deleted records, an undeclared state UTXO, a value
  loss, a block with a call record) and 7 that drive a compiled stateful master whose execution is split at a call.
- A chain whose first declaration creates its record — the record is not among the transaction's inputs — is refused
  fail-closed: the settlement reads the record's index in the index space inputs and outputs share, so the value floor
  and the census of the first declaration need the same treatment as the chain itself before a created record can be
  read back in a later segment. The plan's shapes create records (a mapping entry written and then used) so this is
  the next thing the chain needs.
- A stateful per-call entry that also emits an event is now proven in the machine: the settlement parks its chain
  registers on the alternate stack, and the event walk parks each listed output index there before the settlement
  runs, so the four new cases fix that coexistence (accepted with the declared record, refused for a declaration the
  transaction does not spend, refused for a payload the body did not compute, refused for a record output the
  declaration does not name). The record sits right after its master, which is where a compiled body reads it from.
- The next unit on the critical path is the state read itself: a compiled body reads its state as
  `OP_INPUTINDEX + offset`, so a composed master's record has to sit immediately after it. The two places to change are
  `emitStateFieldReadInline` (one site, `OP_INPUTINDEX <offset> OP_ADD OP_UTXOTOKENCOMMITMENT` becomes the declared
  record's index) and the state-commitment write where the epilogue serialises the pending writes; the head has to
  leave the declared record's input and output indices as tracked slots for the body to read, the way it already
  leaves each listed event's output index.
- The state read and write do not compute their index ad hoc: most sites go through `emitMasterInputIndex` (which
  already returns a frame's authenticated owner instead of the active input for delegate frames), so a per-call
  implementation of that one helper is where the offset stops. The remaining direct uses of the compact offset are the
  single read in `emitStateFieldReadInline` and the output side of the state-commitment write. The head also has to
  leave the declared record's input and output indices as tracked slots first, because they are what those sites read.
- V7's chain rule does not need a depth-first walk in script after all: a settled contract's records chain in the
  order the covered masters appear in `M.masters`, each master's segments in block order, so a linear scan over that
  list is enough. A wrong order breaks the chain and is refused, so the scan is fail-closed rather than assuming the
  transcript is honest. What is missing is the per-master walk itself: today a validator-settled master's own segment
  declarations are unchecked, because only a self-settling master walks them (the same walk, moved into the validator,
  is what the chain needs first). The cross-master linkage is the second half and needs that walk as its base.
- The state index cannot be moved by changing the settlement alone: the head's frame model is built by the checks
  that run before the settlement, so an item the walk leaves on the stack shifts every pick in them. The settlement
  has to be emitted after the frame values are arranged — in the composed path after the two rotations that put
  `origin` and `sender` on top, and in both arms of the need test with the same item count, because the frame's shape
  must not depend on which arm ran. The body then reads the record's offset from its ordinal in the frame, since
  untracked operands sit above the frame at every state site. An attempt that left the offset where the settlement
  currently runs broke the frame for every per-call master, and was reverted; doing it properly starts with that
  emission order.
- The per-call code generator refuses any compiled unit that has imports (`packages/solidc/src/per-call/master/support.ts:138`), and every marketplace root imports, so the harness pointed at the convention cannot compile the project at all: the ladder's first rung is a compile refusal, not a failing fixture. The guard is a fact about emission order — imported definitions are emitted before the master head — so supporting imports means either emitting the head first and the unit-level definitions after it, or proving each prefix stack-neutral the way the standalone stateful master's pooled-constants prefix already is. Until then the 66 path is blocked before any title can run.

- Superseding the import bullet above: the declaration-only import case is now admitted and asserted (`a60f433fc`), so the wall the marketplace compile hits first is a constructor body, which the per-call generator refuses because it makes the contract dispatch by selector ahead of the head. Every marketplace root has one. The wall after that is unmeasured.

- Superseding the constructor bullet above: a constructor body is now admitted when it asks the head for nothing the head fixes for the entries (`bf4a47915`), so the wall the marketplace compile hits first is a body that writes a mapping and carries the sorted-list coordinate `__internal__vmapBatchSlot_<n>`. That operand is a run-time batch coordinate the direct SDK allocates, and the per-call path has no batch planner, so it stays refused by name; the three steps to landing it are recorded in the Log.
- The mapping path is now two-thirds landed and the refusal is the last third: the settlement chains every record a segment declares (`c44994de8`) and the composer plans the records a mapping write declares (`bb5ce6f53`), so what remains is the emitted batch verification reading its coordinates — the full slot, the proof input, the predecessor output index and the successor slot — from the declaration that matches the target rather than from `__internal__vmapBatchSlot_/Proof_/Next_/PredOut_`. The slot is recomputable in script (`emitSortedKeyHash`), and the proof input and predecessor output are the `in`/`out` a declaration already carries, so the match is by the node's slot prefix; the admission rule stays as it is until that verification is emitted and a machine test settles a mapping write through it.
- Recon for the last third: a mapping compiles to the **sorted** node model in both configs (`stateLayout.collections[].sorted` is true for a plain `mapping(address => uint256)` under `forceStateful`, with and without `sortedMappingsAll`), so a node's commitment is `slot(32) || next(32) || valueTail` and **the slot is inside the record the segment declares** — which is what makes the coordinates derivable from the frame rather than from the SDK's batch plan. Measured hidden parameters for a single-target write: `__internal__vmapBatchSlot_0:bytes32`, `__internal__vmapBatchProof_0:bigint`, `__internal__vmapBatchNext_0:bytes32`, `__internal__vmapBatchPredOut_0:bigint`, `__internal__vmapBatchTrailingCount:bigint`. The slot is recomputable in script (`emitSortedKeyHash`), the proof input and predecessor output are the `in`/`out` of the declaration whose node links to the target, the successor is that declaration's old `next`, and the trailing count is the execution's created-record count — so the emission derives the five witnesses from the frame and leaves the existing verification (`GenerateTargetTraversal.ts:23455,23765,23807`) to run unchanged.
| 2026-09-27 | 8e777e7f6 | per-call | a whole batch | 114 + 291 + 343 | A batch that writes several mapping targets now derives every target's operands from the frame: per target the slot is computed in script from that target's key, the proof input and the predecessor's output come from the record group the segment declares for it, the successor is the written node's `next`, and an in-place update takes the direct convention's `-1`; the trailing count is the batch's distinct rewritten predecessors. A batch the direct convention classifies as a dense linear row batch is reclassified for the master, because the rank and row operands describe a witness the master does not take — its frame declares the records instead. The machine accepts an update batch and an insert batch through two relinked predecessors, refuses a target carrying a value the code did not compute and a segment declaring only one target's record, and the admission refuses a non-parameter key by name. The marketplace compile advances again: its first root's constructor keys are `cast:address(lit:0)` and `msg.sender`, neither of which is a bare parameter. |
| 2026-09-27 | 1df4dc7f1 | per-call | the key forms | 114 + 299 + 343 | A batch target's key had to be a bare parameter; two more forms are now derived where the derivation is emitted. `msg.sender` (and `tx.origin`) is the caller the frame records — the head leaves it as a tracked slot, and for a call frame that is the caller contract's own address, which is what the per-call convention means by the sender. A compile-time expression such as `address(0)` is a value the body holds from its entry: it is emitted at the derivation point, handed over as a depth, and removed once the operands are derived, so the depths the body uses afterwards are unchanged. A key that reads state, or that is a local the body has not computed yet, stays refused with the operand that stops it named. The machine accepts both forms and refuses a segment declaring no record and a created node carrying a value the code did not compute. The marketplace compile moves to the next wall: its first root's constructor emits an event, and the master head fixes one tail for every body it runs. |
| 2026-09-27 | 7d145ab87 | per-call | the event region | 114 + 306 + 343 | A body now pins the event count itself, so a constructor that emits shares the head. The head reserves a region sized by the largest emit count over every body the master can run, walks the count the block declares (at most the region), checks each listed output as before, and pads the rest with the no-index sentinel so every slot stays at a compile-time depth the bodies read; the declared count is a tracked slot each body pins to its own emit count, which is the property the fixed count carried — a block must not declare events nobody computed, and a body must not emit one the block does not list. The machine accepts the constructor's spend with the event it emits and refuses a listed output that is not this contract's event covenant, a block declaring no event while the body emits one, and an entry running while the block declares the constructor's event. One interaction was found and fixed on the way: the subroutine-use probe compiles the dispatched bodies without a head, so the region seed falls back to the body's own emit count. |
| 2026-09-27 | a14c8b55b | per-call | the batch derivation | 114 + 284 + 343 | A per-call body that writes a verified mapping now derives the five sorted-batch operands from its own frame instead of expecting them from an SDK: the slot is computed in script from the key, the proof input and the predecessor's output are the `in`/`out` of the declaration whose node links to the target, the successor is that declaration's `next`, and the trailing count is the region the execution creates. The existing verification consumes them unchanged, and the settlement walk's chain and census are relied on rather than re-checked. The admitted shape is one logical target written in place whose key is a bare parameter on the body's stack; the machine accepts an insert and an update, refuses a segment declaring no record and a node carrying a value the code did not compute, and the refusal for anything wider now names the shape ("the constructor writes 2 mapping targets"). The marketplace compile therefore stops one wall further on: its first root's constructor writes two mapping targets in one batch, which is not the derivable shape. |
| 2026-09-27 | 1df7ccb0d | per-call | n/a | 114 + 313 + 343 | A body that reads or writes a dynamic value now addresses its chunk run from the record block its own frame declares instead of an SDK-supplied argument: the master head derives the coordinate as the declared base plus the layout's input width and leaves it where the body reads the operand, and bodies that share a head must agree on the width or the compile refuses by name. The machine accepts a compiled master whose entry appends a byte to a `string` value, with the record block laid away from the master so a coordinate taken from the master's own input would land on the wrong UTXO; disabling the derivation makes that accept case fail, which is what shows the test drives it. What this does *not* claim: the compile's first reported failure is unmoved. Re-refusing dynamic state and rebuilding gives the same reported wall (`EACCToken.sol`/`MockSablierLockup.sol` stop on free functions emitted before the master, which the admission checks first), so the change widens what can compile rather than reordering the marketplace's ladder, and the composer still has no plan that lays a chunk run out. |
| 2026-09-27 | 776829289 | per-call | n/a | 114 + 313 + 377 | Stream G's dedicated directories exist and drive the shipped path. `hostile/` gains a second signed user offered as the origin, a root whose sender is rewritten while a validator covers the edge (refused on the caller's own input while the validator and the callee still accept), and a composition that leaves part of a covered contract unsettled. `toys/` records the four listed shapes as refusals with the rule named: a repeated call to one target collapses to one entry, a sorted-entry lifecycle and a fan-in read a mapping before writing it, and a result fed into a later call stalls the derivation because the composer never fills a call record's result. `edges/` carries one test per spec-section-23 row that the language subset can express, settling what the shipped path settles and refusing the rest by name. A note for the next session: `shapes/harness.ts`'s token helper silently dropped a commitment argument; it takes one now. |
| 2026-09-27 | 8a2c56e99 | per-call | n/a | 114 + 313 + 432 | Gate evidence, as asked. The shipped validator program's own bytes now have a machine-level rejection beside an accepted composition for every rule it emits: its transcript and the witness blocks it reads, which masters and roots a transcript must list, every call edge in both directions, settlement, read-only frames and address binding — 52 new tests, 91 in the directory. The report also fixes what the program does *not* enforce: `V2`, `V5`, `V6` and `V7` are incomplete (the ordering half of `V6` and most of `V7`'s settlement rules ride on record chains), `V6_MASTER_VISITED_TWICE` and `V9_NO_ROOT` are unreachable behind earlier rules, and a handful of derivation reasons have no program counterpart. Separately, the two-contract round trip the worked example uses is refused before composition: a contract entered twice has one entry that calls and one that does not, so the entries disagree about how many call records the head's tail holds (`derivePerCallMasterCallSites`). That single-count rule is the gate's I1 blocker, and the change it needs — per-entry call counts behind one head — is not started. |
| 2026-09-27 | dfa91f535 | per-call | n/a | 114 + 314 + 432 | The gate's I1 blocker is cleared: one head now serves bodies that make different numbers of calls. The walk reads the call count the block declares instead of a compile-time count, checks the declared segment count against it, and parks it; the head hands it to the body as a tracked slot and each body pins it to the number of calls its own source makes, so a block declaring a count no body makes is refused by the body that runs — the same contract the event region already uses. `derivePerCallMasterCallSites` no longer requires the entries to agree, and the master-level shape keeps using the largest count to decide whether a standalone root frame is admissible (a master that makes any call still cannot stand alone). Segments are now walked in a loop, which is why the first segment's record base is still the only one parked. The two-contract round trip of the worked example compiles and deploys for the first time, and a machine case pins the count in both directions (declaring none and declaring one too many are refused, the real count is accepted). What the round trip does *not* get is a verdict: its composition is not assembled, so the plan's I1 is still open. Two walls met on the way, recorded rather than fixed: the marketplace compile still reports free functions as its first failure (the same failure with and without dynamic state, since the admission checks it first), and a contract that emits inside one of two entries is refused with "the contract emits an event that is not attributed to a body". |
| 2026-09-27 | bb9411880 | per-call | n/a | 114 + 314 + 436 | The first machine verdict for the re-entered shape. A master nobody calls was assumed to carry no call data — true for a single-entry program, whose head drops the stray selector — but a program that dispatches over several entries needs the selector to pick one, so the plan can mark a master as dispatching and the composer lets the user's entry carry it. With that, `frames/round-trip-composition.test.ts` builds the worked example's shape from real source: the layout places `A`'s two masters, the validator and `B`'s master, the shipped host fills the root's call record, and the machine accepts the root master's input on the assembled transaction — twice with the same verdict — while a control that presents another contract's address is refused. The plan's I1 is still **not** met: the derivation of `B.g`, the callee that calls on, stalls at its first segment close (the program does not advance), and the test pins that refusal by name so it flips when the wall is gone. Two facts worth carrying: the compiled multi-entry root needed its selector, and a compiled callee that is also a caller is the shape that has not yet been derived end to end. |
| 2026-09-27 | 5c2f5a0be | per-call | n/a | 114 + 314 + 439 | The round trip the specification's worked example uses is derived end to end and settled at every contract input, and the stall recorded last round turned out not to be in the compiled body: the plan handed `B.g` a call record its own source never makes, so the body's count pin refused it inside the head's call walk. With the call in the source the shipped host resumes every published site callee-first (`A.k`, then `B.g`, then `A.f`), the machine accepts all four contract inputs of the assembled transaction twice with one verdict, and the validator's own derivation walks `V1`-`V11` and derives the order the spec states for the shape, `(A.f,0) (B.g,0) (A.k,0) (B.g,1) (A.f,1)`. That is the plan's I1 in everything but its outputs: the round trip carries no records and emits nothing, so an event at a listed output and a value send still have no supplier in the composer, and the I1 box stays unticked. Two facts carried: a contract the transaction settles while spending none of its own state is stated by an empty state-input list, which the codec, the shipped program and the derivation all carry now, and the fabricated-call control is pinned by name so the reason stays visible. `B12`-`B15` were re-run green this round and are ticked, with the scope the earlier note gave them (the program enforces part of `V2`, `V5`, `V6` and `V7`). |
| 2026-09-27 | 128e635fd | per-call | n/a | 114 + 315 + 439 | A master's event region is sized by its own contract's bodies. The unit-wide survey answered for every contract at once, so a sibling contract's emit refused a contract whose own bodies emit nothing — the refusal's own words are about a body that does not account for an emit. A unit holding an emitting contract beside a state-writing one is emitted for both, and the case is pinned so the narrowing is what the test drives: with the unit-wide flag restored, the quiet contract fails with `the contract emits an event that is not attributed to a body`. |
| 2026-09-27 | 3fdbe9879 | per-call | n/a | 114 + 315 + 450 | The plan can state an output no input recreates: a composition's outputs were the inputs' recreations one-for-one, so nothing could state an event NFT, a value send or a created UTXO — the trailing region the design's layout puts between the contract blocks and the fee. The layout now places them one past the last participant and the funders' recreations follow them, the order the worked example lays out (the user's input is 6, its change 7); with none stated the transaction is byte-identical. Two walls are measured and pinned by name rather than worked around. **The I1 blocker is the record write**: a compiled master's state write reconstructs the record's commitment and requires the transaction to carry it at the record's index, so only a record's last write can satisfy it — a caller whose callee writes the same record first refuses with `OP_VERIFY` even though its own declarations and the settlement chain are right, while `decideValidator` accepts the same transaction (V1-V11, order `(0,0) (4,0) (1,0) (4,1) (0,1)`), which is what isolates the refusal to the masters' own write check rather than to the declarations. The spec separates the two rules: the body proves it computed what its own frame declared (W2), and *self-settlement* — a contract with exactly one master and no `DELEGATE` or `INTERNAL` call — ties the last declaration to the real output (S1). The emitted body applies the second rule unconditionally, which is what the earlier `660819e7a` note located in `assertStandalone`. **The second wall**: a master whose witness block carries both a call section and an event list stalls the derivation at its call site (`PER_CALL_DERIVATION_STALLED`, master `a-1` of `A.f()`, site 0), so a trailing event could not be settled end to end yet. |
| 2026-09-27 | 07743924d | per-call | n/a | 114 + 315 + 450 | A contract's statefulness is now taken from the contract rather than the unit. The survey that answers "does this unit emit an event" also answers for every sibling contract in the same compilation, and the hint handed to semantic analysis carried that unit-wide answer, so a contract with no event and no state of its own was stamped as emitting and its tail refused for an emit that is not its own — in two places, the admission check and the code generator. Both are narrowed to the contract under the per-call convention, and the test shows each independently load-bearing: with only the admission narrowed the generator refuses, with only the hint scoped the admission refuses. The case is pinned with a contract that keeps no state, since a stateful one never reached the hint at all. |
| 2026-09-27 | (no code) | per-call | the record-write wall is diagnosed | 114 + 315 + 450 | The I1 blocker is the plan's R1, and it is three coupled gaps in the emitted body rather than one. **Reads:** `emitStateFieldReadInline` addresses the record the frame declared but reads `OP_UTXOTOKENCOMMITMENT` of the *spent* UTXO, and the head parks the declaration's index only — its `viewIn`/`viewOut` payloads are walked and dropped — so a later segment reads the transaction's commitment rather than its own declared `viewIn`. **Pending writes:** `pendingStateWrites` is cleared once per body, never at a call site, so a read after an external call returns the value written before it; the existing cross-segment test passes because its callee never touches the caller's record, which the round trip's callee does. **The close:** the body reconstructs the record's commitment and compares it with the transaction's output at the record's declared index, and one output cannot carry both a callee's write and its caller's later write. The head is already right: `assertSelfSettlementWhenAlone` keys self-settlement on call *kind* and `selfSettlementScript` chains all `callCount + 1` segments, so the work is in the emitted body — walk the block for the segment's declared views, track the segment index at each state site, flush the pending writes at a call, and close each segment against its declaration. The read path is shared by every master, standalone and composed alike, which is why the first attempt was reverted rather than half-landed. |
| 2026-09-27 | 58e8f7ee3 | per-call | n/a | 114 + 320 + 452 | The plan's main risk, R1, lands: a body runs against its own segment's declared record views. A storage read addressed the record its frame declared but read the commitment the transaction spends, and the close compared the reconstructed commitment with the transaction's output at that index, so a record whose last write belongs to another frame could never satisfy the writer before it — which is why the spec's worked shape, whose one record is written by three frames, could not be spent. `declared-view.ts` walks the witness block from the body (the call records and earlier segments are stepped over by their declared widths, which the body knows because it pinned its own call count and the head checked the segment count) and leaves the view of the record at the coordinate it is given, failing rather than falling back to the spent commitment; a source read, and the close, go through it; a value written before an external call is marked as the closed segment's, so a read after the call resolves from the frame's declaration until the body writes the field again. Settlement still ties the declarations to the transaction — the head's self-settlement for a sole master, the validator for a contract with several — so the round trip now derives callee-first, every contract input is accepted, the validator's derivation accepts `V1`-`V11` in the spec's order, and each record's output carries the commitment its last declaration wrote. Four controls stay refused. The tests drive both mechanisms rather than the shapes beside them: disabling the declared read fails seven of the file's ten cases, and dropping the call-site marking fails five. Remaining, recorded in the R1 box: the close is emitted where the end-of-body rebuild runs rather than at each intermediate segment close, a record whose index changes between segments is not followed, and dynamic chunks still resolve against the transaction. **I1 is now one wall short**: its input set is spec 5.1's exactly, and its outputs are 5.2's minus the event at index 6, which the derivation stalls on when a block carries both a call section and an event list. |
| 2026-09-27 | 48c19f6d8 | per-call | n/a | 114 + 320 + 453 | Verification hygiene: the machine factory takes a boolean, not an options object, so the eleven per-call call sites that handed it one were running under *standard* validation with default limits while stating budgets that were silently ignored. Every acceptance in these directories is recorded as running under the relaxed profile; passing the boolean is what makes that true. The focused suites are unchanged and green either way, which is how the mistake survived. |
| 2026-09-27 | 4ee6f81d5 | per-call | n/a | 114 + 320 + 453 | A correction to the row above: the second wall it recorded was not a block carrying two sections. The plan for the emitting round trip handed every entry a made-up selector, and a multi-entry master picks its body from the call data its own input carries, so nothing resolved to a body, each program stopped inside its dispatcher, and the derivation had nothing to advance on. Naming each entry by the selector its program dispatches on moves the wall: the entry's call site fills, the derivation reaches the callee and then the entry the callee calls back into, and that last execution's own program fails an `OP_VERIFY` before its first segment close. The test pins the new site by master and site name. What this says about the head is only that a block with a call section and an event list is not, by itself, what stopped it. |
- The next wall and its shape: a batch with more than one logical target (`_update` writes `_balances[from]` and `_balances[to]`). The derivation extends the same way — for each target's own slot (computed in script from that target's key parameter), find the declaration whose node carries that slot and the declaration whose node links to it, and leave that pair's five operands in the ABI order the verification reads; a target the runtime does not write takes the direct convention's `-2` predecessor-output sentinel (a fixed, unconditional write always writes both, which is what the marketplace's constructors and ERC20 transfers are). The scan is per target over a run-time record count, so it needs the same guarded loop discipline the settlement walk uses, and the derivation still reads one segment, so a body that also makes external calls stays refused until the later segments are covered.

- The next wall is the key form, and both remaining forms are derivable at the derivation's emission point because both are values the frame already holds or the compiler already knows: `msg.sender` is the frame's own `sender` field (the head tracks it as `__internal__frameSender`, and the per-call convention's `msg.sender` *is* the caller's address the frame records), and a compile-time expression such as `address(0)` is a value the body holds from its entry, so it can be pushed where the derivation runs and its depth handed to the builder — a key that references an earlier local cannot, and stays refused.

- The wall after the key forms is the tail a body fixes: an ERC20 constructor emits a transfer event, and the master head's tail shape (`MasterTailShape.segmentRecordCounts`/`eventCount`/`sendCount`, `derivePerCallTailShape`) is derived from the entries, so a constructor that emits refuses. Admitting it means the head's event walk has to hold the constructor's own event list as well as the entries', which is a change in `support.ts` (the shape) and `frame-tail.ts`/`master-head.ts` (the walk) rather than in the batch derivation.
- The tail design, before it is implemented: keep the parked region at a compile-time size (the largest emit count over every body the master can run, the constructor included), make the head's event walk count-driven up to that size with the unused slots holding the no-index sentinel, and have **each body pin the declared count to its own emit count** — the body is what knows how many events it emits, and that check is what the old fixed count carried: a block must not declare events nobody computed, and a body must not emit one the block does not list. The tracked slot depths the bodies read stay fixed, which is why the region is padded rather than sized per body; the refusal stays until the walk and the bodies both hold that contract.

- The wall after the event region is dynamic state. The marketplace's first root stops with `the entry point 'name' carries the hidden parameter '__internal__dynamicChunkInputBase', which the master head does not supply` — the ERC20 stores its `name`/`symbol` as `string` state set from `string` constructor arguments, and a dynamic type is lowered into a band of chunk inputs whose base the direct convention's SDK computes (`packages/solidcash/src/message-bus/*`, `compose-admit.ts`'s dynamic-chunk convergence). The per-call path has no supplier for that band at all, so this is plan item R5 (dynamic `string`/`bytes`/`T[]`: consume every old chunk and create every new one) plus the composer work that declares the chunks as records and the frame work that locates their base — a workstream rather than a shape.
| 2026-09-27 | abe0de286 | per-call | the event census | 114 + 320 + 459 | The two-contract round trip that emits derives, and its transaction is spec 5.2's output set complete: the six participants recreated at 0-5, the event at 6, the user's change at 7. The wall was the body's census over the transaction's own-category immutable NFTs, which admitted only the outputs its own block lists - so the second master of a contract refused the event the first master's frame had listed, and nothing could be derived past it. The census is the contract's, and the spec leaves it to the validator once several masters run that contract (7.2 V7/V8, whose listed set is the union over the frames that run on the contract's records), so the body now runs it only while it is its category's only master in the transaction - the same run-time test the record settlement already uses. The first attempt at that gate embedded the counter as one data push (`this.emit` reads a `Uint8Array` argument as a push, not as opcodes), which produced a 22-byte literal and a wall that looked unrelated to the census; with the loop emitted as opcodes the counter runs. Two findings the round trip now carries. **The gap the waiver opens**: for a shared category nothing emits the union census, so an own-category immutable NFT at an output no frame lists is accepted there - pinned by a test so it flips when V7's census lands. **The validator's density, quantified**: the budget is 800 operation-cost units per byte of the validator input's own unlocking bytecode (3,810,400 on this shape) and the shipped program's walk over the covered masters spends 3,772,568 of it - within 1% - before the entry emits; with the emitting entry's larger program and its event output it reaches 3,810,464, 64 over, and the machine refuses that input by the limit while the validator's own derivation on the same transaction accepts all eleven checks. `GATE_REPORT.md`'s "the validator suite evaluates under the relaxed cost profile" is therefore only half right: the relaxed profile relaxes the standardness flags, and the operation-cost density is a consensus rule that applies there too - the existing validator acceptances fit because the reference composition spends 99% of its budget, not because the budget is relaxed. I1's remaining clause is that budget rather than the shape. No section-4 box is complete this round: C9 bundles the events clause, which this lands at the composition level, with `sends[]`, and the census gap above is part of S2/T41 that V7's census owes. The event lock and the output a plan states are built once now, in `solidc/test/per-call/master/event-input.ts`, and both round trips use it. |
| 2026-09-27 | 48e6b2d2c | per-call | the composer's chunk plan | 114 + 320 + 471 | A dynamic value's run of chunk UTXOs has a supplier on the shipped SDK path. `planChunkRun` derives the data NFT's length header and the chunk commitments of the value the transaction spends and the one the execution writes, all of them through the shipped encoders (`buildPushdataCommitment`, `buildChunkCommitment`, `splitValueIntoChunks`); `layOutChunkRun` places the run at the index the layout gives it, locks every chunk with the value's own collection covenant (`buildEntryNftCovenantScript` over `computeCollectionHash(dynamicChunkSignature(...))`), emits the covenant's own unlocking bytecode naming the writing master, and hands back the record entry each chunk declares. The coordinate is the compiler's rather than the plan's: `frames/chunk-run.test.ts` compiles a `string`-state contract whose entry appends a byte, lays the run out one layout width past the block's data NFTs, derives the composition and the machine accepts the master's own input, with the header and chunk outputs carrying the commitments the plan computed and the segment declaring both records; a run placed one participant further on is refused, and so is a chunk output carrying a commitment or a lock the body did not compute. The planner is checked against the codecs rather than against a copy of their arithmetic: every commitment it produces is decoded back by `decodePushdataValue` and `parseChunkCommitment` (`composer/chunk-plan.test.ts`). What it refuses by name (`PER_CALL_CHUNK_UNPLANNABLE`) is a write that changes the run's width, which creates or deletes chunks — that is what R5 still owes. The marketplace compile is where the last mapping rows left it: `node --max-old-space-size=8192 packages/testing/dist/cli.js compile --jobs 4` reports `unicrow/FakeToken.sol` with "the body writes a mapping at slot 0 as a read/write, and a master derives the sorted-batch operands only for one unconditional write per target", which is the compiler-side admission and not a missing supplier, so this stream does not move the ladder. |