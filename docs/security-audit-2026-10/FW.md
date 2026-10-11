# FW audit: framed frame body (segments, records/views, writes, call sites, events, sends)

Worktree `/Code/cashscript/.worktrees/per-call`. Brief HEAD df51215d6; HEAD moved to abbb7e0ec during the audit (a
parity merge by another session). `git diff df51215d6 abbb7e0ec` touches nothing under `packages/solidc/src/framed`,
`packages/utils/src/framed` or `packages/utils/src/state.ts`, and the GTT hunks (abi.decode, error classes) are
outside the emitters below. GTT line numbers are at abbb7e0ec. Read-only; no tests, compiles or probes were run.

Shared background (all code-read):
- Master head record walk (`frame-tail.ts:454-469` recordEntryCheck) admits per entry: raw `in == out` with the
  value in range, or `in = 0xffff` (created / named at output), or `out = 0xffff` (deleted). Nothing pins how many
  entries a segment declares for a plain data-record frame (MasterTailShape has no per-segment count; the only
  count pins are the chunk-run census and loop/run offsets).
- Segment close = `declaredRecordsKeptScript` (`declared-view.ts:552-641`), driven from `emitFramedSegmentClose`
  (GTT:29444-29563). A declared entry is EXEMPT when `BIN2NUM(in) == in_p OR BIN2NUM(out) == out_p` for a written
  record's pair (`declared-view.ts:609-615`), or when its ordinal is at/past `leading`. A non-exempt entry must have
  `in# == out#` or (`in == 0xffff` AND `viewIn` non-empty AND `shared`), then `viewIn == viewOut`
  (`declared-view.ts:619-625`). `shared` = validatorRef != 0xffff AND >= 2 inputs carry this master's minting
  category (`declared-view.ts:563-571`).
- Body reads a record's in-side at the FIRST matching `in` field with a non-empty view and the out-side at the LAST
  matching `out` field (`declared-view.ts:273-366`); the data-record rebuild compares the out-side
  (`GTT:38309-38325` -> `emitRecordCommitmentRead`).
- Self-settlement (S) runs only when the contract has one master in the tx and no DELEGATE/INTERNAL call
  (`master-head.ts:886-940`); otherwise the validator settles (V8). The validator chains records by key
  `in||in` (or `out||out` for `in = 0xffff`), starts a key at "nothing" (128 zero bytes) when its first entry has
  `in = 0xffff` (`validator/program.ts:2363-2380`), compares views zero-padded/truncated to 128 bytes
  (`program.ts:3164-3170`), lets the last entry of a key delete (`program.ts:2337-2350`), and admits a mutable
  own-category output if ANY entry declares that output (`program.ts:1951-1990`).

---

## FW-1 CRITICAL, SUSPECTED: an "output alone" declaration at a spent record's index resets the record to zeros

Files: `packages/solidc/src/framed/master/declared-view.ts:619-625` (output-alone branch accepts any `out`);
`packages/solidc/src/framed/validator/program.ts:2363-2380` (created entry starts from nothing),
`:3164-3170` (padded views), `:2525-2545` (`emitCollectRecordInput`: reads collected only for `in != 0xffff`).

Root cause: the kept walk's "named at its output alone" branch exists for a node an earlier frame CREATED, but it
accepts `in = 0xffff` with ANY `out` index, including the index of a record the transaction spends (the data
record D, or any node). Under the validator, a key's first entry with `in = 0xffff` starts from "nothing", and
"nothing" equals any all-zero view after padding, so the spent record's real input commitment is never compared by
anyone. Masters decode the declared view verbatim.

Attack (two masters of contract X co-spent, or any frame of X under validator settlement, e.g. behind a proxy):
1. Inputs: master1 of X, master2 of X, X's data record D (real state), validator V, attacker P2PKH (root user).
2. master1 frame (any entry, e.g. a view; its block has a validator ref): segment 0 declares
   `{in: 0xffff, out: D, viewIn: 0x00, viewOut: 0x00}`. Head walk: shape ok (created), D in range. Kept walk: not
   exempt; `in == 0xffff`, `viewIn` non-empty, `shared` true -> passes; `viewIn == viewOut`.
3. master2 frame, later in V6 order, entry `initialize()` (or any entry gated on a zero field): declares
   `{in: D, out: D, viewIn: 00 00 .. 00, viewOut: <owner = attacker, initialized = 1, ...>}`.
   Body reads D's fields from that view: every field decodes as OP_0 (0 / false / empty), so `initializer` /
   `owner == address(0)` passes; the rebuild equals `viewOut`. Output D at the data-NFT lock carries `viewOut`.
4. Validator: key D||D first entry is master1's (start = nothing == padded 0x00), master2's `viewIn` pads to the same
   zeros, master2's entry is last and lands at output D. V7 inputs: D is read by master2. Output census: D declared.
   Self-settlement does not run (two masters). Result: the contract's state is reset and re-initialized by the
   attacker (ownership takeover). The same start-from-nothing trick applies to any spent record (mapping node).
Self-settlement alone would refuse it (census: input D carries a record but `seenIn` stays 0), so the gap is the
validator-settled path, which every proxied contract and every pooled (>= 2 masters) contract uses.

Fix: master: refuse an `in = 0xffff` entry whose `out` names an input carrying a mutable token of the frame's
category (`out < TXINPUTCOUNT && UTXOTOKENCATEGORY(out) == catX||01`), and only admit "output alone" for outputs
the transcript lists as created; validator: compare views exactly (length plus bytes, no zero padding/truncation)
and refuse a created chain at an index whose input is a state UTXO of the contract.
Needs a VM test (master1/master2/validator composition) to promote to CODE-CONFIRMED; the master path is traced
end to end, the validator's chain, read and census rules were traced at the functions cited.

## FW-2 CRITICAL, SUSPECTED: a delete declared after the write leaves the written record's output unconstrained

Files: `packages/solidc/src/framed/master/declared-view.ts:609-615` (exempt on `in# == in_p OR out# == out_p`);
`packages/solidc/src/generation/GenerateTargetTraversal.ts:29476-29497` (exempt pairs per written record);
`validator/program.ts:2337-2350` (last entry may delete), `:1951-1990` (output census only needs "declared").

Root cause: in the segment that writes data record D, any declaration whose `in` OR `out` equals D's index is
exempt from the kept walk, so the frame may add `{in: D, out: 0xffff}` after its honest entry. The body never sees
it (in-side = first match, out-side = last match on `out == D`, which the delete does not have).

Attack (same precondition: validator settlement of X): frame of X running any entry that writes a data-record
field (no external call needed). Segment declares
`A = {in: D, out: D, viewIn: v0 (real), viewOut: v1 (honest rebuild)}` then `B = {in: D, out: 0xffff, viewIn: v1,
viewOut: <empty>}`. Head: both shapes valid. Body: reads A.viewIn, rebuild == A.viewOut. Kept walk: A and B exempt.
Data-NFT covenant and the framed lock/category/value pins (`GTT:38160-38190`, `emitValuePreservation`) do not look
at the commitment. Validator: chain A (start = real v0) -> B (B.viewIn == A.viewOut, A does not delete) -> B last
and deletes (marker 1); output D is "declared" by A, so the census admits its mutable token. Output D's commitment
is compared with nothing: the attacker writes any state (owner, supply, paused, counters) into D, persistently.
S refuses it (census: output D carries a record but `seenOut` was reset by the delete), so again the gap is the
validator-settled path.

Fix: master: exempt an entry only when `in# == in_p AND out# == out_p` (keep the constructor's created form by
admitting `in == 0xffff AND out# == out_p` only in the genesis body), and at most one entry per exempt pair;
validator: a mutable own-category output must be the landing (non-delete, marker 1) of exactly one key's chain,
and a deleted key's input index must carry no record token at the same output.

## FW-3 MEDIUM, CODE-CONFIRMED: a reached conditional emit whose payload is all zero bytes is closed as skipped

Files: `GenerateTargetTraversal.ts:41184-41192` (gate `OP_PICK <blob> OP_IF`), `:41366-41368` and
`:41431-41436` (framed skipped close: commitment must be empty), `:18523-18534` (SEC-14 marker only for
zero-parameter events), `:21101-21130` (`emitEvmPackedValue`: uint256 0 -> 32 zero bytes, bool false -> 0x00).

Root cause: the conditional-emit gate is the VM truthiness of the payload, not its presence. A reached emit whose
payload is all 0x00 bytes (native `emit E(0)` / `emit E(false)` -> 0x00; evmCompat `emit E(uint256 0)` -> 32 zero
bytes; evmCompat `int8 -128` -> 0x80) reads as not reached. The framed master then requires its listed output to
carry the EMPTY commitment and skips the lock, immutable-capability, FT-amount and 1200-sat checks.
Attack: a caller drives a conditional `emit Withdrawn(amount)` / `emit Flag(false)` path with zero values: the
event row is lost (indistinguishable from not taken; T13 "missing events"), and the output is any lock the builder
likes. An honest builder that writes the real payload is refused (liveness).
Fix: gate on `OP_SIZE OP_0NOTEQUAL` (the not-taken blob is the empty push; a reached payload is never empty), or
carry a separate reached flag.

## FW-4 LOW, CODE-CONFIRMED: a raw one-byte argument 0x00 or 0x80 cannot be digested (call DoS)

File: `packages/solidc/src/framed/master/argument-push.ts:66-74`.
Root cause: for a non-numeric value of length 1, `canonicalPushScript` compares the byte with
`OP_GREATERTHANOREQUAL` / `OP_LESSTHANOREQUAL`; 0x00 and 0x80 are non-minimal script numbers, so the VM fails the
input. Any framed call whose run-time `bytes1`/`bytes`/`string` argument is exactly 0x00 or 0x80 cannot be made;
if that value is attacker-settable state feeding a required call (refund, payout), the path is blocked.
Fix: test the byte with `OP_EQUAL` against the 16 small-int bytes and 0x81 (or `OP_BIN2NUM` only inside a guard
that excludes 0x00/0x80).

---

## Cross-area note (validator, not FW scope)

`emitPadView` (`validator/program.ts:3164-3170`) pads every compared view with zeros and truncates it to 128 bytes.
Declared views are witness data of any lp32 length and masters decode them verbatim, so a declared view equal to
the real one plus trailing zero bytes (or with any bytes past 128) passes every validator chain/start/end compare.
This is what makes FW-1's zero start work; it can also flip a value tail's sign (`85` vs `85 00`). Owner: validator
lane.

## Checked and sound

1. Head record walk refuses `0xffff/0xffff`, every negative index other than the sentinel, and an entry whose
   larger index names no input/output (T52/T55 fix present, `frame-tail.ts:454-469`).
2. Negative-zero coordinate `00 80`: masters read it as 0 everywhere (head, body, kept walk, S); the validator reads
   it unsigned (32768) and fails closed at `in < TXINPUTCOUNT` / callee lookup. No exploitable split.
3. Self-settlement refuses FW-1/FW-2 shapes (per-index census against `seenIn`/`seenOut`, `frame-tail.ts:1066-1118`).
4. Kept walk in a segment that writes nothing refuses deletes and moves and compares `viewIn == viewOut` exactly.
5. Duplicate in-place declarations in a written segment cannot change the final view (first-in / last-out reads).
6. Data record held to `buildDataNftCovenantScript(cat)` on both sides with category preserved (T46,
   `GTT:38160-38190`).
7. Conditional data-record writes: on paths that skip the write the exempt pair becomes an undeclarable index, so
   the record must be kept (T50 for data records, `GTT:29476-29497`).
8. Call site binds kind, exact target (constant or computed), exact 8-byte value, `calleeRef != OP_INPUTINDEX`,
   recorded argsHash == caller-computed digest AND the callee's own call data (forward push parse, selector checked)
   hashes to it; void calls require an empty result (`call-site.ts:73-245`).
9. Canonical argument push follows the minimal-push rules (apart from FW-4's VM error).
10. Events outside a run: listed outputs strictly increasing with the owner's bare category (head), count pinned to
    the body's emits, each bound to payload/event lock/immutable/0 FT/<= 1200 sat or to the empty close.
11. Event and send runs: consecutive outputs, count pinned where the body ends, k-th effect at base + k.
12. Listed sends: consecutive distinct outputs (head), exact P2PKH lock (shape asserted), exact value, tokenless;
    count pinned; container accounting sums each listed output once (`master-head.ts:1000-1070`).
13. Return: retval compared with the body's own encoding; void requires empty (`emitFramedReturnCheck`).

## Not reached

- `batch-witness-derivation.ts` and the batch walk's exact record count for every group shape (whether an extra
  `in = 0xffff` / delete entry past `leading` is always counted out); mapping-node variants of FW-1/FW-2.
- `leading` exemption without `leadingAtLock` (value-chunk trailing count, multi-collection loops): whether every
  such segment pins its record count.
- Chunk record checks (`GTT` ~37790-38010), `emitFramedAliasedReadGuard`, paging (`emitFramedEntryIndex`).
- T45 node lock checks and T50 preservation for struct-field, array-element, delete and multi-slot batch writes.
- `utils/framed/witness-block.ts`, `canonical.ts`, `stop-site.ts`; `stop-sites.ts`, `placeholders.ts`,
  `loop-effects.ts`.
- Early-return and revert-after-call paths against the segment close.
