import { secp256k1, encodeCashAddress, hexToBin, isHex } from '@bitauth/libauth';
import { hash160 } from '@solidcash/utils';
import type NetworkProvider from './network/NetworkProvider.js';
import type { Utxo, UnlockableUtxo } from './interfaces.js';
import { Network } from './interfaces.js';
import { publicKeyToP2PKHLockingBytecode } from './utils.js';
import SignatureTemplate from './SignatureTemplate.js';

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

    const prefix = net === Network.MAINNET ? 'bitcoincash' : 'bchtest';
    const result = encodeCashAddress(
      { prefix, type: 'p2pkh', payload: this.pkh, throwErrors: true },
    );
    this._addresses.set(net, result.address);
    return result.address;
  }

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
}
