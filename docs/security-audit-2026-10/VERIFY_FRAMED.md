# Second-pair verification: FW-1, FW-2, FV-1 (framed, validator-settled path)

Tree `/Code/cashscript/.worktrees/per-call` at abbb7e0ec. Read-only; no tests, compiles, builds or probes run.
Verdicts are code-read: CONFIRMED means no blocking check exists on any path traced (master head, kept walk, body,
validator program, census, data-NFT covenant); each still needs one VM test to be VM-proven (stated per finding).

## FV-1  CONFIRMED (code divergence)  - root cause of FW-1

Decisive: `validator/program.ts:3187-3198` `emitBuildKey`: `in == 0xffff ? out||out : in||in`, no namespace tag.
`checks.ts:380` and `solidcash/.../reference/reference.ts:434` key `in:i` vs `out:i`.

- The emitBuildKey comment (`program.ts:3182-3186`) says created output indices sit at or past the participant count.
  Nothing in the program enforces that. The created list is only range-checked. `emitCheckGatheredIndices`
  (`program.ts:2093-2099`) even says a created output can share an index with an unrelated input.
- Effect in the program: a kept record at input i and a created-form entry at output i share one chain. The start view
  comes from whichever entry is first in V6 order (`program.ts:2324-2333`). So the order the builder picks decides
  whether input i's real commitment is ever compared.
- FV-1's own ordering (kept entry first, created-form entry second) makes the created-form entry only a contiguous link.
  Its "starts empty" rule is skipped. Impact of that ordering alone: UNRESOLVED. A VM test must show that a
  composition whose created-form entry at output i follows a kept entry at input i, with a non-empty viewIn equal to
  the kept entry's viewOut, passes every input. The reference model must reject it with
  A_CREATED_RECORD_DOES_NOT_START_EMPTY.
- Spec drift: section 20 (SPEC lines ~1890-1893) still says a later frame names a created node with `in == out` at
  the created index. `emitRecordStartView`'s created-list arm (`program.ts:2366-2371`) serves that form. The masters
  instead name it "at its output alone" (`declared-view.ts:546-550`), which is what checks.ts and reference.ts model.
- Severity: CRITICAL as the mechanism of FW-1. Tagging the key with in/out closes FW-1. As a standalone ordering
  issue: MEDIUM.

## FW-1  CONFIRMED (code-read)

Decisive: `program.ts:2372-2373` (`emitRecordStartView`). `in == 0xffff` starts the key's chain from 128 zero bytes
unconditionally. It does not check that `out` is in the created list, is >= TXINPUTCOUNT, or is not a state input's
index. This combines with the FV-1 key merge (`program.ts:3187-3198`) and zero-padded compares
(`program.ts:3164-3170`).

Every candidate blocker was checked and none blocks it:
- Head walk `frame-tail.ts:454-469`: checks shape and range only. A created form at a spent index passes.
- Segment record count: none. `MasterTailShape.segmentRecordCounts` is set only by `zeroTailShape`
  (`frame-tail.ts:157,167`), and `support.ts:3030-3034` says "Segments are not fixed here".
- Kept walk `declared-view.ts:619-624`: the output-alone arm needs `in == 0xffff`, a non-empty viewIn and `shared`
  (`:563-571`, validatorRef set and >= 2 minting inputs). It never looks at what `out` names.
- Body: reads come from declared views only (`GTT:37615-37624`; the rebuild closes against the declared out-view at
  `GTT:38320-38325`, "Settlement ties the declaration ... to the real output"). The master compares real
  commitments only in `selfSettlementScript` (`frame-tail.ts:849-1066`). That script runs only when masterCount == 1
  and there is no context call (`master-head.ts:904-940`).
- Validator touched rule `program.ts:2408-2450`: needs only some `in == D` entry, which the second frame supplies.
  Created-form ins are skipped (`:2533-2536`). Census `:1951-2000` needs only "declared". Value floor `:2093-2127`
  has no commitment check.
- Data-NFT covenant `utils/src/state.ts:133+`: on the write path it pins lock, category, FT amount and value, not the
  commitment.

Net result: the merged chain D||D starts at zeros. Input D's real commitment is never compared, and the next frame
of the chain reads an all-zero view as D's state. checks.ts and reference.ts would both reject this (separate
`out:D` / `in:D` chains with exact compares), but they are off-chain.

VM test to promote it: a two-root composition on one contract with a genuine validator, where the first root's
segment adds the created-form declaration at D's index with an all-zero non-empty view, and the second root writes D
from an all-zero viewIn. Every input must pass, and output D must carry the second root's viewOut. Control: drop the
created-form declaration and expect failure at `program.ts:2331-2332`. Also confirm the field decode accepts an
all-zero view for the target layout.

Severity: CRITICAL. Any user can reset a validator-settled contract's data record to its zero/uninitialized state
and then pass zero-gated entries (initializer, owner == 0).

## FW-2  CONFIRMED (code-read; also a spec/model gap)

Decisive:
- `declared-view.ts:609-615`: an entry is exempt when `in# == in_p` OR `out# == out_p` (two BOOLORs at `:614`).
- `program.ts:2256`: an entry with `out == 0xffff` gets marker 1.
- `program.ts:2337-2351`: a non-last entry needs only contiguity and no delete. The last entry needs only marker 1.
- Census `program.ts:1951-2000`: a mutable own-category output is admitted when any entry's `out` names it.

Trace:
- The honest entry A `{D,D}` is followed by `{D,0xffff}` with viewIn == A.viewOut.
- The body reads first-in / last-out (`declared-view.ts:273-366`), so it never sees the delete.
- The validator chain lands on the delete, and output D's commitment is never compared with any view.
- checks.ts (`:476-484` skips the end check when the last entry deletes; `:529-535` allows any `entry.out`) and
  reference.ts (`:479` `continue`; `:500-506`) accept the same shape. The SDK conformance models therefore cannot
  catch it.
- Spec V7 says "A record is left without an output only if the last view deletes it". Nothing implements the converse
  (a deleted record leaves no mutable output at its index).
- Not reachable without a write: in a segment that writes nothing, the kept walk refuses deletes (`:619-624`).
- Self-settlement would refuse it, but it does not run here (`master-head.ts:904-940`).

VM test: a validator-settled frame running any entry that writes a data-record field. The frame appends the delete
after its honest entry, and output D carries a commitment different from A.viewOut. Every input must pass.

Severity: CRITICAL. Any user who can run any entry that writes a data-record field can make an arbitrary, persistent
write to that record.

## Preconditions (question 2)

- Two masters of one contract in one transaction, permissionlessly: yes.
  - Pools default to 12 masters and 4 validators per contract (`solidcash/src/framed/deploy/pool.ts:31`).
  - A ROOT frame only needs the caller to be some P2PKH input equal to `sender` (`master-head.ts:1161-1185`), so the
    attacker's own key qualifies.
  - With masterCount >= 2, self-settlement is skipped (`master-head.ts:904-940`). V8 then forces the validator to
    settle the contract.
  - A proxied (DELEGATE) frame reaches the same path without a second master.
- Genuine validator: the attacker can include one.
  - Validators are pool UTXOs that are spent and recreated in place.
  - V9 only asks that the first root's category match the validator's.
  - FW-1 and FW-2 hold against the genuine program as traced above.
- Fake validator: the recogniser `frame-tail.ts:794-847` checks the token (33-byte mutable), and that the program in
  the last push of the validator input's unlocking bytecode hashes to the reserved slot and its pin matches the token.
  It never compares that input's `OP_UTXOBYTECODE` with P2SH32 of the pushed script. If the separate finding holds,
  the validator program need not run at all on the multi-master path. That subsumes FW-1, FW-2 and FV-1 (no
  settlement), so it should be fixed first. FW-1 and FW-2 still need their own fixes because they hold with the
  genuine validator.

## Fix direction (for the lane owner)

- Tag the chain key with in/out (as checks.ts and reference.ts do) and compare views exactly (length plus bytes).
- Refuse a created-form entry whose `out` index is a spent state input of the contract.
- Make the kept-walk exemption need both `in# == in_p` and `out# == out_p`, with at most one entry per pair. Allow the
  created form only where the body creates.
- Require a deleted chain's index to carry no mutable own-category output, in the program, checks.ts and reference.ts.
- Fix the spec section 20 sentence.
