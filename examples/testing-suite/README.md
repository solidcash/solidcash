# SolidCash Testing Suite

This is an example project to demonstrate how to write and compile SolidCash contracts and test them using the SolidCash SDK and Vitest.

## Writing a SolidCash contract

We have included two simple example contracts in the `contracts/` directory that can be used as a starting point to write your own contracts. The contracts demonstrate logs, require statements and transaction signatures.

## Compiling the contracts

We have included a task to compile the contracts in the `tasks/` directory called `compile.ts`. This task will compile all the contracts in the `contracts/` directory and save the artifacts in the `artifacts/` directory. This includes both the JSON and TypeScript artifacts. It is recommended to use the TypeScript artifacts for proper type-safety.

You can run the task with `yarn compile`.

## Running the tests

We have included test files in the `test/` directory, which test the expected functionality of the contracts. For key management, we have included a utility file in the `utils/` directory which exports testing keys for Alice and Bob.

You can run the tests with `yarn test`.

## Hardhat + ethers parity harness

This suite doubles as a **drop-in replacement for a Hardhat + ethers + chai testing workflow**, so contracts
ported from Solidity/Hardhat keep their test style. See `HARDHAT-PARITY.md` for the full roadmap/checklist.
See `MIGRATION.md` for the supported API mapping and permanent BCH differences.

- **Config**: `solidcash.config.ts` (`defineConfig`) - paths, networks, mnemonic. Loaded by the `solidcash` CLI.

Existing Hardhat projects can keep a single `hardhat.config.ts` by attaching an explicit SolidCash section:

```ts
import { defineConfig } from 'hardhat/config';
import { solidcash, withSolidCash } from '@solidcash/testing/hardhat';

export default withSolidCash(defineConfig({
  solidity: '0.8.24',
}), solidcash({
  compiler: { solidityImportCompat: true, ecrecover: 'p2pkh' },
  paths: { contracts: './contracts', artifacts: './artifacts' },
}));
```

Only unambiguous Hardhat fields such as source, test, artifact, and HD-account paths are inherited. Solidity
compiler settings and EVM networks are not translated. Run `solidcash init --from-hardhat` to generate a
standalone `solidcash.config.ts` instead; the Hardhat config is never modified.
- **CLI**: `npx solidcash <task>` - built-in `compile` / `test` / `run <script>` / `clean` / `node`, plus your
  own `task(...)` definitions. `hre.run(name, args)` invokes tasks programmatically.
- **Signers**: `const [owner, alice] = await ethers.getSigners()` (from `'@solidcash/testing'` or aliased
  `'hardhat'`) - pre-funded HD accounts from the hardhat `test test ... junk` mnemonic.
- **Contracts**: `ethers.getContractFactory(artifact, signer).deploy(...)`, `ethers.getContractAt(...)`,
  `.waitForDeployment()`, `upgrades.deployProxy(...)`.
- **Fixtures**: `loadFixture(namedFixture)` snapshots the chain and restores it between tests.
- **Time travel**: `time.increase(sec)` / `time.increaseTo(ts)` / `mine(n)` / `mineUpTo(h)`. These drive Solidity
  `block.timestamp` / `block.number` (via the `mockBlockOracleRpc` + `BlockOracleUpdater` bridge) - see
  `test/block-timestamp.test.ts`.
- **Matchers**: `import { expect } from '@solidcash/testing/chai'` (or aliased `'chai'`) for
  `.to.be.revertedWith(...)`, `.to.emit(c, e).withArgs(...)`, `.to.equal(...)` (BigInt), `.changeBchBalance(...)`,
  `.changeTokenBalance(...)`, `.closeTo(...)`, `.rejectedWith(...)`, etc.
- **ethers utils**: `import { parseEther, keccak256, AbiCoder, getBigNumber } from '@solidcash/testing/ethers'` (forwarded
  to ethers v6, plus v5-compat `BigNumber`/`ethers.utils`/`ethers.constants`).

Demo tests: `test/golden-path.test.ts`, `test/harness.test.ts`, `test/ported-style.test.ts` (bare
`hardhat`/`chai` imports via Vitest aliases in `vitest.config.ts`), and `test/block-timestamp.test.ts`.

## Next steps

Once you're getting comfortable writing, compiling and testing SolidCash contracts, you can copy the `testing-suite` directory into your own project to use as a starting point. From there you can start writing more complex contracts and integrate them into full applications.

We recommend checking out the [SolidCash SDK documentation](https://solidcash.org/docs/sdk/) for more information on how to use the SolidCash SDK, and the specific section on the [testing setup](https://solidcash.org/docs/sdk/testing-setup) for more information on how to test your contracts.
