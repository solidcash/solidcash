# Layer 3 single-transaction bus requirements and baseline census

## Security requirements matrix

| ID | Requirement | Planned direct evidence |
|---|---|---|
| S1 | One physical transcript | Pure carrier EOF/mutation tests; VM mutation of input-zero carrier while all participant routes execute |
| S2 | Exact participant set | Codec identity mutations; VM omit/duplicate/substitute/reorder cases |
| S3 | Contiguous blocks | Pure gap/overlap/zero-size tests; VM block-base and block-size mutations |
| S4 | Active membership | VM wrong active input, non-master offset, duplicate master, and absent master cases |
| S5 | Exact row consumption | Pure count/EOF tests; VM mutation and appended-suffix cases for every row family |
| S6 | Call authenticity | Compiler policy tests plus selector/mode/args/result/caller/order/occurrence hostile VM cases |
| S7 | State authenticity | Existing scalar, mapping, array, dynamic chunk, satoshi, and token hostile fixtures adapted without projections |
| S8 | Effect authenticity | Existing value/token/event/return-event mutation fixtures adapted to mutual verification |
| S9 | No replay authority | Assembly assertion that only participant/resource/fee inputs exist; live double-spend rejection |
| S10 | No circular commitment | Offline build-before-sign test and byte-stability assertion after every signature |
| S11 | Fail closed | Named positioned compiler diagnostics for recursion, aliases, cardinality, delegate, introspection, and effects |
| S12 | Capacity | Run-to-completion cost/size measurements at 2, 4, and 8 participants; artifact and SDK limit tests |

## Controller-era production dependencies

The following inventory is scoped to production source. Test migration is classified separately.

| Area | Files / fields | Migration |
|---|---|---|
| Compiler options | `packages/solidc/src/compiler.ts`: `messageBusController`, `messageBusControllerCategory`, `__testLayer3BindingSpike` | Replace controller options with inferred participation; remove test bypass |
| Semantic admission | `packages/solidc/src/semantic/SymbolTableTraversal.ts`: controller/category validation and hidden-route admission | Preserve handler discovery; replace controller preamble and explicit admission |
| Code generation | `packages/solidc/src/generation/GenerateTargetTraversal.ts`: SCB1 graph controller index, participant offset, settlement/emission/caller frames | Preserve journals and local frames; extract carrier input zero and mutually verify global/local rows |
| Artifact model | `packages/utils/src/Artifact.ts` and compiler artifact construction: hidden-batch route/block metadata and controller-bound fields | Preserve block descriptors; publish controllerless carrier/policy/version/capacity metadata |
| Graph planner/codec | `packages/solidcash/src/layer3/graph.ts`, `codec.ts`, `hidden-batch.ts` | Preserve planning/local SCB1 encoding; replace `L3GRAPH1`, projection indices, root, and controller argument |
| Controller covenants | `packages/solidcash/src/layer3/covenant.ts`, `graph.ts`: generated root controller and projection verifier | Delete after equivalent participant VM evidence |
| Assembly | `packages/solidcash/src/layer3/transcript.ts`, `packages/solidcash/src/stateful/balancedBlocks.ts` | Replace controller/projection tail with participant prefix plus fee/change |
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

The new executable census is `Layer3SingleTxCodec.test.ts`: it pins the controllerless 2/3/1 block layout to
participant bases `[0,2,5]`, fee input 6, and seven total paired slots. This shows the architectural delta
without deleting the old measurements. Full baseline reproduction commands are:

```bash
cd packages/solidcash
yarn test --run test/Layer3CompiledGraph.test.ts
yarn test --run test/e2e/Layer3BoundedMaximumGraphC3.test.ts
yarn test --run test/Layer3SingleTxCodec.test.ts
```
