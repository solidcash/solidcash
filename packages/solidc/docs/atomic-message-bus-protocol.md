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
while verifying the transaction. In V1–V4, `Vi` is participant `Pi`'s artifact-specialized, self-preserved verifier NFT.
The opt-in V5 direct-participant profile instead packs verifier NFTs only for routed participants; a marked direct
participant has no verifier NFT or filler slot and executes its ordinary covenant in its state block.
The fee input is paired with change immediately after the verifier region. There are no controller or projection
slots. The SDK derives all absolute indices; application code supplies none.

## Message envelope

The verifier-input transport below remains the default for deployed V1–V4 artifacts.

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
lock, category, index, and commitment. The compact state-input binder also requires its master NFT commitment to
be preserved exactly; masters may therefore acquire commitment state later without opening an unauthenticated
output field. Signatures and complete unlocking bytecodes are excluded, so there is no
transaction-signature circularity.

Each verifier also receives an inert density-reserve push. The SDK sizes this reserve after encoding that
verifier's actual program arguments and message envelope, bringing its unlocking bytecode to a 9,000-byte floor.
Larger arguments displace reserve bytes rather than accumulating a fixed 2,048-byte pad. Finalized VM and byte
preflight remain authoritative if a verifier needs more computation or the transaction approaches relay size.

An opt-in root-route transport (`messageBusRootEnvelope: true`) carries one canonical envelope in the direct
root's input-0 SCB1 unlocking frame, immediately after the five-byte selector push and before the batch and
reserve pushes. Every V5 verifier reads that exact `PUSHDATA2` carrier, proves its `L3C1` domain and declared
manifest length, and returns only its binding digest (plus a lifecycle suffix where applicable). V5 verifier
unlockings omit their own envelope pushes; their covenants no longer perform the redundant local-envelope hash
comparison. The manifest codec, participant/verifier/fee slot layout, and verifier NFT commitment format stay
unchanged. The different verifier program produces a different covenant address, so existing verifier NFTs are
not silently migrated. Composer and preflight require all participants to advertise the same transport; V5
verifiers also reject legacy envelope pushes in every verifier slot, preventing a co-spent legacy participant
from authenticating a private manifest. This transport is for direct-root atomic compositions; standalone
input-0 SCB1 routes do not gain an atomic carrier by enabling it.

An independent opt-in proxy-root transport (`messageBusProxyForwardEnvelope: true`) uses the existing baked
`__forward(bytes)` proxy without changing its bytecode. Input 0 forwards `SCB1 || PUSHDATA2(L3C1 envelope)`;
the root implementation input starts with the identical bytes after its selector push. The proxy covenant checks
the complete forwarded prefix, and every V5 verifier independently parses the canonical input-0 frame and
compares it with that executor prefix. The root verifier also requires the delegate index to lie inside its
authenticated participant block. Only these two root inputs carry the envelope; verifier unlockings omit it.
The SDK rejects mixed transports and malformed proxy/executor pairs. This mode is opt-in, cannot be combined
with `messageBusRootEnvelope`, and likewise changes the verifier covenant address; existing NFTs are not
silently migrated.

`messageBusDirectParticipant: true` enables a separate `L3BUS5\0\0` call-manifest profile for a mixed
routed/direct composition. Each participant record appends `authority:u8` after the V4 lifecycle suffix:
`0` means routed and `1` means direct. V5 retains V4's optional transaction-signature frame on routed rows;
the direct row requires an empty frame. This profile requires a routed root plus at least one direct
participant. The verifier region contains one NFT per routed
participant in participant order, with no synthetic authority for a direct participant. A direct participant
may consume one void, leaf invocation with one scalar argument in a fixed state block; it owns no manifest
child or effect rows. The routed verifier binds the source-evaluated runtime target to the actual direct input,
its category and balanced block geometry, and the exact selector and visible argument in that input's
unlocking script. A hidden low-level-call index is bound out of range, so an unrepresented nested call fails
closed if its branch executes. The direct input's own consensus-executed covenant validates its state
transition. This does **not** pin a contract-typed dynamic address to one compiled implementation. Direct
methods that depend on `msg.sender` or read `msg.data` are outside this first-slice profile until caller-slot
and hidden-calldata semantics are certified. Other unsupported direct shapes are refused, and V1–V4 artifacts
remain byte-for-byte unchanged when the option is omitted.

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
push. The codec and finalized-transaction preflight explicitly reject an envelope shorter than 256 bytes or a canonical
verifier input that does not begin with `OP_PUSHDATA2`; they also reject a wrong domain, length, truncation, or suffix. The call manifest excludes
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

Semantic result/effect derivation is a bounded fixed-point calculation. Its bound is derived from every mutable
result, event, resource, value, token, and sidecar claim, with one final confirmation pass; repeated complete
claim states fail immediately as cycles. It is deliberately not derived from invocation count alone, because
resource-heavy six-to-eight-participant graphs can require more passes than a call-only graph of the same depth.
