# block.* primitives & the per-contract block oracle

Status: **IMPLEMENTED (compiler + SDK e2e, green).**
- `block.chainid` - baked single-byte network constant.
- Oracle reads `block.{number,timestamp,difficulty,size,totalFees,basefee,coinbase}`.
- Owner-update path: an immutable baked owner key (`__blockOracleOwner`) + an injected
  `__updateBlockOracle(sig, ...fields)` gated by the owner signature and the freshness/anti-over-reporting
  bound `require(tx.time >= number)`.
- Off-chain keeper: `packages/solidcash/src/oracle/blockOracleUpdater.ts` (Fulcrum
  `blockchain.headers.subscribe` + a single BCHN `getblock` verbosity-2 call: coinbase inline, fees =
  `sum(coinbase outputs) - subsidy(height)`; signed `__updateBlockOracle` when the chain is ahead).
- `blobhash(i)` -> `bytes32(0)` (no BCH blobs). `blockhash(n)`: **read codegen + hardened `(n->hash)`
  covenant + keeper minting implemented** (self-pin + self-preserving recreate + CLTV `tx.time >= n+256`
  wipe; `buildBlockhashOracleCovenantScript` / `blockhashOracleLockingBytecode` / `buildBlockhashCommitment`
  in utils/state.ts; `BlockOracleUpdater.mintBlockhashPair` / `sweepBlockhashPair`). **Full lifecycle e2e
  green:** the keeper mints `addr(n)` from the `C_oracle` master, a consumer reads it via `blockhash(n)`,
  and the keeper sweeps `addr(n-256)` when it ages out (covenant wipe at `n+256`; rejected before). The
  compiler stamps `artifact.usesBlockhash` when `blockhash()` is referenced, so the keeper auto-maintains
  the oracle. Remaining: SDK auto-discovery (consumer auto-co-spend, no manual input), a dedicated co-spend
  slot (vs the last-input convention), and `bytes32(0)`-when-absent (s11).

Implementation notes: each referenced field is desugared (`SynthesizeBlockOracle` pre-semantic transform)
to a read of an injected register of the contract's own state - `uint32` for the numeric fields, `address`
for the variable-length `coinbase` (inline, not chunked) - reusing the existing state-var read + data-NFT
machinery; `basefee` lowers to `Floor(1000 * __block_totalFees / __block_size)`. Using block.* injects the
owner key + update function and makes the contract stateful, so reads ride the master spend (isolation/
master-bind) and only the owner can refresh. Registers use the framed pushdata state encoding (not the
fixed-offset 128-byte layout sketched below) - functionally equivalent, reuses tested code. Under
`solidityImportCompat`, `block.timestamp` keeps the native `tx.locktime` mapping instead of the oracle.
Tests: `packages/solidcash/test/e2e/BlockOracle.test.ts` (chainid, reads, owner-update, keeper).

This consolidates the design discussion for
exposing Solidity-style `block.*` globals in SolidCash on the BCH UTXO substrate. Normative rules use
MUST/SHOULD. ASCII only (no em-dash / non-ascii), per repo style.

## 1. Goal & scope

Expose `block.*` with EVM-parity ergonomics (0-param reads: `block.number`, `block.timestamp`, ...)
backed by an on-chain oracle, on a chain that has **no native opcode** for height, time-as-a-value,
block hash, difficulty, coinbase, or fee.

Priority (user call):

- **v1 (this release):** `block.number`, `block.timestamp`, `block.chainid`.
- **v1.x:** `block.difficulty`, `block.coinbase`, `block.basefee`, and the two BCH-native components
  `block.size` + `block.totalFees` that `block.basefee` is derived from.
- **Next major:** concurrency fan-out (split/merge replicate-policy, section 9).

## 2. What is native vs what needs an oracle

BCH native introspection gives `tx.time` / `tx.locktime` (`OP_TXLOCKTIME`) and `this.age`
(`OP_CHECKSEQUENCEVERIFY`). From these:

- `block.number` and `block.timestamp` are obtainable as **trustless lower bounds** via `nLocktime`
  + CLTV (`require(tx.time >= K)` proves the including block's height/MTP is at least K). Two hard caveats:
  1. They are **floors, not values** - there is no "current block" at script eval (every validator may
     include the tx in a different block). Exact values are unattainable trustlessly on UTXO.
  2. `nLocktime` is one field, interpreted as **height XOR unix-time**, so a single spend can floor
     `block.number` *or* `block.timestamp`, never both.
  3. The time-mode floor tracks **MTP** (median-time-past), which lags wall-clock ~1h. So native
     `block.timestamp` is materially staler than the chain tip.
- `block.hash`, `block.difficulty` (nBits), `block.coinbase`, `block.basefee`: **no native source**.

### 2.1 The trust dichotomy (drove every decision below)

A value that is unique-and-current lives in one UTXO; co-spending it is a 1/block global lock. A value
read without contention must be replicable signed data, which is grindable. You cannot have both.

| trust model | params | concurrency | mechanism |
|---|---|---|---|
| **category-trust** (co-spend a genuine oracle-category UTXO; self-pin is the arbiter) | true 0-param | bounded (keeper/owner provisioned) | this design |
| key-trust (datasig over the data) | sig threaded (can be SDK-hidden) | unbounded | deferred (section 9) |

v1 picks **category-trust**: the oracle data lives on-chain in an NFT commitment and is co-spent;
trust is "it came from the oracle", not "someone signed it". The cost is bounded concurrency, accepted
for v1 and lifted later by split/merge.

## 3. The model: a per-contract, master-bound oracle register

The oracle is **not a shared global UTXO**. It is a register of the *consuming contract's own state*:

- **Same category as the contract's master** -> the register inherits the contract's self-pin; there is
  no separate oracle category, address, or trust surface. `block.*` data is part of `this` state.
- **The read path MUST require the contract's master to be co-spent** -> only the master-holder can
  spend the register. External parties (no master) cannot include it, so there is no shared-resource
  competition and no griefing. This is the **isolation** mechanism (same-category alone does not isolate;
  the register UTXO would otherwise be co-spendable by anyone who satisfies a permissionless read path).

### 3.1 Why this is cheap: the piggyback

A state-changing function **already spends the master**. Co-spending a master-bound oracle register in
that same tx adds **zero new contention** - the master is the only lock and it is already held. So
`block.*` *inside a state transition* is free, and the global 1/block lock of a shared oracle is gone.

Mental model: the oracle register is just a **distinguished data-NFT register** of the contract -
**owner-writable, logic-read-only**. Normal registers are written by contract logic; this one is written
by the owner's updater (section 4) and only *read* by `block.*`.

### 3.2 Read lowering (0-param)

`block.number` (etc.) lowers to: master co-spent (already true in a state transition), then
`OP_UTXOTOKENCOMMITMENT(oracleRegisterInput)` + slice the field + recreate the register read-only
(byte-identical). No operands. The artifact carries only a **hint** (the register's nftIndex / role tag);
the SDK auto-includes the register as a co-spent input + read-only output (the `addRequiredSidecars`
path).

> **Caveat - block.* is coupled to a master spend.** Free inside state-changing functions; a *pure-view*
> use (reads block.*, writes no state) would be forced to spend the master, serializing it with the
> contract's writes. For contracts that touch block.* only inside transitions this is a non-issue.

## 4. Refresh: owner duty (v1)

The register is category C (the contract's own, mint-once), so freshness is the **deployer/owner's
implied duty**:

- The register covenant has an **owner-authorized update path** (owner pubkey baked at genesis). The
  owner runs an off-chain updater that spends the register (owner sig), writes current tip data into the
  commitment, and recreates it. Mutating an existing register needs **no minting baton**, only the
  covenant-authorized path.
- The update path is owner-key-gated and does **not** require the master (the owner refreshes the oracle
  independently of contract state). The **read** path requires the master (section 3). Both spend the
  single register UTXO, so for one contract owner-update and reads are naturally sequenced by the owner.
- The owner is trusted for their own contract's data (lying hurts their own contract). Staleness is the
  owner's responsibility; it is **not script-enforceable** (section 5).

## 5. Hardening (what nLocktime can and cannot do)

`nLocktime` is a one-sided **lower** bound on the including block's height/time. Therefore:

- **Anti-over-reporting (DO emit):** `require(tx.time >= oracleHeight)` (height mode) forces
  `miningHeight >= nLocktime >= oracleHeight`, so the oracle **cannot claim a height above the real chain
  tip**. Cheap, meaningful.
- **Anti-staleness (NOT possible):** no covenant can prove a register is recent (no upper bound on mining
  height is readable). Stale data is bounded only by the owner's refresh cadence + the consumer's own
  incentive to use accurate data.
- **Adversarial floors MUST stay native.** If a spender *benefits* from a stale value (e.g. sneaking past
  a deadline with an old `block.number`), the oracle cannot stop them. The compiler SHOULD lower
  `require(block.number >= K)` / `block.timestamp >= K` to a trustless native `require(tx.time >= K)`,
  using the oracle register only for non-comparison uses (assignment, arithmetic). This gives 0-param
  ergonomics *and* keeps deadline checks trustless.
- **Domain separation / versioning:** prefix the commitment with a 1-byte format version; if an owner
  datasig is ever stored (audit), sign `H(oracleId || "block" || fields)` so it cannot be replayed in
  another context.

## 6. block.* property table

Use **minimal-width bounded types** (`uintN` = `IntType(false, bits)`, already in the language), NOT the
`uint`/`int` aliases - those are `uint256`/`int256`, far too wide to encode this data. Solidity types
these `uint256` because EVM is 256-bit and wei is 1e-18; on BCH the values are small and money is 1e-8
(satoshi). Widths below are sized against real mainnet block 956830 (the sizing reference):

| prop | prio | source | type | commitment | value @ 956830 | notes |
|---|---|---|---|---|---|---|
| `block.number` | 1 | oracle (+ native floor) | `uint32` | 4 B | 956830 | ~80,000 yrs of headroom; `>= K` lowers to native floor (section 5) |
| `block.timestamp` | 1 | oracle (+ native floor) | `uint32` | 4 B | 1782384635 | BCH header nTime IS uint32 (to 2106); oracle beats ~1h MTP lag |
| `block.chainid` | 1 (DONE) | **baked constant** | `bytes1` | none | - | one byte `chainId & 0xff`, compared bytewise; no oracle/co-spend |
| `block.difficulty` | 2 | oracle | `uint32` | 4 B | 0x18026c88 | **raw nBits**; decoded difficulty (453596304365.59) is fractional, so nBits is the honest integer; NOT randomness |
| `block.coinbase` | 2 | oracle | `address` | 1 + ~25 B | 76a914..88ac | **full locking bytecode** of coinbase output 0 (p2pkh = 25 B here); variable, length-prefixed |
| `block.size` | 2 | oracle | `uint32` | 4 B | 9075 | block size in bytes; uint32 covers ~4 GB blocks (BCH-native, not a Solidity global) |
| `block.totalFees` | 2 | oracle | `uint32` | 4 B | 31792 | sum of tx fees in sats; uint32 ceiling 42.9 BCH >> any real block (uint64 if more headroom wanted) |
| `block.basefee` | 2 | **derived** | `uint32` | none | 3503 | `Floor(1000 * block.totalFees / block.size)` = sat/KB; computed at read, VM intermediate is unbounded so no overflow |

Notes:
- `block.basefee` is **not stored**; it is computed from the encoded `block.size` + `block.totalFees`, so
  it always matches the formula and is auditable on-chain. There is **no consensus base fee** on BCH -
  this is the realized fee rate of the block, sat/KB, for Solidity portability.
- `block.chainid` is **implemented**: a compile-time constant baked as a single byte from the
  `chainId` compiler option (default 0), typed `bytes1` and compared bytewise (e.g.
  `require(block.chainid == 0xff)`). It needs none of the oracle infra. User-land convention:

  | network | chainId option | baked byte | script |
  |---|---|---|---|
  | mainnet | `0` | `0x00` | `OP_PUSHBYTES_1 0x00` |
  | chipnet | `1` | `0x01` | `OP_1` |
  | testnet4 | `2` | `0x02` | `OP_2` |
  | regtest | `-1` | `0xff` | `OP_PUSHBYTES_1 0xff` |

  `-1` is encoded as the byte `0xff` (`chainId & 0xff`); values 1-16 minimal-opcode to `OP_1..OP_16`
  (same on-stack byte). All four are minimal/standard pushes.
- `block.size` / `block.totalFees` are **BCH-native extensions** (Solidity has neither); they are encoded
  because `block.basefee` needs them and they are independently useful.

## 7. Commitment layout (128-byte limit, already the SolidCash default)

`commitmentLimit` is 128 (`compiler.ts`), so a register holds the whole payload. Fixed-width sized-int
fields at fixed offsets, the variable `coinbase` length-prefixed as a tail, optional owner datasig last:

```
version(1) | number(4) | timestamp(4) | [nBits(4) | size(4) | totalFees(4) | coinbaseLen(1) | coinbase(~25)] | [ownerSig(64)]
```

`block.basefee` is derived (not stored); `block.chainid` is baked (not stored). v1 (number + timestamp)
is 9 bytes; tier-2 fields append behind the version byte without restructuring. Full tier-2 with coinbase
is ~47 bytes, and even with a 64-byte audit sig the total is ~111 B, under 128.

## 8. Compiler / SDK integration

- `block.*` is a builtin namespace. Referencing it sets `usesBlockOracle` on the function (mirrors
  `usedLibraries`), drives the read lowering, and emits an artifact hint (the register role/nftIndex).
- `block.chainid` lowers to a pushed constant (per `--network`); no register, no co-spend.
- SDK: when a co-spent contract input uses block.*, auto-include its oracle register as a co-spent input
  + read-only output (the `addRequiredSidecars` mechanism), and apply the section-5 native floor.
- Codegen MUST tag the oracle register distinctly (the commitment-preamble nftIndex tag) so a `block.*`
  read is never confused with a state-register read, and the owner-update path is never confused with a
  logic write.

## 9. Deferred / future

- **Concurrency fan-out (next major):** lift the single-register 1/block serialization with the
  **split/merge replicate-policy** - the read-dual of the existing disjoint-partition write policy. Today
  `ThreadManager.split` partitions data-NFT indices **disjoint** (write concurrency, non-overlap
  invariant) and divides sats by **sum**. Reads need a third policy: **replicate** a read-only register
  into every thread (overlap), sound precisely because read-only copies cannot diverge, with merge =
  `OP_EQUALVERIFY` the copies equal then collapse. The oracle is the all-replicated special case. No
  change to the `block.*` surface.
- **Trust-minimized foreign update (docs note, design for forward-compat NOW):** v1's update authority is
  a single owner key. Structure the register's update authorization as a **pluggable policy** (committed
  in the register, or an additive covenant branch) so it can grow to
  `owner-key OR valid-keeper-datasig OR copy-from-shared-canonical-oracle` **without a breaking change**.
  Goal: an external service (e.g. project-run) can later refresh **any** contract's register
  permissionlessly, with the *relayer* untrusted and only the *data* required to be authentic -
  - **relayed keeper datasig:** anyone pushes the update, the covenant verifies a well-known keeper sig
    over the tip (trust = the signer, relay is permissionless); or
  - **shared-source copy:** anyone refreshes by co-spending a shared canonical oracle read-only and
    copying its (category-trusted) data in.
  Both ride the section-5 anti-over-reporting check. Keeping v1's owner-key path as one policy among these
  is the only forward-compat requirement.
- **block.hash / blockhash(n) / blobhash(i):** specced in section 11 (per-pair n->hash oracle), pending
  implementation. `prevrandao` has no BCH analogue (no randomness beacon); not planned.
- **Signer decentralization:** if the trust-minimized path adopts datasig, the single key is the seam to
  a committee / m-of-n later (bake a key-commitment/Merkle root, not a literal key, to keep it
  non-breaking).

## 10. Decisions

- **`block.coinbase`** = the full locking bytecode of coinbase output 0, typed `address`
  (variable, length-prefixed). RESOLVED.
- **`block.basefee`** = `Floor(1000 * block.totalFees / block.size)` (sat/KB), derived on-chain from the
  encoded `block.size` + `block.totalFees`. RESOLVED.
- **Types** = minimal-width `uintN` per component (section 6), never the `uint`/`int` 256-bit aliases.
  RESOLVED.

Still open:

- **Comparison lowering:** auto-lower `block.number/timestamp >= K` to native `tx.time` floors
  (recommended, section 5) vs strictly everything through the co-spent register.
- **`block.totalFees` width:** `uint32` (4 B, 42.9 BCH ceiling - minimal viable) vs `uint64` (8 B,
  bulletproof). Default `uint32`.

## 11. blockhash(n) and blobhash(i)

Status: **blobhash IMPLEMENTED; blockhash IMPLEMENTED (hardened covenant + keeper mint/sweep).**
`blobhash(i) == bytes32(0)`. `blockhash(n)` reads the co-spent `(n->hash)` UTXO (last-input MVP
convention) and verifies `OP_UTXOTOKENCATEGORY == blockhashOracleCategory` (compiler option) +
`commitment.n == n` + `require(tx.time >= n)`, returning the 32-byte hash. The hardened `(n->hash)`
covenant (self-pin + self-preserving recreate + CLTV `n+256` wipe), the keeper mint + sweep
(`BlockOracleUpdater.mintBlockhashPair` / `sweepBlockhashPair` / `maintainBlockhashWindow`), and the
`artifact.usesBlockhash` marker are all in place and e2e-green. **Remaining:** SDK auto-discovery (the
consumer auto-resolves + co-spends `addr(n)`, no manual input), a dedicated co-spend slot (vs the
last-input convention), and `bytes32(0)` when the SDK finds no live UTXO.


These are **functions** (runtime argument), not the 0-param `block.*` properties, so they lower as
`GlobalFunction`s (the keccak256 path is the template), not nullary register reads.

### 11.1 blobhash(uint) -> bytes32: return zero

EIP-4844 blobs (KZG-committed sidecar data on a blob-carrying tx) have **no BCH analogue**. EVM returns
`0` for `i >= numBlobs`; on BCH `numBlobs == 0`, so `blobhash(i) == bytes32(0)` for all `i` - a porting
shim so Solidity that references it compiles and runs. Codegen: drop the arg, push 32 zero bytes.
(Optional compile warning that blobs do not exist on BCH.) An `OP_RETURN`-data reinterpretation is
rejected - it silently changes Solidity semantics.

### 11.2 blockhash(uint n) -> bytes32: the per-pair (n -> hash) oracle

`block.hash` of the *current* block is just a `bytes32` register field (co-spend, owner-updated, like the
other block.* fields), so `blockhash(block.number)` resolves locally. The hard part is historical `n`,
which the single current-block register cannot hold. Design (category-trust, no datasig):

**The `(n -> hash)` UTXO.** One per block, under a project-global oracle token category `C_oracle`:
- **Unique address `addr(n)`** (a deterministic function of `n`) - so the SDK/Fulcrum looks it up by exact
  scripthash, returning *one* UTXO, no grind-and-filter over a shared address. The contract does **not**
  recompute `addr(n)`, so the address carries no in-script inline-bytecode-match burden; only the keeper
  (mint) and SDK (discovery) derive it.
- **Commitment `(n, hash)`** - this is the contract's on-chain pin: the consumer checks `commitment.n == n`.
- **Covenant: three paths** - (1) keeper genesis under `C_oracle`; (2) **read = self-preserving recreate**
  (read-only, self-pins `category == C_oracle`); (3) **wipe** = anyone may consume once
  `tx.time >= n + 256` (height floor). Bounded 256-deep window (EVM parity), dust recycled on wipe,
  cleanup permissionless so the set stays bounded even if the keeper stalls.

**The consumer (`blockhash(n)`) is stateless** - an external read of `C_oracle`: co-spend the `(n->hash)`
UTXO read-only, check `OP_UTXOTOKENCATEGORY(in) == C_oracle` (mint-once = keeper, the trust anchor) +
`commitment.n == n`, return `hash`. No per-contract register, no merkle proof. Emit
`require(tx.time >= n)` (no-future bound). If the SDK finds no live UTXO at `addr(n)` (outside the window
or unpublished), yield `bytes32(0)` (EVM parity), no revert.

**Why category + commitment, not the address:** unique `addr(n)` is the off-chain *indexer* key;
`commitment.n` is the on-chain *contract* pin; `C_oracle` (self-pin, mint-once) is the *trust*. They are
complementary - the unique address costs nothing in-script.

**Keeper (the updater).** On each new tip `n`: mint `addr(n)` carrying `(n, hash)` under `C_oracle`, and
sweep `addr(n - 256)`. This is `BlockOracleUpdater.maintainBlockhashWindow` (mint via `mintBlockhashPair`,
best-effort wipe via `sweepBlockhashPair`), gated on `usesBlockhash(artifact)` and signed by the keeper key.
Sweeping is a dust-reclaim convenience: the covenant's `tx.time >= n+256` path lets anyone wipe, so the
window stays bounded even if the keeper stalls.

**Grinding caveat (unchanged):** the tx-builder picks `n`, so `uint(blockhash(n)) % k` randomness is
grindable - worse than EVM. Legitimate commit-reveal must **pin `n`** (committed in a prior tx). A compiler
warning when `blockhash(...)` feeds modulo/arithmetic is advisable.

### 11.3 Open decision: public primitive vs keeper-gated

- **Public primitive (recommended):** reads are **permissionless self-serve**; integrity comes from
  self-pin + self-preserve; reads are contention-free because they partition by `n`. No keeper on the read
  path. This is the right model if `blockhash` is a language primitive any contract may call.
- **Keeper-gated (project-private):** require `C_oracle`'s **master (minting NFT)** co-spent in every read.
  This excludes alien consumers, but (a) re-creates the single-master **global lock** the per-pair design
  exists to avoid - so it needs **master fan-out** (the deferred split mechanism) to keep throughput - and
  (b) for the gate to actually exclude aliens the master spend must be keeper-signed, putting the keeper on
  the read path. Integrity does **not** need this (self-pin already gives it); the gate only buys access
  control. Pick this only for a deliberately private oracle, and pull master fan-out into v1.

### 11.4 Alternatives (recorded)

- **Merkle root** (per-contract register holds a 32-byte root of a `(height->hash)` tree; caller supplies a
  proof): contention-free even for a hot recent `n`, but every blockhash-using contract carries a register
  + in-script proof verification. Use if you expect heavy concurrent reads of the *same* recent `n`.
- **Datasig** (keeper signs `(n, hash)`, caller supplies `(hash, sig)`, contract `OP_CHECKDATASIG`): any
  `n`, no storage, no shared UTXO - but key-trust, and it allows permissionless bootstrap (no keeper
  liveness on the read path). The escape if you ever want consumer-bootstrapped pairs.

### 11.5 Compiler / SDK integration

- Register `blockhash`/`blobhash` as `GlobalFunction`s, signature `(uint) -> bytes32`. `blobhash` -> push
  `bytes32(0)`. `blockhash` -> external read of `C_oracle` (category + `commitment.n` check) + the
  `tx.time >= n` floor; `0` outside the window.
- Artifact `usesBlockhash` marker (DONE): `SynthesizeBlockOracle` detects `blockhash()` and the compiler
  stamps `artifact.usesBlockhash`, driving `BlockOracleUpdater.usesBlockhash(artifact)` so the keeper
  auto-maintains the oracle.
- SDK: resolve `n` (call-site arg / VM trace), look up `addr(n)` on Fulcrum, co-spend the `(n->hash)` UTXO
  read-only (+ recreate); the VM is the arbiter, so a wrong injection fails the category/`n` check.
