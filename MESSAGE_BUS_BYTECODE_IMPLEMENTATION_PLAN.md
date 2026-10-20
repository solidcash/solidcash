# Message-Bus Master Bytecode Reduction Plan

## Objective

Reduce the bytecode added to each participant master for offloaded message-bus verification. Bytecode size is
the primary metric. Operation cost, pushed-byte cost, sidecar size, and transaction size are secondary metrics
and must not regress enough to threaten BCH2026 limits.

This worktree is based on `solidcash_v0.13.1` at `758c7b63a` and uses branch
`codex/message-bus-master-bytecode`.

## Step 1: Change the model

Before implementation begins, change to the requested implementation model. Do not edit compiler or SDK code
until the model change is complete. After changing models, re-read this plan and the repository instructions,
then verify the worktree branch and base revision.

## Invariants

- Every participant master must pin the exact artifact-specialized verifier covenant.
- The verifier must belong to the same token category as the participant master.
- Every master must bind its actual local batch and graph context to the canonical call manifest.
- Divergent verifier envelopes, forged results/effects, reordered participants, and substituted verifiers must fail.
- Verifier and master NFTs must remain correctly recreated with their economic payloads preserved.
- Full 32-byte SHA-256 digests remain security boundaries; digest truncation is out of scope.
- The exact verifier locking-bytecode pin, participant/verifier category link, same referenced verifier input and
  output, master recomputation from its actual local arguments, and binding-digest equality are non-removable.
- Every invariant removed from one covenant must have a documented remaining enforcement owner and opcode path.
  Passing tests alone is not proof that a check is redundant.
- No byte target authorizes removing an invariant without a documented remaining enforcement owner. A larger
  secure result is preferable to an unsafe target result.
- Do not parse a multi-kilobyte master or verifier unlocking bytecode merely to save covenant bytes unless exact
  measurements show a compelling net win. In Libauth, `OP_INPUTBYTECODE`, `OP_SPLIT`, and `OP_CAT` charge the
  bytes they push.

## Baseline measurements

Add a focused fixture that records exact sizes and VM metrics for a representative graph composition. Preserve
these currently observed reference values as diagnostic context, then update exact assertions from the fresh
worktree build:

| Shape | Observed bytes |
| --- | ---: |
| Direct master without message bus | 137 |
| Master with integrated verifier | 5,907 |
| Master with offloaded verifier | 1,712 |
| Integrated `__message_bus_verify_atomic` body | 4,289 |
| Compact `__message_bus_verify_atomic` body | 376 |
| Representative verifier sidecar covenant | 4,771 |

Record at least:

- complete master covenant bytes;
- compact verifier-binder invoked-body bytes;
- sidecar covenant bytes;
- master and sidecar operation cost;
- `stackPushedBytes` and hash iterations;
- finalized transaction bytes;
- verifier and master unlocking-bytecode lengths.

Use master covenant bytes as the primary decision metric. Prefer changes saving at least 24-32 master bytes or
approximately 2% of the master covenant. Retain smaller changes only when they unlock a later sizeable reduction
or materially simplify the security proof.

## Security gate: enforcement ownership

Before changing the binder, add a checked-in enforcement matrix whose entries cite the exact source and emitted
opcode sequence that owns each invariant. Populate and review at least this matrix:

| Invariant | Required owner before optimization | May be removed from master? |
| --- | --- | --- |
| Exact artifact-specialized verifier code | master locking-bytecode comparison | No |
| Verifier belongs to active participant category | master category association | No |
| Referenced verifier input and output are the same covenant instance | master index plus sidecar in-place recreation | No |
| Canonical manifest syntax, membership, ordering, and completeness | full verifier | Not applicable |
| Canonical envelope agrees across verifier inputs | full verifier plus generic sidecar tail | Not applicable |
| Manifest digest comes from the validated canonical manifest | full verifier local computation | Not applicable |
| Master local batch and graph context agree with verifier claim | master recomputation plus sidecar binding | No |
| Verifier lock, category, amount, value, and commitment recreation | generic sidecar tail | Yes, only after exact verifier pin |
| Participant master lock/category/value preservation | ordinary route covenant or dedicated lifecycle covenant | Only with cited owner |
| Participant master commitment preservation | ordinary route or compact binder | Only with cited owner |
| No unauthorized master NFT cardinality increase | minting-NFT conservation/lifecycle covenant | Only with cited owner |
| No unauthorized verifier NFT cardinality increase | physical-output census, token conservation/lifecycle covenant, or explicit verifier-count rule | No, until one exact owner is proven |
| No duplicate verifier instance ordinal within one category/pool | genesis allocation plus one-for-one in-place recreation and cardinality owner | Not applicable |

For each proposed deletion:

1. Cite the remaining source method and emitted opcodes.
2. Explain why the enforcing input necessarily executes in every accepted transaction.
3. Explain why the master pins that exact input rather than a similar token or covenant.
4. Explain how duplicate, reordered, or alternate outputs are rejected.
5. Add a targeted adversarial test attributed to the remaining enforcement owner.

Do not begin Phase A until this matrix is populated from the fresh-worktree source rather than copied as an
assumption from this plan.

## Breaking format replacement

The new 70-byte verifier commitment changes the generic verifier covenant, its P2SH32 address, the participant
master bytecode that pins that address, SDK discovery semantics, and deployed verifier compatibility. This work
is explicitly allowed to break all existing message-bus artifacts, deployments, verifier UTXOs, fixtures, and
wire data. Implement one replacement format only: no dual-version code, migration path, compatibility shim,
legacy discovery, or legacy spend support.

1. Keep the verifier commitment domain `4c335631` (`L3V1`). This is a breaking replacement, not a concurrently
   supported second generation, so do not increment the suffix. The changed generic verifier covenant produces a
   new P2SH32 address, and exact locking-bytecode discovery excludes old deployment UTXOs even though the commitment
   tag is reused. Do not duplicate the suffix in artifact metadata. Keep the existing call-manifest/envelope domain
   unchanged unless its wire codec itself changes; do not casually couple independent domain boundaries.
2. Remove `messageBus.version` rather than incrementing it, and do not add a `verifierProgram.version`,
   `verifierProgram.format`, compatibility discriminator, or version union. The changed covenant and replacement
   artifact shape identify the breaking replacement. The compiler emits only that shape, and the SDK supports only
   that shape.
   Because artifacts arrive as parsed JSON, use one shared structural validator at every public deployment,
   discovery, composition, and mutation boundary. Validate all fields required to safely construct the replacement
   verifier: exact verifier-program input metadata and function-table invariants, the canonical message-envelope
   description, limits, required route layout, and an exact structured result declaration for the three 32-byte
   verifier results. The commitment and binding domains remain shared code constants used during covenant and
   digest construction; do not copy them into artifact metadata merely for validation. Reject missing,
   legacy-shaped, malformed, or internally inconsistent data before deriving a verifier address or inspecting
   UTXOs. TypeScript types alone are not runtime validation.
3. Require contracts and verifier pools to be recompiled and redeployed. State this in release notes and artifact
   documentation.
4. Update deployment, lookup, composition, diagnostics, fixtures, generated documentation, and mutation helpers
   atomically. Delete obsolete format branches rather than retaining fallbacks.
   Intermediate commits may be internally incomplete, but no published package, release build, or mergeable commit
   may contain a compiler/SDK pair that disagrees on the artifact shape, commitment domain, return layout, or
   binding schema. Add a cross-package conformance test to the root gate.
5. Pin the sole supported commitment state machine:

```text
genesis:    domain[4] || instance[2]                                      = 6 bytes
recreated:  domain[4] || instance[2] || manifestDigest[32] || binding[32] = 70 bytes
```

6. The sidecar may accept exactly a 6-byte genesis commitment or exactly a 70-byte recurrent commitment. It
   must reject all other input lengths and must always emit exactly 70 bytes. For a recurrent input, the trailing
   64 bytes are historical state only: neither the full verifier, generic sidecar, compact master, nor SDK may use
   the previous manifest or binding digest as evidence for the current composition. Preserve only the six-byte
   domain/instance prefix and overwrite both digest fields from the current successful verification.
7. SDK discovery must require a structurally valid replacement artifact, the new verifier locking bytecode, new
   domain, supported exact input length, matching category, and mutable capability. Prefix matching alone is
   insufficient for the new path.
8. Add first-spend, recurrent-spend, malformed-length, wrong-domain, obsolete-artifact-shape, and
   old-verifier-program rejection tests. Exercise deployment, discovery, composition, and mutation entry points.
   Add recurrent tests whose old manifest and binding are valid for a previous transaction, random, all-zero, and
   copied from another pool instance; all must produce only the current composition's freshly derived digests.
   These tests prove fail-closed replacement and overwrite semantics, not backward compatibility.

## Phase A: Canonical verifier output position

The sidecar covenant already recreates verifier input `i` at output `i`. Remove the master-side scan over every
output and directly inspect `tx.outputs[activeVerifier]`.

Implementation:

1. Pin and test the in-place verifier-output invariant in the physical layout and composer.
2. Replace `activeVerifierOutput` and its loop with direct indexed introspection.
3. Prove in the enforcement matrix that the master references the exact verifier input whose covenant recreates
   output `activeVerifier`; do not rely on category or domain similarity alone.
4. An omitted or out-of-range output may fail through introspection, but preserve an explicit range check when it
   is required for stable diagnostics or a clear security proof.
5. Measure bytecode and VM metrics before proceeding.

Adversarial tests must cover moved, duplicated, omitted, and category/locking-bytecode-substituted verifier
outputs, plus two verifier inputs attempting to claim the same output.

## Phase B: Publish the manifest digest in verifier output NFT data

Stop every master from reading and slicing the final verifier's approximately 9 KB unlocking bytecode merely to
recover `sha256(callManifest)`.

Change the verifier commitment from:

```text
instancePrefix[6] || bindingDigest[32]
```

to:

```text
instancePrefix[6] || callManifestDigest[32] || bindingDigest[32]
```

The resulting 70-byte commitment is below the 128-byte NFT commitment limit.

Sidecar changes:

1. Cache `callManifestDigest = sha256(callManifest)` in the generated full verifier.
2. Reuse it when constructing `bindingDigest`.
3. Return `bindingDigest`, `callManifestDigest`, and `expectedMessageEnvelopeHash` to the generic sidecar tail.
4. Continue authenticating the supplied message envelope.
5. Recreate the verifier output commitment as prefix, manifest digest, then binding digest.
6. Require the invoked verifier result to be exactly 96 bytes and split it into three exact 32-byte values.
7. Construct the output commitment only after envelope authentication succeeds.
8. Derive `callManifestDigest` only as a local value from the parsed canonical manifest. It must never become a
   verifier ABI argument or an independently supplied witness.
9. Add one shared binding-domain byte constant to the fixed-width binding preimage, for example
   `sha256(BINDING_DOMAIN || manifestDigest || local fields || component digests)`. Define it once in the shared
   utilities used by compiler and SDK; do not independently encode a source-language string in each layer.
10. Use this normative binding preimage, with no optional fields or alternate encodings:

    ```text
    BINDING_DOMAIN[4]
    || callManifestDigest[32]
    || activeMasterInputIndex[uint16le]
    || expectedLocalRows[uint16le]
    || localBatchDigest[32]
    || mode[1]
    || graphFields

    mode = 0x00: graphFields is empty
    mode = 0x01: graphFields is exactly
      suppliedFixedSize[uint16le]
      || suppliedBlockSize[uint16le]
      || suppliedEmissionsDigest[32]
      || suppliedCallersDigest[32]
      || suppliedSettlementBoundary[uint16le]
      || suppliedCompletionPositionsDigest[32]
      || suppliedSettlementTableDigest[32]
    ```

    `localBatchDigest` and every named component digest are SHA-256 of the exact encoded byte string consumed by
    the verifier. Reject indices, row counts, sizes, and boundaries outside `0..65535` before encoding; do not
    truncate. `uint16le` is always exactly two bytes, including zero and values that would otherwise have a Script
    sign byte. Reserve every other mode value and reject it. Set `BINDING_DOMAIN` to the shared four-byte constant
    `4c334231` (`L3B1`), distinct from the `L3V1` commitment domain and every existing message-bus domain.

    Generate golden vectors for the SDK digest, full verifier return, and compact master acceptance from this
    schema. Include zero, `0x7fff`, `0x8000`, and `0xffff` integer vectors to catch sign and endianness drift, plus
    negative tests that substitute `L3B1`, `L3V1`, the envelope domain, and an all-zero domain at each inappropriate
    domain-tagged hash or commitment boundary. Separately prove that an old `L3V1` verifier UTXO is rejected by its
    obsolete locking bytecode/address, since its commitment tag intentionally matches the replacement tag.
11. Pin the invoked-verifier return layout as
    `bindingDigest[32] || callManifestDigest[32] || expectedMessageEnvelopeHash[32]`. Length and field order are
    both mandatory properties of the replacement artifact shape. Publish this as ordinary verifier-program result
    metadata used to construct and validate the generic sidecar, not as a protocol version or format number. Old
    verifier programs lack this three-result declaration and are rejected structurally.

Master changes:

1. Read the verifier output commitment directly at `activeVerifier`.
2. Extract the 32-byte manifest digest and claimed binding digest from the fixed 70-byte commitment.
3. Compute the expected binding from the extracted manifest digest and the master's actual local batch and graph
   arguments.
4. Compare the claimed and expected binding digests.
5. Delete the master-side final-verifier `OP_INPUTBYTECODE` path and all envelope/manifest slicing.
6. Read both digest halves from the same exact output index associated with the exact pinned verifier input.

Prefer the smallest generated extraction sequence. Measure ordinary SolidCash `slice` lowering against a
hand-shaped fixed split sequence equivalent to:

```text
6 OP_SPLIT; discard prefix
32 OP_SPLIT; retain manifestDigest and bindingDigest
```

Do not add a manifest-digest master ABI argument. The digest carrier is the exact pinned verifier output NFT;
accepting an independently supplied copy would add an attacker-controlled claim outside the sidecar-authenticated
path even if it produced smaller bytecode.

Adversarial tests must cover wrong digest halves, wrong or divergent envelopes, a digest from another valid
composition, coordinated output-commitment rewrites, altered local batches, altered graph context, a valid
verifier binding for the wrong active master index, selection of another unused verifier instance from the same
category as a positive control, another thread with the same category and covenant, and one verifier referenced
by multiple masters.

Verifier pool semantics are intentionally fungible. Any unused verifier UTXO is valid for a participant when it
has the structurally valid replacement artifact, the exact pinned verifier covenant, the participant category,
mutable capability, a
supported commitment state, and an instance prefix preserved by its own covenant. The instance ordinal supports
pool discovery and accounting; it is not assigned to a particular master and is not part of the binding preimage.
The active master input index makes the selected verifier's output binding transaction-specific.

Pin these substitution outcomes:

| Mutation | Expected result |
| --- | --- |
| Select a different unused verifier from the same valid pool | Accept |
| Reference one verifier output from two distinct masters | Reject at one or both masters because bindings differ |
| Use a verifier from another category | Reject |
| Use the same category with a different verifier covenant | Reject |
| Use an obsolete domain, length, artifact shape, or verifier program | Reject before composition or on-chain |
| Use another independently bound legitimate same-category master thread | Accept only if its lifecycle class is admitted |
| Copy a binding produced for another active master input index | Reject |

## Phase C: Canonical participant master output position

The composer already constructs participant outputs using participant block offsets. Make master recreation in
place an explicit atomic-layout invariant:

```text
participant master input index == participant master output index
```

Then remove `activeMasterOutput` and its scan. Directly enforce only those properties not already guaranteed by
the ordinary participant covenant. At minimum, preserve the master NFT commitment; avoid duplicating locking,
category, amount, or value checks already performed elsewhere.

Before doing so, add an eligibility matrix for ordinary, delegate, upgrade, selfdestruct, split, and merge
functions. For every class, either prove a dedicated in-place binder/layout or prove the class is ineligible for
atomic message-bus composition. Do not apply the ordinary optimization to an unclassified lifecycle path.

In-place recreation proves existence, not uniqueness. Separately prove that the ordinary minting-NFT
conservation or dedicated lifecycle covenant prevents unauthorized master outputs while continuing to permit
legitimate multiple threads of one category. Define whether multiple same-category threads may participate in a
single composition and test the supported rule.

Perform the same proof for verifier NFTs before relying on pool size or removing any verifier recreation check.
Determine whether the existing physical-output census rejects every extra verifier-shaped output. If it does,
cite the exact emitted classification and count-equality opcodes. If it does not, add an explicit verifier-region
or verifier-output-count rule. Equal transaction input/output counts are not sufficient proof because an attacker
may replace a fee or otherwise permitted output with a newly minted mutable verifier NFT.

Add verifier-cardinality mutations that:

- preserve the legitimate verifier output while adding a same-category, same-covenant clone;
- replace the fee output or another otherwise permitted output with a verifier clone while keeping counts equal;
- consume one verifier input and produce two verifier outputs using the participant's minting authority;
- duplicate an existing instance ordinal and six-byte genesis commitment;
- duplicate an ordinal carrying a valid prior 70-byte recurrent commitment;
- preserve every consumed verifier exactly once as the positive control.

Every unauthorized clone must fail at the documented cardinality owner, not merely because the transaction has an
unrelated stale binding or unequal input/output count. Pool fungibility does not permit duplicate ordinals or pool
growth outside the explicit deployment/lifecycle rule.

Add reordered, duplicate, omitted, and commitment-mutated master-output tests, including:

- an extra same-category master without removing another output;
- duplication of the active master while consuming another same-category thread;
- two legitimate same-category threads preserving their distinct in-place outputs;
- every admitted delegate/lifecycle class from the eligibility matrix.

## Phase D: Remove checks duplicated by the exact pinned sidecar

After the master verifies the exact sidecar locking bytecode and participant category link, audit each remaining
check. The pinned sidecar already enforces:

- mutable NFT capability;
- verifier commitment domain and exact accepted input shape;
- input/output locking-bytecode equality;
- token-category equality;
- token amount preservation;
- satoshi preservation;
- exact output commitment construction.

Remove master repetitions one at a time only after updating the enforcement matrix and adding an attributed
adversarial mutation test for each removed check. The compact master binder should retain only the minimum
cross-covenant handshake:

- valid verifier index;
- exact verifier locking-bytecode pin;
- verifier/participant category association;
- participant master commitment preservation not otherwise guaranteed;
- extraction of sidecar-authenticated manifest digest;
- recomputation and comparison of the local binding digest.

Measure after every deletion. Revert any deletion that fails to save meaningful master bytecode unless it is
needed for the final simplified form. Revert any deletion whose remaining enforcement owner cannot be proved,
regardless of byte saving.

## Phase E: Reduce repeated introspection and concatenation

Inspect generated Script rather than assuming source-level locals are cheaper.

1. Cache repeated token-category, commitment, or locking-bytecode introspection only when the emitted bytecode is
   smaller.
2. Inspect how the fixed binding preimage's `bytes.concat` lowers.
3. If it is a left-folded `OP_CAT` chain, compare a balanced concatenation schedule. Bytecode is the primary
   metric; lower `stackPushedBytes` is a secondary benefit.
4. Keep variable-size graph values independently hashed. Do not concatenate raw multi-kilobyte values into one
   item.

## Phase F: Evaluate deriving the verifier index

The hidden `__internal__activeVerifierIndex` argument adds an ABI field, an unlocking push, and validation code.
Evaluate only after Phases A-E establish the new baseline.

Candidate layouts:

- Retain the grouped verifier region and derive the index from authenticated participant metadata, if that is
  smaller than carrying the index.
- Interleave each verifier immediately after its participant block, allowing
  `activeVerifier = activeInputIndex + activeBlockSize`.

Do not adopt a layout change unless its measured master-bytecode saving justifies the broader compiler, SDK,
artifact, and security-proof changes. Preserve verifier-pool fungibility: a different valid unused instance may
be selected, while copying a binding between different active master input indices must fail.

## Phase G: Correct the obsolete 520-byte blob cap

Treat this as a separate capacity patch after the master binder is stable.

`MAX_MESSAGE_BUS_BLOB_BYTES = 520` reflects the old stack-item limit. BCH2026 permits 10,000-byte stack items,
but the usable route limit must also account for the 10,000-byte standard unlocking-bytecode limit, redeem-script
push, other ABI arguments, envelope, pushdata framing, and operation density.

Separate three limits rather than making compiled bytecode provider-dependent:

1. `artifact.messageBus.maximumBlobBytes`: a compiler-fixed, covenant-authenticated maximum that affects the contract
   address and cannot vary by provider after compilation.
2. Provider admission maximum: an SDK/preflight limit that may be equal to or stricter than the artifact maximum,
   but may never raise it.
3. Per-transaction encoded capacity: the remaining input-bytecode space after redeem script, envelope, all other
   arguments, pushdata framing, and required density reserve are encoded.

The SDK must admit at most the minimum of these three values. Add boundary tests across PUSHDATA1/PUSHDATA2, the
artifact limit, stricter provider limits, and the final admissible encoded input size.

## Deferred sidecar and wire-format work

After master reductions are complete and independently measured:

1. Remove either participant `actualSize` or `trailingUsed`, since one is derivable.
2. Introduce row-kind-specific encodings and remove fields fixed or derivable for that kind.
3. Collapse redundant envelope/manifest length framing in the replacement codec.
4. Add a worst-case verifier-program census and explicit headroom below the active script limit.

Do not mix these additional format changes into the master-binder patches.

## Verification loop

During implementation use persistent watch processes as instructed by `AGENTS.md`:

```bash
yarn build:watch
yarn test:compiler:watch -- test/journal-message-bus/MessageBusVerifierSize.test.ts
yarn test:sdk:watch -- test/journal-message-bus/AtomicMessageBusCodec.test.ts
yarn test:e2e:watch -- test/journal-message-bus/e2e/MessageBusEnvelopeBindingAudit.test.ts
```

Use narrower test names where possible. Before handoff, run the relevant one-shot compiler, SDK, and message-bus
e2e suites, followed by the authoritative root build:

```bash
yarn build
```

### Adversarial test methodology

Every security mutation test must:

1. Begin with a canonical transaction that passes the same VM profile.
2. Mutate only the targeted security property.
3. Repair all dependent envelopes, commitments, outputs, and other attacker-controllable data so an unrelated
   stale hash does not cause the refusal.
4. Re-sign the transaction or use a signature-free fixture so signature failure cannot mask the covenant result.
5. Assert the failing input index and VM reason where available, not only that some input rejected.
6. Include a nearby positive control showing the mutation harness can still construct an accepted transaction.
7. For each removed duplicate check, demonstrate that the documented remaining owner is load-bearing. Where
   practical, use a test-only weakened counterpart to prove the other covenant independently rejects.
8. Exercise standard BCH2026 limits as well as any relaxed diagnostic profile used for construction.

## Acceptance targets

- No master reads the final verifier unlocking bytecode to obtain the manifest digest.
- No compact master binder loops over transaction outputs.
- The verifier output commitment carries the full manifest and binding digests within 70 bytes.
- The replacement commitment accepts only exact 6-byte genesis and 70-byte recurrent inputs and always emits 70
  bytes.
- Obsolete artifacts, verifier addresses, commitments, and deployed verifier UTXOs are rejected; no legacy
  compatibility code remains.
- Performance goal: compact `__message_bus_verify_atomic` below 220 bytes; stretch goal below 180 bytes.
- Performance goal: representative master covenant reduced by at least 150 bytes from the fresh-worktree baseline.
- Sidecar growth remains small enough to preserve meaningful headroom below the active script limit.
- Every removed check has a reviewed enforcement-matrix owner and an attributed adversarial test.
- Ordinary, delegate, upgrade, selfdestruct, split, merge, and same-category thread behavior is explicitly admitted
  with a dedicated proof or explicitly refused.
- All canonical-envelope, participant-binding, result/effect forgery, output-layout, and verifier-substitution tests
  pass.
- Relevant one-shot suites and `yarn build` pass before handoff.
- Security invariants override all byte targets; missing a size target is not a reason to weaken an invariant.
