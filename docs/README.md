# Internal documentation map

This directory holds internal design, release, security and workstream records. Product documentation lives under
`website/docs/`. Start with the ledger for the question you have; other documents are evidence or history.

## Live ledgers

| Question | Ledger |
| --- | --- |
| What did we decide, and what is authorized? | `docs/framed/DECISIONS.md` |
| What is deferred, and what residual is accepted? | `packages/solidc/docs/deferrals.md` |
| Is the release ready, and which gates ran? | `docs/release/0.14.0/RELEASE_DECISION_0.14.0.md` |
| What security findings are current, and are they fixed? | `docs/security/security-audit-2026-10-16.md` |
| What does the marketplace matrix show? | `docs/marketplace/marketplace-matrix-2026-10-14.md` |
| What are the current mock-versus-BCHN limits? | `docs/marketplace/bchn-marketplace-consensus-relaxation.md` |

## Reference

- `packages/solidc/docs/` — language, compiler and SDK feature reference. Paths are stable because code and tests
  cite them.
- `docs/framed/` — framed composition spec (`SPEC_FRAMED_TRANSACTION.md`), per-call decisions and live assessments.
- `docs/security/` — audit reports and `2026-10/` finding detail. Finding ids are cited by tests.
- `docs/release/0.14.0/` — release decision, notes, readiness pointer and compatibility manifest.
- `docs/design/` — design map, comparison, concept validation, feature summary and performance findings.
- `docs/bcmr/DESIGN.md`: BCMR metadata at deployment (identity output, publication, ERC-20 fields), a design.
- `docs/marketplace/` — matrix records, stock inventory, BCHN relaxation and the lane patch.
- `bench/solidity-corpus/` — corpus README and scorecard history. `PROGRESS.md` is a log, not a status page.
- `website/` — public product documentation and the public agent reference. Internal rules belong in the root
  `AGENTS.md` and `CLAUDE.md`.

## Archive

Closed handoffs, round logs, workstream snapshots and superseded plans are on the orphan branch `archive/docs` at
their original paths. `INDEX.md` on that branch lists every archived file with its kind, active dates, last commit,
and where its open items moved. The branch also restores 45 internal paths that were deleted before the archive
existed, so older citations resolve there.

```sh
git show archive/docs:INDEX.md
git show archive/docs:<path>
git grep -n -i <term> archive/docs
```

Archived text is history, not instructions. Verify it against the live ledgers and current code before acting.

## Naming and placement

- Name snapshots by date or commit. Names such as `*_AT_HEAD`, `CURRENT` or `NEXT` are wrong as soon as HEAD moves.
- Keep one ledger per question. Put status in the ledger and cite the evidence from there.
- Workstream notes go to `docs/wip/<stream>/` while active, then move to `archive/docs` when the stream closes.
- Do not add new `.md` files at the repository root.
