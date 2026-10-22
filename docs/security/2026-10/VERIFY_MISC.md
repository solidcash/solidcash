<!-- cspell:ignore Ownr SDKCORE triggerable -->
# VERIFY_MISC: second-pair verdicts on ARITH-2, SEM-2, SDKCORE-1

Tree: /Code/cashscript/.worktrees/per-call @ abbb7e0ec (feat/per-call). Verification was by reading only: no tests, compiles or probes.
GTT = packages/solidc/src/generation/GenerateTargetTraversal.ts.

---

## ARITH-2: PARTLY REFUTED (the cited attack and the bytesN-param half). A narrower residual is CONFIRMED by reading.

### What is refuted
1. **The cited attack (struct field 0, then `owner` field 1 in the same NFT) cannot be laid out.**
   packages/solidc/src/semantic/SymbolTableTraversal.ts:1858-1872:
   ```ts
   } else if (sv.type instanceof StructType) {
     // Struct must be placed last in its NFT.
     ...
     sv.fieldIndex = fieldIndex++;
     ...
     // Force next non-struct var to go to a new NFT since struct must be last
     nftIndex++; fieldIndex = 0; currentNftUsed = 0;
   ```
   Packed arrays get the same treatment (:1873-1901). Unbounded chunk-packable arrays become dynamic, storing only a
   uint32 header (AstBuilder.ts:5520-5531). Struct-element arrays are collections (AstBuilder.ts:5547).
   So `owner` lands in NFT 1 field 0. A struct read as the last field takes the whole remainder
   (GTT:22010-22011: "take the remainder as-is (struct is always last)"). Junk after the canonical fields stays
   inside that field and cannot shift into the next one.
2. **bytesN ABI params ARE length-checked.** GTT:9842-9852 emits `<idx> OP_PICK OP_SIZE <N> OP_EQUALVERIFY OP_DROP`
   for every bounded-bytes param. It is called from GTT:8732-8733 for every non-OP_DEFINE frame, and
   `enforceFunctionParameterTypes` defaults to true (compiler.ts:301; the CLI can opt out with
   `skipEnforceFunctionParameterTypes`). The H6 int/enum/fixed checks sit next to it (:9854-9870). A wrong-length
   bytesN therefore cannot enter as a direct param.

### What is confirmed (residual)
- Struct and array params are never validated. `shouldEnforceFunctionParameterType` (GTT:9873-9882) has no
  Struct or Array case. `emitPushdataEncode` treats them as already encoded (GTT:21606-21613), and
  `emitAssignmentRangeCheck` returns early for non-int targets (GTT:10076).
- **A struct whose LAST field is bytesN produces a wrong-length bytesN value.** The field extract uses
  `emitPushdataDecodeLastField` for the last field (GTT:22097-22099). For bytesN that is `1 OP_SPLIT OP_NIP`, which
  takes the whole remainder (GTT:22021-22025). With `p = enc(a) || 0x20 || t(32) || junk`, `p.t` is 32+k bytes
  but still typed bytes32.
- **The bytesN state encode does not check size.** It emits `<N> OP_SWAP OP_CAT` (GTT:21624-21631).
- **The written commitment is the raw value, not a re-encode.** The settlement concatenates the pending encoded
  value with the other fields, which it re-encodes from the input, and checks the result against the output with
  `OP_EQUALVERIFY` (GTT:31531-31535, :31566-31591). The attacker builds the matching output commitment.
- **The next spend desyncs.** A non-last bytesN field is skipped as a fixed N+1 bytes (GTT:22165-22169), so the k
  junk bytes are read as the following field. If that field is last and generic (an address, say), the decoder
  parses the attacker's push and drops the remainder unchecked (GTT:22031-22034).

### Realistic trigger
```solidity
struct Claim { uint256 amount; bytes32 root; }  // bytesN as the struct's LAST field
bytes32 public root;    // NFT0 f0 (bin-packed, not last)
address public owner;   // NFT0 f1
function propose(Claim memory c) external { root = c.root; }
```
Calling with `c = enc(amount) || 0x20 <32B> || pushdata(attacker lock)` makes `owner` decode as the attacker lock on
the next spend. The other wrong-length sources the finding names (`bytesN(bytes)` casts, ARITH-3) feed the same
unchecked encode.

Untested variant: pushing a junk-suffixed struct into a native `packed` struct array would shift every element
pushed after it.

Not verified: entry bodies a message-bus route invokes as OP_DEFINE (GTT:6582-6583, :6608) skip the entry-param
checks (GTT:8728-8733). Whether the route checks params first was not traced.

### What a test must show
Compile the shape above. Call `propose` with a junk-suffixed `c`, then call an `onlyOwner`-style function signed by
the attacker lock. It should pass the VM.

**Severity: MEDIUM** (HIGH where the shape occurs). Full takeover of the next field needs a specific source shape:
a bytesN struct tail or a `bytesN(bytes)` cast, written to a non-last slot from an unprivileged entry. The cited
struct-then-owner layout is impossible.

---

## SEM-2: PATH CONFIRMED, cycle trigger REFUTED. The bare-catch trigger is real but needs B's standalone compile to fail.

### Path (confirmed)
- `compileReferencedContracts` (compiler.ts:19421) builds child B with the reduced `singleAst` pipeline
  (:19458-19549). That pipeline has no `expandModifiers` and no `expandBreakContinue`.
- It then embeds `compileReferencedContractStandalone(...) ?? scriptToBytecode(optimisationResult.script)`
  (:19568-19572).
- `expandModifiers` touches only `ast.contract` and free functions (ModifierExpansionTransformation.ts:411-460).
  `expandBreakContinue` likewise (BreakContinueTransformation.ts:44-56). No main-pipeline loop over
  `importedContracts` lowers them (compiler.ts grep: :4454, :8589, :19227, :19434 only).
- Nothing in the fallback rejects leftover modifiers. `customModifiers` is read only in AST/AstBuilder,
  InheritanceExpansion (constructor base invocations, :368/:620/:674), LowerMemoryModel:419 (an inlining
  predicate), LowerTailRecursion, LowerVMapCounterLoops and compiler.ts. It is never read in GTT,
  SymbolTableTraversal, TypeCheckTraversal or EnsureFinalRequire. The modifier is silently dropped.
- No warning: the bare `catch { return undefined; }` (compiler.ts:19681-19682) runs under `suppressWarnings: true`
  (:19675), and the call site uses `??` silently.

### Cycle trigger: REFUTED (fails closed)
- In the reduced pipeline, `sourcePrimaryContract` is the fallback tree's own contract (GTT:3436-3440). So B's
  `new A()` (A being the outer primary) is not a self-deploy and throws
  `Compiled bytecode for contract 'A' not available` (GTT:19508-19510).
- B's fallback runs BEFORE the standalone call and outside its try (compiler.ts:19543-19546 come before
  :19568-19572). The caller at :16185-16187 does not catch either, so the outer compile fails.
- A sibling cycle among imported contracts throws `CircularContractReferenceError` (compiler.ts:19875).
- So the :19668 guard cannot produce a silently degraded child for a creation cycle.

### Bare-catch trigger (real)
Any throw in B's full standalone compile that the reduced pipeline does not reproduce. The clearest is B's own
modifier errors, which only `expandModifiers` raises:
- `UndefinedModifierError`, e.g. the typo `onlyOwnr` (ModifierExpansionTransformation.ts:508-519)
- arity mismatch (:538)
- abstract or unimplemented modifier (:362-370, :522)
- redefinition (:359)

In all these cases parent A compiles cleanly, with no error or warning, and embeds a child whose `sweep` has no
guard. solc would reject such a source.

For a B that compiles standalone, child options equal the user's public options (compiler.ts
`referencedChildCompilerOptions`), so the standalone compile succeeds and the modifiers are present. What remains
there is only nested-context internal errors (stack or memory exhaustion, shared module state). An attacker cannot
cause those.

### What a test must show
A file where A runs `new B()` and B has `function sweep(address) external onlyOwnr {}`, with the modifier undefined
or invoked with the wrong arity. Compiling A should throw. Today it should succeed, and B's embedded bytes should
contain no owner check.

**Severity: MEDIUM.** Not attacker-triggerable. It silently turns an invalid child, a compile error in solc, into
a deployable child with no access control.

---

## SDKCORE-1: UNRESOLVED. The path exists and has no guard for some slot kinds. Other kinds are blocked.

### Confirmed by reading
- **The pad never inspects the input.** compose-assemble.ts:1499-1505 runs, for every
  `outputs.length < min(blockSize, inputs.length)`, `addOutput({ to: 0x51, amount: input.satoshis })`. It adds no
  token and never looks at the input's lock.
- **The trim only drops dummies.** :1664-1676 drops trailing pairs only when the input lock is
  `BALANCED_DUMMY_FUNDER` (P2SH32, `aa20953c..87`) and the output is `51`. It stops at the first real coin, and it
  runs only when `actualSize > minimumActualSize` (with a fixedSuffix there is no trim at all).
- **On a live provider, funders are whole wallet coins.** Composition always builds with
  `omitLocalFeeTail: true` (:384-388). Dummy funders are used only when the provider has `addUtxo`
  (sc-allocate-create-builder-funders-accounting.ts:371-372). Otherwise, with a Signer, the layout funders are
  whole signer P2PKH coins, sliced with no value ordering (:396-476). No shadow mock provider exists in
  message-bus/compose*.
- **Funders fill these slots** (stb-build-inputs.ts:186-300): transfer, tcTransfer, event, returnEvent, deploy,
  identityAnchor without an anchor, unused side-car and blockhash slots, and trailing slots without a trailing input.

### What blocks some cases
1. **Transfer and tcTransfer slots.** compose-semantic-effects.ts:288-291 and :309-312 throw
   `... is not canonically funded` unless the input is the dummy funder. A live composition with a wallet coin
   there fails closed.
2. **Blocks with `trailingCapacity > 0`.** The builder pads outputs to blockSize with 1000-sat OP_TRUE pads
   (stb-materialize-trailing-frame-and-pending.ts:136-172), so the full-value pad never fires. The coin's excess
   goes to the aggregate.
3. **Event slots whose event fires.** The covenant caps the output value at 1200 (balancedBlocks.ts:34-44).

### Not blocked
A block with `trailingCapacity == 0` whose last emitted output comes before funder-filled output-only slots that
emit nothing. Examples:
- a `returnEvent` with no return blob (compose-assemble marks it `conditional`, around :1684-1687)
- an event that does not fire
- an unused deploy, anchor or side-car slot

Such a wallet coin gets `OP_TRUE` carrying its full value and survives the trim. I found no value cap on these pads.
The comment at sc-allocate:373-377 shows the authors treat wallet pads in compositions as wrong, but no code refuses
them.

### What a test must show
Use a provider without `addUtxo` (regtest, or a mock subclass with `addUtxo` removed) plus a Signer whose coins are
large. Run a message-bus atomic composition whose participant block has `trailingCapacity == 0` and ends with a
funder-filled returnEvent or event slot that emits nothing. Assert that no `0x51` output carries more than 1200 sat
or equals a wallet coin's value.

Severity: MEDIUM until that test runs; HIGH if confirmed. A whole wallet coin of any size would go to
anyone-can-spend. Reaching it needs a live provider, a Signer, a composition, and a specific block shape.
Suggested fix (as the finding says): pad only for dummy-funder inputs; otherwise pass the value through to
`input.unlocker.generateLockingBytecode()` with its token, or throw.
