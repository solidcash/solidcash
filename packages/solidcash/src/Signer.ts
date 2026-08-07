import {
  secp256k1, encodeCashAddress, hexToBin, isHex,
  utf8ToBin, binToBase64, flattenBinArray, bigIntToCompactUint,
} from '@bitauth/libauth';
import { hash160, hash256 } from '@solidcash/utils';
import type NetworkProvider from './network/NetworkProvider.js';
import type { Utxo, UnlockableUtxo } from './interfaces.js';
import { Network } from './interfaces.js';
import { publicKeyToP2PKHLockingBytecode, getNetworkPrefix } from './utils.js';
import SignatureTemplate from './SignatureTemplate.js';

export interface TransactionNonceReservation {
  readonly nonce: bigint;
  commit(): void;
  release(): void;
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

  private _sigTemplate: SignatureTemplate;
  private _addresses: Map<string, string> = new Map();
  private _transactionNonce = 0n;
  private _reservedTransactionNonce = false;

  constructor(privateKey: Uint8Array | string, provider: NetworkProvider) {
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
    return this._sigTemplate.unlockP2PKH();
  }

  /** Get the P2PKH locking bytecode for this signer's address. */
  getLockingBytecode(): Uint8Array {
    return publicKeyToP2PKHLockingBytecode(this.publicKey);
  }

  /** Return a new Signer for the same key bound to a different provider (ethers.js `Signer.connect`). */
  connect(provider: NetworkProvider): Signer {
    const connected = new Signer(this.privateKey, provider);
    connected._transactionNonce = this._transactionNonce;
    return connected;
  }

  /** EVM-compatibility nonce for user-visible transactions initiated by this signer. */
  async getNonce(): Promise<number> { return Number(this._transactionNonce); }

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
