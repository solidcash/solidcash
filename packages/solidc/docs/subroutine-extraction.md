# Internal note: bytecode subroutine extraction

Status: implemented. Last updated 2026-06. All code in
`packages/solidc/src/generation/GenerateTargetTraversal.ts`.

## Goal

Stateful contracts inline the same building blocks (pushdata encode/decode, covenant
constructions) many times, bloating bytecode. This work extracts the high-value repeated
blocks into shared BCH-2026 `OP_DEFINE`/`OP_INVOKE` subroutines, under a usage-count rule.

Result on the Highlight benchmark: **4210 -> 2619 bytes (-38%)**.

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
| `0x1003` | master self-preservation (bytecode + category) | `[] -> []` (non-delegate; delegate inlines) |
| `0x1004` | minting NFT uniqueness | `[] -> []` (non-delegate; delegate inlines) |
| `0x1005` | master value preservation | `[] -> []` (non-delegate; delegate inlines) |
| `0x1006` | category base == master's category base | `[cat] -> []` (non-delegate; delegate inlines) |
| `0x1007` | satoshi container P2SH32 lbc from category | `[cat] -> [lbc]` |
| `0x1008` | token container P2SH32 lbc from masterCat+tcCat | `[masterCat, tcCat] -> [lbc]` |

Frame/int-encode interaction: each int-encode site frames once, so when int-encode is its own
subroutine those frames move into it; only the remaining (bytes-branch) frames count toward the
standalone frame subroutine (`frameUses = defineIntEncode ? frame - intEncode : frame`).

The master-family (`0x1003`-`0x1006`) bake `OP_INPUTINDEX` (the master at offset 0), so they are
gated on `!currentFunctionIsDelegate` at the chokepoint; delegate functions resolve the master via
the altstack proxy index and inline instead. `0x1006` emits raw (no stack-tracker calls): the four
call sites (data NFT, entry input/output, event output) each push a category then invoke, and
manage their own tracker bookkeeping.

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

## The covenant-LBC family (0x1007, 0x1008)

The satoshi/token container LBC transforms ARE extractable. An earlier attempt was reverted after a
suite run showed "no contract triggers any LBC >=2x" - but that measurement predates the registry
refactor, which fixed sub-traversal count propagation. Before the fix the probe saw ~0 LBC uses for
multi-function contracts (counts never propagated from function-body sub-traversals), so the rule
concluded inline. Post-registry the counts are correct: 15 contracts use an LBC template >=2x, and
extracting the two transforms shrank **9 contracts by 1385 bytes total** (AddressTypes -305 / -25%,
TokenContainerOutState -223, MsgSenderTest -147).

These transforms are pure stack operations (no introspection), so unlike the master family they need
no delegate gate. `emitSatoshiContainerLbc` is `[cat] -> [lbc]` (tracks stack); `emitTokenContainerLbc`
is `[masterCat, tcCat] -> [lbc]` (leaves tracking to the caller). OP_INVOKE shares the runtime stack,
so the body's hardcoded OP_ROLL indices reach the same items as inline.

Caveat - transform vs verification: the ~48-byte covenant middle constant also appears inline where a
covenant *output's* bytecode is verified. Only the `[category] -> [lbc]` transform path is subroutined;
a contract whose template copies are mostly verification-context (e.g. Highlight, TokenContainerRead)
has a transform count <2 and correctly stays inline. `emitDataNftLbc` has a single call site (k<2),
so it is not extracted.

## Cross-contract analysis (how 0x1006-0x1008 were found)

Earlier rounds only profiled Highlight. To find patterns repeated across the *whole* ecosystem,
temporarily hook `compileString` (just before its `return`) to append `{n: contractName,
b: debug.bytecode}` to a file for any artifact with a `stateLayout`, gated on an env var:

    if (process.env.SUBANALYZE && art.stateLayout) appendFileSync(process.env.SUBANALYZE, ...)

Run the full e2e suite with that env var set, dedup the dump by name+bytecode (the suite compiles
~290 unique stateful contracts), decode each body's function bodies, and rank opcode windows by
ecosystem savings: `sum over contracts of max(0, count_in_contract - 1) * window_bytes`. Revert the
hook afterward (`git checkout`).

This surfaced the category-base comparison (`[cat] 32 SPLIT DROP <master> UTXOTOKENCATEGORY 32
SPLIT DROP EQUALVERIFY`, byte-identical 11-byte tail) as the single broadest repeat: ~570 sites
across 141 contracts. Extracted as `0x1006`; under k>=2 it shrank **45 contracts by 878 bytes
total** (ERC20Token -89, Highlight -68, PartialStructUpdate -47). The window scan over-estimates
(many contracts use the idiom exactly once -> inline), so the real win is the k>=2 subset.

The same dump (ranking by net savings, accounting for define overhead) surfaced the covenant-LBC
transforms as the next-largest target, leading to `0x1007`/`0x1008` above.

The next-ranked repeat is single-data-NFT preservation (value/amount/commitment/bytecode at offset
+1); it is offset-parameterized, so a generic subroutine would need the offset fixed - deferred.
