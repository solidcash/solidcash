---
title: Token Containers
sidebar_label: Token Containers
---

Token containers let a stateful contract custody and transfer a selected CashToken category without storing
the balance in an NFT commitment. The tokens remain native fungible tokens or NFTs. For each pair of owning
contract category and held token category, SolidCash derives a deterministic P2SH32 container covenant.

```text
container address = tokenContainer(owner category, held token category)
```

The owner contract's minting NFT authorizes normal container spends. The container also has a permissionless
preservation path for moving one container UTXO forward without reducing its satoshis, fungible amount, or token
category. That path rejects a transaction containing another input with the same container locking bytecode, so
several inputs cannot claim the same preservation output.

Token containers are available only to stateful contracts and cannot be read or transferred in a constructor.

## Contract API

Index `this.tokens` with the 32-byte, display-order category of the token being held:

```solidity
contract Vault(pubkey owner) {
    int withdrawals;

    function withdraw(
        bytes32 category,
        bytes20 recipient,
        bigint amount,
        sig authorization
    ) {
        require(checkSig(authorization, owner));
        require(this.tokens[category].tokenAmount >= amount);

        this.tokens[category].transfer(
            new LockingBytecodeP2PKH(recipient),
            amount
        );
        this.withdrawals += 1;
    }
}
```

The category must normally be a direct `bytes32` function parameter. An arbitrary expression or copied local
parameter is rejected because the compiler and SDK must bind the category to the covenant witness. The supported
own-category form is:

```solidity
function reserve() view returns (bigint) {
    bytes32 category = this.category;
    return this.tokens[category].tokenAmount;
}
```

`this.category` is the current contract's category in display order. It is distinct from the raw
`this.categoryId` introspection value.

### Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `tokenAmount` | `bigint` | Sum of fungible amounts in matching container inputs |
| `nftCount` | `bigint` | Number of NFTs in matching container inputs |
| `tokenCategory` | `bytes` | Full category bytes, including an NFT capability suffix when present, from the routed container input |
| `nftCommitment` | `bytes` | NFT commitment from the routed container input |

If no routed container input exists, the single-input fields return their empty/default value. The aggregate
fields scan transaction inputs whose locking bytecode and base category match the derived container. Most calls
route one such input; see [Multiple container UTXOs](#multiple-container-utxos).

The post-execution aggregate can also be inspected:

```solidity
bigint before = this.tokens[category].tokenAmount;
bigint after = this.outState.tokens[category].tokenAmount;
bigint nftCountAfter = this.outState.tokens[category].nftCount;
```

Only `tokenAmount` and `nftCount` are available through `this.outState.tokens[...]`.

### Fungible transfers

```solidity
this.tokens[category].transfer(recipientLockingBytecode, amount);
```

`recipientLockingBytecode` is `bytes`; construct a standard address with a locking-bytecode class when needed.
`amount` is a positive `bigint`-compatible value. The compiler authenticates the transfer output's locking
bytecode, exact fungible amount, base category, and absence of an NFT.

Several calls may transfer to several recipients, and one function may use several category parameters. Their
outputs are ordered by source occurrence and normally derived by the SDK.

### NFT transfers

```solidity
this.tokens[category].transferNft(
    recipientLockingBytecode,
    commitment,
    capability
);
```

`commitment` is `bytes`. The contract-side capability is an integer:

| Value | Capability |
| ---: | --- |
| `0` | immutable (`none` in the SDK) |
| `1` | mutable |
| `2` | minting |

The output is pinned to the recipient, commitment, capability, base category, and a fungible amount of zero.
If the input UTXO also holds fungible tokens, those tokens stay in the preservation output unless transferred
separately.

## Preservation and deposits

For every non-`selfdestruct` call that consumes a container, the corresponding container output must remain
token-bearing. Its locking bytecode and category are preserved, its satoshi value cannot decrease, and its
fungible balance obeys:

```text
input amount - authenticated transfers <= output amount
```

The inequality permits deposits while preventing the unauthenticated remainder from being redirected. An NFT
transfer removes the NFT from the remainder; otherwise its category/capability is preserved.

Consequently, an ordinary call cannot completely drain a fungible-only container or transfer the only NFT from
an NFT-only container. A full fungible transfer is possible when an NFT remains, and an NFT transfer is possible
when a positive fungible amount remains. A `selfdestruct` route is the explicit exception, but it does not choose
token recipients automatically; account for every category in the function and transaction. See
[Selfdestruct](./selfdestruct.md#tokens-are-not-transferred).

To deposit, send a real token input and tell the call how much of it belongs in the container remainder:

```ts
const call = vault.call.deposit(category, amount)
  .tokenContainerDeposit(category, amount)
  .addInput(tokenUtxo, tokenUnlocker);

await call.send();
```

`tokenContainerDeposit()` does not source or unlock tokens. It only adjusts the expected preservation output;
the added input, its unlocker, token change, and BCH funding remain transaction-builder responsibilities.
Consensus enforces the category's overall token balance.

## SDK access

Given a connected `StatefulContract` named `vault` and a display-order category hex string:

```ts
const container = vault.tokens[category];

const address = container.address;
const utxos = await container.utxos;
const amount = await container.amount;       // same as getAmount()
const nftCount = await container.getNftCount();
const commitments = await container.commitments;
const firstCategory = await container.category;
```

The same address is available as `vault.getTokenContainerAddress(category)`. The accessor filters out foreign
categories paid to that address. `utxos`, `amount`, `getAmount()`, `getNftCount()`, and `commitments` operate over
all matching provider UTXOs; `category` is the first matching UTXO's category or `''` when none exists.

An ordinary function call uses compiler effect metadata and covenant execution to derive its transfer outputs.
If derivation cannot determine a recipient, amount, commitment, or capability, provide the exact outputs:

```ts
const call = vault.call.withdraw(category, recipientPkh, amount, authorization)
  .tokenContainerTransfer(category, recipientLockingBytecode, amount);

const nftCall = vault.call.withdrawNft(category, recipientPkh, commitment, 1)
  .tokenContainerTransferNft(
    category,
    recipientLockingBytecode,
    commitment,
    'mutable'
  );
```

The lower-level `StatefulTransactionBuilder` methods are named `addTokenContainerTransfer`,
`addTokenContainerTransferNft`, and `addTokenContainerDeposit`.

### Multiple container UTXOs

The off-chain accessor deliberately aggregates every matching UTXO, but normal call construction currently
selects one matching provider UTXO per accessed category. It does not automatically co-spend all UTXOs returned
by `vault.tokens[category].utxos`. Ensure the selected UTXO contains the amount or NFT required by the call, or
consolidate/restructure the container UTXOs explicitly before relying on auto-derivation. Do not treat the
aggregate accessor balance as a guarantee that one ordinary routed call can spend that total.

## Category byte order

SDK category strings and `this.tokens[category]` parameters use the usual display-order 64-character hex ID.
Raw `tx.inputs[i].tokenCategory`, `tx.outputs[i].tokenCategory`, and `this.categoryId` expose consensus
introspection bytes; they may also include a trailing `0x01` (mutable) or `0x02` (minting) capability byte.
When comparing raw introspection with a display-order ID, split off any capability and reverse the 32 category
bytes. Prefer `this.category` and token-container APIs when you do not need the raw representation.

## Security checklist

- Authorize every withdrawal in contract code. The owner-master path authorizes the container spend; it does
  not decide who is entitled to withdraw.
- Treat recipient locking bytecode, amount, NFT commitment, and capability as security-sensitive arguments.
- Check a sufficient balance before subtracting or transferring, and use `bigint` for native token amounts.
- Remember that one UTXO can contain both an FT amount and an NFT of the same category.
- Handle token inputs and token change deliberately when depositing; omission can burn CashTokens.
- Plan consolidation if a category can accumulate several container UTXOs.

Token containers are a general custody primitive. SolidCash does not currently synthesize a native ERC-20
ledger, allowance model, or mint policy from them; those application semantics must be implemented by the
contract.
