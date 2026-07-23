# Skipped-test follow-up

Revisit the unconditional skips below. They remain outside the July 2026 C2
mapping/test repair because each covers a separate unsupported or incomplete
path:

- `debugging.test.ts`: invalid P2PKH unlocker diagnostics.
- `TransactionBuilder.test.ts`: invalid P2PKH-only and mixed-input rejection.
- `e2e/EvmStorageFoundation.test.ts`: address-slot representation parity.
- `e2e/CircularCalls.test.ts`: atomic circular and self-referential calls.
- `e2e/MsgSenderCrossContractC2.test.ts`: cross-contract `msg.sender` C2 keys.
- `e2e/CrossContractCallInfra.test.ts`: unbounded-bytes return events.

Environment-gated network/library tests are intentionally excluded from this
list. When revisiting, remove the corresponding `.skip`/`describe.skip`, retain
the negative assertions, and run both the focused file and the full `yarn test`
suite.
