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

## Predicting a child's address (SDK look-ahead)

A contract that creates another contract needs the child's address before the transaction is built, because the
parent's own code and its caller both depend on it. The address is `addrV(category)`, and a category is created
by spending a genesis-eligible UTXO - one at output index 0 the SDK can spend. So the SDK looks ahead: it
**reserves** one genesis-eligible UTXO per child the caller says it will create and answers with the address the
reserved UTXO's category derives, without broadcasting anything.

    const lookahead = CreateLookahead.open({ signer, artifact: childArtifact });
    await lookahead.reserve(4);                       // four children
    const address = lookahead.getCreateAddress(n + i); // nonce n + i -> the i-th reserved UTXO
    // deploy the i-th child with lookahead.getFundingUtxo(n + i) as its funding UTXO

The mapping is the EVM `getCreateAddress({ from, nonce })` one: nonce `n + i` is the i-th reserved UTXO, with `n`
the signer's nonce when the first reservation was made. A deployment for nonce `n + i` **must spend exactly that
UTXO**, so the child's category - and therefore its address - is the predicted one. A reserved UTXO is held out
of the SDK's genesis funding selection until `release()`, so a later send cannot spend a coin an address was
already derived from.

## Preparing genesis-eligible UTXOs

Predictions need the coins to exist first, so the account that deploys the children must be able to supply one
**genesis-eligible** UTXO per child. A UTXO is genesis-eligible when all of these hold:

- its output index is `0` - a token category is the genesis transaction's input-0 outpoint, and the input is the
  coin's own outpoint, so the coin must sit at vout 0;
- it carries no tokens;
- the account can spend it;
- it holds enough satoshis for the child's own genesis (the SDK computes the minimum from the child's bytecode and
  its data-NFT count in `selectGenesisFundingUtxo`) and enough to pay for the fan-out below;
- no caller has reserved it for another create.

Two ways to satisfy that, in order:

1. **Have one.** The SDK's genesis funding selection already prefers an existing vout-0, token-free coin the
   account can spend, so an account funded with such coins deploys without extra transactions.
2. **Let the deploy fan one out.** A deploy strands its change at a non-zero output, so an account that deploys
   several contracts would otherwise run out of vout-0 coins. When the account has no eligible coin but does hold
   spendable token-free satoshis, the deploy self-sends them into a fresh vout-0 output at the account's own
   address (a plain P2PKH transaction that is valid on any provider) and uses that coin, paying a small fee. This
   is what makes sequential deploys from one account unbounded: one large token-free coin is enough.

If neither holds, the selection refuses and the error says so; fund the account with more spendable, token-free
satoshis, or deploy fewer children.

Reservations take part in both paths. A coin reserved through `CreateLookahead` is excluded from the genesis
funding selection and from the fan-out, so a deployment that is not the one the nonce names cannot spend a coin
an address was already derived from - which is what keeps a prediction true. Release the reservation (`release()`)
once the children are deployed, or keep the look-ahead open for as long as addresses are predicted.

The order a caller follows is: reserve as many coins as children, predict each child's address from its nonce,
then deploy each child with `getFundingUtxo(nonce)` as its funding UTXO. `reserve()` tops up rather than replacing,
and the base nonce is fixed at the first `reserve()`, so nonces predicted earlier stay valid across top-ups.

A caller that only predicts addresses — a ported deployment script reading `getCreateAddress({ from, nonce })`, or
any call that names an account and a nonce — reaches the same reservations without handing over a coin: reading the
account's nonce opens its look-ahead and reserves a small window of genesis-eligible coins, each prediction answers
from that window, and a deployment whose nonce the window covers spends the coin its prediction named. Outside the
window — a script that predicts more addresses than the window holds, or an account with no nonce read — preparing
these coins is the caller's responsibility, as above.

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
  also accesses a vmap mapping currently rejects before broadcast because both layouts claim the first trailing
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

## Deployer coins

A stateful contract compiled with `deployer: true` carries a one-shot **Deploy<C>** program in its artifact.
The SDK deploys that instance through it: the prep transaction mints the deployer coin, and the creation
spends it. A plain compile has no deployer and keeps today's genesis. A contract that cannot have a deployer
records the reason in `artifact.deployerUnsupported` and warns; a top-level deployment of it uses today's
genesis.

Inside a creator, a `new` of a stateful direct child is a **deployer `new`**. Its syntax separates the two
kinds of parameter:

```solidity
new C{args: (a1, a2), value: v}(c1, c2)   // contract parameters a1, a2; constructor arguments c1, c2
new C{args: a1}()                          // one contract parameter; a constructor without parameters
new C(c1)                                  // C has no contract parameters
```

`args` gives every contract parameter of C in declaration order; the parentheses give the constructor
arguments. When C has both kinds of parameter, `args` is required. When C has contract parameters and its
constructor has none, `new C(a1, …)` still means `new C{args: (a1, …)}()` and the compiler warns, suggesting
the explicit form. `value` moves satoshis into the child's satoshi container (below). `salt` is refused on a
deployer `new`: the child's redeem must start with its category pin.

**The prep, one per child.** A transaction creates category `X` only by spending output 0 of transaction `X`,
so each child needs a parent transaction of its own:

| Index | Input | Output |
| --- | --- | --- |
| 0 | the author's coins, or the change of the prep before it | Deploy<C> coin, `V_DEPLOY(C)` satoshis. `X` = this txid |
| 1 | | author coin, P2PKH: what the author brings to this child's creation |
| 2 | | change, when there is any. In a chain it pays for the next prep |

The SDK prepares the whole chain before broadcasting anything, so every category is known before the first
prep is sent, and arguments may name any of them. Each prep spends only coins whose unlocking nobody else can
alter, and the chain's coins are reserved from the SDK's coin selection.

**The creation, through a creator.** In this example the creator has one record and a satoshi container, and
C has one record and receives value `v`:

| Index | Input | Output |
| --- | --- | --- |
| 0 | creator master | creator master |
| 1 | creator record | creator record, new state |
| 2 | creator satoshi container | creator satoshi container, `v` less |
| 3 | Deploy<C> coin (prep output 0), spent by `create` | C's master, lock `M`, `X‖02`, RESERVE |
| 4 | author coin (prep output 1) | C's record: `X‖01`, starting state, RESERVE |
| 5 | funding | C's satoshi container, `v` |
| 6 | | change |

`OUTBASE`, the first output of C's genesis range, is `__internal__genesisOutputBase`; it is not required to
equal the deployer's input index. At top level the creator's rows are absent: the deployer is input 0, the
author coin is input 1, and output 0 is the category's identity output, followed by the publication output
when one is asked for.

**The constructor's environment.** `msg.sender` is the deploying wallet (`tx.origin`), as in Solidity.
`block.number` and `block.timestamp` come from the transaction's locktime, which is a lower bound, not the
mined block. The category is the prep transaction's txid, not `fundingUtxo.txid`; code that needs a category
or an address before a deployment builds the preps first and reads it from the result.

**Collisions and reuse.** A creator may declare functions named `create` or `sweep`; the deployer's own
entries are separate and are published as `create` and `sweep` in its ABI. Two deployer `new` sites may not
name the same callee expression. The author can reuse an unspent deployer coin whose author coin is still
unspent; after 1,440 blocks anyone may sweep it, so the author should create before then.

## Value and token transfers on deploy

`new C{value: V}(...)` moves `V` satoshis from the creator's satoshi container into C's satoshi container
before C's constructor runs. Inside the constructor, `msg.value` is `V`. `V` is 0 or at least RESERVE, the
constructor must be payable, and C must keep a satoshi container that its deployer pins; otherwise the
compile refuses the expression.

A payment made to a `new` result after the expression goes to the child's **container**, not to its master
lock:

- `this.transfer(child, n)` pays C's satoshi container lock for `(M, X)`;
- `this.tokens[t].transfer(child, n)` pays C's token container lock for `(M, X, t)`.

A child without the container in question is refused. A payment to any other stateful contract value is an
error: its address is the master lock, and a coin there can never be spent. Send through one of the
contract's payable functions instead.

`new` has no `tokens` option and never takes tokens from the creator. Each token container starts from the
least its coin can hold: 1 unit for a container C keeps **single**, whose coin the creation opens, and 0 for
any other, which has no coin at birth. A constructor may read `this.tokens[t].tokenAmount`; it cannot send
tokens or use any other member (`tokenCategory`, `nftCount`, `nftCommitment`, `transferNft`), and the compile
refuses it. A creator funds a child's non-single token containers with a transfer after `new`.

Under `pragma satoshicontainer single` and `pragma tokencontainer single`, the creation opens the coin at the
container lock and no other; a payment after `new` into such a container would make a second coin and is
refused (`second-coin-at-single-container`). Fund such a child through `value`, or call one of its functions
later.

## Why no literal CREATE2/CREATE3 redeployable address for stateful contracts

The category = genesis outpoint is consensus-fixed and unique per genesis tx, so the *same* (code, salt) can
never resolve to the *same* token category across deploys (unlike EVM, where CREATE2 lets you redeploy to the
same address after selfdestruct). The self-pin binds the address to that category. create2's salt therefore
shifts the address deterministically but does not free the category; create3's determinism is a salt->category
registry lookup, not a recomputable on-chain address. This is the sound BCH analogue, and it honors the
self-pin rather than working around it.
