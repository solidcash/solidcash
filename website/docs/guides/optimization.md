---
title: Optimizing Contracts
sidebar_label: Optimization
---

SolidCash contracts are transpiled from the high-level SolidCash code to [BCH Script](https://reference.cash/protocol/blockchain/script) by the `solidc` compiler. BCH Script is the low-level language used for the Bitcoin Cash Virtual Machine (BCH VM) to evaluate contracts.

Because transaction fees are based on the bytesize of a transaction, it may be useful to optimize the compiled size of your smart contract by tweaking your SolidCash code.

## Example Workflow

When optimizing your contract, you will need to continuously compare the contract size to see if the changes have a positive impact.
With the compiler CLI, you can easily check the bytesize and opcode count directly from the generated contract artifact.

```bash
solidc ./contract.scash --size --opcount
```

The compiler calculates the size from the contract's bytecode without constructor arguments. For the `opcount` this is not a problem but the `bytesize` output will be an underestimate, as the contract hasn't been initialized with contract arguments.
The compiler `bytesize` output is still helpful to compare the effect of changes, given that the contract constructor arguments stay the same.

:::tip
To get the exact contract bytesize including constructor parameters, initialise the contract with the TypeScript SDK and check the value of `contract.bytesize`.
:::

:::note
Size is not the only limit. Each input's operation-cost budget is `(41 + unlocking bytecode length) * 800`, so
shrinking a loop-heavy script also shrinks its budget. Measure the operation cost with
[`getVmResourceUsage(true)`](/docs/guides/debugging#resource-usage). The `salt` option of a `Contract` or a
stateful deployment pads the script to buy budget; see
[Buying compute budget](/docs/compiler/script-limits#buying-compute-budget).
:::

## Optimization Tips

The `solidc` compiler does some optimisations automatically. By writing your SolidCash code in a specific way, the compiler is better able to optimise it.

### 1. Declare variables

Declare variables instead of hardcoding the same values in multiple places:

```solidity title="Example SolidCash code"
    // do this
    bytes tokenId = 0x8473d94f604de351cdee3030f6c354d36b257861ad8e95bbc0a06fbab2a2f9cf;
    require(tx.outputs[0].tokenCategory == tokenId);
    require(tx.outputs[1].tokenCategory == tokenId);

    // not this
    require(tx.outputs[0].tokenCategory == 0x8473d94f604de351cdee3030f6c354d36b257861ad8e95bbc0a06fbab2a2f9cf);
    require(tx.inputs[1].tokenCategory == 0x8473d94f604de351cdee3030f6c354d36b257861ad8e95bbc0a06fbab2a2f9cf);
```

Also declare variables when re-using certain common introspection items to avoid duplicate expressions:

```solidity title="Example SolidCash code"
    // do this
    bytes tokenIdContract = tx.inputs[0].tokenCategory.split(32)[0];
    require(tx.inputs[1].tokenCategory == tokenIdContract);
    require(tx.outputs[1].tokenCategory == tokenIdContract);

    // not this
    require(tx.inputs[1].tokenCategory == tx.inputs[0].tokenCategory.split(32)[0]);
    require(tx.outputs[1].tokenCategory == tx.inputs[0].tokenCategory.split(32)[0]);
```

### 2. Consume stack items

It's best to "consume" values (i.e. their final use in the contract) as soon as possible. This frees up space on the stack.
Use/consume values as close to their declaration as possible, both for variables and for parameters. This avoids having to do deep stack operations. This [example](https://gitlab.com/GeneralProtocols/anyhedge/contracts/-/blob/development/contracts/v0.11/contract.cash#L61-72) from AnyHedge illustrates consuming values immediately.

### 3. Parse efficiently
When using `.split()` to use both sides of a `bytes` element, declare both parts immediately to save on opcodes parsing the byte array.

```solidity title="Example SolidCash code"
    // do this
    bytes firstPart, bytes secondPart = tx.inputs[0].nftCommitment.split(10);

    // not this
    bytes firstPart = tx.inputs[0].nftCommitment.split(10)[0];
    bytes secondPart = tx.inputs[0].nftCommitment.split(10)[1];
```
### 4. Avoid if-else

Avoid if-statements when possible. Instead, try to "inline" them. This is because the compiler cannot know which branches will be taken, and therefore cannot optimise those branches as well. This [example](https://gitlab.com/GeneralProtocols/anyhedge/contracts/-/blob/development/contracts/v0.11/contract.cash#L128-130) from AnyHedge illustrates inlining flow control:

```solidity title="Adapted from AnyHedge"
    // do this
    bool onOrAfterMaturity = settlementTimestamp >= maturityTimestamp;
    bool priceOutOfBounds = !within(clampedPrice, lowLiquidationPrice + 1, highLiquidationPrice);
    require(onOrAfterMaturity || priceOutOfBounds);

    // not this
    if(!(settlementTimestamp >= maturityTimestamp)){
        bool priceOutOfBounds = !within(clampedPrice, lowLiquidationPrice + 1, highLiquidationPrice);
        require(priceOutOfBounds);
    }
```

### 5. Trial & Error

When the contract logic is finished, that is a great time to revisit the order of the contract's constructor argument, the different contract functions and even the contract parameters. Currently the compiler does not change/optimize the user-defined order, so in addition to the guidelines above, it can still be helpful to trial and error different ordering for the items.

## Avoid Many Functions

When a contract has many different functions or has a lot duplicate code shared across two functions, this can be a natural indication that contract optimization is possible. There's a different optimization strategy for each:

### Modular Contract Design

Modular contract design avoids the added size of having many functions, instead the contract logic is separated out in to different components which we will call 'function contracts'.
By only adding the function contract you are actually using in the transaction, and not all the other unused functions, you can drastically shrink the size of your contracts used in a transaction.

The concept of having NFT functions was first introduced by the [Jedex demo](https://github.com/bitjson/jedex#demonstrated-concepts) and was first implemented in a CashScript contract by the [FexCash DEX](https://github.com/fex-cash/fex/blob/main/whitepaper/fex_whitepaper.md). The concept is that by authenticating NFTs, you can make each function a separate contract with the same tokenId. This way, you can offload logic from the main contract. One function NFT contract is attached to the main contract during spending, while the other contract functions exist as unused UTXOs, separate from the transaction.

:::tip
By using function NFTs you can use a modular contract design where the contract functions are offloaded to different UTXOs, each identifiable by the main contract by using the same tokenId.
:::

For a stateful contract over the 10,000-byte limit, the compiler can do this split for you: `solidc --split size`
compiles it into a state-owning root plus delegate facets, and the SDK routes each call through the facet it needs.
See [Large Contracts & Split Bundles](/docs/compiler/large-contracts).

### Combining Functions

If there is a lot of duplicate code across different functions in your contract, you could consider combining the functions into one, where the logic of the different functions are conditionally executed based on the function arguments, removing duplicate code.

SolidCash supports function overloading, but each overload still has a fixed ABI shape and its own selector.
Combining paths into one function can remove duplicated bytecode only when a compact discriminator and a shared
fixed argument shape are cheaper than those separate selector branches. There is no optional-argument ABI.

:::caution
This optimization is considered advanced, as it steps away from the SolidCash abstraction for contract structure and often requires workarounds.
:::

```solidity title="Example SolidCash code"
contract Example(){
  function Main(bool conditionFunction1, bool conditionFunction2, bool conditionFunction3){
    // logic applying to all if/else branches
    if(conditionFunction1){
       // logic function1
    } else if(conditionFunction2){
       // logic function2
    } else {
      // logic applying to function 3 & 4
      if(conditionFunction3){
        // logic function3
      } else {
        // logic function4
      }
    }
  }
}
```

In SolidCash, when a contract has several externally callable functions, the unlocking bytecode carries a 4-byte
function selector and the contract dispatches on it to the selected function body. Every function body stays in the
script, so each spend reveals all of them. When combining multiple functions in one, you will have to think about
the function conditions and `if-else` branching yourself.

## Advanced: Hand-optimizing Bytecode

You can still use the SolidCash TypeScript SDK while using a hand-optimized or hand-written contract, although this is considered advanced functionality.

There's two ways to go about this, either you create a custom `Artifact` so you can still use the `Contract` class or you create a custom `Unlocker` to use in the transaction building directly.

### Note on Premature Optimizations

It's worth considering whether hand-optimizing the contract is necessary at all. If the contract works and there is no glaring inefficiency in the bytecode, perhaps the best optimization is to not to obsess prematurely about the transaction size with Bitcoin Cash's negligible fees.

>We should forget about small efficiencies, say about 97% of the time: premature optimization is the root of all evil. Yet we should not pass up our opportunities in that critical 3%.

### Optimizing with the BitauthIDE

When optimizing the bytecode of your contract to ensure it is the smallest possible bytesize you'll likely want to use the [BitauthIDE][BitauthIDE] so you can see the stack changes for each executed OpCode. Low-level understanding can also give good intuition about the [optimization tips](#optimization-tips) for the SolidCash code.

### Method 1) Custom Artifact

To manually optimize a SolidCash contract's bytecode, you need to overwrite the `bytecode` key of your contract artifact.

If you manually overwrite the `bytecode` in the artifact, the auto generated 2-way-mapping generated by the compiler becomes obsolete. You are no longer compiling high-level SolidCash code into BCH script, instead you are writing BCH script by hand.
This causes the link of the BCH opcodes to your original SolidCash code will be entirely lost for debugging.

Hand-optimize only stateless contracts. A multi-function artifact also keeps each function body under
`functionBodies`, keyed by selector, and the SDK signs against that body, so keep the two consistent. Do not
hand-edit a stateful artifact: the SDK builds its covenant transactions from the compiler's metadata for the exact
compiled script.


```typescript
interface Artifact {
  bytecode: string // Compiled Script without constructor parameters added (in ASM format)
  // remove the 'debug' property as the info becomes obsoleted
}
```


:::caution
If you use hand-optimized `bytecode` in your Contract's artifact, the `debug` info on your artifact will become obsolete and should be removed.
:::

:::tip
You can create an `Artifact` for a fully hand-written contract so it becomes possible to use the contract with the nice features of the SolidCash SDK! An example of this approach in CashScript, whose SDK SolidCash's `Contract` class grew from, is the [unofficial Cauldron Swap SDK][Cauldron-Swap-SDK], which uses `Artifact bytecode` not produced by a compiler at all.
:::

### Method 2) Custom Unlockers

In the [addInput() method][addInput()] on the TransactionBuilder you can provide a custom `Unlocker`

```ts
transactionBuilder.addInput(utxo: Utxo, unlocker: Unlocker, options?: InputOptions): this
```

the `Unlocker` interface is the following:

```ts
interface Unlocker {
  generateLockingBytecode: () => Uint8Array;
  generateUnlockingBytecode: (options: GenerateUnlockingBytecodeOptions) => Uint8Array;
}

interface GenerateUnlockingBytecodeOptions {
  transaction: Transaction;
  sourceOutputs: LibauthOutput[];
  inputIndex: number;
}
```


[BitauthIDE]: https://ide.bitauth.com
[Cauldron-Swap-SDK]: https://github.com/mr-zwets/Cauldron-Swap-SDK
[addInput()]: /docs/sdk/transaction-builder#addinput
