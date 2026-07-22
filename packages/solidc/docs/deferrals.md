# Deferrals

A running log of features/fixes that were **investigated and intentionally deferred** - scoped enough to know
roughly what they'd take, but not shipped because the value/risk/effort did not justify it at the time. This is
the "we looked, here's why not yet, here's the trigger to revisit" list, distinct from unknown/unscoped gaps.

Related: `examples/solidity-corpus/ATTENTION.md` (autonomous-grind decisions + soundness caveats),
`docs/platform-differences.md` (BCH-vs-EVM primitives), `docs/solidity-gap-analysis.md`.

Format per entry: **what**, **why deferred**, **what it'd take**, **revisit if**.

---

## bytes / string `memory` PARAMS as `__yulmem` pointers (assembly interop)  — 2026-07-15

**What.** Local `bytes` (commit `3cadcba7`) AND local `string` (commit `25773dbb`, see the RESOLVED note below)
buffers now lower to `__yulmem` pointers, but a `bytes`/`string` **parameter** used inside inline assembly stays
value-copy, so `add(p, 0x20)` / `keccak256(p, len)` / `mcopy(add(p, ..), ..)` fail with a `bytes+int` type error.
Corpus files: `keccak_optimization_bug_string.sol`, `mcopy.sol`, `mcopy_empty.sol` (~3, all `inlineAssembly/`).
Only the PARAM case (and the uninitialized named-return case, its own entry below) remains deferred.

**Why deferred.**
- **Regression risk (high).** Materializing a bytes param into a pointer would bypass the
  `parseBytesPtr` / `bytesMemorySlice` bridge in `LowerInlineAssembly` that backs the signature-split idiom
  (`byte(0, mload(add(sig, 96)))`) and other bridge-handled param reads. Distinguishing "needs a real pointer"
  (mstore/mcopy/variable-length keccak) from "bridge-handled read" can't be done cleanly in `LowerMemoryModel`,
  which runs BEFORE the assembly lowering that owns the bridge.
- **Value (low).** These are EVM-memory-layout-idiosyncratic edge tests, not real contracts:
  `keccak_optimization_bug_string` hashes the *length word* via the pointer (a keccak-optimizer regression test);
  `mcopy` writes an *uninitialized* named-return bytes. They are compile-only corpus points and would not run
  EVM-faithfully on BCH anyway (BCH-native little-endian + sha256/keccak alias).

**What it'd take.** Re-add a Yul-ref trigger detector + a **Yul-aware remap** (a `YulBlockNode` is not a main-AST
`Node`, so the existing `remapNames`/analysis can't reach param references inside assembly - this is most of the
`collectYulRefs` machinery removed in the stage-4 taint lift) + a bytes/string deserialize loop; extend
`materializeParams`; and gate it so bridge-handled reads still take the bridge (else the signature idiom breaks).

**Revisit if.** A REAL contract (not an edge test) needs assembly to mutate or variable-length-hash a
`bytes`/`string` param's buffer.

**RESOLVED 2026-07-18 for the LOCAL `string` case (commit `25773dbb`).** The real trigger was EACC `EACCToken`
(`ERC20` + `ERC20Permit`): OZ `ShortStrings.toString(ShortString)` (reached via `EIP712._EIP712Name` -> the public
ERC-5267 `eip712Domain()`) does `string memory str = new string(32); assembly { mstore(str, len) mstore(add(str,
0x20), sstr) }` - a LOCAL `string` used as a raw memory pointer, which failed TypeCheck ("Type 'string' can not be
assigned to variable of type 'uint256'"). Root cause: a `string` local was never a `__yulmem` CANDIDATE
(`isHandledMemBytes` requires `BytesType`; `string` is `PrimitiveType.STRING`), so it stayed a string value and the
asm runtime path then built a uint256 offset from it. FIX (`LowerMemoryModel`): a string is an unbounded byte buffer
on BCH (string == unbounded bytes, mutually assignable), so route a local string through the SAME candidate detection
+ `lowerBytesDecl` path as a local `bytes` (new `isHandledMemString`), plus exclude the `new string(n)`-with-runtime-
length placeholder (`codegenError`, no BCH analogue) from the gate so it is not silently converted to a 0-byte
buffer. The emitted script is byte-identical to the bytes-local form; the boundary serializer's unbounded-bytes slice
is assignable back to a `string`. LOW RISK, LOCAL-ONLY - it does NOT touch the `parseBytesPtr`/`bytesMemorySlice`
bridge (that is the PARAM case, still deferred above). VM-verified (`MemoryModelStringAsm`: asm offset roundtrip
length@0/data@32 + byte-exact state serialize) + solidc byte-equality guard (`InlineAssemblyYul`); 2100 solidc + 127
memory/string/yul VM tests + the ECDSA signature-split bridge tests all green. The dead-code sibling
`Strings.toString` was already pruned (`b8e562e7`); this one is reachable so it could not be pruned. Cascade earlier
cleared: `HEX_DIGITS` (`fa67b4fc`), `getStringSlot` in a library free fn (`612e4cda`), `using ShortStrings for *` in
an imported inherited parent ctor (`f05620ce`).

**EACCToken then advanced PAST ShortStrings through TWO more OZ Math library-helper walls, both FIXED (commit
`03c2e383`):** (1) `Math.tryAdd` `unchecked { uint c=a+b; if(c<a) return(false,0); return(true,c); }` crashed codegen
"Expected variable 'c' does not exist on the stack" - an early return inside an `unchecked` block was never nested
into if/else (`EarlyReturnTransformation` had no `UncheckedNode` case + skipped a single-statement body), so
`visitBranch` desynced the fall-through stack (this ALSO silently miscompiled the contract-method form). (2)
`Math.mulDiv` (dead, fully-lowerable assembly) escaped `PruneUnreachableFreeFunctions`' post-lowering assembly check;
`LowerInlineAssembly` now stamps `hadInlineAssembly` before lowering so the prune drops it. See the codegen deferrals
below (§6) - the REMAINING EACCToken walls are both soundness-critical C2 features (still 1/15):

**`_useNonce` (value-returning C2-writer inline) - RESOLVED 2026-07-19 (commit `aedd13ca`).** OZ `Nonces._useNonce`
`unchecked { return _nonces[owner]++; }` (EIP-2612 permit) is a value-returning internal helper doing a C2 mapping RMW;
it co-spends the sorted entry slots (block layout) so it must inline into its entry caller. The first attempt was
VM-proven UNSOUND (the `3be9a3eb` `return m[k]++` reconstruction is POSTVAL-MINUS-1, `m[k]=m[k]+1; return m[k]-1`, a C2
read-AFTER-write of the same co-spent entry -> OP_VERIFY fail). FIXED, three parts, each VM-adversarial-verified
(`NonceRmwInline.test.ts`): (1) `DesugarPostfixExpressions` lowers a mapping return-postfix to READ-OLD-TEMP
(`__pf=m[k]; m[k]=m[k]+1; return __pf`) where the RMW read COALESCES with the single co-spend (reduces to the sound
assignment `n=m[k]++`); temp type from `CollectionNode` `MappingType.valueType`. (2) `InlineReturningStateHelpers`
`eligibleShape`/`inlineCall` unwrap a lone `unchecked` body (`effectiveStmts`) - `readsEntry` already makes it eligible.
(3) `SymbolTableTraversal.canonicalizeExpression` resolves a local key TRANSITIVELY through `localKeyDefs` (the inline
binds `__rhN_owner = pkh`, `pkh = hash160(pk)`) so the SDK `evalComputedKey` reaches the root; cycle-guarded; LOOP VARS
are excluded from `localKeyDefs` (a `for(i)` counter must not resolve to its `0` init, else a per-iteration key `xs[i]`
corrupts). EACC EACCToken now compiles PAST `_useNonce`.

**Non-bool insert/RMW loop -> CLEAN COMPILE fail-close - RESOLVED 2026-07-19 (commit `5bc59d08`).** The range-splice
insert-loop covenant is BOOL-LITERAL only (`emitSortedInsertLoopBody` pins each chain node value to `0x01`/empty; it
walks the SORTED chain and can't map a chain position to a source value without a permutation/value witness). A per-key
`for(i) w[ks[i]] = vs[i]` / RMW `+= vs[i]` used to MATCH `findSortedInsertLoopWrite` (any sorted scalar), compile, then
REVERT at runtime (or, with multitransfer's 2nd same-key write, crash `__entry_key_enc_0`). Now the match requires
`expression instanceof BoolLiteralNode` -> non-bool falls to the clean `SortedMappingCodegenPendingError`. Sound
(fail-closed earlier; VM-proven a non-bool insert loop reverts - `SortedInsertLoopNonBool`).

**`multitransfer` (C2 two-write + diff-key RMW-in-loop) - two pieces, one PARTLY SHIPPED, one deep.** `for (i)
_transfer(msg.sender, recipients[i], amounts[i])` inlines to TWO C2 writes per iteration: `_balances[from]` (SAME key =
msg.sender) + `_balances[to] += amt` (DIFFERENT key each iter). Full form still a clean fail-close.

- **(a) SAME-KEY scalar RMW-in-loop - IDENTIFIER key SHIPPED (2026-07-19, `2f780468`, `C2ScalarCacheInLoop`).**
  `CacheMappingEntryInLoop` now caches a scalar C2 entry written to the same INVARIANT identifier key more than once /
  in a loop: `for(i) balance[owner] -= amts[i]` reads `balance[owner]` once -> mutates a local -> one upsert (was a
  double-spend revert). VM-proven exact (100-10-20-30 = 40, wrong value reverts). Also makes straight-line `m[k]+=a;
  m[k]+=b` coalesce. **SINGLE `msg.sender` / `tx.origin`-keyed C2 = RESOLVED 2026-07-19 (`110e4e43`, MsgSenderC2.test.ts,
  VM-proven).** On BCH a direct call's msg.sender = tx.origin = the first native P2PKH input's lockscript
  (`emitTxOrigin`). Shipped: (1) a `msgSender` keySource kind (`classifyKeySource` detects a NullaryOp MSG_SENDER/
  TX_ORIGIN key), carried through `KeySourceInfo`/`KeySourceAbi` (+`senderOp`) into the artifact; (2) SDK computes slot =
  `keyToSlot(the connected Signer's P2PKH lockscript)` at the sorted key-resolution site + the entry-search loop; (3) it
  FORCES the signer's native P2PKH funder input so `emitTxOrigin` resolves to it (`needsSenderInput` bumps
  neededFunders), and the fee-estimation `funderUnlockSize` no longer tries to sign a P2PKH funder with empty
  sourceOutputs (fixed 107 B). SOUND: a wrong SDK slot fails the on-chain `slot == keyToSlot(msg.sender)` check; a caller
  cannot forge another's msg.sender without their P2PKH signature (VM-proven CROSS-SENDER ISOLATION: bob reads his own
  slot, cannot touch alice's balance). Insert+update+read + tx.origin all pass. The old compile fail-close
  (`assertSortedKeyDrivable`, `bfbd652b`) is REMOVED - the case is supported. Needs a connected Signer (else a clear
  error). Cross-contract msg.sender (non-zero `_msgSenderCategory` = a caller contract, not a P2PKH) is out of scope
  (reverts, fail-closed). **multitransfer's DEBIT half `for(i) bal[msg.sender] -= amts[i]` = RESOLVED 2026-07-19
  (`12dafc89`, MsgSenderC2):** `CacheMappingEntryInLoop` now accepts an INVARIANT nullary key (a `KeyKind` = id |
  nullary), so the msg.sender RMW-in-loop reads bal[msg.sender] once -> accumulates -> ONE flush (the flush is the
  proven single msg.sender write). VM-proven: `bal[msg.sender]=100` then `debitMany([10,20,30]) = 40` exactly, `chk(60)`
  reverts. So multitransfer's DEBIT works; only the CREDIT (b) remains.

- **(b) DIFF-KEY credit `for(i) bal[recipients[i]] += amounts[i]` - RESOLVED 2026-07-19 (`941dd7de`+`1dca4526`+
  `090f4e35`, SortedUpsertLoop + FullMultiTransfer, VM-proven).** Built as a PER-ITERATION UPDATE loop (existing
  recipients), NOT the range-splice: emitSortedUpsertLoop{Setup,Body,Teardown}. Each iteration co-spends recipients[i]'s
  OWN entry at input[master+blockSize+counter], reads [coSlot|coNext|coValue], and mints coSlot|coNext|(coValue op v[i])
  at output[..+counter]; teardown pins entry-input-count == entry-output-count == counter+nFixed. The scoped "hard
  problems" DISSOLVED: (P1) NO on-chain array hashing in the untracked region - recipients[i]/amounts[i] are read in
  TRACKED context at the body top (via emitSortedKeyHash + visit) and PICK'd with an untracked offset, exactly like the
  loop-invariant-value insert loop; (P2) supply is conserved by the SHARED amounts[] param (debit reads the same v[i]),
  no cross-statement coupling needed. Source order == counter order (1:1 co-spend/mint) = NO permutation. DUPLICATE
  co-spend + same-gap CONFLICTS fail CLOSED with a clear SDK error (each entry co-spent once). VM-proven adversarial:
  exact per-key sums, wrong-value revert, duplicate fail, the `-=` variant, and int/bytes20/ADDRESS keys. **Two enabling
  fixes:** address[] element args are now encoded as locking bytecode (`1dca4526`, was the raw address STRING); a SORTED
  RMW loop write is `inLoop` even alongside a fixed entry access, and the teardown count is counter+nFixed - so the cached
  `bal[msg.sender] -= v[i]` DEBIT and the credit loop COEXIST (`090f4e35`). **The FULL ERC-20 multiTransfer works
  end-to-end** (FullMultiTransfer: alice 1000->970, bob 100->110, carol 200->220 in one tx). `ecrecover` + the EIP712
  domain separator sit behind multiTransfer, now reachable.

- **(b2) DIFF-KEY credit to a NEW recipient (INSERT-in-loop) - RESOLVED 2026-07-19 (`125cb014`, SortedUpsertLoop,
  VM-proven).** The per-iteration credit loop now BRANCHES per recipient on `coSlot == keyToSlot(k[i])`: UPDATE (present)
  mints 1 node and bumps a cumulative outCounter by 1; INSERT (absent, `+=` only) verifies `coSlot < Hk < coNext`, mints
  P' = coSlot|Hk|coValue AND NEW = Hk|coNext|v[i] at output[..+outCounter/+1], and bumps outCounter by 2. Dual counters:
  iterCounter = one co-spend per recipient (bracketing predecessor for an insert, own entry for an update); outCounter =
  cumulative mints. Teardown pins entry-input == iterCounter+nFixed and entry-output == outCounter+nFixed. A `-=` on an
  absent account fails closed (can't debit nothing). SDK plans insert-or-update from the ORIGINAL list, commitments in
  cumulative output order, with a `cospent` set that fails closed on two-new-in-one-gap or a duplicate. VM-proven:
  mixed update+insert in one loop, multiple new recipients in distinct gaps, and same-gap / duplicate / `-=`-to-absent
  all fail closed.

- **FULL multiTransfer to a NEW recipient - WORKS for the common case (`5856dfc5`, FullMultiTransfer, VM-proven).** The
  cached msg.sender DEBIT + credit upsert loop with an INSERT co-exist end-to-end WHEN the new recipient's bracketing
  predecessor is UNTOUCHED (HEAD, or an entry not otherwise co-spent this tx). VM: debit alice 1000->980 + INSERT carol
  (predecessor a bystander) = carol 20, bystander unchanged, supply conserved. Recipient slots are sha256-random, so an
  untouched predecessor is the usual topology. Collision DETECTION is now COMPLETE + CLEAN: the SDK pre-seeds the
  upsert-loop `cospent` set with the collection's FIXED (non-loop) entry co-spends (the msg.sender debit entry), so the
  msg.sender-predecessor case fails closed with the same clear "split into separate transactions" message as the
  recipient-predecessor case (was an opaque tx-builder "Duplicate input detected").
  **MSG.SENDER MERGE case (a-real) - RESOLVED 2026-07-19 (`69d1ed93`, MsgSenderMerge, VM-proven).** A new recipient whose
  bracketing predecessor is the DEBITED msg.sender now WORKS: the debit entry is co-spent ONCE and re-pointed to the new
  node. Built exactly as designed: (1) loop setup pushes a re-point register `(sorted_upsert_repoint)` when one fixed
  (non-loop) debit entry coexists; (2) the loop's INSERT branch reads the DEBIT entry's REAL input and tests
  `dSlot < Hk < dNext` (the omission anchor - an entry between makes dNext=that and it fails -> normal path), and on a
  match MERGES: `require(register==0)` (two-in-gap fail-closed), mint ONLY the NEW node `[Hk|dNext|amt]`, record
  register=Hk, NO trailing co-spend (iterCounter+=0, so counts still reconcile); (3) the generic `emitSortedValueUpsert`
  flush (gated on a `pendingRepoint` field) mints `[slot | (register!=0 ? register : coNext) | v]`; (4) SDK: when a new
  recipient's predecessor IS the debit entry, mint only the NEW node (no separate co-spend/P'), the covenant re-points
  the debit output and the AUTO-DERIVATION fills it (no explicit debit-write override needed - confirmed). Soundness all
  covenant-enforced (in-gap = no omission; single merge; flush pins msg.sender->register + loop pins+counts NEW = chain
  complete no orphan; supply via shared amounts). VM-proven: bob 980 + carol 20, a later read walks HEAD->bob->carol
  (chain valid) + bob==1000 reverts, two-new-in-bob's-gap fails closed.
  **CASE (b) RESOLVED 2026-07-19 (pending-defer register, VM-proven):** a new recipient R whose predecessor is another
  CREDITED recipient P (not the debited msg.sender). P must be co-spent ONCE serving both its own value-update and R's
  insert re-point. Built with a PENDING-DEFER register (chosen over the cross-index FOLD design once-scoped here - it
  avoids the OOB / read-recipients[i+1] intricacy): each UPDATE iteration co-spends its entry but DEFERS the mint into
  pu_slot/pu_val/pu_next (emitSortedUpsertLoopSetup pushes them for +/set); the NEXT iteration's flush
  (emitSortedFlushPendingRepoint) re-points the pending to the current key Hk IFF `pu_slot < Hk < pu_next` (proving Hk a
  new node right after P) - minting P'=[pu_slot|Hk|pu_val] + NEW=[Hk|pu_next|amt], clearing the pending, and leaving
  consumed=1 so the caller skips R's own processing (R co-spent nothing - its predecessor was co-spent when deferred).
  Otherwise mint the pending normally (emitSortedFlushPendingNormal, also run at teardown for the last one). Look-BEHIND,
  so no cross-index read. The in-gap check against P's REAL nextKey is the omission anchor (an existing entry between
  makes pu_next=that and Hk<pu_next fails -> normal path). The defer preserves output ORDER, so the SDK is unchanged for
  every existing case; the SDK mirrors the fold via lastDeferred (re-points the predecessor's commitment in place +
  appends NEW). REQUIRES ADJACENCY (predecessor credited immediately before R) - else fail-closed (one UTXO can't be
  co-spent twice). VM-proven: MergeCaseB + FullMultiTransfer case-b fold in 2 fixtures, chain valid, supply conserved;
  fail-closed on msg.sender-also-recipient + two-new-in-one-gap. **NON-adjacent case-b is now ORDER-INDEPENDENT
  (`2e3af87d`):** the SDK reorders recipients+amounts (as a pair, preserving each recipient's amount) to place each new
  recipient right after its credited predecessor, then writes the reordered arrays to BOTH args AND finalArgs (finalArgs
  builds the master unlocker, so the encoded tx arg must match the commitment order). VM-proven: `[alice(new),
  carol(update)]` reorders to `[carol, alice]` -> same result as adjacent. Fires only when a case-b pair exists.
  **SAME-GAP CHAINS off ANY predecessor RESOLVED (`805c4d92` credited, `cfb7a9db` untouched/HEAD + order-independent):**
  2+ new recipients in ONE gap now chain regardless of what the gap's predecessor is. Each new node is DEFERRED (set as
  the new pending) instead of minted, so the next new key folds into it via the same in-gap flush: P -> R1 -> R2 ->
  P.oldNext off ONE co-spend. The re-point flush defers for a credited-predecessor gap; the emitNormalStep INSERT branch
  defers for an untouched/HEAD-sentinel gap (fresh-map airdrop cluster). Omission-proof because P's REAL nextKey proves
  the whole gap (P, P.oldNext) is empty of existing entries. SDK fold is GEOMETRIC (slot in the deferred entry's gap),
  works for an update predecessor AND a chained new node; the reorder is now GAP-BASED (groups every gap's inserts,
  sorts ascending, places case-b gaps after their update and untouched/HEAD gaps consecutively) so all chains are
  order-INDEPENDENT. VM-proven (SameGapChain: credited K0->K1->K2, fresh-map HEAD->K0->K1, descending [K1,K0] reorder).
  (Note: an earlier untouched-chain attempt hit a covenant OP_VERIFY - the root cause was an inconsistent intermediate
  state, NOT the mechanism; re-applied on top of the committed geometric-fold + ascending-sort it is VM-clean.)
  **The DEBITED msg.sender's OWN gap now chains too (`d075dfbe`):** the debit merge DEFERS its first new node R1
  (records register = R1 for the debit re-point, sets the pending to R1) instead of minting it, so a further new key in
  the debit's gap chains off R1: msg.sender -> R1 -> R2 -> dNext off the single debit co-spend. SDK runs the geometric
  fold BEFORE the debit-merge check (R2's original-list predecessor is the debit, but it chains off the deferred R1).
  VM-proven (MsgSenderMerge: bob -> carol -> alice, bob debited 50, chain-valid).
  **SELF-TRANSFER (msg.sender listed as its own recipient) nets out (`7033d9a1`):** a self-transfer within the batch
  (`bal[msg.sender] -= a; bal[msg.sender] += a`) nets out, so the SDK drops the msg.sender entry from recipients+amounts
  (the debit then sums total - own, and msg.sender is co-spent ONCE as the debit) - the identical net, matching Solidity.
  VM-proven (FullMultiTransfer: multiTransfer([bob, alice],[10,20]) from alice -> alice 990, bob 110).
  **DUPLICATE RECIPIENT accumulates (`feae8a54` per-key, `69da5ad9` scalar/const):** the same key listed 2+ times -
  Solidity accumulates for += / -= ([a,a],[10,20] -> a += 30), takes the last for =, delete is idempotent. Per-key: the
  SDK MERGES duplicates into one entry (co-spent once) with the combined amount before the self-transfer filter /
  reorder; for += the merged sum equals the original so a coexisting debit is unchanged. Scalar/const (`+= amount` /
  `+= 100`, no per-key array to merge): the SDK GROUPS a duplicate's occurrences adjacent and the covenant's pending
  flush ACCUMULATES on Hk == pu_slot (co-spend once, apply the scalar per occurrence); scalar/const `set` + delete are
  idempotent so the SDK dedupes. Works for existing (accumulate) + new (single insert). Scalar `-=` ALSO accumulates
  now (`6ca4cea8`: pending-defer activated for op `-`, its insert path gated off - a debit can't create an entry).
  VM-proven (FullMultiTransfer [bob,carol,bob] -> bob += 40; SortedUpsertLoop per-key 3 += 30 / new 5 = 30, scalar
  3 += 100 / new 9 = 100 / non-adjacent [3,7,3] grouped / const set idempotent / scalar -= [3,7,3]-30 -> 3=40,7=170).
  **The C2 ERC-20 multiTransfer surface is COMPLETE end-to-end** (every same-gap shape, order-independent, +
  self-transfer, + duplicate incl. scalar). The only residual is N per tx bounded by transaction size - and that bound
  is GENEROUS (thousands of entries per tx), so it is a practical non-issue; pagination across txs covers larger still.

- **(b3) ABSOLUTE per-key assignment loop `for(i) m[k[i]] = v[i]` - RESOLVED 2026-07-19 (`644532b1`, op=set,
  VM-proven).** A pure per-key assignment (value REPLACES, not accumulates) now routes through the SAME upsert loop
  with op='set': present key -> UPDATE to exactly v[i]; absent key -> INSERT v[i]. This retires the "per-key value
  insert loop (permutation/value-witness)" deferral - the 1:1 co-spend/mint in SOURCE order needs no permutation.
  findSortedUpsertLoopWrite also matches a MappingAssign whose RHS is a per-iteration ArrayAccess (vs[i]); a
  loop-INVARIANT param (`= v`) still routes to SortedInsertLoopValue, and `= 0` / delete-in-loop still fail closed
  (neither is an ArrayAccess RHS). emitSortedUpsertLoopBody's UPDATE branches on op ('set' mints v[i] directly;
  '+'/'-' mint coValue OP v[i]); the INSERT branch is shared (an absent-slot insert yields v[i] either way). SDK:
  op==='set' -> UPDATE newVal=amt. VM-proven (SortedUpsertLoop): replace-not-add, mixed set+insert, wrong-value revert.

- **(c) LOOP-INVARIANT non-bool value insert loop - RESOLVED 2026-07-19 (`SortedInsertLoopValue`, VM-proven).** `for(i)
  m[ks[i]] = v` where `v` is a loop-INVARIANT param (same value for every inserted node) is distinct from (b)'s per-key
  permutation - all nodes share value `v`, no source/sorted-order mismatch. The SDK already minted `valueTail =
  encode(valueParam arg)` into every node (`StatefulContract` ~5600-5629); only `emitSortedInsertLoopBody` pinned
  node.value to `0x01` (so it VM-reverted for `v != 1`), which `5bc59d08` fail-closed. Now `findSortedInsertLoopWrite`
  also matches an 'int'-kind IdentifierNode value that is a current-fn PARAMETER, and the body PICKs that variable +
  EQUALVERIFYs `node.value == v` (the stored int tail is the raw VM number, byte-equal to a PICK'd int/bool param; `+4`
  = untracked slot/next/value/value-dup above the tracked top). No setup/teardown change (a param stays tracked at its
  slot all loop). VM-proven sound: 3 keys all = 100 read back exactly 100, `chk(k,1)` and `chk(k,99)` REVERT (not the
  old pin, not a placeholder), absent reads 0. Within the RANGE-SPLICE (insert-loop) matcher, per-key `vs[i]` and RMW
  `+=` fall through - but they are NOT unsupported: they route to the per-iteration UPSERT loop instead ((b)/(b3)).
  Only the loop var `= i` (not a param/array) and `= <default>`/delete truly fail closed. A reassigned param or
  non-param local mints a mismatching/empty tail and reverts (sound).

**C2 SURVEY 2026-07-19 (`scratchpad/c2probe.mjs` + VM; superseded in part by the 2026-07-22 merge audit).** The
surveyed shapes are SOUND (fail-closed where incomplete). It did not cover two distinct straight-line absent-key
writes sharing one predecessor: fixed upserts independently select the same input and trailing NEW output. That shape
is sound only because transaction construction rejects the duplicate input, but is not complete. The required batch
transition is specified in `c2-codegen-optimization.md` under "Straight-line multi-key writes".
COMPLETE+SOUND: single-key read/write/RMW/delete (all value types incl chunked long bytes/string), nested/composite/
address keys, expr-key nested (`m[hash160(pk)][b]=v`), value-returning RMW helper, bool insert loop, LOOP-INVARIANT
int-param value insert loop (`for(i) m[ks[i]] = v`, `SortedInsertLoopValue`), SAME-identifier-key scalar RMW-in-loop
(`for(i) balance[owner] -= amts[i]`, `2f780468`), SINGLE `msg.sender`/`tx.origin`-keyed read/write/update
(`110e4e43`, MsgSenderC2 - msgSender keySource + signer P2PKH slot + forced sender funder; cross-sender-isolated),
`msg.sender`/`tx.origin` scalar RMW-IN-LOOP (`for(i) bal[msg.sender] -= amts[i]` = multitransfer debit, `12dafc89`),
DIFF-KEY per-iteration credit loop `for(i) bal[recipients[i]] += amts[i]` - both UPDATE (existing) AND INSERT (new
recipient, `125cb014`) - int/bytes20/address keys, + the FULL ERC-20 multiTransfer (debit+credit in one tx, `090f4e35`)
INCLUDING a NEW recipient whose predecessor is UNTOUCHED (`5856dfc5`, the common sha256-random topology);
ABSOLUTE per-key assignment loop `for(i) m[k[i]] = vs[i]` (op=set, `644532b1`, replace-not-add, update+insert);
per-iteration DELETE loop `for(i) delete m[k[i]]` (op=delete, `bbc280a1`, batch nullify existing keys, absent fails closed);
LOOP-INVARIANT value loops via the upsert loop (`7673bc51`): fixed-amount airdrop `for(i) bal[k[i]] += amount` (a scalar
PARAM, valueScalarParam) + `+= 100`/`= 42` (int LITERAL, valueConst) - update+insert, all ops. `= 0` now compiles as
op=set (INSERTS a 0-node on absent = EnumerableMap.set(k,0), distinct from delete's fail-closed-on-absent);
BATCH-UPSERT MERGE - full multiTransfer to a NEW recipient whose predecessor is the DEBITED msg.sender (`69d1ed93`,
re-point register + flush re-point + covenant in-gap check; two-in-gap fails closed).
RESOLVED 2026-07-19/20 (case b + same-gap chains): a NEW recipient whose predecessor is another CREDITED recipient
(case b) NOW WORKS (pending-defer + order-independent reorder); 2+ new in ONE gap NOW CHAIN off any predecessor
(credited / untouched / HEAD / debited msg.sender); self-transfer + duplicate (incl. scalar) also work - see the
multiTransfer entry above. The `= <param>` wart is RESOLVED too (`d08584f2`): it now routes to the upsert loop
(update+insert), keeping same-gap chaining. STILL FAIL-CLOSED (sound, not complete): scalar `-=` duplicate (no
pending-defer), cross-contract msg.sender, 2D `m[k][i][j]`, function-pointer values.

**One real HOLE found + FIXED (commit `af6e894a`): C2 `delete m[k]` in a DYNAMIC loop.** `visitMappingDelete`'s sorted
branch routed to `emitSortedValueUpsert` (a FIXED-slot co-spend) with NO `plainLoopDepth` guard (unlike
`visitMappingAssign`), so `for(i) delete w[ks[i]]` compiled to a single-slot delete in a loop - the covenant pinned
only ONE iteration and left the rest UN-covenanted (an exclusion-proof hole). Now fails closed at `plainLoopDepth > 0`.
VM-verified sound (no fix needed): consecutive same-entry scalar RMW `m[k]+=a; m[k]+=b` fail-closes (double-spend
revert), never a partial store (`C2ScalarMultiWrite`). CLARITY nit RESOLVED 2026-07-19 (`92a13237`): 2D `m[k][i][j]`
on `mapping(K => T[][])` (read AND write) now fails closed with a clean `MultiDimArrayValueAccessError` instead of the
confusing `Found type '...' where type 'undefined'` (the excess-key guard `keys.length > allKeyTypes.length` - already
used by the write - now also guards the read, both throwing the dedicated error; single-level `m[k][i]` still compiles).

### DELETE-in-loop `for(i) delete m[ks[i]]` - RESOLVED 2026-07-19 (`bbc280a1`, op=delete, VM-proven)
The last verb of the loop-mutation family, now built exactly as scoped. A per-iteration sorted `delete` routes through
the per-iteration upsert loop with `op='delete'`: UPDATE (present) mints `[slot | next | <default>]` (nullify; empty
value tail for int); ABSENT keys FAIL CLOSED (no INSERT branch - inserting a nullified node would diverge from
Solidity's no-op for ENUMERABLE/VALUES-mode mappings). Plumbing landed: `findSortedUpsertLoopWrite` matches a
`MappingDeleteNode` in-loop; setup derives `op='delete'` (no `valueArrayParam`); body pushes the default (`OP_0`),
reuses the `op='set'` UPDATE mint, ELSE branch `OP_0 OP_VERIFY`; `visitMappingDelete` dispatches to the upsert body
when active; SDK finds each entry (throws if absent) and mints `[slot|next|default]`. **THE non-obvious fix:**
`collectLoopWrittenSlotKeys` only counted `MappingAssignNode` as a loop write, so the delete got a phantom FIXED block
slot (`blockSize` 2 vs the assign path's 1), shifting the loop output region by one -> the covenant checked a non-entry
output and reverted; adding the `MappingDeleteNode` branch marks it `inLoop`. VM-proven (SortedUpsertLoop): nullify N
existing keys (later `chk(k,0)` passes, `chk(k,old)` reverts); delete-of-absent reverts. `= 0` (IntLiteral nullify, not
the delete keyword) still fails closed - `SortedInsertLoopNonBool` asserts both.

---

## Uninitialized named-return bytes  — 2026-07-15

**What.** `function f(..) returns (bytes memory dst) { assembly { mcopy(add(dst, 0x20), ..) } }` - `dst` is a
named return never allocated with `new bytes(n)`; assembly writes into it. Corpus: `mcopy.sol`.

**Why deferred.** EVM-memory-layout-specific: in EVM `dst` points at the free-memory region and the assembly
builds the value in place. There is no BCH-native analog without the param-pointer machinery above, and it shares
that item's low value. Bundled with the bytes/string-param deferral.

**Revisit if.** The param-pointer item is taken up (this rides on the same materialization).

---

## Compound byte writes on a converted bytes buffer  — 2026-07-15

**What.** `b[i] += v` / `b[i] |= v` on a `bytes` buffer that otherwise converts to a `__yulmem` pointer. The
AstBuilder keeps compound `op=` byte writes on the whole-blob value-copy rebuild (`DesugarLocalBytesElementWrite`
only relocates the plain `=` form), so such a buffer falls back to value-copy.

**Why deferred.** Rare (byte compound-assignment is uncommon), and the value-copy path is correct - only the
pointer optimization is missed. Not worth a read-modify-write byte-splice path yet.

**Revisit if.** A contract hot-path does compound byte writes on a buffer it also drives via assembly.

---

## External-call target: DIRECT method call on a memory-COPY struct field  — 2026-07-15

**What.** `Job memory job = jobs[id]; IFoo(job.token).method()` - a plain-`address` field of a `memory` struct
COPY, cast + called directly. `SynthesizeExternalAddressLocals` now hoists `IFoo(<state chain>)` (struct/array/
mapping field of a self-pinned state root - `castChainTarget`) and `IFoo(<param field>)` (caller-witness -
`castParamFieldTarget`), which unblocked the EACC Marketplace (`JobPost storage job = jobs[id]`, a storage
pointer AstBuilder inlines to `jobs[id].token`) and Unicrow (`IERC20(input.currency).balanceOf`, a param field).
The remaining hole is a `memory` copy: `job` is a real local (value-copy), so `job.token` is neither a
self-pinned state chain (root is a local, not a collection) nor param-rooted.

**Why deferred.**
- **Soundness subtlety.** A memory copy can be modified before the call (`job.token = <caller value>`), so hoisting
  `job.token` could pin a caller-influenced value where the author intended the state value - the exact forgery
  `extcall-target-pinning.md` forbids. Sound handling needs a non-modification proof (dataflow) or a rewrite of
  `job.token` -> `jobs[id].token` (only valid when `job` is a read-only copy).
- **Low remaining value.** The real EACC contracts do not hit it: the direct method-call form is rare, and the
  common wrapped form `SafeERC20.safeTransfer(IFoo(escrow.currency), ..)` already works - the SafeERC20 inline
  binds the token to a local, which codegen sources as a bare local (the `local-from-statechain` path). This is
  the same "memory-local-from-state provenance" deep slice flagged as deferred elsewhere (reassignable storage
  ptr / `[[struct_array_lvalue_grind_2026_07]]`).

**What it'd take.** A per-function memory-local alias map (`local -> state chain`, gated on the local being
assigned once from a state chain and never field-written/reassigned), applied BEFORE `LowerMemoryModel` obscures
the assignment; then `castChainTarget` handles the rewritten form. OR per-call-site hoisting (insert
`__extaddr = job.token` just before the call, where `job` is in scope) instead of body-top hoisting.

**Revisit if.** A real contract makes a DIRECT (non-SafeERC20-wrapped) external call on a `memory`-copy struct
field and it is the last compile blocker.

---

## `mapping(K => Struct)` NESTED struct-field write  — 2026-07-15

**What.** `m[k].nested.field = v` where `m` is a `mapping(K => Struct)` and `nested` is a struct-typed field
(e.g. `mapping(uint => Post); jobs[id].roles.creator = v`). The packed struct-ARRAY form was fixed (commit
38a79ceb, `rebuildStructWithChain` in the packed-array element handler), but the mapping form still fails closed:
`Found type 'address' where type 'Roles' was expected`. Both the direct `m[k].a.b=v` and the storage-pointer
`S storage p = m[k]; p.a.b=v` forms.

**Why deferred.** The mapping-value path is a DIFFERENT, more complex desugar than the array path: it recursively
FLATTENS the value struct's fields into per-field mappings (`jobs__roles`, handled in buildLvalueAssign ~3181 via
`mappingStructValueVars`), and the nested-struct case is not wired through that recursive flattening (it drops the
deeper member or assigns the raw value at the first-level field). Fixing it means threading the nested rebuild
through the flatten-map machinery (mappingStructValueVars / mappingStructStateVars / stateMappingValueStruct), not
just calling rebuildStructWithChain. Fails CLOSED (type error, no miscompile), and the driving EACC contract
(MarketplaceV1) uses struct ARRAYS not mappings, so no contract is blocked by the mapping form specifically.

**What it'd take.** In the mappingStructValueVars handler (~3181), when `trailing.length > 1` (a nested struct
chain), rebuild the nested struct value via rebuildStructWithChain against the flattened value struct and reduce
the write to the first-level flattened field, mirroring the array fix. Verify against the recursive flattening of
deeper structs.

**Revisit if.** A real contract writes a nested struct field through a `mapping(K => Struct)` value and it blocks
the compile.

**Related (2026-07-15).** The fn-ptr CALL form `m[k].inner.x()` (calling a `function()` field nested inside a
mapping-value struct, shipped 9d2ad911) is gated by THIS write limitation, not by the call rewrite: `m[k].inner.x
= h` fails identically to the `uint` control, so the pointer can never be stored to invoke. The read/call side is
proven complete for nesting - `t[i].inner.x()` and `s.a.b.x()` compile and dispatch. When the mapping-value
nested write is fixed, re-test `m[k].inner.x()`; no call-side change is expected to be needed.

---

## Block layout v2: unified auxiliary co-spend band (2026-07-15)

**What.** A refactor unifying every co-spent auxiliary - block/tx oracles (`blockhashOracle`), external
libraries (keccak256 result-NFT side-car), external reads/calls - into ONE explicit front-region "auxiliary
band" in `computeBlockLayout` (`semantic/SymbolTableTraversal.ts:7507`), with a single slot allocator and one
SDK co-spend driver. Prompted by evaluating whether to "prepend" external-lib + oracle slots ahead of the
contract's own outputs (docs/keccak-result-nft.md section 10).

**Why deferred.** The intent (constant positions, variability isolated to the tail) is ALREADY the structure:
`computeBlockLayout` front-loads the fixed co-spent slots (`master -> dataNft -> readOnlyDataNft ->
blockhashOracle -> extcall-reserved -> ...`) and keeps runtime-variable outputs (transfer/tcTransfer/event/
loop-entries) in the tail; offsets resolve centrally via `getBlockSlotOffset` (`GTT:563`). `blockhashOracle`
is already a front-region "1:1 input/output slot" - the exact shape a keccak side-car needs. So keccak Phase 1
just adds an `externalLibrary` slot kind as a `blockhashOracle` sibling; no reorg required. A full unification
would REORDER slots across the 5 byte-matched covenant pairs + the green blockhashOracle / external-call /
entry-NFT e2e suites - high validation cost, disproportionate to shipping single-hash keccak, and the
per-mechanism versions already work. Hard constraint either way: `master` stays at offset 0 (state anchor for
self-pin + auto-derivation), and the input/output index-alignment rationale must be preserved.

**What it'd take.** A dedicated project: define an `auxiliaryBand` abstraction (ordered oracle+library+read+
call slots) emitted right after master+dataNft; migrate `blockhashOracle` and the extcall/read reservations
onto it; one SDK co-spend driver iterating the band; re-verify the 5 covenant pairs byte-for-byte; full
stateful + oracle + extcall + entry e2e as the regression gate.

**Revisit if.** A third+ built-in library/oracle lands and the per-mechanism placement code starts to
duplicate, or a contract needs many heterogeneous co-spent auxiliaries whose ad-hoc ordering becomes fragile.

---

## evmCompat `abi.encodeWithSignature` / `abi.encodeCall` - not at EVM parity (selector + args)

**What.** Under `evmCompat`, `abi.encode` / `abi.encodePacked` / `abi.encodeWithSelector` are byte-identical to
solc (331 conformance cases). But `abi.encodeWithSignature(sig, args)` and `abi.encodeCall(fn, args)` are NOT:
they emit (1) a **SHA256**-derived 4-byte selector (`computeFunctionSelector` = `sha256(sig)[:4]`) where the EVM
uses **keccak256**, and (2) **native pushdata** args (`emitEncodeArgsAndCatSelector` -> `emitPushdataEncode`)
instead of the EVM head/tail ABI encoding. So both the selector and the argument bytes diverge from solc.
`encodeWithSelector` is fine because the selector is passed in explicitly and its args already route through
`emitEvmAbiEncode`.

**Why deferred.** The selector needs keccak256, which is entangled with the concurrent keccak256 rework in
`GenerateTargetTraversal.ts` (compute-and-commit side-car). The args half is independent (just route through
`emitEvmAbiEncode`) but can't be conformance-verified on its own: the differential harness compares the whole
`selector ++ args` blob, so a SHA256 selector makes every case mismatch until keccak lands.

**What it'd take.** (1) An `evmCompat` branch in `visitAbiEncodeWithSignature` / `visitAbiEncodeCall` that encodes
args via `emitEvmAbiEncode(node.parameters)` instead of `emitEncodeArgsAndCatSelector`. (2) A keccak256 selector:
signatures are compile-time constants, so const-fold `keccak256(sig)[:4]` (the const-keccak256 path) - no runtime
side-car needed. (3) `selCase`-style conformance cases for both, cross-checked against ethers `id(sig).slice(0,10)`.

**Revisit if.** The const-`keccak256` work lands (it already covers `keccak256(<const>)`); computing a selector
from a literal signature is exactly that shape, so this becomes a small, testable follow-up.

---

## evmCompat ABI - niche recursive shapes (RESOLVED)

**Status: implemented.** All three deep-recursion shapes now work both directions, byte-identical to solc:
(1) `abi.decode` of `bytes[][]`/`string[][]` (commit 4284ace9: `emitEvmDecodeDynElementArray`, a counted inner
loop); (2) `abi.encode` of a struct with a nested dynamic- or static-struct field (commit 4ca9df7d:
`emitEvmStructTail` keeps the tracker synced through the unpack so nested `getStackIndex` resolves, and
`emitEvmStructInline` recurses via `emitEvmEncodeValue`); (3) `abi.decode` of a dynamic struct with a
fixed-array or nested-static-struct field (commit 698c516d: `emitEvmAbiDecodeDynamic` head positions generalized
to cumulative `abiStaticSize` + composite reconstruction). The `__abiblob` slot collision was avoided by keeping
levels temporally disjoint (each nips its slots before an enclosing level names its own) rather than a depth-scoped
namespace. Covered by conformance cases in abi/decode.conformance.test.ts.

The only genuine non-support remaining is `abi.encodePacked` of an array of dynamic elements - ambiguous/disallowed
in Solidity too, so rejecting it is correct, not a gap.

---

## keccak compute model - remaining fail-closed edges (2026-07-16)

Every keccak form now uses the compute-and-commit side-car (stateless single/multi/complex/nested, direct
stateful, transitive external incl. complex/nested-in-callee, front-region blockhash/external-read, and
runtime-bound loops in stateful + stateless contracts). These compound edges still throw (never mis-resolve):

**What.**
1. **Loop + other trailing users.** A dynamic keccak loop whose function ALSO writes a mapping loop / spends
   token-or-satoshi containers / does transfers in the SAME trailing region (both would want `[blockSize, ..)`).
2. **Transitive complex + front-region IN the callee.** A co-spent callee B that has BOTH a complex/nested keccak
   arg AND a blockhash/external-read: `_externalKeccakProbeCtx` probes B in isolation without threading B's own
   front-region, so `_extractStatefulKeccakPreimages` hits the base mismatch (direct-param transitive with
   front-region, and complex without front-region, both work).
3. **Preimage > 3 keccak blocks (~407 B)** in one side-car (a single side-car input funds at most 3 blocks).

**Why deferred.** (1) The trailing region has ONE runtime-counter-indexed band; two independent counter-indexed
users have nowhere sound to interleave. (2) B's probe context would need B's resolved front-region inputs +
recreations + locktime (the master path threads them, but the transitive path builds B's context from
`getFullState`, not a full derivation). (3) Fundamental per-input op budget.

**What it'd take.** (1) A shared trailing-region allocator that assigns disjoint counter bands (like the fixed
front-region band allocator). (2) Resolve B's blockhash/external-read co-spends inside `_externalKeccakProbeCtx`
and pass them as `frontRegionInputs` (reuse the master's resolvers against B). (3) Split a large preimage across
multiple side-cars (partial-absorb chaining), or a multi-block side-car covenant.

**Revisit if.** A real contract needs a keccak loop beside a mapping-write loop / container spend (1), a
transitive callee that hashes a nested arg while reading a blockhash (2), or a >407 B preimage (3).

**Soundness note (not a gap).** The complex-arg + transitive probes assume the keccak preimage depends only on
the function's args/state, not on surrounding-tx introspection that differs between the isolated probe and the
real spend. If it did, the probe would extract a wrong preimage and the runtime preimage bind would REJECT at
spend (fail closed) - never accept a wrong hash.

**Code cleanup (not functional).** `BUILTIN_LIBRARIES.keccak256` still carries the 2.3 KB inline blob
(`keccak-library.ts`), now only supplying `abi` + as the canonical script reference; fully removing it needs the
`ExternalLibrary` type to allow a blob-less compute-only builtin. Documented in-code.

---

## Conformance harness: run the SAME EXACT source on solc + solidc  — 2026-07-16

**What.** The differential conformance harness (`packages/solidcash/test/conformance/harness.ts`) generates TWO
sources per case - a Solidity one (`contract C { ... return <expr>; }`) and a separate SolidCash one
(`contract Conf() { ... require(<expr> == __expected); }`). They differ only in unavoidable decorations (SPDX +
pragma, `contract C` vs `contract Conf()`, `public pure`/`view`, and the return-vs-require oracle), but they are
NOT byte-identical, so a divergence in how the two toolchains PARSE the same source text is not exercised. Ideal:
compile ONE identical source string under both solc and solidc.

**Why deferred.** The languages are not a strict superset: Solidity requires `pragma solidity`, function
visibility/mutability keywords, and `return`; SolidCash uses `pragma solidcash`, `contract C()`, no
visibility/mutability on the tested shapes, and the require-oracle is what makes the BCH covenant checkable
(there is no `bytes memory ==` and no external return channel to compare on-chain). `assertBothAccept` already
runs a single self-contained `require()` covenant on both where the shape allows (round-trips), but reference
cases (arithmetic, abi.encode, slot layout) need the EVM-computed expected fed in, which forces the asymmetry.

**What it'd take.** A shared-subset preprocessor: one canonical source annotated with directives that lower to
each dialect's decorations (pragma, visibility, return-vs-require) - or a Solidity dialect shim that accepts the
SolidCash spellings. Non-trivial and low marginal value (the current per-case generation already shares the
expression/param/type strings verbatim, which is where a real parse divergence would show).

**Revisit if.** A parse-level divergence is suspected (a construct that both accept but interpret differently at
the syntax layer), or the corpus grows enough that maintaining two source templates per case becomes a burden.

---

## Sorted-mapping enumeration + C2-default: the four followups after VALUES linkage — 2026-07-16

VALUES-mode trustless iteration over a sorted (C2) `enumerable mapping` SHIPPED (commits 07cd085a SDK, 42eaed88
codegen, tests SortedMappingIteration.test.ts; the covenant co-spends the HEAD sentinel and walks the nextKey
chain to the tail, so omission/truncation revert at the VM). Its three named "next steps" plus the value-width
gap were assessed and DEFERRED - each for a concrete, grounded reason, not for lack of time.

### 1. KEYS / ENTRIES iteration over a SORTED mapping - RESOLVED for fixed-width keys (2026-07-16, commit 7b911613)

**What.** `for (k in this.m)` / `for (k, v of this.m.entries)` when `m` is a sorted (C2) enumerable mapping.

**Resolution.** Shipped via option (a), the witness-key protocol - ADDITIVELY (no change to the byte-verified C2
read/write/delete core): the caller supplies the keys (`setIterationKeys`), the SDK orders them to the ascending
chain and injects them as a concatenated fixed-width blob (a conditionally-injected `__internal__collectionIterKeys_N`
param, sorted-KEYS/ENTRIES only so other ABIs are untouched), and the linkage covenant per entry splits keyWidth
bytes off the blob, computes `keyToSlot(key)` (OP_SHA256 + 0x7f mask) and OP_EQUALVERIFYs it against the entry's
slot before exposing the key. A wrong/forged key hashes elsewhere -> reverts (verified VM-level); a missing entry
breaks the chain -> reverts. Tests: SortedMappingKeyIteration.test.ts.

**Remaining (still deferred).** None for key type - VARIABLE-WIDTH keys (int, address) now work too (commit
a9e0037b): the blob is LENGTH-PREFIXED (1-byte length ++ key per entry), the covenant splits the prefix, so any
single key type iterates (composite/nested keys are still out - no single preimage to verify). Unchanged
properties: keys come out in H(key) (hash) order, and the caller must know all keys (owner-driven enumeration;
the raw key is not on-chain). DEFERRAL #1 FULLY RESOLVED.

### 2. C2 sorted backend as the DEFAULT for plain `mapping` - SHIPPED (2026-07-17, commit 79d00698)

**DONE.** Every mapping whose value type C2 can store is C2-backed BY DEFAULT (exclusion-proof / unforgeable
reads = Solidity storage parity) - no flag. Opt out per contract with `{ sortedMappingsAll: false }` (then
`sortedMappings` names specific mappings to keep C2). A mapping whose value C2 cannot store (an array) falls back
to the default entry model via a value-type guard in compiler.ts, so unsupported shapes keep compiling. The
prior C2 feature work (computed-key auto-derivation, deploy-time HEAD init, value types, iteration keys, RMW)
made the flip safe. The migration: the ~104 tests that seed/assert the default entry model opt out via a
one-line per-file compileString shim (a behavioral no-op). Result: solidc 2054 green, solidcash 2944 green (lone
failure = pre-existing BCH_2023_05 vmTarget, no mappings). C2-as-default is DONE end to end.

**Follow-ups (not blocking).** (a) The ~104 opt-out'd legacy tests exercise the DEFAULT ENTRY MODEL; over time
migrate the representative ones to C2 seeding so the new default is directly tested (SortedMappingsAllParity +
the SortedMapping* suite already cover the C2 path). (b) P5b (item 3) for array/long-value mappings, which
currently fall back to the default model (no parity yet). (c) A future major version could remove the default
entry model + `sortedMappingsAll: false` entirely once nothing needs it.

**Why deferred - GAUGED 2026-07-16.** Temporarily defaulting all mappings to C2 measured the blast radius:
COMPILE level only 1/75 StructsMappings breaks (C2 compiles fine, different bytecode); E2E level ~half of the
plain-mapping tests break, for a MIX of reasons - (a) seeding: tests seed the default entry model, so the C2
covenant hits "missing HEAD sentinel" (mechanical migration); (b) real C2 CODEGEN/SDK gaps the flip surfaced.
So the flip is a staged migration, not a one-line default change.

**Progress (gaps closed 2026-07-16/17).** Several surfaced gaps now fixed, moving C2 toward feature-complete:
computed/local-key RMW `balances[pkh]=balances[pkh]+x` COMPILES (368efcfe: upsert hashes the key before the
value so the last-use ROLL does not eat the key) and now AUTO-DERIVES with NO withEntryKey (2ac3941e + ae3fb3bf):
the artifact carries each computed key's canonical (`call:hash160(id:pk)`) as expressionLabel - for a direct key
directly, for a LOCAL `pkh=hash160(pk)` by inlining the local's initializer canonical - and the SDK's
evalComputedKey evaluates it (hash160/sha256/ripemd160/hash256 + casts) so its co-spend agrees with the
covenant's on-chain hash. Matches Solidity's auto-resolution. Value-type coverage also widened (P5a, item 3). So
the "computed key" C2 gap is CLOSED for the common hash-of-arg shapes (a reassigned local / non-hash op falls
back fail-closed, resolvable with withEntryKey).

**DEPLOY-time HEAD init DONE (8f40abc3).** The genesis tx now mints HEAD[slot 0 | nextKey 0] for each C2 mapping
the constructor did not populate, so a freshly deployed (unseeded) C2 contract's first read/write works - no
"missing HEAD". Funder-authorized genesis; later reads/writes pin the HEAD via the covenant. So a real C2-default
CONTRACT is now deployable + usable end-to-end.

**What it'd take (remaining).** (1) P5b (chunked values) for unbounded string/bytes mappings > 64 B (or a
fail-closed carve-out). (2) The FLIP itself + test-suite migration: flip the default to C2, and the ~half of e2e
tests that SEED default-model entries need C2 seeding (HEAD + sorted entries) - either per-test or via a C2-aware
seed helper; an opt-out `plainMappings` option would let the flip land with legacy tests opting out while the
default is C2. (3) Sweep for further per-shape C2 gaps (the gauge only sampled). The feature gaps are largely
closed now (computed keys, deploy init, value types, iteration keys, RMW) - the remaining work is the coordinated
flip + seeding migration, best done as a dedicated pass.

**Revisit if.** Continuing the parity push (the standing directive) - this is now the critical path; each gap
closed shrinks the eventual flip.

### 3. large VALUES in sorted entries - P5a + P5b + GENERAL struct/array chunking + sorted push/pop all DONE

**P5a DONE (2026-07-16, commit ad70e15f).** Unbounded `bytes` / `string` values <= 60 B are stored INLINE in the
entry commitment tail as `len(4 B LE) ++ value` (<= 128 B total, real-chain-valid), so a `mapping(K => bytes|string)`
gets the same exclusion proofs as int/bytesN values. Closes the common short-string/bytes case (symbols, URIs, names).

**P5b DONE (2026-07-17).** The HARD REQUIREMENT ("c2 must be default, even for data longer than ~64B") is met:
`mapping(K => bytes|string)` is C2 by default for values of ANY practical length. A value > 60 B stores
`len(4 B LE) ++ sha256(value)` (100 B commitment, fits the 128 B token-commitment limit) and the full value
persists off-commitment in per-(collection, slot, digest) chunk NFTs. A read reassembles the chunks into a witness
and the covenant verifies `sha256(witness) == storedHash` - a forged/tampered/missing witness fails the read CLOSED
(never a wrong value). Design E (SDK-minted, covenant-UNPINNED chunks): the covenant stores only the hash, so no
chunk co-spend loop and no OP_TXOUTPUTCOUNT coupling is needed - the value chunks are extra trailing 0x01 mutable
outputs the C2 write covenant tolerates (no total-output bound; minting uniqueness counts only 0x02; C3 conservation
is skipped for entry-access functions). The 10,000 B VM stack-element limit caps an on-chain-READ value (the witness
must be hashed on-stack) - the same ceiling any storage mechanism faces, since a value the contract compares must be
loaded whole; not a chunk-design limit.

Pieces (all shipped, all green in SortedMappingLongValue.test.ts + migrated SortedMappingDynBytesValue.test.ts):
- Covenant: `emitChunkableValueTail` (write v -> `len4 ++ [inline<=60 | sha256(v)]`) + `emitChunkableValueRead`
  (read: strip len4; short -> inline; long -> PICK the `__internal__valueWitness_<slot>` arg, `sha256==hash`
  OP_EQUALVERIFY). GTT.
- SymbolTable: `__internal__valueWitness_<slot>` param injection, gated on `collection.sorted` + chunkable value.
- Compiler ABI: `EntryAccessAbi.valueParam` records the direct value parameter of a chunkable write.
- SDK: read reassembles the value from `getValueChunkAddress(collection, slot, digest)` chunks -> witness (threaded
  into finalArgs between blockhash and iteration args, matching the SymbolTable order); write mints the chunks via
  `StatefulTransactionBuilder.addValueChunkOutput` (trailing, after every covenant-managed output).

**Design D (covenant-PINNED chunks) - SHIPPED for direct values (2026-07-17).** The value chunks are now verified
ON-CHAIN: `emitSortedValueChunkPin` (modeled on emitDynamicWriteVerification) pins each chunk output at the compile-
time per-collection value-chunk P2SH with commitment `slot(32) ++ digest(32) ++ pushdata(i) ++ pushdata(v[i*56:])`,
built from the on-stack value, base `masterInput + blockSize (- unmaterialized returnEvent) + isInsert` (isInsert =
coSlot != H(k), layout-relative so a trailing fee-change output does not shift it), orphan-bounded. So a forged /
absent / misplaced chunk fails an OP_EQUALVERIFY at WRITE time - the ADVERSARIAL-writer residual is CLOSED for direct
writes (a malicious non-SDK builder can no longer persist a correct hash with wrong chunks). The Wall-1 sorted-INSERT
NEW-node collision (the chunk-pin's OP_OUTPUTTOKENCOMMITMENT calls were misread as NEW by the loop-entry extractor)
is fixed: the SDK computes NEW exactly (`slot ++ oldNext ++ tail`) and injects it PINNED via `pinLoopEntry`, so the
derivation skips the collection. VM-green update + insert + adversarial (SortedMappingLongValue.test.ts); solidcash
2949 pass (1 pre-existing BCH_2023_05).

**COMPUTED values - NOW SHIPPED too (2026-07-17), closing residual #1.** A `m[k] = f(...)` whose result > 60 B and
is not a direct param (a local-var / expression RHS) now WORKS: the covenant pins the chunks, and the SDK DERIVES
their commitments from the VM trace progressively (the tight `<expected> <idx> OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY`
pattern exposes each chunk; the VM halts at the first placeholder mismatch, so each probe reveals one more). Both
UPDATE and INSERT work (SortedMappingLongValue.test.ts). Three derivation subtleties were solved: (a) the value-chunk
pin runs BEFORE the entry-output check, so the entry only re-derives on a PASSING probe - the convergence loop now
requires a passing probe (not just a stable fingerprint) when value chunks are present; (b) the loop-entry (NEW)
extractor's range is capped to a single output for sorted-value mints so it does not misread the chunk OTC calls as
phantom NEW nodes; (c) a computed INSERT's NEW cannot derive until the chunks converge (the pin blocks it), so the
seeded loop-entry count is held at 1 (not dropped to 0, which would shift the chunk base). A computed UPDATE pins its
(empty) loop entry so it is never phantom-derived. Direct `m[k] = v` remains injected exactly (no derivation).

**OVERWRITE GC - DONE (2026-07-17).** Overwriting a long value now CO-SPENDS (destroys) the old chunks: on a present-
key UPDATE whose old tail is long (len > 60), the SDK reads the old digest, fetches the old chunks at the collection
value-chunk address filtered by (slot, old digest), and consumes them via createValueChunkUnlocker (flag=1, reusing
the dynamicChunkInputs consume path). The covenant does not verify them (the new chunks are pinned), so this is a
pure dust reclaim - no more orphans. Digest-keyed, so only the exact old version is reclaimed. Test: SortedMapping
LongValue.test.ts "overwrite GC" (v1's 3 chunks gone, only v2's 3 remain).

**GENERAL large-value (STRUCT + ARRAY) chunking - SHIPPED (2026-07-17).** The digest+chunk mechanism is now
BLOB-AGNOSTIC: `isChunkableValueType` (utils, the single source of truth) = unbounded bytes/string OR struct OR
dynamic array `T[]`. Any such value chunks off-commitment when > 60 B, so a `mapping(K => struct)` /
`mapping(K => T[])` is C2 by default (real-chain-valid) regardless of size. address/bytesN/int stay verbatim (always
within 128 B). Delivered along the CLEAN DESIGN below:
- Reads: `m[k]` / field-read `m[k].f` / element-read `m[k][i]` all go through emitSortedSetRead (materialize via the
  witness, chunking-transparent) then the existing struct/array decode (emitArrayElementExtract for `[i]`). Added
  ArrayType to sortedValueKind ('rawbytes'); extended isChunkableValue + the SymbolTable witness injection + the SDK
  gates (`collection.chunkableValue`) to struct/dynamic-array.
- Field/element WRITES are routed as a whole-value RMW through the chunk-aware ops: `m[k].f = v` ==
  `m[k] = setField(m[k], f, v)` (emitSortedStructFieldWrite + emitStructFieldSurgery); `m[k][i] = v` ==
  `m[k] = setElem(m[k], i, v)` (emitMappingArrayElementAssign in `sortedRmw` mode: Phase-1 read via emitSortedSetRead,
  Phase-2 element surgery, Phase-3 hands the blob to emitSortedValueUpsert to re-chunk + pin). Co-spends the entry
  ONCE like a scalar RMW; the SDK reuses Design D's COMPUTED-value derivation + overwrite GC. This FIXED a pre-existing
  flip bug where sorted struct field writes read the key||value (default-model) commitment instead of slot||next||value.
- The `chunkableValue` collection-ABI flag (compiler-computed via isChunkableValueType) drives the SDK gates cleanly.
- Whole-value array-literal assign `m[k] = [a,b,c]` now blob-encodes the literal in visitMappingAssign (was only done
  for state vars / var-defs), so the array stores as one value blob, not separate stack items.
Tests: SortedMappingStructFieldWrite.test.ts (small + 160 B struct), SortedMappingArrayElementWrite.test.ts (int[]
var-width + bytes32[] > 128 B chunked, element read/write, neighbor preservation).

**push/pop on a sorted array - NOW DONE (2026-07-17).** `m[k].push(v)` / `.pop()` route through the same sortedRmw
whole-value upsert as element writes (materialize -> Phase-2 push/pop surgery -> re-chunk). They CHANGE the element
count, so the value can flip across the inline<->chunked (60 B) boundary; that transition is handled entirely by the
SDK computed-value derivation - it already reprobes the new value's chunk set and GCs the old chunks by digest. The
ONE bug was a spurious minted chunk: the derivation seeds a `'00'` placeholder to bootstrap the covenant's chunk-0
verification, but a value that resolves INLINE pins no chunks (emitSortedValueChunkPin's size>60 guard), so the seed
survived and got minted, and a later chunked read of the same slot then failed to parse it. FIX (StatefulContract, in
the post-convergence cleanup): drop any unresolved `'00'` from the FINAL value-chunk commitments - a real chunk
commitment is always long (slot++digest++i++data), never the 1-byte `'00'`, so this cleans inline results without
touching chunked ones. The compiler.ts `pushPopMappings` opt-out was REMOVED (array mappings with push/pop are C2
again). Test: SortedMappingArrayElementWrite "push/pop under C2" (INSERT empty->[v], inline->chunked, chunked->chunked,
pop chunked->inline, all with element reads). The legacy DEFAULT-model push/pop suites (MappingArrayPush, NoArg/This
Prefix/IndexedFieldArrayPush) opt out via `sortedMappingsAll:false` to keep asserting the entry-model byte format.

### 4. Sound PARTIAL (paginated / windowed) enumeration

**What.** Iterate a sorted mapping too large to co-spend whole (the tx-size ceiling - e.g. millions of balance
entries). Linkage already proves the completeness of any CONTIGUOUS WINDOW, so a windowed walk is sound in
principle: co-spend [cursor .. cursor+K], prove contiguity, persist the cursor (+ any accumulator) in the
register, resume next tx.

**Why deferred.** It does not fit the single-tx `for..of` model (one call = one tx = one result). A paginated
fold spanning many txs needs (a) the cursor persisted in the data-NFT register, (b) the partial accumulator
(e.g. running sum) persisted and threaded across txs, and (c) a completion signal (cursor reached the tail) -
i.e. a NEW resumable-fold API/construct, not a codegen tweak to the existing loop.

**Design is FINALIZED + sound-by-reduction (2026-07-17), implementation is a focused follow-up.** The covenant
reduces to the EXISTING adversarially-verified full-walk `emitSortedIterationLinkage` (GTT:3542) - which already
chain-verifies slot==expectedNext per entry (omission/reorder/truncation revert) - with two additions: (1) the walk
starts from an ANCHOR whose slot == a stored CURSOR (a register state var; the first page's cursor is the HEAD
sentinel 0), instead of always HEAD; (2) the loop is BOUNDED to K entries (or the tail), and the new cursor = the
last processed entry's nextKey is written back. Soundness: within a page the chain check is unchanged (=verified);
pages can't SKIP because each page's anchor slot is pinned == the cursor the prior page wrote, and the cursor is
covenant-enforced register state; the pass COMPLETES when a page reaches nextKey==0. CAVEAT (same as any paginated
enumeration over a mutable structure, incl. Solidity): snapshot semantics - an insert/delete between pages
invalidates the cursor, so pagination is for a signed / no-concurrent-write window. Design commit fef5723b.

**What's left to BUILD (not a codegen tweak - a new resumable-fold surface, held from rushing since it is a
completeness primitive):** (a) a surface - a windowed `for (v in m.window(cursor, k))` form or an explicit
`iterateWindow(cursor,k)` builtin exposing the post-window cursor; (b) semantic: bind the cursor state var + K
param; (c) codegen: parameterize emitSortedIterationLinkage with a start-anchor + a bound + a cursor write-back;
(d) SDK: co-spend the [cursor..cursor+K] window + derive/persist the cursor; (e) ADVERSARIAL tests
(omission/skip/stale-cursor/wrong-anchor MUST revert) BEFORE shipping - the silent-omission risk is exactly what
this prevents, so it ships only when those fail closed.

**Revisit if.** A real contract must enumerate/aggregate a mapping whose entry count exceeds one tx's input
budget (the USDT-scale case that motivated the enumerable/plain split originally).

### 5. C2 value-shape coverage + the default entry model (2026-07-17)

**C2-by-DEFAULT covers every value shape except function pointers.** `mapping(K => V)` is C2-backed by default for V
in: int/bigint/bool, bytesN, unbounded bytes/string, address, enum, struct, and arrays (dynamic `T[]` + fixed `T[N]`,
chunk-aware). A struct with a mapping/array field is field-decomposed into per-field C2 collections.

**Why ARRAYS are C2-by-default (the parity argument, revisited 2026-07-18).** Briefly considered making arrays opt-in
(the exclusion proof only helps array length/presence guards - an absent-key ELEMENT read reverts on the empty-array
bounds check, not a forgeable value - so the omission surface looked narrow). REVERSED on EVM-parity grounds: the EVM
makes EVERY storage read unforgeable (the trie commits an array's length slot to 0), so a ported
`require(orders[user].length == 0)` / presence guard relies on that; leaving arrays on the entry model makes exactly
that guard omission-forgeable = a silent porter footgun. Plus EVM arrays are unbounded while the entry model caps a
value at the 128 B commitment. So on both parity dimensions (unforgeable length/presence + no size cap) C2 is the
faithful choice; the per-read C2 overhead is the parity tax the EVM itself pays via the trie. Uniformity wins: every
mapping read unforgeable, so a porter never has to reason about which reads are safe.

**Only function pointers have NO C2 path.** fn-ptr values go through heavy lowering (LowerBlobFunctionPointers,
LowerForeignFunctionPointer*) that may transform the mapping before the C2 opt-in, and are rare - deferred.
Revert-safe: add `FunctionType` to c2StorableValue (needs the import) + sortedValueKind, then test the fn-ptr suite.

**Default entry-model DELETION** (still gated): (1) fn-ptr values -> C2; (2) migrate the ~110 `sortedMappingsAll:false`
opt-out'd tests to C2 seeding; (3) delete the entry-model codegen path + the `sortedMappingsAll` / `sortedMappings`
options. Large mechanical change; do it as a dedicated pass.

### 6. C2-default no-guards: the two deep source-shape blockers (2026-07-18)

After the nested/multi-key C2 codegen fix (commit c5c1d5c8) all 4 Unicrow + 11/12 corpus sorted-mapping files
compile under C2-default. Two source shapes still block a full no-guards flip (both surfaced by EACC Marketplace):

**(a) A C2 (sorted) mapping write inside a DYNAMIC loop.** `for (uint i; i < xs.length; i++) w[id][xs[i]] = true`
(Marketplace `whitelistWorkers`). A FIXED-bound loop already works - `UnrollFixedBoundEntryLoop` unrolls it to static
writes before codegen. The dynamic case previously crashed deep at "Block slot not found: entry[0]" (the write routes
to `emitSortedValueUpsert`, which needs a fixed entry slot); `visitMappingAssign` now FAILS CLOSED with
`SortedMappingCodegenPendingError` when `node.collection?.sorted && this.plainLoopDepth > 0`
(`GenerateTargetTraversal.ts:10633`, commit 88be6d13, never degrades to the omittable entry model).

**The full feature decomposes along TWO axes, governed by a hard BCH rule: a transaction cannot spend an output it
creates in the SAME tx.** (Analysis 2026-07-18, "N writes into same value / same range".)

- **SAME VALUE - N writes to the SAME entry `m[k]` (same key).** N sequential state transitions of ONE UTXO. In a
  single tx the ceiling is exactly ONE physical upsert; N logical writes MUST coalesce (or become N txs) - there is no
  covenant that yields N real upserts of one entry in one tx. RESOLVED, see (c): `CacheMappingEntryInLoop` reads `m[k]`
  once, mutates a local (reads redirect there), flushes ONE upsert. Residual is only compiler COVERAGE (reassigned key
  / delete interleaved with element writes / multi-collection), NOT a covenant gap.
- **SAME RANGE - N writes to DIFFERENT keys.** N DIFFERENT UTXOs, which CAN co-spend in one tx (N inputs -> N outputs),
  bounded only by tx size / input count. This is the open covenant work, and it splits by difficulty:
  1. **Batch UPDATE of N existing keys - MEDIUM.** Each is an independent value-replace (co-spend `slot||next||val` ->
     re-emit `slot||next||val'`, pointers untouched); no sorted-structure change, so NO cross-key dependency. Needs a
     sorted-update loop covenant (the `entry_write_in_loop` `emitLoopEntryWrite` pattern, but reading the current value
     + preserving `next`), SDK derivation of the co-spend set from the loop trace, and compiler lowering in place of the
     GTT:10633 fail-close.
  2. **Contiguous-range INSERT into ONE gap - MEDIUM.** If all N new keys sort into a single existing gap (`P.next==S`,
     `P<k1<...<kN<S`), splice the whole run at once: co-spend `P` and `S` ONCE, verify the run is internally sorted +
     bracketed, emit `P->k1->...->kN->S`. One bracket op for the whole range - this is precisely why a RANGE is
     tractable where arbitrary scattered keys are not.
  3. **Scattered multi-INSERT across gaps - HARD.** Each insert's predecessor depends on prior inserts (adjacent new
     keys re-point each other); the list, bracket, and slot ordering evolve per iteration (the GTT:10628 note). This is
     the true per-iteration sorted-insert covenant: thread the evolving list in the covenant + simulate insert-by-insert
     in the SDK.
  4. **RMW / delete / mixed within the range - INCREMENTAL** on top of the above: delete = unlink (predecessor re-point
     to skip), RMW = read-then-write per key.

Cross-cutting for any of (1)-(4): a batch-lowering compiler pass (sibling of `CacheMappingEntryInLoop`) or a batch mode
on `emitSortedValueUpsert`; SDK progressive-trace derivation extended to the sorted structure (co-spend set = entries +
brackets); the exclusion proof must SURVIVE the batch (reject forged / omitted / misordered / duplicated entries -
adversarial tests per case); and a per-tx cap on N (large N needs the paginated design, section 4). Soundness-critical:
a bug reopens the C2 exclusion-proof hole. Revisit for full no-guards; recommended order = (1) then (2), defer (3).

**STATUS 2026-07-18: the CODEGEN for the scattered per-iteration insert (item 3) SHIPPED (commit 9c977e14).**
`emitSortedInsertLoopSetup/Body/Teardown` (GTT) replaces the GTT:10633 fail-close: per iteration compute H(k) for the
single varying (possibly composite) key, co-spend the bracketing predecessor at input[master+blockSize+counter], bracket
coSlot<H(k)<coNext (present key / same-gap fail closed), pin P' at output[..+2c] + NEW at output[..+2c+1]; teardown pins
predecessor-input count == counter and entry-output count == 2c. ABI tag `sortedInsertLoops`. Fixed 2 latent bugs:
loop-written sorted slots need `inLoop=true` so the epilogue skips them; `findSortedInsertLoopWrite` needs cycle
protection (post-inline AST graph cycles). [SUPERSEDED by the RESOLVED note below - the scattered design was replaced by
the range-splice for the common case; the SDK auto-derivation now lands the co-spend + pinned chain automatically.]

**RESOLVED 2026-07-18 for the common case (commits 513a46dc + a0ddf62e + 5576be5d). The insert-loop now works
VM-verified.** Two things landed: (1) the scattered covenant's VM bug was root-caused + fixed (513a46dc): the SDK had
put predecessors in `iterationEntryInputs` which PRESERVES co-spent inputs as unchanged outputs, colliding with where
P' lands; the fix is a NEW `insertLoopPredecessorInputs` list (co-spent, NOT preserved, NOT counted in the output base).
(2) the COMMON one-gap case - N keys into a FRESH/sparse map (whitelistWorkers on a new job, all bracket the SAME
predecessor) - is now built as the RANGE-SPLICE (a0ddf62e): co-spend ONE predecessor P, mint a sorted chain
P'->k1->..->kN->P.oldNext. The source-order/slot-order tension is SIDESTEPPED (no permutation check needed): the covenant
carries `expected_slot` through the loop and iterates the SORTED OUTPUT chain, not the source-order xs - setup verifies
P'=P.slot|s1|P.value & expected=P'.next; body reads chain node output[base+1+counter], verifies slot==expected_slot &
slot<next & value==v & bytecode==addr, sets expected=next; teardown verifies expected==P.oldNext & outcount==counter+1 &
incount==1. C2-sound WITHOUT a permutation check for positive-membership maps (whitelistWorkers reads
`job.whitelist==false || w[jobId][sender]` = absence self-denies only): the covenant just needs the minted chain to be a
VALID sorted list; WHICH keys (==xs) is job-creator data enforced by the SDK, not a C2 property. VM-verified
(SortedInsertLoop.test.ts, 4 green): N=1 fresh+populated; N>1 into fresh one call; **NESTED 2-key w[jobId][ks[i]]=true
(the exact whitelistWorkers shape) N>1 fresh** (composite slot keyToSlotMulti SDK-side, covenant key-agnostic);
distinct-gap works-or-fails-closed. RESOLVED (`8368019b`): EVERY loop-invariant sorted-set write now routes to the
UPSERT loop - bool `= true`/`= false` (bool = int 1/0, valueConst), int `= <param>`/`= <literal>`/`= vs[i]`, and RMW
`+=`/`-=`/delete. Gains over the range-splice: UPDATE existing keys, MULTI-GAP `= true` in one call (incremental
whitelist on a populated map - distinct gaps + same-gap chains), and `= false` nullify-in-loop (value 0). The
range-splice matcher now matches nothing (inert; kept for reference). VM-proven (SortedInsertLoop: N distinct, N>1
fresh one-gap, nested w[jobId][worker], N>1 DISTINCT gaps). NO bool set-loop deferrals remain.

Marketplace: V1 compiles past whitelistWorkers but its FULL assembled contract is ~674k ops (a
pre-existing deep-inlining explosion, NOT this covenant - a 3-entry-point multi-site insert loop is <1s); commit
8d5004d0 made the optimiser's per-pass O(n) and OPTIMISER_SKIP_MAX_OPS skips optimisation entirely above 50k ops so it
degrades gracefully (compiles unoptimised) instead of hanging.

**(b) Marketplace external-call TARGET through the SafeERC20 low-level-call chain - RESOLVED 2026-07-18 (commit
1e395862).** `IERC20(job.token)` where the token is a STORAGE-POINTER struct field, routed through OZ SafeERC20 ->
`Address.functionCall` -> low-level `.call`. After the chain inlines, forceApprove's `_callOptionalReturnBool` is
`address(__rh0_token).call(data)` where the inliner bound `token = IERC20(jobs[id].token)`; the inlined-local cast
form failed "external call target must be a parameter". FIX: `SynthesizeExternalAddressLocals` (runs AFTER inlining)
now traces a low-level-call receiver to its provenance ROOT - unwrapping `address(..)` / interface casts and
following inliner SSA aliases (`__rh*`/`__inl*`) plus SINGLE-ASSIGNMENT user locals (the Marketplace
`IERC20 token = IERC20(job.token)` intermediary, line 718/781) - and hoists the self-pinned state chain / param-root
into an `__extaddr_ll_` local, so the covenant pins the co-spent callee to the state value (byte-identical to the
shipped direct form). SOUNDNESS: a REASSIGNABLE user local is NOT traced (a caller could rebind it = the forgery), so
it fails closed; proven end to end (SafeErc20ChainTargetPinning.test.ts: correct callee accepted, substituted callee
REJECTED, adversarial reassigned-local fails closed). The distinct `memory-COPY struct field` DIRECT case (section
above) is still deferred - my trace stops at a FieldAccess on a struct-copy local (no whole-struct-copy provenance).

**(c) MULTIPLE writes to the SAME C2 entry in one call (coalescing) - RESOLVED 2026-07-18 (`CacheMappingEntryInLoop`).**
Surfaced probing C2 ARRAY writes. A single element write `m[k][i]=v` / `push` / `pop` / whole assign works, but two
STRAIGHT-LINE writes to the same entry (`m[k][0]=x; m[k][2]=z`, or a loop `for(j<3) m[k][j]=v`) did NOT: each routes to
its own `emitSortedValueUpsert`, which CO-SPENDS the entry NFT + emits one output entry, so a second upsert needs a
second co-spend of the same (now already-spent) input and a second output - the covenant OP_VERIFYs fail (runtime
revert, fail-closed, not silent). The DEFAULT entry model handles this via `pendingEntryWrites` read-after-write
chaining; the C2 analog is COALESCING: read the entry ONCE, apply all the surgeries in memory, emit ONE output.

**SHIPPED as a RUNTIME cache-in-loop desugar, NOT unrolling** (user steer "all ops should be runtime; unrolling eats the
byte-limit + has side effects"). `CacheMappingEntryInLoop` (sibling of `CacheDynamicArrayInLoop`, wired right after it in
compiler.ts, both compile paths) does read-once/mutate-local/write-once for a keyed MAPPING ENTRY `m[k]`:
`for(..) m[k][j]=v` -> `T[] __c2cache_N = m[k]; for(..) __c2cache_N[j]=v; m[k] = __c2cache_N;` - the loop stays a RUNTIME
loop over the LOCAL array (one covenant body, no byte blowup, fixed OR dynamic bound), and the C2 write is a SINGLE
upsert that already works. FUNCTION-scoped so it also coalesces the straight-line consecutive case
(`m[k][0]=x; m[k][2]=z`) and conditional writes. An entry is cached when it is written via array ops (element/push/pop)
inside a loop OR >=2 times, its key is a simple identifier NOT reassigned in the function (loop-invariant), and there is
no whole-entry assign/delete of it. `EntryRedirect` rewrites EVERY access: writes (MappingAssignNode element/push/pop) ->
local array ops; reads (`m[k]` / `m[k][j]` are ArrayAccessNodes bottoming at IdentifierNode(m)) -> `local` / `local[j]`,
so read-after-write `m[k][j]=m[k][j-1]+1` reads the value being built (value-verified `[0,10,20]`->`[0,1,2]`). Flushes
`m[k]=local` before every return + at the tail. A single element write with a same-entry RHS read `m[k][0]=m[k][1]+1`
(count==1, not cached) works directly at runtime (RMW materialize handles the one read). Tests: value-verified in
`SortedArrayCacheInLoop` (loop build+fill, read-after-write prefix, consecutive set02); fail-close boundary in
`SortedArrayWriteFailClose`. Commits: (this line's change).

STILL fail-closed (sound, not silent): a DIFFERENT-key insert loop `for(i) m[k[i]]=v` (per-iteration sorted-insert
covenant, framing (a)); a MULTI-DIMENSIONAL array element write `m[k][i][j]` on `mapping(K => T[][])` (clean
`UnsupportedTypeError` - it used to CRASH when the excess index was type-checked as a phantom key at
`allKeyTypes[i] == undefined`; guarded in `TypeCheckTraversal.visitMappingAssign` by `node.keys.length > allKeyTypes.length`);
and function-pointer element values (no C2 path). Note the existing default-model `UnrollFixedBoundEntryLoop`
(whole-entry fixed loops, ArrayAssignNode form) still unrolls - unifying it onto the cache-in-loop model would remove the
unroll, but it is wired + tested (CorpusGapFixes), a separate change.

---

## Memory-model unification: followups after the shared-primitive extraction (2026-07-19, `bd9822ee`)

`packages/solidc/src/semantic/YulMemPrimitives.ts` now holds the single lowering of the `__yulmem` word/byte
store, word load, reserved init, and grow; `LowerMemoryModel` (high-level memory) and `LowerInlineAssembly` (Yul
runtime memory) both delegate to it (was two byte-identical re-implementations). This closed the "split memory
model" (Solidity has one: `YulUtilFunctions` emits Yul `mstore`/`mload` for high-level mem ops, `libyul` is the
one backend). Three items were scoped but not done in that pass.

### A. Option 2 - LowerMemoryModel EMITS Yul `mstore`/`mload`, LIA becomes the SOLE lowering - DEFERRED (AST mismatch, 2026-07-19)

**What.** The literal Solidity endpoint: `LowerMemoryModel` stops building bytes-ops and instead emits Yul
`mstore(addr,word)` / `mload(addr)` / `mstore8` nodes; `LowerInlineAssembly.runtime*` (already on `YulMemPrimitives`)
becomes the single place that lowers memory primitives, with lazy `memGrowTo`-on-write replacing the explicit
alloc-grow.

**Why deferred (investigated 2026-07-19, evidence-backed - this is architectural, not "later").**
- **FUNDAMENTAL BLOCKER: Yul is statement-level only in our AST.** `AssemblyStatementNode extends StatementNode`
  (`ast/AST.ts:707`); there is NO Yul/assembly *expression* node - a Yul value only escapes via a `x := ..`
  assignment to an outer local. But `LowerMemoryModel` embeds `mload` results DEEP INSIDE nested high-level
  expressions: `this.mload(this.fieldAddr(base.ptr, i), ..)` where the result is itself a `base.ptr` feeding a
  further `fieldAddr`/`elemAddr` (nested pointer chains like `mload(fieldAddr(mload(elemAddr(base,i)),j))`;
  `LowerMemoryModel.ts` resolvePtr/elemRead ~704/946/1122/1133). Solidity can emit Yul mload as an expression
  because its IR is single-layer Yul (everything is a Yul expression); OUR AST is two-layer (high-level expressions
  + statement-scoped Yul), so LMM CANNOT emit a Yul mload where an expression is required without either (a) adding
  an expression-level Yul IR (a large AST + codegen change), or (b) spilling every access to a statement-level temp
  (`assembly { t := mload(p) }` then use `t`) - which for the nested chains means several asm blocks + temps per
  access, almost certainly LARGER bytecode than today's inline bytes-ops.
- **Eager alloc-grow is substrate-appropriate, not a wart.** EVM does lazy grow because its memory is implicitly
  infinite and uniform; our `__yulmem` is a real `bytes` value that must be physically extended. One pre-grow at
  allocation is cheaper than a `memGrowTo` guard on EVERY store, and the 10KB unlocking-bytecode limit makes the
  per-store guards a real size cost. So the "lazy grow" half of Option 2 is a likely NET size REGRESSION here.
- **Option 1 already delivered the substantive win.** The store/load/byte/init/grow FORMULAS are single-source in
  `YulMemPrimitives` (a primitive-formula fix lands in ONE place). What stays per-caller (eager-vs-lazy grow, typed
  vs raw decode, expression-embed vs statement-lower) is inherent to the two different SOURCES, not duplication.

**What it'd take.** An expression-level Yul IR (so `mload` can be an expression), OR pervasive per-access temp
spilling in LMM - both large, and the lazy-grow model would still need a no-grow store variant to avoid the size
regression. Not worth it against the marginal gain over Option 1.

**Revisit if.** The AST gains an expression-level Yul/assembly node for another reason (then LMM emitting Yul
becomes cheap and A is worth reconsidering), or a concrete case needs high-level + assembly to share a *lowering*
change that the shared primitives cannot already absorb.

### B. Route the remaining LIA region-copy grows through `memGrowTo` - RESOLVED 2026-07-19 (`f1445136`)

`runtimeReturndatacopy`, `runtimeCopyInto` (codecopy/extcodecopy/calldatacopy), and mcopy's `growTo2` built their
own inline `if (__yulmem.length < need) __yulmem = concat(__yulmem, new bytes(need - length))` branch; all now
delegate to the shared `memGrowTo(need, src)` (`growTo2` binds mcopy's need to a temp once, then calls memGrowTo).
Every buffer grow (word/byte store + all region copies) is now one formula. Byte-identical: 179 exact-bytecode +
corpus per-file diff 0 OK<->FAIL, 0 error drift across 4876 files.

### C. `mstore8` byte-encoding co-located in `memByteStore` - RESOLVED 2026-07-19 (`f1445136`)

Both encodings now live in `memByteStore(off, val, { fullWord }, src)`: `fullWord:true` (Yul mstore8 on an arbitrary
256-bit word) builds `bytes32(val)[0:1]`, `fullWord:false` (a high-level byte-typed value) builds `bytes1(val)`.
They stay DISTINCT expressions on purpose - the domains differ (`bytes1(v)` is cheaper but OP_NUM2BIN-overflows for
`v >= 256`; the Yul low-byte extraction is valid for any word) - but the byte-write formula is now single-source and
callers select by domain instead of hand-building the cast. Byte-identical (same corpus/VM proof as B).

## Cross-contract callee sorted-mapping entry writes (incl. msg.sender-keyed) - RESOLVED 2026-07-20 (2149ca3d, 80564df2)

SHIPPED + VM-verified (solidcash `CrossContractSortedWrite.test.ts`: UPDATE + INSERT + msg.sender). All SDK
(StatefulContract + StatefulTransactionBuilder): (1) entry INPUT co-spend by slot via `SortedList` (exact = UPDATE,
predecessor = INSERT); (2) the KEY UNLOCK - patch B's entry unlocker with the REAL `bMasterIdx` once the tx layout is
known (the entry covenant's write path verifies a minting NFT at `masterInputIndex = B's master`, unknown at
block-build time; the derivation probe runs only B's master covenant, so the placeholder is fine for extraction);
(3) entry OUTPUT from B's trace (`extractCommitmentMapFromTrace` at `bOutputBase+si`) -> new STB
`externalCallEntryOutputs` + output-loop entry case; (4) INSERT - detect via `out.next != in.next`, mint a PLACEHOLDER
NEW at `bMasterIdx+blockSize` so a 2nd VM pass reaches the NEW's `OP_OUTPUTTOKENCOMMITMENT` (the 1st aborts at
`OP_OUTPUTBYTECODE` for the not-yet-existing NEW), then replace with the real commitment (per-group
`externalCallEntryInserts` + trailing placement); (5) msg.sender - append OUR category REVERSED (internal order) as B's
`_msgSenderCategory`, and key the entry by `keyToSlot(addressToLockScript(this.address))` (the caller's on-chain LBC,
NOT `withCategory().lockingBytecode`). A callee LOOP write `for(i) this.bal[ks[i]] (+)= vs[i]` is now DONE
(`e910d18a`, `solidcash/test/e2e/CrossContractLoopWrite.test.ts`): B's loop function has NO fixed entry slot
(blockSize=1) so its N entries are trailing (B reads master+blockSize+counter); the SDK detects B's
sortedUpsertLoopInfo, co-spends each existing entry, SDK-computes each updated commitment (B's covenant verifies -
a wrong commitment reverts, a misplaced input trips B's coSlot==Hk check), appends the inputs to B's block, and mints
the trailing outputs (STB `entryLoopCommitments`/`entryLoopStart` + the derive-time master-index patch on the loop
unlockers). Supports per-key/scalar, op +/set, int, one collection. Fail-closed (clean throw): absent key (insert), a
callee that ALSO writes other state (blockSize>1 - the data-NFT derivation is not yet interleaved with the loop
co-spend), multi-collection, non-int, dup keys. A >60 B CHUNKED callee value stays fail-closed (VM-verified,
`CrossContractSubcaseSoundness.test.ts`) - it would need B's value-chunk pins co-spent (same as the single-contract
chunked-in-loop). Original analysis retained below.

### Original analysis

**What.** When contract A calls B via `withExternalCall` and B's called function WRITES a C2 (sorted) mapping -
`B.deposit()` doing `this.bal[k] = v` or `this.bal[msg.sender] = v` - the transaction fails on the VM (verified:
input 2 OP_OUTPUTTOKENCOMMITMENT verify for a normal key `bal[k]=v`; empty-stack for the msg.sender variant).
Single-contract sorted-mapping writes work; a CROSS-CONTRACT callee's sorted write does not.

**Why.** The cross-contract dispatch (`StatefulContract.ts` externalCallUtxoGroups, ~6114-6470) derives only the
callee's SCALAR data NFTs (`bDataNfts`, `requiredDataNftIndices`) + its function args. It has NO callee sorted-mapping
ENTRY derivation: it never co-spends the entry/predecessor, never mints P'/NEW in the callee's block layout, never
pins the value. The single-contract path does all this in the `entryAccesses` loop (~5090-5250), but that loop runs
only for the tx-building (caller) contract, not for a co-spent callee. So the msg.sender-keyed case (boundary #1) is
blocked on this LARGER missing feature - it is NOT a msg.sender-resolution tweak.

**What it'd take (mechanism fully mapped 2026-07-20).** Three SDK sites, no compiler change for the UPDATE case (B's
block layout, compiled normally, already reserves the entry slot):
1. ENTRY INPUT co-spend (`StatefulContract.ts` ~6363, the `case 'entry'` in the external block builder): today it
   key-matches via `parseEntryCommitment` (the DEFAULT key||value shape) - WRONG for a C2 entry (slot||next||value).
   For `bCollection.sorted`, build `SortedList.fromUtxos(bEntryUtxos)` and co-spend `list.find(keyToSlot(key))` (UPDATE)
   or `list.predecessorOf(...)` (INSERT).
2. ENTRY OUTPUT derivation: the group derivation (~4254-4294) runs B's VM + `extractCommitmentsFromTrace` over B's
   DATA-NFT output range only. Widen it to B's entry-slot output offset(s) to extract the entry commitment(s), store
   on the group, and create the output in the STB external-call output loop (`StatefulTransactionBuilder.ts` ~1293,
   which handles keccak/event slots but has NO `entry` case).
3. INSERT (absent key) mints P'+NEW (2 outputs); the entry slot gives ONE. The NEW rides B's trailing entry-output
   region like the single-contract insert - needs the extraction + STB output to place a 2nd output per insert.
THEN the msg.sender variant: set B's `_msgSenderCategory` = A's category + key by `keyToSlot(A's locking bytecode)`
(the covenant already resolves a contract msg.sender via emitMsgSenderMintingVerification -> caller LBC; A's minting
master is already co-spent). Repro (skipped): `solidcash/test/e2e/MsgSenderCrossContractC2.test.ts`. NOTE: these files
(StatefulContract/StatefulTransactionBuilder/GTT) were under heavy concurrent edit on 2026-07-20; land this when they
are quiescent to avoid two-writer tangling in the delicate cross-contract dispatch.

**Revisit if.** A real port needs a contract-to-contract call that credits the callee's balances/allowances mapping
(the common DEX-holds-tokens shape). Un-skip the repro once the callee-entry derivation lands.

## Array-VALUE sorted insert-in-loop `for(i) m[ks[i]] = a` - RESOLVED 2026-07-20 (`7d1b104b`)

INLINE case SHIPPED + VM-verified (solidcash `SortedArrayValueLoop.test.ts`): a loop assigning a loop-invariant
rawbytes value (bytes/string/int[]/bytesN) to N sorted-mapping keys now routes through the upsert loop. Covenant:
the guard accepts a rawbytes value for the invariant-param set only; the body wraps a CHUNKABLE value as the inline
tail `len4 ++ value` with a runtime `size<=60` assert (chunked-in-loop still fails closed), stores fixed rawbytes
(bytesN) verbatim, and skips the value BIN2NUM (every mint CATs the tail; the 'set' repoint copies `pu_val=amt`).
SDK: a `scalarTail` threads through a `commitValue()` helper at every commitment site; the int path is byte-identical
(35 int upsert-loop tests unchanged). CHUNKED (>60 B) stays fail-closed on BOTH sides.

## Array-VALUE sorted loop PER-KEY `for(i) m[ks[i]] = vs[i]` - RESOLVED 2026-07-20b (`817e8a1c`)

The per-key varying form (vs a `bytes[]`/`int[][]` param, each key its OWN value) now routes too. The covenant needed
only a 2-line guard relax (`isPerKeySet` accepts rawbytes; `rawbytesOk = isParamSet || isPerKeySet`): the body already
wraps each visited `vs[i]` as the inline tail via `isChunkableVal` (value-kind-based, not param-vs-perkey), and the setup
captures `valueArrayParam` for any type - so no body/setup change. The earlier "SDK planner too int-shaped / risks
regressing" worry was DISPROVEN: `DeferredEntry.newVal` is now `bigint | Uint8Array` and every arithmetic path is
int-only by the `op==='set'` guard (a rawbytes value never adds/subtracts), so the int cases are byte-identical (45
int/invariant upsert-loop tests unchanged); the dedup stores `set` values verbatim (last-wins, no `toBig`). VM:
`SortedArrayValueVaryingLoop.test.ts` (bytes[]/int[][] per-key independence, duplicate last-wins, >60 B fail-closed).

### Still fail-closed: CHUNKED (>60 B) value in a loop (considered effort/risk deferral - NOT fundamental)

Implementable via an INTERLEAVED `[entry][chunks]` output layout with a running chunk-output counter (base_i =
`master + blockSize + runningCounter`, advanced by `1|2 + nNew` each iteration; reads locate chunks by identity, not
position, so interleaving is sound). NOT done because threading chunk-region management through EVERY mint site of the
deferred/chained/msg.sender-merge/insert loop state machine - the most soundness-critical covenant - is a large change
disproportionate to the rare bulk-LONG-value pattern. The chunk NFT is keyed by `(slot=Hk32, digest)`, so even an
invariant value cannot share one chunk set across keys. Revisit if a real port needs bulk long values in a loop.

**Revisit if.** A real port needs bulk array-value initialization across keys in one loop, OR the upsert-loop planner
is refactored to a value-kind-generic shape for another reason (then the bytes branch is cheap + low-risk).

## Composite sub-slot field access: top-level array-of-struct only - MOSTLY DONE 2026-07-20

RESOLVED for almost everything: bool/enum leaf fields (6448f446) and NESTED ARRAYS-in-struct
(1cc36ad2, `struct S { uint64[2] arr; ... }` via a field/index step path + full-value ctor/array-
literal rebuild) now work, VM-proven. The ONLY remaining fail-closed composite case is a TOP-LEVEL
fixed array OF structs (`P[2] ps`) - excluded because the SDK cannot auto-derive that state-var
layout even without assembly (verified: a plain `P[2] ps` contract fails state derivation the same
way). So its slot codegen is sound-by-reduction but would compile to an SDK-underivable covenant;
revisit when the SDK gains array-of-struct state derivation, then drop the StructType-only gate in
compositeLeaves. Original analysis (now largely resolved) below.

**What.** `sload/sstore(v.slot + i)` on a fixed struct's / fixed value array's own slots is DONE: flat struct
(57649637), fixed value array incl. ragged uint40 packing (33f5f5c3), and NESTED struct-in-struct (34f1f316,
recursive rebuildStructAtSlot). All VM-proven with field<->slot cross-checks + top-bit values; +2 corpus. Three
leaf/field kinds still fail the WHOLE composite closed (loud, never a silent __evm_storage read): (1) a fixed
ARRAY field INSIDE a struct, or a top-level array OF structs (nested-array composition - struct-in-struct is done,
array<->struct nesting is not); (2) a bool/enum field (width 1) - isSupportedSlotField gates it out, same as the
SCALAR slot path (a shared gap, not composite-specific); (3) address/dynamic-bytes/string (variable-width, its own
deferral - the dynamic-value slot model).

**Why deferred (value, not tractability).** NESTED-ARRAY: the corpus files that would use it
(struct_delete_storage_nested_small, recursive_struct_2, struct_delete_storage_with_arrays_small) ALSO need OTHER
unbuilt features - nested-struct `delete` lowering, and mapping/array-bearing-struct field flattening (`s__b`) - so
this wins 0 files alone. The struct-in-struct recursion already landed; extending it to arrays needs the leaf
access-path to carry array-INDEX steps and the decompose to rebuild through ArrayAssign at intermediate levels
(struct-in-array element rebuild = read-modify-write), more machinery for 0 immediate corpus gain. BOOL/ENUM:
castWordToFieldType/fieldAsWordFrom only handle int/bytesN/UDVT; a bool/enum slot field needs a 1-byte
encode/decode branch, and CROSSES a soundness subtlety - the typed read cleans (uint256(bool) in {0,1}, an
out-of-range enum cast reverts), so a raw sstore of a dirty byte then sload would DIVERGE from EVM's raw slot bits
(EVM preserves them; the typed field access cleans). 0 corpus demand (verified: no .sol semanticTest packs a
bool/enum in a slot + assembly-accesses it), so fail-closed is the SOUNDER default than a subtly-diverging path.

**What it'd take.** NESTED-ARRAY: generalize CompLeaf.path from `string[]` to a step list
(`{kind:'field',name} | {kind:'index',i}`), fold both into the read access (FieldAccess/ArrayAccess) and the
decompose rebuild (nested ctor for struct steps, ArrayAssign/read-modify-write for index steps) - VM-prove with the
field<->slot cross-check + top-bit values. BOOL/ENUM: only if a real need appears - extend castWordToFieldType
(word -> bool = `word % 2 != 0`; word -> enum = bounded int cast) + fieldAsWordFrom (bool/enum -> uint256), and
DOCUMENT the raw-vs-typed cleaning divergence; VM-test a packed bool+int slot both directions.

**Revisit if.** A concrete port needs nested-array slot access AND its sibling features (nested `delete`, struct
flattening) land - do it alongside them, not before. Bool/enum: only with demonstrated demand, and accept the
typed-cleaning divergence explicitly.

## Dynamic-array resize `sstore(dynArray.slot, n)` - DONE 2026-07-20 (0b2f89c0)

RESOLVED. Built via direct blob surgery (NOT the VM-disproven O(n^2) push/pop loop): GTT
visitStateArrayPop, gated by StateArrayPopNode.resizeTo (LIA emits it for a fixed-width dyn array),
branchless `elems' = (elems ++ zeros(n*width))[0 : n*width]` re-prefixed with pushdata(n), reusing
the proven emitReadStateArrayBlob/emitWriteStateArrayBlob paths. VM-proven grow/shrink/zero/empty
(uint256 + uint128) cross-checked vs .length and a[i]; +5 corpus (the array_copy/clear/delete
cluster). EVM stale-bit divergence documented (BCH zero-fills). Original analysis kept below.

**What.** `sstore(x.slot, n)` on a DYNAMIC array `T[] x` sets its LENGTH to n (EVM stores a dyn array's length at
its base slot). Corpus: ~6 files (array/copying/array_copy_cleanup_*, array_copy_clear_storage*,
inlineAssembly/inline_assembly_storage_access_local_var, array/delete/delete_storage_array_packed). Currently fails
closed (resolveDynArrayName handles the READ `sload(x.slot)` -> length; the WRITE is unmodeled). The sound BCH
semantic is a RESIZE: grow zero-fills, shrink truncates - which matches the corpus tests (they set length after a
`x=y` copy whose cleanup already zeroed the freed element slots, so zero-fill == EVM's dirty-length-bump there).

**Why deferred (soundness-paramount, evidence-backed).** BCH stores a fixed-width dyn array as a chunk-packed blob
`[A$len header][packed elements]` with length = A$len/width - NOT EVM's separate length slot + keccak element
slots. So resize = adjust the blob to n*width bytes + update A$len. Two approaches, both problematic to land
autonomously:
 - PUSH/POP LOOP (`while(len<n) push(0); while(len>n) pop();`) - reuses proven primitives, BUT **VM-DISPROVEN**
   2026-07-20: each push/pop reassembles the whole array blob, so the loop is O(n^2) blob ops and BLEW the
   operation-cost density limit even for n=4-from-2 ("operation cost following operation: 2322056 > 2321600").
   Dead end.
 - DIRECT BLOB SURGERY - the sound + cheap path: reuse emitReadStateArrayBlob (reassembles `pushdata(count)++elems`)
   -> on-stack decode count, compute target=n*width, runtime-branch (OP_SIZE vs target) truncate (OP_SPLIT) or
   zero-pad (OP_CAT num2bin(0, target-size)), re-encode `pushdata(n)++elems'` -> reuse emitWriteStateArrayBlob. This
   reuses the PROVEN read+write blob paths, but the middle surgery is NEW GTT codegen with a runtime branch on
   fund-relevant state (A$len + chunk blob). New fund-relevant codegen without review is exactly what
   soundness-paramount says not to rush in an autonomous burn-down.

**What it'd take.** A `StateArrayResizeNode` (or an LIA-emitted marker) + a GTT visitor implementing the direct
blob surgery above, gated to `sstore(fixedWidthDynArray.slot, n)`. Scope: fixed-width element arrays only
(variable-width bytes[]/string[] elements have per-element length prefixes - harder). VM-prove grow (zero-fill,
existing elements preserved), shrink (truncate), and the exact corpus shape (`x=y` then resize -> tail reads 0),
each cross-checked against `x.length` and `x[i]`. Accept + document the EVM divergence: EVM's length-bump exposes
STALE element-slot bits, BCH zero-fills (a footgun EVM has, BCH's clean model does not replicate).

**Revisit if.** Dynamic-array copy/clear/delete becomes a priority (this is that whole cluster's entry point), and
the fund-relevant blob surgery can get review. Do it with the other array/* deep work (element-slot writes
`sstore(keccak256(0,32)+i, v)`), not as a standalone increment.

## Calldata `.offset` on dynamic params - MOSTLY DONE 2026-07-20 (cebd086b, ac82db9f)

RESOLVED for the READ + ASSIGN forms. `x.offset` of a FIRST dynamic calldata param = the compile-time ABI data
position `4 + headWords*32 + 32` (cebd086b; not a fake position - the exact value EVM computes, VM-proven 0x44 /
0x84). `x.offset := v` / `x.length := v` (a calldata-slice re-point) = a function-scoped mutable local, read back
across blocks (ac82db9f). Corpus +2 (calldata_offset_read, calldata_offset_read_write). REMAINING: a dynamic param
that is NOT the first (cumulative runtime tail) and calldata_array_read (nested calldata arrays: `uint[2][] calldata`,
`uint[2] calldata t = x[1]; s := t` - reading a calldata fixed-array element as a value; a separate deeper feature).
Original analysis (now largely resolved) below.

## Calldata `.offset` on dynamic params - DEFERRED 2026-07-20

**What.** In assembly, bare `<dynParam>.offset` (a numeric ABI-tail position) on a `bytes`/`string`/`T[]` calldata
parameter fails closed. Already WORKING: `<dynParam>.length`, and the COPY form `calldatacopy(_, P.offset, P.length)`
(resolveCalldataParamCopy: the copied region IS the param's bytes), and storage-pointer `.offset` (a different
`.offset` = the in-slot byte offset). NOT fundamental (ABI parity is built) - bare calldata `.offset` needs the
calldata MODEL rebuilt.

**FLIP INVESTIGATION 2026-07-20: ~0 corpus flip + no cheap sound version.** The canonical `.offset` files need MUCH
more than `.offset`: `calldata_array_read` uses NESTED calldata arrays (`uint[2][] calldata`, `uint[2] calldata t =
x[1]`, `s := t`), `calldata_array_assign_dynamic` ASSIGNS `x.offset := 0x44` (constructs a calldata slice, then
`r = x`). So `.offset` alone flips essentially nothing. And there is NO cheap sound version: a fake offset into the
synthetic `msg.sig ++ bytes32(params)` buffer would make a following `calldataload(offset)` read the wrong bytes =
SILENT MISCOMPILE. A correct `.offset` REQUIRES the real ABI head/tail model, whose delicate rewrite risks the
currently-WORKING calldataload/copy/size/.length paths for ~0 gain. So: tractable in principle, but not worth an
autonomous build (low value + regression risk + shortcut = miscompile).

**Why deferred (scope, not tractability).** solidcash synthesizes calldata as `msg.sig ++ bytes32(p_0) ++
bytes32(p_1) ++ ...` - ONE 32-byte word per parameter (synthesizedCalldata in LowerInlineAssembly). That models a
static ABI head, so a value param's `calldataload(4+32*i)` and a dynamic param's `.length` (a single count) resolve.
But a dynamic param's `.offset` points at the ABI TAIL (the head holds an offset, the tail holds `length ++ data`),
which the one-word-per-param model does not lay out - there is no tail region to point into.

**What it'd take.** Rebuild synthesizedCalldata as a REAL ABI head/tail encoding: static params + offset words in the
head, each dynamic param's `length ++ padded-data` in the tail, and make `.offset` resolve to the tail position while
keeping `calldataload`/`calldatacopy`/`calldatasize`/`.length` all consistent against the same buffer. Substantial +
delicate (every calldata op must agree on one layout); reuse the ABI encoders in [[evm_parity_deep_research_2026_07]]
/ docs/evm-abi-parity.md. Gate behind the exact dynamic-`.offset` shape so static-calldata codegen is untouched.

**Revisit if.** A concrete port needs dynamic-calldata tail access (raw ABI decoding in assembly), or the calldata
model is rebuilt for another reason - then `.offset` falls out of the head/tail layout.

## bytes/string slot fields + address slot fields - PARTLY DONE 2026-07-20 (8bd5e708, 419673d1)

UPDATE: the short-string byte-array encoding IS built, VM-proven. `sstore(bytesVar.slot, constX)` decodes EVM's
short-slot layout at COMPILE TIME (data left-aligned in the high bytes big-endian, low byte = 2*len; X==0 clears) ->
`bytesVar = <the top len bytes>` (8bd5e708, corpus dirty_storage_bytes). `sload(bytesVar.slot)` lowers to the runtime
encoding `len<32 ? uint256(bytes32((b ++ zeros ++ bytes1(2*len)).reverse())) : 2*len+1` (419673d1, corpus
byte_array_storage_layout; uint256(bytesN) is little-endian so the big-endian blob is reversed - VM-confirmed). +3
corpus. The BYTE-REVERSAL was VM-proven step-by-step (b="dead" -> exact 0x64656164<<224|8), NOT a blind miscompile.
REMAINING bytes: LONG-string RESIZE (`sstore(b.slot, oddX)` odd low byte -> len (X-1)/2) + the keccak-DATA-region
write/read (`sstore(keccak256(0,b.slot), data)` / `sload(keccak256(0,32))`, dirty_storage_bytes_long,
delete_bytes_array), invalid-encoding corners, and the bytes-push-LOOP SDK state-derivation gap (a plain bytes push
loop fails auto-derivation even without assembly - orthogonal SDK limitation). address slots = bounded-address
(Section 10: against). Original analysis (now partly resolved) below.

## bytes/string slot fields + address slot fields - DEFERRED 2026-07-20 (per-file evidence added)

**PER-FILE AUDIT 2026-07-20 - none flips via a clean resize/clear; ALL need EVM byte-array-encoding internals.**
Checked each of the 7: `dirty_storage_bytes` = short-string data write `sstore(b.slot, or("deadbeef",0x08))` then
`b[3]` - needs the SHORT inline-data decode with a BYTE REVERSAL (EVM big-endian high-byte data -> BCH byte order);
`byte_array_storage_layout` + `dirty_memory_bytes_to_storage_copy[_ir]` = `sload(b.slot)` returning the short/long
length encoding, which for a short string INCLUDES the data (same reversal; and sload can't know the length at
compile time so it can't partial-fail); `dirty_storage_bytes_long` + `delete_bytes_array` = a keccak-DATA-region
write/read `sstore(keccak256(0,b.slot), data)` / `sload(keccak256(0,32))` (the computed-element-slot deferral);
`invalid_encoding_for_storage_byte_array` = deliberately-INVALID slot encodings (length 32/odd corner cases). So a
sound write-only slice (clear + long-resize, no reversal) flips 0 of them - every file needs the data reversal, the
keccak-data region, or an invalid-encoding corner. Building the byte-reversal encoding autonomously for these
EVM-storage-implementation tests is exactly the miscompile risk to avoid (endianness). CONFIRMS: not a clean
increment - faithful EVM byte-array storage-encoding emulation, conflicting with BCH's chunk model.

**What.** A `bytes`/`string` or `address` state var packed into / accessed via a raw slot fails closed (the
composite/scalar slot machinery accepts only fixed value types: int/bytesN/bool/enum/UDVT). ~7 corpus files touch
`sstore/sload(bytesVar.slot)` (dirty_storage_bytes[_long], byte_array_storage_layout, delete_bytes_array,
dirty_memory_bytes_to_storage_copy[_ir], invalid_encoding_for_storage_byte_array).

**Why deferred (BCH-model conflict + EVM-internals, not tractability).** These are NOT a portable pattern - they test
EVM's specific byte-ARRAY STORAGE ENCODING: a SHORT (<32B) bytes/string stores its data left-aligned in the slot with
`length*2` in the low byte; a LONG one stores `length*2+1` in the slot and the data at `keccak(slot)`. E.g.
dirty_storage_bytes writes `sstore(b.slot, or("deadbeef", 0x08))` = inline data ++ length byte 8 (=4*2), then reads
`b[3]`. To make `sstore(b.slot, rawEncoding)` + `b[i]` agree, the bytes value would have to be STORED in EVM's inline
encoding - which conflicts with BCH's chunk-UTXO storage model (the working model). So this is not an increment; it is
"emulate EVM byte-array slot encoding," replacing a working storage model to pass EVM-implementation-detail tests.
ADDRESS slot fields are the variable-width case tied to the bounded-address rescope, which Section 10 of
docs/bounded-address.md RECOMMENDS AGAINST; keep fail-closed.

**What it'd take.** For bytes/string: a full EVM-storage-encoding shim (short-inline data+length*2 / long-keccak
length*2+1) for the slot access AND every high-level bytes op (`b[i]`, push/pop, length) reading through it -
effectively a second, EVM-shaped storage backend for bytes/string alongside the chunk model. High effort, conflicts
with the sound BCH default, low real-world value (EVM-internals tests). A PARTIAL sound slice is possible - a READ-only
`sload(bytesVar.slot)` returning the EVM length encoding (`len*2` short / `len*2+1` long, derivable from `.length`) +
`sstore(bytesVar.slot, 0)` == clear - but the inline-DATA writes (dirty_storage_bytes) still need the full encoding,
so even the partial slice flips ~1 file.

**Revisit if.** Faithful EVM byte-array storage-encoding becomes a real need (unlikely - BCH's chunk model is the
right one). For address: only if bounded-address is reconsidered (Section 10 says no on current evidence).

---

## MULTI-use loop-body local receiver of a computed target (Router02 `_swapSupportingFeeOnTransferTokens`)  — 2026-07-20

**What.** A loop-body local holding a per-iteration computed external-call target, used by MORE THAN ONE call per
iteration, where at least one call RETURNS a value:
```solidity
IUniswapV2Pair pair = IUniswapV2Pair(UniswapV2Library.pairFor(factory, input, output));
(uint reserve0, uint reserve1,) = pair.getReserves();   // returning VIEW
...
pair.swap(amount0Out, amount1Out, to, new bytes(0));    // void, MODIFIES the pair
```
This is the last wall blocking the real `UniswapV2Router02.sol` from compiling (the `_swap` DIRECT-call function and
the SINGLE-use local receiver both ship - see `array-external-calls.md` "Computed per-iteration targets"). Currently
fails closed: the single-use restriction (a per-function external-call RECEIVER-count snapshot) does not fire for a
multi-use local, so `pair` stays as the addressParam and codegen dies "Expected variable '__inl0_pair'/'path' does
not exist on the stack" (`GenerateTargetTraversal.getStackIndex`). Repro: `scratchpad/pathdesync4.mjs` R11.

**Why deferred (LARGE multi-feature, not a focused increment).** The two calls must share ONE co-spend of the pair's
single state UTXO - a UTXO cannot be spent twice, so two separate witnesses/co-spends is physically impossible (and
`getReserves` returns, so the void typed-loop dispatch cannot carry it anyway). Sound handling needs, together:
1. **One co-spend serving a READ + a WRITE.** `getReserves` reads the pair's PRE-swap reserves (the co-spent INPUT's
   commitment); `swap` constrains the OUTPUT (the pair's own swap covenant). A staticcall preserves input==output, a
   regular call modifies it - so `getReserves` cannot be a preserving staticcall on the same input `swap` mutates. It
   must be a NON-preserving read of the co-spent input, a dispatch mode `GenerateTargetTraversal` does not have.
2. **Returning view call in a loop, decoded from the co-spent input.** `getReserves` returns (reserve0, reserve1,
   blockTimestampLast). The value must come either from decoding the pair's state commitment (needs the pair's
   INTERNAL state layout, which the interface `function getReserves() returns (...)` does NOT expose - only a ported
   interface declaring `public uint112 reserve0` would) OR from a per-iteration return-event the pair mints (needs the
   pair covenant to support minting it under co-spend). Both are new machinery.
3. **Multi-use shared-witness rewrite (collect phase).** All calls on the local share ONE witness + ONE co-spend slot
   (the collect-phase piece is tractable in `SymbolTableTraversal`, but is dead code without 1+2).
`GenerateTargetTraversal` is also the parallel agent's most actively-churned file, so a large change there collides.

**What it'd take.** A new inline-loop dispatch mode in `emitInlineLoopExternalCall`: co-spend the witnessed pair once
per iteration, let a RETURNING call read the PRE-state (input commitment via the interface's declared public-state
layout, or a minted return-event) while a sibling VOID call constrains the output, plus the collect-phase shared-
witness grouping (all calls on one local -> one witness index). Multi-hour; soundness-critical (the read must be
pinned to the SAME co-spent input the write constrains). Prefer the return-EVENT route (reuses the opaque-loop
return-event machinery + a typed decode) over internal-layout decoding (which would need interface-declared reserves).

**RESOLVED 2026-07-20 (covenant VM-proven) - increments 1 AND 2 shipped via a simpler route than the analysis above.**
The "one co-spend serving a read + a write / decode reserves from the co-spent input's layout" framing (parts 1-2)
was SUPERSEDED by a VIEW-WITNESS reduction that sidesteps the layout problem entirely:
- **Increment 1 (returning computed loop, `ae3bf569` + GTT `33dcddb9`).** `emitInlineLoopExternalCall` typed-returning
  branch: a RETURNING call in a computed-target loop reads its per-iteration return-event + typed-decodes it.
- **Increment 2 (multi-use view+mutate reduction, `272802fe` + `0a66fc82` + `307aec59`).** A loop-body local used by
  a MUTATE (swap, void) + VIEW calls (getReserves, returning): `rewriteMultiUseViewCalls` replaces each VIEW call with
  a caller-provided per-iteration witness `__internal__viewReturn<n>[i]` (one array per return value - single AND
  tuple returns, so `(r0,r1,)=pair.getReserves()` -> viewReturn0/1/2), reducing the local to SINGLE-use (only swap),
  which the existing pair-local co-spend handles. NO co-spent-input decode, NO pair layout, NO GTT dispatch mode
  needed. SOUND by caller-permissive: a wrong view witness feeds wrong values into swap, whose co-spent covenant
  rejects (Router02 K-invariant) -> fail-closed, the same argument as extcall-target-pinning. Classification by
  hasReturnValues (void=mutate co-spend, returning=view witness); exactly-one-mutate. Covenant VM-proven in
  `MultiUseViewMutate.test.ts` (single + TUPLE getReserves shape: reads viewReturn0/1/2[i] + co-spends swap + selector;
  wrong selector rejected).

**ERGONOMIC FILL DONE for the stateless builder (`93bd9bcf`).** `buildTypedLoopCallTransaction` now fills each
`__internal__viewReturn<n>` from a caller-provided `viewReturns` (per-iteration values, one entry per return value)
+ `__internal__externalCallSelector` from a `selector` option, so the multi-use view+mutate is buildable via the
builder (not a fully manual TransactionBuilder) - VM-proven in `MultiUseViewMutate.test.ts` ("buildable via
buildTypedLoopCallTransaction", tuple getReserves shape).

**STATEFUL AUTODERIVATION FILL DONE (`3dea90ea`).** `StatefulContract._createBuilder` now AUTO-fills each
`__internal__viewReturn<n>` by reading each co-spent pair (the loopTargets slot's registered instances) via
getState() and taking its n-th state field (convention: the view returns the pair's first-N state fields;
Router02 getReserves() -> reserve0/reserve1/blockTimestampLast). So a stateful caller needs NO manual build and
NO caller-provided view values - fully idiomatic. VM-proven in `StatefulComputedLoopDispatch.test.ts` ("auto-fills
__internal__viewReturn0 ..."): two pairs with reserve 5 and 7, SDK fills [5,7], covenant accumulates total==12.
GOTCHA: the callee interface MUST declare its state (`public bigint reserve`) so the compiler computes the correct
co-spend STRIDE (the callee's data-NFT count) - an interface with only functions gives stride=1 and reads the wrong
input (same requirement as the array-external-call IEventSubscriber). Caller-permissive throughout (a wrong value
fails the mutate covenant). R11 is now END-TO-END idiomatic on both the stateless builder and the stateful
autoderivation. Residual: multiple mutates on one local still fail closed (physically two co-spends); tuple-return
views must be a destructure RHS; the first-N-state-fields convention is a best-guess (fails closed if wrong, a
per-interface annotation could refine it).

**Revisit if.** Router02 (or another fail-on-transfer / read-then-write pair pattern) becomes a target to COMPILE end
to end, AND `GenerateTargetTraversal` churn settles enough for a large sound change. The direct + single-use-local +
stateless/stateful autoderivation + RETURNING-loop (increment 1) units are all VM-proven foundations
(`TypedComputedLoopDispatch.test.ts` / `StatefulComputedLoopDispatch.test.ts`); the next sub-step is part 3
(collect-phase multi-use grouping) then part 1 (the shared read+write co-spend).

## C2-sorted mapping WRITE inside a delegate (proxy) function - DEFERRED 2026-07-20

**What.** `users[msg.sender] = v` (or any sorted-mapping write) inside a `delegate` function, called through
`upgrades.deployProxy`, fails closed when the mapping is C2-SORTED (the default). The NON-sorted case SHIPPED
(commit 78dc1b60): entry NFT minted in the proxy block at proxyMaster+offset, key/value/state trace-derived, and the
default proxy's mutable conservation relaxed `in==out` -> `out>=in` so the new (mutable) entry NFT can be minted.
Opt into the working path with `compileString(src, { sortedMappingsAll: false })`.

**Why deferred (C2 trailing-node output collision, not tractability).** A C2 sorted insert produces TWO outputs: the
block-slot `entry` (offset in the block layout) holds the rewritten PREDECESSOR P', and the NEW node rides a TRAILING
output at `masterInputIndex + blockSize`. The delegate mechanism (delegateEventSlots + effectiveBlockLayout + the
low-level-call master-index shift) reserves the block-slot entry only. For the proxy, `masterInputIndex(0) + blockSize`
lands right where the co-spent impl master already sits (op-decode of the failing probe: the covenant read
`output[3]` expecting the entry-covenant p2sh32 but found the impl master's p2sh32). So the trailing NEW node collides
with the impl master; the SDK never reserves/derives it and the impl covenant's entry check fails closed.

**What it'd take (bounded attempt 2026-07-20 pinned the exact core blocker; reverted).** Two coupled pieces, both in
the STB input/output ASSEMBLY:
1. The NEW-node OUTPUT (a loopEntry mint) is never created for the delegate. Off-chain SortedList.planInsert pins the
   NEW node only when the value is resolvable; here `v` is in the forward CALLDATA (not `args`, and abiFunction is
   __forward not the impl), so `newNode` comes back undefined and `setLoopEntryCommitments` is skipped -> no trailing
   output. Reserving an extra proxy-block 'entry' slot (delegateEventSlots) only reserves a funder INPUT; the mint
   OUTPUT still isn't emitted (the entry-output loop mints from entryNfts/loopEntryVars, not from a bare block slot).
2. Even if minted, the loopEntry must land at proxyMaster+implBlockSize = right AFTER the proxy block and BEFORE the
   impl. But the STB input/output order (_buildInputs ~425) appends lowLevelCall inputs FIRST, then iterationEntry
   inputs - so a normal loopEntry sits AFTER the impl, colliding. The delegate path must special-case the ordering:
   loopEntry NEW-node before the lowLevelCall region, and getLowLevelCallMasterInputIndex/delegatePos must count it.
So it needs: a DERIVED sorted-insert path (placeholder NEW node whose value the Phase-2 probe fills, like the non-C2
entry does) + the loopEntry mint emitted BEFORE the impl + the index accounting. The msg.sender-key, proxy-conservation
(`out>=in`), P'-at-block-slot, and value-derivation pieces are already solved (non-sorted proves them).

FULL 7-LAYER RECIPE (from 4 careful attempts, all reverted). The NEW-node output is a loopEntry mint: a single sorted
insert already sets `abiFunction.entryLoopWrites=["users"]`, which drives `loopEntryVars` (StatefulContract ~7523) ->
the mint output (STB ~1813) whose commitment the Phase-2 loop seeds ('00' placeholder) + derives. Layers: (1) route
the impl fn's entryAccesses [DONE, in HEAD]; (2) route the impl fn's `entryLoopWrites` into that loopEntryVars filter
(like entryAccessesForDerive) so loopEntryVars={users}; (3) **build-consistency**: `upgrades.deployProxy`'s forward
flow calls _createBuilder MULTIPLE times and `overrides.calls` is populated INCONSISTENTLY across them - routing fired
in one build (loopEntryVars=["users"]) but not another (callsN=1 yet the impl fn didn't resolve) - so the routing must
key off a stable source (the lowLevelCallUtxoGroups, not overrides.calls) or the derivation build sees loopEntryVars=[]
and never seeds; (4) loopEntry seed+derive (the Phase-2 loop already does this once loopEntryVars is stably set); (5)
REORDER the loopEntry input (iterationEntryInputs, STB _buildInputs ~425) AND output (STB ~1813) to sit BEFORE the
lowLevelCall region for the delegate (gated - non-delegate order unchanged), so NEW lands at proxyMaster+blockSize; (6)
FUNDER ALIGNMENT: give the NEW node a funder INPUT at its output index so impl-master input==output stays aligned (else
emitDelegateSelfPreservation needs an output shift); (7) index accounting: getLowLevelCallMasterInputIndex/delegatePos
+ getLoopEntryOutputBase must count the NEW node so the impl shifts and the covenant's masterIndex+blockSize resolves.
This shares the trailing-NEW-node + derived-value + reorder machinery with the user's ACTIVE cross-contract C2 WIP
(externalCallEntryInserts) - extend that to the delegatecall path rather than duplicating. Self-contained test: a
MapImpl with a default sorted mapping through deployProxy (the EA .scash contracts are still stubs).

**Revisit if.** A port needs a DEFAULT (C2-sorted) mapping written from inside a delegate - the EA `registerUser`
admin pattern (`users[msg.sender] = User(...)`), or any OZ-style upgradeable contract whose initializer/methods write
a mapping. Detail + re-entry points in memory events_in_delegate_gap.md.

---

## buffered state journal + cross-contract message bus (architecture research)  - 2026-07-20

**What.** A future architecture that would make state/covenant-touching functions into real
`OP_INVOKE` subroutines (fixing recursive state-writers and generic loop-calls of state helpers) via
an altstack write-back journal flushed at the entry point, plus a cross-contract message bus (single
settlement authority per slot) for shared-slot composition. Full design + VM evidence + boundaries in
`docs/buffered-state-and-message-bus-research.md`.

**Why deferred.** Explicitly a FUTURE direction, not scheduled. Large, multi-phase, and P3 (the bus)
carries C2-comparable soundness weight. The common case (pure-function recursion/loops) already works;
the near-term pain is covered by the existing bespoke C2 / entry-write-in-loop paths.

**What it'd take.** P1 scalar journal (fixes the recursive state-writer compile-fail), P2 mapping/
collection writes buffered with flush delegating to existing C2, P3 the message bus. See the doc.

**Revisit if.** Recursive/looping state helpers or generic cross-contract shared-slot writes become a
recurring blocker that the per-pattern codegen can no longer absorb. Detail in memory
internal_fn_recursion_state_buffer.md.

---

## ecrecover "width-0" signatures - 3-covenant split (recovery liveness gap ~2%)  - 2026-07-20

**What.** ~2.3% of secp256k1 signatures have a GLV ladder so long (high-Hamming-weight scalar
decomposition) that NO split of the 2-covenant (A+B) recovery side-car pair fits both covenants'
~8M op-budgets - the viable-split window closes to zero and `probeEcrecoverSplit` throws (fail-closed
with a clear "re-sign" error). Each covenant's budget is capped at ~8M by the 10,000-byte scriptSig
consensus limit, covering only ~60-70 of the ~127 ladder steps, so 2 covenants barely cover the whole
ladder (window width ~1-7, occasionally 0).

**Why deferred.** Soundness is unaffected (a width-0 sig can never yield a WRONG key - it just cannot
be spent); only liveness for those rare sigs. The practical mitigation is cheap: re-sign to get a
different, shorter decomposition (ECDSA k varies), which the SDK does automatically for loops/multi-sig
via the same probe (`goodRecovery`-style skip). Fixing it properly is a large covenant change.

**What it'd take.** A 3-covenant split (A verifies the GLV table + ladders to C1, a NEW middle covenant
M ladders C1->C2 and commits C2, B ladders C2->Q): each does ~L/3 steps => ~5.3M op-cost with huge
budget margin => the window never closes. Needs a new "middle" covenant generator in `ecrecover-poc/`,
regeneration + soundness re-verification, a 3rd baked shared lock, and stride-4 loop indexing (A,M,B,+K
for evm). Triples... (well, +50%s) the side-car count per recovery, which also pushes harder on the
100KB standard tx-size wall.

**Revisit if.** The ~2% fail-closed rate becomes a real user complaint, OR a use case needs to recover
FIXED historical signatures (where re-signing is impossible) in bulk. Detail in memory
ecrecover_builtin.md (2026-07-20b section).

---

## ecrecover loop tx-size wall - covenant dedup via introspection + OP_DEFINE (candidate)  - 2026-07-20

**What (user idea).** A dynamic ecrecover loop is bounded by the 100KB STANDARD tx size (~4-5 recoveries),
because each recovery co-spends an A+B pair whose scriptSigs each embed a full copy of the
signature-INDEPENDENT covenant (~7.4KB A / ~3.3KB B) in the P2SH redeem. Since every pair runs the SAME
covenant code, the first A+B pair could carry it as-is, and each CONSECUTIVE recovery input could be a thin
"reference" input that loads the first pair's covenant via introspection (`OP_UTXOBYTECODE`/
`OP_INPUTBYTECODE` of the first pair's input) and `OP_DEFINE`s it as a subroutine to `OP_INVOKE` with its
own signature's witnesses - instead of re-embedding the 7.4KB/3.3KB covenant. Goal: shrink each extra
recovery's tx-size footprint => more recoveries per standard tx.

**Why deferred / open question.** The blocker is the op-budget floor, not the code. Each input's budget =
`(41 + scriptSigLen) * 800`, capped at ~8M by the 10,000-byte scriptSig limit, and each covenant runs ~half
the ~127-step ladder = ~7.9M op-cost => it NEEDS a ~9.9KB scriptSig regardless of whether those bytes are
covenant or budget-pad. So dropping the covenant from a reference input's redeem just refills the space with
pad (and the `OP_UTXOBYTECODE` load itself adds a little op-cost) => net-neutral, possibly net-negative, on
tx size as things stand. The idea only wins if the per-input budget can be met WITHOUT ~10KB of scriptSig -
e.g., a future VM/CHIP that decouples code size from the op-budget, a budget-pooling/shared-funding trick
across the reference inputs, or a cheaper ladder that needs << 8M per input (which would also relax the
width-0 limit). The covenant bytes are currently load-bearing as budget funding, which is what makes them
"free" to carry and hard to dedup for a size win.

**What it'd take.** A reference-input covenant variant (tiny redeem: load first-pair code, `OP_DEFINE`,
bind its own argBlob, `OP_INVOKE`, self-preserve) + a way to fund its ~8M budget without a ~10KB pad. Prove
the size win is real (measure reference-input scriptSig vs a full pair) BEFORE building - the budget floor
must be beaten first, else it is net-zero.

**Revisit if.** The op-budget model changes to not scale with scriptSig length, OR a budget-sharing
mechanism lands - then covenant dedup turns the ~20KB/recovery footprint into ~10KB + small, multiplying the
per-tx recovery count. Related: the tx-size wall noted in docs/ecrecover.md (Loops) and the width-0 3-covenant
deferral above (a cheaper ladder would help both).

## Storage-STRUCT-pointer library fn called with a MAPPING-ACCESS arg (`L.f(m[k])` / `m[k].f()`)
- **What:** A `void` storage-pointer lib fn on a struct (`function addElastic(Total storage t, uint x){ t.elastic += x; }`)
  works with a bare state-var arg (`L.f(st)` / `st.f()`) but FAILS with a mapping-element arg (`L.f(m[k])` -> "s undefined";
  `m[k].f()` -> "Method calls only supported"). BoringRebase/BentoBox/Kashi (`totals[token].addElastic(fee)`).
- **Why:** `InlineStoragePointerCalls.inlineCall` aliases a bare-var storage arg by NAME (`applyRename` rewrites the
  flattened/dotted forms `s.x`,`s__x` -> `st.x`,`st__x`), but a mapping-access arg goes through `subs`/
  `substituteInFunction`, and `substituteInExpression` returns `StateAccessNode` UNCHANGED
  (InheritanceExpansionTransformation.ts:1005). A storage-struct param flattens to StateAccess/StateAssign nodes with a
  STRING name (`s.x`); turning `s.x = v` (StateAssignNode) into `m[k].x = v` (MappingFieldAssignNode) is a NODE-TYPE
  change that name/expression substitution cannot do.
- **What it'd take:** inline the storage-struct param as a storage-ALIAS (`Total storage __sp = m[k]; rename s->__sp`) +
  a POST-INLINE struct-storage-alias pass rewriting `__sp.f = v` -> `m[k].f = v` (the AstBuilder's same-file
  storageAliases runs PRE-inline and misses inline-introduced aliases; RedesugarImportedStructFieldWrites is
  imported-only). Must reuse the EXISTING nested-lvalue mapping-element-field writer to stay byte-sound - a hand-rolled
  key/offset encode risks a silent miscompile.
- **Revisit if:** BentoBox/Kashi/BoringRebase port is prioritized, OR the corpus shows `L.f(m[k])` storage-ptr frequency.
  NOTE overlaps the C2/storage machinery under active churn - coordinate before landing.

## STORAGE-POINTER library fn on a mapping/array/state-var element - VEIN COMPLETE 2026-07-21
- **STATUS: SHIPPED + VM-proven end to end** across four commits (5f2b28f3 void, e5ab012c returning, a4727002 bare):
  void + returning fn, mapping/array/state-var element, statement + expression position, direct + using-for spelling,
  `this.`-prefixed + BARE (no this., real-Solidity) spelling. All routed through a shared `elementAccess()` helper
  (read-modify-write the element; a bare `m[k]` = ArrayAccess-on-mapping-identifier is rebuilt to a MappingAccess so it
  resolves via the collection). Regression-clean (solidc 2221, e2e 148). Advanced BentoBoxV1 through the addElastic
  walls (330, 985) to line 835.
- **NEW BentoBoxV1 wall (line 835, SEPARATE vein):** `_tokenBalanceOf(token).sub(total.elastic)` fails "Found
  parameters (address) in call to '_tokenBalanceOf' where (address,bytes,bigint,bytes4,bigint) were expected" - an
  overload/name-resolution confusion (the 5-arg signature is not `_tokenBalanceOf`'s; it looks like a low-level-call
  helper's). Does NOT reproduce in isolation (a returning ext-call helper + BoringMath `.sub()` compiles) - BentoBox-
  specific. NOT storage-pointer. Investigate on-site if BentoBox is prioritized.
- Original returning-fn analysis kept below for the record.

## (superseded) RETURNING storage-pointer fn (BentoBox BoringRebase `addElastic`) - DONE 2026-07-21 (commit e5ab012c)
- **STATUS: SHIPPED + VM-proven** (StoragePointerReturningFn.test.ts). The RMW fix landed IN
  InlineReturningStateHelpers.inlineCall (as the "What it'd take" below predicted), reusing that pass's hoisting
  machinery so it covers BOTH statement and expression position; gated on the body WRITING the pointer so read-only
  get/size helpers are unchanged. (The 985 wall it advanced to was then cleared by the bare-access fix a4727002.)
- **What:** A struct-storage-pointer fn that RETURNS a value (`function addElastic(Rebase storage t, uint e)
  returns(uint newElastic){ t.elastic += e; newElastic = t.elastic; }`) fails "Undefined reference to symbol <param>"
  whether called in STATEMENT position (`totals[k].addElastic(x);` - return discarded, BentoBoxV1:1064,1068) or
  EXPRESSION position (`require(bal >= totals[k].addElastic(fee))` - return used, BentoBoxV1:985,1020). General - same
  failure for a CONTRACT-internal returning storage-pointer fn, not library-specific.
- **Why (CONFIRMED via pass bisect 2026-07-21):** The culprit is `InlineReturningStateHelpers.eligibleStructPtr`
  (InlineReturningStateHelpers.ts:445, runs at compiler.ts BEFORE InlineStoragePointerCalls). NamedReturnTransformation
  first rewrites the named return into an explicit tail `return newElastic;`, which makes the fn match eligibleStructPtr
  (single-tail-return + struct-storage-pointer param). That predicate was written for READ helpers (`get`/`size` on a
  `Map storage`) - it expression-inlines the fn by substituting the storage param READ-style, but this fn WRITES
  `t.elastic`, and the read-oriented substitution leaves the write's `t` dangling -> "Undefined reference to symbol t"
  at codegen. So a returning struct-storage-pointer WRITE-helper is grabbed by the wrong inliner. (The void
  InlineStoragePointerCalls path at :137 requires `returnTypes.length === 0`, so it never sees it.)
- **What it'd take (now that the culprit is known):** The cleanest fix is IN `InlineReturningStateHelpers`, reusing
  its existing expression-inline HOISTING machinery (it already replaces a call with a temp + prelude statements -
  exactly what expression-position BentoBox `require(.. >= totals[k].addElastic(fee))` needs). Make `eligibleStructPtr`
  (or its inline substitution) do the element READ-MODIFY-WRITE for a WRITE-helper: `S __t = m[k]; <body with param->__t>;
  m[k] = __t; <temp> = <returned expr>;` and hoist `<temp>` in place of the call. This covers BOTH statement and
  expression position uniformly. RISK: eligibleStructPtr currently serves read-only get/size helpers - must not
  regress them (gate the RMW write-back on the body actually WRITING the pointer, mirroring
  InlineStoragePointerCalls.isWritten). Alternative (statement-only, narrower): EXCLUDE write-helpers from
  eligibleStructPtr so they fall through to InlineStoragePointerCalls, and extend THAT pass to returning fns in
  statement position - but that leaves expression position (985/1020) still broken, so the in-place fix is preferred.
- **Also blocks BentoBoxV1 even if fixed:** BoringMath uint128 `.add/.sub` (using-for on uint128), chained assign
  `newElastic = total.elastic = total.elastic.add(x)`, reassignable storage-pointer local `Rebase storage total =
  totals[token]`. BentoBoxV1 is a MULTI-wall grind, not one fix.
- **Revisit if:** BentoBox/Kashi is prioritized; the void case (commit 5f2b28f3) already unblocked BentoBoxV1 PAST all
  void storage-pointer walls to exactly this returning-fn wall (line 330).

## Kashi (KashiPairMediumRiskV1 / KashiPair) - walls after the abi.decode fix (bbb10174)
The abi.decode-interface fix advanced both Kashi contracts past their first wall. Remaining:
- **KashiPairMediumRiskV1: overloaded RebaseLibrary.add - DONE 2026-07-21 (commit efc4cd86).** Two 3-arg `add`
  overloads (bool-3rd -> 2-return, uint-3rd -> 1-return). Root cause of the inline: they're marked by
  InlineReturningStateHelpers.containsExternalCall OVER-APPROXIMATING - `total.elastic.add(..)` is a BoringMath
  using-for MethodCall (undesugared at that pass) that line 257 treats as an external call, so the pure memory-struct
  `add` gets force-inlined. Fixed by DISAMBIGUATING the ambiguous inline by RETURN ARITY (expression -> 1-return,
  tuple -> K-return; resolved up front via overloadsByKey + pickOverloadByReturnArity). VM-proven
  (OverloadedInlineDisambig.test.ts). Advanced KashiPairMediumRiskV1 to the NEXT wall:
- **KashiPairMediumRiskV1: `_isSolvent` external-call param bloat** - "Found (address,bool,uint256) in call to
  '_isSolvent' where (address,bool,uint256,bigint,bytes4,bigint) were expected" - the SAME deep recursive/external-call
  covenant-param-threading wall as SushiMaker `_convertStep` (an internal external-call fn's signature bloats with
  synthetic params the call site can't supply). DEEP - see the SushiMaker entry in mistswap_bench memory.
  NOTE a cleaner future fix for the ROOT would desugar value-type using-for method calls (`x.add(y)` on int) to
  `BoringMath.add(x, y)` BEFORE InlineReturningStateHelpers, so containsExternalCall stops mis-classifying them
  (RedesugarImportedUsingForCalls handles struct/interface/bare-ident receivers but not value-typed field receivers).
- **KashiPair (kashi-lending repo): import resolution** - "Cannot resolve import
  '@boringcrypto/boring-solidity/contracts/libraries/Bo...'" - a missing dependency path in that repo's layout, a
  HARNESS/dependency issue, not a compiler wall.

## Reuse an entry-read local for a struct-mapping field write-back (IMPLEMENTED then REVERTED 2026-07-21)
The read-modify-writeback idiom `S e = m[k]; ..modify e..; m[k].f1 = e.f1; m[k].f2 = e.f2;` (Unicrow `refund`) is
folded by CoalesceMappingEntryFieldWrites into one whole-struct write, but that RE-READS the entry to source the
untouched fields - redundant, because `e` already holds them. Reusing `e` (`m[k] = S(e.f0, .., e.f1, .., 1, ..)`)
elides the re-read.
- **What it'd take:** a data-flow pass `ReuseEntryLocalForWriteback` (was fully written + VM-tested, green: solidc
  suite clean, 104 struct e2e, 5 behavioral/oracle tests) placed BEFORE RedesugarImportedStructFieldWrites (so an
  imported struct's `e.f=v` is still a MappingFieldAssign; a same-file struct's is a `e = S(..)` field-preserving
  rebuild) and before CoalesceMappingEntryFieldWrites (pre-empting it for the folded run). Sound iff, by a
  conservative straight-line analysis between the read and the run: `modified(e) is subset of written(run)` (so
  untouched fields still equal storage), no write to `m[k]`, `e` does not escape into a call (pass-by-ref), no
  wholesale reassign/redeclare of `e`, no intervening control flow. Only folds runs of >= 2 (a single field
  write-back is a cheaper splice than a whole-struct write); keeps the CoalesceMappingEntryFieldWrites value gates.
- **Why deferred:** the win is small and narrow - Unicrow `refund` 5683 -> 5344 (-339 B; only `refund` has the idiom,
  challenge/settle write params directly, release's single write is left alone). That is the LARGEST soundness
  surface of the three coalescing passes for the SMALLEST win vs Pass 1 (-4030 B) / Pass 2 (-4397 B). The pass fails
  closed (bails to unoptimized), so the realistic failure mode is missed-optimization, not miscompile - but the
  complexity/risk was judged not worth 339 B. Pass 1/2 (commit a0849d3e) are the clean stopping point.
- **Revisit if:** per-contract byte size becomes a hard deploy constraint, or the read-modify-writeback idiom shows up
  broadly (a struct with many untouched fields reused elsewhere saves more - est. ~800 B for a 13-field struct).

## Multi-return STATE helper inline (Kashi `_isSolvent`) - BLOCKED by a pre-existing inline miscompile
- **What:** A returning STATE/entry-reading helper with EARLY RETURNS (`function _ok(a,m) view returns (bool) { int b
  = bal[a]; if (b==0) return false; if (b<m) return false; return b>=m*2; }`, Kashi `_isSolvent` shape) fails "Block
  layout not available" - it can neither be an OP_INVOKE subroutine (entry access needs the caller's block layout) nor
  inline (InlineReturningStateHelpers.eligibleShape requires a SINGLE tail return; a mid-body return can't linearize).
  Very common Solidity pattern.
- **Attempted fix (2026-07-21, REVERTED):** single-exit conversion - nest the early returns (reuse
  EarlyReturnTransformation.transformStatements), assign each `return x` to a result temp, end with one `return __se`.
  It COMPILES but produces WRONG runtime results, because of ->
- **ROOT BLOCKER (pre-existing, NOT the conversion): inlining a returning state helper whose result comes from
  CONDITIONAL logic miscompiles.** VM-isolated both encodings fail when INLINED but pass as a SUBROUTINE (pure) and
  pass as a DIRECT expression:
    - `bool r; if (c) { r=x; } else { r=y; } return r;`  (branch-local write)  -> inlined: wrong
    - `return c ? x : y;`  (even a SINGLE ternary over state)                   -> inlined: wrong
    - `require((bal[u] < m) ? false : true)`  DIRECT (no helper)                -> CORRECT
  So InlineReturningStateHelpers' expression-hoist inline mishandles a helper body ending in `return <ternary>` (or a
  branch that writes the returned local): the hoisted `__ret = <conditional>` evaluates incorrectly. POTENTIAL SILENT
  MISCOMPILE for any existing contract with such an inlined helper - worth a focused audit. Fixing it (inline codegen
  for control-flow-returning state helpers) is the prerequisite for the single-exit multi-return feature AND removes
  the miscompile. Repro scripts in scratchpad (multiret / _scope / _tern / _confirm shapes).
- **Revisit if:** the inline miscompile is fixed (then re-land single-exit); or a corpus audit surfaces the silent
  miscompile in real code.

### Refinement (2026-07-21, further VM-isolated) - the inline miscompile is BOUNDED to the inline machinery
The `return <ternary>` inline miscompile above is NOT any of: `this.`-prefixed call (a bare internal call fails the
same), a name collision (distinct callee/caller param names fail the same), or a ternary-as-var-initializer (the
DIRECT `int b = bal[u]; bool r = (b<m)?false:true; require(r)` is CORRECT). So the inline machinery
(InlineReturningStateHelpers.inlineCall: `retDef = new VariableDefinitionNode(returnType, [], retName,
ret.expressions[0])` for a ternary return expr, hoisted) emits DIFFERENT bytecode from the equivalent direct form
(~6-byte divergence near the OP_LESSTHAN/OP_IF of the ternary) and it evaluates wrong. A future fix should diff the
inline vs direct ASM at that point - the direct form is the correct reference. This is the sole blocker for the
single-exit multi-return feature.

### CORRECTED root cause (2026-07-21, exhaustive debugging pass) - it's a COPY-LOCAL-KEY sorted-mapping read, NOT the inline
The "return-ternary inline miscompile" above was MISDIAGNOSED. The real bug: reading a SORTED (C2) mapping with a key
that is a single-assign LOCAL COPY of a param (`address aa = u; b = m[aa]`) miscompiles - and the multi-return inline
just PRODUCES that shape (it value-copies params into locals, `__rh0_a = user`). Isolated with direct source (no inline):
`aa = u; m[aa]` fails, `m[u]` (param key) works; not ternary/this./name-collision specific (all ruled out via VM tests).
- **Where:** GenerateTargetTraversal.emitSortedKeyHash (~:10367). A key classified as a PARAM emits `OP_PICK
  getStackIndex(param)` (copies it, keeps it). A local/expression key takes the ELSE branch `this.visit(node.keys[i])`
  - VM-instrumented: for the copy-local `aa`, that visit emits NOTHING (stackBefore==stackAfter, top is the WRONG var),
  so the following `OP_SHA256` hashes the wrong stack value -> wrong slot32 -> wrong entry/value. The DUP the param path
  emits (`OP_CHECKSIGVERIFY OP_DUP OP_SHA256`) is simply absent (`... OP_SHA256`).
- **Why the local isn't visitable there:** the entry-read runs in a stack context set up by the block layout; the
  function's locals/params are reached via the keySource METADATA (keyParams), and the copy `aa = u` CONSUMES `u`
  (last-use ROLL) when `u`'s only use is the copy, so neither `aa` nor `u` is on the stack at the read.
- **Attempted fix (REVERTED):** classify a single-assign param-copy local key AS the param (so codegen takes the PICK
  path). It FIXES the case where the param is otherwise live (VM-verified) but (a) REGRESSES SafeERC20.forceApprove +
  modifier_double_invocation - the expression/canonical path correctly SDK-derives those keys, and a broad reclassify
  breaks them - and (b) fail-closes ("variable does not exist") when the param is dead after the copy. Not shippable.
- **The real fix** is deeper: the entry-read's key liveness must count the metadata-based key use so the param stays on
  the stack until the read (or copy-propagate the key to the param AND keep it live). A C2-codegen/liveness change.
- **Revisit if:** the multi-return-inline (single-exit) feature is prioritized (it depends on this), or a corpus audit
  finds `local = param; sortedMapping[local]` in real code (the silent-miscompile trigger).

### DEEPER root cause + 3 failed fix attempts (2026-07-21 cont.) - entry-read tracker/stack inconsistency
Narrowed further: the copy-local-key read ONLY miscompiles when the key local is DEAD-after-read (consumed as its
last use). When the key local is LIVE (used elsewhere), the read is CORRECT on baseline. So the trigger is the
entry-read visiting a LAST-USE key local. Three fixes attempted, all reverted:
1. **Reclassify a single-assign param-copy key AS the param** (SymbolTableTraversal.classifyKeySource): fixes the
   live-param case (VM-verified) but REGRESSES CorpusGapFixes SafeERC20.forceApprove + compiler modifier_double_
   invocation (their expression/canonical keys SDK-derive correctly; a broad reclassify breaks them), and still
   fail-closes when the param is dead. Not shippable.
2. **Rewrite the key node `m[aa]` -> `m[u]`** in place: no effect - the entry-read uses the keySource METADATA
   (keyParams), not the AST key node, so rewriting the node doesn't register a use of `u` and it's still consumed.
3. **Force COPY not CONSUME for the entry-read key** (suppressOpRoll flag around visitIdentifier's ROLL at
   GenerateTargetTraversal:~7283): COMPILES but breaks VM (the read hashes the wrong value). Root reason revealed:
   `getStackIndex(keyLocal)` in the entry-read returns a STALE index - the probe showed the ROLL moved `min` (the
   wrong var) to the top, not `aa`. The entry-read's tracker view of the function-local stack positions is
   inconsistent, and forcing PICK also leaves an extra untracked item that corrupts the fixed working-stack layout.
- **TRUE root cause:** the sorted entry-read (emitSortedSetRead/emitSortedKeyHash) evaluates the key against a
  tracker whose local-variable positions are STALE relative to the real stack. A PARAM key works because params sit
  at a stable base offset; a local key's tracked offset is wrong there. The DUP the param path emits (`OP_DUP
  OP_SHA256`) reflects a correct offset; the local path emits nothing/rolls the wrong item.
- **The real fix** needs the entry-read to use a CORRECT stack offset for a local key (reconcile the tracker), or to
  capture the key value into the entry-read working area BEFORE the layout is set up. A focused C2-codegen change.
