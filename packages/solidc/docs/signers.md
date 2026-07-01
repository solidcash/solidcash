# Signers

A **signer** encapsulates a key (or key tree) and answers two questions the SDK needs to move value:
"what address do I control?" and "sign this." On an account chain (Ethereum) a signer maps to one account;
on a UTXO chain (Bitcoin Cash) it maps to one P2PKH key that funds and unlocks inputs. This doc records how
ethers and hardhat model signers, what our `Signer` does today, and how an **HD signer** (BIP-32/BIP-39
hierarchical-deterministic wallet) would be built on top of it.

## 1. Our `Signer` today (single-address)

`packages/solidcash/src/Signer.ts` wraps one private key. It is the ethers `Wallet` analogue: a single key,
a single P2PKH address.

| Member | Behavior |
| --- | --- |
| `new Signer(privateKey \| WIF \| hex, provider)` | Parses hex/`0x`hex/WIF into a 32-byte key; derives `publicKey` (compressed) and `pkh = hash160(pubkey)`. |
| `getAddress(network?)` | P2PKH CashAddr for the network (cached per network). |
| `getUtxos()` | `provider.getUtxos(getAddress())` - the signer's spendable coins. |
| `unlockP2PKH()` | A `SignatureTemplate` unlocker for spending the signer's inputs. |
| `getLockingBytecode()` | P2PKH locking bytecode for the signer's address. |
| `connect(provider)` | New `Signer`, same key, different provider (ethers `Signer.connect`). |
| `signMessage(msg)` / `static hashMessage(msg)` | Standard BCH "Bitcoin Signed Message" - base64 recoverable-compact signature over the magic-prefixed hash256 digest. |
| `getNonce`, `estimateGas`, `call`, `populateCall`, `populateTransaction`, `sendTransaction`, `signTransaction`, `signTypedData`, `resolveName`, `populateAuthorization`, `authorize` | Stubbed - throw "no equivalent on Bitcoin Cash (UTXO)". Present only for ethers surface parity. |

Why the stubs: BCH has no account nonces, gas, `eth_call`, ENS, EIP-712 typed data, or EIP-7702
authorizations. A contract spend is assembled by the `TransactionBuilder` / `StatefulContract` (which own the
covenant, the inputs, and the sighash), and the signer contributes funding inputs + P2PKH unlockers. So on BCH
a "signer" is a funding-and-unlocking identity, not a transaction submitter. See
[stateful-contract-sdk.md](./stateful-contract-sdk.md) for how a signer plugs into `ContractFactory`/`connect`.

`fundedSigner()` (test-util) is the pre-funded test analogue of hardhat's `getSigners()` - a `Signer` on a
fresh mock provider seeded with genesis-valid funding UTXOs. It is single-key today; an HD signer would let one
mnemonic back many funded test accounts.

## 2. ethers.js reference model

Class hierarchy (`/Code/ethers.js/src.ts/`):

```
Signer (interface)          providers/signer.ts        - the abstract contract
   |  implements
AbstractSigner (abstract)   providers/abstract-signer.ts - shared populate/broadcast plumbing; VoidSigner
   |  extends
BaseWallet                  wallet/base-wallet.ts        - ONE SigningKey + address; local signing
   |  extends                    |  extends
Wallet                      HDNodeWallet                 wallet/hdwallet.ts  <- the HD signer
wallet/wallet.ts            (+ HDNodeVoidWallet, xpub-only, extends VoidSigner)
```

`Wallet` and `HDNodeWallet` are **siblings**, both extending `BaseWallet`. `Wallet.createRandom()` and
`Wallet.fromPhrase()` in fact return `HDNodeWallet` instances.

- **`AbstractSigner`** leaves five things abstract - the ones that actually need a key: `getAddress`,
  `connect`, `signTransaction`, `signMessage`, `signTypedData`. Everything else (`populateTransaction`, nonce/
  gas/fee filling, `sendTransaction` = populate -> sign -> broadcast) is provided on top. This is the split we
  mirror: a tiny key-bound core, shared plumbing above it.
- **`BaseWallet`** is the minimal single-key signer: holds a `SigningKey`, derives `address =
  computeAddress(publicKey)` (Ethereum: Keccak-256 of the uncompressed pubkey, last 20 bytes, EIP-55). Signs by
  `signingKey.sign(digest)`. **This address step is the one Ethereum-specific line** - BCH swaps it for
  `hash160(compressed pubkey) -> CashAddr`.
- **`HDNodeWallet`** (the HD signer) extends `BaseWallet`, so it *is* a full signer, plus BIP-32 structure:
  fields `chainCode`, `path`, `index`, `depth`, `parentFingerprint`, `fingerprint =
  hash160(compressedPubKey)[0:4]`, optional `mnemonic`.
  - Master: `HMAC-SHA512(key="Bitcoin seed", seed) -> IL||IR` (IL = master key, IR = chain code). The literal
    key `"Bitcoin seed"` is used unchanged by Ethereum.
  - Child (`ser_I`): hardened index -> `0x00 || priv`, normal -> `serP(compressed pub)`, append `ser32(index)`,
    `HMAC-SHA512(chainCode, data) -> IL||IR`; private child `ki = (IL + k_par) mod n`, public (neutered) child
    `Ki = IL*G + K_par`.
  - Factories: `fromPhrase(phrase, password?, path?)`, `fromMnemonic`, `fromSeed`, `createRandom`,
    `fromExtendedKey`. Default path `m/44'/60'/0'/0/0` (coin type 60 = ETH).
  - `neuter() -> HDNodeVoidWallet`: strips the private key, keeps pubkey + chainCode + path, so it can still
    derive **child addresses** (xpub / watch-only) but not sign. `VoidSigner` is the address-only pattern
    (all sign methods throw).
  - Extended keys: Base58Check over `version||depth||parentFingerprint||index||chainCode||keydata` (xprv
    `0x0488ADE4`, xpub `0x0488B21E`) - BCH uses the same version bytes.
- **`Mnemonic`** (BIP-39): `computeSeed()` = `PBKDF2(NFKD(phrase), salt="mnemonic"+password, 2048 iters, 64B,
  SHA-512)`. Entropy<->phrase is the 11-bit-word + SHA-256 checksum scheme. Chain-agnostic - identical for BCH.
- **N accounts from one mnemonic**: two idioms - `getAccountPath(i)` = `m/44'/60'/i'/0/0` (Ledger, increments
  the hardened account) and `getIndexedAccountPath(i)` = `m/44'/60'/0'/0/i` (MetaMask, increments the final
  address index). The efficient batch is to derive the branch `m/44'/60'/0'/0` **once**, then `deriveChild(i)`
  per account (one HMAC each) rather than re-running the whole path (incl. PBKDF2) per index.

## 3. hardhat reference model

`/Code/hardhat/packages/hardhat-ethers/`. Hardhat's signers are RPC-delegating, because the node holds the
keys:

- **`getSigners()`** (`hardhat-helpers.ts`) = `provider.send("eth_accounts")` -> wrap each returned address in a
  `HardhatEthersSigner`. The mnemonic -> N-addresses expansion happens **node-side** from the resolved
  `accounts` config; the ethers layer just lists and wraps them. `getSigner(address)` wraps one.
- **`HardhatEthersSigner`** (`signers.ts`) structurally *implements* `ethers.Signer & { address }` (it does not
  extend `AbstractSigner`). Signing is delegated to the node: `sendTransaction -> eth_sendTransaction`,
  `signMessage -> personal_sign`, `signTypedData -> eth_signTypedData_v4`, `signTransaction -> throws`. Only
  EIP-7702 `authorize()` signs locally, and only then does it lazily recover a private key.
- **Local HD derivation** (`derive-private-key.ts`, used lazily): BIP-39 `mnemonicToSeedSync` + BIP-32
  `HDKey.fromMasterSeed(seed).derive(path + "/" + i)`, looping `i in [initialIndex, initialIndex+count)`.
- **Default accounts config** (hardhat core): `{ initialIndex: 0, count: 20, path: "m/44'/60'/0'/0",
  passphrase: "" }`, plus the in-process EDR mnemonic `"test test test test test test test test test test test
  junk"`, each account funded 10000 ETH. That config expands to the 20 canonical hardhat accounts.

**The key difference for us**: hardhat delegates signing to a node that custodies keys; we (like ethers
`Wallet`/`HDNodeWallet`) sign **locally**. So our HD signer follows the ethers `HDNodeWallet` shape, and our
`getSigners()`-equivalent derives the keys itself rather than asking a node.

## 4. What maps to Bitcoin Cash

Everything above the address/signature encoding is chain-neutral, and libauth already ships all of it (verified
importable from `@bitauth/libauth`):

| Layer | Chain-neutral? | libauth primitive |
| --- | --- | --- |
| BIP-39 mnemonic -> seed (PBKDF2-HMAC-SHA512, 2048) | yes | `deriveSeedFromBip39Mnemonic(mnemonic, { passphrase })` |
| BIP-39 generate / validate / entropy<->phrase | yes | `generateBip39Mnemonic`, `decodeBip39Mnemonic`, `encodeBip39Mnemonic`, `bip39WordListEnglish` |
| BIP-32 master node (`HMAC-SHA512("Bitcoin seed", seed)`) | yes | `deriveHdPrivateNodeFromSeed(seed)` |
| BIP-32 path / child derivation | yes | `deriveHdPath(node, "m/...")`, `deriveHdPathRelative(node, "0/1")` |
| xprv / xpub Base58Check (same `0x0488ADE4`/`0x0488B21E`) | yes | `encodeHdPrivateKey`, `decodeHdPrivateKey`, `encodeHdPublicKey`, `decodeHdPublicKey` |
| Neuter (private node -> public node, watch-only) | yes | `deriveHdPublicNode(privateNode)` |
| **Address** = `hash160(compressed pubkey)` -> **CashAddr** | **BCH-specific** | our `Signer` already does this (`pkh` + `encodeCashAddress`) |
| **Signature** = per-input sighash (BIP-143), not an ETH tx | **BCH-specific** | our `SignatureTemplate` / `TransactionBuilder` already do this |
| **Coin type** `145` (SLIP-44 = Bitcoin Cash), path `m/44'/145'/0'/0/i` | **BCH-specific** | vs ETH's `60` |

A libauth `HdPrivateNodeValid` carries `{ privateKey, chainCode, depth, childIndex, parentFingerprint }`. Since
our `Signer` is built from a raw `privateKey`, an HD signer is just "derive the node, then `super(node.privateKey,
provider)`."

## 5. HD signer (SHIPPED)

Implemented in `packages/solidcash/src/HDSigner.ts` (exported from the SDK entry), tests in
`packages/solidcash/test/e2e/HDSigner.test.ts`. Two deliverables, mirroring the two reference idioms - the
ethers `HDNodeWallet` (one derivable wallet) and the hardhat `getSigners()` (N accounts from one mnemonic).
`HDSigner extends Signer`, so it inherits address derivation, `getUtxos`, `unlockP2PKH`, `signMessage`, and
`connect` unchanged - it only adds BIP-32 structure. The sketch below matches the shipped API (the real
path field is `derivationPath`; `fromPhrase`/`signersFromMnemonic` validate the phrase via
`decodeBip39Mnemonic` and throw on a bad mnemonic). The xprv/xpub network follows the provider: a `mainnet`
provider yields `xprv`/`xpub`, every test network (`mocknet`/`testnet*`/`regtest`) yields `tprv`/`tpub`.

```ts
// packages/solidcash/src/HDSigner.ts  (proposed)
import {
  deriveSeedFromBip39Mnemonic, deriveHdPrivateNodeFromSeed, deriveHdPath, deriveHdPathRelative,
  deriveHdPublicNode, generateBip39Mnemonic, encodeHdPrivateKey, decodeHdPrivateKey,
  type HdPrivateNodeValid, type HdPublicNodeValid,
} from '@bitauth/libauth';
import Signer from './Signer.js';
import type NetworkProvider from './network/NetworkProvider.js';

// SLIP-44 coin type 145 = Bitcoin Cash. BIP-44 external-receive chain.
export const BCH_DEFAULT_HD_PATH = "m/44'/145'/0'/0/0";   // account 0, first address
export const BCH_ACCOUNT_BRANCH  = "m/44'/145'/0'/0";     // derive once, then child i per account

export class HDSigner extends Signer {
  readonly node: HdPrivateNodeValid;   // chainCode / depth / childIndex / privateKey
  readonly path: string | null;        // null when built from an xprv (path not encoded)
  readonly mnemonic?: string;

  private constructor(node: HdPrivateNodeValid, provider: NetworkProvider, path: string | null, mnemonic?: string) {
    super(node.privateKey, provider);  // reuse all of Signer: address, utxos, unlock, signMessage
    this.node = node; this.path = path; this.mnemonic = mnemonic;
  }

  static fromPhrase(mnemonic: string, provider: NetworkProvider,
                    path = BCH_DEFAULT_HD_PATH, passphrase?: string): HDSigner {
    const seed = deriveSeedFromBip39Mnemonic(mnemonic, { passphrase });
    const node = deriveHdPath(deriveHdPrivateNodeFromSeed(seed), path);   // master (depth 0) -> path
    return new HDSigner(node, provider, path, mnemonic);
  }

  static fromSeed(seed: Uint8Array, provider: NetworkProvider, path = BCH_DEFAULT_HD_PATH): HDSigner {
    return new HDSigner(deriveHdPath(deriveHdPrivateNodeFromSeed(seed), path), provider, path);
  }

  static createRandom(provider: NetworkProvider, path = BCH_DEFAULT_HD_PATH): HDSigner {
    return HDSigner.fromPhrase(generateBip39Mnemonic(), provider, path);  // 12-word English
  }

  static fromExtendedKey(xprv: string, provider: NetworkProvider): HDSigner {
    const { node } = decodeHdPrivateKey(xprv);   // path/mnemonic are not encoded in an xprv
    return new HDSigner(node as HdPrivateNodeValid, provider, null);
  }

  /** Relative child (one HMAC): "0" or "0'" hardened. */
  deriveChild(index: number): HDSigner {
    const child = deriveHdPathRelative(this.node, String(index)) as HdPrivateNodeValid;
    return new HDSigner(child, this.provider, this.path ? `${this.path}/${index}` : null);
  }

  /** xprv for backup / re-import (network from the provider). */
  get extendedKey(): string {
    return encodeHdPrivateKey({ node: this.node, network: hdNetwork(this.provider.network) });
  }

  /** Watch-only: derive child ADDRESSES from the xpub, no signing. */
  neuter(): HDPublicSigner {
    return new HDPublicSigner(deriveHdPublicNode(this.node), this.provider, this.path);
  }
}

// hardhat getSigners() analogue: N funded accounts from ONE mnemonic. Derives the account branch ONCE,
// then deriveChild(i) per account - one HMAC each, not a full re-derivation per index.
export function signersFromMnemonic(
  mnemonic: string, provider: NetworkProvider,
  opts: { path?: string; initialIndex?: number; count?: number; passphrase?: string } = {},
): HDSigner[] {
  const { path = BCH_ACCOUNT_BRANCH, initialIndex = 0, count = 20, passphrase } = opts;
  const seed = deriveSeedFromBip39Mnemonic(mnemonic, { passphrase });
  const branch = deriveHdPath(deriveHdPrivateNodeFromSeed(seed), path);   // once
  return Array.from({ length: count }, (_, k) => {
    const i = initialIndex + k;
    const child = deriveHdPathRelative(branch, String(i)) as HdPrivateNodeValid;
    return (HDSigner as any)._fromNode(child, provider, `${path}/${i}`);  // internal ctor shim
  });
}
```

`HDPublicSigner` (watch-only) wraps an `HdPublicNodeValid`: `getAddress()` = `hash160(node.publicKey) ->
CashAddr` (the same code path as `Signer`, minus the key), `deriveChild(i)` for normal (non-hardened) indices,
`getUtxos()` to watch a balance. It cannot sign - the ethers `HDNodeVoidWallet` parallel. Useful for
receive-only address gap-scanning and balance monitoring from an xpub.

### Design decisions

1. **`HDSigner extends Signer`** - reuse address/utxo/unlock/signMessage/connect; add only BIP-32 structure.
   (ethers does the same: `HDNodeWallet extends BaseWallet`.)
2. **Default path `m/44'/145'/0'/0/0`** (coin type 145 = BCH). Parametrizable; testnet wallets that use coin
   type `1'` can pass an explicit path. `hdNetwork(provider.network)` maps `mainnet -> 'mainnet'`, everything
   else -> `'testnet'` for xprv/xpub version bytes.
3. **Ship both idioms**: `HDSigner.fromPhrase(...).deriveChild(i)` (ethers) and `signersFromMnemonic(...)`
   (hardhat `getSigners`). The batch helper derives the account branch once.
4. **Watch-only `neuter()`** now, not later - libauth's `deriveHdPublicNode` makes it a few lines, and xpub
   address-scanning is a real BCH need.
5. **Tests**: rebuild `fundedSigner()` on `signersFromMnemonic` so one mnemonic backs the pre-funded test
   accounts (closer to hardhat's default-mnemonic 20-account setup); keep the funded-UTXO seeding.

### Phasing (all DONE)

- **P1 - `HDSigner`**: `fromPhrase`/`fromSeed`/`createRandom`/`fromExtendedKey`, `deriveChild`, `extendedKey`,
  `neuter`, `connect`. Reuses `Signer` for everything else. DONE.
- **P2 - `signersFromMnemonic`** (getSigners analogue, `{ path, initialIndex, count, passphrase }`). DONE.
- **P3 - `HDPublicSigner`** (watch-only xpub: `getAddress`/`getUtxos`/`deriveChild`/`extendedKey`/
  `fromExtendedKey`). DONE.

All three are additive - no change to the existing `Signer` surface, and `HDSigner` is a drop-in `Signer`
anywhere a runner is accepted (verified: `getContractFactory(artifact, hdSigner).deploy()` funds + deploys).
18 tests green (structural + libauth cross-check + xprv/xpub round-trips + getSigners agreement + watch-only +
drop-in runner + `getSigners`).

### `getSigners()` - the hardhat `ethers.getSigners()` analogue (test-util)

The famous entry point `const [owner, addr1, addr2] = await getSigners()` returns pre-funded signers.
Hardhat's version reads them from a funded local node; ours (in `test/test-util.ts`) is the faithful parallel
for the mock/regtest provider: it derives accounts from the **same default mnemonic hardhat uses**
(`DEFAULT_TEST_MNEMONIC = "test test test test test test test test test test test junk"`, a valid BIP-39
phrase) via `signersFromMnemonic`, and pre-funds each with a genesis-valid UTXO on a shared provider. Each
returned signer is an `HDSigner`, i.e. a drop-in `ContractFactory` runner.

- `getSigners(count = 20, { provider?, satoshis?, mnemonic?, fundingUtxos? })` - N pre-funded signers.
- `getSigner(index = 0, { provider?, satoshis? })` - one pre-funded signer at `index`.
- `fundedSigner(count = 1, satoshis?)` - the account-0 shortcut (rebuilt on the above), with `count` funding
  UTXOs for a test that deploys repeatedly.

`getSigners` and `fundedSigner` derive from the default mnemonic, so a test's funded identities are
deterministic across runs (the hardhat property). SDK-side, the primitive under all of them is
`signersFromMnemonic`; funding is inherently a test/local-node concern, so it lives in test-util.
