# BCMR metadata at deployment: design

Kind: design, implemented in `packages/solidcash/src/bcmr/` (section 11 maps the code). Decisions taken on it are
recorded in `docs/framed/DECISIONS.md` (D31, D32), and anything deferred in `packages/solidc/docs/deferrals.md`; those
ledgers win over this file. Written 2026-10-20 against master `769adb889`, revised to the implementation the same day.

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

1. Every genesis the SDK builds puts a dedicated identity output at index 0, under an explicit policy. This is the
   layout of every deployment, not an option (section 4).
2. A deployment can publish its registry in the genesis itself, at output 1 (section 5).
3. ERC-20-shaped tokens publish name, symbol and decimals checked against the contract before anything is
   broadcast, with the premint in the same genesis (section 6).
4. Categories created by contracts stay exposed until the composition rules change; section 7 lists the options.
5. A deployment can label its own NFTs for explorers (section 8) and let the contract's access control govern its
   metadata (section 9).

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
| R10 | AuthGuard is a covenant at output 0 that spends only when input 1 holds an immutable NFT of a configured category (the AuthKey). With `keepGuarded` it must recreate itself at output 0; nothing else is constrained. | AuthGuard README and `AuthGuard.cash` | A standard, tool-supported way to hold the identity (4.2). |

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
out  0     identity output, per policy (4.2)
out  1     BCMR publication, when one is requested (section 5)
out  2..   the existing outputs in their existing order: masters, validators, facets, records, mapping nodes,
           chunks, events, containers, identity anchors, keeper baton; change last
```

- Nothing on chain evaluates a top-level genesis: its only input is the funder's coin. The output order is an SDK
  convention, and the probe that derives the genesis state runs on its own synthetic layout.
- The relative order of the existing outputs is kept. Discovery classifies a category's UTXOs by lock and sorts each
  class by vout (`packages/solidcash/src/framed/deploy/records.ts`), so shifting every output by one or two places
  changes nothing there. Tests that read a deployment transaction's `outputs[0]` as the master need an audit.
- One helper builds the prefix for both builders, so every entry point in section 3 inherits it.
- There is no flag: this is the layout of every genesis.

### 4.2 Identity policies

| Policy | Output 0 | Who can publish | Risk | Fits |
| --- | --- | --- | --- | --- |
| `key` | A token-free output at a stated lock: P2PKH, or a P2SH multisig. | The holder of that lock. | A wallet holding the lock may spend the output as an ordinary coin, which hands the identity to whatever that transaction puts at output 0 (4.4). | Default; scripted issuers. |
| `authguard` | The AuthGuard covenant keyed to an AuthKey category K. The AuthKey, an immutable NFT of K, goes to the issuer. | The holder of the AuthKey. | Needs a second category. | Opt-in only, never the default (DECISIONS D31). For issuers who want the AuthKey model; CashTokens Studio already supports the standard. |
| `frozen` | An unspendable lock that is not a data carrier: P2SH32 of the one-byte script `OP_RETURN`. | Nobody, ever. | The genesis registry is final, so its URIs must stay reachable (use IPFS). | Tokens whose metadata must never change. |
| `burned` | `OP_RETURN`. | Nobody. Clients archive the identity (R4). | libauth's `IdentitySnapshot.status` guidance tells clients to consider burning a burned token's remaining tokens. | Categories with no user-facing token. |
| `governed` | A guard keyed to the contract's category and the lock of its `MetadataUpdated` event (section 9). | Whoever the contract's own access control lets emit `MetadataUpdated`; anyone may then apply it. | Each update waits 144 blocks for its authorization to mature. | Tokens whose metadata follows the contract's governance. |

AuthGuard details:

- K must not be C. AuthGuard accepts any immutable NFT of K at input 1 (R10), and the immutable NFTs of C are this
  contract's event records, which anyone may spend after 144 blocks (`buildEventNftCovenantScript` in
  `packages/utils/src/state.ts`: a category check, then a 144-block `OP_CHECKSEQUENCEVERIFY`). With K equal to C,
  anyone could obtain an AuthKey.
- K can be minted in the same genesis from a second vout-0 coin, since one transaction can create one category per
  token genesis input (CashTokens "Token Categories", figure 1). It can also be minted beforehand.
- The guard holds no fungible tokens, unlike the standard's own genesis setup. A ledger token's supply has to stay in
  the contract's reserve (6.2); held at the guard, the issuer could release tokens past the ledger, which breaks the
  supply model in `packages/solidc/docs/native-erc20.md` (the ceiling theorem: tracked supply never falls below
  effective supply).
- The snapshot publishes `extensions.authNft = K`. The standard asks for it when an identity adopts AuthGuard after
  genesis, which is when the AuthKey has a category of its own, as ours always does. The snapshot does not publish
  `tokenStandard: "AuthGuard"`: that extension tells applications the reserved supply sits at the authhead, and ours
  holds none.
- The guard's bytecode must be the standard's exact template, because tools check a guard by recomputing its
  address from K.

`frozen`: anyone holding the published redeem script (`6a`) can check that the P2SH32 output can never be spent. It
is not a data-carrier output, so the identity stays active and the genesis stays its authhead forever.

### 4.3 Default

The default is `key` at the deployer's lock: `senderLockingBytecode`, otherwise the funder's lock when it is P2PKH,
otherwise the change address (D32). AuthGuard is opt-in and never the default (D31).

`burned` stays opt-in: it closes the identity forever, which is wrong for a token that may want metadata later.

### 4.4 Keeping the SDK away from the identity output

The `key` policy leaves a token-free coin at vout 0, and the SDK picks exactly that kind of coin in two places:

- Genesis funding: `selectGenesisFundingUtxo` and `selectGenesisFundingUtxoForCost` in
  `packages/solidcash/src/stateful/ContractFactory.ts` take token-free vout-0 coins. If deployment B is funded with
  deployment A's identity output, B's category becomes the txid of A's genesis and A's authchain continues into B's
  genesis. From then on, B's publication (or its absence) is also A's.
- Fees: `coinsAvailableForCallerFee` in `packages/solidcash/src/stateful/genesis-reservations.ts` and the framed
  `callerCoin`. Paying a fee with an identity output moves the authority to the call's output 0, which in the framed
  layout is a master: the exposure of section 3 again.

The rule: a vout-0 coin whose transaction is a token genesis, or carries a BCMR output, is an identity output, and the
SDK never spends it as a coin. A transaction is a token genesis when one of its outputs carries a category equal to
the outpoint txid of one of its vout-0 inputs (`identityOutputRefusal` in `packages/solidcash/src/bcmr/authchain.ts`).
`ownCoinRefusal` (`packages/solidcash/src/framed/deploy/own-coin.ts`) proves every coin the SDK signs for from its
own transaction, so it applies the rule to every genesis funding coin (`genesisCoinRefusal`) and every proven caller
coin, across sessions. Within a session, each deployment and update also reserves its key-held identity outpoint
(`reserveGenesisOutpoint`), which the fee selectors (`coinsAvailableForCallerFee`) honour.

Other wallets do not know this rule. A dedicated authority key, or opting into `authguard`, removes the risk.

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

### 5.4 Later updates

`publishMetadata({ provider, identity, current, registry, publicationUris, next, feeFunding, changeAddress })`:

- spends the current identity output (`current`): a `key` identity with its unlocker, or an `authguard` one with its
  AuthKey, which it puts at input 1 and returns to its holder;
- recreates output 0 under the same policy or `next`: key rotation, freezing or burning. Moving into AuthGuard needs
  the AuthKey category a deployment creates, so it starts at deployment;
- puts the new publication at output 1. `withSnapshot` adds a snapshot to the registry (a minor version bump, per the
  schema's versioning rules) rather than editing the old one.

A `governed` identity updates through `applyGovernedMetadata` instead (section 9).

Further points:

- The deployment returns the identity outpoint (`DeployResult.identity`; `deploymentIdentity()` on a contract from
  `ContractFactory`). A later session passes it in, or finds the authhead by following spends from the genesis, which
  needs a provider that reports the spender of an outpoint.
- Upgrades keep the category (`StatefulContract.upgrade` moves the master to the new lock), so the identity survives
  them.
- Destroying a contract no longer touches its identity. The authority may publish an `inactive` snapshot.

## 6. ERC-20-shaped tokens: ERC20 + BchNative

### 6.1 What wallets see

- The building blocks are in `packages/solidcash/contracts/`: `ERC20.scash` (the ledger), `ERC20Metadata.scash`
  (name, symbol, decimals), `BchNative.scash` (wrap and unwrap) and `BchNativeMultiplier.scash` (scaling). Third-party
  ledgers compose with them too: the npm OpenZeppelin ERC20 and the verbatim Tether source
  (`packages/solidcash/contracts/README.md`).
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
  (`docs/framed/SPEC_FRAMED_TRANSACTION.md`, 4b; D34). A message-bus route does not carry the container, so `wrap`
  and `unwrap` run on their own entries (D35).

### 6.2 Genesis for a native token

`nativeToken.reserve` premints the token (`packages/solidc/docs/native-usdt-port.md` recorded its absence under
"Limits that remain"). Fungible amounts can only be created in the genesis, so the premint, the identity output and
the publication land in one transaction:

```text
in   0     funding coin (vout 0)                C = its txid
in   1     token coin (vout 0)                  X = its txid
out  0     identity output, shared by C and X
out  1     BCMR publication
out  2..   masters, data NFTs, mapping heads, ...
           reserve: token-only output of X at getTokenContainerAddress(contract, C, X), amount = premint
           change
```

Without `nativeToken.funding` the premint is of C, which only the direct convention admits.

A token whose ledger starts empty and grows by `wrap` needs its supply in holders' hands first: `nativeToken.bearer`
(`{ amount, to }`) mints that bearer supply to a token-aware address in the same genesis, beside the reserve or instead
of it. The first `wrap` then creates the container.

- The premint is the ledger supply the constructor credits, divided by the native scale, plus any headroom kept for
  a later `issue`. It is at most 9,223,372,036,854,775,807.
- The SDK checks that the premint is at least `totalSupply()` divided by the scale, read from the probe genesis
  (6.4), so every ledger unit the constructor credits is backed, and that the contract keys its reserve by X: it reads
  the state variable the artifact publishes as the container key from the probe and refuses another category.

### 6.3 Field mapping

| BCMR field | Source | Rule |
| --- | --- | --- |
| `identities` key, `token.category` | X; C without `nativeToken.funding` | R8; C then has an identity of its own (5.2) |
| `name` | `name()` | |
| `token.symbol` | `symbol()` | 6.6 |
| `token.decimals` | `decimals()` minus log10 of the native scale | 6.5 |
| `description`, `uris.icon`, `uris.web`, `tags` | deploy options | Nothing on chain to read. |
| `token.nfts` | generated | Section 8; optional; on C's identity when X is separate. |
| `extensions` | AuthGuard's `authNft`; the ledger description of 6.7 | |

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

## 7. Categories created by contracts

The paths: framed `new C()` (`packages/solidcash/src/framed/deploy/create-lookahead.ts`,
`packages/solidc/docs/contract-creation.md`), the framed proxy's calling genesis, direct `deployFrom`
(`packages/solidcash/src/stateful/sc-deploy-from.ts`) and message-bus child deployments
(`packages/solidcash/src/message-bus/compose-materialize-deployments.ts`).

- The child's category is the txid of a reserved genesis-eligible coin. The transaction that spends that coin creates
  the child, so it is the child's second authchain transaction, and its output 0 is the child's identity output.
- That output belongs to the creating contract: the first participant in the framed layout, and the factory's own
  outputs come ahead of the child's in direct `deployFrom`. Section 3's exposure applies, and the identities of every
  child created through that master merge into its lineage.
- The SDK cannot fix this in the genesis, because the composition layout fixes output 0.

Options:

- **A. A census rule (framed).** The validator head refuses any output whose locking bytecode starts with
  `6a0442434d52`, so an identity held by a master can never publish through a composition. Costs: it is a new
  validator version, and every framed address derives from the validator program (`addrV`), so new deployments get
  new addresses. Masters pin their validator, so compositions that mix versions need checking. It adds roughly 20
  bytes to a head of about 8.2 KB (the spec's last measurement). The direct convention would need its own rule in
  each master covenant, which is not designed here. One exit remains: the direct `selfdestruct` covenant pins its
  destination at output 0, so destroying the master that holds an identity hands the identity to the destination.
- **B. Reserve output 0 for the child's identity** in compositions that create a category. This breaks in-place
  recreation from index 0, which the whole framed layout relies on.
- **C. Accept it and record it** in `packages/solidc/docs/deferrals.md`: wallets resolving a contract-created category
  may show attacker-published metadata.

Taken: C, recorded in `packages/solidc/docs/deferrals.md`, with A a separate decision (D32).

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

## 9. Contract-governed metadata

The goal: the contract's own access control decides its metadata, as `onlyOwner` guards `contractURI` under EVM's
ERC-7572. The identity output sits under a guard of our own (`governed` policy, `packages/solidcash/src/bcmr/governed.ts`),
keyed to the contract's category and the lock of its `MetadataUpdated(bytes32 registryHash, bytes32 identityTxid)`
event, which `packages/solidcash/contracts/BcmrGoverned.scash` emits from `updateMetadata` behind the concrete
contract's `_bcmrMayUpdate()`.

The guard cannot be spent in the transaction that emits the event: output 0 of every call is the calling contract's
own, in both conventions. So the update spends the event NFT as an input once it may be spent, 144 blocks after the
emit, which also announces every change a day ahead. The guard spends only when:

1. the input its unlocking names holds an immutable NFT of C at the event's lock;
2. that event's arguments are the hash output 1 publishes and the guard's own outpoint txid (an identity output is
   always output 0, so the txid is the whole outpoint);
3. output 0 recreates the guard, and output 1 starts with the publication prefix and that hash.

Why this holds:

- Only the contract's code mints event NFTs of C. Compositions refuse unlisted immutable NFTs of a settled category
  (the census), and nothing else holds a minting NFT of C. The function that emits the event, with its `onlyOwner`,
  timelock or DAO, is therefore the authority. Anyone may apply a matured authorization, which can only publish what
  it names.
- The outpoint binding is required. Anyone can spend an event NFT after 144 blocks and send it back to its event lock
  in a plain transaction, so without the binding an old authorization would replay. The update also burns the
  authorizing NFT.
- An event that writes its arguments in EVM notation (`evmCompat`) packs them as two 32-byte words; the guard reads
  either notation, as the artifact states it.
- `governedAuthorization` gives the two arguments: the registry's SHA-256 and the identity txid in the byte order
  `OP_OUTPOINTTXHASH` answers. `applyGovernedMetadata` builds the update: the guard at input 0, the event at input 1
  under its relative timelock, then the fee coin.
- Standard AuthGuard does not fit: it requires the AuthKey at input 1, and in a framed composition input 1 is a
  participant.

## 10. SDK surface

The module is `packages/solidcash/src/bcmr/`, exported as `solidcash/bcmr`.

```ts
interface DeployOptions {
  // ...existing fields...
  identity?: IdentityPolicy;           // default: { kind: 'key' } at the deployer's lock
  bcmr?: BcmrPublication;              // omitted: no publication output
  nativeToken?: {                       // the token's own category, its premint and bearer supply, its native scale
    funding?: Utxo; funder?: Unlocker; reserve?: bigint; bearer?: { amount: bigint; to: string }; scale?: bigint;
  };
}

type IdentityPolicy =
  | { kind: 'key'; lockingBytecode?: Uint8Array | string }
  | { kind: 'authguard'; authKeyFunding: Utxo; authKeyFunder?: Unlocker; authKeyRecipient?: Uint8Array | string }
  | { kind: 'frozen' }
  | { kind: 'burned' }
  | { kind: 'governed' };

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

interface DeployResult {
  // ...existing fields...
  identity?: IdentityRecord;           // { txid, vout: 0, satoshis, policy, lockingBytecode, authKeyCategory? }
  registry?: PublishedRegistry;        // { registry, json, bytes, sha256, uris }
}

declare function publishMetadata(options: PublishMetadataOptions): Promise<PublishMetadataResult>;
declare function applyGovernedMetadata(options: ApplyGovernedMetadataOptions): Promise<{
  tx: TransactionDetails; identity: IdentityRecord; registry: PublishedRegistry;
}>;
```

`ContractFactory` passes `identity`, `bcmr` and `nativeToken` through, and its deployed contract answers
`deploymentIdentity()` and `deploymentRegistry()`.

## 11. Implementation map and tests

Tests run on mocknet only, which is the user's standing rule.

| Part | Code | Tests |
| --- | --- | --- |
| Identity output in every genesis, the five policies, the identity-output rule | `bcmr/identity.ts`, `bcmr/authchain.ts`, `stateful/sc-deploy.ts`, `framed/deploy/stateful.ts`, `framed/deploy/own-coin.ts` | `test/e2e/BcmrDeployment.test.ts`; `test/framed/deploy/proxy-deployment.test.ts` pins the shifted framed layout |
| Publication, registry, IPFS CID, `publishMetadata`, opt-in AuthGuard | `bcmr/publication.ts`, `bcmr/registry.ts`, `bcmr/publish.ts` | `BcmrDeployment.test.ts` (AuthGuard evaluated by the VM) |
| ERC-20 fields, premint, probe check | `bcmr/deployment.ts`, `bcmr/token.ts` | `BcmrDeployment.test.ts` with `test/fixture/bcmr_metadata_token.scash` |
| Contract-created categories | option C in `packages/solidc/docs/deferrals.md` | |
| Generated NFT labels | `bcmr/nft-parse.ts`, `bcmr/nft-roles.ts` | `test/e2e/BcmrNftParse.test.ts` |
| Contract-governed metadata | `bcmr/governed.ts`, `contracts/BcmrGoverned.scash` | `test/e2e/BcmrGoverned.test.ts` |
| BchNative's own bearer category | `contracts/BchNative.scash`; the `state` container key in `packages/solidc/src/semantic/SymbolTableTraversal.ts` and `stateful/sc-load-create-builder-token-containers.ts` | the BchNative e2e files; `test/e2e/BchNativeFramed.test.ts` (framed genesis, wrap, unwrap, drain) |

Paths are under `packages/solidcash/` unless stated.

## 12. Decisions

- AuthGuard is opt-in and never the default: D31, the user's answer.
- BchNative's bearer form is a category of its own: D33.
- The open decisions this design listed were taken as its own recommendations when it was implemented: D32. The
  default identity is `key`; stated ERC-20 fields are checked and refused on mismatch, the symbol case-insensitively;
  the native scale is explicit; contract-created categories take option C; the reserve is named by an extension;
  contract-governed metadata is in; internal categories take the token default.

## 13. References

- CHIP-BCMR, `bitjson/chip-bcmr` at `0e8417ccf38798f4ebe66e228f4d1908249cb8fd`:
  https://github.com/bitjson/chip-bcmr (also `reserved-token-symbols-cryptocurrencies.json` and
  `bcmr-v2.schema.ts` there).
- CashTokens: https://github.com/cashtokens/cashtokens ("Token Categories", "Fungible Token Supply Definitions").
- AuthGuard, CHIP-2023-08 v0.1.2: https://github.com/mr-zwets/AuthGuard
- OpenTokenRegistry submission checklist:
  https://github.com/OpenTokenRegistry/otr.cash/blob/master/.github/pull_request_template.md
- libauth 3.1.0-next.8: `build/lib/engine/types/bcmr-types.d.ts`, `build/lib/schema/bcmr.js`
  (`importMetadataRegistry`).
- This repository: `packages/solidc/docs/native-erc20.md`, `packages/solidc/docs/native-usdt-port.md`,
  `packages/solidcash/contracts/README.md`, `docs/framed/SPEC_FRAMED_TRANSACTION.md`,
  `website/docs/guides/deployment.md`, `website/docs/guides/cashtokens.md`.
