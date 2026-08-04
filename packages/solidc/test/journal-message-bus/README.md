# Journal and message-bus compiler tests

This directory owns compiler-level coverage for deferred state journaling and atomic message-bus composition:

- scalar and collection journal lowering;
- bounded collection routes and direct broadcast lowering;
- message-bus selector/refusal diagnostics;
- atomic callManifest eligibility and verifier size.

General parser, type-system, and direct-route tests remain one level above. Run this suite with:

```bash
yarn workspace solidc test --run test/journal-message-bus
```
