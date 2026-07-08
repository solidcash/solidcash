# Proving non-existence for mappings on BCH (research)

Design research behind finding C2 (`mapping-omission-security.md`). C2 is that a negative guard
(`require(!m[k])`) is bypassable: a spender omits an existing entry NFT, the covenant reads the type default,
the guard passes. This doc records *why* it is hard, what the resource envelope allows, the contention wall, and
a brainstorm of non-existence-proof techniques with a decision matrix.

## 1. The problem

A sound negative guard needs a **proof of non-existence**: that key `k` is genuinely absent from the set. On a
UTXO chain this is hard for one structural reason - there is **no free global read**. A covenant sees only its
own transaction's inputs (introspection), never "does an entry for `k` exist somewhere on-chain." So absence
must be witnessed by an authenticated commitment the spender cannot omit. EVM gets this for free (the protocol
maintains a world-state trie every validator holds); BCH must build it inside the contract and have the spender
supply the witness.

Asymmetry with C1: proving **presence** is cheap (co-spend the thing, pin its identity). Proving **absence** is a
non-membership statement - it needs an authenticated set or a consume-once resource. There is no shortcut,
because consensus arbitrates spend-once and input-unspent, not inclusion.

## 2. Resource envelope (BCH, 2025 VM Limits)

- **Transaction size:** ~100,000 bytes for a standard (relayable) tx - the ceiling on all inputs + witnesses.
- **Per-input compute + hashing:** density-based - an input earns operation-cost and hash-digest-iteration
  budget proportional to its own byte length. Proof data pays for the compute that checks it.
- **Hashing:** `OP_SHA256`/`OP_HASH256` are single native opcodes (~1 digest iteration per 64-byte block).
  Anchor: this codebase already runs in-script keccak256 (far heavier), so tens of native hashes are trivial.
- **NFT commitment: 128 bytes** (May 2026 upgrade, up from 40). Enough to store `(key, value, nextKey)` in one
  commitment - the change that makes the sorted linked list (B2) practical (see below).

Consequence: a ~1 KB proof + ~tens of hashes is ~1% of a tx and well inside the budget. **Compute is never the
binding constraint** - the constraints are transaction *size* (for co-spend-all) and, decisively, *contention*.
The 128-byte commitment relaxes a *layout* constraint (per-entry link fields) but changes none of the
fundamentals: reads still spend, so the contention wall and the code/data principle below stand unchanged.

## 3. The contention wall (the real constraint)

Two facts kill any single-global-commitment design:

1. **A set has exactly one root -> it can't be threaded.** SolidCash gets parallel writes by threading the
   master into K independent thread-UTXOs. One root would be mutated by all K threads and the roots would
   diverge (unsound). So a global root forfeits the very mechanism that gives parallel writes.
2. **Reading a committed value = spending its UTXO.** Introspection sees only the current tx's inputs, so to
   read a root the tx must co-spend the root's UTXO. A blacklist read by *every* transfer then serializes *all
   transfers* through one hot UTXO - worse than write contention.

**Serialization is a coordination cost, not a throughput cap.** BCH has **no unconfirmed-chain-depth limit** and
CTOR lets a chain sit in a block in any txid order, so accesses to one hot UTXO can be *chained* arbitrarily deep
into a single block (block-size-limited), not capped at some ancestor count. The real residual cost is
**coordination**: building `tx_n` needs `tx_{n-1}`'s output, so two *uncoordinated* parties spending the current
hot UTXO conflict (double-spend; one wins, the other retries). A **sequencer** (an issuer, a batcher) turns the
hot path into one deep chain; without one, concurrent access conflict-retries. So a single global root is
workable *with* a sequencer and painful without - and per-predecessor contention (B2 below) needs sequencing
only per hot gap.

**Corollary (the fundamental limit):** on UTXO, **contention-free sound reads require the commitment to live in
the covenant code (baked), not in a UTXO** - because any committed UTXO must be spent to be read. Therefore:

- read-heavy sound flags -> bake the commitment (writes become rare covenant upgrades);
- write-heavy sound sets -> per-UTXO structures (parallel writes, but reads spend);
- you cannot have contention-free reads *and* contention-free frequent writes for one globally-consistent sound
  set. That corner is a property of the UTXO model, the same "no free global state" fact that created C2.

**Design principle: separate code from data.** But the baked commitment above *mixes state into the covenant
code*, and that is rejected. The master UTXO is **code + identity**; all set state is **data** in its own UTXOs.
Reasons: baking makes a data change a *code* change (new redeem script -> new address -> migrate every UTXO +
re-audit); it gives each instance a different covenant, breaking one-bytecode-serves-any-layout (the same
property the layout-independent default proxy relies on). So the "baked" techniques below are ruled out despite
their free reads - **we take localized contention as the price of code/data separation** - and set state also
never goes into the *master's* commitment (which would bottleneck the master and its threading); it lives in
dedicated data UTXOs.

## 4. Two mechanisms already characterized

- **Nullifier (consume-once).** Represent the right as a unique UTXO; the action spends it; consensus
  double-spend enforces once-ness. O(1), ~150 B, ~0 hashes, and **fully parallel** (each coupon independent, no
  shared state). Needs eligibility **provisioned** up front (O(N) setup UTXOs); does not cover lazy first-touch
  or persistent readable flags.
- **Indexed Merkle tree (global root).** Sorted tree, root in the master; non-membership = bracketing low leaf
  `low.key < k < low.nextKey` + path, checked against the root. O(log N) proof (~1 KB / ~33 hashes at depth 32 =
  4 B entries) - fits size + compute with margin. But the root is a single un-threadable hot UTXO: **serializes
  reads and writes** (section 3). Compute-cheap, contention-fatal as a default.

## 5. Exclusion-proof brainstorm (the design space)

Axes: where the commitment lives (mutable UTXO / baked constant / distributed across entry UTXOs); the proof
kind (neighbor-membership / bit-absence / consume / enumerate / challenge); and the read/write frequency it
suits. Techniques:

### A. Consume-once (nullifier) - sidestep absence entirely
Covered (section 4). The only fully-parallel sound option; requires provisioning. Turns "is k absent" into "is
k's unique UTXO unspent," which consensus answers for free.

### B1. Indexed / sparse Merkle tree - global root (in a dedicated data NFT)
Covered (section 4). O(log N), general (unbounded/lazy/persistent). The 32-byte root is **data** in a
**dedicated root-NFT** - not the master's commitment (which would bottleneck the master + break threading) and
not the code. Still global-root contention, but cleanly separated.

### B2. Sorted linked list of entry-UTXOs - **no global root, and the standout under code/data separation**
Each entry commits `(key, value, nextKey)`; entries are a sorted singly-linked list. Non-membership of `k`:
**co-spend just the predecessor** `low` with `low.key < k < low.nextKey`. `low` being an input proves it is the
current (unspent) entry; `nextKey` is committed and maintained on insert (inserting `m` between `low` and its
successor sets `low.nextKey = m`), so `low.nextKey > k` proves nothing sits between - `k` is absent. O(1)
co-spend (one UTXO), no root.
- **Contention: local, not global.** Writes in different key-regions touch different predecessors -> parallel.
- Caveat: a non-membership read still *spends* `low`, so reads of many keys in one large gap contend on that
  gap's predecessor. For a sparse set, predecessors of big gaps are hot - better than one global root, not free.
  Splitting hot gaps (inserting sentinel entries) redistributes read load.
- The UTXO-native analogue of an indexed Merkle tree, trading the O(log N) path + global root for O(1)
  neighbor co-spend + local contention.
- **Fits the 128-byte commitment.** `key(32) + nextKey(32) + value(<=64)` = <=128, so a general mapping
  (key -> value up to 64 B) stores an entry in one commitment - even doubly-linked `(key, prevKey, nextKey)` at
  96 B leaves room. Under the old 40-byte limit `key+nextKey` (64) did not fit, forcing key truncation or
  chunking; the May 2026 upgrade removes that, which is what makes B2 clean rather than a hack.

### C. Approximate membership (Bloom / cuckoo) - **sound non-existence, cheap, bakeable**
A Bloom filter has **no false negatives**: if any of `k`'s hash-bit positions is 0, `k` was never added ->
**definitely absent**. So a non-membership proof is: reveal one position `p = hash_i(k)` with `filter[p] == 0`;
the covenant checks `p` is a valid hash position of `k` and the bit is 0. O(1), a couple of hashes.
- False *positives* (all bits set for an absent `k`) cause **over-rejection** - fail-closed for a blacklist
  (a legit user occasionally blocked), tunable by filter size.
- Bloom is **add-only** (can't clear bits); use a **cuckoo filter** if deletion is needed.
- Its free-read appeal was *baking* the filter into the code, which the code/data principle (section 3) rules
  out. As **data**, a 128-byte commitment holds a ~100-element filter (at ~1% FP) in one NFT - viable for a
  small blacklist - but a read still *spends* that NFT (contention, same as a root-NFT), and larger sets chunk
  and reduce to B1. So under code/data separation the Bloom filter loses its edge over a Merkle root / linked
  list, other than an O(1) bit-check vs an O(log N) path for a small single-NFT set.

### D. Baked constant set / root - **RULED OUT** (mixes code and data)
Putting the commitment (explicit list / Bloom filter / Merkle root) **in the covenant code** gives free parallel
reads - it is the *only* contention-free-read option (section 3 corollary) - but it is the code/data mix the
design principle forbids (a data change becomes a code upgrade + address change + full migration, and each
instance is a different bytecode). Recorded as the theoretical free-read ceiling; **not used** unless an author
explicitly opts into a fixed, baked-in set (e.g. a compile-time-constant allowlist that will never change).

### E. Complete enumeration (co-spend all) - tiny sets
Co-spend every entry + a master-committed count; check none equals `k`. O(N) inputs + compares; sound. Only for
sets small enough to fit a tx (tens-hundreds). Contends with any writer of any entry. A degenerate optimization
of B2/B1.

### F. Positive inversion (capability tokens) - parallel, sound, semantic change
Turn "prove absent from blacklist" into "prove present in an allowlist," a **positive per-holder capability**
(fail-safe, parallel). Blacklisting = revoking that holder's capability. Dodges omission and contention, but
inverts default-allow -> default-deny, and on UTXO an admin cannot unilaterally touch a holder's UTXO
(revocation needs a chokepoint - e.g. capability expiry + re-issuance, or a required co-sign).

### G. Optimistic / fraud-proof - assume-absent + challenge window
Allow the action assuming non-membership; let anyone present the omitted entry within a challenge window to
revert/slash a bond. Shifts from "prove absence up front" to "assume, punish false claims." Sound under an
honest-watcher assumption; costs delayed finality + a bonding/challenge protocol. Fits non-instant settlement.

### H. Cryptographic accumulators (RSA / class-group) - O(1) proof, impractical compute
Non-membership witnesses are O(1) size but verification needs big-number modular exponentiation. BCH bigint +
`OP_MUL` make it *possible* but expensive (many multiplications); class groups avoid trusted setup. Noted for
completeness; likely impractical vs B/C. Pairing/KZG needs pairings (not native) - out.

## 6. Decision matrix

| Access pattern | Best technique | Contention | Cost |
|---|---|---|---|
| Positive guard (balances) | none - already sound | none | O(1) |
| Consume-once, provisioned eligibility | A nullifier | none (parallel) | O(1) op, O(N) setup |
| Rarely written, read-heavy (blacklist) | B2 linked list (or B1 root-NFT) | local (or global) | O(1) / O(log N) |
| Fixed set that will never change | D baked (explicit opt-in only) | none on reads | O(1), no writes |
| Moderate writes, regional locality | B2 sorted linked list | local (predecessors) | O(1) co-spend |
| Unbounded, general, moderate contention OK | B1 indexed Merkle (root-NFT) | global (root) | O(log N) |
| Tiny set | E enumerate | all-entries | O(N) |
| Non-instant settlement OK | G optimistic | none up front | challenge window |

## 7. The irreducible corner

A set that is **frequently written, frequently read, and globally consistent** (a Tether-scale blacklist
enforced live on every transfer) has **no contention-free sound analog on UTXO** - you must relax one axis:
accept contention (mutable root), accept staleness (baked/epoch commitment), shard (bounded parallelism), or
change semantics (positive capabilities). This is not a gap in any single design; it is the UTXO model's lack of
free global consistent state - the same root cause as C2 itself.

**Compiler role:** don't ship one structure as "the fix." Detect the guard's access pattern (or take an
annotation) and require/select the matching representation - nullifier, baked filter, sorted list, or Merkle -
and error on an unsound-and-unbacked negative guard. The soundness is in matching the structure to the pattern,
not in any universal accumulator.

## 8. The sorted linked list (B2), in detail

The chosen data-native structure for negative guards under code/data separation. Concrete spec below.

### 8.1 Entry layout

Each entry is an NFT-UTXO; commitment = `pushdata(key) ++ pushdata(nextKey) [++ pushdata(value)]`.

- **Key normalization (EVM-style):** hash any key to a 32-byte slot `slot = H(key)`, exactly as the EVM derives
  `keccak256(key . p)`. The list is keyed and sorted by the 32-byte slot regardless of source type
  (address/uint256/string/bytes), so `key + nextKey` = 64 B fits the 128-byte commitment with ~61 B left for an
  inline value. Collision-resistance makes `slot` a faithful stand-in for `key` (the assumption EVM storage
  already relies on).
- **Sentinels:** `nextKey = 0` = +infinity; a reserved head entry `key = 0` anchors the low end. Empty list is
  one entry `(0, 0)`.
- **Chunked values:** for a value beyond the inline budget, the link header `(key, nextKey)` sits only on the
  entry's **head chunk**; the value's data chunks carry no header. So the link overhead is paid **once per
  entry**, amortized to ~0% for any multi-chunk value.

### 8.2 Transaction shapes  (state: `HEAD[00|10] -> A[10|50|Va] -> B[50|90|Vb] -> C[90|00|Vc]`)

```
1) INSERT k=40 (gap A: 10<40<50)        2) READ
   IN                OUT                   non-membership (absent 40)   membership (present 50)
   A [10|50|Va]  ->  A'[10|40|Va]          A[10|50|Va] -> A'[10|50|Va]  B[50|90|Vb] -> B'[50|90|Vb]
                     N [40|50|V40]         (unchanged; 10<40<50)        (unchanged; key==50 -> Vb)
   A ->50-> B  becomes  A ->40-> N ->50-> B      links: none moved            links: none moved

3) UPDATE k=50 -> Vb'                    4) DELETE k=50 (pred P=A, the node whose next==50)
   IN                OUT                   IN                OUT
   B [50|90|Vb]  ->  B'[50|90|Vb']         A [10|50|Va]  ->  A'[10|90|Va]   (next 50->90, skip B)
   links: none moved (value only)         B [50|90|Vb]  ->  (consumed)
                                          A ->50-> B ->90-> C  becomes  A ->90-> C
```
(Every write also co-spends the master for auth; a read usually rides inside a larger function tx.)

### 8.3 How links reorganize

| Op | Entries co-spent | +/- | Link change |
|---|---|---|---|
| Insert `k` | predecessor `P` (1) | +1 | `P.next: S -> k`; new `k.next = S` |
| Read absent | predecessor `P` (1, read-only) | 0 | none |
| Read present | entry `k` (1, read-only) | 0 | none |
| Update `k` | entry `k` (1) | 0 | none (value field only) |
| Delete `k` | predecessor `P` + `k` (2) | -1 | `P.next: k -> k.next` |

Links move **only on insert/delete**, each a single splice touching **only the predecessor** (`P.next`); the
new/removed node carries the other end in its own `next`, so the successor `S` is never co-spent. Reads preserve
read-only; updates rewrite only the value.

### 8.4 Singly vs doubly - singly chosen

The hot read path uses only `nextKey`, so `prevKey` adds nothing to non-membership. But doubly forces insert to
co-spend `L`+`S` (fix `S.prev`) and delete to co-spend `P`+`S`+`k` - 2-3 co-spends vs singly's 1-2 - which is
*more* contention (the thing we minimize) plus +32 B commitment. Its only benefit, O(1) predecessor location, is
moot: the covenant traverses forward only and the SDK indexes the list off-chain. Singly wins on every axis.

### 8.5 Compiling Solidity's default-read patterns

Every `m[k]` access compiles to "prove which case, then use the value": present -> membership proof (co-spend
`k`'s entry) -> real value; absent -> non-membership proof (co-spend the bracketing predecessor) -> the default.
A write is an **upsert** (insert if absent, update if present). The spender cannot lie (no non-membership proof
exists for a present key; no entry exists to co-spend for an absent one). So:

- `if (m[k] == false) { m[k] = true; }` -> absent: non-membership + insert; present(true): membership + skip. No
  revert; matches Solidity's no-op-if-set.
- `s = m[k]; s.a = "a";` (lazy struct init) -> absent: non-membership + default struct + insert; present:
  membership + real struct + update.

Only a default-value read whose value *gates an effect* pays a proof; positive reads (`balances[k]`, `>= x`)
stay free + fail-safe. The omission attack is closed because the sound covenant has **no default-on-absent
branch** - it *requires* the bracketing witness, so omitting it reverts rather than falling through to false.

### 8.6 Cost vs the present (unsound) model

- **Commitment payload:** the `nextKey` link costs `K+1` B of value budget; with a 32-B slot, inline value
  `94 -> 61` B (-35%). But **0%** for a set (blacklist - no value), and **~0%** for chunked values (header on
  head chunk only, 8.1). So it bites only single-commitment scalar-ish values in the 62-94 B band.
- **Tx size:** a negative-guard read/insert gains ~1 input + 1 output (~250-350 B, dominated by revealing the
  entry's P2SH redeem script) - vs **0** today for an absent read (which is free precisely because it is
  forgeable). ~60-90% bump on a small transfer, paid per such op.
- **Contention:** per hot-gap predecessor, and per 3 a coordination/sequencing cost (no throughput cap on BCH),
  not a per-block ceiling. Sequenced (issuer/batcher) it is block-size-limited; uncoordinated concurrent
  hot-gap access conflict-retries.
