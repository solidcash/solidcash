# Block and Transaction Properties (`block.*` / `tx.*`) on BCH

Solidity's "Block and Transaction Properties" - the `block.*` and `tx.*` globals - mapped onto the BCH UTXO
substrate. The transaction-local ones (`tx.gasprice`, `block.prevrandao`) and the gas/blob shims are pure
introspection or constants. The block-level values that have no VM source are served by **oracle pools**: one
token category of block-info coins and blockhash ring slots that any contract may read (sections 3-8 and 11).

Status: **IMPLEMENTED (compiler + SDK e2e on mocknet).** Oracle pools replaced the single network block-info
oracle, the per-contract `(n -> hash)` pairs and the keeper baton on `feat/oracle-pools`
(`docs/wip/oracle-pools/PLAN.md`), and the framed line's per-contract oracles and ring on `feat/oracle-pools-sushi`
(`docs/wip/oracle-pools/SUSHI-PORT.md`).
- `block.chainid` - baked single-byte network constant.
- Pool reads `block.{number,timestamp,difficulty,size,totalFees,basefee,coinbase}`; `block.blobbasefee`
  aliases `block.basefee` (no EIP-4844 blobs on BCH; compiler warns). `block.gaslimit` + `gasleft()` are
  fixed shims (`1000000`, no gas metering on BCH; compiler warns). `block.prevrandao` is a transaction-local
  shim (`abs(int(sha256(input[0] prevout txid)))`, no oracle; grindable; compiler warns).
- `tx.gasprice` - the current transaction's realized fee rate, `1000*(sum in - sum out)/tx_size` sat/KB,
  reconstructed from introspection (no oracle; tx_size estimated since there is no `OP_TXSIZE`). See s12.
- Pool covenants, codecs, locks and unlocking builders: `packages/utils/src/oracle-pool.ts`. Every owner path is a
  signed spend of a pool covenant, never a function of a reader (section 4).
- SDK: `packages/solidcash/src/oracle/pool/`, exported from `@solidcash/solidcash/oracle`: `createOraclePool`
  (genesis), `PoolKeeper` (the owner's operator), `selectPoolInfoCoin` / `selectPoolSlot` (coin choice) and the
  reader helpers in `reader.ts` (binding and co-spends).
- `blobhash(i)` -> `bytes32(0)` (no BCH blobs). `blockhash(n)` reads a ring slot of the bound pool (section 11).

Implementation notes: `SynthesizeBlockOracle` injects no state. A `block.*` read stays a nullary (`basefee` lowers
to `Floor(1000 * totalFees / size)`) and marks its function `usesBlockOracle`; `bindOraclePool` gives a direct
contract its hidden `__oraclePool` parameter, and a framed master carries the pool in pool slots (section 8).
Codegen checks a co-spent coin's category and flags and slices the field out of its commitment, so a `block.*`
reader stays stateless unless something else makes it stateful; a `blockhash` reader is stateful (section 8.1).
`block.timestamp` reads the pool in every mode, `evmCompat` included. Tests:
- `packages/utils/test/oracle-pool.test.ts`: codecs and every covenant path on the BCH 2026 VM, redeem sizes pinned;
- `packages/solidc/test/OraclePoolRead.test.ts`, `OraclePoolIndirectRead.test.ts`: reader checks, framed pool slots,
  creators, function-pointer targets and ORACLE-1, on the VM, and `BlockReadStateful.test.ts` (the statefulness
  rule);
- `packages/solidcash/test/e2e/OraclePoolCore.test.ts` (genesis, keeper, selection, mock refresh),
  `OraclePoolBlockInfo.test.ts`, `OraclePoolBlockhash.test.ts`, `OraclePoolIndirectSdk.test.ts` (function-pointer
  readers, stateless and stateful), `OraclePoolDeployGenesis.test.ts` (deployment-minted pools, `PoolKeeper.start`
  and `setDepth`), `BlockOracle.test.ts`, and `AuditCrypto4KeeperAuthority.test.ts` /
  `AuditCrypto5OracleRewind.test.ts` (the owner rule and the write bounds), on mocknet;
- framed, on mocknet: `packages/solidcash/test/framed/time/block-clock.test.ts` (the pool's clock in plain and
  proxied framed contracts) and `framed/deploy/child-genesis-replay.test.ts` (a created child's masters carry its
  pool).

This consolidates the design discussion for exposing Solidity-style block and transaction properties
(`block.*`, `tx.*`) in SolidCash on the BCH UTXO substrate. The transaction-local properties are covered in
sections 11-12 (`blockhash`/`blobhash`, `tx.gasprice`) and the per-field table (s6); the rest of the
document is the oracle pools that back the block-level reads. Normative rules use MUST/SHOULD. ASCII only (no
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

## 3. The model: oracle pools

The design is TRE rev. 39 decision 47 (branch `tre`, `analysis/tre/tre-rev39-addendum.md`, section 6c), settled
by the user on 2026-11-04, backported to master by `docs/wip/oracle-pools/PLAN.md` and to the framed line by
`docs/wip/oracle-pools/SUSHI-PORT.md`.

- **A pool is one category `P`** of mutable NFTs that any contract may read. Oracle coins belong to no contract: a
  reader binds `P` (section 8) and reads any live coin of it. A genesis binds a pool and mints none of its coins;
  `oraclePool: 'new'` mints a pool in transactions of its own first ("SDK pool configuration", below).
- **Three P2SH32 covenants** (`oracle-pool.ts`), each starting with `PIN(P, capability)`:
  `push(P || cap) OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_EQUALVERIFY`, which also salts each pool's addresses.
  - block-info coins, mutable (`buildPoolInfoCovenantScript`);
  - ring slots, mutable (`buildPoolSlotCovenantScript`);
  - one baton, minting (`buildPoolBatonCovenantScript`), through which the owner grows the pool.

  The coins of one kind share one lock. `categoryId` is in display order; the covenants push it reversed, as
  `OP_UTXOTOKENCATEGORY` does.
- **The owner** is the 20-byte key hash in each commitment, so one bytecode serves every operator of a pool. An
  owner path unlocks `<args> <selector> <sig> <pubkey>`, checks `hash160(pubkey)` against that hash, then the
  signature.
- **The read path** is the empty unlocking: the output at the coin's own index is its exact recreation (same lock,
  category and capability, and commitment, and at least its value). No input or output walk.
- Every pool coin holds 1,200 sat (`POOL_COIN_SATS`).

### 3.1 Why a reader checks no lock

A read matches a coin by its category, capability and flags byte. That suffices because every path keeps each
mutable NFT of `P` at a pool lock, with a commitment its covenant admitted:

- a spent mutable NFT may yield one NFT of its category. Every coin path but the sweep recreates the coin at its
  own index, which uses that allowance up, and the sweep refuses any output carrying `P`;
- a spent minting NFT may yield any NFT of `P`, so every baton path walks the outputs (section 4.4).

The genesis is the one transaction no covenant constrains: it may mint NFTs of `P` at any lock. A pool is sound only
when its genesis put every NFT at a pool lock and minted one baton, as `buildOraclePoolGenesis` does, so a reader
trusts the genesis of the pool it binds as it trusts the owner.

The two mutable kinds share `P` and the capability, and the kind bit (flags bit 7) keeps them apart: a slot handed
to a `block.*` read fails its `flags == 0x00`, and a block-info coin handed to a `blockhash` read fails
`flags == 0x80`. A stopped coin fails both.

### 3.2 Read lowering (0-param)

`block.number` (etc.) lowers in one of three forms (`emitBlockOracleField`). Each leaves the commitment after its
flags byte, and the field is sliced at `POOL_INFO_OFFSETS[field] - 1`, 5 bytes, `OP_BIN2NUM` (`coinbase` is a
length-prefixed slice instead):

- **Direct read.** Push `__internal__blockOracleInputIndex` and `__oraclePool`, then `emitOraclePoolCheck`:
  `OP_1 OP_CAT OP_OVER OP_UTXOTOKENCATEGORY OP_EQUALVERIFY` (a mutable NFT of `P`), then
  `OP_UTXOTOKENCOMMITMENT OP_1 OP_SPLIT OP_SWAP 0x00 OP_EQUALVERIFY` (flags `0x00`). Two or more reads share the
  check as one lock-supplied helper (`ORACLE_POOL_CHECK_USE_KEY`).
- **Function-pointer target** (section 8.2). It holds no index, so `emitOraclePoolCoinSearch` walks the inputs
  from 0 to the first with category `P || 0x01` and flags `0x00`, with `P` from the binding helper. Past the last
  input the introspection fails.
- **Framed master.** The same walk, with `P` from the pool slot that deployment fills (section 8.1), a
  constant-lock master's included.

The SDK places the coin (section 8.4).

## 4. The owner's paths

Selectors (`COIN_PATH`, `BATON_PATH`): a block-info coin or a slot takes `0` sweep, `1` update or write, `2` stop
and `3` rotate, and any other selector or the empty unlocking reads; the baton takes `0` sweep, `1` mint and
`2` update.

### 4.1 Block-info update (`infoUpdate`)

nLockTime is a height or a time, so one update moves one clock and keeps the other. The coin is recreated at its
own index, and the kind bit stays clear.

- **Height-type nLockTime** (below 500,000,000): unlocking `<rest> <number> <flags'>`, `rest` being difficulty
  through coinbase. The new `number` is 5 bytes, does not rewind and CLTV bounds it; `timestamp` stays.
- **Time-type nLockTime:** unlocking `<timestamp> <flags'>`. The new `timestamp` is 5 bytes, does not rewind and
  CLTV bounds it; every other field stays. CLTV also refuses an operand of the other locktime type.
- `flags'` uses bits 0 and 1 only (`flags' & 0xfc == 0`) and keeps the stop bit of the field that stays: a height
  update may clear bit 0 (`number` stopped), a time update bit 1 (`timestamp` stopped). Either may set either bit.

### 4.2 Slot write (`slotWrite`)

Unlocking `<hash> <n'>`: `n' > n`, `(n' - n) mod depth == 0`, `n'` below 500,000,000 and CLTV-bound, and a
32-byte hash. The flags become `0x80`, which clears the stop bit; owner and depth stay.

### 4.3 Stop, rotate and sweep

- **Stop** `<2>`: sets the stop bits (`0x03` on a block-info coin, `0x01` on a slot) and changes nothing else. A
  later update or write may clear them (4.1, 4.2); `PoolKeeper` never does.
- **Rotate** `<owner'> <3>`: a new 20-byte owner hash, nothing else changed.
- **Sweep** `<0>`: no recreation, and `sweepWalk` refuses any output carrying `P`, the one walk on a coin path. A
  swept mutable coin frees its one-NFT allowance, and the baton an unlimited one, which could otherwise mint a
  readable forgery.

### 4.4 The baton

Commitment `owner (20) || depth (2 LE)`, the tail every slot of the pool carries. Unlocking
`<arg> <selector> <sig> <pubkey>`, signed by the commitment's key. The mint `<template> <1>` and the update
`<commitment'> <2>` walk every output. An output carrying `P` has no fungible amount, and:

- at the baton's own index it is the recreation, checked after the walk, and the one minting output: the
  commitment stays on the mint, and on the update becomes the new 22 bytes, with a depth of 1 to 256 (`c90c7f864`:
  a depth of 0 bricked every later slot);
- elsewhere it is a mutable NFT that recreates the pool coin co-spent at its index (that coin's covenant checks
  it), or, on the mint only, a new coin:
  - at the info lock, a copy of the input at index `template`, a live block-info coin (flags `0x00`) at that lock;
  - at the slot lock, `0x80 || n || hash || <baton commitment>`, with `n` a height that CLTV bounds.

The sweep `<0>` runs `sweepWalk`. A depth change applies to the slots minted after it, as each slot keeps the depth
in its own commitment; `PoolKeeper.setDepth` sends one.

### 4.5 The keeper (`PoolKeeper`)

The owner's operator (`packages/solidcash/src/oracle/pool/keeper.ts`). It lists the coins at the pool's locks and
sends ordinary transactions the covenants admit, each paying 1 sat/byte from the largest token-free coin at the
owner's P2PKH, with the change back there. `start` runs its steps on each new block ("SDK pool configuration",
below), or its caller drives them per block.

- `refreshInfo(fields)`: every live block-info coin the key owns, by one height-locked, then one time-locked
  transaction, so every coin reads one clock. A step already published, or one that would rewind a coin, is
  skipped. `fields.timestamp` must be final: at most MTP - 1.
- `writeNewestSlot(n, hash)` moves every live slot of `n`'s residue forward to `n`, locked at height `n`;
  `writeSlots(blocks)` moves each live slot to the newest block of its residue, in transactions of at most
  `POOL_COINS_PER_TRANSACTION` (64) slots, each locked at its newest height.
- `growInfo(k)` mints `k` copies of a live block-info coin, which it co-spends by its read path; `growSlots(blocks)`
  mints slots with the baton's owner and depth.
- `stop`, `sweep` and `rotate`, 64 coins per transaction. `rotate` moves every coin the key owns and the baton to
  the new owner, sends the last change to the new key's P2PKH, and then signs with the new key.

The owner is trusted for the data. Staleness is the owner's responsibility and is not script-enforceable
(section 5).

## 5. Hardening (what nLocktime can and cannot do)

`nLocktime` is a one-sided **lower** bound on the including block's height/time. Therefore:

- **Anti-over-reporting (enforced):** the CLTV on the moved field means a pool cannot claim a height above the
  real tip, nor a time at or above the median time past. A slot write is CLTV-bound the same way.
- **Non-rewind (enforced):** an update cannot move `number` or `timestamp` back to replay an old window, and a
  slot moves only forward, by a multiple of its depth. An update admits equal values; a slot write does not.
- **Value pin (enforced):** every path but the sweep recreates the coin with at least its value, so no reader
  drains it.
- **Type confusion (enforced):** `number` must stay below 500,000,000, so a time-type nLockTime cannot stand
  in for a height, and CLTV refuses an operand of the other locktime type.
- **Kind confusion (enforced):** a read checks the flags byte, so a slot cannot stand in for a block-info coin, or
  the reverse (section 3.1).
- **Anti-staleness (NOT possible):** no covenant can prove a value is recent (no upper bound on mining
  height is readable). `block.number` and `block.timestamp` are the keeper's last write, and the compiler warns
  so; the keeper's cycle is the only bound. A reader may co-spend any live coin, so a coin the keeper left behind
  is as readable as a current one.
- **Adversarial floors SHOULD stay native.** If a spender *benefits* from a stale value (e.g. sneaking past
  a deadline with an old `block.number`), the pool cannot stop them. A trustless floor is
  `require(tx.time >= K)`; auto-lowering `block.number/timestamp >= K` to it is still open (section 10).

## 6. block.* property table

Use **minimal-width bounded types** (`uintN` = `IntType(false, bits)`, already in the language), NOT the
`uint`/`int` aliases - those are `uint256`/`int256`, far too wide to encode this data. Solidity types
these `uint256` because EVM is 256-bit and wei is 1e-18; on BCH the values are small and money is 1e-8
(satoshi). Widths below are sized against real mainnet block 956830 (the sizing reference):

| prop | prio | source | type | commitment | value @ 956830 | notes |
|---|---|---|---|---|---|---|
| `block.number` | 1 | oracle | `uint32` | 5 B | 956830 | ~80,000 yrs of headroom; the owner's last height write (section 4) |
| `block.timestamp` | 1 | oracle | `uint32` | 5 B | 1782384635 | BCH header nTime IS uint32 (to 2106); the owner's last write, below the MTP when written (section 4) |
| `block.chainid` | 1 (DONE) | **baked constant** | `bytes1` | none | - | one byte `chainId & 0xff`, compared bytewise; no oracle/co-spend |
| `block.difficulty` | 2 | oracle | `uint32` | 5 B | 0x18026c88 | **raw nBits**; decoded difficulty (453596304365.59) is fractional, so nBits is the honest integer; NOT randomness |
| `block.coinbase` | 2 | oracle | `address` | 1 + <= 80 B | 76a914..88ac | **full locking bytecode** of coinbase output 0 (p2pkh = 25 B here); variable, length-prefixed |
| `block.size` | 2 | oracle | `uint32` | 5 B | 9075 | block size in bytes; uint32 covers ~4 GB blocks (BCH-native, not a Solidity global) |
| `block.totalFees` | 2 | oracle | `uint32` | 5 B | 31792 | sum of tx fees in sats; uint32 ceiling 42.9 BCH >> any real block (uint64 if more headroom wanted) |
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
  lower to the constant `1000000` (no oracle - a pure literal, like `block.chainid`). A constant rather
  than `0` or a revert so that ported gas-budget checks (`require(gasleft() >= X)`, `block.gaslimit`
  comparisons) keep running. The compiler emits a one-time warning for each that it is a meaningless shim. Do
  not rely on the value. (`gasleft()` is desugared pre-semantically, so it never reaches the function
  registry; `block.gaslimit` is a `NullaryOp` token, so it makes the contract stateful as every `block.*` read
  does, section 8.1, and `gasleft()` does not.)
- `block.prevrandao` (`uint256`) is a **transaction-local randomness shim** - it needs **no oracle and no
  co-spend**, unlike the other introspected fields, though it makes the contract stateful as every `block.*` read
  does (section 8.1). BCH has no VM randomness opcode and no
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
  `require(block.chainid == 0xff)`). It needs none of the oracle infra, though it makes the contract stateful as
  every `block.*` read does (section 8.1). User-land convention:

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

## 7. Commitment layouts

`oracle-pool.ts` (`encodePoolInfoCommitment`, `encodePoolSlotCommitment`, `encodePoolBatonCommitment`; offsets
`POOL_INFO_OFFSETS`, `POOL_SLOT_OFFSETS`):

```
block-info  flags(1) | owner(20) | number(5) | timestamp(5) | difficulty(5) | size(5) | totalFees(5)
            | coinbaseLen(1) | coinbase
slot        flags(1) | n(4 LE) | hash(32) | owner(20) | depth(2 LE)                      59 bytes
baton       owner(20) | depth(2 LE)                                                       22 bytes
```

Each numeric block-info field is a uint32 as 4 little-endian bytes plus a trailing `0x00`, so `OP_BIN2NUM` reads a
non-negative script number. The 128-byte commitment limit caps `coinbase` at 81 bytes; a 25-byte p2pkh coinbase
gives a 72-byte commitment. `block.basefee` is derived and `block.chainid` is baked, so neither is stored. The slot
hash is the block hash in display order, as `getblockhash` prints it.

`flags`: bit 7 is the kind (0 for a block-info coin, 1 for a slot). Block-info bit 0 marks `number` stopped and
bit 1 `timestamp` stopped; slot bit 0 marks the slot stopped. A read accepts `0x00` (block-info) or `0x80` (slot)
only. The baton has no flags: its minting capability is its kind.

## 8. Compiler / SDK integration

### 8.1 The binding: `__oraclePool` and framed's placeholder

- `bindOraclePool` (`SynthesizeBlockOracle.ts`) appends a hidden `bytes32 __oraclePool` (`ORACLE_POOL_PARAMETER`)
  as the last parameter of a direct contract that reads block info or blockhash, or that creates or names the lock
  of a contract taking the binding. It runs once the children are compiled, before code generation. The value is
  `P` as `OP_UTXOTOKENCATEGORY` pushes it, the display-order id reversed (`oraclePoolBinding`).
- A creator passes its own binding as a bound child's last argument, in the in-script child lock and in
  `deployTargets[].constructorArgs`, where it is named `__oraclePool` (`childDeploymentArguments`).
  `passesOraclePool` marks the named-call closure of each creating body, which an invoked frame must hand the
  value; the embedded child's own compile decides whether it takes one (`setOraclePoolBinding`). A creator that
  reads nothing takes the binding to pass it on.
- A body that reads, or creates a bound child, captures the binding as a constructor parameter
  (`constructorCaptures`); a free function captures it too.
- Hidden indices: a function that reads `block.*`, or calls one by name (`markBlockOracleCallers`), takes
  `__internal__blockOracleInputIndex`, and a stateful one a `blockInfoOracle` block-layout slot; a `blockhash`
  reader takes `__internal__blockhashInputIndex` and its `blockhashOracle` slots (section 11). A call that cannot
  forward the index is refused (`BlockOracleIndexNotForwardedError`).
- A framed master has no contract parameters, so `bindOraclePool` adds none. Each read pushes
  `ORACLE_POOL_SENTINEL || 0x01` (`0xa5`, 31 bytes of `0x5c`, then the mutable capability) as one 33-byte push, and
  the artifact publishes the offsets of those pushes, the push opcode's, as `oraclePoolSlots`
  (`findOraclePoolSlots`). The SDK's `deployMaster` writes `oraclePoolBinding(P)` over them (`applyOraclePool`) and
  keys its cache on the pool, and `verifyMasterDeployment` compares against the same filled program.
- The pool is the same for every category, so a constant-lock master, the master of a contract another contract
  creates (`docs/framed/CREATE2_IDENTITY.md`), stays constant-lock: `deployMaster` fills its pool slots before any
  lock, address or digest is computed. The child's entry locks its creator is deployed with (`framedChildConstants`)
  carry the pool those constants were computed with, and the creator's genesis replay requires the child's masters
  at those locks, so every creation binds that pool. The replay mints no oracle and has no owner slot: GENESIS-1's
  oracle part, `FramedChildGenesisReplay.blockOracle` and `childOracleOwnerSentinel` are gone (`3148c0cac`,
  `1a7850973`). A framed creator takes no binding and publishes no `createdPoolReads`, as its framed children take
  no `__oraclePool`.
- The framed validator template has no oracle admission (`7c24b63b0`): a pool coin is of a pool category, never a
  settled contract's, so the census sees none. The template, its hash and every framed address changed with it.
- The compiler refuses a direct reader that takes no `__oraclePool`, and a framed reader that published no pool
  slot unless the contract has a refused entry: an entry the master refuses runs none of its body, so a contract
  whose only clock read sits in one reads no pool. The artifact carries `usesBlockOracle` on the function and the
  artifact, `usesBlockhash`, `abi.blockhashReads`, a framed reader's `oraclePoolSlots`, a creator's
  `createdPoolReads` and an entry's `indirectPoolReads` (section 8.2).
- **Statefulness.** A `block.*` read slices a pool coin, so it needs no state: a reader with nothing else stateful is
  a plain contract that co-spends the coin. A `blockhash(n)` read makes the contract stateful:
  `SynthesizeBlockOracle` sets `ContractNode.blockhashReadMarked`, which a re-run on a split root keeps, and
  `readsBlockhash` (that or `usesBlockhash`) feeds the compiler, the symbol table, the artifact and codegen
  (`currentContractReadsBlockhash`, which the body sub-traversals and the helper-use probe inherit beside ORACLE-1's
  flags). The framed line's rule of 2026-11-03, that any block read makes a contract stateful, served per-contract
  oracles and went with them (TRE rev. 39 decision 47). Test: `BlockReadStateful.test.ts`.
- `block.chainid` lowers to a pushed constant (per `--network`); no pool, no co-spend.

### 8.2 Function-pointer targets: the binding helper and the input walk

An indirect call pushes a body's declared arguments only, so a target could take the binding and a coin index only
from slots its caller chose (`3b37569df`). In a contract that calls through a function value, each body that needs
the pool and that a function reference names (`indirectPoolBodyIds`), a free one included, takes neither:

- the contract level defines a binding helper, `[]` -> `[P]` (`emitOraclePoolBindingDefine`): `0x20` and the
  contract's own `__oraclePool` concatenated, `OP_DEFINE`d as a body that pushes `P`. Only this script can
  `OP_DEFINE`, an identifier once, so no caller chooses `P`. Inside `OP_INVOKE`, `OP_ACTIVEBYTECODE` is the invoked
  body and the redeem's offset in the unlocking bytecode moves with the other arguments, so neither can supply `P`.
  The id is `ORACLE_POOL_BINDING_SUBROUTINE_ID` (-127), moved below any id a library load defines;
- a `block.*` read walks to the first block-info coin of `P` (`emitOraclePoolCoinSearch`, section 3.2);
- a `blockhash(n)` read walks to the first input that is a live slot of `P` answering `n`, one holding `n` or a
  block of `n`'s residue at least 256 newer, and gives the direct read's answer, the hash or zero
  (`emitOraclePoolSlotSearch`, then `emitPoolSlotAnswer`; `617b8fb81`). Its category read sees `[n, i, i]`, as a
  direct read's does, so the SDK's probe finds `n` in the trace;
- a direct call the target makes hands its callee `P` and that coin's index the same way, and a creation in it
  passes the helper's `P`.

Each entry that reaches an indirect call, in its body or in a body it calls by name, while such a target exists
publishes `indirectPoolReads: { blockInfo?, blockhash? }`, the kinds those targets read (`markIndirectPoolReaders`,
`8e5ebe10e`; bytecode unchanged). The SDK co-spends from it (section 8.3). A contract with no such target emits no
helper, and direct reads keep the parameter and the caller's index. A framed master refuses function pointers, so
this is the direct convention's path.

### 8.3 SDK co-spend

- **Binding.** `Contract`, `ContractFactory`, `StatefulContract.deploy` and the lean constructor fill
  `__oraclePool`, and framed deployments their masters' pool slots, from the `oraclePool` option (a category in
  display order), else `provider.oraclePoolCategory` (`withOraclePoolArgument`, `bindFramedOraclePool`), and throw
  with neither. A binding passed in the arguments must agree with `oraclePool`. `Contract.oraclePool` names the
  bound pool. `deployFrom` gives a bound child its creator's binding, as the creator's covenant builds the child's
  lock. A framed child's masters carry the pool `framedChildConstants` and `registerFramedCreatedChild` are given as
  `oraclePool`, else the provider's (`bindChildOraclePool`); a creator's shipped clones and a framed helper cut's
  stub keep the deployment's pool (`aca6fae8a`, `5d504eae0`).
- **Choice.** `selectPoolInfoCoin` picks a random live block-info coin of the pool, listed by category, or at the
  info and slot locks where the provider cannot list by category. `poolInfoCoSpend` keeps the coin it chose last
  while it is live, so every reader of a transaction, and each probe of it, spends the same one. `selectPoolSlot`
  picks a live slot holding `n`, else one of `n`'s residue at least 256 newer (the zero case), and skips a slot the
  transaction already spends.
- **Placement.** A coin is spent by its read path (`poolInfoReadUnlocking`, `poolSlotReadUnlocking`) and recreated
  at its own index. An index argument is found among the spent outputs by category and flags, never by lock.
  - Stateless: `TransactionBuilder.addRequiredBlockOracleCoSpends` / `addRequiredBlockhashCoSpends` on `send()`,
    padding the outputs with 1,000-sat `OP_1` outputs up to the coin's index; `Contract` fills the index.
  - Stateful: the `blockInfoOracle` and `blockhashOracle` block-layout slots, nested callee blocks, nested compose
    slots and the blockhash probe.
  - Framed: the root entry, a callee frame and a proxy hop co-spend a live block-info coin after the master's
    side-cars. A frame that an earlier one already serves co-spends nothing, as its body finds the coin by
    category and flags.
- **Function-pointer readers** (`3d5e9ea0d`, `651f0f025`), keyed on the entry's `indirectPoolReads` (8.2):
  - `blockInfo`: one live block-info coin of the pool per call, unless one is placed already. The stateless builder
    adds it as for a direct reader (`addRequiredBlockOracleCoSpends`). A stateful call co-spends it for its own
    entry and for each nested or low-level callee's, delegates included (`resolveUnslottedPoolInfoCoins`), as the
    last input, recreated at its own index past every block (`appendUnslottedPoolCoSpends`);
  - `blockhash`: a stateful call of the entry probes it until no walk runs past the last input
    (`unansweredBlockhashWalk`), co-spends a slot answering each `n` a walk names (`resolveIndirectBlockhashCoSpends`,
    at most 8 reads per call) and raises the locktime to the largest. A nested or low-level callee's walk gets no
    slot: it reads one only if the transaction already spends a slot that answers it;
  - an artifact that publishes the field on no entry predates it: there the stateless builder and framed entries
    co-spend an info coin on every call when it reads `block.*` only indirectly (`readsPoolOnlyIndirectly`,
    `abba1a162`), and the stateful builders co-spend nothing for it.

  Test: `OraclePoolIndirectSdk.test.ts` (stateless, stateful and mixed readers, and a pointer target's hash and zero).
- Stored-value recipes read the co-spent coin's timestamp (`readPoolTimestamp`).

## 9. Deferred / future

- **Concurrency:** a pool serves concurrent readers by replicas - several block-info coins, `slotReplicas` slots
  per block, and growth through the baton - and the SDK picks a random live coin. Reads of one coin still serialize.
  The **split/merge replicate-policy** (a read-only record replicated into every thread, merged by
  `OP_EQUALVERIFY`) stays deferred.
- **Trust-minimized foreign update:** the update authority is one owner key, named by its hash in each
  commitment, so a new authority policy (a keeper datasig any relayer can push, or a copy from another
  canonical oracle) is a new covenant beside these, not a reader change. Both would ride the section-5
  bounds.
- **Multisig owners:** out of scope for now; every pool covenant checks one owner key hash.
- `prevrandao` has no BCH analogue (no randomness beacon); not planned.

## 10. Decisions

- **`block.coinbase`** = the full locking bytecode of coinbase output 0, typed `address`
  (variable, length-prefixed). RESOLVED.
- **`block.basefee`** = `Floor(1000 * block.totalFees / block.size)` (sat/KB), derived on-chain from the
  encoded `block.size` + `block.totalFees`. RESOLVED.
- **Types** = minimal-width `uintN` per component (section 6), never the `uint`/`int` 256-bit aliases.
  RESOLVED.

Still open:

- **Comparison lowering:** auto-lower `block.number/timestamp >= K` to native `tx.time` floors
  (recommended, section 5) vs strictly everything through the co-spent oracle (today).
- **`block.totalFees` width:** `uint32` (42.9 BCH ceiling - minimal viable) vs a wider field, which changes
  the commitment layout. Default `uint32`.

## 11. blockhash(n) and blobhash(i)

Status: **IMPLEMENTED.** `blobhash(i) == bytes32(0)`. `blockhash(n)` reads a ring slot of the bound pool
(`b2ec3b973`, `e0c815f3b`). Using `blockhash` still **forces the contract stateful** (`ContractNode.readsBlockhash`
-> `isStateful` + a `stateLayout`, section 8.1): the statefulness rules did not change with the pools. A framed master refuses
every entry of a contract that reads it, as the master head locates no co-spent slot.

These are **functions** (runtime argument), not the 0-param `block.*` properties, so they lower as
`GlobalFunction`s (the keccak256 path is the template), not nullary oracle reads.

### 11.1 blobhash(uint) -> bytes32: return zero

EIP-4844 blobs (KZG-committed sidecar data on a blob-carrying tx) have **no BCH analogue**. EVM returns
`0` for `i >= numBlobs`; on BCH `numBlobs == 0`, so `blobhash(i) == bytes32(0)` for all `i` - a porting
shim so Solidity that references it compiles and runs. Codegen: drop the arg, push 32 zero bytes.
(Optional compile warning that blobs do not exist on BCH.) An `OP_RETURN`-data reinterpretation is
rejected - it silently changes Solidity semantics.

### 11.2 blockhash(uint n) -> bytes32: the ring

The current block's own hash is unavailable on-chain (EVM's `blockhash(block.number)` is 0), so every real use is
historical. A ring of depth `d` holds the last `d` blocks, one slot per residue `n mod d`; the keeper moves a slot
forward `d` blocks at a time (4.2), and a pool may hold several slots per block (`slotReplicas`).

**The read** (direct form). Codegen emits `OP_DUP OP_CHECKLOCKTIMEVERIFY OP_DROP` (`require(tx.time >= n)`), picks
`input[__internal__blockhashInputIndex + ordinal]`, and checks `OP_UTXOTOKENCATEGORY == __oraclePool || 0x01` and the
commitment's flags byte `== 0x80`, a live slot of `P`. `emitPoolSlotAnswer` then answers from the slot's block `n'`:

- `n' == n`: the slot's hash;
- `n' - n >= 256` and `(n' - n) mod depth == 0`: `bytes32(0)`, as `n` has left the EVM's 256-block window;
- anything else fails: a block the pool has not written, one the ring overwrote less than 256 blocks ago, or a
  future one.

A current ring of depth 256 answers every block, its hash inside the window and zero beyond it. A shallower ring
holds only its last `d` blocks and refuses the older ones until their residue's slot is 256 blocks ahead.

**A zero is not forgeable by omission.** The SDK errors when no live slot answers `n` ("no live slot that answers
block n"), and the script answers zero only from a real slot of `P` whose block is at least 256 newer, a block CLTV
kept at or below the chain tip when it was written. Omitting the co-spend fails the read; it never reads zero. (The
per-pair design this replaces errored on every absent read for the same reason, and left the EVM's "too old"
branch to the contract.)

**Multiple and computed reads.** Each distinct `n` in a function rides its own consecutive `blockhashOracle` slot
(`input[base + k]`, `blockhashSlotCount` driving the allocation; a direct-identifier `n` read twice shares one
slot, keyed by parameter name). A computed `n` (`block.number - K`, any expression) is keyed `<computed:i>` by its
call site (`encodeComputedBlockhashKey`), and the SDK reads it off the auto-derivation probe trace at the read's
`OP_UTXOTOKENCATEGORY` (stack `[n, idx, idx]`), resolving reads strictly in slot order
(`extractBlockhashReadsFromTrace` + `_resolveBlockhashCoSpends`). `block.number` there is the co-spent block-info
coin's, so `blockhash(block.number)` answers the hash of the block the keeper last published once its slot is
written, where the EVM answers 0 for the current block.

**Grinding caveat (unchanged):** the tx-builder picks `n`, so `uint(blockhash(n)) % k` randomness is
grindable - worse than EVM. Legitimate commit-reveal must **pin `n`** (committed in a prior tx). A compiler
warning when `blockhash(...)` feeds modulo/arithmetic is advisable.

### 11.3 Decision: a public primitive

Reads are permissionless self-serve: integrity comes from the pool's covenants (section 3.1), and reads of distinct
coins do not contend. Any contract may read any pool, and no keeper is on the read path. The keeper-gated
alternative (a baton co-spent in every read) is not built.

### 11.4 Alternatives (recorded)

- **Merkle root** (per-contract register holds a 32-byte root of a `(height->hash)` tree; caller supplies a
  proof): contention-free even for a hot recent `n`, but every blockhash-using contract carries a register
  + in-script proof verification. Use if you expect heavy concurrent reads of the *same* recent `n`.
- **Datasig** (keeper signs `(n, hash)`, caller supplies `(hash, sig)`, contract `OP_CHECKDATASIG`): any
  `n`, no storage, no shared UTXO - but key-trust, and it allows permissionless bootstrap (no keeper
  liveness on the read path). The escape if you ever want consumer-bootstrapped pairs.

### 11.5 SDK integration

- `resolveBlockhashCoSpend(provider, pool, n, exclude)` picks the slot (`selectPoolSlot`) and returns it with its
  read unlocker, its exact recreation, the locktime floor `n`, and whether it holds `n` (`exact`) or answers zero.
- Stateful readers: the `blockhashOracle` block-layout slots hold the co-spends, so the stateful assembly places each
  slot and its recreation at one index. The auto-derivation probes co-spend them, and the SDK sets the height
  locktime to `max(n)`, so the CLTV passes in both the probe and the final transaction. A transitive callee's slots
  and nested rows take slots the same way. A transaction's reads never choose one slot twice.
- Stateless path: `TransactionBuilder.addRequiredBlockhashCoSpends` co-spends one slot per read of a reader without
  a block layout and raises the locktime, and `Contract` fills `__internal__blockhashInputIndex` with the first slot
  of its pool among the spent outputs. A computed `n` needs its slot spent by the caller, and two such readers of one
  pool cannot share a transaction. The statefulness rule keeps every compiled reader off this path today.
- A `blockhash` read in a function-pointer target (8.2) takes no index and answers as a direct read does. A
  stateful call of its entry finds each `n` by probe rounds and co-spends a slot answering it (section 8.3).
  `OraclePoolIndirectSdk.test.ts` reads both answers, a hash and the zero for a block 256 older than the newest slot
  of its residue.

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
| `blockhash(uint) -> bytes32` | **yes** | a ring slot of the bound oracle pool (s11) | zero once `n` is 256 or more blocks older than its residue's slot (the EVM window); an unwritten block **errors**, and no omitted co-spend reads `0` (s11.2) |
| `blobhash(uint) -> bytes32` | **yes** | `bytes32(0)` | no EIP-4844 blobs on BCH; EVM also returns `0` for an absent index |
| `block.basefee` (uint) | **yes** | pool: `Floor(1000 * totalFees / size)` sat/KB (s6) | reinterpreted as the block's realized fee rate (BCH has no consensus base fee) |
| `block.blobbasefee` (uint) | **yes** | aliases `block.basefee` (warned) | no blobs; aliased (not `0`) to avoid zero-out / divide-by-zero in ported code |
| `block.chainid` (uint) | **yes** | baked single-byte network constant | typed **`bytes1`**, not `uint` - intentional 1-byte cap (user-land); Solidity code using it as a uint needs a cast |
| `block.coinbase` (address) | **yes** | pool: coinbase output-0 locking bytecode (`address`) | the full payout locking bytecode |
| `block.difficulty` (uint) | **yes** | pool: nBits (uint32) | the **real PoW difficulty** - NOT aliased to `prevrandao` (BCH is PoW; on EVM>=Paris `difficulty` is a deprecated alias for `prevrandao`) |
| `block.gaslimit` (uint) | **yes** | fixed shim `1000000` (warned) | no gas metering on BCH |
| `block.number` (uint) | **yes** | pool block-info coin field (uint32), owner-updated, CLTV-bound | a value, not just a CLTV floor; the keeper's last write |
| `block.prevrandao` (uint) | **yes** | tx-local `abs(int(sha256(input[0] prevout txid)))` (warned) | no beacon/VM randomness; grindable by the builder - not secure (s12-adjacent note in field table) |
| `block.timestamp` (uint) | **yes** | pool block-info coin field (uint32), owner-updated, CLTV-bound | the keeper's last write, below the MTP when written; the same under `evmCompat` |
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

`this.category` is the Solidity-oriented own-category accessor: it strips the NFT capability byte from the
master input's native `OP_UTXOTOKENCATEGORY` result and reverses the serialized bytes once, yielding the
display-order `bytes32` used by `this.tokens[...]` and SDK category IDs. Own-category token-container accesses
are compiler-derived and therefore add no category parameter to the public ABI.

**Recurring divergences** (all by design): the fee-family values are **sat/KB**, not wei/gas; the gas-family
values are fixed shims (no metering on BCH); randomness (`prevrandao`) is grindable, not a beacon; `chainid`
is a single byte; and `difficulty` stays the real PoW difficulty rather than aliasing `prevrandao`.

### SDK pool configuration (2026-11-04)

- `NetworkProvider.oraclePoolCategory` (display order) names a provider's default pool. `ElectrumNetworkProvider`
  takes it as the `oraclePoolCategory` option (64 hex characters, lowercased); `MemCashNetworkProvider` takes it as
  an option or from the node's advertised `devnet.oracle_pool`, which `solidhat node` mints, keeps current and
  advertises (`f02a4812a`, `packages/testing/src/oracle-pool.ts`).
- `NetworkProvider.oraclePoolOwnerKey` (mock, regtest) names the key a provider's own pools use; the devnet client
  has none. `NetworkProvider.keepOraclePool(category)` (mock) keeps a further pool owned by that key current after
  each block, as the provider keeps its own; `createOraclePool` calls it for every pool that key owns.
- `oraclePool: 'new'` or `{ create: { infoCoins?, ringDepth?, slotReplicas?, ownerKey?, funder?, tip?, blockHash? } }`
  on `DeployOptions` and `ContractFactory` deployments mints a pool by `createOraclePool` before the genesis
  (`resolveDeploymentOraclePool`, `oracle/pool/deployment.ts`), then binds the deployment to it; `deployFrom` binds
  every child to the creator's pool. The shape follows `oraclePoolTreeReads(artifact)`: the artifact's own
  `usesBlockOracle` and `usesBlockhash`, and `createdPoolReads`, the reads of the bound contracts it creates or names,
  theirs included, which the compiler publishes from each child's standalone compile. Block-info coins only for
  `block.*`, `infoCoins` defaulting to the master count (`threadCount`, the framed pool size, 1 when stateless); ring
  slots only for `blockhash`, at `ringDepth` (256, `'now'` = 1); the baton at that depth. The owner defaults to
  `provider.oraclePoolOwnerKey`; without one the deployment is refused, naming `create.ownerKey`. A tree that reads
  nothing mints no pool. `new Contract` keeps a category-only `oraclePool`, as its constructor is synchronous. A
  framed creator publishes no `createdPoolReads` (8.1), so a pool it mints serves its own reads; its children carry
  the pool their constants name.
- Every genesis moves the funding coin to the P2PKH of a one-time key, a hash of the funder's key and the funding
  outpoint, so a keeper or wallet sharing the funder's address cannot spend it between the two transactions.
- `PoolKeeper.start(intervalMs = 1000, { onError?, onStep? })` steps at once and on each tick that finds a new block:
  `refreshInfo` with `fields(height)` (a simulator's height and block time less one second by default), then
  `writeSlots` for every block since its last step. On a simulator a block the keeper's own send mined is not new.
  It returns a stop function that awaits the running step. `setDepth(depth)` rewrites the baton's depth (1 to 256)
  through its update path; `rotate` already rotates the baton's owner with every coin's.
- `MockNetworkProvider` mints its pool on the first `oraclePoolCategory` read, by the two genesis transactions: two
  block-info coins at the tip height and the second before the tip time, a depth-256 ring with one slot per block
  and the baton, owned by `oraclePoolOwnerKey` and paid from a fixed coin the mock gives that key's P2PKH. (Here a
  send mines at the tip's own time, so a pool minted at the tip time held that second until the clock moved twice:
  every refresh publishes the second before the tip and never rewinds, `5d504eae0`.) A second fixed coin, which
  every fresh chain gives that P2PKH, pays for the pools minted through the mock, which it keeps with its own. After
  each send, `mine`, `mineUpTo`, `evm_mine`, `hardhat_mine` and `evm_increaseTime`, a `PoolKeeper` moves every live
  block-info coin to the tip height and the tip time less one second, and writes the slot of each block mined
  since, up to the depth. Its transactions wait in the mempool for the next block. Block `n` hashes to the SHA-256
  of `n` as 4 little-endian bytes. A snapshot keeps whether the pool exists and which pools are kept, and `reset`
  forgets them. A VM target older than BCH 2026 has no pool, and a failed refresh is kept in
  `oraclePoolRefreshError`.
- `RegtestNetworkProvider` mints a pool of the same shape on its first request (`createOraclePool`, owned by a fixed
  key) and refreshes it the same way after each mine and after `increaseTime`. A snapshot confirms the keeper's
  pending transactions first, and a restore rewinds the slot height. Not run.
- The mock's rewrite of legacy `__block_*` registers (`oracle/legacy-block-registers.ts`) stays for vendored
  artifacts compiled before the oracle covenant; the compiler emits none.
- Gone with the old mechanism: `blockOracleLock` and `blockOracleCategory` on providers and contracts,
  `setBlockOracleFields`, `BlockOracleUpdater` with its rpc helpers and pair keeper, the `blockhashKeeperPublicKey`
  and `blockhashKeeperAmount` deploy options, and the testing package's devnet oracle runtime and
  `--no-block-oracle` flag.
- Gone with the per-contract model (`3148c0cac`, `a3396494e`, `aca6fae8a`, `1a8ade1ad`, `1a7850973`):
  - providers' `blockOracleOwnerPublicKey` and `blockOracleFields()`, and the mock's `blockOracleOwnerKey`,
    `setBlockOracleFields` and `refreshBlockOracle`;
  - the deploy options `blockOracleOwnerPublicKey`, `blockOracleAmount`, `blockhashDepth`,
    `blockhashKeeperPublicKey` and `childBlockOracleOwner`;
  - `BlockOracleUpdater` with its rpc helpers, and the per-contract oracle and ring deployments;
  - the testing package's `mockBlockOracleRpc` and `fetchBlockOracleFields`, its devnet per-contract keeper, the
    `--no-block-oracle` flag and the `devnet.blockOracle` config;
  - the artifact's `blockOracleLockSlots` and `blockhashDepth`, and utils' `block-oracle.ts`, the ring covenant and
    `BLOCKHASH_MAX_DEPTH`;
  - in the compiler, the oracle output pins (`emitOracleOutputPin`, `emitSplitOracleCopyPin`), the census admission
    (`admitsBlockOracle`), the derived oracle lock of a constant-lock master (`blockOracleLockDerivationScript`), the
    ring depth inference (`BlockhashDepthError`) and the replay's child oracle.

Evidence, on mocknet only: `BlockhashKeeperDeployment.test.ts` (a blockhash reader's genesis binds the provider
pool and holds one minting NFT of its category, its master) and `LiveBlockOracleConfiguration.test.ts` (the typed
`oraclePoolCategory` option). No BCHN or live-network check was run.
