/**
 * KernelExecutionPlan bytecode commitment: tagged KernelExecutionPlan digest commitment embedded in route bytecode.
 * Mirrors journal-disposition SCJD push/drop markers (`SCKP` = SolidCash Kernel Plan).
 */
/** Tagged pushed-data commitment embedded in a compiler/SDK-authored kernel route. `SCKP`, version 1. */
export const KERNEL_PLAN_DIGEST_COMMITMENT_TAG_HEX = '53434b5001';
/** Canonical artifact-ASM marker for `<SCKP || version || plan digest> OP_DROP`. */
export function kernelPlanDigestCommitmentMarker(digest) {
    if (!/^[0-9a-f]{64}$/.test(digest))
        return undefined;
    return `${KERNEL_PLAN_DIGEST_COMMITMENT_TAG_HEX}${digest} OP_DROP`;
}
/**
 * Encode the plan-digest bytecode fragment (ASM push + OP_DROP).
 * Callers append this to route ASM so transplanting plan metadata without bytecode change fails closed.
 */
export function encodeKernelPlanDigestBytecode(digest) {
    const marker = kernelPlanDigestCommitmentMarker(digest);
    if (marker === undefined) {
        throw new Error(`kernel-plan-commitment: digest must be 64 lowercase hex chars, got '${digest}'`);
    }
    return marker;
}
/** Whether artifact ASM contains exactly one complete marker token pair for this digest. */
export function hasUniqueKernelPlanDigestCommitment(bytecode, digest) {
    const marker = kernelPlanDigestCommitmentMarker(digest);
    if (!marker)
        return false;
    const [data, drop] = marker.split(' ');
    const tokens = bytecode.trim().split(/\s+/);
    let matches = 0;
    for (let index = 0; index + 1 < tokens.length; index += 1) {
        if (tokens[index] === data && tokens[index + 1] === drop)
            matches += 1;
    }
    // Whole-program outlining may serialize OP_DEFINE bodies as one hex token — same framing as SCJD.
    const encoded = `25${data}75`;
    for (const token of tokens) {
        if (!/^[0-9a-f]+$/.test(token))
            continue;
        let offset = token.indexOf(encoded);
        while (offset >= 0) {
            matches += 1;
            offset = token.indexOf(encoded, offset + 1);
        }
    }
    return matches === 1;
}
/** Append a unique plan-digest commitment marker to artifact ASM (idempotent if already unique). */
export function embedKernelPlanDigestInBytecode(bytecode, digest) {
    if (hasUniqueKernelPlanDigestCommitment(bytecode, digest))
        return bytecode;
    const marker = encodeKernelPlanDigestBytecode(digest);
    const trimmed = bytecode.trim();
    return trimmed.length === 0 ? marker : `${trimmed} ${marker}`;
}
//# sourceMappingURL=kernel-execution-plan-commitment.js.map