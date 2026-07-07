import { decodePrivateKeyWif, hexToBin, isHex, secp256k1, SigningSerializationFlag } from '@bitauth/libauth';
import { hash256, scriptToBytecode } from '@solidcash/utils';
import {
  GenerateUnlockingBytecodeOptions,
  HashType,
  SignatureAlgorithm,
  P2PKHUnlocker,
} from './interfaces.js';
import { createSighashPreimage, publicKeyToP2PKHLockingBytecode } from './utils.js';

export default class SignatureTemplate {
  public privateKey: Uint8Array;

  constructor(
    signer: Keypair | Uint8Array | string,
    private hashtype: HashType = HashType.SIGHASH_ALL | HashType.SIGHASH_UTXOS,
    private signatureAlgorithm: SignatureAlgorithm = SignatureAlgorithm.SCHNORR,
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
    const baseHashType = hashtype & 0x1f;
    if (baseHashType !== HashType.SIGHASH_ALL
      && baseHashType !== HashType.SIGHASH_NONE
      && baseHashType !== HashType.SIGHASH_SINGLE) {
      throw new Error(`Invalid hash type base value: 0x${baseHashType.toString(16).padStart(2, '0')}`);
    }

    // L5: SIGHASH_NONE/SINGLE (and the ANYONECANPAY flag) do not commit to all outputs and/or all inputs, so the
    // counterparty or a bot can malleate the transaction (redirect outputs, add/remove inputs). The default
    // (SIGHASH_ALL | SIGHASH_UTXOS) is safe; warn on the opt-in unsafe modes so they aren't selected by accident.
    const anyoneCanPay = (hashtype & HashType.SIGHASH_ANYONECANPAY) !== 0;
    if (baseHashType !== HashType.SIGHASH_ALL || anyoneCanPay) {
      console.warn(
        `Warning: SignatureTemplate uses a non-default sighash (0x${hashtype.toString(16)}). `
        + 'SIGHASH_NONE/SINGLE/ANYONECANPAY do not commit to all outputs/inputs, so the transaction can be '
        + 'malleated by a counterparty. Prefer the default SIGHASH_ALL | SIGHASH_UTXOS unless you need otherwise.',
      );
    }
  }

  generateSignature(payload: Uint8Array, bchForkId?: boolean): Uint8Array {
    const signature = this.signMessageHash(payload);
    return Uint8Array.from([...signature, this.getHashType(bchForkId)]);
  }

  signMessageHash(payload: Uint8Array): Uint8Array {
    const signature = this.signatureAlgorithm === SignatureAlgorithm.SCHNORR
      ? secp256k1.signMessageHashSchnorr(this.privateKey, payload) as Uint8Array
      : secp256k1.signMessageHashDER(this.privateKey, payload) as Uint8Array;

    return signature;
  }

  getHashType(bchForkId: boolean = true): number {
    return bchForkId ? (this.hashtype | SigningSerializationFlag.forkId) : this.hashtype;
  }

  getSignatureAlgorithm(): SignatureAlgorithm {
    return this.signatureAlgorithm;
  }

  getPublicKey(): Uint8Array {
    return secp256k1.derivePublicKeyCompressed(this.privateKey) as Uint8Array;
  }

  unlockP2PKH(): P2PKHUnlocker {
    const publicKey = this.getPublicKey();
    const prevOutScript = publicKeyToP2PKHLockingBytecode(publicKey);
    const hashtype = this.getHashType();

    return {
      generateLockingBytecode: () => prevOutScript,
      generateUnlockingBytecode: ({ transaction, sourceOutputs, inputIndex }: GenerateUnlockingBytecodeOptions) => {
        const preimage = createSighashPreimage(transaction, sourceOutputs, inputIndex, prevOutScript, hashtype);
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
