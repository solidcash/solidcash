# SolidCash Design Map

SolidCash is a language and toolchain for smart contracts on Bitcoin Cash. The language looks familiar to anyone
who has written Solidity, but it compiles to Bitcoin Script and stores state in Bitcoin Cash tokens rather than in
an account database.

This document explains the project at a design level: the major parts, what each part is responsible for, and how
they fit together. It is written for a reader who knows software engineering but may not know Bitcoin Cash
internals. Deep implementation details are left to the source and the engineering documents under `docs/`.

Snapshot: branch `solidcash_v0.13.1`, commit `aa8b1b3aa`, 2026-10-18.

---

## A short glossary

| Term | Meaning in this document |
| --- | --- |
| **UTXO** | An unspent transaction output. On Bitcoin Cash, coins and contract state are both held as UTXOs that a transaction consumes and recreates. |
| **Covenant** | A smart contract whose script checks how it may be spent. |
| **CashToken** | Bitcoin Cash's token layer. |
| **NFT** | A non-fungible token. Here, a unique token that can carry a small data payload. |
| **Commitment** | That small data payload. SolidCash uses commitments to store contract state. |
| **State token** | An NFT that carries part of a contract's state: a master token, data token, mapping entry, chunk, event, or container. |
| **Master token** | The NFT that identifies a stateful contract and authorizes its state changes. |
| **Artifact** | The compiler's output: a JSON or TypeScript description of a contract used by the SDK. |
| **ABI** | The callable interface of a contract: function names, arguments, and return values. |
| **Selector** | A short identifier used to choose a function in calldata. |
| **Composition** | Making several contracts, or several calls, participate in one transaction. |
| **Manifest** | The shared description of a composed transaction that every participant checks. |
| **Transcript** | The framed convention's description of the calls, state records, and changes in a composition. |
| **Witness** | Data supplied to a script so it can verify a claim, such as a mapping entry or a state record. |
| **Auto-derivation** | The SDK's process of discovering the UTXOs and computed values a call needs. |
| **Preflight** | A local simulation of the final transaction before it is broadcast. |
| **Fingerprint** | A stable content identifier for an artifact. |
| **Vmap** | SolidCash's verified mapping: a key-value store that can prove both presence and absence. |
| **Regtest** | A local Bitcoin Cash network used for end-to-end testing. |
| **EVM** | Ethereum Virtual Machine, the runtime Solidity normally targets. |

---

## 1. What the system does

A developer writes a contract in `.scash` source, or in Solidity source when compatibility mode is enabled. The
compiler produces an artifact describing the deployed contract. A TypeScript application uses the SDK to deploy
the contract, call its functions, read its state, and listen for events.

```
contract source  ->  compiler  ->  artifact  ->  SDK  ->  transaction  ->  Bitcoin Cash
```

Three ideas shape the whole design:

1. **The compiler publishes a full contract description.** The artifact contains far more than bytecode: state
   layout, call metadata, event definitions, safety information, and instructions the SDK needs to build valid
   transactions.
2. **The SDK learns by simulation.** For stateful calls, the SDK builds a trial transaction, runs the real
   compiled contract in a local simulator, reads what the contract computed, and adjusts until the transaction is
   valid. It does not maintain a second implementation of the contract's logic.
3. **Bitcoin Cash has no call instruction.** A "cross-contract call" is several inputs in one transaction, each
   checking the others. SolidCash offers three conventions for arranging that, with different trade-offs.

---

## 2. Highlights: what makes the design distinctive

These are the decisions that most shape the project.

1. **The artifact is the handshake between compiler and application.** It describes the contract's storage,
   calls, effects, and composition capabilities. The runtime reads that description instead of guessing from
   source code. This keeps one source of truth and lets the compiler evolve without an SDK rewrite.

2. **Auto-derivation treats the deployed contract as the authority.** The SDK does not try to reproduce the
   contract's state math in TypeScript. It runs the real script in a simulator and learns the values the script
   expects. This removes an entire class of "SDK and contract disagree" bugs.

3. **Mappings come with proofs of absence.** On a UTXO chain the spender chooses which entries to reveal. A
   mapping that treated "not revealed" as "empty" would let someone hide a balance or a used nonce. SolidCash
   stores mappings in a structure that proves a key is genuinely absent, not merely omitted.

4. **Three composition styles with explicit trade-offs.** The simple direct style uses the fewest UTXOs. The
   message bus handles repeated calls and cycles through a shared manifest. The framed style handles repeated
   entry into one contract through self-recreating programs and validators. The compiler publishes which style it
   used and fails rather than silently switching.

5. **A shared message bus for complex transactions.** Many logical calls can be checked as one atomic
   transaction. Every participant verifies the same description, so no coordinator or trusted server is needed.

6. **Framed composition separates a contract's address from its code.** The address identifies the contract's
   token category; the deployed programs carry the code. One generic validator checks the whole transaction, and
   derivation resumes from saved points instead of restarting.

7. **State is managed as a journal.** During a function, reads see earlier writes, helpers share the same pending
   values, and the final result is written once. This is what makes multi-step updates and mapping changes
   practical.

8. **Large values and expensive operations have dedicated mechanisms.** Values larger than one token commitment
   are split into chunks. Keccak hashing, public-key recovery, and shared libraries run in helper contracts that
   keep their own results, while the calling contract verifies the result.

9. **Artifacts and builds are deterministic.** Values have one canonical encoding, artifacts have stable
   fingerprints, and compilation caches are keyed by source and compiler content. Reproducibility is a design
   requirement, not an accident.

10. **Unsupported shapes fail with names.** When the compiler cannot prove a shape is safe, it reports a specific
    refusal instead of compiling a weaker contract. It tries several increasingly conservative strategies before
    giving up.

11. **Size and cost are treated as design constraints.** Bitcoin Cash limits script size and operation cost.
    SolidCash plans around those limits with code splitting, deduplication, dense packing, and deliberate budget
    reserves.

12. **The package layout respects load time and browser safety.** The browser never loads the Node-only compiler.
    Stateful, message-bus, framed, oracle, and wallet-connect code live on separate entry points so applications
    load only what they use.

13. **Solidity compatibility is a translation layer.** `evmCompat` lets real Solidity source compile, and matches
    Ethereum selectors, ABI words, and common storage idioms, while execution stays on Bitcoin Cash.

14. **Security lives in the scripts.** The SDK proposes transactions; the contracts decide whether they are valid.
    The framed validator is checked against a second, independent implementation.

15. **Tooling meets existing projects where they are.** SolidHat offers a Hardhat-shaped project environment,
    TypeScript bindings, a project compiler with caching, and a migration path for existing Solidity projects.

---

## 3. The compiler in plain terms

The compiler is a pipeline of small, ordered transformations. Each stage makes the program a little more explicit
until it can be turned into Bitcoin Script.

```
read source
  -> understand imports, types, inheritance, and modifiers
  -> lower convenient syntax into explicit operations
  -> prepare state access, calls, events, and control flow
  -> check safety rules
  -> generate Bitcoin Script
  -> optimize and deduplicate bytecode
  -> write the artifact
```

A useful way to think about it is a translation from a high-level, Solidity-shaped language into a set of
self-checking scripts. The compiler also acts as a proof assistant: it decides what shapes it can safely support,
and refuses the rest.

The most important outputs are:

- **The executable contract script.** The code that runs when the contract is spent.
- **The ABI.** How applications call the contract.
- **The state layout.** Where each stored value lives and how it is encoded.
- **The call and effect metadata.** What a function reads, writes, calls, emits, and transfers.
- **Composition metadata.** Whether the contract uses the direct, message-bus, or framed convention, and what the
  runtime must provide.

---

## 4. The three ways to combine contracts

Bitcoin Cash evaluates a transaction as a flat set of inputs. Each input runs the script that locks it. A
cross-contract call is therefore not a function call in the usual sense: it is two or more inputs in one
transaction, each checking facts about the others.

SolidCash offers three conventions.

| Convention | Best suited to | Main trade-off |
| --- | --- | --- |
| **Direct** | Simple applications and independent contracts | The same contract cannot be entered twice in one transaction |
| **Message bus** | Repeated calls, cycles, and multi-contract workflows | More compiler and runtime machinery; larger scripts |
| **Framed** | Calls that re-enter a contract already active in the transaction, and complex composition | Larger deployment footprint and a more involved runtime |

**Direct** is the default. One contract is one script. A call is a co-spent input, and the caller checks the
callee's address, selector, and arguments. This is the simplest model and the cheapest for ordinary use.

**Message bus** gives several contracts one shared description of the transaction: who is calling whom, with what
arguments, and what state changes result. Each participant checks the same description. This allows a contract to
appear several times logically while its state is settled once. The cost is a larger route script and a more
capable compiler.

**Framed** compiles each contract into a program that recreates itself, plus validators that check a transcript
of the whole composition. It can represent repeated entry into one contract, including a contract that is called
again while it is already active. Deployment creates a pool of master programs and validators, so the footprint
is larger.

The convention is published in the artifact. The compiler refuses an unknown or unsupported convention rather than
quietly emitting a different one.

---

## 5. Auto-derivation: how a call becomes a transaction

Auto-derivation is the stateful SDK's core mechanism. It is worth understanding because it explains why the SDK
can support complex contracts without duplicating the compiler's logic.

### 5.1 The problem

A function call names its arguments. A valid Bitcoin Cash transaction also needs:

- the contract's master token;
- the state tokens that the function reads or writes;
- proofs for every mapping lookup;
- chunks for large stored values;
- token and satoshi containers;
- funding for events and fees;
- external contracts and their state;
- helper contracts for hashing or key recovery.

Most of these are not explicit in the source call, and some depend on values the contract computes at run time.

### 5.2 The loop

The SDK acts like a careful assistant solving a puzzle:

1. Gather the state and context it can find.
2. Build a trial transaction.
3. Run the real compiled contract in a local Bitcoin Cash simulator.
4. Read what the contract expected or computed.
5. Update the trial transaction.
6. Repeat until nothing changes.

```
build a trial  ->  simulate the contract  ->  learn the missing values  ->  rebuild
       ^                                                                      |
       +------------------------------ repeat until stable ------------------+
```

Most calls settle in a few rounds. The SDK keeps a configurable ceiling and reports how many rounds it used. A
call that cannot settle raises a specific error rather than sending a guess.

The important property: the simulator runs the same script the network will run. The SDK is not maintaining a
parallel model of the contract's behavior.

### 5.3 What it discovers

Depending on the function, auto-derivation can find and fill in:

- the contract's current state and the state it will produce;
- mapping entries and proofs of missing keys;
- chunks for large strings, byte arrays, and arrays;
- external contract reads and calls, including their results;
- events, return values, satoshi transfers, and token transfers;
- hashing, key-recovery, and library helper contracts;
- funding, change, fees, and timing fields.

### 5.4 When it needs help

The SDK needs to know which contracts and libraries an application uses. The developer supplies that context once
when connecting: external contracts, libraries, child contracts, or a bundle of artifacts. Key and entry iteration
also needs the original keys, because the chain stores only their hashes.

For unusual cases the pending call offers manual hints: supply a key, state value, event, transfer, or external
call explicitly. These hints help discovery. They do not bypass the contract's checks.

### 5.5 Why it is a strong design

- **One definition of behavior.** The compiled script defines the state transition.
- **It handles values a caller cannot know.** Computed commitments, return data, and chunk roots are learned from
  the contract itself.
- **It is bounded.** Iteration limits and explicit failures prevent endless guessing.
- **It is honest about trust.** The simulator is a convenience. The network's scripts remain the authority.

---

## 6. Verified mappings: why the structure is necessary

Every `mapping(K => V)` in SolidCash is a **verified mapping**, or vmap. The vmap is a storage structure designed
for one specific problem: proving that a key is missing.

### 6.1 The omission problem

On Bitcoin Cash, the person building a transaction chooses which UTXOs to spend. A contract can inspect the
inputs it is given, but it cannot ask the network whether some other entry exists.

Suppose mappings stored one entry per key and treated "no entry supplied" as the default value. Someone with a
non-zero balance, a used replay nonce, or a revoked permission could simply omit their entry. The contract would
see nothing and conclude the key was empty.

This is an omission attack. No hash is forged; the attacker withholds information. It cannot be fixed by trusting
the provider or by hashing keys differently. The contract needs a positive proof that no entry exists.

### 6.2 The sorted-list idea

SolidCash stores each mapping as a sorted, linked list of small entry tokens:

```
HEAD -> key A -> key B -> key C -> end
```

Each entry knows the next key in order. A mandatory HEAD entry marks the beginning. The list is bound to the
contract's token category and to the mapping's own identity, so entries from another contract or another mapping
do not count.

To prove a key exists, the contract is shown that exact entry.

To prove a key does not exist, the contract is shown the entry immediately before where the key would be. That
entry's "next" pointer must jump past the missing key. The two neighbors bracket the position, so no hidden entry
can fit there.

This is the whole trick: absence becomes a small, checkable statement about one neighbor rather than a question
about the entire chain.

### 6.3 Updates, inserts, and deletes

- **Update:** consume an entry and recreate it in the same position with a new value.
- **Insert:** consume the predecessor and create two entries: the predecessor and the new key, with correct links.
  The contract checks that no existing entry was skipped or detached.
- **Delete:** write the value type's default. The entry may remain in the list. Application code should use the
  decoded value, not the physical presence of an entry, as the source of truth.

Large values are split into chunks tied to the key and to a hash of the full value, so chunks from another key or
an older version cannot be substituted.

Iteration walks the links. Values-only iteration needs no keys. Key or entry iteration needs the caller to supply
the original keys, because only their hashes are stored.

### 6.4 Why it is necessary

A contract on a UTXO chain has no global database to consult. Its only facts are the transaction's inputs and
outputs. Without an absence proof, every sparse mapping read is controlled by the person choosing the inputs.

The sorted list provides a local proof: one entry for a present key, one neighbor for an absent key. The cost is
real—one token per live key, link maintenance on insert, and linear cost for iteration—but it is the price of
sound sparse state.

SolidCash uses dense storage for fixed fields and ordered arrays, token containers for interchangeable tokens, and
vmaps where sparse keyed state or provable absence is actually needed.

---

## 7. `evmCompat`: what changes when it is on

`evmCompat` is a compatibility mode for Solidity source. It is a translation layer, not an EVM. Execution still
happens in Bitcoin Cash scripts, with Bitcoin Cash's cost model and transaction model.

### 7.1 What the mode enables

With `evmCompat` on, the compiler accepts real `.sol` source graphs and makes these adjustments:

| Area | Effect |
| --- | --- |
| Source language | Accepts Solidity pragmas, imports, inheritance rules, visibility and mutability rules, and common Solidity declaration forms |
| Function selectors | Uses Ethereum's hash-based selectors (`keccak256(signature)`) instead of SolidCash's native hashing |
| ABI encoding | Uses Ethereum's 32-byte-word head/tail encoding for `abi.*` |
| Address values | When an address becomes bytes, uses its 20-byte Solidity identity by default rather than the full Bitcoin Cash locking script |
| Integer casts | Truncates narrowing conversions and reinterprets same-width signed/unsigned values the way Solidity does |
| Fixed arrays | Can store a bounded `T[N]` as one packed state field instead of a collection |
| Public getters | Synthesizes callable getter functions for public state variables and mappings |
| Upgradeable contracts | Recognizes OpenZeppelin-style `initializer` and `reinitializer` patterns |
| Storage idioms | Recognizes common Solidity storage libraries (OpenZeppelin `StorageSlot`, ERC-7201 namespaces) and low-level storage assembly patterns |
| Events | Writes scalar event arguments in Ethereum's standard notation |
| `ecrecover` | Maps the bare Solidity public-key recovery call to an EVM-style address projection by default |
| Runtime signatures | Uses the Keccak helper for signatures built at run time |

Several Solidity-friendly conveniences—named returns, flexible declaration order, and ABI-only artifacts for
interfaces—are now shared with native mode. They no longer require the switch. Literal behavior is more nuanced:
some conversions are shared, while ABI encoding and the meaning of hex and byte values still depend on the mode.

### 7.2 ABI encoding and literal semantics

The switch changes how values are encoded at ABI boundaries and how fixed-byte values are interpreted. Some
literal conversions are shared.

**ABI encoding.** With `evmCompat` on, `abi.encode`, `abi.decode`, `abi.encodePacked`, `abi.encodeWithSelector`,
and `abi.encodeWithSignature` use Ethereum's wire format: 32-byte big-endian words, head-and-tail offsets for
dynamic values, and Keccak-based selectors. With it off, they use SolidCash's native pushdata framing. The same
distinction applies to values returned from one contract to another: an `evmCompat` artifact uses EVM word
encoding, and a native artifact uses compact pushdata encoding. The artifact records which encoding it uses, and
the SDK follows it.

**Hex and byte literals.** Literal conversions are shared. A `0x...` spelling can be a big-endian number in an
integer context, a 20-byte address in an address context, and a byte sequence in a bytes context. A shorter string
or hex literal right-pads into a fixed `bytesN`, a hex string literal can initialize a `string`, and numeric zero
converts to an all-zero `bytesN`. These conversions fire only where the native type rules would otherwise reject
the pairing.

**Fixed bytes and casts.** The modes diverge when a `bytesN` or address value becomes a number. `evmCompat` uses
EVM word order (big-endian) and truncates narrowing casts, matching Solidity. Native mode keeps little-endian
numeric conversions and rejects lossy casts. This is why a `bytes32` value can mean different bytes in the two
modes even though the source spelling is the same.

**Events.** A scalar event argument is written in EVM's standard notation when `evmCompat` is on, so an Ethereum
decoder can read it. Native events use the platform frame.

These differences matter at the boundary between contracts. An ABI word, a selector, or a `bytesN` value produced
under one mode can be unreadable under the other.

### 7.3 What does not change

The mode does not create EVM behavior. These remain Bitcoin Cash rules in both modes:

- There is no gas accounting and no nested EVM call stack.
- `msg.sender` and `msg.value` have Bitcoin Cash meanings.
- `try`/`catch` cannot recover from a failed script; a failed participant invalidates the transaction.
- There are no EVM logs, log blooms, or revert-data transport.
- `address` is still variable-length locking bytecode. Use an explicit `uint160` at an EVM wire boundary.
- Inline assembly support is a documented subset.
- Covenant safety rules are unchanged, including the rule that every spending path must contain a verification
  or a state change.

### 7.4 Practical advice

- Use `evmCompat` for imported Solidity projects and EVM wire compatibility.
- Use native mode for Bitcoin Cash-first contracts that want exact locking-script addresses and strict rejection
  of lossy casts.
- Keep one ABI boundary in one mode. Selectors, address forms, and result encodings differ between modes.
- Treat the artifact, not an EVM ABI copied from another build, as the deployment truth.
- Read the compatibility warnings. They usually point at places where EVM intuition and Bitcoin Cash behavior
  diverge.

---

## 8. The logical blocks

The repository can be divided into twenty logical blocks. Each block has a clear responsibility and a small number
of interfaces to its neighbors.

| ID | Block | What it owns |
| --- | --- | --- |
| B01 | Workspace and release | Package graph, build, versioning, source-tree hygiene |
| B02 | Language front end | Reading source, parsing, imports, syntax tree |
| B03 | Types and semantic model | Type rules, symbols, storage layout |
| B04 | Compiler pipeline | Ordering the transformations that prepare a program for code generation |
| B05 | Code generation and optimization | Bitcoin Script output, source maps, bytecode optimization |
| B06 | Artifact model | The published description of a contract |
| B07 | Composition in the compiler | Direct, message-bus, and framed compilation strategies |
| B08 | Splitting and size management | Fitting large contracts under script-size limits |
| B09 | Shared protocol library | Canonical encodings and formats used by compiler and runtime |
| B10 | Stateless SDK | Instantiating, calling, and spending simple contracts |
| B11 | Network and VM boundary | Talking to nodes and running the Bitcoin Cash VM locally |
| B12 | Stateful SDK | Deploying, calling, reading, and listening to stateful contracts |
| B13 | State storage and journal | Data tokens, entries, chunks, and final settlement |
| B14 | Lifecycle, identity, and proxies | Deploy, upgrade, destroy, split, merge, logical identity |
| B15 | Message-bus runtime | Planning and composing multi-contract transactions |
| B16 | Framed runtime | Deploying, calling, reading, and proxying framed contracts |
| B17 | Oracles and sidecars | Block data, hashing, key recovery, shared libraries |
| B18 | Project tooling | SolidHat, Hardhat compatibility, project compilation, type generation |
| B19 | Documentation and samples | Website, editor support, examples, benchmarks |
| B20 | Verification and release | Tests, conformance suites, CI, regtest, release gates |

### B01 — Workspace and release

A Yarn workspaces monorepo containing the compiler, the SDK, shared utilities, the project tooling, a project
initializer, examples, and the documentation site.

The build follows package dependencies in order. Output goes to each package's `dist/` directory. A source-tree
check prevents generated files from being committed beside source files.

The compiler version is `0.13.1` at this snapshot. Artifacts record the compiler version and a fingerprint so
applications can reason about compatibility.

### B02 — Language front end

Reads `.scash` source and, in compatibility mode, `.sol` source. It parses the language, resolves imports, records
source locations, and builds the syntax tree used by the rest of the compiler.

The grammar is the source of truth. The parser is generated, and a hand-written builder turns the parse tree into
the compiler's own tree.

The front end also handles import safety, duplicate declarations, and the details of Solidity-style imports when
compatibility mode is on.

### B03 — Types and semantic model

Defines the language's types: integers, fixed-point numbers, bytes, strings, addresses, public keys, signatures,
arrays, mappings, structs, enums, user-defined value types, token containers, tuples, and function types.

The analysis passes assign meaning to names, decide where state lives, compute storage layout, and enforce type
rules. A key design choice is that the compiler and the SDK share one state encoding: a value written by one side
is read the same way by the other.

### B04 — Compiler pipeline

The orchestrator that decides which transformations run and in what order. The pipeline resolves imports, expands
inheritance and modifiers, lowers convenient syntax, prepares state and call handling, checks safety, and hands
the result to code generation.

Most individual transformations are small and independently testable. The ordering comments in the orchestrator
explain why each stage must follow the previous one.

### B05 — Code generation and optimization

Turns the prepared program into Bitcoin Script. It emits function dispatch, state reads and writes, event outputs,
cross-contract checks, and helper calls.

The optimizer rewrites the generated script to reduce size and cost while preserving behavior. A deduplication
pass can move repeated bytecode into a shared function. Debug information and source maps let the SDK point a
failure back to source.

### B06 — Artifact model

The artifact is the compiler's published contract. It contains:

- the contract name and constructor inputs;
- the callable interface and function selectors;
- the executable contract script;
- the state layout;
- definitions for events, errors, enums, and structs;
- call effects, external interfaces, and helper recipes;
- composition metadata;
- debug information and a fingerprint.

The artifact is the handshake between compiler and runtime. The SDK does not read source code to decide how to
build a transaction; it reads the artifact.

### B07 — Composition in the compiler

Compiles a contract for one of the three conventions. Direct entry points become ordinary functions. Message-bus
entry points become handlers inside one shared dispatch script (the route). Framed entry points become
self-recreating master programs with validators.

The compiler decides which entry points can participate, refuses shapes it cannot prove, and publishes the result.
The choice is explicit and visible in the artifact.

### B08 — Splitting and size management

Bitcoin Cash limits one input's script to 10,000 bytes. Large contracts can exceed that.

The size splitter divides a contract into a root that owns the state and one or more separate code contracts
(called facets). A moved function becomes a forwarder, and the SDK routes the call to the right facet.

A per-function split is specified but postponed. It would give each entry point its own framed master.

Splitting is explicit and measured. The compiler compiles each candidate and checks the real byte size rather
than estimating from the syntax tree.

### B09 — Shared protocol library

The small package that both compiler and runtime depend on. It defines:

- the artifact format and ABI vocabulary;
- the type system;
- the state encoding used on chain;
- hashes, script utilities, and source-map helpers;
- message-bus and framed wire formats;
- optimization rules and bytecode outlining;
- fingerprints and shared capability descriptions.

It imports neither the compiler nor the SDK. It is the common language both sides speak.

### B10 — Stateless SDK

The classic contract API. A `Contract` object represents a deployed or deployable contract: it derives the address,
encodes constructor arguments, and exposes one unlock function per ABI function. A `TransactionBuilder` assembles
inputs, outputs, change, fees, and signatures, then sends the transaction.

Signers and signature templates handle key management. Network helpers gather coins. Optional export formats
support debugging and wallet integration.

### B11 — Network and VM boundary

The SDK's only external side-effect boundary. A network provider answers questions about UTXOs and broadcasts
transactions. Implementations cover Electrum servers, a local mock network, Bitcoin Cash node RPC, and a regtest
setup.

The same area creates the local Bitcoin Cash virtual machine used by the SDK for simulation and preflight. Consensus
limits come from the provider so the SDK can distinguish "invalid" from "valid but non-standard."

### B12 — Stateful SDK

The runtime for contracts that keep state. It supports:

- deploying a new contract and minting its state tokens;
- connecting to an existing contract by category or address;
- calling functions, including batched calls;
- reading state, entries, balances, and containers;
- querying events and subscribing to new ones;
- managing external contracts, libraries, and child contracts;
- lifecycle operations: upgrade, destroy, split, and merge;
- auto-derivation of transaction shapes.

The pending-call API hides most of the machinery. A developer writes a call and sends it; the SDK discovers the
rest.

### B13 — State storage and journal

Implements the physical state model:

- a master token that identifies the contract and authorizes changes;
- data tokens for fixed fields and length headers;
- entry tokens for mappings;
- chunk tokens for large values;
- event tokens for emitted events;
- return tokens for call results;
- token and satoshi containers for assets the contract holds;
- helper contracts for oracles and expensive computation.

The journal is the compiler's strategy for one function execution. Reads see earlier pending writes, helpers share
the same values, aliases are merged, and the final state is written once. The contract then checks the replacement
outputs.

### B14 — Lifecycle, identity, and proxies

Handles the operations that change a contract's life: deploy, upgrade, destroy, split state across threads, and
merge threads back together.

Identity is more subtle than one address. A logical contract can span facets, proxied implementations, or split
programs. The SDK resolves a logical identity from categories and small identity tokens rather than assuming that
one address equals one script.

Proxy support follows the OpenZeppelin model in spirit: a stable proxy holds the state and forwards calls to an
implementation whose storage layout is compatible.

### B15 — Message-bus runtime

The runtime for the shared-manifest convention. It plans a graph of participants and calls, encodes the shared
description, builds the physical transaction, resolves layout, combines resource requirements, and runs a final
local simulation before sending.

This is the multi-contract counterpart of auto-derivation: the graph and planning queue discover the shape,
composition materializes it, and preflight checks it.

### B16 — Framed runtime

The runtime for the framed convention. It covers deployment, calls, read-only calls, receipts, send ordering, and
proxies.

Its composer derives a composition depth-first and resumes from saved stop points. Each execution fills one missing
witness, then continues. A settlement check ensures that the chain of state records from input to output is
consistent.

Reads run as static frames and are evaluated locally without broadcasting. Sends whose resources overlap are
ordered through a queue.

### B17 — Oracles and sidecars

Bitcoin Cash scripts cannot read the current block header or compute Keccak or public-key recovery directly.

- The block-info oracle publishes block fields in a shared token.
- The blockhash oracle publishes one `(height, hash)` token per block.
- Keccak and ecrecover helper contracts ("sidecars") compute results in their own inputs and commit them for the
  caller to verify.
- External libraries let a contract load shared code from a helper contract.

Each follows the same pattern: the compiler publishes a recipe, the SDK builds the helper, and the contract binds
the arguments and reads the result.

### B18 — Project tooling

SolidHat is the recommended project environment. It provides a runtime shaped like Hardhat (a popular Ethereum
development environment), a project compiler with caching, TypeScript bindings, network helpers, test matchers, a
migration path for existing Hardhat projects, and a project initializer.

The goal is to let a team keep familiar workflows while compiling to Bitcoin Cash.

### B19 — Documentation and samples

The documentation website is the user-facing reference: language guide, SDK guides, compiler notes, and release
information.

The repository also contains a VS Code extension, runnable examples, and benchmark corpora. The corpora are used
to measure compatibility, size, and performance.

### B20 — Verification and release

The project uses unit tests, end-to-end tests, conformance suites, a regtest stack, corpus runs, and release gates.

Conformance tests compare expected Solidity behavior against actual Bitcoin Cash execution. Release gates check
packaging, generated projects, docs snippets, security properties, and application examples.

---

## 9. How the pieces fit together

The dependency direction is simple:

```
shared utilities
   -> compiler
   -> SDK
   -> project tooling
```

The compiler depends on the shared utilities. The SDK depends on the shared utilities and on a small, browser-safe
slice of the compiler runtime. The project tooling depends on the compiler, the SDK, and the shared utilities.

Two boundaries matter:

- **Browser safety.** The browser bundle must not load the Node-only compiler. A separate runtime entry point
  exposes only the framed runtime pieces an application needs.
- **Load cost.** Stateful, message-bus, framed, oracle, and wallet-connect features are separate package entry
  points. Importing the root package does not load those graphs.

---

## 10. Cross-cutting design ideas

### The chain is the authority

Every composition feature is a covenant protocol. The SDK proposes a transaction; the scripts accept or reject it.
There is no coordinator, no trusted relayer, and no runtime component in the trust base.

### Fail closed

Unsupported shapes become named refusals: an unknown composition convention, a split shard over budget, an
ambiguous storage alias, a call shape the bus cannot represent, or a missing capability. The compiler tries
several strategies before refusing, but it does not silently emit a weaker contract.

### Determinism

Values have one encoding. State has one layout. Artifacts have stable fingerprints. Compiler caches are keyed by
source content and compiler content. This is what makes off-chain derivation reproducible.

### Ordering and concurrency

One state UTXO can be spent once. Composition therefore serializes where resources overlap and allows concurrency
where they do not. The message bus uses a planning queue; framed sends use a resource queue; threads partition
state to create real concurrency.

### Size and cost

The hard limits are the 10,000-byte script limit, the 100,000-byte standard transaction limit, the 1,000,000-byte
consensus transaction limit, the 128-byte token commitment, and the operation-cost budget. The design responds with
splitting, deduplication, dense packing, chunking, and helper contracts. Size is measured, not estimated.

### Compatibility is fenced

Solidity compatibility, legacy message-bus routes, legacy counters, and pre-merge artifacts are explicit,
named compatibility paths. They are not widened by new features.

---

## 11. Security in plain terms

- A stateful contract is identified by a token category and a self-pinned master token. The address commits to the
  category, the code, and the constructor arguments.
- Ordinary calls preserve the master token. Lifecycle operations deliberately change that rule.
- State changes are proved by replacement outputs. The journal is an internal execution strategy; the contract
  checks the final result.
- A cross-contract call is a co-spend. Each participant checks the same description or transcript.
- In the direct convention, `msg.sender` is not authenticated as an account. Use a signature check or the framed
  convention when caller identity matters.
- The framed validator is the security core. It is checked against a second, independent implementation.
- The repository contains several audit reports. Treat them as evidence about specific commits, not as a
  substitute for reading the current code.

---

## 12. Where to start

| Goal | Start with |
| --- | --- |
| Understand the language | `website/docs/language/` |
| Understand the compiler | `packages/solidc/src/compiler.ts`, then the `semantic/` directory |
| Understand the artifact | `packages/utils/src/artifact.ts` |
| Understand state storage | `website/docs/language/storage-model.md`, `packages/utils/src/state.ts` |
| Understand auto-derivation | `website/docs/sdk/auto-derivation.md`, `packages/solidcash/src/stateful/` |
| Understand mappings | `website/docs/language/verified-mappings.md`, `packages/solidcash/src/stateful/SortedList.ts` |
| Understand `evmCompat` | `website/docs/compiler/solidity-import-compat.md`, `website/docs/language/abi-encoding.md`, `SOLIDITY_COMPATIBILITY_0.14.0.md` |
| Understand the message bus | `website/docs/guides/message-bus.md`, `packages/solidcash/src/message-bus/` |
| Understand framed composition | `docs/framed/` and `packages/solidcash/src/framed/` |
| Work on tooling | `packages/solidhat/`, `packages/testing/` |
| Run and verify | package `vitest.config.ts` files, `scripts/`, `.github/workflows/` |

---

## 13. Current limits and open edges

- The release is best treated as a mocknet beta for marketplace-scale applications. Some contracts exceed real
  per-input script limits and are exercised on a relaxed mock network.
- Size splitting is shipped. The per-function split is specified and postponed.
- Solidity compatibility covers a large, documented subset. Unsupported EVM behavior is rejected, not emulated.
- Legacy message-bus routes, legacy counters, and pre-merge artifacts remain for compatibility.
- The root-level handoff documents describe past investigations. The source tree, current tests, and current
  artifacts are the authority.
