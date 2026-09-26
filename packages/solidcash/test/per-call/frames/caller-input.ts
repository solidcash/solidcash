import { encodeDataPush } from '@bitauth/libauth';

/**
 * A root frame's caller is a P2PKH input whose unlocking bytecode is `<push(signature)> <push(pubkey)>`. The bytes
 * are filler: the input under test is the master, not the caller's own P2PKH, so only the shape and the signature's
 * last byte — the hash type — matter to it.
 */

/** `SIGHASH_ALL`, the hash type a root frame's caller signs with. */
export const SIGHASH_ALL = 0x41;

const SIGNATURE_LENGTH_WITHOUT_HASH_TYPE = 64; // a Schnorr signature, before its trailing hash-type byte
const PUBKEY_LENGTH = 33;

/** The caller's unlocking bytecode: a filler signature ending in `hashType`, then a filler pubkey. */
export function callerUnlockingBytecode(hashType: number = SIGHASH_ALL): Uint8Array {
  const signature = new Uint8Array(SIGNATURE_LENGTH_WITHOUT_HASH_TYPE + 1).fill(0x30);
  signature[signature.length - 1] = hashType;
  return new Uint8Array([
    ...encodeDataPush(signature),
    ...encodeDataPush(new Uint8Array(PUBKEY_LENGTH).fill(0x02)),
  ]);
}
