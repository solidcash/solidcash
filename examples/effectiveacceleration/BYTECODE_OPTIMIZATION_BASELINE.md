# EffectiveAcceleration bytecode optimization baseline

Last updated: 2026-07-23.

Recorded from the generated artifacts in `artifacts-real/` before the general C2 and structural-codec optimization work. Sizes are `artifact.bytecode.length / 2`; half-byte values expose pre-existing odd-length artifact strings and are intentionally preserved rather than rounded.

| Contract | Baseline bytes |
| --- | ---: |
| EACCToken | 33135 |
| ERC20 | 9842 |
| FakeToken | 10905 |
| IERC1155Errors | 0 |
| IERC20 | 0 |
| IERC20Errors | 0 |
| IERC20Metadata | 0 |
| IERC20Permit | 0 |
| IERC5267 | 0 |
| IERC721Errors | 0 |
| IMulticall3 | 0 |
| IUnicrow | 0 |
| IUnicrowArbitrator | 0 |
| IUnicrowClaim | 0 |
| IUnicrowClaimRewards | 0 |
| IUnicrowDispute | 0 |
| IUnicrowStakingRewards | 0 |
| MarketplaceDataV1 | 53346 |
| MarketplaceV1 | 460301 |
| MarketplaceV2 | 207594 |
| MarketplaceV3 | 207444 |
| MockSablierLockup | 6083.5 |
| TreasurySplit | 1908.5 |
| Unicrow | 23931.5 |
| UnicrowArbitrator | 13472 |
| UnicrowClaim | 10905.5 |
| UnicrowDispute | 13976.5 |
| definitions | 0 |
| **Total** | **1052844.5** |

MarketplaceV1 function-body baseline:

| Function | Bytes |
| --- | ---: |
| publishJobPost | 98402 |
| updateJobPost | 81918 |
| refuseArbitration | 36667 |
| reopenJob | 35502 |
| refund | 29564 |
| takeJob | 28395 |
| payStartJob | 26383 |
| closeJob | 23178 |
| arbitrate | 22108 |
| approveResult | 15892 |
| withdrawCollateral | 10349 |
| dispute | 10094 |
| review | 8612 |
| deliverResult | 7960 |
| postThreadMessage | 4690 |
| updateJobWhitelist | 3366 |

Synthetic C2 baselines (`forceStateful: true`):

| Shape | Bytes |
| --- | ---: |
| Stateful non-mapping baseline | 848 |
| One boolean mapping read | 1457 |
| One boolean mapping write | 1462 |
| Boolean read then write | 1862 |
| Dynamic single-key boolean write loop | 3936.5 |
| Dynamic nested-key boolean write loop | 4117 |

## Optimization measurements

Synthetic measurements after general helper extraction:

| Shape | Baseline | Final | Reduction |
| --- | ---: | ---: | ---: |
| One boolean mapping write | 1462 | 1281 | 181 (12.4%) |
| Boolean read then write | 1862 | 1538 | 324 (17.4%) |
| Dynamic single-key boolean write loop | 3936.5 | 3668.5 | 268 (6.8%) |
| Dynamic nested-key boolean write loop | 4117 | 3849 | 268 (6.5%) |

The original 460301-byte MarketplaceV1 artifact and the current external checkout are not source-identical, so
their sizes must not be presented as a compiler-only before/after pair. A same-source intermediate artifact was
recorded after the first output-verifier extraction and before collection-address, absence-proof, and structural
sharing:

| Current external MarketplaceV1 source | Bytes |
| --- | ---: |
| Intermediate | 462074 |
| Final | 461310 |
| **Reduction after intermediate** | **764 (0.17%)** |

Selected final function bodies on that source:

| Function | Final bytes |
| --- | ---: |
| publishJobPost | 98251 |
| updateJobPost | 81918 |
| updateJobWhitelist | 4909 |
| postThreadMessage | 4579 |
| takeJob | 28284 |
| refund | 29441 |
| refuseArbitration | 36555 |

An attempted loop-invariant nested-key prefix cache increased the synthetic nested-loop script from 3849 to
3874 bytes: a Bitcoin Script loop body is emitted once, while the cache requires setup and cleanup. It was
therefore discarded from this byte-size optimization series.

## Structural sharing follow-up

Profiling the optimized artifact exposed that dynamic structural helper registries were copied into each
function traversal. Multi-function contracts retained use counts but lost the corresponding structural keys,
preventing contract-wide helpers from being emitted. Sharing those registries contract-wide also guarantees
that independently compiled entry points cannot allocate the same helper ID to different shapes.

Further general extraction was then added for repeated struct-field prefixes, variable-width scan loops, and
variable-width array element decoding. On the same current MarketplaceV1 source:

| Stage | Bytes | Incremental reduction |
| --- | ---: | ---: |
| Previous final | 461310 | - |
| Contract-wide structural and field-prefix sharing | 235419 | 225891 (49.0%) |
| Shared variable-width scan loops | 223099 | 12320 (5.2%) |
| Shared variable-width element extraction | 174533 | 48566 (21.8%) |
| **Follow-up total** | **174533** | **286777 (62.2%)** |

## Nested structural sharing and deep-stack follow-up

The next pass remained contract-agnostic. Cumulative field-prefix helpers now invoke the nearest smaller prefix
for the same struct shape, and captured helpers may invoke already-defined helpers without making dead-definition
elimination discard their dependencies.

Mapping-backed variable-width arrays were also routed through the same structural element-extraction helper as
ordinary dynamic arrays. That removes a duplicate generator path and benefits contracts that repeat those
accesses, but it was neutral on this MarketplaceV1 source.

| Stage | Bytes | Incremental reduction |
| --- | ---: | ---: |
| Previous follow-up | 174533 | - |
| Chained cumulative struct-field prefixes | 164082 | 10451 (6.0%) |
| Captured-helper dependency reuse | 157203 | 6879 (4.2%) |
| Shared mapping-array element extraction | 157203 | 0 |
| Complete struct-field extraction sharing | 149109 | 8094 (5.1%) |
| Encoding-layout helper canonicalization | 149109 | 0 |
| Encoded-size-aware helper selection | 149109 | 0 |
| Recursive encoding-layout canonicalization | 149109 | 0 |
| Balanced deep-stack replacement loops | 146272 | 2837 (1.9%) |
| Compact collision-free helper IDs | 143076 | 3196 (2.2%) |
| Shared packed-array read extraction | 96428 | 46648 (32.6%) |
| Encoded-cost selection for fixed helpers | 96428 | 0 |
| Shared literal-index and delete extraction | 96428 | 0 |
| Compact negative fixed-helper IDs | 89609 | 6819 (7.1%) |
| Shared variable-width mutation split | 89035 | 574 (0.6%) |
| Shared physical state-field decoding | 86789 | 2246 (2.5%) |
| Shared non-delegate state fetch and decode | 86444 | 345 (0.4%) |
| Shared variable-width truncation composition | 86444 | 0 |
| Shared state reconstruction reads | 82804.5 | 3639.5 (4.2%) |
| Shared data-NFT bytecode/category preservation | 82072.5 | 732 (0.9%) |
| Shared read-only commitment preservation | 81906.5 | 166 (0.2%) |
| Literal index-zero variable-width specialization | 81906.5 | 0 |
| Shared written-NFT output commitment lookup | 81862.5 | 44 (0.1%) |
| **Current total** | **81862.5** | **92670.5 (53.1%)** |

Relative to the same-source 461310-byte measurement before the structural-sharing follow-ups, the current
artifact is 379447.5 bytes smaller (82.3%).

## Final implementation summary

All retained transformations are general compiler optimizations. None recognizes MarketplaceV1, its function
names, or its particular state schema.

- Structural helper registries are shared across the whole contract rather than copied per entry point.
- Struct helpers use recursive encoding-layout keys, allowing equivalent layouts to share code without
  conflating layouts that encode differently.
- Cumulative struct-field-prefix helpers invoke the closest already-defined prefix.
- Complete field extraction, variable-width scan loops, and scan-plus-decode element extraction are shared.
- Ordinary packed state arrays, mapping-backed arrays, literal-index reads, and compatible delete paths use the
  same canonical variable-width element extraction.
- Variable-width local/state assignment and swap-delete paths share their scan-and-split mutation primitive.
- Variable-width local/state pop paths compose the same split helper into a cost-selected truncation helper.
- Physical data-NFT field reads share tag verification, preceding-field traversal, and target decoding. Normal
  state reads may also share the commitment-fetch prefix; delegate reads keep it inline because their proxy
  master index occupies the altstack beneath the `OP_INVOKE` return address.
- Commitment reconstruction reuses the same physical state-read helpers for every unchanged field.
- Per-data-NFT locking-bytecode, token-category, and read-only commitment preservation tails are shared by
  compact offset. Delegate paths remain inline for the same altstack reason.
- Written-NFT output commitment lookup is shared by compact offset, and literal index zero on a variable-width
  array bypasses the scan loop entirely.
- Captured helpers record helper-to-helper dependencies, and dead-definition removal retains reachable
  dependencies.
- Helper extraction compares actual encoded definition and invocation sizes against repeated inline emission.
- Dynamic compiler helpers receive collision-free compact IDs after reserving every user function ID.
- Fixed compiler helpers use compact negative IDs. User and library function IDs are allocated monotonically
  from zero, so the two ID domains cannot collide.
- Deep stack replacement uses two balanced counted loops once repeated `OP_ROLL` emission becomes larger.

Neutral transformations remain valuable as general code-generation cleanup even though this MarketplaceV1
source does not exercise them enough to change its total. These are identified as zero-byte stages in the table.

## Validation

The final 81862.5-byte measurement was produced after a clean `solidc` build. The complete monorepo test run
passed:

| Workspace | Result |
| --- | ---: |
| solidc | 2250 passed |
| solidcash, including VM/e2e tests | 3178 passed, 23 skipped, 9 todo |
| utils | 288 passed, 1 todo |
| testing | 10 passed |
| Focused C2, array, and struct/mapping set | 114 passed |

The skipped tests remain existing tracked follow-up work and were not silently enabled or removed by this
optimization series. `yarn lint` is not currently a clean repository gate: it reports 240 existing errors across
the wider tree. The changed compiler builds successfully, all tests above pass, and `git diff --check` is clean.

The 89609-byte checkpoint is recorded by commit `ac264683`; the later rows extend that same general optimization
series.

## Rejected and deferred candidates

Complete `array[i].field` fusion was prototyped but removed: the semantic lowering has already separated that
shape before generation, and the independently shared array/field helpers are the reachable canonical form.
Whole dynamic-state-read extraction was also rejected because its emitted loop depends on function-specific
block layout, preceding collection/dynamic reads, and tracked stack depths; treating it as a context-free helper
would be unsound.

Arbitrary repeated bytecode-block or tail extraction was also rejected. Raw post-generation blocks do not carry
the stack signature, branch ownership, source-map relocation, or nested helper dependencies needed to prove that
an `OP_DEFINE` replacement is equivalent.

Function-wide dynamic-state read caching remains deferred. Hoisting a conditional read can require chunk inputs
on transaction paths that previously did not access the value, while caching through writes requires precise
branch, loop, return, and invalidation handling. The existing loop-specific semantic cache remains the safe form;
a broader cache should be implemented only with path-sensitive analysis and dedicated transaction-level tests.

Frequency-based ID assignment was reconsidered after compact fixed and dynamic IDs landed. The only remaining
special one-byte Script Number encodings are already occupied by user functions or the most common fixed helper;
further remapping would change function IDs and require coordinated artifact/SDK migration for negligible
expected savings.

Straight-line fixed-state CSE is currently dominated by shared state-read helpers: a repeated read is a compact
ID plus `OP_INVOKE`, while retaining a cached value requires duplication, indexed retrieval, lifetime tracking,
and cleanup. Dynamic reads can still justify caching, but only with the path-sensitive constraints above.
