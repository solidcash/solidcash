# Regtest at `88cc906ec`: what a real node proved, and what it cannot

> **Snapshot at `88cc906ec` (2026-10-17).** Current regtest and relaxed-consensus instructions are in
> [`../marketplace/bchn-marketplace-consensus-relaxation.md`](../marketplace/bchn-marketplace-consensus-relaxation.md).

> **Update (2026-10-17).** The stock-node limits below still hold. A patched BCHN now exposes regtest-only
> overrides for them, and the regtest lane has fixture snapshots and time travel. See
> [BCHN marketplace consensus relaxation](../marketplace/bchn-marketplace-consensus-relaxation.md). Build the node with
> `scripts/build-bchn-relaxed.sh` and use `docker-compose.marketplace.yml`. The measurements below remain the
> reason the patch exists.

## The stack

`docker-compose.regtest.yml` with `bchn` (BCHN v29.0.0), `fulcrum` and `miner`. The two images are
`mainnet/bitcoin-cash-node:v29.0.0` and `cculianu/fulcrum:latest`.

An earlier attempt recorded them as unobtainable ("error getting credentials - err: signal: terminated"). That was
wrong about the cause: the helper named by `/root/.docker/config.json` (`credsStore`) times out, not the network.
A retry pulled both images (exit 0) and a control pull of `hello-world` succeeded, so the registry is reachable.
The stack came up healthy, the miner pre-mined to height 200, and Fulcrum logged
`Block height 200, up-to-date`.

## The real-node run

    yarn test:application-regtest

runs `test/e2e/Erc20LikeApplication.test.ts` and `test/e2e/HodlVault.test.ts` with `TESTS_USE_REGTEST=true` and
`RELEASE_SIZE_REPORT=1` against that node.

    Test Files  2 passed (2)
         Tests  9 passed (9)
      Duration  15.50s

The tests really used the node, and the limits they were checked against are the node's, not a mock's: while the
run executed, BCHN's chain advanced from height 200 to **height 222** (22 blocks mined from the broadcast
transactions; `UpdateTip ... height=222 ... tx=242` and the `AddToWallet` lines in the container log). So a
stateful ERC-20-like ledger and an escrow/timelock contract execute on a real BCHN+regtest node at the stock
BCH-2026 consensus and standardness rules.

## What cannot run there

The marketplace lane is not consensus-valid at those rules, and the compiled artifacts say so before any
transaction is attempted:

| measured | value | real limit |
|---|---:|---:|
| compiled marketplace artifacts over the script limit | 7 of 19 | 10,000 bytes per P2SH script |
| largest compiled artifact (`MarketplaceV1`, framed) | 144,485 bytes | 10,000 |
| `MarketplaceDataV1` | 118,379 bytes | 10,000 |
| largest unlocking script on a composed call | 24,937 bytes | 10,000 per input |
| the same on the largest lane (`archive/docs:docs/framed/PERF_KERNEL_VS_FRAMED.md`) | 133,320-135,908 bytes | 10,000 |

`solidcash.config.ts` says why the fixture passes at all: its `mock` network sets
`maximumInputBytes: 10_000_000`, `operationCostBudgetPerByte: 1_000_000` and `maximumTransactionBytes:
100_000_000`, with the comment that the proxy `__forward` inspects the implementation's full p2sh32 redeem script
(~3.8 MB for MarketplaceV1). The 66/66 and 65/65 ladders therefore prove the compiler and SDK agree with each
other under relaxed limits. They do not prove a marketplace transaction is valid on a real node, and no
marketplace title can be run on one until the per-input size is under 10,000 bytes - the spec's own §12 lever
(load the code instead of carrying it), not any of the W4 levers.

## What this means for the release label

The two regtest applications are real-chain evidence for a simple stateful contract. The marketplace lane is
mock-only by construction. Unless a marketplace flow is brought under the input limit, the honest label for this
release is **mocknet beta**, with the numbers above in the release notes.

## Reproduce

    docker compose -f docker-compose.regtest.yml up -d bchn fulcrum miner    # ready at height 200 + Fulcrum up-to-date
    yarn test:application-regtest
    docker compose -f docker-compose.regtest.yml logs --tail=50 bchn | grep UpdateTip
