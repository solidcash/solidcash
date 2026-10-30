# Framed CREATE2 children at their own address (design, 2026-10-30)

Status: in progress. The child-address computation is implemented and tested (`child-address.ts`); the creator's
genesis check, the fold and the composer remain. Found while building the SushiSwap BCH web layer, whose pairs are CREATE2 children
of the factory. A SolidCash-level change for any creator and child: what the compiler emits, what the validator checks
and what the SDK composes. No contract source changes for it.

## The gap

A framed `new C{salt: s}()`, or `create2(...)`, evaluates today to an EVM identity
`X = keccak256(0xff ‖ creator ‖ s ‖ codeHash)[12:]` that the child presents as `address(this)`:

1. **X is not bound to anything on chain.** The validator skips a 20-byte `self` (`checks.ts` V11), and a child's master
   binds only the identity its own deployer baked in. Anyone can deploy code presenting a future child's `X` and spend
   what is credited to it.
2. **The child is stood up out of band.** `create2-child.ts` deploys it in its own transaction before the creator's
   call, funding the genesis with a coin minted by `provider.addUtxo`, which only a devnet or the mock can do.

## Decision

A CREATE2 child is an ordinary framed contract at its own address, as SolidCash's direct `deployFrom` already makes one:

- **Created in the creator's transaction, funded by its caller.** A token-free coin of the caller leads the
  transaction; its outpoint is the child's category `K`; the transaction mints the child's masters, validator and
  records alongside the creator's frames (the framed proxy's calling genesis is the precedent, D47).
- **At its real address.** The child presents `addrV(K)` like every framed contract, so V11 binds it and nothing can
  forge it (`K` is minted once). `create2` evaluates to `addrV(K)`, which the creator computes from `K` and the validator
  template its own validator input carries. The 20-byte identity path goes away.
- **Its code checked by the creator, against constant shard locks.** Direct `deployFrom` embeds the child's body; a
  framed child's shards are too large for that. Masters therefore stop baking their category and address: a master reads
  its category from its own token and its address from its validator's input. Every master of an artifact shard then
  has one lock whatever its category, and the creator embeds those locks (about 35 B per shard) and checks the child's
  genesis outputs against them, with the child's validator at `addrV(K)` and its records at `K`'s record locks.
- **Found the way its creator publishes it.** Discovery and uniqueness are the creator's own business, as on the EVM: a
  factory's users find its children by its events and its pair mapping, and the mapping refuses a second pair. Callers
  that predicted a pair by hashing (`UniswapV2Library.pairFor`) look it up in the factory instead.

## Work

1. solidc: masters without baked category/address (read from the own token and the validator input); constant shard
   locks published per artifact; at a CREATE2 site, the creator's check of the child's genesis outputs and `create2`'s
   value `addrV(K)`; V11 without the 20-byte exception.
2. solidcash: plan the child's genesis inside the creator's composition; remove the `addUtxo` stand-up and the identity
   registry; resolve a child from its address on chain (the coin at `addrV(K)` carries `K`).
3. solidcash planners: a loop turn whose call targets an address an earlier call of the same turn returned (a factory
   lookup, then the pair), in the hop planner, the read planner and the derivation.
4. SushiSwap: `pairFor` as the factory lookup (replacing the pair-code-hash read), parity suites and size survey on the
   mock and on a `solidcash node`.
5. Tests: genuine creation; a createPair whose genesis carries other code (refused by the creator); a frame presenting
   another category's address (refused, V11); resolution from chain in a fresh process.

## Implementation notes (2026-10-30)

**The address is computable in script.** `packages/solidc/src/framed/master/child-address.ts` leaves `addrV(K)` from
the validator input index, reading `K` from input 0's outpoint and the validator program from the co-spent validator's
redeem script (the same push `recogniseValidatorScriptAgainstReservedHash` reads). `test/framed/master/child-address.test.ts`
pins it to `validatorAddress` off chain. Two details it settles:

- `OP_OUTPOINTTXHASH` answers in `OP_HASH256` byte order, which is the reverse of a token category. The pin needs
  `OP_REVERSEBYTES` before the capability byte.
- The redeem push is `OP_PUSHDATA2` with a three-byte header, as the head's recognition already assumes.

**The identity output carries `K`.** A framed genesis leads with the authhead output, which holds a mutable NFT of
the child's category at a lock derived from the category and the deployer's owner lock (`planGenesisIdentity`). A
check over "every output of category `K`" therefore needs that lock: either supplied as a creation parameter, or a
rule that admits exactly one output at it.

**The master shard locks are not in the creator's compile unit.** They are compile-time constants of the child (its
constant-lock masters embed the validator-template hash), but a creator compiles independently. Two ways to supply
them: a first pass over creation targets in the project compiler, or the sentinel-push fill the function split already
uses for `internalHelperLocks`. The sentinel route needs no compile ordering and fails closed on a missing fill.

**Lock membership is not enough.** A record at the right lock can still hold the wrong commitment, so the factory
would mint a pair initialized with arbitrary tokens. The creator has to compute the folded `initialize` values and
check the records' commitments (the `foldedStateInit` path), which is the part that makes this a genesis replay rather
than a lock allow-list.

## Seams measured for the in-transaction composition (2026-10-30)

What a creator's transaction needs, and where each piece sits, from reading the shipped composer:

- **The coin whose outpoint is `K`.** `childAddressScript()` (packages/solidc/src/framed/master/child-address.ts) reads
  `OP_0 OP_OUTPOINTTXHASH`, so the genesis-eligible coin (a token-free coin at vout 0) must be transaction input 0.
  `callFramedEntry` places the caller among user inputs after the participants (`call.ts:3490`,
  `placeUserInputs([CALLER_ID, ...])`), so the composer has to move it to input 0, or the snippet has to scan inputs
  for the first token-free vout-0 coin. The coin is also the child's category, so the composer must know it before it
  builds any output.
- **The child's outputs.** A framed call's non-participant outputs are the draft's `trailingOutputs`
  (`composer/draft.ts:187`, assembled at `call.ts:2744`); the broadcast lays out `participantCount + trailingOutputs`
  (`call.ts:3962`). The child's genesis is a list of such outputs: `deployMaster(shard.artifact, K, validator)` per
  shard lock, one validator at `addrV(K)`, the data-NFT records at `stateRecordLockingBytecode(K)`, and the authhead at
  `authheadLockingBytecode(K)`. The records' commitments are what `deriveFramedGenesis` computes from the constructor
  (and, with a fold, from the folded call).
- **The creator's check.** The test shows what the snippet needs: the validator input's index, which the head parses
  but drops before the body (`master-head.ts:~806`). A body can re-read its own witness block
  (`readFrameHeaderScript()` over `OP_INPUTINDEX OP_INPUTBYTECODE`'s first push) to get `validatorRef` again, and then
  `childAddressScript()` leaves `addrV(K)`. The child's shard locks are not derivable in script, so they must be
  deployment-filled sentinels (the `internalHelperLocks` pattern in `split/function-split.ts:773` and
  `framed/deploy/entry-pool.ts`), with the artifact publishing the blob's offset and the SDK filling it from the
  child's prepared split (`MasterPoolDeployment.getEntryLocks()`).
- **The fold.** `UniswapV2Pair(pair).initialize(...)` is a framed external call whose target is a local holding the
  `create2` value. `LowerFramedCreate2Address` would have to record the call on the creating local and drop it, the
  `.func` shard would publish it (`composition.creates[].foldedCall`), and `deriveFramedGenesis` would run it against
  the constructor's state — the proxy deployment's `initializedProxyState` (`framed/proxy/deploy.ts:1643`) is the
  working precedent for reading a hop's state back out of its plan.
- **V11.** `checkV11` and `addressCheckScript` both skip a 20-byte `self`; removing the skip is the last step, once no
  deployment presents an identity (`create2-child.ts`, `create2-identity-registry.ts` and the `identityTarget`
  stand-up in `framed/proxy/external-calls.ts` are the paths to delete with it).
