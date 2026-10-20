# W6 step 2: classification of the 29 full-suite failures with no baseline row

Scope: the 29 titles in `W6_FULL_SUITE_AT_HEAD.md` that match no row in `W6_BASELINE.md` or
`W6_KNOWN_FAILURES.md` (4 solidc, 13 solidcash, 12 `test/e2e`). Worktree `/Code/cashscript/.worktrees/per-call`,
branch `feat/per-call`. Run revision `3fc4c2fe9`; classification tree `ed85c853f`, which is source-identical to
`3fc4c2fe9` (only docs commits sit between them). HEAD advanced to `2e6192b31` during the work with docs,
comment and type-only import commits, none of which changes the findings below.

In the table, `R` is regression and `E` is environment (load-induced). `solidc/` abbreviates
`packages/solidc/test/`, and `sc/` abbreviates `packages/solidcash/test/`. `pass->fail` is the bounding revision
pair (the title passes at the first revision and fails at the second). The full titles are in
`W6_FULL_SUITE_AT_HEAD.md`; the table keeps them short. Evidence commands, logs and the expanded suspect ranges
are in the sections after the table.

## The 29 titles

| # | file | title (short) | verdict | pass->fail | group |
|---|---|---|---|---|---|
| 1 | solidc/ComputeSideCarRecipes | binds nested Keccak operands | R | f8c8db06f->bbab3e0e0 | G2 |
| 2 | solidc/InlineAssemblyYul | reverting switch arm ends the path | R | 6837f767d->ce2f7bba1 | G1 |
| 3 | solidc/WitnessAbiPublication | no invented fold witnesses | R | bcf17883e->ef807a50a | G4 |
| 4 | solidc/solidity-compat/yul-evm | switch without default not definite init | R | 6837f767d->ce2f7bba1 | G1 |
| 5 | sc/unit/ExternalCallPredicate | field from mapping state struct write | R | bbab3e0e0->6837f767d | G3 |
| 6 | sc/unit/ExternalCallPredicate | dominating field type, packed args | R | bbab3e0e0->6837f767d | G3 |
| 7 | sc/jmb/e2e/ExactAdditiveRecurrenceSecurity | scalar state, rank cap 64 | E, load | alone at HEAD x2 | - |
| 8 | sc/jmb/e2e/KernelChunkedMappingStructCompose | oversized scalar struct insert | R | bcf17883e->ef807a50a | G4 |
| 9 | sc/jmb/e2e/KernelComposeLayoutWitnesses | Store unlocker valueChunk layout | R | bcf17883e->ef807a50a | G4 |
| 10 | sc/jmb/e2e/KernelMixedArrayMappingJournal | rejects forged mapping entry output | R | bcf17883e->ef807a50a | G4 |
| 11 | sc/jmb/e2e/KernelMultiProducerResultCompose | two producer IDs, swapped lanes | R | af6d23cb5->19f6c28b5 | G6 |
| 12 | sc/jmb/e2e/KernelMultiResultGraphParity | authenticated tuple lanes | R | af6d23cb5->19f6c28b5 | G6 |
| 13 | sc/jmb/e2e/KernelSchemaNameIsolation | stored-element recipe with decoy | R | bcf17883e->ef807a50a | G4 |
| 14 | sc/jmb/e2e/KernelSchemaNameIsolation | no authority from historical names | R | bcf17883e->ef807a50a | G4 |
| 15 | sc/jmb/e2e/KernelSchemaNameIsolation | typed bigint left shift in recipe | R | bcf17883e->ef807a50a | G4 |
| 16 | sc/jmb/e2e/KernelSelfdestructStateCompose | kill() with fixed dataNft | R | ef807a50a->af6d23cb5 | G5 |
| 17 | sc/jmb/e2e/MessageBusEventIdentity | shared emit slot event covenant | R | bcf17883e->ef807a50a | G4 |
| 18 | sc/e2e/DynamicWriteBehavior | conditional array-element re-write | R | bcf17883e->ef807a50a | G4 |
| 19 | sc/e2e/KernelDirectComputedChunks | computed 219-byte value | R | bcf17883e->ef807a50a | G4 |
| 20 | sc/e2e/KernelDirectComputedChunks | computed 400-byte value | R | bcf17883e->ef807a50a | G4 |
| 21 | sc/e2e/KernelDirectWitnessAbi | caller identity coordinates | R | bcf17883e->ef807a50a | G4 |
| 22 | sc/e2e/KernelDistinctEntryRows | distinct/repeated/self recipients | R | bcf17883e->ef807a50a | G4 |
| 23 | sc/e2e/KernelResultTopology | refuses unproven later loop | R | af6d23cb5->19f6c28b5 | G6 |
| 24 | sc/e2e/Upgrade | V1 to V3, new field default | R | ef807a50a->af6d23cb5 | G5 |
| 25 | sc/e2e/Upgrade | V3 logic after upgrade | R | ef807a50a->af6d23cb5 | G5 |
| 26 | sc/e2e/Upgrade | chain V1 -> V2 -> V3 | R | ef807a50a->af6d23cb5 | G5 |
| 27 | sc/e2e/Upgrade | mint new data NFT on overflow | R | ef807a50a->af6d23cb5 | G5 |
| 28 | sc/e2e/Upgrade | V2 logic with new data NFT | R | ef807a50a->af6d23cb5 | G5 |
| 29 | sc/e2e/Upgrade | SIGHASH_ALL settle and refusals | R | ef807a50a->af6d23cb5 | G5 |

## Method and evidence

Every source/test file behind these titles is unchanged between the baseline `295f6eed6` and HEAD except
`sc/unit/ExternalCallPredicate.test.ts` (last touched by the lint commit `9f987d8ac`). So a title that passes at
`295f6eed6` and fails at HEAD is a product regression whose cause is a source commit in `295f6eed6..HEAD`.

Cheapest decisive test used, per failure:

1. Re-run the failing file alone at HEAD in an isolated copy tree (rules out load-induced failures).
2. Re-run the same file alone at older revisions in the same isolated tree: baseline `295f6eed6`, mid-window
   pivots, the lint parent `19f6c28b5`, and the file's own last-touching commit or its parent.
3. Fix the pass-to-fail boundary by bisecting the isolated tree.

Recipe per revision (isolated tree copied once from the finished harness):

    rm -rf packages/*/src packages/*/dist packages/*/test examples docs
    find . -path ./node_modules -prune -o -name '*.tsbuildinfo' -print0 | xargs -0 -r rm -f
    git -C /Code/cashscript/.worktrees/per-call archive <rev> -- packages examples 'tsconfig*' \
      'vitest*.config.ts' package.json lerna.json scripts | tar -x
    node_modules/.bin/tsc -b tsconfig.packages.json --force

Per file, alone:

    cd <tree>/packages/<pkg> && SOLIDC_COMPILE_CACHE_DIR=<scratch-cache> ../../node_modules/.bin/vitest run <file>

Logs live in `/tmp/grok-goal-4b830698eeec/implementer/classify/`: `alone-HEAD/`, `alone-295/`, `alone-p1/`
through `alone-p9/`, `lintparent-alone.log`, `p5-*.log`, `p7-*.log`, `p8-*.log`, `recheck-ear-*.log`. The reused
isolated tree is `.../classify/tree`; each reset is in `*-build.log`, and each `*-alone.log` holds one line per
file. Pivots tested: `295f6eed6`, `19f6c28b5` (lint parent), `6e0b121e0`, `af6d23cb5`, `ef807a50a`, `6837f767d`,
`ce2f7bba1`, `f8c8db06f`, `bbab3e0e0`, `bcf17883e`. One reset (`ce2d6dbe4`) failed to typecheck, which is the
known non-buildable stretch discussed in G2.

The lint commit `9f987d8ac` is exonerated: it is the only source-and-test commit immediately before the run
revision, but all 19 re-runnable files still fail at its parent `19f6c28b5`, so it introduced none of these.

Load check: only title 7 fails under load and passes alone. Every other title was reproduced in a single
isolated run, and each pass-to-fail boundary below was observed at two or more revisions, so no title is marked
flaky.

## Suspect ranges (the first-bad window)

Each group below names the bounding revisions tested, the titles in it, the source commits inside the range, and
the logs.

### G1: exact commit `ce2f7bba1` (titles 2, 4)

`solidc/src/semantic/EarlyReturnTransformation.ts` was changed only by `ce2f7bba1`
(`fix(solidc): nest statements after a conditional assembly return`), adding a rule that nests statements after a
block holding a return. Both titles pass at its parent `6837f767d` and fail at `ce2f7bba1`
(`p5-InlineAssemblyYul.test.ts.log`, `p5-yul-evm.test.ts.log`). This is the one range pinned to a single commit.

### G2: `f8c8db06f..bbab3e0e0` (title 1)

Passes at `f8c8db06f` (`p7-ComputeSideCarRecipes.log`), fails at `bbab3e0e0` (`p8-ComputeSideCarRecipes.log`).
Source commits in the range: `2c19e710e`, `b6ee86a3f`, `75529a6e2`, `92e8cd372`, `eb282b4e6`, `0d0600fc9`,
`b3438688e`, `ce2d6dbe4`, `7e9b25165`, `abf1049ff`, `246cdfd74`, `4b3d529be`, `bbab3e0e0`. Positions 19-40 of
the window (`2c19e710e..8d4ea3bb61`) do not typecheck, so a narrower attribution needs a locally patched build of
that stretch. Leads by subject: `92e8cd372` (publish every field a joined element rebuild writes) and
`0d0600fc9` (drop a helper arm a literal argument rules out).

### G3: `bbab3e0e0..6837f767d` (titles 5, 6)

Both titles pass at `bbab3e0e0` (`p8-ExternalCallPredicate.log`, 56 passed) and fail at `6837f767d`
(`alone-p4`). Source commits in the range: `b1888210f`, `a2bcdb614`, `c473ba4a0`, `2393319b9`, `6245bccbd`,
`aefb5499f`, `7d13225a0`, `6ee0e536d`, `03dd2b15c`, `6837f767d`. Leads by subject: `a2bcdb614` (cache a repeated
whole-struct mapping assign) and `6837f767d` (compare stored array assigns by identity).

### G4: `bcf17883e..ef807a50a` (titles 3, 8, 9, 10, 13, 14, 15, 17, 18, 19, 20, 21, 22)

All pass at `bcf17883e` (`alone-p9/`) and fail at `ef807a50a` (`alone-p3/`). Source commits in the range:
`c70c15cd2`, `598b92837`, `be3cb661e`, `0cffcb936`, `b96aa14d5`, `db0551317`, `ef807a50a`. Leads by subject:
`b96aa14d5` (do not pad a satoshi slot that already holds its container), which moves output layout, and
`598b92837` (flush a loop-cached dynamic array only after it changes), which matches title 18.

### G5: `ef807a50a..af6d23cb5` (titles 16, 24-29)

`Upgrade.test.ts` passes at `ef807a50a` and fails at `af6d23cb5` (`alone-p3`, `alone-p2`);
`KernelSelfdestructStateCompose` follows the same boundary. Source commits in the range: `82dbbf991`,
`1a563f195`, `2ba928c46`, `5eb8eeab5`, `f4b9510a4`, `da1682e3c`, `d532aa32a`, `a48a24e56`, `af6d23cb5`. Leads
by subject: `f4b9510a4` (share split delegate coordinates and resident the smallest facet) and `da1682e3c`
(present a proxy CREATE lock as address(this)), both on the proxy/deploy path the upgrade route uses.

### G6: `af6d23cb5..19f6c28b5` (titles 11, 12, 23)

All pass at `af6d23cb5` (`alone-p2`) and fail at `19f6c28b5` (`lintparent-alone.log`). Source commits in the
range: `8d924a0d6`, `8d761ec12`, `4cda5c10d`, `65bc81edf`, `1f55b6e9c`, `fcb3aff77`, `89a09a273`, `f4a00d3ff`,
`f8e8f722c`, `24ff05101`, `391208e7a`, `369b34419`, `88c026992`, `02de0b9d1`, `1fcc23d10`, `cee831dc2`,
`8c4671242`. The framed renames in this range are SDK-level, but the failing titles are kernel/direct. Leads by
subject: the loop-guard fixes `89a09a273` and `f4a00d3ff` match title 23 (an unproven later loop now resolves
instead of refusing), and `1f55b6e9c` / `fcb3aff77` match the compose titles.

### Not a regression

Title 7, `ExactAdditiveRecurrenceSecurity.test.ts`: in the full suite it failed with
`Error: Test timed out in 120000ms.` Alone at HEAD it passes, twice, at 82 s and 10 s (`recheck-ear-1.log`,
`recheck-ear-2.log`), i.e. the title sits just under the 120 s config timeout and the full-suite run pushed it
over. Environment/load, not a product failure.

## Counts per verdict

| verdict | count |
|---|---:|
| pre-existing | 0 |
| regression | 28 |
| flaky | 0 |
| environment (load-induced) | 1 |
| total | 29 |

No title here is pre-existing: every one passes at the baseline `295f6eed6` in the isolated tree. The earlier
"pre-existing kernel/framed" rows in `W6_FULL_SUITE_AT_HEAD.md` are the matched baseline rows and are outside
this list. No title is flaky: each boundary was seen at two or more revisions.

## The shortest list of what W6 must then fix

One load-induced title needs no fix; the 28 regressions are six first-bad windows:

1. `ce2f7bba1` (exact): the EarlyReturnTransformation nesting rule broke `InlineAssemblyYul` and `yul-evm`
   (titles 2, 4). One commit, one file.
2. `f8c8db06f..bbab3e0e0` (G2): `ComputeSideCarRecipes` no longer publishes the nested-Keccak recipe (title 1).
3. `bbab3e0e0..6837f767d` (G3): `ExternalCallPredicate` regressed on the mapping-struct-write and packed-argument
   titles (titles 5, 6).
4. `bcf17883e..ef807a50a` (G4): one window regressed 13 direct/kernel titles (3, 8, 9, 10, 13, 14, 15, 17, 18,
   19, 20, 21, 22); likely one layout/padding change, and it needs a bisect inside the 7-commit range.
5. `ef807a50a..af6d23cb5` (G5): the `Upgrade.test.ts` route and `KernelSelfdestructStateCompose` (7 titles), on
   the proxy/deploy path.
6. `af6d23cb5..19f6c28b5` (G6): three compose/loop titles (11, 12, 23), likely the loop-guard fixes.

G1 and G2 are safe to act on now. G3-G6 are first-bad windows, not single commits, because the task's bound of
12 isolated-tree cycles was reached before they could be bisected to one commit; each range names the source
commits inside it, so one more bisect pass per window finishes the attribution. The one structural wrinkle is
that positions 19-40 of the window (`2c19e710e..8d4ea3bb61`) do not typecheck, so G2 cannot be narrowed through
that stretch without a locally patched build.
