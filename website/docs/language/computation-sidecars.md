---
title: Computation Sidecars and Result NFTs
sidebar_label: Computation Result NFTs
---

Bitcoin Cash has native SHA and signature-verification opcodes, but no Keccak opcode or secp256k1 public-key
recovery opcode. SolidCash implements `keccak256` and the `ecrecover*` family with co-spent **computation
sidecars**.

A sidecar is a self-preserving covenant UTXO carrying a mutable NFT. It performs expensive work in its own input
evaluation budget and writes the result into its recreated NFT commitment. The consuming contract binds the
sidecar's arguments, verifies its covenant identity, and reads the result from the matching output.

These are sometimes called **result NFTs**. They are not event NFTs or function-return NFTs:

| NFT | Purpose | Lifetime |
|---|---|---|
| Computation result NFT | Working register for Keccak/recovery | Mutable and recreated for reuse |
| Event NFT | Application log | Immutable; cleanup after its CSV delay |
| Return-event NFT | Disposable typed call result | Immutable; consumer may spend it |

## Compute-and-commit flow

For `bytes32 result = keccak256(preimage)`, one transaction contains:

```text
input i:  consumer contract             output i:  consumer recreation
input k:  keccak sidecar(preimage)      output k:  same sidecar, commitment = result
```

The combined proof has four parts:

1. The consumer verifies the revealed sidecar is the compiler-selected covenant.
2. The consumer decodes the sidecar input and checks that its preimage equals the expression being hashed.
3. The sidecar recomputes Keccak and pins its own recreation, category, mutable capability, and result commitment.
4. The consumer reads the commitment from the exact output slot.

An attacker cannot replace the sidecar with an arbitrary result UTXO: its revealed covenant and argument would
fail the consumer's checks. Computation is off the consumer's stack, but it remains consensus-verified on chain.

## Keccak sidecars

```solidity
contract RoleGate(bytes32 expectedRole) {
    function enter(bytes roleName) {
        require(keccak256(roleName) == expectedRole);
    }
}
```

Literal Keccak expressions are folded by the compiler. Runtime expressions use sidecars. Current sidecars can
commit up to three ordered 32-byte digests when their combined Keccak block cost fits; a Keccak block covers at
most 135 preimage bytes, and one input can fund at most three blocks. The SDK rejects an over-budget batch before
broadcast.

Straight-line calls are batched in groups of up to three. A runtime loop needs a sidecar per reached iteration
because its call count and argument sequence are discovered progressively. The current stateful loop resolver caps
the runtime count at 64 in addition to transaction input/size limits.

The SDK resolves direct parameters, nested expressions, ABI-packed arguments, stateful calls, and supported
external-call routes from artifact metadata and VM probes. If an expression cannot be reproduced in the probe's
transaction context, derivation fails closed rather than accepting a guessed hash.

## Recovery sidecar pairs

Real `(hash, v, r, s)` recovery is split across two sidecars because the secp256k1 ladder does not fit one input's
operation budget:

```text
A sidecar -> verifies/commits an intermediate checkpoint
B sidecar -> binds A, completes recovery, commits compressed public key Q
consumer  -> binds (hash,v,r,s), reads Q, applies requested projection
```

| Built-in | Result | Sidecars per call |
|---|---|---:|
| `ecrecoverPubKey(h, v, r, s)` | compressed BCH `pubkey` | A + B |
| `ecrecoverP2pkh(h, v, r, s)` | P2PKH locking bytecode (`address`) | A + B |
| `ecrecoverEvm(h, v, r, s)` | last 20 bytes of Keccak(uncompressed key) | A + B + Keccak |

A recovery inside a runtime loop uses a group of three sidecars per iteration, always at the shared salt: A, B,
and Keccak for `ecrecoverEvm`, or A, M, and a final B2 or B3 sidecar for the other two built-ins.
`utils.ecrecoverComputeLockingBytecode` takes each of these roles.

The runtime expects 32-byte `hash`, `r`, and `s` values in SolidCash/BCH little-endian representation and Ethereum
recovery `v` values 27 or 28. Reverse conventional Ethereum big-endian hex before passing it as `bytes32`.

The SDK computes public recovery witnesses off chain, but the A/B covenants verify those witnesses on chain. It VM-
probes candidate A/B split points and selects one where both inputs fit. A small set of valid signatures can have a
ladder shape that does not fit the current pair; the SDK rejects them and the signer must produce another valid
signature.

:::tip
If the public key can be supplied directly, `checkDataSig(signature, message, publicKey)` plus a hash/address check
is far smaller than recovery. Use recovery only when interoperability requires a foreign `(v,r,s)` signature.
:::

## Branding and sidecar variants

Sidecar locking bytecode includes a 32-byte salt:

- A **direct stateful** sidecar is branded to the consuming contract's category. The salt is the category in the
  VM's internal byte order, and the sidecar requires that owning master at input zero.
- A **stateless** sidecar normally uses the all-zero shared salt.
- A sidecar used inside an atomic external-call/message-bus participant can also use the shared salt because that
  participant's master is not transaction input zero. Argument binding and covenant integrity still secure the
  result, but the shared UTXO is not isolated to one application category.
- Keccak has separate self-preservation layouts for ordinary last-region use and stateful/forward slot use. Create
  the variant required by the call path.

The sidecar NFT's **own token category** is separate from its branding salt and from the consuming contract's state
category. Its mutable capability and covenant-locked location matter; the compute covenant preserves whatever
sidecar category it started with.

## Provisioning on a real network

Mock providers can inject some Keccak sidecars during tests. Production providers cannot mint UTXOs, so provision
the pool explicitly before the first call. A single token genesis can create several mutable sidecar NFTs at
different A, B, and Keccak locking bytecodes.

```ts
import { hexToBin } from '@bitauth/libauth';
import { TransactionBuilder, utils } from '@solidcash/solidcash';

const consumerSalt = hexToBin(contract.categoryId).slice().reverse();
const keccakLock = utils.keccakComputeLockingBytecode(consumerSalt, true);
const recoveryALock = utils.ecrecoverComputeLockingBytecode(consumerSalt, 'A');
const recoveryBLock = utils.ecrecoverComputeLockingBytecode(consumerSalt, 'B');

// A plain vout: 0 input creates the sidecar pool's own token category.
const sidecarCategory = sidecarGenesisUtxo.txid;
const builder = new TransactionBuilder({
  provider,
  maximumFeeSatoshis: 20_000n,
});

builder.addInput(sidecarGenesisUtxo, signer.unlockP2PKH());

const addMutableSidecar = (lockingBytecode: Uint8Array): void => {
  builder.addOutput({
    to: lockingBytecode,
    amount: 1200n,
    token: {
      category: sidecarCategory,
      amount: 0n,
      nft: { capability: 'mutable', commitment: '' },
    },
  });
};

// Capacity for two concurrent Keccak calls and one concurrent recovery call.
addMutableSidecar(keccakLock);
addMutableSidecar(keccakLock);
addMutableSidecar(recoveryALock);
addMutableSidecar(recoveryBLock);

builder.addBchChangeOutputIfNeeded({
  to: signer.getAddress(),
  feeRate: 1.0,
});

await builder.send();
```

Use `utils.SHARED_LIBRARY_SALT` instead of `consumerSalt` for a shared/stateless pool, and pass `false` as the
second `keccakComputeLockingBytecode` argument for the ordinary stateless variant. `ecrecoverEvm` also needs a
Keccak result NFT for each recovery; use the variant dictated by whether the call is an ordinary stateless route or
a forward/stateful route.

Provision from artifact usage and expected runtime loop counts, not only source-level function count. If a call
needs more sidecars than the address currently holds, the SDK reports the required and discovered A/B/Keccak counts.

## Capacity and contention

Every transaction consumes and recreates a particular result NFT. Two transactions selecting the same instance
conflict even though both would recreate it. Create enough instances for expected in-flight calls:

- one Keccak instance serves one batch of up to three straight-line calls within its block budget;
- one A+B pair serves one recovery call;
- one shared-salt triple serves one recovery loop iteration (A+B+Keccak for `ecrecoverEvm`, A+M+B2 or B3
  otherwise);
- a runtime loop needs capacity for its maximum simultaneously reached iteration count; and
- shared pools need extra headroom because unrelated applications can select the same UTXOs.

The SDK chooses available UTXOs returned by the provider, but it is not a mempool reservation service. On a
conflict, re-query and rebuild the entire transaction.

## Raw builder control

`TransactionBuilder.send()` automatically scans SolidCash unlockers and adds required Keccak and recovery
co-spends. For a hand-written or computed Keccak argument that artifact metadata cannot resolve, add it explicitly
before sending:

```ts
await builder.addKeccakComputeCoSpend(preimage, { salt });
await builder.send();
```

`build()` and `debug()` are synchronous and cannot perform the network lookup for automatic sidecars. If you need
local bytes first, add required sidecars explicitly (or use the relevant asynchronous `addRequired...` helper)
before building. Stateful pending-call `build()` is asynchronous and performs its own sidecar discovery.

## Operational checklist

- Provision the exact branded/shared and self-preservation variant required by the route.
- Use mutable NFTs and keep every instance at its generated covenant locking bytecode.
- Fund enough independent instances for call batching, loops, and concurrency.
- Monitor sidecar addresses like contract state; an unavailable pool makes dependent calls temporarily unbuildable.
- Treat the result commitment as transient working state, not historical storage.
- Keep fee and finalized-byte caps enabled: sidecar witnesses approach input-size and operation-cost ceilings.
- Test the full call on the target network rules; recovery and long Keccak preimages are budget-sensitive.

See [Cryptography](/docs/language/cryptography) for the source built-ins and
[State Storage](/docs/language/storage-model#events-returns-and-compute-results-are-not-state-fields) for the NFT
taxonomy.
