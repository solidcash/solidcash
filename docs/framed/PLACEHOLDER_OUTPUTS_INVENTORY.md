# Placeholder outputs inventory: `OP_RETURN` and `OP_1`

Where `OP_RETURN` and bare `OP_1` (`0x51`, `OP_TRUE`) are used as transaction plumbing, at clean HEAD `ea7a48e27`
(`.worktrees/kernel-baseline-ea7a48e27`). Companion to PLAN step 0.9 (a placeholder becomes a 1,000-sat P2PKH to the
transaction funder).

- SDK paths are relative to `packages/solidcash/src/`, compiler paths to `packages/solidc/src/` (`solidc/`), utils
  paths to `packages/utils/src/` (`utils/`).
- Tests are not included.
- `OP_1` used as a number or boolean inside script logic is excluded (section F).

---

## Summary

| Group | What it is | Sites | Covenant-visible? | Under the P2PKH-to-funder rule |
| --- | --- | --- | --- | --- |
| A | Zero-value `OP_RETURN` pads and suffix trailer | 4 emitters + recognizers | Yes: the satoshi-container drain guard and conservation | PLAN 0.9 as written; the covenant change is mandatory |
| B1 | Token-less bare `OP_1` pads (800-1,200 sat, anyone-can-spend) | 66 in 27 files | Partly: deployment-slot pads and the route census (B4) | Replace. Classification must become layout-based |
| B2 | NFT-bearing `OP_1` carriers: return events, view returns | 33 (heuristic) | Yes: return-event verification pins `OP_1` (B4) | Covenant pin changes to "the `tx.origin` lock" (see notes) |
| B3 | SDK code finding `OP_1` outputs by script | 22 | No | Rewrite to use layout positions |
| B4 | Covenant pins on `OP_1` outputs | 11 | Yes | Change to "the `tx.origin` lock" + layout-based census |
| C | `P2SH32(OP_TRUE)` dummy-funder inputs | 72 refs in 18 files | Yes: the route checks the lock (`compiler.ts`) | Out of scope: input side (see notes) |
| D | UTXOs created on demand via `provider.addUtxo` | 13 SDK sites | No | Out of scope, but a real-chain blocker |
| E | Tagged `OP_1` scripts (`<data> OP_DROP OP_1`) | 6 | n/a | Not placeholders; unaffected |

**In the new per-call design** (`SPEC_PER_CALL_TRANSACTION.md`, revision 5), groups A-D disappear:
- no balanced pads;
- no dummy funders;
- no UTXOs created on demand;
- return values live in the manifest, so there are no return-event carriers.

---

## A. `OP_RETURN` pads and trailer

| Role | Site |
| --- | --- |
| Drained satoshi container | `stateful/stb-materialize-owner-entries-containers-transfers.ts:205` |
| Drained token container | `stateful/stb-materialize-owner-entries-containers-transfers.ts:218` |
| Suffix anchor after late value chunks | `stateful/stb-finalize-build-derived-suffix.ts:56` |
| Sub-dust change placeholder | `stateful/stb-finalize-fee-before-validation.ts:113` |

**Recognizers** (the "unique trailer" and "marketplace separator" logic):
- `stateful/stb-authenticated-view-returns.ts:144,222`
- `stateful/stb-finalize-build-stamp.ts:79-80`
- `stateful/mutable-output-reassert.ts:151-252`
- `stateful/stb-jobevents-band.ts:93,298`
- `stateful/stb-measure-and-fund-covenant-fee.ts:60`
- `message-bus/compose-semantic-effects.ts:141`

**Covenant:** `solidc/generation/GenerateTargetTraversal.ts:8842` (drain guard: value must be 0 on a lock mismatch)
and `:35812` (conservation reads the placeholder's value).

---

## B. Bare `OP_1` outputs

### B1. Token-less `OP_1` pads (66 sites, 27 files)

| File | Lines |
| --- | --- |
| `message-bus/compose-assemble.ts` | 1149 |
| `stateful/StatefulTransactionBuilder.ts` | 1702, 5332, 5337 |
| `stateful/collection-lock-strip.ts` | 100, 138, 223 |
| `stateful/delegate-event-jobevent-helpers.ts` | 101, 118, 137 |
| `stateful/mutable-output-reassert.ts` | 98, 135, 142, 366, 455, 464, 539 |
| `stateful/same-index-twin-emit.ts` | 282, 307 |
| `stateful/sc-apply-derive-full-nested-entry-pins.ts` | 344 |
| `stateful/scid-minting-return-layout.ts` | 55, 198 |
| `stateful/stb-append-delegate-output-helpers.ts` | 135, 159, 170, 211, 216, 222, 228, 271 |
| `stateful/stb-authenticated-view-returns.ts` | 131 |
| `stateful/stb-inblock-writer-returns.ts` | 133 |
| `stateful/stb-materialize-external-call-outputs.ts` | 244 |
| `stateful/stb-materialize-low-level-call-outputs.ts` | 129, 140 |
| `stateful/stb-materialize-owner-entries-containers-transfers.ts` | 86, 273, 297 |
| `stateful/stb-materialize-owner-event-nft-outputs.ts` | 143, 159 |
| `stateful/stb-materialize-owner-front-outputs.ts` | 125, 136 |
| `stateful/stb-materialize-return-event-outputs.ts` | 173, 202 |
| `stateful/stb-materialize-trailing-frame-and-pending.ts` | 136 |
| `stateful/stb-materialize-trailing-iteration-entries.ts` | 67 |
| `stateful/stb-nested-output-reassert.ts` | 381, 394 |
| `stateful/stb-place-tail-return.ts` | 150, 163, 193, 208 |
| `stateful/stb-repair-computed-chunk-output.ts` | 376, 717 |
| `stateful/stb-reverse-suffix-value-chunks.ts` | 88, 284 |
| `stateful/stb-strip-surplus-linear-batch.ts` | 75 |
| `stateful/stb-view-tail-occupancy.ts` | 170, 192, 217, 254 |
| `stateful/value-chunk-band-helpers.ts` | 51, 173 |
| `stateful/writer-event-delegate-layout.ts` | 82, 124, 138 |

### B2. NFT-bearing `OP_1` carriers (33 sites; heuristic: a token field within 5 lines, verify per site)

| File | Lines |
| --- | --- |
| `loop-call.ts` | 202 |
| `stateful/mutable-output-reassert.ts` | 415, 425 |
| `stateful/same-index-twin-emit.ts` | 269 |
| `stateful/sc-deploy-from.ts` | 893, 1302, 1311 |
| `stateful/stb-append-delegate-output-helpers.ts` | 117 |
| `stateful/stb-append-early-delegate-outputs.ts` | 64 |
| `stateful/stb-authenticated-view-returns.ts` | 171, 210 |
| `stateful/stb-delegate-impl-event-reassert.ts` | 212 |
| `stateful/stb-delegate-loop-entries.ts` | 229 |
| `stateful/stb-derived-value-chunk-apply.ts` | 148 |
| `stateful/stb-inblock-writer-returns.ts` | 105 |
| `stateful/stb-materialize-external-call-outputs.ts` | 104, 483, 556, 717 |
| `stateful/stb-materialize-return-event-outputs.ts` | 48, 67, 70, 134, 145, 162 |
| `stateful/stb-minting-swap-predecessors.ts` | 442 |
| `stateful/stb-place-tail-return.ts` | 215, 268 |
| `stateful/stb-repair-nested-callee-outputs.ts` | 328, 365, 436 |
| `stateful/stb-view-tail-occupancy.ts` | 200 |
| `stateful/writer-event-delegate-layout.ts` | 87 |

### B3. SDK code that finds `OP_1` outputs by script (22 sites)

| File | Lines |
| --- | --- |
| `message-bus/compose-assemble.ts` | 1246 |
| `message-bus/compose-semantic-effects.ts` | 245, 267 |
| `message-bus/graph.ts` | 851, 885 |
| `message-bus/preflight.ts` | 2859 |
| `stateful/StatefulContract.ts` | 7832 |
| `stateful/StatefulTransactionBuilder.ts` | 3691 |
| `stateful/computed-output-repair.ts` | 176 |
| `stateful/mutable-output-reassert.ts` | 34, 129 |
| `stateful/physical-return-layout.ts` | 70 |
| `stateful/scid-minting-return-layout.ts` | 87, 218 |
| `stateful/stb-declared-mutable-entries.ts` | 112 |
| `stateful/stb-minting-swap-predecessors.ts` | 217 |
| `stateful/stb-repair-computed-chunk-output.ts` | 397, 442 |
| `stateful/stb-repair-nested-callee-outputs.ts` | 174 |
| `stateful/value-chunk-band-helpers.ts` | 235, 245 |
| `stateful/writer-event-delegate-layout.ts` | 613 |

### B4. Covenant pins on `OP_1` outputs

| Site | What the covenant requires |
| --- | --- |
| `solidc/generation/GenerateTargetTraversal.ts:33085` (`emitReturnEventCovenantVerification`) | Return-event output lock `== 51`, value bounded |
| `solidc/generation/GenerateTargetTraversal.ts:33192` (`emitExternalReturnEventVerification`) | External return-event output lock `== 51`, value bounded |
| `solidc/generation/GenerateTargetTraversal.ts:32844`, `:32924` (`emitInlineLoopExternalCall`) | Loop return carriers: no FT, lock `== 51`, value `<= 1200` |
| `solidc/generation/GenerateTargetTraversal.ts:33275` (`emitSingleReturnEventUniqueness`) | Counts `OP_1` outputs carrying the callee's category (return-event uniqueness) |
| `solidc/generation/GenerateTargetTraversal.ts:34897` (`emitOwnCategoryImmutableNftOutputPin`) | Excludes `OP_1` carriers from the event-forgery pin |
| `solidc/compiler.ts:10969` (route template, deployment mode) | Inactive deployment slots: output lock `== 51`, no token, value `== 1000` |
| `solidc/compiler.ts:11190` (route template, census) | Dummy-funder slots whose output is not `51` count as value outputs |
| `solidc/compiler.ts:10863`, `:10879` (route template, value rows) | A value-transfer recipient must not be `51` |
| `solidc/compiler.ts:11770` (verifier host, upgrade mode) | Placeholder argument `hex"51"` passed to the verifier program |

### Notes for B

- **Script can no longer tell a pad from a payment.** A P2PKH pad to the funder looks exactly like a real payment to
  the funder, and a value row may legitimately pay the user. So every "is this a pad?" decision (B3, and the census
  at `compiler.ts:11190`) must come from the published layout.
- **The covenant knows the funder.** `tx.origin` is the first non-token input, and there is an existing `emitTxOrigin`
  helper. Pins that say "lock `== 51`" (B4) become "lock `== tx.origin`'s lock".
- **Carriers hold immutable NFTs of the contract's category** (B2). Paid to the funder, the NFT lands in the user's
  wallet. Today anyone can sweep it from `OP_1`, so it is already relocatable.
  - To verify separately: no proof may accept a relocated own-category immutable NFT whose commitment a caller can
    influence.
  - The candidate is the SCID identity anchor: an immutable NFT at `<seed> OP_DROP OP_1` (section E).

---

### C. `P2SH32(OP_TRUE)` dummy-funder references (72 references, 18 files)

| File | References |
| --- | --- |
| `stateful/sc-allocate-create-builder-funders-accounting.ts` | 9 |
| `solidc/compiler.ts` | 8 |
| `stateful/sc-resolve-blockhash-co-spends.ts` | 7 |
| `stateful/sc-assemble-create-builder-nested-compose-slots.ts` | 5 |
| `stateful/sc-derive-deploy-commitments.ts` | 5 |
| `stateful/sc-expand-create-builder-late-transitive.ts` | 5 |
| `stateful/sc-orchestrate-create-builder-external-calls.ts` | 5 |
| `stateful/sc-upgrade.ts` | 5 |
| `solidc/generation/GenerateTargetTraversal.ts` | 3 |
| `message-bus/compose-recipes.ts` | 3 |
| `message-bus/compose-semantic-effects.ts` | 3 |
| `network/RegtestNetworkProvider.ts` | 3 |
| `stateful/StatefulContract.ts` | 3 |
| `stateful/sc-register-create-builder-builder-state.ts` | 3 |
| `message-bus/compose-assemble.ts` | 2 |
| `message-bus/compose-participant-helpers.ts` | 1 |
| `message-bus/compose-prepared-invocation.ts` | 1 |
| `utils/artifact.ts` | 1 |

### D. UTXOs created on demand through `provider.addUtxo` (13 SDK call sites)

| File | Lines |
| --- | --- |
| `stateful/sc-allocate-create-builder-funders-accounting.ts` | 363, 390, 468, 495 |
| `stateful/sc-assemble-create-builder-nested-callee-block.ts` | 170 |
| `stateful/sc-assemble-create-builder-nested-compose-slots.ts` | 246 |
| `stateful/sc-expand-create-builder-late-transitive.ts` | 326 |
| `stateful/sc-orchestrate-create-builder-external-calls.ts` | 371 |
| `stateful/sc-upgrade.ts` | 204 |
| `stateful/stb-build-inputs.ts` | 447, 473, 467 |
| `stateful/stb-measure-and-fund-covenant-fee.ts` | 101 |

### Notes for C and D

Covenant checks on the dummy-funder lock: `solidc/compiler.ts:10865`, `:10881`, `:10962`, `:11179`, `:11185`,
`:11188`, `:11193`.

**Why input-side pads are not P2PKH** (`stateful/sc-allocate-create-builder-funders-accounting.ts:352-355`): a bare
P2PKH pad input would become the authenticated `tx.origin` (the first non-token input) and break `rowSubject ==
tx.origin`. Signing dozens of wallet pads would also be costly. The P2PKH-to-funder rule is therefore output-side only.

**Group D is a real-chain blocker.**
- The SDK fabricates dummy-funder UTXOs through `provider.addUtxo`: deterministic fake txids, 5,000 sat at
  `P2SH32(OP_TRUE)`.
- It also mints bare `OP_1` pad funders (`stateful/stb-build-inputs.ts:458-480`).
- That works on `MockNetworkProvider`, and on `RegtestNetworkProvider`, which funds them from the node wallet. It does
  not work on Electrum or mainnet.

---

## E. Tagged `OP_1` scripts (not placeholders)

| Script | Site |
| --- | --- |
| SCID identity anchor `<seed> OP_DROP OP_1` | `stateful/logical-identity.ts:62-65` |
| External library blob `<blob> OP_DROP OP_1` | `utils/external-library.ts:131` |
| keccak256 library blob `<blob> OP_DROP OP_1` | `utils/keccak-library.ts:45` |
| Token-container covenant tail `OP_DROP OP_1` | `solidc/generation/GenerateTargetTraversal.ts:37004`, `:37377` |
| Consensus probe source `OP_DROP OP_1` | `network/MockNetworkProvider.ts:110` |

---

## F. Excluded: `OP_1` as a number or boolean

These are ordinary script values, not outputs:
- the encoding of `true` as `0x51`: `utils/state.ts` bool codec, `stateful/value-chunk-geometry.ts:296-306`,
  `stateful/solidityAbi.ts:7-8`;
- pushes of small integers (`OP_1`-`OP_16`): `solidc/generation/GenerateTargetTraversal.ts:4887,14973,14987,17610-18012,18309`;
- a commitment value check: `stateful/StatefulTransactionBuilder.ts:3697`;
- an entry-commitment prefix check: `stateful/sorted-entry-commitment.ts:28`;
- a disassembler: `message-bus/compose-assemble.ts:2208`.
