---
title: Release Notes
---

## v0.14.0-beta.1

SolidCash 0.14.0-beta.1 adds a Solidity-syntax language and workflow layer for Bitcoin Cash contracts. The release covers
the documented Solidity subset, not unrestricted Solidity, EVM, Hardhat or ethers parity. It also ports the
CashScript 0.14.0 changes listed below. This release contains several breaking changes, please refer to the
[migration notes](/docs/releases/migration-notes#v012-to-v014) for more information.

Supported in this release:

- Solidity-style integer types with checked and `unchecked` arithmetic, structs, fixed and dynamic arrays, mappings,
  inheritance, modifiers, events, declared errors, ABI helpers and the documented lowerable Yul subset.
- Stateful contracts backed by CashToken NFT commitments: entry-backed mappings, chunked arrays, events, and SDK
  builders for deploy, upgrade, destroy, split and merge.
- The built-in proxy profile for scalar and data-NFT state, deployed with `upgrades.deployProxy`.
- A Hardhat-style project workflow through `@solidcash/testing` and SolidHat: configuration, CLI tasks, the runtime
  environment, funded signers, factories, fixtures, time and block helpers, and a maintained subset of chai
  assertions. Create a project with `npm create @solidcash/solidhat`.
- BCMR metadata for deployed contracts: every genesis leads with the category's identity output and can publish a
  registry (`solidcash/bcmr`). See [CashToken metadata](/docs/guides/deployment#cashtoken-metadata).
- Six packages released together at 0.14.0-beta.1, ESM only, for Node.js 22 or newer: `solidc`, `solidcash`,
  `@solidcash/utils`, `@solidcash/testing`, `@solidcash/solidhat` and `@solidcash/create-solidhat`.

Experimental in this release, outside the stable compatibility promise. Construction stops with a named diagnostic
when a required transaction shape cannot be produced.

- Composed external state mutation: calls that change another contract's state.
- Custom delegate forwarding beyond the built-in proxy profile, and `upgrades.upgradeProxy`.
- Message-bus kernel composition, including `messageBus.compose` and `sc.batch([...])`.
- The [framed calling convention](/docs/guides/framed-composition) (`composition: 'framed'`).
- Solidity source shapes outside the compatibility manifest, even when the parser accepts them.

#### solidc compiler
- :sparkles: Allow custom `SolidCashErrorListener` to be passed to the compiler.
- :bug: Fix missing location data in tuple assignment errors.
- :sparkles: Default message-bus routes use the kernel row loop (`OP_DEFINE` handlers, one wrapper). Unsupported
  handlers fail closed with `KERNEL_*`. This is an experimental profile; see the [message bus guide](/docs/guides/message-bus).
- :sparkles: Kernel message-bus routes admit batches up to the BCH-2026 stack-item ceiling (10,000 bytes, 255 rows)
  instead of the legacy 520-byte envelope; legacy unrolled routes keep the smaller ceiling.
- :sparkles: Message-bus artifacts publish an admission stamp (`admittedHandlerIds`/`refusedHandlerIds`/
  `admissionSource`), per-axis `resourceBudgets`, a `deployability` certificate for the 10,000-byte P2SH limit, and
  a `capabilitySchema` that gives every optional field an explicit status.
- :sparkles: New `addressForm: 'hash' | 'bytecode'` option decides the form an `address` **value** takes where the
  compiler turns it into bytes: `'hash'` is the 20-byte Solidity identity (the embedded payload of a standard
  P2PKH/P2SH20 lock, or `HASH160` of the lock), `'bytecode'` is the whole locking bytecode. It governs
  `abi.encodePacked(<address>)` and a decoded address leaf; omitting it follows the mode (`'hash'` under
  `evmCompat`, `'bytecode'` otherwise), so existing builds are unchanged. The narrowing casts are deliberately not
  part of it - `uint160(a)` and `bytes20(a)` truncate and `address(x)` stays a no-op in either form - and a
  fixed-width ABI word (`abi.encode(<address>)`, a word lane, a word-encoded result) still carries the identity,
  because a 32-byte word cannot hold a variable-length lock. An `address` *argument* on the
  [framed wire](/docs/guides/framed-composition) is not a word: it rides as its whole locking bytecode, and the
  option decides the packing a body does with it. A packed payload that carries locks is longer (23/25/35 bytes per
  address), which matters at the 128-byte NFT commitment limit and for offset arithmetic over the payload. An
  explicitly chosen form is published on the artifact (`compiler.options.addressForm`), so the SDK reproduces the
  body's own packing when it derives a call.
- :sparkles: Under `evmCompat`, a selector is derived from Solidity's **canonical** signature spelling: `uint256`
  for `uint`, `int256` for `int`, `uint8` for an enum, the underlying type for a user-defined value type, a
  parenthesized tuple for a struct, and `address` for a contract type or `address payable`. Entry dispatch, the
  artifact ABI selectors, `type(I).interfaceId`, `fn.selector` / `error.selector` / `E.selector`, `msg.sig`,
  `abi.encodeCall` and the argument matching of `abi.encodeWithSignature` now derive from that one spelling, so each
  matches solc. Native compiles keep the platform spelling with address payability erased.
- :sparkles: Under `evmCompat`, `abi.encodeWithSignature` accepts a signature built at runtime. A non-literal
  signature lowers to `abi.encodeWithSelector(bytes4(keccak256(bytes(sig))), ...)`, so the keccak256 computation
  side-car supplies the digest; a literal signature still folds to its selector at compile time.
- :sparkles: Under `evmCompat`, an event argument of statically known scalar width is written in **standard EVM
  notation** - exactly the bytes `abi.encodePacked` produces at the type's natural width (a number as big-endian
  two's-complement, `bool` one byte, `bytesN` its N bytes, an enum its one-byte ordinal) with no length byte or
  padding - and the artifact marks that parameter `notation: 'evm'`. A variable-width byte value, an `address`, a
  struct, an array, a UDVT and a function pointer keep the platform pushdata frame. Native compiles are unchanged.
- :hammer_and_wrench: `compileString()`, `compileStringMulti()` and `compileStringSplit()` take `files`, an
  in-memory map of import sources, as shorthand for `importResolver: createMapResolver(files)`.
- :hammer_and_wrench: A version pragma that fails in an imported file names that file in the `VersionError`.
- :bug: Fix bug where date literals were parsed in the local time zone instead of UTC.
- :bug: Fix bug where a `LockingBytecodeNullData` chunk of more than 255 bytes, sized at runtime, was pushed with a
  truncated length instead of failing the script.
- :sparkles: Add a `warningListener` compile option that receives each compiler warning instead of the default
  print; `suppressWarnings` still discards them.

#### SolidCash SDK
- :sparkles: In the `MockNetworkProvider`, `addUtxo()` now returns the added UTXO.
- :sparkles: `solidcash/stateful` exports `artifactAddressForm()`, so a consumer can assert which address form an
  artifact was compiled with, including the mode-derived default. A decoded address is presented by that form, and
  the SDK's own derivation of a call's arguments packs an `address` the same way the compiled body does: under
  `'bytecode'` a bare address argument is packed whole, so the caller's digest and the record's agree.
- :sparkles: The event decoders (`parseEventCommitment` / `tryParseEventCommitment`) and the event builders
  dispatch per argument on the artifact's `notation` field, so a parameter the compiler marked `notation: 'evm'`
  reads back as the standard EVM notation and an unmarked one on the platform frame.
- :sparkles: Add `calculateTransactionFee()` to `TransactionBuilder`.
- :sparkles: A require that fails inside a nested function call reports the call stack that led to it.
- :hammer_and_wrench: `SignatureTemplate` exposes `sighashType`, `signatureAlgorithm` and `publicKey` properties, and
  `HashType` is renamed to `SighashType`. The old names remain as deprecated aliases. **BREAKING**:
  `generateSignature()` no longer takes `bchForkId`, since BCH consensus always requires the fork id flag.
- :hammer_and_wrench: Typed errors for an empty transaction and for fee limits (`TransactionInputsRequiredError`,
  `TransactionOutputsRequiredError`, `TransactionFeeTooHighError`, `TransactionFeePerByteTooHighError`), and an NFT
  commitment longer than the provider allows is refused when the output is added.
- :hammer_and_wrench: A UTXO that states its `lockingBytecode` is checked against the lock its unlocker spends, and a
  mismatch is refused with `UnlockerLockingBytecodeMismatchError`.
- :hammer_and_wrench: `ElectrumNetworkProvider` uses Electrum protocol 1.5.0 and no longer subscribes to headers in
  `getBlockHeight()`.
- :bug: **BREAKING**: Fix bug where invalid hex string arguments were silently encoded to different bytes, and where
  `pubkey` arguments were not checked to be 33 or 65 bytes.
- :bug: **BREAKING**: Fix bug where `setLocktime()` accepted values that are not an unsigned 32-bit integer.
- :bug: Fix bug where `getTransactionSize()` undersized inputs that use `placeholderP2PKHUnlocker()`.
- :bug: Fix bug where `send()` threw a `FailedTransactionError` when the transaction was broadcast but could not be
  retrieved afterwards.
- :bug: Fix bug where debugging reported a VM resource limit as a failed require statement.
- :bug: Fix bug where a failing final `require(variable)` was reported at the wrong statement in debugging.
- :bug: Fix bug where the `MockNetworkProvider` could not spend a UTXO added with an uppercase txid.
- :hammer_and_wrench: `MockNetworkProvider` accepts a resubmitted transaction it already holds and returns its txid,
  as a node does; a different transaction spending the same inputs still fails.
- :hammer_and_wrench: `ElectrumNetworkProvider` uses `@electrum-cash/network` 4.4 and keeps its connection when a
  browser tab is hidden.

## v0.13.0

This release contains several breaking changes, please refer to the [migration notes](/docs/releases/migration-notes) for more information.

#### solidc compiler
- :sparkles: Add support for `do {} while ()` loops.
- :sparkles: Add support for bitwise and arithmetic shift operators (`<<`, `>>`) and bitwise inversion (`~`).
- :sparkles: Add `unsafe_bool()` and `unsafe_int()` casting for semantic-only casts.
- :bug: **BREAKING**: Fix issue where `bool()` casting did not change the value of the argument.
- :boom: **BREAKING**: Rename `bytes4(int)` and `bytes(int, 4)` to `toPaddedBytes(int, 4)`.
- :boom: **BREAKING**: Rename `bytes4(bytes)` to `unsafe_bytes4(bytes)`.
- :racehorse: Add optimisations for negated number comparisons.

#### SolidCash SDK

- :sparkles: Add support for `do {} while ()` loops in debug tooling.
- :hammer_and_wrench: Update default VM target to `BCH_2026_05`.
- :hammer_and_wrench: Improve package size by tidying up dependencies.

#### Testing Suite

- :hammer_and_wrench: Add README.md to help guide users on how to use the testing suite.
- :hammer_and_wrench: Compile all contracts in the `contracts/` directory and save the artifacts in the `artifacts/` directory.
- :hammer_and_wrench: Compile TS artifacts as well as JSON artifacts.
- :hammer_and_wrench: Add key management utilities for testing.

---

https://x.com/SolidCashBCH/status/2059199869261095106

## v0.12.2

#### solidc compiler
- :sparkles: Backport from v0.13.1: allow custom `SolidCashErrorListener` to be passed to the compiler.
- :bug: Backport from v0.13.1: fix missing location data in tuple assignment errors.

## v0.12.1

#### SolidCash SDK
- :sparkles: Add Vitest extensions for automated testing.

## v0.12.0

This release contains several breaking changes, please refer to the [migration notes](/docs/releases/migration-notes) for more information.

#### SolidCash SDK
- :sparkles: Add `getVmResourceUsage` method to `TransactionBuilder`.
- :sparkles: Add `maximumFeeSatsPerByte` and `allowImplicitFungibleTokenBurn` options to `TransactionBuilder` constructor.
- :sparkles: Add a configurable `vmTarget` option to `MockNetworkProvider`.
- :sparkles: Add support for ECDSA signatures in contract unlockers for `sig` and `datasig` parameters.
- :sparkles: Add `signMessageHash()` method to `SignatureTemplate` to allow for signing of non-transaction messages.
- :boom: **BREAKING**: Remove deprecated "old" transaction builder (`contract.functions`).
- :boom: **BREAKING**: Make `provider` a required option in `Contract` constructor.
- :boom: **BREAKING**: Set `updateUtxoSet` to `true` by default for `MockNetworkProvider`.
- :boom: **BREAKING**: No longer seed the MockNetworkProvider with any test UTXOs.
- :boom: **BREAKING**: Replace `setMaxFee()` method on `TransactionBuilder` with `maximumFeeSatoshis` option.
- :boom: **BREAKING**: Rename `bitauthUri()` method on `TransactionBuilder` to `getBitauthUri()` for consistency.
- :hammer_and_wrench: Improve libauth template generation.
- :bug: Fix bug where `SignatureTemplate` would not accept private key hex strings as a signer.

---

https://x.com/SolidCashBCH/status/1973692336782876974

## v0.11.5

#### SolidCash SDK
- :sparkles: Include input index in console.log statements for debugging.
- :sparkles: Improve type inference for function and constructor arguments in the `Contract` class.
- :hammer_and_wrench: Replace redundant dependencies.
- :bug: Remove accidental dependency inclusion of `@types/node`.

## v0.11.4

#### SolidCash SDK
- :sparkles: Add `updateUtxoSet` option to `MockNetworkProvider` to allow for updating the UTXO set after a transaction is sent.
- :bug: Fix bug where sending P2PKH-only transactions would throw `No placeholder scenario ID or script ID found`.

## v0.11.3

#### solidc compiler
- :sparkles: Add `.slice(start, end)` operator for bytes and strings.
- :sparkles: Add bounded bytes typing and bounds checking for `.split()` (includes checking for negative indices).
- :racehorse: Add optimisation for `.slice(0, x)` and `.slice(x, y.length)` (also applies to `.split(0)[1]`).
- :bug: Disallow incorrect bounded bytes typing when using `.split()`.

#### SolidCash SDK
- :bug: Fix bug where `ElectrumNetworkProvider` would disconnect in browser on visibility change of the page.

## v0.11.2

#### SolidCash SDK
- :bug: Fix bug with new `generateWcTransactionObject()` throwing when using `placeholderP2PKHUnlocker()`.

## v0.11.1

#### SolidCash SDK
- :sparkles: Add `generateWcTransactionObject()` method to `TransactionBuilder` to generate a `WcTransactionObject` that can be used to sign a transaction with a WalletConnect client.
- :sparkles: Add `placeholderSignature()`, `placeholderPublicKey()` and `placeholderP2PKHUnlocker()` helper functions to the SDK for WalletConnect usage.

---

https://x.com/SolidCashBCH/status/1942513305420968238

## v0.11.0

This update adds SolidCash support for the new BCH 2025 network upgrade. To read more about the upgrade, see [this blog post](https://blog.bitjson.com/2025-chips/).

This release also contains several breaking changes, please refer to the [migration notes](/docs/releases/migration-notes) for more information.

Thanks [kiok](https://x.com/cypherpunk_bch) for the significant contributions!

#### solidc compiler
- :bug: Fix bug where source code in `--format ts` artifacts used incorrect quotation marks.
- :hammer_and_wrench: Remove warning for opcount and update warning for byte size to match new limits.
- :boom: **BREAKING**: `tx.age` was renamed to `this.age` to better reflect that it enforces a UTXO-level locktime check (*not* transaction-level).
- :boom: **BREAKING**: The entire `debug` object on the artifact is reworked to enable debugging the optimised contract bytecode.

#### SolidCash SDK
- :sparkles: Add debugging capabilities to the `TransactionBuilder`.
  - `transaction.debug()` & `transaction.bitauthUri()`
  - Output BitAuth IDE URI for debugging when transaction is rejected.
  - Libauth template generation and debugging for multi-contract transactions
- :sparkles: Debugging now supports using the optimised contract bytecode (when compiled with `solidc@0.11.0` or later).
- :sparkles: Add `setBlockHeight()` method to `MockNetworkProvider`
- :sparkles: Config-free usage of the SolidCash SDK with Vite or Webpack
- :hammer_and_wrench: Update debug tooling to use the new `BCH_2025_05` instruction set.
- :hammer_and_wrench: Deprecate the simple transaction builder. You can still use the simple transaction builder with the current SDK, but this support will be removed in a future release
- :boom: **BREAKING**: the Jest utilities for automated testing are now synchronous and no longer work with the deprecated simple transaction builder
  * `expect(transaction).toLog(message)`
  * `expect(transaction).toFailRequire()`
  * `expect(transaction).toFailRequireWith(message)`
- :boom: **BREAKING**: Remove support for custom Clusters from `ElectrumNetworkProvider` and added a configuration object to the constructor.
- :boom: **BREAKING**: Remove support for old contracts compiled with SolidCash v0.6.x or earlier.
- :bug: Fix bug where `JestExtensions` `expect().toLog()` would detect logs from different tests.
- :bug: Fix bug where certain edge cases in require statements caused the `FailedRequireError` message to be slightly different from the original error message.

---

https://x.com/SolidCashBCH/status/1935662184865890325

#### @solidcash/utils
- :boom: **BREAKING**: Remove `importArtifact` and `exportArtifact` helper functions. If you want to import or export artifacts, use `'fs'` to read and write files directly.

## v0.10.5

#### solidc compiler
- :bug: Fix bug in new TypeScript typings for artifact.

## v0.10.4

#### solidc compiler
- :bug: Fix bug in new `--format ts` option.

## v0.10.3

#### solidc compiler
- :sparkles: Add `--format ts` option to `solidc` CLI to generate TypeScript typings for the artifact.

#### SolidCash SDK
- :sparkles: Add automatic TypeScript typings for `Contract` class when artifact is generated using the `solidc` CLI with the `--format ts` option.

## v0.10.2

#### solidc compiler
- :sparkles: Add support for using underscores in numeric literals to improve readability, e.g. `1_000_000`.
- :sparkles: Add support for using scientific notation in numeric literals, e.g. `1e6` or `1E6`.

#### SolidCash SDK
- :bug: Fix fee calculation when using `SignatureAlgorithm.ECDSA`.
- :hammer_and_wrench: Clean up dependencies.

## v0.10.1

#### SolidCash SDK
- :bug: Fix bug with `MockNetworkProvider` returning the wrong `Network` type (now returns `Network.MOCKNET` / `"mocknet"`).
- :bug: Fix bug in debug tooling where incorrect placeholder keys were used when evaluating transactions with P2PKH inputs.

## v0.10.0

In this version we added proper debugging support for transactions and integration with the BitAuth IDE.

Thanks [mainnet_pat](https://x.com/mainnet_pat) for the initiative and significant contributions!

#### solidc compiler
- :sparkles: Add `console.log()` statements for debugging.
- :sparkles: Extend `require()` statements to allow custom error messages for debugging.
- :hammer_and_wrench: Update artifact format to allow for new debugging features.
- :hammer_and_wrench: Update dependencies to new major versions.

#### SolidCash SDK
- :sparkles: Add support for transaction evaluation and debugging using libauth templates.
  - `transaction.debug()` & `transaction.bitauthUri()`
  - Output BitAuth IDE URI for debugging when transaction is rejected.
- :sparkles: Add `MockNetworkProvider` to simulate network interaction for debugging and testing.
  - Add `randomUtxo()`, `randomToken()` and `randomNft()` functions to generate dummy UTXOs for testing.
- :sparkles: Add SolidCash Jest utilities for automated testing.
  * `await expect(transaction).toLog(message)`
  * `await expect(transaction).toFailRequire()`
  * `await expect(transaction).toFailRequireWith(message)`
- :bug: Fix bug with type exports.
- :hammer_and_wrench: Update visibility of several classes.
  - Make `artifact`, `networkProvider`, `addressType` and `encodedConstructorArgs` public on `Contract` class.
  - Make `contract`, `abiFunction`, `encodedFunctionArgs`, `inputs` and `outputs` public on `Transaction` class.
  - Make `networkProvider`, `inputs` and `outputs` public on `TransactionBuilder` class.
  - Make `privateKey` public on `SignatureTemplate` class and add `getSignatureAlgorithm()` method.
- :hammer_and_wrench: Improve some error messages.
- :hammer_and_wrench: Add new `FailedRequireError`, `FailedTransactionEvaluationError` and `FailedTransactionError` classes.
- :boom: **BREAKING**: Remove exported transaction error `Reason` enum + `FailedTimeCheckError` and `FailedSigCheckError` classes in favour of the new error classes.
- :boom: **BREAKING**: Remove all deprecated references to `meep` including `meep` strings from errors and `transaction.meep()`.
- :boom: **BREAKING**: Separate the `Argument` type into `FunctionArgument` and `ConstructorArgument` and rename `encodeArgument` to `encodeFunctionArgument`.

---

https://x.com/SolidCashBCH/status/1833454128426615174

## v0.9.3

#### solidc compiler
- :hammer_and_wrench: Migrate from antlr4ts to ANTLR's official TypeScript target to remove circular dependency issues.

## v0.9.2

#### SolidCash SDK

- :bug: Fix bug where UTXOs would be needlessly retrieved from the network during `build()` calls.
- :bug: Fix off-by-one fee calculation error with transactions that have many outputs.
- :bug: Fix bug where no error was thrown when invalid NFT commitment or token category were provided.
- :hammer_and_wrench: Export all interfaces from SolidCash's `interfaces.ts`.
- :hammer_and_wrench: Merge duplicate code between Transaction.ts and TransactionBuilder.ts.

## v0.9.1

#### SolidCash SDK
- :bug: Fix TransactionBuilder export bug.

## v0.9.0

#### SolidCash SDK
- :sparkles: Add new `TransactionBuilder` class that allows combining UTXOs from multiple different smart contracts and P2PKH UTXOs in a single transaction.
- :hammer_and_wrench: Deprecate all `meep` functionality. Meep has been unmaintained for years and does not support many new SolidCash features. Meep functionality will be removed in a future release.

---

https://x.com/SolidCashBCH/status/1713928572677583023

## v0.8.2

#### SolidCash SDK
- :bug: Fix bug with Vite build.
- :sparkles: Expose `ElectrumNetworkProvider#performRequest` to allow raw Electrum requests if needed.

## v0.8.1

#### SolidCash SDK
- :bug: Fix bug where a different property order of NFT inputs/outputs would cause errors.

## v0.8.0

:warning: From v0.8.0 onwards, SolidCash is a [Pure ESM package](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c). This means that you can no longer use `require()` to import `solidcash` or `solidc`.

This release also contains several breaking changes, please refer to the [migration notes](/docs/releases/migration-notes) for more information.

#### solidc compiler
- :sparkles: Add support for the new CashTokens introspection functionality (`tokenCategory`, `nftCommitment` and `tokenAmount` for both in- and outputs).
- :sparkles: Add `LockingBytecodeP2SH32` to generate the new P2SH32 standard locking script.
- :bug: Fix optimisation bug that caused `OP_0NOTEQUAL` to be applied to non-integer values.
- :boom: **BREAKING**: Move to Pure ESM.
- :boom: **BREAKING**: Rename `LockingBytecodeP2SH` to `LockingBytecodeP2SH20` - but it is recommended to change over to the new P2SH32 for security reasons.

#### SolidCash SDK
- :sparkles: Add support for CashTokens.
  - `.to()` now takes a `token` parameter that can be used to send CashTokens.
  - UTXOs that are retrieved with `contract.getUtxos()` include a `token` field if they are token UTXOs.
  - UTXOs that are passed into `.from()` can also include this `token` field to send tokens.
  - Add `.withoutTokenChange()` to disable automatic token change outputs.
  - Note that only the `ElectrumNetworkProvider` supports CashTokens at this time.
  - Note that NFTs do not support automatic UTXO selection
- :sparkles: Add `contract.tokenAddress` to get the token-enabled address of a contract.
- :sparkles: Add `fromP2PKH()` to add P2PKH inputs to a smart contract transaction.
  - Note: this was in the SDK before as `experimentalFromP2PKH()`. It has now been released as an official feature.
- :boom: **BREAKING**: Move to Pure ESM.
- :boom: **BREAKING**: Remove `"testnet"` & `"staging"` network options.
- :boom: **BREAKING**: `contract.address` returns `p2sh32` address by default, this can be configured to be `p2sh20` on contract initialization.
- :boom: **BREAKING**: Move the configuration of the network provider to an options object on contract initialization.
- :boom: **BREAKING**: Use `bigint` rather than `number` for all instances of "script numbers" (e.g. function arguments) and satoshi amounts.
- :boom: **BREAKING**: Replace `contract.getRedeemScriptHex()` with `contract.bytecode`.
- :boom: **BREAKING**: Remove `BitboxNetworkProvider`.
- :boom: **BREAKING**: All signature templates use  `SIGHASH_ALL | SIGHASH_UTXOS` now, this new default can be overwritten in the constructor of the `SignatureTemplate`.

---

https://x.com/SolidCashBCH/status/1662092546372255744

## v0.7.5

#### SolidCash SDK
- :bug: Fix a bug with chipnet connection

## v0.7.4

#### solidc compiler
- :hammer_and_wrench: Internal refactoring

#### SolidCash SDK
- :bug: Fix a bug with ESM exports

## v0.7.3
#### SolidCash SDK
- :sparkles: Add `"chipnet"` network option to ElectrumNetworkProvider, used to connect to the May 2023 testnet.
* :hammer_and_wrench: Renamed network options `"testnet"` & `"staging"` to `"testnet3"` and `"testnet4"` respectively. Old options will be removed in a future release.

## v0.7.2
#### solidc compiler
* :bug: Fix bug where contracts using `checkMultiSig()` were unspendable.

#### SolidCash SDK
* :sparkles: Add `signatureAlgorithm` parameter to `SignatureTemplate` to allow ECDSA signatures.

## v0.7.1
#### @solidcash/utils
* :bug: Fix bug where 64bit integers could not be decoded.

## v0.7.0
#### solidc compiler
- :sparkles: Add destructuring assignments, e.g. `bytes2 left, bytes1 right = 0x123456.split(2)`
- :sparkles: Add constant keyword, e.g. `int constant x = 10;`
- :sparkles: Add multiplication, e.g. `int x = 5 * 5`
- :sparkles: Add *native* introspection/covenants
- :boom: **BREAKING**: Remove all old introspection/covenant functionality (`tx.version`, `tx.hashPrevouts`, `tx.hashSequence`, `tx.outpoint`, `tx.bytecode`, `tx.value`, `tx.sequence`, `tx.hashOutputs`, `tx.locktime`, `tx.hashtype`, `OutputP2PKH`, `OutputP2SH`, `OutputNullData`)
  - See the [migration notes](/docs/releases/migration-notes#v06-to-v07) for details on migrating from the old introspection to the new *native* introspection methods.
- :boom: **BREAKING**: Remove `sig` to `datasig` casting since this was only useful for *old* covenants
- :bug: Fix ESM build

#### SolidCash SDK
- :sparkles: Add `"staging"` network option to ElectrumNetworkProvider, used to connect to the May 2022 testnet
- :hammer_and_wrench: Deprecate old introspection/covenant functionality. You can still use pre-0.7 contracts with the new SDK, but this support will be removed in a future release.
- :boom: **BREAKING**: arguments of type `datasig` must be 64 bytes in length, effectively enforcing Schnorr
- :bug: Fix ESM build
- :bug: Small fixes

---
https://x.com/RoscoKalis/status/1529072055756414976

## v0.6.5
#### solidc compiler
* :bug: Fix `solidc` version

## v0.6.4
#### solidc compiler
* :sparkles: Add `byte` type alias for `bytes1`

## v0.6.3
* :hammer_and_wrench: Use ES2015 for the "module" output for better compatibility

## v0.6.2
#### SolidCash SDK
* :bug: Fix typing issue with BitcoinRpcNetworkProvider

## v0.6.1
#### SolidCash SDK
* :bug: Fix bug with incorrect fee calculation when providing custom fee per byte

## v0.6.0
#### solidc compiler
* :sparkles: Add date literal (gets converted to int timestamp)
* :hammer_and_wrench: Update ParseError messages
* :bug: The final statement in a contract now MUST be a require statement (in all branches)
* :bug: Empty contracts and functions are now considered invalid
* :bug: Fix bug where certain covenants could become unspendable due to incorrect bytesize calculation
  * :boom: **BREAKING**: Covenants using `tx.bytecode` now include a placeholder `OP_NOP` that gets replaced when constructor arguments are provided in the SolidCash SDK. If you're not using the SolidCash SDK, refer to the [`replaceBytecodeNop()` function](https://github.com/CashScript/cashscript/blob/v0.6.0/packages/utils/src/script.ts#L130) to see the steps required to do so manually.
* :boom: **BREAKING**: Remove `--args` parameter from the CLI, since this is too error prone with the recent changes in mind
* :boom: **BREAKING**: Restructure exports

#### SolidCash SDK
* :sparkles: Add BitcoinRpcNetworkProvider that connects to a BCH node RPC
* :boom: **BREAKING**: Remove dependency on `solidc` and remove `SolidCompiler` export

---
https://x.com/RoscoKalis/status/1371896417443282956

## v0.5.7
#### solidc compiler
- :bug: Better error reporting for parsing/lexing errors

## v0.5.6
#### solidc compiler
- :bug: Make compiler fail early when encountering lexing/parsing errors, rather than performing error recovery
- :bug: Allow empty hex literals (i.e. `0x`)

## v0.5.5
#### SolidCash SDK
- :sparkles: Add `'regtest'` as a possible network for NetworkProviders.

## v0.5.4
- :package: Add dual build system (CommonJS and ES Modules) to accommodate tree-shaking.

## v0.5.3
#### SolidCash SDK
- :sparkles: Add `getRedeemScriptHex()` function to the `Contract` class.
- :bug: Fix a bug where transaction locktime could not specifically be set to 0.
- :bug: Fix a bug where signature buffers were not checked for size.

## v0.5.2
#### solidc compiler
- :bug: Fix a bug where an incorrect error message was displayed in Firefox when an incompatible pragma version was used.

## v0.5.1
#### SolidCash SDK
- :sparkles: The `.send()` function now returns a `TransactionDetails` object. This extends the libauth `Transaction` with added `txid` and `hex` fields.
  - Because it extends the previous return type, this is backwards compatible.
  - Since this now returns the transaction hex as a field, using `.send(true)` to return the transaction hex is deprecated and will be removed in a future release.
- :bug: Improve reliability of the `ElectrumNetworkProvider` when sending multiple concurrent requests.

---
https://x.com/RoscoKalis/status/1301521593399685121

## v0.5.0
#### SolidCash SDK
SolidCash used to be very tightly coupled with BITBOX. This proved to be problematic after maintenance for BITBOX was stopped. The main objective of this update is to allow SolidCash to be used with many different BCH libraries.

- :sparkles: Add `withoutChange()` function to disable change outputs for a transaction.
- :sparkles: `SignatureTemplate` can now be used with BITBOX keypairs, `bitcore-lib-cash` private keys, WIF strings, and raw private key buffers, rather than *only* BITBOX.
- :boom: Remove `Sig` alias for `SignatureTemplate` that was deprecated in v0.4.1.
- :boom: **BREAKING**: Refactor contract instantiation flow
  - A contract is now instantiated by providing a compiled artifact, constructor arguments and an optional network provider.
  - Anyone can implement the NetworkProvider interface to create a custom provider. The SolidCash SDK offers three providers out of the box: one based on electrum-cash (default), one based on FullStack.cash' infrastructure, and one based on BITBOX. See the [NetworkProvider docs](/docs/sdk/network-provider) for details.
  - See the [migration notes](/docs/releases/migration-notes#v04-to-v05) for details on migrating from the old contract instantiation flow.
- :boom: **BREAKING**: Remove the artifacts `'networks'` field and `.deployed()` functionality, This proved to be confusing and is better suited to be handled outside of the SolidCash SDK.
- :boom: **BREAKING**: `.send()` now returns a libauth Transaction instead of a BITBOX Transaction object. Alternatively a `raw` flag can be passed into the function to return a raw hex string.
- :hammer_and_wrench: Removed BITBOX as a dependency in favour of libauth for utility functions.

---
https://x.com/RoscoKalis/status/1298645699559596033

## v0.4.4
#### solidc compiler
- :bug: Fix a bug where covenants would not always get verified correctly when the first `require(checkSig(...))` statement was inside a branch.

## v0.4.3
#### solidc compiler
- :racehorse: Add compiler optimisations.

## v0.4.2
- Re-add README files to NPM that were accidentally removed in the v0.4.0 release.

## v0.4.1
#### solidc compiler
- :racehorse: Add optimisations to bitwise operators.
- :shell: New CLI arguments.
  - Add `--opcount|-c` flag that displays the number of opcodes in the compiled bytecode.
  - Add `--size|-s` flag that displays the size in bytes of the compiled bytecode.
- :symbols: Add trailing comma support.

#### SolidCash SDK
- :name_badge: Rename `Sig` to `SignatureTemplate` to better convey its meaning.
  - `Sig` still exists for backward compatibility, but is deprecated and will be removed in a later release.

---
https://x.com/RoscoKalis/status/1267440143624884227

## v0.4.0
#### solidc compiler
- :sparkles: Add `.reverse()` member function to `bytes` and `string` types.
- :sparkles: Add bitwise operators `&`, `^`, `|`.
- :sparkles: Allow casting `int` to variable size `bytes` based on `size` parameter.
- :boom: **BREAKING**: Casting from `int` to unbounded `bytes` type now does not perform `OP_NUM2BIN`. Instead it is a purely semantic cast to signal that an integer value should be treated as a bytes value.
- :horse_racing: Compiler optimisations.
  - Use `NUMEQUALVERIFY` for the final function in a contract.
  - Only drop the final `VERIFY` if the remaining stack size is less than 5.
  - Pre-calculate `OutputNullData` argument size.
- :bug: Fix a bug where return type of `sha1` was incorrectly marked as `bytes32`.
- :bug: `Data.decodeBool` only treated numerical zero as false, now any zero-representation is considered false (e.g. 0x0000, -0, ...).

#### SolidCash SDK
- :sparkles: Add ability to provide hardcoded inputs to the transaction rather than use SolidCash's coin selection.
- :boom: **BREAKING**: Refactor the transaction flow to a fluent API
  - Remove the `TxOptions` argument and other arguments to the Transaction `send()` function.
  - Instead these parameters are passed in through fluent functions `from()`, `to()`, `withOpReturn()`, `withAge()`, `withTime()`, `withHardcodedFee()`, `withFeePerByte()` and `withMinChange()`.
  - After specifying at least one output with either `to()` or `withOpReturn()`the transaction is ready. From here the transaction can be sent to the network with the `send()` function, the transaction hex can be returned with the `build()` function, or the meep debugging command can be returned with the `meep()` function.
- :boom: Remove `Contract.fromCashFile()` and `Contract.fromArtifact()` which were deprecated in favour of `Contract.compile()` and `Contract.import()` in v0.2.2.

#### Migration
This update contains several breaking changes. See the [migration notes](/docs/releases/migration-notes#v03-to-v04) for a full migration guide.

---
https://x.com/RoscoKalis/status/1264921879346917376

## v0.3.3
#### solidc compiler
- :bug: Fix bug where variables could not reliably be used inside `OutputNullData` instantiation.

---
https://x.com/RoscoKalis/status/1224389493769342979

## v0.3.2
#### solidc compiler
- :sparkles: Add `OutputNullData(bytes[] chunks)`, an output type to enforce `OP_RETURN` outputs.
- :shell: CLI improvements
  - The `--output|-o` flag is now optional, if it is omitted or manually set to `-`, the artifact will be written to stdout rather than a file.
  - Add `--asm|-A` flag that outputs only Script in ASM format instead of a full JSON artifact.
  - Add `--hex|-h` flag that outputs only Script in hex format instead of a full JSON artifact.
  - Add `--args|-a` flag that allows you to specify constructor arguments that are added to the generated bytecode.
    - :warning: The CLI **does not** perform type checking on these arguments, so it is recommended to use the SolidCash SDK for type safety.
- :bug: Fix a compilation bug that allowed compilation of "unverified covenants" (#56).
- :bug: Fix a compilation bug that allowed compilation of `OutputP2PKH(...)` without `new` keyword (#57).

#### SolidCash SDK
- :globe_with_meridians: Browser support! You can now use SolidCash inside web projects. Filesystem-based functionality such as compilation from file are not supported due to the nature of web, so SolidCash files have to be read in a different way (e.g. Fetch API) and then passed into the SolidCash SDK.
- :purse: Add `minChange` to transaction options. If this `minChange` is not reached, the change will be added to the transaction fee instead.

---
https://x.com/RoscoKalis/status/1223280232343515136

## v0.3.1
#### solidc compiler
* :warning: Add warnings when a contract exceeds 201 opcodes or 520 bytes.
* :bug: Fix a bug where an incorrect number of items were dropped from the stack after execution of a branch.

#### SolidCash SDK
* :sparkles: Improve error handling.
  * Further specified `FailedTransactionError` into `FailedRequireError`, `FailedSigCheckError`, `FailedTimeCheckError` and a general fallback `FailedTransactionError`.
  * Add `Reason` enum with all possible reasons for a Script failure - can be used to catch specific errors.
* :mag: Add `instance.opcount` and `instance.bytesize` fields to all contract instances.
* :bug: Fix a bug where the size of a preimage was not accounted for in fee calculation for covenants.

---
https://x.com/RoscoKalis/status/1217101473743544320

## v0.3.0
#### solidc compiler
* :sparkles: Covenants abstraction! All individual preimage fields can be accessed without manual decoding, passing, and verification.
  * Available fields: `tx.version`, `tx.hashPrevouts`, `tx.hashSequence`, `tx.outpoint`, `tx.bytecode`, `tx.value`, `tx.sequence`, `tx.hashOutputs`, `tx.locktime`, `tx.hashtype`.
  * When any of these fields is used inside a function, this function is marked `covenant: true`, and requires a preimage as parameter (automatically passed by SolidCash SDK).
  * The correct fields are efficiently cut out of the preimage and made available.
  * The first occurrence of `require(checkSig(sig, pubkey));` is identified, and preimage verification is inserted using the same sig/pubkey. **Important**: if you have multiple `checkSig` statements, keep in mind that the first will be used for verification.
  * Automatically cuts off VarInt from `scriptCode`, so `tx.bytecode` contains the actual contract bytecode.
* :sparkles: Output instantiation! Automatically construct output formats for covenant transactions.
  * `new OutputP2PKH(bytes8 amount, bytes20 pkh)`
  * `new OutputP2SH(bytes8 amount, bytes20 scriptHash)`
* :bug: Fix bug with invalid output when the final statement in a contract is an if-statement.

#### SolidCash SDK
* :sparkles: Add `fee` option to TransactionOptions. This allows you to specify a hardcoded fee for your transaction.
* :sparkles: Automatically pass in sighash preimage into covenant functions. **Important**: uses the hashtype of the first signature in the parameters for generation of this preimage.
* :dizzy: Better fee estimation for transactions with many inputs.

---
https://x.com/RoscoKalis/status/1204765863062188033

## v0.2.3
#### solidc compiler
* :bug: Fix a bug where unequal bytes types (e.g. `bytes3` & `bytes8`) could not be concatenated together, as they were considered different types.

---
https://x.com/RoscoKalis/status/1202220857566908416

## v0.2.2
#### SolidCash SDK
* :bug: Remove minimaldata encoding in `OP_RETURN` outputs that caused incompatibility with SLP.
* :name_badge: Renamed `Contract.fromCashFile` to `Contract.compile`.
  * The new function allows to pass in a path to a `.scash` file, or a string of the contract source code.
  * `Contract.fromCashFile` still exists for backward compatibility, but is deprecated and will be removed in a later release.
* :name_badge: Renamed `Contract.fromArtifact` to `Contract.import`.
  * The new function allows to pass in a path to a `.json` artifact file, or a JSON object of the artifact.
  * `Contract.fromArtifact` still exists for backward compatibility, but is deprecated and will be removed in a later release.
* :hammer_and_wrench: `instance.export`'s `file` argument is now optional.
  * If it is provided, the artifact is written to the file, if not, it is returned as an object.

---
https://x.com/RoscoKalis/status/1192900277105389568

## v0.2.1
#### solidc compiler
* :sparkles: Support `bytes` types with bounded size, e.g. `bytes1`, `bytes13`, `bytes32`.
* :bug: Fix bug in bytecode optimisation

#### SolidCash SDK
* :sparkles: Support `bytes` types with bounded size, e.g. `bytes1`, `bytes13`, `bytes32`.
* :bird: Automatically output meep command on failed transaction error.
* :hammer:  Make the `hashtype` parameter in signature placeholders optional.

---
https://x.com/RoscoKalis/status/1186554051720167424

## v0.2.0
#### solidc compiler
* :racehorse: Implement compiler optimisations
  * For the final use of a variable, it is retrieved with `OP_ROLL` rather than `OP_PICK`. This removes the need to clean the stack at the end of a contract.
  * Final `OP_VERIFY OP_TRUE` is removed as there is an implicit `OP_VERIFY` at the end of a Script.
  * `OP_VERIFY` is merged with preceding opcode where applicable.
  * Shallow `OP_PICK` and `OP_ROLL` are replaced by hardcoded opcodes (e.g. `OP_SWAP`, `OP_DUP`).
  * Several other bytecode optimisations.
* :sparkles: Add `pragma` keyword to specify intended compiler version.
  * Example: `pragma solidcash ^0.2.0;`
  * Contract fails to compile when compiler version does not satisfy constraints.
* :rotating_light: Add CashProof for all individual bytecode optimisations and for example contracts from 0.1.2 to 0.2.0.
* :bug: Add "default case" for function selection that fixes a vulnerability where people could spend funds by not calling any function.
* :arrow_up: Update dependencies.

#### SolidCash SDK
* :arrow_up: Update `solidc` and other dependencies.

---
https://x.com/RoscoKalis/status/1178843657069154305

## v0.1.2
#### SolidCash SDK
* :sparkles: Add support for `OP_RETURN` outputs.
* :bug: Improved error handling.
* :bug: Poll for transaction details to make sure it's available.
* :fire: Enable optional mainnet - **NOT RECOMMENDED**
* :hammer: UTXO selection refactor
* :rotating_light: Improve Transaction testing

---
https://x.com/RoscoKalis/status/1174910060691984385

## v0.1.1
#### SolidCash SDK
* :bug: Bug fixes with incorrect parameter encoding for string/bool/int types.

## v0.1.0
* :tada: Initial release.
