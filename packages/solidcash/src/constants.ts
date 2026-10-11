export const VERSION_SIZE = 4;
export const LOCKTIME_SIZE = 4;
export const P2PKH_INPUT_SIZE = 32 + 4 + 1 + 1 + 65 + 1 + 33 + 4;
// Size of a placeholder P2PKH unlocking script once signed with Schnorr: push(signature) push(public key).
export const PLACEHOLDER_P2PKH_UNLOCKING_SIZE = 1 + 65 + 1 + 33;
