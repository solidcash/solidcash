import { hash160 } from '@solidcash/utils';
import {
  deriveHdPrivateNodeFromSeed,
  deriveHdPath,
  secp256k1,
  encodeCashAddress,
  deriveSeedFromBip39Mnemonic,
  type HdPrivateNodeValid,
} from '@bitauth/libauth';
import SignatureTemplate from 'solidcash/dist/SignatureTemplate.js';

export interface Signer {
  /** Compressed public key (33 bytes) */
  pubkey: Uint8Array;
  /** Private key (32 bytes) */
  privateKey: Uint8Array;
  /** RIPEMD160(SHA256(pubkey)) -- 20 bytes */
  pkh: Uint8Array;
  /** CashAddress with token support (bchtest: prefix) */
  address: string;
  /** Create a SignatureTemplate for this account */
  sign(): SignatureTemplate;
}

const DEFAULT_MNEMONIC = 'SolidCash Testing Framework';
const BASE_PATH = "m/44'/145'/0'/0";

let cachedSigners: Signer[] | undefined;
let cachedMnemonic: string | undefined;
let cachedCount: number | undefined;

function deriveSigners(mnemonic: string, count: number): Signer[] {
  const seed = deriveSeedFromBip39Mnemonic(mnemonic);
  const rootNode = deriveHdPrivateNodeFromSeed(seed, { assumeValidity: true, throwErrors: true });

  const signers: Signer[] = [];
  for (let i = 0; i < count; i++) {
    const node = deriveHdPath(rootNode as HdPrivateNodeValid, `${BASE_PATH}/${i}`);
    if (typeof node === 'string') throw new Error(`HD derivation failed at index ${i}: ${node}`);

    const pubkey = secp256k1.derivePublicKeyCompressed(node.privateKey) as Uint8Array;
    const pkh = hash160(pubkey);
    const address = encodeCashAddress({
      prefix: 'bchtest',
      type: 'p2pkhWithTokens',
      payload: pkh,
      throwErrors: true,
    }).address;

    signers.push({
      pubkey,
      privateKey: node.privateKey,
      pkh,
      address,
      sign: () => new SignatureTemplate(node.privateKey),
    });
  }

  return signers;
}

/**
 * Get pre-derived test signers (like Hardhat's `ethers.getSigners()`).
 * Returns 10 deterministic signers by default. Results are cached.
 *
 * @param count Number of signers to derive (default: 10)
 * @param mnemonic BIP39 mnemonic phrase (default: 'SolidCash Testing Framework')
 */
export function getSigners(count: number = 10, mnemonic: string = DEFAULT_MNEMONIC): Signer[] {
  if (cachedSigners && cachedCount !== undefined && cachedCount >= count && cachedMnemonic === mnemonic) {
    return cachedSigners.slice(0, count);
  }

  cachedSigners = deriveSigners(mnemonic, count);
  cachedMnemonic = mnemonic;
  cachedCount = count;
  return cachedSigners;
}
