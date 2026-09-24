/**
 * Token-container co-layout proof: non-overlapping physical spans for dynamic chunks beside tokens[category].
 *
 * Describes non-overlapping physical spans when dynamic chunk writes share a handler
 * with `tokens[category]` access: co-spent `tokenContainer` input slots vs trailing dyn band.
 */
export type TokenContainerCoLayoutSpanKind = 'tokenContainer-input-plus-trailing-dyn'
/** Token-container co-layout transfer residual: tcTransfer output band beside trailing dyn + co-spent container input. */
 | 'tokenContainer-tcTransfer-plus-trailing-dyn';
export type TokenContainerCoLayoutSite = {
    /** Source / published handler name (not a compiler clone). */
    handlerName: string;
    selector?: string;
    /** Dynamic state names written in the same handler. */
    dynamicWrites: readonly string[];
    /** Reserved `tokenContainer` block-layout slot indices. */
    tokenContainerSlotIndices: readonly number[];
    /** How the spans are non-overlapping. */
    spanKind: TokenContainerCoLayoutSpanKind;
};
export type TokenContainerCoLayoutProof = {
    version: 1;
    sites: readonly TokenContainerCoLayoutSite[];
};
/** Build a versioned co-layout proof from admitted sites. */
export declare function buildTokenContainerCoLayoutProof(sites: readonly TokenContainerCoLayoutSite[]): TokenContainerCoLayoutProof;
/** Fail-closed reader for a published proof. */
export declare function assertTokenContainerCoLayoutProof(proof: TokenContainerCoLayoutProof | undefined): asserts proof is TokenContainerCoLayoutProof;
/**
 * Whether a block layout + dynamic writes describe an honest #9 co-layout geometry
 * (tokenContainer slots present alongside trailing dyn capacity).
 * When `requireTcTransfer` is set, also requires at least one `tcTransfer` slot
 * (token-container transfer residual span descriptor).
 */
export declare function hasTokenContainerCoLayoutGeometry(params: {
    slots: readonly {
        kind: string;
        slotIndex?: number;
    }[];
    dynamicWrites?: readonly string[];
    trailingCapacity?: number;
    requireTcTransfer?: boolean;
}): boolean;
