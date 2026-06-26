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
- The native balance is freed to **output 0**, whose locking bytecode the covenant forces to equal `addr`.
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
  node.recipient = this.visit(node.recipient);   // [recipient_lb]
  this.emit(encodeInt(0n));                       // [recipient_lb, 0]
  this.emit(Op.OP_OUTPUTBYTECODE);                // [recipient_lb, output0_lb]
  this.emit(Op.OP_EQUALVERIFY);                   // []
}
```

Emitted Script (ASM):

```
<recipient_lb> OP_0 OP_OUTPUTBYTECODE OP_EQUALVERIFY
```

Optimized bytecode tail (the constant part): `... 00 cd 88` = `OP_0 OP_OUTPUTBYTECODE OP_EQUALVERIFY`.

This is the only difference between the statement form and the modifier-only form: the statement form contains
`OP_OUTPUTBYTECODE`; the modifier-only form does not.

### 5. Authorization guard (semantic)

`EnsureFinalRequireTraversal` requires stateful-contract functions to end in a `require()`. A selfdestruct
function with no trailing `require()` is rejected at compile time with `FinalRequireStatementError`:

```solidity
function kill(address to) { selfdestruct(to); }   // compile error: final statement must be require()
```

The compiler guarantees a `require()` exists so the covenant cannot be trivially bypassed; the **author**
supplies the real authorization condition inside it (for example `require(checkSig(s, admin))`). The guard does
not by itself prove the require is a meaningful auth check (`require(true)` would pass the guard), which is why
v1 is documented as author-trusted. See "Authorization and security" below.

## The on-chain covenant

When the selfdestruct function is spent (on the master input), the contract Script:

1. Runs the collapse logic from the `SELFDESTRUCT` modifier (co-spend and destroy all state UTXOs).
2. Runs the author's `require(...)` authorization.
3. Runs the destination covenant: `tx.outputs[0].lockingBytecode == addr`.

The covenant pins only the **locking bytecode** of output 0, not its value. The SDK builds output 0 with the
entire reclaimed balance (see below), so in the SDK-driven flow the full balance reaches `addr`. The value is
not enforced on chain in v1 (see "Roadmap: v2 hardening").

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

## Authorization and security

- **v1 requires a trailing `require()`.** Without it, the function is rejected. The covenant code (collapse plus
  destination pin) cannot run unguarded.
- **The author owns the auth condition.** A selfdestruct that should be admin-only must check a signature
  (`require(checkSig(s, admin))`). A selfdestruct that should be permissionless still needs *some* require; see
  the value-pin caveat below before making it open.
- **v1 does not pin output 0's value.** The covenant fixes the destination address but not the amount. With the
  mandatory `require()` acting as a gate and the SDK building output 0 with the full balance, the SDK-driven
  flow is sound. A hand-crafted transaction by an authorized caller could place dust at `addr` and route the
  rest elsewhere; this matters only if you intend to remove the auth gate and let anyone trigger destruction.
- **Tokens are not protected.** Any FT/NFT not swept by contract logic before destruction is burned or stranded,
  matching EVM. Sweep deliberately.

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

- **Single-transaction destruction only.** The destination covenant pins `outputs[0]` to `addr` on every input
  that runs the selfdestruct function. `destroy()` falls back to a **batched** multi-transaction path when the
  UTXO count exceeds `maxInputsPerTx` (default 200); its intermediate transactions recreate the threaded master
  at output 0, which would violate `outputs[0] == addr`. So `selfdestruct(addr)` is only sound when the entire
  state fits in one transaction. Contracts with more than ~200 state UTXOs must either use the modifier-only
  `selfdestruct` form (no destination pin) or reduce their UTXO count before destruction.
- **Value not pinned (v1).** See "Authorization and security".
- **Argument type not constrained.** A non-locking-bytecode argument compiles but fails at runtime.

## Roadmap: v2 hardening

To support truly permissionless "anyone can sweep" destruction:

- Add `outputs[0].value >= this.balance` to the covenant so the freed value is forced to `addr`, not just the
  address. With value pinned, the trailing `require()` can be relaxed and the function opened to any caller.
- Optionally support batched destruction by pinning the destination only on the final transaction.

## Tests

- Compiler: `packages/solidc/test/PortingFixes.test.ts`, group `SBE-20`:
  - the modifier is implied in the ABI,
  - the statement form emits `OP_OUTPUTBYTECODE` while the modifier-only form does not,
  - an unauthenticated selfdestruct is rejected (`FinalRequireStatementError`).
- SDK e2e: `packages/solidcash/test/e2e/SelfdestructDestination.test.ts`: deploys with a balance, calls
  `selfdestructTo`, and asserts the freed balance lands at output 0 to the destination, the contract is
  collapsed (no minting NFT recreated), and `totalReclaimed` equals output 0's amount.
- The modifier-only path is covered by `packages/solidcash/test/e2e/Selfdestruct.test.ts`.

## File map

| Concern                         | Location                                                                 |
|---------------------------------|--------------------------------------------------------------------------|
| Grammar rule                    | `packages/solidc/src/grammar/SolidCash.g4` (`selfdestructStatement`)      |
| AST node                        | `packages/solidc/src/ast/AST.ts` (`SelfdestructStatementNode`)           |
| Parse to AST                    | `packages/solidc/src/ast/AstBuilder.ts` (`visitSelfdestructStatement`)    |
| Modifier implication            | `packages/solidc/src/ast/AstBuilder.ts` (`visitFunctionDefinition`)       |
| Traversal default               | `packages/solidc/src/ast/AstTraversal.ts` (`visitSelfdestructStatement`)  |
| Destination covenant codegen    | `packages/solidc/src/generation/GenerateTargetTraversal.ts` (`visitSelfdestructStatement`) |
| Collapse behavior               | `packages/solidc/src/generation/GenerateTargetTraversal.ts` (`visitFunctionDefinition`, `isSelfdestruct`) |
| Auth guard                      | `packages/solidc/src/semantic/EnsureFinalRequireTraversal.ts`            |
| SDK driver                      | `packages/solidcash/src/stateful/StatefulContract.ts` (`selfdestructTo`, `destroy`) |
