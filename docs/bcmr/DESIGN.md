# BCMR metadata at deployment: design

Kind: design, implemented in `packages/solidcash/src/bcmr/` (section 11 maps the code). Decisions taken on it are
recorded in `docs/framed/DECISIONS.md` (D32, D33, D46, D47, D48), and anything deferred in
`packages/solidc/docs/deferrals.md`; those ledgers win over this file. Written 2026-10-20 against master `769adb889`,
revised to the implementation the same day, and on 2026-10-21 for the authhead contract (D46 to D48).

Sources: CHIP-BCMR at `bitjson/chip-bcmr` commit `0e8417c` (2024-01-31), the CashTokens specification, the AuthGuard
standard (CHIP-2023-08, v0.1.2) and libauth 3.1.0-next.8 (`build/lib/engine/types/bcmr-types.d.ts`). Code is cited
by path and symbol, because line numbers drift. The findings about the code before this design (section 3) come from
reading it; no probe was run, per the repository's test rules.

## 1. Summary

Every stateful deployment mints a CashTokens category. BCMR gives that category an identity, and the identity's
authority is whoever spends output 0 of the category's genesis. In both compilation conventions that output was a
master before this design, which had two consequences:

- A registry published in the genesis stopped counting as soon as the first call spent that master.
- In the framed convention any caller could publish metadata for the category, because the validator does not
  constrain token-free outputs. Nothing was published, so the first person to try defined the token's name, symbol
  and icon.

The design:

1. Every genesis the SDK builds puts the category's authhead contract at index 0. Its owner is a lock outside the
   contract's state, and only the owner updates, transfers, freezes or burns the identity. This is the layout of
   every deployment, not an option (section 4).
2. A deployment can publish its registry in the genesis itself, at output 1 (section 5).
3. ERC-20-shaped tokens publish name, symbol and decimals checked against the contract before anything is
   broadcast, with the premint in the same genesis (section 6).
4. BCMR for a category a contract creates inside a call is unsupported; framed `new C()` and the framed proxy's
   calling genesis still lead with their own authhead (section 7).
5. A deployment can label its own NFTs for explorers (section 8).

## 2. The BCMR rules this design depends on

| # | Rule | Source | What it means here |
| --- | --- | --- | --- |
| R1 | The identity output of every transaction is its output 0. The authchain follows whichever transaction spends it, through any input. | BCMR "Zeroth-Descendant Transaction Chains"; "Authchain Extension", step 2 | Genesis output 0 holds the category's metadata authority. |
| R2 | Clients read the publication from the authhead, the transaction whose output 0 is unspent. The spec defines no fallback to an earlier transaction. | BCMR "On-Chain Metadata Registry Resolution" | A spend of output 0 that carries no publication leaves the identity without a registry, under a strict reading. |
| R3 | A publication output is `OP_RETURN <'BCMR'> <sha256> [<uri> ...]`, locking bytecode prefix `0x6a0442434d52`, at any output index. Only the first output with the prefix counts, even when it is malformed. | BCMR "Metadata Registry Publication Outputs" | The publication goes at output 1. Output 0 is never the publication. |
| R4 | A data-carrier output at index 0 of the authhead burns the identity. | BCMR "Burned Identities" | An `OP_RETURN` at output 0 is a deliberate burn, never a placement choice. |
| R5 | Symbols match `^[A-Z0-9]+[-A-Z0-9]*$`. The base symbol (before the first hyphen) should be 4 to 6 characters for fungible tokens. Clients flag a symbol that maps to another authbase or appears on a reserved list; the list includes BTC, BCH, USDT, USDC and DAI. | BCMR "Ticker Symbol Selection", "Adding and Updating Registries", `reserved-token-symbols-cryptocurrencies.json` | ERC-20 symbols need validating, and a port that reuses a famous symbol will be flagged. |
| R6 | HTTPS URIs are pushed without the protocol, and a bare domain means the well-known path. IPFS URIs keep `ipfs://`. | BCMR "HTTPS Publication Outputs", "IPFS Publication Outputs" | URI encoding rules for the SDK. |
| R7 | Reserved (unissued) supply is the fungible amount held in UTXOs that also carry a minting or mutable NFT of the category. BCMR suggests holding unissued supply at the identity output. | CashTokens "Reserved Supply"; BCMR "Providing for Continued Issuance of Fungible Tokens" | Decides how explorers report a token's circulating supply (6.7). |
| R8 | Registries expect a token's category ID to be its authbase and ask for extra proof when the two differ. The spec lets any transaction be an authbase, and CashTokens locates a category's genesis as the spender of output 0 of the category transaction. | OpenTokenRegistry submission checklist ("Token `category` is equal to the authbase for all Identity Snapshots"); CashTokens "Token Categories"; this repository's `website/docs/guides/cashtokens.md` | Our token identity's authbase is the category, which is the funding transaction. |
| R9 | Relay policy caps the data-carrier bytes of one transaction at 223, as a total over all its `OP_RETURN` outputs. | libauth `maximumDataCarrierBytes` and `verifyStandardFailedExcessiveDataCarrierBytes` | Bounds the publication's URI list. |
| R10 | A mutable NFT input lets its transaction create one NFT of its category, with any commitment and a capability up to mutable; a minting input of the category lifts the limit. A token on an `OP_RETURN` output is provably destroyed, and an otherwise-standard output with a token prefix is standard. | CashTokens "Token-Aware Transaction Validation", "Total Supply", "Standardness" | Why a two-input authhead spend can create no NFT of C but the one it pins, and why a burn may carry the NFT onto its `OP_RETURN` (4.2). |

## 3. The genesis before this design

The category is the funding coin's txid, and the coin must be at vout 0. The funding transaction is therefore the
authbase (R8), the genesis is the second transaction of the authchain, and the genesis's output 0 is the identity
output (R1).

Both genesis builders put the master pool first (until `c831bf045`):

- framed: `deployFramedStatefulContract` in `packages/solidcash/src/framed/deploy/stateful.ts`, the master-pool loop
  over `entryLocks`;
- direct: `deployStatefulContract` in `packages/solidcash/src/stateful/sc-deploy.ts`, "Outputs 0..threadCount-1:
  minting NFT(s)".

Every top-level deployment goes through one of them: `StatefulContract.deploy`, `ContractFactory`,
`SplitContractBundle.deploy` (one genesis per facet, then the root), and the framed proxy deploy (its implementation
genesis, and its proxy genesis unless the proxy's initialization makes calls; see section 7 for that case).

What followed from the layout:

1. A registry published in the genesis stops counting the first time master #0 is spent, because that transaction
   becomes the authhead (R2). This holds in both conventions, whatever the transaction puts at its output 0.
2. Framed: the composition layout recreates every participant in place from index 0
   (`packages/solidcash/src/framed/composer/layout.ts`), so a call that spends master #0 at input 0 has a master at
   output 0 again. The validator's census (`checkCensus` in `packages/solidc/src/framed/validator/checks.ts`,
   mirrored by `packages/solidcash/src/framed/validator/reference/reference.ts`) constrains the outputs that carry a
   settled contract's category and nothing else, and no rule fixes the output count. A token-free
   `OP_RETURN 'BCMR' ...` output therefore passes. Anyone who can make any call succeed (for an ERC-20,
   `approve(x, 0)` is enough) can publish the category's metadata.
3. When master #0 is spent as a callee instead of at input 0, the identity moves to whatever that transaction holds
   at output 0: another contract's master.
4. Direct: whether a direct master constrains extra token-free outputs is not established here. Point 1 applies
   regardless.

`website/docs/guides/deployment.md` told deployers to "verify that metadata authority is held at the intended
address", which that layout made impossible.

## 4. The identity output (every deployment)

### 4.1 Genesis layout

```text
in   0     funding coin (vout 0)             category C = its txid = the authbase
in   1     the token coin (6.2), when the genesis creates the token's category X
out  0     the authhead contract of C, holding C's identity NFT (4.2)
out  1     BCMR publication, when one is requested (section 5)
out  next  the contract's outputs, in its builder's order (below); change last
```

The two builders emit the contract's outputs in different orders:

- Direct (`packages/solidcash/src/stateful/sc-deploy.ts`): masters, one per thread; records; the mapping nodes the
  constructor writes, then the head of each sorted collection it does not write; the constructor's transfers;
  events; the recreated head of each sorted collection the constructor writes; chunks; message-bus verifiers; the
  satoshi container; the reserve and the bearer supply (6.2); identity anchors; the keeper baton.
- Framed (`packages/solidcash/src/framed/deploy/stateful.ts`): masters, a pool per entry lock; validators; facets;
  events; records; mapping nodes; chunks; an initialize hop's outputs; identity anchors; the keeper baton; the
  reserve and the bearer supply (6.2). A supplied state (a proxy's `mintedState`) takes the place of the events,
  records, mapping nodes and chunks, and that genesis mints no identity anchors.

Further points:

- Without a publication the masters start at output 1.
- Nothing on chain evaluates a top-level genesis: its inputs are funding coins, none of them a contract's. The output
  order is an SDK convention, and the probe that derives the genesis state runs on its own synthetic layout.
- The relative order of the contract's outputs is kept. Discovery classifies a category's UTXOs by lock and sorts each
  class by vout (`packages/solidcash/src/framed/deploy/records.ts`), and it passes over the authhead's NFT, which is
  no part of the deployment; a proxy's minted state (`initializedProxyState` in
  `packages/solidcash/src/framed/proxy/deploy.ts`) leaves it out the same way.
- One helper (`leadingOutputs` in `packages/solidcash/src/bcmr/deployment.ts`) builds the prefix for both builders, so
  every entry point in section 3 inherits it.
- There is no flag: this is the layout of every genesis.

### 4.2 The authhead contract

Output 0 of every genesis is the authhead contract of the contract's category C
(`packages/solidcash/src/bcmr/authhead.ts`, DECISIONS D46):

- Its redeem script is `<C || 0x01>`, C in the VM's byte order, then a fixed 46-byte body. The lock is P2SH32 of
  that script, so the address belongs to C alone and never moves when the compiler changes.
- It holds a mutable NFT of C with no fungible amount. The NFT's commitment is the owner's locking bytecode, verbatim:
  P2PKH, P2SH20 or P2SH32. The owner is no part of the contract's state, and no call of the contract touches the
  authhead.
- A spend has exactly two inputs: the authhead and a token-free coin at the owner's lock, which also pays the fee.
- Output 0 of the spend carries the NFT, with no fungible amount, to one of three locks:

| Spend | Output 0 | Effect |
| --- | --- | --- |
| update | the authhead, commitment unchanged | publishes a registry at output 1, or carries the current one over (5.4) |
| transfer | the authhead, a new commitment | hands the identity to the lock the new commitment names |
| freeze | P2SH32 of `OP_RETURN` | nothing can spend it, so the transaction stays the authhead for good and its registry is final |
| burn | `OP_RETURN` | the identity ends (R4), and the NFT on that output is destroyed (R10) |

The body, after the push of `C || 0x01`:

```text
OP_0 OP_OUTPUTTOKENCATEGORY OP_EQUALVERIFY                output 0 holds the mutable NFT of C
OP_0 OP_OUTPUTTOKENAMOUNT OP_NOT OP_VERIFY                with no fungible amount
OP_TXINPUTCOUNT OP_2 OP_NUMEQUALVERIFY                    two inputs
OP_1 OP_INPUTINDEX OP_SUB                                 the other one,
OP_DUP OP_UTXOTOKENCATEGORY OP_0 OP_EQUALVERIFY           a token-free coin
OP_UTXOBYTECODE OP_INPUTINDEX OP_UTXOTOKENCOMMITMENT OP_EQUALVERIFY   at the owner's lock
OP_0 OP_OUTPUTBYTECODE                                    output 0's lock is
OP_DUP OP_INPUTINDEX OP_UTXOBYTECODE OP_EQUAL             this contract,
OP_OVER <6a> OP_EQUAL OP_BOOLOR                           OP_RETURN,
OP_SWAP <6a> OP_HASH256 <aa20> OP_SWAP OP_CAT <87> OP_CAT OP_EQUAL OP_BOOLOR   or P2SH32 of OP_RETURN
```

Why it holds:

- Every spend needs the owner's coin, and only a spend moves or rewrites the NFT. The commitment changes only when
  the owner writes a new one.
- With one token input, the spend can create no NFT of C except the one output 0 must hold (R10). The NFT therefore
  never leaves the contract, except into an output nothing can spend.
- A mutable NFT of another category, or an immutable or minting one of C, fails the first check.
- The token category X a genesis creates beside C (6.2) shares the identity output, so C's owner also governs X's
  identity.

Look-alike NFTs. A contract path that mints NFTs of C at a lock its caller chooses can put a mutable NFT of C, with any
commitment, at the authhead's address:

- the direct C3 count's residual: a co-spent record re-emitted at another lock (`docs/security/SECURITY-AUDIT.md`, C3);
- the authorized lifecycle entries `upgrade`, `selfdestruct` and `split`/`merge`;
- the `unsafe` tiers.

The framed convention pins every record a frame reads or writes to its covenant (spec T45), so its calls cannot plant
one. A look-alike is not on the authchain, which follows outpoints rather than addresses (R1), so BCMR clients never
see it. The SDK's `resolveIdentity` takes only the candidate whose authchain leads back to the genesis (4.4).

### 4.3 Default owner

The owner defaults to the deployer's lock: `senderLockingBytecode`, otherwise the funder's lock when it is P2PKH,
otherwise the change address (`isP2pkhLock` in `packages/solidcash/src/bcmr/identity.ts`, the same test in both
builders). `identity: { owner }` states another lock, as bytecode or a CashAddress. The SDK refuses an owner that
leaves nobody in control (`ownerLockRefusal`): a lock of another shape, the authhead itself, or the frozen lock.

### 4.4 Finding the identity, and keeping the SDK away from other identities

`resolveIdentity(provider, category)` lists the category's authhead address and keeps the output 0 that holds the
mutable NFT of C. It then proves the candidate by walking its authchain back: each step must be a transaction whose
output 0 holds the NFT at the authhead, and which spends such an output 0, until one spends `C:0`, the genesis. A
look-alike's chain reaches a transaction that does neither. Neither does a chain the provider does not serve, and the
resolver then answers no identity. A frozen or burned identity is not at the address, so it is not resolved either.

No wallet unlocks an authhead, so coin selection never takes one of the SDK's identity outputs. Other transactions
can still leave an identity output at the wallet's lock, for instance a genesis that pays its output 0 to the user.
The rule: a vout-0 coin whose transaction is a token genesis, or carries a BCMR output, is an identity output, and the
SDK never spends it as a coin. Spending it would move that identity to this transaction's output 0. A transaction is a
token genesis when one of its outputs carries a category equal to the outpoint txid of one of its vout-0 inputs
(`identityOutputRefusal` in `packages/solidcash/src/bcmr/authchain.ts`).

`ownCoinRefusal` (`packages/solidcash/src/framed/deploy/own-coin.ts`) proves every coin the SDK signs for from its
own transaction, so the rule covers every genesis funding coin (`genesisCoinRefusal`) and every proven caller coin,
across sessions. `publishMetadata` applies it to the owner's coin. The other fee and funding pools (a direct call's
wallet funders, fee tail and fan-out, the framed caller's filler coins) draw on `withoutIdentityOutputs` in
`own-coin.ts`. That helper holds out reserved genesis outpoints, and every vout-0 coin whose served transaction is a
token genesis or carries a BCMR output.

## 5. The publication output and the registry

### 5.1 The output

`OP_RETURN <'BCMR'> <sha256(registry bytes)> <uri> ...` at output 1.

- The hash is the raw SHA-256 digest (OP_SHA256 byte order), not reversed.
- The output carries no satoshis.
- The SDK refuses a URI list that takes the transaction's data-carrier bytes past 223 (R9). The prefix and hash push
  take 39 bytes, an IPFS CIDv1 URI about 67 and a bare HTTPS domain about 20, so a typical publication is about 126.

### 5.2 Registry content

For an ERC-20-shaped token whose bearer category X the genesis creates beside the contract's C (section 6; categories
and CID abbreviated):

```json
{
  "$schema": "https://cashtokens.org/bcmr-v2.schema.json",
  "version": { "major": 0, "minor": 1, "patch": 0 },
  "latestRevision": "2026-10-20T12:00:00.000Z",
  "registryIdentity": "<C>",
  "identities": {
    "<X>": {
      "2026-10-20T12:00:00.000Z": {
        "name": "Example Dollar",
        "description": "A ledger token whose wrapped form is this CashTokens category.",
        "uris": { "icon": "ipfs://bafkrei...", "web": "https://example.org" },
        "token": { "category": "<X>", "symbol": "DOLLAR", "decimals": 6 }
      }
    },
    "<C>": {
      "2026-10-20T12:00:00.000Z": {
        "name": "Example Dollar contract",
        "description": "The contract that keeps the Example Dollar ledger; its NFTs hold the ledger's state."
      }
    }
  }
}
```

- `registryIdentity` is the contract's category: the identity publishes its own registry. The genesis spends output 0
  of both authbases, C's and X's, so it lies on both authchains, and its publication, like every later update from the
  shared identity output, speaks for both. A deployment without a token of its own publishes C's identity alone.
- One snapshot, keyed by the deployment time in the `YYYY-MM-DDTHH:mm:ss.sssZ` format the schema requires. The time
  is injectable, so tests stay deterministic.
- `token.category` equals the identity's authbase (R8). C's identity carries a `token` only to label its NFTs
  (section 8), under the symbol `<SYMBOL>-STATE`.
- The SDK validates the registry with libauth's `importMetadataRegistry` before it builds the genesis.
- It hashes the exact bytes it returns and never serializes them again; the hosted file must be those bytes.

### 5.3 Hosting and URIs

- The SDK returns the bytes and the hash. It cannot upload them; the deployer hosts the file.
- IPFS: a registry fits in one block, so its CIDv1 with the raw codec is computable offline from the same SHA-256
  (`bafkrei...`). The SDK can therefore fill `ipfs://<cid>` with no network access. The deployer must add the file as
  CIDv1 with raw leaves so the CID matches.
- HTTPS: pushed without `https://`; a bare domain resolves to `/.well-known/bitcoin-cash-metadata-registry.json`
  (R6).
- Icons and other static data should use IPFS URIs as well (BCMR "Authentication of Static Data").

### 5.4 The owner's spends

`publishMetadata({ provider, identity, owner, registry, publicationUris, action, changeAddress })`
(`packages/solidcash/src/bcmr/publish.ts`):

- spends the authhead at input 0 beside `owner`, a token-free coin at the identity's owner lock, at input 1. The coin
  is proven from its own transaction and checked against the identity-output rule (4.4), and it pays the fee;
- `action` is an update (the default), `{ kind: 'transfer', owner }`, `{ kind: 'freeze' }` or `{ kind: 'burn' }`, and
  output 0 follows 4.2. A transfer's owner is checked as at deployment (4.3);
- puts the new publication at output 1. `withSnapshot` adds a snapshot to the registry (a minor version bump, per the
  schema's versioning rules) rather than editing the old one;
- without a registry, re-publishes the spent authhead's publication at output 1, so the identity keeps its registry
  (R2). A burn publishes nothing: its output 0 ends the identity (R4). An update with no registry and nothing to
  carry over is refused, as is any spend without a registry whose authhead the provider does not serve, since the
  SDK cannot tell whether it published;
- returns the new identity record: `{ txid, vout: 0, satoshis, category, status, lockingBytecode, owner }`.

Further points:

- The deployment returns its identity record (`DeployResult.identity`; `deploymentIdentity()` on a contract from
  `ContractFactory`). A later session finds the active identity with `resolveIdentity(provider, category)` (4.4).
- Upgrades keep the category (`StatefulContract.upgrade` moves the master to the new lock), so the identity survives
  them.
- Destroying a contract does not touch its identity. The owner may publish an `inactive` snapshot.

## 6. ERC-20-shaped tokens: ERC20 + BchNative

### 6.1 What wallets see

- The building blocks are in `packages/solidcash/contracts/`: `ERC20.scash` (the ledger), `ERC20Metadata.scash`
  (name, symbol, decimals), `BchNative.scash` (wrap and unwrap), `BchNativeMultiplier.scash` (scaling) and
  `BchNativeWrapper.scash` (an ERC-20 over a category that already exists, 6.8). Third-party ledgers compose with
  them too: the npm OpenZeppelin ERC20 and the verbatim Tether source (`packages/solidcash/contracts/README.md`).
- Wallets only ever see the unwrapped form: token-only UTXOs of the token's bearer category X, paid by `unwrap` from
  the contract's container `this.tokens[X]`. Ledger balances are mapping records at covenant locks.
- X is a category of its own, not the contract's C (D33). BchNative used C until this design found that the framed
  census refuses any fungible amount of a settled contract's own category (`docs/framed/SPEC_FRAMED_TRANSACTION.md`,
  S2; `V7_CENSUS_OWN_FUNGIBLE`), and that tokens of C share C's identity with its state NFTs. BchNative now takes X at
  construction and keeps it as the immutable `_nativeCategory`; its container key is that variable, which the
  compiler publishes as `keySource: 'state'` and the SDK reads from the state each call loads.
- The genesis that creates C also creates X, from a second vout-0 coin (`nativeToken.funding`), so the two categories
  share its identity output, and the registry describes both: X carries the token fields, C the contract and its NFT
  labels. A framed genesis does the same, and a framed token wraps and unwraps through the container
  (`docs/framed/SPEC_FRAMED_TRANSACTION.md`, 4b; D34). A message-bus route carries the container under its state key
  (D36), and another contract's callee frame wraps into and unwraps from it (`FramedTokenCallee.test.ts`). The full
  framed ERC-20 is `packages/solidcash/contracts/examples/FramedNativeToken.scash`.

### 6.2 Genesis for a native token

`nativeToken.reserve` premints the token (`packages/solidc/docs/native-usdt-port.md` recorded its absence under
"Limits that remain"). Fungible amounts can only be created in the genesis, so the premint, the identity output and
the publication land in one transaction:

```text
in   0     funding coin (vout 0)                C = its txid
in   1     token coin (vout 0)                  X = its txid
out  0     the authhead of C, the identity output C and X share
out  1     BCMR publication
out  next  the contract's outputs in its builder's order (4.1), ending
             direct: ..., satoshi container, reserve, bearer, identity anchors, keeper baton
             framed: ..., identity anchors, keeper baton, reserve, bearer
           change

reserve    token-only output of X at getTokenContainerAddress(contract, C, X), amount = premint
bearer     the bearer supply of X, when nativeToken.bearer is set
```

As in 4.1, the masters follow the authhead directly when there is no publication.

Without `nativeToken.funding` the premint is of C (X = C, 6.3), which only the direct convention admits: the framed
builder refuses a reserve or a bearer supply without it, since a framed composition refuses fungible tokens of the
contract's own category (`docs/framed/SPEC_FRAMED_TRANSACTION.md`, S2).

A token whose ledger starts empty and grows by `wrap` needs its supply in holders' hands first: `nativeToken.bearer`
(`{ amount, to }`) mints that bearer supply to a token-aware address in the same genesis, beside the reserve or instead
of it. The first `wrap` then creates the container.

- The premint is the ledger supply the constructor credits, divided by the native scale, plus any headroom kept for
  a later `issue`. It is at most 9,223,372,036,854,775,807.
- The SDK checks that the premint is at least `totalSupply()` divided by the scale, read from the probe genesis
  (6.4), so every ledger unit the constructor credits is backed, and that the contract keys its reserve by X: it reads
  the state variable the artifact publishes as the container key from the probe and refuses another category,
  naming a byte-reversed constructor argument. The key check runs whenever the deployment states `nativeToken`, so
  with X = C it holds the key to C.

### 6.3 Field mapping

| BCMR field | Source | Rule |
| --- | --- | --- |
| `identities` key, `token.category` | X; C without `nativeToken.funding`, or with `nativeToken.category` (6.8) | R8; C then has an identity of its own (5.2) |
| `name` | `name()` | |
| `token.symbol` | `symbol()` | 6.6 |
| `token.decimals` | `decimals()` minus log10 of the native scale; `decimals()` for a wrapped category | 6.5, 6.8 |
| `description`, `uris.icon`, `uris.web`, `tags` | deploy options | Nothing on chain to read. |
| `token.nfts` | generated | Section 8; optional; on C's identity when X is separate. |
| `extensions` | the ledger description of 6.7 | |

### 6.4 Where the values come from

- The deploy options are the source. When the artifact's ABI carries the whole IERC20Metadata interface (`name()`,
  `symbol()` and `decimals()` as views without parameters), the contract's answers fill the fields the options omit,
  and the SDK refuses a stated field that disagrees, before anything is broadcast.
- The values exist only once the constructor has run, while the registry hash goes into the genesis. The SDK
  therefore deploys a probe genesis through a broadcast-holding overlay that is never released (`stageBroadcasts` in
  `packages/solidcash/src/framed/proxy/staged-broadcasts.ts`, the pattern the proxy deploy already uses), reads the
  views with `staticCall`, builds the registry, and then builds the real genesis from the same funding coin. Neither
  the category nor the state depends on the genesis txid, so the probe's answers hold for the real genesis. The
  probe is signed but never relayed. A view the probe cannot read leaves its field to the options, which must then
  state it.
- A split token (`SplitContractBundle`) keeps views and its container accesses in its facets. The probe root answers
  through them (`DeployOptions.splitFacets`): its views route to the facets, and the container key is read from the
  facets' ABI. The bundle holds the facets' geneses in an overlay too, released once the root's genesis is built, so a
  refusal broadcasts nothing; and the token's funding coin funds none of the bundle's geneses.
- Return types differ. Names and symbols are `string` (ERC20Metadata, Tether) or `bytes32` (the hand-ported USDT:
  right-padded, so strip trailing zero bytes and decode UTF-8). `decimals()` returns `uint8` or `uint256`.
- AGENTS.md forbids selecting behaviour by function name. This selects by ABI schema, a standard interface taken as a
  whole, which the rule allows.
- `MinimalNativeToken` has no metadata surface, so its fields come from the options alone.

### 6.5 Decimals and the native scale

- BCMR describes the bearer unit. With `BchNativeMultiplier(m)`, one native unit backs m ledger units, so the native
  decimals are the ledger decimals minus log10(m). An 18-decimal ledger with m = 10^10 publishes 8; publishing 18
  would show every balance 10^10 times too small.
- The SDK refuses an m that is not a power of ten, and a result outside 0..18.
- Without a multiplier, an 18-decimal ledger can be backed for at most about 9.22 whole tokens (the int64 cap over
  10^18). The SDK warns about it.
- The scale is not visible in the ABI (`_nativeMultiplier` is internal), and reading internal state by its name is
  the selection AGENTS.md forbids, so it is the explicit deploy input `nativeToken.scale` (D32). A public view on
  `BchNativeMultiplier` was the alternative; it costs script bytes, and OZ ERC20 + BchNative is already over
  10,000 B unsplit.

### 6.6 Symbol

- The symbol must match `^[A-Z0-9]+[-A-Z0-9]*$` (R5), so "stETH" fails. The SDK refuses it and asks for an explicit
  BCMR symbol, which it compares with the contract's case-insensitively ("STETH" passes). It never uppercases
  silently.
- A base symbol of 4 to 6 characters is recommended.
- A port that reuses USDT, USDC or DAI hits the reserved list, and wallets will flag or refuse it. Use a distinct
  base symbol.

### 6.7 Supply as explorers will show it

- CashTokens counts as reserved only the fungible amounts that sit with a minting or mutable NFT (R7). The reserve
  container holds tokens only, so explorers count the whole premint as circulating.
- For a wrap-only token the reserve backs the wrapped ledger balances, which are in circulation, so that reading is
  defensible. For a token with `issue` headroom (Tether-shaped), the headroom also shows as circulating.
- The snapshot carries the `solidcash-native-token` extension, `{ reserveLockingBytecode, scale, ledgerSupply }`,
  which names the reserve lock and the ledger's supply view for explorers that adopt it (D32). Carrying the reserve on
  a mutable-NFT container, which would change a covenant, was the alternative.
- BCMR's advice to hold unissued supply at the identity output does not apply (4.2).

### 6.8 A wrapped category

- `BchNativeWrapper` wraps a category X its issuer created in a genesis of its own, whose supply circulates outside
  the contract. `nativeToken.category` names X, as 64 hex characters in the order wallets print. The genesis spends no
  coin of X and creates no output of it; the first `wrap` creates the reserve container.
- It is refused beside `funding`, which creates a category, and beside `reserve` or `bearer`, since every fungible amount
  of X was created in X's genesis; and when X is C.
- The probe checks the container key as 6.2 does; an artifact that keys no container by state is refused;
  `totalSupply()`, when the ABI carries it, must read 0. Name, symbol, decimals, the scale, and whether X exists are
  not checked.
- `identities` holds C alone: X's authchain is its issuer's (R1, R2). The snapshot carries the ledger's name,
  `token.symbol` and `token.decimals` as the contract answers them. C has no bearer unit, so no native scale applies
  (6.5) and the 18-decimal warning does not either. `nativeToken.scale`, any positive integer, is the creator's
  statement, published unchecked.
- The extension adds `underlying`, X: `{ underlying, reserveLockingBytecode, scale, ledgerSupply }`. `wrap` requires the
  reserve to grow by exactly the native amount, so the reserve backs at least `totalSupply()`; tokens paid to the
  reserve lock outside a `wrap` back no units.

## 7. Categories created by contracts

BCMR metadata for a category a contract creates inside a call is **unsupported** (DECISIONS D48). Such a category
takes the creating transaction's output 0 as its identity output (R1), because that transaction spends the reserved
genesis coin. The layouts put the creating contract's own participant there: the factory's master in direct
`deployFrom` (`packages/solidcash/src/stateful/sc-deploy-from.ts`), and participant 0's master in a message-bus child
deployment (`packages/solidcash/src/message-bus/compose-materialize-deployments.ts`). Every call of that contract
then extends the child's authchain, and anyone able to make one can publish for it. The SDK publishes nothing for a
child and resolves no identity for it (`resolveIdentity` finds no authhead), and clients should not trust metadata
published for a contract-created category.

A leading slot that puts the child's authhead at output 0 was built for direct `deployFrom` (D47) and then reverted
(`dc4232e07`). It moved the factory's master to input 1 in every creating call, so contract code reading
`tx.inputs[i]` at a fixed index saw another input, and it needed its own covenant rules in each convention. The
user judged that too complicated for what it bought.

Not affected:

- Framed `new C()`: the SDK reserves the child's genesis coin ahead
  (`packages/solidcash/src/framed/deploy/create-lookahead.ts`) and deploys the child as a top-level genesis through
  `ContractFactory`, so the child leads with its own authhead like any deployment.
- The framed proxy's calling genesis (`packages/solidcash/src/framed/proxy/deploy.ts`): a proxy whose initializer
  calls another contract is the deployer's own deployment, minted in one composition with the callee's frames. Its
  genesis coin leads that composition (`layoutTransaction`'s leading inputs), its output 0 is the proxy's authhead,
  and the minted proxy root declares that output a created record, so the validator's census admits exactly it; the
  validator program is unchanged (D47). The genesis also carries the publication the proxy's deploy options state;
  a `nativeToken` premint there is refused.

## 8. Describing the contract's own NFTs

Every UTXO of a contract carries its category: masters (minting), framed validators, data records, mapping nodes and
chunks (mutable), events and identity anchors (immutable), and the blockhash keeper baton (minting). Explorers list
them all as NFTs of the token. BCMR's parsable NFTs label them: a publication with `token.nfts: 'generated'` carries a
collection generated per deployment, because the locks depend on the category (`nftCategory` in
`packages/solidcash/src/bcmr/nft-parse.ts`, the roles in `nft-roles.ts`).

- **Classify** each NFT by its UTXO's locking bytecode (`OP_0 OP_UTXOBYTECODE` in the parsing transaction) against the
  locks derived at deploy: the master lock, `addrV(C)` (framed), the record lock, one entry lock per collection, one
  chunk lock per dynamic variable and one lock per named event. Anonymous events share one lock, so they are one
  type. Type keys are minimal VM numbers (1, 2, ...), so NFT tickers read `SYMBOL-1`, `SYMBOL-2` and so on. A lock the
  category cannot enumerate, such as a long mapping value's chunks, stays unclassified, and clients show it unparsed.
- **Fields**: data records and native-notation events are runs of minimal pushes (`docs/framed/SPEC_FRAMED_TRANSACTION.md`,
  "Encodings"), so a push decoder moves each value to the altstack: about a dozen operations per field, covering
  direct pushes, `OP_PUSHDATA1`, `OP_0`, `OP_1NEGATE` and `OP_1`..`OP_16`. A layout with several records reads the
  leading index tag first and selects the record's type from it. Structs flatten into their members; an array packs
  its elements, so a type holding one is classified only, as are mapping nodes, EVM-notation events and events
  without parameters.
- **Encodings**: integers become `number` (VM numbers are little-endian sign-magnitude, which is our encoding);
  fixed-point values become `number` with `decimals`; addresses (full locking bytecode) and bytes become `hex`;
  strings become `utf8`. A dynamic value kept in chunks shows only the length its record holds. Booleans become
  `number`, because our `false` is an empty push and BCMR's `boolean` requires exactly `0x00`.
- **Machine**: the parser uses no opcode newer than BCH 2025, so clients on that machine parse it. It leaves the
  parsing input's own `OP_1` as the one value on the stack.
- **Budget**: the parsing input's unlocking bytecode is `OP_1`, so the parser gets (41 + 1) x 800 = 33,600
  operation-cost units (libauth `densityControlBaseLength`, `operationCostBudgetPerByte`). The generator evaluates each
  type's path on a sample commitment with libauth's 2025 machine in the standardized parsing transaction, and a type
  within a tenth of the budget is classified only.
- Encodings differ between conventions, so the generator reads them from the artifact's `stateLayout`, never from
  names.
- The benefit is mostly for explorers: users rarely hold these NFTs.

## 9. Contract-governed metadata (removed)

The `governed` policy, its guard and `BcmrGoverned.scash` were removed with the other policies (DECISIONS D46): the
identity's owner is a lock outside the contract's state. An owner that wants rules of its own can be a P2SH32
covenant. The authhead admits its coin as long as the coin carries no token, and the covenant's own rules then decide
when it spends. A contract's master always carries its minting NFT, so a master cannot be the owner.

## 10. SDK surface

The module is `packages/solidcash/src/bcmr/`, exported as `solidcash/bcmr`.

```ts
interface DeployOptions {
  // ...existing fields...
  identity?: { owner?: Uint8Array | string };  // default owner: the deployer's lock (4.3)
  bcmr?: BcmrPublication;                      // omitted: no publication output
  nativeToken?: {                              // the token's own category, its premint and bearer supply, its scale
    funding?: Utxo; funder?: Unlocker; reserve?: bigint; bearer?: { amount: bigint; to: string }; scale?: bigint;
  };
}

interface BcmrPublication {
  name?: string;                       // the contract's name() when omitted
  description?: string;
  uris?: Record<string, string>;       // icon, web, ...
  tags?: Record<string, Tag>;
  token?: { symbol?: string; decimals?: number; nfts?: NftCategory | 'generated' };
  extensions?: Extensions;
  publicationUris?: string[];          // omitted: ipfs://<CIDv1 of the registry bytes>
  timestamp?: string;
}

interface IdentityRecord {
  txid: string; vout: 0; satoshis: bigint;
  category: string;                    // whose authhead holds the identity
  status: 'active' | 'frozen' | 'burned';
  lockingBytecode: Uint8Array;         // the authhead, the frozen lock or OP_RETURN
  owner: Uint8Array;                   // the NFT's commitment
}

interface DeployResult {
  // ...existing fields...
  identity?: IdentityRecord;
  registry?: PublishedRegistry;        // { registry, json, bytes, sha256, uris }
}

type IdentityAction =
  | { kind: 'update' } | { kind: 'transfer'; owner: Uint8Array | string } | { kind: 'freeze' } | { kind: 'burn' };

declare function publishMetadata(options: {
  provider: NetworkProvider; identity: IdentityRecord; owner: { utxo: Utxo; unlocker: Unlocker };
  registry?: MetadataRegistry; publicationUris?: string[]; action?: IdentityAction; changeAddress: string;
}): Promise<{ tx: TransactionDetails; identity: IdentityRecord; registry?: PublishedRegistry }>;
declare function resolveIdentity(provider: NetworkProvider, category: string): Promise<IdentityRecord | undefined>;
```

The authhead's own helpers are exported too: `authheadRedeemScript`, `authheadLockingBytecode`, `authheadOutput`,
`authheadUnlocker`, `AUTHHEAD_BODY`, `ownerLockRefusal` and the frozen and burned locks.

`ContractFactory` passes `identity`, `bcmr` and `nativeToken` through, and its deployed contract answers
`deploymentIdentity()` and `deploymentRegistry()`.

## 11. Implementation map and tests

Tests run on mocknet only, which is the user's standing rule.

| Part | Code | Tests |
| --- | --- | --- |
| The authhead contract: its script, paths and refusals | `bcmr/authhead.ts` | `test/e2e/BcmrAuthhead.test.ts` (evaluated by the VM, a look-alike passed over) |
| The authhead in every genesis, the owner, `resolveIdentity`, the identity-output rule | `bcmr/identity.ts`, `bcmr/authchain.ts`, `stateful/sc-deploy.ts`, `framed/deploy/stateful.ts`, `framed/deploy/own-coin.ts`, `framed/deploy/records.ts` | `test/e2e/BcmrDeployment.test.ts`, `BcmrIdentityOwner.test.ts`, `BcmrGenesisLayout.test.ts`, `BcmrIdentityCoinRule.test.ts`; `test/framed/deploy/proxy-deployment.test.ts` pins the framed layout |
| Publication, registry, IPFS CID, `publishMetadata` | `bcmr/publication.ts`, `bcmr/registry.ts`, `bcmr/publish.ts` | `BcmrDeployment.test.ts`, `BcmrPublication.test.ts` |
| ERC-20 fields, premint, probe check | `bcmr/deployment.ts`, `bcmr/token.ts` | `BcmrDeployment.test.ts` with `test/fixture/bcmr_metadata_token.scash` |
| The framed proxy's calling genesis leads with its authhead | `framed/proxy/deploy.ts`, `framed/composer/layout.ts` | `test/framed/deploy/proxy-calling-genesis-identity.test.ts` |
| Contract-created categories | unsupported (D48) | |
| Generated NFT labels | `bcmr/nft-parse.ts`, `bcmr/nft-roles.ts` | `test/e2e/BcmrNftParse.test.ts` |
| BchNative's own bearer category | `contracts/BchNative.scash`; the `state` container key in `packages/solidc/src/semantic/SymbolTableTraversal.ts` and `stateful/sc-load-create-builder-token-containers.ts` | the BchNative e2e files; `test/e2e/BchNativeFramed.test.ts` (framed genesis, wrap, unwrap, drain) |

Paths are under `packages/solidcash/` unless stated.

## 12. Decisions

- The identity output is the authhead contract, owned by a lock outside the contract's state, with the owner's
  update, transfer, freeze and burn: D46, the user's answers. It supersedes D31 (AuthGuard opt-in) and D32's `key`
  default and contract-governed metadata.
- BCMR for a category a contract creates inside a call is unsupported: D48, the user's answer. The leading slot
  (D47) survives only in the framed proxy's calling genesis.
- BchNative's bearer form is a category of its own: D33.
- The other open decisions this design listed were taken as its own recommendations when it was implemented (D32):
  stated ERC-20 fields are checked and refused on mismatch, the symbol case-insensitively; the native scale is
  explicit; the reserve is named by an extension; internal categories take the token default.

## 13. References

- CHIP-BCMR, `bitjson/chip-bcmr` at `0e8417ccf38798f4ebe66e228f4d1908249cb8fd`:
  https://github.com/bitjson/chip-bcmr (also `reserved-token-symbols-cryptocurrencies.json` and
  `bcmr-v2.schema.ts` there).
- CashTokens: https://github.com/cashtokens/cashtokens ("Token Categories", "Fungible Token Supply Definitions").
- AuthGuard, CHIP-2023-08 v0.1.2, which the authhead contract adapts: https://github.com/mr-zwets/AuthGuard
- OpenTokenRegistry submission checklist:
  https://github.com/OpenTokenRegistry/otr.cash/blob/master/.github/pull_request_template.md
- libauth 3.1.0-next.8: `build/lib/engine/types/bcmr-types.d.ts`, `build/lib/schema/bcmr.js`
  (`importMetadataRegistry`).
- This repository: `packages/solidc/docs/native-erc20.md`, `packages/solidc/docs/native-usdt-port.md`,
  `packages/solidcash/contracts/README.md`, `docs/framed/SPEC_FRAMED_TRANSACTION.md`,
  `website/docs/guides/deployment.md`, `website/docs/guides/cashtokens.md`.
