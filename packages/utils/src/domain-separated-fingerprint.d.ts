/**
 * Domain-separated canonical binary fingerprints.
 *
 * Identity digests must not be raw `JSON.stringify` hashes: key order is unstable across
 * engines for some shapes, and distinct digest purposes must not collide. Every fingerprint
 * starts with an explicit domain tag, then length-prefixed named fields, then SHA-256.
 */
/** Journal-disposition manifest digest domain. */
export declare const FINGERPRINT_DOMAIN_JOURNAL_DISPOSITION = "solidcash.kernel-journal-disposition.v1";
/** Worklist / graph artifact execution-identity domain. */
export declare const FINGERPRINT_DOMAIN_ARTIFACT_EXECUTION = "solidcash.artifact-execution-identity.v1";
export type FingerprintField = {
    name: string;
    value: Uint8Array | string;
};
/** Encode one named field: u16 nameLen | name | u32 valueLen | value. */
export declare function encodeFingerprintField(name: string, value: Uint8Array | string): Uint8Array;
/**
 * Domain-separated SHA-256 fingerprint over ordered named fields.
 * Changing the domain or any field name/value changes the digest.
 */
export declare function domainSeparatedFingerprint(domain: string, fields: readonly FingerprintField[]): string;
/** Recursively sort object keys for stable nested publication encoding. */
export declare function canonicalJsonValue(value: unknown): unknown;
/** Stable UTF-8 JSON for nested identity slices (keys sorted recursively). */
export declare function canonicalJsonBytes(value: unknown): Uint8Array;
/**
 * Artifact execution identity for graph/worklist planning.
 * Domain-separated over bytecode, fingerprint, ABI selectors, messageBus, and stateLayout.
 */
export declare function artifactExecutionIdentityFingerprint(artifact: {
    contractName?: string;
    bytecode?: string;
    fingerprint?: string;
    abi?: unknown;
    messageBus?: unknown;
    stateLayout?: unknown;
}): string;
