# Per-call composition versus the message-bus kernel: complexity and speed

Date: 2026-09-25.

**Questions (user):**
- Is the worked-out framed spec still a win over the message bus with the kernel, or will it fail?
- Do compilation and SDK derivation get faster?

**Method:**
- Measurements on `ea7a48e27` (`.worktrees/kernel-baseline-ea7a48e27`).
- The kernel's own performance records (`PERF_FINDINGS.md`, `PERF_HANDOFF_KERNEL_BETA.md`).
- The spec, [`SPEC_FRAMED_TRANSACTION.md`](./SPEC_FRAMED_TRANSACTION.md). The estimates were made on revision 9
  and rechecked on revisions 10 to 12: the review fixes leave them unchanged, except that B14 and B15 add test code.

Per-call sizes are estimates, and are marked as such.

**Corrections after an independent review (2026-09-25):**
- The refusal-code figure was wrong. "40 `KERNEL_*`, 36 `MESSAGE_BUS_*`" counted every identifier with those
  prefixes (journal constants, subroutine ids, tags). The closed catalogs hold 7 and 11 codes (section 2).
- The I2 kill threshold of 6K compiler lines sat below this document's own 6-12K estimate. It is now 12K (section 6).
- Real-chain size has two layers (section 4, item 4). Per input, 10,000 B is consensus, so code splitting is
  required. Per transaction, 100,000 B is relay policy, and one code copy per entry makes the largest titles
  non-standard, though consensus-valid.
- The review reproduced the other measurements. Its SDK counts are higher because it measured a later commit.
- Third review: loading the code instead of carrying it ranks first among the size mitigations (spec 12). It keeps
  one copy per distinct code, not per entry: about 3x fewer copies for `arbitrate`, not the 8x the budget ratio
  suggests (section 4, item 4).

---

## 1. Verdict

- **A win on complexity, with one concentrated risk.**
  - The kernel's cost grows with the shapes it has to plan for. It has static footprint planning, per-shape
    admission, 18 refusal codes fed by dozens of free-form admission reasons, and two full compiles per contract.
    It still stands at 0/66 at HEAD, with a best full run of 43/66; `arbitrate` and the integration test never
    passed.
  - The framed spec has a fixed set of mechanisms (masters, frames, one generic validator, views over today's
    record formats), and none of them depends on the transaction's shape.
  - Its risk sits in one place: compiler "view mode", which reads and writes records through witness views. Scoped
    to the record kinds of spec section 20, and reusing today's encoders, it is bounded. If it tries to carry every
    existing state-access special case across, it repeats the kernel's growth pattern. Section 5 adds kill criteria
    for this.
- **Faster compiles:**
  - about 2x for contracts that make calls: one compile instead of admission plus binder, with no route or verifier
    program;
  - 35% for leaf contracts (measured);
  - and the out-of-memory class disappears.
- **Faster derivation, on one condition.**
  - It uses 2-4x less SDK CPU per composed transaction, if derivation resumes from each stop site; restarting from
    scratch at every site could be slower than today.
  - It builds the re-entry transactions the kernel cannot build at all.
  - Test-suite wall time improves only modestly, because the test harness dominates it.

## 2. What the kernel costs today (measured at `ea7a48e27`)

| Measure | Value |
| --- | --- |
| SDK source | 137,392 lines (19K on 2026-07-15) |
| SDK files that mention the kernel or the message bus | 92,984 lines |
| `message-bus/`; `stateful/` | 62 files, 25,026 lines; 280 files, 101,373 lines |
| Compiler source | 149,944 lines; 3,410 references to the bus or kernel in 37 files |
| Refusal codes | 7 `KERNEL_*` catalog codes (`kernel-admission-catalog.ts`) and 11 `MESSAGE_BUS_*` diagnostics, plus free-form admission reasons that normalize into the 7 (the review counted about 96) |
| Bus tests | 245 files, 66,690 lines |
| Working documents in the kernel worktree | 43 handoffs, goals and inventories |
| Marketplace | 0/66 at HEAD; best full run 43/66; `arbitrate` and integration never green |

**Structure:**
- routes with a row loop;
- graph handlers (39 for MarketplaceV1);
- per-root verifier programs;
- manifests;
- static footprint planning with per-shape admission, which is the growth driver (EVAL 2.3);
- two full compiles per contract.

## 3. What the framed path needs (spec revision 9, unchanged in 10; estimates)

| Component | Content | Reuse | Estimate |
| --- | --- | --- | --- |
| Compiler master mode | Witness block (W0), frames (W1, O1), `calls` with an in-script `argsHash`, segment closes against `viewOut`, self-settlement (S1-S4), census, validator recognizer (N1) | Record encoders and decoders (section 20), events, dispatcher, outlining | 6-12K lines |
| Compiler view mode | Records read from witness views and located by witness indices, instead of block-layout positions | Record formats unchanged | Included above; the main risk |
| `V_TEMPLATE` | Parse `M` and witness blocks; V1-V11 (depth-first order, per-record chains across frames, census, values, `addrV`) | None: new, generic, frozen | 1.5-3K lines, plus its hostile suite |
| Built-in proxy | Fallback plus `DELEGATE`; three-transaction `deployProxy` | Proxy state layout | 0.5-1K lines |
| SDK composer v2 | Resumable derivation, stop sites, witness assembly, layout, pools, `M`, deployment with pools, serialization, snapshots, listeners | Records, signing, providers, VM | 10-20K lines |
| Tests | 26 edge-case tests (spec section 23), T1-T41 hostile tests, toys Y1-Y7, the conformance suite | | Grows with coverage, not with shapes |

- **New code:** about 20-35K lines in total.
- **Retired code:** Phase 3 retires most of the ~93K kernel-related SDK lines and the compiler's bus machinery.
- **Mechanisms:**
  - The kernel has more than a dozen interlocking ones: routes, handlers, verifiers, manifests, participant tables,
    caller vectors, footprints, admission, resource folding, value-chunk lanes, journals, read carriers and
    lifecycle topology.
  - The framed path has four: masters, frames, the validator, and views over existing records.

## 4. Where the framed path could still fail

1. **Compiler view mode** (largest risk).
   - Today's state codegen assumes block-layout slots. Composed frames need the same record logic, fed from witness
     views and witness indices.
   - Bounded if it covers only section 20's record kinds and reuses today's encoders.
   - Unbounded if every special case in `GenerateTargetTraversal.ts` (37,918 lines) has to be carried across.
2. **Validator correctness.** It is the security core: one hostile test per V-check, and T1-T41.
3. **Derivation cost.** Restarting a master at every stop site multiplies the VM runs by the number of stop sites.
   Derivation must resume instead (spec section 18).
4. **Mock-only scale.** Every master carries its full code, several megabytes for MarketplaceV1. This is fine in the
   relaxed mock. A real chain needs code splitting (D3: out of scope).
   - **Code splitting is not enough** (review, 2026-09-25). It caps each master at 10,000 B, but every entry carries
     its own copy, so the transaction grows with the number of entries. `arbitrate`, about 24 masters, comes to
     roughly 120-240 KB before the validator, state and outputs.
   - libauth pins the limits: per input, 10,000 B is consensus; per transaction, 100,000 B is the relay limit
     (policy) and 1,000,000 B the consensus limit. The largest titles would be non-standard but consensus-valid.
   - The kernel has the mirror problem: its routes exceeded the 10,000 B per-input consensus limit. Neither path is
     real-chain ready, so 66/66 is a mock result either way. Plan item A9 measures the framed numbers.
   - **The lever** (third review): load the code instead of carrying it (spec 12, mitigation 1). Each unlocking byte
     funds 8 instructions, so most masters need little padding, but one copy per distinct code remains: about 3x
     fewer copies for `arbitrate`. Witnesses and padding stay, so the total improves about 2x: about 64 KB at 4 KB
     facets, 100-125 KB at the 10,000 B cap, either side of the 100,000 B line. A9 measures this first.
5. **Record growth.** `jobEvents` intermediate versions leave chunk outputs behind. This is measured in plan section 4.5.
6. **Harness features** (snapshots including SDK state, listeners, simulation before funding). This is SDK work;
   part of it exists today.

## 5. Speed

### Compile (measured cold, `optimizeForCompilationSpeed` on)

| Contract | Kernel | Without the bus | Notes |
| --- | --- | --- | --- |
| MarketplaceV1 | 8.6-9.0 s, 436 MB | Refused: `MESSAGE_BUS_REQUIRED` (it calls MarketplaceData twice) | Parse 1.0 s + admission 4.9 s (a full compile, with route and verifier) + binder 2.6 s (a second full compile) |
| MarketplaceDataV1 | 5.8 s, 363 MB | not measured | 42.6 KB route |
| FakeToken | 1,228 ms | **797 ms (-35%)** | Same bytecode: 9,610 vs 9,574 bytes |
| UnicrowClaim, UnicrowArbitrator | 3.2 s, 2.8 s | Refused: `MESSAGE_BUS_REQUIRED` (repeated callee) | |

- **Per-call estimate for MarketplaceV1:** 1.0 s of parsing plus one pass of about 2.5-3.5 s, plus 10-20% for
  witness and view code. That is about 3.5-4.5 s, **about 2x faster**.
- **Leaf contracts:** about 35% faster.
- **Memory.** No admission ladder, so no route-admission memory amplification. `MockSablierLockup`: 1.4 s and 216 MB
  without the bus, out of memory above 4 GB with it (`PERF_FINDINGS.md`).
- **Warm cache:** unchanged, at about a 0.9 s floor.
- **Also:** today's direct path cannot compile the marketplace contracts at all. Only the bus accepts a repeated
  callee, and framed handles it natively.

### SDK derivation

- **Kernel today, `post job 1`** (26 inputs, 36 outputs): about 2.8 s of SDK CPU per send.
  - Derivation passes: 0.8 s over two passes.
  - Convergence repair: 0.65 s.
  - Preflight: 0.36 s.
  - Faithful traces: 0.47 s.
  - Builder: 0.49 s.
- **Per title:** 17-19 s of wall time, of which 11-13 s is the harness (transform, setup, import, and worker idle).
- **Per-call estimate for the same transaction:**
  - about 15 masters (M proxy and implementation, 5 x D proxy and implementation, 3 x T) plus one validator;
  - with resumable derivation, one execution per master, witness assembly, and one final preflight: about
    0.6-1.5 s, **2-4x less SDK CPU**;
  - with a restart at every stop site (about 10 per master), it could cost more than today. That is why the spec
    requires resuming.
- **Re-entry titles** (`arbitrate`, `approveResult`): the kernel cannot build them. Per-call derivation is bounded,
  with no fixpoint.
- **Suite wall time:** about 10-20% faster, because the harness dominates. The larger gains are the cold compile
  (about 2x) and the end of admission retries.

## 6. Added kill criteria for the gate (plan milestone I2)

- The compiler delta at I2 exceeds about 12K lines, the top of section 3's estimate for all of master mode, or view
  mode needs a special case outside spec section 20's record kinds. (The earlier 6K sat below that estimate, so it
  could have killed an effort that was on track.)
- Deriving the re-entry toy (Y2, with a loop of five calls) takes more than 5 s.
- A V-check has no hostile test, or a threat row marked Critical has no test showing it is rejected.
