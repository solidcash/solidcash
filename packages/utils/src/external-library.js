// Generic registry of external script libraries ("precompiles") callable from contracts by name.
// Built-in libraries (keccak256, another hashing scheme) plus user-supplied ones share this shape. A library
// is a self-contained, OP_DEFINE-able script blob (a function inputs -> outputs) with an ABI signature.
// It is either inlined into the contract redeem or loaded at runtime from a co-spent side-car UTXO.
// See packages/solidc/docs/external-libraries.md.
import { hexToBin } from '@bitauth/libauth';
import { Op, scriptToBytecode } from './script.js';
import { hash256 } from './hash.js';
import { KECCAK256_LIBRARY_BLOB, KECCAK256_LIBRARY_BLOB_HASH, KECCAK256_LIBRARY_ID, } from './keccak-library.js';
// Salt for a SHARED (unbranded) side-car: 32 zero bytes. Branded side-cars salt with the contract category.
export const SHARED_LIBRARY_SALT = new Uint8Array(32);
// Auto-inline cutoff: a single-call library with a blob no larger than this is inlined into the contract
// bytecode (no side-car). Larger blobs (e.g. keccak256, 2326 B) use a side-car so they live once on-chain.
export const INLINE_MAX_BLOB_LENGTH = 256;
// Built-in precompiles. User libraries (blob+ABI, or compiled from .scash) are merged into this set at
// compile time. Future built-ins (another hashing scheme, ...) are added as more named entries.
export const BUILTIN_LIBRARIES = {
    keccak256: {
        name: 'keccak256',
        // keccak256 is ALWAYS the compute (result-NFT) model now: the side-car runs keccak in its own budget and
        // commits the result, so the contract never loads this blob (the loader is skipped, and the artifact
        // descriptor omits the inline blobHash/codeBegin/codeEnd). The blob/hash/id stay here as the canonical
        // keccak script (docs/keccak-poc reference) and to satisfy the ExternalLibrary shape; only `abi` is consumed.
        blob: hexToBin(KECCAK256_LIBRARY_BLOB),
        blobHash: hexToBin(KECCAK256_LIBRARY_BLOB_HASH),
        functionId: KECCAK256_LIBRARY_ID,
        abi: { inputs: [{ name: 'message', type: 'bytes' }], outputs: [{ type: 'bytes32' }] },
        registrar: true, // blob defines the round + keccak-main when run once -> re-entrant keccak256
    },
};
// The full library set for a compilation: built-in precompiles + user libraries. User libraries get
// function ids after the built-ins'. Throws on a name collision (incl. shadowing a built-in).
export function resolveLibraries(userLibraries) {
    const resolved = { ...BUILTIN_LIBRARIES };
    let nextId = Object.values(BUILTIN_LIBRARIES).reduce((max, l) => (l.functionId > max ? l.functionId : max), 0x1008n) + 1n;
    for (const ul of userLibraries ?? []) {
        if (resolved[ul.name])
            throw new Error(`External library '${ul.name}' is already defined`);
        const blob = hexToBin(ul.code);
        resolved[ul.name] = {
            name: ul.name, blob, blobHash: hash256(blob), functionId: nextId, abi: ul.abi,
            ...(ul.registrar && { registrar: true }),
        };
        nextId += 1n;
    }
    return resolved;
}
// Resolve a library's script blob from its artifact descriptor: user libraries carry the blob inline
// (descriptor.code); built-ins are looked up by name in the registry.
export function resolveLibraryBlob(lib) {
    if (lib.code)
        return hexToBin(lib.code);
    const builtin = BUILTIN_LIBRARIES[lib.name];
    if (!builtin)
        throw new Error(`External library '${lib.name}' has no blob: not a built-in and no inline code`);
    return builtin.blob;
}
// Minimal data-push prefix length for a push of `len` bytes (direct / PUSHDATA1 / PUSHDATA2 / PUSHDATA4).
export function pushPrefixLength(len) {
    if (len <= 75)
        return 1;
    if (len <= 255)
        return 2;
    if (len <= 65535)
        return 3;
    return 5;
}
// Fixed parts of the side-car redeem wrapper (same for every library).
export const SIDECAR_SALT_PREFIX_LENGTH = 34; // OP_PUSHBYTES_32 + 32 salt bytes + OP_DROP
export const SIDECAR_SELFPRES_LENGTH = 6; // INPUTINDEX UTXOBYTECODE TXOUTPUTCOUNT 1SUB OUTPUTBYTECODE EQUALVERIFY
/**
 * The successive lengths a contract's loader strips off the side-car INPUT bytecode (= PUSHDATA(redeem))
 * to reach the blob: drop outerPush, saltPrefix, selfPres, blobPush; then take blobLength (drop the
 * OP_DROP OP_1 suffix). Derived from the blob length; salt-independent.
 */
export function sidecarStripOffsets(blob) {
    const blobPush = pushPrefixLength(blob.length);
    const redeemLength = SIDECAR_SALT_PREFIX_LENGTH + SIDECAR_SELFPRES_LENGTH + blobPush + blob.length + 2;
    return {
        outerPush: pushPrefixLength(redeemLength),
        saltPrefix: SIDECAR_SALT_PREFIX_LENGTH,
        selfPres: SIDECAR_SELFPRES_LENGTH,
        blobPush,
        blobLength: blob.length,
    };
}
/**
 * Build a side-car redeem wrapping a library blob:
 *   <salt:32> OP_DROP | self-pres | PUSHDATA(blob) | OP_DROP OP_1
 * self-pres recreates the side-car against the LAST output. salt = the contract token category (branded)
 * or 32 zero bytes (shared). The loader strips down to the blob using sidecarCodeRange().
 */
export function buildSidecarRedeem(blob, salt) {
    if (salt.length !== 32)
        throw new Error('side-car salt must be 32 bytes');
    const script = [
        salt, Op.OP_DROP,
        Op.OP_INPUTINDEX, Op.OP_UTXOBYTECODE, Op.OP_TXOUTPUTCOUNT, Op.OP_1SUB, Op.OP_OUTPUTBYTECODE, Op.OP_EQUALVERIFY,
        blob, Op.OP_DROP, Op.OP_1,
    ];
    return scriptToBytecode(script);
}
/** P2SH32 locking bytecode for a side-car: OP_HASH256 <hash256(redeem)> OP_EQUAL. */
export function sidecarLockingBytecode(blob, salt) {
    return Uint8Array.from([0xaa, 0x20, ...hash256(buildSidecarRedeem(blob, salt)), 0x87]);
}
/**
 * Byte range of the blob within the side-car INPUT bytecode (the revealed P2SH redeem = PUSHDATA(redeem)),
 * i.e. the codeBegin/codeEnd the loader strips to. Derived from the blob length; salt-independent.
 */
export function sidecarCodeRange(blob) {
    const saltPrefix = 1 + 32 + 1; // OP_PUSHBYTES_32 + 32 salt bytes + OP_DROP
    const selfPres = 6; // INPUTINDEX UTXOBYTECODE TXOUTPUTCOUNT 1SUB OUTPUTBYTECODE EQUALVERIFY
    const blobPush = pushPrefixLength(blob.length);
    const redeemLength = saltPrefix + selfPres + blobPush + blob.length + 2; // + OP_DROP OP_1
    const outerPush = pushPrefixLength(redeemLength);
    const codeBegin = outerPush + saltPrefix + selfPres + blobPush;
    return { codeBegin, codeEnd: codeBegin + blob.length };
}
//# sourceMappingURL=external-library.js.map