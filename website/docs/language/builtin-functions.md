---
title: Built-in Functions
---

SolidCash has several built-in functions for things like cryptographic and arithmetic applications, and it includes many common arithmetic and other operators that you would expect in a programming language.

## Arithmetic functions
### abs()
```solidity
int abs(int a)
```

Returns the absolute value of argument `a`.

### min()
```solidity
int min(int a, int b)
```

Returns the minimum value of arguments `a` and `b`.

### max()
```solidity
int max(int a, int b)
```

Returns the maximum value of arguments `a` and `b`.

### within()
```solidity
bool within(int x, int lower, int upper)
```

Returns `true` if and only if `x >= lower && x < upper`.

### addmod()
```solidity
int addmod(int x, int y, int k)
```

Returns `(x + y) % k`. Because the BCH VM has arbitrary-precision integers, the intermediate sum cannot
overflow, so this is exactly `(x + y) % k` with no wraparound.

### mulmod()
```solidity
int mulmod(int x, int y, int k)
```

Returns `(x * y) % k`, with the same no-overflow guarantee as `addmod`.

## Hashing functions
### ripemd160()
```solidity
bytes20 ripemd160(any x)
```

Returns the RIPEMD-160 hash of argument `x`.

### sha1()
```solidity
bytes20 sha1(any x)
```

Returns the SHA-1 hash of argument `x`.

### sha256()
```solidity
bytes32 sha256(any x)
```

Returns the SHA-256 hash of argument `x`.

### hash160()
```solidity
bytes20 hash160(any x)
```

Returns the RIPEMD-160 hash of the SHA-256 hash of argument `x`.

### hash256()
```solidity
bytes32 hash256(any x)
```

Returns the double SHA-256 hash of argument `x`.

### keccak256()
```solidity
bytes32 keccak256(bytes x)
```

Returns the real Keccak-256 hash of `x`, byte-identical to Ethereum's. Bitcoin Cash has no Keccak opcode, so
this compiles to a **co-spent compute side-car** rather than inline script. A constant
`keccak256("literal")` is folded at compile time. See [Cryptography](/docs/language/cryptography#keccak256).

:::note
An `address` is not implicitly a `bytes`, so hash an address with an explicit cast:
`hash160(bytes(msg.sender))`.
:::

## Signature checking functions
:::caution
All signature checking functions must comply with the [NULLFAIL][bip146] rule which only allows `0x` as an invalid signature — any other invalid signature will **immediately fail** the entire script.
:::

#### Nullfail example

The `NULLFAIL` rule means passing an invalid signature to `checkSig()` does not return `false` — it fails the script. To safely return `false` on a signature check, use an empty `0x` signature instead, as shown below:

```solidity
contract Escrow(pubkey seller, pubkey referee) {
    // This would immediately fail: userSig is invalid for whichever key it
    // does not match, and a non-empty invalid signature aborts the script.
    //
    //   require(checkSig(userSig, seller) || checkSig(userSig, referee));

    // Instead take two signatures, and pass 0x for the unused one so that
    // checkSig returns false rather than aborting.
    function release(sig sellerSig, sig refereeSig) {
        require(checkSig(sellerSig, seller) || checkSig(refereeSig, referee));
    }
}
```

### checkSig()
```solidity
bool checkSig(sig s, pubkey pk)
```

Checks that transaction signature `s` is valid for the current transaction and matches with public key `pk`.

### checkMultiSig()
```solidity
bool checkMultiSig(sig[] sigs, pubkey[] pks)
```

Performs a multi-signature check using a list of transaction signatures and public keys.

:::note
While this function can be used inside your smart contracts, it is not supported by the TypeScript SDK, so it is recommended not to use it. Instead a `checkMultiSig()` call can be simulated using multiple `checkSig()` calls.
:::

### checkDataSig()
```solidity
bool checkDataSig(datasig s, bytes msg, pubkey pk)
```

Checks that sig `s` is a valid signature for message `msg` and matches with public key `pk`.

## Other functions

### toPaddedBytes()
```solidity
bytes toPaddedBytes(int value, int length)
```

Pads the integer `value` with zeros to the specified `length`. This is most useful when storing integer values in local state (see [local state guide][local-state-guide]).

:::tip
Using `bytes20 placeholderPkh = toPaddedBytes(0, 20)` will generate a 20 byte zero-array at runtime, whereas
`bytes20 placeholderPkh = 0x0000000000000000000000000000000000000000` will actually take 20 bytes of space in your contract.
:::

### intToString()
```solidity
string intToString(int value)
```

Converts an integer to its decimal string representation.

### stringToInt()
```solidity
int stringToInt(string value)
```

Parses a decimal string into an integer.

## Signature recovery

Bitcoin Cash has no public-key recovery opcode, so these compile to a co-spent recovery side-car pair. All
three take Solidity's `(hash, v, r, s)` argument shape and are bit-for-bit EVM-conformant.

### ecrecoverPubKey()
```solidity
pubkey ecrecoverPubKey(bytes32 hash, int v, bytes32 r, bytes32 s)
```

Recovers the signer's secp256k1 public key.

### ecrecoverP2pkh()
```solidity
address ecrecoverP2pkh(bytes32 hash, int v, bytes32 r, bytes32 s)
```

Recovers the signer's P2PKH locking bytecode.

### ecrecoverEvm()
```solidity
bytes20 ecrecoverEvm(bytes32 hash, int v, bytes32 r, bytes32 s)
```

Recovers the signer's Ethereum address.

:::caution
Recovery spans two co-spent side-car inputs per call. If the public key is already available to the spender,
use `checkDataSig` instead: it is a single opcode. See [Cryptography](/docs/language/cryptography).
:::

## Block functions

### blockhash()
```solidity
bytes32 blockhash(int blockNumber)
```

Returns the hash of the given block, read from a per-pair oracle.

### blobhash()
```solidity
bytes32 blobhash(int index)
```

Always returns zero. Bitcoin Cash has no EIP-4844 blobs; this exists as a porting shim.

### gasleft()
```solidity
uint256 gasleft()
```

A fixed shim that always returns `1000000`. Bitcoin Cash has no gas metering; this exists so ported
gas-budget checks keep running. Compiler-warned; do not rely on the value.

## See also

- [Cryptography](/docs/language/cryptography) - hashing, signatures and recovery in depth
- [Global Variables](/docs/language/globals) - `tx.*`, `msg.*`, `block.*` and the `abi.*` family
- [Functions](/docs/language/functions) - declaring your own functions

[bip146]: https://github.com/bitcoin/bips/blob/master/bip-0146.mediawiki
[local-state-guide]: /docs/guides/covenants#keeping-local-state-in-nfts
