# Artifact sizes: kernel vs per-call (W3)

First pair, 2026-10-05, script `scripts/compare-convention-sizes.mjs`.

| side | tree | artifact mtime (MarketplaceV1.json) |
|---|---|---|
| kernel | `.worktrees/kernel-beta-candidate` at `d7f3c7ad6`, direct convention, recompiled in 61 s | 2026-10-05 10:29 UTC |
| per-call | `.worktrees/per-call`, `composition.convention = per-call`, recompiled in 62 s | 2026-10-05 10:23 UTC |

Bytes are `asmToBytecode` of `artifact.bytecode` (the real script). Chars are the ASM string length. The BCH per-input limit is 10,000 bytes. Deployment UTXOs use the shipped defaults: per-call is `dataNftCount` plus 12 masters plus 4 validators; direct is `dataNftCount` plus one master. A per-call call spends one master per entry into that contract. The state-record bound on a call is `dataNftCount` (MarketplaceV1 is 2). Records a given title touches are counted with the title runs, not from the artifact. `composition.refusedEntries` is absent on every paired contract, so the refused count is 0.

The 2026-10-05 recompile put the interfaces into the per-call artifact directory as well. Kernel-only rows that remain are MarketplaceV2, MarketplaceV3, delegate artifacts, and a few application contracts. MistSwap and `examples/solidity-corpus` are not in this pair. Refused entries are 0 on every paired contract.

## Contracts present on both sides

| contract | kernel bytes | per-call bytes | delta | kernel bodies | per-call bodies | kernel deploy | per-call deploy | over 10k |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| FakeToken | 459090 | 24303 | -434787 | 448663 | 17863 | 2 | 17 | both |
| MarketplaceDataV1 | 455980 | 110050 | -345930 | 437168 | 101036 | 3 | 18 | both |
| MarketplaceV1 | 265204 | 135056 | -130148 | 155541 | 122499 | 3 | 18 | both |
| Unicrow | 92312 | 56258 | -36054 | 74670 | 48297 | 4 | 19 | both |
| UnicrowArbitrator | 51395 | 29487 | -21908 | 42078 | 23477 | 3 | 18 | both |
| UnicrowClaim | 16557 | 21801 | 5244 | 5438 | 15537 | 3 | 18 | both |
| UnicrowDispute | 82223 | 31305 | -50918 | 68358 | 25426 | 3 | 18 | both |

Interface artifacts on both sides have an empty script. A per-call call still spends one master per entry. MarketplaceV1's state-record bound is 2 (`deploy UTXOs` 18 = 2 + 12 masters + 4 validators).

## MistSwap fixtures

Compiled 2026-10-05 from `/Code/mistswap/mistswap/contracts` with `compileFile`. Both conventions use `solidityImportCompat`, `ecrecover: 'p2pkh'`, `forceStateful`, and the message bus with the kernel and the speed hint. Per-call adds `composition: 'per-call'`. All five files compiled. The compiler still warns that the direct scripts exceed 10,000 bytes.

| contract | direct bytes | per-call bytes | delta | per-call refused | over 10k |
|---|---:|---:|---:|---:|---|
| ERC20Mock | 18922 | 22388 | 3466 | 0 | both |
| MasterChef | 87777 | 42358 | -45419 | 5 | both |
| SushiToken | 24610 | 35967 | 11357 | 3 | both |
| UniswapV2Factory | 52450 | 9433 | -43017 | 1 | direct only |
| UniswapV2Pair | 20621 | 30534 | 9913 | 4 | both |

Per-call deployment UTXOs are 17 to 21 (state records plus the default 12 masters and 4 validators). Direct deployment UTXOs are 2 to 5. MasterChef's five refusals are repeated `balanceOf` / `transferFrom` calls and a verified-mapping write behind an unfixed call. UniswapV2Factory's per-call script is 9,433 bytes, under the input limit, because `createPair` is refused. The other four per-call scripts are over 10,000 bytes.

Per-call MarketplaceV1 is 135,056 script bytes against 265,204 on the kernel side. Every paired application contract is over the 10,000-byte input limit on both conventions. Mocknet is what allows those spends. UnicrowClaim is the one paired contract whose per-call script is larger (21,801 vs 16,557).

## Kernel-only contracts (no per-call artifact in this directory)

| contract | bytes | over 10,000 | deploy UTXOs |
|---|---:|---|---:|
| EACCToken | 28965 | yes | 3 |
| MarketplaceV2 | 317308 | yes | 3 |
| MarketplaceV3 | 317120 | yes | 3 |
| MockSablierLockup | 3228 | no | 2 |
| MockSablierLockup delegate | 7065 | no | 2 |
| TreasurySplit | 5035 | no | 2 |
| TreasurySplit delegate | 5297 | no | 2 |
| Unicrow delegate | 68419 | yes | 4 |
| UnicrowArbitrator delegate | 33068 | yes | 3 |
| UnicrowClaim delegate | 17297 | yes | 3 |
| UnicrowDispute delegate | 85478 | yes | 3 |

Interface artifacts (IERC20 and the other `I*` files) have an empty script. They are not inputs.

## Not in this pair yet

- MistSwap (`examples/mistswap-native`, sources under `/Code/mistswap` when that checkout is present).
- `examples/solidity-corpus` (the solc semantic and syntax tests, compiled with `examples/solidity-corpus/bench.mjs`).
- A per-call compile that emits MarketplaceV2, MarketplaceV3, and the delegate artifacts, so the kernel-only rows can be paired.
