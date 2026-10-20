# Removing the message-bus batch entry point: evaluation and execution plan

Date: 2026-09-25. Evaluates `/tmp/kernel-beta-handoff/HANDOFF.md` and `DESIGN_OPTIONS.md` (Grok session, same day)
against `.worktrees/kernel-beta-candidate` at `ea7a48e27` plus 43 uncommitted files (no source write since
09:07:50 UTC; the Codex turn that wrote them was aborted at 09:07:55).

Goal under evaluation: all 66 titles of the unchanged EffectiveAcceleration `marketplace.test.ts` green on mock
BCH-2026, with no Marketplace/Unicrow source changes and no application-specific logic.

---

## 1. Verdict

Changing the call model is justified. The case the handoff makes for it is not the right one, and its design is
incomplete.

1. **The size argument does not apply to this goal.** Both marketplace harnesses run at 1,000x the real per-input
   byte limit and 1,250x (root) or 12,500x (`examples/`) the real operation-cost budget. The compiled contracts are
   90-200 KB, and the example config itself records an indivisible ~75 KB entry closure. No composition design
   brings those under 10,000 B, and 66/66 does not need it.
2. **The history gives the real reason, and it is stronger.**
   - The best full run is 43/66, reached twice: once on the legacy bus (08-20) and once on the kernel (09-16).
     The longest green streak is 45 titles in a row (legacy, 08-29). The tip is at 0/66.
   - The titles that never stayed green are the fan-in and re-entry class: `takeJob` / `payStartJob`, which reach
     FakeToken from two contracts, and `approveResult` / `refund` / `dispute` / `arbitrate`, where a callee calls
     back into a contract that is still mid-execution. `arbitrate` x4, `refuse arbitration` x2 and the integration
     test have never passed on a real compile.
   - The switch from legacy to kernel, whose recorded gain is route size, re-reached the same ceiling. Five weeks
     have not moved it.
3. **The batch entry point is where that wall sits, but it is not why complexity grows in general.**
   - The row loop runs each call to completion inside one script. Fan-in and re-entry therefore need special
     machinery: the one-repeated-group rule, completion positions, continuation coordinates.
   - Overall growth comes from static footprint planning. For every source shape, the compiler proves in advance
     where each entry, chunk, event and output will be, and the SDK replays that before executing anything. That is
     what the 18-item inventory, the six fences, 20 of the 39 beta proofs and today's refusals are about.
   - The handoff's design keeps that machinery. It would move the treadmill into call slots instead of stopping it.
4. **The mechanism has five gaps as specified**:
   - continuity does not prove program order;
   - re-entry needs one link per segment, not one per call;
   - injection and omission are only stopped by the manifest binding the handoff lists as "surviving";
   - call-slot provisioning is unspecified;
   - it never says how the SDK learns which records a call touches. This is the decisive question.
5. **There is a version worth building, and it is stricter than the handoff's.**
   - Each logical call runs as a layout-free unit that emits explicit claims, with one link per segment between
     external calls.
   - Footprints are discovered by executing that unit, not declared by the compiler.
   - One generic settlement per owner replays the claims in manifest order, and it is the only code that knows
     physical positions.

   That shape handles fan-in and re-entry structurally. With those three properties, removing the batch entry
   point is a real simplification. Without them, it is a relocation.
6. **It is not a shortcut, and it needs a goal change.**
   - It is a multi-week rewrite of the composition layer.
   - Decide it with a spike on fan-in and re-entry, not with the size spike the handoff proposes.
   - Build it beside the kernel, not inside the shared worktree.
   - The current goal text requires `kernel-row-loop` and the `OP_INVOKE` graph boundary, so this needs your
     explicit decision.
7. **Fix the measurement base first.**
   - The numbers in the handoff come from a tree a second writer was editing, and two different harnesses are in
     use.
   - Measured at clean HEAD `ea7a48e27`: 0 of 66. Every title dies in the fixture on one SDK exception about an
     unfilled compiler parameter (`__internal__msgSenderAnchorIdx` on the proxied `initialize`), before any VM check.
   - The fixture's 14 transactions make zero cross-contract calls. At HEAD they fail on SDK/compiler drift. On the
     dirty tree they fail on a covenant check at input 3 of the same deploy. Neither failure is a composition
     problem.

---

## 2. Evidence

### 2.1 The harness is relaxed, so size is off the critical path

| Limit | Real BCH-2026 | Root `solidcash.config.ts` (used by `vitest.marketplace.config.ts`) | `bench/effectiveacceleration/solidcash.config.ts` |
| --- | --- | --- | --- |
| Unlocking bytecode per input | 10,000 B | 10,000,000 B | 10,000,000 B |
| Transaction | 100,000 B relay, 1,000,000 B consensus | 100,000,000 B | 10,000,000 B |
| Op-cost budget per byte | 800 | 1,000,000 | 10,000,000 |
| Stack item / NFT commitment | 10,000 / 128 B | 10,000,000 / 10,000,000 B | 10,000,000 / 1,000,000 B |

- The byte gate that could have enforced real limits takes its thresholds from the provider:
  `finalizedByteGateOptionsForProvider` (`packages/solidcash/src/message-bus/preflight.ts:971-977`).
- Root config comment: the proxy `__forward` inspects "the implementation INPUTBYTECODE (full p2sh32 redeem,
  ~3.8MB for MarketplaceV1)". The 3.8 MB figure is stale; today's artifacts are about 123 KB.
- Examples config comment: "The largest Marketplace entry is still an indivisible ~75KB call closure, so the strict
  splitter cannot produce a 10KB bundle. Keep the compatibility network permissive."
- Compiled artifact bytecode, `.marketplace/artifacts/solidcash/` (compiled 09-24 14:40):

  | Contract | Bytes |
  | --- | --- |
  | MarketplaceV1 | 123,424 |
  | MarketplaceDataV1 | 90,908 |
  | FakeToken (delegate, `legacy-unroll`) | 204,171 |
  | Unicrow | 36,611 |
  | UnicrowDispute | 20,041 |
  | UnicrowArbitrator | 19,114 |
  | UnicrowClaim | 16,335 |

- Composed transactions are huge because every participant block reserves fixed capacity and fills unused slots
  with dummy `P2SH32(OP_TRUE)` funders. Measured from `/tmp` logs:

  | Composition | Inputs (= outputs) | Source |
  | --- | --- | --- |
  | `post job`, 3 participants | 308, of which 124 of the 129 slots in the first block are funders; manifest 6,915 B | Sep 15-17 |
  | `post job`, 3 participants | 339 | Sep 24 |
  | `takeJob`, 5 participants | 512 | derived from the published layout |
  | `approveResult`, 6 participants | 527 | derived from the published layout |

  The vitest config notes "several multi-megabyte covenant transactions". Fixed-capacity blocks are the static
  footprint planning of section 2.3, showing up physically.

The route sizes the handoff leads with (MarketplaceV1 12,102 B; the two-handler fixture 9,873 B) are real, but they
only matter for a real-chain deployability track. The marketplace is far outside that track no matter how calls
are composed. The failing `KernelLoopRoute` assertion checks a toy's whole artifact against a 300-byte safety
margin (`KernelLoopRoute.test.ts:749-767`). It shows the kernel's fixed overhead is about 9.5 KB, which is worth
knowing for small contracts on a real chain. It says nothing about the marketplace.

### 2.2 What the 66 titles actually need

Per-title census, from the upstream test and the byte-identical contract sources:

| Worst shape a title's successful transactions need | Titles |
| --- | --- |
| (a) no cross-contract call at all | 24 |
| (b) each callee hit at most once | **0** |
| (d) repeated calls to one callee, including loop-driven counts | 23 |
| (e) re-entry or fan-in | 19 |

- **The fixture needs no bus.** It is 14 transactions (4 Unicrow-suite deploys, 2 x `deployProxy`,
  `setMarketplaceDataAddress`, FakeToken deploy, 4 token transfers/approves), and none of them calls another
  contract.
- **42 titles need repeated calls to one contract**, because the shared helper's `publishJobPost` calls
  MarketplaceDataV1 3-5 times and FakeToken 3 times. Its `publishJobEvent` calls all append to the same
  `jobEvents[jobId]` entry.
  - That is exactly the shape the kernel refuses today: "If two rows require the same predecessor or
    existing-entry UTXO, construction fails closed: the later row needs a read-your-writes transition"
    (`message-bus-kernel.md:686-688`).
  - The SDK throws the same refusal at `StatefulContract.ts:10639`, `:11352` and `:11668`.
- **11 titles need fan-in**: FakeToken is reached from both MarketplaceV1 and Unicrow (`takeJob` / `payStartJob`).
- **8 titles need re-entry with intermediate state**:
  - `approveResult`: `Unicrow.release` writes `consensus` (`Unicrow.sol:291`), then calls `UnicrowClaim.claim`
    (`:294`). `claim` reads it back through `unicrow.getEscrow` (`UnicrowClaim.sol:137`), writes
    `unicrow.setClaimed` (`:278`), and makes up to 5 `sendEscrowShare` calls, each a FakeToken transfer.
  - `arbitrate`: the same pattern through UnicrowArbitrator, where the `arbitrated=true` flag written at
    `UnicrowArbitrator.sol:217` is read back at `UnicrowClaim.sol:139`.
- **5 titles in class (a) still revert partway through a call sequence** (#21-23, #26, #27). Reproducing
  `revertedWith` needs the composed simulation even though the successful path has no calls.
- **IPFS is not a blocker.** The harness redirects the app's `src/` to a BCH-aware copy that falls back to an
  in-memory store.

### 2.3 Where the complexity comes from

**Growth on `grok/message-bus-kernel-beta`** (TypeScript lines, excluding `.d.ts` and the grammar):

| Date | SDK src | Compiler src | Test files |
| --- | --- | --- | --- |
| 2026-07-15 | 19,050 | 56,464 | 351 |
| 2026-08-15 | 48,157 | 100,673 | 627 |
| 2026-09-01 | 69,681 | 107,655 | 661 |
| 2026-09-20 | 100,119 | 144,975 | 911 |
| HEAD `ea7a48e27` | 137,391 | 149,944 | 1,065 |

The last SDK jump partly comes from splitting StatefulContract into phase files on 09-24.

**What the work was about.** There are 1,692 distinct commit subjects touching source since 2026-08-15, across all
branches. Keyword buckets overlap, so this is only a rough split:

| Theme | Share of subjects |
| --- | --- |
| perf | 24% |
| entries / chunks / journal / resources | 21% |
| rows / graph / dispatch / manifest | 17% |
| derivation / witnesses | 13% |
| identity / sender | 12% |
| coordinates / indices / layout | 11.5% |

The batch-specific share is the smaller one.

**What the admission surface is made of:**
- Inventory items 7-18 are almost all footprint and layout representation: `break`/`continue` masks,
  constructed key vectors, mixed dynamic+collection spans, aggregates, variable-width blocks, and conditional or
  zero-width effects.
- The 39 required beta proofs in `scripts/kernel-beta-manifest.json`:

  | Proofs | What they establish |
  | --- | --- |
  | 20 | Static footprint: constructed keys, allocation lengths, recurrences, loop domains |
  | 6 | Journal and carrier |
  | 6 | Lifecycle |
  | 7 | Route, graph or parity |
- Section 5 of `message-bus-kernel.md` enumerates supported loop spellings one by one.

**What the current marketplace artifacts refuse**, all as `KERNEL_LAYOUT`:
- FakeToken `name`, `symbol`, `decimals` and `totalSupply`.
- `Unicrow.refund`.
- `UnicrowArbitrator.proposeArbitrator` and `approveArbitrator`.
- `MarketplaceDataV1.removeMeceTag`.

FakeToken's delegate falls back to `legacy-unroll`, with 204 KB of bytecode and a 141-parameter route.

**How entangled the bus is.** Bus, kernel or route identifiers appear in 158 of 280 files under
`packages/solidcash/src/stateful/` (81,384 of 102,092 lines), plus the 62-file, 25,032-line `message-bus/`
directory. Removing the batch entry point is surgery across that surface, not deleting a module.

### 2.4 The measurement base is unreliable

- The handoff's numbers were taken while a Codex session was editing the tree.
- The recorded marketplace failure moved from input 117 (`take job`, earlier docs) to input 3 on all 66 titles.
- The newest Codex log (`/tmp/whitelist-current.log`, 08:55) shows the fixture failing after "Marketplace
  deployed", at input 3: an `OP_EQUALVERIFY` on an output token commitment, expected `0e`, actual empty.
  - The "message-bus" label on that error only reflects where the checking function lives.
    `assertFinalizedTransactionCovenants` sits in `message-bus/preflight.ts` but runs on every stateful send
    (`StatefulTransactionBuilder.ts:7151`, `stb-converged-final-transaction.ts:257`).
  - So it is a covenant check failing on a deploy that makes no cross-contract call, not evidence that the bus is
    involved.
- **Two harnesses are in use:**
  - The root `vitest.marketplace.config.ts` runs the upstream file through a symlink.
  - The Codex goal names `bench/effectiveacceleration/test/marketplace.test.ts`. That copy deletes one line
    (upstream `test:1477`, an un-awaited `registerPublicKey`) and uses different consensus overrides.
  - "Unchanged" only strictly holds for the first.
- `kernel-beta-manifest.json` pins `censusCommit` `95fbe8f3c`, not the tip.

**Clean-HEAD baseline, measured for this evaluation.**
- Setup: detached worktree `.worktrees/kernel-baseline-ea7a48e27`, fresh build (124 s), fresh compile of 22
  sources (55 s), root harness.
- Result: **66 of 66 fail in 578 s, all with one SDK exception inside the fixture**:
  `Unsupported SDK-filled delegate parameter '__internal__msgSenderAnchorIdx' on initialize.`
  It fires during `deployProxy(MarketplaceData, ...)`, after "Marketplace deployed" prints.
- The throw is at `packages/solidcash/src/stateful/sc-fix-create-builder-delegate-unlockers.ts:622`, on the direct
  stateful path: `deployProxy` -> `initializerCall.send()` (`upgrades.ts:835`) -> `_createBuilder`. No message-bus
  code is on the stack.
- The committed HEAD is internally inconsistent:
  - the compiler emits `__internal__msgSenderAnchorIdx` on most functions;
  - the committed delegate fill site has no branch for it;
  - `MarketplaceDataV1.initialize` is the first delegate-forwarded call that needs it, because its 8 MECE-tag
    writes are entry accesses.
- The uncommitted Codex WIP adds exactly that branch (its last edit to that file was at 09:06:52). The WIP then
  fails later: a covenant check at input 3 of the same deploy.
- The fixture passed in the Sep 15-21 handoffs, so the Sep 21-25 merges regressed it.
- Neither failure is about composition. `initialize` makes no cross-contract call. The first failure is SDK/compiler
  drift; the second is a covenant check in a single-participant transaction.

### 2.5 What the history says

Full-run results on the unchanged upstream suite, compiled for real. They come from raw vitest logs in `/tmp` and
the Codex/Grok session logs. Most are not in the committed docs.

| Date | Design | Result | Where it stopped |
| --- | --- | --- | --- |
| 07-22/23 | No bus, direct calls only | 11 -> 23/66 | `post job 1` (repeated calls to MarketplaceData) |
| 08-04..11 | Legacy bus + proxy | 11 -> 21/66 | Fixture `deployProxy(MarketplaceData)`, then route index frames |
| 08-14 | Legacy | up to 41/66 | |
| **08-20** | **Legacy** | **43/66** | `take job` x2, `pay start job`, the dispute/arbitrate family |
| **08-29** | **Legacy, bail mode** | **45 in a row** | #46 `post thread message > sanity checks` |
| 09-14..15 | Kernel | 26/66, 21/66 | Input 214, the MarketplaceData route |
| **09-16** | **Kernel** (`14a866091`) | **43/66** | `take job`, dispute/arbitrate, refuse arbitration |
| 09-18/19 | Kernel | 29/66, 40/66 | A nonce-leak cascade; `post job` family at input 197 |
| 09-21/22 | Kernel, single-title runs only | #30-#49 each green | #50 `approve result` sanity; earlier titles regressed |
| 09-25 | Kernel tip | 0/66 | Fixture (section 2.4) |

The "49/66 high-water mark" in `GOAL_KERNEL_LAYOUT_OWNERSHIP_FOLD.md:11` comes from single-title runs on different
commits, and that doc itself says it is "not a contiguous green".

A modified no-proxy variant of the project reached 56/65 on the legacy bus (08-31). That variant is out of bounds
for this goal, but it suggests the proxy layer accounts for several titles.

**What the table shows:**
- The kernel's recorded gain over legacy is route size: 12,102 B vs 40,019 B for MarketplaceV1
  (`RELEASE_NOTES_0.13.1.md:118-124`). This harness does not enforce route size, and the switch re-reached the same
  43/66 ceiling.
- In every run, the unresolved titles are the class-(e) fan-in and re-entry titles from section 2.2.
- `arbitrate` x4, `refuse arbitration` x2 and the integration test have never passed on any real compile.
- Earlier titles keep regressing between runs, e.g. the 09-19 nonce-leak cascade that took down 25 titles, and the
  current fixture break.

---

## 3. The handoff's claims, checked

| Claim | Verdict | Basis |
| --- | --- | --- |
| `KernelLoopRoute`: 1 failed, 9,873 vs 9,700 | Accurate | It is a margin assertion on a toy artifact, not a platform failure and not a marketplace blocker |
| Marketplace 66/66 fail at input 3 | Accurate for that dirty snapshot | Clean HEAD also fails 66/66, but earlier: every title hits an SDK throw in the fixture (`__internal__msgSenderAnchorIdx`, section 2.4). The fixture is the shared cause, as the handoff suspected |
| "The convention spends most of the 10 KB budget on itself, which is why adding admission shapes cannot reach the marketplace" | Does not hold for this goal | section 2.1 |
| MarketplaceV1 route 12,102 B over budget | Irrelevant here | The harness allows 10 MB per input, and the contract is 123 KB |
| "Batch entry point" vs "direct per-function route" diagnostic (`compiler.ts:3697`) | Confirmed | Published as the `message-bus-route-not-synthesized` error (`:15397-15402`) |
| Route is a second executable selector absent from the ABI (`Contract.ts:204-209`) | Confirmed | Repeated in `createAbiUnlocker` (`Contract.ts:754-763`) |
| Handler block layouts are copies of the route's (`compiler.ts:13588`) | Partly | Only route clones copy it (`:13591`); directly dispatched handlers keep their own layout (`:13600-13640`) |
| "Exactly one repeated callee group" (`SymbolTableTraversal.ts:3722`) | Confirmed | Scope is caller-side batching of repeated void calls; an explicit `messageBus: false` throws `MESSAGE_BUS_REQUIRED` (`:3710-3720`) |
| One handler body serves N dispatch sites (`SymbolTableTraversal.ts:15185-15199`) | Confirmed | |
| Bounds: 8 participants, 24 rows, depth 7, `maximumRows` 8 | Partly | 24 is an SDK graph bound; the on-chain manifest allows `0xffff` rows (`artifact.ts:1571`), and `atomic-message-bus-protocol.md:87` is stale. `maximumRows` 8 is a default; resource-shaped handlers get 2 |
| 520-byte batch blob as a structural bound | Partly | See the next three rows |
| -> Where 520 comes from | A hard-coded covenant constant | `require(batchBlob.length <= 520)` (`compiler.ts:11501`), enforced again in the SDK |
| -> Is it consensus? | No | Its rationale (`artifact.ts:1446-1449`) predates the 10,000-byte stack items; the route parser already handles `PUSHDATA2`/`PUSHDATA4` |
| -> Does it bind the marketplace? | Worth checking | `JobEventData` rows are ~209 B each, so two or three of them can exceed it |
| Inlined atomic verifier dominates route size (`compiler.ts:11311`, `:11764`) | Partly | Inlined only for unbound routes. The marketplace routes are bound: a compact binder, with the verifier in a separate ~7.2-7.6 KB program |
| Kernel is the default (`compiler.ts:257`) | Confirmed | Also forced by `?? true` at `:940`. Both marketplace configs additionally set `messageBus: true` for every contract |
| Unicrow: 21/21 ABI functions have a `blockLayout`; route `53434231` has a 90-slot layout; handler selector = ABI selector | Confirmed | Artifact |
| Option A "uses the mechanism that already ships" | Partly | Split facets exist, but v1 facets have no message bus (`large-contract-splitting.md:72`), and the marketplace uses none |
| Ordering authority derived in four places, causing the coordinate bugs | Plausible | Coordinates are 11.5% of commit subjects; the 163/161 and -1 sentinel chases |
| "Order becomes proved, not assumed" by continuity | Wrong | section 4.2 G1 |
| `A->B->C->B->A` is one slot per call | Incomplete | Needs one link per segment (section 4.2 G2) |
| R5 `1 + N` fan-out "becomes expressible" | Only with read-your-writes on one entry across calls | That is the exact refusal the kernel has today (section 2.2) |
| ~46% of the kernel surface deleted, 30-35% net | Unsupported | See the three rows below |
| -> Bucket assignments | Missing | Promised "in HANDOFF.md section 5", not there |
| -> Scope of the count | Too narrow | The 28,688-line surface misses most of the entanglement (section 2.3) |
| -> Which half departs | Not the churning half | The departing half is not where most churn is |
| Option A: facet the route | Solves a problem this goal does not have | Might matter on the real-chain track |
| section 10: events as outputs, move the registry | Out of bounds | Changes application sources, which the goal forbids |
| Deciding spike (size, two sequential scalar handlers, chain-check cost) | Measures the wrong things | It tests the easy case; "each slot < 10,000 B" is unattainable for a 75 KB entry and irrelevant here |
| Four falsification conditions | Reasonable, but misses the decisive one | How a call's footprint becomes known (section 4.2 G5) |
| Kernel route carried by contracts that never compose | True in this project | Both marketplace configs set `messageBus: true` for every contract, whatever the default |

---

## 4. The design on its merits

### 4.1 What is sound

- **One logical call becomes one ordinary script execution**, and each owner's state is settled once. This removes
  a real class of complexity:
  - the in-script interpreter: blob parsing, the row loop, selector dispatch, per-row frames and hidden site
    ordinals (the reason for the `OP_INVOKE` boundary invariant);
  - per-row signature aliasing (most of `KERNEL_TX_SIGNATURE`: a call slot is a real input and can check a
    transaction signature natively);
  - the single repeated-callee-group rule, `maximumRows`, and the 520-byte blob;
  - multi-row argument framing and batched-callsite bookkeeping (inventory #3 and #4).
- **Call units that are pure functions of their witness make SDK derivation compositional.** The SDK can run each
  unit in the VM on its own and cache it. Perf is the largest commit theme, and today's derivation is a
  transaction-wide fixpoint.
- **There is precedent for N = 1 in the tree already, and the handoff does not mention it.** For the proxied
  MarketplaceV1 and MarketplaceDataV1:
  - The proxy owner holds the state and only runs `__forward`.
  - A separate implementation "executor" input runs the route and handlers, reads the owner's pre-state with
    `OP_UTXOTOKENCOMMITMENT`, and asserts its successor outputs (`GenerateTargetTraversal.ts:6436-6492`, owner-side
    pinning at `:20679-20738`).

  Call slots are N executors per owner, with the intermediate states carried by claims.
- **The BCH primitives exist.** A settlement input can:
  - pin a call slot with `OP_UTXOBYTECODE`;
  - read the slot's claim digest as the first push of `OP_INPUTBYTECODE`;
  - authenticate first-touch records with `OP_UTXOTOKENCOMMITMENT`;
  - write successors with the output-introspection opcodes.

  A call slot can bind its own claims through `OP_INPUTINDEX OP_INPUTBYTECODE`.

### 4.2 Gaps in the mechanism as written

- **G1. Continuity does not prove order.** `end(k) == start(k+1)` shows that some sequential order is consistent. It
  does not show that it is the program's order.
  - Two writes of the same value commute and still chain.
  - A read-only link (e.g. `getEscrow`) placed before the write it must observe also chains, because its
    `start == end`.
  - Fix: every link carries its manifest sequence number, and the settlement replays its links in manifest order.
- **G2. Re-entry needs segments.** In `approveResult` and `arbitrate`, the callee reads and writes the caller's
  state while the caller's handler is still running. A call-slot script cannot yield. The outer call's slot has to
  emit one link per segment between external calls, and take a witnessed resume state after each call. With that,
  re-entry is just more links in the same chain. Without it, 8 titles are unexpressible.
- **G3. Injection and omission.** Continuity accepts an extra well-formed link (for example one that credits an
  attacker), and it accepts a dropped link. Each owner's settlement has to bind the exact contiguous set of
  invocations the manifest assigns to it (`buffered-state-and-message-bus-research.md` section 5.3). That is the existing
  verifier problem; it moves, it does not go away.
- **G4. Provisioning.**
  - A self-preserving pool of call slots contends across concurrent transactions and has to be sized for peak
    calls.
  - Just-in-time slots need a chained funding transaction for each composition, and can be griefed if a slot can be
    spent without its owner's settlement.
  - Slots at the owner's own P2SH32 address would make any BCH sent to the contract spendable as a slot, so they
    need their own address, derived from the contract.
  - None of this is hard, but it has to be decided.
- **G5. Where footprints come from.** The handoff is silent on how the SDK knows which records a call slot touches.
  - If that knowledge comes from compile-time per-shape metadata, as it does today, every current fence reappears
    in the call slots.
  - If it comes from executing the slot (run it, read which record is missing at a designated miss site, add the
    record, re-run), admission becomes nearly total and the inventory collapses.
  - This is the decisive design choice, and it is independent of the batch entry point.

### 4.3 What goes, what stays, what is new

- **Goes:**
  - route synthesis and the `SCB1` selector;
  - blob, row loop, dispatch, per-row frames and site ordinals;
  - the `__internal__graph*` route band;
  - per-row signature aliasing;
  - the repeated-group rule;
  - `maximumRows` and the 520-byte cap;
  - inventory #3 and #4;
  - route-local journal carriers.
- **Stays, relocated into the settlement or the manifest:**
  - caller identity (#1) and producer results (#5);
  - the physical load and flush for every resource kind: sorted-entry insert, update and delete with
    predecessors; value chunks; dynamic chunks; token containers;
  - event, BCH and token effect materialization;
  - proxies and identity anchors;
  - deploy and lifecycle;
  - the manifest and verifier.
- **New:**
  - call-slot codegen: handler state access through a witness record journal, with claims out;
  - the settlement: generic replay of links in manifest order, plus load, flush and effects;
  - segment links for re-entry;
  - call-slot provisioning;
  - execution-discovered footprints, if G5 is resolved the right way;
  - a new SDK composer: a segment interpreter over per-slot VM runs, record fetching, and deterministic settlement
    outputs computed from claims.

### 4.4 The same core also fits inside the route

The properties that stop the growth are:
- layout-free handlers over a dynamic record journal with read-your-writes across calls;
- footprints discovered by execution;
- one physical layout owner per participant.

None of these requires removing the batch entry point. The route could keep dispatching rows while handlers look
records up at runtime and the flush does all the physical work.

The framed form is cleaner on three points:
- re-entry is extra links rather than nested dispatch from inside a handler;
- the SDK can compute the settlement's outputs directly from explicit claims, instead of learning them from failing
  comparisons;
- signatures are native.

The in-route form reuses more of what exists: the route, the manifest plumbing and the verifier binding.

For the wall this project is actually stuck on, the framed form fits better. Fan-in and re-entry are just more
links in the owner's chain. In the in-route form they need nested dispatch from inside a running handler, which is
the machinery the kernel has struggled with for five weeks (section 2.5). The spike below should confirm this
before anything is built. Either way, the core is the actual work.

### 4.5 Does it reach 66/66 sooner?

- **Continuing the current path:** on the record, it saturates at about 43 full-run titles, and the fan-in and
  re-entry class has not closed on either bus design.
- **The stricter framed design:** it is aimed at exactly that class, but it is a rewrite of the composition
  layer. My rough estimate is 6-10 weeks of focused work after a successful spike before the ladder is mostly
  green. The spike exists to replace that guess with a measurement.
- **What it changes is the slope.** Today each new title tends to need a new representation. With the stricter
  design, a new title should only need generic record kinds that already exist.
- **Floor:** reach and hold the 43 titles first (Phase 0). That also shows what the new path has to beat.

---

## 5. Execution plan

### Phase 0: stop, freeze, baseline (2-3 days)

1. **One writer per worktree.** Parallel agents work read-only or in their own worktrees. The handoff's
   45-second stability check becomes a precondition for every recorded number.
2. **Preserve the Codex WIP.** Move the 43 files onto a named WIP branch with a temporary commit. Never
   `git stash`: the stash stack is shared. Then decide whether to keep or revert them.
3. **Choose one harness and write it into the goal:**
   - Recommended: the root `vitest.marketplace.config.ts` with the byte-identical upstream test.
   - The un-awaited `registerPublicKey` at upstream `test:1477` should be handled by serializing submissions in the
     harness, the way Hardhat automine does, not by deleting the line.
4. **Repair the fixture regression at a clean commit.** The baseline is done (section 2.4): 0/66 at `ea7a48e27`, all on
   the unfilled `__internal__msgSenderAnchorIdx` for the proxied `initialize`.
   - The WIP already carries the missing fill branch. Land that slice alone on a clean commit, and check that the
     fixture then completes.
   - If the next failure is the input-3 covenant check, debug it as a single-participant deploy. It has no
     cross-contract call.
   - Re-measure and record pass/fail per title, plus the first failing input, opcode and phase for each failure.
5. **Establish the floor.**
   - Keep single-participant transactions on the direct per-function path end to end. The baseline shows the
     proxied `initialize` already takes it; treat any bus involvement in such a transaction as a bug.
   - Target: the fixture plus the 23 titles that passed with no bus at all on 07-23: #1-16, #21-23, #25-27, #29.
   - Then re-measure `14a866091` (43/66 on 09-16) on the same harness. If it reproduces, 43 is the bar any new path
     has to reach before it replaces the kernel.
6. **Freeze admission widening and the route-size gate work on this branch**, unless you put real-chain
   deployability in scope (see Phase R).

### Phase 1: decision spike (time box: 1.5-2 weeks)

**1a. Protocol spike (~3 days).** Hand-written BCH-2026 scripts on the mock VM:
- one settlement input plus N call slots;
- links carrying manifest sequence numbers;
- claim digests bound through the first push of each slot's `OP_INPUTBYTECODE`;
- generic replay in manifest order, with segment links for re-entry.

Requirements:
- The honest transactions are accepted.
- These hostile variants are rejected: permuted links, omitted link, injected link, wrong result, forged caller,
  stale read.
- Record the settlement's op cost at N = 2, 4 and 8.

**1b. Codegen and SDK spike (~1-1.5 weeks).**
- Compile neutral toy contracts (no application names) to call-slot mode, with a dynamic record journal.
- Have the SDK derive each slot by running it in the VM and resolving misses at a designated miss site. No
  transaction-wide fixpoint.

The toys:

| Toy | Shape |
| --- | --- |
| T1 | k appends to one mapping-of-array entry in one transaction (the `publishJobEvent` shape) |
| T2 | Write, external call, callee reads the write, callee writes back, k token transfers, caller emits with the returned values (the `release` / `claim` shape) |
| T3 | Result of call 1 used as an argument of call 2 (the `getArbitratorFee` -> `pay` shape) |
| T4 | T1 behind the SolidCash upgradeable proxy |
| T5 | Sorted-mapping insert, update and delete of one key across three calls |
| T6 | Fan-in: two different contracts call the same callee in one transaction (the `takeJob` shape: A calls `T.approve`, then A -> U -> `T.transferFrom`) |

T2 and T6 are the deciding toys. They are the class that has never stayed green on either bus design.

**Go** if all of these hold:
- All six settle with exact post-state, events and balances.
- The hostile variants are rejected.
- No per-shape admission rule or static footprint recipe was added.
- Derivation is per slot.
- New compiler + SDK code stays within an agreed budget (suggestion: under 10K lines).

**Kill** if any of these happens:
- A toy needs a static per-shape recipe.
- The settlement cannot do sorted-entry insert or delete generically.
- Re-entry forces a cross-slot fixpoint.
- The time box is exceeded by more than 50%.

**If killed:**
- Apply the same core inside the route (section 4.4) and re-spike T1 to T6 there.
- If that fails too, cut the kernel beta on its frozen surface and treat the marketplace as post-beta.

### Phase 2: build beside the kernel (if Go; weeks)

1. **Make it opt-in.** Add a new compile option and SDK composer, e.g. `composition: 'framed'`. The kernel stays
   untouched and stays the default everywhere else until the marketplace passes on the new path.
2. **Build in this order:**
   1. Record kinds with physical load and flush in the settlement: scalar field, sorted entry with predecessor,
      mapping-of-array, value chunk, dynamic chunk, token container.
   2. Call-slot codegen, reusing the existing journal lowering and replacing its static footprint with the dynamic
      journal.
   3. Reuse of the manifest and verifier.
   4. SDK composer v2: segment interpreter, record fetcher, deterministic settlement outputs, slot provisioning.
   5. The solidhat switch.
3. **Climb the marketplace ladder in census order:**
   1. fixture;
   2. the 23 no-bus titles;
   3. `post job 1` (#18);
   4. the remaining class-(d) titles (22). **Milestone: at least 43/66 held on one commit**, which matches the best
      the batch route ever did;
   5. FakeToken fan-in (11);
   6. `approveResult` / `refund` re-entry (#50-52);
   7. `arbitrate` (#59-62, #66).
4. **Rules for each fix:**
   - A neutral regression for every substantive fix.
   - Numbers recorded only on clean commits.
   - One title at a time, with a per-title time budget. When the budget is exceeded, write a reduced reproducer
     instead of widening scope.

### Phase 3: delete (after 66/66 on the new path)

- Remove:
  - route synthesis, the row loop and graph bands;
  - static footprint recipes: permutations, cursors, access programs, constructed-key replay, loop-domain proofs;
  - the layout resolver's per-shape logic.
- Keep only the irreducible refusals: opaque assembly and foreign delegate.
- Retire or re-scope `messageBus`, `messageBusKernel` and `messageBusGraphContext`.
- Replace the 39-proof beta manifest with a proof set for the new composition path.

### Phase R: real-chain deployability (separate track, not on the 66/66 path)

The framed form helps here, because each slot carries only its own handler. But 75 KB entry closures and
90-200 KB contracts still need facet splitting, and multi-megabyte transactions need a different shape. Only take
this on as its own goal, with its own harness at real limits.

---

## 6. Decisions needed from you

1. **The goal text.** It currently requires `artifact.messageBus.convention === 'kernel-row-loop'` and the
   `OP_INVOKE` graph boundary (`HANDOFF_KERNEL_BETA_CURRENT.md`). A framed model needs that requirement lifted,
   or re-scoped to "the kernel stays as-is; a new path is added beside it".
2. **Canonical harness:** the root config with the upstream test, or the `examples/` copy that drops one line?
3. **Real-chain deployability:** is it part of this goal? If not, the route-size gates come off the critical path.
4. **Spike form:** framed, in-route, or both, time-boxed? My recommendation is framed, because fan-in and
   re-entry are the wall (sections 2.5, 4.4).
5. **Codex WIP (43 files):** keep, or revert before the baseline?
6. **Call-slot provisioning for the spike:** a just-in-time funding transaction (simplest on mock) or a
   self-preserving pool?
