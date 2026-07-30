# L2 adversarial review: SEC-18 and X111

Reviewer L2, iteration 7, branch `worker-l2-i7`, base `8072d1fb`. I did not implement either subject.
Every settlement claim below is a mocknet BCH-2026 VM evaluation. No regtest was run. I made no source
changes; the two proposed diffs in this document are NOT applied.

Module resolution was verified inside this worktree before any measurement was believed:

```
file:///Code/cashscript/.worktrees/worker-l2-i7/packages/solidc/dist/index.js
file:///Code/cashscript/.worktrees/worker-l2-i7/packages/solidcash/dist/index.js
file:///Code/cashscript/.worktrees/worker-l2-i7/packages/utils/dist/index.js
ALL IN WORKTREE: true
```

`yarn build` exit status 0 (it first failed exit 2 on `@solidcash/create-solidhat` because the
`@solidcash/solidhat` and `@solidcash/create-solidhat` links were missing from the mirrored
`node_modules`; both were added before anything was measured).

A second worktree `l2-base-sec18` was created at `1cd218c9^` (`3281ece9`), the commit immediately
before SEC-18's widening, and built the same way. Every "base" figure below comes from it.

## Verdicts

| subject | verdict |
|---|---|
| **SEC-18** - route-reachable pure readers read the pre-transaction value | **FAIL** |
| **X111** - the emission-clone gate | **PASS WITH FINDINGS** |

SEC-18 is FAIL because the identical exploit the row was opened on still settles through the ordinary
guarded planner on a one-construct variant of the fixture (L2-F3), and because the widening turns an
honest contract that previously compiled into a bare internal code-generation error (L2-F2).

X111 is PASS WITH FINDINGS rather than FAIL because its author's central negative claim - that the gate
is not a soundness fix and the bytes still settle - is CORRECT and is now demonstrated as an exploit
rather than stated as a caveat (L2-F1a). The rules the gate does implement (per slot, ordered, earliest
writer, conservative on `unknown`) all survived attack. Its blind spot on the second emission-clone
spelling (L2-F1b) is a finding against the gate as written, not against its design.

---

## L2-F1a. The X111 gate is bypassed at consensus level. SEVERITY: HIGH

**Confirms the author's own headline as an exploit.** The gate lives inside `planCompiledGraph`
(`packages/solidcash/src/layer3/graph.ts:1632`). Nothing in the transaction commits to the gate, to
`invocationAnalysis`, or to the planner having been used, so any other constructor of the same
`CompiledGraphPlan` produces bytes that settle. `finalizeCompiledGraph` takes the plan alone and never
re-checks - the author's own comment at `graph.ts:392-393` already contemplates "a hand-constructed
`CompiledGraphPlan` handed straight to `finalizeCompiledGraph`".

Two independent constructors, both reproducing the H1 exploit:

- **hand-assembled plan** - `handAssemblePlan` in the test file rebuilds every field
  `finalizeCompiledGraph` reads from the same exported `encodeHiddenBatch` the planner uses.
  `planCompiledGraph` is never called.
- **decoy footprint** - the real vault artifact with the single `__scb_graph_assertFloor` entry removed
  from `invocationAnalysis.functions`. Bytecode, `hiddenBatch` and locking bytecode unchanged.

Reproducing case, `packages/solidcash/test/e2e/Layer3SecurityReviewL2X111.test.ts`:

| case | result |
|---|---|
| `L2-P0` positive control: guarded planner, `withdraw(80)` then `assertFloor(50)`, opening 100 | REFUSED by name |
| `L2-A1` hand-assembled plan, same rows | **SETTLES** on the mocknet VM |
| `L2-A2` decoy footprint, same rows | **SETTLES** on the mocknet VM |
| `L2-A1n` guard on the attacked field: floor 10, true of the post-balance 20 | settles |
| `L2-A1L` liveness: floor 150, false of BOTH 100 and 20 | refused at **input 1, the vault master** |
| `L2-A3` both bypass constructors, one fixture | ONE transcript root, so it is one transaction |

`L2-A1L` is what makes `L2-A1` a stale READ rather than a dead `require`: the same covenant refuses a
floor that is false of the pre-balance too, so the guard row is live under the bypass constructor.

**Proposed remedy (NOT applied).** The gate cannot be made sound where it is. Either close the residual
in code generation - thread the emission clone's journal slots through the graph effect-frame protocol
so the arity contract at `GenerateTargetTraversal.ts:2940-2961` accounts for them - or move the refusal
onto the projection verifier so it is enforced by a covenant rather than by a constructor. Until one of
those lands, X111 should be described in the ledger as LIVE with a client-side lint, which is what its
author already says. No diff is proposed for a client-side check whose location is the defect.

## L2-F1b. The gate is blind to the second emission-clone spelling. SEVERITY: MEDIUM

**Mechanism.** `graphEmissionHandler` - the flag `GenerateTargetTraversal.ts:1772-1774` excludes from
SEC-18's widened closure - is set at **two** sites in `compiler.ts`:

- `:1575` on the `__scb_graph_<handler>` clone, and
- `:1466` on the `__scb_resource_<handler>` clone, when its source handler is in `graphTailHandlers`.

The gate's lookup key is only `GRAPH_EMISSION_CLONE_PREFIX = '__scb_graph_'` (`graph.ts:1231`), so at
`graph.ts:1322-1323` a resource-shaped clone is not found and `continue` skips it. The exclusion set the
compiler applies is therefore strictly wider than the set the gate inspects. Note also that a
resource-shaped handler gets NO `__scb_graph_` clone at all (`compiler.ts:1561` skips
`resourceShapedHandler`), so there is no second entry for the gate to fall back on.

**Reproducing case**, `L2-F1b`. A vault whose `assertFloor` reaches one collection under a shared and a
row-local key and closes with `require(msg.sender == who)` publishes
`__scb_resource_assertFloor` (`reads: ["state:balance"]`, `writes: []`) and no
`__scb_graph_assertFloor`. With `withdraw` writing `state:balance` at local row 0 and that clone at
local row 1, `planCompiledGraph` **admits** the composition.

**Guard negative control on the attacked field.** The same artifact with only the clone's published
NAME changed from `__scb_resource_assertFloor` to `__scb_graph_assertFloor` - same reads, same writes,
same rows, same order - is REFUSED by name. That isolates the prefix as the blind spot rather than
anything about the contract's footprint.

**Proposed diff, NOT applied**, `packages/solidcash/src/layer3/graph.ts`:

```diff
-const GRAPH_EMISSION_CLONE_PREFIX = '__scb_graph_';
+/**
+ * Names the compiler gives a handler's graph EMISSION clones. `compiler.ts` sets
+ * `graphEmissionHandler` at TWO sites: `:1575` on the `__scb_graph_` clone and `:1466` on the
+ * `__scb_resource_` clone of a resource-shaped handler that is also a graphTailHandler. Both are
+ * excluded from SEC-18's journal by `GenerateTargetTraversal.ts:1773`, so both must be looked up.
+ */
+const GRAPH_EMISSION_CLONE_PREFIXES = ['__scb_graph_', '__scb_resource_'] as const;
```

with the two lookups becoming a search over both prefixes:

```diff
-      const executed = byName.get(`${GRAPH_EMISSION_CLONE_PREFIX}${row.function}`)
-        ?? byName.get(row.function);
+      const executed = GRAPH_EMISSION_CLONE_PREFIXES
+        .map((prefix) => byName.get(`${prefix}${row.function}`))
+        .find((summary) => summary !== undefined) ?? byName.get(row.function);
```

```diff
-      const clone = byName.get(`${GRAPH_EMISSION_CLONE_PREFIX}${row.function}`);
-      if (clone === undefined) continue;
+      const clone = GRAPH_EMISSION_CLONE_PREFIXES
+        .map((prefix) => byName.get(`${prefix}${row.function}`))
+        .find((summary) => summary !== undefined);
+      if (clone === undefined) continue;
```

**What I did NOT establish for L2-F1b**: settlement. Demonstrating it needs a resource-shaped graph
fixture with entry NFTs in the block layout, which I did not build. The stale-read step is evidenced
structurally instead: `L2-F2 V1`/`V4` below show empirically that the `__scb_resource_*` clones are
excluded from the journal exactly when their source handler uses `msg.sender`, because the sound
variant crashes on missing journal context and the msg.sender variant does not.

## L2-F1c. An `unknown` clone escapes the conservative arm by publishing any write. SEVERITY: LOW

At `graph.ts:1325` the check `writtenVariablesOf(clone).length > 0` short-circuits BEFORE
`clone.unknown` at `:1326`. Its justification - "a clone that writes any slot joins the journal through
`writerIds`" - holds for a footprint the compiler authored, but `writes` is the spender's data on this
path (see L2-F1a), and an `unknown` footprint is by definition not evidence of anything. `L2-A4w`: an
`unknown` clone publishing one write of a slot that does not exist (`state:nosuchslot`) is ADMITTED on
the row set `L2-A4` refuses. Subsumed by L2-F1a as long as the decision inputs are unauthenticated;
worth reordering the two checks if the gate ever moves somewhere it can be trusted.

---

## L2-F2. SEC-18's widening crashes an honest contract that previously compiled. SEVERITY: MEDIUM

**Mechanism.** `GenerateTargetTraversal.ts:1788` widened the closure filter to
`(writerIds.has(id) || routeReachable.has(id)) && slots.size > 0`. A resource-shaped bus route whose
handler gets a `_self_alias` clone (`compiler.ts:1479`) and reads a scalar slot now has that alias in
the closure - route-reachable, reads a slot, writes nothing - and the site that invokes it has no
journal context on the stack. Code generation aborts with a bare internal `Error`:

```
Missing journal context '__internal__state_write_balance'
  while invoking '__scb_resource_assertFloor_self_alias'
```

No error name, no source position, no remedy. Fail-closed, so not a soundness defect; it is an
availability regression on a contract the compiler accepted at `1cd218c9^`.

**Reproducing set**, `packages/solidc/test/SecurityReviewL2Sec18.test.ts`, one field at a time:

Canonical redeem bytes, same metric as the scaling table below:

| case | base `1cd218c9^` | HEAD `8072d1fb` |
|---|---|---|
| V1 scalar read, no `msg.sender`, writer present | compiles, 4109 B | **CRASHES** |
| V2 scalar read, no `msg.sender`, NO writer of the slot | compiles, 3984 B | **CRASHES** |
| V3 no scalar read | 4052 B | 4052 B |
| V4 scalar read WITH `msg.sender` | 4293 B | 4293 B |
| V5 scalar read, no `msg.sender`, DIRECT mode | 909 B | 909 B |

V2 isolates `routeReachable` rather than `writerIds` as the admitting disjunct: nothing on that route
writes the slot, so at base the closure was empty. V3 isolates the scalar read as the trigger. V5
bounds the blast radius to bus routes, consistent with the author's "direct mode is byte-identical".

**V4 is the sharp part.** The variant SEC-18 still serves the pre-state - the emission clone, excluded
at `:1780` - is the one that compiles, and its sound sibling is the one refused. The widening protects
nothing on this shape and breaks the only spelling of it that was already correct.

Why the author's 1278/1278 fixture sweep did not catch it: the shape needs a resource-shaped bus route
(one collection, a shared key AND a row-local key) whose handler also reads a scalar slot, and no
fixture has it.

**Proposed remedy, NOT applied.** Either exclude the `_self_alias` clone from `routeReachable` the way
emission clones are excluded, or give its invoking site journal context. The first is one line at
`GenerateTargetTraversal.ts:1772-1774`:

```diff
     const emissionClones = new Set(functions
-      .filter((fn) => fn.graphEmissionHandler && fn.functionId !== undefined)
+      // A `_self_alias` clone (compiler.ts:1479) is invoked from a site with no journal context, so
+      // admitting it to the closure aborts code generation on a contract that compiled at 1cd218c9^.
+      .filter((fn) => (fn.graphEmissionHandler || fn.name.endsWith('_self_alias'))
+        && fn.functionId !== undefined)
       .map((fn) => fn.functionId!));
```

I do not recommend applying that as written without measuring it: it widens the exclusion, so it
restores the pre-SEC-18 stale read for the alias, and the name test is a string predicate where a flag
belongs. The second option is the real repair. Either way the current behaviour should not be an
unnamed internal `Error`.

## L2-F3. SEC-18 misses the function-pointer edge, and the identical exploit SETTLES. SEVERITY: HIGH

**Mechanism.** `computeScalarJournalClosures`'s `scan` records a callee only from
`GenerateTargetTraversal.ts:1685`:

```ts
if (root instanceof FunctionCallNode && root.resolvedFunction?.functionId !== undefined) {
  calls.add(root.resolvedFunction.functionId);
}
```

and at `:1689` it explicitly skips the `functionReference` key while walking. A call made through a
function pointer carries its target under `functionReference`, so the callee's id never enters
`callsById` and its slots never propagate into the caller's `slots` through the fixpoint at `:1736`.
Consequence: neither the pointer's target nor the handler that invokes it joins the widened closure,
and the read falls through to `emitStateFieldRead` - the input NFT commitment, i.e. exactly the
pre-transaction value SEC-18 was opened on. There is no `msg.sender` and no outgoing call, so this is
not an emission clone and X111's gate is silent on it.

**Byte evidence that the widening never reached it** - same contract, three spellings of one read,
measured on both builds:

| spelling | base `1cd218c9^` | HEAD | delta |
|---|---|---|---|
| C1 plain read in the handler | 1437 B | 1452 B | **+15** |
| C2 read via an inlined void helper | 1441 B | 1456 B | **+15** |
| C3 read via a FUNCTION POINTER | 1448 B | 1448 B | **0** |

+15 B is the journal onset. C3 is byte-identical to the pre-SEC-18 build.

**Reproducing case with settlement**, `Layer3SecurityReviewL2X111.test.ts`. The vault is X111's own
three-handler fixture with the guard's read moved behind
`function(bigint) internal probe = checkFloor; probe(floor);`. The router's own body emits
`IVault(v).withdraw(a0); IVault(v).assertFloor(a1, sender);`, so the guard row is not a spender's
choice. Opening balance 100, `withdraw(80)`, closing 20:

| case | result |
|---|---|
| `L2-F3` **hostile**, pointer spelling, `assertFloor(50)` | **SETTLES** on the mocknet VM through `planCompiledGraph` |
| `L2-F3p` positive control, same rows, DIRECT-read spelling | refused at **input 1, the vault master** |
| `L2-F3L` liveness, pointer spelling, `assertFloor(150)` | refused at **input 1, the vault master** |

`L2-F3p` differs from `L2-F3` in one construct - whether the read goes through the pointer - and it is
refused, which is what makes this a closure gap rather than a claim the guard was always vacuous.
`L2-F3L` shows the pointer guard is live: a floor false of the pre-balance too is still refused, so
`L2-F3` settles because the guard was satisfied against 100, the value the transaction was reducing.

No bypass constructor, no artifact tampering, no hand assembly. This is the guarded path.

**Proposed diff, NOT applied**, `packages/solidc/src/generation/GenerateTargetTraversal.ts`:

```diff
       if (root instanceof FunctionCallNode && root.resolvedFunction?.functionId !== undefined) {
         calls.add(root.resolvedFunction.functionId);
       }
+      // X105 gap. A call made through a function POINTER carries its target under
+      // `functionReference`, which the walk below skips as a back-reference, so neither the target's
+      // id nor its slots reached the closure and a pure reader behind a pointer kept reading the
+      // authenticated PRE-state. Record the edge here, where the reference is still in hand.
+      if (root instanceof FunctionCallNode
+        && root.resolvedFunction?.functionId === undefined
+        && (root as { functionReference?: { functionId?: number } })
+          .functionReference?.functionId !== undefined) {
+        calls.add((root as { functionReference: { functionId: number } }).functionReference.functionId);
+      }
```

The exact accessor must be confirmed against the AST node the pointer call lowers to before this is
applied; I did not modify source, so I did not verify the field name resolves. What IS verified is that
the edge is absent from `callsById` today, by the byte-identity above and by settlement.

A pointer target may also need the frame treatment emission clones get: if it turns out a
pointer-invoked subroutine cannot carry journal context for the same arity reason, then the honest
outcome is a named refusal of the shape, not a silent stale read.

---

## Byte-cost scaling of SEC-18 (deliverable 5)

n pure scalar readers of one journalled slot plus one writer, reader count the only axis. Canonical
redeem metric (`Contract(artifact, []).withCategory(zeros(32)).bytecode.length / 2`), the same metric
the F3 census uses.

| readers | base `1cd218c9^` | HEAD | delta | delta per reader |
|---|---|---|---|---|
| 0 | 1398 | 1398 | +0 | - |
| 1 | 1483 | 1498 | **+15** | 15.0 |
| 2 | 1546 | 1555 | +9 | 4.5 |
| 3 | 1600 | 1613 | +13 | 4.3 |
| 4 | 1638 | 1659 | +21 | 5.3 |
| 5 | 1685 | 1709 | +24 | 4.8 |
| 6 | 1727 | 1755 | +28 | 4.7 |
| 7 | 1769 | 1801 | +32 | 4.6 |
| 8 | 1811 | 1847 | +36 | 4.5 |

**It is not superlinear.** From 2 readers on, the marginal cost of each additional reader is a flat
+4 B (the delta sequence rises 9, 13, 21, 24, 28, 32, 36 - differences of 4, 8, 3, 4, 4, 4). At 8
readers the total overhead is 36 B, 2.0% of the base contract. Per-reader cost is flat, not growing.

**One figure I could not reproduce.** The plan's +15 B for one pure scalar reader reproduces exactly.
Its +18 B for two does not: my two-reader shape measures **+9 B**. That is a fixture difference, not a
defect - the plan does not say which contract it measured - but the +18 figure should not be cited as a
general per-reader cost.

---

## Refusal cost of the X111 gate (deliverable, brief angle 2)

Enumerated rather than asserted, `L2-A5`. Row set: one writer of `balance`, one writer of a different
slot, one emission clone reading `balance`. All six orders:

| order | gate |
|---|---|
| withdraw, bumpOther, assertFloor | REFUSED |
| withdraw, assertFloor, bumpOther | REFUSED |
| bumpOther, withdraw, assertFloor | REFUSED |
| bumpOther, assertFloor, withdraw | admitted |
| assertFloor, withdraw, bumpOther | admitted |
| assertFloor, bumpOther, withdraw | admitted |

3 of 6, and the partition is exact: **refused if and only if the `balance` writer precedes the guard**.
That is not a random half. It is every "act, then assert the post-condition" composition - the shape a
post-condition, an invariant check and a Solidity `_after*` hook all take. The three admitted orders
all read the guard BEFORE the write it is meant to check, which is the composition that does not need
the guard. So the honest cost of the gate is not a fraction of compositions, it is the whole useful
class of them. The author states this; the measurement is that the rule's discriminant is precisely
"writer first", with no honest sub-case escaping.

This is a true refusal, not a false one: the refused shape really is stale today. The complaint is that
the refusal is the only thing on offer.

---

## What I attacked and could NOT break

These are the attacks that failed. The X111 PASS rests on this list.

1. **The per-slot rule.** `L2-A7`: a clone reading `balance` after a row that writes only `other` is
   admitted. The gate does not key on co-occurrence, so C2's `absorb`/`legs` disjointness is respected
   by rule and not by luck.
2. **The order rule.** `L2-A5` rows 4-6, `L2-A4` guard: a clone at a local row with no earlier writer
   of its slot is admitted in every spelling I tried, including the `unknown` arm. Reader-first is never
   refused.
3. **Multiple writers of one slot.** `L2-A6`: two `withdraw` rows then the clone refuses naming
   **row 0**, the earliest writer, not the nearest. That is the correct choice; a clone after two
   writes is stale with respect to both, and naming the nearest would understate it.
4. **A reader whose slot no row writes.** `L2-A7`: admitted, correctly - there is no earlier write for
   it to have missed.
5. **The `unknown` arm fails CLOSED.** `L2-A4`: an `unknown` clone with an empty read set is refused by
   ANY earlier writer, including a writer of a slot it never names. I also confirmed the arm is
   unreachable from compiler output - no function in any artifact I compiled publishes `unknown: true`,
   because `footprint.unknown` refuses the handler before it can be cloned (`compiler.ts:1464`). So the
   author's "untested conservatism" is conservatism, verified.
6. **The fail-closed arm for a participant with no invocation analysis.** Read and confirmed at
   `graph.ts:1295-1300`: it throws rather than skipping. I did not find a way to make it skip.
7. **The gate's message is not vacuous.** `L2-P0` and the `L2-F1b` rename control both fire on the live
   regex `row 1 'assertFloor' is a read-only graph emission clone reading 'balance'`, and the
   `L2-F1b` control differs from its hostile twin in one field. No deleted identifier, no rule inside a
   `try`.
8. **SEC-18 in DIRECT mode.** `L2-F2 V5`: byte-identical and crash-free, so the widening's blast radius
   really is bus routes.
9. **SEC-18's emission-clone exclusion is not accidentally wider than the clones** in the sense the
   brief asked about. The `continue` at `:1780` does also prune traversal THROUGH a clone, so a function
   reachable only via a clone is excluded too - but that is required, not accidental: such a function is
   invoked from a frame that carries no journal context, which is the same reason the clone itself is
   excluded, and L2-F2 is what happens when a clone-adjacent function IS admitted. **Measured, not
   reasoned**: one pure reader `readFloor`, first reachable ONLY from an emission clone, then also from
   an ordinary non-clone handler, one construct apart.

   | reader reachable via | base `1cd218c9^` | HEAD | delta |
   |---|---|---|---|
   | the emission clone only | 1677 B | 1677 B | +0, not journalled |
   | the clone AND a non-clone handler | 1668 B | 1683 B | **+15, journalled** |

   So a second, non-clone path admits the function normally: the pruning removes the clone's own edge
   and nothing more. The first row is the known X111 residual, not a new hole.
10. **The author's own two suites.** `Layer3EmissionCloneStaleReadX111.test.ts` 6/6 and
    `Layer3ReadYourWritesX105.test.ts` 9/9 both pass at my HEAD. None of my findings is a claim that
    their assertions are wrong; all four are shapes those files do not cover.

## What I decline to claim

- **Settlement for L2-F1b.** Proven at planner level and structurally; no VM evaluation. It needs a
  resource-shaped graph fixture with entry NFTs.
- **That the L2-F3 diff is correct.** The edge is verifiably absent; the accessor in my proposed diff
  is unverified because I did not modify source. It may also turn out that a pointer-invoked subroutine
  cannot carry journal context at all, in which case the repair is a named refusal instead.
- **Which commit introduced L2-F2, by bisection.** Attributed to the widening `1cd218c9` by code
  reading - `routeReachable` is the only mechanism that can put a non-writer into
  `journalSlotsByFunctionId` - and confirmed only as "absent at `1cd218c9^`, present at `8072d1fb`". I
  did not build `1cd218c9` itself, so I cannot say whether `77d40260`'s exclusion narrowed the crash
  class or left it unchanged.
- **Any corpus-wide frequency for L2-F2 or L2-F3.** I did not run the eacc/SBE/solc corpora, so I do
  not know how many real contracts take either shape.
- **Mapping and collection readers as the reading side.** The brief lists this; I did not reach it.
  `scalarReadsOf` (`graph.ts:1250`) filters the read side to `state:` only, so a clone reading
  `collection:x:k` is outside the gate's vocabulary entirely - but I did not establish whether entry
  reads on a bus route are served stale in the first place, and without that the filter is not
  necessarily a hole.
- **The Release 5 repeated-callee route**, and a reader reached through a further foreign participant.
  Both are on the brief's list; neither was attacked.
- **Anything about performance or instruction counts.** The plan's "43/55/195 instructions dropped at
  2/3/8 rows" was not re-measured.
- **Any row's PROVEN status.** Not mine to set.

## Files

- `packages/solidcash/test/e2e/Layer3SecurityReviewL2X111.test.ts` - 15 cases, all green:
  L2-P0/A1/A1n/A1L/A2/A3 (X111 bypass), L2-F3/F3p/F3L (SEC-18 pointer gap, with settlement),
  L2-F1b/A4/A4w/A5/A6/A7 (the gate as a decision procedure).
- `packages/solidc/test/SecurityReviewL2Sec18.test.ts` - 7 cases, all green: L2-F2 V1-V5, the
  self-alias footprint, and the reader-count cost shape.
