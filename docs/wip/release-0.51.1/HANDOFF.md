> Historical workstream note. The message bus and its kernel were removed from the compiler and SDK in
> 2026-11; any instruction to compile with `messageBus` or to use the bus describes the tree as it stood then.

# Handoff: SolidCash 0.51.1 (2026-11-17)

A patch release of 0.51.0 for one SDK fix: creating a contract through a deployer coin from an external wallet.

## Where things are

- **SolidCash 0.51.1 is out.** Branch `release/0.51.1`, forked from `v0.51.0` (`eda85a88d`), ends at `a61d95d89`,
  which is tagged `v0.51.1`. The branch and the tag are on `origin`, and npm serves all six packages at 0.51.1 as
  `latest` (checked 2026-11-22). The worktree `.worktrees/release-0.51.1` is removed; the branch remains.
- The commits on top of `v0.51.0`:
  - `fix(solidcash): create through a deployer with an external wallet`: the fix and its test.
  - `chore(release): version 0.51.1`: all six packages, their internal ranges (`^0.51.1`), the compiler's version
    and the copies tests pin. `scripts/bump.py` here made it. Pragmas keep `^0.51.0`, which 0.51.1 satisfies.
  - `docs(release): ...`: `CHANGELOG.md` and `website/docs/releases/release-notes.md`.
  - `docs(wip): ...`: this file and `scripts/`.
- `master` merged `release/0.51.1` in `7287ee028` (2026-11-22), on top of the post-0.51.0 work, so it holds the fix.
  Only `CHANGELOG.md` conflicted: master's Unreleased section stays above 0.51.1.

## The fix

SolidPool found it: creating a pool from Cashonize failed with "DeployerPrepError: The creation does not pass the VM,
so nothing was broadcast: … error in evaluating input index 3: Program failed an OP_VERIFY operation". A creation
through deployers (A14) failed at three points for a wallet the SDK holds no key for:

1. `buildDeployerPreps` (`stateful/deployer.ts`) signed each prep with `builder.build()`. That leaves an external
   wallet's placeholder in its inputs, and the child's category was taken from that unsigned txid. Now the wallet signs
   each prep there (`applyExternalSignatures`) before its txid is read.
2. The creation's VM check before broadcast (`stateful/sc-deploy-from.ts`, A14 item 4 steps 9 and 10) verified the
   whole transaction, placeholder included. Input 3 is the author coin, whose OP_EQUALVERIFY libauth reports as
   OP_VERIFY. Now the wallet signs the creation there, before any prep is broadcast, so a wallet that declines leaves
   nothing on chain. The VM then judges the signed transaction, and the builder's inputs carry those signatures into
   `builder.send()`, which asks the wallet nothing more. The message-bus preflight instead skips wallet inputs; this
   path signs first, so it can verify whole.
3. A creating call given its preps still picked a vout-0 genesis coin from the signer (`_deployFromSigner`), which it
   never spent, and fanned one out when there was none. Now `deployFrom`'s check asks for prep funding only when no
   preps are given, and `_deployFromSigner` skips the pick when they are.

## Verification

- `packages/solidcash/test/DeployerExternalSigner.test.ts`, the fix's own test, passed 3 of 3, run once as the
  repository's agent test discipline asks. It creates a child through its deployer from a wallet that holds one coin:
  the wallet is asked twice (prep, then creation), the child takes the signed prep's txid, and a wallet that declines
  the creation or the prep leaves its coin unspent. Its lines were wrapped for `max-len` after that run. A mechanical
  comparison showed only whitespace and trailing commas changed, so it was not run again.
- SolidPool, `bch-next` master `bf78a24` linked to this build, on the mock, through the app's own
  `createThroughFactory` with a wc2-style wallet stub. A 10 BCH pool was created with one vout-0 coin and with two;
  each time the wallet was asked twice. The same probe on npm's 0.51.0, with vitest caches cleared between runs:
  - one coin: "Signer has no genesis-valid funding UTXO … fanning one out failed";
  - two coins: the reported "creation does not pass the VM … input index 3".
- After the bump:
  - solidc's `test/generation`, `test/compiler` and `test/CashScript014Port.test.ts`: 673 of 673, as for 0.51.0. The
    generation fixtures pin bytecode, and the bump changed only their version field, so bytecode is unchanged.
  - solidcash's files that pin the version or read the re-versioned fixtures: 24 of 24. These are
    `ContractFactoryFunding`, `KernelLargeInitializerState`, `SolidityAbiReturnFraming`,
    `X50DefaultProxyRegenerated` and `DelegateInputIndexCoordinates`.
- All six packages typecheck. eslint is clean on the changed files.

## Not run yet (the lander's)

- **The deployer path's neighbours, as a named-file run:**
  - `test/unit/DeployerCoins.test.ts`
  - `test/e2e/DeployerGenesisPins.e2e.test.ts`
  - `test/e2e/UnspendableDeployRefusal.e2e.test.ts`
  - `test/DirectExternalSigner.test.ts`
  - `test/framed/call/external-signer.test.ts`
  - the e2e files that read the re-versioned fixtures: `MasterChefPoolInfoPush`, `MasterChefDeposit`,
    `DeployThenCallFold.e2e`, `X50DefaultProxyRegenerated` (already run), `DelegateVerifiedMappingWrite`,
    `DelegateCollectionOutputPin` and `journal-message-bus/e2e/MessageBusDelegateClassesE3`.
- **Whole suites** (solidcash's took 86 minutes for 0.51.0), which need the user's approval each time
  (`../release-0.51.0/scripts/full-run.sh`).

## Releasing

1. Run the checks above.
2. Tag `v0.51.1` at the branch head.
3. Publish the six packages with `scripts/publish-one.sh 0.51.1 <package> [otp]`, copied unchanged from
   `post-0.51.0`'s `33b8ebe45`. Do it in dependency order: utils, solidc, solidcash, testing, solidhat,
   create-solidhat. The script publishes from the checkout at `v<version>`, `/Code/cashscript` by default. Another
   party works there, so point `SOLIDCASH_CHECKOUT` at this worktree once it is clean at the tag. Its header has the
   security-key sign-in steps that 0.51.0 needed.

Publishing only `@solidcash/solidcash` would be lighter, as the only package whose code changed. Revert the other five
`package.json` versions and the compiler's version first. One `0.51.1` for all six keeps the line in step, and that is
what this branch holds.

## After the release

- **Master:** done by the merge `7287ee028`, not a cherry-pick. `StatefulContract.ts` merged on its own, and master
  had not changed `deployer.ts` or `sc-deploy-from.ts` since 0.51.0.
- **SolidPool:**
  - move `@solidcash/*` to 0.51.1;
  - rebuild its artifacts, since their compiler version changes;
  - add a test that creates a pool from an external wallet. Its mock probe is in this handoff's verification.
