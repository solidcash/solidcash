# Internal note: bytecode subroutine extraction

Status: implemented. Last updated 2026-06. All code in
`packages/solidc/src/generation/GenerateTargetTraversal.ts`.

## Goal

Stateful contracts inline the same building blocks (pushdata encode/decode, covenant
constructions) many times, bloating bytecode. This work extracts the high-value repeated
blocks into shared BCH-2026 `OP_DEFINE`/`OP_INVOKE` subroutines, under a usage-count rule.

Result on the Highlight benchmark: **4210 -> 2852 bytes (-32%)**.

## The rule

For each registered subroutine, a usage-count pre-pass decides:

- **0 uses** -> omit (nothing references it).
- **1 use** -> inline (a single `OP_DEFINE` + `OP_INVOKE` costs more than one inline copy).
- **>=2 uses** -> define once, `OP_INVOKE` at each site.

Break-even is exactly k>=2. Both the inline and the invoke code paths are independently
correct, so a misestimated count is only suboptimal, never wrong.

## Mechanism (registry)

Two id-keyed maps on the traversal:

- `subroutineDefined: Map<id, boolean>` - inherited parent->sub (so function bodies, compiled
  in sub-traversals, invoke a defined subroutine).
- `subroutineUseCount: Map<id, number>` - propagated sub->parent (so the probe sees every site).

Helpers:

- `bumpSubroutineUse(id)` / `invokeSubroutineIfDefined(id, loc)` - used at the inline emitter
  ("chokepoint") to count a site and, when defined, emit the `OP_INVOKE` instead of inlining.
- `defineCapturedSubroutine(id, inlineEmit, loc)` - produces the body by running the inline
  emitter on a throwaway traversal, so the subroutine is **byte-identical** to the inline path
  (nested subroutines inline inside it). Avoids hand-maintaining a second copy.
- `subroutineUseProbe(node)` - dry-runs body generation on a throwaway clone in inline mode and
  returns the count map (real state untouched; `deployTargets`, the only accumulative AST
  mutation, is snapshot/restored). Returns null when no site is reachable; on failure returns a
  define-all map (conservative: correct, just not inlined). The dead-DEFINE splice removes any
  over-estimate.

## Dispatch selector validation (security)

Compiler-internal subroutine IDs are **2-byte** script numbers from `0x1000`, disjoint by length
from small internal function IDs and 4-byte entry-point selectors. The dispatcher verifies the
incoming selector is exactly 4 bytes (`OP_SIZE OP_4 OP_NUMEQUALVERIFY`) before `OP_INVOKE`.

This is a real fix, not cosmetic: internal functions compile without a final `require`, so before
the check a crafted unlocking script could push an internal/subroutine ID and `OP_INVOKE` it
directly, passing the contract if the body left a truthy stack. Verified exploitable and fixed;
see `packages/solidcash/test/e2e/DispatchSelectorSecurity.test.ts`.

## Extracted subroutines

| id | what | shape |
|----|------|-------|
| `0x1000` | generic int pushdata decode | `[blob] -> [raw, remainder]` (manual body; int callers add BIN2NUM) |
| `0x1001` | standard pushdata frame | `[value] -> [framed]` |
| `0x1002` | int-like pushdata encode (wrapper + inline frame) | `[value] -> [encoded]` |

Frame/int-encode interaction: each int-encode site frames once, so when int-encode is its own
subroutine those frames move into it; only the remaining (bytes-branch) frames count toward the
standalone frame subroutine (`frameUses = defineIntEncode ? frame - intEncode : frame`).

## Adding a new subroutine

1. Add an `*_SUBROUTINE_ID` constant and append it to `ALL_SUBROUTINE_IDS`.
2. At the inline emitter, gate with `invokeSubroutineIfDefined(id, loc)` (replicate any
   stack-tracking the inline body did after the invoke).
3. In `visitContract`, add a spec: `if (count(id) >= 2) spans.push({ id, span:
   defineCapturedSubroutine(id, (t) => t.emitX(loc), loc) })`.

Propagation and inheritance are handled by the registry loops - do not add per-subroutine fields.
(The earlier field-based design once shipped frame/int-encode that were silently dead for
multi-function contracts because propagation+inheritance were wired for int-decode only; the
registry exists to make that class of bug impossible.)

## Negative result: the covenant-LBC family (do not re-attempt as-is)

Extracting `emitDataNftLbc` / `emitSatoshiContainerLbc` / `emitTokenContainerLbc` as subroutines
was tried and reverted. Instrumenting a full suite run showed **no contract triggers any of them**:
every contract constructs each covenant P2SH32 address **<2x** (k>=2 never met), even Highlight,
which uses satoshi and token containers across four functions. Covenant-address construction is
typically <=1 per contract, so these inline correctly and a subroutine would be untested with no
measured benefit.

The "repeated ~48-byte covenant template" visible in a naive repeated-block scan of Highlight is a
**data constant** embedded across heterogeneous covenant logic (address build + covenant
verification), not a single `[category] -> [lbc]` transform. Data constants cannot be subroutined.

Takeaway: the remaining Highlight bytes are heterogeneous covenant logic (self-preservation,
minting-uniqueness, embedded templates) that is not amenable to generic subroutine extraction.
Further size wins there would need a different technique.
