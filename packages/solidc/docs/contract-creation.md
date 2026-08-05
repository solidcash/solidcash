# Contract creation: create / create2 / create3 on BCH

EVM has three creation primitives. All three are supported in SolidCash, mapped to BCH's UTXO + CashToken
model. The central mechanism is the **self-pin**: a stateful contract's redeem script is prefixed with
`<cat||0x02> OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_EQUALVERIFY`, so its p2sh address commits to its token
category. A salt (create2) composes *outside* that: `<salt> OP_DROP | <self-pin> | <base redeem>` (the same
layering the SDK's `Contract` uses). The token **category** is, by consensus, the genesis transaction's
input-0 outpoint (the funding UTXO txid) - it cannot be a free-chosen value.

## The fundamental constraint

A stateful (token-bearing) child's identity = its category = the funding outpoint = unique per deploy. That
is inherently **CREATE-like** (EVM CREATE's nonce-based uniqueness). EVM CREATE2/CREATE3 give a *redeployable*
address independent of nonce; for a token-bearing contract that can't be literal (the category is the
outpoint), so the salt becomes either a composed *address* segment (create2) or a logical *key* (create3),
honoring - not bypassing - the self-pin.

## The three modes

| | **Stateless** (`bytes lbc = new T(...)`, p2sh, no token) | **Stateful** (`new T()` mints a token genesis) |
|---|---|---|
| **create** | `new T(args)` -> address = `hash(args+bytecode)`, content-addressed, deterministic | `new T()` -> category = funding outpoint, deterministic per deploy ✓ |
| **create2** | `new T{salt}(args)` -> `<salt> OP_DROP \| base` -> deterministic, salt-distinguished address | `new T{salt}()` -> `<salt> OP_DROP \| <self-pin> \| base`; salt composes with the self-pin |
| **create3** | a factory minimal-proxy keyed by salt (code-independent address) | factory `mapping(salt => categoryId)` -> a salt-keyed registry of children (the SDK create3 pattern) |

## How each is realized

- **create** - `new T(args)` (`emitContractDeployment`, `GenerateTargetTraversal.ts:6528`). Stateless: redeem
  -> `OP_HASH256` -> p2sh32. Stateful: prepend the self-pin, register the genesis-minting deploy covenant.
  The `deploy` modifier is inferred from `new StatefulContract()` (the keyword is optional).
- **create2** - `new T{salt}(args)`. The salt is honored (no longer cleared): codegen bakes the outermost
  `<salt> OP_DROP` segment (step 2.5, after the self-pin), so the address is deterministic from
  `(bytecode, args, salt[, category])`. Parity with `new Contract(artifact, args, { salt })` is exact
  (e2e: ContractDeployment.test.ts "create2"). For stateless this is the full EVM create2; for stateful the
  category already provides per-deploy determinism, with the salt as an extra composed segment. A stateful
  `new C{salt}()` deploys end-to-end via `deployFrom`: the compiler records the salt per deploy target
  (`deployTargets[].salt` = a forwarded param name, a hex literal, or `{ computed: true }`), and `deployFrom`
  derives it (or takes an explicit `childSalt`) and builds the child `Contract` with it, so the SDK-supplied
  genesis address equals the covenant's.
- **create3** - a factory may use a salt-keyed registry, but `deployFrom` requires an explicit typed `new T()` so
  the covenant can authenticate the supplied child artifact and layout. A typed stateful child deployment that
  also accesses a C2 mapping currently rejects before broadcast because both layouts claim the first trailing
  output slot. This combination remains deferred until those regions are separated.

For every supported stateful child deployment, the covenant requires exactly one child minting NFT and exactly
the child's declared number of mutable data NFTs. Missing, duplicated, reordered, or redirected child genesis
outputs are rejected. An SDK call cannot substitute an arbitrary `childArtifact`: a deploy entry point without a
typed `new Contract(...)` target fails before transaction construction.

## Conditional and loop deploys (`if (c) new C()`, `for (i<n) new C()`)

A `new C()` inside a branch or loop can't use the fixed block-layout deploy slot the straight-line epilogue
uses: when a branch is not taken there is no genesis output, and a loop mints a runtime-variable count. So a
`scopeDepth > 0` deploy is verified **inline** at the creation site (`emitInlineDeployVerification`), so the
genesis checks run exactly when/each-time `new C()` runs.

- **Conditional (`if (c) new C()`)** - a single deploy lands at the same fixed slot as an unconditional one when
  it fires (deploy is the trailing output region), so no counter is needed. SDK: `factory.fn(...).deploy({...})`
  (or awaiting it) co-spends the child for the firing case; `factory.fn(...).send()` / `.build()` is the
  **non-firing** call (a plain state write - the covenant verifies no child). Calling `.send()` when the branch
  *would* fire yields a tx the covenant rejects, so it stays sound.
- **Loop (`for (i<n) new C()`)** - the deploy count is runtime-variable, so genesis input/output indices are
  offset by a runtime deploy counter (deploys-fired-so-far): input `= masterInputIndex + inputBase + counter`,
  master output `= masterInputIndex + slotBase + counter*stride` (`stride = 1 + child dataNftCount`). The counter
  is a stack var pushed before the loop's `OP_BEGIN`, incremented in place per iteration, dropped after
  `OP_UNTIL` (covers `for`/`while`/`do-while`). Both the self-pin **address** (step 2) and the covenant
  **verify** (step 4) read the same counter-offset input, so child k self-pins to genesis input k.
  - SDK: `deployFrom({ fundingUtxos: [u0, u1, ...] })`. A contract block is **balanced**, so N deploy output
    groups need **N balancing funding inputs** (any value, each vout 0); child k's category = `fundingUtxos[k]
    .txid`. deployFrom builds N child `Contract` instances (the self-pinned address is category-dependent), adds
    N inputs + N child output groups, and N child placeholders to the VM probe. The child commitment is shared
    (same child type each iteration). VM-proven at N=2 in `CondDeployRuntime.test.ts`.

Guards (raise a clean `ConditionalDeployError` - fail closed, never an unsound covenant): more than one deploy
site in the function, a `{value:}` transfer on the deploy. Straight-line deploys keep the proven fixed epilogue,
byte-for-byte.

## Value and token transfers on deploy

A deploy function can move funds from the factory to the freshly-created child (or any recipient) in the same
transaction:

- **Satoshis** - `new Child{value: V}()` transfers `V` sats from the factory's satoshi container to the child.
  Straight-line, conditional (`if (c) new Child{value:V}()`), and loop (`for (i<n) new Child{value:V}()`) forms
  work. SDK: `deployFrom({ childValue: V })`; the factory must have been deployed with `initialBalance >= V`.
- **CashTokens** - a deploy function that does `this.tokens[cat].transfer(recipient, amt)` co-spends the factory's
  token container, recreates it with the remainder, and sends `amt` to `recipient` (pass the new child's address
  to fund it). SDK:
  `deployFrom({ tokenContainerCategoryIds: [cat], childTokenTransfers: [{ categoryId: cat, to, amount }] })`.
  `to` is the recipient locking bytecode (a raw p2sh32/p2pkh script, or a token-aware address).

Both are covenant-enforced: the container's own output is self-preserved (locking bytecode + value/amount) and
each transfer output is pinned (recipient + amount + category), so a caller cannot redirect the container's
remaining balance to a foreign address - adversarially VM-proven in `SatoshiContainer.test.ts` /
`TokenContainer.test.ts`. Not yet wired in a single deploy: combining a satoshi and a token transfer, and NFT
container transfers (both fail closed).

## Why no literal CREATE2/CREATE3 redeployable address for stateful contracts

The category = genesis outpoint is consensus-fixed and unique per genesis tx, so the *same* (code, salt) can
never resolve to the *same* token category across deploys (unlike EVM, where CREATE2 lets you redeploy to the
same address after selfdestruct). The self-pin binds the address to that category. create2's salt therefore
shifts the address deterministically but does not free the category; create3's determinism is a salt->category
registry lookup, not a recomputable on-chain address. This is the sound BCH analogue, and it honors the
self-pin rather than working around it.
