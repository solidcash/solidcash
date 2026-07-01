import {
  deriveSeedFromBip39Mnemonic, deriveHdPrivateNodeFromSeed, deriveHdPath, deriveHdPathRelative,
  deriveHdPublicNode, generateBip39Mnemonic, decodeBip39Mnemonic,
  encodeHdPrivateKey, decodeHdPrivateKey, encodeHdPublicKey, decodeHdPublicKey, encodeCashAddress,
  type HdPrivateNodeValid, type HdPublicNodeValid, type HdKeyNetwork,
} from '@bitauth/libauth';
import { hash160 } from '@solidcash/utils';
import Signer from './Signer.js';
import type NetworkProvider from './network/NetworkProvider.js';
import type { Utxo } from './interfaces.js';
import { Network } from './interfaces.js';
import { getNetworkPrefix } from './utils.js';

// SLIP-44 coin type 145 = Bitcoin Cash. BIP-44 external-receive chain (change = 0).
export const BCH_DEFAULT_HD_PATH = "m/44'/145'/0'/0/0"; // account 0, first receive address
export const BCH_ACCOUNT_BRANCH = "m/44'/145'/0'/0";    // derive once, then child i per account

/** Map an SDK Network to the BIP-32 xprv/xpub version network (mainnet vs testnet). */
function hdKeyNetwork(network: Network): HdKeyNetwork {
  return network === Network.MAINNET ? 'mainnet' : 'testnet';
}

/**
 * A hierarchical-deterministic (BIP-32 / BIP-39) signer. Extends {@link Signer}, so it derives a P2PKH
 * address, looks up UTXOs, unlocks funder inputs, and signs messages exactly like a single-key signer - it
 * only adds BIP-32 structure on top. The ethers.js `HDNodeWallet` analogue.
 *
 * ```typescript
 * const signer = HDSigner.fromPhrase('legal winner thank year ...', provider);   // m/44'/145'/0'/0/0
 * const account1 = signer.deriveChild(1);
 * const factory = getContractFactory(artifact, signer);
 * ```
 */
export class HDSigner extends Signer {
  readonly node: HdPrivateNodeValid;
  readonly derivationPath: string | null; // null when built from an xprv (path is not encoded)
  readonly mnemonic?: string;

  private constructor(
    node: HdPrivateNodeValid, provider: NetworkProvider, path: string | null, mnemonic?: string,
  ) {
    super(node.privateKey, provider); // reuse Signer: address, utxos, unlock, signMessage, sigTemplate
    this.node = node;
    this.derivationPath = path;
    this.mnemonic = mnemonic;
  }

  /** Internal factory from an already-derived node (used by signersFromMnemonic). */
  static _fromNode(
    node: HdPrivateNodeValid, provider: NetworkProvider, path: string | null, mnemonic?: string,
  ): HDSigner {
    return new HDSigner(node, provider, path, mnemonic);
  }

  /** Derive from a BIP-39 mnemonic phrase (ethers `HDNodeWallet.fromPhrase`). */
  static fromPhrase(
    mnemonic: string, provider: NetworkProvider, path: string = BCH_DEFAULT_HD_PATH, passphrase?: string,
  ): HDSigner {
    const validated = decodeBip39Mnemonic(mnemonic);
    if (typeof validated === 'string') throw new Error(`Invalid BIP-39 mnemonic: ${validated}`);
    const seed = deriveSeedFromBip39Mnemonic(mnemonic, passphrase === undefined ? {} : { passphrase });
    const node = deriveHdPath(deriveHdPrivateNodeFromSeed(seed), path);
    return new HDSigner(node, provider, path, mnemonic);
  }

  /** Derive from a raw BIP-32 seed (no mnemonic attached). */
  static fromSeed(seed: Uint8Array, provider: NetworkProvider, path: string = BCH_DEFAULT_HD_PATH): HDSigner {
    const node = deriveHdPath(deriveHdPrivateNodeFromSeed(seed), path);
    return new HDSigner(node, provider, path);
  }

  /** A fresh, cryptographically-random 12-word wallet (ethers `HDNodeWallet.createRandom`). */
  static createRandom(provider: NetworkProvider, path: string = BCH_DEFAULT_HD_PATH): HDSigner {
    return HDSigner.fromPhrase(generateBip39Mnemonic(), provider, path);
  }

  /** Re-import from an extended private key (xprv). Path and mnemonic are not encoded in an xprv. */
  static fromExtendedKey(xprv: string, provider: NetworkProvider): HDSigner {
    const decoded = decodeHdPrivateKey(xprv);
    if (typeof decoded === 'string') throw new Error(`Invalid extended private key: ${decoded}`);
    return new HDSigner(decoded.node, provider, null);
  }

  /** Derive a relative child node (one HMAC). `index` may be hardened, e.g. `deriveChild("0'")`. */
  deriveChild(index: number | string): HDSigner {
    const node = deriveHdPathRelative(this.node, String(index));
    const path = this.derivationPath === null ? null : `${this.derivationPath}/${index}`;
    return new HDSigner(node, this.provider, path);
  }

  /** The extended private key (xprv) for backup / re-import. */
  get extendedKey(): string {
    return encodeHdPrivateKey({ node: this.node, network: hdKeyNetwork(this.provider.network) }).hdPrivateKey;
  }

  /** Neuter to a watch-only public signer (xpub): derives child addresses, cannot sign. */
  neuter(): HDPublicSigner {
    return new HDPublicSigner(deriveHdPublicNode(this.node), this.provider, this.derivationPath);
  }

  /** Re-bind to a different provider, preserving the HD node (overrides Signer.connect). */
  connect(provider: NetworkProvider): HDSigner {
    return new HDSigner(this.node, provider, this.derivationPath, this.mnemonic);
  }
}

/**
 * Expand one BIP-39 mnemonic into `count` HD signers - the hardhat `getSigners()` analogue. Derives the
 * account branch once, then a single relative child per account (one HMAC each) rather than re-deriving the
 * full path per index.
 */
export function signersFromMnemonic(
  mnemonic: string,
  provider: NetworkProvider,
  opts: { path?: string; initialIndex?: number; count?: number; passphrase?: string } = {},
): HDSigner[] {
  const { path = BCH_ACCOUNT_BRANCH, initialIndex = 0, count = 20, passphrase } = opts;
  const validated = decodeBip39Mnemonic(mnemonic);
  if (typeof validated === 'string') throw new Error(`Invalid BIP-39 mnemonic: ${validated}`);
  const seed = deriveSeedFromBip39Mnemonic(mnemonic, passphrase === undefined ? {} : { passphrase });
  const branch = deriveHdPath(deriveHdPrivateNodeFromSeed(seed), path);
  return Array.from({ length: count }, (_, k) => {
    const index = initialIndex + k;
    const node = deriveHdPathRelative(branch, String(index));
    return HDSigner._fromNode(node, provider, `${path}/${index}`);
  });
}

/**
 * A watch-only signer built from an extended public key (xpub). Derives child ADDRESSES and looks up UTXOs but
 * holds no private key and cannot sign - the neutered analogue of ethers `HDNodeVoidWallet`. Obtain one from
 * {@link HDSigner.neuter} or {@link HDPublicSigner.fromExtendedKey}.
 */
export class HDPublicSigner {
  readonly node: HdPublicNodeValid;
  readonly publicKey: Uint8Array;
  readonly pkh: Uint8Array;
  readonly provider: NetworkProvider;
  readonly derivationPath: string | null;

  private _addresses: Map<string, string> = new Map();

  constructor(node: HdPublicNodeValid, provider: NetworkProvider, path: string | null = null) {
    this.node = node;
    this.publicKey = node.publicKey;
    this.pkh = hash160(this.publicKey);
    this.provider = provider;
    this.derivationPath = path;
  }

  /** Re-import from an extended public key (xpub). */
  static fromExtendedKey(xpub: string, provider: NetworkProvider): HDPublicSigner {
    const decoded = decodeHdPublicKey(xpub);
    if (typeof decoded === 'string') throw new Error(`Invalid extended public key: ${decoded}`);
    return new HDPublicSigner(decoded.node, provider, null);
  }

  /** Get the P2PKH address for a given network (cached per network). */
  getAddress(network?: Network): string {
    const net = network ?? this.provider.network;
    const cached = this._addresses.get(net);
    if (cached) return cached;

    const prefix = getNetworkPrefix(net);
    const { address } = encodeCashAddress({ prefix, type: 'p2pkh', payload: this.pkh, throwErrors: true });
    this._addresses.set(net, address);
    return address;
  }

  /** Fetch available UTXOs at this address (watch-only balance). */
  async getUtxos(): Promise<Utxo[]> {
    return this.provider.getUtxos(this.getAddress());
  }

  /** Derive a normal (non-hardened) child address node. Hardened derivation requires the private key. */
  deriveChild(index: number): HDPublicSigner {
    const node = deriveHdPathRelative(this.node, String(index));
    const path = this.derivationPath === null ? null : `${this.derivationPath}/${index}`;
    return new HDPublicSigner(node, this.provider, path);
  }

  /** The extended public key (xpub). */
  get extendedKey(): string {
    return encodeHdPublicKey({ node: this.node, network: hdKeyNetwork(this.provider.network) }).hdPublicKey;
  }
}
