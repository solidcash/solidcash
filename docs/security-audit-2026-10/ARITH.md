<!-- cspell:ignore injectivity misframed signednesses -->
# ARITH audit: integer arithmetic, casts, indexing/slicing, ABI encode/decode, Yul/memory, literals

Tree: /Code/cashscript/.worktrees/per-call @ abbb7e0ec (feat/per-call). Read-only; no tests, compiles or probes run.
GTT = packages/solidc/src/generation/GenerateTargetTraversal.ts. VM facts below are taken from libauth
(node_modules/@bitauth/libauth/build/lib/vm/instruction-sets): numeric opcodes decode operands with
`requireMinimalEncoding: true` (common/combinators.js:47-80); OP_NUM2BIN and OP_BIN2NUM decode their value
operand with `requireMinimalEncoding: false` and minimally re-encode it (common/format.js:48-73); OP_RSHIFTNUM is
BigInt `>>` (floor) and OP_LSHIFTNUM fails above 80000 bits (bch/2026/bch-2026-bitwise.js:13-49).

---

## ARITH-1: Non-minimal uintN (and bigint) parameters pass the entry check, and mapping keys hash the raw bytes
- Severity: HIGH. Confidence: CODE-CONFIRMED (emitters traced). The end-to-end VM run is not done.
- Where:
  - GTT:9858-9862 (enforceFunctionParameterType): a uintN param is checked by `OP_PICK` + `emitIntBoundsCheck` + `OP_DROP`.
  - GTT:16934-16958 (emitIntBoundsCheck, unsigned branch): `DUP <N/8+1> OP_NUM2BIN <N/8> OP_SPLIT OP_NIP 0x00 OP_EQUALVERIFY`.
    OP_NUM2BIN minimally re-encodes a non-minimal operand, so `0x0500`, `0x050000...`, `0x00` and `0x80` (-0) all pass.
    Only the signed branch reaches a numeric opcode (OP_ADD), which rejects non-minimal input.
  - GTT:9873-9882: a `bigint` param has no check at all.
  - GTT:25583-25600 (emitMappingKeyIdentity) normalizes address keys only. GTT:25611-25660 (emitSortedKeyHash),
    28049-28061 (emitGenesisKeyHash) and 22765-22790 (external collection read) all `OP_SHA256` the raw key item.
  - abi.encodePacked normalizes ints (native `OP_NUM2BIN width`, GTT:21177-21180; evmCompat
    emitEvmPackedValue GTT:21115-21130), and so do the evmCompat abi.encode words.
- Root cause: one number has many byte encodings. The type check lets every one through. The key derivation
  treats them as distinct keys, while the hash and signature encoders collapse them to one value.
- Attack: replay a voucher, nonce or claim.
  ```solidity
  mapping(uint256 => bool) claimed;
  function claim(uint256 index, address to, uint256 amount, bytes32[] calldata proof) external {
      require(!claimed[index]);
      require(MerkleProof.verify(proof, root, keccak256(abi.encodePacked(index, to, amount))));
      claimed[index] = true;
      token.transfer(to, amount);
  }
  ```
  Steps:
  1. Claim once with `index` pushed as `0x05`.
  2. Claim again with `0x0500`, then `0x050000`, and so on. Every padding has the same leaf, so the proof still verifies.
  3. Each call reads `claimed[H(0x05 00..)]`, a fresh slot. The absence proof succeeds, the claim pays again, and a new
     entry is written.

  The same works for `usedNonces[nonce]`, `processed[id]` and signature replay guards when the nonce is used only as a
  key and inside a normalizing hash. Any numeric opcode on the value (OP_ADD, OP_LESSTHAN, OP_NUMEQUAL) reverts, so
  those call shapes are safe.
- Fix: require minimal encoding for uintN and bigint entry params. Either replace the item with `OP_0 OP_ADD`, or add
  `OP_DUP OP_BIN2NUM OP_EQUALVERIFY` on the picked copy. Optionally also `OP_BIN2NUM` int-typed keys in
  emitMappingKeyIdentity, plus the SDK-side equivalent.

## ARITH-2: Unvalidated struct/array param blobs and wrong-length bytesN go verbatim into state commitments, desyncing fields
- Severity: HIGH. Confidence: SUSPECTED (the write and read emitters are traced; needs a compile + VM test).
- Where:
  - GTT:9873-9882: struct and array params are never validated. The SDK pushes each as one pushdata blob
    (packages/solidcash/src/Argument.ts:149-176).
  - GTT:21603-21613: emitPushdataEncode treats a struct or array value as already encoded, a no-op.
  - GTT:21624-21631: a bytesN state field gets the fixed `<N>` prefix whatever the value's real length
    (`<N> OP_SWAP OP_CAT`).
  - GTT:22585-22592 (visitStateAssign): the value is encoded straight into the pending field.
  - GTT:38365-38380 (emitStateFieldDecodeInline): later fields are found by walking earlier ones with
    emitPushdataSkip (bytesN is a fixed N+1 skip; a struct is skipped field by field).
  - Wrong-length bytesN sources: ARITH-3 casts, and the native last-field decode in ARITH-6.
- Root cause: a composite or bytesN value from attacker bytes is never re-framed or length-checked before it becomes
  part of an inline data-NFT field. Struct state vars are inline, not chunked (types.ts:896-900). Junk after the
  struct's canonical fields, or past N bytes, is therefore read as the start of the next field on the next spend.
- Attack (assuming the commitment stays at 128 B or less):
  ```solidity
  struct P { uint256 a; bytes32 t; }
  P public last;          // field 0
  address public owner;   // field 1
  function set(P memory p) external { last = p; }
  function sweep() external { require(msg.sender == owner); /* pay out */ }
  ```
  Steps:
  1. Call `set` with `p` = `enc(a) || 0x20 <32 B> || <pushdata(attacker P2PKH lock)>`. The covenant's expected output
     commitment is `p || enc(owner)`, which the attacker builds.
  2. The next decode of field 1 skips `a` and `t` and reads the attacker's lock as `owner`. As the last field, it
     drops the remainder.
  3. Call `sweep`.

  If some other check rejects the misframed input commitment instead, the data NFT is bricked.
- Fix: validate composite params at entry by re-encoding (decode each field with its checks, re-encode, then
  `OP_EQUALVERIFY` against the param). Length-check bytesN (`OP_SIZE <N> OP_NUMEQUALVERIFY`) before any encode.

## ARITH-3: `bytesN(bytes)` explicit conversion does not truncate or pad
- Severity: MEDIUM. Confidence: CODE-CONFIRMED.
- Where:
  - packages/solidc/src/generation/utils.ts:192-193: an unbounded `bytes` source makes the conversion `return []`.
  - packages/utils/src/types.ts:381-397: explicitlyCastable allows it.
  - TypeCheckTraversal.ts:1695-1703: strict mode adds no size rule for dynamic bytes.
  - `!=` on bytes compiles to `OP_EQUAL OP_NOT` (utils.ts:304).
- Root cause: Solidity >= 0.8.5 makes `bytesN(b)` the first N bytes of b, zero-padded if shorter. Here the value
  keeps b's length but is typed bytesN.
- Attack: a selector deny-list.
  ```solidity
  function exec(address t, bytes memory data) external {
      require(bytes4(data) != IERC20.approve.selector);
      t.call(data);
  }
  ```
  `bytes4(data)` is the whole payload, so it never equals the 4-byte selector and the forbidden call passes. An
  allow-list (`==`) fails closed instead. The wrong-length "bytesN" also feeds ARITH-2 (state framing) and the
  bytesN no-op in abi.encodePacked (GTT:21131-21132).
- Fix: for `bytes -> bytesN`, emit `<N zero bytes> OP_CAT <N> OP_SPLIT OP_DROP` (pad, then take N).

## ARITH-4: evmCompat abi.decode of an all-static schema never length-checks the last word
- Severity: MEDIUM. Confidence: CODE-CONFIRMED.
- Where:
  - GTT:20799-20811 (emitEvmAbiDecode): the last field gets the entire remainder ("is exactly the last 32-byte word",
    but this is not checked).
  - GTT:21386-21391: the dispatcher does not check the size first.
  - GTT:20910-20941 (emitEvmWordToValue ints): the range check runs only when `type.bits < 256` (line 20930).
  - GTT:20895-20903: an address is whatever follows 12 zero bytes, of any length.
- Effects:
  - With a remainder longer than 32 B, a `uint256`, `int256` or bigint decodes to a value up to 2^(8*len). That is
    above type(uint256).max, and the type is still uint256. Same-type assignments skip the range check
    (GTT:10080-10082), so the value can be stored. The next state decode then refuses it and bricks the field.
  - Short or zero-prefixed last words decode to the same values, so one tuple has infinitely many encodings. This
    breaks replay guards keyed by `keccak256(data)` when the authorization covers the decoded values.
- Attack:
  ```solidity
  (uint256 nonce, uint256 v) = abi.decode(data, (uint256, uint256));
  ```
  Pass `data = word(nonce) || 0x00*k || word(v)`.
- Fix: `OP_SIZE <32*n> OP_NUMEQUALVERIFY` (or `>=` plus an exact split) before decoding a static schema. Range-check
  256-bit ints like the narrower ones.
- Note: this is distinct from the dirty-bits checks (present). The same pattern may exist in emitEvmStructDecode and
  emitEvmWordsToArray; not reached.

## ARITH-5: BoringMath-shaped safe-casts lose their overflow check on evmCompat split facets
- Severity: MEDIUM. Confidence: CODE-CONFIRMED.
- Where:
  - semantic/MarkLegacyCheckedMath.ts:36-94 matches `require(a <= uintN(-1)); c = uintN(a);` as `'cast'`, plus the
    add/sub/mul wrapper shapes.
  - Library functions are free functions (AstBuilder.ts:1001-1028).
  - GTT:3450-3452 enables the lowering on split facets under evmCompat.
  - GTT:14276-14288 replaces each call with `CastNode(uintN, a)` or a BinaryOp.
  - utils.ts:118-121: the evmCompat unsigned narrowing cast is `<2^N> OP_MOD`, so it truncates and then passes the
    bounds check.
- Root cause: "SolidCash bounded arithmetic is already checked" is false for evmCompat explicit narrowing, which
  truncates as Solidity does.
- Attack: on a split facet, `x.to128()` or `to64()` / `to32()` (BoringMath, used by BentoBox, Kashi and MasterChefV2)
  with x >= 2^N silently truncates instead of reverting. One example is a reward accumulator or a `uint128`
  elastic/base total.
- Secondary issues:
  - The add/sub/mul replacement goes through emitIntBoundsCheck, so it wraps when the call site is inside `unchecked`.
    The original function would revert.
  - Signed int variants of the 2-param shapes are also matched, which changes their (quirky) revert behaviour.
- Fix: lower `'cast'` to a checked conversion (bounds check without the OP_MOD). Lower the binary shapes with a forced
  check that ignores uncheckedDepth. Restrict the matcher to unsigned types.

## ARITH-6: Native abi.decode and struct last fields: bytesN/pubkey take the whole remainder; enums are not decoded
- Severity: MEDIUM. Confidence: CODE-CONFIRMED.
- Where:
  - GTT:22008-22030 (emitPushdataDecodeLastField): bytesN 2..75 and pubkey are `1 OP_SPLIT OP_NIP`. The prefix and
    length are not checked, so the value has arbitrary length.
  - GTT:22092-22104: struct field reads use the same routine for the last field.
  - GTT:22259-22263: `isIntLike` excludes EnumType, so an enum field decodes to raw bytes with no OP_BIN2NUM and no
    membership check (Solidity reverts).
  - The non-last bytesN prefix byte is also unchecked (GTT:21983-21989); the length is still right.
- Attack: `abi.decode(data, (uint256, bytes32))` or `p.tag` of an attacker struct param returns a 40-byte "bytes32".
  This feeds ARITH-2 and breaks equality and packed-array strides. `abi.decode(d, (Status))` with an out-of-range or
  non-minimal byte gives an invalid enum.
- Fix: check `OP_SIZE == N` and the prefix byte. Route EnumType through the int decode plus emitEnumBoundsCheck.

## ARITH-7: Framed-element slice `arr[s:e]` never checks e <= length; phantom elements read as defaults
- Severity: LOW-MEDIUM. Confidence: CODE-CONFIRMED.
- Where:
  - GTT:16155-16185: the source count is dropped ("not needed"). The result count is `e - s` with no `e <= count` or
    `s <= count` check.
  - GTT:22296 and 22413-22417: the generic decode of an empty blob returns `[0, empty]`, so skips past the end are no-ops.
  - GTT:17089-17108 (scan loop) and GTT:17203-17235: the `index < length` bound only compares against the inflated
    count.
  - Native and evmCompat array params are pushed blobs with no count-versus-frames validation (GTT:9873-9882), so a
    param `S[]` or `bytes[]` can declare count N with fewer frames. The same phantom default reads follow (variable
    width only; fixed width fails at OP_SPLIT).
- Attack: `items[0:n]` with n > items.length gives `.length == n` and `items[k]` = zero struct for k >= real length.
  Solidity reverts.
- Fix: keep the source count and verify `s <= e <= count`. Make the element decode fail on an empty blob. Validate
  array params (count vs frames, no trailing bytes).

## ARITH-8: int -> enum conversion inside `unchecked` skips the membership check
- Severity: LOW. Confidence: CODE-CONFIRMED.
- Where: GTT:13490-13491, `if (this.uncheckedDepth > 0) return;`. Solidity's Panic 0x21 check is not affected by
  unchecked.
- Attack: `unchecked { s = Status(code); }` stores an invalid member, which lands in the `else` arms of status
  checks.
- Fix: drop the uncheckedDepth early return.

## ARITH-9: evmCompat signed <-> bytesN casts are sign-magnitude; `bytesN(uintN)` reverts for the top half
- Severity: LOW. Confidence: CODE-CONFIRMED.
- Where: utils.ts:125-127 (`<N> OP_NUM2BIN OP_REVERSEBYTES`) and utils.ts:131-136 (signed: `OP_REVERSEBYTES OP_BIN2NUM`).
- Effects:
  - `int256(bytes32(0xff..ff))` = -(2^255-1), not -1.
  - `int8(bytes1(0x80))` = 0.
  - `bytes32(int256(-1))` = 0x80..01, and `bytes32(type(int256).min)` reverts.
  - `bytes32(uint256 x)` and `bytes4(uint32 x)` revert for x >= 2^(8N-1), because a minimal number needs N+1 bytes.
    `bytes32(uint256(keccak256(..)))` fails about half the time.
- Fix: use the two's-complement helpers (emitToTwosComplementBytes / emitFromTwosComplementBytes, GTT:16238-16270).

## ARITH-10: Checked-mode `<<` and evmCompat signed narrowing revert instead of truncating
- Severity: LOW. Confidence: CODE-CONFIRMED.
- Where: GTT:16441-16454 (the shift is OP_LSHIFTNUM via compileBinaryOp at 16444, then emitIntBoundsCheck at 16452) and utils.ts:118-123 (signed and
  sign-change casts emit nothing, then the bounds check).
- Effects: Solidity never checks shifts (`type(uint256).max << 8` gives a value), and `int8(int256(200))` = -56.
  Here both revert. This fails closed: DoS only.
- Fix: wrap shift results with emitIntWrap regardless of uncheckedDepth, and truncate in two's complement for
  signed/sign-change casts.

## ARITH-11: Yul add/sub/mul are not mod 2^256
- Severity: LOW. Confidence: SUSPECTED.
- Where:
  - LowerInlineAssembly.ts:1599-1603 and :2171-2179: these become plain BinaryOps in the caller's context; nothing
    wraps them in unchecked.
  - Yul literals are untyped INT (:2001-2003). By utils.ts:23 and types.ts:574, `uint256 op INT` has type INT
    (unbounded, never checked or wrapped).
- Effects:
  - Two typed operands revert on wrap, e.g. OZ mulDiv `mul(x, y)`, or `signextend` of a negative value (:2094-2104,
    whose comment assumes wrapping).
  - A literal operand gives an unbounded result: `iszero(add(x, 1))` is false for x = max, where EVM gives true.
- Fix: lower Yul arithmetic under a forced wrap (emitIntWrap on uint256) and type the literals uint256.

## ARITH-12: msg.value and .length are bigint; mixed arithmetic does not revert on underflow
- Severity: LOW. Confidence: CODE-CONFIRMED.
- Where: TypeCheckTraversal.ts:2980-2981 and :2932-2937 (BIGINT). resultingTypeForBinaryOp (utils.ts:23) makes
  `uint - bigint` a bigint, so emitIntBoundsCheck does not run.
- Effects: `require(cost - msg.value <= tip)` passes when msg.value > cost, and `i < arr.length - 1` on an empty
  array is false. In Solidity both underflow and revert. Assignment to a bounded variable is still checked.
- Fix: type msg.value and `.length` as uint256 in evmCompat.

---

## Checked and sound
- `/` and `%`: OP_DIV/OP_MOD fail on a zero divisor. Results truncate toward zero, and the remainder takes the
  dividend's sign, matching Solidity.
- `type(int256).min / -1` and `-type(int256).min` revert in checked mode and wrap to min under unchecked
  (emitIntBoundsCheck / emitIntWrap, GTT:16934-17040).
- `>>` on negative ints: OP_RSHIFTNUM floors, matching Solidity's rounding toward -infinity.
- emitIntBoundsCheck uses the sign-byte test with the signed bias via OP_LSHIFTNUM (not OP_LSHIFTBIN). It rejects
  negatives and values >= 2^N, and emitIntWrap's modular wrap is correct for both signednesses.
- `+ - * / % **` with an IntType result are always bounds-checked (GTT:16450-16454). `++`, `--` and compound
  assignment desugar to checked BinaryOps (DesugarPostfixExpressions.ts:459-480).
- `**`: a negative exponent is guarded, the final result is checked, `2**e` uses OP_LSHIFTNUM, and a literal fold
  is checked.
- Unary `-` is checked. `~x` on an IntType is `mask - x`, which is correct.
- Integer `& | ^` go through two's-complement bytes (GTT:16238-16286) and are correct for in-range operands.
- Narrowing assignments from int/bigint or a wider type are range-checked at every write site: locals, tuples,
  state, mapping values, array elements, internal call arguments and returns.
- Entry params:
  - Signed intN, enum and fixed checks hit numeric opcodes, which reject non-minimal input.
  - bool is normalized with OP_0NOTEQUAL.
  - bytesN params are size-checked.
- `bytes[k]` and `b[s:e]`: OP_SPLIT enforces 0 <= s <= e <= len (slice GTT:16187-16199; `bytes[k]` GTT:17243-17254).
- Fixed-width array index and slice: `index < length` plus OP_SPLIT at `index*W` rejects negative and past-end
  indices. A negative index into a variable-width array loops until it fails, so it fails closed.
- evmCompat abi.decode dirty-bit checks are present: bool < 2, zero padding for address and bytesN < 32, range for
  narrower ints, enum < member count (GTT:20877-20943). The dynamic-schema decode splits heads exactly.
- Native abi.decode of int fields uses OP_BIN2NUM plus emitDecodedNumericRangeCheck, which ignores unchecked.
- abi.encodePacked normalizes ints to a fixed width (native NUM2BIN, evmCompat two's-complement big-endian).
- evmCompat unsigned narrowing truncates (OP_MOD 2^N), as Solidity does.
- `uintN(bytesN)` in evmCompat is REVERSE plus a 0x00 pad plus OP_BIN2NUM, so it never reads as negative.
- bytesN/address ordering compares big-endian unsigned (GTT:16289-16310).
- Literal parsing:
  - Octal is rejected in evmCompat.
  - Units are exact (`1e18` is exactly representable).
  - Scientific literals fold exactly.
  - `-<literal>` folds to a negative literal (AstBuilder.ts:4816-4820, 5007-5050).

## Not reached
- The evmCompat static composite decoders (emitEvmStructDecode, emitEvmWordsToArray, static-array inline decode).
  They may share ARITH-4's unchecked last word.
- LowerMemoryModel high-level memory aliasing and the Yul sload/sstore slot arithmetic (LowerInlineAssembly.ts
  ~855-1561).
- Sign-magnitude memory words: rawWordBytes with a signed value followed by a uint256 mload
  (YulMemPrimitives.ts:59-73, 130-140).
- The addmod/mulmod emitters and the FixedType mul/div rounding details.
- ValidateDataLocations.ts, the msg.sig/msg.data internals, and intToString/stringToInt.
- Event-data injectivity, and the vmap absence-bracket proofs (only key derivation was checked).
