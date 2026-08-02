# Layer 3 controllerless single-transaction bus protocol

Status: wire-format freeze for implementation phases 0 and 1. This document is normative for the
controllerless path. The controller-backed `L3GRAPH1` implementation remains only as a migration baseline.

## Transaction shape

For canonically ordered participant blocks `P0..Pn-1`, inputs and outputs share this slot layout:

```text
P0[0..blockSize0) || P1[0..blockSize1) || ... || Pn-1[0..blockSizen-1) || fee/change
```

`P0.base = 0`; every later base is the preceding base plus block size. Local offset zero is the sole master
slot. Compiler-published slots cover the complete block exactly once. A trailing region, when present, is a
suffix of its owner's block. The fee input is at the end of the participant prefix and is paired with the
change output. There are no controller or projection slots. The application never supplies absolute indices.

## Carrier

The transcript is one argument in the first SCB1 route unlocking bytecode, which belongs to the master at
input zero. No other participant carries a transcript copy. The compiler-generated routes inspect that same
physical unlocking bytecode. The argument payload is:

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
version:u8 = 1
totalLength:u32le
participantCount:u8                         # 2..8
participant[participantCount] =
  base:u16 blockSize:u16
  lockingBytecode:bytes
  masterCategory[32]
  policyHash[32]
  trailingBase:u16 trailingCapacity:u16     # ffff/0 or exact block suffix
rowCount:u16                                # 0..24
row[rowCount] =
  kind:u8 owner:u8 consumer:u8 slot:u16 payload:bytes
EOF
```

Row kinds are 0 invocation, 1 resource, 2 event, 3 value transfer, 4 token effect, 5 return event, and 6
sidecar. Payload grammars are frozen as each semantic family migrates; `policyHash` commits to the compiler's
admitted selectors, modes, schemas, occurrence bounds, and effect bounds. A row's owner is the participant
whose compiler emission creates it; consumer is the participant or effect owner that exhausts it; slot is the
absolute transaction slot or completion position relevant to that row. Unknown row kinds fail closed.

## Authorization

Transcript integrity is structural, not conferred by a reusable token. Each participant verifies the carrier,
participant table, its own identity `(lockingBytecode, masterCategory)`, active master position, policy hash,
and every row it owns or consumes. Concrete participant UTXOs are consumed by the transaction. An application
that restricts counterpart selection must publish an explicit state policy or data-signature proof in the
same transaction; no universal signer or preparatory UTXO is part of this protocol.

## Bounds

Version 1 initially retains the measured baseline admission bounds of eight participants and 24 rows. These
are ceilings, not capacity claims. Phase 5 must lower and enforce them if 2/4/8-participant VM measurements do
not fit BCH-2026 consensus and relay limits.
