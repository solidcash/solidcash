# Message-bus coverage matrix

Status: stable acceptance matrix. Dated measurements and development chronology live in
`archive/journal-message-bus/message-bus-benchmark-history.md`; protocol rules live in
`atomic-message-bus-protocol.md`.

| Family | Accepted behavior | Direct evidence |
| --- | --- | --- |
| Codec and layout | Strict framing, EOF, canonical participant order, variable block spans | `AtomicMessageBusCodec`, `AtomicMessageBusGraph` |
| Membership | Exact participant set, active master, verifier identity and preservation | `AtomicMessageBusBalancedAssembly`, `AtomicMessageBusCompose` |
| Calls | Void/returning, fan-in/out, repeated owner, branches, bounded loops | `AtomicMessageBusCompose`, `RepeatedOwnerMessageBus` |
| Context | Authenticated `msg.sender`, `msg.sig`, `msg.data`, `msg.value`, `tx.origin` | `AtomicMessageBusCompose` |
| Journal | Scalars, mappings, fixed/dynamic arrays, repeated writes and tail returns | Compiler and SDK journal suites |
| Effects | Events, return events, BCH, FT, and NFT settlement | `AtomicMessageBusCompose` |
| Sidecars | Blockhash, keccak, and ecrecover exact-slot consumption | `AtomicMessageBusCompose`, `GraphBlockhashAssembly` |
| Call modes | Stateful, static, raw; unsupported delegate shapes fail closed | `AtomicMessageBusCompose`, refusal matrix |
| Capacity | Finalized 2/4/5/8 participant transactions under BCH-2026 limits | `AtomicMessageBusCapacity`, capacity JSON |
| Live policy | Heterogeneous return, transitive chain, repeated token effects, maximum shape | standard-policy regtest harness |

## Security requirements

| ID | Requirement | Proof obligation |
| --- | --- | --- |
| S1 | One callManifest | Every verifier authenticates identical canonical messageEnvelope bytes. |
| S2 | Exact participants | Omission, duplication, substitution, and reordering fail. |
| S3 | Contiguous blocks | Bases are authenticated prefix sums with no gaps, overlap, or padding. |
| S4 | Active membership | Every master proves membership in exactly one block. |
| S5 | Exact row consumption | Every row family is consumed once and EOF is required. |
| S6 | Call authenticity | Caller, mode, selector, arguments, results, order, and occurrence are bound. |
| S7 | State authenticity | Every state/resource transition owns an exact physical slot. |
| S8 | Effect authenticity | Events and value/token effects cannot be forged or redirected. |
| S9 | No replay authority | Participant spends prevent replay; verifier NFTs only attest and self-preserve. |
| S10 | No circular commitment | MessageEnvelope bytes exclude signatures, txid, and complete unlocking bytecodes. |
| S11 | Fail closed | Unsupported semantic shapes receive named, positioned diagnostics. |
| S12 | Capacity | Published compiler and SDK bounds match finalized VM measurements. |

All rows have positive and hostile evidence in the dedicated test directories. The completed requirement-by-
requirement audit and historical controller migration census are retained in
`archive/journal-message-bus/message-bus-implementation-record.md`.
