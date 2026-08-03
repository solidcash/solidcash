# External security audit handoff: atomic single-transaction message bus

> **2026-08-03 audit result and repair:** The first independent review correctly found two release-blocking
> authentication defects: the master callManifest argument was eagerly encoded as empty before a later ineffective
> `params` mutation (L3-01), and verifiers had no shared messageEnvelope-identity source (L3-02). It also showed that merely
> enabling the old binder exceeded the eight-party relay ceiling (L3-03), and that hostile tests mutated only the
> first verifier (L3-04). The implementation now loads the callManifest from the final verifier input in every master
> and verifier, removes the duplicate callManifest ABI argument and all post-build callManifest mutation, and includes
> direct forged-result and divergent-messageEnvelope VM regressions. The redundant `policyHash` wire field was removed and
> reserved row kind 5 now fails in the codec. Local derivation uses an impossible `vout=ffffffff` probe sentinel,
> restores it before assembly, and finalized preflight rejects leakage. All evidence below predating this repair is historical and must be
> regenerated before merge.

Audience: an independent Opus reviewer. Do not accept the implementation record, test names, or this handoff as
proof. Reproduce the commands, read the covenant paths, and try to construct accepted transactions that violate
the invariants below.

## Review target and merge boundary

- Repository: `/Code/cashscript`
- Worktree: `/Code/cashscript/.worktrees/message-bus-single-tx-bus`
- Branch: `codex/message-bus-single-tx-bus`
- Feature base: `aa562953` (`codex/message-bus-binding-spike`)
- Review range: `aa562953..HEAD`, where `HEAD` is the commit containing this handoff
- Canonical protocol: `packages/solidc/docs/atomic-message-bus-protocol.md`
- Stable acceptance matrix: `packages/solidc/docs/message-bus-coverage-matrix.md`
- Measured capacity: `packages/solidc/docs/atomic-message-bus-capacity-bch2026.json`

This branch is a direct descendant of `aa562953`; merging into that integration line is conflict-free. It is not a
small branch directly based on repository `master`: the feature base itself contains a long unreleased development
history. A maintainer must choose an integration target which already contains `aa562953`, or separately audit and
land that ancestry. Do not describe `aa562953..HEAD` review as an audit of the thousands of earlier commits.

## Claimed product behavior

The branch removes the graph-specific controller NFT, execution-root preparation transaction, and projection
inputs. A composed execution consumes existing participant/resource UTXOs, one genesis-deployed self-preserving
verifier per participant, and one ordinary P2PKH fee input. It creates all participant replacements, verifier
replacements, effects, and change atomically in that same transaction.

The messageEnvelope is transaction-varying data in the first push of each verifier unlocking bytecode. It is not embedded
in a participant address. Verifier programs are artifact-specialized and static; deployment may create a pool of
instances, and every use must consume and exactly recreate one. Simple calls retain the direct spending path.

Public entry points under review:

```ts
compileString(source);                        // inferred message-bus capability
compileString(source, { messageBus: false }); // direct-only or MESSAGE_BUS_REQUIRED

const composition = messageBus.compose({ calls, funder, changeAddress });
await composition.build();
await composition.send();
```

`messageBusVerificationInputCount` controls deployment-time concurrency. The SDK currently requires two to eight physical
participants, at most 24 callManifest rows, a bare-P2PKH terminal funder, one network provider, a messageEnvelope blob no
larger than 223 bytes per local message-bus batch envelope, and successful exact finalized-transaction preflight.

## Assets, authorities, and attacker model

Assets at risk are participant master/state NFTs, mapping and dynamic-value NFTs, satoshi/token containers,
sidecars, emitted event/return NFTs, transferred BCH/tokens, verifier NFTs, and authenticated logical call results.

Assume an attacker controls transaction assembly, input/output ordering, all unlocking bytes, fee funding,
signatures they legitimately own, call arguments, selected participants, and any unrelated UTXOs. They may replay
old messageEnvelopes, mix artifacts/categories, duplicate semantic rows, exploit variable chunk counts, provide equivalent
but non-canonical encodings, omit effects, append suffix data, and mutate any output. They cannot break BCH hashes,
forge another party's signature, or double-spend an outpoint accepted by consensus.

There is intentionally no universal bus signer or reusable controller authority. Application-specific counterpart
authorization remains the contract's responsibility and must be represented by compiled state/signature policy.
The protocol must establish callManifest integrity and mutual settlement; it must not accidentally grant business
authorization merely because a verifier NFT is present.

## Required security properties

Treat any accepted counterexample as a release blocker.

1. Every participant authenticates one byte-identical canonical messageEnvelope; no verifier or master can validate a
   different callManifest.
2. The authenticated participant table equals the physical participant set. Omission, duplication, substitution,
   and reordering fail.
3. Participant blocks are contiguous prefix sums of authenticated actual sizes. A change from one to five dynamic
   chunks in A may relocate B physically but cannot change B's local meaning.
4. Every active master proves it is local offset zero in exactly one block and binds its exact verifier.
5. Every invocation, caller, completion, result, resource, event, transfer, token, and sidecar row is consumed once;
   counts and EOF prevent ignored suffixes.
6. Call selector, mode, caller, calldata, arguments, result, parent/depth, reachability, and occurrence bounds match
   compiler-authored execution.
7. Every scalar, mapping entry, dynamic chunk, satoshi container, token container, and sidecar transition owns one
   exact physical slot and preserves all unrelated state.
8. Events and BCH/FT/NFT effects cannot be forged, redirected, duplicated, omitted, or settled by another row.
9. Verifier NFTs are attestations, not replay authority. Participant outpoints prevent replay and each verifier
   must exactly self-preserve.
10. MessageEnvelope construction is independent of transaction IDs, signatures, and complete unlocking bytecodes, so
    signing cannot invalidate or recursively change it.
11. Unsupported aliases, cardinalities, recursion budgets, delegate contexts, introspection, lifecycle operations,
    and opaque effects fail closed with stable diagnostics.
12. Every admitted transaction satisfies current BCH-2026 consensus and relay limits; compiler metadata, SDK
    admission, and finalized-byte preflight must agree.

## Code-review map

Start at the trust boundaries, not the tests:

| Area | Primary symbols/files | Questions |
| --- | --- | --- |
| Shared schema and constants | `packages/utils/src/artifact.ts`, `message-bus-verifier.ts` | Are domains, limits, program identity, instance commitment, and locking bytecode unambiguous? |
| Compiler admission | `packages/solidc/src/compiler.ts`: `normalizeCompilerOptions`, `synthesizeMessageBusRoute`, two-pass binder compilation | Can fallback silently weaken a required route? Can explicit false be bypassed through multi/split compilation? |
| Compiler policy/layout | `SymbolTableTraversal.ts`: message-bus discovery, effect-frame planning, block layout | Are all transitive effects and repeated owners classified? Can a route advertise fewer slots/rows than execution uses? |
| Covenant generation | `GenerateTargetTraversal.ts`: graph row/effect consumers and verifier/binder code | Does every branch consume exactly its rows and bind actual inputs/outputs, not caller claims? |
| Codec/layout | `packages/solidcash/src/message-bus/atomic.ts` | Are integers/lengths canonical, bounds checked before allocation, and EOF/domain checks complete? |
| Graph finalization | `packages/solidcash/src/message-bus/graph.ts`: `finalizeAtomicInvocationGraph`, participant identity, trailing capacity | Can owner/consumer/slot identities collide or drift with variable spans? |
| Composer | `packages/solidcash/src/message-bus/compose.ts`: `_build`, convergence loop, `assemble`, `admit` | Can SDK claims diverge from compiler policy? Are signatures generated only after final messageEnvelope/layout? |
| Verifier deployment/spend | `StatefulContract.ts`, `ContractFactory.ts`, `stateful/covenant-helpers.ts` | Are pools minted only at genesis, uniquely committed, selected correctly, and exactly recreated? |
| Final preflight | `message-bus/preflight.ts`, `TransactionBuilder.ts` | Is the exact signed/finalized transaction evaluated under the intended VM and policy limits? |

Also review the deletions in `git diff --stat aa562953..HEAD`. Much of the removed 96k-line corpus tested obsolete
controller/projection architecture. Confirm that each security property, rather than each old implementation
detail, has equivalent atomic evidence. Large deletion volume is not itself proof of adequate replacement.

## High-value adversarial review order

1. Mutate the messageEnvelope independently in a non-final verifier and forge the result consumed by its master.
2. Swap two same-artifact/different-category participants; then two different-artifact/same-layout participants.
3. Change an early participant's `actualSize` and chunk run while retaining later local rows.
4. Duplicate an owner with two physical masters or make two rows claim one resource/effect slot.
5. Drop the last row, append a valid-looking row after declared EOF, use non-minimal pushdata, and truncate each
   length field at its boundary.
6. Reorder repeated calls whose results feed later arguments; attempt branch/loop under- and over-consumption.
7. Redirect verifier, master, mapping, chunk, event, BCH, FT, and every NFT-capability output independently.
8. Replay messageEnvelope/verifier bytes with fresh participant UTXOs, and replay the complete accepted transaction.
9. Mutate signatures after messageEnvelope construction and verify messageEnvelope stability; try to create a circular dependency.
10. Force composition close to the 100,000-byte and operation-density boundaries with resource-heavy local routes,
    not only the representative returning chain.

## Direct evidence and its limits

- `packages/solidc/test/journal-message-bus` covers inference, direct-path preservation, explicit opt-out,
  compilation refusals, journals, and verifier-size bounds.
- `AtomicMessageBusCodec`, `AtomicMessageBusGraph`, and `AtomicMessageBusBalancedAssembly` cover pure framing/layout and
  mutation cases without a node.
- `AtomicMessageBusCompose` evaluates canonical and hostile semantic/effect transactions in BCH-2026 VM tests;
  `MessageBusMessageEnvelopeBindingAudit` directly pins the L3-01 and L3-02 accepted-transaction reproducers.
- `AtomicMessageBusCapacity` evaluates every finalized input for 2/4/5/8 participants. After authentication repair
  and wire compaction, the measured eight-party transaction is 92,126 bytes; its worst operation-density ratio is
  0.9845248035. Exact finalized-transaction preflight remains authoritative.
- `standard-policy-harness.sh` broadcasts five semantic capstones and the eight-party maximum to BCHN v29 with
  `acceptnonstdtxn=0`, then restores the default node.

The VM and live suites share compiler/SDK construction code. They are regression evidence, not independent formal
proof. The eight-participant result is representative, not a promise that every eight-party graph fits; exact
preflight is authoritative. Environment-gated node/corpus probes and unrelated repository test placeholders remain
outside the normal suite and must not be counted as passed.

## Reproduction commands

From the worktree root:

```bash
git status --short
git diff --check aa562953..HEAD
yarn build
yarn lint
yarn workspace solidc test
yarn workspace solidcash test
yarn --cwd website build

yarn workspace solidc test --run test/journal-message-bus
yarn workspace solidcash test --run test/journal-message-bus

# Restarts the repository BCHN service temporarily and restores it on exit.
bash packages/solidcash/test/regtest/standard-policy-harness.sh

rg -n 'hiddenBatch|repeatedExternalBatch|messageBusController|messageBusControllerCategory|__testMessageBusBindingSpike|L3GRAPH1|L3B1CTRL' \
  packages/solidc/src packages/solidcash/src packages/utils/src
```

Package-surface smoke check after `yarn build`:

```bash
node --input-type=module -e "
  const sdk = await import('./packages/solidcash/dist/index.js');
  const utils = await import('./packages/utils/dist/index.js');
  if (typeof sdk.messageBus.compose !== 'function') throw Error('missing messageBus.compose');
  if (sdk.messageBus.ATOMIC_MESSAGE_BUS_CAPACITY.maximumParticipants !== 8) throw Error('capacity drift');
  if (typeof utils.messageBusVerifierLockingBytecode !== 'function') throw Error('missing verifier export');
"
(cd packages/solidcash && npm pack --dry-run --json)
(cd packages/solidc && npm pack --dry-run --json)
```

## Repaired release evidence

On 2026-08-03, after the L3-01 through L3-04 repairs on the branch containing this file:

- monorepo build and lint passed in all six packages;
- SolidC passed 64 files and 2,408 tests;
- SolidCash passed 430 files and 3,731 tests; its reported skips/placeholders are environment-gated or unrelated
  to this feature;
- the dedicated compiler suite passed 65 tests;
- the dedicated SDK suite passed 255 tests, with ten environment-gated probe cases skipped;
- the Docusaurus production build and deterministic generated artifact reference passed;
- the built package exports `messageBus.compose`, the capacity object, and verifier helpers; npm dry-run packs include
  their JavaScript and declarations;
- BCHN v29 under `acceptnonstdtxn=0` accepted the repaired no-setup two-party transaction, transitive three-party
  return, event, BCH transfer, repeated FT settlement, and the authenticated 92,126-byte eight-party transaction;
- the harness restored BCHN to its default healthy regtest command afterward;
- the production residue search above returned no matches.

The dedicated hostile tests additionally demonstrate rejection of the forged caller-only result from L3-01 and the
split-callManifest construction from L3-02 while keeping the eight-party transaction below the 100,000-byte relay limit.

## Expected reviewer output

Report findings by severity with: violated property, exact source location, minimal reproducer or accepted hostile
transaction, expected versus actual behavior, and whether the issue is compiler admission, artifact metadata, SDK
assembly, covenant enforcement, or preflight-only. Explicitly distinguish:

- consensus-valid theft/corruption;
- relay-policy or capacity failure;
- SDK refusal of a sound transaction;
- compiler diagnostic/ergonomics defects;
- documentation drift.

Conclude separately on (a) protocol soundness, (b) implementation soundness, (c) capacity/standardness, (d) public
API stability, and (e) readiness to merge onto a base which already contains `aa562953`.
