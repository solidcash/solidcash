# Session findings — kernel-beta queue items 1 & 2 (instrumentation session)

Status: **no code change landed; tree is back at the verified `3ef649fcd` state.** Everything below is measurement,
localisation and tooling, recorded so the next session does not have to rediscover it. Read alongside
`HANDOFF_NEXT_SESSION.md` (queue) and `MARKETPLACE_ENTRY_CARDINALITY_FINDINGS.md` (item 1 history).

Dirty tree after this session is exactly the four fenced files plus the two handoff markdown files. No scratch test
file, no compiler instrumentation, no stray symlink is left behind.

---

## 0. The single most important result: the fence is only the first of two walls

Queue item 2 (`KERNEL_LAYOUT` refusal of the marketplace write handlers) is **necessary but not sufficient** to
unblock the dominant ladder failure class.

Evidence. The SDK decides route admission at runtime from the artifact's own `handlers[].eligible` flag
(`packages/solidcash/src/stateful/StatefulContract.ts:32596`, `if (!handler?.eligible) throw new Error('External
message-bus batch selector … is not advertised as an eligible callee handler')`). That makes the fence testable
without touching the compiler: patch `eligible: false -> true` in the shipped artifact JSON and run the title.

Measured on the `should whitelist worker` / `update job` family with `MarketplaceDataV1.json` patched so all 13
refused handlers are eligible:

* the `not advertised as an eligible callee handler` error **disappears**, so the fence is genuinely what produces it;
* the title then does **not** fail fast — it **stops converging and runs past a 900 s cap** (previously: clean
  failure in ~75 s). A whole-ladder run begun before the patch and left running reached ~24 minutes inside a single
  title at ~3.7 GB RSS before it was killed.

Interpretation: with the route admitted, the chunked-value write takes the **routed batch path**, and that path does
not converge for a chunkable write. So there are two distinct defects stacked:

1. **Admission fence** — the route is refused (this is what the ladder currently reports), and
2. **routed chunked-write convergence** — once admitted, the builder never settles.

Item 2 cannot be closed by relaxing the fence alone; (2) is the deeper blocker and is where the real work is.
The same non-convergence is the likely identity of item 1's "~361 s vs ~45 s thrash signal": that title is a
chunked-write title too.

---

## 1. Exact localisation of the `KERNEL_LAYOUT` fence (item 2)

The compiler assigns `KERNEL_LAYOUT` for these handlers at **two** sites, both inside kernel admission, and both
keyed on the same predicate pair:

* `packages/solidc/src/compiler.ts:4593` (`synthesizeMessageBusRoute`, provisional pass):
  `if (chunkableWrites && (!hasCounterJournalTransport || hasUntransportedWrite))`
* `packages/solidc/src/compiler.ts:12263` (pristine re-admission pass):
  `if (hasIncompleteChunkableTransport)`

Confirmed by instrumenting every `fn.messageBusRejectionReason = 'KERNEL_LAYOUT'` assignment with a stack trace and
running the construct probe below (7 hits at the first site, 10 at the second, and no hits anywhere else for these
shapes).

The predicate at 4593 is:

```ts
const chunkableWrites = [...footprint.writes].some((resource) => {
  if (!resource.startsWith('collection:')) return false;
  const name = resource.slice('collection:'.length).split(':', 1)[0];
  const valueType = collectionByName.get(name)?.innermostValueType;
  return valueType instanceof ArrayType || valueType === PrimitiveType.STRING
    || (valueType instanceof BytesType && valueType.bound === undefined);
});
const hasCounterJournalTransport = (fn.runtimeCounterLoopCounters?.size ?? 0) > 0
  && fn.parameters.some((parameter) => parameter.name === KERNEL_JOURNAL_ACCESS_STREAMS);
const hasUntransportedWrite = hasUntransportedChunkableWrite(
  fn, chunkableCollections, signatureClosureByName, footprintCache,
);
```

`hasUntransportedChunkableWrite` (`compiler.ts:3269`) accepts a write only as
`nowLoop && node instanceof MappingAssignNode && node.messageBusJournalTransport?.collection === collection`, i.e.
only a runtime-counter-loop `MappingAssignNode` that `LowerVMapCounterLoops` has already transported. Every other
write shape into a chunkable collection is "untransported" by construction — including a plain
`MappingArrayPushNode`/`ArrayPushNode`.

The design comment at 4594 states the missing capability precisely:

> A route may invoke this handler repeatedly. Until its completed entry descriptor is represented in the
> authenticated compact journal ABI, every row would independently pin a terminal continuation family.

So the fence is deliberate, and the missing piece is **the completed entry descriptor in the authenticated compact
journal ABI** (for both the provisional and pristine passes — both must be satisfied).

---

## 2. Construct probe result: which write shapes are refused

Written as a temporary `packages/solidc/test/journal-message-bus/ZZProbeWriteVariants.test.ts` (removed after use;
the source is kept at `/tmp/ZZProbeWriteVariants.test.ts` — copy it back to re-run). Options:
`{ forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000, suppressWarnings: true }`,
then read `artifact.messageBus.handlers.find(h => h.name === 'candidate')`.

Refused (`eligible: false`, `rejectionReason: KERNEL_LAYOUT`, `rejectionCode: MESSAGE_BUS_UNSUPPORTED_CONSTRUCT`):

| shape | example |
|---|---|
| mapping to dynamic array, push | `this.items[key].push(v)` (scalar or struct element) |
| mapping to dynamic array, index write | `this.items[key][0] = E(1,2)` / `this.items[key][0].a = 1` |
| mapping to struct, field write | `this.users[key].a = 5` (int, string, bytes — all alike) |
| mapping to struct, whole write | `this.users[key] = u` / `= User(1,2)` |
| mapping to string / unbounded bytes | `this.items[key] = "x"` / `= hex"01"` |
| nested mapping to array | `this.items[key][k2].push(v)` |
| read-then-write on a struct mapping | `int v = this.users[key].a; this.users[key].b = v;` |

Admitted (`eligible: true`):

| shape | example |
|---|---|
| read only | `return this.items[key].length` (mapping to array) |
| **scalar** mapping write | `this.items[key] = 5` (mapping `int => int`) |
| **scalar** field increment | `this.users[key].reputationUp += 1` where the struct is width-1 |
| plain state-array push | `this.items.push(v)` (not a collection) |
| plain scalar-state struct field write | `this.user.a = v` on a non-collection struct |

Notable: a *plain* state array push is fine; only pushes **into a mapping-valued array of a chunkable collection**
are refused. That asymmetry is the sharpest handle for a principled relaxation.

The shipped artifacts carry exactly this class: `MarketplaceDataV1.json` has 13 refused handlers —
`initialize`, `publishJobEvent` (`a826ee9c`), `registerUser`, `updateUser`, `userRefunded`, `userDelivered`,
`registerArbitrator`, `updateArbitrator`, `arbitratorRefused` (`ec3e6b08`), `arbitratorSettled`, `updateMeceTag`,
`removeMeceTag`, `addReview` — and `FakeToken.json` has `transfer`, `transferFrom`. `MarketplaceV1/V2/V3` have
**zero** refused handlers.

Source shapes for the record: `publishJobEvent` is
`event_.timestamp_ = uint32(block.timestamp); jobEvents[jobId_].push(event_); emit JobEvent(...)`
(`.marketplace/contracts/MarketplaceDataV1.sol:161`); `updateUser` is three struct-field writes plus an event;
`userRefunded` is `users[address_].reputationDown += 1`.

---

## 3. Ladder failure census (66 titles)

From `/tmp/ladder-head.log` (full run at `c86c01b21`), classified by first failure line:

| count | reason |
|---|---|
| ~30 | `publishJobEvent`-dependent: 16 x `batch selector a826ee9c is not advertised as an eligible callee handler`, 14 x `BCH-2026 preflight failed at input 0: OP_VERIFY` |
| 3 | `index out of bounds` — `getArbitrators`/`getUsers` view-witness (item 3) |
| 2 | `preflight failed at input 13: OP_VERIFY` (item 1's title and one `sanity checks`) |
| 1 | `preflight failed at input 3: OP_VERIFY` (`post thread message`) |
| 1 | `batch selector ec3e6b08 is not advertised…` (`arbitratorRefused`) |
| 1 | `Delegate external call to MarketplaceDataV1.getArbitratorFee (offset 5) has arguments that cannot yet be resolved by the SDK` |
| 1 | `Cannot read properties of undefined (reading 'to')` (`take job multiple`) |
| 1 | `Test timed out in 600000ms` (`integration test`, needs an IPFS service — likely environmental) |

The two `publishJobEvent` classes are the same root cause seen from two sides: `MarketplaceV1.updateJobPost`
(`.marketplace/contracts/MarketplaceV3.sol:317` et al.) calls `publishJobEvent` mid-handler, and the failure mode
depends on whether the callee route is refused (explicit "not advertised" error) or admitted
(`OP_VERIFY`/non-convergence). Closing both items 1 and 2 requires the routed chunked-write path to work.

A clean re-measurement at `3ef649fcd` was started and killed after **25 passed / 3 failed** (`/tmp/ladder-3ef-clean.log`);
those 3 failures were the expected `index out of bounds` titles. The count was still climbing — the ladder is not
comparable below ~66 titles, so this is not a baseline.

---

## 4. Tooling discovered this session

### 4.1 Regenerating the marketplace artifacts IS possible (this was missing from the handoff)

The handoff said "no tracked generator script exists — it was done ad hoc". It is in fact reproducible:

```bash
# 1. The two Sablier/PRB deps resolved by the .sol import graph live in the EA project, not this repo:
cd /Code/cashscript/.worktrees/kernel-beta-candidate
ln -sfn /Code/effectiveacceleration.ai/contract/node_modules/@sablier node_modules/@sablier
ln -sfn /Code/effectiveacceleration.ai/contract/node_modules/@prb     node_modules/@prb

# 2. Compile. `SOLIDCASH_PROJECT_ROOT=.marketplace` is set by vitest.marketplace.config.ts, and the project
#    config at .marketplace/ is what the CLI picks up (paths.contracts -> .marketplace/contracts).
node packages/testing/dist/cli.js compile
```

Takes ~30 s (17 compiler jobs, cache-assisted) and writes `.marketplace/artifacts/solidcash/` **plus** regenerates
`.marketplace/cache/solidcash/` and the typechain tree.

**Caveat, important:** a fresh compile **replaces** the artifact tree (`fs.rmSync(outputDir)` in
`packages/testing/src/builtin-tasks.ts`). The current on-disk set is a 105-artifact tree whose `.sol` compile also
published the whole OpenZeppelin closure (`Address.json`, `ERC20.json`, `ECDSA.json`, …), whereas a fresh compile of
the present source set emitted only the 17 primary contracts. Also, the freshly compiled output did **not** contain
`MarketplaceV1.json`, which `deployContractsFixture` needs — the first clean compile silently broke that file.

Backups taken before any experiment (copy back to restore):

* `/tmp/artifacts-full-105/` — the complete working 105-artifact set for `3ef649fcd`. **Use this to restore.**
* `/tmp/artifacts-17src/` — the 17-contract output of a fresh compile, for comparison.

Before doing compiler work that needs regenerated artifacts, first establish whether the fresh set is complete
enough for the fixture (it needs at least `MarketplaceV1`, `MarketplaceDataV1`, `MarketplaceV2`, `MarketplaceV3`,
`FakeToken`, and the `Unicrow*`/interface artifacts), and keep `/tmp/artifacts-full-105` as the rollback.

### 4.2 Artifact-level experiment: test a compiler hypothesis without recompiling

Because the SDK reads `handlers[].eligible` at runtime, a JSON patch is a fast falsification tool:

```bash
node /tmp/patch-eligible.mjs .marketplace/artifacts/solidcash/MarketplaceDataV1.json publishJobEvent registerUser
```

Then run one title. This is how the section 0 result was obtained. Restore from `/tmp/artifacts-full-105` afterwards.
It does not work for changes that need genuinely different route bytecode, but it cleanly separates
"fence vs deeper defect".

### 4.3 Compiler fence tracing

`SOLIDC_DEBUG_ADMISSION=1` (temporary instrumentation, reverted) appended the assigning stack frame for every
`KERNEL_LAYOUT`. The 5-line recipe: add a `traceAdmission(refusal, fnName)` helper next to `kernelAdmissionReason`
and call it from each `fn.messageBusRejectionReason = 'KERNEL_LAYOUT'` assignment. That is what identified sites
4593 and 12263.

### 4.4 Debug hooks used

`SOLIDC_DEBUG_DYNAMIC_MIN=1` (`StatefulContract.ts:15090`, dynamic-chunk sizing per iteration),
`SOLIDC_DEBUG_VALUE_CHUNKS=1` (planned entry inserts, chunk outputs),
`SOLIDC_DEBUG_COLLECTION_FETCH=1` (entry UTXO scraping), `SOLIDC_DEBUG_ROUTE_INPUT_INDEX=<n>` +
`SOLIDC_DEBUG_FAILURE_RING=1` + `SOLIDC_DEBUG_FAILURE_POINT=1`.

---

## 5. Two additional defects found by reading, both worth a queue slot

### 5.1 `publishJobEvent`/`jobEvents`-named logic is pervasive in the SDK (project-rule violation)

The no-application/function-name rule is currently violated in the shipped SDK, not just in the emitter arm already
recorded in `MARKETPLACE_ENTRY_CARDINALITY_FINDINGS.md` §"Emitters of the stale copy" item 3. Named helpers include
`stampEmptyJobEventTimestamp` and `isPersistedJobEventsReady` / `persistedJobEventsWidth` (which default to the
`jobEvents` collection), and there are name-gated branches at `StatefulContract.ts:23216` and
`StatefulTransactionBuilder.ts:9680,9747,9874,18062`, plus a `legacyFallback: 'jobEvents'` convention at
`StatefulContract.ts:14388`.

The comment at `StatefulContract.ts:23213-23215` documents the coupling:

```ts
// Nested publishJobEvent fills empty timestamp_ with block.timestamp before store.
// Stamp logical args so unlocker encodings are 28B (stamped) not 24B (timestamp_=0).
// First insert keeps tip (post job 1 / whitelist green); appends use tip-1 (= nLocktime).
```

This should be re-expressed from artifact metadata (the collection's empty-timestamp/default-value convention plus
first-insert-vs-append provenance) rather than from the function and collection names. It is a large, risky refactor
and was **not** attempted this session.

### 5.2 Item 3 refinement: the array state variables are `fieldIndex` 1 and 2 of the same data NFT

`MarketplaceDataV1.stateLayout.variables` records `userAddresses` (`address[]`, `nftIndex: 0`, `fieldIndex: 1`,
`dynamic: true`) and `arbitratorAddresses` (`address[]`, `nftIndex: 0`, `fieldIndex: 2`, `dynamic: true`). Dynamic
variables are stored as a `uint32 A$len` header in the data-NFT commitment, with the bytes carried in separately
derived chunk outputs (`packages/utils/src/state.ts:1179` and `:1238`). `arbitratorAddresses` reads as length 0
in-VM while `userAddresses` works, so the defect is in the per-variable chunk production/read-back for a dynamic
array that is not the first dynamic field — a narrower hypothesis than "view witness" generally, and it points at
the `fieldIndex`-keyed chunk derivation rather than at entry enumeration (which the SDK confirms: `rawUtxos: 2,
filtered: 2`).

---

## 6. Suggested next step

Do not start by relaxing the fence. Start by reproducing the **routed chunked-write non-convergence** with the
artifact patch in place, one title (`-t 'update job$'`), under a hard wall-clock cap, with
`SOLIDC_DEBUG_DYNAMIC_MIN=1` and `SOLIDC_DEBUG_VALUE_CHUNKS=1`. Because the patch removes the admission error, that
run converts a fast failure into a reproducible hang — which is the shape the actual fix has to address, and it is
the same machinery item 1 needs.
