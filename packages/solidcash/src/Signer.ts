import { decodeCashAddress, encodeCashAddress } from '@bitauth/libauth/build/lib/address/cash-address.js';
import { secp256k1 } from '@bitauth/libauth/build/lib/crypto/default-crypto-instances.js';
import { binToBase64 } from '@bitauth/libauth/build/lib/format/base64.js';
import { binToHex, hexToBin, isHex, flattenBinArray } from '@bitauth/libauth/build/lib/format/hex.js';
import { bigIntToCompactUint } from '@bitauth/libauth/build/lib/format/number.js';
import { utf8ToBin } from '@bitauth/libauth/build/lib/format/utf8.js';
import { hash160, hash256 } from '@solidcash/utils';
import type NetworkProvider from './network/NetworkProvider.js';
import type { Utxo, UnlockableUtxo } from './interfaces.js';
import { Network } from './interfaces.js';
import { publicKeyToP2PKHLockingBytecode, getNetworkPrefix } from './utils.js';
import SignatureTemplate from './SignatureTemplate.js';
import { externallySignedUnlocker, type ExternalTransactionSigner } from './external-signing.js';

export interface TransactionNonceReservation {
  readonly nonce: bigint;
  commit(): void;
  release(): void;
}

// Reads of a signer's nonce precede the create addresses its deployments will land at: one getNonce() call is
// followed by four getCreateAddress predictions, so one read reserves that window of genesis-eligible UTXOs.
const CREATE_LOOKAHEAD_WINDOW = 4;

/**
 * A signer whose key a wallet holds: the SDK composes with a placeholder in the wallet's inputs and the wallet signs
 * them over `bch_signTransaction` when the transaction is broadcast (./external-signing.ts). It is named by its P2PKH
 * address or public key hash; a wallet that shares its public key lets the placeholder carry it.
 */
export interface ExternalSignerIdentity {
  readonly wallet: ExternalTransactionSigner;
  /** The wallet's P2PKH CashAddress, on any network: its payload names the account. */
  readonly address?: string;
  /** The wallet's public key hash, when no address is given. */
  readonly pkh?: Uint8Array;
  /** The wallet's compressed public key, when the wallet shares it. */
  readonly publicKey?: Uint8Array;
  /** Shown by the wallet beside each transaction it is asked to sign. */
  readonly userPrompt?: string;
}

function isExternalIdentity(value: unknown): value is ExternalSignerIdentity {
  return typeof value === 'object' && value !== null && !(value instanceof Uint8Array) && 'wallet' in value;
}

function pkhOfIdentity(identity: ExternalSignerIdentity): Uint8Array {
  if (identity.pkh !== undefined) {
    if (identity.pkh.length !== 20) throw new Error('An external signer\'s public key hash is 20 bytes.');
    return identity.pkh;
  }
  if (identity.address !== undefined) {
    const decoded = decodeCashAddress(identity.address);
    if (typeof decoded === 'string') throw new Error(`An external signer's address does not decode: ${decoded}`);
    if (decoded.type !== 'p2pkh' && decoded.type !== 'p2pkhWithTokens') {
      throw new Error(`An external signer's address must be P2PKH, not ${decoded.type}.`);
    }
    return decoded.payload;
  }
  if (identity.publicKey !== undefined) return hash160(identity.publicKey);
  throw new Error('An external signer needs its wallet\'s address, public key hash or public key.');
}

/** Keep a secret field readable and omit it from enumeration, JSON, and default logs. */
function hideSecret(target: object, key: string): void {
  const value = (target as Record<string, unknown>)[key];
  Object.defineProperty(target, key, {
    value, enumerable: false, writable: false, configurable: true,
  });
}

/**
 * A signer encapsulates a private key and provides:
 * - P2PKH address derivation (for UTXO lookup)
 * - P2PKH unlocking (for spending funder inputs)
 * - UTXO lookup via a network provider
 *
 * Analogous to ethers.js `Signer` / `Wallet`.
 *
 * ```typescript
 * const signer = new Signer(alicePriv, provider);
 * const sc = StatefulContract.withCategory(contract, categoryId);
 * await sc.connect(signer).call.increment().send();
 * ```
 */
export default class Signer {
  readonly privateKey: Uint8Array;
  readonly publicKey: Uint8Array;
  readonly pkh: Uint8Array;
  readonly provider: NetworkProvider;

  private _sigTemplate: SignatureTemplate | undefined;
  /** Set when a wallet holds the key (`Signer.external`). */
  private _external: ExternalSignerIdentity | undefined;
  private _addresses: Map<string, string> = new Map();
  private _transactionNonce = 0n;
  private _reservedTransactionNonce = false;
  private _createWindowReserved = false;

  /** A signer whose key a wallet holds and which signs over `bch_signTransaction` (see ExternalSignerIdentity). */
  static external(identity: ExternalSignerIdentity, provider: NetworkProvider): Signer {
    return new Signer(identity, provider);
  }

  constructor(privateKey: Uint8Array | string | ExternalSignerIdentity, provider: NetworkProvider) {
    if (isExternalIdentity(privateKey)) {
      this.provider = provider;
      this._external = privateKey;
      this.pkh = pkhOfIdentity(privateKey);
      this.publicKey = privateKey.publicKey ?? new Uint8Array(0);
      Object.defineProperty(this, 'privateKey', {
        enumerable: false,
        configurable: true,
        get: (): never => {
          throw new Error('This signer\'s key is held by its wallet; it signs through bch_signTransaction.');
        },
      });
      return;
    }
    if (typeof privateKey === 'string') {
      const maybeHex = privateKey.startsWith('0x')
        ? privateKey.slice(2) : privateKey;
      if (isHex(maybeHex) && maybeHex.length === 64) {
        this.privateKey = hexToBin(maybeHex);
      } else {
        // WIF or other format - delegate to SignatureTemplate for parsing
        this.privateKey = new SignatureTemplate(privateKey).privateKey;
      }
    } else {
      this.privateKey = privateKey;
    }

    this.provider = provider;
    this._sigTemplate = new SignatureTemplate(this.privateKey);
    this.publicKey = secp256k1.derivePublicKeyCompressed(this.privateKey) as Uint8Array;
    this.pkh = hash160(this.publicKey);
    hideSecret(this, 'privateKey');
  }

  /** True when a wallet holds this signer's key and signs its inputs at broadcast. */
  get isExternal(): boolean {
    return this._external !== undefined;
  }

  /** JSON and logs keep the address material and omit the private key. */
  toJSON(): { readonly publicKey: string } {
    return { publicKey: binToHex(this.publicKey.length > 0 ? this.publicKey : this.pkh) };
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return this._external === undefined
      ? `Signer { publicKey: ${binToHex(this.publicKey)} }`
      : `Signer { external pkh: ${binToHex(this.pkh)} }`;
  }

  /** Get the signer's P2PKH address for a given network. */
  getAddress(network?: Network): string {
    const net = network ?? this.provider.network;
    const cached = this._addresses.get(net);
    if (cached) return cached;

    const prefix = getNetworkPrefix(net);
    const result = encodeCashAddress(
      { prefix, type: 'p2pkh', payload: this.pkh, throwErrors: true },
    );
    this._addresses.set(net, result.address);
    return result.address;
  }

  /** ethers-parity sync alias for {@link getAddress}() (the default-network CashAddress). */
  get address(): string { return this.getAddress(); }

  /** Fetch available UTXOs at this signer's P2PKH address. */
  async getUtxos(): Promise<Utxo[]> {
    return this.provider.getUtxos(this.getAddress());
  }

  /** Create a P2PKH unlocker for spending inputs at this signer's address. */
  unlockP2PKH(): UnlockableUtxo['unlocker'] {
    if (this._external !== undefined) {
      return externallySignedUnlocker({
        lockingBytecode: this.getLockingBytecode(),
        signer: this._external.wallet,
        ...(this._external.publicKey === undefined ? {} : { publicKey: this._external.publicKey }),
        ...(this._external.userPrompt === undefined ? {} : { userPrompt: this._external.userPrompt }),
      });
    }
    return this._sigTemplate!.unlockP2PKH();
  }

  /** Get the P2PKH locking bytecode for this signer's address. */
  getLockingBytecode(): Uint8Array {
    if (this._external !== undefined) return Uint8Array.of(0x76, 0xa9, 0x14, ...this.pkh, 0x88, 0xac);
    return publicKeyToP2PKHLockingBytecode(this.publicKey);
  }

  /** Return a new Signer for the same key bound to a different provider (ethers.js `Signer.connect`). */
  connect(provider: NetworkProvider): Signer {
    const connected = new Signer(this._external ?? this.privateKey, provider);
    connected._transactionNonce = this._transactionNonce;
    return connected;
  }

  /** True while a deploy holds a nonce reservation; a seeding hook must not clear it. */
  get transactionNonceReserved(): boolean {
    return this._reservedTransactionNonce;
  }

  /** EVM-compatibility nonce for user-visible transactions initiated by this signer. */
  async getNonce(): Promise<number> {
    // Once per signer: a caller that reads a nonce is about to create contracts, and the first read reserves the
    // genesis-eligible UTXOs its predictions need. The import is lazy so this module does not load the deployment
    // graph (which reaches Signer back) at startup.
    if (!this._createWindowReserved) {
      this._createWindowReserved = true;
      try {
        const { topUpCreateLookahead } = await import('./framed/deploy/create-lookahead-session.js');
        await topUpCreateLookahead(this, CREATE_LOOKAHEAD_WINDOW);
      } catch {
        // Best-effort: a nonce read is not always followed by a create, and the pool may be short.
      }
    }
    // Learn the next free CREATE slot from the chain before reporting it, so the number predicts this process's and
    // a fresh process's next deployment. The hook is a no-op while a reservation is active.
    await this.provider.prepareSigner?.(this);
    return Number(this._transactionNonce);
  }

  /** Reserve one logical transaction nonce across any subordinate BCH transactions. */
  reserveTransactionNonce(): TransactionNonceReservation {
    if (this._reservedTransactionNonce) {
      throw new Error(`Signer transaction nonce ${this._transactionNonce} is already reserved.`);
    }
    this._reservedTransactionNonce = true;
    const nonce = this._transactionNonce;
    let active = true;
    return {
      nonce,
      commit: (): void => {
        if (!active) return;
        active = false;
        this._reservedTransactionNonce = false;
        this._transactionNonce = nonce + 1n;
      },
      release: (): void => {
        if (!active) return;
        active = false;
        this._reservedTransactionNonce = false;
      },
    };
  }

  /** Snapshot hook used by mock-network fixtures. */
  _getTransactionNonceState(): bigint { return this._transactionNonce; }

  /** Restore hook used by mock-network fixtures and explicit compatibility setup. */
  _setTransactionNonceState(nonce: bigint): void {
    if (nonce < 0n) throw new Error('Transaction nonce cannot be negative.');
    this._transactionNonce = nonce;
    this._reservedTransactionNonce = false;
  }

  /** The "Bitcoin Signed Message" double-SHA256 digest for a message (magic-prefixed, length-delimited). */
  static hashMessage(message: string | Uint8Array): Uint8Array {
    const msg = typeof message === 'string' ? utf8ToBin(message) : message;
    const magic = utf8ToBin('Bitcoin Signed Message:\n');
    return hash256(flattenBinArray([
      bigIntToCompactUint(BigInt(magic.length)), magic,
      bigIntToCompactUint(BigInt(msg.length)), msg,
    ]));
  }

  /**
   * Sign a message with this key in the standard Bitcoin Cash "signed message" format: a base64 recoverable
   * compact signature over hashMessage(message). Analogous to ethers.js `Signer.signMessage`.
   */
  signMessage(message: string | Uint8Array): string {
    if (this._external !== undefined) {
      throw new Error('This signer\'s key is held by its wallet: sign messages with the wallet\'s bch_signMessage.');
    }
    const result = secp256k1.signMessageHashRecoverableCompact(this.privateKey, Signer.hashMessage(message));
    if (typeof result === 'string') throw new Error(`Failed to sign message: ${result}`);
    const header = 31 + result.recoveryId; // 27 + 4 (compressed pubkey) + recoveryId
    return binToBase64(flattenBinArray([Uint8Array.of(header), result.signature]));
  }

  // The following ethers.js Signer members have no Bitcoin Cash (UTXO) equivalent - there are no account nonces,
  // gas, eth_call, ENS, EIP-712 typed data or EIP-7702 authorizations. They are present for surface parity and
  // throw a clear error. Use SignatureTemplate / the (Stateful)TransactionBuilder to sign and broadcast.
  private static _na(method: string): never {
    throw new Error(
      `Signer.${method}() has no equivalent on Bitcoin Cash (UTXO). Build and sign transactions with the `
      + 'TransactionBuilder / StatefulContract and SignatureTemplate instead.',
    );
  }

  estimateGas(): Promise<bigint> { return Signer._na('estimateGas'); }

  call(): Promise<string> { return Signer._na('call'); }

  populateCall(): Promise<never> { return Signer._na('populateCall'); }

  populateTransaction(): Promise<never> { return Signer._na('populateTransaction'); }

  resolveName(): Promise<null | string> { return Signer._na('resolveName'); }

  sendTransaction(): Promise<never> { return Signer._na('sendTransaction'); }

  signTransaction(): Promise<string> { return Signer._na('signTransaction'); }

  signTypedData(): Promise<string> { return Signer._na('signTypedData'); }

  populateAuthorization(): Promise<never> { return Signer._na('populateAuthorization'); }

  authorize(): Promise<never> { return Signer._na('authorize'); }
}
