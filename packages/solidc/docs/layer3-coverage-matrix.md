# Message-bus coverage matrix

Status: stable acceptance matrix. Dated measurements and development chronology live in
`archive/journal-message-bus/layer3-benchmark-history.md`; protocol rules live in
`layer3-single-transaction-bus-protocol.md`.

| Family | Accepted behavior | Direct evidence |
| --- | --- | --- |
| Codec and layout | Strict framing, EOF, canonical participant order, variable block spans | `Layer3SingleTxCodec`, `Layer3SingleTxGraph` |
| Membership | Exact participant set, active master, verifier identity and preservation | `Layer3SingleTxBalancedAssembly`, `Layer3SingleTxCompose` |
| Calls | Void/returning, fan-in/out, repeated owner, branches, bounded loops | `Layer3SingleTxCompose`, `RepeatedOwnerMessageBus` |
| Context | Authenticated `msg.sender`, `msg.sig`, `msg.data`, `msg.value`, `tx.origin` | `Layer3SingleTxCompose` |
| Journal | Scalars, mappings, fixed/dynamic arrays, repeated writes and tail returns | Compiler and SDK journal suites |
| Effects | Events, return events, BCH, FT, and NFT settlement | `Layer3SingleTxCompose` |
| Sidecars | Blockhash, keccak, and ecrecover exact-slot consumption | `Layer3SingleTxCompose`, `GraphBlockhashAssembly` |
| Call modes | Stateful, static, raw; unsupported delegate shapes fail closed | `Layer3SingleTxCompose`, refusal matrix |
| Capacity | Finalized 2/4/5/8 participant transactions under BCH-2026 limits | `Layer3SingleTxCapacity`, capacity JSON |
| Live policy | Heterogeneous return, transitive chain, repeated token effects, maximum shape | standard-policy regtest harness |

## Security requirements

| ID | Requirement | Proof obligation |
| --- | --- | --- |
| S1 | One transcript | Every verifier authenticates identical canonical carrier bytes. |
| S2 | Exact participants | Omission, duplication, substitution, and reordering fail. |
| S3 | Contiguous blocks | Bases are authenticated prefix sums with no gaps, overlap, or padding. |
| S4 | Active membership | Every master proves membership in exactly one block. |
| S5 | Exact row consumption | Every row family is consumed once and EOF is required. |
| S6 | Call authenticity | Caller, mode, selector, arguments, results, order, and occurrence are bound. |
| S7 | State authenticity | Every state/resource transition owns an exact physical slot. |
| S8 | Effect authenticity | Events and value/token effects cannot be forged or redirected. |
| S9 | No replay authority | Participant spends prevent replay; verifier NFTs only attest and self-preserve. |
| S10 | No circular commitment | Carrier bytes exclude signatures, txid, and complete unlocking bytecodes. |
| S11 | Fail closed | Unsupported semantic shapes receive named, positioned diagnostics. |
| S12 | Capacity | Published compiler and SDK bounds match finalized VM measurements. |

All rows have positive and hostile evidence in the dedicated test directories. The completed requirement-by-
requirement audit and historical controller migration census are retained in
`archive/journal-message-bus/layer3-implementation-record.md`.
