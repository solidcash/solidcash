> Historical workstream note. The message bus and its kernel were removed from the compiler and SDK in
> 2026-11; any instruction to compile with `messageBus` or to use the bus describes the tree as it stood then.

# compiler-retouch: intent and archived diff

Kind: archived workstream, 2026-11-13. The worktree `.worktrees/compiler-retouch` was deleted after this record. Kept:
the branch `compiler-retouch` (`76aee6296`), the tag `compiler-retouch-verified` (same commit) and the branch
`defer-experiment` (`5a69a9f95`, merged into it). The work ran 2026-10-22..23 and nothing was left uncommitted.

## Intent

Make compiles faster without changing one byte of emitted bytecode, metadata or state layout. Measured on the
marketplace pair (MarketplaceV1, MarketplaceDataV1) against master `2c5d82625`, three paired runs each:

| | master | branch |
| --- | --- | --- |
| direct (kernel) compile, median | 14,604 ms | 12,782 ms (87.5%) |
| framed compile, median | 23,151 ms | 5,736 ms (24.8%) |
| `codegen:probe` | 1,547-1,624 ms | absent |
| artifact JSON, MarketplaceV1 / MarketplaceDataV1 | | kernel -20.6% / -24.7%, framed -12.0% / -14.5% |

Parity held at that base. `scripts/verify-id.mjs` printed the same identity in both trees,

    {"routeBytes":44865,"fullBytes":246609,"fullHash":"30c4f5a157f93e83"}

and metadata, `stateLayout` and full-bytecode hashes were identical for both contracts in kernel and framed modes.

## What it changed

Paths in this section exist only on the branch unless master has them too.

- **Direct convention, each body once.** A multi-entry contract no longer runs the separate usage-probe walk. Each body
  compiles once with captured helpers inlined while every helper site records its span; the contract's own tallies
  choose the profitable helpers, their DEFINEs go first, rehoming replays over the recorded ids, and each body compiles
  again against the settled defines before it is emitted. Identity needed the probe's starting state, its skips and
  live-seeded defined helpers. Framed compiles and single-body inlined direct shapes keep the content-keyed plan.
- **Framed:** the shipping rung compiles once, without the discarded admission ladder or verifier-host build.
- **Commitment uniqueness:** an allocation-free boundary scan (`packages/utils/src/tagged-commitment-scan.ts`, new);
  embed and verify in one pass per handler.
- **Artifact ASM:** a direct writer for opcodes and minimal pushes (55 ms to 5-7 ms per 624 KB conversion), and large
  `bytecodeToAsm` conversions memoised by content (4 KB minimum, 8 entries).
- **Compact artifact bodies, an artifact format change.** A published body is raw hex or an `ArtifactBodySpan`
  (offset, length) into the artifact's bytecode, read through `resolveArtifactBody` (`packages/utils/src/artifact.ts`).
  The SDK's readers resolve through it (Contract, debugging, the libauth template, message-bus preflight, external
  return encoding, upgrades), and the four committed testing-suite artifacts were regenerated.
- **Bounded caches** for imported parses and legacy usage plans (`SOLIDC_IMPORTED_PARSE_CACHE_MAX_ENTRIES`,
  `SOLIDC_MULTI_ARTIFACT_CACHE_MAX_ENTRIES`), emptied by `clearCompileCache()`;
  `packages/solidc/test/CompilerRetouch.test.ts` (new) covers them.
- **`SOLIDC_EXTRACT_FRAME=1`**, an experimental codegen switch the branch documents in `docs/kernel-diagnostics.md`.
- **Parity tooling:** `scripts/metadata-parity-marketplace.mjs` and `scripts/body-parity-marketplace.mjs` (new), and
  edits to the profile and perf scripts, `scripts/verify-id.mjs` and the `scripts/gate.sh` pin.

The branch's own record is `compiler-retouch:docs/wip/compiler-retouch/VERIFICATION.md` (read it with `git show`; the
diff carries it too). It names the reproduction commands, the parity hashes per mode and contract, and the earlier
rounds: bypassing the probe's count produced a 5.38 MB script, and counting the sites it skips changed the identity.

## The diff

`compiler-retouch.diff` is `git diff 2c5d82625 compiler-retouch`: 39 files, +2,284/-458. `2c5d82625` is the last
master merged into the branch, so the diff is the branch's whole net change; applied to that commit it rebuilds the
branch tree exactly (checked with `git apply --cached` on a scratch index). By area: compiler 7 files
(`GenerateTargetTraversal.ts` 1,272 changed lines, `compiler.ts` 158), utils 7, SDK 10, scripts 10, the four
testing-suite artifacts, `docs/kernel-diagnostics.md` and the record above.

## State against master (2026-11-13)

- Nothing from the branch is on master: no commit, no equivalent patch (`git cherry`), none of its new names. Master
  still runs `codegen:probe`.
- Master is 603 commits past the base. A test merge (`git merge-tree`) conflicts in 13 files: `compiler.ts`,
  `GenerateTargetTraversal.ts`, `docs/kernel-diagnostics.md`, `scripts/gate.sh`, `message-bus/preflight.ts`,
  `stateful/external-return-encoding.ts`, three tests (`Erc20GuideSnippets`, `direct-path-identity`,
  `SdkBrowserBundle`) and the four testing-suite artifacts, which master has since deleted.
- The parity evidence is against `2c5d82625`, identity `30c4f5a157f93e83`. Master's identity is now
  `6a3ccc467ccc480b` and the compiler has moved a long way, so picking this up means porting the changes onto master
  and rerunning the parity scripts, `scripts/verify-id.mjs`, the gate and the compiler suite. The scratch captures the
  record cites (`{SCRATCH}/final2`) were never in the repository.
