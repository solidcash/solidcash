# Marketplace shapes

Every transaction the 66 titles send, reduced to its composition shape: which contracts it enters, how
(`CALL`, `STATIC`, `DELEGATE`), how often and in what order, what crosses each call boundary, and which records
and events each frame touches. Each flow shape gets one neutral replica: small contracts with no application
names, the same call structure, driven through the shipped path (compile, deployment, composer, derivation,
validator, machine) and settled with exact post-state, events and balances.

**Required after I1 (`ABBA`) and before I3 (the fixture) and the ladder** (plan 4.4, I2b; user decision
2026-09-27). The ladder then debugs the marketplace's own code, not composition.

Sources: spec section 22 (call-edge catalog), section 23 (edge cases), Appendix A (calls per entry), Appendix B
(test mechanics); `EVAL_REMOVE_BATCH_ENTRYPOINT.md` 2.2 (census); `examples/effectiveacceleration/contracts`;
`marketplace.test.ts`.

Contracts (spec 22): M = MarketplaceV1 proxy, D = MarketplaceDataV1 proxy, T = FakeToken, U = Unicrow,
UC = UnicrowClaim, UD = UnicrowDispute, UA = UnicrowArbitrator. Every user call into M, and every M -> D call, is
a `CALL` to the proxy plus a `DELEGATE` into its implementation. M, D and T are never re-entered.

## 1. Flow shapes (one neutral replica each)

| # | Shape | Marketplace flow (calls: D, T, U, UC, UA, UD, EC) | First needed by |
| --- | --- | --- | --- |
| MS1 | **Proxied single master.** A user enters a contract through its proxy; the implementation reads and writes the proxy's records and emits. No other contract. | admin, register user / arbitrator, MECE tags, unicrow params; the outer hop of every M entry | L2, class (a) |
| MS2 | **Proxied root appending through a proxied store, with token pulls.** The root reads a second proxied contract (`STATIC`: registration checks, one read per tag in a loop, an event count), checks a token's `code.length`, reads `balanceOf`, approves and pulls the token through low-level calls, then calls the store k times, each appending a struct with two `bytes` fields to one array entry and emitting an event above 128 bytes. The callee gates on `msg.sender` being the root's proxy address. The root writes its own record (a struct with a `string[]`). | `publishJobPost` (8: D 5, T 3). By parameter: `updateJobPost` (D 4, T 1, token in or out), `closeJob` / `withdrawCollateral` / `reopenJob` (D 1, T 1), `postThreadMessage` (D 2), `review` (D 3, a `string` argument), `updateJobWhitelist` / `deliverResult` (D 1), `takeJob` with several applicants (D 3, EC 1) | L3 (#18), L4, class (d) |
| MS3 | **Fan-in with a result carried into a later call.** The root approves an escrow on the token, reads a fee from the store (`STATIC`), and passes it to `escrow.pay(struct with a string, fee)` (payable, value 0). The escrow calls a third contract (`setArbitrator`), then writes its escrow record (a write after a call). It reads `balanceOf`, pulls `transferFrom(root -> escrow)` against the allowance the root wrote in this transaction, reads `balanceOf` again, and returns an id the root stores after the call. `ecrecover` over an EIP-191 digest; two events. | `takeJob` single applicant (11: D 5, T 4, U 1, UA 1, EC 1); `payStartJob` (9: D 3, T 4, U 1, UA 1) | L5, fan-in |
| MS4 | **Re-entry with a payout loop.** The root calls `escrow.release`, which is unguarded, writes the escrow and calls `claimer.claim`, which is guarded. `claim` re-enters the escrow: a `STATIC` read of the record just written (a struct with a string), a `STATIC` read of the third contract, a `STATIC` pure call (`uint16[5]` in and out), then `setClaimed`, which is guarded and passes because `release` left the escrow's guard flag at 1. It then calls `sendEscrowShare` once per non-zero share (2, 4 or 5, data-dependent), each calling `token.transfer`, and returns `uint256[5]`. The root then writes the store (rating, a review `string`) and emits two events. | `approveResult` with rating (19: D 5, T 4, U 8, UC 1, UA 1; depth 4) | L6 |
| MS5 | **Origin-gated nested payout.** The root calls `escrow.refund`, which is guarded. The escrow reads the third contract (`STATIC`) and requires `tx.origin`, not `msg.sender`, to be the seller or the arbitrator. It writes the escrow, transfers the token back through a low-level call and emits an event carrying the escrow struct (700+ bytes). The root writes the store and emits two events. | `refund`; `refuseArbitration` on a taken job (6: D 3, T 1, U 1, UA 1) | L5 (#53, #65) |
| MS6 | **Time-gated challenge.** The root calls `dispute.challenge`, which reads the escrow (`STATIC`), requires a block time strictly after the payment's block, and calls `escrow.challenge`. | `dispute` by the creator (4: D 1, U 2, UD 1) | L5 (dispute titles), L7 |
| MS7 | **Deep arbitration.** The root writes the store, then calls `judge.arbitrate(uint16[2])`, which requires `tx.origin` to be the arbitrator. The judge reads the escrow (`STATIC`), calls `escrow.settle(uint16[4], int16[2])`, writes `arbitrated = true`, and calls `claimer.claim`. `claim` re-enters the judge with `STATIC` reads of that flag and a pure calculation, and re-enters the escrow 7 more times (`getEscrow`, `setClaimed`, `sendEscrowShare` x5 -> `token.transfer` x5). The amounts return as `uint256[5]` up two frames, and the root reverts after the call in the sanity titles. | `arbitrate` 80-20 (20: D 2, T 5, U 9, UC 1, UA 3; about 24 masters; depth 4). 0-100: 18 calls; 100-0: 14 | L7 |
| MS8 | **Reads through two proxies, off-chain.** A view on one proxied contract calls views on another (`D.getJobs` -> `M.getJob` x2, `M.jobsLength`), returning structs with `string[]`, including a view that reverts. | 42 `jobs()` call sites, `getEvents` 43, 6 reverting views | L2 onwards |
| MS9 | **Deployment fixture.** Four contracts deployed at CREATE-predicted addresses that reference each other in a circle; two contracts deployed behind proxies in three transactions each (implementation, proxy, `initialize` through the proxy); a setter linking them; a token deployment and 4 transfers or approves. | the fixture: 14 transactions | I3, L1 (all 66) |
| MS10 | **Revert partway.** A root whose check fails after earlier calls (`STATIC` reads, a token approve, store appends) changes nothing and reports the innermost revert: a reason string, or a custom error with arguments re-raised through a low-level call. | `publishJobPost` invalid inputs (#21-23, #26, #27); 25 checks after earlier calls, 7 of them after state changes | L2 onwards |

## 2. Primitives the flows are made of

Each primitive either settles in its own focused test or inside a flow replica. Status re-read at `a8df9de6d` for the rows below that changed; the rest is as of `fbf2776d5`.

| # | Primitive | In | Status |
| --- | --- | --- | --- |
| P1 | Proxy entry: `CALL` to the proxy, `DELEGATE` into the implementation (toy Y4, plan F5) | MS1-MS8 | none; per-call delegate shapes are refused at compile |
| P2 | Proxy-to-proxy call: the callee sees `msg.sender` = the calling proxy's address and gates on it | MS2-MS7 | none |
| P3 | Repeated calls to one callee from one entry, including appends to one record entry (toy Y1) | MS2-MS7 | settles for k = 2 through the shipped composer: the published site is resumed once per turn, the callee's record chains across the turns, and the machine accepts every participant (`edges/repeated-callee.test.ts`). k = 3 turns the caller's own input past its operation-cost budget (800 units per byte of its unlocking bytecode), which is the wire form's limit rather than the derivation's |
| P4 | Calls in data-dependent loops with k > 1, a `STATIC` read per iteration, a revert mid-loop | MS2, MS4, MS7 | settles for k = 1 (`edges/reads-and-loops`) |
| P5 | One call's result as another call's argument (toy Y3) | MS3 | refused today |
| P6 | Fan-in: a second caller's frame reads the record the first caller's frame wrote (toy Y6) | MS3 | compiles; refused by the derivation (V7 / R2) |
| P7 | Re-entry with intermediate state: a `STATIC` read-back of a write made higher up (toy Y2) | MS4, MS7 | none |
| P8 | A storage guard crossed by re-entry (unguarded `release`, guarded `setClaimed`) | MS4, MS7 | chains across a call split (`edges/reentrant-guard`) |
| P9 | A pure external function as a `STATIC` frame | MS4, MS7 | read-only frames settle (`master/read-only-frame`); pure with array arguments untested |
| P10 | A write after an external call | MS3, MS5, MS7 | settles (`edges/writes-after-call`) |
| P11 | `tx.origin` authorizing a nested call | MS5, MS7 | settles one hop down (`edges/nested-authority`) |
| P12 | `msg.sender` peer guards on deployment-derived addresses | MS2-MS7 | settles one hop down (`edges/nested-authority`) |
| P13 | Struct arguments with dynamic members (`string`, `bytes`) | MS2, MS3 | refused by name |
| P14 | Struct returns with a `string` | MS4, MS5, MS7, MS8 | refused by name |
| P15 | Fixed-array arguments (`uint16[2]`, `uint16[4]`, `int16[2]`, `uint16[5]`) and returns (`uint16[5]`, `uint256[5]`) | MS4, MS7 | returns admitted at `362cb13eb`; arguments untested |
| P16 | A payable entry called with value 0 | MS3 | untested |
| P17 | Low-level token calls: `abi.encodeCall` / `encodeWithSelector`, `bool` return, revert re-raise, `code.length`, `address(this).balance`; OpenZeppelin 5.0.2 and 4.9.3 (plan C12) | MS2-MS7 | refused by name |
| P18 | `ecrecover` returning address 0 for invalid input (plan C13) | MS2, MS3 | refused by name |
| P19 | A mapping-of-array append that rewrites the whole array; long struct values in chunks; one version per writing frame (R4, R5) | MS2-MS7 | partial (R5) |
| P20 | Sorted-entry insert, update and delete of one key in one transaction (toy Y5) | MS2 (whitelist) | refused today |
| P21 | Nested mapping `mapping(uint256 => mapping(address => bool))` | MS2 | settles (`7273d613e`) |
| P22 | `string => string` mapping set and delete | MS1 | refused by name |
| P23 | Events above 128 bytes from nested frames | all | settles (`edges/events-across-frames`) |
| P24 | Several events of one contract in one transaction, from several frames | MS2-MS7 | two events settle from one frame |
| P25 | One contract entered up to 9 times; about 24 masters per transaction (pools, E12) | MS4, MS7 | untested at that size |
| P26 | Depth 4 below the root, plus proxy hops | MS4, MS7 | a 4-contract chain settles (`edges/deep-chain`) |
| P27 | The innermost revert reported after state-changing calls (E3) | MS10 | refused by the derivation, not reported |
| P28 | `STATIC` root reads off-chain, including reverting views (E4) | MS8 | none |
| P29 | CREATE-predicted, circular addresses (F3) | MS9 | none |
| P30 | `deployProxy` in three transactions, `initialize` through the proxy (F5, F6) | MS9 | none |

## 3. Test mechanics the titles also need (not shapes)

Strictly later block times and day jumps (E7), snapshots and reloads (E9), reverts from unfunded senders (E8),
events decoded as ethers logs (E5), a live listener (E10), un-awaited sends (E6). They change no transaction, so
they are due at I3 and the ladder, not at I2b.

## 4. Rules

- One accept case per flow replica, plus only a refusal specific to the flow's distinguishing edge. A generic
  refusal stays in the file that already makes it (`MANIFEST.md`).
- No per-shape rule (the I2 GO criteria apply to every replica).
- The catalog is closed. A title that fails later on a shape it lacks gets a neutral reproducer here, settled
  before the fix.
