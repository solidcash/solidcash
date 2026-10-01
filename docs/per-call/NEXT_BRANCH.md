# `per-call-next`: the isolated implementation branch

Work that changes the hop, the masters or the deployment beyond what the ladder stream holds is built here, off
`feat/per-call`, so it does not interfere with the ladder's ongoing work. It started at `eb3c2f561` (2026-10-01,
user direction) and carries three implementation streams, each developed in its own scratch copy and committed
onto this branch without a checkout:

1. **Heads only at genesis** (the kernel's option A): every sorted collection's head is minted when the contract
   or its proxy is deployed, the hop no longer creates a head inside a call, and the master no longer accepts a
   created head as an insert's predecessor (`createdPredecessorArm`), so every insert splices through a spent
   predecessor.
2. **One participant per node across reaches**: reaches of one transaction that touch one mapping node share one
   participant, its views chained in execution order (the shape of `post job 1`'s duplicate input).
3. **Execution-order planning, a spike**: each call planned after the segment before it settles, so a value an
   earlier call produced is known when the later call is planned, with no stand-ins or passes.

Each stream lands with its focused tests. The branch merges into `feat/per-call` only by decision, once the ladder
stream can take it; until then `feat/per-call` is not touched by it.
