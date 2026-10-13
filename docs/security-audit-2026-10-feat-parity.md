# October 2026 security audit: fixes on feat/parity

The audit report (`SECURITY-AUDIT-2026-10.md` and `docs/security-audit-2026-10/`) lives on feat/per-call, where a
separate worker implements its response. This file lists the rows fixed on feat/parity; feat/per-call-merge brought
them onto feat/per-call on 2026-10-13 (see "Integration into feat/per-call").

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
  refused at compile (`DirectInvokedStaleReadError`); function-pointer calls there are not covered.
- Found, not fixed (nearest row DS-1, owned by the per-call worker): a direct conditional sorted write with no delete in
  its batch, skipped on an absent key, still runs its planned insert, and the honest SDK leaves a duplicate
  predecessor; the skipped write never binds its slot witness, so a spender can choose that duplicate's `next`.
- Found, not verified: a body invoked through `this.f()` reads mapping entries at its own layout's input slots, not
  the caller's.
- Failing on feat/parity and on feat/per-call alike, so not from this work: KernelLoopCompose "recursive event domain
  step and 64-frame resource bound", KernelPhysicalCallerWithScidCompose, and KernelRealUnicrowProxyArbitration.
