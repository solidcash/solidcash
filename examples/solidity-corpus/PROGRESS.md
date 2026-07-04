# solc-corpus: compilable-count progress

Absolute count of single-file, in-scope contracts from `../solidity` (the ethereum/solidity compiler test
corpus) that SolidCash compiles, tracked as gaps are closed. In-scope = files that should compile as a single
unit; excludes solc negative tests (deliberately-uncompilable) and multi-file `==== Source:` tests. Regenerate
the current number with `node examples/solidity-corpus/bench.mjs` (the scorecard's first line).

| date | compiled / in-scope | commit(s) | Δ | change |
|---|---|---|---|---|
| 2026-07-04 | 1936 / 4876 | (baseline) | — | initial solc-corpus bench |
| 2026-07-04 | 2107 / 4876 | d0a990f9, 8359e4c1 | +171 | `pragma abicoder` / `pragma experimental` tolerated |
| 2026-07-04 | 2288 / 4876 | 5a4b6f48 | +181 | `pragma solidity >=0.0` / `*` (2-part + wildcard versions) |
| 2026-07-04 | 2289 / 4876 | 9293db4d | +1 | stop internal crashes on contract-reference types (28→20 crashes; mostly crash→graceful-fail) |
| 2026-07-04 | 2299 / 4876 | 28dd1a17 | +10 | state-var modifiers in any order (`uint constant public X`) |
| 2026-07-04 | 2335 / 4876 | f28d743c | +36 | unnamed returns default on fall-through (`function f() returns(uint){ a=x; }`) |
| 2026-07-04 | 2342 / 4876 | 6083d3b8 | +7 | string literal → `bytesN` (right-padded, `bytes32 name = "TKN"`) |
| 2026-07-04 | 2349 / 4876 | cd291385 | +7 | string literal → `bytesN` in comparisons (`id == "abc"`) |
| 2026-07-04 | 2464 / 4876 | (interim) | +115 | re-measured baseline: this-prefix push/pop, struct dynamic-array-field flatten, no-arg push + grammar peels (for-init, receive/override modifiers) |
| 2026-07-04 | 2492 / 4876 | 499f9327, e070e558 | +28 | bare `uint(x)` cast; enum / contract mapping key types (were crashing on `.toString`) |
| 2026-07-04 | 2500 / 4876 | 35e74dd0 | +8 | UDVT over address (`type MyAddr is address`) |
| 2026-07-04 | 2515 / 4876 | 11225bd5 | +15 | `bytes` `.push()` / `.pop()` (desugar to concat / slice reassignment) |
| 2026-07-04 | 2527 / 4876 | 7500e2e3 | +12 | bare `uint`/`int` in `type()` introspection (compat-gated) |
| 2026-07-04 | 2540 / 4876 | 393ecfce | +13 | fixed-inner nested arrays `uint256[N][]` chunk-packed (a bounded array of fixed-width elements is now fixed-width, so it packs; whole-assign / push / `a[i][j]` / length) |
| 2026-07-04 | 2566 / 4876 | 65165b39 | +26 | variable-inner nested arrays `uint256[][]` chunk-packed (framed variable-length rows; one-line gate reusing the fixed-inner infra + framed machinery) |
| 2026-07-04 | 2586 / 4876 | 3cc5c63a | +20 | nested push/pop on a state 2D row (`a[i].push(v)` / `a[i].pop()` -> row read-modify-write) |
| 2026-07-04 | 2598 / 4876 | 90d11451, b9c9a9c9 | +12 | loop-cache fixes: preserve no-arg push default in a loop; flush state write-back before a trailing `return` |
| 2026-07-04 | 2652 / 4876 | 42a6f14c | +54 | `this.f(args)` external self-call resolves to the contract's own function (public/internal; external still a clean ICE) |
| 2026-07-04 | 2683 / 4876 | 157c6c97, 4c24281b, 7ef2935b | +31 | batch: `this.f()` to an *external* function (+21); library-namespaced member access `L.E.M` / `L.E` type + `L.f({named})` call (+2); local/named-return shadow of an outer symbol; `uint public constant` baked not stored |

Total so far: **1936 → 2683** (+747). Update this table whenever the number moves.

## Notes

- The pragma unblocks peeled the first-line wall; most files behind it still fail on EVM content (Yul,
  ABIEncoderV2 structs, `msg.sender` dispatch), so parse-unblocks convert far more files to *later* failures
  than to full compiles.
- Corpus completion also required the O(N) optimiser fixes (fc474241, e3e2060d) - large fixed-size arrays
  (`uint256[500]`) previously drove the peephole optimiser O(N^2) and hung the run.
- ~55% of remaining failures are still ParseErrors (the grammar wall). Internal `TypeError: cannot read
  undefined` crashes are down to ~4 (was 20): the enum/contract mapping-key `.toString` crash (17 files) is
  fixed; the rest are assignment-as-expression `.type` (2, SMT tests) and `.length` (2).
- Remaining top gaps are fundamental or feature-scale, not resolution tweaks: method-calls-on-non-contract
  receivers, Yul, nested-array state vars (`uint[][] a; a = d`), ABIEncoderV2 memory structs, `new C()` outside
  a `deploy` function (correct-by-design on UTXO). Enum-key mappings compile but need an SDK-side encoder for
  the int-backed key before they run.
