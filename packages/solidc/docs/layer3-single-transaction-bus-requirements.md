# Layer 3 single-transaction bus requirements and baseline census

## Security requirements matrix

| ID | Requirement | Verified direct evidence |
|---|---|---|
| S1 | One canonical transcript | Every verifier carries the same first-push carrier; the verifier authenticates its carrier hash and commits the typed transcript/master-witness digest into its recreated NFT, and hostile carrier mutations fail in the VM. |
| S2 | Exact participant set | `Layer3SingleTxGraph` binds code and category identities; `Layer3SingleTxBalancedAssembly` and compose fan-out/repeated-call hostile cases reject hidden, substituted, duplicated, reordered, or retargeted participants. |
| S3 | Contiguous blocks | Codec and balanced-assembly tests reject gaps, overlap, zero-size blocks, hidden masters, padding, and a nonterminal fee/change slot; variable-span tests prove later bases are prefix sums of authenticated actual use rather than absolute indices or maximum-capacity padding. |
| S4 | Active membership | Every master pins its exact compiler-supplied verifier index, artifact lock, category, and active-input argument; balanced assembly rejects hidden masters and unframed tails. |
| S5 | Exact row consumption | Codec count/EOF tests plus `GraphEmissionVerificationInvariant` and compose drop/duplicate/swap, branch, loop, result, event, resource, value, token, and sidecar mutations prove complete consumption for every row family. |
| S6 | Call authenticity | Compose VM tests reject caller, selector, mode, calldata, argument, result, target, order, reachability, and occurrence mutations; compiler metadata authors the admitted rows. |
| S7 | State authenticity | Compose VM tests cover scalar masters, mapping entries, dynamic chunk create/delete, satoshi containers, FT containers, and NFT capability/commitment transitions at exact slots. |
| S8 | Effect authenticity | Compose event, BCH, repeated FT, and NFT capstones reject forged, redirected, dropped, or physically mutated effect rows and outputs. |
| S9 | No replay authority | Verifier NFTs are self-preserved attestations, not execution authority; participant UTXOs prevent replay, and live capacity evidence rejects a second submission of finalized bytes. |
| S10 | No circular commitment | Carrier bytes and the typed 32-byte binding digest are signer-independent; verifier outputs attest that digest rather than signatures or the complete unlocking bytecode, and the two-party test proves the carrier remains stable while signatures regenerate. |
| S11 | Fail closed | `TranscriptIneligibilityMatrixV1`, bounded-collection tests, and delegate tests prove named/positioned refusal of unsupported introspection, lifecycle/unsafe, opaque effects, foreign try/catch, dynamic cardinality, static descendants, and delegate context. |
| S12 | Capacity | `Layer3SingleTxCapacity` evaluates and pins all inputs at 2/4/5/8 participants, the protocol rejects nine, the live eight-party shape broadcasts, and `Layer3SingleTxCapacityLimit` publishes/enforces eight. |

## Controller-era production dependencies

The following inventory is scoped to production source. Test migration is classified separately.

| Area | Files / fields | Migration |
|---|---|---|
| Compiler options | `packages/solidc/src/compiler.ts`: `messageBusController`, `messageBusControllerCategory`, `__testLayer3BindingSpike` | Replace controller options with inferred participation; remove test bypass |
| Semantic admission | `packages/solidc/src/semantic/SymbolTableTraversal.ts`: controller/category validation and hidden-route admission | Preserve handler discovery; replace controller preamble and explicit admission |
| Code generation | `packages/solidc/src/generation/GenerateTargetTraversal.ts`: SCB1 graph controller index, participant offset, settlement/emission/caller frames | Preserve journals/local frames; emit artifact-specialized verifier program plus compact master binder |
| Artifact model | `packages/utils/src/Artifact.ts` and compiler artifact construction: hidden-batch route/block metadata and controller-bound fields | Preserve block descriptors; publish versionless carrier placement and verifier program metadata |
| Graph planner/codec | `packages/solidcash/src/layer3/graph.ts`, `codec.ts`, `hidden-batch.ts` | Preserve planning/local SCB1 encoding; replace `L3GRAPH1`, projection indices, root, and controller argument |
| Controller covenants | `packages/solidcash/src/layer3/covenant.ts`, `graph.ts`: generated root controller and projection verifier | Delete after equivalent participant VM evidence |
| Assembly | `packages/solidcash/src/layer3/transcript.ts`, `packages/solidcash/src/stateful/balancedBlocks.ts` | Replace controller/projection tail with participant prefix, one verifier per participant, and fee/change |
| Preflight | `packages/solidcash/src/layer3/preflight.ts`, `TransactionBuilder.ts` | Preserve finalized-byte and capacity gates; remove controller NFT/category scans |
| Public exports | `packages/solidcash/src/layer3/index.ts`, `packages/solidcash/src/index.ts` | Export codec/layout and final `compose` API; remove genesis/controller helpers |

Repository census at baseline `aa562953`: 121 compiler/SDK source and test files contain one of the concrete
controller/projection API names used by the migration search. Reproduce with:

```bash
rg -l 'messageBusController|messageBusControllerCategory|generateGraphProjectionVerifier|generateGraphRootController|projectionInputs|controllerInput' \
  packages/solidc/src packages/solidcash/src packages/solidc/test packages/solidcash/test | wc -l
```

## Test classification

| Class | Corpus | Treatment |
|---|---|---|
| Reusable | Compiler journal, pointer-table, occurrence, result-dependency, diagnostic-position, and hidden-batch encoding tests that assert no controller detail | Run unchanged; preserve as local semantic evidence |
| Adaptable | `Layer3CompiledGraph`, balanced assembly, result graph, mapping/mixed/dynamic journals, context, call options, effects, capacity, and security-review VM suites | Retain scenarios and mutations; rebuild fixtures with carrier plus participant blocks |
| Obsolete | `Layer3CompiledGraphController`, event subscription controller, controller genesis/burn/contention tests, projection-only parser/cost pins, and `Layer3ParticipantBindingSpike` | Delete only after replacement evidence lands |

The precise migration list is discoverable by the command above; a test is not deleted merely because its
filename mentions a controller. Hostile cases remain adaptable whenever they express a protocol invariant.

## Executable baseline and measured figures

`packages/solidcash/test/Layer3CompiledGraph.test.ts` pins the generated controller at 2,810 bytes and each
projection verifier at 5,820 bytes. Its physical-layout tests pin the old tail as `N` projection slots, one
controller, then one fee slot. `Layer3BoundedMaximumGraphC3.test.ts` records the eight-participant C3 transaction
at 96,302 bytes and 108 balanced slots, inside the 100,000-byte standard relay ceiling; it evaluates all inputs
to completion and asserts that none exceed BCH-2026 operation-cost density. The deployed planner bounds are
eight participants, 24 invocations, depth seven, and 223 bytes per hidden-batch blob.

The new executable census is `Layer3SingleTxCodec.test.ts`: it pins the controllerless 2/3/1 actual-span layout
to participant bases `[0,2,5]`, verifier inputs `[6,7,8]`, fee input 9, and ten total paired slots. It also proves that changing the
first participant from one to five trailing chunks relocates the second participant by prefix sum without
changing either participant's local rows. This shows the architectural delta
without deleting the old measurements. The first two historical fixtures were deliberately removed in Phase
6; reproduce their figures only by checking out baseline `aa562953`. The surviving controllerless census runs
on this branch:

```bash
cd packages/solidcash
yarn test --run test/Layer3SingleTxCodec.test.ts
```
