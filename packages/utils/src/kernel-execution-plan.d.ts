/**
 * Shared KernelExecutionPlan create/digest (KernelExecutionPlan create/digest; KernelExecutionPlan bytecode commitment).
 * solidc stamps at compile; solidcash stamps at compose/SDK; both share this canonical digest.
 */
export declare const KERNEL_PLAN_VERSION: 1;
export type KernelPlanFeatureBits = {
    ownerAltAnchor?: boolean;
    handlerBandModel?: boolean;
    multiContinuation?: boolean;
    resourceFold?: boolean;
};
export type KernelResourceBudget = {
    maximumRows?: number;
    maximumParticipants?: number;
    maximumBlobBytes?: number;
    maximumJournalRecords?: number;
    maximumDynamicChunks?: number;
    maximumValueContinuationChunks?: number;
    maximumEvents?: number;
    maximumTransfers?: number;
    maximumReturnCarriers?: number;
    maximumExternalEdges?: number;
    maximumExternalDepth?: number;
    maximumStackDepth?: number;
    maximumAltStackDepth?: number;
    maximumOperationCost?: number;
    maximumTransactionBytes?: number;
};
export type KernelExecutionPlan = {
    kernelPlanVersion: typeof KERNEL_PLAN_VERSION;
    /** Stable handler id (not name). */
    handlerId: string;
    /** Diagnostic only. */
    handlerName?: string;
    selectedResources?: readonly string[];
    symbolicBands?: readonly {
        kind: string;
        localBase: number;
        capacity: number;
    }[];
    ownershipClaimCount?: number;
    journalDispositionDigest?: string;
    dynamicReads?: readonly string[];
    dynamicWrites?: readonly string[];
    /** Explicit empty vs omitted: always present on kernel plans. */
    dynamicWritesPublished: true;
    effectLanes?: readonly string[];
    resultLanes?: readonly string[];
    requiredFeatureBits?: KernelPlanFeatureBits;
    minimumSdkReaderVersion?: number;
    budgets?: KernelResourceBudget;
};
export declare function createKernelExecutionPlan(partial: Omit<KernelExecutionPlan, 'kernelPlanVersion' | 'dynamicWritesPublished'> & {
    dynamicWrites?: readonly string[];
}): KernelExecutionPlan;
/** Canonical digest of every execution-affecting descriptor. */
export declare function digestKernelExecutionPlan(plan: KernelExecutionPlan): string;
/**
 * Kernel artifacts must publish required metadata; missing fields fail closed.
 * Legacy adapters may still see omitted vectors as undefined outside this plan object.
 */
export declare function assertKernelPlanComplete(plan: KernelExecutionPlan): void;
/** Reject envelopes that exceed published worst-case budgets before UTXO fetch. */
export declare function assertWithinKernelBudgets(plan: KernelExecutionPlan, usage: Partial<KernelResourceBudget>): void;
export type PublishedKernelExecutionPlan = {
    handlerId: string;
    kernelPlanVersion: number;
    digest: string;
    handlerName?: string;
};
