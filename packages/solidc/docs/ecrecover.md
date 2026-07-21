# ecrecover in SolidCash

**Current status: recovery implementation shipped; legacy alias removed.** The 3-argument
`ecrecover(hash, sig, pubKey)` described below was a
verify-with-pubkey operation - it is `checkDataSig(sig, hash, pubKey)` wrapped to return a P2PKH locking
bytecode - **not** public-key recovery. Now that a real, EVM-conformant recovery path exists, this alias is
misleading (it does not recover, Solidity has no 3-argument `ecrecover`, and it duplicates `checkDataSig`). It is
removed. Signature recovery is exposed by `ecrecoverPubKey`, `ecrecoverP2pkh`, and `ecrecoverEvm`; bare Solidity
`ecrecover(hash,v,r,s)` is rewritten to the configured P2PKH or EVM projection only when the compiler's `ecrecover`
option is set, and is otherwise undefined. Migrate verify-with-a-supplied-pubkey to `checkDataSig` directly. See the **"Recovery design
and research (restored)"** appendix at the end of this document ("Removal of the 3-argument verify-with-pubkey
`ecrecover`") for the rationale and the recovery design. The rest of this section describes the deprecated
behavior for reference.

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

> **Superseded.** This section reflects the original conclusion. The "Recovery design and research (restored)"
> appendix at the end of this document reverses it: `(v, r, s)` recovery *is* implementable (pure-script secp256k1
> recovery, feasible at ~1-2 inputs), so the 4-argument form becomes real recovery rather than an inert stub. The
> reasoning below is retained for the record.

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

---
---

# Recovery design and research (restored)

> This appendix is the restored content of `ecrecover-vrs-mapping-research.md` (accidentally deleted), merged
> here per request. It records the design research for real signature recovery. **Design-evolution note:** the
> API design continued past what is captured below. The *final* decisions supersede parts of this research and
> are: (1) recover-to-`pubkey` primitive `ecrecoverPubKey` + explicit projections `ecrecoverP2pkh` (default) /
> `ecrecoverEvm` / bare `ecrecover`; (2) a whole-program compiler flag `ecrecover: p2pkh | evm` (default `p2pkh`)
> applied uniformly via name-dispatch (so buried library `ecrecover` calls, e.g. in OZ `ECDSA.sol`, project
> correctly with no `node_modules` patching); (3) `ecrecoverPubKey` implemented as a keccak-style **compute
> sidecar** (its own input budget, commits `Q`, contract reads it), reusing the block-layout-slot / branded
> covenant / SDK co-spend machinery. The "auto by compare target" and off-chain-recovery framings below are
> earlier steps, retained for the reasoning trail. Cross-domain compares (e.g. keccak-20 vs a P2PKH `msg.sender`)
> are compile-time type errors.

## Part 1 - Is `ecrecover(hash, v, r, s)` mappable to BCH-produced ECDSA signatures?

**Verdict: YES, mappable - for BCH-produced signatures - via recover-off-chain, verify-on-chain** (this was the
first approach; superseded as the *primary* path by pure-script recovery in Part 2, but the crypto facts hold).
The claim "(v, r, s) does not translate to a BCH signature" is accurate only for *on-chain* recovery. Recovery is
a public operation the SDK can do off-chain (libauth `recoverPublicKey*`), and its result is cheaply verifiable
on-chain.

### Why the curves line up

BCH signature operations (`OP_CHECKSIG`, `OP_CHECKDATASIG`, `OP_CHECKMULTISIG`) operate on **secp256k1** for both
ECDSA and BCH-Schnorr. No Ed25519 anywhere in BCH consensus (`bitcoin-cash-node/src/key.h:25`; `pubkey.cpp`
includes `secp256k1.h`/`_recovery.h`/`_schnorr.h`; `sigencoding.cpp` `Scheme::SECP256K1`). Ethereum's `ecrecover`
uses the same curve: the Solidity compiler lowers it to precompile `0x01`
(`solidity/libsolidity/codegen/ExpressionCompiler.cpp:1123`, `{FunctionType::Kind::ECRecover, 1}`) and models it
as an uninterpreted function (`SMTEncoder.cpp:865-873`); the curve binding is in the EVM spec (Yellow Paper
App. E / EIP-2): precompile `0x01` is ECDSA recovery over **secp256k1**. So the `(r, s)` scalars are the same kind
of object on both sides. (EVM's `ecadd`/`ecmul`/`ecpairing` at `0x06`/`0x07`/`0x08` use alt_bn128, not secp256k1,
but those are zkSNARK pairing ops, not signatures, and not Solidity builtins - they do not touch this mapping.)
`secp256k1_recovery.h` is compiled into the node's crypto lib but exposed by NO script opcode - recovery exists
off-chain, not in the VM.

### The mapping

| EVM `ecrecover(h, v, r, s)` | BCH counterpart | basis |
|---|---|---|
| `r`, `s` | the two scalars in a strict-DER ECDSA signature | identical secp256k1; libauth `signatureCompactToDER` |
| `v` (27/28) | libauth `recoveryId` in {0,1}, `v = recoveryId + 27` | `signMessageHashRecoverableCompact` returns it; used off-chain to recover Q |
| recovered address | Q derived off-chain, then hashed on-chain | `recoverPublicKeyUncompressed(r\|\|s, recoveryId, sha256(h))` -> Q; `OP_CHECKDATASIG(DER, h, Q)` authenticates |

### Three load-bearing conditions (off-chain-recovery approach)

1. **Pubkey Q as an extra witness** - BCH has no recovery opcode; the SDK recovers Q off-chain (public, matches
   EVM's "anyone can call ecrecover") and injects it; `OP_CHECKDATASIG(DER, h, Q)` authenticates it. Only real
   structural addition.
2. **Digest = `sha256(h)`, not `h`** - `OP_CHECKDATASIG` verifies over `sha256(message)`
   (`interpreter.cpp`: `CSHA256().Write(vchMessage...).Finalize`). So a BCH-produced signature signs `sha256(h)`.
   An Ethereum/MetaMask signature signs the digest directly -> mismatch (why this approach is scoped to
   BCH-produced). This is exactly the limitation that Part 2 (pure-script) removes.
3. **low-S** - `OP_CHECKDATASIG` requires low-S; the EVM precompile permits high-S. libauth always emits lower-S,
   so this only bites imported foreign high-S signatures.

Security is equivalent to EVM under the universal `require(ecrecover(...) == expected)` pattern.

### Worked example: EIP-2612 permit (off-chain approach)

`require(ecrecover(digest, v, r, s) == owner)`. The owner's wallet signs `sha256(digest)` with recoverable ECDSA;
at spend the relayer recovers `Q = recoverPublicKeyUncompressed(r\|\|s, v-27, sha256(digest))` and injects
`(DER, Q)`; on-chain `OP_CHECKDATASIG(DER, digest, Q)` authenticates, then the EVM-address form
`keccak256(X\|\|Y)[12:]` is compared to `owner`. Same secp256k1 key works on both chains; only the `sha256`
wrapper differs - which Part 2 eliminates.

## Part 2 - Pure-script, EVM-conformant recovery (evaluation)

The stronger goal: implement `ecrecover` as **from-scratch secp256k1 public-key recovery in pure BCH Script**,
detached from `OP_CHECKSIG`/`OP_CHECKDATASIG`, so the result is **bit-for-bit identical to EVM precompile `0x01`**.
No pubkey witness, no `sha256(h)` convention (digest `z = hash` used directly, as EVM), any secp256k1 ECDSA
signature verifies - including a foreign MetaMask / EIP-712 signature.

### Verdict: feasible

Every primitive exists after May 2026 (upgrade12):
- **Loops** - `OP_BEGIN` (`0x65`) / `OP_UNTIL` (`0x66`) (`script.h:68`): the double-and-add ladder without
  unrolling.
- **Functions** - `OP_DEFINE` (`0x89`) / `OP_INVOKE` (`0x8a`) (`script.h:112`; ids <= 7 bytes): `modmul`,
  `pointDouble`, `pointAdd` as subroutines.
- **BigInt** (May 2025) - integers in `[-2^79999+1, 2^79999-1]` (`script.h:261`, 10,000-byte elements). 256-bit
  values and 512-bit products are trivially in range; native `OP_MUL`/`OP_MOD`/`OP_DIV`/`OP_ADD`/`OP_SUB`.

Correctness is not in question (deterministic integer math). The whole feasibility question is **cost**.

### The cost model (verified in source)

- Base cost per opcode: `OPCODE_COST = 100` (`vm_limits.h:36`).
- `OP_MUL`/`OP_MOD`/`OP_DIV`: `quadraticOpCost = len(a) * len(b)` bytes, plus base 100, plus result pushed at 2x
  (`interpreter.cpp:1234`, `1299`, `1311`).
- Per-input budget: `(scriptSigSize + 41) * 800`, scriptSig capped at `MAX_SCRIPT_SIZE = 10,000` -> **~8.03M
  op-cost per input** (`vm_limits.h:49,66`).
- May 2026 raises the standard scriptSig cap from 1,650 to 10,000 bytes (`policy.cpp:82-85`), so the full budget
  is available under standard relay. scriptSig must be push-only (`policy.cpp:94`): recovery logic lives in the
  P2SH32 redeem script; the scriptSig pushes witnesses and its bytes buy budget.

One 256-bit modmul ~= 3,800-4,200 op-cost, so one input affords ~2,000 modmuls.

### Provide-and-verify optimization

`Q = u1*G + u2*R`, dominated by two scalar mults (Jacobian `a=0`: doubling ~7 modmuls, mixed add ~11). The scalar
mults cannot be witnessed away, but expensive-to-compute-cheap-to-verify values are witnessed and checked:
`R.y = modsqrt(r^3+7)` (verify `y^2 == r^3+7` and parity, ~4 vs ~384); `r^-1 mod n` (verify `r*r^-1 == 1`, ~1 vs
~384); `Z^-1 mod p` (verify `Z*Z^-1 == 1`, ~2 vs ~384).

### Measured cost model (`ecrecover-poc/cost-model.mjs`)

Implements the on-chain algorithm (GLV `splitScalar`, 4-way Shamir, Jacobian `a=0`, witnessed inverses/sqrt),
validated against `@noble/curves` AND reproducing the golden EVM address
(`0xa94f5374fce5edbc8e2a8697c15331677e6ebf0b`), with the source-verified BCH op-cost model (fast reduction for
`p = 2^256 - 2^32 - 977`). Measured for one recovery: **2,471 modmuls, 3,848 field add/sub, 127 doublings,
138 mixed-adds.**

| reduction | routing / field-op | EC op-cost | + keccak addr | total | inputs |
|---|---|---|---|---|---|
| fast | 0 (floor) | 7.47M | 0.56M | 8.03M | 1.00 |
| fast | 2 | 8.74M | 0.56M | 9.29M | 1.16 |
| general `OP_MOD` | 0 | 9.33M | - | 9.89M | 1.23 |

Findings: fast reduction is mandatory (general `OP_MOD` alone is 1.23 inputs); the EC arithmetic floor is ~7.47M
(93% of one input); stack routing is the deciding unknown; the keccak address step (0.56M) is only needed for the
Ethereum-address form - the BCH-P2PKH form uses native `OP_HASH160`. Path under one input: window-2 Shamir
(~2,000 modmuls) + P2PKH form (drops keccak) + tight stack scheduling. 2 inputs is comfortable and unconditional.

**Note:** implementing recovery as a compute sidecar (see the design-evolution note above) gives it a *dedicated*
input budget, so this measurement becomes "does recovery fit one sidecar" and the contract input is unburdened.

### Conformance details (must match EVM exactly)

- Digest `z = hash` used directly (no re-hash) - what lets a foreign EVM signature verify.
- The precompile does **not** enforce low-S, so the script must also accept high-S (no low-S guard).
- `v in {27,28}` -> `recid in {0,1}` -> `x = r` (`r < n < p`, always a valid field element).
- Return `address(0)` as a **sentinel, not a script abort** on every EVM-failure path (`r`/`s` out of `[1,n-1]`,
  bad `v`, `x` not on curve, `Q` = infinity), so a ported `require(ecrecover(...) == x)` evaluates false as on EVM.
- Byte order: EVM big-endian; BCH bignums little-endian sign-magnitude. Reverse inputs to LE (0x00 sign byte when
  bit 255 set); reverse outputs back to BE for keccak. Reuse the `encodeWord256` path.

### Recommended staging

1. Field library (functions): `modmul`/`modadd`/`modsub`/`modneg` + verify-helpers for `modinv`/`modsqrt`;
   differential-test each vs a reference (noble/geth/btcec).
2. Group library: `pointDouble`, mixed `pointAdd`, scalar-mult loop; validate `k*G` and `k*R` vs the reference.
3. Full recover + keccak address; check the golden vector plus randomized differential vs geth.
4. Measure actual op-cost -> confirm input count; then fixed-base / wNAF / GLV toward a single input.
5. Wire into the compiler (via the compute-sidecar design), emitting the projection per the `ecrecover: p2pkh|evm`
   flag; keep the cheap `checkDataSig` verify path for verify-with-pubkey.

### Trade-off: off-chain recovery vs pure-script recovery

|  | off-chain recover + CHECKDATASIG | pure-script recovery |
|---|---|---|
| conformance with solc/EVM | no (sha256 convention, pubkey) | yes, bit-for-bit |
| foreign EVM sig (MetaMask/EIP-712) | no | yes |
| pubkey witness required | yes | no |
| cost | ~1 sigcheck (26k) + small | ~8-13M op-cost (1-2 inputs; sidecar isolates it) |

## Conformance requirement: ethers.js == solc == solidc (acceptance gate)

The pure-script recovery is worthless unless bit-for-bit identical to the EVM. This is the acceptance gate for the
`ecrecoverEvm` projection (and bare `ecrecover` in `evm` mode): a subtle byte-order or edge-case bug would
silently recover a different address and break every signature check. It must be a standing differential test.

**Requirement:** for the same message, a signature produced by `ethers.js` must recover to the same address in
ethers.js, Solidity (solc/EVM), and SolidCash (solidc):

1. **Sign with ethers.js**: `wallet.signMessage(msg)` or EIP-712 `signTypedData` -> `signature`;
   `ethers.recoverAddress(digest, signature)` -> `A_ethers`; split into `(v, r, s)`.
2. **Recover in solc/EVM** (hardhat): the `ecrecover(digest, v, r, s)` test contract -> `A_solc`.
3. **Recover in solidc**: `ecrecoverEvm(digest, v, r, s)` -> `A_solidc`.
4. **Assert `A_ethers == A_solc == A_solidc`.**

**Coverage (property/differential):** random keys and messages; `v in {27,28}`; high-S (accepted, no low-S guard);
EVM `address(0)` failure inputs (invalid `v`, `r`/`s` out of `[1, n-1]`, `x` not on curve, point at infinity) must
produce the same zero-address outcome, not abort; the golden vector
(`v=28, r=0x73b1...a5a75f, s=0xeeb9...9c4549`, hash `0x18c547...5d3d1c` -> `0xa94f5374fce5edbc8e2a8697c15331677e6ebf0b`).

**Oracles:** `@noble/curves` and `ethers.js` (JS side, already seeded in `ecrecover-poc/cost-model.mjs`); a real
solc/EVM run (hardhat) is the gold standard for Solidity. Expand the noble differential into the full
ethers.js -> solc -> solidc loop as a permanent regression gate. Also assert projection identities:
`ecrecoverP2pkh(...) == p2pkh(ecrecoverPubKey(...))` and `ecrecoverPubKey(...)` equals the signer's actual
secp256k1 public key.

## Removal of the 3-argument verify-with-pubkey `ecrecover` (it aliased `checkDataSig` - now misleading)

The shipped 3-argument `ecrecover(hash, sig, pubKey)` is **not** recovery. It is `checkDataSig(sig, hash, pubKey)`
wrapped to return a P2PKH locking bytecode (or `0x`). It was introduced only to give a Solidity-shaped name before
real recovery existed. **It is to be removed**, because with real recovery in place it is actively misleading:

- **It does not recover** - it verifies a *supplied* public key; the defining feature of `ecrecover` is that it
  *derives* the signer.
- **Solidity has no 3-argument `ecrecover`** - the arity overload is a SolidCash invention that never helped a
  real port and muddies the name ports actually use (`ecrecover(hash, v, r, s)`).
- **It is redundant** - verify-with-a-supplied-pubkey *is* `checkDataSig`.
- **It collides with the new model** - `ecrecover` now means exactly one thing (EVM-conformant recovery, arity 4)
  with explicit `ecrecoverP2pkh` / `ecrecoverEvm` / `ecrecoverPubKey` projections.

**Migration:** verify a supplied pubkey -> `checkDataSig(sig, hash, pubKey)` directly (signs over `sha256(hash)` as
before); need the P2PKH address from a known pubkey -> `new LockingBytecodeP2PKH(hash160(pubKey))` after the gate;
actually recover a signer from `(v, r, s)` -> the new `ecrecover` / `ecrecoverPubKey` / `ecrecoverP2pkh` /
`ecrecoverEvm`. So `ecrecover` stops being an alias for signature *verification* and becomes solely signature
*recovery*, matching Solidity and eliminating the arity-based double meaning.

## VM-verified implementation + corrected cost (ecrecover-poc/, real BCH-2026 VM)

The JS cost model above was superseded by an actual implementation run on `@bitauth/libauth`'s
`createVirtualMachineBch2026` (the same VM the keccak PoC measures on). The field and group arithmetic were built
in real BCH Script and validated bit-for-bit against `@noble/curves`. Files: `ecrecover-poc/{harness,field,emit,
group}.mjs`.

**Verified on-VM (all PASS vs noble):**
- `modmul` (256-bit) - correct for 400 random + edge cases.
- Jacobian point double (a=0, dbl-2009-l) - 60 random points vs `noble.double()`.
- Jacobian mixed add (madd-2007-bl) - 60 random points vs `noble.add()`.
- loop + `OP_DEFINE`/`OP_INVOKE` + double, computing `2^N*G` (N=10/40/100) vs noble, in a **454-byte** script
  (the loop keeps script size flat regardless of iteration count - unrolling instead blows the 10,000-byte limit).

**Two measured facts that correct the JS estimate:**
1. **Fast reduction LOSES to general `OP_MOD`.** Measured per-modmul: general `OP_MUL`+`OP_MOD` = **4029**;
   1-fold+MOD = 4855; 2-fold+MOD = 6241; full 3-fold fast-reduce = 7855. The `OP_NUM2BIN`/`OP_SPLIT`/`OP_BIN2NUM`
   byte-juggling costs more than the native bignum `OP_MOD`. So the spec's "fast reduction is mandatory" is
   **reversed**: general `OP_MOD` is optimal, and there is no cheaper reduction on this VM.
2. **Point ops cost ~2x their pure-mul count.** Measured: point double = **64193 op-cost** (~16 modmul-equiv,
   though dbl-2009-l is only 7 muls); mixed add = **76702** (~19 vs 11 muls). The extra is the `modadd`/`modsub`
   (conditional-subtract) and the operand-copy juggling - real costs the mul-count model omitted.

**Corrected recovery cost:** GLV + 4-way Shamir uses ~128 doublings + ~138 mixed-adds, so
`128*64193 + 138*76702 = ~18.8M op-cost` unoptimized (~2.3 inputs). But the decisive number is the **pure-mul
floor**: even with *zero* overhead (no operand copies, free `modadd`/`modsub` - counting only the irreducible
`OP_MUL`+`OP_MOD` at 4029 each), a doubling is 7 muls and a mixed-add is 11, so
`128*7*4029 + 138*11*4029 = 3.6M + 6.1M = ~9.7M`. That already **exceeds the 8.03M per-input budget**. A
double-scalar multiply of 256-bit scalars cannot use fewer than ~2200 field multiplications (GLV halves the ladder
to 128 shared doublings, but the two scalars still need ~120+ additions), so **single-input recovery is
mathematically impossible on this VM** - not merely tight. The 128 shared doublings alone (~3.6M pure-mul, ~8.2M as
measured) are already at the budget ceiling.

**Conclusion (definitive): the recovery needs at least 2 sidecar inputs.** The compute sidecar must span ~2 inputs,
checkpointing the double-scalar ladder at a witnessed midpoint (the accumulator point after ~64 bits): input A runs
bits [127:64] from the base points to checkpoint `C`; input B runs bits [63:0] from `C` to `Q`. `C` is committed by
A and consumed by B, both bound to the same `(hash, v, r, s)`. This does not change the sidecar architecture (a
co-spent compute input committing its result), only the block count - analogous to keccak's multi-block model. The
`ecrecover: p2pkh|evm` flag, the `ecrecoverSideCar` block-layout slot, and the branded/self-preserving covenant are
all unchanged; there are simply two chained slots instead of one.

The crypto core is proven; the remaining build is (a) the GLV/Shamir ladder as looped `OP_DEFINE` functions
(the mechanic is verified above), (b) the 2-input checkpoint split, (c) the sidecar covenant wrapping it
(mirroring `keccak-poc/gen-compute-sidecar.mjs`), and (d) compiler/SDK wiring (the keccak-sidecar reuse).

## End-to-end verification (ethers.js -> in-Script recovery -> atomic single-tx)

Two proofs, both green on the real BCH-2026 VM (`ecrecover-poc/recover.mjs`, `ecrecover-poc/atomic.mjs`):

**1. Correctness, end-to-end from a real signature.** `ethers.js` (`Wallet.signMessage`) signs a message; the
`(v, r, s)` and digest are fed to the secp256k1 recovery **running in BCH Script** (the two scalar mults `u1*G`
and `u2*R` via looped `OP_DEFINE` double/add functions, plus the final Jacobian add); the recovered public key's
EVM address (`keccak256(X||Y)[12:]`) is compared to `ethers.recoverAddress`. **They match.** The signature is a
genuine ethers.js signature, and the recovery is genuine in-Script secp256k1 - not a JS reimplementation.

**2. The full recovery, atomic in a single transaction.** Because a single input cannot hold the recovery (the
~9.7M pure-mul floor exceeds the 8.03M per-input budget), it runs as K co-spent inputs in **one transaction**,
checkpoint-chained via **output token commitments**: input j reads the accumulator from `output[j-1]`'s commitment
(`OP_INPUTINDEX OP_1SUB OP_OUTPUTTOKENCOMMITMENT`), runs its chunk of the ladder, and its own `output[j]`
commitment must equal the new accumulator (`OP_INPUTINDEX OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY`). All inputs
validate in the same transaction, so the recovery is atomic. `atomic.mjs` runs the **complete** `Q = u1*G + u2*R`
recovery of a real ethers.js signature this way - a combined 2-way Shamir ladder with the table `{G, R, G+R}`
baked into the per-signature covenant - across 6 co-spent inputs (256-bit scalars, no GLV): all 6 validate
atomically, the final output commits `Q`, and its EVM address matches `ethers.recoverAddress`. The covenant is
~1 KB, each input ~6.2M op-cost (under budget), the accumulator travels as a 99-byte commitment
(`X33||Y33||Z33`), and a **tampered checkpoint is rejected** (`OP_VERIFY` failure) - the chain is sound and fails
closed.

Together these prove the recovery **computes the correct pubkey from a real ethers signature** *and* **runs the
full recovery atomically in one transaction**. What remains is production optimization/wiring, not feasibility:
apply GLV to cut the input count from ~6 to ~3, add the keccak-style branded/self-preserving covenant (integrity +
isolation), optimize the emitter (consume-on-last-use) toward the pure-mul floor, and auto-generate the covenant
and witnesses from the compiler/SDK (the keccak-sidecar reuse).

## Optimizations (6 -> 2 inputs, the theoretical floor)

The recovery was optimized from 6 co-spent inputs to **2**, verified end-to-end against ethers.js on the real VM
at each step (`ecrecover-poc/`):

1. **Emitter liveness optimization** (`emit.mjs`, two-pass). The register-machine now computes last-use and
   **consumes operands on their last use** (`OP_ROLL` the dead value instead of `OP_PICK`-copying it), and
   **inlines** `modmul`/`modadd`/`modsub` (no `OP_INVOKE` overhead). Point double 64193 -> 51307, mixed add
   76702 -> 60777 (~20%), still correct vs noble.
2. **Chunk sizing.** With cheaper ops, each input holds ~70 ladder bits instead of ~46: 6 -> 4 inputs.
3. **GLV endomorphism** (the go-ethereum / libsecp256k1 lesson). Each 256-bit scalar is split into two ~128-bit
   halves (`u2*R = k1*R + k2*phi(R)`, `phi(P)=(beta*Px, Py)`), giving a 4-way Shamir over `{+/-G, +/-phiG, +/-R,
   +/-phiR}` on a **128-bit** ladder - **halving the doubling count**. The 16-entry table is baked into the
   per-signature covenant and selected per bit by a **computed offset** (`mask*66` then `OP_SPLIT`), not a branch
   chain. 4 -> 2 inputs.

**Result:** `atomic.mjs` recovers a real ethers.js signature via full GLV `Q = u1*G + u2*R` across **2 co-spent
inputs in one transaction**, checkpoint-chained, ~7.58M op-cost/input (under the 8.03M cap), covenant ~3.7 KB, the
recovered EVM address matches `ethers.recoverAddress`, and a tampered checkpoint is rejected. Two inputs is the
floor: even the GLV pure-mul minimum (~128 doublings + ~120 adds) is ~8.9M > 8.03M, so a single input is
impossible and two is optimal.

**What does not help (measured):** the special field reduction for `p = 2^256-2^32-977` (loses to native
bignum `OP_MOD`), and a fixed-base precomputed `G` table (the ~128 doublings are shared and driven by the variable
point `R`, which GLV already minimizes). Further gains would come from lazy field reduction (skipping the
conditional subtract in `modadd`/`modsub`, at some correctness-management cost).

## Soundness: binding the recovery to the signature (ecrecover-poc/sound.mjs)

A recovery that computes `Q` from provided masks/table is only sound if those provided values are *bound* to the
actual `(hash, v, r, s)` - otherwise a transaction builder could feed the covenant any pubkey. `sound.mjs` proves
the binding: the covenant verifies every witness **on-chain** and derives the scalars itself, so a forged witness
fails closed. Verified against ethers.js (good case passes; every forgery is rejected):

- `r * r^-1 == 1 (mod n)` - binds the witnessed inverse.
- `Ry^2 == r^3 + 7 (mod p)` and `Ry mod 2 == v-27` - `R = (r, Ry)` is on-curve with the right parity (use
  `Ry mod 2` for parity, not `OP_AND`, which requires equal-length operands).
- `phiR.x == beta * r (mod p)` - binds the endomorphism image.
- `u1 = (-z * r^-1) mod n` derived on-chain, and `u1 == (k1a +/- k1b*lambda) mod n` - binds `u1` and its GLV
  decomposition; same for `u2 = (s * r^-1) mod n`.

Negative tests confirm each forged witness (`r^-1`, `Ry`, parity, `phiR.x`, GLV of `u1`, GLV of `u2`) makes the
covenant reject. So the masks and scalars the ladder consumes are provably the ones for the real signature.

## Complete verified state and the remaining integration

Every cryptographic, atomicity, optimization, and soundness component is now VM-verified against ethers.js
(`ecrecover-poc/`): field arithmetic and Jacobian point ops (vs noble), the full recovery of a real signature
(`recover.mjs`), GLV optimization to 2 inputs (`glv.mjs`), the atomic 2-input checkpoint chain with
tamper-rejection (`atomic.mjs`), and the on-chain witness binding (`sound.mjs`). The fully-sound atomic recovery
assembles these: input 0 runs the binding preamble and builds the 16-entry table on-chain from the verified bases
(`G`, `phiG` constant; `R`, `phiR` verified) via ~11 point-adds (compositions of the proven mixed-add); inputs 0-1
run the GLV 4-way Shamir ladder with masks derived from the verified scalars; the last input commits `Q`; the
contract reads it.

What remains is the compiler/SDK **language integration** - not feasibility, which is settled. It reuses the
keccak-sidecar machinery: `Globals` entries for `ecrecoverPubKey`/`ecrecoverEvm`/`ecrecoverP2pkh`/`ecrecover`, an
`ecrecoverSideCar` block-layout slot band (two chained slots), codegen to read `Q` from the last recovery output's
commitment, and an SDK layer that computes the witnesses and builds the co-spent recovery covenant per signature.
The `ecrecover: p2pkh|evm` projection flag and the 3-argument-alias removal apply at that layer.

## The complete soundness chain (all links VM-verified, forgery-rejected)

The recovery is sound end to end: every value the ladder consumes is provably derived from the real signature,
and tampering at any link fails closed. Proven by composition (`ecrecover-poc/`):

```
(hash, v, r, s)
  --[sound.mjs]-->  verified GLV scalars    (verify r^-1, Ry on-curve+parity, phiR.x=beta*r, u1,u2, GLV split;
                                             all 6 forged witnesses rejected)
  --[full.mjs]-->   verified mask blob       (reconstruct each scalar from the masks on-chain, s_j = sum_i
                                             bit_j(mask_i)*2^(n-1-i), check == verified scalar; tampered mask rejected)
  --[atomic.mjs]--> Q via GLV 4-way Shamir   (2 co-spent inputs, one tx, checkpoint-chained; tampered checkpoint rejected)
  --> keccak256(Q)[12:]  ==  ethers.recoverAddress
```

The mask blob is exactly 128 bytes (one byte per bit of the 128-bit ladder), fitting the token-commitment limit, so
the sound production shape is: commit the mask blob and the four verified scalars in params outputs, verify them
once (bind to the signature and reconstruct-check), and have each ladder input read the committed masks. On-chain
mask *derivation* (the `bit_p` primitive, also verified) is an alternative that needs no witnessed masks.

**Status of the implementation:** the entire cryptographic core, the GLV optimization to the 2-input floor, the
atomic single-transaction structure, and the full soundness chain are implemented and VM-verified against ethers.js.
What remains is purely the compiler/SDK language integration (builtins, block-layout slots, per-signature covenant
and witness auto-generation), which reuses the keccak-sidecar machinery; every component it needs is proven above.

## FINISHED: sound, atomic, 2-input recovery engine (ecrecover-poc/lib.mjs)

The full recovery is assembled into one callable engine, `recover(digest, v, r, s) -> { transaction, Q, address,
valid }`, verified end-to-end against ethers.js (4/4 random signatures) with all forgeries failing closed:

- **One per-signature covenant, 2 co-spent inputs, one transaction.** Input 0 runs the binding preamble; both
  inputs run the GLV 4-way Shamir ladder, checkpoint-chained via output commitments. ~7.8M op-cost/input (under
  the 8.03M cap), covenant ~6.2 KB.
- **On-chain soundness binding.** Input 0 verifies, against the baked `(hash, v, r, s)`: `r*r^-1==1 (mod n)`,
  `Ry^2==r^3+7` with correct parity, `phiR.x==beta*r`, `u1=(-z*r^-1) mod n` and `u2=(s*r^-1) mod n` each equal to
  their GLV recomposition, and - the last gap closed - the mask blob reconstructs to the verified scalars. The
  reconstruction is **one pass** over a packed encoding (`combined = s0 + s1*2^128 + s2*2^256 + s3*2^384`, rebuilt
  via a baked 16-entry term table), which is what keeps input 0 within budget at 2 inputs.
- **Negatives all fail closed** (verified): a forged `Ry`, a tampered mask blob, and a corrupted checkpoint each
  make the covenant reject (`OP_VERIFY`/`OP_EQUALVERIFY`).

This is the production-shaped recovery engine. The only remaining work is the compiler/SDK surface that calls it:
recognizing `ecrecoverPubKey`/`ecrecover`/`ecrecoverEvm`/`ecrecoverP2pkh` in `.scash`, allocating the recovery-input
block-layout slots, emitting the read of `Q`, and having the SDK build the co-spent covenant from the signature -
all thin dispatch over `recover()`, reusing the keccak-sidecar machinery.

## The language feature: a contract authenticates a signer (ecrecover-poc/feature.mjs)

`feature.mjs` demonstrates the end-to-end feature - what codegen emits for `require(ecrecoverPubKey(hash, v, r, s)
== signer)`. In one transaction, a contract input is co-spent with the two recovery inputs and:

1. verifies the co-spent recovery is bound to the contract's own `(hash, v, r, s)` (the recovery covenant hashes,
   read via `OP_UTXOBYTECODE OP_HASH256`, must equal the expected values);
2. reads the recovered `Q` (Jacobian) from the recovery's second output commitment;
3. converts `Q` to affine with a witnessed `Z^-1`, and requires it equal the expected signer.

Verified on 3/3 ethers signatures with a contract expecting the wrong signer rejected. This is the authentication
pattern real contracts use (`require(ECDSA.recover(digest, sig) == owner)`), running on-chain.

## Self-preserving, reusable recovery sidecar (ecrecover-poc/sidecar.mjs)

Per the deployment model, the recovery sidecar is **not** a per-signature covenant - it is a **fixed,
signature-independent covenant pair** that is deployed once (N pairs for N call sites / loop invocations at contract
creation) and **reused on every spend**. `(hash, v, r, s)`, the GLV table, and the mask blob move from *baked* to
*witnessed*. The reusability primitive is a GLV ladder that reads the table from a **witnessed** blob (kept at the
stack bottom, `OP_PICK`ed at constant depth each step) - proven to recover `Q == noble` in the 2-input split.

The pair:

- **Covenant A** (category A) runs `masks[0:HALF]` to a checkpoint `C`, commits `H = hash256(C || masks || table)`
  into its output's NFT commitment, and self-preserves (`OP_INPUTINDEX OP_UTXOBYTECODE == OP_OUTPUTBYTECODE`, and
  the token category is preserved), so the UTXO is recreated for the next spend.
- **Covenant B** (category B) recomputes `H` from copies and checks it against A's output commitment (binding both
  inputs to the *same* table/masks/checkpoint - omission or substitution of any of them fails closed), runs
  `masks[HALF:]` from `C` to `Q`, converts to affine (witnessed `Z^-1`, verifying `Z*Z^-1 == 1`), and commits the
  **compressed** public key (`0x02/0x03 || Qx`, 34 bytes - within the 40-byte CashTokens commitment limit) into
  **the second (last) sidecar output's data-NFT commitment**, and self-preserves.

Verified: the *same fixed covenant pair* recovers two different signatures (reuse), both self-preserve, `Q` lands in
the second output, and a tampered mask blob or checkpoint is rejected by the A->B hash binding. ~7.3M op-cost/input.

**Where the soundness binding lives - on the sidecar, not the master.** The sidecar self-verifies, on its **own**
per-input budget, that its witnessed `(table, masks)` come from the real signature. This is proven end-to-end in
`ecrecover-poc/engine.mjs`: **covenant A reads (hash,v,r,s) and all helpers from the witness and, on-chain, runs the
`wsound.mjs` signature binding (`r*r^-1==1`, `Ry` on-curve + parity, `phiR.x==beta*r`, `u1`/`u2` GLV recomposition),
the witnessed mask reconstruction (bound to the folded recomb terms), the `wtable.mjs` table check (bases derived from
the verified `r`/`Ry`/`phiR.x` + recomb-term signs; 11 affine-add-verified composites), binds the ladder init
(leading masks zero, `acc0 = table[first-nonzero-mask]` derived on-chain), runs its ladder chunk, and produces the
correct checkpoint C** - verified against the JS reference on 4/4 random signatures, with forged `rinv`/`t1a`
rejected. The AAV atom (`aav.mjs`) is proven at 25,822 op-cost (5/5 vs noble + wrong-inverse rejected).

**The full 2-input self-verifying recovery is proven end-to-end in `engine.mjs`, robust across random signatures
(6/6 vs ethers):** input A runs the sig+mask binding + init + its ladder chunk to a checkpoint C; input B verifies the
table + continues the ladder from C + affine-converts + compresses the pubkey - both sound because A and B share one
hash-bound `(table, masks)`, so B's table check catches a forgery even though A used the (same) table. Forged `rinv`
on A and a forged table entry on B are both rejected. Measured costs: sig+mask binding **739K**, table check **420K**
(down to ~285K with the **table pre-split** below), each ladder add-step **~116K**. Both inputs land at **~7.9M**,
under the 8.03M cap.

The margin is real but thin - the 127-step GLV ladder alone is ~14.6M, ~7.3M/input, leaving ~0.7M/input for
verification, and per-signature cost varies with how many of each input's mask bytes are non-zero (each is a point
addition). Three things make it **robust across 40+ random signatures (100%)**:

1. **Table pre-split** - split the 1 KB table blob into 16 stack entries once, then reference 66-byte entries, instead
   of re-splitting the blob on all ~26 table lookups (saves ~135K).
2. **Pre-split ladder** - the ladder loop reuses those 16 entries too, picking `entry[mask]` by a computed stack depth
   (`19 - mask`) each add-step instead of re-splitting the 1 KB blob - the single biggest saving (~120K/input, and it
   is what actually clears the boundary).
3. **Witnessed, SDK-derived `chunkA`** - the split point is a witnessed *liveness* parameter (not soundness: A and B
   agree on it via the A->B hash; a wrong value only makes an input exceed budget = the tx fails to validate, never a
   wrong `Q`). The SDK does **not** estimate it - it **VM-probes**, exactly like auto-derivation already does for other
   witnesses. Because op-cost is a deterministic function of (covenant, witness), the SDK evaluates candidate splits on
   the VM, reads the exact `operationCost`, and binary-searches for the split where both inputs measure under budget
   with the most margin. This is deterministic (same signature -> same split) and cannot pick a non-fitting split.
   `engine.mjs` does exactly this (a real VM-probe, no cost model) and recovers 25/25 random signatures. Each scriptSig
   is also filled to the ~10 000-byte relay cap for the full ~8.03M budget. For the astronomically rare worst-case
   signature (all 127 mask bytes non-zero, ~3e-4) where no 2-input split fits, the probe finds none and the SDK
   escalates to a 3-input ladder - detected, never mis-recovered.

With these, both inputs land around 7.9M with ~60-100K of margin on every signature tested. (The baked per-signature
engine, `lib.mjs`, fits two inputs without any of this because a baked table needs no on-chain verification; the
witnessed reusable covenant pays that ~420K, which the pre-split and the ladder reuse buy back.)

The **master** does not re-verify anything - it would waste its own budget. Following the keccak model exactly, the
master (1) hashes the sidecar's covenant *body* (no arguments) and checks it against the baked, trusted covenant
hash - so it trusts the self-verifying recovery code; (2) reads the `(hash, v, r, s)` arguments from the sidecar's
unlocking and binds them equal to the ones it provided (`OP_EQUALVERIFY`); (3) copies `Q` from the sidecar's second
output commitment back into itself. Integrity-hash + arg-bind + one read - nothing more.

## Compiler / SDK integration (mirrors the keccak compute sidecar) - WIRED, builds green

The integration is built and compiles across both packages (mirroring the keccak compute sidecar; the
`blockhashOracle` self-preserving read-only slot is the closest structural sibling):

- **Builtins** (`packages/solidc/src/ast/Globals.ts`): `ecrecoverPubKey` -> `pubkey`, `ecrecoverP2pkh` -> `address`,
  `ecrecoverEvm` -> `bytes20`, each `(bytes32, int, bytes32, bytes32)`. No grammar change. **Done.**
- **AST + artifact** (`AST.ts`, `@solidcash/utils` `artifact.ts`): `ecrecoverCompute`/`ecrecoverArgParams`/
  `ecrecoverCallCount` on the function; `'ecrecoverSideCar'` `BlockSlotKind`; the ABI fields emitted in `Artifact.ts`.
  **Done** - a contract using `ecrecoverPubKey` compiles and the artifact carries `ecrecoverCompute: true` +
  `ecrecoverArgParams: [["h","v","r","s"]]`.
- **Detection + block layout** (`SymbolTableTraversal.ts`): `countEcrecoverCalls` sets `ecrecoverCompute`;
  `computeBlockLayout` reserves an A+B slot pair per call (slotIndex 2i / 2i+1). **Done.**
- **Codegen** (`GenerateTargetTraversal.ts` `emitEcrecoverComputeCall`): builds `argBlob = hash||v||r||s`, reads
  side-car A's unlocking to bind ITS argBlob == ours, integrity-checks both covenants (`hash256(covenant) == baked`),
  reads the pubkey from B's output commitment, and projects (p2pkh = `hash160` wrap). Stateful contracts use the
  block-layout slots; stateless read count-relative (last 2N inputs). **Done.**
- **SDK witness math** (`packages/solidcash/src/ecrecover/ecrecoverRecovery.ts`): `computeEcrecoverWitness` ports the
  proven GLV recovery (splitScalar, sign-adjusted table, mask stream, affine-add inverses, cumulative checkpoints,
  compressed Q). **Done - verified `Q == ethers` on random signatures.**
- **SDK co-spend** (`ecrecover/ecrecoverComputeSidecar.ts` + `TransactionBuilder.addRequiredEcrecoverComputeCoSpends`,
  invoked in `send()`): resolves each call's `(hash,v,r,s)`, computes the witness, sizes the split, and co-spends the
  A (checkpoint) + B (pubkey) side-cars. **Done - builds green.**
- **utils covenant library** (`packages/utils/src/ecrecover-compute-library.ts`): the A/B redeem/locking/commitment
  builders + the baked covenant hashes. **Done - the REAL production covenant hexes are in.** They are generated by
  `ecrecover-poc/gen-ecrecover-sidecar.mjs`: the proven `engine.mjs` verification + GLV ladder wrapped with the
  blob-structured unlocking (`<pad><argBlob><shared><witnessBlob><redeem>`), a leading salt brand-check (the P2SH
  redeem is `0x20||salt||covenant`, so the covenant runs with the 32-byte salt on top - dropped when SHARED, else
  input-0's category is verified), the A->B checkpoint-hash commit, and self-preservation. covA = 7482 B, covB = 3353 B.

## SHIPPED end-to-end (compiler + SDK + VM) - 2026-07-20

The full path validates on the real BCH-2026 VM. `packages/solidcash/test/e2e/EcrecoverRecovery.test.ts` (8 tests,
all green, no regression against the keccak co-spend infra or the old `ecrecover`):

- **positive** - a contract `require(ecrecoverPubKey(h,v,r,s) == owner)` spends: ethers signs, the SDK reverses
  big-endian -> BCH-native little-endian, `computeEcrecoverWitness` derives the witnesses, the `TransactionBuilder`
  auto-co-spends the A+B pair (deployed as P2SH32 at `ecrecoverComputeLockingBytecode(salt, 'A'|'B')`), and the
  contract binds + copies the recovered pubkey.
- **negative** - a different baked `owner` is rejected (the copied Q != owner).
- **CONFORMANCE** - `ethers.recoverPublicKey`/`computeAddress` == the SDK recovery == the address Solidity's
  `ecrecover` returns, for multiple signatures. This is the acceptance gate from the conformance section above.
- **0 / 1 / N / branch** - a function with no `ecrecoverPubKey` needs no side-car; one call co-spends one pair; two
  calls co-spend two pairs (each result read by its block slot); a call inside an `if` authenticates when taken.
- **ecrecoverP2pkh** - the recovered pubkey projected to `0x76a914 || hash160(pubkey) || 0x88ac` (the signer's BCH
  P2PKH locking bytecode).

**Standard pubkey shape.** `ecrecoverPubKey` returns a STANDARD compressed pubkey (`0x02/03 || Qx` big-endian, 33 B) -
so it is checkSig-able and compares directly to a `pubkey` literal or an `ethers` public key. Side-car B commits the
recovered key as 34 B (parity || Qx as a 33-byte LITTLE-endian VM number, the BCH-native form the covenant computes);
the codegen normalizes that to the 33-byte big-endian standard on read (split parity, drop the LE sign/pad byte,
`OP_REVERSEBYTES` the 32-byte Qx, re-prepend parity). `ecrecoverP2pkh` hash160s that standard key.

**Deterministic split via VM-probe** (`TransactionBuilder.probeEcrecoverSplit`): the viable `chunkA` window is narrow
(~[58,60] and signature-dependent), so the SDK builds the A+B pair in isolation and measures both covenants' real
op-cost across candidate splits, choosing the viable split with the lowest peak. op-cost is a pure function of
(covenant, witness), so this is reproducible; a wrong split only fails to spend, it can never produce a wrong `Q`.

## ecrecoverEvm (SHIPPED) - the 20-byte EVM address

`ecrecoverEvm(hash,v,r,s)` recovers the signer's EVM address (== ethers/Solidity `ecrecover`): the SDK exposes the
uncompressed recovered key and co-spends a keccak compute side-car over it (reusing the existing keccak machinery),
appended AFTER all recovery pairs. The contract reads that side-car's preimage P, BINDS `compress(P) == Q` (the
recovered compressed key, so the keccak is over the genuine key - a wrong P fails the bind, a wrong Qy yields a wrong
address), integrity-checks the keccak covenant, and takes `keccak256(P)[12:]` as the 20-byte address. The E keccak
side-cars trail the 2N recovery pairs, so recovery offset-from-end shifts by E and each evm call reads its keccak
side-car at offset E-j. e2e-verified (positive == the ethers wallet address; negative rejected).

## Loops (SHIPPED) - the general dynamic model

`for (i<n) ecrecoverPubKey(h[i],..)` works for ANY bound - runtime OR compile-time - via the keccak-style dynamic-loop
model (no unrolling). A per-iteration counter pushed before `OP_BEGIN` indexes the recovery PAIR forward at
`[master+1+2*counter]` (A) / `[master+2+2*counter]` (B); the recovery covenants already self-preserve via
`OP_INPUTINDEX` (input idx == output idx), so the same forward covenant serves every iteration. The counter increments
each iteration. The codegen records the loop args as `"h[]"` (array-indexed by the loop variable) and the SDK
(`addStatelessEcrecoverLoopCoSpends`) co-spends N = the sig-array length pairs, spliced forward right after the master.
Sound: each iteration BINDS its pair's argBlob == `(h[k],v[k],r[k],s[k])`, so a wrong/missing pair fails closed
(a wrong iteration signature is rejected). e2e-verified with both a fixed bound and a runtime bound (`for (i<n)`, N=3).

One subtlety the keccak loop does not have: ecrecover CATs its 4 args into a single `argBlob`, so the codegen keeps
the stack tracker in sync with the VM (`popFromStack` after the CATs and after the arg-bind) so the counter's
`OP_PICK` depth stays exact across iterations.

**Per-iteration integrity is a cheap `OP_UTXOBYTECODE` compare, not covenant re-hashing.** A loop verifies each pair
is genuine by `OP_UTXOBYTECODE(idx) == <baked shared P2SH lock>` (35-byte compare), NOT by reading + `hash256`-ing the
~7.4 KB / ~3.3 KB A/B covenants every iteration. P2SH already binds `hash256(redeem)` to the lock, so this is exactly
as sound. It also lets the loop skip reading B's unlocking entirely (B is needed only for its integrity + its output
Q). This cut the per-iteration op-cost from ~381 K to ~133 K, lifting the master's **op-budget cap from ~3 to ~15**
iterations. Loop side-cars are therefore always shared-salt (`ECRECOVER_COMPUTE_A_SHARED_LOCK` / `_B_SHARED_LOCK`,
computed constants); branding is not needed for soundness (the argBlob bind + A->B hash chain secures the result).

**The binding wall is now the 100 KB standard tx size, not the op-budget.** Each recovery co-spends ~20 KB of side-car
unlockings (each ~10 KB of op-budget pad, which funds that covenant's own ~8 M-op ladder half - unavoidable), so a
STANDARD (relayable) tx tops out at ~4-5 recoveries. Larger loops are consensus-valid but need direct-to-miner
submission (up to the op-budget cap of ~15). e2e-verified: fixed-bound, runtime-bound N=3, and N=4 (past the old cap).

## Stateful contracts (SHIPPED)

A stateful contract (with storage) authenticates via `ecrecoverPubKey` too. The recovery pair is BRANDED to the
contract's token category (the covenant/resolve use the reversed category, matching `OP_UTXOTOKENCATEGORY`'s internal
byte order), positioned at the `ecrecoverSideCar` block-layout slots (A = slot 2i, B = slot 2i+1), and threaded through
auto-derivation - `StatefulContract._resolveEcrecoverComputeCoSpends` (mirrors `_resolveKeccakComputeCoSpends`: find
the A/B UTXOs, compute the witness, VM-probe the split, build the pair) feeds both the derivation probe (`runProbe`, so
the state derives while the master reads the pair) and the final tx, where `StatefulTransactionBuilder` places the A/B
inputs at the slots and their recreations (A commits H_A, B commits Q) at the matching output slots. The split probe
runs with the SHARED salt (op-cost is salt-independent) because the isolated 2-input probe has no consuming contract at
input 0 for a branded brand-check. e2e-verified: a stateful contract authenticates a signer AND increments its state.

**Status of the former follow-ups (all resolved):**
- The 3-argument verify-with-pubkey `ecrecover(hash, sig, pubKey)` alias has been **REMOVED** (it aliased
  `checkDataSig` + a P2PKH projection, misleading now that native recovery exists). `ecrecover(...)` is now an
  undefined reference; use `ecrecoverPubKey` to recover, or `checkDataSig` to verify against a known pubkey.
- `ecrecoverEvm` **inside a loop** is now **SHIPPED**. Each iteration co-spends a recovery pair AND a keccak side-car,
  laid out forward at stride 3: A = `[master+3k+1]`, B = `[master+3k+2]`, K = `[master+3k+3]` (all self-preserving via
  `OP_INPUTINDEX`). The keccak side-car rides the STATEFUL covenant (forward self-preserving) at the shared salt; its
  integrity is checked by `OP_UTXOBYTECODE == KECCAK256_COMPUTE_STATEFUL_SHARED_LOCK` (the unambiguous cheap compare
  that also sidesteps a stateless-vs-stateful covenant-hash mixup). The recovered `Q` (pubkey33) is an untracked stack
  item during the preimage read, so the keccak index PICK is one deeper (`extra = 1`) until the compress-bind consumes
  it. e2e-verified: N=3 recovers each signer's EVM address; an imposter iteration is rejected.

**Split probe**: `costA` rises with `chunkA` (side-car A runs more ladder steps) and `costB` falls; each covenant's
~8 M op-budget (capped by the 10,000-byte scriptSig consensus limit) covers only ~60-70 of the ~127 ladder steps, so
the viable window (both under budget) is THIN - width ~1-7 - and sits at nearly the same place for every signature
(`chunkA ~= 0.462*L`, empirically 54-61, because A carries more fixed overhead: the GLV-table check). The probe
**seeds the search at that calibrated center and spirals out**, using the cost monotonicity (first A-over caps the
high edge, first B-over the low edge) to stop as soon as both edges are known - a handful of VM evals (~3x faster than
the earlier binary-search-from-`[1,maxCA]`, which occasionally misconverged around the thin window). It returns the
min-peak (max budget margin) split; every returned split is VM-verified viable. The stateless and stateful paths share
the one `probeEcrecoverSplit`.

**Known limit - "width-0" signatures (~2%).** A minority of signatures have a GLV ladder so long (high-Hamming-weight
decomposition) that NO 2-covenant split fits both 8 M budgets - the window closes to zero. These fail closed with a
clear error (re-sign to get a different, shorter decomposition; for a loop, the SDK skips them via the same probe).
This is a pre-existing property of the 2-covenant design; a 3-covenant split (each ~L/3 steps, huge margin) would
close the gap but triples the side-car count. It does not affect soundness, only liveness for those rare signatures.
