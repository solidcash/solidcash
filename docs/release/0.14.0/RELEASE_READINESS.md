# Release readiness — moved

The maintained release decision is [`RELEASE_DECISION_0.14.0.md`](RELEASE_DECISION_0.14.0.md). It records the
0.14.0 recommendation, the six audit residuals, the five skipped tests, and the gate evidence at the release
commit.

The former readiness tracker (last reviewed 2026-08-09) is archived as history. Its 2026-08-09 "NO-GO" assessment
was superseded by the 2026-10-19 decision. Read the archived body with:

```sh
git show archive/docs:RELEASE_READINESS.md
```

That body also holds the operation-cost budget decision, the 94,651-byte marketplace measurement, and the
earlier corpus and suite numbers. Treat those numbers as a snapshot of their cited commits. Current limits and
gates live in `MOCK_CONSENSUS_LIMITS`, `bench/solidity-corpus/README.md`, and the release decision.
