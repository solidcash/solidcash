import { secp256k1 } from '@bitauth/libauth/build/lib/crypto/default-crypto-instances.js';
import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { blockhashKeeperBatonLockingBytecode, type Artifact } from '@solidcash/utils';
import type { Output } from '../interfaces.js';

/** An opt-in genesis baton can mint only blockhash records, under its keeper signature. */
export function blockhashKeeperGenesisOutput(
  artifact: Artifact, categoryId: string, publicKey: Uint8Array | undefined, amount = 10_000n,
): Output | undefined {
  if (publicKey === undefined) return undefined;
  if (artifact.usesBlockhash !== true) throw new Error('blockhash keeper deployment requires a blockhash-reading artifact');
  if (publicKey.length !== 33 || !secp256k1.validatePublicKey(publicKey)) {
    throw new Error('blockhashKeeperPublicKey must be a valid compressed public key');
  }
  if (amount < 3_000n) throw new Error('blockhashKeeperAmount must fund at least one mint and its fee (3,000 satoshis)');
  return {
    to: blockhashKeeperBatonLockingBytecode(hexToBin(categoryId), publicKey), amount,
    token: { category: categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  };
}
