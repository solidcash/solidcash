/**
 * Token-container co-layout proof: non-overlapping physical spans for dynamic chunks beside tokens[category].
 *
 * Describes non-overlapping physical spans when dynamic chunk writes share a handler
 * with `tokens[category]` access: co-spent `tokenContainer` input slots vs trailing dyn band.
 */
/** Build a versioned co-layout proof from admitted sites. */
export function buildTokenContainerCoLayoutProof(sites) {
    if (sites.length === 0) {
        throw new Error('token-container-co-layout: sites must be non-empty');
    }
    for (const site of sites) {
        if (!site.handlerName) {
            throw new Error('token-container-co-layout: handlerName required');
        }
        if (site.dynamicWrites.length === 0) {
            throw new Error(`token-container-co-layout: ${site.handlerName} needs ≥1 dynamicWrites`);
        }
        if (site.tokenContainerSlotIndices.length === 0) {
            throw new Error(`token-container-co-layout: ${site.handlerName} needs ≥1 tokenContainerSlotIndices`);
        }
        if (site.spanKind !== 'tokenContainer-input-plus-trailing-dyn'
            && site.spanKind !== 'tokenContainer-tcTransfer-plus-trailing-dyn') {
            throw new Error(`token-container-co-layout: unsupported spanKind ${String(site.spanKind)}`);
        }
    }
    return {
        version: 1,
        sites: Object.freeze(sites.map((site) => Object.freeze({ ...site }))),
    };
}
/** Fail-closed reader for a published proof. */
export function assertTokenContainerCoLayoutProof(proof) {
    if (proof === undefined) {
        throw new Error('token-container-co-layout: proof missing');
    }
    if (proof.version !== 1) {
        throw new Error(`token-container-co-layout: unsupported version ${String(proof.version)}`);
    }
    buildTokenContainerCoLayoutProof(proof.sites);
}
/**
 * Whether a block layout + dynamic writes describe an honest #9 co-layout geometry
 * (tokenContainer slots present alongside trailing dyn capacity).
 * When `requireTcTransfer` is set, also requires at least one `tcTransfer` slot
 * (token-container transfer residual span descriptor).
 */
export function hasTokenContainerCoLayoutGeometry(params) {
    const tcSlots = params.slots.filter((slot) => slot.kind === 'tokenContainer');
    if (tcSlots.length === 0)
        return false;
    if ((params.dynamicWrites?.length ?? 0) === 0)
        return false;
    if (params.requireTcTransfer === true) {
        if (!params.slots.some((slot) => slot.kind === 'tcTransfer'))
            return false;
    }
    // Trailing capacity may be implicit via trailing slots; accept either.
    // Transfer+dyn layouts often carry dataNft beside tcTransfer without an explicit trailing
    // slot until route union; treat dataNft as dyn-capacity witness for the residual descriptor.
    const hasTrailing = params.slots.some((slot) => slot.kind === 'trailing')
        || (params.trailingCapacity !== undefined && params.trailingCapacity > 0)
        || (params.requireTcTransfer === true && params.slots.some((slot) => slot.kind === 'dataNft'));
    return hasTrailing;
}
//# sourceMappingURL=token-container-co-layout.js.map