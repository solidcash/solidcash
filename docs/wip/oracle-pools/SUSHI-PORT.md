# Oracle pools on sushi-port-node: what the SDK item must change

Status: utils and compiler ported on `feat/oracle-pools-sushi` (from `sushi-port-node` 29405c333), 2026-11-04:
`b6fcf05bc` (utils pool module), `7c24b63b0` (validator template), `3148c0cac` (per-contract output-side codegen out),
`a3396494e` (reads move to pools), `837bfe866` (compiler tests). The SDK is not ported: until it is, a block.* or
blockhash reader compiles but no SDK path deploys or calls it (the reads fail closed). The design and the master
commits are in master's `docs/wip/oracle-pools/PLAN.md`.

## What the compiler now emits

- A direct contract that reads block.* or blockhash, or creates or names the lock of a bound contract, takes
  `__oraclePool` (bytes32, `oraclePoolBinding(P)`) as its last constructor input. A creator passes its own, and
  `deployTargets[].constructorArgs` names `__oraclePool` for that input.
- A framed reader publishes `oraclePoolSlots`; `applyOraclePool` must run before any lock, address or digest is
  computed from the program. That now includes constant-lock masters (created children), which are no longer left
  unpatched.
- A direct block.* read takes a block-info coin of P (flags 0x00) at `__internal__blockOracleInputIndex`; a framed one
  takes the first such input. A blockhash read takes a live slot of P (flags 0x80) at `__internal__blockhashInputIndex`
  plus its ordinal. It answers the hash for a slot holding n, and zero for a slot of n's residue at least 256 newer.
- An entry that may enter a function-pointer pool reader publishes `indirectPoolReads`: co-spend one info coin, or
  the slot for each n, anywhere past the block, with no index.
- A direct creator publishes `createdPoolReads`. A framed creator publishes none: read the child artifacts.
- No longer emitted:
  - `blockOracleLockSlots`, `blockhashDepth`, the per-contract oracle lock and ring lock;
  - oracle pins in every function, and split copies;
  - the oracle in a framed child's genesis replay, and the `childOracleOwnerSentinel` slot.
  The SDK must stop minting per-contract oracle coins and rings, at genesis, at split and for created children.
- The framed validator template changed (`7c24b63b0`): its hash and every framed address change. The reference
  model must drop the same admission. The FRAMED_AHEAD fixture `packages/solidcash/test/framed/ahead/
  origin-gated-payout.test.ts` picked its escrow label for an address order at the old template (59b519af8).

## SDK files on the per-contract model (file:line)

- `solidcash/src/Contract.ts:4,5,372,521,522`: `blockOracleLock` and slot patching become the `__oraclePool` input.
- `solidcash/src/TransactionBuilder.ts:29,1048`: the oracle read co-spend becomes a pool info coin.
- `solidcash/src/framed/call/block-oracle.ts:3,17,30,55`, `framed/call/call.ts:320,1281,1282,1445,2013,2643,2917,
  2918,3881`: framed co-spend of the own-category oracle and the child oracle owner.
- `solidcash/src/framed/deploy/child-constants.ts:11,64,78,118,120,124,127,131,142`,
  `child-locks.ts:18,55,77,95`, `created-children.ts:19,25,42,43`, `genesis-outputs.ts:19,70,72,102,104,228,231,238,
  239`, `material.ts:13,167,168,244,245`, `stateful.ts:52,119,128,187,188,191,398`: oracle lock slots, child oracle
  minting and owner, derived locks. Apply `oraclePoolSlots` instead.
- `solidcash/src/framed/validator/reference/reference.ts:36,451,609`: the reference model's oracle admission.
- `solidcash/src/network/MockNetworkProvider.ts:7,254,258,420,421,430,432,448,450,500,519,536,537`,
  `MemCashNetworkProvider.ts:4,117,289`, `NetworkProvider.ts:68`, `RegtestNetworkProvider.ts:20,114,118,759,772,777,
  816,819,840,842,846,848,876`: per-contract keepers and owner keys become a provider default pool (master
  005f7e8cb, 81c46c883, 46b83869a).
- `solidcash/src/oracle/block-oracle-deployment.ts:4,22,24,28,30,31,34`, `block-oracle-lock.ts:3,4,12,32,35,36,45`,
  `blockOracleUpdater.ts:5-8,130-399`, `blockhash-ring-deployment.ts:4-76`, `blockhashCoSpend.ts:3,59,67,69,73`: replace
  with master's `src/oracle/pool/` (7b52f56e9, 1486fd510, 704791456).
- `solidcash/src/stateful/ContractFactory.ts:48,79,80,83,84,426,427,487,488,497,498,501`,
  `StatefulContract.ts:40,927,929,934,936,12858`, `sc-deploy.ts:41,251,252,254,256,262,273,556`,
  `sc-split-merge-builders.ts:6,33,42`, `sc-resolve-blockhash-co-spends.ts:10,64`,
  `sc-assemble-create-builder-nested-callee-block.ts:9,248`, `sc-assemble-create-builder-nested-compose-slots.ts:11,
  308`, `stateful-lifecycle-types.ts:24,26,31,33,107`: genesis and split oracle coins, ring and depth, owner keys;
  add the `oraclePool` deploy option and the pool co-spends (master 4f9668eed, 186a2ea84, e0c815f3b, 09bcabbae,
  e06bc849f, 5b75bb09d, abba1a162, 3d5e9ea0d, 651f0f025, 119f2e58c).
- `testing/src/block-oracle.ts:6,19,20,21,92,124,133,141,144`, with `node-task.ts`, `oracle-helpers.ts`, `config.ts`,
  `ethers-runtime.ts`, `network-helpers.ts`, `builtin-tasks.ts`: the devnet keeps a pool (master f02a4812a).
- These place the oracle co-spend by index and need a pool coin there. Check each:
  - `message-bus/compose-block-oracle.ts:14`, `compose-assemble.ts:25`, `compose-participant-helpers.ts:462`,
    `compose-result-topology.ts:294`;
  - `stateful/block-oracle-reader-selection.ts:8`, `participant-probe-program.ts:23`, `sc-batch-raw.ts:196`,
    `sc-build-repeated-external-batch.ts:428`;
  - `sc-complete-create-builder-nested-unlockers.ts:264`, `sc-finalize-create-builder-nested-bases-unlockers.ts:108`,
    `sc-fix-create-builder-delegate-unlockers.ts:841`;
  - `sc-load-create-builder-out-state-reads.ts:195`, `sc-materialize-create-builder-early-args.ts:194`,
    `sc-materialize-create-builder-synthetic-args.ts:159`;
  - `sc-orchestrate-create-builder-external-calls.ts:180`, `sc-resolve-create-builder-entry-abi.ts:15`,
    `stb-refreshed-unlocker-sync.ts:53`, `framed/proxy/external-calls.ts:2653`.

## Left for the SDK item to delete

- `utils/src/block-oracle.ts`, and in `utils/src/state.ts` the ring covenant, its codecs and `BLOCKHASH_MAX_DEPTH`.
- `utils/src/child-locks.ts` `childOracleOwnerSentinel`.
- `utils/src/artifact.ts` `blockOracleLockSlots` and `blockhashDepth`.
- The old-covenant cases of `packages/solidc/test/BlockOracleCommitment.test.ts`, as master's 756c6e2b2 did.
- Docs still on the per-contract model:
  - `packages/solidc/docs/block-and-transaction-properties.md`;
  - `docs/framed/SPEC_FRAMED_TRANSACTION.md` (the validator's oracle admission);
  - `docs/framed/CREATE2_IDENTITY.md` (the genesis replay's oracle);
  - `website/docs/guides/block-oracles.md` and `website/static/AGENTS.md`.
