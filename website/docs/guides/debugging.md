---
title: Debugging
---

Debugging is no walk in the park. This is especially true for debugging complex smart contracts. Luckily there are strategies that can make it easier for developers to discover bugs in their contracts.

## Categories of Bugs

There are 2 broad categories of smart contract bugs:

### 1. Bug in Transaction Building

The first category of bugs is a bug in the transaction building meaning the 'invocation' of your smart contracts fails. This means the bug is in the usage of the SolidCash Transaction builder and you need to carefully review the shape of your transaction and whether it matches the requirements imposed by the smart contract UTXOs.

### 2. Bug in Contract Logic

The second category of bugs is a bug in the smart contract logic which prohibits valid spending, this results in the shape of the Transaction builder not matching with the contracts simply because there is a coding error in the contract! Carefully review the logic in the failing line and if needed check the documentation so you are sure about the functionality of your SolidCash contract code.

Whatever category your bug falls into, the first step of debugging is understanding what line in your SolidCash contract is making your transaction get rejected. Afterwards, investigation needs to start whether it's a transaction building bug or a bug in contract logic.

## Debugging Tools

The [Transaction Builder](/docs/sdk/transaction-builder) has deep integration with libauth to enable local transaction evaluation, without actual interaction with the Bitcoin Cash network. This allows for fully integrated debugging functionality.

### Error messages

Call `debug()` on a `TransactionBuilder` to evaluate every input locally. `send()` runs the same evaluation before it
broadcasts. When a `require` statement fails, the SDK throws a `FailedRequireError` that names the contract, the
input, the source line and the failing statement:

```bash
HodlVault.scash:23 Require statement failed at input 0 in contract HodlVault.scash at line 23.
Failing statement: require(price >= priceTarget)
```

If the `require` has a message, the first line ends with `with the following message: <message>`. When the failing
`require` sits inside a nested function call, the error also lists the call stack that led to it. Any other script
failure throws a `FailedTransactionEvaluationError` with the VM's reason and, when the artifact has debug
information, the source line. Both errors expose `inputIndex`, the VM's own message as `libauthErrorMessage`, and a
BitAuth IDE link as `bitauthUri` (see [Bitauth IDE](#bitauth-ide)). The link is not part of the message.

```ts
import { FailedRequireError } from '@solidcash/solidcash';

try {
  transactionBuilder.debug();
} catch (error) {
  if (error instanceof FailedRequireError) {
    console.log(error.inputIndex, error.requireStatement.line, error.requireStatement.message);
  }
  throw error;
}
```

`send()` only throws from this evaluation when every input is a plain contract or P2PKH input. For a transaction with
stateful covenant inputs the evaluation is best effort and does not throw, and a transaction with a custom unlocker
is not evaluated at all. In both cases a rejected broadcast throws a `FailedTransactionError` with the node's reason,
so call `debug()` yourself to find the failing line. `debug()` refuses a transaction with a custom unlocker.

Read the error message to see which line in the SolidCash contract causes the transaction validation to fail. Investigate whether the contract function invocation is the issue (on the TypeScript SDK side) or whether the issue is in the SolidCash contract itself (so you'd need to update your contract and recompile the artifact). If it is not clear **why** the SolidCash contract is failing on that line, use console logging and the BitAuth IDE, described below.

### Debugging a stateful call

A stateful call object (`sc.call.fn(args)`) has no `debug()` method. Build the transaction without sending it, then
debug the builder:

```ts
const builder = await counter.call.increment(sig).build(); // the call's TransactionBuilder; nothing is sent
builder.debug();                                           // throws FailedRequireError at the failing require
```

`getVmResourceUsage()` works on the built transaction as well.

### Exact failing lines

The compiler optimises the script by default, so for an optimised artifact the reported line can be a nearby
statement rather than the exact one. While you debug, compile with `optimise: false`. The script then keeps a
one-to-one mapping from instructions to source lines, so a failure points at the exact line and `require`.

```ts
import { compileFile } from '@solidcash/solidc';

const debugArtifact = compileFile(new URL('./HodlVault.scash', import.meta.url), { optimise: false });
```

In a SolidHat project, set `compiler: { optimise: false }` in `solidcash.config.ts` while you debug. The unoptimised
script is larger and evaluates more operations, so it can hit limits the optimised script does not. Never deploy it.

### Console Logging

To help with debugging, add `console.log` statements to a contract to inspect literals and variables when execution reaches a particular line:

```solidity
function withdraw(int requested, int available) {
    console.log("requested:", requested, "available:", available);
    require(requested <= available);
}
```

Recompile the contract after adding a log statement. Logging information is stored in the artifact and the SDK prints it during local debug evaluation. A log statement emits no Bitcoin Script instructions, does not increase the deployed contract size, and has no effect during regular network execution.

Each argument is a literal or the name of a variable or parameter. To log an expression, assign it to a local
variable first. Every log statement that executes prints one line when `debug()` runs, and `send()` runs it first.
The line names the input, the contract file and the source line:

```text
[Input #0] Vault.scash:3 requested: 10 available: 20
```

You can assert logged output in Vitest with the [`toLog` matcher](/docs/sdk/test-matchers#console-log-matcher):

```ts
await expect(transaction).toLog(/requested: 10 available: 20/);
```

#### Hardhat `console.sol` compatibility

Solidity contracts ported from an EVM project can keep their Hardhat console import. SolidCash treats `hardhat/console.sol` as a compiler-provided debugging module, so Hardhat does not need to be installed and the import resolver does not read a file from `node_modules`.

Both common Solidity import forms are supported:

```solidity
import "hardhat/console.sol";
import { console } from "hardhat/console.sol";
```

Hardhat implements its console library by ABI-encoding each call and making a `staticcall` to a reserved EVM address. The Hardhat development network recognizes that address and prints the decoded payload. Bitcoin Cash has no equivalent reserved address, so SolidCash maps these calls to its artifact-based debugger instead. The resulting BCH contract bytecode remains unchanged.

SolidCash supports the complete public function surface from Hardhat's `console.sol`:

| Function | Supported arguments |
| --- | --- |
| `console.log()` | No arguments |
| `console.log(...)` | Every Hardhat overload of one to four `uint`, `string`, `bool`, or `address` values |
| `console.logInt(value)` | One `int` value |
| `console.logUint(value)` | One `uint` value |
| `console.logString(value)` | One `string` value |
| `console.logBool(value)` | One `bool` value |
| `console.logAddress(value)` | One `address` value |
| `console.logBytes(value)` | One dynamic `bytes` value |
| `console.logBytes1(value)` through `console.logBytes32(value)` | One matching fixed-size byte value |

For example, an imported Hardhat contract can retain its existing logging calls:

```solidity
pragma solidity ^0.8.20;

import "hardhat/console.sol";

contract Vault {
    function withdraw(uint amount, address recipient) external {
        console.log("withdraw", amount, recipient);
        console.logUint(amount);
        console.logAddress(recipient);
        require(amount > 0);
    }
}
```

:::note
Console output is development metadata, not an on-chain event. Use [events](/docs/language/events-errors) when applications need durable, transaction-level logs.
:::

### Resource usage

`getVmResourceUsage(true)` evaluates the transaction like `debug()` and prints a table with one row per input: the
evaluated instruction count, the operation cost against the input's budget, signature checks and hash iterations.
Without the argument it only returns the numbers.

```ts
const usage = transactionBuilder.getVmResourceUsage(true);
```

See [`getVmResourceUsage()`](/docs/sdk/transaction-builder#getvmresourceusage) for the returned fields. The default
`MockNetworkProvider` uses the real operation-cost density but relaxes sizes and hash limits, so a transaction that
passes there may still break mainnet limits. See [safe test limits](/docs/tooling/testing-framework#safe-test-limits)
and [Script Limits](/docs/compiler/script-limits).

### Bitauth IDE

When a transaction fails, the thrown error carries a link to it in the BitAuth IDE as its `bitauthUri` property. The
SDK replaces the private keys in that link with placeholders, so logging the error does not leak them, but the IDE
then cannot recreate the transaction's signatures. Open the link to inspect the transaction in detail. In the BitAuth IDE you will see the raw BCH Script mapping to each line in your SolidCash contract, unless the artifact was compiled without source maps (`--no-source-map`). Find the failing line and investigate the failing OpCode. You can break up the failing line, one opcode at a time, to see how the stack evolves and ends with your `require` failure.

It's also possible to export the transaction for step-by-step debugging in the BitAuth IDE without failure. To do so, you can call the `getBitauthUri()` function on the transaction. This will return a URI that can be opened in the BitAuth IDE.

```ts
const uri = transactionBuilder.getBitauthUri();
```

:::caution
The URI from `getBitauthUri()` embeds the private keys of the transaction's signature templates, and the SDK prints a
warning when you call it. Use it only with test keys: opening the URI sends those keys to the BitAuth IDE over the
network.
:::
