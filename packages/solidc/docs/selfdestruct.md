# selfdestruct(addr) in SolidCash

`selfdestruct(addr)` is the EVM-parity, function-based form of contract destruction. A `selfdestruct(addr)`
statement in a function body ends the contract's life: every state UTXO is collapsed (no master recreation),
and the contract's native satoshi balance is freed to an output whose locking bytecode is `addr`. Whoever
triggers it, the freed value can only land at `addr`.

This document specifies the syntax, the compiler pipeline, the on-chain covenant, the SDK driver, the
authorization model, and the current limitations. It is written against the implementation, not a proposal.

## TL;DR

```solidity
pragma solidcash >=0.8.0;

contract Vault(pubkey admin) {
  int balanceSheet;

  // `selfdestruct(to)` implies the `selfdestruct` modifier. The covenant pins tx.outputs[0] to `to`.
  function kill(sig s, address to) {
    require(checkSig(s, admin));   // mandatory auth: selfdestruct functions must end in a require()
    selfdestruct(to);
  }
}
```

SDK:

```ts
await StatefulContract.selfdestructTo({
  provider,
  contract: deployed,
  destroyFunctionName: 'kill',
  destroyFunctionArgs: [new SignatureTemplate(adminPriv), recipientAddress],
  recipient: recipientAddress,     // must resolve to the same locking bytecode as the `to` arg
});
```

- `selfdestruct(addr)` **implies** the `selfdestruct` function modifier; you do not write both.
- It collapses **all** state UTXOs (master, data NFTs, entries, events, containers). The master is **not**
  recreated. This is the contract's end of life.
- The native balance is freed to **output 0**, and the covenant pins it three ways: `outputs[0].lockingBytecode
  == addr` (the destination), the transaction has exactly one output (so the value cannot be siphoned to a
  second recipient), and the fee (`sum(inputs) - outputs[0].value`) is `< 2000` (so the value cannot be burned
  to miner fee). Together: at least `sum(inputs) - 2000` provably reaches `addr`. The destination is pinned by
  the covenant itself, not by a separate event/result NFT.
- Tokens are **not** swept. This mirrors EVM: tokens are the program's responsibility; untouched tokens get
  stuck (the status quo). Sweep them in contract logic before destruction if you need them.
- v1 keeps an **authorization guard**: a selfdestruct function must end in a `require()`. The author supplies
  real auth in that require.

## Semantics (EVM parity)

In EVM, `selfdestruct(addr)` deletes the contract account and sends its remaining Ether to `addr`; ERC-20 and
other token balances are unaffected and remain stranded at the now-dead address. SolidCash mirrors this on the
UTXO model:

| EVM                                   | SolidCash                                                            |
|---------------------------------------|---------------------------------------------------------------------|
| Contract account deleted              | All state UTXOs (master + data NFTs + entries + events) collapsed    |
| Remaining Ether sent to `addr`        | Native satoshi balance freed to output 0, pinned to `addr`          |
| Token balances untouched (stranded)   | Token containers untouched unless the program sweeps them first     |
| Anyone-callable if code permits       | Anyone-callable if the author's `require()` permits it              |

"Collapse" means the UTXOs are spent without being recreated. Data NFTs are spent through the covenant's
`flag=2` destroy path; entries through the `flag=1` write path (which already allows destruction); the master
minting NFT is consumed and never re-minted.

## Syntax and grammar

```
selfdestructStatement
    : 'selfdestruct' '(' expression ')' ';'
```

`selfdestruct` is a soft keyword: it is already valid in `anyIdentifier` and `functionModifier` positions, so
adding the statement form does not break identifiers named `selfdestruct`. The grammar rule lives in
`packages/solidc/src/grammar/SolidCash.g4` (rule `selfdestructStatement`, referenced from `statement`).

The argument is any expression that evaluates to a **locking bytecode**:

- an `address` value (in SolidCash an address is a 35-byte p2sh32 locking bytecode), or
- a constructed locking bytecode such as `new LockingBytecodeP2PKH(pkh)`.

The compiler does not currently constrain the argument type beyond visiting it; a non-bytecode argument simply
fails the `OP_EQUALVERIFY` against the output's locking bytecode at runtime.

## Compiler pipeline

### 1. AST

`SelfdestructStatementNode` (`packages/solidc/src/ast/AST.ts`) holds a single `recipient: ExpressionNode`.
`AstBuilder.visitSelfdestructStatement` (`AstBuilder.ts`) builds it from `ctx.expression()`.
`AstTraversal.visitSelfdestructStatement` visits the recipient so type-checking and other passes traverse it.

### 2. Modifier implication

After parsing a function's signature, `AstBuilder.visitFunctionDefinition` (`AstBuilder.ts`, near the
return-type handling) scans the body: if it contains a `SelfdestructStatementNode` and the function does not
already carry `FunctionModifier.SELFDESTRUCT`, the modifier is pushed onto the function. So the statement form
and the modifier form share one downstream code path; you never write both.

```ts
if (functionDefinition.body.statements!.some((s) => s instanceof SelfdestructStatementNode)
  && !functionDefinition.modifiers.includes(FunctionModifier.SELFDESTRUCT)) {
  functionDefinition.modifiers.push(FunctionModifier.SELFDESTRUCT);
}
```

### 3. The selfdestruct modifier's collapse behavior (codegen)

The `SELFDESTRUCT` modifier changes what covenant verification the function emits
(`GenerateTargetTraversal.ts`, `visitFunctionDefinition`):

- It needs **all** data NFTs co-spent regardless of body accesses (so nothing is left orphaned).
- It **skips** `emitAutoCovenantVerification` (data-NFT output verification): the NFTs are destroyed via the
  `flag=2` path instead of being recreated.
- It **skips** read-only entry preservation: all entries are destroyed, not preserved.
- It is the only modifier allowed to **drain** token/satoshi containers (output flags may differ; non-selfdestruct
  functions must preserve container outputs).
- The master minting NFT is not re-preserved: there is no recreation output for it.

This is the pre-existing modifier behavior, shared with the modifier-only `selfdestruct` form.

### 4. The destination covenant (codegen)

On top of the collapse, the `selfdestruct(addr)` **statement** emits a small covenant that pins the freed-value
output. `GenerateTargetTraversal.visitSelfdestructStatement`:

```ts
visitSelfdestructStatement(node) {
  // (1) Address pin: outputs[0].lockingBytecode == addr
  node.recipient = this.visit(node.recipient);   // [recipient_lb]
  this.emit(encodeInt(0n));                       // [recipient_lb, 0]
  this.emit(Op.OP_OUTPUTBYTECODE);                // [recipient_lb, output0_lb]
  this.emit(Op.OP_EQUALVERIFY);                   // []
  // (2) Value pin: exactly one output
  this.emit(Op.OP_TXOUTPUTCOUNT);                 // [outputCount]
  this.emit(encodeInt(1n));                       // [outputCount, 1]
  this.emit(Op.OP_NUMEQUALVERIFY);                // []
  // (3) Value floor: emitSelfdestructFeeFloor - sum all input values via an OP_BEGIN/OP_UNTIL loop, then
  //     require (inputSum - outputs[0].value) < 2000, bounding the fee.
}
```

Emitted Script (ASM):

```
<recipient_lb> OP_0 OP_OUTPUTBYTECODE OP_EQUALVERIFY            // address pin
OP_TXOUTPUTCOUNT OP_1 OP_NUMEQUALVERIFY                         // single-output pin
OP_0 OP_TXINPUTCOUNT OP_1SUB OP_BEGIN ... OP_UNTIL             // inputSum = sum of every input value
OP_0 OP_OUTPUTVALUE OP_SUB <2000> OP_LESSTHAN OP_VERIFY         // (inputSum - outputs[0].value) < 2000
```

Three differences from the modifier-only form: the statement form pins the destination (`OP_OUTPUTBYTECODE`,
which the modifier-only form lacks), pins the output count (`OP_TXOUTPUTCOUNT OP_1 OP_NUMEQUALVERIFY`), and
pins the fee (the input-sum loop plus `OP_OUTPUTVALUE OP_SUB ... OP_LESSTHAN`).

### 5. Authorization guard (semantic)

`EnsureFinalRequireTraversal` requires stateful-contract functions to end in a `require()`. A selfdestruct
function with no trailing `require()` is rejected at compile time with `FinalRequireStatementError`:

```solidity
function kill(address to) { selfdestruct(to); }   // compile error: final statement must be require()
```

The compiler guarantees a `require()` exists so the covenant cannot be trivially bypassed; the **author**
supplies the real authorization condition inside it (for example `require(checkSig(s, admin))`). The guard does
not by itself prove the require is a meaningful auth check (`require(true)` would pass the guard), which is why
v1 is documented as author-trusted. See "Security considerations" below.

## The on-chain covenant

When the selfdestruct function is spent (on the master input), the contract Script:

1. Runs the collapse logic from the `SELFDESTRUCT` modifier (co-spend and destroy all state UTXOs).
2. Runs the author's `require(...)` authorization.
3. Runs the destination covenant: `tx.outputs[0].lockingBytecode == addr`.
4. Runs the output-count covenant: `tx` has exactly one output (`OP_TXOUTPUTCOUNT == 1`).
5. Runs the fee covenant: `sum(input values) - outputs[0].value < 2000`.

Together, these pin the freed balance to `addr`. Step 3 fixes the destination; step 4 (single output) means the
value cannot be siphoned to a second recipient; step 5 (bounded fee) means the value cannot be burned to miner
fee. So at least `sum(inputs) - 2000` provably reaches `addr`, regardless of who builds the transaction. The
destination is enforced by the covenant itself, not by a separate event/result NFT.

The `2000`-sat fee cap is a fixed constant. A destroy transaction that genuinely needs a larger fee (very many
inputs) cannot satisfy the covenant - another reason `selfdestruct(addr)` is single-transaction-scale only
(see Limitations).

## SDK driver

`StatefulContract.selfdestructTo(options)` (`packages/solidcash/src/stateful/StatefulContract.ts`) is a thin
delegate to `StatefulContract.destroy(options)`; both take `DestroyOptions`. `destroy()` already implements
exactly the shape the covenant needs:

1. **Discover all UTXOs**: master(s), data NFTs, entry NFTs (per collection), event NFTs (best-effort, subject
   to CSV timelocks), the satoshi container, and any token containers named in `tokenContainerCategoryIds`.
2. **Add them as inputs**: the master is spent with the selfdestruct function's unlocker (carrying the author's
   args); each NFT/container is spent with its destroy unlocker.
3. **Single output**: in the single-transaction case, `destroy()` builds exactly one output
   `{ to: recipient, amount: totalInputSats - fee }`. That is **output 0**, with all reclaimed value and no
   change output. The covenant `outputs[0].lockingBytecode == addr` is satisfied because `recipient` is `addr`.

`recipient` (the SDK option) and the `addr` expression inside `selfdestruct(addr)` must resolve to the **same**
locking bytecode. In the TL;DR example the function takes `address to`; the caller passes that same address as
both the `to` arg (which the covenant reads) and as `recipient` (which becomes output 0). This coupling is
inherent: the author chose `to` as the destination, and the SDK must point output 0 at it.

## Security considerations

`selfdestruct(addr)` is a terminal, value-moving operation with no recovery. Read this before shipping one.

### What the covenant guarantees

When a `selfdestruct(addr)` function is spent, the VM enforces - independently of the SDK - that the transaction:

- has exactly one output,
- whose locking bytecode equals `addr`,
- with a fee (`sum(inputs) - outputs[0].value`) below 2000 sats.

So **at least `sum(inputs) - 2000` satoshis reach `addr`**, whoever builds the transaction. The freed balance
cannot be redirected to another recipient or burned to fee beyond the 2000-sat cap. This is the security
foundation everything below builds on.

### The destination must not be caller-controlled in a permissionless contract

This is the easiest mistake to make. The pins guarantee the balance reaches `addr` - but `addr` is whatever the
covenant reads at spend time. If the destination is a function argument and the function has no real
authorization, anyone can point it at themselves:

```solidity
// UNSAFE if permissionless: an unauthenticated caller passes their own address and takes the balance.
function kill(address to) { require(true); selfdestruct(to); }
```

The value pins faithfully deliver the balance to the address the caller chose - they protect *how much* reaches
the destination, not *who* the destination is. A selfdestruct that anyone may trigger must therefore take its
destination from contract state or a constant, where the caller cannot influence it:

```solidity
// Safe to leave open: the destination is fixed in state, not chosen by the caller.
address beneficiary;
function kill() { require(true); selfdestruct(this.beneficiary); }
```

If the destination is caller-supplied, gate the function with real authorization (e.g.
`require(checkSig(s, admin))`). The compiler emits a **warning** when it sees the dangerous shape - a
`selfdestruct(addr)` whose `addr` references a function parameter, in a function with no `checkSig` /
`checkDataSig` / `checkMultiSig` - so the trap is hard to ship by accident. It is a warning, not an error
(the author may authenticate by some other means), and it does not fire for the two safe forms above. A
signature check is used as the proxy for "authenticated" because on BCH it is the only primitive that
authenticates a *party* (covenant/introspection conditions authenticate transaction *shape*).

### The require() guard is structural, not semantic

The compiler only checks that a selfdestruct function ends in *a* `require()`, so the covenant cannot run
unguarded. It does not check that the condition is meaningful: `require(true)` passes. The author chooses the
authorization. For a permissionless contract `require(true)` is intentional, and safety then rests entirely on a
non-caller-controlled destination plus the value pins.

### A state-sourced destination is only as safe as its writer

`selfdestruct(this.beneficiary)` sends the balance wherever `beneficiary` points at spend time. Whoever can
write that state variable controls the destruction target. Authorize the state-write path with the same care as
the destruction itself - a permissive setter undoes a fixed-destination design.

### Tokens are not protected

The value pins cover native satoshis only. Any fungible tokens or NFTs the contract holds and does not sweep
before destruction are burned or stranded, matching EVM. Sweep them deliberately in contract logic first; the
selfdestruct will not move them for you.

### Destruction is irreversible and single-transaction-scale

The master minting NFT is consumed and never recreated - the category's minting capability is gone permanently.
The pins also require a single output and a sub-2000 fee, which a *batched* destroy (used when the state exceeds
~200 UTXOs, see Limitations) cannot satisfy: its intermediate transactions recreate the master and add outputs.
A contract that can grow past single-transaction scale may become **undestroyable** via `selfdestruct(addr)`.
Keep such contracts' UTXO count bounded, or use the modifier-only `selfdestruct` form (which has no pins and
supports batching, at the cost of an on-chain-enforced destination).

### Residual fee loss is accepted by design

The fee cap is a fixed 2000 sats. A triggerer can still cause up to 2000 sats to go to miner fee instead of
`addr` (by overpaying within the cap). This is negligible for any meaningful balance and not profitable for the
triggerer - the fee goes to the miner, not to them. It is the deliberate trade for bounding the fee with a
constant instead of modeling exact transaction size on chain. Raising the cap is a roadmap item.

## Modifier conflicts

`selfdestruct` (implied or explicit) cannot combine with modifiers whose covenants contradict collapse. The
following are rejected (`InvalidModifierCombinationError`, with fixtures under
`packages/solidc/test/compiler/InvalidModifierCombinationError/`):

- `pure`, `view` (a destruction mutates UTXOs)
- `internal`, `private` (selfdestruct is an externally triggered spend)
- `upgrade` (recreates the master with new code; opposite of collapse)
- `deploy` (creates a child contract)
- `unsafe` (covenant-skipping tiers are incompatible with the destroy verification)
- `delegate` (state verification is deferred to the delegate; collapse cannot be deferred)

It also requires a **stateful** contract (fixture `selfdestruct_not_stateful.scash`).

## Limitations

- **Single-transaction destruction only.** The covenant pins `outputs[0] == addr` **and** a single output on
  every input that runs the selfdestruct function. `destroy()` falls back to a **batched** multi-transaction
  path when the UTXO count exceeds `maxInputsPerTx` (default 200); its intermediate transactions recreate the
  threaded master at output 0 and add a reclaim output, violating both pins. So `selfdestruct(addr)` is only
  sound when the entire state fits in one transaction. Contracts with more than ~200 state UTXOs must either use
  the modifier-only `selfdestruct` form (no pins) or reduce their UTXO count before destruction.
- **Argument type not constrained.** A non-locking-bytecode argument compiles but fails at runtime.

## Roadmap

The destination and value are fully pinned (address + single output + fee floor), so a permissionless
selfdestruct is value-safe (see "Security considerations"). Remaining items:

- **Compiler-enforce permissionless safety (partly done).** A compile-time **warning** now fires on a no-auth
  selfdestruct whose destination is a caller-controlled argument (see "Security considerations"). Escalating it
  to an opt-in hard error, and tightening the "authenticated" heuristic beyond "contains a signature check",
  remain.
- **Configurable fee cap.** The 2000-sat cap is a fixed constant; let the author raise it for large destroys.
- **Batched destruction.** Support contracts above the single-transaction UTXO limit by applying the pins only
  on the final transaction of a batched destroy.
- **Constrain the argument type** to a locking bytecode at compile time, instead of failing at runtime.

## Tests

- Compiler: `packages/solidc/test/PortingFixes.test.ts`, group `SBE-20`:
  - the modifier is implied in the ABI,
  - the statement form pins the destination (`OP_OUTPUTBYTECODE`, absent from the modifier-only form), the
    output count (`OP_TXOUTPUTCOUNT OP_1 OP_NUMEQUALVERIFY`), and the fee (input-sum loop + `OP_OUTPUTVALUE
    OP_SUB`),
  - an unauthenticated selfdestruct is rejected (`FinalRequireStatementError`).
- SDK e2e: `packages/solidcash/test/e2e/SelfdestructDestination.test.ts`:
  - positive: `selfdestructTo` produces exactly one output carrying the freed balance to the destination, the
    contract is collapsed (no minting NFT recreated), and `totalReclaimed` equals output 0's amount,
  - negative (permissionless, no-sig contract, hand-built transaction with a positive control): a second output
    siphoning the value is rejected (output-count pin), and underpaying output 0 to leave a 5000-sat fee is
    rejected (fee floor).
- The modifier-only path is covered by `packages/solidcash/test/e2e/Selfdestruct.test.ts`.

## File map

| Concern                         | Location                                                                 |
|---------------------------------|--------------------------------------------------------------------------|
| Grammar rule                    | `packages/solidc/src/grammar/SolidCash.g4` (`selfdestructStatement`)      |
| AST node                        | `packages/solidc/src/ast/AST.ts` (`SelfdestructStatementNode`)           |
| Parse to AST                    | `packages/solidc/src/ast/AstBuilder.ts` (`visitSelfdestructStatement`)    |
| Modifier implication            | `packages/solidc/src/ast/AstBuilder.ts` (`visitFunctionDefinition`)       |
| Traversal default               | `packages/solidc/src/ast/AstTraversal.ts` (`visitSelfdestructStatement`)  |
| Destination + value-pin codegen | `packages/solidc/src/generation/GenerateTargetTraversal.ts` (`visitSelfdestructStatement`) |
| Fee-floor codegen               | `packages/solidc/src/generation/GenerateTargetTraversal.ts` (`emitSelfdestructFeeFloor`) |
| Collapse behavior               | `packages/solidc/src/generation/GenerateTargetTraversal.ts` (`visitFunctionDefinition`, `isSelfdestruct`) |
| Auth guard                      | `packages/solidc/src/semantic/EnsureFinalRequireTraversal.ts`            |
| SDK driver                      | `packages/solidcash/src/stateful/StatefulContract.ts` (`selfdestructTo`, `destroy`) |
