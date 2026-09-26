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
- [ ] Point the harness at the per-call path (`composition: 'per-call'`) for the new branch only. This needs C1, so
  it lands with Wave 1.
- [ ] Keep the upstream test byte-identical. Title #32's un-awaited send is handled by SDK serialization (spec
  section 18), not in the test.

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
- [x] B2 V2: parse `M` and every covered master's first-push witness block; reject any encoding the master would not
  accept.
- [x] B3 V3: completeness.
- [x] B4 V4: roots, and the forest rule.
- [x] B5 V5: edges, for each kind:
  - `CALL`, `STATIC`, `CREATE`: sender is the caller's `self`, and `self` is the recorded target;
  - `DELEGATE`: passthrough, and the callee's category matches the target (T37);
  - `INTERNAL`: passthrough, same contract;
  - for all kinds: origin, values (passed through for `DELEGATE` and `INTERNAL`), `retval`, and `argsHash` over the
    callee's argument pushes.
- [x] B6 V6: the derived depth-first order; every master visited exactly once.
- [x] B7 V7: settlement. The input rule, per-record chains across every frame on the contract's records, the census
  (containers, distinct event outputs), and values (spec S4).
- [x] B8 V8: the settles set (two or more masters, or a `DELEGATE` or `INTERNAL` frame on the records).
- [x] B9 V9: owner policy.
- [x] B10 V10: static frames.
- [x] B11 V11: addresses, with `addrV` built from `OP_ACTIVEBYTECODE` (matches the A4 vectors).
- [x] B12 The `ABBA` golden transaction, with stub masters carrying the A7 blocks, is accepted.
- [x] B13 One hostile unit test per V-check.
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
- [ ] C7 W2: calls. Kind and target recorded, `calleeRef != self`, in-script `argsHash` with minimal pushes (A3),
  result from the witness, segment closed at every call.
- [ ] C8 spec R3 call forms:
  - internal calls and `delegatecall` to own code, inline;
  - `this.g()` inline with `msg.sender = self`, replacing the `AstBuilder.ts:7323` behaviour under per-call;
  - a runtime target equal to self as a `CALL`;
  - `STATIC` for `view` and `pure`;
  - `try` must succeed (T22).
- [ ] C9 W3: events at their listed outputs; `sends[]` for P2PKH value sends; a value send to a contract as a `CALL`.
- [ ] C10 Stop-site metadata emitted (A5).
- [x] C11 A code constant slot for `addrX`; stream F fills it at deployment.
- [ ] C12 SafeERC20 low-level calls (OpenZeppelin 5.0.2 and 4.9.3) lowered to typed calls; the `code.length` rule;
  `address(this).balance` constant-folded for value 0 (spec 17; section 23 rows 9-11).
- [ ] C13 `ecrecover` returns address 0 for invalid input (spec 23 row 22).
- [ ] C14 Fix: a public function that reads `msg.sender` and writes state fails `OP_VERIFY` when called internally
  (spec open point 9).

**Stream R: records and settlement, view mode** (spec 20, spec 7.1 checks spec S1-S4, spec 7.3). This is the main
risk. Take the slices in order, each with its own tests.
- [ ] R1 Data NFTs: reads from `viewIn`, and writes compared with `viewOut` at segment close, reusing today's record
  encoders.
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
- [ ] R5 Dynamic `string`, `bytes`, `T[]`: consume every old chunk and create every new one.
- [ ] R6 Mappings inside structs and nested mappings, through today's flattening and composite slots (spec 20).
- [ ] R7 Value pin (the spec's D2 rule) for mapping nodes and chunks, which carry none today (T39).
- Satoshi and token containers: not needed for the 66; deferred.

**Stream E: composer** (spec 5, 6, 10, 18).
- [x] E1 Resumable depth-first derivation from stop sites (A5): no fixpoint; a callee is derived first.
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

---

## Deviations

- Streams C (master frames and calls) and R (records view mode) are not implemented: both are code generation changes inside the compiler's main traversal, which the plan sizes at 5-7 weeks with four coders. No compiled artifact drives any test, so the end-to-end criterion is not met and the gate is a KILL.
- `composition: 'per-call'` refuses with `PER_CALL_CODEGEN_UNAVAILABLE` rather than emitting the convention, because an artifact for the other convention carries a different address and a different unlocking bytecode.
- The validator derivation decides V1-V11 only. The master-side checks, the state rules and `V_TEMPLATE` as a script are outside it, so the differential harness compares two implementations of the decision procedure rather than a script against an independent model.
- The composer executes no scripts: program execution is an injected step function, so derivation, assembly, layout and refusals are exercised while evaluation is not, and the re-entrant composition is not driven end to end.
- Protocol defects found and fixed during integration: the call-record decoder read its fields in the encoder's order; a record created by a frame's first segment was wrongly refused; and the argument pushes wrongly included the redeem-script push.
- Section 20 correction needed: the direct-value case is a type classification rather than a measurement of the canonical encoding, so `sig` and unbounded `bigint` mapping values are stored verbatim and can exceed the 64-byte tail. The 66 do not use either as a mapping value.
- The harness is not pointed at the composition path, and the size budget stays in Phase R after M2 as decided; both need the master code generation behind the convention option.
- The prologue checks exist and are VM-proven as a standalone script builder, but the code generation that emits a master per entry point is not written, so nothing compiles with them yet.
- The composition hook cannot be completed additively: four frame-field emit sites, a synthetic stack parameter, the return check, a per-entry artifact slot and a deployment-time category pin all have to change together, so `per-call` keeps refusing rather than emitting a master that violates its own frame rules.
- The master emission covers one inlined entry point with no external calls and no returns; the selector dispatch, the return check and the frame hash-type check are absent, and state is still read through today's direct covenant because the record view mode is not implemented.
- The checklist has no item for the selector dispatch, which every multi-entry contract needs; it was implemented as a prerequisite rather than as a listed unit of work.
- The caller signature's hash type is not checked, so an `ANYONECANPAY`, `NONE` or `SINGLE` signature would be accepted where spec W1 and threat T20 require `0x41` or `0x61`. Adding the check makes a caller's unlocking bytecode load-bearing, so every VM fixture that gives a caller an empty unlocking bytecode has to carry a signature-shaped one first.
- The composed head path is proven but not reachable from `compileString`: a contract that makes an external call is still refused, because the master must carry `H_V` and the compiler has no deployment-time value for it. A third reserved slot for `H_V`, beside the category and address slots, is what would make it reachable.
- Nothing after the call records is interpreted: segment and record chaining, the event list and the send list are dropped, so `viewIn`/`viewOut` settlement and the rule that nothing follows the last field are unchecked.
- Only zero-argument call sites that return nothing are emittable; a call site with argument pushes or a value needs a general push-count walk.
- The compiler emits root frames only, so a composed transaction needs its callee built from the head builder: admitting the call frame kinds is C4/C5 and would change every standalone contract's script.
- A call is checked, not lowered: admitted calls take no arguments, return nothing, and target an address the source bakes in. A runtime target, arguments, a return value, a value send, delegatecall, or a conditional or repeated call is refused.
- Every entry of a calling master must make the same calls, because one head checks one call set.
- A standalone stateful master keeps a prepended pooled-constants prefix ahead of the head; it is stack-neutral, but the head is not literally the script's first bytes for that shape.
- A read-only call site is refused rather than recorded: the emitted kind branch has no static arm, so recording one produced a callee that refused the call at run time.
- A single-entry callee does not check the selector it was entered with: its head drops the call data it was given, and the selector is the caller's to check against the callee's own data. A caller that records a different selector than it sent is therefore refused by the caller, not by the callee.
- Dropping the last push to find a callee's redeem script scans forward by declared length, so its cost grows with the number of pushes before that script. Bounded by the unlocking-bytecode limit, and not measured at scale.
- A compiled entry that emits an event is admitted and its head checks the event section, but its **body** still builds the direct path's event covenant from the block layout rather than from the per-call witness index, so a compiled event contract is refused when spent. Events are the marketplace's most-used cross-contract path, so this is the next body-level gap.
- The record count of each segment is walked rather than required to a compile-time expectation, because which records a segment touches is settlement's business; a caller that knows the counts can require and unroll them.
- No compiled contract produces a send yet: a transfer is refused by name because the recipient lock is a runtime value, so the send checks are proven at head level only.
- Event outputs must be **strictly increasing**, which is stronger than the spec's pairwise-distinct requirement; a transaction listing events out of increasing output order is refused.
