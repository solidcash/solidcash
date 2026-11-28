# SolidCash examples
This folder contains a number of example SolidCash contracts to show off its functionality and usage. The `.scash` files contain example contracts, and the `.ts`/`.js` files contain example usage of the SolidCash SDK with these contracts.

The "Hello World" of cash contracts is defining the P2PKH pattern inside a cash contract, which can be found under [`p2pkh.scash`](/examples/p2pkh.scash). Its usage can be found under [`p2pkh.ts`](/examples/p2pkh.ts).

## Running the examples
To run the examples, clone this repository and navigate to the `examples/` directory. Since the examples depend on the SDK, be sure to run `yarn` inside the `examples/` directory, which installs all required packages.

```bash
git clone git@github.com:SolidCash/solidcash.git
cd solidcash/examples
yarn
```

All `.ts` files can then be executed with `tsx`.

```bash
npm install -g tsx
tsx p2pkh.ts
```

All `.js` files can be executed with `node`.

```bash
node p2pkh.js
```

## Payment as owner activity

<!-- cspell:ignore Pusaka -->

[`ActivityVault`](activity_vault.scash) renews its inactivity deadline when the owner signs a payment from the vault.
The same transaction pays the recipient and clears any pending recovery. The owner can also check in separately.
Fund it with `deposit().withValue(amount)` so the vault records the deposit without extending the deadline.
A payment with an older locktime preserves the current deadline. Deposits pause during review so the review
anchor keeps aging.

For a payment, check-in, or opening a recovery, use `setLocktime((await provider.getMedianTimePast()) - 1)`.
The deadline uses timestamp locktime. After inactivity, opening a recovery starts a fresh block-based review on the
replacement master output. After it matures, any caller can use `setSequence(reviewBlocks)` to release the balance
to the beneficiary set at deployment. The example comes from the [Pusaka inheritance wallet](https://github.com/astrorehan/pusaka-bch).

The [mock-network tests](testing-suite/test/activity-vault.test.ts) exercise the payment, deposit and recovery paths.
After installing and building the workspaces, run the test command from the repository root.

```bash
yarn workspace testing-suite test activity-vault.test.ts
```
