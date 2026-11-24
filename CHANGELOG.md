# Changelog

## 0.52.0

### Security

- An expression-form delegatecall, `(bool ok, bytes data) = impl.delegatecall(input)`, was not pinned to its
  implementation (DELEGATE-1, in 0.51.0 and 0.51.1 and, by reading, 0.50.x). A spender could co-spend other code, or
  none, and set the calling contract's state at will. It is now pinned as the statement form `impl.delegatecall(input);`
  always was. A contract that uses the expression form compiles to new bytes: recompile and redeploy it. The same pin
  now covers the forwarder through which a split contract's read-only function returns from its facet. The statement
  form, library calls and the SDK's default proxy were not affected.
- A co-spent callee stood for a 20-byte identity whenever its lock projected to it (TARGET-7, in 0.51.0 and 0.51.1).
  A P2SH20 lock carrying the HASH160 of a contract's P2SH32 lock projects to that contract's identity, and anyone can
  spend it with the contract's public redeem bytecode. So a spender could answer a call in the callee's place, with no
  miner, where no selector is bound: a typed call through a one-method interface, and the `call` and `delegatecall`
  checks. A raw 20-byte or zero-padded 32-byte lock, which a miner can include, matched too. A co-spent callee now
  stands for a 20-byte identity only as a P2SH32 lock or a P2PKH lock; an address the caller holds keeps every form,
  and a P2SH20 contract is called through its lock. The check is in every `evmCompat` build that calls through such an
  identity, and in a native low-level call's 20-byte target branch. Those contracts compile to new bytes: recompile
  and redeploy them.
- A message-bus graph route took a call row's callee to be whatever lock the spender laid out at the callee's slot,
  when that lock projected to the call's 20-byte target identity (TARGET-7 in a graph route, in 0.51.0 and 0.51.1).
  Under `evmCompat` every graph call compares by identity, so a P2SH20 lock carrying the HASH160 of the callee's
  P2SH32 lock, which anyone can spend, could answer any call a route makes with a result no contract computed. The
  row's lock now stands for an identity only as a P2SH32 or a P2PKH lock. A contract whose message-bus route makes
  external calls compiles to new bytes: recompile and redeploy it.
- An event NFT could be replayed in the SDK's reads (EVENT-REPLAY-1, in 0.51.1 and earlier). After its 144-block
  relative lock anyone may spend an event NFT and recreate it unchanged at the event address, and `queryFilter`,
  `queryEvents`, `on()`/`once()` and `readEventsFromChain` counted the copy as a new event, so an application crediting
  deposits from events could credit one twice. A read now counts an event NFT only when the transaction that created
  it spent the contract's minting master (an emit recreates it, a selfdestruct burns it). No covenant or address
  changes. Reading events now needs the provider's `getRawTransaction` for those transactions; a provider that cannot
  serve one (a node without a transaction index) makes the read throw `EventProvenanceError`.
- A call through a local copy of a stored target could go to another contract than the EVM calls (TARGET-6 leftovers,
  in 0.51.0 and 0.51.1). After a write of the stored value, a call through a copy taken before it (`IToken t = token;
  token = other; t.f()`, or through a field of a memory copy of a stored struct) went to the written value; and under
  `evmCompat`, a mapping entry's field written under one key and called through under another
  (`book[j].token = t; book[k].token.call(..)`) went to the old value even when `j == k`. Such a call now reads the copy
  where it runs. Only functions with such a write compile to new bytes; none in the repository's corpora does.
- Two caller contracts in one transaction making the same direct call could both accept the callee's one run (in 0.51.1
  and earlier): a call record named the call it answered but not its caller, so one withdrawal could be credited twice.
  A record now names its reader's input, so one record answers one caller. A void call through an interface naming
  several methods now reads its callee's record instead of a selector check. Callers and callees must be compiled
  with this version together: the SDK refuses a call mixing them with earlier artifacts
  (`MixedCallRecordReaderError`). Contracts with direct calls or call records compile to new bytes.
- A direct call passing fewer arguments than its method declares (`getAndIncrement()` for `getAndIncrement(pubkey,
  sig)`) did not bind which method its callee ran through a one-method interface (in 0.51.1 and earlier). The
  arguments it leaves are now digested with the named ones, from witnesses the SDK fills.
- A typed call that pays value, `t.deposit{value: v}(x)`, to a stateful callee paid v to the callee's contract lock,
  which no function of it can spend, and the callee credited whatever its container gained: the value was bound to
  nothing (in 0.51.1 and earlier). The SDK refused such a send, so honest calls did not build, but a hand-built one
  burned the caller's value. The callee's record now binds the value it received, the caller pays from its own
  container into the callee's container, and a value call to a function that takes no value is refused. A value
  call in a loop, through a pointer or a runtime selector, or to `msg.sender` is refused at compile time
  (`CALL_VALUE_UNBOUND`). A low-level `call{value:}` to a stateful contract still pays its lock: send value to a
  stateful contract through a typed call.
- In a composed message-bus transaction a spender could rewrite any record of a participant that no handler of the
  run touched, by declaring it in a resource row of the verifier's manifest (COMPOSE-RECORD-1, CRITICAL, in 0.51.1 and
  earlier): once a route's verifier ran, the route treated its whole block as claimed. This held for ordinary, graph and
  proxy routes. A route now holds every record of its block except those the rows that ran may write.
- A message-bus route run without its verifier left records unheld at slots its rows claimed but did not use, so a
  spender could rewrite or burn them, and a node of a mapping a handler manages could be minted with no input (in
  0.51.1 and earlier). Rows now claim only what they may write, and each such collection's nodes must equal its inputs
  plus the inserts of the run. A route handler that takes no parameters and writes dynamic state now gets the
  dynamic-write base check every other writer gets. Contracts with message-bus routes compile to new bytes.
- A contract run that settled no call record of its own refused a record carrier of its category beside it only when
  the contract had an entry returning values (in 0.51.0 and 0.51.1). In a contract whose entries are all void, a
  spender could run an entry that settles no record, such as one reading another contract's storage, beside a caller
  of another of its methods, and place a carrier with the digest that caller reads, minted in the run or moved from an
  earlier call: the caller credited a method its callee never ran. Every run that settles no record now counts the
  carriers of its category, records and edges, to the edges it pinned; a message-bus route counts them to its own
  result carrier. Stateful contracts compile to new bytes: recompile and redeploy them.
- A returning call on an element of a state array read its call record by digest but never checked that the record
  was its callee's (CRITICAL, in 0.51.1 and earlier): a record minted in any other category, with the honest digest and
  any result, was accepted, so a caller credited whatever the forger wrote. Each element's record must now carry the
  claimed callee's category.
- More calls could let two callers credit one callee run (in 0.51.1 and earlier): a call through a function pointer
  or a selector table, a raw or opaque `call`, and a call in a loop over a parameter array, computed targets or a state
  array. Each now binds its callee's record to the caller's input (a raw call in a contract that keeps state pins the
  callee's reader); a stateless caller, which has nothing to credit twice, is unchanged.
- A call leaving arguments to its callee now binds its method in message-bus builds, in loops and in constructor
  calls, and a void call through a one-method interface in a message-bus build now reads its callee's record (the first
  void entry of a message-bus contract grows by about 68 bytes). Witness lists must be fully consumed, so their bytes
  cannot be changed by others.
- A message-bus route left more records unheld than its rows could write: rows with inline assembly, an `unsafe`
  tier, a lifecycle or deployment step, a chunked value, or a lane the route only reads. A spender could rewrite such
  a record beside an honest batch. Each row now holds what it does not write. A route handler with assembly that is
  not kernel-safe, a `delegatecall` or a low-level call to `address(this)` compiles direct instead.
- Value: a deployer `new{value:}` now checks the creator's container like a transfer. A value call to a function that
  takes none, below dust, or nested (A to B to C) is refused by name (`CallValueUnpayableError`), and a raw value call
  to a target the compiler can see is a stateful contract is refused (`StatefulRawValueCallError`): send value to a
  stateful contract with a typed `{value:}` call.
- A low-level call in a loop of run-time turns, or over an array of targets, is refused by name
  (`LOW_LEVEL_CALL_IN_LOOP`): one callee run would have answered every turn.

### Fixed

- A call listed with `withExternalCall()` or `withCall()` is refused by name when the calling function's guard skips
  it (`ListedCallNotMadeError`) or cannot be decided when the transaction is built (`CallGuardUndecidedError`).
  Before, the listed callee was spent and ran although the caller did not call it. A frame of a multi-call spend whose
  guard reads false is left out, as an unlisted one is.
- A low-level call made after a write of its target in the same function now pins and pays the written value, as
  the EVM calls it (TARGET-6). Before, `payee = p; payee.call{value: v}("")` paid the old payee, and
  `token = t; token.call(p)` required the old token. A call the compiler cannot read at its site is refused
  (`ENTRY_TARGET_WRITTEN_BEFORE_CALL`). A message-bus route binds such a call too. A framed or constructor call
  through a target written first is refused by name, and the SDK refuses to auto-wire such a callee. A write is
  judged by field path, so a write to another field of the same entry leaves the target current.
- A root call under a guard the SDK cannot decide, with no caller edge to guard it, is refused by name
  (`CallGuardUndecidedError`). Before, a raw call to a callee that reads no `msg.sender` was made on a guess, and the
  callee was spent with the guard false.
- A call in the right operand of `&&` or `||` inside a branch or a ternary arm now publishes the branch with its
  operand. It was published with the operand alone, so the SDK made the call with the branch false.
- The late pass refuses a call under a guard no frame can decide. Discovery refuses a looped call whose number of
  turns it cannot plan, unless a caller edge guards it.

- On the direct convention, a nested callee's external call under a false guard on `block.number` or
  `block.timestamp` no longer spends the callee. The SDK now gives the guard the block clock when it works out which
  calls a called contract makes, read from the pool coin that contract's run reads. Without it the guard stayed
  unresolved, the call was kept, and the callee was spent with its state changed. Arguments of such a call that read
  `block.number` or `block.timestamp` now resolve too.
- A called contract whose only call is conditional, and not made in a run, is now stated as not making it, as a
  root function is. Such runs were refused before, whatever the guard read.
- A keccak256 chain beside a collection walk, a dynamic-state write, a mapping loop, per-turn payments or events is
  now refused at compile time (`keccak-chain-shares-trailing-band`), as the keccak256 loop already was beside a walk
  or a write. The other run counts its coins from the block's end without the chain's side-cars, so no transaction
  could spend the function. A keccak256 loop placed after a loop over a mapping, beside dynamic state the function
  only reads, is refused for the same reason (`keccak-loop-shares-trailing-band`).
- The SDK now lays out the dynamic-state chunks a function only reads after its keccak256 side-cars, where the
  contract reads them. This covers a keccak256 chain, a keccak256 loop beside a mapping loop, per-turn payments or
  events, and either one beside a fixed sorted write. Such functions compiled but could not be spent. A keccak256
  loop beside read chunks and an external call is refused by the SDK by name.
- A called contract's call under a guard the SDK cannot decide is now refused by name before anything is sent
  (`CallGuardUndecidedError`). Before, the call was made on a guess, which spent the callee when the guard was false.
  The SDK decides a called contract's guard in that contract's own frame, with the block clock, the mapping entries
  the guard reads and the results of its earlier calls. The late pass and the delegatecall path now read the block
  clock too, and state a skipped single call as not made.
- A statement-form value call through a stored struct field, such as `split.to.call{value: v}("")`, crashed code
  generation. It now compiles and pays the field it names.
- A Solidity base constructor's parameters no longer stand in for names in the base's other functions. With
  `contract C is B(5)`, a base function whose parameter, local or state variable shared a constructor parameter's
  name read the constructor's argument: `twice(uint v) { return v * 2; }` returned 10 for `twice(3)`.
- An `evmCompat` function that makes a typed call to a contract that calls on, beside a low-level call whose stateful
  callee runs on the low-level path, now builds: the callee that discovery finds holds its call record in its own
  block. Its covenant refused such a spend at input 0.
- A compat call's stateful callee now goes through transitive discovery, so the calls it makes are found, laid out
  and decided. A compat callee that reads `blockhash(n)`, makes a low-level call with a payload, or calls a contract
  that reads `blockhash(n)` is refused by name before anything is sent; such spends failed at the VM.
- A fixed sorted-mapping insert, update or read before a keccak256 loop now builds: the loop's probe co-spends the
  entry's coin and learns the node a write pins.
- A WalletConnect wallet can sign a function of a multi-function contract: the transaction object's
  `contract.redeemScript` now carries the function body a signature inside an `OP_INVOKE`'d function covers, as the
  SDK's own signer uses. Its signatures failed NULLFAIL before (#1, @swiftbotlabs).
- `StatefulContract.split`, `merge`, and `withSplitFunding` / `withMergeFunding` funded by `Signer.external` ask the
  wallet to sign after their fee and byte gates. They broadcast the placeholder before (#7, @astrorehan, closing #3).
- A stateful entry that checks `tx.time` and then pays with `this.transfer` builds when sent with `.setLocktime()` and
  no manual `.transfer()`: the locktime's re-derivation derives the transfers too (#6, @emilpz320-a11y).
- `ContractFactory.deploy` with a signer picks a genesis coin that also covers `initialBalance` (#11, @mythos-builds).
- An entry that pays the miner from its satoshi container (`this.payMinerFee`) can be called from a wallet holding no
  coin, as documented; such an entry never spends its caller's coin (#12, @mythos-builds).
- `destroy` and `selfdestructTo` no longer wait 144 blocks after an emit: an event NFT younger than its relative lock
  stays at its address, where anyone may sweep it once the lock passes, as with any event NFT (#13, @mythos-builds).
- A framed contract can pay to `new LockingBytecodeP2PKH(...)` and the other built-in locking bytecode classes, which
  were taken for contract creations and refused. The payment compiles byte-identical to one to a hand-built lock
  (#9, @aimanmalib).
- A constructor's failing `require` is named in the deployment's refusal, with its site and error (#8, @aimanmalib).
- `MockNetworkProvider` is assignable to `NetworkProvider` under `exactOptionalPropertyTypes` (#10, @aimanmalib).
- `typegen` accepts a declaration compiled in its own file and imported by another root (#5, @samizdatproject).
- `solidhat init --no-sample` writes a README that does not point at the Counter sample (#17, @Aakash074).
- `@solidcash/solidcash` declares `@noble/curves`, which it imports; an install worked only while a 1.x copy
  happened to be hoisted (#2, @swiftbotlabs).
- On a Node that cannot load TypeScript, `solidhat init` writes the config and the deploy script as `.mjs`, which is
  their content; `solidhat deploy` also finds `scripts/deploy.mjs`, and a `.ts` config such a Node cannot load fails
  naming the fix (#2, @swiftbotlabs).
- Each compiler warning is printed once, however many entries inline its site, on every compile path, and the
  compile task no longer prints a file's warnings twice (#14, @PugarHuda).
- The WalletConnect object of an overloaded function carries that overload's function body; it carried the first
  overload's (found reviewing #1).
- A contract behind a proxy can be called by a void call through a one-method interface: its implementation now pins
  the record of the call its proxy forwarded, which binds the method and arguments it ran. Before, the implementation
  pinned none and the honest call failed closed. Implementations behind a proxy compile to new bytes (a delegate's
  void entries take the record witness and its reader); the proxy itself is unchanged.

### Added

- `setSequence(n)` on a pending stateful call sets the master input's nSequence, so `require(this.age >= n)` can pass;
  the default sequence disables BIP68 and failed every such check. Split/merge and composed calls refuse it rather
  than drop it (#4, @samizdatproject).
- `fillerUnlocker()` and `FILLER_SEQUENCE` from `@solidcash/solidcash/stateful` spend the 576-sat filler output a
  call leaves, once its 144 blocks pass (#15, @aimanmalib).
- A destroy lists the event NFTs it leaves for their relative lock in `leftBehind`, with `spendableFromHeight`, the
  height from which anyone may sweep each (suggested reviewing #13).

### Changed

- An external call in the ABI carries `conditionUnpublished: true` when it runs under a guard the compiler cannot
  write down, so the SDK can tell it from a call inside an `if` condition. No bytecode changes.
- The warning for `revert CustomError(...)` says that it fails the spend and carries no revert data; it called the
  revert "a no-op" (#16, @Aakash074).
- A struct local that is only read field by field compiles to one local per field instead of the pushdata struct
  frame, its encoder and its decoder: a two-field local drops from about 480 bytes to 8 (#18, @Aakash074). Contracts
  with such a local compile to new, smaller bytes: in the repository corpus 2 of 352 contracts (by 272 and 56 bytes),
  in the external Solidity corpus 1 of 644 files (by 108). `scalarReplaceStructLocals: false` keeps the old
  lowering.
- `solidcash/loop-call`: a typed loop whose call names its arguments now reads each target's void record, so
  `buildTypedLoopCallTransaction` fills the record base and lays out one record per target at output 1 + n + i from
  `cospends[i].record`, on a carrier of the target's token category, and `deriveTypedLoopCoSpends` builds each target's
  frame with the record's output and reader 0 (the caller) and fills that record from the target's artifact. A target
  co-spend for such a loop needs a token.

## 0.51.1

A patch release of all six packages for one fix in the SDK. The compiler changes nothing but its version, so every
contract keeps its bytecode and its address.

### Fixed

- A contract created through a deployer coin (a `new` of a stateful contract, through its `Deploy<C>`) can now be
  created from a wallet the SDK holds no key for, a WalletConnect session or a browser extension. Every such creation
  failed before, at three points:
  - `buildDeployerPreps` took the child's category from a prep whose wallet input still held the signature's
    placeholder.
  - The creation's check before broadcast verified that placeholder and refused it ("error in evaluating input index
    3: Program failed an OP_VERIFY operation").
  - A creating call given its preps still asked the signer for a vout-0 coin it never spent.

  The wallet now signs each prep and then the creation, before anything is broadcast, so a wallet that declines leaves
  nothing on chain.

## 0.51.0

All six packages move to 0.51.0 together. Source files need `pragma solidcash ^0.51.0`: a caret range on 0.x pins the
minor version, so the compiler refuses `^0.50.0`. Like 0.50, this is a beta; it has had no outside audit.

Every stateful contract on the direct convention compiles to new bytecode, so its address changes: deploy a new
category. Measured against 0.50.1, a minimal counter grows from 1,231 to 1,416 bytes and a Solidity ERC20 from 4,880 to
5,184. Stateless contracts (the repository's examples) and a framed contract without key recovery keep their bytes.

### New

- `new` of a stateful contract on the direct convention goes through a one-shot deployer coin, `Deploy<C>`, which pins
  the child's code, constructor arguments, records and value. A constructor can call other contracts, write mappings
  and arrays, emit events, publish BCMR metadata, read block fields and its token container, and receive value; a
  `new` can sit in a branch or a loop, within limits the compiler names. See
  [Contract creation](https://solidcash.org/docs/language/contract-creation).
- `pragma satoshicontainer single` keeps a contract's satoshis in one coin and `pragma tokencontainer single` each token
  container in one coin, so a call has one shape however much the contract holds. `this.payMinerFee` lets a container
  pay the fee by omission, with no owner or relayer.
- A constant-bound loop whose turns pay or emit is unrolled, so each turn has its own output.
- A direct program within 1,000 bytes of the input limit gets an outlining pass that shares its repeated spans: the
  NativeUsdt and OpenZeppelin ERC20 test ports, whose spending inputs were over the 10,000-byte limit, now fit.
- A default compile takes the direct build when the message-bus build is over the input limit, and the SDK refuses to
  deploy code that no input can spend.

### Changed

- Every arm of a direct stateful contract opens with an exact-stack check, and a contract whose records are sound
  carries a genesis-call marker (`genesisCalls` is on by default; a message-bus compile takes none).
- A raw call with a payload must co-spend its target, which runs the call; a payload naming a returning function
  (`abi.encodeCall`, `abi.encodeWithSelector(I.f.selector, ...)`) also reads the callee's record, so the caller sees a
  `false`. A plain send, with an empty payload, answers `(true, "")` only. An opaque `bytes` payload or
  `abi.encodeWithSignature` still reads no record.
- `x.call{value: v}(...)` pays its target, or is refused by name; before, the expression form paid nothing. Under
  `evmCompat`, `transfer` and `send` pay the P2PKH lock of a 20-byte address rather than a lock of the raw bytes.
- A call to a target the contract computes (a CREATE2 address, a keccak256 result) still takes the spender's witness for
  its callee, and now compiles with a `[computed-call-target-unverified]` warning.
- `ecrecoverEvm` answers `address(0)` where the EVM's precompile does (an r or s outside [1, n), an off-curve r, a key
  at infinity, an invalid v), and a refused recovery compares equal to `address(0)`.
- `new C{code, template}`, unreleased since 0.50.1, is gone: a direct `new` goes through `Deploy<C>`.

### Fixed

Each fix has a hostile test; `docs/security/security-audit-2026-10-16.md` lists them with their commits.

- A call through a target holding `address(0)` accepted whatever contract the spender co-spent. It fails now, as it
  reverts on the EVM.
- A call was bound to its target's final value, so a function that rewrote its target after the call let the spender
  choose the callee. A call is bound where it runs.
- In a loop, the callee witness of a parameter-array element and a view call's answer were the spender's to choose.
  Only a keccak256-computed loop target keeps them, with the warning above; other targets are checked or refused.
- A payment from a runtime loop, and a message-bus kernel route's payment, did not count every coin at the satoshi
  container, so a spender could drain a second container coin.
- A callee's `msg.sender` could name any contract co-spent beside it; it now names a caller whose run made the call,
  through an edge the caller pins. A direct call's arguments, and the method of a call through a single-function
  interface, are bound to the callee's run.
- A record written blind (every field written, none read) left its tag unchecked, so a sibling record could be
  duplicated.
- `m[k] = m[7] + 1` in a sorted-loop write compiled as `m[k] += 1`.
- A Solidity-compat call to a stateful callee co-spends the callee's whole block (MasterChef's deposit goes through).
- The direct path asks an external wallet to sign: preflight had skipped such inputs, so a wrong-key signature passed
  on the mock.
- A payment to a framed contract's validator address, or to a stateful master's lock, where the coin would be stuck,
  is refused.

### Known issues

- Carried from 0.50.0 and not re-checked: on the direct convention, a nested callee's external call under a false guard
  on `block.number` or `block.timestamp` spends the callee anyway, and `block.number` in a nested callee's external-call
  arguments is unresolved.
- A raw value-only send after a write of its target pays the value the target had when the function started; the SDK
  refuses to fill that callee in and asks for `withExternalCall`.
- A keccak256 chain beside a collection walk or a dynamic-state write cannot be spent, and the compiler does not refuse
  it yet.
- Refused by name rather than built: a constructor that writes its call target after the call, two calls through one
  variable reassigned between them, a payment from a direct-only message-bus participant, and a typed `{value:}` call to
  a co-spent callee.

## 0.50.1

`@solidcash/solidcash` only; the other packages stay at 0.50.0, whose `^0.50.0` ranges take it.

- A deployment's metadata probe signs with placeholders. The probe genesis, which reads a token's name, symbol, decimals
  and supply before the registry is built, is held and never broadcast, yet it asked a wallet that funds the deployment
  to sign it, so the wallet saw two geneses for one. A wallet now signs once, for the genesis that goes out; a local key
  signs the probe as before.

## 0.50.0

SolidCash's version numbers now depart from CashScript's: 0.50.0 follows 0.14.0-beta.1 and tracks no CashScript release.
Source files need `pragma solidcash ^0.50.0`, and all six packages move together.

- The framed validator is 4,906 bytes. Every framed address differs from an earlier build's, so deploy a new category.
- A facet recreates itself, so a stranger cannot sweep the coins every composition of a build shares.
- A record is named by its input if it is spent, and by its output, or kept at its index, if it is created.
- An internal helper must be of the caller's context category.
- A call takes a deployment's pools in an order of its own, and a frame leaves unspent the data records it only counts.
- A slow server or a node's refusal ends a call's plan search with that error, rather than another plan's refusal.
- A send keeps the relay rules when its provider publishes relaxed limits, as a mock and a devnet do. It had lost them, so
  a below-dust output settled there.
- A returning call that omits an argument its record binds is refused by name, where it crashed the compiler.
- A parent's local no longer resolves into a child's body when a deploy folds, and the direct path orders address keys as
  framed does.
- An external call's arguments and guards can read `block.number` on a root call.

### Known issues

- On the direct convention, a nested callee's external call under a false guard on `block.number` or `block.timestamp`
  spends the callee anyway and lands the wrong state, because the guard is not published on those paths. A false guard on
  state or a constant fails closed there. Root calls and the framed convention are not affected.
- `block.number` in a nested callee's external-call arguments is still unresolved on the direct convention.

## 0.14.0-beta.1

Release-candidate notes: see [`docs/release/0.14.0/RELEASE_NOTES_0.14.0.md`](docs/release/0.14.0/RELEASE_NOTES_0.14.0.md).
Solidity compatibility: see
[`docs/release/0.14.0/SOLIDITY_COMPATIBILITY_0.14.0.md`](docs/release/0.14.0/SOLIDITY_COMPATIBILITY_0.14.0.md).

### Supported in this release

- Solidity-style integer types and checked/unchecked arithmetic, structs, fixed and dynamic arrays, mappings,
  inheritance, modifiers, events, declared errors, ABI helpers, and the documented lowerable Yul subset.
- Stateful contracts backed by CashToken NFT commitments, including entry-backed mappings, chunked arrays,
  events, and the documented deploy, upgrade, destroy, split, and merge builders.
- The built-in proxy profile for scalar and data-NFT state, deployed through `upgrades.deployProxy`.
- A Hardhat-style project workflow through `@solidcash/testing` and SolidHat.
- Six aligned 0.14.0-beta.1 packages with verified exports, declarations, embedded-source maps, CLIs, and installation
  from release tarballs.

### Experimental profiles

- Composed external state mutation and custom delegate-forwarding shapes beyond the built-in proxy profile.
- Message-bus **kernel** composition. Shapes outside the frozen proof inventory stay fail-closed.
- Solidity source shapes outside the compatibility-manifest rows.

Experimental behavior is not part of the stable compatibility promise; construction must stop with a named
diagnostic when the required transaction shape cannot be produced.

### Kernel beta (message-bus calling convention)

- A compiler convention, not a second protocol; the envelope (`L3C1` / `L3BUS1`) and journal rules are unchanged.
- Admitted handlers compile as `OP_DEFINE` bodies behind one row-loop wrapper
  (`selector 53434231`, `artifact.messageBus.convention === 'kernel-row-loop'`).
- Executable surface is exactly `scripts/kernel-beta-manifest.json`; `yarn test:kernel-beta` is the gate.
- Beta limits: MarketplaceV1's kernel route is compile-compatibility evidence only (12,102 bytes over the
  10,000-byte per-input limit); dormant `0x11` read-carrier / dense final-flush publication is off; `split` /
  `merge` / `selfdestruct` / `unsafe(0|1)` / foreign `delegatecall` remain `KERNEL_*`.
