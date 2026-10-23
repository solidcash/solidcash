# DS audit: direct-convention state covenants (records, mappings, chunks)

Base: feat/per-call df51215d6 (the tree moved to abbb7e0ec during the audit; the diff does not touch the
code below, all line numbers are at df51215d6). GTT = packages/solidc/src/generation/GenerateTargetTraversal.ts,
STT = packages/solidc/src/semantic/SymbolTableTraversal.ts. Read-only audit, nothing was run.

"Direct" below means composition 'direct' with the message bus off (`__messageBusExplicitlyDisabled === true`),
which is what the compiler picks for every graph-free contract (compiler.ts:4270-4283 narrowGraphFreeAutoMessageBus).

## Current follow-up status (2026-10-14)

The findings below preserve the original audit snapshot and its evidence. Current implementation and validation
status is recorded in `archive/docs:docs/security/security-audit-2026-10-feat-parity.md`.

- The DS-1 follow-up involving a direct singleton conditional scalar write is fixed. If-conversion had turned a
  skipped no-read write into an insert of an enumerable zero-valued node. The source branch now retains its
  activity flag, and compiler/SDK activity settlement keeps the predecessor unchanged and removes the planned
  insert. [AuditTranscriptStateIntegrity](../../packages/solidcash/test/e2e/AuditTranscriptStateIntegrity.test.ts)
  proves the skipped path creates no absent-key output, refuses a changed predecessor successor, and accepts the
  taken-path insert. This evidence does not establish additional multi-target conditional topology support.
- The same regression file verifies that a covenant-covered direct early return preserves its mapping record,
  and that a direct void `this.f()` mapping reader uses the caller's collection witnesses for distinct keys.
  The framed exempt-return mapping/data checks are covered by the
  [framed regression](../../packages/solidc/test/framed/master/audit-exempt-return.test.ts).
- The returning self-call fence after pending mapping writes remains in place. The focused external-getter
  refusal in [AuditDS6SameKeyAlias](../../packages/solidcash/test/e2e/AuditDS6SameKeyAlias.test.ts) passes.

These are focused local VM/compiler checks performed without BCHN tests. They supplement the
historical DS-1/DS-6 analysis without changing its original claims or implying that every DS finding is closed.

---

## DS-1  CRITICAL  CODE-CONFIRMED
### Any single-target verified-mapping write can be skipped with the route-only `predOut = -2` sentinel, and the collection then takes one output nothing checks

Files: GTT:26330-26341 (in-batch gate), GTT:26505-26517 (skip arm), GTT:30117-30123 (single-target transition
skipped on -2), GTT:30531-30551 + 30612-30630 + 30664-30674 (`directSmallCensus` cardinality), STT:3963-3990 (every fixed
sorted write, even a lone one, is a batch target with `__internal__vmapBatchPredOut_N` as a plain BIGINT ABI parameter),
GTT:29147-29191 (the alias preflight that binds -2 runs only for slots with `runtimeAliasPriorSlots`, i.e. routes).

Root cause. `-2` means "inactive route row / same-target alias". In `emitSortedValueUpsert` every in-batch write
is wrapped in `IF predOut != -2` (26338-26341); the ELSE arm is just `OP_DROP` unless the value is kept for a
later read (26511-26515). The single-target transition is wrapped in `predOut == -2 NOTIF` (30122-30123). The
direct cardinality then expects `(predOut >= 0) + 1` outputs and `(proof > 0)` inputs at the collection address
(30542-30550, 30612-30615). Nothing in a direct function rejects -2: the parameter has no range check
(BIGINT is not enforced, GTT:9870-9878) and the preflight only binds -2 for runtime-alias slots, which only a
message-bus route has (STT:3927-3935). The comment at 30533 ("A direct singleton ... has no inactive/alias (-2)
rows") states the assumption; nothing enforces it.

Attack (skip a one-time write). `function claim() { require(!claimed[msg.sender]); claimed[msg.sender] = true;
<pay msg.sender> }`. Tx: in[0] master (unlock: claim + witnesses Slot=H(me), Proof=k, Next=any, PredOut=-2),
in[k] the predecessor node P of H(me) at the slot coordinate (flag 1, masterIdx 0), fee input. Out: master
preserved, P recreated unchanged anywhere (one output at `claimed`'s address), payout. The read proves absence via
P; the write and its transition are skipped; inputs at the address = 1 = (Proof>0), outputs = 1. `claimed[me]`
never becomes true; repeat until the pot is empty.

Attack (forge a record). `deposit()` doing `balances[msg.sender] += v` (RMW, single target): co-spend my node N,
PredOut=-2, and output ONE node at `balances`' address with commitment `H(me) || N.next || 10^30`. The count is
1, nothing pins its commitment. Then withdraw honestly. Same for `allowance[from][msg.sender] -= amt` in
transferFrom (single target in `allowance`; the two-key `balances` batch is linear and does refuse -2): skip the
allowance decrement and drain the approver. A pure write with no read: Proof=0 (0 inputs expected) and mint one
arbitrary node, e.g. a second node for a victim's key.

The same hole is reached without -2 on the arm-not-taken path of a single conditional write (D15): the
preservation in `emitConditionalSortedWritePreservation` (45896-45912) is gated on an entry existing at the
fixed slot (`emitReadOnlyEntryExistsCheck`), so the spender puts a plain input there, and the counted output is
again free.

Fix. In every non-route function require `predOut >= -1` for every batch target before any upsert (emit it
next to the preflight), and make the single-target transition pin the target output's full commitment
(`H(k) || next || v`) itself rather than relying on the operation site. Pin the proof input's bytecode to the
collection address inside the transition verifier, not only at the operation site.

---

## DS-2  CRITICAL  CODE-CONFIRMED
### Direct data-NFT reads trust any own-category mutable NFT placed at the data position; with DS-3 the spender writes the whole contract state (owner included)

Files: GTT:31313-31327 (`emitTokenCategoryVerification`: category BASE only), GTT:37470-37540 + 38268-38325 (field
read = `OP_INPUTINDEX + offset` -> commitment -> decode), GTT:38089-38151 (`emitDataNftPreservationInline`: the
data-NFT covenant lock is pinned only in the framed branch 38102-38133; direct only checks input == output),
GTT:31392-31560 (`emitAutoCovenantVerification`: read-only = in==out commitment; fully written = never reads the
input, so the H1 tag is never checked), GTT:44498-44645 (strict C3 count compares category+capability, not lock).

Root cause. In the direct convention nothing ties input[master+offset] to the data-NFT covenant
(`emitDataNftLbc` is used only in framed preservation, deploy, upgrade growth and the census). A function that the
strict C3 count covers (no entry access) accepts any own-category mutable NFT there, at any lock, as long as it is
returned unchanged (read-only) or rewritten (written).

Attack (privilege escalation). Step 1 (via DS-3): call any census-path function (e.g. `transfer` on a
mapping) and add an extra output: attacker P2PKH, token {category C, mutable, commitment = a well-formed data-NFT
commitment with `owner` = attacker (and the right nftIndex tag if multi-NFT)}. The master's minting NFT authorizes
the mint and no census counts a P2PKH. Step 2: call `withdraw(amt)` (`require(msg.sender == owner)`, no
entry access): in[0] master, in[1] = the crafted NFT (signed by the attacker), out[1] = the crafted NFT returned
unchanged to the attacker. Category base matches, commitment in==out, lock in==out, strict count 1 == 1; `owner`
decodes to the attacker. The real data NFT is never spent.

Standalone variants (no DS-3): (a) H1 regression for a fully written data NFT: substitute a sibling data NFT (same
lock) at the offset; the census/count pass, the sibling is overwritten with this NFT's tag and the real one keeps
the old value, so two tag-k NFTs exist (pick-your-state later) and the sibling's fields are destroyed. (b) In a
strict-count function substitute a mapping node or chunk at the data offset: it is rewritten in place with the
data commitment (node list / chunk run permanently bricked; with attacker-chosen written bytes it can be shaped
into a valid node).

Fix. In every direct function pin `OP_UTXOBYTECODE(master+offset) == dataNftLbc(C)` (and the output) for each
accessed data NFT, as the framed branch already does; verify the nftIndex tag on the input of a fully written NFT
too.

---

## DS-3  CRITICAL  CODE-CONFIRMED
### Functions with entry access, dynamic writes, token containers or deploys conserve only sorted-collection and data-NFT addresses; every other own-category mutable NFT can be destroyed, rewritten or minted (C3 regression)

Files: GTT:9516-9523 (`countsOwnCategoryNfts` false for hasEntryAccess, token containers, dynamic writes, deploys),
GTT:45936-45993 (`emitDirectCollectionCensus`: skips `!collection.sorted`, skips "counted" batch/loop/iteration
collections, counts only collection addresses + data-NFT lock; emitted only when `__messageBusExplicitlyDisabled`,
45939-45941), packages/utils/src/state.ts:1894-1920 (entry covenant flag=1 path: any spend beside the master,
no output rule; dynamic chunks and value chunks use the same covenant, solidcash
src/stateful/covenant-helpers.ts:368), GTT:38720-38900 (dynamic read loop: lock + category + chunkIndex, no
content root).

Root cause. The 2026-07 C3 fix (strict count) is replaced by the census for these function kinds, and the census
does not cover dynamic-var chunk NFTs, non-sorted array-collection entries, root-addressed value chunks, or own
category mutable NFTs at any other lock.

Attack. Contract with `mapping(address=>uint) balances` and a dynamic `bytes32[] roots` (or `string`, chunk
packed `T[]`). Call `transfer(to, amt)`. (a) Destroy: co-spend every `roots` chunk with `<0> <1>` and do not
recreate them; length header says N, chunks are gone, every reader of `roots` is bricked forever. (b) Forge: add an
output at `roots`' chunk address, C mutable, commitment `push(i) || push(attackerData)`; later read `roots`
presenting the forged chunk at coordinate base+i (the read checks lock, category and index only). (c) Mint C
mutable NFTs at any other lock (used by DS-2). Same for value chunks (brick a long mapping value) and array
collections (DS-5).

Fix. Make the census total: count own-category mutable inputs and outputs (category+capability, as the strict
count does) and require `outputs - inputs == the inserts the verifiers authorized`, or add every dynamic-chunk
address, array-collection address and value-chunk family to the census with exact expected counts; refuse any
own-category mutable output at a lock outside the known families.

---

## DS-4  CRITICAL  CODE-CONFIRMED
### Integer mapping keys are hashed from the raw ABI bytes: non-minimal encodings of the same number are different slots

Files: GTT:25554-25617 (`emitSortedKeyHash`: bare parameter -> `OP_PICK` -> `emitMappingKeyIdentity` -> `OP_SHA256`),
GTT:25526-25546 (identity normalization only for evmCompat address keys), GTT:9820-9868 (param enforcement: no
canonicalization; plain `int` unchecked), GTT:16931-16958 (`uintN` bound check copies the value and uses
`OP_NUM2BIN`, which accepts non-minimal input: libauth format.js createOpNum2Bin `requireMinimalEncoding: false`;
the original stays on the stack unchanged).

Root cause. Script numbers are only required minimal when a numeric opcode consumes them; a key that is only
hashed may be pushed as 0x05, 0x0500, 0x050000, 0x85 vs 0x0580... The SDK hashes the minimal form; the covenant
hashes whatever bytes arrive.

Attack. `function redeem(uint256 ticket) { require(!used[ticket]); used[ticket] = true; <pay> }` (or
`mapping(uint => address) ownerOf` mint/transfer). Redeem with ticket=5 pushed as `0x05`, then as `0x0500`,
`0x050000`, ...: each is a different slot H(bytes), absence is proven with that slot's real predecessor, a new node
is inserted. Unlimited double-redeem; for ownerOf, a second owner record per id.

Fix. In `emitSortedKeyHash` (and the legacy key encoders) normalize integer/enum/fixed keys with `OP_BIN2NUM`
before hashing (BIN2NUM accepts non-minimal input and returns the minimal form), or refuse non-minimal integer
parameters at entry (`OP_DUP OP_BIN2NUM OP_EQUALVERIFY` style check).

---

## DS-5  CRITICAL  CODE-CONFIRMED
### Non-packed state arrays (array collections) still run the omission-prone legacy entry backend (C2 regression for arrays)

Files: compiler.ts:14522-14524, 15569-15572, 19522-19524 (`sorted = true` only for `MappingType`), AstBuilder.ts:5549-5555
(`T[N]` in native mode, nested `T[][]`, non-chunk-packable elements, struct-field arrays 2991-3000 -> `CollectionNode`
of `ArrayType`), GTT:25864-25945 (legacy read: `emitSlotExistsCheck` -> `OP_ELSE` default value), GTT:26911-26985 +
36100-36200 (legacy write: output pinned, old entry never required), GTT:31581-31627 + 45615-45700 (input lock
never compared with the collection address), GTT:45950 (census skips non-sorted collections). docs/arrays.md section 2
calls these "a `mapping(int => T)` with array syntax".

Attack. `int[8] claimed; function claim(int i) { require(claimed[i] == 0); claimed[i] = 1; <pay> }`. Second claim:
put a plain input at the entry slot coordinate: commitment empty -> "absent" -> 0; the write mints a second entry
for i. Repeat. Also: present `debt[i]`'s entry (same key/value encoding, same category) at `balance[i]`'s slot: the
read decodes it, preservation recreates it at its own lock, so `balance[i]` reads `debt[i]`'s value; or present a
C-mutable NFT minted to the attacker's P2PKH (DS-3) with commitment `enc(i) || enc(X)`.

Fix. Route every array collection through the vmap backend (`sorted = true` for `ArrayType` collections too), or
refuse them in direct compiles; never keep the `emitSlotExistsCheck`/default arm for state reads.

---

## DS-6  HIGH  CODE-CONFIRMED
### A conditional delete in an if/else lets the spender switch off the whole sorted-batch transition verifier

Files: GTT:28987-29014 (`emitGuardedSortedBatchTransitionVerification`), GTT:8318-8381 (softDelete = delete in a branch),
GTT:28875-28911 (conditional-delete path never binds `__internal__vmapBatchSlot_S`), GTT:36339-36390 (conditional-delete
verification gated on an entry existing at the fixed slot; checks the OUTPUT lock only), GTT:45943-45950 (census
skips batch collections).

Root cause. When every batch target is conditional and some entry is a soft delete, the verifier runs only if
`input[fixedSlot(S)].commitment[0:32] == vmapBatchSlot_S`. Both sides are spender-chosen (plain input at the slot,
or any witness value). With the verifier off, nothing pins predecessor relinks, `next`, or the output count at the
collection address of ANY batch collection in the function (multi-target linear batches included; with the op-site
-2 gate of DS-1 the upserts themselves can also be skipped).

Attack. `function f(uint id, address to, bool c) { if (c) { owners[id] = to; } else { delete pending[id]; } }`.
Call with c=true, a plain input at `pending`'s slot, any Slot witness: the guard is false; spend owners' predecessor
P, output NEW with any `next` (hide nodes so present keys read absent), do not recreate P, and append nodes
`H(x) || n || attacker` at `owners`' address. The conditional-delete check is skipped (no entry), the census skips
both batch collections. Even a function whose only write is `if (cond) delete m[k];` lets the caller mint arbitrary
`m` nodes.

Fix. Remove the guard; settle each batch target by its own activity (the op-site flag) and always run the
cardinality check. Bind the conditional-delete slot witness to H(k) and pin the conditional-delete input's lock to
the collection address.

---

## DS-7  HIGH  VM-PROVEN (mock), added after the audit
### The batch census counts a pure-read slot by commitment presence, not by lock

Found and proved by the `feat/parity` work, not by this audit. Lines at `25e887d0a`.

Files: GTT:30671-30680 (output census) and 30720-30729 (input census): every slot of the batch's collection that is
neither a target nor written or deleted adds `emitSlotExistsCheck` (commitment non-empty, GTT:3350-3362) to the
expected count. GTT:30607-30612: such a function never takes `directSmallCensus`. GTT:30745-30746: the actual count is
by lock (`emitVerifyChunkUtxoCount`). GTT:31653 (`emitEntryCategoryVerification`): a present slot needs only the
master's category base and the mutable capability. GTT:45713 (`emitEntryPreservationBody`): output equals input.

Root cause. A read that runs pins its input's lock to the collection entry address; a read in a branch the call
skips pins nothing, yet the census still counts its slot. Any own-category mutable NFT at any lock counts as a node.

Attack. A function writes `m[k]` and reads `m[j]` in a branch. Call it with the branch skipped and put a stray
own-category mutable NFT at `m[j]`'s fixed input (DS-3 mints one to the attacker's lock); preservation passes because
it is recreated unchanged. Both counts rise by one, so a real node `m[x]` can be spent at an unchecked index and
recreated with any commitment. The mock test rewrote `m[9]` from 60 to 61 in a call that wrote only `m[7]`.

Fix. Count the slot only when `OP_UTXOBYTECODE` of its fixed input equals the entry address, as
`emitDirectCollectionCensus` does. Done on `feat/parity` by `6e292ca1f` (merged as `4b8850496`), with the test
`packages/solidcash/test/e2e/BatchCensusReadSlots.test.ts`; not yet on `feat/per-call`.

---

## DS-8  HIGH  VM-PROVEN (mock), added after the audit
### A batch proof index may name a pure-read slot's input, which the census then counts twice

Found and proved by the `feat/parity` work, reported as pre-existing; not re-read on `feat/per-call` here.

Root cause. A batch target's proof input is the master input plus a spender-chosen offset (`proofIndex`,
GTT:30106-30110 at `25e887d0a`). Nothing keeps that offset off the fixed input of a pure-read slot of the same
collection, and the census counts both the proof and the read slot, so one input fills two expected places.

Effect (mock test). One node escapes the per-position checks: a record left the collection and the updated key
was duplicated.

Fix. Check every batch target's proof index against every read slot's input. Done for direct functions on
`feat/parity` by `228ea4a5e` (merged as `cc52f07e8`), with the test
`packages/solidcash/test/e2e/BatchProofReadSlotOverlap.test.ts`. Message-bus routes are not covered by that guard.

---

## Checked and sound
- Absence bracket is strict on both sides, `next == 0` is the only +inf, operands BIN2NUM-compared (GTT:25507-25523, 37952-37965).
- Present arm compares the full 32-byte slot bytes with H(k) (GTT:25483-25485, 25775-25777).
- Sorted reads pin the co-spent input lock to the collection entry address before reading it (GTT:25476-25479, 25748-25752).
- Entry/chunk covenant authenticates its own embedded category and the mutable capability, so a foreign-category fake node at an entry address is unspendable (state.ts:1897-1908).
- Composite keys: per-key sha256, concatenated, re-hashed, then sign-bit masked; unambiguous (GTT:25564-25617).
- canonicalizeExpression is operand-injective with a structural fallback; slots come from runtime keys so a canonical collision fails closed (STT:11899-12020).
- Non-batch scalar upsert pins the collection output count (GTT:26523-26556, 26812-26814).
- Two-target linear batch refuses -2 (predOut in {-1} or >= 0) and requires distinct targets (GTT:30163-30226).
- Batch insert recreates P' = proof.slot || target || proof.value at the proof input's lock with C mutable (GTT:30131-30148).
- Taken conditional vmap delete requires the exact node (input.slot == H(k)) (GTT:28883-28891).
- Unmatched sorted writes/deletes in runtime loops fail closed in direct codegen (GTT:26851-26866, 28940-28951).
- Multi-data-NFT reads of unwritten fields verify the nftIndex tag (GTT:38318); the gap is DS-2's fully written case.
- Strict C3 count for functions without entries/dynamic writes/containers/deploys (GTT:44498-44645).
- Direct upgrade growth limited to a contiguous run of canonical data-NFT outputs (GTT:44591-44638).

## Not reached
- Message-bus kernel contracts (graph edge present): census and D15 flags are gated on `__messageBusExplicitlyDisabled`; whether their non-route entries get equivalent checks was not traced.
- Sorted runtime loops (GTT:31885-32081, 32899-35947), 3+-target linear batches (rows/ranks arm), chunk counts (38383-38600).
- emitSortedStructFieldWrite, emitAliasConditionalWriteVerification / swap-remove alias path, value-chunk (root-addressed) pins.
- Value preservation for entries and token containers; delegate/delegatecall/split/merge paths.
