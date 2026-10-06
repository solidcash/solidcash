# W4 size growth: the framed MarketplaceV1 script grew 864 bytes at 598b92837

## Why

`docs/framed/SIZE_KERNEL_VS_FRAMED.md` (compiled 2026-10-05 15:37, then HEAD `c473ba4a0`) records the framed
`MarketplaceV1` script at 135056 bytes. At HEAD `3fc4c2fe9` it is 135920. Every other framed contract is
byte-identical. `docs/framed/W4_STATUS.md` records the 864-byte growth as an open item that needs its own
compile-only bisect. This is that bisect: the first commit whose bytes exceed the starting value, and why.

A byte count is `asmToBytecode(artifact.bytecode).length` of the compiled artifact, the real emitted script.

## Harness setup

Own copy of the W4 harness, so the other worker keeps `w4/harness` untouched:

    cp -a /tmp/grok-goal-4b830698eeec/implementer/w4/harness \
          /tmp/grok-goal-4b830698eeec/implementer/size/harness

Per step the copy is reset from the commit under test, so the tree under test is the only variable. Step
script: `/tmp/grok-goal-4b830698eeec/implementer/size/step.sh`. Inside the copy it runs:

    rm -rf packages/*/src packages/*/dist packages/*/test examples docs
    find . -path ./node_modules -prune -o -name '*.tsbuildinfo' -print0 | xargs -0 -r rm -f
    git -C /Code/cashscript/.worktrees/per-call archive <commit> -- packages examples tsconfig.json \
      tsconfig.packages.json tsconfig.build.json vitest.config.ts vitest.marketplace.config.ts \
      solidcash.config.ts package.json lerna.json scripts | tar -x
    npx tsc -b tsconfig.packages.json --force
    rm -rf .marketplace/cache .marketplace/artifacts/solidcash
    node packages/solidhat/dist/cli.js compile
    node /tmp/grok-goal-4b830698eeec/implementer/artifact-sizes.mjs \
      .marketplace/artifacts/solidcash /tmp/grok-goal-4b830698eeec/implementer/size/harness

The archived `solidcash.config.ts` is forced back to the PROXIED lane before building, because the copied
harness carried the no-proxy paths. The two lines are:

    contracts: '.marketplace/contracts',
    tests: '/Code/effectiveacceleration.ai/contract/test',

Every compile reported `Compiled 9 Solidity source(s) in 9 compiler job(s) (0 cache hit(s)) -> 19 artifact(s)`,
and `composition.refusedEntries` is 0 on every contract of both brackets. The `.marketplace/contracts`
symlinks point at the proxied project's Solidity sources, so the fixture is constant across steps. A step is a
forced build plus one project compile: 2.5 to 8 minutes, no tests.

## Bisect

Range `c473ba4a0..HEAD`, 114 first-parent commits. Only a commit that changes `packages/solidc/src` or
`packages/utils/src` can change the emitted script: in `c473ba4a0..598b92837` no commit touches
`tsconfig*.json`, `package.json`, `lerna.json`, `scripts`, either vitest config or `solidcash.config.ts`, and
the remaining trees (`packages/*/test`, the SDK) are not codegen inputs. That is 27 codegen commits, and the
bisect ranges over those. No probed commit failed to build; the bisect needed no skips.

Verdict table, first-parent order. The `#` column is the position among the 27 codegen commits.

| # | commit | subject | bytes | note |
|---:|---|---|---:|---|
| 0 | `c473ba4a0` | start, the W3 baseline | 135056 | starting value |
| 7 | `6837f767d` | fix(solidc): compare stored array assigns by identity | 135056 | probe, good |
| 9 | `6e0b121e0` | fix(solidc): place a rewritten chunk after a ran return event | 135056 | last codegen good |
| - | `c70c15cd2` | fix(sdk): pass an empty preimage for a short loop return | 135056 | parent of first bad |
| 10 | `598b92837` | fix(solidc): flush a loop-cached dynamic array only after it changes | 135920 | FIRST BAD, +864 |
| 11 | `be3cb661e` | fix(solidc): accept a forwarded 20-byte address as its lock | 135920 | probe, bad |
| 14 | `82dbbf991` | fix(solidc): outline repeated verifier altstack pops | 135920 | probe, bad |
| - | `3fc4c2fe9` | HEAD | 135920 | bad end |

Codegen commits 1 to 6 and 8 lie below probe 7 and probe 9, so they stay at 135056; commits 12 and up lie above
the first bad probe 11. The immediate parent `c70c15cd2`, and the seven non-codegen commits between it and
`6e0b121e0`, also measure 135056, so `598b92837` is the first commit in the range whose bytes exceed the
starting value, not merely the first codegen one.

Measured on both sides of the boundary:

| contract | `c70c15cd2` (parent) | `598b92837` (first bad) | delta |
|---|---:|---:|---:|
| MarketplaceV1 | 135056 | 135920 | +864 |
| FakeToken | 24303 | 24303 | 0 |
| MarketplaceDataV1 | 110050 | 110050 | 0 |
| Unicrow | 56258 | 56258 | 0 |
| UnicrowArbitrator | 27082 | 27082 | 0 |
| UnicrowClaim | 21801 | 21801 | 0 |
| UnicrowDispute | 31305 | 31305 | 0 |
| every interface artifact | 0 | 0 | 0 |

So the other framed contracts did not move at the same commit; only `MarketplaceV1` did.

## The first bad commit

    commit 598b92837aded706f4f65c58cce73abba31f529b
    Author: mainnet-pat <mainnet_pat@protonmail.com>
    Date:   Mon Oct 5 20:48:45 2026 +0000

        fix(solidc): flush a loop-cached dynamic array only after it changes

    .../solidc/src/semantic/CacheDynamicArrayInLoop.ts | 112 +++++++++++++++------
    1 file changed, 79 insertions(+), 33 deletions(-)

From the diff, the pass `CacheDynamicArrayInLoop` stops flushing a loop-cached dynamic array unconditionally.
It adds a per-array dirty bit and guards the flush on it, naming these symbols:

- A new bool local `${PREFIX}dirty_${name}` (`PREFIX` is `__dlcache_`) is defined right after the cache read,
  as `new VariableDefinitionNode(PrimitiveType.BOOL, [], dirty, new BoolLiteralNode(false))`.
- `convertWrites()` now uses `flatMap` and prefixes every converted in-loop write (state array push, pop,
  element assign, element delete, whole-array delete, whole-array assign) with a new `markDirty()` statement,
  an `AssignNode(IdentifierNode(dirty), BoolLiteralNode(true))`.
- `makeFlush()` no longer returns a bare `StateAssignNode`; it wraps the state assign in a `BlockNode` and
  returns a `BranchNode(IdentifierNode(dirty), flushBlock)`, and sets
  `branch.preserveConditionalEntryWrites = true` so the clean arm stays a no-op instead of being republished.
- `insertFlushesBeforeReturns()` threads the same dirty name into every return-path flush.

The commit message says the unconditional end flush wrote a pre-call snapshot over a handler that had already
updated the journal through the message-bus route, so clearing an element kept the old chunks. The extra dirty
local, the per-write dirty assignment, and the branch-wrapped flush are the 864 bytes.

## Deliberate or unintended

Deliberate, and specifically a codegen expansion for a correctness fix rather than an admission of new shapes.
The diff adds a guard to the existing loop-cached dynamic array lowering; it neither widens what the compiler
accepts nor changes the compiled fixture (still 9 sources, 19 artifacts, 0 refused entries on both brackets).
The commit message states the behaviour it repairs, and every added node is the guard for that repair. So the
864 bytes are the intended cost of the guarded flush, not accidental codegen drift.

## Logs

All under `/tmp/grok-goal-4b830698eeec/implementer/size/`:

- `step.sh`, the reset/build/compile/measure script.
- `logs/<commit>.tsc.log` and `logs/<commit>.compile.log` for every probed commit.
- `logs/step-c70c15cd2.out`, `logs/sizes-c70c15cd2.txt`, `logs/sizes-598b92837.txt`: full artifact tables for
  the two bracketing commits.

The shared measurement helper is `/tmp/grok-goal-4b830698eeec/implementer/artifact-sizes.mjs`.
