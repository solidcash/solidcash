# Marketplace tests against in-docker BCHN: consensus relaxation

## Summary

The marketplace suite runs on the in-process mock network, which overrides five consensus limits. Stock BCHN
v29.0.0 has no command-line option for any of those limits; they are compile-time constants. The Docker Compose
stack therefore cannot run the suite with relaxed consensus rules as it stands.

This repository now carries a BCHN patch branch (`relaxed-consensus-limits`) with regtest-only options, plus
regtest fixture snapshots and time travel in the harness. Build the node with
`scripts/build-bchn-relaxed.sh` and start it with `docker-compose.marketplace.yml`.

## Compose files

The application stack (`docker-compose.regtest.yml`) keeps the stock `mainnet/bitcoin-cash-node:v29.0.0` image
and its `-upgrade12activationtime` argument. The marketplace lane uses `docker-compose.marketplace.yml`, which
runs the patched image and the seven consensus-limit options. The stock binary exits at startup with
`Error parsing command line arguments: Invalid parameter -<option>`, so the patched options belong only in the
marketplace service.

The `fulcrum` and `miner` services take no consensus arguments. The marketplace service starts only `bchn`.

## Limits the marketplace suite uses

`solidcash.config.ts` configures the `mock` network as follows:

| SDK limit | Mock value | BCHN constant | BCHN v29 value |
| --- | ---: | --- | ---: |
| `maximumInputBytes` | 10,000,000 | `MAX_SCRIPT_SIZE` (scriptSig and evaluated script) | 10,000 |
| `maximumStackItemBytes` | 10,000,000 | `may2025::MAX_SCRIPT_ELEMENT_SIZE`, aliased to `MAX_SCRIPT_SIZE` | 10,000 |
| `maximumTransactionBytes` | 100,000,000 | `MAX_TX_SIZE` | 1,000,000 |
| `maximumNftCommitmentBytes` | 10,000,000 | `MAX_CONSENSUS_COMMITMENT_LENGTH_UPGRADE12` | 128 |
| `operationCostBudgetPerByte` | 1,000,000 | `may2025::detail::OP_COST_BUDGET_PER_INPUT_BYTE` | 800 |
| `hashDigestIterationsPerByte` | 10,000,000 | `may2025::GetInputHashItersLimit` | 3.5 per byte, non-standard |

Measured marketplace shapes:

| Shape | Bytes | Source |
| --- | ---: | --- |
| Largest compiled artifact (`MarketplaceV1`, framed) | 144,485 | `docs/framed/REGTEST_AT_HEAD.md` |
| `MarketplaceDataV1` | 118,379 | same |
| Largest unlocking script on the largest lane | 133,320-135,908 | same |
| Proxy `__message_bus1` input in a 2026-10-14 trace | 303,347 | `docs/marketplace-matrix-2026-10-14-fix-results.json` |
| Published 24-input, eight-participant transaction | 94,651 | `RELEASE_READINESS.md` |
| Default state-record commitments | 4-13 | `docs/marketplace-stock-inventory-2026-10.md` |

The 24-input transaction fits the stock 1 MB transaction limit. The script, stack-item, and per-input limits are
the binding ones. A 303,347-byte unlocking script is 30x the stock 10,000-byte limit.

## Policy and capacity options the patched node supports

These change relay policy, mempool, or block capacity. They do not change the consensus limits above.

| Option | Default | Effect |
| --- | --- | --- |
| `-acceptnonstdtxn` | 1 on regtest | Skips `IsStandardTx`: the 100,000-byte standard transaction cap, post-upgrade12 scriptSig standardness, dust, and sigcheck policy. Consensus checks still apply. |
| `-minrelaytxfee` | 0.00001 BCH/kB | Rejects a value of zero; the lane uses 0.00000001 for 1 sat/kB. |
| `-dustrelayfee` | 0.00001 BCH/kB | Rejects a value of zero; the lane uses 0.00000001 for 1 sat/kB. |
| `-mintxfee`, `-fallbackfee`, `-maxtxfee` | wallet defaults | Wallet fee floor, fallback, and per-transaction cap. |
| `-blockmintxfee` | 0.00001 BCH/kB | Minimum fee rate for inclusion in a block. The lane lowers it to 1 sat/kB so low-fee deployment transactions are mined. |
| `-maxmempool` | 320 MB | Mempool memory ceiling. |
| `-blockmaxsize` | 16,000,000 | Maximum mined block size. |
| `-percentblockmaxsize` | 50% on regtest | Alternative to `-blockmaxsize`. |
| `-mocktime` | 0 | Sets node mock time; usable for harness time travel. |
| `-upgrade12activationheight` | 0 on regtest | May 2026 rule activation height. Regtest activates it at height 0. |

The patched v29.2.1 binary does not have `-excessiveblocksize` or `-upgrade12activationtime`; those belong to
the stock v29.0.0 image and its base Compose stack. `-acceptnonstdtxn` is already the regtest default. Setting
it explicitly documents the lane; it does not make an oversized script consensus-valid.

## Patched options

All seven options are accepted only on regtest. Defaults preserve production consensus behavior, so a node
started without them matches stock BCHN.

| Implemented option | Default | Enforcement point |
| --- | ---: | --- |
| `-maxscriptsigsize=<n>` | 10,000 | `MAX_SCRIPT_SIZE` in `src/script/vm_limits.h:19`; `scriptSig` evaluation in `src/script/interpreter.cpp:365`, `406`, `642`; `src/script/script.cpp:506` |
| `-maxstackitemsize=<n>` | 10,000 | `may2025::MAX_SCRIPT_ELEMENT_SIZE` in `src/script/vm_limits.h:33`; `maxScriptElementSize` in `src/script/interpreter.cpp:428` |
| `-maxstacksize=<n>` | 1,000 | `MAX_STACK_SIZE` in `src/script/vm_limits.h:22`; check at `src/script/interpreter.cpp:2300` |
| `-maxtxsize=<n>` | 1,000,000 | `MAX_TX_SIZE` in `src/consensus/consensus.h:15`; check at `src/consensus/tx_check.cpp:24` |
| `-maxtokencommitmentsize=<n>` | 128 | `MAX_CONSENSUS_COMMITMENT_LENGTH_UPGRADE12` in `src/primitives/token.h:71`; check at `src/consensus/tokens.cpp:72-79` |
| `-maxopcostperinputbyte=<n>` | 800 | `OP_COST_BUDGET_PER_INPUT_BYTE` in `src/script/vm_limits.h:49`; `GetInputOpCostLimit` at `src/script/vm_limits.h:66`; `ScriptLimits` at `src/script/vm_limits.h:88` |
| `-maxhashitersperinputbyte=<n>` | 0 (stock formula: 0.5/byte standard, 3.5/byte non-standard) | `GetInputHashItersLimit` in `src/script/vm_limits.h:58`; `HASH_ITER_BONUS_FOR_NONSTD_TXNS` at `src/script/vm_limits.h:47` |
| `-maxstandardtxsize=<n>` (not implemented) | 100,000 | `MAX_STANDARD_TX_SIZE` in `src/policy/policy.h:49`; check at `src/policy/policy.cpp:77`. Policy only; `-acceptnonstdtxn=1` already bypasses it, so the lane does not need an option for it. |

Implementation notes:

- `MAX_SCRIPT_SIZE` is used for both the unlocking script and the evaluated redeem script. Separate
  `-maxscriptsigsize` and `-maxp2shscriptsigsize` options would distinguish them; one option is enough to run
  this suite.
- `may2025::MAX_SCRIPT_ELEMENT_SIZE` is defined as `MAX_SCRIPT_SIZE`. To keep stack-item and script-size knobs
  independent, make it a separate variable that defaults to the script-size value.
- `NFTCommitmentBase` is a `prevector<40, uint8_t>`; it spills to the heap, so no storage-layout change is
  needed for commitments above 40 bytes. The consensus check at `src/consensus/tokens.cpp` is the cap.
- `GetInputOpCostLimit`, `GetInputHashItersLimit`, and `ScriptLimits` now read the process-global limit object
  instead of `constexpr` constants. The object is initialized with production defaults and written once during
  startup, before validation threads run.
- A single regtest-gated profile option such as `-relaxedconsensus=<profile>` remains an alternative. Individual
  options are easier to audit and keep production defaults intact.

The patch touches:

- `src/consensus/limits.{h,cpp}`: the runtime limit object and production defaults.
- `src/init.cpp`: the seven regtest-only options and their range checks.
- `src/script/vm_limits.h`, `src/script/interpreter.cpp`, `src/script/script.cpp`, `src/script/script.h`:
  script size, stack item, stack depth, operation cost, hashing, and the `IsUnspendable` classification.
- `src/consensus/tx_check.cpp`, `src/consensus/tokens.cpp`, `src/core_read.cpp`: transaction size and NFT
  commitment size.
- `src/policy/policy.cpp`, `src/keystore.cpp`, `src/wallet/wallet.cpp`: the policy and wallet views of the same
  limits.
- `src/rpc/blockchain.cpp`: the hidden `clearmempool` RPC used by snapshot restore.

Values that match the current mock profile:

```text
-maxscriptsigsize=10000000
-maxstackitemsize=10000000
-maxstacksize=1000
-maxtxsize=100000000
-maxtokencommitmentsize=10000000
-maxopcostperinputbyte=1000000
-maxhashitersperinputbyte=10000000
```

The measured shapes need far less: 400,000 covers the 303,347-byte input with margin, and 1,000,000 covers the
94,651-byte transaction. Use the smaller values if the goal is to keep the test node closer to production.

## Implemented regtest harness

The regtest lane now has the same surface the mock lane provided:

- `solidcash.config.ts` defines a `regtest` network with the same published consensus limits. Set
  `SOLIDCASH_MARKETPLACE_NETWORK=regtest` to select it.
- `RegtestNetworkProvider.takeSnapshot()` records the tip height, tip hash, mock time, and provider-local maps.
- `restore()` invalidates the first block above the snapshot with BCHN's `invalidateblock`. That disconnects
  every later block, including their wallet effects. The new `clearmempool` RPC then drops the transactions
  BCHN returned to the mempool, so a restored fixture starts with an empty pool.
- `reset()` clears provider caches and the mock clock without rewinding the chain. A chain rewind here would
  invalidate every fixture snapshot; `loadFixture` owns chain rewinds, and `reset` handles the caches.
- `send('evm_increaseTime', ...)` calls BCHN's hidden `setmocktime` RPC. `getBlockTime`, `setNextBlockTimestamp`
  and `increaseTime` use the same clock; a pending next-block timestamp is applied by the next `mine()`.
- `loadFixture` works unchanged: it calls `takeSnapshot` and `restore`, plus the existing SDK-side deployment
  and soft-state snapshots.

`clearmempool` is a new hidden RPC in the patched node. It is available only when the node is in regtest
(`MineBlocksOnDemand`) mode.

## Building and running

```sh
scripts/build-bchn-relaxed.sh
docker compose -f docker-compose.marketplace.yml up -d
SOLIDCASH_MARKETPLACE_NETWORK=regtest \
  SOLIDCASH_MARKETPLACE_WORKER_HEAP_MB=6144 \
  npx vitest run --config vitest.marketplace.config.ts
```

If host port 18443 is already taken, add `BCHN_RPC_PORT=18445` to the compose command and set
`REGTEST_RPC_URL=http://127.0.0.1:18445` for the test command. Reset the node volume between suite runs with
`docker compose -f docker-compose.marketplace.yml down -v`.

`docker-compose.marketplace.yml` starts only `bchn`. The application stack's `miner` service is omitted because
it would mine blocks while a fixture snapshot is active. The SDK mines one block per broadcast.

## Verified on the patched node

- The patched image starts with all seven options. The stock binary rejects each name; the patched binary
  rejects them on mainnet and accepts them on regtest.
- `clearmempool` and `setmocktime` answer over JSON-RPC.
- The focused marketplace cases `admin > transfer owner` and `admin > non owner cannot transfer owner` pass
  2/2 against the patched container. The second case restores the first case's fixture snapshot, so snapshot
  restore is exercised.
- The committed regtest test `packages/solidcash/test/regtest/RegtestProviderControls.test.ts` confirms the
  snapshot and clock behavior through the shipped provider: take a snapshot, mine one block, restore to the
  snapshot height; then `evm_increaseTime(86400)` mines 11 blocks and advances the tip's median time past by
  exactly 86400 seconds. Run it with `TESTS_USE_REGTEST=true BCHN_RELAXED=true REGTEST_RPC_URL=...`; the
  `BCHN_RELAXED` gate keeps the stock regtest matrix from running it.
- Reset the node volume (`docker compose ... down -v`) between suite runs. A second deployment at the same
  logical address finds the previous run's anchor and is refused as ambiguous.

## Block oracle fixture

`RegtestNetworkProvider` now deploys a real block-info oracle. It creates a vout-0 genesis at the oracle's
p2sh32 covenant, publishes the category and lock as `blockOracleCategory` / `blockOracleLock`, and funds a
deterministic owner key for updates.

`evm_increaseTime` mines ten blocks to move the median window, then pushes the new timestamp through the
oracle covenant's signed update path as the eleventh block. The oracle record therefore follows the node's
clock instead of a mock rewrite. This unblocks `publishJobPost` and every `block.timestamp` reader.

## Relaxed-limit proof

`packages/solidcash/test/regtest/RelaxedConsensusLimit.test.ts` builds a P2SH32 spend whose redeem script,
scriptSig push, and stack item all exceed the production 10,000-byte limits. It sends the same shape to the
relaxed node and to a stock BCHN v29.0.0 regtest node. The relaxed node accepts it; the stock node rejects it
with `scriptsig-size (code 64)`. Run it with both nodes running:

```sh
TESTS_USE_REGTEST=true BCHN_RELAXED=true \
  REGTEST_RPC_URL=http://127.0.0.1:18450 \
  BCHN_STOCK_RPC_URL=http://127.0.0.1:18451 \
  npx vitest run test/regtest/RelaxedConsensusLimit.test.ts
```

## Full marketplace suite

The full suite runs against the patched node. Latest complete run on a fresh volume:

```sh
BCHN_RPC_PORT=18448 docker compose -f docker-compose.marketplace.yml up -d
SOLIDCASH_MARKETPLACE_NETWORK=regtest \
  REGTEST_RPC_URL=http://127.0.0.1:18448 \
  SOLIDCASH_MARKETPLACE_WORKER_HEAP_MB=6144 \
  npx vitest run --config vitest.marketplace.config.ts --reporter=verbose
```

| Run | Result |
| --- | --- |
| Full run on the fixed harness | **66 passed, 0 failed (66 total)**, 2247 s |
| Earlier full run before the deterministic clock | 66 passed, 0 failed (66 total), 2366 s |
| Verification rerun before the deterministic clock | 65 passed, 1 failed (66 total), 2769 s |

The 65/66 run failed `job posting > post two jobs`: the second `publishJobPost` stopped in a framed entry
guard. It reproduced at the pre-fix HEAD on a fresh node and depended on the wall-clock epoch the container
happened to start at. The regtest lane now pins the node's clock to the mock chain's fixed epoch before its
first block, so mined timestamps no longer derive from wall time. The same case passes in the focused run
and in the full suite on the deterministic clock.

Fixture isolation now holds for repeated in-test `deployMarketplaceWithUsersAndJob` calls. Three defects
caused the earlier cascade:

1. The funding lock was "reentrant" through a depth counter, so two independent `addUtxo` calls overlapping
   in time both ran concurrently. Both selected the same vout-0 coin before either reserved it; the second
   genesis then spent a dead anchor (`funding input ...:0 is not live`). The lock is now a strict FIFO.
   `ensureReady()` runs before the queue and the internal retry calls `addUtxoUnlocked` directly, so no
   caller can already hold the queue while reaching it.
2. `getUtxos` returned `listunspent` entries unfiltered. After a fixture rewind, BCHN's wallet can keep
   listing outputs from the disconnected branch; the SDK funded a transaction with them and the node
   answered `Missing inputs`. `getUtxos` now confirms every served outpoint with `gettxout` (mempool
   included), as the token and funding paths already did.
3. `takeSnapshot` and `restoreSnapshot` did not wait for in-flight sends, so a mine could land above a
   rewind. Both now quiesce the funding and broadcast queues first.

`loadFixture` continues to restore snapshots instead of re-executing fixtures. Cached contract handles and
token approvals therefore survive repeated `deployMarketplaceWithUsersAndJob` calls, and the failures from
the re-execution experiment do not occur.

### Block oracle heartbeat and deterministic clock

A fresh regtest volume pins BCHN's mock clock to `1700000000`, the same epoch the mock provider uses, before
it mines the first block. Every later timestamp is `max(tip median-time-past, last mined) + 1`; wall-clock
time is no longer an input. This makes the in-docker lane reproducible across runs and keeps `block.timestamp`
on the same footing as the mock chain.

The mock provider rewrites its block oracle in place whenever a block is mined, so `block.timestamp`
advances per block. A real covenant oracle can only move by spending its UTXO, so the regtest provider
publishes the next update into the mempool at the end of every mined block, and the next block confirms it.
A caller that reads `block.timestamp` between blocks co-spends the pending oracle UTXO; the node confirms
the update and the call in one block. `mine(n)` still advances the height by exactly `n`, and
`block.timestamp` advances like the mock chain. This is what makes the strict
`block.timestamp > challengePeriodStart` check in `UnicrowDispute.challenge()` pass.

`takeSnapshot` confirms a pending oracle update before capturing. A rewind clears the mempool, and the
wallet cannot rediscover a watch-only oracle output it never saw mined, so leaving an update pending would
make the restored chain report `block oracle UTXO is not available`.

## Remaining constraints

- `ScriptBigInt` keeps its 10,000-byte numeric limit even when `-maxstackitemsize` is larger. Byte strings can
  be larger; numeric operations on items above 10,000 bytes still fail. The marketplace contracts use byte
  strings for their state records.
- The patched node changes consensus acceptance, so it is restricted to regtest. Every option is rejected on
  mainnet, testnet, chipnet, scalenet, and testnet4.
- A snapshot restore invalidates the blocks above its height. Fixtures therefore need to be restored in the
  order their snapshots were taken, or at the same height. The marketplace suite's two fixtures
  (`deployContractsFixture` and `getWalletsFixture`) snapshot at the same chain height.
- The standard transaction-size policy limit (100,000 bytes) has no dedicated option. `-acceptnonstdtxn=1`
  bypasses the standardness check, so the marketplace lane does not need one.
- The block oracle is a real regtest covenant with a deterministic owner key. It is a test fixture, not a
  production keeper.

## Evidence

The patched image is built with:

```sh
scripts/build-bchn-relaxed.sh
```

The build runs entirely in Docker (`docker/bchn-relaxed/Dockerfile`); the host checkout is only the build
context. The stock image was inspected with:

```sh
docker run --rm --entrypoint bitcoind mainnet/bitcoin-cash-node:v29.0.0 -version
docker run --rm --entrypoint bitcoind mainnet/bitcoin-cash-node:v29.0.0 -help-debug
```

Each candidate option was rejected by the stock binary:

```sh
for opt in maxscriptsigsize maxscriptsize maxstackitemsize maxtxsize \
           maxopcostperbyte maxtokencommitmentsize maxstacksize maxhashitersperbyte; do
  docker run --rm --entrypoint bitcoind mainnet/bitcoin-cash-node:v29.0.0 \
    -regtest -datadir=/tmp/x -$opt=20000 -printtoconsole
done
```

Each run printed `Error parsing command line arguments: Invalid parameter -<option>`. The patched image is
built from `/Code/bitcoin-cash-node` on the `relaxed-consensus-limits` branch (base `master`, commit
`abd433abe`). The gating script `scripts/test-bchn-relaxed-options.sh` re-runs the acceptance and rejection
checks against the built image.
