# `framed-next`: the isolated implementation branch

Work that changes the hop, the masters or the deployment beyond what the ladder stream holds is built here, off
`feat/framed`, so it does not interfere with the ladder's ongoing work. It started at `eb3c2f561` (2026-10-01,
user direction); each stream was developed in its own scratch copy and committed onto this branch without a
checkout. It merged into `feat/framed` at `561a5720b` (2026-10-01), so it carries
nothing `feat/framed` lacks.

## What landed

1. **Heads only at genesis** (the kernel's option A).
   - `740139083` (compiler): a batch's verification reads its write segment when the body's calls vary on its
     paths. In a body with a guarded call or a send, an insert through an existing node failed its batch check;
     only empty collections worked, because the call created the head. It does not depend on the rest, so it can
     go to `feat/framed` ahead of it.
   - `2e5b0cf9c`: a proxy's genesis mints the head of every sorted collection its implementation declares.
   - `0af2d6331`: the PW3 wall (a run-time loop upsert beside a `.call()`) settles through the genesis head.
   - `ee1b55310`: the hop never creates a head; a live collection that holds none is refused by name.
   - `95ad1b91a`: the master no longer accepts a created head as an insert's predecessor (`createdPredecessorArm`
     removed), so every insert splices through a spent predecessor. On the VM, an insert through the genesis head
     settles and the old hop's created-head layout is refused (`-32767`, an invalid input index). The validator
     and the direct path's bytes are unchanged, so no framed address moves.
2. **One participant per node across reaches** (`67663e3b1`). Every callee node is one participant keyed by its
   category, collection and node slot, for reads and writes alike. The plan chains the node's views in the
   validator's execution order, and a frame settles after every earlier writer whose view it reads. Read then
   write, write then read (the read sees the written value) and update chains settle
   (`call/shared-node-across-reaches`, `call/same-callee-chains` 10 -> 11 -> 13 -> 16), and
   `ahead/revert-after-calls`, the shape of `post job 1`'s duplicate input, broadcasts with one input per outpoint.
3. **Execution-order planning** (`ae19a0d6b`). The planner stops before the first site whose argument or loop bound
   reads a result no settle has learned, settles the calls before it, and plans again from what they returned
   (`call/argument-from-earlier-result`). It replaces the stage-1 fixed point
   (`docs/framed/patches/reached-state-arguments.diff`) at 2 to 8 times lower cost; the measurements are in
   `DESIGN_REACHED_STATE_PLANNING.md` section 5.

`7ec6a06e5` merges `feat/framed` in. Its `eefd0b631` (a read node renamed to the writer's id by outpoint) is
covered by `67663e3b1`, so the merge keeps this branch's `deploy.ts`, `external-calls.ts` and
`ahead/revert-after-calls` and drops `writtenNodeIds`, `shareReadNodeIds`, `shareWrittenReadNodes`,
`writeNodeIdsOf` and the `writtenNodeIds` option. Their caller-side renames could never match: the planner refuses
a callee that reaches a contract the hop already places. At `7ec6a06e5` the branch merges into `feat/framed`
with no conflict.

## Refused by name, and what each needs

- **Two inserts of one key, or two inserts through one node, across reaches, and a touch after an insert relinked
  the node.** The master half is served (2026-10-01): a relink is checked against the declared end view and a
  predecessor an earlier reach created is named by its output. The planner half remains: plan a later reach
  against the list the earlier ones left.
- **One node touched by two frames where one enters the other.**
- **A dynamic (chunked) value touched by more than one reach.** Not chained; refused just before broadcast, so a
  frame that reverts earlier still reports its own reason.
- **Re-entry records (stage 3 of the reached-state design).** The masters close every segment at their end, so a
  view written mid-body needs segment closes at calls (a compiler change) or a fixed point confined to re-entered
  views. The root frame's own node ids are not keyed like a callee's yet; re-entry needs that as well.

## Verification

At `7ec6a06e5`, in a scratch copy with its own build: the SDK framed focused suite, 194 files / 1103 passed (146
skipped) in 108 s, and `ahead/` under `FRAMED_AHEAD=1`, 16 files / 137 passed in 1019 s (`job-updates` alone
989 s). The compiler framed suite (664) was last run at `95ad1b91a`; nothing after it touches the compiler.

## Open decisions

- When to merge into `feat/framed`. The ladder stream's uncommitted `broadcastHop` tracing sits next to
  `writeNodeIdsOf`, which this branch drops.
- Stage 3: segment closes at calls, or a confined fixed point.
- Validator padding: a created record, a missing input view and the all-zero head sentinel all read as 128 zero
  bytes (`program.ts` pads views), where the reference model (`checks.ts`) tells them apart. Closing it moves every
  framed address.
