# Journal and message-bus SDK tests

This directory owns SDK, VM, hostile-input, capacity, and live-composition coverage for the state journal and
controllerless message bus.

- Root tests cover codecs, graph planning, balanced verifier assembly, and blockhash layout.
- `unit/` covers admission and diagnostic boundaries.
- `e2e/` covers journal settlement, participant composition, corpus/capacity evidence, and probe tooling.
- `fixtures/` contains contracts specific to this subsystem.

Run the complete dedicated suite with:

```bash
yarn workspace solidcash test --run test/journal-message-bus
```
