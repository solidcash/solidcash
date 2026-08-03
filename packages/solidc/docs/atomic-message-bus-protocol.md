# Atomic Message Bus Protocol

Status: production wire format. This document is normative for the atomic path. Measurements from
the removed `L3GRAPH1` implementation survive only in the historical baseline census.

The byte strings `L3C1`, `L3BUS1\0\0`, and `L3V1`, and the selector `53434231`, are immutable legacy
wire identifiers retained for compatibility with deployed contracts. They are not current API or feature names.

## Transaction shape

For canonically ordered participant blocks `P0..Pn-1`, inputs and outputs share this slot layout:

```text
P0[0..actualSize0) || ... || Pn-1[0..actualSizen-1)
|| V0 || ... || Vn-1 || fee/change
```

`P0.base = 0`; every later base is the prefix sum of preceding authenticated `actualSize` values. Local offset
zero is the sole state-input slot. Each contract commits a fixed prefix and maximum trailing capacity in its locking
bytecode, while each transaction commits `actualSize = fixedSize + trailingUsed`. Only that contiguous used
prefix is physically present; unused trailing capacity is not padded with inputs or outputs. All call-manifest
rows carry participant-local offsets, and every absolute access is derived as `base(owner/consumer) + offset`
while verifying the transaction. `Vi` is participant `Pi`'s artifact-specialized, self-preserved verifier NFT.
The fee input is paired with change immediately after the verifier region. There are no controller or projection
slots. The SDK derives all absolute indices; application code supplies none.

## Message envelope

Every verifier unlocking bytecode carries the same call manifest as its first canonical `PUSHDATA2` push (the minimum
two-participant message envelope is already larger than 255 bytes). Arguments follow in
reverse ABI order, followed by the verifier redeem program:

```text
push(messageEnvelope) ...reversed verifier ABI pushes... push(verifierProgram)
```

Every verifier covenant authenticates its own first push against the call manifest loaded from the final verification
input. Both artifact-specialized verifiers and compact state inputs load that same call manifest directly;
it is not duplicated as an ABI argument. The verifier validates the call manifest, returns
`bindingDigest || expectedMessageEnvelopeHash`, and the preserving covenant authenticates its actual first push without
parsing it. This makes divergent per-participant call manifests fail. The verifier output commitment is
`"L3V1" || instance:u16le || bindingDigest`, where `bindingDigest` hashes the call manifest, local batch, active
input, row count, and graph witnesses. Each compact state input recomputes that digest and pins the exact verifier
lock, category, index, and commitment. Signatures and complete unlocking bytecodes are excluded, so there is no
transaction-signature circularity.

SDK-only effect/return derivation probes temporarily use state-input outpoint index `ffffffff`, which cannot name a
real transaction output. The route skips its final binding check only for that impossible probe outpoint; the SDK restores
the real outpoint before assembly, and finalized preflight explicitly rejects any leaked probe sentinel.

The message-envelope payload is:

```text
messageEnvelopeDomain[4] = "L3C1"
callManifestLength:u32le
callManifest[callManifestLength]
EOF
```

The verifier covenant fixes the message envelope's first-push position and requires its minimally encoded Bitcoin Script
push. The codec already rejects a wrong domain, length, truncation, or suffix. The call manifest excludes
the transaction ID, signatures, and unlocking bytecodes, avoiding a circular commitment.

## Call-manifest grammar

All integers are unsigned little-endian. `bytes` means `length:u16le || payload`. Counts and lengths are
canonical: decoders consume exactly the declared rows and require EOF.

```text
domain[8] = "L3BUS1\0\0"
totalLength:u32le
participantCount:u8                         # 2..8
participant[participantCount] =
  fixedSize:u16 actualSize:u16
  lockingBytecode:bytes
  stateCategory[32]
  maximumSize:u16 trailingUsed:u16
  returnOffset:u16                          # ffff or participant-local fixed-prefix slot
rowCount:u16                                # 0..24
row[rowCount] =
  kind:u8 owner:u8 consumer:u8 slot:u16 mode:u8
  sourceOffset:u16 targetOffset:u16 selector[4] position:u16
  parent:u16 depth:u8 subtreeEnd:u16
  subject:bytes arguments:bytes result:bytes effect:bytes
EOF
```

Row kinds are 0 invocation, 1 resource, 2 event, 3 value transfer, and 4 token effect; kind 5 is reserved and
rejected, and kind 6 is a sidecar. `mode` is the call mode or effect subtype. Source/target offsets are local to the named owner and
consumer and use `ffff` when absent. `selector` is
the function, event, or effect discriminator (zero when none applies); `position` is the completion or
settlement position. The four frames respectively bind identity/caller/topic, arguments, returned bytes, and
the resulting state/event/transfer/sidecar effect. Empty frames are encoded as a zero `u16` length, never
omitted. Participant locking bytecode and the mutually checked typed rows commit the executable policy without
repeating `sha256(lockingBytecode)` in the wire format. A row's owner is the participant whose compiler emission creates it; consumer is the
participant or effect owner that exhausts it; slot is its exact compiler-authored occurrence/resource ordinal.
Unknown row kinds fail closed.

## Authorization

Call-manifest integrity is structural, not conferred by a reusable token. Each artifact-specialized verifier checks
the participant table, identity `(lockingBytecode, stateCategory)`, active state-input position, and every
row its participant owns or consumes. The state input's binding check pins the verifier's code, category, recreation,
attestation, message envelope, and exact ABI arguments. Concrete participant UTXOs are consumed by the transaction. An
application that restricts counterpart selection must publish an explicit state policy or data-signature proof in
the same transaction; no universal signer or preparatory transaction is part of this protocol.

At genesis, a deployment may mint `N` verifier instances. A composition consumes and recreates one instance;
therefore `N` is the contract's maximum number of independently spendable in-flight compositions. Ordinary calls
do not consume verifier instances.

## Bounds

The current semantic-versioned release admits at most eight participants and 24 rows. There is no redundant wire
version byte. Two-, four-, five-, and eight-participant graphs complete under measured BCH-2026 limits; nine is
outside the protocol bound. `ATOMIC_MESSAGE_BUS_CAPACITY`, compiler metadata, composer preflight, and finalized
transaction VM preflight enforce these bounds. Exact measurements are published in
`atomic-message-bus-capacity-bch2026.json`.
