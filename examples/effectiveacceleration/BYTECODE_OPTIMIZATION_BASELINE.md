# EffectiveAcceleration bytecode optimization baseline

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
| **Current total** | **89609** | **84924 (48.7%)** |

Relative to the same-source 461310-byte measurement before the structural-sharing follow-ups, the current
artifact is 371701 bytes smaller (80.6%).

Complete `array[i].field` fusion was prototyped but removed: the semantic lowering has already separated that
shape before generation, and the independently shared array/field helpers are the reachable canonical form.
Whole dynamic-state-read extraction was also rejected because its emitted loop depends on function-specific
block layout, preceding collection/dynamic reads, and tracked stack depths; treating it as a context-free helper
would be unsound.
