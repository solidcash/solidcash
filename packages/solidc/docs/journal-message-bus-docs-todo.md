# Journal/message-bus documentation consolidation TODO

The canonical user overview is `journal-and-message-bus.md`. The protocol specification remains
`layer3-single-transaction-bus-protocol.md`. The remaining files grew as implementation journals, handoffs, audit
records, and measured evidence. Preserve their evidence while reducing duplication.

- [ ] Merge stable state-journal semantics from `state-journal-audit.md` into a dedicated normative journal spec;
  leave findings and dated measurements in an audit appendix.
- [ ] Fold completed requirements and phase checklists from `layer3-single-transaction-bus-handoff.md`,
  `layer3-single-transaction-bus-requirements.md`, and `layer3-single-transaction-bus-progress.md` into one archived
  implementation record.
- [ ] Move current SDK guidance from `layer3-production-api.md` into generated/API documentation and keep only
  protocol-neutral examples in the user overview.
- [ ] Split `layer3-target-corpus.md` into a stable coverage matrix and dated benchmark results.
- [ ] Reconcile terminology in `state-bus-audit-handoff.md`: “journal” is local deferred state, “message bus” is
  multi-participant transaction composition, and “carrier” is the canonical per-transaction transcript.
- [ ] Add links from every retained audit/handoff file to its canonical replacement, then mark superseded prose as
  archival so future changes are made in one place.
- [ ] Generate the website's journal and message-bus limits/API tables from compiler artifact types to prevent drift.
