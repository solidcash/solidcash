# message bus BCH-2026 semantic test profile

Profile name: `message-bus-bch2026-semantic-relaxed-v1`

Evidence label: `SEMANTIC`

VM target: `BCH_2026_05`

Implementation: `packages/solidcash/test/journal-message-bus/e2e/message-bus-semantic-profile.ts`

This test-only profile allows message-bus semantic capstones to execute before bytecode and transaction-size
optimization. It uses the BCH-2026 instruction set and BCH-2026 introspection behavior. Only capacity and mock relay
policy are changed.

| Limit | Ordinary BCH-2026 | Semantic profile | Reason |
|---|---:|---:|---|
| Maximum input/redeem bytecode | 10,000 bytes | 1,000,000 bytes | Do not block handler/parser composition on outlining work |
| Maximum stack item | 10,000 bytes | 1,000,000 bytes | A P2SH redeem script is itself a stack item |
| Maximum consensus transaction size | 1,000,000 bytes | 10,000,000 bytes | Admit large balanced capstones |
| Maximum standard transaction size | 100,000 bytes | not asserted | The mock profile is not standard-policy evidence |
| NFT commitment | 128 bytes | 128 bytes | Preserve the BCH-2026 state representation |
| Operation-cost budget per density byte | 800 | 10,000,000 | Defer bytecode-density optimization |
| Hash-iteration allowance per density byte | 3.5 nonstandard / 0.5 standard | 10,000,000 | Defer hash-density optimization |
| Dust relay policy | enforced by standard policy | disabled | Permit semantic-only fixture funding shapes |

The profile does **not** alter:

- opcode definitions or evaluation order;
- transaction and output introspection semantics;
- token category, capability, amount or commitment behavior;
- signature and hashing algorithms;
- stack-machine control-flow behavior;
- the 128-byte NFT commitment bound.

## Required usage

Semantic-only capstones import `createMessageBusSemanticTestProvider()` from the test helper. Test names and evidence
reports must say `SEMANTIC`. A passing result may prove handler execution, callManifest authentication, state
transition or adversarial rejection. It may not prove:

- ordinary BCH-2026 consensus fit;
- BCHN standard-policy acceptance;
- relay or mining acceptance;
- production bytecode, operation-density or transaction-size headroom.

Every capstone that uses this profile must eventually have an ordinary-limit measurement in task F1. If the
ordinary configuration fails while the semantic profile passes, the result is recorded as a production-fitting
problem rather than a semantic failure.
