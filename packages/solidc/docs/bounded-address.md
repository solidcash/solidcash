# Bounded-address storage model (spec / design)

Status: **DESIGN SPEC - RE-EVALUATED 2026-07-20: NOT recommended on current evidence (Section 10).** After the
Section-9 test audit surfaced address's existing four-representation mess and the conformance tension, the trade
tilts against switching: the one benefit (address slot fields) is niche + conformance-breaking + BCH-only-consistent,
and the status quo is fine for storage/packing/mappings. Kept as a complete design + audit to revisit only if
faithful OZ ERC-1967-proxy-via-raw-address-slots becomes a priority. This doc specifies rescoping solidcash's
`address` from a
variable-width framed value (today: `isChunkPackableElementType` -> framed like `bytes`, GTT emits `'rawbytes'`) to
a BOUNDED fixed-width value for STORAGE, so an address becomes a fixed-width slot field and packs deterministically
into the 128-byte NFT commitment. Motivated by the storage-slot grind (see `bounded-address` follow-on to
[evm-storage-parity.md](evm-storage-parity.md) and the yul slot-field work): address was the one slot-field type
left out, wrongly as "fundamental (overflows the 32-byte slot)". It is not - a >32-byte value spills (composites) or
chunks (dynamic values); address is simply variable-width, and if we bound it it becomes a clean fixed 2-word field.

## 1. The ceiling: 35 bytes for standard BCH addresses

A BCH "address" is the output locking bytecode. The standard, hash-based forms have FIXED, known lengths:

| form | locking bytecode | length |
|---|---|---|
| p2pkh (EOA) | `76 a9 14 <20> 88 ac` | 25 |
| p2sh20 (legacy contract) | `a9 14 <20> 87` | 23 |
| p2sh32 (contract) | `aa 20 <32> 87` | **35** |

**35 is the ceiling** for the address types solidcash targets (EOAs + p2sh contracts). Excluded by design (the
"no p2s" constraint): bare/custom scripts (p2s, arbitrary length) and p2pk-uncompressed (67B). The ceiling is a
DESIGN CONSTRAINT that MUST be ENFORCED (Section 6), not assumed - BCH permits locking to any script.

"Address length is known at compile time" holds for the ALLOCATION, not the content: a runtime `address` holds an
EOA (25) or a contract (35), so the exact length is runtime, but the ceiling (35) is compile-time-fixed, which is
what lets us treat it as fixed-width. The exact length is recovered from the value (self-describing lbc prefix, or an
explicit length byte - Section 3).

## 2. Two representations - keep them separate

The rescope introduces a fixed-width STORAGE form alongside the existing runtime value. They must stay distinct:

- **Runtime value = the actual locking bytecode (lbc), variable 23/25/35 bytes.** External calls, `payable`
  sends, foreign function pointers (address = call target), `.code`/`.codehash` all consume the REAL script. The
  runtime representation does NOT change - this contains the blast radius (address is referenced in ~30 files:
  external-call/fn-ptr passes, ABI, SDK).
- **Storage form = a fixed frame (Section 3), <= 36 bytes.** Used only at the storage boundary (state vars,
  commitment packing, slot fields) and for the mapping-key preimage (Section 5). `store` pads/frames; `load` strips
  back to the exact canonical lbc.

This is the load-bearing decision: **rescope the storage boundary, not the type everywhere.**

**The ABI wire form is a THIRD, separate representation - and today it is NOT the `address` type at all.** Solidity
ABI-encodes `address` as `uint160`: a 20-byte value RIGHT-aligned (low bytes) in a 32-byte word, high 12 bytes
zero-padded - number-like, the *opposite* of `bytesN` (which is left-aligned / right-padded). Verified against three
references: (1) `../solidity` `abi-spec.rst:58,215` ("address: as in the uint160 case"); (2) `../solidity`
`YulUtilFunctions.cpp:3974` cleans an address as `cleanupFunction(IntegerType(160))` - masked to the low 160 bits
(20B), dropping dirty high bits; (3) `../ethers.js` `AddressCoder` encodes via `getAddress(value)` (EIP-55
checksum-validate, THROWS on invalid) then `writeValue` = a numeric LEFT-pad to 32 (`abstract-coder.ts:436`; bytes
right-pad at `:426`), and decodes `getAddress(toBeHex(readValue(), 20))` = the low 20 bytes. So encode CLEANS (solc)
or VALIDATES (ethers) to a canonical 20-byte value, right-aligned. In solidcash this EVM-address ABI form is modeled and
tested via `uint160` (a plain number), NOT via `AddressType`: `emitEvmAbiWord` has ZERO `AddressType` branch and
THROWS on it (Phase-1 value types only); the abi-conformance suite uses `uint160 ADDR = 0x00112233..` for every
transfer/permit/balanceOf case (`abi.conformance.test.ts`), proving byte-exact EVM parity through `uint160`.

So there are three genuinely different things, and they must not be conflated:
- **EVM address = `uint160`** - a 20-byte hash as a NUMBER; the ABI/EVM-parity form (conformance-tested). This is
  NOT a BCH locking bytecode.
- **BCH address = `AddressType`** - the variable-length lbc (25/35B); the runtime value. Not evmCompat-ABI-encodable
  today (throws).
- **Bounded storage frame** (this spec) - a fixed <=36B storage representation of the `AddressType` lbc.

They are not three encodings of ONE value: an EVM 20-byte address does not map cleanly to a BCH lbc (a 20-byte hash
is p2pkh-vs-p2sh20 ambiguous, and a p2sh32 needs a 32-byte hash that will not fit 20 bytes). The conformance suite
sidesteps this precisely by keeping EVM addresses as `uint160` numbers and only ever using the `AddressType` in the
slot-LAYOUT test (`address a; uint96 b` pack into one slot, via `.slot` - a compile-time number, never an
encoded runtime value). The bounded frame is a storage representation of the BCH lbc, never the ABI wire form.

OPEN: should `AddressType` become evmCompat-ABI-encodable, and if so as what - the 20-byte hash extracted from the
lbc (lossy for p2sh32), or the framed lbc? Today the answer is "use `uint160` for EVM-address ABI", which keeps the
bounded work orthogonal to ABI.

## 3. Storage encoding: length-prefixed frame (recommended)

Two candidate encodings for the fixed frame:

- **(A) self-describing, zero-padded to 35.** Tightest (35B, 2 slots). Recover length by parsing the lbc prefix
  (`0x76a914`->25, `0xa914`->23, `0xaa20`->35). Requires exact prefix-parsing on every load.
- **(B) 1-byte length prefix ++ lbc, fixed 36 bytes (RECOMMENDED).** `len(1) ++ lbc(<=35) ++ zero-pad`. Still 2
  slots (36 <= 64). Explicit length => `load` strips to EXACTLY `blob[1 : 1+len]` with no prefix-parsing, and a
  >35 length is rejected at `store` (Section 6). One byte of overhead buys an unambiguous, exact round-trip.

**Recommendation: (B).** The exact round-trip guarantee is what keeps address-keyed mappings sound (Section 5): an
address used as a key must hash identically whether it is fresh or loaded from storage, which requires
`load(store(a))` to reproduce the byte-exact canonical lbc. (B) guarantees that structurally; (A) relies on the
prefix parser being correct for every address form.

Canonicality requirement (both encodings): the pad bytes MUST be deterministic (zero-fill). A non-deterministic
pad would make the same address store to different blobs -> different key slots -> a broken mapping.

## 4. Slot fields (Phase 2, depends on composite sub-slot access)

A fixed-36 address is a 2-word value: it occupies slots `[p, p+1]` (head + flow, exactly like a `struct{uint;uint}`
or `bytes32[2]` - see the composite layout in the yul slot work). Once it is fixed-width, `sstore(addr.slot, w0)` /
`sstore(addr.slot+1, w1)` and the matching loads are just the 2-slot composite read/write.

This RIDES the composite sub-slot field access feature, which is currently fail-closed (`sload(structSlot+i)` does
not yet map to field i). So: rescoping address to fixed-width is a PREREQUISITE for sound address slot access, but
not sufficient alone - it needs composite sub-slot field access too. Until that lands, address slot access stays
fail-closed (sound). `stateVarByteWidth` for address would change from 20 (EVM slot-LAYOUT parity, single slot) to 2
whole slots - a deliberate divergence from EVM (EVM address = 20B, 1 slot, packs); acceptable because BCH addresses
already diverge from EVM 20-byte addresses in both value and width, so no EVM-exact address-slot behavior was ever
achievable.

## 5. Address-keyed mappings - soundness

`mapping(address => V)`. C2 model: `slot = sha256(key)` high-bit-masked (type-agnostic over the key bytes;
`keyToSlot`), sorted-linked-list entries give exclusion proofs for `require(m[a] == 0)`. Nested keys:
`sha256(sha256(a) ++ sha256(b) ++ ..)` masked. The rescope interacts with this in exactly one place - the KEY
PREIMAGE - and the soundness rests on making it canonical:

1. **The key preimage is the canonical lbc, hashed as-is: `slot = sha256(lbc(addr))` masked.** NOT the padded frame.
   Rationale: the lbc is the address's unique identity; it is what is on the covenant stack; and it keeps address
   keys consistent with the existing type-agnostic `sha256(value)` model (address keys already work in C2 this way).
   The Section-3 storage frame is never the key preimage. NB this is for `mapping(address => V)` where `address` is
   the BCH-lbc `AddressType`. A ported EVM contract that keys by the EVM 20-byte address uses `uint160` (Section 2),
   which is a NUMBER key - `slot = sha256(uint160-bytes)` - and is already handled; the two are different key spaces,
   never mixed within one mapping.
2. **CANONICALITY is the whole ballgame.** The same logical address must always hash to the same slot. Two ways it
   could break, both must be closed:
   - *Representation drift*: an address used as a key must be the byte-exact canonical lbc whether it is fresh
     (`m[msg.sender]`), a literal, or LOADED from storage (`m[owners[id]]`). => `load` must reproduce the exact lbc
     (Section 3 (B) guarantees this; (A) depends on the parser). A load that returned the padded frame, or a
     non-canonical script, would slot to a different entry.
   - *Non-canonical encodings of "the same" address*: standard p2pkh/p2sh have exactly one lbc each, so distinct
     addresses -> distinct lbc -> distinct sha256 (collision-resistant). The "bounded standard types only" rule is
     what buys this - it forbids arbitrary equivalent scripts. p2s is excluded (Section 6), so there is no "two
     scripts, one address" ambiguity.
3. **Ceiling enforcement for keys**: an address key whose lbc exceeds the ceiling (a p2s key) cannot be represented
   and MUST fail closed at the key boundary (never truncate - a truncated key would collide/mis-slot).
4. **`address(0)` sentinel**: EVM contracts use `address(0)` as a null/uninitialized marker (`require(owner !=
   address(0))`, `m[address(0)]`). BCH has no natural zero-address lbc. Reserve a single canonical null encoding
   (e.g. the length-0 frame `00 ..pad..`, i.e. `len = 0`) so `address(0)` is one fixed preimage -> one fixed slot,
   and `a == address(0)` is a byte compare against that canonical frame. Must be defined once and used by covenant
   AND SDK. (This is an EVM-parity edge, not specific to keys, but keys make it load-bearing.)
5. **Iteration (KEYS/ENTRIES over a sorted address mapping)**: the C2 entry stores `slot = sha256(key)`, not the raw
   key, so KEYS iteration supplies the keys and the covenant verifies `sha256(key) == slot`. Address keys are
   variable-length lbc, which the existing variable-width iteration protocol already handles (LENGTH-PREFIXED key
   blob). No change needed beyond using the same canonical lbc preimage.
6. **SDK <-> covenant agreement**: `classifyKeySource` / `evalComputedKey` (SDK) must derive the identical
   `sha256(lbc)` the covenant computes. The SDK already resolves address key values; it must use the canonical lbc
   (not a padded/ABI form) as the sha256 input, matching (1).

EVM divergence (accepted, consistent with the physical-slot model): EVM computes an address-key slot as
`keccak256(bytes32(addr20) . slot)`; solidcash computes `sha256(lbc)`-masked (BCH-native, different hash + different
address bytes). This is the same sha256-for-physical-slots vs keccak-for-logical policy already in force
([platform-differences.md](platform-differences.md)); it is self-consistent (SDK == covenant), not EVM-byte-exact.

## 6. Ceiling enforcement (the one real soundness edge)

BCH permits locking to arbitrary scripts, so a >35-byte lbc CAN reach an `address` (a param, a cast from `bytes`, a
computed script). The bounded model MUST reject it rather than truncate/overflow:

- at `store` / frame construction: if `lbc.length > 35`, FAIL CLOSED (compile-time where the length is static;
  runtime `require`/revert where it is dynamic - a length check on the lbc before framing).
- at the key boundary: same - a key that cannot be framed cannot be a bounded-map key.

Truncation is the unsound outcome to prevent (it would alias two different addresses to one slot / one stored
value). Fail-closed is mandatory.

## 7. Phasing

- **Phase 1 - storage representation (independent win).** Introduce the fixed-<=36 frame at the storage boundary
  (state vars + commitment packing) behind/replacing the `rawbytes` path: `store` pads (with ceiling guard),
  `load` strips to the exact lbc. Deliverable: address state vars pack inline in the 128B commitment (no chunk
  UTXO), uniform with `bytesN`. Measure against the framed model. No slot-field or mapping-key change required yet.
- **Phase 2 - address-keyed mappings.** Route `mapping(address => V)` / `mapping(K => address)` through C2 with the
  canonical `sha256(lbc)` key preimage (Section 5) and the inline fixed-36 value (fits the C2 entry's <=64B value
  slot, no chunk). Adversarial tests: same address fresh-vs-loaded hashes identically; `address(0)` sentinel;
  exclusion proof for an absent address key; ceiling-exceeding key fails closed.
- **Phase 3 - address as a 2-slot composite field** (`sload`/`sstore` on an address slot). Rides composite sub-slot
  field access; ships only after that lands.

## 8. Open decisions (settle before coding)

1. Encoding (B) length-prefixed 36 vs (A) self-describing 35. Recommend (B) for the exact-round-trip guarantee that
   underwrites mapping-key soundness.
2. `address(0)` canonical null frame - exact bytes (proposed: `len = 0`), used by covenant + SDK.
3. Scope of Phase 1: does the fixed frame REPLACE the framed/rawbytes address storage, or coexist behind a flag
   during migration? (Address is used widely; a coexistence period may de-risk.)
4. Ceiling value: 35 (tight) vs a small margin. 35 covers all standard forms; a margin (e.g. 40) would absorb a
   future standard address type without a format change, still within 2 slots / 128B.

## 9. Test impact - foreseeable breaks (audited 2026-07-20)

Audited the existing address / slot / ABI tests to foresee what the rework breaks:

- **`sload`/`sstore` slot-layout conformance - BREAKS iff we change the address slot WIDTH.**
  `slot-layout.conformance.test.ts` runs `address a; uint96 b; uint256 c;` on BOTH solc (EVM) and solidc and asserts
  the SAME `c.slot`: EVM packs address(20B)+uint96(12B) into slot 0, so c is slot 1, and the SolidCash covenant must
  ACCEPT slot 1 (`assertStatefulConformant` = compile-solc + eval-EVM + BCH-covenant-accepts). Making address a fixed
  2-word FIELD (Phase 3) means `stateVarByteWidth(address): 20 -> 2 slots`, pushing c to slot 3 -> the covenant
  rejects EVM's slot 1 -> MISMATCH. This is the EVM-20-byte-layout-parity vs address-as-2-slot-field tension, and it
  is UNAVOIDABLE for Phase 3. **Phase 1 (commitment packing) is SAFE: it changes the physical storage bytes, not the
  EVM slot LAYOUT** - keep `stateVarByteWidth(address) = 20` and this conformance passes unchanged. So do Phase 1
  without touching the layout width; Phase 3 must UPDATE this conformance case to expect the (intentionally divergent)
  BCH 2-slot layout when it lands.
- **EVM-address ABI tests - SAFE.** The abi/decode conformance uses `uint160` (a number), never `AddressType`
  (`emitEvmAbiWord` throws on AddressType). The rework touches neither `uint160` nor the ABI encoder, so all
  EVM-address ABI byte parity is unaffected.
- **RISK - address has INCONSISTENT representations today, so the value blast radius is wider than "storage
  boundary".** `AddressCompare.test.ts` passes addresses as 32-BYTE big-endian values (`b32('01')`,
  `0x01 ++ 00*31` = 2^248) and compares `<`/`>` unsigned; storage is framed lbc (25/35); ABI is `uint160` (20);
  slot layout is 20. Four different widths for one type. Phase 1 must NOT change the VALUE a contract observes: if
  `load` strips back to the exact prior bytes (Section 3 (B) round-trip), value/compare/getter tests stay green; any
  test that inspects the RAW stored bytes, or depends on address being a 32-byte comparable, must be audited and
  possibly migrated. Reconciling these representations is a prerequisite, not an afterthought.

NET: keep the EVM slot LAYOUT at 20 bytes (Phase 1 = pure commitment packing) and both the sload/sstore conformance
AND the uint160 ABI tests are untouched. Only Phase 3 (address as a 2-slot field) intentionally diverges and requires
updating the one address-packing conformance case. The `AddressCompare` 32-byte representation is the wildcard to
reconcile before touching the address value bytes.

## 10. Re-evaluation (2026-07-20) - is the switch worth it?

Re-weighing status-quo (variable framed / unbounded, `isChunkPackableElementType`) vs the proposed fixed 2-word form,
now that the Section-9 audit exposed address's four existing representations and the conformance tension. The initial
brainstorm was too bullish. Honest re-weighting:

**PROS - all weaker than first framed:**
- *Address slot fields* (the original motivation): NICHE (address slot access is rare - mainly OZ ERC-1967
  admin/impl slots), GATED on composite sub-slot field access (unbuilt), BCH-only-self-consistent (NOT EVM parity - a
  35B lbc across 2 slots is not EVM's 20B/1-slot), and it BREAKS the address+uint96 packing conformance (Section 9).
- *Commitment packing*: MARGINAL-to-NEGATIVE. A single framed address already fits inline (35 < 128, no chunk), and a
  FIXED 36B frame WASTES ~10 bytes vs the ~26B variable framing for the common p2pkh/EOA (the pad-to-max is mandatory
  precisely because it must be fixed-width).
- *Uniform / deterministic*: minor, and it ADDS a 5th address representation unless the whole model is reconciled
  (large effort).
- *Sound address-keyed mappings*: NOT unique to the fixed form - soundness needs an exact key round-trip, which the
  status-quo framing also provides; address keys already work in C2 as `sha256(value)`.

**CONS - confirmed / heavier:**
- Breaks the slot-layout conformance (Phase 3, the EVM-20B-layout vs 2-slot-field tension).
- ~10B/p2pkh space waste from mandatory padding-to-max.
- Increases fragmentation (a 5th representation) absent a full reconcile.
- ~30-file blast radius + `AddressCompare`(32B)/getter value-test risk.
- Ceiling-enforcement burden (fail-close >35B scripts).

**STATUS-QUO advantages, underweighted before:** space-efficient (no pad), conformance-safe (20B layout untouched),
uniform with the bytes/string variable-width family, address-keyed mappings already work, single addresses already
pack inline.

**RECOMMENDATION: do NOT switch on current evidence.** The lone benefit (address slot fields) is niche +
conformance-breaking + BCH-only-consistent and does not justify the costs; the status quo is fine for storage,
packing, and mappings, and leaving address slot access fail-closed is sound. Revisit ONLY if faithful OZ ERC-1967
proxy porting via RAW address slots becomes a concrete priority - and even then prefer high-level state getters
(which the EACC porting already uses) over raw address-slot access. If ever done: Phase 1 (commitment repr) WITHOUT
changing `stateVarByteWidth` (keep 20B layout parity so the conformance + uint160 ABI tests stay green), and defer the
conformance-breaking 2-slot field (Phase 3) indefinitely.
