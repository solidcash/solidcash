# The framed compile with the message bus off

Read from the compiler at `feat/framed`. No compile was timed. The 60-100s marketplace fixture keeps `messageBus: true`, `messageBusKernel: true`, and `optimizeForCompilationSpeed: true`.

An explicit `messageBus: false` is a different path. `normalizeCompilerOptions` sets `__messageBusMode` to `disabled` and forces `messageBusKernel` false (`compiler.ts` around 1118-1144). `compileWithExternalAdmissionFallback` then returns `compileOnce(true)` at line 2185 and never enters the admission ladder. The fast fixture does not take that return.

`compileResolvedAst` runs `UnrollFixedBoundEntryLoop`, `LowerVMapCounterLoops`, and `CacheMappingEntryInLoop` only when both `messageBus` and `messageBusKernel` are true (`compiler.ts` 14623-14639). With the bus off that block does not run. The loops stay in the source, the direct sorted-map upsert emits them, and the outliner searches that larger program.

That is not one of the six merge seams. Those seams are gated so a framed compile with the bus on keeps its pre-merge behaviour. The slow path is the explicit bus-off fork. The nearest seam is graph-free auto narrowing, which can set `messageBus` false while leaving the kernel on. An explicit `messageBus: false` is stricter: it also forces the kernel off.

Two superlinear steps sit on the path. Which one accounts for the abandoned 30 minutes is not measured:

- `popFromStack` shifting inside the direct upsert loop body, twice per entry.
- `findCandidates` inside `outlineSharedFunctionBodies` once the direct program is large.

A shape the legacy lowerer refuses, and that the upsert emitter does not recognize, throws `SortedMappingCodegenPendingError` instead of hanging. The 30-minute run got past that check.

`messageBusKernel: false` with `messageBus` left true stays on the ladder. It is not this path.
