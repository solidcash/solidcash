/**
 * KernelExecutionPlan bytecode commitment: tagged KernelExecutionPlan digest commitment embedded in route bytecode.
 * Mirrors journal-disposition SCJD push/drop markers (`SCKP` = SolidCash Kernel Plan).
 */
/** Tagged pushed-data commitment embedded in a compiler/SDK-authored kernel route. `SCKP`, version 1. */
export declare const KERNEL_PLAN_DIGEST_COMMITMENT_TAG_HEX = "53434b5001";
/** Canonical artifact-ASM marker for `<SCKP || version || plan digest> OP_DROP`. */
export declare function kernelPlanDigestCommitmentMarker(digest: string): string | undefined;
/**
 * Encode the plan-digest bytecode fragment (ASM push + OP_DROP).
 * Callers append this to route ASM so transplanting plan metadata without bytecode change fails closed.
 */
export declare function encodeKernelPlanDigestBytecode(digest: string): string;
/** Whether artifact ASM contains exactly one complete marker token pair for this digest. */
export declare function hasUniqueKernelPlanDigestCommitment(bytecode: string, digest: string): boolean;
/** Append a unique plan-digest commitment marker to artifact ASM (idempotent if already unique). */
export declare function embedKernelPlanDigestInBytecode(bytecode: string, digest: string): string;
