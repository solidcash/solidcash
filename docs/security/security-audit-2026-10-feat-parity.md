# October 2026 security audit: fixes on feat/parity

The audit report (`SECURITY-AUDIT-2026-10.md` and `2026-10/`) lives on feat/per-call, where a
separate worker implements its response. This file lists the rows fixed on feat/parity; feat/per-call-merge brought
them onto feat/per-call on 2026-10-13 (see "Integration into feat/per-call").

The per-call decisions are in [`../framed/DECISIONS.md`](../framed/DECISIONS.md).

| Row | Severity | Fix | Commits | Tests |
|---|---|---|---|---|
| DS-7 | HIGH | a batch census counts a pure-read slot only at the collection's entry address | 6e292ca1f | e2e/BatchCensusReadSlots |
| DS-8 | HIGH | a batch proof input is never a pure-read slot's input (direct functions) | 228ea4a5e | e2e/BatchProofReadSlotOverlap |
| SEM-11 | HIGH | function ids from the entry, struct fields, abi.decode and external returns are pinned to public functions | 3df64a824 e37c4aa96 11b716f9f 707df2835 | FnPtrEntryIdValidation, e2e/StructFunctionValueCalls |
| SEM-1, SEM-6 | HIGH, LOW | path-sensitive final-require and locktime-guard checks | 66af16f81 | solidc AuditSem1FinalRequire |
| SEM-2, SEM-10 | MEDIUM, INFO | an embedded child fails closed on unexpanded modifiers; fallback and receive are inherited | 57de597dc | solidc AuditSem2EmbeddedChild |
| ARITH-3, -4, -6 | MEDIUM | `bytesN(bytes)` pads and truncates; decode length and enum range checks | 130d7fbdf | e2e/AuditArithDecodeLength |
| DX-4 | HIGH | a standalone callee refuses any own-category return carrier | 624daa86a | e2e/AuditDX4ReturnBinding |
| TOOLS-1 | HIGH | libauth pinned to the commit the lockfile resolves | cf8145ecd | - |
| KB-3 | HIGH | a bound route cannot skip its verifier with a negative index inside a composition | 7afe87c00 | journal-message-bus/e2e/AuditKB3VerifierSkip |
| DS-6 | HIGH | a conditional sorted delete can no longer switch off its batch: every direct shape settles each target by what ran (lone delete, a delete beside writes in either order, swap-remove alias writes, chains of writes and a delete on one node), framed frames have no guard and settle absent keys through the bracketing node, and message-bus routes never had one; same-key alias writes keep their value where the delete does not run and later reads see it | 34ffb8b25 06c633c6d 190d5d5b1 32cc7fbe9 71566d3c6 595d99489 34798d030 838aa2f52 67b8003d3 7b98706bc 8a0df1a47 0a19d26ac 3a287499c 3a63dfa6b 974c61954 3cac34e5c 6b7f015e6 93f7a13d8 0dfe6d25f bcb07593b ed04bbcfb ee43ff8bd 9dddd0b5a fcbbea6c4 1ae981ec1 0bee4e7a9 c1b4c1887 daf87ea80 d67c81042 | e2e/AuditDS6*.test.ts, framed/hostile/conditional-delete-node, framed/call/guarded-mapping-delete, framed/call/alias-write-guarded-delete |
| CRYPTO-4 | HIGH | the blockhash keeper baton sits at a covenant that can only mint oracle records | cfef81dfa | e2e/AuditCrypto4KeeperAuthority |
| CRYPTO-5 | MEDIUM | a reported height stays below the time threshold; number and timestamp cannot be rewound | cfef81dfa e33869dd4 | e2e/AuditCrypto5OracleRewind |
| SDKFRAMED-1, -2 | HIGH | a framed deploy proves its own coins before signing; a framed proxy genesis is minted already initialized, and a deploy commits fully or broadcasts nothing | 5e6d501a2 6dad02a18 d9251997a | framed/AuditSdkFramedDeploy, framed/AuditSdkFramedProxyAtomic |
| DX-8 | HIGH | a delegatecall, direct or message-bus routed, conserves the implementation's own records, in order; the SDK mints no stray event under the implementation's category | cb3c138b6 2f99d5edb 8841257b2 b063526ca | e2e/AuditDX8DelegateRecords, e2e/AuditDX8RoutedDelegateRecords, e2e/DelegateLegacyEventCategory |

SDKFRAMED-1 adds an optional `NetworkProvider.getLedgerOutput`; only `MockNetworkProvider` implements it, for
simulator coins that have no transaction behind them. Every other provider fails closed. The same own-coin proof now
also guards the direct stateful deploy (e781670ce) and contract-driven child geneses, `deployFrom` and composition
children (21aeaeee1); no audit row names those.

## Overlap with the per-call fixes

DS-7, DS-8, SEM-1, CRYPTO-4 and DX-8 also have a fix in the per-call worker's tree, designed differently:

- DS-8: the per-call guard also covers message-bus routes; the one here covers direct functions.
- CRYPTO-4: per-call gates data and entry writes on the authority input's lock size and unlocking length, which
  changes the data and entry covenant bytecode; here the keeper baton is confined by its own covenant and contract
  bytecode is unchanged.
- DX-8: per-call pins each implementation record at its own index; here the records are conserved in order.

## Integration into feat/per-call (2026-10-13)

feat/per-call at d6821a812 already failed 53 SDK and 19 compiler tests (delegates and proxies, token containers,
sorted read-after-write, the keccak loop, external state reads, return indices); the merge added about 20 more. The
integration fixed them on feat/per-call-merge:

| Fix | Commits |
|---|---|
| A direct delegate binds the proxy's entry, value-chunk, container and nested record locks; a delegated route and its handlers bind the proxy's records too | 3896432d8 95bc01372 7d90dd4db |
| A direct delegate keeps the proxy's token containers (the foreign scan runs there, VM-proven drain closed) and admits the proxy's own sender anchor | 1408b8c2d 607051ea2 |
| A direct delegate's event pin exempts the proxy's own SCID anchor, read at the proxy master's lock | d1c7dbdc1 |
| DX-8 keeps the conservation chain only; the own-index delegate pin is dropped | 2d1e64297 |
| KB-2: a P2PKH lock is an address identity again; a 23-byte identity must be a P2SH20 template | 6031e8d74 d68ca8994 687ed9151 |
| The minting-authority walk takes the push reaching the end as the redeem | 2282e25d8 30af5abdc 112e4281f |
| An activity-settled delete binds its present node's next witness (DS-6) | 7a1f6a4e0 |
| The own-coin proof and per-call's funding hardening reconciled; fixtures funded with proven coins | 3d5471181 67260c100 |
| ARITH-4: a static `abi.decode` ignores bytes after its last word again, as solc does (the last word is still read as exactly 32 bytes) | 39670ebad |
| Message-bus builds keep the kernel's lifecycle policy for every lifecycle kind (kernel precedent, user decision 2026-10-13): DX-9's first point stays open there; its checkDataSig and sighash-fence points hold and are tested outside the bus | e231d3090 13947a043 |
| Generated route helpers skip the `.sol` operand rules (feat/parity 7a12c1b99 refused their own bytes comparisons under a `.sol` root) | e0cbde22a |
| The deploy observer learns constructor value-chunk runs at the master-bound lock | ac5994a64 |
| Test pins brought up to date: two writes of one key settle as one node (9b478f894), fn-pointer state defaults and encoding (d32e57b82, ccf77b8dc), two bytecode-shape guards, a moved-event tamper that really moves | 4b13e7188 3ef154a43 a2da5abe4 028452452 |

Not merged: a00dd2f72 (delegate marking of bare mapping and array writes), see deferrals.md, "A routed update of a
proxy's records". Direct delegates and delegated routes now inline the container and entry address builds (size not
measured). In a delegate body the foreign scan also refuses a forwarder that draws on one of the proxy's containers
in the same transaction; no test does that.

Test status at the landing head (2026-10-13, full `test:all` plus the corpus): utils 485/485; solidc 88 of 7233
failed; SDK non-e2e 396 of 5988; SDK e2e 140 of 3500; testing 4 of 107; testing-suite 1 of 27. Run on both parents
over the same files: 40 fail on both, 592 fail on feat/per-call d6821a812 and pass on feat/parity, none fail on
feat/parity alone, and 2 are new: timeouts in KernelAdmission (60 s; 52 s on feat/parity) and the
AtomicMessageBusCompose ecrecover case (120 s). Corpus 2720/2805, gate PASS, identical to feat/parity.

The merged hardening grows delegate bodies: in LibraryDelegateEvents the facet input's unlock goes from 1307 to 2295
bytes, and inline delegate address builds add 342 B to one marketplace body; a lock-parameterised shared address
helper would win back about 110 B per site. One body (selector 2928b689) still invokes the shared address helper
bound to the executing input's lock; whether it runs as a delegate is not checked.

SEM-1 after the merges (2026-10-14, ef3d4dc5b and 58b93f911): the path check and its seal cover every entry except
two whose returns still end under a covenant that settles the contract's records: a framed body, whose head pins the
master and its value, and a direct entry of a stateful contract that reads an entry, where the collection census
runs on every path. A direct stateful entry that reads no entry has only C3's count, which a co-spent record
rewritten in place keeps balanced, so its unguarded return is sealed. Lifecycle entries, delegatecalls and the
constructor are always checked. Focused local VM evidence now drives both exempt return paths: the direct mapping
reader refuses a rewritten mapping node, and the framed reader refuses rewritten mapping and data records while
accepting unchanged records (`AuditTranscriptStateIntegrity`, `framed/master/audit-exempt-return`).

## Closing validation (2026-10-14)

The closing run at `3dc7e8b54` completed after the atomic-bus stages and trailing-band layout fixes. The package
runs passed 17,291 tests, with no unexpected failures:

| Scope | Passed | Other outcomes |
|---|---:|---|
| utils | 485 | - |
| solidc | 7,269 | - |
| SDK non-e2e | 5,831 | 4 expected failures, 167 skipped, 5 todo |
| SDK e2e | 3,501 | 25 skipped, 3 todo |
| solidhat | 71 | 1 skipped |
| testing | 107 | - |
| testing-suite | 27 | - |

Build, lint, spellcheck, source-tree guard, examples, docs snippets, application and security conformance,
generated-project smoke and packed-package smoke passed. The reviewed corpus baseline passed at 2,720/2,805
positive fixtures and 149/2,158 over-accepted negatives, with no status changes against feat/parity. These are
the existing baseline's allowances, not a claim that all corpus fixtures compile or all invalid programs fail.
The local package runs did not enable CI coverage instrumentation.

The resumed session also passed `yarn test:application-regtest`: both files, all 9 tests, against BCHN v29.0.0 and
the repository's pinned Fulcrum v2.1.3 image. The earlier host-port conflict was avoided with a temporary Compose
project sharing the execution container's network namespace and publishing no host ports. No repository service
configuration changed. All configured local gates have now passed; CI coverage instrumentation and the hosted
workflow itself were not run here. Source evidence: the resumed session's `scratchpad/parity/full7-progress.txt`,
`full7-*.txt`, `ci/f7-*.txt` and `/tmp/codex-resume7d9-application-regtest.log`.

## Residuals and findings

- SDKFRAMED-2: a framed proxy initializer that calls another contract is refused by default; its `initializeAs: 'hop'`
  opt-in still relays three transactions (packages/solidc/docs/deferrals.md).
- DS-6, fails closed (deferrals.md, "Sorted batch targets sharing a node"): two writes of one key that both run on one
  node, more than one delete of a batch beside its writes, and a deleted node's own key beside an insert where the
  value's default is not empty.
- DS-6, framed: a swap-remove write of a chunkable value followed by a delete that may not run
  (`m[a] = v; if (c) delete m[k];`) is refused at compile, keys differing included, because its write could be lost;
  settling it would need chunk runs staged on the delete's node.
- DS-6: an external self-call (`this.get(k)`) that reads the mapping between a swap-remove write and its delete is
  refused at compile (`DirectInvokedStaleReadError`). Unresolved indirect calls there, including expression callees
  and calls inside an invoked helper, fail closed (`DirectIndirectStaleReadError`) unless their function type proves
  they are pure. Non-pure pointers are refused for both same-key and different-key runtime arguments: target-specific
  effect resolution remains unsupported. Inlined internal getters observe pending same-key values and the other
  key's own value. The neutral pointer reproduction compiled before this guard, but even its honest pending-value
  call failed VM preflight; it did not establish an accepted stale-read exploit.
- DS-1 follow-up, fixed for a direct singleton conditional scalar write: if-conversion had inserted an enumerable
  zero-valued node on the skipped absent-key path. The source branch now retains its activity flag; compiler and
  SDK use the existing activity settlement to keep the predecessor unchanged and remove the planned insert.
  `AuditTranscriptStateIntegrity` proves no absent-key output, refusal of a changed predecessor successor, and
  successful taken-path insertion. This does not claim additional multi-target conditional topology support.
- Invoked-read follow-up: a direct void body invoked through `this.f()` is now inlined into the caller's physical
  collection frame. `AuditTranscriptStateIntegrity` proves two distinct-key reads settle and a wrong-key call is
  refused. Returning self-calls retain their existing fence after pending mapping writes (`AuditDS6SameKeyAlias`).
- Historical failures on both integration parents: KernelLoopCompose "recursive event domain step and 64-frame
  resource bound" and KernelRealUnicrowProxyArbitration now pass in the closing run. The model-B logical-identity
  title in KernelPhysicalCallerWithScidCompose is explicitly skipped by the user's decision; see deferrals.md.
- Evaluated decision D30: do not implement batch-width witness binding. This is not a deferral; the evidence,
  candidate's cost and SDK impact, and scope for future reevaluation live in [D30](../framed/DECISIONS.md).
- Event-integrity follow-up, fixed locally: split/merge and unsafe tiers 1/2 now run the ordinary own-category
  immutable-output pin. `AuditLifecycleEventIntegrity` accepts their honest transactions and refuses an extra
  addressable own-category event NFT. The fork case previously accepted that output. Explicit `unsafe(0)` remains
  outside covenant policy; this change does not redefine that escape hatch.
- Event-integrity replay follow-up, fixed locally: the generic exact-input-tuple exception was removed from
  `emitOwnCategoryImmutableNftOutputPin`. A previously emitted log cannot be published anew merely because its
  144-block event covenant can now be spent. The same regression verifies every honest external-call input,
  preserves a genuine SCID-v1 anchor bound to the master lock, evaluates the actual matured log covenant with
  sequence 144, and refuses recreation of that log at the caller. Structured identity metadata remains exempt.
  No BCHN run was made for either event follow-up; D30 is unchanged.

## SDK equality observer follow-up (2026-10-14)

The transcript's four remaining observer checks are now aware of outlined equality helpers:
`computed-dynamic-chunks`, `computed-value-chunks`, `sc-derive-return-blob` and
`stb-repair-computed-chunk-output`. They share `probe-instruction-sequence`'s exact instruction matcher,
which follows constant helper identifiers through the executing VM's function table and recorded caller
continuations. Unknown, malformed, dynamic, recursive or EVAL dispatch fails closed. Continuation lock
confirmation uses the same matcher; count and reconstruction checks also recognize their preceding DROP/CAT
across helper boundaries. Output ownership, ordinal, category, capability and descriptor checks stay in their
existing callers. SIZE-only introspection and untaken branches do not become output expectations.

Local evidence: `OutlinedEqualityObservers.test.ts` has 12 passing cases. It covers nested EQUALVERIFY and
EQUAL/VERIFY event pins at the exact requested coordinate, outlined value-count checks, split continuation
pins, commitment and lock repair, and exclusion of inactive/SIZE observations. Its inline and outlined dynamic
convergence cases evaluate all three transaction inputs with the ordinary VM and refuse a changed chunk.
The bounded adjacent check adds `ComputedValueChunkOwnership.test.ts` and `HashedReturnProbe.test.ts`:
29 tests passed across those three files. Changed-source lint and the incremental build passed. No BCHN run,
full suite or marketplace measurement was performed for this observer change; the historical closing-run
counts above remain historical. The diagnostic convergence test explicitly uses devOracle and restores its
prior mode; production recipe restrictions are unchanged. D30 and deferred model-B identity are unaffected.
