# Artifact sizes: kernel vs per-call (W3)

First pair, 2026-10-05, script `scripts/compare-convention-sizes.mjs`.

| side | tree | artifact mtime (MarketplaceV1.json) |
|---|---|---|
| kernel | `.worktrees/kernel-beta-candidate` at `d7f3c7ad6`, direct convention (no `composition` key) | 2026-10-04 18:10 UTC |
| per-call | `.worktrees/per-call` marketplace artifacts, `composition.convention = per-call` | 2026-10-04 19:31 UTC |

Bytes are `asmToBytecode` of `artifact.bytecode` (the real script). Chars are the ASM string length. The BCH per-input limit is 10,000 bytes. Deployment UTXOs use the shipped defaults: per-call is `dataNftCount` plus 12 masters plus 4 validators; direct is `dataNftCount` plus one master. A per-call call spends one master per entry into that contract. The state-record bound on a call is `dataNftCount` (MarketplaceV1 is 2). Records a given title touches are counted with the title runs, not from the artifact. `composition.refusedEntries` is absent on every paired contract, so the refused count is 0.

The per-call directory has 7 contracts. The kernel directory has those plus interfaces, MarketplaceV2, MarketplaceV3, and delegate artifacts. This pair is not a full side-by-side compile. MistSwap and `examples/solidity-corpus` are not in this pair. A fresh compile of all three under both conventions replaces this table before the release commit. The script is what that compile's artifacts get compared with.

## Contracts present on both sides

| contract | kernel bytes | per-call bytes | delta | kernel chars | per-call chars | kernel body bytes | per-call body bytes | kernel largest body | per-call largest body | kernel deploy UTXOs | per-call deploy UTXOs | over 10,000 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| FakeToken | 459090 | 24243 | -434847 | 918516 | 68776 | 448663 | 17758 | 43405 | 6333 | 2 | 17 | both |
| MarketplaceDataV1 | 455980 | 109845 | -346135 | 912924 | 236365 | 437168 | 100748 | 34536 | 28402 | 3 | 18 | both |
| MarketplaceV1 | 265204 | 140746 | -124458 | 531298 | 298591 | 155541 | 127987 | 20234 | 13957 | 3 | 18 | both |
| Unicrow | 92312 | 56231 | -36081 | 187806 | 128600 | 74670 | 48170 | 6063 | 8653 | 4 | 19 | both |
| UnicrowArbitrator | 51395 | 29451 | -21944 | 105096 | 72611 | 42078 | 23412 | 3298 | 5641 | 3 | 18 | both |
| UnicrowClaim | 16557 | 22085 | 5528 | 34573 | 57646 | 5438 | 15576 | 2626 | 4967 | 3 | 18 | both |
| UnicrowDispute | 82223 | 31267 | -50956 | 167332 | 76314 | 68358 | 25378 | 2274 | 7901 | 3 | 18 | both |

Per-call MarketplaceV1 is 298,591 ASM characters. The plan's post-merge note was 287k proxied, so this file is a few percent above that note. Script bytes are about half the ASM character count because the listing is hex-heavy. Every paired contract's redeem script is over the 10,000-byte input limit, on both conventions. Mocknet is what allows those spends. UnicrowClaim is the one paired contract whose per-call script is larger (22,085 vs 16,557).

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
