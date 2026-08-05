# Hardhat, ethers, and chai migration

This table covers the supported first-release testing workflow. Run ported tests with Vitest and
`@solidcash/testing`; keep EVM-only concepts explicit rather than silently approximating them.

| Hardhat / ethers / chai | SolidCash replacement | Migration note |
|---|---|---|
| `hardhat.config.ts` | `solidcash.config.ts` with `defineConfig` | `solidcash init --from-hardhat` generates a separate config; it does not modify the Hardhat file. |
| `npx hardhat compile/test/run/clean` | `npx solidcash compile/test/run/clean` | Tasks and `hre.run(name, args)` retain the familiar workflow. |
| `import { ethers } from "hardhat"` | `import { ethers } from "@solidcash/testing"` | A Vitest alias may preserve the original import unchanged. |
| `ethers.getSigners()` | `ethers.getSigners()` | Returns funded BCH HD signers; signatures use `new SignatureTemplate(signer.privateKey)`. |
| `ethers.getContractFactory(name, signer)` | Same call through `@solidcash/testing` | Resolves compiled `.scash` artifacts by contract name. |
| `factory.deploy(...)` | `factory.deploy(...)` | For stateful contracts, pass `{ initialState }`; await `waitForDeployment()`. |
| `ethers.deployContract(...)` | `ethers.deployContract(...)` | Supported factory shorthand. |
| `ethers.getContractAt(...)` / `.attach(...)` | Same calls | Stateful identity is a token category or contract address, depending on the artifact. |
| `upgrades.deployProxy(...)` | `upgrades.deployProxy(...)` | Uses the SolidCash proxy/delegate artifact profile. |
| `loadFixture(namedFixture)` | `loadFixture(namedFixture)` | Mock networks restore snapshots. Live-node tests instead use fresh deployments and run serially. |
| `time.increase`, `time.increaseTo`, `mine` | Same helpers from `@solidcash/testing` | Advances the mock chain and the block-oracle bridge used by contract time/height expressions. |
| `expect(tx).to.be.revertedWith(reason)` | Same chai shape | Matches a named `require` reason or regular expression. |
| `expect(tx).to.emit(c, event).withArgs(...)` | Same chai shape | Decodes SolidCash event commitments; positional and predicate arguments are supported. |
| `revertedWithCustomError(...).withArgs(...)` | Named failure assertion only | Failed BCH execution has no EVM revert-data payload. Runtime custom-error argument recovery is deferred. |
| `changeEtherBalance(s)` | `changeBchBalance(s)` | Values are satoshis, not wei. |
| `changeTokenBalance(s)` for ERC-20 | `changeTokenBalance(s)` for CashToken FTs | Pass the CashToken category and account(s). |
| `parseEther`, `AbiCoder`, `keccak256`, `BigNumber` | `@solidcash/testing/ethers` | Ethers v6 utilities are forwarded; selected v5 shims are included. |
| `provider.send("evm_snapshot"/"evm_mine"/...)` | Same calls on the mock provider | The common snapshot, mining, time, and block-number methods are translated. |
| `msg.sender`, `msg.value`, contract storage | SolidCash UTXO semantics | Sender is locking bytecode, value is net satoshi-container change, and state is held in token commitments. |
| `setBalance` | Fund a signer/address with UTXOs | Funding is additive; reset the mock network when exact initial state is required. |
| `setStorageAt`, `setCode`, `setNonce` | Contract state helpers or fixture redeployment | BCH has no globally mutable account storage, code, or nonce. |
| Account impersonation | Supply a signer/key explicitly | BCH authorization is key/UTXO based; there is no account impersonation equivalent. |
| Gas estimates and gas reporters | `TransactionBuilder.getVmResourceUsage()` | BCH uses transaction size and VM resource limits rather than EVM gas. |
| `signTypedData`, ENS, EVM transaction methods | No first-release equivalent | These APIs reject with a descriptive unsupported-operation error where exposed. |

The maintained executable example is
[`test/golden-path.test.ts`](test/golden-path.test.ts). It covers compilation, funded signers, stateful deployment,
calls, event and named-failure assertions, state reads, fixture restoration, and rerunning the successful path.
`yarn test:package-smoke` repeats that lifecycle in an isolated project installed only from release tarballs.

