# Layer 3 controllerless single-transaction bus protocol

Status: production wire format. This document is normative for the controllerless path. Measurements from
the removed `L3GRAPH1` implementation survive only in the historical baseline census.

## Transaction shape

For canonically ordered participant blocks `P0..Pn-1`, inputs and outputs share this slot layout:

```text
P0[0..actualSize0) || P1[0..actualSize1) || ... || Pn-1[0..actualSizen-1) || fee/change
```

`P0.base = 0`; every later base is the prefix sum of preceding authenticated `actualSize` values. Local offset
zero is the sole master slot. Each contract commits a fixed prefix and maximum trailing capacity in its locking
bytecode, while each transaction commits `actualSize = fixedSize + trailingUsed`. Only that contiguous used
prefix is physically present; unused trailing capacity is not padded with inputs or outputs. All transcript
rows carry participant-local offsets, and every absolute access is derived as `base(owner/consumer) + offset`
while verifying the transaction. The fee input is paired with change immediately after the actual participant
prefix. There are no controller or projection slots. The application never supplies absolute indices.

## Carrier

The transcript is one canonical push in the first SCB1 route unlocking bytecode, which belongs to the master
at input zero. No other participant carries a transcript copy. The compiler-generated routes inspect that same
physical unlocking bytecode. Its fixed position is immediately after the selector push and SCB1's existing
positional batch push, before ordinary reversed ABI arguments and the redeem script:

```text
push4("SCB1") push(batchBlob) push(carrier) ...ordinary ABI pushes... push(redeemScript)
```

Every SCB1 unlocker reserves this position as `OP_0`. Controllerless composition replaces that placeholder
after transaction-dependent signatures are produced. Generated route bytecode removes both positional values
before executing the handler, so neither the batch copy nor carrier leaks onto the final stack.

The carrier payload is:

```text
carrierDomain[4] = "L3C1"
transcriptLength:u32le
transcript[transcriptLength]
EOF
```

The eventual route ABI fixes the carrier argument's position and requires its minimally encoded Bitcoin
Script push. The codec already rejects a wrong domain, length, truncation, or suffix. The transcript excludes
the transaction ID, signatures, and unlocking bytecodes, avoiding a circular commitment.

## Transcript grammar

All integers are unsigned little-endian. `bytes` means `length:u16le || payload`. Counts and lengths are
canonical: decoders consume exactly the declared rows and require EOF.

```text
domain[8] = "L3BUS1\0\0"
version:u8 = 2
totalLength:u32le
participantCount:u8                         # 2..8
participant[participantCount] =
  fixedSize:u16 actualSize:u16
  lockingBytecode:bytes
  masterCategory[32]
  policyHash[32]
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

Row kinds are 0 invocation, 1 resource, 2 event, 3 value transfer, 4 token effect, 5 return event, and 6
sidecar. `mode` is the call mode or effect subtype. Source/target offsets are local to the named owner and
consumer and use `ffff` when absent. `selector` is
the function, event, or effect discriminator (zero when none applies); `position` is the completion or
settlement position. The four frames respectively bind identity/caller/topic, arguments, returned bytes, and
the resulting state/event/transfer/sidecar effect. Empty frames are encoded as a zero `u16` length, never
omitted. `policyHash` commits to the compiler's admitted selectors, modes, schemas, occurrence bounds, and
effect bounds. A row's owner is the participant whose compiler emission creates it; consumer is the
participant or effect owner that exhausts it; slot is its exact compiler-authored occurrence/resource ordinal.
Unknown row kinds fail closed.

## Authorization

Transcript integrity is structural, not conferred by a reusable token. Each participant verifies the carrier,
participant table, its own identity `(lockingBytecode, masterCategory)`, active master position, policy hash,
and every row it owns or consumes. Concrete participant UTXOs are consumed by the transaction. An application
that restricts counterpart selection must publish an explicit state policy or data-signature proof in the
same transaction; no universal signer or preparatory UTXO is part of this protocol.

## Bounds

Version 2 admits at most five participants and 24 rows. The participant ceiling is the measured BCH-2026
limit: two-, four-, and five-participant graphs complete, while the adjacent six-participant returning chain
exceeds operation-cost density. `SINGLE_TX_BUS_CAPACITY`, compiler metadata, composer preflight, and finalized
transaction VM preflight enforce these bounds. Exact measurements are published in
`layer3-single-tx-capacity-bch2026.json`.
