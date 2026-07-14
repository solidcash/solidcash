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
- **create3** - a `deploy` factory writes `mapping(salt => categoryId)` (no `new T()`); `StatefulContract
  .deployFrom` mints the child whose category is the funding-UTXO txid and records `children[salt] =
  categoryId` as an entry NFT. The salt is the user-chosen logical key; the lookup `factory.children[salt]`
  is the deterministic handle. See DeployFromContract.test.ts `CREATE3_FACTORY`.

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

## Why no literal CREATE2/CREATE3 redeployable address for stateful contracts

The category = genesis outpoint is consensus-fixed and unique per genesis tx, so the *same* (code, salt) can
never resolve to the *same* token category across deploys (unlike EVM, where CREATE2 lets you redeploy to the
same address after selfdestruct). The self-pin binds the address to that category. create2's salt therefore
shifts the address deterministically but does not free the category; create3's determinism is a salt->category
registry lookup, not a recomputable on-chain address. This is the sound BCH analogue, and it honors the
self-pin rather than working around it.
