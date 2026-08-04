# Native-token ERC-20 (design)

Status: DESIGN (brainstorm). No implementation yet.

## Session handoff (last updated 2026-07-25)

Read-this-first for a cold start. This doc is the full reasoning; below is the decision state and where to
resume. Companion memory: `native_erc20_design.md` (dense per-turn log). Nothing is implemented - it is all
design.

**Architecture DECIDED - Model A (FT-on-entry) is primary.** The token is a wrapped ERC-20 ledger whose
balances are REAL category-X CashTokens FTs sitting on entry NFTs (value in the NFT's `tokenAmount` field,
not in commitment bytes). No virtual-value mappings. It IS a wrapped asset (balances at P2SH32 covenants,
moved by co-spending the master) - which is a faithful port of what ERC-20 already is; native self-custody
is the WITHDRAWN form (WETH-style wrap/unwrap). Consensus FT conservation makes inflation impossible even
against a buggy contract - the strongest "untouchable supply" possible.

**The load-bearing decisions (all with reasoning in the body):**
- **Supply is normative**: full premint at genesis into a reserve; `mint` = release reserve into circulation;
  `T (circulating) <= initialSupply` forever; open-ended minting is categorically unsound on BCH. Two burns:
  permanent (omission / OP_RETURN) and returning (`burnToReserve`). Two-number reporting: tracked `T` (ledger
  authority) `>= ` effective `E` (indexer sum); the gap is untracked bearer burns.
- **Balances are multi-note**: `balanceOf(owner) = sum of the owner's notes`. The masterless path is
  OWNERSHIP-PRESERVING ONLY (split / merge / consolidate; owner-sig + an output-scan proving every category-X
  note output keeps the same owner tag). Any OWNERSHIP CHANGE (transfer), plus every ledger-boundary crossing
  (withdraw / deposit / mint / burn), co-spends the master. Net: policy is always enforceable on transfers AND
  self-management is always parallel, in both presets.
- **Reserve** lives on a dedicated token container (a general primitive, not a custom vault); untouchable by
  construction. In Model A the reserve's `tokenAmount` IS `R` - no stored counter, no drift.
- **Allowances** are spender-side authority; `transferFrom` is ALWAYS master-gated (so it always checks the
  allowance). `permit` (via native `checkDataSig` / shipped `ecrecover`) is recommended first-class.
- **Compliance is whitelist-driven, not blacklist-driven**: only ledger-witnessed actors are "white"; the
  white zone is a closed graph; contracts are first-class allow-list nodes (cross-chain bridges are white by
  construction). Registered self-custody (Model B) is a SEPARATE product - it needs a virtual mirror plus the
  attestation / maturity / floor / restriction machinery, which is the price of self-custodying the tracked
  balance.
- **The boundary is QUARANTINED admission - THE PURSUED DESIGN** (2026-07-25): unwrap freely to bearer P2PKH; re-entry lands in a
  pending note that matures after `X` blocks (BIP68 `sequenceNumber` equality-pin, consensus-tracked age -
  not a self-declared height), then a PERMISSIONLESS `claim` credits the balance. The issuer's only power is
  blacklisting the claimant inside the window, so the issuer is never a liveness dependency and refusals are
  on-chain auditable; `cancel` always returns the funds to the depositor, making confiscation structurally
  impossible. The pending note is a PURE-FT output at a covenant parameterized per `(claimant, depositor)` -
  tags in the SCRIPT, no NFT - because minting an NFT of category X would need the master and would serialize
  every deposit. Deposits are therefore parallel. EXIT posture is a deploy-time covenant variant, both
  audited: freedom (instant, freeze escapable) vs compliance (symmetric cooldown + master `recall`). Honest
  scope: admission control plus travel-rule-at-the-boundary, NOT seizure; the veto is actor-based because
  coin-level taint cannot survive FT mixing in the bearer zone.

**WHERE WE STOPPED / resume here:**
1. Owner-tag encoding in the BALANCE note commitment + the exact signature-check mechanics on the masterless
   path (owner identity binding; EOA-keyed vs contract-owned notes). Candidate, upgraded by the 128-byte
   commitment: store the FULL locking bytecode (25 B P2PKH / 35 B p2sh32) and compare it directly, rather
   than the lossy `hash160(lbc)` a 40-byte budget would have forced. Still the immediate next topic.
2. `mint` / `burn` / reserve behavior under the multi-note model.
3. Still-open product decisions: cooldown defaults `X` / `Y` (flat, not amount-tiered - tiering invites
   structuring), remaining admission/exit variants beyond the two presets, `decimals` default + hard check.
   See "Open decisions".
4. Then P1 implementation scope (see "Phasing"); the pending-note covenant lands in P4.

**Doc map**: CashTokens ground rules; Supply model (normative) + tracked-vs-effective; The general-model
realization: FT-on-entry (the primary architecture) incl. wrapped-asset nature, contention, and the
masterless ownership-preservation rule; Reserve storage and untouchability; Self-custody / enforcement
polarity (registered P2PKH = Model B, maturity, floor, closed graph); Soundness assessment; Allowances;
Re-centering on user custody (registry model = Model B pole); Phasing; Open decisions.

**Codebase anchors** (re-verified 2026-07-25; SYMBOL names are the durable handle - line numbers drift, so
grep the symbol first):

- `buildEntryNftCovenantScript` - `packages/utils/src/state.ts:1425`. Write path (flag=1, `state.ts:1430`) is
  master-gated ONLY: it verifies the minting NFT at `masterInputIndex` and places no output constraint. All the
  self-preservation / commitment / `outAmount >= inAmount` / exact-satoshi guards live in the read path
  (`OP_ELSE`, `state.ts:1446-1494`). This is why master-authorized FT DECREASES on entries are already legal =>
  Model A needs no covenant change.
- `buildTokenContainerCovenantScript` - `state.ts:1783`. Master path (`state.ts:1790`) = pure auth; merge path
  (`state.ts:1801`) = consolidate-only (`lbc` / `value >=` / `amount >=` / category) + the anti-double-merge
  single-input loop (`state.ts:1827-1852`).
- `emitTokenContainerPreservation` - `GenerateTargetTraversal.ts:20294`; dispatched at `GTT:2402`, alongside
  `emitTokenContainerIdentityVerification` (`GTT:2396`) and `emitTokenContainerTransferCovenantVerification`
  (`GTT:2399`) - all three gated `!this.functionHasDelegatecall`.
- `emitMsgSender` dual-path - `GTT:18899` (zero category => `emitTxOrigin`, else
  `emitMsgSenderMintingVerification` at `GTT:18981`). `emitTxOrigin` - `GTT:18660` (scans the first
  NON-token-bearing P2PKH input).
- `.sequenceNumber` in grammar - `SolidCash.g4:701` (`UnaryIntrospectionOp`), token `SolidCash.g4:993`.
- SDK tx `version: 2` - `TransactionBuilder.ts:774`.
- Entries minted `amount: 0n` today - `packages/solidcash/src/stateful/StatefulContract.ts:1468-1538` (deploy
  path; ~225 `amount:` sites across `src/stateful/`, so the P1 SDK change is broad but mechanical).
- `ERC20.sol` already compiles virtually: NOT in-tree. It is the SBE bench corpus at
  `/Code/solidity-by-example/contracts/src/app/erc20/` - a sibling checkout pinned in
  `examples/solidity-by-example/SBE_SOURCE.md` (`_bench/` is generated and empty in a fresh tree).

---

The question: an ERC-20 drop-in replacement whose token is a REAL CashTokens fungible token (FT amounts on
UTXOs, spendable by any token-aware BCH wallet), not "virtual" balances living in mapping commitments - while
keeping the full ERC-20 surface: `transfer`, `approve`/`transferFrom` allowances, blacklists, mint/burn, and
events. The hard constraints come from the CashTokens spec (github.com/cashtokens/cashtokens): fungible
supply is minted ONCE, at genesis, to its maximum; and natively-held tokens have no hook for allowances or
blacklists (nobody can move or freeze a UTXO its owner controls).

## CashTokens ground rules

What consensus gives us (and takes away):

- A token category is created by spending an outpoint with index 0; the category ID is the txid of the
  transaction that created that outpoint. Genesis is the ONLY transaction that can create fungible amounts
  of the category. Max total: 9,223,372,036,854,775,807 base units (int64).
- Post-genesis, per category: `sum(output FTs) <= sum(input FTs)`. A shortfall is an implicit burn -
  permanent, consensus-enforced deflation. There is no way to mint more, ever.
- NFTs and FTs of the same category coexist (one output can carry both). A minting-capability NFT can mint
  new NFTs of the category forever - but never FTs. Commitments are <= **128 bytes** since the May 2026
  upgrade (`commitmentLimit: 128`, `compiler.ts:84`; the pre-upgrade limit was 40); token outputs need dust.

The killer consequence: **the supply cap is consensus-enforced**. Even a maximally buggy or malicious ledger
contract can never inflate the token past its genesis amount. EVM ERC-20 cannot offer this - every
"infinite mint" exploit in EVM history is structurally impossible here. That alone justifies real-FT backing
even for tokens that never leave the ledger.

## Supply model (normative)

Ruling (2026-07-10): **the infinite-mint model is unsound on BCH, categorically.** Every token project MUST
premint its full supply at genesis into a reserve; "mint" means minting into the CIRCULATING supply, and
circulating supply can never exceed the initial premint. This is not a design preference of this doc - it
is the only sound model the platform admits. The three ways around it all fail:

- **Consensus**: fungible amounts of a category can never increase post-genesis ("All fungible tokens of a
  category are created in that category's genesis transaction" - spec). No workaround exists at this layer.
- **Sibling categories**: minting a new category per "mint" and calling it the same token breaks
  fungibility at the consensus layer - categories never merge; every wallet, DEX, and covenant sees
  distinct assets. Not the same token.
- **Unbacked accounting**: treating mint as a ledger-only credit is the IOU scheme, rejected above.

**Terminology (normative for the template and SDK):**

- `initialSupply` (= `cap`): the genesis premint, forever fixed.
- `T` = circulating supply, what ERC-20 `totalSupply()` reports. Starts at 0 (or at an initial
  circulating tranche minted in the deploy fold).
- `R` = reserve: preminted, uncirculated supply, held on the reserve container UTXO (the "total-supply
  UTXO holder"). `mint(to, x)` requires `x <= R` and moves x into circulation.

**Burns, two flavors (both ship; decided 2026-07-10):**

- **Permanent**: implicit omission (output sums less than input sums - "Tokens can be implicitly destroyed
  by omission from a transaction's outputs") or an explicit send to an OP_RETURN output - the spec's own
  supply definitions treat these as "provably-destroyed outputs (spent to OP_RETURN outputs)". OP_RETURN
  burns leave an explicit on-chain artifact; implicit omission is cheaper. Both: `T -= x`, irreversible.
- **Returning**: physical send back to the reserve container; `R += x`, `T -= x`, re-mintable later.

**Supply invariant**: `T + R + permanentlyBurned == initialSupply` at all times, so `T <= initialSupply`
forever, even with returning burns recycling through R - and consensus independently guarantees the sum of
all X in existence never exceeds `initialSupply - permanentlyBurned`.

**Drop-in consequence (v3, normative):** Solidity sources with unbounded `_mint` (uncapped OZ ERC20 et al.)
compile to reserve-release semantics with a MANDATORY `initialSupply` deploy parameter; `mint` reverts when
R is exhausted. A diagnostic states the semantics change. There is no compile path that emulates
open-ended minting - such a path would be unsound, not merely nonstandard.

### Tracked vs effective supply (the two-number model)

Existing BCH token projects each track circulating supply their own way, usually leaning on heavy indexer
use (Fulcrum, Chaingraph). Mimicking the ERC-20 central ledger buys us the freedom to DEFINE the number
instead: the ledger is the authority for **tracked supply**, and the chain (via indexers) reports
**effective supply**. Two numbers, different jobs:

- **Tracked supply `T`** - central, ledger-guarded, on-chain state; what `totalSupply()` returns. Changes
  ONLY through ledger ops: mint (reserve release) increments; white burns through the contract decrement.
  Deterministic, indexer-free, readable by anyone.
- **Effective supply `E`** - the grand sum of all category-X tokens actually in existence outside the
  reserve, minus provably-destroyed outputs. Indexer-computed ground truth.

**Ceiling theorem: `T >= E`, always.** E can only increase via mint (the reserve container releases only
through T-incrementing ledger ops; consensus forbids any other source), and every ledger burn decrements
both. The single divergence source is bearer-side permanent burns (omission or OP_RETURN done outside the
contract): they decrement E and cannot decrement T. So `T - E == cumulative untracked bearer burns` -
divergence is one-directional, monotonic, and itself a meaningful public statistic. The numbers will
commonly diverge; soundness is untouched - no invariant anywhere depends on `T == E`, and the ledger
identity `T + R + ledgerBurned == initialSupply` holds regardless.

The decomposition is sharper than a single bound: `T = W + B` where `W = sum(mirrors)` is the white supply
(EXACT - the ledger knows its own jurisdiction perfectly) and `B = T - W` is the bearer ceiling (upper
bound; indexers refine it to the actual bearer holdings). In the compliance preset with no bearer exit,
`B == 0` and `T == E` exactly.

**Signaling (the ledger advertises its state):** all four ledger numbers are on-chain and indexer-free -
`initialSupply` (constant in the artifact), `R` (the reserve container's PHYSICAL tokenAmount - natively
indexable, no commitment parsing), `T` and optionally `W` (state-var commitments), plus mint/burn event
NFTs as a subscription stream. Ledger-side OP_RETURN burns can carry a protocol marker so explorers
attribute them. BCMR metadata points at all of it.

EVM parity footnote: ERC-20 `totalSupply()` has exactly these ceiling semantics already - tokens burned to
dead addresses or stranded by lost keys still count - but EVM cannot measure the divergence. Here the
tracked/effective split makes it explicit and computable, which is strictly more honest.

## Design space

- **A. Fully native (non-custodial).** Tokens live in user wallets; `transfer` is a plain send. No
  `approve`/`transferFrom` (nothing can move a UTXO without its owner's key at spend time), no blacklist, no
  `Transfer` events, `balanceOf` is an indexer query. Not a drop-in - it is just a token.
- **B. Escrowed allowances.** `approve` moves FTs into a per-(owner, spender) covenant the spender can pull
  from. Breaks ERC-20 semantics: approving locks funds, you cannot approve more than balance, and the owner
  cannot spend approved funds in the meantime. Niche tool, not a drop-in.
- **C. Per-holder covenant vaults.** Every holder's tokens sit in a policy-enforcing covenant keyed to them.
  Wallet-incompatible, every policy change is a migration, and shared-state reads contend.
- **D. Master ledger + native bridge (chosen).** The contract is a ledger with the exact ERC-20 surface
  (balances/allowances mappings, events, blacklist), and it CUSTODIES real FTs 1:1 against the sum of ledger
  balances. `withdraw`/`deposit` bridge between ledger entries and native custody.

D is WETH inverted: the ledger IS the ERC-20 (wrapped form), native FTs are the unwrapped form, and
deposit/withdraw are wrap/unwrap. In-ledger you get full ERC-20 parity including allowances and blacklist
(that is where DeFi composability lives); withdrawn, you hold real tokens - self-custody, any CashTokens
wallet, plain sends, no covenant.

## The model

**One category `X` = contract identity = the token.** The contract's own state category doubles as the token
category. Users' withdrawn tokens are plain category-X FTs (no NFT); the contract's state NFTs share X (the
SDK's `resolveCategoryFromAddress` is already token-aware). A new deploy is a new category - same as "new
contract, new token" in EVM.

**Genesis (single tx).** The existing deploy flow already spends a vout-0 funding outpoint (category = its
txid) and mints the master thread NFT (minting capability), data NFTs, optional pre-seeded entries, all with
`amount: 0n` (`src/stateful/StatefulContract.ts:1468-1538`). The one SDK change v1 strictly needs: also mint `cap` FTs of
X at genesis, onto the contract's token container output.

**State.**

```text
mapping(address => uint)                     balances;      // ledger
mapping(address => mapping(address => uint)) allowances;
mapping(address => bool)                     blacklisted;
uint R;        // unminted reserve counter (starts at cap)
uint T;        // totalSupply (starts at 0)
address owner;
constants: name, symbol, decimals, cap
```

**Pool.** The circulating-but-in-ledger FTs plus the unminted reserve sit together as one FT amount in the
contract's **token container** (`buildTokenContainerCovenantScript`, `state.ts`): master-path spends only
(requires the minting NFT co-spent), merge path preserves category and FT amount. The language already reads
it: `this.tokens[X].tokenAmount`. "Minted vs unminted" is pure accounting (`R`, `T`); minting moves nothing
on-chain.

## Method-by-method

| ERC-20 op | UTXO mechanics | status |
|---|---|---|
| `constructor` | genesis mints `cap` FTs to container; `R = cap`, `T = 0` | SDK: genesis FT amount (small) |
| `totalSupply()` | state var `T` | exists |
| `balanceOf(a)` | mapping entry read | exists |
| `transfer(to, x)` | master + sender/recipient entries co-spent; debit/credit; blacklist checks; `Transfer` event NFT | **exists today** (= current virtual ERC-20) |
| `approve(s, x)` | nested-mapping entry write keyed (msg.sender, s); `Approval` event | exists |
| `transferFrom(f, to, x)` | debit `allowances[f][msg.sender]` + move balances | exists |
| `mint(to, x)` owner-only | `require(x <= R); R -= x; T += x;` credit `balances[to]`; pool FT amount unchanged | template work only |
| `burn(x)` | debit balance; `T -= x`; the `x` appears on NO output (implicit omission) or on an OP_RETURN output = provably destroyed | template requires over `tx.outputs[..].tokenAmount` (introspection exists) |
| `burnToReserve(x)` | debit balance; physical return to reserve container; `R += x` (re-mintable) | template work only |
| `withdraw(x)` / `withdrawTo(a, x)` | debit `balances[msg.sender]`; container master-path spend pays `x` FTs of X to the target locking bytecode; blacklist-gated | new template fn; machinery exists |
| `deposit(x)` | caller supplies inputs carrying `x` FTs of X; covenant requires container output amount `+= x`; credit `balances[msg.sender]`; blacklist-gated | new template fn; machinery exists |
| events `Transfer`/`Approval` | event NFTs (log0-4 lowering + SDK ethers-v6 events facade) | exists |
| `name`/`symbol`/`decimals` | on-chain constants; ALSO publish BCMR metadata so wallets display the native form correctly | template + deploy-time BCMR |

`msg.sender` uses the existing dual-path model (`GenerateTargetTraversal.ts:13307-13456`): P2PKH locking
bytecode of the spending origin for EOA-style calls, or the co-spent minting-NFT input's locking bytecode for
contract callers. So allowances work for both users and contracts, including contract-to-contract
`transferFrom` - which is the entire point of allowances. `address` is locking bytecode (variable length);
mapping keys are pushdata-encoded, so lbc keys are fine as-is.

### Sketch of the bridge + burn requires

```text
function withdraw(uint x) {
    require(!blacklisted[msg.sender]);
    balances[msg.sender] -= x;                     // reverts on underflow
    // container: master path, amount out = amount in - x
    require(tx.outputs[CONTAINER].tokenAmount == tx.inputs[CONTAINER].tokenAmount - x);
    require(tx.outputs[PAYOUT].tokenCategory == X);
    require(tx.outputs[PAYOUT].tokenAmount == x);
    require(tx.outputs[PAYOUT].lockingBytecode == msg.sender);
}

function burn(uint x) {
    require(!blacklisted[msg.sender]);
    balances[msg.sender] -= x;
    T -= x;
    // x rides NO output: consensus destroys it
    require(tx.outputs[CONTAINER].tokenAmount == tx.inputs[CONTAINER].tokenAmount - x);
    // plus: no other output carries category X (bounded scan / output-count pin)
}
```

(Illustrative; the real template also pins output count / other-output categories so the debited amount
cannot resurface on an attacker output.)

## Solvency invariant

Let `S = sum of all ledger balances` (implicit; the covenant never needs to read it). Claim:
`pool >= R + S`, with equality up to donations. By induction over every state transition:

- genesis: `pool = cap, R = cap, S = 0`
- `mint`: `R -= x, S += x`, pool unchanged
- `transfer`/`transferFrom`/`approve`: `S` unchanged, pool unchanged
- `burn`: `S -= x`, `pool -= x` (and `T -= x`)
- `burnToReserve`: `S -= x`, `R += x`, pool unchanged
- `withdraw`: `S -= x`, `pool -= x`
- `deposit`: `S += x`, `pool += x`
- read-only / merge paths: covenant enforces `pool >=` (FT-preservation guards already in
  `state.ts` entry + data + container covenants)

So every ledger balance is always withdrawable and every mintable unit is backed - and consensus
independently guarantees `pool <= cap - burned` forever. The covenant maintains the invariant purely by
matching per-method deltas (each method touches known entries and requires the matching container delta), so
it never needs global state.

## What exists vs what is new (recon 2026-07-10)

Verified against the codebase:

- **msg.sender / identity**: dual-path lowering exists (`GenerateTargetTraversal.ts:13307`).
- **Token introspection**: full set in grammar + codegen (`tx.inputs[i]/tx.outputs[i]
  .tokenAmount/.tokenCategory/.nftCommitment`, plus `this.tokens[cat].tokenAmount` aggregates).
- **FT-preservation guards already shipped**: data NFT covenant (`state.ts:143-149`), entry NFT read path
  (`state.ts:1354-1360`), container merge path - FTs parked on state UTXOs cannot be drained by readers.
- **Entry write path is master-gated with NO self-preservation** (`state.ts:1302-1373`): master-authorized
  FT decreases on entries are already legal. This makes v2 below covenant-free.
- **ERC20.sol already compiles virtually** (`examples/solidity-by-example/.../app/erc20/`): balances lower to
  entry-NFT commitments. v1 is "re-back that contract with real FTs", not "build an ERC-20".
- **New**: genesis FT amount in the SDK deploy; the bridge + mint/burn template methods; BCMR emission.

## v2: balances ARE tokens (FT-on-entry)

PROMOTED TO PRIMARY - see "The general-model realization: FT-on-entry" below for the full treatment
(consensus-enforced integrity, inflation-proofness, and the no-virtual-value/self-custody fork). Kept here
as the original refinement note.

Refinement that removes the double-entry: the `balances[addr]` entry NFT carries the balance as its **FT
amount** (commitment holds only the key). `balanceOf` = the entry's `tokenAmount`; `transfer` moves FTs
between entry UTXOs under the master write path; `withdraw` peels FTs directly off your own entry. The
balance IS tokens - indexers and explorers literally see holdings as token amounts, and a
misaccounting class (mapping value vs pool drift) vanishes structurally.

Needs: SDK creates/reads entries with `amount > 0n` (today hardcoded `0n`; the covenant already tolerates
and guards amounts), and a compiler lowering for "mapping value backed by tokenAmount" (annotation like
`mapping(address => uint) native`, or special-cased in the ERC-20 template). Zero-balance entries are valid
(NFT with amount 0). Entry covenant needs NO change.

## v3: drop-in compile of unmodified Solidity

`solidityImportCompat` substitutes the OZ/standard `ERC20` base contract with the native template, so
existing Solidity token sources compile to native-FT-backed artifacts unchanged. Required diagnostic:
`cap * 10^decimals > 2^63 - 1` is a compile error suggesting a decimals reduction (see gaps below).

## Self-custody transfers and the ledger (enforcement polarity)

### Can native hops be forced to update the ledger? No - and the "why" is the design input

- Script runs only when a UTXO is spent, and only the script OF that UTXO. There are no standing hooks,
  observers, or on-transfer callbacks anywhere in the BCH model.
- P2PKH's locking script is a bare sig check: no introspection, so it cannot require a ledger co-spend, an
  extra output, or anything else about the transaction.
- CashTokens validation is pure per-category amount conservation - deliberately hook-free.
- A covenant constrains only its own transaction's outputs. The moment an output is plain P2PKH, all forward
  control is gone, permanently.

So "enforce X on every transfer" requires X to live in the custody script. The custody script is the ONLY
lever; everything below is choosing a custody shape.

### The custody spectrum

1. **In-ledger cells (= v2 FT-on-entry).** Your `balances[you]` entry, master-gated writes, debits only via
   methods you authorize (`msg.sender` / allowance). Already self-custody-modulo-script: the covenant is
   immutable, the master co-spend is permissionless, nobody but you can move your balance - but the script's
   policy (blacklist et al.) binds you. Ledger-conscious by construction. Costs: master serialization,
   no plain-wallet UX.
2. **Vault custody.** `withdraw` restricted to a `Vault(owner)` template whose spend path requires the master
   thread co-spent (input-scan for the category-X minting NFT - same loop as msg.sender verification), so
   every native hop IS a ledger call (`transferNative()`). Per-hop policy works. Functionally this converges
   with (1); it exists as a separate shape mainly if vault UTXOs should live outside the mapping.
3. **Registered P2PKH (attested self-custody).** Tokens sit in the user's plain P2PKH; the ledger keeps a
   mirror balance `registered[addr]`. Every ledger-tracked op requires the user to PRESENT their holdings:
   the covenant loops the tx inputs, sums category-X FT amounts at the sender's locking bytecode, and
   requires `sum >= registered[from]` - then enforces conservation on the output side (transfer amount to
   recipient's P2PKH, remainder back to sender's P2PKH, no other X outputs). Wallet-compatible custody +
   ledger tracking; sync is attested per-op and continuously auditable by any indexer. Defection (a bearer
   spend below the registered amount) is not preventable - but it is self-punishing: the defector can no
   longer meet the attestation, so the covenant automatically excludes them from all white ops. Detailed
   below.
4. **Tagged notes (traceable bearer).** A sibling note covenant: owner-sig spend path that must preserve
   script/category/amount-sum and rewrite the owner tag in the commitment (splitting allowed: pay 30, change
   70, both at the same covenant address). No master co-spend: contention-free and the trail is fully
   indexable - but no per-hop policy reads (no blacklist mid-flight), no allowances, and notes are non-unique
   (balance = sum of notes), so this is a separate instrument, not mapping entries. A trail, not a ledger.
5. **Plain P2PKH (unregistered).** Bearer cash. No sync, by design. All hops remain publicly observable
   on-chain (indexers can follow category X), but nothing is enforceable.

### Registered P2PKH: attestation mechanics

The white-transfer transaction: master thread + `registered[from]` + `registered[to]` entries co-spent, plus
ALL of the sender's category-X UTXOs as ordinary signed P2PKH inputs. The covenant (all with existing
opcodes and codebase patterns - the input-scan loop is the same shape as the satoshi-container and
msg.sender scans):

```text
S_in  = sum over inputs  i: tx.inputs[i].tokenAmount  where lockingBytecode == fromLbc
                                                        and tokenCategory == X (pure FT, 32-byte category)
require(S_in >= registered[from]);                      // the attestation
require(sum X outputs at toLbc   == x);                 // delivery, plain P2PKH
require(sum X outputs at fromLbc == S_in - x);          // change returns to sender
require(no other category-X FT outputs);                // bound via output loop
registered[from] -= x;  registered[to] += x;            // ledger mirror + Transfer event
```

State NFTs share category X but carry a capability byte (33-byte `tokenCategory`), so the loops distinguish
them from pure-FT holdings for free. In steady state the SDK consolidates each op's change to one UTXO, so
attestation is 1-2 inputs, not a wallet-dump.

**Why `>=` and not `==`.** Two independent reasons. On-chain: "these are ALL my UTXOs" is a universal
negative over the global UTXO set - script sees only the current transaction and cannot prove absence of
other UTXOs. Off-chain: `==` auditing is dust-griefable (anyone can send 1 base unit to a registered address
and break its equality). So the invariant is one-sided everywhere: `P2PKH total >= registered[addr]`, on-chain
at op time, indexer-audited continuously. Surplus = unregistered-but-present, registerable via sync-up.
Holding LESS than registered is the one state that can never be attested - which is exactly the defection we
want visible.

**Lifecycle ops.** `register`/sync-up (present surplus UTXOs, mirror increases; admission-gated in the
compliance preset); `deregister` (mirror decreases, tokens stay put - the freedom preset's voluntary exit;
the compliance preset omits it, making defection the only exit and thus always visible); reconcile-down
after defection (compliance preset: issuer co-sign = confession + amnesty).

**Limits, honestly.**
- Attestation is point-in-time: a colluding lender can park tokens at `fromLbc` before the op and take them
  back after ("rented reserves", the classic proof-of-reserves critique). Mitigated by ownership maturity
  (next subsection); the continuous indexer audit provides standing between ops.
- `transferFrom`/allowances do not work here: a spender cannot sign the owner's P2PKH inputs. Composability
  remains pool-only; registered custody supports `transfer`, not delegation.
- A white transfer auto-registers the recipient, whose ordinary wallet behavior would then read as
  defection. The compliance preset should require recipients to be already-registered; the freedom preset
  does not care (a stale mirror entry is harmless there).
- Registered balances are NOT pool-backed: they live outside the `pool >= R + S` invariant, backed instead
  by the attested-and-audited holdings themselves. Keep `registered[]` a separate mapping from pooled
  `balances[]`; moving between the two custody forms is deposit/withdraw with the pool delta.

What this shape buys: per-address, continuously verifiable **proof of reserves** for the white set (anyone
can audit `sum(P2PKH) >= registered[addr]` for every registered address), with plain-wallet receiving and
holding, at the cost of enforcement being detect-and-exclude rather than prevent.

### Ownership maturity: closing the rented-reserves hole

Funds received from elsewhere count as white-owned only after maturing for X at the owner's address. BCH has
a consensus-native primitive for exactly this - BIP68 relative age - so maturity is tracked by consensus,
not bookkept in master state:

- The registration/sync-up covenant loop requires `tx.inputs[i].sequenceNumber == <X encoded>` for every
  counted surplus input (one OP_NUMEQUAL per input; no bit-masking needed when the value is pinned exactly).
  A set nSequence activates BIP68: consensus rejects the transaction unless that input's prevout is actually
  >= X old. The covenant checks a declaration; consensus enforces the age. Verified available:
  `.sequenceNumber` introspection is in the grammar (SolidCash.g4:685) and SDK transactions are already
  version 2 (TransactionBuilder.ts:418), which BIP68 requires.
- **Where maturity applies**: registration/sync-up (mirror increases) and the off-chain standing audit
  (indexers count only UTXOs with >= X confirmations - trivial height arithmetic). **Where it does not**:
  white-transfer attestation and ledger-tracked receipts. White receipts are instantly white - the ledger
  itself moved them - and transfer-time attestation is conservation, not proof (presented tokens actually
  move with the mirror), so aging them would only break velocity, including your own change UTXOs.
- **Why UTXO-age beats ledger-bookkept maturity** ("announce now, mature later" in master state): calendar
  maturity without binding the tokens is re-rentable at both ends - rent at announce, return, rent again at
  finalize. nSequence binds THE TOKENS themselves to X at the owner's P2PKH: renting becomes an X-long
  custody grant to the borrower's key, i.e. real ownership risk. Economically dead for meaningful X.
- Parameters: BIP68 encodes blocks or 512-second units, max 65535 (~455 days by blocks); per-deploy
  constant, e.g. 144-4320 blocks (~1-30 days) in the compliance preset. Age resets on self-spend, but only
  registration needs age, so the flow is consolidate, wait X, register. (Precedent: coinbase maturity - the
  same defense at Bitcoin's consensus layer.)
- Residual: a vetted-member position trade (rent, age X, white-transfer to the lender's own white address)
  remains possible. Acceptable: both ends are allow-listed, so this is admission-approved counterparties
  trading positions, not an escape from the regime.

### Balance floor: white never goes black, it goes restricted

Rule: a registered account must always hold >= `X_floor` to advance the ledger, and white ops must LEAVE it
at >= `X_floor` on both sides of the mirror (`registered[from] - x >= X_floor`, change at `fromLbc >=
X_floor`). Registration requires >= `X_floor` to begin with; full exit happens only through explicit
`deregister` (freedom preset) or issuer-approved exit (compliance preset).

The important consequence: **"restricted" is not stored state - it is the attestation failing.** An account
whose holdings fall below its mirror simply cannot advance the ledger; top the address back up and ops
resume, permissionlessly. Standing is evaluated per-op against live holdings, never bookkept, so there is no
reconciliation problem to administer and nothing to rebalance: the system is self-rebalancing by
construction. The effective states:

- **in-standing**: holdings >= mirror >= floor; full ops.
- **restricted**: holdings < mirror; ops fail until topped up; identity, mirror, and auditability persist -
  the account stays inside the ledger's jurisdiction. A white account never goes black.
- **bearer**: never admitted, or explicitly deregistered.
- (issuer blacklist remains the fourth, explicit lever - and on registered custody it reaches only the
  mirror, never the P2PKH tokens, consistent with the polarity model.)

The floor doubles as a membership bond and a Sybil price: every white identity keeps >= `X_floor` of capital
pointed at its registered address (a defector's floor stays stranded against their stuck mirror; a rental
lender permanently risks the floor portion), and each registration costs >= `X_floor` plus entry dust -
useful wherever admission is permissionless.

### The polarity flip: blacklist-driven -> whitelist-driven

In EVM, token code runs on EVERY transfer, so the natural regime is default-allow + blacklist. Here, ledger
code runs only when voluntarily invoked, so enforcement exists only at the boundary - the regime inverts to
admission-based: **"white" = custody shapes the ledger can hold to account - (1, 2) by script, (3) by
attestation-and-audit; bearer forms (4, 5) are outside its jurisdiction entirely.** Consequences:

- The blacklist mapping is demoted to an in-ledger freeze tool: it blocks a known address's ledger ops and
  bridge access, and can implement `destroyBlackFunds` for in-ledger balances. It cannot chase bearer tokens.
- Real compliance = gate the boundary. Admission at `deposit` via an on-chain whitelist mapping, or via an
  **issuer co-signature** on the deposit call (off-chain KYC issues a signature = permit-style admission;
  cheaper, no mapping writes, revocable by refusing future signatures). Exit policy is the other half:
  `open` (bearer exit) | `registered` (P2PKH exit keeps an attested mirror) | `vault-only` (enforced
  self-custody) | `disabled` (fully account-based).
- Composability lives in the white zone anyway: allowances, `transferFrom`, and events only exist in-ledger,
  so DeFi protocols naturally require in-ledger balances. The bearer zone is p2p cash.
- Admission is identity-based, not fund-based: there is no on-chain taint. An issuer CAN screen provenance
  off-chain before co-signing a re-entry (the native trail is public), but consensus never enforces it.

### The white zone is a closed graph

Recipient-side gating is where full enforcement RETURNS: a ledger move always runs master code, so
`require(whitelisted[to])` in `transfer`/`transferFrom`/`mint`/`deposit`/sync-up is consensus-enforced -
unlike bearer hops, this is EVM-grade control. Non-listed ("black") recipients cannot receive a ledger move
and cannot build standing, so they cannot move the ledger in either direction; bearer custody is all that
remains to them. Ledger-tracked value therefore flows only between allow-listed nodes: a closed graph.

Nodes are locking bytecodes, so **contracts are first-class allow-list entries** - the existing dual-path
`msg.sender` (minting-NFT co-spend) identifies a contract caller, and allow-listing a contract means vetting
IMMUTABLE covenant code, a strictly stronger assurance than vetting a user. The motivating example:
**cross-chain swaps**. A bridge or HTLC covenant needs ledger-grade semantics anyway (events for relayers,
atomic accounting, allowances for lock-and-mint), so it lives in the white zone by construction; allow-list
the bridge's lbc and only compliant, code-audited contracts can lock, burn, or release balances for
cross-chain flow. Bearer tokens simply cannot reach the bridge - re-entering the white zone (admission)
is the only path to cross-chain functionality.

That is the economic closure of the whitelist regime: bearer holders are never coerced, but the valuable
venues - bridges, redemption at the issuer, allowance-based DeFi - are structurally white-only, so
compliance is bought with access instead of enforcement. Governance hybrid: contracts on the on-chain
allow-list (few, stable, auditable entries), users via issuer-cosign permits (many, churny, no mapping
writes).

The deploy-time knob is therefore not "blacklist on/off" but **where the boundary sits**: a freedom token
ships `open` exit + open admission (blacklist nearly pointless); a regulated token ships gated admission +
`vault-only` or `disabled` exit, and gets a compliance regime as strong as EVM's - over the white set.

## Soundness assessment (adversarial pass, 2026-07-10)

Method: enumerate what each tier CLAIMS, then attack it. Verdict up front: **sound as a two-tier system** -
consensus-grade where it claims consensus, attestation-grade where it claims attestation, the two never
conflated - provided the implementation obligations below are met. All of them concentrate in one place:
the white-op output-accounting loops.

**Tier 0 - consensus claims (unconditional).**
- Supply: circulating X can never exceed genesis cap; burns are permanent. No contract or compiler bug can
  violate this. Sound with no assumptions.
- Maturity: BIP68 age of counted inputs. Equality-pinning nSequence to the exact encoded constant avoids
  the bit-flag landmines (disable bit 31, type bit 22). Sound.

**Tier 1 - covenant claims (sound iff obligations met).**
- Pool solvency (`pool >= R + S_pooled`): per-method delta matching; entries unforgeable (brand gates + the
  security-audited mapping machinery). VERIFIED in code: the token container's merge path preserves
  lbc/value/amount/category AND carries the single-input anti-double-merge loop (state.ts:1660-1685) - the
  classic aggregation pitfall is already guarded.
- White-op conservation - **OBLIGATION 1, the load-bearing one**: output accounting must be TOTAL-SUM based,
  never shape-based. State NFTs share category X and their covenants permit amount INCREASE (`>=` guards),
  so a malicious white transfer could smuggle the debited FTs onto a recreated entry/data NFT output and
  satisfy every state covenant individually. The master loop must assert the full distribution: sum of X
  amounts over ALL outputs == S_in + state-input amounts, allocated exactly {from: S_in - x, to: x, state
  outputs: unchanged}. Anything weaker is exploitable.
- Identity binding - **OBLIGATION 2**: the EOA `msg.sender` path scans for the first NON-token-bearing
  P2PKH input (GenerateTargetTraversal.ts:13068) - deliberately, so token inputs cannot spoof origin. But
  registered ops present token inputs AND a fee input, which may sit at different addresses of one wallet:
  the covenant must require every counted token input's lbc == tx.origin (or key the mirror by the common
  token-input lbc). Otherwise fee-identity and holdings-identity diverge.
- Sighash pinning - **OBLIGATION 3 (hardening)**: require counted P2PKH inputs' unlocking bytecode to end in
  sighash 0x41 (ALL|FORKID) via `tx.inputs[i].unlockingBytecode` parsing. Kills the grafted-signature edge
  (a victim's ANYONECANPAY/NONE-signed token input embedded in an attacker's white op). Wallets do not emit
  such sigs by default; pinning makes it structural.
- Thread uniqueness - **OBLIGATION 4 (audit checklist)**: no method's outputs may create a second
  minting-capability NFT of X outside the mapping-entry rules; one master thread must remain unique
  (existing machinery enforces this for current methods; new bridge/registered methods must keep it).
- Floor and restriction: emergent, no stored state to corrupt; the only mirror-below-floor path is explicit
  deregister. Sound by construction GIVEN Obligation 1.

**Tier 2 - attested/audited claims (weaker by design, and stated as such).**
- Standing (`holdings >= mirror` between ops) is not consensus-continuous: bearer spends break it,
  detectably; restriction is the emergent penalty. The claim is detect-and-exclude and the mechanism
  delivers exactly that - no more is promised. Rented reserves: killed at registration by maturity; at
  transfer time presentation is conservation (tokens actually move), so rental degenerates to
  position-trades between allow-listed members, which admission already accepts.
- Identity is address-based: key handover is invisible (equally true on EVM); admission vetting is the
  control, not the chain.
- Liveness: master serialization is fee-paying-spam-only; entry read-path mempool races cost the griefer
  fees and lock nothing in; dust-griefing is absorbed by the one-sided `>=` invariant.

No hole found in the model itself. The residual risk is implementation discipline in Obligations 1-2,
which is exactly where P1's adversarial VM tests should aim: smuggle-to-entry-output, origin/holdings
address divergence, grafted foreign sigs, double-merge (already guarded), thread duplication.

## Allowances across the custody spectrum

Allowances are the one ERC-20 mechanism that is *pure ledger* - a promise that someone else may move your
balance without you at pull time. That promise is only executable where the ledger (or a script) controls
custody at pull time, which gives a clean per-shape story:

- **Pool custody: exact parity, exists today.** `allowances[owner][spender]` nested mapping;
  `transferFrom` authorized by the dual-path `msg.sender`, so EOA and CONTRACT spenders both work -
  contract spenders are the DeFi case and the closed-graph gate applies to them (`whitelisted[spender]`,
  `whitelisted[to]`).
- **Registered P2PKH (raw): transfer-only, structurally.** A spender cannot sign the owner's P2PKH inputs
  at pull time; no covenant can change that without changing the custody script. Two upgrade paths:
  1. **Funded approvals** (zero new machinery): `approve(spender, x)` on registered custody executes as
     deposit-x-into-pool + pool allowance, in one op. The spender pulls via ordinary pool `transferFrom`;
     revocation (`approve(0)`) withdraws back to registered custody. Semantics deviation, stated honestly:
     approve moves funds and cannot exceed holdings - but pulls then work exactly as ERC-20.
  2. **Delegable registered custody** (opt-in shape): custody script = two-path covenant instead of raw
     P2PKH. Path A: owner sig - spend freely, bearer-capable, and the whole registered regime
     (attestation, maturity, floor, audit, restriction) applies verbatim with the covenant lbc as the
     registered identity. Path B: master co-spend - the ledger's `transferFrom` executes a pull per
     allowance rules. Full ERC-20 delegation on self-custodied funds. Costs, stated plainly: receiving
     works from any wallet but spending needs the SDK; and path B puts the immutable master code inside
     the owner's security perimeter for ALL funds at that address - a master bug could drain it. Same
     trust class as pool custody, with self-custody ergonomics.
- **Pull mechanics under delegable custody**: the pull tx presents enough owner-covenant UTXOs to cover
  `x` - NOT a full attestation, deliberately: a pull debits holdings and mirror equally, so it preserves
  the standing order (in-standing stays in-standing, restricted stays restricted), and requiring full
  attestation would let a restricted owner's delegate be blocked by third-party dust. Checks:
  `allowances[owner][spender] >= x`, `msg.sender == spender`, recipient allow-listed, change back to the
  owner covenant, `registered[owner] - x >= X_floor`, Obligation-1 total-sum accounting.
- **Permit - approve by signature (recommended as first-class).** `checkDataSig` is native and `ecrecover`
  already ships: the owner signs `(spender, amount, nonce, expiry)`; anyone submits permit + pull in ONE
  transaction. Replay-safe via a per-owner nonce in the owner's entry, expiry via `tx.time`. This kills
  the two-tx approve/transferFrom dance AND the approve race in one move (exact-amount, nonce-bound,
  expiring) - strictly better than `increaseAllowance` patching, and MORE natural on BCH than on EVM.
  Works against pool custody and delegable-custody path B alike.
- **Quirks for parity**: `increaseAllowance`/`decreaseAllowance` shipped anyway; "infinite allowance"
  sentinel = 2^63-1 (skip the decrement); optional allowance expiry is nearly free here and worth exposing.

### The signature question: when do pulls need the owner?

The intuition "ledger reduce -> physical tokens move -> P2PKH spend -> owner signature -> no automated
workflows" is a THEOREM for raw registered P2PKH - and two of its steps fail everywhere else:

- **"Ledger reduce implies physical movement" fails in pool custody.** The container backs the AGGREGATE
  `S_pooled`, not per-user parcels; a pooled `transferFrom` is an entry rewrite - no token moves at all.
  Physical movement happens only at bridge crossings.
- **"UTXO spend implies owner signature" fails for any non-P2PKH script.** A UTXO's spend authorization is
  whatever its locking script says; "requires the owner's key" is a property of P2PKH specifically. The
  delegate path of delegable custody spends the owner's UTXOs with no signature - the script authorized the
  predicate in advance.

The deep version: **signatures authorize instances; scripts authorize predicates.** An allowance is an
open-ended predicate ("spender may take up to X, any time, any destination in policy"). A P2PKH signature
can only bless one concrete transaction (a pre-signed pull is an instance: fixed shape, invalidated the
moment the UTXO moves, and dangerous under loose sighash) - so raw P2PKH can NEVER host an allowance, and
the minimal fix is always the same: put the predicate in a script. EVM puts it in the token contract; we
put it in the container (pool) or the delegate path (delegable custody). Same predicate, different home.

EVM comparison, for calibration: ERC-20 pulls need NO owner signature at pull time - the owner's key signs
once at `approve` (or never on-chain, with EIP-2612 permits), and thereafter `transferFrom` runs in
spender-signed transactions because balances are storage rows in the token contract, which is the custodian
by construction. All three EVM automation patterns reproduce here on pool custody: (i) owner-initiated call
where a contract pulls as a side effect (router-style, one tx via the external-call model); (ii)
owner-absent pulls on standing allowances (subscriptions, operator bots); (iii) owner-absent pulls
authorized by an off-chain order signature (intent/permit flows via checkDataSig). The flip side is also
EVM's biggest exploit class - allowance drains and approval phishing exist precisely because the owner's
key is out of the loop after approve.

So the custody spectrum is an **automation-vs-sovereignty dial, chosen per address**: pool = EVM-grade
automation, custody-by-code; delegable = automation on self-held UTXOs, sig path retained; raw registered
P2PKH = full key sovereignty, every movement signed, no delegation - a shape EVM cannot express at all.
EVM forces custody-by-code on everyone; here the sovereign form is the default and automation is opt-in.

Recommendation: pool allowances + permit as the parity core; funded approvals as the zero-new-covenant
bridge for registered custody; delegable custody as the opt-in for self-custody DeFi users.
(Superseded for the primary preset by the registry model below - allowances there are delegable-custody +
permit only.)

## Re-centering on user custody: the registry model

Design ruling (2026-07-10): for the primary token, ledger movement without physical movement is REJECTED.
A white transfer must BE the physical transfer - the sender's non-custodial UTXOs spent, exactly the stated
amount delivered to the counterparty - with the ledger update forced alongside. Not an IOU assignment.

### The coupling, direction by direction

- **Ledger => physical: already enforced.** The white-transfer covenant ties the stated amount `x` three
  ways in one atomic transaction: mirror delta (`registered[from] -= x, registered[to] += x`), physical
  delivery (`sum X outputs at toLbc == x`), and source accounting (`sum at fromLbc == S_in - x`, no other X
  outputs). A ledger update without the physical spend is unsatisfiable by construction. Obligation 1
  (total-sum output accounting) IS the no-IOU guarantee - smuggling amounts onto state outputs is exactly
  the way hidden IOU-ness would enter, which is why it is the load-bearing obligation.
- **Physical => ledger: enforceable only by the custody script** (the polarity theorem). On raw P2PKH the
  bearer path always exists; the regime makes bypass self-punishing (maturity, floor, emergent
  restriction), not impossible. If BOTH directions must be forced, that is synced custody (the vault
  shape): every spend path requires the master co-spend. There is no third mechanism.

### Backing theorem (inductive)

Every mirror unit is physically delivered to its address at creation:

- registration/sync-up: mirror increase requires matured physical presentation at that address;
- white receipt: mirror increase equals physical delivery in the same transaction;
- mint-to-registered: physical delivery from the reserve in the same transaction (registry model below).

Only the owner's own bearer spend can de-back a mirror, and a de-backed account auto-restricts (cannot
attest). Therefore the system never CREATES an unbacked balance - IOU states are self-inflicted, publicly
visible, and self-excluding. This is the registered regime's soundness statement in one line: **the ledger
is a registry of physically-held tokens, never a claim on them.**

### The registry model (pool-free) - the primary preset

Precision first: the pool is NOT unsound - it is full-reserve custody, per-tx enforced (`pool >= R + S`),
every entry withdrawable. But it is custody-by-code, and the primary token wants physical custody. The
registry model removes it:

- The container holds ONLY the unminted reserve `R`. There are no pooled circulating balances.
- `mint(to, x)`: physical delivery from the reserve to `to`'s address + `registered[to] += x`, one tx.
  `burn(x)`: physical tokens enter the op and are destroyed (omission or OP_RETURN); mirror decremented.
  `burnToReserve(x)`: physical tokens return to the reserve container; `R += x`, mirror decremented.
- `transfer` = the white physical transfer. `balanceOf` = the mirror, backed at creation by the theorem.
  Events unchanged. `deposit`/`withdraw` disappear; the bearer<->registered boundary is
  `register`/`deregister` (with maturity and admission as specified).
- Allowances: delegable custody + permit ONLY. Funded approvals are dropped (they reintroduce pooled
  custody); `transferFrom` pulls move physical tokens from the owner's delegable-covenant UTXOs. The
  automation-vs-sovereignty dial remains per-address: raw registered = sovereign, transfer-only;
  delegable registered = physical delegation.
- Solvency degenerates to `container == R`; `T = sum(mirrors) + bearer circulation`; every ledger balance
  sits physically at its owner's address.

The bank model (pool primary, method table above) remains a compileable preset for tokens that WANT
custodial ergonomics and maximum EVM automation parity; the registry model is the default. The method
table's `transfer`/`mint`/`burn`/`withdraw`/`deposit` rows read per-preset accordingly.

## Reserve storage and untouchability (code-verified, 2026-07-10)

The premint sits somewhere from genesis until `mint` releases it. That store must be untouchable except
through contract logic. Question: do the existing token-container covenants already warrant this? Verdict
after reading the emitted bytecode: **yes - structurally - as a theorem plus a short, checkable obligation
list.** The key realization is that the container covenant is an *authentication* gate, not a *conservation*
gate; conservation is delegated to the co-spent master's inline code, and that delegation is sound iff the
obligations hold.

### How the container covenant actually guards (two paths)

`buildTokenContainerCovenantScript` (utils/src/state.ts:1618) is dual-path on a flag:

- **Master path (flag=1)**: reads the UTXO at `masterInputIndex`, requires its token field to be
  `X || 0x02` - i.e. a MINTING-capability NFT of the contract's own category is co-spent. That is the ENTIRE
  master-path check. It places NO constraint on the transaction's outputs. Translation: "if the genuine
  master thread is present in this transaction, the container trusts it completely and lets it arrange
  outputs however its own logic dictates." All conservation is therefore delegated to the master's inline
  code (below). This is safe only because the minting NFT is unique and unforgeable (Obligation 1).
- **Merge path (flag=0, no master)**: pure consolidation. Preserves locking bytecode, value (`>=`), FT amount
  (`>=`), and category, and carries the anti-double-merge single-input loop (state.ts:1660-1685) so N
  container UTXOs cannot be collapsed onto one output to skim the rest. Cannot drain, redirect, or strip
  category. A permissionless actor can tidy the container's UTXO set and nothing more.

So there is no third path. A container UTXO moves only by (a) co-spending the real master thread, or
(b) consolidating into itself. There is no signature-only or bearer path - unlike a raw-P2PKH vault, the
reserve is not protected by a key that can be phished or lost; it is protected by the covenant.

### What the master enforces inline when it does co-spend

Whenever a method touches a container, the master emits (GenerateTargetTraversal.ts:1700-1707) three blocks -
identity verification, transfer-covenant verification, and `emitTokenContainerPreservation` (GTT:14702).
Preservation is the conservation gate the master path omitted:

- **Existence**: input container exists -> output container must exist (drain-by-omission blocked). EXCEPT
  for `selfdestruct`-modifier methods, which are deliberately exempt (Obligation 3).
- **Self-preservation**: output locking bytecode == input locking bytecode. Released-past-declared tokens
  cannot be redirected; the remainder must return to the same container address.
- **Amount floor**: `output_amount >= input_amount - sum(explicitly verified transfer outputs)`. The
  container can lose at most exactly what the method transferred out through the verified `this.transfer`
  path - nothing implicit. This is the load-bearing conservation line.
- **Category preservation**: output category == input category.

Every one of these is gated by `!functionHasDelegatecall` (Obligation 4): a delegatecall-reachable method
skips identity + transfer + preservation entirely.

### The untouchability theorem

Put the reserve on a **dedicated reserve container** (its own token-container covenant, distinct UTXO). Then
the reserve amount can decrease ONLY by an amount some genuine method explicitly and verifiably transferred
out, because: the only spend paths are master (which runs that method's preservation, capping outflow at
declared transfers) and merge (consolidate-only); and a method that does not co-spend the reserve container
cannot affect it at all - it is a separate UTXO the transaction simply does not include. Reserve is thus
touched by exactly the methods that name it (`mint`, `burnToReserve`) and by no others, ever. QED, modulo:

- **Obligation 1 - thread uniqueness.** Exactly one minting-capability NFT of X may exist. A second forges
  master authority and unlocks the master path. (Existing genesis machinery mints one; new methods must
  never mint another - audit-checklist item, shared with the soundness pass.)
- **Obligation 2 - accounting binding.** The covenant enforces "outflow <= declared transfers" but knows
  nothing about the `R` counter. Binding physical outflow to the accounting is the method's job. **In the
  registry model this obligation largely DISSOLVES**: with the reserve alone in a dedicated container,
  `R` *is* `tx.inputs[reserveContainer].tokenAmount` - a physical, natively-indexable quantity, not a
  bookkept mirror that can drift. `mint(to, x)` becomes `require(x <= tx.inputs[rc].tokenAmount)` plus the
  built-in preservation flooring the output at `input - x`; the next mint reads the already-reduced amount
  automatically. No stored `R`, no drift, no reconciliation. Only circulating `T` needs a counter (for
  `totalSupply()`), and even that is derivable as `initialSupply - reserveAmount - permanentlyBurned`.
- **Obligation 3 - no selfdestruct on a live token.** `selfdestruct` methods are exempt from the existence
  check and CAN fully drain a container. A reserve-bearing token must forbid selfdestruct or owner-gate it
  behind the same authority as the reserve, else it is a drain path wearing a different name.
- **Obligation 4 - no delegatecall reach.** All container guards are `!functionHasDelegatecall`. A
  reserve-touching (or merely reserve-co-spending) method must not be delegatecall-enabled, or every guard
  above is skipped. Consistent with docs/delegatecall-security.md.

### Where to store it (recommendation)

Dedicated reserve token container - NOT on the master thread NFT, NOT on data/entry NFTs:

- **Isolation** is the whole game: only `mint`/`burnToReserve` co-spend the reserve container, so every other
  method physically cannot reach it. Storing the reserve on the master thread NFT (co-spent by EVERY method)
  would put the entire supply inside the blast radius of any preservation bug in any method; a dedicated
  container shrinks the attack surface to two methods.
- **Purpose-built, already-audited covenant**: master-gated release + consolidation + anti-drain exist and
  were reviewed in the security pass; no new covenant to write or audit for storage itself.
- **Capacity is a non-issue**: the entire premint is `<= 9.22e18 = int64 max = exactly the FT max`, so the
  whole reserve fits in ONE container UTXO's amount field. No sharding for capacity. (Optional sharding
  across a few reserve UTXOs only if `mint` throughput needs parallelism - each shard its own container.)
- **Free reserve readout**: `reserveContainer.tokenAmount` is the reserve, natively visible to any token
  indexer with no commitment parsing - and, per Obligation 2, it doubles as the authoritative `R`.

Net: reserves are untouchable by construction under this design, and the residual risk is entirely in four
template-discipline obligations - none of which is a covenant gap, all of which are P1 audit-checklist and
adversarial-VM-test items (forge second minting NFT; selfdestruct drain; delegatecall bypass; mint releasing
more than it debits).

## The general-model realization: FT-on-entry (supersedes the custom covenant)

The reserve-container-plus-`require` sketch above is a CUSTOM contract: bespoke introspection checks hand
written into method bodies. The goal is to fit the general stateful-contract model (auto-derivation,
standard entry covenants, SDK support) and to avoid virtual-value mappings. Both point at one realization -
FT-on-entry (the "v2" note, hereby promoted to primary) - and it turns out to be not just cleaner but
STRICTLY SAFER than the custom version.

### The whole token is FT-bearing entries; consensus is the ledger integrity check

There are no virtual balances and no bespoke covenant math. State is entirely the standard stateful-contract
primitives, with ONE variation: the `balances` mapping stores its value in each entry NFT's **FT amount**,
not in commitment bytes. The key stays in the commitment (entries remain key-addressable and
auto-derivable); same category, same collection hash, same master-gated entry covenant, same auto-derivation
framework - only the value's storage location moves from commitment to the native `tokenAmount` field.

Then every ERC-20 op is a master-authorized redistribution of real category-X FTs among entry UTXOs:

- `balanceOf(a)` = the entry's `tokenAmount` (native, no commitment decode).
- `transfer(to, x)` = co-spend `balances[from]` and `balances[to]`, emit them with amounts `-x` / `+x`.
- `mint(to, x)` = the SAME operation from a reserve holder: `balances[RESERVE] -= x`, `balances[to] += x`.
  The reserve is just an entry at a sentinel key (or, equivalently, the token-container primitive) - not a
  custom vault.
- `burn(x)` = debit `balances[from]`, credit nothing; the `x` FTs are omitted and consensus-destroyed.
- `burnToReserve(x)` = debit `balances[from]`, credit `balances[RESERVE]`.

**The integrity checks are consensus, not covenant.** BCH enforces `sum(output FT) <= sum(input FT)` per
category on EVERY transaction. So:

- **Inflation is impossible.** To emit `balances[to]` with `+x`, those `x` FTs must be present in the
  inputs. A credit without a matching debit makes `sum_out > sum_in` and consensus REJECTS the transaction.
  No `require` needed - the check the custom version spends bytecode on is free and global.
- **`x <= R` is free.** Minting from the reserve entry cannot exceed the reserve's `tokenAmount`; you cannot
  spend FTs a UTXO does not hold. The reserve floor is a consensus invariant, not a hand-written compare.
- **`x <= balanceOf(from)` is free**, identically.
- **Burn is exactly the consensus burn.** Debit-with-no-credit is `sum_out < sum_in` - the spec's own
  destruction path - so the physical and the accounting burn are one act, not two that must be kept in sync.

The compiler's job shrinks to "emit entry outputs with the intended amounts"; consensus validates
conservation. This dissolves ALL four reserve obligations except thread uniqueness - there is no `R` counter
to bind (the reserve entry's `tokenAmount` IS R), no accounting-vs-physical drift possible, and the amount
floor is consensus.

### Safer, not just cleaner

In the virtual model a compiler bug that credits without debiting yields a VALID transaction carrying a
wrong number - a silent inflation. In FT-on-entry the same bug yields a CONSENSUS-INVALID transaction that
simply never confirms. Consensus is a second, independent line of defense under every balance operation, so
the entire inflation/imbalance bug class is non-exploitable by construction. This is the strongest possible
answer to "untouchable reserves": the supply cannot be over-issued even by a broken contract, because the
tokens are real and consensus counts them.

### The fork this forces: no-virtual-value and self-custody are mutually exclusive

FT-on-entry keeps balances as real FTs at the CONTRACT's entry addresses (custody-by-code). That collides
with the earlier physical-self-custody ruling, and the collision is fundamental, not an implementation gap:

> To TRACK value the contract does not hold, the contract can only store a number per holder. A
> number-per-address IS a virtual-value mapping. Therefore self-custody (tokens at user P2PKH) + ledger
> tracking REQUIRES a virtual mirror. There is no third option.

So the two poles are exhaustive and exclusive on the virtual-value axis:

- **Model A - FT-on-entry (custody-by-code).** Zero virtual value; pure general-model; consensus-enforced
  integrity; inflation-proof even against bugs. Ledger balances live at contract entry addresses. Self
  custody is the WITHDRAWN native form (real FTs in your P2PKH, untracked), reached by `withdraw`; the two
  forms bridge exactly like WETH wrap/unwrap, and BOTH hold real tokens - virtual value appears NOWHERE.
- **Model B - registered self-custody.** Tokens at user P2PKH, tracked by `registered[addr] => uint` - a
  virtual mirror, unavoidably - plus the attestation/maturity/floor/restriction covenant machinery to
  approximate "physical movement forces ledger update."

The clarifying point: **that entire Model-B apparatus is the PRICE of self-custody.** In Model A "physical
movement forces ledger update" is not approximated - it is airtight and free, because the tokens sit behind
the entry covenant and literally cannot move except through a master-authorized method that updates the
ledger in the same transaction. No defection is possible, so no attestation, maturity, floor, or restriction
is needed. Model A gets the property Model B works hard to simulate, by giving up self-custody of the
tracked balance.

### Recommendation

Model A (FT-on-entry) is the primary realization: it is what "native tokens instead of virtual balances"
literally means, it drops cleanly into the stateful-contract framework, and it is inflation-proof by
consensus. The only new surface is (i) a mapping value-location annotation (`mapping(address => uint) native
balances;`), (ii) SDK entries carrying `amount > 0n` (today hardcoded `0n`; entry covenant already guards
amounts - no covenant change), and (iii) auto-derivation reading `tokenAmount` for annotated mappings.
Self-custody remains fully available as the withdrawn native form. Model B stays specified for tokens that
require the tracked balance ITSELF to be self-custodied and accept a virtual mirror to get it - a genuinely
different product, not the default.

### Model A is a wrapped asset - which is exactly what ERC-20 is

Correct reading: a Model-A balance is category-X FTs sitting at a **P2SH32 entry covenant**, not a P2PKH,
and moving it requires **co-spending the master thread**. That makes it a wrapped/ledger asset, not a bearer
asset. This is not a compromise away from ERC-20 - it is a faithful port OF ERC-20. An EVM ERC-20 balance is
also not something you hold: it is a row in the token contract's storage, movable only by calling the
contract. The master co-spend is precisely the UTXO analog of "calling the contract." The dream of "native
tokens sitting in your own wallet, transferable by any CashTokens wallet with no contract" is a DIFFERENT
asset - bearer cash - which ERC-20 never was and which lives here as the withdrawn native form.

So the token has two faces, WETH-style: the **ledger face** (FT-on-entry, tracked, composable, allowance
capable, policy-gated, master-mediated) and the **native face** (withdrawn FTs in P2PKH, untracked,
peer-to-peer, contention-free). `deposit`/`withdraw` wrap and unwrap between them; both are real tokens.

### Contention: the real cost, and where it is and is not intrinsic

The master thread is a SINGLE UTXO co-spent by every ledger op, so it is a GLOBAL serializer: all
state-changing ops on the token order through one thread (one op per unconfirmed-chain link or per block).
Honest accounting of why, and the escape hatches:

- **The native face is contention-free.** Withdrawn FTs transfer wallet-to-wallet as ordinary CashTokens,
  no master, fully parallel. For high-frequency p2p payment, that is the path - unwrap, transact, the ledger
  is not in the loop. (This is exactly ETH-vs-WETH: raw ETH is cheap and parallel; WETH transfers are
  contract calls.)
- **Some serialization is intrinsic to a central ledger, not to the master.** A single canonical balance
  cell per address is a single-writer register; concurrent writes to it must order, master or not. Removing
  the master only RELOCATES that to per-cell contention (concurrent credits to the same recipient still
  conflict). The only fully-parallel token is multi-UTXO bearer - i.e. the native face again. EVM ERC-20
  has the same property, hidden by global sequential block execution.
- **But the global master bottleneck is heavier than necessary, and can be loosened.** Transfers do not
  change supply, so they do not strictly need the master for integrity - consensus conservation already
  prevents inflation. A future entry-covenant transfer path authorized by the owner's signature (preserve
  key/category/collection, allow amount decrease; recipient entry allows the matching increase) would let
  transfers between DISJOINT account pairs run in parallel, master-free, approaching EVM per-slot
  concurrency. The master would remain required only for mint/burn (supply) and for policy-gated transfers
  (blacklist/whitelist/allowance state lives in master mappings and must be read). Symmetry: freedom-preset
  unrestricted transfers can parallelize; compliance-preset policy-checked transfers serialize on the state
  they must consult. This is an avenue, not v1 - it needs a covenant redesign and its own soundness pass -
  but it means Model A throughput is not permanently pinned to one global thread.
- **Sharding** the reserve/master across N threads is the other axis (mint concurrency, hot-account splits),
  also future work.

Bottom line: Model A pays EVM-ERC-20-class serialization for EVM-ERC-20-class semantics, concentrated (for
now) in one master thread; the contention-free option is the native face, which is always one `withdraw`
away.

### Masterless transfers vs the ledger, allowances, and policy

The masterless path raises the obvious objection: it skips the master, so does it skip the ledger update,
bypass allowances, and bypass blacklist/whitelist? Split the three - they are NOT the same problem.

**It does NOT skip the ledger update.** In Model A the entries ARE the ledger; there is no separate number
to keep in sync. A masterless transfer that debits `balances[from]` and credits `balances[to]` HAS updated
the ledger, because `balanceOf` reads those entry amounts directly. Consensus conservation still forbids
inflation on that transaction with no master present. So there is no soundness desync - the balance ledger
stays exactly correct. What a masterless transfer genuinely skips is (a) POLICY enforcement and (b) EVENT
emission - not balances.

**It does NOT bypass allowances - by category.** An allowance is SPENDER-side authority (a spender may move
the owner's tokens); the masterless path is OWNER-side authority (the owner moves their own tokens, proven
by a signature checked against the entry's key, which already IS the owner's address). The two never
overlap:

- A spender cannot use the masterless path at all - they do not hold the owner's key, and the path checks a
  sig against the entry key. So `transferFrom` (spender-initiated) is INHERENTLY master-gated, and the
  master checks `allowance[owner][spender]` there. No masterless door exists for a spender to walk through.
- The owner using the masterless path to move their own funds needs no allowance (you never need an
  allowance to spend your own balance). The "owner drains below an outstanding allowance" case is standard
  ERC-20 - allowance is a spending cap, not an escrow - not a new bypass.

So allowances stay sound with the masterless path present, provided the invariant holds: **the masterless
path requires an owner signature bound to the entry key, and `transferFrom` is only ever the master path.**
(Contract-owned balances have no key to sign, so they are master-mediated regardless - which is the
composable/DeFi path that wants the ledger anyway.)

**Policy IS bypassed by a masterless OWNERSHIP CHANGE - so the masterless path must be ownership-preserving
only.** Refinement (2026-07-11): split the operations by whether they change ownership.

- **Ownership-PRESERVING** (split one note into several of the SAME owner, merge several into one, consolidate,
  refresh) does not need the master. Nothing leaves the owner's control, no counterparty is involved, no
  policy applies - it is private reorganization of your own funds, authorized by your signature alone.
- **Ownership-CHANGING** (a transfer, the recipient differs) MUST co-spend the master. A change of ownership
  IS the ledger event: it is where the recipient is admitted, blacklist/whitelist/freeze and allowance are
  checked, and the `Transfer` event is emitted. Value changing hands is exactly what the ledger exists to
  witness.

This is the principled version of "the covenant IS the policy": the masterless path is safe to include
**universally** (both presets) BECAUSE it is structurally incapable of transferring. The note covenant's
masterless path requires (a) the owner's signature against the note's owner tag, and (b) an output scan
proving EVERY category-X note output is tagged to that same owner. Condition (b) is the lock - it makes an
ownership change on the masterless path impossible, so a blacklisted holder can shuffle their frozen notes
all day and still cannot move a single unit to anyone (the only door out is the master path, which checks
the blacklist and refuses). Ledger-boundary crossings (`withdraw`/`deposit`/`mint`/`burn`) are ledger
events too and likewise co-spend the master, even though the owner does not change - they alter the tracked
set.

What this dissolves: last section's "fast-and-unpoliced XOR policed-and-serialized" binary was wrong.
Because the masterless path cannot transfer, EVERY transfer is master-mediated in BOTH presets, so policy is
ALWAYS enforceable; and self-management is masterless in BOTH presets, so every owner reorganizes in
parallel regardless. Freedom vs compliance is now only WHICH checks the master runs on an ownership change,
never WHETHER the master runs.

Consequences and costs:
- **Balance is multi-note**: `balanceOf(owner) = sum of the owner's notes` (SDK/indexer aggregates), the
  UTXO-native shape. Consolidation is a masterless convenience, not a requirement. Allowance/blacklist/
  whitelist mappings stay single-cell (master-mediated anyway); only the balance becomes noted.
- **Transfer parallelism is NOT gained** - ownership changes still serialize on the master. The masterless
  win is parallel self-custody/reorganization plus a ledger that witnesses 100% of ownership changes (its
  transfer history is complete by construction, which is what makes it a ledger and not bearer cash).
  Transfer throughput scales instead via master/thread SHARDING (orthogonal, future work).
- **Soundness rests on the output-scan** (condition b). Without it the masterless path would be a transfer
  backdoor; with it, ownership is a covenant-enforced invariant of that path. This is an evolution of the
  existing entry read-path self-preservation - generalized from "preserve exactly" to "redistribute freely
  among same-owner outputs."
- **Events**: an ownership change always co-spends the master, so `Transfer` events are always emitted -
  no observability gap on actual transfers. Split/merge emit nothing, correctly (they are not transfers).

## The boundary: quarantined admission (THE PURSUED DESIGN)

Decided 2026-07-25: **this is the boundary design being pursued**, not one option among the admission
variants. The earlier `open | whitelist | issuer-cosign` list is superseded as the default - those remain
available for issuers who specifically want them, but quarantined admission is what the template, the SDK
support, and the tests target.

The mode: holders `withdraw` freely, turning ledger balance into plain P2PKH CashTokens that change hands
arbitrarily as bearer cash; re-entry via `deposit` is subject to a COOLDOWN, and during that window the
issuer can investigate provenance and refuse admission. This is the self-custody / compliance balance point,
and it is a strictly better shape than the admission options sketched earlier.

### Why the polarity matters: permissionless-by-default with a veto

"Open decisions" listed admission as `open | whitelist | issuer-cosign`. All three are
permissioned-or-nothing: nothing enters unless the issuer pre-listed you or actively signs. Quarantine is the
fourth mode and it inverts the default - everything enters UNLESS the issuer acts inside the window.

Two consequences, both load-bearing:

- **Liveness inverts.** Under `issuer-cosign` an offline issuer blocks all deposits; the issuer is a
  liveness dependency on the happy path. Under quarantine an offline issuer blocks nothing - deposits keep
  flowing, and only the BLOCKING capability goes dark. The happy path never depends on the issuer.
- **Refusals become auditable.** A cosign refusal is invisible (simply never sign, no artifact, no
  accountability). A quarantine refusal is an on-chain state write. Censorship is still possible but it is
  no longer deniable.

### Mechanism: the pending-deposit note

Two findings shrink this to almost nothing.

**The pending note must be a PURE-FT output, tags in the SCRIPT - not an NFT with tags in a commitment.**
This is forced, and it is what makes everything below work. Creating an NFT of category X requires spending a
minting NFT of that category, i.e. the master thread - so a commitment-tagged pending note would make every
`deposit` master-serialized. Moving existing FT amounts, by contrast, needs no capability at all. So the
pending note is FTs (no NFT, no commitment) sitting at a P2SH32 covenant PARAMETERIZED per
`(claimantTag, depositorTag)` pair: the tags live in the covenant script, and the address itself is the
binding.

Note the driver is CAPABILITY, not commitment space - the 128-byte commitment would hold both tags with room
to spare, so this conclusion is unaffected by the May 2026 limit increase. The genuine side benefit is that
distinct claimants sit at distinct ADDRESSES, making cross-claimant contamination or mis-crediting
structurally impossible rather than a check to get right.

**Deposit-initiation therefore needs no master co-spend.** No NFT is created and no balance is credited, so
no ledger state is written and no capability is consumed. Deposits are fully PARALLEL - only the later claim
serializes on the master thread. A rare win against the global-serializer cost documented above.

**Maturity must be consensus-tracked, not self-declared.** Any `unlockHeight` the depositor bakes into the
note is self-asserted and worthless. Coin AGE cannot be forged. Enforce the cooldown with a BIP68 relative
locktime on the claim and no height field is needed anywhere. Same reasoning as "Ownership maturity" above:
consensus-tracked beats master-bookkept.

Three spend paths on `pendingCovenant(claimantTag, depositorTag)`:

- **`deposit`** - master-free, capability-free send of FTs to the pair's address. No contract execution.
- **`claim`** - master co-spend; PERMISSIONLESS and third-party-drivable (it credits the designated
  claimant, so no signature is required - anyone can push a matured deposit through). Requires
  `tx.inputs[i].sequenceNumber == <X encoded>` plus `!blacklisted[claimant]` (and `whitelisted[claimant]`
  under the compliance preset). Credits `balances[claimant] += tokenAmount` and emits `Transfer`. The
  contract learns the claimant by RECONSTRUCTING the expected pair-address and comparing it against
  `tx.inputs[i].lockingBytecode` - the same reconstruct-and-compare pattern already used for entry addresses
  (`emitSortedEntryAddress`), not by parsing bytes out of a commitment.
- **`cancel`** - masterless, and cheap: since `depositorTag` is in the script, the covenant checks the
  standard `OP_DUP OP_HASH160 <depositorTag> OP_EQUALVERIFY OP_CHECKSIG` pattern itself and constrains the
  output back to the depositor. No contract execution, no master. Value is never strandable.

The whole covenant is roughly `<flag> OP_IF <master-auth + sequence-pin> OP_ELSE <p2pkh on depositorTag>
OP_ENDIF <claimantTag> OP_DROP OP_1` - small enough to audit line by line.

**The veto needs no spend path.** Because `claim` already runs master code that reads the blacklist, the
issuer's refusal is just "blacklist the claimant before maturity." No race to spend the pending note, no
seizure path, and no `to`-griefing concern (an unwanted deposit is simply never claimed, and `cancel`
recovers it). Effective window is `X` minus claim-confirmation latency, so treat it as `X - 1` blocks.

**Confiscation is structurally impossible, and that is a design goal not an oversight.** A refused deposit's
only exit is `cancel`, back to the depositor as bearer cash: refused admission, keep your money. A boundary
where deposits can be trapped is a honeypot, and a honeypot does not attract deposits - the mode would
defeat itself. If seizure must exist for some issuer, it belongs behind a much louder, separately audited
power, never on the default quarantine path.

**Primitives verified 2026-07-25 (all shipped):** `.sequenceNumber` is readable in the grammar
(`SolidCash.g4:701`), so a covenant can equality-pin it in one comparison; the SDK sets per-input sequence
via `utxo.options.sequence` (`interfaces.ts:33` -> `TransactionBuilder.ts:764`); txs are version 2
(`TransactionBuilder.ts:774`), which BIP68 requires.

**GOTCHA:** `DEFAULT_SEQUENCE = 0xfffffffe` (`TransactionBuilder.ts:67`) has bit 31 SET, which DISABLES BIP68
relative locktime (it is the conventional value that enables `nLocktime` while opting out of relative
locktime). A claim tx must pass `options.sequence` explicitly with bit 31 clear - e.g. `144` for a 144-block
cooldown (bit 31 clear, bit 22 clear = block units, low 16 bits = the value). Bit 22 set switches to
512-second units. Ranges: 65535 blocks (~455 days) or 65535 512s-units (~388 days) - an AML window of hours
to days sits comfortably inside either. No interaction with `InjectLocktimeGuardTraversal`, which guards
`nLocktime` (orthogonal to `nSequence`); and since the default sequence is already non-final, `nLocktime`
enforcement is unchanged either way.

### The exit asymmetry: an unvetoed instant exit makes in-ledger freeze cosmetic

The sharp problem with quarantining only the entry. Deposits get an `X`-block inspection window;
withdrawals get none. So any holder who smells an investigation unwraps first and is gone, and
`blacklist`/`freeze` only ever lands on holders who were not watching. The issuer must WIN A RACE against a
motivated adversary, every time. The earlier text demoted blacklist to "an in-ledger freeze tool" without
confronting that race; naming it: **in the instant-exit shape, freeze is enforceable only against the
inattentive.**

The symmetric fix reuses the same primitive. `withdraw` debits `balances[owner]` immediately and creates a
pending-WITHDRAWAL note; paths are `claim` (matured, `sequenceNumber == Y`, pays out to the owner's P2PKH,
permissionless) and `recall` (master, owner-authorized, returns the value to `balances[owner]` if the issuer
freezes inside the window). Debiting at initiation rather than completion is what makes `recall` necessary -
otherwise the balance stays spendable and the withdrawal is a duplicate claim on it.

**DECIDED (2026-07-25): the exit posture is a DEPLOY-TIME COVENANT VARIANT, both audited.** Same resolution
shape as the masterless path above - the set of spend paths in the covenant IS the policy, so it is baked
into the covenant address at deploy and cannot flip per-transaction:

- **freedom preset** - instant unvetoed `withdraw`. Maximum self-custody. The tracked set still stays clean
  (entry is quarantined either way), but in-ledger freeze is escapable, which the preset accepts explicitly
  rather than pretending otherwise.
- **compliance preset** - symmetric cooldown, `withdraw` via a pending-withdrawal note with `recall`. Freeze
  becomes genuinely enforceable: the issuer has `Y` guaranteed blocks instead of a race.

Cost of the symmetric variant, stated honestly: unwrapping becomes slow, which pushes holders to stay
wrapped. Some issuers will read that as a feature. The two presets are NOT interchangeable for holders and
the choice is visible in the address, which is the point.

### What the cooldown cannot do

- **Coin-level taint does not survive the bearer zone.** FT amounts carry no per-unit identity, so once
  tainted and clean units merge in one P2PKH UTXO they are permanently inseparable. After a couple of hops
  everything is partially tainted. Worse, it is cheaply griefable: send one base unit of flagged X to a
  victim and their next consolidation "taints" their whole deposit - the same dust-grief shape found in the
  Model B attestation analysis. **So the on-chain veto is ACTOR-based (blacklist the claimant); coin
  provenance is an off-chain signal the issuer weighs during the window, never a covenant predicate.**
- **Tiering the window by amount invites structuring.** Fast-for-small / slow-for-large is mechanically
  trivial (`claim` checks age `>= f(amount)`) but splitting a large deposit defeats it. Per-claimant rate
  limiting needs accumulator state (an entry-side counter); a FLAT window is the honest starting point.
- **Investigation quality is just chain analytics.** The pending note exposes the funding outpoint, and its
  history is public - but a depositor funding from a fresh P2PKH downstream of a mixer presents a clean-ish
  immediate history. Not solvable on-chain, and the design should not imply otherwise.
- **Bearer circulation is untouched.** Per "enforcement polarity" above, native P2PKH hops can never be
  forced to update the ledger. Gray funds circulate in the native face indefinitely; the cooldown gates
  RE-ENTRY only.

Accurate framing: **this is admission control plus travel-rule-at-the-boundary, not seizure.** It fits an
issuer whose obligation is "do not onboard tainted funds into the regulated ledger" - which is the actual
obligation for most issuers. It does not fit one who must freeze any holder anywhere; that issuer wants
`exit: disabled` (a pure ledger token with no bearer face). The spectrum:

| shape | self-custody | freeze reach | who it is for |
| --- | --- | --- | --- |
| `exit: disabled` | none | total (all balance is ledger) | issuers needing unconditional freeze |
| quarantined entry + symmetric exit | full, slow both ways | ledger + `Y`-block window | regulated issuers, compliance preset |
| quarantined entry + instant exit | full, instant out | ledger, escapable | freedom preset |
| open entry + instant exit | full | none in practice | unpoliced tokens |

The middle two are the interesting ones and are the two audited presets.

### May 2026 VM upgrade: the design's two scans rest on shipped features

The upgrade brought loops (`OP_BEGIN`/`OP_UNTIL`), functions (`OP_DEFINE`/`OP_INVOKE`), and the 128-byte
commitment. All three are already in use in this codebase, so nothing here is speculative - but be precise
about what exists versus what still has to be written.

The design leans on exactly two unbounded scans, and both are the soundness core rather than conveniences:

1. **Multi-note `balanceOf`** - sum `tokenAmount` over the owner's co-spent notes.
2. **The masterless output-scan lock** - assert EVERY category-X note output carries the same owner tag. This
   is the condition that makes an ownership change impossible on the masterless path.

Both are loop-shaped and the scaffolding is proven: `emitIntrospectionSum` (`GTT:6100`) already loops
`n-1..0` over `OP_TXINPUTCOUNT` / `OP_TXOUTPUTCOUNT` with an `OP_BEGIN`/`OP_1SUB`/`OP_UNTIL` body and a
caller-supplied per-element op sequence, and it is live in `tx.gasprice` (`GTT:6124`) for value and
script-length sums. The token-container merge path uses the same shape for its anti-double-merge input scan
(`state.ts:1827-1852`).

**What is missing is the PREDICATE variant.** `emitIntrospectionSum` sums unconditionally; both scans above
are conditional - scan 1 needs "amount if this input is one of my notes, else 0", and scan 2 is an
all-quantified assertion, naturally emitted as a violation counter verified `== 0` (or a fail-fast
`OP_VERIFY` in the loop body). So P1/P2 inherit a tested loop skeleton but owe two new emitters, and those
emitters are where the adversarial tests should concentrate - an under-counting filter in scan 1 silently
misreports balances, and a gap in scan 2 is a transfer backdoor.

Functions (`OP_DEFINE`/`OP_INVOKE`) matter here for size, not capability: the note-covenant paths and the
scans are the kind of repeated body that subroutine extraction already compresses well (`-60.7%` on the
existing rework), which is relevant because the pending covenant and the note covenant both ship in every
deployment of this token.

### What it does not disturb

- **Supply invariants hold unchanged.** Pending notes are neither reserve nor burned, so they sit in the
  bearer ceiling `B` until claimed and move into `W` on claim. `T + R + permanentlyBurned == initialSupply`
  and `T >= E` are untouched. A pending-withdrawal note is likewise still inside `T`.
- **Masterless self-management is unaffected.** Pending notes are boundary objects, not balance notes; the
  ownership-preserving split/merge path does not apply to them (their `cancel` path is the analogous
  owner-authorized move).

**Note for the open owner-tag question (decision 7):** the pending note sidesteps commitments entirely by
putting its tags in the covenant SCRIPT. That is a transferable lesson rather than a shared solution - where
the tag set is sparse and an address per tag is acceptable, address-parameterization beats commitment
encoding. The BALANCE note cannot use it (balances must stay key-addressable and auto-derivable through the
standard entry covenant, which is parameterized per COLLECTION, not per owner), so it needs a commitment tag.

**The 128-byte commitment upgrades the candidate: store the FULL locking bytecode, not a hash.** With only 40
bytes the tag had to be compressed to `hash160(lbc)` (20 B, lossy, and the spend path pays an `OP_HASH160`
plus a collision argument). At 128 bytes there is no reason to compress: a P2PKH lbc is 25 bytes and a p2sh32
lbc is 35, so the note stores the owner's locking bytecode verbatim and the spend path is a direct
`tx.inputs[i].lockingBytecode == <tag>` compare - no hashing, no collision analysis, cheaper script. This
also matches the existing idiom, where `address` already IS the variable-length lbc and mapping keys are
pushdata-encoded to carry it. Budget: `key(32) + lbc(<=35) = 67`, leaving ~61 bytes for a permit nonce and
flags.

**It also de-risks the multi-note model.** Identical NFT commitments are a known hazard in this codebase
(two indistinguishable data NFTs become unorderable on a non-deterministic provider). With 128 bytes every
note can carry a per-note index alongside the owner tag, so an owner's notes are always totally ordered and
individually addressable, and the hazard never arises. Under a 40-byte budget that index would have competed
with the tag for space.

## Parity gaps and trade-offs (the honest section)

- **int64 amounts.** Native backing caps total base units at ~9.22e18. 18-decimals sources overflow
  immediately (9.22 whole tokens); `decimals <= 8` supports ~92B whole tokens. Ports must adjust decimals -
  compile-time diagnostic, loud doc note. (The existing virtual ERC-20 keeps full bigint range if native
  backing is not needed.)
- **balanceOf sees the ledger only.** Withdrawn native holdings are invisible to on-chain views; the SDK can
  offer an indexer-side `balanceOfNative`. Native plain sends emit no `Transfer` events (chain history serves
  instead).
- **Blacklist binds the ledger + bridge only.** Once withdrawn, tokens are cash - uncontrollable, inherent
  to native custody. Compliance is admission-based, not veto-based: see "enforcement polarity" above.
- **Contention.** Every ledger op co-spends the master thread: per-contract serialization. Unconfirmed
  chaining works; concurrent users race and retry (SDK already refetches state). Sharding balances across
  N thread NFTs is future work.
- **Approve race** (standard ERC-20 wart): ship `increaseAllowance`/`decreaseAllowance` too.
- **Stray sends** of X to contract addresses = donations (`pool > R + S`); optionally owner-sweepable.
  Mirrors tokens force-sent to EVM contracts.
- **Dust/fees.** New entries cost dust, funded by the tx sender (build-then-fund flow exists). A
  transfer to a fresh recipient auto-creates their entry - matches ERC-20 UX.

## Phasing

Reframed 2026-07-25 around Model A (FT-on-entry) as primary. The earlier "P1 = virtual mappings + pool" plan
described the DEMOTED bank model; it survives only as an optional preset.

- **P0 - design closeout.** Finish the owner-tag/signature mechanics (handoff item 1) and mint/burn/reserve
  under the multi-note model (item 2). Prerequisite to a correct P1 template.
- **P1 - Model A core (wrapped ledger).** Compiler: `mapping(...) native` value-location annotation (value in
  entry `tokenAmount`). SDK: entries carrying `amount > 0n` (today hardcoded `0n`; entry covenant already
  guards amounts - no covenant change) + `balanceOf` = sum-of-notes aggregation. Genesis: full premint to the
  reserve container. `mint` / `burn` / `burnToReserve` + master-mediated `transfer`. Auto-derivation reads
  `tokenAmount` for annotated mappings. Adversarial VM tests: inflation attempt (must be consensus-REJECTED),
  reserve untouchability (the 4 obligations), thread uniqueness, no-selfdestruct-drain, no-delegatecall-bypass.
- **P2 - masterless self-management.** Note-covenant ownership-preserving path (split / merge / consolidate):
  owner-sig + the output-scan lock (every category-X note output keeps the owner tag). Adversarial tests: the
  scan must make any ownership change on this path impossible (transfer-backdoor negative test).
- **P3 - allowances + permit.** Pool-style `allowance` mapping + always-master-gated `transferFrom`; `permit`
  via `checkDataSig`; `increaseAllowance` / `decreaseAllowance`; infinite-allowance sentinel `2^63-1`.
- **P4 - policy presets + the quarantined boundary.** Freedom vs compliance = which checks the master runs on
  an ownership change: blacklist / whitelist / freeze / `destroyBlackFunds`, boundary admission (open |
  whitelist | issuer-cosign | QUARANTINE), exit (open | quarantined | registered | vault-only | disabled).
  Two audited variants, not a flag matrix. New primitive: the **pending note** covenant - `deposit` (master
  free) / `claim` (master, BIP68 `sequenceNumber` equality-pin + blacklist read, permissionless) / `cancel`
  (masterless, depositor sig), and its withdrawal-side twin (`claim` / `recall`). SDK must pass
  `options.sequence` with bit 31 CLEAR on claims (the `0xfffffffe` default disables BIP68). Adversarial tests:
  claim before maturity must be consensus-rejected; forged commitment height must be irrelevant; a blacklisted
  claimant must be unable to claim while `cancel` still recovers the funds; no path may send a pending note
  anywhere except the claimant's balance or the depositor's P2PKH (no-confiscation invariant); a claim
  co-spending several pending notes must credit each to its own reconstructed claimant (no pooling into one
  balance); `deposit` must require no minting capability (regression guard on the pure-FT shape).
- **P5 - drop-in.** `solidityImportCompat` base-class substitution; mandatory `initialSupply` param; int64 /
  decimals diagnostic (`cap * 10^decimals <= 2^63-1`).
- **Later.** Master/thread sharding for transfer throughput; BCMR emission at deploy; ERC-4626 vault; native-
  form DEX integration; Model B (registered self-custody) as a separate product.

## Open decisions

1. DECIDED (2026-07-10): both burn flavors ship - permanent (implicit omission or OP_RETURN, `T -= x`) and
   returning (`burnToReserve`, physical return to the reserve container, `R += x`). Supply model normative:
   full premint at genesis, mint = release into circulation, `T <= initialSupply` forever.
2. DECIDED (2026-07-11): Model A (FT-on-entry wrapped ledger) is primary; balances multi-note; masterless
   path = ownership-preserving only; every ownership change + boundary crossing is master-mediated.
3. DECIDED (2026-07-10): reserve on a dedicated token container; `R` = its `tokenAmount` (no stored counter).
4. DECIDED (2026-07-25): **quarantined admission** is the default boundary shape - `deposit` lands in a
   pending note, matures after `X` blocks via a BIP68 `sequenceNumber` equality-pin, and `claim` is
   permissionless; the issuer's only power is blacklisting the claimant inside the window. Permissionless by
   default with a veto, so the issuer is never a liveness dependency and refusals are on-chain auditable.
   Confiscation is structurally impossible (`cancel` always returns to the depositor). The veto is
   ACTOR-based; coin-level taint is off-chain signal only. See "The boundary: quarantined admission".
5. DECIDED (2026-07-25): the EXIT posture is a deploy-time covenant variant, both audited - **freedom**
   (instant unvetoed `withdraw`, accepting that in-ledger freeze is escapable) and **compliance** (symmetric
   cooldown: pending-withdrawal note + master `recall`, giving the issuer `Y` guaranteed blocks). Baked into
   the covenant address at deploy, not flippable per-tx, same resolution shape as the masterless path.
6. RESOLVED (2026-07-25), was "deposit credit: call-only vs claim-by-proof": neither - it is the two-phase
   quarantined claim above. Deposit-initiation is master-free and capability-free (pure-FT send to a
   pair-parameterized covenant); the credit happens in the later permissionless `claim`.
7. OPEN - owner-tag encoding + masterless signature-check mechanics for the BALANCE note (handoff item 1).
   Candidate: `hash160(lockingBytecode)`, 20 bytes, uniform over P2PKH and p2sh32 owners. The pending note
   does not share this problem (its tags are in the covenant script).
8. OPEN - remaining boundary policy beyond the two presets: admission variants (open | whitelist |
   issuer-cosign) for issuers who want them, exit variants (registered | vault-only | disabled); the flat vs
   amount-tiered cooldown window (rec: flat - tiering invites structuring); the concrete `X` / `Y` defaults;
   keep in-ledger blacklist + `destroyBlackFunds`.
9. OPEN - `decimals` default 8 with the hard `cap * 10^decimals <= 2^63-1` compile check? (rec: yes.)
10. OPEN - `permit` + masterless self-path in P1/P2 vs deferred (rec: P2/P3 as phased above).
