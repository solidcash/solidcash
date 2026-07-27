---
title: Cryptography
---

SolidCash exposes the Bitcoin Cash signature and hashing primitives directly, plus two Ethereum-compatible
primitives that BCH has no opcode for: **keccak256** and **ecrecover**. Both are implemented as co-spent
**side-cars** so their cost lands on a dedicated input budget rather than on your contract's.

## Hashing

| Function | Returns | Description |
| --- | --- | --- |
| `sha256(x)` | `bytes32` | SHA-256 of `x` |
| `hash256(x)` | `bytes32` | Double SHA-256 of `x` |
| `ripemd160(x)` | `bytes20` | RIPEMD-160 of `x` |
| `hash160(x)` | `bytes20` | RIPEMD-160 of the SHA-256 of `x` |
| `sha1(x)` | `bytes20` | SHA-1 of `x` |
| `keccak256(x)` | `bytes32` | Real Keccak-256, Ethereum-identical |

The four Bitcoin-native hashes compile to single opcodes and are effectively free. `keccak256` does not.

### keccak256

Bitcoin Cash has no Keccak opcode, and computing keccak256 in Script costs roughly 2.26 million VM operations
per 136-byte block, which exceeds what a contract can afford on its own input budget. SolidCash therefore
compiles `keccak256(x)` to a **compute-and-commit side-car**: a small co-spent UTXO whose covenant runs
keccak256 on its own per-input budget, commits the digest into its recreated NFT commitment, and
self-preserves. Your contract reads that commitment as the result.

```solidity
contract Verifier(bytes32 expected) {
    function check(bytes preimage) {
        require(keccak256(preimage) == expected);
    }
}
```

The digest is **byte-identical to Ethereum's**, so role ids, EIP-712 domain separators and ERC-7201 namespaced
slots all match what an Ethereum contract derives.

The soundness of the side-car rests on three checks the contract performs at the call site:

- **Preimage bind** - the side-car hashed *your* argument, not some other value.
- **Covenant integrity** - the co-spent input is a genuine compute side-car, verified by hashing its covenant.
- **Result read** - the digest is read from the side-car's own recreated commitment.

A constant `keccak256("literal")` is folded at compile time and costs nothing at runtime.

:::note
The SDK co-spends side-cars transparently, so `contract.unlock.check(preimage)` just works, provided side-cars
are deployed at the branded address. Side-car instances are allocated per call site, so a contract that calls
`keccak256` in a loop needs enough of them for the maximum iteration count.
:::

## Signature checking

:::caution
All signature-checking functions must comply with the [NULLFAIL][bip146] rule, which only allows `0x` as an
invalid signature. Any other invalid signature **immediately fails** the entire script.
:::

### checkSig

```solidity
bool checkSig(sig s, pubkey pk)
```

Checks that transaction signature `s` is valid for the current transaction and matches public key `pk`.

### checkMultiSig

```solidity
bool checkMultiSig(sig[] sigs, pubkey[] pks)
```

Performs a multi-signature check over lists of signatures and public keys.

:::note
This function is not supported by the TypeScript SDK, so it is recommended to simulate it with multiple
`checkSig()` calls instead.
:::

### checkDataSig

```solidity
bool checkDataSig(datasig s, bytes msg, pubkey pk)
```

Checks that `s` is a valid signature for message `msg` under public key `pk`. `OP_CHECKDATASIG` verifies the
signature over `sha256(msg)`, so the signer signs `sha256(msg)`, not `msg` directly.

:::caution
This differs from Ethereum, where the digest is signed directly. Account for it when porting a signer.
:::

### Working around NULLFAIL

Because a non-empty invalid signature aborts the script rather than returning `false`, use an empty `0x`
signature to mean "absent":

```solidity
contract Escrow(pubkey seller, pubkey referee) {
    // This fails outright: userSig is invalid for whichever key it does not match.
    // require(checkSig(userSig, seller) || checkSig(userSig, referee));

    function release(sig sellerSig, sig refereeSig) {
        // Pass 0x for the unused signature so the check returns false instead of aborting.
        require(checkSig(sellerSig, seller) || checkSig(refereeSig, referee));
    }
}
```

## Signature recovery (ecrecover)

Bitcoin Cash exposes signature *verification*, not *recovery*: `OP_CHECKDATASIG` takes the public key rather
than deriving it. SolidCash nevertheless implements real secp256k1 public-key recovery, in pure Script, via a
co-spent **recovery side-car pair**. The result is bit-for-bit identical to the EVM's `ecrecover` precompile,
so a signature produced by ethers.js recovers to the same address.

Three builtins expose it, all taking Solidity's `(hash, v, r, s)` shape:

| Function | Returns | Description |
| --- | --- | --- |
| `ecrecoverPubKey(bytes32 hash, int v, bytes32 r, bytes32 s)` | `pubkey` | The recovered secp256k1 public key |
| `ecrecoverP2pkh(bytes32 hash, int v, bytes32 r, bytes32 s)` | `address` | The signer's P2PKH locking bytecode |
| `ecrecoverEvm(bytes32 hash, int v, bytes32 r, bytes32 s)` | `bytes20` | The signer's Ethereum address |

```solidity
contract Permit(bytes20 signer) {
    function verify(bytes32 digest, int v, bytes32 r, bytes32 s) {
        require(ecrecoverEvm(digest, v, r, s) == signer);
    }
}
```

Use `ecrecoverEvm` when checking against an Ethereum address (an EIP-712 permit, a MetaMask signature), and
`ecrecoverP2pkh` when checking against a BCH address.

:::note
Bare Solidity `ecrecover(hash, v, r, s)` is rewritten to one of these projections only when the compiler's
`ecrecover` option is set (to `p2pkh` or `evm`), and is otherwise undefined. This lets a buried library call,
such as OpenZeppelin's `ECDSA.sol`, project correctly without patching the source.
:::

:::caution
Recovery is expensive. It spans **two co-spent side-car inputs** per call, because the double-scalar
multiplication cannot fit in a single input's operation budget even with GLV optimisation. If you already know
the public key, use `checkDataSig` instead: it is a single opcode.
:::

### Recovering versus verifying

If the public key is available to the spender, verifying is dramatically cheaper than recovering:

```solidity
contract Cheap(bytes20 expectedPkh) {
    function verify(datasig s, bytes message, pubkey pk) {
        // One opcode. The pubkey is supplied by the unlocker and checked.
        require(checkDataSig(s, message, pk));
        require(hash160(pk) == expectedPkh);
    }
}
```

This is as strong a guarantee as recovery: a valid signature over `message` under `pk` proves the signer
controls `pk`. Recovery is only necessary when you must match a foreign, EVM-produced signature.

## Hash and selector policy

| Use | Hash | Matches Ethereum? |
| --- | --- | --- |
| `keccak256(data)` at runtime | real keccak (side-car) | Yes |
| `keccak256("literal")` constant | real keccak (compile-time fold) | Yes |
| Yul `keccak256(p, l)` | real keccak | Yes |
| `erc7201(id)` namespaced slot | real keccak, full EIP-7201 formula | Yes |
| Function selector, default | sha256 | No |
| Function selector under `evmCompat` | real keccak256 | Yes |
| Mapping / array physical storage slot | sha256 | No (internal to BCH) |
| Event `.selector` / topic0 | sha256 | No |

:::caution
`abi.encodeWithSignature` and `abi.encodeCall` derive their 4-byte selector with **sha256** by default, so
encoded calldata is not cross-VM compatible. Use them for SolidCash-to-SolidCash calls, or enable `evmCompat`
for real keccak256 selectors.
:::

## See also

- [Built-in Functions](/docs/language/builtin-functions) - the full global function catalogue
- [Libraries & Using-For](/docs/language/libraries#external-library-precompiles) - the precompile mechanism
- [Platform Differences](/docs/basics/platform-differences#hashing) - the hashing policy rationale

[bip146]: https://github.com/bitcoin/bips/blob/master/bip-0146.mediawiki
