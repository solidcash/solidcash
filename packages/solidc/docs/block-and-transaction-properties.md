# Block and Transaction Properties (`block.*` / `tx.*`) on BCH

Solidity's "Block and Transaction Properties" - the `block.*` and `tx.*` globals - mapped onto the BCH UTXO
substrate. The transaction-local ones (`tx.gasprice`, `block.prevrandao`) and the gas/blob shims are pure
introspection or constants; the block-level values that have no VM source are served by a **per-contract,
master-bound oracle** (the bulk of this document).

Status: **IMPLEMENTED (compiler + SDK e2e, green).**
- `block.chainid` - baked single-byte network constant.
- Oracle reads `block.{number,timestamp,difficulty,size,totalFees,basefee,coinbase}`; `block.blobbasefee`
  aliases `block.basefee` (no EIP-4844 blobs on BCH; compiler warns). `block.gaslimit` + `gasleft()` are
  fixed shims (`1000000`, no gas metering on BCH; compiler warns). `block.prevrandao` is a transaction-local
  shim (`abs(int(sha256(input[0] prevout txid)))`, no oracle; grindable; compiler warns).
- `tx.gasprice` - the current transaction's realized fee rate, `1000*(sum in - sum out)/tx_size` sat/KB,
  reconstructed from introspection (no oracle; tx_size estimated since there is no `OP_TXSIZE`). See s12.
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
  the oracle. **Auto-injection is wired:** the compiler tags `abi.blockhashReads` (the param feeding `n`)
  and `TransactionBuilder.send()` reads the call arg, resolves `addr(n)`, and co-spends the `(n->hash)`
  UTXO + self-preserving recreate automatically - `blockhash(n)` needs no manual wiring (the
  `resolveBlockhashCoSpend` helper remains for computed/multiple `n`). Absent reads **error by design**
  (not EVM's `bytes32(0)`): on BCH the tx-builder controls inputs, so returning `0` when the oracle is not
  co-spent would let a malicious builder force `blockhash(n) == 0` for an in-window block; erroring keeps a
  contract from ever seeing a forged `0` (s11.2). **Composition-safe slot (done):** the reader no longer
  assumes the last input (wrong under cross-contract composition - the last input belongs to whoever the
  builder appended last). The compiler injects a hidden `__internal__blockhashInputIndex` param and reads
  `input[that]`; the SDK fills it by locating the `C_oracle` co-spend, so the UTXO may sit at any index. The
  VM re-verifies category + `commitment.n`, so a wrong index just fails. **Multiple `n` (done):** each
  reader resolves its own co-spend by `commitment.n`, and `addRequiredBlockhashCoSpends` auto-injects every
  distinct `n`; coexists with a keccak side-car (the reader uses its index param, the keccak loader the last
  input). **Stateful readers (done):** a stateful function reads `blockhash(n)` via a `blockhashOracle`
  block-layout slot - the co-spend rides the slot, the index param is filled deterministically (master input
  index + slot offset), the auto-derivation probes co-spend it too, and the SDK auto-sets the locktime so
  the CLTV passes in both the probe and the final tx.

Implementation notes: each referenced field is desugared (`SynthesizeBlockOracle` pre-semantic transform)
to a read of an injected register of the contract's own state - `uint32` for the numeric fields, `address`
for the variable-length `coinbase` (inline, not chunked) - reusing the existing state-var read + data-NFT
machinery; `basefee` lowers to `Floor(1000 * __block_totalFees / __block_size)`. Using block.* injects the
owner key + update function and makes the contract stateful, so reads ride the master spend (isolation/
master-bind) and only the owner can refresh. Registers use the framed pushdata state encoding (not the
fixed-offset 128-byte layout sketched below) - functionally equivalent, reuses tested code. Under
`solidityImportCompat`, `block.timestamp` keeps the native `tx.locktime` mapping instead of the oracle.
Tests: `packages/solidcash/test/e2e/BlockOracle.test.ts` (chainid, reads, owner-update, keeper).

This consolidates the design discussion for exposing Solidity-style block and transaction properties
(`block.*`, `tx.*`) in SolidCash on the BCH UTXO substrate. The transaction-local properties are covered in
sections 11-12 (`blockhash`/`blobhash`, `tx.gasprice`) and the per-field table (s6); the rest of the
document is the oracle that backs the block-level reads. Normative rules use MUST/SHOULD. ASCII only (no
em-dash / non-ascii), per repo style.

## 1. Goal & scope

Expose Solidity's block and transaction properties (`block.*`, `tx.*`) with EVM-parity ergonomics (0-param
reads: `block.number`, `block.timestamp`, `tx.gasprice`, ...) on a chain that has **no native opcode** for
height, time-as-a-value, gas, the block hash, difficulty, coinbase, or fee. The block-level values are
backed by an on-chain oracle (the bulk of this document); the transaction-local ones (`tx.gasprice`,
`block.prevrandao`) and the gas/blob shims are pure introspection or constants and need no oracle.

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
| `block.blobbasefee` | 2 | **alias** | `uint32` | none | 3503 | EVM EIP-4844 blob base fee; no BCH analogue. Aliases `block.basefee` (NOT 0, which would zero out / divide-by-zero downstream); the compiler warns it is not a true blob fee |

Notes:
- `block.basefee` is **not stored**; it is computed from the encoded `block.size` + `block.totalFees`, so
  it always matches the formula and is auditable on-chain. There is **no consensus base fee** on BCH -
  this is the realized fee rate of the block, sat/KB, for Solidity portability.
- `block.blobbasefee` is an **alias** of `block.basefee` (identical bytecode). BCH has no EIP-4844 blobs, so
  there is no real blob base fee; it aliases the base fee rather than returning `0` (which would silently
  zero out multiplications or divide-by-zero in ported code). The compiler emits a one-time warning that it
  is not a true blob base fee. Do not rely on its value as blob-specific.
- `block.gaslimit` (`uint`) and `gasleft()` (`uint256`) are **fixed shims**: BCH has no gas metering, so both
  lower to the constant `1000000` (no oracle state - a pure literal, like `block.chainid`). A constant rather
  than `0` or a revert so that ported gas-budget checks (`require(gasleft() >= X)`, `block.gaslimit`
  comparisons) keep running. The compiler emits a one-time warning for each that it is a meaningless shim. Do
  not rely on the value. (`gasleft()` is desugared pre-semantically, so it never reaches the function
  registry; `block.gaslimit` is a `NullaryOp` token.)
- `block.prevrandao` (`uint256`) is a **transaction-local randomness shim** - it needs **no oracle, no
  co-spend, no state**, unlike the other introspected fields. BCH has no VM randomness opcode and no
  consensus beacon, so it lowers in-line to `abs(int(sha256(input[0] prevout txid)))`:
  `OP_0 OP_OUTPOINTTXHASH OP_SHA256 OP_BIN2NUM OP_ABS`. Choices: `input[0]` (one value for the whole tx,
  identical across every contract spent in it); `sha256` (the prevout txid is already a hash, but mixing
  decouples it from the displayed txid); `OP_ABS` (a 32-byte `BIN2NUM` is sign-interpreted, so ABS yields a
  non-negative `uint` and `prevrandao % N` behaves). **It is not secure randomness** and the compiler warns
  once: the tx-builder picks which UTXO sits at `input[0]`, so it fully controls (grinds) the value, and if a
  covenant pins `input[0]` to its own UTXO the value is constant per contract instance. For real randomness
  use commit-reveal or a `checkDataSig` oracle. (A multi-input hash mix is possible for more entropy but is
  equally grindable, since the builder picks every input.)
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

Status: **blobhash IMPLEMENTED; blockhash IMPLEMENTED (branded oracle + hardened covenant + keeper
mint/sweep).** `blobhash(i) == bytes32(0)`. `blockhash(n)` rides the master-bound oracle model (section 3):
its `(n->hash)` register is **branded to the consuming contract's OWN category**, so using `blockhash`
**forces the contract stateful** (`ContractNode.usesBlockhash` -> `isStateful` + a `stateLayout`; a branded
oracle needs a master/category to anchor and co-spend). The covenant verifies the co-spent `(n->hash)`
NFT's category BASE `== the master's` (`emitVerifyCatBaseEqMaster`, via `OP_INPUTINDEX`), NOT a baked
category, plus `commitment.n == n` + `require(tx.time >= n)`, returning the 32-byte hash. Consequences:

- **`blockhashOracleCategory` is REMOVED as a compiler option** (and dropped from artifact serialization).
  No deploy-time oracle-category config: the reader knows its oracle's category because it IS its own.
- The read path is supported **only through `StatefulContract`**: the co-spend rides a `blockhashOracle`
  block-layout slot (index = master input index + slot offset), resolved by `StatefulContract` from
  `this.categoryId`; the derivation probe co-spends it and the SDK auto-sets the CLTV locktime. The base
  `Contract`/`TransactionBuilder` path fails loudly ("build the call via StatefulContract").
- The keeper mints/sweeps `(n->hash)` NFTs **under the contract's own category**
  (`BlockOracleUpdater.mintBlockhashPair` / `sweepBlockhashPair` / `maintainBlockhashWindow`), from a
  minting baton of that category.

The hardened `(n->hash)` covenant (self-pin + self-preserving recreate + CLTV `n+256` wipe), the
`artifact.usesBlockhash` marker + `abi.blockhashReads`, and keccak side-car coexistence are in place and
e2e-green. Absent reads error by design (s11.2), not EVM's `bytes32(0)`. **`blockhash(n)` is
feature-complete** for stateful readers, including:

- **Multiple distinct reads per tx** - each distinct `n` rides its OWN consecutive `blockhashOracle`
  block-layout slot (the k-th read reads `input[base + k]`; `blockhashSlotCount` on the fn drives the slot
  allocation, codegen adds the read ordinal, the SDK co-spends 1:1 with `blockhashReads`). A direct-identifier
  `n` read twice shares one slot (deduped by param name).
- **Computed `n` - ANY expression** (`block.number - K`, `x - 1`, arbitrary arithmetic), resolved by the
  **single source of truth**: the auto-derivation probe. The covenant computes `n` on-stack (whatever the
  expression), so the SDK does NOT re-derive it in JS - it reads `n` straight off the probe trace. Codegen
  records each computed call site as a per-call-site `<computed:i>` key (its own slot); at build time the SDK
  runs a minimal covenant probe (master + data NFTs + already-resolved lower reads, max-height locktime) and
  extracts `(inputIndex, n)` at the read's `OP_UTXOTOKENCATEGORY` (stack `[n, idx, idx]`; `idx` in the
  reserved slot range identifies it). Reads resolve strictly in slot order so the probe reaches each computed
  read in turn (`extractBlockhashReadsFromTrace` + `_resolveBlockhashCoSpends` in the SDK). `block.number - K`
  is just one such expression - its `__block_number` register is co-spent as normal state, so the register and
  the oracle ride the same tx. `blockhash(block.number)` (K=0, the current block) stays unavailable (no oracle
  pair; EVM returns 0). (Limitation: a function that co-spends other inputs - entries, external-call targets -
  *before* the blockhash read would abort the extraction probe early; blockhash composed with those is future
  work.)


These are **functions** (runtime argument), not the 0-param `block.*` properties, so they lower as
`GlobalFunction`s (the keccak256 path is the template), not nullary register reads.

### 11.1 blobhash(uint) -> bytes32: return zero

EIP-4844 blobs (KZG-committed sidecar data on a blob-carrying tx) have **no BCH analogue**. EVM returns
`0` for `i >= numBlobs`; on BCH `numBlobs == 0`, so `blobhash(i) == bytes32(0)` for all `i` - a porting
shim so Solidity that references it compiles and runs. Codegen: drop the arg, push 32 zero bytes.
(Optional compile warning that blobs do not exist on BCH.) An `OP_RETURN`-data reinterpretation is
rejected - it silently changes Solidity semantics.

### 11.2 blockhash(uint n) -> bytes32: the per-pair (n -> hash) oracle

The current block's own hash is unavailable on-chain (the block is not yet mined; EVM's
`blockhash(block.number)` is 0), so there is no current-block register - every real use is historical.
The hard part is historical `n`, which no single register can hold. Design (category-trust, no datasig):
the `(n->hash)` oracle below. A computed `n` (`block.number - K`, arbitrary arithmetic) is resolved at build
time by the SDK extracting it from the auto-derivation probe trace - the covenant's own on-stack computation,
single source of truth (s11, "Computed `n` - ANY expression"); the oracle serves the resulting `n`.

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
`require(tx.time >= n)` (no-future bound).

**Absent reads error, not `bytes32(0)`.** If the SDK finds no live UTXO at `addr(n)` (outside the window
or unpublished), it errors rather than yielding EVM's `bytes32(0)`. On BCH the tx-builder controls the
inputs, so a "return `0` when the oracle is not co-spent" rule would let a malicious builder force
`blockhash(n) == 0` for an **in-window** block by simply omitting the co-spend - a forgeable read EVM does
not have (there the node supplies the hash). Erroring keeps a contract from ever seeing a forged `0`. A
contract that wants the EVM "too old -> 0" branch checks the window itself (`block.number - n` against the
256 bound) instead of trusting a `0`.

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

> **Superseded (branded re-architecture).** The bullets below describe the original *stateless*
> auto-injection model (a separate oracle category passed as `blockhashOracleCategory`, co-spend appended by
> the base `TransactionBuilder`). That is no longer how it works: `blockhash` now brands its `(n->hash)`
> oracle to the contract's OWN category, forces the reader stateful, drops the `blockhashOracleCategory`
> option entirely, and resolves the co-spend through `StatefulContract` at a block-layout slot (see the
> section 11 status above and section 3). `resolveBlockhashCoSpend` remains only as an internal lookup helper.
> The historical notes are kept for context.

- Register `blockhash`/`blobhash` as `GlobalFunction`s, signature `(uint) -> bytes32`. `blobhash` -> push
  `bytes32(0)`. `blockhash` -> external read of `C_oracle` (category + `commitment.n` check) + the
  `tx.time >= n` floor; `0` outside the window.
- Artifact `usesBlockhash` marker (DONE): `SynthesizeBlockOracle` detects `blockhash()` and the compiler
  stamps `artifact.usesBlockhash`, driving `BlockOracleUpdater.usesBlockhash(artifact)` so the keeper
  auto-maintains the oracle.
- SDK co-spend resolver (DONE): `resolveBlockhashCoSpend(provider, category, n)` looks up `addr(n)` and
  returns the `(utxo, read-flag unlocker, self-preserving recreate, locktime)` the consumer wires (or null
  outside the window). The VM is the arbiter, so a wrong injection fails the category/`n` check.
- SDK auto-injection (DONE): the compiler tags `abi.blockhashReads` (the param feeding `n`, recorded in
  codegen for a direct-identifier arg); `TransactionBuilder.addRequiredBlockhashCoSpends()` (auto-invoked by
  `send()` before sidecars) reads that arg, calls `resolveBlockhashCoSpend`, and appends the `(n->hash)`
  input + recreate at the matching index, bumping `tx.time` to `n`. `blockhashOracleCategory` is persisted
  in `artifact.compiler.options` for the lookup. The VM is the arbiter, so a wrong injection fails the
  category/`n` check.
- Absent read = error (DECIDED, s11.2): the resolver/builder errors when no UTXO exists at `addr(n)` rather
  than returning EVM's `bytes32(0)`, since on BCH a builder could otherwise force a `0` read by omitting the
  co-spend. No EVM-parity `0` branch.
- Composition-safe co-spend slot (DONE): the reader no longer uses `OP_TXINPUTCOUNT OP_1SUB` (the last input
  belongs to whoever the builder appended last, breaking cross-contract composition). `SynthesizeBlockOracle`
  flags blockhash functions; SymbolTable injects a hidden `__internal__blockhashInputIndex` BIGINT param
  (after validating user params - it uses the reserved prefix, like `_externalCallInputBase`); codegen reads
  `input[that]`. `Contract.createUnlocker` fills it by locating the `C_oracle` co-spend in `sourceOutputs`,
  and accepts either the visible-arg list (stateless, SDK fills internals) or the full list (stateful
  orchestrator). The covenant (`output[INPUTINDEX] == input`) is unchanged; the VM re-verifies, so a wrong
  index just fails.
- Multiple `n` + side-car coexistence (DONE): the fill matches its co-spend on `commitment.n` (the reader's
  `n` from `blockhashReads`), `addRequiredBlockhashCoSpends` auto-injects every distinct `n`, and the keccak
  side-car guard is dropped (the reader uses its index param; the keccak loader uses the last input).
- Stateful readers (DONE): a `blockhashOracle` block-layout slot (computeBlockLayout, after readOnlyDataNft)
  holds the co-spend, so the stateful tx assembly places input + self-preserving recreate at the same index
  and the index param is filled deterministically (master input index + slot offset). The auto-derivation
  probes co-spend it (`_deriveFullTransactionState` via the stb that carries the slot; `_deriveCommitments`
  via an explicit probe input + recreate), and the SDK auto-sets the tx locktime to `max(n)` so the
  `require(tx.time >= n)` CLTV passes in both the probe and the final tx (the probe otherwise ran at locktime
  0 and derived wrong state). `blockhash(n)` is feature-complete.

## 12. tx.gasprice - the current transaction's fee rate

Status: **IMPLEMENTED**, no oracle. `tx.gasprice` (`uint`, same nominal type as `block.basefee`) is the
*current* transaction's realized fee rate in **satoshis per kilobyte**:

```
tx.gasprice = 1000 * (sum of input satoshis - sum of output satoshis) / tx_size
            = 1000 * fee / tx_size
```

It is the EVM `tx.gasprice` reinterpreted for BCH: the sender's chosen price, here expressed as a sat/KB fee
rate (mirroring how `block.basefee` reinterprets the base fee). Unlike the oracle-backed `block.*` fields,
**everything is the current transaction**, so it needs no oracle, no co-spend, and no state - it is lowered
inline from native introspection.

### 12.1 The fee (easy)

`fee = Σ inputs OP_UTXOVALUE(i) - Σ outputs OP_OUTPUTVALUE(j)` - the satoshi value that enters minus what
leaves (tokens are separate, so this is the real sat fee). Each sum is an `OP_BEGIN`/`OP_UNTIL` loop over
`OP_TXINPUTCOUNT` / `OP_TXOUTPUTCOUNT` accumulating the per-element value.

### 12.2 The size (the only real work)

There is **no `OP_TXSIZE` opcode**, so the serialized byte size is reconstructed from introspection:

```
tx_size = header                                  (10 = 4 version + 4 locktime + 2 one-byte count varints)
        + Σ inputs  [ 41 + len(unlocking_i) ]     (41 = 32 outpoint txid + 4 vout + 4 sequence + 1 length varint)
        + Σ outputs [ 9  + len(locking_j)   ]      (9  = 8 value + 1 length varint)
```

`len(unlocking_i) = OP_SIZE(OP_INPUTBYTECODE(i))`, `len(locking_j) = OP_SIZE(OP_OUTPUTBYTECODE(j))`, summed
in two more loops; the fixed `41*nIn`, `9*nOut`, `10` overheads are added with `OP_TXINPUTCOUNT` /
`OP_TXOUTPUTCOUNT` outside the loops.

**Estimate, not exact:** the script-length prefix is a Bitcoin **varint** - 1 byte for scripts <= 252 B, 3
for larger. We assume 1 byte. Contract unlocking scripts (sig + redeem) routinely exceed 252 B, so each such
script is undercounted by 2 bytes; for a fee *rate* that is negligible (<1% on a typical tx), which is why
this is `tx_size` as an estimate. The count varints (`nIn`/`nOut`) are always 1 byte for real transactions.

### 12.3 Codegen

`OP_TXINPUTCOUNT` value loop -> `OP_TXOUTPUTCOUNT` value loop -> `OP_SUB` (fee); `OP_TXINPUTCOUNT` size loop
+ `41*nIn` -> `OP_TXOUTPUTCOUNT` size loop + `9*nOut` -> `+10` (size); then `1000 * fee / size`
(`OP_SWAP 1000 OP_MUL OP_SWAP OP_DIV`). Emitted by `GenerateTargetTraversal.emitTxGasprice` /
`emitIntrospectionSum`. No circularity: the transaction is final when the VM runs, so every input's
unlocking script (including the current input's) is fixed and introspectable.

### 12.4 Caveats

- **Units:** sat/KB, **not** wei/gas. Ported code that reasons about EVM gas units must be adapted.
- **Builder-set:** the fee and size are chosen by the transaction builder - which is *faithful* to EVM
  (`tx.gasprice` is the sender's price), so it is a real value, not a fake shim. A contract gating on it
  (`require(tx.gasprice <= X)`) constrains the spender's own fee; that is the intended use.
- **Integer divide** truncates toward zero (`Floor`), like `block.basefee`.

## 13. Solidity coverage - the full "Block and Transaction Properties" list

Every entry in Solidity's *Block and Transaction Properties* section is implemented in SolidCash (mechanism
+ any divergence below). **None are missing.** Several are reinterpreted for the UTXO model, and a few BCH
extensions are added on top.

| Solidity property | SolidCash | Mechanism | Notes / divergence |
|---|---|---|---|
| `blockhash(uint) -> bytes32` | **yes** | per-block `(n->hash)` co-spend oracle, 256-block window (s11) | window matches EVM; an absent read **errors** (not `0`) - on BCH the builder controls inputs, so a forced `0` is unsafe (s11.2) |
| `blobhash(uint) -> bytes32` | **yes** | `bytes32(0)` | no EIP-4844 blobs on BCH; EVM also returns `0` for an absent index |
| `block.basefee` (uint) | **yes** | oracle: `Floor(1000 * totalFees / size)` sat/KB (s6) | reinterpreted as the block's realized fee rate (BCH has no consensus base fee) |
| `block.blobbasefee` (uint) | **yes** | aliases `block.basefee` (warned) | no blobs; aliased (not `0`) to avoid zero-out / divide-by-zero in ported code |
| `block.chainid` (uint) | **yes** | baked single-byte network constant | typed **`bytes1`**, not `uint` - intentional 1-byte cap (user-land); Solidity code using it as a uint needs a cast |
| `block.coinbase` (address) | **yes** | oracle: coinbase output-0 locking bytecode (`address`) | the full payout locking bytecode |
| `block.difficulty` (uint) | **yes** | oracle: nBits (uint32) | the **real PoW difficulty** - NOT aliased to `prevrandao` (BCH is PoW; on EVM>=Paris `difficulty` is a deprecated alias for `prevrandao`) |
| `block.gaslimit` (uint) | **yes** | fixed shim `1000000` (warned) | no gas metering on BCH |
| `block.number` (uint) | **yes** | oracle register (uint32), owner-updated, freshness-bound | a value, not just a CLTV floor |
| `block.prevrandao` (uint) | **yes** | tx-local `abs(int(sha256(input[0] prevout txid)))` (warned) | no beacon/VM randomness; grindable by the builder - not secure (s12-adjacent note in field table) |
| `block.timestamp` (uint) | **yes** | oracle register (uint32) | under `solidityImportCompat`, maps to native `tx.locktime` instead |
| `gasleft() -> uint256` | **yes** | fixed shim `1000000` (warned) | no gas metering |
| `msg.data` (bytes) | **yes** | the call's argument bytes (calldata) | see docs/call-model.md |
| `msg.sender` (address) | **yes** | the calling contract's locking bytecode; `tx.origin` for a direct (EOA) call | EVM-parity caller, from the external-call model (`__internal__msgSenderCategory`) |
| `msg.sig` (bytes4) | **yes** | the 4-byte function selector | |
| `msg.value` (uint) | **yes** | satoshis sent to the contract = `output_balance - input_balance` of its satoshi container | wei -> sats |
| `tx.gasprice` (uint) | **yes** | tx-local `1000 * (sum in - sum out) / tx_size` sat/KB (s12) | the realized fee rate; sat/KB, not wei/gas |
| `tx.origin` (address) | **yes** | the first P2PKH input's address (the "EOA" funder) | the originating sender |

**BCH extensions** (not in Solidity, exposed because the model has them): `block.size`, `block.totalFees`
(the two BCH-native components `block.basefee` is derived from), `tx.version`, `tx.locktime`,
`this.activeInputIndex` / `this.activeBytecode` / `this.categoryId`, and full per-input/output introspection
`tx.inputs[i].*` / `tx.outputs[i].*`.

**Recurring divergences** (all by design): the fee-family values are **sat/KB**, not wei/gas; the gas-family
values are fixed shims (no metering on BCH); randomness (`prevrandao`) is grindable, not a beacon; `chainid`
is a single byte; and `difficulty` stays the real PoW difficulty rather than aliasing `prevrandao`.
