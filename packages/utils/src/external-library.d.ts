import { AbiInput, AbiOutput, ExternalLibraryAbi } from './artifact.js';
export declare const SHARED_LIBRARY_SALT: Uint8Array<ArrayBuffer>;
export declare const INLINE_MAX_BLOB_LENGTH = 256;
export interface ExternalLibrary {
    name: string;
    blob: Uint8Array;
    blobHash: Uint8Array;
    functionId: bigint;
    abi: {
        inputs: AbiInput[];
        outputs: AbiOutput[];
    };
    registrar?: boolean;
}
export declare const BUILTIN_LIBRARIES: Record<string, ExternalLibrary>;
export interface UserLibraryInput {
    name: string;
    code: string;
    abi: {
        inputs: AbiInput[];
        outputs: AbiOutput[];
    };
    registrar?: boolean;
}
export declare function resolveLibraries(userLibraries?: readonly UserLibraryInput[]): Record<string, ExternalLibrary>;
export declare function resolveLibraryBlob(lib: ExternalLibraryAbi): Uint8Array;
export declare function pushPrefixLength(len: number): number;
export declare const SIDECAR_SALT_PREFIX_LENGTH = 34;
export declare const SIDECAR_SELFPRES_LENGTH = 6;
/**
 * The successive lengths a contract's loader strips off the side-car INPUT bytecode (= PUSHDATA(redeem))
 * to reach the blob: drop outerPush, saltPrefix, selfPres, blobPush; then take blobLength (drop the
 * OP_DROP OP_1 suffix). Derived from the blob length; salt-independent.
 */
export declare function sidecarStripOffsets(blob: Uint8Array): {
    outerPush: number;
    saltPrefix: number;
    selfPres: number;
    blobPush: number;
    blobLength: number;
};
/**
 * Build a side-car redeem wrapping a library blob:
 *   <salt:32> OP_DROP | self-pres | PUSHDATA(blob) | OP_DROP OP_1
 * self-pres recreates the side-car against the LAST output. salt = the contract token category (branded)
 * or 32 zero bytes (shared). The loader strips down to the blob using sidecarCodeRange().
 */
export declare function buildSidecarRedeem(blob: Uint8Array, salt: Uint8Array): Uint8Array;
/** P2SH32 locking bytecode for a side-car: OP_HASH256 <hash256(redeem)> OP_EQUAL. */
export declare function sidecarLockingBytecode(blob: Uint8Array, salt: Uint8Array): Uint8Array;
/**
 * Byte range of the blob within the side-car INPUT bytecode (the revealed P2SH redeem = PUSHDATA(redeem)),
 * i.e. the codeBegin/codeEnd the loader strips to. Derived from the blob length; salt-independent.
 */
export declare function sidecarCodeRange(blob: Uint8Array): {
    codeBegin: number;
    codeEnd: number;
};
