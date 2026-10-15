# Offline marketplace stock-limit inventory

Measured against the current complete marketplace artifacts and the pinned libauth BCH_2026_05 VM.
No node or transaction execution is performed by this script. Regenerate with
`node scripts/marketplace-stock-inventory.mjs`. All sizes and margins below are bytes.

The stock redeem-script stack-item ceiling is **10000**; the complete unlocking
script has a separate **10000** consensus ceiling and
**10000** relay-policy ceiling. Redeem scripts must be pushed
inside that unlocking script, alongside every argument and witness; a positive margin here does not
establish that a spend fits. A negative margin already rules out an ordinary P2SH spend.

| Artifact / participant | Redeem script | Stack-item margin |
| --- | ---: | ---: |
| FakeToken master | 22356 | -12356 |
| MarketplaceDataV1 master | 74011 | -64011 |
| MarketplaceV1 master | 94012 | -84012 |
| Unicrow master | 33975 | -23975 |
| UnicrowArbitrator master | 20343 | -10343 |
| UnicrowClaim master | 16927 | -6927 |
| UnicrowDispute master | 21404 | -11404 |
| MarketplaceV1Proxy proxy master | 3856 | 6144 |
| MarketplaceDataV1Proxy proxy master | 3582 | 6418 |
| shared validator head, including category pin | 8367 | 1633 |
| shared validator facet 1 | 5669 | 4331 |

No separate delegate artifact is published in this framed fixture: implementation DELEGATE frames use
the implementation master program measured above.
Generated proxies are measured through the shipped
source generator with the same layout options. Compiler warning printing alone is suppressed.

The validator facets have no argument pushes: their complete unlocking scripts are just their
redeem-script pushes. The head additionally carries the encoded transcript.

| Facet | Complete unlocking script | Consensus margin | Relay margin |
| --- | ---: | ---: | ---: |
| 1 | 5672 | 4328 | 4328 |

State defaults are exact encodings of the schema defaults, not measured deployed commitments.
They are lower-bound examples, not maximum-field claims. The artifact ceiling is a published
encoding allowance, not evidence that a particular call requires that size. Stock commitments are
limited to **128** bytes. Full chunk/sorted-node commitments can use all 128.

| State owner | Default record sizes | Published commitment ceiling | Smallest default margin | Published-ceiling margin |
| --- | ---: | ---: | ---: | ---: |
| FakeToken | 4 | 10000000 | 124 | -9999872 |
| MarketplaceDataV1 | 8 | 10000000 | 120 | -9999872 |
| MarketplaceV1 | 13 | 10000000 | 115 | -9999872 |
| Unicrow | 3, 6 | 10000000 | 122 | -9999872 |
| UnicrowArbitrator | 4 | 10000000 | 124 | -9999872 |
| UnicrowClaim | 7 | 10000000 | 121 | -9999872 |
| UnicrowDispute | 5 | 10000000 | 123 | -9999872 |
| MarketplaceV1Proxy | 13, 2 | 10000000 | 115 | -9999872 |
| MarketplaceDataV1Proxy | 8, 2 | 10000000 | 120 | -9999872 |

Stock transaction consensus size: **1000000**; relay policy:
**100000**. Operation budget per input is
**800 × (41 + encoded unlocking bytes)**.
Hash-iteration density is **3.5** at consensus and
**0.5** under relay policy. Input bytes, transaction bytes, actual
commitments, hashing and operation costs require a concrete encoded transaction and per-input VM
measurement. This static inventory does not claim deployability; no oversized participant is run with
stock limits. The enlarged semantic fixture remains unchanged.

Limits come from the pinned libauth consensus objects in `node_modules/@bitauth/libauth/build/lib/vm/
instruction-sets/bch/{2023,2025,2026}/*consensus.js`; BCH_SPEC is a separate internal-evaluation profile.
Pin: `1cf4b432864b3a4ed9f33d1992355d7286f3dab8` (root package.json).

| Input artifact | SHA-256 of JSON |
| --- | --- |
| FakeToken | c545e91f2adb5e11bd07c4009e11de7f07068661679cf5b7da5cf52c15ddf882 |
| IERC1155Errors | 2ca72b69d3133c8176aae1968c85074e0dc2b163fa0a8a6783d70954f22bfe22 |
| IERC20 | 0e9bae296b04cddd88f213cf1fb61b386cbb11ed909c4b9cdce21161557ddae1 |
| IERC20Errors | 550f2ab3c00ae71b547b7b1ef219801597d6f8f8604d91092de2e9f9957d7c96 |
| IERC20Metadata | cd1eef6eaad76f1f7eee3579d2ea2c4b1e8590d0dd5eb705e981f295dff97714 |
| IERC20Permit | 4ec477bf44718100239c79b263bc51e1609fb03a27b39106e56556f82053b19d |
| IERC721Errors | 7916138b82aea0b7388e63a69e20affd44ca445dbaf4edc2b83bc7bf2db92393 |
| IUnicrow | fa08332ef48d7c51d1ae46419d31a0e19c91e6fcf6ee57c343760ced1ccc9399 |
| IUnicrowArbitrator | 9fb4fc3f62a49b7b56048c967a8fc2f088de9ae1286cbc7edd522b9f956c6b34 |
| IUnicrowClaim | 1bf98bcdc4b3866ee1332e76f16ca8393e7f28b8f113f1e142cab36b299f9ac2 |
| IUnicrowClaimRewards | eb0db77fb7cc37d89a434012957904463cf9dd2effdd8e98c0d6b69dd470b704 |
| IUnicrowDispute | c81b8af1479d788426939f6049c5bb20ee78c3d74b5e3791bc0fa1a225d411e2 |
| IUnicrowStakingRewards | b25f1f0a9cc802d5302bc0623d2c9cc3e79f9efc18af77e2c63f0292c12f12f0 |
| MarketplaceDataV1 | 9515ae54b0365890ff843f5fb5e903ada640ac891ddf4294e541bf86e1fcc1d4 |
| MarketplaceV1 | 3b0880a7e47d7e6c23ac927575b25ba49b308e061e05a06e1ee88e5d8f433106 |
| Unicrow | a8874b7f97cb129ee8c2ccbc470db48d203ee72983e27f524cd1eeda0480c5c6 |
| UnicrowArbitrator | 28c7ba807b400fc74c7b0c539fac8f7806cbcedb2c4ff2a027c92f1ad62a1fa5 |
| UnicrowClaim | 34934f0418749e0ffff3a7b3f220def07b67c813821f878fc610dd91001321f7 |
| UnicrowDispute | ee4c302f318cd91c552081e951b8ba9a4d9cc2126ec632c20afca55da1fc6ffe |

19 input artifacts; 7 executable artifacts;
12 interface-only artifacts publish no redeem script.
