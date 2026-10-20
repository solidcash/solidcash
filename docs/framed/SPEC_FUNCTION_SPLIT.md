# Function split (`split: off | size | func`)

Status: **postponed until after the beta.** Written 2026-10-12 so the work can resume without re-deriving it.
No item in this document is in the beta cut. That includes the flag, view and pure facets, salted locks,
internal-function shards, and every change to the message bus or to framed call composition.

The beta ships the code as it is. Size split stays `compileFileSplit` / `compileStringSplit` and the boolean
`solidc --split`. A framed contract stays one master program, one lock, and an interchangeable pool with an
empty commitment. R8 stays: a master is its category plus minting capability, its code is its lock, and a
commitment is not an identity.

## 1. First principles

Bitcoin Cash has no `CALL`. A cross-contract call is two inputs of one transaction. Each input runs exactly
one redeem script. The script that runs is the locking bytecode of that input. Everything else — a selector, a
route, a facet, a master pool — is a convention for choosing which script that lock commits to, and for
agreeing what the other input checked.

Three conventions are shipped. Each one already chose a different answer to "what is one contract's code".

### 1.1 Direct

`website/docs/language/cross-contract-calls.md` defines the target address as the callee's master locking
bytecode. The caller checks that the co-spent input's locking bytecode equals that address, then checks the
selector and the arguments against that same input. One stored `address` is one script. `ICounter(counter).add`
and `ICounter(counter).count` are the same lock, and the selector picks the function inside it.

A participant on this path is one state-owning script. Spending it twice, or a cycle, cannot be two spends of
one state UTXO. That is the problem the message bus exists to solve (`website/docs/guides/message-bus.md`).

### 1.2 Message bus (kernel row loop)

The bus does not add a call opcode. It adds one shared manifest and one route script per participant. The
route wrapper, selector `53434231`, is the only layout owner. Every admitted handler is an `OP_DEFINE` body
inside that one script (`message-bus.md`, "Admission and limits"). `artifact.bytecode` is that script.
`artifact.messageBus` describes it: admitted handlers, the deployability certificate against the 10,000-byte
P2SH limit, and one `KernelExecutionPlan` digest per handler pushed into the same bytecode
(`packages/utils/src/artifact.ts`).

A call row names a participant and a selector. The participant's one route dispatches the selector. Caller
authentication publishes `auth: 'input-bytecode'`: the subject is the locking bytecode of the participant
input (`CallsiteCallerIdentityAbi`). The participant is still one script.

Delegate execution is refused on this path with `atomic-delegate-context-unpreservable`
(`packages/solidc/src/compiler.ts`, the admission around the delegate-context check). A delegate input does
not own the participant block it writes. The size splitter therefore compiles the root with `messageBus: false`.
A moved entry is a `delegatecall` forwarder, and the bus cannot represent it. Facet bodies are delegate
entries, so the same refusal applies to them. A contract that needs the bus for a cycle or a repeated callee
cannot be size-split onto that bus. That hole is shipped. Function split must not widen it by accident.

### 1.3 Framed

Framed already separated the address from the code lock. `address(this)` is `addrV(category)`, shared by every
master of the category (`docs/framed/SPEC_FRAMED_TRANSACTION.md`, R8). The executed code is
`lockX = P2SH32(code_X)`. Today `code_X` is one program: `deployMaster` installs `artifact.bytecode`
(`packages/solidcash/src/framed/deploy/material.ts`), and `requireEntry` looks up the function on that one
artifact (`packages/solidcash/src/framed/call/call.ts`). The pool is N copies of that one lock. Any free master
can run any entry, because the selector is dispatched inside the program.

The validator identifies a master by minting capability, never by lock and never by commitment
(`packages/solidc/src/framed/validator/model.ts`, `isMasterToken`). The master's own prologue recreates an
empty commitment (`packages/solidc/src/framed/master/prologue.ts`). A framed compile may still run kernel
lowering when `messageBus` is left on (`archive/docs:docs/framed/BUS_OFF_PATH.md`). The script that is deployed is the
master program, not the route. The marketplace fixture sets `messageBus: true` on framed compiles; that flag
changes lowering. It does not make the master a kernel route.

### 1.4 What function split changes

Function split changes the unit of code from the contract to the entry. After it, one contract has many
redeem scripts. The three conventions feel that change in different places:

| Convention | What is one script today | What breaks if each entry is its own script |
| --- | --- | --- |
| Direct | The address. Both functions of `ICounter` are that lock | A stored address can name only one function. Every typed call, low-level call, and `input-bytecode` check compares the wrong bytes for the other function |
| Kernel | The route. The row's selector dispatches inside it | The row has no script to dispatch in. Each shard would have to be its own participant, or the manifest has to grow a shard lock. The route's reason to exist (one program checks every handler of one state owner) is the assumption being removed |
| Framed | The master lock. The address is already the category | The pool stops being interchangeable. A call of `transfer` must spend the `transfer` lock. `requireEntry` on one `artifact.bytecode` is no longer enough |

State does not split. One category still owns one set of state UTXOs. A second script does not give a second
spend of the same state. The bus's reason to exist — one state owner, many logical calls, one manifest —
survives function split. What does not survive is "the manifest is checked by the one script that contains
every handler".

Slicing the kernel route into one route per function keeps the manifest machinery and duplicates it once per
entry. Each shard would re-check the participant block, and the 10,000-byte budget that the split was meant
to recover gets spent on N copies of the wrapper. That is the wrong machine. The framed validator is already
the hoisted checker: one generic program, masters that carry only their own entry. Function split belongs on
that machine.

## 2. Decisions

These are the answers the resume implements. They are not beta work.

1. **`split: 'func'` is a framed placement.** `composition` must be `framed`. A direct or kernel compile that
   asks for `func` fails with `SPLIT_FUNC_REQUIRES_FRAMED` and emits nothing. The kernel route is not sliced.
2. **`split: 'size'` is unchanged.** It remains the direct-convention best-fit packer
   (`state-affinity-best-fit-v2`), root bus off, one delegate hop, view and pure on the root unless the
   monolith is already over the cap. Function split does not extend it.
3. **`split: 'off'` is today's single artifact.** It is the default.
4. **The flag lands with the behavior.** The beta keeps the boolean `--split`. The enum arrives in the same
   change as the first `func` emission, so a release never advertises a mode it does not run.
5. **One shard per ABI entry** under `func`: `public`, `external`, `fallback`, `receive`, `view`, and `pure`.
   No affinity merge. Overloaded entries are keyed by selector. Name-keyed routing stays a size-split
   limitation and is not copied.
6. **`internal` and `private` are copied into every shard that reaches them.** They have no lock and no
   selector. A true internal shard exists only in the later package, and only when the copy exceeds the
   10,000-byte whole spend.
7. **A function master is found by its lock.** The redeem script pushes its selector as a salt. The NFT
   commitment stays empty. R8 and the prologue stay. A signature in the commitment is rejected by this spec.
8. **An ABI shard proves its selector locally.** The witness selector that enters `argsHash` is
   equal-verified against the selector constant in the script. A sibling master of the same category fails
   its own script when the call names a different selector. Ordinary function split does not change
   `V_TEMPLATE`.
9. **The address does not change.** Callers keep storing `addrV(category)`. They do not store a function
   lock. `msg.sender` and `address(this)` stay the framed rules in spec section 4a.
10. **A `public` shard accepts `ROOT`, `CALL`, and `INTERNAL`.** An `external` shard accepts `ROOT` and
    `CALL`. `f()` on a public function is `INTERNAL` (`msg.sender` unchanged). `this.f()` and a foreign call
    are `CALL`. An external function has no internal face. View and pure accept `STATIC` and, when the source
    calls them internally, `INTERNAL`.
11. **A func-split framed artifact does not publish an executed kernel route.** Kernel lowering inside a
    shard's body is allowed only where a monolithic framed master already uses it. The deployed bytecode of
    each shard is that shard's master program. `artifact.messageBus.available` is not how a caller finds the
    code.

## 3. What this does to the two frameworks

### 3.1 Message bus

Function split does not become a third bus convention. The resume refuses `func` unless the compile is framed,
and it leaves size-split's `messageBus: false` root as it is.

The effect to watch is the one that already happens on a framed marketplace compile: `messageBus: true` runs
kernel lowering in front of framed codegen. A shard must see the same lowering a monolithic framed master
sees for the statements that remain in the shard, and it must not inherit a route wrapper. The checkable
form is in FS-4.

A contract that needs a shared manifest for a cycle still uses the framed validator (V5, V6, V8), not a
kernel participant block. If a later release retires the kernel, that is a separate decision. This spec does
not slice `kernel-row-loop`, does not add a shard lock to the call manifest, and does not teach
`input-bytecode` authentication to mean "one of several locks".

### 3.2 Framed composition

Today a call names `(artifact, functionName)`. The SDK spends any master at the single lock. After `func`:

- The artifact is a bundle: one logical ABI, one state layout, one category, and one master program per entry.
- Deployment mints a pool per entry, at that entry's lock, commitment empty. `split(n)` and `merge(n)` take
  an entry selector as well as a count. A copy of `transfer` does not serve `approve`.
- `classifyFramedDeployment` still treats every minting NFT as a master. A second grouping, by published
  lock, chooses the function. The classifier does not read the commitment.
- The call spends a master whose lock is the published lock for that selector. The shard's head checks the
  witness selector against its salt.
- A proxy fallback delegatecalls the shard for the selector in the calldata, not a single implementation
  bytecode. `delegateArtifact` becomes per entry. The proxy address stays the state holder's `addrV`.
- Internal copies do not add a frame. A `public` call `f()` from another shard of the same contract is an
  `INTERNAL` frame on `f`'s master (decision 10), once package FS-6 says the body is not inlined. Until
  then, `f()` whose body was copied runs inline and does not spend `f`'s master.

View and pure are ordinary entries here. Each gets a shard and a pool. The cost is genesis outputs and
concurrent copies, not bytecode. A resume that special-cases them back onto a shared script has left this
spec.

### 3.3 Direct calls and size split

Left alone. A direct `address` remains one locking bytecode. Size split remains the way a direct contract
fits under 10,000 bytes when its closures pack. A direct contract whose kernel route is over the cap is not
made deployable by `split: 'func'`, because `func` does not compile on that convention. Recording that limit
is part of the resume (FS-2), so a later reader does not "fix" Marketplace-sized routes by slicing them.

## 4. Shard contents

An ABI shard contains:

- the framed master prologue for the category (ownership, recreation, empty commitment);
- the selector salt and the local equal-verify against the witness selector;
- the one entry body;
- the internal and private functions reachable from that body, copied;
- the framed head and tail for the frame kinds that entry accepts.

It does not contain another entry's body, a kernel route wrapper, or a user-facing dispatcher of sibling
selectors.

An internal or private function that is only copied has no shard. The later cut (FS-7) gives it a master
only when a measured caller is over the whole-spend cap. That master accepts only `kind == INTERNAL`, has no
ABI row, and is not reachable by a user spend. Binding it to the caller's expected lock is a validator
check. Same-category equality does not pin which internal master ran, because every shard shares the
category. That package is the one that may change `V_TEMPLATE`, and it is last.

## 5. Artifact

`split: 'off'` returns `Artifact`, as `compileString` does today.

`split: 'size'` returns today's `SplitArtifactBundle` (`format: 'solidcash-split-v1'`, algorithm
`state-affinity-best-fit-v2`).

`split: 'func'` returns a bundle the resume can version without pretending it is a size split:

- `format: 'solidcash-split-v2'`
- `algorithm: 'per-entry-v1'`
- `composition: 'framed'`
- one logical ABI and one `stateLayoutFingerprint`
- one shard record per ABI entry: selector, function name, accepted frame kinds, redeem script, lock, whole-spend
  bytes
- `internalCuts`: empty unless FS-7 added a helper shard
- no `messageBus.routeInBytecode` on the logical artifact

A size-split bundle is not a v2 bundle. Tooling branches on `format`.

## 6. Resume order

Every box below is after the beta. FS-0 is the fence a resume re-checks before writing code. FS-1 through
FS-3 are the compiler and the artifact. FS-4 is the bus fence. FS-5 and FS-6 are deployment and calls. FS-7
is the internal shard and the only validator edit. An item is done when its check is true, not when the code
compiles.

### FS-0. Beta fence

- [ ] **FS-0.1** The beta branch has no `split?: 'off' | 'size' | 'func'` on `CompileOptions` or
  `SplitCompileOptions`. `solidc --split` is still a boolean.
- [ ] **FS-0.2** `compileStringSplit` still packs with `state-affinity-best-fit-v2` and still sets the root's
  `messageBus: false`.
- [ ] **FS-0.3** A framed master prologue still requires an empty commitment, and `isMasterToken` still
  ignores lock and commitment.
- [ ] **FS-0.4** This file is the resume point. No package below is started on the beta branch.

### FS-1. Flag, framed only

- [ ] **FS-1.1** `SplitCompileOptions.split` accepts `'size' | 'func'`, default `'size'` so existing
  `compileStringSplit` callers keep today's packer. `CompileOptions.split: 'off'` is the ordinary
  `compileString` path. A bare boolean is a compile error at the type level.
- [ ] **FS-1.2** CLI `--split <off|size|func>`. A bare `--split` is an error that names the three values.
  `--split size` reproduces today's `--split` output. `--split off` reproduces a normal artifact.
- [ ] **FS-1.3** `split: 'func'` with `composition` omitted or not `framed` throws `SPLIT_FUNC_REQUIRES_FRAMED`
  before any shard is emitted. The diagnostic names the convention it saw.
- [ ] **FS-1.4** `split: 'size'` with `composition: 'framed'` is refused by name. Size split stays a direct
  packer. The two modes are not stacked.

### FS-2. One shard per entry

- [ ] **FS-2.1** For a framed contract under `split: 'func'`, the bundle has one shard for every `public`,
  `external`, `fallback`, `receive`, `view`, and `pure` entry, including when the monolithic program is under
  10,000 bytes.
- [ ] **FS-2.2** Two overloads of one name produce two shards, distinguished by selector. The size-split
  overload refusal is not reused.
- [ ] **FS-2.3** Each shard's redeem script contains that entry's body and the internal closures it reaches,
  and contains no other entry's body. A byte test on a two-function fixture shows each sibling's selector
  constant absent from the other shard.
- [ ] **FS-2.4** A shard whose whole spend exceeds the cap fails with `SPLIT_CLOSURE_CAPACITY` and the
  existing helper-cut profile. No internal shard is emitted in this package.
- [ ] **FS-2.5** The logical state layout is identical across shards and identical to a monolithic framed
  compile of the same source (`assertSplitLayoutsAgree`'s check, applied to v2).
- [ ] **FS-2.6** A direct contract over 10,000 bytes is not offered `func` as a remedy. The diagnostic from
  FS-1.3 is the whole answer. A note in the size-split docs states that an over-cap kernel route is outside
  function split.

### FS-3. Salted lock, empty commitment

- [ ] **FS-3.1** Each shard's redeem script pushes its selector and equal-verifies it against the witness
  selector used in `argsHash`. The v2 record publishes that selector and the P2SH32 lock.
- [ ] **FS-3.2** Genesis and every recreation mint the shard with `commitment: ''`. A non-empty commitment
  fails the existing prologue. No shard script requires a particular commitment.
- [ ] **FS-3.3** Swapping two shards' unlocking scripts onto each other's UTXOs fails in the swapped script's
  selector check. The validator program bytes are unchanged. A fixture records both the accept (matching
  lock) and the refuse (swapped lock).
- [ ] **FS-3.4** `isMasterToken` and R8's text stay capability-only. A test that a minting NFT with a
  non-empty commitment is still classified as a master, and is still rejected by the prologue, pins both
  halves.

### FS-4. Message bus left intact

- [ ] **FS-4.1** A `func` bundle's executed shard bytecode contains no kernel route wrapper (selector
  `53434231` is not the shard's entry) and no `kernelExecutionPlans` marker. `messageBus.available` is absent
  or false on the logical artifact.
- [ ] **FS-4.2** `split: 'size'` still compiles its root with `messageBus: false`, and a delegate entry is
  still refused with `atomic-delegate-context-unpreservable` when a bus route is requested for it. A
  regression fixture covers that refusal so function split cannot "fix" it by slicing the route.
- [ ] **FS-4.3** A framed `func` compile of a two-contract call that is a cycle uses the framed validator.
  The resulting transaction has no kernel verifier input and no message envelope. The machine accepts the
  matching shards and refuses a spend that uses the caller's shard as the callee.
- [ ] **FS-4.4** `CallsiteCallerIdentityAbi.auth: 'input-bytecode'` is unchanged. No new auth mode names a
  set of locks. A grep of the kernel manifest schema shows no shard-lock field.

### FS-5. Pools and discovery

- [ ] **FS-5.1** Genesis mints `poolSize` masters at each entry's lock, commitment empty, same category.
  The logical address of every shard is the one `addrV(category)`.
- [ ] **FS-5.2** `classifyFramedDeployment` still returns every minting NFT in `masters`. A new grouping
  `mastersByLock` (name fixed at implementation, documented on the type) partitions them by the v2 lock
  table. A monolith deployment yields one group.
- [ ] **FS-5.3** `split` and `merge` take the entry selector. Minted and burned outputs use that entry's
  lock. A merge of `approve` leaves the `transfer` pool unchanged.
- [ ] **FS-5.4** A call whose function pool is empty fails before a transaction is built, and the error names
  the function. It does not borrow another function's master.

### FS-6. Calls, views, proxies

- [ ] **FS-6.1** `requireEntry` on a v2 bundle resolves the shard by selector and spends that lock. A
  monolithic framed artifact still spends its single lock. Both paths are tested.
- [ ] **FS-6.2** A `view` shard and a `pure` shard are deployed and called as `STATIC` frames. A user
  `ROOT` spend of a view shard is accepted when the source allows an external view call, and the frame
  writes nothing. The validator's V10 read-only check is unchanged and still passes.
- [ ] **FS-6.3** `this.f()` on a public function is a `CALL` frame on `f`'s master (`msg.sender` is
  `address(this)`). `f()` from another entry, while `f`'s body is still copied into the caller, runs inline
  and does not spend a second master. A fixture shows one master input for the inline case and two for
  `this.f()`.
- [ ] **FS-6.4** An `external` function's shard rejects `kind == INTERNAL`. A public shard accepts it.
- [ ] **FS-6.5** A proxy fallback that forwards calldata spends the implementation shard whose salt matches
  the selector, as a `DELEGATE` frame on the proxy's records. A selector with no shard fails closed. The
  proxy's address is unchanged.
- [ ] **FS-6.6** A foreign contract's typed call stores and checks `addrV`, not the function lock. The
  co-spent input is the callee's function master. The caller's script does not embed the callee's shard
  table.

### FS-7. Internal shards, last

Start only after FS-3.3 is green. This is the only package that may edit the validator.

- [x] **FS-7.1** A helper is cut out only when its caller's measured whole spend is over the cap and the
  helper's own profile is a legal cut (the profile `splitHelperCutProfiles` already computes: returns,
  state, external calls). The cut shard accepts only `INTERNAL`.
- [x] **FS-7.2** A user `ROOT` or `CALL` spend of that shard fails in the shard. The shard has no ABI route
  and no published selector in the logical ABI.
- [x] **FS-7.3** The caller's call record names the helper lock. The validator rejects a same-category master
  whose lock is a different shard. A fixture swaps two helper masters and expects a validator refusal.
- [x] **FS-7.4** If FS-7.3 cannot be expressed without a `V_TEMPLATE` change, the change is a new version of
  the validator program and moves `addrV`. The resume stops and reports that before merging it. A local-only
  check that does not pin the lock is not an acceptable substitute: category equality does not name the
  helper.
- [x] **FS-7.5** UnicrowClaim's `claim` closure, or a smaller fixture with the same shape (one entry whose
  copied helpers exceed the cap), is the acceptance compile. The entry shard plus its helper shards each fit
  the whole-spend cap, or the diagnostic names the helper that still does not.

### FS-8. Loader, after the pools exist

Not required for FS-1 through FS-7.

- [x] **FS-8.1** A per-function loader locks `P2SH32(loader)` whose script pushes that function's code hash
  and selector. Locks differ per function. The commitment stays empty. One loaded copy per distinct function
  serves every master of that function in the transaction.
- [x] **FS-8.2** A single shared loader lock, with the function id only in the witness or the commitment, is
  rejected. Discovery at rest stays a lock comparison against the v2 table.

## 7. Out of scope

- Any of FS-1 through FS-8 on the beta branch.
- Putting a function signature or a selector in the master NFT commitment.
- Slicing `kernel-row-loop` into per-handler routes, or adding a shard lock to the message manifest.
- Stacking `func` on size-split delegate facets.
- Nested delegate, facet upgrade, and a mutable implementation pointer.
- Changing R8, `isMasterToken`, or the empty-commitment prologue.
- A special case that leaves view and pure on a shared root under `split: 'func'`.
