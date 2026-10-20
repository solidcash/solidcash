# Per-call composition: transaction specification

Design spec for the framed path of `archive/docs:docs/framed/PLAN_MARKETPLACE_66.md` (its section 4).

Revision 17, 2026-10-20. Security assessment behind revisions 6-9: [`AUDIT_MSG_SENDER.md`](./AUDIT_MSG_SENDER.md).

---

## 0. Changes

### Since revision 16 (2026-10-20)

- **Token containers: categories, NFT custody, folding** (section 4b, `80c517ca7`). A container a master owns holds
  the category its slot names (security CONT-CAT-1). An immutable NFT with an empty commitment is held while it carries
  no fungible amount. A frame's NFT sends come first and are made from the containers its block ends on, so an NFT
  deposit settles beside NFT sends and two frames of one contract send NFTs of one category (DECISIONS D39). The last
  paying run folds the two smallest containers left into the one it keeps (D40).

### Since revision 15 (2026-10-20)

- **Token containers, completed** (section 4b). A container belongs to the master its unlocking names
  (`ba6296865`, DECISIONS D37). The container covenant takes only the master path, with the flag exactly 1, and
  every token container drops the merge path (`916bc9ea2`, `efba0f1ef`). A frame pays several categories and
  several containers, a callee frame pays from its own contract's containers (`05161d7d1`, `e38a89325`), NFTs are
  held, minted and released (`19eefe1d6`, D38), a view reads the reserve (`ccc325a42`), and a send on an untaken
  branch is dropped (`07ef425bd`).

### Since revision 14 (2026-10-20)

- **Token containers** (sections 4b, 20). A framed contract pays fungible tokens of another category out of its token
  containers (`6bf6b1683`, DECISIONS D34). Before, the container covenant pinned the amount (audit FRAMED-CONT-1), so
  a container could only be kept or merged into.

### Since revision 13 (2026-10-03)

Revision 14 records what landed after revision 13 (`3c0d52997`), and one place the implementation still differs.
- **Plain-path callees** (sections 10, 18). `callFramedEntry` plans the callee frames an entry reaches, each a frame
  of its contract's own block whose return is learned from its own close (`200a2079d`). A callee that emits or reads
  and writes a mapping entry is planned too (`7086239dc`): its events follow the root's, and its nodes are declared
  in the segments its artifact publishes. Chunks, value sends, side-cars, proxied callees and a write in a contract
  entered twice are refused by name.
- **Record indices** (section 20, W2). Every declared record index must name an input or an output, the
  created-record sentinel aside (`52fe8aa95`), which extends T52's rule from read-only entries to every record the
  head walks (T55).
- **Pools** (sections 12, 21). Every master's head requires each index's output to carry the category's minting NFT
  exactly when its input does, so only the admin's `split(n)`/`merge(n)` arm changes N (`27bc49b12`, T53; kernel
  `1cdb0094b`). The validator pool is not resized.
- **Constructors** (section 12). A master runs its constructor arm only when input 0 spends `(category, 0)`, which
  only the genesis does (`08d0bba27`, T54, DECISIONS D18).
- **Own-category census on the master path** (S2). A master that settles alone holds its category's immutable NFTs
  to the events its frame lists, and every input and output of the category to a fungible amount of 0 (`cd55e7a72`,
  T56).
- **Upgrades** (section 20). The layout-compatibility rule (`d01cb5f6b`).
- **Sends** (section 18). Handle sends take their turn in one queue per provider (`e786d49dd`).
- **Self-settlement** (section 7, S). A master runs S whenever it is its category's only master, is not a `DELEGATE`
  frame, and its block records no `DELEGATE` or `INTERNAL` call; before, a `DELEGATE` site anywhere in its code
  skipped S for every entry (`2d517da79`, T57). Call records were already bound one per call executed (section 4);
  the hop's plan for a skipped site is the open part (DECISIONS D17).
- **Value calls where the sender sends** (sections 4a, 4b, 10). A value send to a contract is a `CALL` made at its
  source position, closing the sender's segment there, so a call after it reads the recipient after its `receive()`
  ran; it was made after the sender's own code. The artifact publishes each send's place among the entry's calls
  (`sendCallsBefore`), and a data field the sender wrote before the call is read again from the segment it opens
  (`bc1496a95`).
- **Raw calls** (section 17). A `call` or `staticcall` whose payload names its call statically compiles as a typed
  frame of the spelled kind, and a literal signature the target lacks runs its fallback (`dc0307e8d`).
- **Calls after an early return** (section 18). A call an earlier `return` can skip is published as conditional,
  under the negated guard of each return before it (`296ae671c`).

### Since revision 12 (2026-10-03)

Revision 13 states what the implementation at `93822cd78` does where the text said otherwise. "DECISIONS Dn" names
row Dn of [`DECISIONS.md`](./DECISIONS.md), which is not the plan's Dn.
- **Value at the root** (W1). A `ROOT` frame may carry value into a payable body. The user pays it into the
  contract's containers, and 4b's conservation rule counts it; a body that is not payable requires 0.
- **Static frames** (V10). A read-only subtree makes only `STATIC` or `DELEGATE` calls, a delegate frame below
  being held to the same rules, so a view can reach an entry through a proxy.
- **Depth** (V6). The bound of about 30 call levels is the machine's, and holds only where the validator settles a
  contract; a chain of masters it does not settle is accepted at 40 levels. No rule depends on depth.
- **Validator facets** (sections 3.2, 12, 24). A head and one facet ship, with sizes measured at `93822cd78`; a
  wider split stays Phase R's.
- **Layout** (sections 5, 16). Compute side-cars for `keccak256` and `ecrecover` follow their master, and the body
  finds them at fixed offsets from its own input. The validator's facet follows its head.
- **D2** (sections 3.3, 7.3). The settlers enforce it; no covenant does on every path.
- **Mapping deletes** (sections 11, 16). A `delete` writes the default value and consumes no record.
- **Addresses** (section 17). In Solidity-compat mode, results and call arguments carry the 20-byte identity
  (DECISIONS D13).
- **Derivation** (sections 10, 18). No read stop site is published, and the host reruns the master twice per stop
  site. Resuming from a snapshot stays a stated future option.
- **Time** (sections 4a, 18). `block.timestamp` and `block.number` are registers of each contract's record, which a
  keeper or the mock clock writes; only `tx.time` is the transaction's.
- **Pools** (sections 12, 21). The default is 12 masters and 4 validators for every contract, and a deployment
  funds one facet UTXO.
- **Security** (section 9). T50 (DECISIONS D15), T51 (DECISIONS D16), T52 (the read-only presence check, read as
  absent only at the created-record sentinel, `8dedaf280`) and the residual G0 (DECISIONS D9).

### Since the implementation (2026-09-29)

- **Which records a frame declares.** A frame declares the data records its entry names, in the order its code reads
  them, and a record it does not declare is not spent (section 20). An entry that writes a verified mapping then
  declares every other data record, because its batch's groups follow every data record. Either then declares the
  node of each mapping key it only reads, ahead of any batch's groups.

### Since the implementation (2026-09-28)

- **Order.** The program derives the V6 order on chain and follows the record chains in it (section 7.2), so a
  transcript whose views chain only in another order is refused (T9, T30). The program got smaller doing it.
- **Created records.** A created record's chain starts from nothing in both reference models, as section 20 already
  said and the program already enforced.
- **Validator facets.** A validator may span several inputs (section 24). This resolves open point 7's size half;
  the facets are built in Phase R. Later: a head and one facet shipped the next day (revision 13).

### Since the implementation (2026-09-26)

- **Value tails.** The clause that said any value over 64 bytes takes the length-prefixed form is removed. The shipped
  classifier decides the form from the value's type, so `sig` and an unbounded `bigint` are stored verbatim and can
  exceed the 64-byte tail (section 20); no code measurement ever contradicted that.
- **Sends.** The wire form is what it always was, `{ out }`: the frozen codec, its vectors and every consumer agree on
  it, and the revision that added a paying record to the spec did not reach the codec. v1 pays a send from the
  contract's state record (section 11), and the 66 make no BCH send, so nothing needs the payer on the wire.

### Since revision 11 (fourth review, 2026-09-25)

- **Size.** Worked totals for the loader: the total improves about 2x, to about 64 KB at 4 KB facets and 100-125 KB
  at the 10,000 B cap, so either side of the relay line (section 12).
- **Receipts.** The residual that stays even with validator-enforced receipts is stated (section 14.1).
- **Value tails.** Both thresholds are stated side by side, as consequences of the 64-byte tail (section 20).
- **Validators.** The refusal names the first root's category. One validator per root category is not needed,
  because V9 constrains only a group's first root (section 21).

### Since revision 10 (third review, 2026-09-25)

- **Absence proofs** compare the masked slot `s(k)`, never the raw hash; slot 0 stays reserved for HEAD (section 20).
- **Values over 64 bytes**, later corrected: the classifier decides the form from the value's type, not from a
  measurement, so only variable-width values take the length prefix (section 20).
- **Validators cannot run out inside a transaction.** One validator of the first root's category can cover every
  root, so the old second exhaustion clause could never fire; it is replaced (sections 12, 21).
- **No step cap.** Derivation terminates because each step fills a witness of one bounded execution (section 18).
- **Conservation** is worded consistently: preservation is a floor, and full conservation stays open point 10
  (sections 11, 13).
- **Receipts.** The validator-enforced form's deadline is the freeze, whether or not hostile code appears. The roots
  it leaves unbound touch no honest contract (section 14.1).
- **Size.** Loading the code instead of carrying it ranks first, with its budget arithmetic. It removes the copy per
  entry but keeps one per distinct code: about 3x fewer for `arbitrate`, not 8x (section 12).

### Since revision 9 (independent review and its follow-up, 2026-09-25)

- **Refusals instead of silent limits.** Pool exhaustion (section 21) and a derivation that stops making progress
  (section 18) are refused before anything is built, each with a named diagnostic.
- **Records stated instead of delegated** (section 20):
  - nested-mapping slots: one collection, `mask(sha256(sha256(k0) || sha256(k1) || ...))`;
  - the 64-byte and 60-byte thresholds (fixed-width values versus length-prefixed ones);
  - fixed-size state arrays, and `__gap`, which the compiler drops.
- **Size on a real chain** (section 12), in two layers pinned in libauth:
  - per input, 10,000 B is consensus, so code splitting is required;
  - per transaction, 100,000 B is the relay (standardness) limit and 1,000,000 B the consensus limit. Code splitting
    bounds each master, not the transaction, which carries one code copy per entry. So `arbitrate` would be
    non-standard but consensus-valid: a relay question, not a validity wall.
  - The plan measures this first in Phase R, after M2, with the mitigations and their costs (A9, D3).
- **Security.**
  - A `V_TEMPLATE` defect is permanent for every v1 contract, proxies included (section 9, open point 13).
    Mitigations: an independent reference model with differential tests, and an external audit before the freeze
    binds.
  - Receipts can still be added later without a new validator version, as events the root master checks. That
    form stops an untrusted assembler; only the validator-enforced form binds hostile code, and it must land before
    the freeze binds (section 14.1).
- **Value conservation** is stated as the principle to prove (open point 10).
- **Counts.** Section 15 now matches Appendix B. 66/66 is a semantics result, not a safety or deployability claim.

### Since revision 8 (the 66, ahead of time)

- **Part II** (sections 16-23) settles every open point on the 66 critical path:
  - the witness block's byte layout;
  - canonical encodings, including addresses and SafeERC20 low-level calls;
  - SDK derivation, reverts, reads, snapshots, listeners and time;
  - proxies and the deployment fixture;
  - records, reusing today's formats;
  - pool sizes.
- **Catalogs.** Part II also lists every cross-contract edge the tests exercise, and every edge case, each with the
  rule that covers it. They come from code surveys of the contracts, the test file and today's record formats.
- **D9:** `V_TEMPLATE` v1 is frozen (open point 13).
- **Independent review of revision 7:** all findings are covered by revision 8. Minimal pushes are confirmed as
  consensus in libauth.

### Since revision 7 (recheck for completeness, sanity and security)

- **Proxies follow the EVM** (section 11). A call to a proxy runs on a master of the proxy, whose fallback
  delegatecalls the implementation. The "implementation master serving a proxy" is gone: without the proxy's own
  master, the proxy's state could not be spent (D1), and its new records and events could not be minted.
- **Delegate callees are bound** (V5, V11). A `DELEGATE` callee must be a master of the code its caller named, and an
  `INTERNAL` callee a master of the same contract (T37).
- **Settlement covers every frame on a contract's records** (R4, S, V7, V8). A contract whose records a `DELEGATE` or
  `INTERNAL` frame touches is validator-settled. V7 now also checks the input side, so an untouched record cannot be
  consumed (T38).
- **Values are preserved** (S4, D2). Records, masters and validators keep their value unless a listed transfer
  spends it (T39).
- **State UTXOs sit at their own lock** (section 3.3), `stateX`, as today's data-NFT covenant does. Revision 7's
  example put them at `lockX`, whose minting pin refuses them.
- **Witness block first** (section 4). It is the first push of a master's unlocking bytecode, and the master checks
  this itself.
- **Validator recognition under D9** (N1): through a 32-byte hash of `V_TEMPLATE` that every master carries.
- **Additions:** `value` and `sends[]` in the witness ABI; containers and distinct event indices in the census;
  transaction-wide time; threats T37-T41; section 15, coverage of the 66 marketplace titles.

### Since revision 6

Requirement (plan D7): `msg.sender` behaves exactly as in Solidity, in every call context.

- **Frames** (section 4a). Every execution has a `sender`, a `self` and an `origin`, set by how it was entered.
  - A message call gives the callee `msg.sender` = the caller's `self`.
  - This makes proxies, split contracts, `delegatecall`, `CREATE`, static calls and value sends match Solidity (audit
    S3, S6-S9).
- **Order** (V6). The validator derives the execution order itself, depth first from the call tree, and `M` lists
  only the roots (audit S1, S4).
- **Signature scope** (plan D8). No call receipts for now. A signed input authorizes every call that names it in the
  transaction; this is a documented residual (T32). Receipts are kept as a documented option (section 14.1).
- **Addresses** (R5, R8; plan D9). A contract's address is the address of its transcript (validator) contract,
  `addrX = addrV(catX)`. That script carries the same category pin as every other contract. The address is unique
  per category and shared by all facets, and it needs no anchor (T36).
- **Witness block** (section 4). There is one canonical block, and masters and the validator decode it identically
  (audit S5).
- **Threats T26-T36.**

### Since revision 5

- **Call kinds and `msg.sender`** (R3). The rule is Solidity's: `msg.sender` changes only on a message call.
  - Internal calls keep it.
  - Each top-level call keeps its own signer.
  - `this.g()` is a message call, so inside it `msg.sender = address(this)`. This holds whether it runs inline or
    on another master.
  - Checked against solc 0.8.36 in `@ethereumjs/evm`. Today's compiler keeps the caller instead (open point 9,
    plan D7).
- **`tx.origin`.** A new `originRef` witness names the root user's input. It is bound at the root and carried
  unchanged along edges (N1, V4, V5).
- **Signed callers.** A P2PKH input can name a caller or an origin only if its signature uses `SIGHASH_ALL` without
  `ANYONECANPAY` (W1).
- **No self-reference.** A master never names itself as its caller or as a callee (W1, W2).
- **Threats T18-T25**, plus a stricter T16.

### Since revision 4

- **Notation.** Contracts keep their standalone call notation. The per-function composition witnesses (section 4)
  depend only on the function's code, never on the transaction shape.
- **Self-calls.** `this.f()` runs inline in the caller's master. A contract gets one master per entry from another
  input, not one per call.
- **Masters never parse a transcript.** Every cross-input check lives in separate validator inputs, which run one
  fixed, generic program.
- **Where the transcript lives.** It is no longer at transaction input 0. It is the data of a validator input that
  follows the master ladder of its owner's block. Validators are owned per contract, not per user.
- **When a validator is needed.** A local test per master decides whether it needs a validator. A transaction may
  carry several validators, each covering a disjoint set of masters.
- **What the transcript holds.** Only structure. Every fact (arguments, results, state) is a witness of the master
  that produces it.
- **State.** State is read and written through per-segment views. A contract with one master settles itself; a
  contract with several masters is settled by its validator.
- **Now part of the spec:** the identity rules, the threat model, and the Track P output rules (no `OP_RETURN`, no
  bare `OP_1`).

---

## 1. Rules

**R1. Notation.**
- Every externally callable function has exactly one notation: its source arguments plus the composition witnesses
  of section 4.
- The same function has the same notation in `A`, `AA`, `AB`, `ABBA`, and so on.

**R2. Masters.**
- A contract X owns N master UTXOs. Each one sits at `lockX = P2SH32(code_X)` and holds a minting NFT of `catX` with
  an empty commitment.
- N is chosen at deployment and changed by the admin with `split(n)` / `merge(n)`. These are the only functions
  that add or remove masters or validators.
- A split contract's masters run different facet code at different locks, all with the same category `catX`.
- A spent master executes one entry into X and is recreated unchanged at the same output index.

**R3. Calls and `msg.sender`.** Solidity semantics: `msg.sender` changes only on a message call, which is any
external call, including one to the contract itself. It never changes on an internal call.

| Call form | Runs | `msg.sender` inside | `tx.origin` inside |
| --- | --- | --- | --- |
| Internal: `g()`, `super.g()`, modifiers, internal library functions | Inline | Unchanged | Unchanged |
| Top-level call by a user | On a master of the callee | The user's P2PKH lock | The user |
| Several top-level calls into X in one transaction (`A.x` and `A.y`) | One master each | Each call's own signer | Each call's own signer |
| External self-call `this.g()` | Inline | `address(this)` | Unchanged |
| External call whose runtime target is X itself (`IX(t).g()` with `t == address(this)`) | On another master of X | `address(this)` | Unchanged |
| External call to another contract | On a master of the callee | The calling contract's address | Unchanged |
| Static call (a `view` or `pure` function through an interface) | On a master of the callee, read-only (V10) | The calling contract's address | Unchanged |
| Value sent to a contract (`transfer`, `send`, `call{value: v}`) | The recipient's `receive()` / `fallback()`, on a master of the recipient | The sending contract's address | Unchanged |
| `delegatecall` to the contract's own code (the `Multicall` pattern) | Inline | Unchanged | Unchanged |
| `delegatecall` to other code (a library's external function; a proxy's implementation) | On a master of that code, in the caller's context (section 4a) | Unchanged | Unchanged |
| Internal call into another facet of a split contract | On a master of that facet, in the caller's context | Unchanged | Unchanged |
| `new C(...)` | C's constructor, on the new contract's genesis | The creating contract's address | Unchanged |

- So `msg.sender` stays the calling user in `A`, in every internal call, and in each call of `A.x` + `A.y`. It
  changes on message calls only, and `this.g()` is one.
- `address(this)` stays the caller's across `delegatecall` and internal calls. After a message call or `new` it is
  the callee's.
- The two self-call rows give the same identity, so authorization never depends on whether the compiler resolved
  the target statically (T25).
- A call to a proxy runs on a master of the proxy, whose fallback delegatecalls the implementation (section 11).
- Inside library code running as a `DELEGATE` frame, `this.g()` is a message call to the context contract, so it
  runs on that contract's master, not inline.
- The number of X's masters in a transaction equals the number of entries into X from other inputs.

**R4. State.**
- X's state lives once, in X's state UTXOs at `stateX` (section 3.3): data NFTs, mapping entries, chunks.
- Executions read and write it only through views (section 4).
- X's single master settles X only if it is X's only master in the transaction and it made no `DELEGATE` or
  `INTERNAL` call. Otherwise X's validator settles it (V8).

**R5. Validators.**
- A validator input carries the transcript `M` and runs `V_TEMPLATE`, one fixed generic program.
- It is owned per contract: a mutable NFT of the owner's category at `addrV(cat) = P2SH32(pin(cat) || V_TEMPLATE)`.
  `V_TEMPLATE` is frozen in version 1, because it is part of every contract's address (open point 13).
  - `pin(cat)` is the category pin every stateful contract's script starts with:
    `<cat || cap> OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_EQUALVERIFY` (`contract-creation.md`), with `cap = 0x01`
    here.
  - `addrV(catX)` is also X's address, `addrX` (R8).
- It is placed right after its owner's master ladder and recreated in place.

**R6. Need test.** A master needs a validator if and only if at least one of these holds:
- its frame is not `ROOT`, that is, its caller is not a signed P2PKH input;
- it executes an external call;
- its contract has more than one master in the transaction.

Otherwise it is standalone.

**R7. Binding.**
- A master that needs a validator points to it with its `validatorRef` witness, and the validator lists exactly the
  masters that point to it.
- Call edges and multi-master contracts never span two validators.

**R8. Identity.**

| What | Identified by |
| --- | --- |
| A master | Its category with minting capability |
| Its code | Its locking bytecode, `lockX = P2SH32(code_X)`. `code_X` starts with the category pin and carries `addrX` as a constant |
| Its address: `address(this)`, and the `msg.sender` its callees see | `addrX = addrV(catX)`, the address of its transcript contract (plan D9). It is unique per category, since the category is hashed into it. All facets share it. Behind a proxy it is the proxy's |
| A user | A signed P2PKH input (W1) |
| A state UTXO | A mutable NFT of `catX` at one of X's record locks (sections 3.3, 20) |
| A validator | Its derived lock plus a mutable NFT of the same category |

NFT commitments are never used for identity.

**R9. Placeholders.**
- No `OP_RETURN` outputs and no bare `OP_1` outputs.
- An unavoidable placeholder is a 1,000-sat P2PKH to the funder, located by position (PLAN Track P).

**R10. Signature scope** (plan D8).
- A user's signed input authorizes every call in the transaction that names it as caller. Any number of calls may
  name it.
- The signature covers every output, but not the other inputs' witnesses, which say which calls are made in the
  user's name. A wallet must decode those witnesses to show the user their calls (T32).
- Call receipts, which would put each such call into the signed outputs, are a documented option (section 14.1).

---

## 2. Example: `A -> B -> B -> A`

```solidity
contract A {
    uint256 count;   // field 0
    uint256 hits;    // field 1
    uint256 last;    // field 2
    IB b;            // field 3: B's address, set after deployment
    event F(uint256 r);

    function f(uint256 x) external {
        count += 1;              // before the call
        uint256 r = b.g(x);      // external call
        last = r;                // after the call
        emit F(r);
    }

    function k() external returns (uint256) {
        require(msg.sender == address(b));
        hits += 1;
        return count;            // must see f's write: A is mid-execution
    }
}

contract B {
    uint256 total;   // field 0
    IA a;            // field 1: A's address, set after deployment

    function g(uint256 x) external returns (uint256) {
        require(msg.sender == address(a));
        total += x;
        uint256 y = this.h(x);   // self-call: runs inline, msg.sender = addrB
        return y + total;        // must see h's write, and anything A did meanwhile
    }

    function h(uint256 x) external returns (uint256) {
        require(msg.sender == address(this));
        total += 1;
        return a.k();            // external call: re-enters A
    }
}
```

`msg.sender` in this example, as in the EVM:
- `A.f`: the user `U`.
- `B.g`: `addrA`.
- `B.h`: `addrB`, because `this.h(x)` is a message call. Had `B.g` called `h(x)` internally, `h` would see `addrA` and
  its `require` would fail, exactly as in Solidity.
- `A.k`: `addrB`.

`tx.origin` is `U` everywhere.

**Before the call:**
- A has 2 masters, 1 validator UTXO, and data NFT `DA = {count: 5, hits: 0, last: 0, b: addrB}`.
- B has 1 master and data NFT `DB = {total: 10, a: addrA}`.
- The user calls `A.f(3)`.

**After the call** (EVM result): `DA = {6, 1, 20, addrB}`, `DB = {14, addrA}`, and one event `F(20)`. All masters and
the validator are unchanged.

**Entries** (executions on separate masters):

| Entry | Call | Caller | Runs on |
| --- | --- | --- | --- |
| 1 | `A.f(3)` | user (root) | A master #1 |
| 2 | `B.g(3)`, including `B.h(3)` inline | entry 1 | B master #1 |
| 3 | `A.k()` | entry 2, from inside the inline `B.h` | A master #2 |

**Segments.** Each execution is split at its external calls. In execution order:

| Seq | Master | Segment | State effect |
| --- | --- | --- | --- |
| 1 | A m1 | `f`, segment 0 | count 5 -> 6 |
| 2 | B m1 | `g` + `h`, segment 0 | total 10 -> 13 -> 14 |
| 3 | A m2 | `k`, segment 0 | reads count = 6; hits 0 -> 1 |
| 4 | B m1 | `g`, segment 1 | reads total = 14 |
| 5 | A m1 | `f`, segment 1 | last = 20; emits `F(20)` |

A runs on two masters, so its validator settles it. B runs on one master, so B settles itself.

---

## 3. Scripts

### 3.1 `code_X`: the contract

`code_X` runs only for masters. Its category pin (`cap = 0x02`) refuses anything else at `lockX`.

| UTXO being spent | Does |
| --- | --- |
| A master (`catX` minting) | P (preserve itself), W (execute, checking its witnesses), N (need test), S (settle, only when R4 allows) |
| Anything else at `lockX` | Refuse (the pin) |

### 3.2 `V_TEMPLATE`: the validator

- One fixed program, the same for every contract. Only the category pin in front of it differs.
- Unlocking bytecode: `<M> <push(pin(cat)) || V_TEMPLATE>`.
- The pin is pushed, not bare: a bare category is 32 arbitrary bytes and the machine would execute them as opcodes,
  so the redeem script is a data push followed by the program, and `addrV(cat)` hashes those bytes.
- The program reads its own bytes with `OP_ACTIVEBYTECODE` and skips the pin push to find itself, which is what lets
  one program derive every category's address. It is emitted by the compiler (`buildValidatorParts` in
  `solidc/src/framed/validator/program.ts`), and whether its cost fits the runtime budget at the 66's widths is
  open (sections 12, 24).
- It checks V1-V11 (section 7.2).
- It spans two inputs, a head and one facet (section 24); the head is the input described here.
- Its correctness is the security core of all composition (section 9).

### 3.3 `stateX`: state UTXOs

- `stateX` stands for X's record locks: the data-NFT lock, one per mapping collection, and those for value chunks,
  dynamic chunks and containers (section 20).
- All are today's generic covenants, derived from the category (and a salt). They pin `catX` with `cap = 0x01`.
- They run D1. D2 is enforced by the settlers, not by the covenants (section 7.3).

---

## 4. Composition witness ABI (per function, static)

| Witness | Present | Meaning |
| --- | --- | --- |
| `kind` | Always | How this execution was entered: `ROOT`, `CALL`, `STATIC`, `DELEGATE`, `INTERNAL` or `CREATE` (section 4a) |
| `sender`, `self` | Always | This execution's `msg.sender` and `address(this)`, checked as in section 4a |
| `value` | Always | This execution's `msg.value`; 0 when none |
| `callerRef` | Always | Input index of the caller: a signed P2PKH input (a user) or the caller's master |
| `originRef` | Always | Input index of the root user's signed P2PKH input: `tx.origin` for this execution and for everything it calls |
| `validatorRef` | Always | Input index of the covering validator; `-1` when standalone |
| `calls[] = (kind, target, value, calleeRef, argsHash, result)` | One per external call executed | The kind of call, the address called (for `DELEGATE`, the code's contract), the value sent, the callee's master, `H(selector \|\| args)` of the call, and the value it returned |
| `retval` | Functions that return a value | The value returned |
| `views[] = (viewIn, viewOut)` | One per segment | For each state record the segment touches, its commitment at the segment's start and end |
| `events[]` | One per event emitted | The event's output index |
| `sends[]` | One per value send to a user | The output index of the payment |

- **Witness block.** All witnesses form one block, the first push of the master's unlocking bytecode.
  - It holds a version byte, then length-prefixed fields, and nothing inside it may follow the last field.
  - Being first, it is found by reading a single push prefix. Unlocking bytecode is push-only and its pushes must be
    minimal, both by consensus. libauth enforces minimal pushes in every push, standard or not (`push.js:97-104`).
    So there is only one encoding.
  - The master reads its own unlocking bytecode (`OP_INPUTINDEX OP_INPUTBYTECODE`) and requires its first push to be
    exactly the block it executed with. So the validator always reads the block the master used (T33).
  - The byte layout is open point 1.
- **Loops.** Calls, segments and events inside loops make those arrays variable in length. The witness kinds still
  depend only on the function.
- **Records.**
  - A record is a whole state-UTXO commitment (data NFT, entry, chunk). It is keyed by its input index if it exists,
    or its output index if it is created.
  - Executions decode fields from records themselves. Settlement compares whole commitments, so it needs no field
    layout.

---

## 4a. Frames and identity

Every execution runs in a frame with three values:
- `sender`: `msg.sender`;
- `self`: `address(this)`;
- `origin`: `tx.origin`.

Solidity defines them by how the frame was entered:

| `kind` | Entered by | `sender` | `self` | `origin` | Storage |
| --- | --- | --- | --- | --- | --- |
| `ROOT` | A user's call | The user | The callee | The user | The callee's |
| `CALL` | A message call: another contract, `this.g()` on another master, a value send | Caller's `self` | The callee | Caller's `origin` | The callee's |
| `STATIC` | A call to a `view` or `pure` function | Caller's `self` | The callee | Caller's `origin` | The callee's, read-only |
| `DELEGATE` | `delegatecall`, including a proxy's fallback calling its implementation | Caller's `sender` | Caller's `self` | Caller's `origin` | The caller's |
| `INTERNAL` | An internal call into another facet of a split contract | Caller's `sender` | Caller's `self` | Caller's `origin` | The caller's |
| `CREATE` | `new C(...)` | Caller's `self` | The new contract | Caller's `origin` | The new contract's |

**Inline frames** take their values from the enclosing frame at compile time, and no witness is involved. They
cover:
- internal calls;
- inline `this.g()`;
- `delegatecall` to the contract's own code.

**A master's frame** takes its values from its witnesses. Each value is checked by the master itself or by the
validator:

| Value | Checked by the master itself | Checked by the validator (V5) |
| --- | --- | --- |
| `sender` of a `ROOT` frame | Equals the lock of `callerRef`, a P2PKH input signed with `SIGHASH_ALL` (W1) | |
| `sender` of any other frame | | Equals the caller's `self` (`CALL`, `STATIC`, `CREATE`) or the caller's `sender` (`DELEGATE`, `INTERNAL`) |
| `self` of a `ROOT`, `CALL`, `STATIC` or `CREATE` frame | Equals the `addrX` constant baked into its code, which is `addrV(its category)`. Facet masters hold the contract's own category, so every facet presents the same address | Equals `addrV(its category)` (V11). For `CALL` / `STATIC` / `CREATE`: also equals the target the caller recorded |
| `self` of a `DELEGATE` / `INTERNAL` frame | | Equals the caller's `self`. The frame runs on the caller's records. Its own master is bound to the call: for `DELEGATE`, a master of the contract the caller named; for `INTERNAL`, a master of the same contract (V5) |
| `origin` | `ROOT`: `originRef == callerRef` (O1) | Otherwise equals the caller's `originRef` |

**Where `address(this)` comes from.**
- `addrV(c)` is `OP_HASH256` over `pin(c) || V_TEMPLATE`, wrapped as a P2SH32 lock. It depends only on the
  category, so the SDK knows `addrX` as soon as `catX` exists.
- The SDK bakes `addrX` into `code_X` at deployment, next to the category pin.
  - A master running its own contract's frame reads `address(this)` from that constant.
  - The constant is part of the pinned code that `lockX` hashes, so it is as unforgeable as the pin, and the master
    never carries `V_TEMPLATE`.
  - `OP_INPUTINDEX OP_UTXOBYTECODE` would give `lockX`, not `addrX`.
- A `DELEGATE` or `INTERNAL` frame takes `address(this)` from its `self` witness, which V5 checks against its caller.
- The validator computes `addrV(c)` for any category from its own code: `OP_ACTIVEBYTECODE` without its pin, then
  `pin(c)` in front.

**Frames on another contract's records** (`DELEGATE`, `INTERNAL`).
- Such a frame runs on the records of its caller's context contract X, whatever its own master's category.
- X is then validator-settled (V8).
- X's views chain across every frame that runs on X's records, in V6 order (V7).
- Records and events such a frame creates are X's. Consensus lets them be minted, because the chain of callers
  starts at a master of X, which holds X's minting NFT.

**Time.** `block.timestamp` and `block.number` are not the transaction's. Each compiles to a register of the
contract's own state record, `__block_timestamp` and `__block_number` (`SynthesizeBlockOracle.ts`):
- on a live chain a keeper refreshes them through the contract's owner-signed `__updateBlockOracle` entry
  (`solidcash/src/oracle/blockOracleUpdater.ts`);
- the mock provider writes its clock into the registers of every registered deployment whenever it mines a block,
  which it does for every transaction it accepts and for `evm_mine`, and on `evm_increaseTime`.

A frame reads the register of the contract whose records it runs on (the proxy's, for its implementation's
`DELEGATE` frame). So two contracts in one transaction read the same time only as far as their registers agree: on
the mock, which writes one clock into every registered deployment, they do; on a live chain, as far as their keepers
keep them. `tx.time` is the transaction's locktime, the same for every frame, and the SDK sets it before it derives
anything.

**Value sends.**
- A value send to a P2PKH lock is an output.
- A value send to a contract is a `CALL` into its `receive()` or `fallback()`, with `msg.value`, made where the
  sender sends (section 4b).
  - The recipient's master mints a satoshi container holding the value. This is how paying a contract already works
    today.
  - A plain output to a contract was never a payment.
- If the recipient has neither function, it fails, and so does the transaction, as in the EVM.
- The sender's own code enforces this split from the target lock type (T35).

**Static frames.** A `STATIC` frame, and every frame it enters:
- leaves every record unchanged in every segment;
- emits no event;
- sends no value;
- creates nothing (V10).

---

## 4b. Value (resolves open point 10)

A contract's BCH follows the EVM's account model: a contract has a balance, value reaches it only as the
`msg.value` a frame of it receives, and value leaves it only as a send or as the `msg.value` it passes to a callee.

- **Balance.** X's balance is the value of its satoshi containers: the tokenless UTXOs at `containerX`, the
  container covenant the direct convention already uses for X's category. A container is spent only beside a
  master of X, so every change to X's balance runs X's code.
- **Receiving.** A frame that carries value is a message call into a payable body: `receive()`, a `payable`
  function, or a payable `fallback()`. A body that is not payable requires `value == 0`, the EVM's call-value
  check.
- **Dispatch.** A master dispatches as the EVM does: a selector a body has runs that body, and any other runs the
  fallback, or fails when the contract has none.
  - A value send's call data carries the selector of `receive()` alone where the EVM's is empty, so it runs
    `receive()`, else the fallback, which is handed empty call data as its input.
  - Any other fallback's input is the frame's call-data band: the selector's push and the argument pushes, as the
    unlocking bytecode carries them. The fallback's own ABI selector is not one a call names, so a frame carrying it
    reaches the fallback as call data like any other.
  - A contract whose only body is a fallback forwarding its call data to an address it holds is the proxy
    (section 11): its head leaves the band as the fallback's parameter and dispatches nothing.
  - `msg.data` is the same band, read from the frame's own input wherever a body asks: empty for a value send. A
    master with one entry and no fallback is entered by a user without a selector, so its band would differ between
    a user's frame and a caller's; `msg.data` there is refused by name.
- **Sending.** `transfer(v)`, `send(v)` and `call{value: v}("")` to a P2PKH lock are a listed send (4a). To any
  other lock they are a `CALL` carrying the selector of `receive()` alone, whose call record carries `value = v`:
  the recipient runs its `receive()`, else its payable `fallback()`. The sender's own code chooses by the lock's
  length, so no witness chooses it. The call is made where the source sends, as the EVM makes it: it closes the
  segment the sender's code before it ran in and binds the next call record, so the sender's later code, a call
  that reads the recipient among it, runs after the recipient's body. A send to a user's lock is pinned once the
  sender's own code has run; it makes no call, so it closes no segment. A recipient with neither body, or whose
  fallback is not payable, cannot run the frame, so the transaction fails, as in the EVM; the SDK reads the
  recipient's artifact and refuses by name to compose such a send. The artifact publishes, for each send, how many
  calls the entry makes before it (`sendCallsBefore`), and the SDK places each value call there, past the value
  calls of the earlier sends it resolves to contracts; a contract the sender both pays and calls is one block, whose
  later frames start from the records the recipient's body left. The SDK plans the recipient body's events, mapping
  writes and sends to users' locks as it plans the sender's, learning what the body computed from the recipient's
  own program; a recipient's sends are paid from what it receives, then from its own containers, as the EVM's are
  from its balance; a send on a branch is listed when the run makes it, as the sender's is. A recipient body that
  calls, or sends to a contract, is not composed yet. A composed call cannot fail (T22), so `send` and `call`
  return `true` whenever the transaction is valid.
- **No gas, so no stipend.** BCH has no counterpart of gas, so `receive()` and `fallback()` are more permissive
  than in the EVM: whichever spelling sent the value, the recipient's body may write state, emit, send and call,
  where the EVM's `transfer` and `send` give it a 2300-gas stipend, enough for little more than an event.
  - A contract that relied on the stipend to keep a recipient from re-entering it has no such guard here.
  - The recipient runs where the sender sends, so it sees the sender's records as the segment the call closes left
    them, and a recipient that calls back makes the sender a contract with two masters in the transaction, which
    the validator settles.
  - After the call the sender reads a data field it wrote before it from the segment the call opened, so it sees
    what a recipient that called back left there, as the EVM's storage does. A verified-mapping value it wrote
    before the call is still read as it wrote it; for a recipient that calls back and rewrites that entry, this is a
    departure.
- **Conservation, per contract X.** `growth(X) >= in(X) - out(X)`, where
  - `growth(X)` is the value of X's container outputs less the value of the containers X spends;
  - `in(X)` is the `value` of the frames entered into X from outside its context (`ROOT`, `CALL`, `CREATE`);
  - `out(X)` is what X pays: its listed sends and the `value` of its `CALL` and `CREATE` records.
  - X's master checks it when it settles X alone; the validator checks it otherwise (V7). Records keep exactly
    their value, so a contract's balance moves only as its own code pays: nobody else, the funder included, can
    take it.
  - The rule is an inequality. A contract never credits value it did not receive and never pays out more than
    its code sends, while value from outside it, a funder paying one of its sends or value placed in a container
    directly, is a gift, as a balance forced on a contract is in the EVM. The SDK composes the equality: it pays a
    contract's sends from its containers and refuses one its balance cannot cover, as the EVM reverts it.
  - The inequality is kept for now and is to be revisited (user direction 2026-09-29): holding a contract to the
    equality on chain would refuse a funder's gift, which the EVM cannot refuse either.
  - The rule is checked per transaction, where the EVM checks each send against the balance at that moment: a
    contract may pay out value it receives later in the same transaction. This is one departure; a mapping value
    read back across a value call (No gas, so no stipend) is the other.
- **What the master checks today.** A frame that settles alone is weighed by its own master: the growth of its
  contract's containers plus what the frame's listed sends and the records of its calls pay covers the value the
  frame receives, so the contract pays its sends and its value calls from them. A frame that does not settle alone
  is weighed with every other frame of its context by the validator that settles the contract (V7); its master
  checks only that its sends follow a container of that contract, the caller's for a `DELEGATE` frame, which passes
  its caller's value through and pays from the caller's containers. A `STATIC` frame takes no value and sends
  nothing (V10). A master with no payable body requires every frame's value to be zero. A value send's call binds
  its record's `value` to the amount; any other call site requires it to be zero.
- **A send's payer.** A listed send is an output index, so on its own nothing ties it to the frame that pays it:
  two frames could list one output and both count it, and two purchases from one seller would pay the seller once.
  A frame's sends therefore follow one of its own contract's containers, in a run: the output before the first send
  is at the container lock of the contract whose records the frame runs on, and each later send is the next
  output. Two contracts' runs never overlap, since the output before one run would have to be the other's send or
  the other's container, and the validator requires the sends of one contract's frames to be distinct outputs (V7).
  A covenant outside this convention that counts an output by its position alone can still count one of these
  sends; that attribution is its own.
- **A send on a branch** is made only when its branch runs; otherwise it lists no output and makes no call. The
  block lists exactly the sends made, in the order the body made them, and the call records exactly the value calls
  made. A composer cannot tell ahead of the run which branches run, so the SDK plans every send the entry can make
  and drops what the body shows it did not make: the listed sends past the ones it pinned, and a value call it made
  to another contract or not at all.
- **Token containers.** X holds tokens of another category Y in containers at X's container lock for Y. A
  contract whose entries name a token container uses the accounted container covenant. It has one spending path,
  taken with the flag exactly 1, so a container's unlocking starts `<a master's input index> OP_1`, the input at that
  index being a master of X. The output at the container's own index keeps its lock, full category, commitment and at
  least its satoshis, or is tokenless once drained; the fungible amount is the master's to account. No token
  container has a merge path any more: it pinned neither an NFT's commitment nor its capability.
  - **Ownership.** A master owns the containers at the lock whose unlocking names it, and they are one block of
    consecutive inputs, each holding Y: a container of another category at the lock is no reserve of Y (security
    CONT-CAT-1). Consensus keeps an unlocking push-only, minimal and clean, so that prefix is the container's own claim,
    and each container is checked by exactly the master it names. Two frames of X pay Y from containers of their own.
  - **Sends.** The k-th send a frame makes is the output at its block's first index plus the block's size plus k, its
    NFT sends first. A fungible send pays the recipient's lock exactly the amount of Y; an NFT send gives it an NFT of Y
    with the commitment and capability the body names and no fungible amount, pinned in that order: the category with
    the capability's byte, the lock, the commitment, the amount. The block is contiguous, so another frame's sends
    cannot share these outputs. The witness block is unchanged, so the validator reads nothing new.
  - **Conservation.** The master conserves what it owns: the amounts at its containers' own indices, less what they
    held, plus its fungible sends, is at least zero.
  - **Reads.** A read of `this.tokens[Y].tokenAmount` sums the containers the frame owns, and its `outState` form their
    outputs in place; the containers the transaction creates at the lock count for `outState` only when the frame is
    its contract's only master in the transaction. Two frames of one contract therefore never count one deposit
    twice, as two `wrap` frames reading the transaction's whole growth did. `tokenCategory` and `nftCommitment` read
    the first container the frame owns.
  - **NFTs.** The VM sees an NFT through a capability, a commitment, or a token with no fungible amount; an immutable
    NFT with an empty commitment beside a fungible amount reads as fungible, so no rule here can hold that one. An
    entry that sends no NFT of Y keeps every NFT it owns in place and owns no minting one, so only a frame that sends
    NFTs ends its block on a container of Y that released its NFT or holds a minting one, and it lets no NFT of Y leave
    the lock right after its NFT sends. A frame that sends NFTs checks every container of Y at the lock, whoever owns
    it: every NFT of Y leaving the lock follows such a block, within that frame's sends; the containers release no more
    NFTs than those sends; and each NFT with a capability the transaction adds at the lock, which a read counts, is
    matched by one an input outside it holds, a minting one by a minting one. While a minting container is spent it
    mints the sends: nothing is released, and no fungible amount of Y leaves the lock, where it could hide a minted NFT.
    Otherwise the last containers of each sending frame's block release one NFT per send, in send order: an immutable
    NFT of the send's commitment, or a mutable one. A builder that makes a send from an NFT of its own therefore cannot
    keep the released one, which no send pins.
  - **Other categories.** Every entry of X keeps, at their own indices, the containers it owns of a category it does
    not name: the same full category and at least the amount, and none of them holds a minting NFT. A frame of X
    therefore cannot draw a container down on another frame's authority (audit FRAMED-CONT-1).
  - **Composition.** The SDK lays a token run per paying frame and category after the participants, the root's first:
    the frame's containers, then its sends. A run keeps what it holds on one container and drains the rest into it. A
    category's last paying frame spends every container left; once its sends are learned, it spends those that cover
    them and folds the two smallest left into the one it keeps, unless that pushes the transaction past a VM density
    limit, when it spends only the covering ones. An earlier frame that runs short takes one more, and the call is
    planned again. A frame that only reads the amount spends the containers too, so the read is the whole reserve, as a
    framed read's view is; a fungible deposit merges into such a run, and otherwise, like an NFT deposit, becomes a new
    container of the contract whose frame names the category. A frame sending NFTs spends, last in its run, the
    containers its sends are made from, chosen once they are learned, and the call is planned again when that changes
    them; a contract holding a minting NFT of the category mints instead, from a minting container each such frame
    spends. The caller's coins fill the indices between runs. A send on a branch not taken is dropped as a value send
    is.
- **`address(this).balance`** is X's balance as the EVM's stands at that point of the frame: the value of the
  containers the transaction spends at X's container lock (the context contract's, in a `DELEGATE` frame), with
  the frame's `msg.value` credited and the sends the body has made so far taken out.
  - A transaction shows only the containers it spends, so the value is a lower bound its composer chooses. The
    compiler publishes the entries that read their balance (`composition.balanceReaders`), and the SDK spends every
    container of the contract for them, which makes the read the whole balance; a hostile composer may present
    fewer. A contract should not price anything by its balance, the advice the EVM's forced balances already give.
  - A read of another address's balance is refused by name: a transaction shows no account balance for it.

---
## 5. Transaction layout

| Region | Inputs | Outputs |
| --- | --- | --- |
| One block per contract, in order of first entry | Its masters (the ladder), each followed by the compute side-cars its frame co-spends; then, in the owner's block only, its validator and the validator's facet (section 24); then the contract's touched state UTXOs | Each recreated, or its successor, at the same index |
| Trailing | (none) | Events, each sending frame's container and then its value sends, then created UTXOs (new entries, chunks, containers) |
| Fee | Funder inputs, including every root caller's signed input, and the containers a frame pays from | Change |

**Compute side-cars** (`solidcash/src/framed/composer/layout.ts`, `recovery.ts`).
- A frame whose body hashes with `keccak256` or recovers a signer with `ecrecover` co-spends side-car inputs right
  after its own master: each recovery's A/B pair in call order, then one keccak side-car per recovery projected to
  an EVM address, then one per `keccak256` call in the order the body makes them.
- The body finds them at fixed offsets from its own input (section 16), even in a frame that runs on its caller's
  records. Each side-car recreates itself at its own index, like every other participant.
- A side-car is a UTXO at its covenant's shared lock, holding that covenant's own token rather than the contract's.
  It is not a record: no view declares it, and no census counts it.
- The SDK spends live side-car UTXOs and refuses by name a pool that is short (`call/side-cars.ts`). A constructor's
  frame co-spends its side-cars the same way (`c937caa8f`). A preimage or digest the body computes is learned from
  the body's own bind (section 18).
- A recovery inside a loop would need a run-time number of side-car pairs, and is refused by name
  (`solidc/src/framed/master/support.ts`). A `keccak256` call inside a loop reads one side-car per turn: the body
  counts the side-cars it has read, and the artifact publishes the loop's recurrence, by which the SDK counts the
  side-cars it lays (`master/loop-effects.ts`, `call/loop-turns.ts`). An extra side-car is never read.

### 5.1 `ABBA` inputs

| # | UTXO | Token | Unlocking bytecode | Role |
| --- | --- | --- | --- | --- |
| 0 | A master #1 at `lockA` | `catA` minting, empty commitment | `<f args + witnesses> <code_A>` | Entry 1: `A.f` |
| 1 | A master #2 at `lockA` | `catA` minting, empty commitment | `<k args + witnesses> <code_A>` | Entry 3: `A.k` |
| 2 | A validator (A's transcript) at `addrA = addrV(catA)` | `catA` mutable | `<M> <pin(catA) \|\| V_TEMPLATE>` | Validates entries 1-3; settles A |
| 3 | `DA` at `stateA` | `catA` mutable, `{5, 0, 0, addrB}` | `<pin(catA) \|\| STATE_CODE>` | A's state |
| 4 | B master #1 at `lockB` | `catB` minting, empty commitment | `<g args + witnesses> <code_B>` | Entry 2: `B.g`, with `B.h` inline |
| 5 | `DB` at `stateB` | `catB` mutable, `{10, addrA}` | `<pin(catB) \|\| STATE_CODE>` | B's state |
| 6 | User coin, `P2PKH(U)` | none | `<sig> <pubkey>` | Fee; root caller |

### 5.2 `ABBA` outputs

| # | Lock | Token | Checked by |
| --- | --- | --- | --- |
| 0 | `lockA` | `catA` minting, empty commitment | Input 0 (P2) |
| 1 | `lockA` | `catA` minting, empty commitment | Input 1 (P2) |
| 2 | `addrA = addrV(catA)` | `catA` mutable, unchanged | Input 2 (V1) |
| 3 | `stateA` | `catA` mutable, `{6, 1, 20, addrB}` | Input 2 (V7, settles A) |
| 4 | `lockB` | `catB` minting, empty commitment | Input 4 (P2) |
| 5 | `stateB` | `catB` mutable, `{14, addrA}` | Input 4 (S1, B settles itself) |
| 6 | Event lock | `catA` immutable, `F(20)` | Input 0 (W3); census by input 2 (V7) |
| 7 | `P2PKH(U)` | none | The user's signature |

Size: 7 inputs and 8 outputs. No dummy funders, no placeholders, no pre-transaction.

### 5.3 `ABBA` witnesses

View records: `DA` is record 3, `DB` is record 5 (their input indices).

| Master | `callerRef` | `originRef` | `validatorRef` | `calls` | `retval` | `views` (per segment) | `events` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| In 0, `A.f` | 6 (`P2PKH(U)`) | 6 | 2 | `[(CALL, addrB, 4, H(g \|\| 3), 20)]` | (none) | Seg 0: `DA {5,0,0,addrB} -> {6,0,0,addrB}`. Seg 1: `DA {6,1,0,addrB} -> {6,1,20,addrB}` | `[6]` |
| In 1, `A.k` | 4 | 6 | 2 | `[]` | 6 | Seg 0: `DA {6,0,0,addrB} -> {6,1,0,addrB}` | `[]` |
| In 4, `B.g` | 0 | 6 | 2 | `[(CALL, addrA, 1, H(k), 6)]` | 20 | Seg 0: `DB {10,addrA} -> {14,addrA}`. Seg 1: `DB {14,addrA} -> {14,addrA}` | `[]` |

Frame witnesses (section 4a):

| Master | `kind` | `sender` | `self` |
| --- | --- | --- | --- |
| In 0, `A.f` | `ROOT` | `P2PKH(U)` | `addrA` |
| In 1, `A.k` | `CALL` | `addrB` | `addrA` |
| In 4, `B.g` | `CALL` | `addrA` | `addrB` |

`addrA` and `addrB` are the contracts' addresses, `addrV(catA)` and `addrV(catB)`. The masters sit at `lockA` and
`lockB`, and the state at `stateA` and `stateB`. Every `value` is 0, and there are no `sends`.

### 5.4 The same convention for other shapes

| Transaction | Inputs | Validators |
| --- | --- | --- |
| `A` | `[A m1, DA] [U]` | 0 |
| `AA`: internal calls or `this.g()`, all inline | `[A m1, DA] [U]` | 0 |
| `AA` through a runtime address equal to `address(this)` | `[A m1, A m2, V_A, DA] [U]` | 1 |
| `AB` | `[A m1, V_A, DA] [B m1, DB] [U]` | 1 |
| `ABBA` | `[A m1, A m2, V_A, DA] [B m1, DB] [U]` | 1 |
| `ABCBA` (`A.f -> B.g -> C.h -> B.i -> A.j`) | `[A m1, A m2, V_A, DA] [B m1, B m2, DB] [C m1, DC] [U]` | 1 (settles A and B) |
| `A.x` and `C.y`, independent | `[A m1, DA] [C m1, DC] [U]` | 0 |
| `AB` and `CD`, independent | `[A m1, V_A, DA] [B m1, DB] [C m1, V_C, DC] [D m1, DD] [U]` | 2 |
| `A.x` and `A.y`, same contract twice | `[A m1, A m2, V_A, DA] [U]` | 1 (orders and settles A) |

---

## 6. The transcript `M`

`M` is the validator's own data: the first push of its unlocking bytecode. It holds only structure. The facts live in
the masters' witnesses, which each master proves about itself, so no fact exists in two places.

```text
M = "PC7" 0x02
    rootCount:u8     root:u8[]                    covered masters entered by users, in execution order (V4)
    masterCount:u8   master:u8[]                  covered masters (must equal the set pointing here, V3)
    settleCount:u8   (category:32, stateInputCount:u8, stateInput:u8[],
                      createdCount:u8, created:u8[])[]
                                                  contracts this validator settles (those with 2+ masters);
                                                  `created` lists the output indices of the records the
                                                  transaction creates for that contract, which is what tells a
                                                  frame's `in == out` at such an index apart from a state UTXO
```

The version byte is `0x02`: version `0x01` had no `created` list, and its `settle` entries end after the state
inputs.

`M` does not list segments. The validator derives their order from the call tree (V6), so a builder cannot choose
an order the EVM could not produce.

`M` for `ABBA`:
- roots `[0]`;
- masters `[0, 1, 4]`;
- settles `[catA: [3]]`.

The validator derives the order `(0,0), (4,0), (1,0), (4,1), (0,1)`.

`M` takes a few bytes per master, plus about 40 bytes per settled contract.

---

## 7. Checks

### 7.1 Every master (`code_X`)

**P1.** Refuse unless the spent UTXO holds a `catX` minting NFT.

**P2.** Output `OP_INPUTINDEX` recreates it: same lock, category, capability and empty commitment, and value at least
the input value.

**W0. Witness block.** The first push of this input's own unlocking bytecode (`OP_INPUTINDEX OP_INPUTBYTECODE`) is
exactly the witness block the master executed with (section 4).

**W1. Frame** (section 4a).
- `callerRef != OP_INPUTINDEX`.
- `msg.sender = sender` and `address(this) = self`, both from the witness block.
- `ROOT`:
  - `callerRef` is a P2PKH input, and `sender` equals its lock.
  - Its signature (the first push of its unlocking bytecode) must end in hash type `0x41` or `0x61` (`SIGHASH_ALL`,
    optionally with `SIGHASH_UTXOS`).
  - `ANYONECANPAY`, `NONE` and `SINGLE` signatures are refused, because they do not commit to this transaction's
    calls (T20).
- `self`:
  - for `ROOT`, `CALL`, `STATIC` and `CREATE` frames it is the `addrX` constant baked into the code;
  - for `DELEGATE` and `INTERNAL` frames it comes from the witness block and is checked by V5.
- `msg.value = value`, never negative. A body that is not payable requires it to be 0, the EVM's call-value check
  (4b): the head requires it of every frame when no body of the master is payable, and each non-payable body
  requires it otherwise (`master-head.ts` `valueChecks`, `assertZeroValue`; `GenerateTargetTraversal.ts`
  `emitFramedCallValueCheck`).
- A `ROOT` frame may carry value into a payable body: the user pays it into a satoshi container of the contract,
  and 4b's conservation rule counts it in `in(X)`, checked by the master when the frame settles alone and by the
  validator otherwise (V7). The SDK takes it as the call's `value` and refuses one for an entry that is not payable
  (`solidcash/src/framed/call/call.ts`).
- Every other value of a non-`ROOT` frame is checked by the validator (V5). The need test guarantees there is one.

**O1. Origin.**
- `originRef` is a P2PKH input that passes the same hash-type check.
- `tx.origin = OP_UTXOBYTECODE(originRef)`.
- N1 binds it when the master is standalone; V4 and V5 bind it when composed.

**W2. Execute** the function against the views:
- Storage reads and writes use the current segment's `viewIn`/`viewOut` records.
- Internal calls, and `delegatecall` to the contract's own code, run inline and keep `msg.sender`,
  `address(this)` and `tx.origin`.
- `this.g()` runs inline as a message call: `msg.sender` is `self`, and `tx.origin` is unchanged.
- `try`: the called function must succeed. No witness selects a `catch` branch (T22). Today's compiler already
  treats catch blocks as dead code (`SymbolTableTraversal.visitTryCatch`).
- Value sends follow section 4a. A send to a P2PKH lock is listed in `sends` and checked at its output. Any other
  send is a `CALL` with `calls[k].value` set.
- At external call `k`:
  - the code records `calls[k].kind` and `calls[k].target`:
    - `CALL` or `STATIC` for a message call (`STATIC` when the called function is `view` or `pure`);
    - `DELEGATE` for a `delegatecall` to other code, with `target` the address of the contract whose code runs;
    - `INTERNAL` for an internal call into another facet;
    - `CREATE` for `new`;
  - require `calls[k].calleeRef != OP_INPUTINDEX`;
  - the callee's `self` must equal `target` (V5). If the target is X itself, the callee is another master of X and
    sees `msg.sender = address(this)`;
  - require `H(selector || args) == calls[k].argsHash`;
  - the call returns `calls[k].result`;
  - close the segment: the computed records must equal its `viewOut`. A record the code wrote in the segment is
    rebuilt and compared; every other record the segment declares is one the code left, so it is declared kept:
    read and recreated in place with its view unchanged, or, for a record another frame of the same contract
    created, named at its output with its view unchanged (T43, T44);
  - the next segment reads from its own `viewIn`.
- At return: close the last segment the same way, and require the computed return value to equal `retval`.
- A failing `require` fails the input. The SDK reports the revert reason.

**W3.** Every emitted event is at its listed output: the event lock, a `catX` immutable NFT, and the encoded event as
commitment. Its commitment is the whole encoded event. On a real chain, events above 128 bytes need chunking (open
point 16); the relaxed mock raises the commitment limit.

**N1. Need test (R6).**
- If a validator is needed, `validatorRef` must point to a validator input of some category `c`:
  - it holds a mutable NFT of `c`;
  - its redeem script (the last push of its unlocking bytecode, after `M`) is `pin(c)` followed by code whose hash
    is `H_V`;
  - `H_V`, the 32-byte hash of `V_TEMPLATE`, is a constant every master carries.
  P2SH32 consensus then guarantees that its lock is `addrV(c)`. The master skips `M` and never interprets it.
- If no validator is needed, then necessarily:
  - `callerRef` is a P2PKH input, and `originRef == callerRef`;
  - the master executed no external call;
  - it is the only master of X in the transaction.

**S. Self-settlement** (only when X has exactly one master in the transaction, counted by category scan, and that
master made no `DELEGATE` or `INTERNAL` call; R4):
- **S1.** For each record:
  - the first `viewIn` equals the real input commitment;
  - every later `viewIn` equals the previous `viewOut`;
  - the last `viewOut` equals the real output commitment at the same index.
- **S2. Census of `catX` outputs:**
  - minting NFTs are recreated in place;
  - mutable NFTs appear only at state outputs, at created records and containers, and at the recreation of `catX`
    validators;
  - immutable NFTs appear only at the listed event outputs, and no two events share an output (T41);
  - **every `catX` input and output carries a fungible amount of 0, a semi-fungible NFT included.** A CashToken may
    hold an NFT and a fungible amount together, so the rule is about the amount and not about whether an NFT is
    present: an event NFT that also carries freshly minted fungible tokens of the contract's category is refused
    just as a fungible-only output is. This is what makes an own-category output's class decidable in script:
    `OP_OUTPUTTOKENCATEGORY` appends a capability byte for a mutable or minting token and nothing for any other, so
    without the rule an immutable NFT and a fungible amount of the same category are the same 32 bytes to the
    program. With the amount at zero, such a bare answer *is* an immutable NFT, and the census can require it to be
    a listed event output. The commitment decides nothing: an immutable NFT may carry an empty commitment, so
    emptiness is not what distinguishes it. The deployment mints NFTs of `catX` only (section 12: masters carry
    minting NFTs, validators mutable ones), so the rule costs the convention nothing.
- **S3.** The `catX` state UTXOs spent in the transaction are exactly the records the master touched.
- **S4. Values.**
  - Every record keeps exactly its input value. A contract pays its listed sends and the `msg.value` it passes
    from its satoshi containers (4b), and the 66 make no BCH send.
  - Listed sends are paid exactly (T39).
  - Value is conserved per contract (4b).

### 7.2 Validator (`V_TEMPLATE`)

**V1.**
- Output `OP_INPUTINDEX` recreates it: same lock, category, capability, commitment, and value at least equal.
- A master of its own category is in the transaction.

**V2.** Parse `M`, and each covered master's witness block (section 4), rejecting any encoding the master itself
would not accept (T33).

**V3. Completeness.** `M.masters` equals the set of inputs that hold a minting NFT and whose `validatorRef` is this
input.

**V4. Roots.**
- `M.roots` lists exactly the covered masters whose `kind` is `ROOT`, in execution order.
- Each root has a P2PKH `callerRef` and `originRef == callerRef`.
- Every other covered master's `callerRef` is a covered master.
- So a state UTXO or a validator at a contract's lock can never act as a caller (T19), and no caller chain lacks a
  signed user at its root (T31).

**V5. Edges**, for every covered master `c` and each of its calls `k`, where `e = calls[k].calleeRef`:
- `e` is in `M.masters`, `e.callerRef == c`, and `e.kind == calls[k].kind`;
- `e.originRef == c.originRef`;
- values: for `CALL` and `CREATE`, `e.value == calls[k].value`; for `STATIC`, both are 0; for `DELEGATE` and
  `INTERNAL`, `e.value == c.value`, since the EVM passes `msg.value` through a `delegatecall` unchanged;
- `CALL`, `STATIC`, `CREATE`: `e.sender == c.self` and `e.self == calls[k].target`;
- `DELEGATE`: `e.sender == c.sender`, `e.self == c.self`, and `addrV(e's own category) == calls[k].target`. The code
  that runs is the code the caller named (T37);
- `INTERNAL`: `e.sender == c.sender`, `e.self == c.self`, and `e`'s own category is the category of `c`'s context
  (a facet master of the same contract; T37);
- for `DELEGATE` and `INTERNAL`, `e` runs on the records of `c`'s context contract, which is settled by this
  validator (V8);
- `e.retval == calls[k].result`;
- `H(e's selector || e's argument pushes) == calls[k].argsHash`.

Conversely, every covered master that is not a root appears in exactly one caller's `calls`.

**V6. Order.** The validator derives the execution order itself; `M` does not state it.
- For each root in `M.roots` order, `visit(m)` emits:
  - segment 0 of `m`;
  - then `visit` of the callee of `m`'s call 0;
  - then segment 1 of `m`;
  - and so on, up to `m`'s last segment.
- The walk must reach every covered master exactly once. This rules out cycles and unreachable masters (T31).
- Each call's callee runs entirely between the caller's segment that made the call and the caller's next segment.
  One master's segments stay in order, and roots never interleave (T30).
- The depth bound is the machine's, not a rule. Where the validator settles a contract, the head gathers that
  contract's records in this order with a recursive visit that takes three of the machine's 100 control-stack
  entries per call level, so there a call tree deeper than about 30 levels is refused (a 31-level chain refused
  beside a 25-level one, `validator/script.test.ts`). The facet's walk is iterative, so a chain of masters whose
  contracts the validator does not settle is accepted at 40 levels (`34bf101b5`). No rule depends on depth, and the
  derivation and the reference model have no bound.

**V7. Settlement**, for each contract X in `M.settles`:
- every master of `catX` in the transaction is covered, so no other validator runs a frame on X's records;
- **inputs:** the `catX` state UTXOs spent in the transaction are exactly `M.settles`' `stateInput` list, and that list
  is exactly the set of X's records that the covered frames' views touch (T38);
- **chains:** X's records' views chain in the V6 order, across every frame that runs on X's records, from the real
  input commitments to the real output commitments at the same indices. A record is left without an output only if
  the last view deletes it, and created records follow open point 4;
- **census** as in S2. Events are those listed by every frame that runs in X's context, and no two share an output.
  The program first requires every own-category input's and output's fungible amount to be zero
  (`OP_UTXOTOKENAMOUNT` and `OP_OUTPUTTOKENAMOUNT`), and only then reads an own-category output's class from
  `OP_OUTPUTTOKENCATEGORY`: a capability byte of mutable means
  the index must be one a segment's declaration writes (or a recreated `catX` validator's), a capability byte of
  minting means recreated in place, and a bare 32-byte value is an immutable NFT under S2's exclusion of fungible
  amounts, so its index must be one a frame in X's context lists as an event;
- **values** as in S4: every record keeps at least its value, no two frames in X's context list the same send, and
  `growth(X) >= in(X) - out(X)` (4b), where `in(X)` is the value of the frames in X's context that are not
  `DELEGATE` or `INTERNAL`, and `out(X)` is the value of their call records and their listed sends.

**V8.** A contract is in `M.settles` if one of its masters is covered and it has another master anywhere in the
transaction, or if a covered `DELEGATE` or `INTERNAL` frame runs on its records. Otherwise it is not, and its single
master settles it (R4). The masters are counted over the whole transaction: a master that is not its category's only
one leaves its records to a validator, so counting only the covered ones would let a contract with one master in
each of two validators' call trees be settled by neither (T7).

**V9. Owner policy.** The first root master's category equals the validator's own category. This is not needed for
safety; it keeps pools per contract.

**V10. Static frames.** A covered `STATIC` master, and every master below it in the call tree:
- has `viewOut == viewIn` for every record in every segment;
- lists no `events`, no `sends`, and no call with a value;
- makes only `STATIC` or `DELEGATE` calls, a delegate frame below being held to these same rules (T34).

A `DELEGATE` call changes nothing by itself: its callee runs on the read-only frame's records and sits in the
subtree, so a read-only frame may reach a read-only entry through a proxy (PW10 in `archive/docs:docs/framed/HANDOFF_PARALLEL.md`). The
derivation (`checks.ts` `checkV10`), the program's read-only check and the reference model (since `34bf101b5`) all
admit it.

**V11. Addresses.**
- For a `ROOT`, `CALL`, `STATIC` or `CREATE` frame, a covered master's `self` equals `addrV(its own category)`.
- For a `DELEGATE` or `INTERNAL` frame, it equals the caller's `self`, and V5 binds the master's own category.
- So an address always belongs to exactly one category (T36), and no frame runs code its caller did not name (T37).

### 7.3 State UTXOs (data NFT, entry, chunk)

State UTXOs run `STATE_CODE` at `stateX` (section 3.3).

**D1.** A master of X is in the transaction. Rules S3 and V7/V8 then guarantee that the record is settled exactly
once.

**D2.** The record's output, unless the settlement deletes the record, keeps at least the input's value: a contract
pays its listed sends from its containers (S4, 4b), never from a record.
- The settlers enforce it: a self-settling master (S4, `selfSettlementScript`) and the validator (V7,
  `V7_RECORD_VALUE_DECREASED`).
- No covenant enforces it on every path (`packages/utils/src/state.ts`). The data-NFT covenant keeps the value
  exactly on the paths that keep the record, but its destroy path (flag 2) pins nothing, and the covenant of mapping
  nodes and chunks pins nothing on its write path (section 20, T39).

---

## 8. Walkthrough (`ABBA`)

**Input 0, A master #1, executing `A.f(3)`.**
- P1 and P2 hold.
- `kind` is `ROOT`. `callerRef` 6 is `P2PKH(U)`, its signature ends in `0x41`, and `sender` equals its lock, so
  `msg.sender = U` (W1).
- `self` is `addrA`, A's address (section 4a).
- `originRef` 6 passes the same check, so `tx.origin = U` (O1).
- It executes an external call and A has two masters, so it needs a validator: `validatorRef` 2 has lock
  `addrA = addrV(catA)` and a `catA` mutable NFT.
- Segment 0 reads `DA {5,0,0,addrB}` and writes `count = 6`, which equals its `viewOut`.
- `b.g(3)`:
  - it records `(CALL, addrB, 4, H(g || 3), 20)`; the validator checks that input 4's `self` is `addrB`, which
    equals `b`;
  - `H(g || 3)` equals `argsHash`;
  - the call returns 20.
- Segment 1 reads `{6,1,0,addrB}`, sets `last = 20`, and emits `F(20)` at output 6 (W3). The resulting
  `{6,1,20,addrB}` equals its `viewOut`.
- A has two masters, so input 0 does not self-settle.

**Input 1, A master #2, executing `A.k()`.**
- `kind` is `CALL` and `callerRef` 4 is a `catB` master, so a validator is needed (input 2).
- `sender` is `addrB`, so `msg.sender = addrB`; the validator checks it against input 4's `self` (V5).
- `self` is `addrA`, A's address.
- `originRef` is 6, so `tx.origin = U`. The validator binds it (V5).
- It reads `b = addrB`, and the `require` passes.
- It sets `hits` to 1, giving `{6,1,0,addrB}`, which equals its `viewOut`.
- It returns `count = 6`, which equals `retval`.

**Input 2, the A validator.**
- V1 holds (output 2).
- V3: the masters pointing here are inputs 0, 1 and 4, which equals `M.masters`.
- V4: `M.roots` is `[0]`. Input 0 is the only `ROOT`, `P2PKH(U)` is a P2PKH lock, and
  `0.originRef == 0.callerRef == 6`. Inputs 1 and 4 have covered masters as callers.
- V5, edge `0 -> 4` (`CALL`):
  - `4.callerRef == 0` and `4.kind == CALL`;
  - `4.sender == 0.self == addrA`, and `4.self == addrB`, the target input 0 recorded;
  - `4.originRef == 0.originRef == 6`;
  - `4.retval == 20` equals `0.calls[0].result`;
  - `H(g || 3)` matches the arguments in input 4's unlocking bytecode.
- V5, edge `4 -> 1` (`CALL`):
  - `1.callerRef == 4` and `1.kind == CALL`;
  - `1.sender == 4.self == addrB`, and `1.self == addrA`, the target input 4 recorded;
  - `1.originRef == 4.originRef == 6`;
  - `1.retval == 6` equals `4.calls[0].result`;
  - the argument hash matches.
- V6 derives `(0,0), (4,0), (1,0), (4,1), (0,1)`:
  - B's subtree sits between A.f's two segments;
  - A.k's segment sits between B.g's;
  - the walk reaches inputs 0, 4 and 1 once each.
- V7 settles A:
  - both `catA` masters are covered;
  - `DA`'s views chain `{5,0,0,addrB}` (the real input 3) -> `{6,0,0,addrB}` -> `{6,1,0,addrB}` ->
    `{6,1,20,addrB}` (the real output 3);
  - census: minting NFTs at 0 and 1, validator at 2, state at 3, event at 6.
- V8: A (two masters) is settled here; B (one master, no `DELEGATE` call) is not.
- V11: inputs 0 and 1 have `self == addrV(catA)`, and input 4 has `self == addrV(catB)`.

**Input 3, `DA` at `stateA`.** D1: a `catA` master is present. D2: its output 3 keeps its value, which input 2
checks (V7).

**Input 4, B master #1, executing `B.g(3)` with `B.h` inline.**
- `kind` is `CALL`, `callerRef` is 0, and `sender` is `addrA`, which equals `a`. The validator checks `sender` (V5).
- `self` is `addrB`, B's address, and `originRef` is 6.
- Segment 0 takes `total` 10 -> 13. Then `this.h(3)` runs inline as a message call: `msg.sender` is `self` = `addrB`,
  so `h`'s `require` passes, and `total` goes 13 -> 14.
- `a.k()`:
  - it records `(CALL, addrA, 1, H(k), 6)`; the validator checks input 1's `self` against `addrA`;
  - the argument hash matches;
  - the call returns 6.
- Segment 0's `viewOut` is `{14, addrA}`.
- Segment 1 reads `total = 14` and returns `6 + 14 = 20`, which equals `retval`.
- B has one master, so S applies:
  - `DB` chains `{10, addrA}` (the real input 5) -> `{14, addrA}` -> `{14, addrA}` (the real output 5);
  - the `catB` census is clean.

**Input 5, `DB` at `stateB`.** D1: a `catB` master is present. D2: its output 5 keeps its value, which input 4
checks (S4).

**Input 6.** The user's P2PKH signature uses `SIGHASH_ALL`, so it covers all inputs and outputs. Input 0 checked
that (W1).

---

## 9. Security

**The central rule:** a token or position proves which slot something is, never what it says. Every fact is checked
by the code that produces it, by the validator program, or against real state.

| # | Attack | Stopped by | Critical |
| --- | --- | --- | --- |
| T1 | Execute on a non-master UTXO (loose BCH at `lockX`, or a foreign minting NFT placed there) | P1 | Yes |
| T2 | Forge `msg.sender` with no validator | N1: without a validator, `callerRef` must be a signed P2PKH input | Yes |
| T3 | Forge `msg.sender` or a call edge when a validator is present | V5, in both directions | Yes |
| T4 | Leave out a validator that is needed | N1 need test | Yes |
| T5 | Fake validator | N1 recognizer: a mutable NFT of its own category, and a redeem script of `pin(c)` plus code hashing to `H_V` | Yes |
| T6 | A master points to a validator that does not list it (its witnesses go unchecked) | V3 completeness | Yes |
| T7 | Split view across validators, including one master of a contract in each of two validators' call trees | V3, V5, V7 (every master of a settled contract is covered) and V8 (masters counted over the transaction): every edge and every multi-master contract sits inside one validator | Yes |
| T8 | Forged arguments, selector or result | V5, with W2: the caller hashes what it computed, and the callee proves `retval` | Yes |
| T9 | Reordered segments, stale reads | V6, plus view chaining in V7 / S1 | Yes |
| T10 | Claim self-settlement while another master of the contract exists | S applies only when a category scan finds one master; N1 | Yes |
| T11 | Partial settlement of a multi-master contract | V7, V8 | Yes |
| T12 | Spend a state UTXO outside settlement | S3, V7 (inputs), D1 | Yes |
| T13 | Forged or missing events | W3, census | Yes |
| T14 | Drain or duplicate masters or validators | P2, V1, census | Yes |
| T15 | Identity by commitment (event and return NFTs have caller-influenced commitments and can be relocated) | R8: never by commitment | Yes |
| T16 | Witnesses or `M` changed after the user signed (a signature never covers other inputs' unlocking bytecode) | The user's signature is `SIGHASH_ALL` (W1), so the outputs are fixed, and any version that passes every check yields the same outputs | No |
| T17 | Griefing or contention on master and validator pools | Liveness only; pool sizing (section 12) | Residual |
| T18 | Pose as the contract itself (`msg.sender == address(this)`) from a second master of the same contract that made no such call | V5 closed edges; N1 (a caller that is a master always needs a validator); W1 and W2 (no self-reference) | Yes |
| T19 | Pose as a contract through one of its other inputs (a state UTXO at `stateX`, or a validator) | V4 (a caller that is not a covered master must be P2PKH); N1 (a standalone caller is P2PKH) | Yes |
| T20 | Reuse a user's input signed with `ANYONECANPAY`, `NONE` or `SINGLE` (for example a published swap offer) in a transaction the user never saw, to act as that user | W1 and O1: the hash type must be `SIGHASH_ALL` | Yes |
| T21 | Forge `tx.origin` by pointing `originRef` at another signed user in the same transaction (for example a seller co-signing an unrelated call) | N1 and V4 (`originRef == callerRef` at the root); V5 (unchanged along every edge) | Yes |
| T22 | Take the `catch` branch of `try this.g()` or `try b.g()` without the call reverting | No witness selects a branch; the called function must succeed (W2) | Yes |
| T23 | `this.g()` acting for the caller instead of the contract: `this.transfer` or `this.approve` moves or approves the user's balance, and caller-gated functions become reachable through public wrappers | R3 (Solidity semantics); one hostile test per direction | Yes |
| T24 | `msg.sender` or `tx.origin` taken from input position, so a funder or another user is picked (today's direct-call rule: the first P2PKH input without tokens) | W1 and O1: always by reference, per execution | Yes |
| T25 | The same call gets a different `msg.sender` depending on whether it ran inline or on another master | R3: both give `address(this)`; W1 is the only source of a non-inline `msg.sender` | Yes |
| T26 | A caller behind a proxy, in a split contract, or after an upgrade shows its code lock instead of its address; proxies over one implementation share an identity | Section 4a: `self` proofs; V5 (`e.sender == c.self`) | Yes |
| T27 | A proxied call runs code other than the proxy's current implementation | The proxy's own master reads the implementation from its settled state and names it as the `DELEGATE` target; V5 binds the callee to it | Yes |
| T28 | A `DELEGATE` or `INTERNAL` frame claims a sender or self that its caller does not have | V5 | Yes |
| T29 | A constructor frame claims a creator that did not run `new` | V5 (`CREATE` edge) | Yes |
| T30 | An execution order the EVM cannot produce: a callee running away from its call, one master's segments out of order, roots interleaved (reentrancy windows with a trusted callee) | V6: the order is derived depth first from the call tree | Yes |
| T31 | Caller cycles with no user root, so `tx.origin` is arbitrary | V4 and V6: a forest rooted at signed users, every master visited once | Yes |
| T32 | Calls attributed to a signed user that the user never saw (one signature authorizing any number of calls) | Not stopped (plan D8): a residual. The outputs are signed, so the effects are fixed; wallets must decode the witnesses. Options in section 14.1; owner and revisit trigger in plan D8 | Residual |
| T33 | Master and validator decode the witnesses differently, so each approves a different graph | Section 4: one canonical witness block, decoded as the VM decodes pushes | Yes |
| T34 | A `STATIC` callee changes state, emits, sends value or creates | V10 | Yes |
| T35 | A payment to a contract made without the recipient's master: no satoshi container is minted and `receive()` is skipped | Section 4a (value sends); W2 | Yes |
| T36 | An address bound to more than one contract (for example an anchor anyone can create at a logical address), so a call or a `msg.sender` check reaches the wrong contract | R8: `addrX = addrV(catX)` hashes the category into the address; V11 | Yes |
| T37 | Substitute the callee of a `DELEGATE` or `INTERNAL` call with a master of other code, which then writes the caller's state with the caller's identity | V5: a `DELEGATE` callee's category matches the named target, and an `INTERNAL` callee is a master of the same contract; V11 | Yes |
| T38 | Consume or delete a state UTXO that no frame touched (for example another user's mapping entry) in a validator-settled contract | V7 (inputs): spent state UTXOs are exactly the touched records | Yes |
| T39 | Drain the value of a record, master or validator while keeping its commitment | P2, V1, S4, D2 | Yes |
| T40 | A callee claims a `msg.value` its caller did not send | V5 (`e.value == calls[k].value`); value accounting (open point 10) | Yes |
| T42 | Mint a state UTXO no write made, by declaring it as a created record of a frame that does write (a forged mapping node beside a sorted batch) | W: a frame declares exactly the records its code wrote (the batch walk counts them); census | Yes |
| T43 | Show a callee a view no write made, by declaring a mapping node changed in a segment its frame does not write it in (changed and back between two calls, or created before the write) | W2: the segment close (T44) requires a batch's nodes kept outside the segment they are written in | Yes |
| T44 | Rewrite any record of a contract through any of its entries, by declaring it changed in a segment the frame's code does not write it in (its data record, another key's mapping node, or a guard written before and after a call shown unset between) | W2: at every segment close a frame rebuilds and compares the records its code wrote there and requires every other record it declares kept | Yes |
| T45 | Pass a mapping node of one collection off as another's: collections keyed alike (two mappings by address, a struct's sibling mapping fields) hold nodes of the same slot and commitment shape, so an entry that writes one could rewrite, move or read the other's node | W2: a frame holds every mapping node it reads or writes to its collection's covenant, at the output the node lands at and at a record of the category spent at its coordinate | Yes |
| T46 | Pass a plain UTXO, a mapping node or a chunk of the contract's category off as its data record: the master reads the record's fields from the record its segment declares and settlement ties them to the commitments at the coordinate, but a commitment names no lock, so a same-category mutable UTXO at any lock that merely preserves itself would stand in | W2: a non-delegate frame holds a data record's input and output to `buildDataNftCovenantScript(ownerCategory)` (`emitDataNftLbc`), as it does for a mapping node (T45); its token category is still preserved in place. A delegate (proxy) frame's data-record lock is the proxy/composer lane's | Yes |
| T47 | Name a mapping write target at its output alone, with a start view no input carries, on a frame that settles alone, so a forged value is read and a second node for the key is written | W2: a proof record is named by the input it spends, or by its output only when an earlier frame created it, which needs a validator settling the contract beside another master; a created predecessor sits at its collection's covenant with a non-zero slot, so a created head stays refused | Yes |
| T49 | Pass a commitment-bearing mutable pair at the contract's address off as its validator's token in a self-settling master's census | S2: beside a self-settling master the census admits only its category's validator token, recreated in place with the empty commitment it is deployed with | Yes |
| T50 | Rewrite a mapping node that a conditional sorted write co-spends, in a run that does not take the write's arm: the frame declares the node for the write the arm would make, and nothing bound its output (VM-proven in the direct and framed conventions) | W2: a conditional write does not authorize an unreached output mutation (DECISIONS D15). When the arm does not run, the master requires each node it would write to be recreated with the commitment it was spent with: per one-slot target (`bc67e44ca`) and per multi-slot batch in one arm (`b87bba777`) | Yes |
| T51 | Forge a log at a proxy: an immutable NFT of the proxy's category at an output no frame lists, beside a forwarding entry that emits nothing | S2 and V7, and the master's own-category event pin. DECISIONS D16 ports the kernel's drop of that pin in a delegatecall function with no local emit (`71bee8228`) to the direct convention (`65a67fed5`), keeping it where no delegate co-spend is forced, where a runtime loop emits, and on a framed master | Yes |
| T52 | Declare a mapping entry at a coordinate that names no input (u16 0x8001, read as -1) with a forged view, so a read-only entry check passes with no entry spent | W2: an entry is read as absent only at the created-record sentinel 0xffff (`8dedaf280`); any other coordinate is read at the input it names, so one naming none fails. Was open since `4a0a9ce76` (VM-proven) | Yes |
| T53 | Mint a contract's minting NFT at an output its index does not recreate (an extra master at the master lock, or one at a caller's own lock), so its holder forges the contract's masters and records | R2b and S2: every master's head requires each index's output to carry the category's minting NFT exactly when its input does (`27bc49b12`); only the admin's `split(n)`/`merge(n)` arm changes N. Was open (VM-proven, standalone and composed) | Yes |
| T54 | Run a contract's constructor again on a live master: an owner rewritten, a supply minted twice | The constructor arm requires input 0 to spend `(category, 0)`, which only the genesis spends (`08d0bba27`, DECISIONS D18). Was open (VM-proven: an owner taken over; a supply minted from 1000 to 2000) | Yes |
| T55 | Declare a record at an index the transaction does not have (a paged read's later turn at 0x8001), so a body reads a value no input carries | W2: the head's record walk requires the larger of an entry's two indices to name an input or an output (`52fe8aa95`). Was open (VM-proven) | Yes |
| T56 | Mint immutable NFTs (forged events) or fungible amounts of a contract's category from a master that settles alone | S2 on the master path (`cd55e7a72`): the settlement walk holds the category's bare outputs to the events the frame lists, and the head's census refuses a fungible amount of the category at every index. Was open (VM-proven) | Yes |
| T57 | Rewrite a record of a contract whose code has a `DELEGATE` site but whose frame made no delegate call (a sibling entry beside a dispatched forwarding fallback), so neither its master nor the validator settles it | S runs when the frame records no `DELEGATE` or `INTERNAL` call (`2d517da79`); V8 settles a delegate frame's records. Was open (VM-proven: a proxy record's `implementation` rewritten beside `touch`) | Yes |
| T41 | Two frames claim the same event output, so one of two events disappears | S2 and V7: event outputs are pairwise distinct | Medium |
| G0 | A `DELEGATE` frame's own category is settled by nobody. Its master runs on its caller's records and never settles its own (S), and V8 settles a contract only for a second master of it or for a `DELEGATE` or `INTERNAL` frame on its records. So when the frame's master is its contract's only one, nothing settles that contract: no census of its category, and no check on the records of it the transaction spends | Not stopped: a documented residual (DECISIONS D9), as the kernel's conservation rule (C3) skips delegate frames | Residual |

**Residual risks:**
- **The validator program is the single security core.** Which validator covers a composition does not matter,
  because all run the same code. The code itself must be small, audited, covered by one hostile test per V-check,
  and checked against an independent reference model by differential tests (plan B14).
  - **A defect in it is permanent.** Every address hashes `V_TEMPLATE` (D9), so a v1 defect stays with every v1
    contract. Proxies do not help: a proxy's own address and settlement use `V_TEMPLATE` too, so an upgrade replaces
    the implementation, not the validator.
  - So the freeze binds only from the first real-chain deployment, after an external audit (open point 13).
- **Canonical encodings.** `argsHash`, `result`/`retval` and views must be byte-identical on both sides. The codebase
  has already hit ABI encoding mismatches of this kind.
- **Proxies and logical identity** (sections 4a and 11) have to be proven in this model. Today's anchors are not a
  valid basis (audit F9).
- **The witness ABI is a versioned contract between compilers and the validator.** A master must never rely on a
  witness the validator does not check.
- **Signature scope (T32, D8).** A wallet signing a transaction it did not build must decode every master's
  witnesses to show the user the calls made in their name.
- **A delegate frame's own category (G0, DECISIONS D9).** A transaction that delegates into a contract's code
  settles that contract nowhere when the delegate frame's master is its only one there. Behind a proxy that
  contract is the implementation, whose own records hold its genesis state, not the application's (section 19).
- **EVM hazards are reproduced, not fixed.**
  - A runtime self-call with a caller-chosen target and calldata acts with the contract's own authority.
  - `tx.origin` checks can be phished: a contract the user calls can reach a `tx.origin`-gated function in the
    user's name. Unicrow relies on such checks.
  - Both behave exactly as in the EVM.
- **Multi-user transactions.** Every co-signer fixes the outputs, but not the other inputs' witnesses. A co-signer
  must check all outputs, not only the effects of its own calls.

---

## 10. Return values and SDK derivation

**On chain.** Nothing is passed between inputs at runtime; every input is validated independently against the
finished transaction.
- The callee proves its return value by requiring the computed value to equal its `retval` witness.
- The caller consumes its own `calls[k].result` witness.
- The validator checks the two are equal (V5).
- Self-calls return on the stack after `OP_INVOKE`.

**Off chain.** The SDK derives values depth-first, by running the actual scripts in the VM:
1. Keep each contract's logical state in execution order, loaded from chain on first touch.
2. Run the root master's function against draft witnesses, each record the frame declares (section 20) starting
   from its current logical commitment. Each run stops at a designated site the artifact publishes (section 18):
   - **an external call:** read the target, selector and arguments from the VM stack, then derive the callee fully
     first on a master of the callee's contract;
   - **a segment close:** copy the computed records into `viewOut`, and update the logical state.

   No read site is published: the declared records already carry what a read needs. A value call into a contract
   is no published site either: it returns nothing, so the plain call path derives the recipient's body as a frame
   of its own before the root, and a later frame on the recipient's records starts from the views that body left
   (section 4b).
3. When the callee returns, copy its `retval` into the caller's `calls[k].result`, then run the caller again. Each run
   gets strictly further, so the number of runs is bounded by the sites, calls + segments (twice that as shipped,
   section 18). There is no transaction-wide fixpoint. A run that gets no further is refused, not retried.
4. Pick masters and validators from the pools, lay out the blocks (section 5), fill the frame witnesses (`kind`,
   `sender`, `self`), `callerRef`, `originRef`, `validatorRef`, `calleeRef` and the event indices, and
   write `M` (roots and masters).
5. Sign, run the VM on every input, broadcast.

A failing `require` that is not at a designated site is a real revert; the SDK reports its source message for
`revertedWith`.

---

## 11. What the marketplace additionally needs

- **Proxies** (MarketplaceV1 and MarketplaceData, via `upgrades.deployProxy`). As in the EVM:
  - A call to the proxy enters a master of the proxy, as a `ROOT` or `CALL` frame.
  - Its fallback reads the stored implementation from the proxy's records, then delegatecalls it. That is a
    `DELEGATE` frame on a master of the implementation contract, running on the proxy's records with the proxy's
    `sender` and `self`.
  - The proxy's master being present satisfies D1 for the proxy's state, and its minting NFT lets the proxy's new
    records and events be created. The proxy is validator-settled (V8).
  - V5 binds the implementation master to the target the fallback read (T27).
  - Contracts the implementation calls see the proxy's address, and so does `msg.sender` inside the implementation's
    `this.g()`.
  - Cost: one more master per proxied entry. Running the implementation directly on the proxy's masters is a
    documented option (section 14.1).
  - Initialization must be atomic with the proxy's creation, as OpenZeppelin does it. Today it is a separate
    permissionless transaction that anyone can front-run (audit F11).
  - Open point 5.
- **Code splitting.** An entry runs on a master of the facet containing the called function, and the contract is
  validator-settled. Every facet presents the contract's one address. An internal call into another facet is an
  `INTERNAL` frame, which keeps `msg.sender` (section 4a).
- **Mapping entries.**
  - An entry record is a whole entry-NFT commitment.
  - An insert is a created record (a trailing output). A `delete` consumes nothing: it writes the value type's
    default, as any other write would, and the node stays in the list (section 20). A frame that declares the node
    removed is refused (`solidc/test/framed/master/mapping-delete-write.test.ts`).
  - A sorted-list update also touches the predecessor entry's record.
  - Settlement binds records to real inputs and outputs. The executing code handles keys and predecessor logic.
- **Value chunks and dynamic `bytes`/`string`/arrays:** chunk records, handled the same way.
- **Transfers.**
  - A BCH transfer to a user is an effect, like an event: the executing master lists it and checks the output. The
    settler checks that listed sends are paid exactly and that the contract's containers pay them, every record
    keeping its value (S4, 4b).
  - A transfer to a contract is a `CALL` into its `receive()` or `fallback()` (section 4a).
  - Unicrow sends value with `call{value: ...}` (`Unicrow.sol:262`, `:370`).
  - The marketplace's FakeToken is a mapping-based ERC-20, so its transfers are record writes.
- **View calls:** one `STATIC` master each, since the result must come from the callee's code over the callee's
  state. It must leave that state unchanged (V10).
- **Expected size.** Today `approveResult` needs about 527 inputs. Here it would be:
  - about 20 executing masters;
  - the touched state, entry and chunk UTXOs;
  - one validator;
  - the funder.

---

## 12. Pools, creation and bytecode limits

**Pools.**

| Pool | Created | Resized | Bound | Contention |
| --- | --- | --- | --- | --- |
| Masters | At deployment, with a config default (12) | `split` / `merge` | A transaction can enter X at most N_X times; more is refused before building (section 21) | Transactions contend for them |
| Validators | At deployment, for every contract, with a config default (4) | `split` / `merge` | One validator of the first root's category can cover every root in the transaction (V4, V9); it is recreated in place, so the only refusal is a first root whose category has none (section 21) | Transactions contend for them |

The harness creates both pools at deployment. The marketplace test cannot change, so the pool sizes come from
defaults.

**Bytecode limits.** These only bind on a real chain; the relaxed mock allows 10 MB per input.

| Limit (real BCH) | Masters | Validator |
| --- | --- | --- |
| 10,000 B per unlocking bytecode and per script (consensus: `maximumBytecodeLength`, a.k.a. `MAX_SCRIPT_SIZE`; also the 2026 relay limit) | Arguments + witnesses + code. Witnesses are about 0.1-2 KB; views are at most 128 B per record per segment | `M` (a few bytes per master and segment) + the fixed `V_TEMPLATE`, whose checks are split across facet inputs (section 24) |
| 10,000 B stack item | Views are at most 128 B | Reads each covered master's unlocking bytecode. On a real chain that is at most 10,000 B, so a master must fit its code into 10,000 B through code splitting (open point 11). The mock lifts both limits |
| Op-cost budget, (41 + unlocking length) x 800 | Its own execution | Reads and hashes every covered master's witnesses. Each part carries 1,024 B of padding; large compositions need more padding or more parts (open point 7, section 24) |
| 100,000 B transaction, relay policy (consensus: 1,000,000 B) | Every executing master carries its code, once per entry. Code splitting bounds each master, not their sum (below) | Negligible |

**Measured (2026-09-26).** The reference `ABBA` composition sits just under its density budget before any program
runs: the machine refuses it with the first ~150-instruction `V_TEMPLATE` and a trivial program in its place
completes. The program's own cost is therefore what tips a composition over, and the two mitigations are the ones the
table names: a smaller program, or unlocking padding to buy budget. The focused validator suite runs the relaxed
cost profile for this reason, and the program's fit inside the published 800-per-byte budget was then open.

**Measured at `93822cd78`.** The validator now spans a head and a facet, each carrying 1,024 B of padding (section
24). Under the chain's own profile (10,000 B per input, 800 units per byte) every input of the reference
caller/callee composition is accepted: the head's unlocking bytecode is 8,231 B and spends 17% of its budget, the
facet's 5,660 B and 51% (`validator/consensus-limits.test.ts`). Wider compositions still overrun the facet's budget
(section 24), so the focused suites keep the relaxed profile.

**Size on a real chain** (review and follow-up, 2026-09-25). Two layers, both pinned in libauth:
- **Per input: consensus.** The VM rejects unlocking bytecode over `maximumBytecodeLength` = 10,000 B before
  evaluating it (`bch-2023-instruction-set.js:48`); the 2026 relay limit is the same number (`:523`). A master's code
  and witnesses must fit, so code splitting is required, not optional (open point 11).
- **Per transaction: relay policy.** `maximumStandardTransactionSize` is 100,000 B; the consensus limit,
  `maximumTransactionLengthBytes`, is 1,000,000 B.
  - Every entry is its own master and carries its code, so a transaction carries one code copy per entry. Code
    splitting caps each master; it does not reduce the number of copies.
  - `arbitrate` has about 24 masters. At 5 KB each (4 KB of code, 1 KB of witnesses) that is 120 KB; at the 10,000 B
    cap it is 240 KB. The validator (with density padding, open point 7), state inputs and outputs come on top.
  - So the largest titles would be non-standard (not relayed by default) but consensus-valid: a relay and
    submission question, not a validity wall.
- **Mitigations for the transaction layer, ranked** (revision 11):
  1. **Load the code instead of carrying it.** The master lock becomes a small loader, `P2SH32(loader_X)`. The loader
     reads the code from one input of the transaction (`OP_INPUTBYTECODE`), checks its hash against a constant, and
     runs it (`OP_DEFINE`, `OP_INVOKE`). This is the only mitigation that removes the duplication.
     - **Budget.** libauth charges 100 per instruction, 192 per hash digest iteration, 26,000 per signature check,
       and 1 per pushed byte, against `(41 + L) x 800` for unlocking length `L`. So each unlocking byte funds at most
       8 instructions. A master carrying 0.1-2 KB of witnesses affords about 1,100-16,000 instructions before any
       padding, and the 10,000 B input cap about 80,000. Hashing-heavy or signature-heavy frames need padding.
     - **Loading** a 10 KB copy (push, split, hash) costs about 50,000, which is about 60 bytes of budget.
     - **What remains** is one copy per distinct code, not per entry. `arbitrate` runs 24 masters over 8 distinct
       codes, or 7 if the two proxies share one (which needs `addrX` in the loader rather than baked into the code,
       plan C11). The code term shrinks about 3x, not 8x; witnesses and padding do not shrink, so the total improves
       about 2x.
     - **Worked totals** (fourth review). At 4 KB of code and 1 KB of witnesses per master, 24 x 5 KB = 120 KB
       becomes about 8 x 5 KB + 16 x 1.5 KB = 64 KB. At the 10,000 B cap, 240 KB becomes about 100-125 KB, depending
       on the padding the larger code needs. So the result lands on either side of the 100,000 B line, and only A9
       can settle it.
     - **Limits.** `OP_DEFINE` allows 1,000 memory slots and 7-byte function identifiers. A copy is one push, so a
       facet is at most 10,000 B.
     - **Compatible with the frozen `V_TEMPLATE`.** The validator identifies masters by category and minting
       capability, never by lock (V1, V3, V7), and the census keeps every minting NFT at its master lock. Plan B15
       keeps it that way, so this stays open after the freeze.
  2. **Smaller facets.** Each copy shrinks, but the sum still grows with the copies, so the gain is linear at best.
  3. **Direct submission to miners.** Valid up to 1,000,000 B, at the cost of an operational dependency.
  4. **Fewer entries per transaction.** Splitting a composition across transactions gives up atomicity, which is
     the premise of this design.
- The mock allows 10 MB per input, which makes the 66 a mock result (plan D3). Plan item A9 replaces these
  assumptions with measured sizes, starting with the loader.

---

## 13. Open points

**Status for the 66** (Part II):
- Resolved by Part II: open points 1, 2, 3, 5 and 6 (sections 16-19 and 21), and 4 (section 20).
- Outside the 66 (real chain, or features the tests do not use): 7, 8, 10 beyond preservation, 11, 14 and 16. Open
  point 7's size half is resolved by design (section 24): a head and one facet are built, and a wider split is
  Phase R's.
- Decided: 12, 13 and 15.

1. **The witness block's byte layout** (section 4): field order, length prefixes and versioning. Masters and the
   validator must decode it identically (T33).
2. **Canonical byte encodings** for `argsHash` (selector plus argument pushes), `result`/`retval`, and records.
3. **The SDK's designated stop sites and derivation loop** (section 10).
4. **Records for entries, predecessors, chunks, and created and deleted UTXOs.**
5. **Proxies and facets:**
   - the proxy's fallback encoding and the storage slot of the implementation (EIP-1967 layout);
   - `initialize` through the proxy in the same transaction as its creation (audit F11). Not needed for the 66, which
     have no front-runner;
   - the facet routing table.
6. **Pool sizes and defaults** for masters and validators, and how deployment and the harness set them.
7. **Validator program size, op-cost density, and padding.** Size: the validator spans several inputs (section 24).
   Density: each of those inputs funds its own checks and carries its own padding, measured in plan A9.
8. **User callers other than P2PKH**, such as P2SH wallets, for standalone mode.
9. **`msg.sender` inside `this.g()` in today's compiler.** Measured on `ea7a48e27`: it keeps the caller.
   - `AstBuilder.ts:7323` warns: "msg.sender is not re-set to self".
   - The invoked target receives the caller's sender as hidden context (`GenerateTargetTraversal.ts:11661-11680`).
   - Probe: `require(this.who() == msg.sender)` passes and `require(this.who() == address(this))` fails. Solidity
     gives the opposite.
   - The framed codegen must pass the own lock instead (plan D7, stream C item C8).
   - Found on the way:
     - a public function that reads `msg.sender` and writes state fails `OP_VERIFY` when it is called internally,
       through `this.f()` or `f()`, although each half works alone;
     - a `this.f()` whose callee writes a mapping is refused at compile time (`InvalidParameterTypeError`).
   - So the account mix-up of T23 fails closed today. Fixing either gap while keeping today's semantics would make it
     live.
10. **BCH value accounting** across masters and state UTXOs. **Resolved by section 4b**, which the text below
    motivated. Preservation is in force (P2, V1, S4, D2). Payable
    calls, satoshi containers and conservation across sends are not specified; the 66 do not use them.
    - **The principle to prove** when they are: value leaves a contract's UTXOs only as a listed send or as
      `msg.value` passed to a callee, and enters only as `msg.value` it receives or as the funding of outputs it
      creates.
    - Preservation (P2, V1, S4, D2) proves less: it is a floor. No kept UTXO loses value except through a listed
      send, but nothing bounds the value of created outputs or `msg.value`.
    - That floor is all the 66 need: they move no BCH between parties. Every satoshi that moves is the funder's
      (fees, and the dust of created outputs).
11. **Script size:** every executing master carries the full contract code (90-200 KB for the marketplace), so it is
    mock only. The real-chain path is code splitting.
12. **Hash-type parsing (W1).** P2PKH unlocking bytecode is `<sig> <pubkey>`, and the hash type is the last byte of
    the signature push for both Schnorr (65 B) and ECDSA (up to 73 B). Callers other than P2PKH follow open
    point 8.
13. **Addresses** (decided, plan D9): `addrX = addrV(catX)`, the address of X's transcript contract.
    - The transcript carries the category pin like every other contract, and it shares the masters' category. No
      new category is involved.
    - Masters carry `addrX` baked in at deployment (section 4a).
    - **Address stability** (decided, plan D9). `addrV(cat)` hashes the whole of `V_TEMPLATE`.
      - Version 1 freezes `V_TEMPLATE`: no validator program changes.
      - Upgradeable logic lives behind proxies, whose address never changes, and non-proxy contracts are immutable in
        Solidity too.
      - A later version would need its own addresses, or an address derived from a tiny frozen script that carries
        the same pin. This is recorded, not planned.
      - **When the freeze binds** (review, 2026-09-25). From the first real-chain deployment (plan D3), after an
        external audit (plan 4.7). Until then a change to `V_TEMPLATE` changes every address in the tests, and
        nothing else.
      - **What the freeze costs.** A v1 defect is permanent for v1 contracts, proxies included (section 9). The
        review recommends deciding on the frozen-dispatcher address form before the freeze binds (plan D9 note).
      - **Precondition.** No real-chain deployment before the address form is decided and the external audit covers
        that form. With a dispatcher, the audit covers two programs: the dispatcher and the versioned validators.
        The validator-enforced receipts (section 14.1) are the other decision that has to come before the freeze.
      - **Decided** (plan D9, 2026-09-25): `addrV(cat)` is final for v1, with no dispatcher, settled before A8 as
        the follow-up review asked. `V_TEMPLATE`'s content can still change until the freeze binds; each change only
        moves test addresses, so the validator-enforced receipts stay possible until then.
    - **Predicting an address before deployment** (SDK side, decided).
      - **The need.** The Unicrow fixture calls `getCreateAddress({from, nonce})` for four contracts before any of
        them exists (`marketplace.test.ts:52-81`), and passes the results into their constructors.
      - **The constraint.** A category is the txid of the genesis-eligible UTXO its deployment spends (an output at
        index 0). So a predicted address needs that UTXO to exist when the address is predicted. This is true of
        today's pinned master locks as well. Today the SDK avoids it with deployer-and-nonce addresses bound by
        anchors, which are forgeable (audit F9).
      - **SDK behaviour.**
        - The SDK looks ahead: it keeps at least as many genesis-eligible UTXOs reserved per deployer as addresses
          can be predicted ahead. For example, it tops the pool up when `getNonce()` is called.
        - The `getCreateAddress` shim maps nonce `n + i` to the `i`-th reserved UTXO, whose txid is that
          deployment's category and gives its `addrV`.
        - The deployment for nonce `n + i` must then spend exactly that UTXO.
      - **User responsibility.** Outside the SDK's look-ahead, preparing genesis-eligible UTXOs is the user's job.
        - This is documented for users (plan Track S).
        - When a prediction finds too few reserved UTXOs, the SDK error points users at that documentation.
      - No protocol change.
14. **`CREATE` inside a composed transaction:** how a genesis runs as a `CREATE` frame. The child's address is
    `addrV` of its new category.
15. **Signature scope** (R10, plan D8): no receipts for now. Revisit if transactions are assembled by third
    parties (relayers, batchers) or wallets cannot decode the witnesses (section 14.1).
16. **Events above 128 bytes on a real chain.** One output per event works only while the provider's commitment limit
    allows it. The relaxed mock allows 10 MB, and `JobEvent` payloads exceed 128 bytes.

---

## 14. Considered and excluded

| Alternative | Why not |
| --- | --- |
| Transcript at absolute transaction input 0 | A block layout keeps index 0 for masters; the validator follows the owner's master ladder |
| Transcript carried by the root master | It makes one master special |
| Per-execution records in spending arguments | The notation would change between `A` and `AB`. Replaced by per-function witnesses, whose shape is fixed by the code |
| Transcript decoding inside masters | Contract code would depend on the call shape. Moved into validators |
| Per-user transcript UTXOs | Replaced by per-contract validator pools |
| "More than one master in the transaction requires exactly one validator" | It blocks independent contracts and compositions in one transaction. Replaced by the local need test plus several validators |
| Transcript in an `OP_RETURN` output | `OP_RETURN` stays data-free (Track P), and relay caps it at 223 bytes |
| Separate slot and settle scripts, just-in-time funding transactions, dust-capped extra UTXOs | Replaced by master pools |
| One master per call (revision 3) | Self-calls run inline; masters are needed only per entry from another input |
| `this.g()` keeps the caller's `msg.sender` (today's compiler) | Not Solidity. The contract's own transfers and approvals land on the user's account, and caller-gated functions open up through public wrappers (T23). A self-call that cannot run inline would also need a sender-passthrough witness checked by the validator, a new forgeable fact. Plan D7 |
| `msg.sender` / `tx.origin` found by scanning for the first P2PKH input (today's compiler) | Picks the funder or another user (T24). Replaced by `callerRef` / `originRef` |
| `msg.sender` = the lock of the caller's input (revision 6) | Wrong behind proxies and in split contracts, and it changes on upgrade (T26). Replaced by frames (section 4a) |
| `M` states the segment order (revision 6) | It admits orders no EVM execution produces (T30, T31). The validator now derives the order |
| A contract caller identified by a co-spent minting NFT of a builder-named category (today's compiler) | Presence is not a call (audit F1, VM-demonstrated). Replaced by call edges (V5) |
| Logical addresses bound by anchors that anyone can create at the address (today's compiler) | A fake contract can take over the address (audit F9, T36) |
| A new identity template, `P2SH32(push(cat) \|\| ID_TEMPLATE)` | The transcript's pinned script already gives one category-derived address per contract (D9) |
| Deployer-and-nonce addresses with deployer-signed anchors | A deployer could bind a second contract to their own address (D9) |

### 14.1 Documented options, not adopted

**Call receipts** (plan D8: no receipts for now). These would close T32.
- **What.** Every call made by a user (a `ROOT` frame) gets a receipt output:
  - an immutable NFT of the executing master's category, at the event lock;
  - with commitment `"R" || self || selector || H(args) || lock(callerRef)` (at most 97 bytes).
- **Checks.**
  - The master would require its receipt at a `receiptRef` witness.
  - The census would reject any immutable NFT that is neither a listed event nor a claimed receipt.
  - V4 would require a receipt for every root.
- **Effect.** The user's signature covers every output, so it would cover exactly the calls made in the user's name,
  and a wallet could list them from the outputs alone. This matches the EVM, where a signature authorizes one call
  whose target and calldata the wallet shows.
- **Cost.** One token output per user-rooted call. Each test transaction in the 66 makes one user call, so one
  output per transaction.
- **Keeping `V_TEMPLATE` v1** (D9). The checks above change the census and V4, so they need a new validator version,
  and with it new addresses. A variant that keeps v1:
  - the receipt is an event that the root master lists in its `events` and checks itself (W3);
  - the census already accepts listed events (S2, V7), so the validator does not change;
  - the protection then holds for every contract compiled with receipts, rather than for every contract.
- **Which form a threat needs** (review follow-up, 2026-09-25):
  - **An untrusted assembler** (relayer, batcher) against honest contracts: the event form suffices. It binds the
    user's calls on every contract that checks receipts, and can be added later per contract (for a proxied
    contract, through an implementation upgrade).
  - **Hostile code in the call graph**, when every call in the user's name must be attributable: only the
    validator-enforced form works, because the event form is checked by the root contract's own code, which hostile
    code skips.
    - It binds every root of a validated group (V4). A root escapes only if its whole call tree runs without a
      validator: a standalone master with no external call, or code that skips its own need test and calls only
      code that does too.
    - Any call that reaches an honest contract brings a validator, because the honest callee's own need test
      demands one (N1), and V4 and V5 then cover its callers up to the signed root. So an unbound root touches no
      honest contract's records, and the signed outputs fix its effects.
    - What stays open even then: a hostile-only graph can claim the user's identity on its own records, and the user
      signs those outputs without seeing the calls behind them. Wallets must decode the witnesses (T32).
    - It lives inside `V_TEMPLATE`, so its deadline is the freeze, whether or not hostile code ever appears: if
      attribution will ever be required, it must land before the first real-chain deployment (open point 13).
      Within this goal (mock only, plan D3) that deadline does not come due.
  - **For the 66** the SDK is the assembler and all code is known, so the residual is inert.

**Implementation code on the proxy's masters.** Cheaper than section 11's proxy model.
- The proxy's masters run the current implementation's code directly (a native upgrade), with no separate
  implementation master.
- It saves one master per proxied entry.
- Cost: the implementation is not a separate contract, and an upgrade replaces the proxy masters' code.

**One root per signed input.** A cheaper, weaker limit.
- A signed P2PKH input may be the caller of at most one root.
- It stops an assembler from adding calls in the name of an input that is already used.
- It does not stop them from using a second input the user contributed, for example for fees.
- A user who batches several calls then needs one input per call.

---

## 15. Coverage of the 66 marketplace titles

**What the 66 exercise** (measured in `marketplace.test.ts` and the contract sources):
- 22 `describe` blocks and 66 titles, and every title runs the fixture first.
- **The fixture** deploys:
  - four Unicrow contracts at CREATE-predicted, circular addresses;
  - FakeToken;
  - MarketplaceV1 and MarketplaceData through `upgrades.deployProxy`, initialized through the proxy.
- **Assertions and actions:**
  - 181 revert matchers: 121 expect a revert (108 `revertedWith`, 9 custom errors, 4 bare `.reverted`) and 60
    expect none (6 `not.revertedWith`, 54 `not.reverted`), plus 6 `rejected` (Appendix B);
  - 59 emit matchers: 57 `.to.emit` and 2 `.not.to.emit`, several on `JobEvent`, whose payload is far above 128
    bytes;
  - 33 reads of stored events (`getEvents`);
  - 4 time jumps (`evm_increaseTime`);
  - signature checks (`signMessage` against `ecrecover`).
- **Not exercised:**
  - ETH payments: there is no `value:`, and Unicrow's `call{value}` runs only for ETH escrows;
  - runtime `new`;
  - try/catch;
  - `delegatecall` outside the proxies.

| Need | Titles | Status |
| --- | --- | --- |
| One record written by several entries (`jobEvents[jobId]` appends by up to 5 MarketplaceData calls) | (d) 23 | Specified: V6, V7, section 20 (per-frame versions of long values) |
| Fan-in, and re-entry into a contract mid-execution (`approveResult`, `arbitrate`) | (e) 19 | Specified: masters per entry, segments, derived order; every edge in section 22 |
| Peer guards on `msg.sender`, and `tx.origin` checks (Unicrow) | most of (d) and (e) | Specified: frames (4a), addresses (D9), `originRef` |
| Proxies for both marketplace contracts | all 66 | Specified: sections 11 and 19 (proxy master, fallback, `DELEGATE`; three-transaction `deployProxy`) |
| Mapping entries, array appends, dynamic strings and bytes, created and deleted records | about 60 | Specified: section 20 (today's formats) |
| Large events, including ones from nested frames, decoded by ethers | about 40 | Specified for the mock: section 18 (event category, logs), mock commitment limit (open point 16) |
| Reverts, custom errors with arguments, reverts after calls, reverts from reads and from unfunded senders | 108 + 9 + 6 + 7 checks | Specified: section 18 |
| SafeERC20 low-level calls, `code.length`, `address(this).balance`, edge-case `ecrecover` inputs | all token titles; take-job sanity | Specified: sections 17, 23 (rows 9, 10, 11, 22) |
| CREATE-predicted addresses in the fixture | all 66 | Decided: SDK look-ahead (open point 13) |
| Enough masters per transaction (Unicrow up to 9, MarketplaceData 5 plus 5) | (d), (e) | Specified: section 21 (12 masters per contract) |
| Witness block and argument encodings | all 42 composed titles | Specified: sections 16, 17 |
| Time jumps, strictly later block times, one timestamp per transaction | 4 explicit, 7 implicit | Specified: sections 4a, 18 |
| Snapshots and reloads, un-awaited sends, a live event listener | 6 reloads; integration | Specified: section 18 |
| ETH value, payable calls with value, CREATE frames, try/catch, receipts | none | Not needed for the 66 |

**Verdict** (revision 9, unchanged by revision 10).
- Every mechanism the 66 exercise is now specified, and every call edge (section 22) and edge case (section 23) maps
  to a rule. The shape needs no new mechanism.
- **What 66/66 shows.** It is a semantics result on the mock.
  - It is not a safety claim: the EVM hazards are reproduced on purpose (section 9), and the hostile suite is a
    separate acceptance criterion (plan M2).
  - It is not a deployability claim: the largest titles exceed the relay size limit on a real chain (section 12,
    plan D3).
- What remains is implementation risk, which plan section 4 and its gate (I2) measure:
  - derivation time for `arbitrate`, about 24 masters with multi-megabyte code in the mock;
  - SafeERC20 lowering to typed calls;
  - `ecrecover` returning address 0 for invalid input;
  - listener timing in the integration test;
  - the size of `jobEvents` chunk outputs over 30 updates.

### 15.1 What the surveys found ahead of time

These surfaced from code surveys before any implementation. Each would otherwise have been found mid-build:
- **Pool sizes.**
  - `arbitrate` makes 20 calls and enters Unicrow 9 times in one transaction, about 24 masters in total.
  - `approveResult` makes 19 calls.
  - Both reach four calls below MarketplaceV1, plus the proxy hops (Appendix A).
- **Re-entry through a storage reentrancy guard.**
  - Unicrow's `setClaimed` succeeds only because `release` is unguarded, so the guard flag is still 1.
  - Static calls read state written moments earlier in the same transaction (`getEscrow`, `getArbitratorData`).
  - Both follow from V6 and V7; nothing special is needed.
- **`jobEvents[jobId]` rewrites the whole array on every append**, 5 times in one `publishJobPost`, and it grows to
  30 events in one title. Each writing frame mints its own version's chunks (section 20).
- **SafeERC20 appears in two versions** (OpenZeppelin 5.0.2 in MarketplaceV1, the vendored 4.9.3 in Unicrow). Both
  are low-level calls with re-raised custom errors, `code.length` checks and `address(this).balance` reads
  (sections 17 and 23).
- **The test harness needs:**
  - six mid-test reloads that restore SDK state too;
  - revert reports for seven sends from unfunded wallets;
  - revert reports from six view calls;
  - custom errors with arguments;
  - strictly later block times, because a dispute needs a block after the payment;
  - a live `JobEvent` listener raced against one second (section 18, Appendix B).
- **`ecrecover`** must return address 0 for invalid input, not fail the script (section 23, row 22).
- **The independent review of revision 7** raised nothing revision 8 had not already fixed. It wrongly cleared a
  swapped delegate callee (T37). Minimal pushes were confirmed as consensus in libauth (section 4).

---

# Part II: specification for the 66, ahead of time

Sections 16-23 settle the open points on the 66 critical path. Section 22 lists every cross-contract edge the tests
exercise, and section 23 every edge case, each with the rule that covers it. Sources:
- the contracts in the sibling `effectiveacceleration.ai/contract/contracts` (referenced, not copied);
- `marketplace.test.ts`;
- a code survey of today's record formats.

---

## 16. Witness block layout (resolves open point 1)

The first push of a master's unlocking bytecode (W0).
- Integers are little-endian and unsigned.
- `lp16` is a byte string with a 2-byte length prefix, and `lp32` one with a 4-byte prefix.
- An index of `0xFFFF` means none.

```text
block = "PW" 0x01                              magic; version 1, frozen with V_TEMPLATE
        kind:u8                                0 ROOT, 1 CALL, 2 STATIC, 3 DELEGATE, 4 INTERNAL, 5 CREATE
        callerRef:u16  originRef:u16  validatorRef:u16
        sender:lp16  self:lp16  value:u64
        retval:lp32                            section 17; empty when the function returns nothing
        callCount:u16  { kind:u8 target:lp16 value:u64 calleeRef:u16 argsHash:32 result:lp32 } x callCount
        segCount:u16   { recCount:u16 { in:u16 out:u16 viewIn:lp32 viewOut:lp32 } x recCount } x segCount
        eventCount:u16 { out:u16 } x eventCount
        sendCount:u16  { out:u16 } x sendCount
        valueCount:u16 { value:lp32 } x valueCount      section 20; the long mapping values the frame reads
```

- **Records.** A record entry names its input `in` and its output `out`:
  - an existing record that is kept: `in == out`, because section 5 recreates at the same index;
  - the frame that creates a record: `in = 0xFFFF`, and `out` is a trailing output. The transcript's settlement
    lists that output (section 6, `createdOutputs`), which is how the program tells a created record's index apart
    from a spent state UTXO's;
  - a frame that reads or rewrites a record an earlier frame created: `in == out == that output index`, because the
    frame resolves the record through its own declaration and the record has no input to name;
  - a deleted record: `out = 0xFFFF`. Only the record's last view in the V6 order may delete it. A dynamic write
    deletes the old chunks it replaces; a mapping `delete` deletes no record (section 20).
- **Values.** Entry `i` is the value the body's `i`-th long-value read takes; the body checks it against the root in
  the node's head (section 20). A read that finds its value inline, and a frame that reads none, leave the entry
  empty or the list short, and a master's head takes at most as many as its widest body reads.
- **Side-cars.** No field names a compute side-car (section 5). The layout fixes where each one sits, so the body
  addresses it from its own input: for `r` recoveries and `p` of them projected to an EVM address, recovery `j`'s
  pair is at `OP_INPUTINDEX + 1 + 2j` and `+ 2 + 2j`, projection `j`'s keccak side-car at `+ 1 + 2r + j`, and the
  `i`-th `keccak256` call's at `+ 1 + 2r + p + i` (`GenerateTargetTraversal.ts`). A body that hashes inside a loop
  counts instead: its `k`-th call reads `+ 1 + 2r + p + k`. A side-car recreates itself at its own index, so the same
  coordinate names its output.
- **Runs.** A master with a body that emits or sends inside a loop reads that list as a run: the listed outputs must
  be consecutive, its head checks every one, and the body binds its `k`-th event or send at the run's first output
  plus `k` where it makes it and pins its count against the block's where it ends (`frame-tail.ts` `runSection`).
  The order a builder lists them in is published per entry (section 18, `loopEffects`).
- **Skipped emits.** Outside a run the list holds one output per emit the body holds, reached or not. An emit a
  branch guards that the body skips keeps its output, which carries the empty commitment, and the body closes that
  commitment against the empty payload as it closes a reached emit's against its payload; a reached emit's is never
  empty (a zero-parameter event carries a marker byte). Each such emit publishes the condition it runs under on its
  `emits` row (`activation`), from which a builder states the empty commitment, or learns the skip from that close
  where the frame's facts do not decide it.
- **Counts.** `segCount == callCount + 1`.
- **Exactness.** Lengths are exact, and nothing follows the last field (T33).

## 17. Canonical encodings (resolves open point 2)

- **Addresses.**
  - A user's address is its 25-byte P2PKH locking bytecode. A contract's is its 35-byte `addrV` lock.
  - In native mode, state fields, arguments, results and event fields all use this form
    (`packages/utils/src/framed/canonical.ts`).
  - In Solidity-compat mode (`evmCompat`, which the marketplace compiles with), stored values keep the
    full lock, while results and the arguments of the calls a contract makes carry the 20-byte identity (DECISIONS
    D13, the kernel's shared base). The identity is the hash a P2PKH lock names, or `HASH160` of a contract's
    35-byte lock (`lockingBytecodeToSolidityAddressPayload`), and the all-zero address is the empty lock. For
    example, an `address` the body packs into a call's argument with `abi.encodePacked` is its 20 bytes, and the SDK
    states it so (`fadf5a3d2`, `ahead/packed-address-argument.test.ts`).
  - The SDK widens an `address` argument a user gives in the 20-byte form to the P2PKH lock it names
    (`encodeFunctionArgument`), so the entry receives the lock a contract stores and keys a mapping by.
  - `uint160(addr)` and 20-byte ABI words are today's truncation (audit F15). They are unchanged, and identity never
    comes from them: a frame's `sender`, `self` and `origin` are full locks in both modes (section 4a).
- **Values.** Each value has one canonical byte string:
  - integers are minimal script numbers;
  - `bool` is 0 or 1 as a script number;
  - `bytesN`, `bytes` and `string` are their raw bytes;
  - structs, fixed arrays (for example `uint16[5]`) and dynamic arrays use the compiler's flattened argument
    encoding, the one the SDK already uses for calls.
- **Arguments.**
  - `args` is the concatenation of each argument's minimal push, with the last parameter's push first and the first
    parameter's push last. These are exactly the bytes between the witness block and the redeem script in the
    callee's unlocking bytecode. The callee's compiled body reads its parameters off the stack, so the push the
    first parameter names is the one the bytecode must leave on top: the item pushed last.
  - `argsHash = SHA256(selector || args)`, with the 4-byte dispatcher selector.
  - The caller builds `args` in its script with `encodeDataPush`'s minimal-push rule:
    - a 1-byte value from `0x01` to `0x10` becomes `OP_1`-`OP_16`;
    - `0x81` becomes `OP_1NEGATE`;
    - empty becomes `OP_0`.
- **Results.** `result` and `retval` use the same concatenated-push encoding of the return values.
- **Low-level calls whose calldata names its call statically** (`abi.encodeCall`, `abi.encodeWithSelector`, or a
  literal `abi.encodeWithSignature`).
  - This is SafeERC20 in OpenZeppelin 5.0.2 and the vendored 4.9.3.
  - They compile as typed calls of the named function, so `argsHash` and `result` stay canonical. The frame kind
    follows the spelling: `staticcall` is `STATIC`, `call` is `CALL`.
  - A literal signature that names no function of the target runs its fallback, and the record binds the payload's
    own selector. A payload computed at run time, `delegatecall` and a call with value are refused by name.
  - Where the caller decodes EVM-ABI return data (`abi.decode(ret, (bool))`), its own code converts from the
    canonical result.
  - The callee's revert data propagates unchanged (section 18).
- **Records.** `viewIn` and `viewOut` are whole NFT commitments (section 20).

## 18. SDK derivation, reverts and reads (resolves open point 3)

- **Stop sites.** For every entry, the compiler publishes two kinds of site on the artifact
  (`composition.stopSites`, `solidc/src/framed/master/stop-sites.ts`):
  - external calls, with their index, in call order: a call inside a loop is published once and marked `repeated`,
    and a call on a branch is marked `conditional`;
  - segment closes, one per segment, so an entry with `k` calls publishes `2k + 1` sites.
  An entry that emits, sends or hashes inside a loop also publishes `loopEffects`: per kind, the runs its body makes
  in execution order, each a list of emit or transfer indices (hashes: call positions), and a run a loop repeats
  carries the loop's recurrence. A call lists one output or side-car per effect, each loop run once per turn its
  recurrence counts against the call's own arguments and state (`call/loop-turns.ts`).
- **No read site is published**, although the schema has the kind. A read's site would name the record it reads,
  which the compiler does not hold: the records a frame touches are its declaration (section 20). So the plan
  states each declared record's current commitment as its `viewIn` before the run.
- **Loop.**
  - Run a master in the VM against draft witnesses.
  - At the first site whose witness is missing, read what it needs from the VM stack: the call's kind, target,
    selector and arguments, or the computed records.
  - Fill that witness, derive any callee fully first, and continue. Every step gets strictly further (section 10).
  - **What ships: every step reruns the master.** The driver's cursor only moves forward
    (`solidcash/src/framed/composer/derivation.ts`), but the shipped host runs each step from the master's start,
    twice: once with the site's witness unfilled, noting where the program stops, and once with it filled, and counts
    the site filled only when the second run gets strictly further (`composer/shipped-host.ts`). The compiled master
    publishes no program offset per site, so a stop cannot be mapped back to its site, and the two runs prove the
    fill instead. The call paths learn the values a body computes (record end views, events, sends, `retval`) the
    same way, one run per learned value and one more over all of them (`call/call.ts`).
  - **Resuming is a future option.** Continuing each master from a snapshot of its VM state at the stop site costs
    about one run per master, where the rerun costs two per stop site, about 10 sites per master. The evaluation
    estimated that even one run per site could cost more SDK time than today's kernel, and resuming 2-4x less
    (`archive/docs:docs/framed/EVAL_FRAMED_VS_KERNEL.md` section 5). Resuming needs the compiler to publish where each site's witness is
    consumed, and a VM snapshot cheaper than a run.
  - **Stalls are refused** (review, 2026-09-25; the step cap was removed in revision 11). Every step must fill at
    least one missing witness: a call result or a segment close. A step that fills none stops derivation with
    `FRAMED_DERIVATION_STALLED`, naming the master, the function and the stop site. Nothing is built or
    broadcast.
  - **Termination needs no extra constant.** Each step fills a witness at a stop site that the execution reaches,
    so the steps are bounded by that execution's length. The VM bounds the execution with the provider's
    op-cost budget, `(41 + L) x operationCostBudgetPerByte` for unlocking length `L`, at 100 per instruction. On a
    real chain that is `(41 + L) x 8` instructions, about 80,000 at 10,000 B. A large legitimate derivation (30
    `jobEvents` appends, the `sendEscrowShare` fan-outs) is therefore never refused for its size. An execution over
    budget fails in the VM like any script. The mock's relaxed budget loosens this bound for validation as much as
    for derivation.
- **Reverts.**
  - A failure that is not at a stop site is a real revert. Its source location, from debug metadata, gives the
    `require` message or custom error.
  - A callee's revert propagates to its caller unchanged, as in the EVM: there is no try/catch. This includes
    custom errors that SafeERC20 re-raises with inline assembly, such as FakeToken's `ERC20InsufficientAllowance`.
  - The SDK reports the innermost revert, and nothing is broadcast.
  - This applies equally when the revert comes after earlier calls succeeded: `arbitrate` after
    `D.arbitratorSettled`, `approveResult` after the whole payout chain, `publishJobPost` after `T.approve`.
- **Reads from tests.**
  - A view call runs off-chain as a `STATIC` `ROOT` frame against the current records.
  - Nested static calls are derived the same way, including views that call back, such as `D.getJob` into
    `M.getJob`.
  - No transaction is built.
- **Events for ethers.**
  - An event is an immutable NFT of the category of the emitting frame's context contract. A JobEvent emitted by
    MarketplaceData's implementation therefore carries MarketplaceData's proxy category.
  - The SDK presents it as a log from that contract's address, `addrV(cat)`. This covers events asserted on nested
    callees: `D.JobEvent`, `U.Pay`, `U.Release`, `UD.Challenge`, `UA.Arbitrated`.
- **Serialization.**
  - The SDK queues transactions that could touch the same masters, validators or records.
  - It builds each against the state its predecessor produces.
  - A test that sends without awaiting (title #32) must not double-spend a master.
- **Time.**
  - The locktime, `tx.time`, is fixed before any derivation (plan E7). `block.timestamp` and `block.number` are not
    the locktime but each contract's registers (section 4a).
  - Every accepted transaction is its own block, with a strictly later timestamp, and the mock provider writes its
    clock into every registered deployment's registers when it mines that block. `evm_increaseTime` and `evm_mine`
    move the clock and write the registers the same way. A creator's dispute needs a block after the pay block
    (`UD.challenge`).
  - A `Rated` event's `timestamp_` must equal the review's timestamp written in the same transaction. Each is a
    register read, and on the mock every deployment's registers hold one clock (section 4a).
- **Simulation before funding.**
  - Derivation, and with it revert detection, runs before fee funding.
  - A send from an unfunded wallet (seven sends in the tests) reports its revert, for example
    `OwnableUnauthorizedAccount`, instead of a funding error.
- **Revert data.**
  - Reasons and custom errors, with their arguments, are decoded from the reverting frame's debug metadata:
    `ECDSAInvalidSignatureLength(0)`, `OwnableUnauthorizedAccount(addr)`, `InvalidInitialization`, and FakeToken's
    ERC-20 errors raised through SafeERC20.
  - Reads report reverts the same way. Six `revertedWith` checks come from view calls.
- **Snapshots.**
  - `loadFixture` snapshots, and there are six mid-test reloads.
  - They restore the provider's UTXO set together with all SDK state derived from it: the signer nonce, the
    genesis-UTXO look-ahead (open point 13), pool bookkeeping and cached records.
  - A signature reused across a reload stays valid, because the reloaded state is identical.
- **Event subscriptions.**
  - After a transaction is accepted, the SDK delivers its logs to listeners registered on the emitting contract's
    address (`addListener`).
  - This includes logs from nested frames.
  - The integration test races a listener against a 1-second timer.

## 19. Proxies and the deployment fixture (resolves open point 5 for the 66)

- **The proxy.** A built-in proxy is the same for every proxied contract:
  - its records hold the implementation's state layout plus one field, `implementation`, the implementation's
    address;
  - its fallback reads `implementation` from its records and records a `DELEGATE` call with
    `target = implementation`, with the selector and arguments unchanged (its own `args` bytes);
  - it returns the callee's result unchanged;
  - upgrades are admin-only, and the 66 never upgrade.
- **Cost.** A proxied entry takes two masters: the proxy's and the implementation's.
- **`deployProxy`** runs as two transactions, neither of which calls another contract:
  1. deploy the implementation (its category genesis and master pool);
  2. deploy the proxy (its genesis, master and validator pools), its records minted as `initialize` leaves them.
- **`initialize`** is the proxy's constructor frame: a `ROOT` frame on the proxy master that delegatecalls the
  implementation, derived off chain against a probe of the proxy's genesis (records with `implementation` set,
  collections empty) that is never broadcast. The proxy is never on chain uninitialized (audits F11, SDKFRAMED-2).
  - `msg.sender` inside it is the deployer, by `DELEGATE` passthrough, so `__Ownable_init(msg.sender)` is right.
  - The `Initializable` flag lives in the proxy's records, so a second `initialize` reverts (title #8).
  - An initializer that calls another contract changes state the proxy's genesis cannot mint, so it is refused
    unless the deployer asks for a separate hop (`initializeAs: 'hop'`): the uninitialized genesis, then a third
    transaction, broadcast back to back; anyone can race that hop until it confirms.
- **The fixture** is 14 transactions with no cross-contract call (EVAL 2.2): four Unicrow deploys, two
  `deployProxy`, `setMarketplaceDataAddress`, the FakeToken deploy, and token transfers and approvals.
  - FakeToken mints 3e26 to the deployer, in its constructor only.
  - The four Unicrow addresses come from the SDK look-ahead (open point 13). They are deployed strictly in nonce
    order, with circular constructor references.
  - Implementation constructors call `_disableInitializers`. That state is part of the implementation's genesis
    records, computed off-chain as for every user deployment.
  - `MarketplaceData.initialize` inserts 8 MECE tags into a `string => string` mapping: 8 created records in one
    transaction (section 20).

## 20. Records (resolves open point 4)

Records reuse today's formats unchanged (survey: `packages/utils/src/state.ts`, `SortedList.ts`,
`covenant-helpers.ts`). Every record lock is derived from the contract's category `C`, plus a salt where noted, and
pins `C` with the mutable capability. A record's view is its whole commitment.

| Record | Lock | Commitment | Created | Updated | Removed |
| --- | --- | --- | --- | --- | --- |
| Data NFT (scalars, structs, packed arrays, `A$len` headers) | One per contract: `buildDataNftCovenantScript(C)` | Optional index tag, then the fields in order, each as a minimal push | Only at genesis | In place | Only by `selfdestruct` |
| Mapping node (verified sorted list) | One per collection: entry covenant salted with `sha256(name:type)[:20]` | `slot(32) \|\| next(32) \|\| value tail (0-64, see below)`; `slot = mask(sha256(key))`, nested keys below; `next = 0` means the end | Insert: a new node as a trailing output, and the predecessor relinked in place | In place; slot and next kept | Never unlinked: `delete` writes the default value |
| HEAD sentinel | Same as its collection | Slot 0 | At genesis | Relinked by inserts | Never |
| Long mapping value (length-prefixed, value over 60 bytes) | Head in the node's tail: `len4 \|\| sha256(v) \|\| v[0:28]`; chunks at a lock salted with (collection, slot, root) | Chunk: `uint16LE(i) \|\| 126-byte slice` | Every version that is written | Never; a new version gets a new lock | Old versions may be cleaned up later; this is not required |
| Dynamic `string`, `bytes`, `T[]` state | Entry covenant salted per variable; length `A$len` in a data NFT | `pushdata(i) \|\| pushdata(120-byte slice)` | A write creates every new chunk | Never | A write consumes every old chunk |
| Satoshi and token containers | `buildSatoshiContainerCovenantScript(C)`, `buildTokenContainerCovenantScript(C, X)` (the accounted variant for a contract that pays tokens, 4b) | None; they hold value | Genesis, a payment `CALL`, or a token deposit | A satoshi container merged; a token container in place, by the master its unlocking names | Drained by listed sends, or by a token run's sends |
| Event | `buildEventNftCovenantScript(C, sha256(signature)[:20])` | The arguments' pushes | Minted at `emit` (W3) | Never | Anyone may sweep it after 144 blocks |

**Encodings, stated here rather than delegated** (review, 2026-09-25; `packages/solidc/docs/verified-mappings.md`):
- **Value tails.** A node's tail holds 64 bytes, and both thresholds come from it:
  - a value whose type has a fixed width fills the tail directly. The shipped classifier decides this from the **type**, not from a measurement of the encoding, so two types are stored verbatim however long they are and can exceed the tail: `sig`, and an unbounded `bigint`. A collection whose value type is either needs a chunked form the tail does not provide;
  - every other value carries a 4-byte length: variable-width values (`string`, `bytes`, a chunkable struct or
    array), whatever their length;
  - a length-prefixed value of at most 60 bytes fits inline, since `len4 || v` is then at most 64 bytes. A longer one
    is a long value, stored as the 64-byte head. The table's "over 60 bytes" counts the value, not the tail;
  - `len4` tells inline from long, and the collection's value type tells a direct value from a length-prefixed one.
- **Nested mappings.** `mapping(K0 => mapping(K1 => V))` is one collection, not one per outer key.
  - The slot for keys `k0, k1, ...` is `mask(sha256(sha256(k0) || sha256(k1) || ...))`. A single key gives
    `mask(sha256(k0))`.
  - Each `ki` is the key's canonical encoding (section 17). `mask` clears the top bit of the last byte.
  - Compiler: `emitSortedKeyHash` (`GenerateTargetTraversal.ts:20946-21012`); SDK: `keyToSlotMulti`.
  - The marketplace's `whitelistWorkers`, `mapping(uint256 => mapping(address => bool))`, uses it.
- **Fixed-size state arrays** `T[N]` reuse existing kinds (`packages/solidc/docs/arrays.md`): by default one mapping
  node per set index, as for `mapping(uint => T)`; with `packed`, a blob in the data NFT.
  - `__gap` arrays (OpenZeppelin's reserved storage) are dropped at compile time under `evmCompat`
    (`compiler.ts:12452-12458`), which the project compile configs set (`solidcash.config.ts:13`,
    `solidcash.faketoken.config.ts:9`). They have no record.
  - **Upgrade layout rule** (`readUpgradeLayoutVerdict`, plan 4.7). An upgrade keeps every record the old
    implementation wrote: each state variable by name, type, coordinates and encoding, each struct a field or
    collection reaches field for field, each collection by signature and value form. A framed record is minted
    only at genesis, so an appended field or collection has no record behind the proxy and is refused too; `__gap`
    carries no record. The compiler refuses by name under `upgradesFrom`, and the SDK's `requireFramedUpgrade`
    refuses by name before an upgrade is built. The generated proxy serves no upgrade entry (19.4 is held), and the
    66 do not upgrade.

**In this model:**
- **Which records a frame declares.**
  - First, the data records its entry's block layout names, in that order: its code reads each at its place past the
    first record the frame declares.
  - An entry that writes a verified mapping then declares every other data record, kept.
  - Then one node, kept, for each mapping key the entry only reads, in the order the layout lists the entry's slots:
    its code reads each at its place past the records before it. A node the batch also spends, such as the node a
    key the batch splices in relinks, cannot be declared twice, so that call is refused.
  - Then the batch's groups, which its code names by ordinal past every record before them.
  - A record the frame does not declare is not spent, so it keeps whatever it holds.
- **Reads.**
  - A frame reads a node, or its strict predecessor as an absence proof (`slot < s(k) < next`, or `next = 0`), as a
    touched record with `viewIn == viewOut`. Its own code checks the proof, as today.
  - `s(k)` is the key's masked slot from the encodings above, never the raw hash: the mask changes the last byte
    for about half of all keys. Slots compare as little-endian 255-bit numbers, which the mask keeps non-negative.
  - A long value arrives in the value list of the frame's block (section 16), and the frame checks it against the
    root in the head.
- **Inserts across frames.**
  - A node created in the transaction can be relinked or updated by later frames.
  - The creating frame's record entry has `in = 0xFFFF`, and its view chain starts at creation; each later frame
    that reads or rewrites the node declares `in == out` at the created output's index and continues from the view
    the frame before it left.
  - V7 and S1 require the final view to equal the created output.
  - `MarketplaceData.initialize` inserts 8 MECE tags in one frame, using today's batch insert. A batch decides every
    predecessor against the list it started from, so inserts into one gap share their predecessor: each insert's
    group declares it again, continuing from the view the group before it left, and its gap is proved against its
    first declaration in the segment, the view the batch started from.
- **Long values written by several frames.** This is `jobEvents[jobId]`, where each append rewrites the whole
  array: 5 appends in `publishJobPost`, and 30 events in "update job many times".
  - Each frame that writes the value mints the chunks of its own version, and checks them itself, as today. It
    declares them as created records after its batch's groups, and its code requires the records it declares
    past the groups to number exactly the chunks it pinned: settlement admits a created record wherever a frame
    declares one.
  - The next frame receives the value as a witness bound by the root in its `viewIn`.
  - Intermediate versions' chunks stay as unspent outputs. Creating only the final version is a later optimization.
- **Dynamic storage writes.** They consume every old chunk (record entries with `out = 0xFFFF`) and create every new
  one. V7's input rule counts the consumed chunks as touched.
- **Census** (S2, V7). Mutable NFTs of `C` may appear only at kept, updated or created records and containers. The
  number of nodes at each collection lock is exact, as today.
- **Values.** D2 applies to every record, including mapping nodes and chunks, which today carry no satoshi pin (T39).
- **Commitment limits.** Packing still targets 128 bytes, but encoding enforces the provider's
  `maximumNftCommitmentBytes`. The relaxed mock allows 10 MB, so the 66 never hit a limit.

**Invariants carried over from today's record formats** (survey):
1. A record covenant's master path trusts any master of `C` blindly, so whatever settles the record must pin every
   `C` output. That is the census in S2 and V7.
2. Every record lock pins its own category and capability. So a spent UTXO at a record lock is a genuine record.
3. A mapping key's absence is proven by its sorted predecessor (`slot < s(k) < next`, with `s(k)` the masked slot).
   Slots are unique and links strictly increase. Slot 0 is reserved for HEAD: a key whose masked slot is 0
   (probability about `q / 2^255` for `q` keys) is refused as reserved, as today (`verified-mappings.md` 2.1).
4. `A$len`, in a data NFT that is always spent, is the authority for a dynamic value's length and chunk count.
5. A long value's root binds it, and its chunk lock binds (collection, slot, root).
6. Events carry their emitter's category and can be swept after 144 blocks. Contracts never read them.

## 21. Pools (resolves plan D6 for the 66)

Measured worst transaction per contract. A proxied contract counts two masters per entry. Static entries count,
since each needs a master.

| Contract | Most entries in one transaction | Where |
| --- | --- | --- |
| MarketplaceV1 proxy, and its implementation | 1 each | Every job transaction (the root) |
| MarketplaceData proxy, and its implementation | 5 each | `publishJobPost`, `takeJob`, `approveResult` |
| FakeToken | 5 | `arbitrate` 80-20 |
| Unicrow | 9 | `arbitrate` 80-20 (`approveResult`: 8) |
| UnicrowArbitrator | 3 | `arbitrate` |
| UnicrowClaim, UnicrowDispute | 1 | `approveResult` / `arbitrate`, `dispute` |

- **Sizes** (plan D6, decided: as many masters as needed):
  - the table above gives each contract's minimum;
  - the default is 12 masters per contract, which covers Unicrow's 9, and a contract may get more;
  - the default is 4 validators for every contract, whether or not it roots compositions
    (`DEFAULT_MASTER_POOL_SIZE` in `solidcash/src/framed/deploy/pool.ts`), and a deployment may state either count.
    In the 66 only the MarketplaceV1 proxy roots compositions; direct calls to MarketplaceData and FakeToken are
    standalone;
  - a deployment also funds one UTXO per validator facet (section 24), which serves any contract.
- **Exhaustion is refused** (review, 2026-09-25; validator clause corrected in revision 11).
  - **Masters.** When derivation needs one more entry into X than X has masters, the SDK stops before building.
  - **Validators.** One validator covers every root of its group (V4), provided the group's first root has the
    validator's category (V9); section 5.4 shows one validator serving `A.x` and `A.y`.
    - Independent compositions may each use their own validator (5.4: `AB` and `CD`), but any of them can instead
      join the group of the transaction's first root.
    - So a transaction needs only one validator, of its first root's category. It is spent and recreated in place
      (V1), so a pool cannot run out inside a transaction.
    - The only refusal: the transaction's first root belongs to a category with no validator. Other roots need no
      validator of their own category, because V9 constrains only a group's first root. Splitting into several
      groups is a choice, and each group then needs one validator of its own first root's category.
  - The diagnostic `FRAMED_POOL_EXHAUSTED` names X, the entries needed so far and the pool size. The remedy is a
    larger pool at deployment (plan D6), or `split` (deferred).
  - On chain there is nothing to check: a transaction cannot spend masters that do not exist.
  - The margin is small: `arbitrate` uses 9 of Unicrow's 12. A dedicated test fills a pool exactly, then asks for
    one more (plan E12).
- **Contention.** The tests run sequentially, so pools only need the per-transaction maxima.
- **Scale.** The largest transaction is `arbitrate`: about 24 masters, their state UTXOs, one validator and the
  funder.

## 22. Call-edge catalog (every cross-contract edge the 66 exercise)

- **Contracts:** M = MarketplaceV1 proxy, D = MarketplaceDataV1 proxy, T = FakeToken, U = Unicrow,
  UC = UnicrowClaim, UD = UnicrowDispute, UA = UnicrowArbitrator.
- **Proxy hops:** every user call into M, and every M -> D call, is a `CALL` (for a view, a `STATIC` call) to the
  proxy plus a `DELEGATE` into its implementation (section 19; V10 admits the `DELEGATE` below a `STATIC` frame).
  No other `delegatecall` runs.

| Edge | Kind | Notable shape | Rules |
| --- | --- | --- | --- |
| M -> D `arbitratorRegistered`, `userRegistered`, `eventsLength`, `getArbitratorFee` | `STATIC` | Scalar in and out | V10, 4a |
| M -> D `meceTags` | `STATIC` | Once per tag in a loop; `string` in and out; can revert mid-loop | V10, section 4 Loops, 17 |
| M -> D `publishJobEvent` | `CALL`, `onlyMarketplace` | A struct with two `bytes` fields; once per whitelist change in a loop; all calls append to one `jobEvents[jobId]` array | 4a (sender = M's address), V7 (one record across 5 frames), 20 |
| M -> D `updateUserRating`, `addReview`, `userDelivered`, `userRefunded`, `arbitratorSettled`, `arbitratorRefused` | `CALL`, `onlyMarketplace` | `addReview` carries a `string`; D itself reverts on a bad score | 4a, 18 (revert bubbles) |
| M -> T `approve`, `transfer`, `transferFrom` (SafeERC20, OpenZeppelin 5.0.2) | Low-level `CALL` | `abi.encodeCall` calldata; `bool` return decoded; revert data re-raised | 17 (typed call), 18 |
| M, U -> T `balanceOf` | `STATIC` | U reads it before and after `transferFrom` | V10 |
| M -> U `pay` | `CALL`, payable with value 0 | A struct argument with a `string`; returns `uint256` | 4a, V5 (value 0), 17 |
| U -> UA `setArbitrator` | `CALL`, `onlyUnicrow` | Before U stores the escrow (a write after the call) | Segments, V7 |
| U -> T `transferFrom`, `transfer` (SafeERC20 4.9.3) | Low-level `CALL` | `encodeWithSelector` calldata | 17, 18 |
| M -> U `release` -> UC `claim` | `CALL` | U is re-entered while `release` runs | V6, V7 |
| UC -> U `getEscrow`, `splitCalculation` | `STATIC`, re-entering U | `Escrow` struct with a `string`; `uint16[5]`; reads what `release` just wrote | V6, V7, V10, 17 |
| UC -> U `setClaimed` | `CALL`, re-entering U, `nonReentrant` | Passes because `release` is unguarded, so U's guard flag is still 1 | V7 (the flag is a record field) |
| UC -> U `sendEscrowShare` -> T `transfer` | `CALL`, re-entering U, in a loop | 2, 4 or 5 iterations, depending on the shares just computed | Loops, 18 (reruns) |
| M -> U `refund` | `CALL`, `nonReentrant` | Passes only through `tx.origin` (the worker, or the arbitrator via `refuseArbitration`) | O1, V5 (origin) |
| U, UC -> UA `getArbitratorData`; UC -> UA `arbitrationCalculation` | `STATIC`, re-entering UA during `arbitrate` | Reads `arbitrated = true` just written | V6, V7, V10 |
| M -> UD `challenge` -> U `getEscrow`, U `challenge` | `CALL` / `STATIC` | Needs a block after the pay block | 18 (Time) |
| M -> UA `arbitrate` -> U `getEscrow`, U `settle`, UC `claim` | `CALL`, passes through `tx.origin` | Returns `uint256[5]`; M reverts after it in the sanity tests | O1, 17, 18 |
| D views -> M `getJob`, `jobsLength` | `STATIC`, reads only | Returns `JobPost` with `string[]` | 18 (reads) |

- **Largest transactions:**
  - `arbitrate` 80-20: 20 calls; Unicrow entered 9 times, FakeToken 5, UnicrowArbitrator 3, MarketplaceData 2.
  - `approveResult`: 19 calls.
  - Both reach four calls below M, with the proxy hops on top.
- **What is never re-entered:** M, D and T. ERC-20 has no callbacks.
- **No call target changes within a transaction.**

## 23. Edge cases the 66 hit, with the rule that covers each

Each row gets its own dedicated test before the ladder, and the tests stay as regression guards (plan stream G2).
Implementation status of every rule and mechanism in this spec is tracked only in the plan's section 4 checklist.

| # | Edge case | Where | Covered by |
| --- | --- | --- | --- |
| 1 | Reentrancy guard kept in storage and crossed by re-entry (`U._status`, `UC._status`) | `approveResult`, `arbitrate` | The guard is a record field; views chain it (V7) |
| 2 | A static call reads state its caller's caller wrote moments ago | `getEscrow`, `getArbitratorData` | V6 order, V7 chains |
| 3 | Which callee runs, and how many times, depends on that state | `claim` (calculation, loop count) | Derivation reruns (18) |
| 4 | Calls inside data-dependent loops, including a revert mid-loop | `meceTags`, `publishJobEvent`, `sendEscrowShare` | Variable `calls` and segments (4, 16) |
| 5 | Revert after state-changing calls (7 checks) | `arbitrate`, `approveResult`, `publishJobPost` | The transaction is atomic; innermost revert reported (18) |
| 6 | Custom errors raised in a callee and re-raised by SafeERC20 assembly | Invalid amount | Revert data bubbles unchanged (18) |
| 7 | `tx.origin` authorizes a nested call | `U.refund`, `UA.arbitrate` | O1, V5 |
| 8 | `msg.sender` guards on proxy and CREATE-predicted addresses | `onlyMarketplace`, `buyer == M`, `onlyUnicrow*` | 4a, D9 addresses, 19 |
| 9 | `code.length` of a target | `token_.code.length` (title "invalid token"), `forceApprove` | Non-zero exactly for a contract address (P2SH32 `addrV` form). P2PKH and `address(0)` give 0 |
| 10 | `address(this).balance` compared with 0 in `functionCallWithValue` | Every SafeERC20 call | The context contract's satoshi containers; constant-folds for value 0 |
| 11 | Low-level call, `bool` return decoding, revert re-raise | All token movement | 17, 18 |
| 12 | Struct and array arguments and returns with dynamic members; `uint16[5]`, `uint256[5]` | `publishJobEvent`, `pay`, `getEscrow`, `claim` | 17 |
| 13 | Events above 128 bytes, emitted by nested frames and asserted | JobEvent (224 B and up), Pay, Release, Challenge, Arbitrated (700-870 B) | Mock commitment limit; event category of the context contract (18) |
| 14 | Two JobEvents in one transaction (five transactions) | Whitelist, refund, approve | Distinct event outputs in order (T41) |
| 15 | Writes after an external call | `collateralOwed`, escrow storage, `escrowId` | Segments (W2) |
| 16 | 24-hour windows, the challenge period, strictly later block times, `Rated` timestamp equal to the review's | Collateral, dispute, arbitrate, review | 18 (Time), 4a |
| 17 | Snapshots and six mid-test reloads | Take, pay, thread, approve titles | 18 (Snapshots) |
| 18 | Reverts from unfunded senders (7) | Admin, take, dispute, arbitrate titles | 18 (simulation before funding) |
| 19 | Reverts from view calls (6) | `getArbitrators`, `readMeceTag`, `getJobs`, `getEvents` | 18 (reads) |
| 20 | Un-awaited sends and matchers | Refund; upstream #32 | 18 (Serialization) |
| 21 | Live event listener raced against 1 s | Integration | 18 (Event subscriptions) |
| 22 | `ecrecover` on `"0x"`, 65 zero bytes (v = 0), a 20-byte value | Take job sanity | The native `ecrecover` must return address 0 for invalid input, not fail the script; OpenZeppelin then raises its own errors |
| 23 | Records growing within one transaction and across 30 transactions | 8 MECE tags in `initialize`; 30 events for one job; registrations | Section 20 |
| 24 | `string => string` mapping set and delete | `updateMeceTag`, `removeMeceTag` (refused as `KERNEL_LAYOUT` today) | Section 20 |
| 25 | Deep chains, four calls below M plus proxy hops, about 24 masters | `arbitrate` | The program's V6 walk allows about 30 call levels where it settles a contract (section 7.2); pools (21) |
| 26 | A multi-megabyte master script in the mock (MarketplaceV1) | Every M entry | The validator reads only the first push (W0); relaxed op-cost |

Out of scope, and identical to the EVM: `U.pay` has no caller check while M leaves U a maximum allowance, so anyone
can move M's tokens into an escrow; `publishJobPost` also approves M for itself.

## 24. Validator facets (resolves open point 7's size half)

A real chain caps each unlocking bytecode at 10,000 B and funds each input's execution at 800 operation-cost units
per byte of that same unlocking bytecode (section 12). Measured on the reference composition after the order walk
landed (2026-09-28): the program was 10,270 B, the validator input's unlocking bytecode 10,354 B, and it spent
4,897,165 of the 8,316,000 units its bytes bought. The program still had checks to emit, and `arbitrate` covers
about 24 masters. So a validator may span several inputs, and since `dc4c1bdc6` (2026-09-29) it does.

**What ships** (`solidc/src/framed/validator/program.ts`).
- `K = 2`: a head and one facet.
- The head (`HEAD_CHECKS`) runs V1, V2's header and index checks, V9, V3, V7's input, census, chain and value rules
  with the V6 order the chains follow, and V11, and binds the facet. A check stays in the head when its rule is
  about the input that runs it: V1 recreates the validator at its own index, V9 and the settle rule read its token,
  V3 reads the validator reference the machine evaluates, the census reads the input its output belongs to, and V11
  derives the address of the script running.
- The facet (`FACET_CHECKS`) runs V4, V5, V6's reachability walk, V10, V7's rule that no category is settled twice,
  V8 in both directions, and V7's rule that a settled contract carries no fungible amount.
- Sizes, measured at `93822cd78` with `buildValidatorParts`: the head is 8,183 B of program and the facet 5,657 B,
  each carrying 1,024 B of padding that buys its own budget (`VALIDATOR_INPUT_PADDING_BYTES`). On the reference
  caller/callee composition under the chain's own profile (`validator/consensus-limits.test.ts`), the head's
  unlocking bytecode is 8,231 B and spends 1,153,460 of the 6,617,600 units its bytes buy, the facet's is 5,660 B
  and spends 2,303,585 of 4,560,800, and every input is accepted.
- A deployment funds one facet UTXO beside its pools (section 21), and the composer places a facet at `head + 1`
  (section 5).

**Shape.**
- A validator is a head and `K - 1` facets. `K` and the split of the checks are part of `V_TEMPLATE` v1.
- The head is the validator input of section 3.2: a mutable NFT of `cat` at `addrV(cat)`, carrying `M`, running
  `V_TEMPLATE`. Masters recognize it through `H_V` exactly as before (N1).
- Facet `k` (`1 <= k < K`) is an input at the fixed position `head + k`, locked by `P2SH32(F_k)`, where `F_k` is the
  facet's code. It holds no token and pins no category, so any facet UTXO of that code serves any contract.
- Every check runs in exactly one input. The head keeps what decides what the others read: the pin, V1, `M`'s
  header and indices (V2), completeness (V3), and the binding below.

**Binding, in the head.**
- For each `k`, the input at `head + k` is locked by `P2SH32(F_k)`. `V_TEMPLATE` carries each `F_k`'s hash, so
  `addrV` commits to every facet's code (D9), and no facet can be replaced without changing every address.
- The output at `head + k` recreates the facet in place with at least its value, as V1 does for the head, so a
  facet pool cannot run out inside a transaction (section 21).
- Facets do not carry the head's hash, so the two hashes are not circular.

**Reading, in each facet.**
- Facet `k` reads `M` from the input at `OP_INPUTINDEX - k`: the first push of that input's unlocking bytecode. A
  check that derives an address (V5's `DELEGATE` target rule) reads `V_TEMPLATE`'s bytes from the same input's
  redeem script, past its pin push.
- A facet does not check that input. The head binds its facets; nothing relies on a facet spent without its head,
  and the facet's value stays in the facet it recreates.
- A transaction is valid only when every input succeeds, so a head and its facets decide exactly what one input
  running every check would: each check runs once, over one `M`, at one head.

**Budget.**
- Each input funds its own execution. Moving code into a facet moves its cost with it, so the split divides the
  work and not only the bytes, and each facet carries the padding its own checks need.
- `K` inputs hold up to `K x 10,000 B` of program and `K x 8,000,000` units. Plan A9 sizes `K` and the split from
  the measured program and from `arbitrate`.
- At `K = 2` the facet's walks grow faster than the composition while its bytes stay fixed. Measured at the split's
  landing (`dc4c1bdc6`, plan 4.5), 24 masters cost the facet about 19 times its budget. A head and nine facets, each
  padded to 9,600 B, fit 24 masters under the chain's profile (the worst part at 0.86 of its budget, and over it
  from 28 masters; measured in the parked tree on 2026-09-30). They are parked as a patch rather than landed,
  because changing `K` moves every address and every facet funding.

**Threats** (section 9; `solidcash/test/framed/hostile/validator-facets.test.ts`).
- A facet left out or moved: the head requires each facet's lock at `head + k` (the T4 and T6 class). A facet moved
  behind another head leaves its own position to some other input, and its head is refused.
- A facet spent away or drained: the head requires the output at `head + k` to recreate it, worth at least its
  input.
- A facet of other code: its lock is not `P2SH32(F_k)`.
- A facet that reads another transcript: it reads the input at `OP_INPUTINDEX - k`, and the head holds it at
  `head + k`, so both name the same head. A head whose unlocking bytecode pushes a second transcript ahead of the
  one it runs, so that its facet checks the first, leaves that extra item on its stack, and the machine refuses it.
- Two heads sharing a facet: a position holds one lock, the facets' codes differ, and a head's lock is not a facet's,
  so `h + k = h' + k'` forces `h = h'` and `k = k'`.

**Unchanged:** `M`'s wire format, the witness blocks, the masters, `addrV`'s form and every check's rule. Only the
input a check runs in moves. A head and one facet ship; a wider split is Phase R's (plan A9, DECISIONS D3), and must
land before the freeze binds (open point 13).

---

## Appendix A. Calls per top-level entry (call-graph survey)

- "Total" counts external call executions, with proxy hops excluded.
- EC is the `ecrecover` precompile, native in SolidCash.
- A proxied contract takes two masters per entry: MarketplaceV1 (M) and MarketplaceData (D).

| Entry (worst test path) | Total | D | T | U | UC | UA | UD | EC | Depth below M |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `publishJobPost` (arbitrator, 1 tag, 1 whitelisted) | 8 | 5 | 3 | | | | | | 1 |
| `updateJobPost` (arbitrator, 2 tags, amount raised) | 5 | 4 | 1 | | | | | | 1 |
| `updateJobWhitelist` (1 address), `deliverResult` | 1 | 1 | | | | | | | 1 |
| `closeJob`, `withdrawCollateral`, `reopenJob` | 2 | 1 | 1 | | | | | | 1 |
| `postThreadMessage` | 2 | 2 | | | | | | | 1 |
| `review` | 3 | 3 | | | | | | | 1 |
| `takeJob` (single applicant, with arbitrator) | 11 | 5 | 4 | 1 | | 1 | | 1 | 2 |
| `takeJob` (multiple applicants) | 3 | 3 | | | | | | 1 | 1 |
| `payStartJob` | 9 | 3 | 4 | 1 | | 1 | | | 2 |
| `approveResult` (rating 5) | 19 | 5 | 4 | 8 | 1 | 1 | | | 4 |
| `refund`, or `refuseArbitration` on a taken job | 6 | 3 | 1 | 1 | | 1 | | | 2 |
| `dispute` by the creator | 4 | 1 | | 2 | | | 1 | | 2 |
| `arbitrate` 80-20 (0-100: 18; 100-0: 14) | 20 | 2 | 5 | 9 | 1 | 3 | | | 4 |
| View `D.getJobs(0, 2)` (reads only) | 3 | | | | | | | | 1 |

Only FakeToken moves. There is no ETH, and payouts go through `UC.claim -> U.sendEscrowShare -> T.transfer`. The
tests assert exact basis-point results. For example, `arbitrate` 80-20 pays the buyer 79.2, the worker 15.81, the
treasury 3.86, the protocol 0.13 and the arbitrator 1 (in units of 1e18).

## Appendix B. Test mechanics (test-flow survey)

| Mechanic | Count |
| --- | --- |
| `revertedWith` | 108 checks. 6 from view calls; 3 inside a called contract; 25 after earlier calls succeeded, 7 of them after state changes |
| Custom errors | 9: `OwnableUnauthorizedAccount` x4, `InvalidInitialization`, FakeToken ERC-20 errors through SafeERC20, `ECDSAInvalidSignatureLength(0)`, `ECDSAInvalidSignature` |
| Other revert matchers | 4 `.reverted`, 6 `not.revertedWith`, 54 `not.reverted`, 6 `rejected` (4 client-side) |
| `.to.emit` | 57, plus 2 `.not.to.emit`. JobEvent 66 times at runtime, always from MarketplaceData on a transaction sent to MarketplaceV1 |
| Reads | `jobs()` 42 call sites; `getEvents` 9, plus 34 through the diff helper; 127 `balanceOf` assertions over 7 holders |
| Time | 4 explicit day jumps; implicitly increasing block times (7 dispute and arbitrate titles) |
| Signatures | 21 `takeJob` signatures (EIP-191 over `abi.encode(eventsLength, jobId)`); malformed inputs `"0x"`, 65 zero bytes, a 20-byte value |
| Fixture | 14 transactions; four CREATE-predicted Unicrow addresses; `jobId` 0; `escrowId` from 1 |
| Harness | 6 `loadFixture` reloads; 7 sends from an unfunded wallet; a live listener in the integration test; loose argument types |
