# ecrecover in SolidCash

**Status: implemented.**

`ecrecover(hash, sig, pubKey)` verifies a Bitcoin Cash data signature and, on success, returns the signer's
P2PKH locking bytecode. It is the BCH counterpart to Solidity's `ecrecover`, adapted to BCH's verify-with-pubkey
model: Bitcoin Cash has no public-key recovery primitive, so the public key is supplied and checked rather than
recovered (see "Why there is no (v, r, s) form").

## Signature

```
address ecrecover(bytes32 hash, datasig sig, pubkey pubKey)
```

| param    | type      | meaning |
|----------|-----------|---------|
| `hash`   | `bytes32` | the signed message digest; passed to `OP_CHECKDATASIG` as the message |
| `sig`    | `datasig` | a BCH data signature (64-byte Schnorr or strict-DER ECDSA), or empty `0x` |
| `pubKey` | `pubkey`  | the public key claimed to have signed `hash` |

Returns `address`. A SolidCash `address` is a locking bytecode at the VM level, so the result is either the
signer's P2PKH locking script or the zero address (empty bytes):

| condition                            | return |
|--------------------------------------|--------|
| signature valid for (`hash`, `pubKey`) | the 25-byte P2PKH locking bytecode `0x76a914 || hash160(pubKey) || 0x88ac` |
| signature empty (`0x`)               | the zero address, empty bytes `0x` |
| signature non-empty but invalid      | the script **aborts** (see "NULLFAIL") |

Because an `address` is a locking bytecode, the success result is directly comparable to a `lockingBytecode`
introspection field, so a recovered signer can be pinned in a covenant. The zero-address (`0x`) result is the
failure sentinel, analogous to Solidity's `address(0)`.

## Semantics

```solidity
address recoveredAddress = ecrecover(hash, sig, pubKey);
// recoveredAddress == 0x                       -> no / empty signature (zero address)
// recoveredAddress == <p2pkh locking bytecode> -> signer is hash160(pubKey)
```

It is exactly equivalent to this existing SolidCash expression (the branch values are locking bytecodes, which
an `address` holds):

```solidity
recoveredAddress = checkDataSig(sig, hash, pubKey)
  ? new LockingBytecodeP2PKH(hash160(pubKey))   // 0x76a914 <pkh> 88ac
  : 0x;
```

`ecrecover` is provided as a builtin (rather than left as the expression above) so the name and shape match
Solidity for porting, and so the empty-vs-invalid behaviour below is specified in one place.

### Signing convention

`OP_CHECKDATASIG` verifies `sig` over `sha256(hash)`. A signer therefore produces `sig` by signing `sha256(hash)`
with the private key for `pubKey`. This differs from Ethereum, where the digest is signed directly.

### NULLFAIL: empty vs. invalid

The "empty bytes on failure" result applies **only to an empty signature**. Bitcoin Cash enforces the NULLFAIL
rule on `OP_CHECKDATASIG`: a **non-empty but invalid** signature does not push false - it **aborts the script**.
So the three outcomes are:

- valid signature -> P2PKH locking bytecode,
- empty signature (`0x`) -> the zero address (the "no signature" sentinel, analogous to Solidity's `address(0)`),
- non-empty wrong signature -> the transaction fails.

This is fail-closed: a forged signature cannot produce either a usable address or the zero-address sentinel; it
halts. Callers that want the zero-address sentinel must pass an empty `sig` to mean "absent".

## Emitted Script

With the arguments evaluated as `[sig, hash, pubKey]` (the `OP_CHECKDATASIG` operand order, `pubKey` on top):

```
OP_DUP OP_HASH160                 # hash160(pubKey) -> pkh
<0x76a914> OP_SWAP OP_CAT         # 0x76a914 || pkh
<0x88ac> OP_CAT                   # || 0x88ac  = 25-byte P2PKH locking bytecode
OP_TOALTSTACK                     # stash it (balanced; restored below)
OP_CHECKDATASIG                   # [bool]   (pops sig, hash, pubKey)
OP_FROMALTSTACK OP_SWAP           # [p2pkh, bool]
OP_IF
  # true: keep p2pkh
OP_ELSE
  OP_DROP <0x>                    # false: drop p2pkh, push empty bytes
OP_ENDIF
```

The altstack stash is balanced (one `OP_TOALTSTACK`, one `OP_FROMALTSTACK`), so it does not disturb a persistent
altstack value such as delegatecall's master index. The success branch yields 25 bytes, the failure branch 0
bytes; both branches leave one `address` (locking-bytecode) value, so the stack tracker stays balanced.

## The four-argument form compiles to an inert zero address (with a warning)

Solidity's `ecrecover(hash, v, r, s)` performs ECDSA public-key recovery, which BCH cannot do. Rather than reject
it (which would break Solidity ports at compile time), the compiler **accepts** the four-argument form so the
source compiles, but it is **inert**: the arguments are dropped and the call always evaluates to the zero address
`0x`. So any check against the result fails closed - `require(recovered == owner)` never passes, `recovered ==
address(0)` is always true - and no false authorization can slip through. The compiler emits a warning:

```
Warning: ecrecover(hash, v, r, s) at line N performs ECDSA public-key recovery, which Bitcoin Cash cannot do;
it always returns the zero address (0x), so any check against it fails. Use ecrecover(hash, sig, pubKey) -
verify a supplied public key. See docs/ecrecover.md.
```

Resolution by arity:

- **3 arguments** -> the builtin specified here,
- **4 arguments** -> accepted, warned, and always `0x` (inert; see above),
- **any other count** -> the usual arity error, citing the 3-argument signature.

## Migration

Solidity:

```solidity
address signer = ecrecover(hash, v, r, s);
require(signer == expected);
```

SolidCash - supply the public key as a witness and compare the address (locking bytecode):

```solidity
address signer = ecrecover(hash, sig, pubKey);   // pubKey provided by the unlocker
require(signer == expectedP2pkhAddress);         // or: require(signer != 0x) to just assert validity
```

The public key moves from *derived* (Solidity) to *provided and verified* (BCH). This is semantically as strong:
a valid signature over `hash` under `pubKey` proves the signer controls `pubKey`. `ecrecover`'s result is only
useful when compared against an expected value, and you always have that value, so requiring the pubkey witness
costs nothing in practice.

To check an **Ethereum** address rather than a BCH P2PKH script, derive it from the public key with keccak256 -
see "Ethereum addresses".

## Why there is no (v, r, s) form

- BCH exposes signature **verification** (`OP_CHECKDATASIG` takes the public key), not **recovery**. There is no
  elliptic-curve point opcode, so in-script recovery (scalar multiplication, point decompression, modular
  inverse) is infeasible within the VM's cost and size limits.
- **Schnorr cannot recover at all.** Its challenge `e = H(R.x || P || msg)` commits to the public key `P`, so `P`
  cannot be solved for without already knowing it. The recovery id `v` is an ECDSA-only construct; a 64-byte
  Schnorr signature is just `r || s` and carries no `v` and no recovery information.

So `(v, r, s)` does not translate to a BCH signature, and the four-argument call is rejected rather than
emulated.

## Ethereum addresses (variant, out of scope)

The core `ecrecover` returns a BCH P2PKH locking script. To check an Ethereum address, derive it from the
uncompressed public key with the keccak256 builtin:

```solidity
require(checkDataSig(sig, hash, pubKey));
bytes20 ethAddr = bytes20(keccak256(pubKeyXY).split(12)[1]);  // last 20 bytes of keccak256(X || Y)
require(ethAddr == expectedEthAddr);
```

A dedicated `ecrecoverEth` builtin could wrap this. It is noted here for completeness but is not part of this
specification.

## Narrowing an address: uint160(address) and bytes20(address)

A SolidCash `address` is a variable-length locking bytecode, not a fixed 20-byte value like an EVM `uint160`.
For Solidity ports that write `uint160(addr)` or `bytes20(addr)`, those casts are supported as **narrowing**
conversions: they extract the **embedded 20-byte hash** - the P2PKH pubkey-hash at offset 3 of
`0x76a914 <20-byte hash> 0x88ac` - and then yield bytes or an int.

```solidity
address signer = ecrecover(hash, sig, pubKey);   // a P2PKH locking bytecode
bytes20 pkh = bytes20(signer);                    // the signer's 20-byte pubkey-hash
uint160 id = uint160(signer);                     // that hash as a non-negative integer
```

- **`bytes20(address)`** -> the 20-byte hash (`<3> OP_SPLIT OP_NIP <20> OP_SPLIT OP_DROP`).
- **`uint160(address)`** (any unsigned `IntType`) -> the same 20 bytes, then a `0x00` sign byte and `OP_BIN2NUM`,
  so the result is the **non-negative** little-endian value of the hash (without the sign byte, a hash whose top
  bit is set would be a negative number and fail the unsigned bounds check). A signed `intN` target skips the
  sign byte.
- **`bytes(address)`** (unbounded) is unchanged - it keeps the full locking bytecode, not the narrowed hash.

Both narrowing casts emit a compile-time **warning**: the conversion is lossy and assumes the P2PKH form
(offset 3), so for a non-P2PKH address the extracted bytes are not a meaningful 20-byte identity. Compare
addresses as addresses (locking bytecodes) where you can; reach for these casts only for Solidity source
compatibility.

## Security considerations

- **Provide-and-verify, not recover.** The result is only as meaningful as the supplied `pubKey`: the function
  proves `pubKey` signed `hash` and returns `hash160(pubKey)`'s P2PKH script. The caller must compare it to an
  expected value; `ecrecover` does not by itself authorize anything.
- **NULLFAIL is fail-closed.** A forged non-empty signature aborts rather than returning the zero-address
  sentinel. Use an empty `sig` to represent "no signature".
- **Canonical encoding and low-S.** `OP_CHECKDATASIG` requires a valid signature encoding (64-byte Schnorr or
  strict-DER ECDSA) and enforces low-S. Non-canonical or high-S signatures are rejected.
- **Signing domain.** The signed digest is `sha256(hash)`. Reproduce that on the signer side; when porting an
  Ethereum signer, account for the differing digest convention (Ethereum signs the digest directly).
- **Deterministic result.** The P2PKH script is a pure function of `pubKey`; the only variability is success
  vs. empty, so the value cannot be malleated.

## Implementation

| Step | Location |
|------|----------|
| `ECRECOVER = 'ecrecover'` + the arity-3 `Symbol.function(GlobalFunction.ECRECOVER, new AddressType(), [new BytesType(32), DATASIG, PUBKEY])` | `packages/solidc/src/ast/Globals.ts` |
| Map entry (handled in codegen, so empty) | `packages/solidc/src/generation/utils.ts` (`compileGlobalFunction`) |
| Four-argument form: warn + set type `address` (inert `0x`); three-argument form falls through to normal resolution | `packages/solidc/src/semantic/TypeCheckTraversal.ts` (`visitFunctionCall`) |
| Codegen: `visitEcrecover` - 3-arg `OP_CHECKDATASIG` + `OP_IF`/`OP_ELSE` P2PKH build; 4-arg drops args -> `0x` | `packages/solidc/src/generation/GenerateTargetTraversal.ts` |
| Compiler tests: 3-arg emits `OP_CHECKDATASIG` + P2PKH frame; 4-arg compiles, warns, drops to `0x` (no `OP_CHECKDATASIG`) | `packages/solidc/test/PortingFixes.test.ts` |
| SDK e2e: valid sig -> signer P2PKH script; empty sig -> `0x`; wrong-address mismatch rejected; non-empty wrong sig -> NULLFAIL abort | `packages/solidcash/test/e2e/Ecrecover.test.ts` |
| This document | `packages/solidc/docs/ecrecover.md` |
