# Deprecated names kept by the per-call -> framed rename

The convention is called `framed` from the 2026-10-06 rename (`391208e7a`, `369b34419`, `88c026992`). This file
is the complete list of what still answers to the old spelling, and what does not. It exists so the deprecation
policy can be decided at the release gate rather than inferred from the diff.

## Kept as deprecated aliases (accepted, but not published)

| surface | where | behaviour |
|---|---|---|
| `CompilerOptions.composition: 'per-call'` | `packages/utils/src/artifact.ts` (type), `packages/solidc/src/framed/master/composition.ts` (`resolveCompositionConvention`) | resolves to `'framed'` before the allow-list check, so every internal comparison and the published artifact see one value. `normalizeCompilerOptions` writes the resolved value back (`88c026992`), so the old literal cannot reach an artifact |
| `artifact.composition.convention: 'per-call'` | `packages/utils/src/artifact.ts` (published shape read type), `packages/solidc/src/compiler.ts` (the delegate-pass guard) | an artifact produced by an earlier compiler is still recognised. The compiler publishes `'framed'` |
| `perCallComposer`, `perCallReference`, `perCallDeploy`, `perCallRead`, `perCallCall`, `perCallReceipt`, `perCallQueue` | `packages/solidcash/src/index.ts` | `export * as` re-exports of the same `framed/**` modules, marked `@deprecated` in JSDoc |

The deprecated option value is covered by a test in
`packages/solidc/test/framed/master/composition-convention.test.ts` ("compiles the deprecated per-call name to
the same master as framed"), which asserts the artifact publishes `convention: 'framed'` and that its bytecode is
identical to the `'framed'` compile. The namespace aliases were checked at runtime against `dist`: both spellings
expose the same 12 keys.

## Renamed outright (no alias)

| surface | new name |
|---|---|
| error classes in the SDK module | `FramedGenesisError`, `FramedDeployError`, `FramedResizeError`, `FramedRecordError`, `FramedDeploymentError`, `FramedComposerError`, `FramedCompositionRefusedError`, `FramedReadError`, `FramedCallError`, `FramedProxyDeployError`, ... |
| solidc diagnostics | `FramedStaleReadError`, `FramedAliasedReadError`, and the code `FRAMED_CODEGEN_UNAVAILABLE` (was `PER_CALL_CODEGEN_UNAVAILABLE`) |
| exported functions | `callFramedEntry`, `callFramedProxyEntry`, `deployFramedStatefulContract`, `readFramedEntry`, `assessFramedMasterShape`, ... |
| environment knobs | `FRAMED_AHEAD`, `FRAMED_FULL` and any other `PER_CALL_*` (note: no tracked code currently reads the `*_AHEAD` knob; the docs and tests were renamed consistently) |
| paths | `packages/{solidc,solidcash,utils}/src/framed`, their `test/framed` trees, `packages/testing/test/framed`, `docs/framed`, `packages/*/vitest.framed.config.ts`, `tsconfig.framed-tests.json` |

## Questions this raises for the release

1. Do the four kept surfaces stay through `solidcash_v0.13.1`, or should the release already refuse the old
   spelling and turn the alias into a warning? The plan says "for one release".
2. Should the renamed error classes keep a deprecated `PerCall*Error` export as well? They are exported from the
   moved module, so an out-of-tree consumer importing `PerCallCallError` from the package index would break; the
   index re-exports only the seven namespaces, and those namespaces now carry the `Framed*` classes.
3. Should the deprecated option value emit a deprecation notice (console warning or diagnostic) instead of
   resolving silently? Today it resolves silently, which keeps the alias invisible in tests.
4. Is the diagnostic code rename (`PER_CALL_CODEGEN_UNAVAILABLE` -> `FRAMED_CODEGEN_UNAVAILABLE`) acceptable for a
   minor release, or does it need a compatibility code list for one release?
