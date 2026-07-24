# Layer-3 spike - regtest / real-node validation (task 5)

The spikes run on `MockNetworkProvider`, whose `sendRawTransaction` is the real BCH-2026 consensus VM
(`createVirtualMachineBch2026`). What the mock does NOT exercise is a real node's MEMPOOL POLICY
(standardness): the transcript covenants produce large P2SH32 unlocking scripts and MULTIPLE OP_RETURN
outputs, which are consensus-legal but flagged by the audit handoff (section 5) as possibly non-standard.
This validates them against a real BCHN node.

## Environment

`docker-compose.regtest.yml`: BCHN v29.0.0 (regtest, default policy incl. `acceptnonstdtxn=1`) + Fulcrum
+ miner. The SDK reaches it via `RegtestNetworkProvider`; `createTestProvider()` returns it when
`TESTS_USE_REGTEST=true`, and `setupStatefulUtxos` / `createFeeFunder` fund genesis + fees on the real node.

## Results (all on the running regtest BCHN node)

1. MULTIPLE OP_RETURN outputs are accepted. A two-`data`-output transaction, funded and signed by the
   node wallet, returns `testmempoolaccept -> "allowed": true`. So the node's mempool policy accepts more
   than one OP_RETURN (the transcript's msg.sender + result records). Reproduce:
   `packages/solidcash/test/regtest/multi-opreturn-check.sh`.

2. A real LARGE transcript transaction broadcasts and is accepted. `Layer3InvocationSpike` POSITIVE
   (M3 msg.sender: a ~3-4 KB SCB1 unlocking per participant + an OP_RETURN record, two branded stateful
   participants) run with `TESTS_USE_REGTEST=true` builds and broadcasts through the real node -
   `sendRawTransaction` resolves (the node accepted it into the mempool). ~9 s.

3. The LARGEST transcript transaction is accepted. `Layer3CompactBindingSpike` POSITIVE binds N=2, 4, and
   8 participants; the N=8 transaction is ~26 KB with eight large unlockings. Run with
   `TESTS_USE_REGTEST=true` all three broadcast and are accepted by the real node. ~28 s.

Reproduce 2 and 3:

```
cd packages/solidcash
TESTS_USE_REGTEST=true yarn vitest run test/e2e/Layer3InvocationSpike.test.ts -t POSITIVE \
  --no-file-parallelism --testTimeout=180000
TESTS_USE_REGTEST=true yarn vitest run test/e2e/Layer3CompactBindingSpike.test.ts -t POSITIVE \
  --no-file-parallelism --testTimeout=240000
```

## Scope note

Spikes that RE-MINT a master with a custom commitment via `provider.addUtxo` (M4/M5/transcript/Kashi/
oracle) rely on mock-only genesis semantics and do not run as-is on regtest (a real node needs the minting
NFT to mint that category). That is a test-fixture limitation, not a covenant issue: the two policy
concerns the audit raised - multiple OP_RETURN outputs and large unlocking/transaction size - are both
confirmed accepted by the real node via (1) directly and (2)/(3) end to end. Running the re-minting spikes
on regtest would require a proper mint transaction for the custom-commitment master, which is SDK funding
plumbing, not a soundness question.
