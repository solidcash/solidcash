# The SolidCash Call Model

The single reference for every way control or data crosses a function boundary in SolidCash:
internal calls, external function calls, `staticcall`, low-level calls, and `delegatecall`. It also
records the forward design for generic (allowlist-free) dynamic dispatch.

Deep-dive companions: [external-contract-calls.md](./external-contract-calls.md) (full external dispatch
spec), [subroutine-extraction.md](./subroutine-extraction.md) (internal-call bytecode optimization),
[external-libraries.md](./external-libraries.md) (script precompile libraries).

## Orientation

| Form | Source syntax | Mechanism | Synchronous? | Detail |
|---|---|---|---|---|
| Internal call | `f(x)`, `lib.g(x)` | `OP_DEFINE`/`OP_INVOKE` subroutine | Yes (one script) | section 2 |
| External call | `IFoo(addr).m(x)` | co-spend + introspection covenant | No (co-spend) | section 3 |
| Static external | `IFoo(addr).m.staticcall()`, `.outState.f` | read-only co-spend covenant | No | section 4 |
| Low-level | `addr.call{value:}(data)` | calldata/value covenant | No | section 5 |
| Delegatecall | `delegate` modifier; `addr.delegatecall(data)` | proxy/implementation covenant | No | section 6 |

## 1. The one fact everything follows from: BCH has no message call

The EVM has a synchronous `CALL` family: control transfers to the callee, the runtime executes it, and
returndata flows back. Reentrancy, checks-effects-interactions, and `_before`/`_after` hooks all hang off
that temporal boundary.

BCH has none of it: no call opcode, no nested execution, no call stack. A transaction is validated as one
flat, atomic snapshot. So "contract A calls contract B" is not an invocation - it is a **co-spend plus
introspection**: A's input and B's input are both in the same transaction, and A's locking script asserts
predicates over that transaction (via `OP_UTXOBYTECODE`, `OP_OUTPUTTOKENCOMMITMENT`, `OP_UTXOTOKENCATEGORY`,
etc.). Three consequences run through this whole document:

- **The script is the sole arbiter.** The SDK assembles transactions but enforces nothing. Anything not
  checked by the locking script is unconstrained, regardless of what the SDK does.
- **Integrity binding is what makes a "call" a call.** Because nothing delivers the call, the only thing
  separating "A read B's result" from "A accepted a parameter" is the script proving the value came from the
  actually-co-spent B. Drop that proof and the feature collapses into a `bytes` argument.
- **Loops exist (BCH May 2026), but co-spend liveness still scales with N.** The VM has real `OP_BEGIN`/
  `OP_UNTIL` loops (the compiler emits them - GenerateTargetTraversal `visitWhile`/`visitFor`), so runtime-
  length iteration over inputs is possible, bounded by the per-tx op-cost budget. But every external target
  is still a real co-spent input/output, so transaction size and fees grow with the number of targets.

Internal calls are the exception: they happen inside a single script execution, so they are genuinely
synchronous - see section 2.

## 2. Internal calls (same-contract, free, and library functions)

Internal calls are real in-script subroutine calls, compiled to the BCH-2026 `OP_DEFINE`/`OP_INVOKE`
opcodes. They are not co-spends; they execute within the one script run.

- Each function gets a `functionId` (SymbolTableTraversal `nextFunctionId`). Entry-point functions are keyed
  by a 4-byte hash selector; internal/free/library functions get short integer IDs.
- Usage rule (GenerateTargetTraversal ~583): 0 uses -> omit, 1 use -> inline at the call site, >=2 uses ->
  emit once via `<body> <id> OP_DEFINE` and call via `<id> OP_INVOKE`.
- A call emits its arguments (reverse order, so the first parameter lands on top), then `<id> OP_INVOKE`;
  return values are left on the stack.
- The entry dispatcher validates that the selector is 4 bytes before `OP_INVOKE` (internal IDs are shorter,
  and `OP_INVOKE` hard-fails on unknown IDs), so external callers cannot jump to an internal subroutine.

`using for` and library functions resolve to the same subroutine machinery. See
[subroutine-extraction.md](./subroutine-extraction.md) for the optimizer that extracts hot internal blocks
(pushdata decode/encode, covenant construction) into shared subroutines (~60% bytecode reduction on the
benchmark set).

## 3. External function calls: `IFoo(addr).method(args)`

The shipped cross-contract model (full spec: [external-contract-calls.md](./external-contract-calls.md)).
EVM-parity dynamic dispatch realized as a co-spend covenant.

### Address = identity

`addr` is the **35-byte P2SH32 locking bytecode** of the callee (`OP_HASH256 <32> OP_EQUAL`). It can come
from a constructor/function parameter, a state variable, or be contract/interface-typed; the callee's master
UTXO (and any required data NFTs) are co-spent in the same transaction.

### On-chain dispatch verification

`emitExternalCallVerification` (GenerateTargetTraversal ~9813) emits, per call slot:

1. **Identity (all modes):** `OP_UTXOBYTECODE(B_master_input) == expected_addr`, where `expected_addr` is
   `OP_PICK`'d from the address parameter (`slot.addressParam`). Because B's master self-pins its own
   category+capability (Stage 1/2 self-pin), a matching address means the co-spent UTXO is the genuine
   master holding genuine state - no caller-side category check needed.
2. **Minting-capability check (`call`/`delegatecall` modes):** `OP_UTXOTOKENCATEGORY`, split off the
   capability byte, require `0x02` (minting). Stops substitution of event/return NFTs (same base category,
   `none` capability) as fake targets.
3. **Master preservation (`regular`/`staticcall`):** input locking bytecode == output locking bytecode, and
   input token category == output token category (the callee survives the spend unchanged).
4. **Selector (`regular`, only when the callee exposes >1 callable function):** selector-first design - the
   selector is the first push in B's unlocking bytecode; extract the 4 bytes and `OP_EQUALVERIFY` against the
   per-slot `__internal__externalCallSelector[N]` witness param.
5. **Commitment preservation (`staticcall`):** every required data-NFT commitment input == output.

### Return values

A returning callee emits a **return-event NFT**: category-bound to B's master (base 32 bytes), `none`
capability, FT amount 0, `OP_TRUE` (anyone-can-spend) locking bytecode, satoshis <= 1200 (dust). The caller
reads its commitment at the witness index `__internal__externalReturnOutputIdx[N]` via
`OP_OUTPUTTOKENCOMMITMENT` and decodes the pushdata-framed fields. Single value, multi-value tuple
(destructured `(a, b) = IFoo(addr).f()`), and forward-looking opaque `bytes` are all supported.

### What is compile-time vs runtime

Compile-time today: the callee TYPE (interface or contract - resolved via `getCalleeFunctions`, which reads
both the interface and contract registries), the called function, the return shape, the data-NFT count (for
the input-base offset; a wrong count is fail-loud at the identity `OP_EQUALVERIFY`, never silently unsound).
Runtime witness params (SDK-filled): the input base (`__internal__externalCallInputBase`), the selector, and
the return-output index. Section 10 is about making the compile-time set dynamic too.

### Address sources (all sound via the same dispatch)

- **Parameter:** `IFoo(addrParam).m()` - caller supplies the address at unlock time.
- **State variable:** `IFoo stored; ... stored.m()` - a pre-semantic transform
  (`SynthesizeExternalAddressLocals`) rewrites it to `IFoo __extaddr_stored = stored; __extaddr_stored.m()`,
  reading the address from self-pinned state at entry, reusing the parameter path unchanged.
- **Value transfer:** `IFoo(addr).m{value: sats}()` enters `call` mode and adds a satoshi-transfer output to
  the callee (section 7).

## 4. `staticcall` and `outState` (read-only external access)

`ExternalCallMode.STATICCALL` is a regular external call that additionally preserves **all** of the callee's
NFT commitments (input == output) and skips selector verification - the callee is observed, not mutated.

`IFoo(addr).outState.field` is the read accessor: co-spend B and read its post-execution committed state
directly off the output commitment (`OP_OUTPUTTOKENCOMMITMENT` + pushdata decode), with multi-data-NFT
`nftIndex`-tag verification to prevent sibling substitution. This is the idiomatic on-chain "read another
contract" and the building block for an on-chain bounded multi-read.

For **pure off-chain reads, do not use a contract at all.** Contract state on BCH is UTXO token commitments;
a client reads N contracts by fetching N UTXOs in one Electrum/Fulcrum batch and decoding locally - no
co-spend, no fee. The EVM `MultiCall` pattern exists to batch `eth_call`s, a limitation BCH does not have.

## 5. Low-level calls: `addr.call/staticcall/delegatecall{value:}(data)`

`LowLevelCallNode` - `addr` is any address-typed value (parameter, state variable, `msg.sender`, ...). The
no-option form parses as a namespaced function call; the `{value:}`/`{gas:}` form arrives as a method call.

- `call` / `staticcall`: read the co-spent target's unlocking bytecode (`OP_INPUTBYTECODE` at the call's
  input index), skip the push prefix, and `OP_EQUALVERIFY` the next `data.length` bytes against the provided
  `data` - i.e. the target must actually be spent running exactly that calldata. Yields `(true, remaining)`,
  where `remaining` is the leftover unlocking bytecode after the payload. Note: unlike EVM, `returnData` is
  NOT the callee's return value (use an external function call with declared return types for that).
- `delegatecall`: no calldata verification (the delegate self-verifies via `_proxyMasterIndex`); returns a
  placeholder `(true, "")`.
- `{value: sats}`: `emitValueTransfer` adds a satoshi-transfer output to the target - the BCH equivalent of
  sending ether. Works on parameter, local, and state-variable addresses.

## 6. `delegatecall` (proxy + implementation)

The `delegate` modifier marks a function on the implementation (delegate) contract that runs against a
proxy's state. The proxy holds the state and a minting NFT; the delegate holds the logic.

- The proxy's master input index is passed as `_proxyMasterIndex`, saved to the altstack at function entry.
  `emitMasterInputIndex` (GenerateTargetTraversal ~10261) reads it back with `FROMALTSTACK DUP TOALTSTACK`
  in delegate mode (so all ~20 state-access ops target the proxy's index), versus `OP_INPUTINDEX` otherwise.
  The delegate's own self-preservation uses the real `OP_INPUTINDEX`.
- `emitDelegateSelfPreservation` verifies the delegate's own locking bytecode, value, category, capability,
  commitment, and FT amount are preserved (the delegate is co-spent but must survive unchanged).
- Blocked modifier combinations (SymbolTableTraversal ~1853): `delegate` with any of `unsafe`, `upgrade`,
  `selfdestruct`, `deploy`, `delegatecall`, `internal`/`private`, `pure`, `view`.

## 7. Call options `{value, gas, salt}`

- `value`: a satoshi transfer to the call target (real; pre-scanned to a `valueTransferIndex`).
- `gas`: accepted for Solidity-source compatibility; BCH has no gas metering (cost is a per-tx op-budget), so
  it is a no-op.
- `salt`: CREATE2/CREATE3-style deployment salt (used by `deployFrom` / deploy-modifier functions).

## 8. SDK responsibilities: discovery, never enforcement

The SDK auto-derivation engine (`StatefulContract._deriveFullTransactionState`) VM-simulates the spend to
discover the witness data that makes the script pass: it co-spends callees (resolved by `interfaceName` via
`_externalRegistry`, or explicitly via `.withExternalCall`), extracts expected commitments from the VM trace
(`extractCommitmentsFromTrace`, scanning `OP_OUTPUTTOKENCOMMITMENT` + `OP_EQUALVERIFY` pairs, last-write-wins),
and fills the return-output and input-base indices.

The dividing line, restated because it governs every design choice: **the SDK finds the witness that makes
the script pass; the script defines what "pass" means.** Responsibility for correctness can be delegated to
the SDK; responsibility for *enforcement* cannot - there is no third place for it to live.

## 9. Soundness invariants (the load-bearing set)

- **Self-pin:** only genuine category-C UTXOs are spendable, so a matching address implies genuine state.
- **Integrity binding:** any value a covenant acts on provably came from the actually-co-spent target
  (identity `OP_EQUALVERIFY` + category-bound return event). This is non-negotiable; without it a "call"
  degenerates into a parameter.
- **Script is sole arbiter:** unchecked == unconstrained.
- **Co-spend liveness:** targets are real inputs, recreated for reads; the tx grows with N.

## 10. Forward design: generic (allowlist-free) dynamic dispatch

DESIGN, not yet implemented. Goal: drop the compile-time rigidity on callee type / function / return shape so
the SDK can supply them at build time, without surrendering soundness.

### Policy vs mechanism

Two constraints get conflated under "constrain the call." Separate them:

- **Policy (which target is allowed):** droppable. Parameter-typed targets are already unconstrained in
  identity; an allowlist only ever applied to state-held targets. Dropping it makes state-held targets behave
  like parameter targets. This is the EVM stance: mechanism, not policy.
- **Integrity (the result provably came from the witnessed target):** NOT droppable - see section 9.

So generic dispatch = target is any witnessed address; function/args are witness-supplied; return is opaque
`bytes` (or a witness-supplied shape); the script still enforces `OP_UTXOBYTECODE(input_i) == witnessed_addr`,
binds the return event's category to that co-spent input, and matches the selector against the callee's
attestation - but applies **no sanctioned-set check**.

The calldata is NOT opaque: `data = selector(4) || abi-encoded args`. The selector identifies the function, so
when the target's ABI is known at build time (the common case - a dApp aggregating calls to contracts it knows)
args and the return decode to TYPED values, not raw `bytes`; the SDK builds the callee unlocker from `data` and
the caller can use a typed result. Only a genuinely-unknown-ABI target degrades to opaque-bytes forwarding (the
4-byte selector is a non-invertible hash, so arg/return types can't be recovered) - and even then the call
works, with the callee decoding its own args and the caller treating the return as opaque `bytes`. This is why
`targets[i].staticcall(data[i])` (MultiCall) and `transaction.to.call{value}(transaction.data)` (MultiSigWallet)
are **implementable** under this design (co-spend the target(s) - the array-of-targets co-spend already exists,
section 4 / array-external-calls - plus runtime-selector dispatch), not fundamental EVM-only patterns. The
residual work is runtime-selector dispatch codegen + SDK typed-calldata decode.

### Guard regions: `before` / invoke / `after`

There is no temporal invoke, so "pre/after" is about **which facts a predicate references**, not when it
runs - all `OP_VERIFY`s must pass for the one flat tx to be valid:

- **pre-invoke region:** predicates over inputs and witnessed params (`addr`, `selector`, `args`, A's
  self-pinned pre-state).
- **invoke:** the mandatory integrity bind -> an integrity-bound `result`.
- **after-invoke region:** predicates over `result`, callee effects (`outState`, transfers, outputs), and A's
  pinned post-state.

Because ordering between independent verifies is immaterial to validity, the entire EVM reentrancy class is
structurally absent - this is stronger than EVM hook discipline, not a weaker imitation. The allowlist, if an
author wants one, becomes an ordinary pre-guard (`require(addr == this.owner)`), not a language primitive.

Emitted shape:

```
pre:    <author require()s over single-bound addr / selector / args / this.preState>
invoke: <verify UTXOBYTECODE(input_i)==addr; bind return-event category to input_i; selector==attested>
              -> result : bytes        // integrity-bound, never raw witness
after:  <author require()s over result / callee effects / this.postState>
covenant continues, using result
```

### The four compiler guarantees (where the safety lives)

1. **Value identity across the boundary.** The `addr` a pre-guard constrains must be the same single-bound
   stack value the dispatch verifies - not a second witness read. This is the #1 silent-bypass and the main
   reason to do this compiler-side rather than as a hand-written pattern.
2. **Integrity-before-after.** The `result` handed to the after-region is the category-bound one. Post-
   conditions on fabricated data are worthless.
3. **Guards are verify-effecting and undroppable.** The optimizer must not drop a guard whose boolean looks
   unused; a dropped guard is a removed check.
4. **Atomicity.** Guards + dispatch + A's post-state are one script; valid only if all hold together.

### The meta-guard (freedom without footguns)

Taint-track the dynamic `result`. If it flows into a covenant-load-bearing position (a branch, a state write,
a transfer amount, a require condition) AND the target is not authenticated (no `checkSig`/equality pinning
`addr` in the pre-region) -> warn (or require an explicit acknowledgement). If it only flows to a non-load-
bearing output (an event blob, a forwarded payload) -> full freedom, no guard required. Mechanism mandatory,
policy opt-in, trusting-unauthenticated-data the one thing the compiler refuses to allow silently.

### Limits (do not oversell)

- **Integrity != validity.** The compiler can prove `result` came from `addr`; it cannot prove `addr` told
  the truth. Calling an evil contract and trusting an honest-looking return is the author's risk; pinning
  `addr` in a pre-guard is the only cure.
- **Opaque `bytes` limits after-guards to structural facts** (length, hash, equality, decode-then-check).
  Richer post-conditions need the witness-shape path.
- **Value-identity tracking is the careful part** when `addr`/`args` flow through transformations.

### Adversarial test matrix (the merge gate)

Negative tests are the feature; happy-path e2e proves nothing here. Each must make the spend FAIL: return
fabrication without co-spending the target; target substitution at the claimed index; return-event category
forgery; double-read value-identity bypass; dropped-guard via optimizer; raw-witness result reaching an
after-guard; unauthenticated result reaching a load-bearing position.

## 11. EVM parity at a glance

| Concept | EVM | SolidCash / BCH |
|---|---|---|
| Internal call | `JUMP` within frame | `OP_INVOKE` subroutine (synchronous, one script) |
| External call | `CALL` (runtime delivers) | co-spend + introspection covenant (no delivery) |
| Return data | returndata buffer | return-event NFT commitment, decoded by caller |
| `staticcall` | no-state-change call | `STATICCALL` mode (all commitments preserved) + `outState` |
| `delegatecall` | callee code on caller storage | `delegate` modifier: delegate logic on proxy state |
| Send value | `call{value:}` | `{value:}` -> satoshi-transfer output |
| Reentrancy | real hazard; needs guards | structurally absent (flat atomic tx) |
| MultiCall (reads) | batch `eth_call` workaround | off-chain UTXO batch fetch (no contract) |
| `(bool,bytes)=addr.call(payload)` | reflective, runtime | integrity-bound co-spend; opaque return read from the return event (section 12) |

## 12. Status

Shipped and VM-verified (mocknet + regtest): internal subroutine calls; external function calls (parameter,
state-variable, interface- and contract-typed targets) in `regular`/`call`/`staticcall` modes; single, tuple,
and `outState` returns; low-level `call`/`staticcall`/`delegatecall`; value transfer; `delegatecall` proxy
pattern. See `external-contract-calls.md` for the per-feature test inventory.

Shipped (generic dynamic dispatch, EVM-parity surface, VM-verified - e2e `CallReturn.test.ts`):
`(bool success, bytes data) = addr.call(payload)` where `payload` is built with
`abi.encodeWithSignature`/`abi.encodeWithSelector`. This **expression form** is an identity-bound
(`OP_UTXOBYTECODE == addr`) co-spend whose `data` is read as a single opaque `bytes` blob from the
integrity-bound return event (`success` is always true - integrity failures fail the spend). The statement
form `addr.call(payload);` stays fire-and-forget (the existing low-level call). The callee, function and args
are supplied at build time via `.withExternalCall(callee, fn, args)`. Verified e2e: real-return read,
genericity (the same caller dispatches to two unrelated callee types), the opaque result used in a covenant
decision (`require`), target-substitution rejection, and the inline `abi.encodeWithSignature` surface
compiling. MVP limitations:
- **Selector pinning deferred.** A co-spent single-function callee's unlocking carries an internal functionId,
  not the 4-byte abi selector, so on-chain "which function" verification needs dispatch-level work. The
  `payload` is not yet verified on-chain against the callee's calldata; the integrity that IS enforced is the
  target identity plus the return-event category binding (both reused, audited mechanisms).
- **Real-return-to-`bytes`-state-var.** Storing the opaque return directly into a variable-length `bytes`
  state var hits an auto-derivation convergence edge (the field length depends on the dynamically-read blob).
  Use a fixed-size derivation of it (hash/length) or forward it.

Designed, not built: the `before`/`after` guard regions, the four compiler guarantees, the taint meta-guard,
witness-shape (typed) returns, on-chain payload/selector pinning, `staticcall`-with-return, and the bounded
multicall loop (section 10). The adversarial test matrix is the acceptance gate for that work.
