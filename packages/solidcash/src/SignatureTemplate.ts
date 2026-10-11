import { secp256k1 } from '@bitauth/libauth/build/lib/crypto/default-crypto-instances.js';
import { hexToBin, isHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { decodePrivateKeyWif } from '@bitauth/libauth/build/lib/key/wallet-import-format.js';
import { hash256, scriptToBytecode } from '@solidcash/utils';
import {
  type GenerateUnlockingBytecodeOptions,
  SighashType,
  SignatureAlgorithm,
  type P2PKHUnlocker,
} from './interfaces.js';
import { createSighashPreimage, publicKeyToP2PKHLockingBytecode, toSigningSerializationType } from './utils.js';

export default class SignatureTemplate {
  public privateKey: Uint8Array;

  /** The 33-byte compressed public key that corresponds to the template's private key. */
  get publicKey(): Uint8Array {
    return secp256k1.derivePublicKeyCompressed(this.privateKey) as Uint8Array;
  }

  constructor(
    signer: Keypair | Uint8Array | string,
    public readonly sighashType: SighashType = SighashType.SIGHASH_ALL | SighashType.SIGHASH_UTXOS,
    public readonly signatureAlgorithm: SignatureAlgorithm = SignatureAlgorithm.SCHNORR,
  ) {
    if (isKeypair(signer)) {
      const wif = signer.toWIF();
      this.privateKey = decodeWif(wif);
    } else if (typeof signer === 'string') {
      const maybeHexString = signer.startsWith('0x') ? signer.slice(2) : signer;
      if (isHex(maybeHexString)) {
        this.privateKey = hexToBin(maybeHexString);
      } else {
        this.privateKey = decodeWif(maybeHexString);
      }
    } else {
      this.privateKey = signer;
    }

    if (this.privateKey.length !== 32) {
      throw new Error(`Invalid private key: expected 32 bytes, got ${this.privateKey.length} bytes`);
    }

    // Validate hash type base value (lower 5 bits, excluding flags)
    const baseHashType = sighashType & 0x1f;
    if (baseHashType !== SighashType.SIGHASH_ALL
      && baseHashType !== SighashType.SIGHASH_NONE
      && baseHashType !== SighashType.SIGHASH_SINGLE) {
      throw new Error(`Invalid hash type base value: 0x${baseHashType.toString(16).padStart(2, '0')}`);
    }

    const allowedHashTypeBits = 0x1f | SighashType.SIGHASH_UTXOS | SighashType.SIGHASH_ANYONECANPAY;
    const unknownBits = sighashType & ~allowedHashTypeBits;
    if (unknownBits !== 0) {
      throw new Error(`Invalid hash type flags: unknown bits 0x${unknownBits.toString(16).padStart(2, '0')}`);
    }
    if ((sighashType & SighashType.SIGHASH_UTXOS) !== 0
      && (sighashType & SighashType.SIGHASH_ANYONECANPAY) !== 0) {
      throw new Error('Invalid hash type flags: SIGHASH_UTXOS and SIGHASH_ANYONECANPAY cannot be combined');
    }

    // L5: SIGHASH_NONE/SINGLE (and the ANYONECANPAY flag) do not commit to all outputs and/or all inputs, so the
    // counterparty or a bot can malleate the transaction (redirect outputs, add/remove inputs). The default
    // (SIGHASH_ALL | SIGHASH_UTXOS) is safe; warn on the opt-in unsafe modes so they aren't selected by accident.
    const anyoneCanPay = (sighashType & SighashType.SIGHASH_ANYONECANPAY) !== 0;
    if (baseHashType !== SighashType.SIGHASH_ALL || anyoneCanPay) {
      console.warn(
        `Warning: SignatureTemplate uses a non-default sighash (0x${sighashType.toString(16)}). `
        + 'SIGHASH_NONE/SINGLE/ANYONECANPAY do not commit to all outputs/inputs, so the transaction can be '
        + 'malleated by a counterparty. Prefer the default SIGHASH_ALL | SIGHASH_UTXOS unless you need otherwise.',
      );
    }
  }

  /** Sign a sighash and append the signing serialization type byte (the sighash type plus the fork id flag). */
  generateSignature(payload: Uint8Array): Uint8Array {
    const signature = this.signMessageHash(payload);
    return Uint8Array.from([...signature, toSigningSerializationType(this.sighashType)]);
  }

  signMessageHash(payload: Uint8Array): Uint8Array {
    const signature = this.signatureAlgorithm === SignatureAlgorithm.SCHNORR
      ? secp256k1.signMessageHashSchnorr(this.privateKey, payload) as Uint8Array
      : secp256k1.signMessageHashDER(this.privateKey, payload) as Uint8Array;

    return signature;
  }

  /** @deprecated Use the `sighashType` property; this adds the fork id flag unless `bchForkId` is `false`. */
  getHashType(bchForkId: boolean = true): number {
    return bchForkId ? toSigningSerializationType(this.sighashType) : this.sighashType;
  }

  /** @deprecated Use the `signatureAlgorithm` property. */
  getSignatureAlgorithm(): SignatureAlgorithm {
    return this.signatureAlgorithm;
  }

  /** @deprecated Use the `publicKey` property. */
  getPublicKey(): Uint8Array {
    return this.publicKey;
  }

  unlockP2PKH(): P2PKHUnlocker {
    const { publicKey } = this;
    const prevOutScript = publicKeyToP2PKHLockingBytecode(publicKey);

    return {
      generateLockingBytecode: () => prevOutScript,
      generateUnlockingBytecode: ({ transaction, sourceOutputs, inputIndex }: GenerateUnlockingBytecodeOptions) => {
        const preimage = createSighashPreimage(
          transaction, sourceOutputs, inputIndex, prevOutScript, this.sighashType,
        );
        const sighash = hash256(preimage);
        const signature = this.generateSignature(sighash);
        const unlockingBytecode = scriptToBytecode([signature, publicKey]);
        return unlockingBytecode;
      },
      template: this,
    };
  }
}

// Works for both bitcoincash.js/bchjs ECPair and bitcore-lib-cash PrivateKey
interface Keypair {
  toWIF(): string;
}

function isKeypair(obj: any): obj is Keypair {
  return typeof obj.toWIF === 'function';
}

function decodeWif(wif: string): Uint8Array {
  const result = decodePrivateKeyWif(wif);

  if (typeof result === 'string') {
    throw new Error(result);
  }

  return result.privateKey;
}
