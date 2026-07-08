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

Consequence: a ~1 KB proof + ~tens of hashes is ~1% of a tx and well inside the budget. **Compute is never the
binding constraint** - the constraints are transaction *size* (for co-spend-all) and, decisively, *contention*.

## 3. The contention wall (the real constraint)

Two facts kill any single-global-commitment design:

1. **A set has exactly one root -> it can't be threaded.** SolidCash gets parallel writes by threading the
   master into K independent thread-UTXOs. One root would be mutated by all K threads and the roots would
   diverge (unsound). So a global root forfeits the very mechanism that gives parallel writes.
2. **Reading a committed value = spending its UTXO.** Introspection sees only the current tx's inputs, so to
   read a root the tx must co-spend the root's UTXO. A blacklist read by *every* transfer then serializes *all
   transfers* through one hot UTXO - worse than write contention.

**Corollary (the fundamental limit):** on UTXO, **contention-free sound reads require the commitment to live in
the covenant code (baked), not in a UTXO** - because any committed UTXO must be spent to be read. Therefore:

- read-heavy sound flags -> bake the commitment (writes become rare covenant upgrades);
- write-heavy sound sets -> per-UTXO structures (parallel writes, but reads spend);
- you cannot have contention-free reads *and* contention-free frequent writes for one globally-consistent sound
  set. That corner is a property of the UTXO model, the same "no free global state" fact that created C2.

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

### B1. Indexed / sparse Merkle tree - global root
Covered (section 4). O(log N), general (unbounded/lazy/persistent), but global-root contention.

### B2. Sorted linked list of entry-UTXOs - **no global root** *(localizes contention)*
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

### C. Approximate membership (Bloom / cuckoo) - **sound non-existence, cheap, bakeable**
A Bloom filter has **no false negatives**: if any of `k`'s hash-bit positions is 0, `k` was never added ->
**definitely absent**. So a non-membership proof is: reveal one position `p = hash_i(k)` with `filter[p] == 0`;
the covenant checks `p` is a valid hash position of `k` and the bit is 0. O(1), a couple of hashes.
- False *positives* (all bits set for an absent `k`) cause **over-rejection** - fail-closed for a blacklist
  (a legit user occasionally blocked), tunable by filter size.
- Bloom is **add-only** (can't clear bits); use a **cuckoo filter** if deletion is needed.
- **Small/medium sets: bake the filter as a covenant constant** -> free parallel reads + sound non-membership +
  rare upgrade-writes. Ideal for the real blacklist (rare writes, read-heavy). Large filters (~MB) exceed
  script size -> commit `hash(filter)` and reveal the relevant word + a Merkle path (reduces to B1).

### D. Baked constant set / root - free parallel reads, upgrade writes
For rarely-written read-heavy sets, put the commitment (a small explicit list, a Bloom filter, or a Merkle root)
**in the covenant code**. Reads are free and fully parallel (nothing to spend). A change is a covenant
**upgrade**. Caveat: UTXOs on the old covenant keep the old commitment until they migrate - **staleness lag
replaces contention** (UTXO can't do EVM's instant global flip). This is the only contention-free-read option
(section 3 corollary).

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
| Rarely written, read-heavy (blacklist) | D baked (Bloom/list/root) | none on reads | O(1), upgrade-writes |
| Removable rare-write read-heavy | D baked cuckoo filter | none on reads | O(1), upgrade-writes |
| Moderate writes, regional locality | B2 sorted linked list | local (predecessors) | O(1) co-spend |
| Unbounded, general, moderate contention OK | B1 indexed Merkle | global (root) | O(log N) |
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
