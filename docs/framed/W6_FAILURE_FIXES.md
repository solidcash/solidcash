# W6 step 3: the fixes for the 29 unrecorded failures

Companion to `W6_NEW_FAILURE_CLASSIFICATION.md`, which named six first-bad windows. This note records what each
window actually was and the fix, as the fixes land. Attribution was done by linear scans over the window in
isolated worktrees (each with its own `node_modules`), rebuilding the compiler per revision:

    npx tsc -b packages/solidc/tsconfig.build.json --force
    node_modules/.bin/vitest run [--config vitest.e2e.config.ts] <file> -t '<title>' --maxWorkers=1

Runs whose whole-tree `tsc -b` fails (the branch has a stretch that does not typecheck as a whole) are skipped;
those stretches are noted below where they limit attribution.

## The fixes

| group | titles | first-bad commit | fix |
|---|---|---|---|
| G1 | 2 (solidc `InlineAssemblyYul`, `solidity-compat/yul-evm`) | `ce2f7bba1` | `add6f3c71` |
| G2 | 1 (solidc `ComputeSideCarRecipes`) | `b6ee86a3f` | `07950282c` |
| G3 | 2 (`test/unit/ExternalCallPredicate`) | `a2bcdb614` | pending |
| G4 | 13 (direct/kernel layout) | `598b92837`, `0cffcb936` | pending |
| G5 | 7 (six `test/e2e/Upgrade.test.ts`, `KernelSelfdestructStateCompose`) | `d532aa32a` | `3d90af923` |
| G6 | 3 (the two Kernel*Result* compose titles and `KernelResultTopology`) | `fcb3aff77`, `f4a00d3ff` | pending |

The causes, one per group:

- G1: the new rule nested trailing statements into any preceding block holding a return, even one that already
  ends every path. The dead tail then landed inside the aborting arm, and the rule also accepted a path the
  unconfined-return refusal had rejected. `add6f3c71` reverts that hunk; no test depended on it.
- G2: `containsProducerResult` dropped the whole pre-call require, and the side-car recipe is derived only from
  `externalCalls[].preCallRequires`, so no recipe was produced. `07950282c` exempts a Keccak/`ECDSA.recover`
  compute call from the producer-result rejection.
- G3: caching a repeated whole-struct mapping assign changed the published predicate and dropped a dominating
  field type.
- G4: `598b92837` (loop-cached dynamic-array flush guard) fails `DynamicWriteBehavior`; `0cffcb936` (single-arm
  chunkable write) fails the other twelve.
- G5: the `carriesDataNfts` fallback emitted the auto covenant verification for any body listing data NFTs,
  including upgrade, deploy and unsafe bodies that list the full set for their modifier while their own code
  touches none. `3d90af923` limits the fallback to `FunctionModifier.DELEGATE` entries, which is what that
  commit targeted.
- G6: `fcb3aff77` (a hand-prepared edge judged by argument value) fails `KernelMultiProducerResultCompose`;
  `f4a00d3ff` (a legacy unrolled loop resolved by cardinality) fails `KernelResultTopology`.

The one failure that is not a regression is `ExactAdditiveRecurrenceSecurity` - "caps rank at 64": it passes
alone at HEAD (82 s and 10 s on two runs) and only timed out under full-suite load against the 120 s config cap.

## Evidence details

- G5 scan (`g5-scan.log`): `ef807a50a` through `da1682e3c` PASS, `d532aa32a` FAIL, every later revision FAIL.
  With `3d90af923` applied, `Upgrade.test.ts` is 24/24 and `KernelSelfdestructStateCompose` is 1/1, while
  `OzBchNativeInheritance.test.ts` (the title `d532aa32a` was written for, including its forced-split shard
  plan) still passes 4/4.
- G4 scan (`g4-scan.log`): `DynamicWriteBehavior` flips at `598b92837`; the `KernelDirectComputedChunks` title
  flips at `0cffcb936`. `WitnessAbiPublication` flips at `0cffcb936` as well.
- G3 scan (`g3g6-scan.log`): both `ExternalCallPredicate` titles pass at `b1888210f` and fail at `a2bcdb614`.
- G6 scan (`g3g6-scan.log`): `KernelMultiProducerResultCompose` passes through `1f55b6e9c` and fails at
  `fcb3aff77`; `KernelResultTopology` passes through `89a09a273` and fails at `f4a00d3ff`.
- The window between `6245bccbd` and `03dd2b15c` does not typecheck as a whole (`LowerVMapCounterLoops.ts` and
  `stored-value-source.ts` disagree with `AST.ts` at those revisions), and `391208e7a` cannot build for the same
  reason. Every boundary above was still observed on both sides of the non-buildable stretch.
