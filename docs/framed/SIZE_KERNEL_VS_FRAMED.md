# Artifact sizes: kernel vs framed (W3)

First pair, 2026-10-05, script `scripts/compare-convention-sizes.mjs`.

| side | tree | artifact mtime (MarketplaceV1.json) |
|---|---|---|
| kernel | `.worktrees/kernel-beta-candidate` at `d7f3c7ad6`, direct convention, recompiled in 61 s | 2026-10-05 10:29 UTC |
| framed | `.worktrees/framed`, `composition.convention = framed`, recompiled in 62 s | 2026-10-05 10:23 UTC |

Bytes are `asmToBytecode` of `artifact.bytecode` (the real script). Chars are the ASM string length. The BCH per-input limit is 10,000 bytes. Deployment UTXOs use the shipped defaults: framed is `dataNftCount` plus 12 masters plus 4 validators; direct is `dataNftCount` plus one master. A framed call spends one master per entry into that contract. The state-record bound on a call is `dataNftCount` (MarketplaceV1 is 2). Records a given title touches are counted with the title runs, not from the artifact. `composition.refusedEntries` is absent on every paired contract, so the refused count is 0.

The 2026-10-05 recompile put the interfaces into the framed artifact directory as well. Kernel-only
marketplace rows that remain are MarketplaceV2, MarketplaceV3, delegate artifacts, and a few application
contracts. MistSwap and the Solidity corpus are in the sections below; they were compiled with `compileFile`,
not the marketplace harness. Refused entries are 0 on every paired marketplace contract.

## Contracts present on both sides

| contract | kernel bytes | framed bytes | delta | kernel bodies | framed bodies | kernel deploy | framed deploy | over 10k |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| FakeToken | 459090 | 24303 | -434787 | 448663 | 17863 | 2 | 17 | both |
| MarketplaceDataV1 | 455980 | 110050 | -345930 | 437168 | 101036 | 3 | 18 | both |
| MarketplaceV1 | 265204 | 135056 | -130148 | 155541 | 122499 | 3 | 18 | both |
| Unicrow | 92312 | 56258 | -36054 | 74670 | 48297 | 4 | 19 | both |
| UnicrowArbitrator | 51395 | 29487 | -21908 | 42078 | 23477 | 3 | 18 | both |
| UnicrowClaim | 16557 | 21801 | 5244 | 5438 | 15537 | 3 | 18 | both |
| UnicrowDispute | 82223 | 31305 | -50918 | 68358 | 25426 | 3 | 18 | both |

Interface artifacts on both sides have an empty script. A framed call still spends one master per entry. MarketplaceV1's state-record bound is 2 (`deploy UTXOs` 18 = 2 + 12 masters + 4 validators).

## MistSwap fixtures

Compiled 2026-10-05 from `/Code/mistswap/mistswap/contracts` with `compileFile`. Both conventions use `evmCompat`, `ecrecover: 'p2pkh'`, `forceStateful`, and the message bus with the kernel and the speed hint. Per-call adds `composition: 'framed'`. All five files compiled. The compiler still warns that the direct scripts exceed 10,000 bytes.

| contract | direct bytes | framed bytes | delta | framed refused | over 10k |
|---|---:|---:|---:|---:|---|
| ERC20Mock | 18922 | 22388 | 3466 | 0 | both |
| MasterChef | 87777 | 42358 | -45419 | 5 | both |
| SushiToken | 24610 | 35967 | 11357 | 3 | both |
| UniswapV2Factory | 52450 | 9433 | -43017 | 1 | direct only |
| UniswapV2Pair | 20621 | 30534 | 9913 | 4 | both |

Per-call deployment UTXOs are 17 to 21 (state records plus the default 12 masters and 4 validators). Direct deployment UTXOs are 2 to 5. MasterChef's five refusals are repeated `balanceOf` / `transferFrom` calls and a verified-mapping write behind an unfixed call. UniswapV2Factory's framed script is 9,433 bytes, under the input limit, because `createPair` is refused. The other four framed scripts are over 10,000 bytes.

## Solidity corpus

`examples/solidity-corpus` compiles `/Code/solidity/test/libsolidity/semanticTests` and `syntaxTests`: 5,202 files. Each file was compiled twice with `compileFile`, 8 second timeout, zero timeouts. Direct options are `evmCompat: true`. Per-call adds `composition: 'framed'`. Artifacts are paired by source path and contract name.

| | direct | framed |
|---|---:|---:|
| files compiled | 2574 | 2179 |
| files that failed | 2628 | 3023 |
| script bytes, sum | 1788551 | 10522654 |
| script bytes, median | 335 | 4059 |
| script bytes, max | 27187 | 129005 |
| function-body bytes, sum | 727908 | 1654706 |
| over 10,000 bytes | 6 | 48 |
| refused entries | 0 | 86 on 56 artifacts |

2,158 identities compiled on both sides. Per-call bytecode is larger on 2,008 of them, equal on 150, and smaller on none. The median growth is 3,668 bytes. Six are over 10,000 bytes on both sides. 38 more cross that line only under framed.

About 400 files compile on the direct convention and not under framed. The repeated reason is `FRAMED_CODEGEN_UNAVAILABLE`: the contract needs a master the head cannot build, or it uses `new` to create a contract. Smaller groups are a constructor the head cannot serve, an address slot reserved twice, and `msg.data` on a single-entry master.

Per-call MarketplaceV1 is 135,056 script bytes against 265,204 on the kernel side. Every paired application contract is over the 10,000-byte input limit on both conventions. Mocknet is what allows those spends. UnicrowClaim is the one paired contract whose framed script is larger (21,801 vs 16,557).

## Kernel-only contracts (no framed artifact in this directory)

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

## Still unpaired

MarketplaceV2, MarketplaceV3, and the delegate artifacts in the kernel-only table have no framed artifact
in the marketplace directory. MistSwap and the Solidity corpus are recorded above.
