# Concept Validation: SolidCash Stateful Contract Model

*Prepared for third-party concept validation. This document describes the design and guarantees of SolidCash's stateful contract system, with enough implementation anchors that a reviewer can verify each claim against the code without reading the full 12k-line `GenerateTargetTraversal.ts`. Each section states a claim, enumerates the invariants that must hold, and points to the compiler and runtime sites that enforce them.*

*Abbreviations: `GTT` = `packages/solidc/src/generation/GenerateTargetTraversal.ts`. All other paths are given in full.*

---

## Section 1 / 7 : State Encoding Model

### 1.1 Claim

A SolidCash stateful contract persists state as a set of P2SH32 UTXOs across **six covenant types**. Each UTXO's locking bytecode is a deterministic function of the contract's token category plus a per-type salt. Each covenant enforces its own invariants on spending: identity, self-preservation, and value / token preservation.

**State identity.** The contract instance is identified by its master token category. Every auxiliary UTXO (entries, events, containers) is bound to that category via covenant salting, so a reviewer or the SDK can enumerate a contract's entire on-chain footprint from just the category and the artifact.

**State transitions.** Writes require the master minting NFT (at an unlocker-supplied index) to be spent in the same transaction. Reads preserve the input-to-output relationship 1:1 with byte-exact commitment preservation.

**State enumeration.** State can be reconstructed off-chain deterministically from `(category, artifact, stateLayout)` without trusting the SDK. If reconstruction is wrong, the resulting spending transaction fails under VM evaluation rather than being accepted with wrong data.

### 1.2 Why P2SH32 only

Stateful contracts MUST use the P2SH32 address type. This is both a runtime assertion and a structural requirement of the in-script address derivation.

Runtime check: `packages/solidcash/src/stateful/StatefulContract.ts:561` throws on any non-p2sh32 contract passed to the `StatefulContract` constructor.

Structural reason: the compiler emits in-script address derivation that computes child covenant addresses from a script-bytecode template using `OP_HASH256`. This produces 35-byte locking bytecodes in P2SH32 format (`aa 20 <32-byte-hash> 87`). P2SH20 uses `OP_HASH160` in its locking-bytecode wrapper and is therefore structurally incompatible. See `emitDataNftLbc` at `GTT.ts:8215-8281`, which constructs its own P2SH32 locking bytecode inside Script using `OP_HASH256` and the P2SH32 prefix / suffix constants.

The SDK container helpers additionally force P2SH32 for containers even if the parent contract's `addressType` field somehow disagreed, at `packages/solidcash/src/stateful/covenant-helpers.ts:120-122` and `:129-131`.

### 1.3 The six covenant types

| # | Type | Purpose | Salt (identity) | Builder (state.ts) | Inline LBC codegen |
|---|------|---------|-----------------|---------------------|---------------------|
| 1 | Data NFT | Master state slot | `categoryId` | `:31` | `GTT.ts:8215` (`emitDataNftLbc`) |
| 2 | Entry NFT | Mapping entry | `categoryId + collectionHash` | `:1030` | `GTT.ts:8019` |
| 3 | Named Event NFT | Emitted event record | `categoryId + eventNameHash` | `:1163` | SDK-built only |
| 4 | Anonymous Event NFT | Emitted event, anonymous | `categoryId` | `:1209` | SDK-built only |
| 5 | Token Container | Foreign-token custody | `categoryId + tokenContainerCategoryId` | `:1253` | `GTT.ts:11305`, `:11653` |
| 6 | Satoshi Container | BCH treasury | `categoryId` | `:1355` | `GTT.ts:10194` |

Identity property: each covenant embeds its salts as pushdata within the script, so the resulting P2SH32 address is deterministic and unique per `(contract-instance, covenant-axis)`. Two different contract instances (different `categoryId`) produce different addresses even for the same covenant type.

SDK address helpers (used by auditors to enumerate): `getDataNftAddress`, `getEntryNftAddress`, `getEventNftAddress`, `getAnonymousEventNftAddress`, `getTokenContainerAddress`, `getSatoshiContainerAddress`, all at `packages/solidcash/src/stateful/covenant-helpers.ts:78-131`.

### 1.4 Per-covenant concept and invariants

#### 1.4.1 Data NFT

*The contract's master state slot. One per contract instance. Holds all non-mapping state variables, encoded in the NFT commitment.*

Invariants enforced by `buildDataNftCovenantScript` at `packages/utils/src/state.ts:31-145`:

1. **Tri-path spending** selected by the top-of-stack flag byte:
   - `flag=1` (write): authorised by master minting NFT at caller-supplied `masterInputIndex`.
   - `flag=0` (read): no master needed, commitment preserved byte-for-byte on the output at this input's index.
   - `flag=2` (destroy / selfdestruct): allows the output at `OP_INPUTINDEX` to be absent. Valid only if this input has `mutable` capability (`0x01`) and the authorising master (at the supplied index) has minting capability (`0x02`) on the expected category. (See `:53-60` for the capability check.)
2. **Self-preservation** (flag=0 and flag=1): `OP_UTXOBYTECODE == OP_OUTPUTBYTECODE` at this input's index (`:119-123`).
3. **Category preservation** (flag=0 and flag=1): `OP_UTXOTOKENCATEGORY == OP_OUTPUTTOKENCATEGORY` at this input's index (`:125-129`).
4. **FT amount preservation**: output FT amount `>=` input FT amount (`:131-136`). Prevents drain via the read path.
5. **Exact satoshi preservation**: input value equals output value (`:138-142`).
6. **Master authority** (flag=1 and flag=2): master NFT at `masterInputIndex` has minting capability and matches expected category.

Auditor questions this section should answer:
- Can a read-only spender modify state? Commitment is `OP_EQUALVERIFY`'d at `:113-115`. Expected answer: no.
- Can the destroy path drain FT? FT preservation is inside the flag=0 / flag=1 branch, not flag=2. Chain of safety: destroy requires `mutable` on the input, and mutable capability is only ever held by the master-authored state UTXO. The reviewer should trace this chain end-to-end.
- Can two concurrent writers collide? Two write-path inputs pointing at the same output would both claim that output, which the base UTXO model rules out at the consensus layer.

#### 1.4.2 Entry NFT

*A mapping entry UTXO. One per `(mapping, key)` pair. The commitment encodes the key and value.*

Invariants (`state.ts:1030-1090`):

1. **Two paths**: write (flag=1 with master NFT) and read (flag=0 preserves commitment, value, bytecode, category).
2. **Read path is strictly satoshi-preserving**: `OP_EQUALVERIFY` on value at `:1080-1084`.
3. **Write path has NO self-preservation**. The master decides whether to issue an output at this input's slot. Absence is how entries are deleted.
4. `collectionHash` (20 bytes, embedded at `:1087`) makes the address unique per collection, preventing cross-collection address collisions when a contract has multiple mappings.

#### 1.4.3 Named and Anonymous Event NFTs

*Event emission records. Spendable only after a 144-block relative timelock, so the chain self-cleans after a short retention window.*

Invariants for named at `state.ts:1163-1186`; for anonymous at `:1209-1229`:

1. This input's token category matches the expected category, and its capability byte is empty (`none`).
2. Named variant embeds 20-byte `eventNameHash = sha256(signature).slice(0, 20)` (`computeEventNameHash` at `state.ts:1145-1148`). Each event overload therefore has a unique P2SH32 address.
3. Anonymous variant has no name hash. All anonymous events from a single contract share one address.
4. `OP_CHECKSEQUENCEVERIFY 144` prevents premature spending.

Concept check: event NFTs are strictly historical markers, not live state. Nothing in the contract reads them back. The 144-block CSV is a soft retention window after which anyone can sweep the dust, so any consumer requiring durable event records must index events off-chain within that window.

#### 1.4.4 Token Container

*Custody UTXO for a foreign token category held on behalf of the contract. Address is derived from `(masterCategory, containedCategory)`.*

Invariants (`state.ts:1253-1326`):

1. **Master path (flag=1)**: master minting NFT at `masterInputIndex`, expected master category.
2. **Merge path (flag=0)**: the output at `mergeOutputIndex` preserves locking bytecode (`==`), value (`>=`), FT amount (`>=`), and category (`==`) relative to this input.
3. **Single-input anti-double-merge**: the covenant loops all inputs at `:1297-1321` and verifies no other input shares this input's locking bytecode. Without this, two merge inputs pointing at the same output would double the merged value at that output.
4. Salt `tokenContainerCategoryId` gives a unique address per contained category.

#### 1.4.5 Satoshi Container

*The contract's BCH treasury UTXO(s). All `this.transfer()` calls draw from here rather than from the master UTXO.*

Invariants (`state.ts:1355-1425`):

1. **Master path (flag=1)**: master NFT plus expected category.
2. **Merge path (flag=0)**: output preserves locking bytecode (`==`), value (`>=`), category (`==`), FT amount (`>=`).
3. **Single-input anti-double-merge** (same pattern as token container, `:1394-1420`).
4. Salt is the category itself (`catInternal`). Exactly one satoshi-container address per contract instance.

### 1.5 Compiler / runtime bytecode equality invariant

**Claim.** Any inline covenant bytecode emitted by the compiler for on-chain address verification (deploy outputs, entry outputs, container outputs) is byte-for-byte equal to the output of the corresponding builder in `state.ts`. A mismatch would allow a bogus covenant UTXO to satisfy an in-script address check while actually enforcing different rules.

Where implemented inline:

- **Data NFT address** in `emitDataNftLbc` at `GTT.ts:8215-8281`. The script is split into five pushdata constants (`segment0` through `segment4`) and reassembled around four copies of the dynamic `catInternal`. The resulting byte string plus the P2SH32 wrapper must reproduce `scriptToBytecode(buildDataNftCovenantScript(cat))` exactly.
- **Entry NFT inline**: `GTT.ts:8019` and following.
- **Token Container inline**: `GTT.ts:11305` and `:11653`.
- **Satoshi Container inline**: referenced at `GTT.ts:10194`.

Verification channels:

- `packages/utils/test/state.test.ts` exercises each builder against known fixtures.
- E2E flows in `packages/solidcash/test/e2e/` that transact through each covenant implicitly assert byte equality: a drift changes the resulting P2SH32 address, causing the enforcing script not to match the produced UTXO.

**Maintenance risk**: updating a builder without updating its inline codegen, or vice versa. Recommended auditor spot-check: compare the `segment*` constants in the compiler against `scriptToBytecode(builder(placeholderCat))` by hand, and confirm this equality is asserted in test fixtures.

### 1.6 What concept validation should confirm

Checklist for the reviewer:

- [ ] The six covenant types cover all persistent state needs of a stateful contract. Any missing category is a gap in the model.
- [ ] Each covenant's identity salt produces a unique P2SH32 per `(instance, covenant-axis)`. Any address collision between distinct state objects is a critical flaw.
- [ ] Read paths cannot modify state. `OP_EQUALVERIFY` on commitment, bytecode, category, and value (either exact or `>=`).
- [ ] Write paths require master authorisation via an independent input whose index is unlocker-supplied but whose identity (category, capability) is verified by the covenant.
- [ ] Anti-double-merge prevents value inflation via simultaneous merge inputs on containers.
- [ ] Event NFTs are clearly documented to downstream consumers as ephemeral (144-block CSV), not durable storage.
- [ ] The inline-bytecode equals builder-output invariant is tested, and the tests cover every inline emission site.
- [ ] P2SH32-only is both asserted at runtime and structurally required by the in-script `OP_HASH256` address derivation.

---

## Section 2 / 7 : Master UTXO and Thread Lifecycle

### 2.1 Claim

The master UTXO is the authority anchor of a SolidCash stateful contract. It carries the contract's compiled bytecode as its P2SH32 locking bytecode, a minting NFT in the contract's unique category, and serves as the single point of authorisation for every state mutation across all six auxiliary covenant types (Section 1).

Every state-mutating write path in every covenant type verifies that the master UTXO is present as an input in the same transaction at a caller-supplied index (`masterInputIndex`) with the expected category and minting capability. This makes the master's presence a prerequisite for any meaningful state change.

Beyond explicit contract logic, the compiler emits **implicit self-preservation** around the master on every function, calibrated to the function's modifier set. No contract author writes these checks; they are imposed by codegen based on the modifier semantics described in Section 6.

### 2.2 Structure of the master UTXO

- **Locking bytecode.** The contract's compiled Script wrapped in P2SH32 (`aa 20 <sha256d(script)> 87`). This is what `contract.address` resolves to in the SDK, and what all deploy, upgrade, and normal-call self-preservation checks anchor to.
- **Token.**
  - Category: the contract instance's unique 32-byte category ID. Produced at deploy time per CashTokens consensus rules (derived from the deploy transaction's first input); identifies this instance.
  - Capability: `0x02` (minting).
  - Commitment: empty by convention. The master carries authority, not state; state lives in data NFTs (Section 1.4.1) and entries (Section 1.4.2). Commitment preservation is enforced via `emitMasterCommitmentPreservation` (`GTT.ts:9193-9203`) on non-stateful paths to prevent drift, but stateful functions are not required to touch the master commitment because they mutate data NFTs instead.
  - FT amount: optional. Contracts that self-custody FTs may carry them on the master; otherwise typically zero.
- **Satoshi value.** Typically the dust minimum unless the contract reserves operational BCH on the master. Treasury usually lives in the satoshi container (Section 1.4.5).

### 2.3 Master as a minting NFT

Because the master carries the `0x02` (minting) capability on the contract's category, it can create new tokens in that category under CashTokens consensus. SolidCash leverages this at every state-producing path:

- **State writes**: a new data NFT output with updated commitment is minted in the master's category; the master's presence and minting capability is what makes that legitimate under consensus.
- **Entry writes**: a new entry NFT is minted in the master's category.
- **Event emissions**: event NFTs are minted in the master's category (with 144-block CSV).
- **Container funding**: token and satoshi containers are master-authorised for spend.

The master's empty commitment distinguishes it from data NFTs (which hold state) and entry NFTs (which hold key-value pairs). Every auxiliary NFT in the system is differentiated from the master by non-empty commitment plus a non-minting capability (mutable for data and entry NFTs, none for event NFTs); the master is the only NFT of this category with minting capability, except transiently during split / merge.

### 2.4 Implicit self-preservation by modifier

At compile time the dispatch at `GTT.ts:1288-1332` selects the appropriate preservation set for the function's modifiers. All checks are emitted against the master index, which is `OP_INPUTINDEX` in normal functions or the altstack `_proxyMasterIndex` in delegate functions (resolved via `emitMasterInputIndex` at `GTT.ts:9211-9222`).

**Normal stateful function** (`GTT.ts:1303-1306`):

- `emitMasterSelfPreservation` (`GTT.ts:9164-9186`): input LBC equals output LBC; category and capability preserved (33-byte equality on `OP_UTXOTOKENCATEGORY`, which includes the capability byte).
- `emitMintingNftUniqueness`: the contract's category cannot gain net new minting NFTs in the transaction.

**Non-stateful function in a stateful contract** (guarded, `GTT.ts:1315-1331`):

- Above, plus `emitMasterCommitmentPreservation`. Prevents non-stateful functions from corrupting state implicitly.

**Upgrade function** (`GTT.ts:1299-1302`):

- `emitUpgradeSelfPreservation` (`GTT.ts:9413-9425`): **only** category and capability preserved (33-byte match). LBC is NOT preserved; this is the migration point.
- `emitMintingNftUniqueness`.
- `emitMasterCommitmentPreservation`: state commitment preserved across the migration.

**Selfdestruct function with state access** (`GTT.ts:1307-1310`):

- `emitMintingNftUniqueness` only. Master self-preservation is skipped because the master output is absent.

**Selfdestruct function without state access** (`GTT.ts:1311-1314`):

- Still `emitMintingNftUniqueness` (M6 fix, audit 2026-03-05). Prevents minting-NFT duplication during destruction.

**Delegate function** (`GTT.ts:1294-1298`):

- `emitMasterSelfPreservation` on the proxy (addressed via `_proxyMasterIndex`).
- `emitMintingNftUniqueness` on the proxy's category.
- `emitDelegateSelfPreservation` on the delegate's own UTXO (Section 4.2): LBC, value, category, minting capability, commitment, and FT amount all preserved.
- `emitDelegateMintingNftUniqueness` on the delegate's category.

**Unsafe tiers** (`GTT.ts:1206-1214`):

- Tier 0: nothing. No preservation. Master can be stolen, duplicated, or drained.
- Tier 1: `emitMasterSelfPreservation` + `emitMintingNftUniqueness`. Master identity and minting uniqueness preserved; everything else is the programmer's responsibility.
- Tier 2: tier 1 plus satoshi value preservation.

**Split and merge**: specialised covenant verifications; see Section 2.6 below.

### 2.5 Master's authority over other covenants

Every state-mutating covenant explicitly checks the master. The pattern, repeated across the six covenant types from Section 1:

```
<masterInputIndex> OP_UTXOTOKENCATEGORY
<32> OP_SPLIT
<0x02> OP_EQUALVERIFY                    // minting capability
<expected_cat_internal> OP_EQUALVERIFY   // correct category
```

Sites:

- Data NFT write path (flag=1): `packages/utils/src/state.ts:91-99`.
- Data NFT destroy path (flag=2): `state.ts:44-51`, plus `:53-60` for the this-input's mutable-capability check.
- Entry NFT write path (flag=1): `state.ts:1036-1043`.
- Token container master path (flag=1): `state.ts:1262-1268`.
- Satoshi container master path (flag=1): `state.ts:1361-1367`.

**Consequence.** A transaction that mutates ANY state object of this contract MUST include the master UTXO as an input. There is no back-door path to state mutation that bypasses this check. The master's presence is what binds all state changes into a single atomic authority event.

Reads (flag=0 on data and entry NFTs) do NOT require the master, because the read paths preserve state byte-for-byte and thus require no separate authority.

Event NFTs (Section 1.4.3) do not require the master for spending (they spend after 144-block CSV), but they are MINTED in the master's category during the emitting transaction; creation is master-authorised, cleanup after CSV is not.

### 2.6 Threads: split and merge

A "thread" is one master UTXO within a contract instance. The default is one thread. `split(N)` fans out; `merge(N)` fans in.

**Rationale.** Parallel throughput. A contract servicing many user interactions per block faces a single-UTXO bottleneck: only one transaction per block can spend a given UTXO. N threads allow up to N non-conflicting transactions per block by distributing load across N master UTXOs, all bearing the same contract identity (category + LBC).

**Minting uniqueness is relaxed for threading.** `emitMintingNftUniqueness` at `GTT.ts:9450-9506+` uses a counter approach rather than a strict `input_count == output_count == 1` check: it counts minting NFTs of this category on each side and requires `output_count <= input_count`. This permits `N` threads in and `N` threads out (steady-state multi-thread operation), and `N` in with `M < N` out (merge), while still blocking unauthorised minting-NFT creation. Category-scoped (`:9446`), so other categories are unaffected.

**Split mechanics** (`emitSplitCovenantVerification` at `GTT.ts:9797+`):

- One master input. Master self-preservation (`:9800-9801`: LBC, category, capability) on the surviving output.
- Satoshi value preserved on the surviving master (`:9803-9811`).
- Commitment preserved on the surviving master (`:9813-9814`). State snapshot is inherited.
- FT amount: input `<=` output (no drain, `:9816-9825`).
- `N` new minting outputs created with the same LBC and 33-byte category+capability, counted and verified against the `split` parameter (`:9827+`).

**Merge mechanics** (`emitMergeCovenantVerification` at `GTT.ts:9580+`):

- Two-path covenant: Path A for the surviving master (`INPUTINDEX == 0`), Path B for consumed masters (`INPUTINDEX > 0`).
- Path A (surviving, `:9580-9670`): master self-preservation, satoshi value preservation, commitment preservation, FT conservation (`sum(inputs) <= output`), and a loop over `N` consumed inputs that verifies each matches the surviving master's LBC and category+capability.
- Path B (consumed, `:9672-9700+`): verifies input 0 has the same LBC and category+capability (the consumed master references the survivor and cannot be spent into a different contract).
- `emitMergeMintingCount` (`:9670`): exactly one minting output on the contract's category after the merge.

**Thread identity.** All threads share the same category and LBC, so all threads are addressable by the same P2SH32 address. Auxiliary UTXOs (data NFTs, entries) are likewise shared in the address space per category; different threads can each hold distinct auxiliary UTXOs (distinguished by commitment / NFT slot index) or snapshot them at split.

**State semantics across threads.** Each thread carries its own state via its own data NFTs. The contract author's merge function body is where thread state is reconciled; the covenant verifies only that the resulting commitments on the survivor match what the merge function computes. Split similarly hands state-cloning logic to the contract author; the covenant verifies output commitments match split's computation.

### 2.7 Master across the contract lifecycle

**Deploy.** Child contract's master NFT is minted by the parent's `deploy`-modifier function. The child's LBC is derived at the parent's compile time from the child's artifact. Child's data NFTs are emitted as additional outputs with initial state commitments. Codegen: `emitDeployCovenantVerification` at `GTT.ts:8290+`.

**Normal operation.** Master is spent and re-created in every state-mutating transaction, with modifier-calibrated preservation applied (Section 2.4).

**Upgrade.** Master's LBC is replaced with a new compiled script; category, capability, and commitment are preserved. One-way migration unless the new code deliberately supports rollback via its own upgrade path.

**Selfdestruct.** Master is consumed with no output. Auxiliary UTXOs are typically destroyed in the same transaction via their destroy paths (flag=2 on data NFTs). The contract instance is permanently gone; the category cannot be re-used.

**Split.** One master becomes `N`; the contract now runs on `N` parallel threads.

**Merge.** `N` masters become one; thread count reduces. Can be repeated until back to a single thread.

### 2.8 Auditor questions for Section 2

- Can any state mutation happen without the master as an input? No; each write-path covenant checks the master at `masterInputIndex`. Walk every write path in Section 1 and confirm the check is present.
- Can an attacker forge a master NFT? No; category is produced at deploy time by CashTokens consensus and cannot be re-minted without the original minting NFT. A different category is a different contract instance.
- Can `emitMintingNftUniqueness` be bypassed by clever input ordering or tokens of other categories? Category-scoped (`:9446`); the loop inspects only NFTs matching this category's 33-byte `category + capability` signature. Verify the loop handles empty-category inputs correctly and does not over-count.
- Can the master's capability be downgraded silently (minting to mutable or none)? `OP_UTXOTOKENCATEGORY` returns 33 bytes including the capability byte; normal and upgrade preservation both `OP_EQUALVERIFY` the full 33 bytes. Unsafe tier 0 is the exception.
- Can split produce more than `N` threads? Split covenant counts outputs and compares against the split parameter; any excess fails.
- Can merge consolidate threads of different categories? No; the 33-byte category+capability equality blocks this at Path A's inner loop (`GTT.ts:9635-9640`) and Path B's input-0 check (`:9678-9685`).
- Can a split plus merge combination lose or inflate funds? Satoshi and FT conservation invariants on each side prevent loss; the minting uniqueness cap blocks inflation.
- During delegatecall, is the proxy's master always preserved? `emitMasterSelfPreservation` plus `emitMintingNftUniqueness` on the proxy (delegate mode, via altstack); `emitDelegateSelfPreservation` plus `emitDelegateMintingNftUniqueness` on the delegate. Both sets execute in a single delegate-function call.
- Does master commitment preservation hold across all paths that should preserve it? Upgrade, guarded non-stateful, and non-stateful-in-stateful paths preserve commitment; stateful-access paths do not (by design, as state mutation goes through data NFTs). Verify no stateful function can write to master commitment accidentally.

### 2.9 Checklist for Section 2

- [ ] Master UTXO is uniquely identified by its token category, produced at deploy time.
- [ ] Master's commitment is empty by convention; it carries authority, not state.
- [ ] Master's LBC is the contract's compiled script (may change only under `upgrade`).
- [ ] Every state-mutating covenant verifies the master at `masterInputIndex` with correct category and minting capability.
- [ ] Implicit self-preservation is calibrated to each modifier (normal, guarded, upgrade, selfdestruct, delegate, unsafe tiers, split, merge).
- [ ] `emitMintingNftUniqueness` enforces `output_count <= input_count` on the contract's category, category-scoped.
- [ ] Split creates `N` threads from one; each thread inherits state snapshot; identity and funds preserved.
- [ ] Merge consolidates `N` threads into one with FT conservation and LBC equality checks on all consumed inputs.
- [ ] Satoshi, FT, and commitment preservation invariants hold across every lifecycle event.

---

## Section 3 / 7 : Transaction Shape Model

### 3.1 Claim

Every stateful function call produces a transaction with a deterministic shape: a 1:1 input-to-output block layout where each logical slot has a compile-time offset from the master input's index. The covenant enforces that on-chain outputs appear at exactly those offsets, in exactly the required quantities, with exactly the required content. State mutation happens via output placement; for example an entry is "deleted" by a write-path master authorization combined with no output at that offset.

The master input's runtime index is the anchor for every output verification. Every output check compiles to `OP_INPUTINDEX + slot.offset OP_ADD` followed by the relevant inspection opcode (`OP_OUTPUTBYTECODE`, `OP_OUTPUTVALUE`, `OP_OUTPUTTOKENCOMMITMENT`, `OP_OUTPUTTOKENCATEGORY`, `OP_OUTPUTTOKENAMOUNT`).

### 3.2 The 1:1 block layout

`BlockSlotKind` enum (`packages/utils/src/artifact.ts:39-51`):

| kind | purpose |
|------|---------|
| `master` | the contract's master minting NFT |
| `dataNft` | state data slots (one per required state NFT) |
| `readOnlyDataNft` | read-only state access |
| `entry` | mapping entries (read or write) |
| `satoshiContainer` | BCH treasury input/output |
| `tokenContainer` | foreign-token custody input/output |
| `transfer` | outgoing BCH payment |
| `tcTransfer` | outgoing token-container token payment |
| `event` | emitted event NFT |
| `returnEvent` | return value to caller (external call) |
| `deploy` | child contract deployment output |
| `lowLevelCall` | `.call` / `.staticcall` / `.delegatecall` target |

Slot record shape at `artifact.ts:53-60`: `kind`, `offset` (compile-time, from master), optional `slotIndex` (for entry/tokenContainer/transfer/event/tcTransfer), optional `nftIndex` (for data NFTs), optional `conditional` flag (if the slot lives inside an if/else branch that may not execute). A function's full layout is frozen into the artifact at `artifact.ts:89` and consumed by the SDK to size outputs before building the transaction.

Codegen site: `getBlockSlotOffset` at `GTT.ts:387-395` resolves `(kind, slotIndex)` to an offset; `emitBlockSlotIndex` at `GTT.ts:401-410` pushes the absolute output index onto the stack.

### 3.3 Call-type shapes

For each call type, the SDK assembles the output block that the covenant demands.

**Regular function call** (master required). Inputs: master NFT, required data NFTs, optional entry NFTs, optional container inputs. Outputs in block-layout order:

- `master`: master NFT preserved (or with updated commitment for state writes).
- `dataNft[i]` for each required state NFT (updated or preserved commitment).
- `entry[i]` for each entry access (write-path may omit to delete).
- `satoshiContainer` if state writes trigger container spend.
- `tokenContainer[i]` for each accessed container category.
- `transfer[i]` for each `this.transfer()` call.
- `tcTransfer[i]` for each `this.tokenContainerTransfer()` call.
- `event[i]` for each `emit` statement.
- deploy outputs (child master + data NFTs) for each `deploy` modifier.
- return events and external-call outputs for any external calls.

**Upgrade function**. Relaxes bytecode preservation on the master output: input LBC and output LBC may differ (this is the one-way migration point). Category, value, commitment, and capability are still preserved.

**Selfdestruct function**. Master input spent with destruction flag; no master output required. Data NFTs spent with flag=2 (destroy path, see Section 1.4.1); no corresponding outputs required. Satoshi container and token containers may be drained in the same transaction.

**Split function**. One master input, N master outputs. Each clone preserves bytecode and state snapshot. Subject to fee caps and minting-uniqueness handling (audit 2026-03-12 fixes H-3 and M-6).

**Merge function**. N master inputs, one master output. Anti-double-merge invariants (matching locking-bytecode check, same pattern as container merges).

**Deploy function**. Parent master preserved; child's master NFT + data NFT outputs verified at block-layout `deploy` offsets. Codegen: `emitDeployCovenantVerification` at `GTT.ts:8290+`, with offset arithmetic at `:8298-8342`.

**Delegate function** (proxy side). Proxy's master input at `_proxyMasterIndex` (unlocker arg); delegate's input spent separately. All state-access paths use `_proxyMasterIndex` via altstack instead of `OP_INPUTINDEX`. Delegate's own bytecode, value, category, commitment, and FT amount are preserved by `emitDelegateSelfPreservation`. See Section 4.

**External read**. Caller A includes target B's master + required data NFTs as inputs. A's covenant verifies B's outputs at the correct offsets. Codegen: `emitExternalReadVerification` at `GTT.ts:8657+`.

**External call**. Full B block included (master + dataNfts). A's output block sits at its own offsets; B's block follows at computed offset. External-call base offset: `GTT.ts:416-423` (`getExternalCallBaseOffset`). Codegen: `emitExternalCallVerification` at `GTT.ts:8744+`.

### 3.4 Compile-time vs runtime verification

Compile time. `computeBlockLayout` (referenced at `GTT.ts:1004-1050`) walks the function body and enumerates every required slot. The output is a deterministic `FunctionBlockLayout` in the artifact. Once compiled, the layout is fixed and published.

Runtime. Every output verification in the emitted script compiles to `OP_INPUTINDEX + offset OP_ADD OP_OUTPUT...` followed by an `OP_EQUALVERIFY` (or `OP_VERIFY` for inequality checks). A mismatch halts the VM.

Conditional slots. An `if/else` branch that optionally activates a slot reserves the slot's maximum count across both branches. Only active-branch verifications run at runtime. The reserved output position still exists in the block, so an attacker cannot smuggle a different output into the reserved position; but the verification of that slot is gated behind the branch condition.

### 3.5 Auditor questions for Section 3

- Can the SDK produce an output at the wrong offset without the VM failing? No; each offset is hard-coded into the covenant's output verification.
- Can an unused slot be exploited? Conditional slots: when a branch doesn't activate a slot, no verification runs for that slot. Verify the reserved output position cannot be filled with attacker-controlled data that would be read by another verification path in the same transaction.
- Can two slots collide (overlapping offsets)? `computeBlockLayout` assigns monotonically increasing offsets. Check fixtures exercise nested conditionals, deploys with varying `dataNftCount`, and external-call groups.
- Can external-call offsets interfere with A's block? `getExternalCallBaseOffset` at `GTT.ts:416-423` places B's block after A's block plus `readOnly` plus `outState` reserved space. Verify no interleaving.

### 3.6 Checklist for Section 3

- [ ] Every `BlockSlotKind` has a defined offset rule and a verification codegen path.
- [ ] Block layout is deterministic given a function's AST (no runtime ambiguity).
- [ ] SDK places outputs at exactly the block-layout offsets; any deviation fails under VM.
- [ ] External-call blocks do not alias A's block.
- [ ] Conditional slots reserve output space even when inactive, and inactive slots cannot be attacker-filled.
- [ ] Deploy outputs verify child master + data NFT covenants at their slot offsets.

---

## Section 4 / 7 : Composition Model

### 4.1 Claim

SolidCash supports three composition primitives between stateful contracts:

1. **External read** (`IFoo(cat).stateVar`): caller A reads B's state by including B's master and data NFTs as transaction inputs; A's covenant verifies B's outputs preserve the read data.
2. **External call** (`.call` / `.staticcall`): A invokes B's function by including B's full block (master + data NFTs) in the transaction. B executes its own covenant; A verifies B's side-effects via return-event commitments.
3. **Delegatecall** (`.delegatecall`): A (the proxy) spends using B's (the implementation's) function bytecode, but all state reads and writes target A's UTXOs. B's own covenant is relaxed to allow proxy-operated semantics but still enforces self-preservation.

All three produce a single atomic transaction: A and B both execute their covenants in the same VM pass, and the transaction fails if either side's invariants are violated.

### 4.2 Delegatecall mechanics

**Stack setup at entry.** At a delegate function's entry, the unlocker pushes `_proxyMasterIndex`. Codegen at `GTT.ts:1099-1135` saves this to the altstack and verifies:

1. The UTXO at `_proxyMasterIndex` has minting capability (`0x02`); this is the proxy's master NFT (`:1109-1120`).
2. The proxy preserves itself: input LBC equals output LBC at `_proxyMasterIndex` (`:1124-1130`). Without this, the delegate could redirect the proxy's state elsewhere.
3. `_proxyMasterIndex != OP_INPUTINDEX` (`:1134-1135`): the delegate cannot point at itself; prevents bypassing delegate-self-preservation.

**Index dispatch during the function body.** `emitMasterInputIndex` at `GTT.ts:9211-9222` switches on `currentFunctionIsDelegate`:

- Delegate: `OP_FROMALTSTACK OP_DUP OP_TOALTSTACK` (reads `_proxyMasterIndex` without stack-depth dependency).
- Normal: `OP_INPUTINDEX`.

All state-access paths route through this helper. Call sites include `:405, :1976, :2528, :4432, :6425-6475, :6693, :7729-7782` (around 20 total). State reads and writes therefore target the proxy's slots throughout a delegate function.

**Delegate self-preservation at function exit.** `emitDelegateSelfPreservation` at `GTT.ts:9230-9305` verifies the delegate's own UTXO preserves:

- Locking bytecode: input LBC equals output LBC at `OP_INPUTINDEX` (`:9233-9241`).
- Value (`:9243-9251`).
- Token category (`:9253-9261`).
- Minting capability `0x02` on the input (`:9263-9281`).
- NFT commitment: delegate's own state cannot be written via delegatecall (`:9283-9291`). Prevents self-modifying delegates.
- FT amount: delegate's FTs cannot be drained (`:9293-9304`).

`emitDelegateSelfPreservation` uses `OP_INPUTINDEX` explicitly (not `emitMasterInputIndex`), because it refers to the delegate's own position, not the proxy's.

**Composition invariant.** A single delegatecall transaction contains two covenant executions: the proxy runs the delegate's bytecode (targeting the proxy's state), and the delegate runs its own bytecode (enforcing its own preservation). Both must succeed for the transaction to be accepted.

### 4.3 External read

`externalReadSlots` (compiler-side, `GTT.ts:266`) records each `IFoo(cat).stateVar` access. At compile time each slot gets a block-layout offset. At runtime `emitExternalReadVerification` at `GTT.ts:8657+` emits code that:

1. Verifies B's data NFT exists at the computed offset with the expected category and capability.
2. Decodes B's commitment to read the state variable.
3. Relies on B's own covenant to preserve its state during the transaction.

Because B's covenant runs on B's master input in the same VM pass, B's read-path invariants (`state.ts:113-115` for data NFT, `:1066-1070` for entry NFT) guarantee the state A reads was produced by B's legitimate write.

### 4.4 External call

`externalCallUtxoGroups` (SDK-side, `StatefulTransactionBuilder.ts:162`) holds each external call's master UTXO, required data NFTs, and block inputs. A's block reserves space before B's block; B's block follows at a computed offset (`GTT.ts:416-423` for base computation, plus per-group slot space).

Return values flow via return-event NFTs (`returnEvent` slot kind). B's covenant writes return data into a dedicated output; A's covenant reads that output to consume the return value. `extractCommitmentsFromTrace` (`StatefulContract.ts:2714`) reconstructs the return blob during auto-derivation.

Transitive chains (A calls B calls C). Groups are processed in reverse order during derivation (see Section 5), so leaf dependencies resolve first. The compiler's base-offset computation assigns non-aliasing offsets to each group.

### 4.5 Connect-time binding

The SDK's `connect()` accepts an `externals` map from interface names to concrete contract references, for example `{ IC: scC }`. ABI metadata `argSources` on external-call entries describes where to source each argument for the call, which allows fully-typed composition without runtime string matching. This supersedes the older `registerExternal()` pattern.

Entry points: `StatefulContract.connect()` accepts the externals map; `StatefulTransactionBuilder` consumes `externalCallUtxoGroups` at `:105, :162, :189`.

### 4.6 Auditor questions for Section 4

- Can a delegate function mutate its own state? `emitDelegateSelfPreservation` enforces commitment preservation at `GTT.ts:9284-9291`. Confirm every state-writing opcode in a delegate function targets the proxy via `_proxyMasterIndex`, never the delegate's own slot.
- Can the proxy be hijacked by substituting a malicious delegate? The proxy's covenant must verify the delegate's category and bytecode before handing control. Check the proxy's `.delegatecall` unlocker construction and the delegate's minting-capability check at `GTT.ts:1109-1120`.
- Can an external read return forged data? B's covenant runs on B's master input in the same transaction, enforcing state preservation on the same commitments A reads. A mismatch fails the VM.
- Can transitive external calls form a cycle? Derivation loops up to 20 iterations (`StatefulContract.ts:554, :2901`); a true cycle either reaches a fixed point or oscillates (detected at `:2176` and `:3087`) and fails cleanly.

### 4.7 Checklist for Section 4

- [ ] Delegate functions cannot modify the delegate's own state (commitment preservation enforced).
- [ ] Delegate functions redirect every state access to the proxy via `_proxyMasterIndex`.
- [ ] Proxy self-preservation at `_proxyMasterIndex` is enforced (input LBC equals output LBC).
- [ ] External reads preserve B's state via B's own covenant.
- [ ] External-call groups receive non-aliasing block offsets.
- [ ] Transitive chains (A through B through C) are resolved in reverse dependency order.
- [ ] Return-event commitments authenticate external-call return values.
- [ ] Blocked modifier combinations for delegate are enforced at compile time (see Section 6).

---

## Section 5 / 7 : Auto-Derivation Model

### 5.1 Claim

The SDK reconstructs all state commitments, entry commitments, event commitments, and transfer data off-chain using an iterative VM-based derivation procedure. The reconstruction does not need to trust any user-supplied state: any wrong derivation produces a transaction that fails under VM evaluation rather than a transaction that is accepted with corrupt data.

**Fail-safe property.** The covenant script is the final arbiter. If the SDK derives wrong output commitments, the covenant's `OP_EQUALVERIFY` checks on commitment / bytecode / value / category fail at broadcast, and the transaction is rejected by miners and full nodes. The SDK cannot produce a "wrong-but-accepted" transaction.

### 5.2 Derivation procedure

Entry point: `StatefulContract._deriveFullTransactionState` at `packages/solidcash/src/stateful/StatefulContract.ts:2595`.

**Phase 1: resolve external (B) state and return blobs** (`:2630-2845`).

- Pre-populate placeholder return-event outputs so Phase 1 probes have the correct output count (`:2630-2636`). Without this, `OP_SPLIT` on empty data would fail before B's verification is reached.
- For each external-call group, in reverse order (leaves first), build a probe and run the VM on B's master input (`:2644-2671`).
- `extractCommitmentsFromTrace` (`:273`) scans the VM trace for `OP_OUTPUTTOKENCOMMITMENT ... OP_EQUALVERIFY` and captures the expected commitment for each verified output.
- Filter by `outputIndexRange` (for example `bDataOutputRange = { min: bOutputBase + 1, max: bOutputBase + 1 + totalExpected }`). The range filter prevents cross-group leakage; it is a security-relevant fix from audit 2026-03-05.
- Apply B's derived state and return blobs to the probe (`:2676-2685`).
- If B's return-event commitment was not extracted on the first probe (VM halted earlier), re-run B's VM now that the data NFTs are placeholder-correct (`:2692-2713`).

**Phase 2: resolve A's state, entries, events, and transfers** (`:2900-3095`).

- Loop up to `maxDerivationIterations = 20` (`:554, :2901`).
- Each iteration builds a probe with all currently-known commitments, runs the VM on A's master input, and extracts newly-verified commitments for state, entries, events, and transfer values.
- Stop when no new commitments are extracted (fixed point reached).
- If state keeps changing without converging, oscillation is detected at `:3087` and the derivation aborts with `AutoDerivationError` rather than returning possibly-wrong data.

**Partial state is safe.** Progressive derivation means the probe transaction always uses the best-known commitments. Some slots may remain placeholders; their verifications will fail in the probe, but the VM trace still records every commitment that was successfully verified up to the failure point. Each iteration captures more, until the full state is known or oscillation / cap is hit.

### 5.3 Trace extraction primitives

**`extractCommitmentsFromTrace`** (`:273`). Scans a VM trace for the token-commitment verification pattern. For each match, captures the expected commitment bytes and the output index. Returns the array in the order seen. Respects the `outputIndexRange` filter.

**`extractVerifiedValuesFromTrace`** (`:432`). Generalised variant that extracts verified values from arbitrary opcode patterns (for example bytecode, value, amount). Used for transfer derivation. De-duplication note at `:442`: only the final value per index is kept, matching `extractCommitmentsFromTrace` behavior.

### 5.4 Transfer auto-derivation

For each `this.transfer()` call, the covenant verifies an output's LBC and value. `extractVerifiedValuesFromTrace` at `:2987-2996` scans the trace for these verifications and reconstructs the destination bytecode and amount. This removes the need for callers to manually declare transfer destinations.

For `this.tokenContainerTransfer()` calls, the covenant additionally verifies category; NFT-transfer paths also verify commitment and capability. The SDK derives all fields at `:3017-3060`.

### 5.5 What the SDK does and does not trust

Trusted (must be correct):

- The artifact (reflects the actual compiler output).
- The category ID (identifies the intended instance).
- The UTXO set surfaced by the network provider (see M-5 in Section 7.5).

Not trusted (derived, overwritten):

- Any `state` the user supplies; used only as a starting point for derivation and overwritten when the VM produces a different value.
- Any fee or output amount the user guesses; the covenant verifies actual amounts and the SDK rebuilds on mismatch.

### 5.6 Auditor questions for Section 5

- Can auto-derivation be deceived by a malicious provider returning forged UTXO state? The broadcast still fails because on-chain inputs would not match; UX may be confusing (M-5 is a pending gap).
- Can the 20-iteration cap be exceeded by adversarial contract design? Oscillation detection rejects non-converging state; hitting the cap without convergence fails with `AutoDerivationError`. Convince yourself 20 is sufficient for the contract patterns in scope.
- Can `extractCommitmentsFromTrace` miss a commitment or over-capture? The range filter (security fix) is precisely targeted and the pattern match on `OP_OUTPUTTOKENCOMMITMENT + OP_EQUALVERIFY` is narrow. Verify it matches only legitimate commitments, not incidental byte patterns in traces.
- Can the SDK produce a transaction that is accepted on-chain with wrong state? No, by the fail-safe argument. Walk the argument end-to-end.

### 5.7 Checklist for Section 5

- [ ] VM is the final arbiter: wrong derivation fails at VM evaluation, never produces an accepted transaction with wrong state.
- [ ] `extractCommitmentsFromTrace` pattern matches only legitimate commitment verifications.
- [ ] Output-index range filter is correctly applied to prevent cross-group leakage.
- [ ] Phase 1 processes external calls in reverse order for transitive chain correctness.
- [ ] Phase 2 oscillation detection rejects non-converging state rather than returning wrong data.
- [ ] `maxDerivationIterations = 20` is sufficient for real contracts; raising the cap is documented for users who need it.
- [ ] Transfer auto-derivation correctly reconstructs LBC and amount for every transfer path.

---

## Section 6 / 7 : Modifier Semantics

### 6.1 Claim

Every stateful function has a modifier set that defines its state-lifecycle effect. The compiler validates allowed combinations at `SymbolTableTraversal.validateModifiers` (`packages/solidc/src/semantic/SymbolTableTraversal.ts:1574-1901`) before any codegen occurs. A mis-combined modifier set is a compile error, not a runtime failure.

### 6.2 Modifier catalogue

| Modifier | Effect | Stateful-only |
|----------|--------|----------------|
| `pure` | No state access | no |
| `view` | Read state, do not write | no |
| `payable` | May receive satoshi inputs | no |
| `virtual` | No-op; all functions are implicitly virtual | no |
| `override` | Marks an override of an inherited function | no |
| `internal` / `external` / `public` / `private` | Visibility (at most one) | no |
| `unsafe(tier)` | Disables some or all covenant checks | yes |
| `upgrade` | Allows LBC swap on master output (one-way migration) | yes |
| `deploy` | Creates child contract instance | yes |
| `selfdestruct` | Destroys master and data NFTs | yes |
| `delegate` | Proxy delegates to this function body | yes |
| `split` | Fan-out master: one in, N out | yes |
| `merge` | Fan-in master: N in, one out | yes |

### 6.3 Unsafe tiers (`:1625-1648`)

- **tier 0**: disables ALL covenant protections. Minting NFT can be stolen or duplicated; state can be set to arbitrary values; total loss of funds is possible. Compiler emits a strong warning at `:1633-1640`.
- **tier 1**: preserves master NFT identity and minting uniqueness. State writes, entries, events, transfers, containers, external calls, and deploy are forbidden within the function body.
- **tier 2**: preserves tier 1 guarantees plus value preservation (no satoshi drain). Same body restrictions.

`unsafe` is only valid in stateful contracts (`:1621-1623`).

### 6.4 Blocked combinations (exhaustive)

Source: `SymbolTableTraversal.ts:1574-1901`. A combination marked incompatible produces `InvalidModifierCombinationError`.

Mutex pairs (either modifier plus the other equals compile error):

- `pure` vs `view` (`:1603`)
- `unsafe` vs `pure, view, upgrade, deploy, selfdestruct, delegate, split, merge`
- `upgrade` vs `unsafe, pure, view, internal, private, deploy, delegate, split, merge`
- `deploy` vs `unsafe, pure, view, internal, private, upgrade, selfdestruct, delegate, split, merge`
- `selfdestruct` vs `unsafe, pure, view, internal, private, upgrade, deploy, delegate, split, merge`
- `delegate` vs `unsafe, upgrade, selfdestruct, deploy, pure, view, internal, private, split, merge`
- `split` vs `merge, unsafe, upgrade, selfdestruct, deploy, delegate, pure, view, internal, private`
- `merge` vs `unsafe, upgrade, selfdestruct, deploy, delegate, pure, view, internal, private`
- `internal` or `private` vs `payable` (`:1793-1796`)
- `pure` vs `payable` (`:1799-1801`)

At most one visibility modifier (`:1594-1600`).

Stateful-only modifiers (reject non-stateful contracts): `unsafe, upgrade, deploy, selfdestruct, delegate, split, merge` (checked at `:1621, :1651, :1679, :1712, :1750, :1804, :1845`).

Externally-callable-only modifiers (reject internal and private visibility): `upgrade, deploy, selfdestruct, delegate, split, merge`.

### 6.5 Rationale for key blocks

- **delegate + unsafe** (`:1755`): unsafe skips covenant checks, but delegate relies on covenants to enforce proxy self-preservation and state redirection. Combining them breaks both.
- **delegate + upgrade** (`:1760`): upgrade changes the caller's own locking bytecode, but a delegate function runs inside the proxy's covenant context; "own LBC" would be ambiguous.
- **delegate + selfdestruct** (`:1765`): destroying a delegate or proxy from inside a delegatecall creates ambiguous semantics about which side is destroyed.
- **delegate + deploy** (`:1770`): deploys spawn child masters from the current contract's state; a delegate does not own the proxy's state to spawn children.
- **deploy + upgrade** (`:1707`): separate migration concerns; combining them would make deploy semantics unclear.
- **selfdestruct + upgrade** (`:1740`): one destroys, the other migrates; combining would be mutually defeating.
- **split or merge plus every other stateful-mutating modifier** (`:1813-1878`): split and merge already reshape the master layout; adding deploy or upgrade or similar would compound constraints beyond what is tractably verifiable.

### 6.6 Parameter constraints

- `split(paramName)`: the referenced parameter must be `int` (`:1880-1889`).
- `merge(paramName)`: the referenced parameter must be `int` (`:1891-1900`).

### 6.7 Auditor questions for Section 6

- Is every modifier combination in the matrix either allowed or explicitly blocked? Any unhandled pair falls through to codegen and may produce an ill-defined script.
- Does `unsafe(0)` surface its warning in user tooling (IDE, CLI)? Confirm end-to-end.
- Are stateful-only checks triggered for every stateful-only modifier? Spot-check `:1621, :1651, :1679, :1712, :1750, :1804, :1845`.
- Can a developer use `deploy` on a contract with no state variables but with collections or events? The `isStatefulContract` check at `:1618-1620` includes collections and events, so yes; confirm this matches intent.
- Does `virtual` being a no-op produce a warning that is visible to the developer? `:1588-1591` logs to console; confirm it reaches the user.

### 6.8 Checklist for Section 6

- [ ] Every modifier combination is either explicitly allowed or blocked with no fall-through.
- [ ] Unsafe tier 0 emits a prominent warning visible in user tooling.
- [ ] All stateful-only modifiers reject non-stateful contracts.
- [ ] Externally-callable-only modifiers reject internal and private visibility.
- [ ] Split and merge parameters are type-checked to `int`.
- [ ] The rationale for each blocked combination is documented here or in the compiler source.

---

## Section 7 / 7 : Trust Boundary

### 7.1 Claim

Correctness of a SolidCash transaction depends on a layered trust model. On-chain enforcement (covenant scripts) is the final arbiter for every state-affecting property. Off-chain SDK code (auto-derivation, address helpers, transaction assembly) is convenience only: if it errs, the resulting transaction fails at VM evaluation rather than being accepted with wrong state.

This section makes the boundary explicit so reviewers can direct scrutiny appropriately.

### 7.2 On-chain enforced (bytecode-critical)

These require bytecode-level scrutiny; any bug here is a consensus-visible flaw:

- All six covenant builders in `packages/utils/src/state.ts` (Section 1).
- Every inline LBC emission in `GenerateTargetTraversal.ts` (Section 1.5).
- Every output verification at block-layout offsets (Section 3.4).
- All state-access codegen: `emitMasterInputIndex` and its ~20 call sites (Section 4.2).
- `emitDelegateSelfPreservation` at `GTT.ts:9230-9305` (Section 4.2).
- External read and external call verification (Sections 3.3, 3.4).
- Deploy covenant verification: `emitDeployCovenantVerification` at `GTT.ts:8290+`.
- Upgrade, selfdestruct, split, merge path codegen.
- Fee caps and `maxFee` verification for static split / merge / destroy (audit 2026-03-12 H-3, M-6, M-7 fixes).

### 7.3 Off-chain SDK (convenience, fail-safe)

These are not correctness-critical but affect ergonomics and DX. A bug here is a usability issue, not a consensus flaw:

- `_deriveFullTransactionState` (Section 5).
- `extractCommitmentsFromTrace` and `extractVerifiedValuesFromTrace`.
- Transfer auto-derivation.
- Address derivation helpers in `packages/solidcash/src/stateful/covenant-helpers.ts`.
- `StatefulTransactionBuilder` assembly logic.
- Libauth template generation for debugging.
- Network provider UTXO queries (exception: see Section 7.5).

Fail-safe property. If any of the above errs, the probe VM and the final broadcast VM agree: the transaction fails, and the SDK surfaces an error. No transaction with wrong state ever reaches the mempool.

### 7.4 Structural requirements (assumed, not runtime-verified)

- P2SH32 address type; enforced at SDK construction (`StatefulContract.ts:561`). A contract built with the wrong address type never starts.
- Artifact integrity (stateLayout, block layout, ABI); assumed correct because emitted by the compiler in a single pass.
- Category ID format (64-hex); validated at every helper entry point (`covenant-helpers.ts:24-28`).

### 7.5 Known gaps (deferred per pending audit)

Reviewers should know what is explicitly out of scope:

- **M-4 (Electrum provider race condition)**. Concurrent transaction broadcasts against the same UTXO can race. Deferred per audit 2026-03-12.
- **M-5 (No UTXO data integrity validation)**. The SDK trusts the provider's UTXO data. A malicious provider could return forged UTXOs, causing the SDK to build a transaction against non-existent inputs. Broadcast fails (fail-safe), but error messaging is confusing. Deferred.
- **M1 2026-03-06 (Data NFT destroy-path output absence)**. Specific destroy-path invariant gap; migration cost high, deferred.
- **L-NEW-5, L-NEW-6**. Breaking changes deferred.

See `pending-audit-items.md` in the memory store for the full deferred list.

### 7.6 Where the reviewer should focus

Highest value, in priority order:

1. **Covenant builders** in `state.ts`. Any bug here affects every deployment.
2. **Inline LBC codegen** in `GTT.ts`. Must match builders byte-for-byte.
3. **Block-layout discipline** and offset assignment (Section 3).
4. **Delegatecall safety**: `emitDelegateSelfPreservation`, proxy self-preservation, modifier block list.
5. **External-call offset assignment** (no aliasing between groups).
6. **Modifier-combination matrix** (`validateModifiers`). Missing blocks would produce ill-defined scripts.

Lower value (but worth scanning):

- SDK derivation logic (fail-safe).
- Libauth template / debugging support (observability only).
- Address helpers (trivially delegate to builders).

### 7.7 Checklist for Section 7

- [ ] Every on-chain-enforced property is covered by the covenant scripts or codegen.
- [ ] Every off-chain SDK path has the fail-safe property (wrong output yields VM rejection).
- [ ] Structural requirements (P2SH32, artifact integrity) are either enforced at SDK construction or reliably produced by the compiler.
- [ ] Known gaps are documented with rationale and risk level.
- [ ] Reviewer time is directed to the highest-impact bytecode paths first.

---

*End of document. Prepared for third-party concept validation on 2026-04-21. When new covenant types, modifiers, or composition primitives are added, each section's invariant list and checklist should be updated; the shape of the document is intended to remain stable across changes.*
